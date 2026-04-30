const data = $('Code in JavaScript').first().json;

const name        = data.name        || "Unknown";
const date        = data.date        || "Not provided";
const reason      = data.reason      || "Not provided";
const phone       = data.phone       || "Not provided";
const booking_for = data.booking_for || "Self";
const time_slot  = data.time_slot_display || data.time_slot || "Not provided";
const booking_for_text = booking_for === "Self" ? "खुद के लिए" : `${booking_for} ke liye`;
const voice_confirmation = `${name} ji, aapki appointment ${date} ko ${time_slot} ke liye book ho gayi hai. ${booking_for === "Self" ? "" : booking_for + " ke liye."} Dhanyavaad!`;
const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say language="hi-IN">${voice_confirmation}</Say><Hangup/></Response>`;

const message = "New Appointment Booking\n\n" +
  "Patient Name: " + name + "\n" +
  "Phone Number: " + phone + "\n" +
  "Appointment Date: " + date + "\n" +
  "Time Slot: " + time_slot + "\n" +
  "Medical Reason: " + reason + "\n" +
  "Booking For: " + booking_for_text + "\n\n" +
  "Booked via AI Voice Bot\n" +
  "Time: " + new Date().toLocaleString('en-IN', {timeZone:'Asia/Kolkata'});

return [{ json: { ...data, whatsapp_message: message, voice_confirmation: voice_confirmation, twiml: twiml } }];
