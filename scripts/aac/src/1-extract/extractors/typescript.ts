/**
 * TypeScript Extractor - Extract AAC metadata from TypeScript services
 *
 * Uses ts-morph to parse TypeScript files and extract JSDoc annotations
 */

import { Project, SyntaxKind } from 'ts-morph';
import { join } from 'path';
import type {
  Service,
  Component,
  ComponentRelationship,
  ComponentProperty,
  ComponentMethod,
  ComponentParameter,
  Endpoint,
  PartialIR,
} from '../../shared/types.js';
import { parseAnnotations, parseList, log } from '../../shared/utils.js';

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

/**
 * Extract parameters from a function/method
 */
function extractParameters(params: any[]): ComponentParameter[] {
  return params.map((p) => ({
    name: p.getName(),
    type: p.getType?.()?.getText() || p.getTypeNode()?.getText() || 'any',
    isOptional: p.hasQuestionToken(),
  }));
}

/**
 * Extract properties from a class
 */
function extractClassProperties(cls: any): ComponentProperty[] {
  const properties: ComponentProperty[] = [];

  for (const prop of cls.getProperties()) {
    const propType = prop.getType().getText();
    properties.push({
      name: prop.getName(),
      type: propType,
      visibility: prop.hasModifier(SyntaxKind.PrivateKeyword)
        ? 'private'
        : prop.hasModifier(SyntaxKind.ProtectedKeyword)
          ? 'protected'
          : 'public',
      isOptional: prop.hasQuestionToken(),
      isReadonly: prop.isReadonly(),
    });
  }

  return properties;
}

/**
 * Extract properties from an interface
 */
function extractInterfaceProperties(iface: any): ComponentProperty[] {
  const properties: ComponentProperty[] = [];

  for (const prop of iface.getProperties()) {
    const propType = prop.getTypeNode()?.getText() || 'any';
    properties.push({
      name: prop.getName(),
      type: propType,
      isOptional: prop.hasQuestionToken(),
      isReadonly: prop.isReadonly(),
    });
  }

  return properties;
}

/**
 * Extract methods from a class
 */
function extractClassMethods(cls: any): ComponentMethod[] {
  const methods: ComponentMethod[] = [];

  for (const method of cls.getMethods()) {
    const params = extractParameters(method.getParameters());

    methods.push({
      name: method.getName(),
      returnType: method.getReturnType().getText(),
      parameters: params,
      visibility: method.hasModifier(SyntaxKind.PrivateKeyword)
        ? 'private'
        : method.hasModifier(SyntaxKind.ProtectedKeyword)
          ? 'protected'
          : 'public',
      isAsync: method.isAsync(),
    });
  }

  return methods;
}

/**
 * Extract methods from an interface
 */
function extractInterfaceMethods(iface: any): ComponentMethod[] {
  const methods: ComponentMethod[] = [];

  for (const method of iface.getMethods()) {
    const params = extractParameters(method.getParameters());

    methods.push({
      name: method.getName(),
      returnType: method.getReturnTypeNode()?.getText() || 'void',
      parameters: params,
    });
  }

  return methods;
}

/**
 * Extract service metadata from file annotations
 */
function extractServiceMetadata(sourceFile: any, servicePath: string): Service | null {
  const statements = sourceFile.getStatements();

  for (const statement of statements) {
    const jsDocComments = statement.getLeadingCommentRanges();

    for (const commentRange of jsDocComments) {
      const commentText = commentRange.getText();
      if (!commentText.includes('@service')) continue;

      const annotations = parseAnnotations(commentText);

      if (annotations.service) {
        const service: Service = {
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

        log.success(`Found service: ${service.id}`);
        return service;
      }
    }
  }

  return null;
}

/**
 * Extract endpoints from functions and methods
 */
function extractEndpoints(sourceFile: any, service: Service): void {
  const functions = [
    ...sourceFile.getFunctions(),
    ...sourceFile.getClasses().flatMap((cls: any) => cls.getMethods()),
  ];

  for (const func of functions) {
    const jsDocs = func.getJsDocs();
    for (const jsDoc of jsDocs) {
      const commentText = jsDoc.getFullText();
      if (!commentText.includes('@endpoint')) continue;

      const annotations = parseAnnotations(commentText);

      if (annotations.endpoint) {
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

        service.endpoints!.push(endpoint);
        log.info(`  Found endpoint: ${method} ${path}`);
      }
    }
  }
}

/**
 * Extract class components from source file
 */
function extractClassComponents(sourceFile: any, service: Service, components: Component[]): void {
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

    const component: Component = {
      id: `${service.id}.${cls.getName()}`,
      name: cls.getName(),
      serviceId: service.id,
      type: 'class',
      description: jsDocs[0]?.getDescription() || undefined,
      excludeFromDiagram,
      properties: extractClassProperties(cls),
      methods: extractClassMethods(cls),
    };

    // Check for extends
    const extendsExpr = cls.getExtends();
    if (extendsExpr) {
      component.extends = extendsExpr.getText();
    }

    // Check for implements
    const implementsExprs = cls.getImplements();
    if (implementsExprs.length > 0) {
      component.implements = implementsExprs.map((i: any) => i.getText());
    }

    components.push(component);
  }
}

/**
 * Extract interface components from source file
 */
function extractInterfaceComponents(
  sourceFile: any,
  service: Service,
  components: Component[]
): void {
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

    const component: Component = {
      id: `${service.id}.${iface.getName()}`,
      name: iface.getName(),
      serviceId: service.id,
      type: 'interface',
      description: jsDocs[0]?.getDescription() || undefined,
      excludeFromDiagram,
      properties: extractInterfaceProperties(iface),
      methods: extractInterfaceMethods(iface),
    };

    // Check for extends
    const extendsExprs = iface.getExtends();
    if (extendsExprs.length > 0) {
      component.extends = extendsExprs[0].getText();
    }

    components.push(component);
  }
}

