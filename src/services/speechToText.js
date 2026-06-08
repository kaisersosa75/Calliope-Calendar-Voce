import OpenAI, { toFile } from 'openai';
import fs from 'node:fs';
import 'dotenv/config';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const promptHint =
  'Appuntamento in italiano. Parole comuni: parrucchiere, dentista, ' +
  'medico, riunione, pranzo, cena, palestra, oggi, domani, dopodomani, ' +
  'lunedì, martedì, mercoledì, giovedì, venerdì, sabato, domenica, ' +
  'alle ore, per un\'ora, mezz\'ora.';

export async function transcribe(audioFilePath, originalName = 'audio.webm') {
  const ext = (originalName.split('.').pop() || 'webm').toLowerCase();
  const buffer = fs.readFileSync(audioFilePath);

  // Passa a OpenAI un file con nome ed estensione espliciti
  const file = await toFile(buffer, `audio.${ext}`);

  try {
    const result = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'it',
      prompt: promptHint,
    });
    return result.text;
  } finally {
    try { fs.unlinkSync(audioFilePath); } catch { }
  }
}