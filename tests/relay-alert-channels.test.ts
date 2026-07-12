/**
 * relay-alert-channels contract tests.
 *
 * Verifies that the monitor's external dispatch path forwards the same
 * throttled payload to the configured workspace channels:
 *   1. neither channel enabled -> no email, no webhook
 *   2. email enabled, no override -> sends to workspace owner email
 *   3. email enabled with override -> sends to override
 *   4. webhook enabled -> POSTs signed payload to configured URL
 *   5. cooldown still applies -> only one external dispatch per cooldown
 *      window even if many cleanup events fire after the threshold
 *   6. unknown workspace (no userId) -> dispatcher is a no-op
 *
 * Run: pnpm --filter @workspace/loop23 exec tsx tests/relay-alert-channels.test.ts
 */

import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { recordRelayCleanup, __test__ as monitorTest } from '../server/services/relay-cleanup-monitor';
import {
  __test__ as channelsTest,
  dispatchRelayAlert,
  settingKeyFor,
  type RelayAlertDeliveryConfig,
  type RelayAlertPayload,
} from '../server/services/relay-alert-channels';
import { storage } from '../server/storage';
import { emailService } from '../server/services/email-service';

const { THRESHOLD } = monitorTest.config;

type EmailCall = { to: string; subject: string; html: string };
type WebhookCall = { url: string; headers: Record<string, string>; body: string };

let emailCalls: EmailCall[] = [];
let webhookCalls: WebhookCall[] = [];
let configByKey: Map<string, RelayAlertDeliveryConfig> = new Map();
let usersByIdEmail: Map<string, string> = new Map();

const origGetGlobalSetting = storage.getGlobalSetting.bind(storage);
const origGetUser = storage.getUser.bind(storage);
const origSendEmail = emailService.sendEmail.bind(emailService);

function installStubs(): void {
  configByKey = new Map();
  usersByIdEmail = new Map();
  emailCalls = [];
  webhookCalls = [];

  (storage as any).getGlobalSetting = async (key: string) => {
    if (configByKey.has(key)) return { id: 'stub', key, value: configByKey.get(key)!, description: null, updatedAt: new Date(), updatedBy: null } as any;
    return undefined;
  };
  (storage as any).getUser = async (id: string) => {
    if (usersByIdEmail.has(id)) return { id, email: usersByIdEmail.get(id)!, name: 'Stub' } as any;
    return undefined;
  };
  (emailService as any).sendEmail = async (to: string, subject: string, html: string) => {
    emailCalls.push({ to, subject, html });
    return { success: true, messageId: 'stub-msg-id' };
  };
  channelsTest.setFetch(async (url, init) => {
    webhookCalls.push({ url, headers: init.headers, body: init.body });
    return { ok: true, status: 200 };
  });
}

function restoreStubs(): void {
  (storage as any).getGlobalSetting = origGetGlobalSetting;
  (storage as any).getUser = origGetUser;
  (emailService as any).sendEmail = origSendEmail;
  channelsTest.resetFetch();
}

function installNoopNotifier(): void {
  monitorTest.setNotifier({
    async notifyAdmins() { /* no-op */ },
    async create() { /* no-op */ },
  });
  monitorTest.setEnricher({ async lookupByCallSid() { return null; } });
}

const failures: Array<{ name: string; err: unknown }> = [];
let passed = 0;

async function test(name: string, fn: () => Promise<void> | void): Promise<void> {
  monitorTest.reset();
  installStubs();
  installNoopNotifier();
  try {
    await fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    failures.push({ name, err });
    console.log(`  FAIL ${name}`);
  } finally {
    restoreStubs();
  }
}

async function fireThreshold(userId: string, base = 'CA'): Promise<void> {
  for (let i = 0; i <= THRESHOLD; i++) {
    await recordRelayCleanup({
      callSid: `${base}${i}`,
      userId,
      connectionId: 'conn-1',
      target: '+97150111222',
      relay: '+15125550100',
      reason: 'hop2-no-answer',
    });
  }
}

console.log('Relay alert channels:');

await test('neither channel enabled -> no external delivery', async () => {
  configByKey.set(settingKeyFor('ws-A'), {
    emailEnabled: false,
    webhookEnabled: false,
  });
  usersByIdEmail.set('ws-A', 'owner@example.com');
  await fireThreshold('ws-A');
  assert.equal(emailCalls.length, 0);
  assert.equal(webhookCalls.length, 0);
});

