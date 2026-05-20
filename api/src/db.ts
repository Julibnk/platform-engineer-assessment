import Database, { type Database as DB } from 'better-sqlite3';
import { resolve } from 'node:path';

const dbPath = resolve(process.env.DB_PATH ?? '../data/events.db');

// Read-only: the API never writes — only the seed CLI does.
const db: DB = new Database(dbPath, { readonly: true });

export default db;
