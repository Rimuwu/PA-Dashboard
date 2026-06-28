<script setup>
import { X } from '@lucide/vue';

defineProps({
  show: Boolean,
  lang: String,
  t: Function
});

defineEmits(['close']);
</script>

<template>
  <div v-if="show" class="modal-overlay" @click="$emit('close')">
    <div class="modal-content" @click.stop style="width: 500px;">
      <div class="modal-header">
        <h3 class="modal-title">{{ t('helpTitle') }}</h3>
        <button class="close-btn" @click="$emit('close')">
          <X :size="18" />
        </button>
      </div>
      <div class="modal-body" style="line-height: 1.6; font-size: 0.9rem; color: var(--text-secondary);">
        <ul style="padding-left: 20px; display: flex; flex-direction: column; gap: 10px;">
          <li><strong>{{ lang === 'ru' ? 'Инструкции' : 'Instructions' }}:</strong></li>
          <li>{{ t('help1') }}</li>
          <li>{{ t('help2') }}</li>
          <li>{{ t('help3') }}</li>
          <li>{{ t('help4') }}</li>
          <li>{{ t('help5') }}</li>
          <li><strong>Layout Sync:</strong> Save and Load layouts using JSON files or enjoy instant persistent auto-saving in your browser.</li>
        </ul>
      </div>
    </div>
  </div>
</template>
