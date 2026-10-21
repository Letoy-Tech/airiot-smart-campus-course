<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    tone?: string
    type?: string
    size?: 'sm' | 'md'
    round?: boolean
  }>(),
  {
    tone: undefined,
    type: 'info',
    size: 'md',
    round: false,
  },
)

const resolvedTone = computed(() => props.tone || props.type)
</script>

<template>
  <span class="status-tag" :class="[`status-tag--${resolvedTone}`, `status-tag--${size}`, { 'status-tag--round': round }]">
    <slot />
  </span>
</template>

<style scoped>
.status-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 26px;
  padding: 0 10px;
  border-radius: 8px; /* Changed from pill to slightly rounded for a more modern 'Office' feel */
  border: 1px solid transparent;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
  transition: all var(--transition-base);
}

.status-tag::before {
  content: '';
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 0 3px color-mix(in srgb, currentColor 20%, transparent);
}

.status-tag--sm {
  min-height: 22px;
  padding: 0 8px;
  font-size: 11px;
}

.status-tag--round {
  border-radius: var(--radius-pill);
}

/* Color Palette Logic */

.status-tag--primary {
  color: var(--primary-color);
  background: color-mix(in srgb, var(--primary-color) 8%, var(--bg-card));
  border-color: color-mix(in srgb, var(--primary-color) 12%, transparent);
}

.status-tag--success {
  color: var(--success-color);
  background: color-mix(in srgb, var(--success-color) 8%, var(--bg-card));
  border-color: color-mix(in srgb, var(--success-color) 12%, transparent);
}

.status-tag--warning {
  color: var(--warning-color);
  background: color-mix(in srgb, var(--warning-color) 8%, var(--bg-card));
  border-color: color-mix(in srgb, var(--warning-color) 12%, transparent);
}

.status-tag--error {
  color: var(--error-color);
  background: color-mix(in srgb, var(--error-color) 8%, var(--bg-card));
  border-color: color-mix(in srgb, var(--error-color) 12%, transparent);
}

.status-tag--info {
  color: var(--info-color);
  background: color-mix(in srgb, var(--info-color) 8%, var(--bg-card));
  border-color: color-mix(in srgb, var(--info-color) 12%, transparent);
}

.status-tag--pending {
  color: var(--text-secondary);
  background: var(--surface-inset);
  border-color: var(--border-strong);
}

.status-tag--processing {
  color: var(--primary-color);
  background: color-mix(in srgb, var(--primary-color) 5%, var(--bg-card));
  border-color: color-mix(in srgb, var(--primary-color) 10%, transparent);
}

.status-tag--shipping {
  color: var(--shipping-color);
  background: color-mix(in srgb, var(--shipping-color) 8%, var(--bg-card));
  border-color: color-mix(in srgb, var(--shipping-color) 12%, transparent);
}

.status-tag--pickup {
  color: var(--pickup-color);
  background: color-mix(in srgb, var(--pickup-color) 8%, var(--bg-card));
  border-color: color-mix(in srgb, var(--pickup-color) 12%, transparent);
}

.status-tag--service {
  color: var(--service-color);
  background: color-mix(in srgb, var(--service-color) 8%, var(--bg-card));
  border-color: color-mix(in srgb, var(--service-color) 12%, transparent);
}

.status-tag--done {
  color: var(--done-color);
  background: color-mix(in srgb, var(--done-color) 8%, var(--bg-card));
  border-color: color-mix(in srgb, var(--done-color) 12%, transparent);
}

.status-tag--refund {
  color: var(--refund-color);
  background: color-mix(in srgb, var(--refund-color) 8%, var(--bg-card));
  border-color: color-mix(in srgb, var(--refund-color) 12%, transparent);
}

.status-tag--closed,
.status-tag--neutral {
  color: var(--text-tertiary);
  background: var(--surface-inset);
  border-color: var(--border-base);
}
</style>
