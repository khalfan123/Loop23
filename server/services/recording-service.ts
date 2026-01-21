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
import { db } from "../db";
import { agents, campaigns, incomingConnections } from "@shared/schema";
import type { Call, ElevenLabsCredential } from "@shared/schema";
import { eq } from "drizzle-orm";
import { widgetStorage } from "../modules/widget/widget-storage";
import { ElevenLabsService, elevenLabsService } from "./elevenlabs";
import { ElevenLabsPoolService } from "./elevenlabs-pool";
import { getTwilioClient } from "./twilio-connector";
import { storage } from "../storage";

/**
 * Result of a recording fetch operation
 */
export interface RecordingResult {
  audioBuffer: Buffer;
  contentType: string;
  source: 'elevenlabs' | 'twilio';
}

/**
 * Error result when recording is not available
 */
export interface RecordingError {
  error: string;
  details?: string;
}

/**
 * RecordingService handles fetching call recordings from ElevenLabs and Twilio.
 * 
 * This service implements a dual-source recording strategy:
 * 1. ElevenLabs first (if conversation ID exists) - URLs are time-limited, so always fetch fresh
 * 2. Twilio fallback - stable URLs, used when ElevenLabs fails or has no audio
 * 
 * The service also handles credential resolution for the multi-key ElevenLabs pool,
 * ensuring recordings are fetched using the correct API key for each call.
 */
export class RecordingService {
  /**
   * Get recording audio for a call using the dual-source strategy.
   * Tries ElevenLabs first (if available), then falls back to Twilio.
   * 
   * @param call - The call record to fetch recording for
   * @returns RecordingResult with audio buffer and metadata, or RecordingError if not available
   * 
   * @example
   * ```typescript
   * const result = await recordingService.getRecordingAudio(call);
   * if ('audioBuffer' in result) {
   *   res.setHeader('Content-Type', result.contentType);
   *   res.send(result.audioBuffer);
   * } else {
   *   res.status(404).json(result);
   * }
   * ```
   */
  async getRecordingAudio(call: Call): Promise<RecordingResult | RecordingError> {
    // Check for ElevenLabs conversation ID in the dedicated field or in metadata (for widget calls)
    const elevenLabsConvId = call.elevenLabsConversationId || 
      (call.metadata as any)?.conversationId;
    
    // Check if this is an OpenAI widget call (no recording available)
    const engine = (call.metadata as any)?.engine;
    if (engine === 'openai' && (call.metadata as any)?.source === 'widget') {
      return {
        error: "Recording not available for OpenAI widget calls",
        details: "OpenAI Realtime API does not provide post-call recordings"
      };
    }
    
    if (elevenLabsConvId) {
      console.log(`🎙️ [Recording] Fetching ElevenLabs recording for call ${call.id} (conversation: ${elevenLabsConvId})`);
      
      const elevenLabsResult = await this.fetchElevenLabsRecording(
        elevenLabsConvId,
        call
      );
      
      if (elevenLabsResult) {
        return elevenLabsResult;
      }
      
      console.log(`📞 [Recording] Trying Twilio fallback...`);
      
      if (call.twilioSid) {
        const twilioResult = await this.fetchTwilioRecordingBySid(call.twilioSid);
        if (twilioResult) {
          return twilioResult;
        }
      } else {
        console.log(`⚠️ [Recording] No Twilio SID stored for fallback`);
      }
      
      return {
        error: "Recording not available. The call may still be processing or no recording was captured.",
        details: "Neither ElevenLabs nor Twilio have a recording available"
      };
    }
    
    if (call.recordingUrl) {
      const twilioResult = await this.fetchTwilioRecordingByUrl(call.recordingUrl);
      if (twilioResult) {
        return twilioResult;
      }
      return {
        error: "Failed to fetch recording from Twilio",
        details: "Recording URL exists but fetch failed"
      };
    }
    
    return {
      error: "No recording available for this call"
    };
  }

