import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import nunjucks from 'nunjucks';
import type { AACIR, Service, Component, Relationship, DeploymentEnvironment } from '../shared/types.js';

// Configure Nunjucks
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const templatesDir = join(__dirname, '..', '..', 'templates');
const env = nunjucks.configure(templatesDir, {
  autoescape: false,
  trimBlocks: true,
  lstripBlocks: true,
});

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

  // Group services by layer
  const servicesByLayer = new Map<string, Service[]>();
  for (const service of ir.services) {
    const layer = service.layer || 'unknown';
    if (!servicesByLayer.has(layer)) {
      servicesByLayer.set(layer, []);
    }
    servicesByLayer.get(layer)!.push(service);
  }

  // Sort layers and services within each layer
  const sortedServicesByLayer = Array.from(servicesByLayer.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([layer, services]) => ({
      layer: toTitleCase(layer),
      services: services.sort((a, b) => a.id.localeCompare(b.id)).map((s) => ({
        ...s,
        technology: getTechnology(s.type),
      })),
    }));

  // Prepare services with components
  const componentCounts = new Map<string, number>();
  if (ir.components) {
    for (const comp of ir.components) {
      componentCounts.set(comp.serviceId, (componentCounts.get(comp.serviceId) || 0) + 1);
    }
  }

  const servicesWithComponents = ir.services
    .filter((s) => componentCounts.get(s.id) && componentCounts.get(s.id)! > 0)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((s) => ({ ...s, identifier: toIdentifier(s.id) }));

  const servicesWithClasses = ir.services
    .filter(
      (s) =>
        s.type.includes('typescript') &&
        componentCounts.get(s.id) &&
        componentCounts.get(s.id)! > 0
    )
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((s) => ({ ...s, identifier: toIdentifier(s.id) }));

  // Prepare deployment environments
  const deploymentEnvironments = (ir.deploymentEnvironments || [])
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((env) => ({
      ...env,
      title: toTitleCase(env.name),
    }));

  // Prepare template data
  const data = {
    currentDate: new Date().toISOString().split('T')[0],
    servicesCount: ir.services.length,
    typescriptCount: ir.services.filter((s) => s.type.includes('typescript')).length,
    pythonCount: ir.services.filter((s) => s.type.includes('python')).length,
    relationshipsCount: ir.relationships.length,
    environmentsCount: ir.deploymentEnvironments?.length || 0,
    environmentNames: ir.deploymentEnvironments?.map((e) => e.name).join(', ') || 'none',
    servicesByLayer: sortedServicesByLayer,
    allServices: ir.services.sort((a, b) => a.id.localeCompare(b.id)),
    servicesWithComponents,
    servicesWithClasses,
    deploymentEnvironments,
  };

  // Render template
  const content = env.render('index.md.njk', data);

  await writeFile(filePath, content, 'utf-8');
  console.log(`[SUCCESS] Generated ${filePath}`);
}

async function generateServicesMd(ir: AACIR, outputDir: string): Promise<void> {
  const filePath = join(outputDir, 'services.md');

  // Prepare component counts
  const componentCounts = new Map<string, number>();
  if (ir.components) {
    for (const comp of ir.components) {
      if (!comp.excludeFromDiagram) {
        componentCounts.set(comp.serviceId, (componentCounts.get(comp.serviceId) || 0) + 1);
      }
    }
  }

  // Prepare services data
  const services = ir.services.sort((a, b) => a.id.localeCompare(b.id)).map((service) => {
    const outgoing = ir.relationships.filter((r) => r.source === service.id);
    const incoming = ir.relationships.filter((r) => r.destination === service.id);

    return {
      ...service,
      identifier: toIdentifier(service.id),
      technology: getTechnology(service.type),
      layerTitle: toTitleCase(service.layer || 'unknown'),
      endpoints: service.endpoints || [],
      outgoingDependencies: outgoing.map((rel) => ({
        targetName: ir.services.find((s) => s.id === rel.destination)?.name || rel.destination,
        protocol: rel.protocol,
        authentication: rel.authentication,
      })),
      incomingDependencies: incoming.map((rel) => ({
        sourceName: ir.services.find((s) => s.id === rel.source)?.name || rel.source,
      })),
      configuration: {
        environment: service.configuration?.environment || [],
        bindings: service.configuration?.bindings || [],
      },
      componentCount: componentCounts.get(service.id) || 0,
    };
  });

  // Prepare template data
  const data = {
    currentDate: new Date().toISOString().split('T')[0],
    services,
  };

  // Render template
  const content = env.render('services.md.njk', data);

  await writeFile(filePath, content, 'utf-8');
  console.log(`[SUCCESS] Generated ${filePath}`);
}

