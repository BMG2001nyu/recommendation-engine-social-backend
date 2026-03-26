"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDb = getDb;
exports.createTestDb = createTestDb;
exports.setDb = setDb;
exports.closeDb = closeDb;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const fs_1 = require("fs");
const path_1 = require("path");
let _db = null;
function getDb() {
    if (!_db) {
        const dbPath = process.env.DATABASE_PATH ?? (0, path_1.join)(process.cwd(), 'luna.db');
        _db = new better_sqlite3_1.default(dbPath);
        _db.pragma('journal_mode = WAL');
        _db.pragma('foreign_keys = ON');
        applySchema(_db);
    }
    return _db;
}
/** Create an isolated in-memory DB for tests */
function createTestDb() {
    const db = new better_sqlite3_1.default(':memory:');
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    applySchema(db);
    return db;
}
/** Override the module-level singleton — used in tests */
function setDb(db) {
    _db = db;
}
function closeDb() {
    if (_db) {
        _db.close();
        _db = null;
    }
}
function applySchema(db) {
    const schemaPath = (0, path_1.join)(__dirname, 'schema.sql');
    const sql = (0, fs_1.readFileSync)(schemaPath, 'utf-8');
    db.exec(sql);
}
//# sourceMappingURL=database.js.map