  /**
   * Fetch recording audio from ElevenLabs Conversational AI.
   * Resolves the correct API credential based on the call's associated agent.
   * 
   * @param conversationId - The ElevenLabs conversation ID
   * @param call - The call record (used to resolve credentials)
   * @returns RecordingResult if successful, null if recording not available
   * 
   * @remarks
   * ElevenLabs recording URLs are time-limited, so this method always fetches
   * fresh rather than using cached URLs. The audio is returned as a buffer
   * to be streamed directly to the client.
   */
  async fetchElevenLabsRecording(
    conversationId: string,
    call: Call
  ): Promise<RecordingResult | null> {
    try {
      const credential = await this.resolveCredentialForCall(call);
      const service = credential 
        ? new ElevenLabsService(credential.apiKey) 
        : elevenLabsService;
      
      if (credential) {
        console.log(`🎙️ [Recording] Using credential: ${credential.name}`);
      }
      
      const audioResult = await service.getConversationAudio(conversationId);
      
      if (audioResult.audioBuffer) {
        return {
          audioBuffer: audioResult.audioBuffer,
          contentType: audioResult.contentType,
          source: 'elevenlabs'
        };
      }
      
      console.log(`⚠️ [Recording] No audio from ElevenLabs for call ${call.id}: ${audioResult.error}`);
      return null;
    } catch (error: any) {
      console.error(`❌ [Recording] ElevenLabs recording fetch error:`, error.message);
      throw error;
    }
  }

