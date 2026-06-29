<script setup>
import { ref, computed, onMounted, watch, nextTick, shallowRef } from 'vue';
import CompareModal from './components/CompareModal.vue';
import CounterModal from './components/CounterModal.vue';
import SimulationModal from './components/SimulationModal.vue';
import HelpModal from './components/HelpModal.vue';
import SkinModal from './components/SkinModal.vue';
import { 
  normalizeLayer, 
  canTargetLayer, 
  getVictoryEaseDetails as extGetVictoryEaseDetails, 
  runBattleSimulation as extRunBattleSimulation 
} from './utils/battleSimulation.js';
import pregeneratedHardestCounters from './data/hardest_counters.json';
import { 
  Sword, 
  Trash2, 
  Save, 
  FolderOpen, 
  RefreshCw, 
  ZoomIn, 
  ZoomOut, 
  Plus, 
  Minus, 
  Info, 
  X,
  Search,
  LayoutGrid,
  Cpu,
  Plane,
  Anchor,
  Globe,
  Shield,
  Hammer,
  Activity,
  Crosshair,
  Factory,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  Edit2,
  Copy,
  PlusCircle,
  Unlink,
  Menu,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Zap,
  Settings,
  StickyNote,
  FileText,
  Palette,
  Target,
  Star,
  Trophy,
  Skull,
  Flame,
  Move,
  ShieldAlert,
  ShieldCheck,
  BarChart2,
  Tag,
  Undo2,
  ExternalLink,
  Clock
} from '@lucide/vue';
import unitsData from './data/units.json';
import ruLocale from './locales/ru.json';
import enLocale from './locales/en.json';

// Global constants
const CARD_WIDTH = 250;
const CARD_HEIGHT = 240; // approximate height for connection lines

// State variables
const units = ref(unitsData);
const searchQuery = ref('');
const selectedCategory = ref('all');
const activeSubFilter = ref('all'); // all, structures, mobile, combat, factories
const activeTargetFilters = ref([]); // e.g. ['land', 'air']
const activeTierFilters = ref([]);   // e.g. ['T1', 'T2']
const filtersCollapsed = ref(false);
const collapsedFilterGroups = ref({
  category: false,
  subFilter: false,
  target: false,
  tier: false,
  factory: false,
  sort: false,
  tags: false,
});
const sidebarSortBy = ref('default');
const sidebarSortOrder = ref('desc');
const activeTagFilters = ref([]);
const selectedFactoryFilter = ref('all');

const activeFlightTypeDropdown = ref(null);
const toggleFlightTypeDropdown = (type) => {
  activeFlightTypeDropdown.value = activeFlightTypeDropdown.value === type ? null : type;
};

const toggleTargetFilter = (id) => {
  const idx = activeTargetFilters.value.indexOf(id);
  if (idx > -1) {
    activeTargetFilters.value.splice(idx, 1);
  } else {
    activeTargetFilters.value.push(id);
  }
};

const toggleTierFilter = (id) => {
  const idx = activeTierFilters.value.indexOf(id);
  if (idx > -1) {
    activeTierFilters.value.splice(idx, 1);
  } else {
    activeTierFilters.value.push(id);
  }
};

const toggleTagFilter = (tag) => {
  const idx = activeTagFilters.value.indexOf(tag);
  if (idx > -1) {
    activeTagFilters.value.splice(idx, 1);
  } else {
    activeTagFilters.value.push(tag);
  }
};

const unitBuiltByFactory = (unit, factory) => {
  if (!factory || !factory.buildable_types) return false;
  
  const isMobile = unit.unit_types?.includes('UNITTYPE_Mobile');
  const isStructure = unit.unit_types?.includes('UNITTYPE_Structure');
  const isBasic = !unit.tier || unit.tier === 'T1';
  const isAdv = unit.tier === 'T2';
  const isTitan = unit.tier === 'Titan';
  
  const types = unit.unit_types || [];
  const fid = factory.id.toLowerCase();
  
  if (fid.includes('bot_factory_adv')) {
    return isMobile && types.includes('UNITTYPE_Bot') && (isAdv || isTitan);
  }
  if (fid.includes('bot_factory')) {
    return isMobile && types.includes('UNITTYPE_Bot') && isBasic;
  }
  if (fid.includes('vehicle_factory_adv')) {
    return isMobile && (types.includes('UNITTYPE_Tank') || types.includes('UNITTYPE_Vehicle')) && (isAdv || isTitan);
  }
  if (fid.includes('vehicle_factory')) {
    return isMobile && (types.includes('UNITTYPE_Tank') || types.includes('UNITTYPE_Vehicle')) && isBasic;
  }
  if (fid.includes('air_factory_adv')) {
    return isMobile && types.includes('UNITTYPE_Air') && (isAdv || isTitan);
  }
  if (fid.includes('air_factory')) {
    return isMobile && types.includes('UNITTYPE_Air') && isBasic;
  }
  if (fid.includes('naval_factory_adv')) {
    return isMobile && types.includes('UNITTYPE_Naval') && (isAdv || isTitan);
  }
  if (fid.includes('naval_factory')) {
    return isMobile && types.includes('UNITTYPE_Naval') && isBasic;
  }
  if (fid.includes('orbital_launcher')) {
    return isMobile && types.includes('UNITTYPE_Orbital') && isBasic;
  }
  if (fid.includes('orbital_factory')) {
    return isMobile && types.includes('UNITTYPE_Orbital') && (isAdv || isTitan);
  }
  
  const expr = factory.buildable_types.toLowerCase();
  if (expr.includes('bot') && types.includes('UNITTYPE_Bot')) return true;
  if (expr.includes('tank') && (types.includes('UNITTYPE_Tank') || types.includes('UNITTYPE_Vehicle'))) return true;
  if (expr.includes('air') && types.includes('UNITTYPE_Air')) return true;
  if (expr.includes('naval') && types.includes('UNITTYPE_Naval')) return true;
  if (expr.includes('orbital') && types.includes('UNITTYPE_Orbital')) return true;
  
  return false;
};

// Commander Skins State
const showSkinModal = ref(false);
const skinCard = ref(null);

const allCommanders = computed(() => {
  return unitsData.filter(u => u.category === 'commander' || u.id.includes('commander'));
});

const sidebarFactories = computed(() => {
  const unique = [];
  const ids = new Set();
  unitsData.forEach(u => {
    const isCommander = u.category === 'commander' || u.id.includes('commander');
    if (u.is_factory && !isCommander && !ids.has(u.id)) {
      ids.add(u.id);
      unique.push(u);
    }
  });
  return unique;
});

// Operational energy production/consumption helper
const getUnitEnergyStats = (unit) => {
  if (!unit) return null;
  const isStructure = unit.unit_types?.includes('UNITTYPE_Structure');
  const buildEnergy = isStructure ? unit.cost * 25 : 0;
  
  let energyProd = 0;
  let energyCons = 0;
  
  const uid = unit.id.toLowerCase();
  
  if (unit.unit_types?.includes('UNITTYPE_EnergyProduction')) {
    if (uid.includes('energy_plant_adv')) energyProd = 5000;
    else if (uid.includes('energy_plant')) energyProd = 600;
    else if (uid.includes('solar_drone')) energyProd = 15;
    else if (uid.includes('mining_platform')) energyProd = 4000;
    else if (uid.includes('solar_array')) energyProd = 1800;
    else energyProd = 600;
  } else if (unit.category === 'commander' || uid.includes('commander')) {
    energyProd = 2000;
  }
  
  if (unit.category === 'commander' || uid.includes('commander')) {
    energyCons = 0;
  } else if (uid.includes('radar_adv')) {
    energyCons = 4000;
  } else if (uid.includes('radar_satellite') || uid.includes('orbital_radar')) {
    energyCons = 500;
  } else if (uid.includes('radar')) {
    energyCons = 1000;
  } else if (uid.includes('teleporter')) {
    energyCons = 10000;
  } else if (uid.includes('bot_tesla')) {
    energyCons = 150;
  } else if (uid.includes('anti_orbital_armor') || uid.includes('umbrella')) {
    energyCons = 250;
  } else if (uid.includes('artillery_long') || uid.includes('holkins')) {
    energyCons = 2000;
  } else if (uid.includes('tactical_missile_launcher')) {
    energyCons = 1200;
  } else if (unit.is_builder || unit.is_factory) {
    const metalRate = unit.build_metal_rate || (unit.is_factory ? 15 : 10);
    energyCons = metalRate * 25;
  }
  
  return {
    buildEnergy,
    energyProd,
    energyCons
  };
};

const getUnitMetalStats = (unit) => {
  if (!unit) return { metalProd: 0, metalCons: 0 };
  let metalProd = 0;
  let metalCons = 0;
  
  const uid = unit.id.toLowerCase();
  
  if (uid.includes('metal_extractor_adv')) {
    metalProd = 28;
  } else if (uid.includes('metal_extractor')) {
    metalProd = 7;
  } else if (unit.category === 'commander' || uid.includes('commander')) {
    metalProd = 15;
  }
  
  if (unit.category === 'commander' || uid.includes('commander')) {
    metalCons = 0;
  } else if (unit.is_builder || unit.is_factory) {
    metalCons = unit.build_metal_rate || (unit.is_factory ? 15 : 10);
  }
  
  return {
    metalProd,
    metalCons
  };
};

const getCardHeight = (card) => {
  const spec = getUnitById(card.unitId);
  if (!spec) return 240;
  
  let h = 240; // Base height for normal units
  
  const energyStats = getUnitEnergyStats(spec);
  const metalStats = getUnitMetalStats(spec);
  
  const energyProd = energyStats?.energyProd || 0;
  const energyCons = energyStats?.energyCons || 0;
  const metalProd = metalStats?.metalProd || 0;
  const metalCons = metalStats?.metalCons || 0;
  const buildMetalRate = spec.build_metal_rate || 0;
  const isCmd = spec.category === 'commander' || spec.id?.includes('commander');
  const isBuilder = spec.is_builder || false;
  
  if (energyProd > 0) h += 20;
  if (energyCons > 0) h += 20;
  if (metalProd > 0) h += 20;
  if (metalCons > 0) h += 20;
  if (buildMetalRate > 0) h += 20;
  
  if (isCmd || isBuilder) {
    h += 42;
  }
  
  if (card.showFactoryMenu) {
    h += 120;
  }
  
  return h;
};

const getColumnMetalProd = (colId) => {
  const units = placedUnits.value.filter(u => u.timelineColId === colId);
  return units.reduce((sum, u) => {
    const spec = getUnitById(u.unitId);
    return sum + (getUnitMetalStats(spec)?.metalProd || 0) * u.count;
  }, 0);
};

const getColumnMetalCons = (colId) => {
  const units = placedUnits.value.filter(u => u.timelineColId === colId);
  return units.reduce((sum, u) => {
    const spec = getUnitById(u.unitId);
    return sum + (getUnitMetalStats(spec)?.metalCons || 0) * u.count;
  }, 0);
};

const getColumnEnergyProd = (colId) => {
  const units = placedUnits.value.filter(u => u.timelineColId === colId);
  return units.reduce((sum, u) => {
    const spec = getUnitById(u.unitId);
    return sum + (getUnitEnergyStats(spec)?.energyProd || 0) * u.count;
  }, 0);
};

const getColumnEnergyCons = (colId) => {
  const units = placedUnits.value.filter(u => u.timelineColId === colId);
  return units.reduce((sum, u) => {
    const spec = getUnitById(u.unitId);
    return sum + (getUnitEnergyStats(spec)?.energyCons || 0) * u.count;
  }, 0);
};

// Canvas build timelines state
const timelinePanels = ref([]);
const activeDragTimeline = ref(null);
const dragTimelineOffset = ref({ x: 0, y: 0 });
const lastMouseCanvasPos = ref({ x: 0, y: 0 });

const getColumnAbsolutePosition = (colId) => {
  for (const panel of timelinePanels.value) {
    let currentX = panel.x + 12; // 12px padding inside timeline panel
    const headerHeight = 40;
    const colGap = 12;
    for (const col of panel.columns) {
      if (col.id === colId) {
        return { x: currentX, y: panel.y + headerHeight };
      }
      currentX += (col.width || 250) + colGap;
    }
  }
  return null;
};

const getTimelineColumnAt = (canvasX, canvasY) => {
  for (const panel of timelinePanels.value) {
    let currentX = panel.x + 12;
    const headerHeight = 40;
    const colGap = 12;
    for (const col of panel.columns) {
      const colW = col.width || 250;
      const colH = panel.height || col.height || 420;
      
      let colSummaryRows = 2;
      if (getColumnMetalProd(col.id) > 0) colSummaryRows++;
      if (getColumnMetalCons(col.id) > 0) colSummaryRows++;
      if (getColumnEnergyProd(col.id) > 0) colSummaryRows++;
      if (getColumnEnergyCons(col.id) > 0) colSummaryRows++;
      const colSummaryHeight = colSummaryRows * 18 + 12;
      
      const left = currentX;
      const right = currentX + colW;
      const top = panel.y + headerHeight;
      const bottom = panel.y + headerHeight + colH - colSummaryHeight;
      
      if (canvasX >= left && canvasX <= right && canvasY >= top && canvasY <= bottom) {
        return {
          panel,
          col,
          relX: canvasX - left,
          relY: canvasY - top
        };
      }
      currentX += colW + colGap;
    }
  }
  return null;
};

const autoFitColumnSize = (col) => {
  const colUnits = placedUnits.value.filter(u => u.timelineColId === col.id);
  if (colUnits.length === 0) return;
  
  const CARD_W = 220;
  const CARD_H = 200;
  
  let maxRight = col.width || 250;
  let maxBottom = col.height || 420;
  
  colUnits.forEach(u => {
    const right = u.x + CARD_W + 16;
    const bottom = u.y + CARD_H + 80;
    if (right > maxRight) maxRight = right;
    if (bottom > maxBottom) maxBottom = bottom;
  });
  
  col.width = Math.ceil(maxRight);
  col.height = Math.ceil(maxBottom);
};

const createTimelinePanel = (x, y) => {
  pushToUndoStack();
  timelinePanels.value.push({
    uuid: generateUuid(),
    x: snapToGrid.value ? Math.round((x - 250) / 40) * 40 : x - 250,
    y: snapToGrid.value ? Math.round((y - 40) / 40) * 40 : y - 40,
    columns: [
      { id: generateUuid(), minute: 1, width: 250, height: 420 },
      { id: generateUuid(), minute: 2, width: 250, height: 420 }
    ]
  });
  saveToLocalStorage();
};

const addColumnToTimeline = (panel) => {
  pushToUndoStack();
  const nextMin = panel.columns.length > 0
    ? Math.max(...panel.columns.map(c => Number(c.minute) || 0)) + 1
    : 1;
  panel.columns.push({
    id: generateUuid(),
    minute: nextMin,
    width: 250,
    height: 420
  });
  saveToLocalStorage();
};

const removeColumnFromTimeline = (panel, colId) => {
  pushToUndoStack();
  panel.columns = panel.columns.filter(c => c.id !== colId);
  // Clean up units in this column
  placedUnits.value = placedUnits.value.filter(u => u.timelineColId !== colId);
  saveToLocalStorage();
};

const removeTimelinePanel = (uuid) => {
  pushToUndoStack();
  const panel = timelinePanels.value.find(p => p.uuid === uuid);
  if (panel) {
    const colIds = panel.columns.map(c => c.id);
    placedUnits.value = placedUnits.value.filter(u => !colIds.includes(u.timelineColId));
  }
  timelinePanels.value = timelinePanels.value.filter(p => p.uuid !== uuid);
  saveToLocalStorage();
};

const startResizeColumn = (panel, col, e) => {
  e.stopPropagation();
  e.preventDefault();
  pushToUndoStack();
  const startWidth = col.width || 250;
  const startHeight = panel.height || col.height || 420;
  const startX = e.clientX;
  const startY = e.clientY;
  
  const onMouseMove = (moveEvent) => {
    const dx = (moveEvent.clientX - startX) / canvasZoom.value;
    const dy = (moveEvent.clientY - startY) / canvasZoom.value;
    const newWidth = Math.max(240, startWidth + dx);
    const newHeight = Math.max(300, startHeight + dy);
    col.width = snapToGrid.value ? Math.round(newWidth / 40) * 40 : newWidth;
    panel.height = snapToGrid.value ? Math.round(newHeight / 40) * 40 : newHeight;
  };
  
  const onMouseUp = () => {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    saveToLocalStorage();
  };
  
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
};

const onTimelineMinuteChange = (panel, changedCol) => {
  const newVal = Number(changedCol.minute) || 0;
  panel.columns.forEach(col => {
    if (col.id !== changedCol.id && (Number(col.minute) || 0) >= newVal) {
      col.minute = (Number(col.minute) || 0) + 1;
    }
  });
  panel.columns.sort((a, b) => (Number(a.minute) || 0) - (Number(b.minute) || 0));
  saveToLocalStorage();
};

const onTimelineMousedown = (panel, e) => {
  if (e.target.closest('.qty-btn') || e.target.closest('input') || e.target.closest('button') || e.target.closest('.unit-card') || e.target.closest('.timeline-col-resize-handle')) return;
  
  if (e.button === 1) {
    startPanning(e);
    return;
  }
  if (e.button !== 0) return;
  
  const isHeader = e.target.closest('.timeline-panel-header');
  if (!isHeader) {
    startPanning(e);
    return;
  }
  
  e.stopPropagation();
  
  pushToUndoStack();
  activeDragTimeline.value = panel;
  
  const rect = canvasRef.value.getBoundingClientRect();
  const mouseCanvasX = (e.clientX - rect.left - canvasOffset.value.x) / canvasZoom.value + 25000;
  const mouseCanvasY = (e.clientY - rect.top - canvasOffset.value.y) / canvasZoom.value + 25000;
  
  dragTimelineOffset.value = {
    x: mouseCanvasX - panel.x,
    y: mouseCanvasY - panel.y
  };
  closeContextMenu();
};

const openSkinModal = (placedCard) => {
  skinCard.value = placedCard;
  showSkinModal.value = true;
};

const selectSkin = (skin) => {
  if (skinCard.value) {
    skinCard.value.skinId = skin.id;
    skinCard.value.skinIcon = skin.icon;
    skinCard.value.skinName = skin.name;
  }
  showSkinModal.value = false;
};

const formatTargetLabel = (lbl) => {
  if (!lbl) return '';
  const str = String(lbl).toLowerCase().replace('wl_', '').replace('horizontal', '');
  if (lang.value === 'ru') {
    if (str.includes('orbital')) return 'Орбита';
    if (str.includes('air')) return 'Воздух';
    if (str.includes('seafloor') || str.includes('underwater')) return 'Морское дно';
    if (str.includes('land') || str.includes('ground')) return 'Земля';
    if (str.includes('water') || str.includes('sea')) return 'Море';
    if (str.includes('anysurface') || str.includes('anyhorizontal')) return 'Суша/Море';
    return lbl;
  } else {
    if (str.includes('orbital')) return 'Orbital';
    if (str.includes('air')) return 'Air';
    if (str.includes('seafloor') || str.includes('underwater')) return 'Seafloor';
    if (str.includes('land') || str.includes('ground')) return 'Land';
    if (str.includes('water') || str.includes('sea')) return 'Sea';
    if (str.includes('anysurface') || str.includes('anyhorizontal')) return 'Surface';
    return lbl;
  }
};

// Canvas state
const canvasRef = ref(null);
const canvasOffset = ref({ x: 100, y: 100 });
const canvasZoom = ref(0.9);
const isPanning = ref(false);
const isResizingArea = ref(false);
const panStart = ref({ x: 0, y: 0 });

// Localization
const lang = ref('en'); // default to 'en'

// Grid & Snap options
const gridEnabled = ref(true);
const snapToGrid = ref(true);

// Selection by area (Shift+drag)
const selectedCardUuids = ref([]);
const isSelecting = ref(false);
const selectionBox = ref(null);

// Placed elements on canvas
const placedUnits = ref([]);
const groupAreas = ref([]);
const connections = ref([]);

// Notes on canvas
const notes = ref([]);
const activeDragNote = ref(null);
const dragNoteOffset = ref({ x: 0, y: 0 });

const getDefaultNotes = () => {
  let cx = 25000;
  let cy = 25000;
  
  if (canvasRef.value) {
    const rect = canvasRef.value.getBoundingClientRect();
    cx = (rect.width / 2 - canvasOffset.value.x) / canvasZoom.value + 25000;
    cy = (rect.height / 2 - canvasOffset.value.y) / canvasZoom.value + 25000;
  }
  
  const col1X = cx - 340;
  const col2X = cx + 20;
  const row1Y = cy - 390;
  const row2Y = cy - 90;
  const row3Y = cy + 310;

  return [
    // Column 1 (Russian)
    {
      uuid: 'default-note-ru',
      x: snapToGrid.value ? Math.round(col1X / 40) * 40 : col1X,
      y: snapToGrid.value ? Math.round(row1Y / 40) * 40 : row1Y,
      width: 320,
      height: 250,
      text: "# Понравился проект?\nПожалуйста, поставьте ⭐ [звезду на GitHub](https://github.com/Rimuwu/PA-Dashboard)!\nЭто очень поможет развитию проекта.\n\n⚙️ *Язык интерфейса можно сменить с помощью шестерёнки в правом верхнем углу.*",
      color: 'rgba(22, 78, 99, 0.45)', // Cyan glassmorphism
      zIndex: 10,
      isEditing: false
    },
    {
      uuid: 'default-note-info-ru',
      x: snapToGrid.value ? Math.round(col1X / 40) * 40 : col1X,
      y: snapToGrid.value ? Math.round(row2Y / 40) * 40 : row2Y,
      width: 320,
      height: 350,
      text: "# Общая информация\n- **PA: Dashboard** — интерактивный холст по Planetary Annihilation: Titans.\n- Сравнивайте характеристики юнитов в таблице.\n- Моделируйте бои 1 на 1 и групповые сражения.\n- Импортируйте и экспортируйте ваши схемы в JSON.",
      color: 'rgba(20, 83, 45, 0.45)', // Green glassmorphism
      zIndex: 10,
      isEditing: false
    },
    {
      uuid: 'default-note-hotkeys-ru',
      x: snapToGrid.value ? Math.round(col1X / 40) * 40 : col1X,
      y: snapToGrid.value ? Math.round(row3Y / 40) * 40 : row3Y,
      width: 320,
      height: 530,
      text: "# Горячие клавиши\n- **Панорамирование (Pan)**: Зажмите среднюю кнопку мыши (колесо) или левую кнопку мыши на пустом месте холста и перетащите.\n- **Масштаб (Zoom)**: Прокрутка колесиком мыши (Scroll).\n- **Выделение поштучно**: Зажмите `Shift` и кликайте по карточкам юнитов.\n- **Копирование**: Правый клик на карте -> *Дублировать карточку*.\n- **Создание связи**: Зажмите мышь на порт справа/слева карточки и протяните к другому юниту/области.\n- **Контекстное меню**: Правый клик на любой карточке, области или пустом месте холста открывает быстрые действия.",
      color: 'rgba(120, 53, 4, 0.45)', // Orange glassmorphism
      zIndex: 10,
      isEditing: false
    },
    
    // Column 2 (English)
    {
      uuid: 'default-note-en',
      x: snapToGrid.value ? Math.round(col2X / 40) * 40 : col2X,
      y: snapToGrid.value ? Math.round(row1Y / 40) * 40 : row1Y,
      width: 320,
      height: 250,
      text: "# Like the project?\nPlease leave a ⭐ [star on GitHub](https://github.com/Rimuwu/PA-Dashboard)!\nIt really helps the project grow.\n\n⚙️ *You can change the interface language using the gear icon in the top right.*",
      color: 'rgba(99, 22, 78, 0.45)', // Magenta glassmorphism
      zIndex: 10,
      isEditing: false
    },
    {
      uuid: 'default-note-info-en',
      x: snapToGrid.value ? Math.round(col2X / 40) * 40 : col2X,
      y: snapToGrid.value ? Math.round(row2Y / 40) * 40 : row2Y,
      width: 320,
      height: 350,
      text: "# General Info\n- **PA: Dashboard** — an interactive canvas for Planetary Annihilation: Titans.\n- Compare unit stats, simulate battles in real-time.\n- Build chain production and plan matchups.\n- Save and load your layout configurations using JSON.",
      color: 'rgba(20, 83, 45, 0.45)', // Green glassmorphism
      zIndex: 10,
      isEditing: false
    },
    {
      uuid: 'default-note-hotkeys-en',
      x: snapToGrid.value ? Math.round(col2X / 40) * 40 : col2X,
      y: snapToGrid.value ? Math.round(row3Y / 40) * 40 : row3Y,
      width: 320,
      height: 470,
      text: "# Hotkeys & Shortcuts\n**Pan Canvas**: Hold Middle Mouse Button (scroll wheel) or Left Mouse Button on empty canvas space and drag.\n\n**Zoom Canvas**: Use the mouse scroll wheel.\n\n**Multi-Select**: Hold `Shift` while clicking individual unit cards.\n\n**Duplicate Card**: Right-click on a card -> select *Duplicate card*.\n\n**Create Link**: Drag from a card connector port (left/right edge) and drop onto another unit or group area.\n\n**Context Menu**: Right-click on any card, area, or empty canvas space to access quick action menus.",
      color: 'rgba(120, 53, 4, 0.45)', // Orange glassmorphism
      zIndex: 10,
      isEditing: false
    }
  ];
};

const parseMarkdown = (md) => {
  if (!md) return '';
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  html = html.replace(/^# (.*?)$/gm, '<h1>$1</h1>');
  html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
  html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.*?)_/g, '<em>$1</em>');
  html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="markdown-link">$1</a>');
  html = html.replace(/^\s*-\s+(.*?)$/gm, '<li>$1</li>');
  html = html.replace(/\n/g, '<br>');
  return html;
};

const getFlightTypeExplanation = (type) => {
  if (!type) return '';
  const t = type.toLowerCase();
  if (lang.value === 'ru') {
    if (t === 'direct') return 'Стреляет по прямой линии. Быстрая доставка снаряда, но траектория может блокироваться рельефом, стенами и другими объектами.';
    if (t === 'ballistic') return 'Стреляет по дуге. Позволяет перестреливать через стены и холмы, но время полета снаряда больше.';
    if (t === 'seeking') return 'Самонаводящиеся ракеты, преследующие цель. Отличная точность, но могут быть перехвачены средствами ПРО/ПВО (например, Angel).';
    if (t === 'staged') return 'Ракеты с многоступенчатым разгоном. Обладают огромной дальностью и уроном, но имеют долгий запуск и могут быть перехвачены.';
  } else {
    if (t === 'direct') return 'Fires in a straight line. Fast projectile delivery, but trajectory can be blocked by terrain, walls, and other structures.';
    if (t === 'ballistic') return 'Fires in a ballistic arc. Allows shooting over walls and hills, but travel time is longer.';
    if (t === 'seeking') return 'Homing missiles that track the target. Perfect accuracy, but can be intercepted by missile defense systems (like the Angel).';
    if (t === 'staged') return 'Staged rocket launch. Long range and high damage, but has a slow startup and can be intercepted.';
  }
  return '';
};

