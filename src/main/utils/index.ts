export function log(context: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error)
  const stack = error instanceof Error ? error.stack : undefined

  console.error(`[${context}] ${message}`, error)

  try {
    // eslint-disable-next-line ts/no-require-imports
    const { BrowserWindow } = require('electron')
    BrowserWindow.getFocusedWindow()?.webContents.send('system:error', {
      context,
      message,
      stack,
    })
  }
  catch {
    // Not in Electron context — console.error above is sufficient
  }
}

// NOTE: This function exists in the original codebase as a workaround for
// Electron's CommonJS/ESM interop. It uses `new Function` to perform a
// dynamic ESM import that bypasses CommonJS restrictions.
export function importEsm(specifier: string) {
  // eslint-disable-next-line no-new-func
  return new Function('s', 'return import(s)')(specifier) as Promise<any>
}
