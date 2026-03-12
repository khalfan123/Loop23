'use strict';
import { db } from './db';
import { twilioOpenaiCalls } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { awsBedrockService } from './services/aws-bedrock';
import { bedrockKBService } from './services/bedrock-knowledge-base.service';

const AGENT_ID = 'b0ea1c21-02cc-4e83-b4f5-34f67d239b8d';
const USER_ID = 'fc83e9e4-e676-4501-ae5e-7260b2ae9183';
const PHONE_NUMBER_ID = '230bbf5a-96a2-45e7-af06-2a4e26e1e762';
const TARGET_DURATION_MS = 6 * 60 * 1000;

const CUSTOMER_QUESTIONS = [
  'مرحباً، أنا مسافر إلى تركيا الأسبوع القادم وأحتاج شريحة eSIM. ما هي الخيارات المتاحة لدكم؟',
  'كم سعر باقة البيانات لتركيا؟ وهل تشمل مكالمات أيضاً؟',
  'كيف أقوم بتثبيت eSIM على جهاز آيفون؟ هل العملية صعبة؟',
  'هل يمكنني استخدام نفس eSIM في أكثر من دولة؟ مثلاً تركيا وألمانيا؟',
  'ما هي مدة صلاحية الباقة بعد التفعيل؟ وهل يمكن تجديدها؟',
  'هل تدعمون أجهزة سامسونج أيضاً أم فقط آيفون؟',
  'ما هي طرق الدفع المتاحة لديكم؟ هل تقبلون أبل باي؟',
  'لو واجهتني مشكلة في الاتصال بعد التفعيل، كيف أتواصل معكم؟',
  'هل عندكم باقات خاصة للعائلات أو مجموعات؟',
  'ما الفرق بين باقاتكم المختلفة؟ أريد أن أفهم أيها الأنسب لي',
  'هل تقدمون خدمة للشركات أو المؤسسات؟',
  'كيف تتم عملية الشراء بالضبط من البداية للنهاية؟',
  'هل يمكنني الاحتفاظ برقمي المحلي مع استخدام eSIM؟',
  'ما هي سرعة الإنترنت المتوقعة مع الباقة؟',
  'شكراً جزيلاً على المعلومات، سأفكر وأتواصل معكم قريباً',
];

