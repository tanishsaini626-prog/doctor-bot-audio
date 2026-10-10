# 🏥 Hindi Voice AI Doctor Booking Bot

> An AI-powered voice bot that books doctor appointments in Hindi over a real phone call — fully automated, end to end.

[![Made with n8n](https://img.shields.io/badge/Built%20with-n8n-orange)](https://n8n.io)
[![Twilio](https://img.shields.io/badge/Voice-Twilio-red)](https://twilio.com)
[![Sarvam AI](https://img.shields.io/badge/STT-Sarvam%20AI-blue)](https://sarvam.ai)
[![Google Sheets](https://img.shields.io/badge/Database-Google%20Sheets-green)](https://sheets.google.com)
[![Status](https://img.shields.io/badge/Status-Live-brightgreen)]()

---

## 📞 What It Does

A patient calls a Twilio phone number. The AI bot:

1. Greets the patient in Hindi
2. Asks for their **name**, **appointment date**, **time slot**, and **medical reason**
3. Detects if they are booking **for themselves or a family member** (mother, father, child etc.)
4. Handles **multi-turn conversation** — remembers answers across turns
5. Confirms the booking in natural Hindi speech
6. Saves everything to **Google Sheets** automatically
7. Sends a **WhatsApp notification** to the clinic

All in Hindi. On a real phone call. Zero human involvement.

---

## 🎥 Demo

> 📹 [Watch a real call being handled →](#) *(add your video link here)*

**Sample conversation:**
```
Bot:    Namaste! Main Dr. Sharma ka assistant hoon. Aap kaise help kar sakta hoon?
Caller: Meri mummy ke liye appointment chahiye, unka naam Priya hai
Bot:    Priya ji ke liye appointment kab chahiye?
Caller: Kal subah 10 baje, bukhar hai
Bot:    Priya ji, aapki appointment kal subah 10:00 ke liye book ho gayi hai. Dhanyavaad!
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Voice calls | Twilio Programmable Voice |
| Speech to Text | Sarvam AI (Hindi STT) |
| Automation | n8n Cloud (workflow engine) |
| NLP / Slot extraction | Custom JavaScript (rule-based) |
| Text to Speech | Sarvam AI TTS + Twilio TwiML |
| Database | Google Sheets API |
| Notifications | Twilio WhatsApp API |
| Hosting | n8n Cloud + GitHub |

---

## ✨ Features

### Core
- ✅ Real inbound phone call handling
- ✅ Hindi + Hinglish speech recognition
- ✅ Multi-turn conversation (remembers previous answers)
- ✅ Natural Hindi voice responses

### Slot Extraction (NLP)
- ✅ **Name** — detects Hindi/Hinglish names (`naam Priya hai`, `मेरा नाम राहुल है`)
- ✅ **Date** — relative dates (`आज`, `कल`, `परसों`) and absolute dates
- ✅ **Time Slot** — morning/evening with exact hour (`subah 10 baje`, `शाम 4 बजे`)
- ✅ **Medical Reason** — detects symptoms (`बुखार`, `खांसी`, `दर्द` etc.)
- ✅ **Third Party Booking** — detects who the appointment is for (`meri mummy`, `mere papa`, `meri beti`)

### Data
- ✅ All bookings saved to Google Sheets with timestamp
- ✅ WhatsApp notification sent to clinic on every booking
- ✅ Personalized voice confirmation with name, date, time, and relation

---

## 🏗️ Architecture

```
Patient calls Twilio number
        ↓
Twilio STT (SpeechResult)
        ↓
n8n Webhook receives transcript
        ↓
Edit Fields → normalizes data
        ↓
If node → checks if transcript is valid
        ↓
Code in JavaScript → extracts slots
   - Name extraction (15+ regex patterns)
   - Date extraction (Hindi keywords + month map)
   - Time slot extraction (Hinglish + Devanagari)
   - Medical reason detection (keyword matching)
   - Third party relation detection
        ↓
If1 node → all slots collected?
   ├── YES → Append to Google Sheets
   │          → Send WhatsApp notification
   │          → Voice confirmation TwiML
   └── NO  → Ask for missing slot in Hindi
              → Pass collected slots as query params
              → Wait for next turn
```

---

## 📁 Project Structure

```
doctor-bot-audio/
│
├── lib/
│   └── bot-engine.js                   # ⭐ SOURCE OF TRUTH for all bot logic
│                                       #    (names, dates, times, reasons, flags)
├── code/
│   ├── slot-extraction.js              # 🔧 GENERATED - paste into Code node 1
│   ├── ask-missing-slot.js             # 🔧 GENERATED - paste into Code node 2
│   └── confirmation-message.js         # 🔧 GENERATED - paste into Code node 3
├── scripts/
│   └── build-n8n-code.js               # regenerates code/*.js + the workflow JSONs
├── tests/
│   ├── engine.test.js                  # 28 slot-extraction edge-case tests
│   └── n8n-nodes.test.js               # 14 tests that run the real n8n code
│                                       #    + workflow/secret integrity checks
├── docs/
│   └── EDGE-CASES.md                   # every edge case and how it is handled
├── workflows/
│   ├── doctor-appointment-bot.json     # Greeting workflow (Twilio entry)
│   └── bot-gather-handle.json          # Slot extraction + booking logic
├── Bot Gather Handle.json              # working copy (same as workflows/…)
├── test_call.py                        # places a test call (credentials via env)
└── README.md
```

> 🔧 **Never edit `code/*.js` by hand.** Edit `lib/bot-engine.js`, then run
> `npm run build:n8n`. That single command refreshes the three Code-node files
> **and** injects them into both workflow JSON files.

---

## 🚀 How to Run

### 1. Run the tests (no n8n needed)

```bash
node --test          # or: npm test
```

Expected: **42 passing**. These tests simulate complete phone calls against the
real generated n8n code, so they catch broken Hindi parsing before a caller does.

### 2. n8n Cloud

- Import `workflows/doctor-appointment-bot.json` and `workflows/bot-gather-handle.json`
- Re-paste the two placeholders that were removed from git:
  - `PASTE_YOUR_SARVAM_API_KEY` (greeting workflow → HTTP Request header)
  - `PASTE_YOUR_GITHUB_TOKEN_HERE` (greeting workflow → Code node)
  - `YOUR_TWILIO_ACCOUNT_SID` (gather workflow → WhatsApp HTTP Request URL)
- Point the Twilio number's webhook to `https://<your-n8n-domain>/webhook/doctor-bot`

### 3. Prerequisites

- n8n Cloud account, Twilio number, Sarvam AI key, Google Sheets service account

---

## 🧪 Edge Cases

The bot now covers **59 documented edge cases** — silence, noise, phonetic
mis-hearings ("shaam" → "sam"), impossible and past dates, Sundays, half-hours
(`saadhe 4 baje`), XML-breaking names (`R&D`), corrections, wrong numbers,
emergencies, duplicate bookings, full slots and abandoned calls.

📄 Full list with explanations: **[docs/EDGE-CASES.md](docs/EDGE-CASES.md)**

---

## 🔐 Security

This repo previously contained live secrets in tracked files. They are now
placeholders (**rotate the old ones — they were public**):

| Was leaked | Where | Now |
|---|---|---|
| Twilio Account SID | `test_call.py`, gather workflow | env vars / `YOUR_TWILIO_ACCOUNT_SID` |
| Sarvam API key | greeting workflow | `PASTE_YOUR_SARVAM_API_KEY` |
| GitHub PAT (`ghp_…`) | greeting workflow Code node | `PASTE_YOUR_GITHUB_TOKEN_HERE` |
| MongoDB password | project context note | local file, blocked by `.gitignore` |

`.gitignore` now blocks `.env`, `*.env`, `mongoatlas.txt`,
`n8n-doctor-bot-*.json` (service account key) and the local context notes.
`test_call.py` reads `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
`TWILIO_FROM_NUMBER`, `TEST_TO_NUMBER`, `WEBHOOK_URL` from the environment (or a
local `.env` / `doctor.env` file).

Each push is protected by an automated check: `tests/n8n-nodes.test.js` fails if
a Twilio SID, Sarvam key, GitHub token or Mongo URI with a password ever appears
in the tree again.

---

## 📊 Results

| Metric | Value |
|---|---|
| Languages supported | Hindi, Hinglish |
| Average call duration | ~60 seconds |
| Slots extracted | Name, Date, Time, Reason, Booking For |
| Accuracy on clear Hindi | ~90% |
| Weeks to build | 4 weeks |

---

## 🗓️ Development Journey

| Week | What I built |
|---|---|
| Week 1 | n8n + Twilio + Google Sheets setup |
| Week 2 | Basic call handler + Hindi TTS response |
| Week 3 | Sarvam AI STT integration + transcript logging |
| Week 4 | Full slot extraction NLP + third party bookings + time slots |
| Week 5 | Personalized voice confirmation + WhatsApp notifications |
| Week 6 | Wrong-number handling, corrections, partial save on give-up |
| Week 7 | Live call working end to end |
| Week 8 | Edge-case hardening: 59 cases, 42 automated tests, secret cleanup, reusable engine |

---

## 🧠 What I Learned

- Building **production voice AI** with real phone calls
- **Hindi NLP** — regex patterns for Devanagari + Hinglish
- **Multi-turn conversation state management** via query params
- **Webhook-based architecture** with n8n
- **API integration** — Twilio, Sarvam AI, Google Sheets
- Debugging live systems with real speech data

---

## 👨‍💻 About Me

**Tanish Saini**
2nd Year B.E. CSE — Chitkara University

Building real AI products, not just college projects.

- 📧 : tanishsaini626@gmail.com
- 💼 : 
- 🐙 [GitHub](https://github.com/tanishsaini626-prog)

---

## 📄 License

MIT License — feel free to use and build on this.

---

*Built with ❤️ during summer break, 2nd year of college.*
