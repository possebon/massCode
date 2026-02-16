# Folder & Snippet Sorting — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add user-selectable sort options for folders (manual / name A-Z / name Z-A) and snippets (name / created date / updated date, each ASC or DESC).

**Architecture:** Hybrid approach — server-side sorting for snippets (extend existing unused `sort`/`order` API params), client-side sorting for folders (recursive JS sort on fetched tree). Sort preferences stored globally in electron-store via existing `SavedState` mechanism.

**Tech Stack:** Vue 3 composables, Elysia API, Radix Vue DropdownMenu, better-sqlite3, electron-store, i18next.

---

### Task 1: Add i18n sort strings

**Files:**
- Modify: `src/main/i18n/locales/en_US/ui.json`

**Step 1: Add sort strings to en_US locale**

Add the `sort` object inside `ui.json`:

```json
"sort": {
  "label": "Sort",
  "manual": "Manual",
  "nameAsc": "Name A-Z",
  "nameDesc": "Name Z-A",
  "createdDesc": "Date created (newest)",
  "createdAsc": "Date created (oldest)",
  "updatedDesc": "Date updated (newest)",
  "updatedAsc": "Date updated (oldest)"
}
```

Add this as a top-level key alongside the existing `sidebar`, `folder`, `snippet`, etc. keys.

**Step 2: Commit**

```bash
git add src/main/i18n/locales/en_US/ui.json
git commit -m "feat(i18n): add sort option labels"
```

---

### Task 2: Add sort fields to state types and electron-store

**Files:**
- Modify: `src/renderer/composables/types/index.ts`
- Modify: `src/main/store/types/index.ts`

**Step 1: Add sort fields to `SavedState`**

In `src/renderer/composables/types/index.ts`, add to the `SavedState` interface:

```typescript
snippetSortBy?: 'createdAt' | 'updatedAt' | 'name'
snippetSortOrder?: 'ASC' | 'DESC'
folderSortBy?: 'manual' | 'name'
folderSortOrder?: 'ASC' | 'DESC'
```

**Step 2: Add sort fields to `AppStore.state`**

In `src/main/store/types/index.ts`, add to the `state` object inside `AppStore`:

```typescript
state: {
  snippetId?: number
  snippetContentIndex?: number
  folderId?: number
  tagId?: number
  libraryFilter?: string
  isSidebarHidden?: boolean
  snippetSortBy?: string
  snippetSortOrder?: string
  folderSortBy?: string
  folderSortOrder?: string
}
```

This ensures electron-store types match. The existing `watch(state, ...)` in `useApp.ts` already persists all state changes automatically — no additional wiring needed.

**Step 3: Commit**

```bash
git add src/renderer/composables/types/index.ts src/main/store/types/index.ts
git commit -m "feat(state): add sort preference fields to SavedState and AppStore"
```

---

### Task 3: Wire up server-side snippet sorting in the API

**Files:**
- Modify: `src/main/api/routes/snippets.ts`

**Step 1: Add sort field whitelist and dynamic ORDER BY**

In the `GET /snippets` handler (around line 14-130), change the sorting logic:

Replace this line (currently line 129):
```typescript
ORDER BY createdAt ${ORDER}
```

With a dynamic sort field. Before the SQL query, add a whitelist:

```typescript
const SORT_WHITELIST = ['name', 'createdAt', 'updatedAt'] as const
const sortField = SORT_WHITELIST.includes(query.sort as any) ? query.sort : 'createdAt'
```

Then change the ORDER BY to:
```typescript
ORDER BY ${sortField} ${ORDER}
```

**Important:** The `sort` param already exists in `commonQuery` DTO (`src/main/api/dto/common/query.ts`) but is currently ignored. We're just wiring it up — no DTO changes needed.

**Step 2: Verify by testing the API**

Start the dev server and test with curl:
```bash
curl "http://localhost:4321/snippets?sort=name&order=ASC"
curl "http://localhost:4321/snippets?sort=updatedAt&order=DESC"
curl "http://localhost:4321/snippets?sort=createdAt&order=DESC"  # default behavior
curl "http://localhost:4321/snippets?sort=MALICIOUS&order=DESC"  # should fall back to createdAt
```

