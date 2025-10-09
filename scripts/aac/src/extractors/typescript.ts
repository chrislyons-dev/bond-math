/**
 * TypeScript Extractor - Extract AAC metadata from TypeScript services
 *
 * Uses ts-morph to parse TypeScript files and extract JSDoc annotations
 */

import { Project, SyntaxKind } from 'ts-morph';
import { join } from 'path';
import type { Service, Component, ComponentRelationship, Endpoint, PartialIR } from '../types.js';
import { parseAnnotations, parseList, log } from '../utils.js';

export interface TypeScriptExtractorOptions {
  servicePath: string;
  serviceId: string;
}

export async function extractTypeScriptService(
  options: TypeScriptExtractorOptions
): Promise<PartialIR> {
  const { servicePath, serviceId } = options;

  log.info(`Extracting TypeScript service: ${serviceId}`);

  // Initialize ts-morph project
  const project = new Project({
    tsConfigFilePath: join(servicePath, 'tsconfig.json'),
    skipAddingFilesFromTsConfig: true,
  });

  // Add source files
  project.addSourceFilesAtPaths(join(servicePath, 'src/**/*.ts'));

  const services: Service[] = [];
  const components: Component[] = [];
  const componentRelationships: ComponentRelationship[] = [];
  let currentService: Service | null = null;

  // Process each source file
  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();
    log.info(`Processing: ${filePath}`);

    // Check for service-level annotations in file-level JSDoc
    const fileJsDoc = sourceFile
      .getStatements()
      .find((stmt) => stmt.getKindName() === 'JSDocComment');

    // Get all JSDoc comments
    const statements = sourceFile.getStatements();

    // Look for service metadata in first JSDoc comment
    for (const statement of statements) {
      const jsDocComments = statement.getLeadingCommentRanges();

      for (const commentRange of jsDocComments) {
        const commentText = commentRange.getText();
        if (!commentText.includes('@service')) continue;

        const annotations = parseAnnotations(commentText);

        if (annotations.service) {
          // Found service-level metadata
          currentService = {
            id: annotations.service,
            name: annotations.service
              .split('-')
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' '),
            type: annotations.type || 'cloudflare-worker-typescript',
            layer: annotations.layer || 'business-logic',
            description: annotations.description || '',
            owner: annotations.owner,
            sourcePath: servicePath,
            internalRoutes: parseList(annotations.internalRoutes),
            publicRoutes: parseList(annotations.publicRoutes),
            dependencies: parseList(annotations.dependencies),
            securityModel: annotations.securityModel as any,
            slaTier: annotations.slaTier as any,
            endpoints: [],
          };

          services.push(currentService);
          log.success(`Found service: ${currentService.id}`);
        }
      }
    }

    // Extract endpoint metadata from function/method JSDoc
    const functions = [
      ...sourceFile.getFunctions(),
      ...sourceFile.getClasses().flatMap((cls) => cls.getMethods()),
    ];

    for (const func of functions) {
      const jsDocs = func.getJsDocs();
      for (const jsDoc of jsDocs) {
        const commentText = jsDoc.getFullText();
        if (!commentText.includes('@endpoint')) continue;

        const annotations = parseAnnotations(commentText);

        if (annotations.endpoint && currentService) {
          // Parse endpoint definition (e.g., "GET /health")
          const [method, path] = annotations.endpoint.split(/\s+/);

          const endpoint: Endpoint = {
            method: method as Endpoint['method'],
            path: path,
            gatewayRoute: annotations.gatewayRoute,
            authentication: annotations.authentication as any,
            scope: annotations.scope,
            rateLimit: annotations.rateLimit,
            cacheable: annotations.cacheable === 'true',
            cacheTtl: annotations.cacheTtl ? parseInt(annotations.cacheTtl, 10) : undefined,
          };

          currentService.endpoints!.push(endpoint);
          log.info(`  Found endpoint: ${method} ${path}`);
        }
      }
    }

    // Extract components (classes, interfaces, functions)
    const classes = sourceFile.getClasses();
    for (const cls of classes) {
      const jsDocs = cls.getJsDocs();
      let excludeFromDiagram = false;

      for (const jsDoc of jsDocs) {
        const commentText = jsDoc.getFullText();
        const annotations = parseAnnotations(commentText);
        if (annotations.excludeFromDiagram) {
          excludeFromDiagram = true;
        }
      }

      if (currentService) {
        components.push({
          id: `${currentService.id}.${cls.getName()}`,
          name: cls.getName(),
          serviceId: currentService.id,
          type: 'class',
          description: jsDocs[0]?.getDescription() || undefined,
          excludeFromDiagram,
        });
      }
    }

    const interfaces = sourceFile.getInterfaces();
    for (const iface of interfaces) {
      const jsDocs = iface.getJsDocs();
      let excludeFromDiagram = false;

      for (const jsDoc of jsDocs) {
        const commentText = jsDoc.getFullText();
        const annotations = parseAnnotations(commentText);
        if (annotations.excludeFromDiagram) {
          excludeFromDiagram = true;
        }
      }

      if (currentService) {
        components.push({
          id: `${currentService.id}.${iface.getName()}`,
          name: iface.getName(),
          serviceId: currentService.id,
          type: 'interface',
          description: jsDocs[0]?.getDescription() || undefined,
          excludeFromDiagram,
        });
      }
    }
  }

  // Extract component relationships
  if (currentService) {
    extractComponentRelationships(project, currentService, components, componentRelationships);
  }

  log.success(
    `Extracted ${services.length} service(s), ${components.length} component(s), ${componentRelationships.length} component relationship(s)`
  );

  return {
    services,
    components,
    componentRelationships,
  };
}

