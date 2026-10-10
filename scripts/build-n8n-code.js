#!/usr/bin/env node
/* ==========================================================================
 * build-n8n-code.js
 * --------------------------------------------------------------------------
 * Turns lib/bot-engine.js into the self-contained JavaScript that lives inside
 * the n8n Code nodes, writes it to code/*.js and injects it into the two
 * workflow JSON files.
 *
 *   node scripts/build-n8n-code.js
 *
 * Run this every time you edit lib/bot-engine.js. Never hand-edit code/*.js.
 * ========================================================================== */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ENGINE_PATH = path.join(ROOT, 'lib', 'bot-engine.js');

// ---------------------------------------------------------------- engine src
const engineFile = fs.readFileSync(ENGINE_PATH, 'utf8');
const footerAt = engineFile.indexOf('if (typeof module !==');
if (footerAt === -1) throw new Error('Could not find the module.exports footer in lib/bot-engine.js');
const ENGINE_SRC = engineFile
  .slice(0, footerAt)
  .replace(/^'use strict';\s*/m, '')
  .replace(/\n{3,}/g, '\n\n')
  .trimEnd();

const BANNER = (nodeName) => `/* ============================================================================
 * AUTO-GENERATED FILE - DO NOT EDIT BY HAND
 * Source : lib/bot-engine.js
 * Node   : ${nodeName}
 * Rebuild: node scripts/build-n8n-code.js
 * ========================================================================== */

${ENGINE_SRC}
`;

// ------------------------------------------------------------- node 1: slots
const SLOT_EXTRACTION = `${BANNER('Code in JavaScript / slot extraction')}
/* ---------------------------------------------------------------------------
 * n8n Code node: turn the Twilio speech result + previous answers into slots.
 * Input  (from "Edit Fields"): final_transcript, patient_phone, call_sid,
 *        prev_name, prev_date, prev_time_slot, prev_reason, prev_booking_for,
 *        attempt, asked_field, prev_missing_count
 * Output: every slot + missing[] + all_collected + flags (wrong number,
 *        emergency, noise) + hint when the last answer was rejected.
 * ------------------------------------------------------------------------- */

const __in = $input.first().json;

function __pick() {
  for (let i = 0; i < arguments.length; i++) {
    const v = arguments[i];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return null;
}

const __prev = {
  name:               __pick(__in.prev_name),
  date:               __pick(__in.prev_date),
  time_slot:          __pick(__in.prev_time_slot),
  time_slot_display:  __pick(__in.prev_time_slot_display),
  reason:             __pick(__in.prev_reason),
  booking_for:        __pick(__in.prev_booking_for),
};

const __out = BotEngine.extract({
  transcript:         __pick(__in.final_transcript, __in.twilio_transcript, __in.SpeechResult, ''),
  phone:              __pick(__in.patient_phone, __in.From, ''),
  call_sid:           __pick(__in.call_sid, __in.CallSid, ''),
  attempt:            __pick(__in.attempt, '0'),
  asked_field:        __pick(__in.asked_field),
  prev_missing_count: __in.prev_missing_count,
  prev:               __prev,
  today:              new Date(),
});

return [{ json: __out }];
`;

