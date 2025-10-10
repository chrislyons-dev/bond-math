/**
 * Python Extractor - Extract AAC metadata from Python services
 *
 * Calls Python script to parse Python files using ast module
 */

import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import type { PartialIR } from '../../shared/types.js';
import { log } from '../../shared/utils.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface PythonExtractorOptions {
  servicePath: string;
  serviceId: string;
  mainFile?: string;
}

export async function extractPythonService(options: PythonExtractorOptions): Promise<PartialIR> {
  const { servicePath, serviceId, mainFile = 'src/main.py' } = options;

  log.info(`Extracting Python service: ${serviceId}`);

  const mainFilePath = join(servicePath, mainFile);
  // Python script is in src, not dist - need to go up from dist/1-extract/extractors to src/1-extract/extractors
  const pythonScriptPath = join(__dirname, '..', '..', '..', 'src', '1-extract', 'extractors', 'python-extractor.py');

  // Call Python script
  const pythonExecutable = process.platform === 'win32' ? 'py' : 'python3';
  const args = ['-3', pythonScriptPath, mainFilePath, serviceId];

  return new Promise((resolve, reject) => {
    const proc = spawn(pythonExecutable, args, {
      cwd: servicePath,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        log.error(`Python extractor failed: ${stderr}`);
        reject(new Error(`Python extractor exited with code ${code}`));
        return;
      }

      try {
        const result = JSON.parse(stdout);
        log.success(
          `Extracted ${result.services?.length || 0} service(s), ${
            result.components?.length || 0
          } component(s)`
        );
        resolve(result);
      } catch (error) {
        log.error(`Failed to parse Python extractor output: ${error}`);
        reject(error);
      }
    });

    proc.on('error', (error) => {
      log.error(`Failed to spawn Python extractor: ${error}`);
      reject(error);
    });
  });
}

/**
 * CLI entry point
 */
export async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node python.js <service-path> <service-id>');
    process.exit(1);
  }

  const [servicePath, serviceId] = args;
  const ir = await extractPythonService({ servicePath, serviceId });

  console.log(JSON.stringify(ir, null, 2));
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    log.error(error.message);
    process.exit(1);
  });
}
