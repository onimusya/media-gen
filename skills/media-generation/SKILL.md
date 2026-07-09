---
name: media-generation
description: Generate and edit images, create videos, synthesize speech, transcribe and translate audio using multiple AI providers (OpenAI, Google, ElevenLabs, Deepgram, Fal, Luma, Replicate, Stability, Runway, OpenRouter, Edge TTS). Use when the user asks to create media assets, generate pictures, make videos, produce voiceovers, transcribe recordings, or work with any visual/audio content.
compatibility: Requires Node.js 18+ and at least one provider API key configured in .env (Edge TTS is free, no key needed)
metadata:
  author: Francis Hor <francishoe@gmail.com>
  version: "1.0"
allowed-tools: Bash(node:*)
---

# Media Generation

Run the CLI at `${CLAUDE_SKILL_DIR}/scripts/media-gen.mjs` with Node.js. Always use `--json` for parseable output.

```bash
node ${CLAUDE_SKILL_DIR}/scripts/media-gen.mjs <command> [options] --json
```

## Commands

| Command | Purpose |
|---------|---------|
| `image generate` | Generate images from text prompts |
| `image edit` | Edit existing images with a prompt |
| `video generate` | Generate video from text (async) |
| `video image-to-video` | Animate an image into video |
| `video extend` | Extend an existing video |
| `voice tts` | Text to speech synthesis |
| `voice clone` | Clone a voice from audio samples |
| `voice isolate` | Isolate voice from background audio |
| `audio transcribe` | Transcribe audio to text |
| `audio translate` | Translate audio to another language |
| `providers list` | List all providers with capabilities, models, and voices |
| `providers list --configured` | List only configured providers |
| `providers list --capability <cap>` | Filter by capability |
| `providers models` | List all models across all providers |
| `providers models --provider <id>` | List models/voices for a specific provider |
| `providers models --capability <cap>` | Filter models by capability |
| `config init` | Initialize project-level config |
| `config init --global` | Initialize user-level config at ~/.media-gen/ |
| `config validate` | Check which providers are configured |
| `job status` | Check async job status |
| `job download` | Download completed async job result |

## Configuration

Defaults are set via `.env` (at project root or `~/.media-gen/.env` for global). With defaults configured, `--provider`, `--model`, and `--voice-id` are all optional:

```bash
MEDIA_GEN_DEFAULT_PROVIDER=openrouter
MEDIA_GEN_DEFAULT_MODEL=openai/gpt-image-2
MEDIA_GEN_VOICE_PROVIDER=edge-tts
MEDIA_GEN_VOICE_MODEL=
MEDIA_GEN_VOICE_ID=en-US-EmmaMultilingualNeural
MEDIA_GEN_VIDEO_PROVIDER=google
MEDIA_GEN_VIDEO_MODEL=veo-3.1-generate-preview
MEDIA_GEN_AUDIO_PROVIDER=deepgram
MEDIA_GEN_AUDIO_MODEL=nova-3
MEDIA_GEN_LOG_LEVEL=error
```

## Examples

### Image generation

```bash
node ${CLAUDE_SKILL_DIR}/scripts/media-gen.mjs image generate \
  --prompt "A pixel art fantasy arena" \
  --output ./outputs/arena.png \
  --json
```

### Video generation (wait for result)

```bash
node ${CLAUDE_SKILL_DIR}/scripts/media-gen.mjs video generate \
  --provider google \
  --model veo-3.1-generate-preview \
  --prompt "A cinematic card pack opening" \
  --duration 8 \
  --output ./outputs/video.mp4 \
  --wait \
  --json
```

### Text to speech (Edge TTS - free, no API key)

```bash
node ${CLAUDE_SKILL_DIR}/scripts/media-gen.mjs voice tts \
  --provider edge-tts \
  --voice-id en-US-EmmaMultilingualNeural \
  --text "Hello world" \
  --output ./outputs/voice.mp3 \
  --json
```

### Text to speech (ElevenLabs)

```bash
node ${CLAUDE_SKILL_DIR}/scripts/media-gen.mjs voice tts \
  --provider elevenlabs \
  --voice-id JBFqnCBsd6RMkjVDRZzb \
  --text "Welcome to the show" \
  --output ./outputs/george.mp3 \
  --json
```

### Text to speech (Google Gemini TTS)

```bash
node ${CLAUDE_SKILL_DIR}/scripts/media-gen.mjs voice tts \
  --provider google \
  --model gemini-3.1-flash-tts-preview \
  --voice-id Kore \
  --text "Say cheerfully: Have a wonderful day!" \
  --output ./outputs/gemini-voice.wav \
  --json
```

### Text to speech (OpenAI)

```bash
node ${CLAUDE_SKILL_DIR}/scripts/media-gen.mjs voice tts \
  --provider openai \
  --model gpt-4o-mini-tts \
  --voice-id coral \
  --text "Hello from OpenAI" \
  --output ./outputs/openai-voice.mp3 \
  --json
```

