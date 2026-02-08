import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation, useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft, CheckCircle2, AlertCircle, Loader2, Plug, Unplug,
  RefreshCw, Clock, Zap, Settings, FileText, ExternalLink,
  Play, XCircle, Plug2, User, Mail, Shield,
  Code, Filter, ChevronDown, ChevronRight,
  Copy, Terminal, ListChecks
} from "lucide-react";
import {
  SiSalesforce, SiHubspot, SiGooglesheets, SiSlack,
  SiMailchimp, SiAirtable, SiTwilio, SiOpenai,
  SiZapier, SiStripe, SiShopify, SiNotion,
  SiFirebase, SiDiscord, SiTelegram, SiWhatsapp,
  SiZendesk, SiIntercom
} from "react-icons/si";
import type { IntegrationApp, UserIntegration, IntegrationSyncLog } from "@shared/schema";

interface IntegrationAppWithOAuth extends IntegrationApp {
  requiresOAuth?: boolean;
  authType?: string;
}

interface ProviderCredentialConfig {
  field1Label: string;
  field1Placeholder: string;
  field2Label: string;
  field2Placeholder: string;
  helpText: string;
  setupUrl: string;
  setupLinkText: string;
  requiresRedirectUri: boolean;
  scopes?: string[];
}

const PROVIDER_CREDENTIAL_CONFIG: Record<string, ProviderCredentialConfig> = {
  salesforce: {
    field1Label: "Consumer Key",
    field1Placeholder: "Enter your Salesforce Consumer Key",
    field2Label: "Consumer Secret",
    field2Placeholder: "Enter your Salesforce Consumer Secret",
    helpText: "Create a Connected App in Salesforce: go to Setup > App Manager > New Connected App. Enable OAuth settings and add the callback URL below. Copy the Consumer Key and Consumer Secret from the app details.",
    setupUrl: "https://login.salesforce.com/",
    setupLinkText: "Open Salesforce Setup",
    requiresRedirectUri: true,
    scopes: ["api", "refresh_token", "full"],
  },
  hubspot: {
    field1Label: "Client ID",
    field1Placeholder: "Enter your HubSpot Client ID",
    field2Label: "Client Secret",
    field2Placeholder: "Enter your HubSpot Client Secret",
    helpText: "Create an app in the HubSpot Developer Portal. Go to your app's Auth settings, add the redirect URL below, and select the required scopes. Copy the Client ID and Client Secret.",
    setupUrl: "https://developers.hubspot.com/",
    setupLinkText: "Open HubSpot Developer Portal",
    requiresRedirectUri: true,
    scopes: ["crm.objects.contacts.read", "crm.objects.contacts.write", "crm.objects.deals.read", "crm.objects.deals.write"],
  },
  zoho: {
    field1Label: "Client ID",
    field1Placeholder: "Enter your Zoho Client ID",
    field2Label: "Client Secret",
    field2Placeholder: "Enter your Zoho Client Secret",
    helpText: "Register a Server-based Application in the Zoho API Console. Add the redirect URL below as an authorized redirect URI. Copy the Client ID and Client Secret.",
    setupUrl: "https://api-console.zoho.com/",
    setupLinkText: "Open Zoho API Console",
    requiresRedirectUri: true,
    scopes: ["ZohoCRM.modules.ALL", "ZohoCRM.settings.ALL"],
  },
  "google-sheets": {
    field1Label: "Client ID",
    field1Placeholder: "Enter your Google Client ID",
    field2Label: "Client Secret",
    field2Placeholder: "Enter your Google Client Secret",
    helpText: "In Google Cloud Console, create an OAuth 2.0 Client ID (Web application type). Add the redirect URL below as an authorized redirect URI. Enable the Google Sheets API and Google People API for your project.",
    setupUrl: "https://console.cloud.google.com/apis/credentials",
    setupLinkText: "Open Google Cloud Console",
    requiresRedirectUri: true,
    scopes: ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"],
  },
  pipedrive: {
    field1Label: "Client ID",
    field1Placeholder: "Enter your Pipedrive Client ID",
    field2Label: "Client Secret",
    field2Placeholder: "Enter your Pipedrive Client Secret",
    helpText: "Create an app in the Pipedrive Developer Hub (Marketplace Manager). Set the callback URL to the redirect URL below. Copy the Client ID and Client Secret from your app settings.",
    setupUrl: "https://developers.pipedrive.com/",
    setupLinkText: "Open Pipedrive Developer Hub",
    requiresRedirectUri: true,
    scopes: ["deals:full", "contacts:full", "activities:full"],
  },
  dynamics365: {
    field1Label: "Application (Client) ID",
    field1Placeholder: "Enter your Azure Application (Client) ID",
    field2Label: "Client Secret",
    field2Placeholder: "Enter your Azure Client Secret value",
    helpText: "Register an application in Azure Portal > App Registrations. Under Authentication, add the redirect URL below as a Web redirect URI. Under Certificates & secrets, create a new Client Secret and copy the value. Grant Dynamics CRM API permissions.",
    setupUrl: "https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade",
    setupLinkText: "Open Azure Portal",
    requiresRedirectUri: true,
    scopes: ["https://org.crm.dynamics.com/.default", "offline_access"],
  },
  freshsales: {
    field1Label: "API Key",
    field1Placeholder: "Enter your Freshsales API Key",
    field2Label: "Domain",
    field2Placeholder: "e.g. yourcompany.freshsales.io",
    helpText: "Find your API Key in Freshsales: go to Settings > API Settings > Your API Key. Your domain is the URL you use to access Freshsales (e.g., yourcompany.freshsales.io).",
    setupUrl: "https://www.freshworks.com/crm/sales/",
    setupLinkText: "Open Freshsales",
    requiresRedirectUri: false,
  },
  "monday-com": {
    field1Label: "Client ID",
    field1Placeholder: "Enter your Monday.com Client ID",
    field2Label: "Client Secret",
    field2Placeholder: "Enter your Monday.com Client Secret",
    helpText: "Create an app at monday.com Developers. Under OAuth settings, add the redirect URL below. Copy the Client ID and Client Secret from the app's Basic Information section.",
    setupUrl: "https://monday.com/developers/apps",
    setupLinkText: "Open Monday.com Developers",
    requiresRedirectUri: true,
    scopes: ["boards:read", "boards:write"],
  },
  airtable: {
    field1Label: "Client ID",
    field1Placeholder: "Enter your Airtable Client ID",
    field2Label: "Client Secret",
    field2Placeholder: "Enter your Airtable Client Secret",
    helpText: "Register an OAuth integration at the Airtable Developer Hub. Add the redirect URL below. Select the required scopes (data.records:read, data.records:write, schema.bases:read). Copy the Client ID and Client Secret.",
    setupUrl: "https://airtable.com/create/oauth",
    setupLinkText: "Open Airtable Developer Hub",
    requiresRedirectUri: true,
    scopes: ["data.records:read", "data.records:write", "schema.bases:read"],
  },
  slack: {
    field1Label: "Client ID",
    field1Placeholder: "Enter your Slack Client ID",
    field2Label: "Client Secret",
    field2Placeholder: "Enter your Slack Client Secret",
    helpText: "Create a Slack App at api.slack.com/apps. Under OAuth & Permissions, add the redirect URL below. Add the required Bot Token Scopes (chat:write, channels:read, users:read). Copy the Client ID and Client Secret from Basic Information.",
    setupUrl: "https://api.slack.com/apps",
    setupLinkText: "Open Slack API",
    requiresRedirectUri: true,
    scopes: ["chat:write", "channels:read", "users:read"],
  },
  mailchimp: {
    field1Label: "Client ID",
    field1Placeholder: "Enter your Mailchimp Client ID",
    field2Label: "Client Secret",
    field2Placeholder: "Enter your Mailchimp Client Secret",
    helpText: "Register an app in the Mailchimp Developer Portal. Add the redirect URL below as a redirect URI. Copy the Client ID and Client Secret from your app settings.",
    setupUrl: "https://login.mailchimp.com/",
    setupLinkText: "Open Mailchimp Developer Portal",
    requiresRedirectUri: true,
    scopes: ["lists:read", "lists:write", "campaigns:read"],
  },
  intercom: {
    field1Label: "Client ID",
    field1Placeholder: "Enter your Intercom Client ID",
    field2Label: "Client Secret",
    field2Placeholder: "Enter your Intercom Client Secret",
    helpText: "Create an app in the Intercom Developer Hub. Under Authentication, add the redirect URL below. Copy the Client ID and Client Secret from your app settings.",
    setupUrl: "https://developers.intercom.com/",
    setupLinkText: "Open Intercom Developer Hub",
    requiresRedirectUri: true,
    scopes: ["read_contacts", "write_contacts", "read_conversations", "write_conversations"],
  },
  twilio: {
    field1Label: "Account SID",
    field1Placeholder: "Enter your Twilio Account SID",
    field2Label: "Auth Token",
    field2Placeholder: "Enter your Twilio Auth Token",
    helpText: "Find your Account SID and Auth Token in the Twilio Console dashboard under Account Info.",
    setupUrl: "https://console.twilio.com/",
    setupLinkText: "Open Twilio Console",
    requiresRedirectUri: false,
  },
  openai: {
    field1Label: "API Key",
    field1Placeholder: "Enter your OpenAI API Key (sk-...)",
    field2Label: "Organization ID",
    field2Placeholder: "Enter your Organization ID (optional)",
    helpText: "Find your API key at platform.openai.com/api-keys. Organization ID is optional and found in Settings > Organization.",
    setupUrl: "https://platform.openai.com/api-keys",
    setupLinkText: "Open OpenAI Platform",
    requiresRedirectUri: false,
  },
  anthropic: {
    field1Label: "API Key",
    field1Placeholder: "Enter your Anthropic API Key",
    field2Label: "Organization ID",
    field2Placeholder: "Enter your Organization ID (optional)",
    helpText: "Generate an API key in the Anthropic Console under API Keys.",
    setupUrl: "https://console.anthropic.com/settings/keys",
    setupLinkText: "Open Anthropic Console",
    requiresRedirectUri: false,
  },
  "google-gemini": {
    field1Label: "API Key",
    field1Placeholder: "Enter your Google AI API Key",
    field2Label: "Project ID",
    field2Placeholder: "Enter your Google Cloud Project ID (optional)",
    helpText: "Get your API key from Google AI Studio or Google Cloud Console with the Generative AI API enabled.",
    setupUrl: "https://aistudio.google.com/apikey",
    setupLinkText: "Open Google AI Studio",
    requiresRedirectUri: false,
  },
  elevenlabs: {
    field1Label: "API Key",
    field1Placeholder: "Enter your ElevenLabs API Key",
    field2Label: "Default Voice ID",
    field2Placeholder: "Enter default voice ID (optional)",
    helpText: "Find your API key in ElevenLabs Profile Settings. Voice IDs are found in the Voices section.",
    setupUrl: "https://elevenlabs.io/app/settings/api-keys",
    setupLinkText: "Open ElevenLabs Settings",
    requiresRedirectUri: false,
  },
  deepgram: {
    field1Label: "API Key",
    field1Placeholder: "Enter your Deepgram API Key",
    field2Label: "Project ID",
    field2Placeholder: "Enter your Deepgram Project ID",
    helpText: "Create an API key in the Deepgram Console under your project settings.",
    setupUrl: "https://console.deepgram.com/",
    setupLinkText: "Open Deepgram Console",
    requiresRedirectUri: false,
  },
  zendesk: {
    field1Label: "API Token",
    field1Placeholder: "Enter your Zendesk API Token",
    field2Label: "Subdomain",
    field2Placeholder: "e.g. yourcompany (from yourcompany.zendesk.com)",
    helpText: "Generate an API token in Zendesk Admin > Apps and Integrations > APIs > Zendesk API.",
    setupUrl: "https://support.zendesk.com/",
    setupLinkText: "Open Zendesk Admin",
    requiresRedirectUri: false,
  },
  freshdesk: {
    field1Label: "API Key",
    field1Placeholder: "Enter your Freshdesk API Key",
    field2Label: "Domain",
    field2Placeholder: "e.g. yourcompany.freshdesk.com",
    helpText: "Find your API key in Freshdesk: Profile Settings > Your API Key.",
    setupUrl: "https://freshdesk.com/",
    setupLinkText: "Open Freshdesk",
    requiresRedirectUri: false,
  },
  "google-calendar": {
    field1Label: "Client ID",
    field1Placeholder: "Enter your Google Client ID",
    field2Label: "Client Secret",
    field2Placeholder: "Enter your Google Client Secret",
    helpText: "In Google Cloud Console, create an OAuth 2.0 Client ID. Enable the Google Calendar API for your project and add the redirect URL below.",
    setupUrl: "https://console.cloud.google.com/apis/credentials",
    setupLinkText: "Open Google Cloud Console",
    requiresRedirectUri: true,
    scopes: ["https://www.googleapis.com/auth/calendar", "https://www.googleapis.com/auth/calendar.events"],
  },
  calendly: {
    field1Label: "API Key",
    field1Placeholder: "Enter your Calendly Personal Access Token",
    field2Label: "Organization URI",
    field2Placeholder: "Enter your Calendly Organization URI",
    helpText: "Generate a Personal Access Token in Calendly: Integrations > API & Webhooks. Find your Organization URI in the API response.",
    setupUrl: "https://calendly.com/integrations",
    setupLinkText: "Open Calendly Integrations",
    requiresRedirectUri: false,
  },
  stripe: {
    field1Label: "Secret Key",
    field1Placeholder: "Enter your Stripe Secret Key (sk_...)",
    field2Label: "Webhook Secret",
    field2Placeholder: "Enter your Stripe Webhook Secret (whsec_...)",
    helpText: "Find your API keys in the Stripe Dashboard > Developers > API Keys. Create a webhook endpoint and copy the signing secret.",
    setupUrl: "https://dashboard.stripe.com/apikeys",
    setupLinkText: "Open Stripe Dashboard",
    requiresRedirectUri: false,
  },
  shopify: {
    field1Label: "Access Token",
    field1Placeholder: "Enter your Shopify Admin API Access Token",
    field2Label: "Store Domain",
    field2Placeholder: "e.g. yourstore.myshopify.com",
    helpText: "Create a Custom App in Shopify Admin > Settings > Apps and sales channels > Develop apps. Install and copy the Admin API access token.",
    setupUrl: "https://admin.shopify.com/",
    setupLinkText: "Open Shopify Admin",
    requiresRedirectUri: false,
  },
  activecampaign: {
    field1Label: "API Key",
    field1Placeholder: "Enter your ActiveCampaign API Key",
    field2Label: "Account URL",
    field2Placeholder: "e.g. yourcompany.api-us1.com",
    helpText: "Find your API Key and URL in ActiveCampaign: Settings > Developer > API Access.",
    setupUrl: "https://www.activecampaign.com/",
    setupLinkText: "Open ActiveCampaign",
    requiresRedirectUri: false,
  },
  sendgrid: {
    field1Label: "API Key",
    field1Placeholder: "Enter your SendGrid API Key",
    field2Label: "Sender Email",
    field2Placeholder: "Enter your verified sender email",
    helpText: "Create an API key in SendGrid: Settings > API Keys > Create API Key. Verify a sender identity first.",
    setupUrl: "https://app.sendgrid.com/settings/api_keys",
    setupLinkText: "Open SendGrid Settings",
    requiresRedirectUri: false,
  },
  "microsoft-teams": {
    field1Label: "Client ID",
    field1Placeholder: "Enter your Azure Application Client ID",
    field2Label: "Client Secret",
    field2Placeholder: "Enter your Azure Client Secret",
    helpText: "Register an app in Azure Portal > App Registrations. Under API Permissions, add Microsoft Graph permissions for Teams. Add the redirect URL below.",
    setupUrl: "https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade",
    setupLinkText: "Open Azure Portal",
    requiresRedirectUri: true,
    scopes: ["ChannelMessage.Send", "Chat.ReadWrite"],
  },
  telegram: {
    field1Label: "Bot Token",
    field1Placeholder: "Enter your Telegram Bot Token",
    field2Label: "Chat ID",
    field2Placeholder: "Enter the target Chat/Group ID",
    helpText: "Create a bot via @BotFather on Telegram. Use @userinfobot or the getUpdates API method to find your Chat ID.",
    setupUrl: "https://t.me/BotFather",
    setupLinkText: "Open BotFather",
    requiresRedirectUri: false,
  },
  whatsapp: {
    field1Label: "Access Token",
    field1Placeholder: "Enter your WhatsApp Business API Access Token",
    field2Label: "Phone Number ID",
    field2Placeholder: "Enter your WhatsApp Phone Number ID",
    helpText: "Set up WhatsApp Business API through Meta for Developers. Create an app, add the WhatsApp product, and generate a permanent access token.",
    setupUrl: "https://developers.facebook.com/apps/",
    setupLinkText: "Open Meta for Developers",
    requiresRedirectUri: false,
  },
  discord: {
    field1Label: "Bot Token",
    field1Placeholder: "Enter your Discord Bot Token",
    field2Label: "Channel ID",
    field2Placeholder: "Enter the target Channel ID",
    helpText: "Create a bot in the Discord Developer Portal. Enable Developer Mode in Discord settings to copy Channel IDs.",
    setupUrl: "https://discord.com/developers/applications",
    setupLinkText: "Open Discord Developer Portal",
    requiresRedirectUri: false,
  },
  zapier: {
    field1Label: "Webhook URL",
    field1Placeholder: "Enter your Zapier Webhook URL",
    field2Label: "Secret Key",
    field2Placeholder: "Enter a shared secret key (optional)",
    helpText: "Create a Zap with a 'Webhooks by Zapier' trigger. Copy the webhook URL provided and paste it here.",
    setupUrl: "https://zapier.com/app/zaps",
    setupLinkText: "Open Zapier",
    requiresRedirectUri: false,
  },
  make: {
    field1Label: "Webhook URL",
    field1Placeholder: "Enter your Make.com Webhook URL",
    field2Label: "Secret Key",
    field2Placeholder: "Enter a shared secret key (optional)",
    helpText: "Create a scenario in Make with a Webhooks module. Copy the webhook URL and paste it here.",
    setupUrl: "https://www.make.com/en/login",
    setupLinkText: "Open Make.com",
    requiresRedirectUri: false,
  },
  notion: {
    field1Label: "Integration Token",
    field1Placeholder: "Enter your Notion Integration Token",
    field2Label: "Database ID",
    field2Placeholder: "Enter the target Notion Database ID",
    helpText: "Create an integration at notion.so/my-integrations. Share the target database with your integration. Find the Database ID in the database URL.",
    setupUrl: "https://www.notion.so/my-integrations",
    setupLinkText: "Open Notion Integrations",
    requiresRedirectUri: false,
  },
  helpscout: {
    field1Label: "API Key",
    field1Placeholder: "Enter your Help Scout API Key",
    field2Label: "Mailbox ID",
    field2Placeholder: "Enter your Help Scout Mailbox ID",
    helpText: "Generate an API key in Help Scout: Your Profile > API Keys. Find your Mailbox ID in Mailbox settings.",
    setupUrl: "https://secure.helpscout.net/",
    setupLinkText: "Open Help Scout",
    requiresRedirectUri: false,
  },
  "google-analytics": {
    field1Label: "Measurement ID",
    field1Placeholder: "Enter your GA4 Measurement ID (G-...)",
    field2Label: "API Secret",
    field2Placeholder: "Enter your Measurement Protocol API Secret",
    helpText: "Find your Measurement ID in GA4: Admin > Data Streams > Web. Create an API Secret under the same stream's Measurement Protocol API secrets.",
    setupUrl: "https://analytics.google.com/",
    setupLinkText: "Open Google Analytics",
    requiresRedirectUri: false,
  },
  "aws-s3": {
    field1Label: "Access Key ID",
    field1Placeholder: "Enter your AWS Access Key ID",
    field2Label: "Secret Access Key",
    field2Placeholder: "Enter your AWS Secret Access Key",
    helpText: "Create an IAM user with S3 permissions in AWS Console. Generate access keys under Security Credentials.",
    setupUrl: "https://console.aws.amazon.com/iam/",
    setupLinkText: "Open AWS IAM Console",
    requiresRedirectUri: false,
  },
  bamboohr: {
    field1Label: "API Key",
    field1Placeholder: "Enter your BambooHR API Key",
    field2Label: "Subdomain",
    field2Placeholder: "e.g. yourcompany (from yourcompany.bamboohr.com)",
    helpText: "Generate an API key in BambooHR: Account > API Keys.",
    setupUrl: "https://www.bamboohr.com/",
    setupLinkText: "Open BambooHR",
    requiresRedirectUri: false,
  },
};

