import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import { join } from 'path'

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!_db) {
    const dbPath = process.env.DATABASE_PATH ?? join(process.cwd(), 'luna.db')
    _db = new Database(dbPath)
    _db.pragma('journal_mode = WAL')
    _db.pragma('foreign_keys = ON')
    applySchema(_db)
  }
  return _db
}

/** Create an isolated in-memory DB for tests */
export function createTestDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  applySchema(db)
  return db
}

/** Override the module-level singleton — used in tests */
export function setDb(db: Database.Database): void {
  _db = db
}

export function closeDb(): void {
  if (_db) {
    _db.close()
    _db = null
  }
}

function applySchema(db: Database.Database): void {
  const schemaPath = join(__dirname, 'schema.sql')
  const sql = readFileSync(schemaPath, 'utf-8')
  db.exec(sql)
}
