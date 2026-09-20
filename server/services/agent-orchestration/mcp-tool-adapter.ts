'use strict';
/**
 * MCP → ToolRegistry / AgentTool adapter.
 *
 * Exposes remote Model Context Protocol tools as Loop9 AgentTools so
 * Bedrock/OpenAI voice agents can call them mid-call (awesome-ai-apps pattern)
 * without replacing Twilio media with demo transports.
 *
 * Protocol: JSON-RPC 2.0 over HTTP POST (MCP streamable HTTP / simple servers).
 * Default: read-only allowlist; mutating tools require explicit allowTools.
 */

import type { ToolDefinition } from './tool-registry';
import { ToolRegistry } from './tool-registry';

export type McpServerConfig = {
  id: string;
  /** MCP HTTP endpoint (JSON-RPC). */
  url: string;
  headers?: Record<string, string>;
  /** If set, only these remote tool names are registered. */
  allowTools?: string[];
  /**
   * When true (default), skip tools whose names suggest write/delete/send
   * unless listed in allowTools.
   */
  readOnly?: boolean;
};

export type McpRemoteTool = {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
};

type JsonRpcResponse = {
  jsonrpc?: string;
  id?: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

const MUTATING_NAME =
  /^(create|update|delete|write|send|post|put|patch|remove|drop|insert|execute|run_sql)/i;

let rpcId = 1;

export function parseMcpServersFromEnv(
  raw: string | undefined = process.env.LOOP9_MCP_SERVERS,
): McpServerConfig[] {
  if (!raw || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x) => x && typeof x.id === 'string' && typeof x.url === 'string')
      .map((x) => ({
        id: String(x.id),
        url: String(x.url),
        headers: x.headers && typeof x.headers === 'object' ? x.headers : undefined,
        allowTools: Array.isArray(x.allowTools)
          ? x.allowTools.map(String)
          : undefined,
        readOnly: x.readOnly !== false,
      }));
  } catch {
    console.warn('[MCP] LOOP9_MCP_SERVERS is not valid JSON; ignoring');
    return [];
  }
}

export async function mcpJsonRpc(
  config: McpServerConfig,
  method: string,
  params?: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  const id = rpcId++;
  const res = await fetchImpl(config.url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      ...(config.headers || {}),
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id,
      method,
      params: params ?? {},
    }),
  });
  if (!res.ok) {
    throw new Error(`MCP HTTP ${res.status} from ${config.id}`);
  }
  const body = (await res.json()) as JsonRpcResponse;
  if (body.error) {
    throw new Error(`MCP ${config.id} ${method}: ${body.error.message}`);
  }
  return body.result;
}

export async function listMcpTools(
  config: McpServerConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<McpRemoteTool[]> {
  const result = (await mcpJsonRpc(config, 'tools/list', {}, fetchImpl)) as {
    tools?: McpRemoteTool[];
  };
  return Array.isArray(result?.tools) ? result.tools : [];
}

export async function callMcpTool(
  config: McpServerConfig,
  name: string,
  args: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  return mcpJsonRpc(
    config,
    'tools/call',
    { name, arguments: args },
    fetchImpl,
  );
}

export function shouldExposeMcpTool(
  tool: McpRemoteTool,
  config: McpServerConfig,
): boolean {
  if (config.allowTools && config.allowTools.length > 0) {
    return config.allowTools.includes(tool.name);
  }
  if (config.readOnly !== false && MUTATING_NAME.test(tool.name)) {
    return false;
  }
  return true;
}

/** Stable Loop9 tool name: mcp_<serverId>_<remoteName> (sanitized). */
export function loop9McpToolName(serverId: string, remoteName: string): string {
  const scrub = (s: string) => s.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 40);
  return `mcp_${scrub(serverId)}_${scrub(remoteName)}`;
}

export function mcpToolToDefinition(
  config: McpServerConfig,
  tool: McpRemoteTool,
  fetchImpl: typeof fetch = fetch,
): ToolDefinition {
  const name = loop9McpToolName(config.id, tool.name);
  return {
    name,
    description:
      tool.description ||
      `MCP tool ${tool.name} from server ${config.id} (read-only remote).`,
    inputSchema: tool.inputSchema || {
      type: 'object',
      properties: {},
    },
    handler: async (params: Record<string, unknown>) => {
      try {
        const result = await callMcpTool(config, tool.name, params, fetchImpl);
        return { ok: true, serverId: config.id, tool: tool.name, result };
      } catch (err: any) {
        return {
          ok: false,
          serverId: config.id,
          tool: tool.name,
          error: err?.message || String(err),
        };
      }
    },
  };
}

/**
 * Discover tools from configured MCP servers and register on a ToolRegistry.
 * Failures per-server are logged; other servers still register.
 */
export async function registerMcpTools(
  registry: ToolRegistry,
  configs: McpServerConfig[],
  fetchImpl: typeof fetch = fetch,
): Promise<string[]> {
  const registered: string[] = [];
  for (const config of configs) {
    try {
      const tools = await listMcpTools(config, fetchImpl);
      for (const tool of tools) {
        if (!shouldExposeMcpTool(tool, config)) continue;
        const def = mcpToolToDefinition(config, tool, fetchImpl);
        registry.register(def);
        registered.push(def.name);
      }
    } catch (err: any) {
      console.warn(
        `[MCP] Failed to list tools from ${config.id}: ${err?.message || err}`,
      );
    }
  }
  return registered;
}

/** Convert MCP ToolDefinitions into Bedrock/OpenAI AgentTool shape. */
export function mcpDefinitionsToAgentTools(
  defs: ToolDefinition[],
): Array<{
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handler: (params: Record<string, unknown>) => Promise<unknown>;
}> {
  return defs
    .filter((d) => typeof d.handler === 'function')
    .map((d) => ({
      name: d.name,
      description: d.description,
      parameters: d.inputSchema || { type: 'object', properties: {} },
      handler: d.handler!,
    }));
}

/**
 * Load env servers, discover tools, return AgentTools for factory append.
 * Empty when LOOP9_MCP_SERVERS unset or discovery fails.
 */
export async function loadMcpAgentToolsFromEnv(
  fetchImpl: typeof fetch = fetch,
): Promise<
  Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    handler: (params: Record<string, unknown>) => Promise<unknown>;
  }>
> {
  const configs = parseMcpServersFromEnv();
  if (configs.length === 0) return [];
  const registry = new ToolRegistry();
  await registerMcpTools(registry, configs, fetchImpl);
  return mcpDefinitionsToAgentTools(registry.getAll());
}
