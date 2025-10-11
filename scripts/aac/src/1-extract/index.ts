/**
 * Main extraction orchestrator
 *
 * Coordinates all extractors to generate the complete AAC IR
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import type {
  AACIR,
  Component,
  ComponentRelationship,
  Relationship,
  Service,
} from '../shared/types.js';
import {
  log,
  savePartialIR,
  sortComponentRelationships,
  sortComponents,
  sortRelationships,
  sortServices,
} from '../shared/utils.js';
import { extractPythonService } from './extractors/python.js';
import { extractTypeScriptService } from './extractors/typescript.js';
import { extractWranglerConfig } from './extractors/wrangler.js';

interface ServiceConfig {
  id: string;
  type: 'typescript' | 'python';
  servicePath: string;
  wranglerToml: string;
}

export async function extractAll(rootPath: string): Promise<AACIR> {
  log.info('Starting AAC extraction pipeline');

  // Define services to extract
  const services: ServiceConfig[] = [
    {
      id: 'gateway',
      type: 'typescript',
      servicePath: join(rootPath, 'services/gateway'),
      wranglerToml: join(rootPath, 'iac/workers/gateway.toml'),
    },
    {
      id: 'daycount',
      type: 'typescript',
      servicePath: join(rootPath, 'services/daycount'),
      wranglerToml: join(rootPath, 'iac/workers/daycount.toml'),
    },
    {
      id: 'bond-valuation',
      type: 'python',
      servicePath: join(rootPath, 'services/bond-valuation'),
      wranglerToml: join(rootPath, 'iac/workers/valuation.toml'),
    },
    {
      id: 'metrics',
      type: 'python',
      servicePath: join(rootPath, 'services/metrics'),
      wranglerToml: join(rootPath, 'iac/workers/metrics.toml'),
    },
    {
      id: 'pricing',
      type: 'python',
      servicePath: join(rootPath, 'services/pricing'),
      wranglerToml: join(rootPath, 'iac/workers/pricing.toml'),
    },
  ];

  // Extract from all services
  const allServices: Service[] = [];
  const allRelationships: Relationship[] = [];
  const allComponents: Component[] = [];
  const allComponentRelationships: ComponentRelationship[] = [];
  const allDeploymentEnvironments: any[] = [];

  for (const svc of services) {
    log.info(`Processing service: ${svc.id}`);

    // Extract from source code
    if (svc.type === 'typescript') {
      const tsResult = await extractTypeScriptService({
        servicePath: svc.servicePath,
        serviceId: svc.id,
      });

      if (tsResult.services) allServices.push(...tsResult.services);
      if (tsResult.components) allComponents.push(...tsResult.components);
      if (tsResult.componentRelationships)
        allComponentRelationships.push(...tsResult.componentRelationships);
    } else if (svc.type === 'python') {
      const pyResult = await extractPythonService({
        servicePath: svc.servicePath,
        serviceId: svc.id,
      });

      if (pyResult.services) allServices.push(...pyResult.services);
      if (pyResult.components) allComponents.push(...pyResult.components);
      if (pyResult.componentRelationships)
        allComponentRelationships.push(...pyResult.componentRelationships);
    }

    // Extract from Wrangler config
    const wranglerResult = await extractWranglerConfig({
      tomlPath: svc.wranglerToml,
      serviceId: svc.id,
    });

    if (wranglerResult.relationships) allRelationships.push(...wranglerResult.relationships);
    if (wranglerResult.deploymentEnvironments)
      allDeploymentEnvironments.push(...wranglerResult.deploymentEnvironments);
  }

  // Merge deployment environments by name
  const mergedDeployments = mergeDeploymentEnvironments(allDeploymentEnvironments);

  // Load project metadata from package.json
  const packageJson = JSON.parse(await readFile(join(rootPath, 'package.json'), 'utf-8'));

  // Build final IR
  const ir: AACIR = {
    version: '1.0',
    project: {
      name: packageJson.name || 'bond-math',
      description: packageJson.description || 'Multi-language serverless microservices system',
      repository: packageJson.repository?.url,
    },
    services: sortServices(allServices),
    relationships: sortRelationships(allRelationships),
    components: sortComponents(allComponents),
    componentRelationships: sortComponentRelationships(allComponentRelationships),
    deploymentEnvironments: mergedDeployments,
  };

  log.success(`Extraction complete!`);
  log.info(`  Services: ${ir.services.length}`);
  log.info(`  Relationships: ${ir.relationships.length}`);
  log.info(`  Components: ${ir.components?.length || 0}`);
  log.info(`  Component Relationships: ${ir.componentRelationships?.length || 0}`);
  log.info(`  Deployment Environments: ${ir.deploymentEnvironments?.length || 0}`);

  return ir;
}

/**
 * Merge deployment environments from multiple sources
 */
function mergeDeploymentEnvironments(envs: any[]): any[] {
  const merged = new Map<string, any>();

  for (const env of envs) {
    if (!merged.has(env.name)) {
      merged.set(env.name, {
        name: env.name,
        deploymentNodes: [],
      });
    }

    const existing = merged.get(env.name);
    existing.deploymentNodes.push(...env.deploymentNodes);
  }

  // Sort by environment name
  return Array.from(merged.values()).sort((a, b) => {
    const order = ['development', 'preview', 'staging', 'production'];
    return order.indexOf(a.name) - order.indexOf(b.name);
  });
}

/**
 * CLI entry point
 */
export async function main() {
  const rootPath = process.cwd();
  const outputPath = join(rootPath, 'docs/architecture/ir.json');

  try {
    const ir = await extractAll(rootPath);
    await savePartialIR(outputPath, ir);
    log.success(`IR saved to: ${outputPath}`);
  } catch (error: any) {
    log.error(`Extraction failed: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  main();
}