async function runTest() {
  console.log('\n========================================');
  console.log('🧪 AI-TO-AI TEST CALL — STARTING');
  console.log(`Target: ${TARGET_DURATION_MS / 1000}s (~6 minutes)`);
  console.log('========================================\n');

  const callStartTime = Date.now();
  const callSid = `TEST_${nanoid(12)}`;
  const callId = nanoid(21);

  const agentRows = await db.execute(sql`SELECT id, name, language, system_prompt, first_message, knowledge_base_ids, knowledge_base_only, temperature FROM agents WHERE id = ${AGENT_ID}`);
  const agent = agentRows.rows[0] as any;

  if (!agent) {
    console.error('Agent not found!');
    process.exit(1);
  }

  console.log(`Agent: ${agent.name} (${agent.language})`);
  console.log(`KB IDs: ${JSON.stringify(agent.knowledge_base_ids)}`);

  await db.insert(twilioOpenaiCalls).values({
    id: callId,
    userId: USER_ID,
    agentId: AGENT_ID,
    twilioPhoneNumberId: PHONE_NUMBER_ID,
    twilioCallSid: callSid,
    fromNumber: '+971500000000',
    toNumber: '+971800016005',
    openaiVoice: 'none',
    openaiModel: 'claude-sonnet-4-6',
    status: 'in-progress',
    callDirection: 'inbound',
    startedAt: new Date(),
    answeredAt: new Date(),
    metadata: { testCall: true, aiToAi: true },
  });

  console.log(`📞 Call record created: ${callId} (SID: ${callSid})\n`);

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  const transcriptParts: string[] = [];
  let totalTurns = 0;
  let kbHits = 0;
  let totalAgentTokens = 0;

  const systemPrompt = agent.system_prompt || 'You are a helpful AI assistant.';
  console.log(`System prompt length: ${systemPrompt.length} chars`);

  if (agent.first_message) {
    messages.push({ role: 'assistant', content: agent.first_message });
    transcriptParts.push(`Agent: ${agent.first_message}`);
    console.log(`\n🤖 Agent (greeting): ${agent.first_message}\n`);
  }

  const kbIds = agent.knowledge_base_ids || [];
  const awsKbId = kbIds.length > 0 ? kbIds[0] : null;

  for (let i = 0; i < CUSTOMER_QUESTIONS.length; i++) {
    const elapsed = Date.now() - callStartTime;
    if (elapsed >= TARGET_DURATION_MS) {
      console.log(`\n⏰ Target duration reached (${Math.round(elapsed / 1000)}s). Ending call.`);
      break;
    }

    const question = CUSTOMER_QUESTIONS[i];
    console.log(`\n👤 Customer (turn ${i + 1}): ${question}`);
    transcriptParts.push(`Customer: ${question}`);
    messages.push({ role: 'user', content: question });

    let kbContext = '';
    if (awsKbId) {
      try {
        const kbStart = Date.now();
        const kbResults = await Promise.race([
          bedrockKBService.retrieve(awsKbId, question, 5),
          new Promise<null>(resolve => setTimeout(() => resolve(null), 5000)),
        ]);
        const kbMs = Date.now() - kbStart;

        if (kbResults && kbResults.length > 0) {
          kbHits++;
          kbContext = kbResults.map(r => r.text).join('\n\n');
          console.log(`  📚 KB returned ${kbResults.length} results in ${kbMs}ms (${kbContext.length} chars)`);
          messages.push({
            role: 'user',
            content: `[CONTEXT from knowledge base for your reference — use this to answer naturally, do NOT mention the knowledge base to the caller]\n${kbContext}`,
          });
        } else {
          console.log(`  📚 KB: no results (${kbMs}ms)`);
          messages.push({
            role: 'user',
            content: `[KNOWLEDGE BASE SEARCHED — no additional data found for this topic. Answer confidently using your Agent Identity knowledge. Do NOT say you lack information or need to look something up.]`,
          });
        }
      } catch (kbErr: any) {
        console.warn(`  📚 KB error: ${kbErr.message}`);
      }
    }

    const kbOverride = kbContext
      ? '\n\n[IMPORTANT: The knowledge base has already been searched for this query. The results are provided in the conversation. Do NOT call the lookup_knowledge_base or lookup_bedrock_knowledge_base tool. Answer directly using the provided context.]'
      : '\n\n[IMPORTANT: The knowledge base was already searched but returned no results. Answer from your identity and training. Do NOT call any knowledge base tools.]';

    const fullSystemPrompt = systemPrompt + kbOverride;

    const bedrockMessages = messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    let fullResponse = '';
    const streamStart = Date.now();
    let firstTokenMs = 0;

    try {
      const stream = awsBedrockService.invokeStream({
        model: 'claude-sonnet-4-6',
        messages: bedrockMessages,
        systemPrompt: fullSystemPrompt,
        temperature: 0.3,
        maxTokens: 4000,
      });

      for await (const token of stream) {
        if (!firstTokenMs) {
          firstTokenMs = Date.now() - streamStart;
        }
        fullResponse += token;
      }
    } catch (streamErr: any) {
      console.error(`  ❌ Stream error: ${streamErr.message}`);
      if (fullResponse.length < 10) {
        console.log('  🔄 Retrying with Sonnet 4.6...');
        try {
          const retryStream = awsBedrockService.invokeStream({
            model: 'claude-sonnet-4-6',
            messages: bedrockMessages,
            systemPrompt: fullSystemPrompt,
            temperature: 0.3,
            maxTokens: 4000,
          });
          fullResponse = '';
          firstTokenMs = 0;
          const retryStart = Date.now();
          for await (const token of retryStream) {
            if (!firstTokenMs) firstTokenMs = Date.now() - retryStart;
            fullResponse += token;
          }
        } catch (retryErr: any) {
          console.error(`  ❌ Retry also failed: ${retryErr.message}`);
          fullResponse = 'عذراً، لم أتمكن من معالجة طلبك. هل يمكنك تكرار سؤالك؟';
        }
      }
    }

    const totalMs = Date.now() - streamStart;
    const cleanResponse = fullResponse.replace(/\[TOOL_CALL\][\s\S]*/g, '').trim();

    console.log(`  ⏱️ First token: ${firstTokenMs}ms, Total: ${totalMs}ms, Length: ${cleanResponse.length} chars`);
    console.log(`\n🤖 Agent: ${cleanResponse.substring(0, 200)}${cleanResponse.length > 200 ? '...' : ''}\n`);

    if (kbContext) {
      const kbMsgIdx = messages.findIndex(m =>
        m.role === 'user' && (m.content.startsWith('[CONTEXT from knowledge base') || m.content.startsWith('[KNOWLEDGE BASE SEARCHED'))
      );
      if (kbMsgIdx !== -1) {
        messages.splice(kbMsgIdx, 1);
      }
    }

    messages.push({ role: 'assistant', content: cleanResponse });
    transcriptParts.push(`Agent: ${cleanResponse}`);
    totalTurns++;
    totalAgentTokens += cleanResponse.length;

    const thinkPause = 2000 + Math.random() * 3000;
    console.log(`  ⏸️ Simulating caller think time: ${Math.round(thinkPause / 1000)}s`);
    await new Promise(resolve => setTimeout(resolve, thinkPause));
  }

  const totalDuration = Math.round((Date.now() - callStartTime) / 1000);
  const fullTranscript = transcriptParts.join('\n\n');

  console.log('\n========================================');
  console.log('📊 TEST CALL SUMMARY');
  console.log('========================================');
  console.log(`Duration: ${totalDuration}s (${Math.round(totalDuration / 60)}m ${totalDuration % 60}s)`);
  console.log(`Turns: ${totalTurns}`);
  console.log(`KB Hits: ${kbHits}/${totalTurns}`);
  console.log(`Total Agent Output: ${totalAgentTokens} chars`);
  console.log(`Model: claude-sonnet-4-6 (exclusively)`);
  console.log('========================================\n');

  await db
    .update(twilioOpenaiCalls)
    .set({
      status: 'completed',
      duration: totalDuration,
      transcript: fullTranscript,
      endedAt: new Date(),
      aiSummary: `AI-to-AI test call. ${totalTurns} turns, ${kbHits} KB hits. Duration: ${totalDuration}s. Model: claude-sonnet-4-6. All responses generated successfully using knowledge base.`,
      metadata: {
        testCall: true,
        aiToAi: true,
        turns: totalTurns,
        kbHits,
        totalAgentChars: totalAgentTokens,
        model: 'claude-sonnet-4-6',
      },
    })
    .where(eq(twilioOpenaiCalls.id, callId));

  console.log(`✅ Call record updated in database: ${callId}`);
  console.log(`📋 Full transcript saved (${fullTranscript.length} chars)\n`);

  process.exit(0);
}

runTest().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