**Step 3: Commit**

```bash
git add src/main/api/routes/snippets.ts
git commit -m "feat(api): wire up sort field param for snippets endpoint"
```

---

### Task 4: Pass sort params from renderer to API

**Files:**
- Modify: `src/renderer/composables/useSnippets.ts`

**Step 1: Add sort params to the query builder**

In `useSnippets.ts`, import `useApp` is already done (line 13). The `state` object already contains `snippetSortBy` and `snippetSortOrder` from Task 2.

Modify the `queryByLibraryOrFolderOrSearch` computed (around line 55-85) to always include sort params:

```typescript
const queryByLibraryOrFolderOrSearch = computed(() => {
  const query: SnippetsQuery = {}

  // Sort params — always included
  if (state.snippetSortBy) {
    query.sort = state.snippetSortBy
  }
  if (state.snippetSortOrder) {
    query.order = state.snippetSortOrder
  }

  // ... rest of existing filter logic unchanged ...
})
```

Add `sort` and `order` before the existing if-chain (search, tagId, folderId, libraryFilter). The existing filter logic stays exactly as-is.

**Step 2: Verify**

Changing `state.snippetSortBy` in Vue devtools should trigger a re-fetch with the new sort param. The snippets list should reorder.

**Step 3: Commit**

```bash
git add src/renderer/composables/useSnippets.ts
git commit -m "feat(snippets): pass sort preferences to API query"
```

---

### Task 5: Add client-side folder tree sorting

**Files:**
- Modify: `src/renderer/composables/useFolders.ts`

**Step 1: Import useApp and add the sort function**

`useApp` is already imported (line 5). Add a `sortFolderTree` function after the existing `flattenFolderTree` function (around line 36):

```typescript
function sortFolderTree(
  nodes: FoldersTreeResponse,
  sortBy: string,
  order: string,
): FoldersTreeResponse {
  if (sortBy === 'manual') return nodes

  const sorted = [...nodes].sort((a, b) => {
    const cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    return order === 'DESC' ? -cmp : cmp
  })

  return sorted.map(node => ({
    ...node,
    children: node.children?.length
      ? sortFolderTree(node.children as FoldersTreeResponse, sortBy, order)
      : node.children,
  }))
}
```

**Step 2: Apply sorting in `getFolders()`**

In the `getFolders` function (around line 269), after `folders.value = data`, apply the sort:

```typescript
async function getFolders(shouldEnsureVisibility = true) {
  try {
    const { data } = await api.folders.getFoldersTree()
    folders.value = sortFolderTree(
      data,
      state.folderSortBy || 'manual',
      state.folderSortOrder || 'ASC',
    )
    syncSelectedFoldersWithTree()
    // ... rest unchanged
  }
}
```

**Step 3: Expose `folderSortBy` for use by Tree.vue (drag disable)**

Add to the returned object from `useFolders()`:

```typescript
export function useFolders() {
  return {
    // ... existing exports ...
    folderSortBy: computed(() => state.folderSortBy || 'manual'),
  }
}
```

**Step 4: Commit**

```bash
git add src/renderer/composables/useFolders.ts
git commit -m "feat(folders): add client-side tree sorting by name"
```

---

### Task 6: Create DropdownMenu shadcn wrapper components

**Files:**
- Create: `src/renderer/components/ui/shadcn/dropdown-menu/index.ts`
- Create: `src/renderer/components/ui/shadcn/dropdown-menu/DropdownMenu.vue`
- Create: `src/renderer/components/ui/shadcn/dropdown-menu/DropdownMenuTrigger.vue`
- Create: `src/renderer/components/ui/shadcn/dropdown-menu/DropdownMenuContent.vue`
- Create: `src/renderer/components/ui/shadcn/dropdown-menu/DropdownMenuRadioGroup.vue`
- Create: `src/renderer/components/ui/shadcn/dropdown-menu/DropdownMenuRadioItem.vue`
- Create: `src/renderer/components/ui/shadcn/dropdown-menu/DropdownMenuLabel.vue`
- Create: `src/renderer/components/ui/shadcn/dropdown-menu/DropdownMenuSeparator.vue`

