<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import SourceBanner from '../components/SourceBanner.vue'
import { bindSpace, createBuilding, createCampus, getLocations } from '../api/full'
import { getSpaces } from '../api/campus'
import { ApiError } from '../api/http'
import { useCampusStore } from '../stores/campus'
import type { Space } from '../types/campus'
import type { Locations } from '../types/full'

const store = useCampusStore()

/** api/full 的写函数由运行时守卫校验形状，泛型未显式传入，这里补回返回类型。 */
type CreatedCampus = { id: string; name: string }
type CreatedBuilding = { id: string; campusId: string; name: string }
type SavedBinding = { spaceId: string; buildingId: string; floor: string | null }

/** 两份读取各自保存结果与错误：一处失败不掩盖另一处。 */
const locations = ref<Locations | null>(null)
const spaces = ref<Space[]>([])
const spacesLoaded = ref(false)
const locationsError = ref('')
const spacesError = ref('')
const reading = ref(false)
let readToken = 0

const canAdmin = computed(() => store.capabilities?.canAdmin === true)
const roleText = computed(() => store.capabilities?.roles.join('、') || '未登录')
const hasLocations = computed(() => locations.value !== null)
const hasSpaces = computed(() => spacesLoaded.value)

/** 校园 → 楼栋，用于清单展示和楼栋下拉的分组。 */
const campusGroups = computed(() => {
  const list = locations.value?.campuses ?? []
  const buildings = locations.value?.buildings ?? []
  return list.map((campus) => ({
    ...campus,
    buildings: buildings.filter((building) => building.campusId === campus.id),
  }))
})
const campusGroupsWithBuildings = computed(() =>
  campusGroups.value.filter((group) => group.buildings.length > 0),
)
const campusNameById = computed(
  () => new Map((locations.value?.campuses ?? []).map((campus) => [campus.id, campus.name])),
)
const buildingById = computed(
  () => new Map((locations.value?.buildings ?? []).map((building) => [building.id, building])),
)
const bindingBySpace = computed(() => {
  const map = new Map<string, { buildingId: string; floor: string | null }>()
  for (const binding of locations.value?.bindings ?? []) {
    map.set(binding.spaceId, { buildingId: binding.buildingId, floor: binding.floor })
  }
  return map
})

/** 每一行来自 sourcespace 目录，归属信息取自本次 locations 的绑定记录。 */
const spaceRows = computed(() =>
  spaces.value.map((space) => {
    const binding = bindingBySpace.value.get(space.id) ?? null
    const building = binding ? buildingById.value.get(binding.buildingId) ?? null : null
    const campusName = building ? campusNameById.value.get(building.campusId) ?? building.campusId : null
    return { space, binding, building, campusName, floor: binding?.floor ?? null }
  }),
)
const boundCount = computed(() => spaceRows.value.filter((row) => row.binding !== null).length)

function failureText(error: unknown, action: string): string {
  if (error instanceof ApiError) {
    if (error.status === 403) return `${action}：服务端拒绝（ACCESS_DENIED），当前身份不能保存位置。`
    if (error.status === 404) return `${action}：引用不存在（NOT_FOUND），请重新读取清单后再选择。`
    if (error.status === 401) return `${action}：登录已失效，请重新登录后重试。`
    if (error.status === 409) return `${action}：记录已变化（${String(error.code)}），请回读后重新决定。`
    return `${action}：${error.message}`
  }
  return `${action}：本次请求未完成，请重试。`
}

function noteAuth(error: unknown) {
  if (error instanceof ApiError && error.status === 401) store.expireSession()
}

/** 每次写成功后调用：两份读取独立成败，失败只标记自己。 */
async function refreshAll() {
  const token = ++readToken
  const epoch = store.sessionEpoch
  reading.value = true
  try {
    const [locationsResult, spacesResult] = await Promise.allSettled([getLocations(), getSpaces()])
    if (token !== readToken || epoch !== store.sessionEpoch) return
    if (locationsResult.status === 'fulfilled') {
      locations.value = locationsResult.value
      locationsError.value = ''
    } else {
      locationsError.value = failureText(locationsResult.reason, 'locations 读取失败')
      noteAuth(locationsResult.reason)
    }
    if (spacesResult.status === 'fulfilled') {
      spaces.value = spacesResult.value.items
      spacesLoaded.value = true
      spacesError.value = ''
    } else {
      spacesError.value = failureText(spacesResult.reason, '来源空间读取失败')
      noteAuth(spacesResult.reason)
    }
  } finally {
    if (token === readToken) reading.value = false
  }
}

