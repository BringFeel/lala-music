import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { t, tPlural } from './i18n/index.js';

function toNumber(value) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

const DURATION_UNITS = [
  ['year', 365 * 24 * 60 * 60],
  ['month', 30 * 24 * 60 * 60],
  ['week', 7 * 24 * 60 * 60],
  ['day', 24 * 60 * 60],
  ['hour', 60 * 60],
  ['minute', 60],
  ['second', 1],
];

export function formatDuration(ms) {
  let total = Math.floor(ms / 1000);

  const parts = [];
  for (const [unit, seconds] of DURATION_UNITS) {
    const value = Math.floor(total / seconds);
    if (!value) continue;
    total -= value * seconds;
    parts.push(tPlural(`duration.${unit}`, value, { value }));
  }

  if (!parts.length) return t('duration.zero');
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(t('duration.separator'))}${t('duration.conjunction')}${parts.at(-1)}`;
}

export class Stats {
  constructor(file) {
    this.file = file;
    this.songsPlayed = 0;
    this.callTimeMs = 0;
    this.callStartedAt = null;
    this.pending = Promise.resolve();
  }

  static async create(file) {
    const stats = new Stats(file);
    try {
      const data = JSON.parse(await readFile(file, 'utf8'));
      stats.songsPlayed = toNumber(data.songsPlayed);
      stats.callTimeMs = toNumber(data.callTimeMs);
    } catch {}
    return stats;
  }

  snapshot() {
    const callTimeMs = this.callTimeMs + (this.callStartedAt !== null ? Date.now() - this.callStartedAt : 0);
    return {
      uptimeMs: process.uptime() * 1000,
      songsPlayed: this.songsPlayed,
      callTimeMs,
    };
  }

  beginCall() {
    if (this.callStartedAt !== null) return;
    this.callStartedAt = Date.now();
  }

  async endCall() {
    if (this.callStartedAt === null) return;
    this.callTimeMs += Date.now() - this.callStartedAt;
    this.callStartedAt = null;
    await this.save();
  }

  async recordSong(count = 1) {
    this.songsPlayed += count;
    await this.save();
  }

  save() {
    const data = JSON.stringify({
      songsPlayed: this.songsPlayed,
      callTimeMs: this.callTimeMs,
    }, null, 2);

    const next = this.pending.then(async () => {
      await mkdir(dirname(this.file), { recursive: true });
      await writeFile(this.file, data);
    });
    this.pending = next.catch(() => {});
    return next;
  }
}
