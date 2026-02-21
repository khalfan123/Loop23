'use strict';
import type { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { db } from '../../../db';
import { agents, globalSettings } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { awsBedrockService } from '../../../services/aws-bedrock';
import { awsPollyService } from '../../../services/aws-polly';
import { BedrockAgentFactory } from '../services/bedrock-agent-factory';
import { BEDROCK_POLLY_CONFIG } from '../config/config';
import type { AgentConfig, PollyVoiceId, BedrockModel } from '../types';
import { humanizeToSSML } from '../services/ssml-humanizer';

interface BrowserVoiceSession {
  sessionId: string;
  agentConfig: AgentConfig;
  messages: { role: 'user' | 'assistant'; content: string; timestamp: Date }[];
  transcript: string;
  ws: WebSocket;
}

const activeSessions: Map<string, BrowserVoiceSession> = new Map();

function sendMessage(ws: WebSocket, message: Record<string, unknown>): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

async function getOpenAIApiKey(): Promise<string> {
  try {
    const [dbSetting] = await db.select().from(globalSettings).where(eq(globalSettings.key, 'openai_api_key')).limit(1);
    if (dbSetting?.value) return dbSetting.value as string;
  } catch (e) {}
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  if (process.env.AI_INTEGRATIONS_OPENAI_API_KEY) return process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  throw new Error('No OpenAI API key found. Configure it in Admin Settings or as an environment variable.');
}

async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  if (audioBuffer.length < 1000) {
    console.log(`[BrowserVoice] Audio too short (${audioBuffer.length} bytes), skipping transcription`);
    return '';
  }

  const apiKey = await getOpenAIApiKey();

  const isWebm = audioBuffer[0] === 0x1A && audioBuffer[1] === 0x45 && audioBuffer[2] === 0xDF && audioBuffer[3] === 0xA3;
  const isOgg = audioBuffer[0] === 0x4F && audioBuffer[1] === 0x67 && audioBuffer[2] === 0x67 && audioBuffer[3] === 0x53;

  let mimeType = 'audio/webm';
  let fileName = 'audio.webm';
  if (isOgg) {
    mimeType = 'audio/ogg';
    fileName = 'audio.ogg';
  } else if (!isWebm) {
    mimeType = 'audio/mp4';
    fileName = 'audio.mp4';
  }

  const formData = new FormData();
  formData.append('file', new Blob([audioBuffer], { type: mimeType }), fileName);
  formData.append('model', 'whisper-1');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Whisper API error ${response.status}: ${errorText}`);
  }

  const result = (await response.json()) as { text?: string };
  return result.text || '';
}

async function synthesizeSpeech(text: string, voiceId: string): Promise<Buffer> {
  const MAX_POLLY_CHARS = 3000;
  const synthesisText = text.length > MAX_POLLY_CHARS ? text.substring(0, MAX_POLLY_CHARS) : text;

  const ssmlText = humanizeToSSML(synthesisText);

  let result;
  try {
    result = await awsPollyService.synthesizeSpeech({
      text: ssmlText,
      voiceId,
      engine: 'neural',
      outputFormat: 'mp3',
      sampleRate: '22050',
      textType: 'ssml',
    });
  } catch (neuralError: any) {
    console.warn(`[BrowserVoice] Neural SSML failed for voice ${voiceId}, trying plain text: ${neuralError.message}`);
    result = await awsPollyService.synthesizeSpeech({
      text: synthesisText,
      voiceId,
      engine: 'neural',
      outputFormat: 'mp3',
      sampleRate: '22050',
    });
  }

  return result.audioStream;
}

async function getBedrockResponse(session: BrowserVoiceSession): Promise<string> {
  const { agentConfig, messages } = session;

  const bedrockMessages = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  let toolCallInstructions = '';
  if (agentConfig.tools && agentConfig.tools.length > 0) {
    const toolDescriptions = agentConfig.tools.map((t) => {
      const paramsDesc = JSON.stringify(t.parameters || {});
      return `- ${t.name}: ${t.description}. Parameters: ${paramsDesc}`;
    }).join('\n');

    toolCallInstructions = `\n\nYou have access to the following tools. To call a tool, respond with a JSON block in this exact format on its own line:
[TOOL_CALL] {"name": "<tool_name>", "params": {<parameters>}}

Available tools:
${toolDescriptions}

IMPORTANT: After collecting all required information, you MUST call the relevant tool. Do NOT just describe what you would do — actually call the tool. After completing the main task, say a friendly closing message and ask if there's anything else. Only call end_call after the user confirms they are done.`;
  }

  const systemPrompt = agentConfig.systemPrompt + toolCallInstructions;

  const response = await awsBedrockService.invoke({
    model: agentConfig.model,
    messages: bedrockMessages,
    systemPrompt,
    temperature: agentConfig.temperature ?? 0.7,
    maxTokens: 1024,
  });

  const content = response.content || '';

  const toolCallIdx = content.indexOf('[TOOL_CALL]');
  if (toolCallIdx !== -1) {
    const afterTag = content.substring(toolCallIdx + '[TOOL_CALL]'.length).trim();
    const jsonStart = afterTag.indexOf('{');
    let jsonStr = '';
    if (jsonStart !== -1) {
      let depth = 0;
      let jsonEnd = -1;
      for (let i = jsonStart; i < afterTag.length; i++) {
        if (afterTag[i] === '{') depth++;
        else if (afterTag[i] === '}') {
          depth--;
          if (depth === 0) { jsonEnd = i; break; }
        }
      }
      if (jsonEnd !== -1) {
        jsonStr = afterTag.substring(jsonStart, jsonEnd + 1);
      }
    }

    const remainingText = jsonStr
      ? afterTag.substring(afterTag.indexOf(jsonStr) + jsonStr.length).trim()
      : afterTag;
    const textBeforeToolCall = content.substring(0, toolCallIdx).trim();

    try {
      const toolCall = JSON.parse(jsonStr) as {
        name: string;
        params: Record<string, unknown>;
      };

      const handler = agentConfig.tools?.find((t) => t.name === toolCall.name)?.handler;
      let toolResult: unknown = { error: `Unknown tool: ${toolCall.name}` };
      if (handler) {
        try {
          toolResult = await handler(toolCall.params);
        } catch (err: any) {
          toolResult = { error: err.message };
        }
      }

      session.messages.push({
        role: 'assistant',
        content,
        timestamp: new Date(),
      });

      session.messages.push({
        role: 'user',
        content: `Tool "${toolCall.name}" returned: ${JSON.stringify(toolResult)}`,
        timestamp: new Date(),
      });

      return getBedrockResponse(session);
    } catch (parseError: any) {
      console.error(`[BrowserVoice] Failed to parse tool call:`, parseError.message);
      const cleanText = (textBeforeToolCall + ' ' + remainingText).trim();
      return cleanText || 'How can I help you?';
    }
  }

  return content;
}

