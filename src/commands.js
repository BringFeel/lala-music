import { formatDuration } from './stats.js';

export function createCommandHandler({ player, say, stats, prefix, botName }) {
  return async function handle(text, from) {
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
        const position = player.enqueue(argument, from);
        await stats.recordSong().catch((error) => {
          console.error(`No se pudieron guardar las estadísticas: ${error.message}`);
        });
        say(`Añadido a la cola (#${position}): ${argument}`);
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
          `${prefix}play <enlace o búsqueda> (${prefix}p): agrega una canción a la cola`,
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
  };
}
