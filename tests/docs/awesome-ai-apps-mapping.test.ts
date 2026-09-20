import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('awesome-ai-apps call-center mapping doc', () => {
  it('shortlists cookbook demos to Loop9 surfaces', () => {
    const path = join(
      process.cwd(),
      'docs/awesome-ai-apps-call-center-mapping.md',
    );
    const text = readFileSync(path, 'utf8');
    expect(text).toContain('Healthcare Voice Contact Center');
    expect(text).toContain('mcp-tool-adapter');
    expect(text).toContain('supervisor.ts');
    expect(text).toContain('rag-knowledge.ts');
    expect(text).toContain('LOOP9_MCP_SERVERS');
    expect(text).toContain('QA_FEEDBACK_LOOP_ENABLED');
    expect(text).toContain('do **not** replace Twilio');
  });
});
