# Lala Music Bot

Bot de música para canales de voz de **Lala**. Se conecta como un participante externo usando la API de Lala y LiveKit, descarga audio con `yt-dlp`, lo decodifica con `ffmpeg` y lo publica en el canal como una pista de micrófono.

Puede ejecutarse localmente con Node.js o dentro de Docker. Está pensado para un solo canal por instancia.

## Índice

- [Características](#características)
- [Requisitos](#requisitos)
- [Instalación local](#instalación-local)
- [Configuración](#configuración)
- [Comandos](#comandos)
- [Estadísticas](#estadísticas)
- [Foto de perfil](#foto-de-perfil)
- [Docker](#docker)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Funcionamiento interno](#funcionamiento-interno)
- [Errores y reconexión](#errores-y-reconexión)
- [Limitaciones](#limitaciones)
- [Solución de problemas](#solución-de-problemas)
- [Seguridad](#seguridad)

## Características

- Espera a que el canal exista y tenga al menos un usuario antes de conectarse.
- Se desconecta automáticamente después de 30 segundos solo en el canal.
- Vuelve a esperar usuarios y se reconecta cuando alguien entra de nuevo.
- Reproduce audio de YouTube y de cualquier sitio soportado por `yt-dlp`.
- Acepta enlaces directos o búsquedas por texto (`ytsearch1:`).
- Cola de reproducción en memoria con soporte para saltar y vaciar.
- Comandos por chat de Lala y por consola.
- Prefijo de comandos configurable mediante `COMMAND_PREFIX`.
- Comando `stats` con tiempo encendido, canciones reproducidas y tiempo en llamada.
- Estadísticas persistentes en `stats.json`.
- Soporte para servidores con contraseña de acceso.
- Soporte para canales con contraseña, incluyendo autenticación y cifrado E2EE.
- Foto de perfil opcional leída desde el directorio `avatar/` y publicada como atributo `lala.avatar`.
- Identidad de dispositivo persistente mediante `.device-id`.
- Reconexión automática ante errores temporales.
- Imagen Docker con `ffmpeg` y Python para `yt-dlp`.
- Volumen persistente para conservar la identidad del bot y las estadísticas en Docker.

## Requisitos

### Local

- Node.js 20 o superior. Se recomienda Node.js 22.
- `ffmpeg` disponible en el `PATH`, o configurar `FFMPEG_PATH`.
- Python 3.11 o superior en Linux/macOS, necesario para el binario `yt-dlp` que descarga `youtube-dl-exec`.
- Acceso de red al servidor Lala y a LiveKit.
- Acceso a GitHub durante `npm install` para descargar el binario de `yt-dlp`.

En Windows, `youtube-dl-exec` descarga `yt-dlp.exe`, que incluye Python, por lo que normalmente no hace falta instalarlo.

### Docker

- Docker Engine y Docker Compose.
- Acceso a npm y GitHub durante la construcción de la imagen.
- Un archivo `.env` en el directorio `music-bot`.

## Instalación local

```bash
cd music-bot
npm install
```

Crear el archivo de configuración:

```powershell
Copy-Item .env.example .env
```

En Linux/macOS:

```bash
cp .env.example .env
```

Editar `.env` con los datos del servidor y del canal.

Iniciar el bot:

```bash
npm start
```

Para detenerlo, usar `Ctrl+C`. El bot cierra la conexión y limpia los recursos.

## Configuración

Toda la configuración se carga desde `music-bot/.env` mediante `dotenv`. Los cambios requieren reiniciar el bot.

| Variable | Obligatoria | Valor por defecto | Descripción |
| --- | --- | --- | --- |
| `SERVER_URL` | Sí | — | URL base del servidor Lala. Debe incluir el protocolo y no debe incluir `/api`; el cliente lo agrega. Ejemplo: `https://lala.example.com`. |
| `SERVER_PASSWORD` | No | Vacío | Contraseña de acceso al servidor Lala, si está habilitada. |
| `CHANNEL_NAME` | Sí | — | Nombre visible del canal de voz. Se busca primero de forma exacta y luego sin distinguir mayúsculas/minúsculas. |
| `BOT_NAME` | No | `Lala Music Bot` | Nombre con el que el bot aparece en el canal. |
| `COMMAND_PREFIX` | No | `!` | Prefijo que deben usar los comandos. Por ejemplo, `?` hace que los comandos sean `?play`, `?skip`, etc. |
| `CHANNEL_PASSWORD` | No | Vacío | Contraseña del canal. Es obligatoria si el canal tiene contraseña. También se usa para derivar la clave E2EE. |
| `FFMPEG_PATH` | No | `ffmpeg` | Comando o ruta absoluta del ejecutable de `ffmpeg`. |
| `AVATAR_PATH` | No | Vacío | Nombre y extensión de la imagen dentro del directorio `avatar/`. Ejemplo: `avatar.jpg` busca `avatar/avatar.jpg`. |
| `STATE_DIR` | No | Directorio de `music-bot` | Directorio donde se guardan `.device-id` y `stats.json`. En Docker se usa `/data`. |

Ejemplo de `.env`:

```env
SERVER_URL=https://lala.example.com
SERVER_PASSWORD=
CHANNEL_NAME=General
BOT_NAME=Lala Music Bot
COMMAND_PREFIX=!
CHANNEL_PASSWORD=
FFMPEG_PATH=ffmpeg
AVATAR_PATH=avatar.jpg
STATE_DIR=
```

Notas:

- `SERVER_PASSWORD` y `CHANNEL_PASSWORD` pueden quedar vacías si no se usan.
- `SERVER_URL` puede terminar con `/`; el bot lo elimina.
- Si `STATE_DIR` no se define, `.device-id` y `stats.json` se guardan junto a `package.json`.
- El `.device-id` identifica al bot ante Lala. Conviene conservarlo entre reinicios, especialmente en Docker.
- `AVATAR_PATH` contiene sólo el nombre y la extensión del archivo. La imagen debe estar dentro de `music-bot/avatar/`.
- Si `AVATAR_PATH` está definido pero la imagen no se puede leer o procesar, el bot registra el error y continúa sin foto.
- `stats.json` se crea o actualiza automáticamente cuando se agrega una canción y cuando el bot se desconecta.

## Comandos

Los comandos se pueden enviar por el chat del canal o por la consola.

El prefijo se configura con `COMMAND_PREFIX` y por defecto es `!`. Los ejemplos usan `!`; si se cambia el prefijo, hay que reemplazar el `!` por el nuevo valor.

En el chat, el mensaje debe comenzar con el prefijo configurado. En la consola, el prefijo es opcional: el bot lo agrega automáticamente.

| Comando | Alias | Descripción |
| --- | --- | --- |
| `!play <enlace o búsqueda>` | `!p` | Agrega una canción a la cola. Si el argumento es una URL HTTP/HTTPS, se usa directamente. Si es texto, se busca con `ytsearch1:` y se usa el primer resultado. |
| `!skip` | `!s` | Salta la canción actual. Si se está descargando, cancela la descarga; si se está reproduciendo, detiene `ffmpeg`. |
| `!clear` | `!c` | Vacía la cola de canciones pendientes. No detiene la canción que se está reproduciendo. |
| `!stats` | — | Muestra el nombre del bot, tiempo encendido, canciones reproducidas y tiempo acumulado en llamada. |
| `!help` | — | Lista todos los comandos disponibles con el prefijo configurado. |

Ejemplos:

```text
!play https://www.youtube.com/watch?v=jNQXAC9IVRw
!play never gonna give you up
!skip
!clear
!stats
!help
```

Comportamiento:

- Los nombres de comandos no distinguen mayúsculas/minúsculas.
- Un mensaje que no comienza con `COMMAND_PREFIX` se ignora en el chat.
- Cualquier participante del canal puede usar los comandos; no hay sistema de permisos por rol.
- Las respuestas del bot se envían al chat del canal y también se muestran en la consola.
- Un comando desconocido responde con una sugerencia para usar el comando de ayuda con el prefijo configurado.
- La consola sólo está disponible mientras el proceso tiene una entrada estándar interactiva; en Docker lo normal es usar el chat.

## Estadísticas

El comando `stats` devuelve un texto con el siguiente formato:

```text
Nombre: Lala Music Bot
Tiempo Encendido: 1 Año, 2 Meses, 3 Semanas, 3 Días, 2 Horas, 4 Minutos y 20 Segundos
Canciones Reproducidas: 42
Tiempo en Llamada: 3 Horas, 15 Minutos y 7 Segundos

Desarrollado por BringFeel ❤️
```

Los datos se guardan en `stats.json` dentro de `STATE_DIR`. En Docker, el archivo queda en `/data/stats.json` gracias al volumen persistente.

El archivo tiene este formato:

```json
{
  "songsPlayed": 42,
  "callTimeMs": 11707000
}
```

Funcionamiento:

- `songsPlayed` se incrementa cada vez que se agrega una canción a la cola, aunque luego la descarga o la reproducción fallen.
- `callTimeMs` acumula el tiempo de todas las llamadas. Se actualiza al desconectarse y también incluye el tiempo de la llamada actual mientras el bot está conectado.
- `Tiempo Encendido` se calcula desde que arrancó el proceso, por lo que se reinicia con el bot.
- La duración se muestra con años, meses, semanas, días, horas, minutos y segundos. Los valores en cero se omiten.
- Si `stats.json` no existe o está corrupto, el bot comienza desde cero.
- Si no se puede escribir el archivo, el error se registra en la consola y el bot sigue funcionando.

## Foto de perfil

Colocar la imagen dentro del directorio `avatar/` de `music-bot`, por ejemplo:

```text
music-bot\avatar\avatar.jpg
```

Configurar sólo el nombre y la extensión en `.env`:

```env
AVATAR_PATH=avatar.jpg
```

`AVATAR_PATH` no debe incluir la carpeta `avatar/` ni una ruta absoluta. El bot siempre busca el archivo dentro de `music-bot/avatar/`.

El bot procesa la imagen al iniciar:

1. La lee desde `music-bot/avatar/<AVATAR_PATH>`.
2. La recorta en el centro y la escala a 128×128.
3. La convierte a JPEG con `ffmpeg`.
4. Genera un data URL `data:image/jpeg;base64,...`.
5. Verifica que no supere el límite de 32 KB que usa Lala.
6. La publica como atributo `lala.avatar` al conectarse al canal.

Detalles:

- Se aceptan los formatos que `ffmpeg` pueda decodificar (JPEG, PNG, WebP, etc.).
- Si la primera codificación supera el límite, se reintenta con menor calidad.
- La foto se carga una sola vez al iniciar. Si se cambia el archivo, hay que reiniciar el bot.
- La foto no se guarda en el servidor Lala: se envía como atributo del participante en cada conexión.
- Los clientes de Lala que lean el atributo `lala.avatar` mostrarán la imagen; si no lo hacen, verán el avatar generado con las iniciales.
- Si la imagen falla, el bot sigue funcionando sin foto.

## Docker

Crear o editar `music-bot/.env` y luego construir e iniciar:

```bash
cd music-bot
docker compose up -d --build
```

Ver logs:

```bash
docker compose logs -f music-bot
```

Detener:

```bash
docker compose down
```

La configuración de Compose:

- Construye la imagen desde el `Dockerfile` local.
- Usa `env_file: .env`.
- Fuerza `STATE_DIR=/data`.
- Monta el volumen nombrado `music_bot_data` en `/data`.
- Monta `./avatar` en `/app/avatar` como sólo lectura.
- Configura `restart: unless-stopped`.
- Usa `init: true` para el manejo de señales.
- Aplica `no-new-privileges`.
- Limita la memoria a 1 GB.
- Ejecuta el proceso como el usuario no root `node`.

### Persistencia

El volumen `music_bot_data` conserva `/data/.device-id` y `/data/stats.json`. Si se elimina el volumen, el bot genera una identidad nueva y las estadísticas vuelven a cero en el siguiente arranque.

Para borrar también el volumen:

```bash
docker compose down -v
```

### Foto de perfil con Docker

`docker-compose.yml` monta `./avatar` en `/app/avatar` como sólo lectura. Así, la misma carpeta que se usa en local está disponible en el contenedor sin reconstruir la imagen.

Para usar `AVATAR_PATH=avatar.jpg`:

1. Colocar `music-bot/avatar/avatar.jpg`.
2. Configurar `AVATAR_PATH=avatar.jpg` en `.env`.
3. Ejecutar `docker compose up -d --build` la primera vez, o `docker compose restart music-bot` si el contenedor ya existe.

El avatar se carga al iniciar, por lo que hay que reiniciar el contenedor después de agregar o cambiar la imagen. La imagen también se copia con `COPY . .` al construir, pero el montaje de `./avatar` es la vía recomendada para cambiarla sin reconstruir.

### Red en Docker

Si Lala corre en el mismo host y `SERVER_URL` usa `localhost`, dentro del contenedor `localhost` apunta al propio contenedor, no al host. En ese caso usar la URL pública de Lala o, en Docker Desktop, algo como:

```env
SERVER_URL=http://host.docker.internal:3001
```

El bot necesita salida de red hacia la API de Lala y hacia el servidor LiveKit. Según el despliegue, LiveKit puede usar TCP 7880/7881, UDP 50000 y UDP 3478.

## Estructura del proyecto

```text
music-bot/
├── src/
│   ├── index.js        Supervisor, conexión, reconexión y temporizador de soledad
│   ├── config.js       Carga y valida .env; resuelve rutas y persiste .device-id
│   ├── lala.js         Cliente de la API de Lala, token y claves de canal
│   ├── player.js       Cola, reproducción, ffmpeg y control de skip
│   ├── ytdlp.js        Descarga de audio con yt-dlp y limpieza de temporales
│   ├── commands.js     Parser, comandos, prefijo dinámico y ayuda
│   ├── stats.js        Estadísticas persistentes y formato de duración
│   └── avatar.js       Procesamiento de la foto de perfil
├── avatar/             Imágenes de perfil; `.gitkeep` mantiene la carpeta
├── .env.example        Plantilla de configuración
├── .dockerignore       Archivos excluidos del contexto de Docker
├── .gitignore          Archivos excluidos de Git
├── Dockerfile          Imagen de producción
├── docker-compose.yml  Servicio Docker con volumen persistente
├── package.json        Metadatos, dependencias y script de inicio
├── package-lock.json   Lockfile de dependencias
└── README.md           Esta documentación
```

Archivos generados en tiempo de ejecución:

- `.device-id`: UUID persistente del dispositivo. Está en `.gitignore`.
- `stats.json`: contador de canciones y tiempo acumulado en llamada. Está en `.gitignore`.
- `data/`: sólo si se configura `STATE_DIR` localmente en esa carpeta. Puede contener `.device-id` y `stats.json`; está en `.gitignore`.
- Archivos temporales de audio: se crean dentro del directorio temporal del sistema y se eliminan al terminar cada canción.

## Funcionamiento interno

### 1. Inicio y configuración

`src/config.js` carga `.env`, valida las variables obligatorias y resuelve rutas. Si no existe `.device-id`, genera un UUID y lo guarda en `STATE_DIR`. También resuelve `statsPath` dentro de `STATE_DIR`, el prefijo de comandos y la ruta de la imagen dentro de `avatar/`.

Después, `src/index.js`:

1. Crea el cliente de Lala.
2. Inicia sesión en el servidor si hay `SERVER_PASSWORD`.
3. Procesa la foto de perfil si hay `AVATAR_PATH`.
4. Carga o crea `stats.json` en `STATE_DIR`.
5. Entra en el bucle principal de espera/conexión.

### 2. Inicio de sesión en Lala

`src/lala.js` usa estos endpoints:

- `POST /api/access`: valida `SERVER_PASSWORD` y guarda la cookie `lala_access`.
- `GET /api/rooms`: obtiene la lista de canales y busca `CHANNEL_NAME`.
- `POST /api/token`: solicita un token de LiveKit para el canal.

Todas las peticiones incluyen el header `X-Lala-Device` con el valor de `.device-id`.

`POST /api/token` envía:

```json
{
  "room": "<id del canal>",
  "name": "<BOT_NAME>",
  "passwordKey": "<clave derivada, sólo si el canal tiene contraseña>"
}
```

La respuesta incluye el token de LiveKit, la URL de conexión y la identidad asignada al bot.

### 3. Contraseñas y E2EE

Si el canal tiene contraseña (`passwordSalt` en la información del canal), el bot deriva dos claves con `CHANNEL_PASSWORD`:

- `authKey`: PBKDF2-SHA256 con 200.000 iteraciones y HKDF con la etiqueta `lala room auth`. Se envía como `passwordKey`.
- `e2eeKey`: PBKDF2-SHA256 con 200.000 iteraciones y HKDF con la etiqueta `lala room e2ee`. Se usa para configurar el cifrado de extremo a extremo en LiveKit.

Esto replica el esquema que usa el cliente web de Lala para los canales protegidos.

### 4. Espera de usuarios

El bucle principal consulta el canal cada 5 segundos:

- Si el canal no existe, registra el estado y sigue esperando.
- Si el servidor no responde, registra el error y reintenta.
- Si el canal existe pero no tiene usuarios (excluyendo al propio bot), espera.
- Si hay al menos un usuario, intenta conectarse.

### 5. Conexión y reproducción

Al conectar:

1. Crea una sala de LiveKit con `autoSubscribe: false` y `dynacast: false`.
2. Si hay clave E2EE, la configura en las opciones de conexión.
3. Registra el inicio de la llamada en las estadísticas.
4. Publica el atributo `lala.avatar` si hay foto.
5. Crea un `AudioSource` de 48 kHz, mono.
6. Publica una pista de audio como micrófono.
7. Registra el manejador de mensajes de chat con topic `lk.chat`.

El reproductor:

- Acepta URLs o búsquedas.
- Descarga audio con el formato `bestaudio[abr<=64]/bestaudio[abr<=96]/bestaudio/best`.
- Guarda el archivo temporal y lo decodifica con `ffmpeg` a PCM signed 16-bit little-endian, 48 kHz, mono.
- Divide el audio en frames de 960 muestras, equivalentes a 20 ms.
- Envía cada frame a LiveKit manteniendo el ritmo de reproducción en tiempo real.
- Elimina el archivo temporal al terminar, fallar o saltar la canción.

### 6. Temporizador de soledad

Después de conectar, el bot comprueba el estado del canal al cabo de 1 segundo para cubrir el caso de haber entrado cuando ya no quedaba nadie.

- Si no hay otros participantes, inicia un temporizador de 30 segundos.
- Si alguien entra antes de que termine, cancela el temporizador.
- Si el temporizador termina y el canal sigue vacío, se desconecta y vuelve al bucle de espera.
- Si el bot es expulsado o hay otra instancia con la misma identidad, termina con error.

### 7. Chat y comandos

Los mensajes entrantes se leen mediante un `TextStreamHandler` de LiveKit suscripto al topic `lk.chat`.

- `src/commands.js` valida el prefijo configurado en `COMMAND_PREFIX`, separa el comando y el argumento, y ejecuta la acción.
- El comando `play` encola la canción e incrementa el contador `songsPlayed`.
- El comando `stats` usa `Stats.snapshot()` y responde con nombre, tiempo encendido, canciones y tiempo en llamada.
- El comando `help` lista todos los comandos con el prefijo activo.
- Las respuestas se envían con `localParticipant.sendText(text, { topic: 'lk.chat' })`.
- Los comandos de consola se normalizan agregando el prefijo si falta.

### 8. Estadísticas

`src/stats.js` carga `stats.json` al iniciar. Si no existe o no se puede leer, comienza con valores en cero.

- `recordSong()` incrementa `songsPlayed` y guarda el archivo.
- `beginCall()` marca el inicio de una llamada.
- `endCall()` suma el tiempo transcurrido a `callTimeMs` y guarda el archivo.
- `snapshot()` calcula el tiempo encendido con `process.uptime()` y suma el tiempo de la llamada activa al tiempo acumulado.
- Las escrituras se serializan para evitar que dos guardados simultáneos dejen el archivo incompleto.
- El tiempo se formatea con años, meses, semanas, días, horas, minutos y segundos, omitiendo las unidades en cero.

### 9. Cierre

Con `SIGINT` o `SIGTERM`, el bot:

1. Deja de aceptar comandos.
2. Detiene la descarga/reproducción actual.
3. Registra el fin de la llamada y guarda `stats.json`.
4. Desconecta la sala.
5. Cierra el `AudioSource`.
6. Termina el proceso.

## Errores y reconexión

### Errores fatales

El proceso termina y, si corre en Docker, se reinicia según `restart: unless-stopped`:

- `password_required`: el canal requiere contraseña y no se configuró `CHANNEL_PASSWORD`.
- `wrong_password`: contraseña de servidor o canal incorrecta.
- `not_allowed`: el bot no tiene permiso para entrar.
- `banned`: el bot está bloqueado.
- `PARTICIPANT_REMOVED`: el bot fue expulsado del canal.
- `DUPLICATE_IDENTITY`: hay otra instancia conectada con la misma identidad.

### Errores temporales

Se reintentan sin terminar el proceso:

- Canal inexistente.
- Servidor no disponible.
- Errores internos del servidor.
- Fallos de conexión que no sean fatales.
- Canal lleno.

### Errores de reproducción

Si falla `yt-dlp`, `ffmpeg` o la descarga:

- Se envía un mensaje de error al chat.
- La canción actual se descarta.
- El bot continúa con la siguiente canción de la cola.

### Avatar

Si la foto no se puede leer, procesar o publicar:

- Se registra el error en la consola.
- El bot continúa funcionando sin foto de perfil.

### Estadísticas

Si `stats.json` no se puede leer o escribir:

- El error se registra en la consola.
- El bot continúa funcionando, aunque las estadísticas pueden no persistirse.
- Un `stats.json` inválido se reemplaza por valores en cero en el siguiente guardado.

## Limitaciones

- Una instancia del bot administra un solo canal (`CHANNEL_NAME`).
- No se puede usar la misma identidad en dos instancias al mismo tiempo.
- La cola es en memoria: se pierde al reiniciar el proceso.
- No hay comandos de pausa, reanudación, búsqueda dentro de la canción ni control de volumen.
- `clear` no detiene la canción actual.
- No hay permisos por usuario: cualquier participante del canal puede ejecutar comandos.
- `songsPlayed` cuenta canciones encoladas, no sólo las que terminaron de reproducirse; una descarga fallida también suma.
- Las estadísticas y `.device-id` dependen de que `STATE_DIR` sea escribible y persistente.
- Cambiar `COMMAND_PREFIX` o la foto requiere reiniciar el bot.
- La disponibilidad de YouTube depende de `yt-dlp`; si YouTube cambia algo, puede ser necesario actualizar dependencias y reconstruir la imagen.
- La foto de perfil depende de que el cliente de Lala lea el atributo `lala.avatar`.
- El comando de consola requiere una entrada estándar interactiva; en Docker se recomienda usar el chat.

## Solución de problemas

### `Falta la variable SERVER_URL en .env`

No existe `.env` o falta una variable obligatoria. Copiar `.env.example` a `.env` y completar los valores.

### El bot queda esperando porque el canal no existe

Verificar `CHANNEL_NAME` y que el canal ya esté creado en Lala. El bot reintenta cada 5 segundos.

### `El canal tiene contraseña: define CHANNEL_PASSWORD en .env`

El canal requiere contraseña. Configurar `CHANNEL_PASSWORD` con la contraseña correcta.

### `SERVER_PASSWORD incorrecta`

Revisar `SERVER_PASSWORD` o dejar la variable vacía si el servidor no usa contraseña de acceso.

### `No se pudo ejecutar ffmpeg`

Instalar `ffmpeg` o configurar `FFMPEG_PATH` con la ruta correcta.

### `youtube-dl-exec needs Python 3.11 or newer`

En Linux/macOS, instalar Python 3.11 o superior. En Docker ya viene incluido.

### La descarga de `yt-dlp` falla durante `npm install`

Verificar el acceso a GitHub y a la API de releases. Volver a ejecutar `npm install` o reconstruir la imagen Docker.

### La foto de perfil no aparece

Verificar que:

- `AVATAR_PATH` contenga sólo el nombre y la extensión, por ejemplo `avatar.jpg`.
- La imagen exista dentro de `music-bot/avatar/`, por ejemplo `music-bot/avatar/avatar.jpg`.
- La imagen se pueda abrir con `ffmpeg`.
- Se haya reiniciado el bot después de cambiar la imagen.
- En Docker, el archivo esté en `music-bot/avatar/` y se haya reiniciado el contenedor con `docker compose restart music-bot`.
- El cliente de Lala lea el atributo `lala.avatar`.

### El comando `stats` no está disponible o los datos no cambian

- Verificar que el comando se envíe con el prefijo configurado, por ejemplo `!stats`.
- `songsPlayed` sólo aumenta al agregar una canción con `play`.
- El tiempo en llamada se guarda al desconectarse, aunque el comando también muestra el tiempo de la llamada activa.
- Revisar que `STATE_DIR` exista y tenga permisos de escritura.
- En Docker, comprobar que el volumen `music_bot_data` esté montado y que `/data/stats.json` sea escribible.

### El prefijo de comandos no funciona

- Revisar `COMMAND_PREFIX` en `.env`.
- Reiniciar el bot después de cambiarlo.
- En el chat, el mensaje debe comenzar exactamente con el prefijo configurado.
- Si el prefijo es `?`, los comandos son `?play`, `?skip`, `?clear`, `?stats` y `?help`.

### `Hay otra instancia del bot conectada con la misma identidad`

Detener la otra instancia. Si se usan varios contenedores, cada uno debe conservar su propio `.device-id` y no compartir el mismo volumen de estado.

### `El bot fue expulsado del canal`

Revisar permisos, moderación o bloqueos del canal/servidor.

### El bot no responde a comandos en Docker

Usar el chat del canal y verificar que el mensaje comience con `COMMAND_PREFIX`. La consola interactiva no está garantizada en un contenedor en segundo plano.

### `SERVER_URL` usa `localhost` y el bot corre en Docker

Dentro del contenedor, `localhost` es el contenedor. Usar la URL pública de Lala o `host.docker.internal` cuando corresponda.

## Seguridad

- No subir `.env` ni `.device-id` al repositorio. Ambos están en `.gitignore`.
- No compartir `SERVER_PASSWORD`, `CHANNEL_PASSWORD` ni tokens de LiveKit.
- El bot no imprime contraseñas en los logs.
- En Docker se ejecuta como usuario no root y con `no-new-privileges`.
- El cifrado E2EE del canal se activa cuando el canal tiene contraseña y se proporciona `CHANNEL_PASSWORD`.
- El volumen `music_bot_data` contiene la identidad del bot y las estadísticas; tratarlo como dato persistente.
