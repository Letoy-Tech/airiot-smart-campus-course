<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { EChartsCoreOption } from 'echarts/core'
import { bindSpace, createBuilding, createCampus, getLocations, getOverview } from '@/api/campus'
import { useResource } from '@/composables/useResource'
import { useCampusStore } from '@/store/campus'
import { alpha, vizTheme } from '@/utils/vizTheme'
import CampusChart from '@/components/campus/CampusChart.vue'
import ResourceState from '@/components/campus/ResourceState.vue'
import KpiCard from '@/components/viz/KpiCard.vue'
defineOptions({ name: 'CampusLocations' })
const campus = useCampusStore()
const overview = useResource(getOverview)
const maps = useResource(getLocations)
const campusName = ref(''); const buildingName = ref(''); const buildingCampusId = ref('')
const selectedSpaceId = ref(''); const bindingBuildingId = ref(''); const floor = ref('')
const saving = ref(false); const writeError = ref(''); const success = ref('')
const selectedSpace = computed(() => overview.data.value?.spaces.find(s => s.id === selectedSpaceId.value))
const bindingFor = (id: string) => maps.data.value?.bindings.find(item => item.spaceId === id)
const buildingFor = (id?: string) => maps.data.value?.buildings.find(item => item.id === id)
const campusFor = (id?: string) => maps.data.value?.campuses.find(item => item.id === id)
watch(selectedSpaceId, id => { const binding = bindingFor(id); bindingBuildingId.value = binding?.buildingId || ''; floor.value = binding?.floor || '' })
const save = async (action: () => Promise<unknown>, message: string) => {
  if (!campus.capabilities?.canAdmin || saving.value) return
  saving.value = true; writeError.value = ''; success.value = ''
  try { await action(); await maps.load(); if (maps.error.value) throw new Error(`已提交，映射回读失败：${maps.error.value}`); success.value = message }
  catch (e) { writeError.value = e instanceof Error ? e.message : '保存失败' }
  finally { saving.value = false }
}
const addCampus = () => { if (campusName.value.trim()) void save(async () => { await createCampus(campusName.value.trim()); campusName.value = '' }, '校园已保存并回读') }
const addBuilding = () => { if (buildingName.value.trim() && buildingCampusId.value) void save(async () => { await createBuilding(buildingCampusId.value, buildingName.value.trim()); buildingName.value = '' }, '楼栋已保存并回读') }
const saveBinding = () => { if (selectedSpaceId.value && bindingBuildingId.value) void save(() => bindSpace(selectedSpaceId.value, bindingBuildingId.value, floor.value.trim()), '空间映射已保存并回读') }
const refresh = () => { void overview.load(); void maps.load() }
const spaces = computed(() => overview.data.value?.spaces || [])
const mapped = computed(() => spaces.value.filter(space => buildingFor(bindingFor(space.id)?.buildingId)).length)
const treeOption = computed<EChartsCoreOption>(() => {
  const t = vizTheme.value
  const m = maps.data.value
  const leaf = (name: string, extra = '', unmapped = false) => ({ name: extra ? `${name}\n${extra}` : name, itemStyle: { color: unmapped ? t.unknown : t.category.environment, borderColor: unmapped ? t.unknown : t.categoryGlow.environment, borderWidth: 2, shadowBlur: 8, shadowColor: alpha(t.category.environment, 0.5) }, label: { color: unmapped ? t.subtext : t.text } })
  const campuses = (m?.campuses || []).map(c => ({
    name: c.name,
    itemStyle: { color: t.brand[2], borderColor: alpha(t.brand[2]!, 0.4), borderWidth: 4 },
    children: (m?.buildings || []).filter(b => b.campusId === c.id).map(b => ({
      name: b.name,
      itemStyle: { color: t.brand[1], borderColor: alpha(t.brand[1]!, 0.4), borderWidth: 3 },
      children: spaces.value.filter(s => bindingFor(s.id)?.buildingId === b.id).map(s => leaf(s.name, bindingFor(s.id)?.floor || '未设楼层')),
    })),
  }))
  const unmapped = spaces.value.filter(s => !buildingFor(bindingFor(s.id)?.buildingId)).map(s => leaf(s.name, '未映射', true))
  const children = [...campuses, ...(unmapped.length ? [{ name: '未映射空间', itemStyle: { color: t.unknown, borderColor: alpha(t.unknown, 0.4), borderWidth: 3 }, children: unmapped }] : [])]
  return {
    tooltip: { trigger: 'item', triggerOn: 'mousemove', renderMode: 'richText', formatter: (p: { name: string }) => p.name.replace('\n', ' · ') },
    series: [{
      type: 'tree', name: '校园映射', orient: 'LR', top: 16, bottom: 16, left: 110, right: 150, symbolSize: 14, roam: false, expandAndCollapse: true, initialTreeDepth: -1,
      animationDurationUpdate: 600,
      lineStyle: { color: alpha(t.brand[1]!, 0.4), width: 1.6, curveness: 0.5 },
      label: { position: 'left', verticalAlign: 'middle', align: 'right', fontSize: 12, color: t.text, lineHeight: 15 },
      leaves: { label: { position: 'right', verticalAlign: 'middle', align: 'left' } },
      emphasis: { focus: 'descendant' },
      data: [{ name: '本地校园映射', itemStyle: { color: t.brand[0], borderColor: alpha(t.brand[0]!, 0.4), borderWidth: 5, shadowBlur: 16, shadowColor: alpha(t.brand[0]!, 0.6) }, symbolSize: 20, label: { fontWeight: 700 }, children }],
    }],
  }
})
const treeHeight = computed(() => Math.max(260, (spaces.value.length + (maps.data.value?.buildings.length || 0)) * 34))
</script>
<template><div class="campus-page locations-page">
  <header class="campus-page-head"><div><p class="campus-eyebrow">校园与资产</p><h1>空间与<span class="gradient-text">楼栋</span></h1><p>空间来自 AIRIOT；校园、楼栋和楼层映射由 BE 独立保存。</p></div><button class="campus-button secondary" :class="{ 'is-loading': overview.loading.value || maps.loading.value }" :disabled="overview.loading.value || maps.loading.value" @click="refresh"><i class="ri-refresh-line" aria-hidden="true"></i>刷新</button></header>
  <ResourceState :loading="overview.loading.value" :error="overview.error.value" :has-data="!!overview.data.value" :last-success="overview.lastSuccess.value" @retry="overview.load" />
  <ResourceState :loading="maps.loading.value" :error="maps.error.value" :has-data="!!maps.data.value" :last-success="maps.lastSuccess.value" compact @retry="maps.load" />
  <div v-if="overview.data.value && maps.data.value" class="campus-kpi-grid">
    <KpiCard :index="0" label="模拟空间" icon="ri-map-pin-2-line" tone="teal" :value="spaces.length" unit="个" hint="来自 AIRIOT" />
    <KpiCard :index="1" label="已映射空间" icon="ri-links-line" tone="blue" :value="mapped" :suffix="`/ ${spaces.length}`" :ratio="spaces.length ? mapped / spaces.length : null" ratio-label="空间映射覆盖率" :hint="mapped === spaces.length ? '全部已映射' : `${spaces.length - mapped} 个待映射`" :warn="mapped !== spaces.length" />
    <KpiCard :index="2" label="校园" icon="ri-school-line" tone="violet" :value="maps.data.value.campuses.length" unit="个" hint="BE 本地保存" />
    <KpiCard :index="3" label="楼栋" icon="ri-building-4-line" tone="cyan" :value="maps.data.value.buildings.length" unit="栋" hint="BE 本地保存" />
  </div>
  <section v-if="overview.data.value && maps.data.value && !maps.error.value" class="campus-panel locations-tree" aria-labelledby="tree-title">
    <div class="campus-panel-head"><div><h2 id="tree-title"><i class="ri-organization-chart" aria-hidden="true"></i>映射关系图</h2><p>校园 → 楼栋 → 空间（楼层）。点击节点可展开或收起分支。</p></div></div>
    <CampusChart v-if="spaces.length || maps.data.value.campuses.length" :option="treeOption" :height="treeHeight" :label="`校园映射关系：${maps.data.value.campuses.length}个校园，${maps.data.value.buildings.length}栋楼，${mapped}/${spaces.length}个空间已映射`" />
    <p v-else class="campus-empty">尚未读取到空间或映射。</p>
  </section>
  <section v-if="overview.data.value" class="campus-section"><h2>模拟空间</h2><div class="campus-table-scroll"><table class="campus-table"><thead><tr><th scope="col">空间</th><th scope="col">类型</th><th scope="col">校园</th><th scope="col">楼栋 / 楼层</th><th v-if="campus.capabilities?.canAdmin" scope="col">操作</th></tr></thead><tbody><tr v-for="space in overview.data.value.spaces" :key="space.id" :class="{ 'row-selected': selectedSpaceId === space.id }"><td><strong>{{ space.name }}</strong><small>{{ space.id }}</small></td><td><span class="campus-chip">{{ space.type || '未提供' }}</span></td><td>{{ maps.error.value ? '映射不可用' : campusFor(buildingFor(bindingFor(space.id)?.buildingId)?.campusId)?.name || '未设置映射' }}</td><td><span v-if="!maps.error.value && buildingFor(bindingFor(space.id)?.buildingId)" class="campus-chip ok"><i class="ri-building-4-line" aria-hidden="true"></i>{{ buildingFor(bindingFor(space.id)?.buildingId)?.name }}</span><span v-else class="campus-chip sim">{{ maps.error.value ? '映射不可用' : '未设置' }}</span><small>{{ bindingFor(space.id)?.floor || '未设置楼层' }}</small></td><td v-if="campus.capabilities?.canAdmin"><button class="campus-link-button" :disabled="!maps.data.value || !!maps.error.value" @click="selectedSpaceId = space.id"><i class="ri-edit-2-line" aria-hidden="true"></i> 编辑映射</button></td></tr></tbody></table></div><p v-if="!overview.data.value.spaces.length" class="campus-empty">未读取到模拟空间，请检查接入权限。</p></section>
  <section v-if="maps.data.value" class="campus-section"><h2>本地校园与楼栋</h2><ul v-if="maps.data.value.campuses.length" class="location-tree"><li v-for="item in maps.data.value.campuses" :key="item.id"><span class="location-campus"><i class="ri-school-line" aria-hidden="true"></i>{{ item.name }}</span><ul><li v-for="building in maps.data.value.buildings.filter(b => b.campusId === item.id)" :key="building.id"><i class="ri-building-4-line" aria-hidden="true"></i>{{ building.name }}</li><li v-if="!maps.data.value.buildings.some(b => b.campusId === item.id)" class="campus-muted">尚未添加楼栋</li></ul></li></ul><p v-else class="campus-empty">尚未配置校园映射。管理员可添加校园和楼栋，再关联模拟空间。</p></section>
  <template v-if="campus.capabilities?.canAdmin && maps.data.value && !maps.error.value">
    <section v-if="selectedSpace" class="campus-section campus-editor"><h2>编辑 {{ selectedSpace.name }} 的映射</h2><form class="campus-control-form" @submit.prevent="saveBinding"><label>楼栋<select v-model="bindingBuildingId" required :disabled="saving"><option value="" disabled>选择已保存的楼栋</option><option v-for="item in maps.data.value.buildings" :key="item.id" :value="item.id">{{ campusFor(item.campusId)?.name }} / {{ item.name }}</option></select></label><label>楼层<input v-model="floor" maxlength="100" placeholder="可留空" :disabled="saving" /></label><button class="campus-button" type="submit" :class="{ 'is-loading': saving }" :disabled="saving || !bindingBuildingId">{{ saving ? '保存并回读中…' : '保存空间映射' }}</button><button class="campus-button secondary" type="button" :disabled="saving" @click="selectedSpaceId = ''">收起</button></form></section>
    <section class="campus-section"><h2>添加校园 / 楼栋</h2><div class="campus-two-columns"><form class="campus-form campus-panel" @submit.prevent="addCampus"><label>校园名称<input v-model="campusName" maxlength="100" placeholder="填写实际名称" required :disabled="saving" /></label><button class="campus-button secondary" type="submit" :disabled="saving || !campusName.trim()"><i class="ri-add-line" aria-hidden="true"></i>添加校园</button></form><form class="campus-form campus-panel" @submit.prevent="addBuilding"><label>所属校园<select v-model="buildingCampusId" required :disabled="saving"><option value="" disabled>选择已保存的校园</option><option v-for="item in maps.data.value.campuses" :key="item.id" :value="item.id">{{ item.name }}</option></select></label><label>楼栋名称<input v-model="buildingName" maxlength="100" required :disabled="saving" /></label><button class="campus-button secondary" type="submit" :disabled="saving || !buildingCampusId || !buildingName.trim()"><i class="ri-add-line" aria-hidden="true"></i>添加楼栋</button></form></div></section>
    <p v-if="writeError" class="campus-notice error" role="alert">{{ writeError }}</p><p v-if="success" class="campus-notice success" role="status">{{ success }}</p>
  </template>
