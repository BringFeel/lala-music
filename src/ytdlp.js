import youtubedl from 'youtube-dl-exec';
import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const BASE_DIR = join(tmpdir(), 'lala-music-bot');

function isLink(input) {
  try {
    const url = new URL(input);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function toTarget(input) {
  return isLink(input) ? input : `ytsearch1:${input}`;
}

function cleanError(error) {
  const text = String(error?.stderr || error?.message || error).trim();
  const line = text.split(/\r?\n/).filter(Boolean).at(-1) ?? 'Error de yt-dlp';
  return line.length > 300 ? `${line.slice(0, 300)}...` : line;
}

export async function download(input, signal) {
  const dir = join(BASE_DIR, randomUUID());
  await mkdir(dir, { recursive: true });

  let result;
  try {
    result = await youtubedl.exec(toTarget(input), {
      format: 'bestaudio[abr<=64]/bestaudio[abr<=96]/bestaudio/best',
      output: join(dir, 'audio.%(ext)s'),
      noPlaylist: true,
      noWarnings: true,
      noSimulate: true,
      print: ['%(title)s', 'after_move:filepath'],
    }, { signal });
  } catch (error) {
    await rm(dir, { recursive: true, force: true });
    throw new Error(cleanError(error));
  }

  const lines = String(result.stdout ?? '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const file = lines.at(-1);
  if (!file || !existsSync(file)) {
    await rm(dir, { recursive: true, force: true });
    throw new Error('yt-dlp no devolvió un archivo de audio');
  }

  const title = lines.slice(0, -1).join(' ').trim() || input;
  return { title, file, dir };
}

export async function removeDownload(dir) {
  if (dir) await rm(dir, { recursive: true, force: true });
}
