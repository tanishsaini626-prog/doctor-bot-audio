/* ==========================================================================
 * Runs the REAL generated n8n Code nodes (code/*.js) with a stubbed $input/$,
 * simulates complete phone calls, and checks the workflow JSON files.
 *
 *   node --test tests/
 * ========================================================================== */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

/** Executes an n8n Code-node file exactly the way n8n does. */
function runNode(file, inputJson, webhookJson) {
  const src = read(file);
  const $input = { first: () => ({ json: inputJson }), all: () => [{ json: inputJson }] };
  const $ = (name) => {
    if (!webhookJson) throw new Error('no node named ' + name);
    return { first: () => ({ json: webhookJson }) };
  };
  const fn = new Function('$input', '$', src);
  return fn($input, $)[0].json;
}

const WEBHOOK = {
  webhookUrl: 'https://tannish13.app.n8n.cloud/webhook/doctor-bot',
  query: {},
};

/** Simulates one full phone call: turn by turn, exactly like the workflow. */
function simulateCall(utterances, phone = '+919760849372') {
  const turns = [];
  let state = {};
  for (const said of utterances) {
    const slots = runNode('code/slot-extraction.js', {
      final_transcript: said,
      patient_phone: phone,
      call_sid: 'CA-test',
      attempt: state.attempt,
      asked_field: state.asked_field,
      prev_name: state.name,
      prev_date: state.date,
      prev_time_slot: state.time_slot,
      prev_time_slot_display: state.time_slot_display,
      prev_reason: state.reason,
      prev_booking_for: state.booking_for,
      prev_missing_count: state.missing_count,
    }, WEBHOOK);

    if (slots.all_collected) {
      const confirmation = runNode('code/confirmation-message.js', slots, WEBHOOK);
      turns.push({ said, slots, ask: null, confirmation });
      return { turns, result: 'booked', confirmation, slots };
    }

    const ask = runNode('code/ask-missing-slot.js', slots, WEBHOOK);
    turns.push({ said, slots, ask });
    if (ask.gave_up) return { turns, result: ask.status || 'ended', ask, slots };
    state = { ...ask, missing_count: (slots.missing || []).length };
  }
  return { turns, result: 'call_still_open', state };
}

// ---------------------------------------------------------------- happy paths
test('one-sentence booking goes straight to the confirmation', () => {
  const call = simulateCall(['mera naam Priya Sharma hai, kal subah 10 baje bukhar ke liye appointment chahiye']);
  assert.equal(call.result, 'booked');
  assert.match(call.confirmation.twiml, /Priya Sharma/);
  assert.match(call.confirmation.twiml, /सुबह 10 बजे/);
  assert.match(call.confirmation.twiml, /<Hangup\/>/);
  assert.match(call.confirmation.whatsapp_message, /Patient Name: Priya Sharma/);
  assert.match(call.confirmation.whatsapp_message, /Medical Reason: Fever/);
  // no raw & or < from user data inside the XML
  assert.equal(/[^;]&[^a-z]/.test(call.confirmation.twiml.replace(/&amp;/g, '')), false);
});

test('four-turn booking with one correction books the corrected slot', () => {
  const call = simulateCall([
    'mera naam Riya hai',
    'kal',
    'subah 10 baje',
    'nahi, shaam 5 baje, sardi ke liye',
  ]);
  assert.equal(call.result, 'booked');
  assert.equal(call.slots.name, 'Riya');
  assert.equal(call.slots.time_slot, 'Evening 17:00');
  assert.equal(call.slots.reason, 'Cold');
  assert.match(call.confirmation.twiml, /शाम 5 बजे/);
});

test('the first question asks for the missing slot with a working Gather URL', () => {
  const call = simulateCall(['mujhe appointment chahiye']);
  assert.equal(call.result, 'call_still_open');
  const ask = call.turns[0].ask;
  assert.match(ask.twiml, /<Gather/);
  assert.match(ask.twiml, /actionOnEmptyResult="true"/);
  assert.match(ask.twiml, /https:\/\/tannish13\.app\.n8n\.cloud\/webhook\/gather\?/);
  assert.equal(ask.asked_field, 'name');
  assert.equal(ask.attempt, 1);
});

test('the Gather URL host follows the incoming webhook (no dead ngrok URL)', () => {
  const slots = runNode('code/slot-extraction.js', {
    final_transcript: 'appointment chahiye', patient_phone: '+911111111111', attempt: '',
  }, { webhookUrl: 'https://abc.ngrok-free.app/webhook/doctor-bot', query: {} });
  const ask = runNode('code/ask-missing-slot.js', slots, { webhookUrl: 'https://abc.ngrok-free.app/webhook/doctor-bot', query: {} });
  assert.match(ask.twiml, /https:\/\/abc\.ngrok-free\.app\/webhook\/gather\?/);
});

// ------------------------------------------------------------- closing paths
test('wrong number ends the call and asks for no row to be saved', () => {
  const call = simulateCall(['galat number hai, appointment nahi chahiye']);
  assert.equal(call.turns[0].ask.gave_up, false);       // -> not saved to the sheet
  assert.equal(call.turns[0].ask.status, 'Wrong Number');
  assert.match(call.turns[0].ask.twiml, /<Hangup\/>/);
});

test('emergency ends the call with 108 advice and an URGENT row', () => {
  const call = simulateCall(['seene me dard ho raha hai']);
  assert.equal(call.result, 'Emergency');
  assert.equal(call.turns[0].ask.gave_up, true);
  assert.equal(call.turns[0].ask.priority, 'URGENT');
  assert.match(call.turns[0].ask.twiml, /108/);
});

