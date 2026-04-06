'use strict';
/**
 * ============================================================
 * Twilio + Bedrock + Polly Engine Configuration
 * 
 * Configuration for the isolated Twilio-Bedrock-Polly telephony
 * engine. Uses existing AWS credentials from the database and
 * environment. Bedrock handles LLM conversation; Polly handles
 * text-to-speech synthesis.
 * ============================================================
 */

import { getDomain } from '../../../utils/domain';

/**
 * Configuration interface for the Bedrock+Polly engine
 */
export interface BedrockPollyConfig {
  defaultVoice: string;
  defaultModel: string;
  defaultPollyEngine: 'neural' | 'generative';
  defaultTemperature: number;
  webhookTimeout: number;
  maxCallDuration: number;
  recordCalls: boolean;
  defaultRegion: string;
}

/**
 * Default configuration values for the Bedrock+Polly engine
 */
export const BEDROCK_POLLY_CONFIG: BedrockPollyConfig = {
  defaultVoice: 'Joanna',
  defaultModel: 'claude-sonnet-4-6',
  defaultPollyEngine: 'generative',
  defaultTemperature: 0.7,
  webhookTimeout: 15000,
  maxCallDuration: 3600,
  recordCalls: true,
  defaultRegion: 'us-east-1',
};

/**
 * Returns the base URL used for all webhook endpoints
 */
export function getWebhookBaseUrl(): string {
  return getDomain();
}

/**
 * Returns the answer webhook URL for incoming/outbound calls
 */
export function getAnswerWebhookUrl(): string {
  return `${getWebhookBaseUrl()}/api/bedrock-polly/voice/answer`;
}

/**
 * Returns the status callback webhook URL
 */
export function getStatusWebhookUrl(): string {
  return `${getWebhookBaseUrl()}/api/bedrock-polly/voice/status`;
}

/**
 * Returns the WebSocket stream URL for a specific call
 * @param callSid - The Twilio call SID to route the stream
 */
export function getStreamWebhookUrl(callSid: string): string {
  const baseUrl = getWebhookBaseUrl();
  const wsUrl = baseUrl.replace('https://', 'wss://').replace('http://', 'wss://');
  return `${wsUrl}/api/bedrock-polly/stream/${callSid}`;
}

/**
 * Returns the incoming call webhook URL
 */
export function getIncomingWebhookUrl(): string {
  return `${getWebhookBaseUrl()}/api/bedrock-polly/voice/incoming`;
}

/**
 * Returns the recording status callback webhook URL
 */
export function getRecordingWebhookUrl(): string {
  return `${getWebhookBaseUrl()}/api/bedrock-polly/voice/recording`;
}

/**
 * Generates TwiML response for call setup.
 * Uses Polly-compatible SSML for the initial Say element when
 * a message is provided, and connects to a media stream for
 * ongoing conversation.
 * 
 * @param options - TwiML generation options
 * @param options.message - Optional initial greeting message
 * @param options.streamUrl - WebSocket URL for the media stream
 * @param options.statusCallbackUrl - Optional status callback URL
 * @param options.customParameters - Optional custom stream parameters
 * @param options.pollyVoice - Polly voice name for the Say element
 */
export function generateTwiML(options: {
  message?: string;
  streamUrl: string;
  statusCallbackUrl?: string;
  customParameters?: Record<string, string>;
  pollyVoice?: string;
}): string {
  const { message, streamUrl, statusCallbackUrl, customParameters, pollyVoice } = options;

  let customParamsXml = '';
  if (customParameters) {
    for (const [key, value] of Object.entries(customParameters)) {
      customParamsXml += `<Parameter name="${escapeXml(key)}" value="${escapeXml(value)}" />`;
    }
  }

  const connectAction = statusCallbackUrl ? `action="${escapeXml(statusCallbackUrl)}"` : '';

  const voiceAttr = pollyVoice ? ` voice="Polly.${escapeXml(pollyVoice)}"` : ' voice="Polly.Joanna"';

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${message ? `<Say${voiceAttr}>${escapeXml(message)}</Say>` : ''}
  <Connect ${connectAction}>
    <Stream url="${escapeXml(streamUrl)}">
      ${customParamsXml}
    </Stream>
  </Connect>
</Response>`;
}

/**
 * Generates TwiML for transferring a call to another number
 * 
 * @param phoneNumber - The destination phone number
 * @param callerId - The caller ID to display
 */
export function generateTransferTwiML(phoneNumber: string, callerId: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${escapeXml(callerId)}">
    <Number>${escapeXml(phoneNumber)}</Number>
  </Dial>
</Response>`;
}

/**
 * Generates TwiML for hanging up a call with an optional message
 * 
 * @param message - Optional goodbye message before hangup
 * @param pollyVoice - Polly voice name for the Say element
 */
export function generateHangupTwiML(message?: string, pollyVoice?: string): string {
  const voiceAttr = pollyVoice ? ` voice="Polly.${escapeXml(pollyVoice)}"` : ' voice="Polly.Joanna"';

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${message ? `<Say${voiceAttr}>${escapeXml(message)}</Say>` : ''}
  <Hangup/>
</Response>`;
}

/**
 * Escapes special XML characters to prevent injection
 * @param str - The string to escape
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
