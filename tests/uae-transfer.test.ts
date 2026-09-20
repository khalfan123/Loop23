/**
 * UAE-safe transfer caller-ID contract tests.
 *
 * Covers:
 *  1. resolveTransferDialCallerId / resolveHumanAgentBridgeCallerId resolver matrix.
 *  2. generateTransferTwiML in both AI engines (omits callerId attribute when undefined,
 *     escapes XML when present).
 *  3. Per-direction inboundDid selection that executeTransfer feeds into the resolver
 *     (callDirection==='inbound' ? toNumber : fromNumber), plus the unified
 *     [Transfer] log source classification (wizard | env | inbound | omitted).
 *
 * Run: pnpm --filter @workspace/loop23 exec tsx tests/uae-transfer.test.ts
 */

import assert from 'node:assert/strict';

import {
  resolveHumanAgentBridgeCallerId,
  resolveTransferDialCallerId,
  isUaeE164,
} from '../server/utils/phone-e164';
import { generateTransferTwiML as generateTransferTwiMLOpenAI } from '../server/engines/twilio-openai/config/twilio-openai-config';
import { generateTransferTwiML as generateTransferTwiMLBedrock } from '../server/engines/twilio-bedrock-polly/config/config';

type TestFn = () => void | Promise<void>;
const failures: Array<{ name: string; err: unknown }> = [];
let passed = 0;

function test(name: string, fn: TestFn): void {
  try {
    const r = fn();
    if (r instanceof Promise) {
      throw new Error(`Async tests not supported: ${name}`);
    }
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    failures.push({ name, err });
    console.log(`  FAIL ${name}`);
  }
}

function withEnv<T>(env: Record<string, string | undefined>, fn: () => T): T {
  const prev: Record<string, string | undefined> = {};
  for (const k of Object.keys(env)) {
    prev[k] = process.env[k];
    if (env[k] === undefined) delete process.env[k];
    else process.env[k] = env[k]!;
  }
  try {
    return fn();
  } finally {
    for (const k of Object.keys(prev)) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k]!;
    }
  }
}

/* Mirror the engine's source classification verbatim so a drift between
 * test and engine logic is visible. */
function classifySource(
  callerId: string | undefined,
  humanWizardCli: string | undefined,
): 'wizard' | 'env' | 'inbound' | 'omitted' {
  const envCli = process.env.TWILIO_TRANSFER_CALLER_ID?.trim().replace(/[\s\-().]/g, '');
  if (callerId && humanWizardCli && callerId === humanWizardCli) return 'wizard';
  if (callerId && envCli && callerId === envCli) return 'env';
  if (callerId) return 'inbound';
  return 'omitted';
}

function resolveForDirection(opts: {
  callDirection: 'inbound' | 'outbound';
  fromNumber: string;
  toNumber: string;
  humanWizardCli?: string;
}): { callerId: string | undefined; source: 'wizard' | 'env' | 'inbound' | 'omitted' } {
  const inboundDid = opts.callDirection === 'inbound' ? opts.toNumber : opts.fromNumber;
  const callerId = resolveHumanAgentBridgeCallerId({
    wizardOutboundPhoneE164: opts.humanWizardCli,
    inboundDid,
  });
  return { callerId, source: classifySource(callerId, opts.humanWizardCli) };
}

console.log('\n# isUaeE164');
test('detects +971 prefix', () => assert.equal(isUaeE164('+971501234567'), true));
test('detects bare 971 prefix', () => assert.equal(isUaeE164('971501234567'), true));
test('rejects non-UAE +44', () => assert.equal(isUaeE164('+447911123456'), false));
test('rejects empty', () => assert.equal(isUaeE164(''), false));

console.log('\n# resolveTransferDialCallerId');
test('env var wins over inbound', () =>
  withEnv({ TWILIO_TRANSFER_CALLER_ID: '+447900000001' }, () => {
    assert.equal(resolveTransferDialCallerId('+971501234567'), '+447900000001');
  }));

test('UAE inbound mobile is omitted (no env)', () =>
  withEnv({ TWILIO_TRANSFER_CALLER_ID: undefined }, () => {
    assert.equal(resolveTransferDialCallerId('+971501234567'), undefined);
  }));

test('UAE inbound landline is omitted (no env)', () =>
  withEnv({ TWILIO_TRANSFER_CALLER_ID: undefined }, () => {
    assert.equal(resolveTransferDialCallerId('+97142223344'), undefined);
  }));

