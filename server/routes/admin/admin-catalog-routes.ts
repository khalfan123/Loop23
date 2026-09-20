import { Router, Request, Response } from "express";

const router = Router();

/**
 * Machine-readable catalog of internal admin endpoints.
 * Admin CP can render nav + link to exact routes and you can diff across deploys.
 */
router.get("/catalog", async (_req: Request, res: Response) => {
  res.json({
    base: "/api/internal/admin",
    groups: [
      {
        id: "phoneNumbers",
        label: "Phone Numbers",
        endpoints: [
          { method: "GET", path: "/phone-numbers" },
          { method: "POST", path: "/phone-numbers/search-available" },
          { method: "POST", path: "/phone-numbers/buy" },
        ],
      },
      {
        id: "knowledgeBase",
        label: "Knowledge Base",
        endpoints: [
          { method: "GET", path: "/knowledge/folders" },
          { method: "GET", path: "/knowledge/base" },
        ],
      },
      {
        id: "inbound",
        label: "Inbound",
        endpoints: [
          { method: "GET", path: "/inbound/incoming-connections" },
          { method: "GET", path: "/inbound/human-incoming-connections" },
          { method: "GET", path: "/inbound/ivr-configurations" },
        ],
      },
      {
        id: "aiStaff",
        label: "AI Staff",
        endpoints: [
          { method: "GET", path: "/staff/departments" },
          { method: "GET", path: "/staff/department-agents" },
        ],
      },
      {
        id: "integrations",
        label: "Integrations",
        endpoints: [
          { method: "GET", path: "/integrations/apps" },
          { method: "GET", path: "/integrations/user-integrations" },
          { method: "GET", path: "/integrations/sync-logs" },
        ],
      },
      {
        id: "voices",
        label: "Voices",
        endpoints: [
          { method: "GET", path: "/voices/synced" },
          { method: "GET", path: "/elevenlabs/pool/stats" },
          { method: "GET", path: "/aws/polly/voices" },
        ],
      },
      {
        id: "billing",
        label: "Billing",
        endpoints: [
          { method: "GET", path: "/billing/overview" },
          { method: "GET", path: "/plans" },
          { method: "GET", path: "/transactions/summary" },
        ],
      },
      {
        id: "settings",
        label: "Settings",
        endpoints: [
          { method: "GET", path: "/settings" },
          { method: "PUT", path: "/settings" },
          { method: "GET", path: "/credentials/status" },
        ],
      },
      {
        id: "operations",
        label: "Operations",
        endpoints: [
          { method: "GET", path: "/operations/kpis" },
          { method: "GET", path: "/operations/call-errors" },
        ],
      },
    ],
  });
});

export default router;

