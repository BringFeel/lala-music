import { formatDuration } from './stats.js';
import { resolve } from './ytdlp.js';
import { t, tPlural } from './i18n/index.js';

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
            say(t('commands.play.usage', { prefix }));
            return;
          }
          const tracks = await resolve(argument);
          if (tracks.length === 0) throw new Error(t('commands.play.empty'));
          const position = player.enqueueAll(tracks, from);
          if (tracks.length === 1) {
            say(t('commands.play.added_one', {
              position,
              title: tracks[0].title ?? argument,
            }));
          } else {
            say(t('commands.play.added_many', { count: tracks.length }));
          }
          await stats.recordSong(tracks.length).catch((error) => {
            console.error(t('stats.save_failed', { message: error.message }));
          });
          return;
        }
        case 'skip':
        case 's': {
          say(player.skip() ? t('commands.skip.skipped') : t('commands.skip.nothing'));
          return;
        }
        case 'clear':
        case 'c': {
          const count = player.clear();
          say(count > 0 ? tPlural('commands.clear.cleared', count) : t('commands.clear.empty'));
          return;
        }
        case 'stats': {
          const data = stats.snapshot();
          say([
            t('commands.stats.name', { name: botName }),
            t('commands.stats.uptime', { time: formatDuration(data.uptimeMs) }),
            t('commands.stats.songs', { song_count: data.songsPlayed }),
            t('commands.stats.call_time', { time: formatDuration(data.callTimeMs) }),
            '',
            t('commands.stats.credit'),
          ].join('\n'));
          return;
        }
        case 'help': {
          say([
            t('commands.help.title'),
            t('commands.help.play', { prefix }),
            t('commands.help.skip', { prefix }),
            t('commands.help.clear', { prefix }),
            t('commands.help.stats', { prefix }),
            t('commands.help.help', { prefix }),
          ].join('\n'));
          return;
        }
        default: {
          say(t('commands.unknown', { prefix, name }));
        }
      }
    } catch (error) {
      onError(error, t('commands.error_context', { from }));
    }
  };
}
