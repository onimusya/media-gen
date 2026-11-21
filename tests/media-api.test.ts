import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GoogleProvider } from '../src/providers/google/index.js';
import { StabilityProvider } from '../src/providers/stability/index.js';
import { MinimaxProvider } from '../src/providers/minimax/index.js';
import { RunwayProvider } from '../src/providers/runway/index.js';
import { OpenAIProvider } from '../src/providers/openai/index.js';
import { OpenRouterProvider } from '../src/providers/openrouter/index.js';
import { LumaProvider } from '../src/providers/luma/index.js';
import { FalProvider } from '../src/providers/fal/index.js';
import { AzureProvider } from '../src/providers/azure/index.js';
import { ElevenLabsProvider } from '../src/providers/elevenlabs/index.js';
import catalog from '../src/models.json';
import { getProvider } from '../src/providers/registry.js';

vi.mock('../src/core/config.js', () => ({
  getProviderConfig: () => ({ apiKey: 'test-only-key', agentsApiKey: 'test-agents-key' }),
}));

describe('Current media REST contracts', () => {
  let dir: string;
  const fetchMock = vi.fn();
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
  const request = () => JSON.parse(fetchMock.mock.calls[0][1].body);
  const output = () => join(dir, 'result.png');
  const mp3 = Buffer.from([0xff, 0xfb, 0x90, 0x64, 0x01]);
  const interaction = (type: string, data: Buffer, mime_type: string) => ({
    steps: [{ type: 'thought', content: [{ type, data: Buffer.from('thought').toString('base64') }] },
      { type: 'model_output', content: [{ type, data: data.toString('base64'), mime_type }] }],
  });

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'media-api-'));
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => { vi.unstubAllGlobals(); rmSync(dir, { recursive: true, force: true }); });

  it('uses Interactions for Nano Banana and reads final REST image blocks', async () => {
    fetchMock.mockResolvedValue(json(interaction('image', Buffer.from('image'), 'image/png')));
    await new GoogleProvider().generateImage({ model: 'gemini-nano-banana-2.1', prompt: 'cat', size: '1024x1024', outputFile: output() });
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/interactions$/);
    expect(request()).toMatchObject({ store: false, response_format: { type: 'image', aspect_ratio: '1:1' } });
    expect(readFileSync(output()).toString()).toBe('image');
  });

  it('generates Lyria 3.5 music and reads the final MP3 block from Interactions', async () => {
    const outputFile = join(dir, 'lyria.mp3');
    fetchMock.mockResolvedValue(json({ steps: [
      { type: 'model_output', content: [{ type: 'text', text: 'Song structure' }] },
      ...interaction('audio', mp3, 'audio/mpeg').steps,
    ] }));
    const result = await new GoogleProvider().generateMusic({
      model: '', prompt: 'Gentle piano', duration: 30, instrumental: true, outputFile,
    });

    expect(fetchMock.mock.calls[0][0]).toBe('https://generativelanguage.googleapis.com/v1beta/interactions');
    expect(fetchMock.mock.calls[0][1].headers['Api-Revision']).toBe('2026-05-20');
    expect(request()).toMatchObject({
      model: 'lyria-3.5',
      input: 'Gentle piano\nAim for approximately 30 seconds.\nMake this track entirely instrumental, without vocals.',
    });
    expect(result).toMatchObject({ mimeType: 'audio/mpeg', outputFile, sizeBytes: mp3.length });
    expect(readFileSync(outputFile)).toEqual(mp3);
  });

  it('composes Eleven Music v2.5 with milliseconds and saves the binary MP3 response', async () => {
    const outputFile = join(dir, 'eleven.mp3');
    fetchMock.mockResolvedValue(new Response(mp3));
    await new ElevenLabsProvider().generateMusic({
      model: '', prompt: 'Soft strings', duration: 10.5, instrumental: true, outputFile,
    });

    expect(fetchMock.mock.calls[0][0]).toBe('https://api.elevenlabs.io/v1/music');
    expect(fetchMock.mock.calls[0][1].headers['xi-api-key']).toBe('test-only-key');
    expect(request()).toEqual({
      model_id: 'music_v2_5', prompt: 'Soft strings', music_length_ms: 10500, force_instrumental: true,
    });
    expect(readFileSync(outputFile)).toEqual(mp3);
  });

  it('rejects a non-MP3 music response before replacing an existing file', async () => {
    const outputFile = join(dir, 'existing.mp3');
    writeFileSync(outputFile, 'original');
    fetchMock.mockResolvedValue(json({ unexpected: true }));
    await expect(new ElevenLabsProvider().generateMusic({ model: '', prompt: 'Soft strings', outputFile, overwrite: true }))
      .rejects.toMatchObject({ code: 'API_ERROR' });
    expect(readFileSync(outputFile, 'utf8')).toBe('original');
  });

  it('protects music written to the destination while the provider request is in flight', async () => {
    const outputFile = join(dir, 'existing.mp3');
    fetchMock.mockImplementation(async () => {
      writeFileSync(outputFile, 'original');
      return new Response(mp3);
    });
    await expect(new ElevenLabsProvider().generateMusic({ model: '', prompt: 'Soft strings', outputFile }))
      .rejects.toMatchObject({ code: 'FILE_ALREADY_EXISTS' });
    expect(readFileSync(outputFile, 'utf8')).toBe('original');
  });

  it('rejects retired Imagen without calling the API', async () => {
    await expect(new GoogleProvider().generateImage({ model: 'imagen-4.0-generate-001', prompt: 'cat', outputFile: output() })).rejects.toThrow('shut down');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends inline images for Google editing', async () => {
    const image = join(dir, 'input.png'); writeFileSync(image, 'reference');
    fetchMock.mockResolvedValue(json(interaction('image', Buffer.from('edited'), 'image/png')));
    await new GoogleProvider().editImage({ model: 'gemini-nano-banana-2.1', prompt: 'blue', image, outputFile: output() });
    expect(request().input[0].content[1]).toMatchObject({ type: 'image', mime_type: 'image/png', data: Buffer.from('reference').toString('base64') });
  });

  it('reads current TTS REST steps and preserves a WAV container', async () => {
    fetchMock.mockResolvedValue(json(interaction('audio', Buffer.from('RIFFtest'), 'audio/wav')));
    const result = await new GoogleProvider().textToSpeech({ text: 'Hi', voiceId: 'Kore', instructions: 'cheerful', outputFile: output() });
    expect(request().model).toBe('gemini-3.8-flash-tts');
    expect(request().input[0].content[0].annotations[0].style).toBe('cheerful');
    expect(result.mimeType).toBe('audio/wav');
    expect(readFileSync(output()).toString()).toBe('RIFFtest');
  });

  it('wraps legacy PCM TTS output in WAV', async () => {
    fetchMock.mockResolvedValue(json(interaction('audio', Buffer.from([0, 1]), 'audio/L16;rate=24000')));
    await new GoogleProvider().textToSpeech({ text: 'Hi', model: 'gemini-3.1-flash-tts-preview', voiceId: 'Kore', outputFile: output() });
    expect(readFileSync(output()).subarray(0, 4).toString()).toBe('RIFF');
    expect(readFileSync(output()).readUInt32LE(24)).toBe(24000);
  });

  it('generates Omni video synchronously from REST steps', async () => {
    fetchMock.mockResolvedValue(json(interaction('video', Buffer.from('video'), 'video/mp4')));
    const result = await new GoogleProvider().generateVideo({ model: '', prompt: 'cat', aspectRatio: '9:16', resolution: '1080p', duration: 15, outputFile: output() });
    expect(request()).toMatchObject({
      model: 'gemini-omni-1.2-flash',
      input: 'cat',
      response_format: { type: 'video', aspect_ratio: '9:16', resolution: '1080p', duration: '15s' },
    });
    expect(result).toMatchObject({ mimeType: 'video/mp4', outputFile: output() });
  });

  it('rejects an out-of-range Omni 1.2 duration before submitting', async () => {
    await expect(new GoogleProvider().generateVideo({ model: '', prompt: 'cat', duration: 16, outputFile: output() }))
      .rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps prompt-based timing for explicitly selected Omni 1.1', async () => {
    fetchMock.mockResolvedValue(json(interaction('video', Buffer.from('video'), 'video/mp4')));
    await new GoogleProvider().generateVideo({ model: 'gemini-omni-1.1-flash', prompt: 'cat', duration: 5, outputFile: output() });
    expect(request().input).toContain('5 seconds');
    expect(request().response_format).not.toHaveProperty('duration');
  });

  it('rejects retired Veo previews without charging for a request', async () => {
    await expect(new GoogleProvider().generateVideo({ model: 'veo-3.1-generate-preview', prompt: 'cat', outputFile: output() })).rejects.toThrow('shut down');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a successful interaction with no generated media', async () => {
    fetchMock.mockResolvedValue(json({ steps: [] }));
    await expect(new GoogleProvider().generateImage({ model: 'gemini-nano-banana-2.1', prompt: 'cat', outputFile: output() })).rejects.toThrow('No image');
  });

  it.each([['sd3.5-large', 'sd3'], ['stable-image-ultra', 'ultra'], ['stable-image-core', 'core']])('routes Stability %s to %s with multipart', async (model, endpoint) => {
    fetchMock.mockResolvedValue(json({ image: 'aW1hZ2U=', finish_reason: 'SUCCESS' }));
    await new StabilityProvider().generateImage({ model, prompt: 'cat', size: '1024x1024', outputFile: output() });
    expect(fetchMock.mock.calls[0][0]).toMatch(new RegExp(`/generate/${endpoint}$`));
    const options = fetchMock.mock.calls[0][1];
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.headers['Content-Type']).toBeUndefined();
    expect(options.body.get('prompt')).toBe('cat');
    if (endpoint === 'sd3') expect(options.body.get('model')).toBe(model);
    expect(readFileSync(output()).toString()).toBe('image');
  });

  it('propagates Stability moderation without retry', async () => {
    fetchMock.mockResolvedValue(json({ errors: ['blocked'] }, 403));
    await expect(new StabilityProvider().generateImage({ model: 'stable-image-core', prompt: 'cat', outputFile: output() })).rejects.toMatchObject({ code: 'CONTENT_POLICY_VIOLATION' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reads MiniMax data.audio as hex', async () => {
    fetchMock.mockResolvedValue(json({ data: { audio: '616263' }, base_resp: { status_code: 0, status_msg: 'success' } }));
    await new MinimaxProvider().textToSpeech({ text: 'Hi', voiceId: 'voice', outputFile: output() });
    expect(request()).toMatchObject({ stream: false, output_format: 'hex' });
    expect(readFileSync(output()).toString()).toBe('abc');
  });

  it('sets Runway text-to-video required model, duration and pixel ratio', async () => {
    fetchMock.mockResolvedValue(json({ id: 'job' }));
    await new RunwayProvider().generateVideo({ model: '', prompt: 'cat', aspectRatio: '9:16', outputFile: output() });
    expect(request()).toMatchObject({ model: 'gen4.5', duration: 5, ratio: '720:1280' });
  });

  it('uses Kling 4.0 Flash source-image framing on Runway', async () => {
    const image = join(dir, 'input.png');
    writeFileSync(image, 'reference');
    fetchMock.mockResolvedValue(json({ id: 'job' }));
    await new RunwayProvider().imageToVideo({ model: 'kling_4_flash', image, outputFile: output() });
    expect(request()).toMatchObject({ model: 'kling_4_flash', ratio: 'auto_720p' });
    expect(request()).not.toHaveProperty('promptText');
  });

  it('selects JSON for GPT transcription models', async () => {
    const inputFile = join(dir, 'audio.mp3'); writeFileSync(inputFile, 'audio');
    fetchMock.mockResolvedValue(json({ text: 'Hi' }));
    await new OpenAIProvider().transcribe({ inputFile, model: 'gpt-4o-transcribe', outputFile: output() });
    expect(fetchMock.mock.calls[0][1].body.get('response_format')).toBe('json');
  });

  it.each(['cancelled', 'expired'])('treats OpenRouter %s as terminal failure', async status => {
    fetchMock.mockResolvedValue(json({ id: 'job', status }));
    expect(await new OpenRouterProvider().getJobStatus('job')).toMatchObject({ status: 'failed' });
  });

  it('routes Ray 3.2 submit and polling to Luma Agents', async () => {
    fetchMock.mockResolvedValueOnce(json({ id: 'generation' }))
      .mockResolvedValueOnce(json({ state: 'completed' }))
      .mockResolvedValueOnce(json({ state: 'completed' }));
    const provider = new LumaProvider();
    const result = await provider.generateVideo({ model: 'ray-3.2', prompt: 'cat', duration: 5, outputFile: output() });
    expect(request()).toMatchObject({ model: 'ray-3.2', type: 'video', video: { duration: '5s', resolution: '720p' } });
    expect(result.jobId).toBe('agents::generation');
    await provider.getJobStatus(result.jobId);
    expect(fetchMock.mock.calls[1][0]).toBe('https://agents.lumalabs.ai/v1/generations/generation');
    await provider.getJobStatus('legacy-job');
    expect(fetchMock.mock.calls[2][0]).toBe('https://api.lumalabs.ai/dream-machine/v1/generations/legacy-job');
    expect(fetchMock.mock.calls.map(([, options]) => options.headers.Authorization)).toEqual([
      'Bearer test-agents-key',
      'Bearer test-agents-key',
      'Bearer test-only-key',
    ]);
  });

  it('uses Luma Agents output URLs when downloading', async () => {
    fetchMock.mockResolvedValueOnce(json({ state: 'completed', output: [{ url: 'https://media.example/video.mp4' }] }))
      .mockResolvedValueOnce(new Response('video'));
    await new LumaProvider().downloadJob('agents::generation', output());
    expect(fetchMock.mock.calls[1][0]).toBe('https://media.example/video.mp4');
    expect(readFileSync(output()).toString()).toBe('video');
  });

  it('preserves fal queue response URLs across provider instances', async () => {
    const status = 'https://queue.fal.run/bytedance/seedance-2.0/requests/job/status';
    const result = 'https://queue.fal.run/bytedance/seedance-2.0/requests/job/response';
    fetchMock.mockResolvedValueOnce(json({ request_id: 'job', status_url: status, response_url: result }))
      .mockResolvedValueOnce(json({ status: 'COMPLETED' }))
      .mockResolvedValueOnce(json({ video: { url: 'https://media.example/video.mp4' } }))
      .mockResolvedValueOnce(new Response('video'));
    const job = await new FalProvider().generateVideo({ model: 'bytedance/seedance-2.0/fast/text-to-video', prompt: 'cat', outputFile: output() });
    await new FalProvider().getJobStatus(job.jobId);
    await new FalProvider().downloadJob(job.jobId, output());
    expect(fetchMock.mock.calls[1][0]).toBe(status);
    expect(fetchMock.mock.calls[2][0]).toBe(result);
  });

  it('rejects fal queue URLs pointing outside the provider', async () => {
    const job = 'queue::' + Buffer.from(JSON.stringify({ status: 'https://example.com/steal-key' })).toString('base64url');
    await expect(new FalProvider().getJobStatus(job)).rejects.toThrow('Invalid fal queue job ID');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends new GPT Image model and quality unchanged', async () => {
    fetchMock.mockResolvedValue(json({ data: [{ b64_json: 'aW1hZ2U=' }] }));
    await new OpenAIProvider().generateImage({ model: 'gpt-image-2.5-sunburst', prompt: 'cat', quality: 'xhigh', outputFile: output() });
    expect(request()).toMatchObject({ model: 'gpt-image-2.5-sunburst', quality: 'xhigh' });
  });

  it.each(['gpt-image-2.5-flare', 'gpt-image-2.5-sunburst', 'gpt-image-2', 'custom-image-deployment'])('rejects unaligned Azure dimensions before fetching for %s', async model => {
    await expect(new AzureProvider().generateImage({ model, prompt: 'cat', size: '1920x1080', outputFile: output() }))
      .rejects.toMatchObject({ code: 'INVALID_INPUT', suggestion: expect.stringContaining('1920x1088') });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('passes aligned OpenAI dimensions through unchanged', async () => {
    fetchMock.mockResolvedValue(json({ data: [{ b64_json: 'aW1hZ2U=' }] }));
    await new OpenAIProvider().generateImage({ model: 'gpt-image-2.5-flare', prompt: 'cat', size: '1920x1088', outputFile: output() });
    expect(request().size).toBe('1920x1088');
  });

  it('rejects unaligned OpenAI edit sizes before reading an image or fetching', async () => {
    await expect(new OpenAIProvider().editImage({ model: 'gpt-image-2.5-flare', image: 'missing.png', prompt: 'cat', size: '1920x1080', outputFile: output() }))
      .rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('all advertised capabilities have an implemented method and listed model', () => {
    const methods: Record<string, string> = { 'image-generate': 'generateImage', 'image-edit': 'editImage', 'video-generate': 'generateVideo', 'video-image-to-video': 'imageToVideo', 'video-extend': 'extendVideo', 'music-generate': 'generateMusic', 'voice-tts': 'textToSpeech', 'voice-clone': 'cloneVoice', 'voice-isolate': 'isolateVoice', 'audio-transcribe': 'transcribe', 'audio-translate': 'translate' };
    for (const [id, entry] of Object.entries(catalog)) {
      const provider = getProvider(id);
      for (const [capability, models] of Object.entries(entry.capabilities)) {
        expect(provider.capabilities, `${id}/${capability}`).toContain(capability);
        expect(typeof (provider as unknown as Record<string, unknown>)[methods[capability]], `${id}/${capability}`).toBe('function');
        for (const model of models) expect(entry.models).toContain(model);
      }
    }
  });
});