/** 写入已由服务端确认时，如实区分“清单是否回读成功”，不把旧快照说成新结果。 */
function confirmation(done: string): string {
  const failed = [
    locationsError.value ? 'locations 未回读成功' : '',
    spacesError.value ? '来源空间未回读成功' : '',
  ].filter(Boolean)
  if (failed.length === 0) return `${done}；locations 与来源空间均已重新读取确认。`
  return `${done}（本次写入已由服务端返回确认）；但${failed.join('、')}，下方清单仍是上次成功读取，不能当作已确认。`
}

/* ---------- ① 创建校园 ---------- */
const campusName = ref('')
const creatingCampus = ref(false)
const campusError = ref('')
const campusNotice = ref('')

async function submitCampus() {
  campusError.value = ''
  campusNotice.value = ''
  if (!canAdmin.value) {
    campusError.value = '当前身份不能保存：canAdmin 不是 true。'
    return
  }
  if (creatingCampus.value) return
  const name = campusName.value.trim()
  if (name.length === 0 || name.length > 80) {
    campusError.value = '校园名称需为 1–80 个字符（提交前本地检查，服务端仍会校验）。'
    return
  }
  if (!store.csrf) {
    campusError.value = '登录保护尚未准备好，请重新登录后再保存。'
    return
  }
  creatingCampus.value = true
  try {
    const created = (await createCampus(name, store.csrf)) as CreatedCampus
    campusName.value = ''
    const done = `已创建校园「${created.name}」（id=${created.id}）`
    await refreshAll()
    campusNotice.value = confirmation(done)
  } catch (error) {
    campusError.value = failureText(error, '创建校园未成功，输入已保留')
    noteAuth(error)
  } finally {
    creatingCampus.value = false
  }
}

/* ---------- ② 在校园下创建楼栋 ---------- */
const buildingCampusId = ref('')
const buildingName = ref('')
const creatingBuilding = ref(false)
const buildingError = ref('')
const buildingNotice = ref('')

async function submitBuilding() {
  buildingError.value = ''
  buildingNotice.value = ''
  if (!canAdmin.value) {
    buildingError.value = '当前身份不能保存：canAdmin 不是 true。'
    return
  }
  if (creatingBuilding.value) return
  const campusId = buildingCampusId.value
  if (!campusId) {
    buildingError.value = '请选择所属校园（提交 campusId）。'
    return
  }
  if (!(locations.value?.campuses ?? []).some((campus) => campus.id === campusId)) {
    buildingError.value = '所选校园不在当前清单中，请先重新读取 locations 再提交。'
    return
  }
  const name = buildingName.value.trim()
  if (name.length === 0 || name.length > 80) {
    buildingError.value = '楼栋名称需为 1–80 个字符（提交前本地检查，服务端仍会校验）。'
    return
  }
  if (!store.csrf) {
    buildingError.value = '登录保护尚未准备好，请重新登录后再保存。'
    return
  }
  creatingBuilding.value = true
  try {
    const created = (await createBuilding(campusId, name, store.csrf)) as CreatedBuilding
    buildingName.value = ''
    const campusName = campusNameById.value.get(created.campusId) ?? created.campusId
    const done = `已在「${campusName}」下创建楼栋「${created.name}」（id=${created.id}）`
    await refreshAll()
    buildingNotice.value = confirmation(done)
  } catch (error) {
    buildingError.value = failureText(error, '创建楼栋未成功，输入已保留')
    noteAuth(error)
  } finally {
    creatingBuilding.value = false
  }
}

/* ---------- ③ 把来源空间绑定到楼栋 ---------- */
const bindingSpaceId = ref('')
const bindingBuildingId = ref('')
const bindingFloor = ref('')
const bindingBusy = ref(false)
const bindingError = ref('')
const bindingNotice = ref('')

const currentBindingText = computed(() => {
  if (!bindingSpaceId.value) return ''
  const binding = bindingBySpace.value.get(bindingSpaceId.value)
  if (!binding) return '该空间当前未绑定楼栋；保存后即建立绑定。'
  const building = buildingById.value.get(binding.buildingId)
  const label = building ? building.name : binding.buildingId
  return `当前绑定：${label}${binding.floor ? ` · 楼层 ${binding.floor}` : ' · 楼层未填'}；再次提交会覆盖这条绑定。`
})

