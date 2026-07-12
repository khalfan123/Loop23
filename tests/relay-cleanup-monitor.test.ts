/**
 * relay-cleanup-monitor contract tests.
 *
 * Verifies:
 *  1. Sub-threshold cleanup events do NOT trigger alerts.
 *  2. Crossing the threshold within the window triggers exactly one alert
 *     (admin + workspace owner) with workspace context.
 *  3. Per-workspace cooldown suppresses repeat alerts within the window.
 *  4. Events are partitioned per workspace (one workspace's bursts do not
 *     trip another workspace's threshold).
 *  5. Unknown-workspace events bucket under '__unknown__' and do not crash;
 *     enrichment via the injected lookup populates target/relay/userId.
 *
 * Run: pnpm --filter @workspace/loop23 exec tsx tests/relay-cleanup-monitor.test.ts
 */

import assert from 'node:assert/strict';

import { recordRelayCleanup, __test__ } from '../server/services/relay-cleanup-monitor';

const { THRESHOLD } = __test__.config;

type Notification = {
  kind: 'admin' | 'owner';
  title: string;
  message: string;
  userId?: string;
  severity?: string;
};

let sent: Notification[] = [];

function installFakeNotifier(): void {
  __test__.setNotifier({
    async notifyAdmins(title, message, severity) {
      sent.push({ kind: 'admin', title, message, severity });
    },
    async create(opts) {
      sent.push({ kind: 'owner', userId: opts.userId, title: opts.title, message: opts.message });
    },
  });
}

function installEmptyEnricher(): void {
  __test__.setEnricher({ async lookupByCallSid() { return null; } });
}

function installNoopDispatcher(): void {
  __test__.setExternalDispatcher({ async dispatch() { /* no-op for in-app alert tests */ } });
}

const failures: Array<{ name: string; err: unknown }> = [];
let passed = 0;

async function test(name: string, fn: () => Promise<void> | void): Promise<void> {
  __test__.reset();
  installFakeNotifier();
  installEmptyEnricher();
  installNoopDispatcher();
  sent = [];
  try {
    await fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    failures.push({ name, err });
    console.log(`  FAIL ${name}`);
  }
}

console.log('Relay cleanup monitor:');

await test('sub-threshold events do not alert', async () => {
  for (let i = 0; i < THRESHOLD; i++) {
    await recordRelayCleanup({ callSid: `CA${i}`, userId: 'workspace-A', reason: 'hop2-no-answer' });
  }
  assert.equal(sent.length, 0);
});

await test('crossing threshold triggers admin + owner alert with context', async () => {
  for (let i = 0; i <= THRESHOLD; i++) {
    await recordRelayCleanup({
      callSid: `CA${i}`,
      userId: 'workspace-A',
      connectionId: 'conn-1',
      target: '+97150111222',
      relay: '+15125550100',
      reason: i % 2 === 0 ? 'hop2-no-answer' : 'hop2-failed',
    });
  }
  assert.equal(sent.length, 2);
  const admin = sent.find((n) => n.kind === 'admin')!;
  const owner = sent.find((n) => n.kind === 'owner')!;
  assert.ok(admin.message.includes('workspace-A'));
  assert.ok(admin.message.includes('+97150111222'));
  assert.ok(admin.message.includes('+15125550100'));
  assert.ok(admin.message.includes('conn-1'));
  assert.equal(admin.severity, 'warning');
  assert.equal(owner.userId, 'workspace-A');
});

await test('cooldown suppresses repeat alerts in same window', async () => {
  for (let i = 0; i < THRESHOLD * 3; i++) {
    await recordRelayCleanup({ callSid: `CA${i}`, userId: 'workspace-A', reason: 'hop2-busy' });
  }
  assert.equal(sent.filter((n) => n.kind === 'admin').length, 1);
  assert.equal(sent.filter((n) => n.kind === 'owner').length, 1);
});

await test('events are partitioned per workspace', async () => {
  for (let i = 0; i < THRESHOLD; i++) {
    await recordRelayCleanup({ callSid: `A${i}`, userId: 'workspace-A', reason: 'hop2-no-answer' });
    await recordRelayCleanup({ callSid: `B${i}`, userId: 'workspace-B', reason: 'hop2-no-answer' });
  }
  assert.equal(sent.length, 0);
  await recordRelayCleanup({ callSid: 'A-overflow', userId: 'workspace-A', reason: 'hop2-no-answer' });
  assert.equal(sent.length, 2);
  for (const n of sent) {
    if (n.kind === 'admin') assert.ok(n.message.includes('workspace-A'));
    else assert.equal(n.userId, 'workspace-A');
  }
});

await test('enrichment via lookup recovers userId/target/relay when only callSid known', async () => {
  __test__.setEnricher({
    async lookupByCallSid(callSid) {
      if (callSid.startsWith('CA')) {
        return { userId: 'workspace-A', transferredTo: '+97142345678', transferRelayPhoneNumber: '+15125550100' };
      }
      return null;
    },
  });
  for (let i = 0; i <= THRESHOLD; i++) {
    await recordRelayCleanup({ callSid: `CA${i}`, reason: 'hop2-busy' });
  }
  assert.equal(sent.filter((n) => n.kind === 'admin').length, 1);
  assert.equal(sent.filter((n) => n.kind === 'owner').length, 1);
  assert.ok(sent[0].message.includes('workspace-A'));
  assert.ok(sent[0].message.includes('+97142345678'));
});

await test('unknown workspace events bucket and do not crash', async () => {
  for (let i = 0; i <= THRESHOLD; i++) {
    await recordRelayCleanup({ callSid: `U${i}`, reason: 'hop2-create-failed' });
  }
  assert.equal(sent.filter((n) => n.kind === 'admin').length, 1);
  assert.equal(sent.filter((n) => n.kind === 'owner').length, 0);
  assert.ok(sent[0].message.includes('unknown workspace'));
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.error(`FAIL ${f.name}:`, f.err);
  process.exit(1);
}
