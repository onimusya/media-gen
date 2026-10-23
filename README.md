# media-gen

[![skills.sh](https://skills.sh/b/onimusya/media-gen)](https://skills.sh/onimusya/media-gen)

A production-ready CLI for multi-provider media generation. Generate images, videos, voice, and transcriptions through OpenAI, Google, Azure, ElevenLabs, Deepgram, Fal.ai, Luma AI, Replicate, Stability AI, Runway, OpenRouter, MiniMax, and Microsoft Edge TTS — all from a single interface.

Designed for both direct human use and AI agent integration.

See the [October 2026 API and model update](docs/media-api-update-2026-10.md) for
current models, API migrations, and retired Google model replacements.

## Prerequisites

- **Node.js 18+** — [Download](https://nodejs.org/)
- **npm** — comes with Node.js
- At least one provider API key (or use Edge TTS which is free, no key needed)

## Installation

### As an Agent Skill (recommended)

Install the skill into any AI agent (Claude Code, Cursor, Codex, Copilot, Windsurf, Gemini, Cline, Kiro):

```bash
npx skills add onimusya/media-gen
```

This downloads the `SKILL.md` and the pre-built CLI into your project's skills directory. Your agent will auto-discover it.

### As a global CLI

```bash
npm install -g media-gen-cli
```

### As a local project dependency

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

# Google (Nano Banana images, Omni video, Gemini speech)
GOOGLE_GENERATIVE_AI_API_KEY=AIza...

# Azure OpenAI
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/

# ElevenLabs (TTS, voice clone, isolation)
ELEVENLABS_API_KEY=

# Deepgram (transcription, translation, TTS)
DEEPGRAM_API_KEY=

# Fal.ai (images, video)
FAL_KEY=

# Luma Agents (Ray 3.2 video; takes precedence over LUMA_API_KEY)
LUMA_AGENTS_API_KEY=
# Legacy Dream Machine video
LUMA_API_KEY=

# Replicate (images, video)
REPLICATE_API_TOKEN=

# Stability AI (images)
STABILITY_API_KEY=

# Runway (images, video)
RUNWAY_API_KEY=

# OpenRouter (images, video, multi-provider gateway)
OPENROUTER_API_KEY=

# MiniMax (Hailuo video, speech)
MINIMAX_API_KEY=

# Edge TTS requires NO API key (free)
```

### Default Provider & Model

Set defaults so `--provider`, `--model`, and `--voice-id` are optional:

```bash
# Global defaults
MEDIA_GEN_DEFAULT_PROVIDER=openrouter
MEDIA_GEN_DEFAULT_MODEL=openai/gpt-image-2

# Per-type overrides (take priority over global)
MEDIA_GEN_IMAGE_PROVIDER=openrouter
MEDIA_GEN_IMAGE_MODEL=openai/gpt-image-2
MEDIA_GEN_VIDEO_PROVIDER=google
MEDIA_GEN_VIDEO_MODEL=gemini-omni-1.1-flash
MEDIA_GEN_VOICE_PROVIDER=edge-tts
MEDIA_GEN_VOICE_ID=en-US-EmmaMultilingualNeural
MEDIA_GEN_AUDIO_PROVIDER=deepgram
MEDIA_GEN_AUDIO_MODEL=nova-3

# Log level (silent, error, warn, info, debug, trace)
MEDIA_GEN_LOG_LEVEL=error
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

# Google Gemini TTS (30 voices, controllable style):
media-gen voice tts \
  --provider google \
  --model gemini-3.8-flash-tts \
  --voice-id Kore \
  --text "Say cheerfully: Have a wonderful day!" \
  --output ./outputs/gemini.wav

# Transcribe audio:
media-gen audio transcribe \
  --provider deepgram --input ./audio/meeting.mp3 \
  --output ./outputs/transcript.json

# List all providers with their models and voices:
media-gen providers list

# List voices for a specific TTS provider:
media-gen providers models --provider elevenlabs
media-gen providers models --provider edge-tts
media-gen providers models --provider google
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
| `providers list` | List all providers with models and voices |
| `providers models` | List models/voices (filter by provider/capability) |
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
| Google | ✓ | ✓ | ✓ | | | | |
| Azure | ✓ | | ✓ | ✓ | ✓ | | |
| ElevenLabs | | | ✓ | | | ✓ | ✓ |
| Deepgram | | | ✓ | ✓ | ✓ | | |
| Fal.ai | ✓ | ✓ | | | | | |
| Luma AI | | ✓ | | | | | |
| Replicate | ✓ | ✓ | | | | | |
| Stability AI | ✓ | | | | | | |
| Runway | ✓ | ✓ | | | | | |
| OpenRouter | ✓ | ✓ | | | | | |
| MiniMax | | ✓ | ✓ | | | | |
| Edge TTS | | | ✓ (free) | | | | |

## Supported Models

Bundled catalog as of **October 23, 2026**. Use the exact IDs below with
`--provider` and `--model`. These lists reflect the command capabilities in
[src/models.json](src/models.json); availability and accepted parameters depend
on the provider, account, region, and model. Aggregator model IDs apply only to
that aggregator.

```bash
# Show models for a provider and operation
media-gen providers models --provider google --capability image-generate --json
media-gen providers models --provider openrouter --capability video-generate --json
# Include configured providers and available voice IDs
media-gen providers list --configured --json
media-gen providers models --provider elevenlabs --json
```

A project-level `.media-gen/models.json` replaces the bundled entry for each
provider it defines. The listing commands show those effective overrides.

<details>
<summary>OpenAI (<code>openai</code>)</summary>

| Operation | Model IDs |
| --- | --- |
| Image generation / Image editing | `gpt-image-2.5-sunburst`, `gpt-image-2.5-flare`, `gpt-image-1.5`, `gpt-image-1-mini`, `gpt-image-2`, `gpt-image-1` |
| Text-to-speech | `gpt-4o-mini-tts`, `tts-1`, `tts-1-hd` |
| Transcription | `whisper-1`, `gpt-4o-transcribe`, `gpt-4o-mini-transcribe` |
| Translation | `whisper-1` |

Documentation: [Images](https://developers.openai.com/api/docs/guides/image-generation), [speech](https://developers.openai.com/api/docs/guides/text-to-speech), [transcription](https://developers.openai.com/api/docs/guides/speech-to-text).

</details>

<details>
<summary>Google (<code>google</code>)</summary>

| Operation | Model IDs |
| --- | --- |
| Image generation / Image editing | `gemini-nano-banana-2.1`, `gemini-3.1-flash-image`, `gemini-3.1-flash-lite-image`, `gemini-3-pro-image` |
| Text-to-video / Image-to-video | `gemini-omni-1.1-flash` |
| Text-to-speech | `gemini-3.8-flash-tts`, `gemini-3.1-flash-tts-preview`, `gemini-2.5-flash-preview-tts`, `gemini-2.5-pro-preview-tts` |

Omni returns the completed video synchronously. Use `.wav` output for Google
speech. Imagen and direct Gemini API Veo 3.1 previews are retired; see the
[migration notes](docs/media-api-update-2026-10.md).

Documentation: [Images and editing](https://ai.google.dev/gemini-api/docs/image-generation), [Omni video](https://ai.google.dev/gemini-api/docs/omni), [speech](https://ai.google.dev/gemini-api/docs/speech-generation).

</details>

<details>
<summary>Azure (<code>azure</code>)</summary>

| Operation | Model IDs |
| --- | --- |
| Image generation | `gpt-image-2.5-flare`, `gpt-image-2.5-sunburst`, `gpt-image-2` |
| Text-to-speech | `gpt-4o-mini-tts` |
| Transcription | `whisper-1`, `gpt-4o-transcribe`, `gpt-4o-mini-transcribe` |
| Translation | `whisper-1` |

Pass your deployed model/deployment name to `--model`; the IDs above are
the bundled model families, and deployment availability varies by region.

GPT Image 2/2.5 custom sizes require both dimensions to be divisible by 16.
`1920x1080` is invalid: use `--size 1920x1088` for the nearest aligned dimensions,
or `--size 1536x864` for an exact 16:9 image. The CLI reports an `INVALID_INPUT`
error with a suggested size before sending an invalid request, including in dry runs.
See the [image size requirements](https://developers.openai.com/api/reference/resources/images/methods/generate).

Documentation: [Azure OpenAI documentation](https://learn.microsoft.com/en-us/azure/ai-foundry/openai/overview).

</details>

<details>
<summary>ElevenLabs (<code>elevenlabs</code>)</summary>

| Operation | Model IDs |
| --- | --- |
| Text-to-speech | `eleven_v4`, `eleven_v4_turbo`, `eleven_flash_v2_5`, `eleven_flash_v2`, `eleven_v3`, `eleven_multilingual_v2`, `eleven_turbo_v2_5`, `eleven_turbo_v2`, `eleven_monolingual_v1` |

Voice cloning and isolation are also available. Cloning creates a voice ID;
select a TTS model when synthesizing with that voice.

Documentation: [Models](https://elevenlabs.io/docs/overview/models/), [API reference](https://elevenlabs.io/docs/api-reference/introduction).

</details>

<details>
<summary>Deepgram (<code>deepgram</code>)</summary>

| Operation | Model IDs |
| --- | --- |
| Transcription | `nova-3`, `nova-3-pharma`, `nova-3-medical`, `nova-2`, `nova`, `enhanced`, `base` |
| Translation | `nova-3`, `nova-2` |
| Text-to-speech | `aura-2`, `aura` |

For TTS, choose a full voice model with `--voice-id`, such as
`aura-2-thalia-en`. Streaming Flux is not exposed by this batch CLI.

Documentation: [Transcription models](https://developers.deepgram.com/docs/models-languages-overview), [TTS models](https://developers.deepgram.com/docs/tts-models).

</details>

<details>
<summary>Fal.ai (<code>fal</code>)</summary>

| Operation | Model IDs |
| --- | --- |
| Image generation | `fal-ai/flux-2/pro`, `fal-ai/flux-2/max`, `fal-ai/flux-pro/v1.1`, `fal-ai/flux/dev`, `fal-ai/flux-realism`, `fal-ai/seedream-4.5`, `fal-ai/bytedance/seedream/v5/lite/text-to-image`, `fal-ai/bytedance/seedream/v4/text-to-image`, `fal-ai/bytedance/dreamina/v3.1/text-to-image` |
| Text-to-video | `fal-ai/veo-3.1`, `bytedance/seedance-2.0/text-to-video`, `bytedance/seedance-2.0/fast/text-to-video`, `bytedance/seedance-2.0/mini/text-to-video`, `fal-ai/bytedance/seedance/v1.5/pro/text-to-video`, `fal-ai/kling-video/v3.0/pro`, `fal-ai/minimax/video-01` |

Documentation: [Model catalog](https://fal.ai/models), [Queue API](https://fal.ai/docs/documentation/model-apis/inference/queue).

</details>

<details>
<summary>Luma AI (<code>luma</code>)</summary>

| Operation | Model IDs |
| --- | --- |
| Text-to-video / Image-to-video | `ray-3.2`, `ray-2`, `ray-flash-2` |

`ray-3.2` uses the Luma Agents API and `LUMA_AGENTS_API_KEY` (with
`LUMA_API_KEY` as a fallback). Ray 2 models use the legacy Dream Machine API.

Documentation: [Ray 3.2 generation](https://docs.agents.lumalabs.ai/guides/videos/generation/), [Agents quickstart](https://docs.agents.lumalabs.ai/).

</details>

<details>
<summary>Replicate (<code>replicate</code>)</summary>

| Operation | Model IDs |
| --- | --- |
| Image generation | `black-forest-labs/flux-2-pro`, `black-forest-labs/flux-2-max`, `black-forest-labs/flux-1.1-pro`, `black-forest-labs/flux-schnell` |
| Text-to-video | `runwayml/gen-4.5`, `minimax/video-01`, `alibaba/happy-horse-1.0` |

Documentation: [Models](https://replicate.com/explore), [API documentation](https://replicate.com/docs).

</details>

<details>
<summary>Stability AI (<code>stability</code>)</summary>

| Operation | Model IDs |
| --- | --- |
| Image generation | `sd3.5-large`, `sd3.5-large-turbo`, `sd3.5-medium`, `stable-image-ultra`, `stable-image-core` |

Documentation: [Stable Image API reference](https://platform.stability.ai/docs/api-reference).

</details>

<details>
<summary>Runway (<code>runway</code>)</summary>

| Operation | Model IDs |
| --- | --- |
| Image generation | `gen4_image`, `gen4_image_turbo`, `gemini_image3_pro`, `gemini_image3.1_flash`, `gemini_2.5_flash`, `gpt_image_2` |
| Text-to-video | `gen4.5`, `veo3`, `veo3.1`, `seedance2`, `seedance2_fast`, `seedance2_mini`, `happyhorse_1_0`, `gemini_omni_flash` |
| Image-to-video | `gen4.5`, `gen4_turbo`, `gen3a_turbo`, `veo3`, `veo3.1`, `seedance2`, `seedance2_fast`, `seedance2_mini`, `happyhorse_1_0`, `gemini_omni_flash` |

Documentation: [API reference](https://docs.dev.runwayml.com/api), [Input parameters](https://docs.dev.runwayml.com/assets/inputs/).

</details>

<details>
<summary>OpenRouter (<code>openrouter</code>)</summary>

| Operation | Model IDs |
| --- | --- |
| Image generation | `qwen/qwen-image-2.1-turbo`, `qwen/qwen-image-2.1-pro`, `black-forest-labs/flux-3-image-klein`, `google/gemini-nano-banana-2.1`, `tencent/hy-image-v3.5-preview`, `bytedance-seed/seedream-5-0-flash`, `black-forest-labs/flux-3-image`, `recraft/recraft-v4.1-flash`, `openai/gpt-image-2.5-sunburst`, `openai/gpt-image-2.5-flare`, `microsoft/mai-image-2.6`, `microsoft/mai-image-2.6-flash`, `meta/muse-image`, `bytedance-seed/seedream-5-0-lite`, `bytedance-seed/seedream-5-0-pro`, `x-ai/grok-imagine-image-2.0`, `qwen/qwen-image-3`, `qwen/qwen-image-3-pro`, `recraft/recraft-v4.1`, `recraft/recraft-v4.1-pro`, `openai/gpt-image-2`, `openai/gpt-image-1`, `microsoft/mai-image-2.5`, `google/gemini-2.5-flash-image`, `google/gemini-3.1-flash-image`, `google/gemini-3.1-flash-image-preview`, `google/gemini-3.1-flash-lite-image`, `google/gemini-3-pro-image`, `google/gemini-3-pro-image-preview`, `x-ai/grok-imagine-image-quality`, `bytedance-seed/seedream-4.5`, `black-forest-labs/flux.2-klein-4b`, `recraft/recraft-v3` |
| Text-to-video | `x-ai/grok-imagine-video-1.5-lite`, `heygen/heygen-video-1`, `minimax/hailuo-3-max`, `alibaba/wan-3.0-prime`, `alibaba/wan-3.0`, `bytedance/seedance-2.0-mini`, `bytedance/seedance-2.5`, `black-forest-labs/flux-3-video`, `minimax/hailuo-3`, `runway/gen-4.5`, `x-ai/grok-imagine-video-1.5`, `alibaba/happyhorse-1.1`, `alibaba/happyhorse-1.0`, `x-ai/grok-imagine-video`, `kwaivgi/kling-v3.0-pro`, `kwaivgi/kling-v3.0-std`, `google/veo-3.1-fast`, `google/veo-3.1-lite`, `minimax/hailuo-2.3`, `alibaba/wan-2.7`, `bytedance/seedance-2.0`, `bytedance/seedance-2.0-fast`, `alibaba/wan-2.6`, `bytedance/seedance-1-5-pro`, `google/veo-3.1` |

Documentation: [Images](https://openrouter.ai/docs/guides/overview/multimodal/image-generation), [Video](https://openrouter.ai/docs/guides/overview/multimodal/video-generation), [Live image catalog](https://openrouter.ai/api/v1/models?output_modalities=image), [Live video catalog](https://openrouter.ai/api/v1/models?output_modalities=video).

</details>

<details>
<summary>MiniMax (<code>minimax</code>)</summary>

| Operation | Model IDs |
| --- | --- |
| Text-to-video | `MiniMax-Hailuo-2.3`, `MiniMax-Hailuo-02`, `T2V-01-Director`, `T2V-01` |
| Image-to-video | `MiniMax-Hailuo-2.3`, `MiniMax-Hailuo-2.3Fast`, `MiniMax-Hailuo-02` |
| Text-to-speech | `speech-2.8-hd`, `speech-2.8-turbo`, `speech-2.6-hd`, `speech-2.6-turbo` |

Documentation: [API documentation](https://platform.minimax.io/docs), [Speech API](https://platform.minimax.io/docs/api-reference/speech-t2a-http).

</details>

<details>
<summary>Edge TTS (<code>edge-tts</code>)</summary>

No model ID or API key is required. Select a voice with `--voice-id`, such as
`en-US-EmmaMultilingualNeural`, `en-GB-SoniaNeural`, or `zh-CN-XiaoxiaoNeural`.

Documentation: [edge-tts-universal library](https://github.com/travisvn/edge-tts-universal).

</details>

For API payload changes, default models, validation coverage, and migration
guidance, see the [October 2026 API update](docs/media-api-update-2026-10.md).

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

See [AGENTS.md](AGENTS.md) for the full agent integration guide and
[SKILL.md](skills/media-generation/SKILL.md) for command examples.

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

Google Omni returns a completed file synchronously. For pollable video jobs,
use an asynchronous provider such as OpenRouter:

```bash
# Wait for completion
media-gen video generate \
  --provider openrouter --model google/veo-3.1 \
  --prompt "..." --wait --timeout 300000 --json

# Or get job ID and check later
media-gen video generate --provider openrouter --model google/veo-3.1 --prompt "..." --json
media-gen job status --provider openrouter --job-id "YOUR_JOB_ID" --json
media-gen job download --provider openrouter --job-id "YOUR_JOB_ID" --output ./video.mp4 --json
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
