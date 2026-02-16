import ky from 'ky'
import { store } from '@/electron'
import { Api } from './generated'

// In web mode, __MASSCODE_API_URL__ is injected at runtime (via config.js)
// In Electron mode, we construct URL from the stored API port
const apiUrl
  = (window as any).__MASSCODE_API_URL__
    || `http://localhost:${store.preferences.get('apiPort')}`

const apiToken = (window as any).__MASSCODE_API_TOKEN__ || ''

const customFetch: typeof ky = apiToken
  ? ky.extend({
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
    })
  : ky

export const api = new Api({
  baseUrl: apiUrl,
  customFetch,
})