async function handleInit(ws: WebSocket, agentId: string, sessionId: string): Promise<void> {
  try {
    const [agent] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1);

    if (!agent) {
      sendMessage(ws, { type: 'error', message: 'Agent not found' });
      return;
    }

    const voice = (agent.openaiVoice || BEDROCK_POLLY_CONFIG.defaultVoice) as PollyVoiceId;
    const model = BEDROCK_POLLY_CONFIG.defaultModel as BedrockModel;

    const agentLanguage = (agent as any).language || 'en';
    const localizedFirstMessage = await BedrockAgentFactory.localizeFirstMessage(
      agent.firstMessage,
      agentLanguage
    );

    let agentConfig = BedrockAgentFactory.createAgentConfig({
      voice,
      model,
      systemPrompt: agent.systemPrompt || 'You are a helpful AI assistant.',
      firstMessage: localizedFirstMessage,
      temperature: agent.temperature ?? 0.7,
      language: agentLanguage,
      toolContext: {
        userId: agent.userId || '',
        agentId: agent.id,
      },
    });

    const knowledgeBaseIds = agent.knowledgeBaseIds as string[] | null;
    if (knowledgeBaseIds && knowledgeBaseIds.length > 0 && agent.userId) {
      agentConfig = BedrockAgentFactory.addKnowledgeBaseTool(
        agentConfig,
        knowledgeBaseIds,
        agent.userId,
        agent.knowledgeBaseOnly ?? undefined,
      );
    }

    const session: BrowserVoiceSession = {
      sessionId,
      agentConfig,
      messages: [],
      transcript: '',
      ws,
    };

    activeSessions.set(sessionId, session);

    sendMessage(ws, {
      type: 'ready',
      agentName: agent.name || 'AI Agent',
      firstMessage: localizedFirstMessage || '',
    });

    if (localizedFirstMessage) {
      try {
        const audioBuffer = await synthesizeSpeech(localizedFirstMessage, agentConfig.voice);
        sendMessage(ws, {
          type: 'audio',
          data: audioBuffer.toString('base64'),
          text: localizedFirstMessage,
        });
      } catch (err: any) {
        console.error(`[BrowserVoice] Failed to synthesize first message:`, err.message);
      }
    }

    console.log(`[BrowserVoice] Session ${sessionId} initialized for agent ${agent.name}`);
  } catch (error: any) {
    console.error(`[BrowserVoice] Init error:`, error.message);
    sendMessage(ws, { type: 'error', message: 'Failed to initialize session' });
  }
}

