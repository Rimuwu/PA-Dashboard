<script setup>
import { BarChart2, X } from '@lucide/vue';

const props = defineProps({
  show: Boolean,
  compareUnitIds: Array,
  lang: String,
  getUnitById: Function,
  getBestValue: Function,
  getWorstValue: Function,
  getUnitEnergyStats: Function,
  normalizeLayer: Function,
  formatTargetLabel: Function,
  t: Function
});

defineEmits(['close']);

const getCategoryColor = (cat) => {
  if (cat === 'land') return { bg: 'rgba(234, 179, 8, 0.15)', fg: '#fef08a' };
  if (cat === 'air') return { bg: 'rgba(6, 182, 212, 0.15)', fg: '#a5f3fc' };
  if (cat === 'sea') return { bg: 'rgba(59, 130, 246, 0.15)', fg: '#bfdbfe' };
  if (cat === 'orbital') return { bg: 'rgba(168, 85, 247, 0.15)', fg: '#e9d5ff' };
  return { bg: 'rgba(255,255,255,0.06)', fg: '#cbd5e1' };
};
</script>

<template>
  <div v-if="show && compareUnitIds.length > 0" class="modal-overlay" @click="$emit('close')">
    <div class="modal-content" @click.stop style="width: 80vw; max-width: 1000px; max-height: 85vh; display: flex; flex-direction: column;">
      <div class="modal-header" style="border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 12px;">
        <h3 class="modal-title" style="display:flex; align-items:center; gap:8px;">
          <BarChart2 :size="15" style="color: var(--color-cyan);" />
          {{ lang === 'ru' ? 'Сравнение характеристик юнитов' : 'Unit Specs Comparison' }}
        </h3>
        <button class="close-btn" @click="$emit('close')"><X :size="18" /></button>
      </div>
      <div class="modal-body" style="overflow-x: auto; padding: 16px;">
        <table class="compare-table">
          <thead>
            <tr>
              <th style="text-align: left;">{{ lang === 'ru' ? 'Характеристика' : 'Spec / Stat' }}</th>
              <th v-for="id in compareUnitIds" :key="id" style="min-width: 170px; padding: 12px 6px; text-align: center;">
                <div class="compare-unit-header-card" style="display: flex; flex-direction: column; align-items: center; gap: 8px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 12px 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.2); transition: border-color 0.2s; position: relative;">
                  <span 
                    class="category-badge" 
                    :style="{
                      fontSize: '0.55rem',
                      textTransform: 'uppercase',
                      padding: '1px 5px',
                      borderRadius: '3px',
                      fontWeight: 'bold',
                      background: getCategoryColor(getUnitById(id)?.category).bg,
                      color: getCategoryColor(getUnitById(id)?.category).fg
                    }"
                  >
                    {{ t(getUnitById(id)?.category || 'unknown') }}
                  </span>
                  <img :src="getUnitById(id)?.icon" style="width: 48px; height: 48px; object-fit: contain; filter: drop-shadow(0 0 4px rgba(255,255,255,0.1));" />
                  <span style="font-family: var(--font-title); font-size: 0.78rem; font-weight: bold; color: #fff; line-height: 1.2; text-align: center; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; height: 28px;">
                    {{ t('unit_name_' + id) }}
                  </span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <!-- Tier -->
            <tr>
              <td class="row-label">{{ lang === 'ru' ? 'Уровень (Тир)' : 'Tier' }}</td>
              <td v-for="id in compareUnitIds" :key="id">
                <span class="tier-badge" :class="'tier-' + (getUnitById(id)?.tier || 'T1').toLowerCase()">
                  {{ getUnitById(id)?.tier || 'T1' }}
                </span>
              </td>
            </tr>
            <!-- Cost -->
            <tr>
              <td class="row-label">{{ lang === 'ru' ? 'Стоимость металла' : 'Metal Cost' }}</td>
              <td v-for="id in compareUnitIds" :key="id" 
                :class="{ 
                  'compare-highlight-best': getUnitById(id)?.cost === getBestValue('cost', 'min'),
                  'compare-highlight-worst': getUnitById(id)?.cost === getWorstValue('cost', 'min')
                }">
                {{ getUnitById(id)?.cost?.toLocaleString() }} M
              </td>
            </tr>
            <!-- Build Energy -->
            <tr>
              <td class="row-label">{{ lang === 'ru' ? 'Энергия (постр.)' : 'Build Energy' }}</td>
              <td v-for="id in compareUnitIds" :key="id"
                :class="{ 
                  'compare-highlight-best': getUnitById(id)?.unit_types?.includes('UNITTYPE_Structure') && (getUnitById(id)?.cost * 25) === getBestValue('build_energy', 'min'),
                  'compare-highlight-worst': getUnitById(id)?.unit_types?.includes('UNITTYPE_Structure') && (getUnitById(id)?.cost * 25) === getWorstValue('build_energy', 'min')
                }">
                <span v-if="getUnitById(id)?.unit_types?.includes('UNITTYPE_Structure')" style="color: var(--color-cyan);">
                  {{ (getUnitById(id)?.cost * 25).toLocaleString() }} E
                </span>
                <span v-else>-</span>
              </td>
            </tr>
            <!-- Energy Production -->
            <tr>
              <td class="row-label">{{ lang === 'ru' ? 'Выработка энергии' : 'Energy Production' }}</td>
              <td v-for="id in compareUnitIds" :key="id"
                :class="{
                  'compare-highlight-best': (getUnitEnergyStats(getUnitById(id))?.energyProd || 0) === getBestValue('energy_prod', 'max') && getBestValue('energy_prod', 'max') > 0
                }">
                <span v-if="getUnitEnergyStats(getUnitById(id))?.energyProd > 0" style="color: #4ade80; font-weight: bold;">
                  +{{ getUnitEnergyStats(getUnitById(id)).energyProd.toLocaleString() }} E/s
                </span>
                <span v-else>-</span>
              </td>
            </tr>
            <!-- Energy Consumption -->
            <tr>
              <td class="row-label">{{ lang === 'ru' ? 'Потребление энергии' : 'Energy Consumption' }}</td>
              <td v-for="id in compareUnitIds" :key="id"
                :class="{
                  'compare-highlight-worst': (getUnitEnergyStats(getUnitById(id))?.energyCons || 0) === getWorstValue('energy_cons', 'max') && getWorstValue('energy_cons', 'max') > 0
                }">
                <span v-if="getUnitEnergyStats(getUnitById(id))?.energyCons > 0" style="color: #f87171; font-weight: bold;">
                  -{{ getUnitEnergyStats(getUnitById(id)).energyCons.toLocaleString() }} E/s
                </span>
                <span v-else>-</span>
              </td>
            </tr>
            <!-- Health -->
            <tr>
              <td class="row-label">{{ lang === 'ru' ? 'Здоровье (HP)' : 'Health (HP)' }}</td>
              <td v-for="id in compareUnitIds" :key="id" 
                :class="{ 
                  'compare-highlight-best': getUnitById(id)?.health === getBestValue('health', 'max'),
                  'compare-highlight-worst': getUnitById(id)?.health === getWorstValue('health', 'max')
                }">
                {{ getUnitById(id)?.health?.toLocaleString() }} HP
              </td>
            </tr>
            <!-- DPS -->
            <tr>
              <td class="row-label">{{ lang === 'ru' ? 'Общий DPS' : 'Total DPS' }}</td>
              <td v-for="id in compareUnitIds" :key="id" 
                :class="{ 
                  'compare-highlight-best': (getUnitById(id)?.dps || 0) === getBestValue('dps', 'max'),
                  'compare-highlight-worst': (getUnitById(id)?.dps || 0) === getWorstValue('dps', 'max')
                }">
                {{ Math.round(getUnitById(id)?.dps || 0) }}
              </td>
            </tr>
            <!-- Attack Speed -->
            <tr>
              <td class="row-label">{{ lang === 'ru' ? 'Ск. атаки' : 'Atk/s' }}</td>
              <td v-for="id in compareUnitIds" :key="id">
                <span v-if="getUnitById(id)?.weapons?.length">
                  {{ getUnitById(id).weapons.map(w => w.rate_of_fire.toFixed(2)).join(' / ') }} /s
                </span>
                <span v-else>-</span>
              </td>
            </tr>
            <!-- Range -->
            <tr>
              <td class="row-label">{{ lang === 'ru' ? 'Макс. Дальность' : 'Max Range' }}</td>
              <td v-for="id in compareUnitIds" :key="id" 
                :class="{ 
                  'compare-highlight-best': (getUnitById(id)?.range || 0) === getBestValue('range', 'max'),
                  'compare-highlight-worst': (getUnitById(id)?.range || 0) === getWorstValue('range', 'max')
                }">
                {{ getUnitById(id)?.range || 0 }}m
              </td>
            </tr>
            <!-- Speed -->
            <tr>
              <td class="row-label">{{ lang === 'ru' ? 'Скорость хода' : 'Move Speed' }}</td>
              <td v-for="id in compareUnitIds" :key="id" 
                :class="{ 
                  'compare-highlight-best': (getUnitById(id)?.move_speed || 0) === getBestValue('speed', 'max'),
                  'compare-highlight-worst': (getUnitById(id)?.move_speed || 0) === getWorstValue('speed', 'max')
                }">
                {{ getUnitById(id)?.move_speed || 0 }}m/s
              </td>
            </tr>
            <!-- Turn Speed -->
            <tr>
              <td class="row-label">{{ lang === 'ru' ? 'Скорость разворота' : 'Turn Speed' }}</td>
              <td v-for="id in compareUnitIds" :key="id" 
                :class="{ 
                  'compare-highlight-best': (getUnitById(id)?.turn_speed || 0) === getBestValue('turn_speed', 'max'),
                  'compare-highlight-worst': (getUnitById(id)?.turn_speed || 0) === getWorstValue('turn_speed', 'max')
                }">
                {{ getUnitById(id)?.turn_speed || 0 }}°/s
              </td>
            </tr>
            <!-- Vision -->
            <tr>
              <td class="row-label">{{ lang === 'ru' ? 'Радиус обзора' : 'Vision Radius' }}</td>
              <td v-for="id in compareUnitIds" :key="id" 
                :class="{ 
                  'compare-highlight-best': (getUnitById(id)?.vision_radius || 0) === getBestValue('vision', 'max'),
                  'compare-highlight-worst': (getUnitById(id)?.vision_radius || 0) === getWorstValue('vision', 'max')
                }">
                {{ getUnitById(id)?.vision_radius || 0 }}m
              </td>
            </tr>
            <!-- Radar -->
            <tr>
              <td class="row-label">{{ lang === 'ru' ? 'Радиус радара' : 'Radar Radius' }}</td>
              <td v-for="id in compareUnitIds" :key="id" 
                :class="{ 
                  'compare-highlight-best': (getUnitById(id)?.radar_radius || 0) === getBestValue('radar', 'max') && getBestValue('radar', 'max') > 0,
                  'compare-highlight-worst': (getUnitById(id)?.radar_radius || 0) === getWorstValue('radar', 'max')
                }">
                {{ getUnitById(id)?.radar_radius || 0 }}m
              </td>
            </tr>
            <!-- Repair Rate -->
            <tr>
              <td class="row-label">{{ lang === 'ru' ? 'Скорость ремонта' : 'Repair Rate' }}</td>
              <td v-for="id in compareUnitIds" :key="id"
                :class="{
                  'compare-highlight-best': (getUnitById(id)?.build_metal_rate || 0) === getBestValue('repair', 'max') && getBestValue('repair', 'max') > 0
                }">
                <span v-if="getUnitById(id)?.is_builder && getUnitById(id)?.build_metal_rate" style="color: #34d399;">
                  {{ getUnitById(id).build_metal_rate }} m/s
                </span>
                <span v-else>-</span>
              </td>
            </tr>
            <!-- Targets -->
            <tr>
              <td class="row-label">{{ lang === 'ru' ? 'Цели' : 'Targets' }}</td>
              <td v-for="id in compareUnitIds" :key="id">
                <div v-if="getUnitById(id)?.target_labels?.length" style="display:flex; gap:4px; flex-wrap:wrap; justify-content:center;">
                  <span v-for="lbl in getUnitById(id).target_labels" :key="lbl" class="target-badge" :class="'target-' + normalizeLayer(lbl)">
                    {{ formatTargetLabel(lbl) }}
                  </span>
                </div>
                <span v-else>-</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
