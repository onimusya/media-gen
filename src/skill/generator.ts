/**
 * Skill file content generator.
 * Generates SKILL.md following the Agent Skills specification (https://agentskills.io).
 */

export function generateSkillContent(): string {
  return `---
name: media-generation
description: Generate and edit images, create videos, synthesize speech, transcribe and translate audio using multiple AI providers (OpenAI, Google, ElevenLabs, Deepgram, Fal, Luma, Replicate, Stability, Runway, OpenRouter, Edge TTS). Use when the user asks to create media assets, generate pictures, make videos, produce voiceovers, transcribe recordings, or work with any visual/audio content.
compatibility: Requires Node.js 18+ and at least one provider API key configured in .env (Edge TTS is free, no key needed)
metadata:
  author: Francis Hor <francishoe@gmail.com>
  version: "1.0"
allowed-tools: Bash(node:*)
---

# Media Generation

Run the CLI with Node.js. Always use \`--json\` for parseable output.

\`\`\`bash
node ./skills/media-generation/scripts/media-gen.mjs <command> [options] --json
\`\`\`

## Commands

| Command | Purpose |
|---------|---------|
| \`image generate\` | Generate images from text prompts |
| \`image edit\` | Edit existing images with a prompt |
| \`video generate\` | Generate video from text (async) |
| \`video image-to-video\` | Animate an image into video |
| \`video extend\` | Extend an existing video |
| \`voice tts\` | Text to speech synthesis |
| \`voice clone\` | Clone a voice from audio samples |
| \`voice isolate\` | Isolate voice from background audio |
| \`audio transcribe\` | Transcribe audio to text |
| \`audio translate\` | Translate audio to another language |
| \`providers list\` | List all providers with capabilities, models, and voices |
| \`providers models\` | List all models across all providers |
| \`providers models --provider <id>\` | List models/voices for a specific provider |
| \`config init\` | Initialize project-level config |
| \`config init --global\` | Initialize user-level config at ~/.media-gen/ |
| \`config validate\` | Check which providers are configured |
| \`job status\` | Check async job status |
| \`job download\` | Download completed async job result |

## Configuration

Defaults are set via \`.env\` (project root or ~/.media-gen/.env for global):

\`\`\`
MEDIA_GEN_DEFAULT_PROVIDER=openrouter
MEDIA_GEN_DEFAULT_MODEL=openai/gpt-image-2
MEDIA_GEN_VOICE_PROVIDER=edge-tts
MEDIA_GEN_VOICE_ID=en-US-EmmaMultilingualNeural
MEDIA_GEN_VIDEO_PROVIDER=google
MEDIA_GEN_VIDEO_MODEL=veo-3.1-generate-preview
MEDIA_GEN_AUDIO_PROVIDER=deepgram
MEDIA_GEN_AUDIO_MODEL=nova-3
\`\`\`

## Examples

### Image generation

\`\`\`bash
node ./skills/media-generation/scripts/media-gen.mjs image generate \\
  --prompt "A pixel art fantasy arena" \\
  --output ./outputs/arena.png \\
  --json
\`\`\`

### Text to speech (Edge TTS - free)

\`\`\`bash
node ./skills/media-generation/scripts/media-gen.mjs voice tts \\
  --provider edge-tts \\
  --voice-id en-US-EmmaMultilingualNeural \\
  --text "Hello world" \\
  --output ./outputs/voice.mp3 \\
  --json
\`\`\`

### Text to speech (with defaults, minimal)

\`\`\`bash
node ./skills/media-generation/scripts/media-gen.mjs voice tts \\
  --text "Just provide text" \\
  --output ./outputs/speech.mp3 \\
  --json
\`\`\`

### List providers and voices

\`\`\`bash
node ./skills/media-generation/scripts/media-gen.mjs providers list --json
node ./skills/media-generation/scripts/media-gen.mjs providers models --provider edge-tts --json
node ./skills/media-generation/scripts/media-gen.mjs providers models --provider elevenlabs --json
\`\`\`

### Transcription

\`\`\`bash
node ./skills/media-generation/scripts/media-gen.mjs audio transcribe \\
  --input ./audio/recording.mp3 \\
  --output ./outputs/transcript.json \\
  --json
\`\`\`

## Rules

- Use \`--json\` for all calls.
- Use \`--dry-run\` before expensive operations when unsure.
- Never use \`--overwrite\` unless the user confirms.
- Keep outputs inside the project workspace.
- For video, use \`--wait\` only when the user wants the file immediately.
- Check the \`ok\` field in every response before proceeding.
- On error, show the \`suggestion\` field to the user.
- Edge TTS is free and requires no API key.
`;
}
