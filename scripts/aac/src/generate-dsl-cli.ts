#!/usr/bin/env node
/**
 * CLI entry point for Structurizr DSL generation
 */

import { main } from './generate-dsl.js';

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
