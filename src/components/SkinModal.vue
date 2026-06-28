<script setup>
import { Palette, X } from '@lucide/vue';

defineProps({
  show: Boolean,
  allCommanders: Array,
  lang: String,
  skinCard: Object
});

defineEmits(['close', 'select']);
</script>

<template>
  <div v-if="show" class="modal-overlay" @click="$emit('close')">
    <div class="modal-content" @click.stop style="width: 680px; max-height: 80vh; display: flex; flex-direction: column;">
      <div class="modal-header">
        <h3 class="modal-title" style="display:flex; align-items:center; gap:8px;">
          <Palette :size="16" style="color:var(--color-orange);" />
          {{ lang === 'ru' ? 'Выбор скина Командира' : 'Select Commander Skin' }} ({{ allCommanders.length }})
        </h3>
        <button class="close-btn" @click="$emit('close')"><X :size="18" /></button>
      </div>
      
      <div class="modal-body" style="overflow-y: auto; padding: 16px; display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px;">
        <div 
          v-for="cmd in allCommanders" 
          :key="cmd.id"
          class="skin-grid-item"
          :class="{ active: skinCard && (skinCard.skinId === cmd.id || (!skinCard.skinId && skinCard.unitId === cmd.id)) }"
          @click="$emit('select', cmd)"
        >
          <img :src="$getIconUrl(cmd.icon)" class="skin-img" />
          <div class="skin-title">{{ cmd.name }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
