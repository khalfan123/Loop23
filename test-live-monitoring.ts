import { liveCallRegistry } from './server/services/live-call-registry';
import { CallInsightsService } from './server/services/call-insights.service';
import { TwilioOpenAIAudioBridge } from './server/engines/twilio-openai/services/audio-bridge.service';
import { BedrockPollyAudioBridge } from './server/engines/twilio-bedrock-polly/services/audio-bridge.service';
import { twilioOpenaiCalls, plivoCalls } from './shared/schema';

async function runTests() {
  let passed = 0;
  let failed = 0;

  function ok(name: string, result: boolean, detail?: string) {
    if (result) { passed++; console.log(`PASS ${name}${detail ? ': ' + detail : ''}`); }
    else { failed++; console.log(`FAIL ${name}${detail ? ': ' + detail : ''}`); }
  }

  console.log('=== Test 1: Live Call Registry ===');
  const testCallId = 'test-call-' + Date.now();
  try {
    liveCallRegistry.registerCall({
      callId: testCallId,
      userId: 'test-user-1',
      direction: 'inbound',
      status: 'in-progress',
      agentId: 'test-agent-1',
      agentName: 'Test Agent',
      engine: 'twilio-openai',
      startedAt: new Date(),
      answeredAt: new Date(),
    });
    ok('registerCall', true);
  } catch (e: any) {
    ok('registerCall', false, e.message);
  }

  const activeCalls = liveCallRegistry.getAllActiveCalls();
  const found = activeCalls.find((c: any) => c.callId === testCallId);
  ok('getAllActiveCalls finds registered call', !!found);
  ok('call has correct engine', found?.engine === 'twilio-openai');
  ok('call has correct direction', found?.direction === 'inbound');

  liveCallRegistry.addTranscriptMessage(testCallId, 'Hello there', 'agent');
  const callWithTranscript = liveCallRegistry.getCall(testCallId);
  ok('addTranscriptMessage works', callWithTranscript?.transcript?.length === 1);

  try {
    liveCallRegistry.updateCall(testCallId, { status: 'completed' as any });
    ok('updateCall with terminal status', true);
  } catch (e: any) {
    ok('updateCall', false, e.message);
  }

  const afterEnd = liveCallRegistry.getAllActiveCalls().find((c: any) => c.callId === testCallId);
  ok('call removed after terminal status', !afterEnd);

  const count = liveCallRegistry.getActiveCallCount();
  ok('getActiveCallCount returns number', typeof count === 'number');

  console.log('\n=== Test 2: Audio Bridge endSession returns transcript/duration ===');
  try {
    const result = await TwilioOpenAIAudioBridge.endSession('nonexistent-sid-123');
    ok('TwilioOpenAI endSession returns object', typeof result === 'object');
    ok('TwilioOpenAI endSession has transcript', 'transcript' in result);
    ok('TwilioOpenAI endSession has duration', 'duration' in result);
    ok('TwilioOpenAI endSession transcript is empty string', result.transcript === '');
    ok('TwilioOpenAI endSession duration is 0', result.duration === 0);
  } catch (e: any) {
    ok('TwilioOpenAI endSession', false, e.message);
  }

  try {
    const result = await BedrockPollyAudioBridge.endSession('nonexistent-sid-456');
    ok('BedrockPolly endSession returns object', typeof result === 'object');
    ok('BedrockPolly endSession has transcript', 'transcript' in result);
    ok('BedrockPolly endSession has duration', 'duration' in result);
    ok('BedrockPolly endSession transcript is empty string', result.transcript === '');
    ok('BedrockPolly endSession duration is 0', result.duration === 0);
  } catch (e: any) {
    ok('BedrockPolly endSession', false, e.message);
  }

  console.log('\n=== Test 3: Schema fields present ===');
  const twilioCols = Object.keys(twilioOpenaiCalls);
  const plivoCols_ = Object.keys(plivoCalls);
  ok('twilioOpenaiCalls has transcript', twilioCols.includes('transcript'));
  ok('twilioOpenaiCalls has sentiment', twilioCols.includes('sentiment'));
  ok('twilioOpenaiCalls has aiSummary', twilioCols.includes('aiSummary'));
  ok('twilioOpenaiCalls has recordingUrl', twilioCols.includes('recordingUrl'));
  ok('twilioOpenaiCalls has metadata (for endReason)', twilioCols.includes('metadata'));
  ok('plivoCalls has metadata (for endReason)', plivoCols_.includes('metadata'));

  console.log('\n=== Test 4: CallInsightsService with provider fallback ===');
  const testTranscript = `Agent: Hello, thank you for calling. How can I help you today?
Customer: Hi, I am interested in your premium plan. Can you tell me more about it?
Agent: Of course! Our premium plan includes unlimited calls, priority support, and advanced analytics.
Customer: That sounds great. How much does it cost?
Agent: It is 49.99 per month with a 30-day free trial.
Customer: I would like to sign up for the free trial.
Agent: Wonderful! I will get that set up for you right away.`;

  try {
    const insights = await CallInsightsService.analyzeTranscript(
      testTranscript,
      { callId: 'test-insights-1', agentName: 'Test Agent', duration: 120 }
    );

    if (insights) {
      ok('CallInsightsService returns insights', true);
      ok('sentiment is valid', ['positive', 'neutral', 'negative'].includes(insights.sentiment), insights.sentiment);
      ok('classification is valid', ['hot', 'warm', 'cold', 'lost'].includes(insights.classification), insights.classification);
      ok('aiSummary non-empty', typeof insights.aiSummary === 'string' && insights.aiSummary.length > 10, insights.aiSummary.substring(0, 80));
      ok('keyPoints is array', Array.isArray(insights.keyPoints));
      ok('nextActions is array', Array.isArray(insights.nextActions));
    } else {
      ok('CallInsightsService returns insights', false, 'returned null - all providers failed');
    }
  } catch (e: any) {
    ok('CallInsightsService', false, e.message);
  }

  try {
    const emptyResult = await CallInsightsService.analyzeTranscript('', { callId: 'test-empty' });
    ok('handles empty transcript gracefully', emptyResult === null);
  } catch (e: any) {
    ok('handles empty transcript gracefully', false, e.message);
  }

  console.log('\n=============================');
  console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
  console.log('=============================');

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(e => { console.error('Test runner error:', e); process.exit(1); });
