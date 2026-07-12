/* eslint-disable @typescript-eslint/no-explicit-any */
'use strict';

import crypto from 'crypto';
import { n8nService } from './n8n';
import { validateConciergeRecipe } from '../constants/platform-webhook-events';

export type GenericAuthType = 'none' | 'bearer' | 'basic' | 'header';

export interface ConciergeFilter {
  /** When non-empty, only payloads whose data.campaignId is in this list pass. */
  campaignIds?: string[];
  /** Optional single condition evaluated against the inbound payload. */
  condition?: {
    field: string;
    op: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
    value: string;
  } | null;
}

export interface ConciergeGenericAction {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Array<{ name: string; value: string }>;
  bodyTemplate?: string;
  auth: {
    type: GenericAuthType;
    /** For bearer/header: header value placed on Authorization (or `headerName`). */
    token?: string;
    headerName?: string;
    /** For basic auth. */
    username?: string;
    password?: string;
  };
}

export type ConciergeRecipe = {
  version: 1;
  name: string;
  // Platform event that triggers this integration (e.g. call.completed)
  triggerEvent: string;
  destination: { slug: string; subdomain?: string };
  /** "native" = built-in compiler path (zendesk/slack/hubspot); "generic" = HTTP adapter. */
  mode?: 'native' | 'generic';
  intent: 'platform_event_to_external_action';
  mapping?: Record<string, any>;
  filter?: ConciergeFilter;
  action?: ConciergeGenericAction;
  credentialsRequired: Array<Record<string, any>>;
};

