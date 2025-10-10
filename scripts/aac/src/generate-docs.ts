import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import type { AACIR, Service, Component, Relationship, DeploymentEnvironment } from './types';

export async function generateDocs(irPath: string, outputDir: string): Promise<void> {
  console.log(`[INFO] Reading IR from ${irPath}`);
  const irContent = await readFile(irPath, 'utf-8');
  const ir: AACIR = JSON.parse(irContent);

  console.log(`[INFO] Generating markdown documentation in ${outputDir}`);

  // Ensure output directories exist
  await mkdir(outputDir, { recursive: true });
  const componentsDir = join(outputDir, 'components');
  await mkdir(componentsDir, { recursive: true });

  // Generate documentation files
  await generateIndexMd(ir, outputDir);
  await generateServicesMd(ir, outputDir);
  await generateComponentDocs(ir, componentsDir);

  console.log(`[SUCCESS] Generated architecture documentation`);
}

async function generateIndexMd(ir: AACIR, outputDir: string): Promise<void> {
  const filePath = join(outputDir, 'index.md');

  let content = `# Bond Math Architecture Documentation

> **Auto-generated from code** - Last updated: ${new Date().toISOString().split('T')[0]}

This documentation is automatically generated from code annotations and infrastructure-as-code configuration using the Architecture as Code (AAC) pipeline.

## Overview

Bond Math is a microservices-based fixed income calculation platform built on Cloudflare Workers. The system provides:

- **Day count calculations** - Authoritative year fraction calculations for fixed income instruments
- **Bond valuation** - Price ↔ yield conversions and cashflow generation
- **Risk metrics** - Duration, convexity, PV01, DV01 calculations
- **Pricing** - Curve-based discounting and present value calculations

## Architecture

The system follows a microservices architecture with:

- **${ir.services.length} services** deployed as Cloudflare Workers (${ir.services.filter((s) => s.type.includes('typescript')).length} TypeScript, ${ir.services.filter((s) => s.type.includes('python')).length} Python)
- **${ir.relationships.length} service-to-service relationships** using service bindings
- **${ir.deploymentEnvironments?.length || 0} deployment environments** (${ir.deploymentEnvironments?.map((e) => e.name).join(', ') || 'none'})

## Services

`;

  // Group services by layer
  const servicesByLayer = new Map<string, Service[]>();
  for (const service of ir.services) {
    const layer = service.layer || 'unknown';
    if (!servicesByLayer.has(layer)) {
      servicesByLayer.set(layer, []);
    }
    servicesByLayer.get(layer)!.push(service);
  }

  for (const [layer, services] of Array.from(servicesByLayer.entries()).sort()) {
    content += `\n### ${toTitleCase(layer)}\n\n`;
    for (const service of services.sort((a, b) => a.id.localeCompare(b.id))) {
      const tech = service.type.includes('typescript')
        ? 'TypeScript'
        : service.type.includes('python')
          ? 'Python'
          : 'Unknown';
      content += `- **[${service.name}](./components/${service.id}.md)** (${tech}) - ${service.description}\n`;
    }
  }

  content += `\n## Documentation

- **[Service Inventory](./services.md)** - Complete list of services with technical details
- **Component Details** - Per-service documentation:
`;

  for (const service of ir.services.sort((a, b) => a.id.localeCompare(b.id))) {
    content += `  - [${service.name}](./components/${service.id}.md)\n`;
  }

  content += `\n## Diagrams

The following C4 diagrams are automatically generated:

### System Context

High-level view of the entire system

![System Context Diagram](../diagrams/structurizr-SystemContext.png)

### Containers

All microservices and their relationships

![Containers Diagram](../diagrams/structurizr-Containers.png)

`;

  // List component diagrams that exist
  if (ir.components) {
    const serviceComponentCounts = new Map<string, number>();
    for (const comp of ir.components) {
      serviceComponentCounts.set(
        comp.serviceId,
        (serviceComponentCounts.get(comp.serviceId) || 0) + 1
      );
    }

    const servicesWithComponents = ir.services
      .filter((s) => serviceComponentCounts.get(s.id) && serviceComponentCounts.get(s.id)! > 0)
      .sort((a, b) => a.id.localeCompare(b.id));

    if (servicesWithComponents.length > 0) {
      content += `### Component Diagrams\n\nInternal structure of services:\n\n`;
      for (const service of servicesWithComponents) {
        content += `#### ${service.name} Components\n\n`;
        content += `![${service.name} Component Diagram](../diagrams/structurizr-Components_${service.id}.png)\n\n`;
      }
    }

    // Add class diagrams for TypeScript services
    const servicesWithClasses = ir.services
      .filter(
        (s) =>
          s.type.includes('typescript') &&
          serviceComponentCounts.get(s.id) &&
          serviceComponentCounts.get(s.id)! > 0
      )
      .sort((a, b) => a.id.localeCompare(b.id));

    if (servicesWithClasses.length > 0) {
      content += `### Class Diagrams\n\nDetailed UML diagrams showing properties, methods, and relationships:\n\n`;
      for (const service of servicesWithClasses) {
        content += `#### ${service.name} Classes\n\n`;
        content += `![${service.name} Class Diagram](../diagrams/class-diagram-${service.id}.png)\n\n`;
      }
    }
  }

  if (ir.deploymentEnvironments) {
    content += `### Deployment Diagrams\n\nInfrastructure topology:\n\n`;
    for (const env of ir.deploymentEnvironments.sort((a, b) => a.name.localeCompare(b.name))) {
      const envTitle = toTitleCase(env.name);
      content += `#### ${envTitle} Environment\n\n`;
      content += `![${envTitle} Deployment Diagram](../diagrams/structurizr-Deployment_${env.name}.png)\n\n`;
    }
  }

  content += `\n## How This Was Generated

This documentation is generated using the **Architecture as Code** pipeline:

1. **Extract** - Parse JSDoc/docstrings from TypeScript and Python code
2. **Extract** - Parse infrastructure configuration from wrangler.toml files
3. **Validate** - Verify against JSON schema and check relationships
4. **Generate DSL** - Create Structurizr DSL workspace
5. **Render** - Generate PlantUML diagrams (PNG/SVG)
6. **Generate Docs** - Create this markdown documentation

To regenerate:

\`\`\`bash
npm run docs:arch
\`\`\`

See [ADR-0001](../../adr/0001-architecture-as-code.md) for details on the AAC approach.
`;

  await writeFile(filePath, content, 'utf-8');
  console.log(`[SUCCESS] Generated ${filePath}`);
}

