# media-gen-cli

A production-ready CLI for multi-provider media generation. Generate images, videos, voice, and transcriptions through OpenAI, Google, Azure, ElevenLabs, Deepgram, Fal.ai, Luma AI, Replicate, Stability AI, Runway, OpenRouter, and Microsoft Edge TTS — all from a single interface.

Designed for both direct human use and AI agent integration.

## Installation

```bash
npm install -g media-gen-cli
```

Or use locally in a project:

```bash
npm install media-gen-cli
npx media-gen --help
```

## Configuration

### Config Hierarchy

media-gen-cli loads configuration from multiple levels (highest priority first):

1. **Project `.env`** — `<project>/.env` (overrides everything)
2. **System environment variables** — already in your shell
3. **User-level `~/.media-gen/.env`** — shared across all projects (fills gaps)

Config files (`.media-gen/config.json`) merge similarly:
1. `~/.media-gen/config.json` — user-level defaults
2. `<project>/.media-gen/config.json` — project-level overrides

### Setup

```bash
# Initialize user-level config (once, shared across all projects)
media-gen config init --global
# Creates ~/.media-gen/.env and ~/.media-gen/config.json

# Initialize project-level config
media-gen config init
# Creates .media-gen/config.json in current project

# Check what's configured
media-gen config validate
```

### Environment Variables

Set API keys for the providers you want to use in `~/.media-gen/.env` (global) or `<project>/.env` (per-project):

```bash
# OpenAI (images, TTS, transcription)
OPENAI_API_KEY=sk-...

# Google (Imagen, Veo)
GOOGLE_GENERATIVE_AI_API_KEY=AIza...

# Azure OpenAI
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/

# ElevenLabs (TTS, voice clone, isolation)
ELEVENLABS_API_KEY=

# Deepgram (transcription, translation)
DEEPGRAM_API_KEY=

# Fal.ai (images, video)
FAL_KEY=

# Luma AI (video)
LUMA_API_KEY=

# Replicate (images, video)
REPLICATE_API_TOKEN=

# Stability AI (images)
STABILITY_API_KEY=

# Runway (video)
RUNWAY_API_KEY=

# OpenRouter (images, multi-provider gateway)
OPENROUTER_API_KEY=

# Edge TTS requires NO API key (free)
```

### Default Provider & Model

Set defaults so `--provider` and `--model` are optional:

```bash
# Global defaults
MEDIA_GEN_DEFAULT_PROVIDER=openrouter
MEDIA_GEN_DEFAULT_MODEL=openai/gpt-image-2

# Per-type overrides (take priority over global)
MEDIA_GEN_IMAGE_PROVIDER=openrouter
MEDIA_GEN_IMAGE_MODEL=openai/gpt-image-2
MEDIA_GEN_VIDEO_PROVIDER=google
MEDIA_GEN_VIDEO_MODEL=veo-3.1-generate-preview
MEDIA_GEN_VOICE_PROVIDER=edge-tts
MEDIA_GEN_VOICE_MODEL=en-US-EmmaMultilingualNeural
MEDIA_GEN_AUDIO_PROVIDER=deepgram
MEDIA_GEN_AUDIO_MODEL=nova-3
```

## Quick Start

