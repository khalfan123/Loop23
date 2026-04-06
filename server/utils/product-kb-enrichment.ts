import { db } from '../db';
import { products } from '../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';

export async function enrichKnowledgeBaseIdsWithProducts(
  knowledgeBaseIds: string[],
  userId: string
): Promise<string[]> {
  try {
    const productKbEntries = await db
      .select({ ragKnowledgeBaseId: products.ragKnowledgeBaseId })
      .from(products)
      .where(
        and(
          eq(products.userId, userId),
          sql`${products.ragKnowledgeBaseId} IS NOT NULL`
        )
      );

    const productKbIds = productKbEntries
      .map(p => p.ragKnowledgeBaseId)
      .filter((id): id is string => id !== null);

    if (productKbIds.length === 0) {
      return knowledgeBaseIds;
    }

    const existingSet = new Set(knowledgeBaseIds);
    const enriched = [...knowledgeBaseIds];
    for (const pkbId of productKbIds) {
      if (!existingSet.has(pkbId)) {
        existingSet.add(pkbId);
        enriched.push(pkbId);
      }
    }

    console.log(`📦 [Product KB] Enriched with ${productKbIds.length} product entries, total: ${enriched.length}`);
    return enriched;
  } catch (error: any) {
    console.error(`📦 [Product KB] Failed to enrich with products:`, error.message);
    return knowledgeBaseIds;
  }
}
