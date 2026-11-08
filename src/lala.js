import { hkdfSync, pbkdf2Sync } from 'node:crypto';

const MESSAGES = {
  access_required: 'El servidor requiere SERVER_PASSWORD',
  wrong_password: 'Contraseña incorrecta',
  password_required: 'El canal requiere CHANNEL_PASSWORD',
  room_not_found: 'Canal no encontrado',
  room_full: 'El canal está lleno',
  banned: 'El bot está bloqueado en el servidor o en el canal',
  not_allowed: 'El bot no tiene permiso para entrar al canal',
  server_unavailable: 'No se pudo conectar con el servidor',
  server_error: 'Error interno del servidor',
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
      throw new LalaError(`${MESSAGES.server_unavailable}: ${error.message}`, 'server_unavailable', 0);
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
      throw new LalaError(MESSAGES[code] ?? `${MESSAGES.server_error} (${code})`, code, response.status);
    }

    return response.json().catch(() => ({}));
  }

  async login() {
    if (!this.config.serverPassword) return;
    try {
      await this.request('/access', { method: 'POST', body: { password: this.config.serverPassword } });
    } catch (error) {
      if (error.code === 'wrong_password') {
        throw new LalaError('SERVER_PASSWORD incorrecta', error.code, error.status);
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
      const available = list.map((room) => room.displayName).filter(Boolean).join(', ') || 'ninguno';
      throw new LalaError(`Canal "${name}" no encontrado. Canales disponibles: ${available}`, 'room_not_found', 404);
    }
    return match;
  }

  async getToken(room) {
    let keys;
    if (room.passwordSalt) {
      if (!this.config.channelPassword) {
        throw new LalaError('El canal tiene contraseña: define CHANNEL_PASSWORD en .env', 'password_required', 401);
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
        throw new LalaError(`No se pudo entrar al canal: ${error.message}`, error.code, error.status);
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
