'use strict';

const N8N_BASE_URL = process.env.N8N_BASE_URL || '';
const N8N_API_KEY = process.env.N8N_API_KEY || '';

if (!N8N_BASE_URL || !N8N_API_KEY) {
  console.error('ERROR: N8N_BASE_URL and N8N_API_KEY must be set');
  process.exit(1);
}

async function n8nFetch(path: string, options: RequestInit = {}): Promise<any> {
  const url = `${N8N_BASE_URL}/api/v1${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-N8N-API-KEY': N8N_API_KEY,
    ...((options.headers as Record<string, string>) || {}),
  };

  const response = await fetch(url, { ...options, headers });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`n8n ${response.status}: ${text.substring(0, 200)}`);
  }

  return text ? JSON.parse(text) : null;
}

const INTEGRATIONS = [
  { name: 'Salesforce', slug: 'salesforce', category: 'crm', nodeType: 'n8n-nodes-base.salesforce' },
  { name: 'HubSpot', slug: 'hubspot', category: 'crm', nodeType: 'n8n-nodes-base.hubspot' },
  { name: 'Zoho CRM', slug: 'zoho', category: 'crm', nodeType: 'n8n-nodes-base.zohoCrm' },
  { name: 'Pipedrive', slug: 'pipedrive', category: 'crm', nodeType: 'n8n-nodes-base.pipedrive' },
  { name: 'Freshsales', slug: 'freshsales', category: 'crm', nodeType: 'n8n-nodes-base.freshworksCrm' },
  { name: 'Microsoft Dynamics 365', slug: 'dynamics365', category: 'crm', nodeType: 'n8n-nodes-base.microsoftDynamicsCrm' },
  { name: 'Close CRM', slug: 'close-crm', category: 'crm', nodeType: 'n8n-nodes-base.closeCrm' },
  { name: 'Copper CRM', slug: 'copper-crm', category: 'crm', nodeType: 'n8n-nodes-base.copper' },
  { name: 'GoHighLevel', slug: 'gohighlevel', category: 'crm', nodeType: 'n8n-nodes-base.httpRequest' },
  { name: 'Keap', slug: 'keap', category: 'crm', nodeType: 'n8n-nodes-base.keap' },
  { name: 'SugarCRM', slug: 'sugarcrm', category: 'crm', nodeType: 'n8n-nodes-base.httpRequest' },
  { name: 'Bitrix24', slug: 'bitrix24', category: 'crm', nodeType: 'n8n-nodes-base.httpRequest' },
  { name: 'Insightly', slug: 'insightly', category: 'crm', nodeType: 'n8n-nodes-base.httpRequest' },
  { name: 'Twilio', slug: 'twilio', category: 'telephony', nodeType: 'n8n-nodes-base.twilio' },
  { name: 'Plivo', slug: 'plivo', category: 'telephony', nodeType: 'n8n-nodes-base.httpRequest' },
  { name: 'Vonage', slug: 'vonage', category: 'telephony', nodeType: 'n8n-nodes-base.httpRequest' },
  { name: 'Bandwidth', slug: 'bandwidth', category: 'telephony', nodeType: 'n8n-nodes-base.httpRequest' },
  { name: 'Telnyx', slug: 'telnyx', category: 'telephony', nodeType: 'n8n-nodes-base.httpRequest' },
  { name: 'Amazon Connect', slug: 'amazon-connect', category: 'telephony', nodeType: 'n8n-nodes-base.httpRequest' },
  { name: 'OpenAI', slug: 'openai', category: 'ai_llm', nodeType: 'n8n-nodes-base.openAi' },
  { name: 'Anthropic', slug: 'anthropic', category: 'ai_llm', nodeType: 'n8n-nodes-base.httpRequest' },
  { name: 'Google Gemini', slug: 'google-gemini', category: 'ai_llm', nodeType: 'n8n-nodes-base.httpRequest' },
  { name: 'Mistral AI', slug: 'mistral', category: 'ai_llm', nodeType: 'n8n-nodes-base.httpRequest' },
  { name: 'Groq', slug: 'groq', category: 'ai_llm', nodeType: 'n8n-nodes-base.httpRequest' },
  { name: 'Cohere', slug: 'cohere', category: 'ai_llm', nodeType: 'n8n-nodes-base.httpRequest' },
  { name: 'Perplexity', slug: 'perplexity', category: 'ai_llm', nodeType: 'n8n-nodes-base.httpRequest' },
  { name: 'ElevenLabs', slug: 'elevenlabs', category: 'voice_speech', nodeType: 'n8n-nodes-base.httpRequest' },
  { name: 'Deepgram', slug: 'deepgram', category: 'voice_speech', nodeType: 'n8n-nodes-base.httpRequest' },
  { name: 'Google Cloud TTS', slug: 'google-cloud-tts', category: 'voice_speech', nodeType: 'n8n-nodes-base.httpRequest' },
  { name: 'Amazon Polly', slug: 'amazon-polly', category: 'voice_speech', nodeType: 'n8n-nodes-base.httpRequest' },
  { name: 'Azure Speech', slug: 'azure-speech', category: 'voice_speech', nodeType: 'n8n-nodes-base.httpRequest' },
  { name: 'PlayHT', slug: 'playht', category: 'voice_speech', nodeType: 'n8n-nodes-base.httpRequest' },
  { name: 'Murf AI', slug: 'murf', category: 'voice_speech', nodeType: 'n8n-nodes-base.httpRequest' },
  { name: 'Mailchimp', slug: 'mailchimp', category: 'marketing', nodeType: 'n8n-nodes-base.mailchimp' },
  { name: 'ActiveCampaign', slug: 'activecampaign', category: 'marketing', nodeType: 'n8n-nodes-base.activeCampaign' },
  { name: 'SendGrid', slug: 'sendgrid', category: 'marketing', nodeType: 'n8n-nodes-base.sendGrid' },
  { name: 'Brevo', slug: 'brevo', category: 'marketing', nodeType: 'n8n-nodes-base.httpRequest' },
  { name: 'ConvertKit', slug: 'convertkit', category: 'marketing', nodeType: 'n8n-nodes-base.convertKit' },
  { name: 'Slack', slug: 'slack', category: 'communication', nodeType: 'n8n-nodes-base.slack' },
  { name: 'Microsoft Teams', slug: 'microsoft-teams', category: 'communication', nodeType: 'n8n-nodes-base.microsoftTeams' },
  { name: 'Telegram', slug: 'telegram', category: 'communication', nodeType: 'n8n-nodes-base.telegram' },
  { name: 'WhatsApp', slug: 'whatsapp', category: 'communication', nodeType: 'n8n-nodes-base.httpRequest' },
  { name: 'Discord', slug: 'discord', category: 'communication', nodeType: 'n8n-nodes-base.discord' },
  { name: 'Zendesk', slug: 'zendesk', category: 'support', nodeType: 'n8n-nodes-base.zendesk' },
  { name: 'Freshdesk', slug: 'freshdesk', category: 'support', nodeType: 'n8n-nodes-base.freshdesk' },
  { name: 'Intercom', slug: 'intercom', category: 'support', nodeType: 'n8n-nodes-base.intercom' },
  { name: 'Help Scout', slug: 'helpscout', category: 'support', nodeType: 'n8n-nodes-base.helpScout' },
  { name: 'Front', slug: 'front', category: 'support', nodeType: 'n8n-nodes-base.httpRequest' },
  { name: 'Google Calendar', slug: 'google-calendar', category: 'calendar', nodeType: 'n8n-nodes-base.googleCalendar' },
  { name: 'Calendly', slug: 'calendly', category: 'calendar', nodeType: 'n8n-nodes-base.calendlyTrigger' },
  { name: 'Cal.com', slug: 'cal-com', category: 'calendar', nodeType: 'n8n-nodes-base.httpRequest' },
  { name: 'Microsoft Outlook', slug: 'microsoft-outlook', category: 'calendar', nodeType: 'n8n-nodes-base.microsoftOutlook' },
  { name: 'Acuity Scheduling', slug: 'acuity-scheduling', category: 'calendar', nodeType: 'n8n-nodes-base.acuitySchedulingTrigger' },
  { name: 'Stripe', slug: 'stripe', category: 'ecommerce', nodeType: 'n8n-nodes-base.stripe' },
  { name: 'Shopify', slug: 'shopify', category: 'ecommerce', nodeType: 'n8n-nodes-base.shopify' },
  { name: 'WooCommerce', slug: 'woocommerce', category: 'ecommerce', nodeType: 'n8n-nodes-base.wooCommerce' },
  { name: 'Google Analytics', slug: 'google-analytics', category: 'analytics', nodeType: 'n8n-nodes-base.googleAnalytics' },
  { name: 'Mixpanel', slug: 'mixpanel', category: 'analytics', nodeType: 'n8n-nodes-base.httpRequest' },
  { name: 'Segment', slug: 'segment', category: 'analytics', nodeType: 'n8n-nodes-base.httpRequest' },
  { name: 'Zapier', slug: 'zapier', category: 'automation', nodeType: 'n8n-nodes-base.httpRequest' },
  { name: 'Make', slug: 'make', category: 'automation', nodeType: 'n8n-nodes-base.httpRequest' },
  { name: 'n8n', slug: 'n8n', category: 'automation', nodeType: 'n8n-nodes-base.httpRequest' },
  { name: 'Google Sheets', slug: 'google-sheets', category: 'data_storage', nodeType: 'n8n-nodes-base.googleSheets' },
  { name: 'Airtable', slug: 'airtable', category: 'data_storage', nodeType: 'n8n-nodes-base.airtable' },
  { name: 'Notion', slug: 'notion', category: 'data_storage', nodeType: 'n8n-nodes-base.notion' },
  { name: 'Supabase', slug: 'supabase', category: 'data_storage', nodeType: 'n8n-nodes-base.supabase' },
  { name: 'Firebase', slug: 'firebase', category: 'data_storage', nodeType: 'n8n-nodes-base.httpRequest' },
  { name: 'AWS S3', slug: 'aws-s3', category: 'data_storage', nodeType: 'n8n-nodes-base.awsS3' },
  { name: 'Monday.com', slug: 'monday-com', category: 'data_storage', nodeType: 'n8n-nodes-base.mondayCom' },
  { name: 'BambooHR', slug: 'bamboohr', category: 'hr_recruiting', nodeType: 'n8n-nodes-base.bambooHr' },
  { name: 'Greenhouse', slug: 'greenhouse', category: 'hr_recruiting', nodeType: 'n8n-nodes-base.httpRequest' },
  { name: 'Lever', slug: 'lever', category: 'hr_recruiting', nodeType: 'n8n-nodes-base.httpRequest' },
];

interface TestResult {
  name: string;
  slug: string;
  category: string;
  nodeType: string;
  status: 'success' | 'failed';
  workflowId?: string;
  error?: string;
}

async function createTestWorkflow(integration: typeof INTEGRATIONS[0]): Promise<TestResult> {
  try {
    const webhookPath = `test-loop9-${integration.slug}`;
    const nodes = [
      {
        parameters: { path: webhookPath, httpMethod: 'POST', responseMode: 'onReceived', options: {} },
        name: 'Loop9 Webhook',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 1,
        position: [250, 300],
      },
      {
        parameters: {},
        name: integration.name,
        type: integration.nodeType,
        typeVersion: 1,
        position: [470, 300],
      },
    ];

    const connections = {
      'Loop9 Webhook': { main: [[{ node: integration.name, type: 'main', index: 0 }]] },
    };

    const result = await n8nFetch('/workflows', {
      method: 'POST',
      body: JSON.stringify({
        name: `[TEST] Loop9 → ${integration.name}`,
        nodes,
        connections,
        settings: { executionOrder: 'v1' },
      }),
    });

    return {
      name: integration.name,
      slug: integration.slug,
      category: integration.category,
      nodeType: integration.nodeType,
      status: 'success',
      workflowId: result.id,
    };
  } catch (error: any) {
    return {
      name: integration.name,
      slug: integration.slug,
      category: integration.category,
      nodeType: integration.nodeType,
      status: 'failed',
      error: error.message,
    };
  }
}

async function main() {
  console.log('='.repeat(70));
  console.log('  n8n Integration Test — Creating Test Workflows');
  console.log(`  n8n URL: ${N8N_BASE_URL}`);
  console.log(`  Total integrations: ${INTEGRATIONS.length}`);
  console.log('='.repeat(70));
  console.log('');

  const results: TestResult[] = [];
  const workflowIds: string[] = [];

  for (let i = 0; i < INTEGRATIONS.length; i++) {
    const integration = INTEGRATIONS[i];
    const result = await createTestWorkflow(integration);
    results.push(result);
    if (result.workflowId) workflowIds.push(result.workflowId);

    const icon = result.status === 'success' ? '[OK]' : '[FAIL]';
    const extra = result.error ? ` — ${result.error.substring(0, 80)}` : ` — workflow ${result.workflowId}`;
    console.log(`  ${String(i + 1).padStart(3)}. ${icon} ${result.name} (${result.category})${extra}`);

    await new Promise(r => setTimeout(r, 300));
  }

  const succeeded = results.filter(r => r.status === 'success');
  const failed = results.filter(r => r.status === 'failed');

  console.log('');
  console.log('='.repeat(70));
  console.log('  RESULTS SUMMARY');
  console.log('='.repeat(70));
  console.log(`  Total:     ${results.length}`);
  console.log(`  Succeeded: ${succeeded.length}`);
  console.log(`  Failed:    ${failed.length}`);
  console.log('');

  if (failed.length > 0) {
    console.log('  FAILED INTEGRATIONS:');
    const byCategory: Record<string, TestResult[]> = {};
    for (const f of failed) {
      if (!byCategory[f.category]) byCategory[f.category] = [];
      byCategory[f.category].push(f);
    }
    for (const [cat, items] of Object.entries(byCategory)) {
      console.log(`    [${cat}]`);
      for (const item of items) {
        console.log(`      - ${item.name}: ${item.error?.substring(0, 100)}`);
      }
    }
    console.log('');
  }

  if (succeeded.length > 0) {
    console.log('  SUCCEEDED BY CATEGORY:');
    const byCategory: Record<string, TestResult[]> = {};
    for (const s of succeeded) {
      if (!byCategory[s.category]) byCategory[s.category] = [];
      byCategory[s.category].push(s);
    }
    for (const [cat, items] of Object.entries(byCategory)) {
      console.log(`    [${cat}] ${items.map(i => i.name).join(', ')}`);
    }
    console.log('');
  }

  console.log(`  Created workflow IDs (for cleanup): ${workflowIds.length} workflows`);
  console.log(`  To delete all test workflows, run with --cleanup flag`);
  console.log('');

  if (process.argv.includes('--cleanup') || process.argv.includes('cleanup')) {
    console.log('  CLEANUP: Deleting all test workflows...');
    let deleted = 0;
    for (const id of workflowIds) {
      try {
        await n8nFetch(`/workflows/${id}`, { method: 'DELETE' });
        deleted++;
      } catch (e: any) {
        console.log(`    Failed to delete workflow ${id}: ${e.message}`);
      }
    }
    console.log(`  Deleted ${deleted}/${workflowIds.length} test workflows`);
  } else {
    const idsJson = JSON.stringify(workflowIds);
    console.log(`  WORKFLOW_IDS=${idsJson}`);
  }
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
