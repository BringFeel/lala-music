import { spawn } from 'node:child_process';
import { AudioFrame } from '@livekit/rtc-node';
import { download, removeDownload } from './ytdlp.js';

const SAMPLE_RATE = 48000;
const CHANNELS = 1;
const FRAME_SAMPLES = 960;
const FRAME_BYTES = FRAME_SAMPLES * 2;
const FRAME_MS = (FRAME_SAMPLES / SAMPLE_RATE) * 1000;

export class MusicPlayer {
  constructor({ source, say, ffmpegPath = 'ffmpeg', onError }) {
    this.source = source;
    this.say = say;
    this.ffmpegPath = ffmpegPath;
    this.onError = onError ?? ((error) => console.error(error));
    this.queue = [];
    this.current = null;
    this.running = false;
  }

  enqueue(input, requestedBy) {
    return this.enqueueAll([{ input, title: null }], requestedBy);
  }

  enqueueAll(tracks, requestedBy) {
    const position = this.queue.length + (this.current ? 1 : 0);
    const items = tracks.map((track) => ({
      input: track.input,
      requestedBy,
      controller: new AbortController(),
      aborted: false,
      proc: null,
      dir: null,
    }));
    if (items.length === 0) return position;

    this.queue.push(...items);
    void this.run().catch((error) => {
      this.onError(error, 'Error en el reproductor');
    });
    return position + items.length;
  }

  skip() {
    const item = this.current;
    if (!item) return false;
    item.aborted = true;
    item.controller.abort();
    item.proc?.kill('SIGKILL');
    return true;
  }

  clear() {
    const count = this.queue.length;
    this.queue.length = 0;
    return count;
  }

  async stop() {
    this.queue.length = 0;
    const item = this.current;
    if (item) {
      item.aborted = true;
      item.controller.abort();
      item.proc?.kill('SIGKILL');
    }
  }

  async run() {
    if (this.running) return;
    this.running = true;
    try {
      while (this.queue.length > 0) {
        const item = this.queue.shift();
        this.current = item;
        try {
          const { title, file, dir } = await download(item.input, item.controller.signal);
          item.dir = dir;
          if (item.aborted) continue;
          this.say(`Reproduciendo: ${title}`);
          await this.play(file, item);
        } catch (error) {
          if (!item.aborted) this.onError(error, `Error al reproducir "${item.input}"`);
        } finally {
          this.current = null;
          await removeDownload(item.dir).catch(() => {});
        }
      }
    } finally {
      this.running = false;
    }
  }

  async play(file, item) {
    const args = [
      '-nostdin',
      '-hide_banner',
      '-loglevel', 'error',
      '-i', file,
      '-vn',
      '-acodec', 'pcm_s16le',
      '-ac', String(CHANNELS),
      '-ar', String(SAMPLE_RATE),
      '-f', 's16le',
      'pipe:1',
    ];
    const proc = spawn(this.ffmpegPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      signal: item.controller.signal,
    });
    item.proc = proc;

    let stderr = '';
    let spawnError;
    proc.stderr.on('data', (chunk) => {
      stderr += chunk;
      if (stderr.length > 4000) stderr = stderr.slice(-4000);
    });
    proc.on('error', (error) => {
      spawnError = error;
    });
    const closed = new Promise((resolve) => proc.once('close', resolve));

    const started = performance.now();
    let frames = 0;
    let pending = Buffer.alloc(0);

    try {
      for await (const chunk of proc.stdout) {
        if (item.aborted) break;
        pending = pending.length ? Buffer.concat([pending, chunk]) : chunk;
        while (pending.length >= FRAME_BYTES) {
          const data = new Int16Array(FRAME_SAMPLES);
          for (let i = 0; i < FRAME_SAMPLES; i += 1) data[i] = pending.readInt16LE(i * 2);
          pending = pending.subarray(FRAME_BYTES);

          await this.source.captureFrame(new AudioFrame(data, SAMPLE_RATE, CHANNELS, FRAME_SAMPLES));
          frames += 1;

          const wait = started + frames * FRAME_MS - performance.now();
          if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
          if (item.aborted) break;
        }
      }
    } catch (error) {
      if (!item.aborted) throw error;
    } finally {
      if (proc.exitCode === null && !proc.killed) proc.kill('SIGKILL');
      await closed;
    }

    if (item.aborted) return;
    if (spawnError) {
      throw new Error(`No se pudo ejecutar ffmpeg (${this.ffmpegPath}): ${spawnError.message}`);
    }
    if (proc.exitCode !== 0 && proc.exitCode !== null) {
      const detail = stderr.trim().split(/\r?\n/).at(-1);
      throw new Error(`ffmpeg falló${detail ? `: ${detail}` : ''}`);
    }
  }
}
