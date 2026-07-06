# Development Memory

This document records architecture decisions, implementation notes, and lessons learned during development of media-gen-cli. It serves as context for future development sessions.

## Architecture

### Project Structure

```
media-gen-cli/
├── src/
│   ├── index.ts              # Entry point
│   ├── cli.ts                # Commander program setup
│   ├── commands/             # CLI command handlers
│   ├── core/                 # Config, output, errors, jobs, validation, models
│   ├── providers/            # Provider adapters (one folder per provider)
│   ├── schemas/              # Zod validation schemas
│   ├── skill/                # Skill file generator
│   ├── utils/                # Filesystem, MIME, download, polling helpers
│   └── models.json           # Built-in model registry (bundled at build)
├── skills/media-generation/
│   ├── skill.md              # Agent skill file
│   └── scripts/              # Runner scripts + built CLI copy
├── tests/                    # Vitest tests
├── dist/                     # Build output (gitignored)
└── .media-gen/               # User config directory (gitignored)
```

### Key Design Decisions

1. **Single bundled file**: esbuild compiles everything into `dist/media-gen.mjs`. This gets copied to `skills/media-generation/scripts/` for agent access. No node_modules needed at runtime.

2. **ESM with createRequire banner**: The bundle is ESM format with a `createRequire` shim in the banner so CJS dependencies (commander, pino) work correctly.

3. **Provider abstraction**: All providers implement `FullProvider` (combination of `MediaProvider` + optional `ImageProvider`, `VideoProvider`, `VoiceProvider`, `AudioProvider`). New providers only need to implement the interfaces they support.

4. **Config precedence**: `.env` file (override: true) > system env vars > `.media-gen/config.json`. This ensures project-local config always wins.

5. **Default provider/model resolution**: CLI arg > type-specific env var (`MEDIA_GEN_IMAGE_PROVIDER`) > global env var (`MEDIA_GEN_DEFAULT_PROVIDER`) > config file defaults.

6. **Models config**: `src/models.json` is the built-in model registry bundled at build time. Users can override per-provider by creating `.media-gen/models.json`.

## Provider Implementation Notes

### OpenAI
- Uses `/v1/images/generations` for image gen (returns b64_json or url)
- Uses `/v1/images/edits` with FormData for image editing
- TTS at `/v1/audio/speech`, transcription at `/v1/audio/transcriptions`
- Models: `gpt-image-2` (latest), `gpt-image-1`, `gpt-4o-mini-tts`, `whisper-1`
- DALL-E 3 was retired March 2026

### Google (Gemini API)
- Base URL: `https://generativelanguage.googleapis.com/v1beta`
- Auth: `x-goog-api-key` header (NOT `?key=` query param)
- Image: `/models/{model}:predict`
- Video: `/models/{model}:predictLongRunning` (returns operation name)
- Job status: `GET ${BASE_URL}/${operation_name}` with API key header
- Video download: response contains `generateVideoResponse.generatedSamples[0].video.uri`
- Download requires `x-goog-api-key` header and redirect following
- Model names: `veo-3.1-generate-preview`, `veo-3.1-fast-generate-preview`, `imagen-4.0-generate-001`
- Important: Model names in the API are NOT the marketing names (e.g., "Veo 3.1" → `veo-3.1-generate-preview`)

### OpenRouter
- Unified gateway to multiple image providers
- Endpoint: `POST https://openrouter.ai/api/v1/images`
- Auth: `Authorization: Bearer <key>`
- Requires `HTTP-Referer` and `X-Title` headers
- Model IDs use `provider/model` format (e.g., `openai/gpt-image-2`)
- Returns `data[].b64_json` or `data[].url`

### ElevenLabs
- TTS: `POST /v1/text-to-speech/{voice_id}` (returns audio buffer)
- Voice clone: `POST /v1/voices/add` with FormData
- Voice isolation: `POST /v1/audio-isolation` with FormData
- Auth: `xi-api-key` header
- Latest model: `eleven_v3` (GA March 2026)

