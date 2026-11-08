import { hkdfSync, pbkdf2Sync } from 'node:crypto';
import { t } from './i18n/index.js';

const ERROR_KEYS = {
  access_required: 'lala.errors.access_required',
  wrong_password: 'lala.errors.wrong_password',
  password_required: 'lala.errors.password_required',
  room_not_found: 'lala.errors.room_not_found',
  room_full: 'lala.errors.room_full',
  banned: 'lala.errors.banned',
  not_allowed: 'lala.errors.not_allowed',
  server_unavailable: 'lala.errors.server_unavailable',
  server_error: 'lala.errors.server_error',
};

export class LalaError extends Error {
  constructor(message, code, status) {
    super(message);
    this.name = 'LalaError';
    this.code = code;
    this.status = status;
  }
}

function deriveRoomKeys(password, salt) {
  const master = pbkdf2Sync(password, salt, 200_000, 32, 'sha256');
  const authKey = Buffer.from(hkdfSync('sha256', master, Buffer.alloc(0), 'lala room auth', 32)).toString('base64');
  const e2eeKey = new Uint8Array(hkdfSync('sha256', master, Buffer.alloc(0), 'lala room e2ee', 32));
  return { authKey, e2eeKey };
}

export class LalaClient {
  constructor(config) {
    this.config = config;
    this.cookie = '';
  }

  async request(path, { method = 'GET', body } = {}) {
    const headers = { 'X-Lala-Device': this.config.deviceId };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (this.cookie) headers.Cookie = this.cookie;

    let response;
    try {
      response = await fetch(`${this.config.serverUrl}/api${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error) {
      throw new LalaError(t('lala.server_unavailable', { detail: error.message }), 'server_unavailable', 0);
    }

    const cookies = typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : [response.headers.get('set-cookie')].filter(Boolean);
    for (const cookie of cookies) {
      const match = /^lala_access=[^;]*/.exec(cookie);
      if (match) this.cookie = match[0];
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const code = data.error ?? 'server_error';
      const message = ERROR_KEYS[code]
        ? t(ERROR_KEYS[code])
        : t('lala.unknown_error', { message: t('lala.errors.server_error'), code });
      throw new LalaError(message, code, response.status);
    }

    return response.json().catch(() => ({}));
  }

  async login() {
    if (!this.config.serverPassword) return;
    try {
      await this.request('/access', { method: 'POST', body: { password: this.config.serverPassword } });
    } catch (error) {
      if (error.code === 'wrong_password') {
        throw new LalaError(t('lala.wrong_server_password'), error.code, error.status);
      }
      throw error;
    }
  }

  async findRoom(name) {
    const { rooms } = await this.request('/rooms');
    const list = Array.isArray(rooms) ? rooms : [];
    const match = list.find((room) => room.displayName === name)
      ?? list.find((room) => room.displayName?.toLowerCase() === name.toLowerCase());
    if (!match) {
      const available = list.map((room) => room.displayName).filter(Boolean).join(', ') || t('lala.no_rooms');
      throw new LalaError(t('lala.room_not_found', { name, available }), 'room_not_found', 404);
    }
    return match;
  }

  async getToken(room) {
    let keys;
    if (room.passwordSalt) {
      if (!this.config.channelPassword) {
        throw new LalaError(t('lala.channel_password_missing'), 'password_required', 401);
      }
      keys = deriveRoomKeys(this.config.channelPassword, room.passwordSalt);
    }

    let data;
    try {
      data = await this.request('/token', {
        method: 'POST',
        body: {
          room: room.id,
          name: this.config.botName,
          passwordKey: keys?.authKey,
        },
      });
    } catch (error) {
      if (error.code === 'wrong_password' || error.code === 'password_required') {
        throw new LalaError(t('lala.join_failed', { message: error.message }), error.code, error.status);
      }
      throw error;
    }

    return {
      token: data.token,
      url: data.url,
      identity: data.identity,
      e2eeKey: keys?.e2eeKey,
    };
  }
}
