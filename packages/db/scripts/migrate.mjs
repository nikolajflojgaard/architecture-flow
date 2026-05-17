import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemaDir = path.resolve(__dirname, '../schema');
const files = fs
  .readdirSync(schemaDir)
  .filter((file) => file.endsWith('.sql'))
  .sort();

const pool = new Pool({ connectionString: databaseUrl });

await pool.query(`
  create table if not exists schema_migrations (
    version text primary key,
    applied_at timestamptz not null default now()
  )
`);

for (const file of files) {
  const alreadyApplied = await pool.query('select 1 from schema_migrations where version = $1', [file]);
  if (alreadyApplied.rowCount) {
    console.log(`skip ${file}`);
    continue;
  }

  const sql = fs.readFileSync(path.join(schemaDir, file), 'utf8');
  await pool.query('begin');
  try {
    await pool.query(sql);
    await pool.query('insert into schema_migrations(version) values ($1)', [file]);
    await pool.query('commit');
    console.log(`applied ${file}`);
  } catch (error) {
    await pool.query('rollback');
    throw error;
  }
}

await pool.end();
