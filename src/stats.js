import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

function toNumber(value) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

export function formatDuration(ms) {
  let total = Math.floor(ms / 1000);
  const units = [
    ['Año', 'Años', 365 * 24 * 60 * 60],
    ['Mes', 'Meses', 30 * 24 * 60 * 60],
    ['Semana', 'Semanas', 7 * 24 * 60 * 60],
    ['Día', 'Días', 24 * 60 * 60],
    ['Hora', 'Horas', 60 * 60],
    ['Minuto', 'Minutos', 60],
    ['Segundo', 'Segundos', 1],
  ];

  const parts = [];
  for (const [singular, plural, seconds] of units) {
    const value = Math.floor(total / seconds);
    if (!value) continue;
    total -= value * seconds;
    parts.push(`${value} ${value === 1 ? singular : plural}`);
  }

  if (!parts.length) return '0 Segundos';
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} y ${parts.at(-1)}`;
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

  async recordSong() {
    this.songsPlayed += 1;
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
