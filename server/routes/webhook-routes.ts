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
import { Request, Response } from 'express';
import { db } from '../db';
import { calls, campaigns, users, creditTransactions, contacts, globalSettings, phoneNumbers, incomingAgents, incomingConnections, agents, knowledgeBase, appointments, appointmentSettings, flows, sipCalls, elevenLabsCredentials, ivrConfigurations, departments, departmentAgents } from '../../shared/schema';
import { nanoid } from 'nanoid';
import { eq, and, inArray, sql } from 'drizzle-orm';
import WebSocket from 'ws';
import { getTwilioClient } from '../services/twilio-connector';
import { twilioService } from '../services/twilio';
import { getDomain } from '../utils/domain';
import { elevenLabsService, ElevenLabsService } from '../services/elevenlabs';
import { ElevenLabsPoolService } from '../services/elevenlabs-pool';
import twilio from 'twilio';
import crypto from 'crypto';
import { storage } from '../storage';
import { webhookDeliveryService } from '../services/webhook-delivery';
import { recordWebhookReceived } from '../engines/payment/webhook-helper';
import { CreditDeductionResult } from '../services/credit-service';
import { 
  sendWebSocketWithRetry,
  classifyLeadFromTranscript,
  formatAndSaveTranscript,
  updateCampaignStats,
  fireWebhook,
  deductCallCreditsForElevenLabs 
} from './webhooks/helpers';

const activeConnections = new Map<string, WebSocket>();

// Helper function to end Twilio call
async function endTwilioCall(twilioCallSid: string | null, reason: string): Promise<void> {
  try {
    if (!twilioCallSid) {
      console.error(`❌ [Call End Failed] No Twilio CallSid available`);
      return;
    }
    
    console.log(`📞 [Ending Call] Reason: ${reason}`);
    console.log(`   CallSid: ${twilioCallSid}`);
    
    const twilioClient = await getTwilioClient();
    await twilioClient.calls(twilioCallSid).update({ status: 'completed' });
    
    console.log(`✅ [Call Ended Successfully] CallSid: ${twilioCallSid}`);
  } catch (error) {
    console.error(`❌ [Call End Error]`, error);
  }
}

// Helper function to execute call transfer via Twilio REST API
async function executeCallTransfer(twilioCallSid: string, transferPhoneNumber: string): Promise<void> {
  try {
    console.log(`📞 [Twilio Transfer] Initiating transfer for CallSid: ${twilioCallSid}`);
    console.log(`   Transfer to: ${transferPhoneNumber}`);
    
    const twilioClient = await getTwilioClient();
    
    // Get the original call to retrieve the caller's number
    const call = await twilioClient.calls(twilioCallSid).fetch();
    const fromNumber = call.from; // The original caller's number (shows on transfer recipient's phone)
    
    // Create TwiML to transfer the call
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Please hold while I transfer your call.</Say>
  <Dial callerId="${fromNumber}">
    <Number>${transferPhoneNumber}</Number>
  </Dial>
</Response>`;
    
    console.log(`📋 [Twilio Transfer] TwiML:`, twiml);
    
    // Update the active call with the transfer TwiML
    await twilioClient.calls(twilioCallSid).update({
      twiml: twiml
    });
    
    console.log(`✅ [Twilio Transfer] Call transfer initiated successfully`);
    console.log(`   The caller will now be connected to ${transferPhoneNumber}`);
  } catch (error: any) {
    console.error(`❌ [Twilio Transfer] Failed to transfer call:`, error);
    throw new Error(`Twilio transfer failed: ${error.message}`);
  }
}

// Helper function to setup ElevenLabs message handlers
function setupElevenLabsMessageHandlers(
  elevenLabsWs: WebSocket,
  callId: string,
  streamSid: string | null,
  twilioWs: WebSocket,
  conversationHistory: Array<{ role: 'user' | 'agent', text: string, timestamp: Date }>,
  silenceTimerRef: { current: NodeJS.Timeout | null },
  endCall: (reason: string) => Promise<void>,
  flowBridge?: any  // Optional FlowExecutionBridge instance
): void {
  elevenLabsWs.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log(`📨 [ElevenLabs] Received message type: ${message.type}`);
      
      switch (message.type) {
        case 'conversation_initiation_metadata':
          console.log(`✅ [ElevenLabs] Conversation initiated for call ${callId}`);
          break;
          
        case 'audio':
          let audioPayload: string | null = null;
          
          if (message.audio?.chunk) {
            audioPayload = message.audio.chunk;
          } else if (message.audio_event?.audio_base_64) {
            audioPayload = message.audio_event.audio_base_64;
          }
          
          if (audioPayload && streamSid) {
            const audioData = {
              event: 'media',
              streamSid,
              media: {
                payload: audioPayload,
              },
            };
            if (twilioWs.readyState === WebSocket.OPEN) {
              twilioWs.send(JSON.stringify(audioData));
            }
          }
          break;
          
        case 'interruption':
          console.log(`🛑 [ElevenLabs] User interruption detected`);
          if (streamSid && twilioWs.readyState === WebSocket.OPEN) {
            twilioWs.send(JSON.stringify({ event: 'clear', streamSid }));
          }
          break;
          
        case 'user_transcript':
          const userText = message.user_transcription_event?.user_transcript || 'N/A';
          const userTranscriptLength = userText.length;
          const transcriptTime = new Date().toISOString();
          
          // Enhanced logging for transcription quality monitoring
          console.log(`🗣️ [User Said]: "${userText}"`);
          console.log(`   📊 Transcript length: ${userTranscriptLength} chars`);
          console.log(`   ⏱️  Received at: ${transcriptTime}`);
          if (message.user_transcription_event?.confidence) {
            console.log(`   🎯 Confidence: ${message.user_transcription_event.confidence}`);
          }
          
          if (userText && userText !== 'N/A') {
            conversationHistory.push({
              role: 'user',
              text: userText,
              timestamp: new Date()
            });
            
            // Process user response through flow bridge if in flow mode
            if (flowBridge) {
              try {
                // Process response - this auto-progresses through nodes
                await flowBridge.processUserResponse(userText);
                console.log(`[Flow Bridge] ✅ Processed user response`);
                
                // Check if flow has ended (after auto-progression)
                if (flowBridge.hasFlowEnded()) {
                  console.log(`[Flow Bridge] 🎯 Flow execution completed (reached END node)`);
                  
                  // Send final contextual update with END node message
                  try {
                    const finalUpdate = flowBridge.generateContextualUpdate();
                    const finalText = finalUpdate.text || "Thank you for your time. Goodbye!";
                    
                    console.log(`[Flow Bridge] 📤 Sending final contextual update to ElevenLabs:`);
                    console.log(`   Instruction: "${finalText}"`);
                    
                    const success = await sendWebSocketWithRetry(elevenLabsWs, {
                      type: "contextual_update",
                      text: finalText
                    });
                    
                    if (success) {
                      console.log(`[Flow Bridge] ✅ Final contextual update sent`);
                    } else {
                      console.error(`[Flow Bridge] ❌ Failed to send final update after retries - terminating call anyway`);
                    }
                  } catch (sendError) {
                    console.error(`[Flow Bridge] ❌ Failed to send final contextual update:`, sendError);
                  }
                  
                  // Don't update call status here - let it be updated when call actually ends
                  // The Twilio status webhook will update status to 'completed' when call terminates
                  // This ensures DB state matches actual call lifecycle
                  console.log(`[Flow Bridge] ✅ Flow execution completed - final goodbye sent`);
                  console.log(`[Flow Bridge] 📞 Letting call end naturally via silence detection`);
                  console.log(`[Flow Bridge] 💾 Call status will be updated to 'completed' by Twilio webhook when call actually ends`);
                } else {
                  // Send contextual update to ElevenLabs with next node instructions
                  if (flowBridge.shouldSendContextualUpdate()) {
                    try {
                      const contextualUpdate = flowBridge.generateContextualUpdate();
                      const instructionText = contextualUpdate.text || "Continue the conversation.";
                      
                      if (instructionText.trim()) {
                        console.log(`[Flow Bridge] 📤 Sending contextual update to ElevenLabs:`);
                        console.log(`   Instruction: "${instructionText}"`);
                        
                        const success = await sendWebSocketWithRetry(elevenLabsWs, {
                          type: "contextual_update",
                          text: instructionText
                        });
                        
                        if (success) {
                          console.log(`[Flow Bridge] ✅ Contextual update sent`);
                        } else {
                          console.error(`[Flow Bridge] ❌ Failed to send contextual update after retries`);
                        }
                      } else {
                        console.log(`[Flow Bridge] ℹ️ Skipping empty contextual update (likely condition node)`);
                      }
                    } catch (sendError) {
                      console.error(`[Flow Bridge] ❌ Failed to send contextual update:`, sendError);
                    }
                  } else {
                    console.log(`[Flow Bridge] ℹ️ No contextual update needed for current node`);
                  }
                }
              } catch (error) {
                console.error(`[Flow Bridge] ❌ Error processing user response:`, error);
                console.error(error);
                // Don't fail the entire call - log error and continue without flow
              }
            }
            
            // Check for user rejection/disinterest phrases
            const rejectionPhrases = [
              'not interested', 'no thanks', 'stop calling', 
              'remove my number', 'don\'t call', 'bye', 
              'goodbye', 'hang up', 'disconnect', 
              'interested nahi', 'nahi chahiye', 'band karo',
              'rukiye', 'call mat karo', 'बाद में'
            ];
            
            const lowerUserText = userText.toLowerCase();
            const userRejected = rejectionPhrases.some(phrase => lowerUserText.includes(phrase));
            
            if (userRejected) {
              console.log(`🚫 [User Rejected] User expressed disinterest, ending call in 2 seconds...`);
              setTimeout(async () => {
                await endCall('User expressed disinterest');
              }, 2000);
            }
          }
          
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
          }
          
          silenceTimerRef.current = setTimeout(async () => {
            console.log(`🔇 [Silence Detected] No user speech for 30 seconds, ending call...`);
            await endCall('30 seconds of user silence detected');
          }, 30000);
          break;
          
        case 'agent_response':
          const agentText = message.agent_response_event?.agent_response || 'N/A';
          console.log(`🤖 [AI Responded]: "${agentText}"`);
          
          if (agentText && agentText !== 'N/A') {
            conversationHistory.push({
              role: 'agent',
              text: agentText,
              timestamp: new Date()
            });
          }
          
          // Reset silence timer when agent responds (restart 30s countdown from agent's last message)
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
          }
          
          silenceTimerRef.current = setTimeout(async () => {
            console.log(`🔇 [Silence Detected] No activity for 30 seconds after agent response, ending call...`);
            await endCall('30 seconds of silence detected');
          }, 30000);
          
          const goodbyePhrases = [
            'goodbye', 'bye bye', 'thank you for calling', 
            'have a nice day', 'take care', 'alvida', 
            'dhanyawad', 'shukriya', 'aapka din shubh ho'
          ];
          
          const lowerText = agentText.toLowerCase();
          const saidGoodbye = goodbyePhrases.some(phrase => lowerText.includes(phrase));
          
          if (saidGoodbye && !lowerText.includes('?')) {
            console.log(`👋 [Agent Farewell] Agent said goodbye - call will end naturally via silence detection`);
            // Don't force termination - let the call end gracefully after agent finishes speaking
            // The 30-second silence timeout will handle call termination naturally
          }
          break;
        
        case 'ping':
          if (message.ping_event?.event_id && elevenLabsWs) {
            const pongResponse = {
              type: 'pong',
              event_id: message.ping_event.event_id,
            };
            elevenLabsWs.send(JSON.stringify(pongResponse));
          }
          break;
        
        case 'client_tool_call':
          console.log(`🔧 [Client Tool] Tool call received:`, message.client_tool_call);
          const toolCall = message.client_tool_call;
          
          if (toolCall?.tool_name === 'transfer_call') {
            console.log(`📞 [Call Transfer] Agent requested call transfer`);
            console.log(`   Reason: ${toolCall.parameters?.reason || 'Not specified'}`);
            console.log(`   Tool Call ID: ${toolCall.tool_call_id}`);
            
            try {
              // Get call details (works for both incoming and campaign calls)
              const call = await storage.getCallWithDetails(callId);
              if (!call) {
                throw new Error('Call not found');
              }
              
              // Determine agent ID from either incoming connection or campaign
              let agentIdToUse: string;
              
              if (call.incomingConnection?.agentId) {
                // Incoming call - get agent from incoming connection
                agentIdToUse = call.incomingConnection.agentId;
                console.log(`   📞 Incoming call - using incoming agent: ${agentIdToUse}`);
              } else if (call.campaign?.agentId) {
                // Outgoing campaign call - get agent from campaign
                agentIdToUse = call.campaign.agentId;
                console.log(`   📞 Campaign call - using campaign agent: ${agentIdToUse}`);
              } else {
                throw new Error('Call is not associated with any agent (neither incoming nor campaign)');
              }
              
              // Get agent details to retrieve transfer phone number
              const agent = await storage.getAgent(agentIdToUse);
              if (!agent?.transferPhoneNumber) {
                throw new Error('Transfer phone number not configured for this agent');
              }
              
              const transferNumber = agent.transferPhoneNumber;
              console.log(`   📲 Transferring to: ${transferNumber}`);
              
              // Execute the transfer via Twilio REST API
              if (!call.twilioSid) {
                throw new Error('Twilio CallSid not available for transfer');
              }
              
              await executeCallTransfer(call.twilioSid, transferNumber);
              
              // Send success result back to ElevenLabs
              const successResult = {
                type: 'client_tool_result',
                tool_call_id: toolCall.tool_call_id,
                result: `Successfully transferred call to ${transferNumber}`,
                is_error: false
              };
              
              elevenLabsWs.send(JSON.stringify(successResult));
              console.log(`✅ [Call Transfer] Transfer initiated and confirmed to ElevenLabs`);
              
              // Update call metadata for CRM Lead Processor detection
              try {
                const existingMetadata = (call.metadata as Record<string, unknown>) || {};
                const existingAiInsights = (existingMetadata.aiInsights as Record<string, unknown>) || {};
                
                const updatedMetadata = {
                  ...existingMetadata,
                  wasTransferred: true,
                  hasTransfer: true,
                  transferredTo: transferNumber,
                  transferredAt: new Date().toISOString(),
                  aiInsights: {
                    ...existingAiInsights,
                    primaryOutcome: 'call_transfer',
                    wasTransferred: true,
                    transferTarget: transferNumber,
                  },
                };
                
                await db
                  .update(calls)
                  .set({ 
                    wasTransferred: true,
                    transferredTo: transferNumber,
                    metadata: updatedMetadata 
                  })
                  .where(eq(calls.id, callId));
                
                console.log(`📞 [Call Transfer] Updated call metadata for CRM detection`);
              } catch (metadataError: any) {
                console.error(`📞 [Call Transfer] Failed to update call metadata:`, metadataError.message);
              }
              
            } catch (error: any) {
              console.error(`❌ [Call Transfer] Failed:`, error);
              
              // Determine detailed error message for ElevenLabs
              let errorMessage = 'Transfer failed';
              if (error.message.includes('not found')) {
                errorMessage = 'Call not found or ended';
              } else if (error.message.includes('not configured')) {
                errorMessage = 'Transfer phone number not configured for this agent';
              } else if (error.message.includes('not associated')) {
                errorMessage = 'Call not associated with an incoming agent';
              } else if (error.message.includes('Twilio')) {
                errorMessage = `Twilio error: ${error.message}`;
              } else {
                errorMessage = error.message || 'Unknown error occurred';
              }
              
              // Send error result back to ElevenLabs with user-friendly message
              const errorResult = {
                type: 'client_tool_result',
                tool_call_id: toolCall.tool_call_id,
                result: `I apologize, but I was unable to transfer your call. ${errorMessage}. Please try calling back or contact support directly.`,
                is_error: true
              };
              
              elevenLabsWs.send(JSON.stringify(errorResult));
              console.log(`❌ [Call Transfer] Error sent to ElevenLabs: ${errorMessage}`);
            }
          } else {
            console.log(`❓ [Client Tool] Unknown tool: ${toolCall?.tool_name}`);
          }
          break;
          
        default:
          console.log(`❓ [ElevenLabs] Unhandled message type: ${message.type}`);
      }
    } catch (error) {
      console.error(`❌ [ElevenLabs] Error parsing message for call ${callId}:`, error);
    }
  });
}

// Helper function to initialize ElevenLabs connection
async function initializeElevenLabsConnection(
  agentId: string,
  callId: string,
  contactName: string | undefined,
  streamSid: string | null,
  twilioWs: WebSocket,
  conversationHistory: Array<{ role: 'user' | 'agent', text: string, timestamp: Date }>,
  silenceTimerRef: { current: NodeJS.Timeout | null },
  endCall: (reason: string) => Promise<void>,
  flowBridge?: any  // Optional FlowExecutionBridge instance
): Promise<WebSocket> {
  // agentId is the database UUID - need to look up the ElevenLabs agent ID
  console.log(`[Stream] Looking up ElevenLabs agent ID for database agent ${agentId}`);
  
  const agent = await storage.getAgent(agentId);
  if (!agent) {
    throw new Error(`Agent not found: ${agentId}`);
  }
  
  if (!agent.elevenLabsAgentId) {
    throw new Error(`Agent ${agentId} is missing ElevenLabs configuration. Please configure the agent in the admin panel.`);
  }
  
  const elevenLabsAgentId = agent.elevenLabsAgentId;
  console.log(`[Stream] Resolved database agent ${agentId} to ElevenLabs agent ${elevenLabsAgentId}`);
  
  // Get the pool-assigned credential for this agent
  console.log(`[Stream] 🔑 Resolving pool-assigned credential for agent ${agentId}...`);
  const credential = await ElevenLabsPoolService.getCredentialForAgent(agentId);
  if (!credential) {
    throw new Error(`No ElevenLabs credential found for agent ${agentId}`);
  }
  console.log(`[Stream] ✅ Using credential: ${credential.name} (ID: ${credential.id})`);
  
  // Create ElevenLabsService instance with the agent's pool-assigned credential
  const agentElevenLabsService = new ElevenLabsService(credential.apiKey);
  
  // Sync agent configuration to ElevenLabs before starting call
  // SKIP for Flow agents - their workflow is already compiled and saved when user edits the flow
  // Syncing here would overwrite the visual flow with a simplified built-in tools workflow
  if (agent.type === 'flow') {
    console.log(`[Stream] ⏭️ Skipping agent sync for Flow agent - workflow is managed by flow builder`);
  } else {
    // For Natural/Incoming agents, sync configuration to ensure latest settings
    console.log(`[Stream] 🔄 Syncing agent configuration to ElevenLabs...`);
    try {
      // Fetch knowledge base items if agent has knowledge base IDs
      let knowledgeBases: any[] = [];
      if (agent.knowledgeBaseIds && agent.knowledgeBaseIds.length > 0) {
        console.log(`[Stream] 📚 Fetching ${agent.knowledgeBaseIds.length} knowledge base items...`);
        const kbItems = await db
          .select()
          .from(knowledgeBase)
          .where(inArray(knowledgeBase.id, agent.knowledgeBaseIds));
        
        knowledgeBases = kbItems
          .filter(kb => kb.elevenLabsDocId) // Only include items synced to ElevenLabs
          .map(kb => ({
            type: kb.type,
            title: kb.title,
            elevenLabsDocId: kb.elevenLabsDocId,
          }));
        
        console.log(`[Stream] 📚 Found ${knowledgeBases.length} synced knowledge base items`);
      }
      
      await agentElevenLabsService.updateAgent(elevenLabsAgentId, {
        prompt: agent.systemPrompt || undefined,
        voice_tone: agent.voiceTone || undefined,
        personality: agent.personality || undefined,
        first_message: agent.firstMessage || undefined,
        model: agent.llmModel || undefined,
        temperature: agent.temperature || undefined,
        language: agent.language || undefined,
        knowledge_bases: knowledgeBases.length > 0 ? knowledgeBases : undefined,
        // Include tool settings to preserve them during call initialization
        transferEnabled: agent.transferEnabled || undefined,
        transferPhoneNumber: agent.transferPhoneNumber || undefined,
        detectLanguageEnabled: agent.detectLanguageEnabled || undefined,
        endConversationEnabled: agent.endConversationEnabled || undefined,
      });
      console.log(`[Stream] ✅ Agent configuration synced to ElevenLabs using credential: ${credential.name}`);
    } catch (syncError: any) {
      console.error(`[Stream] ⚠️ Failed to sync agent config (continuing anyway):`, syncError.message);
      // Continue with call even if sync fails - agent will use previous config
    }
  }
  
  // Check if this is a Flow agent (uses native ElevenLabs workflows)
  const isFlowAgent = agent.type === 'flow';
  
  console.log(`[Stream] Getting fresh signed URL for ElevenLabs agent ${elevenLabsAgentId} using credential: ${credential.name}`);
  const wsAuth = await agentElevenLabsService.getConversationWebSocketAuth(elevenLabsAgentId);
  
  if (!wsAuth.signed_url) {
    throw new Error('Failed to get signed URL from ElevenLabs');
  }

  console.log(`[ElevenLabs] Attempting to connect to ElevenLabs WebSocket...`);
  console.log(`[ElevenLabs] Signed URL obtained (first 100 chars): ${wsAuth.signed_url.substring(0, 100)}...`);
  const elevenLabsWs = new WebSocket(wsAuth.signed_url);
  
  elevenLabsWs.on('open', async () => {
    console.log(`✅ [ElevenLabs] WebSocket connection established for call ${callId}`);
    
    // Increment load counter for this credential
    try {
      await ElevenLabsPoolService.incrementLoad(credential.id);
      console.log(`[Pool] ✅ Incremented load for credential: ${credential.name}`);
    } catch (loadError) {
      console.error(`[Pool] ⚠️ Failed to increment load:`, loadError);
      // Continue with call even if load tracking fails
    }
    
    // For Flow agents with native ElevenLabs workflows:
    // DO NOT send any agent config - let ElevenLabs use the saved workflow without overrides
    // Sending an empty agent: {} could override/disable the workflow
    if (isFlowAgent) {
      console.log(`[ElevenLabs] 🔄 Flow Agent: Using native ElevenLabs workflow (no config override)`);
      
      // Only send dynamic variables if we have them, no agent config
      const hasDynamicVars = contactName || false;
      
      if (hasDynamicVars) {
        const minimalConfig = {
          type: "conversation_initiation_client_data",
          conversation_config: {
            dynamic_variables: {
              ...(contactName && { contact_name: contactName })
            }
          }
        };
        console.log(`[ElevenLabs] Sending minimal config (dynamic vars only)`);
        elevenLabsWs.send(JSON.stringify(minimalConfig));
      } else {
        // For Flow agents with no dynamic vars, don't send any initiation config
        // Let ElevenLabs use the agent's saved workflow configuration entirely
        console.log(`[ElevenLabs] No initiation config sent - using agent's saved workflow`);
      }
      
      console.log(`[ElevenLabs] ✅ Flow agent ready - workflow handles conversation flow`);
    } else {
      // For Natural/Incoming agents, use the standard conversation config
      const conversationConfig: any = {
        agent: {},
        dynamic_variables: {}
      };
      
      // Add dynamic variables
      if (contactName) {
        conversationConfig.dynamic_variables.contact_name = contactName;
        console.log(`[ElevenLabs] Adding contact name: ${contactName}`);
      }
      
      // For flow-based calls with flowBridge (legacy), use first_message from the flow
      if (flowBridge) {
        const firstMessage = flowBridge.getFirstMessage();
        console.log(`[ElevenLabs] 🔀 Flow Mode: Setting first message from flow`);
        console.log(`   First message: "${firstMessage}"`);
        conversationConfig.agent.first_message = firstMessage;
      }
      
      // Build the complete initiation message with correct structure
      const initialConfig = {
        type: "conversation_initiation_client_data",
        conversation_config: conversationConfig
      };
      
      console.log(`[ElevenLabs] Sending conversation initiation`);
      console.log(`   Dynamic variables:`, JSON.stringify(conversationConfig.dynamic_variables));
      
      elevenLabsWs.send(JSON.stringify(initialConfig));
      console.log(`[ElevenLabs] ✅ Sent initial config`);
    }
    
    // Continue with flow bridge handling only for non-Flow agents
    if (!isFlowAgent && elevenLabsWs) {
      
      // For flow-based calls, ALWAYS send contextual update after auto-progression
      // (initialize() may have advanced through message/delay/condition nodes)
      if (flowBridge) {
        // Small delay to ensure initial config is processed first
        setTimeout(async () => {
          try {
            // Generate contextual update regardless of node type
            // This ensures agent gets instructions even if flow auto-progressed
            const contextualUpdate = flowBridge.generateContextualUpdate();
            const instructionText = contextualUpdate.text || "";
            
            // Always send if we have non-empty text OR if we're on an END node
            if (instructionText.trim() || flowBridge.hasFlowEnded()) {
              console.log(`[Flow Bridge] 📤 Sending post-initialization contextual update:`);
              console.log(`   Instruction: "${instructionText}"`);
              console.log(`   Flow ended: ${flowBridge.hasFlowEnded()}`);
              
              const success = await sendWebSocketWithRetry(elevenLabsWs, {
                type: "contextual_update",
                text: instructionText || "Continue the conversation."
              });
              
              if (success) {
                console.log(`[Flow Bridge] ✅ Post-init contextual update sent`);
              } else {
                console.error(`[Flow Bridge] ❌ Failed to send post-init update after retries`);
              }
            } else {
              // If text is empty and not END node, send a generic instruction
              console.log(`[Flow Bridge] ℹ️ Sending fallback instruction after auto-progression`);
              const success = await sendWebSocketWithRetry(elevenLabsWs, {
                type: "contextual_update",
                text: "Continue the conversation naturally."
              });
              
              if (success) {
                console.log(`[Flow Bridge] ✅ Fallback instruction sent`);
              } else {
                console.error(`[Flow Bridge] ❌ Failed to send fallback instruction after retries`);
              }
            }
          } catch (error) {
            console.error(`[Flow Bridge] ❌ Failed to send post-init contextual update:`, error);
          }
        }, 100);
      }
    }
  });

  setupElevenLabsMessageHandlers(
    elevenLabsWs,
    callId,
    streamSid,
    twilioWs,
    conversationHistory,
    silenceTimerRef,
    endCall,
    flowBridge  // Pass flow bridge to message handlers
  );

  elevenLabsWs.on('error', (error) => {
    console.error(`[ElevenLabs] WebSocket error for call ${callId}:`, error);
  });

  elevenLabsWs.on('close', async (code, reason) => {
    console.log(`[ElevenLabs] WebSocket closed for call ${callId}`);
    console.log(`   Close code: ${code}`);
    console.log(`   Close reason: ${reason.toString() || 'No reason provided'}`);
    
    // Decrement load counter for this credential
    try {
      await ElevenLabsPoolService.decrementLoad(credential.id);
      console.log(`[Pool] ✅ Decremented load for credential: ${credential.name}`);
    } catch (loadError) {
      console.error(`[Pool] ⚠️ Failed to decrement load:`, loadError);
    }
    
    await formatAndSaveTranscript(callId, conversationHistory);
    
    if (twilioWs.readyState === WebSocket.OPEN) {
      twilioWs.close();
    }
  });
  
  return elevenLabsWs;
}

