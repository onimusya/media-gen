import { beforeEach, expect, it, vi } from 'vitest';
import { createVideoCommand } from '../src/commands/video.js';
import { createImageCommand } from '../src/commands/image.js';

const mocks = vi.hoisted(() => ({
  generateVideo: vi.fn(), generateImage: vi.fn(), printResponse: vi.fn(),
}));
vi.mock('../src/core/config.js', () => ({
  resolveProvider: (value: string) => value || 'google',
  resolveModel: (value: string, type: string) => value || (type === 'video' ? 'gemini-omni-1.1-flash' : undefined),
}));
vi.mock('../src/providers/registry.js', () => ({ getProvider: () => mocks }));
vi.mock('../src/core/output.js', () => ({
  resolveOutputPath: () => 'outputs/test.mp4', checkOverwrite: vi.fn(), ensureOutputDir: vi.fn(),
  writeMetadata: vi.fn(), printResponse: mocks.printResponse,
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.generateVideo.mockResolvedValue({ outputFile: 'outputs/test.mp4', durationMs: 1 });
  mocks.generateImage.mockResolvedValue({ outputFile: 'outputs/test.png', durationMs: 1 });
});

it('passes the configured video model to the provider and reports resolved values', async () => {
  await createVideoCommand().parseAsync(['generate', '--prompt', 'cat', '--json'], { from: 'user' });
  expect(mocks.generateVideo).toHaveBeenCalledWith(expect.objectContaining({ model: 'gemini-omni-1.1-flash' }));
  expect(mocks.printResponse).toHaveBeenCalledWith(expect.objectContaining({ ok: true, provider: 'google', model: 'gemini-omni-1.1-flash' }), true);
});

it('lets the image adapter choose its default model', async () => {
  await createImageCommand().parseAsync(['generate', '--prompt', 'cat', '--json'], { from: 'user' });
  expect(mocks.generateImage).toHaveBeenCalledWith(expect.objectContaining({ model: '' }));
});