const addNewNote = () => {
  pushToUndoStack();
  const id = generateUuid();
  const rect = canvasRef.value ? canvasRef.value.getBoundingClientRect() : { width: 1000, height: 600 };
  const centerX = (rect.width / 2 - canvasOffset.value.x) / canvasZoom.value - 160 + 25000;
  const centerY = (rect.height / 2 - canvasOffset.value.y) / canvasZoom.value - 90 + 25000;
  
  notes.value.push({
    uuid: id,
    x: snapToGrid.value ? Math.round(centerX / 40) * 40 : centerX,
    y: snapToGrid.value ? Math.round(centerY / 40) * 40 : centerY,
    width: 320,
    height: 180,
    text: '',
    color: 'rgba(255, 255, 255, 0.08)',
    zIndex: Math.max(...notes.value.map(n => n.zIndex || 10), 10) + 1,
    isEditing: true
  });
  saveToLocalStorage();
  
  nextTick(() => {
    const textareas = document.querySelectorAll('.note-textarea');
    if (textareas.length > 0) {
      textareas[textareas.length - 1].focus();
    }
  });
};

const editNote = (note) => {
  if (note.uuid.startsWith('default-note')) return;
  note.isEditing = true;
  nextTick(() => {
    const textareas = document.querySelectorAll('.note-textarea');
    textareas.forEach(ta => {
      if (ta.value === note.text) {
        ta.focus();
      }
    });
  });
};

const deleteNote = (noteUuid) => {
  if (noteUuid.startsWith('default-note')) return;
  pushToUndoStack();
  notes.value = notes.value.filter(n => n.uuid !== noteUuid);
  saveToLocalStorage();
};

const addNewNoteAt = (canvasX, canvasY) => {
  pushToUndoStack();
  const id = generateUuid();
  notes.value.push({
    uuid: id,
    x: snapToGrid.value ? Math.round(canvasX / 40) * 40 : canvasX,
    y: snapToGrid.value ? Math.round(canvasY / 40) * 40 : canvasY,
    width: 320,
    height: 180,
    text: '',
    color: 'rgba(255, 255, 255, 0.08)',
    zIndex: Math.max(...notes.value.map(n => n.zIndex || 10), 10) + 1,
    isEditing: true
  });
  saveToLocalStorage();
  
  nextTick(() => {
    const textareas = document.querySelectorAll('.note-textarea');
    if (textareas.length > 0) {
      textareas[textareas.length - 1].focus();
    }
  });
};

const insertFormatting = (noteUuid, type) => {
  const note = notes.value.find(n => n.uuid === noteUuid);
  if (!note) return;
  
  pushToUndoStack();
  
  let snippet = '';
  switch (type) {
    case 'h1': snippet = "\n# Заголовок\n"; break;
    case 'h2': snippet = "\n## Подзаголовок\n"; break;
    case 'bold': snippet = " **жирный текст** "; break;
    case 'italic': snippet = " *курсив* "; break;
    case 'list': snippet = "\n- Элемент списка\n"; break;
    case 'link': snippet = " [ссылка](https://github.com/Rimuwu/PA-Dashboard) "; break;
  }
  
  if (lang.value !== 'ru') {
    switch (type) {
      case 'h1': snippet = "\n# Heading\n"; break;
      case 'h2': snippet = "\n## Subheading\n"; break;
      case 'bold': snippet = " **bold text** "; break;
      case 'italic': snippet = " *italic text* "; break;
      case 'list': snippet = "\n- List item\n"; break;
      case 'link': snippet = " [link](https://github.com/Rimuwu/PA-Dashboard) "; break;
    }
  }
  
  note.isEditing = true;
  note.text = (note.text || '') + snippet;
  saveToLocalStorage();
  
  nextTick(() => {
    const textareas = document.querySelectorAll('.note-textarea');
    textareas.forEach(ta => {
      if (ta.value === note.text) {
        ta.focus();
        ta.setSelectionRange(ta.value.length, ta.value.length);
      }
    });
  });
};

const onNoteContextMenu = (note, e) => {
  if (note.uuid.startsWith('default-note')) return;
  const rect = canvasRef.value.getBoundingClientRect();
  const canvasX = (e.clientX - rect.left - canvasOffset.value.x) / canvasZoom.value + 25000;
  const canvasY = (e.clientY - rect.top - canvasOffset.value.y) / canvasZoom.value + 25000;
  
  contextMenu.value = {
    type: 'note',
    uuid: note.uuid,
    x: e.clientX,
    y: e.clientY,
    canvasX,
    canvasY
  };
};

const onNoteMousedown = (note, e) => {
  if (note.uuid.startsWith('default-note')) {
    if (e.button === 1) {
      startPanning(e);
    }
    return;
  }
  if (e.target.closest('.note-delete-btn') || e.target.closest('.note-textarea') || e.target.closest('.note-resize-handle') || e.target.closest('.color-dot') || e.target.closest('.markdown-link')) {
    if (e.button === 1) {
      startPanning(e);
    }
    return;
  }
  if (e.button === 1) {
    startPanning(e);
    return;
  }
  if (e.button !== 0) return;
  e.stopPropagation();
  pushToUndoStack();
  
  const maxZ = Math.max(...notes.value.map(n => n.zIndex || 10), 10);
  note.zIndex = maxZ + 1;
  
  activeDragNote.value = note;
  
  const rect = canvasRef.value.getBoundingClientRect();
  const mouseCanvasX = (e.clientX - rect.left - canvasOffset.value.x) / canvasZoom.value + 25000;
  const mouseCanvasY = (e.clientY - rect.top - canvasOffset.value.y) / canvasZoom.value + 25000;
  
  dragNoteOffset.value = {
    x: mouseCanvasX - note.x,
    y: mouseCanvasY - note.y
  };
};

const startResizeNote = (note, e) => {
  e.stopPropagation();
  e.preventDefault();
  pushToUndoStack();
  const startWidth = note.width || 320;
  const startHeight = note.height || 180;
  const startX = e.clientX;
  const startY = e.clientY;
  
  const onMouseMove = (moveEvent) => {
    const dx = (moveEvent.clientX - startX) / canvasZoom.value;
    const dy = (moveEvent.clientY - startY) / canvasZoom.value;
    const newWidth = Math.max(150, startWidth + dx);
    const newHeight = Math.max(100, startHeight + dy);
    note.width = snapToGrid.value ? Math.round(newWidth / 40) * 40 : newWidth;
    note.height = snapToGrid.value ? Math.round(newHeight / 40) * 40 : newHeight;
  };
  
  const onMouseUp = () => {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    saveToLocalStorage();
  };
  
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
};

// Drag & drop state from sidebar
const draggedUnit = ref(null);

// Active card dragging
const activeDragCard = ref(null);
const dragCardOffset = ref({ x: 0, y: 0 });

// Active Group Area dragging
const activeDragArea = ref(null);
const dragAreaOffset = ref({ x: 0, y: 0 });

// Connection dragging state
const activeConnectionDrag = ref(null);
const simulationResults = ref({});

// UI Popups & Modals
const activeBattleSimulation = ref(null);
const showHelpModal = ref(false);
const contextMenu = ref(null);
const sidebarHidden = ref(false);

// Full Unit Info Modal State
const showUnitDetailModal = ref(false);
const unitDetailSpec = ref(null);
const showCompareModal = ref(false);
const compareUnitIds = ref([]);
const counterSelectedNodeUuid = ref(null);
const showCounterModal = ref(false);
const counterRatings = ref([]);
const counterRatingsLoading = ref(false);
const hardestCountersCache = pregeneratedHardestCounters;

const undoStack = ref([]);

const pushToUndoStack = () => {
  undoStack.value.push(JSON.stringify({
    placedUnits: placedUnits.value,
    groupAreas: groupAreas.value,
    notes: notes.value,
    connections: connections.value
  }));
  if (undoStack.value.length > 50) {
    undoStack.value.shift();
  }
};

const undoLastAction = () => {
  if (undoStack.value.length === 0) return;
  const raw = undoStack.value.pop();
  try {
    const data = JSON.parse(raw);
    placedUnits.value = data.placedUnits || [];
    groupAreas.value = data.groupAreas || [];
    notes.value = data.notes || [];
    connections.value = data.connections || [];
    selectedCardUuids.value = [];
    calculateAllBattles();
    saveToLocalStorage();
  } catch (e) {
    console.error("Undo failed:", e);
  }
};

const openUnitDetail = (item) => {
  if (!item) return;
  if (typeof item === 'string') {
    unitDetailSpec.value = getUnitById(item);
  } else if (item.unitId) {
    unitDetailSpec.value = getUnitById(item.unitId);
  } else {
    unitDetailSpec.value = item;
  }
  if (unitDetailSpec.value) {
    showUnitDetailModal.value = true;
  }
};

const comparisonBestValues = ref({});
const comparisonWorstValues = ref({});

const calculateComparisonMetrics = () => {
  const specs = compareUnitIds.value.map(id => getUnitById(id)).filter(Boolean);
  if (specs.length === 0) {
    comparisonBestValues.value = {};
    comparisonWorstValues.value = {};
    return;
  }
  
  const properties = ['cost', 'health', 'dps', 'range', 'speed', 'turn_speed', 'vision', 'radar', 'build_energy', 'energy_prod', 'energy_cons', 'repair'];
  const bests = {};
  const worsts = {};
  
  properties.forEach(property => {
    const values = specs.map(s => {
      if (property === 'cost') return s.cost || 0;
      if (property === 'health') return s.health || 0;
      if (property === 'dps') return s.dps || 0;
      if (property === 'range') return s.range || 0;
      if (property === 'speed') return s.move_speed || 0;
      if (property === 'turn_speed') return s.turn_speed || 0;
      if (property === 'vision') return s.vision_radius || 0;
      if (property === 'radar') return s.radar_radius || 0;
      if (property === 'build_energy') return s.unit_types?.includes('UNITTYPE_Structure') ? s.cost * 25 : 0;
      if (property === 'energy_prod') return getUnitEnergyStats(s)?.energyProd || 0;
      if (property === 'energy_cons') return getUnitEnergyStats(s)?.energyCons || 0;
      if (property === 'repair') return s.is_builder ? s.build_metal_rate || 0 : 0;
      return 0;
    });
    
    const worstValues = specs.map(s => {
      if (property === 'build_energy') return s.unit_types?.includes('UNITTYPE_Structure') ? s.cost * 25 : 99999999;
      return values[specs.indexOf(s)];
    });
    
    if (['cost', 'build_energy'].includes(property)) {
      bests[property] = Math.min(...values);
      worsts[property] = Math.max(...worstValues);
    } else {
      bests[property] = Math.max(...values);
      worsts[property] = Math.min(...values);
    }
  });
  
  comparisonBestValues.value = bests;
  comparisonWorstValues.value = worsts;
};

const getBestValue = (property, order = 'max') => {
  return comparisonBestValues.value[property];
};

const getWorstValue = (property, order = 'max') => {
  return comparisonWorstValues.value[property];
};

// Simulation Settings Modal State
const showSimSettingsModal = ref(false);
const showConnectionSettingsModal = ref(false);
const activeEditingConnection = ref(null);
const simSettings = ref({
  maxTime: 120,
  playbackSpeed: 4.0,
  logVerbosity: 'all',
  initialDistance: 300
});

const showConnectionSettings = (conn) => {
  if (!conn) return;
  if (!conn.settings) {
    conn.settings = {
      initialDistance: simSettings.value.initialDistance || 300,
      showRanges: false,
      positions: {}
    };
  }
  activeEditingConnection.value = conn;
  showConnectionSettingsModal.value = true;
};

// Get 2D position for a stack in a connection (returns {x, y})
const getConnPos2D = (conn, stackUuid, defaultX, defaultY = 0) => {
  if (!conn || !conn.settings) return { x: defaultX, y: defaultY };
  if (!conn.settings.positions) conn.settings.positions = {};
  const stored = conn.settings.positions[stackUuid];
  if (stored === undefined) {
    conn.settings.positions[stackUuid] = { x: defaultX, y: defaultY };
    return { x: defaultX, y: defaultY };
  }
  // backward compat: if stored as plain number, migrate to {x,y}
  if (typeof stored === 'number') {
    conn.settings.positions[stackUuid] = { x: stored, y: 0 };
    return { x: stored, y: 0 };
  }
  return stored;
};

// Set 2D position for a stack
const setConnPos2D = (conn, stackUuid, x, y, skipSave = false) => {
  if (!conn || !conn.settings) return;
  if (!conn.settings.positions) conn.settings.positions = {};
  conn.settings.positions[stackUuid] = { x: Number(x), y: Number(y) };
  if (!skipSave) {
    saveToLocalStorage();
  }
};

// Dragging state for 2D canvas tokens
const canvasDragState = ref(null); // { conn, stackUuid, offsetX, offsetY, rect, teamSide }

