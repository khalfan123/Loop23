'use strict';
import { Router, Response } from 'express';
import { storage } from '../../storage';
import { AdminRequest } from '../../middleware/admin-auth';
import { db } from '../../db';
import { eq, isNull, and, sql, isNotNull, or, inArray, desc } from 'drizzle-orm';
import { phoneNumbers, agents, incomingAgents, incomingConnections, calls, users } from '@shared/schema';
import { ElevenLabsPoolService } from '../../services/elevenlabs-pool';
import { ElevenLabsService } from '../../services/elevenlabs';
import { z } from 'zod';

export function registerPhoneNumbersRoutes(router: Router) {
  router.get('/phone-numbers', async (req: AdminRequest, res: Response) => {
    try {
      const numbers = await storage.getAllPhoneNumbers();
      res.json(numbers);
    } catch (error) {
      console.error('Error fetching phone numbers:', error);
      res.status(500).json({ error: 'Failed to fetch phone numbers' });
    }
  });

  router.get('/phone-numbers/twilio-active', async (req: AdminRequest, res: Response) => {
    try {
      const dbSid = await storage.getGlobalSetting('twilio_account_sid');
      const dbToken = await storage.getGlobalSetting('twilio_auth_token');
      
      const accountSid = (dbSid?.value as string) || process.env.TWILIO_ACCOUNT_SID;
      const authToken = (dbToken?.value as string) || process.env.TWILIO_AUTH_TOKEN;
      
      if (!accountSid || !authToken) {
        return res.json({ numbers: [], error: 'Twilio not configured' });
      }
      
      const twilio = (await import('twilio')).default;
      const client = twilio(accountSid, authToken);
      
      const incomingNumbers = await client.incomingPhoneNumbers.list({ limit: 100 });
      
      res.json({
        numbers: incomingNumbers.map(n => ({
          sid: n.sid,
          phoneNumber: n.phoneNumber,
          friendlyName: n.friendlyName,
          capabilities: n.capabilities
        }))
      });
    } catch (error: any) {
      console.error('Error fetching Twilio numbers:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch Twilio numbers' });
    }
  });

  router.post('/phone-numbers/import', async (req: AdminRequest, res: Response) => {
    try {
      const { phoneNumber, twilioSid, provider } = req.body;
      
      if (!phoneNumber) {
        return res.status(400).json({ error: 'Phone number is required' });
      }
      
      const existing = await db.select().from(phoneNumbers).where(eq(phoneNumbers.phoneNumber, phoneNumber));
      if (existing.length > 0) {
        return res.status(400).json({ error: 'Phone number already exists' });
      }
      
      const [newNumber] = await db.insert(phoneNumbers).values({
        phoneNumber: phoneNumber,
        twilioSid: twilioSid || 'imported-' + Date.now(),
        status: 'active'
      }).returning();
      
      res.json({ success: true, phoneNumber: newNumber });
    } catch (error: any) {
      console.error('Error importing phone number:', error);
      res.status(500).json({ error: error.message || 'Failed to import phone number' });
    }
  });

  router.delete('/phone-numbers/release/:sid', async (req: AdminRequest, res: Response) => {
    try {
      const { sid } = req.params;
      
      const dbSid = await storage.getGlobalSetting('twilio_account_sid');
      const dbToken = await storage.getGlobalSetting('twilio_auth_token');
      
      const accountSid = (dbSid?.value as string) || process.env.TWILIO_ACCOUNT_SID;
      const authToken = (dbToken?.value as string) || process.env.TWILIO_AUTH_TOKEN;
      
      if (!accountSid || !authToken) {
        return res.status(400).json({ error: 'Twilio not configured' });
      }
      
      const twilio = (await import('twilio')).default;
      const client = twilio(accountSid, authToken);
      
      await client.incomingPhoneNumbers(sid).remove();
      
      await db.delete(phoneNumbers).where(eq(phoneNumbers.twilioSid, sid));
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error releasing phone number:', error);
      res.status(500).json({ error: error.message || 'Failed to release phone number' });
    }
  });

  router.get('/phone-numbers/all', async (req: AdminRequest, res: Response) => {
    try {
      const allNumbers = await db
        .select({
          id: phoneNumbers.id,
          phoneNumber: phoneNumbers.phoneNumber,
          status: phoneNumbers.status,
          userId: phoneNumbers.userId,
          twilioSid: phoneNumbers.twilioSid,
          country: phoneNumbers.country,
          createdAt: phoneNumbers.createdAt,
          userName: users.name,
          userEmail: users.email
        })
        .from(phoneNumbers)
        .leftJoin(users, eq(phoneNumbers.userId, users.id))
        .orderBy(desc(phoneNumbers.createdAt));
      
      res.json(allNumbers);
    } catch (error) {
      console.error('Error fetching all phone numbers:', error);
      res.status(500).json({ error: 'Failed to fetch phone numbers' });
    }
  });

  router.patch('/phone-numbers/:id/assign', async (req: AdminRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { userId } = req.body;
      
      const phoneNumber = await db.select().from(phoneNumbers).where(eq(phoneNumbers.id, id));
      if (phoneNumber.length === 0) {
        return res.status(404).json({ error: 'Phone number not found' });
      }
      
      if (userId) {
        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }
      }
      
      await db.update(phoneNumbers)
        .set({ 
          userId: userId || null,
          status: userId ? 'assigned' : 'available'
        })
        .where(eq(phoneNumbers.id, id));
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error assigning phone number:', error);
      res.status(500).json({ error: 'Failed to assign phone number' });
    }
  });

  router.post('/phone-numbers/configure-webhooks', async (req: AdminRequest, res: Response) => {
    try {
      const { phoneNumberIds, webhookUrl } = req.body;
      
      if (!phoneNumberIds || !Array.isArray(phoneNumberIds) || phoneNumberIds.length === 0) {
        return res.status(400).json({ error: 'Phone number IDs are required' });
      }
      
      if (!webhookUrl) {
        return res.status(400).json({ error: 'Webhook URL is required' });
      }
      
      const dbSid = await storage.getGlobalSetting('twilio_account_sid');
      const dbToken = await storage.getGlobalSetting('twilio_auth_token');
      
      const accountSid = (dbSid?.value as string) || process.env.TWILIO_ACCOUNT_SID;
      const authToken = (dbToken?.value as string) || process.env.TWILIO_AUTH_TOKEN;
      
      if (!accountSid || !authToken) {
        return res.status(400).json({ error: 'Twilio not configured' });
      }
      
      const twilio = (await import('twilio')).default;
      const client = twilio(accountSid, authToken);
      
      const results: any[] = [];
      
      for (const id of phoneNumberIds) {
        const phoneNumberRecord = await db.select().from(phoneNumbers).where(eq(phoneNumbers.id, id));
        if (phoneNumberRecord.length === 0 || !phoneNumberRecord[0].twilioSid) {
          results.push({ id, success: false, error: 'Phone number not found or no Twilio SID' });
          continue;
        }
        
        try {
          await client.incomingPhoneNumbers(phoneNumberRecord[0].twilioSid).update({
            voiceUrl: webhookUrl,
            voiceMethod: 'POST'
          });
          results.push({ id, success: true });
        } catch (err: any) {
          results.push({ id, success: false, error: err.message });
        }
      }
      
      res.json({ success: true, results });
    } catch (error: any) {
      console.error('Error configuring webhooks:', error);
      res.status(500).json({ error: error.message || 'Failed to configure webhooks' });
    }
  });

  router.get('/phone-numbers/migration-status', async (req: AdminRequest, res: Response) => {
    try {
      const numbersNeedingMigration = await db
        .select({
          id: phoneNumbers.id,
          number: phoneNumbers.phoneNumber,
          status: phoneNumbers.status
        })
        .from(phoneNumbers)
        .where(
          and(
            eq(phoneNumbers.status, 'active'),
            isNull(phoneNumbers.elevenLabsPhoneNumberId)
          )
        );
      
      res.json({
        needsMigration: numbersNeedingMigration.length,
        numbers: numbersNeedingMigration
      });
    } catch (error) {
      console.error('Error getting migration status:', error);
      res.status(500).json({ error: 'Failed to get migration status' });
    }
  });

  router.post('/phone-numbers/migrate/:phoneNumberId', async (req: AdminRequest, res: Response) => {
    try {
      const { phoneNumberId } = req.params;
      
      const phoneNumber = await db.select().from(phoneNumbers).where(eq(phoneNumbers.id, phoneNumberId));
      if (phoneNumber.length === 0) {
        return res.status(404).json({ error: 'Phone number not found' });
      }
      
      await db.update(phoneNumbers)
        .set({ elevenLabsPhoneNumberId: 'migrated-' + Date.now() })
        .where(eq(phoneNumbers.id, phoneNumberId));
      
      res.json({ success: true, message: 'Phone number marked as migrated' });
    } catch (error: any) {
      console.error('Error migrating phone number:', error);
      res.status(500).json({ error: error.message || 'Failed to migrate phone number' });
    }
  });

  router.post('/phone-numbers/migrate-all', async (req: AdminRequest, res: Response) => {
    try {
      const result = await db.update(phoneNumbers)
        .set({ elevenLabsPhoneNumberId: 'migrated-' + Date.now() })
        .where(isNull(phoneNumbers.elevenLabsPhoneNumberId));
      
      res.json({ success: true, message: 'All phone numbers marked as migrated' });
    } catch (error: any) {
      console.error('Error migrating all phone numbers:', error);
      res.status(500).json({ error: error.message || 'Failed to migrate phone numbers' });
    }
  });

  router.post('/phone-numbers/migrate-agent/:agentId', async (req: AdminRequest, res: Response) => {
    try {
      const { agentId } = req.params;
      
      res.json({ success: true, message: 'Agent migration endpoint - not implemented' });
    } catch (error: any) {
      console.error('Error migrating agent:', error);
      res.status(500).json({ error: error.message || 'Failed to migrate agent' });
    }
  });

  router.post('/phone-numbers/cleanup', async (req: AdminRequest, res: Response) => {
    try {
      const orphanedNumbers = await db
        .select()
        .from(phoneNumbers)
        .where(
          and(
            isNotNull(phoneNumbers.userId),
            eq(phoneNumbers.status, 'assigned')
          )
        );
      
      let cleaned = 0;
      for (const number of orphanedNumbers) {
        if (number.userId) {
          const user = await storage.getUser(number.userId);
          if (!user) {
            await db.update(phoneNumbers)
              .set({ userId: null, status: 'available' })
              .where(eq(phoneNumbers.id, number.id));
            cleaned++;
          }
        }
      }
      
      res.json({ success: true, cleaned });
    } catch (error) {
      console.error('Error cleaning up phone numbers:', error);
      res.status(500).json({ error: 'Failed to cleanup phone numbers' });
    }
  });

  router.post('/phone-numbers/clear-sync-status', async (req: AdminRequest, res: Response) => {
    try {
      await db.update(phoneNumbers)
        .set({ elevenLabsPhoneNumberId: null })
        .where(isNotNull(phoneNumbers.elevenLabsPhoneNumberId));
      
      res.json({ success: true, message: 'Sync status cleared for all phone numbers' });
    } catch (error) {
      console.error('Error clearing sync status:', error);
      res.status(500).json({ error: 'Failed to clear sync status' });
    }
  });

  router.post('/phone-numbers/sync-to-elevenlabs', async (req: AdminRequest, res: Response) => {
    try {
      const { phoneNumberIds } = req.body;
      
      if (!phoneNumberIds || !Array.isArray(phoneNumberIds)) {
        return res.status(400).json({ error: 'Phone number IDs array is required' });
      }
      
      res.json({ success: true, message: 'Sync to ElevenLabs - functionality placeholder' });
    } catch (error: any) {
      console.error('Error syncing to ElevenLabs:', error);
      res.status(500).json({ error: error.message || 'Failed to sync to ElevenLabs' });
    }
  });
}
