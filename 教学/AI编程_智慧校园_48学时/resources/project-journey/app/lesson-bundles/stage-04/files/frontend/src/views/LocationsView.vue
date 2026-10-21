<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getLocations, createCampus, createBuilding, bindSpace } from '../api/full'
import { getSpaces } from '../api/campus'
import type { Locations } from '../types/full'
import type { Space } from '../types/campus'
import { ApiError } from '../api/http'
import { useCampusStore } from '../stores/campus'
import { useRequestScope } from '../composables/useRequestScope'
import SourceBanner from '../components/SourceBanner.vue'
import ReadStatus from '../components/ReadStatus.vue'
const store = useCampusStore(),
  read = useRequestScope(),
  write = useRequestScope()
const data = ref<Locations | null>(null),
  spaces = ref<Space[]>([])
const campusName = ref(''),
  campusId = ref(''),
  buildingName = ref(''),
  spaceId = ref(''),
  buildingId = ref(''),
  floor = ref(''),
  notice = ref('')
function refresh() {
  return read.run(
    async (signal) => ({ locations: await getLocations(signal), spaces: await getSpaces() }),
    (result) => {
      data.value = result.locations
      spaces.value = result.spaces.items
    },
    (error) => {
      if (error instanceof ApiError && error.status === 403) {
        data.value = null
        spaces.value = []
      }
    },
  )
}
async function save(kind: 'campus' | 'building' | 'binding') {
  if (write.busy.value || store.capabilities?.canAdmin !== true) return
  notice.value = ''
  await write.run(
    (signal) =>
      kind === 'campus'
        ? createCampus(campusName.value.trim(), store.csrf, signal)
        : kind === 'building'
          ? createBuilding(campusId.value, buildingName.value.trim(), store.csrf, signal)
          : bindSpace(
              spaceId.value,
              buildingId.value,
              floor.value.trim() || null,
              store.csrf,
              signal,
            ),
    () => {
      notice.value = '服务端已确认保存。'
      void refresh()
    },
  )
}
function bindingText(id: string) {
  const binding = data.value?.bindings.find((b) => b.spaceId === id)
  const building = data.value?.buildings.find((b) => b.id === binding?.buildingId)
  const campus = data.value?.campuses.find((c) => c.id === building?.campusId)
  return binding
    ? `${campus?.name ?? '未知校区'} / ${building?.name ?? '未知楼栋'} / ${binding.floor ?? '楼层未填'}`
    : '未绑定'
}
onMounted(refresh)
</script>
<template>
  <section class="workspace full-page" data-testid="locations-page">
    <header class="page-heading">
      <div>
        <p class="eyebrow">05 / 数据与空间映射</p>
        <h1>空间归属</h1>
        <p class="muted">把教学空间映射到本组的校区、楼栋和楼层。</p>
      </div>
      <button class="button subtle" :disabled="read.busy.value" @click="refresh">刷新映射</button>
    </header>
    <SourceBanner /><ReadStatus
      :busy="read.busy.value"
      :error="read.error.value"
      :has-data="!!data"
    />
    <div class="ledger">
      <div class="table-scroll">
        <table class="data-table">
          <caption>
            空间与本地归属
          </caption>
          <thead>
            <tr>
              <th>空间</th>
              <th>本地映射</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="space in spaces" :key="space.id">
              <td>
                <strong>{{ space.name }}</strong
                ><code>{{ space.id }}</code>
              </td>
              <td>{{ bindingText(space.id) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <div v-if="store.capabilities?.canAdmin === true" class="form-grid">
      <form class="panel" @submit.prevent="save('campus')">
        <h2>1. 新建校区</h2>
        <label
          >校区名称<input
            v-model="campusName"
            required
            maxlength="80"
            data-testid="campus-name" /></label
        ><button class="button primary" :disabled="write.busy.value">保存校区</button>
      </form>
      <form class="panel" @submit.prevent="save('building')">
        <h2>2. 新建楼栋</h2>
        <label
          >所属校区<select v-model="campusId" required>
            <option value="">请选择</option>
            <option v-for="campus in data?.campuses" :value="campus.id" :key="campus.id">
              {{ campus.name }}
            </option>
          </select></label
        ><label>楼栋名称<input v-model="buildingName" required maxlength="80" /></label
        ><button class="button primary" :disabled="write.busy.value">保存楼栋</button>
      </form>
      <form class="panel" @submit.prevent="save('binding')">
        <h2>3. 绑定空间</h2>
        <label
          >空间<select v-model="spaceId" required>
            <option value="">请选择</option>
            <option v-for="space in spaces" :value="space.id" :key="space.id">
              {{ space.name }}
            </option>
          </select></label
        ><label
          >楼栋<select v-model="buildingId" required>
            <option value="">请选择</option>
            <option v-for="building in data?.buildings" :value="building.id" :key="building.id">
              {{ data?.campuses.find((c) => c.id === building.campusId)?.name }} /
              {{ building.name }}
            </option>
          </select></label
        ><label>楼层（可选）<input v-model="floor" maxlength="40" /></label
        ><button class="button primary" :disabled="write.busy.value">保存绑定</button>
      </form>
    </div>
    <p v-else class="notice">当前身份只读。校区、楼栋和空间映射由管理员维护。</p>
    <p v-if="write.error.value" class="notice error" role="alert">{{ write.error.value }}</p>
    <p v-if="notice" class="notice" role="status">{{ notice }}</p>
  </section>
</template>
