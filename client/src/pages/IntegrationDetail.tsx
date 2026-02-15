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
  Copy, Terminal, ListChecks, Workflow
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
  "acuity-scheduling": {
    field1Label: "User ID",
    field1Placeholder: "Enter your Acuity Scheduling User ID",
    field2Label: "API Key",
    field2Placeholder: "Enter your Acuity Scheduling API Key",
    helpText: "Find your API credentials in Acuity: Integrations > API. Copy your User ID and API Key.",
    setupUrl: "https://acuityscheduling.com/",
    setupLinkText: "Open Acuity Scheduling",
    requiresRedirectUri: false,
  },
  "amazon-connect": {
    field1Label: "Access Key ID",
    field1Placeholder: "Enter your AWS Access Key ID",
    field2Label: "Secret Access Key",
    field2Placeholder: "Enter your AWS Secret Access Key",
    helpText: "Create an IAM user with Amazon Connect permissions. Generate access keys under Security Credentials. Note your Instance ID from the Amazon Connect console.",
    setupUrl: "https://console.aws.amazon.com/connect/",
    setupLinkText: "Open Amazon Connect Console",
    requiresRedirectUri: false,
  },
  "amazon-polly": {
    field1Label: "Access Key ID",
    field1Placeholder: "Enter your AWS Access Key ID",
    field2Label: "Secret Access Key",
    field2Placeholder: "Enter your AWS Secret Access Key",
    helpText: "Create an IAM user with Amazon Polly permissions in AWS Console. Generate access keys under Security Credentials.",
    setupUrl: "https://console.aws.amazon.com/polly/",
    setupLinkText: "Open Amazon Polly Console",
    requiresRedirectUri: false,
  },
  "azure-speech": {
    field1Label: "Subscription Key",
    field1Placeholder: "Enter your Azure Speech Services Key",
    field2Label: "Region",
    field2Placeholder: "e.g. eastus, westeurope",
    helpText: "Create a Speech Services resource in Azure Portal. Find your key and region under Keys and Endpoint.",
    setupUrl: "https://portal.azure.com/#create/Microsoft.CognitiveServicesSpeechServices",
    setupLinkText: "Open Azure Portal",
    requiresRedirectUri: false,
  },
  bandwidth: {
    field1Label: "API Token",
    field1Placeholder: "Enter your Bandwidth API Token",
    field2Label: "API Secret",
    field2Placeholder: "Enter your Bandwidth API Secret",
    helpText: "Find your API credentials in the Bandwidth Dashboard under Account > API Credentials.",
    setupUrl: "https://dashboard.bandwidth.com/",
    setupLinkText: "Open Bandwidth Dashboard",
    requiresRedirectUri: false,
  },
  bitrix24: {
    field1Label: "Webhook URL",
    field1Placeholder: "Enter your Bitrix24 Webhook URL",
    field2Label: "User ID",
    field2Placeholder: "Enter your Bitrix24 User ID",
    helpText: "Create an inbound webhook in Bitrix24: Developer resources > Other > Inbound webhook. Copy the webhook URL.",
    setupUrl: "https://www.bitrix24.com/",
    setupLinkText: "Open Bitrix24",
    requiresRedirectUri: false,
  },
  brevo: {
    field1Label: "API Key",
    field1Placeholder: "Enter your Brevo API Key",
    field2Label: "Sender Email",
    field2Placeholder: "Enter your verified sender email",
    helpText: "Generate an API key in Brevo: Settings > SMTP & API > API Keys. Verify a sender identity first.",
    setupUrl: "https://app.brevo.com/settings/keys/api",
    setupLinkText: "Open Brevo Settings",
    requiresRedirectUri: false,
  },
  "cal-com": {
    field1Label: "API Key",
    field1Placeholder: "Enter your Cal.com API Key",
    field2Label: "Event Type ID",
    field2Placeholder: "Enter your default Event Type ID",
    helpText: "Generate an API key in Cal.com: Settings > Developer > API Keys. Find Event Type IDs in your event type settings.",
    setupUrl: "https://app.cal.com/settings/developer/api-keys",
    setupLinkText: "Open Cal.com Settings",
    requiresRedirectUri: false,
  },
  "close-crm": {
    field1Label: "API Key",
    field1Placeholder: "Enter your Close CRM API Key",
    field2Label: "Organization ID",
    field2Placeholder: "Enter your Close Organization ID (optional)",
    helpText: "Find your API key in Close: Settings > Your API Keys. Generate a new key if needed.",
    setupUrl: "https://app.close.com/settings/",
    setupLinkText: "Open Close Settings",
    requiresRedirectUri: false,
  },
  cohere: {
    field1Label: "API Key",
    field1Placeholder: "Enter your Cohere API Key",
    field2Label: "Model ID",
    field2Placeholder: "e.g. command-r-plus (optional)",
    helpText: "Generate an API key in the Cohere Dashboard under API Keys.",
    setupUrl: "https://dashboard.cohere.com/api-keys",
    setupLinkText: "Open Cohere Dashboard",
    requiresRedirectUri: false,
  },
  convertkit: {
    field1Label: "API Key",
    field1Placeholder: "Enter your ConvertKit API Key",
    field2Label: "API Secret",
    field2Placeholder: "Enter your ConvertKit API Secret",
    helpText: "Find your API credentials in ConvertKit: Settings > Advanced > API.",
    setupUrl: "https://app.convertkit.com/account_settings/advanced_settings",
    setupLinkText: "Open ConvertKit Settings",
    requiresRedirectUri: false,
  },
  "copper-crm": {
    field1Label: "API Key",
    field1Placeholder: "Enter your Copper API Key",
    field2Label: "Email",
    field2Placeholder: "Enter your Copper account email",
    helpText: "Find your API key in Copper: Settings > Integrations > API Keys.",
    setupUrl: "https://app.copper.com/",
    setupLinkText: "Open Copper CRM",
    requiresRedirectUri: false,
  },
  firebase: {
    field1Label: "Project ID",
    field1Placeholder: "Enter your Firebase Project ID",
    field2Label: "Service Account Key",
    field2Placeholder: "Paste your Firebase service account JSON key",
    helpText: "In Firebase Console, go to Project Settings > Service Accounts > Generate New Private Key. Copy the JSON contents.",
    setupUrl: "https://console.firebase.google.com/",
    setupLinkText: "Open Firebase Console",
    requiresRedirectUri: false,
  },
  front: {
    field1Label: "API Token",
    field1Placeholder: "Enter your Front API Token",
    field2Label: "Channel ID",
    field2Placeholder: "Enter your Front Channel ID",
    helpText: "Generate an API token in Front: Settings > Developers > API Tokens. Find Channel IDs in your channel settings.",
    setupUrl: "https://app.frontapp.com/settings/tools/api",
    setupLinkText: "Open Front Settings",
    requiresRedirectUri: false,
  },
  gohighlevel: {
    field1Label: "API Key",
    field1Placeholder: "Enter your GoHighLevel API Key",
    field2Label: "Location ID",
    field2Placeholder: "Enter your GoHighLevel Location ID",
    helpText: "Find your API key in GoHighLevel: Settings > Business Profile > API Key. The Location ID is in your account URL.",
    setupUrl: "https://app.gohighlevel.com/",
    setupLinkText: "Open GoHighLevel",
    requiresRedirectUri: false,
  },
  "google-cloud-tts": {
    field1Label: "API Key",
    field1Placeholder: "Enter your Google Cloud API Key",
    field2Label: "Project ID",
    field2Placeholder: "Enter your Google Cloud Project ID",
    helpText: "Enable the Cloud Text-to-Speech API in Google Cloud Console. Create an API key under APIs & Services > Credentials.",
    setupUrl: "https://console.cloud.google.com/apis/library/texttospeech.googleapis.com",
    setupLinkText: "Open Google Cloud Console",
    requiresRedirectUri: false,
  },
  greenhouse: {
    field1Label: "API Key",
    field1Placeholder: "Enter your Greenhouse Harvest API Key",
    field2Label: "On-Behalf-Of User ID",
    field2Placeholder: "Enter the user ID for API actions",
    helpText: "Generate a Harvest API key in Greenhouse: Configure > Dev Center > API Credential Management.",
    setupUrl: "https://app.greenhouse.io/",
    setupLinkText: "Open Greenhouse",
    requiresRedirectUri: false,
  },
  groq: {
    field1Label: "API Key",
    field1Placeholder: "Enter your Groq API Key",
    field2Label: "Model ID",
    field2Placeholder: "e.g. llama-3.1-70b-versatile (optional)",
    helpText: "Generate an API key at console.groq.com under API Keys.",
    setupUrl: "https://console.groq.com/keys",
    setupLinkText: "Open Groq Console",
    requiresRedirectUri: false,
  },
  insightly: {
    field1Label: "API Key",
    field1Placeholder: "Enter your Insightly API Key",
    field2Label: "Pod URL",
    field2Placeholder: "e.g. api.na1.insightly.com",
    helpText: "Find your API key in Insightly: User Settings > API. Your pod URL depends on your data center region.",
    setupUrl: "https://crm.insightly.com/",
    setupLinkText: "Open Insightly",
    requiresRedirectUri: false,
  },
  keap: {
    field1Label: "Client ID",
    field1Placeholder: "Enter your Keap Client ID",
    field2Label: "Client Secret",
    field2Placeholder: "Enter your Keap Client Secret",
    helpText: "Create an app in the Keap Developer Portal. Add the redirect URL below. Copy the Client ID and Client Secret.",
    setupUrl: "https://keys.developer.keap.com/",
    setupLinkText: "Open Keap Developer Portal",
    requiresRedirectUri: true,
    scopes: ["full"],
  },
  lever: {
    field1Label: "API Key",
    field1Placeholder: "Enter your Lever API Key",
    field2Label: "Environment",
    field2Placeholder: "e.g. sandbox or production",
    helpText: "Generate an API key in Lever: Settings > Integrations and API > API Credentials.",
    setupUrl: "https://hire.lever.co/settings/integrations",
    setupLinkText: "Open Lever Settings",
    requiresRedirectUri: false,
  },
  "microsoft-outlook": {
    field1Label: "Client ID",
    field1Placeholder: "Enter your Azure Application Client ID",
    field2Label: "Client Secret",
    field2Placeholder: "Enter your Azure Client Secret",
    helpText: "Register an app in Azure Portal > App Registrations. Under API Permissions, add Microsoft Graph permissions for Mail and Calendar. Add the redirect URL below.",
    setupUrl: "https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade",
    setupLinkText: "Open Azure Portal",
    requiresRedirectUri: true,
    scopes: ["Mail.ReadWrite", "Calendars.ReadWrite"],
  },
  mistral: {
    field1Label: "API Key",
    field1Placeholder: "Enter your Mistral AI API Key",
    field2Label: "Model ID",
    field2Placeholder: "e.g. mistral-large-latest (optional)",
    helpText: "Generate an API key in the Mistral AI platform under API Keys.",
    setupUrl: "https://console.mistral.ai/api-keys",
    setupLinkText: "Open Mistral Console",
    requiresRedirectUri: false,
  },
  mixpanel: {
    field1Label: "Project Token",
    field1Placeholder: "Enter your Mixpanel Project Token",
    field2Label: "API Secret",
    field2Placeholder: "Enter your Mixpanel API Secret",
    helpText: "Find your Project Token and API Secret in Mixpanel: Settings > Project Settings.",
    setupUrl: "https://mixpanel.com/settings/project",
    setupLinkText: "Open Mixpanel Settings",
    requiresRedirectUri: false,
  },
  murf: {
    field1Label: "API Key",
    field1Placeholder: "Enter your Murf AI API Key",
    field2Label: "Default Voice ID",
    field2Placeholder: "Enter default voice ID (optional)",
    helpText: "Generate an API key in Murf Studio: Account Settings > API. Browse available voices in the Voice Library.",
    setupUrl: "https://murf.ai/studio",
    setupLinkText: "Open Murf Studio",
    requiresRedirectUri: false,
  },
  n8n: {
    field1Label: "Webhook URL",
    field1Placeholder: "Enter your n8n Webhook URL",
    field2Label: "Header Auth Value",
    field2Placeholder: "Enter authentication header value (optional)",
    helpText: "Create a workflow in n8n with a Webhook trigger node. Copy the Production Webhook URL. Optionally set up Header Auth for security.",
    setupUrl: "https://app.n8n.cloud/",
    setupLinkText: "Open n8n",
    requiresRedirectUri: false,
  },
  perplexity: {
    field1Label: "API Key",
    field1Placeholder: "Enter your Perplexity API Key",
    field2Label: "Model ID",
    field2Placeholder: "e.g. llama-3.1-sonar-large-128k-online (optional)",
    helpText: "Generate an API key in Perplexity Settings under API.",
    setupUrl: "https://www.perplexity.ai/settings/api",
    setupLinkText: "Open Perplexity Settings",
    requiresRedirectUri: false,
  },
  playht: {
    field1Label: "API Key",
    field1Placeholder: "Enter your PlayHT API Key",
    field2Label: "User ID",
    field2Placeholder: "Enter your PlayHT User ID",
    helpText: "Find your API Key and User ID in PlayHT: Settings > API Access.",
    setupUrl: "https://play.ht/studio/api-access",
    setupLinkText: "Open PlayHT Settings",
    requiresRedirectUri: false,
  },
  plivo: {
    field1Label: "Auth ID",
    field1Placeholder: "Enter your Plivo Auth ID",
    field2Label: "Auth Token",
    field2Placeholder: "Enter your Plivo Auth Token",
    helpText: "Find your Auth ID and Auth Token on the Plivo Console dashboard.",
    setupUrl: "https://console.plivo.com/dashboard/",
    setupLinkText: "Open Plivo Console",
    requiresRedirectUri: false,
  },
  segment: {
    field1Label: "Write Key",
    field1Placeholder: "Enter your Segment Source Write Key",
    field2Label: "Workspace Slug",
    field2Placeholder: "Enter your Segment workspace slug (optional)",
    helpText: "Find your Write Key in Segment: Sources > Your Source > Settings > API Keys.",
    setupUrl: "https://app.segment.com/",
    setupLinkText: "Open Segment",
    requiresRedirectUri: false,
  },
  sugarcrm: {
    field1Label: "Client ID",
    field1Placeholder: "Enter your SugarCRM OAuth Client ID",
    field2Label: "Client Secret",
    field2Placeholder: "Enter your SugarCRM OAuth Client Secret",
    helpText: "Create an OAuth Key in SugarCRM: Administration > OAuth Keys. Enter your instance URL during setup.",
    setupUrl: "https://www.sugarcrm.com/",
    setupLinkText: "Open SugarCRM",
    requiresRedirectUri: false,
  },
  supabase: {
    field1Label: "API URL",
    field1Placeholder: "Enter your Supabase Project URL",
    field2Label: "Service Role Key",
    field2Placeholder: "Enter your Supabase Service Role Key",
    helpText: "Find your Project URL and Service Role Key in Supabase: Project Settings > API.",
    setupUrl: "https://supabase.com/dashboard",
    setupLinkText: "Open Supabase Dashboard",
    requiresRedirectUri: false,
  },
  telnyx: {
    field1Label: "API Key",
    field1Placeholder: "Enter your Telnyx API Key (KEY...)",
    field2Label: "Connection ID",
    field2Placeholder: "Enter your Telnyx SIP Connection ID",
    helpText: "Generate an API key in the Telnyx Portal: Auth > API Keys. Find your Connection ID under SIP Connections.",
    setupUrl: "https://portal.telnyx.com/",
    setupLinkText: "Open Telnyx Portal",
    requiresRedirectUri: false,
  },
  vonage: {
    field1Label: "API Key",
    field1Placeholder: "Enter your Vonage API Key",
    field2Label: "API Secret",
    field2Placeholder: "Enter your Vonage API Secret",
    helpText: "Find your API Key and Secret on the Vonage Dashboard under API Settings.",
    setupUrl: "https://dashboard.nexmo.com/",
    setupLinkText: "Open Vonage Dashboard",
    requiresRedirectUri: false,
  },
  woocommerce: {
    field1Label: "Consumer Key",
    field1Placeholder: "Enter your WooCommerce Consumer Key (ck_...)",
    field2Label: "Consumer Secret",
    field2Placeholder: "Enter your WooCommerce Consumer Secret (cs_...)",
    helpText: "Generate REST API keys in WooCommerce: Settings > Advanced > REST API > Add Key. Set permissions to Read/Write.",
    setupUrl: "https://woocommerce.com/",
    setupLinkText: "Open WooCommerce",
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

interface ProviderUseCase {
  id: string;
  title: string;
  description: string;
  category: string;
  n8nTemplateName: string;
  n8nTemplateDescription: string;
  triggerEvent: string;
  expectedOutcome: string;
}

const PROVIDER_USE_CASES: Record<string, ProviderUseCase[]> = {
  salesforce: [
    { id: "sf-log-calls", title: "Auto-log calls as activities", description: "Automatically create activity records in Salesforce for every completed call with full transcript and outcome data.", category: "CRM", n8nTemplateName: "Salesforce Call Logger", n8nTemplateDescription: "Logs call data as Salesforce Task activities", triggerEvent: "call.completed", expectedOutcome: "New Task activity created in Salesforce with call details" },
    { id: "sf-create-leads", title: "Create leads from new callers", description: "Automatically create new Lead records when unknown callers are detected during conversations.", category: "CRM", n8nTemplateName: "Salesforce Lead Creator", n8nTemplateDescription: "Creates leads from unrecognized phone numbers", triggerEvent: "call.new_caller", expectedOutcome: "New Lead record created with caller information" },
    { id: "sf-sync-contacts", title: "Sync contact data after conversations", description: "Update Salesforce Contact records with latest conversation insights and extracted data points.", category: "CRM", n8nTemplateName: "Salesforce Contact Sync", n8nTemplateDescription: "Syncs conversation data to contact records", triggerEvent: "call.analyzed", expectedOutcome: "Contact record updated with latest conversation data" },
    { id: "sf-update-opps", title: "Update opportunity stages", description: "Automatically advance or update Opportunity stages based on call outcomes and AI analysis.", category: "CRM", n8nTemplateName: "Salesforce Opportunity Updater", n8nTemplateDescription: "Updates opportunity stages from call results", triggerEvent: "call.outcome_determined", expectedOutcome: "Opportunity stage updated based on call analysis" },
  ],
  hubspot: [
    { id: "hs-create-deals", title: "Create deals from qualified calls", description: "Automatically create new deals in HubSpot when calls are identified as sales-qualified opportunities.", category: "CRM", n8nTemplateName: "HubSpot Deal Creator", n8nTemplateDescription: "Creates deals from qualified call outcomes", triggerEvent: "call.qualified", expectedOutcome: "New deal created in HubSpot pipeline" },
    { id: "hs-push-notes", title: "Push call notes to timeline", description: "Add detailed call notes and transcripts to the HubSpot contact timeline for complete interaction history.", category: "CRM", n8nTemplateName: "HubSpot Timeline Logger", n8nTemplateDescription: "Pushes call notes to contact timeline", triggerEvent: "call.completed", expectedOutcome: "Call notes added to contact timeline in HubSpot" },
    { id: "hs-sync-contacts", title: "Sync contacts bi-directionally", description: "Keep contact information synchronized between your calling platform and HubSpot in both directions.", category: "CRM", n8nTemplateName: "HubSpot Contact Sync", n8nTemplateDescription: "Bi-directional contact synchronization", triggerEvent: "contact.updated", expectedOutcome: "Contact data synced between platforms" },
    { id: "hs-followup", title: "Trigger follow-up sequences", description: "Automatically enroll contacts into HubSpot email sequences based on call outcomes and qualification status.", category: "CRM", n8nTemplateName: "HubSpot Sequence Trigger", n8nTemplateDescription: "Enrolls contacts in follow-up sequences", triggerEvent: "call.followup_needed", expectedOutcome: "Contact enrolled in appropriate follow-up sequence" },
  ],
  zoho: [
    { id: "zoho-log-calls", title: "Log call activities", description: "Create call activity records in Zoho CRM with complete conversation details and outcomes.", category: "CRM", n8nTemplateName: "Zoho Call Logger", n8nTemplateDescription: "Logs calls as Zoho activities", triggerEvent: "call.completed", expectedOutcome: "Call activity logged in Zoho CRM" },
    { id: "zoho-sync-leads", title: "Sync leads after conversations", description: "Synchronize lead data and conversation insights to Zoho CRM lead records.", category: "CRM", n8nTemplateName: "Zoho Lead Sync", n8nTemplateDescription: "Syncs lead data post-conversation", triggerEvent: "call.analyzed", expectedOutcome: "Lead record updated in Zoho CRM" },
    { id: "zoho-update-deals", title: "Update deal stages", description: "Advance deal stages in Zoho CRM based on call outcomes and qualification criteria.", category: "CRM", n8nTemplateName: "Zoho Deal Updater", n8nTemplateDescription: "Updates deal stages from call results", triggerEvent: "call.outcome_determined", expectedOutcome: "Deal stage updated in Zoho CRM" },
    { id: "zoho-create-tasks", title: "Create follow-up tasks", description: "Automatically create follow-up tasks in Zoho CRM based on action items from calls.", category: "CRM", n8nTemplateName: "Zoho Task Creator", n8nTemplateDescription: "Creates tasks from call action items", triggerEvent: "call.action_items", expectedOutcome: "Follow-up task created in Zoho CRM" },
  ],
  pipedrive: [
    { id: "pd-create-activities", title: "Create activities from calls", description: "Log call activities in Pipedrive with detailed notes and outcome tracking.", category: "CRM", n8nTemplateName: "Pipedrive Activity Creator", n8nTemplateDescription: "Creates activities from completed calls", triggerEvent: "call.completed", expectedOutcome: "Activity created in Pipedrive" },
    { id: "pd-update-deals", title: "Update deal progress", description: "Move deals through pipeline stages based on call outcomes and buyer signals.", category: "CRM", n8nTemplateName: "Pipedrive Deal Updater", n8nTemplateDescription: "Updates deal stages from call analysis", triggerEvent: "call.outcome_determined", expectedOutcome: "Deal stage updated in Pipedrive" },
    { id: "pd-sync-persons", title: "Sync person data", description: "Keep person records in Pipedrive synchronized with caller information.", category: "CRM", n8nTemplateName: "Pipedrive Person Sync", n8nTemplateDescription: "Syncs caller data to person records", triggerEvent: "contact.updated", expectedOutcome: "Person record updated in Pipedrive" },
    { id: "pd-push-outcomes", title: "Push call outcomes", description: "Record call outcomes and dispositions directly to Pipedrive deal and activity records.", category: "CRM", n8nTemplateName: "Pipedrive Outcome Logger", n8nTemplateDescription: "Pushes call outcomes to Pipedrive", triggerEvent: "call.outcome_determined", expectedOutcome: "Call outcome recorded in Pipedrive" },
  ],
  freshsales: [
    { id: "fs-log-outcomes", title: "Log call outcomes", description: "Record call outcomes and dispositions in Freshsales for complete activity tracking.", category: "CRM", n8nTemplateName: "Freshsales Call Logger", n8nTemplateDescription: "Logs call outcomes in Freshsales", triggerEvent: "call.completed", expectedOutcome: "Call outcome logged in Freshsales" },
    { id: "fs-update-scores", title: "Update lead scores", description: "Automatically adjust lead scores in Freshsales based on call engagement and outcomes.", category: "CRM", n8nTemplateName: "Freshsales Score Updater", n8nTemplateDescription: "Updates lead scores from call data", triggerEvent: "call.analyzed", expectedOutcome: "Lead score updated in Freshsales" },
    { id: "fs-create-tasks", title: "Create tasks from calls", description: "Generate follow-up tasks in Freshsales from action items identified during calls.", category: "CRM", n8nTemplateName: "Freshsales Task Creator", n8nTemplateDescription: "Creates tasks from call action items", triggerEvent: "call.action_items", expectedOutcome: "Task created in Freshsales" },
    { id: "fs-sync-contacts", title: "Sync contact data", description: "Synchronize contact information between your calling platform and Freshsales.", category: "CRM", n8nTemplateName: "Freshsales Contact Sync", n8nTemplateDescription: "Syncs contact data bi-directionally", triggerEvent: "contact.updated", expectedOutcome: "Contact synced in Freshsales" },
  ],
  dynamics365: [
    { id: "d365-create-calls", title: "Create phone call activities", description: "Create Phone Call activity records in Dynamics 365 for every completed conversation.", category: "CRM", n8nTemplateName: "Dynamics 365 Call Creator", n8nTemplateDescription: "Creates phone call activities", triggerEvent: "call.completed", expectedOutcome: "Phone Call activity created in Dynamics 365" },
    { id: "d365-sync-leads", title: "Sync leads", description: "Synchronize lead data between your calling platform and Dynamics 365.", category: "CRM", n8nTemplateName: "Dynamics 365 Lead Sync", n8nTemplateDescription: "Syncs lead records", triggerEvent: "call.new_caller", expectedOutcome: "Lead synced in Dynamics 365" },
    { id: "d365-update-quals", title: "Update lead qualifications", description: "Update lead qualification status in Dynamics 365 based on call analysis results.", category: "CRM", n8nTemplateName: "Dynamics 365 Qualification Updater", n8nTemplateDescription: "Updates lead qualification from calls", triggerEvent: "call.qualified", expectedOutcome: "Lead qualification updated in Dynamics 365" },
    { id: "d365-log-outcomes", title: "Log conversation outcomes", description: "Record detailed conversation outcomes and notes in Dynamics 365 activity records.", category: "CRM", n8nTemplateName: "Dynamics 365 Outcome Logger", n8nTemplateDescription: "Logs conversation outcomes", triggerEvent: "call.outcome_determined", expectedOutcome: "Outcome logged in Dynamics 365" },
  ],
  "close-crm": [
    { id: "close-log-calls", title: "Auto-log calls", description: "Automatically log all call activities in Close CRM with transcripts and outcomes.", category: "CRM", n8nTemplateName: "Close CRM Call Logger", n8nTemplateDescription: "Logs calls in Close CRM", triggerEvent: "call.completed", expectedOutcome: "Call logged in Close CRM" },
    { id: "close-update-leads", title: "Update lead statuses", description: "Update lead status in Close CRM based on call outcomes and engagement levels.", category: "CRM", n8nTemplateName: "Close CRM Lead Updater", n8nTemplateDescription: "Updates lead statuses from calls", triggerEvent: "call.outcome_determined", expectedOutcome: "Lead status updated in Close CRM" },
    { id: "close-sync-contacts", title: "Sync contact info", description: "Keep contact information synchronized between your calling platform and Close CRM.", category: "CRM", n8nTemplateName: "Close CRM Contact Sync", n8nTemplateDescription: "Syncs contact data", triggerEvent: "contact.updated", expectedOutcome: "Contact synced in Close CRM" },
    { id: "close-create-tasks", title: "Create tasks", description: "Generate follow-up tasks in Close CRM from call action items.", category: "CRM", n8nTemplateName: "Close CRM Task Creator", n8nTemplateDescription: "Creates tasks from calls", triggerEvent: "call.action_items", expectedOutcome: "Task created in Close CRM" },
  ],
  "copper-crm": [
    { id: "copper-push-summaries", title: "Push call summaries", description: "Push AI-generated call summaries to Copper CRM contact and opportunity records.", category: "CRM", n8nTemplateName: "Copper Call Summary Pusher", n8nTemplateDescription: "Pushes call summaries to Copper", triggerEvent: "call.summarized", expectedOutcome: "Call summary added to Copper record" },
    { id: "copper-create-contacts", title: "Create contacts from callers", description: "Automatically create new contacts in Copper CRM from unrecognized callers.", category: "CRM", n8nTemplateName: "Copper Contact Creator", n8nTemplateDescription: "Creates contacts from new callers", triggerEvent: "call.new_caller", expectedOutcome: "Contact created in Copper CRM" },
    { id: "copper-sync-activities", title: "Sync activities", description: "Synchronize call activities between your platform and Copper CRM.", category: "CRM", n8nTemplateName: "Copper Activity Sync", n8nTemplateDescription: "Syncs call activities", triggerEvent: "call.completed", expectedOutcome: "Activity synced in Copper CRM" },
    { id: "copper-update-opps", title: "Update opportunities", description: "Update opportunity records in Copper CRM based on call outcomes.", category: "CRM", n8nTemplateName: "Copper Opportunity Updater", n8nTemplateDescription: "Updates opportunities from calls", triggerEvent: "call.outcome_determined", expectedOutcome: "Opportunity updated in Copper CRM" },
  ],
  gohighlevel: [
    { id: "ghl-trigger-workflows", title: "Trigger follow-up workflows", description: "Trigger automated follow-up workflows in GoHighLevel based on call outcomes.", category: "CRM", n8nTemplateName: "GHL Workflow Trigger", n8nTemplateDescription: "Triggers follow-up workflows", triggerEvent: "call.followup_needed", expectedOutcome: "Follow-up workflow triggered in GoHighLevel" },
    { id: "ghl-sync-contacts", title: "Sync contacts", description: "Synchronize contact data between your calling platform and GoHighLevel.", category: "CRM", n8nTemplateName: "GHL Contact Sync", n8nTemplateDescription: "Syncs contact records", triggerEvent: "contact.updated", expectedOutcome: "Contact synced in GoHighLevel" },
    { id: "ghl-update-pipeline", title: "Update pipeline stages", description: "Move opportunities through GoHighLevel pipeline stages based on call analysis.", category: "CRM", n8nTemplateName: "GHL Pipeline Updater", n8nTemplateDescription: "Updates pipeline stages", triggerEvent: "call.outcome_determined", expectedOutcome: "Pipeline stage updated in GoHighLevel" },
    { id: "ghl-send-sms", title: "Send follow-up SMS", description: "Send automated SMS follow-ups via GoHighLevel after call completion.", category: "CRM", n8nTemplateName: "GHL SMS Sender", n8nTemplateDescription: "Sends follow-up SMS messages", triggerEvent: "call.completed", expectedOutcome: "Follow-up SMS sent via GoHighLevel" },
  ],
  keap: [
    { id: "keap-tag-leads", title: "Tag leads based on call outcome", description: "Automatically apply tags to Keap contacts based on call disposition and outcomes.", category: "CRM", n8nTemplateName: "Keap Lead Tagger", n8nTemplateDescription: "Tags contacts from call outcomes", triggerEvent: "call.outcome_determined", expectedOutcome: "Tags applied to contact in Keap" },
    { id: "keap-create-contacts", title: "Create contacts", description: "Create new contacts in Keap from unrecognized callers.", category: "CRM", n8nTemplateName: "Keap Contact Creator", n8nTemplateDescription: "Creates contacts from new callers", triggerEvent: "call.new_caller", expectedOutcome: "Contact created in Keap" },
    { id: "keap-trigger-campaigns", title: "Trigger campaigns", description: "Trigger Keap marketing campaigns based on call outcomes and lead qualification.", category: "CRM", n8nTemplateName: "Keap Campaign Trigger", n8nTemplateDescription: "Triggers campaigns from call results", triggerEvent: "call.qualified", expectedOutcome: "Campaign triggered in Keap" },
    { id: "keap-log-activities", title: "Log call activities", description: "Log call activities in Keap contact records for complete interaction history.", category: "CRM", n8nTemplateName: "Keap Activity Logger", n8nTemplateDescription: "Logs call activities", triggerEvent: "call.completed", expectedOutcome: "Activity logged in Keap" },
  ],
  sugarcrm: [
    { id: "sugar-log-calls", title: "Log call activities", description: "Create call activity records in SugarCRM with conversation details.", category: "CRM", n8nTemplateName: "SugarCRM Call Logger", n8nTemplateDescription: "Logs calls in SugarCRM", triggerEvent: "call.completed", expectedOutcome: "Call activity logged in SugarCRM" },
    { id: "sugar-sync-leads", title: "Sync leads", description: "Synchronize lead data between your calling platform and SugarCRM.", category: "CRM", n8nTemplateName: "SugarCRM Lead Sync", n8nTemplateDescription: "Syncs lead records", triggerEvent: "call.new_caller", expectedOutcome: "Lead synced in SugarCRM" },
    { id: "sugar-update-opps", title: "Update opportunities", description: "Update opportunity stages in SugarCRM based on call outcomes.", category: "CRM", n8nTemplateName: "SugarCRM Opportunity Updater", n8nTemplateDescription: "Updates opportunities from calls", triggerEvent: "call.outcome_determined", expectedOutcome: "Opportunity updated in SugarCRM" },
    { id: "sugar-create-tasks", title: "Create follow-up tasks", description: "Generate follow-up tasks in SugarCRM from call action items.", category: "CRM", n8nTemplateName: "SugarCRM Task Creator", n8nTemplateDescription: "Creates tasks from calls", triggerEvent: "call.action_items", expectedOutcome: "Task created in SugarCRM" },
  ],
  bitrix24: [
    { id: "bitrix-push-calls", title: "Push call data", description: "Push call data and recordings to Bitrix24 CRM activities.", category: "CRM", n8nTemplateName: "Bitrix24 Call Pusher", n8nTemplateDescription: "Pushes call data to Bitrix24", triggerEvent: "call.completed", expectedOutcome: "Call data pushed to Bitrix24" },
    { id: "bitrix-sync-leads", title: "Sync leads", description: "Synchronize lead records between your platform and Bitrix24.", category: "CRM", n8nTemplateName: "Bitrix24 Lead Sync", n8nTemplateDescription: "Syncs lead data", triggerEvent: "call.new_caller", expectedOutcome: "Lead synced in Bitrix24" },
    { id: "bitrix-create-activities", title: "Create activities", description: "Create activity records in Bitrix24 from call events.", category: "CRM", n8nTemplateName: "Bitrix24 Activity Creator", n8nTemplateDescription: "Creates activities from calls", triggerEvent: "call.completed", expectedOutcome: "Activity created in Bitrix24" },
    { id: "bitrix-update-deals", title: "Update deals", description: "Update deal stages in Bitrix24 based on call outcomes.", category: "CRM", n8nTemplateName: "Bitrix24 Deal Updater", n8nTemplateDescription: "Updates deals from call results", triggerEvent: "call.outcome_determined", expectedOutcome: "Deal updated in Bitrix24" },
  ],
  insightly: [
    { id: "insightly-create-leads", title: "Create leads from calls", description: "Create new lead records in Insightly from incoming call data.", category: "CRM", n8nTemplateName: "Insightly Lead Creator", n8nTemplateDescription: "Creates leads from calls", triggerEvent: "call.new_caller", expectedOutcome: "Lead created in Insightly" },
    { id: "insightly-log-notes", title: "Log call notes", description: "Add call notes and transcripts to Insightly contact records.", category: "CRM", n8nTemplateName: "Insightly Note Logger", n8nTemplateDescription: "Logs call notes", triggerEvent: "call.completed", expectedOutcome: "Notes logged in Insightly" },
    { id: "insightly-sync-contacts", title: "Sync contacts", description: "Synchronize contact information between platforms and Insightly.", category: "CRM", n8nTemplateName: "Insightly Contact Sync", n8nTemplateDescription: "Syncs contact data", triggerEvent: "contact.updated", expectedOutcome: "Contact synced in Insightly" },
    { id: "insightly-update-pipelines", title: "Update pipelines", description: "Update pipeline stages in Insightly based on call analysis.", category: "CRM", n8nTemplateName: "Insightly Pipeline Updater", n8nTemplateDescription: "Updates pipelines from calls", triggerEvent: "call.outcome_determined", expectedOutcome: "Pipeline updated in Insightly" },
  ],
  twilio: [
    { id: "twilio-sms-followup", title: "Send SMS follow-up after calls", description: "Automatically send SMS follow-up messages via Twilio after call completion.", category: "Telephony", n8nTemplateName: "Twilio SMS Follow-up", n8nTemplateDescription: "Sends post-call SMS messages", triggerEvent: "call.completed", expectedOutcome: "SMS follow-up sent via Twilio" },
    { id: "twilio-route-calls", title: "Route calls based on AI analysis", description: "Intelligently route incoming calls using AI analysis of caller intent.", category: "Telephony", n8nTemplateName: "Twilio Call Router", n8nTemplateDescription: "Routes calls with AI analysis", triggerEvent: "call.incoming", expectedOutcome: "Call routed to appropriate destination" },
    { id: "twilio-track-metrics", title: "Track call metrics", description: "Track and aggregate call metrics and analytics via Twilio.", category: "Telephony", n8nTemplateName: "Twilio Metrics Tracker", n8nTemplateDescription: "Tracks call performance metrics", triggerEvent: "call.completed", expectedOutcome: "Call metrics recorded and aggregated" },
    { id: "twilio-verify", title: "Verify phone numbers", description: "Verify caller phone numbers using Twilio Lookup API.", category: "Telephony", n8nTemplateName: "Twilio Number Verifier", n8nTemplateDescription: "Verifies phone numbers", triggerEvent: "call.incoming", expectedOutcome: "Phone number verified via Twilio" },
  ],
  plivo: [
    { id: "plivo-sms", title: "Send post-call SMS", description: "Send follow-up SMS messages via Plivo after call completion.", category: "Telephony", n8nTemplateName: "Plivo SMS Sender", n8nTemplateDescription: "Sends post-call SMS", triggerEvent: "call.completed", expectedOutcome: "SMS sent via Plivo" },
    { id: "plivo-analytics", title: "Track call analytics", description: "Track and analyze call performance metrics through Plivo.", category: "Telephony", n8nTemplateName: "Plivo Analytics Tracker", n8nTemplateDescription: "Tracks call analytics", triggerEvent: "call.completed", expectedOutcome: "Analytics data recorded in Plivo" },
    { id: "plivo-route", title: "Route international calls", description: "Route international calls through optimal Plivo carriers.", category: "Telephony", n8nTemplateName: "Plivo Call Router", n8nTemplateDescription: "Routes international calls", triggerEvent: "call.incoming", expectedOutcome: "Call routed through Plivo" },
    { id: "plivo-verify", title: "Number verification", description: "Verify and validate phone numbers using Plivo.", category: "Telephony", n8nTemplateName: "Plivo Number Verifier", n8nTemplateDescription: "Verifies phone numbers", triggerEvent: "call.incoming", expectedOutcome: "Number verified via Plivo" },
  ],
  vonage: [
    { id: "vonage-sms", title: "Send SMS notifications", description: "Send SMS notifications via Vonage for call events and outcomes.", category: "Telephony", n8nTemplateName: "Vonage SMS Notifier", n8nTemplateDescription: "Sends SMS notifications", triggerEvent: "call.completed", expectedOutcome: "SMS notification sent via Vonage" },
    { id: "vonage-quality", title: "Track call quality", description: "Monitor and track call quality metrics through Vonage.", category: "Telephony", n8nTemplateName: "Vonage Quality Tracker", n8nTemplateDescription: "Tracks call quality", triggerEvent: "call.completed", expectedOutcome: "Quality metrics recorded" },
    { id: "vonage-route", title: "Route calls", description: "Route calls through Vonage with intelligent call distribution.", category: "Telephony", n8nTemplateName: "Vonage Call Router", n8nTemplateDescription: "Routes calls", triggerEvent: "call.incoming", expectedOutcome: "Call routed via Vonage" },
    { id: "vonage-lookup", title: "Number lookup", description: "Look up phone number details using Vonage Number Insight.", category: "Telephony", n8nTemplateName: "Vonage Number Lookup", n8nTemplateDescription: "Looks up number info", triggerEvent: "call.incoming", expectedOutcome: "Number details retrieved" },
  ],
  bandwidth: [
    { id: "bw-sms", title: "SMS follow-up", description: "Send SMS follow-up messages via Bandwidth after calls.", category: "Telephony", n8nTemplateName: "Bandwidth SMS Sender", n8nTemplateDescription: "Sends follow-up SMS", triggerEvent: "call.completed", expectedOutcome: "SMS sent via Bandwidth" },
    { id: "bw-tracking", title: "Call tracking", description: "Track call events and metrics through Bandwidth.", category: "Telephony", n8nTemplateName: "Bandwidth Call Tracker", n8nTemplateDescription: "Tracks call data", triggerEvent: "call.completed", expectedOutcome: "Call data tracked in Bandwidth" },
    { id: "bw-numbers", title: "Number management", description: "Manage phone numbers and provisioning through Bandwidth.", category: "Telephony", n8nTemplateName: "Bandwidth Number Manager", n8nTemplateDescription: "Manages phone numbers", triggerEvent: "system.provision", expectedOutcome: "Numbers managed via Bandwidth" },
    { id: "bw-routing", title: "Call routing", description: "Route calls through Bandwidth network with custom logic.", category: "Telephony", n8nTemplateName: "Bandwidth Call Router", n8nTemplateDescription: "Routes calls", triggerEvent: "call.incoming", expectedOutcome: "Call routed via Bandwidth" },
  ],
  telnyx: [
    { id: "telnyx-messaging", title: "Post-call messaging", description: "Send post-call messages via Telnyx messaging API.", category: "Telephony", n8nTemplateName: "Telnyx Messenger", n8nTemplateDescription: "Sends post-call messages", triggerEvent: "call.completed", expectedOutcome: "Message sent via Telnyx" },
    { id: "telnyx-analytics", title: "Call analytics", description: "Track call analytics and performance through Telnyx.", category: "Telephony", n8nTemplateName: "Telnyx Analytics", n8nTemplateDescription: "Tracks call analytics", triggerEvent: "call.completed", expectedOutcome: "Analytics recorded in Telnyx" },
    { id: "telnyx-provision", title: "Number provisioning", description: "Provision and manage phone numbers through Telnyx.", category: "Telephony", n8nTemplateName: "Telnyx Number Provisioner", n8nTemplateDescription: "Provisions numbers", triggerEvent: "system.provision", expectedOutcome: "Numbers provisioned via Telnyx" },
    { id: "telnyx-sip", title: "SIP routing", description: "Configure SIP routing through Telnyx for advanced call handling.", category: "Telephony", n8nTemplateName: "Telnyx SIP Router", n8nTemplateDescription: "Configures SIP routing", triggerEvent: "call.incoming", expectedOutcome: "SIP routing configured via Telnyx" },
  ],
  "amazon-connect": [
    { id: "ac-route-agents", title: "Route to live agents", description: "Route calls to live agents in Amazon Connect based on AI analysis.", category: "Telephony", n8nTemplateName: "Amazon Connect Agent Router", n8nTemplateDescription: "Routes to live agents", triggerEvent: "call.escalation", expectedOutcome: "Call routed to live agent" },
    { id: "ac-track-metrics", title: "Track call metrics", description: "Track and report on call center metrics through Amazon Connect.", category: "Telephony", n8nTemplateName: "Amazon Connect Metrics", n8nTemplateDescription: "Tracks call metrics", triggerEvent: "call.completed", expectedOutcome: "Metrics tracked in Amazon Connect" },
    { id: "ac-queue", title: "Queue management", description: "Manage call queues and routing in Amazon Connect.", category: "Telephony", n8nTemplateName: "Amazon Connect Queue Manager", n8nTemplateDescription: "Manages call queues", triggerEvent: "call.incoming", expectedOutcome: "Queue managed in Amazon Connect" },
    { id: "ac-surveys", title: "Post-call surveys", description: "Trigger post-call surveys through Amazon Connect.", category: "Telephony", n8nTemplateName: "Amazon Connect Survey", n8nTemplateDescription: "Sends post-call surveys", triggerEvent: "call.completed", expectedOutcome: "Survey triggered via Amazon Connect" },
  ],
  openai: [
    { id: "oai-summaries", title: "Generate call summaries", description: "Use OpenAI to generate concise, structured summaries of call transcripts.", category: "AI & LLM", n8nTemplateName: "OpenAI Call Summarizer", n8nTemplateDescription: "Generates AI call summaries", triggerEvent: "call.transcribed", expectedOutcome: "AI-generated call summary created" },
    { id: "oai-sentiment", title: "Sentiment analysis of transcripts", description: "Analyze caller sentiment throughout the conversation using OpenAI.", category: "AI & LLM", n8nTemplateName: "OpenAI Sentiment Analyzer", n8nTemplateDescription: "Analyzes transcript sentiment", triggerEvent: "call.transcribed", expectedOutcome: "Sentiment scores generated for call" },
    { id: "oai-action-items", title: "Extract action items", description: "Extract and categorize action items from call transcripts using OpenAI.", category: "AI & LLM", n8nTemplateName: "OpenAI Action Extractor", n8nTemplateDescription: "Extracts action items from calls", triggerEvent: "call.transcribed", expectedOutcome: "Action items extracted and categorized" },
    { id: "oai-classify", title: "Classify call intents", description: "Classify caller intent and call purpose using OpenAI models.", category: "AI & LLM", n8nTemplateName: "OpenAI Intent Classifier", n8nTemplateDescription: "Classifies call intents", triggerEvent: "call.transcribed", expectedOutcome: "Call intent classified" },
  ],
  anthropic: [
    { id: "anth-summarize", title: "Summarize conversations", description: "Use Anthropic Claude to create detailed conversation summaries.", category: "AI & LLM", n8nTemplateName: "Anthropic Summarizer", n8nTemplateDescription: "Summarizes conversations", triggerEvent: "call.transcribed", expectedOutcome: "Conversation summary generated" },
    { id: "anth-intent", title: "Analyze caller intent", description: "Analyze and categorize caller intent using Anthropic Claude.", category: "AI & LLM", n8nTemplateName: "Anthropic Intent Analyzer", n8nTemplateDescription: "Analyzes caller intent", triggerEvent: "call.transcribed", expectedOutcome: "Caller intent analyzed" },
    { id: "anth-emails", title: "Generate follow-up emails", description: "Generate personalized follow-up emails based on call content.", category: "AI & LLM", n8nTemplateName: "Anthropic Email Generator", n8nTemplateDescription: "Generates follow-up emails", triggerEvent: "call.completed", expectedOutcome: "Follow-up email draft generated" },
    { id: "anth-quality", title: "Quality scoring", description: "Score call quality and agent performance using Anthropic.", category: "AI & LLM", n8nTemplateName: "Anthropic Quality Scorer", n8nTemplateDescription: "Scores call quality", triggerEvent: "call.transcribed", expectedOutcome: "Quality score generated" },
  ],
  "google-gemini": [
    { id: "gemini-transcript", title: "Transcript analysis", description: "Analyze call transcripts using Google Gemini for insights.", category: "AI & LLM", n8nTemplateName: "Gemini Transcript Analyzer", n8nTemplateDescription: "Analyzes transcripts", triggerEvent: "call.transcribed", expectedOutcome: "Transcript analysis completed" },
    { id: "gemini-multilang", title: "Multi-language summarization", description: "Summarize calls in multiple languages using Gemini.", category: "AI & LLM", n8nTemplateName: "Gemini Multi-lang Summarizer", n8nTemplateDescription: "Multi-language summaries", triggerEvent: "call.transcribed", expectedOutcome: "Multi-language summary generated" },
    { id: "gemini-intent", title: "Intent extraction", description: "Extract caller intents from conversations using Gemini.", category: "AI & LLM", n8nTemplateName: "Gemini Intent Extractor", n8nTemplateDescription: "Extracts caller intents", triggerEvent: "call.transcribed", expectedOutcome: "Intents extracted from call" },
    { id: "gemini-knowledge", title: "Knowledge retrieval", description: "Retrieve relevant knowledge base articles using Gemini.", category: "AI & LLM", n8nTemplateName: "Gemini Knowledge Retriever", n8nTemplateDescription: "Retrieves knowledge articles", triggerEvent: "call.incoming", expectedOutcome: "Relevant knowledge retrieved" },
  ],
  mistral: [
    { id: "mistral-summarize", title: "Call summarization", description: "Generate concise call summaries using Mistral AI models.", category: "AI & LLM", n8nTemplateName: "Mistral Summarizer", n8nTemplateDescription: "Summarizes calls", triggerEvent: "call.transcribed", expectedOutcome: "Call summary generated" },
    { id: "mistral-topics", title: "Topic extraction", description: "Extract key topics and themes from conversations using Mistral.", category: "AI & LLM", n8nTemplateName: "Mistral Topic Extractor", n8nTemplateDescription: "Extracts conversation topics", triggerEvent: "call.transcribed", expectedOutcome: "Topics extracted from call" },
    { id: "mistral-sentiment", title: "Sentiment scoring", description: "Score call sentiment using Mistral AI analysis.", category: "AI & LLM", n8nTemplateName: "Mistral Sentiment Scorer", n8nTemplateDescription: "Scores sentiment", triggerEvent: "call.transcribed", expectedOutcome: "Sentiment score generated" },
    { id: "mistral-suggestions", title: "Response suggestions", description: "Generate real-time response suggestions using Mistral.", category: "AI & LLM", n8nTemplateName: "Mistral Response Suggester", n8nTemplateDescription: "Suggests responses", triggerEvent: "call.active", expectedOutcome: "Response suggestions generated" },
  ],
  groq: [
    { id: "groq-realtime", title: "Real-time transcript processing", description: "Process transcripts in real-time using Groq for ultra-fast inference.", category: "AI & LLM", n8nTemplateName: "Groq Real-time Processor", n8nTemplateDescription: "Real-time transcript processing", triggerEvent: "call.active", expectedOutcome: "Transcript processed in real-time" },
    { id: "groq-sentiment", title: "Fast sentiment analysis", description: "Perform instant sentiment analysis on calls using Groq.", category: "AI & LLM", n8nTemplateName: "Groq Sentiment Analyzer", n8nTemplateDescription: "Fast sentiment analysis", triggerEvent: "call.transcribed", expectedOutcome: "Sentiment analyzed instantly" },
    { id: "groq-classify", title: "Intent classification", description: "Classify call intents at high speed using Groq inference.", category: "AI & LLM", n8nTemplateName: "Groq Intent Classifier", n8nTemplateDescription: "Classifies intents quickly", triggerEvent: "call.transcribed", expectedOutcome: "Intent classified" },
    { id: "groq-summarize", title: "Quick summarization", description: "Generate rapid call summaries using Groq models.", category: "AI & LLM", n8nTemplateName: "Groq Quick Summarizer", n8nTemplateDescription: "Quick call summaries", triggerEvent: "call.transcribed", expectedOutcome: "Summary generated quickly" },
  ],
  cohere: [
    { id: "cohere-search", title: "Semantic search over transcripts", description: "Search across call transcripts using Cohere semantic search.", category: "AI & LLM", n8nTemplateName: "Cohere Transcript Search", n8nTemplateDescription: "Semantic transcript search", triggerEvent: "search.query", expectedOutcome: "Relevant transcripts found" },
    { id: "cohere-cluster", title: "Topic clustering", description: "Cluster calls by topic using Cohere embedding models.", category: "AI & LLM", n8nTemplateName: "Cohere Topic Clusterer", n8nTemplateDescription: "Clusters call topics", triggerEvent: "call.transcribed", expectedOutcome: "Calls clustered by topic" },
    { id: "cohere-summarize", title: "Summarization", description: "Summarize call transcripts using Cohere summarization models.", category: "AI & LLM", n8nTemplateName: "Cohere Summarizer", n8nTemplateDescription: "Summarizes transcripts", triggerEvent: "call.transcribed", expectedOutcome: "Transcript summarized" },
    { id: "cohere-classify", title: "Classification", description: "Classify calls using Cohere classification models.", category: "AI & LLM", n8nTemplateName: "Cohere Classifier", n8nTemplateDescription: "Classifies calls", triggerEvent: "call.transcribed", expectedOutcome: "Call classified" },
  ],
  perplexity: [
    { id: "pplx-research", title: "Research caller background", description: "Research caller and company background using Perplexity.", category: "AI & LLM", n8nTemplateName: "Perplexity Caller Research", n8nTemplateDescription: "Researches caller background", triggerEvent: "call.incoming", expectedOutcome: "Caller background research completed" },
    { id: "pplx-insights", title: "Industry insights", description: "Get real-time industry insights for conversations using Perplexity.", category: "AI & LLM", n8nTemplateName: "Perplexity Industry Insights", n8nTemplateDescription: "Provides industry insights", triggerEvent: "call.active", expectedOutcome: "Industry insights generated" },
    { id: "pplx-competitive", title: "Competitive analysis", description: "Perform competitive analysis during sales calls using Perplexity.", category: "AI & LLM", n8nTemplateName: "Perplexity Competitive Analysis", n8nTemplateDescription: "Analyzes competition", triggerEvent: "call.active", expectedOutcome: "Competitive analysis delivered" },
    { id: "pplx-factcheck", title: "Real-time fact checking", description: "Fact-check claims made during calls using Perplexity.", category: "AI & LLM", n8nTemplateName: "Perplexity Fact Checker", n8nTemplateDescription: "Fact-checks in real-time", triggerEvent: "call.active", expectedOutcome: "Facts verified in real-time" },
  ],
  elevenlabs: [
    { id: "el-clone-voice", title: "Clone brand voice", description: "Clone and use your brand voice for consistent AI agent responses.", category: "Voice & Speech", n8nTemplateName: "ElevenLabs Voice Cloner", n8nTemplateDescription: "Clones brand voice", triggerEvent: "voice.setup", expectedOutcome: "Brand voice cloned and ready" },
    { id: "el-multilang", title: "Multi-language TTS", description: "Generate speech in multiple languages using ElevenLabs.", category: "Voice & Speech", n8nTemplateName: "ElevenLabs Multi-lang TTS", n8nTemplateDescription: "Multi-language speech", triggerEvent: "call.tts_request", expectedOutcome: "Multi-language speech generated" },
    { id: "el-quality", title: "Voice quality optimization", description: "Optimize voice output quality settings for ElevenLabs.", category: "Voice & Speech", n8nTemplateName: "ElevenLabs Quality Optimizer", n8nTemplateDescription: "Optimizes voice quality", triggerEvent: "voice.optimize", expectedOutcome: "Voice quality optimized" },
    { id: "el-pronunciations", title: "Custom pronunciations", description: "Configure custom pronunciations for names and terms.", category: "Voice & Speech", n8nTemplateName: "ElevenLabs Pronunciation Config", n8nTemplateDescription: "Configures pronunciations", triggerEvent: "voice.setup", expectedOutcome: "Custom pronunciations configured" },
  ],
  deepgram: [
    { id: "dg-realtime", title: "Real-time transcription", description: "Transcribe calls in real-time using Deepgram speech-to-text.", category: "Voice & Speech", n8nTemplateName: "Deepgram Real-time STT", n8nTemplateDescription: "Real-time transcription", triggerEvent: "call.active", expectedOutcome: "Real-time transcript generated" },
    { id: "dg-diarization", title: "Speaker diarization", description: "Identify and separate speakers in call recordings using Deepgram.", category: "Voice & Speech", n8nTemplateName: "Deepgram Speaker Diarizer", n8nTemplateDescription: "Identifies speakers", triggerEvent: "call.completed", expectedOutcome: "Speakers identified and separated" },
    { id: "dg-keywords", title: "Keyword detection", description: "Detect specific keywords and phrases in real-time.", category: "Voice & Speech", n8nTemplateName: "Deepgram Keyword Detector", n8nTemplateDescription: "Detects keywords", triggerEvent: "call.active", expectedOutcome: "Keywords detected in conversation" },
    { id: "dg-sentiment", title: "Sentiment from voice", description: "Analyze sentiment from voice tone using Deepgram.", category: "Voice & Speech", n8nTemplateName: "Deepgram Voice Sentiment", n8nTemplateDescription: "Analyzes voice sentiment", triggerEvent: "call.completed", expectedOutcome: "Voice sentiment analyzed" },
  ],
  "google-cloud-tts": [
    { id: "gctts-multilang", title: "Multi-language synthesis", description: "Synthesize speech in multiple languages using Google Cloud TTS.", category: "Voice & Speech", n8nTemplateName: "Google TTS Multi-lang", n8nTemplateDescription: "Multi-language synthesis", triggerEvent: "call.tts_request", expectedOutcome: "Multi-language speech synthesized" },
    { id: "gctts-profiles", title: "Custom voice profiles", description: "Create custom voice profiles for different use cases.", category: "Voice & Speech", n8nTemplateName: "Google TTS Voice Profiles", n8nTemplateDescription: "Creates voice profiles", triggerEvent: "voice.setup", expectedOutcome: "Voice profile created" },
    { id: "gctts-ssml", title: "SSML formatting", description: "Use SSML formatting for advanced speech control.", category: "Voice & Speech", n8nTemplateName: "Google TTS SSML Formatter", n8nTemplateDescription: "SSML speech control", triggerEvent: "call.tts_request", expectedOutcome: "SSML-formatted speech generated" },
    { id: "gctts-adapt", title: "Voice adaptation", description: "Adapt voice output to different contexts and scenarios.", category: "Voice & Speech", n8nTemplateName: "Google TTS Voice Adapter", n8nTemplateDescription: "Adapts voice output", triggerEvent: "voice.optimize", expectedOutcome: "Voice adapted to context" },
  ],
  "amazon-polly": [
    { id: "polly-prompts", title: "Generate voice prompts", description: "Generate voice prompts and IVR messages using Amazon Polly.", category: "Voice & Speech", n8nTemplateName: "Amazon Polly Prompt Generator", n8nTemplateDescription: "Generates voice prompts", triggerEvent: "call.tts_request", expectedOutcome: "Voice prompts generated" },
    { id: "polly-multilang", title: "Multi-language support", description: "Support multiple languages for voice synthesis.", category: "Voice & Speech", n8nTemplateName: "Amazon Polly Multi-lang", n8nTemplateDescription: "Multi-language TTS", triggerEvent: "call.tts_request", expectedOutcome: "Multi-language audio generated" },
    { id: "polly-neural", title: "Neural voice synthesis", description: "Use neural voice models for natural-sounding speech.", category: "Voice & Speech", n8nTemplateName: "Amazon Polly Neural Voice", n8nTemplateDescription: "Neural voice synthesis", triggerEvent: "call.tts_request", expectedOutcome: "Neural voice audio generated" },
    { id: "polly-lexicons", title: "Custom lexicons", description: "Configure custom lexicons for pronunciation rules.", category: "Voice & Speech", n8nTemplateName: "Amazon Polly Lexicon Config", n8nTemplateDescription: "Configures lexicons", triggerEvent: "voice.setup", expectedOutcome: "Custom lexicon configured" },
  ],
  "azure-speech": [
    { id: "azure-neural", title: "Custom neural voices", description: "Create and use custom neural voice models via Azure.", category: "Voice & Speech", n8nTemplateName: "Azure Custom Neural Voice", n8nTemplateDescription: "Custom neural voices", triggerEvent: "voice.setup", expectedOutcome: "Custom neural voice created" },
    { id: "azure-translate", title: "Real-time translation", description: "Translate speech in real-time during calls.", category: "Voice & Speech", n8nTemplateName: "Azure Real-time Translator", n8nTemplateDescription: "Real-time translation", triggerEvent: "call.active", expectedOutcome: "Real-time translation active" },
    { id: "azure-pronunciation", title: "Pronunciation tuning", description: "Fine-tune pronunciation for specific terms and names.", category: "Voice & Speech", n8nTemplateName: "Azure Pronunciation Tuner", n8nTemplateDescription: "Tunes pronunciation", triggerEvent: "voice.setup", expectedOutcome: "Pronunciation tuning applied" },
    { id: "azure-profiles", title: "Voice profiles", description: "Create and manage voice profiles for different scenarios.", category: "Voice & Speech", n8nTemplateName: "Azure Voice Profiles", n8nTemplateDescription: "Manages voice profiles", triggerEvent: "voice.setup", expectedOutcome: "Voice profile configured" },
  ],
  playht: [
    { id: "playht-realistic", title: "Ultra-realistic voices", description: "Generate ultra-realistic voice output using PlayHT.", category: "Voice & Speech", n8nTemplateName: "PlayHT Realistic Voice", n8nTemplateDescription: "Ultra-realistic TTS", triggerEvent: "call.tts_request", expectedOutcome: "Realistic voice audio generated" },
    { id: "playht-clone", title: "Voice cloning", description: "Clone voices for personalized AI agent responses.", category: "Voice & Speech", n8nTemplateName: "PlayHT Voice Cloner", n8nTemplateDescription: "Clones voices", triggerEvent: "voice.setup", expectedOutcome: "Voice cloned successfully" },
    { id: "playht-emotion", title: "Emotion control", description: "Control emotional tone in voice synthesis.", category: "Voice & Speech", n8nTemplateName: "PlayHT Emotion Controller", n8nTemplateDescription: "Controls voice emotion", triggerEvent: "call.tts_request", expectedOutcome: "Emotional tone applied to voice" },
    { id: "playht-accents", title: "Multi-accent support", description: "Support multiple accents and speaking styles.", category: "Voice & Speech", n8nTemplateName: "PlayHT Accent Selector", n8nTemplateDescription: "Multi-accent support", triggerEvent: "voice.setup", expectedOutcome: "Accent configured for voice" },
  ],
  murf: [
    { id: "murf-voiceovers", title: "Studio-quality voiceovers", description: "Generate studio-quality voiceovers using Murf AI.", category: "Voice & Speech", n8nTemplateName: "Murf Studio Voiceover", n8nTemplateDescription: "Studio-quality voiceovers", triggerEvent: "call.tts_request", expectedOutcome: "Studio-quality voiceover generated" },
    { id: "murf-brand", title: "Brand voice creation", description: "Create consistent brand voices using Murf.", category: "Voice & Speech", n8nTemplateName: "Murf Brand Voice Creator", n8nTemplateDescription: "Creates brand voice", triggerEvent: "voice.setup", expectedOutcome: "Brand voice created" },
    { id: "murf-script", title: "Script to speech", description: "Convert scripts to natural-sounding speech.", category: "Voice & Speech", n8nTemplateName: "Murf Script to Speech", n8nTemplateDescription: "Converts scripts to speech", triggerEvent: "call.tts_request", expectedOutcome: "Script converted to speech" },
    { id: "murf-pronunciation", title: "Pronunciation editor", description: "Edit and customize pronunciation for specific terms.", category: "Voice & Speech", n8nTemplateName: "Murf Pronunciation Editor", n8nTemplateDescription: "Edits pronunciation", triggerEvent: "voice.setup", expectedOutcome: "Pronunciation customized" },
  ],
  slack: [
    { id: "slack-summaries", title: "Post call summaries to channels", description: "Automatically post AI-generated call summaries to designated Slack channels.", category: "Communication", n8nTemplateName: "Slack Call Summary Poster", n8nTemplateDescription: "Posts call summaries to Slack", triggerEvent: "call.summarized", expectedOutcome: "Call summary posted to Slack channel" },
    { id: "slack-alerts", title: "Alert on high-priority calls", description: "Send instant Slack alerts for high-priority or escalated calls.", category: "Communication", n8nTemplateName: "Slack Priority Alert", n8nTemplateDescription: "Alerts on priority calls", triggerEvent: "call.escalation", expectedOutcome: "Priority alert sent to Slack" },
    { id: "slack-reports", title: "Daily campaign reports", description: "Send daily campaign performance reports to Slack channels.", category: "Communication", n8nTemplateName: "Slack Daily Report", n8nTemplateDescription: "Daily campaign reports", triggerEvent: "report.daily", expectedOutcome: "Daily report posted to Slack" },
    { id: "slack-realtime", title: "Real-time call notifications", description: "Send real-time notifications to Slack for call events.", category: "Communication", n8nTemplateName: "Slack Real-time Notifier", n8nTemplateDescription: "Real-time call notifications", triggerEvent: "call.started", expectedOutcome: "Real-time notification sent" },
  ],
  "microsoft-teams": [
    { id: "teams-outcomes", title: "Share call outcomes", description: "Share call outcomes and summaries in Microsoft Teams channels.", category: "Communication", n8nTemplateName: "Teams Outcome Sharer", n8nTemplateDescription: "Shares call outcomes", triggerEvent: "call.completed", expectedOutcome: "Call outcome shared in Teams" },
    { id: "teams-alerts", title: "Campaign alerts", description: "Send campaign performance alerts to Teams channels.", category: "Communication", n8nTemplateName: "Teams Campaign Alert", n8nTemplateDescription: "Campaign performance alerts", triggerEvent: "campaign.alert", expectedOutcome: "Campaign alert sent to Teams" },
    { id: "teams-notifications", title: "Team notifications", description: "Send team-wide notifications for important call events.", category: "Communication", n8nTemplateName: "Teams Notifier", n8nTemplateDescription: "Team notifications", triggerEvent: "call.important", expectedOutcome: "Team notification sent" },
    { id: "teams-followups", title: "Meeting follow-ups", description: "Send meeting follow-up messages after calls.", category: "Communication", n8nTemplateName: "Teams Meeting Follow-up", n8nTemplateDescription: "Meeting follow-ups", triggerEvent: "call.completed", expectedOutcome: "Follow-up message sent in Teams" },
  ],
  telegram: [
    { id: "tg-alerts", title: "Send call alerts", description: "Send instant call alerts to Telegram groups or channels.", category: "Communication", n8nTemplateName: "Telegram Call Alert", n8nTemplateDescription: "Sends call alerts", triggerEvent: "call.started", expectedOutcome: "Call alert sent to Telegram" },
    { id: "tg-status", title: "Campaign status updates", description: "Send campaign status updates to Telegram.", category: "Communication", n8nTemplateName: "Telegram Status Updater", n8nTemplateDescription: "Campaign status updates", triggerEvent: "campaign.update", expectedOutcome: "Status update sent to Telegram" },
    { id: "tg-leads", title: "Lead notifications", description: "Notify team about new leads via Telegram.", category: "Communication", n8nTemplateName: "Telegram Lead Notifier", n8nTemplateDescription: "Lead notifications", triggerEvent: "lead.created", expectedOutcome: "Lead notification sent to Telegram" },
    { id: "tg-reports", title: "Daily reports", description: "Send daily performance reports to Telegram.", category: "Communication", n8nTemplateName: "Telegram Daily Report", n8nTemplateDescription: "Daily reports", triggerEvent: "report.daily", expectedOutcome: "Daily report sent to Telegram" },
  ],
  whatsapp: [
    { id: "wa-followup", title: "Send follow-up messages", description: "Send personalized follow-up messages via WhatsApp after calls.", category: "Communication", n8nTemplateName: "WhatsApp Follow-up", n8nTemplateDescription: "Sends follow-up messages", triggerEvent: "call.completed", expectedOutcome: "Follow-up message sent via WhatsApp" },
    { id: "wa-recordings", title: "Share call recordings", description: "Share call recording summaries via WhatsApp.", category: "Communication", n8nTemplateName: "WhatsApp Recording Sharer", n8nTemplateDescription: "Shares call recordings", triggerEvent: "call.recorded", expectedOutcome: "Recording summary shared via WhatsApp" },
    { id: "wa-appointments", title: "Appointment confirmations", description: "Send appointment confirmation messages via WhatsApp.", category: "Communication", n8nTemplateName: "WhatsApp Appointment Confirmer", n8nTemplateDescription: "Confirms appointments", triggerEvent: "appointment.booked", expectedOutcome: "Appointment confirmation sent via WhatsApp" },
    { id: "wa-nurture", title: "Lead nurture messages", description: "Send lead nurture messages via WhatsApp.", category: "Communication", n8nTemplateName: "WhatsApp Lead Nurturer", n8nTemplateDescription: "Nurtures leads", triggerEvent: "lead.nurture", expectedOutcome: "Nurture message sent via WhatsApp" },
  ],
  discord: [
    { id: "discord-updates", title: "Post call updates", description: "Post call updates and summaries to Discord channels.", category: "Communication", n8nTemplateName: "Discord Call Updater", n8nTemplateDescription: "Posts call updates", triggerEvent: "call.completed", expectedOutcome: "Call update posted to Discord" },
    { id: "discord-campaign", title: "Campaign alerts", description: "Send campaign performance alerts to Discord.", category: "Communication", n8nTemplateName: "Discord Campaign Alert", n8nTemplateDescription: "Campaign alerts", triggerEvent: "campaign.alert", expectedOutcome: "Campaign alert posted to Discord" },
    { id: "discord-team", title: "Team notifications", description: "Send team notifications for important events to Discord.", category: "Communication", n8nTemplateName: "Discord Team Notifier", n8nTemplateDescription: "Team notifications", triggerEvent: "call.important", expectedOutcome: "Team notification sent to Discord" },
    { id: "discord-leads", title: "Lead alerts", description: "Alert team about new leads in Discord channels.", category: "Communication", n8nTemplateName: "Discord Lead Alert", n8nTemplateDescription: "Lead alerts", triggerEvent: "lead.created", expectedOutcome: "Lead alert posted to Discord" },
  ],
  zendesk: [
    { id: "zd-create-tickets", title: "Create tickets from calls", description: "Automatically create Zendesk support tickets from customer calls.", category: "Customer Support", n8nTemplateName: "Zendesk Ticket Creator", n8nTemplateDescription: "Creates tickets from calls", triggerEvent: "call.support_request", expectedOutcome: "Support ticket created in Zendesk" },
    { id: "zd-update-status", title: "Update ticket status", description: "Update Zendesk ticket status based on call resolution.", category: "Customer Support", n8nTemplateName: "Zendesk Status Updater", n8nTemplateDescription: "Updates ticket status", triggerEvent: "call.resolved", expectedOutcome: "Ticket status updated in Zendesk" },
    { id: "zd-escalate", title: "Escalate issues", description: "Escalate high-priority issues to Zendesk support teams.", category: "Customer Support", n8nTemplateName: "Zendesk Issue Escalator", n8nTemplateDescription: "Escalates issues", triggerEvent: "call.escalation", expectedOutcome: "Issue escalated in Zendesk" },
    { id: "zd-transcripts", title: "Log call transcripts", description: "Attach call transcripts to Zendesk tickets.", category: "Customer Support", n8nTemplateName: "Zendesk Transcript Logger", n8nTemplateDescription: "Logs transcripts to tickets", triggerEvent: "call.transcribed", expectedOutcome: "Transcript attached to Zendesk ticket" },
  ],
  freshdesk: [
    { id: "fd-create-tickets", title: "Auto-create tickets", description: "Automatically create Freshdesk tickets from support calls.", category: "Customer Support", n8nTemplateName: "Freshdesk Ticket Creator", n8nTemplateDescription: "Creates tickets automatically", triggerEvent: "call.support_request", expectedOutcome: "Ticket created in Freshdesk" },
    { id: "fd-update-status", title: "Update support status", description: "Update Freshdesk ticket status after call resolution.", category: "Customer Support", n8nTemplateName: "Freshdesk Status Updater", n8nTemplateDescription: "Updates support status", triggerEvent: "call.resolved", expectedOutcome: "Support status updated" },
    { id: "fd-assign", title: "Assign agents", description: "Assign agents to Freshdesk tickets based on call routing.", category: "Customer Support", n8nTemplateName: "Freshdesk Agent Assigner", n8nTemplateDescription: "Assigns agents", triggerEvent: "call.routed", expectedOutcome: "Agent assigned to ticket" },
    { id: "fd-log", title: "Log interactions", description: "Log call interactions in Freshdesk conversation history.", category: "Customer Support", n8nTemplateName: "Freshdesk Interaction Logger", n8nTemplateDescription: "Logs interactions", triggerEvent: "call.completed", expectedOutcome: "Interaction logged in Freshdesk" },
  ],
  intercom: [
    { id: "ic-create-convs", title: "Create conversations", description: "Create Intercom conversations from inbound calls.", category: "Customer Support", n8nTemplateName: "Intercom Conversation Creator", n8nTemplateDescription: "Creates conversations", triggerEvent: "call.completed", expectedOutcome: "Conversation created in Intercom" },
    { id: "ic-update-contacts", title: "Update contact data", description: "Update Intercom contact data with call insights.", category: "Customer Support", n8nTemplateName: "Intercom Contact Updater", n8nTemplateDescription: "Updates contact data", triggerEvent: "call.analyzed", expectedOutcome: "Contact data updated in Intercom" },
    { id: "ic-trigger", title: "Trigger workflows", description: "Trigger Intercom workflows based on call outcomes.", category: "Customer Support", n8nTemplateName: "Intercom Workflow Trigger", n8nTemplateDescription: "Triggers workflows", triggerEvent: "call.outcome_determined", expectedOutcome: "Workflow triggered in Intercom" },
    { id: "ic-notes", title: "Log call notes", description: "Add call notes to Intercom conversation records.", category: "Customer Support", n8nTemplateName: "Intercom Note Logger", n8nTemplateDescription: "Logs call notes", triggerEvent: "call.completed", expectedOutcome: "Notes logged in Intercom" },
  ],
  helpscout: [
    { id: "hs-create-convs", title: "Create conversations", description: "Create Help Scout conversations from support calls.", category: "Customer Support", n8nTemplateName: "Help Scout Conversation Creator", n8nTemplateDescription: "Creates conversations", triggerEvent: "call.support_request", expectedOutcome: "Conversation created in Help Scout" },
    { id: "hs-add-notes", title: "Add call notes", description: "Add call notes and transcripts to Help Scout conversations.", category: "Customer Support", n8nTemplateName: "Help Scout Note Adder", n8nTemplateDescription: "Adds call notes", triggerEvent: "call.completed", expectedOutcome: "Notes added to Help Scout" },
    { id: "hs-update-mailbox", title: "Update mailbox", description: "Update Help Scout mailbox with call-related information.", category: "Customer Support", n8nTemplateName: "Help Scout Mailbox Updater", n8nTemplateDescription: "Updates mailbox", triggerEvent: "call.completed", expectedOutcome: "Mailbox updated in Help Scout" },
    { id: "hs-followup", title: "Customer follow-up", description: "Send customer follow-up messages through Help Scout.", category: "Customer Support", n8nTemplateName: "Help Scout Follow-up", n8nTemplateDescription: "Customer follow-up", triggerEvent: "call.followup_needed", expectedOutcome: "Follow-up sent via Help Scout" },
  ],
  front: [
    { id: "front-create-convs", title: "Create conversations", description: "Create Front conversations from call interactions.", category: "Customer Support", n8nTemplateName: "Front Conversation Creator", n8nTemplateDescription: "Creates conversations", triggerEvent: "call.completed", expectedOutcome: "Conversation created in Front" },
    { id: "front-route", title: "Route messages", description: "Route call-related messages to appropriate Front inboxes.", category: "Customer Support", n8nTemplateName: "Front Message Router", n8nTemplateDescription: "Routes messages", triggerEvent: "call.routed", expectedOutcome: "Message routed in Front" },
    { id: "front-context", title: "Add call context", description: "Add call context and notes to Front conversations.", category: "Customer Support", n8nTemplateName: "Front Context Adder", n8nTemplateDescription: "Adds call context", triggerEvent: "call.completed", expectedOutcome: "Call context added to Front" },
    { id: "front-assign", title: "Team assignments", description: "Assign Front conversations to team members based on call routing.", category: "Customer Support", n8nTemplateName: "Front Team Assigner", n8nTemplateDescription: "Assigns to teams", triggerEvent: "call.routed", expectedOutcome: "Conversation assigned in Front" },
  ],
  "google-calendar": [
    { id: "gcal-book", title: "Book appointments during calls", description: "Book appointments on Google Calendar during live calls.", category: "Scheduling", n8nTemplateName: "Google Calendar Booker", n8nTemplateDescription: "Books appointments", triggerEvent: "appointment.request", expectedOutcome: "Appointment booked on Google Calendar" },
    { id: "gcal-availability", title: "Check availability", description: "Check Google Calendar availability during scheduling calls.", category: "Scheduling", n8nTemplateName: "Google Calendar Availability Checker", n8nTemplateDescription: "Checks availability", triggerEvent: "appointment.check", expectedOutcome: "Availability checked on Google Calendar" },
    { id: "gcal-reminders", title: "Send reminders", description: "Send appointment reminders via Google Calendar.", category: "Scheduling", n8nTemplateName: "Google Calendar Reminder", n8nTemplateDescription: "Sends reminders", triggerEvent: "appointment.reminder", expectedOutcome: "Reminder sent via Google Calendar" },
    { id: "gcal-block", title: "Block time slots", description: "Block time slots on Google Calendar after booking.", category: "Scheduling", n8nTemplateName: "Google Calendar Blocker", n8nTemplateDescription: "Blocks time slots", triggerEvent: "appointment.booked", expectedOutcome: "Time slot blocked on Google Calendar" },
  ],
  calendly: [
    { id: "calendly-links", title: "Generate scheduling links", description: "Generate Calendly scheduling links during calls.", category: "Scheduling", n8nTemplateName: "Calendly Link Generator", n8nTemplateDescription: "Generates scheduling links", triggerEvent: "appointment.request", expectedOutcome: "Scheduling link generated" },
    { id: "calendly-availability", title: "Check availability", description: "Check Calendly availability for scheduling.", category: "Scheduling", n8nTemplateName: "Calendly Availability Checker", n8nTemplateDescription: "Checks availability", triggerEvent: "appointment.check", expectedOutcome: "Availability checked on Calendly" },
    { id: "calendly-confirm", title: "Confirm bookings", description: "Confirm Calendly bookings after call scheduling.", category: "Scheduling", n8nTemplateName: "Calendly Booking Confirmer", n8nTemplateDescription: "Confirms bookings", triggerEvent: "appointment.booked", expectedOutcome: "Booking confirmed on Calendly" },
    { id: "calendly-reminders", title: "Send reminders", description: "Send appointment reminders through Calendly.", category: "Scheduling", n8nTemplateName: "Calendly Reminder", n8nTemplateDescription: "Sends reminders", triggerEvent: "appointment.reminder", expectedOutcome: "Reminder sent via Calendly" },
  ],
  "cal-com": [
    { id: "calcom-book", title: "Create bookings", description: "Create Cal.com bookings from call conversations.", category: "Scheduling", n8nTemplateName: "Cal.com Booking Creator", n8nTemplateDescription: "Creates bookings", triggerEvent: "appointment.request", expectedOutcome: "Booking created on Cal.com" },
    { id: "calcom-slots", title: "Check slots", description: "Check available time slots on Cal.com.", category: "Scheduling", n8nTemplateName: "Cal.com Slot Checker", n8nTemplateDescription: "Checks time slots", triggerEvent: "appointment.check", expectedOutcome: "Available slots checked on Cal.com" },
    { id: "calcom-confirm", title: "Send confirmations", description: "Send booking confirmations through Cal.com.", category: "Scheduling", n8nTemplateName: "Cal.com Confirmation Sender", n8nTemplateDescription: "Sends confirmations", triggerEvent: "appointment.booked", expectedOutcome: "Confirmation sent via Cal.com" },
    { id: "calcom-sync", title: "Sync calendars", description: "Sync Cal.com bookings with external calendars.", category: "Scheduling", n8nTemplateName: "Cal.com Calendar Sync", n8nTemplateDescription: "Syncs calendars", triggerEvent: "appointment.booked", expectedOutcome: "Calendars synced with Cal.com" },
  ],
  "microsoft-outlook": [
    { id: "outlook-schedule", title: "Schedule meetings", description: "Schedule meetings in Microsoft Outlook during calls.", category: "Scheduling", n8nTemplateName: "Outlook Meeting Scheduler", n8nTemplateDescription: "Schedules meetings", triggerEvent: "appointment.request", expectedOutcome: "Meeting scheduled in Outlook" },
    { id: "outlook-availability", title: "Check availability", description: "Check Outlook calendar availability.", category: "Scheduling", n8nTemplateName: "Outlook Availability Checker", n8nTemplateDescription: "Checks availability", triggerEvent: "appointment.check", expectedOutcome: "Availability checked in Outlook" },
    { id: "outlook-invites", title: "Send invites", description: "Send meeting invitations via Outlook.", category: "Scheduling", n8nTemplateName: "Outlook Invite Sender", n8nTemplateDescription: "Sends meeting invites", triggerEvent: "appointment.booked", expectedOutcome: "Meeting invite sent via Outlook" },
    { id: "outlook-sync", title: "Calendar sync", description: "Sync calendar events with Microsoft Outlook.", category: "Scheduling", n8nTemplateName: "Outlook Calendar Sync", n8nTemplateDescription: "Syncs calendar events", triggerEvent: "appointment.booked", expectedOutcome: "Calendar synced with Outlook" },
  ],
  "acuity-scheduling": [
    { id: "acuity-book", title: "Book appointments", description: "Book appointments through Acuity Scheduling during calls.", category: "Scheduling", n8nTemplateName: "Acuity Appointment Booker", n8nTemplateDescription: "Books appointments", triggerEvent: "appointment.request", expectedOutcome: "Appointment booked on Acuity" },
    { id: "acuity-openings", title: "Check openings", description: "Check available openings on Acuity Scheduling.", category: "Scheduling", n8nTemplateName: "Acuity Opening Checker", n8nTemplateDescription: "Checks openings", triggerEvent: "appointment.check", expectedOutcome: "Openings checked on Acuity" },
    { id: "acuity-confirm", title: "Send confirmations", description: "Send booking confirmations through Acuity.", category: "Scheduling", n8nTemplateName: "Acuity Confirmation Sender", n8nTemplateDescription: "Sends confirmations", triggerEvent: "appointment.booked", expectedOutcome: "Confirmation sent via Acuity" },
    { id: "acuity-reschedule", title: "Manage reschedules", description: "Handle appointment reschedules through Acuity.", category: "Scheduling", n8nTemplateName: "Acuity Reschedule Manager", n8nTemplateDescription: "Manages reschedules", triggerEvent: "appointment.reschedule", expectedOutcome: "Reschedule managed on Acuity" },
  ],
  stripe: [
    { id: "stripe-payments", title: "Process payments", description: "Process payments during calls using Stripe.", category: "E-Commerce & Payments", n8nTemplateName: "Stripe Payment Processor", n8nTemplateDescription: "Processes payments", triggerEvent: "payment.request", expectedOutcome: "Payment processed via Stripe" },
    { id: "stripe-invoices", title: "Create invoices", description: "Create and send invoices through Stripe after calls.", category: "E-Commerce & Payments", n8nTemplateName: "Stripe Invoice Creator", n8nTemplateDescription: "Creates invoices", triggerEvent: "call.completed", expectedOutcome: "Invoice created in Stripe" },
    { id: "stripe-subscriptions", title: "Look up subscriptions", description: "Look up customer subscription details during calls.", category: "E-Commerce & Payments", n8nTemplateName: "Stripe Subscription Lookup", n8nTemplateDescription: "Looks up subscriptions", triggerEvent: "customer.lookup", expectedOutcome: "Subscription details retrieved" },
    { id: "stripe-refunds", title: "Handle refunds", description: "Process refund requests during support calls.", category: "E-Commerce & Payments", n8nTemplateName: "Stripe Refund Handler", n8nTemplateDescription: "Handles refunds", triggerEvent: "refund.request", expectedOutcome: "Refund processed via Stripe" },
  ],
  shopify: [
    { id: "shopify-orders", title: "Look up orders", description: "Look up customer orders in Shopify during calls.", category: "E-Commerce & Payments", n8nTemplateName: "Shopify Order Lookup", n8nTemplateDescription: "Looks up orders", triggerEvent: "customer.lookup", expectedOutcome: "Order details retrieved from Shopify" },
    { id: "shopify-inventory", title: "Check inventory", description: "Check product inventory levels in Shopify.", category: "E-Commerce & Payments", n8nTemplateName: "Shopify Inventory Checker", n8nTemplateDescription: "Checks inventory", triggerEvent: "product.check", expectedOutcome: "Inventory checked in Shopify" },
    { id: "shopify-returns", title: "Process returns", description: "Process return requests through Shopify.", category: "E-Commerce & Payments", n8nTemplateName: "Shopify Return Processor", n8nTemplateDescription: "Processes returns", triggerEvent: "return.request", expectedOutcome: "Return processed in Shopify" },
    { id: "shopify-customers", title: "Customer account lookup", description: "Look up customer account details in Shopify.", category: "E-Commerce & Payments", n8nTemplateName: "Shopify Customer Lookup", n8nTemplateDescription: "Looks up customers", triggerEvent: "customer.lookup", expectedOutcome: "Customer details retrieved from Shopify" },
  ],
  woocommerce: [
    { id: "woo-orders", title: "Order tracking", description: "Track and look up orders in WooCommerce during calls.", category: "E-Commerce & Payments", n8nTemplateName: "WooCommerce Order Tracker", n8nTemplateDescription: "Tracks orders", triggerEvent: "customer.lookup", expectedOutcome: "Order tracked in WooCommerce" },
    { id: "woo-products", title: "Product availability", description: "Check product availability in WooCommerce.", category: "E-Commerce & Payments", n8nTemplateName: "WooCommerce Product Checker", n8nTemplateDescription: "Checks products", triggerEvent: "product.check", expectedOutcome: "Product availability checked" },
    { id: "woo-process", title: "Process orders", description: "Process new orders through WooCommerce.", category: "E-Commerce & Payments", n8nTemplateName: "WooCommerce Order Processor", n8nTemplateDescription: "Processes orders", triggerEvent: "order.create", expectedOutcome: "Order processed in WooCommerce" },
    { id: "woo-customers", title: "Customer lookup", description: "Look up customer information in WooCommerce.", category: "E-Commerce & Payments", n8nTemplateName: "WooCommerce Customer Lookup", n8nTemplateDescription: "Looks up customers", triggerEvent: "customer.lookup", expectedOutcome: "Customer info retrieved" },
  ],
  mailchimp: [
    { id: "mc-add-contacts", title: "Add contacts to lists", description: "Add caller contacts to Mailchimp audience lists.", category: "Marketing", n8nTemplateName: "Mailchimp Contact Adder", n8nTemplateDescription: "Adds contacts to lists", triggerEvent: "contact.created", expectedOutcome: "Contact added to Mailchimp list" },
    { id: "mc-tag", title: "Tag based on call outcome", description: "Tag Mailchimp contacts based on call outcomes.", category: "Marketing", n8nTemplateName: "Mailchimp Outcome Tagger", n8nTemplateDescription: "Tags contacts by outcome", triggerEvent: "call.outcome_determined", expectedOutcome: "Contact tagged in Mailchimp" },
    { id: "mc-sequences", title: "Trigger email sequences", description: "Trigger Mailchimp email automation sequences from calls.", category: "Marketing", n8nTemplateName: "Mailchimp Sequence Trigger", n8nTemplateDescription: "Triggers email sequences", triggerEvent: "call.completed", expectedOutcome: "Email sequence triggered in Mailchimp" },
    { id: "mc-sync", title: "Sync subscriber data", description: "Sync subscriber data between platforms and Mailchimp.", category: "Marketing", n8nTemplateName: "Mailchimp Subscriber Sync", n8nTemplateDescription: "Syncs subscriber data", triggerEvent: "contact.updated", expectedOutcome: "Subscriber data synced in Mailchimp" },
  ],
  activecampaign: [
    { id: "ac-add-contacts", title: "Add contacts", description: "Add new contacts to ActiveCampaign from calls.", category: "Marketing", n8nTemplateName: "ActiveCampaign Contact Adder", n8nTemplateDescription: "Adds contacts", triggerEvent: "contact.created", expectedOutcome: "Contact added to ActiveCampaign" },
    { id: "ac-tags", title: "Apply tags", description: "Apply tags to ActiveCampaign contacts based on call data.", category: "Marketing", n8nTemplateName: "ActiveCampaign Tag Applier", n8nTemplateDescription: "Applies tags", triggerEvent: "call.outcome_determined", expectedOutcome: "Tags applied in ActiveCampaign" },
    { id: "ac-automations", title: "Trigger automations", description: "Trigger ActiveCampaign automations from call events.", category: "Marketing", n8nTemplateName: "ActiveCampaign Automation Trigger", n8nTemplateDescription: "Triggers automations", triggerEvent: "call.completed", expectedOutcome: "Automation triggered in ActiveCampaign" },
    { id: "ac-deals", title: "Update deal stages", description: "Update deal stages in ActiveCampaign based on call outcomes.", category: "Marketing", n8nTemplateName: "ActiveCampaign Deal Updater", n8nTemplateDescription: "Updates deal stages", triggerEvent: "call.outcome_determined", expectedOutcome: "Deal stage updated in ActiveCampaign" },
  ],
  sendgrid: [
    { id: "sg-transactional", title: "Send transactional emails", description: "Send transactional emails via SendGrid after calls.", category: "Marketing", n8nTemplateName: "SendGrid Transactional Email", n8nTemplateDescription: "Sends transactional emails", triggerEvent: "call.completed", expectedOutcome: "Transactional email sent via SendGrid" },
    { id: "sg-followup", title: "Follow-up sequences", description: "Trigger follow-up email sequences through SendGrid.", category: "Marketing", n8nTemplateName: "SendGrid Follow-up Sequence", n8nTemplateDescription: "Follow-up sequences", triggerEvent: "call.followup_needed", expectedOutcome: "Follow-up sequence started" },
    { id: "sg-notifications", title: "Email notifications", description: "Send email notifications for call events via SendGrid.", category: "Marketing", n8nTemplateName: "SendGrid Email Notifier", n8nTemplateDescription: "Email notifications", triggerEvent: "call.important", expectedOutcome: "Email notification sent" },
    { id: "sg-templates", title: "Template management", description: "Manage and use SendGrid email templates for communications.", category: "Marketing", n8nTemplateName: "SendGrid Template Manager", n8nTemplateDescription: "Manages templates", triggerEvent: "template.update", expectedOutcome: "Template configured in SendGrid" },
  ],
  brevo: [
    { id: "brevo-contacts", title: "Add contacts", description: "Add contacts to Brevo from call interactions.", category: "Marketing", n8nTemplateName: "Brevo Contact Adder", n8nTemplateDescription: "Adds contacts", triggerEvent: "contact.created", expectedOutcome: "Contact added to Brevo" },
    { id: "brevo-emails", title: "Send emails", description: "Send emails through Brevo after calls.", category: "Marketing", n8nTemplateName: "Brevo Email Sender", n8nTemplateDescription: "Sends emails", triggerEvent: "call.completed", expectedOutcome: "Email sent via Brevo" },
    { id: "brevo-workflows", title: "Trigger workflows", description: "Trigger Brevo automation workflows from call events.", category: "Marketing", n8nTemplateName: "Brevo Workflow Trigger", n8nTemplateDescription: "Triggers workflows", triggerEvent: "call.completed", expectedOutcome: "Workflow triggered in Brevo" },
    { id: "brevo-segments", title: "Segment contacts", description: "Segment contacts in Brevo based on call outcomes.", category: "Marketing", n8nTemplateName: "Brevo Contact Segmenter", n8nTemplateDescription: "Segments contacts", triggerEvent: "call.outcome_determined", expectedOutcome: "Contact segmented in Brevo" },
  ],
  convertkit: [
    { id: "ck-subscribers", title: "Add subscribers", description: "Add new subscribers to ConvertKit from calls.", category: "Marketing", n8nTemplateName: "ConvertKit Subscriber Adder", n8nTemplateDescription: "Adds subscribers", triggerEvent: "contact.created", expectedOutcome: "Subscriber added to ConvertKit" },
    { id: "ck-tags", title: "Apply tags", description: "Apply tags to ConvertKit subscribers based on call data.", category: "Marketing", n8nTemplateName: "ConvertKit Tag Applier", n8nTemplateDescription: "Applies tags", triggerEvent: "call.outcome_determined", expectedOutcome: "Tags applied in ConvertKit" },
    { id: "ck-sequences", title: "Trigger sequences", description: "Trigger ConvertKit email sequences from call events.", category: "Marketing", n8nTemplateName: "ConvertKit Sequence Trigger", n8nTemplateDescription: "Triggers sequences", triggerEvent: "call.completed", expectedOutcome: "Sequence triggered in ConvertKit" },
    { id: "ck-fields", title: "Update custom fields", description: "Update custom fields on ConvertKit subscribers.", category: "Marketing", n8nTemplateName: "ConvertKit Field Updater", n8nTemplateDescription: "Updates custom fields", triggerEvent: "contact.updated", expectedOutcome: "Custom fields updated in ConvertKit" },
  ],
  zapier: [
    { id: "zapier-trigger", title: "Trigger zaps from calls", description: "Trigger Zapier zaps with call data for cross-app automation.", category: "Automation", n8nTemplateName: "Zapier Zap Trigger", n8nTemplateDescription: "Triggers zaps", triggerEvent: "call.completed", expectedOutcome: "Zap triggered in Zapier" },
    { id: "zapier-multi", title: "Multi-step workflows", description: "Execute multi-step Zapier workflows from call events.", category: "Automation", n8nTemplateName: "Zapier Multi-step Workflow", n8nTemplateDescription: "Multi-step workflows", triggerEvent: "call.completed", expectedOutcome: "Multi-step workflow executed" },
    { id: "zapier-cross", title: "Cross-app automation", description: "Automate cross-app workflows triggered by calls.", category: "Automation", n8nTemplateName: "Zapier Cross-app Automation", n8nTemplateDescription: "Cross-app automation", triggerEvent: "call.completed", expectedOutcome: "Cross-app automation triggered" },
    { id: "zapier-routing", title: "Conditional routing", description: "Route call data conditionally through Zapier paths.", category: "Automation", n8nTemplateName: "Zapier Conditional Router", n8nTemplateDescription: "Conditional routing", triggerEvent: "call.outcome_determined", expectedOutcome: "Data routed conditionally" },
  ],
  make: [
    { id: "make-scenarios", title: "Trigger scenarios", description: "Trigger Make (Integromat) scenarios from call events.", category: "Automation", n8nTemplateName: "Make Scenario Trigger", n8nTemplateDescription: "Triggers scenarios", triggerEvent: "call.completed", expectedOutcome: "Scenario triggered in Make" },
    { id: "make-complex", title: "Complex workflows", description: "Execute complex multi-module workflows in Make.", category: "Automation", n8nTemplateName: "Make Complex Workflow", n8nTemplateDescription: "Complex workflows", triggerEvent: "call.completed", expectedOutcome: "Complex workflow executed" },
    { id: "make-transform", title: "Data transformation", description: "Transform call data using Make data processing modules.", category: "Automation", n8nTemplateName: "Make Data Transformer", n8nTemplateDescription: "Transforms data", triggerEvent: "call.completed", expectedOutcome: "Data transformed in Make" },
    { id: "make-multi", title: "Multi-app integration", description: "Integrate multiple apps through Make scenarios.", category: "Automation", n8nTemplateName: "Make Multi-app Integration", n8nTemplateDescription: "Multi-app integration", triggerEvent: "call.completed", expectedOutcome: "Multi-app integration executed" },
  ],
  n8n: [
    { id: "n8n-templates", title: "Execute workflow templates", description: "Execute pre-built n8n workflow templates for common tasks.", category: "Automation", n8nTemplateName: "n8n Template Executor", n8nTemplateDescription: "Executes workflow templates", triggerEvent: "call.completed", expectedOutcome: "Workflow template executed" },
    { id: "n8n-custom", title: "Custom automation flows", description: "Run custom n8n automation flows triggered by call events.", category: "Automation", n8nTemplateName: "n8n Custom Flow", n8nTemplateDescription: "Custom automation flows", triggerEvent: "call.completed", expectedOutcome: "Custom flow executed" },
    { id: "n8n-processing", title: "Data processing", description: "Process call data through n8n data transformation nodes.", category: "Automation", n8nTemplateName: "n8n Data Processor", n8nTemplateDescription: "Data processing", triggerEvent: "call.completed", expectedOutcome: "Data processed in n8n" },
    { id: "n8n-multi", title: "Multi-step integrations", description: "Execute multi-step integration workflows in n8n.", category: "Automation", n8nTemplateName: "n8n Multi-step Integration", n8nTemplateDescription: "Multi-step integrations", triggerEvent: "call.completed", expectedOutcome: "Multi-step integration completed" },
  ],
  notion: [
    { id: "notion-pages", title: "Create pages from call notes", description: "Create Notion pages from call notes and transcripts.", category: "Automation", n8nTemplateName: "Notion Page Creator", n8nTemplateDescription: "Creates pages from calls", triggerEvent: "call.completed", expectedOutcome: "Page created in Notion" },
    { id: "notion-databases", title: "Update databases", description: "Update Notion databases with call records and data.", category: "Automation", n8nTemplateName: "Notion Database Updater", n8nTemplateDescription: "Updates databases", triggerEvent: "call.completed", expectedOutcome: "Database updated in Notion" },
    { id: "notion-meetings", title: "Log meetings", description: "Log meeting notes and call summaries in Notion.", category: "Automation", n8nTemplateName: "Notion Meeting Logger", n8nTemplateDescription: "Logs meetings", triggerEvent: "call.completed", expectedOutcome: "Meeting logged in Notion" },
    { id: "notion-kb", title: "Knowledge base updates", description: "Update Notion knowledge base with insights from calls.", category: "Automation", n8nTemplateName: "Notion KB Updater", n8nTemplateDescription: "Updates knowledge base", triggerEvent: "call.analyzed", expectedOutcome: "Knowledge base updated in Notion" },
  ],
  "google-sheets": [
    { id: "gsheets-export", title: "Export call data", description: "Export call data and metrics to Google Sheets.", category: "Data & Storage", n8nTemplateName: "Google Sheets Data Exporter", n8nTemplateDescription: "Exports call data", triggerEvent: "call.completed", expectedOutcome: "Call data exported to Google Sheets" },
    { id: "gsheets-import", title: "Import contact lists", description: "Import contact lists from Google Sheets for campaigns.", category: "Data & Storage", n8nTemplateName: "Google Sheets Contact Importer", n8nTemplateDescription: "Imports contacts", triggerEvent: "campaign.setup", expectedOutcome: "Contacts imported from Google Sheets" },
    { id: "gsheets-reports", title: "Campaign reporting", description: "Generate campaign reports in Google Sheets.", category: "Data & Storage", n8nTemplateName: "Google Sheets Report Generator", n8nTemplateDescription: "Generates reports", triggerEvent: "report.generate", expectedOutcome: "Report generated in Google Sheets" },
    { id: "gsheets-dashboards", title: "Analytics dashboards", description: "Create analytics dashboards in Google Sheets.", category: "Data & Storage", n8nTemplateName: "Google Sheets Dashboard", n8nTemplateDescription: "Creates dashboards", triggerEvent: "report.generate", expectedOutcome: "Dashboard created in Google Sheets" },
  ],
  airtable: [
    { id: "at-sync", title: "Sync call records", description: "Sync call records to Airtable bases.", category: "Data & Storage", n8nTemplateName: "Airtable Record Sync", n8nTemplateDescription: "Syncs call records", triggerEvent: "call.completed", expectedOutcome: "Records synced to Airtable" },
    { id: "at-update", title: "Update bases", description: "Update Airtable bases with call data and outcomes.", category: "Data & Storage", n8nTemplateName: "Airtable Base Updater", n8nTemplateDescription: "Updates bases", triggerEvent: "call.completed", expectedOutcome: "Base updated in Airtable" },
    { id: "at-campaigns", title: "Campaign tracking", description: "Track campaign performance in Airtable.", category: "Data & Storage", n8nTemplateName: "Airtable Campaign Tracker", n8nTemplateDescription: "Tracks campaigns", triggerEvent: "campaign.update", expectedOutcome: "Campaign tracked in Airtable" },
    { id: "at-contacts", title: "Contact management", description: "Manage contacts in Airtable from call interactions.", category: "Data & Storage", n8nTemplateName: "Airtable Contact Manager", n8nTemplateDescription: "Manages contacts", triggerEvent: "contact.updated", expectedOutcome: "Contact managed in Airtable" },
  ],
  firebase: [
    { id: "fb-store", title: "Store call data", description: "Store call data and transcripts in Firebase.", category: "Data & Storage", n8nTemplateName: "Firebase Data Store", n8nTemplateDescription: "Stores call data", triggerEvent: "call.completed", expectedOutcome: "Data stored in Firebase" },
    { id: "fb-realtime", title: "Real-time sync", description: "Sync call data in real-time using Firebase.", category: "Data & Storage", n8nTemplateName: "Firebase Real-time Sync", n8nTemplateDescription: "Real-time data sync", triggerEvent: "call.active", expectedOutcome: "Data synced in real-time" },
    { id: "fb-analytics", title: "User analytics", description: "Track user analytics and call metrics in Firebase.", category: "Data & Storage", n8nTemplateName: "Firebase Analytics Tracker", n8nTemplateDescription: "Tracks analytics", triggerEvent: "call.completed", expectedOutcome: "Analytics tracked in Firebase" },
    { id: "fb-push", title: "Push notifications", description: "Send push notifications for call events via Firebase.", category: "Data & Storage", n8nTemplateName: "Firebase Push Notifier", n8nTemplateDescription: "Sends push notifications", triggerEvent: "call.important", expectedOutcome: "Push notification sent" },
  ],
  supabase: [
    { id: "supa-transcripts", title: "Store transcripts", description: "Store call transcripts in Supabase database.", category: "Data & Storage", n8nTemplateName: "Supabase Transcript Store", n8nTemplateDescription: "Stores transcripts", triggerEvent: "call.transcribed", expectedOutcome: "Transcript stored in Supabase" },
    { id: "supa-realtime", title: "Real-time data", description: "Sync call data in real-time using Supabase.", category: "Data & Storage", n8nTemplateName: "Supabase Real-time Sync", n8nTemplateDescription: "Real-time data sync", triggerEvent: "call.active", expectedOutcome: "Data synced in Supabase" },
    { id: "supa-users", title: "User management", description: "Manage user data and preferences in Supabase.", category: "Data & Storage", n8nTemplateName: "Supabase User Manager", n8nTemplateDescription: "Manages users", triggerEvent: "user.updated", expectedOutcome: "User data managed in Supabase" },
    { id: "supa-analytics", title: "Analytics storage", description: "Store analytics and metrics data in Supabase.", category: "Data & Storage", n8nTemplateName: "Supabase Analytics Store", n8nTemplateDescription: "Stores analytics", triggerEvent: "call.completed", expectedOutcome: "Analytics stored in Supabase" },
  ],
  "aws-s3": [
    { id: "s3-recordings", title: "Store recordings", description: "Store call recordings in AWS S3 buckets.", category: "Data & Storage", n8nTemplateName: "S3 Recording Store", n8nTemplateDescription: "Stores recordings", triggerEvent: "call.recorded", expectedOutcome: "Recording stored in S3" },
    { id: "s3-transcripts", title: "Archive transcripts", description: "Archive call transcripts in AWS S3.", category: "Data & Storage", n8nTemplateName: "S3 Transcript Archiver", n8nTemplateDescription: "Archives transcripts", triggerEvent: "call.transcribed", expectedOutcome: "Transcript archived in S3" },
    { id: "s3-backup", title: "Backup data", description: "Backup call data and configurations to AWS S3.", category: "Data & Storage", n8nTemplateName: "S3 Data Backup", n8nTemplateDescription: "Backs up data", triggerEvent: "backup.scheduled", expectedOutcome: "Data backed up to S3" },
    { id: "s3-media", title: "Media management", description: "Manage media files and assets in AWS S3.", category: "Data & Storage", n8nTemplateName: "S3 Media Manager", n8nTemplateDescription: "Manages media", triggerEvent: "media.upload", expectedOutcome: "Media managed in S3" },
  ],
  "google-analytics": [
    { id: "ga-events", title: "Track call events", description: "Track call events in Google Analytics for attribution.", category: "Analytics", n8nTemplateName: "GA Call Event Tracker", n8nTemplateDescription: "Tracks call events", triggerEvent: "call.completed", expectedOutcome: "Call event tracked in GA" },
    { id: "ga-attribution", title: "Conversion attribution", description: "Attribute conversions to specific calls in Google Analytics.", category: "Analytics", n8nTemplateName: "GA Conversion Attributor", n8nTemplateDescription: "Attributes conversions", triggerEvent: "call.converted", expectedOutcome: "Conversion attributed in GA" },
    { id: "ga-campaigns", title: "Campaign analytics", description: "Track campaign performance analytics in Google Analytics.", category: "Analytics", n8nTemplateName: "GA Campaign Analyzer", n8nTemplateDescription: "Campaign analytics", triggerEvent: "campaign.update", expectedOutcome: "Campaign analytics updated in GA" },
    { id: "ga-behavior", title: "User behavior", description: "Track user behavior patterns related to calls.", category: "Analytics", n8nTemplateName: "GA Behavior Tracker", n8nTemplateDescription: "Tracks user behavior", triggerEvent: "call.completed", expectedOutcome: "Behavior tracked in GA" },
  ],
  mixpanel: [
    { id: "mp-events", title: "Track call events", description: "Track call events and user actions in Mixpanel.", category: "Analytics", n8nTemplateName: "Mixpanel Event Tracker", n8nTemplateDescription: "Tracks call events", triggerEvent: "call.completed", expectedOutcome: "Event tracked in Mixpanel" },
    { id: "mp-funnels", title: "Funnel analysis", description: "Analyze call-to-conversion funnels in Mixpanel.", category: "Analytics", n8nTemplateName: "Mixpanel Funnel Analyzer", n8nTemplateDescription: "Analyzes funnels", triggerEvent: "call.completed", expectedOutcome: "Funnel analysis updated in Mixpanel" },
    { id: "mp-segments", title: "User segmentation", description: "Segment users based on call behavior in Mixpanel.", category: "Analytics", n8nTemplateName: "Mixpanel User Segmenter", n8nTemplateDescription: "Segments users", triggerEvent: "call.analyzed", expectedOutcome: "Users segmented in Mixpanel" },
    { id: "mp-ab", title: "A/B testing", description: "Track A/B test results for call scripts in Mixpanel.", category: "Analytics", n8nTemplateName: "Mixpanel A/B Tracker", n8nTemplateDescription: "A/B test tracking", triggerEvent: "call.completed", expectedOutcome: "A/B results tracked in Mixpanel" },
  ],
  segment: [
    { id: "seg-events", title: "Event tracking", description: "Track call events through Segment for data routing.", category: "Analytics", n8nTemplateName: "Segment Event Tracker", n8nTemplateDescription: "Tracks events", triggerEvent: "call.completed", expectedOutcome: "Event tracked in Segment" },
    { id: "seg-identify", title: "User identification", description: "Identify and track users through Segment.", category: "Analytics", n8nTemplateName: "Segment User Identifier", n8nTemplateDescription: "Identifies users", triggerEvent: "contact.identified", expectedOutcome: "User identified in Segment" },
    { id: "seg-cross", title: "Cross-platform analytics", description: "Route call analytics across platforms via Segment.", category: "Analytics", n8nTemplateName: "Segment Cross-platform Router", n8nTemplateDescription: "Cross-platform routing", triggerEvent: "call.completed", expectedOutcome: "Analytics routed via Segment" },
    { id: "seg-routing", title: "Data routing", description: "Route call data to multiple destinations through Segment.", category: "Analytics", n8nTemplateName: "Segment Data Router", n8nTemplateDescription: "Routes data", triggerEvent: "call.completed", expectedOutcome: "Data routed through Segment" },
  ],
  bamboohr: [
    { id: "bamboo-sync", title: "Sync employee data", description: "Sync employee data from BambooHR for internal calls.", category: "HR & Recruiting", n8nTemplateName: "BambooHR Employee Sync", n8nTemplateDescription: "Syncs employee data", triggerEvent: "contact.updated", expectedOutcome: "Employee data synced from BambooHR" },
    { id: "bamboo-interviews", title: "Log interviews", description: "Log interview call details in BambooHR.", category: "HR & Recruiting", n8nTemplateName: "BambooHR Interview Logger", n8nTemplateDescription: "Logs interviews", triggerEvent: "call.completed", expectedOutcome: "Interview logged in BambooHR" },
    { id: "bamboo-candidates", title: "Update candidate status", description: "Update candidate status in BambooHR after interview calls.", category: "HR & Recruiting", n8nTemplateName: "BambooHR Candidate Updater", n8nTemplateDescription: "Updates candidate status", triggerEvent: "call.outcome_determined", expectedOutcome: "Candidate status updated" },
    { id: "bamboo-followups", title: "Schedule follow-ups", description: "Schedule follow-up activities in BambooHR.", category: "HR & Recruiting", n8nTemplateName: "BambooHR Follow-up Scheduler", n8nTemplateDescription: "Schedules follow-ups", triggerEvent: "call.followup_needed", expectedOutcome: "Follow-up scheduled in BambooHR" },
  ],
  greenhouse: [
    { id: "gh-log-interviews", title: "Log interview calls", description: "Log interview call details and scores in Greenhouse.", category: "HR & Recruiting", n8nTemplateName: "Greenhouse Interview Logger", n8nTemplateDescription: "Logs interview calls", triggerEvent: "call.completed", expectedOutcome: "Interview logged in Greenhouse" },
    { id: "gh-update-stage", title: "Update candidate stage", description: "Update candidate pipeline stage in Greenhouse after interviews.", category: "HR & Recruiting", n8nTemplateName: "Greenhouse Stage Updater", n8nTemplateDescription: "Updates candidate stage", triggerEvent: "call.outcome_determined", expectedOutcome: "Candidate stage updated" },
    { id: "gh-sync-jobs", title: "Sync job data", description: "Sync job data and requirements from Greenhouse.", category: "HR & Recruiting", n8nTemplateName: "Greenhouse Job Sync", n8nTemplateDescription: "Syncs job data", triggerEvent: "system.sync", expectedOutcome: "Job data synced from Greenhouse" },
    { id: "gh-schedule", title: "Schedule interviews", description: "Schedule interview calls through Greenhouse.", category: "HR & Recruiting", n8nTemplateName: "Greenhouse Interview Scheduler", n8nTemplateDescription: "Schedules interviews", triggerEvent: "appointment.request", expectedOutcome: "Interview scheduled in Greenhouse" },
  ],
  lever: [
    { id: "lever-calls", title: "Track candidate calls", description: "Track and log candidate call interactions in Lever.", category: "HR & Recruiting", n8nTemplateName: "Lever Call Tracker", n8nTemplateDescription: "Tracks candidate calls", triggerEvent: "call.completed", expectedOutcome: "Call tracked in Lever" },
    { id: "lever-pipeline", title: "Update pipeline", description: "Update candidate pipeline stages in Lever.", category: "HR & Recruiting", n8nTemplateName: "Lever Pipeline Updater", n8nTemplateDescription: "Updates pipeline", triggerEvent: "call.outcome_determined", expectedOutcome: "Pipeline updated in Lever" },
    { id: "lever-contacts", title: "Sync contacts", description: "Sync candidate contact information with Lever.", category: "HR & Recruiting", n8nTemplateName: "Lever Contact Sync", n8nTemplateDescription: "Syncs contacts", triggerEvent: "contact.updated", expectedOutcome: "Contact synced in Lever" },
    { id: "lever-activities", title: "Log activities", description: "Log call activities and notes in Lever.", category: "HR & Recruiting", n8nTemplateName: "Lever Activity Logger", n8nTemplateDescription: "Logs activities", triggerEvent: "call.completed", expectedOutcome: "Activity logged in Lever" },
  ],
};

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
  const [executingUseCase, setExecutingUseCase] = useState<string | null>(null);

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

  const executeUseCaseMutation = useMutation({
    mutationFn: async (useCase: ProviderUseCase) => {
      const res = await apiRequest("POST", `/api/integrations/${integration!.id}/use-cases/execute`, {
        useCaseId: useCase.id,
        templateName: useCase.n8nTemplateName,
        triggerEvent: useCase.triggerEvent,
      });
      return await res.json();
    },
    onSuccess: (data) => {
      setExecutingUseCase(null);
      queryClient.invalidateQueries({ queryKey: ["/api/integrations", integration?.id, "logs"] });
      toast({
        title: data.success ? "Template executed" : "Execution failed",
        description: data.message || (data.success ? "The n8n workflow template was triggered successfully." : "Failed to execute the template."),
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (error: any) => {
      setExecutingUseCase(null);
      toast({
        title: "Execution failed",
        description: error.message || "Failed to execute the use case template",
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
    { key: "use-cases", label: "Use Cases" },
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

            {activeTab === "use-cases" && (
              <div data-testid="tab-content-use-cases">
                {(() => {
                  const useCases = PROVIDER_USE_CASES[slug] || [];
                  return useCases.length > 0 ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Workflow className="w-5 h-5 text-muted-foreground" />
                        <h3 className="text-base font-semibold" data-testid="text-use-cases-header">Use Cases for {app.name}</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {useCases.map((uc) => (
                          <div
                            key={uc.id}
                            className="border rounded-md p-4 space-y-3"
                            data-testid={`card-use-case-${uc.id}`}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <h4 className="text-sm font-semibold" data-testid={`text-use-case-title-${uc.id}`}>{uc.title}</h4>
                              <Badge variant="secondary" className="no-default-active-elevate text-xs" data-testid={`badge-use-case-category-${uc.id}`}>
                                {uc.category}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground" data-testid={`text-use-case-desc-${uc.id}`}>{uc.description}</p>
                            <div className="rounded-md bg-muted p-3 space-y-1.5">
                              <div className="flex items-center gap-1.5">
                                <Zap className="w-3 h-3 text-muted-foreground shrink-0" />
                                <span className="text-xs font-medium" data-testid={`text-template-name-${uc.id}`}>{uc.n8nTemplateName}</span>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                <span className="font-medium">Trigger:</span> {uc.triggerEvent}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                <span className="font-medium">Outcome:</span> {uc.expectedOutcome}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full"
                              disabled={!integration || integration.status !== "active" || executingUseCase === uc.id}
                              onClick={() => {
                                setExecutingUseCase(uc.id);
                                executeUseCaseMutation.mutate(uc);
                              }}
                              data-testid={`button-execute-${uc.id}`}
                            >
                              {executingUseCase === uc.id ? (
                                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                              ) : (
                                <Play className="w-4 h-4 mr-1.5" />
                              )}
                              {!integration || integration.status !== "active"
                                ? "Connect first"
                                : executingUseCase === uc.id
                                  ? "Executing..."
                                  : "Execute Template"}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Workflow className="w-8 h-8 text-muted-foreground mb-3" />
                      <p className="text-sm text-muted-foreground">No use cases available for {app.name} yet.</p>
                    </div>
                  );
                })()}
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
