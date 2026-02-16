# Window Focus Data Refresh — Design

## Problem

When external tools or API integrations modify data via the Elysia API (localhost:4321), the massCode UI shows stale data until restarted. The renderer fetches data once at startup and only re-fetches after explicit user actions (create, update, delete, navigate). There is no mechanism to detect external changes.

## Solution

Listen for `window` `focus` events in the root `App.vue` component. On focus, re-fetch all data (folders, snippets, tags) using existing composable functions. Debounce at 300ms to prevent rapid-fire refreshes.

## Architecture

- **Listener location:** `App.vue` — single listener, always mounted
- **Debounce:** 300ms via `useDebounceFn` from VueUse (already a dependency)
- **Selection preservation:** Existing functions preserve selection state — `getFolders()` calls `syncSelectedFoldersWithTree()`, `getSnippets()` doesn't reset `state.snippetId`
- **Search mode:** Refresh underlying data without disrupting active search results
- **No new dependencies**

## Data Flow

```
Window focus event
  → debounce 300ms
  → getFolders(false)     // false = skip auto-expand
  → getSnippets()         // uses current query context
  → getTags()             // simple re-fetch
```

## Edge Cases

- **During editing:** Editor local state is independent of the snippet array; refresh won't interrupt typing
- **Empty state:** If data was deleted externally, empty lists render correctly
- **New data:** Externally added snippets/folders appear after focus
- **Rapid focus/blur:** Debounce prevents unnecessary API calls

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Refresh trigger | Window focus | Covers 90% of use cases (alt-tab from external tool), zero server changes |
| Debounce interval | 300ms | Fast enough to feel instant, prevents duplicate calls |
| Scope | All data types | Snippets, folders, and tags all refresh — any can be modified externally |
| Polling | Not included | YAGNI — focus refresh solves the stated problem; polling can be added later if needed |
