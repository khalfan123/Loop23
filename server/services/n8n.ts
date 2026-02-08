'use strict';
import crypto from 'crypto';

const N8N_BASE_URL = process.env.N8N_BASE_URL || 'https://integrations.loop9.com';
const N8N_API_KEY = process.env.N8N_API_KEY || '';
const LOOP9_WEBHOOK_SECRET = process.env.LOOP9_WEBHOOK_SECRET || 'loop9-default-secret';

interface N8nWorkflowNode {
  type: string;
  name: string;
  parameters: Record<string, any>;
  position: [number, number];
  credentials?: Record<string, { id: string; name: string }>;
}

interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
  nodes: N8nWorkflowNode[];
  connections: Record<string, any>;
}

interface N8nCredential {
  id: string;
  name: string;
  type: string;
  data: Record<string, any>;
}

interface N8nExecution {
  id: string;
  finished: boolean;
  mode: string;
  startedAt: string;
  stoppedAt: string;
  status: string;
}

async function n8nFetch(path: string, options: RequestInit = {}): Promise<any> {
  const url = `${N8N_BASE_URL}/api/v1${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-N8N-API-KEY': N8N_API_KEY,
    ...((options.headers as Record<string, string>) || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`n8n API error (${response.status}): ${errorText}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function getWorkflowTemplate(appName: string, nodeType: string, userId: string, slug: string): { nodes: any[]; connections: any } {
  const webhookPath = `loop9-${userId}-${slug}`;

  const nodes = [
    {
      parameters: {
        path: webhookPath,
        httpMethod: 'POST',
        responseMode: 'onReceived',
        options: {},
      },
      name: 'Loop9 Webhook',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 1,
      position: [250, 300],
    },
    {
      parameters: {
        conditions: {
          string: [
            {
              value1: '={{$json["verified"]}}',
              value2: 'true',
            },
          ],
        },
      },
      name: 'Verify Signature',
      type: 'n8n-nodes-base.if',
      typeVersion: 1,
      position: [470, 300],
    },
    {
      parameters: {},
      name: appName,
      type: nodeType,
      typeVersion: 1,
      position: [690, 300],
      credentials: {},
    },
  ];

  const connections = {
    'Loop9 Webhook': {
      main: [[{ node: 'Verify Signature', type: 'main', index: 0 }]],
    },
    'Verify Signature': {
      main: [[{ node: appName, type: 'main', index: 0 }]],
    },
  };

  return { nodes, connections };
}

export const n8nService = {
  createWorkflow: async (
    appName: string,
    nodeType: string,
    userId: string,
    slug: string,
  ): Promise<N8nWorkflow> => {
    const { nodes, connections } = getWorkflowTemplate(appName, nodeType, userId, slug);

    const workflow = await n8nFetch('/workflows', {
      method: 'POST',
      body: JSON.stringify({
        name: `Loop9 → ${appName} (User ${userId})`,
        nodes,
        connections,
        settings: {
          executionOrder: 'v1',
        },
        active: false,
      }),
    });

    return workflow;
  },

  createCredential: async (
    appName: string,
    credentialType: string,
    userId: string,
  ): Promise<N8nCredential> => {
    const credential = await n8nFetch('/credentials', {
      method: 'POST',
      body: JSON.stringify({
        name: `${appName}_user_${userId}`,
        type: credentialType,
        data: {},
      }),
    });

    return credential;
  },

  attachCredentialToWorkflow: async (
    workflowId: string,
    credentialId: string,
    credentialName: string,
    credentialType: string,
    targetNodeName: string,
  ): Promise<N8nWorkflow> => {
    const workflow = await n8nFetch(`/workflows/${workflowId}`);

    const updatedNodes = workflow.nodes.map((node: any) => {
      if (node.name === targetNodeName) {
        return {
          ...node,
          credentials: {
            [credentialType]: {
              id: credentialId,
              name: credentialName,
            },
          },
        };
      }
      return node;
    });

    const updated = await n8nFetch(`/workflows/${workflowId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        ...workflow,
        nodes: updatedNodes,
      }),
    });

    return updated;
  },

  activateWorkflow: async (workflowId: string): Promise<N8nWorkflow> => {
    const updated = await n8nFetch(`/workflows/${workflowId}`, {
      method: 'PATCH',
      body: JSON.stringify({ active: true }),
    });
    return updated;
  },

  deactivateWorkflow: async (workflowId: string): Promise<N8nWorkflow> => {
    const updated = await n8nFetch(`/workflows/${workflowId}`, {
      method: 'PATCH',
      body: JSON.stringify({ active: false }),
    });
    return updated;
  },

  deleteWorkflow: async (workflowId: string): Promise<void> => {
    await n8nFetch(`/workflows/${workflowId}`, { method: 'DELETE' });
  },

  deleteCredential: async (credentialId: string): Promise<void> => {
    await n8nFetch(`/credentials/${credentialId}`, { method: 'DELETE' });
  },

  getWorkflow: async (workflowId: string): Promise<N8nWorkflow> => {
    return await n8nFetch(`/workflows/${workflowId}`);
  },

  getExecution: async (executionId: string): Promise<N8nExecution> => {
    return await n8nFetch(`/executions/${executionId}`);
  },

  getExecutions: async (workflowId: string, limit = 20): Promise<N8nExecution[]> => {
    const result = await n8nFetch(`/executions?workflowId=${workflowId}&limit=${limit}`);
    return result.data || [];
  },

  getWebhookUrl: (userId: string, slug: string): string => {
    return `${N8N_BASE_URL}/webhook/loop9-${userId}-${slug}`;
  },

  getOAuthUrl: (appSlug: string, credentialId: string, workflowId: string): string => {
    return `${N8N_BASE_URL}/oauth/${appSlug}?credential_id=${credentialId}&workflow_id=${workflowId}`;
  },

  signPayload: (payload: string): string => {
    return crypto
      .createHmac('sha256', LOOP9_WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');
  },

  sendWebhook: async (
    webhookUrl: string,
    eventType: string,
    data: Record<string, any>,
  ): Promise<{ executionId?: string; success: boolean }> => {
    const payload = JSON.stringify({
      event: eventType,
      timestamp: new Date().toISOString(),
      data,
    });

    const signature = n8nService.signPayload(payload);

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Loop9-Signature': signature,
        },
        body: payload,
      });

      const executionId = response.headers.get('x-n8n-execution-id') || undefined;
      return { executionId, success: response.ok };
    } catch (error) {
      return { success: false };
    }
  },

  getCredentialTypesForApp: (slug: string): string => {
    const credentialTypeMap: Record<string, string> = {
      salesforce: 'salesforceOAuth2Api',
      hubspot: 'hubspotOAuth2Api',
      zoho: 'zohoCrmOAuth2Api',
      'google-sheets': 'googleSheetsOAuth2Api',
      pipedrive: 'pipedriveApi',
      dynamics365: 'microsoftDynamicsOAuth2Api',
      freshsales: 'freshsalesApi',
      'monday-com': 'mondayComApi',
      airtable: 'airtableTokenApi',
      slack: 'slackOAuth2Api',
      mailchimp: 'mailchimpOAuth2Api',
      intercom: 'intercomApi',
    };
    return credentialTypeMap[slug] || `${slug}Api`;
  },
};
