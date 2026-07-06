# media-gen-cli

A production-ready CLI for multi-provider media generation. Generate images, videos, voice, and transcriptions through OpenAI, Google, Azure, ElevenLabs, Deepgram, Fal.ai, Luma AI, Replicate, Stability AI, and Runway — all from a single interface.

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

## Environment Variables

Set API keys for the providers you want to use:

```bash
# OpenAI (images, TTS, transcription)
OPENAI_API_KEY=sk-...

# Google (Imagen, Veo)
GOOGLE_GENERATIVE_AI_API_KEY=AIza...

# Azure OpenAI
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_VERSION=2024-06-01

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
```

## Quick Start

```bash
# Initialize config
media-gen config init

# Check which providers are ready
media-gen config validate --json

# Generate an image
media-gen image generate \
  --provider openai \
  --model gpt-image-1 \
  --prompt "A serene mountain lake at dawn" \
  --output ./outputs/lake.png

# Generate a video
media-gen video generate \
  --provider google \
  --model veo-3.1 \
  --prompt "Smooth camera pan over a modern city" \
  --duration 5 \
  --wait \
  --output ./outputs/city.mp4

# Text to speech
media-gen voice tts \
  --provider elevenlabs \
  --voice-id JBFqnCBsd6RMkjVDRZzb \
  --text "Hello from media-gen!" \
  --output ./outputs/hello.mp3

# Transcribe audio
media-gen audio transcribe \
  --provider deepgram \
  --input ./audio/meeting.mp3 \
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
| `providers list` | List all supported providers |
| `providers models` | List models for a provider |
| `config init` | Initialize configuration |
| `config validate` | Validate provider configuration |
| `skill generate` | Generate AI agent skill file |
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

## Agent Skill File

Generate a skill file that AI agents can use to discover and call this CLI:

```bash
media-gen skill generate
```

This creates `.media-gen/skill.md` with full documentation of commands, required environment variables, output formats, and usage examples. A default skill file is also included at `skills/media-generation/skill.md`.

### Using with AI Agents

The skill file enables agent frameworks (Claude Code, Codex CLI, custom agents) to:

1. Discover available media generation capabilities
2. Understand the command interface and options
3. Parse structured JSON responses
4. Handle errors programmatically
5. Respect safety rules (no overwriting, workspace-only output)

Always use `--json` when calling from an agent for reliable parsing.

## Examples

See the `examples/` directory for complete usage scripts:

- `examples/image-generate.sh` — Image generation with multiple providers
- `examples/video-generate.sh` — Video generation with async polling
- `examples/voice-tts.sh` — Text-to-speech and voice cloning
- `examples/transcribe.sh` — Audio transcription and translation

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev -- --help
npm run dev -- image generate --provider openai --prompt "test" --dry-run --json

# Type check
npm run typecheck

# Run tests
npm test

# Lint
npm run lint

# Format
npm run format
```

## Build and Bundle

The CLI is bundled into a single distributable file using esbuild:

```bash
npm run build
```

Output: `dist/media-gen.mjs` (single file, ~360KB)

Run directly:

```bash
node dist/media-gen.mjs --help
```

## Async Video Jobs

Video providers often return async jobs. Use `--wait` to poll until complete:

```bash
# Wait for completion
media-gen video generate \
  --provider luma --model ray-2 \
  --prompt "..." --wait --timeout 300000 --json

# Or get job ID immediately
media-gen video generate --provider luma --model ray-2 --prompt "..." --json
# Returns: { "ok": true, "jobId": "abc123", "status": "processing" }

# Check status later
media-gen job status --provider luma --job-id abc123 --json

# Download when complete
media-gen job download --provider luma --job-id abc123 --output ./video.mp4
```

## Troubleshooting

### Provider not configured

```
Error [PROVIDER_NOT_CONFIGURED]: Missing OPENAI_API_KEY
  Suggestion: Set OPENAI_API_KEY in your environment or run media-gen config init.
```

Set the required environment variable or add it to your `.env` file.

### Capability not supported

```
Error [CAPABILITY_NOT_SUPPORTED]: Provider "deepgram" does not support image generation
  Suggestion: Try: openai, stability, fal, replicate, google
```

Use a provider that supports the operation. Run `media-gen providers list --json` to see capabilities.

### File already exists

```
Error [FILE_ALREADY_EXISTS]: File already exists: ./outputs/image.png
  Suggestion: Use --overwrite to replace existing files.
```

Add `--overwrite` or use a different output path.

### External output blocked

```
Error [EXTERNAL_OUTPUT_BLOCKED]: Output path is outside the project directory.
  Suggestion: Use --allow-external-output to write outside the project directory.
```

For security, output defaults to within the project. Add `--allow-external-output` if needed.

### Debug mode

Add `--debug` to any command for verbose logging of API requests and responses.

## License

MIT
