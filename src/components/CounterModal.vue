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
const showBuildings = ref(false);

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
  let arr = [...props.counterRatings];
  
  if (!showBuildings.value) {
    arr = arr.filter(item => !item.isStructure);
  } else {
    const units = arr.filter(item => !item.isStructure);
    const buildings = arr.filter(item => item.isStructure)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    arr = [...units, ...buildings];
  }
  
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
          <div style="margin-bottom: 12px; font-size: 0.72rem; color: var(--text-dim); line-height: 1.4; display: flex; justify-content: space-between; align-items: center; gap: 16px;">
            <div>
              {{ lang === 'ru' 
                ? 'Рейтинг составляется на основе симуляций против вашего выбранного отряда (эквивалентно по стоимости). Дополнительные баллы даются за превосходство в УВС и меньшую стоимость самого юнита.' 
                : 'Ratings are computed based on cost-equivalent simulations against your selected squad. Extra score is granted for superior DPS and lower unit metal cost.' }}
            </div>
            <label style="display: flex; align-items: center; gap: 6px; white-space: nowrap; cursor: pointer; color: var(--color-cyan); user-select: none; font-weight: bold;">
              <input type="checkbox" v-model="showBuildings" style="accent-color: var(--color-cyan); cursor: pointer;" />
              {{ lang === 'ru' ? 'Показать оборонительные здания' : 'Show defensive structures' }}
            </label>
          </div>
          <!-- Sort Toolbar -->
          <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 12px; align-items: center;">
            <span style="font-size: 0.85rem; font-family: var(--font-title); font-weight: bold; color: var(--text-secondary); margin-right: 8px;">
              {{ lang === 'ru' ? 'Сортировка:' : 'Sort by:' }}
            </span>
            <button 
              v-for="col in columns" 
              :key="col.key"
              @click="toggleSort(col.key)"
              class="btn"
              :style="{
                padding: '4px 10px',
                fontSize: '0.8rem',
                borderColor: sortKey === col.key ? 'var(--color-cyan)' : 'var(--border-dim)',
                background: sortKey === col.key ? 'rgba(6, 182, 212, 0.1)' : 'transparent',
                color: sortKey === col.key ? 'var(--color-cyan)' : 'var(--text-secondary)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }"
            >
              {{ col.label() }}
              <span style="font-size: 0.7rem;">
                <template v-if="sortKey === col.key">
                  {{ sortDesc ? '▼' : '▲' }}
                </template>
                <template v-else>
                  <span style="opacity: 0.3;">↕</span>
                </template>
              </span>
            </button>
          </div>

          <!-- Cards Grid -->
          <div class="counter-cards-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px;">
            <div 
              v-for="item in sortedRatings" 
              :key="item.unitId"
              class="counter-unit-card"
              style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 16px; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3); transition: border-color 0.2s, background 0.2s; position: relative;"
              :style="item.unitId === hardestUnitId ? 'border-color: rgba(239, 68, 68, 0.4); background: rgba(239, 68, 68, 0.02);' : ''"
            >
              <!-- Card Header: Icon + Name -->
              <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 14px;">
                <img :src="item.icon" style="width: 48px; height: 48px; object-fit: contain; background: rgba(0,0,0,0.25); padding: 4px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); flex-shrink: 0;" />
                <div style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1;">
                  <span style="font-size: 0.95rem; font-weight: bold; color: #fff; font-family: var(--font-title); line-height: 1.2;">
                    {{ t('unit_name_' + item.unitId) }}
                  </span>
                  <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 4px;">
                    <span v-if="item.unitId === hardestUnitId" 
                      style="font-size: 0.65rem; padding: 1px 5px; border-radius: 3px; background: rgba(239, 68, 68, 0.15); border: 1px solid var(--color-red); color: var(--color-red); font-family: var(--font-title); font-weight: bold; text-transform: uppercase;"
                    >
                      {{ lang === 'ru' ? 'СИЛЬНЕЙШИЙ КОНТРПИК' : 'BEST COUNTER' }}
                    </span>
                    <span v-if="item.isStructure" 
                      style="font-size: 0.65rem; padding: 1px 5px; border-radius: 3px; background: rgba(168, 85, 247, 0.15); border: 1px solid #c084fc; color: #c084fc; font-family: var(--font-title); font-weight: bold; text-transform: uppercase;"
                    >
                      {{ lang === 'ru' ? 'ЗДАНИЕ' : 'STRUCTURE' }}
                    </span>
                  </div>
                </div>
              </div>
              
              <!-- Card Body: Specs Grid -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 12px;">
                <div style="display: flex; flex-direction: column; gap: 2px;">
                  <span style="font-size: 0.68rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.05em;">
                    {{ lang === 'ru' ? 'Стоимость' : 'Cost' }}
                  </span>
                  <span style="font-size: 0.95rem; font-weight: bold; color: #cbd5e1;">
                    {{ item.cost?.toLocaleString() }} M
                  </span>
                </div>
                <div style="display: flex; flex-direction: column; gap: 2px;">
                  <span style="font-size: 0.68rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.05em;">
                    {{ lang === 'ru' ? 'УВС (DPS)' : 'DPS' }}
                  </span>
                  <span style="font-size: 0.95rem; font-weight: bold; color: #cbd5e1;">
                    {{ Math.round(item.dps) }}
                  </span>
                </div>
                <div style="display: flex; flex-direction: column; gap: 2px;">
                  <span style="font-size: 0.68rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.05em;">
                    {{ lang === 'ru' ? 'Количество' : 'Quantity' }}
                  </span>
                  <span style="font-size: 1.05rem; font-weight: bold; color: var(--color-cyan);">
                    {{ item.spawnCount }}×
                  </span>
                </div>
                <div style="display: flex; flex-direction: column; gap: 2px;">
                  <span style="font-size: 0.68rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.05em;">
                    {{ lang === 'ru' ? 'Рейтинг' : 'Rating' }}
                  </span>
                  <span style="font-size: 1.05rem; font-weight: bold; color: #10b981;">
                    {{ item.score }}
                  </span>
                </div>
              </div>
              
              <!-- Card Footer: Result status + SPAWN action button -->
              <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 12px; margin-top: auto; gap: 12px;">
                <span :class="item.resultClass" style="font-size: 0.88rem; font-weight: bold; font-family: var(--font-title);">
                  {{ item.resultLabel }}
                </span>
                <button 
                  @click="$emit('spawn', item)" 
                  class="btn" 
                  style="padding: 6px 14px; font-size: 0.8rem; border-color: var(--color-cyan); color: var(--color-cyan); background: rgba(6,182,212,0.04); font-weight: bold; cursor: pointer; transition: all 0.2s;"
                >
                  {{ t('actionSpawn') }}
                </button>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
