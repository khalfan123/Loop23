export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler?: (params: Record<string, unknown>) => Promise<unknown>;
}

export interface StructuredToolCall {
  id: string;
  name: string;
  params: Record<string, unknown>;
}

export interface StructuredToolResult {
  toolCallId: string;
  name: string;
  result: unknown;
  isError?: boolean;
}

export type LLMStreamEvent =
  | { type: 'text'; text: string }
  | { type: 'tool_call'; toolCall: StructuredToolCall }
  | { type: 'done'; stopReason: string; inputTokens: number; outputTokens: number };

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  register(def: ToolDefinition): void {
    this.tools.set(def.name, def);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  validateInput(toolName: string, params: Record<string, unknown>): { valid: boolean; error?: string } {
    const def = this.tools.get(toolName);
    if (!def) {
      return { valid: false, error: `Unknown tool: ${toolName}` };
    }
    const schema = def.inputSchema;
    if (!schema || !schema.properties) {
      return { valid: true };
    }
    const required = (schema.required as string[]) || [];
    for (const req of required) {
      if (params[req] === undefined || params[req] === null) {
        return { valid: false, error: `Missing required parameter: ${req}` };
      }
    }
    return { valid: true };
  }
}

export function agentToolToDefinition(
  tool: { name: string; description: string; parameters: Record<string, unknown>; handler?: (params: Record<string, unknown>) => Promise<unknown> }
): ToolDefinition | null {
  if (!tool || !tool.name) return null;
  return {
    name: tool.name,
    description: tool.description || '',
    inputSchema: tool.parameters || {},
    handler: tool.handler,
  };
}

export function toBedrockToolSpecs(toolDefs: ToolDefinition[]): Array<{
  toolSpec: {
    name: string;
    description: string;
    inputSchema: { json: Record<string, unknown> };
  };
}> {
  return toolDefs.map(def => ({
    toolSpec: {
      name: def.name,
      description: def.description,
      inputSchema: {
        json: def.inputSchema && Object.keys(def.inputSchema).length > 0
          ? def.inputSchema
          : { type: 'object', properties: {} },
      },
    },
  }));
}
