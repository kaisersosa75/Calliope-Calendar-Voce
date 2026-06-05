import 'dotenv/config';

// I servizi esterni vengono caricati solo se servono.

export async function notifyConsole(message) {
  console.log('\n========== NOTIFICA (slot occupato) ==========');
  console.log(message);
  console.log('==============================================\n');
  return { channel: 'console', delivered: true };
}

// --- Email via Gmail (SMTP con password per app) ---
export async function notifyEmail(toEmail, subject, message) {
  const nodemailer = (await import('nodemailer')).default;
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
  return transporter.sendMail({
    from: `CALLIOPE (Voice Calendar) <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject,
    text: message,
  });
}

export async function notifyWhatsApp(toPhone, message) {
  const twilio = (await import('twilio')).default;
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  return client.messages.create({
    from: process.env.TWILIO_WHATSAPP_FROM,
    to: `whatsapp:${toPhone}`,
    body: message,
  });
}

export async function notifyVoice(toPhone, message) {
  const twilio = (await import('twilio')).default;
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  const twiml = `<Response><Say language="it-IT">${message}</Say></Response>`;
  return client.calls.create({ from: process.env.TWILIO_VOICE_FROM, to: toPhone, twiml });
}

/**
 * Invia la notifica sul canale preferito dall'utente.
 */
export async function notifyUser(user, message, subject = '[CALLIOPE] Slot non disponibile') {
  switch (user.notifyChannel) {
    case 'whatsapp': return notifyWhatsApp(user.phone, message);
    case 'voice':    return notifyVoice(user.phone, message);
    case 'email':    return notifyEmail(user.email, subject, message);
    case 'console':
    default:         return notifyConsole(message);
  }
}