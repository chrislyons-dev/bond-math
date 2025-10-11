/**
 * Structurizr DSL Generator - Convert AAC IR to Structurizr DSL
 *
 * Generates workspace.dsl file with C4 model and views
 */

import { join } from 'path';
import { writeFile, mkdir } from 'fs/promises';
import type { AACIR, Service, Component } from '../shared/types.js';
import {
  DSLBuilder,
  toIdentifier,
  formatDescription,
  getTechnology,
  getServiceTags,
} from './dsl-builder.js';
import { loadJSON, log } from '../shared/utils.js';

export async function generateStructurizrDSL(ir: AACIR): Promise<string> {
  const dsl = new DSLBuilder();

  // Workspace header
  dsl.add(`workspace "${ir.project.name}" "Architecture as Code generated workspace" {`);
  dsl.indent();
  dsl.blank();

  // Model section
  generateModel(dsl, ir);
  dsl.blank();

  // Views section
  generateViews(dsl, ir);
  dsl.blank();

  dsl.dedent();
  dsl.add('}');

  return dsl.build();
}

/**
 * Generate the model section
 */
function generateModel(dsl: DSLBuilder, ir: AACIR): void {
  dsl.block('model', () => {
    // Add external actors
    dsl.comment('External actors');
    dsl.add('user = person "User" "End user accessing the bond calculation system"');
    dsl.add('auth0 = softwareSystem "Auth0" "OAuth2/OIDC identity provider" "External"');
    dsl.add(
      'cloudflare = softwareSystem "Cloudflare Platform" "Edge computing platform" "External"'
    );
    dsl.blank();

    // Main software system
    dsl.comment('Bond Math System');
    dsl.block(`bondMath = softwareSystem "${ir.project.name}"`, () => {
      dsl.add(`description "${formatDescription(ir.project.description)}"`);
      dsl.blank();

      // Add all services as containers
      dsl.comment('Services (Containers)');
      for (const service of ir.services) {
        generateContainer(dsl, service, ir);
      }
      dsl.blank();

      // Add relationships between containers
      dsl.comment('Service-to-service relationships');
      for (const rel of ir.relationships) {
        const source = toIdentifier(rel.source);
        const dest = toIdentifier(rel.destination);
        const protocol = rel.protocol === 'service-binding' ? 'Service Binding' : rel.protocol;
        const auth = rel.authentication ? ` (${rel.authentication})` : '';

        dsl.add(`${source} -> ${dest} "Uses" "${protocol}${auth}"`);
      }
    });
    dsl.blank();

    // User relationships
    dsl.comment('User interactions');
    dsl.add('user -> ui "Uses" "HTTPS"');
    dsl.add('user -> auth0 "Authenticates with" "OAuth2/OIDC"');
    dsl.blank();

    // System relationships
    dsl.comment('System integrations');
    dsl.add('bondMath -> auth0 "Verifies tokens" "HTTPS"');
    dsl.add('cloudflare -> bondMath "Hosts" "Cloudflare Workers"');
    dsl.blank();

    // Deployment environments
    if (ir.deploymentEnvironments && ir.deploymentEnvironments.length > 0) {
      dsl.comment('Deployment environments');
      for (const env of ir.deploymentEnvironments) {
        generateDeploymentModel(dsl, env, ir);
      }
    }
  });
}

/**
 * Generate deployment environment model
 */
function generateDeploymentModel(dsl: DSLBuilder, env: any, ir: AACIR): void {
  const envName = env.name.charAt(0).toUpperCase() + env.name.slice(1);

  dsl.block(`deploymentEnvironment "${envName}"`, () => {
    for (const node of env.deploymentNodes) {
      dsl.block(`deploymentNode "${node.name}"`, () => {
        if (node.technology) {
          dsl.add(`technology "${node.technology}"`);
        }

        // Add container instances
        if (node.containerInstances && node.containerInstances.length > 0) {
          for (const instanceId of node.containerInstances) {
            const containerId = toIdentifier(instanceId);
            dsl.add(`containerInstance ${containerId}`);
          }
        }
      });
    }
  });
}