interface ProviderAction {
  id: string;
  name: string;
  description: string;
  type: "action" | "sync";
  endpoint: string;
  enabled: boolean;
}

const PROVIDER_ACTIONS: Record<string, ProviderAction[]> = {
  salesforce: [
    { id: "sync-contacts", name: "Sync Contacts", description: "Sync contacts from Salesforce", type: "sync", endpoint: "/api/integrations/{id}/salesforce/contacts/sync", enabled: true },
    { id: "push-call-summary", name: "Push Call Summary", description: "Push call summaries to Salesforce activities", type: "action", endpoint: "/api/integrations/{id}/salesforce/activities/push", enabled: false },
    { id: "sync-leads", name: "Sync Leads", description: "Sync leads from Salesforce", type: "sync", endpoint: "/api/integrations/{id}/salesforce/leads/sync", enabled: true },
    { id: "update-contact-status", name: "Update Contact Status", description: "Update contact status after call", type: "action", endpoint: "/api/integrations/{id}/salesforce/contacts/status", enabled: false },
  ],
  hubspot: [
    { id: "sync-contacts", name: "Sync Contacts", description: "Sync contacts from HubSpot", type: "sync", endpoint: "/api/integrations/{id}/hubspot/contacts/sync", enabled: true },
    { id: "sync-deals", name: "Sync Deals", description: "Sync deals from HubSpot", type: "sync", endpoint: "/api/integrations/{id}/hubspot/deals/sync", enabled: false },
    { id: "create-engagement", name: "Create Engagement", description: "Create call engagement records", type: "action", endpoint: "/api/integrations/{id}/hubspot/engagements/create", enabled: true },
    { id: "push-call-notes", name: "Push Call Notes", description: "Push call notes to contact timeline", type: "action", endpoint: "/api/integrations/{id}/hubspot/notes/push", enabled: false },
  ],
  zoho: [
    { id: "sync-contacts", name: "Sync Contacts", description: "Sync contacts from Zoho CRM", type: "sync", endpoint: "/api/integrations/{id}/zoho/contacts/sync", enabled: true },
    { id: "sync-leads", name: "Sync Leads", description: "Sync leads from Zoho", type: "sync", endpoint: "/api/integrations/{id}/zoho/leads/sync", enabled: true },
    { id: "push-call-log", name: "Push Call Log", description: "Push call logs to Zoho", type: "action", endpoint: "/api/integrations/{id}/zoho/calls/push", enabled: false },
    { id: "update-lead-status", name: "Update Lead Status", description: "Update lead status after call", type: "action", endpoint: "/api/integrations/{id}/zoho/leads/status", enabled: false },
  ],
  "google-sheets": [
    { id: "export-call-data", name: "Export Call Data", description: "Export call data to Google Sheets", type: "action", endpoint: "/api/integrations/{id}/gsheets/calls/export", enabled: true },
    { id: "read-contact-list", name: "Read Contact List", description: "Read contact list from Google Sheets", type: "sync", endpoint: "/api/integrations/{id}/gsheets/contacts/read", enabled: true },
    { id: "sync-campaign-results", name: "Sync Campaign Results", description: "Sync campaign results to sheets", type: "sync", endpoint: "/api/integrations/{id}/gsheets/campaigns/sync", enabled: false },
  ],
  pipedrive: [
    { id: "sync-contacts", name: "Sync Persons", description: "Sync persons from Pipedrive", type: "sync", endpoint: "/api/integrations/{id}/pipedrive/persons/sync", enabled: true },
    { id: "sync-deals", name: "Sync Deals", description: "Sync deals from Pipedrive", type: "sync", endpoint: "/api/integrations/{id}/pipedrive/deals/sync", enabled: false },
    { id: "create-activity", name: "Create Activity", description: "Create call activity records", type: "action", endpoint: "/api/integrations/{id}/pipedrive/activities/create", enabled: true },
    { id: "push-call-outcome", name: "Push Call Outcome", description: "Push call outcome to deal", type: "action", endpoint: "/api/integrations/{id}/pipedrive/deals/outcome", enabled: false },
  ],
  dynamics365: [
    { id: "sync-contacts", name: "Sync Contacts", description: "Sync contacts from Dynamics 365", type: "sync", endpoint: "/api/integrations/{id}/dynamics/contacts/sync", enabled: true },
    { id: "sync-leads", name: "Sync Leads", description: "Sync leads from Dynamics", type: "sync", endpoint: "/api/integrations/{id}/dynamics/leads/sync", enabled: true },
    { id: "create-phone-call", name: "Create Phone Call", description: "Create phone call activity", type: "action", endpoint: "/api/integrations/{id}/dynamics/phonecalls/create", enabled: false },
    { id: "update-lead-qualification", name: "Update Lead Qualification", description: "Update lead qualification", type: "action", endpoint: "/api/integrations/{id}/dynamics/leads/qualify", enabled: false },
  ],
  "monday-com": [
    { id: "sync-board-items", name: "Sync Board Items", description: "Sync items from Monday.com boards", type: "sync", endpoint: "/api/integrations/{id}/monday/items/sync", enabled: true },
    { id: "update-item-status", name: "Update Item Status", description: "Update item status after call", type: "action", endpoint: "/api/integrations/{id}/monday/items/status", enabled: false },
    { id: "push-call-summary", name: "Push Call Summary", description: "Push call summaries to items", type: "action", endpoint: "/api/integrations/{id}/monday/items/summary", enabled: false },
  ],
  airtable: [
    { id: "sync-records", name: "Sync Records", description: "Sync records from Airtable base", type: "sync", endpoint: "/api/integrations/{id}/airtable/records/sync", enabled: true },
    { id: "export-call-data", name: "Export Call Data", description: "Export call data to Airtable", type: "action", endpoint: "/api/integrations/{id}/airtable/calls/export", enabled: false },
    { id: "update-record-status", name: "Update Record Status", description: "Update record status", type: "action", endpoint: "/api/integrations/{id}/airtable/records/status", enabled: false },
  ],
  slack: [
    { id: "send-call-notification", name: "Send Call Notification", description: "Send call completion notifications", type: "action", endpoint: "/api/integrations/{id}/slack/notifications/call", enabled: true },
    { id: "send-campaign-summary", name: "Send Campaign Summary", description: "Send campaign summary reports", type: "action", endpoint: "/api/integrations/{id}/slack/notifications/campaign", enabled: false },
    { id: "send-alert", name: "Send Alert", description: "Send real-time alerts for important calls", type: "action", endpoint: "/api/integrations/{id}/slack/alerts/send", enabled: false },
  ],
  mailchimp: [
    { id: "sync-audience", name: "Sync Audience", description: "Sync audience/subscriber lists", type: "sync", endpoint: "/api/integrations/{id}/mailchimp/audience/sync", enabled: true },
    { id: "update-tags", name: "Update Tags", description: "Update subscriber tags based on call outcomes", type: "action", endpoint: "/api/integrations/{id}/mailchimp/tags/update", enabled: false },
    { id: "push-campaign-results", name: "Push Campaign Results", description: "Push calling campaign results", type: "action", endpoint: "/api/integrations/{id}/mailchimp/campaigns/push", enabled: false },
  ],
  intercom: [
    { id: "sync-contacts", name: "Sync Contacts", description: "Sync contacts from Intercom", type: "sync", endpoint: "/api/integrations/{id}/intercom/contacts/sync", enabled: true },
    { id: "create-conversation-note", name: "Create Conversation Note", description: "Add call notes to conversations", type: "action", endpoint: "/api/integrations/{id}/intercom/notes/create", enabled: false },
    { id: "update-contact-attributes", name: "Update Contact Attributes", description: "Update contact attributes", type: "action", endpoint: "/api/integrations/{id}/intercom/contacts/attributes", enabled: false },
  ],
  freshsales: [
    { id: "sync-contacts", name: "Sync Contacts", description: "Sync contacts from Freshsales", type: "sync", endpoint: "/api/integrations/{id}/freshsales/contacts/sync", enabled: true },
    { id: "sync-leads", name: "Sync Leads", description: "Sync leads from Freshsales", type: "sync", endpoint: "/api/integrations/{id}/freshsales/leads/sync", enabled: true },
    { id: "log-call-activity", name: "Log Call Activity", description: "Log call activities", type: "action", endpoint: "/api/integrations/{id}/freshsales/calls/log", enabled: false },
    { id: "update-lead-score", name: "Update Lead Score", description: "Update lead score based on call", type: "action", endpoint: "/api/integrations/{id}/freshsales/leads/score", enabled: false },
  ],
  twilio: [
    { id: "check-number", name: "Check Phone Number", description: "Verify phone number availability", type: "sync", endpoint: "/api/integrations/{id}/twilio/numbers/check", enabled: true },
    { id: "send-sms", name: "Send SMS Follow-up", description: "Send SMS after call completion", type: "action", endpoint: "/api/integrations/{id}/twilio/sms/send", enabled: false },
  ],
  openai: [
    { id: "generate-summary", name: "Generate Call Summary", description: "Generate AI summary of call transcript", type: "action", endpoint: "/api/integrations/{id}/openai/summary/generate", enabled: true },
    { id: "sentiment-analysis", name: "Sentiment Analysis", description: "Analyze caller sentiment from transcript", type: "action", endpoint: "/api/integrations/{id}/openai/sentiment/analyze", enabled: false },
  ],
  zendesk: [
    { id: "create-ticket", name: "Create Ticket", description: "Create support ticket from call", type: "action", endpoint: "/api/integrations/{id}/zendesk/tickets/create", enabled: true },
    { id: "update-ticket", name: "Update Ticket", description: "Update existing ticket with call notes", type: "action", endpoint: "/api/integrations/{id}/zendesk/tickets/update", enabled: false },
  ],
  freshdesk: [
    { id: "create-ticket", name: "Create Ticket", description: "Create Freshdesk ticket from call", type: "action", endpoint: "/api/integrations/{id}/freshdesk/tickets/create", enabled: true },
    { id: "sync-contacts", name: "Sync Contacts", description: "Sync contacts from Freshdesk", type: "sync", endpoint: "/api/integrations/{id}/freshdesk/contacts/sync", enabled: true },
  ],
  "google-calendar": [
    { id: "create-event", name: "Book Appointment", description: "Create calendar event during call", type: "action", endpoint: "/api/integrations/{id}/gcalendar/events/create", enabled: true },
    { id: "check-availability", name: "Check Availability", description: "Check calendar availability", type: "sync", endpoint: "/api/integrations/{id}/gcalendar/availability/check", enabled: true },
  ],
  calendly: [
    { id: "create-scheduling-link", name: "Send Scheduling Link", description: "Generate and share Calendly link", type: "action", endpoint: "/api/integrations/{id}/calendly/links/create", enabled: true },
    { id: "check-availability", name: "Check Availability", description: "Check available time slots", type: "sync", endpoint: "/api/integrations/{id}/calendly/availability/check", enabled: true },
  ],
  stripe: [
    { id: "lookup-customer", name: "Lookup Customer", description: "Look up customer payment info", type: "sync", endpoint: "/api/integrations/{id}/stripe/customers/lookup", enabled: true },
    { id: "create-invoice", name: "Create Invoice", description: "Create invoice after call", type: "action", endpoint: "/api/integrations/{id}/stripe/invoices/create", enabled: false },
  ],
  telegram: [
    { id: "send-notification", name: "Send Notification", description: "Send call alert to Telegram", type: "action", endpoint: "/api/integrations/{id}/telegram/messages/send", enabled: true },
    { id: "send-report", name: "Send Campaign Report", description: "Send campaign summary to Telegram", type: "action", endpoint: "/api/integrations/{id}/telegram/reports/send", enabled: false },
  ],
  whatsapp: [
    { id: "send-followup", name: "Send Follow-up", description: "Send WhatsApp follow-up message", type: "action", endpoint: "/api/integrations/{id}/whatsapp/messages/send", enabled: true },
    { id: "send-template", name: "Send Template Message", description: "Send pre-approved template message", type: "action", endpoint: "/api/integrations/{id}/whatsapp/templates/send", enabled: false },
  ],
  discord: [
    { id: "send-notification", name: "Send Notification", description: "Post call update to Discord channel", type: "action", endpoint: "/api/integrations/{id}/discord/messages/send", enabled: true },
  ],
  zapier: [
    { id: "trigger-webhook", name: "Trigger Webhook", description: "Send call data to Zapier webhook", type: "action", endpoint: "/api/integrations/{id}/zapier/webhook/trigger", enabled: true },
  ],
  notion: [
    { id: "create-page", name: "Create Page", description: "Create Notion page with call notes", type: "action", endpoint: "/api/integrations/{id}/notion/pages/create", enabled: true },
    { id: "update-database", name: "Update Database", description: "Add call record to Notion database", type: "action", endpoint: "/api/integrations/{id}/notion/database/update", enabled: true },
  ],
  "microsoft-teams": [
    { id: "send-notification", name: "Send Notification", description: "Post call alert to Teams channel", type: "action", endpoint: "/api/integrations/{id}/teams/messages/send", enabled: true },
  ],
  activecampaign: [
    { id: "add-contact", name: "Add Contact", description: "Add contact to ActiveCampaign", type: "action", endpoint: "/api/integrations/{id}/activecampaign/contacts/add", enabled: true },
    { id: "add-tag", name: "Add Tag", description: "Tag contact based on call outcome", type: "action", endpoint: "/api/integrations/{id}/activecampaign/tags/add", enabled: false },
  ],
  shopify: [
    { id: "lookup-order", name: "Lookup Order", description: "Look up customer order details", type: "sync", endpoint: "/api/integrations/{id}/shopify/orders/lookup", enabled: true },
    { id: "lookup-product", name: "Lookup Product", description: "Check product availability", type: "sync", endpoint: "/api/integrations/{id}/shopify/products/lookup", enabled: true },
  ],
};

