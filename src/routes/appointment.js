import express from 'express';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';
import { transcribe } from '../services/speechToText.js';
import { parseAppointment } from '../services/nlu.js';
import { isSlotFree, createEvent, findAlternativeSlots } from '../services/calendar.js';
import { notifyUser } from '../services/notifier.js';

const router = express.Router();
const prisma = new PrismaClient();
const upload = multer({ dest: 'uploads/' });

/** Logica condivisa: dal testo all'evento (o conflitto + notifica). */
async function processText(req, text) {
  const { title, startISO, durationMinutes } = await parseAppointment(text);
  const endISO = new Date(
    new Date(startISO).getTime() + durationMinutes * 60000
  ).toISOString();

  const free = await isSlotFree(req.refreshToken, startISO, endISO);

  if (free) {
    const event = await createEvent(req.refreshToken, { title, startISO, endISO });
    return { status: 'created', title, startISO, eventId: event.id };
  }

  const alternatives = await findAlternativeSlots(req.refreshToken, startISO, durationMinutes);
  const altText = alternatives
    .map((s) => new Date(s.startISO).toLocaleString('it-IT'))
    .join(', ');
  const msg =
    `Lo slot per "${title}" del ${new Date(startISO).toLocaleString('it-IT')} ` +
    `è occupato. Alternative: ${altText || 'nessuna trovata'}.`;

  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  // Online (Render free) l'SMTP è bloccato: non inviamo email, mostriamo il conflitto a schermo.
  if (process.env.NODE_ENV !== 'production') {
    notifyUser({ ...user, notifyChannel: 'email' }, msg)
      .catch((e) => console.error('Notifica fallita (ignorata):', e.message));
  } else {
    console.log('NOTIFICA (conflitto):', msg);
  }

  return { status: 'conflict', alternatives, message: msg, title, durationMinutes, requestedISO: startISO };
}

// Testo
router.post('/text', requireAuth, async (req, res) => {
  try {
    res.json(await processText(req, req.body.text));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Audio
router.post('/voice', requireAuth, upload.single('audio'), async (req, res) => {
  try {
    const text = await transcribe(req.file.path);
    res.json(await processText(req, text));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Solo trascrizione: restituisce il testo senza creare l'evento
router.post('/transcribe', requireAuth, upload.single('audio'), async (req, res) => {
  try {
    const text = await transcribe(req.file.path, req.file.originalname);
    res.json({ text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Crea un evento a un orario già preciso (usato dai pulsanti delle alternative)
router.post('/book', requireAuth, async (req, res) => {
  try {
    const { title, startISO, durationMinutes, force } = req.body;
    const endISO = new Date(
      new Date(startISO).getTime() + (durationMinutes || 60) * 60000
    ).toISOString();
    // Se non forzato, verifica che sia ancora libero
    if (!force) {
      const free = await isSlotFree(req.refreshToken, startISO, endISO);
      if (!free) {
        return res.json({ status: 'conflict', message: 'Anche questo orario è appena stato occupato.' });
      }
    }
    const event = await createEvent(req.refreshToken, { title, startISO, endISO });
    res.json({ status: 'created', title, startISO, eventId: event.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
