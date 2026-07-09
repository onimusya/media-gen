/**
 * CLI program setup for media-gen-cli.
 */

import { Command } from 'commander';
import { createImageCommand } from './commands/image.js';
import { createVideoCommand } from './commands/video.js';
import { createVoiceCommand } from './commands/voice.js';
import { createAudioCommand } from './commands/audio.js';
import { createConfigCommand } from './commands/config.js';
import { createProvidersCommand } from './commands/providers.js';
import { createSkillCommand } from './commands/skill.js';
import { createJobCommand } from './commands/job.js';
import { initLogger } from './core/logger.js';

declare const __APP_VERSION__: string;

export function createProgram(): Command {
  const program = new Command();

  // Ensure ~/.media-gen/logs/ exists on startup
  initLogger(false);

  program
    .name('media-gen')
    .description('Multi-provider media generation CLI for images, video, voice, and audio')
    .version(__APP_VERSION__)
    .option('--debug', 'Enable debug logging', false)
    .hook('preAction', (thisCommand) => {
      const opts = thisCommand.opts();
      if (opts.debug) {
        initLogger(true);
      }
    });

  program.addCommand(createImageCommand());
  program.addCommand(createVideoCommand());
  program.addCommand(createVoiceCommand());
  program.addCommand(createAudioCommand());
  program.addCommand(createConfigCommand());
  program.addCommand(createProvidersCommand());
  program.addCommand(createSkillCommand());
  program.addCommand(createJobCommand());

  return program;
}
