const input = $input.first().json;
const missing = input.missing || [];
// Handle wrong number
if (input.is_wrong_number) {
  return [{ json: {
    twiml: `<?xml version="1.0" encoding="UTF-8"?><Response><Say language="hi-IN">Koi baat nahi. Agar aapko appointment chahiye toh dobara call karein. Dhanyavaad!</Say><Hangup/></Response>`,
    gave_up: true
  }}];
}

function buildQuestion(missingSlots) {
  if (missingSlots.length === 0) return null;
  const first = missingSlots[0].field;
  const questions = {
    name:   "क्षमा करें, मुझे आपका नाम सुनाई नहीं दिया। कृपया अपना पूरा नाम बताएं।",
    date:   "धन्यवाद! अब कृपया बताएं आप किस तारीख को अपॉइंटमेंट लेना चाहते हैं?",
    reason: "ठीक है! कृपया बताएं आपको किस समस्या के लिए डॉक्टर से मिलना है?"
  };
  return questions[first] || `कृपया अपना ${missingSlots[0].hindi} बताएं।`;
}

const question = buildQuestion(missing);
const attempt = parseInt(input.attempt || "1") + 1;

if (attempt > 3) {
  return [{ json: {
    twiml: `<?xml version="1.0" encoding="UTF-8"?><Response><Say language="hi-IN">Kshama karein, aap baad mein call karein. Dhanyavaad!</Say><Hangup/></Response>`,
    gave_up: true,
    // Pass partial data so Append node can save it
    name: input.name || "Unknown",
    date: input.date || "Not provided",
    reason: input.reason || "Not provided",
    time_slot: input.time_slot || "Not provided",
    booking_for: input.booking_for || "Self",
    phone: input.phone || "",
    call_sid: input.call_sid || "",
    raw_text: input.raw_text || "",
    status: "Incomplete"
  }}];
}

const prevName   = encodeURIComponent(input.name   || input.prev_name   || "");
const prevDate   = encodeURIComponent(input.date   || input.prev_date   || "");
const prevReason = encodeURIComponent(input.reason || input.prev_reason || "");
const prevTimeSlot   = encodeURIComponent(input.time_slot || input.prev_time_slot || "");
const prevBookingFor = encodeURIComponent(input.booking_for || input.prev_booking_for || "");

const actionUrl = `https://tannish13.app.n8n.cloud/webhook/gather?prev_name=${prevName}&prev_date=${prevDate}&prev_reason=${prevReason}&prev_booking_for=${prevBookingFor}&prev_time_slot=${prevTimeSlot}&attempt=${attempt}`;

const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Gather input="speech" language="hi-IN" speechTimeout="5" action="${actionUrl}" method="POST"><Say language="hi-IN">${question}</Say></Gather><Say language="hi-IN">क्षमा करें, कृपया दोबारा कॉल करें।</Say></Response>`;

return [{ json: { twiml, question_asked: question, attempt } }];