async function generateComponentDocs(ir: AACIR, componentsDir: string): Promise<void> {
  for (const service of ir.services.sort((a, b) => a.id.localeCompare(b.id))) {
    const filePath = join(componentsDir, `${service.id}.md`);

    // Prepare dependencies
    const outgoing = ir.relationships.filter((r) => r.source === service.id);
    const incoming = ir.relationships.filter((r) => r.destination === service.id);

    // Prepare components
    const serviceComponents = ir.components
      ? ir.components.filter((c) => c.serviceId === service.id)
      : [];
    const visibleComponents = serviceComponents.filter((c) => !c.excludeFromDiagram);
    const excludedComponents = serviceComponents.filter((c) => c.excludeFromDiagram);

    // Group components by type
    const componentsByType = new Map<string, Component[]>();
    for (const comp of visibleComponents) {
      const type = toTitleCase(comp.type || 'unknown');
      if (!componentsByType.has(type)) {
        componentsByType.set(type, []);
      }
      componentsByType.get(type)!.push(comp);
    }

    const sortedComponentsByType = Array.from(componentsByType.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([type, components]) => ({
        type,
        components: components.sort((a: Component, b: Component) => a.id.localeCompare(b.id)),
      }));

    // Prepare deployment environments
    const deploymentEnvironments = (ir.deploymentEnvironments || [])
      .filter((env) => env.deploymentNodes.some((n) => n.containerInstances?.includes(service.id)))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((env) => ({
        ...env,
        title: toTitleCase(env.name),
        nodes: env.deploymentNodes
          .filter((n) => n.containerInstances?.includes(service.id))
          .map((node) => {
            const props = node.properties as Record<string, unknown> | undefined;
            return {
              ...node,
              routes: (props?.routes as string[]) || [],
              customDomains: (props?.customDomains as string[]) || [],
            };
          }),
      }));

    // Prepare template data
    const data = {
      currentDate: new Date().toISOString().split('T')[0],
      service: {
        ...service,
        identifier: toIdentifier(service.id),
        layerTitle: toTitleCase(service.layer || 'unknown'),
        endpoints: service.endpoints || [],
        outgoingDependencies: outgoing.map((rel) => ({
          targetName: ir.services.find((s) => s.id === rel.destination)?.name || rel.destination,
          protocol: rel.protocol,
          authentication: rel.authentication,
          binding: rel.binding,
        })),
        incomingDependencies: incoming.map((rel) => ({
          sourceName: ir.services.find((s) => s.id === rel.source)?.name || rel.source,
        })),
        configuration: {
          environment: service.configuration?.environment || [],
          bindings: service.configuration?.bindings || [],
        },
        visibleComponents,
        excludedComponents,
        componentsByType: sortedComponentsByType,
        deploymentEnvironments,
      },
    };

    // Render template
    const content = env.render('component.md.njk', data);

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

function getTechnology(type: string): string {
  if (type.includes('typescript')) return 'TypeScript';
  if (type.includes('python')) return 'Python';
  return type;
}

function toIdentifier(id: string): string {
  // Same as DSL builder - convert hyphens to underscores
  return id.replace(/-/g, '_');
}
