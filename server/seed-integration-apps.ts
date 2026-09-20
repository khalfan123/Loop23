'use strict';
import { db } from './db';
import { integrationApps } from '@shared/schema';

const INTEGRATION_APPS = [
  // ═══════════════════════════════════════════
  // CRM — Auto-create leads and log call activity
  // ═══════════════════════════════════════════
  {
    name: 'Salesforce',
    slug: 'salesforce',
    description: 'Auto-create leads, log call activities, and sync contact data after every AI conversation in Salesforce CRM.',
    category: 'crm',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.salesforce',
    isPopular: true,
    isActive: true,
  },
  {
    name: 'HubSpot',
    slug: 'hubspot',
    description: 'Push call outcomes, create deals, and update contact timelines in HubSpot automatically after each call.',
    category: 'crm',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.hubspot',
    isPopular: true,
    isActive: true,
  },
  {
    name: 'Zoho CRM',
    slug: 'zoho',
    description: 'Sync leads and call logs to Zoho CRM so your sales team always has up-to-date conversation data.',
    category: 'crm',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.zohoCrm',
    isPopular: true,
    isActive: true,
  },
  {
    name: 'Pipedrive',
    slug: 'pipedrive',
    description: 'Update sales pipelines and log call activities in Pipedrive automatically from AI agent conversations.',
    category: 'crm',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.pipedrive',
    isPopular: false,
    isActive: true,
  },
  {
    name: 'Freshsales',
    slug: 'freshsales',
    description: 'Log call outcomes and update lead scores in Freshsales based on AI agent conversation results.',
    category: 'crm',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.freshworksCrm',
    isPopular: false,
    isActive: true,
  },
  {
    name: 'Microsoft Dynamics 365',
    slug: 'dynamics365',
    description: 'Sync call data with Dynamics 365 to create phone call activities and update lead qualifications.',
    category: 'crm',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.microsoftDynamicsCrm',
    isPopular: false,
    isActive: true,
  },
  {
    name: 'Close CRM',
    slug: 'close-crm',
    description: 'Auto-log calls and update lead statuses in Close CRM after every AI agent interaction.',
    category: 'crm',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.closeCrm',
    isPopular: false,
    isActive: true,
  },
  {
    name: 'Copper CRM',
    slug: 'copper-crm',
    description: 'Push call summaries and create new contacts in Copper CRM from AI-handled conversations.',
    category: 'crm',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.copper',
    isPopular: false,
    isActive: true,
  },
  {
    name: 'GoHighLevel',
    slug: 'gohighlevel',
    description: 'Sync call outcomes, trigger follow-up workflows, and update contacts in GoHighLevel automatically.',
    category: 'crm',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.httpRequest',
    isPopular: false,
    isActive: true,
  },
  {
    name: 'Keap (Infusionsoft)',
    slug: 'keap',
    description: 'Create contacts, tag leads, and trigger campaigns in Keap based on AI call outcomes.',
    category: 'crm',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.keap',
    isPopular: false,
    isActive: true,
  },
  {
    name: 'SugarCRM',
    slug: 'sugarcrm',
    description: 'Log AI agent call activities and sync lead data with SugarCRM for complete sales visibility.',
    category: 'crm',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.sugarCrm',
    isPopular: false,
    isActive: true,
  },
  {
    name: 'Bitrix24',
    slug: 'bitrix24',
    description: 'Push call recordings and lead data to Bitrix24 CRM for centralized customer management.',
    category: 'crm',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.bitrix24',
    isPopular: false,
    isActive: true,
  },
  {
    name: 'Insightly',
    slug: 'insightly',
    description: 'Create leads and log call notes in Insightly CRM from every AI agent conversation.',
    category: 'crm',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.insightly',
    isPopular: false,
    isActive: true,
  },
  {
    name: 'Odoo CRM',
    slug: 'odoo',
    description: 'Create leads, log call activities, and update opportunities in Odoo CRM after every AI conversation.',
    category: 'crm',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.httpRequest',
    isPopular: false,
    isActive: true,
  },

  // ═══════════════════════════════════════════
  // (Removed) Telephony, AI & LLM, Voice & Speech integration seeds
  // per product decision to hide these categories from the marketplace.

  // ═══════════════════════════════════════════
  // Marketing & Email — Nurture leads from calls
  // ═══════════════════════════════════════════
  {
    name: 'Mailchimp',
    slug: 'mailchimp',
    description: 'Add leads captured from AI calls to Mailchimp audiences for automated email nurture campaigns.',
    category: 'marketing',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.mailchimp',
    isPopular: false,
    isActive: true,
  },
  {
    name: 'ActiveCampaign',
    slug: 'activecampaign',
    description: 'Trigger email automations and tag contacts in ActiveCampaign based on AI call outcomes.',
    category: 'marketing',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.activeCampaign',
    isPopular: false,
    isActive: true,
  },
  {
    name: 'SendGrid',
    slug: 'sendgrid',
    description: 'Send transactional emails and follow-ups via SendGrid after AI agent conversations.',
    category: 'marketing',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.sendGrid',
    isPopular: false,
    isActive: true,
  },
  {
    name: 'Brevo (Sendinblue)',
    slug: 'brevo',
    description: 'Sync call leads to Brevo for email/SMS marketing campaigns and transactional messaging.',
    category: 'marketing',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.sendInBlue',
    isPopular: false,
    isActive: true,
  },
  {
    name: 'ConvertKit',
    slug: 'convertkit',
    description: 'Add call contacts to ConvertKit subscriber lists and trigger tag-based email sequences.',
    category: 'marketing',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.convertKit',
    isPopular: false,
    isActive: true,
  },

  // ═══════════════════════════════════════════
  // Communication & Messaging — Team notifications
  // ═══════════════════════════════════════════
  {
    name: 'Slack',
    slug: 'slack',
    description: 'Send real-time Slack notifications when AI calls complete, leads are captured, or issues arise.',
    category: 'communication',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.slack',
    isPopular: true,
    isActive: true,
  },
  {
    name: 'Microsoft Teams',
    slug: 'microsoft-teams',
    description: 'Post call summaries and alerts to Microsoft Teams channels for instant team awareness.',
    category: 'communication',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.microsoftTeams',
    isPopular: false,
    isActive: true,
  },
  {
    name: 'Telegram',
    slug: 'telegram',
    description: 'Receive call completion alerts and lead notifications via Telegram bot messages.',
    category: 'communication',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.telegram',
    isPopular: false,
    isActive: true,
  },
  {
    name: 'WhatsApp Business',
    slug: 'whatsapp',
    description: 'Send WhatsApp follow-up messages to contacts after AI agent calls for continued engagement.',
    category: 'communication',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.whatsApp',
    isPopular: false,
    isActive: true,
  },
  {
    name: 'Discord',
    slug: 'discord',
    description: 'Post call activity updates and campaign reports to Discord channels for team collaboration.',
    category: 'communication',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.discord',
    isPopular: false,
    isActive: true,
  },

  // ═══════════════════════════════════════════
  // Customer Support — Create tickets from calls
  // ═══════════════════════════════════════════
  {
    name: 'Zendesk',
    slug: 'zendesk',
    description: 'Auto-create support tickets in Zendesk from unresolved AI call issues and customer complaints.',
    category: 'support',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.zendesk',
    isPopular: false,
    isActive: true,
  },
  {
    name: 'Freshdesk',
    slug: 'freshdesk',
    description: 'Generate Freshdesk tickets with call transcripts when AI agents escalate customer issues.',
    category: 'support',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.freshdesk',
    isPopular: false,
    isActive: true,
  },
  {
    name: 'Intercom',
    slug: 'intercom',
    description: 'Create Intercom conversations and update contact profiles from AI agent call interactions.',
    category: 'support',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.intercom',
    isPopular: false,
    isActive: true,
  },
  {
    name: 'Help Scout',
    slug: 'helpscout',
    description: 'Push call summaries and create Help Scout conversations for seamless customer support handoff.',
    category: 'support',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.helpScout',
    isPopular: false,
    isActive: true,
  },
  {
    name: 'Front',
    slug: 'front',
    description: 'Route call-related messages to Front inboxes for team collaboration on customer follow-ups.',
    category: 'support',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.httpRequest',
    isPopular: false,
    isActive: true,
  },

  // ═══════════════════════════════════════════
  // Calendar & Scheduling — Book appointments during calls
  // ═══════════════════════════════════════════
  {
    name: 'Google Calendar',
    slug: 'google-calendar',
    description: 'Let AI agents book meetings and appointments directly into Google Calendar during live calls.',
    category: 'calendar',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.googleCalendar',
    isPopular: true,
    isActive: true,
  },
  {
    name: 'Calendly',
    slug: 'calendly',
    description: 'Schedule appointments through Calendly when AI agents qualify leads during conversations.',
    category: 'calendar',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.calendly',
    isPopular: false,
    isActive: true,
  },
  {
    name: 'Cal.com',
    slug: 'cal-com',
    description: 'Open-source scheduling — let AI agents book calls and demos via Cal.com during conversations.',
    category: 'calendar',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.httpRequest',
    isPopular: false,
    isActive: true,
  },
  {
    name: 'Microsoft Outlook Calendar',
    slug: 'microsoft-outlook',
    description: 'Book meetings in Microsoft Outlook Calendar when AI agents schedule follow-ups with prospects.',
    category: 'calendar',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.microsoftOutlook',
    isPopular: false,
    isActive: true,
  },
  {
    name: 'Acuity Scheduling',
    slug: 'acuity-scheduling',
    description: 'Schedule client appointments through Acuity Scheduling during AI-powered phone conversations.',
    category: 'calendar',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.httpRequest',
    isPopular: false,
    isActive: true,
  },

  // ═══════════════════════════════════════════
  // E-Commerce & Payments — Process orders from calls
  // ═══════════════════════════════════════════
  {
    name: 'Stripe',
    slug: 'stripe',
    description: 'Process payments and look up subscription details discussed during AI agent calls.',
    category: 'ecommerce',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.stripe',
    isPopular: false,
    isActive: true,
  },
  {
    name: 'Shopify',
    slug: 'shopify',
    description: 'Look up orders, check product availability, and assist customers via AI calls on Shopify stores.',
    category: 'ecommerce',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.shopify',
    isPopular: false,
    isActive: true,
  },
  {
    name: 'WooCommerce',
    slug: 'woocommerce',
    description: 'Query WooCommerce orders and product data during AI-assisted customer support calls.',
    category: 'ecommerce',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.wooCommerce',
    isPopular: false,
    isActive: true,
  },

  // ═══════════════════════════════════════════
  // Analytics & Reporting — Track call performance
  // ═══════════════════════════════════════════
  {
    name: 'Google Analytics',
    slug: 'google-analytics',
    description: 'Track call conversions and campaign performance as events in Google Analytics.',
    category: 'analytics',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.googleAnalytics',
    isPopular: false,
    isActive: true,
  },
  {
    name: 'Mixpanel',
    slug: 'mixpanel',
    description: 'Send call events and conversion data to Mixpanel for detailed funnel and retention analysis.',
    category: 'analytics',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.httpRequest',
    isPopular: false,
    isActive: true,
  },
  {
    name: 'Segment',
    slug: 'segment',
    description: 'Route call event data through Segment to all your analytics and marketing destinations.',
    category: 'analytics',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.httpRequest',
    isPopular: false,
    isActive: true,
  },

  // ═══════════════════════════════════════════
  // Automation & Workflow — Chain call events
  // ═══════════════════════════════════════════
  {
    name: 'Zapier',
    slug: 'zapier',
    description: 'Trigger 5,000+ app automations from AI call events using Zapier webhooks and workflows.',
    category: 'automation',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.httpRequest',
    isPopular: true,
    isActive: true,
  },
  {
    name: 'Make (Integromat)',
    slug: 'make',
    description: 'Build visual automation scenarios triggered by AI call completions and lead captures via Make.',
    category: 'automation',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.httpRequest',
    isPopular: false,
    isActive: true,
  },
  {
    name: 'n8n',
    slug: 'n8n',
    description: 'Create self-hosted workflow automations with n8n triggered by AI agent call events.',
    category: 'automation',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.httpRequest',
    isPopular: false,
    isActive: true,
  },

  // ═══════════════════════════════════════════
  // Data & Storage — Store transcripts and exports
  // ═══════════════════════════════════════════
  {
    name: 'Google Sheets',
    slug: 'google-sheets',
    description: 'Export call data, transcripts, and campaign results to Google Sheets for reporting and analysis.',
    category: 'data_storage',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.googleSheets',
    isPopular: true,
    isActive: true,
  },
  {
    name: 'Airtable',
    slug: 'airtable',
    description: 'Sync call records and lead data to Airtable bases for flexible, visual data management.',
    category: 'data_storage',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.airtable',
    isPopular: false,
    isActive: true,
  },
  {
    name: 'Notion',
    slug: 'notion',
    description: 'Push call summaries and meeting notes to Notion databases for organized team knowledge.',
    category: 'data_storage',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.notion',
    isPopular: false,
    isActive: true,
  },
  {
    name: 'Supabase',
    slug: 'supabase',
    description: 'Store call data, transcripts, and analytics in Supabase PostgreSQL for custom dashboards.',
    category: 'data_storage',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.httpRequest',
    isPopular: false,
    isActive: true,
  },
  {
    name: 'Firebase',
    slug: 'firebase',
    description: 'Sync call events and user data to Firebase Firestore for real-time mobile app integration.',
    category: 'data_storage',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.httpRequest',
    isPopular: false,
    isActive: true,
  },
  {
    name: 'AWS S3',
    slug: 'aws-s3',
    description: 'Store call recordings, transcripts, and exported data securely in Amazon S3 buckets.',
    category: 'data_storage',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.awsS3',
    isPopular: false,
    isActive: true,
  },
  {
    name: 'Monday.com',
    slug: 'monday-com',
    description: 'Create board items and update project status in Monday.com from AI call events and outcomes.',
    category: 'data_storage',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.mondayCom',
    isPopular: false,
    isActive: true,
  },

  // ═══════════════════════════════════════════
  // HR & Recruiting — Automate screening calls
  // ═══════════════════════════════════════════
  {
    name: 'BambooHR',
    slug: 'bamboohr',
    description: 'Sync AI screening call results and candidate data to BambooHR for streamlined hiring workflows.',
    category: 'hr_recruiting',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.bambooHr',
    isPopular: false,
    isActive: true,
  },
  {
    name: 'Greenhouse',
    slug: 'greenhouse',
    description: 'Log AI recruiter call outcomes and move candidates through Greenhouse hiring pipeline stages.',
    category: 'hr_recruiting',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.httpRequest',
    isPopular: false,
    isActive: true,
  },
  {
    name: 'Lever',
    slug: 'lever',
    description: 'Push AI screening call notes and candidate scores to Lever for data-driven recruiting decisions.',
    category: 'hr_recruiting',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.httpRequest',
    isPopular: false,
    isActive: true,
  },
];

export async function seedIntegrationApps() {
  console.log('Seeding integration apps...');

  for (const app of INTEGRATION_APPS) {
    try {
      await db
        .insert(integrationApps)
        .values(app)
        .onConflictDoUpdate({
          target: integrationApps.slug,
          set: {
            name: app.name,
            description: app.description,
            category: app.category,
            logoUrl: app.logoUrl,
            n8nNodeType: app.n8nNodeType,
            isPopular: app.isPopular,
            isActive: app.isActive,
          },
        });
    } catch (error) {
      console.error(`Failed to seed ${app.name}:`, error);
    }
  }

  console.log(`Seeded ${INTEGRATION_APPS.length} integration apps.`);
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  seedIntegrationApps()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
