#!/usr/bin/env node
/**
 * CLI entry point for Structurizr DSL generation
 */

import { main } from './index.js';

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