// --------------------------------------------------------------- node 2: ask
const ASK_MISSING_SLOT = `${BANNER('Code in JavaScript1 / ask next question')}
/* ---------------------------------------------------------------------------
 * n8n Code node: ask the next missing slot, or end the call politely.
 * Ends the call on: wrong number, emergency, "call me later", or 3 turns in a
 * row without progress (then the partial row is saved as Incomplete).
 * ------------------------------------------------------------------------- */

const __in = $input.first().json;

/* Build the <Gather action="..."> URL. The host is taken from the incoming
 * webhook, so switching between ngrok and n8n Cloud never breaks the call. */
function __gatherUrl(field, nextAttempt, slots) {
  let base = '';
  try { base = ($('Webhook').first().json.query || {}).gather_url || ''; } catch (e) { base = ''; }
  if (!base) {
    try {
      base = ($('Webhook').first().json.webhookUrl || '').replace(/\\/doctor-bot\\/?$/, '/gather');
    } catch (e) { base = ''; }
  }
  if (!base) base = 'https://YOUR-N8N-DOMAIN/webhook/gather';

  const q = [
    ['prev_name', slots.name || ''],
    ['prev_date', slots.date || ''],
    ['prev_time_slot', slots.time_slot || ''],
    ['prev_time_slot_display', slots.time_slot_display || ''],
    ['prev_reason', slots.reason || ''],
    ['prev_booking_for', slots.booking_for || 'Self'],
    ['prev_missing_count', String((slots.missing || []).length)],
    ['attempt', String(nextAttempt)],
    ['asked_field', field || ''],
  ].map(function (pair) { return pair[0] + '=' + encodeURIComponent(pair[1]); }).join('&');

  return base + (base.indexOf('?') === -1 ? '?' : '&') + q;
}

function __endCall(speech, extra) {
  const twiml = BotEngine.wrapTwiml(BotEngine.say(speech) + BotEngine.hangup());
  return Object.assign({ twiml: twiml, gave_up: true, end_call: true }, extra || {});
}

const __max = BotEngine.CONFIG.maxAttemptsPerQuestion;
const __attempt = parseInt(__in.attempt || '0', 10) || 0;
const __nextAttempt = __in.progressed ? 1 : __attempt + 1;

/* ---- 1. call must end right now ---- */
if (__in.is_emergency) {
  return [{ json: __endCall(
    'Yeh emergency ho sakti hai. Kripya turant 108 par call karein ya nazdeeki hospital jayein. Dhanyavaad!',
    { status: 'Emergency', priority: 'URGENT' }
  ) }];
}
if (__in.is_wrong_number) {
  return [{ json: __endCall(
    'Koi baat nahi. Agar aapko appointment chahiye ho to dobara call karein. Dhanyavaad!',
    { status: 'Wrong Number', gave_up: false }   // do not save a row for wrong numbers
  ) }];
}
if (__in.is_callback) {
  return [{ json: __endCall(
    'Theek hai, jab aap free hon tab call karein. Dhanyavaad!',
    { status: 'Callback', gave_up: false }       // do not save a row either
  ) }];
}

/* ---- 2. nothing left to ask (defensive) ---- */
const __field = BotEngine.nextField(__in.missing);
if (!__field) {
  return [{ json: Object.assign({}, __in, {
    twiml: BotEngine.wrapTwiml(BotEngine.say('Dhanyavaad! Aapki jaankari mil gayi hai.') + BotEngine.hangup()),
    gave_up: true,
  }) }];
}

/* ---- 3. too many tries without progress -> give up, save Incomplete ---- */
if (__nextAttempt > __max) {
  return [{ json: __endCall(
    'Kshama karein, main samajh nahi paaya. Aap thodi der baad dobara call karein. Dhanyavaad!',
    { status: 'Incomplete' }
  ) }];
}

/* ---- 4. ask the next question ---- */
let question = BotEngine.questionFor(__field, __nextAttempt);
if (__in.hint && BotEngine.HINTS[__in.hint]) question = BotEngine.HINTS[__in.hint] + question;
if (__in.is_noise) question = 'क्षमा करें, मुझे कुछ सुनाई नहीं दिया। ' + question;

const __url = __gatherUrl(__field, __nextAttempt, __in);
const __twiml = BotEngine.wrapTwiml(
  BotEngine.gather(question, __url) +
  BotEngine.say('Kripya baad mein call karein.')
);

return [{ json: Object.assign({}, __in, {
  twiml: __twiml,
  question_asked: question,
  asked_field: __field,
  attempt: __nextAttempt,
  gave_up: false,
  end_call: false,
}) }];
`;

// ------------------------------------------------------- node 3: confirmation
const RELATION_HINDI = `{
  Mother: 'माँ के लिए', Father: 'पापा के लिए', Daughter: 'बेटी के लिए', Son: 'बेटे के लिए',
  Child: 'बच्चे के लिए', Grandmother: 'दादी के लिए', Grandfather: 'दादा के लिए', Wife: 'पत्नी के लिए',
  Husband: 'पति के लिए', Brother: 'भाई के लिए', Sister: 'बहन के लिए', 'Nephew/Niece': 'भतीजे के लिए',
  Relative: 'परिवार के लिए', Self: ''
}`;

const CONFIRMATION = `${BANNER('Code in JavaScript2 / confirmation')}
/* ---------------------------------------------------------------------------
 * n8n Code node: build the Hindi voice confirmation + the clinic WhatsApp.
 * Every user-supplied value is XML-escaped, so a name like "R&D" can never
 * break the TwiML.
 * ------------------------------------------------------------------------- */

let __in = {};
try { __in = $('Code in JavaScript').first().json; } catch (e) { __in = $input.first().json; }
if (!__in || !__in.name) __in = Object.assign({}, $input.first().json, __in || {});

const RELATION_HINDI = ${RELATION_HINDI};

const __name = __in.name || 'Unknown';
const __date = __in.date_speech || __in.date || 'Not provided';
const __time = __in.time_slot_speech || __in.time_slot_display || __in.time_slot || 'Not provided';
const __reason = __in.reason || 'Not provided';
const __phone = __in.phone || 'Not provided';
const __bookingFor = __in.booking_for || 'Self';
const __forSpeech = RELATION_HINDI[__bookingFor] || (__bookingFor + ' के लिए');

const __voice = __name + ' जी, आपकी अपॉइंटमेंट ' + __date + ' को ' + __time +
  ' के लिए बुक हो गई है। ' + (__forSpeech ? __forSpeech + ' ' : '') +
  'क्लिनिक पहुँचने से 10 मिनट पहले आ जाइए। धन्यवाद!';

const __twiml = BotEngine.wrapTwiml(BotEngine.say(__voice) + BotEngine.hangup());

const __message = 'New Appointment Booking\\n\\n' +
  'Patient Name: ' + __name + '\\n' +
  'Phone Number: ' + __phone + '\\n' +
  'Appointment Date: ' + (__in.date || __date) + '\\n' +
  'Time Slot: ' + (__in.time_slot_display || __in.time_slot || __time) + '\\n' +
  'Medical Reason: ' + __reason + '\\n' +
  'Booking For: ' + (__bookingFor === 'Self' ? 'Self' : __bookingFor) + '\\n' +
  'Status: ' + (__in.status || 'Confirmed') + '\\n\\n' +
  'Booked via AI Voice Bot\\n' +
  'Time: ' + new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

return [{ json: Object.assign({}, __in, {
  voice_confirmation: __voice,
  whatsapp_message: __message,
  twiml: __twiml,
}) }];
`;