```bash
# With defaults configured, just provide a prompt:
media-gen image generate --prompt "A serene mountain lake at dawn" --output ./outputs/lake.png

# Or specify provider/model explicitly:
media-gen image generate \
  --provider openai --model gpt-image-2 \
  --prompt "A pixel art dragon" --output ./outputs/dragon.png

# Free text-to-speech (no API key needed):
media-gen voice tts \
  --provider edge-tts \
  --voice-id en-US-EmmaMultilingualNeural \
  --text "Hello from media-gen!" \
  --output ./outputs/hello.mp3

# Transcribe audio:
media-gen audio transcribe \
  --provider deepgram --input ./audio/meeting.mp3 \
  --output ./outputs/transcript.json
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `image generate` | Generate an image from text |
| `image edit` | Edit an existing image |
| `video generate` | Generate a video from text |
| `video image-to-video` | Animate an image into video |
| `video extend` | Extend an existing video |
| `voice tts` | Text to speech synthesis |
| `voice clone` | Clone a voice from samples |
| `voice isolate` | Isolate voice from background |
| `audio transcribe` | Transcribe audio to text |
| `audio translate` | Translate audio to another language |
| `providers list` | List all providers with models |
| `providers models` | List models (filter by provider/capability) |
| `config init` | Initialize configuration (`--global` for user-level) |
| `config validate` | Validate provider configuration |
| `skill generate` | Generate AI agent SKILL.md file |
| `job status` | Check async job status |
| `job download` | Download async job result |

### Global Options

- `--debug` — Enable debug logging
- `--json` — Machine-readable JSON output
- `--dry-run` — Validate without calling providers
- `--overwrite` — Allow overwriting existing files
- `--metadata` — Save metadata JSON alongside output
- `--allow-external-output` — Allow writing outside project directory

## Provider Support Matrix

| Provider | Image | Video | TTS | Transcribe | Translate | Voice Clone | Voice Isolate |
|----------|-------|-------|-----|------------|-----------|-------------|---------------|
| OpenAI | ✓ | | ✓ | ✓ | ✓ | | |
| Google | ✓ | ✓ | | | | | |
| Azure | ✓ | | ✓ | ✓ | ✓ | | |
| ElevenLabs | | | ✓ | | | ✓ | ✓ |
| Deepgram | | | | ✓ | ✓ | | |
| Fal.ai | ✓ | ✓ | | | | | |
| Luma AI | | ✓ | | | | | |
| Replicate | ✓ | ✓ | | | | | |
| Stability AI | ✓ | | | | | | |
| Runway | | ✓ | | | | | |
| OpenRouter | ✓ | | | | | | |
| Edge TTS | | | ✓ (free) | | | | |

## Agent Integration

The CLI includes a SKILL.md file at `skills/media-generation/SKILL.md` following the [Agent Skills](https://agentskills.io/) open standard. AI agents can:

1. Discover the skill file and learn available capabilities
2. Run the pre-built CLI at `skills/media-generation/scripts/media-gen.mjs`
3. Parse structured JSON responses
4. Handle errors programmatically via error codes

```bash
# Agent invocation pattern:
node ./skills/media-generation/scripts/media-gen.mjs image generate \
  --prompt "..." --output ./out.png --json
```

See `docs/agents.md` for the full agent integration guide.

## Examples

See the `examples/` directory:

- `image-generate.sh` — Image generation with multiple providers
- `video-generate.sh` — Video generation with async polling
- `voice-tts.sh` — Text-to-speech with OpenAI and ElevenLabs
- `edge-tts.sh` — Free TTS with Microsoft Edge (multiple languages)
- `deepgram-transcribe.sh` — Transcription and translation
- `transcribe.sh` — Audio transcription examples

## Development

```bash
npm install          # Install dependencies
npm run dev -- --help  # Run in dev mode
npm run typecheck    # Type check
npm test             # Run tests
npm run build        # Bundle to dist/media-gen.mjs
```

## Build

```bash
npm run build
```

Produces `dist/media-gen.mjs` and copies it to `skills/media-generation/scripts/media-gen.mjs` for agent access.

## Async Video Jobs

```bash
# Wait for completion
media-gen video generate \
  --provider google --model veo-3.1-generate-preview \
  --prompt "..." --wait --timeout 300000 --json

# Or get job ID and check later
media-gen video generate --provider google --model veo-3.1-generate-preview --prompt "..." --json
media-gen job status --provider google --job-id "operations/abc" --json
media-gen job download --provider google --job-id "operations/abc" --output ./video.mp4
```

## Troubleshooting

| Error | Fix |
|-------|-----|
| `PROVIDER_NOT_CONFIGURED` | Set the API key in `~/.media-gen/.env` or project `.env` |
| `CAPABILITY_NOT_SUPPORTED` | Use a different provider. Run `providers list --capability <cap>` |
| `FILE_ALREADY_EXISTS` | Add `--overwrite` or use a different output path |
| `EXTERNAL_OUTPUT_BLOCKED` | Add `--allow-external-output` for paths outside project |

Add `--debug` to any command for verbose logging.

## License

MIT - Francis Hor
