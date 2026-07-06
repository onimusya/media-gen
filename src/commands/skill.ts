/**
 * Skill file generation command.
 */

import { Command } from 'commander';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { printResponse } from '../core/output.js';
import { toErrorResponse } from '../core/errors.js';
import { generateSkillContent } from '../skill/generator.js';

export function createSkillCommand(): Command {
  const skill = new Command('skill').description('Generate agent skill files');

  skill
    .command('generate')
    .description('Generate a SKILL.md file for AI agent discovery')
    .option('--output <path>', 'Output path', '.media-gen/SKILL.md')
    .option('--json', 'Output as JSON', false)
    .action((opts) => {
      try {
        const outputPath = resolve(process.cwd(), opts.output);
        const dir = resolve(outputPath, '..');

        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }

        const content = generateSkillContent();
        writeFileSync(outputPath, content, 'utf-8');

        printResponse({
          ok: true,
          type: 'skill-generate',
          provider: '',
          outputFile: outputPath,
          message: `Skill file generated at ${outputPath}`,
        }, opts.json);
      } catch (err) {
        printResponse(toErrorResponse(err), opts.json);
        process.exitCode = 1;
      }
    });

  return skill;
}
