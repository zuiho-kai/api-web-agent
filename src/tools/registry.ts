import type { JSONSchema7 } from './json-schema';

export interface ToolContext {
  signal?: AbortSignal;
  settings?: Record<string, unknown>;
}

export type ToolResult =
  | { type: 'text'; text: string }
  | { type: 'image_url'; url: string }
  | { type: 'error'; message: string };

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: JSONSchema7;
  execute(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult[]>;
}

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  list(): ToolDefinition[] {
    return [...this.tools.values()];
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }
}
