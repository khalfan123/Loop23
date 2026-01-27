'use strict';

import { db } from '../../../server/db';
import { 
  campaigns, 
  contacts, 
  sipCalls, 
  sipPhoneNumbers,
  sipTrunks,
  agents,
  users 
} from '../../../shared/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { ElevenLabsSipService } from './elevenlabs-sip.service';

interface BatchResult {
  status: 'completed' | 'failed' | 'cancelled';
  totalCalls: number;
  completedCalls: number;
  failedCalls: number;
}

export class SipBatchCallingService {
  private campaignId: string;
  private concurrencyLimit: number = 5;
  private activeCalls: Set<string> = new Set();
  private isCancelled: boolean = false;

  private constructor(campaignId: string) {
    this.campaignId = campaignId;
  }

  static getInstance(campaignId: string): SipBatchCallingService {
    return new SipBatchCallingService(campaignId);
  }

  async executeCampaign(campaignId: string): Promise<BatchResult> {
    console.log(`[SIP Batch] Starting campaign execution: ${campaignId}`);

    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (!campaign.agentId) {
      throw new Error('Campaign has no agent configured');
    }

    const [agent] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, campaign.agentId))
      .limit(1);

    if (!agent) {
      throw new Error('Agent not found');
    }

    if (!agent.sipPhoneNumberId) {
      throw new Error('Agent has no SIP phone number configured');
    }

    const [sipPhoneNumber] = await db
      .select()
      .from(sipPhoneNumbers)
      .where(eq(sipPhoneNumbers.id, agent.sipPhoneNumberId))
      .limit(1);

    if (!sipPhoneNumber) {
      throw new Error('SIP phone number not found');
    }

    if (!sipPhoneNumber.outboundEnabled) {
      throw new Error('Outbound calling not enabled for this SIP number');
    }

    const [sipTrunk] = await db
      .select()
      .from(sipTrunks)
      .where(eq(sipTrunks.id, sipPhoneNumber.sipTrunkId))
      .limit(1);

    if (!sipTrunk || !sipTrunk.isActive) {
      throw new Error('SIP trunk is not active');
    }

    const campaignContacts = await db
      .select()
      .from(contacts)
      .where(and(
        eq(contacts.campaignId, campaignId),
        inArray(contacts.status, ['pending', 'failed'])
      ));

    if (campaignContacts.length === 0) {
      console.log('[SIP Batch] No pending contacts found');
      return {
        status: 'completed',
        totalCalls: 0,
        completedCalls: 0,
        failedCalls: 0,
      };
    }

    const totalCalls = campaignContacts.length;
    let completedCalls = 0;
    let failedCalls = 0;

    console.log(`[SIP Batch] Processing ${totalCalls} contacts for campaign ${campaignId}`);

    const contactQueue = [...campaignContacts];

    while (contactQueue.length > 0 && !this.isCancelled) {
      while (this.activeCalls.size < this.concurrencyLimit && contactQueue.length > 0 && !this.isCancelled) {
        const contact = contactQueue.shift();
        if (!contact) break;

        const callId = `${campaignId}-${contact.id}`;
        this.activeCalls.add(callId);

        this.processContact(
          contact,
          sipPhoneNumber,
          agent,
          campaign.userId
        ).then(success => {
          if (success) {
            completedCalls++;
          } else {
            failedCalls++;
          }
          this.activeCalls.delete(callId);
        }).catch(error => {
          console.error(`[SIP Batch] Error processing contact ${contact.id}:`, error);
          failedCalls++;
          this.activeCalls.delete(callId);
        });
      }

      if (this.activeCalls.size >= this.concurrencyLimit || contactQueue.length === 0) {
        await this.sleep(1000);
      }
    }

    while (this.activeCalls.size > 0) {
      await this.sleep(500);
    }

    console.log(`[SIP Batch] Campaign ${campaignId} completed: ${completedCalls} successful, ${failedCalls} failed`);

    await db
      .update(campaigns)
      .set({
        status: this.isCancelled ? 'cancelled' : 'completed',
        completedAt: new Date(),
        completedCalls,
        failedCalls,
        successfulCalls: completedCalls,
      })
      .where(eq(campaigns.id, campaignId));

    return {
      status: this.isCancelled ? 'cancelled' : 'completed',
      totalCalls,
      completedCalls,
      failedCalls,
    };
  }

  private async processContact(
    contact: typeof contacts.$inferSelect,
    sipPhoneNumber: typeof sipPhoneNumbers.$inferSelect,
    agent: typeof agents.$inferSelect,
    userId: string
  ): Promise<boolean> {
    try {
      await db
        .update(contacts)
        .set({ status: 'calling' })
        .where(eq(contacts.id, contact.id));

      const call = await ElevenLabsSipService.initiateOutboundCall({
        sipPhoneNumberId: sipPhoneNumber.id,
        toNumber: contact.phone,
        agentId: agent.id,
        userId,
        campaignId: contact.campaignId || undefined,
        contactId: contact.id,
      });

      console.log(`[SIP Batch] Initiated call ${call.id} to ${contact.phone}`);

      let attempts = 0;
      const maxAttempts = 120;
      let callComplete = false;
      let callSuccess = false;

      while (attempts < maxAttempts && !callComplete && !this.isCancelled) {
        await this.sleep(2000);
        attempts++;

        const [updatedCall] = await db
          .select()
          .from(sipCalls)
          .where(eq(sipCalls.id, call.id))
          .limit(1);

        if (!updatedCall) {
          callComplete = true;
          break;
        }

        if (['completed', 'failed', 'busy', 'no-answer', 'cancelled'].includes(updatedCall.status)) {
          callComplete = true;
          callSuccess = updatedCall.status === 'completed';
        }
      }

      if (!callComplete) {
        console.warn(`[SIP Batch] Call ${call.id} timed out`);
        await db
          .update(sipCalls)
          .set({ status: 'failed', endedAt: new Date() })
          .where(eq(sipCalls.id, call.id));
      }

      await db
        .update(contacts)
        .set({ status: callSuccess ? 'completed' : 'failed' })
        .where(eq(contacts.id, contact.id));

      return callSuccess;

    } catch (error: any) {
      console.error(`[SIP Batch] Failed to call ${contact.phone}:`, error.message);

      await db
        .update(contacts)
        .set({ status: 'failed' })
        .where(eq(contacts.id, contact.id));

      return false;
    }
  }

  cancel(): void {
    console.log(`[SIP Batch] Cancelling campaign ${this.campaignId}`);
    this.isCancelled = true;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
