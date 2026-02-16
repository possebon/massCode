import { store } from '@/electron'

const cursorPosition = reactive({
  row: 0,
  column: 0,
})

const settings = reactive(store.preferences.get('editor'))
const markdownSettings = reactive(store.preferences.get('markdown'))

watch(
  settings,
  () => {
    store.preferences.set('editor', JSON.parse(JSON.stringify(settings)))
  },
  { deep: true },
)

watch(
  markdownSettings,
  () => {
    store.preferences.set(
      'markdown',
      JSON.parse(JSON.stringify(markdownSettings)),
    )
  },
  { deep: true },
)

export function useEditor() {
  return {
    cursorPosition,
    markdownSettings,
    settings,
  }
}
