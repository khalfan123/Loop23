import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  parseMcpServersFromEnv,
  shouldExposeMcpTool,
  loop9McpToolName,
  registerMcpTools,
  loadMcpAgentToolsFromEnv,
  type McpServerConfig,
} from '../../../server/services/agent-orchestration/mcp-tool-adapter';
import { ToolRegistry } from '../../../server/services/agent-orchestration/tool-registry';

describe('parseMcpServersFromEnv', () => {
  it('returns empty for unset or invalid JSON', () => {
    expect(parseMcpServersFromEnv(undefined)).toEqual([]);
    expect(parseMcpServersFromEnv('not-json')).toEqual([]);
    expect(parseMcpServersFromEnv('{}')).toEqual([]);
  });

  it('parses valid server configs', () => {
    const raw = JSON.stringify([
      { id: 'docs', url: 'https://example.com/mcp', allowTools: ['search'] },
    ]);
    expect(parseMcpServersFromEnv(raw)).toEqual([
      {
        id: 'docs',
        url: 'https://example.com/mcp',
        headers: undefined,
        allowTools: ['search'],
        readOnly: true,
      },
    ]);
  });
});

describe('shouldExposeMcpTool', () => {
  const base: McpServerConfig = {
    id: 's',
    url: 'http://localhost/mcp',
    readOnly: true,
  };

  it('blocks mutating names when readOnly', () => {
    expect(shouldExposeMcpTool({ name: 'delete_record' }, base)).toBe(false);
    expect(shouldExposeMcpTool({ name: 'search_docs' }, base)).toBe(true);
  });

  it('respects allowTools allowlist', () => {
    const cfg = { ...base, allowTools: ['delete_record'] };
    expect(shouldExposeMcpTool({ name: 'delete_record' }, cfg)).toBe(true);
    expect(shouldExposeMcpTool({ name: 'search_docs' }, cfg)).toBe(false);
  });
});

describe('registerMcpTools (mocked MCP server)', () => {
  it('lists tools and registers as AgentTool-compatible handlers', async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body || '{}'));
      if (body.method === 'tools/list') {
        return {
          ok: true,
          json: async () => ({
            jsonrpc: '2.0',
            id: body.id,
            result: {
              tools: [
                {
                  name: 'search_docs',
                  description: 'Search documentation',
                  inputSchema: {
                    type: 'object',
                    properties: { query: { type: 'string' } },
                    required: ['query'],
                  },
                },
                {
                  name: 'delete_doc',
                  description: 'Delete (should be filtered)',
                },
              ],
            },
          }),
        } as Response;
      }
      if (body.method === 'tools/call') {
        return {
          ok: true,
          json: async () => ({
            jsonrpc: '2.0',
            id: body.id,
            result: { content: [{ type: 'text', text: 'hit' }] },
          }),
        } as Response;
      }
      return { ok: false, status: 500, json: async () => ({}) } as Response;
    });

    const registry = new ToolRegistry();
    const names = await registerMcpTools(
      registry,
      [{ id: 'docs', url: 'http://mcp.test', readOnly: true }],
      fetchImpl as unknown as typeof fetch,
    );

    expect(names).toEqual([loop9McpToolName('docs', 'search_docs')]);
    expect(registry.has(loop9McpToolName('docs', 'delete_doc'))).toBe(false);

    const tool = registry.get(names[0])!;
    const result = (await tool.handler!({ query: 'pricing' })) as {
      ok: boolean;
      result: unknown;
    };
    expect(result.ok).toBe(true);
    expect(result.result).toEqual({
      content: [{ type: 'text', text: 'hit' }],
    });
  });
});

describe('loadMcpAgentToolsFromEnv', () => {
  const prev = process.env.LOOP9_MCP_SERVERS;

  afterEach(() => {
    if (prev === undefined) delete process.env.LOOP9_MCP_SERVERS;
    else process.env.LOOP9_MCP_SERVERS = prev;
  });

  it('returns empty when env unset', async () => {
    delete process.env.LOOP9_MCP_SERVERS;
    expect(await loadMcpAgentToolsFromEnv()).toEqual([]);
  });

  it('returns AgentTool-shaped entries for Bedrock factory', async () => {
    process.env.LOOP9_MCP_SERVERS = JSON.stringify([
      { id: 'crm', url: 'http://mcp.crm' },
    ]);
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body || '{}'));
      return {
        ok: true,
        json: async () => ({
          jsonrpc: '2.0',
          id: body.id,
          result: {
            tools: [
              {
                name: 'lookup_customer',
                description: 'CRM lookup',
                inputSchema: { type: 'object', properties: {} },
              },
            ],
          },
        }),
      } as Response;
    });

    const tools = await loadMcpAgentToolsFromEnv(
      fetchImpl as unknown as typeof fetch,
    );
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe(loop9McpToolName('crm', 'lookup_customer'));
    expect(typeof tools[0].handler).toBe('function');
    expect(tools[0].parameters).toBeTruthy();
  });
});
