'use strict';
import { Router, Response } from 'express';
import { AdminRequest } from '../../middleware/admin-auth';
import { db } from '../../db';
import { eq, desc, sql } from 'drizzle-orm';
import { awsCredentials } from '@shared/schema';
import { awsPollyService } from '../../services/aws-polly';
import { awsBedrockService } from '../../services/aws-bedrock';
import { z } from 'zod';

export function registerAwsCredentialsRoutes(router: Router) {
  router.get('/aws-credentials', async (req: AdminRequest, res: Response) => {
    try {
      const credentials = await db
        .select({
          id: awsCredentials.id,
          name: awsCredentials.name,
          region: awsCredentials.region,
          isActive: awsCredentials.isActive,
          isPrimary: awsCredentials.isPrimary,
          enabledServices: awsCredentials.enabledServices,
          pollyVoiceEngine: awsCredentials.pollyVoiceEngine,
          bedrockDefaultModel: awsCredentials.bedrockDefaultModel,
          maxConcurrency: awsCredentials.maxConcurrency,
          currentLoad: awsCredentials.currentLoad,
          totalAssignedAgents: awsCredentials.totalAssignedAgents,
          lastHealthCheck: awsCredentials.lastHealthCheck,
          healthStatus: awsCredentials.healthStatus,
          metadata: awsCredentials.metadata,
          createdAt: awsCredentials.createdAt,
          updatedAt: awsCredentials.updatedAt,
        })
        .from(awsCredentials)
        .orderBy(desc(awsCredentials.createdAt));

      res.json(credentials);
    } catch (error) {
      console.error('Error fetching AWS credentials:', error);
      res.status(500).json({ error: 'Failed to fetch AWS credentials' });
    }
  });

  router.get('/aws-credentials/:id', async (req: AdminRequest, res: Response) => {
    try {
      const { id } = req.params;
      const [credential] = await db
        .select({
          id: awsCredentials.id,
          name: awsCredentials.name,
          region: awsCredentials.region,
          isActive: awsCredentials.isActive,
          isPrimary: awsCredentials.isPrimary,
          enabledServices: awsCredentials.enabledServices,
          pollyVoiceEngine: awsCredentials.pollyVoiceEngine,
          bedrockDefaultModel: awsCredentials.bedrockDefaultModel,
          maxConcurrency: awsCredentials.maxConcurrency,
          currentLoad: awsCredentials.currentLoad,
          totalAssignedAgents: awsCredentials.totalAssignedAgents,
          lastHealthCheck: awsCredentials.lastHealthCheck,
          healthStatus: awsCredentials.healthStatus,
          metadata: awsCredentials.metadata,
          createdAt: awsCredentials.createdAt,
          updatedAt: awsCredentials.updatedAt,
        })
        .from(awsCredentials)
        .where(eq(awsCredentials.id, id))
        .limit(1);

      if (!credential) {
        return res.status(404).json({ error: 'Credential not found' });
      }

      res.json(credential);
    } catch (error) {
      console.error('Error fetching AWS credential:', error);
      res.status(500).json({ error: 'Failed to fetch AWS credential' });
    }
  });

  router.post('/aws-credentials', async (req: AdminRequest, res: Response) => {
    try {
      const schema = z.object({
        name: z.string().min(1),
        accessKeyId: z.string().min(1),
        secretAccessKey: z.string().min(1),
        region: z.string().default('us-east-1'),
        isActive: z.boolean().optional().default(true),
        isPrimary: z.boolean().optional().default(false),
        enabledServices: z.object({
          polly: z.boolean().default(true),
          bedrock: z.boolean().default(true),
        }).optional().default({ polly: true, bedrock: true }),
        pollyVoiceEngine: z.enum(['standard', 'neural', 'long-form', 'generative']).optional().default('neural'),
        bedrockDefaultModel: z.string().optional(),
        maxConcurrency: z.number().optional().default(100),
      });

      const data = schema.parse(req.body);

      if (data.isPrimary) {
        await db
          .update(awsCredentials)
          .set({ isPrimary: false })
          .where(eq(awsCredentials.isPrimary, true));
      }

      const [credential] = await db
        .insert(awsCredentials)
        .values({
          name: data.name,
          accessKeyId: data.accessKeyId,
          secretAccessKey: data.secretAccessKey,
          region: data.region,
          isActive: data.isActive,
          isPrimary: data.isPrimary,
          enabledServices: data.enabledServices,
          pollyVoiceEngine: data.pollyVoiceEngine,
          bedrockDefaultModel: data.bedrockDefaultModel,
          maxConcurrency: data.maxConcurrency,
        })
        .returning({
          id: awsCredentials.id,
          name: awsCredentials.name,
          region: awsCredentials.region,
          isActive: awsCredentials.isActive,
          isPrimary: awsCredentials.isPrimary,
          enabledServices: awsCredentials.enabledServices,
          pollyVoiceEngine: awsCredentials.pollyVoiceEngine,
          bedrockDefaultModel: awsCredentials.bedrockDefaultModel,
          createdAt: awsCredentials.createdAt,
        });

      console.log(`✅ Added AWS credential: ${credential.name}`);
      res.json(credential);
    } catch (error: any) {
      console.error('Error adding AWS credential:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Invalid input', details: error.errors });
      }
      res.status(500).json({ error: error.message || 'Failed to add credential' });
    }
  });

  router.patch('/aws-credentials/:id', async (req: AdminRequest, res: Response) => {
    try {
      const { id } = req.params;
      const schema = z.object({
        name: z.string().min(1).optional(),
        accessKeyId: z.string().min(1).optional(),
        secretAccessKey: z.string().min(1).optional(),
        region: z.string().optional(),
        isActive: z.boolean().optional(),
        isPrimary: z.boolean().optional(),
        enabledServices: z.object({
          polly: z.boolean(),
          bedrock: z.boolean(),
        }).optional(),
        pollyVoiceEngine: z.enum(['standard', 'neural', 'long-form', 'generative']).optional(),
        bedrockDefaultModel: z.string().optional(),
        maxConcurrency: z.number().optional(),
      });

      const data = schema.parse(req.body);

      if (data.isPrimary) {
        await db
          .update(awsCredentials)
          .set({ isPrimary: false })
          .where(eq(awsCredentials.isPrimary, true));
      }

      const [updated] = await db
        .update(awsCredentials)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(awsCredentials.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: 'Credential not found' });
      }

      res.json(updated);
    } catch (error: any) {
      console.error('Error updating AWS credential:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Invalid input', details: error.errors });
      }
      res.status(500).json({ error: error.message || 'Failed to update credential' });
    }
  });

  router.delete('/aws-credentials/:id', async (req: AdminRequest, res: Response) => {
    try {
      const { id } = req.params;

      const [deleted] = await db
        .delete(awsCredentials)
        .where(eq(awsCredentials.id, id))
        .returning();

      if (!deleted) {
        return res.status(404).json({ error: 'Credential not found' });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting AWS credential:', error);
      res.status(500).json({ error: 'Failed to delete credential' });
    }
  });

  router.post('/aws-credentials/test', async (req: AdminRequest, res: Response) => {
    try {
      const { accessKeyId, secretAccessKey, region } = req.body;

      if (!accessKeyId || !secretAccessKey || !region) {
        return res.status(400).json({ error: 'Access Key ID, Secret Access Key, and Region are required' });
      }

      const [pollyValid, bedrockValid] = await Promise.all([
        awsPollyService.testCredentials(accessKeyId, secretAccessKey, region),
        awsBedrockService.testCredentials(accessKeyId, secretAccessKey, region),
      ]);

      res.json({
        success: pollyValid || bedrockValid,
        polly: pollyValid,
        bedrock: bedrockValid,
        message: pollyValid && bedrockValid
          ? 'Both Polly and Bedrock are accessible'
          : pollyValid
          ? 'Polly is accessible, Bedrock may need model access enabled'
          : bedrockValid
          ? 'Bedrock is accessible, Polly may need permissions'
          : 'Invalid credentials or insufficient permissions',
      });
    } catch (error: any) {
      res.json({ success: false, error: error.message || 'Failed to test credentials' });
    }
  });

  router.get('/aws-credentials/:id/polly/voices', async (req: AdminRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { languageCode, engine } = req.query;

      const voices = await awsPollyService.listVoices(
        languageCode as string | undefined,
        engine as string | undefined,
        id
      );

      res.json(voices);
    } catch (error: any) {
      console.error('Error fetching Polly voices:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch voices' });
    }
  });

  router.get('/aws-credentials/:id/polly/languages', async (req: AdminRequest, res: Response) => {
    try {
      const { id } = req.params;
      const languages = await awsPollyService.getAvailableLanguages(id);
      res.json(languages);
    } catch (error: any) {
      console.error('Error fetching Polly languages:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch languages' });
    }
  });

  router.get('/aws-credentials/:id/bedrock/models', async (req: AdminRequest, res: Response) => {
    try {
      const models = awsBedrockService.getAvailableModels();
      res.json(models);
    } catch (error: any) {
      console.error('Error fetching Bedrock models:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch models' });
    }
  });

  router.post('/aws-credentials/:id/polly/synthesize', async (req: AdminRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { text, voiceId, engine, outputFormat, languageCode } = req.body;

      if (!text || !voiceId) {
        return res.status(400).json({ error: 'Text and voiceId are required' });
      }

      const result = await awsPollyService.synthesizeSpeech(
        {
          text,
          voiceId,
          engine: engine || 'neural',
          outputFormat: outputFormat || 'mp3',
          languageCode,
        },
        id
      );

      res.set('Content-Type', result.contentType);
      res.send(result.audioStream);
    } catch (error: any) {
      console.error('Error synthesizing speech:', error);
      res.status(500).json({ error: error.message || 'Failed to synthesize speech' });
    }
  });

  router.patch('/aws-credentials/:id/activate', async (req: AdminRequest, res: Response) => {
    try {
      const { id } = req.params;

      await db
        .update(awsCredentials)
        .set({ isActive: true, updatedAt: new Date() })
        .where(eq(awsCredentials.id, id));

      res.json({ success: true });
    } catch (error) {
      console.error('Error activating credential:', error);
      res.status(500).json({ error: 'Failed to activate credential' });
    }
  });

  router.patch('/aws-credentials/:id/deactivate', async (req: AdminRequest, res: Response) => {
    try {
      const { id } = req.params;

      await db
        .update(awsCredentials)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(awsCredentials.id, id));

      res.json({ success: true });
    } catch (error) {
      console.error('Error deactivating credential:', error);
      res.status(500).json({ error: 'Failed to deactivate credential' });
    }
  });

  router.patch('/aws-credentials/:id/set-primary', async (req: AdminRequest, res: Response) => {
    try {
      const { id } = req.params;

      await db
        .update(awsCredentials)
        .set({ isPrimary: false })
        .where(eq(awsCredentials.isPrimary, true));

      await db
        .update(awsCredentials)
        .set({ isPrimary: true, updatedAt: new Date() })
        .where(eq(awsCredentials.id, id));

      res.json({ success: true });
    } catch (error) {
      console.error('Error setting primary credential:', error);
      res.status(500).json({ error: 'Failed to set primary credential' });
    }
  });
}
