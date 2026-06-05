import { google } from 'googleapis';
import 'dotenv/config';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'openid',
  'email',
  'profile',
];

/** Crea un client OAuth "vuoto" (senza credenziali utente). */
export function newOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

/** URL a cui mandare l'utente per il consenso. */
export function getAuthUrl() {
  return newOAuthClient().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });
}

/**
 * Client OAuth già autenticato con il refresh token (decifrato) di un utente.
 * Usato per operare sul calendario di QUELLO specifico utente.
 */
export function oauthClientForUser(refreshToken) {
  const client = newOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

export function calendarForUser(refreshToken) {
  return google.calendar({ version: 'v3', auth: oauthClientForUser(refreshToken) });
}
