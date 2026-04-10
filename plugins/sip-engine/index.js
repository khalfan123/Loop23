import { setupSipTrunkRoutes } from "./routes/sip-trunk.routes";
import { setupSipPhoneRoutes } from "./routes/sip-phone.routes";
import { setupSipCallRoutes } from "./routes/sip-call.routes";
import { setupSipWebhookRoutes } from "./routes/sip-webhook.routes";
import { setupTcxcRoutes } from "./routes/tcxc.routes";
import { setupSipTwilioOnboardRoutes } from "./routes/sip-twilio-onboard.routes";
import { setupNumberPortingRoutes } from "./routes/number-porting.routes";
function registerSipEnginePlugin(app, options) {
  console.log("[SIP Engine] Registering SIP Engine plugin...");
  setupSipTrunkRoutes(app, options.sessionAuthMiddleware);
  setupSipPhoneRoutes(app, options.sessionAuthMiddleware);
  setupSipCallRoutes(app, options.sessionAuthMiddleware);
  setupSipWebhookRoutes(app);
  setupTcxcRoutes(app, options.sessionAuthMiddleware, options.adminAuthMiddleware);
  setupSipTwilioOnboardRoutes(app, options.sessionAuthMiddleware);
  setupNumberPortingRoutes(app, options.sessionAuthMiddleware);
  console.log("[SIP Engine] SIP Engine plugin registered successfully");
  console.log("[SIP Engine] Supported providers: TCXC, Twilio SIP, Telnyx, Vonage, Exotel, Bandwidth, DIDWW, Generic");
}
import { ElevenLabsSipService } from "./services/elevenlabs-sip.service";
import { TcxcApiService } from "./services/tcxc-api.service";
import { SIP_PROVIDERS, getProviderDefaults, ELEVENLABS_SIP_CONFIG } from "./config/sip-config";
export {
  ELEVENLABS_SIP_CONFIG,
  ElevenLabsSipService,
  SIP_PROVIDERS,
  TcxcApiService,
  getProviderDefaults,
  registerSipEnginePlugin
};
