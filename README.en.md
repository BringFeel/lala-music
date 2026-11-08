# Lala Music Bot

Music bot for **Lala** voice channels. It joins as an external participant using the Lala API and LiveKit, downloads audio with `yt-dlp`, decodes it with `ffmpeg`, and publishes it to the channel as a microphone track.

It can run locally with Node.js or inside Docker. It is designed for one channel per instance.

Spanish documentation: [README.md](README.md).

## Table of Contents

- [Features](#features)
- [Requirements](#requirements)
- [Local installation](#local-installation)
- [Configuration](#configuration)
- [Commands](#commands)
- [Translations](#translations)
- [Statistics](#statistics)
- [Profile picture](#profile-picture)
- [Docker](#docker)
- [Project structure](#project-structure)
- [How it works](#how-it-works)
- [Errors and reconnection](#errors-and-reconnection)
- [Limitations](#limitations)
- [Troubleshooting](#troubleshooting)
- [Security](#security)

## Features

- Waits for the channel to exist and have at least one user before connecting.
- Automatically disconnects after being alone in the channel for 30 seconds.
- Waits for users again and reconnects when someone joins.
- Plays audio from YouTube and any site supported by `yt-dlp`.
- Accepts direct links or text searches (`ytsearch1:`).
- Supports playlist links: adds all of their songs to the queue.
- In-memory playback queue with skip and clear support.
- Commands through the Lala chat and the console.
- Configurable command prefix through `COMMAND_PREFIX`.
- Translatable messages in Spanish and English through `LANGUAGE`, with placeholders for dynamic data.
- `stats` command with uptime, songs played, and call time.
- Persistent statistics in `stats.json`.
- Support for servers with an access password.
- Support for password-protected channels, including authentication and E2EE encryption.
- Optional profile picture read from the `avatar/` directory and published as the `lala.avatar` attribute.
- Persistent device identity through `.device-id`.
- Automatic reconnection on temporary errors.
- Docker image with `ffmpeg` and Python for `yt-dlp`.
- Persistent volume to keep the bot identity and statistics in Docker.

## Requirements

### Local

- Node.js 20 or newer. Node.js 22 is recommended.
- `ffmpeg` available in `PATH`, or configure `FFMPEG_PATH`.
- Python 3.11 or newer on Linux/macOS, required by the `yt-dlp` binary downloaded by `youtube-dl-exec`.
- Network access to the Lala server and to LiveKit.
- Access to GitHub during `npm install` to download the `yt-dlp` binary.

On Windows, `youtube-dl-exec` downloads `yt-dlp.exe`, which bundles Python, so installing it is usually not necessary.

### Docker

- Docker Engine and Docker Compose.
- Access to npm and GitHub during the image build.
- A `.env` file in the `music-bot` directory.

## Local installation

```bash
cd music-bot
npm install
```

Create the configuration file:

```powershell
Copy-Item .env.example .env
```

On Linux/macOS:

```bash
cp .env.example .env
```

Edit `.env` with the server and channel data.

Start the bot:

```bash
npm start
```

To stop it, use `Ctrl+C`. The bot closes the connection and cleans up resources.

## Configuration

All configuration is loaded from `music-bot/.env` through `dotenv`. Changes require restarting the bot.

| Variable | Required | Default value | Description |
| --- | --- | --- | --- |
| `SERVER_URL` | Yes | — | Base URL of the Lala server. It must include the protocol and must not include `/api`; the client adds it. Example: `https://lala.example.com`. |
| `SERVER_PASSWORD` | No | Empty | Lala server access password, if enabled. |
| `CHANNEL_NAME` | Yes | — | Visible name of the voice channel. It is matched exactly first and then case-insensitively. |
| `BOT_NAME` | No | `Lala Music Bot` | Name the bot uses in the channel. |
| `LANGUAGE` | No | `es` | Message language: `es` or `en`. Values starting with `en` use English; any other value uses Spanish. |
| `COMMAND_PREFIX` | No | `!` | Prefix commands must use. For example, `?` makes the commands `?play`, `?skip`, etc. |
| `CHANNEL_PASSWORD` | No | Empty | Channel password. It is required if the channel is password-protected. It is also used to derive the E2EE key. |
| `FFMPEG_PATH` | No | `ffmpeg` | Command or absolute path to the `ffmpeg` executable. |
| `AVATAR_PATH` | No | Empty | File name and extension of the image inside the `avatar/` directory. Example: `avatar.jpg` looks for `avatar/avatar.jpg`. |
| `STATE_DIR` | No | `music-bot` directory | Directory where `.device-id` and `stats.json` are stored. Docker uses `/data`. |

Example `.env`:

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

Notes:

- `SERVER_PASSWORD` and `CHANNEL_PASSWORD` can be left empty if they are not used.
- `SERVER_URL` may end with `/`; the bot removes it.
- `LANGUAGE` accepts `es` or `en`. If it is not set or the value does not start with `en`, Spanish is used.
- If `STATE_DIR` is not set, `.device-id` and `stats.json` are stored next to `package.json`.
- `.device-id` identifies the bot to Lala. It should be preserved across restarts, especially in Docker.
- `AVATAR_PATH` contains only the file name and extension. The image must be inside `music-bot/avatar/`.
- If `AVATAR_PATH` is set but the image cannot be read or processed, the bot logs the error and continues without a picture.
- `stats.json` is created or updated automatically when a song is added and when the bot disconnects.

## Commands

Commands can be sent through the channel chat or the console.

The prefix is configured with `COMMAND_PREFIX` and defaults to `!`. The examples use `!`; if the prefix is changed, replace `!` with the new value.

In the chat, the message must start with the configured prefix. In the console, the prefix is optional: the bot adds it automatically.

| Command | Alias | Description |
| --- | --- | --- |
| `!play <link or search>` | `!p` | Adds a song or playlist to the queue. If the argument is an HTTP/HTTPS playlist URL, all of its songs are added. If it is a video, only that video is added. If it is text, it is searched with `ytsearch1:` and the first result is used. |
| `!skip` | `!s` | Skips the current song. If it is downloading, cancels the download; if it is playing, stops `ffmpeg`. |
| `!clear` | `!c` | Clears the queue of pending songs. It does not stop the song that is currently playing. |
| `!stats` | — | Shows the bot name, uptime, songs played, and accumulated call time. |
| `!help` | — | Lists all available commands with the configured prefix. |

Examples:

```text
!play https://www.youtube.com/watch?v=jNQXAC9IVRw
!play never gonna give you up
!skip
!clear
!stats
!help
```

Behavior:

- Command names are case-insensitive.
- A message that does not start with `COMMAND_PREFIX` is ignored in the chat.
- Any participant in the channel can use the commands; there is no role-based permission system.
- Bot responses are sent to the channel chat and also shown in the console.
- If an error occurs while resolving the link or playing, the chat only receives `An unexpected error occurred.` and the details are logged to the console.
- An unknown command responds with a suggestion to use the help command with the configured prefix.
- The console is only available while the process has an interactive standard input; in Docker, using the chat is the normal approach.

## Translations

All bot messages are centralized in `src/i18n/`. Spanish (`src/i18n/es.js`) is the default language and English (`src/i18n/en.js`) is the complete translation.

The language is selected with `LANGUAGE`:

```env
LANGUAGE=es
```

or:

```env
LANGUAGE=en
```

Values starting with `en` use English; any other value uses Spanish.

Messages with data use placeholders inside braces. For example:

```text
Songs Played: {song_count}
```

When sending the message, the bot replaces `{song_count}` with the actual value. Singular and plural messages use separate keys (`...one` and `...other`), so each language keeps its own grammar.

To add a new language, create a file with the same keys as `es.js` and register it in `src/i18n/index.js`.

## Statistics

The `stats` command returns text in the following format:

```text
Name: Lala Music Bot
Uptime: 1 Year, 2 Months, 3 Weeks, 3 Days, 2 Hours, 4 Minutes and 20 Seconds
Songs Played: 42
Call Time: 3 Hours, 15 Minutes and 7 Seconds

Developed by BringFeel ❤️
```

The `stats` text is shown in the language configured in `LANGUAGE`; with `LANGUAGE=en` the labels and time units appear in English.

The data is stored in `stats.json` inside `STATE_DIR`. In Docker, the file is located at `/data/stats.json` thanks to the persistent volume.

The file has this format:

```json
{
  "songsPlayed": 42,
  "callTimeMs": 11707000
}
```

How it works:

- `songsPlayed` is incremented every time a song is added to the queue, even if the download or playback later fails.
- `callTimeMs` accumulates the time of all calls. It is updated on disconnect and also includes the current call time while the bot is connected.
- `Uptime` is calculated from process start, so it resets with the bot.
- Durations are shown in years, months, weeks, days, hours, minutes, and seconds. Zero values are omitted.
- If `stats.json` does not exist or is corrupt, the bot starts from zero.
- If the file cannot be written, the error is logged to the console and the bot keeps running.

## Profile picture

Place the image inside the `avatar/` directory of `music-bot`, for example:

```text
music-bot\avatar\avatar.jpg
```

Configure only the file name and extension in `.env`:

```env
AVATAR_PATH=avatar.jpg
```

`AVATAR_PATH` must not include the `avatar/` folder or an absolute path. The bot always looks for the file inside `music-bot/avatar/`.

The bot processes the image on startup:

1. Reads it from `music-bot/avatar/<AVATAR_PATH>`.
2. Center-crops it and scales it to 128×128.
3. Converts it to JPEG with `ffmpeg`.
4. Generates a data URL `data:image/jpeg;base64,...`.
5. Verifies that it does not exceed the 32 KB limit used by Lala.
6. Publishes it as the `lala.avatar` attribute when connecting to the channel.

Details:

- Formats that `ffmpeg` can decode are accepted (JPEG, PNG, WebP, etc.).
- If the first encoding exceeds the limit, it retries with lower quality.
- The picture is loaded only once on startup. If the file changes, the bot must be restarted.
- The picture is not stored on the Lala server: it is sent as a participant attribute on each connection.
- Lala clients that read the `lala.avatar` attribute will show the image; otherwise, they will show the avatar generated from the initials.
- If the image fails, the bot keeps running without a picture.

## Docker

Create or edit `music-bot/.env` and then build and start:

```bash
cd music-bot
docker compose up -d --build
```

View logs:

```bash
docker compose logs -f music-bot
```

Stop:

```bash
docker compose down
```

The Compose configuration:

- Builds the image from the local `Dockerfile`.
- Uses `env_file: .env`.
- Forces `STATE_DIR=/data`.
- Mounts the named volume `music_bot_data` at `/data`.
- Mounts `./avatar` at `/app/avatar` as read-only.
- Sets `restart: unless-stopped`.
- Uses `init: true` for signal handling.
- Applies `no-new-privileges`.
- Limits memory to 1 GB.
- Runs the process as the non-root `node` user.

### Persistence

The `music_bot_data` volume keeps `/data/.device-id` and `/data/stats.json`. If the volume is deleted, the bot generates a new identity and statistics return to zero on the next startup.

To also delete the volume:

```bash
docker compose down -v
```

### Profile picture with Docker

`docker-compose.yml` mounts `./avatar` at `/app/avatar` as read-only. This way, the same folder used locally is available in the container without rebuilding the image.

To use `AVATAR_PATH=avatar.jpg`:

1. Place `music-bot/avatar/avatar.jpg`.
2. Set `AVATAR_PATH=avatar.jpg` in `.env`.
3. Run `docker compose up -d --build` the first time, or `docker compose restart music-bot` if the container already exists.

The avatar is loaded on startup, so the container must be restarted after adding or changing the image. The image is also copied with `COPY . .` during the build, but mounting `./avatar` is the recommended way to change it without rebuilding.

### Docker networking

If Lala runs on the same host and `SERVER_URL` uses `localhost`, inside the container `localhost` points to the container itself, not the host. In that case, use the public Lala URL or, on Docker Desktop, something like:

```env
SERVER_URL=http://host.docker.internal:3001
```

The bot needs outbound network access to the Lala API and the LiveKit server. Depending on the deployment, LiveKit may use TCP 7880/7881, UDP 50000, and UDP 3478.

## Project structure

```text
music-bot/
├── src/
│   ├── index.js        Supervisor, connection, reconnection, and alone timer
│   ├── config.js       Loads and validates .env; resolves paths and persists .device-id
│   ├── lala.js         Lala API client, token, and channel keys
│   ├── player.js       Queue, playback, ffmpeg, and skip control
│   ├── ytdlp.js        Audio download with yt-dlp and temporary file cleanup
│   ├── commands.js     Parser, commands, dynamic prefix, and help
│   ├── stats.js        Persistent statistics and duration formatting
│   ├── avatar.js       Profile picture processing
│   └── i18n/           Translation system
│       ├── index.js    Active language, placeholders, and plurals
│       ├── es.js       Spanish messages
│       └── en.js       English messages
├── avatar/             Profile pictures; `.gitkeep` keeps the folder
├── .env.example        Configuration template
├── .dockerignore       Files excluded from the Docker context
├── .gitignore          Files excluded from Git
├── Dockerfile          Production image
├── docker-compose.yml  Docker service with a persistent volume
├── package.json        Metadata, dependencies, and start script
├── package-lock.json   Dependency lockfile
├── README.md           Spanish documentation
└── README.en.md        English documentation
```

Files generated at runtime:

- `.device-id`: persistent device UUID. It is in `.gitignore`.
- `stats.json`: song counter and accumulated call time. It is in `.gitignore`.
- `data/`: only if `STATE_DIR` is set locally to that folder. It may contain `.device-id` and `stats.json`; it is in `.gitignore`.
- Temporary audio files: created inside the system temporary directory and removed when each song ends.

## How it works

### 1. Startup and configuration

`src/config.js` loads `.env`, validates required variables, and resolves paths. If `.device-id` does not exist, it generates a UUID and stores it in `STATE_DIR`. It also resolves `statsPath` inside `STATE_DIR`, the command prefix, and the image path inside `avatar/`.

Then `src/index.js`:

1. Creates the Lala client.
2. Logs in to the server if `SERVER_PASSWORD` is set.
3. Processes the profile picture if `AVATAR_PATH` is set.
4. Loads or creates `stats.json` in `STATE_DIR`.
5. Enters the main wait/connect loop.

### 2. Lala login

`src/lala.js` uses these endpoints:

- `POST /api/access`: validates `SERVER_PASSWORD` and stores the `lala_access` cookie.
- `GET /api/rooms`: gets the channel list and looks for `CHANNEL_NAME`.
- `POST /api/token`: requests a LiveKit token for the channel.

All requests include the `X-Lala-Device` header with the `.device-id` value.

`POST /api/token` sends:

```json
{
  "room": "<channel id>",
  "name": "<BOT_NAME>",
  "passwordKey": "<derived key, only if the channel is password-protected>"
}
```

The response includes the LiveKit token, the connection URL, and the identity assigned to the bot.

### 3. Passwords and E2EE

If the channel is password-protected (`passwordSalt` in the channel information), the bot derives two keys from `CHANNEL_PASSWORD`:

- `authKey`: PBKDF2-SHA256 with 200,000 iterations and HKDF with the label `lala room auth`. It is sent as `passwordKey`.
- `e2eeKey`: PBKDF2-SHA256 with 200,000 iterations and HKDF with the label `lala room e2ee`. It is used to configure end-to-end encryption in LiveKit.

This mirrors the scheme used by the Lala web client for protected channels.

### 4. Waiting for users

The main loop queries the channel every 5 seconds:

- If the channel does not exist, it logs the status and keeps waiting.
- If the server does not respond, it logs the error and retries.
- If the channel exists but has no users (excluding the bot itself), it waits.
- If there is at least one user, it tries to connect.

### 5. Connection and playback

When connecting:

1. Creates a LiveKit room with `autoSubscribe: false` and `dynacast: false`.
2. If there is an E2EE key, configures it in the connection options.
3. Records the start of the call in the statistics.
4. Publishes the `lala.avatar` attribute if a picture is available.
5. Creates a 48 kHz mono `AudioSource`.
6. Publishes an audio track as a microphone.
7. Registers the chat message handler on the `lk.chat` topic.

The player:

- Accepts URLs or searches.
- Downloads audio with the `bestaudio[abr<=64]/bestaudio[abr<=96]/bestaudio/best` format.
- Saves the temporary file and decodes it with `ffmpeg` to signed 16-bit little-endian PCM, 48 kHz, mono.
- Splits the audio into 960-sample frames, equivalent to 20 ms.
- Sends each frame to LiveKit while keeping real-time playback pacing.
- Removes the temporary file when the song finishes, fails, or is skipped.

### 6. Alone timer

After connecting, the bot checks the channel status after 1 second to cover the case of joining when nobody was left.

- If there are no other participants, it starts a 30-second timer.
- If someone joins before it ends, it cancels the timer.
- If the timer ends and the channel is still empty, it disconnects and returns to the wait loop.
- If the bot is removed or another instance uses the same identity, it terminates with an error.

### 7. Chat and commands

Incoming messages are read through a LiveKit `TextStreamHandler` subscribed to the `lk.chat` topic.

- `src/commands.js` validates the prefix configured in `COMMAND_PREFIX`, splits the command and argument, and performs the action.
- The `play` command queues the song and increments the `songsPlayed` counter.
- The `stats` command uses `Stats.snapshot()` and responds with the name, uptime, songs, and call time.
- The `help` command lists all commands with the active prefix.
- Responses are sent with `localParticipant.sendText(text, { topic: 'lk.chat' })`.
- Console commands are normalized by adding the prefix if it is missing.
- All texts come from `src/i18n/` through `t(key, data)`; data is inserted with placeholders such as `{song_count}`.

### 8. Translations

`src/i18n/index.js` keeps the active language and exposes `t()` and `tPlural()`.

- `config.js` loads `.env`, normalizes `LANGUAGE`, and calls `setLanguage()` before validating required variables.
- `t(key, data)` looks up the string in the active language dictionary, falls back to Spanish, and replaces `{name}` placeholders.
- `tPlural(base, count, data)` chooses the `...one` or `...other` key based on the count.
- The `es.js` and `en.js` dictionaries must have exactly the same keys.

### 9. Statistics

`src/stats.js` loads `stats.json` on startup. If it does not exist or cannot be read, it starts with zero values.

- `recordSong()` increments `songsPlayed` and saves the file.
- `beginCall()` marks the start of a call.
- `endCall()` adds the elapsed time to `callTimeMs` and saves the file.
- `snapshot()` calculates uptime with `process.uptime()` and adds the active call time to the accumulated time.
- Writes are serialized to prevent two simultaneous saves from leaving the file incomplete.
- Time is formatted in years, months, weeks, days, hours, minutes, and seconds, omitting zero units.

### 10. Shutdown

On `SIGINT` or `SIGTERM`, the bot:

1. Stops accepting commands.
2. Stops the current download/playback.
3. Records the end of the call and saves `stats.json`.
4. Disconnects the room.
5. Closes the `AudioSource`.
6. Terminates the process.

## Errors and reconnection

### Fatal errors

The process terminates and, if running in Docker, restarts according to `restart: unless-stopped`:

- `password_required`: the channel requires a password and `CHANNEL_PASSWORD` was not configured.
- `wrong_password`: incorrect server or channel password.
- `not_allowed`: the bot is not allowed to join.
- `banned`: the bot is banned.
- `PARTICIPANT_REMOVED`: the bot was removed from the channel.
- `DUPLICATE_IDENTITY`: another instance is connected with the same identity.

### Temporary errors

They are retried without terminating the process:

- Channel does not exist.
- Server unavailable.
- Internal server errors.
- Non-fatal connection failures.
- Channel full.

### Playback errors

If link resolution, `yt-dlp`, `ffmpeg`, or the download fails:

- The chat only receives `An unexpected error occurred.`, translated according to `LANGUAGE`.
- The real error details are logged to the console.
- The current song is discarded.
- The bot continues with the next song in the queue, even if one song in a playlist fails.

### Avatar

If the picture cannot be read, processed, or published:

- The error is logged to the console.
- The bot keeps running without a profile picture.

### Statistics

If `stats.json` cannot be read or written:

- The error is logged to the console.
- The bot keeps running, although statistics may not be persisted.
- An invalid `stats.json` is replaced with zero values on the next save.

## Limitations

- One bot instance manages a single channel (`CHANNEL_NAME`).
- The same identity cannot be used by two instances at the same time.
- The queue is in memory: it is lost when the process restarts.
- There are no pause, resume, seek, or volume commands.
- `clear` does not stop the current song.
- There are no per-user permissions: any participant in the channel can run commands.
- `songsPlayed` counts queued songs, not only those that finished playing; a failed download also counts.
- Statistics and `.device-id` depend on `STATE_DIR` being writable and persistent.
- Changing `COMMAND_PREFIX` or the picture requires restarting the bot.
- YouTube availability depends on `yt-dlp`; if YouTube changes something, dependencies may need to be updated and the image rebuilt.
- The profile picture depends on the Lala client reading the `lala.avatar` attribute.
- The console command requires an interactive standard input; in Docker, using the chat is recommended.

## Troubleshooting

### `Missing variable SERVER_URL in .env`

There is no `.env` file or a required variable is missing. Copy `.env.example` to `.env` and fill in the values.

### The bot keeps waiting because the channel does not exist

Check `CHANNEL_NAME` and make sure the channel has already been created in Lala. The bot retries every 5 seconds.

### `The channel is password-protected: set CHANNEL_PASSWORD in .env`

The channel requires a password. Set `CHANNEL_PASSWORD` to the correct password.

### `Incorrect SERVER_PASSWORD`

Check `SERVER_PASSWORD` or leave the variable empty if the server does not use an access password.

### `Could not run ffmpeg`

Install `ffmpeg` or set `FFMPEG_PATH` to the correct path.

### `youtube-dl-exec needs Python 3.11 or newer`

On Linux/macOS, install Python 3.11 or newer. It is already included in Docker.

### The `yt-dlp` download fails during `npm install`

Check access to GitHub and the releases API. Run `npm install` again or rebuild the Docker image.

### The profile picture does not appear

Check that:

- `AVATAR_PATH` contains only the file name and extension, for example `avatar.jpg`.
- The image exists inside `music-bot/avatar/`, for example `music-bot/avatar/avatar.jpg`.
- The image can be opened with `ffmpeg`.
- The bot has been restarted after changing the image.
- In Docker, the file is in `music-bot/avatar/` and the container has been restarted with `docker compose restart music-bot`.
- The Lala client reads the `lala.avatar` attribute.

### The `stats` command is unavailable or the data does not change

- Check that the command is sent with the configured prefix, for example `!stats`.
- `songsPlayed` only increases when a song is added with `play`.
- Call time is saved on disconnect, although the command also shows the active call time.
- Check that `STATE_DIR` exists and is writable.
- In Docker, verify that the `music_bot_data` volume is mounted and `/data/stats.json` is writable.

### The command prefix does not work

- Check `COMMAND_PREFIX` in `.env`.
- Restart the bot after changing it.
- In the chat, the message must start exactly with the configured prefix.
- If the prefix is `?`, the commands are `?play`, `?skip`, `?clear`, `?stats`, and `?help`.

### `Another bot instance is connected with the same identity`

Stop the other instance. If multiple containers are used, each one must keep its own `.device-id` and must not share the same state volume.

### `The bot was removed from the channel`

Check permissions, moderation, or channel/server bans.

### The bot does not respond to commands in Docker

Use the channel chat and verify that the message starts with `COMMAND_PREFIX`. The interactive console is not guaranteed in a background container.

### `SERVER_URL` uses `localhost` and the bot runs in Docker

Inside the container, `localhost` is the container. Use the public Lala URL or `host.docker.internal` when appropriate.

## Security

- Do not commit `.env` or `.device-id` to the repository. Both are in `.gitignore`.
- Do not share `SERVER_PASSWORD`, `CHANNEL_PASSWORD`, or LiveKit tokens.
- The bot does not print passwords in the logs.
- In Docker it runs as a non-root user and with `no-new-privileges`.
- Channel E2EE is enabled when the channel is password-protected and `CHANNEL_PASSWORD` is provided.
- The `music_bot_data` volume contains the bot identity and statistics; treat it as persistent data.
