<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import { loadWASM } from 'onigasm'
import onigasmFile from 'onigasm/lib/onigasm.wasm?url'
import { Toaster } from 'vue-sonner'
import {
  useApp,
  useFolders,
  useSnippets,
  useTags,
  useTheme,
} from '@/composables'
import { i18n } from '@/electron'
import { loadGrammars } from './components/editor/grammars'
import { registerIPCListeners } from './ipc'
import { notifications } from './services/notifications'

const { isSponsored } = useApp()
useTheme()

const { getFolders } = useFolders()
const { getSnippets } = useSnippets()
const { getTags } = useTags()

const refreshOnFocus = useDebounceFn(async () => {
  await Promise.all([getFolders(false), getSnippets(), getTags()])
}, 300)

onMounted(() => {
  window.addEventListener('focus', refreshOnFocus)
})

onUnmounted(() => {
  window.removeEventListener('focus', refreshOnFocus)
})

async function init() {
  registerIPCListeners()
  loadWASM(onigasmFile)
  await loadGrammars()
  notifications()
}

init()
</script>

<template>
  <div
    data-title-bar
    class="absolute top-0 z-50 h-[var(--title-bar-height)] w-full select-none"
  />
  <div
    v-if="!isSponsored"
    class="text-text-muted absolute top-1 right-2 z-50 text-[11px] uppercase"
  >
    {{ i18n.t("messages:special.unsponsored") }}
  </div>
  <RouterView />
  <Toaster style="--width: 356px; --offset: 12px" />
</template>

<style>
[data-title-bar] {
  -webkit-app-region: drag;
}
</style>
