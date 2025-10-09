#!/usr/bin/env node

import { generateDocs } from './generate-docs.js';
import { join } from 'path';

const ROOT_DIR = process.cwd();
const IR_PATH = join(ROOT_DIR, 'docs', 'architecture', 'ir.json');
const OUTPUT_DIR = join(ROOT_DIR, 'docs', 'architecture', 'docs');

generateDocs(IR_PATH, OUTPUT_DIR)
  .then(() => {
    console.log('[SUCCESS] Documentation generation complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[ERROR] Documentation generation failed:', error);
    process.exit(1);
  });
