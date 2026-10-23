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
import catalog from '../src/models.json';
import { getProvider } from '../src/providers/registry.js';

vi.mock('../src/core/config.js', () => ({
  getProviderConfig: () => ({ apiKey: 'test-only-key' }),
}));

describe('Current media REST contracts', () => {
  let dir: string;
  const fetchMock = vi.fn();
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
  const request = () => JSON.parse(fetchMock.mock.calls[0][1].body);
  const output = () => join(dir, 'result.png');
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
    const result = await new GoogleProvider().generateVideo({ model: 'gemini-omni-1.1-flash', prompt: 'cat', aspectRatio: '9:16', resolution: '1080p', outputFile: output() });
    expect(request().response_format).toEqual({ type: 'video', aspect_ratio: '9:16', resolution: '1080p' });
    expect(result).toMatchObject({ mimeType: 'video/mp4', outputFile: output() });
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
    fetchMock.mockResolvedValueOnce(json({ id: 'generation' })).mockResolvedValueOnce(json({ state: 'completed' }));
    const provider = new LumaProvider();
    const result = await provider.generateVideo({ model: 'ray-3.2', prompt: 'cat', duration: 5, outputFile: output() });
    expect(request()).toMatchObject({ model: 'ray-3.2', type: 'video', video: { duration: '5s', resolution: '720p' } });
    expect(result.jobId).toBe('agents::generation');
    await provider.getJobStatus(result.jobId);
    expect(fetchMock.mock.calls[1][0]).toBe('https://agents.lumalabs.ai/v1/generations/generation');
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
    const methods: Record<string, string> = { 'image-generate': 'generateImage', 'image-edit': 'editImage', 'video-generate': 'generateVideo', 'video-image-to-video': 'imageToVideo', 'video-extend': 'extendVideo', 'voice-tts': 'textToSpeech', 'voice-clone': 'cloneVoice', 'voice-isolate': 'isolateVoice', 'audio-transcribe': 'transcribe', 'audio-translate': 'translate' };
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
