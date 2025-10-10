/**
 * Wrangler TOML Extractor - Extract deployment and binding metadata
 *
 * Parses wrangler.toml files to extract service bindings, environment variables,
 * and deployment configuration
 */

import { readFile } from 'fs/promises';
import { parse as parseToml } from '@iarna/toml';
import type {
  Relationship,
  PartialIR,
  ServiceBinding,
  EnvironmentVariable,
  DeploymentEnvironment,
  DeploymentNode,
} from '../../shared/types.js';
import { log } from '../../shared/utils.js';

export interface WranglerExtractorOptions {
  tomlPath: string;
  serviceId: string;
}

interface WranglerConfig {
  name: string;
  main?: string;
  services?: Array<{
    binding: string;
    service: string;
    environment?: string;
  }>;
  vars?: Record<string, string>;
  kv_namespaces?: Array<{
    binding: string;
    id?: string;
    preview_id?: string;
  }>;
  r2_buckets?: Array<{
    binding: string;
    bucket_name?: string;
    preview_bucket_name?: string;
  }>;
  durable_objects?: {
    bindings?: Array<{
      name: string;
      class_name: string;
      script_name?: string;
    }>;
  };
  routes?: Array<
    | string
    | {
        pattern: string;
        zone_name?: string;
      }
  >;
  env?: Record<string, WranglerConfig>;
}

export async function extractWranglerConfig(options: WranglerExtractorOptions): Promise<PartialIR> {
  const { tomlPath, serviceId } = options;

  log.info(`Extracting Wrangler config: ${tomlPath}`);

  // Read and parse TOML
  const content = await readFile(tomlPath, 'utf-8');
  const config = parseToml(content) as unknown as WranglerConfig;

  const relationships: Relationship[] = [];
  const bindings: ServiceBinding[] = [];
  const envVars: EnvironmentVariable[] = [];
  const deploymentEnvironments: DeploymentEnvironment[] = [];

  // Extract service bindings from production environment
  if (config.services) {
    for (const svcBinding of config.services) {
      // Extract service ID from worker name (e.g., "bond-math-daycount" -> "daycount")
      const targetServiceId = extractServiceId(svcBinding.service);

      // Add to bindings
      bindings.push({
        name: svcBinding.binding,
        target: targetServiceId,
      });

      // Add relationship
      relationships.push({
        source: serviceId,
        destination: targetServiceId,
        protocol: 'service-binding',
        authentication: 'internal-jwt',
        binding: svcBinding.binding,
      });
    }
  }

  // Extract environment variables
  if (config.vars) {
    for (const [name, value] of Object.entries(config.vars)) {
      envVars.push({
        name,
        description: `Configuration variable (default: ${value})`,
        required: false,
        secret: false,
      });
    }
  }

  // Extract deployment environments
  const environments: Array<'development' | 'preview' | 'production'> = ['production'];
  if (config.env?.development) environments.push('development');
  if (config.env?.preview) environments.push('preview');

  for (const envName of environments) {
    const envConfig = envName === 'production' ? config : config.env?.[envName];
    if (!envConfig) continue;

    const deploymentNode: DeploymentNode = {
      id: `${serviceId}-${envName}`,
      name: envConfig.name || config.name,
      type: 'container',
      technology: 'Cloudflare Workers',
      properties: {
        workerName: envConfig.name || config.name,
        routes: extractRoutes(envConfig.routes),
      },
      containerInstances: [serviceId],
    };

    // Add KV namespaces
    if (envConfig.kv_namespaces) {
      deploymentNode.properties!.kvNamespaces = envConfig.kv_namespaces.map((kv) => ({
        binding: kv.binding,
        namespaceId: envName === 'production' ? kv.id || '' : kv.preview_id || kv.id || '',
      }));
    }

    // Add R2 buckets
    if (envConfig.r2_buckets) {
      deploymentNode.properties!.r2Buckets = envConfig.r2_buckets.map((r2) => ({
        binding: r2.binding,
        bucketName:
          envName === 'production'
            ? r2.bucket_name || ''
            : r2.preview_bucket_name || r2.bucket_name || '',
      }));
    }

    // Add Durable Objects
    if (envConfig.durable_objects?.bindings) {
      deploymentNode.properties!.durableObjects = envConfig.durable_objects.bindings.map(
        (dobj) => ({
          binding: dobj.name,
          className: dobj.class_name,
        })
      );
    }

    deploymentEnvironments.push({
      name: envName,
      deploymentNodes: [deploymentNode],
    });
  }

  log.success(
    `Extracted ${relationships.length} relationship(s), ${deploymentEnvironments.length} environment(s)`
  );

  return {
    relationships,
    deploymentEnvironments,
  };
}

/**
 * Service name mapping (worker name -> service ID)
 */
const SERVICE_ID_MAP: Record<string, string> = {
  'bond-math-gateway': 'gateway',
  'bond-math-daycount': 'daycount',
  'bond-math-valuation': 'bond-valuation',
  'bond-math-metrics': 'metrics',
  'bond-math-pricing': 'pricing',
};

/**
 * Extract service ID from worker name
 * Example: "bond-math-gateway" -> "gateway"
 */
function extractServiceId(workerName: string): string {
  // Check mapping first
  if (SERVICE_ID_MAP[workerName]) {
    return SERVICE_ID_MAP[workerName];
  }

  // Fallback: Remove common prefixes
  const cleaned = workerName
    .replace(/^bond-math-/, '')
    .replace(/-dev$/, '')
    .replace(/-preview$/, '')
    .replace(/-production$/, '');

  return cleaned;
}

/**
 * Extract routes from wrangler config
 */
function extractRoutes(routes?: Array<string | { pattern: string; zone_name?: string }>): string[] {
  if (!routes) return [];

  return routes.map((route) => {
    if (typeof route === 'string') return route;
    return route.pattern;
  });
}

/**
 * CLI entry point
 */
export async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node wrangler.js <toml-path> <service-id>');
    process.exit(1);
  }

  const [tomlPath, serviceId] = args;
  const ir = await extractWranglerConfig({ tomlPath, serviceId });

  console.log(JSON.stringify(ir, null, 2));
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    log.error(error.message);
    process.exit(1);
  });
}