interface SetupStep {
  title: string;
  description: string;
}

const PROVIDER_SETUP_GUIDE: Record<string, SetupStep[]> = {};

function buildOAuthSetupGuide(slug: string, config: ProviderCredentialConfig): SetupStep[] {
  return [
    {
      title: "Create Developer App",
      description: `Go to the ${config.setupLinkText.replace("Open ", "")} and create a new application. Choose "Web Application" or "Server-side" as the application type.`,
    },
    {
      title: "Configure Redirect URI",
      description: `In your app settings, add the following redirect/callback URL. This is required for the OAuth authorization flow to work correctly.`,
    },
    {
      title: "Set Required Scopes",
      description: `Make sure the following scopes/permissions are enabled for your application. These are required for the integration to function properly.`,
    },
    {
      title: "Enter Credentials",
      description: `Copy the ${config.field1Label} and ${config.field2Label} from your app's settings page. You'll need to paste these when connecting the integration.`,
    },
    {
      title: "Authorize Access",
      description: `After entering your credentials, you'll be redirected to the provider's consent screen. Review the requested permissions and click "Allow" or "Authorize" to grant access.`,
    },
    {
      title: "Verify Connection",
      description: `Once authorized, check the Settings tab to confirm your account is connected. The status should show "Connected" and your account details should appear.`,
    },
  ];
}

