import i18next from 'i18next'

// Bundle all locale files at build time via Vite's glob import
const localeModules = import.meta.glob('../main/i18n/locales/**/*.json', {
  eager: true,
})

function loadLocales(): Record<string, Record<string, any>> {
  const resources: Record<string, Record<string, any>> = {}

  for (const [filePath, mod] of Object.entries(localeModules)) {
    // Path: ../main/i18n/locales/en_US/ui.json
    const match = filePath.match(/locales\/([^/]+)\/([^/]+)\.json$/)
    if (!match)
      continue
    const [, lng, ns] = match
    if (!resources[lng])
      resources[lng] = {}
    resources[lng][ns] = (mod as any).default || mod
  }

  return resources
}

const resources = loadLocales()

// Read language from localStorage if available
const stored = localStorage.getItem('masscode_preferences')
const storedLng = stored ? JSON.parse(stored).language : null

i18next.init({
  fallbackLng: 'en_US',
  lng: storedLng || 'en_US',
  debug: false,
  ns: ['devtools', 'menu', 'messages', 'preferences', 'ui'],
  defaultNS: 'ui',
  resources,
})

export const i18nInstance = i18next
