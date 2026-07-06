# AI Agent Integration Guide

This document explains how AI agents (Claude Code, Codex CLI, OpenAI Agents, custom agent apps) can discover and use media-gen-cli.

## Overview

media-gen-cli is designed for programmatic use by AI agents. It provides:

- Structured JSON output for reliable parsing
- Dry-run mode for cost-safe validation
- A skill file that agents can read to learn capabilities
- Default provider/model configuration so agents don't need to hardcode choices
- Consistent error codes for programmatic handling

## Discovery

Agents discover the CLI through the skill file:

```
skills/media-generation/skill.md
```

This file describes all commands, required environment variables, output format, and usage examples.

## Execution

The CLI is a self-contained Node.js script:

```bash
node ./skills/media-generation/scripts/media-gen.mjs <command> [options] --json
```

Requirements:
- Node.js 18+
- Environment variables set in `.env` at the project root

## Agent Workflow

### 1. Check Configuration

Before generating media, validate the setup:

```bash
node ./skills/media-generation/scripts/media-gen.mjs config validate --json
```

This returns which providers are configured and their capabilities.

### 2. Dry Run

Use `--dry-run` to validate inputs without incurring costs:

```bash
node ./skills/media-generation/scripts/media-gen.mjs image generate \
  --prompt "A landscape" --dry-run --json
```

### 3. Generate

Run without `--dry-run` to produce output:

```bash
node ./skills/media-generation/scripts/media-gen.mjs image generate \
  --prompt "A pixel art dragon" \
  --output ./outputs/dragon.png \
  --json
```

### 4. Parse Response

All `--json` responses have an `ok` boolean:

```json
// Success
{ "ok": true, "type": "image", "outputFile": "./outputs/dragon.png", ... }

// Error
{ "ok": false, "error": { "code": "...", "message": "...", "suggestion": "..." } }
```

## Default Configuration

Set defaults in `.env` so agents don't need to specify provider/model each time:

```bash
MEDIA_GEN_DEFAULT_PROVIDER=openrouter
MEDIA_GEN_DEFAULT_MODEL=openai/gpt-image-2
```

Per-type overrides:

```bash
MEDIA_GEN_IMAGE_PROVIDER=openrouter
MEDIA_GEN_IMAGE_MODEL=openai/gpt-image-2
MEDIA_GEN_VIDEO_PROVIDER=google
MEDIA_GEN_VIDEO_MODEL=veo-3.1-generate-preview
MEDIA_GEN_VOICE_PROVIDER=elevenlabs
MEDIA_GEN_VOICE_MODEL=eleven_v3
MEDIA_GEN_AUDIO_PROVIDER=deepgram
MEDIA_GEN_AUDIO_MODEL=nova-3
```

With defaults set, agents can call:

```bash
node ./skills/media-generation/scripts/media-gen.mjs image generate --prompt "..." --output ./out.png --json
```

## Safety Rules for Agents

1. **Always use `--json`** for machine-readable output.
2. **Always use `--dry-run` first** when unsure about costs or parameters.
3. **Never use `--overwrite`** unless the user explicitly confirms.
4. **Keep outputs in workspace** — don't use absolute paths outside the project.
5. **Check `ok` field** in every response before proceeding.
6. **Don't log API keys** — the CLI already masks them.
7. **Use `--wait` for video** only when the user wants the final file immediately.
8. **Respect content policy errors** — don't retry with rephrased prompts unless asked.

## Error Handling

| Error Code | Meaning | Agent Action |
|---|---|---|
| `PROVIDER_NOT_CONFIGURED` | Missing API key | Tell user to set the env var |
| `CAPABILITY_NOT_SUPPORTED` | Wrong provider for the task | Switch to a supported provider |
| `INVALID_INPUT` | Bad arguments | Fix the arguments |
| `API_ERROR` | Provider returned an error | Show the message to user |
| `CONTENT_POLICY_VIOLATION` | Content was blocked | Inform user, don't retry |
| `FILE_ALREADY_EXISTS` | Output would overwrite | Ask user or use `--overwrite` |
| `JOB_TIMEOUT` | Async job took too long | Increase timeout or check later |
| `JOB_FAILED` | Async job failed | Show error, suggest retry |

## Listing Capabilities

Agents can query what's available:

```bash
# All providers and models
node ./skills/media-generation/scripts/media-gen.mjs providers list --json

# Models for image generation
node ./skills/media-generation/scripts/media-gen.mjs providers models --capability image-generate --json

# Models for a specific provider
node ./skills/media-generation/scripts/media-gen.mjs providers models --provider openrouter --json
```

## Async Video Jobs

Video generation is asynchronous. There are two patterns:

### Wait for completion (simple)

```bash
node ./skills/media-generation/scripts/media-gen.mjs video generate \
  --prompt "..." --output ./out.mp4 --wait --timeout 300000 --json
```

### Get job ID, check later (non-blocking)

```bash
# Start generation
node ./skills/media-generation/scripts/media-gen.mjs video generate \
  --prompt "..." --json
# Returns: { "ok": true, "jobId": "operations/abc", "status": "processing" }

# Check status
node ./skills/media-generation/scripts/media-gen.mjs job status \
  --provider google --job-id "operations/abc" --json

# Download when done
node ./skills/media-generation/scripts/media-gen.mjs job download \
  --provider google --job-id "operations/abc" --output ./out.mp4 --json
```

## Framework Integration Examples

### Claude Code / Kiro

Place `skills/media-generation/skill.md` in the project. The agent reads it automatically and knows how to invoke the CLI.

### Custom Agent (Node.js)

```typescript
import { execSync } from 'child_process';

function mediaGen(args: string): any {
  const cmd = `node ./skills/media-generation/scripts/media-gen.mjs ${args} --json`;
  const result = execSync(cmd, { encoding: 'utf-8' });
  return JSON.parse(result);
}

// Generate an image
const img = mediaGen('image generate --prompt "A red panda" --output ./out.png');
if (img.ok) console.log('Saved to', img.outputFile);
```

### OpenAI Function Calling

Define the CLI as a tool:

```json
{
  "type": "function",
  "function": {
    "name": "media_gen",
    "description": "Generate media (images, video, voice, transcription)",
    "parameters": {
      "type": "object",
      "properties": {
        "command": { "type": "string", "description": "Full CLI command after media-gen" }
      },
      "required": ["command"]
    }
  }
}
```

Execute by running:
```bash
node ./skills/media-generation/scripts/media-gen.mjs <command from function call> --json
```
