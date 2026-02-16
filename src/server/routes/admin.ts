import { Elysia } from 'elysia'
import {
  clearDB,
  createBackup,
  deleteBackup,
  getBackupList,
  restoreFromBackup,
} from '../../main/db'

const admin = new Elysia({ prefix: '/admin' })
  .get('/health', () => ({ status: 'ok', timestamp: Date.now() }))

  .get('/backups', async () => {
    const backups = await getBackupList()
    return backups
  })

  .post('/backups', async () => {
    const backupPath = await createBackup(true)
    return { message: 'Backup created', path: backupPath }
  })

  .post('/restore', async ({ body, set }) => {
    const { path } = body as { path: string }
    if (!path) {
      set.status = 400
      return { error: 'Backup path is required' }
    }
    await restoreFromBackup(path)
    return { message: 'Database restored from backup' }
  })

  .delete('/backups', async ({ body, set }) => {
    const { path } = body as { path: string }
    if (!path) {
      set.status = 400
      return { error: 'Backup path is required' }
    }
    await deleteBackup(path)
    return { message: 'Backup deleted' }
  })

  .post('/clear', async () => {
    clearDB()
    return { message: 'Database cleared' }
  })

export default admin
