import { spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';

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
      reject(new Error(`No se pudo ejecutar ffmpeg (${ffmpegPath}): ${error.message}`));
    });
    proc.on('close', (code) => {
      if (code !== 0) {
        const detail = stderr.trim().split(/\r?\n/).filter(Boolean).at(-1);
        reject(new Error(`ffmpeg falló${detail ? `: ${detail}` : ''}`));
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
    throw new Error(`No se pudo leer AVATAR_PATH (${avatarPath}): ${error.message}`);
  }
  if (!info.isFile()) throw new Error(`AVATAR_PATH no es un archivo: ${avatarPath}`);

  for (const quality of [6, 12, 20]) {
    const jpeg = await encode(ffmpegPath, avatarPath, quality);
    if (!jpeg.length) throw new Error('ffmpeg no devolvió una imagen');
    const dataUrl = `data:image/jpeg;base64,${jpeg.toString('base64')}`;
    if (dataUrl.length <= MAX_AVATAR_LENGTH) return dataUrl;
  }

  throw new Error('La foto de perfil supera el tamaño máximo permitido por Lala');
}
