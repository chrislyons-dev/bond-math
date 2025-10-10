/**
 * Structurizr DSL Builder - Utilities for generating Structurizr DSL
 *
 * Provides a fluent API for building Structurizr DSL syntax
 */

export class DSLBuilder {
  private lines: string[] = [];
  private indentLevel = 0;
  private readonly indentSize = 4;

  /**
   * Add a line of DSL
   */
  add(line: string): this {
    if (!line.trim()) {
      this.lines.push('');
      return this;
    }

    const indent = ' '.repeat(this.indentLevel * this.indentSize);
    this.lines.push(indent + line);
    return this;
  }

  /**
   * Add a comment
   */
  comment(text: string): this {
    return this.add(`# ${text}`);
  }

  /**
   * Add a blank line
   */
  blank(): this {
    this.lines.push('');
    return this;
  }

  /**
   * Start a block
   */
  block(header: string, callback: () => void): this {
    this.add(header + ' {');
    this.indent();
    callback();
    this.dedent();
    this.add('}');
    return this;
  }

  /**
   * Increase indentation
   */
  indent(): this {
    this.indentLevel++;
    return this;
  }

  /**
   * Decrease indentation
   */
  dedent(): this {
    this.indentLevel = Math.max(0, this.indentLevel - 1);
    return this;
  }

  /**
   * Get the generated DSL
   */
  build(): string {
    return this.lines.join('\n') + '\n';
  }
}

/**
 * Escape special characters for DSL
 */
export function escapeDSL(text: string): string {
  // Escape quotes and backslashes
  return text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Convert service layer to Structurizr tag
 */
export function getLayerTag(layer: string): string {
  const tagMap: Record<string, string> = {
    ui: 'User Interface',
    'api-gateway': 'API Gateway',
    'business-logic': 'Business Logic',
    'data-access': 'Data Access',
  };

  return tagMap[layer] || layer;
}

/**
 * Convert service type to technology string
 */
export function getTechnology(type: string): string {
  const techMap: Record<string, string> = {
    'cloudflare-worker-typescript': 'Cloudflare Workers (TypeScript)',
    'cloudflare-worker-python': 'Cloudflare Workers (Python)',
    'cloudflare-worker-rust': 'Cloudflare Workers (Rust)',
    'cloudflare-worker-java': 'Cloudflare Workers (Java)',
    'cloudflare-pages': 'Cloudflare Pages',
    'cloudflare-durable-object': 'Cloudflare Durable Objects',
  };

  return techMap[type] || type;
}

/**
 * Generate a valid Structurizr identifier from a service ID
 */
export function toIdentifier(id: string): string {
  // Replace hyphens with underscores, ensure it starts with a letter
  return id.replace(/-/g, '_');
}

/**
 * Format a description for DSL
 */
export function formatDescription(description: string | undefined): string {
  if (!description) return '';
  // Replace newlines with spaces and trim
  const cleaned = description.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
  return escapeDSL(cleaned);
}

/**
 * Generate tags for a service
 */
export function getServiceTags(service: {
  layer?: string;
  slaTier?: string;
  type?: string;
}): string[] {
  const tags: string[] = [];

  if (service.layer) {
    tags.push(getLayerTag(service.layer));
  }

  if (service.slaTier) {
    tags.push(`SLA:${service.slaTier}`);
  }

  if (service.type?.includes('typescript')) {
    tags.push('TypeScript');
  } else if (service.type?.includes('python')) {
    tags.push('Python');
  }

  return tags;
}
