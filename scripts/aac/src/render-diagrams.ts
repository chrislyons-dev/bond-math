/**
 * Diagram Renderer - Convert Structurizr DSL to PlantUML and render to PNG/SVG
 *
 * Uses Structurizr CLI to export PlantUML, then renders diagrams
 */

import { spawn } from 'child_process';
import { join, dirname, basename } from 'path';
import { readdir, mkdir, access } from 'fs/promises';
import { existsSync } from 'fs';
import { log } from './utils.js';

const STRUCTURIZR_CLI_VERSION = '2024.11.03';
const STRUCTURIZR_CLI_URL = `https://github.com/structurizr/cli/releases/download/v${STRUCTURIZR_CLI_VERSION}/structurizr-cli.zip`;

interface RenderOptions {
  rootPath: string;
  dslPath: string;
  outputDir: string;
  format: 'png' | 'svg' | 'both';
}

/**
 * Check if Structurizr CLI is available
 */
async function checkStructurizrCLI(rootPath: string): Promise<string> {
  const cliPath = join(rootPath, 'tools/structurizr-cli');
  const libPath = join(cliPath, 'lib');

  if (existsSync(libPath)) {
    log.info(`Using Structurizr CLI at: ${cliPath}`);
    return cliPath;
  }

  log.warn('Structurizr CLI not found');
  log.info('Please run: npm run docs:arch:setup');
  log.info(`Or see: tools/README.md for manual installation`);
  throw new Error(
    'Structurizr CLI not found. Please download and extract to tools/structurizr-cli/'
  );
}

/**
 * Export DSL to PlantUML using Structurizr CLI
 */
async function exportToPlantUML(
  cliPath: string,
  dslPath: string,
  outputDir: string
): Promise<void> {
  log.info('Exporting DSL to PlantUML...');

  return new Promise((resolve, reject) => {
    const libPath = join(cliPath, 'lib', '*');
    const args = [
      '-cp',
      libPath,
      'com.structurizr.cli.StructurizrCliApplication',
      'export',
      '-workspace',
      dslPath,
      '-format',
      'plantuml',
      '-output',
      outputDir,
    ];

    const proc = spawn('java', args, { shell: true });

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
        log.error(`Structurizr CLI failed: ${stderr}`);
        reject(new Error(`Structurizr CLI exited with code ${code}`));
        return;
      }

      log.success('PlantUML export complete');
      if (stdout) log.info(stdout);
      resolve();
    });

    proc.on('error', (error) => {
      log.error(`Failed to spawn Structurizr CLI: ${error}`);
      reject(error);
    });
  });
}

/**
 * Render PlantUML files to images
 */
async function renderPlantUML(pumlDir: string, format: 'png' | 'svg' | 'both'): Promise<void> {
  log.info(`Rendering PlantUML diagrams to ${format}...`);

  // Check if PlantUML is available
  const plantumlPath = await checkPlantUML();

  // Get all .puml files
  const files = await readdir(pumlDir);
  const pumlFiles = files.filter((f) => f.endsWith('.puml'));

  if (pumlFiles.length === 0) {
    log.warn('No PlantUML files found to render');
    return;
  }

  log.info(`Found ${pumlFiles.length} PlantUML file(s)`);

  // Render each format
  const formats = format === 'both' ? ['png', 'svg'] : [format];

  for (const fmt of formats) {
    await renderFormat(plantumlPath, pumlDir, fmt);
  }

  log.success(`Rendered ${pumlFiles.length} diagram(s)`);
}

/**
 * Check if PlantUML is available
 */
async function checkPlantUML(): Promise<string> {
  // Try plantuml command first
  try {
    await execCommand('plantuml', ['-version']);
    return 'plantuml';
  } catch {
    // Fall back to checking for plantuml.jar
    const jarPath = join(process.cwd(), 'tools/plantuml.jar');
    if (existsSync(jarPath)) {
      log.info(`Using PlantUML JAR at: ${jarPath}`);
      return jarPath;
    }

    log.warn('PlantUML not found');
    log.info('Install via: npm install -g node-plantuml');
    log.info('Or download plantuml.jar to tools/plantuml.jar');
    throw new Error('PlantUML not available');
  }
}

/**
 * Render PlantUML files in a specific format
 */
async function renderFormat(plantumlPath: string, pumlDir: string, format: string): Promise<void> {
  const formatFlag = format === 'svg' ? '-tsvg' : '-tpng';

  const args = plantumlPath.endsWith('.jar')
    ? ['-jar', plantumlPath, formatFlag, `${pumlDir}/*.puml`]
    : [formatFlag, `${pumlDir}/*.puml`];

  const command = plantumlPath.endsWith('.jar') ? 'java' : plantumlPath;

  try {
    await execCommand(command, args);
    log.success(`Rendered ${format.toUpperCase()} diagrams`);
  } catch (error: any) {
    log.error(`Failed to render ${format}: ${error.message}`);
    throw error;
  }
}

/**
 * Execute a command and return output
 */
function execCommand(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { shell: true });

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
        reject(new Error(stderr || `Command exited with code ${code}`));
        return;
      }
      resolve(stdout);
    });

    proc.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Main rendering pipeline
 */
export async function renderDiagrams(options: RenderOptions): Promise<void> {
  const { rootPath, dslPath, outputDir, format } = options;

  // Ensure output directory exists
  await mkdir(outputDir, { recursive: true });

  // Check for Structurizr CLI
  const cliPath = await checkStructurizrCLI(rootPath);

  // Export DSL to PlantUML
  await exportToPlantUML(cliPath, dslPath, outputDir);

  // Render PlantUML to images
  await renderPlantUML(outputDir, format);
}

/**
 * CLI entry point
 */
export async function main() {
  const rootPath = process.cwd();
  const dslPath = join(rootPath, 'docs/architecture/workspace.dsl');
  const outputDir = join(rootPath, 'docs/architecture/diagrams');
  const format = (process.env.DIAGRAM_FORMAT as any) || 'both';

  try {
    log.info('Starting diagram rendering pipeline');
    log.info(`  DSL: ${dslPath}`);
    log.info(`  Output: ${outputDir}`);
    log.info(`  Format: ${format}`);

    await renderDiagrams({ rootPath, dslPath, outputDir, format });

    log.success('Diagram rendering complete!');
  } catch (error: any) {
    log.error(`Rendering failed: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  main();
}
