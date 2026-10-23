import { expect, it } from 'vitest';
import { validateImageSize } from '../src/core/validation.js';

it.each(['1024x1024', '1536x864', '1920x1088', 'auto', undefined])('accepts aligned or automatic Azure size %s', size => {
  expect(() => validateImageSize(size, 'azure', 'gpt-image-2.5-flare')).not.toThrow();
});

it.each(['0x1024', '1024x0', 'landscape', 'NaNx1080', '9007199254740992x1024'])('rejects invalid Azure size %s', size => {
  expect(() => validateImageSize(size, 'azure', 'deployment-name')).toThrow();
});

it('leaves other provider dimension rules to their adapters', () => {
  expect(() => validateImageSize('1920x1080', 'google', 'gemini-nano-banana-2.1')).not.toThrow();
  expect(() => validateImageSize('1920x1080', 'openrouter', 'openai/gpt-image-2.5-flare')).not.toThrow();
});
