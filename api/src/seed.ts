/**
 * Seed script: reads data/events.csv and populates data/events.db.
 * Run via: pnpm --filter @octane11/api seed
 */
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dirname, '../../data');
const csvPath = resolve(dataDir, 'events.csv');
const dbPath = resolve(dataDir, 'events.db');

const db = new Database(dbPath);

db.exec(`
  DROP TABLE IF EXISTS events;
  CREATE TABLE events (
    event_id    TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    account_id  TEXT NOT NULL,
    channel     TEXT NOT NULL,
    event_type  TEXT NOT NULL,
    occurred_at TEXT NOT NULL
  );
  CREATE INDEX idx_events_campaign    ON events(campaign_id);
  CREATE INDEX idx_events_account     ON events(account_id);
  CREATE INDEX idx_events_occurred_at ON events(occurred_at);
`);

const insert = db.prepare(
  'INSERT INTO events (event_id, campaign_id, account_id, channel, event_type, occurred_at) VALUES (?, ?, ?, ?, ?, ?)'
);

const lines = readFileSync(csvPath, 'utf-8').split('\n');
// Skip header row, skip trailing empty lines
const rows = lines.slice(1).filter((l) => l.trim());

const seedAll = db.transaction(() => {
  for (const line of rows) {
    const [event_id, campaign_id, account_id, channel, event_type, occurred_at] = line.split(',');
    insert.run(event_id, campaign_id, account_id, channel, event_type, occurred_at);
  }
});

seedAll();
db.close();

console.log(`Seeded ${rows.length} rows → ${dbPath}`);
