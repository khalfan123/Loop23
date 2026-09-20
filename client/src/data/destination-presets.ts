// ─── Destination presets for the generic-HTTP wizard ─────────────────
//
// Each preset prefills the "Actions" step (URL, method, headers, body
// template, auth type) so users only have to provide credentials.
// Apps without a preset fall back to a blank generic form.

import type { GenericAuthType } from "./destination-types";

export interface DestinationPreset {
  /** App slug from /api/integrations/apps */
  slug: string;
  /** Default API URL for the action. Supports {{cred.<id>}} templating. */
  url: string;
  /** HTTP method. */
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Auth type for the request. */
  authType: GenericAuthType;
  /** Auth-specific credential field metadata. Stored on the recipe. */
  credentialFields: Array<{
    id: string;
    label: string;
    secret?: boolean;
    placeholder?: string;
  }>;
  /** Static header rows. */
  headers?: Array<{ name: string; value: string }>;
  /** JSON body template. Use {{trigger.<field>}} for payload interpolation. */
  bodyTemplate?: string;
  /** A short, human-readable summary of what gets sent. */
  actionSummary: string;
}

export const DESTINATION_PRESETS: Record<string, DestinationPreset> = {
  salesforce: {
    slug: "salesforce",
    url: "{{cred.instanceUrl}}/services/data/v58.0/sobjects/Lead",
    method: "POST",
    authType: "bearer",
    credentialFields: [
      { id: "instanceUrl", label: "Salesforce instance URL", placeholder: "https://acme.my.salesforce.com" },
      { id: "accessToken", label: "Access token", secret: true },
    ],
    headers: [{ name: "Content-Type", value: "application/json" }],
    bodyTemplate: `{
  "FirstName": "{{trigger.data.contact.firstName}}",
  "LastName": "{{trigger.data.contact.lastName}}",
  "Phone": "{{trigger.data.fromNumber}}",
  "Company": "{{trigger.data.contact.company}}"
}`,
    actionSummary: "Create a Salesforce Lead from the call payload.",
  },
  pipedrive: {
    slug: "pipedrive",
    url: "https://api.pipedrive.com/v1/persons?api_token={{cred.apiToken}}",
    method: "POST",
    authType: "none",
    credentialFields: [
      { id: "apiToken", label: "Pipedrive API token", secret: true },
    ],
    headers: [{ name: "Content-Type", value: "application/json" }],
    bodyTemplate: `{
  "name": "{{trigger.data.contact.name}}",
  "phone": "{{trigger.data.fromNumber}}"
}`,
    actionSummary: "Create a Pipedrive person from the caller details.",
  },
  odoo: {
    slug: "odoo",
    url: "{{cred.baseUrl}}/web/dataset/call_kw",
    method: "POST",
    authType: "header",
    credentialFields: [
      { id: "baseUrl", label: "Odoo base URL", placeholder: "https://acme.odoo.com" },
      { id: "database", label: "Odoo database name", placeholder: "acme-prod" },
      { id: "apiKey", label: "Odoo API key (X-Openerp-Session-Id or API key)", secret: true },
    ],
    headers: [
      { name: "Content-Type", value: "application/json" },
      { name: "X-Openerp-Session-Id", value: "{{cred.apiKey}}" },
    ],
    bodyTemplate: `{
  "jsonrpc": "2.0",
  "method": "call",
  "params": {
    "model": "crm.lead",
    "method": "create",
    "args": [{
      "name": "{{trigger.data.contact.name}} — {{trigger.event}}",
      "phone": "{{trigger.data.fromNumber}}",
      "email_from": "{{trigger.data.contact.email}}",
      "description": "{{trigger.data.transcriptSummary}}"
    }],
    "kwargs": {}
  }
}`,
    actionSummary: "Create an Odoo CRM lead (crm.lead) from the call payload.",
  },
  zoho: {
    slug: "zoho",
    url: "https://www.zohoapis.com/crm/v5/Leads",
    method: "POST",
    authType: "header",
    credentialFields: [
      { id: "oauthToken", label: "Zoho OAuth token", secret: true },
    ],
    headers: [{ name: "Content-Type", value: "application/json" }],
    bodyTemplate: `{
  "data": [{
    "Last_Name": "{{trigger.data.contact.lastName}}",
    "Phone": "{{trigger.data.fromNumber}}"
  }]
}`,
    actionSummary: "Create a Zoho CRM lead from the call payload.",
  },
  notion: {
    slug: "notion",
    url: "https://api.notion.com/v1/pages",
    method: "POST",
    authType: "bearer",
    credentialFields: [
      { id: "integrationToken", label: "Notion integration token", secret: true },
      { id: "databaseId", label: "Notion database ID" },
    ],
    headers: [
      { name: "Content-Type", value: "application/json" },
      { name: "Notion-Version", value: "2022-06-28" },
    ],
    bodyTemplate: `{
  "parent": { "database_id": "{{cred.databaseId}}" },
  "properties": {
    "Name": { "title": [{ "text": { "content": "{{trigger.event}}" } }] }
  }
}`,
    actionSummary: "Append a new Notion page summarising the event.",
  },
  airtable: {
    slug: "airtable",
    url: "https://api.airtable.com/v0/{{cred.baseId}}/{{cred.tableName}}",
    method: "POST",
    authType: "bearer",
    credentialFields: [
      { id: "apiKey", label: "Airtable personal access token", secret: true },
      { id: "baseId", label: "Airtable base ID" },
      { id: "tableName", label: "Airtable table name" },
    ],
    headers: [{ name: "Content-Type", value: "application/json" }],
    bodyTemplate: `{
  "fields": {
    "Event": "{{trigger.event}}",
    "Phone": "{{trigger.data.fromNumber}}",
    "Summary": "{{trigger.data.transcriptSummary}}"
  }
}`,
    actionSummary: "Append a row to the configured Airtable table.",
  },
  "google-sheets": {
    slug: "google-sheets",
    url: "https://sheets.googleapis.com/v4/spreadsheets/{{cred.spreadsheetId}}/values/{{cred.range}}:append?valueInputOption=USER_ENTERED",
    method: "POST",
    authType: "bearer",
    credentialFields: [
      { id: "accessToken", label: "Google access token", secret: true },
      { id: "spreadsheetId", label: "Spreadsheet ID" },
      { id: "range", label: "Sheet range", placeholder: "Sheet1!A1" },
    ],
    headers: [{ name: "Content-Type", value: "application/json" }],
    bodyTemplate: `{
  "values": [["{{trigger.event}}", "{{trigger.data.fromNumber}}", "{{trigger.data.transcriptSummary}}"]]
}`,
    actionSummary: "Append a row to the configured Google Sheet.",
  },
  "microsoft-teams": {
    slug: "microsoft-teams",
    url: "{{cred.webhookUrl}}",
    method: "POST",
    authType: "none",
    credentialFields: [
      { id: "webhookUrl", label: "Teams Incoming Webhook URL", secret: true },
    ],
    headers: [{ name: "Content-Type", value: "application/json" }],
    bodyTemplate: `{
  "text": "{{trigger.event}} from {{trigger.data.fromNumber}}"
}`,
    actionSummary: "Post a Teams channel message via Incoming Webhook.",
  },
  discord: {
    slug: "discord",
    url: "{{cred.webhookUrl}}",
    method: "POST",
    authType: "none",
    credentialFields: [
      { id: "webhookUrl", label: "Discord webhook URL", secret: true },
    ],
    headers: [{ name: "Content-Type", value: "application/json" }],
    bodyTemplate: `{
  "content": "{{trigger.event}} from {{trigger.data.fromNumber}}"
}`,
    actionSummary: "Post a Discord channel message via webhook.",
  },
  telegram: {
    slug: "telegram",
    url: "https://api.telegram.org/bot{{cred.botToken}}/sendMessage",
    method: "POST",
    authType: "none",
    credentialFields: [
      { id: "botToken", label: "Telegram bot token", secret: true },
      { id: "chatId", label: "Telegram chat ID" },
    ],
    headers: [{ name: "Content-Type", value: "application/json" }],
    bodyTemplate: `{
  "chat_id": "{{cred.chatId}}",
  "text": "{{trigger.event}} from {{trigger.data.fromNumber}}"
}`,
    actionSummary: "Send a Telegram bot message to the configured chat.",
  },
  zapier: {
    slug: "zapier",
    url: "{{cred.zapHookUrl}}",
    method: "POST",
    authType: "none",
    credentialFields: [
      { id: "zapHookUrl", label: "Zapier catch-hook URL", secret: true },
    ],
    headers: [{ name: "Content-Type", value: "application/json" }],
    bodyTemplate: `{
  "event": "{{trigger.event}}",
  "data": "{{trigger.data}}"
}`,
    actionSummary: "Forward the event to a Zapier catch-hook.",
  },
  make: {
    slug: "make",
    url: "{{cred.scenarioHookUrl}}",
    method: "POST",
    authType: "none",
    credentialFields: [
      { id: "scenarioHookUrl", label: "Make scenario webhook URL", secret: true },
    ],
    headers: [{ name: "Content-Type", value: "application/json" }],
    bodyTemplate: `{
  "event": "{{trigger.event}}",
  "data": "{{trigger.data}}"
}`,
    actionSummary: "Forward the event to a Make scenario webhook.",
  },
  n8n: {
    slug: "n8n",
    url: "{{cred.workflowWebhookUrl}}",
    method: "POST",
    authType: "none",
    credentialFields: [
      { id: "workflowWebhookUrl", label: "n8n workflow webhook URL", secret: true },
    ],
    headers: [{ name: "Content-Type", value: "application/json" }],
    bodyTemplate: `{
  "event": "{{trigger.event}}",
  "data": "{{trigger.data}}"
}`,
    actionSummary: "Forward the event to a self-hosted n8n workflow webhook.",
  },
  "google-calendar": {
    slug: "google-calendar",
    url: "https://www.googleapis.com/calendar/v3/calendars/{{cred.calendarId}}/events",
    method: "POST",
    authType: "bearer",
    credentialFields: [
      { id: "accessToken", label: "Google access token", secret: true },
      { id: "calendarId", label: "Calendar ID", placeholder: "primary" },
    ],
    headers: [{ name: "Content-Type", value: "application/json" }],
    bodyTemplate: `{
  "summary": "Follow-up: {{trigger.data.contact.name}}",
  "description": "{{trigger.data.transcriptSummary}}",
  "start": { "dateTime": "{{trigger.data.appointment.start}}" },
  "end": { "dateTime": "{{trigger.data.appointment.end}}" }
}`,
    actionSummary: "Create a Google Calendar event for the follow-up.",
  },
  intercom: {
    slug: "intercom",
    url: "https://api.intercom.io/contacts",
    method: "POST",
    authType: "bearer",
    credentialFields: [
      { id: "accessToken", label: "Intercom access token", secret: true },
    ],
    headers: [
      { name: "Content-Type", value: "application/json" },
      { name: "Intercom-Version", value: "2.10" },
    ],
    bodyTemplate: `{
  "role": "lead",
  "name": "{{trigger.data.contact.name}}",
  "phone": "{{trigger.data.fromNumber}}"
}`,
    actionSummary: "Create or update an Intercom contact.",
  },
  freshdesk: {
    slug: "freshdesk",
    url: "{{cred.domain}}/api/v2/tickets",
    method: "POST",
    authType: "basic",
    credentialFields: [
      { id: "domain", label: "Freshdesk domain", placeholder: "https://acme.freshdesk.com" },
      { id: "apiKey", label: "Freshdesk API key", secret: true },
    ],
    headers: [{ name: "Content-Type", value: "application/json" }],
    bodyTemplate: `{
  "subject": "Call from {{trigger.data.fromNumber}}",
  "description": "{{trigger.data.transcriptSummary}}",
  "phone": "{{trigger.data.fromNumber}}",
  "priority": 2,
  "status": 2
}`,
    actionSummary: "Create a Freshdesk ticket from the call payload.",
  },
};

export function getDestinationPreset(slug: string): DestinationPreset | null {
  return DESTINATION_PRESETS[slug] || null;
}