export async function compileConciergeRecipeToWorkflow(args: {
  userId: string;
  recipe: ConciergeRecipe;
  inputs: Record<string, any>;
}): Promise<{
  workflowId: string;
  workflowName: string;
  webhookUrl: string;
  primaryCredentialId: string;
  credentialIds: Record<string, string>;
}> {
  const { userId, recipe, inputs } = args;

  const v = validateConciergeRecipe(recipe);
  if (!v.ok) throw new Error(v.error);

  if (n8nService.isLocalMode()) {
    return {
      workflowId: `local_${crypto.randomBytes(8).toString('hex')}`,
      workflowName: `Local — ${recipe.name}`,
      webhookUrl: n8nService.getWebhookUrl(userId, `concierge-${Date.now()}`),
      primaryCredentialId: `local_${crypto.randomBytes(8).toString('hex')}`,
      credentialIds: {},
    };
  }

  const destination = recipe.destination?.slug;
  if (!destination) throw new Error('Missing recipe.destination.slug');
  const triggerEvent = String(recipe.triggerEvent || '').trim();
  if (!triggerEvent) throw new Error('Missing recipe.triggerEvent');

  const mode: 'native' | 'generic' =
    recipe.mode || (isNativeDestination(destination) ? 'native' : 'generic');

  const webhookSlug = `concierge-${destination}-${crypto.randomBytes(4).toString('hex')}`;
  const webhookPath = `loop9-${userId}-${webhookSlug}`;
  const webhookUrl = `${n8nService.baseUrl()}/webhook/${webhookPath}`;

  const workflowName = `Concierge → ${triggerEvent} → ${destination} (User ${userId})`;

  const nodes: any[] = [
    {
      parameters: {
        path: webhookPath,
        httpMethod: 'POST',
        responseMode: 'onReceived',
        options: {},
      },
      name: 'Incoming Webhook',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 1,
      position: [260, 300],
    },
  ];

  // ── Filter nodes (apply before the action) ───────────────────────────
  // These are inserted right after the webhook so that if the payload
  // doesn't pass, downstream action nodes never execute.
  let nextX = 520;
  const filter = recipe.filter || {};
  if (Array.isArray(filter.campaignIds) && filter.campaignIds.length > 0) {
    nodes.push({
      parameters: {
        conditions: {
          string: filter.campaignIds.map((id) => ({
            value1: '={{ $json.data?.campaignId || $json.campaignId }}',
            operation: 'equals',
            value2: String(id),
          })),
        },
        combineOperation: 'any',
      },
      name: 'Campaign Allowlist',
      type: 'n8n-nodes-base.if',
      typeVersion: 1,
      position: [nextX, 300],
    });
    nextX += 260;
  }
  if (filter.condition && filter.condition.field) {
    nodes.push({
      parameters: {
        conditions: {
          string: [
            {
              value1: `={{ $json.${filter.condition.field} }}`,
              operation: mapFilterOp(filter.condition.op),
              value2: filter.condition.value,
            },
          ],
        },
      },
      name: 'Payload Condition',
      type: 'n8n-nodes-base.if',
      typeVersion: 1,
      position: [nextX, 300],
    });
    nextX += 260;
  }

  const credentialIds: Record<string, string> = {};
  let primaryCredentialId = '';

  if (mode === 'native' && destination === 'zendesk') {
    const zendeskSubdomain = String(inputs.zendeskSubdomain || recipe.destination.subdomain || '').trim();
    const zendeskEmail = String(inputs.zendeskEmail || '').trim();
    const zendeskApiToken = String(inputs.zendeskApiToken || '').trim();
    if (!zendeskSubdomain) throw new Error('Missing zendeskSubdomain');
    if (!zendeskEmail) throw new Error('Missing zendeskEmail');
    if (!zendeskApiToken) throw new Error('Missing zendeskApiToken');

    const zendeskCred = await n8nService.createCredentialWithData({
      name: `Zendesk_${zendeskSubdomain}_user_${userId}`,
      type: 'httpBasicAuth',
      data: { user: `${zendeskEmail}/token`, password: zendeskApiToken },
    });
    credentialIds.zendesk = zendeskCred.id;
    primaryCredentialId = zendeskCred.id;

    const zendeskTicketUrl = `https://${zendeskSubdomain}.zendesk.com/api/v2/tickets.json`;
    nodes.push(
      {
        parameters: {
          values: {
            string: [
              { name: 'subject', value: '={{$json.data?.call?.id ? `Call completed: ${$json.data.call.id}` : "Call completed"} }' },
              { name: 'body', value: '={{ JSON.stringify($json, null, 2) }}' },
              { name: 'priority', value: 'normal' },
            ],
          },
          options: {},
        },
        name: 'Build Ticket',
        type: 'n8n-nodes-base.set',
        typeVersion: 2,
        position: [nextX, 300],
      },
      {
        parameters: {
          method: 'POST',
          url: zendeskTicketUrl,
          authentication: 'predefinedCredentialType',
          sendHeaders: true,
          headerParameters: { parameters: [{ name: 'Content-Type', value: 'application/json' }] },
          sendBody: true,
          specifyBody: 'json',
          jsonBody: `={\n  "ticket": {\n    "subject": "{{$json.subject}}",\n    "comment": { "body": "{{$json.body}}" },\n    "priority": "{{$json.priority}}"\n  }\n}`,
          options: {},
        },
        name: 'Create Zendesk Ticket',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4,
        position: [nextX + 280, 300],
        credentials: { httpBasicAuth: { id: zendeskCred.id, name: zendeskCred.name } },
      },
    );
  } else if (mode === 'native' && destination === 'slack') {
    const slackBotToken = String(inputs.slackBotToken || '').trim();
    const slackChannel = String(inputs.slackChannel || '').trim();
    if (!slackBotToken) throw new Error('Missing slackBotToken');
    if (!slackChannel) throw new Error('Missing slackChannel');

    const slackCred = await n8nService.createCredentialWithData({
      name: `Slack_user_${userId}`,
      type: 'httpHeaderAuth',
      data: { name: 'Authorization', value: `Bearer ${slackBotToken}` },
    });
    credentialIds.slack = slackCred.id;
    primaryCredentialId = slackCred.id;

    nodes.push(
      {
        parameters: {
          values: {
            string: [
              { name: 'channel', value: slackChannel },
              { name: 'text', value: '={{`Event: ${$json.event}\\nCall: ${$json.data?.call?.id || "n/a"}\\nContact: ${$json.data?.contact?.name || "n/a"}`}}' },
            ],
          },
          options: {},
        },
        name: 'Build Slack Message',
        type: 'n8n-nodes-base.set',
        typeVersion: 2,
        position: [nextX, 300],
      },
      {
        parameters: {
          method: 'POST',
          url: 'https://slack.com/api/chat.postMessage',
          authentication: 'predefinedCredentialType',
          sendHeaders: true,
          headerParameters: { parameters: [{ name: 'Content-Type', value: 'application/json; charset=utf-8' }] },
          sendBody: true,
          specifyBody: 'json',
          jsonBody: `={ "channel": "{{$json.channel}}", "text": "{{$json.text}}" }`,
          options: {},
        },
        name: 'Post to Slack',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4,
        position: [nextX + 280, 300],
        credentials: { httpHeaderAuth: { id: slackCred.id, name: slackCred.name } },
      },
    );
  } else if (mode === 'native' && destination === 'hubspot') {
    const hubspotToken = String(inputs.hubspotToken || '').trim();
    if (!hubspotToken) throw new Error('Missing hubspotToken');

    const hubspotCred = await n8nService.createCredentialWithData({
      name: `HubSpot_user_${userId}`,
      type: 'httpHeaderAuth',
      data: { name: 'Authorization', value: `Bearer ${hubspotToken}` },
    });
    credentialIds.hubspot = hubspotCred.id;
    primaryCredentialId = hubspotCred.id;

    nodes.push(
      {
        parameters: {
          values: {
            string: [
              { name: 'email', value: '={{$json.data?.contact?.email || ""}}' },
              { name: 'firstname', value: '={{$json.data?.contact?.name?.split(" ")?.[0] || ""}}' },
              { name: 'lastname', value: '={{$json.data?.contact?.name?.split(" ")?.slice(1).join(" ") || ""}}' },
            ],
          },
          options: {},
        },
        name: 'Build HubSpot Contact',
        type: 'n8n-nodes-base.set',
        typeVersion: 2,
        position: [nextX, 300],
      },
      {
        parameters: {
          method: 'POST',
          url: 'https://api.hubapi.com/crm/v3/objects/contacts',
          authentication: 'predefinedCredentialType',
          sendHeaders: true,
          headerParameters: { parameters: [{ name: 'Content-Type', value: 'application/json' }] },
          sendBody: true,
          specifyBody: 'json',
          jsonBody: `={ "properties": { "email": "{{$json.email}}", "firstname": "{{$json.firstname}}", "lastname": "{{$json.lastname}}" } }`,
          options: {},
        },
        name: 'Create HubSpot Contact',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4,
        position: [nextX + 280, 300],
        credentials: { httpHeaderAuth: { id: hubspotCred.id, name: hubspotCred.name } },
      },
    );
  } else if (mode === 'generic') {
    if (!recipe.action || !recipe.action.url) {
      throw new Error('Missing recipe.action.url for generic destination');
    }
    const action = recipe.action;
    const credentialResult = await maybeCreateGenericCredential({
      userId,
      destination,
      auth: action.auth,
      inputs,
    });
    if (credentialResult) {
      credentialIds[destination] = credentialResult.id;
      primaryCredentialId = credentialResult.id;
    }
    // Interpolate {{cred.<id>}} in URL/headers/body using the user-provided
    // credential inputs at compile time. {{trigger.<field>}} is rewritten to
    // n8n expression syntax so the runtime payload is injected.
    const interp = (input: string): string =>
      input
        .replace(/\{\{cred\.([^}]+)\}\}/g, (_, k) => String(inputs[k] ?? ''))
        .replace(/\{\{trigger\.([^}]+)\}\}/g, (_, k) => `{{ $json.${k} }}`);

    const headers = (action.headers || [])
      .filter((h) => h && h.name)
      .map((h) => ({ name: h.name, value: interp(h.value || '') }));
    const httpNode: any = {
      parameters: {
        method: action.method,
        url: interp(action.url),
        sendHeaders: headers.length > 0,
        headerParameters: { parameters: headers },
        sendBody: !!action.bodyTemplate,
        specifyBody: 'json',
        jsonBody: action.bodyTemplate ? `=${interp(action.bodyTemplate)}` : undefined,
        options: {},
      },
      name: `Send to ${destination}`,
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4,
      position: [nextX, 300],
    };
    if (credentialResult) {
      httpNode.parameters.authentication = 'predefinedCredentialType';
      httpNode.credentials = {
        [credentialResult.n8nType]: {
          id: credentialResult.id,
          name: credentialResult.name,
        },
      };
    }
    nodes.push(httpNode);
  } else {
    throw new Error(`Unsupported destination: ${destination}`);
  }

  const connections: Record<string, any> = (() => {
    // Always chain nodes in order. For IF nodes, we wire the "true" branch
    // (output index 0) to the next node so that filtered-out events drop.
    const chain: Record<string, any> = {};
    for (let i = 0; i < nodes.length - 1; i++) {
      chain[nodes[i].name] = { main: [[{ node: nodes[i + 1].name, type: 'main', index: 0 }]] };
    }
    return chain;
  })();

  const wf = await n8nService.createWorkflowFromJson({
    name: workflowName,
    nodes,
    connections,
    settings: { executionOrder: 'v1' },
  });

  await n8nService.activateWorkflow(wf.id);

  return {
    workflowId: wf.id,
    workflowName,
    webhookUrl,
    primaryCredentialId,
    credentialIds,
  };
}

