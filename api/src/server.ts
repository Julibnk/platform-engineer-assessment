import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import routes from './routes.js';
import { errorHandler } from './middleware.js';

const app: Express = express();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173' }));
app.use(rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false }));
app.use(express.json({ limit: '64kb' }));

app.use('/', routes);
app.use(errorHandler);

export default app;
