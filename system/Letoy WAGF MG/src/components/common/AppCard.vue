<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string
    eyebrow?: string
    hover?: boolean
    glass?: boolean
    tagColor?: string
    noPadding?: boolean
  }>(),
  {
    title: '',
    eyebrow: '',
    hover: true,
    glass: false,
    tagColor: '',
    noPadding: false,
  },
)
</script>

<template>
  <section class="app-card" :class="{ 'app-card--hover': hover, 'app-card--glass': glass }">
    <header v-if="title || eyebrow || $slots.header || $slots.extra" class="app-card__header">
      <div class="app-card__heading">
        <div v-if="tagColor" class="app-card__tag" :style="{ backgroundColor: tagColor }"></div>
        <div class="app-card__heading-text">
          <p v-if="eyebrow" class="app-card__eyebrow">{{ eyebrow }}</p>
          <slot name="header">
            <h3 v-if="title" class="app-card__title">{{ title }}</h3>
          </slot>
        </div>
      </div>
      <div v-if="$slots.extra" class="app-card__extra">
        <slot name="extra" />
      </div>
    </header>
    <div class="app-card__body" :style="{ padding: noPadding ? '0' : '' }">
      <slot />
    </div>
    <footer v-if="$slots.footer" class="app-card__footer">
      <slot name="footer" />
    </footer>
  </section>
</template>

<style scoped>
.app-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-strong);
  border-radius: 8px; /* 缩小圆角 */
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05); /* 更轻的阴影 */
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: all var(--transition-smooth);
}

.app-card--hover:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-float);
}

.app-card--glass {
  background: var(--surface-1);
  backdrop-filter: blur(10px);
}

.app-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 24px 24px 0;
}

.app-card__heading {
  display: flex;
  align-items: center;
  gap: 10px;
}

.app-card__tag {
  width: 4px;
  height: 16px;
  border-radius: 999px;
}

.app-card__eyebrow {
  margin-bottom: 2px;
  color: var(--color-text-tertiary);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.app-card__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-tertiary);
}

.app-card__body {
  padding: 24px;
  flex: 1;
}

.app-card__footer {
  padding: 16px 24px;
  background: var(--surface-inset);
  border-top: 1px solid var(--color-border-base);
}

/* 触屏上没有 hover，抬升动效只会在点击后残留 */
@media (hover: none) {
  .app-card--hover:hover { transform: none; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05); }
}

@media (max-width: 768px) {
  /* 24px 内边距在 375px 宽度上会吃掉 13% 的横向空间 */
  .app-card__header { padding: 16px 16px 0; gap: 12px; }
  .app-card__body { padding: 16px; }
  .app-card__footer { padding: 12px 16px; }
}
</style>
