/* eslint-disable node/prefer-global/process */
import { homedir, platform } from 'node:os'
import { cors } from '@elysiajs/cors'
import { node } from '@elysiajs/node'
import { swagger } from '@elysiajs/swagger'
import { Elysia } from 'elysia'
import folders from '../main/api/routes/folders'
import snippets from '../main/api/routes/snippets'
import tags from '../main/api/routes/tags'
import { setConfig } from '../main/config'
import { startAutoBackup, useDB } from '../main/db'
import { authMiddleware } from './auth'
import admin from './routes/admin'

const isWin = platform() === 'win32'
const defaultStorage = isWin
  ? `${homedir()}\\massCode`
  : `${homedir()}/massCode`

const PORT = Number(process.env.MASSCODE_PORT || 4321)
const STORAGE_PATH = process.env.MASSCODE_STORAGE_PATH || defaultStorage
const BACKUP_PATH
  = process.env.MASSCODE_BACKUP_PATH || `${STORAGE_PATH}/backups`
const API_TOKEN = process.env.MASSCODE_API_TOKEN || ''
const CORS_ORIGIN = process.env.MASSCODE_CORS_ORIGIN || '*'

// Read version from package.json
let version = '4.4.0'
try {
  // eslint-disable-next-line ts/no-require-imports
  version = require('../../package.json').version
}
catch {}

// Initialize config before anything else
setConfig({
  storagePath: STORAGE_PATH,
  apiPort: PORT,
  version,
  backup: {
    path: BACKUP_PATH,
    enabled: process.env.MASSCODE_BACKUP_ENABLED !== 'false',
    interval: Number(process.env.MASSCODE_BACKUP_INTERVAL || 6),
    maxBackups: Number(process.env.MASSCODE_MAX_BACKUPS || 5),
  },
})

// Initialize database
useDB()

const app = new Elysia({ adapter: node() })

// Apply auth middleware if token is set
if (API_TOKEN) {
  app.use(authMiddleware(API_TOKEN))
}

app
  .use(cors({ origin: CORS_ORIGIN }))
  .use(
    swagger({
      documentation: {
        info: {
          title: 'massCode API',
          version,
        },
      },
    }),
  )
  .use(snippets)
  .use(folders)
  .use(tags)
  .use(admin)
  .listen(PORT)

// eslint-disable-next-line no-console
console.log(`\nmassCode API server started`)
// eslint-disable-next-line no-console
console.log(`  Port:    ${PORT}`)
// eslint-disable-next-line no-console
console.log(`  Storage: ${STORAGE_PATH}`)
// eslint-disable-next-line no-console
console.log(`  Auth:    ${API_TOKEN ? 'enabled (token)' : 'disabled'}`)
// eslint-disable-next-line no-console
console.log(`  Swagger: http://localhost:${PORT}/swagger\n`)

// Start auto backup
startAutoBackup()