// Twilio Polly voice mapping for each language (native speakers)
const TWILIO_LANGUAGE_VOICES: Record<string, { voice: string; lang: string }> = {
  en: { voice: 'Polly.Joanna', lang: 'en-US' },
  fr: { voice: 'Polly.Lea', lang: 'fr-FR' },
  it: { voice: 'Polly.Bianca', lang: 'it-IT' },
  zh: { voice: 'Polly.Zhiyu', lang: 'cmn-CN' },
  hi: { voice: 'Polly.Kajal', lang: 'hi-IN' },
  ar: { voice: 'Polly.Zeina', lang: 'arb' },
};

// Language selection prompts spoken in their native language
const IVR_LANGUAGE_PROMPTS: Record<string, string> = {
  en: 'For English, press',
  fr: 'Pour le fran\u00e7ais, appuyez sur',
  it: "Per l'italiano, premere",
  zh: '\u4E2D\u6587\u8BF7\u6309',
  hi: '\u0939\u093F\u0902\u0926\u0940 \u0915\u0947 \u0932\u093F\u090F \u0926\u092C\u093E\u090F\u0902',
  ar: '\u0644\u0644\u0639\u0631\u0628\u064A\u0629 \u0627\u0636\u063A\u0637',
};

// Department menu templates for each language
const IVR_DEPT_TEMPLATES: Record<string, { prefix: string; pressKey: string; holdMsg: string; noAgentMsg: string; invalidMsg: string; noInputMsg: string }> = {
  en: { prefix: 'For', pressKey: 'press', holdMsg: 'Please hold while we connect you to an agent.', noAgentMsg: 'Unfortunately, no agents are currently available. Please try again later.', invalidMsg: 'Invalid selection. Please try again.', noInputMsg: 'We did not receive your selection.' },
  fr: { prefix: 'Pour', pressKey: 'appuyez sur', holdMsg: 'Veuillez patienter pendant que nous vous connectons \u00e0 un agent.', noAgentMsg: 'Malheureusement, aucun agent n\'est disponible actuellement. Veuillez r\u00e9essayer plus tard.', invalidMsg: 'S\u00e9lection invalide. Veuillez r\u00e9essayer.', noInputMsg: 'Nous n\'avons pas re\u00e7u votre s\u00e9lection.' },
  it: { prefix: 'Per', pressKey: 'premere', holdMsg: 'Attendere mentre la colleghiamo a un agente.', noAgentMsg: 'Purtroppo nessun agente \u00e8 attualmente disponibile. Riprovi pi\u00f9 tardi.', invalidMsg: 'Selezione non valida. Riprovi.', noInputMsg: 'Non abbiamo ricevuto la sua selezione.' },
  zh: { prefix: '\u5982\u9700', pressKey: '\u8BF7\u6309', holdMsg: '\u8BF7\u7A0D\u7B49\uFF0C\u6211\u4EEC\u6B63\u5728\u4E3A\u60A8\u8F6C\u63A5\u5BA2\u670D\u4EBA\u5458\u3002', noAgentMsg: '\u5F88\u62B1\u6B49\uFF0C\u76EE\u524D\u6CA1\u6709\u53EF\u7528\u7684\u5BA2\u670D\u4EBA\u5458\u3002\u8BF7\u7A0D\u540E\u518D\u8BD5\u3002', invalidMsg: '\u65E0\u6548\u7684\u9009\u62E9\u3002\u8BF7\u91CD\u8BD5\u3002', noInputMsg: '\u6211\u4EEC\u6CA1\u6709\u6536\u5230\u60A8\u7684\u9009\u62E9\u3002' },
  hi: { prefix: '', pressKey: '\u0926\u092C\u093E\u090F\u0902', holdMsg: '\u0915\u0943\u092A\u092F\u093E \u0930\u0941\u0915\u093F\u090F\uFF0C \u0939\u092E \u0906\u092A\u0915\u094B \u090F\u091C\u0947\u0902\u091F \u0938\u0947 \u091C\u094B\u0921\u093C \u0930\u0939\u0947 \u0939\u0948\u0902\u0964', noAgentMsg: '\u0926\u0941\u0930\u094D\u092D\u093E\u0917\u094D\u092F \u0938\u0947 \u0915\u094B\u0908 \u090F\u091C\u0947\u0902\u091F \u0909\u092A\u0932\u092C\u094D\u0927 \u0928\u0939\u0940\u0902 \u0939\u0948\u0964 \u0915\u0943\u092A\u092F\u093E \u092C\u093E\u0926 \u092E\u0947\u0902 \u092A\u0941\u0928\u0903 \u092A\u094D\u0930\u092F\u093E\u0938 \u0915\u0930\u0947\u0902\u0964', invalidMsg: '\u0905\u092E\u093E\u0928\u094D\u092F \u091A\u092F\u0928\u0964 \u0915\u0943\u092A\u092F\u093E \u092A\u0941\u0928\u0903 \u092A\u094D\u0930\u092F\u093E\u0938 \u0915\u0930\u0947\u0902\u0964', noInputMsg: '\u0939\u092E\u0947\u0902 \u0906\u092A\u0915\u093E \u091A\u092F\u0928 \u092A\u094D\u0930\u093E\u092A\u094D\u0924 \u0928\u0939\u0940\u0902 \u0939\u0941\u0906\u0964' },
  ar: { prefix: '\u0644\u0640', pressKey: '\u0627\u0636\u063A\u0637', holdMsg: '\u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 \u0628\u064A\u0646\u0645\u0627 \u0646\u0642\u0648\u0645 \u0628\u062A\u0648\u0635\u064A\u0644\u0643 \u0628\u0627\u0644\u0648\u0643\u064A\u0644.', noAgentMsg: '\u0644\u0644\u0623\u0633\u0641\u060C \u0644\u0627 \u064A\u0648\u062C\u062F \u0648\u0643\u0644\u0627\u0621 \u0645\u062A\u0627\u062D\u0648\u0646 \u062D\u0627\u0644\u064A\u064B\u0627. \u064A\u0631\u062C\u0649 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0644\u0627\u062D\u0642\u064B\u0627.', invalidMsg: '\u0627\u062E\u062A\u064A\u0627\u0631 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D. \u064A\u0631\u062C\u0649 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649.', noInputMsg: '\u0644\u0645 \u0646\u062A\u0644\u0642\u0651 \u0627\u062E\u062A\u064A\u0627\u0631\u0643.' },
};

// Department name translations for IVR spoken menus
const IVR_DEPT_NAME_TRANSLATIONS: Record<string, Record<string, string>> = {
  Sales: { en: 'Sales', fr: 'Ventes', it: 'Vendite', zh: '\u9500\u552E', hi: '\u092C\u093F\u0915\u094D\u0930\u0940', ar: '\u0627\u0644\u0645\u0628\u064A\u0639\u0627\u062A' },
  Support: { en: 'Support', fr: 'Assistance', it: 'Supporto', zh: '\u5BA2\u670D', hi: '\u0938\u0939\u093E\u092F\u0924\u093E', ar: '\u0627\u0644\u062F\u0639\u0645' },
  Scheduling: { en: 'Scheduling', fr: 'Planification', it: 'Programmazione', zh: '\u9884\u7EA6', hi: '\u0936\u0947\u0921\u094D\u092F\u0942\u0932\u093F\u0902\u0917', ar: '\u0627\u0644\u062C\u062F\u0648\u0644\u0629' },
  Billing: { en: 'Billing', fr: 'Facturation', it: 'Fatturazione', zh: '\u8D26\u5355', hi: '\u092C\u093F\u0932\u093F\u0902\u0917', ar: '\u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631' },
  'Technical Support': { en: 'Technical Support', fr: 'Support Technique', it: 'Supporto Tecnico', zh: '\u6280\u672F\u652F\u6301', hi: '\u0924\u0915\u0928\u0940\u0915\u0940 \u0938\u0939\u093E\u092F\u0924\u093E', ar: '\u0627\u0644\u062F\u0639\u0645 \u0627\u0644\u0641\u0646\u064A' },
  'Customer Service': { en: 'Customer Service', fr: 'Service Client', it: 'Servizio Clienti', zh: '\u5BA2\u6237\u670D\u52A1', hi: '\u0917\u094D\u0930\u093E\u0939\u0915 \u0938\u0947\u0935\u093E', ar: '\u062E\u062F\u0645\u0629 \u0627\u0644\u0639\u0645\u0644\u0627\u0621' },
  Appointments: { en: 'Appointments', fr: 'Rendez-vous', it: 'Appuntamenti', zh: '\u9884\u7EA6', hi: '\u0905\u092A\u0949\u0907\u0902\u091F\u092E\u0947\u0902\u091F', ar: '\u0627\u0644\u0645\u0648\u0627\u0639\u064A\u062F' },
  General: { en: 'General', fr: 'G\u00e9n\u00e9ral', it: 'Generale', zh: '\u901A\u7528', hi: '\u0938\u093E\u092E\u093E\u0928\u094D\u092F', ar: '\u0639\u0627\u0645' },
  Marketing: { en: 'Marketing', fr: 'Marketing', it: 'Marketing', zh: '\u5E02\u573A\u8425\u9500', hi: '\u092E\u093E\u0930\u094D\u0915\u0947\u091F\u093F\u0902\u0917', ar: '\u0627\u0644\u062A\u0633\u0648\u064A\u0642' },
  'Human Resources': { en: 'Human Resources', fr: 'Ressources Humaines', it: 'Risorse Umane', zh: '\u4EBA\u529B\u8D44\u6E90', hi: '\u092E\u093E\u0928\u0935 \u0938\u0902\u0938\u093E\u0927\u0928', ar: '\u0627\u0644\u0645\u0648\u0627\u0631\u062F \u0627\u0644\u0628\u0634\u0631\u064A\u0629' },
};

function getVoiceForLanguage(langCode: string): any {
  return TWILIO_LANGUAGE_VOICES[langCode]?.voice || 'Polly.Joanna';
}

function getTwilioLangCode(langCode: string): string {
  return TWILIO_LANGUAGE_VOICES[langCode]?.lang || 'en-US';
}

function translateDeptNameForIvr(name: string, langCode: string): string {
  const translations = IVR_DEPT_NAME_TRANSLATIONS[name];
  if (translations && translations[langCode]) {
    return translations[langCode];
  }
  return name;
}

function buildDeptMenuPrompt(deptNames: string[], langCode: string): string {
  const template = IVR_DEPT_TEMPLATES[langCode] || IVR_DEPT_TEMPLATES.en;
  const items = deptNames.map((name, idx) => {
    const translated = translateDeptNameForIvr(name, langCode);
    const keyNum = idx + 1;
    if (langCode === 'ar') {
      return `${template.prefix}${translated} ${template.pressKey} ${keyNum}`;
    } else if (langCode === 'zh') {
      return `${template.prefix}${translated}${template.pressKey}${keyNum}`;
    } else if (langCode === 'hi') {
      return `${translated} ${template.prefix} ${keyNum} ${template.pressKey}`;
    }
    return `${template.prefix} ${translated} ${template.pressKey} ${keyNum}`;
  });
  return items.join(langCode === 'zh' ? '\u3002' : langCode === 'ar' ? '\u060C ' : ', ') + '.';
}

// Handle IVR calls (department routing)
async function handleIvrCall(
  req: Request,
  res: Response,
  phone: { id: string; userId: string | null; phoneNumber: string },
  ivrConfig: any,
  callerNumber: string,
  callSid: string
) {
  try {
    console.log(`📞 [IVR Call] Processing IVR for phone ${phone.phoneNumber}`);
    console.log(`   IVR Config: ${ivrConfig.name}`);
    console.log(`   Menu Options: ${JSON.stringify(ivrConfig.menuOptions)}`);

    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();
    
    const menuOptions = ivrConfig.menuOptions || [];
    const langOptions = ivrConfig.languageOptions as { id: string; language: string; voiceId: string; greeting: string; selectedDepartments?: string[] }[] | null;
    
    if (menuOptions.length === 0) {
      console.log(`⚠️ [IVR Call] No menu options configured`);
      response.say({ voice: 'Polly.Joanna' }, 'Thank you for calling. Our system is currently being configured. Please try again later.');
      response.hangup();
      res.type('text/xml');
      return res.send(response.toString());
    }

    // Multi-language mode: play language selection with each option spoken in its native voice
    if (langOptions && langOptions.length > 1) {
      console.log(`📞 [IVR Call] Multi-language mode with ${langOptions.length} languages`);
      
      const gather = response.gather({
        numDigits: 1,
        action: `/api/webhooks/ivr/handle-language?ivrId=${ivrConfig.id}&callSid=${callSid}&caller=${encodeURIComponent(callerNumber)}`,
        method: 'POST',
        timeout: 10,
      });
      
      // Play language selection greeting before listing options
      if (ivrConfig.greetingMessage) {
        gather.say({ voice: getVoiceForLanguage('en'), language: getTwilioLangCode('en') as any }, ivrConfig.greetingMessage);
        console.log(`   Greeting: "${ivrConfig.greetingMessage}"`);
      } else {
        gather.say({ voice: getVoiceForLanguage('en'), language: getTwilioLangCode('en') as any }, 'Welcome. Please select your preferred language.');
        console.log(`   Greeting: default welcome`);
      }
      
      for (let idx = 0; idx < langOptions.length; idx++) {
        const opt = langOptions[idx];
        const voice = getVoiceForLanguage(opt.language);
        const lang = getTwilioLangCode(opt.language);
        const prompt = IVR_LANGUAGE_PROMPTS[opt.language] || `For ${opt.language}, press`;
        const keyNum = idx + 1;
        
        gather.say({ voice, language: lang as any }, `${prompt} ${keyNum}.`);
        console.log(`   Lang option ${keyNum}: ${opt.language} → voice=${voice}, lang=${lang}`);
      }
      
      response.say({ voice: 'Polly.Joanna' }, 'We did not receive your selection.');
      response.redirect(`/api/webhooks/twilio/incoming`);
      
      res.type('text/xml');
      console.log(`📞 [IVR Call] Sending multi-language TwiML response`);
      return res.send(response.toString());
    }

    // Single language mode: go straight to department menu
    const langCode = langOptions?.[0]?.language || 'en';
    const voice = getVoiceForLanguage(langCode);
    const lang = getTwilioLangCode(langCode);
    
    const deptNames = menuOptions.map((opt: any) => opt.label);
    const deptMenuPrompt = buildDeptMenuPrompt(deptNames, langCode);
    
    const gather = response.gather({
      numDigits: 1,
      action: `/api/webhooks/ivr/handle-selection?ivrId=${ivrConfig.id}&callSid=${callSid}&caller=${encodeURIComponent(callerNumber)}&lang=${langCode}`,
      method: 'POST',
      timeout: 10,
    });
    
    gather.say({ voice, language: lang as any }, deptMenuPrompt);

    const template = IVR_DEPT_TEMPLATES[langCode] || IVR_DEPT_TEMPLATES.en;
    response.say({ voice, language: lang as any }, template.noInputMsg);
    response.redirect(`/api/webhooks/twilio/incoming`);

    res.type('text/xml');
    console.log(`📞 [IVR Call] Sending single-language TwiML response`);
    return res.send(response.toString());
  } catch (error) {
    console.error(`❌ [IVR Call] Error:`, error);
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();
    response.say('An error occurred. Please try again later.');
    response.hangup();
    res.type('text/xml');
    return res.send(response.toString());
  }
}

