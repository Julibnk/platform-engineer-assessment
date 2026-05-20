import { Router, type Router as ExpressRouter } from 'express';
import { dataRequestSchema, dimensions, metrics } from '@octane11/shared';
import { ValidationError } from '@octane11/shared';
import db from './db.js';
import { executeQuery } from './query-builder/index.js';

const router: ExpressRouter = Router();

// Returns semantic metadata + distinct filter values for the UI dropdowns.
router.get('/masterdata', (_req, res) => {
  const campaigns = (
    db.prepare('SELECT DISTINCT campaign_id FROM events ORDER BY campaign_id').all() as { campaign_id: string }[]
  ).map((r) => r.campaign_id);

  const accounts = (
    db.prepare('SELECT DISTINCT account_id FROM events ORDER BY account_id').all() as { account_id: string }[]
  ).map((r) => r.account_id);

  const channels = (
    db.prepare('SELECT DISTINCT channel FROM events ORDER BY channel').all() as { channel: string }[]
  ).map((r) => r.channel);

  res.json({ metrics, dimensions, campaigns, accounts, channels });
});

// Main query endpoint — body validated by Zod, then executed by the query builder.
router.post('/query', (req, res, next) => {
  const result = dataRequestSchema.safeParse(req.body);
  if (!result.success) {
    next(new ValidationError(result.error.issues.map((i) => i.message).join('; ')));
    return;
  }

  try {
    const response = executeQuery(result.data, db);
    res.json(response);
  } catch (err) {
    next(err);
  }
});

export default router;
