import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation, useSearch } from "wouter";
import { useTranslation } from "react-i18next";
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

function getProviderCredentialConfig(t: (key: string) => string): Record<string, ProviderCredentialConfig> {
  return {
  salesforce: {
    field1Label: t("integrations.detail.providers.salesforce.field1Label"),
    field1Placeholder: t("integrations.detail.providers.salesforce.field1Placeholder"),
    field2Label: t("integrations.detail.providers.salesforce.field2Label"),
    field2Placeholder: t("integrations.detail.providers.salesforce.field2Placeholder"),
    helpText: t("integrations.detail.providers.salesforce.helpText"),
    setupUrl: "https://login.salesforce.com/",
    setupLinkText: t("integrations.detail.providers.salesforce.setupLinkText"),
    requiresRedirectUri: true,
    scopes: ["api", "refresh_token", "full"],
  },
  hubspot: {
    field1Label: t("integrations.detail.providers.hubspot.field1Label"),
    field1Placeholder: t("integrations.detail.providers.hubspot.field1Placeholder"),
    field2Label: t("integrations.detail.providers.hubspot.field2Label"),
    field2Placeholder: t("integrations.detail.providers.hubspot.field2Placeholder"),
    helpText: t("integrations.detail.providers.hubspot.helpText"),
    setupUrl: "https://developers.hubspot.com/",
    setupLinkText: t("integrations.detail.providers.hubspot.setupLinkText"),
    requiresRedirectUri: true,
    scopes: ["crm.objects.contacts.read", "crm.objects.contacts.write", "crm.objects.deals.read", "crm.objects.deals.write"],
  },
  zoho: {
    field1Label: t("integrations.detail.providers.zoho.field1Label"),
    field1Placeholder: t("integrations.detail.providers.zoho.field1Placeholder"),
    field2Label: t("integrations.detail.providers.zoho.field2Label"),
    field2Placeholder: t("integrations.detail.providers.zoho.field2Placeholder"),
    helpText: t("integrations.detail.providers.zoho.helpText"),
    setupUrl: "https://api-console.zoho.com/",
    setupLinkText: t("integrations.detail.providers.zoho.setupLinkText"),
    requiresRedirectUri: true,
    scopes: ["ZohoCRM.modules.ALL", "ZohoCRM.settings.ALL"],
  },
  "google-sheets": {
    field1Label: t("integrations.detail.providers.google-sheets.field1Label"),
    field1Placeholder: t("integrations.detail.providers.google-sheets.field1Placeholder"),
    field2Label: t("integrations.detail.providers.google-sheets.field2Label"),
    field2Placeholder: t("integrations.detail.providers.google-sheets.field2Placeholder"),
    helpText: t("integrations.detail.providers.google-sheets.helpText"),
    setupUrl: "https://console.cloud.google.com/apis/credentials",
    setupLinkText: t("integrations.detail.providers.google-sheets.setupLinkText"),
    requiresRedirectUri: true,
    scopes: ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"],
  },
  pipedrive: {
    field1Label: t("integrations.detail.providers.pipedrive.field1Label"),
    field1Placeholder: t("integrations.detail.providers.pipedrive.field1Placeholder"),
    field2Label: t("integrations.detail.providers.pipedrive.field2Label"),
    field2Placeholder: t("integrations.detail.providers.pipedrive.field2Placeholder"),
    helpText: t("integrations.detail.providers.pipedrive.helpText"),
    setupUrl: "https://developers.pipedrive.com/",
    setupLinkText: t("integrations.detail.providers.pipedrive.setupLinkText"),
    requiresRedirectUri: true,
    scopes: ["deals:full", "contacts:full", "activities:full"],
  },
  dynamics365: {
    field1Label: t("integrations.detail.providers.dynamics365.field1Label"),
    field1Placeholder: t("integrations.detail.providers.dynamics365.field1Placeholder"),
    field2Label: t("integrations.detail.providers.dynamics365.field2Label"),
    field2Placeholder: t("integrations.detail.providers.dynamics365.field2Placeholder"),
    helpText: t("integrations.detail.providers.dynamics365.helpText"),
    setupUrl: "https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade",
    setupLinkText: t("integrations.detail.providers.dynamics365.setupLinkText"),
    requiresRedirectUri: true,
    scopes: ["https://org.crm.dynamics.com/.default", "offline_access"],
  },
  freshsales: {
    field1Label: t("integrations.detail.providers.freshsales.field1Label"),
    field1Placeholder: t("integrations.detail.providers.freshsales.field1Placeholder"),
    field2Label: t("integrations.detail.providers.freshsales.field2Label"),
    field2Placeholder: t("integrations.detail.providers.freshsales.field2Placeholder"),
    helpText: t("integrations.detail.providers.freshsales.helpText"),
    setupUrl: "https://www.freshworks.com/crm/sales/",
    setupLinkText: t("integrations.detail.providers.freshsales.setupLinkText"),
    requiresRedirectUri: false,
  },
  "monday-com": {
    field1Label: t("integrations.detail.providers.monday-com.field1Label"),
    field1Placeholder: t("integrations.detail.providers.monday-com.field1Placeholder"),
    field2Label: t("integrations.detail.providers.monday-com.field2Label"),
    field2Placeholder: t("integrations.detail.providers.monday-com.field2Placeholder"),
    helpText: t("integrations.detail.providers.monday-com.helpText"),
    setupUrl: "https://monday.com/developers/apps",
    setupLinkText: t("integrations.detail.providers.monday-com.setupLinkText"),
    requiresRedirectUri: true,
    scopes: ["boards:read", "boards:write"],
  },
  airtable: {
    field1Label: t("integrations.detail.providers.airtable.field1Label"),
    field1Placeholder: t("integrations.detail.providers.airtable.field1Placeholder"),
    field2Label: t("integrations.detail.providers.airtable.field2Label"),
    field2Placeholder: t("integrations.detail.providers.airtable.field2Placeholder"),
    helpText: t("integrations.detail.providers.airtable.helpText"),
    setupUrl: "https://airtable.com/create/oauth",
    setupLinkText: t("integrations.detail.providers.airtable.setupLinkText"),
    requiresRedirectUri: true,
    scopes: ["data.records:read", "data.records:write", "schema.bases:read"],
  },
  slack: {
    field1Label: t("integrations.detail.providers.slack.field1Label"),
    field1Placeholder: t("integrations.detail.providers.slack.field1Placeholder"),
    field2Label: t("integrations.detail.providers.slack.field2Label"),
    field2Placeholder: t("integrations.detail.providers.slack.field2Placeholder"),
    helpText: t("integrations.detail.providers.slack.helpText"),
    setupUrl: "https://api.slack.com/apps",
    setupLinkText: t("integrations.detail.providers.slack.setupLinkText"),
    requiresRedirectUri: true,
    scopes: ["chat:write", "channels:read", "users:read"],
  },
  mailchimp: {
    field1Label: t("integrations.detail.providers.mailchimp.field1Label"),
    field1Placeholder: t("integrations.detail.providers.mailchimp.field1Placeholder"),
    field2Label: t("integrations.detail.providers.mailchimp.field2Label"),
    field2Placeholder: t("integrations.detail.providers.mailchimp.field2Placeholder"),
    helpText: t("integrations.detail.providers.mailchimp.helpText"),
    setupUrl: "https://login.mailchimp.com/",
    setupLinkText: t("integrations.detail.providers.mailchimp.setupLinkText"),
    requiresRedirectUri: true,
    scopes: ["lists:read", "lists:write", "campaigns:read"],
  },
  intercom: {
    field1Label: t("integrations.detail.providers.intercom.field1Label"),
    field1Placeholder: t("integrations.detail.providers.intercom.field1Placeholder"),
    field2Label: t("integrations.detail.providers.intercom.field2Label"),
    field2Placeholder: t("integrations.detail.providers.intercom.field2Placeholder"),
    helpText: t("integrations.detail.providers.intercom.helpText"),
    setupUrl: "https://developers.intercom.com/",
    setupLinkText: t("integrations.detail.providers.intercom.setupLinkText"),
    requiresRedirectUri: true,
    scopes: ["read_contacts", "write_contacts", "read_conversations", "write_conversations"],
  },
  twilio: {
    field1Label: t("integrations.detail.providers.twilio.field1Label"),
    field1Placeholder: t("integrations.detail.providers.twilio.field1Placeholder"),
    field2Label: t("integrations.detail.providers.twilio.field2Label"),
    field2Placeholder: t("integrations.detail.providers.twilio.field2Placeholder"),
    helpText: t("integrations.detail.providers.twilio.helpText"),
    setupUrl: "https://console.twilio.com/",
    setupLinkText: t("integrations.detail.providers.twilio.setupLinkText"),
    requiresRedirectUri: false,
  },
  openai: {
    field1Label: t("integrations.detail.providers.openai.field1Label"),
    field1Placeholder: t("integrations.detail.providers.openai.field1Placeholder"),
    field2Label: t("integrations.detail.providers.openai.field2Label"),
    field2Placeholder: t("integrations.detail.providers.openai.field2Placeholder"),
    helpText: t("integrations.detail.providers.openai.helpText"),
    setupUrl: "https://platform.openai.com/api-keys",
    setupLinkText: t("integrations.detail.providers.openai.setupLinkText"),
    requiresRedirectUri: false,
  },
  anthropic: {
    field1Label: t("integrations.detail.providers.anthropic.field1Label"),
    field1Placeholder: t("integrations.detail.providers.anthropic.field1Placeholder"),
    field2Label: t("integrations.detail.providers.anthropic.field2Label"),
    field2Placeholder: t("integrations.detail.providers.anthropic.field2Placeholder"),
    helpText: t("integrations.detail.providers.anthropic.helpText"),
    setupUrl: "https://console.anthropic.com/settings/keys",
    setupLinkText: t("integrations.detail.providers.anthropic.setupLinkText"),
    requiresRedirectUri: false,
  },
  "google-gemini": {
    field1Label: t("integrations.detail.providers.google-gemini.field1Label"),
    field1Placeholder: t("integrations.detail.providers.google-gemini.field1Placeholder"),
    field2Label: t("integrations.detail.providers.google-gemini.field2Label"),
    field2Placeholder: t("integrations.detail.providers.google-gemini.field2Placeholder"),
    helpText: t("integrations.detail.providers.google-gemini.helpText"),
    setupUrl: "https://aistudio.google.com/apikey",
    setupLinkText: t("integrations.detail.providers.google-gemini.setupLinkText"),
    requiresRedirectUri: false,
  },
  elevenlabs: {
    field1Label: t("integrations.detail.providers.elevenlabs.field1Label"),
    field1Placeholder: t("integrations.detail.providers.elevenlabs.field1Placeholder"),
    field2Label: t("integrations.detail.providers.elevenlabs.field2Label"),
    field2Placeholder: t("integrations.detail.providers.elevenlabs.field2Placeholder"),
    helpText: t("integrations.detail.providers.elevenlabs.helpText"),
    setupUrl: "https://elevenlabs.io/app/settings/api-keys",
    setupLinkText: t("integrations.detail.providers.elevenlabs.setupLinkText"),
    requiresRedirectUri: false,
  },
  deepgram: {
    field1Label: t("integrations.detail.providers.deepgram.field1Label"),
    field1Placeholder: t("integrations.detail.providers.deepgram.field1Placeholder"),
    field2Label: t("integrations.detail.providers.deepgram.field2Label"),
    field2Placeholder: t("integrations.detail.providers.deepgram.field2Placeholder"),
    helpText: t("integrations.detail.providers.deepgram.helpText"),
    setupUrl: "https://console.deepgram.com/",
    setupLinkText: t("integrations.detail.providers.deepgram.setupLinkText"),
    requiresRedirectUri: false,
  },
  zendesk: {
    field1Label: t("integrations.detail.providers.zendesk.field1Label"),
    field1Placeholder: t("integrations.detail.providers.zendesk.field1Placeholder"),
    field2Label: t("integrations.detail.providers.zendesk.field2Label"),
    field2Placeholder: t("integrations.detail.providers.zendesk.field2Placeholder"),
    helpText: t("integrations.detail.providers.zendesk.helpText"),
    setupUrl: "https://support.zendesk.com/",
    setupLinkText: t("integrations.detail.providers.zendesk.setupLinkText"),
    requiresRedirectUri: false,
  },
  freshdesk: {
    field1Label: t("integrations.detail.providers.freshdesk.field1Label"),
    field1Placeholder: t("integrations.detail.providers.freshdesk.field1Placeholder"),
    field2Label: t("integrations.detail.providers.freshdesk.field2Label"),
    field2Placeholder: t("integrations.detail.providers.freshdesk.field2Placeholder"),
    helpText: t("integrations.detail.providers.freshdesk.helpText"),
    setupUrl: "https://freshdesk.com/",
    setupLinkText: t("integrations.detail.providers.freshdesk.setupLinkText"),
    requiresRedirectUri: false,
  },
  "google-calendar": {
    field1Label: t("integrations.detail.providers.google-calendar.field1Label"),
    field1Placeholder: t("integrations.detail.providers.google-calendar.field1Placeholder"),
    field2Label: t("integrations.detail.providers.google-calendar.field2Label"),
    field2Placeholder: t("integrations.detail.providers.google-calendar.field2Placeholder"),
    helpText: t("integrations.detail.providers.google-calendar.helpText"),
    setupUrl: "https://console.cloud.google.com/apis/credentials",
    setupLinkText: t("integrations.detail.providers.google-calendar.setupLinkText"),
    requiresRedirectUri: true,
    scopes: ["https://www.googleapis.com/auth/calendar", "https://www.googleapis.com/auth/calendar.events"],
  },
  calendly: {
    field1Label: t("integrations.detail.providers.calendly.field1Label"),
    field1Placeholder: t("integrations.detail.providers.calendly.field1Placeholder"),
    field2Label: t("integrations.detail.providers.calendly.field2Label"),
    field2Placeholder: t("integrations.detail.providers.calendly.field2Placeholder"),
    helpText: t("integrations.detail.providers.calendly.helpText"),
    setupUrl: "https://calendly.com/integrations",
    setupLinkText: t("integrations.detail.providers.calendly.setupLinkText"),
    requiresRedirectUri: false,
  },
  stripe: {
    field1Label: t("integrations.detail.providers.stripe.field1Label"),
    field1Placeholder: t("integrations.detail.providers.stripe.field1Placeholder"),
    field2Label: t("integrations.detail.providers.stripe.field2Label"),
    field2Placeholder: t("integrations.detail.providers.stripe.field2Placeholder"),
    helpText: t("integrations.detail.providers.stripe.helpText"),
    setupUrl: "https://dashboard.stripe.com/apikeys",
    setupLinkText: t("integrations.detail.providers.stripe.setupLinkText"),
    requiresRedirectUri: false,
  },
  shopify: {
    field1Label: t("integrations.detail.providers.shopify.field1Label"),
    field1Placeholder: t("integrations.detail.providers.shopify.field1Placeholder"),
    field2Label: t("integrations.detail.providers.shopify.field2Label"),
    field2Placeholder: t("integrations.detail.providers.shopify.field2Placeholder"),
    helpText: t("integrations.detail.providers.shopify.helpText"),
    setupUrl: "https://admin.shopify.com/",
    setupLinkText: t("integrations.detail.providers.shopify.setupLinkText"),
    requiresRedirectUri: false,
  },
  activecampaign: {
    field1Label: t("integrations.detail.providers.activecampaign.field1Label"),
    field1Placeholder: t("integrations.detail.providers.activecampaign.field1Placeholder"),
    field2Label: t("integrations.detail.providers.activecampaign.field2Label"),
    field2Placeholder: t("integrations.detail.providers.activecampaign.field2Placeholder"),
    helpText: t("integrations.detail.providers.activecampaign.helpText"),
    setupUrl: "https://www.activecampaign.com/",
    setupLinkText: t("integrations.detail.providers.activecampaign.setupLinkText"),
    requiresRedirectUri: false,
  },
  sendgrid: {
    field1Label: t("integrations.detail.providers.sendgrid.field1Label"),
    field1Placeholder: t("integrations.detail.providers.sendgrid.field1Placeholder"),
    field2Label: t("integrations.detail.providers.sendgrid.field2Label"),
    field2Placeholder: t("integrations.detail.providers.sendgrid.field2Placeholder"),
    helpText: t("integrations.detail.providers.sendgrid.helpText"),
    setupUrl: "https://app.sendgrid.com/settings/api_keys",
    setupLinkText: t("integrations.detail.providers.sendgrid.setupLinkText"),
    requiresRedirectUri: false,
  },
  "microsoft-teams": {
    field1Label: t("integrations.detail.providers.microsoft-teams.field1Label"),
    field1Placeholder: t("integrations.detail.providers.microsoft-teams.field1Placeholder"),
    field2Label: t("integrations.detail.providers.microsoft-teams.field2Label"),
    field2Placeholder: t("integrations.detail.providers.microsoft-teams.field2Placeholder"),
    helpText: t("integrations.detail.providers.microsoft-teams.helpText"),
    setupUrl: "https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade",
    setupLinkText: t("integrations.detail.providers.microsoft-teams.setupLinkText"),
    requiresRedirectUri: true,
    scopes: ["ChannelMessage.Send", "Chat.ReadWrite"],
  },
  telegram: {
    field1Label: t("integrations.detail.providers.telegram.field1Label"),
    field1Placeholder: t("integrations.detail.providers.telegram.field1Placeholder"),
    field2Label: t("integrations.detail.providers.telegram.field2Label"),
    field2Placeholder: t("integrations.detail.providers.telegram.field2Placeholder"),
    helpText: t("integrations.detail.providers.telegram.helpText"),
    setupUrl: "https://t.me/BotFather",
    setupLinkText: t("integrations.detail.providers.telegram.setupLinkText"),
    requiresRedirectUri: false,
  },
  whatsapp: {
    field1Label: t("integrations.detail.providers.whatsapp.field1Label"),
    field1Placeholder: t("integrations.detail.providers.whatsapp.field1Placeholder"),
    field2Label: t("integrations.detail.providers.whatsapp.field2Label"),
    field2Placeholder: t("integrations.detail.providers.whatsapp.field2Placeholder"),
    helpText: t("integrations.detail.providers.whatsapp.helpText"),
    setupUrl: "https://developers.facebook.com/apps/",
    setupLinkText: t("integrations.detail.providers.whatsapp.setupLinkText"),
    requiresRedirectUri: false,
  },
  discord: {
    field1Label: t("integrations.detail.providers.discord.field1Label"),
    field1Placeholder: t("integrations.detail.providers.discord.field1Placeholder"),
    field2Label: t("integrations.detail.providers.discord.field2Label"),
    field2Placeholder: t("integrations.detail.providers.discord.field2Placeholder"),
    helpText: t("integrations.detail.providers.discord.helpText"),
    setupUrl: "https://discord.com/developers/applications",
    setupLinkText: t("integrations.detail.providers.discord.setupLinkText"),
    requiresRedirectUri: false,
  },
  zapier: {
    field1Label: t("integrations.detail.providers.zapier.field1Label"),
    field1Placeholder: t("integrations.detail.providers.zapier.field1Placeholder"),
    field2Label: t("integrations.detail.providers.zapier.field2Label"),
    field2Placeholder: t("integrations.detail.providers.zapier.field2Placeholder"),
    helpText: t("integrations.detail.providers.zapier.helpText"),
    setupUrl: "https://zapier.com/app/zaps",
    setupLinkText: t("integrations.detail.providers.zapier.setupLinkText"),
    requiresRedirectUri: false,
  },
  make: {
    field1Label: t("integrations.detail.providers.make.field1Label"),
    field1Placeholder: t("integrations.detail.providers.make.field1Placeholder"),
    field2Label: t("integrations.detail.providers.make.field2Label"),
    field2Placeholder: t("integrations.detail.providers.make.field2Placeholder"),
    helpText: t("integrations.detail.providers.make.helpText"),
    setupUrl: "https://www.make.com/en/login",
    setupLinkText: t("integrations.detail.providers.make.setupLinkText"),
    requiresRedirectUri: false,
  },
  notion: {
    field1Label: t("integrations.detail.providers.notion.field1Label"),
    field1Placeholder: t("integrations.detail.providers.notion.field1Placeholder"),
    field2Label: t("integrations.detail.providers.notion.field2Label"),
    field2Placeholder: t("integrations.detail.providers.notion.field2Placeholder"),
    helpText: t("integrations.detail.providers.notion.helpText"),
    setupUrl: "https://www.notion.so/my-integrations",
    setupLinkText: t("integrations.detail.providers.notion.setupLinkText"),
    requiresRedirectUri: false,
  },
  helpscout: {
    field1Label: t("integrations.detail.providers.helpscout.field1Label"),
    field1Placeholder: t("integrations.detail.providers.helpscout.field1Placeholder"),
    field2Label: t("integrations.detail.providers.helpscout.field2Label"),
    field2Placeholder: t("integrations.detail.providers.helpscout.field2Placeholder"),
    helpText: t("integrations.detail.providers.helpscout.helpText"),
    setupUrl: "https://secure.helpscout.net/",
    setupLinkText: t("integrations.detail.providers.helpscout.setupLinkText"),
    requiresRedirectUri: false,
  },
  "google-analytics": {
    field1Label: t("integrations.detail.providers.google-analytics.field1Label"),
    field1Placeholder: t("integrations.detail.providers.google-analytics.field1Placeholder"),
    field2Label: t("integrations.detail.providers.google-analytics.field2Label"),
    field2Placeholder: t("integrations.detail.providers.google-analytics.field2Placeholder"),
    helpText: t("integrations.detail.providers.google-analytics.helpText"),
    setupUrl: "https://analytics.google.com/",
    setupLinkText: t("integrations.detail.providers.google-analytics.setupLinkText"),
    requiresRedirectUri: false,
  },
  "aws-s3": {
    field1Label: t("integrations.detail.providers.aws-s3.field1Label"),
    field1Placeholder: t("integrations.detail.providers.aws-s3.field1Placeholder"),
    field2Label: t("integrations.detail.providers.aws-s3.field2Label"),
    field2Placeholder: t("integrations.detail.providers.aws-s3.field2Placeholder"),
    helpText: t("integrations.detail.providers.aws-s3.helpText"),
    setupUrl: "https://console.aws.amazon.com/iam/",
    setupLinkText: t("integrations.detail.providers.aws-s3.setupLinkText"),
    requiresRedirectUri: false,
  },
  bamboohr: {
    field1Label: t("integrations.detail.providers.bamboohr.field1Label"),
    field1Placeholder: t("integrations.detail.providers.bamboohr.field1Placeholder"),
    field2Label: t("integrations.detail.providers.bamboohr.field2Label"),
    field2Placeholder: t("integrations.detail.providers.bamboohr.field2Placeholder"),
    helpText: t("integrations.detail.providers.bamboohr.helpText"),
    setupUrl: "https://www.bamboohr.com/",
    setupLinkText: t("integrations.detail.providers.bamboohr.setupLinkText"),
    requiresRedirectUri: false,
  },
  "acuity-scheduling": {
    field1Label: t("integrations.detail.providers.acuity-scheduling.field1Label"),
    field1Placeholder: t("integrations.detail.providers.acuity-scheduling.field1Placeholder"),
    field2Label: t("integrations.detail.providers.acuity-scheduling.field2Label"),
    field2Placeholder: t("integrations.detail.providers.acuity-scheduling.field2Placeholder"),
    helpText: t("integrations.detail.providers.acuity-scheduling.helpText"),
    setupUrl: "https://acuityscheduling.com/",
    setupLinkText: t("integrations.detail.providers.acuity-scheduling.setupLinkText"),
    requiresRedirectUri: false,
  },
  "amazon-connect": {
    field1Label: t("integrations.detail.providers.amazon-connect.field1Label"),
    field1Placeholder: t("integrations.detail.providers.amazon-connect.field1Placeholder"),
    field2Label: t("integrations.detail.providers.amazon-connect.field2Label"),
    field2Placeholder: t("integrations.detail.providers.amazon-connect.field2Placeholder"),
    helpText: t("integrations.detail.providers.amazon-connect.helpText"),
    setupUrl: "https://console.aws.amazon.com/connect/",
    setupLinkText: t("integrations.detail.providers.amazon-connect.setupLinkText"),
    requiresRedirectUri: false,
  },
  "amazon-polly": {
    field1Label: t("integrations.detail.providers.amazon-polly.field1Label"),
    field1Placeholder: t("integrations.detail.providers.amazon-polly.field1Placeholder"),
    field2Label: t("integrations.detail.providers.amazon-polly.field2Label"),
    field2Placeholder: t("integrations.detail.providers.amazon-polly.field2Placeholder"),
    helpText: t("integrations.detail.providers.amazon-polly.helpText"),
    setupUrl: "https://console.aws.amazon.com/polly/",
    setupLinkText: t("integrations.detail.providers.amazon-polly.setupLinkText"),
    requiresRedirectUri: false,
  },
  "azure-speech": {
    field1Label: t("integrations.detail.providers.azure-speech.field1Label"),
    field1Placeholder: t("integrations.detail.providers.azure-speech.field1Placeholder"),
    field2Label: t("integrations.detail.providers.azure-speech.field2Label"),
    field2Placeholder: t("integrations.detail.providers.azure-speech.field2Placeholder"),
    helpText: t("integrations.detail.providers.azure-speech.helpText"),
    setupUrl: "https://portal.azure.com/#create/Microsoft.CognitiveServicesSpeechServices",
    setupLinkText: t("integrations.detail.providers.azure-speech.setupLinkText"),
    requiresRedirectUri: false,
  },
  bandwidth: {
    field1Label: t("integrations.detail.providers.bandwidth.field1Label"),
    field1Placeholder: t("integrations.detail.providers.bandwidth.field1Placeholder"),
    field2Label: t("integrations.detail.providers.bandwidth.field2Label"),
    field2Placeholder: t("integrations.detail.providers.bandwidth.field2Placeholder"),
    helpText: t("integrations.detail.providers.bandwidth.helpText"),
    setupUrl: "https://dashboard.bandwidth.com/",
    setupLinkText: t("integrations.detail.providers.bandwidth.setupLinkText"),
    requiresRedirectUri: false,
  },
  bitrix24: {
    field1Label: t("integrations.detail.providers.bitrix24.field1Label"),
    field1Placeholder: t("integrations.detail.providers.bitrix24.field1Placeholder"),
    field2Label: t("integrations.detail.providers.bitrix24.field2Label"),
    field2Placeholder: t("integrations.detail.providers.bitrix24.field2Placeholder"),
    helpText: t("integrations.detail.providers.bitrix24.helpText"),
    setupUrl: "https://www.bitrix24.com/",
    setupLinkText: t("integrations.detail.providers.bitrix24.setupLinkText"),
    requiresRedirectUri: false,
  },
  brevo: {
    field1Label: t("integrations.detail.providers.brevo.field1Label"),
    field1Placeholder: t("integrations.detail.providers.brevo.field1Placeholder"),
    field2Label: t("integrations.detail.providers.brevo.field2Label"),
    field2Placeholder: t("integrations.detail.providers.brevo.field2Placeholder"),
    helpText: t("integrations.detail.providers.brevo.helpText"),
    setupUrl: "https://app.brevo.com/settings/keys/api",
    setupLinkText: t("integrations.detail.providers.brevo.setupLinkText"),
    requiresRedirectUri: false,
  },
  "cal-com": {
    field1Label: t("integrations.detail.providers.cal-com.field1Label"),
    field1Placeholder: t("integrations.detail.providers.cal-com.field1Placeholder"),
    field2Label: t("integrations.detail.providers.cal-com.field2Label"),
    field2Placeholder: t("integrations.detail.providers.cal-com.field2Placeholder"),
    helpText: t("integrations.detail.providers.cal-com.helpText"),
    setupUrl: "https://app.cal.com/settings/developer/api-keys",
    setupLinkText: t("integrations.detail.providers.cal-com.setupLinkText"),
    requiresRedirectUri: false,
  },
  "close-crm": {
    field1Label: t("integrations.detail.providers.close-crm.field1Label"),
    field1Placeholder: t("integrations.detail.providers.close-crm.field1Placeholder"),
    field2Label: t("integrations.detail.providers.close-crm.field2Label"),
    field2Placeholder: t("integrations.detail.providers.close-crm.field2Placeholder"),
    helpText: t("integrations.detail.providers.close-crm.helpText"),
    setupUrl: "https://app.close.com/settings/",
    setupLinkText: t("integrations.detail.providers.close-crm.setupLinkText"),
    requiresRedirectUri: false,
  },
  cohere: {
    field1Label: t("integrations.detail.providers.cohere.field1Label"),
    field1Placeholder: t("integrations.detail.providers.cohere.field1Placeholder"),
    field2Label: t("integrations.detail.providers.cohere.field2Label"),
    field2Placeholder: t("integrations.detail.providers.cohere.field2Placeholder"),
    helpText: t("integrations.detail.providers.cohere.helpText"),
    setupUrl: "https://dashboard.cohere.com/api-keys",
    setupLinkText: t("integrations.detail.providers.cohere.setupLinkText"),
    requiresRedirectUri: false,
  },
  convertkit: {
    field1Label: t("integrations.detail.providers.convertkit.field1Label"),
    field1Placeholder: t("integrations.detail.providers.convertkit.field1Placeholder"),
    field2Label: t("integrations.detail.providers.convertkit.field2Label"),
    field2Placeholder: t("integrations.detail.providers.convertkit.field2Placeholder"),
    helpText: t("integrations.detail.providers.convertkit.helpText"),
    setupUrl: "https://app.convertkit.com/account_settings/advanced_settings",
    setupLinkText: t("integrations.detail.providers.convertkit.setupLinkText"),
    requiresRedirectUri: false,
  },
  "copper-crm": {
    field1Label: t("integrations.detail.providers.copper-crm.field1Label"),
    field1Placeholder: t("integrations.detail.providers.copper-crm.field1Placeholder"),
    field2Label: t("integrations.detail.providers.copper-crm.field2Label"),
    field2Placeholder: t("integrations.detail.providers.copper-crm.field2Placeholder"),
    helpText: t("integrations.detail.providers.copper-crm.helpText"),
    setupUrl: "https://app.copper.com/",
    setupLinkText: t("integrations.detail.providers.copper-crm.setupLinkText"),
    requiresRedirectUri: false,
  },
  firebase: {
    field1Label: t("integrations.detail.providers.firebase.field1Label"),
    field1Placeholder: t("integrations.detail.providers.firebase.field1Placeholder"),
    field2Label: t("integrations.detail.providers.firebase.field2Label"),
    field2Placeholder: t("integrations.detail.providers.firebase.field2Placeholder"),
    helpText: t("integrations.detail.providers.firebase.helpText"),
    setupUrl: "https://console.firebase.google.com/",
    setupLinkText: t("integrations.detail.providers.firebase.setupLinkText"),
    requiresRedirectUri: false,
  },
  front: {
    field1Label: t("integrations.detail.providers.front.field1Label"),
    field1Placeholder: t("integrations.detail.providers.front.field1Placeholder"),
    field2Label: t("integrations.detail.providers.front.field2Label"),
    field2Placeholder: t("integrations.detail.providers.front.field2Placeholder"),
    helpText: t("integrations.detail.providers.front.helpText"),
    setupUrl: "https://app.frontapp.com/settings/tools/api",
    setupLinkText: t("integrations.detail.providers.front.setupLinkText"),
    requiresRedirectUri: false,
  },
  gohighlevel: {
    field1Label: t("integrations.detail.providers.gohighlevel.field1Label"),
    field1Placeholder: t("integrations.detail.providers.gohighlevel.field1Placeholder"),
    field2Label: t("integrations.detail.providers.gohighlevel.field2Label"),
    field2Placeholder: t("integrations.detail.providers.gohighlevel.field2Placeholder"),
    helpText: t("integrations.detail.providers.gohighlevel.helpText"),
    setupUrl: "https://app.gohighlevel.com/",
    setupLinkText: t("integrations.detail.providers.gohighlevel.setupLinkText"),
    requiresRedirectUri: false,
  },
  "google-cloud-tts": {
    field1Label: t("integrations.detail.providers.google-cloud-tts.field1Label"),
    field1Placeholder: t("integrations.detail.providers.google-cloud-tts.field1Placeholder"),
    field2Label: t("integrations.detail.providers.google-cloud-tts.field2Label"),
    field2Placeholder: t("integrations.detail.providers.google-cloud-tts.field2Placeholder"),
    helpText: t("integrations.detail.providers.google-cloud-tts.helpText"),
    setupUrl: "https://console.cloud.google.com/apis/library/texttospeech.googleapis.com",
    setupLinkText: t("integrations.detail.providers.google-cloud-tts.setupLinkText"),
    requiresRedirectUri: false,
  },
  greenhouse: {
    field1Label: t("integrations.detail.providers.greenhouse.field1Label"),
    field1Placeholder: t("integrations.detail.providers.greenhouse.field1Placeholder"),
    field2Label: t("integrations.detail.providers.greenhouse.field2Label"),
    field2Placeholder: t("integrations.detail.providers.greenhouse.field2Placeholder"),
    helpText: t("integrations.detail.providers.greenhouse.helpText"),
    setupUrl: "https://app.greenhouse.io/",
    setupLinkText: t("integrations.detail.providers.greenhouse.setupLinkText"),
    requiresRedirectUri: false,
  },
  groq: {
    field1Label: t("integrations.detail.providers.groq.field1Label"),
    field1Placeholder: t("integrations.detail.providers.groq.field1Placeholder"),
    field2Label: t("integrations.detail.providers.groq.field2Label"),
    field2Placeholder: t("integrations.detail.providers.groq.field2Placeholder"),
    helpText: t("integrations.detail.providers.groq.helpText"),
    setupUrl: "https://console.groq.com/keys",
    setupLinkText: t("integrations.detail.providers.groq.setupLinkText"),
    requiresRedirectUri: false,
  },
  insightly: {
    field1Label: t("integrations.detail.providers.insightly.field1Label"),
    field1Placeholder: t("integrations.detail.providers.insightly.field1Placeholder"),
    field2Label: t("integrations.detail.providers.insightly.field2Label"),
    field2Placeholder: t("integrations.detail.providers.insightly.field2Placeholder"),
    helpText: t("integrations.detail.providers.insightly.helpText"),
    setupUrl: "https://crm.insightly.com/",
    setupLinkText: t("integrations.detail.providers.insightly.setupLinkText"),
    requiresRedirectUri: false,
  },
  keap: {
    field1Label: t("integrations.detail.providers.keap.field1Label"),
    field1Placeholder: t("integrations.detail.providers.keap.field1Placeholder"),
    field2Label: t("integrations.detail.providers.keap.field2Label"),
    field2Placeholder: t("integrations.detail.providers.keap.field2Placeholder"),
    helpText: t("integrations.detail.providers.keap.helpText"),
    setupUrl: "https://keys.developer.keap.com/",
    setupLinkText: t("integrations.detail.providers.keap.setupLinkText"),
    requiresRedirectUri: true,
    scopes: ["full"],
  },
  lever: {
    field1Label: t("integrations.detail.providers.lever.field1Label"),
    field1Placeholder: t("integrations.detail.providers.lever.field1Placeholder"),
    field2Label: t("integrations.detail.providers.lever.field2Label"),
    field2Placeholder: t("integrations.detail.providers.lever.field2Placeholder"),
    helpText: t("integrations.detail.providers.lever.helpText"),
    setupUrl: "https://hire.lever.co/settings/integrations",
    setupLinkText: t("integrations.detail.providers.lever.setupLinkText"),
    requiresRedirectUri: false,
  },
  "microsoft-outlook": {
    field1Label: t("integrations.detail.providers.microsoft-outlook.field1Label"),
    field1Placeholder: t("integrations.detail.providers.microsoft-outlook.field1Placeholder"),
    field2Label: t("integrations.detail.providers.microsoft-outlook.field2Label"),
    field2Placeholder: t("integrations.detail.providers.microsoft-outlook.field2Placeholder"),
    helpText: t("integrations.detail.providers.microsoft-outlook.helpText"),
    setupUrl: "https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade",
    setupLinkText: t("integrations.detail.providers.microsoft-outlook.setupLinkText"),
    requiresRedirectUri: true,
    scopes: ["Mail.ReadWrite", "Calendars.ReadWrite"],
  },
  mistral: {
    field1Label: t("integrations.detail.providers.mistral.field1Label"),
    field1Placeholder: t("integrations.detail.providers.mistral.field1Placeholder"),
    field2Label: t("integrations.detail.providers.mistral.field2Label"),
    field2Placeholder: t("integrations.detail.providers.mistral.field2Placeholder"),
    helpText: t("integrations.detail.providers.mistral.helpText"),
    setupUrl: "https://console.mistral.ai/api-keys",
    setupLinkText: t("integrations.detail.providers.mistral.setupLinkText"),
    requiresRedirectUri: false,
  },
  mixpanel: {
    field1Label: t("integrations.detail.providers.mixpanel.field1Label"),
    field1Placeholder: t("integrations.detail.providers.mixpanel.field1Placeholder"),
    field2Label: t("integrations.detail.providers.mixpanel.field2Label"),
    field2Placeholder: t("integrations.detail.providers.mixpanel.field2Placeholder"),
    helpText: t("integrations.detail.providers.mixpanel.helpText"),
    setupUrl: "https://mixpanel.com/settings/project",
    setupLinkText: t("integrations.detail.providers.mixpanel.setupLinkText"),
    requiresRedirectUri: false,
  },
  murf: {
    field1Label: t("integrations.detail.providers.murf.field1Label"),
    field1Placeholder: t("integrations.detail.providers.murf.field1Placeholder"),
    field2Label: t("integrations.detail.providers.murf.field2Label"),
    field2Placeholder: t("integrations.detail.providers.murf.field2Placeholder"),
    helpText: t("integrations.detail.providers.murf.helpText"),
    setupUrl: "https://murf.ai/studio",
    setupLinkText: t("integrations.detail.providers.murf.setupLinkText"),
    requiresRedirectUri: false,
  },
  n8n: {
    field1Label: t("integrations.detail.providers.n8n.field1Label"),
    field1Placeholder: t("integrations.detail.providers.n8n.field1Placeholder"),
    field2Label: t("integrations.detail.providers.n8n.field2Label"),
    field2Placeholder: t("integrations.detail.providers.n8n.field2Placeholder"),
    helpText: t("integrations.detail.providers.n8n.helpText"),
    setupUrl: "https://app.n8n.cloud/",
    setupLinkText: t("integrations.detail.providers.n8n.setupLinkText"),
    requiresRedirectUri: false,
  },
  perplexity: {
    field1Label: t("integrations.detail.providers.perplexity.field1Label"),
    field1Placeholder: t("integrations.detail.providers.perplexity.field1Placeholder"),
    field2Label: t("integrations.detail.providers.perplexity.field2Label"),
    field2Placeholder: t("integrations.detail.providers.perplexity.field2Placeholder"),
    helpText: t("integrations.detail.providers.perplexity.helpText"),
    setupUrl: "https://www.perplexity.ai/settings/api",
    setupLinkText: t("integrations.detail.providers.perplexity.setupLinkText"),
    requiresRedirectUri: false,
  },
  playht: {
    field1Label: t("integrations.detail.providers.playht.field1Label"),
    field1Placeholder: t("integrations.detail.providers.playht.field1Placeholder"),
    field2Label: t("integrations.detail.providers.playht.field2Label"),
    field2Placeholder: t("integrations.detail.providers.playht.field2Placeholder"),
    helpText: t("integrations.detail.providers.playht.helpText"),
    setupUrl: "https://play.ht/studio/api-access",
    setupLinkText: t("integrations.detail.providers.playht.setupLinkText"),
    requiresRedirectUri: false,
  },
  segment: {
    field1Label: t("integrations.detail.providers.segment.field1Label"),
    field1Placeholder: t("integrations.detail.providers.segment.field1Placeholder"),
    field2Label: t("integrations.detail.providers.segment.field2Label"),
    field2Placeholder: t("integrations.detail.providers.segment.field2Placeholder"),
    helpText: t("integrations.detail.providers.segment.helpText"),
    setupUrl: "https://app.segment.com/",
    setupLinkText: t("integrations.detail.providers.segment.setupLinkText"),
    requiresRedirectUri: false,
  },
  sugarcrm: {
    field1Label: t("integrations.detail.providers.sugarcrm.field1Label"),
    field1Placeholder: t("integrations.detail.providers.sugarcrm.field1Placeholder"),
    field2Label: t("integrations.detail.providers.sugarcrm.field2Label"),
    field2Placeholder: t("integrations.detail.providers.sugarcrm.field2Placeholder"),
    helpText: t("integrations.detail.providers.sugarcrm.helpText"),
    setupUrl: "https://www.sugarcrm.com/",
    setupLinkText: t("integrations.detail.providers.sugarcrm.setupLinkText"),
    requiresRedirectUri: false,
  },
  supabase: {
    field1Label: t("integrations.detail.providers.supabase.field1Label"),
    field1Placeholder: t("integrations.detail.providers.supabase.field1Placeholder"),
    field2Label: t("integrations.detail.providers.supabase.field2Label"),
    field2Placeholder: t("integrations.detail.providers.supabase.field2Placeholder"),
    helpText: t("integrations.detail.providers.supabase.helpText"),
    setupUrl: "https://supabase.com/dashboard",
    setupLinkText: t("integrations.detail.providers.supabase.setupLinkText"),
    requiresRedirectUri: false,
  },
  telnyx: {
    field1Label: t("integrations.detail.providers.telnyx.field1Label"),
    field1Placeholder: t("integrations.detail.providers.telnyx.field1Placeholder"),
    field2Label: t("integrations.detail.providers.telnyx.field2Label"),
    field2Placeholder: t("integrations.detail.providers.telnyx.field2Placeholder"),
    helpText: t("integrations.detail.providers.telnyx.helpText"),
    setupUrl: "https://portal.telnyx.com/",
    setupLinkText: t("integrations.detail.providers.telnyx.setupLinkText"),
    requiresRedirectUri: false,
  },
  vonage: {
    field1Label: t("integrations.detail.providers.vonage.field1Label"),
    field1Placeholder: t("integrations.detail.providers.vonage.field1Placeholder"),
    field2Label: t("integrations.detail.providers.vonage.field2Label"),
    field2Placeholder: t("integrations.detail.providers.vonage.field2Placeholder"),
    helpText: t("integrations.detail.providers.vonage.helpText"),
    setupUrl: "https://dashboard.nexmo.com/",
    setupLinkText: t("integrations.detail.providers.vonage.setupLinkText"),
    requiresRedirectUri: false,
  },
  woocommerce: {
    field1Label: t("integrations.detail.providers.woocommerce.field1Label"),
    field1Placeholder: t("integrations.detail.providers.woocommerce.field1Placeholder"),
    field2Label: t("integrations.detail.providers.woocommerce.field2Label"),
    field2Placeholder: t("integrations.detail.providers.woocommerce.field2Placeholder"),
    helpText: t("integrations.detail.providers.woocommerce.helpText"),
    setupUrl: "https://woocommerce.com/",
    setupLinkText: t("integrations.detail.providers.woocommerce.setupLinkText"),
    requiresRedirectUri: false,
  },
  };
}