async function submitBinding() {
  bindingError.value = ''
  bindingNotice.value = ''
  if (!canAdmin.value) {
    bindingError.value = '当前身份不能保存：canAdmin 不是 true。'
    return
  }
  if (bindingBusy.value) return
  const spaceId = bindingSpaceId.value
  if (!spaceId) {
    bindingError.value = '请选择来源空间（提交 spaceId）。'
    return
  }
  if (!spaces.value.some((space) => space.id === spaceId)) {
    bindingError.value = '所选空间不在当前来源空间清单中，请先重新读取。'
    return
  }
  const buildingId = bindingBuildingId.value
  if (!buildingId) {
    bindingError.value = '请选择目标楼栋（提交 buildingId）。'
    return
  }
  if (!(locations.value?.buildings ?? []).some((building) => building.id === buildingId)) {
    bindingError.value = '目标楼栋不存在或不在当前清单中；不存在的楼栋不能绑定，请重新读取 locations 后再选。'
    return
  }
  const floor = bindingFloor.value.trim()
  if (floor.length > 40) {
    bindingError.value = '楼层最多 40 个字符，可留空表示不填。'
    return
  }
  if (!store.csrf) {
    bindingError.value = '登录保护尚未准备好，请重新登录后再保存。'
    return
  }
  bindingBusy.value = true
  try {
    const saved = (await bindSpace(spaceId, buildingId, floor === '' ? null : floor, store.csrf)) as SavedBinding
    const spaceName = spaces.value.find((space) => space.id === saved.spaceId)?.name ?? saved.spaceId
    const buildingName = buildingById.value.get(saved.buildingId)?.name ?? saved.buildingId
    const done = `已把空间「${spaceName}」绑定到楼栋「${buildingName}」（楼层：${saved.floor ?? '未填'}）`
    await refreshAll()
    bindingNotice.value = confirmation(done)
  } catch (error) {
    bindingError.value = failureText(error, '保存绑定未成功，输入已保留')
    noteAuth(error)
  } finally {
    bindingBusy.value = false
  }
}

/** 回读后清单里已不存在的手动选择要清空；失败时不清空，避免覆盖学生输入。 */
watch(
  () => (locations.value?.campuses ?? []).map((campus) => campus.id).join('|'),
  () => {
    if (buildingCampusId.value && !(locations.value?.campuses ?? []).some((campus) => campus.id === buildingCampusId.value)) {
      buildingCampusId.value = ''
    }
  },
)
watch(
  () => (locations.value?.buildings ?? []).map((building) => building.id).join('|'),
  () => {
    if (bindingBuildingId.value && !(locations.value?.buildings ?? []).some((building) => building.id === bindingBuildingId.value)) {
      bindingBuildingId.value = ''
    }
  },
)
watch(
  () => spaces.value.map((space) => space.id).join('|'),
  () => {
    if (bindingSpaceId.value && !spaces.value.some((space) => space.id === bindingSpaceId.value)) {
      bindingSpaceId.value = ''
    }
  },
)

onMounted(refreshAll)
</script>

