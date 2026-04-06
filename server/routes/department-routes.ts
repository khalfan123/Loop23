import { Router, Request, Response } from "express";
import { db } from "../db";
import { departments, departmentAgents, ivrConfigurations, departmentKnowledgeBases, agents, phoneNumbers, flows, incomingConnections, humanIncomingConnections, knowledgeBase } from "@shared/schema";
import type { FlowNode, FlowEdge } from "@shared/schema";
import { eq, and, desc, asc, inArray } from "drizzle-orm";
import { insertDepartmentSchema, insertIvrConfigurationSchema } from "@shared/schema";
import { twilioService } from "../services/twilio";
import { getDomain } from "../utils/domain";
import { textToSpeech } from "../replit_integrations/audio/client";
import { ElevenLabsService } from "../services/elevenlabs";
import { nanoid } from "nanoid";
import { getOpenAIClient } from "../services/openai-modelfarm";

interface AuthRequest extends Request {
  userId?: string;
}

function getDepartmentType(name: string): "sales" | "support" | "scheduling" | "custom" {
  const lowerName = name.toLowerCase();
  if (lowerName.includes("sales") || lowerName.includes("vente")) return "sales";
  if (lowerName.includes("support") || lowerName.includes("help") || lowerName.includes("assistance")) return "support";
  if (lowerName.includes("schedule") || lowerName.includes("appointment") || lowerName.includes("booking") || lowerName.includes("rendez-vous")) return "scheduling";
  return "custom";
}