/**
 * Generate a container (service) definition
 */
function generateContainer(dsl: DSLBuilder, service: Service, ir: AACIR): void {
  const id = toIdentifier(service.id);
  const name = service.name;
  const description = formatDescription(service.description);
  const technology = getTechnology(service.type);
  const tags = getServiceTags(service);

  dsl.block(`${id} = container "${name}"`, () => {
    dsl.add(`description "${description}"`);
    dsl.add(`technology "${technology}"`);

    if (tags.length > 0) {
      dsl.add(`tags "${tags.join(',')}"`);
    }

    // Add components if this service has them
    const components =
      ir.components?.filter((c) => c.serviceId === service.id && !c.excludeFromDiagram) || [];

    if (components.length > 0) {
      dsl.blank();
      dsl.comment('Components');
      for (const component of components) {
        generateComponent(dsl, component, service);
      }

      // Add component relationships
      const componentRelationships =
        ir.componentRelationships?.filter(
          (r) =>
            components.some((c) => c.id === r.source) &&
            components.some((c) => c.id === r.destination)
        ) || [];

      if (componentRelationships.length > 0) {
        dsl.blank();
        dsl.comment('Component relationships');
        for (const rel of componentRelationships) {
          const sourceId = toIdentifier(rel.source.replace(/\./g, '_'));
          const destId = toIdentifier(rel.destination.replace(/\./g, '_'));
          const technology = rel.technology || 'Uses';
          dsl.add(`${sourceId} -> ${destId} "${technology}"`);
        }
      }
    }
  });
}

/**
 * Generate a component definition
 */
function generateComponent(dsl: DSLBuilder, component: Component, service: Service): void {
  // Replace dots with underscores for valid identifiers
  const componentId = toIdentifier(component.id.replace(/\./g, '_'));
  const componentName = component.name || component.id.split('.').pop() || component.id;
  const description = formatDescription(component.description);

  // Determine technology based on component type and service type
  let technology = '';
  if (service.type.includes('typescript')) {
    technology = component.type === 'class' ? 'TypeScript Class' : 'TypeScript Interface';
  } else if (service.type.includes('python')) {
    technology = component.type === 'class' ? 'Python Class' : 'Python Module';
  } else {
    technology = component.type;
  }

  dsl.block(`${componentId} = component "${componentName}"`, () => {
    if (description) {
      dsl.add(`description "${description}"`);
    }
    dsl.add(`technology "${technology}"`);
  });
}

/**
 * Generate the views section
 */
function generateViews(dsl: DSLBuilder, ir: AACIR): void {
  dsl.block('views', () => {
    // System Context view
    generateSystemContextView(dsl, ir);
    dsl.blank();

    // Container view
    generateContainerView(dsl, ir);
    dsl.blank();

    // Component views (one per service with components)
    generateComponentViews(dsl, ir);
    dsl.blank();

    // Deployment views
    generateDeploymentViews(dsl, ir);
    dsl.blank();

    // Styles
    generateStyles(dsl);
  });
}

/**
 * Generate system context view
 */
function generateSystemContextView(dsl: DSLBuilder, ir: AACIR): void {
  dsl.block('systemContext bondMath "SystemContext"', () => {
    dsl.add('include *');
    dsl.add('autoLayout');
    dsl.add('description "System context diagram for Bond Math system"');
    dsl.add('title "Bond Math - System Context"');
  });
}

/**
 * Generate container view
 */
function generateContainerView(dsl: DSLBuilder, ir: AACIR): void {
  dsl.block('container bondMath "Containers"', () => {
    dsl.add('include *');
    dsl.add('autoLayout');
    dsl.add('description "Container diagram showing all microservices"');
    dsl.add('title "Bond Math - Containers"');
  });
}

/**
 * Generate component views for services with components
 */