async function handleAudio(session: BrowserVoiceSession, data: string): Promise<void> {
  const { ws, agentConfig } = session;

  try {
    const audioBuffer = Buffer.from(data, 'base64');

    sendMessage(ws, { type: 'processing', stage: 'transcribing' });

    const transcription = await transcribeAudio(audioBuffer);

    if (!transcription || transcription.trim().length === 0) {
      console.log(`[BrowserVoice] Empty transcription for session ${session.sessionId}`);
      return;
    }

    sendMessage(ws, { type: 'transcript', role: 'user', text: transcription });

    session.messages.push({
      role: 'user',
      content: transcription,
      timestamp: new Date(),
    });
    session.transcript += `User: ${transcription}\n`;

    sendMessage(ws, { type: 'processing', stage: 'thinking' });

    const responseText = await getBedrockResponse(session);

    if (!responseText || responseText.trim().length === 0) {
      console.log(`[BrowserVoice] Empty Bedrock response for session ${session.sessionId}`);
      return;
    }

    session.messages.push({
      role: 'assistant',
      content: responseText,
      timestamp: new Date(),
    });
    session.transcript += `Agent: ${responseText}\n`;

    sendMessage(ws, { type: 'transcript', role: 'agent', text: responseText });

    sendMessage(ws, { type: 'processing', stage: 'speaking' });

    const mp3Buffer = await synthesizeSpeech(responseText, agentConfig.voice);

    sendMessage(ws, {
      type: 'audio',
      data: mp3Buffer.toString('base64'),
      text: responseText,
    });
  } catch (error: any) {
    console.error(`[BrowserVoice] Audio processing error for session ${session.sessionId}:`, error.message);
    if (error.message?.includes('could not be decoded') || error.message?.includes('format is not supported')) {
      sendMessage(ws, { type: 'error', message: 'Audio format not recognized. Please try speaking for a bit longer and release the button.' });
    } else {
      sendMessage(ws, { type: 'error', message: 'Failed to process audio. Please try again.' });
    }
    sendMessage(ws, { type: 'processing', stage: 'idle' });
  }
}

function handleEnd(sessionId: string, ws: WebSocket): void {
  const session = activeSessions.get(sessionId);
  if (session) {
    activeSessions.delete(sessionId);
    console.log(`[BrowserVoice] Session ${sessionId} ended`);
  }
  sendMessage(ws, { type: 'ended' });
}

function handleConnection(ws: WebSocket, sessionId: string): void {
  let currentSessionId = sessionId;

  ws.on('message', async (raw: Buffer | string) => {
    try {
      const message = JSON.parse(typeof raw === 'string' ? raw : raw.toString());

      switch (message.type) {
        case 'init': {
          currentSessionId = message.sessionId || sessionId;
          await handleInit(ws, message.agentId, currentSessionId);
          break;
        }
        case 'audio': {
          const session = activeSessions.get(currentSessionId);
          if (!session) {
            sendMessage(ws, { type: 'error', message: 'Session not initialized' });
            return;
          }
          await handleAudio(session, message.data);
          break;
        }
        case 'end': {
          handleEnd(currentSessionId, ws);
          break;
        }
        default:
          console.warn(`[BrowserVoice] Unknown message type: ${message.type}`);
      }
    } catch (error: any) {
      console.error(`[BrowserVoice] Message handling error:`, error.message);
      sendMessage(ws, { type: 'error', message: 'Invalid message format' });
    }
  });

  ws.on('close', () => {
    const session = activeSessions.get(currentSessionId);
    if (session) {
      activeSessions.delete(currentSessionId);
      console.log(`[BrowserVoice] Session ${currentSessionId} closed`);
    }
  });

  ws.on('error', (error: Error) => {
    console.error(`[BrowserVoice] WebSocket error for session ${currentSessionId}:`, error.message);
  });
}

let browserVoiceWss: WebSocketServer | null = null;

export function setupBrowserVoiceStreamHandler(httpServer: HttpServer): void {
  if (!browserVoiceWss) {
    browserVoiceWss = new WebSocketServer({ noServer: true });
  }

  httpServer.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    const pathname = url.pathname;

    if (pathname === '/api/voice-sim/stream') {
      const sessionId = url.searchParams.get('sessionId') || `browser-${Date.now()}`;

      browserVoiceWss!.handleUpgrade(request, socket, head, (ws: WebSocket) => {
        console.log(`[BrowserVoice] WebSocket connected, sessionId=${sessionId}`);
        handleConnection(ws, sessionId);
      });
    }
  });

  console.log('✅ Browser voice WebSocket stream endpoint registered at /api/voice-sim/stream');
}