function generateDefaultFlowNodes(departmentName: string, agentName: string = "your AI assistant"): { nodes: FlowNode[], edges: FlowEdge[] } {
  const deptType = getDepartmentType(departmentName);
  
  const greetingMessages: Record<string, string> = {
    sales: `Hello! I'm ${agentName}. Thank you for calling our sales department. How can I help you today?`,
    support: `Hello! I'm ${agentName}. Thank you for reaching our support team. How may I assist you?`,
    scheduling: `Hello! I'm ${agentName}. Thank you for calling. I can help you schedule an appointment. What day works best for you?`,
    custom: `Hello! Thank you for calling ${departmentName}. I'm ${agentName}. How can I assist you today?`,
  };

  const nodes: FlowNode[] = [
    {
      id: "greeting",
      type: "message",
      position: { x: 250, y: 50 },
      data: {
        label: "Greeting",
        config: {
          type: "message",
          message: greetingMessages[deptType],
          waitForResponse: false,
        },
      },
    },
    {
      id: "knowledge_base",
      type: "question",
      position: { x: 250, y: 180 },
      data: {
        label: "Knowledge Base",
        config: {
          type: "question",
          question: "Let me check that for you. What would you like to know?",
          variableName: "user_question",
          expectedResponseType: "text",
          waitForResponse: true,
        },
      },
    },
    {
      id: "follow_up",
      type: "question",
      position: { x: 250, y: 310 },
      data: {
        label: "Follow Up Question",
        config: {
          type: "question",
          question: "Is there anything else I can help you with, or would you like to speak with a team member?",
          variableName: "wants_more_help",
          expectedResponseType: "yes_no",
          waitForResponse: true,
        },
      },
    },
    {
      id: "condition",
      type: "condition",
      position: { x: 250, y: 440 },
      data: {
        label: "Check Response",
        config: {
          type: "condition",
          conditions: [
            {
              type: "keyword",
              value: "transfer,human,agent,person,team,speak,talk",
              targetNodeId: "transfer",
              label: "Wants Transfer",
            },
            {
              type: "yes_no",
              value: "no",
              targetNodeId: "end",
              label: "No More Help",
            },
          ],
          defaultTargetNodeId: "knowledge_base",
        },
      },
    },
    {
      id: "transfer",
      type: "transfer",
      position: { x: 100, y: 570 },
      data: {
        label: "Transfer Call",
        config: {
          type: "transfer",
          transferNumber: "",
          message: "I'll transfer you now. Please hold.",
        },
      },
    },
    {
      id: "end",
      type: "end",
      position: { x: 400, y: 570 },
      data: {
        label: "End Call",
        config: {
          type: "end",
          message: "Thank you for calling. Have a great day!",
        },
      },
    },
  ];

  const edges: FlowEdge[] = [
    { id: "e-greeting-kb", source: "greeting", target: "knowledge_base" },
    { id: "e-kb-followup", source: "knowledge_base", target: "follow_up" },
    { id: "e-followup-condition", source: "follow_up", target: "condition" },
    { id: "e-condition-transfer", source: "condition", target: "transfer", label: "Transfer", sourceHandle: "transfer" },
    { id: "e-condition-end", source: "condition", target: "end", label: "End", sourceHandle: "end" },
    { id: "e-condition-kb", source: "condition", target: "knowledge_base", label: "More Help", sourceHandle: "default" },
  ];

  return { nodes, edges };
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
        .where(and(eq(departments.userId, req.userId!), eq(departments.engineType, 'default')))
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
        .where(and(eq(departments.id, id), eq(departments.userId, req.userId!), eq(departments.engineType, 'default')))
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
        .where(and(eq(departments.userId, req.userId!), eq(departments.engineType, 'default')));

      const flowId = nanoid();
      const { nodes, edges } = generateDefaultFlowNodes(validatedData.name);

      const result = await db.transaction(async (tx) => {
        const [newFlow] = await tx
          .insert(flows)
          .values({
            id: flowId,
            userId: req.userId!,
            name: `${validatedData.name} Flow`,
            description: `Auto-generated conversation flow for ${validatedData.name} department`,
            nodes,
            edges,
            isActive: true,
            isTemplate: false,
          } as typeof flows.$inferInsert)
          .returning();

        console.log(`[Departments] Created flow "${newFlow.name}" (${flowId}) for department "${validatedData.name}"`);

        const [newDepartment] = await tx
          .insert(departments)
          .values({
            ...validatedData,
            sortOrder: existingCount.length,
            flowId: flowId,
            engineType: 'default',
          })
          .returning();

        return { department: newDepartment, flow: newFlow };
      });

      res.status(201).json({ ...result.department, flow: result.flow });
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
        .where(and(eq(departments.id, id), eq(departments.userId, req.userId!), eq(departments.engineType, 'default')))
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
        .where(and(eq(departments.id, id), eq(departments.userId, req.userId!), eq(departments.engineType, 'default')))
        .returning();

      res.json(updated[0]);
    } catch (error: any) {
      console.error("[Departments] Update error:", error);
      res.status(500).json({ error: "Failed to update department" });
    }
  });

  /**
   * Generate flow for existing department without one
   */
  router.post("/:id/generate-flow", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const [existingDept] = await db
        .select()
        .from(departments)
        .where(and(eq(departments.id, id), eq(departments.userId, req.userId!), eq(departments.engineType, 'default')))
        .limit(1);

      if (!existingDept) {
        return res.status(404).json({ error: "Department not found" });
      }

      if (existingDept.flowId) {
        return res.json({ flowId: existingDept.flowId, message: "Flow already exists" });
      }

      const flowId = nanoid();
      const { nodes, edges } = generateDefaultFlowNodes(existingDept.name);

      const result = await db.transaction(async (tx) => {
        const [newFlow] = await tx
          .insert(flows)
          .values({
            id: flowId,
            userId: req.userId!,
            name: `${existingDept.name} Flow`,
            description: `Auto-generated conversation flow for ${existingDept.name} department`,
            nodes,
            edges,
            isActive: true,
            isTemplate: false,
          } as typeof flows.$inferInsert)
          .returning();

        const [updatedDept] = await tx
          .update(departments)
          .set({ flowId: flowId, updatedAt: new Date() })
          .where(and(eq(departments.id, id), eq(departments.engineType, 'default')))
          .returning();

        return { department: updatedDept, flow: newFlow };
      });

      console.log(`[Departments] Generated flow for existing department "${existingDept.name}" (${flowId})`);
      res.json(result);
    } catch (error: any) {
      console.error("[Departments] Generate flow error:", error);
      res.status(500).json({ error: "Failed to generate flow" });
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
        .where(and(eq(departments.id, id), eq(departments.userId, req.userId!), eq(departments.engineType, 'default')))
        .limit(1);

      if (existingDept.length === 0) {
        return res.status(404).json({ error: "Department not found" });
      }

      const linkedAgents = await db
        .select({ agentId: departmentAgents.agentId })
        .from(departmentAgents)
        .where(eq(departmentAgents.departmentId, id));

      const linkedAgentIds = [...new Set(linkedAgents.map(a => a.agentId))];

      await db.transaction(async (tx) => {
        if (linkedAgentIds.length > 0) {
          await tx
            .delete(agents)
            .where(and(inArray(agents.id, linkedAgentIds), eq(agents.userId, req.userId!)));
        }

        await tx
          .delete(departments)
          .where(and(eq(departments.id, id), eq(departments.userId, req.userId!), eq(departments.engineType, 'default')));
      });

      if (linkedAgentIds.length > 0) {
        console.log(`[Departments] Deleted ${linkedAgentIds.length} linked agent(s) for department ${id}`);
      }

      res.json({ success: true, deletedAgents: linkedAgentIds.length });
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
      const { agentId, language, isPrimary, systemPrompt, voiceTone, voiceId } = req.body;

      if (!agentId) {
        return res.status(400).json({ error: "agentId is required" });
      }

      // Verify department belongs to user
      const existingDept = await db
        .select()
        .from(departments)
        .where(and(eq(departments.id, id), eq(departments.userId, req.userId!), eq(departments.engineType, 'default')))
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

      // Sync the canvas-generated prompt and voice settings to the agent record
      // This ensures the agent uses the updated prompt during actual calls
      if (systemPrompt || voiceId || voiceTone) {
        const agentUpdate: Record<string, any> = {};
        if (systemPrompt) agentUpdate.systemPrompt = systemPrompt;
        if (voiceId) agentUpdate.openaiVoice = voiceId;
        if (voiceTone) agentUpdate.voiceTone = voiceTone;

        await db
          .update(agents)
          .set(agentUpdate)
          .where(and(eq(agents.id, agentId), eq(agents.userId, req.userId!)));

        console.log(`[Departments] Synced agent ${agentId} with canvas config: prompt=${!!systemPrompt}, voice=${voiceId || 'unchanged'}, tone=${voiceTone || 'unchanged'}`);
      }

      // Sync agent to department's flow so the flow shows the correct voice/agent
      const deptData = existingDept[0];
      if (deptData.flowId) {
        if (isPrimary) {
          await db
            .update(flows)
            .set({ agentId, updatedAt: new Date() })
            .where(eq(flows.id, deptData.flowId));
          console.log(`[Departments] Synced flow ${deptData.flowId} with primary agent ${agentId}`);
        } else {
          const [currentFlow] = await db
            .select()
            .from(flows)
            .where(eq(flows.id, deptData.flowId))
            .limit(1);
          if (currentFlow && !currentFlow.agentId) {
            await db
              .update(flows)
              .set({ agentId, updatedAt: new Date() })
              .where(eq(flows.id, deptData.flowId));
            console.log(`[Departments] Synced flow ${deptData.flowId} with agent ${agentId} (no previous agent)`);
          }
        }
      }

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
        .where(and(eq(departments.id, id), eq(departments.userId, req.userId!), eq(departments.engineType, 'default')))
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

      // Sync flow agentId after removing the agent
      const deptData = existingDept[0];
      if (deptData.flowId) {
        const [currentFlow] = await db
          .select()
          .from(flows)
          .where(eq(flows.id, deptData.flowId))
          .limit(1);

        if (currentFlow && currentFlow.agentId === agentId) {
          const remainingAgents = await db
            .select()
            .from(departmentAgents)
            .where(eq(departmentAgents.departmentId, id));

          const primaryAgent = remainingAgents.find(a => a.isPrimary);
          const replacementAgentId = primaryAgent?.agentId || remainingAgents[0]?.agentId || null;

          await db
            .update(flows)
            .set({ agentId: replacementAgentId, updatedAt: new Date() })
            .where(eq(flows.id, deptData.flowId));
          console.log(`[Departments] Updated flow ${deptData.flowId} agentId to ${replacementAgentId} after removing agent ${agentId}`);
        }
      }

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
        .where(and(eq(departments.id, id), eq(departments.userId, req.userId!), eq(departments.engineType, 'default')))
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
        .where(and(eq(ivrConfigurations.userId, req.userId!), eq(ivrConfigurations.engineType, 'default')));

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
      const { id, phoneNumberId, name, isActive, greetingMessage, voiceId, voiceName, menuOptions, languageOptions, fallbackDepartmentId } = req.body;

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
          .where(and(eq(departments.id, fallbackDepartmentId), eq(departments.userId, req.userId!), eq(departments.engineType, 'default')))
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
              .where(and(eq(departments.id, option.departmentId), eq(departments.userId, req.userId!), eq(departments.engineType, 'default')))
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
            languageOptions,
            fallbackDepartmentId,
            updatedAt: new Date(),
          })
          .where(and(eq(ivrConfigurations.id, id), eq(ivrConfigurations.userId, req.userId!), eq(ivrConfigurations.engineType, 'default')))
          .returning();

        res.json(updated[0]);
      } else {
        // Auto-populate menu options from existing departments if not provided
        let finalMenuOptions = menuOptions;
        if (!menuOptions || menuOptions.length === 0) {
          const userDepartments = await db
            .select()
            .from(departments)
            .where(and(eq(departments.userId, req.userId!), eq(departments.engineType, 'default')))
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
            languageOptions,
            fallbackDepartmentId,
            engineType: 'default',
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
      const { name, isActive, greetingMessage, voiceId, languageOptions } = req.body;

      const updateData: Record<string, any> = { updatedAt: new Date() };
      if (name !== undefined) updateData.name = name;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (greetingMessage !== undefined) updateData.greetingMessage = greetingMessage;
      if (voiceId !== undefined) updateData.voiceId = voiceId;
      if (languageOptions !== undefined) updateData.languageOptions = languageOptions;

      const updated = await db
        .update(ivrConfigurations)
        .set(updateData)
        .where(and(eq(ivrConfigurations.id, id), eq(ivrConfigurations.userId, req.userId!), eq(ivrConfigurations.engineType, 'default')))
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
        .where(and(eq(ivrConfigurations.id, id), eq(ivrConfigurations.userId, req.userId!), eq(ivrConfigurations.engineType, 'default')));

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
        .where(and(eq(departments.userId, req.userId!), eq(departments.engineType, 'default')))
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
        .where(and(eq(ivrConfigurations.userId, req.userId!), eq(ivrConfigurations.engineType, 'default')));

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
      const userDepts = await db
        .select({ id: departments.id })
        .from(departments)
        .where(and(eq(departments.userId, req.userId!), eq(departments.engineType, 'default')));

      const deptIds = userDepts.map(d => d.id);

      let deletedAgentCount = 0;

      await db.transaction(async (tx) => {
        if (deptIds.length > 0) {
          const linkedAgents = await tx
            .select({ agentId: departmentAgents.agentId })
            .from(departmentAgents)
            .where(inArray(departmentAgents.departmentId, deptIds));

          const linkedAgentIds = [...new Set(linkedAgents.map(a => a.agentId))];

          if (linkedAgentIds.length > 0) {
            await tx
              .delete(agents)
              .where(and(inArray(agents.id, linkedAgentIds), eq(agents.userId, req.userId!)));
            deletedAgentCount = linkedAgentIds.length;
          }
        }

        await tx
          .delete(incomingConnections)
          .where(eq(incomingConnections.userId, req.userId!));

        await tx
          .delete(humanIncomingConnections)
          .where(eq(humanIncomingConnections.userId, req.userId!));

        await tx
          .delete(departments)
          .where(and(eq(departments.userId, req.userId!), eq(departments.engineType, 'default')));

        await tx
          .delete(ivrConfigurations)
          .where(and(eq(ivrConfigurations.userId, req.userId!), eq(ivrConfigurations.engineType, 'default')));
      });

      console.log(`[Departments] Cleared all departments and ${deletedAgentCount} linked agent(s)`);
      res.json({ success: true, deletedAgents: deletedAgentCount });
    } catch (error: any) {
      console.error("[Departments] Delete all error:", error);
      res.status(500).json({ error: "Failed to delete all departments" });
    }
  });

  /**
   * Voice preview - Generate TTS audio from greeting text
   * Supports both OpenAI and ElevenLabs voices
   */
  router.post("/voice-preview", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { voiceId, text, speed } = req.body;
      
      if (!voiceId || !text) {
        return res.status(400).json({ error: "voiceId and text are required" });
      }
      
      const isElevenLabsVoice = isElevenLabsVoiceId(voiceId);
      const voiceSpeed = typeof speed === 'number'
        ? (isElevenLabsVoice
            ? Math.max(0.7, Math.min(1.2, speed))
            : Math.max(0.5, Math.min(1.5, speed)))
        : 1.0;
      
      if (isElevenLabsVoice) {
        const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
        if (!elevenLabsApiKey) {
          return res.status(400).json({ error: "ElevenLabs API key not configured" });
        }
        
        const elevenLabsVoiceId = getElevenLabsVoiceId(voiceId);
        if (!elevenLabsVoiceId) {
          return res.status(400).json({ error: "Invalid ElevenLabs voice ID" });
        }
        
        const elevenLabsService = new ElevenLabsService(elevenLabsApiKey);
        const audioBuffer = await elevenLabsService.generateVoicePreview({
          voiceId: elevenLabsVoiceId,
          text,
          voiceSettings: { speed: voiceSpeed },
        });
        
        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Content-Disposition", "inline; filename=preview.mp3");
        res.send(audioBuffer);
      } else {
        const validOpenAIVoices = ["alloy", "echo", "shimmer", "ash", "coral", "sage", "verse", "nova", "fable", "onyx"];
        const voice = validOpenAIVoices.includes(voiceId) ? voiceId : "nova";
        
        const audioBuffer = await textToSpeech(text, voice as any, "mp3");
        
        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Content-Disposition", "inline; filename=preview.mp3");
        res.send(audioBuffer);
      }
    } catch (error: any) {
      console.error("[Departments] Voice preview error:", error);
      res.status(500).json({ error: error.message || "Failed to generate voice preview" });
    }
  });

  router.post("/generate-prompt", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { departmentType, departmentName, language, agentName, features } = req.body;
      const userId = req.userId!;

      if (!departmentType || !departmentName) {
        return res.status(400).json({ error: "departmentType and departmentName are required" });
      }

      const langLabel = language || "English";
      const featuresList: string[] = [];
      if (features?.enableLanguageDetection) featuresList.push("auto-detect caller language and respond in their language");
      if (features?.enableEndConversation) featuresList.push("intelligently end conversations when appropriate using farewell phrases");
      if (features?.enableAppointmentBooking) featuresList.push("book appointments during calls");
      if (features?.enableRecording) featuresList.push("inform callers that the call is being recorded for quality and training");
      if (features?.enableTransfer) featuresList.push("transfer calls to human operators when needed");

      const featuresContext = featuresList.length > 0
        ? `\nThe agent has these features enabled: ${featuresList.join(", ")}.`
        : "";

      const agentNameContext = agentName
        ? `\nThe agent's name is "${agentName}". Use this name when the agent introduces itself. The name should appear naturally in the language of the prompt.`
        : "";

      let companyContext = "";
      try {
        const kbEntries = await db
          .select({ title: knowledgeBase.title, content: knowledgeBase.content, type: knowledgeBase.type })
          .from(knowledgeBase)
          .where(eq(knowledgeBase.userId, userId));

        if (kbEntries.length > 0) {
          const summaryParts: string[] = [];
          for (const entry of kbEntries) {
            const snippet = entry.content ? entry.content.substring(0, 300) : "";
            if (snippet) {
              summaryParts.push(`- ${entry.title}: ${snippet}`);
            } else {
              summaryParts.push(`- ${entry.title} (${entry.type})`);
            }
            if (summaryParts.length >= 15) break;
          }
          companyContext = `\n\nCOMPANY KNOWLEDGE BASE (use this to personalize the prompt with real company details, products, services, and policies):\n${summaryParts.join("\n")}`;
        }
      } catch (kbErr) {
        console.warn("[Departments] Could not fetch knowledge base for prompt generation:", kbErr);
      }

      const openai = await getOpenAIClient();
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_completion_tokens: 1500,
        messages: [
          {
            role: "system",
            content: `You are an expert at writing system prompts for AI phone call agents. Generate a professional, detailed system prompt for a department agent. The prompt should be specific to the department's purpose and include behavioral guidelines, tone instructions, and handling procedures. If company knowledge base information is provided, use it to personalize the prompt with real company details — reference actual products, services, policies, and brand identity instead of using generic placeholders. The entire prompt MUST be written in ${langLabel}. Output ONLY the system prompt text, no explanations or markdown.`
          },
          {
            role: "user",
            content: `Generate a system prompt for a "${departmentName}" department agent.
Department type: ${departmentType}
Primary language: ${langLabel}${agentNameContext}${featuresContext}${companyContext}

The prompt should:
- Define the agent's role clearly for a ${departmentType} department
- Use the department name "${departmentName}" as it is (already translated to ${langLabel})
- Set the appropriate tone and communication style
- Include specific handling procedures for ${departmentType} scenarios
- Provide guidelines for common ${departmentType} situations
- Be professional yet conversational
- If company knowledge base data is available, incorporate specific company details (products, services, policies, brand name) into the prompt instead of generic placeholders
- The ENTIRE prompt must be written in ${langLabel}`
          }
        ],
      });

      const generatedPrompt = response.choices[0]?.message?.content?.trim() || "";
      res.json({ prompt: generatedPrompt });
    } catch (error: any) {
      console.error("[Departments] Generate prompt error:", error);
      res.status(500).json({ error: error.message || "Failed to generate prompt" });
    }
  });

  return router;
}

