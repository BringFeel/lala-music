import { formatDuration } from './stats.js';
import { resolve } from './ytdlp.js';

export function createCommandHandler({
  player,
  say,
  stats,
  prefix,
  botName,
  onError = (error, context) => console.error(context ?? '', error),
}) {
  return async function handle(text, from) {
    try {
      const raw = String(text ?? '').trim();
      if (!raw.startsWith(prefix)) return;

      const body = raw.slice(prefix.length).trim();
      if (!body) return;

      const [name, ...rest] = body.split(/\s+/);
      const argument = rest.join(' ').trim();

      switch (name.toLowerCase()) {
        case 'play':
        case 'p': {
          if (!argument) {
            say(`Uso: ${prefix}play <enlace o búsqueda>`);
            return;
          }
          const tracks = await resolve(argument);
          if (tracks.length === 0) throw new Error('No se encontraron canciones para reproducir');
          const position = player.enqueueAll(tracks, from);
          if (tracks.length === 1) {
            say(`Añadido a la cola (#${position}): ${tracks[0].title ?? argument}`);
          } else {
            say(`Añadidas ${tracks.length} canciones a la cola`);
          }
          await stats.recordSong().catch((error) => {
            console.error(`No se pudieron guardar las estadísticas: ${error.message}`);
          });
          return;
        }
        case 'skip':
        case 's': {
          say(player.skip() ? 'Canción saltada' : 'No hay nada reproduciéndose');
          return;
        }
        case 'clear':
        case 'c': {
          const count = player.clear();
          say(count > 0 ? `Cola vaciada (${count} pendiente${count === 1 ? '' : 's'})` : 'La cola ya estaba vacía');
          return;
        }
        case 'stats': {
          const data = stats.snapshot();
          say([
            `Nombre: ${botName}`,
            `Tiempo Encendido: ${formatDuration(data.uptimeMs)}`,
            `Canciones Reproducidas: ${data.songsPlayed}`,
            `Tiempo en Llamada: ${formatDuration(data.callTimeMs)}`,
            '',
            'Desarrollado por BringFeel ❤️',
          ].join('\n'));
          return;
        }
        case 'help': {
          say([
            'Comandos disponibles:',
            `${prefix}play <enlace o búsqueda> (${prefix}p): agrega una canción o playlist a la cola`,
            `${prefix}skip (${prefix}s): salta la canción actual`,
            `${prefix}clear (${prefix}c): vacía la cola`,
            `${prefix}stats: muestra las estadísticas del bot`,
            `${prefix}help: muestra esta ayuda`,
          ].join('\n'));
          return;
        }
        default: {
          say(`Comando desconocido: ${prefix}${name}. Usa ${prefix}help`);
        }
      }
    } catch (error) {
      onError(error, `Error procesando comando de ${from}`);
    }
  };
}