These follow the exact same pattern as the existing `context-menu` wrappers, swapping `ContextMenu*` for `DropdownMenu*` from radix-vue. Same CSS classes.

**index.ts:**
```typescript
export { default as Root } from './DropdownMenu.vue'
export { default as Trigger } from './DropdownMenuTrigger.vue'
export { default as Content } from './DropdownMenuContent.vue'
export { default as RadioGroup } from './DropdownMenuRadioGroup.vue'
export { default as RadioItem } from './DropdownMenuRadioItem.vue'
export { default as Label } from './DropdownMenuLabel.vue'
export { default as Separator } from './DropdownMenuSeparator.vue'
```

**DropdownMenu.vue:** Pass-through to `DropdownMenuRoot` from radix-vue.

**DropdownMenuTrigger.vue:** Pass-through to `DropdownMenuTrigger` from radix-vue.

**DropdownMenuContent.vue:** Same styles as `ContextMenuContent.vue` — wraps in `DropdownMenuPortal` + `DropdownMenuContent` with the same border/bg/shadow/animation classes.

**DropdownMenuRadioGroup.vue:** Pass-through to `DropdownMenuRadioGroup` from radix-vue.

**DropdownMenuRadioItem.vue:** Same styles as `ContextMenuCheckboxItem.vue` — uses `DropdownMenuItemIndicator` for the check icon, `pl-8` padding for indicator space.

**DropdownMenuLabel.vue:** Styled label: `px-2 py-1.5 text-sm font-semibold`.

**DropdownMenuSeparator.vue:** Same as `ContextMenuSeparator` — `bg-border -mx-1 my-1 h-px`.

**Step: Commit**

```bash
git add src/renderer/components/ui/shadcn/dropdown-menu/
git commit -m "feat(ui): add DropdownMenu shadcn wrapper components"
```

---

### Task 7: Add sort dropdown to snippet list header

**Files:**
- Modify: `src/renderer/components/snippet/Header.vue`

**Step 1: Import dependencies**

Add imports for DropdownMenu, ArrowUpDown icon, and useApp:

```typescript
import * as DropdownMenu from '@/components/ui/shadcn/dropdown-menu'
import { ArrowUpDown } from 'lucide-vue-next'

// useApp is needed for state.snippetSortBy / state.snippetSortOrder
```

Also import `getSnippets` from `useSnippets`.

**Step 2: Add sort state and handler**

```typescript
const { state } = useApp()

const snippetSortValue = computed(() => {
  const by = state.snippetSortBy || 'createdAt'
  const order = state.snippetSortOrder || 'DESC'
  return `${by}:${order}`
})

async function onSnippetSortChange(value: string) {
  const [sortBy, sortOrder] = value.split(':')
  state.snippetSortBy = sortBy as any
  state.snippetSortOrder = sortOrder as any
  await getSnippets()
  selectFirstSnippet()
}
```

**Step 3: Add dropdown to template**

Place the dropdown button between the search clear button and the "+" button, inside the `<div class="flex items-center">`:

```html
<DropdownMenu.Root>
  <DropdownMenu.Trigger as-child>
    <UiActionButton
      v-if="!isSearch"
      :tooltip="i18n.t('sort.label')"
    >
      <ArrowUpDown class="h-3.5 w-3.5" />
    </UiActionButton>
  </DropdownMenu.Trigger>
  <DropdownMenu.Content align="start">
    <DropdownMenu.RadioGroup
      :model-value="snippetSortValue"
      @update:model-value="onSnippetSortChange"
    >
      <DropdownMenu.RadioItem value="createdAt:DESC">
        {{ i18n.t('sort.createdDesc') }}
      </DropdownMenu.RadioItem>
      <DropdownMenu.RadioItem value="createdAt:ASC">
        {{ i18n.t('sort.createdAsc') }}
      </DropdownMenu.RadioItem>
      <DropdownMenu.RadioItem value="updatedAt:DESC">
        {{ i18n.t('sort.updatedDesc') }}
      </DropdownMenu.RadioItem>
      <DropdownMenu.RadioItem value="updatedAt:ASC">
        {{ i18n.t('sort.updatedAsc') }}
      </DropdownMenu.RadioItem>
      <DropdownMenu.Separator />
      <DropdownMenu.RadioItem value="name:ASC">
        {{ i18n.t('sort.nameAsc') }}
      </DropdownMenu.RadioItem>
      <DropdownMenu.RadioItem value="name:DESC">
        {{ i18n.t('sort.nameDesc') }}
      </DropdownMenu.RadioItem>
    </DropdownMenu.RadioGroup>
  </DropdownMenu.Content>
</DropdownMenu.Root>
```