// Handle IVR language selection - plays department menu in the selected language
export async function handleIvrLanguageSelection(req: Request, res: Response) {
  try {
    const { ivrId, callSid, caller } = req.query;
    const { Digits, To } = req.body;
    
    console.log(`📞 [IVR Language] Received digit: ${Digits} for IVR: ${ivrId}`);
    
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();
    
    const ivrConfig = await db
      .select()
      .from(ivrConfigurations)
      .where(and(
        eq(ivrConfigurations.id, ivrId as string),
        eq(ivrConfigurations.isActive, true)
      ))
      .limit(1);
    
    if (!ivrConfig.length) {
      console.error(`❌ [IVR Language] IVR config not found or inactive: ${ivrId}`);
      response.say({ voice: 'Polly.Joanna' }, 'Sorry, an error occurred. Please try again.');
      response.hangup();
      res.type('text/xml');
      return res.send(response.toString());
    }
    
    const langOptions = ivrConfig[0].languageOptions as { id: string; language: string; voiceId: string; greeting: string; selectedDepartments?: string[] }[] | null;
    const menuOptions = ivrConfig[0].menuOptions || [];
    
    if (!langOptions || langOptions.length === 0) {
      console.error(`❌ [IVR Language] No language options configured`);
      response.say({ voice: 'Polly.Joanna' }, 'Sorry, an error occurred. Please try again.');
      response.hangup();
      res.type('text/xml');
      return res.send(response.toString());
    }
    
    const digitIdx = parseInt(Digits, 10) - 1;
    const selectedLang = langOptions[digitIdx];
    
    if (!selectedLang) {
      console.log(`⚠️ [IVR Language] Invalid digit: ${Digits}`);
      const invalidVoice = getVoiceForLanguage('en');
      response.say({ voice: invalidVoice }, 'Invalid selection.');
      
      const gather = response.gather({
        numDigits: 1,
        action: `/api/webhooks/ivr/handle-language?ivrId=${ivrId}&callSid=${callSid}&caller=${encodeURIComponent(caller as string || '')}`,
        method: 'POST',
        timeout: 10,
      });
      
      for (let idx = 0; idx < langOptions.length; idx++) {
        const opt = langOptions[idx];
        const voice = getVoiceForLanguage(opt.language);
        const lang = getTwilioLangCode(opt.language);
        const prompt = IVR_LANGUAGE_PROMPTS[opt.language] || `For ${opt.language}, press`;
        gather.say({ voice, language: lang as any }, `${prompt} ${idx + 1}.`);
      }
      
      response.say({ voice: 'Polly.Joanna' }, 'Goodbye.');
      response.hangup();
      res.type('text/xml');
      return res.send(response.toString());
    }
    
    const langCode = selectedLang.language;
    const voice = getVoiceForLanguage(langCode);
    const lang = getTwilioLangCode(langCode);
    
    console.log(`📞 [IVR Language] Selected language: ${langCode}, voice: ${voice}`);
    
    // Filter departments to only those selected for this language (if configured)
    let filteredMenuOptions = menuOptions;
    if (selectedLang.selectedDepartments && selectedLang.selectedDepartments.length > 0) {
      filteredMenuOptions = menuOptions.filter((opt: any) => 
        selectedLang.selectedDepartments!.includes(opt.departmentId)
      );
      if (filteredMenuOptions.length === 0) {
        filteredMenuOptions = menuOptions;
      }
    }
    
    // Build department menu prompt in the selected language
    const deptNames = filteredMenuOptions.map((opt: any) => opt.label);
    const deptMenuPrompt = buildDeptMenuPrompt(deptNames, langCode);
    
    console.log(`📞 [IVR Language] Department menu (${langCode}): ${deptMenuPrompt}`);
    
    // Create gather for department selection
    const gather = response.gather({
      numDigits: 1,
      action: `/api/webhooks/ivr/handle-selection?ivrId=${ivrId}&callSid=${callSid}&caller=${encodeURIComponent(caller as string || '')}&lang=${langCode}`,
      method: 'POST',
      timeout: 10,
    });
    
    gather.say({ voice, language: lang as any }, deptMenuPrompt);
    
    const template = IVR_DEPT_TEMPLATES[langCode] || IVR_DEPT_TEMPLATES.en;
    response.say({ voice, language: lang as any }, template.noInputMsg);
    response.redirect(`/api/webhooks/twilio/incoming`);
    
    res.type('text/xml');
    console.log(`📞 [IVR Language] Sending department menu TwiML in ${langCode}`);
    return res.send(response.toString());
  } catch (error) {
    console.error(`❌ [IVR Language] Error:`, error);
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();
    response.say('An error occurred. Please try again later.');
    response.hangup();
    res.type('text/xml');
    return res.send(response.toString());
  }
}

// Handle IVR department selection (language-aware)
export async function handleIvrSelection(req: Request, res: Response) {
  try {
    const { ivrId, callSid, caller, lang } = req.query;
    const { Digits, To } = req.body;
    
    const langCode = (lang as string) || 'en';
    const voice = getVoiceForLanguage(langCode);
    const langTag = getTwilioLangCode(langCode);
    const template = IVR_DEPT_TEMPLATES[langCode] || IVR_DEPT_TEMPLATES.en;
    
    console.log(`📞 [IVR Selection] Received digit: ${Digits} for IVR: ${ivrId}, lang: ${langCode}, To: ${To}`);
    
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();
    
    const ivrConfig = await db
      .select()
      .from(ivrConfigurations)
      .where(and(
        eq(ivrConfigurations.id, ivrId as string),
        eq(ivrConfigurations.isActive, true)
      ))
      .limit(1);
    
    if (!ivrConfig.length) {
      console.error(`❌ [IVR Selection] IVR config not found or inactive: ${ivrId}`);
      response.say({ voice, language: langTag as any }, template.invalidMsg);
      response.hangup();
      res.type('text/xml');
      return res.send(response.toString());
    }
    
    if (ivrConfig[0].phoneNumberId) {
      const phoneCheck = await db
        .select({ phoneNumber: phoneNumbers.phoneNumber })
        .from(phoneNumbers)
        .where(eq(phoneNumbers.id, ivrConfig[0].phoneNumberId))
        .limit(1);
      
      if (phoneCheck.length > 0 && To && phoneCheck[0].phoneNumber !== To) {
        console.error(`❌ [IVR Selection] Phone number mismatch - IVR phone: ${phoneCheck[0].phoneNumber}, Called: ${To}`);
        response.say({ voice, language: langTag as any }, template.invalidMsg);
        response.hangup();
        res.type('text/xml');
        return res.send(response.toString());
      }
    }
    
    const menuOptions = ivrConfig[0].menuOptions || [];
    const selectedOption = menuOptions.find((opt: any) => opt.key === Digits);
    
    if (!selectedOption) {
      console.log(`⚠️ [IVR Selection] Invalid digit: ${Digits}`);
      response.say({ voice, language: langTag as any }, template.invalidMsg);
      
      const deptNames = menuOptions.map((opt: any) => opt.label);
      const deptMenuPrompt = buildDeptMenuPrompt(deptNames, langCode);
      const gather = response.gather({
        numDigits: 1,
        action: `/api/webhooks/ivr/handle-selection?ivrId=${ivrId}&callSid=${callSid}&caller=${encodeURIComponent(caller as string || '')}&lang=${langCode}`,
        method: 'POST',
        timeout: 10,
      });
      gather.say({ voice, language: langTag as any }, deptMenuPrompt);
      response.hangup();
      res.type('text/xml');
      return res.send(response.toString());
    }
    
    console.log(`📞 [IVR Selection] Selected department: ${selectedOption.label} (${selectedOption.departmentId})`);
    
    const dept = await db
      .select()
      .from(departments)
      .where(eq(departments.id, selectedOption.departmentId))
      .limit(1);
    
    if (!dept.length) {
      response.say({ voice, language: langTag as any }, template.noAgentMsg);
      response.hangup();
      res.type('text/xml');
      return res.send(response.toString());
    }
    
    const deptAgentsList = await db
      .select({
        agentId: departmentAgents.agentId,
        agent: agents,
      })
      .from(departmentAgents)
      .leftJoin(agents, eq(departmentAgents.agentId, agents.id))
      .where(eq(departmentAgents.departmentId, selectedOption.departmentId));
    
    if (deptAgentsList.length === 0 || !deptAgentsList[0].agent) {
      response.say({ voice, language: langTag as any }, template.noAgentMsg);
      response.hangup();
      res.type('text/xml');
      return res.send(response.toString());
    }
    
    const availableAgent = deptAgentsList.find(da => da.agent?.elevenLabsAgentId);
    
    if (!availableAgent || !availableAgent.agent) {
      response.say({ voice, language: langTag as any }, template.holdMsg);
      const firstAgent = deptAgentsList[0].agent;
      if (firstAgent?.transferPhoneNumber) {
        response.dial().number(firstAgent.transferPhoneNumber);
      } else {
        response.say({ voice, language: langTag as any }, template.noAgentMsg);
        response.hangup();
      }
      res.type('text/xml');
      return res.send(response.toString());
    }
    
    const selectedAgent = availableAgent.agent;
    console.log(`📞 [IVR Selection] Connecting to agent: ${selectedAgent.name} (${selectedAgent.id})`);
    
    response.say({ voice, language: langTag as any }, template.holdMsg);
    
    const elevenLabsUrl = `https://api.elevenlabs.io/twilio/inbound_call?agent_id=${selectedAgent.elevenLabsAgentId}`;
    
    console.log(`📞 [IVR Selection] Redirecting to ElevenLabs: ${elevenLabsUrl}`);
    response.redirect(elevenLabsUrl);
    
    res.type('text/xml');
    return res.send(response.toString());
  } catch (error) {
    console.error(`❌ [IVR Selection] Error:`, error);
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();
    response.say('An error occurred. Please try again later.');
    response.hangup();
    res.type('text/xml');
    return res.send(response.toString());
  }
}

// Handle incoming calls to Twilio numbers (for incoming agents)
export async function handleIncomingCallWebhook(req: Request, res: Response) {
  try {
    console.log(`📞 [Incoming Call] Received incoming call from Twilio`);
    console.log(`   Body:`, req.body);
    
    const { To, From, CallSid, CallerId } = req.body;
    
    if (!To || !From || !CallSid) {
      console.error(`❌ [Incoming Call] Missing required parameters`);
      return res.status(400).send('Missing required parameters');
    }

    console.log(`📞 [Incoming Call] From: ${From}, To: ${To}, CallSid: ${CallSid}`);

    // Look up the phone number and its incoming connection
    const phoneNumber = await db
      .select({
        id: phoneNumbers.id,
        userId: phoneNumbers.userId,
        phoneNumber: phoneNumbers.phoneNumber,
      })
      .from(phoneNumbers)
      .where(eq(phoneNumbers.phoneNumber, To))
      .limit(1);

    if (!phoneNumber || phoneNumber.length === 0) {
      console.error(`❌ [Incoming Call] REJECTED - Phone number ${To} not found in database`);
      console.error(`   🚨 [Security Audit] Unauthorized incoming call attempt: From=${From}, To=${To}, CallSid=${CallSid}`);
      const VoiceResponse = twilio.twiml.VoiceResponse;
      const response = new VoiceResponse();
      // Use reject() to minimize cost - caller hears busy/disconnect, no billing
      response.reject({ reason: 'rejected' });
      res.type('text/xml');
      return res.send(response.toString());
    }

    const phone = phoneNumber[0];

    // Check for IVR configuration FIRST (department routing takes priority)
    const ivrConfig = await db
      .select()
      .from(ivrConfigurations)
      .where(and(
        eq(ivrConfigurations.phoneNumberId, phone.id),
        eq(ivrConfigurations.isActive, true)
      ))
      .limit(1);

    if (ivrConfig && ivrConfig.length > 0) {
      console.log(`📞 [Incoming Call] Found IVR configuration for ${To} - routing to IVR menu`);
      return handleIvrCall(req, res, phone, ivrConfig[0], From, CallSid);
    }

    // Look up the incoming connection for this phone number (fallback if no IVR)
    const connection = await db
      .select({
        id: incomingConnections.id,
        agentId: incomingConnections.agentId,
      })
      .from(incomingConnections)
      .where(eq(incomingConnections.phoneNumberId, phone.id))
      .limit(1);

    if (!connection || connection.length === 0) {
      console.error(`❌ [Incoming Call] REJECTED - Phone number ${To} has no incoming connection or IVR configured`);
      console.error(`   🚨 [Security Audit] Incoming call to unconfigured number: From=${From}, To=${To}, CallSid=${CallSid}`);
      const VoiceResponse = twilio.twiml.VoiceResponse;
      const response = new VoiceResponse();
      // Use reject() to minimize cost - caller hears busy/disconnect, no billing
      response.reject({ reason: 'rejected' });
      res.type('text/xml');
      return res.send(response.toString());
    }

    const incomingConnection = connection[0];

    // Verify connection belongs to the same user as the phone number (security check)
    const connectionDetails = await db
      .select({
        userId: incomingConnections.userId,
      })
      .from(incomingConnections)
      .where(eq(incomingConnections.id, incomingConnection.id))
      .limit(1);

    if (!connectionDetails.length || connectionDetails[0].userId !== phone.userId) {
      console.error(`❌ [Incoming Call] REJECTED - Connection ownership mismatch for ${To}`);
      console.error(`   🚨 [Security Audit] Ownership mismatch: From=${From}, To=${To}, CallSid=${CallSid}`);
      const VoiceResponse = twilio.twiml.VoiceResponse;
      const response = new VoiceResponse();
      // Use reject() to minimize cost
      response.reject({ reason: 'rejected' });
      res.type('text/xml');
      return res.send(response.toString());
    }

    // Fetch the agent details (type='incoming')
    const agent = await db
      .select()
      .from(agents)
      .where(and(eq(agents.id, incomingConnection.agentId), eq(agents.type, 'incoming')))
      .limit(1);

    if (!agent || agent.length === 0) {
      console.error(`❌ [Incoming Call] REJECTED - Agent ${incomingConnection.agentId} not found or wrong type for ${To}`);
      console.error(`   🚨 [Security Audit] Missing agent: From=${From}, To=${To}, CallSid=${CallSid}`);
      const VoiceResponse = twilio.twiml.VoiceResponse;
      const response = new VoiceResponse();
      // Use reject() to minimize cost
      response.reject({ reason: 'rejected' });
      res.type('text/xml');
      return res.send(response.toString());
    }

    const incomingAgent = agent[0];

    // NATIVE ELEVENLABS INTEGRATION:
    // This webhook should NOT be called for numbers with incoming connections.
    // Twilio should route directly to ElevenLabs (https://api.elevenlabs.io/twilio/inbound_call).
    // If we reach here, it means Twilio webhook is misconfigured for this number.
    
    console.log(`⚠️  [Incoming Call] Call reached our server but should be handled by ElevenLabs natively`);
    console.log(`   This indicates Twilio webhook is misconfigured for phone number ${To}`);
    console.log(`   Expected: Twilio should route to https://api.elevenlabs.io/twilio/inbound_call`);
    console.log(`   Fix: Delete and recreate the incoming connection to resync Twilio webhook`);
    
    // Return a helpful message to the caller
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();
    response.say('We are experiencing a temporary configuration issue. Please call back in a moment.');
    res.type('text/xml');
    return res.send(response.toString());
  } catch (error) {
    console.error('❌ [Incoming Call] Error:', error);
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();
    response.say('An error occurred. Please try again later.');
    res.type('text/xml');
    res.send(response.toString());
  }
}

// Handle outbound campaign calls
export async function handleTwilioVoiceWebhook(req: Request, res: Response) {
  try {
    console.log(`🎙️ [Voice Webhook] Received request from Twilio`);
    console.log(`   Query params:`, req.query);
    console.log(`   Body:`, req.body);
    
    const { callId, agentId, contactName, flowId, executionId } = req.query;
    
    if (!callId || !agentId) {
      console.error(`❌ [Voice Webhook] Missing required parameters - callId: ${callId}, agentId: ${agentId}`);
      return res.status(400).send('Missing required parameters');
    }

    console.log(`✅ [Voice Webhook] Call ${callId} answered, agent: ${agentId}, contact: ${contactName || 'N/A'}`);
    if (flowId) {
      console.log(`   Flow ID: ${flowId}, Execution ID: ${executionId}`);
    }

    await db
      .update(calls)
      .set({ status: 'answered' })
      .where(eq(calls.id, callId as string));

    const domain = getDomain(req.headers.host as string);
    const streamUrl = `wss://${domain}/api/webhooks/twilio/stream`;
    
    console.log(`📞 [Voice Webhook] Creating TwiML with stream URL: ${streamUrl}`);
    console.log(`   Parameters: callId=${callId}, agentId=${agentId}, contactName=${contactName || 'N/A'}`);
    
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();
    const connect = response.connect();
    
    const stream = connect.stream({ url: streamUrl });
    stream.parameter({ name: 'callId', value: callId as string });
    stream.parameter({ name: 'agentId', value: agentId as string });
    if (contactName) {
      stream.parameter({ name: 'contactName', value: contactName as string });
    }
    // Pass flow execution context to Media Streams handler
    if (flowId) {
      stream.parameter({ name: 'flowId', value: flowId as string });
    }
    if (executionId) {
      stream.parameter({ name: 'executionId', value: executionId as string });
    }
    
    const twimlString = response.toString();
    console.log(`📄 [Voice Webhook] Generated TwiML:\n${twimlString}`);
    
    res.type('text/xml');
    res.send(twimlString);
  } catch (error) {
    console.error('Voice webhook error:', error);
    res.status(500).send('Internal server error');
  }
}

