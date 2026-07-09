# Release Notes

## v1.4.0 (2026-07-09)

### New Capabilities
- **OpenRouter video generation** — 12 models via `POST /api/v1/videos` (async with polling)
  - google/veo-3.1, google/veo-3.1-fast, google/veo-3.1-lite
  - alibaba/happy-horse-1.1, alibaba/happy-horse-1.0, alibaba/wan-2.7
  - x-ai/grok-imagine-video
  - kuaishou/kling-video-3.0-pro, kuaishou/kling-video-3.0-standard
  - minimax/hailuo-2.3
  - bytedance-seed/seedance-2.0-fast, bytedance-seed/seedance-2.0
- **OpenRouter image** — added microsoft/mai-image-2.5
- Auto-generate `~/.media-gen/.env` template on first run (all keys commented out)
- `--version` now reflects package.json (injected at build time)
- `.plugin/plugin.json` for Open Plugins standard (cursor.directory compatibility)
- `npx skills add onimusya/media-gen` installation support

### Fixes
- Fixed OpenRouter video endpoint (`POST /api/v1/videos`, not `/video/generations`)
- Fixed OpenRouter video download (uses `unsigned_urls[]` with auth header)
- Fixed `~/.media-gen/logs/` not created on `--help` or `--version`
- Fixed `--version` showing hardcoded `1.0.0`

## v1.3.0 (2026-07-08)

### New Capabilities
- **Runway image generation** — gen4_image, gen4_image_turbo, gemini_image3_pro, gemini_image3.1_flash, gemini_2.5_flash, gpt_image_2
- **Runway multi-provider video** — veo3, veo3.1, seedance2, seedance2_fast, seedance2_mini, happyhorse_1_0, gemini_omni_flash (text-to-video + image-to-video)
- **Deepgram TTS** — Aura-2 and Aura models with 19 featured voices (English, German, Italian, Japanese)

### Updated Models
- **Runway**: expanded from 5 to 18 models (image + video + image-to-video)
- **Deepgram**: added `aura-2` and `aura` TTS models with voice IDs (e.g., `aura-2-thalia-en`)
- **Fal.ai**: added ByteDance Seedream v5/v4, Dreamina v3.1, all Seedance 2.0 variants (standard/fast/mini)

### Fixes
- Fixed Fal.ai queue status/download URL construction (strips endpoint suffix for queue paths)
- Fixed Azure provider to use Azure AI Services OpenAI-compatible endpoint format

## v1.2.0 (2026-07-08)

### Changes
- **Azure provider rewritten** for Azure AI Services OpenAI-compatible endpoint (`https://{resource}.services.ai.azure.com/openai/v1`)
- Azure models: gpt-image-2, gpt-image-1.5, gpt-4o-mini-tts with 13 voice IDs
- Added `LICENSE` and `RELEASE_NOTES.md` to skills folder
- Added prerequisites section to README
- Added ByteDance Seedream v5/v4 and Dreamina v3.1 for Fal.ai
- Added all Seedance 2.0 variants for Fal.ai (text-to-video, fast, mini)

## v1.1.0 (2026-07-07)

### New Providers
- **MiniMax (Hailuo)** — video generation (Hailuo 2.3, 2.3Fast, 02) + TTS (speech-2.8-hd/turbo)
- **Google Gemini TTS** — 30 voices, controllable style, 3 models (gemini-3.1-flash-tts-preview, gemini-2.5-flash-preview-tts, gemini-2.5-pro-preview-tts)

### New Features
- `--instructions` option for OpenAI/Azure TTS (gpt-4o-mini-tts) to control voice style, tone, accent
- `MEDIA_GEN_VOICE_ID` env var — set default voice-id so `--voice-id` is optional
- `MEDIA_GEN_LOG_LEVEL` env var — configurable log level (silent/error/warn/info/debug/trace)
- Structured logging to `~/.media-gen/logs/media-gen-YYYY-MM-DD.log`
- Minified + obfuscated production build (519KB)
- Release scripts (`scripts/release.sh`, `scripts/release.ps1`)
- `config init --global` for user-level setup at `~/.media-gen/`

### Fixes
- Fixed Fal.ai queue status/download URL construction (model path stripping for Seedance 2.0)
- Fixed home `~/.media-gen/.env` loading — now properly overrides stale system env vars
- Fixed Google Veo API: correct model names (`veo-3.1-generate-preview`), auth headers (`x-goog-api-key`), job polling URLs
- Azure provider rewritten to use Azure AI Services OpenAI-compatible endpoint

### Updated Models
- **OpenAI**: gpt-image-2, 13 voice IDs (alloy, ash, ballad, coral, echo, fable, nova, onyx, sage, shimmer, verse, marin, cedar)
- **Azure**: gpt-image-2, gpt-image-1.5, gpt-4o-mini-tts, 13 voice IDs
- **ElevenLabs**: 21 premade voice IDs (fetched from live API, free plan)
- **Google**: imagen-4.0, veo-3.1 variants, 30 TTS voices (Kore, Puck, Zephyr, etc.)
- **Fal.ai**: Seedance 2.0 (standard/fast/mini), Seedream v5/v4, Dreamina v3.1
- **Deepgram**: nova-3, nova-3-medical
- **Luma**: ray3.2, ray3.14
- **Runway**: gen4.5, aleph-2.0
- **Replicate**: flux-2-pro/max, flux-kontext-pro, gen-4.5, happy-horse-1.0
- **OpenRouter**: gpt-image-2, gemini-3.1-flash-image, grok-imagine, flux.2-klein-4b

## v1.0.0 (2026-07-06)

### Initial Release
- 13 provider adapters: OpenAI, Google, Azure, ElevenLabs, Deepgram, Fal.ai, Luma AI, Replicate, Stability AI, Runway, OpenRouter, MiniMax, Edge TTS (free)
- CLI commands: image generate/edit, video generate/image-to-video/extend, voice tts/clone/isolate, audio transcribe/translate
- AI agent SKILL.md following Agent Skills open standard
- Default provider/model/voice-id via env vars
- Multi-level config: `~/.media-gen/.env` → project `.env` → env vars
- `models.json` config for model/voice registry (bundled + user override at `.media-gen/models.json`)
- Cross-platform scripts (bash, cmd, PowerShell)
- Single bundled JS file via esbuild
- Async video job polling with `--wait`, `--poll-interval`, `--timeout`
- Structured JSON output (`--json`) for agent integration
- Dry-run mode (`--dry-run`) for cost-safe validation
- 25 tests passing