### Text to speech (with defaults set, minimal)

```bash
node ${CLAUDE_SKILL_DIR}/scripts/media-gen.mjs voice tts \
  --text "Just provide text when defaults are configured" \
  --output ./outputs/speech.mp3 \
  --json
```

### Transcription

```bash
node ${CLAUDE_SKILL_DIR}/scripts/media-gen.mjs audio transcribe \
  --input ./audio/recording.mp3 \
  --output ./outputs/transcript.json \
  --json
```

### List supported providers and models

```bash
node ${CLAUDE_SKILL_DIR}/scripts/media-gen.mjs providers list --json
```

### List voices for a TTS provider

```bash
node ${CLAUDE_SKILL_DIR}/scripts/media-gen.mjs providers models --provider edge-tts --json
node ${CLAUDE_SKILL_DIR}/scripts/media-gen.mjs providers models --provider elevenlabs --json
node ${CLAUDE_SKILL_DIR}/scripts/media-gen.mjs providers models --provider openai --json
node ${CLAUDE_SKILL_DIR}/scripts/media-gen.mjs providers models --provider google --json
```

### Dry run (validate without calling API)

```bash
node ${CLAUDE_SKILL_DIR}/scripts/media-gen.mjs image generate \
  --prompt "test" --dry-run --json
```

## Async Video Jobs

Video generation is asynchronous. Providers return a job ID instead of a file.

### Pattern 1: Wait for completion (simple)

Add `--wait` to block until the video is ready:

```bash
node ${CLAUDE_SKILL_DIR}/scripts/media-gen.mjs video generate \
  --provider google \
  --model veo-3.1-generate-preview \
  --prompt "A cinematic scene" \
  --output ./outputs/video.mp4 \
  --wait \
  --poll-interval 5000 \
  --timeout 300000 \
  --json
```

Returns the final file path when complete.

### Pattern 2: Non-blocking (get job ID, check later)

Without `--wait`, the CLI returns immediately with a job ID:

```bash
# Start generation (returns instantly)
node ${CLAUDE_SKILL_DIR}/scripts/media-gen.mjs video generate \
  --provider google \
  --model veo-3.1-generate-preview \
  --prompt "A cinematic scene" \
  --json
# Returns: {"ok": true, "jobId": "operations/abc123", "status": "processing"}

# Check status later
node ${CLAUDE_SKILL_DIR}/scripts/media-gen.mjs job status \
  --provider google \
  --job-id "operations/abc123" \
  --json
# Returns: {"ok": true, "jobId": "...", "status": "completed"}

# Download the result
node ${CLAUDE_SKILL_DIR}/scripts/media-gen.mjs job download \
  --provider google \
  --job-id "operations/abc123" \
  --output ./outputs/video.mp4 \
  --json
```

### Async options

| Option | Default | Description |
|--------|---------|-------------|
| `--wait` | false | Block until job completes |
| `--poll-interval` | 5000 | Milliseconds between status checks |
| `--timeout` | 600000 | Max wait time (10 minutes) |

### Async providers

Google (Veo), Luma AI, Runway, Fal.ai, and Replicate all use async for video. Image and TTS are always synchronous.

## Response format

Success:
```json
{"ok": true, "type": "image", "provider": "openai", "model": "gpt-image-2", "outputFile": "./outputs/image.png", "durationMs": 1200}
```

Error:
```json
{"ok": false, "error": {"code": "PROVIDER_NOT_CONFIGURED", "message": "Missing OPENAI_API_KEY", "suggestion": "Set OPENAI_API_KEY in .env"}}
```

## Rules

- Use `--json` for all calls.
- Use `--dry-run` before expensive operations when unsure.
- Never use `--overwrite` unless the user confirms.
- Keep outputs inside the project workspace.
- For video, use `--wait` only when the user wants the file immediately.
- Check the `ok` field in every response before proceeding.
- On error, show the `suggestion` field to the user.
- For TTS, `--voice-id` is optional when `MEDIA_GEN_VOICE_ID` is set in .env.
- Edge TTS is free and requires no API key — prefer it for basic TTS tasks.

## Provider Capabilities

| Provider | Image | Video | TTS | Transcribe | Translate | Clone | Isolate |
|----------|-------|-------|-----|------------|-----------|-------|---------|
| openai | Yes | | Yes | Yes | Yes | | |
| google | Yes | Yes | Yes | | | | |
| azure | Yes | | Yes | Yes | Yes | | |
| elevenlabs | | | Yes | | | Yes | Yes |
| deepgram | | | Yes | Yes | Yes | | |
| fal | Yes | Yes | | | | | |
| luma | | Yes | | | | | |
| replicate | Yes | Yes | | | | | |
| stability | Yes | | | | | | |
| runway | | Yes | | | | | |
| openrouter | Yes | Yes | | | | | |
| edge-tts | | | Yes (free) | | | | |
