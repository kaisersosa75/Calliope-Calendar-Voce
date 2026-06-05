import OpenAI from 'openai';
import 'dotenv/config';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Estrae un appuntamento strutturato da testo libero in italiano.
 * Gestisce date relative rispetto a nowISO.
 */
export async function parseAppointment(text, nowISO = new Date().toISOString()) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content:
          `Sei un parser di appuntamenti. La data/ora corrente è ${nowISO} ` +
          `(timezone ${process.env.TIMEZONE}). Risolvi i riferimenti relativi ` +
          `rispetto a questo momento. Se la durata non è specificata usa 60 minuti.`,
      },
      { role: 'user', content: text },
    ],
    tools: [
      {
        type: 'function',
        function: {
          name: 'create_appointment',
          description: 'Crea un appuntamento dai dati estratti',
          parameters: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              startISO: { type: 'string' },
              durationMinutes: { type: 'integer' },
            },
            required: ['title', 'startISO', 'durationMinutes'],
          },
        },
      },
    ],
    tool_choice: { type: 'function', function: { name: 'create_appointment' } },
  });

  const call = response.choices[0].message.tool_calls[0];
  return JSON.parse(call.function.arguments);
}
