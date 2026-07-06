#!/bin/bash
# Generate a video using Google Veo
media-gen video generate \
  --provider google \
  --model veo-3.1 \
  --prompt "A cinematic football card pack opening animation" \
  --duration 8 \
  --aspect-ratio 16:9 \
  --output ./outputs/pack-opening.mp4 \
  --wait \
  --json

# Generate video using Luma AI
media-gen video generate \
  --provider luma \
  --model ray-2 \
  --prompt "Ocean waves crashing on a rocky coastline at golden hour" \
  --duration 5 \
  --aspect-ratio 16:9 \
  --output ./outputs/ocean.mp4 \
  --wait \
  --json

# Generate video without waiting (get job ID)
media-gen video generate \
  --provider runway \
  --model gen4_turbo \
  --prompt "Abstract colorful paint mixing in slow motion" \
  --output ./outputs/paint.mp4 \
  --json

# Check job status
# media-gen job status --provider runway --job-id <job-id> --json
