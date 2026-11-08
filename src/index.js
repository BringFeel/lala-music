import readline from 'node:readline';
import {
  AudioSource,
  DisconnectReason,
  LocalAudioTrack,
  Room,
  RoomEvent,
  TrackPublishOptions,
  TrackSource,
} from '@livekit/rtc-node';
import { config } from './config.js';
import { LalaClient } from './lala.js';
import { MusicPlayer } from './player.js';
import { createCommandHandler } from './commands.js';
import { loadAvatar } from './avatar.js';
import { Stats } from './stats.js';

const CHECK_INTERVAL_MS = 5000;
const ALONE_TIMEOUT_MS = 30000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isFatal(error) {
  return ['password_required', 'wrong_password', 'not_allowed', 'banned'].includes(error.code);
}

function countUsers(roomInfo, selfIdentity) {
  if (Array.isArray(roomInfo.participants)) {
    return roomInfo.participants.filter((participant) => participant.identity !== selfIdentity).length;
  }
  return roomInfo.numParticipants ?? 0;
}

async function waitForRoom(lala, isClosing, selfIdentity) {
  let lastStatus = '';
  while (!isClosing()) {
    let roomInfo;
    try {
      roomInfo = await lala.findRoom(config.channelName);
    } catch (error) {
      if (error.code === 'room_not_found') {
        const status = `El canal "${config.channelName}" todavía no existe. Esperando...`;
        if (status !== lastStatus) {
          console.log(status);
          lastStatus = status;
        }
      } else if (error.code === 'server_unavailable' || error.code === 'server_error') {
        const status = `No se pudo consultar el canal: ${error.message}. Reintentando...`;
        if (status !== lastStatus) {
          console.error(status);
          lastStatus = status;
        }
      } else {
        throw error;
      }
      await sleep(CHECK_INTERVAL_MS);
      continue;
    }

    const users = countUsers(roomInfo, selfIdentity);
    if (users > 0) {
      console.log(`Canal "${roomInfo.displayName}": ${users} usuario${users === 1 ? '' : 's'}. Conectando...`);
      return roomInfo;
    }

    const status = `El canal "${roomInfo.displayName}" está vacío. Esperando usuarios...`;
    if (status !== lastStatus) {
      console.log(status);
      lastStatus = status;
    }
    await sleep(CHECK_INTERVAL_MS);
  }
  return null;
}

