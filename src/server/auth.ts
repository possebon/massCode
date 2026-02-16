import { Elysia } from 'elysia'

const SKIP_AUTH_PATHS = new Set(['/swagger', '/swagger/json', '/admin/health'])

export function authMiddleware(token: string) {
  return new Elysia({ name: 'auth' }).onBeforeHandle(
    { as: 'global' },
    ({ request, path, set }) => {
      if (SKIP_AUTH_PATHS.has(path)) {
        return
      }

      const authHeader = request.headers.get('authorization')

      if (!authHeader) {
        set.status = 401
        return { error: 'Missing Authorization header' }
      }

      const [scheme, value] = authHeader.split(' ')

      if (scheme !== 'Bearer' || value !== token) {
        set.status = 401
        return { error: 'Invalid token' }
      }
    },
  )
}
