import { z } from "zod";
import { ElevenLabsSipService } from "../services/elevenlabs-sip.service";
const addPhoneSchema = z.object({
  sipTrunkId: z.string().uuid(),
  phoneNumber: z.string().min(1),
  label: z.string().optional(),
  agentId: z.string().uuid().optional(),
  inboundEnabled: z.boolean().optional(),
  outboundEnabled: z.boolean().optional()
});
const updatePhoneSchema = z.object({
  label: z.string().optional(),
  agentId: z.string().uuid().nullable().optional(),
  inboundEnabled: z.boolean().optional(),
  outboundEnabled: z.boolean().optional()
});
const bulkImportSchema = z.object({
  sipTrunkId: z.string().uuid(),
  phoneNumbers: z.array(z.object({
    phoneNumber: z.string().min(1),
    label: z.string().optional()
  })).min(1).max(100)
});
function setupSipPhoneRoutes(app, sessionAuth) {
  app.get("/api/sip/phone-numbers", sessionAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const { sipTrunkId } = req.query;
      let phoneNumbers;
      if (sipTrunkId && typeof sipTrunkId === "string") {
        const trunk = await ElevenLabsSipService.getTrunkById(sipTrunkId);
        if (!trunk || trunk.userId !== userId) {
          return res.status(403).json({ error: "Access denied" });
        }
        phoneNumbers = await ElevenLabsSipService.getTrunkPhoneNumbers(sipTrunkId);
      } else {
        phoneNumbers = await ElevenLabsSipService.getUserPhoneNumbers(userId);
      }
      res.json(phoneNumbers);
    } catch (error) {
      console.error("[SIP Routes] Get phone numbers error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/sip/phone-numbers", sessionAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const validation = addPhoneSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Validation failed", details: validation.error.errors });
      }
      const trunk = await ElevenLabsSipService.getTrunkById(validation.data.sipTrunkId);
      if (!trunk || trunk.userId !== userId) {
        return res.status(403).json({ error: "Access denied to this trunk" });
      }
      const phoneNumber = await ElevenLabsSipService.addPhoneNumber({
        userId,
        ...validation.data
      });
      res.status(201).json(phoneNumber);
    } catch (error) {
      console.error("[SIP Routes] Add phone number error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/sip/phone-numbers/bulk-import", sessionAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const validation = bulkImportSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Validation failed", details: validation.error.errors });
      }
      const trunk = await ElevenLabsSipService.getTrunkById(validation.data.sipTrunkId);
      if (!trunk || trunk.userId !== userId) {
        return res.status(403).json({ error: "Access denied to this trunk" });
      }
      const results = [];
      for (const phone of validation.data.phoneNumbers) {
        try {
          const created = await ElevenLabsSipService.addPhoneNumber({
            userId,
            sipTrunkId: validation.data.sipTrunkId,
            phoneNumber: phone.phoneNumber,
            label: phone.label
          });
          results.push({ phoneNumber: phone.phoneNumber, success: true, id: created.id });
        } catch (error) {
          results.push({ phoneNumber: phone.phoneNumber, success: false, error: error.message });
        }
      }
      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;
      res.json({
        imported: successCount,
        failed: failCount,
        results
      });
    } catch (error) {
      console.error("[SIP Routes] Bulk import error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.patch("/api/sip/phone-numbers/:phoneNumberId", sessionAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const phoneNumbers = await ElevenLabsSipService.getUserPhoneNumbers(userId);
      const existing = phoneNumbers.find((p) => p.id === req.params.phoneNumberId);
      if (!existing) {
        return res.status(404).json({ error: "Phone number not found" });
      }
      const validation = updatePhoneSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Validation failed", details: validation.error.errors });
      }
      const updated = await ElevenLabsSipService.updatePhoneNumber(req.params.phoneNumberId, validation.data);
      res.json(updated);
    } catch (error) {
      console.error("[SIP Routes] Update phone number error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.delete("/api/sip/phone-numbers/:phoneNumberId", sessionAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const phoneNumbers = await ElevenLabsSipService.getUserPhoneNumbers(userId);
      const existing = phoneNumbers.find((p) => p.id === req.params.phoneNumberId);
      if (!existing) {
        return res.status(404).json({ error: "Phone number not found" });
      }
      await ElevenLabsSipService.deletePhoneNumber(req.params.phoneNumberId);
      res.json({ success: true });
    } catch (error) {
      console.error("[SIP Routes] Delete phone number error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/sip/phone-numbers/:phoneNumberId/assign-agent", sessionAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const { agentId } = req.body;
      const phoneNumbers = await ElevenLabsSipService.getUserPhoneNumbers(userId);
      const existing = phoneNumbers.find((p) => p.id === req.params.phoneNumberId);
      if (!existing) {
        return res.status(404).json({ error: "Phone number not found" });
      }
      const updated = await ElevenLabsSipService.updatePhoneNumber(req.params.phoneNumberId, { agentId });
      res.json(updated);
    } catch (error) {
      console.error("[SIP Routes] Assign agent error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  console.log("[SIP Engine] SIP phone number routes registered");
}
export {
  setupSipPhoneRoutes
};
