import { awsBedrockService, estimateTokenCount, type BedrockResponse } from './aws-bedrock';
import { RAGKnowledgeService } from './rag-knowledge';
import type { KnowledgeChunk } from '@shared/schema';

export type ReasoningMode = 'quick' | 'deep' | 'expert';
export type CallerSentiment = 'frustrated' | 'confused' | 'neutral' | 'happy' | 'urgent';

export interface ReasoningInput {
  query: string;
  knowledgeBaseIds: string[];
  userId: string;
  mode: ReasoningMode;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  maxResults?: number;
  callerSentiment?: CallerSentiment;
  callTopics?: string[];
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

    if (!input.callerSentiment) {
      input.callerSentiment = this.detectSentiment(input.conversationHistory);
    }

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
    const response = await this.singleShotAnswer(input.query, context, input.conversationHistory, input.callerSentiment);
    trackStep(traces, 'answer_generation', answerStart, `Generated answer (${estimateTokenCount(response.content)} tokens, sentiment: ${input.callerSentiment || 'neutral'})`);

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
    const cotResult = await this.chainOfThoughtAnswer(input.query, context, subQuestions, input.conversationHistory, input.callerSentiment);
    trackStep(traces, 'chain_of_thought', cotStart, `CoT reasoning completed (sentiment: ${input.callerSentiment || 'neutral'})`);

    const confidence = this.computeConfidence(reranked, cotResult.answer);

    let finalAnswer = confidence < 0.4
      ? this.addUncertaintyAcknowledgment(cotResult.answer)
      : cotResult.answer;
    finalAnswer = this.adaptAnswerForSentiment(finalAnswer, input.callerSentiment || 'neutral');

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
    const cotResult = await this.chainOfThoughtAnswer(input.query, context, subQuestions, input.conversationHistory, input.callerSentiment);
    trackStep(traces, 'chain_of_thought', cotStart, `CoT reasoning completed (sentiment: ${input.callerSentiment || 'neutral'})`);

    const verifyStart = Date.now();
    const verified = await this.selfVerify(input.query, cotResult.answer, context);
    trackStep(traces, 'self_verification', verifyStart, `Verification: ${verified.isConsistent ? 'consistent' : 'revised'}`);

    const finalAnswer = verified.isConsistent ? cotResult.answer : verified.revisedAnswer;
    const confidence = this.computeConfidence(reranked, finalAnswer);

