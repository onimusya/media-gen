import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createVideoCommand } from '../src/commands/video.js';
import { createImageCommand } from '../src/commands/image.js';
import { MediaGenError } from '../src/core/errors.js';

const mocks = vi.hoisted(() => ({
  defaultVideoModel: 'gemini-omni-1.2-flash',
  defaultImageToVideoModel: 'gemini-omni-1.2-flash',
  generateVideo: vi.fn(),
  imageToVideo: vi.fn(),
  generateImage: vi.fn(),
  printResponse: vi.fn(),
  checkOverwrite: vi.fn(),
  resolveModel: vi.fn(),
  parseBatchFile: vi.fn(),
}));
vi.mock('../src/core/config.js', () => ({
  resolveProvider: (value: string) => value || 'google',
  resolveModel: mocks.resolveModel,
}));
vi.mock('../src/providers/registry.js', () => ({ getProvider: () => mocks }));
vi.mock('../src/core/output.js', () => ({
  resolveOutputPath: () => 'outputs/test.mp4', checkOverwrite: mocks.checkOverwrite, ensureOutputDir: vi.fn(),
  writeMetadata: vi.fn(), printResponse: mocks.printResponse,
}));
vi.mock('../src/utils/batch.js', async importOriginal => ({
  ...await importOriginal<typeof import('../src/utils/batch.js')>(),
  parseBatchFile: mocks.parseBatchFile,
}));
const initialExitCode = process.exitCode;
beforeEach(() => {
  vi.resetAllMocks();
  mocks.resolveModel.mockImplementation((value?: string) => value);
  mocks.generateVideo.mockResolvedValue({ outputFile: 'outputs/test.mp4', durationMs: 1 });
  mocks.generateImage.mockResolvedValue({ outputFile: 'outputs/test.png', durationMs: 1 });
});
afterEach(() => {
  process.exitCode = initialExitCode;
  vi.restoreAllMocks();
});

it('passes the configured video model to the provider and reports resolved values', async () => {
  mocks.resolveModel.mockReturnValue('gemini-omni-1.1-flash');
  await createVideoCommand().parseAsync(['generate', '--prompt', 'cat', '--json'], { from: 'user' });
  expect(mocks.generateVideo).toHaveBeenCalledWith(expect.objectContaining({ model: 'gemini-omni-1.1-flash' }));
  expect(mocks.printResponse).toHaveBeenCalledWith(expect.objectContaining({ ok: true, provider: 'google', model: 'gemini-omni-1.1-flash' }), true);
});

it('uses and reports the adapter default when no video model is configured', async () => {
  await createVideoCommand().parseAsync(['generate', '--prompt', 'cat', '--json'], { from: 'user' });
  expect(mocks.generateVideo).toHaveBeenCalledWith(expect.objectContaining({ model: 'gemini-omni-1.2-flash' }));
  expect(mocks.printResponse).toHaveBeenCalledWith(expect.objectContaining({ model: 'gemini-omni-1.2-flash' }), true);
});

it('uses per-row batch models without a global model', async () => {
  mocks.parseBatchFile.mockReturnValue([{ prompt: 'cat', model: 'gemini-omni-1.1-flash' }]);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  await createVideoCommand().parseAsync(['generate', '--batch', 'batch.json', '--json'], { from: 'user' });
  expect(mocks.generateVideo).toHaveBeenCalledWith(expect.objectContaining({ model: 'gemini-omni-1.1-flash' }));
});

it.each([
  [['generate', '--batch', 'batch.json'], 'generateVideo'],
  [['image-to-video', '--provider', 'google', '--image', 'package.json'], 'imageToVideo'],
] as const)('checks the video destination before submitting %j', async (args, method) => {
  mocks.parseBatchFile.mockReturnValue([{ prompt: 'cat' }]);
  mocks.checkOverwrite.mockImplementation(() => {
    throw new MediaGenError('FILE_ALREADY_EXISTS', 'File already exists');
  });
  vi.spyOn(console, 'log').mockImplementation(() => {});
  await createVideoCommand().parseAsync([...args, '--json'], { from: 'user' });
  expect(mocks.checkOverwrite).toHaveBeenCalledWith('outputs/test.mp4', false);
  expect(mocks[method]).not.toHaveBeenCalled();
});

it('lets the image adapter choose its default model', async () => {
  await createImageCommand().parseAsync(['generate', '--prompt', 'cat', '--json'], { from: 'user' });
  expect(mocks.generateImage).toHaveBeenCalledWith(expect.objectContaining({ model: '' }));
});
