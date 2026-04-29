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
├── workflows/
│   ├── doctor-appointment-bot.json     # Main call handler (Twilio entry)
│   └── bot-gather-handle.json          # Slot extraction + booking logic
│
├── code/
│   ├── slot-extraction.js              # Main NLP code (name/date/time/reason)
│   ├── ask-missing-slot.js             # Multi-turn question builder
│   └── confirmation-message.js        # Voice + WhatsApp message builder
│
├── audio/
│   └── (sample call recordings)
│
└── README.md
```

---

## 🚀 How to Run

### Prerequisites
- n8n Cloud account
- Twilio account with a phone number
- Sarvam AI API key
- Google Sheets (with service account)

### Setup

1. **Clone the repo**
```bash
git clone https://github.com/tanishsaini626-prog/doctor-bot-audio
cd doctor-bot-audio
```

2. **Import workflows into n8n**
   - Go to n8n → New Workflow → Import from file
   - Import `doctor-appointment-bot.json`
   - Import `bot-gather-handle.json`

3. **Set up credentials in n8n**
   - Twilio: Account SID + Auth Token
   - Sarvam AI: API Key
   - Google Sheets: Service Account JSON

4. **Configure Twilio**
   - Set webhook URL to `https://your-n8n.cloud/webhook/doctor-bot`
   - Enable Voice in your Twilio number

5. **Call your number and test!**

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

- 📧 [your email]
- 💼 [LinkedIn profile]
- 🐙 [GitHub](https://github.com/tanishsaini626-prog)

---

## 📄 License

MIT License — feel free to use and build on this.

---

*Built with ❤️ during summer break, 2nd year of college.*