await test('email enabled, no override -> uses workspace owner email', async () => {
  configByKey.set(settingKeyFor('ws-A'), {
    emailEnabled: true,
    webhookEnabled: false,
  });
  usersByIdEmail.set('ws-A', 'owner@example.com');
  await fireThreshold('ws-A');
  assert.equal(emailCalls.length, 1);
  assert.equal(emailCalls[0].to, 'owner@example.com');
  assert.match(emailCalls[0].subject, /Human-agent transfers are failing/);
  assert.match(emailCalls[0].html, /\+97150111222/);
  assert.match(emailCalls[0].html, /\+15125550100/);
});

await test('email enabled with override -> uses override address', async () => {
  configByKey.set(settingKeyFor('ws-A'), {
    emailEnabled: true,
    emailTo: 'oncall@example.com',
    webhookEnabled: false,
  });
  usersByIdEmail.set('ws-A', 'owner@example.com');
  await fireThreshold('ws-A');
  assert.equal(emailCalls.length, 1);
  assert.equal(emailCalls[0].to, 'oncall@example.com');
});

await test('webhook enabled -> POSTs signed payload', async () => {
  const secret = 's3cret';
  configByKey.set(settingKeyFor('ws-A'), {
    emailEnabled: false,
    webhookEnabled: true,
    webhookUrl: 'https://hook.example.com/relay-alert',
    webhookSecret: secret,
  });
  await fireThreshold('ws-A');
  assert.equal(webhookCalls.length, 1);
  const call = webhookCalls[0];
  assert.equal(call.url, 'https://hook.example.com/relay-alert');
  assert.equal(call.headers['Content-Type'], 'application/json');
  assert.equal(call.headers['X-Webhook-Event'], 'human_agent_relay.failures_threshold');
  const expectedSig = 'sha256=' + crypto.createHmac('sha256', secret).update(call.body).digest('hex');
  assert.equal(call.headers['X-Webhook-Signature'], expectedSig);
  const parsed = JSON.parse(call.body);
  assert.equal(parsed.event, 'human_agent_relay.failures_threshold');
  assert.equal(parsed.data.userId, 'ws-A');
  assert.equal(parsed.data.count, THRESHOLD + 1);
  assert.deepEqual(parsed.data.targets, ['+97150111222']);
  assert.deepEqual(parsed.data.relays, ['+15125550100']);
});

await test('webhook without secret -> no signature header', async () => {
  configByKey.set(settingKeyFor('ws-A'), {
    emailEnabled: false,
    webhookEnabled: true,
    webhookUrl: 'https://hook.example.com/relay-alert',
  });
  await fireThreshold('ws-A');
  assert.equal(webhookCalls.length, 1);
  assert.equal(webhookCalls[0].headers['X-Webhook-Signature'], undefined);
});

await test('cooldown caps external deliveries to one per window', async () => {
  configByKey.set(settingKeyFor('ws-A'), {
    emailEnabled: true,
    webhookEnabled: true,
    webhookUrl: 'https://hook.example.com/relay-alert',
    webhookSecret: 'x',
  });
  usersByIdEmail.set('ws-A', 'owner@example.com');
  // Fire well above threshold; should still only deliver once per channel.
  for (let i = 0; i < THRESHOLD * 4; i++) {
    await recordRelayCleanup({ callSid: `CA${i}`, userId: 'ws-A', reason: 'hop2-no-answer' });
  }
  assert.equal(emailCalls.length, 1);
  assert.equal(webhookCalls.length, 1);
});

await test('unknown workspace (no userId) -> dispatcher is no-op', async () => {
  await dispatchRelayAlert({
    userId: null,
    count: 99,
    windowMs: 60000,
    reasons: 'hop2-busy×99',
    targets: [],
    relays: [],
    connections: [],
    message: 'should not deliver',
    occurredAt: new Date().toISOString(),
  } satisfies RelayAlertPayload);
  assert.equal(emailCalls.length, 0);
  assert.equal(webhookCalls.length, 0);
});

await test('sanitizeConfig coerces missing/invalid values', () => {
  const a = channelsTest.sanitizeConfig({ emailEnabled: 'yes', webhookUrl: '   ' });
  assert.deepEqual(a, {
    emailEnabled: false,
    emailTo: null,
    webhookEnabled: false,
    webhookUrl: null,
    webhookSecret: null,
  });
  const b = channelsTest.sanitizeConfig(null);
  assert.equal(b, null);
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.error(`FAIL ${f.name}:`, f.err);
  process.exit(1);
}