**Step 4: Verify**

Run the app. Click the sort icon in the snippet list header. Select different sort options. Snippets should reorder. Close and reopen the app — sort preference should persist.

**Step 5: Commit**

```bash
git add src/renderer/components/snippet/Header.vue
git commit -m "feat(snippets): add sort dropdown to snippet list header"
```

---

### Task 8: Add sort dropdown to folder header

**Files:**
- Modify: `src/renderer/components/sidebar/library/Library.vue`

**Step 1: Import dependencies**

```typescript
import * as DropdownMenu from '@/components/ui/shadcn/dropdown-menu'
import { ArrowUpDown } from 'lucide-vue-next'
```

**Step 2: Add sort state and handler**

```typescript
const folderSortValue = computed(() => {
  const by = state.folderSortBy || 'manual'
  const order = state.folderSortOrder || 'ASC'
  return `${by}:${order}`
})

async function onFolderSortChange(value: string) {
  const [sortBy, sortOrder] = value.split(':')
  state.folderSortBy = sortBy as any
  state.folderSortOrder = sortOrder as any
  await getFolders()
}
```

**Step 3: Add dropdown to the "FOLDERS" header row**

Find the div with "FOLDERS" label and "+" button (around line 216-225). Add the sort dropdown next to the "+" button:

```html
<div class="mt-1 flex items-center justify-between py-1 pl-1 select-none">
  <div class="text-[10px] font-bold uppercase">
    {{ i18n.t("sidebar.folders") }}
  </div>
  <div class="flex items-center">
    <DropdownMenu.Root>
      <DropdownMenu.Trigger as-child>
        <UiActionButton :tooltip="i18n.t('sort.label')">
          <ArrowUpDown class="h-3.5 w-3.5" />
        </UiActionButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start">
        <DropdownMenu.RadioGroup
          :model-value="folderSortValue"
          @update:model-value="onFolderSortChange"
        >
          <DropdownMenu.RadioItem value="manual:ASC">
            {{ i18n.t('sort.manual') }}
          </DropdownMenu.RadioItem>
          <DropdownMenu.Separator />
          <DropdownMenu.RadioItem value="name:ASC">
            {{ i18n.t('sort.nameAsc') }}
          </DropdownMenu.RadioItem>
          <DropdownMenu.RadioItem value="name:DESC">
            {{ i18n.t('sort.nameDesc') }}
          </DropdownMenu.RadioItem>
        </DropdownMenu.RadioGroup>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
    <UiActionButton
      :tooltip="i18n.t('action.new.folder')"
      @click="createFolderAndSelect()"
    >
      <Plus class="h-4 w-4" />
    </UiActionButton>
  </div>
</div>
```

**Step 4: Verify**

Run the app. Click sort icon in folders header. Select "Name A-Z" — folders should reorder alphabetically. Select "Manual" — back to drag-drop order.

**Step 5: Commit**

```bash
git add src/renderer/components/sidebar/library/Library.vue
git commit -m "feat(folders): add sort dropdown to folder header"
```

---

### Task 9: Disable drag-and-drop when folder sort is not manual

**Files:**
- Modify: `src/renderer/components/sidebar/folders/Tree.vue`
- Modify: `src/renderer/components/sidebar/folders/TreeNode.vue`

**Step 1: Check TreeNode for drag logic**