async function startSession(lala, roomInfo, avatar, stats) {
  const access = await lala.getToken(roomInfo);
  const room = new Room();
  const roomOptions = { autoSubscribe: false, dynacast: false };
  if (access.e2eeKey) {
    roomOptions.encryption = { keyProviderOptions: { sharedKey: access.e2eeKey } };
  }

  let source;
  try {
    await room.connect(access.url, access.token, roomOptions);
    stats.beginCall();
    if (avatar) {
      try {
        await room.localParticipant.setAttributes({ 'lala.avatar': avatar });
      } catch (error) {
        console.error(`No se pudo establecer la foto de perfil: ${error.message}`);
      }
    }
    source = new AudioSource(48000, 1);
    const track = LocalAudioTrack.createAudioTrack('music', source);
    await room.localParticipant.publishTrack(
      track,
      new TrackPublishOptions({ source: TrackSource.SOURCE_MICROPHONE }),
    );
  } catch (error) {
    await stats.endCall().catch((statsError) => {
      console.error(`No se pudieron guardar las estadísticas: ${statsError.message}`);
    });
    await room.disconnect().catch(() => {});
    throw error;
  }

  const say = (text) => {
    console.log(text);
    room.localParticipant?.sendText(text, { topic: 'lk.chat' }).catch(() => {});
  };

  const reportError = (error, context) => {
    console.error(context ? `${context}: ${error.message}` : error.message);
    if (error?.stack) console.error(error.stack);
    say('Ocurrió un error inesperado.');
  };

  const player = new MusicPlayer({ source, say, ffmpegPath: config.ffmpegPath, onError: reportError });
  const handle = createCommandHandler({
    player,
    say,
    stats,
    prefix: config.commandPrefix,
    botName: config.botName,
    onError: reportError,
  });

  room.registerTextStreamHandler('lk.chat', async (reader, participant) => {
    try {
      const text = await reader.readAll();
      await handle(text, participant.identity);
    } catch (error) {
      console.error(`Error leyendo mensaje de ${participant.identity}: ${error.message}`);
    }
  });

  let ended = false;
  let aloneTimer = null;
  let initialCheckTimer = null;
  let resolveDone;
  const done = new Promise((resolve) => {
    resolveDone = resolve;
  });

  const clearAloneTimer = () => {
    if (!aloneTimer) return;
    clearTimeout(aloneTimer);
    aloneTimer = null;
  };

  let finishResult = null;
  const finish = (result) => {
    if (finishResult) return finishResult;
    ended = true;
    clearAloneTimer();
    if (initialCheckTimer) clearTimeout(initialCheckTimer);
    finishResult = (async () => {
      await player.stop();
      await stats.endCall().catch((statsError) => {
        console.error(`No se pudieron guardar las estadísticas: ${statsError.message}`);
      });
      await room.disconnect().catch(() => {});
      await source.close().catch(() => {});
      resolveDone(result);
    })();
    return finishResult;
  };

  const stop = async (message) => {
    await finish({ fatal: false, message });
  };

  const startAloneTimer = () => {
    if (ended || aloneTimer) return;
    console.log('El bot está solo en el canal. Se desconectará en 30 segundos si no entra nadie.');
    aloneTimer = setTimeout(() => {
      aloneTimer = null;
      if (ended) return;
      if (room.remoteParticipants.size > 0) return;
      void stop('Desconectado: el bot estuvo solo 30 segundos.');
    }, ALONE_TIMEOUT_MS);
  };

  const updateAlone = () => {
    if (ended) return;
    if (room.remoteParticipants.size > 0) {
      if (aloneTimer) {
        clearAloneTimer();
        console.log('Hay usuarios en el canal. Se canceló la desconexión.');
      }
      return;
    }
    startAloneTimer();
  };

  room.on(RoomEvent.ParticipantConnected, (participant) => {
    console.log(`Entró ${participant.name || participant.identity} al canal.`);
    updateAlone();
  });

  room.on(RoomEvent.ParticipantDisconnected, (participant) => {
    console.log(`Salió ${participant.name || participant.identity} del canal.`);
    updateAlone();
  });

  room.on(RoomEvent.Disconnected, (reason) => {
    if (ended) return;

    const removed = reason === DisconnectReason.PARTICIPANT_REMOVED;
    const duplicate = reason === DisconnectReason.DUPLICATE_IDENTITY;
    void finish({
      fatal: removed || duplicate,
      message: removed
        ? 'El bot fue expulsado del canal.'
        : duplicate
          ? 'Hay otra instancia del bot conectada con la misma identidad.'
          : `Desconectado del canal (motivo: ${DisconnectReason[reason] ?? reason}).`,
    });
  });

  initialCheckTimer = setTimeout(updateAlone, 1000);

  console.log(`Conectado a "${roomInfo.displayName}" como ${config.botName}`);
  console.log(`Comandos: ${config.commandPrefix}play <enlace o búsqueda>, ${config.commandPrefix}skip, ${config.commandPrefix}clear, ${config.commandPrefix}stats, ${config.commandPrefix}help`);

  return { identity: access.identity, handle, stop, done };
}

async function main() {
  const lala = new LalaClient(config);
  await lala.login();

  const avatar = await loadAvatar(config.ffmpegPath, config.avatarPath).catch((error) => {
    console.error(`No se pudo preparar la foto de perfil: ${error.message}`);
    return null;
  });
  if (avatar) console.log('Foto de perfil cargada.');

  const stats = await Stats.create(config.statsPath);

  let closing = false;
  let session = null;
  let selfIdentity = null;
  let lastConnectError = '';

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.on('line', (line) => {
    const text = line.trim();
    if (!text) return;
    if (!session) {
      console.log('El bot no está conectado al canal.');
      return;
    }
    void session.handle(
      text.startsWith(config.commandPrefix) ? text : `${config.commandPrefix}${text}`,
      'consola',
    );
  });

  const shutdown = async () => {
    if (closing) return;
    closing = true;
    rl.close();
    if (session) await session.stop('Cerrando bot.');
    process.exit(0);
  };

  process.on('SIGINT', () => { void shutdown(); });
  process.on('SIGTERM', () => { void shutdown(); });

  while (!closing) {
    const roomInfo = await waitForRoom(lala, () => closing, selfIdentity);
    if (!roomInfo || closing) break;

    try {
      session = await startSession(lala, roomInfo, avatar, stats);
      lastConnectError = '';
    } catch (error) {
      if (closing) break;
      if (isFatal(error)) throw error;
      if (error.message !== lastConnectError) {
        console.error(`No se pudo conectar: ${error.message}`);
        lastConnectError = error.message;
      }
      await sleep(CHECK_INTERVAL_MS);
      continue;
    }

    selfIdentity = session.identity;
    const result = await session.done;
    session = null;
    if (closing) break;
    if (result.fatal) throw new Error(result.message);
    if (result.message) console.log(result.message);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
