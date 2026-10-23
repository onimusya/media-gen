# Media API refresh — verified October 23, 2026

The adapters use REST directly. This update keeps the standalone CLI architecture;
no provider SDK dependency or minimum Node.js version change is required.

## API changes

| Provider | Change | Documentation |
| --- | --- | --- |
| Google | Gemini images, image editing, Omni video and TTS use Interactions. Parse `steps[].content[]` from `model_output` steps; `output_image`, `output_audio` and `output_video` are SDK convenience properties. | [Images](https://ai.google.dev/gemini-api/docs/image-generation), [speech](https://ai.google.dev/gemini-api/docs/speech-generation), [Omni](https://ai.google.dev/gemini-api/docs/omni) |
| Google | Remove Imagen and Veo previews from the active catalog. Requests for these retired models fail locally with migration guidance. Historical operation polling remains available. | [Imagen shutdown](https://ai.google.dev/gemini-api/docs/imagen), [Veo shutdown on October 22](https://ai.google.dev/gemini-api/docs/video) |
| OpenAI | GPT Image 2.5 models and `xhigh`/`max` quality values. Reject the retired DALL·E `style` field. GPT transcription requests use `json`; Whisper keeps `verbose_json`. | [Images API](https://developers.openai.com/api/reference/resources/images/methods/generate), [transcription](https://developers.openai.com/api/docs/guides/speech-to-text) |
| Stability | SD3.5, Core and Ultra route to `/v2beta/stable-image/generate/{sd3,core,ultra}` using multipart requests. Handle moderation responses without retry. | [API reference](https://platform.stability.ai/docs/api-reference) |
| MiniMax | Explicit non-streaming hex TTS; read audio from `data.audio`. | [TTS HTTP API](https://platform.minimax.io/docs/api-reference/speech-t2a-http) |
| Runway | Default text-to-video to `gen4.5`; supply required duration and pixel ratios. Image requests also use pixel ratios. Preserve the documented `2024-11-06` API version header. | [API reference](https://docs.dev.runwayml.com/api), [inputs](https://docs.dev.runwayml.com/assets/inputs/) |
| Luma | Ray 3.2 uses `agents.lumalabs.ai/v1/generations`, nested `video` options and `output[].url`. New jobs have an `agents::` prefix; older jobs retain Dream Machine routing. `LUMA_AGENTS_API_KEY` takes precedence over `LUMA_API_KEY`. | [Video generation](https://docs.agents.lumalabs.ai/guides/videos/generation/) |
| OpenRouter | Handle `in_progress`, `cancelled` and `expired` video states; preserve returned image MIME types. | [Images](https://openrouter.ai/docs/guides/overview/multimodal/image-generation), [video status](https://openrouter.ai/docs/api/api-reference/video-generation/poll-video-generation-status) |
| fal | Preserve exact returned status/result URLs in new job IDs, including nested endpoint paths. Legacy job IDs remain supported. | [Queue API](https://fal.ai/docs/documentation/model-apis/inference/queue) |
| Deepgram | Default batch transcription to Nova-3 and add Nova-3 Pharma. Streaming Flux requires a different protocol and is not advertised as batch transcription. | [Models](https://developers.deepgram.com/docs/models-languages-overview) |

The image command now lets adapters select their own defaults. The video command
passes the model resolved from environment/config to its adapter and reports that
resolved provider/model in results and metadata.

## Model additions

- OpenAI: `gpt-image-2.5-sunburst`, `gpt-image-2.5-flare`, `gpt-image-1.5`, `gpt-image-1-mini`.
- Google: `gemini-nano-banana-2.1`, `gemini-3.1-flash-image`, `gemini-3.1-flash-lite-image`, `gemini-3-pro-image`, `gemini-omni-1.1-flash`, `gemini-3.8-flash-tts`.
- ElevenLabs: `eleven_v4`, `eleven_v4_turbo`, `eleven_flash_v2_5`, `eleven_flash_v2`. See [models](https://elevenlabs.io/docs/overview/models/).
- Luma: `ray-3.2` through the Agents API.
- OpenRouter images: GPT Image 2.5, Nano Banana 2.1, FLUX 3 Image/Klein, Qwen Image 2.1/3, Seedream 5 Flash/Lite/Pro, MAI Image 2.6/Flash, Grok Imagine Image 2.0, Recraft 4.1 and others.
- OpenRouter video: Hailuo 3/Max, Seedance 2.5, Wan 3/Prime, FLUX 3 Video, Grok Imagine Video 1.5/Lite, Runway Gen 4.5, and corrected existing provider slugs.

OpenRouter IDs were checked against its live [image](https://openrouter.ai/api/v1/models?output_modalities=image)
and [video](https://openrouter.ai/api/v1/models?output_modalities=video) catalogs.
Editing-only, avatar and upscale models were excluded from text-to-video additions.
New aggregator models are supported through OpenRouter's normalized image/video
APIs; this does not imply equivalent support on every direct provider adapter.
Removed advertised fal/Replicate edit/i2v capabilities that had no implementation.

## Usage and limitations

```bash
media-gen image generate --provider google --model gemini-nano-banana-2.1 --prompt "A landscape" --output ./outputs/landscape.png --json
media-gen video generate --provider google --model gemini-omni-1.1-flash --prompt "A cinematic landscape" --output ./outputs/landscape.mp4 --json
media-gen video generate --provider luma --model ray-3.2 --prompt "A cinematic landscape" --wait --output ./outputs/ray.mp4 --json
media-gen voice tts --provider elevenlabs --model eleven_v4 --voice-id YOUR_VOICE_ID --text "Hello" --output ./outputs/hello.mp3 --json
```

Google Omni runs synchronously and returns the file directly; it does not return
an operation job ID. Timing is requested in the prompt, not guaranteed by a numeric
duration API parameter. Use an asynchronous provider such as OpenRouter or Luma
when a pollable job is required. Google speech preserves WAV output and wraps
legacy raw PCM in a WAV container; choose a `.wav` output path.

The catalog is a verified snapshot, not a live availability guarantee. Account,
region, deployment and model-specific parameter limits still apply. Existing
`.media-gen/models.json` overrides replace the built-in entry for that provider.
Validation uses mocked HTTP contracts and CLI dry runs; paid generation requests
are not part of the checks.
