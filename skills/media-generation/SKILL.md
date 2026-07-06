---
name: media-generation
description: Generate and edit images, create videos, synthesize speech, transcribe and translate audio using multiple AI providers (OpenAI, Google, ElevenLabs, Deepgram, Fal, Luma, Replicate, Stability, Runway, OpenRouter). Use when the user asks to create media assets, generate pictures, make videos, produce voiceovers, transcribe recordings, or work with any visual/audio content.
compatibility: Requires Node.js 18+ and at least one provider API key configured in .env
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
| `providers list` | List providers, capabilities, models |
| `providers models` | List models (optionally by capability) |
| `config validate` | Check which providers are configured |
| `job status` | Check async job status |
| `job download` | Download completed async job result |

## Configuration

Defaults are set via `.env` at project root. With defaults configured, `--provider` and `--model` are optional:

```
MEDIA_GEN_DEFAULT_PROVIDER=openrouter
MEDIA_GEN_DEFAULT_MODEL=openai/gpt-image-2
MEDIA_GEN_VIDEO_PROVIDER=google
MEDIA_GEN_VIDEO_MODEL=veo-3.1-generate-preview
MEDIA_GEN_VOICE_PROVIDER=elevenlabs
MEDIA_GEN_VOICE_MODEL=eleven_v3
MEDIA_GEN_AUDIO_PROVIDER=deepgram
MEDIA_GEN_AUDIO_MODEL=nova-3
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

### Text to speech

```bash
node ${CLAUDE_SKILL_DIR}/scripts/media-gen.mjs voice tts \
  --provider elevenlabs \
  --voice-id JBFqnCBsd6RMkjVDRZzb \
  --text "Hello world" \
  --output ./outputs/voice.mp3 \
  --json
```

### Transcription

```bash
node ${CLAUDE_SKILL_DIR}/scripts/media-gen.mjs audio transcribe \
  --input ./audio/recording.mp3 \
  --output ./outputs/transcript.json \
  --json
```

### Dry run (validate without calling API)

```bash
node ${CLAUDE_SKILL_DIR}/scripts/media-gen.mjs image generate \
  --prompt "test" --dry-run --json
```

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