export async function handleTwilioStatusWebhook(req: Request, res: Response) {
  try {
    console.log(`📊 [Status Webhook] Received status update from Twilio`);
    console.log(`   Query params:`, req.query);
    console.log(`   Body:`, req.body);
    
    const { callId } = req.query;
    const { 
      CallStatus, 
      CallDuration, 
      RecordingUrl, 
      To, 
      From, 
      CallSid,
      Direction,
      ForwardedFrom,
      CallerName
    } = req.body;
    
    if (!callId) {
      console.error(`❌ [Status Webhook] Missing call ID`);
      return res.status(400).send('Missing call ID');
    }

    const statusMap: Record<string, string> = {
      'initiated': 'initiated',
      'ringing': 'ringing',
      'in-progress': 'in-progress',
      'completed': 'completed',
      'busy': 'busy',
      'failed': 'failed',
      'no-answer': 'no-answer'
    };

    const status = statusMap[CallStatus] || CallStatus;
    
    // Build metadata object with call information
    const metadata: any = {
      twilioCallSid: CallSid,
      to: To,
      from: From,
      direction: Direction,
    };
    
    if (ForwardedFrom) metadata.forwardedFrom = ForwardedFrom;
    if (CallerName) metadata.callerName = CallerName;
    
    const updateData: any = { 
      status,
      metadata 
    };
    
    // Save recording URL if provided in status webhook
    if (RecordingUrl) {
      // Append .mp3 for direct audio playback access
      updateData.recordingUrl = RecordingUrl.endsWith('.mp3') ? RecordingUrl : `${RecordingUrl}.mp3`;
      console.log(`📼 [Status Webhook] Recording URL captured: ${updateData.recordingUrl}`);
    }
    
    // Save phone numbers from Twilio for incoming calls
    if (To) {
      updateData.toNumber = To;
    }
    if (From) {
      updateData.fromNumber = From;
    }
    
    if (CallStatus === 'completed') {
      updateData.endedAt = new Date();
      if (CallDuration) {
        updateData.duration = parseInt(CallDuration, 10);
      }
    }

    await db
      .update(calls)
      .set(updateData)
      .where(eq(calls.id, callId as string));

    console.log(`✅ [Status Webhook] Call ${callId} status updated: ${CallStatus}`);

    if (CallStatus === 'completed' && CallDuration) {
      const creditResult = await deductCallCreditsForElevenLabs(callId as string, parseInt(CallDuration, 10));
      
      if (!creditResult.success && !creditResult.alreadyDeducted) {
        console.error(`❌ [Status Webhook] Credit deduction failed for call ${callId}: ${creditResult.error}`);
        
        // Mark call as failed due to insufficient credits
        await db.update(calls)
          .set({ 
            status: 'failed',
            metadata: sql`COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify({ creditDeductionFailed: true, creditError: creditResult.error })}`
          })
          .where(eq(calls.id, callId as string));
        
        console.warn(`⚠️ [Status Webhook] Call ${callId} marked as failed due to credit deduction failure`);
        
        // CRITICAL: Stop all downstream processing when credits fail
        return res.status(200).json({ 
          success: false, 
          error: 'Credit deduction failed',
          callId 
        });
      }
    }

    // AUTOMATIC RECORDING RECOVERY: If call completed/answered but no recording URL, fetch from Twilio
    if (['completed', 'answered'].includes(CallStatus)) {
      try {
        // Get the call record to check if it has a recording URL and Twilio SID
        const [callRecord] = await db
          .select()
          .from(calls)
          .where(eq(calls.id, callId as string))
          .limit(1);
        
        if (callRecord && callRecord.twilioSid && !callRecord.recordingUrl) {
          console.log(`🎙️ [Auto Recovery] Call ${callId} completed but no recording URL. Fetching from Twilio...`);
          
          const twilioClient = await getTwilioClient();
          
          try {
            // Fetch recordings for this call from Twilio
            const recordings = await twilioClient.recordings.list({
              callSid: callRecord.twilioSid,
              limit: 1
            });
            
            if (recordings.length > 0) {
              const recording = recordings[0];
              const recordingUrl = `https://api.twilio.com${recording.uri.replace('.json', '')}`;
              
              console.log(`✅ [Auto Recovery] Found recording: ${recordingUrl}`);
              
              // Update call with recording URL
              await db
                .update(calls)
                .set({
                  recordingUrl,
                  duration: recording.duration ? parseInt(recording.duration, 10) : callRecord.duration
                })
                .where(eq(calls.id, callId as string));
              
              console.log(`✅ [Auto Recovery] Recording automatically recovered for call ${callId}`);
            } else {
              console.log(`⚠️ [Auto Recovery] No recording found in Twilio for call ${callId} (SID: ${callRecord.twilioSid})`);
            }
          } catch (recordingError: any) {
            console.error(`❌ [Auto Recovery] Failed to fetch recording from Twilio:`, recordingError.message);
          }
        } else if (callRecord && !callRecord.twilioSid) {
          console.warn(`⚠️ [Auto Recovery] Call ${callId} has no Twilio SID - cannot fetch recording`);
        }
      } catch (error: any) {
        console.error(`❌ [Auto Recovery] Error during automatic recording recovery:`, error.message);
      }
    }

    if (['completed', 'failed', 'busy', 'no-answer'].includes(CallStatus)) {
      await updateCampaignStats(callId as string, CallStatus);
      
      const ws = activeConnections.get(callId as string);
      if (ws) {
        ws.close();
        activeConnections.delete(callId as string);
      }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Status webhook error:', error);
    res.status(500).send('Internal server error');
  }
}

export async function handleTwilioRecordingWebhook(req: Request, res: Response) {
  try {
    console.log(`📼 [Recording Webhook] Received request`);
    console.log(`   Query params:`, req.query);
    console.log(`   Body:`, req.body);
    
    const { callId } = req.query;
    const { RecordingUrl, RecordingDuration, RecordingSid, RecordingStatus } = req.body;
    
    if (!callId) {
      console.error(`❌ [Recording Webhook] Missing call ID in query params`);
      // Still return 200 to prevent Twilio retries
      return res.sendStatus(200);
    }
    
    // Twilio sends multiple callbacks for different recording statuses
    // Only process when status is 'completed' and we have a RecordingUrl
    if (RecordingStatus !== 'completed') {
      console.log(`⏳ [Recording Webhook] Status: ${RecordingStatus} (waiting for 'completed')`);
      return res.sendStatus(200);
    }
    
    if (!RecordingUrl) {
      console.error(`❌ [Recording Webhook] Status is 'completed' but RecordingUrl is missing`);
      // Still return 200 to prevent Twilio retries
      return res.sendStatus(200);
    }

    console.log(`💾 [Recording Webhook] Updating call ${callId}`);
    console.log(`   RecordingUrl: ${RecordingUrl}`);
    console.log(`   RecordingSid: ${RecordingSid}`);
    console.log(`   RecordingDuration: ${RecordingDuration}`);
    console.log(`   RecordingStatus: ${RecordingStatus}`);

    await db
      .update(calls)
      .set({ 
        recordingUrl: RecordingUrl,
        duration: RecordingDuration ? parseInt(RecordingDuration, 10) : undefined
      })
      .where(eq(calls.id, callId as string));

    console.log(`✅ [Recording Webhook] Successfully saved recording for call ${callId}`);

    res.sendStatus(200);
  } catch (error) {
    console.error('❌ [Recording Webhook] Error:', error);
    // Always return 200 even on error to prevent Twilio retries
    res.sendStatus(200);
  }
}

export async function handleTwilioStreamWebSocket(ws: WebSocket, req: Request) {
  console.log(`[Stream] WebSocket connection established, waiting for Twilio start message...`);

  let callId: string | null = null;
  let agentId: string | null = null;
  let streamSid: string | null = null;
  let twilioCallSid: string | null = null;
  let elevenLabsWs: WebSocket | null = null;
  let mediaPacketCount = 0;
  const silenceTimerRef = { current: null as NodeJS.Timeout | null };
  
  // Flow execution context (optional)
  let flowId: string | null = null;
  let executionId: string | null = null;
  let flowBridge: any | null = null; // FlowExecutionBridge instance
  let fromPhoneNumber: string | null = null; // Originating phone number for transfers
  
  const conversationHistory: Array<{ role: 'user' | 'agent', text: string, timestamp: Date }> = [];
  
  const endCall = async (reason: string) => {
    // Clear any pending silence timer to prevent stale timeouts
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    await endTwilioCall(twilioCallSid, reason);
  };

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      switch (data.event) {
        case 'start':
          streamSid = data.start.streamSid;
          twilioCallSid = data.start.callSid;
          const customParams = data.start.customParameters || {};
          callId = customParams.callId;
          agentId = customParams.agentId;
          const contactName = customParams.contactName;
          flowId = customParams.flowId || null;
          executionId = customParams.executionId || null;
          fromPhoneNumber = customParams.fromPhone || null;
          
          console.log(`✅ [Twilio] Media stream started`);
          console.log(`   StreamSid: ${streamSid}`);
          console.log(`   Twilio CallSid: ${twilioCallSid}`);
          console.log(`   CallId: ${callId}`);
          console.log(`   AgentId: ${agentId}`);
          console.log(`   Contact Name: ${contactName || 'N/A'}`);
          console.log(`   From Phone: ${fromPhoneNumber || 'N/A'}`);
          if (flowId) {
            console.log(`   🔀 Flow Mode Enabled`);
            console.log(`   Flow ID: ${flowId}`);
            console.log(`   Execution ID: ${executionId}`);
          }
          console.log(`   Custom parameters:`, JSON.stringify(customParams, null, 2));
          
          if (!callId || !agentId) {
            console.error('[Stream] Missing required parameters in start message');
            ws.close(1002, 'Missing parameters');
            return;
          }

          // Start call recording via Twilio REST API
          // Note: Recording cannot be enabled via TwiML when using <Connect><Stream>
          if (twilioCallSid) {
            try {
              const twilioClient = await getTwilioClient();
              const domain = getDomain(req.headers.host as string);
              const recordingCallbackUrl = `${domain}/api/webhooks/twilio/recording?callId=${callId}`;
              
              console.log(`📼 [Recording] Starting recording for call ${twilioCallSid}`);
              console.log(`   Recording callback URL: ${recordingCallbackUrl}`);
              
              await twilioClient.calls(twilioCallSid)
                .recordings
                .create({
                  recordingStatusCallback: recordingCallbackUrl,
                  recordingStatusCallbackMethod: 'POST',
                  recordingStatusCallbackEvent: ['completed'],
                });
                
              console.log(`✅ [Recording] Recording started successfully`);
            } catch (recordingError) {
              // Don't fail the call if recording fails - just log the error
              console.error(`❌ [Recording] Failed to start recording:`, recordingError);
            }
          } else {
            console.warn(`⚠️ [Recording] Cannot start recording - no Twilio CallSid available`);
          }

          try {
            activeConnections.set(callId, ws);
            
            // Flow Agents now execute entirely through ElevenLabs with compiled workflows
            // No need for FlowExecutionBridge - ElevenLabs handles the workflow execution
            if (flowId && executionId) {
              console.log(`🔄 [Flow Agent] Using ElevenLabs workflow execution`);
              console.log(`   Flow ID: ${flowId}`);
              console.log(`   Execution ID: ${executionId}`);
            }
            
            elevenLabsWs = await initializeElevenLabsConnection(
              agentId,
              callId,
              contactName,
              streamSid,
              ws,
              conversationHistory,
              silenceTimerRef,
              endCall,
              null  // Flow bridge no longer used - ElevenLabs handles workflow execution
            );
          } catch (error) {
            console.error(`[Stream] Error initializing ElevenLabs connection:`, error);
            ws.close();
          }
          break;
          
        case 'media':
          mediaPacketCount++;
          if (mediaPacketCount % 50 === 0) {
            console.log(`🎤 [Twilio→ElevenLabs] Sent ${mediaPacketCount} audio packets`);
          }
          
          if (elevenLabsWs && elevenLabsWs.readyState === WebSocket.OPEN && data.media?.payload) {
            const audioMessage = {
              user_audio_chunk: data.media.payload,
            };
            elevenLabsWs.send(JSON.stringify(audioMessage));
          }
          break;
          
        case 'stop':
          console.log(`🛑 [Twilio] Media stream stopped for call ${callId}`);
          console.log(`[Twilio] Total media packets received: ${mediaPacketCount}`);
          if (elevenLabsWs) {
            elevenLabsWs.close();
          }
          break;
          
        default:
          console.log(`❓ [Twilio] Received unhandled event: ${data.event}`);
      }
    } catch (error) {
      console.error(`❌ [Twilio] Error processing message for call ${callId}:`, error);
    }
  });

  ws.on('close', async () => {
    console.log(`[Twilio] WebSocket closed for call ${callId}`);
    console.log(`[Twilio] Conversation history length: ${conversationHistory.length}`);
    console.log(`[Twilio] CallId present: ${!!callId}`);
    
    await formatAndSaveTranscript(callId, conversationHistory);
    
    if (elevenLabsWs) {
      elevenLabsWs.close();
    }
    if (callId) {
      activeConnections.delete(callId);
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
  });

  ws.on('error', (error) => {
    console.error(`[Twilio] WebSocket error for call ${callId}:`, error);
    if (elevenLabsWs) {
      elevenLabsWs.close();
    }
  });
}

// ============================================
// FLOW-BASED EXECUTION WEBHOOKS (DEPRECATED)
// Flow Agents now execute entirely through ElevenLabs
// These stubs are kept for backward compatibility
// ============================================

import { flowExecutions, FlowNode, ConditionNodeConfig } from '@shared/schema';

const FLOW_DEPRECATED_MESSAGE = 'Flow execution via TwiML webhooks is deprecated. Flow Agents now execute entirely through ElevenLabs. Please update your agent configuration.';

/**
 * DEPRECATED: Flow webhook handlers
 * Flow Agents now execute entirely through ElevenLabs using compiled workflows.
 * These handlers return deprecation notices for any legacy calls.
 */

