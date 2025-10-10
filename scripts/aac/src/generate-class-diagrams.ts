/**
 * PlantUML Class Diagram Generator
 *
 * Generates detailed UML class diagrams (one per service) showing:
 * - Classes and interfaces
 * - Properties with types
 * - Methods with signatures
 * - Relationships (extends, implements, uses)
 */

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import type { AACIR, Component, ComponentRelationship } from './types.js';
import { loadJSON, log } from './utils.js';

export async function generateClassDiagrams(ir: AACIR, outputDir: string): Promise<void> {
  if (!ir.components || ir.components.length === 0) {
    log.info('No components found, skipping class diagram generation');
    return;
  }

  // Ensure output directory exists
  await mkdir(outputDir, { recursive: true });

  // Group components by service
  const componentsByService = new Map<string, Component[]>();
  for (const component of ir.components) {
    if (component.excludeFromDiagram) continue;

    if (!componentsByService.has(component.serviceId)) {
      componentsByService.set(component.serviceId, []);
    }
    componentsByService.get(component.serviceId)!.push(component);
  }

  // Generate one class diagram per service
  let count = 0;
  for (const [serviceId, components] of componentsByService) {
    const service = ir.services.find((s) => s.id === serviceId);
    if (!service) continue;

    const diagram = generateClassDiagramForService(
      service.name,
      components,
      ir.componentRelationships || []
    );

    const filename = `class-diagram-${serviceId}.puml`;
    const filepath = join(outputDir, filename);
    await writeFile(filepath, diagram, 'utf-8');
    log.info(`  Generated ${filename}`);
    count++;
  }

  log.success(`Generated ${count} class diagram(s)`);
}

function generateClassDiagramForService(
  serviceName: string,
  components: Component[],
  allRelationships: ComponentRelationship[]
): string {
  const lines: string[] = [];

  lines.push('@startuml');
  lines.push(`title ${serviceName} - Class Diagram`);
  lines.push('');
  lines.push('skinparam classAttributeIconSize 0');
  lines.push('skinparam linetype ortho');
  lines.push('');

  // Generate classes, interfaces, and modules
  for (const component of components.sort((a, b) => a.name!.localeCompare(b.name!))) {
    if (component.type === 'interface') {
      generateInterface(lines, component);
    } else if (component.type === 'class') {
      generateClass(lines, component);
    } else if (component.type === 'module') {
      generateModule(lines, component);
    }
    lines.push('');
  }

  // Generate relationships
  const componentIds = new Set(components.map((c) => c.id));
  const relationships = allRelationships.filter(
    (r) => componentIds.has(r.source) && componentIds.has(r.destination)
  );

  if (relationships.length > 0) {
    lines.push("' Relationships");
    for (const rel of relationships) {
      const sourceName = getComponentName(rel.source);
      const destName = getComponentName(rel.destination);

      switch (rel.technology) {
        case 'Extends':
          lines.push(`${sourceName} --|> ${destName}`);
          break;
        case 'Implements':
          lines.push(`${sourceName} ..|> ${destName}`);
          break;
        case 'Uses':
          lines.push(`${sourceName} ..> ${destName} : uses`);
          break;
        default:
          lines.push(`${sourceName} --> ${destName}`);
      }
    }
  }

  lines.push('');
  lines.push('@enduml');

  return lines.join('\n');
}

function generateInterface(lines: string[], component: Component): void {
  const name = component.name || component.id.split('.').pop() || component.id;
  const stereotype = component.stereotype ? ` <<${component.stereotype}>>` : '';

  lines.push(`interface ${name}${stereotype} {`);

  // Properties
  if (component.properties && component.properties.length > 0) {
    for (const prop of component.properties) {
      const optional = prop.isOptional ? '?' : '';
      const readonly = prop.isReadonly ? '{readonly} ' : '';
      lines.push(`  ${readonly}${prop.name}${optional}: ${simplifyType(prop.type)}`);
    }
  }

  // Methods
  if (component.methods && component.methods.length > 0) {
    if (component.properties && component.properties.length > 0) {
      lines.push('  --');
    }
    for (const method of component.methods) {
      const params =
        method.parameters
          ?.map((p) => `${p.name}${p.isOptional ? '?' : ''}: ${simplifyType(p.type)}`)
          .join(', ') || '';
      const returnType = method.returnType ? `: ${simplifyType(method.returnType)}` : '';
      const async = method.isAsync ? 'async ' : '';
      lines.push(`  ${async}${method.name}(${params})${returnType}`);
    }
  }

  lines.push('}');

  if (component.description) {
    lines.push(`note right of ${name}`);
    lines.push(`  ${component.description}`);
    lines.push(`end note`);
  }
}