    let adjustedAnswer = confidence < 0.4
      ? this.addUncertaintyAcknowledgment(finalAnswer)
      : finalAnswer;
    adjustedAnswer = this.adaptAnswerForSentiment(adjustedAnswer, input.callerSentiment || 'neutral');

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
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
    sentiment?: CallerSentiment
  ): Promise<BedrockResponse> {
    const model = awsBedrockService.selectModelForTask('quick');
    const detectedSentiment = sentiment || this.detectSentiment(conversationHistory);
    const toneGuidance = this.getSentimentToneGuidance(detectedSentiment);
    const voiceRules = this.getVoiceFormattingRules();

    const historySection = conversationHistory && conversationHistory.length > 0
      ? `\n\nConversation history:\n${conversationHistory.slice(-6).map(m => `${m.role}: ${m.content}`).join('\n')}\n`
      : '';

    return awsBedrockService.invoke({
      model,
      messages: [{
        role: 'user',
        content: `${historySection}\nKnowledge context:\n${context}\n\nQuestion: ${query}`,
      }],
      systemPrompt: `You are a friendly, professional call center agent speaking to a customer on the phone. Answer using ONLY the provided knowledge context. Be warm, natural, and genuinely helpful.

CRITICAL — UNDERSTAND FIRST, THEN ANSWER:
Before answering, internally ask yourself: "What is this person REALLY asking? What do they actually need?" 
- If the question is ambiguous, your response should be a clarifying question, not a guess.
- Start your response by acknowledging what they asked: "So you're asking about..." or "Right, you want to know about..."
- Only THEN provide the answer.
- If the question has multiple possible meanings, address the most likely one and briefly mention the other: "If you meant something else, just let me know."

${toneGuidance}

${voiceRules}

If the context doesn't contain enough information, acknowledge it naturally: "I don't have the specific details on that right now, but let me see what I can find..." — never just say "information not available."`,
      maxTokens: 1024,
      temperature: 0.5,
    });
  }

  private async chainOfThoughtAnswer(
    query: string,
    context: string,
    subQuestions: SubQuestion[],
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
    sentiment?: CallerSentiment
  ): Promise<{ answer: string; traces: ReasoningTrace[] }> {
    const traces: ReasoningTrace[] = [];
    const model = awsBedrockService.selectModelForTask('reasoning');
    const detectedSentiment = sentiment || this.detectSentiment(conversationHistory);
    const toneGuidance = this.getSentimentToneGuidance(detectedSentiment);
    const voiceRules = this.getVoiceFormattingRules();

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
      systemPrompt: `You are a professional call center agent having a real phone conversation. Follow this internal process:

1. COMPREHEND: What is the caller REALLY asking? Restate their question in your own words. Are they asking about A or B? Is there ambiguity? What's their emotional state? What do they NEED vs what did they literally say?
2. EVIDENCE: Find specific facts in the knowledge context that directly address their ACTUAL need. Ignore irrelevant information even if it's in the context.
3. REASON: Connect the evidence, note gaps. Is your answer actually addressing what they asked? Double-check. Consider what they might need to know next.
4. SYNTHESIZE: Craft a natural spoken response — start by acknowledging their question ("So you're asking about..."), then provide the answer, then offer a follow-up.

${toneGuidance}

${voiceRules}

Structure your response as:
<thinking>
[Step 1 — Restate what the caller is actually asking and why. Identify any ambiguity.]
[Step 2 — What evidence from the context addresses this?]
[Step 3 — Is my answer actually relevant to what they asked? Am I answering the right question?]
[Step 4 — How should I phrase this naturally for a phone conversation?]
</thinking>

<answer>
[Your spoken response — start by acknowledging their question, then answer naturally, as if you're on the phone with them. Keep it focused on exactly what they asked.]
</answer>

Rules:
- Use ONLY information from the provided context
- ALWAYS start by acknowledging or restating what the caller asked — never jump straight into an answer
- If the question is ambiguous, ASK for clarification instead of guessing
- If information is incomplete, say it naturally: "I don't have that specific detail right now, but here's what I do know..."
- Reference specific details (prices, names, steps) when available
- Sound like a real person, not a bot reading a script
- After answering, suggest one related thing they might want to know
- NEVER provide information the caller didn't ask about just because it's in the context`,
      maxTokens: 2048,
      temperature: 0.5,
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

  detectSentiment(conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>): CallerSentiment {
    if (!conversationHistory || conversationHistory.length === 0) return 'neutral';

    const recentUserMessages = conversationHistory
      .filter(m => m.role === 'user')
      .slice(-3)
      .map(m => m.content.toLowerCase())
      .join(' ');

    const frustratedSignals = [
      'frustrated', 'angry', 'ridiculous', 'unacceptable', 'terrible', 'worst',
      'waste of time', 'not working', 'still broken', 'again', 'already told you',
      'this is insane', 'what the hell', 'damn', 'fix this', 'get me a manager',
      'supervisor', 'complaint', 'refund', 'cancel', 'sue', 'lawyer', 'horrible',
      'disgusting', 'fed up', 'sick of', 'tired of', 'enough', 'unbelievable',
      '!', 'seriously?', 'are you kidding',
    ];

    const confusedSignals = [
      'confused', 'don\'t understand', 'what do you mean', 'how does', 'what is',
      'i\'m not sure', 'can you explain', 'lost', 'no idea', 'help me understand',
      'what\'s the difference', 'which one', 'so basically', 'wait',
      'i don\'t get', 'huh', 'sorry what', 'come again',
    ];

    const urgentSignals = [
      'urgent', 'emergency', 'asap', 'right now', 'immediately', 'today',
      'can\'t wait', 'need this now', 'hurry', 'time sensitive', 'deadline',
      'flight', 'boarding', 'airport', 'leaving', 'departing', 'traveling tomorrow',
      'stuck', 'stranded', 'no connection', 'no service',
    ];

    const happySignals = [
      'thanks', 'thank you', 'great', 'awesome', 'perfect', 'wonderful',
      'excellent', 'amazing', 'love it', 'happy', 'pleased', 'appreciate',
      'that helps', 'exactly', 'brilliant', 'fantastic',
    ];

    const frustratedScore = frustratedSignals.filter(s => recentUserMessages.includes(s)).length;
    const confusedScore = confusedSignals.filter(s => recentUserMessages.includes(s)).length;
    const urgentScore = urgentSignals.filter(s => recentUserMessages.includes(s)).length;
    const happyScore = happySignals.filter(s => recentUserMessages.includes(s)).length;

    const scores: [CallerSentiment, number][] = [
      ['frustrated', frustratedScore * 2],
      ['urgent', urgentScore * 1.5],
      ['confused', confusedScore],
      ['happy', happyScore],
      ['neutral', 0.5],
    ];

    scores.sort((a, b) => b[1] - a[1]);
    return scores[0][1] > 0.5 ? scores[0][0] : 'neutral';
  }

  getSentimentToneGuidance(sentiment: CallerSentiment): string {
    const toneMap: Record<CallerSentiment, string> = {
      frustrated: `CALLER SENTIMENT: FRUSTRATED
TONE ADAPTATION:
- Lead with empathy FIRST, before any solution: "I completely understand how frustrating this must be, and I'm sorry you're dealing with this."
- Validate their feelings: "You're absolutely right to be upset about this."
- Move quickly to resolution — no fluff, no upselling, no filler
- Use shorter sentences, get to the point fast
- Offer concrete next steps: "Here's exactly what I'm going to do for you right now..."
- If you can't resolve it, acknowledge that clearly and offer escalation
- NEVER be dismissive, defensive, or say "I understand" without following up with action
- Maximum response: 3 sentences before asking if they'd like you to proceed`,

      confused: `CALLER SENTIMENT: CONFUSED
TONE ADAPTATION:
- Be patient and reassuring: "No worries at all — this can definitely be a bit confusing at first."
- Break things down into simple, numbered steps: "First... then... and finally..."
- Use analogies to explain technical concepts: "Think of it like..."
- Check understanding after each step: "Does that make sense so far?"
- Avoid jargon — say "your phone's internet settings" not "APN configuration"
- Repeat key information if they seem lost
- Offer to walk them through it: "Would you like me to go through this step by step?"
- Maximum response: 4 sentences, then pause for confirmation`,

      neutral: `CALLER SENTIMENT: NEUTRAL
TONE ADAPTATION:
- Professional, friendly, and efficient
- Answer directly and clearly
- Offer one related suggestion after answering
- Keep responses 2-4 sentences
- End with a natural follow-up: "Is there anything else I can help you with?"`,

      happy: `CALLER SENTIMENT: POSITIVE/HAPPY
TONE ADAPTATION:
- Match their energy with enthusiasm: "That's great to hear!"
- This is a good moment for proactive suggestions: "Since you enjoyed X, you might also love..."
- Keep the conversation flowing naturally
- If appropriate, mention referral programs or upcoming features
- Be genuinely warm, not corporate-fake
- Maximum response: 3-4 sentences, keep the positive momentum`,

      urgent: `CALLER SENTIMENT: URGENT
TONE ADAPTATION:
- Acknowledge urgency immediately: "I can tell this is time-sensitive — let me help you right away."
- Skip pleasantries, go straight to the solution
- Use action-oriented language: "Here's what you need to do right now..."
- Be decisive — don't hedge or say "maybe" or "it depends"
- Give the single best option first, alternatives later only if asked
- Maximum response: 2-3 sentences, pure action
- If it's a travel emergency, prioritize getting them connected ASAP`,
    };

    return toneMap[sentiment] || toneMap.neutral;
  }

  getVoiceFormattingRules(): string {
    return `VOICE OUTPUT RULES (CRITICAL — this response will be SPOKEN aloud):
- NEVER read URLs aloud. Instead say "you can find that on our website" or "I can send you a link"
- NEVER list bullet points. Convert to flowing sentences: "You'll need three things: first..., second..., and finally..."
- Use contractions naturally: I'm, you'll, we're, that's, it's, don't, can't, won't
- Replace jargon: "APN configuration" → "your phone's internet settings", "QR code provisioning" → "scanning the code we sent you"
- Add natural transitions: "now", "also", "by the way", "one more thing"
- Keep responses to 4 sentences maximum. If more detail is needed, say "Would you like me to explain more about that?"
- End with a natural handoff: a follow-up question or offer to help further
- NEVER say "according to our records" or "as per our policy" — too corporate. Say "from what I can see" or "our guidelines say"`;
  }

  adaptAnswerForSentiment(answer: string, sentiment: CallerSentiment): string {
    if (sentiment === 'neutral') return answer;

    const sentenceLimits: Record<CallerSentiment, number> = {
      frustrated: 3,
      confused: 4,
      neutral: 4,
      happy: 4,
      urgent: 3,
    };

    const sentences = answer.match(/[^.!?]+[.!?]+/g) || [answer];
    const limit = sentenceLimits[sentiment];
    if (sentences.length > limit) {
      return sentences.slice(0, limit).join(' ').trim();
    }

    return answer;
  }
}

export const reasoningEngine = new ReasoningEngine();