function generateDeprecationTwiML(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${FLOW_DEPRECATED_MESSAGE}</Say>
  <Hangup/>
</Response>`;
}

/**
 * Initial webhook when flow-based call is answered (DEPRECATED)
 */
export async function handleFlowVoiceAnswer(req: Request, res: Response) {
  console.warn(`⚠️ [Flow Answer] DEPRECATED: ${FLOW_DEPRECATED_MESSAGE}`);
  res.type('text/xml').send(generateDeprecationTwiML());
}

/**
 * Serve TwiML for a specific node (DEPRECATED)
 */
export async function handleFlowNode(req: Request, res: Response) {
  console.warn(`⚠️ [Flow Node] DEPRECATED: ${FLOW_DEPRECATED_MESSAGE}`);
  res.type('text/xml').send(generateDeprecationTwiML());
}

/**
 * Handle user response from Question nodes (DEPRECATED)
 */
export async function handleFlowGather(req: Request, res: Response) {
  console.warn(`⚠️ [Flow Gather] DEPRECATED: ${FLOW_DEPRECATED_MESSAGE}`);
  res.type('text/xml').send(generateDeprecationTwiML());
}

/**
 * Continue to next node after Message/Delay (DEPRECATED)
 */
export async function handleFlowContinue(req: Request, res: Response) {
  console.warn(`⚠️ [Flow Continue] DEPRECATED: ${FLOW_DEPRECATED_MESSAGE}`);
  res.type('text/xml').send(generateDeprecationTwiML());
}

/**
 * Status callback for flow-based calls
 * This one is kept functional to handle status updates for any in-progress calls
 */
export async function handleFlowStatus(req: Request, res: Response) {
  try {
    console.log(`📊 [Flow Status] Received status update`);
    console.log(`   Query params:`, req.query);
    console.log(`   Body:`, req.body);
    
    const { executionId } = req.query;
    const { CallStatus, CallDuration } = req.body;
    
    if (!executionId) {
      console.error(`❌ [Flow Status] Missing execution ID`);
      return res.sendStatus(200);
    }

    // Load execution
    const [execution] = await db
      .select()
      .from(flowExecutions)
      .where(eq(flowExecutions.id, executionId as string));

    if (!execution) {
      console.error(`❌ [Flow Status] Execution not found: ${executionId}`);
      return res.sendStatus(200);
    }

    // If call completed and execution wasn't already marked complete
    if (CallStatus === 'completed' && execution.status === 'running') {
      await db
        .update(flowExecutions)
        .set({
          status: 'completed',
          completedAt: new Date(),
        })
        .where(eq(flowExecutions.id, executionId as string));
      
      console.log(`✅ [Flow Status] Execution ${executionId} marked as completed`);
    }

    // Update call record if callId is available
    if (execution.callId && CallStatus) {
      const updateData: any = { status: CallStatus };
      if (CallStatus === 'completed' && CallDuration) {
        updateData.endedAt = new Date();
        updateData.duration = parseInt(CallDuration, 10);
      }

      await db
        .update(calls)
        .set(updateData)
        .where(eq(calls.id, execution.callId));
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('❌ [Flow Status] Error:', error);
    res.sendStatus(200);
  }
}

/**
 * Verify ElevenLabs webhook signature
 * Header format: ElevenLabs-Signature: t=<timestamp>,v0=<hash>
 * Signed payload: timestamp.request_body
 * Hash: HMAC-SHA256 with shared secret
 */
function verifyElevenLabsWebhookSignature(
  body: string,
  signatureHeader: string | undefined,
  secret: string
): { valid: boolean; error?: string } {
  if (!signatureHeader) {
    return { valid: false, error: 'Missing ElevenLabs-Signature header' };
  }

  try {
    // Parse signature header: "t=1700000000,v0=abc123..."
    // Find timestamp and v0 signature
    const parts = signatureHeader.split(',');
    let timestamp: string | undefined;
    let receivedSignature: string | undefined;
    
    for (const part of parts) {
      if (part.startsWith('t=')) {
        timestamp = part.substring(2);
      } else if (part.startsWith('v0=')) {
        receivedSignature = part; // Keep the full 'v0=hash' for comparison
      }
    }

    if (!timestamp || !receivedSignature) {
      return { valid: false, error: `Invalid signature format. Got: ${signatureHeader.substring(0, 60)}...` };
    }

    // Check timestamp freshness (within 30 minutes as per ElevenLabs docs)
    const currentTime = Math.floor(Date.now() / 1000);
    const requestTime = parseInt(timestamp, 10);
    if (requestTime < currentTime - 30 * 60) {
      return { valid: false, error: 'Request expired - timestamp too old' };
    }

    // Compute expected signature: v0= + HMAC-SHA256(timestamp.body)
    const signedPayload = `${timestamp}.${body}`;
    const expectedHash = 'v0=' + crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    if (expectedHash.length !== receivedSignature.length) {
      return { valid: false, error: 'Signature mismatch (length)' };
    }
    
    const isValid = crypto.timingSafeEqual(
      Buffer.from(expectedHash),
      Buffer.from(receivedSignature)
    );

    return { valid: isValid, error: isValid ? undefined : 'Signature mismatch' };
  } catch (err: any) {
    return { valid: false, error: `Signature verification error: ${err.message}` };
  }
}

/**
 * Get all webhook secrets from the credential pool for multi-secret verification
 * Returns unique secrets from all active credentials plus the global fallback
 */
async function getAllWebhookSecrets(): Promise<string[]> {
  const secrets: Set<string> = new Set();
  
  try {
    // Get all credential secrets from the pool
    const credentials = await db
      .select({ webhookSecret: elevenLabsCredentials.webhookSecret })
      .from(elevenLabsCredentials)
      .where(eq(elevenLabsCredentials.isActive, true));
    
    for (const cred of credentials) {
      if (cred.webhookSecret) {
        secrets.add(cred.webhookSecret);
      }
    }
    
    // Add global fallback secret
    const dbSecretSetting = await storage.getGlobalSetting('elevenlabs_hmac_secret');
    const globalSecret = (dbSecretSetting?.value as string) || process.env.ELEVENLABS_WEBHOOK_SECRET;
    if (globalSecret) {
      secrets.add(globalSecret);
    }
  } catch (err: any) {
    console.warn(`   ⚠️ Error fetching credential secrets: ${err.message}`);
    // Try global fallback
    const dbSecretSetting = await storage.getGlobalSetting('elevenlabs_hmac_secret');
    const globalSecret = (dbSecretSetting?.value as string) || process.env.ELEVENLABS_WEBHOOK_SECRET;
    if (globalSecret) {
      secrets.add(globalSecret);
    }
  }
  
  return Array.from(secrets);
}

/**
 * Verify webhook signature by trying all available secrets
 * This is secure because we verify BEFORE trusting any body data
 * Returns the matching secret if found, null otherwise
 */
async function verifyWithAllSecrets(
  rawBody: string,
  signatureHeader: string | undefined
): Promise<{ verified: boolean; matchedSecret?: string; error?: string }> {
  if (!signatureHeader) {
    return { verified: false, error: 'Missing ElevenLabs-Signature header' };
  }
  
  const allSecrets = await getAllWebhookSecrets();
  
  if (allSecrets.length === 0) {
    return { verified: false, error: 'No webhook secrets configured' };
  }
  
  console.log(`   🔐 Trying ${allSecrets.length} webhook secret(s) for verification...`);
  
  // Try each secret until one matches
  for (const secret of allSecrets) {
    const verification = verifyElevenLabsWebhookSignature(rawBody, signatureHeader, secret);
    if (verification.valid) {
      console.log(`   ✅ Signature verified with credential secret`);
      return { verified: true, matchedSecret: secret };
    }
  }
  
  return { verified: false, error: 'Signature did not match any configured secrets' };
}

/**
 * Handle ElevenLabs post-call webhook events
 * Receives notifications when calls complete via ElevenLabs native Twilio integration
 * 
 * Webhook types (per ElevenLabs docs):
 * - post_call_transcription: Contains full conversation data including transcripts, analysis results
 * - post_call_audio: Contains minimal data with base64-encoded audio
 * - call_initiation_failure: Contains information about failed call initiation attempts
 * 
 * Security: Verifies HMAC signature by trying all credential secrets
 * Multi-key pool: Each ElevenLabs API key has its own webhook secret, we verify against all
 * This approach is secure because we verify BEFORE trusting any body data
 */
export async function handleElevenLabsWebhook(req: Request, res: Response) {
  try {
    console.log(`📞 [ElevenLabs Webhook] Received event`);
    
    // Get the raw body as string for signature verification
    // Must use the actual raw body buffer, not re-stringified JSON, for HMAC to match
    const rawBody = req.rawBody ? Buffer.from(req.rawBody as Uint8Array).toString() : JSON.stringify(req.body);
    const signatureHeader = req.headers['elevenlabs-signature'] as string | undefined;
    
    // Debug: Log signature header format
    console.log(`   Signature header present: ${!!signatureHeader}`);
    if (signatureHeader) {
      console.log(`   Signature header value: ${signatureHeader.substring(0, 60)}...`);
    }
    
    // Secure verification: Try all credential secrets until one matches
    // This way we don't trust the body data until AFTER verification succeeds
    const verification = await verifyWithAllSecrets(rawBody, signatureHeader);
    
    if (!verification.verified) {
      console.warn(`⚠️ [ElevenLabs Webhook] Signature verification failed: ${verification.error}`);
      // In development, continue anyway but log the issue
      if (process.env.NODE_ENV === 'development') {
        console.log(`   ⚠️ Continuing without signature verification (development mode)`);
      } else {
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }
    } else {
      console.log(`   ✅ Signature verified`);
    }
    
    // Parse the webhook body according to ElevenLabs format
    // Standard format: { type: string, data: object, event_timestamp: number }
    // Legacy audio format: { audio: "base64..." } (WebSocket streaming webhook)
    const { type, data, event_timestamp, audio } = req.body;
    
    // DEBUG: Log the entire webhook body structure (keys only for sensitive data)
    const bodyKeys = Object.keys(req.body);
    console.log(`   Body structure: { ${bodyKeys.join(', ')} }`);
    console.log(`   Has 'type': ${!!type}`);
    console.log(`   Has 'data': ${!!data}`);
    console.log(`   Has 'audio': ${!!audio}`);
    
    // Handle legacy audio-only webhook format (WebSocket streaming)
    if (audio && !type) {
      console.log(`📞 [ElevenLabs Webhook] Received legacy audio-only webhook - skipping`);
      console.log(`   Audio data size: ~${Math.round((audio as string).length / 1024)}KB`);
      // These are streaming audio chunks, not post-call data
      return res.sendStatus(200);
    }
    
    // Log webhook type
    console.log(`   Webhook type: ${type || 'undefined'}`);
    console.log(`   Event timestamp: ${event_timestamp || 'N/A'}`);
    
    if (!type) {
      console.warn(`⚠️ [ElevenLabs Webhook] Unknown webhook format - no 'type' field`);
      console.log(`   Full body keys: ${JSON.stringify(bodyKeys)}`);
      // Don't return 400 - just log and acknowledge to prevent retries
      return res.sendStatus(200);
    }
    
    // Handle post_call_audio webhooks (contains recording URL)
    // IMPORTANT: ElevenLabs recording URLs expire quickly, so we DON'T store them
    // Instead, we fetch ElevenLabs audio on-demand during playback
    // We only store Twilio recording URLs (stable/permanent)
    if (type === 'post_call_audio') {
      console.log(`📞 [ElevenLabs Webhook] Received post_call_audio`);
      const { conversation_id: audioConvId, recording_url, audio_url, metadata: audioMetadata } = data || {};
      
      console.log(`   Conversation ID: ${audioConvId || 'N/A'}`);
      console.log(`   ElevenLabs recording present: ${recording_url || audio_url ? 'yes (not storing - expires)' : 'no'}`);
      
      // Extract call_sid from metadata for Twilio fallback
      const callSid = audioMetadata?.phone_call?.call_sid || audioMetadata?.call_sid;
      console.log(`   Call SID for Twilio: ${callSid || 'N/A'}`);
      
      if (audioConvId) {
        try {
          const [existingCall] = await db
            .select()
            .from(calls)
            .where(eq(calls.elevenLabsConversationId, audioConvId))
            .limit(1);
          
          if (existingCall) {
            // Store Twilio SID for fallback recording access
            const twilioSid = callSid || existingCall.twilioSid;
            
            // Try to get Twilio recording URL (stable/permanent) as fallback source
            let twilioRecordingUrl: string | null = null;
            if (twilioSid && !existingCall.recordingUrl) {
              console.log(`   📞 Fetching stable Twilio recording for SID: ${twilioSid}`);
              try {
                const twilioData = await twilioService.getCallDetails(twilioSid);
                if (twilioData?.recordingUrl) {
                  twilioRecordingUrl = twilioData.recordingUrl;
                  console.log(`   ✅ Got stable Twilio recording URL`);
                } else {
                  console.log(`   ⚠️ No Twilio recording available (call may not have recording enabled)`);
                }
              } catch (twilioError: any) {
                console.warn(`   ⚠️ Twilio recording fetch failed: ${twilioError.message}`);
              }
            }
            
            // Update call record with Twilio data and metadata (NOT ElevenLabs URLs)
            await db
              .update(calls)
              .set({ 
                recordingUrl: twilioRecordingUrl || existingCall.recordingUrl, // Only store Twilio URLs
                twilioSid: twilioSid,
                metadata: {
                  ...existingCall.metadata as object,
                  hasElevenLabsRecording: !!(recording_url || audio_url), // Flag that ElevenLabs has recording
                  recordingMetadataUpdatedAt: new Date().toISOString(),
                }
              })
              .where(eq(calls.id, existingCall.id));
            console.log(`   ✅ Updated call record: ${existingCall.id} (Twilio SID: ${twilioSid || 'N/A'})`);
          } else {
            console.log(`   ⚠️ No call record found for conversation: ${audioConvId}`);
          }
        } catch (audioError: any) {
          console.error(`   ❌ Error updating call record:`, audioError.message);
        }
      }
      
      await recordWebhookReceived('elevenlabs');
      return res.sendStatus(200);
    }
    
    // Handle call_initiation_failure webhooks
    if (type === 'call_initiation_failure') {
      console.log(`📞 [ElevenLabs Webhook] Call initiation failed`);
      const { agent_id, conversation_id, failure_reason, metadata: failureMetadata } = data || {};
      console.log(`   Agent ID: ${agent_id}`);
      console.log(`   Conversation ID: ${conversation_id}`);
      console.log(`   Failure reason: ${failure_reason}`);
      
      // Try to update the call record if it exists
      if (conversation_id) {
        const [callRecord] = await db
          .select()
          .from(calls)
          .where(eq(calls.elevenLabsConversationId, conversation_id))
          .limit(1);
        
        if (callRecord) {
          await db
            .update(calls)
            .set({
              status: 'failed',
              endedAt: new Date(),
              metadata: {
                ...callRecord.metadata as object,
                failureReason: failure_reason,
                failureMetadata: failureMetadata,
              }
            })
            .where(eq(calls.id, callRecord.id));
          console.log(`   Updated call ${callRecord.id} as failed`);
          
          // Trigger call.failed webhook if user is known
          if (callRecord.userId) {
            const contact = callRecord.contactId ? await storage.getContact(callRecord.contactId) : null;
            const campaign = callRecord.campaignId ? await storage.getCampaign(callRecord.campaignId) : null;
            
            webhookDeliveryService.triggerEvent(callRecord.userId, 'call.failed', {
              campaign: campaign ? { id: campaign.id, name: campaign.name, type: campaign.type } : null,
              contact: contact ? {
                id: contact.id,
                firstName: contact.firstName,
                lastName: contact.lastName,
                phone: contact.phone,
                email: contact.email,
                customFields: contact.customFields,
              } : { phone: callRecord.phoneNumber },
              call: {
                id: callRecord.id,
                status: 'failed',
                phoneNumber: callRecord.phoneNumber,
                failureReason: failure_reason,
                startedAt: callRecord.startedAt,
                endedAt: new Date(),
              }
            }, callRecord.campaignId).catch(err => {
              console.error('❌ [Webhook] Error triggering call.failed event:', err);
            });
          }
        }
      }
      await recordWebhookReceived('elevenlabs');
      return res.sendStatus(200);
    }
    
    // Handle post_call_transcription webhooks (main call completion data)
    if (type !== 'post_call_transcription') {
      console.log(`⚠️ [ElevenLabs Webhook] Unknown webhook type: ${type}`);
      return res.sendStatus(200);
    }
    
    // Extract data from post_call_transcription webhook
    const { 
      agent_id, 
      conversation_id, 
      status,
      transcript: webhookTranscript,
      metadata,
      analysis 
    } = data || {};
    
    if (!conversation_id) {
      console.warn(`⚠️ [ElevenLabs Webhook] Missing conversation_id in data`);
      return res.status(400).json({ error: 'Missing conversation_id' });
    }
    
    console.log(`   Conversation ID: ${conversation_id}`);
    console.log(`   Agent ID: ${agent_id || 'N/A'}`);
    console.log(`   Status: ${status || 'N/A'}`);
    
    // COMPREHENSIVE LOGGING: Log all webhook data for debugging
    console.log(`📋 [ElevenLabs Webhook] Full webhook data structure:`);
    console.log(`   metadata keys: ${metadata ? Object.keys(metadata).join(', ') : 'N/A'}`);
    if (metadata) {
      // Log phone_call object (where phone numbers are nested for telephony calls)
      if (metadata.phone_call) {
        console.log(`   metadata.phone_call keys: ${Object.keys(metadata.phone_call).join(', ')}`);
        console.log(`   metadata.phone_call.from: ${metadata.phone_call.from || metadata.phone_call.from_number || 'N/A'}`);
        console.log(`   metadata.phone_call.to: ${metadata.phone_call.to || metadata.phone_call.to_number || 'N/A'}`);
        console.log(`   metadata.phone_call.call_sid: ${metadata.phone_call.call_sid || metadata.phone_call.twilio_call_sid || 'N/A'}`);
      } else {
        console.log(`   metadata.phone_call: N/A (not a phone call)`);
      }
      // Log batch_call object if present
      if (metadata.batch_call) {
        console.log(`   metadata.batch_call keys: ${Object.keys(metadata.batch_call).join(', ')}`);
        console.log(`   metadata.batch_call.batch_call_id: ${metadata.batch_call.batch_call_id || 'N/A'}`);
        console.log(`   metadata.batch_call.batch_call_recipient_id: ${metadata.batch_call.batch_call_recipient_id || 'N/A'}`);
      }
      // Log external_number if present (used in batch calls)
      if (metadata.phone_call?.external_number) {
        console.log(`   metadata.phone_call.external_number: ${metadata.phone_call.external_number}`);
      }
      // Log direct fields (fallback)
      console.log(`   metadata.from_number (direct): ${metadata.from_number || 'N/A'}`);
      console.log(`   metadata.to_number (direct): ${metadata.to_number || 'N/A'}`);
      console.log(`   metadata.call_duration_secs: ${metadata.call_duration_secs || 'N/A'}`);
      console.log(`   metadata.termination_reason: ${metadata.termination_reason || 'N/A'}`);
      // Log error and warnings for debugging failed calls
      if (metadata.error) {
        console.log(`   ❌ metadata.error: ${JSON.stringify(metadata.error)}`);
      }
      if (metadata.warnings && metadata.warnings.length > 0) {
        console.log(`   ⚠️ metadata.warnings: ${JSON.stringify(metadata.warnings)}`);
      }
    }
    console.log(`   analysis keys: ${analysis ? Object.keys(analysis).join(', ') : 'N/A'}`);
    if (analysis) {
      console.log(`   analysis.call_successful: ${analysis.call_successful || 'N/A'}`);
      console.log(`   analysis.transcript_summary: ${analysis.transcript_summary ? 'present (' + analysis.transcript_summary.length + ' chars)' : 'N/A'}`);
    }
    console.log(`   transcript entries: ${webhookTranscript ? webhookTranscript.length : 0}`);
    
    // EXTRACT PHONE NUMBERS: Check all possible locations
    // Priority: phone_call object > batch_call object > direct metadata fields
    // For batch calls, external_number contains the recipient's phone number
    const extractedFromNumber = 
      metadata?.phone_call?.from || 
      metadata?.phone_call?.from_number ||
      metadata?.phone_call?.agent_number ||
      metadata?.batch_call?.from ||
      metadata?.from_number || 
      null;
    const extractedToNumber = 
      metadata?.phone_call?.to || 
      metadata?.phone_call?.to_number ||
      metadata?.phone_call?.external_number ||
      metadata?.batch_call?.to ||
      metadata?.to_number || 
      null;
    const extractedCallSid = 
      metadata?.phone_call?.call_sid ||
      metadata?.phone_call?.twilio_call_sid ||
      metadata?.call_sid ||
      null;
    
    console.log(`📱 [ElevenLabs Webhook] Extracted phone data:`);
    console.log(`   From: ${extractedFromNumber || 'N/A'}`);
    console.log(`   To: ${extractedToNumber || 'N/A'}`);
    console.log(`   CallSid: ${extractedCallSid || 'N/A'}`);
    
    // Find the call record by ElevenLabs conversation ID
    let [callRecord] = await db
      .select()
      .from(calls)
      .where(eq(calls.elevenLabsConversationId, conversation_id))
      .limit(1);
    
    // If no record found by conversation_id, try matching by phone number + agent for batch calls
    // Batch calls are pre-created with status='pending' and matching phone numbers
    if (!callRecord && agent_id) {
      console.log(`📞 [ElevenLabs Webhook] No record by conversation_id - attempting phone number match for batch calls`);
      
      // Use extracted phone number (already checked all nested locations)
      const webhookPhoneNumber = extractedToNumber || extractedFromNumber;
      
      if (webhookPhoneNumber) {
        // Find agent to get campaigns using this agent
        const [agent] = await db
          .select()
          .from(agents)
          .where(eq(agents.elevenLabsAgentId, agent_id))
          .limit(1);
        
        if (agent && (agent.type === 'natural' || agent.type === 'flow')) {
          console.log(`   Found campaign agent: ${agent.name} (${agent.type})`);
          console.log(`   Looking for pending call to: ${webhookPhoneNumber}`);
          
          // Find pending batch call record matching phone number and agent
          // This finds pre-created call records from batch job execution
          const pendingCallQuery = await db
            .select({ call: calls, campaign: campaigns })
            .from(calls)
            .leftJoin(campaigns, eq(calls.campaignId, campaigns.id))
            .where(
              and(
                eq(calls.phoneNumber, webhookPhoneNumber),
                eq(calls.status, 'pending'),
                eq(calls.callDirection, 'outgoing'),
                eq(campaigns.agentId, agent.id)
              )
            )
            .orderBy(sql`${calls.createdAt} DESC`)
            .limit(1);
          
          if (pendingCallQuery.length > 0 && pendingCallQuery[0].call) {
            callRecord = pendingCallQuery[0].call;
            console.log(`   ✅ Found matching pre-created batch call record: ${callRecord.id}`);
            
            // Update the record with conversation_id for future lookups
            await db
              .update(calls)
              .set({ elevenLabsConversationId: conversation_id })
              .where(eq(calls.id, callRecord.id));
            console.log(`   Updated call record with conversation_id: ${conversation_id}`);
          } else {
            console.log(`   No pending batch call found for ${webhookPhoneNumber}`);
          }
        }
      }
      
      // FALLBACK: Try matching by batch_call_id if phone number match failed
      // Batch calls have batchJobId stored in call record metadata
      if (!callRecord && metadata?.batch_call?.batch_call_id) {
        const batchCallId = metadata.batch_call.batch_call_id;
        console.log(`   Attempting batch_call_id match: ${batchCallId}`);
        
        // Find pending calls with matching batchJobId in metadata
        const batchCallQuery = await db
          .select()
          .from(calls)
          .where(
            and(
              eq(calls.status, 'pending'),
              eq(calls.callDirection, 'outgoing'),
              sql`${calls.metadata}->>'batchJobId' = ${batchCallId}`
            )
          )
          .orderBy(sql`${calls.createdAt} DESC`)
          .limit(10); // Get multiple to match by phone if possible
        
        if (batchCallQuery.length > 0) {
          // If we have a phone number, try to match more precisely
          const webhookPhone = extractedToNumber || extractedFromNumber;
          if (webhookPhone) {
            const exactMatch = batchCallQuery.find(c => c.phoneNumber === webhookPhone);
            if (exactMatch) {
              callRecord = exactMatch;
              console.log(`   ✅ Found batch call by batch_call_id + phone: ${callRecord.id}`);
            }
          }
          
          // If still no match, take the first pending one for this batch
          if (!callRecord) {
            callRecord = batchCallQuery[0];
            console.log(`   ✅ Found batch call by batch_call_id (first pending): ${callRecord.id}`);
          }
          
          // Update with conversation_id
          await db
            .update(calls)
            .set({ elevenLabsConversationId: conversation_id })
            .where(eq(calls.id, callRecord.id));
          console.log(`   Updated call record with conversation_id: ${conversation_id}`);
        } else {
          console.log(`   No pending calls found for batch_call_id: ${batchCallId}`);
        }
      }
    }
    
    // Update flow execution to 'running' status when call is matched
    if (callRecord) {
      try {
        const [flowExecution] = await db
          .select()
          .from(flowExecutions)
          .where(eq(flowExecutions.callId, callRecord.id))
          .limit(1);
        
        if (flowExecution && flowExecution.status === 'pending') {
          await db
            .update(flowExecutions)
            .set({
              status: 'running',
              startedAt: new Date(),
              metadata: sql`COALESCE(${flowExecutions.metadata}, '{}'::jsonb) || ${JSON.stringify({ conversationId: conversation_id })}::jsonb`,
            })
            .where(eq(flowExecutions.id, flowExecution.id));
          console.log(`🔀 [ElevenLabs Webhook] Flow execution ${flowExecution.id} started (pending -> running)`);
        }
      } catch (flowExecError: any) {
        console.warn(`⚠️ [ElevenLabs Webhook] Error updating flow execution to running:`, flowExecError.message);
      }
    }
    
    // If no call record exists, this might be an incoming call via ElevenLabs native integration
    // We need to create a call record for it - process the webhook data directly
    if (!callRecord) {
      console.log(`📞 [ElevenLabs Webhook] No existing call record - checking if this is a native incoming call or outbound campaign call`);
      
      try {
        // Find the agent by ElevenLabs agent ID
        if (agent_id) {
          const [agent] = await db
            .select()
            .from(agents)
            .where(eq(agents.elevenLabsAgentId, agent_id))
            .limit(1);
          
          // CASE 1: Outbound campaign/flow agent - create fallback record
          // This handles cases where batch call record wasn't pre-created or phone format mismatch
          if (agent && (agent.type === 'natural' || agent.type === 'flow')) {
            console.log(`   Found campaign agent: ${agent.name} (${agent.type})`);
            
            // Use extracted phone number (already checked all nested locations)
            const webhookPhoneNumber = extractedToNumber || extractedFromNumber;
            
            if (webhookPhoneNumber) {
              console.log(`   Creating fallback outbound call record for: ${webhookPhoneNumber}`);
              
              // Find a campaign using this agent
              const [campaignMatch] = await db
                .select()
                .from(campaigns)
                .where(eq(campaigns.agentId, agent.id))
                .orderBy(sql`${campaigns.startedAt} DESC NULLS LAST`)
                .limit(1);
              
              // Use sync service to get combined data
              const { callSyncService } = await import('../services/call-sync');
              const syncedData = await callSyncService.syncFromWebhook({
                conversationId: conversation_id,
                agentId: agent_id,
                transcript: webhookTranscript,
                analysis,
                metadata,
                status,
                callDurationSecs: metadata?.call_duration_secs,
              });
              
              // Create fallback call record with proper user ownership
              const [newCallRecord] = await db
                .insert(calls)
                .values({
                  userId: campaignMatch?.userId || agent.userId, // Use campaign owner or agent owner
                  campaignId: campaignMatch?.id || null,
                  contactId: null,
                  phoneNumber: syncedData.phoneNumber || webhookPhoneNumber,
                  fromNumber: extractedFromNumber || null, // Campaign phone number (caller)
                  toNumber: extractedToNumber || webhookPhoneNumber || null, // Contact phone (destination)
                  status: 'completed',
                  callDirection: 'outgoing',
                  elevenLabsConversationId: conversation_id,
                  twilioSid: extractedCallSid || null,
                  duration: syncedData.duration,
                  transcript: syncedData.transcript,
                  aiSummary: syncedData.aiSummary,
                  classification: syncedData.classification,
                  recordingUrl: syncedData.recordingUrl,
                  endedAt: new Date(),
                  metadata: {
                    ...syncedData.metadata,
                    agentName: agent.name,
                    agentType: agent.type,
                    createdFromWebhook: true,
                    fallbackRecord: true,
                  },
                })
                .returning();
              
              callRecord = newCallRecord;
              console.log(`✅ [ElevenLabs Webhook] Created fallback outbound call record: ${callRecord.id}`);
              
              // Create flow execution record for flow-based fallback calls
              if (agent.flowId) {
                try {
                  const { nanoid } = await import('nanoid');
                  const executionId = nanoid();
                  await db.insert(flowExecutions).values({
                    id: executionId,
                    callId: callRecord.id,
                    flowId: agent.flowId,
                    currentNodeId: null,
                    status: 'completed', // Fallback calls are already completed
                    variables: analysis?.data_collection || {},
                    pathTaken: [],
                    startedAt: new Date(),
                    completedAt: new Date(),
                    metadata: {
                      campaignId: campaignMatch?.id || null,
                      campaignName: campaignMatch?.name || null,
                      contactPhone: webhookPhoneNumber,
                      nativeExecution: true,
                      telephonyProvider: 'elevenlabs',
                      fallbackRecord: true,
                      conversationId: conversation_id,
                    },
                  });
                  console.log(`🔀 [ElevenLabs Webhook] Created flow execution for fallback call: ${executionId}`);
                } catch (flowExecError: any) {
                  console.warn(`⚠️ [ElevenLabs Webhook] Error creating flow execution for fallback:`, flowExecError.message);
                }
              }
            }
          }
          
          // CASE 2: Incoming agent - create new incoming call record
          if (!callRecord && agent && agent.type === 'incoming') {
            console.log(`   Found incoming agent: ${agent.name}`);
            
            // USE EXTRACTED PHONE NUMBERS (already checked all nested locations: phone_call, batch_call, direct)
            const callerPhoneNumber = extractedFromNumber;
            const calledNumber = extractedToNumber;
            
            console.log(`   Using extracted phone data - From: ${callerPhoneNumber || 'N/A'}, To: ${calledNumber || 'N/A'}`);
            
            // CRITICAL: Find the incoming connection by the CALLED phone number (to_number)
            // This ensures we link to the correct connection when an agent has multiple
            let connection = null;
            
            if (calledNumber) {
              // Look up by phone number to find the exact incoming connection
              const [matchedConnection] = await db
                .select({
                  id: incomingConnections.id,
                  phoneNumberId: incomingConnections.phoneNumberId,
                  userId: incomingConnections.userId,
                  phoneNumber: {
                    phoneNumber: phoneNumbers.phoneNumber,
                    friendlyName: phoneNumbers.friendlyName,
                  }
                })
                .from(incomingConnections)
                .leftJoin(phoneNumbers, eq(incomingConnections.phoneNumberId, phoneNumbers.id))
                .where(
                  and(
                    eq(incomingConnections.agentId, agent.id),
                    eq(phoneNumbers.phoneNumber, calledNumber)
                  )
                )
                .limit(1);
              
              connection = matchedConnection;
            }
            
            // Fallback: If no phone match, get any connection for this agent (less accurate but better than nothing)
            if (!connection) {
              const [fallbackConnection] = await db
                .select({
                  id: incomingConnections.id,
                  phoneNumberId: incomingConnections.phoneNumberId,
                  userId: incomingConnections.userId,
                  phoneNumber: {
                    phoneNumber: phoneNumbers.phoneNumber,
                    friendlyName: phoneNumbers.friendlyName,
                  }
                })
                .from(incomingConnections)
                .leftJoin(phoneNumbers, eq(incomingConnections.phoneNumberId, phoneNumbers.id))
                .where(eq(incomingConnections.agentId, agent.id))
                .limit(1);
              
              connection = fallbackConnection;
              if (connection) {
                console.warn(`   ⚠️ Using fallback connection - could not match by phone number`);
              }
            }
            
            // Use sync service to get combined data from both ElevenLabs and Twilio
            const { callSyncService } = await import('../services/call-sync');
            const syncedData = await callSyncService.syncFromWebhook({
              conversationId: conversation_id,
              agentId: agent_id,
              transcript: webhookTranscript,
              analysis,
              metadata,
              status,
              callDurationSecs: metadata?.call_duration_secs,
            });
            
            // Use synced phone number (from Twilio or ElevenLabs) - fallback to 'Unknown Caller' if not available
            const finalPhoneNumber = syncedData.phoneNumber || callerPhoneNumber || 'Unknown Caller';
            const finalCalledNumber = syncedData.calledNumber || calledNumber || connection?.phoneNumber?.phoneNumber || 'Unknown';
            
            // Create call record even if phone number is unknown - data is valuable
            // CRITICAL: Always ensure userId is populated for proper user data isolation
            // Priority: connection owner > agent owner (never null)
            const resolvedUserId = connection?.userId || agent.userId;
            if (!resolvedUserId) {
              console.warn(`   ⚠️ Cannot determine userId - call will have orphaned ownership`);
            }
            
            console.log(`   Creating incoming call record with:`);
            console.log(`     Phone: ${finalPhoneNumber}`);
            console.log(`     Called: ${finalCalledNumber}`);
            console.log(`     Duration: ${syncedData.duration || metadata?.call_duration_secs || 'N/A'}s`);
            console.log(`     Transcript: ${syncedData.transcript ? 'present' : 'N/A'}`);
            console.log(`     AI Summary: ${syncedData.aiSummary ? 'present' : 'N/A'}`);
            
            const [newCallRecord] = await db
              .insert(calls)
              .values({
                userId: resolvedUserId, // Direct user ownership for guaranteed isolation
                campaignId: null,
                contactId: null,
                incomingConnectionId: connection?.id || null,
                incomingAgentId: null,
                phoneNumber: finalPhoneNumber,
                fromNumber: finalPhoneNumber, // Caller's phone number
                toNumber: finalCalledNumber, // The number that was called (your phone number)
                status: 'completed',
                callDirection: 'incoming',
                elevenLabsConversationId: conversation_id,
                twilioSid: extractedCallSid || null,
                duration: syncedData.duration || metadata?.call_duration_secs || null,
                transcript: syncedData.transcript,
                aiSummary: syncedData.aiSummary,
                classification: syncedData.classification,
                recordingUrl: syncedData.recordingUrl,
                endedAt: new Date(),
                metadata: {
                  ...syncedData.metadata,
                  incomingAgentName: agent.name,
                  calledNumber: finalCalledNumber,
                  agentType: 'incoming',
                  createdFromWebhook: true,
                  connectionMatched: !!connection && !!calledNumber,
                  webhookMetadata: metadata, // Store full webhook metadata for debugging
                },
              })
              .returning();
            
            callRecord = newCallRecord;
            console.log(`✅ [ElevenLabs Webhook] Created incoming call record: ${callRecord.id}`);
          }
        }
      } catch (createError: any) {
        console.error(`❌ [ElevenLabs Webhook] Error creating incoming call record:`, createError);
      }
    }
    
    if (!callRecord) {
      console.warn(`⚠️ [ElevenLabs Webhook] No call record found for conversation: ${conversation_id}`);
      // Still return 200 to prevent webhook retries
      return res.sendStatus(200);
    }
    
    console.log(`   Found call record: ${callRecord.id}`);
    
    // Process the post_call_transcription webhook data using unified sync service
    console.log(`📞 [ElevenLabs Webhook] Processing post_call_transcription with unified sync`);
    
    try {
      // Use sync service to get combined data from both ElevenLabs and Twilio
      const { callSyncService } = await import('../services/call-sync');
      const syncedData = await callSyncService.syncFromWebhook({
        conversationId: conversation_id,
        agentId: agent_id,
        transcript: webhookTranscript,
        analysis,
        metadata,
        status,
        callDurationSecs: metadata?.call_duration_secs,
      });
      
      // Update call record with synced data from both sources
      const updates: Record<string, any> = {
        status: 'completed',
        endedAt: new Date(),
        metadata: {
          ...callRecord.metadata as object,
          ...syncedData.metadata,
          webhookProcessed: true,
        }
      };
      
      // Only update fields if they have new values
      if (syncedData.duration && !callRecord.duration) {
        updates.duration = syncedData.duration;
      }
      if (syncedData.transcript && !callRecord.transcript) {
        updates.transcript = syncedData.transcript;
      }
      if (syncedData.aiSummary && !callRecord.aiSummary) {
        updates.aiSummary = syncedData.aiSummary;
      }
      if (syncedData.classification && !callRecord.classification) {
        updates.classification = syncedData.classification;
      }
      if (syncedData.recordingUrl && !callRecord.recordingUrl) {
        updates.recordingUrl = syncedData.recordingUrl;
      }
      // Update phone number if missing and we got it from Twilio
      if (syncedData.phoneNumber && (!callRecord.phoneNumber || callRecord.phoneNumber === 'Unknown')) {
        updates.phoneNumber = syncedData.phoneNumber;
      }
      // Store Twilio SID if available
      if (metadata?.call_sid && !callRecord.twilioSid) {
        updates.twilioSid = metadata.call_sid;
      }
      
      await db
        .update(calls)
        .set(updates)
        .where(eq(calls.id, callRecord.id));
      
      console.log(`✅ [ElevenLabs Webhook] Updated call record with synced data: ${callRecord.id}`);
      
      // Check if any appointments were booked during this call and link them
      // This handles the case where appointment is booked during call but call record
      // doesn't exist yet when the appointment webhook fires
      try {
        const callPhone = syncedData.phoneNumber || callRecord.phoneNumber;
        if (callPhone && agent_id && callRecord.userId) {
          // Helper to normalize phone for comparison (last 10 digits)
          const normalizePhone = (phone: string | null | undefined): string | null => {
            if (!phone) return null;
            const digits = phone.replace(/[^0-9]/g, '');
            if (digits.length < 6) return null;
            return digits.slice(-10);
          };
          
          const normalizedCallPhone = normalizePhone(callPhone);
          
          // Get the database agent ID from the ElevenLabs agent ID
          const [agentRecord] = await db
            .select({ id: agents.id })
            .from(agents)
            .where(eq(agents.elevenLabsAgentId, agent_id))
            .limit(1);
          
          // Look for appointments created in the last 10 minutes for this user
          // that haven't been linked to a call yet
          const recentAppointments = await db
            .select()
            .from(appointments)
            .where(and(
              eq(appointments.userId, callRecord.userId),
              sql`${appointments.callId} IS NULL`,
              sql`${appointments.createdAt} > NOW() - INTERVAL '10 minutes'`
            ));
          
          console.log(`📅 [ElevenLabs Webhook] Checking ${recentAppointments.length} recent appointments for linking to call ${callRecord.id}`);
          
          for (const appointment of recentAppointments) {
            // Match by normalized phone number (last 10 digits)
            // This handles cases where AI might transcribe phone slightly differently
            const appointmentPhone = normalizePhone(appointment.contactPhone);
            const phoneMatches = appointmentPhone && normalizedCallPhone && appointmentPhone === normalizedCallPhone;
            
            // Also accept fuzzy match: if 9 of 10 digits match (allows for 1 transcription error)
            const fuzzyPhoneMatch = appointmentPhone && normalizedCallPhone && 
              appointmentPhone.length === 10 && normalizedCallPhone.length === 10 &&
              appointmentPhone.split('').filter((d, i) => d === normalizedCallPhone[i]).length >= 9;
            
            if (phoneMatches || fuzzyPhoneMatch) {
              console.log(`📅 [ElevenLabs Webhook] Found appointment ${appointment.id} booked during call - linking and updating metadata`);
              console.log(`   Phone match: exact=${phoneMatches}, fuzzy=${fuzzyPhoneMatch}`);
              console.log(`   Call phone: ${normalizedCallPhone}, Appointment phone: ${appointmentPhone}`);
              
              // Link appointment to this call
              await db
                .update(appointments)
                .set({ callId: callRecord.id })
                .where(eq(appointments.id, appointment.id));
              
              // Update call metadata to indicate appointment was booked (deep merge)
              const existingMetadata = (callRecord.metadata as Record<string, unknown>) || {};
              const existingAiInsights = (existingMetadata.aiInsights as Record<string, unknown>) || {};
              
              const appointmentMetadata = {
                ...existingMetadata,
                appointmentBooked: true,
                hasAppointment: true,
                appointmentData: {
                  appointmentId: appointment.id,
                  contactName: appointment.contactName,
                  contactPhone: appointment.contactPhone,
                  date: appointment.appointmentDate,
                  time: appointment.appointmentTime,
                  bookedAt: appointment.createdAt?.toISOString(),
                },
                aiInsights: {
                  ...existingAiInsights,
                  primaryOutcome: 'appointment_booked',
                  appointmentBooked: true,
                },
              };
              
              await db
                .update(calls)
                .set({ metadata: appointmentMetadata })
                .where(eq(calls.id, callRecord.id));
              
              // Update our local reference so CRM processor sees the updated metadata
              callRecord.metadata = appointmentMetadata;
              
              console.log(`✅ [ElevenLabs Webhook] Linked appointment ${appointment.id} to call ${callRecord.id}`);
              break; // Only link one appointment per call
            }
          }
        }
      } catch (appointmentLinkError: any) {
        console.error(`⚠️ [ElevenLabs Webhook] Error checking for appointments:`, appointmentLinkError.message);
        // Don't fail the webhook - this is a non-critical enhancement
      }
      
      // Run violation detection in the background (don't await to avoid slowing webhook response)
      const transcriptToScan = syncedData.transcript || callRecord.transcript;
      if (transcriptToScan && callRecord.userId) {
        // Run both banned word detection and AI analysis in background
        Promise.all([
          import('../services/violation-detection').then(({ detectViolations }) =>
            detectViolations(callRecord.id, callRecord.userId!, transcriptToScan)
          ),
          import('../services/ai-violation-detection').then(({ analyzeTranscriptWithAI }) =>
            analyzeTranscriptWithAI(callRecord.id, callRecord.userId!, transcriptToScan)
          )
        ]).then(([bannedWordViolations, aiViolations]) => {
          const totalViolations = bannedWordViolations.length + aiViolations.length;
          if (totalViolations > 0) {
            console.log(`🔍 [Violation Detection] Call ${callRecord.id}: ${bannedWordViolations.length} banned word + ${aiViolations.length} AI violations detected`);
          }
        }).catch((err) => {
          console.error(`❌ [Violation Detection] Error scanning call ${callRecord.id}:`, err.message);
        });
      }
      
      // CRITICAL: Deduct credits for the completed call
      const callDuration = syncedData.duration || metadata?.call_duration_secs || 0;
      if (callDuration > 0) {
        try {
          const creditResult = await deductCallCreditsForElevenLabs(callRecord.id, callDuration);
          
          if (creditResult.success || creditResult.alreadyDeducted) {
            console.log(`💳 [ElevenLabs Webhook] Credit deduction processed for call: ${callRecord.id}`);
            
            // Process call for CRM lead creation (run in background)
            import('../engines/crm/lead-processor.service').then(({ CRMLeadProcessor }) => {
              CRMLeadProcessor.processElevenLabsTwilioCall(callRecord.id)
                .then((result) => {
                  if (result?.leadId) {
                    console.log(`📋 [CRM] Lead created from call ${callRecord.id}: ${result.leadId} (${result.qualification.category})`);
                  } else if (result) {
                    console.log(`📋 [CRM] Call ${callRecord.id} did not qualify for CRM lead`);
                  }
                })
                .catch((err) => {
                  console.error(`❌ [CRM] Error processing call ${callRecord.id} for lead:`, err.message);
                });
            }).catch((err) => {
              console.error(`❌ [CRM] Failed to import lead processor:`, err.message);
            });
          } else {
            console.error(`❌ [ElevenLabs Webhook] Credit deduction failed for call ${callRecord.id}: ${creditResult.error}`);
            
            // Mark call as failed due to insufficient credits
            await db.update(calls)
              .set({ 
                status: 'failed',
                metadata: sql`COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify({ creditDeductionFailed: true, creditError: creditResult.error })}`
              })
              .where(eq(calls.id, callRecord.id));
            
            console.warn(`⚠️ [ElevenLabs Webhook] Call ${callRecord.id} marked as failed due to credit deduction failure`);
            
            // CRITICAL: Stop all downstream processing when credits fail
            return res.status(200).json({ 
              success: false, 
              error: 'Credit deduction failed',
              callId: callRecord.id 
            });
          }
        } catch (creditError: any) {
          console.error(`❌ [ElevenLabs Webhook] Credit deduction error:`, creditError.message);
        }
      } else {
        console.log(`⚠️ [ElevenLabs Webhook] Skipping credit deduction - no duration available`);
      }
      
      // Update flow execution status if one exists for this call
      try {
        const [flowExecution] = await db
          .select()
          .from(flowExecutions)
          .where(eq(flowExecutions.callId, callRecord.id))
          .limit(1);
        
        if (flowExecution) {
          // Extract collected variables from transcript analysis if available
          let collectedVariables = flowExecution.variables as Record<string, any> || {};
          
          // Try to extract variables from data_collection (ElevenLabs primary field)
          if (analysis?.data_collection && typeof analysis.data_collection === 'object') {
            collectedVariables = {
              ...collectedVariables,
              ...analysis.data_collection
            };
          }
          
          // Try to extract variables from data_collection_results if present (alternate field)
          if (analysis?.data_collection_results && typeof analysis.data_collection_results === 'object') {
            collectedVariables = {
              ...collectedVariables,
              ...analysis.data_collection_results
            };
          }
          
          // Try to extract variables from call_successful_data_collection if present
          if (analysis?.call_successful_data_collection && typeof analysis.call_successful_data_collection === 'object') {
            collectedVariables = {
              ...collectedVariables,
              ...analysis.call_successful_data_collection
            };
          }
          
          // Also check for collected_data at root level of webhook payload
          if (data?.collected_data && typeof data.collected_data === 'object') {
            collectedVariables = {
              ...collectedVariables,
              ...data.collected_data
            };
          }
          
          // Determine status based on call outcome
          let executionStatus = 'completed';
          let executionError: string | null = null;
          
          // Check if call was successful or failed
          if (analysis?.call_successful === false) {
            executionStatus = 'failed';
            executionError = analysis?.error_message || 'Call did not complete successfully';
          }
          
          // Update flow execution with collected data
          // Note: pathTaken is NOT updated - ElevenLabs runs flows natively and doesn't provide step-by-step path data
          // The path can only be reliably tracked when we control the flow execution (not implemented)
          await db
            .update(flowExecutions)
            .set({
              status: executionStatus,
              completedAt: new Date(),
              variables: collectedVariables,
              error: executionError,
              metadata: {
                ...(flowExecution.metadata as object || {}),
                callDuration: syncedData.duration || metadata?.call_duration_secs,
                callSuccessful: analysis?.call_successful,
                conversationId: callRecord.elevenLabsConversationId,
              },
            })
            .where(eq(flowExecutions.id, flowExecution.id));
          
          console.log(`✅ [ElevenLabs Webhook] Updated flow execution: ${flowExecution.id} -> ${executionStatus}`);
        }
      } catch (flowExecError: any) {
        console.error(`⚠️ [ElevenLabs Webhook] Error updating flow execution:`, flowExecError.message);
      }
      
    } catch (syncError: any) {
      console.error(`❌ [ElevenLabs Webhook] Error syncing call data:`, syncError);
      
      // Still update the call as completed even if sync failed
      await db
        .update(calls)
        .set({
          status: 'completed',
          endedAt: new Date(),
          metadata: {
            ...callRecord.metadata as object,
            webhookProcessingError: syncError.message,
          }
        })
        .where(eq(calls.id, callRecord.id));
    }
    
    await recordWebhookReceived('elevenlabs');
    res.sendStatus(200);
  } catch (error) {
    console.error('❌ [ElevenLabs Webhook] Error:', error);
    // Return 200 to prevent webhook retries
    res.sendStatus(200);
  }
}

/**
 * Fetch conversation details from ElevenLabs for a specific call
 * API endpoint for manual refresh or on-demand fetch
 */
export async function fetchElevenLabsConversation(req: Request, res: Response) {
  try {
    const { callId } = req.params;
    
    if (!callId) {
      return res.status(400).json({ error: 'Call ID is required' });
    }
    
    // Get call record
    const [callRecord] = await db
      .select()
      .from(calls)
      .where(eq(calls.id, callId))
      .limit(1);
    
    if (!callRecord) {
      return res.status(404).json({ error: 'Call not found' });
    }
    
    if (!callRecord.elevenLabsConversationId) {
      return res.status(400).json({ error: 'Call does not have an ElevenLabs conversation ID' });
    }
    
    console.log(`📞 [Fetch Conversation] Fetching details for call: ${callId}`);
    console.log(`   Conversation ID: ${callRecord.elevenLabsConversationId}`);
    
    // Find the agent and credential for this call
    let agentElevenLabsService: ElevenLabsService = elevenLabsService;
    
    if (callRecord.campaignId) {
      const [campaign] = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, callRecord.campaignId))
        .limit(1);
      
      if (campaign?.agentId) {
        const [agent] = await db
          .select()
          .from(agents)
          .where(eq(agents.id, campaign.agentId))
          .limit(1);
        
        if (agent?.elevenLabsCredentialId) {
          const credential = await ElevenLabsPoolService.getCredentialById(agent.elevenLabsCredentialId);
          if (credential) {
            agentElevenLabsService = new ElevenLabsService(credential.apiKey);
          }
        }
      }
    }
    
    // Fetch conversation details
    const conversationDetails = await agentElevenLabsService.getConversationDetails(
      callRecord.elevenLabsConversationId
    );
    
    // Format transcript
    const transcriptText = conversationDetails.transcript?.map(entry => 
      `${entry.role.toUpperCase()} (${entry.time_in_call_secs}s): ${entry.message}`
    ).join('\n') || '';
    
    // Update call record
    await db
      .update(calls)
      .set({
        duration: conversationDetails.call_duration_secs || callRecord.duration,
        transcript: transcriptText || callRecord.transcript,
        aiSummary: conversationDetails.analysis?.summary || callRecord.aiSummary,
        recordingUrl: conversationDetails.recording_url || callRecord.recordingUrl,
        status: conversationDetails.status === 'done' ? 'completed' : callRecord.status,
        metadata: {
          ...callRecord.metadata as object,
          elevenLabsStatus: conversationDetails.status,
          elevenLabsAnalysis: conversationDetails.analysis,
          lastFetchedAt: new Date().toISOString(),
        }
      })
      .where(eq(calls.id, callId));
    
    console.log(`✅ [Fetch Conversation] Updated call record`);
    
    res.json({
      success: true,
      conversation: conversationDetails,
    });
  } catch (error: any) {
    console.error('❌ [Fetch Conversation] Error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch conversation' });
  }
}

/**
 * Get conversation audio/recording URL from ElevenLabs
 */
export async function getElevenLabsRecording(req: Request, res: Response) {
  try {
    const { callId } = req.params;
    
    if (!callId) {
      return res.status(400).json({ error: 'Call ID is required' });
    }
    
    // Get call record
    const [callRecord] = await db
      .select()
      .from(calls)
      .where(eq(calls.id, callId))
      .limit(1);
    
    if (!callRecord) {
      return res.status(404).json({ error: 'Call not found' });
    }
    
    // If we already have a recording URL, return it
    if (callRecord.recordingUrl) {
      return res.json({
        success: true,
        recordingUrl: callRecord.recordingUrl,
        source: 'cached',
      });
    }
    
    if (!callRecord.elevenLabsConversationId) {
      return res.status(400).json({ error: 'Call does not have an ElevenLabs conversation ID' });
    }
    
    console.log(`🎙️ [Get Recording] Fetching audio for call: ${callId}`);
    
    // Find the agent and credential
    let agentElevenLabsService: ElevenLabsService = elevenLabsService;
    
    if (callRecord.campaignId) {
      const [campaign] = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, callRecord.campaignId))
        .limit(1);
      
      if (campaign?.agentId) {
        const [agent] = await db
          .select()
          .from(agents)
          .where(eq(agents.id, campaign.agentId))
          .limit(1);
        
        if (agent?.elevenLabsCredentialId) {
          const credential = await ElevenLabsPoolService.getCredentialById(agent.elevenLabsCredentialId);
          if (credential) {
            agentElevenLabsService = new ElevenLabsService(credential.apiKey);
          }
        }
      }
    }
    
    // Try to get audio from ElevenLabs
    const audioResult = await agentElevenLabsService.getConversationAudio(
      callRecord.elevenLabsConversationId
    );
    
    if (audioResult.audioBuffer) {
      // ElevenLabs audio is available - note: we don't store URLs since they expire
      // The audio is fetched fresh each time from routes.ts recording endpoint
      res.json({
        success: true,
        hasRecording: true,
        contentType: audioResult.contentType,
        source: 'elevenlabs',
      });
    } else {
      // Try Twilio fallback if we have a call SID
      if (callRecord.twilioSid) {
        const twilioData = await twilioService.getCallDetails(callRecord.twilioSid);
        if (twilioData?.recordingUrl) {
          // Store Twilio recording URL (these don't expire)
          await db
            .update(calls)
            .set({
              recordingUrl: twilioData.recordingUrl,
            })
            .where(eq(calls.id, callId));
          
          res.json({
            success: true,
            hasRecording: true,
            recordingUrl: twilioData.recordingUrl,
            source: 'twilio',
          });
        } else {
          res.json({
            success: false,
            hasRecording: false,
            error: 'Recording not available from either source',
          });
        }
      } else {
        res.json({
          success: false,
          hasRecording: false,
          error: audioResult.error || 'Recording not available',
        });
      }
    }
  } catch (error: any) {
    console.error('❌ [Get Recording] Error:', error);
    res.status(500).json({ error: error.message || 'Failed to get recording' });
  }
}

/**
 * Appointment Booking Tool Webhook Handler
 * 
 * This endpoint is called by ElevenLabs when a Flow Agent uses the book_appointment tool.
 * It saves the appointment to the database.
 * 
 * Features:
 * - Parses natural language dates (e.g., "tomorrow", "next Monday", "Oct 3")
 * - Uses actual caller phone number from call record as verified source
 * - Stores both AI-collected and verified phone numbers for discrepancy detection
 * 
 * Security: Validates token via URL path
 * 
 * Endpoint: POST /api/webhooks/elevenlabs/appointment/:token/:elevenLabsAgentId
 */
export async function handleAppointmentToolWebhook(req: Request, res: Response) {
  const { token: urlToken, agentId: elevenLabsAgentId } = req.params;
  const { callId } = req.query;
  
  console.log(`📅 [Appointment Webhook] Received tool call for ElevenLabs agent: ${elevenLabsAgentId}`);
  
  try {
    const { validateAppointmentWebhookToken } = await import('../services/appointment-elevenlabs-tool');
    const chrono = await import('chrono-node');
    const { format, addDays } = await import('date-fns');
    
    if (!validateAppointmentWebhookToken(urlToken)) {
      console.warn(`📅 [Appointment Webhook] Invalid authentication token`);
      return res.status(401).json({
        success: false,
        error: "Unauthorized: Invalid authentication token"
      });
    }
    
    console.log(`📅 [Appointment Webhook] Authentication successful`);
    console.log(`   Request body:`, JSON.stringify(req.body, null, 2));
    
    const {
      contactName,
      contactPhone,
      contactEmail,
      appointmentDate,
      appointmentTime,
      duration,
      serviceName,
      notes
    } = req.body;
    
    // Look up agent by ElevenLabs agent ID to get database agent ID and userId
    const agent = await db
      .select({ id: agents.id, userId: agents.userId, flowId: agents.flowId })
      .from(agents)
      .where(eq(agents.elevenLabsAgentId, elevenLabsAgentId))
      .limit(1);
    
    if (agent.length === 0) {
      console.warn(`📅 [Appointment Webhook] No agent found with ElevenLabs ID ${elevenLabsAgentId}`);
      return res.json({
        success: false,
        message: "Could not find the agent to book the appointment."
      });
    }
    
    const dbAgentId = agent[0].id;
    const userId = agent[0].userId;
    const flowId = agent[0].flowId;
    
    console.log(`📅 [Appointment Webhook] Found database agent ${dbAgentId} for user ${userId}`);
    
    // Get call record to extract verified caller phone number
    // Strategy: Try explicit callId first, then use call matcher to find recent calls for this agent
    let validatedCallId: string | null = null;
    let verifiedCallerPhone: string | null = null;
    let verifiedCallerName: string | null = null;
    
    // Try explicit callId if provided (legacy support)
    if (callId) {
      const callRecord = await db
        .select({ 
          id: calls.id, 
          userId: calls.userId,
          phoneNumber: calls.phoneNumber,
          callDirection: calls.callDirection,
          contactId: calls.contactId
        })
        .from(calls)
        .where(and(
          eq(calls.id, callId as string),
          eq(calls.userId, userId)
        ))
        .limit(1);
      
      if (callRecord.length > 0) {
        validatedCallId = callRecord[0].id;
        verifiedCallerPhone = callRecord[0].phoneNumber;
        console.log(`📅 [Appointment Webhook] Found call by explicit ID: ${validatedCallId}`);
        
        if (callRecord[0].contactId) {
          const contactRecord = await db
            .select({ 
              firstName: contacts.firstName,
              lastName: contacts.lastName,
              phone: contacts.phone
            })
            .from(contacts)
            .where(eq(contacts.id, callRecord[0].contactId))
            .limit(1);
          if (contactRecord.length > 0) {
            verifiedCallerName = [contactRecord[0].firstName, contactRecord[0].lastName].filter(Boolean).join(' ');
            verifiedCallerPhone = contactRecord[0].phone || verifiedCallerPhone;
            console.log(`📅 [Appointment Webhook] Verified contact: ${verifiedCallerName} (${verifiedCallerPhone})`);
          }
        }
      }
    }
    
    // If no explicit callId, use call matcher to find recent calls for this agent/phone
    if (!validatedCallId) {
      const { findCallForWebhook } = await import('../services/call-matcher');
      const matchedCall = await findCallForWebhook(elevenLabsAgentId, contactPhone, userId);
      
      if (matchedCall) {
        validatedCallId = matchedCall.callId;
        verifiedCallerPhone = matchedCall.verifiedContactPhone || matchedCall.phoneNumber;
        verifiedCallerName = matchedCall.contactName;
        console.log(`📅 [Appointment Webhook] Matched call via call-matcher: ${validatedCallId}`);
      } else {
        console.log(`📅 [Appointment Webhook] No call match found - appointment will be saved without call link`);
      }
    }
    
    // Use verified phone from call record as primary, AI-collected as fallback
    const finalContactPhone = verifiedCallerPhone || contactPhone;
    const finalContactName = verifiedCallerName || contactName || 'Unknown Caller';
    
    if (!finalContactPhone) {
      console.warn(`📅 [Appointment Webhook] No phone number available`);
      return res.json({
        success: false,
        message: "I need the caller's phone number to book the appointment."
      });
    }
    
    if (!appointmentDate || !appointmentTime) {
      console.warn(`📅 [Appointment Webhook] Missing date/time`);
      return res.json({
        success: false,
        message: "I need both the date and time to schedule the appointment."
      });
    }
    
    // Parse natural language date using chrono-node
    let parsedDate: Date | null = null;
    let parsedTime: string = appointmentTime;
    
    // First, try to parse date as-is (might be YYYY-MM-DD already)
    const isoDateMatch = appointmentDate.match(/^\d{4}-\d{2}-\d{2}$/);
    if (isoDateMatch) {
      parsedDate = new Date(appointmentDate + 'T12:00:00');
      console.log(`📅 [Appointment Webhook] Date already in ISO format: ${appointmentDate}`);
    } else {
      // Parse natural language date (e.g., "tomorrow", "next Monday", "Oct 3")
      const dateTimeString = `${appointmentDate} ${appointmentTime}`;
      const chronoResult = chrono.parseDate(dateTimeString, new Date(), { forwardDate: true });
      
      if (chronoResult) {
        parsedDate = chronoResult;
        console.log(`📅 [Appointment Webhook] Parsed natural language date: "${appointmentDate}" -> ${parsedDate.toISOString()}`);
      } else {
        // Try parsing just the date
        const dateOnlyResult = chrono.parseDate(appointmentDate, new Date(), { forwardDate: true });
        if (dateOnlyResult) {
          parsedDate = dateOnlyResult;
          console.log(`📅 [Appointment Webhook] Parsed date only: "${appointmentDate}" -> ${parsedDate.toISOString()}`);
        }
      }
    }
    
    // If still couldn't parse, try common patterns
    if (!parsedDate) {
      // Handle common relative terms
      const lowerDate = appointmentDate.toLowerCase().trim();
      const now = new Date();
      
      if (lowerDate === 'tomorrow') {
        parsedDate = addDays(now, 1);
      } else if (lowerDate === 'today') {
        parsedDate = now;
      } else if (lowerDate === 'day after tomorrow') {
        parsedDate = addDays(now, 2);
      } else if (lowerDate.includes('next week')) {
        parsedDate = addDays(now, 7);
      }
      
      if (parsedDate) {
        console.log(`📅 [Appointment Webhook] Parsed relative date: "${appointmentDate}" -> ${parsedDate.toISOString()}`);
      }
    }
    
    if (!parsedDate) {
      console.warn(`📅 [Appointment Webhook] Could not parse date: "${appointmentDate}"`);
      return res.json({
        success: false,
        message: `I couldn't understand the date "${appointmentDate}". Please provide a specific date like "tomorrow", "December 5th", or "next Monday".`
      });
    }
    
    // Format date and time for database
    const finalDate = format(parsedDate, 'yyyy-MM-dd');
    
    // Parse time - try to extract from chrono result or use provided time
    let finalTime = '10:00'; // Default fallback
    const timeMatch = appointmentTime.match(/(\d{1,2}):?(\d{2})?\s*(am|pm|AM|PM)?/);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1], 10);
      const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      const ampm = timeMatch[3]?.toLowerCase();
      
      if (ampm === 'pm' && hours < 12) hours += 12;
      if (ampm === 'am' && hours === 12) hours = 0;
      
      finalTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    } else if (appointmentTime.match(/^\d{2}:\d{2}$/)) {
      finalTime = appointmentTime;
    }
    
    console.log(`📅 [Appointment Webhook] Final parsed date/time: ${finalDate} at ${finalTime}`);
    
    // Validate against user's working hours settings
    const [userSettings] = await db
      .select()
      .from(appointmentSettings)
      .where(eq(appointmentSettings.userId, userId));
    
    // Default working hours - used when user hasn't configured settings or individual days are missing
    const defaultWorkingHours: Record<string, { start: string; end: string; enabled: boolean }> = {
      monday: { start: "09:00", end: "17:00", enabled: true },
      tuesday: { start: "09:00", end: "17:00", enabled: true },
      wednesday: { start: "09:00", end: "17:00", enabled: true },
      thursday: { start: "09:00", end: "17:00", enabled: true },
      friday: { start: "09:00", end: "17:00", enabled: true },
      saturday: { start: "09:00", end: "17:00", enabled: false },
      sunday: { start: "09:00", end: "17:00", enabled: false },
    };
    
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
    const dayOfWeek = parsedDate.getDay();
    const dayName = dayNames[dayOfWeek];
    
    // Merge user settings with defaults per-day to handle missing keys in stored data
    const userWorkingHours = userSettings?.workingHours as Record<string, { start: string; end: string; enabled: boolean }> | undefined;
    const daySettings = userWorkingHours?.[dayName] 
      ? { ...defaultWorkingHours[dayName], ...userWorkingHours[dayName] }
      : defaultWorkingHours[dayName];
    
    console.log(`📅 [Appointment Webhook] Working hours for ${dayName}:`, daySettings);
    
    if (!daySettings?.enabled) {
      console.log(`📅 [Appointment Webhook] Rejected: ${dayName} is not available for appointments`);
      return res.json({
        success: false,
        message: `I'm sorry, but we're not available on ${dayName.charAt(0).toUpperCase() + dayName.slice(1)}s. Please choose a different day.`
      });
    }
    
    // Check if the time is within working hours (with defensive parsing)
    try {
      const parseTimeToMinutes = (timeStr: string): number => {
        const parts = timeStr.split(':');
        if (parts.length !== 2) throw new Error(`Invalid time format: ${timeStr}`);
        const hours = parseInt(parts[0], 10);
        const minutes = parseInt(parts[1], 10);
        if (isNaN(hours) || isNaN(minutes)) throw new Error(`Invalid time values: ${timeStr}`);
        return hours * 60 + minutes;
      };
      
      const requestedMinutes = parseTimeToMinutes(finalTime);
      const startMinutes = parseTimeToMinutes(daySettings.start || "09:00");
      const endMinutes = parseTimeToMinutes(daySettings.end || "17:00");
      const appointmentDuration = duration || 30;
      
      // Check if appointment START is within working hours (inclusive of end time for start)
      // and appointment END doesn't exceed working hours
      const appointmentEndMinutes = requestedMinutes + appointmentDuration;
      
      if (requestedMinutes < startMinutes || appointmentEndMinutes > endMinutes) {
        console.log(`📅 [Appointment Webhook] Rejected: ${finalTime} (duration: ${appointmentDuration}min) is outside working hours (${daySettings.start} - ${daySettings.end})`);
        return res.json({
          success: false,
          message: `I'm sorry, but ${finalTime} is outside our available hours on ${dayName.charAt(0).toUpperCase() + dayName.slice(1)}. We're available from ${daySettings.start} to ${daySettings.end}. Would you like to choose a different time?`
        });
      }
      
      console.log(`📅 [Appointment Webhook] Time validation passed: ${finalTime} is within ${daySettings.start} - ${daySettings.end}`);
    } catch (parseError: any) {
      console.error(`📅 [Appointment Webhook] Time parsing error:`, parseError.message);
      console.error(`📅 [Appointment Webhook] daySettings:`, JSON.stringify(daySettings));
      console.error(`📅 [Appointment Webhook] finalTime:`, finalTime);
      // Reject the booking with a helpful message rather than silently allowing
      return res.json({
        success: false,
        message: `I'm having trouble understanding the appointment time. Could you please specify the time again, like "2 PM" or "14:00"?`
      });
    }
    
    // Build metadata to track phone number discrepancies
    const metadata: Record<string, any> = {};
    if (contactPhone && verifiedCallerPhone && contactPhone !== verifiedCallerPhone) {
      metadata.aiCollectedPhone = contactPhone;
      metadata.verifiedPhone = verifiedCallerPhone;
      metadata.phoneDiscrepancy = true;
      console.log(`📅 [Appointment Webhook] Phone discrepancy detected:`);
      console.log(`   AI collected: ${contactPhone}`);
      console.log(`   Verified (call): ${verifiedCallerPhone}`);
    }
    if (contactName && verifiedCallerName && contactName !== verifiedCallerName) {
      metadata.aiCollectedName = contactName;
      metadata.verifiedName = verifiedCallerName;
    }
    
    const appointmentId = nanoid();
    const [newAppointment] = await db
      .insert(appointments)
      .values({
        id: appointmentId,
        userId,
        callId: validatedCallId,
        flowId: flowId || null,
        contactName: finalContactName,
        contactPhone: finalContactPhone,
        contactEmail: contactEmail || null,
        appointmentDate: finalDate,
        appointmentTime: finalTime,
        duration: duration || 30,
        serviceName: serviceName || null,
        notes: notes || null,
        status: "scheduled",
        metadata: Object.keys(metadata).length > 0 ? metadata : null,
      })
      .returning();
    
    console.log(`📅 [Appointment Webhook] Created appointment ${appointmentId}`);
    console.log(`   Contact: ${finalContactName} (${finalContactPhone})`);
    console.log(`   Date/Time: ${finalDate} at ${finalTime}`);
    
    // Trigger appointment.booked webhook event
    try {
      await webhookDeliveryService.triggerEvent(userId, 'appointment.booked', {
        appointment: {
          id: appointmentId,
          contactName: finalContactName,
          contactPhone: finalContactPhone,
          contactEmail: contactEmail || null,
          date: finalDate,
          time: finalTime,
          duration: duration || 30,
          serviceName: serviceName || null,
          notes: notes || null,
          status: 'scheduled',
          createdAt: new Date().toISOString(),
        },
        call: {
          id: validatedCallId || null,
        },
        flow: {
          id: flowId || null,
        },
      });
      console.log(`📅 [Appointment Webhook] Triggered appointment.booked webhook event`);
    } catch (webhookError: any) {
      console.error(`📅 [Appointment Webhook] Failed to trigger webhook:`, webhookError.message);
    }
    
    // Update call metadata for CRM Lead Processor detection
    if (validatedCallId) {
      try {
        const [existingCall] = await db
          .select()
          .from(calls)
          .where(eq(calls.id, validatedCallId))
          .limit(1);
        
        if (existingCall) {
          const existingMetadata = (existingCall.metadata as Record<string, unknown>) || {};
          const existingAiInsights = (existingMetadata.aiInsights as Record<string, unknown>) || {};
          
          const updatedMetadata = {
            ...existingMetadata,
            appointmentBooked: true,
            hasAppointment: true,
            appointmentData: {
              appointmentId,
              contactName: finalContactName,
              contactPhone: finalContactPhone,
              date: finalDate,
              time: finalTime,
              bookedAt: new Date().toISOString(),
            },
            aiInsights: {
              ...existingAiInsights,
              primaryOutcome: 'appointment_booked',
              appointmentBooked: true,
            },
          };
          
          await db
            .update(calls)
            .set({ metadata: updatedMetadata })
            .where(eq(calls.id, validatedCallId));
          
          console.log(`📅 [Appointment Webhook] Updated call metadata for CRM detection`);
        }
      } catch (metadataError: any) {
        console.error(`📅 [Appointment Webhook] Failed to update call metadata:`, metadataError.message);
      }
    }
    
    // Format response date for human readability
    const readableDate = format(parsedDate, 'EEEE, MMMM d, yyyy');
    const readableTime = format(new Date(`2000-01-01T${finalTime}`), 'h:mm a');
    
    return res.json({
      success: true,
      message: `Great! I've booked your appointment for ${readableDate} at ${readableTime}. You'll receive a confirmation shortly.`,
      appointmentId: appointmentId
    });
    
  } catch (error: any) {
    console.error(`❌ [Appointment Webhook] Error:`, error.message);
    return res.json({
      success: false,
      message: "I encountered an error while booking the appointment. Please try again."
    });
  }
}

