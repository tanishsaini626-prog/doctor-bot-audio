const transcript = $input.first().json.final_transcript || "";
const phone      = $input.first().json.patient_phone || "";
const callSid    = $input.first().json.call_sid || "";
const prevName       = $input.first().json.prev_name        || null;
const prevDate       = $input.first().json.prev_date        || null;
const prevReason     = $input.first().json.prev_reason      || null;
const prevBookingFor = $input.first().json.prev_booking_for || null;
const attempt    = $input.first().json.attempt     || "1";
const prevTimeSlot   = $input.first().json.prev_time_slot   || null;

const slots = {
  name: null,
  date: null,
  reason: null,
  raw_text: transcript,
  phone: phone,
  call_sid: callSid
};

// --- NAME EXTRACTION ---
const namePatterns = [
  // Hinglish: "Priya ke liye appointment" — name at start
/^([A-Z][a-z]+)\s+ke\s+liye/,
  // Self booking: "मेरा नाम X है"
  // Hinglish: "unka naam X hai"
  /unka\s+naam\s+([^\s,।]+)/i,
  
  // Hinglish: "naam X hai"  
  /naam\s+([A-Z][^\s,।]*)/i,
  
  // उनका/उसका नाम X है
  /(?:उनका|उसका|इनका|उनकी|उसकी)\s+नाम\s+([^\s,।]+(?:\s+[^\s,।]+)?)/i,
  /(?:मेरा\s+नाम|नाम)\s+([^\s,।]+(?:\s+[^\s,।]+)?)\s*(?:है|हूँ)?/,
  
  // Self: "मैं X बोल रहा/रही हूँ"
  /मैं\s+([^\s,।]+(?:\s+[^\s,।]+)?)\s*(?:हूँ|बोल\s+रह)/,
  
  // Third party: "मेरी मां/पापा/बेटी का नाम X है"
  /(?:मेरी|मेरे)\s+(?:मां|माँ|मम्मी|पापा|बाबा|पिता|बेटी|बेटे|बच्चे|बच्ची|दादी|दादा|नानी|नाना|पत्नी|पति|भाई|बहन)\s+(?:का|की|के)\s+नाम\s+([^\s,।]+(?:\s+[^\s,।]+)?)/,
  
  // Third party short: "X के लिए appointment"
  /([^\s,।]+(?:\s+[^\s,।]+)?)\s+के\s+लिए\s+(?:अपॉइंटमेंट|appointment|दिखाना)/i,
  
  // Third party: "उनका/उसका नाम X है"
  /(?:उनका|उसका|इनका)\s+नाम\s+([^\s,।]+(?:\s+[^\s,।]+)?)/,

  // Called by name: "X बोल रहा/रही हूँ"
  /([^\s,।]{2,})\s+बोल\s+रह[ाी]/,
];
// --- RELATION DETECTION ---
const relations = {
  "मां": "Mother", "माँ": "Mother", "मम्मी": "Mother",
  "पापा": "Father", "बाबा": "Father", "पिता": "Father",
  "बेटी": "Daughter", "बेटे": "Son", "बच्चे": "Child",
  "पत्नी": "Wife", "पति": "Husband",
  "दादी": "Grandmother", "दादा": "Grandfather",
  "नानी": "Grandmother", "नाना": "Grandfather",
  "भाई": "Brother", "बहन": "Sister",
  "papa": "Father", "pita": "Father", "baap": "Father",
"maa": "Mother", "mama": "Mother", "mummy": "Mother",
"beti": "Daughter", "beta": "Son", "bachche": "Child",
"dadi": "Grandmother", "dada": "Grandfather",
"nani": "Grandmother", "nana": "Grandfather",
"bhai": "Brother", "behen": "Sister", "bhan": "Sister"
};

slots.booking_for = "Self";
for (const [hindi, english] of Object.entries(relations)) {
  if (transcript.includes(hindi)) {
    slots.booking_for = english;
    break;
  }
}
for (const pattern of namePatterns) {
  const match = transcript.match(pattern);
  if (match) { slots.name = match[1].trim(); break; }
}
// Blacklist common Hindi words that are not names
const notNames = ["कल", "आज", "परसों", "बुखार", "खांसी", "दर्द", "नहीं", "है", "हूँ", "आना", "जाना", "कल", "थोड़ा", "सांस"];
if (slots.name && notNames.includes(slots.name.trim())) {
  slots.name = null;
}