interface ProviderAction {
  id: string;
  name: string;
  description: string;
  type: "action" | "sync";
  endpoint: string;
  enabled: boolean;
}

function getProviderActions(t: (key: string) => string): Record<string, ProviderAction[]> {
  return {
  salesforce: [
    { id: "sync-contacts", name: t("integrations.detail.providers.salesforce.actions.sync-contacts.name"), description: t("integrations.detail.providers.salesforce.actions.sync-contacts.description"), type: "sync", endpoint: "/api/integrations/{id}/salesforce/contacts/sync", enabled: true },
    { id: "push-call-summary", name: t("integrations.detail.providers.salesforce.actions.push-call-summary.name"), description: t("integrations.detail.providers.salesforce.actions.push-call-summary.description"), type: "action", endpoint: "/api/integrations/{id}/salesforce/activities/push", enabled: false },
    { id: "sync-leads", name: t("integrations.detail.providers.salesforce.actions.sync-leads.name"), description: t("integrations.detail.providers.salesforce.actions.sync-leads.description"), type: "sync", endpoint: "/api/integrations/{id}/salesforce/leads/sync", enabled: true },
    { id: "update-contact-status", name: t("integrations.detail.providers.salesforce.actions.update-contact-status.name"), description: t("integrations.detail.providers.salesforce.actions.update-contact-status.description"), type: "action", endpoint: "/api/integrations/{id}/salesforce/contacts/status", enabled: false },
  ],
  hubspot: [
    { id: "sync-contacts", name: t("integrations.detail.providers.hubspot.actions.sync-contacts.name"), description: t("integrations.detail.providers.hubspot.actions.sync-contacts.description"), type: "sync", endpoint: "/api/integrations/{id}/hubspot/contacts/sync", enabled: true },
    { id: "sync-deals", name: t("integrations.detail.providers.hubspot.actions.sync-deals.name"), description: t("integrations.detail.providers.hubspot.actions.sync-deals.description"), type: "sync", endpoint: "/api/integrations/{id}/hubspot/deals/sync", enabled: false },
    { id: "create-engagement", name: t("integrations.detail.providers.hubspot.actions.create-engagement.name"), description: t("integrations.detail.providers.hubspot.actions.create-engagement.description"), type: "action", endpoint: "/api/integrations/{id}/hubspot/engagements/create", enabled: true },
    { id: "push-call-notes", name: t("integrations.detail.providers.hubspot.actions.push-call-notes.name"), description: t("integrations.detail.providers.hubspot.actions.push-call-notes.description"), type: "action", endpoint: "/api/integrations/{id}/hubspot/notes/push", enabled: false },
  ],
  zoho: [
    { id: "sync-contacts", name: t("integrations.detail.providers.zoho.actions.sync-contacts.name"), description: t("integrations.detail.providers.zoho.actions.sync-contacts.description"), type: "sync", endpoint: "/api/integrations/{id}/zoho/contacts/sync", enabled: true },
    { id: "sync-leads", name: t("integrations.detail.providers.zoho.actions.sync-leads.name"), description: t("integrations.detail.providers.zoho.actions.sync-leads.description"), type: "sync", endpoint: "/api/integrations/{id}/zoho/leads/sync", enabled: true },
    { id: "push-call-log", name: t("integrations.detail.providers.zoho.actions.push-call-log.name"), description: t("integrations.detail.providers.zoho.actions.push-call-log.description"), type: "action", endpoint: "/api/integrations/{id}/zoho/calls/push", enabled: false },
    { id: "update-lead-status", name: t("integrations.detail.providers.zoho.actions.update-lead-status.name"), description: t("integrations.detail.providers.zoho.actions.update-lead-status.description"), type: "action", endpoint: "/api/integrations/{id}/zoho/leads/status", enabled: false },
  ],
  "google-sheets": [
    { id: "export-call-data", name: t("integrations.detail.providers.google-sheets.actions.export-call-data.name"), description: t("integrations.detail.providers.google-sheets.actions.export-call-data.description"), type: "action", endpoint: "/api/integrations/{id}/gsheets/calls/export", enabled: true },
    { id: "read-contact-list", name: t("integrations.detail.providers.google-sheets.actions.read-contact-list.name"), description: t("integrations.detail.providers.google-sheets.actions.read-contact-list.description"), type: "sync", endpoint: "/api/integrations/{id}/gsheets/contacts/read", enabled: true },
    { id: "sync-campaign-results", name: t("integrations.detail.providers.google-sheets.actions.sync-campaign-results.name"), description: t("integrations.detail.providers.google-sheets.actions.sync-campaign-results.description"), type: "sync", endpoint: "/api/integrations/{id}/gsheets/campaigns/sync", enabled: false },
  ],
  pipedrive: [
    { id: "sync-contacts", name: t("integrations.detail.providers.pipedrive.actions.sync-contacts.name"), description: t("integrations.detail.providers.pipedrive.actions.sync-contacts.description"), type: "sync", endpoint: "/api/integrations/{id}/pipedrive/persons/sync", enabled: true },
    { id: "sync-deals", name: t("integrations.detail.providers.pipedrive.actions.sync-deals.name"), description: t("integrations.detail.providers.pipedrive.actions.sync-deals.description"), type: "sync", endpoint: "/api/integrations/{id}/pipedrive/deals/sync", enabled: false },
    { id: "create-activity", name: t("integrations.detail.providers.pipedrive.actions.create-activity.name"), description: t("integrations.detail.providers.pipedrive.actions.create-activity.description"), type: "action", endpoint: "/api/integrations/{id}/pipedrive/activities/create", enabled: true },
    { id: "push-call-outcome", name: t("integrations.detail.providers.pipedrive.actions.push-call-outcome.name"), description: t("integrations.detail.providers.pipedrive.actions.push-call-outcome.description"), type: "action", endpoint: "/api/integrations/{id}/pipedrive/deals/outcome", enabled: false },
  ],
  dynamics365: [
    { id: "sync-contacts", name: t("integrations.detail.providers.dynamics365.actions.sync-contacts.name"), description: t("integrations.detail.providers.dynamics365.actions.sync-contacts.description"), type: "sync", endpoint: "/api/integrations/{id}/dynamics/contacts/sync", enabled: true },
    { id: "sync-leads", name: t("integrations.detail.providers.dynamics365.actions.sync-leads.name"), description: t("integrations.detail.providers.dynamics365.actions.sync-leads.description"), type: "sync", endpoint: "/api/integrations/{id}/dynamics/leads/sync", enabled: true },
    { id: "create-phone-call", name: t("integrations.detail.providers.dynamics365.actions.create-phone-call.name"), description: t("integrations.detail.providers.dynamics365.actions.create-phone-call.description"), type: "action", endpoint: "/api/integrations/{id}/dynamics/phonecalls/create", enabled: false },
    { id: "update-lead-qualification", name: t("integrations.detail.providers.dynamics365.actions.update-lead-qualification.name"), description: t("integrations.detail.providers.dynamics365.actions.update-lead-qualification.description"), type: "action", endpoint: "/api/integrations/{id}/dynamics/leads/qualify", enabled: false },
  ],
  "monday-com": [
    { id: "sync-board-items", name: t("integrations.detail.providers.monday-com.actions.sync-board-items.name"), description: t("integrations.detail.providers.monday-com.actions.sync-board-items.description"), type: "sync", endpoint: "/api/integrations/{id}/monday/items/sync", enabled: true },
    { id: "update-item-status", name: t("integrations.detail.providers.monday-com.actions.update-item-status.name"), description: t("integrations.detail.providers.monday-com.actions.update-item-status.description"), type: "action", endpoint: "/api/integrations/{id}/monday/items/status", enabled: false },
    { id: "push-call-summary", name: t("integrations.detail.providers.monday-com.actions.push-call-summary.name"), description: t("integrations.detail.providers.monday-com.actions.push-call-summary.description"), type: "action", endpoint: "/api/integrations/{id}/monday/items/summary", enabled: false },
  ],
  airtable: [
    { id: "sync-records", name: t("integrations.detail.providers.airtable.actions.sync-records.name"), description: t("integrations.detail.providers.airtable.actions.sync-records.description"), type: "sync", endpoint: "/api/integrations/{id}/airtable/records/sync", enabled: true },
    { id: "export-call-data", name: t("integrations.detail.providers.airtable.actions.export-call-data.name"), description: t("integrations.detail.providers.airtable.actions.export-call-data.description"), type: "action", endpoint: "/api/integrations/{id}/airtable/calls/export", enabled: false },
    { id: "update-record-status", name: t("integrations.detail.providers.airtable.actions.update-record-status.name"), description: t("integrations.detail.providers.airtable.actions.update-record-status.description"), type: "action", endpoint: "/api/integrations/{id}/airtable/records/status", enabled: false },
  ],
  slack: [
    { id: "send-call-notification", name: t("integrations.detail.providers.slack.actions.send-call-notification.name"), description: t("integrations.detail.providers.slack.actions.send-call-notification.description"), type: "action", endpoint: "/api/integrations/{id}/slack/notifications/call", enabled: true },
    { id: "send-campaign-summary", name: t("integrations.detail.providers.slack.actions.send-campaign-summary.name"), description: t("integrations.detail.providers.slack.actions.send-campaign-summary.description"), type: "action", endpoint: "/api/integrations/{id}/slack/notifications/campaign", enabled: false },
    { id: "send-alert", name: t("integrations.detail.providers.slack.actions.send-alert.name"), description: t("integrations.detail.providers.slack.actions.send-alert.description"), type: "action", endpoint: "/api/integrations/{id}/slack/alerts/send", enabled: false },
  ],
  mailchimp: [
    { id: "sync-audience", name: t("integrations.detail.providers.mailchimp.actions.sync-audience.name"), description: t("integrations.detail.providers.mailchimp.actions.sync-audience.description"), type: "sync", endpoint: "/api/integrations/{id}/mailchimp/audience/sync", enabled: true },
    { id: "update-tags", name: t("integrations.detail.providers.mailchimp.actions.update-tags.name"), description: t("integrations.detail.providers.mailchimp.actions.update-tags.description"), type: "action", endpoint: "/api/integrations/{id}/mailchimp/tags/update", enabled: false },
    { id: "push-campaign-results", name: t("integrations.detail.providers.mailchimp.actions.push-campaign-results.name"), description: t("integrations.detail.providers.mailchimp.actions.push-campaign-results.description"), type: "action", endpoint: "/api/integrations/{id}/mailchimp/campaigns/push", enabled: false },
  ],
  intercom: [
    { id: "sync-contacts", name: t("integrations.detail.providers.intercom.actions.sync-contacts.name"), description: t("integrations.detail.providers.intercom.actions.sync-contacts.description"), type: "sync", endpoint: "/api/integrations/{id}/intercom/contacts/sync", enabled: true },
    { id: "create-conversation-note", name: t("integrations.detail.providers.intercom.actions.create-conversation-note.name"), description: t("integrations.detail.providers.intercom.actions.create-conversation-note.description"), type: "action", endpoint: "/api/integrations/{id}/intercom/notes/create", enabled: false },
    { id: "update-contact-attributes", name: t("integrations.detail.providers.intercom.actions.update-contact-attributes.name"), description: t("integrations.detail.providers.intercom.actions.update-contact-attributes.description"), type: "action", endpoint: "/api/integrations/{id}/intercom/contacts/attributes", enabled: false },
  ],
  freshsales: [
    { id: "sync-contacts", name: t("integrations.detail.providers.freshsales.actions.sync-contacts.name"), description: t("integrations.detail.providers.freshsales.actions.sync-contacts.description"), type: "sync", endpoint: "/api/integrations/{id}/freshsales/contacts/sync", enabled: true },
    { id: "sync-leads", name: t("integrations.detail.providers.freshsales.actions.sync-leads.name"), description: t("integrations.detail.providers.freshsales.actions.sync-leads.description"), type: "sync", endpoint: "/api/integrations/{id}/freshsales/leads/sync", enabled: true },
    { id: "log-call-activity", name: t("integrations.detail.providers.freshsales.actions.log-call-activity.name"), description: t("integrations.detail.providers.freshsales.actions.log-call-activity.description"), type: "action", endpoint: "/api/integrations/{id}/freshsales/calls/log", enabled: false },
    { id: "update-lead-score", name: t("integrations.detail.providers.freshsales.actions.update-lead-score.name"), description: t("integrations.detail.providers.freshsales.actions.update-lead-score.description"), type: "action", endpoint: "/api/integrations/{id}/freshsales/leads/score", enabled: false },
  ],
  twilio: [
    { id: "check-number", name: t("integrations.detail.providers.twilio.actions.check-number.name"), description: t("integrations.detail.providers.twilio.actions.check-number.description"), type: "sync", endpoint: "/api/integrations/{id}/twilio/numbers/check", enabled: true },
    { id: "send-sms", name: t("integrations.detail.providers.twilio.actions.send-sms.name"), description: t("integrations.detail.providers.twilio.actions.send-sms.description"), type: "action", endpoint: "/api/integrations/{id}/twilio/sms/send", enabled: false },
  ],
  openai: [
    { id: "generate-summary", name: t("integrations.detail.providers.openai.actions.generate-summary.name"), description: t("integrations.detail.providers.openai.actions.generate-summary.description"), type: "action", endpoint: "/api/integrations/{id}/openai/summary/generate", enabled: true },
    { id: "sentiment-analysis", name: t("integrations.detail.providers.openai.actions.sentiment-analysis.name"), description: t("integrations.detail.providers.openai.actions.sentiment-analysis.description"), type: "action", endpoint: "/api/integrations/{id}/openai/sentiment/analyze", enabled: false },
  ],
  zendesk: [
    { id: "create-ticket", name: t("integrations.detail.providers.zendesk.actions.create-ticket.name"), description: t("integrations.detail.providers.zendesk.actions.create-ticket.description"), type: "action", endpoint: "/api/integrations/{id}/zendesk/tickets/create", enabled: true },
    { id: "update-ticket", name: t("integrations.detail.providers.zendesk.actions.update-ticket.name"), description: t("integrations.detail.providers.zendesk.actions.update-ticket.description"), type: "action", endpoint: "/api/integrations/{id}/zendesk/tickets/update", enabled: false },
  ],
  freshdesk: [
    { id: "create-ticket", name: t("integrations.detail.providers.freshdesk.actions.create-ticket.name"), description: t("integrations.detail.providers.freshdesk.actions.create-ticket.description"), type: "action", endpoint: "/api/integrations/{id}/freshdesk/tickets/create", enabled: true },
    { id: "sync-contacts", name: t("integrations.detail.providers.freshdesk.actions.sync-contacts.name"), description: t("integrations.detail.providers.freshdesk.actions.sync-contacts.description"), type: "sync", endpoint: "/api/integrations/{id}/freshdesk/contacts/sync", enabled: true },
  ],
  "google-calendar": [
    { id: "create-event", name: t("integrations.detail.providers.google-calendar.actions.create-event.name"), description: t("integrations.detail.providers.google-calendar.actions.create-event.description"), type: "action", endpoint: "/api/integrations/{id}/gcalendar/events/create", enabled: true },
    { id: "check-availability", name: t("integrations.detail.providers.google-calendar.actions.check-availability.name"), description: t("integrations.detail.providers.google-calendar.actions.check-availability.description"), type: "sync", endpoint: "/api/integrations/{id}/gcalendar/availability/check", enabled: true },
  ],
  calendly: [
    { id: "create-scheduling-link", name: t("integrations.detail.providers.calendly.actions.create-scheduling-link.name"), description: t("integrations.detail.providers.calendly.actions.create-scheduling-link.description"), type: "action", endpoint: "/api/integrations/{id}/calendly/links/create", enabled: true },
    { id: "check-availability", name: t("integrations.detail.providers.calendly.actions.check-availability.name"), description: t("integrations.detail.providers.calendly.actions.check-availability.description"), type: "sync", endpoint: "/api/integrations/{id}/calendly/availability/check", enabled: true },
  ],
  stripe: [
    { id: "lookup-customer", name: t("integrations.detail.providers.stripe.actions.lookup-customer.name"), description: t("integrations.detail.providers.stripe.actions.lookup-customer.description"), type: "sync", endpoint: "/api/integrations/{id}/stripe/customers/lookup", enabled: true },
    { id: "create-invoice", name: t("integrations.detail.providers.stripe.actions.create-invoice.name"), description: t("integrations.detail.providers.stripe.actions.create-invoice.description"), type: "action", endpoint: "/api/integrations/{id}/stripe/invoices/create", enabled: false },
  ],
  telegram: [
    { id: "send-notification", name: t("integrations.detail.providers.telegram.actions.send-notification.name"), description: t("integrations.detail.providers.telegram.actions.send-notification.description"), type: "action", endpoint: "/api/integrations/{id}/telegram/messages/send", enabled: true },
    { id: "send-report", name: t("integrations.detail.providers.telegram.actions.send-report.name"), description: t("integrations.detail.providers.telegram.actions.send-report.description"), type: "action", endpoint: "/api/integrations/{id}/telegram/reports/send", enabled: false },
  ],
  whatsapp: [
    { id: "send-followup", name: t("integrations.detail.providers.whatsapp.actions.send-followup.name"), description: t("integrations.detail.providers.whatsapp.actions.send-followup.description"), type: "action", endpoint: "/api/integrations/{id}/whatsapp/messages/send", enabled: true },
    { id: "send-template", name: t("integrations.detail.providers.whatsapp.actions.send-template.name"), description: t("integrations.detail.providers.whatsapp.actions.send-template.description"), type: "action", endpoint: "/api/integrations/{id}/whatsapp/templates/send", enabled: false },
  ],
  discord: [
    { id: "send-notification", name: t("integrations.detail.providers.discord.actions.send-notification.name"), description: t("integrations.detail.providers.discord.actions.send-notification.description"), type: "action", endpoint: "/api/integrations/{id}/discord/messages/send", enabled: true },
  ],
  zapier: [
    { id: "trigger-webhook", name: t("integrations.detail.providers.zapier.actions.trigger-webhook.name"), description: t("integrations.detail.providers.zapier.actions.trigger-webhook.description"), type: "action", endpoint: "/api/integrations/{id}/zapier/webhook/trigger", enabled: true },
  ],
  notion: [
    { id: "create-page", name: t("integrations.detail.providers.notion.actions.create-page.name"), description: t("integrations.detail.providers.notion.actions.create-page.description"), type: "action", endpoint: "/api/integrations/{id}/notion/pages/create", enabled: true },
    { id: "update-database", name: t("integrations.detail.providers.notion.actions.update-database.name"), description: t("integrations.detail.providers.notion.actions.update-database.description"), type: "action", endpoint: "/api/integrations/{id}/notion/database/update", enabled: true },
  ],
  "microsoft-teams": [
    { id: "send-notification", name: t("integrations.detail.providers.microsoft-teams.actions.send-notification.name"), description: t("integrations.detail.providers.microsoft-teams.actions.send-notification.description"), type: "action", endpoint: "/api/integrations/{id}/teams/messages/send", enabled: true },
  ],
  activecampaign: [
    { id: "add-contact", name: t("integrations.detail.providers.activecampaign.actions.add-contact.name"), description: t("integrations.detail.providers.activecampaign.actions.add-contact.description"), type: "action", endpoint: "/api/integrations/{id}/activecampaign/contacts/add", enabled: true },
    { id: "add-tag", name: t("integrations.detail.providers.activecampaign.actions.add-tag.name"), description: t("integrations.detail.providers.activecampaign.actions.add-tag.description"), type: "action", endpoint: "/api/integrations/{id}/activecampaign/tags/add", enabled: false },
  ],
  shopify: [
    { id: "lookup-order", name: t("integrations.detail.providers.shopify.actions.lookup-order.name"), description: t("integrations.detail.providers.shopify.actions.lookup-order.description"), type: "sync", endpoint: "/api/integrations/{id}/shopify/orders/lookup", enabled: true },
    { id: "lookup-product", name: t("integrations.detail.providers.shopify.actions.lookup-product.name"), description: t("integrations.detail.providers.shopify.actions.lookup-product.description"), type: "sync", endpoint: "/api/integrations/{id}/shopify/products/lookup", enabled: true },
  ],
  };
}


