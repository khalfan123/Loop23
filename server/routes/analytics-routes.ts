'use strict';
/**
 * ============================================================
 * © 2025 Diploy — a brand of Bisht Technologies Private Limited
 * Original Author: BTPL Engineering Team
 * Website: https://diploy.in
 * Contact: cs@diploy.in
 *
 * Distributed under the Envato / CodeCanyon License Agreement.
 * Licensed to the purchaser for use as defined by the
 * Envato Market (CodeCanyon) Regular or Extended License.
 *
 * You are NOT permitted to redistribute, resell, sublicense,
 * or share this source code, in whole or in part.
 * Respect the author's rights and Envato licensing terms.
 * ============================================================
 */

import { Router, Response } from "express";
import { RouteContext, AuthRequest } from "./common";
import { calls, agents, incomingConnections, callResponses, twilioOpenaiCalls } from "@shared/schema";
import { eq, and, sql, inArray, isNull, isNotNull, or } from "drizzle-orm";
import { z } from "zod";
import { ElevenLabsService } from "../services/elevenlabs";
import { ElevenLabsPoolService } from "../services/elevenlabs-pool";
import { getTwilioClient } from "../services/twilio-connector";
import { fetchElevenLabsConversation } from "./webhook-routes";
import PDFDocument from "pdfkit";
import { CallInsightsService } from "../services/call-insights.service";

