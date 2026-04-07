import { Router, Request, Response } from "express";
import { discoverPlugins, getPluginStatus, setPluginEnabled, getPluginManifest } from "../../plugins/loader";

const router = Router();

router.get("/plugins", async (_req: Request, res: Response) => {
  try {
    const status = await getPluginStatus();
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch plugins" });
  }
});

router.get("/plugins/discover", async (_req: Request, res: Response) => {
  try {
    const available = discoverPlugins();
    res.json(available);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to discover plugins" });
  }
});

router.post("/plugins/:id/install", async (req: Request, res: Response) => {
  try {
    await setPluginEnabled(req.params.id, true);
    res.json({ success: true, message: `Plugin ${req.params.id} enabled` });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to install plugin" });
  }
});

router.post("/plugins/:id/uninstall", async (req: Request, res: Response) => {
  try {
    await setPluginEnabled(req.params.id, false);
    res.json({ success: true, message: `Plugin ${req.params.id} disabled` });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to uninstall plugin" });
  }
});

export default router;