test('UAE toll-free inbound is omitted (no env)', () =>
  withEnv({ TWILIO_TRANSFER_CALLER_ID: undefined }, () => {
    assert.equal(resolveTransferDialCallerId('+9718001234'), undefined);
  }));

test('non-UAE inbound (+44) returned as-is (no env)', () =>
  withEnv({ TWILIO_TRANSFER_CALLER_ID: undefined }, () => {
    assert.equal(resolveTransferDialCallerId('+447911123456'), '+447911123456');
  }));

test('non-UAE inbound (+1) returned as-is (no env)', () =>
  withEnv({ TWILIO_TRANSFER_CALLER_ID: undefined }, () => {
    assert.equal(resolveTransferDialCallerId('+14155550100'), '+14155550100');
  }));

test('empty inbound + no env => undefined', () =>
  withEnv({ TWILIO_TRANSFER_CALLER_ID: undefined }, () => {
    assert.equal(resolveTransferDialCallerId(undefined), undefined);
    assert.equal(resolveTransferDialCallerId(''), undefined);
  }));

test('bare-digit inbound is normalized with +', () =>
  withEnv({ TWILIO_TRANSFER_CALLER_ID: undefined }, () => {
    assert.equal(resolveTransferDialCallerId('14155550100'), '+14155550100');
  }));

test('invalid env var falls through to inbound rules', () =>
  withEnv({ TWILIO_TRANSFER_CALLER_ID: 'not-a-number' }, () => {
    assert.equal(resolveTransferDialCallerId('+447911123456'), '+447911123456');
    assert.equal(resolveTransferDialCallerId('+971501234567'), undefined);
  }));

console.log('\n# resolveHumanAgentBridgeCallerId');
test('wizard non-UAE pick wins over env and inbound', () =>
  withEnv({ TWILIO_TRANSFER_CALLER_ID: '+447900000001' }, () => {
    const out = resolveHumanAgentBridgeCallerId({
      wizardOutboundPhoneE164: '+12025550199',
      inboundDid: '+971501234567',
    });
    assert.equal(out, '+12025550199');
  }));

test('wizard UAE pick rejected, falls through to env', () =>
  withEnv({ TWILIO_TRANSFER_CALLER_ID: '+447900000001' }, () => {
    const out = resolveHumanAgentBridgeCallerId({
      wizardOutboundPhoneE164: '+971501234567',
      inboundDid: '+971501234567',
    });
    assert.equal(out, '+447900000001');
  }));

test('wizard UAE pick rejected, no env, UAE inbound => undefined (omitted)', () =>
  withEnv({ TWILIO_TRANSFER_CALLER_ID: undefined }, () => {
    const out = resolveHumanAgentBridgeCallerId({
      wizardOutboundPhoneE164: '+971501234567',
      inboundDid: '+971501234567',
    });
    assert.equal(out, undefined);
  }));

test('no wizard, no env, non-UAE inbound returned', () =>
  withEnv({ TWILIO_TRANSFER_CALLER_ID: undefined }, () => {
    const out = resolveHumanAgentBridgeCallerId({
      wizardOutboundPhoneE164: undefined,
      inboundDid: '+447911123456',
    });
    assert.equal(out, '+447911123456');
  }));

test('wizard bare-digit non-UAE normalized', () =>
  withEnv({ TWILIO_TRANSFER_CALLER_ID: undefined }, () => {
    const out = resolveHumanAgentBridgeCallerId({
      wizardOutboundPhoneE164: '12025550199',
      inboundDid: '+971501234567',
    });
    assert.equal(out, '+12025550199');
  }));

test('whitespace-only wizard ignored', () =>
  withEnv({ TWILIO_TRANSFER_CALLER_ID: '+447900000001' }, () => {
    const out = resolveHumanAgentBridgeCallerId({
      wizardOutboundPhoneE164: '   ',
      inboundDid: '+971501234567',
    });
    assert.equal(out, '+447900000001');
  }));

console.log('\n# generateTransferTwiML — twilio-openai engine');
test('omits callerId attribute when undefined', () => {
  const xml = generateTransferTwiMLOpenAI('+971501234567', undefined);
  assert.ok(xml.includes('<Dial timeout='), `expected bare <Dial timeout=...>, got: ${xml}`);
  assert.ok(!xml.includes('callerId='), `expected no callerId attr, got: ${xml}`);
  assert.ok(xml.includes('<Number>+971501234567</Number>'));
});

