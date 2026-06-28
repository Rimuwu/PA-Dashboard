<script setup>
import { ref, computed } from 'vue';
import { Shield, X, ArrowUp, ArrowDown } from '@lucide/vue';

const props = defineProps({
  show: Boolean,
  counterRatings: Array,
  loading: Boolean,
  lang: String,
  t: Function,
  hardestUnitId: String
});

defineEmits(['close', 'spawn']);

const sortKey = ref('score');
const sortDesc = ref(true);

const columns = computed(() => [
  { key: 'name',        label: () => props.lang === 'ru' ? 'Юнит противника' : 'Enemy Unit', align: 'left' },
  { key: 'cost',        label: () => props.lang === 'ru' ? 'Стоимость' : 'Cost',            align: 'center' },
  { key: 'dps',         label: () => props.lang === 'ru' ? 'УВС' : 'DPS',                  align: 'center' },
  { key: 'spawnCount',  label: () => props.t('spawnCount'),                                  align: 'center' },
  { key: 'resultLabel', label: () => props.lang === 'ru' ? 'Результат' : 'Result',           align: 'center' },
  { key: 'score',       label: () => props.t('rating'),                                      align: 'center' },
]);

const toggleSort = (key) => {
  if (sortKey.value === key) {
    sortDesc.value = !sortDesc.value;
  } else {
    sortKey.value = key;
    sortDesc.value = true;
  }
};

const sortedRatings = computed(() => {
  if (!props.counterRatings) return [];
  const arr = [...props.counterRatings];
  arr.sort((a, b) => {
    let va = a[sortKey.value];
    let vb = b[sortKey.value];
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    if (va < vb) return sortDesc.value ? 1 : -1;
    if (va > vb) return sortDesc.value ? -1 : 1;
    return 0;
  });
  return arr;
});
</script>

<template>
  <div v-if="show" class="modal-overlay" @click="$emit('close')">
    <div class="modal-content" @click.stop style="width: 85vw; max-width: 1000px; max-height: 85vh; display: flex; flex-direction: column;">
      <div class="modal-header" style="border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 12px;">
         <h3 class="modal-title" style="display:flex; align-items:center; gap:8px;">
          <Shield :size="16" style="color: var(--color-cyan);" />
          {{ t('counterTitle') }}
        </h3>
        <button class="close-btn" @click="$emit('close')"><X :size="18" /></button>
      </div>
      <div class="modal-body" style="overflow-y: auto; padding: 16px; min-height: 250px; display: flex; flex-direction: column;">
        <div v-if="loading" style="flex-grow:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; color:var(--color-cyan);">
          <div class="loading-spinner"></div>
          <span style="font-size:0.75rem; font-family:var(--font-title); font-weight: bold; letter-spacing: 0.5px;">
            {{ lang === 'ru' ? 'Расчет лучших контрпиков...' : 'Calculating best counters...' }}
          </span>
        </div>
        <div v-else-if="counterRatings.length === 0" style="flex-grow:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; color:var(--text-dim);">
          <span style="font-size:0.8rem; font-family:var(--font-title); font-weight: bold;">
            {{ lang === 'ru' ? 'Подходящих контрпиков не найдено' : 'No suitable counters found' }}
          </span>
          <span style="font-size:0.7rem; text-align:center; max-width: 320px;">
            {{ lang === 'ru' 
              ? 'Возможно, юнит не имеет вооружения или не может атаковать цели на выбранных слоях.' 
              : 'The unit may have no weapons or cannot target units on the selected layers.' }}
          </span>
        </div>
        <template v-else>
          <div style="margin-bottom: 12px; font-size: 0.72rem; color: var(--text-dim); line-height: 1.4;">
            {{ lang === 'ru' 
              ? 'Рейтинг составляется на основе симуляций против вашего выбранного отряда (эквивалентно по стоимости). Дополнительные баллы даются за превосходство в УВС и меньшую стоимость самого юнита.' 
              : 'Ratings are computed based on cost-equivalent simulations against your selected squad. Extra score is granted for superior DPS and lower unit metal cost.' }}
          </div>
          <table class="counter-table">
            <thead>
              <tr>
                <th
                  v-for="col in columns"
                  :key="col.key"
                  :style="{ textAlign: col.align, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }"
                  @click="toggleSort(col.key)"
                >
                  {{ col.label() }}
                  <span style="margin-left: 4px; font-size: 0.65rem; opacity: 0.7;">
                    <template v-if="sortKey === col.key">
                      {{ sortDesc ? '▼' : '▲' }}
                    </template>
                    <template v-else>
                      <span style="opacity: 0.3;">↕</span>
                    </template>
                  </span>
                </th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in sortedRatings" :key="item.unitId">
                <td style="text-align: left; display: flex; align-items: center; gap: 8px;">
                  <img :src="item.icon" style="width: 24px; height: 24px; object-fit: contain; background: rgba(0,0,0,0.2); padding: 2px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.05);" />
                  <span style="font-weight: bold; color: #fff;">{{ t('unit_name_' + item.unitId) }}</span>
                  <span v-if="item.unitId === hardestUnitId" 
                    style="margin-left: 6px; font-size: 0.62rem; padding: 1px 4px; border-radius: 3px; background: rgba(239, 68, 68, 0.15); border: 1px solid var(--color-red); color: var(--color-red); font-family: var(--font-title); font-weight: bold; text-transform: uppercase;"
                  >
                    {{ lang === 'ru' ? 'СИЛЬНЕЙШИЙ КОНТРПИК' : 'BEST COUNTER' }}
                  </span>
                </td>
                <td style="text-align: center;">{{ item.cost?.toLocaleString() }} M</td>
                <td style="text-align: center;">{{ Math.round(item.dps) }}</td>
                <td style="text-align: center; font-weight: bold; color: var(--color-cyan);">{{ item.spawnCount }}×</td>
                <td :class="item.resultClass" style="font-weight: bold; text-align: center;">
                  {{ item.resultLabel }}
                </td>
                <td style="text-align: center;">
                  <span class="rating-badge">{{ item.score }}</span>
                </td>
                <td style="text-align: right;">
                  <button @click="$emit('spawn', item)" class="btn" style="padding: 4px 10px; font-size: 0.7rem; border-color: var(--color-cyan); color: var(--color-cyan); background: rgba(6,182,212,0.04);">
                    {{ t('actionSpawn') }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </template>
      </div>
    </div>
  </div>
</template>