export function createIvrAudioRoutes() {
  const router = Router();

  router.get("/ivr-greeting-audio/:ivrId", async (req: Request, res: Response) => {
    try {
      const { ivrId } = req.params;
      const textParam = req.query.text as string | undefined;
      const voiceIdParam = req.query.voiceId as string | undefined;
      const langIdx = req.query.idx as string | undefined;

      const ivrConfig = await db
        .select()
        .from(ivrConfigurations)
        .where(and(eq(ivrConfigurations.id, ivrId), eq(ivrConfigurations.engineType, 'default')))
        .limit(1);

      if (!ivrConfig.length) {
        return res.status(404).json({ error: "IVR configuration not found" });
      }

      const config = ivrConfig[0];
      let voiceId = voiceIdParam || config.voiceId || "nova";
      let text = textParam || config.greetingMessage || "Thank you for calling.";

      if (langIdx !== undefined) {
        const langOptions = config.languageOptions as { voiceId?: string; greeting?: string }[] | null;
        const idx = parseInt(langIdx, 10);
        if (langOptions && langOptions[idx]) {
          if (!voiceIdParam && langOptions[idx].voiceId) {
            voiceId = langOptions[idx].voiceId!;
          }
          if (!textParam && langOptions[idx].greeting) {
            text = langOptions[idx].greeting!;
          }
        }
      }

      const speedParam = req.query.speed as string | undefined;
      const voiceSpeed = speedParam ? Math.max(0.5, Math.min(1.5, parseFloat(speedParam))) : 0.92;
      const cacheKey = `${ivrId}-${voiceId}-${hashText(text)}-spd${voiceSpeed}`;
      const cached = ttsAudioCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < TTS_CACHE_TTL) {
        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        return res.send(cached.buffer);
      }

      let audioBuffer: Buffer;
      const isElevenLabsVoice = isElevenLabsVoiceId(voiceId);

      if (isElevenLabsVoice) {
        const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
        if (!elevenLabsApiKey) {
          return res.status(500).json({ error: "ElevenLabs API key not configured" });
        }
        const elevenLabsVoiceId = getElevenLabsVoiceId(voiceId);
        if (!elevenLabsVoiceId) {
          return res.status(400).json({ error: "Invalid ElevenLabs voice ID" });
        }
        const elService = new ElevenLabsService(elevenLabsApiKey);
        const hasArabic = /[\u0600-\u06FF]/.test(text);
        audioBuffer = await elService.generateVoicePreview({
          voiceId: elevenLabsVoiceId,
          text,
          voiceSettings: {
            stability: hasArabic ? 0.75 : 0.6,
            similarity_boost: hasArabic ? 0.85 : 0.8,
            speed: voiceSpeed,
          },
        });
      } else {
        const validOpenAIVoices = ["alloy", "echo", "shimmer", "ash", "coral", "sage", "verse", "nova", "fable", "onyx"];
        const voice = validOpenAIVoices.includes(voiceId) ? voiceId : "nova";
        audioBuffer = await textToSpeech(text, voice as any, "mp3");
      }

      ttsAudioCache.set(cacheKey, { buffer: audioBuffer, timestamp: Date.now() });

      if (ttsAudioCache.size > 100) {
        const now = Date.now();
        for (const [key, val] of ttsAudioCache) {
          if (now - val.timestamp > TTS_CACHE_TTL) {
            ttsAudioCache.delete(key);
          }
        }
      }

      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.send(audioBuffer);
    } catch (error: any) {
      console.error("[IVR Audio] Error generating TTS audio:", error);
      res.status(500).json({ error: error.message || "Failed to generate audio" });
    }
  });

  return router;
}

