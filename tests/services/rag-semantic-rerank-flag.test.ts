import { describe, it, expect } from 'vitest';
import { isRagSearchSemanticRerankEnabled } from '../../server/services/rag-knowledge-flags';

describe('RAG_SEARCH_SEMANTIC_RERANK flag', () => {
  it('defaults off so lookup_knowledge_base hybrid path is unchanged', () => {
    expect(isRagSearchSemanticRerankEnabled({})).toBe(false);
  });

  it('enables optional post-hybrid semantic rerank', () => {
    expect(
      isRagSearchSemanticRerankEnabled({ RAG_SEARCH_SEMANTIC_RERANK: 'true' }),
    ).toBe(true);
    expect(
      isRagSearchSemanticRerankEnabled({ RAG_SEARCH_SEMANTIC_RERANK: '1' }),
    ).toBe(true);
  });
});