interface SetupStep {
  key: string;
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

function getProviderUseCases(t: (key: string) => string): Record<string, ProviderUseCase[]> {
  return {
  salesforce: [
    { id: "sf-log-calls", title: t("integrations.detail.providers.salesforce.useCases.sf-log-calls.title"), description: t("integrations.detail.providers.salesforce.useCases.sf-log-calls.description"), category: "CRM", n8nTemplateName: t("integrations.detail.providers.salesforce.useCases.sf-log-calls.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.salesforce.useCases.sf-log-calls.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.salesforce.useCases.sf-log-calls.expectedOutcome") },
    { id: "sf-create-leads", title: t("integrations.detail.providers.salesforce.useCases.sf-create-leads.title"), description: t("integrations.detail.providers.salesforce.useCases.sf-create-leads.description"), category: "CRM", n8nTemplateName: t("integrations.detail.providers.salesforce.useCases.sf-create-leads.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.salesforce.useCases.sf-create-leads.n8nTemplateDescription"), triggerEvent: "call.new_caller", expectedOutcome: t("integrations.detail.providers.salesforce.useCases.sf-create-leads.expectedOutcome") },
    { id: "sf-sync-contacts", title: t("integrations.detail.providers.salesforce.useCases.sf-sync-contacts.title"), description: t("integrations.detail.providers.salesforce.useCases.sf-sync-contacts.description"), category: "CRM", n8nTemplateName: t("integrations.detail.providers.salesforce.useCases.sf-sync-contacts.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.salesforce.useCases.sf-sync-contacts.n8nTemplateDescription"), triggerEvent: "call.analyzed", expectedOutcome: t("integrations.detail.providers.salesforce.useCases.sf-sync-contacts.expectedOutcome") },
    { id: "sf-update-opps", title: t("integrations.detail.providers.salesforce.useCases.sf-update-opps.title"), description: t("integrations.detail.providers.salesforce.useCases.sf-update-opps.description"), category: "CRM", n8nTemplateName: t("integrations.detail.providers.salesforce.useCases.sf-update-opps.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.salesforce.useCases.sf-update-opps.n8nTemplateDescription"), triggerEvent: "call.outcome_determined", expectedOutcome: t("integrations.detail.providers.salesforce.useCases.sf-update-opps.expectedOutcome") },
  ],
  hubspot: [
    { id: "hs-create-deals", title: t("integrations.detail.providers.hubspot.useCases.hs-create-deals.title"), description: t("integrations.detail.providers.hubspot.useCases.hs-create-deals.description"), category: "CRM", n8nTemplateName: t("integrations.detail.providers.hubspot.useCases.hs-create-deals.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.hubspot.useCases.hs-create-deals.n8nTemplateDescription"), triggerEvent: "call.qualified", expectedOutcome: t("integrations.detail.providers.hubspot.useCases.hs-create-deals.expectedOutcome") },
    { id: "hs-push-notes", title: t("integrations.detail.providers.hubspot.useCases.hs-push-notes.title"), description: t("integrations.detail.providers.hubspot.useCases.hs-push-notes.description"), category: "CRM", n8nTemplateName: t("integrations.detail.providers.hubspot.useCases.hs-push-notes.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.hubspot.useCases.hs-push-notes.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.hubspot.useCases.hs-push-notes.expectedOutcome") },
    { id: "hs-sync-contacts", title: t("integrations.detail.providers.hubspot.useCases.hs-sync-contacts.title"), description: t("integrations.detail.providers.hubspot.useCases.hs-sync-contacts.description"), category: "CRM", n8nTemplateName: t("integrations.detail.providers.hubspot.useCases.hs-sync-contacts.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.hubspot.useCases.hs-sync-contacts.n8nTemplateDescription"), triggerEvent: "contact.updated", expectedOutcome: t("integrations.detail.providers.hubspot.useCases.hs-sync-contacts.expectedOutcome") },
    { id: "hs-followup", title: t("integrations.detail.providers.hubspot.useCases.hs-followup.title"), description: t("integrations.detail.providers.hubspot.useCases.hs-followup.description"), category: "CRM", n8nTemplateName: t("integrations.detail.providers.hubspot.useCases.hs-followup.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.hubspot.useCases.hs-followup.n8nTemplateDescription"), triggerEvent: "call.followup_needed", expectedOutcome: t("integrations.detail.providers.hubspot.useCases.hs-followup.expectedOutcome") },
  ],
  zoho: [
    { id: "zoho-log-calls", title: t("integrations.detail.providers.zoho.useCases.zoho-log-calls.title"), description: t("integrations.detail.providers.zoho.useCases.zoho-log-calls.description"), category: "CRM", n8nTemplateName: t("integrations.detail.providers.zoho.useCases.zoho-log-calls.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.zoho.useCases.zoho-log-calls.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.zoho.useCases.zoho-log-calls.expectedOutcome") },
    { id: "zoho-sync-leads", title: t("integrations.detail.providers.zoho.useCases.zoho-sync-leads.title"), description: t("integrations.detail.providers.zoho.useCases.zoho-sync-leads.description"), category: "CRM", n8nTemplateName: t("integrations.detail.providers.zoho.useCases.zoho-sync-leads.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.zoho.useCases.zoho-sync-leads.n8nTemplateDescription"), triggerEvent: "call.analyzed", expectedOutcome: t("integrations.detail.providers.zoho.useCases.zoho-sync-leads.expectedOutcome") },
    { id: "zoho-update-deals", title: t("integrations.detail.providers.zoho.useCases.zoho-update-deals.title"), description: t("integrations.detail.providers.zoho.useCases.zoho-update-deals.description"), category: "CRM", n8nTemplateName: t("integrations.detail.providers.zoho.useCases.zoho-update-deals.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.zoho.useCases.zoho-update-deals.n8nTemplateDescription"), triggerEvent: "call.outcome_determined", expectedOutcome: t("integrations.detail.providers.zoho.useCases.zoho-update-deals.expectedOutcome") },
    { id: "zoho-create-tasks", title: t("integrations.detail.providers.zoho.useCases.zoho-create-tasks.title"), description: t("integrations.detail.providers.zoho.useCases.zoho-create-tasks.description"), category: "CRM", n8nTemplateName: t("integrations.detail.providers.zoho.useCases.zoho-create-tasks.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.zoho.useCases.zoho-create-tasks.n8nTemplateDescription"), triggerEvent: "call.action_items", expectedOutcome: t("integrations.detail.providers.zoho.useCases.zoho-create-tasks.expectedOutcome") },
  ],
  pipedrive: [
    { id: "pd-create-activities", title: t("integrations.detail.providers.pipedrive.useCases.pd-create-activities.title"), description: t("integrations.detail.providers.pipedrive.useCases.pd-create-activities.description"), category: "CRM", n8nTemplateName: t("integrations.detail.providers.pipedrive.useCases.pd-create-activities.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.pipedrive.useCases.pd-create-activities.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.pipedrive.useCases.pd-create-activities.expectedOutcome") },
    { id: "pd-update-deals", title: t("integrations.detail.providers.pipedrive.useCases.pd-update-deals.title"), description: t("integrations.detail.providers.pipedrive.useCases.pd-update-deals.description"), category: "CRM", n8nTemplateName: t("integrations.detail.providers.pipedrive.useCases.pd-update-deals.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.pipedrive.useCases.pd-update-deals.n8nTemplateDescription"), triggerEvent: "call.outcome_determined", expectedOutcome: t("integrations.detail.providers.pipedrive.useCases.pd-update-deals.expectedOutcome") },
    { id: "pd-sync-persons", title: t("integrations.detail.providers.pipedrive.useCases.pd-sync-persons.title"), description: t("integrations.detail.providers.pipedrive.useCases.pd-sync-persons.description"), category: "CRM", n8nTemplateName: t("integrations.detail.providers.pipedrive.useCases.pd-sync-persons.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.pipedrive.useCases.pd-sync-persons.n8nTemplateDescription"), triggerEvent: "contact.updated", expectedOutcome: t("integrations.detail.providers.pipedrive.useCases.pd-sync-persons.expectedOutcome") },
    { id: "pd-push-outcomes", title: t("integrations.detail.providers.pipedrive.useCases.pd-push-outcomes.title"), description: t("integrations.detail.providers.pipedrive.useCases.pd-push-outcomes.description"), category: "CRM", n8nTemplateName: t("integrations.detail.providers.pipedrive.useCases.pd-push-outcomes.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.pipedrive.useCases.pd-push-outcomes.n8nTemplateDescription"), triggerEvent: "call.outcome_determined", expectedOutcome: t("integrations.detail.providers.pipedrive.useCases.pd-push-outcomes.expectedOutcome") },
  ],
  freshsales: [
    { id: "fs-log-outcomes", title: t("integrations.detail.providers.freshsales.useCases.fs-log-outcomes.title"), description: t("integrations.detail.providers.freshsales.useCases.fs-log-outcomes.description"), category: "CRM", n8nTemplateName: t("integrations.detail.providers.freshsales.useCases.fs-log-outcomes.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.freshsales.useCases.fs-log-outcomes.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.freshsales.useCases.fs-log-outcomes.expectedOutcome") },
    { id: "fs-update-scores", title: t("integrations.detail.providers.freshsales.useCases.fs-update-scores.title"), description: t("integrations.detail.providers.freshsales.useCases.fs-update-scores.description"), category: "CRM", n8nTemplateName: t("integrations.detail.providers.freshsales.useCases.fs-update-scores.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.freshsales.useCases.fs-update-scores.n8nTemplateDescription"), triggerEvent: "call.analyzed", expectedOutcome: t("integrations.detail.providers.freshsales.useCases.fs-update-scores.expectedOutcome") },
    { id: "fs-create-tasks", title: t("integrations.detail.providers.freshsales.useCases.fs-create-tasks.title"), description: t("integrations.detail.providers.freshsales.useCases.fs-create-tasks.description"), category: "CRM", n8nTemplateName: t("integrations.detail.providers.freshsales.useCases.fs-create-tasks.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.freshsales.useCases.fs-create-tasks.n8nTemplateDescription"), triggerEvent: "call.action_items", expectedOutcome: t("integrations.detail.providers.freshsales.useCases.fs-create-tasks.expectedOutcome") },
    { id: "fs-sync-contacts", title: t("integrations.detail.providers.freshsales.useCases.fs-sync-contacts.title"), description: t("integrations.detail.providers.freshsales.useCases.fs-sync-contacts.description"), category: "CRM", n8nTemplateName: t("integrations.detail.providers.freshsales.useCases.fs-sync-contacts.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.freshsales.useCases.fs-sync-contacts.n8nTemplateDescription"), triggerEvent: "contact.updated", expectedOutcome: t("integrations.detail.providers.freshsales.useCases.fs-sync-contacts.expectedOutcome") },
  ],
  dynamics365: [
    { id: "d365-create-calls", title: t("integrations.detail.providers.dynamics365.useCases.d365-create-calls.title"), description: t("integrations.detail.providers.dynamics365.useCases.d365-create-calls.description"), category: "CRM", n8nTemplateName: t("integrations.detail.providers.dynamics365.useCases.d365-create-calls.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.dynamics365.useCases.d365-create-calls.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.dynamics365.useCases.d365-create-calls.expectedOutcome") },
    { id: "d365-sync-leads", title: t("integrations.detail.providers.dynamics365.useCases.d365-sync-leads.title"), description: t("integrations.detail.providers.dynamics365.useCases.d365-sync-leads.description"), category: "CRM", n8nTemplateName: t("integrations.detail.providers.dynamics365.useCases.d365-sync-leads.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.dynamics365.useCases.d365-sync-leads.n8nTemplateDescription"), triggerEvent: "call.new_caller", expectedOutcome: t("integrations.detail.providers.dynamics365.useCases.d365-sync-leads.expectedOutcome") },
    { id: "d365-update-quals", title: t("integrations.detail.providers.dynamics365.useCases.d365-update-quals.title"), description: t("integrations.detail.providers.dynamics365.useCases.d365-update-quals.description"), category: "CRM", n8nTemplateName: t("integrations.detail.providers.dynamics365.useCases.d365-update-quals.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.dynamics365.useCases.d365-update-quals.n8nTemplateDescription"), triggerEvent: "call.qualified", expectedOutcome: t("integrations.detail.providers.dynamics365.useCases.d365-update-quals.expectedOutcome") },
    { id: "d365-log-outcomes", title: t("integrations.detail.providers.dynamics365.useCases.d365-log-outcomes.title"), description: t("integrations.detail.providers.dynamics365.useCases.d365-log-outcomes.description"), category: "CRM", n8nTemplateName: t("integrations.detail.providers.dynamics365.useCases.d365-log-outcomes.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.dynamics365.useCases.d365-log-outcomes.n8nTemplateDescription"), triggerEvent: "call.outcome_determined", expectedOutcome: t("integrations.detail.providers.dynamics365.useCases.d365-log-outcomes.expectedOutcome") },
  ],
  "close-crm": [
    { id: "close-log-calls", title: t("integrations.detail.providers.close-crm.useCases.close-log-calls.title"), description: t("integrations.detail.providers.close-crm.useCases.close-log-calls.description"), category: "CRM", n8nTemplateName: t("integrations.detail.providers.close-crm.useCases.close-log-calls.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.close-crm.useCases.close-log-calls.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.close-crm.useCases.close-log-calls.expectedOutcome") },
    { id: "close-update-leads", title: t("integrations.detail.providers.close-crm.useCases.close-update-leads.title"), description: t("integrations.detail.providers.close-crm.useCases.close-update-leads.description"), category: "CRM", n8nTemplateName: t("integrations.detail.providers.close-crm.useCases.close-update-leads.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.close-crm.useCases.close-update-leads.n8nTemplateDescription"), triggerEvent: "call.outcome_determined", expectedOutcome: t("integrations.detail.providers.close-crm.useCases.close-update-leads.expectedOutcome") },
    { id: "close-sync-contacts", title: t("integrations.detail.providers.close-crm.useCases.close-sync-contacts.title"), description: t("integrations.detail.providers.close-crm.useCases.close-sync-contacts.description"), category: "CRM", n8nTemplateName: t("integrations.detail.providers.close-crm.useCases.close-sync-contacts.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.close-crm.useCases.close-sync-contacts.n8nTemplateDescription"), triggerEvent: "contact.updated", expectedOutcome: t("integrations.detail.providers.close-crm.useCases.close-sync-contacts.expectedOutcome") },
    { id: "close-create-tasks", title: t("integrations.detail.providers.close-crm.useCases.close-create-tasks.title"), description: t("integrations.detail.providers.close-crm.useCases.close-create-tasks.description"), category: "CRM", n8nTemplateName: t("integrations.detail.providers.close-crm.useCases.close-create-tasks.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.close-crm.useCases.close-create-tasks.n8nTemplateDescription"), triggerEvent: "call.action_items", expectedOutcome: t("integrations.detail.providers.close-crm.useCases.close-create-tasks.expectedOutcome") },
  ],
  "copper-crm": [
    { id: "copper-push-summaries", title: t("integrations.detail.providers.copper-crm.useCases.copper-push-summaries.title"), description: t("integrations.detail.providers.copper-crm.useCases.copper-push-summaries.description"), category: "CRM", n8nTemplateName: t("integrations.detail.providers.copper-crm.useCases.copper-push-summaries.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.copper-crm.useCases.copper-push-summaries.n8nTemplateDescription"), triggerEvent: "call.summarized", expectedOutcome: t("integrations.detail.providers.copper-crm.useCases.copper-push-summaries.expectedOutcome") },
    { id: "copper-create-contacts", title: t("integrations.detail.providers.copper-crm.useCases.copper-create-contacts.title"), description: t("integrations.detail.providers.copper-crm.useCases.copper-create-contacts.description"), category: "CRM", n8nTemplateName: t("integrations.detail.providers.copper-crm.useCases.copper-create-contacts.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.copper-crm.useCases.copper-create-contacts.n8nTemplateDescription"), triggerEvent: "call.new_caller", expectedOutcome: t("integrations.detail.providers.copper-crm.useCases.copper-create-contacts.expectedOutcome") },
    { id: "copper-sync-activities", title: t("integrations.detail.providers.copper-crm.useCases.copper-sync-activities.title"), description: t("integrations.detail.providers.copper-crm.useCases.copper-sync-activities.description"), category: "CRM", n8nTemplateName: t("integrations.detail.providers.copper-crm.useCases.copper-sync-activities.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.copper-crm.useCases.copper-sync-activities.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.copper-crm.useCases.copper-sync-activities.expectedOutcome") },
    { id: "copper-update-opps", title: t("integrations.detail.providers.copper-crm.useCases.copper-update-opps.title"), description: t("integrations.detail.providers.copper-crm.useCases.copper-update-opps.description"), category: "CRM", n8nTemplateName: t("integrations.detail.providers.copper-crm.useCases.copper-update-opps.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.copper-crm.useCases.copper-update-opps.n8nTemplateDescription"), triggerEvent: "call.outcome_determined", expectedOutcome: t("integrations.detail.providers.copper-crm.useCases.copper-update-opps.expectedOutcome") },
  ],
  gohighlevel: [
    { id: "ghl-trigger-workflows", title: t("integrations.detail.providers.gohighlevel.useCases.ghl-trigger-workflows.title"), description: t("integrations.detail.providers.gohighlevel.useCases.ghl-trigger-workflows.description"), category: "CRM", n8nTemplateName: t("integrations.detail.providers.gohighlevel.useCases.ghl-trigger-workflows.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.gohighlevel.useCases.ghl-trigger-workflows.n8nTemplateDescription"), triggerEvent: "call.followup_needed", expectedOutcome: t("integrations.detail.providers.gohighlevel.useCases.ghl-trigger-workflows.expectedOutcome") },
    { id: "ghl-sync-contacts", title: t("integrations.detail.providers.gohighlevel.useCases.ghl-sync-contacts.title"), description: t("integrations.detail.providers.gohighlevel.useCases.ghl-sync-contacts.description"), category: "CRM", n8nTemplateName: t("integrations.detail.providers.gohighlevel.useCases.ghl-sync-contacts.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.gohighlevel.useCases.ghl-sync-contacts.n8nTemplateDescription"), triggerEvent: "contact.updated", expectedOutcome: t("integrations.detail.providers.gohighlevel.useCases.ghl-sync-contacts.expectedOutcome") },
    { id: "ghl-update-pipeline", title: t("integrations.detail.providers.gohighlevel.useCases.ghl-update-pipeline.title"), description: t("integrations.detail.providers.gohighlevel.useCases.ghl-update-pipeline.description"), category: "CRM", n8nTemplateName: t("integrations.detail.providers.gohighlevel.useCases.ghl-update-pipeline.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.gohighlevel.useCases.ghl-update-pipeline.n8nTemplateDescription"), triggerEvent: "call.outcome_determined", expectedOutcome: t("integrations.detail.providers.gohighlevel.useCases.ghl-update-pipeline.expectedOutcome") },
    { id: "ghl-send-sms", title: t("integrations.detail.providers.gohighlevel.useCases.ghl-send-sms.title"), description: t("integrations.detail.providers.gohighlevel.useCases.ghl-send-sms.description"), category: "CRM", n8nTemplateName: t("integrations.detail.providers.gohighlevel.useCases.ghl-send-sms.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.gohighlevel.useCases.ghl-send-sms.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.gohighlevel.useCases.ghl-send-sms.expectedOutcome") },
  ],
  keap: [
    { id: "keap-tag-leads", title: t("integrations.detail.providers.keap.useCases.keap-tag-leads.title"), description: t("integrations.detail.providers.keap.useCases.keap-tag-leads.description"), category: "CRM", n8nTemplateName: t("integrations.detail.providers.keap.useCases.keap-tag-leads.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.keap.useCases.keap-tag-leads.n8nTemplateDescription"), triggerEvent: "call.outcome_determined", expectedOutcome: t("integrations.detail.providers.keap.useCases.keap-tag-leads.expectedOutcome") },
    { id: "keap-create-contacts", title: t("integrations.detail.providers.keap.useCases.keap-create-contacts.title"), description: t("integrations.detail.providers.keap.useCases.keap-create-contacts.description"), category: "CRM", n8nTemplateName: t("integrations.detail.providers.keap.useCases.keap-create-contacts.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.keap.useCases.keap-create-contacts.n8nTemplateDescription"), triggerEvent: "call.new_caller", expectedOutcome: t("integrations.detail.providers.keap.useCases.keap-create-contacts.expectedOutcome") },
    { id: "keap-trigger-campaigns", title: t("integrations.detail.providers.keap.useCases.keap-trigger-campaigns.title"), description: t("integrations.detail.providers.keap.useCases.keap-trigger-campaigns.description"), category: "CRM", n8nTemplateName: t("integrations.detail.providers.keap.useCases.keap-trigger-campaigns.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.keap.useCases.keap-trigger-campaigns.n8nTemplateDescription"), triggerEvent: "call.qualified", expectedOutcome: t("integrations.detail.providers.keap.useCases.keap-trigger-campaigns.expectedOutcome") },
    { id: "keap-log-activities", title: t("integrations.detail.providers.keap.useCases.keap-log-activities.title"), description: t("integrations.detail.providers.keap.useCases.keap-log-activities.description"), category: "CRM", n8nTemplateName: t("integrations.detail.providers.keap.useCases.keap-log-activities.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.keap.useCases.keap-log-activities.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.keap.useCases.keap-log-activities.expectedOutcome") },
  ],
  sugarcrm: [
    { id: "sugar-log-calls", title: t("integrations.detail.providers.sugarcrm.useCases.sugar-log-calls.title"), description: t("integrations.detail.providers.sugarcrm.useCases.sugar-log-calls.description"), category: "CRM", n8nTemplateName: t("integrations.detail.providers.sugarcrm.useCases.sugar-log-calls.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.sugarcrm.useCases.sugar-log-calls.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.sugarcrm.useCases.sugar-log-calls.expectedOutcome") },
    { id: "sugar-sync-leads", title: t("integrations.detail.providers.sugarcrm.useCases.sugar-sync-leads.title"), description: t("integrations.detail.providers.sugarcrm.useCases.sugar-sync-leads.description"), category: "CRM", n8nTemplateName: t("integrations.detail.providers.sugarcrm.useCases.sugar-sync-leads.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.sugarcrm.useCases.sugar-sync-leads.n8nTemplateDescription"), triggerEvent: "call.new_caller", expectedOutcome: t("integrations.detail.providers.sugarcrm.useCases.sugar-sync-leads.expectedOutcome") },
    { id: "sugar-update-opps", title: t("integrations.detail.providers.sugarcrm.useCases.sugar-update-opps.title"), description: t("integrations.detail.providers.sugarcrm.useCases.sugar-update-opps.description"), category: "CRM", n8nTemplateName: t("integrations.detail.providers.sugarcrm.useCases.sugar-update-opps.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.sugarcrm.useCases.sugar-update-opps.n8nTemplateDescription"), triggerEvent: "call.outcome_determined", expectedOutcome: t("integrations.detail.providers.sugarcrm.useCases.sugar-update-opps.expectedOutcome") },
    { id: "sugar-create-tasks", title: t("integrations.detail.providers.sugarcrm.useCases.sugar-create-tasks.title"), description: t("integrations.detail.providers.sugarcrm.useCases.sugar-create-tasks.description"), category: "CRM", n8nTemplateName: t("integrations.detail.providers.sugarcrm.useCases.sugar-create-tasks.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.sugarcrm.useCases.sugar-create-tasks.n8nTemplateDescription"), triggerEvent: "call.action_items", expectedOutcome: t("integrations.detail.providers.sugarcrm.useCases.sugar-create-tasks.expectedOutcome") },
  ],
  bitrix24: [
    { id: "bitrix-push-calls", title: t("integrations.detail.providers.bitrix24.useCases.bitrix-push-calls.title"), description: t("integrations.detail.providers.bitrix24.useCases.bitrix-push-calls.description"), category: "CRM", n8nTemplateName: t("integrations.detail.providers.bitrix24.useCases.bitrix-push-calls.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.bitrix24.useCases.bitrix-push-calls.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.bitrix24.useCases.bitrix-push-calls.expectedOutcome") },
    { id: "bitrix-sync-leads", title: t("integrations.detail.providers.bitrix24.useCases.bitrix-sync-leads.title"), description: t("integrations.detail.providers.bitrix24.useCases.bitrix-sync-leads.description"), category: "CRM", n8nTemplateName: t("integrations.detail.providers.bitrix24.useCases.bitrix-sync-leads.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.bitrix24.useCases.bitrix-sync-leads.n8nTemplateDescription"), triggerEvent: "call.new_caller", expectedOutcome: t("integrations.detail.providers.bitrix24.useCases.bitrix-sync-leads.expectedOutcome") },
    { id: "bitrix-create-activities", title: t("integrations.detail.providers.bitrix24.useCases.bitrix-create-activities.title"), description: t("integrations.detail.providers.bitrix24.useCases.bitrix-create-activities.description"), category: "CRM", n8nTemplateName: t("integrations.detail.providers.bitrix24.useCases.bitrix-create-activities.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.bitrix24.useCases.bitrix-create-activities.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.bitrix24.useCases.bitrix-create-activities.expectedOutcome") },
    { id: "bitrix-update-deals", title: t("integrations.detail.providers.bitrix24.useCases.bitrix-update-deals.title"), description: t("integrations.detail.providers.bitrix24.useCases.bitrix-update-deals.description"), category: "CRM", n8nTemplateName: t("integrations.detail.providers.bitrix24.useCases.bitrix-update-deals.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.bitrix24.useCases.bitrix-update-deals.n8nTemplateDescription"), triggerEvent: "call.outcome_determined", expectedOutcome: t("integrations.detail.providers.bitrix24.useCases.bitrix-update-deals.expectedOutcome") },
  ],
  insightly: [
    { id: "insightly-create-leads", title: t("integrations.detail.providers.insightly.useCases.insightly-create-leads.title"), description: t("integrations.detail.providers.insightly.useCases.insightly-create-leads.description"), category: "CRM", n8nTemplateName: t("integrations.detail.providers.insightly.useCases.insightly-create-leads.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.insightly.useCases.insightly-create-leads.n8nTemplateDescription"), triggerEvent: "call.new_caller", expectedOutcome: t("integrations.detail.providers.insightly.useCases.insightly-create-leads.expectedOutcome") },
    { id: "insightly-log-notes", title: t("integrations.detail.providers.insightly.useCases.insightly-log-notes.title"), description: t("integrations.detail.providers.insightly.useCases.insightly-log-notes.description"), category: "CRM", n8nTemplateName: t("integrations.detail.providers.insightly.useCases.insightly-log-notes.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.insightly.useCases.insightly-log-notes.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.insightly.useCases.insightly-log-notes.expectedOutcome") },
    { id: "insightly-sync-contacts", title: t("integrations.detail.providers.insightly.useCases.insightly-sync-contacts.title"), description: t("integrations.detail.providers.insightly.useCases.insightly-sync-contacts.description"), category: "CRM", n8nTemplateName: t("integrations.detail.providers.insightly.useCases.insightly-sync-contacts.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.insightly.useCases.insightly-sync-contacts.n8nTemplateDescription"), triggerEvent: "contact.updated", expectedOutcome: t("integrations.detail.providers.insightly.useCases.insightly-sync-contacts.expectedOutcome") },
    { id: "insightly-update-pipelines", title: t("integrations.detail.providers.insightly.useCases.insightly-update-pipelines.title"), description: t("integrations.detail.providers.insightly.useCases.insightly-update-pipelines.description"), category: "CRM", n8nTemplateName: t("integrations.detail.providers.insightly.useCases.insightly-update-pipelines.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.insightly.useCases.insightly-update-pipelines.n8nTemplateDescription"), triggerEvent: "call.outcome_determined", expectedOutcome: t("integrations.detail.providers.insightly.useCases.insightly-update-pipelines.expectedOutcome") },
  ],
  twilio: [
    { id: "twilio-sms-followup", title: t("integrations.detail.providers.twilio.useCases.twilio-sms-followup.title"), description: t("integrations.detail.providers.twilio.useCases.twilio-sms-followup.description"), category: "Telephony", n8nTemplateName: t("integrations.detail.providers.twilio.useCases.twilio-sms-followup.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.twilio.useCases.twilio-sms-followup.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.twilio.useCases.twilio-sms-followup.expectedOutcome") },
    { id: "twilio-route-calls", title: t("integrations.detail.providers.twilio.useCases.twilio-route-calls.title"), description: t("integrations.detail.providers.twilio.useCases.twilio-route-calls.description"), category: "Telephony", n8nTemplateName: t("integrations.detail.providers.twilio.useCases.twilio-route-calls.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.twilio.useCases.twilio-route-calls.n8nTemplateDescription"), triggerEvent: "call.incoming", expectedOutcome: t("integrations.detail.providers.twilio.useCases.twilio-route-calls.expectedOutcome") },
    { id: "twilio-track-metrics", title: t("integrations.detail.providers.twilio.useCases.twilio-track-metrics.title"), description: t("integrations.detail.providers.twilio.useCases.twilio-track-metrics.description"), category: "Telephony", n8nTemplateName: t("integrations.detail.providers.twilio.useCases.twilio-track-metrics.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.twilio.useCases.twilio-track-metrics.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.twilio.useCases.twilio-track-metrics.expectedOutcome") },
    { id: "twilio-verify", title: t("integrations.detail.providers.twilio.useCases.twilio-verify.title"), description: t("integrations.detail.providers.twilio.useCases.twilio-verify.description"), category: "Telephony", n8nTemplateName: t("integrations.detail.providers.twilio.useCases.twilio-verify.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.twilio.useCases.twilio-verify.n8nTemplateDescription"), triggerEvent: "call.incoming", expectedOutcome: t("integrations.detail.providers.twilio.useCases.twilio-verify.expectedOutcome") },
  ],
  vonage: [
    { id: "vonage-sms", title: t("integrations.detail.providers.vonage.useCases.vonage-sms.title"), description: t("integrations.detail.providers.vonage.useCases.vonage-sms.description"), category: "Telephony", n8nTemplateName: t("integrations.detail.providers.vonage.useCases.vonage-sms.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.vonage.useCases.vonage-sms.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.vonage.useCases.vonage-sms.expectedOutcome") },
    { id: "vonage-quality", title: t("integrations.detail.providers.vonage.useCases.vonage-quality.title"), description: t("integrations.detail.providers.vonage.useCases.vonage-quality.description"), category: "Telephony", n8nTemplateName: t("integrations.detail.providers.vonage.useCases.vonage-quality.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.vonage.useCases.vonage-quality.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.vonage.useCases.vonage-quality.expectedOutcome") },
    { id: "vonage-route", title: t("integrations.detail.providers.vonage.useCases.vonage-route.title"), description: t("integrations.detail.providers.vonage.useCases.vonage-route.description"), category: "Telephony", n8nTemplateName: t("integrations.detail.providers.vonage.useCases.vonage-route.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.vonage.useCases.vonage-route.n8nTemplateDescription"), triggerEvent: "call.incoming", expectedOutcome: t("integrations.detail.providers.vonage.useCases.vonage-route.expectedOutcome") },
    { id: "vonage-lookup", title: t("integrations.detail.providers.vonage.useCases.vonage-lookup.title"), description: t("integrations.detail.providers.vonage.useCases.vonage-lookup.description"), category: "Telephony", n8nTemplateName: t("integrations.detail.providers.vonage.useCases.vonage-lookup.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.vonage.useCases.vonage-lookup.n8nTemplateDescription"), triggerEvent: "call.incoming", expectedOutcome: t("integrations.detail.providers.vonage.useCases.vonage-lookup.expectedOutcome") },
  ],
  bandwidth: [
    { id: "bw-sms", title: t("integrations.detail.providers.bandwidth.useCases.bw-sms.title"), description: t("integrations.detail.providers.bandwidth.useCases.bw-sms.description"), category: "Telephony", n8nTemplateName: t("integrations.detail.providers.bandwidth.useCases.bw-sms.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.bandwidth.useCases.bw-sms.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.bandwidth.useCases.bw-sms.expectedOutcome") },
    { id: "bw-tracking", title: t("integrations.detail.providers.bandwidth.useCases.bw-tracking.title"), description: t("integrations.detail.providers.bandwidth.useCases.bw-tracking.description"), category: "Telephony", n8nTemplateName: t("integrations.detail.providers.bandwidth.useCases.bw-tracking.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.bandwidth.useCases.bw-tracking.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.bandwidth.useCases.bw-tracking.expectedOutcome") },
    { id: "bw-numbers", title: t("integrations.detail.providers.bandwidth.useCases.bw-numbers.title"), description: t("integrations.detail.providers.bandwidth.useCases.bw-numbers.description"), category: "Telephony", n8nTemplateName: t("integrations.detail.providers.bandwidth.useCases.bw-numbers.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.bandwidth.useCases.bw-numbers.n8nTemplateDescription"), triggerEvent: "system.provision", expectedOutcome: t("integrations.detail.providers.bandwidth.useCases.bw-numbers.expectedOutcome") },
    { id: "bw-routing", title: t("integrations.detail.providers.bandwidth.useCases.bw-routing.title"), description: t("integrations.detail.providers.bandwidth.useCases.bw-routing.description"), category: "Telephony", n8nTemplateName: t("integrations.detail.providers.bandwidth.useCases.bw-routing.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.bandwidth.useCases.bw-routing.n8nTemplateDescription"), triggerEvent: "call.incoming", expectedOutcome: t("integrations.detail.providers.bandwidth.useCases.bw-routing.expectedOutcome") },
  ],
  telnyx: [
    { id: "telnyx-messaging", title: t("integrations.detail.providers.telnyx.useCases.telnyx-messaging.title"), description: t("integrations.detail.providers.telnyx.useCases.telnyx-messaging.description"), category: "Telephony", n8nTemplateName: t("integrations.detail.providers.telnyx.useCases.telnyx-messaging.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.telnyx.useCases.telnyx-messaging.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.telnyx.useCases.telnyx-messaging.expectedOutcome") },
    { id: "telnyx-analytics", title: t("integrations.detail.providers.telnyx.useCases.telnyx-analytics.title"), description: t("integrations.detail.providers.telnyx.useCases.telnyx-analytics.description"), category: "Telephony", n8nTemplateName: t("integrations.detail.providers.telnyx.useCases.telnyx-analytics.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.telnyx.useCases.telnyx-analytics.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.telnyx.useCases.telnyx-analytics.expectedOutcome") },
    { id: "telnyx-provision", title: t("integrations.detail.providers.telnyx.useCases.telnyx-provision.title"), description: t("integrations.detail.providers.telnyx.useCases.telnyx-provision.description"), category: "Telephony", n8nTemplateName: t("integrations.detail.providers.telnyx.useCases.telnyx-provision.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.telnyx.useCases.telnyx-provision.n8nTemplateDescription"), triggerEvent: "system.provision", expectedOutcome: t("integrations.detail.providers.telnyx.useCases.telnyx-provision.expectedOutcome") },
    { id: "telnyx-sip", title: t("integrations.detail.providers.telnyx.useCases.telnyx-sip.title"), description: t("integrations.detail.providers.telnyx.useCases.telnyx-sip.description"), category: "Telephony", n8nTemplateName: t("integrations.detail.providers.telnyx.useCases.telnyx-sip.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.telnyx.useCases.telnyx-sip.n8nTemplateDescription"), triggerEvent: "call.incoming", expectedOutcome: t("integrations.detail.providers.telnyx.useCases.telnyx-sip.expectedOutcome") },
  ],
  "amazon-connect": [
    { id: "ac-route-agents", title: t("integrations.detail.providers.amazon-connect.useCases.ac-route-agents.title"), description: t("integrations.detail.providers.amazon-connect.useCases.ac-route-agents.description"), category: "Telephony", n8nTemplateName: t("integrations.detail.providers.amazon-connect.useCases.ac-route-agents.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.amazon-connect.useCases.ac-route-agents.n8nTemplateDescription"), triggerEvent: "call.escalation", expectedOutcome: t("integrations.detail.providers.amazon-connect.useCases.ac-route-agents.expectedOutcome") },
    { id: "ac-track-metrics", title: t("integrations.detail.providers.amazon-connect.useCases.ac-track-metrics.title"), description: t("integrations.detail.providers.amazon-connect.useCases.ac-track-metrics.description"), category: "Telephony", n8nTemplateName: t("integrations.detail.providers.amazon-connect.useCases.ac-track-metrics.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.amazon-connect.useCases.ac-track-metrics.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.amazon-connect.useCases.ac-track-metrics.expectedOutcome") },
    { id: "ac-queue", title: t("integrations.detail.providers.amazon-connect.useCases.ac-queue.title"), description: t("integrations.detail.providers.amazon-connect.useCases.ac-queue.description"), category: "Telephony", n8nTemplateName: t("integrations.detail.providers.amazon-connect.useCases.ac-queue.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.amazon-connect.useCases.ac-queue.n8nTemplateDescription"), triggerEvent: "call.incoming", expectedOutcome: t("integrations.detail.providers.amazon-connect.useCases.ac-queue.expectedOutcome") },
    { id: "ac-surveys", title: t("integrations.detail.providers.amazon-connect.useCases.ac-surveys.title"), description: t("integrations.detail.providers.amazon-connect.useCases.ac-surveys.description"), category: "Telephony", n8nTemplateName: t("integrations.detail.providers.amazon-connect.useCases.ac-surveys.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.amazon-connect.useCases.ac-surveys.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.amazon-connect.useCases.ac-surveys.expectedOutcome") },
  ],
  openai: [
    { id: "oai-summaries", title: t("integrations.detail.providers.openai.useCases.oai-summaries.title"), description: t("integrations.detail.providers.openai.useCases.oai-summaries.description"), category: "AI & LLM", n8nTemplateName: t("integrations.detail.providers.openai.useCases.oai-summaries.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.openai.useCases.oai-summaries.n8nTemplateDescription"), triggerEvent: "call.transcribed", expectedOutcome: t("integrations.detail.providers.openai.useCases.oai-summaries.expectedOutcome") },
    { id: "oai-sentiment", title: t("integrations.detail.providers.openai.useCases.oai-sentiment.title"), description: t("integrations.detail.providers.openai.useCases.oai-sentiment.description"), category: "AI & LLM", n8nTemplateName: t("integrations.detail.providers.openai.useCases.oai-sentiment.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.openai.useCases.oai-sentiment.n8nTemplateDescription"), triggerEvent: "call.transcribed", expectedOutcome: t("integrations.detail.providers.openai.useCases.oai-sentiment.expectedOutcome") },
    { id: "oai-action-items", title: t("integrations.detail.providers.openai.useCases.oai-action-items.title"), description: t("integrations.detail.providers.openai.useCases.oai-action-items.description"), category: "AI & LLM", n8nTemplateName: t("integrations.detail.providers.openai.useCases.oai-action-items.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.openai.useCases.oai-action-items.n8nTemplateDescription"), triggerEvent: "call.transcribed", expectedOutcome: t("integrations.detail.providers.openai.useCases.oai-action-items.expectedOutcome") },
    { id: "oai-classify", title: t("integrations.detail.providers.openai.useCases.oai-classify.title"), description: t("integrations.detail.providers.openai.useCases.oai-classify.description"), category: "AI & LLM", n8nTemplateName: t("integrations.detail.providers.openai.useCases.oai-classify.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.openai.useCases.oai-classify.n8nTemplateDescription"), triggerEvent: "call.transcribed", expectedOutcome: t("integrations.detail.providers.openai.useCases.oai-classify.expectedOutcome") },
  ],
  anthropic: [
    { id: "anth-summarize", title: t("integrations.detail.providers.anthropic.useCases.anth-summarize.title"), description: t("integrations.detail.providers.anthropic.useCases.anth-summarize.description"), category: "AI & LLM", n8nTemplateName: t("integrations.detail.providers.anthropic.useCases.anth-summarize.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.anthropic.useCases.anth-summarize.n8nTemplateDescription"), triggerEvent: "call.transcribed", expectedOutcome: t("integrations.detail.providers.anthropic.useCases.anth-summarize.expectedOutcome") },
    { id: "anth-intent", title: t("integrations.detail.providers.anthropic.useCases.anth-intent.title"), description: t("integrations.detail.providers.anthropic.useCases.anth-intent.description"), category: "AI & LLM", n8nTemplateName: t("integrations.detail.providers.anthropic.useCases.anth-intent.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.anthropic.useCases.anth-intent.n8nTemplateDescription"), triggerEvent: "call.transcribed", expectedOutcome: t("integrations.detail.providers.anthropic.useCases.anth-intent.expectedOutcome") },
    { id: "anth-emails", title: t("integrations.detail.providers.anthropic.useCases.anth-emails.title"), description: t("integrations.detail.providers.anthropic.useCases.anth-emails.description"), category: "AI & LLM", n8nTemplateName: t("integrations.detail.providers.anthropic.useCases.anth-emails.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.anthropic.useCases.anth-emails.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.anthropic.useCases.anth-emails.expectedOutcome") },
    { id: "anth-quality", title: t("integrations.detail.providers.anthropic.useCases.anth-quality.title"), description: t("integrations.detail.providers.anthropic.useCases.anth-quality.description"), category: "AI & LLM", n8nTemplateName: t("integrations.detail.providers.anthropic.useCases.anth-quality.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.anthropic.useCases.anth-quality.n8nTemplateDescription"), triggerEvent: "call.transcribed", expectedOutcome: t("integrations.detail.providers.anthropic.useCases.anth-quality.expectedOutcome") },
  ],
  "google-gemini": [
    { id: "gemini-transcript", title: t("integrations.detail.providers.google-gemini.useCases.gemini-transcript.title"), description: t("integrations.detail.providers.google-gemini.useCases.gemini-transcript.description"), category: "AI & LLM", n8nTemplateName: t("integrations.detail.providers.google-gemini.useCases.gemini-transcript.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.google-gemini.useCases.gemini-transcript.n8nTemplateDescription"), triggerEvent: "call.transcribed", expectedOutcome: t("integrations.detail.providers.google-gemini.useCases.gemini-transcript.expectedOutcome") },
    { id: "gemini-multilang", title: t("integrations.detail.providers.google-gemini.useCases.gemini-multilang.title"), description: t("integrations.detail.providers.google-gemini.useCases.gemini-multilang.description"), category: "AI & LLM", n8nTemplateName: t("integrations.detail.providers.google-gemini.useCases.gemini-multilang.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.google-gemini.useCases.gemini-multilang.n8nTemplateDescription"), triggerEvent: "call.transcribed", expectedOutcome: t("integrations.detail.providers.google-gemini.useCases.gemini-multilang.expectedOutcome") },
    { id: "gemini-intent", title: t("integrations.detail.providers.google-gemini.useCases.gemini-intent.title"), description: t("integrations.detail.providers.google-gemini.useCases.gemini-intent.description"), category: "AI & LLM", n8nTemplateName: t("integrations.detail.providers.google-gemini.useCases.gemini-intent.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.google-gemini.useCases.gemini-intent.n8nTemplateDescription"), triggerEvent: "call.transcribed", expectedOutcome: t("integrations.detail.providers.google-gemini.useCases.gemini-intent.expectedOutcome") },
    { id: "gemini-knowledge", title: t("integrations.detail.providers.google-gemini.useCases.gemini-knowledge.title"), description: t("integrations.detail.providers.google-gemini.useCases.gemini-knowledge.description"), category: "AI & LLM", n8nTemplateName: t("integrations.detail.providers.google-gemini.useCases.gemini-knowledge.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.google-gemini.useCases.gemini-knowledge.n8nTemplateDescription"), triggerEvent: "call.incoming", expectedOutcome: t("integrations.detail.providers.google-gemini.useCases.gemini-knowledge.expectedOutcome") },
  ],
  mistral: [
    { id: "mistral-summarize", title: t("integrations.detail.providers.mistral.useCases.mistral-summarize.title"), description: t("integrations.detail.providers.mistral.useCases.mistral-summarize.description"), category: "AI & LLM", n8nTemplateName: t("integrations.detail.providers.mistral.useCases.mistral-summarize.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.mistral.useCases.mistral-summarize.n8nTemplateDescription"), triggerEvent: "call.transcribed", expectedOutcome: t("integrations.detail.providers.mistral.useCases.mistral-summarize.expectedOutcome") },
    { id: "mistral-topics", title: t("integrations.detail.providers.mistral.useCases.mistral-topics.title"), description: t("integrations.detail.providers.mistral.useCases.mistral-topics.description"), category: "AI & LLM", n8nTemplateName: t("integrations.detail.providers.mistral.useCases.mistral-topics.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.mistral.useCases.mistral-topics.n8nTemplateDescription"), triggerEvent: "call.transcribed", expectedOutcome: t("integrations.detail.providers.mistral.useCases.mistral-topics.expectedOutcome") },
    { id: "mistral-sentiment", title: t("integrations.detail.providers.mistral.useCases.mistral-sentiment.title"), description: t("integrations.detail.providers.mistral.useCases.mistral-sentiment.description"), category: "AI & LLM", n8nTemplateName: t("integrations.detail.providers.mistral.useCases.mistral-sentiment.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.mistral.useCases.mistral-sentiment.n8nTemplateDescription"), triggerEvent: "call.transcribed", expectedOutcome: t("integrations.detail.providers.mistral.useCases.mistral-sentiment.expectedOutcome") },
    { id: "mistral-suggestions", title: t("integrations.detail.providers.mistral.useCases.mistral-suggestions.title"), description: t("integrations.detail.providers.mistral.useCases.mistral-suggestions.description"), category: "AI & LLM", n8nTemplateName: t("integrations.detail.providers.mistral.useCases.mistral-suggestions.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.mistral.useCases.mistral-suggestions.n8nTemplateDescription"), triggerEvent: "call.active", expectedOutcome: t("integrations.detail.providers.mistral.useCases.mistral-suggestions.expectedOutcome") },
  ],
  groq: [
    { id: "groq-realtime", title: t("integrations.detail.providers.groq.useCases.groq-realtime.title"), description: t("integrations.detail.providers.groq.useCases.groq-realtime.description"), category: "AI & LLM", n8nTemplateName: t("integrations.detail.providers.groq.useCases.groq-realtime.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.groq.useCases.groq-realtime.n8nTemplateDescription"), triggerEvent: "call.active", expectedOutcome: t("integrations.detail.providers.groq.useCases.groq-realtime.expectedOutcome") },
    { id: "groq-sentiment", title: t("integrations.detail.providers.groq.useCases.groq-sentiment.title"), description: t("integrations.detail.providers.groq.useCases.groq-sentiment.description"), category: "AI & LLM", n8nTemplateName: t("integrations.detail.providers.groq.useCases.groq-sentiment.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.groq.useCases.groq-sentiment.n8nTemplateDescription"), triggerEvent: "call.transcribed", expectedOutcome: t("integrations.detail.providers.groq.useCases.groq-sentiment.expectedOutcome") },
    { id: "groq-classify", title: t("integrations.detail.providers.groq.useCases.groq-classify.title"), description: t("integrations.detail.providers.groq.useCases.groq-classify.description"), category: "AI & LLM", n8nTemplateName: t("integrations.detail.providers.groq.useCases.groq-classify.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.groq.useCases.groq-classify.n8nTemplateDescription"), triggerEvent: "call.transcribed", expectedOutcome: t("integrations.detail.providers.groq.useCases.groq-classify.expectedOutcome") },
    { id: "groq-summarize", title: t("integrations.detail.providers.groq.useCases.groq-summarize.title"), description: t("integrations.detail.providers.groq.useCases.groq-summarize.description"), category: "AI & LLM", n8nTemplateName: t("integrations.detail.providers.groq.useCases.groq-summarize.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.groq.useCases.groq-summarize.n8nTemplateDescription"), triggerEvent: "call.transcribed", expectedOutcome: t("integrations.detail.providers.groq.useCases.groq-summarize.expectedOutcome") },
  ],
  cohere: [
    { id: "cohere-search", title: t("integrations.detail.providers.cohere.useCases.cohere-search.title"), description: t("integrations.detail.providers.cohere.useCases.cohere-search.description"), category: "AI & LLM", n8nTemplateName: t("integrations.detail.providers.cohere.useCases.cohere-search.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.cohere.useCases.cohere-search.n8nTemplateDescription"), triggerEvent: "search.query", expectedOutcome: t("integrations.detail.providers.cohere.useCases.cohere-search.expectedOutcome") },
    { id: "cohere-cluster", title: t("integrations.detail.providers.cohere.useCases.cohere-cluster.title"), description: t("integrations.detail.providers.cohere.useCases.cohere-cluster.description"), category: "AI & LLM", n8nTemplateName: t("integrations.detail.providers.cohere.useCases.cohere-cluster.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.cohere.useCases.cohere-cluster.n8nTemplateDescription"), triggerEvent: "call.transcribed", expectedOutcome: t("integrations.detail.providers.cohere.useCases.cohere-cluster.expectedOutcome") },
    { id: "cohere-summarize", title: t("integrations.detail.providers.cohere.useCases.cohere-summarize.title"), description: t("integrations.detail.providers.cohere.useCases.cohere-summarize.description"), category: "AI & LLM", n8nTemplateName: t("integrations.detail.providers.cohere.useCases.cohere-summarize.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.cohere.useCases.cohere-summarize.n8nTemplateDescription"), triggerEvent: "call.transcribed", expectedOutcome: t("integrations.detail.providers.cohere.useCases.cohere-summarize.expectedOutcome") },
    { id: "cohere-classify", title: t("integrations.detail.providers.cohere.useCases.cohere-classify.title"), description: t("integrations.detail.providers.cohere.useCases.cohere-classify.description"), category: "AI & LLM", n8nTemplateName: t("integrations.detail.providers.cohere.useCases.cohere-classify.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.cohere.useCases.cohere-classify.n8nTemplateDescription"), triggerEvent: "call.transcribed", expectedOutcome: t("integrations.detail.providers.cohere.useCases.cohere-classify.expectedOutcome") },
  ],
  perplexity: [
    { id: "pplx-research", title: t("integrations.detail.providers.perplexity.useCases.pplx-research.title"), description: t("integrations.detail.providers.perplexity.useCases.pplx-research.description"), category: "AI & LLM", n8nTemplateName: t("integrations.detail.providers.perplexity.useCases.pplx-research.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.perplexity.useCases.pplx-research.n8nTemplateDescription"), triggerEvent: "call.incoming", expectedOutcome: t("integrations.detail.providers.perplexity.useCases.pplx-research.expectedOutcome") },
    { id: "pplx-insights", title: t("integrations.detail.providers.perplexity.useCases.pplx-insights.title"), description: t("integrations.detail.providers.perplexity.useCases.pplx-insights.description"), category: "AI & LLM", n8nTemplateName: t("integrations.detail.providers.perplexity.useCases.pplx-insights.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.perplexity.useCases.pplx-insights.n8nTemplateDescription"), triggerEvent: "call.active", expectedOutcome: t("integrations.detail.providers.perplexity.useCases.pplx-insights.expectedOutcome") },
    { id: "pplx-competitive", title: t("integrations.detail.providers.perplexity.useCases.pplx-competitive.title"), description: t("integrations.detail.providers.perplexity.useCases.pplx-competitive.description"), category: "AI & LLM", n8nTemplateName: t("integrations.detail.providers.perplexity.useCases.pplx-competitive.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.perplexity.useCases.pplx-competitive.n8nTemplateDescription"), triggerEvent: "call.active", expectedOutcome: t("integrations.detail.providers.perplexity.useCases.pplx-competitive.expectedOutcome") },
    { id: "pplx-factcheck", title: t("integrations.detail.providers.perplexity.useCases.pplx-factcheck.title"), description: t("integrations.detail.providers.perplexity.useCases.pplx-factcheck.description"), category: "AI & LLM", n8nTemplateName: t("integrations.detail.providers.perplexity.useCases.pplx-factcheck.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.perplexity.useCases.pplx-factcheck.n8nTemplateDescription"), triggerEvent: "call.active", expectedOutcome: t("integrations.detail.providers.perplexity.useCases.pplx-factcheck.expectedOutcome") },
  ],
  elevenlabs: [
    { id: "el-clone-voice", title: t("integrations.detail.providers.elevenlabs.useCases.el-clone-voice.title"), description: t("integrations.detail.providers.elevenlabs.useCases.el-clone-voice.description"), category: "Voice & Speech", n8nTemplateName: t("integrations.detail.providers.elevenlabs.useCases.el-clone-voice.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.elevenlabs.useCases.el-clone-voice.n8nTemplateDescription"), triggerEvent: "voice.setup", expectedOutcome: t("integrations.detail.providers.elevenlabs.useCases.el-clone-voice.expectedOutcome") },
    { id: "el-multilang", title: t("integrations.detail.providers.elevenlabs.useCases.el-multilang.title"), description: t("integrations.detail.providers.elevenlabs.useCases.el-multilang.description"), category: "Voice & Speech", n8nTemplateName: t("integrations.detail.providers.elevenlabs.useCases.el-multilang.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.elevenlabs.useCases.el-multilang.n8nTemplateDescription"), triggerEvent: "call.tts_request", expectedOutcome: t("integrations.detail.providers.elevenlabs.useCases.el-multilang.expectedOutcome") },
    { id: "el-quality", title: t("integrations.detail.providers.elevenlabs.useCases.el-quality.title"), description: t("integrations.detail.providers.elevenlabs.useCases.el-quality.description"), category: "Voice & Speech", n8nTemplateName: t("integrations.detail.providers.elevenlabs.useCases.el-quality.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.elevenlabs.useCases.el-quality.n8nTemplateDescription"), triggerEvent: "voice.optimize", expectedOutcome: t("integrations.detail.providers.elevenlabs.useCases.el-quality.expectedOutcome") },
    { id: "el-pronunciations", title: t("integrations.detail.providers.elevenlabs.useCases.el-pronunciations.title"), description: t("integrations.detail.providers.elevenlabs.useCases.el-pronunciations.description"), category: "Voice & Speech", n8nTemplateName: t("integrations.detail.providers.elevenlabs.useCases.el-pronunciations.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.elevenlabs.useCases.el-pronunciations.n8nTemplateDescription"), triggerEvent: "voice.setup", expectedOutcome: t("integrations.detail.providers.elevenlabs.useCases.el-pronunciations.expectedOutcome") },
  ],
  deepgram: [
    { id: "dg-realtime", title: t("integrations.detail.providers.deepgram.useCases.dg-realtime.title"), description: t("integrations.detail.providers.deepgram.useCases.dg-realtime.description"), category: "Voice & Speech", n8nTemplateName: t("integrations.detail.providers.deepgram.useCases.dg-realtime.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.deepgram.useCases.dg-realtime.n8nTemplateDescription"), triggerEvent: "call.active", expectedOutcome: t("integrations.detail.providers.deepgram.useCases.dg-realtime.expectedOutcome") },
    { id: "dg-diarization", title: t("integrations.detail.providers.deepgram.useCases.dg-diarization.title"), description: t("integrations.detail.providers.deepgram.useCases.dg-diarization.description"), category: "Voice & Speech", n8nTemplateName: t("integrations.detail.providers.deepgram.useCases.dg-diarization.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.deepgram.useCases.dg-diarization.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.deepgram.useCases.dg-diarization.expectedOutcome") },
    { id: "dg-keywords", title: t("integrations.detail.providers.deepgram.useCases.dg-keywords.title"), description: t("integrations.detail.providers.deepgram.useCases.dg-keywords.description"), category: "Voice & Speech", n8nTemplateName: t("integrations.detail.providers.deepgram.useCases.dg-keywords.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.deepgram.useCases.dg-keywords.n8nTemplateDescription"), triggerEvent: "call.active", expectedOutcome: t("integrations.detail.providers.deepgram.useCases.dg-keywords.expectedOutcome") },
    { id: "dg-sentiment", title: t("integrations.detail.providers.deepgram.useCases.dg-sentiment.title"), description: t("integrations.detail.providers.deepgram.useCases.dg-sentiment.description"), category: "Voice & Speech", n8nTemplateName: t("integrations.detail.providers.deepgram.useCases.dg-sentiment.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.deepgram.useCases.dg-sentiment.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.deepgram.useCases.dg-sentiment.expectedOutcome") },
  ],
  "google-cloud-tts": [
    { id: "gctts-multilang", title: t("integrations.detail.providers.google-cloud-tts.useCases.gctts-multilang.title"), description: t("integrations.detail.providers.google-cloud-tts.useCases.gctts-multilang.description"), category: "Voice & Speech", n8nTemplateName: t("integrations.detail.providers.google-cloud-tts.useCases.gctts-multilang.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.google-cloud-tts.useCases.gctts-multilang.n8nTemplateDescription"), triggerEvent: "call.tts_request", expectedOutcome: t("integrations.detail.providers.google-cloud-tts.useCases.gctts-multilang.expectedOutcome") },
    { id: "gctts-profiles", title: t("integrations.detail.providers.google-cloud-tts.useCases.gctts-profiles.title"), description: t("integrations.detail.providers.google-cloud-tts.useCases.gctts-profiles.description"), category: "Voice & Speech", n8nTemplateName: t("integrations.detail.providers.google-cloud-tts.useCases.gctts-profiles.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.google-cloud-tts.useCases.gctts-profiles.n8nTemplateDescription"), triggerEvent: "voice.setup", expectedOutcome: t("integrations.detail.providers.google-cloud-tts.useCases.gctts-profiles.expectedOutcome") },
    { id: "gctts-ssml", title: t("integrations.detail.providers.google-cloud-tts.useCases.gctts-ssml.title"), description: t("integrations.detail.providers.google-cloud-tts.useCases.gctts-ssml.description"), category: "Voice & Speech", n8nTemplateName: t("integrations.detail.providers.google-cloud-tts.useCases.gctts-ssml.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.google-cloud-tts.useCases.gctts-ssml.n8nTemplateDescription"), triggerEvent: "call.tts_request", expectedOutcome: t("integrations.detail.providers.google-cloud-tts.useCases.gctts-ssml.expectedOutcome") },
    { id: "gctts-adapt", title: t("integrations.detail.providers.google-cloud-tts.useCases.gctts-adapt.title"), description: t("integrations.detail.providers.google-cloud-tts.useCases.gctts-adapt.description"), category: "Voice & Speech", n8nTemplateName: t("integrations.detail.providers.google-cloud-tts.useCases.gctts-adapt.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.google-cloud-tts.useCases.gctts-adapt.n8nTemplateDescription"), triggerEvent: "voice.optimize", expectedOutcome: t("integrations.detail.providers.google-cloud-tts.useCases.gctts-adapt.expectedOutcome") },
  ],
  "amazon-polly": [
    { id: "polly-prompts", title: t("integrations.detail.providers.amazon-polly.useCases.polly-prompts.title"), description: t("integrations.detail.providers.amazon-polly.useCases.polly-prompts.description"), category: "Voice & Speech", n8nTemplateName: t("integrations.detail.providers.amazon-polly.useCases.polly-prompts.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.amazon-polly.useCases.polly-prompts.n8nTemplateDescription"), triggerEvent: "call.tts_request", expectedOutcome: t("integrations.detail.providers.amazon-polly.useCases.polly-prompts.expectedOutcome") },
    { id: "polly-multilang", title: t("integrations.detail.providers.amazon-polly.useCases.polly-multilang.title"), description: t("integrations.detail.providers.amazon-polly.useCases.polly-multilang.description"), category: "Voice & Speech", n8nTemplateName: t("integrations.detail.providers.amazon-polly.useCases.polly-multilang.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.amazon-polly.useCases.polly-multilang.n8nTemplateDescription"), triggerEvent: "call.tts_request", expectedOutcome: t("integrations.detail.providers.amazon-polly.useCases.polly-multilang.expectedOutcome") },
    { id: "polly-neural", title: t("integrations.detail.providers.amazon-polly.useCases.polly-neural.title"), description: t("integrations.detail.providers.amazon-polly.useCases.polly-neural.description"), category: "Voice & Speech", n8nTemplateName: t("integrations.detail.providers.amazon-polly.useCases.polly-neural.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.amazon-polly.useCases.polly-neural.n8nTemplateDescription"), triggerEvent: "call.tts_request", expectedOutcome: t("integrations.detail.providers.amazon-polly.useCases.polly-neural.expectedOutcome") },
    { id: "polly-lexicons", title: t("integrations.detail.providers.amazon-polly.useCases.polly-lexicons.title"), description: t("integrations.detail.providers.amazon-polly.useCases.polly-lexicons.description"), category: "Voice & Speech", n8nTemplateName: t("integrations.detail.providers.amazon-polly.useCases.polly-lexicons.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.amazon-polly.useCases.polly-lexicons.n8nTemplateDescription"), triggerEvent: "voice.setup", expectedOutcome: t("integrations.detail.providers.amazon-polly.useCases.polly-lexicons.expectedOutcome") },
  ],
  "azure-speech": [
    { id: "azure-neural", title: t("integrations.detail.providers.azure-speech.useCases.azure-neural.title"), description: t("integrations.detail.providers.azure-speech.useCases.azure-neural.description"), category: "Voice & Speech", n8nTemplateName: t("integrations.detail.providers.azure-speech.useCases.azure-neural.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.azure-speech.useCases.azure-neural.n8nTemplateDescription"), triggerEvent: "voice.setup", expectedOutcome: t("integrations.detail.providers.azure-speech.useCases.azure-neural.expectedOutcome") },
    { id: "azure-translate", title: t("integrations.detail.providers.azure-speech.useCases.azure-translate.title"), description: t("integrations.detail.providers.azure-speech.useCases.azure-translate.description"), category: "Voice & Speech", n8nTemplateName: t("integrations.detail.providers.azure-speech.useCases.azure-translate.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.azure-speech.useCases.azure-translate.n8nTemplateDescription"), triggerEvent: "call.active", expectedOutcome: t("integrations.detail.providers.azure-speech.useCases.azure-translate.expectedOutcome") },
    { id: "azure-pronunciation", title: t("integrations.detail.providers.azure-speech.useCases.azure-pronunciation.title"), description: t("integrations.detail.providers.azure-speech.useCases.azure-pronunciation.description"), category: "Voice & Speech", n8nTemplateName: t("integrations.detail.providers.azure-speech.useCases.azure-pronunciation.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.azure-speech.useCases.azure-pronunciation.n8nTemplateDescription"), triggerEvent: "voice.setup", expectedOutcome: t("integrations.detail.providers.azure-speech.useCases.azure-pronunciation.expectedOutcome") },
    { id: "azure-profiles", title: t("integrations.detail.providers.azure-speech.useCases.azure-profiles.title"), description: t("integrations.detail.providers.azure-speech.useCases.azure-profiles.description"), category: "Voice & Speech", n8nTemplateName: t("integrations.detail.providers.azure-speech.useCases.azure-profiles.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.azure-speech.useCases.azure-profiles.n8nTemplateDescription"), triggerEvent: "voice.setup", expectedOutcome: t("integrations.detail.providers.azure-speech.useCases.azure-profiles.expectedOutcome") },
  ],
  playht: [
    { id: "playht-realistic", title: t("integrations.detail.providers.playht.useCases.playht-realistic.title"), description: t("integrations.detail.providers.playht.useCases.playht-realistic.description"), category: "Voice & Speech", n8nTemplateName: t("integrations.detail.providers.playht.useCases.playht-realistic.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.playht.useCases.playht-realistic.n8nTemplateDescription"), triggerEvent: "call.tts_request", expectedOutcome: t("integrations.detail.providers.playht.useCases.playht-realistic.expectedOutcome") },
    { id: "playht-clone", title: t("integrations.detail.providers.playht.useCases.playht-clone.title"), description: t("integrations.detail.providers.playht.useCases.playht-clone.description"), category: "Voice & Speech", n8nTemplateName: t("integrations.detail.providers.playht.useCases.playht-clone.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.playht.useCases.playht-clone.n8nTemplateDescription"), triggerEvent: "voice.setup", expectedOutcome: t("integrations.detail.providers.playht.useCases.playht-clone.expectedOutcome") },
    { id: "playht-emotion", title: t("integrations.detail.providers.playht.useCases.playht-emotion.title"), description: t("integrations.detail.providers.playht.useCases.playht-emotion.description"), category: "Voice & Speech", n8nTemplateName: t("integrations.detail.providers.playht.useCases.playht-emotion.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.playht.useCases.playht-emotion.n8nTemplateDescription"), triggerEvent: "call.tts_request", expectedOutcome: t("integrations.detail.providers.playht.useCases.playht-emotion.expectedOutcome") },
    { id: "playht-accents", title: t("integrations.detail.providers.playht.useCases.playht-accents.title"), description: t("integrations.detail.providers.playht.useCases.playht-accents.description"), category: "Voice & Speech", n8nTemplateName: t("integrations.detail.providers.playht.useCases.playht-accents.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.playht.useCases.playht-accents.n8nTemplateDescription"), triggerEvent: "voice.setup", expectedOutcome: t("integrations.detail.providers.playht.useCases.playht-accents.expectedOutcome") },
  ],
  murf: [
    { id: "murf-voiceovers", title: t("integrations.detail.providers.murf.useCases.murf-voiceovers.title"), description: t("integrations.detail.providers.murf.useCases.murf-voiceovers.description"), category: "Voice & Speech", n8nTemplateName: t("integrations.detail.providers.murf.useCases.murf-voiceovers.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.murf.useCases.murf-voiceovers.n8nTemplateDescription"), triggerEvent: "call.tts_request", expectedOutcome: t("integrations.detail.providers.murf.useCases.murf-voiceovers.expectedOutcome") },
    { id: "murf-brand", title: t("integrations.detail.providers.murf.useCases.murf-brand.title"), description: t("integrations.detail.providers.murf.useCases.murf-brand.description"), category: "Voice & Speech", n8nTemplateName: t("integrations.detail.providers.murf.useCases.murf-brand.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.murf.useCases.murf-brand.n8nTemplateDescription"), triggerEvent: "voice.setup", expectedOutcome: t("integrations.detail.providers.murf.useCases.murf-brand.expectedOutcome") },
    { id: "murf-script", title: t("integrations.detail.providers.murf.useCases.murf-script.title"), description: t("integrations.detail.providers.murf.useCases.murf-script.description"), category: "Voice & Speech", n8nTemplateName: t("integrations.detail.providers.murf.useCases.murf-script.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.murf.useCases.murf-script.n8nTemplateDescription"), triggerEvent: "call.tts_request", expectedOutcome: t("integrations.detail.providers.murf.useCases.murf-script.expectedOutcome") },
    { id: "murf-pronunciation", title: t("integrations.detail.providers.murf.useCases.murf-pronunciation.title"), description: t("integrations.detail.providers.murf.useCases.murf-pronunciation.description"), category: "Voice & Speech", n8nTemplateName: t("integrations.detail.providers.murf.useCases.murf-pronunciation.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.murf.useCases.murf-pronunciation.n8nTemplateDescription"), triggerEvent: "voice.setup", expectedOutcome: t("integrations.detail.providers.murf.useCases.murf-pronunciation.expectedOutcome") },
  ],
  slack: [
    { id: "slack-summaries", title: t("integrations.detail.providers.slack.useCases.slack-summaries.title"), description: t("integrations.detail.providers.slack.useCases.slack-summaries.description"), category: "Communication", n8nTemplateName: t("integrations.detail.providers.slack.useCases.slack-summaries.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.slack.useCases.slack-summaries.n8nTemplateDescription"), triggerEvent: "call.summarized", expectedOutcome: t("integrations.detail.providers.slack.useCases.slack-summaries.expectedOutcome") },
    { id: "slack-alerts", title: t("integrations.detail.providers.slack.useCases.slack-alerts.title"), description: t("integrations.detail.providers.slack.useCases.slack-alerts.description"), category: "Communication", n8nTemplateName: t("integrations.detail.providers.slack.useCases.slack-alerts.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.slack.useCases.slack-alerts.n8nTemplateDescription"), triggerEvent: "call.escalation", expectedOutcome: t("integrations.detail.providers.slack.useCases.slack-alerts.expectedOutcome") },
    { id: "slack-reports", title: t("integrations.detail.providers.slack.useCases.slack-reports.title"), description: t("integrations.detail.providers.slack.useCases.slack-reports.description"), category: "Communication", n8nTemplateName: t("integrations.detail.providers.slack.useCases.slack-reports.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.slack.useCases.slack-reports.n8nTemplateDescription"), triggerEvent: "report.daily", expectedOutcome: t("integrations.detail.providers.slack.useCases.slack-reports.expectedOutcome") },
    { id: "slack-realtime", title: t("integrations.detail.providers.slack.useCases.slack-realtime.title"), description: t("integrations.detail.providers.slack.useCases.slack-realtime.description"), category: "Communication", n8nTemplateName: t("integrations.detail.providers.slack.useCases.slack-realtime.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.slack.useCases.slack-realtime.n8nTemplateDescription"), triggerEvent: "call.started", expectedOutcome: t("integrations.detail.providers.slack.useCases.slack-realtime.expectedOutcome") },
  ],
  "microsoft-teams": [
    { id: "teams-outcomes", title: t("integrations.detail.providers.microsoft-teams.useCases.teams-outcomes.title"), description: t("integrations.detail.providers.microsoft-teams.useCases.teams-outcomes.description"), category: "Communication", n8nTemplateName: t("integrations.detail.providers.microsoft-teams.useCases.teams-outcomes.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.microsoft-teams.useCases.teams-outcomes.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.microsoft-teams.useCases.teams-outcomes.expectedOutcome") },
    { id: "teams-alerts", title: t("integrations.detail.providers.microsoft-teams.useCases.teams-alerts.title"), description: t("integrations.detail.providers.microsoft-teams.useCases.teams-alerts.description"), category: "Communication", n8nTemplateName: t("integrations.detail.providers.microsoft-teams.useCases.teams-alerts.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.microsoft-teams.useCases.teams-alerts.n8nTemplateDescription"), triggerEvent: "campaign.alert", expectedOutcome: t("integrations.detail.providers.microsoft-teams.useCases.teams-alerts.expectedOutcome") },
    { id: "teams-notifications", title: t("integrations.detail.providers.microsoft-teams.useCases.teams-notifications.title"), description: t("integrations.detail.providers.microsoft-teams.useCases.teams-notifications.description"), category: "Communication", n8nTemplateName: t("integrations.detail.providers.microsoft-teams.useCases.teams-notifications.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.microsoft-teams.useCases.teams-notifications.n8nTemplateDescription"), triggerEvent: "call.important", expectedOutcome: t("integrations.detail.providers.microsoft-teams.useCases.teams-notifications.expectedOutcome") },
    { id: "teams-followups", title: t("integrations.detail.providers.microsoft-teams.useCases.teams-followups.title"), description: t("integrations.detail.providers.microsoft-teams.useCases.teams-followups.description"), category: "Communication", n8nTemplateName: t("integrations.detail.providers.microsoft-teams.useCases.teams-followups.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.microsoft-teams.useCases.teams-followups.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.microsoft-teams.useCases.teams-followups.expectedOutcome") },
  ],
  telegram: [
    { id: "tg-alerts", title: t("integrations.detail.providers.telegram.useCases.tg-alerts.title"), description: t("integrations.detail.providers.telegram.useCases.tg-alerts.description"), category: "Communication", n8nTemplateName: t("integrations.detail.providers.telegram.useCases.tg-alerts.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.telegram.useCases.tg-alerts.n8nTemplateDescription"), triggerEvent: "call.started", expectedOutcome: t("integrations.detail.providers.telegram.useCases.tg-alerts.expectedOutcome") },
    { id: "tg-status", title: t("integrations.detail.providers.telegram.useCases.tg-status.title"), description: t("integrations.detail.providers.telegram.useCases.tg-status.description"), category: "Communication", n8nTemplateName: t("integrations.detail.providers.telegram.useCases.tg-status.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.telegram.useCases.tg-status.n8nTemplateDescription"), triggerEvent: "campaign.update", expectedOutcome: t("integrations.detail.providers.telegram.useCases.tg-status.expectedOutcome") },
    { id: "tg-leads", title: t("integrations.detail.providers.telegram.useCases.tg-leads.title"), description: t("integrations.detail.providers.telegram.useCases.tg-leads.description"), category: "Communication", n8nTemplateName: t("integrations.detail.providers.telegram.useCases.tg-leads.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.telegram.useCases.tg-leads.n8nTemplateDescription"), triggerEvent: "lead.created", expectedOutcome: t("integrations.detail.providers.telegram.useCases.tg-leads.expectedOutcome") },
    { id: "tg-reports", title: t("integrations.detail.providers.telegram.useCases.tg-reports.title"), description: t("integrations.detail.providers.telegram.useCases.tg-reports.description"), category: "Communication", n8nTemplateName: t("integrations.detail.providers.telegram.useCases.tg-reports.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.telegram.useCases.tg-reports.n8nTemplateDescription"), triggerEvent: "report.daily", expectedOutcome: t("integrations.detail.providers.telegram.useCases.tg-reports.expectedOutcome") },
  ],
  whatsapp: [
    { id: "wa-followup", title: t("integrations.detail.providers.whatsapp.useCases.wa-followup.title"), description: t("integrations.detail.providers.whatsapp.useCases.wa-followup.description"), category: "Communication", n8nTemplateName: t("integrations.detail.providers.whatsapp.useCases.wa-followup.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.whatsapp.useCases.wa-followup.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.whatsapp.useCases.wa-followup.expectedOutcome") },
    { id: "wa-recordings", title: t("integrations.detail.providers.whatsapp.useCases.wa-recordings.title"), description: t("integrations.detail.providers.whatsapp.useCases.wa-recordings.description"), category: "Communication", n8nTemplateName: t("integrations.detail.providers.whatsapp.useCases.wa-recordings.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.whatsapp.useCases.wa-recordings.n8nTemplateDescription"), triggerEvent: "call.recorded", expectedOutcome: t("integrations.detail.providers.whatsapp.useCases.wa-recordings.expectedOutcome") },
    { id: "wa-appointments", title: t("integrations.detail.providers.whatsapp.useCases.wa-appointments.title"), description: t("integrations.detail.providers.whatsapp.useCases.wa-appointments.description"), category: "Communication", n8nTemplateName: t("integrations.detail.providers.whatsapp.useCases.wa-appointments.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.whatsapp.useCases.wa-appointments.n8nTemplateDescription"), triggerEvent: "appointment.booked", expectedOutcome: t("integrations.detail.providers.whatsapp.useCases.wa-appointments.expectedOutcome") },
    { id: "wa-nurture", title: t("integrations.detail.providers.whatsapp.useCases.wa-nurture.title"), description: t("integrations.detail.providers.whatsapp.useCases.wa-nurture.description"), category: "Communication", n8nTemplateName: t("integrations.detail.providers.whatsapp.useCases.wa-nurture.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.whatsapp.useCases.wa-nurture.n8nTemplateDescription"), triggerEvent: "lead.nurture", expectedOutcome: t("integrations.detail.providers.whatsapp.useCases.wa-nurture.expectedOutcome") },
  ],
  discord: [
    { id: "discord-updates", title: t("integrations.detail.providers.discord.useCases.discord-updates.title"), description: t("integrations.detail.providers.discord.useCases.discord-updates.description"), category: "Communication", n8nTemplateName: t("integrations.detail.providers.discord.useCases.discord-updates.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.discord.useCases.discord-updates.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.discord.useCases.discord-updates.expectedOutcome") },
    { id: "discord-campaign", title: t("integrations.detail.providers.discord.useCases.discord-campaign.title"), description: t("integrations.detail.providers.discord.useCases.discord-campaign.description"), category: "Communication", n8nTemplateName: t("integrations.detail.providers.discord.useCases.discord-campaign.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.discord.useCases.discord-campaign.n8nTemplateDescription"), triggerEvent: "campaign.alert", expectedOutcome: t("integrations.detail.providers.discord.useCases.discord-campaign.expectedOutcome") },
    { id: "discord-team", title: t("integrations.detail.providers.discord.useCases.discord-team.title"), description: t("integrations.detail.providers.discord.useCases.discord-team.description"), category: "Communication", n8nTemplateName: t("integrations.detail.providers.discord.useCases.discord-team.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.discord.useCases.discord-team.n8nTemplateDescription"), triggerEvent: "call.important", expectedOutcome: t("integrations.detail.providers.discord.useCases.discord-team.expectedOutcome") },
    { id: "discord-leads", title: t("integrations.detail.providers.discord.useCases.discord-leads.title"), description: t("integrations.detail.providers.discord.useCases.discord-leads.description"), category: "Communication", n8nTemplateName: t("integrations.detail.providers.discord.useCases.discord-leads.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.discord.useCases.discord-leads.n8nTemplateDescription"), triggerEvent: "lead.created", expectedOutcome: t("integrations.detail.providers.discord.useCases.discord-leads.expectedOutcome") },
  ],
  zendesk: [
    { id: "zd-create-tickets", title: t("integrations.detail.providers.zendesk.useCases.zd-create-tickets.title"), description: t("integrations.detail.providers.zendesk.useCases.zd-create-tickets.description"), category: "Customer Support", n8nTemplateName: t("integrations.detail.providers.zendesk.useCases.zd-create-tickets.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.zendesk.useCases.zd-create-tickets.n8nTemplateDescription"), triggerEvent: "call.support_request", expectedOutcome: t("integrations.detail.providers.zendesk.useCases.zd-create-tickets.expectedOutcome") },
    { id: "zd-update-status", title: t("integrations.detail.providers.zendesk.useCases.zd-update-status.title"), description: t("integrations.detail.providers.zendesk.useCases.zd-update-status.description"), category: "Customer Support", n8nTemplateName: t("integrations.detail.providers.zendesk.useCases.zd-update-status.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.zendesk.useCases.zd-update-status.n8nTemplateDescription"), triggerEvent: "call.resolved", expectedOutcome: t("integrations.detail.providers.zendesk.useCases.zd-update-status.expectedOutcome") },
    { id: "zd-escalate", title: t("integrations.detail.providers.zendesk.useCases.zd-escalate.title"), description: t("integrations.detail.providers.zendesk.useCases.zd-escalate.description"), category: "Customer Support", n8nTemplateName: t("integrations.detail.providers.zendesk.useCases.zd-escalate.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.zendesk.useCases.zd-escalate.n8nTemplateDescription"), triggerEvent: "call.escalation", expectedOutcome: t("integrations.detail.providers.zendesk.useCases.zd-escalate.expectedOutcome") },
    { id: "zd-transcripts", title: t("integrations.detail.providers.zendesk.useCases.zd-transcripts.title"), description: t("integrations.detail.providers.zendesk.useCases.zd-transcripts.description"), category: "Customer Support", n8nTemplateName: t("integrations.detail.providers.zendesk.useCases.zd-transcripts.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.zendesk.useCases.zd-transcripts.n8nTemplateDescription"), triggerEvent: "call.transcribed", expectedOutcome: t("integrations.detail.providers.zendesk.useCases.zd-transcripts.expectedOutcome") },
  ],
  freshdesk: [
    { id: "fd-create-tickets", title: t("integrations.detail.providers.freshdesk.useCases.fd-create-tickets.title"), description: t("integrations.detail.providers.freshdesk.useCases.fd-create-tickets.description"), category: "Customer Support", n8nTemplateName: t("integrations.detail.providers.freshdesk.useCases.fd-create-tickets.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.freshdesk.useCases.fd-create-tickets.n8nTemplateDescription"), triggerEvent: "call.support_request", expectedOutcome: t("integrations.detail.providers.freshdesk.useCases.fd-create-tickets.expectedOutcome") },
    { id: "fd-update-status", title: t("integrations.detail.providers.freshdesk.useCases.fd-update-status.title"), description: t("integrations.detail.providers.freshdesk.useCases.fd-update-status.description"), category: "Customer Support", n8nTemplateName: t("integrations.detail.providers.freshdesk.useCases.fd-update-status.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.freshdesk.useCases.fd-update-status.n8nTemplateDescription"), triggerEvent: "call.resolved", expectedOutcome: t("integrations.detail.providers.freshdesk.useCases.fd-update-status.expectedOutcome") },
    { id: "fd-assign", title: t("integrations.detail.providers.freshdesk.useCases.fd-assign.title"), description: t("integrations.detail.providers.freshdesk.useCases.fd-assign.description"), category: "Customer Support", n8nTemplateName: t("integrations.detail.providers.freshdesk.useCases.fd-assign.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.freshdesk.useCases.fd-assign.n8nTemplateDescription"), triggerEvent: "call.routed", expectedOutcome: t("integrations.detail.providers.freshdesk.useCases.fd-assign.expectedOutcome") },
    { id: "fd-log", title: t("integrations.detail.providers.freshdesk.useCases.fd-log.title"), description: t("integrations.detail.providers.freshdesk.useCases.fd-log.description"), category: "Customer Support", n8nTemplateName: t("integrations.detail.providers.freshdesk.useCases.fd-log.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.freshdesk.useCases.fd-log.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.freshdesk.useCases.fd-log.expectedOutcome") },
  ],
  intercom: [
    { id: "ic-create-convs", title: t("integrations.detail.providers.intercom.useCases.ic-create-convs.title"), description: t("integrations.detail.providers.intercom.useCases.ic-create-convs.description"), category: "Customer Support", n8nTemplateName: t("integrations.detail.providers.intercom.useCases.ic-create-convs.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.intercom.useCases.ic-create-convs.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.intercom.useCases.ic-create-convs.expectedOutcome") },
    { id: "ic-update-contacts", title: t("integrations.detail.providers.intercom.useCases.ic-update-contacts.title"), description: t("integrations.detail.providers.intercom.useCases.ic-update-contacts.description"), category: "Customer Support", n8nTemplateName: t("integrations.detail.providers.intercom.useCases.ic-update-contacts.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.intercom.useCases.ic-update-contacts.n8nTemplateDescription"), triggerEvent: "call.analyzed", expectedOutcome: t("integrations.detail.providers.intercom.useCases.ic-update-contacts.expectedOutcome") },
    { id: "ic-trigger", title: t("integrations.detail.providers.intercom.useCases.ic-trigger.title"), description: t("integrations.detail.providers.intercom.useCases.ic-trigger.description"), category: "Customer Support", n8nTemplateName: t("integrations.detail.providers.intercom.useCases.ic-trigger.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.intercom.useCases.ic-trigger.n8nTemplateDescription"), triggerEvent: "call.outcome_determined", expectedOutcome: t("integrations.detail.providers.intercom.useCases.ic-trigger.expectedOutcome") },
    { id: "ic-notes", title: t("integrations.detail.providers.intercom.useCases.ic-notes.title"), description: t("integrations.detail.providers.intercom.useCases.ic-notes.description"), category: "Customer Support", n8nTemplateName: t("integrations.detail.providers.intercom.useCases.ic-notes.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.intercom.useCases.ic-notes.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.intercom.useCases.ic-notes.expectedOutcome") },
  ],
  helpscout: [
    { id: "hs-create-convs", title: t("integrations.detail.providers.helpscout.useCases.hs-create-convs.title"), description: t("integrations.detail.providers.helpscout.useCases.hs-create-convs.description"), category: "Customer Support", n8nTemplateName: t("integrations.detail.providers.helpscout.useCases.hs-create-convs.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.helpscout.useCases.hs-create-convs.n8nTemplateDescription"), triggerEvent: "call.support_request", expectedOutcome: t("integrations.detail.providers.helpscout.useCases.hs-create-convs.expectedOutcome") },
    { id: "hs-add-notes", title: t("integrations.detail.providers.helpscout.useCases.hs-add-notes.title"), description: t("integrations.detail.providers.helpscout.useCases.hs-add-notes.description"), category: "Customer Support", n8nTemplateName: t("integrations.detail.providers.helpscout.useCases.hs-add-notes.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.helpscout.useCases.hs-add-notes.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.helpscout.useCases.hs-add-notes.expectedOutcome") },
    { id: "hs-update-mailbox", title: t("integrations.detail.providers.helpscout.useCases.hs-update-mailbox.title"), description: t("integrations.detail.providers.helpscout.useCases.hs-update-mailbox.description"), category: "Customer Support", n8nTemplateName: t("integrations.detail.providers.helpscout.useCases.hs-update-mailbox.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.helpscout.useCases.hs-update-mailbox.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.helpscout.useCases.hs-update-mailbox.expectedOutcome") },
    { id: "hs-followup", title: t("integrations.detail.providers.helpscout.useCases.hs-followup.title"), description: t("integrations.detail.providers.helpscout.useCases.hs-followup.description"), category: "Customer Support", n8nTemplateName: t("integrations.detail.providers.helpscout.useCases.hs-followup.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.helpscout.useCases.hs-followup.n8nTemplateDescription"), triggerEvent: "call.followup_needed", expectedOutcome: t("integrations.detail.providers.helpscout.useCases.hs-followup.expectedOutcome") },
  ],
  front: [
    { id: "front-create-convs", title: t("integrations.detail.providers.front.useCases.front-create-convs.title"), description: t("integrations.detail.providers.front.useCases.front-create-convs.description"), category: "Customer Support", n8nTemplateName: t("integrations.detail.providers.front.useCases.front-create-convs.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.front.useCases.front-create-convs.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.front.useCases.front-create-convs.expectedOutcome") },
    { id: "front-route", title: t("integrations.detail.providers.front.useCases.front-route.title"), description: t("integrations.detail.providers.front.useCases.front-route.description"), category: "Customer Support", n8nTemplateName: t("integrations.detail.providers.front.useCases.front-route.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.front.useCases.front-route.n8nTemplateDescription"), triggerEvent: "call.routed", expectedOutcome: t("integrations.detail.providers.front.useCases.front-route.expectedOutcome") },
    { id: "front-context", title: t("integrations.detail.providers.front.useCases.front-context.title"), description: t("integrations.detail.providers.front.useCases.front-context.description"), category: "Customer Support", n8nTemplateName: t("integrations.detail.providers.front.useCases.front-context.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.front.useCases.front-context.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.front.useCases.front-context.expectedOutcome") },
    { id: "front-assign", title: t("integrations.detail.providers.front.useCases.front-assign.title"), description: t("integrations.detail.providers.front.useCases.front-assign.description"), category: "Customer Support", n8nTemplateName: t("integrations.detail.providers.front.useCases.front-assign.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.front.useCases.front-assign.n8nTemplateDescription"), triggerEvent: "call.routed", expectedOutcome: t("integrations.detail.providers.front.useCases.front-assign.expectedOutcome") },
  ],
  "google-calendar": [
    { id: "gcal-book", title: t("integrations.detail.providers.google-calendar.useCases.gcal-book.title"), description: t("integrations.detail.providers.google-calendar.useCases.gcal-book.description"), category: "Scheduling", n8nTemplateName: t("integrations.detail.providers.google-calendar.useCases.gcal-book.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.google-calendar.useCases.gcal-book.n8nTemplateDescription"), triggerEvent: "appointment.request", expectedOutcome: t("integrations.detail.providers.google-calendar.useCases.gcal-book.expectedOutcome") },
    { id: "gcal-availability", title: t("integrations.detail.providers.google-calendar.useCases.gcal-availability.title"), description: t("integrations.detail.providers.google-calendar.useCases.gcal-availability.description"), category: "Scheduling", n8nTemplateName: t("integrations.detail.providers.google-calendar.useCases.gcal-availability.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.google-calendar.useCases.gcal-availability.n8nTemplateDescription"), triggerEvent: "appointment.check", expectedOutcome: t("integrations.detail.providers.google-calendar.useCases.gcal-availability.expectedOutcome") },
    { id: "gcal-reminders", title: t("integrations.detail.providers.google-calendar.useCases.gcal-reminders.title"), description: t("integrations.detail.providers.google-calendar.useCases.gcal-reminders.description"), category: "Scheduling", n8nTemplateName: t("integrations.detail.providers.google-calendar.useCases.gcal-reminders.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.google-calendar.useCases.gcal-reminders.n8nTemplateDescription"), triggerEvent: "appointment.reminder", expectedOutcome: t("integrations.detail.providers.google-calendar.useCases.gcal-reminders.expectedOutcome") },
    { id: "gcal-block", title: t("integrations.detail.providers.google-calendar.useCases.gcal-block.title"), description: t("integrations.detail.providers.google-calendar.useCases.gcal-block.description"), category: "Scheduling", n8nTemplateName: t("integrations.detail.providers.google-calendar.useCases.gcal-block.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.google-calendar.useCases.gcal-block.n8nTemplateDescription"), triggerEvent: "appointment.booked", expectedOutcome: t("integrations.detail.providers.google-calendar.useCases.gcal-block.expectedOutcome") },
  ],
  calendly: [
    { id: "calendly-links", title: t("integrations.detail.providers.calendly.useCases.calendly-links.title"), description: t("integrations.detail.providers.calendly.useCases.calendly-links.description"), category: "Scheduling", n8nTemplateName: t("integrations.detail.providers.calendly.useCases.calendly-links.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.calendly.useCases.calendly-links.n8nTemplateDescription"), triggerEvent: "appointment.request", expectedOutcome: t("integrations.detail.providers.calendly.useCases.calendly-links.expectedOutcome") },
    { id: "calendly-availability", title: t("integrations.detail.providers.calendly.useCases.calendly-availability.title"), description: t("integrations.detail.providers.calendly.useCases.calendly-availability.description"), category: "Scheduling", n8nTemplateName: t("integrations.detail.providers.calendly.useCases.calendly-availability.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.calendly.useCases.calendly-availability.n8nTemplateDescription"), triggerEvent: "appointment.check", expectedOutcome: t("integrations.detail.providers.calendly.useCases.calendly-availability.expectedOutcome") },
    { id: "calendly-confirm", title: t("integrations.detail.providers.calendly.useCases.calendly-confirm.title"), description: t("integrations.detail.providers.calendly.useCases.calendly-confirm.description"), category: "Scheduling", n8nTemplateName: t("integrations.detail.providers.calendly.useCases.calendly-confirm.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.calendly.useCases.calendly-confirm.n8nTemplateDescription"), triggerEvent: "appointment.booked", expectedOutcome: t("integrations.detail.providers.calendly.useCases.calendly-confirm.expectedOutcome") },
    { id: "calendly-reminders", title: t("integrations.detail.providers.calendly.useCases.calendly-reminders.title"), description: t("integrations.detail.providers.calendly.useCases.calendly-reminders.description"), category: "Scheduling", n8nTemplateName: t("integrations.detail.providers.calendly.useCases.calendly-reminders.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.calendly.useCases.calendly-reminders.n8nTemplateDescription"), triggerEvent: "appointment.reminder", expectedOutcome: t("integrations.detail.providers.calendly.useCases.calendly-reminders.expectedOutcome") },
  ],
  "cal-com": [
    { id: "calcom-book", title: t("integrations.detail.providers.cal-com.useCases.calcom-book.title"), description: t("integrations.detail.providers.cal-com.useCases.calcom-book.description"), category: "Scheduling", n8nTemplateName: t("integrations.detail.providers.cal-com.useCases.calcom-book.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.cal-com.useCases.calcom-book.n8nTemplateDescription"), triggerEvent: "appointment.request", expectedOutcome: t("integrations.detail.providers.cal-com.useCases.calcom-book.expectedOutcome") },
    { id: "calcom-slots", title: t("integrations.detail.providers.cal-com.useCases.calcom-slots.title"), description: t("integrations.detail.providers.cal-com.useCases.calcom-slots.description"), category: "Scheduling", n8nTemplateName: t("integrations.detail.providers.cal-com.useCases.calcom-slots.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.cal-com.useCases.calcom-slots.n8nTemplateDescription"), triggerEvent: "appointment.check", expectedOutcome: t("integrations.detail.providers.cal-com.useCases.calcom-slots.expectedOutcome") },
    { id: "calcom-confirm", title: t("integrations.detail.providers.cal-com.useCases.calcom-confirm.title"), description: t("integrations.detail.providers.cal-com.useCases.calcom-confirm.description"), category: "Scheduling", n8nTemplateName: t("integrations.detail.providers.cal-com.useCases.calcom-confirm.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.cal-com.useCases.calcom-confirm.n8nTemplateDescription"), triggerEvent: "appointment.booked", expectedOutcome: t("integrations.detail.providers.cal-com.useCases.calcom-confirm.expectedOutcome") },
    { id: "calcom-sync", title: t("integrations.detail.providers.cal-com.useCases.calcom-sync.title"), description: t("integrations.detail.providers.cal-com.useCases.calcom-sync.description"), category: "Scheduling", n8nTemplateName: t("integrations.detail.providers.cal-com.useCases.calcom-sync.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.cal-com.useCases.calcom-sync.n8nTemplateDescription"), triggerEvent: "appointment.booked", expectedOutcome: t("integrations.detail.providers.cal-com.useCases.calcom-sync.expectedOutcome") },
  ],
  "microsoft-outlook": [
    { id: "outlook-schedule", title: t("integrations.detail.providers.microsoft-outlook.useCases.outlook-schedule.title"), description: t("integrations.detail.providers.microsoft-outlook.useCases.outlook-schedule.description"), category: "Scheduling", n8nTemplateName: t("integrations.detail.providers.microsoft-outlook.useCases.outlook-schedule.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.microsoft-outlook.useCases.outlook-schedule.n8nTemplateDescription"), triggerEvent: "appointment.request", expectedOutcome: t("integrations.detail.providers.microsoft-outlook.useCases.outlook-schedule.expectedOutcome") },
    { id: "outlook-availability", title: t("integrations.detail.providers.microsoft-outlook.useCases.outlook-availability.title"), description: t("integrations.detail.providers.microsoft-outlook.useCases.outlook-availability.description"), category: "Scheduling", n8nTemplateName: t("integrations.detail.providers.microsoft-outlook.useCases.outlook-availability.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.microsoft-outlook.useCases.outlook-availability.n8nTemplateDescription"), triggerEvent: "appointment.check", expectedOutcome: t("integrations.detail.providers.microsoft-outlook.useCases.outlook-availability.expectedOutcome") },
    { id: "outlook-invites", title: t("integrations.detail.providers.microsoft-outlook.useCases.outlook-invites.title"), description: t("integrations.detail.providers.microsoft-outlook.useCases.outlook-invites.description"), category: "Scheduling", n8nTemplateName: t("integrations.detail.providers.microsoft-outlook.useCases.outlook-invites.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.microsoft-outlook.useCases.outlook-invites.n8nTemplateDescription"), triggerEvent: "appointment.booked", expectedOutcome: t("integrations.detail.providers.microsoft-outlook.useCases.outlook-invites.expectedOutcome") },
    { id: "outlook-sync", title: t("integrations.detail.providers.microsoft-outlook.useCases.outlook-sync.title"), description: t("integrations.detail.providers.microsoft-outlook.useCases.outlook-sync.description"), category: "Scheduling", n8nTemplateName: t("integrations.detail.providers.microsoft-outlook.useCases.outlook-sync.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.microsoft-outlook.useCases.outlook-sync.n8nTemplateDescription"), triggerEvent: "appointment.booked", expectedOutcome: t("integrations.detail.providers.microsoft-outlook.useCases.outlook-sync.expectedOutcome") },
  ],
  "acuity-scheduling": [
    { id: "acuity-book", title: t("integrations.detail.providers.acuity-scheduling.useCases.acuity-book.title"), description: t("integrations.detail.providers.acuity-scheduling.useCases.acuity-book.description"), category: "Scheduling", n8nTemplateName: t("integrations.detail.providers.acuity-scheduling.useCases.acuity-book.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.acuity-scheduling.useCases.acuity-book.n8nTemplateDescription"), triggerEvent: "appointment.request", expectedOutcome: t("integrations.detail.providers.acuity-scheduling.useCases.acuity-book.expectedOutcome") },
    { id: "acuity-openings", title: t("integrations.detail.providers.acuity-scheduling.useCases.acuity-openings.title"), description: t("integrations.detail.providers.acuity-scheduling.useCases.acuity-openings.description"), category: "Scheduling", n8nTemplateName: t("integrations.detail.providers.acuity-scheduling.useCases.acuity-openings.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.acuity-scheduling.useCases.acuity-openings.n8nTemplateDescription"), triggerEvent: "appointment.check", expectedOutcome: t("integrations.detail.providers.acuity-scheduling.useCases.acuity-openings.expectedOutcome") },
    { id: "acuity-confirm", title: t("integrations.detail.providers.acuity-scheduling.useCases.acuity-confirm.title"), description: t("integrations.detail.providers.acuity-scheduling.useCases.acuity-confirm.description"), category: "Scheduling", n8nTemplateName: t("integrations.detail.providers.acuity-scheduling.useCases.acuity-confirm.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.acuity-scheduling.useCases.acuity-confirm.n8nTemplateDescription"), triggerEvent: "appointment.booked", expectedOutcome: t("integrations.detail.providers.acuity-scheduling.useCases.acuity-confirm.expectedOutcome") },
    { id: "acuity-reschedule", title: t("integrations.detail.providers.acuity-scheduling.useCases.acuity-reschedule.title"), description: t("integrations.detail.providers.acuity-scheduling.useCases.acuity-reschedule.description"), category: "Scheduling", n8nTemplateName: t("integrations.detail.providers.acuity-scheduling.useCases.acuity-reschedule.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.acuity-scheduling.useCases.acuity-reschedule.n8nTemplateDescription"), triggerEvent: "appointment.reschedule", expectedOutcome: t("integrations.detail.providers.acuity-scheduling.useCases.acuity-reschedule.expectedOutcome") },
  ],
  stripe: [
    { id: "stripe-payments", title: t("integrations.detail.providers.stripe.useCases.stripe-payments.title"), description: t("integrations.detail.providers.stripe.useCases.stripe-payments.description"), category: "E-Commerce & Payments", n8nTemplateName: t("integrations.detail.providers.stripe.useCases.stripe-payments.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.stripe.useCases.stripe-payments.n8nTemplateDescription"), triggerEvent: "payment.request", expectedOutcome: t("integrations.detail.providers.stripe.useCases.stripe-payments.expectedOutcome") },
    { id: "stripe-invoices", title: t("integrations.detail.providers.stripe.useCases.stripe-invoices.title"), description: t("integrations.detail.providers.stripe.useCases.stripe-invoices.description"), category: "E-Commerce & Payments", n8nTemplateName: t("integrations.detail.providers.stripe.useCases.stripe-invoices.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.stripe.useCases.stripe-invoices.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.stripe.useCases.stripe-invoices.expectedOutcome") },
    { id: "stripe-subscriptions", title: t("integrations.detail.providers.stripe.useCases.stripe-subscriptions.title"), description: t("integrations.detail.providers.stripe.useCases.stripe-subscriptions.description"), category: "E-Commerce & Payments", n8nTemplateName: t("integrations.detail.providers.stripe.useCases.stripe-subscriptions.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.stripe.useCases.stripe-subscriptions.n8nTemplateDescription"), triggerEvent: "customer.lookup", expectedOutcome: t("integrations.detail.providers.stripe.useCases.stripe-subscriptions.expectedOutcome") },
    { id: "stripe-refunds", title: t("integrations.detail.providers.stripe.useCases.stripe-refunds.title"), description: t("integrations.detail.providers.stripe.useCases.stripe-refunds.description"), category: "E-Commerce & Payments", n8nTemplateName: t("integrations.detail.providers.stripe.useCases.stripe-refunds.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.stripe.useCases.stripe-refunds.n8nTemplateDescription"), triggerEvent: "refund.request", expectedOutcome: t("integrations.detail.providers.stripe.useCases.stripe-refunds.expectedOutcome") },
  ],
  shopify: [
    { id: "shopify-orders", title: t("integrations.detail.providers.shopify.useCases.shopify-orders.title"), description: t("integrations.detail.providers.shopify.useCases.shopify-orders.description"), category: "E-Commerce & Payments", n8nTemplateName: t("integrations.detail.providers.shopify.useCases.shopify-orders.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.shopify.useCases.shopify-orders.n8nTemplateDescription"), triggerEvent: "customer.lookup", expectedOutcome: t("integrations.detail.providers.shopify.useCases.shopify-orders.expectedOutcome") },
    { id: "shopify-inventory", title: t("integrations.detail.providers.shopify.useCases.shopify-inventory.title"), description: t("integrations.detail.providers.shopify.useCases.shopify-inventory.description"), category: "E-Commerce & Payments", n8nTemplateName: t("integrations.detail.providers.shopify.useCases.shopify-inventory.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.shopify.useCases.shopify-inventory.n8nTemplateDescription"), triggerEvent: "product.check", expectedOutcome: t("integrations.detail.providers.shopify.useCases.shopify-inventory.expectedOutcome") },
    { id: "shopify-returns", title: t("integrations.detail.providers.shopify.useCases.shopify-returns.title"), description: t("integrations.detail.providers.shopify.useCases.shopify-returns.description"), category: "E-Commerce & Payments", n8nTemplateName: t("integrations.detail.providers.shopify.useCases.shopify-returns.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.shopify.useCases.shopify-returns.n8nTemplateDescription"), triggerEvent: "return.request", expectedOutcome: t("integrations.detail.providers.shopify.useCases.shopify-returns.expectedOutcome") },
    { id: "shopify-customers", title: t("integrations.detail.providers.shopify.useCases.shopify-customers.title"), description: t("integrations.detail.providers.shopify.useCases.shopify-customers.description"), category: "E-Commerce & Payments", n8nTemplateName: t("integrations.detail.providers.shopify.useCases.shopify-customers.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.shopify.useCases.shopify-customers.n8nTemplateDescription"), triggerEvent: "customer.lookup", expectedOutcome: t("integrations.detail.providers.shopify.useCases.shopify-customers.expectedOutcome") },
  ],
  woocommerce: [
    { id: "woo-orders", title: t("integrations.detail.providers.woocommerce.useCases.woo-orders.title"), description: t("integrations.detail.providers.woocommerce.useCases.woo-orders.description"), category: "E-Commerce & Payments", n8nTemplateName: t("integrations.detail.providers.woocommerce.useCases.woo-orders.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.woocommerce.useCases.woo-orders.n8nTemplateDescription"), triggerEvent: "customer.lookup", expectedOutcome: t("integrations.detail.providers.woocommerce.useCases.woo-orders.expectedOutcome") },
    { id: "woo-products", title: t("integrations.detail.providers.woocommerce.useCases.woo-products.title"), description: t("integrations.detail.providers.woocommerce.useCases.woo-products.description"), category: "E-Commerce & Payments", n8nTemplateName: t("integrations.detail.providers.woocommerce.useCases.woo-products.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.woocommerce.useCases.woo-products.n8nTemplateDescription"), triggerEvent: "product.check", expectedOutcome: t("integrations.detail.providers.woocommerce.useCases.woo-products.expectedOutcome") },
    { id: "woo-process", title: t("integrations.detail.providers.woocommerce.useCases.woo-process.title"), description: t("integrations.detail.providers.woocommerce.useCases.woo-process.description"), category: "E-Commerce & Payments", n8nTemplateName: t("integrations.detail.providers.woocommerce.useCases.woo-process.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.woocommerce.useCases.woo-process.n8nTemplateDescription"), triggerEvent: "order.create", expectedOutcome: t("integrations.detail.providers.woocommerce.useCases.woo-process.expectedOutcome") },
    { id: "woo-customers", title: t("integrations.detail.providers.woocommerce.useCases.woo-customers.title"), description: t("integrations.detail.providers.woocommerce.useCases.woo-customers.description"), category: "E-Commerce & Payments", n8nTemplateName: t("integrations.detail.providers.woocommerce.useCases.woo-customers.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.woocommerce.useCases.woo-customers.n8nTemplateDescription"), triggerEvent: "customer.lookup", expectedOutcome: t("integrations.detail.providers.woocommerce.useCases.woo-customers.expectedOutcome") },
  ],
  mailchimp: [
    { id: "mc-add-contacts", title: t("integrations.detail.providers.mailchimp.useCases.mc-add-contacts.title"), description: t("integrations.detail.providers.mailchimp.useCases.mc-add-contacts.description"), category: "Marketing", n8nTemplateName: t("integrations.detail.providers.mailchimp.useCases.mc-add-contacts.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.mailchimp.useCases.mc-add-contacts.n8nTemplateDescription"), triggerEvent: "contact.created", expectedOutcome: t("integrations.detail.providers.mailchimp.useCases.mc-add-contacts.expectedOutcome") },
    { id: "mc-tag", title: t("integrations.detail.providers.mailchimp.useCases.mc-tag.title"), description: t("integrations.detail.providers.mailchimp.useCases.mc-tag.description"), category: "Marketing", n8nTemplateName: t("integrations.detail.providers.mailchimp.useCases.mc-tag.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.mailchimp.useCases.mc-tag.n8nTemplateDescription"), triggerEvent: "call.outcome_determined", expectedOutcome: t("integrations.detail.providers.mailchimp.useCases.mc-tag.expectedOutcome") },
    { id: "mc-sequences", title: t("integrations.detail.providers.mailchimp.useCases.mc-sequences.title"), description: t("integrations.detail.providers.mailchimp.useCases.mc-sequences.description"), category: "Marketing", n8nTemplateName: t("integrations.detail.providers.mailchimp.useCases.mc-sequences.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.mailchimp.useCases.mc-sequences.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.mailchimp.useCases.mc-sequences.expectedOutcome") },
    { id: "mc-sync", title: t("integrations.detail.providers.mailchimp.useCases.mc-sync.title"), description: t("integrations.detail.providers.mailchimp.useCases.mc-sync.description"), category: "Marketing", n8nTemplateName: t("integrations.detail.providers.mailchimp.useCases.mc-sync.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.mailchimp.useCases.mc-sync.n8nTemplateDescription"), triggerEvent: "contact.updated", expectedOutcome: t("integrations.detail.providers.mailchimp.useCases.mc-sync.expectedOutcome") },
  ],
  activecampaign: [
    { id: "ac-add-contacts", title: t("integrations.detail.providers.activecampaign.useCases.ac-add-contacts.title"), description: t("integrations.detail.providers.activecampaign.useCases.ac-add-contacts.description"), category: "Marketing", n8nTemplateName: t("integrations.detail.providers.activecampaign.useCases.ac-add-contacts.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.activecampaign.useCases.ac-add-contacts.n8nTemplateDescription"), triggerEvent: "contact.created", expectedOutcome: t("integrations.detail.providers.activecampaign.useCases.ac-add-contacts.expectedOutcome") },
    { id: "ac-tags", title: t("integrations.detail.providers.activecampaign.useCases.ac-tags.title"), description: t("integrations.detail.providers.activecampaign.useCases.ac-tags.description"), category: "Marketing", n8nTemplateName: t("integrations.detail.providers.activecampaign.useCases.ac-tags.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.activecampaign.useCases.ac-tags.n8nTemplateDescription"), triggerEvent: "call.outcome_determined", expectedOutcome: t("integrations.detail.providers.activecampaign.useCases.ac-tags.expectedOutcome") },
    { id: "ac-automations", title: t("integrations.detail.providers.activecampaign.useCases.ac-automations.title"), description: t("integrations.detail.providers.activecampaign.useCases.ac-automations.description"), category: "Marketing", n8nTemplateName: t("integrations.detail.providers.activecampaign.useCases.ac-automations.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.activecampaign.useCases.ac-automations.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.activecampaign.useCases.ac-automations.expectedOutcome") },
    { id: "ac-deals", title: t("integrations.detail.providers.activecampaign.useCases.ac-deals.title"), description: t("integrations.detail.providers.activecampaign.useCases.ac-deals.description"), category: "Marketing", n8nTemplateName: t("integrations.detail.providers.activecampaign.useCases.ac-deals.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.activecampaign.useCases.ac-deals.n8nTemplateDescription"), triggerEvent: "call.outcome_determined", expectedOutcome: t("integrations.detail.providers.activecampaign.useCases.ac-deals.expectedOutcome") },
  ],
  sendgrid: [
    { id: "sg-transactional", title: t("integrations.detail.providers.sendgrid.useCases.sg-transactional.title"), description: t("integrations.detail.providers.sendgrid.useCases.sg-transactional.description"), category: "Marketing", n8nTemplateName: t("integrations.detail.providers.sendgrid.useCases.sg-transactional.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.sendgrid.useCases.sg-transactional.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.sendgrid.useCases.sg-transactional.expectedOutcome") },
    { id: "sg-followup", title: t("integrations.detail.providers.sendgrid.useCases.sg-followup.title"), description: t("integrations.detail.providers.sendgrid.useCases.sg-followup.description"), category: "Marketing", n8nTemplateName: t("integrations.detail.providers.sendgrid.useCases.sg-followup.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.sendgrid.useCases.sg-followup.n8nTemplateDescription"), triggerEvent: "call.followup_needed", expectedOutcome: t("integrations.detail.providers.sendgrid.useCases.sg-followup.expectedOutcome") },
    { id: "sg-notifications", title: t("integrations.detail.providers.sendgrid.useCases.sg-notifications.title"), description: t("integrations.detail.providers.sendgrid.useCases.sg-notifications.description"), category: "Marketing", n8nTemplateName: t("integrations.detail.providers.sendgrid.useCases.sg-notifications.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.sendgrid.useCases.sg-notifications.n8nTemplateDescription"), triggerEvent: "call.important", expectedOutcome: t("integrations.detail.providers.sendgrid.useCases.sg-notifications.expectedOutcome") },
    { id: "sg-templates", title: t("integrations.detail.providers.sendgrid.useCases.sg-templates.title"), description: t("integrations.detail.providers.sendgrid.useCases.sg-templates.description"), category: "Marketing", n8nTemplateName: t("integrations.detail.providers.sendgrid.useCases.sg-templates.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.sendgrid.useCases.sg-templates.n8nTemplateDescription"), triggerEvent: "template.update", expectedOutcome: t("integrations.detail.providers.sendgrid.useCases.sg-templates.expectedOutcome") },
  ],
  brevo: [
    { id: "brevo-contacts", title: t("integrations.detail.providers.brevo.useCases.brevo-contacts.title"), description: t("integrations.detail.providers.brevo.useCases.brevo-contacts.description"), category: "Marketing", n8nTemplateName: t("integrations.detail.providers.brevo.useCases.brevo-contacts.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.brevo.useCases.brevo-contacts.n8nTemplateDescription"), triggerEvent: "contact.created", expectedOutcome: t("integrations.detail.providers.brevo.useCases.brevo-contacts.expectedOutcome") },
    { id: "brevo-emails", title: t("integrations.detail.providers.brevo.useCases.brevo-emails.title"), description: t("integrations.detail.providers.brevo.useCases.brevo-emails.description"), category: "Marketing", n8nTemplateName: t("integrations.detail.providers.brevo.useCases.brevo-emails.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.brevo.useCases.brevo-emails.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.brevo.useCases.brevo-emails.expectedOutcome") },
    { id: "brevo-workflows", title: t("integrations.detail.providers.brevo.useCases.brevo-workflows.title"), description: t("integrations.detail.providers.brevo.useCases.brevo-workflows.description"), category: "Marketing", n8nTemplateName: t("integrations.detail.providers.brevo.useCases.brevo-workflows.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.brevo.useCases.brevo-workflows.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.brevo.useCases.brevo-workflows.expectedOutcome") },
    { id: "brevo-segments", title: t("integrations.detail.providers.brevo.useCases.brevo-segments.title"), description: t("integrations.detail.providers.brevo.useCases.brevo-segments.description"), category: "Marketing", n8nTemplateName: t("integrations.detail.providers.brevo.useCases.brevo-segments.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.brevo.useCases.brevo-segments.n8nTemplateDescription"), triggerEvent: "call.outcome_determined", expectedOutcome: t("integrations.detail.providers.brevo.useCases.brevo-segments.expectedOutcome") },
  ],
  convertkit: [
    { id: "ck-subscribers", title: t("integrations.detail.providers.convertkit.useCases.ck-subscribers.title"), description: t("integrations.detail.providers.convertkit.useCases.ck-subscribers.description"), category: "Marketing", n8nTemplateName: t("integrations.detail.providers.convertkit.useCases.ck-subscribers.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.convertkit.useCases.ck-subscribers.n8nTemplateDescription"), triggerEvent: "contact.created", expectedOutcome: t("integrations.detail.providers.convertkit.useCases.ck-subscribers.expectedOutcome") },
    { id: "ck-tags", title: t("integrations.detail.providers.convertkit.useCases.ck-tags.title"), description: t("integrations.detail.providers.convertkit.useCases.ck-tags.description"), category: "Marketing", n8nTemplateName: t("integrations.detail.providers.convertkit.useCases.ck-tags.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.convertkit.useCases.ck-tags.n8nTemplateDescription"), triggerEvent: "call.outcome_determined", expectedOutcome: t("integrations.detail.providers.convertkit.useCases.ck-tags.expectedOutcome") },
    { id: "ck-sequences", title: t("integrations.detail.providers.convertkit.useCases.ck-sequences.title"), description: t("integrations.detail.providers.convertkit.useCases.ck-sequences.description"), category: "Marketing", n8nTemplateName: t("integrations.detail.providers.convertkit.useCases.ck-sequences.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.convertkit.useCases.ck-sequences.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.convertkit.useCases.ck-sequences.expectedOutcome") },
    { id: "ck-fields", title: t("integrations.detail.providers.convertkit.useCases.ck-fields.title"), description: t("integrations.detail.providers.convertkit.useCases.ck-fields.description"), category: "Marketing", n8nTemplateName: t("integrations.detail.providers.convertkit.useCases.ck-fields.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.convertkit.useCases.ck-fields.n8nTemplateDescription"), triggerEvent: "contact.updated", expectedOutcome: t("integrations.detail.providers.convertkit.useCases.ck-fields.expectedOutcome") },
  ],
  zapier: [
    { id: "zapier-trigger", title: t("integrations.detail.providers.zapier.useCases.zapier-trigger.title"), description: t("integrations.detail.providers.zapier.useCases.zapier-trigger.description"), category: "Automation", n8nTemplateName: t("integrations.detail.providers.zapier.useCases.zapier-trigger.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.zapier.useCases.zapier-trigger.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.zapier.useCases.zapier-trigger.expectedOutcome") },
    { id: "zapier-multi", title: t("integrations.detail.providers.zapier.useCases.zapier-multi.title"), description: t("integrations.detail.providers.zapier.useCases.zapier-multi.description"), category: "Automation", n8nTemplateName: t("integrations.detail.providers.zapier.useCases.zapier-multi.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.zapier.useCases.zapier-multi.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.zapier.useCases.zapier-multi.expectedOutcome") },
    { id: "zapier-cross", title: t("integrations.detail.providers.zapier.useCases.zapier-cross.title"), description: t("integrations.detail.providers.zapier.useCases.zapier-cross.description"), category: "Automation", n8nTemplateName: t("integrations.detail.providers.zapier.useCases.zapier-cross.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.zapier.useCases.zapier-cross.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.zapier.useCases.zapier-cross.expectedOutcome") },
    { id: "zapier-routing", title: t("integrations.detail.providers.zapier.useCases.zapier-routing.title"), description: t("integrations.detail.providers.zapier.useCases.zapier-routing.description"), category: "Automation", n8nTemplateName: t("integrations.detail.providers.zapier.useCases.zapier-routing.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.zapier.useCases.zapier-routing.n8nTemplateDescription"), triggerEvent: "call.outcome_determined", expectedOutcome: t("integrations.detail.providers.zapier.useCases.zapier-routing.expectedOutcome") },
  ],
  make: [
    { id: "make-scenarios", title: t("integrations.detail.providers.make.useCases.make-scenarios.title"), description: t("integrations.detail.providers.make.useCases.make-scenarios.description"), category: "Automation", n8nTemplateName: t("integrations.detail.providers.make.useCases.make-scenarios.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.make.useCases.make-scenarios.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.make.useCases.make-scenarios.expectedOutcome") },
    { id: "make-complex", title: t("integrations.detail.providers.make.useCases.make-complex.title"), description: t("integrations.detail.providers.make.useCases.make-complex.description"), category: "Automation", n8nTemplateName: t("integrations.detail.providers.make.useCases.make-complex.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.make.useCases.make-complex.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.make.useCases.make-complex.expectedOutcome") },
    { id: "make-transform", title: t("integrations.detail.providers.make.useCases.make-transform.title"), description: t("integrations.detail.providers.make.useCases.make-transform.description"), category: "Automation", n8nTemplateName: t("integrations.detail.providers.make.useCases.make-transform.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.make.useCases.make-transform.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.make.useCases.make-transform.expectedOutcome") },
    { id: "make-multi", title: t("integrations.detail.providers.make.useCases.make-multi.title"), description: t("integrations.detail.providers.make.useCases.make-multi.description"), category: "Automation", n8nTemplateName: t("integrations.detail.providers.make.useCases.make-multi.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.make.useCases.make-multi.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.make.useCases.make-multi.expectedOutcome") },
  ],
  n8n: [
    { id: "n8n-templates", title: t("integrations.detail.providers.n8n.useCases.n8n-templates.title"), description: t("integrations.detail.providers.n8n.useCases.n8n-templates.description"), category: "Automation", n8nTemplateName: t("integrations.detail.providers.n8n.useCases.n8n-templates.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.n8n.useCases.n8n-templates.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.n8n.useCases.n8n-templates.expectedOutcome") },
    { id: "n8n-custom", title: t("integrations.detail.providers.n8n.useCases.n8n-custom.title"), description: t("integrations.detail.providers.n8n.useCases.n8n-custom.description"), category: "Automation", n8nTemplateName: t("integrations.detail.providers.n8n.useCases.n8n-custom.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.n8n.useCases.n8n-custom.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.n8n.useCases.n8n-custom.expectedOutcome") },
    { id: "n8n-processing", title: t("integrations.detail.providers.n8n.useCases.n8n-processing.title"), description: t("integrations.detail.providers.n8n.useCases.n8n-processing.description"), category: "Automation", n8nTemplateName: t("integrations.detail.providers.n8n.useCases.n8n-processing.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.n8n.useCases.n8n-processing.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.n8n.useCases.n8n-processing.expectedOutcome") },
    { id: "n8n-multi", title: t("integrations.detail.providers.n8n.useCases.n8n-multi.title"), description: t("integrations.detail.providers.n8n.useCases.n8n-multi.description"), category: "Automation", n8nTemplateName: t("integrations.detail.providers.n8n.useCases.n8n-multi.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.n8n.useCases.n8n-multi.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.n8n.useCases.n8n-multi.expectedOutcome") },
  ],
  notion: [
    { id: "notion-pages", title: t("integrations.detail.providers.notion.useCases.notion-pages.title"), description: t("integrations.detail.providers.notion.useCases.notion-pages.description"), category: "Automation", n8nTemplateName: t("integrations.detail.providers.notion.useCases.notion-pages.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.notion.useCases.notion-pages.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.notion.useCases.notion-pages.expectedOutcome") },
    { id: "notion-databases", title: t("integrations.detail.providers.notion.useCases.notion-databases.title"), description: t("integrations.detail.providers.notion.useCases.notion-databases.description"), category: "Automation", n8nTemplateName: t("integrations.detail.providers.notion.useCases.notion-databases.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.notion.useCases.notion-databases.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.notion.useCases.notion-databases.expectedOutcome") },
    { id: "notion-meetings", title: t("integrations.detail.providers.notion.useCases.notion-meetings.title"), description: t("integrations.detail.providers.notion.useCases.notion-meetings.description"), category: "Automation", n8nTemplateName: t("integrations.detail.providers.notion.useCases.notion-meetings.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.notion.useCases.notion-meetings.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.notion.useCases.notion-meetings.expectedOutcome") },
    { id: "notion-kb", title: t("integrations.detail.providers.notion.useCases.notion-kb.title"), description: t("integrations.detail.providers.notion.useCases.notion-kb.description"), category: "Automation", n8nTemplateName: t("integrations.detail.providers.notion.useCases.notion-kb.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.notion.useCases.notion-kb.n8nTemplateDescription"), triggerEvent: "call.analyzed", expectedOutcome: t("integrations.detail.providers.notion.useCases.notion-kb.expectedOutcome") },
  ],
  "google-sheets": [
    { id: "gsheets-export", title: t("integrations.detail.providers.google-sheets.useCases.gsheets-export.title"), description: t("integrations.detail.providers.google-sheets.useCases.gsheets-export.description"), category: "Data & Storage", n8nTemplateName: t("integrations.detail.providers.google-sheets.useCases.gsheets-export.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.google-sheets.useCases.gsheets-export.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.google-sheets.useCases.gsheets-export.expectedOutcome") },
    { id: "gsheets-import", title: t("integrations.detail.providers.google-sheets.useCases.gsheets-import.title"), description: t("integrations.detail.providers.google-sheets.useCases.gsheets-import.description"), category: "Data & Storage", n8nTemplateName: t("integrations.detail.providers.google-sheets.useCases.gsheets-import.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.google-sheets.useCases.gsheets-import.n8nTemplateDescription"), triggerEvent: "campaign.setup", expectedOutcome: t("integrations.detail.providers.google-sheets.useCases.gsheets-import.expectedOutcome") },
    { id: "gsheets-reports", title: t("integrations.detail.providers.google-sheets.useCases.gsheets-reports.title"), description: t("integrations.detail.providers.google-sheets.useCases.gsheets-reports.description"), category: "Data & Storage", n8nTemplateName: t("integrations.detail.providers.google-sheets.useCases.gsheets-reports.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.google-sheets.useCases.gsheets-reports.n8nTemplateDescription"), triggerEvent: "report.generate", expectedOutcome: t("integrations.detail.providers.google-sheets.useCases.gsheets-reports.expectedOutcome") },
    { id: "gsheets-dashboards", title: t("integrations.detail.providers.google-sheets.useCases.gsheets-dashboards.title"), description: t("integrations.detail.providers.google-sheets.useCases.gsheets-dashboards.description"), category: "Data & Storage", n8nTemplateName: t("integrations.detail.providers.google-sheets.useCases.gsheets-dashboards.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.google-sheets.useCases.gsheets-dashboards.n8nTemplateDescription"), triggerEvent: "report.generate", expectedOutcome: t("integrations.detail.providers.google-sheets.useCases.gsheets-dashboards.expectedOutcome") },
  ],
  airtable: [
    { id: "at-sync", title: t("integrations.detail.providers.airtable.useCases.at-sync.title"), description: t("integrations.detail.providers.airtable.useCases.at-sync.description"), category: "Data & Storage", n8nTemplateName: t("integrations.detail.providers.airtable.useCases.at-sync.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.airtable.useCases.at-sync.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.airtable.useCases.at-sync.expectedOutcome") },
    { id: "at-update", title: t("integrations.detail.providers.airtable.useCases.at-update.title"), description: t("integrations.detail.providers.airtable.useCases.at-update.description"), category: "Data & Storage", n8nTemplateName: t("integrations.detail.providers.airtable.useCases.at-update.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.airtable.useCases.at-update.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.airtable.useCases.at-update.expectedOutcome") },
    { id: "at-campaigns", title: t("integrations.detail.providers.airtable.useCases.at-campaigns.title"), description: t("integrations.detail.providers.airtable.useCases.at-campaigns.description"), category: "Data & Storage", n8nTemplateName: t("integrations.detail.providers.airtable.useCases.at-campaigns.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.airtable.useCases.at-campaigns.n8nTemplateDescription"), triggerEvent: "campaign.update", expectedOutcome: t("integrations.detail.providers.airtable.useCases.at-campaigns.expectedOutcome") },
    { id: "at-contacts", title: t("integrations.detail.providers.airtable.useCases.at-contacts.title"), description: t("integrations.detail.providers.airtable.useCases.at-contacts.description"), category: "Data & Storage", n8nTemplateName: t("integrations.detail.providers.airtable.useCases.at-contacts.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.airtable.useCases.at-contacts.n8nTemplateDescription"), triggerEvent: "contact.updated", expectedOutcome: t("integrations.detail.providers.airtable.useCases.at-contacts.expectedOutcome") },
  ],
  firebase: [
    { id: "fb-store", title: t("integrations.detail.providers.firebase.useCases.fb-store.title"), description: t("integrations.detail.providers.firebase.useCases.fb-store.description"), category: "Data & Storage", n8nTemplateName: t("integrations.detail.providers.firebase.useCases.fb-store.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.firebase.useCases.fb-store.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.firebase.useCases.fb-store.expectedOutcome") },
    { id: "fb-realtime", title: t("integrations.detail.providers.firebase.useCases.fb-realtime.title"), description: t("integrations.detail.providers.firebase.useCases.fb-realtime.description"), category: "Data & Storage", n8nTemplateName: t("integrations.detail.providers.firebase.useCases.fb-realtime.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.firebase.useCases.fb-realtime.n8nTemplateDescription"), triggerEvent: "call.active", expectedOutcome: t("integrations.detail.providers.firebase.useCases.fb-realtime.expectedOutcome") },
    { id: "fb-analytics", title: t("integrations.detail.providers.firebase.useCases.fb-analytics.title"), description: t("integrations.detail.providers.firebase.useCases.fb-analytics.description"), category: "Data & Storage", n8nTemplateName: t("integrations.detail.providers.firebase.useCases.fb-analytics.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.firebase.useCases.fb-analytics.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.firebase.useCases.fb-analytics.expectedOutcome") },
    { id: "fb-push", title: t("integrations.detail.providers.firebase.useCases.fb-push.title"), description: t("integrations.detail.providers.firebase.useCases.fb-push.description"), category: "Data & Storage", n8nTemplateName: t("integrations.detail.providers.firebase.useCases.fb-push.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.firebase.useCases.fb-push.n8nTemplateDescription"), triggerEvent: "call.important", expectedOutcome: t("integrations.detail.providers.firebase.useCases.fb-push.expectedOutcome") },
  ],
  supabase: [
    { id: "supa-transcripts", title: t("integrations.detail.providers.supabase.useCases.supa-transcripts.title"), description: t("integrations.detail.providers.supabase.useCases.supa-transcripts.description"), category: "Data & Storage", n8nTemplateName: t("integrations.detail.providers.supabase.useCases.supa-transcripts.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.supabase.useCases.supa-transcripts.n8nTemplateDescription"), triggerEvent: "call.transcribed", expectedOutcome: t("integrations.detail.providers.supabase.useCases.supa-transcripts.expectedOutcome") },
    { id: "supa-realtime", title: t("integrations.detail.providers.supabase.useCases.supa-realtime.title"), description: t("integrations.detail.providers.supabase.useCases.supa-realtime.description"), category: "Data & Storage", n8nTemplateName: t("integrations.detail.providers.supabase.useCases.supa-realtime.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.supabase.useCases.supa-realtime.n8nTemplateDescription"), triggerEvent: "call.active", expectedOutcome: t("integrations.detail.providers.supabase.useCases.supa-realtime.expectedOutcome") },
    { id: "supa-users", title: t("integrations.detail.providers.supabase.useCases.supa-users.title"), description: t("integrations.detail.providers.supabase.useCases.supa-users.description"), category: "Data & Storage", n8nTemplateName: t("integrations.detail.providers.supabase.useCases.supa-users.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.supabase.useCases.supa-users.n8nTemplateDescription"), triggerEvent: "user.updated", expectedOutcome: t("integrations.detail.providers.supabase.useCases.supa-users.expectedOutcome") },
    { id: "supa-analytics", title: t("integrations.detail.providers.supabase.useCases.supa-analytics.title"), description: t("integrations.detail.providers.supabase.useCases.supa-analytics.description"), category: "Data & Storage", n8nTemplateName: t("integrations.detail.providers.supabase.useCases.supa-analytics.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.supabase.useCases.supa-analytics.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.supabase.useCases.supa-analytics.expectedOutcome") },
  ],
  "aws-s3": [
    { id: "s3-recordings", title: t("integrations.detail.providers.aws-s3.useCases.s3-recordings.title"), description: t("integrations.detail.providers.aws-s3.useCases.s3-recordings.description"), category: "Data & Storage", n8nTemplateName: t("integrations.detail.providers.aws-s3.useCases.s3-recordings.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.aws-s3.useCases.s3-recordings.n8nTemplateDescription"), triggerEvent: "call.recorded", expectedOutcome: t("integrations.detail.providers.aws-s3.useCases.s3-recordings.expectedOutcome") },
    { id: "s3-transcripts", title: t("integrations.detail.providers.aws-s3.useCases.s3-transcripts.title"), description: t("integrations.detail.providers.aws-s3.useCases.s3-transcripts.description"), category: "Data & Storage", n8nTemplateName: t("integrations.detail.providers.aws-s3.useCases.s3-transcripts.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.aws-s3.useCases.s3-transcripts.n8nTemplateDescription"), triggerEvent: "call.transcribed", expectedOutcome: t("integrations.detail.providers.aws-s3.useCases.s3-transcripts.expectedOutcome") },
    { id: "s3-backup", title: t("integrations.detail.providers.aws-s3.useCases.s3-backup.title"), description: t("integrations.detail.providers.aws-s3.useCases.s3-backup.description"), category: "Data & Storage", n8nTemplateName: t("integrations.detail.providers.aws-s3.useCases.s3-backup.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.aws-s3.useCases.s3-backup.n8nTemplateDescription"), triggerEvent: "backup.scheduled", expectedOutcome: t("integrations.detail.providers.aws-s3.useCases.s3-backup.expectedOutcome") },
    { id: "s3-media", title: t("integrations.detail.providers.aws-s3.useCases.s3-media.title"), description: t("integrations.detail.providers.aws-s3.useCases.s3-media.description"), category: "Data & Storage", n8nTemplateName: t("integrations.detail.providers.aws-s3.useCases.s3-media.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.aws-s3.useCases.s3-media.n8nTemplateDescription"), triggerEvent: "media.upload", expectedOutcome: t("integrations.detail.providers.aws-s3.useCases.s3-media.expectedOutcome") },
  ],
  "google-analytics": [
    { id: "ga-events", title: t("integrations.detail.providers.google-analytics.useCases.ga-events.title"), description: t("integrations.detail.providers.google-analytics.useCases.ga-events.description"), category: "Analytics", n8nTemplateName: t("integrations.detail.providers.google-analytics.useCases.ga-events.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.google-analytics.useCases.ga-events.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.google-analytics.useCases.ga-events.expectedOutcome") },
    { id: "ga-attribution", title: t("integrations.detail.providers.google-analytics.useCases.ga-attribution.title"), description: t("integrations.detail.providers.google-analytics.useCases.ga-attribution.description"), category: "Analytics", n8nTemplateName: t("integrations.detail.providers.google-analytics.useCases.ga-attribution.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.google-analytics.useCases.ga-attribution.n8nTemplateDescription"), triggerEvent: "call.converted", expectedOutcome: t("integrations.detail.providers.google-analytics.useCases.ga-attribution.expectedOutcome") },
    { id: "ga-campaigns", title: t("integrations.detail.providers.google-analytics.useCases.ga-campaigns.title"), description: t("integrations.detail.providers.google-analytics.useCases.ga-campaigns.description"), category: "Analytics", n8nTemplateName: t("integrations.detail.providers.google-analytics.useCases.ga-campaigns.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.google-analytics.useCases.ga-campaigns.n8nTemplateDescription"), triggerEvent: "campaign.update", expectedOutcome: t("integrations.detail.providers.google-analytics.useCases.ga-campaigns.expectedOutcome") },
    { id: "ga-behavior", title: t("integrations.detail.providers.google-analytics.useCases.ga-behavior.title"), description: t("integrations.detail.providers.google-analytics.useCases.ga-behavior.description"), category: "Analytics", n8nTemplateName: t("integrations.detail.providers.google-analytics.useCases.ga-behavior.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.google-analytics.useCases.ga-behavior.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.google-analytics.useCases.ga-behavior.expectedOutcome") },
  ],
  mixpanel: [
    { id: "mp-events", title: t("integrations.detail.providers.mixpanel.useCases.mp-events.title"), description: t("integrations.detail.providers.mixpanel.useCases.mp-events.description"), category: "Analytics", n8nTemplateName: t("integrations.detail.providers.mixpanel.useCases.mp-events.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.mixpanel.useCases.mp-events.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.mixpanel.useCases.mp-events.expectedOutcome") },
    { id: "mp-funnels", title: t("integrations.detail.providers.mixpanel.useCases.mp-funnels.title"), description: t("integrations.detail.providers.mixpanel.useCases.mp-funnels.description"), category: "Analytics", n8nTemplateName: t("integrations.detail.providers.mixpanel.useCases.mp-funnels.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.mixpanel.useCases.mp-funnels.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.mixpanel.useCases.mp-funnels.expectedOutcome") },
    { id: "mp-segments", title: t("integrations.detail.providers.mixpanel.useCases.mp-segments.title"), description: t("integrations.detail.providers.mixpanel.useCases.mp-segments.description"), category: "Analytics", n8nTemplateName: t("integrations.detail.providers.mixpanel.useCases.mp-segments.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.mixpanel.useCases.mp-segments.n8nTemplateDescription"), triggerEvent: "call.analyzed", expectedOutcome: t("integrations.detail.providers.mixpanel.useCases.mp-segments.expectedOutcome") },
    { id: "mp-ab", title: t("integrations.detail.providers.mixpanel.useCases.mp-ab.title"), description: t("integrations.detail.providers.mixpanel.useCases.mp-ab.description"), category: "Analytics", n8nTemplateName: t("integrations.detail.providers.mixpanel.useCases.mp-ab.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.mixpanel.useCases.mp-ab.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.mixpanel.useCases.mp-ab.expectedOutcome") },
  ],
  segment: [
    { id: "seg-events", title: t("integrations.detail.providers.segment.useCases.seg-events.title"), description: t("integrations.detail.providers.segment.useCases.seg-events.description"), category: "Analytics", n8nTemplateName: t("integrations.detail.providers.segment.useCases.seg-events.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.segment.useCases.seg-events.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.segment.useCases.seg-events.expectedOutcome") },
    { id: "seg-identify", title: t("integrations.detail.providers.segment.useCases.seg-identify.title"), description: t("integrations.detail.providers.segment.useCases.seg-identify.description"), category: "Analytics", n8nTemplateName: t("integrations.detail.providers.segment.useCases.seg-identify.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.segment.useCases.seg-identify.n8nTemplateDescription"), triggerEvent: "contact.identified", expectedOutcome: t("integrations.detail.providers.segment.useCases.seg-identify.expectedOutcome") },
    { id: "seg-cross", title: t("integrations.detail.providers.segment.useCases.seg-cross.title"), description: t("integrations.detail.providers.segment.useCases.seg-cross.description"), category: "Analytics", n8nTemplateName: t("integrations.detail.providers.segment.useCases.seg-cross.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.segment.useCases.seg-cross.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.segment.useCases.seg-cross.expectedOutcome") },
    { id: "seg-routing", title: t("integrations.detail.providers.segment.useCases.seg-routing.title"), description: t("integrations.detail.providers.segment.useCases.seg-routing.description"), category: "Analytics", n8nTemplateName: t("integrations.detail.providers.segment.useCases.seg-routing.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.segment.useCases.seg-routing.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.segment.useCases.seg-routing.expectedOutcome") },
  ],
  bamboohr: [
    { id: "bamboo-sync", title: t("integrations.detail.providers.bamboohr.useCases.bamboo-sync.title"), description: t("integrations.detail.providers.bamboohr.useCases.bamboo-sync.description"), category: "HR & Recruiting", n8nTemplateName: t("integrations.detail.providers.bamboohr.useCases.bamboo-sync.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.bamboohr.useCases.bamboo-sync.n8nTemplateDescription"), triggerEvent: "contact.updated", expectedOutcome: t("integrations.detail.providers.bamboohr.useCases.bamboo-sync.expectedOutcome") },
    { id: "bamboo-interviews", title: t("integrations.detail.providers.bamboohr.useCases.bamboo-interviews.title"), description: t("integrations.detail.providers.bamboohr.useCases.bamboo-interviews.description"), category: "HR & Recruiting", n8nTemplateName: t("integrations.detail.providers.bamboohr.useCases.bamboo-interviews.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.bamboohr.useCases.bamboo-interviews.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.bamboohr.useCases.bamboo-interviews.expectedOutcome") },
    { id: "bamboo-candidates", title: t("integrations.detail.providers.bamboohr.useCases.bamboo-candidates.title"), description: t("integrations.detail.providers.bamboohr.useCases.bamboo-candidates.description"), category: "HR & Recruiting", n8nTemplateName: t("integrations.detail.providers.bamboohr.useCases.bamboo-candidates.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.bamboohr.useCases.bamboo-candidates.n8nTemplateDescription"), triggerEvent: "call.outcome_determined", expectedOutcome: t("integrations.detail.providers.bamboohr.useCases.bamboo-candidates.expectedOutcome") },
    { id: "bamboo-followups", title: t("integrations.detail.providers.bamboohr.useCases.bamboo-followups.title"), description: t("integrations.detail.providers.bamboohr.useCases.bamboo-followups.description"), category: "HR & Recruiting", n8nTemplateName: t("integrations.detail.providers.bamboohr.useCases.bamboo-followups.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.bamboohr.useCases.bamboo-followups.n8nTemplateDescription"), triggerEvent: "call.followup_needed", expectedOutcome: t("integrations.detail.providers.bamboohr.useCases.bamboo-followups.expectedOutcome") },
  ],
  greenhouse: [
    { id: "gh-log-interviews", title: t("integrations.detail.providers.greenhouse.useCases.gh-log-interviews.title"), description: t("integrations.detail.providers.greenhouse.useCases.gh-log-interviews.description"), category: "HR & Recruiting", n8nTemplateName: t("integrations.detail.providers.greenhouse.useCases.gh-log-interviews.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.greenhouse.useCases.gh-log-interviews.n8nTemplateDescription"), triggerEvent: "call.completed", expectedOutcome: t("integrations.detail.providers.greenhouse.useCases.gh-log-interviews.expectedOutcome") },
    { id: "gh-update-stage", title: t("integrations.detail.providers.greenhouse.useCases.gh-update-stage.title"), description: t("integrations.detail.providers.greenhouse.useCases.gh-update-stage.description"), category: "HR & Recruiting", n8nTemplateName: t("integrations.detail.providers.greenhouse.useCases.gh-update-stage.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.greenhouse.useCases.gh-update-stage.n8nTemplateDescription"), triggerEvent: "call.outcome_determined", expectedOutcome: t("integrations.detail.providers.greenhouse.useCases.gh-update-stage.expectedOutcome") },
    { id: "gh-sync-jobs", title: t("integrations.detail.providers.greenhouse.useCases.gh-sync-jobs.title"), description: t("integrations.detail.providers.greenhouse.useCases.gh-sync-jobs.description"), category: "HR & Recruiting", n8nTemplateName: t("integrations.detail.providers.greenhouse.useCases.gh-sync-jobs.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.greenhouse.useCases.gh-sync-jobs.n8nTemplateDescription"), triggerEvent: "system.sync", expectedOutcome: t("integrations.detail.providers.greenhouse.useCases.gh-sync-jobs.expectedOutcome") },
    { id: "gh-schedule", title: t("integrations.detail.providers.greenhouse.useCases.gh-schedule.title"), description: t("integrations.detail.providers.greenhouse.useCases.gh-schedule.description"), category: "HR & Recruiting", n8nTemplateName: t("integrations.detail.providers.greenhouse.useCases.gh-schedule.n8nTemplateName"), n8nTemplateDescription: t("integrations.detail.providers.greenhouse.useCases.gh-schedule.n8nTemplateDescription"), triggerEvent: "appointment.request", expectedOutcome: t("integrations.detail.providers.greenhouse.useCases.gh-schedule.expectedOutcome") },
  ],
  };
}


function buildOAuthSetupGuide(slug: string, config: ProviderCredentialConfig, t: (key: string, opts?: Record<string, string>) => string): SetupStep[] {
  return [
    {
      key: "create-app",
      title: t("integrations.detail.setupGuide.oauth.createApp"),
      description: t("integrations.detail.setupGuide.oauth.createAppDesc", { provider: config.setupLinkText.replace("Open ", "") }),
    },
    {
      key: "configure-redirect",
      title: t("integrations.detail.setupGuide.oauth.configureRedirect"),
      description: t("integrations.detail.setupGuide.oauth.configureRedirectDesc"),
    },
    {
      key: "set-scopes",
      title: t("integrations.detail.setupGuide.oauth.setScopes"),
      description: t("integrations.detail.setupGuide.oauth.setScopesDesc"),
    },
    {
      key: "enter-credentials",
      title: t("integrations.detail.setupGuide.oauth.enterCredentials"),
      description: t("integrations.detail.setupGuide.oauth.enterCredentialsDesc", { field1: config.field1Label, field2: config.field2Label }),
    },
    {
      key: "authorize-access",
      title: t("integrations.detail.setupGuide.oauth.authorizeAccess"),
      description: t("integrations.detail.setupGuide.oauth.authorizeAccessDesc"),
    },
    {
      key: "verify-connection",
      title: t("integrations.detail.setupGuide.oauth.verifyConnection"),
      description: t("integrations.detail.setupGuide.oauth.verifyConnectionDesc"),
    },
  ];
}

function buildApiKeySetupGuide(config: ProviderCredentialConfig, t: (key: string, opts?: Record<string, string>) => string): SetupStep[] {
  return [
    {
      key: "find-key",
      title: t("integrations.detail.setupGuide.apiKey.findKey"),
      description: t("integrations.detail.setupGuide.apiKey.findKeyDesc"),
    },
    {
      key: "note-domain",
      title: t("integrations.detail.setupGuide.apiKey.noteDomain"),
      description: t("integrations.detail.setupGuide.apiKey.noteDomainDesc"),
    },
    {
      key: "enter-credentials",
      title: t("integrations.detail.setupGuide.apiKey.enterCredentials"),
      description: t("integrations.detail.setupGuide.apiKey.enterCredentialsDesc", { field1: config.field1Label, field2: config.field2Label }),
    },
    {
      key: "verify-connection",
      title: t("integrations.detail.setupGuide.apiKey.verifyConnection"),
      description: t("integrations.detail.setupGuide.apiKey.verifyConnectionDesc"),
    },
  ];
}

function getProviderConfig(slug: string, t: (key: string) => string): ProviderCredentialConfig {
  const config = getProviderCredentialConfig(t);
  return config[slug] || {
    field1Label: t("integrations.detail.providers.default.field1Label"),
    field1Placeholder: t("integrations.detail.providers.default.field1Placeholder"),
    field2Label: t("integrations.detail.providers.default.field2Label"),
    field2Placeholder: t("integrations.detail.providers.default.field2Placeholder"),
    helpText: t("integrations.detail.providers.default.helpText"),
    setupUrl: "",
    setupLinkText: t("integrations.detail.providers.default.setupLinkText"),
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

function formatDate(dateStr: string | null, fallback = "Never") {
  if (!dateStr) return fallback;
  return new Date(dateStr).toLocaleString();
}

function getStatusInfo(status: string, t: (key: string) => string) {
  switch (status) {
    case "active":
      return { icon: <CheckCircle2 className="w-4 h-4" />, label: t("integrations.detail.status.connected"), variant: "default" as const, color: "text-green-600" };
    case "pending_auth":
      return { icon: <Loader2 className="w-4 h-4 animate-spin" />, label: t("integrations.detail.status.pendingAuth"), variant: "secondary" as const, color: "text-amber-600" };
    case "error":
      return { icon: <AlertCircle className="w-4 h-4" />, label: t("integrations.detail.status.error"), variant: "destructive" as const, color: "text-red-600" };
    case "inactive":
      return { icon: <XCircle className="w-4 h-4" />, label: t("integrations.detail.status.inactive"), variant: "outline" as const, color: "text-muted-foreground" };
    default:
      return { icon: <Clock className="w-4 h-4" />, label: status, variant: "outline" as const, color: "text-muted-foreground" };
  }
}

export default function IntegrationDetail() {
  const { t } = useTranslation();
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
        title: t("integrations.detail.toast.accountConnected"),
        description: t("integrations.detail.toast.accountConnectedDesc"),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/connected"] });
      window.history.replaceState({}, "", `/app/integrations/${slug}`);
    } else if (oauthError) {
      const errorMessages: Record<string, string> = {
        access_denied: t("integrations.detail.toast.authErrors.accessDenied"),
        missing_params: t("integrations.detail.toast.authErrors.missingParams"),
        invalid_state: t("integrations.detail.toast.authErrors.invalidState"),
        integration_not_found: t("integrations.detail.toast.authErrors.integrationNotFound"),
        token_exchange_failed: t("integrations.detail.toast.authErrors.tokenExchangeFailed"),
        missing_credentials: t("integrations.detail.toast.authErrors.missingCredentials"),
        credential_error: t("integrations.detail.toast.authErrors.credentialError"),
        server_error: t("integrations.detail.toast.authErrors.serverError"),
      };
      toast({
        title: t("integrations.detail.toast.authFailed"),
        description: errorMessages[oauthError] || t("integrations.detail.toast.authFailedDefault"),
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
          title: t("integrations.detail.toast.signIn"),
          description: t("integrations.detail.toast.signInDesc", { name: app?.name || "service" }),
        });
      } else {
        toast({
          title: t("integrations.detail.toast.connected"),
          description: t("integrations.detail.toast.connectedDesc", { name: app?.name || "Integration" }),
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: t("integrations.detail.toast.connectionFailed"),
        description: error.message || t("integrations.detail.toast.connectionFailedDefault"),
        variant: "destructive",
      });
    },
  });