// --- DATE EXTRACTION ---
const today = new Date();
const tomorrow = new Date(today);
tomorrow.setDate(today.getDate() + 1);
const dayAfter = new Date(today);
dayAfter.setDate(today.getDate() + 2);

const monthMap = {
  "जनवरी":0,"फरवरी":1,"मार्च":2,"अप्रैल":3,
  "मई":4,"जून":5,"जुलाई":6,"अगस्त":7,
  "सितंबर":8,"अक्टूबर":9,"नवंबर":10,"दिसंबर":11
};

if (transcript.includes("आज")) {
  slots.date = today.toLocaleDateString("en-IN");
} else if (transcript.includes("कल")) {
  slots.date = tomorrow.toLocaleDateString("en-IN");
} else if (transcript.includes("परसों")) {
  slots.date = dayAfter.toLocaleDateString("en-IN");
} else {
  for (const [monthName, monthNum] of Object.entries(monthMap)) {
    const monthPattern = new RegExp(`(\\d{1,2})\\s*${monthName}`);
    const match = transcript.match(monthPattern);
    if (match) {
      const d = new Date(today.getFullYear(), monthNum, parseInt(match[1]));
      slots.date = d.toLocaleDateString("en-IN");
      break;
    }
  }
  if (!slots.date) {
    const numMatch = transcript.match(/(\d{1,2})\s*(?:तारीख|को)/);
    if (numMatch) {
      const d = new Date(today.getFullYear(), today.getMonth(), parseInt(numMatch[1]));
      slots.date = d.toLocaleDateString("en-IN");
    }
  }
}
// --- ENGLISH DAY NAMES ---
if (!slots.date) {
  const dayNames = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
  const dayNamesHi = ["रविवार","सोमवार","मंगलवार","बुधवार","गुरुवार","शुक्रवार","शनिवार"];
  const transcriptLower = transcript.toLowerCase();
  for (let i = 0; i < dayNames.length; i++) {
    if (transcriptLower.includes(dayNames[i])) {
      const targetDay = i;
      const currentDay = today.getDay();
      let daysUntil = targetDay - currentDay;
      if (daysUntil <= 0) daysUntil += 7;
      const d = new Date(today);
      d.setDate(today.getDate() + daysUntil);
      slots.date = d.toLocaleDateString("en-IN");
      break;
    }
  }
  if (!slots.date) {
    for (let i = 0; i < dayNamesHi.length; i++) {
      if (transcript.includes(dayNamesHi[i])) {
        const targetDay = i;
        const currentDay = today.getDay();
        let daysUntil = targetDay - currentDay;
        if (daysUntil <= 0) daysUntil += 7;
        const d = new Date(today);
        d.setDate(today.getDate() + daysUntil);
        slots.date = d.toLocaleDateString("en-IN");
        break;
      }
    }
  }
  if (!slots.date && (transcript.toLowerCase().includes("next week") || transcript.includes("अगले हफ्ते") || transcript.toLowerCase().includes("agli hafte"))) {
    const d = new Date(today);
    d.setDate(today.getDate() + 7);
    slots.date = d.toLocaleDateString("en-IN");
  }
}
// --- ENGLISH DAY NAMES ---
if (!slots.date) {
  const dayNames = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
  const dayNamesHi = ["रविवार","सोमवार","मंगलवार","बुधवार","गुरुवार","शुक्रवार","शनिवार"];
  const transcriptLower = transcript.toLowerCase();
  
  // Check English day names
  for (let i = 0; i < dayNames.length; i++) {
    if (transcriptLower.includes(dayNames[i])) {
      const targetDay = i;
      const currentDay = today.getDay();
      let daysUntil = targetDay - currentDay;
      if (daysUntil <= 0) daysUntil += 7;
      const d = new Date(today);
      d.setDate(today.getDate() + daysUntil);
      slots.date = d.toLocaleDateString("en-IN");
      break;
    }
  }
  
  // Check Hindi day names
  if (!slots.date) {
    for (let i = 0; i < dayNamesHi.length; i++) {
      if (transcript.includes(dayNamesHi[i])) {
        const targetDay = i;
        const currentDay = today.getDay();
        let daysUntil = targetDay - currentDay;
        if (daysUntil <= 0) daysUntil += 7;
        const d = new Date(today);
        d.setDate(today.getDate() + daysUntil);
        slots.date = d.toLocaleDateString("en-IN");
        break;
      }
    }
  }

  // "next week" / "agli baar" → 7 days from today
  if (!slots.date && (transcriptLower.includes("next week") || transcriptLower.includes("agli hafte") || transcript.includes("अगले हफ्ते"))) {
    const d = new Date(today);
    d.setDate(today.getDate() + 7);
    slots.date = d.toLocaleDateString("en-IN");
  }
}

