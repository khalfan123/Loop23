'use strict';
import { db } from './db';
import { integrationApps } from '@shared/schema';

const INTEGRATION_APPS = [
  {
    name: 'Salesforce',
    slug: 'salesforce',
    description: 'Sync Loop9 calls with Salesforce CRM — create leads, contacts, and activities automatically.',
    category: 'crm',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.salesforce',
    isPopular: true,
    isActive: true,
  },
  {
    name: 'HubSpot',
    slug: 'hubspot',
    description: 'Connect HubSpot CRM to track calls, leads, and customer interactions in real time.',
    category: 'crm',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.hubspot',
    isPopular: true,
    isActive: true,
  },
  {
    name: 'Zoho CRM',
    slug: 'zoho',
    description: 'Integrate with Zoho CRM to manage customer data and automate lead workflows.',
    category: 'crm',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.zohoCrm',
    isPopular: true,
    isActive: true,
  },
  {
    name: 'Google Sheets',
    slug: 'google-sheets',
    description: 'Export call data to Google Sheets for reporting, analysis, and custom dashboards.',
    category: 'productivity',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.googleSheets',
    isPopular: true,
    isActive: true,
  },
  {
    name: 'Pipedrive',
    slug: 'pipedrive',
    description: 'Track sales pipeline and deals in Pipedrive automatically from Loop9 calls.',
    category: 'crm',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.pipedrive',
    isPopular: false,
    isActive: true,
  },
  {
    name: 'Microsoft Dynamics 365',
    slug: 'dynamics365',
    description: 'Enterprise CRM and ERP integration with Microsoft Dynamics 365.',
    category: 'crm',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.microsoftDynamicsCrm',
    isPopular: false,
    isActive: true,
  },
  {
    name: 'Slack',
    slug: 'slack',
    description: 'Get real-time notifications in Slack channels when calls complete or leads are created.',
    category: 'communication',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.slack',
    isPopular: false,
    isActive: true,
  },
  {
    name: 'Airtable',
    slug: 'airtable',
    description: 'Sync call data and leads to Airtable bases for flexible data management.',
    category: 'productivity',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.airtable',
    isPopular: false,
    isActive: true,
  },
  {
    name: 'Mailchimp',
    slug: 'mailchimp',
    description: 'Add leads and contacts to Mailchimp audiences for email marketing campaigns.',
    category: 'marketing',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.mailchimp',
    isPopular: false,
    isActive: true,
  },
  {
    name: 'Freshsales',
    slug: 'freshsales',
    description: 'Sync call outcomes and lead data to Freshworks Freshsales CRM.',
    category: 'crm',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.freshworksCrm',
    isPopular: false,
    isActive: true,
  },
  {
    name: 'Monday.com',
    slug: 'monday-com',
    description: 'Create items and update boards in Monday.com from Loop9 call events.',
    category: 'productivity',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.mondayCom',
    isPopular: false,
    isActive: true,
  },
  {
    name: 'Intercom',
    slug: 'intercom',
    description: 'Create contacts and conversations in Intercom from Loop9 call data.',
    category: 'communication',
    logoUrl: null,
    n8nNodeType: 'n8n-nodes-base.intercom',
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