/**
 * Form Submission Tool Webhook Handler
 * 
 * This endpoint is called by ElevenLabs when a Flow Agent uses the submit_form tool.
 * It saves the form submission to the database.
 * 
 * Security: Validates token via URL path
 * 
 * Endpoint: POST /api/webhooks/elevenlabs/form/:token/:formId/:elevenLabsAgentId
 */
export async function handleFormSubmissionWebhook(req: Request, res: Response) {
  const { token: urlToken, formId, agentId: elevenLabsAgentId } = req.params;
  const { callId } = req.query;
  
  console.log(`📋 [Form Webhook] Received submission for form: ${formId}, agent: ${elevenLabsAgentId}`);
  
  try {
    const { validateFormWebhookToken } = await import('../services/form-elevenlabs-tool');
    const { formSubmissions, forms, formFields } = await import('../../shared/schema');
    
    if (!validateFormWebhookToken(urlToken)) {
      console.warn(`📋 [Form Webhook] Invalid authentication token`);
      return res.status(401).json({
        success: false,
        error: "Unauthorized: Invalid authentication token"
      });
    }
    
    console.log(`📋 [Form Webhook] Authentication successful`);
    console.log(`   Request body:`, JSON.stringify(req.body, null, 2));
    
    const { contactName, contactPhone, ...fieldResponses } = req.body;
    
    // Look up agent by ElevenLabs agent ID to get database agent ID and userId
    const agent = await db
      .select({ id: agents.id, userId: agents.userId, flowId: agents.flowId })
      .from(agents)
      .where(eq(agents.elevenLabsAgentId, elevenLabsAgentId))
      .limit(1);
    
    if (agent.length === 0) {
      console.warn(`📋 [Form Webhook] No agent found with ElevenLabs ID ${elevenLabsAgentId}`);
      return res.json({
        success: false,
        message: "Could not find the agent to submit the form."
      });
    }
    
    const userId = agent[0].userId;
    // Note: agent.flowId is the flow template ID, not a flow execution ID
    // We set flowExecutionId to null since we don't have the execution ID in webhook context
    // The callId still provides traceability to the specific call
    
    console.log(`📋 [Form Webhook] Found database agent for user ${userId}`);
    
    // Verify form exists and belongs to user
    const [form] = await db
      .select()
      .from(forms)
      .where(and(eq(forms.id, formId), eq(forms.userId, userId)))
      .limit(1);
    
    if (!form) {
      console.warn(`📋 [Form Webhook] Form ${formId} not found for user ${userId}`);
      return res.json({
        success: false,
        message: "Could not find the form to submit."
      });
    }
    
    // Get form fields for response mapping
    const fields = await db
      .select()
      .from(formFields)
      .where(eq(formFields.formId, formId))
      .orderBy(formFields.order);
    
    // Build responses array from field responses
    // Import sanitizeFieldId to match the field keys used in the webhook schema
    const { sanitizeFieldId } = await import('../services/form-elevenlabs-tool');
    const responses: { fieldId: string; question: string; answer: string }[] = [];
    
    for (const field of fields) {
      // Use sanitized field ID to match the webhook schema (hyphens → underscores)
      const fieldKey = `field_${sanitizeFieldId(field.id)}`;
      if (fieldResponses[fieldKey] !== undefined) {
        responses.push({
          fieldId: field.id,
          question: field.question,
          answer: String(fieldResponses[fieldKey])
        });
      }
    }
    
    // Get verified caller info from call record
    // Strategy: Try explicit callId first, then use call matcher to find recent calls for this agent
    let validatedCallId: string | null = null;
    let verifiedCallerPhone: string | null = null;
    let verifiedCallerName: string | null = null;
    
    // Try explicit callId if provided (legacy support)
    if (callId) {
      const callRecord = await db
        .select({ 
          id: calls.id, 
          userId: calls.userId,
          phoneNumber: calls.phoneNumber,
          contactId: calls.contactId
        })
        .from(calls)
        .where(and(
          eq(calls.id, callId as string),
          eq(calls.userId, userId)
        ))
        .limit(1);
      
      if (callRecord.length > 0) {
        validatedCallId = callRecord[0].id;
        verifiedCallerPhone = callRecord[0].phoneNumber;
        
        if (callRecord[0].contactId) {
          const contactRecord = await db
            .select({ 
              firstName: contacts.firstName,
              lastName: contacts.lastName,
              phone: contacts.phone
            })
            .from(contacts)
            .where(eq(contacts.id, callRecord[0].contactId))
            .limit(1);
          if (contactRecord.length > 0) {
            verifiedCallerName = [contactRecord[0].firstName, contactRecord[0].lastName].filter(Boolean).join(' ');
            verifiedCallerPhone = contactRecord[0].phone || verifiedCallerPhone;
          }
        }
        console.log(`📋 [Form Webhook] Found call by explicit ID: ${validatedCallId}`);
      }
    }
    
    // If no explicit callId, use call matcher to find recent calls for this agent/phone
    if (!validatedCallId) {
      const { findCallForWebhook } = await import('../services/call-matcher');
      const matchedCall = await findCallForWebhook(elevenLabsAgentId, contactPhone, userId);
      
      if (matchedCall) {
        validatedCallId = matchedCall.callId;
        verifiedCallerPhone = matchedCall.verifiedContactPhone || matchedCall.phoneNumber;
        verifiedCallerName = matchedCall.contactName;
        console.log(`📋 [Form Webhook] Matched call via call-matcher: ${validatedCallId}`);
      } else {
        console.log(`📋 [Form Webhook] No call match found - submission will be saved without call link`);
      }
    }
    
    const finalContactPhone = verifiedCallerPhone || contactPhone || null;
    const finalContactName = verifiedCallerName || contactName || 'Unknown Caller';
    
    // Create form submission
    const submissionId = nanoid();
    const [newSubmission] = await db
      .insert(formSubmissions)
      .values({
        id: submissionId,
        formId,
        callId: validatedCallId,
        flowExecutionId: null, // Set to null - we don't have execution ID in webhook context
        contactName: finalContactName,
        contactPhone: finalContactPhone,
        responses,
      })
      .returning();
    
    console.log(`📋 [Form Webhook] Created submission ${submissionId}`);
    console.log(`   Contact: ${finalContactName} (${finalContactPhone})`);
    console.log(`   Responses: ${responses.length} fields`);
    
    // Trigger form.submitted webhook event
    try {
      await webhookDeliveryService.triggerEvent(userId, 'form.submitted', {
        submission: {
          id: submissionId,
          formId: formId,
          formName: form.name,
          contactName: finalContactName,
          contactPhone: finalContactPhone,
          responses: responses,
          submittedAt: new Date().toISOString(),
        },
        call: {
          id: validatedCallId || null,
        },
        form: {
          id: form.id,
          name: form.name,
          description: form.description || null,
        },
      });
      console.log(`📋 [Form Webhook] Triggered form.submitted webhook event`);
    } catch (webhookError: any) {
      console.error(`📋 [Form Webhook] Failed to trigger webhook:`, webhookError.message);
    }
    
    // Update call metadata for CRM Lead Processor detection
    if (validatedCallId) {
      try {
        const [existingCall] = await db
          .select()
          .from(calls)
          .where(eq(calls.id, validatedCallId))
          .limit(1);
        
        if (existingCall) {
          const existingMetadata = (existingCall.metadata as Record<string, unknown>) || {};
          const existingAiInsights = (existingMetadata.aiInsights as Record<string, unknown>) || {};
          
          const updatedMetadata = {
            ...existingMetadata,
            formSubmitted: true,
            hasFormSubmission: true,
            formData: {
              submissionId,
              formId,
              formName: form.name,
              contactName: finalContactName,
              contactPhone: finalContactPhone,
              submittedAt: new Date().toISOString(),
            },
            aiInsights: {
              ...existingAiInsights,
              primaryOutcome: 'form_submitted',
              formSubmitted: true,
            },
          };
          
          await db
            .update(calls)
            .set({ metadata: updatedMetadata })
            .where(eq(calls.id, validatedCallId));
          
          console.log(`📋 [Form Webhook] Updated call metadata for CRM detection`);
        }
      } catch (metadataError: any) {
        console.error(`📋 [Form Webhook] Failed to update call metadata:`, metadataError.message);
      }
    }
    
    return res.json({
      success: true,
      message: `Thank you! Your responses have been recorded successfully.`,
      submissionId: submissionId
    });
    
  } catch (error: any) {
    console.error(`❌ [Form Webhook] Error:`, error.message);
    return res.json({
      success: false,
      message: "I encountered an error while saving your responses. Please try again."
    });
  }
}