### Deepgram
- Transcription: `POST /v1/listen?model=nova-3` with audio buffer body
- Auth: `Authorization: Token <key>`
- Content-Type must match the audio file MIME type
- Latest model: `nova-3` (supports real-time multilingual)

### Fal.ai
- Sync image gen: `POST https://fal.run/{model}`
- Async video: `POST https://queue.fal.run/{model}` (returns request_id)
- Auth: `Authorization: Key <key>`
- Status: `GET /requests/{id}/status`
- Result: `GET /requests/{id}`

### Luma AI
- Endpoint: `https://api.lumalabs.ai/dream-machine/v1/generations`
- Auth: Bearer token
- Returns job ID, poll for status
- Latest models: `ray3.2`, `ray3.14`

### Runway
- Endpoint: `https://api.dev.runwayml.com/v1/`
- Auth: Bearer token + `X-Runway-Version` header
- Text-to-video: `/text_to_video`
- Image-to-video: `/image_to_video`
- Status: `/tasks/{id}`
- Latest models: `gen4.5`, `gen4_turbo`

### Stability AI
- Endpoint: `https://api.stability.ai/v1/generation/{model}/text-to-image`
- Auth: Bearer token
- Returns base64 artifacts
- Content policy: `finishReason: "CONTENT_FILTERED"` means blocked
- Latest models: `sd3.5-large`, `stable-image-ultra`

### Replicate
- Endpoint: `https://api.replicate.com/v1/models/{model}/predictions`
- Auth: Bearer token
- Uses `Prefer: wait` header for sync response
- Returns output URL(s) for download
- Latest image: `black-forest-labs/flux-2-pro`

## Build System

- **esbuild** bundles `src/index.ts` → `dist/media-gen.mjs`
- After build, copies to `skills/media-generation/scripts/media-gen.mjs`
- Format: ESM with CJS shim (`createRequire`)
- Platform: Node 18+
- Sourcemaps: enabled

## Testing

- Framework: Vitest
- Tests cover: config loading, output path resolution, JSON formatting, provider registry, capability filtering, validation
- Run: `npm test`
- Note: Tests that check "missing key" set env to empty string. With `override: true` in dotenv, the `.env` file values reload on each `loadConfig()` call — tests use temp directories without `.env` to avoid this.

## Common Issues & Fixes

### `.env` override behavior
`dotenv` with `override: true` means the `.env` file always wins over system env vars. If you set `OPENROUTER_API_KEY=` (empty) in `.env`, it wipes the system value. Solution: don't list unconfigured providers in `.env`.

### Google Veo model names
The API model name is `veo-3.1-generate-preview` — NOT `veo-3.1`. The marketing names differ from API identifiers.

### Google auth method
Use `x-goog-api-key` header, not `?key=` query parameter. The query param method is deprecated/unreliable for some endpoints.

### Google job polling path
`predictLongRunning` returns `{ "name": "operations/xyz" }`. The status URL is `${BASE_URL}/${name}` — the name already includes "operations/".

### ESM + CJS in esbuild
`commander` and `pino` are CJS. Bundling as ESM with `format: 'esm'` requires a `createRequire` shim in the banner. The alternative (CJS output) conflicts with `"type": "module"` in package.json.

### Firecrawl search tips
- Use `--scrape` to get full page content in one call
- Save to `.firecrawl/` directory
- The `.firecrawl/` folder is gitignored

## Version History

### 1.0.0 (Initial)
- 11 provider adapters: OpenAI, Google, Azure, ElevenLabs, Deepgram, Fal, Luma, Replicate, Stability, Runway, OpenRouter
- CLI commands: image, video, voice, audio, config, providers, skill, job
- Default provider/model from env vars
- models.json config for model registry
- Agent skill file with cross-platform scripts
- Single-file bundle via esbuild
- 25 tests passing