function isNativeDestination(slug: string): boolean {
  return slug === 'zendesk' || slug === 'slack' || slug === 'hubspot';
}

function mapFilterOp(
  op: NonNullable<ConciergeFilter['condition']>['op'],
): string {
  // Map our portable operator names onto n8n IF-node operations for strings.
  switch (op) {
    case 'equals':
      return 'equals';
    case 'not_equals':
      return 'notEqual';
    case 'contains':
      return 'contains';
    case 'greater_than':
      return 'larger';
    case 'less_than':
      return 'smaller';
    default:
      return 'equals';
  }
}

async function maybeCreateGenericCredential(args: {
  userId: string;
  destination: string;
  auth: ConciergeGenericAction['auth'];
  inputs: Record<string, any>;
}): Promise<{ id: string; name: string; n8nType: string } | null> {
  const { userId, destination, auth, inputs } = args;
  if (!auth || auth.type === 'none') return null;
  if (auth.type === 'bearer') {
    const token =
      String(inputs.bearerToken || auth.token || '').trim();
    if (!token) throw new Error('Missing bearer token credential');
    const cred = await n8nService.createCredentialWithData({
      name: `${destination}_bearer_user_${userId}`,
      type: 'httpHeaderAuth',
      data: { name: 'Authorization', value: `Bearer ${token}` },
    });
    return { id: cred.id, name: cred.name, n8nType: 'httpHeaderAuth' };
  }
  if (auth.type === 'header') {
    const headerName = (auth.headerName || 'Authorization').trim();
    const value =
      String(inputs.authHeaderValue || auth.token || '').trim();
    if (!value) throw new Error('Missing custom header credential value');
    const cred = await n8nService.createCredentialWithData({
      name: `${destination}_header_user_${userId}`,
      type: 'httpHeaderAuth',
      data: { name: headerName, value },
    });
    return { id: cred.id, name: cred.name, n8nType: 'httpHeaderAuth' };
  }
  if (auth.type === 'basic') {
    const username = String(inputs.basicUsername || auth.username || '').trim();
    const password = String(inputs.basicPassword || auth.password || '').trim();
    if (!username || !password) throw new Error('Missing basic auth credential');
    const cred = await n8nService.createCredentialWithData({
      name: `${destination}_basic_user_${userId}`,
      type: 'httpBasicAuth',
      data: { user: username, password },
    });
    return { id: cred.id, name: cred.name, n8nType: 'httpBasicAuth' };
  }
  return null;
}
