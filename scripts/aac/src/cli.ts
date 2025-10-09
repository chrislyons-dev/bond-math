#!/usr/bin/env node
/**
 * CLI entry point for AAC extraction
 */

import { main } from './extract.js';

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
