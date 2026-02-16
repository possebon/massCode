/**
 * Browser compatibility shim for window.electron.
 *
 * When the web build is created via vite.config.web.mjs, the Vite alias
 * redirects all `import { ... } from '@/electron'` to this file instead
 * of the real preload bridge (electron.ts).
 *
 * This provides browser-compatible replacements for store, ipc, i18n, and db.
 */

import { i18nInstance } from './i18n-web'

// ---------------------------------------------------------------------------
// Store — localStorage wrapper matching electron-store interface
// ---------------------------------------------------------------------------

const PREFERENCES_DEFAULTS = {
  storagePath: '',
  apiPort: 4321,
  language: 'en_US',
  theme: 'auto' as const,
  editor: {
    fontSize: 13,
    fontFamily: 'SF Mono, Consolas, Menlo, Ubuntu Mono, monospace',
    wrap: false,
    tabSize: 2,
    trailingComma: 'all' as const,
    semi: false,
    singleQuote: false,
    highlightLine: false,
    matchBrackets: true,
  },
  markdown: { scale: 1, previewOnOpen: true },
  backup: {
    path: '',
    enabled: true,
    interval: 6,
    maxBackups: 5,
  },
}

const APP_DEFAULTS = {
  bounds: {},
  sizes: {
    sidebarWidth: 180,
    snippetListWidth: 250,
    tagsListHeight: 50,
  },
  state: {},
  isAutoMigratedFromJson: false,
}

function createLocalStore<T extends Record<string, any>>(
  name: string,
  defaults: T,
) {
  const KEY = `masscode_${name}`

  function getData(): T {
    try {
      const raw = localStorage.getItem(KEY)
      return raw ? { ...defaults, ...JSON.parse(raw) } : { ...defaults }
    }
    catch {
      return { ...defaults }
    }
  }

  function setData(data: T): void {
    localStorage.setItem(KEY, JSON.stringify(data))
  }

  return {
    get(key: string): any {
      const data = getData()
      // Support dot-notation like 'sizes.sidebarWidth'
      return key.split('.').reduce((obj: any, k) => obj?.[k], data)
    },
    set(key: string, value: any): void {
      const data = getData()
      const keys = key.split('.')
      let target: any = data
      for (let i = 0; i < keys.length - 1; i++) {
        if (target[keys[i]] === undefined)
          target[keys[i]] = {}
        target = target[keys[i]]
      }
      target[keys[keys.length - 1]] = value
      setData(data)
    },
    delete(key: string): void {
      const data = getData()
      delete (data as any)[key]
      setData(data)
    },
  }
}

export const store = {
  app: createLocalStore('app', APP_DEFAULTS),
  preferences: createLocalStore('preferences', PREFERENCES_DEFAULTS),
}

// ---------------------------------------------------------------------------
// IPC — browser shim with event bus for keyboard shortcuts
// ---------------------------------------------------------------------------

type EventCallback = (...args: any[]) => void
const listeners = new Map<string, Set<EventCallback>>()

/** Emit an event to registered listeners (used by keyboard shortcuts). */
export function emitIpcEvent(channel: string, ...args: any[]): void {
  listeners.get(channel)?.forEach(cb => cb({}, ...args))
}

function getApiUrl(): string {
  return (window as any).__MASSCODE_API_URL__ || ''
}

function getAuthHeaders(): Record<string, string> {
  const token = (window as any).__MASSCODE_API_TOKEN__
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export const ipc = {
  on(channel: string, cb: EventCallback): void {
    if (!listeners.has(channel))
      listeners.set(channel, new Set())
    listeners.get(channel)!.add(cb)
  },

  send(channel: string, _data: any, cb?: EventCallback): void {
    if (cb) {
      if (!listeners.has(channel))
        listeners.set(channel, new Set())
      listeners.get(channel)!.add(cb)
    }
  },

  async invoke(channel: string, data?: any): Promise<any> {
    switch (channel) {
      case 'system:open-external':
        window.open(data, '_blank', 'noopener')
        return

      case 'system:reload':
        window.location.reload()
        return

      case 'prettier:format': {
        const prettier = await import('prettier/standalone')
        const plugins = await Promise.all([
          import('prettier/plugins/babel'),
          import('prettier/plugins/html'),
          import('prettier/plugins/typescript'),
          import('prettier/plugins/estree'),
        ])
        const editorSettings = store.preferences.get('editor')
        return prettier.format(data.text, {
          parser: data.parser,
          plugins: plugins.map((p: any) => p.default || p),
          tabWidth: editorSettings?.tabSize || 2,
          trailingComma: editorSettings?.trailingComma || 'all',
          semi: editorSettings?.semi ?? false,
          singleQuote: editorSettings?.singleQuote ?? false,
        })
      }

      case 'main-menu:open-dialog':
        // File dialogs not available in browser — features that use this
        // are hidden via v-if="isElectron" in templates
        return ''

      // DB admin operations → route to server admin API
      case 'db:backup': {
        const res = await fetch(`${getApiUrl()}/admin/backups`, {
          method: 'POST',
          headers: getAuthHeaders(),
        })
        return res.json()
      }
      case 'db:backup-list': {
        const res = await fetch(`${getApiUrl()}/admin/backups`, {
          headers: getAuthHeaders(),
        })
        return res.json()
      }
      case 'db:restore': {
        const res = await fetch(`${getApiUrl()}/admin/restore`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({ path: data }),
        })
        return res.json()
      }
      case 'db:delete-backup': {
        const res = await fetch(`${getApiUrl()}/admin/backups`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({ path: data }),
        })
        return res.json()
      }
      case 'db:clear': {
        const res = await fetch(`${getApiUrl()}/admin/clear`, {
          method: 'POST',
          headers: getAuthHeaders(),
        })
        return res.json()
      }

      // Not available in web mode
      case 'db:reload':
      case 'db:move':
      case 'db:migrate':
      case 'db:move-backup':
      case 'db:start-auto-backup':
      case 'db:stop-auto-backup':
      case 'fs:assets':
        console.warn(`[web] IPC channel '${channel}' not available in browser`)
        return

      default:
        console.warn(`[web] Unhandled IPC channel: ${channel}`)
    }
  },

  removeListener(channel: string, cb: EventCallback): void {
    listeners.get(channel)?.delete(cb)
  },

  removeListeners(channel: string): void {
    listeners.delete(channel)
  },
}

// ---------------------------------------------------------------------------
// i18n — delegates to client-side i18next
// ---------------------------------------------------------------------------

export const i18n = {
  t: (key: string, options?: any) => i18nInstance.t(key, options),
}

// ---------------------------------------------------------------------------
// db — unused in renderer, stub for interface compatibility
// ---------------------------------------------------------------------------

export const db = {
  query: async () => {
    console.warn('[web] Direct DB queries not available in browser')
    return null
  },
}
