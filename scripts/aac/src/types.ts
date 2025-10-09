/**
 * TypeScript definitions for AAC Intermediate Representation (IR)
 * Based on schemas/aac-ir.json
 */

export interface AACIR {
  version: '1.0';
  project: ProjectMetadata;
  services: Service[];
  relationships: Relationship[];
  components?: Component[];
  componentRelationships?: ComponentRelationship[];
  deploymentEnvironments?: DeploymentEnvironment[];
}

export interface ProjectMetadata {
  name: string;
  description: string;
  repository?: string;
}

export interface Service {
  id: string;
  name: string;
  type:
    | 'cloudflare-worker-typescript'
    | 'cloudflare-worker-python'
    | 'cloudflare-worker-rust'
    | 'cloudflare-worker-java'
    | 'cloudflare-pages'
    | 'cloudflare-durable-object';
  layer: 'ui' | 'api-gateway' | 'business-logic' | 'data-access';
  description: string;
  owner?: string;
  sourcePath?: string;
  internalRoutes?: string[];
  publicRoutes?: string[];
  dependencies?: string[];
  securityModel?: 'none' | 'internal-jwt' | 'auth0-oidc' | 'oauth2' | 'api-key';
  slaTier?: 'critical' | 'high' | 'medium' | 'low';
  endpoints?: Endpoint[];
  configuration?: ServiceConfiguration;
}

export interface Endpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';
  path: string;
  gatewayRoute?: string;
  authentication?: 'none' | 'internal-jwt' | 'auth0-oidc' | 'oauth2' | 'api-key';
  scope?: string;
  rateLimit?: string;
  cacheable?: boolean;
  cacheTtl?: number;
}

export interface ServiceConfiguration {
  environment?: EnvironmentVariable[];
  bindings?: ServiceBinding[];
}

export interface EnvironmentVariable {
  name: string;
  description?: string;
  required?: boolean;
  secret?: boolean;
}

export interface ServiceBinding {
  name: string;
  target: string;
  purpose?: string;
}

export interface Relationship {
  source: string;
  destination: string;
  protocol: 'service-binding' | 'https' | 'grpc' | 'websocket';
  authentication?: 'none' | 'internal-jwt' | 'auth0-jwt' | 'oauth2' | 'api-key';
  binding?: string;
}

export interface ComponentRelationship {
  source: string; // Component ID (e.g., "gateway.ErrorResponse")
  destination: string; // Component ID (e.g., "gateway.InternalJWT")
  description?: string;
  technology?: string; // e.g., "Uses", "Implements", "Extends"
}

export interface Component {
  id: string;
  name?: string;
  serviceId: string;
  type: 'class' | 'interface' | 'module' | 'function' | 'middleware';
  description?: string;
  excludeFromDiagram?: boolean;
  properties?: ComponentProperty[];
  methods?: ComponentMethod[];
  extends?: string;
  implements?: string[];
}

export interface ComponentProperty {
  name: string;
  type: string;
  visibility?: 'public' | 'private' | 'protected';
  isOptional?: boolean;
  isReadonly?: boolean;
}

export interface ComponentMethod {
  name: string;
  returnType?: string;
  parameters?: ComponentParameter[];
  visibility?: 'public' | 'private' | 'protected';
  isAsync?: boolean;
}

export interface ComponentParameter {
  name: string;
  type: string;
  isOptional?: boolean;
}

export interface DeploymentEnvironment {
  name: 'development' | 'preview' | 'staging' | 'production';
  deploymentNodes: DeploymentNode[];
}

export interface DeploymentNode {
  id: string;
  name: string;
  type: 'infrastructure' | 'container';
  technology?: string;
  properties?: DeploymentNodeProperties;
  containerInstances?: string[];
}

export interface DeploymentNodeProperties {
  workerName?: string;
  routes?: string[];
  customDomains?: string[];
  kvNamespaces?: Array<{ binding: string; namespaceId: string }>;
  r2Buckets?: Array<{ binding: string; bucketName: string }>;
  durableObjects?: Array<{ binding: string; className: string }>;
}

/**
 * Partial IR output from individual extractors
 */
export interface PartialIR {
  services?: Service[];
  relationships?: Relationship[];
  components?: Component[];
  componentRelationships?: ComponentRelationship[];
  deploymentEnvironments?: DeploymentEnvironment[];
}

/**
 * AAC annotation tags found in code
 */
export interface AACAnnotations {
  service?: string;
  type?: Service['type'];
  layer?: Service['layer'];
  description?: string;
  owner?: string;
  internalRoutes?: string;
  publicRoutes?: string;
  dependencies?: string;
  securityModel?: Service['securityModel'];
  slaTier?: Service['slaTier'];
  endpoint?: string;
  gatewayRoute?: string;
  authentication?: string;
  scope?: string;
  rateLimit?: string;
  cacheable?: string;
  cacheTtl?: string;
  serviceBinding?: string;
  target?: string;
  purpose?: string;
  excludeFromDiagram?: boolean;
}
