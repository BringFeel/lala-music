import youtubedl from 'youtube-dl-exec';
import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { t } from './i18n/index.js';

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
  const line = text.split(/\r?\n/).filter(Boolean).at(-1) ?? t('ytdlp.error_fallback');
  return line.length > 300 ? `${line.slice(0, 300)}...` : line;
}

export async function resolve(input, signal) {
  if (!isLink(input)) {
    return [{ input, title: null }];
  }

  let result;
  try {
    result = await youtubedl.exec(input, {
      dumpSingleJson: true,
      flatPlaylist: true,
      noWarnings: true,
    }, { signal });
  } catch (error) {
    throw new Error(cleanError(error));
  }

  let data;
  try {
    data = JSON.parse(String(result.stdout ?? ''));
  } catch {
    throw new Error(t('ytdlp.invalid_info'));
  }

  const entries = Array.isArray(data.entries) ? data.entries.filter(Boolean) : [];
  if (data._type === 'playlist' && entries.length > 0) {
    return entries
      .map((entry) => ({
        input: entry.url ?? entry.webpage_url ?? null,
        title: entry.title ?? null,
      }))
      .filter((entry) => entry.input);
  }

  return [{ input, title: data.title ?? null }];
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
    throw new Error(t('ytdlp.no_audio_file'));
  }

  const title = lines.slice(0, -1).join(' ').trim() || input;
  return { title, file, dir };
}

export async function removeDownload(dir) {
  if (dir) await rm(dir, { recursive: true, force: true });
}
