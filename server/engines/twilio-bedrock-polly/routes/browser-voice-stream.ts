'use strict';
import type { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { db } from '../../../db';
import { agents } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { awsBedrockService } from '../../../services/aws-bedrock';
import { awsPollyService } from '../../../services/aws-polly';
import { BedrockAgentFactory } from '../services/bedrock-agent-factory';
import { BEDROCK_POLLY_CONFIG } from '../config/config';
import type { AgentConfig, PollyVoiceId, BedrockModel } from '../types';

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

async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not set');
  }

  const formData = new FormData();
  formData.append('file', new Blob([audioBuffer], { type: 'audio/webm' }), 'audio.webm');
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

  const escapedText = synthesisText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
  const ssmlText = `<speak><prosody rate="medium" pitch="medium">${escapedText}</prosody></speak>`;

  let result;
  try {
    result = await awsPollyService.synthesizeSpeech({
      text: ssmlText,
      voiceId,
      engine: 'generative',
      outputFormat: 'mp3',
      sampleRate: '22050',
      textType: 'ssml',
    });
  } catch (genError: any) {
    console.warn(`[BrowserVoice] Generative engine failed for voice ${voiceId}, falling back to neural: ${genError.message}`);
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
      console.warn(`[BrowserVoice] Neural SSML also failed, trying plain text: ${neuralError.message}`);
      result = await awsPollyService.synthesizeSpeech({
        text: synthesisText,
        voiceId,
        engine: 'neural',
        outputFormat: 'mp3',
        sampleRate: '22050',
      });
    }
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

  const toolCallMatch = content.match(/\[TOOL_CALL\]\s*(\{[\s\S]*?\})/);
  if (toolCallMatch) {
    try {
      const toolCall = JSON.parse(toolCallMatch[1]) as {
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
      return content.replace(/\[TOOL_CALL\][\s\S]*/, '').trim() || content;
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

    const voice = (agent.voice || BEDROCK_POLLY_CONFIG.defaultVoice) as PollyVoiceId;
    const model = (agent.model && ['claude-3-5-sonnet', 'claude-3-haiku', 'claude-3-opus'].includes(agent.model)
      ? agent.model
      : BEDROCK_POLLY_CONFIG.defaultModel) as BedrockModel;

    let agentConfig = BedrockAgentFactory.createAgentConfig({
      voice,
      model,
      systemPrompt: agent.systemPrompt || 'You are a helpful AI assistant.',
      firstMessage: agent.firstMessage || undefined,
      temperature: agent.temperature ?? 0.7,
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
      firstMessage: agent.firstMessage || '',
    });

    if (agent.firstMessage) {
      try {
        const audioBuffer = await synthesizeSpeech(agent.firstMessage, agentConfig.voice);
        sendMessage(ws, {
          type: 'audio',
          data: audioBuffer.toString('base64'),
          text: agent.firstMessage,
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
    sendMessage(ws, { type: 'error', message: 'Failed to process audio' });
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