/**
 * Extract module components (top-level functions)
 */
function extractModuleComponents(sourceFile: any, service: Service, components: Component[]): void {
  const moduleFunctions = sourceFile.getFunctions();
  if (moduleFunctions.length === 0) return;

  const fileName = sourceFile.getBaseName().replace('.ts', '');
  const moduleId = `${service.id}.${fileName}`;

  // Check if we already have a module component for this file
  let moduleComponent = components.find((c) => c.id === moduleId && c.type === 'module');

  if (!moduleComponent) {
    moduleComponent = {
      id: moduleId,
      name: fileName,
      serviceId: service.id,
      type: 'module',
      description: `Module: ${fileName}`,
      excludeFromDiagram: false,
      functions: [],
    };
    components.push(moduleComponent);
  }

  // Extract each function
  for (const func of moduleFunctions) {
    const params = extractParameters(func.getParameters());
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
  const hasEffectful = moduleComponent.functions!.some((f) => f.stereotype === 'effectful');
  moduleComponent.stereotype = hasEffectful ? 'effectful' : 'pure';
}

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
      // Extract service metadata if not already found
      if (!currentService) {
        const service = extractServiceMetadata(sourceFile, servicePath);
        if (service) {
          currentService = service;
          services.push(currentService);
        }
      }

      // Extract endpoints and components only if we have a service
      if (currentService) {
        extractEndpoints(sourceFile, currentService);
        extractClassComponents(sourceFile, currentService, components);
        extractInterfaceComponents(sourceFile, currentService, components);
        extractModuleComponents(sourceFile, currentService, components);
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
    log.warn(
      `No service metadata found in ${servicePath}. Make sure files have @service annotations.`
    );
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
 * Add a relationship if the destination component exists and is not excluded
 */
function addRelationship(
  sourceComponent: Component,
  destTypeName: string,
  technology: string,
  componentMap: Map<string | undefined, Component>,
  relationships: ComponentRelationship[]
): void {
  const destComponent = componentMap.get(destTypeName);
  if (
    destComponent &&
    !destComponent.excludeFromDiagram &&
    destComponent.id !== sourceComponent.id
  ) {
    relationships.push({
      source: sourceComponent.id,
      destination: destComponent.id,
      technology,
    });
  }
}

/**
 * Extract type name from type node (strips generics and array notation)
 */
function extractTypeName(typeNode: any): string {
  return typeNode.getText().split('<')[0].split('[')[0].trim();
}

/**
 * Analyze class relationships (extends, implements, properties, methods)
 */
function analyzeClassRelationships(
  sourceFile: any,
  componentMap: Map<string | undefined, Component>,
  relationships: ComponentRelationship[]
): void {
  for (const cls of sourceFile.getClasses()) {
    const sourceComponent = componentMap.get(cls.getName());
    if (!sourceComponent || sourceComponent.excludeFromDiagram) continue;

    // Check extends clause
    const extendsClause = cls.getExtends();
    if (extendsClause) {
      addRelationship(
        sourceComponent,
        extendsClause.getText(),
        'Extends',
        componentMap,
        relationships
      );
    }

    // Check implements clause
    for (const impl of cls.getImplements()) {
      addRelationship(sourceComponent, impl.getText(), 'Implements', componentMap, relationships);
    }

    // Check property types
    for (const prop of cls.getProperties()) {
      const typeNode = prop.getTypeNode();
      if (typeNode) {
        const typeName = extractTypeName(typeNode);
        addRelationship(sourceComponent, typeName, 'Uses', componentMap, relationships);
      }
    }

    // Check method parameters and return types
    for (const method of cls.getMethods()) {
      const returnType = method.getReturnTypeNode();
      if (returnType) {
        const typeName = extractTypeName(returnType);
        addRelationship(sourceComponent, typeName, 'Uses', componentMap, relationships);
      }

      for (const param of method.getParameters()) {
        const typeNode = param.getTypeNode();
        if (typeNode) {
          const typeName = extractTypeName(typeNode);
          addRelationship(sourceComponent, typeName, 'Uses', componentMap, relationships);
        }
      }
    }
  }
}

/**
 * Analyze interface relationships (extends, properties)
 */
function analyzeInterfaceRelationships(
  sourceFile: any,
  componentMap: Map<string | undefined, Component>,
  relationships: ComponentRelationship[]
): void {
  for (const iface of sourceFile.getInterfaces()) {
    const sourceComponent = componentMap.get(iface.getName());
    if (!sourceComponent || sourceComponent.excludeFromDiagram) continue;

    // Check extends clause
    for (const ext of iface.getExtends()) {
      addRelationship(sourceComponent, ext.getText(), 'Extends', componentMap, relationships);
    }

    // Check property types
    for (const prop of iface.getProperties()) {
      const typeNode = prop.getTypeNode();
      if (typeNode) {
        const typeName = extractTypeName(typeNode);
        addRelationship(sourceComponent, typeName, 'Uses', componentMap, relationships);
      }
    }
  }
}

/**
 * Deduplicate relationships
 */
function deduplicateRelationships(relationships: ComponentRelationship[]): void {
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
    analyzeClassRelationships(sourceFile, componentMap, relationships);
    analyzeInterfaceRelationships(sourceFile, componentMap, relationships);
  }

  deduplicateRelationships(relationships);
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
