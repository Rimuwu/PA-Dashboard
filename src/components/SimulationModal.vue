<script setup>
import { ref, watch, computed, nextTick } from 'vue';
import { X, Sword, Play, Pause, SkipForward, Save, Flame, Trophy, Skull } from '@lucide/vue';

const props = defineProps({
  animSim: Object,
  lang: String,
  t: Function,
  trackWidth: Number,
  getSvgX: Function,
  getSvgY: Function,
  getSvgRange: Function,
  getUnitLeftPercent: Function,
  getUnitTopPercent: Function,
  getVictoryEaseDetails: Function
});

const emit = defineEmits([
  'close', 'play', 'pause', 'step', 'setSpeed', 'downloadCard', 'seek'
]);

const animLogRef = ref(null);

// Alias for current tick
const currentTick = computed(() => {
  if (!props.animSim) return null;
  return props.animSim.sim?.ticks?.[props.animSim.currentTickIndex] || null;
});

const simTimeCur = computed(() => {
  return currentTick.value?.time ?? 0;
});

watch(() => props.animSim?.displayedLog?.length, () => {
  nextTick(() => {
    if (animLogRef.value) {
      animLogRef.value.scrollTop = animLogRef.value.scrollHeight;
    }
  });
});
</script>

<template>
  <div v-if="animSim" class="modal-overlay" @click="$emit('close')">
    <div class="modal-content battle-simulation-modal" @click.stop style="width: 800px; max-height: 95vh; display: flex; flex-direction: column; padding: 0;">
      
      <!-- Modal Header -->
      <div class="modal-header" style="padding: 16px 24px 12px; border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <Sword :size="16" style="color: var(--color-green); animation: pulse-slow 2s infinite;" />
          <h3 class="modal-title" style="margin: 0; font-family: var(--font-title); font-size: 1.05rem; letter-spacing: 0.03em;">
            {{ lang === 'ru' ? 'СИМУЛЯЦИЯ СРАЖЕНИЯ' : 'COMBAT SIMULATION PLAYER' }}
          </h3>
        </div>
        <button class="close-btn" @click="$emit('close')" style="background: transparent; border: none; color: var(--text-dim); cursor: pointer;"><X :size="18" /></button>
      </div>

      <!-- Playback Controls -->
      <div style="background: rgba(0,0,0,0.2); padding: 8px 24px; border-bottom: 1px solid rgba(255,255,255,0.04); display: flex; justify-content: space-between; align-items: center; gap: 16px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <button 
            @click="animSim.isPlaying ? $emit('pause') : $emit('play')" 
            class="btn" 
            style="padding: 4px 10px; font-size: 0.72rem; display: flex; align-items: center; gap: 4px; font-family: var(--font-title);"
            :style="{ borderColor: animSim.isPlaying ? 'var(--color-orange)' : 'var(--color-green)', color: animSim.isPlaying ? 'var(--color-orange)' : 'var(--color-green)' }"
          >
            <component :is="animSim.isPlaying ? Pause : Play" :size="12" />
            {{ animSim.isPlaying ? (lang === 'ru' ? 'Пауза' : 'Pause') : (lang === 'ru' ? 'Запуск' : 'Play') }}
          </button>
          
          <button 
            @click="$emit('step')" 
            :disabled="animSim.isPlaying"
            class="btn btn-secondary" 
            style="padding: 4px 8px; font-size: 0.72rem; display: flex; align-items: center; gap: 4px;"
          >
            <SkipForward :size="12" />
            {{ lang === 'ru' ? 'Шаг' : 'Step' }}
          </button>
        </div>

        <!-- Playback Progress Slider -->
        <div style="flex: 1; display: flex; align-items: center; gap: 12px; margin-top:-2px;">
          <span style="font-family: var(--font-title); font-size: 0.7rem; color: var(--text-dim); min-width: 32px;">{{ simTimeCur.toFixed(1) }}s</span>
          <input 
            type="range" 
            min="0" 
            :max="(animSim.sim.ticks?.length ?? 1) - 1" 
            :value="animSim.currentTickIndex"
            @input="e => $emit('seek', parseInt(e.target.value))"
            style="flex: 1; cursor: pointer; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px;"
          />
          <span style="font-family: var(--font-title); font-size: 0.7rem; color: var(--text-dim); min-width: 32px; text-align: right;">{{ animSim.sim.time }}s</span>
        </div>

        <!-- Playback speed control -->
        <div style="display: flex; align-items: center; gap: 6px;">
          <span style="font-family: var(--font-title); font-size: 0.65rem; color: var(--text-dim); text-transform: uppercase;">{{ lang === 'ru' ? 'Скорость' : 'Speed' }}</span>
          <select 
            :value="animSim.playbackSpeed" 
            @change="e => $emit('setSpeed', parseFloat(e.target.value))"
            class="sidebar-select" 
            style="padding: 2px 6px; font-size: 0.68rem; background: rgba(0,0,0,0.4);"
          >
            <option :value="0.5">0.5x</option>
            <option :value="1.0">1.0x</option>
            <option :value="1.5">1.5x</option>
            <option :value="2.0">2.0x</option>
            <option :value="3.0">3.0x</option>
          </select>
        </div>
      </div>

      <!-- Live HP Progress Bars -->
      <div style="padding: 10px 24px 0; display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.72rem;">
          <!-- Team A Health -->
          <div style="display: flex; flex-direction: column; gap: 2px; align-items: flex-start;">
            <span style="font-family: var(--font-title); font-weight: bold; color: #fff;">{{ animSim.sim.a.name }}</span>
            <span style="font-size: 0.65rem; color: var(--color-green);">{{ Math.round(animSim.aHpCur) }} / {{ animSim.sim.totalMaxHpA }} HP</span>
          </div>
          <!-- Team B Health -->
          <div style="display: flex; flex-direction: column; gap: 2px; align-items: flex-end;">
            <span style="font-family: var(--font-title); font-weight: bold; color: #fff;">{{ animSim.sim.b.name }}</span>
            <span style="font-size: 0.65rem; color: var(--color-red);">{{ Math.round(animSim.bHpCur) }} / {{ animSim.sim.totalMaxHpB }} HP</span>
          </div>
        </div>
        <div style="display: flex; gap: 4px; height: 6px; width: 100%;">
          <div style="flex: 1; background: rgba(255,255,255,0.06); border-radius: 3px; overflow: hidden; transform: scaleX(-1);">
            <div class="anim-hp-bar anim-hp-bar-a" :style="{ width: (animSim.sim.totalMaxHpA > 0 ? (animSim.aHpCur / animSim.sim.totalMaxHpA * 100) : 0) + '%' }"></div>
          </div>
          <div style="flex: 1; background: rgba(255,255,255,0.06); border-radius: 3px; overflow: hidden;">
            <div class="anim-hp-bar anim-hp-bar-b" :style="{ width: (animSim.sim.totalMaxHpB > 0 ? (animSim.bHpCur / animSim.sim.totalMaxHpB * 100) : 0) + '%' }"></div>
          </div>
        </div>
      </div>

      <!-- Visual Battlefield Track (2D) -->
      <div style="padding: 0 24px; margin-top: 10px; margin-bottom: 12px;">
        <div class="battlefield-track-2d" v-if="currentTick">
          <div class="bf2d-grid"></div>

          <!-- SVG layer: fire lines + range ellipses -->
          <svg class="bf2d-svg" :viewBox="'0 0 ' + trackWidth + ' 220'" :key="'svg-' + animSim.currentTickIndex">
            <!-- Weapon range circles (always shown) -->
            <template v-for="u in currentTick.aUnits" :key="'re-a-wrap-' + u.id">
              <template v-if="u.weapons && u.weapons.length > 0">
                <ellipse
                  v-for="(wpn, wIdx) in u.weapons"
                  :key="'re-a-' + u.id + '-' + wIdx"
                  class="bf2d-range-circle team-a"
                  :cx="getSvgX(u.x)"
                  :cy="getSvgY(u.y || 0)"
                  :rx="getSvgRange(wpn.range)"
                  :ry="getSvgRange(wpn.range)"
                  stroke-width="1"
                />
              </template>
              <ellipse
                v-else-if="u.maxRange > 0"
                class="bf2d-range-circle team-a"
                :cx="getSvgX(u.x)"
                :cy="getSvgY(u.y || 0)"
                :rx="getSvgRange(u.maxRange)"
                :ry="getSvgRange(u.maxRange)"
                stroke-width="1"
              />
            </template>
            <template v-for="u in currentTick.bUnits" :key="'re-b-wrap-' + u.id">
              <template v-if="u.weapons && u.weapons.length > 0">
                <ellipse
                  v-for="(wpn, wIdx) in u.weapons"
                  :key="'re-b-' + u.id + '-' + wIdx"
                  class="bf2d-range-circle team-b"
                  :cx="getSvgX(u.x)"
                  :cy="getSvgY(u.y || 0)"
                  :rx="getSvgRange(wpn.range)"
                  :ry="getSvgRange(wpn.range)"
                  stroke-width="1"
                />
              </template>
              <ellipse
                v-else-if="u.maxRange > 0"
                class="bf2d-range-circle team-b"
                :cx="getSvgX(u.x)"
                :cy="getSvgY(u.y || 0)"
                :rx="getSvgRange(u.maxRange)"
                :ry="getSvgRange(u.maxRange)"
                stroke-width="1"
              />
            </template>
            <!-- Vision range (dashed, more subtle) -->
            <ellipse
              v-for="u in currentTick.aUnits.filter(x => x.visionRadius > 0)" :key="'ve-a-' + u.id"
              class="bf2d-vision-circle"
              :cx="getSvgX(u.x)"
              :cy="getSvgY(u.y || 0)"
              :rx="getSvgRange(u.visionRadius)"
              :ry="getSvgRange(u.visionRadius)"
              stroke-width="1"
            />
            <ellipse
              v-for="u in currentTick.bUnits.filter(x => x.visionRadius > 0)" :key="'ve-b-' + u.id"
              class="bf2d-vision-circle"
              :cx="getSvgX(u.x)"
              :cy="getSvgY(u.y || 0)"
              :rx="getSvgRange(u.visionRadius)"
              :ry="getSvgRange(u.visionRadius)"
              stroke-width="1"
            />
            <!-- Radar range -->
            <ellipse
              v-for="u in currentTick.aUnits.filter(x => x.radarRadius > 0)" :key="'ra-a-' + u.id"
              class="bf2d-radar-circle"
              :cx="getSvgX(u.x)"
              :cy="getSvgY(u.y || 0)"
              :rx="getSvgRange(u.radarRadius)"
              :ry="getSvgRange(u.radarRadius)"
              stroke-width="1"
            />
            <ellipse
              v-for="u in currentTick.bUnits.filter(x => x.radarRadius > 0)" :key="'ra-b-' + u.id"
              class="bf2d-radar-circle"
              :cx="getSvgX(u.x)"
              :cy="getSvgY(u.y || 0)"
              :rx="getSvgRange(u.radarRadius)"
              :ry="getSvgRange(u.radarRadius)"
              stroke-width="1"
            />

            <!-- Fire lines: Team A shooting -->
            <line
              v-for="u in currentTick.aUnits.filter(x => x.firingAt)"
              :key="'fl-a-' + u.id"
              class="bf2d-fire-line team-a"
              :x1="getSvgX(u.x)"
              :y1="getSvgY(u.y || 0)"
              :x2="getSvgX(currentTick.bUnits.find(b => b.id === u.firingAt)?.x ?? (u.x + 80))"
              :y2="getSvgY(currentTick.bUnits.find(b => b.id === u.firingAt)?.y ?? 0)"
              stroke-width="1.5"
            />
            <!-- Fire lines: Team B shooting -->
            <line
              v-for="u in currentTick.bUnits.filter(x => x.firingAt)"
              :key="'fl-b-' + u.id"
              class="bf2d-fire-line team-b"
              :x1="getSvgX(u.x)"
              :y1="getSvgY(u.y || 0)"
              :x2="getSvgX(currentTick.aUnits.find(a => a.id === u.firingAt)?.x ?? (u.x - 80))"
              :y2="getSvgY(currentTick.aUnits.find(a => a.id === u.firingAt)?.y ?? 0)"
              stroke-width="1.5"
            />
          </svg>

          <!-- Render Unit icons -->
          <div class="bf2d-track-lanes">
            
            <!-- Team A units -->
            <div
              v-for="u in currentTick.aUnits"
              :key="'u-a-' + u.id"
              class="bf2d-unit team-a"
              :class="{ 'bf2d-dead': u.hp <= 0 }"
              :style="{ left: `${getUnitLeftPercent(u.x)}%`, top: `${getUnitTopPercent(u.y || 0)}%` }"
            >
              <div class="bf2d-hp-bar">
                <div class="bf2d-hp-fill team-a" :style="{ width: `${Math.max(0, (u.hp / u.maxHp) * 100)}%` }"></div>
              </div>
              <img :src="u.icon" :title="u.name" />
            </div>

            <!-- Team B units -->
            <div
              v-for="u in currentTick.bUnits"
              :key="'u-b-' + u.id"
              class="bf2d-unit team-b"
              :class="{ 'bf2d-dead': u.hp <= 0 }"
              :style="{ left: `${getUnitLeftPercent(u.x)}%`, top: `${getUnitTopPercent(u.y || 0)}%` }"
            >
              <div class="bf2d-hp-bar">
                <div class="bf2d-hp-fill team-b" :style="{ width: `${Math.max(0, (u.hp / u.maxHp) * 100)}%` }"></div>
              </div>
              <img :src="u.icon" :title="u.name" />
            </div>

            <!-- Fire flash effects for active shooters -->
            <template v-for="u in currentTick.aUnits" :key="'ff-a-' + u.id + '-' + animSim.currentTickIndex">
              <div
                v-if="u.firingAt"
                class="bf2d-fire-flash team-a"
                :style="{ left: `${getUnitLeftPercent(u.x)}%`, top: `${getUnitTopPercent(u.y || 0)}%` }"
              ></div>
            </template>
            <template v-for="u in currentTick.bUnits" :key="'ff-b-' + u.id + '-' + animSim.currentTickIndex">
              <div
                v-if="u.firingAt"
                class="bf2d-fire-flash team-b"
                :style="{ left: `${getUnitLeftPercent(u.x)}%`, top: `${getUnitTopPercent(u.y || 0)}%` }"
              ></div>
            </template>

          </div>
        </div>
      </div>

      <!-- Winner Banner (shown once done) -->
      <div v-if="animSim.done" style="margin: 0 24px 12px; display: flex; flex-direction: column; gap: 6px;">
        <div 
          style="padding:10px 16px; border-radius:6px; text-align:center; font-family:var(--font-title); font-size:0.95rem; font-weight:bold; border:1px solid; animation: fadeIn 0.4s ease;"
          :style="{
            borderColor: animSim.sim.winner === 'Draw' ? 'var(--color-orange)' : 'var(--color-green)',
            color: animSim.sim.winner === 'Draw' ? 'var(--color-orange)' : 'var(--color-green)',
            background: animSim.sim.winner === 'Draw' ? 'rgba(249,115,22,0.06)' : 'rgba(34,197,94,0.06)'
          }"
        >
          {{ animSim.sim.resultText }}
        </div>
        <div v-if="animSim.sim.winner !== 'Draw'" 
          style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 6px; font-size: 0.78rem;"
        >
          <span style="color: var(--text-dim);">{{ t('victoryEase') }}:</span>
          <span :style="{ color: getVictoryEaseDetails(animSim.sim.remainingHpPercent).color, fontWeight: 'bold' }">
            {{ getVictoryEaseDetails(animSim.sim.remainingHpPercent).text }} ({{ animSim.sim.remainingHpPercent }}%)
          </span>
        </div>
      </div>

      <!-- Survivor lists (shown once done) -->
      <div v-if="animSim.done" style="display:flex; gap:12px; padding: 0 24px 12px;">
        <div v-for="(side, key) in { A: animSim.sim.a, B: animSim.sim.b }" :key="key"
          style="flex:1; background: rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); border-radius:6px; padding:10px;"
        >
          <div style="font-family:var(--font-title); font-size:0.65rem; color:var(--text-dim); text-transform:uppercase; margin-bottom:8px;">{{ side.name }}</div>
          <div v-if="side.detailedUnits && side.detailedUnits.length > 0" style="display:flex; flex-direction:column; gap:4px; max-height:130px; overflow-y:auto;">
            <div v-for="u in side.detailedUnits" :key="u.name"
              style="display:flex; align-items:center; justify-content:space-between; padding:3px 6px; border-radius:3px;"
              :style="{ background: u.survivedCount > 0 ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)' }"
            >
              <div style="display:flex; align-items:center; gap:6px;">
                <img :src="u.icon" style="width:16px;height:16px;object-fit:contain;" />
                <span style="font-size:0.65rem; color:#cbd5e1; max-width:90px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" :title="u.name">{{ u.name }}</span>
              </div>
              <span style="font-family:var(--font-title); font-size:0.65rem; font-weight:bold;"
                :style="{ color: u.survivedCount > 0 ? 'var(--color-green)' : 'var(--color-red)' }"
              >{{ u.survivedCount }}/{{ u.initialCount }}</span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Download Card Button -->
      <div v-if="animSim.done" style="padding: 0 24px 12px; display: flex; justify-content: flex-end;">
        <button @click="$emit('downloadCard')" class="btn btn-secondary" style="display: flex; align-items: center; gap: 6px; font-size: 0.72rem; padding: 5px 12px; border-color: var(--color-cyan); color: var(--color-cyan); background: rgba(6,182,212,0.04); font-family: var(--font-title); font-weight: bold; cursor: pointer;">
          <Save :size="14" />
          {{ t('downloadCard') }}
        </button>
      </div>

      <!-- Live Event Log -->
      <div style="border-top:1px solid rgba(255,255,255,0.06); padding:10px 24px 16px; flex:1; overflow:hidden; display:flex; flex-direction:column;">
        <div style="font-family:var(--font-title); font-size:0.62rem; color:var(--text-dim); text-transform:uppercase; letter-spacing:0.08em; margin-bottom:8px;">
          {{ lang === 'ru' ? 'Лог событий' : 'Event Log' }}
        </div>
        <div class="anim-log-list" ref="animLogRef">
          <div v-for="(entry, i) in animSim.displayedLog" :key="i"
            class="log-entry anim-log-entry"
            :class="{ 'log-entry-new': i >= animSim.displayedLog.length - 3 }"
          >
            <span class="log-time">[{{ entry.time.toFixed(1) }}s]</span>
            <span v-if="entry.type === 'death'" style="display:inline-flex; align-items:center; gap:5px;">
              <Flame :size="12" style="color: var(--color-orange);" />
              <img :src="entry.icon" style="width:14px;height:14px;object-fit:contain;vertical-align:middle;" />
              <strong style="color:#fff; font-size:0.68rem;">{{ entry.unitName }}</strong>
              <span class="log-msg">{{ entry.event }}</span>
            </span>
            <span v-else-if="entry.type === 'victory'" style="display:inline-flex; align-items:center; gap:5px;">
              <Trophy :size="12" style="color: var(--color-green);" />
              <span class="log-msg" style="color: var(--color-green); font-weight: bold;">{{ entry.event }}</span>
            </span>
            <span v-else-if="entry.type === 'draw'" style="display:inline-flex; align-items:center; gap:5px;">
              <Skull :size="12" style="color: var(--color-orange);" />
              <span class="log-msg" style="color: var(--color-orange); font-weight: bold;">{{ entry.event }}</span>
            </span>
            <span v-else class="log-msg">{{ entry.event }}</span>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>
