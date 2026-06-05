import { PrismaClient } from '@prisma/client';
import { decrypt } from '../services/crypto.js';

const prisma = new PrismaClient();

/**
 * Richiede un utente loggato. Carica il suo refresh token decifrato
 * e lo mette in req.refreshToken per i servizi a valle.
 */
export async function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Non autenticato' });
  }
  const token = await prisma.googleToken.findUnique({
    where: { userId: req.session.userId },
  });
  if (!token) {
    return res.status(401).json({ error: 'Calendario non collegato' });
  }
  req.userId = req.session.userId;
  req.refreshToken = decrypt(token.refreshTokenEnc);
  next();
}
