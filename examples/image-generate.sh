#!/bin/bash
# Generate an image using OpenAI
media-gen image generate \
  --provider openai \
  --model gpt-image-1 \
  --prompt "A pixel art fantasy football battle arena" \
  --size 1024x1024 \
  --output ./outputs/arena.png \
  --metadata \
  --json

# Generate an image using Stability AI
media-gen image generate \
  --provider stability \
  --model stable-diffusion-xl-1024-v1-0 \
  --prompt "A futuristic city skyline at sunset" \
  --size 1024x1024 \
  --output ./outputs/city.png \
  --json

# Generate using Fal.ai Flux
media-gen image generate \
  --provider fal \
  --model fal-ai/flux/dev \
  --prompt "A serene Japanese garden in autumn" \
  --size 1024x768 \
  --output ./outputs/garden.png \
  --json