const startTokenDrag = (e, conn, stackUuid, pos2d, teamSide) => {
  e.preventDefault();
  const el = e.currentTarget.closest('.bf-canvas-wrap');
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const dist = conn.settings.initialDistance || 300;
  const totalWidth = dist * 2 + 300;
  
  // Calculate current click coordinates in game space
  const clickMx = e.clientX - rect.left;
  const clickMy = e.clientY - rect.top;
  const clickXGame = (clickMx / rect.width) * totalWidth - dist - 150;
  const clickYGame = (clickMy / rect.height) * 200 - 100;
  
  // click offset relative to token's stored coordinates
  const offsetX = clickXGame - pos2d.x;
  const offsetY = clickYGame - pos2d.y;

  canvasDragState.value = {
    conn, stackUuid, teamSide, offsetX, offsetY, rect
  };
  
  const onMove = (me) => {
    const s = canvasDragState.value;
    if (!s) return;
    const distVal = s.conn.settings.initialDistance || 300;
    const totalW = distVal * 2 + 300;
    const W = s.rect.width;
    const H = s.rect.height;
    
    // Mouse coords relative to canvas bounding box
    const mx = me.clientX - s.rect.left;
    const my = me.clientY - s.rect.top;
    
    // Project back to game units, subtracting initial click offset
    let nx = (mx / W) * totalW - distVal - 150 - s.offsetX;
    let ny = (my / H) * 200 - 100 - s.offsetY;
    
    // Clamp: team A left half (x <= 0), team B right half (x >= 0)
    if (s.teamSide === 'A') nx = Math.min(0, Math.max(-distVal, nx));
    else nx = Math.max(0, Math.min(distVal, nx));
    ny = Math.max(-100, Math.min(100, ny));
    
    // Pass skipSave=true during mousemove for perfect smooth dragging!
    setConnPos2D(s.conn, s.stackUuid, Math.round(nx), Math.round(ny), true);
  };
  
  const onUp = () => {
    canvasDragState.value = null;
    saveToLocalStorage(); // save final positions on drag end
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
};

// Convert game coords to canvas pixel position (percent)
const coordToCanvasPercent = (conn, x, y) => {
  const dist = conn?.settings?.initialDistance || 300;
  const totalWidth = dist * 2 + 300; // game coordinate span
  const totalHeight = 200; // game Y span (-100 to +100)
  const xPct = ((x + dist + 150) / totalWidth) * 100;
  const yPct = ((y + 100) / totalHeight) * 100;
  return { xPct: Math.max(2, Math.min(98, xPct)), yPct: Math.max(2, Math.min(98, yPct)) };
};

// Animated simulation state - shallowRef to avoid Vue deep-tracking the large sim object
const animSim = shallowRef(null); // { sim, currentTickIndex, displayedLog, aHpCur, bHpCur, isPlaying, intervalId }
const animCurrentTick = computed(() => {
  if (!animSim.value || !animSim.value.sim || !animSim.value.sim.ticks) return null;
  const idx = Math.min(animSim.value.currentTickIndex, animSim.value.sim.ticks.length - 1);
  return animSim.value.sim.ticks[idx] || null;
});

// Convert game x coord → left% on the battlefield track
const getUnitLeftPercent = (x) => {
  if (!animSim.value) return 50;
  const connUuid = animSim.value.connUuid;
  const conn = connections.value.find(c => c.uuid === connUuid);
  const dist = conn?.settings?.initialDistance || simSettings.value.initialDistance || 300;
  const minX = -(dist + 150);
  const maxX =  (dist + 150);
  const pct = ((x - minX) / (maxX - minX)) * 100;
  return Math.max(2, Math.min(98, pct));
};

// Convert game y coord → top% on the battlefield track
const getUnitTopPercent = (y) => {
  // Y range: -100 to +100 in game space, mapped to 10%–90%
  const pct = ((y + 100) / 200) * 80 + 10;
  return Math.max(5, Math.min(95, pct));
};

// Track container width and ref for SVG layout
const bfTrack = ref(null);
const trackWidth = ref(472);

// Update track width when simulated battlefield modal loads
watch(() => animSim.value, async (newVal) => {
  if (newVal) {
    await nextTick();
    if (bfTrack.value) {
      const el = bfTrack.value.$el.querySelector('.battlefield-track-2d');
      trackWidth.value = el ? el.clientWidth || 752 : 752;
    }
  }
});

// Update width on window resize
const updateTrackWidth = () => {
  if (bfTrack.value) {
    const el = bfTrack.value.$el.querySelector('.battlefield-track-2d');
    trackWidth.value = el ? el.clientWidth || 752 : 752;
  }
};
onMounted(() => {
  window.addEventListener('resize', updateTrackWidth);
  window.addEventListener('click', () => {
    activeFlightTypeDropdown.value = null;
  });
});

// Get absolute horizontal X coordinate in SVG viewBox space
const getSvgX = (x) => {
  return (getUnitLeftPercent(x) / 100) * trackWidth.value;
};

// Get absolute vertical Y coordinate in SVG viewBox space
const getSvgY = (y) => {
  return (getUnitTopPercent(y) / 100) * 220;
};

// Get SVG circle radius for weapon range — map game distance to SVG pixel space
const getSvgRange = (range) => {
  if (!animSim.value || !range || range <= 0) return 0;
  const connUuid = animSim.value.connUuid;
  const conn = connections.value.find(c => c.uuid === connUuid);
  const dist = conn?.settings?.initialDistance || simSettings.value.initialDistance || 300;
  // The full X span is from -(dist+150) to +(dist+150) mapped to trackWidth px
  const totalSpan = (dist + 150) * 2;
  return (range / totalSpan) * trackWidth.value;
};

const isShowRangesEnabled = computed(() => {
  if (!animSim.value) return false;
  const conn = connections.value.find(c => c.uuid === animSim.value.connUuid);
  return conn?.settings?.showRanges || false;
});

// Translation Dictionary
const translations = {
  en: enLocale,
  ru: ruLocale
};

const t = (key) => {
  return translations[lang.value][key] || key;
};

// Translated unit description helper
const getUnitDesc = (unit) => {
  if (!unit) return '';
  const key = 'unit_desc_' + unit.id;
  return translations[lang.value][key] || unit.description || '';
};

// Parse weapon target priority string into renderable tokens
const parsePriorityString = (prio) => {
  if (!prio) return [];
  const tokens = prio.match(/([a-zA-Z0-9_]+|&|\||\(|\)|-)/g) || [];
  return tokens.map(token => {
    const isWord = /^[a-zA-Z0-9_]+$/.test(token);
    let label = token;
    if (isWord) {
      const tKey = 'prio_' + token;
      const translated = translations[lang.value][tKey];
      if (translated && translated !== tKey) label = translated;
    }
    return { text: label, isWord };
  });
};

// Generate UUID helper
const generateUuid = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Filter units for sidebar list
const filteredUnits = computed(() => {
  const firstCmdId = allCommanders.value.length > 0 ? allCommanders.value[0].id : null;

  const filtered = units.value.filter(u => {
    // 0. Deduplicate Commanders in sidebar: only show the first commander specimen!
    const isCmd = u.category === 'commander' || u.id.includes('commander');
    if (isCmd && u.id !== firstCmdId) {
      return false;
    }

    // 1. Text search
    const matchesSearch = u.name.toLowerCase().includes(searchQuery.value.toLowerCase()) || 
                          u.description.toLowerCase().includes(searchQuery.value.toLowerCase());
    
    // 2. Category tab
    let matchesCategory = false;
    if (selectedCategory.value === 'all') {
      matchesCategory = true;
    } else {
      matchesCategory = u.category === selectedCategory.value;
    }
    
    // 3. Sub filter
    let matchesSub = true;
    if (activeSubFilter.value === 'structures') {
      matchesSub = u.unit_types.includes('UNITTYPE_Structure');
    } else if (activeSubFilter.value === 'mobile') {
      matchesSub = u.unit_types.includes('UNITTYPE_Mobile');
    } else if (activeSubFilter.value === 'combat') {
      matchesSub = u.dps > 0;
    } else if (activeSubFilter.value === 'factories') {
      matchesSub = u.is_factory;
    }

    // 4. Target Filter (Kого атакуют) - Multi-select
    let matchesTarget = true;
    if (activeTargetFilters.value.length > 0) {
      if (!u.weapons || u.weapons.length === 0) {
        matchesTarget = false;
      } else {
        matchesTarget = u.weapons.some(w => 
          activeTargetFilters.value.some(tf => canTargetLayer([tf], w.target_layers))
        );
      }
    }

    // 5. Tier Filter - Multi-select
    let matchesTier = true;
    if (activeTierFilters.value.length > 0) {
      matchesTier = activeTierFilters.value.includes(u.tier || 'T1');
    }
    
    // 6. Factory Filter
    let matchesFactory = true;
    if (selectedFactoryFilter.value && selectedFactoryFilter.value !== 'all') {
      if (selectedFactoryFilter.value === 'commander') {
        const isStructure = u.unit_types?.includes('UNITTYPE_Structure');
        const isBasic = !u.tier || u.tier === 'T1';
        matchesFactory = isStructure && isBasic;
      } else {
        const factory = units.value.find(f => f.id === selectedFactoryFilter.value);
        if (factory) {
          matchesFactory = unitBuiltByFactory(u, factory);
        }
      }
    }

    // 7. Tags Filter
    let matchesTags = true;
    if (activeTagFilters.value.length > 0) {
      matchesTags = activeTagFilters.value.every(tag => {
        return u.unit_types?.includes('UNITTYPE_' + tag);
      });
    }
    
    return matchesSearch && matchesCategory && matchesSub && matchesTarget && matchesTier && matchesFactory && matchesTags;
  });

  if (sidebarSortBy.value && sidebarSortBy.value !== 'default') {
    filtered.sort((a, b) => {
      if (sidebarSortBy.value === 'name') {
        const nameA = t('unit_name_' + a.id).toLowerCase();
        const nameB = t('unit_name_' + b.id).toLowerCase();
        return sidebarSortOrder.value === 'asc' 
          ? nameA.localeCompare(nameB) 
          : nameB.localeCompare(nameA);
      }
      
      let valA = 0;
      let valB = 0;
      if (sidebarSortBy.value === 'cost') {
        valA = a.cost || 0;
        valB = b.cost || 0;
      } else if (sidebarSortBy.value === 'health') {
        valA = a.health || 0;
        valB = b.health || 0;
      } else if (sidebarSortBy.value === 'dps') {
        valA = a.dps || 0;
        valB = b.dps || 0;
      } else if (sidebarSortBy.value === 'range') {
        valA = a.range || 0;
        valB = b.range || 0;
      } else if (sidebarSortBy.value === 'speed') {
        valA = a.move_speed || 0;
        valB = b.move_speed || 0;
      } else if (sidebarSortBy.value === 'vision') {
        valA = a.vision_radius || 0;
        valB = b.vision_radius || 0;
      }
      
      return sidebarSortOrder.value === 'asc' ? valA - valB : valB - valA;
    });
  }

  return filtered;
});

// Categories list
const categories = [
  { id: 'all', label: 'All' },
  { id: 'land', label: 'Land' },
  { id: 'air', label: 'Air' },
  { id: 'sea', label: 'Sea' },
  { id: 'orbital', label: 'Orbital' },
  { id: 'commander', label: 'Cmd' }
];

// Icon mapping helper for categories
const getCategoryIcon = (catId) => {
  switch (catId) {
    case 'all': return LayoutGrid;
    case 'land': return Cpu;
    case 'air': return Plane;
    case 'sea': return Anchor;
    case 'orbital': return Globe;
    case 'commander': return Shield;
    default: return LayoutGrid;
  }
};

// Helper to look up unit spec details by ID
const getUnitById = (id) => {
  return units.value.find(u => u.id === id);
};

const getUnitTier = (unit) => {
  if (!unit) return '';
  if (unit.unit_types && unit.unit_types.includes('UNITTYPE_Commander')) return lang.value === 'ru' ? 'Ком.' : 'Cmd';
  if (unit.unit_types && unit.unit_types.includes('UNITTYPE_Advanced')) return 'T2';
  return 'T1';
};

const getUnitTargets = (unit) => {
  if (!unit || !unit.weapons || unit.weapons.length === 0) return lang.value === 'ru' ? 'Нет' : 'None';
  const targets = new Set();
  unit.weapons.forEach(w => {
    if (w.target_layers) {
      w.target_layers.forEach(l => {
        if (l === 'WL_Air') targets.add(lang.value === 'ru' ? 'Воздух' : 'Air');
        else if (l === 'WL_Orbital') targets.add(lang.value === 'ru' ? 'Орбита' : 'Orbit');
        else if (l === 'WL_WaterSurface' || l === 'WL_Seafloor') targets.add(lang.value === 'ru' ? 'Вода' : 'Water');
        else if (l === 'WL_LandHorizontal') targets.add(lang.value === 'ru' ? 'Земля' : 'Land');
      });
    }
  });
  return Array.from(targets).join(', ');
};

const getUnitRateOfFire = (unit) => {
  if (!unit || !unit.weapons || unit.weapons.length === 0) return '0/s';
  const rofs = unit.weapons.map(w => `${w.rate_of_fire}/s`);
  return Array.from(new Set(rofs)).join(', ');
};

// Drag and drop from sidebar to canvas
const onSidebarDragStart = (unit, e) => {
  draggedUnit.value = unit;
  e.dataTransfer.effectAllowed = 'copy';
  e.dataTransfer.setData('text/plain', unit.id);
  e.dataTransfer.setData('drag-source', 'sidebar');
};

const onCanvasDrop = (e) => {
  e.preventDefault();
  e.stopPropagation(); // Stop double drop bubble triggers!
  const unitId = e.dataTransfer.getData('text/plain');
  const unit = draggedUnit.value || getUnitById(unitId);
  if (!unit) return;
  
  const rect = canvasRef.value.getBoundingClientRect();
  const dropX = e.clientX - rect.left;
  const dropY = e.clientY - rect.top;
  
  const canvasX = (dropX - canvasOffset.value.x) / canvasZoom.value + 25000;
  const canvasY = (dropY - canvasOffset.value.y) / canvasZoom.value + 25000;
  
  const rawX = canvasX - CARD_WIDTH / 2;
  const rawY = canvasY - 80;
  const finalX = snapToGrid.value ? Math.round(rawX / 40) * 40 : rawX;
  const finalY = snapToGrid.value ? Math.round(rawY / 40) * 40 : rawY;
  
  pushToUndoStack();
  
  const dropCol = getTimelineColumnAt(canvasX, canvasY);
  if (dropCol) {
    const CARD_W = 220;
    const CARD_H = 200;
    const relX = Math.max(0, Math.min((dropCol.col.width || 250) - CARD_W, dropCol.relX - CARD_W/2));
    const relY = Math.max(0, Math.min((dropCol.col.height || 420) - CARD_H - 45, dropCol.relY - 40));
    placedUnits.value.push({
      uuid: generateUuid(),
      unitId: unit.id,
      x: relX,
      y: relY,
      count: 1,
      timelineColId: dropCol.col.id,
      showFactoryMenu: false
    });
    autoFitColumnSize(dropCol.col);
  } else {
    placedUnits.value.push({
      uuid: generateUuid(),
      unitId: unit.id,
      x: finalX,
      y: finalY,
      count: 1,
      showFactoryMenu: false
    });
  }
  
  draggedUnit.value = null;
  saveToLocalStorage();
};

// Panning and marquee selection on background click
const startPanning = (e) => {
  if (e.button !== 0 && e.button !== 1) return; // Allow left-click or middle-click
  
  if (e.button === 1) {
    e.preventDefault(); // Prevent middle-click auto-scroll
  }
  
  // If clicked inside interactive components, bypass canvas panning
  const isInteractive = 
    e.target.closest('.unit-card') || 
    e.target.closest('.group-area-header') || 
    e.target.closest('.group-area-resize-handle') || 
    e.target.closest('.group-area-action-btn') || 
    e.target.closest('.group-area-title-input') || 
    e.target.closest('.connection-node') || 
    e.target.closest('.context-menu') || 
    e.target.closest('.controls-bar') || 
    e.target.closest('.qty-controller') || 
    e.target.closest('.btn') || 
    e.target.closest('.connection-badge') || 
    e.target.closest('.factory-popup');

  // Allow middle click to pan anywhere, but left-click is blocked by interactive controls
  if (isInteractive && e.button !== 1) {
    return;
  }
  
  const rect = canvasRef.value.getBoundingClientRect();
  const canvasX = (e.clientX - rect.left - canvasOffset.value.x) / canvasZoom.value + 25000;
  const canvasY = (e.clientY - rect.top - canvasOffset.value.y) / canvasZoom.value + 25000;

  if (e.shiftKey && e.button === 0) { // Only shift + left-click starts marquee selection
    isSelecting.value = true;
    selectionBox.value = {
      startX: canvasX,
      startY: canvasY,
      currentX: canvasX,
      currentY: canvasY
    };
    selectedCardUuids.value = [];
  } else {
    isPanning.value = true;
    panStart.value = {
      x: e.clientX - canvasOffset.value.x,
      y: e.clientY - canvasOffset.value.y
    };
    if (e.button === 0 && !e.shiftKey) {
      selectedCardUuids.value = [];
    }
  }
  closeContextMenu();
};

const panCanvas = (e) => {
  const rect = canvasRef.value.getBoundingClientRect();
  const mouseCanvasX = (e.clientX - rect.left - canvasOffset.value.x) / canvasZoom.value + 25000;
  const mouseCanvasY = (e.clientY - rect.top - canvasOffset.value.y) / canvasZoom.value + 25000;
  lastMouseCanvasPos.value = { x: mouseCanvasX, y: mouseCanvasY };
  
  if (isPanning.value) {
    canvasOffset.value = {
      x: e.clientX - panStart.value.x,
      y: e.clientY - panStart.value.y
    };
  } else if (isSelecting.value && selectionBox.value) {
    selectionBox.value.currentX = mouseCanvasX;
    selectionBox.value.currentY = mouseCanvasY;
    
    const minX = Math.min(selectionBox.value.startX, selectionBox.value.currentX);
    const maxX = Math.max(selectionBox.value.startX, selectionBox.value.currentX);
    const minY = Math.min(selectionBox.value.startY, selectionBox.value.currentY);
    const maxY = Math.max(selectionBox.value.startY, selectionBox.value.currentY);
    
    selectedCardUuids.value = placedUnits.value.filter(u => {
      let absX = u.x;
      let absY = u.y;
      if (u.timelineColId) {
        const dropCol = getColumnAbsolutePosition(u.timelineColId);
        if (dropCol) {
          absX = dropCol.x + u.x;
          absY = dropCol.y + u.y;
        }
      }
      return !(
        absX + CARD_WIDTH < minX ||
        absX > maxX ||
        absY + CARD_HEIGHT < minY ||
        absY > maxY
      );
    }).map(u => u.uuid);
  } else if (activeDragCard.value) {
    const rawX = mouseCanvasX - dragCardOffset.value.x;
    const rawY = mouseCanvasY - dragCardOffset.value.y;
    
    if (snapToGrid.value) {
      const snapX = Math.round(rawX / 40) * 40;
      const snapY = Math.round(rawY / 40) * 40;
      const dx = snapX - activeDragCard.value.x;
      const dy = snapY - activeDragCard.value.y;
      
      if (dx !== 0 || dy !== 0) {
        placedUnits.value.forEach(u => {
          if (selectedCardUuids.value.includes(u.uuid)) {
            u.x += dx;
            u.y += dy;
          }
        });
        if (!selectedCardUuids.value.includes(activeDragCard.value.uuid)) {
          activeDragCard.value.x = snapX;
          activeDragCard.value.y = snapY;
        }
      }
    } else {
      const dx = rawX - activeDragCard.value.x;
      const dy = rawY - activeDragCard.value.y;
      placedUnits.value.forEach(u => {
        if (selectedCardUuids.value.includes(u.uuid)) {
          u.x += dx;
          u.y += dy;
        }
      });
      if (!selectedCardUuids.value.includes(activeDragCard.value.uuid)) {
        activeDragCard.value.x = rawX;
        activeDragCard.value.y = rawY;
      }
    }
  } else if (activeDragArea.value) {
    const rawX = mouseCanvasX - dragAreaOffset.value.x;
    const rawY = mouseCanvasY - dragAreaOffset.value.y;
    
    const nextX = snapToGrid.value ? Math.round(rawX / 40) * 40 : rawX;
    const nextY = snapToGrid.value ? Math.round(rawY / 40) * 40 : rawY;
    
    const dx = nextX - activeDragArea.value.x;
    const dy = nextY - activeDragArea.value.y;
    
    if (dx !== 0 || dy !== 0) {
      const insideUnits = getAreaUnits(activeDragArea.value.uuid);
      insideUnits.forEach(u => {
        u.x += dx;
        u.y += dy;
      });
      activeDragArea.value.x = nextX;
      activeDragArea.value.y = nextY;
    }
  } else if (activeConnectionDrag.value) {
    activeConnectionDrag.value.currentX = mouseCanvasX;
    activeConnectionDrag.value.currentY = mouseCanvasY;
  } else if (activeDragTimeline.value) {
    const rawX = mouseCanvasX - dragTimelineOffset.value.x;
    const rawY = mouseCanvasY - dragTimelineOffset.value.y;
    
    activeDragTimeline.value.x = snapToGrid.value ? Math.round(rawX / 40) * 40 : rawX;
    activeDragTimeline.value.y = snapToGrid.value ? Math.round(rawY / 40) * 40 : rawY;
  } else if (activeDragNote.value) {
    const rawX = mouseCanvasX - dragNoteOffset.value.x;
    const rawY = mouseCanvasY - dragNoteOffset.value.y;
    
    activeDragNote.value.x = snapToGrid.value ? Math.round(rawX / 40) * 40 : rawX;
    activeDragNote.value.y = snapToGrid.value ? Math.round(rawY / 40) * 40 : rawY;
  }
};

const stopPanning = () => {
  isPanning.value = false;
  isSelecting.value = false;
  selectionBox.value = null;
  
  if (activeDragCard.value) {
    const dropCol = getTimelineColumnAt(lastMouseCanvasPos.value.x, lastMouseCanvasPos.value.y);
    
    placedUnits.value.forEach(u => {
      if (u.uuid === activeDragCard.value.uuid || selectedCardUuids.value.includes(u.uuid)) {
        if (dropCol) {
          u.timelineColId = dropCol.col.id;
          const colPos = getColumnAbsolutePosition(dropCol.col.id);
          const CARD_W = 220;
          const CARD_H = 200;
          
          // Calculate relative position inside column based on absolute coordinates
          const rx = u.x - colPos.x;
          const ry = u.y - colPos.y;
          
          const colHeight = dropCol.panel.height || dropCol.col.height || 420;
          let colSummaryRows = 2;
          if (getColumnMetalProd(dropCol.col.id) > 0) colSummaryRows++;
          if (getColumnMetalCons(dropCol.col.id) > 0) colSummaryRows++;
          if (getColumnEnergyProd(dropCol.col.id) > 0) colSummaryRows++;
          if (getColumnEnergyCons(dropCol.col.id) > 0) colSummaryRows++;
          const colSummaryHeight = colSummaryRows * 18 + 12;
          const colOffset = 35 + colSummaryHeight;

          u.x = Math.max(0, Math.min((dropCol.col.width || 250) - CARD_W, rx));
          u.y = Math.max(0, Math.min(colHeight - CARD_H - colOffset, ry));
          
          autoFitColumnSize(dropCol.col);
        } else {
          u.timelineColId = null;
        }
      }
    });
  }
  
  activeDragCard.value = null;
  activeDragArea.value = null;
  activeDragTimeline.value = null;
  activeDragNote.value = null;
  activeConnectionDrag.value = null;
  isResizingArea.value = false;
  saveToLocalStorage(); // save final positions on drag end
};

const handleZoom = (e) => {
  const zoomFactor = 1.1;
  const oldZoom = canvasZoom.value;
  
  if (e.deltaY < 0) {
    canvasZoom.value = Math.min(2.0, canvasZoom.value * zoomFactor);
  } else {
    canvasZoom.value = Math.max(0.3, canvasZoom.value / zoomFactor);
  }
  
  // Adjust offset so that we zoom at the cursor position
  const rect = canvasRef.value.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  
  canvasOffset.value.x = mouseX - (mouseX - canvasOffset.value.x) * (canvasZoom.value / oldZoom);
  canvasOffset.value.y = mouseY - (mouseY - canvasOffset.value.y) * (canvasZoom.value / oldZoom);
  saveToLocalStorage();
};

const zoomIn = () => {
  const oldZoom = canvasZoom.value;
  canvasZoom.value = Math.min(2.0, canvasZoom.value * 1.2);
  // Zoom towards center of screen
  const cx = canvasRef.value.clientWidth / 2;
  const cy = canvasRef.value.clientHeight / 2;
  canvasOffset.value.x = cx - (cx - canvasOffset.value.x) * (canvasZoom.value / oldZoom);
  canvasOffset.value.y = cy - (cy - canvasOffset.value.y) * (canvasZoom.value / oldZoom);
  saveToLocalStorage();
};

const zoomOut = () => {
  const oldZoom = canvasZoom.value;
  canvasZoom.value = Math.max(0.3, canvasZoom.value / 1.2);
  const cx = canvasRef.value.clientWidth / 2;
  const cy = canvasRef.value.clientHeight / 2;
  canvasOffset.value.x = cx - (cx - canvasOffset.value.x) * (canvasZoom.value / oldZoom);
  canvasOffset.value.y = cy - (cy - canvasOffset.value.y) * (canvasZoom.value / oldZoom);
  saveToLocalStorage();
};

const toggleCardSelection = (uuid) => {
  const idx = selectedCardUuids.value.indexOf(uuid);
  if (idx > -1) {
    selectedCardUuids.value.splice(idx, 1);
  } else {
    selectedCardUuids.value.push(uuid);
  }
};

const resetZoom = () => {
  canvasZoom.value = 0.9;
  canvasOffset.value = { x: 100, y: 100 };
  saveToLocalStorage();
};

// Mouse down handler on a card (supports Shift+Click selection and dragging)
const onCardMousedown = (placedUnit, e) => {
  if (e.target.closest('.qty-controller') || e.target.closest('.close-btn') || e.target.closest('.card-actions') || e.target.closest('.factory-popup')) {
    return;
  }
  
  if (e.button !== 0) return; // Only trigger for left clicks
  
  e.stopPropagation();
  
  if (e.shiftKey) {
    e.preventDefault();
    const idx = selectedCardUuids.value.indexOf(placedUnit.uuid);
    if (idx > -1) {
      selectedCardUuids.value.splice(idx, 1);
    } else {
      selectedCardUuids.value.push(placedUnit.uuid);
    }
    return;
  } else {
    if (!selectedCardUuids.value.includes(placedUnit.uuid)) {
      selectedCardUuids.value = [];
    }
  }
  
  pushToUndoStack();
  
  // Convert any selected/dragged units inside timeline columns back to absolute canvas space
  placedUnits.value.forEach(u => {
    if (u.uuid === placedUnit.uuid || selectedCardUuids.value.includes(u.uuid)) {
      if (u.timelineColId) {
        const colPos = getColumnAbsolutePosition(u.timelineColId);
        if (colPos) {
          u.x = colPos.x + u.x;
          u.y = colPos.y + u.y;
          u.timelineColId = null;
        }
      }
    }
  });
  
  activeDragCard.value = placedUnit;
  
  const rect = canvasRef.value.getBoundingClientRect();
  const mouseCanvasX = (e.clientX - rect.left - canvasOffset.value.x) / canvasZoom.value + 25000;
  const mouseCanvasY = (e.clientY - rect.top - canvasOffset.value.y) / canvasZoom.value + 25000;
  
  dragCardOffset.value = {
    x: mouseCanvasX - placedUnit.x,
    y: mouseCanvasY - placedUnit.y
  };
  closeContextMenu();
};

// Remove card and its connections
const removePlacedUnit = (uuid) => {
  pushToUndoStack();
  placedUnits.value = placedUnits.value.filter(u => u.uuid !== uuid);
  connections.value = connections.value.filter(c => c.fromUuid !== uuid && c.toUuid !== uuid);
  saveToLocalStorage();
};

const addOpponentToCanvas = (elementUuid, mode) => {
  const node = getElement(elementUuid);
  if (!node) return;
  
  const combatants = getCombatants(node);
  if (combatants.length === 0) return;
  const ourTotalMetalCost = combatants.reduce((sum, u) => sum + (u.cost * u.count), 0);
  
  const candidates = unitsData.filter(u => {
    const isMobile = u.unit_types?.includes('UNITTYPE_Mobile');
    const isStructure = u.unit_types?.includes('UNITTYPE_Structure');
    const hasWeapon = u.weapons && u.weapons.length > 0;
    return isMobile && !isStructure && hasWeapon && u.cost > 0;
  });
  
  if (candidates.length === 0) return;
  
  let bestCandidate = null;
  let bestScore = mode === 'hardest' ? Infinity : -Infinity;
  
  candidates.forEach(candidate => {
    const count = Math.max(1, Math.round(ourTotalMetalCost / candidate.cost));
    const opponentNode = {
      uuid: 'temp-opp',
      type: 'unit',
      unitId: candidate.id,
      count: count
    };
    const sim = runBattleSimulation(node, opponentNode);
    if (!sim) return;
    
    let score = 0;
    if (sim.winner === 'A') {
      score = sim.remainingHpPercent;
    } else if (sim.winner === 'B') {
      score = -sim.remainingHpPercent;
    } else {
      score = 0;
    }
    
    if (mode === 'hardest') {
      if (score < bestScore) {
        bestScore = score;
        bestCandidate = { candidate, count };
      }
    } else {
      if (score > bestScore) {
        bestScore = score;
        bestCandidate = { candidate, count };
      }
    }
  });
  
  if (!bestCandidate) return;
  
  const cardUuid = generateUuid();
  const rawX = node.x + (node.width || CARD_WIDTH) + 150;
  const rawY = node.y + (node.height || 180) / 2 - 80;
  
  placedUnits.value.push({
    uuid: cardUuid,
    unitId: bestCandidate.candidate.id,
    x: snapToGrid.value ? Math.round(rawX / 40) * 40 : rawX,
    y: snapToGrid.value ? Math.round(rawY / 40) * 40 : rawY,
    count: bestCandidate.count,
    showFactoryMenu: false
  });
  
  connections.value.push({
    uuid: generateUuid(),
    fromUuid: node.uuid,
    toUuid: cardUuid,
    settings: {
      initialDistance: 300,
      showRanges: false,
      positions: {}
    }
  });
  
  calculateAllBattles();
  saveToLocalStorage();
};

const openCounterFinderModal = (nodeUuid) => {
  counterSelectedNodeUuid.value = nodeUuid;
  calculateCounterRatings();
  showCounterModal.value = true;
};

// Find the minimum count of `candidate` that defeats `node` in simulation.
// Uses an optimized binary search in fastMode to prevent blocking the UI thread.
const findMinWinningCount = (node, candidateUnitId) => {
  const combatants = getCombatants(node);
  if (combatants.length === 0) return { count: 1, sim: null };
  
  const ourCost = combatants.reduce((sum, u) => sum + (u.cost * u.count), 0);
  const candidateSpec = getUnitById(candidateUnitId);
  if (!candidateSpec) return { count: 1, sim: null };
  const candidateCost = candidateSpec.cost || 100;
  
  const costEquivalent = Math.max(1, Math.round(ourCost / candidateCost));
  const maxSearchLimit = Math.min(30, Math.max(10, costEquivalent * 3));
  
  let low = 1;
  let high = maxSearchLimit;
  let bestCount = -1;
  let bestSim = null;
  
  const fastSettings = { fastMode: true, maxTime: 45 };
  
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const testNode = { uuid: 'temp-opp', type: 'unit', unitId: candidateUnitId, count: mid };
    const sim = extRunBattleSimulation(node, testNode, null, fastSettings, lang.value, getUnitById, getCombatants);
    
    if (sim && sim.winner === 'B') {
      bestCount = mid;
      bestSim = sim;
      high = mid - 1; // Try to find a smaller count
    } else {
      low = mid + 1; // Need more units to win
    }
  }
  
  if (bestCount !== -1) {
    return { count: bestCount, sim: bestSim };
  }
  
  return { count: maxSearchLimit, sim: null };
};

