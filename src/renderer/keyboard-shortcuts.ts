import { emitIpcEvent } from './electron.web'

const isMac
  = typeof navigator !== 'undefined'
    && navigator.platform.toUpperCase().includes('MAC')
const modKey = isMac ? 'metaKey' : 'ctrlKey'

// Maps key combos (with mod key held) to IPC channels
const shortcuts: Record<string, string> = {
  'n': 'main-menu:new-snippet',
  'shift+n': 'main-menu:new-folder',
  ',': 'main-menu:goto-preferences',
  '\\': 'main-menu:toggle-sidebar',
}

export function registerKeyboardShortcuts(): void {
  document.addEventListener('keydown', (e) => {
    if (!e[modKey])
      return

    let key = e.key.toLowerCase()
    if (e.shiftKey)
      key = `shift+${key}`

    const channel = shortcuts[key]
    if (channel) {
      e.preventDefault()
      emitIpcEvent(channel)
    }
  })
}
