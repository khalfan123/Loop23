import { Router, Request, Response } from "express";
import { db } from "../../db";
import { departments, departmentAgents, agents } from "@shared/schema";
import { desc, eq } from "drizzle-orm";

const router = Router();

// "AI Staff" = departments + linked agents
router.get("/staff/departments", async (_req: Request, res: Response) => {
  try {
    const rows = await db.select().from(departments).orderBy(desc(departments.updatedAt));
    res.json({ data: rows });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch departments" });
  }
});

router.get("/staff/department-agents", async (_req: Request, res: Response) => {
  try {
    const rows = await db
      .select({
        id: departmentAgents.id,
        departmentId: departmentAgents.departmentId,
        agentId: departmentAgents.agentId,
        language: departmentAgents.language,
        isPrimary: departmentAgents.isPrimary,
        createdAt: departmentAgents.createdAt,
        agentName: agents.name,
        agentType: agents.type,
      })
      .from(departmentAgents)
      .innerJoin(agents, eq(departmentAgents.agentId, agents.id))
      .orderBy(desc(departmentAgents.createdAt));
    res.json({ data: rows });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch department agent links" });
  }
});

export default router;