/**
 * RAG Knowledge Base Tool Webhook Handler
 * 
 * This endpoint is called by ElevenLabs when an agent uses the ask_knowledge tool.
 * It searches the RAG knowledge base and returns relevant information.
 * 
 * Security: Validates token via URL path (primary) or X-RAG-Token header (fallback)
 * 
 * Endpoint: POST /api/webhooks/elevenlabs/rag-tool/:token/:elevenLabsAgentId
 */
export async function handleRAGToolWebhook(req: Request, res: Response) {
  // Support both URL patterns:
  // - New: /api/webhooks/elevenlabs/rag-tool/:token/:agentId
  // - Legacy: /api/webhooks/elevenlabs/rag-tool/:agentId (with header auth)
  const { token: urlToken, agentId: elevenLabsAgentId } = req.params;
  
  console.log(`📚 [RAG Webhook] Received tool call for ElevenLabs agent: ${elevenLabsAgentId}`);
  
  // Debug: Log all headers to see what ElevenLabs sends
  console.log(`📚 [RAG Webhook] Request headers:`, JSON.stringify(req.headers, null, 2));
  
  try {
    // Validate authentication token - try URL token first, then header
    const { validateRAGWebhookToken } = await import('../services/rag-elevenlabs-tool');
    const headerToken = req.headers['x-rag-token'] as string | undefined;
    const providedToken = urlToken || headerToken;
    
    console.log(`📚 [RAG Webhook] Token sources - URL: ${urlToken ? 'present' : 'missing'}, Header: ${headerToken ? 'present' : 'missing'}`);
    
    if (!validateRAGWebhookToken(providedToken)) {
      console.warn(`📚 [RAG Webhook] Invalid or missing authentication token`);
      console.warn(`   URL token: ${urlToken ? urlToken.substring(0, 10) + '...' : 'none'}`);
      console.warn(`   Header token: ${headerToken ? headerToken.substring(0, 10) + '...' : 'none'}`);
      return res.status(401).json({
        response: "Unauthorized: Invalid authentication token",
        sources: []
      });
    }
    
    console.log(`📚 [RAG Webhook] Authentication successful via ${urlToken ? 'URL' : 'header'} token`);
    
    console.log(`   Request body:`, JSON.stringify(req.body, null, 2));
    
    // Extract the query from the request body
    // ElevenLabs sends the tool parameters in the body
    const query = req.body?.query || req.body?.parameters?.query || '';
    
    if (!query || typeof query !== 'string') {
      console.warn(`📚 [RAG Webhook] Invalid query received`);
      return res.json({
        response: "I need a search query to look up information in the knowledge base.",
        sources: []
      });
    }
    
    console.log(`📚 [RAG Webhook] Query: "${query.substring(0, 100)}..."`);
    
    // Look up the agent by ElevenLabs agent ID to get user ID and knowledge base IDs
    // First try incoming agents table
    let agent = await db
      .select()
      .from(incomingAgents)
      .where(eq(incomingAgents.elevenLabsAgentId, elevenLabsAgentId))
      .limit(1);
    
    let userId: string | null = null;
    let knowledgeBaseIds: string[] = [];
    
    if (agent.length > 0) {
      userId = agent[0].userId;
      knowledgeBaseIds = agent[0].knowledgeBaseIds || [];
      console.log(`📚 [RAG Webhook] Found incoming agent, user: ${userId}, KBs: ${knowledgeBaseIds.length}`);
    } else {
      // Try the regular agents table
      const regularAgent = await db
        .select()
        .from(agents)
        .where(eq(agents.elevenLabsAgentId, elevenLabsAgentId))
        .limit(1);
      
      if (regularAgent.length > 0) {
        userId = regularAgent[0].userId;
        knowledgeBaseIds = regularAgent[0].knowledgeBaseIds || [];
        console.log(`📚 [RAG Webhook] Found regular agent, user: ${userId}, KBs: ${knowledgeBaseIds.length}`);
      }
    }
    
    if (!userId) {
      console.warn(`📚 [RAG Webhook] ElevenLabs agent ${elevenLabsAgentId} not found`);
      return res.json({
        response: "I couldn't find the knowledge base for this agent.",
        sources: []
      });
    }
    
    if (knowledgeBaseIds.length === 0) {
      console.warn(`📚 [RAG Webhook] No knowledge bases assigned to agent ${elevenLabsAgentId}`);
      return res.json({
        response: "This agent doesn't have a knowledge base configured yet.",
        sources: []
      });
    }
    
    // Import the RAG tool handler
    const { handleAskKnowledgeToolCall } = await import('../services/rag-elevenlabs-tool');
    
    // Process the query through RAG
    const result = await handleAskKnowledgeToolCall(query, knowledgeBaseIds, userId);
    
    console.log(`📚 [RAG Webhook] Returning result with ${result.sources.length} sources`);
    console.log(`   Response preview: "${result.response.substring(0, 100)}..."`);
    
    // Return the result in a format ElevenLabs expects
    // For webhook tools, ElevenLabs expects a JSON response that becomes the tool result
    return res.json({
      response: result.response,
      sources: result.sources
    });
    
  } catch (error: any) {
    console.error(`❌ [RAG Webhook] Error:`, error.message);
    return res.json({
      response: "I encountered an error while searching the knowledge base. Please try again.",
      sources: []
    });
  }
}