const ttsAudioCache = new Map<string, { buffer: Buffer; timestamp: number }>();
const TTS_CACHE_TTL = 10 * 60 * 1000;

function hashText(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const chr = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return hash.toString(36);
}

function isElevenLabsVoiceId(vid: string | undefined): boolean {
  if (!vid) return false;
  if (vid.startsWith('el_')) return true;
  if (/^[a-zA-Z0-9]{10,}$/.test(vid)) return true;
  return false;
}

function getElevenLabsVoiceId(internalId: string): string | null {
  const voiceMap: Record<string, string> = {
    el_rachel: "21m00Tcm4TlvDq8ikWAM",
    el_domi: "AZnzlk1XvdvUeBnXmlld",
    el_bella: "EXAVITQu4vr4xnSDxMaL",
    el_antoni: "ErXwobaYiN019PkySvjV",
    el_elli: "MF3mGyEYCl7XYWbV9V6O",
    el_josh: "TxGEqnHWrfWFTfGW9XjX",
    el_arnold: "VR6AewLTigWG4xSOukaG",
    el_adam: "pNInz6obpgDQGcFmaJgB",
    el_sam: "yoZ06aMxZJJ28mfd3POQ",
    el_nicole: "piTKgcLEGmPE4e6mEKli",
    el_marie: "6vTyAgAT8PncODBcLjRf",
    el_pierre: "aQROLel5sQbj1vuIVi6B",
    el_giulia: "gfKKsLN1k0oYYN9n2dXX",
    el_marco: "W71zT1VwIFFx3mMGH2uZ",
    el_xiaoli: "ByhETIclHirOlWnWKhHc",
    el_wei: "4VZIsMPtgggwNg7OXbPY",
    el_priya: "KYiVPerWcenyBTIvWbfY",
    el_raj: "zT03pEAEi0VHKciJODfn",
    el_fatima: "u0TsaWvt0v8migutHM3M",
    el_omar: "G1HOkzin3NMwRHSq60UI",
  };
  if (voiceMap[internalId]) return voiceMap[internalId];
  if (!internalId.startsWith("el_") && /^[a-zA-Z0-9]{10,}$/.test(internalId)) return internalId;
  return null;
}