test('renders escaped callerId when set', () => {
  const xml = generateTransferTwiMLOpenAI('+971501234567', '+447900000001');
  assert.ok(xml.includes('callerId="+447900000001"'), `missing callerId attr: ${xml}`);
});

test('escapes XML special chars in numbers', () => {
  const xml = generateTransferTwiMLOpenAI('+971&501234567', '+44<7900>000001');
  assert.ok(xml.includes('callerId="+44&lt;7900&gt;000001"'));
  assert.ok(xml.includes('<Number>+971&amp;501234567</Number>'));
});

console.log('\n# generateTransferTwiML — twilio-bedrock-polly engine');
test('omits callerId attribute when undefined', () => {
  const xml = generateTransferTwiMLBedrock('+971501234567', undefined);
  assert.ok(xml.includes('<Dial>'), `expected bare <Dial>, got: ${xml}`);
  assert.ok(!xml.includes('callerId='), `expected no callerId attr, got: ${xml}`);
  assert.ok(xml.includes('<Number>+971501234567</Number>'));
});

test('renders escaped callerId when set', () => {
  const xml = generateTransferTwiMLBedrock('+971501234567', '+447900000001');
  assert.ok(xml.includes('<Dial callerId="+447900000001">'), `missing callerId attr: ${xml}`);
});

test('escapes XML special chars in numbers', () => {
  const xml = generateTransferTwiMLBedrock('+971&501234567', '+44<7900>000001');
  assert.ok(xml.includes('callerId="+44&lt;7900&gt;000001"'));
  assert.ok(xml.includes('<Number>+971&amp;501234567</Number>'));
});

console.log('\n# executeTransfer inputs (per-direction inboundDid + source)');
test('inbound: uses toNumber as inboundDid; UAE customer, UAE Twilio DID, no wizard => omitted', () =>
  withEnv({ TWILIO_TRANSFER_CALLER_ID: undefined }, () => {
    const out = resolveForDirection({
      callDirection: 'inbound',
      fromNumber: '+971555550111', // UAE caller
      toNumber: '+9718001234', // UAE toll-free Twilio DID
      humanWizardCli: undefined,
    });
    assert.equal(out.callerId, undefined);
    assert.equal(out.source, 'omitted');
  }));

test('inbound: wizard non-UAE pick wins over UAE inbound DID', () =>
  withEnv({ TWILIO_TRANSFER_CALLER_ID: undefined }, () => {
    const out = resolveForDirection({
      callDirection: 'inbound',
      fromNumber: '+971555550111',
      toNumber: '+9718001234',
      humanWizardCli: '+12025550199',
    });
    assert.equal(out.callerId, '+12025550199');
    assert.equal(out.source, 'wizard');
  }));

test('inbound: env wins when no wizard, regardless of UAE inbound DID', () =>
  withEnv({ TWILIO_TRANSFER_CALLER_ID: '+447900000001' }, () => {
    const out = resolveForDirection({
      callDirection: 'inbound',
      fromNumber: '+971555550111',
      toNumber: '+9718001234',
      humanWizardCli: undefined,
    });
    assert.equal(out.callerId, '+447900000001');
    assert.equal(out.source, 'env');
  }));

test('outbound: uses fromNumber as inboundDid; non-UAE Twilio DID returned', () =>
  withEnv({ TWILIO_TRANSFER_CALLER_ID: undefined }, () => {
    const out = resolveForDirection({
      callDirection: 'outbound',
      fromNumber: '+447900000001', // Twilio-owned outbound CLI
      toNumber: '+971501234567', // UAE customer
      humanWizardCli: undefined,
    });
    assert.equal(out.callerId, '+447900000001');
    assert.equal(out.source, 'inbound');
  }));

test('outbound: UAE Twilio DID without wizard/env => omitted', () =>
  withEnv({ TWILIO_TRANSFER_CALLER_ID: undefined }, () => {
    const out = resolveForDirection({
      callDirection: 'outbound',
      fromNumber: '+9718001234',
      toNumber: '+971501234567',
      humanWizardCli: undefined,
    });
    assert.equal(out.callerId, undefined);
    assert.equal(out.source, 'omitted');
  }));

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  for (const { name, err } of failures) {
    console.error(`\nFAILED: ${name}`);
    console.error(err);
  }
  process.exit(1);
}