/**
 * Handle Play Audio tool webhook - called by ElevenLabs when play_audio node executes
 * Uses Twilio REST API to play audio on the active call
 * 
 * URL format: /api/elevenlabs/tools/play-audio/:agentId
 * The agentId is the ElevenLabs agent ID, used to look up the active call
 * The audioUrl comes from the webhook payload configured in the flow
 */
export async function handlePlayAudioToolWebhook(req: Request, res: Response): Promise<void> {
  const { agentId: elevenLabsAgentId } = req.params;
  
  try {
    console.log('[PlayAudio Webhook] Received request for agent:', elevenLabsAgentId);
    console.log('[PlayAudio Webhook] Request body:', JSON.stringify(req.body));
    
    const { audioUrl, interruptible, waitForComplete } = req.body;
    
    if (!audioUrl) {
      console.error('[PlayAudio Webhook] Missing audioUrl');
      res.status(400).json({ error: 'Missing audioUrl' });
      return;
    }
    
    // Look up the agent by ElevenLabs agent ID to find the active call
    const agent = await db
      .select({ id: agents.id, userId: agents.userId })
      .from(agents)
      .where(eq(agents.elevenLabsAgentId, elevenLabsAgentId))
      .limit(1);
    
    if (agent.length === 0) {
      console.warn(`[PlayAudio Webhook] No agent found with ElevenLabs ID ${elevenLabsAgentId}`);
      res.json({
        success: false,
        message: "Could not find the agent to play audio."
      });
      return;
    }
    
    const dbAgentId = agent[0].id;
    const userId = agent[0].userId;
    
    // ========================================
    // CHECK FOR ELEVENLABS SIP CALLS FIRST
    // ElevenLabs SIP calls are managed by ElevenLabs natively - audio is handled
    // through the ElevenLabs workflow, not via Twilio
    // Only match calls with engine 'elevenlabs-sip' to avoid false positives
    // ========================================
    const [activeSipCall] = await db
      .select({
        id: sipCalls.id,
        engine: sipCalls.engine,
        status: sipCalls.status,
        externalCallId: sipCalls.externalCallId
      })
      .from(sipCalls)
      .where(
        and(
          eq(sipCalls.agentId, dbAgentId),
          eq(sipCalls.engine, 'elevenlabs-sip'),
          inArray(sipCalls.status, ['initiated', 'ringing', 'in-progress', 'connected'])
        )
      )
      .orderBy(sql`${sipCalls.startedAt} DESC`)
      .limit(1);
    
    if (activeSipCall) {
      // SIP call found - ElevenLabs handles audio natively through the workflow
      // For ElevenLabs SIP, the audio URL is already configured in the workflow tool
      // The webhook acknowledgment allows the flow to continue
      const domain = getDomain();
      // Handle various audio URL formats
      let resolvedUrl = audioUrl;
      if (!audioUrl.startsWith('http')) {
        if (!audioUrl.startsWith('/')) {
          resolvedUrl = `/audio/${audioUrl}`;
        }
      }
      const fullAudioUrl = audioUrl.startsWith('http') ? audioUrl : `${domain}${resolvedUrl}`;
      
      console.log(`[PlayAudio Webhook] SIP call detected (${activeSipCall.engine})`);
      console.log(`   Call ID: ${activeSipCall.id}`);
      console.log(`   Audio URL: ${fullAudioUrl}`);
      console.log(`   Note: ElevenLabs SIP handles audio natively through the workflow`);
      
      // Return success so ElevenLabs workflow continues
      // The audio playback is handled by ElevenLabs through its native workflow execution
      res.json({ 
        success: true, 
        message: 'Audio acknowledged for SIP call - ElevenLabs handles playback natively',
        audioUrl: fullAudioUrl,
        engine: activeSipCall.engine,
        callId: activeSipCall.id
      });
      return;
    }
    
    // ========================================
    // REGULAR TWILIO-BASED CALLS
    // ========================================
    
    // Find the most recent in-progress call for this specific agent
    // Strategy: Query calls through campaigns that use this agent
    // This ensures we target the correct call even with concurrent calls
    const [activeCall] = await db
      .select({
        id: calls.id,
        twilioSid: calls.twilioSid,
        status: calls.status,
        campaignId: calls.campaignId
      })
      .from(calls)
      .innerJoin(campaigns, eq(calls.campaignId, campaigns.id))
      .where(
        and(
          eq(campaigns.agentId, dbAgentId),
          eq(calls.status, 'in-progress')
        )
      )
      .orderBy(sql`${calls.createdAt} DESC`)
      .limit(1);
    
    // If no campaign-based call found, try incoming connections for this agent
    let callSid: string | null = activeCall?.twilioSid || null;
    
    if (!callSid) {
      // Check incoming connections for this agent
      const [incomingCall] = await db
        .select({
          id: calls.id,
          twilioSid: calls.twilioSid,
          status: calls.status
        })
        .from(calls)
        .innerJoin(incomingConnections, eq(calls.incomingConnectionId, incomingConnections.id))
        .where(
          and(
            eq(incomingConnections.agentId, dbAgentId),
            eq(calls.status, 'in-progress')
          )
        )
        .orderBy(sql`${calls.createdAt} DESC`)
        .limit(1);
      
      callSid = incomingCall?.twilioSid || null;
    }
    
    if (!callSid) {
      console.warn(`[PlayAudio Webhook] No active call with Twilio SID found for agent ${dbAgentId}`);
      // Don't fail - the audio might have been requested but call ended
      res.json({
        success: false,
        message: "No active call found. Audio playback skipped."
      });
      return;
    }
    
    // Get the base URL for audio files
    const domain = getDomain();
    // Handle various audio URL formats:
    // - Full URL: https://domain.com/audio/file.mp3
    // - Path: /audio/file.mp3
    // - Filename only: file.mp3 (assume it's in /audio/)
    let resolvedAudioUrl = audioUrl;
    if (!audioUrl.startsWith('http')) {
      if (!audioUrl.startsWith('/')) {
        resolvedAudioUrl = `/audio/${audioUrl}`;
      }
    }
    const fullAudioUrl = audioUrl.startsWith('http') ? audioUrl : `${domain}${resolvedAudioUrl}`;
    
    console.log(`[PlayAudio Webhook] Playing audio on call ${callSid}: ${fullAudioUrl}`);
    
    // Use Twilio REST API to play audio on the call
    const twilioClient = await getTwilioClient();
    if (!twilioClient) {
      console.error('[PlayAudio Webhook] Twilio client not available');
      res.status(500).json({ error: 'Twilio client not configured' });
      return;
    }
    
    try {
      // Create TwiML to play the audio
      const twiml = new twilio.twiml.VoiceResponse();
      twiml.play({ loop: 1 }, fullAudioUrl);
      
      // Update the call with the new TwiML
      await twilioClient.calls(callSid).update({
        twiml: twiml.toString()
      });
      
      console.log(`[PlayAudio Webhook] Audio playback initiated on call ${callSid}`);
      res.json({ 
        success: true, 
        message: 'Audio playback initiated',
        audioUrl: fullAudioUrl,
        callSid
      });
    } catch (twilioError: any) {
      console.error('[PlayAudio Webhook] Twilio API error:', twilioError.message);
      res.status(500).json({ 
        error: 'Failed to play audio',
        details: twilioError.message
      });
    }
  } catch (error: any) {
    console.error('[PlayAudio Webhook] Error:', error);
    res.status(500).json({ error: error.message || 'Internal error' });
  }
}
