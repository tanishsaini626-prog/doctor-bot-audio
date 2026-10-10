# Edge Cases — what the bot handles now

Every row below is covered by an automated test in `tests/`. Run them with:

```bash
npm test
```

## 1. Speech & language

| # | Situation | What happens |
|---|---|---|
| 1 | Silence / empty speech result (`actionOnEmptyResult`) | Nothing is wiped; the bot re-asks the same question with "मुझे कुछ सुनाई नहीं दिया" |
| 2 | Noise: `hello`, `hmm`, `aa`, `[Background noise]`, `(inaudible)` | Treated as no answer, not as data |
| 3 | "shaam" transcribed as `sam` / `shyam` / `shaah` | All phonetic variants map to Evening (the original infinite-loop bug) |
| 4 | Mixed Hindi + English in one sentence | Both are scanned (Devanagari + Latin + Hinglish) |
| 5 | Devanagari digits `१०` | Converted to `10` before parsing |
| 6 | A very long transcript | Truncated to 500 characters so the flow can't stall |
| 7 | Everything in one sentence | All four slots are captured in a single turn and it books immediately |

## 2. Name

| # | Situation | What happens |
|---|---|---|
| 8 | `mera naam Priya Sharma hai` | Name = `Priya Sharma` (stops at "hai", keeps capitals) |
| 9 | Bare answer `Priya` after being asked | Accepted **only** when the bot had asked for the name |
| 10 | Titles: `Dr.`, `Mr.`, `Shrimati`, `जी`, `डॉक्टर` | Stripped |
| 11 | Caller says `kal`, `bukhar`, `haan`, `nahi`, `theek hai` when asked for a name | Rejected — re-asks instead of saving nonsense |
| 12 | Name containing `&` or `<` (e.g. `R&D`) | XML-escaped before it reaches TwiML, so the call never breaks |
| 13 | Third-party booking: `meri mummy ka naam Sunita hai` | Name = `Sunita`, Booking For = `Mother` |
| 14 | `maafi chahiye` (contains "maa") | Not mis-read as Mother (word-boundary matching) |
| 15 | Speech-to-text returns lowercase `priya sharma` | Title-cased for the sheet/dashboard |

## 3. Date

| # | Situation | What happens |
|---|---|---|
| 16 | `aaj` / `kal` / `parso` (Hindi + Hinglish) | Today / tomorrow / day-after |
| 17 | Day names: `somvar`, `Monday`, `सोमवार` | Next occurrence; same day means today |
| 18 | `25 june`, `24/6`, `24-06-2026`, `6/24` | Parsed (Indian DD/MM default, MM/DD only when unambiguous) |
| 19 | `5 tarikh` when the 5th already passed | Rolls to the next month |
| 20 | `agle hafte` / `next week`, `agle mahine` / `next month` | +7 days / +1 month |
| 21 | Impossible dates: `32 january`, `31 february` | Rejected with "तारीख समझ नहीं आई" and re-asked |
| 22 | Past date (`1 june` on 20 June) | Rejected with "यह तारीख बीत चुकी है" and re-asked |
| 23 | More than 90 days ahead | Rejected as too far |
| 24 | Sunday / clinic-closed day | Rejected with "उस दिन क्लिनिक बंद रहता है" |
| 25 | `subah 10.30 baje` | The clock reading is **not** mistaken for a date |

## 4. Time slot

| # | Situation | What happens |
|---|---|---|
| 26 | `subah/dopahar/shaam/raat` + hour | Mapped to 24-hour clinic time |
| 27 | `shaam 9 baje` | Night 21:00 (not "Evening 22:00" like before) |
| 28 | `raat 12 baje` | Outside clinic hours → re-asked |
| 29 | `4 baje` (no period word) | Read as 16:00, not 04:00 |
| 30 | `saadhe 4` / `sava 10` / `paune 5` | 16:30 / 10:15 / 16:45 |
| 31 | `10:30`, `10.30 baje` | Half-hours supported |
| 32 | `14 baje` (24-hour speech) | 14:00 Afternoon |
| 33 | Hour outside 9:00–21:00 | Rejected with the clinic-hours message and re-asked |
| 34 | `koi bhi` / `chalega` / `anytime` | Bot picks the first morning slot |
| 35 | Period only (`subah`) | Booked as a morning *window* (9:00–12:00) |

