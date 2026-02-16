<script setup lang="ts">
import { useApp, useSnippets } from '@/composables'
import { i18n, ipc } from '@/electron'
import * as DropdownMenu from '@/components/ui/shadcn/dropdown-menu'
import { ArrowUpDown, Plus, Search, X } from 'lucide-vue-next'

const {
  isSearch,
  searchQuery,
  createSnippetAndSelect,
  clearSearch,
  search,
  searchSelectedIndex,
  selectSearchSnippet,
  displayedSnippets,
  getSnippets,
  selectFirstSnippet,
} = useSnippets()
const { isFocusedSearch, state } = useApp()

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

ipc.on('main-menu:find', () => {
  isFocusedSearch.value = true
})

watch(searchQuery, (v) => {
  if (v) {
    search()
  }
  else {
    clearSearch(true)
  }
})

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    const nextIndex = Math.min(
      searchSelectedIndex.value + 1,
      (displayedSnippets.value?.length || 0) - 1,
    )
    selectSearchSnippet(nextIndex)
  }
  else if (event.key === 'ArrowUp') {
    event.preventDefault()
    const prevIndex = Math.max(searchSelectedIndex.value - 1, 0)
    selectSearchSnippet(prevIndex)
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    clearSearch(true)
  }
}
</script>

<template>
  <div class="border-border mt-[var(--title-bar-height)] mb-2 border-b">
    <div class="flex items-center">
      <Search class="text-text-muted ml-1 h-4 w-4" />
      <div class="flex-grow">
        <UiInput
          v-model="searchQuery"
          :placeholder="i18n.t('placeholder.search')"
          variant="ghost"
          :focus="isFocusedSearch"
          @blur="isFocusedSearch = false"
          @keydown="onKeydown"
        />
      </div>
      <UiButton
        v-if="searchQuery"
        variant="icon"
        size="icon"
        @click="clearSearch(true)"
      >
        <X class="h-4 w-4" />
      </UiButton>
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
      <UiActionButton
        v-if="!isSearch"
        :tooltip="i18n.t('action.new.snippet')"
        @click="createSnippetAndSelect"
      >
        <Plus class="h-4 w-4" />
      </UiActionButton>
    </div>
  </div>
</template>
