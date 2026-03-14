<script setup lang="ts">
import { KitSkeleton } from '~/components/01.kit/kit-skeleton'
</script>

<template>
  <div class="notes-skeleton">
    <div class="notes-layout">
      <aside class="notes-sidebar">
        <div class="sidebar-header">
          <KitSkeleton width="80px" height="20px" border-radius="4px" />
          <div class="sidebar-actions">
            <KitSkeleton v-for="i in 3" :key="i" width="24px" height="24px" border-radius="4px" />
          </div>
        </div>
        <div class="tree-wrapper">
          <div v-for="i in 6" :key="i" class="tree-item">
            <KitSkeleton width="18px" height="18px" border-radius="4px" />
            <KitSkeleton :width="`${Math.random() * 40 + 40}%`" height="16px" border-radius="4px" />
          </div>
        </div>
      </aside>

      <main class="notes-editor">
        <div class="editor-header">
          <KitSkeleton width="24px" height="24px" border-radius="4px" />
          <KitSkeleton width="40%" height="24px" border-radius="6px" />
        </div>
        <div class="editor-body">
          <KitSkeleton width="100%" height="16px" border-radius="4px" />
          <KitSkeleton width="100%" height="16px" border-radius="4px" />
          <KitSkeleton width="90%" height="16px" border-radius="4px" />
          <KitSkeleton width="95%" height="16px" border-radius="4px" />
          <KitSkeleton width="60%" height="16px" border-radius="4px" style="margin-bottom: 24px;" />

          <KitSkeleton width="100%" height="16px" border-radius="4px" />
          <KitSkeleton width="85%" height="16px" border-radius="4px" />
          <KitSkeleton width="90%" height="16px" border-radius="4px" />
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped lang="scss">
.notes-skeleton {
  height: 70vh;
  min-height: calc(100vh - 150px);
  max-width: 1600px;
  width: 100%;
  display: flex;
  margin: 0 auto;
  flex-direction: column;
  padding: 10px;
  margin-top: 16px;

  .notes-layout {
    display: flex;
    height: 100%;
    width: 100%;
    overflow: hidden;
    border: 1px solid var(--border-secondary-color);
    border-radius: var(--r-m);
    background: var(--bg-primary-color);
  }
}

.notes-sidebar {
  width: 300px;
  min-width: 220px;
  flex-shrink: 0;
  border-right: 1px solid var(--border-secondary-color);
  background: var(--bg-secondary-color);
  display: flex;
  flex-direction: column;

  @include media-down(sm) {
    display: none;
  }
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 12px;
  border-bottom: 1px solid var(--border-secondary-color);
  gap: 8px;
}

.sidebar-actions {
  display: flex;
  gap: 4px;
}

.tree-wrapper {
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.tree-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.notes-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary-color);
}

.editor-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-secondary-color);
  background-color: var(--bg-secondary-color);
  height: 45px;
}

.editor-body {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
