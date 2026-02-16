# Window Focus Data Refresh — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Re-fetch all data (folders, snippets, tags) when the app window regains focus, so external API changes are reflected without restart.

**Architecture:** A single `window` `focus` listener in `App.vue` calls existing composable fetch functions with a 300ms debounce. No server changes, no new dependencies.

**Tech Stack:** Vue 3 Composition API, VueUse (`useDebounceFn`), existing composables (`useSnippets`, `useFolders`, `useTags`)

---

### Task 1: Add focus refresh logic to App.vue

**Files:**
- Modify: `src/renderer/App.vue`

**Context:**

`App.vue` is the root component, always mounted. It currently imports `useApp` and `useTheme`, runs an `init()` function, and renders the router view. We'll add a focus listener here that calls the existing data fetch functions.

Key composable functions to call:
- `getFolders(false)` from `useFolders()` — `false` skips auto-expanding folders, preserving the current tree state
- `getSnippets()` from `useSnippets()` — parameterless call uses `queryByLibraryOrFolderOrSearch.value` which includes current folder/filter/sort context
- `getTags()` from `useTags()` — simple re-fetch, no parameters

VueUse's `useDebounceFn` is already used in the codebase (see `useSnippetUpdate.ts`). Import pattern: `import { useDebounceFn } from '@vueuse/core'`.

Vue auto-imports (`onMounted`, `onUnmounted`) are globally available — do NOT import them.

**Step 1: Add imports and composable destructuring**

In `App.vue`, add to the existing imports:

```typescript
import { useDebounceFn } from '@vueuse/core'
```

Add to the existing composable destructuring (after `useTheme()`):

```typescript
const { getFolders } = useFolders()
const { getSnippets } = useSnippets()
const { getTags } = useTags()
```

Update the import line to include the new composables:

```typescript
import { useApp, useFolders, useSnippets, useTags, useTheme } from '@/composables'
```

**Step 2: Add the debounced refresh function and lifecycle listeners**

After the composable destructuring, add:

```typescript
const refreshOnFocus = useDebounceFn(async () => {
  await Promise.all([
    getFolders(false),
    getSnippets(),
    getTags(),
  ])
}, 300)

onMounted(() => {
  window.addEventListener('focus', refreshOnFocus)
})

onUnmounted(() => {
  window.removeEventListener('focus', refreshOnFocus)
})
```

**Step 3: Verify the complete script section**

The full `<script setup>` section should now look like:

```typescript
<script setup lang="ts">
import { useApp, useFolders, useSnippets, useTags, useTheme } from '@/composables'
import { i18n } from '@/electron'
import { useDebounceFn } from '@vueuse/core'
import { loadWASM } from 'onigasm'
import onigasmFile from 'onigasm/lib/onigasm.wasm?url'
import { Toaster } from 'vue-sonner'
import { loadGrammars } from './components/editor/grammars'
import { registerIPCListeners } from './ipc'
import { notifications } from './services/notifications'

const { isSponsored } = useApp()
useTheme()

const { getFolders } = useFolders()
const { getSnippets } = useSnippets()
const { getTags } = useTags()

const refreshOnFocus = useDebounceFn(async () => {
  await Promise.all([
    getFolders(false),
    getSnippets(),
    getTags(),
  ])
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
```

The `<template>` and `<style>` sections remain unchanged.

**Step 4: Verify**

1. Start the app: `npm run dev`
2. Create a snippet via the UI
3. Using a terminal, create a snippet via the API: `curl -X POST http://localhost:4321/snippets -H 'Content-Type: application/json' -d '{"name":"API Test Snippet"}'`
4. Alt-tab back to the massCode window — the new snippet should appear in the list
5. Test with folders: `curl -X POST http://localhost:4321/folders -H 'Content-Type: application/json' -d '{"name":"API Test Folder"}'`
6. Alt-tab back — the new folder should appear in the sidebar

**Step 5: Commit**

```bash
git add src/renderer/App.vue
git commit -m "feat: refresh data on window focus for external API changes"
```

---

### Task 2: Manual integration testing

**Step 1: Test snippet refresh**

1. Create 2-3 snippets in the app
2. In terminal: `curl -X POST http://localhost:4321/snippets -H 'Content-Type: application/json' -d '{"name":"External Snippet"}'`
3. Alt-tab to massCode — new snippet should appear
4. In terminal, update a snippet: `curl -X PATCH http://localhost:4321/snippets/<id> -H 'Content-Type: application/json' -d '{"name":"Renamed Externally"}'`
5. Alt-tab — name should update

**Step 2: Test folder refresh**

1. In terminal: `curl -X POST http://localhost:4321/folders -H 'Content-Type: application/json' -d '{"name":"External Folder"}'`
2. Alt-tab — folder appears in sidebar
3. Delete folder via API
4. Alt-tab — folder disappears

**Step 3: Test tag refresh**

1. In terminal: `curl -X POST http://localhost:4321/tags -H 'Content-Type: application/json' -d '{"name":"external-tag"}'`
2. Alt-tab — tag appears in sidebar tag list

**Step 4: Test selection preservation**

1. Select a specific folder and snippet
2. Alt-tab away and back
3. Same folder and snippet should remain selected
4. Content editor should still show the same content

**Step 5: Test debounce**

1. Rapidly alt-tab between massCode and another window (5+ times in 2 seconds)
2. Check network tab or console — should see only 1 set of API calls, not 5+

**Step 6: Test during search**

1. Type a search query in the snippet search bar
2. Alt-tab away and back
3. Search results should still be displayed, search query preserved
