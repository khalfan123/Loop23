import { awsBedrockService, estimateTokenCount, type BedrockResponse } from './aws-bedrock';
import { RAGKnowledgeService } from './rag-knowledge';
import type { KnowledgeChunk } from '@shared/schema';

export type ReasoningMode = 'quick' | 'deep' | 'expert';

export interface ReasoningInput {
  query: string;
  knowledgeBaseIds: string[];
  userId: string;
  mode: ReasoningMode;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  maxResults?: number;
}

export interface ReasoningTrace {
  step: string;
  detail: string;
  durationMs: number;
}

export interface ReasoningResult {
  answer: string;
  confidence: number;
  reasoning: ReasoningTrace[];
  mode: ReasoningMode;
  sourcesUsed: number;
  totalDurationMs: number;
}

interface SubQuestion {
  question: string;
  intent: string;
}

interface ScoredChunk {
  chunk: KnowledgeChunk;
  score: number;
  source: string;
}

function trackStep(traces: ReasoningTrace[], step: string, startTime: number, detail: string) {
  traces.push({ step, detail, durationMs: Date.now() - startTime });
}

export class ReasoningEngine {

  async process(input: ReasoningInput): Promise<ReasoningResult> {
    const overallStart = Date.now();

    switch (input.mode) {
      case 'quick':
        return this.processQuick(input, overallStart);
      case 'deep':
        return this.processDeep(input, overallStart);
      case 'expert':
        return this.processExpert(input, overallStart);
      default:
        return this.processQuick(input, overallStart);
    }
  }

  private async processQuick(input: ReasoningInput, overallStart: number): Promise<ReasoningResult> {
    const traces: ReasoningTrace[] = [];

    const retrievalStart = Date.now();
    const results = await RAGKnowledgeService.searchKnowledge(
      input.query,
      input.knowledgeBaseIds,
      input.userId,
      input.maxResults || 5
    );
    trackStep(traces, 'retrieval', retrievalStart, `Retrieved ${results.length} chunks`);

    const context = this.buildContext(results);

    const answerStart = Date.now();
    const response = await this.singleShotAnswer(input.query, context, input.conversationHistory);
    trackStep(traces, 'answer_generation', answerStart, `Generated answer (${estimateTokenCount(response.content)} tokens)`);

    const confidence = this.computeConfidence(results, response.content);

    return {
      answer: response.content,
      confidence,
      reasoning: traces,
      mode: 'quick',
      sourcesUsed: results.length,
      totalDurationMs: Date.now() - overallStart,
    };
  }

  private async processDeep(input: ReasoningInput, overallStart: number): Promise<ReasoningResult> {
    const traces: ReasoningTrace[] = [];

    const decompStart = Date.now();
    const subQuestions = await this.decomposeQuery(input.query);
    trackStep(traces, 'query_decomposition', decompStart, `Decomposed into ${subQuestions.length} sub-questions`);

    const hopStart = Date.now();
    const allResults: ScoredChunk[] = [];
    for (const sq of subQuestions) {
      const results = await RAGKnowledgeService.searchKnowledge(
        sq.question,
        input.knowledgeBaseIds,
        input.userId,
        input.maxResults || 8
      );
      allResults.push(...results);
    }
    trackStep(traces, 'multi_hop_retrieval', hopStart, `Retrieved ${allResults.length} total chunks across ${subQuestions.length} queries`);

    const rerankStart = Date.now();
    const deduped = this.deduplicateChunks(allResults);
    const reranked = await this.semanticRerank(input.query, deduped, 8);
    trackStep(traces, 'reranking', rerankStart, `Reranked to top ${reranked.length} chunks from ${deduped.length}`);

    const context = this.buildContext(reranked);

    const cotStart = Date.now();
    const cotResult = await this.chainOfThoughtAnswer(input.query, context, subQuestions, input.conversationHistory);
    trackStep(traces, 'chain_of_thought', cotStart, `CoT reasoning completed`);

    const confidence = this.computeConfidence(reranked, cotResult.answer);

    const finalAnswer = confidence < 0.4
      ? this.addUncertaintyAcknowledgment(cotResult.answer)
      : cotResult.answer;

    return {
      answer: finalAnswer,
      confidence,
      reasoning: [...traces, ...cotResult.traces],
      mode: 'deep',
      sourcesUsed: reranked.length,
      totalDurationMs: Date.now() - overallStart,
    };
  }

