import { NumberPortingService } from "../services/number-porting.service";
function setupNumberPortingRoutes(app, sessionAuth) {
  app.get("/api/porting/countries", sessionAuth, async (_req, res) => {
    try {
      const countries = NumberPortingService.getGccCountries();
      res.json(countries);
    } catch (error) {
      console.error("[Porting Routes] Get countries error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/porting/check", sessionAuth, async (req, res) => {
    try {
      const { phoneNumber, countryCode } = req.body;
      if (!phoneNumber || !countryCode) {
        return res.status(400).json({ error: "phoneNumber and countryCode are required" });
      }
      const result = await NumberPortingService.checkPortability(phoneNumber, countryCode);
      res.json(result);
    } catch (error) {
      console.error("[Porting Routes] Portability check error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/porting/requests", sessionAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const request = await NumberPortingService.createPortRequest({
        ...req.body,
        userId
      });
      res.status(201).json(request);
    } catch (error) {
      console.error("[Porting Routes] Create port request error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.get("/api/porting/requests", sessionAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const requests = await NumberPortingService.getUserPortRequests(userId);
      res.json(requests);
    } catch (error) {
      console.error("[Porting Routes] List port requests error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.get("/api/porting/requests/:id", sessionAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const request = await NumberPortingService.getPortRequest(req.params.id, userId);
      if (!request) return res.status(404).json({ error: "Port request not found" });
      res.json(request);
    } catch (error) {
      console.error("[Porting Routes] Get port request error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.get("/api/porting/requests/:id/loa", sessionAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const request = await NumberPortingService.getPortRequest(req.params.id, userId);
      if (!request) return res.status(404).json({ error: "Port request not found" });
      res.json({ loaText: request.loaText });
    } catch (error) {
      console.error("[Porting Routes] Get LOA error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.patch("/api/porting/requests/:id", sessionAuth, async (req, res) => {
    try {
      const { status, adminNotes } = req.body;
      const updated = await NumberPortingService.updatePortRequestStatus(
        req.params.id,
        status,
        adminNotes
      );
      if (!updated) return res.status(404).json({ error: "Port request not found" });
      res.json(updated);
    } catch (error) {
      console.error("[Porting Routes] Update port request error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.delete("/api/porting/requests/:id", sessionAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const cancelled = await NumberPortingService.cancelPortRequest(req.params.id, userId);
      if (!cancelled) return res.status(400).json({ error: "Cannot cancel this request" });
      res.json({ success: true });
    } catch (error) {
      console.error("[Porting Routes] Cancel port request error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  console.log("[SIP Engine] Number porting routes registered");
}
export {
  setupNumberPortingRoutes
};
