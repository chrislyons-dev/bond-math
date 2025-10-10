#!/usr/bin/env node

import { main } from './generate-class-diagrams.js';

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
