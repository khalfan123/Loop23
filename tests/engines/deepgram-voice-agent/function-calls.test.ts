import { describe, it, expect, vi } from 'vitest';
import { buildFunctionCallResponses } from '../../../server/engines/deepgram-voice-agent/services/agent-bridge.service';

describe('buildFunctionCallResponses', () => {
  it('answers a KB lookup and echoes the id/name for the FunctionCallResponse', async () => {
    const kbLookup = vi.fn(async (q: string) => `KB result for ${q}`);
    const frames = await buildFunctionCallResponses(
      {
        type: 'FunctionCallRequest',
        functions: [{ id: 'fc-1', name: 'lookup_knowledge_base', arguments: '{"query":"opening hours"}' }],
      },
      kbLookup
    );
    expect(kbLookup).toHaveBeenCalledWith('opening hours');
    expect(frames).toEqual([
      { type: 'FunctionCallResponse', id: 'fc-1', name: 'lookup_knowledge_base', content: 'KB result for opening hours' },
    ]);
  });

  it('answers multiple functions in one request', async () => {
    const kbLookup = vi.fn(async (q: string) => `r:${q}`);
    const frames = await buildFunctionCallResponses(
      {
        functions: [
          { id: 'a', name: 'lookup_knowledge_base', arguments: '{"query":"one"}' },
          { id: 'b', name: 'lookup_knowledge_base', arguments: '{"query":"two"}' },
        ],
      },
      kbLookup
    );
    expect(frames.map(f => f.content)).toEqual(['r:one', 'r:two']);
    expect(frames.map(f => f.id)).toEqual(['a', 'b']);
  });

  it('accepts object arguments (not just JSON strings) and function_call_id', async () => {
    const kbLookup = vi.fn(async (q: string) => `r:${q}`);
    const frames = await buildFunctionCallResponses(
      { function_call_id: 'x', name: 'lookup_knowledge_base', arguments: { query: 'plans' } },
      kbLookup
    );
    expect(frames[0]).toMatchObject({ id: 'x', content: 'r:plans' });
  });

  it('returns a graceful message when the KB lookup throws', async () => {
    const kbLookup = vi.fn(async () => { throw new Error('rag down'); });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const frames = await buildFunctionCallResponses(
      { functions: [{ id: '1', name: 'lookup_knowledge_base', arguments: '{"query":"x"}' }] },
      kbLookup
    );
    expect(frames[0].content).toMatch(/could not be reached/i);
    errSpy.mockRestore();
  });

  it('handles a missing/empty query without calling the lookup', async () => {
    const kbLookup = vi.fn(async () => 'unused');
    const frames = await buildFunctionCallResponses(
      { functions: [{ id: '1', name: 'lookup_knowledge_base', arguments: '{}' }] },
      kbLookup
    );
    expect(kbLookup).not.toHaveBeenCalled();
    expect(frames[0].content).toMatch(/no search query/i);
  });

  it('reports unsupported functions without crashing', async () => {
    const frames = await buildFunctionCallResponses(
      { functions: [{ id: '1', name: 'transfer_call', arguments: '{}' }] },
      vi.fn()
    );
    expect(frames[0].content).toMatch(/unsupported function/i);
  });

  it('answers with "no KB configured" behavior when kbLookup is absent', async () => {
    const frames = await buildFunctionCallResponses(
      { functions: [{ id: '1', name: 'lookup_knowledge_base', arguments: '{"query":"x"}' }] },
      undefined
    );
    // No lookup wired → treated as unsupported rather than crashing the call
    expect(frames[0].content).toMatch(/unsupported function/i);
  });

  it('returns no frames for an event with no functions', async () => {
    const frames = await buildFunctionCallResponses({ type: 'FunctionCallRequest' }, vi.fn());
    expect(frames).toEqual([]);
  });
});