async function generateServicesMd(ir: AACIR, outputDir: string): Promise<void> {
  const filePath = join(outputDir, 'services.md');

  let content = `# Service Inventory

> **Auto-generated from code** - Last updated: ${new Date().toISOString().split('T')[0]}

Complete inventory of all services in the Bond Math architecture.

## Summary

| Service | Type | Layer | Description |
|---------|------|-------|-------------|
`;

  for (const service of ir.services.sort((a, b) => a.id.localeCompare(b.id))) {
    const tech = service.type.includes('typescript')
      ? 'TypeScript'
      : service.type.includes('python')
        ? 'Python'
        : service.type;
    const layer = toTitleCase(service.layer || 'unknown');
    content += `| [${service.name}](#${service.id}) | ${tech} | ${layer} | ${service.description} |\n`;
  }

  content += `\n## Service Details\n`;

  for (const service of ir.services.sort((a, b) => a.id.localeCompare(b.id))) {
    content += `\n### ${service.name} {#${service.id}}\n\n`;
    content += `**ID:** \`${service.id}\`  \n`;
    content += `**Type:** ${service.type}  \n`;
    content += `**Layer:** ${toTitleCase(service.layer || 'unknown')}  \n`;
    content += `\n${service.description}\n`;

    // Endpoints
    if (service.endpoints && service.endpoints.length > 0) {
      content += `\n**Endpoints:**\n\n`;
      for (const endpoint of service.endpoints) {
        content += `- \`${endpoint.method} ${endpoint.path}\`\n`;

        if (endpoint.authentication) {
          content += `  - **Auth:** ${endpoint.authentication}\n`;
        }
        if (endpoint.rateLimit) {
          content += `  - **Rate Limit:** ${endpoint.rateLimit}\n`;
        }
      }
    }

    // Dependencies
    const outgoing = ir.relationships.filter((r) => r.source === service.id);
    const incoming = ir.relationships.filter((r) => r.destination === service.id);

    if (outgoing.length > 0) {
      content += `\n**Dependencies (outgoing):**\n\n`;
      for (const rel of outgoing) {
        const target = ir.services.find((s) => s.id === rel.destination);
        content += `- ${target?.name || rel.destination} (\`${rel.protocol}\``;
        if (rel.authentication) {
          content += `, auth: ${rel.authentication}`;
        }
        content += `)\n`;
      }
    }

    if (incoming.length > 0) {
      content += `\n**Used by (incoming):**\n\n`;
      for (const rel of incoming) {
        const source = ir.services.find((s) => s.id === rel.source);
        content += `- ${source?.name || rel.source}\n`;
      }
    }

    // Configuration
    if (service.configuration) {
      if (service.configuration.environment && service.configuration.environment.length > 0) {
        content += `\n**Environment Variables:**\n\n`;
        for (const env of service.configuration.environment) {
          content += `- \`${env.name}\``;
          if (env.required) {
            content += ` (required)`;
          }
          if (env.description) {
            content += ` - ${env.description}`;
          }
          content += `\n`;
        }
      }

      if (service.configuration.bindings && service.configuration.bindings.length > 0) {
        content += `\n**Bindings:**\n\n`;
        for (const binding of service.configuration.bindings) {
          content += `- \`${binding.name}\` → ${binding.target}`;
          if (binding.purpose) {
            content += ` (${binding.purpose})`;
          }
          content += `\n`;
        }
      }
    }

    // Components
    if (ir.components) {
      const serviceComponents = ir.components.filter((c) => c.serviceId === service.id);
      const visibleComponents = serviceComponents.filter((c) => !c.excludeFromDiagram);
      if (visibleComponents.length > 0) {
        content += `\n**Components:** ${visibleComponents.length}\n\n`;
        content += `![${service.name} Component Diagram](../diagrams/structurizr-Components_${service.id}.png)\n`;
      }
    }

    content += `\n**[View detailed documentation →](./components/${service.id}.md)**\n`;
  }

  await writeFile(filePath, content, 'utf-8');
  console.log(`[SUCCESS] Generated ${filePath}`);
}

