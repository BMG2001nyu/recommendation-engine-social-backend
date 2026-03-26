"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const database_1 = require("./db/database");
const PORT = Number(process.env.PORT ?? 3000);
async function main() {
    // Ensure DB is initialised
    (0, database_1.getDb)();
    const app = (0, app_1.createApp)();
    app.listen(PORT, () => {
        console.log(`🌙 Luna recommendation backend running on http://localhost:${PORT}`);
        console.log(`   Health: http://localhost:${PORT}/health`);
        console.log(`   Feed:   http://localhost:${PORT}/api/feed/:userId`);
    });
}
main().catch((err) => {
    console.error('Fatal startup error:', err);
    process.exit(1);
});
//# sourceMappingURL=server.js.map