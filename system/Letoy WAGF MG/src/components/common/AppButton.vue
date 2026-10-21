<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost' | 'text' | 'danger' | 'success' | 'warning' | 'info' | 'refund' | 'neutral' | 'shipping' | 'pickup' | 'service' | 'done' | 'closed' | 'pending' | 'processing'
    type?: 'primary' | 'secondary' | 'ghost' | 'text' | 'danger' | 'success' | 'warning' | 'info' | 'refund' | 'neutral' | 'shipping' | 'pickup' | 'service' | 'done' | 'closed' | 'pending' | 'processing'
    size?: 'sm' | 'md'
    block?: boolean
    disabled?: boolean
    loading?: boolean
    nativeType?: 'button' | 'submit' | 'reset'
  }>(),
  {
    variant: undefined,
    type: 'primary',
    size: 'md',
    block: false,
    disabled: false,
    loading: false,
    nativeType: 'button',
  },
)

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void
}>()

const resolvedVariant = computed(() => props.variant || props.type)
</script>

<template>
  <button
    class="app-button"
    :class="[
      `app-button--${resolvedVariant}`,
      `app-button--${size}`,
      { 'app-button--block': block, 'is-loading': loading }
    ]"
    :disabled="disabled || loading"
    :type="nativeType"
    @click="emit('click', $event)"
  >
    <span v-if="loading" class="app-button__spinner"></span>
    <slot v-else name="icon" />
    <slot />
  </button>
</template>

<style scoped>
.app-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 42px;
  padding: 0 20px;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--transition-base);
  user-select: none;
}

/* hover 抬升仅对鼠标生效；触屏上 :hover 会在点击后残留 */
@media (hover: hover) {
  .app-button:hover {
    transform: translateY(-1.5px);
    filter: brightness(1.05);
  }
}

@media (hover: none) {
  .app-button:active {
    filter: brightness(0.96);
  }
}

.app-button:active {
  transform: translateY(0);
}

.app-button--block {
  width: 100%;
}

.app-button--sm {
  min-height: 34px;
  padding: 0 14px;
  font-size: 13px;
  border-radius: var(--radius-sm);
}

/* Variants */

.app-button--primary {
  color: #ffffff;
  background: linear-gradient(135deg, var(--primary-color), var(--primary-hover));
  box-shadow: 0 8px 16px -6px color-mix(in srgb, var(--primary-color) 40%, transparent);
}

.app-button--secondary {
  color: var(--primary-color);
  background: var(--primary-light);
  border-color: color-mix(in srgb, var(--primary-color) 10%, transparent);
}

.app-button--secondary:hover {
  background: color-mix(in srgb, var(--primary-color) 12%, var(--bg-card));
  border-color: color-mix(in srgb, var(--primary-color) 20%, transparent);
}

.app-button--ghost {
  color: var(--text-main);
  background: transparent;
  border-color: var(--border-strong);
}

.app-button--ghost:hover {
  background: var(--bg-page);
  border-color: var(--text-tertiary);
}

.app-button--text {
  min-height: auto;
  padding: 6px 10px;
  color: var(--primary-color);
  background: transparent;
}

@media (max-width: 768px) {
  /* 触屏最小可点区域：文字按钮此前只有约 30px 高 */
  .app-button { min-height: var(--tap-target-lg); }
  .app-button--sm { min-height: var(--tap-target); }
  .app-button--text { min-height: var(--tap-target); padding: 6px 12px; }
}

.app-button--text:hover {
  background: var(--primary-light);
}

.app-button--success {
  color: #ffffff;
  background: linear-gradient(135deg, var(--success-color), color-mix(in srgb, var(--success-color) 85%, black));
  box-shadow: 0 8px 16px -6px color-mix(in srgb, var(--success-color) 40%, transparent);
}

.app-button--danger {
  color: #ffffff;
  background: linear-gradient(135deg, var(--error-color), color-mix(in srgb, var(--error-color) 85%, black));
  box-shadow: 0 8px 16px -6px color-mix(in srgb, var(--error-color) 40%, transparent);
}

.app-button--warning {
  color: #ffffff;
  background: linear-gradient(135deg, var(--warning-color), color-mix(in srgb, var(--warning-color) 85%, black));
  box-shadow: 0 8px 16px -6px color-mix(in srgb, var(--warning-color) 40%, transparent);
}

.app-button--info {
  color: #ffffff;
  background: linear-gradient(135deg, var(--info-color), color-mix(in srgb, var(--info-color) 85%, black));
  box-shadow: 0 8px 16px -6px color-mix(in srgb, var(--info-color) 40%, transparent);
}

/* Business Tones - Derived from new vars.css */

.app-button--shipping {
  color: #ffffff;
  background: linear-gradient(135deg, var(--shipping-color), color-mix(in srgb, var(--shipping-color) 85%, black));
  box-shadow: 0 8px 16px -6px color-mix(in srgb, var(--shipping-color) 40%, transparent);
}

.app-button--pickup {
  color: #ffffff;
  background: linear-gradient(135deg, var(--pickup-color), color-mix(in srgb, var(--pickup-color) 85%, black));
  box-shadow: 0 8px 16px -6px color-mix(in srgb, var(--pickup-color) 40%, transparent);
}

.app-button--service {
  color: #ffffff;
  background: linear-gradient(135deg, var(--service-color), color-mix(in srgb, var(--service-color) 85%, black));
  box-shadow: 0 8px 16px -6px color-mix(in srgb, var(--service-color) 40%, transparent);
}

.app-button--refund {
  color: #ffffff;
  background: linear-gradient(135deg, var(--refund-color), color-mix(in srgb, var(--refund-color) 85%, black));
  box-shadow: 0 8px 16px -6px color-mix(in srgb, var(--refund-color) 40%, transparent);
}

.app-button--done {
  color: #ffffff;
  background: linear-gradient(135deg, var(--done-color), color-mix(in srgb, var(--done-color) 85%, black));
  box-shadow: 0 8px 16px -6px color-mix(in srgb, var(--done-color) 40%, transparent);
}

.app-button--closed {
  color: var(--text-secondary);
  background: var(--surface-inset);
  border-color: var(--border-strong);
}

.app-button--neutral {
  color: var(--text-secondary);
  background: var(--surface-inset);
  border-color: var(--border-base);
}

.app-button--pending {
  color: #ffffff;
  background: linear-gradient(135deg, var(--text-tertiary), color-mix(in srgb, var(--text-tertiary) 85%, black));
  box-shadow: 0 8px 16px -6px color-mix(in srgb, var(--text-tertiary) 40%, transparent);
}

.app-button--processing {
  color: #ffffff;
  background: linear-gradient(135deg, color-mix(in srgb, var(--primary-color) 70%, white), var(--primary-color));
  box-shadow: 0 8px 16px -6px color-mix(in srgb, var(--primary-color) 30%, transparent);
}

.app-button__spinner {
  width: 16px;
  height: 16px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: app-button-spin 0.8s linear infinite;
}

.app-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  filter: grayscale(0.2);
}

@keyframes app-button-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
