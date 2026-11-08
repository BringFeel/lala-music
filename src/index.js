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
import { t, tPlural } from './i18n/index.js';

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
        const status = t('index.room.waiting_missing', { channel: config.channelName });
        if (status !== lastStatus) {
          console.log(status);
          lastStatus = status;
        }
      } else if (error.code === 'server_unavailable' || error.code === 'server_error') {
        const status = t('index.room.query_failed', { message: error.message });
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
      console.log(tPlural('index.room.users', users, { channel: roomInfo.displayName }));
      return roomInfo;
    }

    const status = t('index.room.empty', { channel: roomInfo.displayName });
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
        console.error(t('index.avatar.set_failed', { message: error.message }));
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
      console.error(t('stats.save_failed', { message: statsError.message }));
    });
    await room.disconnect().catch(() => {});
    throw error;
  }

  const say = (text) => {
    console.log(text);
    room.localParticipant?.sendText(text, { topic: 'lk.chat' }).catch(() => {});
  };

  const reportError = (error, context) => {
    console.error(context
      ? t('common.context_message', { context, message: error.message })
      : error.message);
    if (error?.stack) console.error(error.stack);
    say(t('index.unexpected_error'));
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
      console.error(t('index.chat.read_failed', {
        identity: participant.identity,
        message: error.message,
      }));
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
        console.error(t('stats.save_failed', { message: statsError.message }));
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
    console.log(t('index.lonely.start'));
    aloneTimer = setTimeout(() => {
      aloneTimer = null;
      if (ended) return;
      if (room.remoteParticipants.size > 0) return;
      void stop(t('index.lonely.disconnected'));
    }, ALONE_TIMEOUT_MS);
  };

  const updateAlone = () => {
    if (ended) return;
    if (room.remoteParticipants.size > 0) {
      if (aloneTimer) {
        clearAloneTimer();
        console.log(t('index.lonely.cancelled'));
      }
      return;
    }
    startAloneTimer();
  };

  room.on(RoomEvent.ParticipantConnected, (participant) => {
    console.log(t('index.participant.joined', { name: participant.name || participant.identity }));
    updateAlone();
  });

  room.on(RoomEvent.ParticipantDisconnected, (participant) => {
    console.log(t('index.participant.left', { name: participant.name || participant.identity }));
    updateAlone();
  });

  room.on(RoomEvent.Disconnected, (reason) => {
    if (ended) return;

    const removed = reason === DisconnectReason.PARTICIPANT_REMOVED;
    const duplicate = reason === DisconnectReason.DUPLICATE_IDENTITY;
    void finish({
      fatal: removed || duplicate,
      message: removed
        ? t('index.disconnect.removed')
        : duplicate
          ? t('index.disconnect.duplicate')
          : t('index.disconnect.generic', { reason: DisconnectReason[reason] ?? reason }),
    });
  });

  initialCheckTimer = setTimeout(updateAlone, 1000);

  console.log(t('index.connected', { channel: roomInfo.displayName, bot: config.botName }));
  console.log(t('index.commands_ready', {
    commands: t('index.commands_list', {
      play: t('commands.play.syntax', { prefix: config.commandPrefix }),
      skip: t('commands.skip.syntax', { prefix: config.commandPrefix }),
      clear: t('commands.clear.syntax', { prefix: config.commandPrefix }),
      stats: t('commands.stats.syntax', { prefix: config.commandPrefix }),
      help: t('commands.help.syntax', { prefix: config.commandPrefix }),
    }),
  }));

  return { identity: access.identity, handle, stop, done };
}

async function main() {
  const lala = new LalaClient(config);
  await lala.login();

  const avatar = await loadAvatar(config.ffmpegPath, config.avatarPath).catch((error) => {
    console.error(t('index.avatar.prepare_failed', { message: error.message }));
    return null;
  });
  if (avatar) console.log(t('index.avatar.loaded'));

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
      console.log(t('index.console.not_connected'));
      return;
    }
    void session.handle(
      text.startsWith(config.commandPrefix) ? text : `${config.commandPrefix}${text}`,
      t('index.console.identity'),
    );
  });

  const shutdown = async () => {
    if (closing) return;
    closing = true;
    rl.close();
    if (session) await session.stop(t('index.shutdown.closing'));
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
        console.error(t('index.connect_failed', { message: error.message }));
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