function buildApiKeySetupGuide(config: ProviderCredentialConfig): SetupStep[] {
  return [
    {
      title: "Find Your API Key",
      description: `Navigate to your account's profile or settings page. Look for "API Settings" or "API Key" section. Copy the API key provided there.`,
    },
    {
      title: "Note Your Domain",
      description: `Your domain is the URL you use to access the service (e.g., yourcompany.freshsales.io). You'll need this along with your API key to authenticate.`,
    },
    {
      title: "Enter Credentials",
      description: `Click the "Connect" button and enter your ${config.field1Label} and ${config.field2Label} in the dialog. These will be stored securely and encrypted.`,
    },
    {
      title: "Verify Connection",
      description: `After connecting, check the Settings tab to confirm your account is linked. The status should show "Connected" and you should be able to start syncing data.`,
    },
  ];
}

function getProviderConfig(slug: string): ProviderCredentialConfig {
  return PROVIDER_CREDENTIAL_CONFIG[slug] || {
    field1Label: "Client ID",
    field1Placeholder: "Enter your Client ID",
    field2Label: "Client Secret",
    field2Placeholder: "Enter your Client Secret",
    helpText: "Enter your OAuth app credentials. You can find these in the provider's developer console or admin settings.",
    setupUrl: "",
    setupLinkText: "Open Developer Console",
    requiresRedirectUri: true,
  };
}

