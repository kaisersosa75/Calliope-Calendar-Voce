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
  await notifyUser({ ...user, notifyChannel: 'email' }, msg);

  return { status: 'conflict', alternatives, message: msg };
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


export default router;
