'use strict';
import { db } from '../db';
import { twilioOpenaiCalls } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import { awsBedrockService } from './aws-bedrock';
import { bedrockKBService } from './bedrock-knowledge-base.service';

const CUSTOMER_QUESTIONS: Record<string, string[]> = {
  ar: [
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
    'هل يمكنني إلغاء الاشتراك في أي وقت؟',
    'ما هي الدول التي تغطيها خدمتكم في منطقة الخليج؟',
    'هل تقدمون عروض خاصة في المناسبات مثل رمضان أو العيد؟',
    'كيف أتأكد أن جهازي يدعم eSIM قبل الشراء؟',
    'شكراً لك على كل المعلومات، أعتقد أنني سأشتري الباقة الآن',
  ],
  en: [
    'Hi, I\'m traveling to Turkey next week and need an eSIM. What options do you have?',
    'How much does the data package for Turkey cost? Does it include calls too?',
    'How do I install the eSIM on an iPhone? Is it difficult?',
    'Can I use the same eSIM in multiple countries? Like Turkey and Germany?',
    'What\'s the validity period after activation? Can I renew it?',
    'Do you support Samsung devices too or just iPhone?',
    'What payment methods do you accept? Do you take Apple Pay?',
    'If I have connection issues after activation, how do I reach you?',
    'Do you have special packages for families or groups?',
    'What\'s the difference between your packages? I want to understand which is best for me',
    'Do you offer services for businesses or corporations?',
    'How does the purchase process work from start to finish?',
    'Can I keep my local number while using the eSIM?',
    'What internet speed can I expect with the package?',
    'Thanks so much for the info, I\'ll think about it and get back to you soon',
    'Can I cancel my subscription at any time?',
    'What countries do you cover in the Gulf region?',
    'Do you offer special deals during holidays?',
    'How can I make sure my device supports eSIM before purchasing?',
    'Thank you for all the information, I think I\'ll purchase the package now',
  ],
};

