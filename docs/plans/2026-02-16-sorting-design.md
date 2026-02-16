# Folder & Snippet Sorting

## Summary

Add user-selectable sort options for folders and snippets. Folders support manual (drag-and-drop) and alphabetical sorting. Snippets support sorting by name, creation date, and last updated date.

## Requirements

- **Snippets**: Sort by name (A-Z/Z-A), created date (newest/oldest), updated date (newest/oldest)
- **Folders**: Sort by manual order (current drag-and-drop) or name (A-Z/Z-A)
- **UI**: Dropdown menus in the "Folders" header and snippet list header
- **Persistence**: Global sort preferences saved to electron-store, restored on restart
- **Approach**: Hybrid — server-side sorting for snippets (extend existing API params), client-side sorting for folders (recursive JS sort on fetched tree)

## Design

### 1. Data Model & Persistence

No database schema changes. Sort preferences added to `SavedState` in `composables/types/index.ts`:

```typescript
snippetSortBy?: 'createdAt' | 'updatedAt' | 'name'   // default: 'createdAt'
snippetSortOrder?: 'ASC' | 'DESC'                      // default: 'DESC'
folderSortBy?: 'manual' | 'name'                        // default: 'manual'
folderSortOrder?: 'ASC' | 'DESC'                        // default: 'ASC'
```

Stored via the existing `electron-store` watcher in `useApp.ts`.

### 2. Snippet Sorting (Server-side)

The `sort` param in `commonQuery` already exists but is unused. Wire it up:

- **API route** (`src/main/api/routes/snippets.ts`): Change hardcoded `ORDER BY createdAt ${ORDER}` to dynamic `ORDER BY ${sortField} ${ORDER}`. Whitelist `sort` to `name`, `createdAt`, `updatedAt` only (prevent injection).
- **Renderer** (`useSnippets.ts`): `queryByLibraryOrFolderOrSearch` computed adds `sort` and `order` from persisted state. Every `getSnippets()` call picks up current sort preferences automatically.

### 3. Folder Sorting (Client-side)

In `useFolders.ts`, after fetching the tree, apply recursive sort if `folderSortBy !== 'manual'`:

```typescript
function sortFolderTree(nodes, sortBy, order) {
  const sorted = [...nodes].sort(/* by name or keep orderIndex */)
  sorted.forEach(node => {
    if (node.children?.length) {
      node.children = sortFolderTree(node.children, sortBy, order)
    }
  })
  return sorted
}
```

When sort is `manual`, tree is used as-is (current behavior). When sort is `name`, drag-and-drop reordering is disabled (conflicting behaviors).

### 4. UI Components

Sort dropdown using Radix Vue `DropdownMenu`:

- **Folder header** (`Library.vue`, "FOLDERS" row): Sort icon button next to "+" button. Options: Manual (default), Name A-Z, Name Z-A.
- **Snippet list header** (`Header.vue`): Sort icon button next to "+" button. Options: Date Created (newest), Date Created (oldest), Date Updated (newest), Date Updated (oldest), Name A-Z, Name Z-A.

Icon: `ArrowUpDown` from lucide-vue-next. Active option shows checkmark.

### 5. i18n

Add to `ui.json` (English, other locales later):

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

## Files Affected

- `src/renderer/composables/types/index.ts` — add sort fields to SavedState
- `src/renderer/composables/useApp.ts` — expose sort state
- `src/renderer/composables/useSnippets.ts` — pass sort params to API
- `src/renderer/composables/useFolders.ts` — client-side tree sorting
- `src/main/api/routes/snippets.ts` — dynamic ORDER BY
- `src/renderer/components/snippet/Header.vue` — sort dropdown UI
- `src/renderer/components/sidebar/library/Library.vue` — sort dropdown UI
- `src/main/i18n/locales/en_US/ui.json` — sort strings
- `src/renderer/components/sidebar/folders/Tree.vue` — disable drag when sort != manual
