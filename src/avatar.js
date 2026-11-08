import { spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { t } from './i18n/index.js';

const MAX_AVATAR_LENGTH = 32 * 1024;
const AVATAR_SIZE = 128;

function encode(ffmpegPath, input, quality) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, [
      '-nostdin',
      '-hide_banner',
      '-loglevel', 'error',
      '-i', input,
      '-vf', `scale=${AVATAR_SIZE}:${AVATAR_SIZE}:force_original_aspect_ratio=increase,crop=${AVATAR_SIZE}:${AVATAR_SIZE}`,
      '-frames:v', '1',
      '-f', 'image2pipe',
      '-c:v', 'mjpeg',
      '-q:v', String(quality),
      'pipe:1',
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    const chunks = [];
    let stderr = '';

    proc.stdout.on('data', (chunk) => chunks.push(chunk));
    proc.stderr.on('data', (chunk) => {
      stderr += chunk;
      if (stderr.length > 4000) stderr = stderr.slice(-4000);
    });
    proc.on('error', (error) => {
      reject(new Error(t('common.ffmpeg_spawn_failed', {
        path: ffmpegPath,
        message: error.message,
      })));
    });
    proc.on('close', (code) => {
      if (code !== 0) {
        const detail = stderr.trim().split(/\r?\n/).filter(Boolean).at(-1);
        reject(new Error(detail
          ? t('common.ffmpeg_failed_detail', { detail })
          : t('common.ffmpeg_failed')));
        return;
      }
      resolve(Buffer.concat(chunks));
    });
  });
}

export async function loadAvatar(ffmpegPath, avatarPath) {
  if (!avatarPath) return null;

  let info;
  try {
    info = await stat(avatarPath);
  } catch (error) {
    throw new Error(t('avatar.read_failed', { path: avatarPath, message: error.message }));
  }
  if (!info.isFile()) throw new Error(t('avatar.not_a_file', { path: avatarPath }));

  for (const quality of [6, 12, 20]) {
    const jpeg = await encode(ffmpegPath, avatarPath, quality);
    if (!jpeg.length) throw new Error(t('avatar.no_image'));
    const dataUrl = `data:image/jpeg;base64,${jpeg.toString('base64')}`;
    if (dataUrl.length <= MAX_AVATAR_LENGTH) return dataUrl;
  }

  throw new Error(t('avatar.too_large'));
}