  private async processExpert(input: ReasoningInput, overallStart: number): Promise<ReasoningResult> {
    const traces: ReasoningTrace[] = [];

    const decompStart = Date.now();
    const subQuestions = await this.decomposeQuery(input.query);
    trackStep(traces, 'query_decomposition', decompStart, `Decomposed into ${subQuestions.length} sub-questions`);

    const hopStart = Date.now();
    const allResults: ScoredChunk[] = [];
    for (const sq of subQuestions) {
      const results = await RAGKnowledgeService.searchKnowledge(
        sq.question,
        input.knowledgeBaseIds,
        input.userId,
        input.maxResults || 15
      );
      allResults.push(...results);
    }
    trackStep(traces, 'multi_hop_retrieval', hopStart, `Retrieved ${allResults.length} total chunks across ${subQuestions.length} queries`);

    const rerankStart = Date.now();
    const deduped = this.deduplicateChunks(allResults);
    const reranked = await this.semanticRerank(input.query, deduped, 10);
    trackStep(traces, 'reranking', rerankStart, `Reranked to top ${reranked.length} chunks from ${deduped.length}`);

    const context = this.buildContext(reranked);

    const cotStart = Date.now();
    const cotResult = await this.chainOfThoughtAnswer(input.query, context, subQuestions, input.conversationHistory);
    trackStep(traces, 'chain_of_thought', cotStart, `CoT reasoning completed`);

    const verifyStart = Date.now();
    const verified = await this.selfVerify(input.query, cotResult.answer, context);
    trackStep(traces, 'self_verification', verifyStart, `Verification: ${verified.isConsistent ? 'consistent' : 'revised'}`);

    const finalAnswer = verified.isConsistent ? cotResult.answer : verified.revisedAnswer;
    const confidence = this.computeConfidence(reranked, finalAnswer);

    const adjustedAnswer = confidence < 0.4
      ? this.addUncertaintyAcknowledgment(finalAnswer)
      : finalAnswer;

    return {
      answer: adjustedAnswer,
      confidence,
      reasoning: [...traces, ...cotResult.traces],
      mode: 'expert',
      sourcesUsed: reranked.length,
      totalDurationMs: Date.now() - overallStart,
    };
  }