</div></template>
<style scoped>
.locations-tree{margin-bottom:8px;background:radial-gradient(ellipse at 30% 50%,color-mix(in srgb,var(--brand-2) 6%,transparent),transparent 70%),var(--surface-1)}
.row-selected{background:var(--surface-hover)}
.campus-table td .campus-chip+small{margin-top:6px}
.location-tree{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}
.location-tree>li{padding:16px;border-radius:18px;background:var(--surface-1);border:1px solid var(--border-base)}
.location-campus{display:flex;align-items:center;gap:8px;font-weight:650;font-size:14.5px}
.location-campus i{width:30px;height:30px;border-radius:10px;display:grid;place-items:center;color:#fff;background:var(--brand-gradient)}
.location-tree ul{margin:12px 0 0 14px;padding-left:16px;border-left:2px solid color-mix(in srgb,var(--brand-2) 30%,transparent);display:flex;flex-direction:column;gap:6px;font-size:13px}
.location-tree ul li{position:relative;display:flex;align-items:center;gap:6px}
.location-tree ul li::before{content:'';position:absolute;left:-16px;top:50%;width:10px;height:2px;background:color-mix(in srgb,var(--brand-2) 30%,transparent)}
.location-tree ul li i{color:var(--brand-2)}
.campus-two-columns .campus-panel{max-width:none}
</style>