function generateClass(lines: string[], component: Component): void {
  const name = component.name || component.id.split('.').pop() || component.id;
  const stereotype = component.stereotype ? ` <<${component.stereotype}>>` : '';

  lines.push(`class ${name}${stereotype} {`);

  // Properties
  if (component.properties && component.properties.length > 0) {
    for (const prop of component.properties) {
      const visibility = getVisibilitySymbol(prop.visibility);
      const optional = prop.isOptional ? '?' : '';
      const readonly = prop.isReadonly ? '{readonly} ' : '';
      lines.push(`  ${visibility}${readonly}${prop.name}${optional}: ${simplifyType(prop.type)}`);
    }
  }

  // Methods
  if (component.methods && component.methods.length > 0) {
    if (component.properties && component.properties.length > 0) {
      lines.push('  --');
    }
    for (const method of component.methods) {
      const visibility = getVisibilitySymbol(method.visibility);
      const params =
        method.parameters
          ?.map((p) => `${p.name}${p.isOptional ? '?' : ''}: ${simplifyType(p.type)}`)
          .join(', ') || '';
      const returnType = method.returnType ? `: ${simplifyType(method.returnType)}` : '';
      const async = method.isAsync ? 'async ' : '';
      lines.push(`  ${visibility}${async}${method.name}(${params})${returnType}`);
    }
  }

  lines.push('}');

  if (component.description) {
    lines.push(`note right of ${name}`);
    lines.push(`  ${component.description}`);
    lines.push(`end note`);
  }
}

function generateModule(lines: string[], component: Component): void {
  const name = component.name || component.id.split('.').pop() || component.id;
  const stereotype = component.stereotype ? ` <<${component.stereotype}>>` : '';

  lines.push(`class ${name}${stereotype} {`);

  // Functions as static methods
  if (component.functions && component.functions.length > 0) {
    for (const func of component.functions) {
      const params =
        func.parameters
          ?.map((p) => `${p.name}${p.isOptional ? '?' : ''}: ${simplifyType(p.type)}`)
          .join(', ') || '';
      const returnType = func.returnType ? `: ${simplifyType(func.returnType)}` : '';
      const async = func.isAsync ? 'async ' : '';
      const purity = func.stereotype === 'pure' ? '{static} ' : '{static} ';
      const exported = func.isExported ? '+' : '-';
      lines.push(`  ${exported}${purity}${async}${func.name}(${params})${returnType}`);
    }
  }

  lines.push('}');

  if (component.description) {
    lines.push(`note right of ${name}`);
    lines.push(`  ${component.description}`);
    if (component.stereotype) {
      lines.push(`  `);
      lines.push(`  Stereotype: <<${component.stereotype}>>`);
    }
    lines.push(`end note`);
  }
}

function getVisibilitySymbol(visibility?: string): string {
  switch (visibility) {
    case 'private':
      return '-';
    case 'protected':
      return '#';
    case 'public':
    default:
      return '+';
  }
}

function getComponentName(componentId: string): string {
  const parts = componentId.split('.');
  return parts[parts.length - 1] || componentId;
}

function simplifyType(type: string): string {
  // Remove overly verbose type information for cleaner diagrams
  type = type.replace(/import\([^)]+\)\./g, '');

  // Truncate very long union types
  if (type.length > 50 && type.includes('|')) {
    const parts = type.split('|');
    if (parts.length > 3) {
      return parts.slice(0, 2).join('|') + ' | ...';
    }
  }

  // Truncate very long types
  if (type.length > 80) {
    return type.substring(0, 77) + '...';
  }

  return type;
}

/**
 * CLI entry point
 */
export async function main() {
  const rootPath = process.cwd();
  const irPath = join(rootPath, 'docs/architecture/ir.json');
  const outputDir = join(rootPath, 'docs/architecture/diagrams');

  try {
    log.info('Generating PlantUML class diagrams');

    // Load IR
    const ir = await loadJSON<AACIR>(irPath);

    // Generate class diagrams
    await generateClassDiagrams(ir, outputDir);

    log.success('Class diagram generation complete');
  } catch (error: any) {
    log.error(`Class diagram generation failed: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  main();
}