test('"busy right now" ends the call politely without saving', () => {
  const call = simulateCall(['abhi busy hoon, baad me call karta hoon']);
  assert.equal(call.turns[0].ask.gave_up, false);
  assert.equal(call.turns[0].ask.status, 'Callback');
});

test('three fruitless turns give up and save the partial row as Incomplete', () => {
  const call = simulateCall(['appointment chahiye', 'hmm', 'hello', 'hello']);
  assert.equal(call.result, 'Incomplete');
  const last = call.turns[call.turns.length - 1].ask;
  assert.equal(last.gave_up, true);
  assert.equal(last.status, 'Incomplete');
  assert.match(last.twiml, /<Hangup\/>/);
});

test('silence (empty speech result) re-asks instead of crashing', () => {
  const call = simulateCall(['mera naam Priya hai', '']);
  assert.equal(call.result, 'call_still_open');
  const ask = call.turns[1].ask;
  assert.match(ask.twiml, /सुनाई नहीं/);
  assert.equal(ask.name, 'Priya');
});

// ------------------------------------------------------------ sheet payloads
test('partial rows keep the display time slot and the real status', () => {
  const slots = runNode('code/slot-extraction.js', {
    final_transcript: 'mera naam Priya hai', patient_phone: '+9197', attempt: '',
  }, WEBHOOK);
  const ask = runNode('code/ask-missing-slot.js', slots, WEBHOOK);
  assert.equal(ask.status, 'Incomplete');                // not booked yet
  assert.equal(ask.gave_up, false);                      // still asking, call stays open

  const wf = JSON.parse(read('Bot Gather Handle.json'));
  const sheet1 = wf.nodes.find(n => n.name === 'Append row in sheet1');
  assert.equal(sheet1.parameters.columns.value['Time Slot'], '={{ $json.time_slot_display || $json.time_slot }}');
  assert.equal(sheet1.parameters.columns.value['Status'], '={{ $json.status }}');

  const sheet = wf.nodes.find(n => n.name === 'Append row in sheet');
  assert.equal(sheet.parameters.columns.value['Time Slot'], '={{ $json.time_slot_display || $json.time_slot }}');
});

test('Edit Fields forwards the new bookkeeping fields', () => {
  const wf = JSON.parse(read('Bot Gather Handle.json'));
  const edit = wf.nodes.find(n => n.name === 'Edit Fields');
  const names = edit.parameters.assignments.assignments.map(a => a.name);
  for (const f of ['asked_field', 'prev_missing_count', 'prev_time_slot_display', 'gather_url']) {
    assert.ok(names.includes(f), 'Edit Fields must forward ' + f);
  }
});

// -------------------------------------------------------- workflow integrity
test('workflow JSONs are valid and contain the generated code', () => {
  for (const f of ['Bot Gather Handle.json', 'workflows/bot-gather-handle.json']) {
    const wf = JSON.parse(read(f));
    const code = wf.nodes.find(n => n.name === 'Code in JavaScript');
    assert.match(code.parameters.jsCode, /BotEngine/);
    assert.match(code.parameters.jsCode, /AUTO-GENERATED FILE/);
    const ask = wf.nodes.find(n => n.name === 'Code in JavaScript1');
    assert.match(ask.parameters.jsCode, /__gatherUrl/);
    const confirm = wf.nodes.find(n => n.name === 'Code in JavaScript2');
    assert.match(confirm.parameters.jsCode, /RELATION_HINDI/);
  }
});

test('the old always-true If node now checks the transcript', () => {
  const wf = JSON.parse(read('Bot Gather Handle.json'));
  const ifNode = wf.nodes.find(n => n.name === 'If');
  const cond = ifNode.parameters.conditions.conditions[0];
  assert.equal(cond.operator.operation, 'notEmpty');
  assert.match(cond.leftValue, /final_transcript/);
});

test('the dead ngrok host is gone from the workflows', () => {
  for (const f of ['Bot Gather Handle.json', 'workflows/bot-gather-handle.json', 'workflows/doctor-appointment-bot.json']) {
    assert.equal(/grope-tanned-overcook/.test(read(f)), false, f + ' still points at the dead ngrok tunnel');
  }
});

// ------------------------------------------------------------------ security
test('no live secrets are committed anywhere in the tree', () => {
  const patterns = [
    /ghp_[A-Za-z0-9]{20,}/,                     // GitHub personal access token
    /sk_[a-z0-9]{8}_[A-Za-z0-9]{16,}/,          // Sarvam / Stripe style key
    /AC[0-9a-f]{32}/,                           // Twilio Account SID
    /mongodb\+srv:\/\/[^\s"']+:[^\s"'@]+@/,     // Mongo URI with password
  ];

  // Ignore node_modules/.git and anything the repo's own .gitignore covers.
  const ignorable = read('.gitignore').split('\n')
    .map(l => l.trim()).filter(l => l && !l.startsWith('#'))
    .map(g => new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '.*').replace(/\*/g, '.*') + '$'));
  const isIgnored = (rel) => {
    const base = path.basename(rel);
    return ignorable.some(re => re.test(rel) || re.test(base));
  };

  const offenders = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const p = path.join(dir, entry.name);
      const rel = path.relative(ROOT, p).split(path.sep).join('/');
      if (isIgnored(rel)) continue;
      if (entry.isDirectory()) { walk(p); continue; }
      const text = fs.readFileSync(p, 'utf8');
      for (const re of patterns) if (re.test(text)) offenders.push(rel + ' -> ' + re);
    }
  })(ROOT);

  assert.deepEqual(offenders, []);
});
