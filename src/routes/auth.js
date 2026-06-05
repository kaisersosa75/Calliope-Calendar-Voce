import express from 'express';
import { google } from 'googleapis';
import { PrismaClient } from '@prisma/client';
import { getAuthUrl, newOAuthClient } from '../config/google.js';
import { encrypt } from '../services/crypto.js';

const router = express.Router();
const prisma = new PrismaClient();

// 1) Avvia il login: reindirizza l'utente alla schermata di consenso Google
router.get('/google', (_req, res) => {
  res.redirect(getAuthUrl());
});

// 2) Callback: Google ci rimanda qui con un "code"
router.get('/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    const client = newOAuthClient();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    // Recupera profilo utente
    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const { data: profile } = await oauth2.userinfo.get();

    // Crea/aggiorna utente
    const user = await prisma.user.upsert({
      where: { googleId: profile.id },
      update: { email: profile.email, name: profile.name },
      create: { googleId: profile.id, email: profile.email, name: profile.name },
    });

    // Salva il refresh token CIFRATO (se presente in questa risposta)
    if (tokens.refresh_token) {
      await prisma.googleToken.upsert({
        where: { userId: user.id },
        update: { refreshTokenEnc: encrypt(tokens.refresh_token) },
        create: { userId: user.id, refreshTokenEnc: encrypt(tokens.refresh_token) },
      });
    }

    // Salva l'utente in sessione
    req.session.userId = user.id;
    res.redirect(process.env.FRONTEND_URL || '/');
  } catch (err) {
    console.error(err);
    res.status(500).send('Errore durante il login Google');
  }
});

// 3) Logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// 4) Chi sono (per il frontend)
router.get('/me', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ user: null });
  const user = await prisma.user.findUnique({ where: { id: req.session.userId } });
  res.json({ user });
});

export default router;