function getOAuthRedirectUri(): string {
  const base = window.location.origin;
  return `${base}/api/integrations/oauth/callback`;
}

const LOGO_MAP: Record<string, React.ReactNode> = {
  salesforce: <SiSalesforce className="w-8 h-8 text-[#00A1E0]" />,
  hubspot: <SiHubspot className="w-8 h-8 text-[#FF7A59]" />,
  zoho: <Plug2 className="w-8 h-8 text-[#C8202B]" />,
  pipedrive: <Plug2 className="w-8 h-8 text-[#25292C]" />,
  freshsales: <Plug2 className="w-8 h-8 text-[#25C16F]" />,
  "close-crm": <Plug2 className="w-8 h-8 text-[#1A1A2E]" />,
  "copper-crm": <Plug2 className="w-8 h-8 text-[#F7B731]" />,
  gohighlevel: <Plug2 className="w-8 h-8 text-[#4285F4]" />,
  keap: <Plug2 className="w-8 h-8 text-[#2CBA2C]" />,
  sugarcrm: <Plug2 className="w-8 h-8 text-[#E61E2A]" />,
  bitrix24: <Plug2 className="w-8 h-8 text-[#2FC7F7]" />,
  insightly: <Plug2 className="w-8 h-8 text-[#2E86C1]" />,
  dynamics365: <Plug2 className="w-8 h-8 text-[#002050]" />,
  twilio: <SiTwilio className="w-8 h-8 text-[#F22F46]" />,
  plivo: <Plug2 className="w-8 h-8 text-[#57BB63]" />,
  vonage: <Plug2 className="w-8 h-8 text-[#6B1FAA]" />,
  bandwidth: <Plug2 className="w-8 h-8 text-[#079CEE]" />,
  telnyx: <Plug2 className="w-8 h-8 text-[#00C08B]" />,
  "amazon-connect": <Plug2 className="w-8 h-8 text-[#FF9900]" />,
  openai: <SiOpenai className="w-8 h-8 text-[#412991]" />,
  anthropic: <Plug2 className="w-8 h-8 text-[#D4A574]" />,
  "google-gemini": <Plug2 className="w-8 h-8 text-[#4285F4]" />,
  mistral: <Plug2 className="w-8 h-8 text-[#F54E42]" />,
  groq: <Plug2 className="w-8 h-8 text-[#F55036]" />,
  cohere: <Plug2 className="w-8 h-8 text-[#39594D]" />,
  perplexity: <Plug2 className="w-8 h-8 text-[#20808D]" />,
  elevenlabs: <Plug2 className="w-8 h-8 text-[#000000]" />,
  deepgram: <Plug2 className="w-8 h-8 text-[#13EF93]" />,
  "google-cloud-tts": <Plug2 className="w-8 h-8 text-[#4285F4]" />,
  "amazon-polly": <Plug2 className="w-8 h-8 text-[#FF9900]" />,
  "azure-speech": <Plug2 className="w-8 h-8 text-[#0078D4]" />,
  playht: <Plug2 className="w-8 h-8 text-[#5C2D91]" />,
  murf: <Plug2 className="w-8 h-8 text-[#6C63FF]" />,
  mailchimp: <SiMailchimp className="w-8 h-8 text-[#FFE01B]" />,
  activecampaign: <Plug2 className="w-8 h-8 text-[#356AE6]" />,
  sendgrid: <Plug2 className="w-8 h-8 text-[#1A82E2]" />,
  brevo: <Plug2 className="w-8 h-8 text-[#0B996E]" />,
  convertkit: <Plug2 className="w-8 h-8 text-[#FB6970]" />,
  slack: <SiSlack className="w-8 h-8 text-[#4A154B]" />,
  "microsoft-teams": <Plug2 className="w-8 h-8 text-[#6264A7]" />,
  telegram: <SiTelegram className="w-8 h-8 text-[#0088CC]" />,
  whatsapp: <SiWhatsapp className="w-8 h-8 text-[#25D366]" />,
  discord: <SiDiscord className="w-8 h-8 text-[#5865F2]" />,
  zendesk: <SiZendesk className="w-8 h-8 text-[#03363D]" />,
  freshdesk: <Plug2 className="w-8 h-8 text-[#25C16F]" />,
  intercom: <SiIntercom className="w-8 h-8 text-[#6AFDEF]" />,
  helpscout: <Plug2 className="w-8 h-8 text-[#1292EE]" />,
  front: <Plug2 className="w-8 h-8 text-[#394EFF]" />,
  "google-calendar": <Plug2 className="w-8 h-8 text-[#4285F4]" />,
  calendly: <Plug2 className="w-8 h-8 text-[#006BFF]" />,
  "cal-com": <Plug2 className="w-8 h-8 text-[#292929]" />,
  "microsoft-outlook": <Plug2 className="w-8 h-8 text-[#0078D4]" />,
  "acuity-scheduling": <Plug2 className="w-8 h-8 text-[#3C8DD5]" />,
  stripe: <SiStripe className="w-8 h-8 text-[#635BFF]" />,
  shopify: <SiShopify className="w-8 h-8 text-[#7AB55C]" />,
  woocommerce: <Plug2 className="w-8 h-8 text-[#96588A]" />,
  "google-analytics": <Plug2 className="w-8 h-8 text-[#E37400]" />,
  mixpanel: <Plug2 className="w-8 h-8 text-[#7856FF]" />,
  segment: <Plug2 className="w-8 h-8 text-[#52BD94]" />,
  zapier: <SiZapier className="w-8 h-8 text-[#FF4F00]" />,
  make: <Plug2 className="w-8 h-8 text-[#6D00CC]" />,
  n8n: <Plug2 className="w-8 h-8 text-[#EA4B71]" />,
  "google-sheets": <SiGooglesheets className="w-8 h-8 text-[#0F9D58]" />,
  airtable: <SiAirtable className="w-8 h-8 text-[#18BFFF]" />,
  notion: <SiNotion className="w-8 h-8 text-[#000000]" />,
  supabase: <Plug2 className="w-8 h-8 text-[#3ECF8E]" />,
  firebase: <SiFirebase className="w-8 h-8 text-[#FFCA28]" />,
  "aws-s3": <Plug2 className="w-8 h-8 text-[#569A31]" />,
  "monday-com": <Plug2 className="w-8 h-8 text-[#FF3D57]" />,
  bamboohr: <Plug2 className="w-8 h-8 text-[#73C41D]" />,
  greenhouse: <Plug2 className="w-8 h-8 text-[#3AB549]" />,
  lever: <Plug2 className="w-8 h-8 text-[#4C7B68]" />,
};

interface IntegrationConfig {
  fieldMapping?: Record<string, string>;
  accountName?: string | null;
  accountEmail?: string | null;
  accountId?: string | null;
  connectedAt?: string | null;
}

interface ConnectedInfo {
  integration: UserIntegration & { config: IntegrationConfig };
  app: IntegrationApp;
}

function getAppIcon(slug: string) {
  return LOGO_MAP[slug] || <Plug2 className="w-8 h-8 text-muted-foreground" />;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "Never";
  return new Date(dateStr).toLocaleString();
}

function getStatusInfo(status: string) {
  switch (status) {
    case "active":
      return { icon: <CheckCircle2 className="w-4 h-4" />, label: "Connected", variant: "default" as const, color: "text-green-600" };
    case "pending_auth":
      return { icon: <Loader2 className="w-4 h-4 animate-spin" />, label: "Pending Authentication", variant: "secondary" as const, color: "text-amber-600" };
    case "error":
      return { icon: <AlertCircle className="w-4 h-4" />, label: "Error", variant: "destructive" as const, color: "text-red-600" };
    case "inactive":
      return { icon: <XCircle className="w-4 h-4" />, label: "Inactive", variant: "outline" as const, color: "text-muted-foreground" };
    default:
      return { icon: <Clock className="w-4 h-4" />, label: status, variant: "outline" as const, color: "text-muted-foreground" };
  }
}

