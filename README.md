# Lala Music Bot

<div align="center">Idiomas / Languages</div>
<div align="center">
  <a href="#lala-music-bot">ES 🇪🇸</a>
  |
  <a href="README.en.md">EN 🇺🇸</a>
</div>

---

Bot de música para [Lala](https://github.com/eeegoloauq/lala). Se conecta a un canal de voz, reproduce audio mediante LiveKit y permite controlar la reproducción desde el chat.

https://github.com/user-attachments/assets/55b24a7c-d553-4de1-8da5-3fbb2e8d56f4

> [!IMPORTANT]  
> Este bot fue completamente desarrollado mediante Inteligencia Artificial (IA).

## Características

- Reproducción de enlaces y búsquedas mediante `yt-dlp`.
- Soporte para playlists y cola de reproducción.
- Comandos desde el chat de Lala o la consola.
- Conexión automática cuando hay participantes y desconexión tras 30 segundos de inactividad.
- Soporte para servidores y canales protegidos con contraseña, incluido E2EE.
- Mensajes en español e inglés.
- Estadísticas persistentes de canciones encoladas y tiempo en llamada.
- Foto de perfil opcional.
- Reconexión ante errores temporales.
- Despliegue local o mediante Docker.

## Requisitos

### Ejecución local

- Node.js 20 o superior (recomendado: Node.js 22).
- `ffmpeg` disponible en el `PATH` o configurado mediante `FFMPEG_PATH`.
- Python 3.11 o superior en Linux/macOS.
- Acceso de red al servidor Lala y a LiveKit.
- Acceso a GitHub durante la instalación de dependencias para descargar `yt-dlp`.

En Windows, `youtube-dl-exec` utiliza `yt-dlp.exe`, que incluye Python.

### Docker

- Docker Engine y Docker Compose.
- Acceso a npm y GitHub durante la construcción de la imagen.

## Instalación local

Desde el directorio del proyecto:

```bash
npm install
```

Crear el archivo `.env`:

```bash
cp .env.example .env
```

En PowerShell:

```powershell
Copy-Item .env.example .env
```

Completar la configuración y ejecutar:

```bash
npm start
```

Para detener el proceso, usar `Ctrl+C`.

## Configuración

La configuración se define en `music-bot/.env`. Los cambios requieren reiniciar el bot.

| Variable | Obligatoria | Predeterminado | Descripción |
| --- | --- | --- | --- |
| `SERVER_URL` | Sí | — | URL base de Lala, con protocolo y sin `/api`. Ejemplo: `https://lala.example.com`. |
| `CHANNEL_NAME` | Sí | — | Nombre del canal de voz al que debe conectarse. |
| `SERVER_PASSWORD` | No | Vacío | Contraseña del servidor Lala, si corresponde. |
| `CHANNEL_PASSWORD` | No | Vacío | Contraseña del canal. Necesaria si el canal está protegido; también se utiliza para derivar las claves E2EE. |
| `BOT_NAME` | No | `Lala Music Bot` | Nombre visible del bot. |
| `LANGUAGE` | No | `es` | Idioma de los mensajes: `es` o `en`. Los valores que comienzan con `en` seleccionan inglés; los demás seleccionan español. |
| `COMMAND_PREFIX` | No | `!` | Prefijo de los comandos. |
| `FFMPEG_PATH` | No | `ffmpeg` | Comando o ruta del ejecutable de FFmpeg. |
| `AVATAR_PATH` | No | Vacío | Nombre del archivo de imagen dentro de `avatar/`. Ejemplo: `avatar.jpg`. |
| `STATE_DIR` | No | Directorio del proyecto | Directorio para `.device-id` y `stats.json`. En Docker se establece en `/data`. |

Ejemplo:

```env
SERVER_URL=https://lala.example.com
SERVER_PASSWORD=
CHANNEL_NAME=General
BOT_NAME=Lala Music Bot
LANGUAGE=es
COMMAND_PREFIX=!
CHANNEL_PASSWORD=
FFMPEG_PATH=ffmpeg
AVATAR_PATH=avatar.jpg
STATE_DIR=
```

`SERVER_PASSWORD` y `CHANNEL_PASSWORD` pueden quedar vacías si no se utilizan. `SERVER_URL` puede terminar en `/`; el bot lo elimina automáticamente. Si `STATE_DIR` no está definido, los archivos de estado se guardan en el directorio del proyecto.

El archivo `.device-id` identifica al bot ante Lala. Debe conservarse entre reinicios y, especialmente, en despliegues Docker. `stats.json` se actualiza al encolar canciones y al finalizar una conexión.

## Comandos

Los comandos están disponibles en el chat del canal y en la consola. En el chat se debe incluir el prefijo configurado; en la consola es opcional.

| Comando | Alias | Descripción |
| --- | --- | --- |
| `!play <enlace o búsqueda>` | `!p` | Agrega una canción o playlist a la cola. Las búsquedas de texto utilizan el primer resultado de `yt-dlp`. |
| `!skip` | `!s` | Salta la canción actual o cancela su descarga. |
| `!clear` | `!c` | Vacía la cola pendiente sin detener la canción actual. |
| `!stats` | — | Muestra el tiempo encendido, las canciones encoladas y el tiempo acumulado en llamada. |
| `!help` | — | Muestra los comandos disponibles. |

Ejemplos:

```text
!play https://www.youtube.com/watch?v=jNQXAC9IVRw
!play never gonna give you up
!skip
!clear
!stats
!help
```

Los comandos no distinguen mayúsculas de minúsculas. Cualquier participante puede ejecutarlos; actualmente no hay permisos por rol. Los mensajes que no comienzan con el prefijo configurado se ignoran.

Las respuestas se envían al chat y también se muestran en la consola. Ante un error de reproducción, el chat recibe un mensaje genérico y el detalle queda registrado en la consola.

## Traducciones

Los textos están centralizados en `src/i18n/`. Los idiomas disponibles son español (`es.js`) e inglés (`en.js`). Se seleccionan mediante `LANGUAGE`.

Los mensajes dinámicos utilizan placeholders, por ejemplo `{song_count}`. Para agregar otro idioma, crear un diccionario con las mismas claves y registrarlo en `src/i18n/index.js`.

## Estadísticas

El comando `stats` muestra:

- Tiempo encendido del proceso.
- Cantidad de canciones agregadas a la cola.
- Tiempo acumulado en llamadas.

Los datos persistentes se almacenan en `stats.json`, dentro de `STATE_DIR`:

```json
{
  "songsPlayed": 42,
  "callTimeMs": 11707000
}
```

`songsPlayed` cuenta las canciones encoladas, incluso si su descarga o reproducción falla. El tiempo encendido se calcula desde el último inicio del proceso y no se conserva entre reinicios. El tiempo de la llamada activa se incluye en la consulta y se guarda al desconectarse.

Si el archivo no existe o no puede leerse, las estadísticas comienzan en cero. Los errores de escritura se registran en la consola y no detienen el bot.

## Foto de perfil

Para configurar una imagen, colocarla en `avatar/` y definir su nombre en `.env`:

```text
music-bot/
└── avatar/
    └── avatar.jpg
```

```env
AVATAR_PATH=avatar.jpg
```

El bot procesa la imagen al iniciar: la recorta y escala a 128 × 128, la convierte a JPEG y la publica como atributo `lala.avatar`. El tamaño final debe respetar el límite de 32 KB de Lala. Se aceptan los formatos que FFmpeg pueda decodificar.

La imagen se carga al iniciar; para aplicar cambios hay que reiniciar el bot. Si no puede procesarse, el bot continúa sin foto de perfil. La visualización depende de que el cliente de Lala admita el atributo `lala.avatar`.

## Docker

Crear y completar `music-bot/.env`. Desde el directorio del proyecto, construir e iniciar el servicio:

```bash
docker compose up -d --build
```

Consultar los registros:

```bash
docker compose logs -f music-bot
```

Detener el servicio:

```bash
docker compose down
```

La configuración de Compose utiliza el volumen `music_bot_data` en `/data` para conservar `.device-id` y `stats.json`. También monta `./avatar` en `/app/avatar` como solo lectura. El contenedor se ejecuta como usuario no root, tiene un límite de memoria de 1 GB y utiliza `restart: unless-stopped`.

Para eliminar también los datos persistentes:

```bash
docker compose down -v
```

> **Importante:** eliminar el volumen genera una identidad nueva para el bot y reinicia las estadísticas.

### Conectividad desde Docker

Dentro del contenedor, `localhost` apunta al propio contenedor. Si Lala se ejecuta en el host, utilizar la URL pública o, en Docker Desktop, una dirección como:

```env
SERVER_URL=http://host.docker.internal:3001
```

El bot necesita acceso de salida a la API de Lala y a LiveKit. Los puertos dependen de la configuración del servidor; una configuración habitual puede utilizar TCP 7880/7881 y UDP 50000/3478.

## Estructura del proyecto

```text
music-bot/
├── src/
│   ├── index.js        # Inicio, conexión y reconexión
│   ├── config.js       # Configuración y estado del dispositivo
│   ├── lala.js         # API de Lala y autenticación
│   ├── player.js       # Cola y reproducción de audio
│   ├── ytdlp.js        # Resolución y descarga de audio
│   ├── commands.js     # Procesamiento de comandos
│   ├── stats.js        # Estadísticas persistentes
│   ├── avatar.js       # Procesamiento de la imagen de perfil
│   └── i18n/           # Traducciones
│       ├── index.js
│       ├── es.js
│       └── en.js
├── avatar/             # Imágenes de perfil
├── .env.example        # Plantilla de configuración
├── Dockerfile
├── docker-compose.yml
├── package.json
├── package-lock.json
├── README.md
└── README.en.md
```

Archivos generados durante la ejecución:

- `.device-id`: identidad persistente del dispositivo.
- `stats.json`: estadísticas de reproducción y llamadas.
- Archivos temporales de audio: se eliminan al finalizar o cancelar la reproducción.

## Funcionamiento

### Conexión

Al iniciar, el bot carga la configuración, recupera o genera `.device-id` y carga las estadísticas. Si el servidor requiere contraseña, se autentica mediante `POST /api/access`. Luego consulta `GET /api/rooms` para localizar `CHANNEL_NAME` y solicita un token de LiveKit mediante `POST /api/token`.

Las peticiones incluyen el identificador del dispositivo en `X-Lala-Device`.

### Canales protegidos

Cuando el canal tiene contraseña, el bot deriva las claves de autenticación y E2EE a partir de `CHANNEL_PASSWORD`, utilizando PBKDF2-SHA256 y HKDF. La clave de autenticación se envía al solicitar el token y la clave E2EE se utiliza en la conexión de LiveKit.

### Espera y desconexión

El bot comprueba el canal cada cinco segundos. Si el canal no existe, no responde o está vacío, continúa esperando. Se conecta cuando encuentra al menos un participante distinto del propio bot.

Si el canal queda vacío, espera 30 segundos antes de desconectarse. Si alguien entra durante ese intervalo, cancela la desconexión. Después vuelve al ciclo de espera.

### Reproducción

`yt-dlp` resuelve enlaces y búsquedas, y descarga el audio. FFmpeg lo convierte a PCM mono, 48 kHz y 16 bits. El bot envía el audio a LiveKit en frames de 20 ms.

Al finalizar, fallar o cancelar una canción, se elimina el archivo temporal y se procesa el siguiente elemento de la cola.

### Cierre

Ante `SIGINT` o `SIGTERM`, el bot deja de aceptar comandos, detiene la reproducción, guarda las estadísticas, desconecta LiveKit y libera los recursos de audio.

## Errores y reconexión

**Errores que requieren corregir la configuración o intervención:**

- `password_required`: falta `CHANNEL_PASSWORD`.
- `wrong_password`: la contraseña del servidor o del canal es incorrecta.
- `not_allowed`: el bot no tiene permiso para entrar.
- `banned`: el bot está bloqueado.
- `PARTICIPANT_REMOVED`: el bot fue expulsado.
- `DUPLICATE_IDENTITY`: otra instancia utiliza la misma identidad.

**Errores temporales:**

Los problemas de disponibilidad del servidor, canales inexistentes o llenos y fallos de conexión no fatales se reintentan sin finalizar el proceso.

**Errores de reproducción:**

Si falla la resolución, descarga o conversión del audio, el bot informa un error genérico en el chat, registra el detalle en la consola, descarta la canción y continúa con la cola.

Los errores de avatar o de persistencia de estadísticas se registran en la consola, pero no detienen el servicio.

## Limitaciones

- Cada instancia administra un único canal (`CHANNEL_NAME`).
- No se puede compartir el mismo `.device-id` entre instancias activas.
- La cola se almacena en memoria y se pierde al reiniciar.
- No hay controles de pausa, reanudación, volumen ni búsqueda dentro de una canción.
- `clear` no detiene la canción en reproducción.
- Cualquier participante puede ejecutar comandos.
- `songsPlayed` cuenta canciones encoladas, no reproducciones completadas.
- La persistencia depende de que `STATE_DIR` sea escribible y, en Docker, de conservar el volumen.
- Los cambios de configuración y de foto de perfil requieren reiniciar el bot.
- La reproducción de YouTube depende de `yt-dlp` y puede requerir actualizar dependencias si el servicio cambia.

## Solución de problemas

| Problema | Qué revisar |
| --- | --- |
| Falta `SERVER_URL` | Crear `.env` a partir de `.env.example` y completar las variables obligatorias. |
| El bot no encuentra el canal | Verificar `CHANNEL_NAME` y que el canal exista en Lala. |
| El canal requiere contraseña | Configurar `CHANNEL_PASSWORD`. |
| Error de contraseña del servidor | Verificar `SERVER_PASSWORD` o dejarla vacía si el servidor no la requiere. |
| No se puede ejecutar FFmpeg | Instalar FFmpeg o configurar `FFMPEG_PATH`. |
| Falta Python en Linux/macOS | Instalar Python 3.11 o superior. |
| Falla la descarga de `yt-dlp` | Comprobar el acceso a GitHub y volver a ejecutar `npm install` o reconstruir la imagen. |
| No aparece el avatar | Revisar `AVATAR_PATH`, la ubicación del archivo y que el cliente admita `lala.avatar`; reiniciar el bot tras cambiar la imagen. |
| Las estadísticas no se guardan | Verificar permisos de escritura en `STATE_DIR` y, en Docker, el volumen `music_bot_data`. |
| Los comandos no responden | Comprobar el prefijo y enviar el comando desde el chat del canal. |
| Identidad duplicada | Detener la otra instancia o asignar un volumen de estado independiente. |
| El bot fue expulsado | Revisar los permisos y las restricciones del canal o servidor. |
| `localhost` no conecta desde Docker | Usar la dirección del host o la URL accesible desde el contenedor. |

## Seguridad

- El contenedor se ejecuta como usuario no root y aplica `no-new-privileges`.
- El volumen de estado contiene la identidad del dispositivo y debe conservarse de forma privada.
- No publicar `.env`, `.device-id` ni `stats.json` en repositorios públicos.
- Las contraseñas deben mantenerse fuera del control de versiones.