  const providerConfig = app ? getProviderConfig(app.slug, t) : getProviderConfig("", t);
  const authType = (app as IntegrationAppWithOAuth)?.authType;
  const credentialConfig = getProviderCredentialConfig(t);
  const hasCredentialConfig = !!(app && credentialConfig[app.slug]);
  const isApiKeyProvider = authType === "api_key" || hasCredentialConfig;

  const handleConnectClick = () => {
    setCredentialsDialogOpen(true);
  };

  const handleCredentialsSubmit = () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      toast({
        title: t("integrations.detail.toast.missingCredentials"),
        description: t("integrations.detail.toast.missingCredentialsDesc", { field1: providerConfig.field1Label, field2: providerConfig.field2Label }),
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
      toast({ title: t("integrations.detail.toast.activated"), description: t("integrations.detail.toast.activatedDesc") });
    },
    onError: (error: Error) => {
      toast({
        title: t("integrations.detail.toast.activationFailed"),
        description: error.message || t("integrations.detail.toast.activationFailedDefault"),
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
      toast({ title: t("integrations.detail.toast.disconnected"), description: t("integrations.detail.toast.disconnectedDesc") });
    },
    onError: (error: Error) => {
      toast({
        title: t("integrations.detail.toast.disconnectFailed"),
        description: error.message || t("integrations.detail.toast.disconnectFailedDefault"),
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
        title: data.success ? t("integrations.detail.toast.syncCompleted") : t("integrations.detail.toast.syncFailed"),
        description: data.success ? t("integrations.detail.toast.syncCompletedDesc") : t("integrations.detail.toast.syncFailedDesc"),
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("integrations.detail.toast.syncFailed"),
        description: error.message || t("integrations.detail.toast.syncFailedDefault"),
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
        title: data.success ? t("integrations.detail.toast.templateExecuted") : t("integrations.detail.toast.executionFailed"),
        description: data.message || (data.success ? t("integrations.detail.toast.templateExecutedDesc") : t("integrations.detail.toast.executionFailedDesc")),
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (error: Error) => {
      setExecutingUseCase(null);
      toast({
        title: t("integrations.detail.toast.executionFailed"),
        description: error.message || t("integrations.detail.toast.executionFailedDefault"),
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
        <h2 className="text-lg font-medium mb-2">{t("integrations.detail.notFound")}</h2>
        <Button variant="outline" onClick={() => navigate("/app/integrations")} data-testid="button-back-marketplace">
          <ArrowLeft className="w-4 h-4 mr-2" /> {t("integrations.detail.backToMarketplace")}
        </Button>
      </div>
    );
  }

  const statusInfo = integration ? getStatusInfo(integration.status, t) : null;

  const allProviderActions = getProviderActions(t);
  const providerActions = allProviderActions[slug] || allProviderActions[slug.replace("-com", "")] || [];

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
    ? buildApiKeySetupGuide(providerConfig, t)
    : buildOAuthSetupGuide(slug, providerConfig, t);

  const formatCreatedDate = (dateStr: string | null | unknown) => {
    if (!dateStr) return t("integrations.detail.notAvailable");
    const d = new Date(dateStr as string);
    return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: t("integrations.detail.copied"), description: t("integrations.detail.copiedDesc", { label }) });
  };

  const filteredActions = providerActions.filter(
    (a) => functionsSubTab === "actions" ? a.type === "action" : a.type === "sync"
  );

  const actionCategoryLabels: Record<string, string> = {
    contacts: t("integrations.detail.functions.categories.contacts"),
    leads: t("integrations.detail.functions.categories.leads"),
    deals: t("integrations.detail.functions.categories.deals"),
    files: t("integrations.detail.functions.categories.files"),
    activities: t("integrations.detail.functions.categories.activities"),
    notifications: t("integrations.detail.functions.categories.notifications"),
    others: t("integrations.detail.functions.categories.others"),
  };

  const groupActionsByCategory = (actions: ProviderAction[]) => {
    const groups: Record<string, ProviderAction[]> = {};
    actions.forEach((action) => {
      const nameParts = action.name.toLowerCase();
      let category = "others";
      if (nameParts.includes("contact") || nameParts.includes("person")) category = "contacts";
      else if (nameParts.includes("lead")) category = "leads";
      else if (nameParts.includes("deal")) category = "deals";
      else if (nameParts.includes("file") || nameParts.includes("export") || nameParts.includes("record")) category = "files";
      else if (nameParts.includes("call") || nameParts.includes("phone") || nameParts.includes("engagement") || nameParts.includes("activity") || nameParts.includes("log")) category = "activities";
      else if (nameParts.includes("notification") || nameParts.includes("alert") || nameParts.includes("campaign") || nameParts.includes("summary")) category = "notifications";
      else if (nameParts.includes("audience") || nameParts.includes("tag") || nameParts.includes("board") || nameParts.includes("item") || nameParts.includes("conversation") || nameParts.includes("attribute") || nameParts.includes("score") || nameParts.includes("status") || nameParts.includes("qualification") || nameParts.includes("outcome") || nameParts.includes("note")) category = "others";
      if (!groups[category]) groups[category] = [];
      groups[category].push(action);
    });
    return groups;
  };

  const groupedActions = groupActionsByCategory(filteredActions);

  const tabItems = [
    { key: "functions", label: t("integrations.detail.tabs.functions") },
    { key: "use-cases", label: t("integrations.detail.tabs.useCases") },
    { key: "settings", label: t("integrations.detail.tabs.settings") },
    { key: "setup-guide", label: t("integrations.detail.tabs.setupGuide"), hasExternal: true },
    { key: "logs", label: t("integrations.detail.tabs.logs"), hasExternal: true },
  ];

  return (
    <div className="flex flex-col h-full" data-testid="page-integration-detail">
      <div className="p-4 md:p-6 pb-0">
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4" aria-label="Breadcrumb" data-testid="nav-breadcrumb">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/app/integrations")}
            className="gap-1.5 px-2"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("integrations.panel.breadcrumb.backToIntegrations")}
          </Button>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium text-foreground" data-testid="text-breadcrumb-current">{app?.name}</span>
        </nav>

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
                    {t("integrations.detail.activate")}
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
                    {t("integrations.detail.syncNow")}
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
                {oauthPending ? t("integrations.detail.waitingAuth") : t("integrations.detail.addTestConnection")}
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
                    <p className="text-sm text-muted-foreground">{t("integrations.detail.functions.connectFirst", { name: app.name })}</p>
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
                          {t("integrations.detail.functions.actions")}
                        </Button>
                        <Button
                          variant={functionsSubTab === "syncs" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setFunctionsSubTab("syncs")}
                          data-testid="button-subtab-syncs"
                        >
                          {t("integrations.detail.functions.syncs")}
                        </Button>
                      </div>
                      <a
                        href="#"
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                        data-testid="link-how-to-use"
                      >
                        {t("integrations.detail.functions.howToUse", { type: functionsSubTab === "actions" ? t("integrations.detail.functions.actions") : t("integrations.detail.functions.syncs") })}
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>

                    {filteredActions.length > 0 ? (
                      <div className="border rounded-md overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/80">
                              <TableHead className="font-semibold text-xs uppercase tracking-wider">{t("integrations.detail.functions.name")}</TableHead>
                              <TableHead className="font-semibold text-xs uppercase tracking-wider">{t("integrations.detail.functions.type")}</TableHead>
                              <TableHead className="font-semibold text-xs uppercase tracking-wider text-right">{t("integrations.detail.functions.enabled")}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {Object.entries(groupedActions).map(([category, actions]) => (
                              <React.Fragment key={category}>
                                <TableRow>
                                  <TableCell colSpan={3} className="bg-muted/40 py-1.5 px-4">
                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" data-testid={`text-category-${category}`}>
                                      {actionCategoryLabels[category] || category}
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
                                          {t("integrations.detail.functions.template")}
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
                          {t("integrations.detail.functions.noActions", { type: functionsSubTab === "actions" ? t("integrations.detail.functions.actions").toLowerCase() : t("integrations.detail.functions.syncs").toLowerCase() })}
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
                  const useCases = getProviderUseCases(t)[slug] || [];
                  return useCases.length > 0 ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Workflow className="w-5 h-5 text-muted-foreground" />
                        <h3 className="text-base font-semibold" data-testid="text-use-cases-header">{t("integrations.detail.useCases.header", { name: app.name })}</h3>
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
                                <span className="font-medium">{t("integrations.detail.useCases.trigger")}:</span> {uc.triggerEvent}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                <span className="font-medium">{t("integrations.detail.useCases.outcome")}:</span> {uc.expectedOutcome}
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
                                ? t("integrations.detail.useCases.connectFirst")
                                : executingUseCase === uc.id
                                  ? t("integrations.detail.useCases.executing")
                                  : t("integrations.detail.useCases.executeTemplate")}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Workflow className="w-8 h-8 text-muted-foreground mb-3" />
                      <p className="text-sm text-muted-foreground">{t("integrations.detail.useCases.empty", { name: app.name })}</p>
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
                    <p className="text-sm text-muted-foreground">{t("integrations.detail.settings.connectFirst", { name: app.name })}</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {(config?.accountName || config?.accountEmail) && (
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Shield className="w-4 h-4" /> {t("integrations.detail.settings.connectedAccount")}
                          </CardTitle>
                          <Badge variant="outline" className="no-default-active-elevate gap-1">
                            <CheckCircle2 className="w-3 h-3" /> {t("integrations.detail.settings.authenticated")}
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
                                  <p className="text-xs text-muted-foreground">{t("integrations.detail.settings.account")}</p>
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
                                  <p className="text-xs text-muted-foreground">{t("integrations.detail.settings.email")}</p>
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
                                  <p className="text-xs text-muted-foreground">{t("integrations.detail.settings.authorizedOn")}</p>
                                  <p className="text-sm font-medium truncate" data-testid="text-auth-date">{formatDate(config.connectedAt, t("integrations.detail.never"))}</p>
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
                          <Settings className="w-4 h-4" /> {t("integrations.detail.settings.fieldMapping")}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                          {t("integrations.detail.settings.fieldMappingDesc", { name: app.name })}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-xs">{t("integrations.detail.settings.contactName")}</Label>
                            <Input
                              placeholder={t("integrations.detail.settings.placeholderContactName")}
                              defaultValue={config?.fieldMapping?.contactName || "contact_name"}
                              readOnly
                              data-testid="input-field-contact-name"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">{t("integrations.detail.settings.phoneNumber")}</Label>
                            <Input
                              placeholder={t("integrations.detail.settings.placeholderPhoneNumber")}
                              defaultValue={config?.fieldMapping?.phoneNumber || "phone_number"}
                              readOnly
                              data-testid="input-field-phone"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">{t("integrations.detail.settings.company")}</Label>
                            <Input
                              placeholder={t("integrations.detail.settings.placeholderCompany")}
                              defaultValue={config?.fieldMapping?.company || "company"}
                              readOnly
                              data-testid="input-field-company"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">{t("integrations.detail.settings.callSummary")}</Label>
                            <Input
                              placeholder={t("integrations.detail.settings.placeholderCallSummary")}
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
                          <Code className="w-4 h-4" /> {t("integrations.detail.settings.integrationDetails")}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground">{t("integrations.detail.settings.authMethod")}</p>
                            <p className="text-sm font-medium mt-0.5" data-testid="text-auth-method">
                              {isApiKeyProvider ? t("integrations.detail.settings.apiKey") : t("integrations.detail.settings.oauth2")}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">{t("integrations.detail.settings.displayName")}</p>
                            <p className="text-sm font-medium mt-0.5" data-testid="text-display-name">{app.name}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">{t("integrations.detail.settings.integrationId")}</p>
                            <p className="text-sm font-medium font-mono mt-0.5" data-testid="text-integration-slug">{app.slug}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">{t("integrations.detail.settings.category")}</p>
                            <p className="text-sm font-medium mt-0.5" data-testid="text-category">{app.category || t("integrations.detail.settings.integration")}</p>
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
                        <RefreshCw className="w-4 h-4 mr-1.5" /> {t("integrations.detail.settings.reconnect")}
                      </Button>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <div>
                        <h4 className="text-sm font-medium text-destructive">{t("integrations.detail.settings.dangerZone")}</h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t("integrations.detail.settings.dangerDesc", { name: app.name })}
                        </p>
                      </div>
                      <Button
                        variant="destructive"
                        onClick={() => setDisconnectDialogOpen(true)}
                        data-testid="button-disconnect-settings"
                      >
                        <Unplug className="w-4 h-4 mr-1.5" /> {t("integrations.detail.settings.disconnect", { name: app.name })}
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
                    <h3 className="text-base font-semibold">{t("integrations.detail.setupGuide.header", { name: app.name })}</h3>
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

                            {step.key === "configure-redirect" && providerConfig.requiresRedirectUri && (
                              <div className="mt-2 space-y-1.5">
                                <Label className="text-xs text-muted-foreground">{t("integrations.detail.setupGuide.redirectUri")}</Label>
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 rounded-md bg-muted px-3 py-2">
                                    <code className="text-xs font-mono break-all" data-testid="text-redirect-uri">{getOAuthRedirectUri()}</code>
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => copyToClipboard(getOAuthRedirectUri(), t("integrations.detail.setupGuide.redirectUri"))}
                                    data-testid="button-copy-redirect"
                                  >
                                    <Copy className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            )}

                            {step.key === "set-scopes" && providerConfig.scopes && providerConfig.scopes.length > 0 && (
                              <div className="mt-2 space-y-1.5">
                                <Label className="text-xs text-muted-foreground">{t("integrations.detail.setupGuide.requiredScopes")}</Label>
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
                    <p className="text-sm text-muted-foreground">{t("integrations.detail.logs.connectFirst", { name: app.name })}</p>
                  </div>
                ) : (
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="w-4 h-4" /> {t("integrations.detail.logs.syncHistory")}
                      </CardTitle>
                      <Badge variant="outline" className="no-default-active-elevate">{syncLogs?.length || 0} {t("integrations.detail.logs.entries")}</Badge>
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
                            {filter === "all" ? t("integrations.detail.logs.all") : filter === "success" ? t("integrations.detail.logs.success") : filter === "failed" ? t("integrations.detail.logs.failed") : t("integrations.detail.logs.inProgress")}
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
                                <TableHead>{t("integrations.detail.logs.event")}</TableHead>
                                <TableHead>{t("integrations.detail.logs.status")}</TableHead>
                                <TableHead>{t("integrations.detail.logs.records")}</TableHead>
                                <TableHead>{t("integrations.detail.logs.duration")}</TableHead>
                                <TableHead>{t("integrations.detail.logs.date")}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredLogs.map((log) => {
                                const isExpanded = expandedLogRows.has(log.id);
                                const hasError = !!log.errorMessage;
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
                                      <TableCell className="text-sm text-muted-foreground">{formatDate(log.createdAt as unknown as string, t("integrations.detail.never"))}</TableCell>
                                    </TableRow>
                                    {isExpanded && hasError && (
                                      <TableRow key={`${log.id}-detail`}>
                                        <TableCell colSpan={6} className="bg-muted/50 p-3">
                                          <div className="flex items-start gap-2">
                                            <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                                            <div>
                                              <p className="text-xs font-medium text-destructive">{t("integrations.detail.logs.errorDetails")}</p>
                                              <p className="text-xs text-muted-foreground mt-1 font-mono" data-testid={`text-error-${log.id}`}>
                                                {log.errorMessage}
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
                          <p className="text-sm text-muted-foreground">{t("integrations.detail.logs.noHistory")}</p>
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
                <p className="text-xs text-muted-foreground mb-1">{t("integrations.detail.sidebar.authMethod")}</p>
                <p className="text-sm font-medium" data-testid="sidebar-auth-method">
                  {isApiKeyProvider ? t("integrations.detail.sidebar.apiKey") : t("integrations.detail.sidebar.oauth2")}
                </p>
              </div>
              <Separator />
              <div className="py-3">
                <p className="text-xs text-muted-foreground mb-1">{t("integrations.detail.sidebar.displayName")}</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium" data-testid="sidebar-display-name">{app.name}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => copyToClipboard(app.name, t("integrations.detail.sidebar.displayName"))}
                    data-testid="button-copy-display-name"
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <Separator />
              <div className="py-3">
                <p className="text-xs text-muted-foreground mb-1">{t("integrations.detail.sidebar.integrationId")}</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium font-mono" data-testid="sidebar-integration-id">{app.slug}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => copyToClipboard(app.slug, t("integrations.detail.sidebar.integrationId"))}
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
                    <p className="text-xs text-muted-foreground mb-1">{t("integrations.detail.sidebar.apiDocs")}</p>
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
                <p className="text-xs text-muted-foreground mb-1">{t("integrations.detail.sidebar.created")}</p>
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
            <DialogTitle>{t("integrations.detail.disconnect.title", { name: app.name })}</DialogTitle>
            <DialogDescription>
              {t("integrations.detail.disconnect.description", { name: app.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisconnectDialogOpen(false)} data-testid="button-cancel-disconnect">
              {t("integrations.detail.disconnect.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
              data-testid="button-confirm-disconnect"
            >
              {disconnectMutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Unplug className="w-4 h-4 mr-1.5" />}
              {t("integrations.detail.disconnect.confirm")}
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
              {app && getAppIcon(app.slug)} {t("integrations.detail.connect.title", { name: app?.name })}
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
                <Label className="text-xs text-muted-foreground">{t("integrations.detail.connect.redirectUri", { name: app?.name })}</Label>
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
                      toast({ title: t("integrations.detail.copied"), description: t("integrations.detail.copiedDesc", { label: t("integrations.detail.setupGuide.redirectUri") }) });
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
                <Label className="text-xs text-muted-foreground">{t("integrations.detail.connect.requiredScopes")}</Label>
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
                  ? t("integrations.detail.connect.securityNoteApiKey", { field1: providerConfig.field1Label, field2: providerConfig.field2Label, name: app?.name })
                  : t("integrations.detail.connect.securityNoteOAuth", { name: app?.name })}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCredentialsDialogOpen(false)} data-testid="button-cancel-credentials">
              {t("integrations.detail.connect.cancel")}
            </Button>
            <Button
              onClick={handleCredentialsSubmit}
              disabled={connectMutation.isPending || !clientId.trim() || !clientSecret.trim()}
              data-testid="button-submit-credentials"
            >
              {connectMutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <ExternalLink className="w-4 h-4 mr-1.5" />}
              {connectMutation.isPending ? t("integrations.detail.connect.connecting") : isApiKeyProvider ? t("integrations.detail.connect.connectButton") : t("integrations.detail.connect.connectAuthorize")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