const calculateCounterRatings = async () => {
  const nodeUuid = counterSelectedNodeUuid.value;
  const node = getElement(nodeUuid);
  if (!node) return;
  
  const combatants = getCombatants(node);
  if (combatants.length === 0) return;
  
  counterRatingsLoading.value = true;
  counterRatings.value = [];
  
  try {
    const ourTotalMetalCost = combatants.reduce((sum, u) => sum + (u.cost * u.count), 0);
    const ourAvgDps = combatants.reduce((sum, u) => sum + (u.dps || 0), 0) / combatants.length;
    
    // Exclude self-unit types from candidates
    const selfUnitIds = new Set(combatants.map(u => u.unitId));
    
    const unitCandidates = unitsData.filter(u => {
      const isMobile = u.unit_types?.includes('UNITTYPE_Mobile');
      const isStructure = u.unit_types?.includes('UNITTYPE_Structure');
      const isCmd = u.category === 'commander' || u.id.includes('commander');
      const hasWeapon = u.weapons && u.weapons.length > 0;
      const isSelf = selfUnitIds.has(u.id);
      if (!isMobile || isStructure || isCmd || !hasWeapon || u.cost <= 0 || isSelf) {
        return false;
      }
      return u.weapons.some(wpn => 
        combatants.some(target => canTargetLayer(wpn.target_layers, target.layers))
      );
    });

    const buildingCandidates = unitsData.filter(u => {
      const isStructure = u.unit_types?.includes('UNITTYPE_Structure');
      const hasWeapon = u.weapons && u.weapons.length > 0;
      const isSelf = selfUnitIds.has(u.id);
      if (!isStructure || !hasWeapon || u.cost <= 0 || isSelf) {
        return false;
      }
      return u.weapons.some(wpn => 
        combatants.some(target => canTargetLayer(wpn.target_layers, target.layers))
      );
    });

    // Check if pregenerated cache has the best counter for a single-unit node with count=1
    const isSingleUnitAndCount1 = combatants.length === 1 && combatants[0].count === 1;
    const cachedBestId = isSingleUnitAndCount1 ? hardestCountersCache[combatants[0].unitId]?.bestCounterId : null;
    const cachedData = isSingleUnitAndCount1 ? hardestCountersCache[combatants[0].unitId] : null;
    let localizedRatings = [];
    let finalCandidates = [];
    
    if (cachedData && cachedData.ratings) {
      localizedRatings = cachedData.ratings.map(item => {
        let resultLabel = item.resultLabel;
        if (lang.value === 'ru') {
          if (resultLabel.startsWith('Wins')) {
            const hp = resultLabel.match(/\d+/)?.[0] || '0';
            resultLabel = `Победа (${hp}% HP)`;
          } else if (resultLabel === 'Cannot win') {
            resultLabel = 'Не побеждает';
          }
        }
        const spec = getUnitById(item.unitId);
        const isStr = spec?.unit_types?.includes('UNITTYPE_Structure') || false;
        return {
          ...item,
          resultLabel,
          isStructure: isStr
        };
      });
      // In cached mode, the cache already contains both units and buildings pregenerated
      finalCandidates = [];
      counterRatings.value = localizedRatings;
      counterRatingsLoading.value = false; // Show cached units table immediately!
    } else {
      // In non-cached mode, we calculate both units and building candidates
      finalCandidates = [...unitCandidates, ...buildingCandidates];
    }
    
    const ratings = [...localizedRatings];
    
    for (let i = 0; i < finalCandidates.length; i++) {
      // Yield to keep UI responsive
      if (i > 0 && i % 3 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      
      // Check if the user closed the modal or switched context during generation
      if (counterSelectedNodeUuid.value !== nodeUuid || !showCounterModal.value) {
        return;
      }
      
      const candidate = finalCandidates[i];
      const { count: minCount, sim } = findMinWinningCount(node, candidate.id);
      
      let score = 0;
      let resultLabel = '';
      let resultClass = '';
      
      if (sim && sim.winner === 'B') {
        const totalCostSpent = minCount * candidate.cost;
        const costRatio = ourTotalMetalCost / (totalCostSpent || 1);
        score += 1000 + costRatio * 500 + sim.remainingHpPercent * 2;
        resultLabel = lang.value === 'ru'
          ? `Победа (${sim.remainingHpPercent}% HP)`
          : `Wins (${sim.remainingHpPercent}% HP)`;
        resultClass = 'text-green';
      } else {
        score -= 2000;
        resultLabel = lang.value === 'ru' ? 'Не побеждает' : 'Cannot win';
        resultClass = 'text-red';
      }
      
      if ((candidate.dps || 0) > ourAvgDps) score += 100;
      if (candidate.cost < (ourTotalMetalCost / (minCount || 1))) score += 100;
      
      // Prioritize pregenerated best counter
      if (cachedBestId && candidate.id === cachedBestId) score += 2000;
      
      ratings.push({
        unitId: candidate.id,
        name: candidate.name,
        icon: candidate.icon,
        cost: candidate.cost,
        dps: candidate.dps || 0,
        spawnCount: minCount,
        resultLabel,
        resultClass,
        score: Math.round(score),
        isStructure: candidate.unit_types?.includes('UNITTYPE_Structure') || false
      });

      // Update ratings live
      const sorted = [...ratings].sort((a, b) => b.score - a.score);
      counterRatings.value = sorted;
    }
  } finally {
    counterRatingsLoading.value = false;
  }
};

const spawnCounterOpponent = (ratingItem) => {
  const nodeUuid = counterSelectedNodeUuid.value;
  const node = getElement(nodeUuid);
  if (!node) return;
  
  const cardUuid = generateUuid();
  const rawX = node.x + (node.width || CARD_WIDTH) + 150;
  const rawY = node.y + (node.height || 180) / 2 - 80;
  
  placedUnits.value.push({
    uuid: cardUuid,
    unitId: ratingItem.unitId,
    x: snapToGrid.value ? Math.round(rawX / 40) * 40 : rawX,
    y: snapToGrid.value ? Math.round(rawY / 40) * 40 : rawY,
    count: ratingItem.spawnCount,
    showFactoryMenu: false
  });
  
  connections.value.push({
    uuid: generateUuid(),
    fromUuid: node.uuid,
    toUuid: cardUuid,
    settings: {
      initialDistance: 300,
      showRanges: false,
      positions: {},
      rangeMultiplier: 1.0
    }
  });
  
  calculateAllBattles();
  saveToLocalStorage();
  showCounterModal.value = false;
};

const getVictoryEaseDetails = (hpPercent) => {
  return extGetVictoryEaseDetails(hpPercent, lang.value);
};

const downloadResultCardImage = async () => {
  if (!animSim.value) return;
  const sim = animSim.value.sim;
  
  const imageSources = {
    teamA: sim.a.icon,
    teamB: sim.b.icon
  };
  
  const survivorsA = sim.a.detailedUnits?.filter(u => u.survivedCount > 0) || [];
  const survivorsB = sim.b.detailedUnits?.filter(u => u.survivedCount > 0) || [];
  
  survivorsA.forEach((u, i) => {
    imageSources['survA_' + i] = u.icon;
  });
  survivorsB.forEach((u, i) => {
    imageSources['survB_' + i] = u.icon;
  });
  
  const loadedImages = {};
  await Promise.all(
    Object.keys(imageSources).map(async key => {
      const src = imageSources[key];
      if (!src) return;
      return new Promise(resolve => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = src;
        img.onload = () => {
          loadedImages[key] = img;
          resolve();
        };
        img.onerror = () => {
          resolve();
        };
      });
    })
  );
  
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 560;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  const bgGrad = ctx.createRadialGradient(400, 280, 50, 400, 280, 500);
  bgGrad.addColorStop(0, '#0c101f');
  bgGrad.addColorStop(1, '#05070e');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 800, 560);
  
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.04)';
  ctx.lineWidth = 1;
  for (let x = 0; x < 800; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 560);
    ctx.stroke();
  }
  for (let y = 0; y < 560; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(800, y);
    ctx.stroke();
  }
  
  const isDraw = sim.winner === 'Draw';
  const neonColor = isDraw ? '#f97316' : '#22c55e';
  ctx.strokeStyle = neonColor;
  ctx.lineWidth = 3;
  ctx.shadowColor = neonColor;
  ctx.shadowBlur = 10;
  ctx.strokeRect(15, 15, 770, 530);
  
  ctx.shadowBlur = 0;
  
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(6, 182, 212, 0.6)';
  ctx.font = 'bold 10px monospace';
  ctx.fillText('PLANETARY ANNIHILATION COMBAT METRICS', 400, 45);
  
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(lang.value === 'ru' ? 'БОЕВОЙ ОТЧЕТ СИМУЛЯЦИИ' : 'COMBAT SIMULATION REPORT', 400, 75);
  
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(50, 95);
  ctx.lineTo(750, 95);
  ctx.stroke();
  
  ctx.textAlign = 'left';
  if (loadedImages.teamA) {
    ctx.drawImage(loadedImages.teamA, 60, 120, 40, 40);
  }
  ctx.font = 'bold 18px sans-serif';
  ctx.fillStyle = sim.winner === 'A' ? '#22c55e' : '#cbd5e1';
  ctx.fillText(sim.a.name, 115, 138);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(`${lang.value === 'ru' ? 'Металл' : 'Cost'}: ${sim.a.detailedUnits?.reduce((sum, u) => sum + u.cost * u.initialCount, 0)} M`, 115, 156);
  
  ctx.textAlign = 'right';
  if (loadedImages.teamB) {
    ctx.drawImage(loadedImages.teamB, 700, 120, 40, 40);
  }
  ctx.font = 'bold 18px sans-serif';
  ctx.fillStyle = sim.winner === 'B' ? '#ef4444' : '#cbd5e1';
  ctx.fillText(sim.b.name, 685, 138);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(`${lang.value === 'ru' ? 'Металл' : 'Cost'}: ${sim.b.detailedUnits?.reduce((sum, u) => sum + u.cost * u.initialCount, 0)} M`, 685, 156);
  
  ctx.textAlign = 'center';
  ctx.font = 'italic bold 20px sans-serif';
  ctx.fillStyle = '#e2e8f0';
  ctx.fillText('VS', 400, 145);
  ctx.font = '11px sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText(`${lang.value === 'ru' ? 'Время боя' : 'Duration'}: ${sim.time}s`, 400, 165);
  
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.beginPath();
  ctx.moveTo(50, 190);
  ctx.lineTo(750, 190);
  ctx.stroke();
  
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fillRect(50, 205, 700, 80);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.strokeRect(50, 205, 700, 80);
  
  ctx.fillStyle = sim.winner === 'Draw' ? '#f97316' : '#22c55e';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(sim.resultText, 400, 238);
  
  if (sim.winner !== 'Draw') {
    const details = getVictoryEaseDetails(sim.remainingHpPercent);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`${lang.value === 'ru' ? 'Лёгкость победы' : 'Victory Ease'}: `, 340, 265);
    ctx.textAlign = 'left';
    ctx.fillStyle = details.color === 'var(--color-green)' ? '#22c55e' : (details.color === 'var(--color-orange)' ? '#f97316' : '#ef4444');
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(`${details.text} (${sim.remainingHpPercent}%)`, 450, 265);
  } else {
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText(lang.value === 'ru' ? 'Все мобильные единицы были уничтожены.' : 'All mobile forces were mutually destroyed.', 400, 265);
  }
  ctx.textAlign = 'center';
  
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(lang.value === 'ru' ? 'ВЫЖИВШИЕ ЮНИТЫ:' : 'SURVIVING UNITS:', 60, 315);
  
  let drawY = 345;
  let countA = 0;
  ctx.font = '12px sans-serif';
  
  survivorsA.forEach((u, idx) => {
    if (idx >= 6) return;
    const img = loadedImages['survA_' + idx];
    if (img) {
      ctx.drawImage(img, 60, drawY + countA * 30 - 15, 20, 20);
    }
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(u.name, 90, drawY + countA * 30);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(`${u.survivedCount}/${u.initialCount}`, 320, drawY + countA * 30);
    ctx.textAlign = 'left';
    ctx.font = '12px sans-serif';
    countA++;
  });
  
  if (survivorsA.length === 0) {
    ctx.fillStyle = '#64748b';
    ctx.fillText(lang.value === 'ru' ? 'Выживших нет' : 'No survivors', 60, drawY);
  }
  
  let countB = 0;
  survivorsB.forEach((u, idx) => {
    if (idx >= 6) return;
    const img = loadedImages['survB_' + idx];
    if (img) {
      ctx.drawImage(img, 450, drawY + countB * 30 - 15, 20, 20);
    }
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(u.name, 480, drawY + countB * 30);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(`${u.survivedCount}/${u.initialCount}`, 720, drawY + countB * 30);
    ctx.textAlign = 'left';
    ctx.font = '12px sans-serif';
    countB++;
  });
  
  if (survivorsB.length === 0) {
    ctx.fillStyle = '#64748b';
    ctx.fillText(lang.value === 'ru' ? 'Выживших нет' : 'No survivors', 450, drawY);
  }
  
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.font = '9px monospace';
  ctx.fillText('github.com/Rimuwu/PA-Dashboard', 400, 530);

  try {
    const link = document.createElement('a');
    link.download = `battle-report-${sim.winner === 'Draw' ? 'draw' : 'winner-' + sim.winner}-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error('Failed to download combat report image', err);
  }
};

// Quantity adjusters
const adjustCount = (placedUnit, amount) => {
  pushToUndoStack();
  placedUnit.count = Math.max(1, Math.min(10000, placedUnit.count + amount));
  saveToLocalStorage();
};

const updateCount = (placedUnit, e) => {
  pushToUndoStack();
  const val = parseInt(e.target.value);
  placedUnit.count = isNaN(val) ? 1 : Math.max(1, Math.min(10000, val));
  saveToLocalStorage();
};

// Connection drawing system (Supports cards and Areas!)
const startConnection = (placedElement, side, e) => {
  e.stopPropagation();
  e.preventDefault();
  
  const el = getElement(placedElement.uuid);
  if (!el) return;
  
  const startX = side === 'right' ? el.x + el.width : el.x;
  const startY = el.y + el.height / 2;
  
  activeConnectionDrag.value = {
    fromUuid: placedElement.uuid,
    startX,
    startY,
    currentX: startX,
    currentY: startY
  };
  closeContextMenu();
};

const completeConnection = (targetElement, e) => {
  if (!activeConnectionDrag.value) return;
  e.stopPropagation();
  
  const fromUuid = activeConnectionDrag.value.fromUuid;
  const toUuid = targetElement.uuid;
  
  // Disallow self connection or duplicate connections
  if (fromUuid !== toUuid) {
    const exists = connections.value.some(c => 
      (c.fromUuid === fromUuid && c.toUuid === toUuid) || 
      (c.fromUuid === toUuid && c.toUuid === fromUuid)
    );
    
    if (!exists) {
      pushToUndoStack();
      connections.value.push({
        uuid: generateUuid(),
        fromUuid,
        toUuid,
        settings: {
          initialDistance: 300,
          showRanges: false,
          positions: {}
        }
      });
    }
  }
  
  activeConnectionDrag.value = null;
  saveToLocalStorage();
};

// Spawn unit from factory/builder
const spawnFromFactory = (factory, buildUnitId) => {
  const isTimeline = !!factory.timelineColId;
  const rawX = isTimeline ? factory.x + 30 : factory.x + CARD_WIDTH + 60;
  const rawY = isTimeline ? factory.y + 40 : factory.y;
  
  pushToUndoStack();
  placedUnits.value.push({
    uuid: generateUuid(),
    unitId: buildUnitId,
    x: snapToGrid.value ? Math.round(rawX / 40) * 40 : rawX,
    y: snapToGrid.value ? Math.round(rawY / 40) * 40 : rawY,
    count: 1,
    showFactoryMenu: false,
    timelineColId: factory.timelineColId || null
  });
  
  factory.showFactoryMenu = false;
  saveToLocalStorage();
};

// Clear the board
const clearBoard = () => {
  if (confirm(lang.value === 'ru' ? "Вы уверены, что хотите очистить весь холст?" : "Are you sure you want to clear the entire comparison canvas?")) {
    pushToUndoStack();
    placedUnits.value = [];
    groupAreas.value = [];
    connections.value = [];
    timelinePanels.value = [];
    selectedCardUuids.value = [];
    notes.value = getDefaultNotes();
    saveToLocalStorage();
  }
};

// Save board layout to file
const saveToFile = () => {
  const dataStr = JSON.stringify({
    placedUnits: placedUnits.value,
    groupAreas: groupAreas.value,
    notes: notes.value,
    connections: connections.value,
    timelinePanels: timelinePanels.value
  }, null, 2);
  
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'pa_titans_canvas_layout.json';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Load board layout from file
const triggerFileInput = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target.result);
        if (Array.isArray(data.placedUnits)) {
          pushToUndoStack();
          placedUnits.value = data.placedUnits;
          groupAreas.value = Array.isArray(data.groupAreas) ? data.groupAreas : [];
          notes.value = Array.isArray(data.notes) ? data.notes : getDefaultNotes();
          connections.value = Array.isArray(data.connections) ? data.connections : [];
          timelinePanels.value = Array.isArray(data.timelinePanels) ? data.timelinePanels : [];
          selectedCardUuids.value = [];
          resetZoom();
          saveToLocalStorage();
        } else {
          alert(lang.value === 'ru' ? "Недопустимый формат файла разметки." : "Invalid layout file format.");
        }
      } catch (err) {
        alert((lang.value === 'ru' ? "Не удалось прочитать файл: " : "Failed to parse file: ") + err.message);
      }
    };
    reader.readAsText(file);
  };
  input.click();
};

// Save and Load from LocalStorage
const saveToLocalStorage = () => {
  // Create a version of simulationResults without ticks to save space and avoid localStorage quota limit
  const cleanSimResults = {};
  if (simulationResults.value) {
    for (const [uuid, res] of Object.entries(simulationResults.value)) {
      if (res) {
        cleanSimResults[uuid] = {
          winner: res.winner,
          time: res.time,
          totalMaxHpA: res.totalMaxHpA,
          totalMaxHpB: res.totalMaxHpB,
          resultText: res.resultText,
          remainingHpPercent: res.remainingHpPercent,
          remainingCount: res.remainingCount,
          a: res.a,
          b: res.b
        };
      }
    }
  }

  localStorage.setItem('pa_canvas_layout_data', JSON.stringify({
    placedUnits: placedUnits.value,
    groupAreas: groupAreas.value,
    notes: notes.value,
    timelinePanels: timelinePanels.value,
    connections: connections.value,
    canvasOffset: canvasOffset.value,
    canvasZoom: canvasZoom.value,
    lang: lang.value,
    gridEnabled: gridEnabled.value,
    snapToGrid: snapToGrid.value,
    simulationResults: cleanSimResults,
    simSettings: simSettings.value
  }));
};

const loadFromLocalStorage = () => {
  const raw = localStorage.getItem('pa_canvas_layout_data');
  if (raw) {
    try {
      const data = JSON.parse(raw);
      if (Array.isArray(data.placedUnits)) placedUnits.value = data.placedUnits;
      if (Array.isArray(data.groupAreas)) groupAreas.value = data.groupAreas;
      if (Array.isArray(data.notes)) {
        notes.value = data.notes;
      } else {
        notes.value = getDefaultNotes();
      }
      if (Array.isArray(data.timelinePanels)) timelinePanels.value = data.timelinePanels;
      if (Array.isArray(data.connections)) {
        connections.value = data.connections.map(c => {
          if (!c.settings) {
            c.settings = {
              initialDistance: 300,
              showRanges: false,
              positions: {}
            };
          }
          return c;
        });
      }
      if (data.canvasOffset) canvasOffset.value = data.canvasOffset;
      if (data.canvasZoom) canvasZoom.value = data.canvasZoom;
      if (data.lang) lang.value = data.lang;
      if (data.gridEnabled !== undefined) gridEnabled.value = data.gridEnabled;
      if (data.snapToGrid !== undefined) snapToGrid.value = data.snapToGrid;
      if (data.simulationResults) simulationResults.value = data.simulationResults;
      if (data.simSettings) simSettings.value = { ...simSettings.value, ...data.simSettings };
    } catch (e) {
      console.error("Failed to load layout from local storage:", e);
      notes.value = getDefaultNotes();
    }
  } else {
    notes.value = getDefaultNotes();
  }
};

// Remove connection port link
const removeConnection = (uuid) => {
  pushToUndoStack();
  connections.value = connections.value.filter(c => c.uuid !== uuid);
  if (simulationResults.value[uuid]) {
    delete simulationResults.value[uuid];
  }
  saveToLocalStorage();
};

const calculateConnectionBattle = (conn) => {
  const nodeA = getElement(conn.fromUuid);
  const nodeB = getElement(conn.toUuid);
  if (!nodeA || !nodeB) return null;
  const res = runBattleSimulation(nodeA, nodeB, conn);
  simulationResults.value[conn.uuid] = res;
  saveToLocalStorage();
  return res;
};

const calculateAllBattles = () => {
  connections.value.forEach(conn => {
    calculateConnectionBattle(conn);
  });
};

const stopAnimatedSim = () => {
  if (animSim.value?.intervalId) {
    clearInterval(animSim.value.intervalId);
  }
  animSim.value = null;
};

const runQuickSim = (conn) => {
  const nodeA = getElement(conn.fromUuid);
  const nodeB = getElement(conn.toUuid);
  if (!nodeA || !nodeB) return;
  const sim = runBattleSimulation(nodeA, nodeB, conn);
  if (!sim) return;
  simulationResults.value[conn.uuid] = sim;
  saveToLocalStorage();
  // Show static result modal
  activeBattleSimulation.value = sim;
};

const startAnimatedSimulation = (conn) => {
  stopAnimatedSim();
  const nodeA = getElement(conn.fromUuid);
  const nodeB = getElement(conn.toUuid);
  if (!nodeA || !nodeB) return;
  const sim = runBattleSimulation(nodeA, nodeB, conn);
  if (!sim || !sim.ticks || sim.ticks.length === 0) return;

  // Also persist to simulationResults for highlighting
  simulationResults.value[conn.uuid] = sim;
  saveToLocalStorage();

  const state = {
    sim,
    connUuid: conn.uuid,
    currentTickIndex: 0,
    displayedLog: [],
    aHpCur: sim.totalMaxHpA,
    bHpCur: sim.totalMaxHpB,
    simTimeCur: 0,
    isPlaying: true,
    intervalId: null,
    playbackSpeed: simSettings.value.playbackSpeed || 4.0,
    done: false
  };

  const advanceTick = () => {
    if (state.currentTickIndex >= sim.ticks.length) {
      clearInterval(state.intervalId);
      state.isPlaying = false;
      state.done = true;
      animSim.value = { ...state };
      return;
    }
    const tick = sim.ticks[state.currentTickIndex];
    state.aHpCur = tick.aHp;
    state.bHpCur = tick.bHp;
    state.simTimeCur = tick.time || 0;
    state.displayedLog = [...state.displayedLog, ...(tick.newLogs || [])];
    state.currentTickIndex++;
    animSim.value = { ...state };
  };

  // Compress: skip ticks with no log events and no big HP change for speed
  const TICK_INTERVAL_MS = Math.round(100 / (simSettings.value.playbackSpeed || 4.0));
  state.intervalId = setInterval(advanceTick, TICK_INTERVAL_MS);
  advanceTick(); // show first tick immediately
  animSim.value = { ...state };
};

const startAnimatedSim = () => {
  if (!animSim.value || animSim.value.isPlaying) return;
  
  if (animSim.value.intervalId) {
    clearInterval(animSim.value.intervalId);
  }
  
  if (animSim.value.done || animSim.value.currentTickIndex >= animSim.value.sim.ticks.length) {
    animSim.value.currentTickIndex = 0;
    animSim.value.displayedLog = [];
    animSim.value.done = false;
    animSim.value.aHpCur = animSim.value.sim.totalMaxHpA;
    animSim.value.bHpCur = animSim.value.sim.totalMaxHpB;
    animSim.value.simTimeCur = 0;
  }
  
  animSim.value.isPlaying = true;
  animSim.value.done = false;
  
  const advanceTick = () => {
    if (!animSim.value) return;
    const state = animSim.value;
    if (state.currentTickIndex >= state.sim.ticks.length) {
      clearInterval(state.intervalId);
      state.isPlaying = false;
      state.done = true;
      animSim.value = { ...state };
      return;
    }
    const tick = state.sim.ticks[state.currentTickIndex];
    state.aHpCur = tick.aHp;
    state.bHpCur = tick.bHp;
    const newLogs = tick.newLogs || [];
    newLogs.forEach(newLog => {
      if (!state.displayedLog.some(log => log.time === newLog.time && log.event === newLog.event)) {
        state.displayedLog.push(newLog);
      }
    });
    state.currentTickIndex++;
    animSim.value = { ...state };
  };
  
  const TICK_INTERVAL_MS = Math.round(100 / (simSettings.value.playbackSpeed || 4.0));
  animSim.value.intervalId = setInterval(advanceTick, TICK_INTERVAL_MS);
  animSim.value = { ...animSim.value };
};

const pauseAnimatedSim = () => {
  if (!animSim.value) return;
  if (animSim.value.intervalId) {
    clearInterval(animSim.value.intervalId);
    animSim.value.intervalId = null;
  }
  animSim.value.isPlaying = false;
  animSim.value = { ...animSim.value };
};

const stepAnimatedSim = () => {
  if (!animSim.value || animSim.value.isPlaying) return;
  const state = animSim.value;
  if (state.currentTickIndex >= state.sim.ticks.length) return;
  
  const tick = state.sim.ticks[state.currentTickIndex];
  state.aHpCur = tick.aHp;
  state.bHpCur = tick.bHp;
  const newLogs = tick.newLogs || [];
  newLogs.forEach(newLog => {
    if (!state.displayedLog.some(log => log.time === newLog.time && log.event === newLog.event)) {
      state.displayedLog.push(newLog);
    }
  });
  state.currentTickIndex++;
  if (state.currentTickIndex >= state.sim.ticks.length) {
    state.done = true;
  }
  animSim.value = { ...state };
};

const setPlaybackSpeed = (speed) => {
  simSettings.value.playbackSpeed = speed;
  saveToLocalStorage();
  if (animSim.value) {
    animSim.value.playbackSpeed = speed;
    if (animSim.value.isPlaying) {
      clearInterval(animSim.value.intervalId);
      
      const advanceTick = () => {
        if (!animSim.value) return;
        const state = animSim.value;
        if (state.currentTickIndex >= state.sim.ticks.length) {
          clearInterval(state.intervalId);
          state.isPlaying = false;
          state.done = true;
          animSim.value = { ...state };
          return;
        }
        const tick = state.sim.ticks[state.currentTickIndex];
        state.aHpCur = tick.aHp;
        state.bHpCur = tick.bHp;
        const newLogs = tick.newLogs || [];
        newLogs.forEach(newLog => {
          if (!state.displayedLog.some(log => log.time === newLog.time && log.event === newLog.event)) {
            state.displayedLog.push(newLog);
          }
        });
        state.currentTickIndex++;
        animSim.value = { ...state };
      };
      
      const TICK_INTERVAL_MS = Math.round(25 / speed);
      animSim.value.intervalId = setInterval(advanceTick, TICK_INTERVAL_MS);
    }
    animSim.value = { ...animSim.value };
  }
};

const seekAnimatedSim = (tickIndex) => {
  if (!animSim.value) return;
  
  if (animSim.value.isPlaying) {
    pauseAnimatedSim();
  }
  
  const state = animSim.value;
  const limit = Math.max(0, Math.min(tickIndex, state.sim.ticks.length - 1));
  state.currentTickIndex = limit;
  
  let logs = [];
  for (let i = 0; i <= limit; i++) {
    const tick = state.sim.ticks[i];
    if (tick && tick.newLogs) {
      logs.push(...tick.newLogs);
    }
  }
  state.displayedLog = logs;
  
  const currentTick = state.sim.ticks[limit];
  if (currentTick) {
    state.aHpCur = currentTick.aHp;
    state.bHpCur = currentTick.bHp;
  }
  
  state.done = (limit >= state.sim.ticks.length - 1);
  animSim.value = { ...state };
};

// Center canvas around default camera viewport coordinates (100, 100) and reset zoom
const goToCenter = () => {
  canvasOffset.value = { x: 100, y: 100 };
  canvasZoom.value = 0.9;
  saveToLocalStorage();
};

// Right-click Custom Context Menu Handlers
const onCanvasContextMenu = (e) => {
  e.preventDefault();
  const rect = canvasRef.value.getBoundingClientRect();
  const canvasX = (e.clientX - rect.left - canvasOffset.value.x) / canvasZoom.value + 25000;
  const canvasY = (e.clientY - rect.top - canvasOffset.value.y) / canvasZoom.value + 25000;
  
  contextMenu.value = {
    x: e.clientX,
    y: e.clientY,
    type: 'canvas',
    canvasX,
    canvasY
  };
};

const onCardContextMenu = (placed, e) => {
  e.stopPropagation();
  e.preventDefault();
  contextMenu.value = {
    x: e.clientX,
    y: e.clientY,
    type: 'card',
    uuid: placed.uuid
  };
};

const onAreaContextMenu = (area, e) => {
  e.stopPropagation();
  e.preventDefault();
  contextMenu.value = {
    x: e.clientX,
    y: e.clientY,
    type: 'area',
    uuid: area.uuid
  };
};

const onConnectionContextMenu = (conn, e) => {
  e.stopPropagation();
  e.preventDefault();
  contextMenu.value = {
    x: e.clientX,
    y: e.clientY,
    type: 'connection',
    uuid: conn.uuid,
    conn: conn  // store full conn object for animation
  };
};



const duplicateSelectedCards = () => {
  if (selectedCardUuids.value.length === 0) return;
  pushToUndoStack();
  const newCards = [];
  placedUnits.value.forEach(u => {
    if (selectedCardUuids.value.includes(u.uuid)) {
      newCards.push({
        uuid: generateUuid(),
        unitId: u.unitId,
        x: u.x + 40,
        y: u.y + 40,
        count: u.count,
        showFactoryMenu: false
      });
    }
  });
  placedUnits.value.push(...newCards);
  saveToLocalStorage();
};

const deleteSelectedCards = () => {
  if (selectedCardUuids.value.length === 0) return;
  pushToUndoStack();
  placedUnits.value = placedUnits.value.filter(u => !selectedCardUuids.value.includes(u.uuid));
  connections.value = connections.value.filter(c => !selectedCardUuids.value.includes(c.fromUuid) && !selectedCardUuids.value.includes(c.toUuid));
  selectedCardUuids.value = [];
  saveToLocalStorage();
};

const groupSelectedIntoArea = () => {
  if (selectedCardUuids.value.length === 0) return;
  const selectedCards = placedUnits.value.filter(u => selectedCardUuids.value.includes(u.uuid));
  if (selectedCards.length === 0) return;
  
  pushToUndoStack();
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  selectedCards.forEach(c => {
    if (c.x < minX) minX = c.x;
    if (c.x + CARD_WIDTH > maxX) maxX = c.x + CARD_WIDTH;
    if (c.y < minY) minY = c.y;
    const ch = getCardHeight(c);
    if (c.y + ch > maxY) maxY = c.y + ch;
  });
  
  const paddingX = 40;
  const paddingY = 60; // Extra top and bottom margin to accommodate header title and card height bounds nicely
  
  let x = minX - paddingX;
  let y = minY - paddingY;
  let w = (maxX - minX) + paddingX * 2;
  let h = (maxY - minY) + paddingY * 2;
  
  if (snapToGrid.value) {
    const snapX = Math.floor(x / 40) * 40;
    const snapY = Math.floor(y / 40) * 40;
    const snapMaxX = Math.ceil((x + w) / 40) * 40;
    const snapMaxY = Math.ceil((y + h) / 40) * 40;
    
    x = snapX;
    y = snapY;
    w = snapMaxX - snapX;
    h = snapMaxY - snapY;
  }
  
  groupAreas.value.push({
    uuid: generateUuid(),
    name: lang.value === 'ru' ? `Группа ${groupAreas.value.length + 1}` : `Group ${groupAreas.value.length + 1}`,
    x,
    y,
    width: Math.max(300, w),
    height: Math.max(200, h),
    isEditingName: false
  });
  saveToLocalStorage();
};

const closeContextMenu = () => {
  contextMenu.value = null;
};

const handleKeyDown = (e) => {
  if (e.key === 'Escape') {
    closeContextMenu();
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    undoLastAction();
  }
};

// Group Area dragging and resizing systems
const startDragArea = (area, e) => {
  if (e.target.closest('.group-area-resize-handle') || e.target.closest('.group-area-action-btn') || e.target.closest('.group-area-title-input')) {
    return;
  }
  e.stopPropagation();
  pushToUndoStack();
  activeDragArea.value = area;
  
  const rect = canvasRef.value.getBoundingClientRect();
  const mouseCanvasX = (e.clientX - rect.left - canvasOffset.value.x) / canvasZoom.value + 25000;
  const mouseCanvasY = (e.clientY - rect.top - canvasOffset.value.y) / canvasZoom.value + 25000;
  
  dragAreaOffset.value = {
    x: mouseCanvasX - area.x,
    y: mouseCanvasY - area.y
  };
  closeContextMenu();
};

const startResizeArea = (area, e) => {
  e.stopPropagation();
  e.preventDefault();
  pushToUndoStack();
  const startWidth = area.width || 380;
  const startHeight = area.height || 260;
  const startX = e.clientX;
  const startY = e.clientY;
  isResizingArea.value = true;
  
  const onMouseMove = (moveEvent) => {
    const dx = (moveEvent.clientX - startX) / canvasZoom.value;
    const dy = (moveEvent.clientY - startY) / canvasZoom.value;
    const newWidth = Math.max(200, startWidth + dx);
    const newHeight = Math.max(150, startHeight + dy);
    area.width = snapToGrid.value ? Math.round(newWidth / 40) * 40 : newWidth;
    area.height = snapToGrid.value ? Math.round(newHeight / 40) * 40 : newHeight;
  };
  
  const onMouseUp = () => {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    isResizingArea.value = false;
    saveToLocalStorage();
  };
  
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  closeContextMenu();
};

// Core geometric bounding box check: compiles units currently located inside a Group Area
const getAreaUnits = (areaUuid) => {
  const area = groupAreas.value.find(a => a.uuid === areaUuid);
  if (!area) return [];
  const w = area.width || 380;
  const h = area.height || 260;
  
  return placedUnits.value.filter(unit => {
    if (unit.timelineColId) return false;
    const cx = unit.x + CARD_WIDTH / 2;
    const cy = unit.y + CARD_HEIGHT / 2;
    return cx >= area.x && cx <= area.x + w &&
           cy >= area.y && cy <= area.y + h;
  });
};

const compareSelectedUnits = () => {
  const selectedCards = placedUnits.value.filter(u => selectedCardUuids.value.includes(u.uuid));
  const uniqueUnitIds = Array.from(new Set(selectedCards.map(u => u.unitId)));
  if (uniqueUnitIds.length > 0) {
    compareUnitIds.value = uniqueUnitIds;
    calculateComparisonMetrics();
    showCompareModal.value = true;
  }
};

const compareAreaUnits = (areaUuid) => {
  const insideUnits = getAreaUnits(areaUuid);
  const uniqueUnitIds = Array.from(new Set(insideUnits.map(u => u.unitId)));
  if (uniqueUnitIds.length > 0) {
    compareUnitIds.value = uniqueUnitIds;
    calculateComparisonMetrics();
    showCompareModal.value = true;
  }
};

// Context Menu command actions
const addGroupArea = (x, y) => {
  pushToUndoStack();
  groupAreas.value.push({
    uuid: generateUuid(),
    name: lang.value === 'ru' ? `Группа ${groupAreas.value.length + 1}` : `Group ${groupAreas.value.length + 1}`,
    x: snapToGrid.value ? Math.round((x - 190) / 40) * 40 : x - 190,
    y: snapToGrid.value ? Math.round((y - 130) / 40) * 40 : y - 130,
    width: 380,
    height: 260,
    isEditingName: false
  });
  saveToLocalStorage();
};

const duplicateCard = (cardUuid) => {
  const orig = placedUnits.value.find(u => u.uuid === cardUuid);
  if (!orig) return;
  pushToUndoStack();
  placedUnits.value.push({
    uuid: generateUuid(),
    unitId: orig.unitId,
    x: orig.x + 40,
    y: orig.y + 40,
    count: orig.count,
    showFactoryMenu: false
  });
  saveToLocalStorage();
};

const bringToFront = (cardUuid) => {
  const card = placedUnits.value.find(u => u.uuid === cardUuid);
  if (!card) return;
  const maxZ = Math.max(...placedUnits.value.map(u => u.zIndex || 10), 10);
  card.zIndex = maxZ + 1;
  saveToLocalStorage();
};

const sendToBack = (cardUuid) => {
  const card = placedUnits.value.find(u => u.uuid === cardUuid);
  if (!card) return;
  const minZ = Math.min(...placedUnits.value.map(u => u.zIndex || 10), 10);
  card.zIndex = Math.max(1, minZ - 1);
  saveToLocalStorage();
};

const deleteAreaUnits = (areaUuid) => {
  pushToUndoStack();
  const inside = getAreaUnits(areaUuid);
  const uuids = inside.map(u => u.uuid);
  placedUnits.value = placedUnits.value.filter(u => !uuids.includes(u.uuid));
  connections.value = connections.value.filter(c => !uuids.includes(c.fromUuid) && !uuids.includes(c.toUuid));
  saveToLocalStorage();
};

const deleteGroupArea = (areaUuid) => {
  pushToUndoStack();
  groupAreas.value = groupAreas.value.filter(a => a.uuid !== areaUuid);
  connections.value = connections.value.filter(c => c.fromUuid !== areaUuid && c.toUuid !== areaUuid);
  saveToLocalStorage();
};

const recalculateAreaBattle = (area) => {
  const conn = connections.value.find(c => c.fromUuid === area.uuid || c.toUuid === area.uuid);
  if (conn) {
    const sim = calculateConnectionBattle(conn);
    if (sim) {
      openSimModal(sim);
    }
  } else {
    alert(lang.value === 'ru' 
      ? "Соедините эту группу с другой группой или юнитом линией (порты по бокам), чтобы запустить симуляцию боя."
      : "Connect this group to another group or unit using connection nodes on the sides to run the battle simulation."
    );
  }
};

const clearCardConnections = (cardUuid) => {
  pushToUndoStack();
  connections.value = connections.value.filter(c => c.fromUuid !== cardUuid && c.toUuid !== cardUuid);
  saveToLocalStorage();
};

const renameGroupArea = (area) => {
  area.isEditingName = true;
};

// Overlapping card detection computed list
const overlappingCardUuids = computed(() => {
  const overlaps = new Set();
  const list = placedUnits.value;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      if (a.timelineColId !== b.timelineColId) continue;
      const collides = !(
        a.x + CARD_WIDTH <= b.x ||
        b.x + CARD_WIDTH <= a.x ||
        a.y + CARD_HEIGHT <= b.y ||
        b.y + CARD_HEIGHT <= a.y
      );
      if (collides) {
        overlaps.add(a.uuid);
        overlaps.add(b.uuid);
      }
    }
  }
  return Array.from(overlaps);
});

// Element coordinate mapping helper: maps either unit card or group area sizes & ports
const getElement = (uuid) => {
  const u = placedUnits.value.find(x => x.uuid === uuid);
  if (u) {
    let absX = u.x;
    let absY = u.y;
    if (u.timelineColId) {
      const dropCol = getColumnAbsolutePosition(u.timelineColId);
      if (dropCol) {
        absX = dropCol.x + u.x;
        absY = dropCol.y + u.y;
      }
    }
    return {
      uuid: u.uuid,
      x: absX,
      y: absY,
      width: CARD_WIDTH,
      height: 180,
      type: 'unit',
      unitId: u.unitId,
      count: u.count
    };
  }
  const a = groupAreas.value.find(x => x.uuid === uuid);
  if (a) {
    return {
      uuid: a.uuid,
      x: a.x,
      y: a.y,
      width: a.width || 380,
      height: a.height || 260,
      type: 'area',
      name: a.name || 'Group'
    };
  }
  return null;
};

// Dynamic combatants compiler: groups all stack units in Area or returns single card unit
const getCombatants = (node) => {
  if (!node) return [];
  if (node.type === 'unit') {
    const u = getUnitById(node.unitId);
    if (!u) return [];
    return [{
      uuid: node.uuid,
      unitId: node.unitId,
      name: u.name,
      icon: u.icon,
      health: u.health,
      dps: u.dps,
      range: u.range,
      cost: u.cost,
      count: node.count,
      layers: u.layers || ['WL_LandHorizontal']
    }];
  } else if (node.type === 'area') {
    const insideUnits = getAreaUnits(node.uuid);
    return insideUnits.map(placed => {
      const u = getUnitById(placed.unitId);
      return {
        uuid: placed.uuid,
        unitId: placed.unitId,
        name: u ? u.name : 'Unknown',
        icon: u ? u.icon : '',
        health: u ? u.health : 100,
        dps: u ? u.dps : 0,
        range: u ? u.range : 0,
        cost: u ? u.cost : 0,
        count: placed.count,
        layers: u ? (u.layers || ['WL_LandHorizontal']) : ['WL_LandHorizontal']
      };
    }).filter(x => x.unitId !== undefined);
  }
  return [];
};

// Dynamic battle simulator running mass group or card combat
function runBattleSimulation(nodeA, nodeB, conn = null) {
  return extRunBattleSimulation(nodeA, nodeB, conn, simSettings.value, lang.value, getUnitById, getCombatants);
}

// Computed property that maps each connection to its battle results and SVG path coordinates
const activeConnections = computed(() => {
  return connections.value.map(conn => {
    const nodeA = getElement(conn.fromUuid);
    const nodeB = getElement(conn.toUuid);
    
    if (!nodeA || !nodeB) return null;
    
    // Sort nodes left-to-right to draw smooth lines
    const isALeft = nodeA.x < nodeB.x;
    const startNode = isALeft ? nodeA : nodeB;
    const endNode = isALeft ? nodeB : nodeA;
    
    const startX = startNode.x + startNode.width;
    const startY = startNode.y + startNode.height / 2;
    
    const endX = endNode.x;
    const endY = endNode.y + endNode.height / 2;
    
    // Control points for smooth bezier curve
    const dx = Math.abs(endX - startX) * 0.5;
    const pathD = `M ${startX} ${startY} C ${startX + dx} ${startY}, ${endX - dx} ${endY}, ${endX} ${endY}`;
    
    // Midpoint coordinates (for position of VS badge)
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;
    
    // Read simulation result from manually triggered state instead of running live!
    const simResult = simulationResults.value[conn.uuid] || null;
    
    // Determine winner direction relative to nodes
    let winnerId = 'Draw';
    if (simResult) {
      if (simResult.winner === 'A') winnerId = nodeA.uuid;
      else if (simResult.winner === 'B') winnerId = nodeB.uuid;
    }
    
    return {
      uuid: conn.uuid,
      fromUuid: conn.fromUuid,
      toUuid: conn.toUuid,
      pathD,
      midX,
      midY,
      simResult,
      winnerId,
      nodeA,
      nodeB
    };
  }).filter(c => c !== null);
});

// Computed set of all grouped card UUIDs
const groupedCardUuids = computed(() => {
  const uuids = new Set();
  groupAreas.value.forEach(area => {
    const inside = getAreaUnits(area.uuid);
    inside.forEach(u => uuids.add(u.uuid));
  });
  return Array.from(uuids);
});

// Computed set of all connected card UUIDs
const connectedCardUuids = computed(() => {
  const uuids = new Set();
  connections.value.forEach(c => {
    uuids.add(c.fromUuid);
    uuids.add(c.toUuid);
  });
  return Array.from(uuids);
});

// Computed mapping of card UUIDs to their battle survival status
const cardSurvivalStatus = computed(() => {
  const status = {}; // uuid -> 'winner' | 'loser'
  activeConnections.value.forEach(conn => {
    const sim = conn.simResult;
    if (!sim) return;
    
    const processSide = (sideData) => {
      if (sideData && sideData.detailedUnits) {
        sideData.detailedUnits.forEach(du => {
          if (du.survivedCount > 0) {
            status[du.uuid] = 'winner';
          } else {
            status[du.uuid] = 'loser';
          }
        });
      }
    };
    
    processSide(sim.a);
    processSide(sim.b);
  });
  return status;
});

// Computed mapping of node UUIDs to their combat status based on simulations
const nodeCombatStatus = computed(() => {
  const status = {}; // uuid -> 'winner' | 'loser' | 'draw'
  activeConnections.value.forEach(conn => {
    const sim = conn.simResult;
    if (!sim) return;
    
    const nodeA = conn.nodeA;
    const nodeB = conn.nodeB;
    
    if (sim.winner === 'A') {
      status[nodeA.uuid] = 'winner';
      status[nodeB.uuid] = 'loser';
      
      if (nodeA.type === 'area') {
        getAreaUnits(nodeA.uuid).forEach(u => {
          status[u.uuid] = 'winner';
        });
      }
      if (nodeB.type === 'area') {
        getAreaUnits(nodeB.uuid).forEach(u => {
          status[u.uuid] = 'loser';
        });
      }
    } else if (sim.winner === 'B') {
      status[nodeA.uuid] = 'loser';
      status[nodeB.uuid] = 'winner';
      
      if (nodeA.type === 'area') {
        getAreaUnits(nodeA.uuid).forEach(u => {
          status[u.uuid] = 'loser';
        });
      }
      if (nodeB.type === 'area') {
        getAreaUnits(nodeB.uuid).forEach(u => {
          status[u.uuid] = 'winner';
        });
      }
    } else {
      status[nodeA.uuid] = 'draw';
      status[nodeB.uuid] = 'draw';
      
      if (nodeA.type === 'area') {
        getAreaUnits(nodeA.uuid).forEach(u => {
          status[u.uuid] = 'draw';
        });
      }
      if (nodeB.type === 'area') {
        getAreaUnits(nodeB.uuid).forEach(u => {
          status[u.uuid] = 'draw';
        });
      }
    }
  });
  return status;
});

// Drag connection path calculation helper
const dragConnectionPath = computed(() => {
  if (!activeConnectionDrag.value) return '';
  const d = activeConnectionDrag.value;
  const dx = Math.abs(d.currentX - d.startX) * 0.5;
  return `M ${d.startX} ${d.startY} C ${d.startX + dx} ${d.startY}, ${d.currentX - dx} ${d.currentY}, ${d.currentX} ${d.currentY}`;
});

// Open simulation modal
const openSimModal = (sim) => {
  activeBattleSimulation.value = sim;
};

const openSimModalForConnection = (conn) => {
  let sim = simulationResults.value[conn.uuid];
  if (!sim) {
    sim = calculateConnectionBattle(conn);
  }
  if (sim) {
    openSimModal(sim);
  }
};

// Lifecycle
onMounted(() => {
  loadFromLocalStorage();
  window.addEventListener('click', closeContextMenu);
  window.addEventListener('keydown', handleKeyDown);
});

watch([placedUnits, groupAreas, notes, connections], () => {
  if (
    isPanning.value ||
    isSelecting.value ||
    activeDragCard.value ||
    activeDragArea.value ||
    activeDragNote.value ||
    activeConnectionDrag.value ||
    canvasDragState.value ||
    isResizingArea.value
  ) {
    return; // Skip saving to localStorage on mousemove to maintain 60fps dragging
  }
  saveToLocalStorage();
}, { deep: true });

const animLogRef = ref(null);
watch(() => animSim.value?.displayedLog?.length, async () => {
  await nextTick();
  if (animLogRef.value) {
    animLogRef.value.scrollTop = animLogRef.value.scrollHeight;
  }
});

// Custom v-focus directive to auto-focus rename inputs
const vFocus = {
  mounted: (el) => el.focus()
};

</script>

<template>
  <div class="app-container" style="display: flex; height: 100vh; overflow: hidden;">
    
    <!-- Sidebar Toggle Button -->
    <button 
      @click="sidebarHidden = !sidebarHidden"
      class="sidebar-toggle-btn glass-panel"
      :style="{
        position: 'absolute',
        left: sidebarHidden ? '20px' : '400px',
        top: '20px',
        zIndex: 200,
        width: '36px',
        height: '36px',
        borderRadius: '6px',
        border: '1px solid var(--border-glow)',
        background: 'rgba(18, 19, 22, 0.85)',
        color: '#cbd5e1',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        backdropFilter: 'blur(12px)'
      }"
      :title="sidebarHidden ? t('showSidebar') : t('hideSidebar')"
    >
      <component :is="sidebarHidden ? Menu : ChevronLeft" :size="16" />
    </button>

    <!-- Sidebar -->
    <div :class="['sidebar', 'glass-panel', { 'collapsed': sidebarHidden }]">
      
      <!-- Sidebar Header -->
      <div class="sidebar-header">
        <div class="logo-text">
          <Sword class="logo-icon" style="color: var(--color-cyan);" />
          <a 
            href="https://github.com/Rimuwu/PA-Dashboard" 
            target="_blank" 
            rel="noopener noreferrer"
            class="logo-link"
          >PA: DASHBOARD <ExternalLink :size="10" style="margin-left:2px; vertical-align:middle; opacity:0.7;" /></a>
          <span class="logo-tag">AS1</span>
        </div>
        <div class="logo-sub">{{ t('logoSub') }}</div>
        
        <!-- Search -->
        <div class="search-container">
          <Search class="search-icon" :size="16" />
          <input 
            type="text" 
            v-model="searchQuery" 
            :placeholder="t('searchPlaceholder')" 
            class="search-input"
          />
        </div>
        
        <!-- Toggle Filters Button -->
        <div style="display: flex; justify-content: flex-end; margin-top: 8px; padding-right: 4px;">
          <button 
            @click="filtersCollapsed = !filtersCollapsed"
            style="background: transparent; border: none; color: var(--color-cyan); cursor: pointer; font-family: var(--font-title); font-size: 0.65rem; display: flex; align-items: center; gap: 4px; text-transform: uppercase;"
          >
            <component :is="filtersCollapsed ? ChevronDown : ChevronUp" :size="12" />
            {{ filtersCollapsed ? (lang === 'ru' ? 'Показать фильтры' : 'Show filters') : (lang === 'ru' ? 'Скрыть фильтры' : 'Hide filters') }}
          </button>
        </div>

      </div>
      
      <!-- Category Grid (Categories) -->
      <div class="sub-filters-container filter-group-block" v-show="!filtersCollapsed">
        <div class="filter-group-label collapsible-header" @click="collapsedFilterGroups.category = !collapsedFilterGroups.category">
          <div style="display:flex; align-items:center; gap:6px;">
            <LayoutGrid :size="11" />
            {{ lang === 'ru' ? 'Категории' : 'Categories' }}
          </div>
          <ChevronDown :size="12" :style="{ transform: collapsedFilterGroups.category ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s' }" />
        </div>
        <div class="category-grid" v-show="!collapsedFilterGroups.category" style="margin-top: 6px;">
          <button 
            v-for="cat in categories" 
            :key="cat.id"
            @click="selectedCategory = cat.id"
            :class="['category-card', { active: selectedCategory === cat.id }]"
          >
            <component :is="getCategoryIcon(cat.id)" class="category-icon" />
            <span class="category-label">{{ t(cat.id) }}</span>
          </button>
        </div>
      </div>

      <!-- Sub filter selectors (Types) -->
      <div class="sub-filters-container filter-group-block" v-show="!filtersCollapsed">
        <div class="filter-group-label collapsible-header" @click="collapsedFilterGroups.subFilter = !collapsedFilterGroups.subFilter">
          <div style="display:flex; align-items:center; gap:6px;">
            <Activity :size="11" />
            {{ lang === 'ru' ? 'Тип объекта' : 'Object Type' }}
          </div>
          <ChevronDown :size="12" :style="{ transform: collapsedFilterGroups.subFilter ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s' }" />
        </div>
        <div class="filter-group-chips" v-show="!collapsedFilterGroups.subFilter" style="margin-top: 6px; display: flex; flex-wrap: wrap; gap: 6px;">
          <button 
            v-for="f in [
              { id: 'all', label: t('all'), icon: LayoutGrid }, 
              { id: 'structures', label: t('bldgs'), icon: Hammer }, 
              { id: 'mobile', label: t('units'), icon: Activity }, 
              { id: 'combat', label: t('combat'), icon: Crosshair },
              { id: 'factories', label: t('factories'), icon: Factory }
            ]"
            :key="f.id"
            @click="activeSubFilter = f.id"
            :class="['sub-filter-chip', { active: activeSubFilter === f.id }]"
            style="flex: 1 1 calc(50% - 6px); justify-content: center;"
          >
            <component :is="f.icon" class="chip-icon" />
            <span style="white-space: nowrap;">{{ f.label }}</span>
          </button>
        </div>
      </div>

      <!-- Target Filter (Кого атакуют) — multi-select -->
      <div class="sub-filters-container filter-group-block" v-show="!filtersCollapsed">
        <div class="filter-group-label collapsible-header" @click="collapsedFilterGroups.target = !collapsedFilterGroups.target">
          <div style="display:flex; align-items:center; gap:6px;">
            <Target :size="11" />
            {{ lang === 'ru' ? 'Кого атакуют' : 'Target Types' }}
            <span v-if="activeTargetFilters.length > 0" class="filter-count-badge">{{ activeTargetFilters.length }}</span>
          </div>
          <ChevronDown :size="12" :style="{ transform: collapsedFilterGroups.target ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s' }" />
        </div>
        <div class="filter-group-chips" v-show="!collapsedFilterGroups.target">
          <button
            v-for="tf in [
              { id: 'land',    label: lang === 'ru' ? 'Земля' : 'Land' },
              { id: 'air',     label: lang === 'ru' ? 'Воздух' : 'Air' },
              { id: 'sea',     label: lang === 'ru' ? 'Море' : 'Sea' },
              { id: 'orbital', label: lang === 'ru' ? 'Орбита' : 'Orbital' }
            ]"
            :key="tf.id"
            @click="toggleTargetFilter(tf.id)"
            :class="['sub-filter-chip', { active: activeTargetFilters.includes(tf.id) }]"
          >{{ tf.label }}</button>
        </div>
      </div>

      <!-- Tier Filter — multi-select -->
      <div class="sub-filters-container filter-group-block" v-show="!filtersCollapsed">
        <div class="filter-group-label collapsible-header" @click="collapsedFilterGroups.tier = !collapsedFilterGroups.tier">
          <div style="display:flex; align-items:center; gap:6px;">
            <Star :size="11" />
            {{ lang === 'ru' ? 'Тир' : 'Tier' }}
            <span v-if="activeTierFilters.length > 0" class="filter-count-badge">{{ activeTierFilters.length }}</span>
          </div>
          <ChevronDown :size="12" :style="{ transform: collapsedFilterGroups.tier ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s' }" />
        </div>
        <div class="filter-group-chips" v-show="!collapsedFilterGroups.tier">
          <button
            v-for="tr in ['T1', 'T2', 'Titan']"
            :key="tr"
            @click="toggleTierFilter(tr)"
            :class="['sub-filter-chip', { active: activeTierFilters.includes(tr) }]"
          >{{ tr }}</button>
        </div>
      </div>

      <!-- Factory Filter -->
      <div class="sub-filters-container filter-group-block" v-show="!filtersCollapsed">
        <div class="filter-group-label collapsible-header" @click="collapsedFilterGroups.factory = !collapsedFilterGroups.factory" style="margin-bottom: 6px;">
          <div style="display:flex; align-items:center; gap:6px;">
            <Factory :size="11" />
            {{ t('factoryFilter') }}
          </div>
          <ChevronDown :size="12" :style="{ transform: collapsedFilterGroups.factory ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s' }" />
        </div>
        <select v-model="selectedFactoryFilter" class="sidebar-select" style="width: 100%;" v-show="!collapsedFilterGroups.factory">
          <option value="all">{{ t('factoryFilter_all') }}</option>
          <option value="commander">{{ lang === 'ru' ? 'Командиры (Все)' : 'Commanders (All)' }}</option>
          <option v-for="fact in sidebarFactories" :key="fact.id" :value="fact.id">
            {{ t('unit_name_' + fact.id) }}
          </option>
        </select>
      </div>

      <!-- Sorting Selector -->
      <div class="sub-filters-container filter-group-block" v-show="!filtersCollapsed">
        <div class="filter-group-label collapsible-header" @click="collapsedFilterGroups.sort = !collapsedFilterGroups.sort" style="margin-bottom: 6px;">
          <div style="display:flex; align-items:center; gap:6px;">
            <Sword :size="11" />
            {{ t('sortBy') }}
          </div>
          <ChevronDown :size="12" :style="{ transform: collapsedFilterGroups.sort ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s' }" />
        </div>
        <div style="display: flex; gap: 8px; width: 100%;" v-show="!collapsedFilterGroups.sort">
          <select v-model="sidebarSortBy" class="sidebar-select" style="flex: 1;">
            <option value="default">{{ t('sort_default') }}</option>
            <option value="name">{{ t('sort_name') }}</option>
            <option value="cost">{{ t('sort_cost') }}</option>
            <option value="health">{{ t('sort_health') }}</option>
            <option value="dps">{{ t('sort_dps') }}</option>
            <option value="range">{{ t('sort_range') }}</option>
            <option value="speed">{{ t('sort_speed') }}</option>
            <option value="vision">{{ t('sort_vision') }}</option>
          </select>
          <button 
            @click="sidebarSortOrder = sidebarSortOrder === 'asc' ? 'desc' : 'asc'" 
            class="btn" 
            style="padding: 4px 8px; font-size: 0.72rem; display: flex; align-items: center; border: 1px solid var(--border-dim); background: rgba(255,255,255,0.02);"
            :title="sidebarSortOrder === 'asc' ? (lang === 'ru' ? 'По возрастанию' : 'Ascending') : (lang === 'ru' ? 'По убыванию' : 'Descending')"
          >
            <component :is="sidebarSortOrder === 'asc' ? ArrowUp : ArrowDown" :size="12" />
          </button>
        </div>
      </div>

      <!-- Tags Filter -->
      <div class="sub-filters-container filter-group-block" v-show="!filtersCollapsed">
        <div class="filter-group-label collapsible-header" @click="collapsedFilterGroups.tags = !collapsedFilterGroups.tags">
          <div style="display:flex; align-items:center; gap:6px;">
            <Tag :size="11" style="transform: rotate(90deg);" />
            {{ t('tagsFilter') }}
            <span v-if="activeTagFilters.length > 0" class="filter-count-badge">{{ activeTagFilters.length }}</span>
          </div>
          <ChevronDown :size="12" :style="{ transform: collapsedFilterGroups.tags ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s' }" />
        </div>
        <div class="tags-filter-container" v-show="!collapsedFilterGroups.tags">
          <span 
            v-for="tag in ['Tank', 'Bot', 'Air', 'Naval', 'Orbital', 'Structure', 'Defense', 'Advanced', 'Basic', 'Fabber', 'Combat', 'Artillery', 'Tactical', 'Fighter', 'Bomber', 'Sub', 'Heavy', 'Mobile']" 
            :key="tag"
            @click="toggleTagFilter(tag)"
            :class="['tag-filter-chip', { active: activeTagFilters.includes(tag) }]"
          >
            {{ t('tag_' + tag) }}
          </span>
        </div>
      </div>
      
      <!-- Unit Grid List -->
      <div class="unit-list-container">
        <div style="display: flex; align-items: center; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 6px;">
          <div class="sidebar-section-title" style="margin-bottom: 0; line-height: 1;">{{ t('dragToCanvas') }}</div>
        </div>
        <div class="unit-grid-sidebar">
          <div 
            v-for="unit in filteredUnits" 
            :key="unit.id"
            class="sidebar-unit-card"
            draggable="true"
            @dragstart="onSidebarDragStart(unit, $event)"
          >
            <img :src="unit.icon" :alt="unit.name" class="sidebar-unit-img" />
            <div class="sidebar-unit-name">{{ t('unit_name_' + unit.id) }}</div>
            <div style="display: flex; gap: 6px; align-items: center; justify-content: center; flex-wrap: wrap; margin-top: 2px;">
              <div class="sidebar-unit-cost" style="margin: 0;">{{ unit.cost }} M</div>
              <div v-if="getUnitEnergyStats(unit)?.energyProd > 0" class="sidebar-unit-energy-prod" style="font-size: 0.62rem; color: #4ade80; font-weight: bold; background: rgba(74, 222, 128, 0.08); padding: 1px 4px; border-radius: 3px;">
                +{{ getUnitEnergyStats(unit).energyProd }} E
              </div>
              <div v-if="getUnitMetalStats(unit)?.metalProd > 0" class="sidebar-unit-metal-prod" style="font-size: 0.62rem; color: #4ade80; font-weight: bold; background: rgba(74, 222, 128, 0.08); padding: 1px 4px; border-radius: 3px;">
                +{{ getUnitMetalStats(unit).metalProd }} M
              </div>
            </div>

            <!-- Custom Tooltip on Hover -->
            <div class="tooltip-custom">
              <div class="tooltip-title">{{ t('unit_name_' + unit.id) }}</div>
              <div class="tooltip-desc">{{ lang === 'ru' ? t('unit_desc_' + unit.id) || unit.description : unit.description }}</div>
              <div style="margin-top: 8px; font-size: 0.68rem; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 6px; display: flex; flex-direction: column; gap: 3px;">
                <div style="display:flex; justify-content:space-between; width: 100%;">
                  <span style="color:var(--text-dim);">HP:</span>
                  <span>{{ unit.health?.toLocaleString() }}</span>
                </div>
                <div style="display:flex; justify-content:space-between; width: 100%;">
                  <span style="color:var(--text-dim);">{{ lang === 'ru' ? 'Металл:' : 'Metal:' }}</span>
                  <span style="color: var(--color-orange); font-weight: bold;">{{ unit.cost?.toLocaleString() }} M</span>
                </div>
                <!-- Build energy for structures in tooltip -->
                <div v-if="unit.unit_types?.includes('UNITTYPE_Structure')" style="display:flex; justify-content:space-between; width: 100%;">
                  <span style="color:var(--text-dim);">{{ lang === 'ru' ? 'Энергия (постр.):' : 'Build Energy:' }}</span>
                  <span style="color:var(--color-cyan); font-weight: bold;">{{ (unit.cost * 25).toLocaleString() }} E</span>
                </div>
                <!-- Energy production in tooltip -->
                <div v-if="getUnitEnergyStats(unit)?.energyProd > 0" style="display:flex; justify-content:space-between; width: 100%;">
                  <span style="color:var(--text-dim);">{{ lang === 'ru' ? 'Энергия (выработка):' : 'Energy Prod:' }}</span>
                  <span style="color:#4ade80; font-weight: bold;">+{{ getUnitEnergyStats(unit).energyProd.toLocaleString() }} E/s</span>
                </div>
                <!-- Metal production in tooltip -->
                <div v-if="getUnitMetalStats(unit)?.metalProd > 0" style="display:flex; justify-content:space-between; width: 100%;">
                  <span style="color:var(--text-dim);">{{ lang === 'ru' ? 'Металл (выработка):' : 'Metal Prod:' }}</span>
                  <span style="color:#4ade80; font-weight: bold;">+{{ getUnitMetalStats(unit).metalProd.toLocaleString() }} M/s</span>
                </div>
                <!-- Energy consumption in tooltip -->
                <div v-if="getUnitEnergyStats(unit)?.energyCons > 0" style="display:flex; justify-content:space-between; width: 100%;">
                  <span style="color:var(--text-dim);">{{ lang === 'ru' ? 'Энергия (потребл.):' : 'Energy Cons:' }}</span>
                  <span style="color:#f87171; font-weight: bold;">-{{ getUnitEnergyStats(unit).energyCons.toLocaleString() }} E/s</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-if="filteredUnits.length === 0" style="text-align: center; color: var(--text-dim); margin-top: 40px; font-size: 0.85rem;">
          No matching units found
        </div>
      </div>
      
    </div>
    
    <!-- Workspace -->
    <div :class="['workspace', { 'full-width': sidebarHidden }]">
      
      <!-- Top controls bar -->
      <div class="controls-bar" :class="{ 'controls-simulating': animSim && animSim.isPlaying }">
        <!-- Row 1: action buttons -->
        <div class="ctrl-btn-row">
          <button class="btn btn-secondary" @click="goToCenter" :title="t('focusCenter')">
            <Crosshair :size="13" />
          </button>
          <button class="btn btn-secondary" @click="triggerFileInput" :title="t('loadLayout')">
            <FolderOpen :size="13" />
            <span class="btn-label">{{ t('loadLayout') }}</span>
          </button>
          <button class="btn btn-secondary" @click="saveToFile" :title="t('saveLayout')">
            <Save :size="13" />
            <span class="btn-label">{{ t('saveLayout') }}</span>
          </button>
          <button class="btn btn-secondary" @click="showSimSettingsModal = true" :title="lang === 'ru' ? 'Настройки симуляции' : 'Sim Settings'">
            <Settings :size="13" />
          </button>
          <button class="btn btn-secondary" @click="undoLastAction" :disabled="undoStack.length === 0" :title="lang === 'ru' ? 'Отменить действие (Ctrl+Z)' : 'Undo Action (Ctrl+Z)'">
            <Undo2 :size="13" />
            <span class="btn-label">{{ lang === 'ru' ? 'Назад' : 'Undo' }}</span>
          </button>
          <button class="btn btn-danger" @click="clearBoard" :title="t('clear')">
            <RefreshCw :size="13" />
          </button>
          <button class="btn" style="border-color: var(--border-dim); color: var(--text-secondary); background: rgba(255,255,255,0.04);" @click="showHelpModal = true" :title="t('help')">
            <Info :size="13" />
          </button>
        </div>
        <!-- Row 2: toggles -->
        <div class="ctrl-check-row">
          <label class="ctrl-check">
            <input type="checkbox" v-model="gridEnabled" />
            <span>{{ t('grid') }}</span>
          </label>
          <span class="ctrl-sep"></span>
          <label class="ctrl-check">
            <input type="checkbox" v-model="snapToGrid" />
            <span>{{ t('snap') }}</span>
          </label>
        </div>
      </div>

      <!-- Zoom UI Indicator -->
      <div class="zoom-controls">
        <button class="qty-btn" @click="zoomOut" style="padding: 2px 6px;"><ZoomOut :size="16" /></button>
        <span style="font-family: var(--font-title); font-size: 0.75rem; color: var(--color-cyan); min-width: 42px; text-align: center;">
          {{ Math.round(canvasZoom * 100) }}%
        </span>
        <button class="qty-btn" @click="zoomIn" style="padding: 2px 6px;"><ZoomIn :size="16" /></button>
        <button class="qty-btn" @click="resetZoom" style="padding: 2px 6px; color: var(--text-secondary); margin-left: 4px;" :title="lang === 'ru' ? 'Сбросить зум' : 'Reset Zoom'"><RefreshCw :size="14" /></button>
        <button class="qty-btn" @click="goToCenter" :title="t('focusCenter')" style="padding: 2px 6px; color: var(--color-cyan); margin-left: 4px;"><Crosshair :size="14" /></button>
      </div>

      <!-- Canvas Container -->
      <div 
        ref="canvasRef"
        class="canvas-container"
        @mousedown="startPanning"
        @mousemove="panCanvas"
        @mouseup="stopPanning"
        @mouseleave="stopPanning"
        @wheel.prevent="handleZoom"
        @contextmenu.prevent="onCanvasContextMenu"
        @dragenter.prevent
        @dragover.prevent
        @drop="onCanvasDrop"
      >
        
        <!-- Zoomed/Panned Canvas Grid -->
        <div 
          :class="['canvas-grid', { 'hide-grid-lines': !gridEnabled }]"
          :style="{
            transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${canvasZoom})`
          }"
          @dragover.prevent
          @drop="onCanvasDrop"
        >
          
          <!-- Group Areas -->
          <div 
            v-for="area in groupAreas" 
            :key="area.uuid"
            :class="[
              'group-area', 
              { 
                'active-drag': activeDragArea?.uuid === area.uuid,
                'connected-active': connections.some(c => c.fromUuid === area.uuid || c.toUuid === area.uuid),
                'combat-winner': nodeCombatStatus[area.uuid] === 'winner',
                'combat-loser': nodeCombatStatus[area.uuid] === 'loser',
                'combat-draw': nodeCombatStatus[area.uuid] === 'draw'
              }
            ]"
            :style="{
              left: `${area.x}px`,
              top: `${area.y}px`,
              width: `${area.width || 380}px`,
              height: `${area.height || 260}px`
            }"
            @mouseup="completeConnection(area, $event)"
            @contextmenu.prevent.stop="onAreaContextMenu(area, $event)"
          >
            <!-- Area Header -->
            <div class="group-area-header" @mousedown="startDragArea(area, $event)">
              <div class="group-area-title">
                <span v-if="!area.isEditingName" @dblclick="renameGroupArea(area)">
                  {{ area.name }} ({{ getAreaUnits(area.uuid).length }} шт.)
                </span>
                <input 
                  v-else
                  type="text"
                  v-model="area.name"
                  @blur="area.isEditingName = false"
                  @keydown.enter="area.isEditingName = false"
                  class="group-area-title-input"
                  v-focus
                />
              </div>
              <div class="group-area-actions">
                <button 
                  v-if="connections.some(c => c.fromUuid === area.uuid || c.toUuid === area.uuid)"
                  class="group-area-action-btn"
                  @click.stop="recalculateAreaBattle(area)"
                  :title="t('recalculateBattle')"
                  style="color: var(--color-green); margin-right: 4px;"
                >
                  <Sword :size="12" />
                </button>
                <button 
                  class="group-area-action-btn"
                  @click.stop="renameGroupArea(area)"
                  :title="t('renameArea')"
                >
                  <Edit2 :size="12" />
                </button>
                <button 
                  class="group-area-action-btn"
                  @click.stop="deleteAreaUnits(area.uuid)"
                  :title="t('clearArea')"
                >
                  <Trash2 :size="12" style="color: #ef4444;" />
                </button>
                <button 
                  class="group-area-action-btn"
                  @click.stop="deleteGroupArea(area.uuid)"
                  :title="t('deleteArea')"
                >
                  <X :size="12" />
                </button>
              </div>
            </div>
            
            <!-- Area Body -->
            <div class="group-area-body"></div>
            
            <!-- Connection Ports -->
            <div 
              class="connection-node node-left"
              @mousedown="startConnection(area, 'left', $event)"
            ></div>
            <div 
              class="connection-node node-right"
              @mousedown="startConnection(area, 'right', $event)"
            ></div>
            
            <!-- Resize Corner Handle -->
            <div 
              class="group-area-resize-handle"
              @mousedown="startResizeArea(area, $event)"
            ></div>
          </div>

          <!-- Connection SVGs -->
          <svg class="connections-svg">
            <!-- Render completed connections -->
            <path 
              v-for="conn in activeConnections" 
              :key="conn.uuid"
              :d="conn.pathD"
              :class="[
                'connection-path', 
                { 
                  'winner-a': conn.simResult?.winner === 'A',
                  'winner-b': conn.simResult?.winner === 'B'
                }
              ]"
            />
            
            <!-- Render drag link -->
            <path 
              v-if="activeConnectionDrag" 
              :d="dragConnectionPath" 
              class="connection-path active-drag"
            />
          </svg>
          
          <!-- Connection VS Badges -->
          <div 
            v-for="conn in activeConnections" 
            :key="'badge-' + conn.uuid"
            :class="[
              'connection-badge', 
              { 
                'winner-a': conn.simResult?.winner === 'A',
                'winner-b': conn.simResult?.winner === 'B'
              }
            ]"
            :style="{
              left: `${conn.midX}px`,
              top: `${conn.midY}px`
            }"
            @click="openSimModalForConnection(conn)"
            @contextmenu.prevent.stop="onConnectionContextMenu(conn, $event)"
          >
            <Sword :size="12" class="sim-vs-icon" />
            <span class="badge-vs">VS</span>
            <span class="badge-result" v-if="conn.simResult">
              <span v-if="conn.simResult.winner === 'A'" class="text-winner">{{ conn.simResult.a.name }}</span>
              <span v-else-if="conn.simResult.winner === 'B'" class="text-winner">{{ conn.simResult.b.name }}</span>
              <span v-else class="text-loser">Draw</span>
            </span>
            
            <!-- Trash button to delete connection -->
            <button 
              @click.stop="removeConnection(conn.uuid)" 
              class="remove-connection-btn"
              :title="t('deleteConn')"
            >
              <X :size="10" />
            </button>
          </div>

          <!-- Area Selection Box -->
          <div 
            v-if="selectionBox" 
            class="selection-box"
            :style="{
              left: `${Math.min(selectionBox.startX, selectionBox.currentX)}px`,
              top: `${Math.min(selectionBox.startY, selectionBox.currentY)}px`,
              width: `${Math.abs(selectionBox.startX - selectionBox.currentX)}px`,
              height: `${Math.abs(selectionBox.startY - selectionBox.currentY)}px`
            }"
          ></div>
          
          <!-- Unit Cards -->
          <div 
            v-for="placed in placedUnits.filter(u => !u.timelineColId)" 
            :key="placed.uuid"
            :class="[
              'unit-card', 
              { 
                'selected': selectedCardUuids.includes(placed.uuid),
                'overlap-active': overlappingCardUuids.includes(placed.uuid),
                'is-grouped': groupedCardUuids.includes(placed.uuid),
                'is-connected': connectedCardUuids.includes(placed.uuid),
                'combat-winner': cardSurvivalStatus[placed.uuid] === 'winner',
                'combat-loser': cardSurvivalStatus[placed.uuid] === 'loser',
                'combat-draw': cardSurvivalStatus[placed.uuid] === 'draw'
              }
            ]"
            :style="{
              left: `${placed.x}px`,
              top: `${placed.y}px`,
              zIndex: placed.zIndex || 10
            }"
            @mousedown="onCardMousedown(placed, $event)"
            @mouseup="completeConnection(placed, $event)"
            @contextmenu.prevent.stop="onCardContextMenu(placed, $event)"
          >
            
            <div class="unit-card-header">
              <img 
                :src="placed.skinIcon || getUnitById(placed.unitId)?.icon" 
                class="unit-card-icon" 
                :title="lang === 'ru' ? 'Зажмите левую кнопку мыши для переноса' : 'Hold left click to move'"
              />
              <div class="unit-card-title">{{ placed.skinName || t('unit_name_' + placed.unitId) }}</div>
              
              <!-- Skin Switcher Button for Commanders -->
              <button 
                v-if="getUnitById(placed.unitId)?.category === 'commander' || placed.unitId.includes('commander')"
                class="qty-btn"
                style="padding: 2px 5px; margin-right: 4px; color: var(--color-cyan);"
                @click.stop="openSkinModal(placed)"
                :title="lang === 'ru' ? 'Сменить скин Командира' : 'Change Commander Skin'"
              >
                <Palette :size="12" />
              </button>



              <!-- Overlapping warning icon -->
              <div 
                v-if="overlappingCardUuids.includes(placed.uuid)" 
                class="overlap-warning"
                :title="t('overlapping')"
              >
                <AlertTriangle :size="14" />
              </div>
              
              <input
                v-if="selectedCardUuids.length > 0"
                type="checkbox"
                :checked="selectedCardUuids.includes(placed.uuid)"
                @change.stop="toggleCardSelection(placed.uuid)"
                class="card-select-checkbox"
                style="margin-right: 6px; cursor: pointer; accent-color: var(--color-cyan);"
                title="Select card"
              />
              <button class="close-btn" @click.stop="removePlacedUnit(placed.uuid)">&times;</button>
            </div>
            
            <div class="unit-card-body">
              <div class="stat-row">
                <span class="stat-label">{{ t('hp') }}:</span>
                <span class="stat-value">{{ getUnitById(placed.unitId)?.health?.toLocaleString() }}</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">{{ t('cost') }}:</span>
                <span class="stat-value" style="color: var(--color-orange);">{{ (getUnitById(placed.unitId)?.cost * placed.count).toLocaleString() }} M</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">{{ t('dps') }}:</span>
                <span class="stat-value">{{ Math.round(getUnitById(placed.unitId)?.dps * placed.count) }}</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">{{ t('range') }}:</span>
                <span class="stat-value">{{ getUnitById(placed.unitId)?.range }}</span>
              </div>
              <!-- Tier badge -->
              <div class="stat-row">
                <span class="stat-label">{{ lang === 'ru' ? 'Уровень' : 'Tier' }}:</span>
                <span class="tier-badge" :class="'tier-' + (getUnitById(placed.unitId)?.tier || 'T1').toLowerCase()">
                  {{ getUnitById(placed.unitId)?.tier || 'T1' }}
                </span>
              </div>
              
              <!-- Build Energy (for structures) -->
              <div class="stat-row" v-if="getUnitById(placed.unitId)?.unit_types?.includes('UNITTYPE_Structure')">
                <span class="stat-label">{{ lang === 'ru' ? 'Энергия (постр.)' : 'Build Energy' }}:</span>
                <span class="stat-value" style="color: var(--color-cyan);">{{ (getUnitById(placed.unitId)?.cost * 25 * placed.count).toLocaleString() }} E</span>
              </div>
              <!-- Energy Production -->
              <div class="stat-row" v-if="getUnitEnergyStats(getUnitById(placed.unitId))?.energyProd > 0">
                <span class="stat-label">{{ lang === 'ru' ? 'Выработка эн.' : 'Energy Prod.' }}:</span>
                <span class="stat-value" style="color: #4ade80;">+{{ (getUnitEnergyStats(getUnitById(placed.unitId)).energyProd * placed.count).toLocaleString() }} E/s</span>
              </div>
              <!-- Metal Production -->
              <div class="stat-row" v-if="getUnitMetalStats(getUnitById(placed.unitId))?.metalProd > 0">
                <span class="stat-label">{{ lang === 'ru' ? 'Выработка мет.' : 'Metal Prod.' }}:</span>
                <span class="stat-value" style="color: #4ade80;">+{{ (getUnitMetalStats(getUnitById(placed.unitId)).metalProd * placed.count).toLocaleString() }} M/s</span>
              </div>
              <!-- Energy Consumption -->
              <div class="stat-row" v-if="getUnitEnergyStats(getUnitById(placed.unitId))?.energyCons > 0">
                <span class="stat-label">{{ lang === 'ru' ? 'Потребление эн.' : 'Energy Cons.' }}:</span>
                <span class="stat-value" style="color: #f87171;">-{{ (getUnitEnergyStats(getUnitById(placed.unitId)).energyCons * placed.count).toLocaleString() }} E/s</span>
              </div>

              <!-- Target type badges -->
              <div class="stat-row-tags" v-if="getUnitById(placed.unitId)?.target_labels?.length">
                <span class="stat-label">{{ lang === 'ru' ? 'Цели' : 'Targets' }}:</span>
                <div class="tags-wrap">
                  <span 
                    v-for="lbl in getUnitById(placed.unitId).target_labels" 
                    :key="lbl"
                    class="target-badge"
                    :class="'target-' + normalizeLayer(lbl)"
                  >{{ formatTargetLabel(lbl) }}</span>
                </div>
              </div>
              <!-- Attack speed (shots/sec) — from first weapon -->
              <div class="stat-row" v-if="getUnitById(placed.unitId)?.weapons?.length">
                <span class="stat-label">{{ lang === 'ru' ? 'Ск. атаки' : 'Atk/s' }}:</span>
                <span class="stat-value">{{ getUnitById(placed.unitId).weapons.map(w => w.rate_of_fire.toFixed(2)).join(' / ') }}</span>
              </div>
              <!-- Repair rate for builders -->
              <div class="stat-row" v-if="getUnitById(placed.unitId)?.is_builder && getUnitById(placed.unitId)?.build_metal_rate">
                <span class="stat-label">{{ lang === 'ru' ? 'Ремонт' : 'Repair' }}:</span>
                <span class="stat-value" style="color: #34d399;">{{ getUnitById(placed.unitId).build_metal_rate }} m/s</span>
              </div>
              
              <!-- Quantity Controller -->
              <div class="qty-controller">
                <button class="qty-btn" @click="adjustCount(placed, -1)" @mousedown.stop>&minus;</button>
                <input 
                  type="number" 
                  min="1"
                  max="10000"
                  v-model.number="placed.count" 
                  @input="updateCount(placed, $event)"
                  @mousedown.stop
                  class="qty-input"
                />
                <button class="qty-btn" @click="adjustCount(placed, 1)" @mousedown.stop>&plus;</button>
              </div>
              
              <!-- Actions -->
              <div class="card-actions">
                <button 
                  v-if="getUnitById(placed.unitId)?.buildable_unit_ids?.length > 0"
                  class="card-btn card-btn-factory"
                  @click.stop="placed.showFactoryMenu = !placed.showFactoryMenu"
                  @mousedown.stop
                >
                  <Factory :size="12" />
                  {{ t('spawnBuildable') }}
                </button>
              </div>
              
              <!-- Factory Spawn Queue Popover -->
              <div v-if="placed.showFactoryMenu" class="factory-popup" @mousedown.stop @wheel.stop>
                <div class="factory-popup-header">Factory Queue</div>
                <div class="factory-grid">
                  <div 
                    v-for="buildId in getUnitById(placed.unitId)?.buildable_unit_ids"
                    :key="buildId"
                    class="factory-item"
                    @click="spawnFromFactory(placed, buildId)"
                    :title="getUnitById(buildId)?.name"
                  >
                    <img :src="getUnitById(buildId)?.icon" class="factory-item-img" />
                  </div>
                </div>
              </div>
              
            </div>
            
            <!-- Connection Ports -->
            <div 
              class="connection-node node-left"
              @mousedown="startConnection(placed, 'left', $event)"
            ></div>
            <div 
              class="connection-node node-right"
              @mousedown="startConnection(placed, 'right', $event)"
            ></div>
          </div>

          <!-- Notes -->
          <div 
            v-for="note in notes" 
            :key="note.uuid"
            class="sticky-note"
            :style="{
              left: `${note.x}px`,
              top: `${note.y}px`,
              width: `${note.width || 320}px`,
              height: `${note.height || 180}px`,
              zIndex: note.zIndex || 10
            }"
            @mousedown="onNoteMousedown(note, $event)"
            @contextmenu.prevent.stop="onNoteContextMenu(note, $event)"
          >
            <!-- Note Header -->
            <div class="note-header" :style="{ background: note.color || 'rgba(255, 255, 255, 0.08)' }">
              <!-- Color controls -->
              <div class="note-colors" v-if="note.uuid !== 'default-note-ru' && note.uuid !== 'default-note-en'">
                <span 
                  v-for="c in ['rgba(255,255,255,0.08)', 'rgba(22,78,99,0.45)', 'rgba(99,22,78,0.45)', 'rgba(20,83,45,0.45)', 'rgba(120,53,4,0.45)']" 
                  :key="c"
                  class="color-dot"
                  :style="{ background: c, border: (note.color === c || (!note.color && c === 'rgba(255,255,255,0.08)')) ? '1.5px solid var(--color-cyan)' : '1px solid rgba(255,255,255,0.2)' }"
                  @mousedown.stop
                  @click="note.color = c; saveToLocalStorage()"
                ></span>
              </div>
              <button v-if="note.uuid !== 'default-note-ru' && note.uuid !== 'default-note-en'" class="note-delete-btn" @mousedown.stop @click="deleteNote(note.uuid)" :title="lang === 'ru' ? 'Удалить заметку' : 'Delete Note'">
                <X :size="12" />
              </button>
            </div>
            
            <!-- Note Body -->
            <div class="note-body" :style="{ background: note.color || 'rgba(255, 255, 255, 0.08)' }" @mousedown.stop>
              <!-- Editing textarea -->
              <textarea 
                v-if="note.isEditing"
                v-model="note.text"
                class="note-textarea"
                @blur="note.isEditing = false; saveToLocalStorage()"
                @keydown.enter.ctrl="note.isEditing = false; saveToLocalStorage()"
                placeholder="Markdown..."
              ></textarea>
              <!-- Rendered Markdown view -->
              <div 
                v-else
                class="note-rendered"
                @dblclick="editNote(note)"
                v-html="parseMarkdown(note.text) || `<em style='color:var(--text-dim)'>${lang === 'ru' ? 'Дважды кликните для редактирования...' : 'Double click to edit...'}</em>`"
              ></div>
            </div>
            
            <!-- Note Resize Handle -->
            <div 
              v-if="note.uuid !== 'default-note-ru' && note.uuid !== 'default-note-en'"
              class="note-resize-handle"
              @mousedown="startResizeNote(note, $event)"
            ></div>
          </div>

          <!-- Timeline Panels -->
          <div 
            v-for="panel in timelinePanels" 
            :key="panel.uuid"
            class="timeline-panel"
            :style="{
              left: `${panel.x}px`,
              top: `${panel.y}px`,
              zIndex: 8
            }"
            @mousedown="onTimelineMousedown(panel, $event)"
          >
            <div class="timeline-panel-header">
              <div style="display: flex; align-items: center; gap: 6px;">
                <Clock :size="14" style="color: var(--color-cyan);" />
                <span style="font-family: var(--font-title); font-size: 0.72rem; font-weight: bold; text-transform: uppercase;">
                  {{ lang === 'ru' ? 'Временная шкала построек' : 'Build Order Timeline' }}
                </span>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <button 
                  class="qty-btn" 
                  @click="addColumnToTimeline(panel)" 
                  :title="lang === 'ru' ? 'Добавить минуту' : 'Add Minute'"
                >
                  <Plus :size="12" />
                </button>
                <button 
                  class="qty-btn" 
                  style="color: var(--color-red);" 
                  @click="removeTimelinePanel(panel.uuid)"
                  :title="lang === 'ru' ? 'Удалить панель' : 'Delete Panel'"
                >
                  <X :size="12" />
                </button>
              </div>
            </div>

            <div class="timeline-columns-wrap">
              <div 
                v-for="col in panel.columns" 
                :key="col.id"
                class="timeline-col"
                :style="{
                  width: `${col.width || 250}px`,
                  height: `${panel.height || col.height || 420}px`
                }"
                @dragover.prevent
              >
                <div class="timeline-col-header">
                  <span style="font-size: 0.8rem; color: var(--text-dim); font-weight: bold;">
                    {{ lang === 'ru' ? 'Мин:' : 'Min:' }}
                  </span>
                  <input 
                    type="number" 
                    v-model.number="col.minute" 
                    @change="onTimelineMinuteChange(panel, col)"
                    min="0"
                    max="120"
                    class="timeline-minute-input"
                  />
                  <button 
                    class="timeline-col-delete-btn" 
                    @click="removeColumnFromTimeline(panel, col.id)"
                    :title="lang === 'ru' ? 'Удалить столбец' : 'Delete Column'"
                  >
                    <X :size="10" />
                  </button>
                </div>

                <!-- Unit List in Column (Full Size Cards) -->
                <div class="timeline-col-body">
                  <div v-if="placedUnits.filter(u => u.timelineColId === col.id).length === 0" class="timeline-empty-drop-zone">
                    {{ lang === 'ru' ? 'Перетащите сюда' : 'Drag unit here' }}
                  </div>
                  
                  <div 
                    v-for="placed in placedUnits.filter(u => u.timelineColId === col.id)" 
                    :key="placed.uuid"
                    :class="[
                      'unit-card', 
                      { 
                        'selected': selectedCardUuids.includes(placed.uuid),
                        'overlap-active': overlappingCardUuids.includes(placed.uuid),
                        'is-grouped': groupedCardUuids.includes(placed.uuid),
                        'is-connected': connectedCardUuids.includes(placed.uuid),
                        'combat-winner': cardSurvivalStatus[placed.uuid] === 'winner',
                        'combat-loser': cardSurvivalStatus[placed.uuid] === 'loser',
                        'combat-draw': cardSurvivalStatus[placed.uuid] === 'draw',
                        'active-drag': activeDragCard?.uuid === placed.uuid
                      }
                    ]"
                    :style="{
                      left: `${placed.x}px`,
                      top: `${placed.y}px`,
                      zIndex: placed.zIndex || 10
                    }"
                    @mousedown="onCardMousedown(placed, $event)"
                    @mouseup="completeConnection(placed, $event)"
                    @contextmenu.prevent.stop="onCardContextMenu(placed, $event)"
                  >
                    
                    <div class="unit-card-header">
                      <img 
                        :src="placed.skinIcon || getUnitById(placed.unitId)?.icon" 
                        class="unit-card-icon" 
                        :title="lang === 'ru' ? 'Зажмите левую кнопку мыши для переноса' : 'Hold left click to move'"
                      />
                      <div class="unit-card-title">{{ placed.skinName || t('unit_name_' + placed.unitId) }}</div>
                      
                      <!-- Skin Switcher Button for Commanders -->
                      <button 
                        v-if="getUnitById(placed.unitId)?.category === 'commander' || placed.unitId.includes('commander')"
                        class="qty-btn"
                        style="padding: 2px 5px; margin-right: 4px; color: var(--color-cyan);"
                        @click.stop="openSkinModal(placed)"
                        :title="lang === 'ru' ? 'Сменить скин Командира' : 'Change Commander Skin'"
                      >
                        <Palette :size="12" />
                      </button>

                      <!-- Overlapping warning icon -->
                      <div 
                        v-if="overlappingCardUuids.includes(placed.uuid)" 
                        class="overlap-warning"
                        :title="t('overlapping')"
                      >
                        <AlertTriangle :size="14" />
                      </div>
                      
                      <input
                        v-if="selectedCardUuids.length > 0"
                        type="checkbox"
                        :checked="selectedCardUuids.includes(placed.uuid)"
                        @change.stop="toggleCardSelection(placed.uuid)"
                        class="card-select-checkbox"
                        style="margin-right: 6px; cursor: pointer; accent-color: var(--color-cyan);"
                        title="Select card"
                      />
                      <button class="close-btn" @click.stop="removePlacedUnit(placed.uuid)">&times;</button>
                    </div>
                    
                    <div class="unit-card-body">
                      <div class="stat-row">
                        <span class="stat-label">{{ t('hp') }}:</span>
                        <span class="stat-value">{{ getUnitById(placed.unitId)?.health?.toLocaleString() }}</span>
                      </div>
                      <div class="stat-row">
                        <span class="stat-label">{{ t('cost') }}:</span>
                        <span class="stat-value" style="color: var(--color-orange);">{{ (getUnitById(placed.unitId)?.cost * placed.count).toLocaleString() }} M</span>
                      </div>
                      <div class="stat-row">
                        <span class="stat-label">{{ t('dps') }}:</span>
                        <span class="stat-value">{{ Math.round(getUnitById(placed.unitId)?.dps * placed.count) }}</span>
                      </div>
                      <div class="stat-row">
                        <span class="stat-label">{{ t('range') }}:</span>
                        <span class="stat-value">{{ getUnitById(placed.unitId)?.range }}</span>
                      </div>
                      <!-- Tier badge -->
                      <div class="stat-row">
                        <span class="stat-label">{{ lang === 'ru' ? 'Уровень' : 'Tier' }}:</span>
                        <span class="tier-badge" :class="'tier-' + (getUnitById(placed.unitId)?.tier || 'T1').toLowerCase()">
                          {{ getUnitById(placed.unitId)?.tier || 'T1' }}
                        </span>
                      </div>
                      
                      <!-- Build Energy (for structures) -->
                      <div class="stat-row" v-if="getUnitById(placed.unitId)?.unit_types?.includes('UNITTYPE_Structure')">
                        <span class="stat-label">{{ lang === 'ru' ? 'Энергия (постр.)' : 'Build Energy' }}:</span>
                        <span class="stat-value" style="color: var(--color-cyan);">{{ (getUnitById(placed.unitId)?.cost * 25 * placed.count).toLocaleString() }} E</span>
                      </div>
                      <!-- Energy Production -->
                      <div class="stat-row" v-if="getUnitEnergyStats(getUnitById(placed.unitId))?.energyProd > 0">
                        <span class="stat-label">{{ lang === 'ru' ? 'Выработка эн.' : 'Energy Prod.' }}:</span>
                        <span class="stat-value" style="color: #4ade80;">+{{ (getUnitEnergyStats(getUnitById(placed.unitId)).energyProd * placed.count).toLocaleString() }} E/s</span>
                      </div>
                      <!-- Metal Production -->
                      <div class="stat-row" v-if="getUnitMetalStats(getUnitById(placed.unitId))?.metalProd > 0">
                        <span class="stat-label">{{ lang === 'ru' ? 'Выработка мет.' : 'Metal Prod.' }}:</span>
                        <span class="stat-value" style="color: #4ade80;">+{{ (getUnitMetalStats(getUnitById(placed.unitId)).metalProd * placed.count).toLocaleString() }} M/s</span>
                      </div>
                      <!-- Energy Consumption -->
                      <div class="stat-row" v-if="getUnitEnergyStats(getUnitById(placed.unitId))?.energyCons > 0">
                        <span class="stat-label">{{ lang === 'ru' ? 'Потребление эн.' : 'Energy Cons.' }}:</span>
                        <span class="stat-value" style="color: #f87171;">-{{ (getUnitEnergyStats(getUnitById(placed.unitId)).energyCons * placed.count).toLocaleString() }} E/s</span>
                      </div>

                      <!-- Target type badges -->
                      <div class="stat-row-tags" v-if="getUnitById(placed.unitId)?.target_labels?.length">
                        <span class="stat-label">{{ lang === 'ru' ? 'Цели' : 'Targets' }}:</span>
                        <div class="tags-wrap">
                          <span 
                            v-for="lbl in getUnitById(placed.unitId).target_labels" 
                            :key="lbl"
                            class="target-badge"
                            :class="'target-' + normalizeLayer(lbl)"
                          >{{ formatTargetLabel(lbl) }}</span>
                        </div>
                      </div>
                      <!-- Attack speed (shots/sec) — from first weapon -->
                      <div class="stat-row" v-if="getUnitById(placed.unitId)?.weapons?.length">
                        <span class="stat-label">{{ lang === 'ru' ? 'Ск. атаки' : 'Atk/s' }}:</span>
                        <span class="stat-value">{{ getUnitById(placed.unitId).weapons.map(w => w.rate_of_fire.toFixed(2)).join(' / ') }}</span>
                      </div>
                      <!-- Repair rate for builders -->
                      <div class="stat-row" v-if="getUnitById(placed.unitId)?.is_builder && getUnitById(placed.unitId)?.build_metal_rate">
                        <span class="stat-label">{{ lang === 'ru' ? 'Ремонт' : 'Repair' }}:</span>
                        <span class="stat-value" style="color: #34d399;">{{ getUnitById(placed.unitId).build_metal_rate }} m/s</span>
                      </div>
                      
                      <!-- Quantity Controller -->
                      <div class="qty-controller">
                        <button class="qty-btn" @click="adjustCount(placed, -1)" @mousedown.stop>&minus;</button>
                        <input 
                          type="number" 
                          min="1"
                          max="10000"
                          v-model.number="placed.count" 
                          @input="updateCount(placed, $event)"
                          @mousedown.stop
                          class="qty-input"
                        />
                        <button class="qty-btn" @click="adjustCount(placed, 1)" @mousedown.stop>&plus;</button>
                      </div>
                      
                      <!-- Actions -->
                      <div class="card-actions">
                        <button 
                          v-if="getUnitById(placed.unitId)?.buildable_unit_ids?.length > 0"
                          class="card-btn card-btn-factory"
                          @click.stop="placed.showFactoryMenu = !placed.showFactoryMenu"
                          @mousedown.stop
                        >
                          <Factory :size="12" />
                          {{ t('spawnBuildable') }}
                        </button>
                      </div>
                      
                      <!-- Factory Spawn Queue Popover -->
                      <div v-if="placed.showFactoryMenu" class="factory-popup" @mousedown.stop @wheel.stop>
                        <div class="factory-popup-header">Factory Queue</div>
                        <div class="factory-grid">
                          <div 
                            v-for="buildId in getUnitById(placed.unitId)?.buildable_unit_ids"
                            :key="buildId"
                            class="factory-item"
                            @click="spawnFromFactory(placed, buildId)"
                            :title="getUnitById(buildId)?.name"
                          >
                            <img :src="getUnitById(buildId)?.icon" class="factory-item-img" />
                          </div>
                        </div>
                      </div>
                      
                    </div>
                    
                    <!-- Connection Ports -->
                    <div 
                      class="connection-node node-left"
                      @mousedown="startConnection(placed, 'left', $event)"
                    ></div>
                    <div 
                      class="connection-node node-right"
                      @mousedown="startConnection(placed, 'right', $event)"
                    ></div>
                  </div>
                </div>

                <!-- Column Summary (Metal and Energy Cost) -->
                <div class="timeline-col-summary" v-if="placedUnits.filter(u => u.timelineColId === col.id).length > 0">
                  <div style="display:flex; justify-content:space-between; width:100%;">
                    <span>{{ lang === 'ru' ? 'Металл (цена):' : 'Metal (Cost):' }}</span>
                    <span style="color:var(--color-orange); font-weight:bold;">
                      {{ placedUnits.filter(u => u.timelineColId === col.id).reduce((sum, item) => sum + (getUnitById(item.unitId)?.cost || 0) * item.count, 0).toLocaleString() }}
                    </span>
                  </div>
                  <div style="display:flex; justify-content:space-between; width:100%;">
                    <span>{{ lang === 'ru' ? 'Энергия (цена):' : 'Energy (Cost):' }}</span>
                    <span style="color:var(--color-cyan); font-weight:bold;">
                      {{ placedUnits.filter(u => u.timelineColId === col.id).reduce((sum, item) => sum + ((getUnitById(item.unitId)?.cost || 0) * 25) * item.count, 0).toLocaleString() }}
                    </span>
                  </div>
                  
                  <div v-if="getColumnMetalProd(col.id) > 0" style="display:flex; justify-content:space-between; width:100%; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 2px; margin-top: 2px;">
                    <span>{{ lang === 'ru' ? 'Выработка M:' : 'Metal Prod:' }}</span>
                    <span style="color:#4ade80; font-weight:bold;">+{{ getColumnMetalProd(col.id).toLocaleString() }} m/s</span>
                  </div>
                  <div v-if="getColumnMetalCons(col.id) > 0" style="display:flex; justify-content:space-between; width:100%;" :style="getColumnMetalProd(col.id) === 0 ? { borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '2px', marginTop: '2px' } : {}">
                    <span>{{ lang === 'ru' ? 'Потребление M:' : 'Metal Cons:' }}</span>
                    <span style="color:#f87171; font-weight:bold;">-{{ getColumnMetalCons(col.id).toLocaleString() }} m/s</span>
                  </div>
                  
                  <div v-if="getColumnEnergyProd(col.id) > 0" style="display:flex; justify-content:space-between; width:100%;" :style="getColumnMetalProd(col.id) === 0 && getColumnMetalCons(col.id) === 0 ? { borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '2px', marginTop: '2px' } : {}">
                    <span>{{ lang === 'ru' ? 'Выработка E:' : 'Energy Prod:' }}</span>
                    <span style="color:#4ade80; font-weight:bold;">+{{ getColumnEnergyProd(col.id).toLocaleString() }} E/s</span>
                  </div>
                  <div v-if="getColumnEnergyCons(col.id) > 0" style="display:flex; justify-content:space-between; width:100%;">
                    <span>{{ lang === 'ru' ? 'Потребление E:' : 'Energy Cons:' }}</span>
                    <span style="color:#f87171; font-weight:bold;">-{{ getColumnEnergyCons(col.id).toLocaleString() }} E/s</span>
                  </div>
                </div>

                <!-- Corner Resize Handle -->
                <div 
                  class="timeline-col-resize-handle"
                  @mousedown.stop.prevent="startResizeColumn(panel, col, $event)"
                ></div>
              </div>
            </div>
          </div>

        </div>
      </div>
      
    </div>

    <!-- Right-Click Custom Context Menu -->
    <div 
      v-if="contextMenu"
      class="context-menu"
      :style="{
        position: 'fixed',
        left: `${contextMenu.x}px`,
        top: `${contextMenu.y}px`,
        zIndex: 10000,
        padding: '4px 0',
        minWidth: '180px'
      }"
      @click.stop
    >
      <!-- Canvas Context Options -->
      <template v-if="contextMenu.type === 'canvas'">
        <div class="context-menu-item" @click="addGroupArea(contextMenu.canvasX, contextMenu.canvasY); closeContextMenu()">
          <PlusCircle :size="14" />
          {{ t('createArea') }}
        </div>
        <div class="context-menu-item" style="color: var(--color-cyan);" @click="createTimelinePanel(contextMenu.canvasX, contextMenu.canvasY); closeContextMenu()">
          <Clock :size="14" />
          {{ lang === 'ru' ? 'Создать временную панель' : 'Create Timeline Panel' }}
        </div>
        <div class="context-menu-item" style="color: var(--color-orange);" @click="addNewNoteAt(contextMenu.canvasX, contextMenu.canvasY); closeContextMenu()">
          <StickyNote :size="14" />
          {{ lang === 'ru' ? 'Добавить заметку' : 'Add Note' }}
        </div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-item" @click="goToCenter(); closeContextMenu()">
          <Crosshair :size="14" />
          {{ t('focusCenter') }}
        </div>
        <div class="context-menu-item danger" @click="clearBoard(); closeContextMenu()">
          <RefreshCw :size="14" />
          {{ t('clear') }}
        </div>
      </template>
      
      <!-- Card Context Options -->
      <template v-if="contextMenu.type === 'card'">
        <div class="context-menu-item" style="color: var(--color-cyan);" @click="openUnitDetail(placedUnits.find(u => u.uuid === contextMenu.uuid)); closeContextMenu()">
          <Info :size="14" />
          {{ lang === 'ru' ? 'Вся информация о юните' : 'Full Unit Info' }}
        </div>
        <div 
          v-if="getUnitById(placedUnits.find(u => u.uuid === contextMenu.uuid)?.unitId)?.category === 'commander' || placedUnits.find(u => u.uuid === contextMenu.uuid)?.unitId?.includes('commander')"
          class="context-menu-item" 
          style="color: var(--color-orange);" 
          @click="openSkinModal(placedUnits.find(u => u.uuid === contextMenu.uuid)); closeContextMenu()"
        >
          <Palette :size="14" />
          {{ lang === 'ru' ? 'Сменить скин Командира' : 'Switch Commander Skin' }}
        </div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-item" style="color: var(--color-cyan);" @click="openCounterFinderModal(contextMenu.uuid); closeContextMenu()">
          <Shield :size="14" />
          {{ t('counterMatchmaker') }}
        </div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-item" @click="duplicateCard(contextMenu.uuid); closeContextMenu()">
          <Copy :size="14" />
          {{ t('duplicateCard') }}
        </div>
        <div class="context-menu-item" @click="clearCardConnections(contextMenu.uuid); closeContextMenu()">
          <Unlink :size="14" />
          {{ t('clearConn') }}
        </div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-item" @click="bringToFront(contextMenu.uuid); closeContextMenu()">
          <ArrowUp :size="14" />
          {{ t('bringToFront') }}
        </div>
        <div class="context-menu-item" @click="sendToBack(contextMenu.uuid); closeContextMenu()">
          <ArrowDown :size="14" />
          {{ t('sendToBack') }}
        </div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-item danger" @click="removePlacedUnit(contextMenu.uuid); closeContextMenu()">
          <Trash2 :size="14" />
          {{ t('deleteCard') }}
        </div>
      </template>

      <!-- Area Context Options -->
      <template v-if="contextMenu.type === 'area'">
        <div class="context-menu-item" style="color: var(--color-cyan);" @click="compareAreaUnits(contextMenu.uuid); closeContextMenu()">
          <BarChart2 :size="14" />
          {{ t('compareSpecs') }}
        </div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-item" @click="renameGroupArea(groupAreas.find(a => a.uuid === contextMenu.uuid)); closeContextMenu()">
          <Edit2 :size="14" />
          {{ t('renameArea') }}
        </div>
        <div class="context-menu-item" @click="deleteAreaUnits(contextMenu.uuid); closeContextMenu()">
          <Trash2 :size="14" />
          {{ t('clearArea') }}
        </div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-item danger" @click="deleteGroupArea(contextMenu.uuid); closeContextMenu()">
          <X :size="14" />
          {{ t('deleteArea') }}
        </div>
      </template>

      <!-- Connection Context Options -->
      <template v-if="contextMenu.type === 'connection'">
        <div class="context-menu-item" style="color: var(--color-green);" @click="startAnimatedSimulation(contextMenu.conn); closeContextMenu()">
          <Sword :size="14" />
          {{ lang === 'ru' ? 'Симуляция с анимацией' : 'Simulate (Animated)' }}
        </div>
        <div class="context-menu-item" style="color: var(--color-cyan);" @click="runQuickSim(contextMenu.conn); closeContextMenu()">
          <Zap :size="14" />
          {{ lang === 'ru' ? 'Быстрый расчёт' : 'Quick Sim (Instant)' }}
        </div>
        <div class="context-menu-item" style="color: var(--text-secondary);" @click="showConnectionSettings(contextMenu.conn); closeContextMenu()">
          <Settings :size="14" />
          {{ lang === 'ru' ? 'Настройки связи' : 'Connection Settings' }}
        </div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-item danger" @click="removeConnection(contextMenu.uuid); closeContextMenu()">
          <Trash2 :size="14" />
          {{ t('deleteConn') }}
        </div>
      </template>

      <!-- Selection Context Options -->
      <template v-if="selectedCardUuids.length > 0">
        <div class="context-menu-divider"></div>
        <div class="context-menu-header" style="font-family: var(--font-title); font-size: 0.65rem; color: var(--text-dim); padding: 4px 12px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: bold;">
          {{ t('selection') }} ({{ selectedCardUuids.length }})
        </div>
        <div class="context-menu-item" @click="duplicateSelectedCards(); closeContextMenu()">
          <Copy :size="14" />
          {{ t('duplicateSelected') }}
        </div>
        <div class="context-menu-item" @click="groupSelectedIntoArea(); closeContextMenu()">
          <PlusCircle :size="14" />
          {{ t('groupSelected') }}
        </div>
        <div class="context-menu-item" style="color: var(--color-cyan);" @click="compareSelectedUnits(); closeContextMenu()">
          <BarChart2 :size="14" />
          {{ t('compareSpecs') }}
        </div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-item danger" @click="deleteSelectedCards(); closeContextMenu()">
          <Trash2 :size="14" />
          {{ t('deleteSelected') }}
        </div>
      </template>

      <!-- Note Context Options -->
      <template v-if="contextMenu.type === 'note'">
        <div class="context-menu-item" @click="insertFormatting(contextMenu.uuid, 'h1'); closeContextMenu()">
          <span style="font-family: var(--font-title); font-size: 0.72rem; font-weight: bold; width: 14px; display: inline-block;">H1</span>
          {{ lang === 'ru' ? 'Заголовок 1 (#)' : 'Header 1 (#)' }}
        </div>
        <div class="context-menu-item" @click="insertFormatting(contextMenu.uuid, 'h2'); closeContextMenu()">
          <span style="font-family: var(--font-title); font-size: 0.72rem; font-weight: bold; width: 14px; display: inline-block;">H2</span>
          {{ lang === 'ru' ? 'Заголовок 2 (##)' : 'Header 2 (##)' }}
        </div>
        <div class="context-menu-item" @click="insertFormatting(contextMenu.uuid, 'bold'); closeContextMenu()">
          <strong style="width: 14px; display: inline-block; text-align: center;">B</strong>
          {{ lang === 'ru' ? 'Жирный (**текст**)' : 'Bold (**text**)' }}
        </div>
        <div class="context-menu-item" @click="insertFormatting(contextMenu.uuid, 'italic'); closeContextMenu()">
          <em style="width: 14px; display: inline-block; text-align: center;">I</em>
          {{ lang === 'ru' ? 'Курсив (*текст*)' : 'Italic (*text*)' }}
        </div>
        <div class="context-menu-item" @click="insertFormatting(contextMenu.uuid, 'list'); closeContextMenu()">
          <span style="width: 14px; display: inline-block; text-align: center;">•</span>
          {{ lang === 'ru' ? 'Список (- пункт)' : 'List (- item)' }}
        </div>
        <div class="context-menu-item" @click="insertFormatting(contextMenu.uuid, 'link'); closeContextMenu()">
          <ExternalLink :size="14" />
          {{ lang === 'ru' ? 'Ссылка ([текст](url))' : 'Link ([text](url))' }}
        </div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-item danger" @click="deleteNote(contextMenu.uuid); closeContextMenu()">
          <Trash2 :size="14" />
          {{ t('deleteCard') }}
        </div>
      </template>
    </div>

    <!-- Quick Sim Static Result Modal -->
    <div v-if="activeBattleSimulation" class="modal-overlay" @click="activeBattleSimulation = null">
      <div class="modal-content" @click.stop style="width: 600px; max-height: 85vh; overflow-y: auto;">
        <div class="modal-header">
          <h3 class="modal-title" style="display:flex; align-items:center; gap:8px;">
            <Zap :size="15" style="color: var(--color-cyan);" />
            {{ lang === 'ru' ? 'Результат расчёта' : 'Battle Result' }}
          </h3>
          <button class="close-btn" @click="activeBattleSimulation = null"><X :size="18" /></button>
        </div>
        <div class="modal-body">
          <!-- Winner banner -->
          <div class="quick-sim-banner"
            :style="{
              borderColor: activeBattleSimulation.winner === 'Draw' ? 'var(--color-orange)' : 'var(--color-green)',
              color: activeBattleSimulation.winner === 'Draw' ? 'var(--color-orange)' : 'var(--color-green)',
              background: activeBattleSimulation.winner === 'Draw' ? 'rgba(249,115,22,0.06)' : 'rgba(34,197,94,0.06)'
            }"
          >
            {{ activeBattleSimulation.resultText }}
            <span v-if="activeBattleSimulation.winner !== 'Draw'"> ({{ activeBattleSimulation.remainingHpPercent }}% HP {{ lang === 'ru' ? 'осталось' : 'remaining' }})</span>
            <span style="margin-left:12px; font-size:0.8rem; opacity:0.7;">{{ activeBattleSimulation.time }}s</span>
          </div>

          <!-- Two sides -->
          <div style="display:flex; gap:12px; margin-bottom:16px;">
            <div v-for="(side, key) in { A: activeBattleSimulation.a, B: activeBattleSimulation.b }" :key="key"
              class="quick-sim-side"
              :class="{ 'qs-winner': activeBattleSimulation.winner === key, 'qs-loser': activeBattleSimulation.winner !== key && activeBattleSimulation.winner !== 'Draw' }"
            >
              <div style="font-size:0.62rem; font-family:var(--font-title); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:6px; color:var(--text-dim); display:flex; align-items:center; gap:4px;">
                <Trophy v-if="activeBattleSimulation.winner === key" :size="10" style="color: var(--color-green);" />
                <X v-else-if="activeBattleSimulation.winner !== 'Draw'" :size="10" style="color: var(--color-red);" />
                <span>{{ activeBattleSimulation.winner === key ? (lang === 'ru' ? 'Победитель' : 'Winner') : (activeBattleSimulation.winner === 'Draw' ? (lang === 'ru' ? 'Ничья' : 'Draw') : (lang === 'ru' ? 'Проигравший' : 'Loser')) }}</span>
              </div>
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                <img :src="side.icon" style="width:32px;height:32px;object-fit:contain;" />
                <div>
                  <div style="font-weight:bold; font-size:0.8rem;">{{ side.name }}</div>
                  <div style="font-size:0.65rem; color:var(--text-dim);">{{ side.count }} {{ lang === 'ru' ? 'юн.' : 'units' }}</div>
                </div>
              </div>
              <div style="display:flex; gap:8px;">
                <div class="qs-stat"><span style="color:var(--color-green);">{{ side.hpLeft.toLocaleString() }}</span><br><span style="font-size:0.6rem; color:var(--text-dim);">HP</span></div>
                <div class="qs-stat"><span style="color:var(--color-orange);">{{ side.cost.toLocaleString() }}</span><br><span style="font-size:0.6rem; color:var(--text-dim);">{{ lang === 'ru' ? 'Металл' : 'Metal' }}</span></div>
              </div>
              <!-- Survivor list -->
              <div v-if="side.detailedUnits?.length" style="margin-top:10px; border-top:1px solid rgba(255,255,255,0.06); padding-top:8px; display:flex; flex-direction:column; gap:3px; max-height:140px; overflow-y:auto;">
                <div v-for="u in side.detailedUnits" :key="u.name"
                  style="display:flex; align-items:center; justify-content:space-between; padding:2px 6px; border-radius:3px;"
                  :style="{ background: u.survivedCount > 0 ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.05)' }"
                >
                  <div style="display:flex; align-items:center; gap:6px;">
                    <img :src="u.icon" style="width:14px;height:14px;object-fit:contain;" />
                    <span style="font-size:0.63rem; color:#cbd5e1; max-width:100px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" :title="u.name">{{ u.name }}</span>
                  </div>
                  <span :style="{ color: u.survivedCount > 0 ? 'var(--color-green)' : 'var(--color-red)', fontFamily: 'var(--font-title)', fontSize: '0.65rem', fontWeight: 'bold' }">
                    {{ u.survivedCount }}/{{ u.initialCount }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Event log (static, all entries) -->
          <h4 class="battle-logs-title">{{ t('battleEventsLog') }}</h4>
          <div class="battle-logs-list">
            <div v-for="(entry, index) in activeBattleSimulation.log" :key="index" class="log-entry" style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
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

    <!-- Animated Battle Simulation Modal -->
    <SimulationModal
      ref="bfTrack"
      :animSim="animSim"
      :lang="lang"
      :t="t"
      :trackWidth="trackWidth"
      :getSvgX="getSvgX"
      :getSvgY="getSvgY"
      :getSvgRange="getSvgRange"
      :getUnitLeftPercent="getUnitLeftPercent"
      :getUnitTopPercent="getUnitTopPercent"
      :getVictoryEaseDetails="getVictoryEaseDetails"
      @close="stopAnimatedSim"
      @play="startAnimatedSim"
      @pause="pauseAnimatedSim"
      @step="stepAnimatedSim"
      @setSpeed="setPlaybackSpeed"
      @seek="seekAnimatedSim"
      @downloadCard="downloadResultCardImage"
    />

    <!-- Opponent Counter Ratings Modal -->
    <CounterModal
      :show="showCounterModal"
      :counterRatings="counterRatings"
      :loading="counterRatingsLoading"
      :lang="lang"
      :t="t"
      :hardestUnitId="counterSelectedNodeUuid ? (getElement(counterSelectedNodeUuid)?.type === 'unit' ? hardestCountersCache[getElement(counterSelectedNodeUuid).unitId]?.bestCounterId : counterRatings[0]?.unitId) : null"
      @close="showCounterModal = false"
      @spawn="spawnCounterOpponent"
    />

    <!-- Specs Comparison Modal -->
    <CompareModal
      :show="showCompareModal"
      :compareUnitIds="compareUnitIds"
      :lang="lang"
      :getUnitById="getUnitById"
      :getBestValue="getBestValue"
      :getWorstValue="getWorstValue"
      :getUnitEnergyStats="getUnitEnergyStats"
      :normalizeLayer="normalizeLayer"
      :formatTargetLabel="formatTargetLabel"
      :t="t"
      @close="showCompareModal = false"
    />

    <!-- Help / Onboarding Modal -->
    <HelpModal
      :show="showHelpModal"
      :lang="lang"
      :t="t"
      @close="showHelpModal = false"
    />

    <!-- Full Unit Info Modal -->
    <div v-if="showUnitDetailModal && unitDetailSpec" class="modal-overlay" @click="showUnitDetailModal = false">
      <div class="modal-content unit-detail-modal" @click.stop style="width: 740px; max-height: 85vh; display: flex; flex-direction: column;">
        <div class="modal-header" style="border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <img :src="unitDetailSpec.icon" style="width: 44px; height: 44px; object-fit: contain; background: rgba(0,0,0,0.4); padding: 4px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1);" />
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <h3 class="modal-title" style="margin: 0; font-size: 1.2rem;">{{ t('unit_name_' + unitDetailSpec.id) }}</h3>
                <span class="tier-badge" :class="'tier-' + (unitDetailSpec.tier || 'T1').toLowerCase()">{{ unitDetailSpec.tier || 'T1' }}</span>
                <span class="category-chip" style="font-size: 0.65rem; padding: 2px 8px; text-transform: uppercase; background: rgba(255,255,255,0.06); border-radius: 4px; color: var(--color-cyan);">{{ unitDetailSpec.category }}</span>
              </div>
              <div style="font-size: 0.75rem; color: var(--text-dim); margin-top: 2px;">{{ unitDetailSpec.id }}</div>
            </div>
          </div>
          <button class="close-btn" @click="showUnitDetailModal = false"><X :size="18" /></button>
        </div>

        <div class="modal-body" style="overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 20px;">
          <!-- Description -->
          <div style="font-size: 0.85rem; color: var(--text-secondary); background: rgba(255,255,255,0.03); padding: 10px 14px; border-radius: 6px; border-left: 3px solid var(--color-cyan);">
            {{ getUnitDesc(unitDetailSpec) }}
          </div>



          <!-- Base Stats Grid -->
          <div>
            <div style="font-family: var(--font-title); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-cyan); margin-bottom: 10px; display:flex; align-items:center; gap:6px;">
              <Zap :size="14" />
              <span>{{ lang === 'ru' ? 'Основные характеристики' : 'Core Specifications' }}</span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px;">
              <div class="stat-card">
                <span class="stat-card-label">{{ lang === 'ru' ? 'Здоровье' : 'Health' }}</span>
                <span class="stat-card-val" style="color: var(--color-green);">{{ unitDetailSpec.health?.toLocaleString() }} HP</span>
              </div>
              <div class="stat-card">
                <span class="stat-card-label">{{ lang === 'ru' ? 'Стоимость' : 'Metal Cost' }}</span>
                <span class="stat-card-val" style="color: var(--color-orange);">{{ unitDetailSpec.cost?.toLocaleString() }} M</span>
              </div>
              <div class="stat-card">
                <span class="stat-card-label">{{ lang === 'ru' ? 'Общий DPS' : 'Total DPS' }}</span>
                <span class="stat-card-val" style="color: #ff5555;">{{ Math.round(unitDetailSpec.dps || 0) }}</span>
              </div>
              <div class="stat-card">
                <span class="stat-card-label">{{ lang === 'ru' ? 'Макс. Дальность' : 'Max Range' }}</span>
                <span class="stat-card-val" style="color: #55ffff;">{{ unitDetailSpec.range || 0 }}</span>
              </div>
              <div class="stat-card" v-if="unitDetailSpec.move_speed">
                <span class="stat-card-label">{{ lang === 'ru' ? 'Скорость хода' : 'Move Speed' }}</span>
                <span class="stat-card-val">{{ unitDetailSpec.move_speed }}</span>
              </div>
              <div class="stat-card" v-if="unitDetailSpec.turn_speed">
                <span class="stat-card-label">{{ lang === 'ru' ? 'Скорость разворота' : 'Turn Speed' }}</span>
                <span class="stat-card-val">{{ unitDetailSpec.turn_speed }}°/s</span>
              </div>
              <div class="stat-card" v-if="unitDetailSpec.vision_radius">
                <span class="stat-card-label">{{ lang === 'ru' ? 'Радиус обзора' : 'Vision Radius' }}</span>
                <span class="stat-card-val">{{ unitDetailSpec.vision_radius }}</span>
              </div>
              <div class="stat-card" v-if="unitDetailSpec.radar_radius">
                <span class="stat-card-label">{{ lang === 'ru' ? 'Радиус радара' : 'Radar Radius' }}</span>
                <span class="stat-card-val">{{ unitDetailSpec.radar_radius }}</span>
              </div>
              <div class="stat-card" v-if="unitDetailSpec.is_builder && unitDetailSpec.build_metal_rate">
                <span class="stat-card-label">{{ lang === 'ru' ? 'Скорость ремонта' : 'Repair Rate' }}</span>
                <span class="stat-card-val" style="color: #34d399;">{{ unitDetailSpec.build_metal_rate }} <span style="font-size:0.6rem;opacity:0.7;">m/s</span></span>
              </div>
              <!-- Build Energy (if structure) -->
              <div class="stat-card" v-if="unitDetailSpec.unit_types?.includes('UNITTYPE_Structure')">
                <span class="stat-card-label">{{ lang === 'ru' ? 'Энергия (постр.)' : 'Build Energy' }}</span>
                <span class="stat-card-val" style="color: var(--color-cyan);">{{ (unitDetailSpec.cost * 25).toLocaleString() }} E</span>
              </div>
              <!-- Energy Production -->
              <div class="stat-card" v-if="getUnitEnergyStats(unitDetailSpec)?.energyProd > 0">
                <span class="stat-card-label">{{ lang === 'ru' ? 'Выработка энергии' : 'Energy Production' }}</span>
                <span class="stat-card-val" style="color: #4ade80;">+{{ getUnitEnergyStats(unitDetailSpec).energyProd.toLocaleString() }} E/s</span>
              </div>
              <!-- Metal Production -->
              <div class="stat-card" v-if="getUnitMetalStats(unitDetailSpec)?.metalProd > 0">
                <span class="stat-card-label">{{ lang === 'ru' ? 'Выработка металла' : 'Metal Production' }}</span>
                <span class="stat-card-val" style="color: #4ade80;">+{{ getUnitMetalStats(unitDetailSpec).metalProd.toLocaleString() }} M/s</span>
              </div>
              <!-- Energy Consumption -->
              <div class="stat-card" v-if="getUnitEnergyStats(unitDetailSpec)?.energyCons > 0">
                <span class="stat-card-label">{{ lang === 'ru' ? 'Потребление энергии' : 'Energy Consumption' }}</span>
                <span class="stat-card-val" style="color: #f87171;">-{{ getUnitEnergyStats(unitDetailSpec).energyCons.toLocaleString() }} E/s</span>
              </div>
              <!-- Attack Speed (Atk/s) -->
              <div class="stat-card" v-if="unitDetailSpec.weapons?.length">
                <span class="stat-card-label">{{ lang === 'ru' ? 'Ск. атаки (оруд.)' : 'Atk Speed (wpns)' }}</span>
                <span class="stat-card-val">{{ unitDetailSpec.weapons.map(w => w.rate_of_fire.toFixed(2)).join(' / ') }} /s</span>
              </div>
              <!-- Targets -->
              <div class="stat-card" v-if="unitDetailSpec.target_labels?.length" style="grid-column: span 2;">
                <span class="stat-card-label">{{ lang === 'ru' ? 'Цели (Слои)' : 'Targets (Layers)' }}</span>
                <div style="display:flex; gap:4px; flex-wrap:wrap; margin-top:4px;">
                  <span v-for="lbl in unitDetailSpec.target_labels" :key="lbl" class="target-badge" :class="'target-' + normalizeLayer(lbl)">
                    {{ formatTargetLabel(lbl) }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Weapons Section -->
          <div v-if="unitDetailSpec.weapons && unitDetailSpec.weapons.length > 0">
            <div style="font-family: var(--font-title); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-cyan); margin-bottom: 12px; display:flex; align-items:center; gap:6px;">
              <Crosshair :size="14" />
              <span>{{ lang === 'ru' ? 'Вооружение' : 'Weapons' }} ({{ unitDetailSpec.weapons.length }})</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 14px;">
              <div v-for="(wpn, idx) in unitDetailSpec.weapons" :key="idx" class="weapon-detail-card">

                <!-- Header row: name + DPS badge -->
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                  <div>
                    <div style="font-family: var(--font-title); font-size: 1rem; font-weight: bold; color: #fff; margin-bottom: 2px;">{{ wpn.name }}</div>
                    <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
                      <div class="flight-type-badge-container" style="position: relative; display: inline-block;">
                        <span 
                          v-if="wpn.flight_type" 
                          class="flight-type-badge" 
                          style="cursor: pointer; display: inline-flex; align-items: center; gap: 4px;"
                          @click.stop="toggleFlightTypeDropdown(wpn.flight_type)"
                        >
                          {{ t('flight_type_' + wpn.flight_type.toLowerCase()) }}
                          <Info :size="10" style="opacity: 0.8; vertical-align: middle; flex-shrink: 0;" />
                        </span>
                        <div 
                          v-if="activeFlightTypeDropdown === wpn.flight_type" 
                          class="explanation-dropdown"
                          style="position: absolute; top: calc(100% + 6px); left: 0; z-index: 10000; width: 220px; background: #1e293b; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; padding: 8px 10px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.5); font-size: 0.68rem; line-height: 1.3; color: var(--text-secondary); text-align: left; pointer-events: auto; white-space: normal;"
                          @click.stop
                        >
                          {{ getFlightTypeExplanation(wpn.flight_type) }}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div style="text-align:right; flex-shrink:0; margin-left:12px;">
                    <div style="font-family: var(--font-title); font-size: 1.5rem; font-weight: bold; color: #f87171; line-height:1;">{{ Math.round(wpn.dps) }}</div>
                    <div style="font-size: 0.6rem; color: var(--text-dim); text-transform:uppercase; letter-spacing:0.05em;">DPS</div>
                  </div>
                </div>

                <!-- Stats grid -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                  <div class="wpn-stat-cell">
                    <div class="wpn-stat-label">{{ lang === 'ru' ? 'Урон / выстрел' : 'Damage / shot' }}</div>
                    <div class="wpn-stat-val" style="color: #f87171;">{{ wpn.damage }}</div>
                  </div>
                  <div class="wpn-stat-cell">
                    <div class="wpn-stat-label">{{ lang === 'ru' ? 'Выстрелов/сек' : 'Rate of fire' }}</div>
                    <div class="wpn-stat-val" style="color: #fbbf24;">{{ wpn.rate_of_fire }}/s</div>
                  </div>
                  <div class="wpn-stat-cell">
                    <div class="wpn-stat-label">{{ lang === 'ru' ? 'Дальность' : 'Range' }}</div>
                    <div class="wpn-stat-val" style="color: #38bdf8;">{{ wpn.range }}</div>
                  </div>
                  <div class="wpn-stat-cell" v-if="wpn.splash_damage">
                    <div class="wpn-stat-label">{{ lang === 'ru' ? 'Сплэш урон' : 'Splash' }}</div>
                    <div class="wpn-stat-val" style="color: #fb923c;">{{ wpn.splash_damage }} <span style="font-size:0.65rem;opacity:0.7;">(r={{ wpn.splash_radius }})</span></div>
                  </div>
                  <div class="wpn-stat-cell" v-if="wpn.muzzle_velocity">
                    <div class="wpn-stat-label">{{ lang === 'ru' ? 'Скорость снаряда' : 'Projectile speed' }}</div>
                    <div class="wpn-stat-val" style="color: #a78bfa;">{{ wpn.muzzle_velocity }}</div>
                  </div>
                </div>

                <!-- Target Layers badges -->
                <div v-if="(wpn.target_labels || wpn.target_layers)?.length" style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.05);">
                  <span style="font-size: 0.68rem; color: var(--text-dim); font-weight:bold;">{{ lang === 'ru' ? 'Цели:' : 'Targets:' }}</span>
                  <span v-for="lbl in (wpn.target_labels || wpn.target_layers)" :key="lbl" class="target-badge" :class="'target-' + normalizeLayer(lbl)">
                    {{ formatTargetLabel(lbl) }}
                  </span>
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Sim Settings Modal -->
    <div v-if="showSimSettingsModal" class="modal-overlay" @click="showSimSettingsModal = false">
      <div class="modal-content" @click.stop style="width: 440px;">
        <div class="modal-header">
          <h3 class="modal-title" style="display:flex; align-items:center; gap:8px;">
            <Settings :size="16" style="color:var(--color-cyan);" />
            {{ lang === 'ru' ? 'Настройки симулятора боя' : 'Combat Simulator Settings' }}
          </h3>
          <button class="close-btn" @click="showSimSettingsModal = false"><X :size="18" /></button>
        </div>
        
        <div class="modal-body" style="display:flex; flex-direction:column; gap:16px; padding:20px 24px 10px;">
          <!-- Interface Language -->
          <div class="setting-row">
            <label class="setting-label">{{ lang === 'ru' ? 'Язык интерфейса' : 'Interface Language' }}</label>
            <div style="display: flex; gap: 8px;">
              <button 
                @click="lang = 'ru'"
                class="btn"
                :style="{
                  borderColor: lang === 'ru' ? 'var(--color-cyan)' : 'var(--border-dim)',
                  background: lang === 'ru' ? 'rgba(6,182,212,0.1)' : 'transparent',
                  color: lang === 'ru' ? '#fff' : 'var(--text-dim)',
                  cursor: 'pointer',
                  padding: '4px 12px',
                  fontSize: '0.75rem',
                  fontWeight: lang === 'ru' ? 'bold' : 'normal'
                }"
              >
                RU
              </button>
              <button 
                @click="lang = 'en'"
                class="btn"
                :style="{
                  borderColor: lang === 'en' ? 'var(--color-cyan)' : 'var(--border-dim)',
                  background: lang === 'en' ? 'rgba(6,182,212,0.1)' : 'transparent',
                  color: lang === 'en' ? '#fff' : 'var(--text-dim)',
                  cursor: 'pointer',
                  padding: '4px 12px',
                  fontSize: '0.75rem',
                  fontWeight: lang === 'en' ? 'bold' : 'normal'
                }"
              >
                EN
              </button>
            </div>
          </div>

          <!-- Max Time -->
          <div class="setting-row">
            <label class="setting-label">{{ lang === 'ru' ? 'Макс. длительность боя' : 'Max Combat Time' }}</label>
            <select v-model.number="simSettings.maxTime" class="setting-input">
              <option :value="30">30 {{ lang === 'ru' ? 'сек' : 'sec' }}</option>
              <option :value="60">60 {{ lang === 'ru' ? 'сек' : 'sec' }}</option>
              <option :value="120">120 {{ lang === 'ru' ? 'сек' : 'sec' }} (Standard)</option>
              <option :value="300">300 {{ lang === 'ru' ? 'сек' : 'sec' }}</option>
              <option :value="600">600 {{ lang === 'ru' ? 'сек' : 'sec' }}</option>
            </select>
          </div>

          <!-- Playback Speed -->
          <div class="setting-row">
            <label class="setting-label">{{ lang === 'ru' ? 'Скорость анимации' : 'Playback Speed' }}</label>
            <select v-model.number="simSettings.playbackSpeed" class="setting-input">
              <option :value="0.5">0.5x (Slow Motion)</option>
              <option :value="1.0">1.0x (Normal)</option>
              <option :value="2.0">2.0x (Fast)</option>
              <option :value="4.0">4.0x (Ultra Fast)</option>
            </select>
          </div>

          <!-- Initial Engagement Distance -->
          <div class="setting-row">
            <label class="setting-label">{{ lang === 'ru' ? 'Стартовая дистанция боя' : 'Initial Engagement Distance' }}</label>
            <select v-model.number="simSettings.initialDistance" class="setting-input">
              <option :value="100">100 (Close Quarters)</option>
              <option :value="200">200 (Medium Range)</option>
              <option :value="300">300 (Standard Range)</option>
              <option :value="500">500 (Artillery Battle)</option>
            </select>
          </div>

          <!-- Log Verbosity -->
          <div class="setting-row">
            <label class="setting-label">{{ lang === 'ru' ? 'Детализация журнала' : 'Log Verbosity' }}</label>
            <select v-model="simSettings.logVerbosity" class="setting-input">
              <option value="all">{{ lang === 'ru' ? 'Все события (Удары орудий + Уничтожения)' : 'All Events (Weapon Strikes + Kills)' }}</option>
              <option value="kills_only">{{ lang === 'ru' ? 'Только уничтожения юнитов' : 'Kills Only' }}</option>
            </select>
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; padding: 12px 24px 24px; border-top: 1px solid var(--border-dim); background: rgba(255, 255, 255, 0.01);">
          <button class="btn btn-secondary" @click="showSimSettingsModal = false">
            {{ lang === 'ru' ? 'Готово' : 'Done' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Connection Settings Modal -->
    <div v-if="showConnectionSettingsModal && activeEditingConnection" class="modal-overlay" @click="() => { showConnectionSettingsModal = false; saveToLocalStorage(); }">
      <div class="modal-content" @click.stop style="width: min(80vw, 1200px); max-height: 90vh; display: flex; flex-direction: column;">
        <div class="modal-header">
          <h3 class="modal-title" style="display:flex; align-items:center; gap:8px;">
            <Settings :size="16" style="color:var(--color-cyan);" />
            {{ lang === 'ru' ? 'Настройки связи' : 'Connection Settings' }}
          </h3>
          <button class="close-btn" @click="() => { showConnectionSettingsModal = false; saveToLocalStorage(); }"><X :size="18" /></button>
        </div>

        <div class="modal-body" style="overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 16px;">

          <!-- Top row: Distance + Range toggle -->
          <div style="display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: end;">
            <!-- Distance Slider -->
            <div class="setting-row" style="display: flex; flex-direction: column; gap: 6px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="setting-label">{{ lang === 'ru' ? 'Стартовая дистанция' : 'Initial Engagement Distance' }}</span>
                <span style="color: var(--color-cyan); font-family: var(--font-title); font-size: 0.75rem; font-weight: bold;">{{ activeEditingConnection.settings.initialDistance }}m</span>
              </div>
              <input
                type="range"
                min="100"
                max="1000"
                step="50"
                v-model.number="activeEditingConnection.settings.initialDistance"
                style="width: 100%; cursor: pointer;"
                @change="saveToLocalStorage"
              />
            </div>
            <!-- Ranges checkbox -->
            <label class="setting-label" style="cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 0.78rem; white-space:nowrap; padding: 8px 10px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 6px;">
              <input
                type="checkbox"
                v-model="activeEditingConnection.settings.showRanges"
                @change="saveToLocalStorage"
                style="cursor: pointer;"
              />
              {{ lang === 'ru' ? 'Область дальности' : 'Show Ranges' }}
            </label>
          </div>


          <!-- 2D Position Canvas -->
          <div>
            <div style="font-family: var(--font-title); font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-cyan); margin-bottom: 8px; display:flex; align-items:center; gap:6px;">
              <Move :size="12" />
              {{ lang === 'ru' ? 'Стартовые позиции юнитов — перетащите токены' : 'Unit Starting Positions — drag tokens' }}
            </div>

            <div class="bf-canvas-wrap">
              <div class="bf-canvas-grid"></div>

              <!-- SVG layer for range circles -->
              <svg 
                v-if="activeEditingConnection.settings.showRanges"
                :viewBox="`0 0 ${activeEditingConnection.settings.initialDistance * 2 + 300} 200`"
                style="position: absolute; inset: 0; pointer-events: none; z-index: 5; width: 100%; height: 100%;"
              >
                <!-- Team A ranges -->
                <template v-for="(stack, stackIdx) in getCombatants(getElement(activeEditingConnection.fromUuid))" :key="'ranges-a-' + stack.uuid">
                  <circle
                    v-for="(wpn, wIdx) in (getUnitById(stack.unitId)?.weapons || [])"
                    :key="wIdx"
                    :cx="getConnPos2D(activeEditingConnection, stack.uuid, -activeEditingConnection.settings.initialDistance / 2 - stackIdx * 25, (stackIdx - Math.floor(getCombatants(getElement(activeEditingConnection.fromUuid)).length / 2)) * 22).x + activeEditingConnection.settings.initialDistance + 150"
                    :cy="getConnPos2D(activeEditingConnection, stack.uuid, -activeEditingConnection.settings.initialDistance / 2 - stackIdx * 25, (stackIdx - Math.floor(getCombatants(getElement(activeEditingConnection.fromUuid)).length / 2)) * 22).y + 100"
                    :r="wpn.range"
                    fill="none"
                    stroke="rgba(34, 197, 94, 0.4)"
                    stroke-width="1.5"
                    stroke-dasharray="3 3"
                    vector-effect="non-scaling-stroke"
                  />
                </template>
                <!-- Team B ranges -->
                <template v-for="(stack, stackIdx) in getCombatants(getElement(activeEditingConnection.toUuid))" :key="'ranges-b-' + stack.uuid">
                  <circle
                    v-for="(wpn, wIdx) in (getUnitById(stack.unitId)?.weapons || [])"
                    :key="wIdx"
                    :cx="getConnPos2D(activeEditingConnection, stack.uuid, activeEditingConnection.settings.initialDistance / 2 + stackIdx * 25, (stackIdx - Math.floor(getCombatants(getElement(activeEditingConnection.toUuid)).length / 2)) * 22).x + activeEditingConnection.settings.initialDistance + 150"
                    :cy="getConnPos2D(activeEditingConnection, stack.uuid, activeEditingConnection.settings.initialDistance / 2 + stackIdx * 25, (stackIdx - Math.floor(getCombatants(getElement(activeEditingConnection.toUuid)).length / 2)) * 22).y + 100"
                    :r="wpn.range"
                    fill="none"
                    stroke="rgba(239, 68, 68, 0.4)"
                    stroke-width="1.5"
                    stroke-dasharray="3 3"
                    vector-effect="non-scaling-stroke"
                  />
                </template>
              </svg>
              <span class="bf-canvas-label-a">{{ getElement(activeEditingConnection.fromUuid)?.name || (lang === 'ru' ? 'Команда А' : 'Team A') }}</span>
              <span class="bf-canvas-midline-label">{{ lang === 'ru' ? '— линия фронта —' : '— front line —' }}</span>
              <span class="bf-canvas-label-b">{{ getElement(activeEditingConnection.toUuid)?.name || (lang === 'ru' ? 'Команда Б' : 'Team B') }}</span>

              <!-- Team A tokens -->
              <template v-for="(stack, stackIdx) in getCombatants(getElement(activeEditingConnection.fromUuid))" :key="'ta-' + stack.uuid">
                <div
                  class="bf-token"
                  :style="{
                    left: coordToCanvasPercent(activeEditingConnection, getConnPos2D(activeEditingConnection, stack.uuid, -activeEditingConnection.settings.initialDistance / 2 - stackIdx * 25, (stackIdx - Math.floor(getCombatants(getElement(activeEditingConnection.fromUuid)).length / 2)) * 22).x, getConnPos2D(activeEditingConnection, stack.uuid, -activeEditingConnection.settings.initialDistance / 2 - stackIdx * 25, (stackIdx - Math.floor(getCombatants(getElement(activeEditingConnection.fromUuid)).length / 2)) * 22).y).xPct + '%',
                    top: coordToCanvasPercent(activeEditingConnection, getConnPos2D(activeEditingConnection, stack.uuid, -activeEditingConnection.settings.initialDistance / 2 - stackIdx * 25, (stackIdx - Math.floor(getCombatants(getElement(activeEditingConnection.fromUuid)).length / 2)) * 22).x, getConnPos2D(activeEditingConnection, stack.uuid, -activeEditingConnection.settings.initialDistance / 2 - stackIdx * 25, (stackIdx - Math.floor(getCombatants(getElement(activeEditingConnection.fromUuid)).length / 2)) * 22).y).yPct + '%'
                  }"
                  @mousedown="startTokenDrag($event, activeEditingConnection, stack.uuid, getConnPos2D(activeEditingConnection, stack.uuid, -activeEditingConnection.settings.initialDistance / 2 - stackIdx * 25, (stackIdx - Math.floor(getCombatants(getElement(activeEditingConnection.fromUuid)).length / 2)) * 22), 'A')"
                >
                  <div class="bf-token-ring team-a">
                    <img :src="stack.icon" />
                    <span class="bf-token-arrow team-a">→</span>
                  </div>
                  <div class="bf-token-label">{{ stack.count }}× {{ t('unit_name_' + stack.unitId) }}</div>
                  <div class="bf-token-coords">
                    x:{{ getConnPos2D(activeEditingConnection, stack.uuid, -activeEditingConnection.settings.initialDistance / 2 - stackIdx * 25).x }}
                    y:{{ getConnPos2D(activeEditingConnection, stack.uuid, -activeEditingConnection.settings.initialDistance / 2 - stackIdx * 25).y }}
                  </div>
                </div>
              </template>

              <!-- Team B tokens -->
              <template v-for="(stack, stackIdx) in getCombatants(getElement(activeEditingConnection.toUuid))" :key="'tb-' + stack.uuid">
                <div
                  class="bf-token"
                  :style="{
                    left: coordToCanvasPercent(activeEditingConnection, getConnPos2D(activeEditingConnection, stack.uuid, activeEditingConnection.settings.initialDistance / 2 + stackIdx * 25, (stackIdx - Math.floor(getCombatants(getElement(activeEditingConnection.toUuid)).length / 2)) * 22).x, getConnPos2D(activeEditingConnection, stack.uuid, activeEditingConnection.settings.initialDistance / 2 + stackIdx * 25, (stackIdx - Math.floor(getCombatants(getElement(activeEditingConnection.toUuid)).length / 2)) * 22).y).xPct + '%',
                    top: coordToCanvasPercent(activeEditingConnection, getConnPos2D(activeEditingConnection, stack.uuid, activeEditingConnection.settings.initialDistance / 2 + stackIdx * 25, (stackIdx - Math.floor(getCombatants(getElement(activeEditingConnection.toUuid)).length / 2)) * 22).x, getConnPos2D(activeEditingConnection, stack.uuid, activeEditingConnection.settings.initialDistance / 2 + stackIdx * 25, (stackIdx - Math.floor(getCombatants(getElement(activeEditingConnection.toUuid)).length / 2)) * 22).y).yPct + '%'
                  }"
                  @mousedown="startTokenDrag($event, activeEditingConnection, stack.uuid, getConnPos2D(activeEditingConnection, stack.uuid, activeEditingConnection.settings.initialDistance / 2 + stackIdx * 25, (stackIdx - Math.floor(getCombatants(getElement(activeEditingConnection.toUuid)).length / 2)) * 22), 'B')"
                >
                  <div class="bf-token-ring team-b">
                    <img :src="stack.icon" style="transform: scaleX(-1);" />
                    <span class="bf-token-arrow team-b">←</span>
                  </div>
                  <div class="bf-token-label">{{ stack.count }}× {{ t('unit_name_' + stack.unitId) }}</div>
                  <div class="bf-token-coords">
                    x:{{ getConnPos2D(activeEditingConnection, stack.uuid, activeEditingConnection.settings.initialDistance / 2 + stackIdx * 25).x }}
                    y:{{ getConnPos2D(activeEditingConnection, stack.uuid, activeEditingConnection.settings.initialDistance / 2 + stackIdx * 25).y }}
                  </div>
                </div>
              </template>

            </div>
            <div style="margin-top: 6px; font-size: 0.62rem; color: var(--text-dim); text-align:center;">
              {{ lang === 'ru' ? 'Перетаскивайте токены для установки стартовых позиций. Команда А — слева, Б — справа.' : 'Drag tokens to set starting positions. Team A on left, Team B on right.' }}
            </div>
          </div>

          <!-- Reset positions button -->
          <div style="display:flex; justify-content:flex-end;">
            <button class="btn btn-secondary" style="font-size:0.72rem; padding: 5px 12px;" @click="() => { activeEditingConnection.settings.positions = {}; saveToLocalStorage(); }">
              {{ lang === 'ru' ? 'Сбросить позиции' : 'Reset Positions' }}
            </button>
          </div>

        </div>

        <div style="display:flex; justify-content:flex-end; padding: 12px 16px; border-top: 1px solid rgba(255,255,255,0.06);">
          <button class="btn btn-secondary" @click="() => { showConnectionSettingsModal = false; saveToLocalStorage(); }">
            {{ lang === 'ru' ? 'Готово' : 'Done' }}
          </button>
        </div>
      </div>
    </div>


    <!-- Commander Skins Picker Modal -->
    <SkinModal
      :show="showSkinModal"
      :allCommanders="allCommanders"
      :lang="lang"
      :skinCard="skinCard"
      @close="showSkinModal = false"
      @select="selectSkin"
    />

  </div>
</template>

<style>
/* Root styles and animations are defined in style.css */
</style>
