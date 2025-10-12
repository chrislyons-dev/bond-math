#!/usr/bin/env node
/**
 * CLI entry point for diagram rendering
 */

import { main } from './index.js';

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