<template>
  <section class="workspace full-page" data-testid="locations-view">
    <header class="page-heading">
      <div>
        <p class="eyebrow">第04站 · 本地位置登记</p>
        <h1>把设备放到正确的楼里</h1>
        <p class="muted">
          先建校园，再在校园下建楼栋，最后把来源空间绑定到楼栋。下拉提交的是真实ID；
          每次保存成功后分别回读 locations 与来源空间，不把一次成功说成全部已确认。
        </p>
      </div>
      <button type="button" class="button subtle" :disabled="reading" @click="refreshAll">
        {{ reading ? '正在读取…' : '重新读取' }}
      </button>
    </header>

    <SourceBanner business />

    <div v-if="locationsError" class="notice error" role="alert">
      <strong>{{
        hasLocations ? 'locations 本次回读失败，以下校园/楼栋/绑定仍是上次成功读取' : 'locations 读取失败，尚无校园与楼栋清单'
      }}</strong>
      <p>{{ locationsError }}</p>
    </div>
    <div v-if="spacesError" class="notice error" role="alert">
      <strong>{{
        hasSpaces ? '来源空间本次回读失败，以下空间仍是上次成功读取' : '来源空间读取失败，暂时没有可绑定空间'
      }}</strong>
      <p>{{ spacesError }}</p>
    </div>

    <div v-if="!canAdmin" class="notice" role="status">
      <strong>只读身份：本页不提供保存入口</strong>
      <p>
        capabilities.canAdmin 不是 true（当前角色：{{ roleText }}）。表单不渲染只是第一道；
        POST campuses / buildings 与 PUT spaces/{spaceId} 仍由服务端 ACCESS_DENIED 最终拒绝，本页不会假装保存成功。
      </p>
    </div>

    <div class="metric-strip">
      <div>
        <strong class="numeric">{{ locations?.campuses.length ?? 0 }}</strong>
        <span>校园</span>
      </div>
      <div>
        <strong class="numeric">{{ locations?.buildings.length ?? 0 }}</strong>
        <span>楼栋</span>
      </div>
      <div>
        <strong class="numeric">{{ boundCount }} / {{ spaces.length }}</strong>
        <span>已绑定空间 / 来源空间</span>
      </div>
    </div>

    <div v-if="canAdmin" class="form-grid">
      <form class="panel" @submit.prevent="submitCampus">
        <h2>① 创建校园</h2>
        <p class="field-help">POST /api/campus/locations/campuses，body 只有 name。</p>
        <label>
          校园名称（1–80 字符）
          <input
            v-model="campusName"
            type="text"
            maxlength="80"
            autocomplete="off"
            placeholder="例如：南方科技大学"
            :disabled="creatingCampus"
            data-testid="campus-name"
          />
        </label>
        <p v-if="campusError" class="notice error" role="alert">{{ campusError }}</p>
        <p v-if="campusNotice" class="notice" role="status">{{ campusNotice }}</p>
        <button type="submit" class="button primary full" :disabled="creatingCampus" data-testid="campus-submit">
          {{ creatingCampus ? '正在保存…' : '创建校园' }}
        </button>
      </form>

      <form class="panel" @submit.prevent="submitBuilding">
        <h2>② 在校园下创建楼栋</h2>
        <p class="field-help">POST /api/campus/locations/buildings，body 为 campusId + name。</p>
        <label>
          所属校园（提交 campusId）
          <select v-model="buildingCampusId" :disabled="creatingBuilding" data-testid="building-campus">
            <option value="">请选择校园</option>
            <option v-for="campus in locations?.campuses ?? []" :key="campus.id" :value="campus.id">
              {{ campus.name }} · {{ campus.id }}
            </option>
          </select>
        </label>
        <p v-if="hasLocations && (locations?.campuses.length ?? 0) === 0" class="field-help">
          还没有校园；先在上一个表单创建校园，再回来建楼栋。
        </p>
        <label>
          楼栋名称（1–80 字符）
          <input
            v-model="buildingName"
            type="text"
            maxlength="80"
            autocomplete="off"
            placeholder="例如：图书馆"
            :disabled="creatingBuilding"
            data-testid="building-name"
          />
        </label>
        <p v-if="buildingError" class="notice error" role="alert">{{ buildingError }}</p>
        <p v-if="buildingNotice" class="notice" role="status">{{ buildingNotice }}</p>
        <button
          type="submit"
          class="button primary full"
          :disabled="creatingBuilding || !hasLocations"
          data-testid="building-submit"
        >
          {{ creatingBuilding ? '正在保存…' : '创建楼栋' }}
        </button>
      </form>

      <form class="panel" @submit.prevent="submitBinding">
        <h2>③ 绑定来源空间到楼栋</h2>
        <p class="field-help">PUT /api/campus/locations/spaces/{spaceId}，body 为 buildingId + floor。</p>
        <label>
          来源空间（只读目录，提交 spaceId）
          <select v-model="bindingSpaceId" :disabled="bindingBusy" data-testid="binding-space">
            <option value="">请选择空间</option>
            <option v-for="space in spaces" :key="space.id" :value="space.id">
              {{ space.name }} · {{ space.id }}
            </option>
          </select>
        </label>
        <p v-if="currentBindingText" class="field-help">{{ currentBindingText }}</p>
        <label>
          目标楼栋（提交 buildingId）
          <select v-model="bindingBuildingId" :disabled="bindingBusy" data-testid="binding-building">
            <option value="">请选择楼栋</option>
            <optgroup
              v-for="group in campusGroupsWithBuildings"
              :key="group.id"
              :label="`${group.name} · ${group.id}`"
            >
              <option v-for="building in group.buildings" :key="building.id" :value="building.id">
                {{ building.name }} · {{ building.id }}
              </option>
            </optgroup>
          </select>
        </label>
        <p v-if="hasLocations && (locations?.buildings.length ?? 0) === 0" class="field-help">
          清单里还没有楼栋；不存在的楼栋不能绑定，先创建楼栋再回来。
        </p>
        <label>
          楼层（可空，≤40 字符）
          <input
            v-model="bindingFloor"
            type="text"
            maxlength="40"
            autocomplete="off"
            placeholder="例如：3F"
            :disabled="bindingBusy"
            data-testid="binding-floor"
          />
        </label>
        <p v-if="bindingError" class="notice error" role="alert">{{ bindingError }}</p>
        <p v-if="bindingNotice" class="notice" role="status">{{ bindingNotice }}</p>
        <button
          type="submit"
          class="button primary full"
          :disabled="bindingBusy || !hasLocations || !hasSpaces"
          data-testid="binding-submit"
        >
          {{ bindingBusy ? '正在保存…' : '保存绑定' }}
        </button>
      </form>
    </div>

    <section v-if="hasSpaces" class="panel">
      <div class="section-heading">
        <h2>来源空间与当前归属</h2>
        <span>
          来源空间由 GET /api/campus/spaces 独立读取（本页不创建空间）；
          {{ boundCount }} / {{ spaces.length }} 个空间已有绑定记录。
        </span>
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <caption>
            归属列来自本次 GET /api/campus/locations 的 bindings；未绑定的空间显示为未绑定，不是读取失败。
          </caption>
          <thead>
            <tr>
              <th>来源空间</th>
              <th>楼栋</th>
              <th>校园</th>
              <th>楼层</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in spaceRows" :key="row.space.id">
              <td>
                <strong>{{ row.space.name }}</strong>
                <code>{{ row.space.id }}</code>
              </td>
              <td>
                <template v-if="row.building">
                  <strong>{{ row.building.name }}</strong>
                  <code>{{ row.building.id }}</code>
                </template>
                <span v-else class="muted">未绑定</span>
              </td>
              <td>{{ row.campusName ?? '—' }}</td>
              <td>{{ row.floor ?? '—' }}</td>
              <td>
                <span class="state-badge" :class="row.binding ? 'good' : ''">
                  {{ row.binding ? '已绑定' : '未绑定' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="hasLocations" class="panel">
      <div class="section-heading">
        <h2>校园与楼栋</h2>
        <span>{{ locations?.campuses.length ?? 0 }} 个校园 · {{ locations?.buildings.length ?? 0 }} 个楼栋</span>
      </div>
      <div v-if="campusGroups.length === 0" class="empty-state" role="status">
        <h3>还没有校园</h3>
        <p>locations 读取成功但 campuses 为空；先创建校园，再在其下创建楼栋。</p>
      </div>
      <ul v-else class="location-tree">
        <li v-for="group in campusGroups" :key="group.id">
          <div class="tree-campus">
            <strong>{{ group.name }}</strong>
            <code>{{ group.id }}</code>
          </div>
          <ul v-if="group.buildings.length > 0">
            <li v-for="building in group.buildings" :key="building.id">
              <span>{{ building.name }}</span>
              <code>{{ building.id }}</code>
            </li>
          </ul>
          <p v-else class="muted tiny">该校园下还没有楼栋。</p>
        </li>
      </ul>
      <p class="ledger-footnote">
        绑定只写 space_id + building_id + floor；校园由楼栋反推，未绑定的空间在 /campus/spaces 里三个派生字段为 null。
      </p>
    </section>
  </section>
</template>

<style scoped>
.panel .field-help {
  margin: 10px 0 0;
}
.panel label + label {
  margin-top: 16px;
}
.panel .button.full {
  margin-top: 18px;
}
.panel .notice {
  margin: 16px 0 0;
}
.location-tree {
  list-style: none;
  margin: 0;
  padding: 0;
}
.location-tree > li {
  border-top: 1px solid var(--line);
  padding: 16px 0;
}
.location-tree > li:first-child {
  border-top: 0;
}
.location-tree ul {
  list-style: none;
  margin: 10px 0 0;
  padding: 0 0 0 14px;
  border-left: 1px solid var(--line);
}
.location-tree ul li {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  align-items: baseline;
  padding: 5px 0;
  font-size: 0.83rem;
}
.tree-campus {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  align-items: baseline;
}
.location-tree code {
  font-size: 0.7rem;
  color: var(--muted);
}
.location-tree .tiny {
  margin: 8px 0 0;
  font-size: 0.78rem;
}
</style>
