'use strict';

/** Optional post-hybrid semantic rerank for searchKnowledge (default off). */
export function isRagSearchSemanticRerankEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const v = (env.RAG_SEARCH_SEMANTIC_RERANK || '').toLowerCase();
  return v === 'true' || v === '1';
}