export async function runAiTestCall(
  callId: string,
  agent: {
    id: string;
    name: string;
    language: string;
    system_prompt: string;
    first_message?: string | null;
    knowledge_base_ids?: string[] | null;
    knowledge_base_only?: boolean | null;
    temperature?: number | null;
  },
  maxTurns: number
): Promise<void> {
  const callStartTime = Date.now();
  const lang = agent.language || 'en';
  const questions = CUSTOMER_QUESTIONS[lang] || CUSTOMER_QUESTIONS['en'];

  console.log(`\n[AI Test Call] Starting for agent "${agent.name}" (${lang}), ${maxTurns} turns`);

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  const transcriptParts: string[] = [];
  let totalTurns = 0;
  let kbHits = 0;
  let totalAgentChars = 0;
  let errors = 0;

  const systemPrompt = agent.system_prompt || 'You are a helpful AI assistant.';

  if (agent.first_message) {
    messages.push({ role: 'assistant', content: agent.first_message });
    transcriptParts.push(`Agent: ${agent.first_message}`);
    console.log(`[AI Test Call] Greeting: ${agent.first_message.substring(0, 80)}...`);
  }

  const kbIds = agent.knowledge_base_ids || [];
  const awsKbId = kbIds.length > 0 ? kbIds[0] : null;

  for (let i = 0; i < Math.min(maxTurns, questions.length); i++) {
    const question = questions[i];
    console.log(`[AI Test Call] Turn ${i + 1}/${maxTurns}: "${question.substring(0, 60)}..."`);
    transcriptParts.push(`Customer: ${question}`);
    messages.push({ role: 'user', content: question });

    let kbContext = '';
    if (awsKbId) {
      try {
        const kbResults = await Promise.race([
          bedrockKBService.retrieve(awsKbId, question, 5),
          new Promise<null>(resolve => setTimeout(() => resolve(null), 5000)),
        ]);
        if (kbResults && kbResults.length > 0) {
          kbHits++;
          kbContext = kbResults.map(r => r.text).join('\n\n');
          messages.push({
            role: 'user',
            content: `[CONTEXT from knowledge base for your reference — use this to answer naturally, do NOT mention the knowledge base to the caller]\n${kbContext}`,
          });
        } else {
          messages.push({
            role: 'user',
            content: `[KNOWLEDGE BASE SEARCHED — no additional data found for this topic. Answer confidently using your Agent Identity knowledge.]`,
          });
        }
      } catch (kbErr: any) {
        console.warn(`[AI Test Call] KB error: ${kbErr.message}`);
      }
    }

    const kbOverride = '\n\n[IMPORTANT: The knowledge base has already been searched. Do NOT call any knowledge base tools. Answer directly.]';
    const fullSystemPrompt = systemPrompt + kbOverride;
    const bedrockMessages = messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

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
        if (!firstTokenMs) firstTokenMs = Date.now() - streamStart;
        fullResponse += token;
      }
    } catch (streamErr: any) {
      console.error(`[AI Test Call] Stream error on turn ${i + 1}: ${streamErr.message}`);
      errors++;
      try {
        const retryStream = awsBedrockService.invokeStream({
          model: 'claude-sonnet-4-6',
          messages: bedrockMessages,
          systemPrompt: fullSystemPrompt,
          temperature: 0.3,
          maxTokens: 4000,
        });
        fullResponse = '';
        const retryStart = Date.now();
        for await (const token of retryStream) {
          if (!firstTokenMs) firstTokenMs = Date.now() - retryStart;
          fullResponse += token;
        }
      } catch (retryErr: any) {
        console.error(`[AI Test Call] Retry failed on turn ${i + 1}: ${retryErr.message}`);
        fullResponse = lang === 'ar'
          ? 'عذراً، لم أتمكن من معالجة طلبك. هل يمكنك تكرار سؤالك؟'
          : 'Sorry, I couldn\'t process that. Could you repeat your question?';
      }
    }

    const totalMs = Date.now() - streamStart;
    const cleanResponse = fullResponse.replace(/\[TOOL_CALL\][\s\S]*/g, '').trim();

    console.log(`[AI Test Call] Turn ${i + 1} done: firstToken=${firstTokenMs}ms, total=${totalMs}ms, chars=${cleanResponse.length}`);

    if (kbContext) {
      const kbMsgIdx = messages.findIndex(m =>
        m.role === 'user' && (m.content.startsWith('[CONTEXT from knowledge base') || m.content.startsWith('[KNOWLEDGE BASE SEARCHED'))
      );
      if (kbMsgIdx !== -1) messages.splice(kbMsgIdx, 1);
    }

    messages.push({ role: 'assistant', content: cleanResponse });
    transcriptParts.push(`Agent: ${cleanResponse}`);
    totalTurns++;
    totalAgentChars += cleanResponse.length;

    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));
  }

  const totalDuration = Math.round((Date.now() - callStartTime) / 1000);
  const fullTranscript = transcriptParts.join('\n\n');

  console.log(`[AI Test Call] Complete: ${totalTurns} turns, ${totalDuration}s, ${totalAgentChars} chars, ${kbHits} KB hits, ${errors} errors`);

  await db
    .update(twilioOpenaiCalls)
    .set({
      status: 'completed',
      duration: totalDuration,
      transcript: fullTranscript,
      endedAt: new Date(),
      aiSummary: `AI-to-AI test call. ${totalTurns} turns completed. Duration: ${totalDuration}s. Model: claude-sonnet-4-6. KB hits: ${kbHits}. Errors: ${errors}.`,
      metadata: {
        testCall: true,
        aiToAi: true,
        turns: totalTurns,
        kbHits,
        totalAgentChars,
        errors,
        model: 'claude-sonnet-4-6',
      },
    })
    .where(eq(twilioOpenaiCalls.id, callId));
}
