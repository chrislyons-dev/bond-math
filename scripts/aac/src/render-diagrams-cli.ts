#!/usr/bin/env node
/**
 * CLI entry point for diagram rendering
 */

import { main } from './render-diagrams.js';

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