function generateComponentViews(dsl: DSLBuilder, ir: AACIR): void {
  if (!ir.components || ir.components.length === 0) return;

  // Group components by service
  const componentsByService = new Map<string, Component[]>();
  for (const component of ir.components) {
    if (component.excludeFromDiagram) continue;

    if (!componentsByService.has(component.serviceId)) {
      componentsByService.set(component.serviceId, []);
    }
    componentsByService.get(component.serviceId)!.push(component);
  }

  // Generate a component view for each service
  for (const [serviceId, components] of componentsByService) {
    if (components.length === 0) continue;

    const containerId = toIdentifier(serviceId);
    const service = ir.services.find((s) => s.id === serviceId);
    const serviceName = service?.name || serviceId;

    dsl.block(`component ${containerId} "Components_${containerId}"`, () => {
      dsl.add('include *');
      dsl.add('autoLayout');
      dsl.add(`description "Component diagram for ${serviceName}"`);
      dsl.add(`title "${serviceName} - Components"`);
    });
  }
}

/**
 * Generate deployment views
 */
function generateDeploymentViews(dsl: DSLBuilder, ir: AACIR): void {
  if (!ir.deploymentEnvironments || ir.deploymentEnvironments.length === 0) return;

  for (const env of ir.deploymentEnvironments) {
    const envName = env.name.charAt(0).toUpperCase() + env.name.slice(1);

    dsl.block(`deployment * "${envName}" "Deployment_${env.name}"`, () => {
      dsl.add('include *');
      dsl.add('autoLayout');
      dsl.add(`description "Deployment diagram for ${envName} environment"`);
      dsl.add(`title "Bond Math - ${envName} Deployment"`);
    });

    if (env !== ir.deploymentEnvironments[ir.deploymentEnvironments.length - 1]) {
      dsl.blank();
    }
  }
}

/**
 * Generate styles section
 */
function generateStyles(dsl: DSLBuilder): void {
  dsl.block('styles', () => {
    // External systems
    dsl.block('element "External"', () => {
      dsl.add('background #999999');
      dsl.add('color #ffffff');
    });
    dsl.blank();

    // API Gateway
    dsl.block('element "API Gateway"', () => {
      dsl.add('background #FF6B35');
      dsl.add('color #ffffff');
    });
    dsl.blank();

    // Business Logic
    dsl.block('element "Business Logic"', () => {
      dsl.add('background #004E89');
      dsl.add('color #ffffff');
    });
    dsl.blank();

    // TypeScript services
    dsl.block('element "TypeScript"', () => {
      dsl.add('background #3178C6');
      dsl.add('color #ffffff');
    });
    dsl.blank();

    // Python services
    dsl.block('element "Python"', () => {
      dsl.add('background #3776AB');
      dsl.add('color #ffffff');
    });
    dsl.blank();

    // Person
    dsl.block('element "Person"', () => {
      dsl.add('shape Person');
      dsl.add('background #08457E');
      dsl.add('color #ffffff');
    });
  });
}

/**
 * CLI entry point
 */
export async function main() {
  const rootPath = process.cwd();
  const irPath = join(rootPath, 'docs/architecture/ir.json');
  const outputPath = join(rootPath, 'docs/architecture/workspace.dsl');

  try {
    log.info('Generating Structurizr DSL');

    // Load IR
    const ir = await loadJSON<AACIR>(irPath);

    // Generate DSL
    const dsl = await generateStructurizrDSL(ir);

    // Ensure output directory exists
    await mkdir(join(rootPath, 'docs/architecture'), { recursive: true });

    // Write DSL file
    await writeFile(outputPath, dsl, 'utf-8');

    log.success(`Structurizr DSL generated: ${outputPath}`);
    log.info(`  System: ${ir.project.name}`);
    log.info(`  Services: ${ir.services.length}`);
    log.info(`  Relationships: ${ir.relationships.length}`);
  } catch (error: any) {
    log.error(`DSL generation failed: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  main();
}
