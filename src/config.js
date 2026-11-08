import dotenv from 'dotenv';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setLanguage, t } from './i18n/index.js';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: join(rootDir, '.env'), quiet: true });
const language = setLanguage(process.env.LANGUAGE);

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(t('config.missing_var', { name }));
  return value;
}

function optional(name) {
  return process.env[name]?.trim() || undefined;
}

const stateDir = optional('STATE_DIR') ?? rootDir;
const avatarPath = optional('AVATAR_PATH');

function loadDeviceId() {
  const file = join(stateDir, '.device-id');
  try {
    const saved = readFileSync(file, 'utf8').trim();
    if (saved) return saved;
  } catch {}
  const id = randomUUID();
  try {
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(file, id);
  } catch {}
  return id;
}

export const config = {
  language,
  serverUrl: required('SERVER_URL').replace(/\/+$/, ''),
  serverPassword: optional('SERVER_PASSWORD'),
  channelName: required('CHANNEL_NAME'),
  channelPassword: optional('CHANNEL_PASSWORD'),
  botName: optional('BOT_NAME') ?? 'Lala Music Bot',
  commandPrefix: optional('COMMAND_PREFIX') ?? '!',
  ffmpegPath: optional('FFMPEG_PATH') ?? 'ffmpeg',
  avatarPath: avatarPath ? join(rootDir, 'avatar', basename(avatarPath)) : undefined,
  statsPath: join(stateDir, 'stats.json'),
  deviceId: loadDeviceId(),
};
