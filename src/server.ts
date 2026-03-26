import { createApp } from './app'
import { getDb } from './db/database'

const PORT = Number(process.env.PORT ?? 3000)

async function main(): Promise<void> {
  // Ensure DB is initialised
  getDb()

  const app = createApp()

  app.listen(PORT, () => {
    console.log(`🌙 Luna recommendation backend running on http://localhost:${PORT}`)
    console.log(`   Health: http://localhost:${PORT}/health`)
    console.log(`   Feed:   http://localhost:${PORT}/api/feed/:userId`)
  })
}

main().catch((err) => {
  console.error('Fatal startup error:', err)
  process.exit(1)
})