## 5. Reason

| # | Situation | What happens |
|---|---|---|
| 36 | `bukhar aur khansi hai` | Both kept: `Fever, Cough` (up to 3) |
| 37 | 19 symptom groups | Fever, Cough, Cold, Headache, Stomach, Back, Tooth, Throat, Eye, Ear, Vomiting, Breathing, BP, Sugar, Weakness, Injury, Allergy, Skin, Joints |
| 38 | `checkup`, `report`, `dawai`, `tika`, `follow up` | Treated as valid reasons |
| 39 | `tabiyat kharab hai` (vague) | Recorded as `General Checkup` |
| 40 | Caller refuses: `kuch nahi`, `nahi bataunga` | Recorded as `Not specified` instead of looping forever |

## 6. Conversation control

| # | Situation | What happens |
|---|---|---|
| 41 | Correction `nahi, shaam 5 baje` | The new answer always wins; other slots are kept |
| 42 | Correction with an invalid value | Only that slot is re-opened, the rest survive |
| 43 | Three turns in a row with no progress | Polite goodbye + partial row saved as `Incomplete` |
| 44 | Progress after a bad turn | The attempt counter resets, so the caller isn't cut off unfairly |
| 45 | Each question has 3 phrasings | Attempt 2 gives an example, attempt 3 asks for one word only |
| 46 | Only one missing slot is asked per turn | Never overwhelms the caller |
| 47 | Caller hangs up mid-call | Twilio status callback saves the partial row as `Abandoned` |
| 48 | Re-calling the number | A fresh session starts (old unfinished session is cleared) |

## 7. Call classification (ends early)

| # | Situation | What happens |
|---|---|---|
| 49 | `galat number`, `wrong number`, `cancel`, `band karo` | Polite goodbye, **no row saved** |
| 50 | `abhi busy hoon`, `baad me call karta hoon` | Polite goodbye, no row saved |
| 51 | Emergency words: `seene me dard`, `saans nahi`, `behosh`, `khoon`, `accident`, `108`, `emergency` | Caller is told to call 108 / go to hospital; row saved as `Emergency` with `URGENT` priority |

## 8. Booking rules (backend only)

| # | Situation | What happens |
|---|---|---|
| 52 | Same phone + same date + same slot again | Marked `Duplicate`, the caller hears "पहले से बुक है", no second row |
| 53 | Slot already full (`MAX_PER_SLOT`) | Caller is asked to pick another time instead of overbooking |
| 54 | Caller only says "hello" and hangs up | Nothing is saved |

## 9. Reliability & security

| # | Situation | What happens |
|---|---|---|
| 55 | A bug inside the extraction code | Wrapped in a safe path — the call still gets valid TwiML |
| 56 | Google Sheets / WhatsApp / MongoDB failure | Logged, never breaks the phone call |
| 57 | XML-breaking characters in any user text | Escaped in every `<Say>` and in the `<Gather action>` URL |
| 58 | Twilio/ngrok/n8n domain change | The `Gather` URL is derived from the incoming webhook, so nothing is hard-coded |
| 59 | Secrets | No API keys or passwords in the repo; `.gitignore` blocks `.env`, `mongoatlas.txt`, service-account JSON and context notes |

## Known limits (deliberately out of scope)

- One appointment per call (the bot books, confirms and hangs up).
- No live doctor availability calendar — capacity is a simple per-slot cap.
- No payment or insurance handling.
- The clinic's holidays are not in a table yet (`CONFIG.clinic.closedDays` only
  covers Sundays); add dates there if needed.
- Twilio's speech recognition quality is the main source of wrong dates/times —
  the bot re-asks instead of guessing.