export default function IntegrationDetail() {
  const [, params] = useRoute("/app/integrations/:slug");
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();
  const slug = params?.slug || "";

  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [credentialsDialogOpen, setCredentialsDialogOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [oauthPending, setOauthPending] = useState(false);
  const [activeTab, setActiveTab] = useState("functions");
  const [functionsSubTab, setFunctionsSubTab] = useState<"actions" | "syncs">("actions");
  const [logFilter, setLogFilter] = useState("all");
  const [actionToggles, setActionToggles] = useState<Record<string, boolean>>({});
  const [expandedLogRows, setExpandedLogRows] = useState<Set<string | number>>(new Set());

  const searchParams = new URLSearchParams(searchString);
  const oauthSuccess = searchParams.get("oauth_success");
  const oauthError = searchParams.get("oauth_error");

  useEffect(() => {
    if (oauthSuccess === "true") {
      toast({
        title: "Account connected",
        description: "Your account has been authenticated and is now syncing data.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/connected"] });
      window.history.replaceState({}, "", `/app/integrations/${slug}`);
    } else if (oauthError) {
      const errorMessages: Record<string, string> = {
        access_denied: "You denied access to your account. Please try again to connect.",
        missing_params: "The authentication response was incomplete. Please try again.",
        invalid_state: "The authentication session expired or was invalid. Please try again.",
        integration_not_found: "The integration record was not found. Please reconnect.",
        token_exchange_failed: "Failed to complete authentication with the service. Check your credentials and try again.",
        missing_credentials: "Your stored credentials could not be found. Please reconnect with your Client ID and Client Secret.",
        credential_error: "There was a problem with your stored credentials. Please reconnect.",
        server_error: "An unexpected error occurred during authentication. Please try again.",
      };
      toast({
        title: "Authentication failed",
        description: errorMessages[oauthError] || "An error occurred during authentication.",
        variant: "destructive",
      });
      window.history.replaceState({}, "", `/app/integrations/${slug}`);
    }
  }, [oauthSuccess, oauthError, slug, toast]);

  const { data: apps, isLoading: appsLoading } = useQuery<IntegrationAppWithOAuth[]>({
    queryKey: ["/api/integrations/apps"],
  });

  const { data: connected, isLoading: connectedLoading } = useQuery<ConnectedInfo[]>({
    queryKey: ["/api/integrations/connected"],
  });

  const app = apps?.find((a) => a.slug === slug);
  const requiresOAuth = !!(app as IntegrationAppWithOAuth)?.requiresOAuth;
  const connectionInfo = connected?.find((c) => c.app.slug === slug);
  const integration = connectionInfo?.integration;
  const config = integration?.config as IntegrationConfig | undefined;

  const { data: syncLogs, isLoading: logsLoading } = useQuery<IntegrationSyncLog[]>({
    queryKey: ["/api/integrations", integration?.id, "logs"],
    enabled: !!integration?.id,
    queryFn: async () => {
      const res = await fetch(`/api/integrations/${integration!.id}/logs`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch logs");
      return res.json();
    },
  });

  const connectMutation = useMutation({
    mutationFn: async (creds: { clientId: string; clientSecret: string }) => {
      const res = await apiRequest("POST", `/api/integrations/${slug}/connect`, {
        clientId: creds.clientId,
        clientSecret: creds.clientSecret,
      });
      return await res.json();
    },
    onSuccess: (data) => {
      setCredentialsDialogOpen(false);
      setClientId("");
      setClientSecret("");
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/connected"] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations", data?.integration?.id, "logs"] });

      if (data.oauthUrl) {
        setOauthPending(true);
        const popup = window.open(data.oauthUrl, "oauth_popup", "width=600,height=700,scrollbars=yes");

        const checkClosed = setInterval(() => {
          if (popup && popup.closed) {
            clearInterval(checkClosed);
            setOauthPending(false);
            queryClient.invalidateQueries({ queryKey: ["/api/integrations/connected"] });
          }
        }, 1000);

        toast({
          title: "Sign in to your account",
          description: `A new window has opened for you to authorize access to your ${app?.name || "service"} account.`,
        });
      } else {
        toast({
          title: "Integration connected",
          description: `${app?.name || "Integration"} is now connected and active.`,
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Connection failed",
        description: error.message || "Failed to connect integration",
        variant: "destructive",
      });
    },
  });

  const providerConfig = app ? getProviderConfig(app.slug) : getProviderConfig("");
  const authType = (app as IntegrationAppWithOAuth)?.authType;
  const hasCredentialConfig = !!(app && PROVIDER_CREDENTIAL_CONFIG[app.slug]);
  const isApiKeyProvider = authType === "api_key" || hasCredentialConfig;

  const handleConnectClick = () => {
    setCredentialsDialogOpen(true);
  };

  const handleCredentialsSubmit = () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      toast({
        title: "Missing credentials",
        description: `Please enter both ${providerConfig.field1Label} and ${providerConfig.field2Label}.`,
        variant: "destructive",
      });
      return;
    }
    connectMutation.mutate({ clientId: clientId.trim(), clientSecret: clientSecret.trim() });
  };

  const activateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/integrations/${integration!.id}/activate`, {});
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/connected"] });
      toast({ title: "Integration activated", description: "The integration is now active and syncing data." });
    },
    onError: (error: any) => {
      toast({
        title: "Activation failed",
        description: error.message || "Failed to activate integration",
        variant: "destructive",
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/integrations/${integration!.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/connected"] });
      setDisconnectDialogOpen(false);
      toast({ title: "Integration disconnected", description: "The integration has been removed." });
    },
    onError: (error: any) => {
      toast({
        title: "Disconnect failed",
        description: error.message || "Failed to disconnect",
        variant: "destructive",
      });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/integrations/${integration!.id}/sync`, {});
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations", integration?.id, "logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/connected"] });
      toast({
        title: data.success ? "Sync completed" : "Sync failed",
        description: data.success ? "Data has been synced successfully." : "The sync encountered an error.",
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Sync failed",
        description: error.message || "Failed to trigger sync",
        variant: "destructive",
      });
    },
  });

  const isLoading = appsLoading || connectedLoading;

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!app) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16">
        <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-medium mb-2">Integration not found</h2>
        <Button variant="outline" onClick={() => navigate("/app/integrations")} data-testid="button-back-marketplace">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Marketplace
        </Button>
      </div>
    );
  }

  const statusInfo = integration ? getStatusInfo(integration.status) : null;

  const providerActions = PROVIDER_ACTIONS[slug] || PROVIDER_ACTIONS[slug.replace("-com", "")] || [];

  const getActionToggle = (actionId: string, defaultEnabled: boolean) => {
    if (actionToggles[actionId] !== undefined) return actionToggles[actionId];
    return defaultEnabled;
  };

  const handleActionToggle = (actionId: string, checked: boolean) => {
    setActionToggles((prev) => ({ ...prev, [actionId]: checked }));
  };

  const toggleLogRow = (logId: string | number) => {
    setExpandedLogRows((prev) => {
      const next = new Set(prev);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  };

  const filteredLogs = syncLogs?.filter((log) => {
    if (logFilter === "all") return true;
    if (logFilter === "success") return log.status === "success";
    if (logFilter === "failed") return log.status === "failed" || log.status === "error";
    if (logFilter === "in_progress") return log.status === "in_progress" || log.status === "pending" || log.status === "pending_auth";
    return true;
  });

  const setupGuide = isApiKeyProvider
    ? buildApiKeySetupGuide(providerConfig)
    : buildOAuthSetupGuide(slug, providerConfig);

  const formatCreatedDate = (dateStr: string | null | unknown) => {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr as string);
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: `${label} copied to clipboard.` });
  };

  const filteredActions = providerActions.filter(
    (a) => functionsSubTab === "actions" ? a.type === "action" : a.type === "sync"
  );

  const groupActionsByCategory = (actions: ProviderAction[]) => {
    const groups: Record<string, ProviderAction[]> = {};
    actions.forEach((action) => {
      const nameParts = action.name.toLowerCase();
      let category = "others";
      if (nameParts.includes("contact") || nameParts.includes("person")) category = "Contacts";
      else if (nameParts.includes("lead")) category = "Leads";
      else if (nameParts.includes("deal")) category = "Deals";
      else if (nameParts.includes("file") || nameParts.includes("export") || nameParts.includes("record")) category = "Files";
      else if (nameParts.includes("call") || nameParts.includes("phone") || nameParts.includes("engagement") || nameParts.includes("activity") || nameParts.includes("log")) category = "Activities";
      else if (nameParts.includes("notification") || nameParts.includes("alert") || nameParts.includes("campaign") || nameParts.includes("summary")) category = "Notifications";
      else if (nameParts.includes("audience") || nameParts.includes("tag") || nameParts.includes("board") || nameParts.includes("item") || nameParts.includes("conversation") || nameParts.includes("attribute") || nameParts.includes("score") || nameParts.includes("status") || nameParts.includes("qualification") || nameParts.includes("outcome") || nameParts.includes("note")) category = "others";
      if (!groups[category]) groups[category] = [];
      groups[category].push(action);
    });
    return groups;
  };

  const groupedActions = groupActionsByCategory(filteredActions);

  const tabItems = [
    { key: "functions", label: "Functions" },
    { key: "settings", label: "Settings" },
    { key: "setup-guide", label: "API setup guide", hasExternal: true },
    { key: "logs", label: "Logs", hasExternal: true },
  ];

  return (
    <div className="flex flex-col h-full" data-testid="page-integration-detail">
      <div className="p-4 md:p-6 pb-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/app/integrations")}
          className="mb-4"
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Integrations
        </Button>

        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
              {getAppIcon(app.slug)}
            </div>
            <h1 className="text-xl font-bold tracking-tight" data-testid="text-detail-title">{app.name}</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {integration ? (
              <>
                <Badge variant={statusInfo!.variant} className="gap-1" data-testid="badge-connection-status">
                  {statusInfo!.icon} {statusInfo!.label}
                </Badge>
                {integration.status === "pending_auth" && (
                  <Button
                    size="sm"
                    onClick={() => activateMutation.mutate()}
                    disabled={activateMutation.isPending}
                    data-testid="button-activate"
                  >
                    {activateMutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Play className="w-4 h-4 mr-1.5" />}
                    Activate
                  </Button>
                )}
                {integration.status === "active" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => syncMutation.mutate()}
                    disabled={syncMutation.isPending}
                    data-testid="button-sync"
                  >
                    {syncMutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1.5" />}
                    Sync Now
                  </Button>
                )}
              </>
            ) : (
              <Button
                onClick={handleConnectClick}
                disabled={connectMutation.isPending || oauthPending}
                data-testid="button-connect"
              >
                {(connectMutation.isPending || oauthPending) ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Plug className="w-4 h-4 mr-1.5" />}
                {oauthPending ? "Waiting for authorization..." : "Add test connection"}
              </Button>
            )}
          </div>
        </div>

        <div className="flex gap-0 border-b" data-testid="tabs-list">
          {tabItems.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium flex items-center gap-1.5 border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`tab-${tab.key}`}
            >
              {tab.label}
              {tab.hasExternal && <ExternalLink className="w-3 h-3" />}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 min-w-0">
            {activeTab === "functions" && (
              <div data-testid="tab-content-functions">
                {!integration ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Plug className="w-8 h-8 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">Connect {app.name} first to enable and configure functions.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Button
                          variant={functionsSubTab === "actions" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setFunctionsSubTab("actions")}
                          data-testid="button-subtab-actions"
                        >
                          Actions
                        </Button>
                        <Button
                          variant={functionsSubTab === "syncs" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setFunctionsSubTab("syncs")}
                          data-testid="button-subtab-syncs"
                        >
                          Syncs
                        </Button>
                      </div>
                      <a
                        href="#"
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                        data-testid="link-how-to-use"
                      >
                        How to use {functionsSubTab === "actions" ? "Actions" : "Syncs"}
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>

                    {filteredActions.length > 0 ? (
                      <div className="border rounded-md overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/80">
                              <TableHead className="font-semibold text-xs uppercase tracking-wider">Name</TableHead>
                              <TableHead className="font-semibold text-xs uppercase tracking-wider">Type</TableHead>
                              <TableHead className="font-semibold text-xs uppercase tracking-wider text-right">Enabled</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {Object.entries(groupedActions).map(([category, actions]) => (
                              <React.Fragment key={category}>
                                <TableRow>
                                  <TableCell colSpan={3} className="bg-muted/40 py-1.5 px-4">
                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" data-testid={`text-category-${category}`}>
                                      {category}
                                    </span>
                                  </TableCell>
                                </TableRow>
                                {actions.map((action) => {
                                  const isEnabled = getActionToggle(action.id, action.enabled);
                                  return (
                                    <TableRow key={action.id} data-testid={`row-action-${action.id}`}>
                                      <TableCell>
                                        <div className="flex items-center gap-2">
                                          <span className="text-sm font-medium" data-testid={`text-action-name-${action.id}`}>{action.name}</span>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={() => copyToClipboard(action.id, action.name)}
                                            data-testid={`button-copy-action-${action.id}`}
                                          >
                                            <Copy className="w-3 h-3" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            title={action.description}
                                            data-testid={`button-info-action-${action.id}`}
                                          >
                                            <AlertCircle className="w-3 h-3" />
                                          </Button>
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <Badge variant="secondary" className="no-default-active-elevate text-xs">
                                          TEMPLATE
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <Switch
                                          checked={isEnabled}
                                          onCheckedChange={(checked) => handleActionToggle(action.id, checked)}
                                          data-testid={`switch-action-${action.id}`}
                                        />
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </React.Fragment>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-center border rounded-md">
                        <ListChecks className="w-8 h-8 text-muted-foreground mb-3" />
                        <p className="text-sm text-muted-foreground">
                          No {functionsSubTab === "actions" ? "actions" : "syncs"} configured for this integration yet.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === "settings" && (
              <div data-testid="tab-content-settings">
                {!integration ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Plug className="w-8 h-8 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">Connect {app.name} first to view settings.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {(config?.accountName || config?.accountEmail) && (
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Shield className="w-4 h-4" /> Connected Account
                          </CardTitle>
                          <Badge variant="outline" className="no-default-active-elevate gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Authenticated
                          </Badge>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {config.accountName && (
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                                  <User className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs text-muted-foreground">Account</p>
                                  <p className="text-sm font-medium truncate" data-testid="text-account-name">{config.accountName}</p>
                                </div>
                              </div>
                            )}
                            {config.accountEmail && (
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                                  <Mail className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs text-muted-foreground">Email</p>
                                  <p className="text-sm font-medium truncate" data-testid="text-account-email">{config.accountEmail}</p>
                                </div>
                              </div>
                            )}
                            {config.connectedAt && (
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                                  <Clock className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs text-muted-foreground">Authorized On</p>
                                  <p className="text-sm font-medium truncate" data-testid="text-auth-date">{formatDate(config.connectedAt)}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Settings className="w-4 h-4" /> Field Mapping
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                          Configure how data fields map from Loop9 to {app.name}.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-xs">Contact Name</Label>
                            <Input
                              placeholder="e.g. contact_name"
                              defaultValue={config?.fieldMapping?.contactName || "contact_name"}
                              readOnly
                              data-testid="input-field-contact-name"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Phone Number</Label>
                            <Input
                              placeholder="e.g. phone_number"
                              defaultValue={config?.fieldMapping?.phoneNumber || "phone_number"}
                              readOnly
                              data-testid="input-field-phone"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Company</Label>
                            <Input
                              placeholder="e.g. company"
                              defaultValue={config?.fieldMapping?.company || "company"}
                              readOnly
                              data-testid="input-field-company"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Call Summary</Label>
                            <Input
                              placeholder="e.g. call_summary"
                              defaultValue={config?.fieldMapping?.callSummary || "call_summary"}
                              readOnly
                              data-testid="input-field-summary"
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Code className="w-4 h-4" /> Integration Details
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Auth Method</p>
                            <p className="text-sm font-medium mt-0.5" data-testid="text-auth-method">
                              {isApiKeyProvider ? "API Key" : "OAuth 2.0"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Display Name</p>
                            <p className="text-sm font-medium mt-0.5" data-testid="text-display-name">{app.name}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Integration ID</p>
                            <p className="text-sm font-medium font-mono mt-0.5" data-testid="text-integration-slug">{app.slug}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Category</p>
                            <p className="text-sm font-medium mt-0.5" data-testid="text-category">{app.category || "Integration"}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        variant="outline"
                        onClick={() => setCredentialsDialogOpen(true)}
                        data-testid="button-reconnect"
                      >
                        <RefreshCw className="w-4 h-4 mr-1.5" /> Reconnect
                      </Button>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <div>
                        <h4 className="text-sm font-medium text-destructive">Danger Zone</h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          Disconnecting will revoke access to your {app.name} account, stop all automated syncing, and delete the integration configuration. This action cannot be undone.
                        </p>
                      </div>
                      <Button
                        variant="destructive"
                        onClick={() => setDisconnectDialogOpen(true)}
                        data-testid="button-disconnect-settings"
                      >
                        <Unplug className="w-4 h-4 mr-1.5" /> Disconnect {app.name}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "setup-guide" && (
              <div data-testid="tab-content-setup-guide">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Terminal className="w-5 h-5 text-muted-foreground" />
                    <h3 className="text-base font-semibold">Setup Guide for {app.name}</h3>
                    {providerConfig.setupUrl && (
                      <a
                        href={providerConfig.setupUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline flex items-center gap-1 ml-auto"
                        data-testid="link-provider-console"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        {providerConfig.setupLinkText}
                      </a>
                    )}
                  </div>

                  {setupGuide.map((step, index) => (
                    <Card key={index} data-testid={`card-setup-step-${index + 1}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 text-sm font-bold">
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0 space-y-2">
                            <h4 className="text-sm font-semibold" data-testid={`text-step-title-${index + 1}`}>{step.title}</h4>
                            <p className="text-xs text-muted-foreground">{step.description}</p>

                            {step.title === "Configure Redirect URI" && providerConfig.requiresRedirectUri && (
                              <div className="mt-2 space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Redirect / Callback URL</Label>
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 rounded-md bg-muted px-3 py-2">
                                    <code className="text-xs font-mono break-all" data-testid="text-redirect-uri">{getOAuthRedirectUri()}</code>
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => copyToClipboard(getOAuthRedirectUri(), "Redirect URL")}
                                    data-testid="button-copy-redirect"
                                  >
                                    <Copy className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            )}

                            {step.title === "Set Required Scopes" && providerConfig.scopes && providerConfig.scopes.length > 0 && (
                              <div className="mt-2 space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Required Scopes</Label>
                                <div className="flex flex-wrap gap-1.5">
                                  {providerConfig.scopes.map((scope) => (
                                    <Badge key={scope} variant="secondary" className="text-xs font-mono no-default-active-elevate">
                                      {scope}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "logs" && (
              <div data-testid="tab-content-logs">
                {!integration ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Plug className="w-8 h-8 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">Connect {app.name} first to view sync logs.</p>
                  </div>
                ) : (
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="w-4 h-4" /> Sync History
                      </CardTitle>
                      <Badge variant="outline" className="no-default-active-elevate">{syncLogs?.length || 0} entries</Badge>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Filter className="w-4 h-4 text-muted-foreground" />
                        {["all", "success", "failed", "in_progress"].map((filter) => (
                          <Button
                            key={filter}
                            variant={logFilter === filter ? "default" : "outline"}
                            size="sm"
                            onClick={() => setLogFilter(filter)}
                            data-testid={`button-filter-${filter}`}
                          >
                            {filter === "all" ? "All" : filter === "success" ? "Success" : filter === "failed" ? "Failed" : "In Progress"}
                          </Button>
                        ))}
                      </div>

                      {logsLoading ? (
                        <div className="space-y-2">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Skeleton key={i} className="h-10 w-full" />
                          ))}
                        </div>
                      ) : filteredLogs && filteredLogs.length > 0 ? (
                        <ScrollArea className="max-h-[400px]">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-8"></TableHead>
                                <TableHead>Event</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Records</TableHead>
                                <TableHead>Duration</TableHead>
                                <TableHead>Date</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredLogs.map((log) => {
                                const isExpanded = expandedLogRows.has(log.id);
                                const hasError = !!(log as any).errorMessage;
                                return (
                                  <React.Fragment key={log.id}>
                                    <TableRow
                                      data-testid={`row-sync-log-${log.id}`}
                                      className={hasError ? "cursor-pointer" : ""}
                                      onClick={() => hasError && toggleLogRow(log.id)}
                                    >
                                      <TableCell className="w-8 p-2">
                                        {hasError && (
                                          isExpanded
                                            ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                            : <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                        )}
                                      </TableCell>
                                      <TableCell className="font-medium text-sm">{log.eventType || "unknown"}</TableCell>
                                      <TableCell>
                                        <Badge
                                          variant={log.status === "success" ? "default" : log.status === "failed" ? "destructive" : "secondary"}
                                          className={log.status === "success" ? "bg-green-600" : ""}
                                        >
                                          {log.status === "success" ? <CheckCircle2 className="w-3 h-3 mr-1" /> : log.status === "failed" ? <XCircle className="w-3 h-3 mr-1" /> : null}
                                          {log.status}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-sm">{log.recordsSynced}</TableCell>
                                      <TableCell className="text-sm text-muted-foreground">
                                        {log.executionDurationMs ? `${log.executionDurationMs}ms` : "-"}
                                      </TableCell>
                                      <TableCell className="text-sm text-muted-foreground">{formatDate(log.createdAt as unknown as string)}</TableCell>
                                    </TableRow>
                                    {isExpanded && hasError && (
                                      <TableRow key={`${log.id}-detail`}>
                                        <TableCell colSpan={6} className="bg-muted/50 p-3">
                                          <div className="flex items-start gap-2">
                                            <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                                            <div>
                                              <p className="text-xs font-medium text-destructive">Error Details</p>
                                              <p className="text-xs text-muted-foreground mt-1 font-mono" data-testid={`text-error-${log.id}`}>
                                                {(log as any).errorMessage}
                                              </p>
                                            </div>
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    )}
                                  </React.Fragment>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                          <FileText className="w-8 h-8 text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">No sync history yet</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>

          <div className="w-full lg:w-72 shrink-0">
            <div className="space-y-0">
              <div className="py-3">
                <p className="text-xs text-muted-foreground mb-1">Auth method</p>
                <p className="text-sm font-medium" data-testid="sidebar-auth-method">
                  {isApiKeyProvider ? "API Key" : "OAuth 2"}
                </p>
              </div>
              <Separator />
              <div className="py-3">
                <p className="text-xs text-muted-foreground mb-1">Display name</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium" data-testid="sidebar-display-name">{app.name}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => copyToClipboard(app.name, "Display name")}
                    data-testid="button-copy-display-name"
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <Separator />
              <div className="py-3">
                <p className="text-xs text-muted-foreground mb-1">Integration ID</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium font-mono" data-testid="sidebar-integration-id">{app.slug}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => copyToClipboard(app.slug, "Integration ID")}
                    data-testid="button-copy-integration-id"
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <Separator />
              {providerConfig.setupUrl && (
                <>
                  <div className="py-3">
                    <p className="text-xs text-muted-foreground mb-1">API documentation</p>
                    <a
                      href={providerConfig.setupUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-primary hover:underline flex items-center gap-1.5"
                      data-testid="sidebar-api-docs-link"
                    >
                      {app.name}
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                  <Separator />
                </>
              )}
              <div className="py-3">
                <p className="text-xs text-muted-foreground mb-1">Created</p>
                <p className="text-sm font-medium" data-testid="sidebar-created-date">
                  {integration ? formatCreatedDate(integration.createdAt) : formatCreatedDate(app.createdAt)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect {app.name}?</DialogTitle>
            <DialogDescription>
              This will remove the integration, revoke access to your {app.name} account, stop all automated syncing, and delete the workflow. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisconnectDialogOpen(false)} data-testid="button-cancel-disconnect">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
              data-testid="button-confirm-disconnect"
            >
              {disconnectMutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Unplug className="w-4 h-4 mr-1.5" />}
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={credentialsDialogOpen} onOpenChange={(open) => {
        setCredentialsDialogOpen(open);
        if (!open) { setClientId(""); setClientSecret(""); }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {app && getAppIcon(app.slug)} Connect {app?.name}
            </DialogTitle>
            <DialogDescription>
              {providerConfig.helpText}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {providerConfig.setupUrl && (
              <div className="flex items-center gap-2">
                <a
                  href={providerConfig.setupUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1.5"
                  data-testid="link-setup-url"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {providerConfig.setupLinkText}
                </a>
              </div>
            )}

            {providerConfig.requiresRedirectUri && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Redirect / Callback URL (add this to your {app?.name} app)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={getOAuthRedirectUri()}
                    className="text-xs font-mono bg-muted"
                    data-testid="input-redirect-uri"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(getOAuthRedirectUri());
                      toast({ title: "Copied", description: "Redirect URL copied to clipboard." });
                    }}
                    data-testid="button-copy-redirect-uri"
                  >
                    <FileText className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {providerConfig.scopes && providerConfig.scopes.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Required Scopes / Permissions</Label>
                <div className="flex flex-wrap gap-1.5">
                  {providerConfig.scopes.map((scope) => (
                    <Badge key={scope} variant="secondary" className="text-xs font-mono no-default-active-elevate">
                      {scope}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="clientId">{providerConfig.field1Label}</Label>
              <Input
                id="clientId"
                type="text"
                placeholder={providerConfig.field1Placeholder}
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                data-testid="input-client-id"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientSecret">{providerConfig.field2Label}</Label>
              <Input
                id="clientSecret"
                type={isApiKeyProvider ? "text" : "password"}
                placeholder={providerConfig.field2Placeholder}
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                data-testid="input-client-secret"
              />
            </div>
            <div className="rounded-md bg-muted p-3">
              <p className="text-xs text-muted-foreground">
                {isApiKeyProvider
                  ? `Your ${providerConfig.field1Label} and ${providerConfig.field2Label} are encrypted and stored securely. They are used only to authenticate with ${app?.name} on your behalf.`
                  : `Your credentials are encrypted and stored securely. After entering them, you'll be redirected to ${app?.name} to authorize access to your account.`}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCredentialsDialogOpen(false)} data-testid="button-cancel-credentials">
              Cancel
            </Button>
            <Button
              onClick={handleCredentialsSubmit}
              disabled={connectMutation.isPending || !clientId.trim() || !clientSecret.trim()}
              data-testid="button-submit-credentials"
            >
              {connectMutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <ExternalLink className="w-4 h-4 mr-1.5" />}
              {connectMutation.isPending ? "Connecting..." : isApiKeyProvider ? "Connect" : "Connect & Authorize"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