/**
 * Extract relationships between components within a service
 */
function extractComponentRelationships(
  project: Project,
  service: Service,
  components: Component[],
  relationships: ComponentRelationship[]
): void {
  const componentMap = new Map(components.map((c) => [c.name, c]));

  for (const sourceFile of project.getSourceFiles()) {
    // Analyze classes
    for (const cls of sourceFile.getClasses()) {
      const sourceComponent = componentMap.get(cls.getName());
      if (!sourceComponent || sourceComponent.excludeFromDiagram) continue;

      // Check extends clause
      const extendsClause = cls.getExtends();
      if (extendsClause) {
        const baseClassName = extendsClause.getText();
        const destComponent = componentMap.get(baseClassName);
        if (destComponent && !destComponent.excludeFromDiagram) {
          relationships.push({
            source: sourceComponent.id,
            destination: destComponent.id,
            technology: 'Extends',
          });
        }
      }

      // Check implements clause
      for (const impl of cls.getImplements()) {
        const interfaceName = impl.getText();
        const destComponent = componentMap.get(interfaceName);
        if (destComponent && !destComponent.excludeFromDiagram) {
          relationships.push({
            source: sourceComponent.id,
            destination: destComponent.id,
            technology: 'Implements',
          });
        }
      }

      // Check properties
      for (const prop of cls.getProperties()) {
        const typeNode = prop.getTypeNode();
        if (typeNode) {
          const typeName = typeNode.getText().split('<')[0].split('[')[0].trim();
          const destComponent = componentMap.get(typeName);
          if (
            destComponent &&
            !destComponent.excludeFromDiagram &&
            destComponent.id !== sourceComponent.id
          ) {
            relationships.push({
              source: sourceComponent.id,
              destination: destComponent.id,
              technology: 'Uses',
            });
          }
        }
      }

      // Check method parameters and return types
      for (const method of cls.getMethods()) {
        // Check return type
        const returnType = method.getReturnTypeNode();
        if (returnType) {
          const typeName = returnType.getText().split('<')[0].split('[')[0].trim();
          const destComponent = componentMap.get(typeName);
          if (
            destComponent &&
            !destComponent.excludeFromDiagram &&
            destComponent.id !== sourceComponent.id
          ) {
            relationships.push({
              source: sourceComponent.id,
              destination: destComponent.id,
              technology: 'Uses',
            });
          }
        }

        // Check parameters
        for (const param of method.getParameters()) {
          const typeNode = param.getTypeNode();
          if (typeNode) {
            const typeName = typeNode.getText().split('<')[0].split('[')[0].trim();
            const destComponent = componentMap.get(typeName);
            if (
              destComponent &&
              !destComponent.excludeFromDiagram &&
              destComponent.id !== sourceComponent.id
            ) {
              relationships.push({
                source: sourceComponent.id,
                destination: destComponent.id,
                technology: 'Uses',
              });
            }
          }
        }
      }
    }

    // Analyze interfaces
    for (const iface of sourceFile.getInterfaces()) {
      const sourceComponent = componentMap.get(iface.getName());
      if (!sourceComponent || sourceComponent.excludeFromDiagram) continue;

      // Check extends clause
      for (const ext of iface.getExtends()) {
        const baseInterfaceName = ext.getText();
        const destComponent = componentMap.get(baseInterfaceName);
        if (destComponent && !destComponent.excludeFromDiagram) {
          relationships.push({
            source: sourceComponent.id,
            destination: destComponent.id,
            technology: 'Extends',
          });
        }
      }

      // Check properties
      for (const prop of iface.getProperties()) {
        const typeNode = prop.getTypeNode();
        if (typeNode) {
          const typeName = typeNode.getText().split('<')[0].split('[')[0].trim();
          const destComponent = componentMap.get(typeName);
          if (
            destComponent &&
            !destComponent.excludeFromDiagram &&
            destComponent.id !== sourceComponent.id
          ) {
            relationships.push({
              source: sourceComponent.id,
              destination: destComponent.id,
              technology: 'Uses',
            });
          }
        }
      }
    }
  }

  // Deduplicate relationships
  const seen = new Set<string>();
  const deduplicated = relationships.filter((rel) => {
    const key = `${rel.source}->${rel.destination}:${rel.technology}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  relationships.length = 0;
  relationships.push(...deduplicated);
}

/**
 * CLI entry point
 */
export async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node typescript.js <service-path> <service-id>');
    process.exit(1);
  }

  const [servicePath, serviceId] = args;
  const ir = await extractTypeScriptService({ servicePath, serviceId });

  console.log(JSON.stringify(ir, null, 2));
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    log.error(error.message);
    process.exit(1);
  });
}
