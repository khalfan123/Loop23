'use strict';

import type { Express, RequestHandler } from 'express';
import { setupSipTrunkRoutes } from './routes/sip-trunk.routes';
import { setupSipPhoneRoutes } from './routes/sip-phone.routes';
import { setupSipCallRoutes } from './routes/sip-call.routes';
import { setupSipWebhookRoutes } from './routes/sip-webhook.routes';

export interface SipEnginePluginOptions {
  sessionAuthMiddleware: RequestHandler;
  adminAuthMiddleware: RequestHandler;
}

export function registerSipEnginePlugin(
  app: Express,
  options: SipEnginePluginOptions
): void {
  console.log('[SIP Engine] Registering SIP Engine plugin...');
  
  setupSipTrunkRoutes(app, options.sessionAuthMiddleware);
  setupSipPhoneRoutes(app, options.sessionAuthMiddleware);
  setupSipCallRoutes(app, options.sessionAuthMiddleware);
  setupSipWebhookRoutes(app);
  
  console.log('[SIP Engine] SIP Engine plugin registered successfully');
  console.log('[SIP Engine] Supported providers: TCXC, Twilio SIP, Telnyx, Vonage, Exotel, Bandwidth, DIDWW, Generic');
}

export { ElevenLabsSipService } from './services/elevenlabs-sip.service';
export { SIP_PROVIDERS, getProviderDefaults, ELEVENLABS_SIP_CONFIG } from './config/sip-config';
