import { Router, Request, Response } from "express";
import { db } from "../db";
import { departments, departmentAgents, ivrConfigurations, departmentKnowledgeBases, agents, phoneNumbers } from "@shared/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import { insertDepartmentSchema, insertIvrConfigurationSchema } from "@shared/schema";
import { twilioService } from "../services/twilio";
import { getDomain } from "../utils/domain";

interface AuthRequest extends Request {
  userId?: string;
}

export function createDepartmentRoutes(authenticateToken: (req: Request, res: Response, next: Function) => void) {
  const router = Router();

  /**
   * Get all departments for the current user
   */
  router.get("/", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const userDepartments = await db
        .select()
        .from(departments)
        .where(eq(departments.userId, req.userId!))
        .orderBy(asc(departments.sortOrder));

      res.json(userDepartments);
    } catch (error: any) {
      console.error("[Departments] Get all error:", error);
      res.status(500).json({ error: "Failed to fetch departments" });
    }
  });

  /**
   * Get a single department with its agents
   */
  router.get("/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const department = await db
        .select()
        .from(departments)
        .where(and(eq(departments.id, id), eq(departments.userId, req.userId!)))
        .limit(1);

      if (department.length === 0) {
        return res.status(404).json({ error: "Department not found" });
      }

      const deptAgents = await db
        .select({
          departmentAgent: departmentAgents,
          agent: agents,
        })
        .from(departmentAgents)
        .innerJoin(agents, and(eq(departmentAgents.agentId, agents.id), eq(agents.userId, req.userId!)))
        .where(eq(departmentAgents.departmentId, id));

      res.json({
        ...department[0],
        agents: deptAgents.map(da => ({
          ...da.departmentAgent,
          agent: da.agent,
        })),
      });
    } catch (error: any) {
      console.error("[Departments] Get one error:", error);
      res.status(500).json({ error: "Failed to fetch department" });
    }
  });

  /**
   * Create a new department
   */
  router.post("/", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const validatedData = insertDepartmentSchema.parse({
        ...req.body,
        userId: req.userId,
      });

      const existingCount = await db
        .select()
        .from(departments)
        .where(eq(departments.userId, req.userId!));

      const newDepartment = await db
        .insert(departments)
        .values({
          ...validatedData,
          sortOrder: existingCount.length,
        })
        .returning();

      res.status(201).json(newDepartment[0]);
    } catch (error: any) {
      console.error("[Departments] Create error:", error);
      res.status(500).json({ error: "Failed to create department" });
    }
  });

  /**
   * Update a department
   */
  router.patch("/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { name, description, icon, color, isActive, sortOrder } = req.body;

      const existingDept = await db
        .select()
        .from(departments)
        .where(and(eq(departments.id, id), eq(departments.userId, req.userId!)))
        .limit(1);

      if (existingDept.length === 0) {
        return res.status(404).json({ error: "Department not found" });
      }

      const updated = await db
        .update(departments)
        .set({
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(icon !== undefined && { icon }),
          ...(color !== undefined && { color }),
          ...(isActive !== undefined && { isActive }),
          ...(sortOrder !== undefined && { sortOrder }),
          updatedAt: new Date(),
        })
        .where(and(eq(departments.id, id), eq(departments.userId, req.userId!)))
        .returning();

      res.json(updated[0]);
    } catch (error: any) {
      console.error("[Departments] Update error:", error);
      res.status(500).json({ error: "Failed to update department" });
    }
  });

  /**
   * Delete a department
   */
  router.delete("/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const existingDept = await db
        .select()
        .from(departments)
        .where(and(eq(departments.id, id), eq(departments.userId, req.userId!)))
        .limit(1);

      if (existingDept.length === 0) {
        return res.status(404).json({ error: "Department not found" });
      }

      await db
        .delete(departments)
        .where(and(eq(departments.id, id), eq(departments.userId, req.userId!)));

      res.json({ success: true });
    } catch (error: any) {
      console.error("[Departments] Delete error:", error);
      res.status(500).json({ error: "Failed to delete department" });
    }
  });

  /**
   * Add agent to department
   */
  router.post("/:id/agents", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { agentId, language, isPrimary, systemPrompt, voiceTone } = req.body;

      if (!agentId) {
        return res.status(400).json({ error: "agentId is required" });
      }

      // Verify department belongs to user
      const existingDept = await db
        .select()
        .from(departments)
        .where(and(eq(departments.id, id), eq(departments.userId, req.userId!)))
        .limit(1);

      if (existingDept.length === 0) {
        return res.status(404).json({ error: "Department not found" });
      }

      // Verify agent belongs to user
      const existingAgent = await db
        .select()
        .from(agents)
        .where(and(eq(agents.id, agentId), eq(agents.userId, req.userId!)))
        .limit(1);

      if (existingAgent.length === 0) {
        return res.status(404).json({ error: "Agent not found" });
      }

      const newDeptAgent = await db
        .insert(departmentAgents)
        .values({
          departmentId: id,
          agentId,
          language: language || "en",
          isPrimary: isPrimary || false,
          systemPrompt: systemPrompt || null,
          voiceTone: voiceTone || null,
        })
        .returning();

      res.status(201).json(newDeptAgent[0]);
    } catch (error: any) {
      console.error("[Departments] Add agent error:", error);
      res.status(500).json({ error: "Failed to add agent to department" });
    }
  });

  /**
   * Remove agent from department
   */
  router.delete("/:id/agents/:agentId", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { id, agentId } = req.params;

      // Verify department belongs to user
      const existingDept = await db
        .select()
        .from(departments)
        .where(and(eq(departments.id, id), eq(departments.userId, req.userId!)))
        .limit(1);

      if (existingDept.length === 0) {
        return res.status(404).json({ error: "Department not found" });
      }

      await db
        .delete(departmentAgents)
        .where(and(
          eq(departmentAgents.departmentId, id),
          eq(departmentAgents.agentId, agentId)
        ));

      res.json({ success: true });
    } catch (error: any) {
      console.error("[Departments] Remove agent error:", error);
      res.status(500).json({ error: "Failed to remove agent from department" });
    }
  });

  /**
   * Get department agents
   */
  router.get("/:id/agents", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      // Verify department belongs to user
      const existingDept = await db
        .select()
        .from(departments)
        .where(and(eq(departments.id, id), eq(departments.userId, req.userId!)))
        .limit(1);

      if (existingDept.length === 0) {
        return res.status(404).json({ error: "Department not found" });
      }

      const deptAgents = await db
        .select({
          departmentAgent: departmentAgents,
          agent: agents,
        })
        .from(departmentAgents)
        .innerJoin(agents, and(eq(departmentAgents.agentId, agents.id), eq(agents.userId, req.userId!)))
        .where(eq(departmentAgents.departmentId, id));

      res.json(deptAgents.map(da => ({
        ...da.departmentAgent,
        agent: da.agent,
      })));
    } catch (error: any) {
      console.error("[Departments] Get agents error:", error);
      res.status(500).json({ error: "Failed to fetch department agents" });
    }
  });

  /**
   * Get all IVR configurations
   */
  router.get("/ivr/all", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const ivrConfigs = await db
        .select()
        .from(ivrConfigurations)
        .where(eq(ivrConfigurations.userId, req.userId!));

      res.json(ivrConfigs);
    } catch (error: any) {
      console.error("[Departments] Get IVR configs error:", error);
      res.status(500).json({ error: "Failed to fetch IVR configurations" });
    }
  });

  /**
   * Create or update IVR configuration
   */
  router.post("/ivr", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { id, phoneNumberId, name, isActive, greetingMessage, voiceId, voiceName, menuOptions, fallbackDepartmentId } = req.body;

      // Validate phone number ownership if provided
      if (phoneNumberId) {
        const phoneCheck = await db
          .select()
          .from(phoneNumbers)
          .where(and(eq(phoneNumbers.id, phoneNumberId), eq(phoneNumbers.userId, req.userId!)))
          .limit(1);
        if (phoneCheck.length === 0) {
          return res.status(400).json({ error: "Invalid phone number" });
        }
      }

      // Validate fallback department ownership if provided
      if (fallbackDepartmentId) {
        const deptCheck = await db
          .select()
          .from(departments)
          .where(and(eq(departments.id, fallbackDepartmentId), eq(departments.userId, req.userId!)))
          .limit(1);
        if (deptCheck.length === 0) {
          return res.status(400).json({ error: "Invalid fallback department" });
        }
      }

      // Validate menu options department IDs if provided
      if (menuOptions && Array.isArray(menuOptions)) {
        for (const option of menuOptions) {
          if (option.departmentId) {
            const optDeptCheck = await db
              .select()
              .from(departments)
              .where(and(eq(departments.id, option.departmentId), eq(departments.userId, req.userId!)))
              .limit(1);
            if (optDeptCheck.length === 0) {
              return res.status(400).json({ error: `Invalid department in menu option: ${option.label}` });
            }
          }
        }
      }

      if (id) {
        const updated = await db
          .update(ivrConfigurations)
          .set({
            phoneNumberId,
            name,
            isActive,
            greetingMessage,
            voiceId,
            voiceName,
            menuOptions,
            fallbackDepartmentId,
            updatedAt: new Date(),
          })
          .where(and(eq(ivrConfigurations.id, id), eq(ivrConfigurations.userId, req.userId!)))
          .returning();

        res.json(updated[0]);
      } else {
        // Auto-populate menu options from existing departments if not provided
        let finalMenuOptions = menuOptions;
        if (!menuOptions || menuOptions.length === 0) {
          const userDepartments = await db
            .select()
            .from(departments)
            .where(eq(departments.userId, req.userId!))
            .orderBy(asc(departments.sortOrder));
          
          if (userDepartments.length > 0) {
            finalMenuOptions = userDepartments.map((dept, idx) => ({
              key: String(idx + 1),
              label: dept.name,
              departmentId: dept.id,
            }));
            console.log(`[IVR] Auto-populated ${finalMenuOptions.length} departments into menu options`);
          }
        }

        const newIvr = await db
          .insert(ivrConfigurations)
          .values({
            userId: req.userId!,
            phoneNumberId,
            name: name || "Auto Distribution",
            isActive: isActive ?? true,
            greetingMessage,
            voiceId,
            voiceName,
            menuOptions: finalMenuOptions,
            fallbackDepartmentId,
          })
          .returning();

        // Configure Twilio webhook for the phone number if active
        if (phoneNumberId && (isActive ?? true)) {
          try {
            const phoneRecord = await db
              .select()
              .from(phoneNumbers)
              .where(eq(phoneNumbers.id, phoneNumberId))
              .limit(1);
            
            if (phoneRecord.length > 0 && phoneRecord[0].twilioSid) {
              const domain = getDomain();
              const webhookUrl = `${domain}/api/webhooks/twilio/incoming`;
              console.log(`[IVR] Configuring Twilio webhook for phone ${phoneRecord[0].phoneNumber}: ${webhookUrl}`);
              await twilioService.updatePhoneNumber(phoneRecord[0].twilioSid, { voiceUrl: webhookUrl });
              console.log(`[IVR] Twilio webhook configured successfully`);
            }
          } catch (twilioError: any) {
            console.error("[IVR] Failed to configure Twilio webhook:", twilioError.message);
            // Don't fail the request - IVR is created, webhook can be retried
          }
        }

        res.status(201).json(newIvr[0]);
      }
    } catch (error: any) {
      console.error("[Departments] Save IVR config error:", error);
      res.status(500).json({ error: "Failed to save IVR configuration" });
    }
  });

  /**
   * Update IVR configuration
   */
  router.patch("/ivr/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { name, isActive, greetingMessage, voiceId } = req.body;

      const updateData: Record<string, any> = { updatedAt: new Date() };
      if (name !== undefined) updateData.name = name;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (greetingMessage !== undefined) updateData.greetingMessage = greetingMessage;
      if (voiceId !== undefined) updateData.voiceId = voiceId;

      const updated = await db
        .update(ivrConfigurations)
        .set(updateData)
        .where(and(eq(ivrConfigurations.id, id), eq(ivrConfigurations.userId, req.userId!)))
        .returning();

      if (updated.length === 0) {
        return res.status(404).json({ error: "IVR configuration not found" });
      }

      res.json(updated[0]);
    } catch (error: any) {
      console.error("[Departments] Update IVR config error:", error);
      res.status(500).json({ error: "Failed to update IVR configuration" });
    }
  });

  /**
   * Delete IVR configuration
   */
  router.delete("/ivr/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      await db
        .delete(ivrConfigurations)
        .where(and(eq(ivrConfigurations.id, id), eq(ivrConfigurations.userId, req.userId!)));

      res.json({ success: true });
    } catch (error: any) {
      console.error("[Departments] Delete IVR config error:", error);
      res.status(500).json({ error: "Failed to delete IVR configuration" });
    }
  });

  /**
   * Get departments with agent counts for dashboard
   */
  router.get("/stats/overview", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const userDepartments = await db
        .select()
        .from(departments)
        .where(eq(departments.userId, req.userId!))
        .orderBy(asc(departments.sortOrder));

      const deptStats = await Promise.all(
        userDepartments.map(async (dept) => {
          const deptAgentData = await db
            .select({
              departmentAgent: departmentAgents,
              agent: agents,
            })
            .from(departmentAgents)
            .innerJoin(agents, eq(departmentAgents.agentId, agents.id))
            .where(eq(departmentAgents.departmentId, dept.id));

          return {
            ...dept,
            agentCount: deptAgentData.length,
            languages: [...new Set(deptAgentData.map(a => a.departmentAgent.language))],
            assignedAgents: deptAgentData.map(da => ({
              id: da.departmentAgent.id,
              agentId: da.departmentAgent.agentId,
              agentName: da.agent.name,
              language: da.departmentAgent.language,
            })),
          };
        })
      );

      const ivrConfigs = await db
        .select()
        .from(ivrConfigurations)
        .where(eq(ivrConfigurations.userId, req.userId!));

      const activeIvrCount = ivrConfigs.filter(ivr => ivr.isActive).length;

      res.json({
        departments: deptStats,
        totalDepartments: userDepartments.length,
        activeIvrCount,
        ivrConfigurations: ivrConfigs,
      });
    } catch (error: any) {
      console.error("[Departments] Get stats error:", error);
      res.status(500).json({ error: "Failed to fetch department stats" });
    }
  });

  /**
   * Delete all departments for the current user
   */
  router.delete("/all/clear", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      await db
        .delete(departments)
        .where(eq(departments.userId, req.userId!));

      await db
        .delete(ivrConfigurations)
        .where(eq(ivrConfigurations.userId, req.userId!));

      res.json({ success: true });
    } catch (error: any) {
      console.error("[Departments] Delete all error:", error);
      res.status(500).json({ error: "Failed to delete all departments" });
    }
  });

  return router;
}
