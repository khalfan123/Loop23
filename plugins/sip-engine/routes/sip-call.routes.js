import { z } from "zod";
import { ElevenLabsSipService } from "../services/elevenlabs-sip.service";
const initiateCallSchema = z.object({
  sipPhoneNumberId: z.string().uuid(),
  toNumber: z.string().min(1),
  agentId: z.string().uuid(),
  campaignId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional()
});
function setupSipCallRoutes(app, sessionAuth) {
  app.get("/api/sip/calls", sessionAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const limit = parseInt(req.query.limit) || 50;
      const calls = await ElevenLabsSipService.getUserCalls(userId, limit);
      res.json(calls);
    } catch (error) {
      console.error("[SIP Routes] Get calls error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.get("/api/sip/calls/:callId", sessionAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const call = await ElevenLabsSipService.getCallById(req.params.callId);
      if (!call) {
        return res.status(404).json({ error: "Call not found" });
      }
      if (call.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(call);
    } catch (error) {
      console.error("[SIP Routes] Get call error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/sip/calls/initiate", sessionAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const validation = initiateCallSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Validation failed", details: validation.error.errors });
      }
      const call = await ElevenLabsSipService.initiateOutboundCall({
        userId,
        ...validation.data
      });
      res.status(201).json(call);
    } catch (error) {
      console.error("[SIP Routes] Initiate call error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  console.log("[SIP Engine] SIP call routes registered");
}
export {
  setupSipCallRoutes
};
