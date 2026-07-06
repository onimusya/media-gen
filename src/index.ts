/**
 * Entry point for media-gen-cli.
 */

import { createProgram } from './cli.js';

const program = createProgram();
program.parseAsync(process.argv).catch((err) => {
  console.error('Fatal error:', err?.message || err);
  process.exit(1);
});