  /**
   * Fetch recording audio from Twilio using the call SID.
   * Lists recordings for the call and fetches the audio content.
   * 
   * @param twilioSid - The Twilio call SID
   * @returns RecordingResult if successful, null if no recording found
   * 
   * @remarks
   * This method queries Twilio for recordings associated with the call SID,
   * which is more reliable than using stored recording URLs that may become stale.
   */
  async fetchTwilioRecordingBySid(twilioSid: string): Promise<RecordingResult | null> {
    try {
      const twilioClient = await getTwilioClient();
      
      console.log(`   Fetching recordings for Twilio call SID: ${twilioSid}`);
      const recordings = await twilioClient.recordings.list({
        callSid: twilioSid,
        limit: 1
      });
      
      if (recordings.length === 0) {
        console.log(`⚠️ [Recording] No Twilio recordings found for call`);
        return null;
      }
      
      const recording = recordings[0];
      console.log(`✅ [Recording] Found Twilio recording: ${recording.sid}`);
      const mediaUrl = `https://api.twilio.com${recording.uri.replace('.json', '.mp3')}`;
      
      const response = await fetch(mediaUrl, {
        headers: {
          'Authorization': 'Basic ' + Buffer.from(
            `${twilioClient.username}:${twilioClient.password}`
          ).toString('base64')
        }
      });
      
      if (!response.ok) {
        console.log(`⚠️ [Recording] Twilio fetch failed: ${response.status}`);
        return null;
      }
      
      const buffer = await response.arrayBuffer();
      return {
        audioBuffer: Buffer.from(buffer),
        contentType: 'audio/mpeg',
        source: 'twilio'
      };
    } catch (error: any) {
      console.warn(`⚠️ [Recording] Twilio fallback failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Fetch recording audio from Twilio using a recording URL.
   * Extracts the recording SID from the URL and fetches the audio content.
   * 
   * @param recordingUrl - The Twilio recording URL
   * @returns RecordingResult if successful, null if fetch failed
   * 
   * @remarks
   * Twilio recording URLs follow the format:
   * https://api.twilio.com/.../.../Recordings/{RecordingSid}
   * This method extracts the SID and fetches the audio using the Twilio SDK.
   */
  async fetchTwilioRecordingByUrl(recordingUrl: string): Promise<RecordingResult | null> {
    try {
      const twilioClient = await getTwilioClient();
      
      const urlWithoutQuery = recordingUrl.split('?')[0];
      const recordingSid = urlWithoutQuery.split('/').pop()?.split('.')[0];
      
      if (!recordingSid) {
        console.error(`❌ [Recording] Invalid recording URL: ${recordingUrl}`);
        return null;
      }
      
      const recording = await twilioClient.recordings(recordingSid).fetch();
      const mediaUrl = `https://api.twilio.com${recording.uri.replace('.json', '.mp3')}`;
      
      const response = await fetch(mediaUrl, {
        headers: {
          'Authorization': 'Basic ' + Buffer.from(
            `${twilioClient.username}:${twilioClient.password}`
          ).toString('base64')
        }
      });
      
      if (!response.ok) {
        console.error(`❌ [Recording] Failed to fetch recording: ${response.statusText}`);
        return null;
      }
      
      const buffer = await response.arrayBuffer();
      return {
        audioBuffer: Buffer.from(buffer),
        contentType: 'audio/mpeg',
        source: 'twilio'
      };
    } catch (error: any) {
      console.error(`❌ [Recording] Twilio recording fetch error:`, error.message);
      return null;
    }
  }

  /**
   * Resolve the ElevenLabs credential for a call based on its associated agent.
   * 
   * Credential resolution order:
   * 1. If call has campaignId → get campaign's agent → use agent's credential
   * 2. If call has incomingConnectionId → get connection's agent → use agent's credential
   * 3. Fall back to default (null) if no credential found
   * 
   * @param call - The call record to resolve credentials for
   * @returns The ElevenLabsCredential if found, null otherwise
   * 
   * @remarks
   * This method is essential for the multi-key pool system. Each agent is assigned
   * to a specific ElevenLabs API key, and recordings must be fetched using that
   * same key to ensure proper authentication.
   */
  async resolveCredentialForCall(call: Call): Promise<ElevenLabsCredential | null> {
    if (call.campaignId) {
      const campaign = await storage.getCampaignIncludingDeleted(call.campaignId);
      if (campaign?.agentId) {
        const [agent] = await db
          .select()
          .from(agents)
          .where(eq(agents.id, campaign.agentId))
          .limit(1);
        
        if (agent?.elevenLabsCredentialId) {
          const credential = await ElevenLabsPoolService.getCredentialById(agent.elevenLabsCredentialId);
          if (credential) {
            return credential;
          }
        }
      }
    }
    
    if (call.incomingConnectionId) {
      const [connection] = await db
        .select()
        .from(incomingConnections)
        .where(eq(incomingConnections.id, call.incomingConnectionId))
        .limit(1);
      
      if (connection?.agentId) {
        const [agent] = await db
          .select()
          .from(agents)
          .where(eq(agents.id, connection.agentId))
          .limit(1);
        
        if (agent?.elevenLabsCredentialId) {
          const credential = await ElevenLabsPoolService.getCredentialById(agent.elevenLabsCredentialId);
          if (credential) {
            console.log(`🎙️ [Recording] Using credential from incoming agent: ${agent.name}`);
            return credential;
          }
        }
      }
    }
    
    // Handle widget calls - check widgetId in call record or metadata
    const widgetId = call.widgetId || (call.metadata as any)?.widgetId;
    if (widgetId) {
      try {
        const widget = await widgetStorage.getWidgetById(widgetId);
        if (widget?.agentId) {
          const [agent] = await db
            .select()
            .from(agents)
            .where(eq(agents.id, widget.agentId))
            .limit(1);
          
          if (agent?.elevenLabsCredentialId) {
            const credential = await ElevenLabsPoolService.getCredentialById(agent.elevenLabsCredentialId);
            if (credential) {
              console.log(`🎙️ [Recording] Using credential from widget agent: ${agent.name}`);
              return credential;
            }
          }
        }
      } catch (error) {
        console.error(`🎙️ [Recording] Error resolving widget credential:`, error);
      }
    }
    
    // Check agentId directly from metadata (for widget calls that store it)
    const agentId = (call.metadata as any)?.agentId;
    if (agentId) {
      try {
        const [agent] = await db
          .select()
          .from(agents)
          .where(eq(agents.id, agentId))
          .limit(1);
        
        if (agent?.elevenLabsCredentialId) {
          const credential = await ElevenLabsPoolService.getCredentialById(agent.elevenLabsCredentialId);
          if (credential) {
            console.log(`🎙️ [Recording] Using credential from metadata agentId: ${agent.name}`);
            return credential;
          }
        }
      } catch (error) {
        console.error(`🎙️ [Recording] Error resolving agent credential from metadata:`, error);
      }
    }
    
    return null;
  }
}

export const recordingService = new RecordingService();