// --------------------------------------------------------------------- write
const outputs = [
  ['code/slot-extraction.js', SLOT_EXTRACTION],
  ['code/ask-missing-slot.js', ASK_MISSING_SLOT],
  ['code/confirmation-message.js', CONFIRMATION],
];

for (const [rel, content] of outputs) {
  fs.writeFileSync(path.join(ROOT, rel), content, 'utf8');
  console.log('wrote', rel, `(${content.length} chars)`);
}

// ------------------------------------------------------------ patch workflows
const CODE_KEY = {
  'Code in JavaScript': SLOT_EXTRACTION,
  'Code in JavaScript1': ASK_MISSING_SLOT,
  'Code in JavaScript2': CONFIRMATION,
};

/** Extra parameters we want in the "Edit Fields" node. */
const EXTRA_SET_FIELDS = [
  { name: 'asked_field', value: '={{ $json.query.asked_field || $json.body.asked_field || "" }}' },
  { name: 'prev_missing_count', value: '={{ $json.query.prev_missing_count || $json.body.prev_missing_count || "" }}' },
  { name: 'prev_time_slot_display', value: '={{ $json.query.prev_time_slot_display || $json.body.prev_time_slot_display || "" }}' },
  { name: 'gather_url', value: '={{ $json.query.gather_url || $json.body.gather_url || "" }}' },
];

function patchWorkflow(relPath) {
  const abs = path.join(ROOT, relPath);
  if (!fs.existsSync(abs)) { console.log('skip (missing)', relPath); return; }
  const raw = fs.readFileSync(abs, 'utf8');
  const wf = JSON.parse(raw);
  let touched = 0;

  for (const node of wf.nodes || []) {
    // 1. drop in the freshly generated code
    if (CODE_KEY[node.name] && node.type === 'n8n-nodes-base.code') {
      node.parameters.jsCode = CODE_KEY[node.name];
      touched++;
      continue;
    }

    // 2. Edit Fields: add the new bookkeeping fields once
    if (node.name === 'Edit Fields' && node.type === 'n8n-nodes-base.set') {
      const list = node.parameters.assignments.assignments;
      for (const extra of EXTRA_SET_FIELDS) {
        if (!list.some(a => a.name === extra.name)) {
          list.push({ id: extra.name, name: extra.name, value: extra.value, type: 'string' });
        }
      }
      touched++;
      continue;
    }

    // 3. the "If" node currently compares true == true; make it meaningful
    if (node.name === 'If' && node.type === 'n8n-nodes-base.if') {
      node.parameters.conditions = {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 3 },
        conditions: [{
          id: 'transcript-present',
          leftValue: '={{ $json.final_transcript }}',
          rightValue: '',
          operator: { type: 'string', operation: 'notEmpty', singleValue: true },
        }],
        combinator: 'and',
      };
      touched++;
      continue;
    }

    // 4. partial-save sheet: keep the display values + real status
    if (node.name === 'Append row in sheet1' && node.type === 'n8n-nodes-base.googleSheets') {
      const v = node.parameters.columns.value;
      v['Time Slot'] = "={{ $json.time_slot_display || $json.time_slot }}";
      v['Status'] = '={{ $json.status }}';
      touched++;
      continue;
    }

    // 5. confirmed sheet: time slot already uses the display value
    if (node.name === 'Append row in sheet' && node.type === 'n8n-nodes-base.googleSheets') {
      const v = node.parameters.columns.value;
      v['Time Slot'] = "={{ $json.time_slot_display || $json.time_slot }}";
      v['Status'] = "={{ $json.status || 'Confirmed' }}";
      touched++;
      continue;
    }
  }

  // 6. every hardcoded host becomes the n8n Cloud host (no more dead ngrok URL)
  let out = JSON.stringify(wf, null, 2).replace(/https:\/\/grope-tanned-overcook\.ngrok-free\.dev/g, 'https://tannish13.app.n8n.cloud');
  fs.writeFileSync(abs, out + '\n', 'utf8');
  console.log('patched', relPath, `(${touched} nodes)`);
}

patchWorkflow('Bot Gather Handle.json');
patchWorkflow('workflows/bot-gather-handle.json');

console.log('\nDone. Import the workflow JSON into n8n (or copy the code/*.js files into the Code nodes).');