// --- REASON EXTRACTION ---
const medicalKeywords = [
  "bukhaar", "bukhar", "khansi", "sardee", "dard", "pet", "sir",
  "बुखार","खांसी","सर्दी","दर्द","चोट","जाँच","checkup","चेकअप",
  "उल्टी","दस्त","सिरदर्द","पेट दर्द","कमर दर्द","आँख",
  "कान","गला","दांत","एलर्जी","डायबिटीज","ब्लड प्रेशर",
  "शुगर","सांस","थकान","बीपी","BP","fever","dikhana","दिखाना","checkup","pain","दवाई"
  
];
for (const kw of medicalKeywords) {
  if (transcript.toLowerCase().includes(kw.toLowerCase())) {
    slots.reason = kw;
    break;
  }
}
if (!slots.reason) {
  const reasonMatch = transcript.match(/(?:के\s+लिए|की\s+समस्या|तकलीफ)\s*(.{0,30})/);
  if (reasonMatch) slots.reason = reasonMatch[0].trim();
}
// --- WRONG NUMBER / IRRELEVANT CALL DETECTION ---
const wrongNumberPhrases = [
  "galat number", "wrong number", "galat no", 
  "koi nahi chahiye", "appointment nahi chahiye",
  "cancel", "band karo", "rakhna nahi",
  "galti se", "mistake"
];
slots.is_wrong_number = wrongNumberPhrases.some(w => 
  transcript.toLowerCase().includes(w.toLowerCase())
);

// --- CORRECTION DETECTION ---
const correctionKeywords = [
  "nahi", "nahin", "नहीं", "galat", "गलत", "actually", 
  "change", "badlo", "बदलो", "correction", "wrong",
  "nahi nahi", "arre nahi", "actually nahi"
];
const hasCorrection = correctionKeywords.some(k => transcript.toLowerCase().includes(k.toLowerCase()));

// --- MERGE WITH PREVIOUS SLOTS ---
// If correction detected AND new value found → use new value
// If no correction AND no new value → use previous value
// If correction BUT no new value found → keep previous (patient just said nahi but didn't give new value yet)
// Only wipe slots if it's a generic correction (not time-specific)
const timeWords = ["subah","shaam","morning","evening","dopahar","raat","baje","night"];
const isTimeCorrection = timeWords.some(w => transcript.toLowerCase().includes(w));

slots.name = (slots.name && slots.name !== "")
  ? slots.name
  : (hasCorrection && !isTimeCorrection ? null : (prevName || null));

slots.date = (slots.date && slots.date !== "")
  ? slots.date
  : (hasCorrection && !isTimeCorrection ? null : (prevDate || null));

slots.reason = (slots.reason && slots.reason !== "")
  ? slots.reason
  : (hasCorrection && !isTimeCorrection ? null : (prevReason || null));

slots.booking_for = (slots.booking_for && slots.booking_for !== "Self")
  ? slots.booking_for
  : (prevBookingFor || slots.booking_for || "Self");