Read `src/renderer/components/sidebar/folders/TreeNode.vue` to find how drag is implemented. It likely uses `interactjs` or native drag events. The drag behavior should be conditionally disabled based on `folderSortBy`.

**Step 2: Pass a `draggable` prop from Tree.vue**

In `Tree.vue`, get `folderSortBy` from `useFolders()`:

```typescript
const { folderSortBy } = useFolders()
const isDraggable = computed(() => folderSortBy.value === 'manual')
```

Provide `isDraggable` via the existing `provide(treeKeys, ...)` or pass as prop to `TreeNode`.

**Step 3: In TreeNode, conditionally disable drag**

When `isDraggable` is false, skip drag initialization or disable the interact.js draggable. This prevents confusing behavior where a user drags but the sort immediately overrides the new position.

**Step 4: Verify**

Set folder sort to "Name A-Z". Try dragging a folder — it should not move. Set back to "Manual" — dragging works again.

**Step 5: Commit**

```bash
git add src/renderer/components/sidebar/folders/Tree.vue src/renderer/components/sidebar/folders/TreeNode.vue
git commit -m "feat(folders): disable drag-and-drop when sort is not manual"
```

---

### Task 10: Re-sort on sort preference change (watchers)

**Files:**
- Modify: `src/renderer/composables/useSnippets.ts`
- Modify: `src/renderer/composables/useFolders.ts`

**Step 1: Add watcher for snippet sort changes**

In `useSnippets.ts`, add a watcher that re-fetches when sort preferences change:

```typescript
watch(
  () => [state.snippetSortBy, state.snippetSortOrder],
  async () => {
    await getSnippets()
    selectFirstSnippet()
  },
)
```

This ensures that when the sort dropdown changes the state, snippets immediately re-fetch. This watcher may overlap with the explicit `getSnippets()` call in the dropdown handler — that's fine, the watcher ensures any programmatic state changes also trigger a refresh.

**Step 2: Add watcher for folder sort changes**

In `useFolders.ts`, add a watcher that re-sorts when preferences change:

```typescript
watch(
  () => [state.folderSortBy, state.folderSortOrder],
  async () => {
    await getFolders(false)
  },
)
```

**Step 3: Evaluate whether to remove duplicate calls**

If the watchers work well, the explicit `getSnippets()`/`getFolders()` calls in the dropdown handlers (Task 7/8) can be removed since the watchers handle it. Test both approaches and keep whichever is cleaner.

**Step 4: Commit**

```bash
git add src/renderer/composables/useSnippets.ts src/renderer/composables/useFolders.ts
git commit -m "feat(sort): add watchers to re-sort on preference change"
```

---

### Task 11: Regenerate API client types

**Files:**
- Modify: `src/renderer/services/api/generated/index.ts` (auto-generated)

**Step 1: Run API type generation**

The `sort` field already exists in the generated types (from `commonQuery`), but regenerating ensures the client types match if anything changed.

```bash
npm run dev  # start the API server first
npm run api:generate
```

**Step 2: Verify types**

Check that `SnippetsQuery` in the generated client includes `sort?: string` and `order?: string`.

**Step 3: Commit if changed**

```bash
git add src/renderer/services/api/generated/index.ts
git commit -m "chore: regenerate API client types"
```

---

### Task 12: Final integration test

**Step 1: Clean restart test**

1. Close the app completely
2. Delete electron-store data for a clean state (optional, just verify defaults work)
3. Start the app — snippets should sort by "Date created (newest)" by default, folders by "Manual"

**Step 2: Snippet sort test**

1. Create 3+ snippets with different names and dates
2. Try each sort option — verify order changes correctly
3. Close and reopen — verify sort preference persists

**Step 3: Folder sort test**

1. Create 3+ folders with different names
2. Try "Manual", "Name A-Z", "Name Z-A"
3. In "Name A-Z" mode, verify drag-and-drop is disabled
4. Switch back to "Manual" — verify drag works again
5. Nested folders should also sort within their parent

**Step 4: Edge cases**

- Sort while search is active (snippets)
- Sort with no snippets/folders
- Sort with special characters in names (unicode)

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: add folder and snippet sorting options"
```
