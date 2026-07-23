# Social Media Posts

## Twitter/X (Short)

Just shipped media-gen-cli — an open-source CLI that lets you generate images, videos, speech, and transcriptions through 13 AI providers with a single command.

One tool. 100+ models. Works with AI agents out of the box.

- OpenAI, Google Veo, Runway, Fal, ElevenLabs, Deepgram, and more
- Free TTS via Edge TTS (no API key needed)
- Agent skill file for Claude Code, Cursor, Copilot, Kiro

```
npx skills add onimusya/media-gen
```

GitHub: https://github.com/onimusya/media-gen

#AI #OpenSource #MediaGeneration #CLI #AIAgents

---

## LinkedIn / Dev.to (Long)

### I built an open-source CLI that connects 13 AI media providers through one interface

After working with multiple AI APIs for image generation, video creation, text-to-speech, and transcription, I got tired of dealing with different SDKs, auth methods, and response formats for each provider.

So I built **media-gen-cli** — a single Node.js CLI that abstracts all of them behind one consistent interface.

**What it does:**
- Image generation (OpenAI, Google Imagen, Stability, Fal Flux, Runway, OpenRouter)
- Video generation (Google Veo, Runway Gen-4.5, Seedance 2.0, Luma Ray, MiniMax Hailuo, Kling)
- Text-to-speech (OpenAI, ElevenLabs, Google Gemini, Deepgram Aura, MiniMax, Edge TTS free)
- Audio transcription (OpenAI Whisper, Deepgram Nova-3)

**Key features:**
- 13 providers, 100+ models, unified JSON output
- Async video job polling with --wait
- Default provider/model via .env so commands are minimal
- Free TTS with Microsoft Edge TTS (no API key needed)
- AI agent skill file (SKILL.md) — works with Claude Code, Cursor, Codex, Copilot, Kiro, Windsurf
- Single bundled file (526KB, minified)

**For AI agents:**
The CLI ships with a SKILL.md following the Agent Skills open standard. AI coding agents can discover it automatically and generate media on behalf of users — with structured JSON output, dry-run mode, and safety guardrails.

```bash
# Install as an agent skill
npx skills add onimusya/media-gen

# Or use directly
npx media-gen-cli image generate --prompt "A pixel art dragon" --output ./dragon.png --json
```

**Tech stack:** TypeScript, Commander, esbuild (single-file bundle), Zod, Pino

Open source, MIT licensed.

GitHub: https://github.com/onimusya/media-gen
npm: media-gen-cli

Would love feedback. What providers or features would you want to see next?

#OpenSource #AI #MediaGeneration #CLI #TypeScript #AIAgents #DeveloperTools

---

## Reddit (r/programming, r/node, r/artificial)

**Title:** I built an open-source CLI that unifies 13 AI media providers (images, video, TTS, transcription) into one tool

I kept switching between different AI APIs for my projects — OpenAI for images, ElevenLabs for voice, Deepgram for transcription, Google Veo for video. Each has different auth, different SDKs, different response formats.

So I built **media-gen-cli**: one CLI, 13 providers, 100+ models.

**Quick examples:**

```bash
# Generate an image
media-gen image generate --provider openai --model gpt-image-2 --prompt "A sunset" --output ./sunset.png

# Generate a video (async with polling)
media-gen video generate --provider openrouter --model google/veo-3.1 --prompt "Drone shot" --wait --output ./video.mp4

# Free text-to-speech (no API key!)
media-gen voice tts --provider edge-tts --voice-id en-US-EmmaMultilingualNeural --text "Hello" --output ./voice.mp3

# Transcribe audio
media-gen audio transcribe --provider deepgram --input ./recording.mp3 --output ./transcript.json
```

**What makes it different:**
- Set defaults in .env, then most commands need just a prompt and output path
- `--json` output for programmatic use / AI agents
- `--dry-run` to validate before spending credits
- Ships with an agent SKILL.md so Claude Code, Cursor, etc. can use it automatically
- Minified single-file bundle (526KB), no runtime dependencies

**Providers:** OpenAI, Google, Azure, ElevenLabs, Deepgram, Fal.ai, Luma AI, Replicate, Stability AI, Runway, OpenRouter, MiniMax, Edge TTS (free)

GitHub: https://github.com/onimusya/media-gen

MIT licensed. Feedback welcome.

---

## Hacker News

**Title:** Show HN: media-gen-cli – One CLI for 13 AI media providers (images, video, TTS, transcription)

Link: https://github.com/onimusya/media-gen

media-gen-cli is a Node.js CLI that abstracts image generation, video generation, text-to-speech, and transcription across 13 providers behind a single interface. It's designed for both direct use and AI agent integration (ships with a SKILL.md for Claude Code, Cursor, Copilot).

Interesting technical bits:
- esbuild bundles everything into a single 526KB minified .mjs file
- Config hierarchy: ~/.media-gen/.env (global) → project .env (override)
- Async job polling for video (Veo, Runway, Seedance all return job IDs)
- Edge TTS is completely free with 400+ voices, no API key
- OpenRouter as a meta-provider gives access to Veo 3.1, Seedance 2.0, Kling 3.0 through one key