// --- TIME SLOT EXTRACTION ---
const timePatterns = [
  { re: /(?:subah|सुबह)\s*(\d{1,2})\s*(?:baje|बजे|baj|am|AM)?/i,     period: "Morning",   offset: 0  },
  { re: /(?:dopahar|दोपहर)\s*(\d{1,2})\s*(?:baje|बजे|baj)?/i,         period: "Afternoon", offset: 12 },
  { re: /(?:shaam|शाम|sham)\s*(\d{1,2})\s*(?:baje|बजे|baj|pm|PM)?/i,  period: "Evening",   offset: 12 },
  { re: /(?:raat|रात)\s*(\d{1,2})\s*(?:baje|बजे|baj)?/i,              period: "Night",     offset: 12 },
  { re: /\bmorning\s*(\d{1,2})/i,   period: "Morning",   offset: 0  },
  { re: /\bafternoon\s*(\d{1,2})/i, period: "Afternoon", offset: 12 },
  { re: /\bevening\s*(\d{1,2})/i,   period: "Evening",   offset: 12 },
  { re: /\bnight\s*(\d{1,2})/i,     period: "Night",     offset: 12 },
  { re: /\b(\d{1,2})\s*AM\b/i,  period: "Morning", offset: 0  },
{ re: /\b(\d{1,2})\s*PM\b/i,  period: "Evening", offset: 12 },
{ re: /\b(\d{1,2})\s*am\b/i,  period: "Morning", offset: 0  },
{ re: /\b(\d{1,2})\s*pm\b/i,  period: "Evening", offset: 12 },
{ re: /\b(\d{1,2})\s*o'clock\b/i, period: "Morning", offset: 0 },
];

const wordNums = {
  "ek":1,"do":2,"teen":3,"chaar":4,"paanch":5,"chhah":6,
  "saat":7,"aath":8,"nau":9,"das":10,"gyarah":11,"barah":12,
  "एक":1,"दो":2,"तीन":3,"चार":4,"पाँच":5,"छह":6,
  "सात":7,"आठ":8,"नौ":9,"दस":10,"ग्यारह":11,"बारह":12
};

const periodOnly = [
  { words: ["subah","सुबह","morning"],      slot: "Morning",   display: "Morning (9:00-12:00)"   },
  { words: ["dopahar","दोपहर","afternoon"], slot: "Afternoon", display: "Afternoon (12:00-16:00)" },
  { words: ["shaam","शाम","sham","evening"],slot: "Evening",   display: "Evening (16:00-19:00)"  },
  { words: ["raat","रात","night"],          slot: "Night",     display: "Night (19:00-21:00)"    },
];
// "any time" fallback


slots.time_slot = null;
slots.time_slot_display = null;

for (const p of timePatterns) {
  const m = transcript.match(p.re);
  if (m) {
    let hour = parseInt(m[1]);
    if (hour >= 1 && hour <= 12) {
      const h24 = (p.offset === 12 && hour < 12) ? hour + 12 : hour;
      const hh = String(h24).padStart(2, "0");
      slots.time_slot         = `${p.period} ${hh}:00`;
      slots.time_slot_display = `${p.period} ${hh}:00`;
      break;
    }
  }
}

if (!slots.time_slot) {
  for (const p of periodOnly) {
    if (p.words.some(w => transcript.toLowerCase().includes(w.toLowerCase()))) {
      slots.time_slot         = p.slot;
      slots.time_slot_display = p.display;
      break;
    }
  }
}
if (!slots.time_slot) {
  const anyTime = ["koi bhi","kuch bhi","chalega","chalta hai",
    "कोई भी","कुछ भी","चलेगा","जब भी","whenever","anytime"];
  if (anyTime.some(w => transcript.toLowerCase().includes(w.toLowerCase()))) {
    slots.time_slot         = "Morning";
    slots.time_slot_display = "Morning (9:00-12:00)";
  }
}



// Apply correction logic AFTER extraction
// Only apply correction if no new value was extracted
console.log("DEBUG transcript:", transcript, "time_slot after extraction:", slots.time_slot);
const extractedTimeSlot = slots.time_slot;
slots.time_slot = extractedTimeSlot
  ? extractedTimeSlot
  : (hasCorrection ? null : (prevTimeSlot && prevTimeSlot !== "" ? prevTimeSlot : null));

slots.time_slot_display = slots.time_slot_display || slots.time_slot || null;
slots.prev_time_slot    = slots.time_slot || "";
// --- MISSING SLOTS ---
slots.missing = [];
if (!slots.name   || slots.name   === "") slots.missing.push({ field: "name",      hindi: "आपका नाम" });
if (!slots.date   || slots.date   === "") slots.missing.push({ field: "date",      hindi: "अपॉइंटमेंट की तारीख" });
if (!slots.time_slot || slots.time_slot === "") slots.missing.push({ field: "time_slot", hindi: "कौन से समय पर आना है, सुबह या शाम" });
if (!slots.reason || slots.reason === "") slots.missing.push({ field: "reason",    hindi: "बीमारी का कारण" });

slots.all_collected = slots.missing.length === 0;
return [{ json: slots }];
