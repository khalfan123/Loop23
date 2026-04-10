import { db } from "../../../server/db";
import {
  sipTrunks,
  sipPhoneNumbers,
  sipCalls,
  agents,
  users,
  elevenLabsCredentials
} from "../../../shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { getProviderDefaults, ELEVENLABS_SIP_CONFIG } from "../config/sip-config";
class ElevenLabsSipService {
  static async getElevenLabsApiKey(userId) {
    if (userId) {
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (user?.elevenLabsCredentialId) {
        const [credential] = await db.select().from(elevenLabsCredentials).where(eq(elevenLabsCredentials.id, user.elevenLabsCredentialId)).limit(1);
        if (credential?.apiKey) {
          return credential.apiKey;
        }
      }
    }
    const [primaryCred] = await db.select().from(elevenLabsCredentials).where(and(eq(elevenLabsCredentials.isPrimary, true), eq(elevenLabsCredentials.isActive, true))).limit(1);
    if (primaryCred?.apiKey) {
      return primaryCred.apiKey;
    }
    if (process.env.ELEVENLABS_API_KEY) {
      return process.env.ELEVENLABS_API_KEY;
    }
    throw new Error("No ElevenLabs API key configured");
  }
  static async createSipTrunk(params) {
    const providerDefaults = getProviderDefaults(params.provider);
    const [trunk] = await db.insert(sipTrunks).values({
      userId: params.userId,
      name: params.name,
      engine: "elevenlabs-sip",
      provider: params.provider,
      sipHost: params.sipHost,
      sipPort: params.sipPort || providerDefaults.defaultPort,
      transport: params.transport || providerDefaults.defaultTransport,
      mediaEncryption: params.mediaEncryption || providerDefaults.defaultMediaEncryption,
      inboundTransport: params.inboundTransport || providerDefaults.inboundTransport || "tcp",
      inboundPort: params.inboundPort || providerDefaults.inboundPort || 5060,
      codecsAllowed: params.codecsAllowed || ELEVENLABS_SIP_CONFIG.defaultCodecs,
      username: params.username,
      password: params.password,
      realm: params.realm,
      externalElevenLabsId: null,
      isActive: true,
      healthStatus: "unknown"
    }).returning();
    console.log(`[SIP Engine] Created SIP trunk: ${trunk.id} for provider ${params.provider}`);
    return trunk;
  }
  static async updateSipTrunk(trunkId, updates) {
    const [existing] = await db.select().from(sipTrunks).where(eq(sipTrunks.id, trunkId)).limit(1);
    if (!existing) {
      return null;
    }
    const [updated] = await db.update(sipTrunks).set({
      ...updates,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq(sipTrunks.id, trunkId)).returning();
    return updated;
  }
  static async deleteSipTrunk(trunkId) {
    const [existing] = await db.select().from(sipTrunks).where(eq(sipTrunks.id, trunkId)).limit(1);
    if (!existing) {
      return false;
    }
    const phoneNumbers = await db.select().from(sipPhoneNumbers).where(eq(sipPhoneNumbers.sipTrunkId, trunkId));
    for (const phone of phoneNumbers) {
      if (phone.externalElevenLabsPhoneId) {
        try {
          const apiKey = await this.getElevenLabsApiKey(existing.userId);
          await fetch(`${ELEVENLABS_SIP_CONFIG.apiBaseUrl}/convai/phone-numbers/${phone.externalElevenLabsPhoneId}`, {
            method: "DELETE",
            headers: { "xi-api-key": apiKey }
          });
          console.log(`[SIP Engine] Deleted ElevenLabs phone: ${phone.externalElevenLabsPhoneId}`);
        } catch (error) {
          console.warn(`[SIP Engine] Failed to delete ElevenLabs phone ${phone.phoneNumber}: ${error.message}`);
        }
      }
    }
    await db.delete(sipPhoneNumbers).where(eq(sipPhoneNumbers.sipTrunkId, trunkId));
    await db.delete(sipTrunks).where(eq(sipTrunks.id, trunkId));
    return true;
  }
  static async getUserTrunks(userId) {
    return db.select().from(sipTrunks).where(and(eq(sipTrunks.userId, userId), eq(sipTrunks.isActive, true))).orderBy(desc(sipTrunks.createdAt));
  }
  static async getTrunkById(trunkId) {
    const [trunk] = await db.select().from(sipTrunks).where(eq(sipTrunks.id, trunkId)).limit(1);
    return trunk || null;
  }
  static async addPhoneNumber(params) {
    const [trunk] = await db.select().from(sipTrunks).where(eq(sipTrunks.id, params.sipTrunkId)).limit(1);
    if (!trunk) {
      throw new Error("SIP trunk not found");
    }
    let externalElevenLabsPhoneId = null;
    try {
      const apiKey = await this.getElevenLabsApiKey(params.userId);
      let agentElevenLabsId;
      if (params.agentId) {
        const [agent] = await db.select().from(agents).where(eq(agents.id, params.agentId)).limit(1);
        agentElevenLabsId = agent?.elevenLabsAgentId || void 0;
      }
      const mediaEncryptionMap = {
        "require": "required",
        "prefer": "allowed",
        "none": "disabled"
      };
      const mediaEnc = mediaEncryptionMap[trunk.mediaEncryption || "require"] || "allowed";
      const transportProto = trunk.transport === "tls" ? "tls" : "tcp";
      const sipTrunkPayload = {
        phone_number: params.phoneNumber,
        label: params.label || params.phoneNumber,
        sip_trunk: {
          inbound_trunk: {
            transport: transportProto,
            media_encryption: mediaEnc
          },
          outbound_trunk: {
            address: trunk.sipHost,
            transport: transportProto,
            port: trunk.sipPort || 5061,
            media_encryption: mediaEnc
          }
        }
      };
      if (trunk.username && trunk.password) {
        sipTrunkPayload.sip_trunk.outbound_trunk.username = trunk.username;
        sipTrunkPayload.sip_trunk.outbound_trunk.password = trunk.password;
      }
      if (agentElevenLabsId) {
        sipTrunkPayload.agent_id = agentElevenLabsId;
      }
      console.log(`[SIP Engine] Registering phone ${params.phoneNumber} with ElevenLabs SIP trunk...`);
      const response = await fetch(`${ELEVENLABS_SIP_CONFIG.apiBaseUrl}/convai/phone-numbers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey
        },
        body: JSON.stringify(sipTrunkPayload)
      });
      if (response.ok) {
        const data = await response.json();
        externalElevenLabsPhoneId = data.phone_number_id || data.id;
        console.log(`[SIP Engine] Registered phone ${params.phoneNumber} with ElevenLabs: ${externalElevenLabsPhoneId}`);
        if (!trunk.externalElevenLabsId && externalElevenLabsPhoneId) {
          await db.update(sipTrunks).set({
            externalElevenLabsId: `sip-${trunk.id}`,
            healthStatus: "healthy",
            updatedAt: /* @__PURE__ */ new Date()
          }).where(eq(sipTrunks.id, trunk.id));
        }
      } else {
        const errorText = await response.text();
        console.warn(`[SIP Engine] ElevenLabs phone registration failed: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.warn(`[SIP Engine] Failed to register phone with ElevenLabs: ${error.message}`);
    }
    const [phoneNumber] = await db.insert(sipPhoneNumbers).values({
      sipTrunkId: params.sipTrunkId,
      userId: params.userId,
      phoneNumber: params.phoneNumber,
      label: params.label,
      engine: trunk.engine,
      agentId: params.agentId || null,
      inboundEnabled: params.inboundEnabled ?? true,
      outboundEnabled: params.outboundEnabled ?? true,
      externalElevenLabsPhoneId,
      isActive: true
    }).returning();
    console.log(`[SIP Engine] Added phone number: ${phoneNumber.id}`);
    return phoneNumber;
  }
  static async updatePhoneNumber(phoneNumberId, updates) {
    const [existing] = await db.select().from(sipPhoneNumbers).where(eq(sipPhoneNumbers.id, phoneNumberId)).limit(1);
    if (!existing) {
      return null;
    }
    if (existing.externalElevenLabsPhoneId && updates.agentId) {
      try {
        const [agent] = await db.select().from(agents).where(eq(agents.id, updates.agentId)).limit(1);
        if (agent?.elevenLabsAgentId) {
          const apiKey = await this.getElevenLabsApiKey(existing.userId);
          await fetch(`${ELEVENLABS_SIP_CONFIG.apiBaseUrl}/convai/phone-numbers/${existing.externalElevenLabsPhoneId}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "xi-api-key": apiKey
            },
            body: JSON.stringify({ agent_id: agent.elevenLabsAgentId })
          });
        }
      } catch (error) {
        console.warn(`[SIP Engine] Failed to update ElevenLabs phone: ${error.message}`);
      }
    }
    const [updated] = await db.update(sipPhoneNumbers).set({
      ...updates,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq(sipPhoneNumbers.id, phoneNumberId)).returning();
    return updated;
  }
  static async deletePhoneNumber(phoneNumberId) {
    const [existing] = await db.select().from(sipPhoneNumbers).where(eq(sipPhoneNumbers.id, phoneNumberId)).limit(1);
    if (!existing) {
      return false;
    }
    if (existing.externalElevenLabsPhoneId) {
      try {
        const apiKey = await this.getElevenLabsApiKey(existing.userId);
        await fetch(`${ELEVENLABS_SIP_CONFIG.apiBaseUrl}/convai/phone-numbers/${existing.externalElevenLabsPhoneId}`, {
          method: "DELETE",
          headers: {
            "xi-api-key": apiKey
          }
        });
      } catch (error) {
        console.warn(`[SIP Engine] Failed to delete ElevenLabs phone: ${error.message}`);
      }
    }
    await db.delete(sipPhoneNumbers).where(eq(sipPhoneNumbers.id, phoneNumberId));
    return true;
  }
  static async getTrunkPhoneNumbers(sipTrunkId) {
    return db.select().from(sipPhoneNumbers).where(and(eq(sipPhoneNumbers.sipTrunkId, sipTrunkId), eq(sipPhoneNumbers.isActive, true))).orderBy(desc(sipPhoneNumbers.createdAt));
  }
  static async getUserPhoneNumbers(userId) {
    return db.select().from(sipPhoneNumbers).where(and(eq(sipPhoneNumbers.userId, userId), eq(sipPhoneNumbers.isActive, true))).orderBy(desc(sipPhoneNumbers.createdAt));
  }
  static async initiateOutboundCall(params) {
    const [phoneNumber] = await db.select().from(sipPhoneNumbers).where(eq(sipPhoneNumbers.id, params.sipPhoneNumberId)).limit(1);
    if (!phoneNumber) {
      throw new Error("SIP phone number not found");
    }
    if (!phoneNumber.outboundEnabled) {
      throw new Error("Outbound calls not enabled for this number");
    }
    const [agent] = await db.select().from(agents).where(eq(agents.id, params.agentId)).limit(1);
    if (!agent) {
      throw new Error("Agent not found");
    }
    if (!agent.elevenLabsAgentId) {
      throw new Error("Agent not configured with ElevenLabs");
    }
    const [callRecord] = await db.insert(sipCalls).values({
      sipPhoneNumberId: params.sipPhoneNumberId,
      userId: params.userId,
      agentId: params.agentId,
      campaignId: params.campaignId || null,
      contactId: params.contactId || null,
      direction: "outbound",
      engine: phoneNumber.engine,
      toNumber: params.toNumber,
      fromNumber: phoneNumber.phoneNumber,
      status: "initiated",
      startedAt: /* @__PURE__ */ new Date()
    }).returning();
    let externalCallId = null;
    try {
      const apiKey = await this.getElevenLabsApiKey(params.userId);
      const response = await fetch(`${ELEVENLABS_SIP_CONFIG.apiBaseUrl}/convai/conversations/outbound-call`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey
        },
        body: JSON.stringify({
          agent_id: agent.elevenLabsAgentId,
          agent_phone_number_id: phoneNumber.externalElevenLabsPhoneId,
          customer_phone_number: params.toNumber
        })
      });
      if (response.ok) {
        const data = await response.json();
        externalCallId = data.conversation_id || data.call_id;
        await db.update(sipCalls).set({
          externalCallId,
          status: "ringing"
        }).where(eq(sipCalls.id, callRecord.id));
        console.log(`[SIP Engine] Initiated outbound call: ${externalCallId}`);
      } else {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      await db.update(sipCalls).set({
        status: "failed",
        endedAt: /* @__PURE__ */ new Date()
      }).where(eq(sipCalls.id, callRecord.id));
      throw error;
    }
    const [updatedCall] = await db.select().from(sipCalls).where(eq(sipCalls.id, callRecord.id)).limit(1);
    return updatedCall;
  }
  static async handleCallWebhook(params) {
    const [call] = await db.select().from(sipCalls).where(eq(sipCalls.externalCallId, params.conversationId)).limit(1);
    if (!call) {
      console.warn(`[SIP Engine] Call not found for conversation: ${params.conversationId}`);
      return;
    }
    const statusMap = {
      "initiated": "initiated",
      "ringing": "ringing",
      "in_progress": "in-progress",
      "in-progress": "in-progress",
      "completed": "completed",
      "failed": "failed",
      "busy": "busy",
      "no_answer": "no-answer",
      "no-answer": "no-answer"
    };
    const mappedStatus = statusMap[params.status] || params.status;
    const updateData = {
      status: mappedStatus
    };
    if (["completed", "failed", "busy", "no-answer"].includes(mappedStatus)) {
      updateData.endedAt = /* @__PURE__ */ new Date();
    }
    if (params.duration) {
      updateData.durationSeconds = params.duration;
    }
    if (params.transcript) {
      updateData.transcriptJson = params.transcript;
    }
    await db.update(sipCalls).set(updateData).where(eq(sipCalls.id, call.id));
    console.log(`[SIP Engine] Updated call ${call.id} status to ${mappedStatus}`);
  }
  static async getCallById(callId) {
    const [call] = await db.select().from(sipCalls).where(eq(sipCalls.id, callId)).limit(1);
    return call || null;
  }
  static async getUserCalls(userId, limit = 50) {
    return db.select().from(sipCalls).where(eq(sipCalls.userId, userId)).orderBy(desc(sipCalls.createdAt)).limit(limit);
  }
  static async checkTrunkHealth(trunkId) {
    const [trunk] = await db.select().from(sipTrunks).where(eq(sipTrunks.id, trunkId)).limit(1);
    if (!trunk) {
      return { status: "error", message: "Trunk not found" };
    }
    const phoneNumbers = await db.select().from(sipPhoneNumbers).where(and(eq(sipPhoneNumbers.sipTrunkId, trunkId), eq(sipPhoneNumbers.isActive, true)));
    const registeredCount = phoneNumbers.filter((p) => p.externalElevenLabsPhoneId).length;
    if (registeredCount === 0) {
      await db.update(sipTrunks).set({ healthStatus: "unknown", lastHealthCheck: /* @__PURE__ */ new Date() }).where(eq(sipTrunks.id, trunkId));
      return { status: "unknown", message: "No phone numbers registered with ElevenLabs yet" };
    }
    try {
      const apiKey = await this.getElevenLabsApiKey(trunk.userId);
      const testPhone = phoneNumbers.find((p) => p.externalElevenLabsPhoneId);
      const response = await fetch(`${ELEVENLABS_SIP_CONFIG.apiBaseUrl}/convai/phone-numbers/${testPhone.externalElevenLabsPhoneId}`, {
        method: "GET",
        headers: { "xi-api-key": apiKey }
      });
      const healthStatus = response.ok ? "healthy" : "unhealthy";
      await db.update(sipTrunks).set({ healthStatus, lastHealthCheck: /* @__PURE__ */ new Date() }).where(eq(sipTrunks.id, trunkId));
      return response.ok ? { status: "healthy", message: `SIP trunk operational (${registeredCount} numbers registered)` } : { status: "unhealthy", message: `ElevenLabs API returned ${response.status}` };
    } catch (error) {
      await db.update(sipTrunks).set({ healthStatus: "degraded", lastHealthCheck: /* @__PURE__ */ new Date() }).where(eq(sipTrunks.id, trunkId));
      return { status: "degraded", message: error.message };
    }
  }
}
export {
  ElevenLabsSipService
};
