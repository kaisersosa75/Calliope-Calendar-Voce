import express from 'express';
import session from 'express-session';
import cors from 'cors';
import authRoutes from './src/routes/auth.js';
import appointmentRoutes from './src/routes/appointment.js';
import 'dotenv/config';
import connectPgSimple from 'connect-pg-simple';
import pg from 'pg';

const app = express();
app.use(express.json());
app.use(express.static('public'));
app.use(cors({ origin: true, credentials: true }));


const PgSession = connectPgSimple(session);
const pgPool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

app.set('trust proxy', 1); // necessario dietro il proxy HTTPS di Render

app.use(session({
  store: new PgSession({ pool: pgPool, createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
}));

app.use('/auth', authRoutes);
app.use('/appointment', appointmentRoutes);
app.get('/health', (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend in ascolto su :${PORT}`));
