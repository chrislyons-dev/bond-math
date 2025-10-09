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

/**
 * Constants for purity classification
 */
const EFFECTFUL_RETURN_TYPES = [
  'Promise',
  'IO',
  'Task',
  'Effect',
  'Observable',
  'Response',
] as const;

const EFFECTFUL_BODY_PATTERNS = [
  'fetch(',
  'console.',
  'localStorage',
  'sessionStorage',
  'document.',
  'window.',
  'process.',
  'Math.random',
  'Date.now',
  'new Date',
  '.json(',
  '.text(',
  '.blob(',
  'addEventListener',
  'setTimeout',
  'setInterval',
] as const;

export async function extractTypeScriptService(
  options: TypeScriptExtractorOptions
): Promise<PartialIR> {
  // Input validation
  if (!options || typeof options !== 'object') {
    throw new Error('options must be a valid object');
  }

  const { servicePath, serviceId } = options;

  if (!servicePath || typeof servicePath !== 'string') {
    throw new Error('servicePath is required and must be a non-empty string');
  }

  if (!serviceId || typeof serviceId !== 'string') {
    throw new Error('serviceId is required and must be a non-empty string');
  }

  // Validate serviceId format (kebab-case)
  if (!/^[a-z][a-z0-9-]*$/.test(serviceId)) {
    throw new Error(`serviceId must be in kebab-case format: ${serviceId}`);
  }

  log.info(`Extracting TypeScript service: ${serviceId}`);

  // Initialize ts-morph project with error handling
  let project: Project;
  try {
    const tsconfigPath = join(servicePath, 'tsconfig.json');
    project = new Project({
      tsConfigFilePath: tsconfigPath,
      skipAddingFilesFromTsConfig: true,
    });
  } catch (error: any) {
    throw new Error(`Failed to initialize TypeScript project at ${servicePath}: ${error.message}`);
  }

  // Add source files with error handling
  try {
    const sourcePattern = join(servicePath, 'src/**/*.ts');
    const sourceFiles = project.addSourceFilesAtPaths(sourcePattern);

    if (sourceFiles.length === 0) {
      log.warn(`No TypeScript files found in ${sourcePattern}`);
    }
  } catch (error: any) {
    throw new Error(`Failed to add source files from ${servicePath}: ${error.message}`);
  }

  const services: Service[] = [];
  const components: Component[] = [];
  const componentRelationships: ComponentRelationship[] = [];
  let currentService: Service | null = null;

  // Process each source file with error handling
  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();
    log.info(`Processing: ${filePath}`);

    try {

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
            securityModel: annotations.securityModel,
            slaTier: annotations.slaTier,
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
            authentication: annotations.authentication,
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
        const component: Component = {
          id: `${currentService.id}.${cls.getName()}`,
          name: cls.getName(),
          serviceId: currentService.id,
          type: 'class',
          description: jsDocs[0]?.getDescription() || undefined,
          excludeFromDiagram,
          properties: [],
          methods: [],
        };

        // Extract properties
        for (const prop of cls.getProperties()) {
          const propType = prop.getType().getText();
          component.properties!.push({
            name: prop.getName(),
            type: propType,
            visibility: prop.hasModifier(SyntaxKind.PrivateKeyword) ? 'private' :
                       prop.hasModifier(SyntaxKind.ProtectedKeyword) ? 'protected' : 'public',
            isOptional: prop.hasQuestionToken(),
            isReadonly: prop.isReadonly(),
          });
        }

        // Extract methods
        for (const method of cls.getMethods()) {
          const params = method.getParameters().map(p => ({
            name: p.getName(),
            type: p.getType().getText(),
            isOptional: p.hasQuestionToken(),
          }));

          component.methods!.push({
            name: method.getName(),
            returnType: method.getReturnType().getText(),
            parameters: params,
            visibility: method.hasModifier(SyntaxKind.PrivateKeyword) ? 'private' :
                       method.hasModifier(SyntaxKind.ProtectedKeyword) ? 'protected' : 'public',
            isAsync: method.isAsync(),
          });
        }

        // Check for extends
        const extendsExpr = cls.getExtends();
        if (extendsExpr) {
          component.extends = extendsExpr.getText();
        }

        // Check for implements
        const implementsExprs = cls.getImplements();
        if (implementsExprs.length > 0) {
          component.implements = implementsExprs.map(i => i.getText());
        }

        components.push(component);
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
        const component: Component = {
          id: `${currentService.id}.${iface.getName()}`,
          name: iface.getName(),
          serviceId: currentService.id,
          type: 'interface',
          description: jsDocs[0]?.getDescription() || undefined,
          excludeFromDiagram,
          properties: [],
          methods: [],
        };

        // Extract properties
        for (const prop of iface.getProperties()) {
          const propType = prop.getTypeNode()?.getText() || 'any';
          component.properties!.push({
            name: prop.getName(),
            type: propType,
            isOptional: prop.hasQuestionToken(),
            isReadonly: prop.isReadonly(),
          });
        }

        // Extract methods
        for (const method of iface.getMethods()) {
          const params = method.getParameters().map(p => ({
            name: p.getName(),
            type: p.getTypeNode()?.getText() || 'any',
            isOptional: p.hasQuestionToken(),
          }));

          component.methods!.push({
            name: method.getName(),
            returnType: method.getReturnTypeNode()?.getText() || 'void',
            parameters: params,
          });
        }

        // Check for extends
        const extendsExprs = iface.getExtends();
        if (extendsExprs.length > 0) {
          component.extends = extendsExprs[0].getText();
        }

        components.push(component);
      }
    }

    // Extract top-level functions and group into module components
    if (currentService) {
      const moduleFunctions = sourceFile.getFunctions();
      if (moduleFunctions.length > 0) {
        const fileName = sourceFile.getBaseName().replace('.ts', '');
        const moduleId = `${currentService.id}.${fileName}`;

        // Check if we already have a module component for this file
        let moduleComponent = components.find(c => c.id === moduleId && c.type === 'module');

        if (!moduleComponent) {
          moduleComponent = {
            id: moduleId,
            name: fileName,
            serviceId: currentService.id,
            type: 'module',
            description: `Module: ${fileName}`,
            excludeFromDiagram: false,
            functions: [],
          };
          components.push(moduleComponent);
        }

        // Extract each function
        for (const func of moduleFunctions) {
          const params = func.getParameters().map(p => ({
            name: p.getName(),
            type: p.getType().getText(),
            isOptional: p.hasQuestionToken(),
          }));

          const returnType = func.getReturnType().getText();
          const isAsync = func.isAsync();
          const isExported = func.isExported();

          // Classify as pure vs effectful
          const stereotype = classifyFunctionPurity(func, returnType, isAsync);

          moduleComponent.functions!.push({
            name: func.getName() || 'anonymous',
            returnType,
            parameters: params,
            isAsync,
            isExported,
            stereotype,
          });
        }

        // Set module stereotype based on functions
        const hasEffectful = moduleComponent.functions!.some(f => f.stereotype === 'effectful');
        moduleComponent.stereotype = hasEffectful ? 'effectful' : 'pure';
      }
    }

    } catch (error: any) {
      log.error(`Failed to process ${filePath}: ${error.message}`);
      // Continue processing other files
    }
  }

  // Extract component relationships with error handling
  if (currentService) {
    try {
      extractComponentRelationships(project, currentService, components, componentRelationships);
    } catch (error: any) {
      log.warn(`Failed to extract component relationships: ${error.message}`);
      // Continue - relationships are optional
    }
  }

  // Validate we found at least one service
  if (services.length === 0) {
    log.warn(`No service metadata found in ${servicePath}. Make sure files have @service annotations.`);
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
 * Classify a function as pure or effectful based on its signature and body
 *
 * @param func - Function node from ts-morph
 * @param returnType - Function return type as string
 * @param isAsync - Whether function is async
 * @returns 'pure' if function has no side effects, 'effectful' otherwise
 */
function classifyFunctionPurity(
  func: any,
  returnType: string,
  isAsync: boolean
): 'pure' | 'effectful' {
  // Async functions are always effectful
  if (isAsync) {
    return 'effectful';
  }

  // Check return type for effectful patterns
  for (const type of EFFECTFUL_RETURN_TYPES) {
    if (returnType.includes(type)) {
      return 'effectful';
    }
  }

  // Check function body for effectful operations
  const bodyText = func.getBodyText?.() || '';
  for (const pattern of EFFECTFUL_BODY_PATTERNS) {
    if (bodyText.includes(pattern)) {
      return 'effectful';
    }
  }

  // Default to pure if no effectful indicators found
  return 'pure';
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
