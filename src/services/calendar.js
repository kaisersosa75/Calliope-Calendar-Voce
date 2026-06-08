import { calendarForUser } from '../config/google.js';
import 'dotenv/config';

const TIMEZONE = process.env.TIMEZONE || 'Europe/Rome';

/**
 * Tutte le funzioni ricevono il refreshToken dell'utente loggato
 * (fornito dal middleware requireAuth) e operano sul SUO calendario.
 */

export async function isSlotFree(refreshToken, startISO, endISO) {
  const calendar = calendarForUser(refreshToken);
  const { data } = await calendar.freebusy.query({
    requestBody: {
      timeMin: startISO,
      timeMax: endISO,
      timeZone: TIMEZONE,
      items: [{ id: 'primary' }],
    },
  });

  // LOG temporaneo: vediamo cosa risponde davvero Google
  console.log('FREEBUSY', startISO, '->', endISO, JSON.stringify(data.calendars));

  // Robusto: prende il primo calendario nella risposta, qualunque sia la sua chiave
  const calendars = data.calendars || {};
  const firstKey = Object.keys(calendars)[0];
  const busy = firstKey ? (calendars[firstKey].busy || []) : [];
  return busy.length === 0;
}

export async function createEvent(refreshToken, { title, startISO, endISO, location }) {
  const calendar = calendarForUser(refreshToken);
  const requestBody = {
    summary: `${title} (aggiunto da CALLIOPE Voice Calendar)`,
    start: { dateTime: startISO, timeZone: TIMEZONE },
    end: { dateTime: endISO, timeZone: TIMEZONE },
  };
  // Campo "luogo o videochiamata" su Google Calendar
  if (location && location.trim()) {
    requestBody.location = location.trim();
  }
  const { data } = await calendar.events.insert({ calendarId: 'primary', requestBody });
  return data;
}

export async function findAlternativeSlots(refreshToken, startISO, durationMinutes, count = 3) {
  const slots = [];
  let cursor = new Date(startISO);
  const maxAttempts = 48;

  for (let i = 0; i < maxAttempts && slots.length < count; i++) {
    cursor = new Date(cursor.getTime() + durationMinutes * 60000);
    const end = new Date(cursor.getTime() + durationMinutes * 60000);
    if (await isSlotFree(refreshToken, cursor.toISOString(), end.toISOString())) {
      slots.push({ startISO: cursor.toISOString(), endISO: end.toISOString() });
    }
  }
  return slots;
}