function formatDurationPDF(seconds: number): string {
  if (!seconds) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function createAnalyticsRoutes(ctx: RouteContext): Router {
  const router = Router();
  const { db, storage, authenticateToken, authenticateHybrid, recordingService, elevenLabsService } = ctx;

  // Concern rules mapping for screening questions
  const CONCERN_RULES: Record<string, (answer: string) => boolean> = {
    "steady_housing": (answer) => answer.toLowerCase() === "no",
    "safe_living": (answer) => answer.toLowerCase() === "no",
    "home_problems": (answer) => {
      if (!answer || answer.toLowerCase() === "none" || answer === "[]") return false;
      try { const arr = JSON.parse(answer); return Array.isArray(arr) && arr.length > 0; } catch { return answer.trim().length > 0; }
    },
    "food_insecurity": (answer) => answer.toLowerCase() === "yes",
    "transportation_issues": (answer) => answer.toLowerCase() === "yes",
    "employment_status": (answer) => answer.toLowerCase() === "no",
  };

  function computeIsConcern(questionId: string, answerValue: string): boolean {
    const rule = CONCERN_RULES[questionId];
    if (!rule) return false;
    return rule(answerValue);
  }

  // Get all user calls with pagination support
  router.get("/api/calls", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const enrichedCalls = await storage.getUserCallsWithDetails(req.userId!);

      // Batch-fetch concern counts for all call IDs
      const allCallIds = enrichedCalls.map((c: any) => c.id);
      let concernCounts: Record<string, number> = {};
      if (allCallIds.length > 0) {
        const counts = await db.select({
          callId: callResponses.callId,
          count: sql<number>`count(*)::int`,
        })
          .from(callResponses)
          .where(and(
            inArray(callResponses.callId, allCallIds),
            eq(callResponses.isConcern, true)
          ))
          .groupBy(callResponses.callId);
        for (const row of counts) {
          concernCounts[row.callId] = row.count;
        }
      }

      const callsWithConcerns = enrichedCalls.map((c: any) => ({
        ...c,
        concernedQuestionsCount: concernCounts[c.id] || 0,
      }));

      const requestsPagination = req.query.page !== undefined || req.query.pageSize !== undefined;
      
      if (requestsPagination) {
        const page = parseInt(req.query.page as string, 10) || 1;
        const pageSize = parseInt(req.query.pageSize as string, 10) || 25;
        const offset = (page - 1) * pageSize;

        const totalItems = callsWithConcerns.length;
        const totalPages = Math.ceil(totalItems / pageSize);

        const paginatedCalls = callsWithConcerns.slice(offset, offset + pageSize);

        res.json({
          data: paginatedCalls,
          pagination: {
            page,
            pageSize,
            totalItems,
            totalPages
          }
        });
      } else {
        res.json(callsWithConcerns);
      }
    } catch (error: any) {
      console.error("Get calls error:", error);
      res.status(500).json({ error: "Failed to get calls" });
    }
  });

  // Get single call details with responses
  router.get("/api/calls/:id", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const callWithDetails = await storage.getCallWithDetails(req.params.id);
      if (!callWithDetails) {
        return res.status(404).json({ error: "Call not found" });
      }

      if (callWithDetails.userId === req.userId) {
        // Direct ownership - allow access
      } else if (callWithDetails.campaignId) {
        const campaign = await storage.getCampaignIncludingDeleted(callWithDetails.campaignId);
        if (!campaign || campaign.userId !== req.userId) {
          return res.status(403).json({ error: "Access denied" });
        }
      } else if (callWithDetails.incomingConnectionId) {
        const [connection] = await db
          .select()
          .from(incomingConnections)
          .where(eq(incomingConnections.id, callWithDetails.incomingConnectionId))
          .limit(1);
        if (!connection || connection.userId !== req.userId) {
          return res.status(403).json({ error: "Access denied" });
        }
      } else {
        return res.status(403).json({ error: "Access denied" });
      }

      // Include screening responses and concern count
      const responses = await storage.getCallResponses(req.params.id);
      const concernedQuestionsCount = responses.filter(r => r.isConcern).length;

      res.json({
        ...callWithDetails,
        responses,
        concernedQuestionsCount,
      });
    } catch (error: any) {
      console.error("Get call error:", error);
      res.status(500).json({ error: "Failed to get call" });
    }
  });

  // Add/update screening responses for a call session
  const responseSchema = z.object({
    responses: z.array(z.object({
      questionId: z.string(),
      questionText: z.string(),
      answerType: z.enum(["BOOLEAN", "MULTISELECT", "TEXT", "NUMBER"]).default("BOOLEAN"),
      answerValue: z.string(),
    })),
  });

  router.post("/api/calls/:id/responses", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const callRecord = await storage.getCallWithDetails(req.params.id);
      if (!callRecord) {
        return res.status(404).json({ error: "Call not found" });
      }
      if (callRecord.userId !== req.userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const parsed = responseSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request body", details: parsed.error.errors });
      }

      // Delete existing responses then recreate
      await storage.deleteCallResponses(req.params.id);

      const responsesToInsert = parsed.data.responses.map(r => ({
        callId: req.params.id,
        questionId: r.questionId,
        questionText: r.questionText,
        answerType: r.answerType,
        answerValue: r.answerValue,
        isConcern: computeIsConcern(r.questionId, r.answerValue),
      }));

      const created = await storage.createCallResponses(responsesToInsert);
      const concernedQuestionsCount = created.filter(r => r.isConcern).length;

      res.json({ responses: created, concernedQuestionsCount });
    } catch (error: any) {
      console.error("Create call responses error:", error);
      res.status(500).json({ error: "Failed to save responses" });
    }
  });

  // Download call recording - handles ElevenLabs+Twilio and Twilio+OpenAI engines
  router.get("/api/calls/:id/recording", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      // Use getCallWithDetails which checks both calls and twilioOpenaiCalls tables
      const callWithDetails = await storage.getCallWithDetails(req.params.id);
      if (!callWithDetails) {
        return res.status(404).json({ error: "Call not found" });
      }

      if (callWithDetails.userId === req.userId) {
        // Direct ownership - allow access
      } else if (callWithDetails.campaignId) {
        const campaign = await storage.getCampaignIncludingDeleted(callWithDetails.campaignId);
        if (!campaign || campaign.userId !== req.userId) {
          return res.status(403).json({ error: "Access denied" });
        }
      } else if (callWithDetails.incomingConnectionId) {
        const [connection] = await db
          .select()
          .from(incomingConnections)
          .where(eq(incomingConnections.id, callWithDetails.incomingConnectionId))
          .limit(1);
        if (!connection || connection.userId !== req.userId) {
          return res.status(403).json({ error: "Access denied" });
        }
      } else {
        return res.status(403).json({ error: "Access denied" });
      }

      // Handle OpenAI widget calls - WebRTC calls don't have server-side recordings
      if (callWithDetails.engine === 'openai') {
        console.log(`🎙️ [Recording] OpenAI widget call ${callWithDetails.id} - WebRTC calls don't have server-side recordings`);
        return res.status(404).json({ 
          error: "Recording not available", 
          details: "OpenAI widget calls use WebRTC and don't have server-side recordings. The conversation transcript is available instead." 
        });
      }

      // Handle Twilio+OpenAI calls - fetch recording directly from Twilio using twilioSid
      if (callWithDetails.engine === 'twilio-openai') {
        console.log(`🎙️ [Recording] Fetching Twilio+OpenAI recording for call ${callWithDetails.id}`);
        
        if (callWithDetails.twilioSid) {
          const twilioResult = await recordingService.fetchTwilioRecordingBySid(callWithDetails.twilioSid);
          if (twilioResult) {
            res.setHeader('Content-Type', twilioResult.contentType);
            res.setHeader('Content-Disposition', `inline; filename="call-recording-${callWithDetails.id}.mp3"`);
            res.setHeader('Cache-Control', 'no-cache');
            return res.send(twilioResult.audioBuffer);
          }
        }
        
        // Try using stored recording URL as fallback
        if (callWithDetails.recordingUrl) {
          const urlResult = await recordingService.fetchTwilioRecordingByUrl(callWithDetails.recordingUrl);
          if (urlResult) {
            res.setHeader('Content-Type', urlResult.contentType);
            res.setHeader('Content-Disposition', `inline; filename="call-recording-${callWithDetails.id}.mp3"`);
            res.setHeader('Cache-Control', 'no-cache');
            return res.send(urlResult.audioBuffer);
          }
        }
        
        return res.status(404).json({ 
          error: "Recording not available", 
          details: "No recording found for this Twilio+OpenAI call" 
        });
      }


      // Handle ElevenLabs calls (existing logic)
      const result = await recordingService.getRecordingAudio(callWithDetails);
      
      if ('audioBuffer' in result) {
        res.setHeader('Content-Type', result.contentType);
        res.setHeader('Content-Disposition', `inline; filename="call-recording-${callWithDetails.id}.mp3"`);
        res.setHeader('Cache-Control', 'no-cache');
        return res.send(result.audioBuffer);
      } else {
        return res.status(404).json(result);
      }

    } catch (error: any) {
      console.error("Download recording error:", error);
      res.status(500).json({ error: "Failed to download recording", details: error.message });
    }
  });

  // Sync missing call recordings from Twilio AND ElevenLabs
  router.post("/api/calls/sync-recordings", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      console.log(`🎙️ [User ${req.userId}] Starting recording sync...`);
      
      const userCalls = await storage.getUserCallsWithDetails(req.userId!);
      
      const twilioCalls = userCalls.filter(
        call => call.twilioSid && !call.recordingUrl && (call.status === 'completed' || call.status === 'answered')
      );
      
      const elevenLabsCalls = userCalls.filter(
        call => call.elevenLabsConversationId && 
          (!call.transcript || !call.aiSummary || !call.duration) && 
          (call.status === 'completed' || call.status === 'answered' || call.status === 'ended')
      );
      
      console.log(`📊 Found ${twilioCalls.length} Twilio calls without recordings for user ${req.userId}`);
      console.log(`📊 Found ${elevenLabsCalls.length} ElevenLabs calls missing metadata for user ${req.userId}`);
      
      let successCount = 0;
      let failCount = 0;
      const errors: string[] = [];
      
      // Sync Twilio recordings
      if (twilioCalls.length > 0) {
        try {
          const twilioClient = await getTwilioClient();
          
          for (const call of twilioCalls) {
            try {
              console.log(`🔍 [Twilio] Fetching recordings for call ${call.id} (Twilio SID: ${call.twilioSid})`);
              
              const recordings = await twilioClient.recordings.list({
                callSid: call.twilioSid!,
                limit: 1
              });
              
              if (recordings.length > 0) {
                const recording = recordings[0];
                const recordingUrl = `https://api.twilio.com${recording.uri.replace('.json', '')}`;
                
                console.log(`✅ [Twilio] Found recording: ${recordingUrl}`);
                
                await db
                  .update(calls)
                  .set({
                    recordingUrl,
                    duration: recording.duration ? parseInt(recording.duration, 10) : call.duration
                  })
                  .where(eq(calls.id, call.id));
                
                successCount++;
              } else {
                console.log(`⚠️  [Twilio] No recording found for call ${call.id}`);
                failCount++;
                errors.push(`[Twilio] No recording for call ${call.id}`);
              }
            } catch (error: any) {
              console.error(`❌ [Twilio] Error for call ${call.id}:`, error.message);
              failCount++;
              errors.push(`[Twilio] Call ${call.id}: ${error.message}`);
            }
          }
        } catch (twilioError: any) {
          console.error(`❌ [Twilio] Failed to get client:`, twilioError.message);
          errors.push(`[Twilio] Client error: ${twilioError.message}`);
        }
      }
      
      // Sync ElevenLabs recordings
      if (elevenLabsCalls.length > 0) {
        for (const call of elevenLabsCalls) {
          try {
            console.log(`🔍 [ElevenLabs] Fetching conversation details for call ${call.id} (Conversation: ${call.elevenLabsConversationId})`);
            
            let elService = elevenLabsService;
            
            if (call.incomingConnectionId) {
              const [connection] = await db
                .select({
                  agentCredentialId: agents.elevenLabsCredentialId
                })
                .from(incomingConnections)
                .leftJoin(agents, eq(incomingConnections.agentId, agents.id))
                .where(eq(incomingConnections.id, call.incomingConnectionId))
                .limit(1);
              
              if (connection?.agentCredentialId) {
                const credential = await ElevenLabsPoolService.getCredentialById(connection.agentCredentialId);
                if (credential) {
                  elService = new ElevenLabsService(credential.apiKey);
                }
              }
            }
            
            const conversationDetails = await elService.getConversationDetails(call.elevenLabsConversationId!);
            
            if (conversationDetails) {
              const updates: any = {};
              
              if (conversationDetails.transcript && !call.transcript) {
                updates.transcript = conversationDetails.transcript;
                console.log(`✅ [ElevenLabs] Found transcript`);
              }
              
              if (conversationDetails.metadata?.call_duration_secs && !call.duration) {
                updates.duration = Math.ceil(conversationDetails.metadata.call_duration_secs);
              }
              
              if (conversationDetails.analysis && !call.aiSummary) {
                updates.aiSummary = typeof conversationDetails.analysis === 'string' 
                  ? conversationDetails.analysis 
                  : JSON.stringify(conversationDetails.analysis);
              }
              
              if (call.status === 'initiated') {
                updates.status = conversationDetails.status === 'done' ? 'completed' : 'ended';
              }
              
              if (Object.keys(updates).length > 0) {
                await db
                  .update(calls)
                  .set(updates)
                  .where(eq(calls.id, call.id));
                
                successCount++;
                console.log(`✅ [ElevenLabs] Updated call ${call.id} with ${Object.keys(updates).length} field(s)`);
              } else {
                console.log(`⚠️  [ElevenLabs] No new data found for call ${call.id}`);
                failCount++;
              }
            } else {
              console.log(`⚠️  [ElevenLabs] No conversation details for call ${call.id}`);
              failCount++;
              errors.push(`[ElevenLabs] No data for call ${call.id}`);
            }
          } catch (error: any) {
            console.error(`❌ [ElevenLabs] Error for call ${call.id}:`, error.message);
            failCount++;
            errors.push(`[ElevenLabs] Call ${call.id}: ${error.message}`);
          }
        }
      }
      
      const summary = {
        total: twilioCalls.length + elevenLabsCalls.length,
        twilioCalls: twilioCalls.length,
        elevenLabsCalls: elevenLabsCalls.length,
        success: successCount,
        failed: failCount,
        errors: errors.length > 0 ? errors : undefined
      };
      
      console.log(`✅ [User ${req.userId}] Recording sync complete:`, summary);
      
      res.json(summary);
    } catch (error: any) {
      console.error('❌ [User] Error syncing recordings:', error);
      res.status(500).json({ error: error.message || 'Failed to sync recordings' });
    }
  });

  // ElevenLabs conversation fetch
  router.post("/api/calls/:callId/fetch-conversation", authenticateToken, fetchElevenLabsConversation);

  // Dashboard Data
  router.get("/api/dashboard", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const dashboardData = await storage.getDashboardData(req.userId!);
      res.json(dashboardData);
    } catch (error: any) {
      console.error("Get dashboard data error:", error);
      res.status(500).json({ error: error.message || "Failed to get dashboard data" });
    }
  });
  
  router.post("/api/calls/batch-analyze", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;

      const unanalyzedEL = await db.select({
        id: calls.id,
        transcript: calls.transcript,
        phoneNumber: calls.phoneNumber,
        fromNumber: calls.fromNumber,
        toNumber: calls.toNumber,
        duration: calls.duration,
      })
        .from(calls)
        .where(and(
          eq(calls.userId, userId),
          isNull(calls.classification),
          isNotNull(calls.transcript)
        ))
        .limit(100);

      const unanalyzedTwilio = await db.select({
        id: twilioOpenaiCalls.id,
        transcript: twilioOpenaiCalls.transcript,
        fromNumber: twilioOpenaiCalls.fromNumber,
        toNumber: twilioOpenaiCalls.toNumber,
        duration: twilioOpenaiCalls.duration,
        agentId: twilioOpenaiCalls.agentId,
      })
        .from(twilioOpenaiCalls)
        .where(and(
          eq(twilioOpenaiCalls.userId, userId),
          isNull(twilioOpenaiCalls.classification),
          isNotNull(twilioOpenaiCalls.transcript)
        ))
        .limit(100);

      const allUnanalyzed = [
        ...unanalyzedEL.map(c => ({ ...c, agentId: null as string | null, table: 'calls' as const })),
        ...unanalyzedTwilio.map(c => ({ ...c, phoneNumber: c.fromNumber, table: 'twilio' as const })),
      ];

      if (allUnanalyzed.length === 0) {
        return res.json({ analyzed: 0, total: 0, message: 'All calls already analyzed' });
      }

      let analyzed = 0;
      let failed = 0;
      const results: Array<{ callId: string; classification: string; sentiment: string }> = [];

      for (const call of allUnanalyzed) {
        if (!call.transcript || call.transcript.trim().length < 20) continue;

        try {
          let agentName: string | undefined;
          if (call.agentId) {
            const [agent] = await db.select({ name: agents.name }).from(agents).where(eq(agents.id, call.agentId)).limit(1);
            agentName = agent?.name;
          }

          const insights = await CallInsightsService.analyzeTranscript(
            call.transcript,
            {
              callId: call.id,
              fromNumber: call.fromNumber || undefined,
              toNumber: call.toNumber || undefined,
              agentName,
              duration: call.duration || undefined,
            }
          );

          if (insights) {
            if (call.table === 'calls') {
              await db.update(calls).set({
                classification: insights.classification,
                sentiment: insights.sentiment,
                aiSummary: insights.aiSummary,
              }).where(eq(calls.id, call.id));
            } else {
              await db.update(twilioOpenaiCalls).set({
                classification: insights.classification,
                sentiment: insights.sentiment,
                aiSummary: insights.aiSummary,
              }).where(eq(twilioOpenaiCalls.id, call.id));
            }
            analyzed++;
            results.push({ callId: call.id, classification: insights.classification, sentiment: insights.sentiment });
          } else {
            failed++;
          }
        } catch (err: any) {
          console.error(`[BatchAnalyze] Failed for call ${call.id}:`, err.message);
          failed++;
        }
      }

      res.json({ analyzed, failed, total: allUnanalyzed.length, results });
    } catch (error: any) {
      console.error("[BatchAnalyze] Error:", error);
      res.status(500).json({ error: error.message || "Batch analysis failed" });
    }
  });

  // Analytics
  router.get("/api/analytics", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const timeRange = req.query.timeRange as string || '7days';
      const callType = req.query.callType as string || 'all';
      const analytics = await storage.getUserAnalytics(req.userId!, timeRange, callType);
      res.json(analytics);
    } catch (error: any) {
      console.error("Get analytics error:", error);
      res.status(500).json({ error: error.message || "Failed to get analytics" });
    }
  });

  // Advanced Analytics (BI-grade)
  router.get("/api/analytics/advanced", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const timeRange = req.query.timeRange as string || '7days';
      const { calculateAdvancedAnalytics } = await import("../storage/advanced-analytics");
      const result = await calculateAdvancedAnalytics(req.userId!, timeRange);
      res.json(result);
    } catch (error: any) {
      console.error("Get advanced analytics error:", error);
      res.status(500).json({ error: error.message || "Failed to get advanced analytics" });
    }
  });

  // Analytics PDF Export - Professional Design
  router.post("/api/analytics/export-pdf", authenticateHybrid, async (req: AuthRequest, res: Response) => {
    try {
      const { timeRange = '7days', callType = 'all' } = req.body;
      
      const validTimeRanges = ['7days', '30days', '90days', 'year'];
      const validCallTypes = ['all', 'incoming', 'outgoing', 'batch'];
      
      if (!validTimeRanges.includes(timeRange)) {
        return res.status(400).json({ error: 'Invalid time range' });
      }
      if (!validCallTypes.includes(callType)) {
        return res.status(400).json({ error: 'Invalid call type' });
      }
      
      const rawAnalytics = await storage.getUserAnalytics(req.userId!, timeRange, callType);
      
      const appNameSetting = await storage.getGlobalSetting('app_name');
      const appName = typeof appNameSetting?.value === 'string' ? appNameSetting.value : '';
      
      const analytics = {
        totalCalls: rawAnalytics?.totalCalls ?? 0,
        successRate: rawAnalytics?.successRate ?? 0,
        qualifiedLeads: rawAnalytics?.qualifiedLeads ?? 0,
        avgDuration: rawAnalytics?.avgDuration ?? 0,
        leadDistribution: rawAnalytics?.leadDistribution ?? [],
        sentimentDistribution: rawAnalytics?.sentimentDistribution ?? [],
        campaignPerformance: rawAnalytics?.campaignPerformance ?? [],
        dailyCalls: rawAnalytics?.dailyCalls ?? [],
        typeBreakdown: {
          incoming: rawAnalytics?.typeBreakdown?.incoming ?? 0,
          outgoing: rawAnalytics?.typeBreakdown?.outgoing ?? 0,
          batch: rawAnalytics?.typeBreakdown?.batch ?? 0,
          total: rawAnalytics?.typeBreakdown?.total ?? 0
        }
      };
      
      const user = await storage.getUser(req.userId!);
      
      const doc = new PDFDocument({ 
        margin: 40, 
        size: 'A4',
        bufferPages: true 
      });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="analytics-report-${new Date().toISOString().split('T')[0]}.pdf"`);
      
      doc.pipe(res);
      
      const colors = {
        primary: '#2563eb',
        primaryLight: '#dbeafe',
        success: '#16a34a',
        successLight: '#dcfce7',
        warning: '#ca8a04',
        warningLight: '#fef9c3',
        purple: '#7c3aed',
        purpleLight: '#ede9fe',
        text: '#1e293b',
        textMuted: '#64748b',
        border: '#e2e8f0',
        background: '#f8fafc'
      };
      
      const pageWidth = 515;
      const leftMargin = 40;
      
      // Header
      doc.save()
        .rect(0, 0, 595, 120)
        .fill(colors.primary);
      
      doc.fillColor('#ffffff')
        .fontSize(28)
        .font('Helvetica-Bold')
        .text('Analytics Report', leftMargin, 35, { width: pageWidth });
      
      const timeRangeLabels: Record<string, string> = {
        '7days': 'Last 7 Days',
        '30days': 'Last 30 Days',
        '90days': 'Last 90 Days',
        'year': 'This Year'
      };
      const callTypeLabels: Record<string, string> = {
        'all': 'All Calls',
        'incoming': 'Incoming Calls',
        'outgoing': 'Outgoing Calls',
        'batch': 'Batch Calls'
      };
      
      doc.fillColor('#ffffff')
        .fontSize(11)
        .font('Helvetica')
        .text(`${timeRangeLabels[timeRange] || timeRange} | ${callTypeLabels[callType] || callType}`, leftMargin, 72);
      
      doc.fillColor('rgba(255,255,255,0.8)')
        .fontSize(9)
        .text(`Generated: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}${user ? ` | ${user.email}` : ''}`, leftMargin, 90);
      
      doc.restore();
      doc.y = 140;
      
      // Key Metrics
      const metrics = [
        { label: 'Total Calls', value: analytics.totalCalls.toLocaleString(), color: colors.primary, bgColor: colors.primaryLight, icon: 'phone' },
        { label: 'Success Rate', value: `${analytics.successRate}%`, color: colors.success, bgColor: colors.successLight, icon: 'check' },
        { label: 'Qualified Leads', value: analytics.qualifiedLeads.toLocaleString(), color: colors.warning, bgColor: colors.warningLight, icon: 'users' },
        { label: 'Avg Duration', value: formatDurationPDF(analytics.avgDuration), color: colors.purple, bgColor: colors.purpleLight, icon: 'clock' }
      ];
      
      const cardWidth = (pageWidth - 30) / 4;
      const cardHeight = 70;
      const startY = doc.y;
      
      metrics.forEach((metric, index) => {
        const x = leftMargin + (index * (cardWidth + 10));
        
        doc.save()
          .roundedRect(x, startY, cardWidth, cardHeight, 8)
          .fill(metric.bgColor);
        
        doc.roundedRect(x, startY, 4, cardHeight, 2)
          .fill(metric.color);
        
        doc.restore();
        
        doc.fillColor(metric.color)
          .fontSize(22)
          .font('Helvetica-Bold')
          .text(metric.value, x + 12, startY + 15, { width: cardWidth - 20 });
        
        doc.fillColor(colors.textMuted)
          .fontSize(9)
          .font('Helvetica')
          .text(metric.label.toUpperCase(), x + 12, startY + 48, { width: cardWidth - 20 });
      });
      
      doc.y = startY + cardHeight + 25;
      
      // Call Type Breakdown
      if (callType === 'all' && analytics.typeBreakdown.total > 0) {
        const sectionY = doc.y;
        
        doc.fillColor(colors.text)
          .fontSize(14)
          .font('Helvetica-Bold')
          .text('Call Type Distribution', leftMargin, sectionY);
        
        doc.y = sectionY + 25;
        
        const breakdownData = [
          { label: 'Incoming', value: analytics.typeBreakdown.incoming, color: colors.success },
          { label: 'Outgoing', value: analytics.typeBreakdown.outgoing, color: colors.primary },
          { label: 'Batch', value: analytics.typeBreakdown.batch, color: colors.purple }
        ];
        
        const total = analytics.typeBreakdown.total;
        const barWidth = pageWidth - 150;
        const barHeight = 24;
        const barY = doc.y;
        
        breakdownData.forEach((item, index) => {
          const y = barY + (index * 35);
          const percentage = total > 0 ? (item.value / total) * 100 : 0;
          const fillWidth = (percentage / 100) * barWidth;
          
          doc.fillColor(colors.text)
            .fontSize(11)
            .font('Helvetica')
            .text(item.label, leftMargin, y + 5, { width: 80 });
          
          doc.save()
            .roundedRect(leftMargin + 85, y, barWidth, barHeight, 4)
            .fill(colors.border);
          
          if (fillWidth > 0) {
            doc.roundedRect(leftMargin + 85, y, Math.max(fillWidth, 8), barHeight, 4)
              .fill(item.color);
          }
          
          doc.restore();
          
          doc.fillColor(fillWidth > 50 ? '#ffffff' : colors.text)
            .fontSize(10)
            .font('Helvetica-Bold')
            .text(`${item.value} (${percentage.toFixed(0)}%)`, leftMargin + 95, y + 6);
        });
        
        doc.y = barY + (breakdownData.length * 35) + 20;
      }
      
      // Lead Distribution
      if (analytics.leadDistribution.length > 0) {
        const sectionY = doc.y;
        
        doc.fillColor(colors.text)
          .fontSize(14)
          .font('Helvetica-Bold')
          .text('Lead Classification', leftMargin, sectionY);
        
        doc.y = sectionY + 25;
        
        const totalLeads = analytics.leadDistribution.reduce((sum: number, item: any) => sum + item.value, 0);
        const barWidth = pageWidth - 150;
        const leadY = doc.y;
        
        analytics.leadDistribution.forEach((item: { name: string; value: number }, index: number) => {
          const y = leadY + (index * 32);
          const percentage = totalLeads > 0 ? (item.value / totalLeads) * 100 : 0;
          const fillWidth = (percentage / 100) * barWidth;
          
          const barColor = item.name.toLowerCase().includes('qualified') ? colors.success :
                          item.name.toLowerCase().includes('hot') ? '#ef4444' :
                          item.name.toLowerCase().includes('warm') ? colors.warning :
                          colors.primary;
          
          doc.fillColor(colors.text)
            .fontSize(10)
            .font('Helvetica')
            .text(item.name, leftMargin, y + 4, { width: 80 });
          
          doc.save()
            .roundedRect(leftMargin + 85, y, barWidth, 20, 3)
            .fill(colors.border);
          
          if (fillWidth > 0) {
            doc.roundedRect(leftMargin + 85, y, Math.max(fillWidth, 6), 20, 3)
              .fill(barColor);
          }
          
          doc.restore();
          
          doc.fillColor(fillWidth > 40 ? '#ffffff' : colors.text)
            .fontSize(9)
            .font('Helvetica-Bold')
            .text(`${item.value}`, leftMargin + 92, y + 5);
        });
        
        doc.y = leadY + (analytics.leadDistribution.length * 32) + 20;
      }
      
      // Call Volume Chart
      if (analytics.dailyCalls.length > 0) {
        if (doc.y > 600) {
          doc.addPage();
          doc.y = 50;
        }
        
        const chartTitle = timeRange === 'year' ? 'Monthly Call Volume' :
                          (timeRange === '30days' || timeRange === '90days') ? 'Weekly Call Volume' :
                          'Daily Call Volume';
        
        const sectionY = doc.y;
        
        doc.fillColor(colors.text)
          .fontSize(14)
          .font('Helvetica-Bold')
          .text(chartTitle, leftMargin, sectionY);
        
        doc.y = sectionY + 25;
        
        const chartHeight = 120;
        const chartWidth = pageWidth;
        const chartY = doc.y;
        const maxCount = Math.max(...analytics.dailyCalls.map((d: any) => d.count), 1);
        const barGap = 4;
        const barMaxWidth = (chartWidth / analytics.dailyCalls.length) - barGap;
        const barActualWidth = Math.min(barMaxWidth, 40);
        
        for (let i = 0; i <= 4; i++) {
          const lineY = chartY + (chartHeight * (1 - i/4));
          doc.save()
            .moveTo(leftMargin, lineY)
            .lineTo(leftMargin + chartWidth, lineY)
            .strokeColor(colors.border)
            .lineWidth(0.5)
            .stroke()
            .restore();
          
          const labelValue = Math.round((maxCount * i) / 4);
          doc.fillColor(colors.textMuted)
            .fontSize(8)
            .text(labelValue.toString(), leftMargin - 25, lineY - 4, { width: 20, align: 'right' });
        }
        
        analytics.dailyCalls.forEach((item: { date: string; count: number }, index: number) => {
          const barHeight = (item.count / maxCount) * chartHeight;
          const x = leftMargin + (index * (chartWidth / analytics.dailyCalls.length)) + (barMaxWidth - barActualWidth) / 2;
          const y = chartY + chartHeight - barHeight;
          
          doc.save()
            .roundedRect(x, y, barActualWidth, barHeight, 3)
            .fill(colors.primary);
          doc.restore();
          
          if (analytics.dailyCalls.length <= 14 || index % Math.ceil(analytics.dailyCalls.length / 10) === 0) {
            const dateObj = new Date(item.date);
            const dateStr = timeRange === 'year' 
              ? dateObj.toLocaleDateString('en-US', { month: 'short' })
              : dateObj.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
            
            doc.fillColor(colors.textMuted)
              .fontSize(7)
              .text(dateStr, x - 5, chartY + chartHeight + 5, { width: barActualWidth + 10, align: 'center' });
          }
        });
        
        doc.y = chartY + chartHeight + 30;
      }
      
      // Campaign Performance Table
      if (analytics.campaignPerformance.length > 0) {
        if (doc.y > 650) {
          doc.addPage();
          doc.y = 50;
        }
        
        const sectionY = doc.y;
        
        doc.fillColor(colors.text)
          .fontSize(14)
          .font('Helvetica-Bold')
          .text('Campaign Performance', leftMargin, sectionY);
        
        doc.y = sectionY + 25;
        
        const tableY = doc.y;
        const col1Width = 300;
        const col2Width = pageWidth - col1Width;
        
        doc.save()
          .rect(leftMargin, tableY, pageWidth, 25)
          .fill(colors.background);
        doc.restore();
        
        doc.fillColor(colors.textMuted)
          .fontSize(9)
          .font('Helvetica-Bold')
          .text('CAMPAIGN', leftMargin + 10, tableY + 8)
          .text('SUCCESS RATE', leftMargin + col1Width + 10, tableY + 8);
        
        analytics.campaignPerformance.forEach((item: { name: string; value: number }, index: number) => {
          const rowY = tableY + 25 + (index * 30);
          
          if (index % 2 === 0) {
            doc.save()
              .rect(leftMargin, rowY, pageWidth, 30)
              .fill('#ffffff');
            doc.restore();
          }
          
          doc.save()
            .moveTo(leftMargin, rowY + 30)
            .lineTo(leftMargin + pageWidth, rowY + 30)
            .strokeColor(colors.border)
            .lineWidth(0.5)
            .stroke()
            .restore();
          
          doc.fillColor(colors.text)
            .fontSize(10)
            .font('Helvetica')
            .text(item.name, leftMargin + 10, rowY + 9, { width: col1Width - 20 });
          
          const badgeColor = item.value >= 70 ? colors.success : 
                            item.value >= 40 ? colors.warning : '#ef4444';
          
          doc.save()
            .roundedRect(leftMargin + col1Width + 10, rowY + 5, 60, 20, 10)
            .fill(badgeColor);
          doc.restore();
          
          doc.fillColor('#ffffff')
            .fontSize(10)
            .font('Helvetica-Bold')
            .text(`${item.value}%`, leftMargin + col1Width + 15, rowY + 9, { width: 50, align: 'center' });
        });
        
        doc.y = tableY + 25 + (analytics.campaignPerformance.length * 30) + 20;
      }
      
      // Footer
      const footerY = 800;
      doc.save()
        .rect(0, footerY, 595, 42)
        .fill(colors.background);
      doc.restore();
      
      doc.fillColor(colors.textMuted)
        .fontSize(8)
        .font('Helvetica')
        .text(`${appName} Analytics Report`, leftMargin, footerY + 15, { width: pageWidth / 2 });
      
      doc.text(`Page 1 of 1`, leftMargin + pageWidth - 80, footerY + 15, { width: 80, align: 'right' });
      
      doc.end();
      
    } catch (error: any) {
      console.error("Export analytics PDF error:", error);
      res.status(500).json({ error: error.message || "Failed to export analytics PDF" });
    }
  });

  return router;
}