async function generateComponentDocs(ir: AACIR, componentsDir: string): Promise<void> {
  for (const service of ir.services.sort((a, b) => a.id.localeCompare(b.id))) {
    const filePath = join(componentsDir, `${service.id}.md`);

    let content = `# ${service.name}

> **Auto-generated from code** - Last updated: ${new Date().toISOString().split('T')[0]}

## Overview

**Service ID:** \`${service.id}\`
**Type:** ${service.type}
**Layer:** ${toTitleCase(service.layer || 'unknown')}

${service.description}

`;

    // Endpoints
    if (service.endpoints && service.endpoints.length > 0) {
      content += `## Endpoints\n\n`;
      for (const endpoint of service.endpoints) {
        content += `### \`${endpoint.method} ${endpoint.path}\`\n\n`;

        if (
          endpoint.authentication ||
          endpoint.scope ||
          endpoint.rateLimit ||
          endpoint.cacheable !== undefined
        ) {
          content += `**Configuration:**\n\n`;
          if (endpoint.authentication) {
            content += `- **Authentication:** ${endpoint.authentication}\n`;
          }
          if (endpoint.scope) {
            content += `- **Scope:** ${endpoint.scope}\n`;
          }
          if (endpoint.rateLimit) {
            content += `- **Rate Limit:** ${endpoint.rateLimit}\n`;
          }
          if (endpoint.cacheable !== undefined) {
            content += `- **Cacheable:** ${endpoint.cacheable ? 'Yes' : 'No'}`;
            if (endpoint.cacheable && endpoint.cacheTtl) {
              content += ` (TTL: ${endpoint.cacheTtl}s)`;
            }
            content += `\n`;
          }
          content += `\n`;
        }
      }
    }

    // Dependencies
    const outgoing = ir.relationships.filter((r) => r.source === service.id);
    const incoming = ir.relationships.filter((r) => r.destination === service.id);

    if (outgoing.length > 0 || incoming.length > 0) {
      content += `## Dependencies\n\n`;

      if (outgoing.length > 0) {
        content += `### Outgoing Dependencies\n\n`;
        content += `This service depends on:\n\n`;
        for (const rel of outgoing) {
          const target = ir.services.find((s) => s.id === rel.destination);
          content += `- **${target?.name || rel.destination}**\n`;
          content += `  - Protocol: \`${rel.protocol}\`\n`;
          if (rel.authentication) {
            content += `  - Authentication: ${rel.authentication}\n`;
          }
          if (rel.binding) {
            content += `  - Service Binding: \`${rel.binding}\`\n`;
          }
        }
        content += `\n`;
      }

      if (incoming.length > 0) {
        content += `### Incoming Dependencies\n\n`;
        content += `This service is used by:\n\n`;
        for (const rel of incoming) {
          const source = ir.services.find((s) => s.id === rel.source);
          content += `- **${source?.name || rel.source}**\n`;
        }
        content += `\n`;
      }
    }

    // Configuration
    if (service.configuration) {
      content += `## Configuration\n\n`;

      if (service.configuration.environment && service.configuration.environment.length > 0) {
        content += `### Environment Variables\n\n`;
        content += `| Variable | Required | Description |\n`;
        content += `|----------|----------|-------------|\n`;
        for (const env of service.configuration.environment) {
          const required = env.required ? 'Yes' : 'No';
          const desc = env.description || '-';
          content += `| \`${env.name}\` | ${required} | ${desc} |\n`;
        }
        content += `\n`;
      }

      if (service.configuration.bindings && service.configuration.bindings.length > 0) {
        content += `### Bindings\n\n`;
        content += `| Name | Target | Purpose |\n`;
        content += `|------|--------|----------|\n`;
        for (const binding of service.configuration.bindings) {
          const target = binding.target || '-';
          const purpose = binding.purpose || '-';
          content += `| \`${binding.name}\` | ${target} | ${purpose} |\n`;
        }
        content += `\n`;
      }
    }

    // Components
    if (ir.components) {
      const serviceComponents = ir.components.filter((c) => c.serviceId === service.id);
      const visibleComponents = serviceComponents.filter((c) => !c.excludeFromDiagram);
      const excludedComponents = serviceComponents.filter((c) => c.excludeFromDiagram);

      if (visibleComponents.length > 0) {
        content += `## Components\n\n`;
        content += `This service contains ${visibleComponents.length} component(s):\n\n`;
        content += `### Component Diagram\n\n`;
        content += `High-level component relationships:\n\n`;
        content += `![${service.name} Component Diagram](../../diagrams/structurizr-Components_${service.id}.png)\n\n`;

        // Add class diagram for TypeScript and Python services
        if (service.type.includes('typescript') || service.type.includes('python')) {
          content += `### Class Diagram\n\n`;
          content += `Detailed UML class diagram showing properties, methods, and relationships:\n\n`;
          content += `![${service.name} Class Diagram](../../diagrams/class-diagram-${service.id}.png)\n\n`;
        }

        // Group by type
        const componentsByType = new Map<string, Component[]>();
        for (const comp of visibleComponents) {
          const type = comp.type || 'unknown';
          if (!componentsByType.has(type)) {
            componentsByType.set(type, []);
          }
          componentsByType.get(type)!.push(comp);
        }

        for (const [type, components] of Array.from(componentsByType.entries()).sort()) {
          content += `### ${toTitleCase(type)}s\n\n`;
          for (const comp of components.sort((a: Component, b: Component) =>
            a.id.localeCompare(b.id)
          )) {
            content += `#### ${comp.name || comp.id}\n\n`;
            if (comp.description) {
              content += `${comp.description}\n\n`;
            }
          }
        }
      }

      if (excludedComponents.length > 0) {
        content += `### Excluded Components\n\n`;
        content += `The following ${excludedComponents.length} component(s) are excluded from diagrams (utilities, DTOs, etc.):\n\n`;
        for (const comp of excludedComponents.sort((a: Component, b: Component) =>
          a.id.localeCompare(b.id)
        )) {
          content += `- ${comp.name || comp.id}`;
          if (comp.type) {
            content += ` (${comp.type})`;
          }
          content += `\n`;
        }
        content += `\n`;
      }
    }

    // Deployment
    if (ir.deploymentEnvironments) {
      content += `## Deployment\n\n`;

      const envsWithService = ir.deploymentEnvironments
        .filter((env) =>
          env.deploymentNodes.some((n) => n.containerInstances?.includes(service.id))
        )
        .sort((a, b) => a.name.localeCompare(b.name));

      for (const env of envsWithService) {
        const envTitle = toTitleCase(env.name);
        content += `### ${envTitle} Environment\n\n`;

        const nodes = env.deploymentNodes.filter((n) => n.containerInstances?.includes(service.id));

        for (const node of nodes) {
          content += `- **${node.name}**`;
          if (node.technology) {
            content += ` (${node.technology})`;
          }
          content += `\n`;

          if (node.properties) {
            const props = node.properties as any;
            if (props.routes && props.routes.length > 0) {
              content += `  - Routes: ${props.routes.join(', ')}\n`;
            }
            if (props.customDomains && props.customDomains.length > 0) {
              content += `  - Custom Domains: ${props.customDomains.join(', ')}\n`;
            }
          }
        }

        content += `\n![${envTitle} Deployment Diagram](../../diagrams/structurizr-Deployment_${env.name}.png)\n\n`;
      }
    }

    content += `---

[← Back to Service Inventory](../services.md) | [Architecture Overview](../index.md)
`;

    await writeFile(filePath, content, 'utf-8');
  }

  console.log(`[SUCCESS] Generated ${ir.services.length} component documentation files`);
}

function toTitleCase(str: string): string {
  return str
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
