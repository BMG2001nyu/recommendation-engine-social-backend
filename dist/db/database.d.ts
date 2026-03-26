import Database from 'better-sqlite3';
export declare function getDb(): Database.Database;
/** Create an isolated in-memory DB for tests */
export declare function createTestDb(): Database.Database;
/** Override the module-level singleton — used in tests */
export declare function setDb(db: Database.Database): void;
export declare function closeDb(): void;
//# sourceMappingURL=database.d.ts.map