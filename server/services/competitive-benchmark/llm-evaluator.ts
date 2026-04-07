import { getOpenAIClient } from '../openai-modelfarm';
import type { ScenarioResult } from './benchmark-engine';
import type { CallScenario } from './scenarios';

export interface LLMJudgeResult {
  scenarioId: string;
  coherenceScore: number;
  responseQuality: number;
  naturalness: number;
  interruptionHandling: number;
  taskCompletionAssessment: boolean;
  strengths: string[];
  weaknesses: string[];
  overallVerdict: string;
  reasoning: string;
}

const JUDGE_SYSTEM_PROMPT = `You are an expert evaluator for AI voice agent systems. You will be given a conversation scenario and the AI agent's responses. Evaluate the agent's performance with brutal honesty and precision.

Score each dimension from 1.0 to 10.0 (use decimals for precision):

1. **Coherence** (1-10): Does the conversation flow logically? Are responses relevant to the user's queries? Does the agent maintain context across turns?
2. **Response Quality** (1-10): Are responses helpful, accurate, and complete? Do they address the user's actual needs?
3. **Naturalness** (1-10): Do responses sound like a competent human agent? Is the tone appropriate? Would a caller feel comfortable?
4. **Interruption Handling** (1-10): If the scenario involves topic switches or interruptions, does the agent handle them gracefully?
5. **Task Completion** (true/false): Did the agent successfully complete the intended task of the scenario?

Also provide:
- 2-4 specific strengths
- 2-4 specific weaknesses
- An overall verdict (1-2 sentences)
- Brief reasoning for your scores

Respond ONLY in valid JSON matching this exact schema:
{
  "coherenceScore": <number>,
  "responseQuality": <number>,
  "naturalness": <number>,
  "interruptionHandling": <number>,
  "taskCompletionAssessment": <boolean>,
  "strengths": [<string>, ...],
  "weaknesses": [<string>, ...],
  "overallVerdict": "<string>",
  "reasoning": "<string>"
}`;

export async function evaluateWithLLMJudge(
  result: ScenarioResult,
  scenario: CallScenario
): Promise<LLMJudgeResult> {
  const openai = await getOpenAIClient();

  const conversationLog = scenario.conversationTurns.map((turn, i) => {
    const agentResponse = result.responses[i] || '[No response generated]';
    return `User: ${turn.content}\nAgent: ${agentResponse}`;
  }).join('\n\n');

  const evaluationPrompt = `## Scenario Details
- **Name**: ${scenario.name}
- **Category**: ${scenario.category}
- **Difficulty**: ${scenario.difficulty}
- **Description**: ${scenario.description}
- **Expected Outcome**: ${scenario.expectedOutcome}
- **Expected Tools**: ${(scenario.expectedTools || []).join(', ') || 'None'}
- **Tools Actually Used**: ${result.toolCallsMade.join(', ') || 'None'}

## System Prompt Given to Agent
${scenario.systemPrompt}

## Conversation Transcript
${conversationLog}

## Execution Metrics
- Average Response Latency: ${result.latencyMs}ms
- Total Tokens Used: ${result.totalTokensUsed}
- Errors Encountered: ${result.errors.length > 0 ? result.errors.join('; ') : 'None'}

Evaluate this conversation critically.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: JUDGE_SYSTEM_PROMPT },
        { role: 'user', content: evaluationPrompt },
      ],
      temperature: 0.3,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content || '{}';
    const parsed = JSON.parse(content);

    return {
      scenarioId: result.scenarioId,
      coherenceScore: clampScore(parsed.coherenceScore),
      responseQuality: clampScore(parsed.responseQuality),
      naturalness: clampScore(parsed.naturalness),
      interruptionHandling: clampScore(parsed.interruptionHandling),
      taskCompletionAssessment: !!parsed.taskCompletionAssessment,
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
      overallVerdict: parsed.overallVerdict || 'No verdict provided',
      reasoning: parsed.reasoning || 'No reasoning provided',
    };
  } catch (error: any) {
    return {
      scenarioId: result.scenarioId,
      coherenceScore: 5,
      responseQuality: 5,
      naturalness: 5,
      interruptionHandling: 5,
      taskCompletionAssessment: false,
      strengths: [],
      weaknesses: [`Evaluation failed: ${error.message}`],
      overallVerdict: 'Evaluation could not be completed',
      reasoning: `Error during evaluation: ${error.message}`,
    };
  }
}

function clampScore(value: unknown): number {
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num)) return 5;
  return Math.min(10, Math.max(1, Math.round(num * 10) / 10));
}
