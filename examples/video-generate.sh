#!/bin/bash
# Generate a video using Google Gemini Omni
media-gen video generate \
  --provider google \
  --model gemini-omni-1.2-flash \
  --prompt "A cinematic football card pack opening animation" \
  --duration 8 \
  --aspect-ratio 16:9 \
  --output ./outputs/pack-opening.mp4 \
  --json

# Generate video using Luma AI
media-gen video generate \
  --provider luma \
  --model ray-3.2 \
  --prompt "Ocean waves crashing on a rocky coastline at golden hour" \
  --duration 5 \
  --aspect-ratio 16:9 \
  --output ./outputs/ocean.mp4 \
  --wait \
  --json

# Generate video without waiting (get job ID)
media-gen video generate \
  --provider runway \
  --model gen4.5 \
  --prompt "Abstract colorful paint mixing in slow motion" \
  --output ./outputs/paint.mp4 \
  --json

# Check job status
# media-gen job status --provider runway --job-id <job-id> --json
