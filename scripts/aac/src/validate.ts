/**
 * IR Validator - Validate AAC IR against JSON Schema
 *
 * Ensures the generated IR conforms to the schema specification
 */

import Ajv from 'ajv';
import { join } from 'path';
import type { AACIR } from './types.js';
import { loadJSON, log } from './utils.js';

export async function validateIR(irPath: string, schemaPath: string): Promise<boolean> {
  log.info('Validating IR against schema');

  // Load IR and schema
  const ir = await loadJSON<AACIR>(irPath);
  const schema = await loadJSON(schemaPath);

  // Create AJV instance
  const ajv = new Ajv({
    allErrors: true,
    verbose: true,
  });

  // Compile schema
  const validate = ajv.compile(schema as any);

  // Validate IR
  const valid = validate(ir);

  if (valid) {
    log.success('IR validation passed!');
    return true;
  } else {
    log.error('IR validation failed:');

    if (validate.errors) {
      for (const error of validate.errors) {
        const path = error.instancePath || '(root)';
        const message = error.message || 'Unknown error';
        log.error(`  ${path}: ${message}`);

        if (error.params) {
          log.error(`    Params: ${JSON.stringify(error.params)}`);
        }
      }
    }

    return false;
  }
}

/**
 * Validate relationships (no circular dependencies, valid service references)
 */
export function validateRelationships(ir: AACIR): boolean {
  log.info('Validating relationships');

  const serviceIds = new Set(ir.services.map((s) => s.id));
  let hasErrors = false;

  // Check all relationships reference valid services
  for (const rel of ir.relationships) {
    if (!serviceIds.has(rel.source)) {
      log.error(`Relationship references unknown source service: ${rel.source}`);
      hasErrors = true;
    }

    if (!serviceIds.has(rel.destination)) {
      log.error(`Relationship references unknown destination service: ${rel.destination}`);
      hasErrors = true;
    }
  }

  // Check for circular dependencies
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function detectCycle(serviceId: string): boolean {
    visited.add(serviceId);
    recursionStack.add(serviceId);

    // Get all dependencies
    const deps = ir.relationships.filter((r) => r.source === serviceId).map((r) => r.destination);

    for (const dep of deps) {
      if (!visited.has(dep)) {
        if (detectCycle(dep)) return true;
      } else if (recursionStack.has(dep)) {
        log.error(`Circular dependency detected: ${serviceId} -> ${dep}`);
        return true;
      }
    }

    recursionStack.delete(serviceId);
    return false;
  }

  for (const service of ir.services) {
    if (!visited.has(service.id)) {
      if (detectCycle(service.id)) {
        hasErrors = true;
      }
    }
  }

  if (!hasErrors) {
    log.success('Relationship validation passed!');
  }

  return !hasErrors;
}

/**
 * CLI entry point
 */
export async function main() {
  const rootPath = process.cwd();
  const irPath = join(rootPath, 'docs/architecture/ir.json');
  const schemaPath = join(rootPath, 'schemas/aac-ir.json');

  try {
    // Validate against schema
    const schemaValid = await validateIR(irPath, schemaPath);

    // Load IR for relationship validation
    const ir = await loadJSON<AACIR>(irPath);
    const relValid = validateRelationships(ir);

    if (schemaValid && relValid) {
      log.success('All validations passed!');
      process.exit(0);
    } else {
      log.error('Validation failed');
      process.exit(1);
    }
  } catch (error: any) {
    log.error(`Validation error: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  main();
}
