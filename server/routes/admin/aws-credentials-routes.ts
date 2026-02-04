'use strict';
import { Router, Response } from 'express';
import { AdminRequest } from '../../middleware/admin-auth';
import { awsPollyService } from '../../services/aws-polly';
import { awsBedrockService } from '../../services/aws-bedrock';

export function registerAwsCredentialsRoutes(router: Router) {
  /**
   * Get AWS configuration status
   */
  router.get('/aws/status', async (req: AdminRequest, res: Response) => {
    try {
      const pollyConfigured = awsPollyService.isConfigured();
      const bedrockConfigured = awsBedrockService.isConfigured();
      const region = process.env.AWS_REGION || 'us-east-1';

      res.json({
        configured: pollyConfigured && bedrockConfigured,
        polly: {
          configured: pollyConfigured,
          region,
        },
        bedrock: {
          configured: bedrockConfigured,
          region,
        },
      });
    } catch (error) {
      console.error('Error getting AWS status:', error);
      res.status(500).json({ error: 'Failed to get AWS status' });
    }
  });

  /**
   * Test AWS Polly credentials
   */
  router.post('/aws/test/polly', async (req: AdminRequest, res: Response) => {
    try {
      if (!awsPollyService.isConfigured()) {
        return res.status(400).json({
          success: false,
          message: 'AWS credentials not configured. Please set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_REGION secrets.',
        });
      }

      const result = await awsPollyService.testCredentials();
      res.json(result);
    } catch (error: any) {
      console.error('Error testing Polly:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  /**
   * Test AWS Bedrock credentials
   */
  router.post('/aws/test/bedrock', async (req: AdminRequest, res: Response) => {
    try {
      if (!awsBedrockService.isConfigured()) {
        return res.status(400).json({
          success: false,
          message: 'AWS credentials not configured. Please set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_REGION secrets.',
        });
      }

      const result = await awsBedrockService.testCredentials();
      res.json(result);
    } catch (error: any) {
      console.error('Error testing Bedrock:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  /**
   * List available Polly voices
   */
  router.get('/aws/polly/voices', async (req: AdminRequest, res: Response) => {
    try {
      if (!awsPollyService.isConfigured()) {
        return res.status(400).json({ error: 'AWS credentials not configured' });
      }

      const { languageCode, engine } = req.query;
      const voices = await awsPollyService.listVoices(
        languageCode as string | undefined,
        engine as string | undefined
      );

      res.json(voices);
    } catch (error: any) {
      console.error('Error listing Polly voices:', error);
      res.status(500).json({ error: error.message || 'Failed to list voices' });
    }
  });

  /**
   * Get supported Polly languages
   */
  router.get('/aws/polly/languages', async (req: AdminRequest, res: Response) => {
    try {
      const languages = awsPollyService.getSupportedLanguages();
      res.json(languages);
    } catch (error) {
      console.error('Error getting Polly languages:', error);
      res.status(500).json({ error: 'Failed to get languages' });
    }
  });

  /**
   * List available Bedrock models
   */
  router.get('/aws/bedrock/models', async (req: AdminRequest, res: Response) => {
    try {
      const models = awsBedrockService.listModels();
      res.json(models);
    } catch (error) {
      console.error('Error listing Bedrock models:', error);
      res.status(500).json({ error: 'Failed to list models' });
    }
  });

  /**
   * Synthesize speech with Polly (for preview)
   */
  router.post('/aws/polly/synthesize', async (req: AdminRequest, res: Response) => {
    try {
      if (!awsPollyService.isConfigured()) {
        return res.status(400).json({ error: 'AWS credentials not configured' });
      }

      const { text, voiceId, engine, outputFormat, languageCode } = req.body;

      if (!text || !voiceId) {
        return res.status(400).json({ error: 'Text and voiceId are required' });
      }

      const result = await awsPollyService.synthesizeSpeech({
        text,
        voiceId,
        engine: engine || 'neural',
        outputFormat: outputFormat || 'mp3',
        languageCode,
      });

      res.set('Content-Type', result.contentType);
      res.send(result.audioStream);
    } catch (error: any) {
      console.error('Error synthesizing speech:', error);
      res.status(500).json({ error: error.message || 'Failed to synthesize speech' });
    }
  });

  /**
   * Chat with Bedrock (for testing)
   */
  router.post('/aws/bedrock/chat', async (req: AdminRequest, res: Response) => {
    try {
      if (!awsBedrockService.isConfigured()) {
        return res.status(400).json({ error: 'AWS credentials not configured' });
      }

      const { model, messages, systemPrompt, maxTokens, temperature } = req.body;

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Messages array is required' });
      }

      const result = await awsBedrockService.invoke({
        model,
        messages,
        systemPrompt,
        maxTokens,
        temperature,
      });

      res.json(result);
    } catch (error: any) {
      console.error('Error invoking Bedrock:', error);
      res.status(500).json({ error: error.message || 'Failed to invoke Bedrock' });
    }
  });
}
