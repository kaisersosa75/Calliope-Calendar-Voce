import OpenAI from 'openai';
import fs from 'node:fs';
import 'dotenv/config';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Trascrive un file audio in testo.
 * Usa whisper-1 (ottima compatibilità col webm del browser) + un prompt
 * con parole tipiche per migliorare l'accuratezza.
 */
export async function transcribe(audioFilePath, originalName = 'audio.webm') {
  const ext = originalName.split('.').pop().toLowerCase();
  const renamed = `${audioFilePath}.${ext}`;
  fs.renameSync(audioFilePath, renamed);

  const promptHint =
    'Appuntamento in italiano. Parole comuni: parrucchiere, dentista, ' +
    'medico, riunione, pranzo, cena, palestra, oggi, domani, dopodomani, ' +
    'lunedì, martedì, mercoledì, giovedì, venerdì, sabato, domenica, ' +
    'alle ore, per un\'ora, mezz\'ora.';

  const result = await openai.audio.transcriptions.create({
    file: fs.createReadStream(renamed),
    model: 'whisper-1',
    language: 'it',
    prompt: promptHint,
  });

  fs.unlinkSync(renamed);
  return result.text;
}