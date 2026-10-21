<script setup lang="ts">
defineProps<{
  title: string
  description: string
  eyebrow?: string
}>()
</script>

<template>
  <header class="page-header">
    <div>
      <p class="page-header__eyebrow">{{ eyebrow || '智慧校园管理' }}</p>
      <h1 class="page-header__title">{{ title }}</h1>
      <p class="page-header__description">{{ description }}</p>
    </div>
    <div v-if="$slots.actions" class="page-header__actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}

.page-header__eyebrow {
  margin-bottom: 6px;
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.page-header__title {
  margin-bottom: 8px;
  color: var(--color-text-primary);
  font-size: 30px;
  font-weight: 800;
  line-height: 1.1;
}

.page-header__description {
  max-width: 720px;
  color: var(--color-text-secondary);
  font-size: 14px;
  line-height: 1.7;
}

.page-header__actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

@media (max-width: 960px) {
  .page-header {
    flex-direction: column;
  }
}

@media (max-width: 768px) {
  .page-header { margin-bottom: 16px; }
  /* 30px 标题在窄屏会占掉大半个首屏 */
  .page-header__title { font-size: 22px; margin-bottom: 6px; }
  .page-header__description { font-size: 13px; line-height: 1.6; }
  .page-header__actions { width: 100%; }
  .page-header__actions > * { flex: 1; }
}
</style>
