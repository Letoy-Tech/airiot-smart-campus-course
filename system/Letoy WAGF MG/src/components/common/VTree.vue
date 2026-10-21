<template>
  <div class="v-tree">
    <div 
      v-for="node in data" 
      :key="node[nodeKey]" 
      class="v-tree-node"
    >
      <div 
        class="v-tree-node__content" 
        :class="{ 'is-selected': selectedKey === node[nodeKey] }"
        :style="{ paddingLeft: level * 20 + 12 + 'px' }"
        @click="handleNodeClick(node)"
      >
        <span 
          v-if="node.children && node.children.length > 0" 
          class="v-tree-node__expand-icon"
          :class="{ 'is-expanded': expandedKeys.has(node[nodeKey]) }"
          @click.stop="toggleExpand(node[nodeKey])"
        >
          <i class="ri-arrow-right-s-line"></i>
        </span>
        <span v-else class="v-tree-node__placeholder">
          <i class="ri-subtract-line"></i>
        </span>
        
        <i class="ri-folder-2-line node-type-icon"></i>
        <span class="v-tree-node__label">{{ node[labelKey] }}</span>
      </div>
      
      <transition name="tree-slide">
        <div v-if="node.children && node.children.length > 0 && expandedKeys.has(node[nodeKey])">
          <VTree
            :data="node.children"
            :node-key="nodeKey"
            :label-key="labelKey"
            :level="level + 1"
            :selected-key="selectedKey"
            :expanded-keys="expandedKeys"
            @node-click="$emit('node-click', $event)"
            @update:expanded-keys="$emit('update:expandedKeys', $event)"
          />
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps({
  data: { type: Array as any, default: () => [] },
  nodeKey: { type: String, default: 'id' },
  labelKey: { type: String, default: 'label' },
  level: { type: Number, default: 0 },
  selectedKey: [String, Number],
  expandedKeys: { type: Set, default: () => new Set() }
})

const emit = defineEmits(['node-click', 'update:expandedKeys'])

const handleNodeClick = (node: any) => {
  emit('node-click', node)
}

const toggleExpand = (key: any) => {
  const newSet = new Set(props.expandedKeys)
  if (newSet.has(key)) {
    newSet.delete(key)
  } else {
    newSet.add(key)
  }
  emit('update:expandedKeys', newSet)
}
</script>

<style scoped>
.v-tree {
  user-select: none;
}

.v-tree-node__content {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  margin-bottom: 2px;
  color: var(--text-secondary);
}

.v-tree-node__content:hover {
  background-color: var(--primary-light);
  color: var(--primary-color);
}

.v-tree-node__content.is-selected {
  background-color: var(--primary-light);
  color: var(--primary-color);
  font-weight: 700;
  box-shadow: inset 3px 0 0 0 var(--primary-color);
}

.v-tree-node__expand-icon {
  font-size: 16px;
  width: 20px;
  display: flex;
  justify-content: center;
  color: var(--text-tertiary);
  transition: transform 0.3s;
  margin-right: 4px;
}

.v-tree-node__expand-icon.is-expanded {
  transform: rotate(90deg);
}

.v-tree-node__placeholder {
  width: 20px;
  display: flex;
  justify-content: center;
  font-size: 12px;
  opacity: 0.3;
  margin-right: 4px;
}

.node-type-icon {
  margin-right: 8px;
  font-size: 16px;
  opacity: 0.7;
}

.v-tree-node__label {
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 768px) {
  /* 节点行与展开箭头都需要达到最小可点面积 */
  .v-tree-node__content { min-height: var(--tap-target); padding: 10px; }
  .v-tree-node__expand-icon { width: 28px; font-size: 20px; }
  .v-tree-node__placeholder { width: 28px; }
  .v-tree-node__label { font-size: 15px; }
}

/* Tree Slide Animation */
.tree-slide-enter-active, .tree-slide-leave-active {
  transition: all 0.3s ease;
  max-height: 1000px;
  overflow: hidden;
}
.tree-slide-enter-from, .tree-slide-leave-to {
  max-height: 0;
  opacity: 0;
}
</style>