  private async decomposeQuery(query: string): Promise<SubQuestion[]> {
    const wordCount = query.split(/\s+/).length;
    if (wordCount <= 8) {
      return [{ question: query, intent: 'direct' }];
    }

    try {
      const model = awsBedrockService.selectModelForTask('quick');
      const response = await awsBedrockService.invoke({
        model,
        messages: [{
          role: 'user',
          content: query,
        }],
        systemPrompt: `You are a query decomposition assistant. Break the user's question into 2-4 simpler sub-questions that together cover the full intent. If the question is already simple, return it as-is.

Return ONLY a JSON array of objects with "question" and "intent" fields. No explanation.
Example: [{"question":"What products do you offer?","intent":"product_listing"},{"question":"What are the prices?","intent":"pricing"}]`,
        maxTokens: 500,
        temperature: 0.2,
      });

      const parsed = JSON.parse(response.content);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].question) {
        console.log(`[ReasoningEngine] Decomposed query into ${parsed.length} sub-questions`);
        return parsed;
      }
    } catch (e: any) {
      console.error(`[ReasoningEngine] Query decomposition failed: ${e.message}`);
    }

    return [{ question: query, intent: 'direct' }];
  }

  private async semanticRerank(
    query: string,
    chunks: ScoredChunk[],
    topK: number
  ): Promise<ScoredChunk[]> {
    if (chunks.length <= topK) return chunks;

    try {
      const model = awsBedrockService.selectModelForTask('rerank');
      const chunkSummaries = chunks.slice(0, 20).map((c, i) => {
        const text = c.chunk.chunkText.substring(0, 300);
        return `[${i}] ${text}`;
      }).join('\n\n');

      const response = await awsBedrockService.invoke({
        model,
        messages: [{
          role: 'user',
          content: `Query: "${query}"\n\nPassages:\n${chunkSummaries}`,
        }],
        systemPrompt: `You are a relevance ranking assistant. Given a query and numbered passages, return the indices of the ${topK} most relevant passages in order of relevance.

Return ONLY a JSON array of indices. Example: [3,0,7,1,5]`,
        maxTokens: 200,
        temperature: 0,
      });

      const indices: number[] = JSON.parse(response.content);
      if (Array.isArray(indices) && indices.length > 0) {
        const reranked: ScoredChunk[] = [];
        for (const idx of indices) {
          if (idx >= 0 && idx < chunks.length) {
            reranked.push(chunks[idx]);
          }
        }
        if (reranked.length > 0) {
          console.log(`[ReasoningEngine] Reranked ${chunks.length} chunks to top ${reranked.length}`);
          return reranked;
        }
      }
    } catch (e: any) {
      console.error(`[ReasoningEngine] Reranking failed, using original order: ${e.message}`);
    }

    return chunks.slice(0, topK);
  }

  private async singleShotAnswer(
    query: string,
    context: string,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<BedrockResponse> {
    const model = awsBedrockService.selectModelForTask('quick');

    const historySection = conversationHistory && conversationHistory.length > 0
      ? `\n\nConversation history:\n${conversationHistory.slice(-6).map(m => `${m.role}: ${m.content}`).join('\n')}\n`
      : '';

    return awsBedrockService.invoke({
      model,
      messages: [{
        role: 'user',
        content: `${historySection}\nKnowledge context:\n${context}\n\nQuestion: ${query}`,
      }],
      systemPrompt: `You are a knowledgeable assistant. Answer the user's question using ONLY the provided knowledge context. Be accurate, concise, and natural. If the context doesn't contain enough information, say so honestly rather than guessing.`,
      maxTokens: 1024,
      temperature: 0.3,
    });
  }

  private async chainOfThoughtAnswer(
    query: string,
    context: string,
    subQuestions: SubQuestion[],
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<{ answer: string; traces: ReasoningTrace[] }> {
    const traces: ReasoningTrace[] = [];
    const model = awsBedrockService.selectModelForTask('reasoning');

    const historySection = conversationHistory && conversationHistory.length > 0
      ? `\nConversation history:\n${conversationHistory.slice(-10).map(m => `${m.role}: ${m.content}`).join('\n')}\n`
      : '';

    const subQSection = subQuestions.length > 1
      ? `\nSub-questions to address:\n${subQuestions.map((sq, i) => `${i + 1}. ${sq.question} (intent: ${sq.intent})`).join('\n')}\n`
      : '';

    const cotStart = Date.now();
    const response = await awsBedrockService.invoke({
      model,
      messages: [{
        role: 'user',
        content: `${historySection}${subQSection}\nKnowledge context:\n${context}\n\nUser's question: ${query}`,
      }],
      systemPrompt: `You are an expert reasoning assistant. Follow this process:

1. ANALYZE: Identify what the user is really asking (consider conversation history if provided).
2. EVIDENCE: For each sub-question, find relevant evidence in the knowledge context.
3. REASON: Connect the evidence logically, noting any gaps or contradictions.
4. SYNTHESIZE: Combine findings into a coherent, natural-sounding answer.

Structure your response as:
<thinking>
[Your step-by-step reasoning — this will be hidden from the user]
</thinking>

<answer>
[Your final natural response to the user — conversational, accurate, helpful]
</answer>

Rules:
- Use ONLY information from the provided context
- If information is incomplete, acknowledge it naturally
- Reference specific details (numbers, names, features) when available
- Be conversational and human-like, not robotic`,
      maxTokens: 2048,
      temperature: 0.4,
    });

    const content = response.content;

    const thinkingMatch = content.match(/<thinking>([\s\S]*?)<\/thinking>/);
    const answerMatch = content.match(/<answer>([\s\S]*?)<\/answer>/);

    if (thinkingMatch) {
      trackStep(traces, 'cot_reasoning', cotStart, thinkingMatch[1].trim().substring(0, 500));
    }

    const answer = answerMatch ? answerMatch[1].trim() : content.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();

    return { answer, traces };
  }

  private async selfVerify(
    query: string,
    answer: string,
    context: string
  ): Promise<{ isConsistent: boolean; revisedAnswer: string }> {
    try {
      const model = awsBedrockService.selectModelForTask('rerank');

      const response = await awsBedrockService.invoke({
        model,
        messages: [{
          role: 'user',
          content: `Original question: "${query}"\n\nProposed answer: "${answer}"\n\nSource context:\n${context.substring(0, 4000)}`,
        }],
        systemPrompt: `You are a fact-checking assistant. Verify whether the proposed answer is consistent with and supported by the source context.

Return ONLY a JSON object:
{
  "isConsistent": true/false,
  "issues": ["list of factual issues found, if any"],
  "revisedAnswer": "corrected answer if inconsistent, or empty string if consistent"
}`,
        maxTokens: 1024,
        temperature: 0,
      });

      const parsed = JSON.parse(response.content);
      return {
        isConsistent: parsed.isConsistent !== false,
        revisedAnswer: parsed.revisedAnswer || answer,
      };
    } catch (e: any) {
      console.error(`[ReasoningEngine] Self-verification failed: ${e.message}`);
      return { isConsistent: true, revisedAnswer: answer };
    }
  }

  private buildContext(results: ScoredChunk[]): string {
    if (results.length === 0) return 'No relevant knowledge found.';

    const selected = this.selectContextChunks(results);

    return selected
      .map((r, i) => `[Source ${i + 1} — Relevance: ${Math.round(r.score * 100)}%]\n${r.chunk.chunkText}`)
      .join('\n\n---\n\n');
  }

  private selectContextChunks(results: ScoredChunk[]): ScoredChunk[] {
    const maxContextTokens = 6000;
    const selected: ScoredChunk[] = [];
    let tokenCount = 0;

    const sorted = [...results].sort((a, b) => b.score - a.score);

    for (const result of sorted) {
      const chunkTokens = estimateTokenCount(result.chunk.chunkText);
      if (tokenCount + chunkTokens > maxContextTokens) break;
      selected.push(result);
      tokenCount += chunkTokens;
    }

    return selected;
  }

  private deduplicateChunks(chunks: ScoredChunk[]): ScoredChunk[] {
    const seen = new Map<string, ScoredChunk>();

    for (const chunk of chunks) {
      const key = chunk.chunk.chunkText.substring(0, 100);
      const existing = seen.get(key);
      if (!existing || chunk.score > existing.score) {
        seen.set(key, chunk);
      }
    }

    return Array.from(seen.values());
  }

  private computeConfidence(results: ScoredChunk[], answer: string): number {
    if (results.length === 0) return 0.1;

    const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
    const topScore = results[0]?.score || 0;
    const coverageBonus = Math.min(results.length / 5, 1) * 0.1;
    const answerLength = answer.length;
    const lengthPenalty = answerLength < 20 ? -0.2 : 0;

    const hedgingPhrases = [
      'i\'m not sure', 'i don\'t have', 'no information',
      'cannot find', 'not available', 'unclear',
      'i\'m unable', 'don\'t know', 'not certain',
    ];
    const hedgingPenalty = hedgingPhrases.some(p => answer.toLowerCase().includes(p)) ? -0.15 : 0;

    const raw = (avgScore * 0.4) + (topScore * 0.4) + coverageBonus + lengthPenalty + hedgingPenalty;
    return Math.max(0, Math.min(1, raw));
  }

  private addUncertaintyAcknowledgment(answer: string): string {
    const prefixes = [
      "Based on what I found, though the information may be limited: ",
      "I want to be upfront that I may not have complete information on this, but here's what I found: ",
      "From the available information, here's my best understanding: ",
    ];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    return prefix + answer;
  }
}

export const reasoningEngine = new ReasoningEngine();
