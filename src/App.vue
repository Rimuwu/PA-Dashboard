<script setup>
import { ref, computed, onMounted, watch, nextTick, shallowRef } from 'vue';
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
  FileText,
  Palette,
  Target,
  Star,
  Trophy,
  Skull,
  Flame,
  Move
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

// Commander Skins State
const showSkinModal = ref(false);
const skinCard = ref(null);

const allCommanders = computed(() => {
  return unitsData.filter(u => u.category === 'commander' || u.id.includes('commander'));
});

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
const panStart = ref({ x: 0, y: 0 });

// Localization
const lang = ref('ru'); // default to 'ru'

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

// Simulation Settings Modal State
const showSimSettingsModal = ref(false);
const showConnectionSettingsModal = ref(false);
const activeEditingConnection = ref(null);
const simSettings = ref({
  maxTime: 120,
  playbackSpeed: 1.0,
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
const setConnPos2D = (conn, stackUuid, x, y) => {
  if (!conn || !conn.settings) return;
  if (!conn.settings.positions) conn.settings.positions = {};
  conn.settings.positions[stackUuid] = { x: Number(x), y: Number(y) };
  saveToLocalStorage();
};

// Dragging state for 2D canvas tokens
const canvasDragState = ref(null); // { conn, stackUuid, startMx, startMy, startX, startY, teamSide }

const startTokenDrag = (e, conn, stackUuid, pos2d, teamSide) => {
  e.preventDefault();
  const el = e.currentTarget.closest('.bf-canvas-wrap');
  if (!el) return;
  canvasDragState.value = {
    conn, stackUuid, teamSide,
    startMx: e.clientX, startMy: e.clientY,
    startX: pos2d.x, startY: pos2d.y,
    rect: el.getBoundingClientRect()
  };
  const onMove = (me) => {
    const s = canvasDragState.value;
    if (!s) return;
    const dist = s.conn.settings.initialDistance || 300;
    const W = s.rect.width;
    const H = s.rect.height;
    const pxPerUnit = W / (dist * 2 + 300);
    const dx = (me.clientX - s.startMx) / pxPerUnit;
    const dy = (me.clientY - s.startMy) / pxPerUnit;
    let nx = s.startX + dx;
    let ny = s.startY + dy;
    // Clamp: team A left half, team B right half
    if (s.teamSide === 'A') nx = Math.min(0, Math.max(-dist, nx));
    else nx = Math.max(0, Math.min(dist, nx));
    ny = Math.max(-100, Math.min(100, ny));
    setConnPos2D(s.conn, s.stackUuid, Math.round(nx), Math.round(ny));
  };
  const onUp = () => {
    canvasDragState.value = null;
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

// SVG range circle for a unit (used in bf2d-svg)
const getSvgRangeCircle = (ux, uy, range, trackW, trackH) => {
  if (!animSim.value) return null;
  const connUuid = animSim.value.connUuid;
  const conn = connections.value.find(c => c.uuid === connUuid);
  const dist = conn?.settings?.initialDistance || simSettings.value.initialDistance || 300;
  const minX = -(dist + 150); const maxX = dist + 150;
  const cx = ((ux - minX) / (maxX - minX)) * trackW;
  const cy = (((uy + 100) / 200) * 80 + 10) / 100 * trackH;
  const rx = (range / (maxX - minX)) * trackW;
  const ry = (range / 200) * trackH * 0.8;
  return { cx, cy, rx, ry };
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

  return units.value.filter(u => {
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
    
    return matchesSearch && matchesCategory && matchesSub && matchesTarget && matchesTier;
  });
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
  
  const canvasX = (dropX - canvasOffset.value.x) / canvasZoom.value + 2500;
  const canvasY = (dropY - canvasOffset.value.y) / canvasZoom.value + 2500;
  
  const rawX = canvasX - CARD_WIDTH / 2;
  const rawY = canvasY - 80;
  
  placedUnits.value.push({
    uuid: generateUuid(),
    unitId: unit.id,
    x: snapToGrid.value ? Math.round(rawX / 40) * 40 : rawX,
    y: snapToGrid.value ? Math.round(rawY / 40) * 40 : rawY,
    count: 1,
    showFactoryMenu: false
  });
  
  draggedUnit.value = null;
  saveToLocalStorage();
};

// Panning and marquee selection on background click
const startPanning = (e) => {
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

  if (isInteractive) {
    return;
  }
  
  const rect = canvasRef.value.getBoundingClientRect();
  const canvasX = (e.clientX - rect.left - canvasOffset.value.x) / canvasZoom.value + 2500;
  const canvasY = (e.clientY - rect.top - canvasOffset.value.y) / canvasZoom.value + 2500;

  if (e.shiftKey) {
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
    selectedCardUuids.value = [];
  }
  closeContextMenu();
};

const panCanvas = (e) => {
  const rect = canvasRef.value.getBoundingClientRect();
  
  if (isPanning.value) {
    canvasOffset.value = {
      x: e.clientX - panStart.value.x,
      y: e.clientY - panStart.value.y
    };
  } else if (isSelecting.value && selectionBox.value) {
    const canvasX = (e.clientX - rect.left - canvasOffset.value.x) / canvasZoom.value + 2500;
    const canvasY = (e.clientY - rect.top - canvasOffset.value.y) / canvasZoom.value + 2500;
    
    selectionBox.value.currentX = canvasX;
    selectionBox.value.currentY = canvasY;
    
    const minX = Math.min(selectionBox.value.startX, selectionBox.value.currentX);
    const maxX = Math.max(selectionBox.value.startX, selectionBox.value.currentX);
    const minY = Math.min(selectionBox.value.startY, selectionBox.value.currentY);
    const maxY = Math.max(selectionBox.value.startY, selectionBox.value.currentY);
    
    selectedCardUuids.value = placedUnits.value.filter(u => {
      return !(
        u.x + CARD_WIDTH < minX ||
        u.x > maxX ||
        u.y + CARD_HEIGHT < minY ||
        u.y > maxY
      );
    }).map(u => u.uuid);
  } else if (activeDragCard.value) {
    const mouseCanvasX = (e.clientX - rect.left - canvasOffset.value.x) / canvasZoom.value + 2500;
    const mouseCanvasY = (e.clientY - rect.top - canvasOffset.value.y) / canvasZoom.value + 2500;
    
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
    const mouseCanvasX = (e.clientX - rect.left - canvasOffset.value.x) / canvasZoom.value + 2500;
    const mouseCanvasY = (e.clientY - rect.top - canvasOffset.value.y) / canvasZoom.value + 2500;
    
    const rawX = mouseCanvasX - dragAreaOffset.value.x;
    const rawY = mouseCanvasY - dragAreaOffset.value.y;
    
    const nextX = snapToGrid.value ? Math.round(rawX / 40) * 40 : rawX;
    const nextY = snapToGrid.value ? Math.round(rawY / 40) * 40 : rawY;
    
    const dx = nextX - activeDragArea.value.x;
    const dy = nextY - activeDragArea.value.y;
    
    if (dx !== 0 || dy !== 0) {
      // Drag all units inside this Group Area with it!
      const insideUnits = getAreaUnits(activeDragArea.value.uuid);
      insideUnits.forEach(u => {
        u.x += dx;
        u.y += dy;
      });
      activeDragArea.value.x = nextX;
      activeDragArea.value.y = nextY;
    }
  } else if (activeConnectionDrag.value) {
    activeConnectionDrag.value.currentX = (e.clientX - rect.left - canvasOffset.value.x) / canvasZoom.value + 2500;
    activeConnectionDrag.value.currentY = (e.clientY - rect.top - canvasOffset.value.y) / canvasZoom.value + 2500;
  }
};

const stopPanning = () => {
  isPanning.value = false;
  isSelecting.value = false;
  selectionBox.value = null;
  activeDragCard.value = null;
  activeDragArea.value = null;
  activeConnectionDrag.value = null;
  saveToLocalStorage();
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

const resetZoom = () => {
  canvasZoom.value = 0.9;
  canvasOffset.value = { x: 100, y: 100 };
  saveToLocalStorage();
};

// Dragging a card
const startDragCard = (placedUnit, e) => {
  if (e.target.closest('.qty-controller') || e.target.closest('.close-btn') || e.target.closest('.card-actions') || e.target.closest('.factory-popup')) {
    return;
  }
  e.stopPropagation();
  activeDragCard.value = placedUnit;
  
  const rect = canvasRef.value.getBoundingClientRect();
  const mouseCanvasX = (e.clientX - rect.left - canvasOffset.value.x) / canvasZoom.value + 2500;
  const mouseCanvasY = (e.clientY - rect.top - canvasOffset.value.y) / canvasZoom.value + 2500;
  
  dragCardOffset.value = {
    x: mouseCanvasX - placedUnit.x,
    y: mouseCanvasY - placedUnit.y
  };
  closeContextMenu();
};

// Remove card and its connections
const removePlacedUnit = (uuid) => {
  placedUnits.value = placedUnits.value.filter(u => u.uuid !== uuid);
  connections.value = connections.value.filter(c => c.fromUuid !== uuid && c.toUuid !== uuid);
  saveToLocalStorage();
};

// Quantity adjusters
const adjustCount = (placedUnit, amount) => {
  placedUnit.count = Math.max(1, Math.min(10000, placedUnit.count + amount));
  saveToLocalStorage();
};

const updateCount = (placedUnit, e) => {
  const val = parseInt(e.target.value);
  placedUnit.count = isNaN(val) ? 1 : Math.max(1, Math.min(10000, val));
  saveToLocalStorage();
};

// Connection drawing system (Supports cards and Areas!)
const startConnection = (placedElement, side, e) => {
  e.stopPropagation();
  e.preventDefault();
  
  const isArea = placedElement.width !== undefined;
  const w = isArea ? placedElement.width : CARD_WIDTH;
  const h = isArea ? placedElement.height : CARD_HEIGHT;
  
  const startX = side === 'right' ? placedElement.x + w : placedElement.x;
  const startY = placedElement.y + h / 2;
  
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
  const rawX = factory.x + CARD_WIDTH + 60;
  const rawY = factory.y;
  
  placedUnits.value.push({
    uuid: generateUuid(),
    unitId: buildUnitId,
    x: snapToGrid.value ? Math.round(rawX / 40) * 40 : rawX,
    y: snapToGrid.value ? Math.round(rawY / 40) * 40 : rawY,
    count: 1,
    showFactoryMenu: false
  });
  
  factory.showFactoryMenu = false;
  saveToLocalStorage();
};

// Clear the board
const clearBoard = () => {
  if (confirm(lang.value === 'ru' ? "Вы уверены, что хотите очистить весь холст?" : "Are you sure you want to clear the entire comparison canvas?")) {
    placedUnits.value = [];
    groupAreas.value = [];
    connections.value = [];
    selectedCardUuids.value = [];
    saveToLocalStorage();
  }
};

// Save board layout to file
const saveToFile = () => {
  const dataStr = JSON.stringify({
    placedUnits: placedUnits.value,
    groupAreas: groupAreas.value,
    connections: connections.value
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
          placedUnits.value = data.placedUnits;
          groupAreas.value = Array.isArray(data.groupAreas) ? data.groupAreas : [];
          connections.value = Array.isArray(data.connections) ? data.connections : [];
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
  localStorage.setItem('pa_canvas_layout_data', JSON.stringify({
    placedUnits: placedUnits.value,
    groupAreas: groupAreas.value,
    connections: connections.value,
    canvasOffset: canvasOffset.value,
    canvasZoom: canvasZoom.value,
    lang: lang.value,
    gridEnabled: gridEnabled.value,
    snapToGrid: snapToGrid.value,
    simulationResults: simulationResults.value
  }));
};

const loadFromLocalStorage = () => {
  const raw = localStorage.getItem('pa_canvas_layout_data');
  if (raw) {
    try {
      const data = JSON.parse(raw);
      if (Array.isArray(data.placedUnits)) placedUnits.value = data.placedUnits;
      if (Array.isArray(data.groupAreas)) groupAreas.value = data.groupAreas;
      if (Array.isArray(data.connections)) connections.value = data.connections;
      if (data.canvasOffset) canvasOffset.value = data.canvasOffset;
      if (data.canvasZoom) canvasZoom.value = data.canvasZoom;
      if (data.lang) lang.value = data.lang;
      if (data.gridEnabled !== undefined) gridEnabled.value = data.gridEnabled;
      if (data.snapToGrid !== undefined) snapToGrid.value = data.snapToGrid;
      if (data.simulationResults) simulationResults.value = data.simulationResults;
    } catch (e) {
      console.error("Failed to load layout from local storage:", e);
    }
  }
};

// Remove connection port link
const removeConnection = (uuid) => {
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
    isPlaying: true,
    intervalId: null,
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
    state.displayedLog = [...state.displayedLog, ...(tick.newLogs || [])];
    state.currentTickIndex++;
    animSim.value = { ...state };
  };

  // Compress: skip ticks with no log events and no big HP change for speed
  const TICK_INTERVAL_MS = Math.round(25 / (simSettings.value.playbackSpeed || 1.0));
  state.intervalId = setInterval(advanceTick, TICK_INTERVAL_MS);
  advanceTick(); // show first tick immediately
  animSim.value = { ...state };
};

// Center canvas around origin (2500, 2500)
const goToCenter = () => {
  if (!canvasRef.value) return;
  const rect = canvasRef.value.getBoundingClientRect();
  canvasOffset.value = {
    x: rect.width / 2 - 2500 * canvasZoom.value,
    y: rect.height / 2 - 2500 * canvasZoom.value
  };
  saveToLocalStorage();
};

// Right-click Custom Context Menu Handlers
const onCanvasContextMenu = (e) => {
  e.preventDefault();
  const rect = canvasRef.value.getBoundingClientRect();
  const canvasX = (e.clientX - rect.left - canvasOffset.value.x) / canvasZoom.value + 2500;
  const canvasY = (e.clientY - rect.top - canvasOffset.value.y) / canvasZoom.value + 2500;
  
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
  placedUnits.value = placedUnits.value.filter(u => !selectedCardUuids.value.includes(u.uuid));
  connections.value = connections.value.filter(c => !selectedCardUuids.value.includes(c.fromUuid) && !selectedCardUuids.value.includes(c.toUuid));
  selectedCardUuids.value = [];
  saveToLocalStorage();
};

const groupSelectedIntoArea = () => {
  if (selectedCardUuids.value.length === 0) return;
  const selectedCards = placedUnits.value.filter(u => selectedCardUuids.value.includes(u.uuid));
  if (selectedCards.length === 0) return;
  
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  selectedCards.forEach(c => {
    if (c.x < minX) minX = c.x;
    if (c.x + CARD_WIDTH > maxX) maxX = c.x + CARD_WIDTH;
    if (c.y < minY) minY = c.y;
    if (c.y + CARD_HEIGHT > maxY) maxY = c.y + CARD_HEIGHT;
  });
  
  const padding = 40;
  const x = minX - padding;
  const y = minY - padding;
  const w = (maxX - minX) + padding * 2;
  const h = (maxY - minY) + padding * 2;
  
  groupAreas.value.push({
    uuid: generateUuid(),
    name: lang.value === 'ru' ? `Группа ${groupAreas.value.length + 1}` : `Group ${groupAreas.value.length + 1}`,
    x: snapToGrid.value ? Math.round(x / 40) * 40 : x,
    y: snapToGrid.value ? Math.round(y / 40) * 40 : y,
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
};

// Group Area dragging and resizing systems
const startDragArea = (area, e) => {
  if (e.target.closest('.group-area-resize-handle') || e.target.closest('.group-area-action-btn') || e.target.closest('.group-area-title-input')) {
    return;
  }
  e.stopPropagation();
  activeDragArea.value = area;
  
  const rect = canvasRef.value.getBoundingClientRect();
  const mouseCanvasX = (e.clientX - rect.left - canvasOffset.value.x) / canvasZoom.value + 2500;
  const mouseCanvasY = (e.clientY - rect.top - canvasOffset.value.y) / canvasZoom.value + 2500;
  
  dragAreaOffset.value = {
    x: mouseCanvasX - area.x,
    y: mouseCanvasY - area.y
  };
  closeContextMenu();
};

const startResizeArea = (area, e) => {
  e.stopPropagation();
  e.preventDefault();
  const startWidth = area.width || 380;
  const startHeight = area.height || 260;
  const startX = e.clientX;
  const startY = e.clientY;
  
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
    const cx = unit.x + CARD_WIDTH / 2;
    const cy = unit.y + CARD_HEIGHT / 2;
    return cx >= area.x && cx <= area.x + w &&
           cy >= area.y && cy <= area.y + h;
  });
};

// Context Menu command actions
const addGroupArea = (x, y) => {
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
  const inside = getAreaUnits(areaUuid);
  const uuids = inside.map(u => u.uuid);
  placedUnits.value = placedUnits.value.filter(u => !uuids.includes(u.uuid));
  connections.value = connections.value.filter(c => !uuids.includes(c.fromUuid) && !uuids.includes(c.toUuid));
  saveToLocalStorage();
};

const deleteGroupArea = (areaUuid) => {
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
    return {
      uuid: u.uuid,
      x: u.x,
      y: u.y,
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

// Helper to normalize layer names across different PA spec versions
const normalizeLayer = (l) => {
  if (!l) return '';
  const str = String(l).toLowerCase().replace('wl_', '').replace('horizontal', '');
  if (str.includes('orbital')) return 'orbital';
  if (str.includes('air')) return 'air';
  if (str.includes('land') || str.includes('ground') || str.includes('surface')) return 'land';
  if (str.includes('water') || (str.includes('sea') && !str.includes('seafloor'))) return 'sea';
  if (str.includes('seafloor') || str.includes('underwater')) return 'seafloor';
  return str;
};

const canTargetLayer = (wpnTargetLayers, unitLayers) => {
  if (!wpnTargetLayers || wpnTargetLayers.length === 0) return true;
  if (!unitLayers || unitLayers.length === 0) return true;
  
  const normalizedUnitLayers = unitLayers.map(normalizeLayer);
  return wpnTargetLayers.some(wpnL => {
    const normWpn = normalizeLayer(wpnL);
    if (normWpn === 'anysurface' || normWpn === 'anyhorizontalgroundorwatersurface') {
      return normalizedUnitLayers.includes('land') || normalizedUnitLayers.includes('sea');
    }
    return normalizedUnitLayers.includes(normWpn);
  });
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
const runBattleSimulation = (nodeA, nodeB, conn = null) => {
  const listA = getCombatants(nodeA);
  const listB = getCombatants(nodeB);
  
  if (listA.length === 0 || listB.length === 0) return null;
  
  const initialDistance = conn?.settings?.initialDistance || simSettings.value.initialDistance || 300;
  
  let aList = [];
  listA.forEach((stack, stackIdx) => {
    const spec = getUnitById(stack.unitId);
    const stored = conn?.settings?.positions?.[stack.uuid];
    const defaultX = -initialDistance / 2 - stackIdx * 25;
    const defaultY = (stackIdx - Math.floor(listA.length / 2)) * 20;
    const pos2d = stored ? (typeof stored === 'number' ? { x: stored, y: 0 } : stored) : { x: defaultX, y: defaultY };
    
    const maxRange = spec?.weapons && spec.weapons.length > 0
      ? Math.max(...spec.weapons.map(w => w.range))
      : 100;
    
    for (let i = 0; i < stack.count; i++) {
      aList.push({
        id: stack.uuid + '_' + i,
        name: stack.name,
        icon: stack.icon,
        hp: stack.health,
        maxHp: stack.health,
        cost: stack.cost,
        weapons: spec?.weapons || [],
        layers: stack.layers,
        move_speed: spec?.move_speed || 0,
        x: pos2d.x - i * 8,
        y: pos2d.y + (i % 3 - 1) * 10,
        firingAt: null,
        maxRange
      });
    }
  });
  
  let bList = [];
  listB.forEach((stack, stackIdx) => {
    const spec = getUnitById(stack.unitId);
    const stored = conn?.settings?.positions?.[stack.uuid];
    const defaultX = initialDistance / 2 + stackIdx * 25;
    const defaultY = (stackIdx - Math.floor(listB.length / 2)) * 20;
    const pos2d = stored ? (typeof stored === 'number' ? { x: stored, y: 0 } : stored) : { x: defaultX, y: defaultY };
    
    const maxRange = spec?.weapons && spec.weapons.length > 0
      ? Math.max(...spec.weapons.map(w => w.range))
      : 100;
    
    for (let i = 0; i < stack.count; i++) {
      bList.push({
        id: stack.uuid + '_' + i,
        name: stack.name,
        icon: stack.icon,
        hp: stack.health,
        maxHp: stack.health,
        cost: stack.cost,
        weapons: spec?.weapons || [],
        layers: stack.layers,
        move_speed: spec?.move_speed || 0,
        x: pos2d.x + i * 8,
        y: pos2d.y + (i % 3 - 1) * 10,
        firingAt: null,
        maxRange
      });
    }
  });
  
  if (aList.length === 0 || bList.length === 0) return null;
  
  aList.sort((x, y) => x.x - y.x);
  bList.sort((x, y) => y.x - x.x);
  
  const totalCostA = aList.reduce((sum, u) => sum + u.cost, 0);
  const totalCostB = bList.reduce((sum, u) => sum + u.cost, 0);
  
  const totalMaxHpA = aList.reduce((sum, u) => sum + u.maxHp, 0);
  const totalMaxHpB = bList.reduce((sum, u) => sum + u.maxHp, 0);
  
  let time = 0;
  let log = [];
  let ticks = [];
  
  const nameA = nodeA.type === 'area' ? nodeA.name : `${listA[0].count}x ${listA[0].name}`;
  const nameB = nodeB.type === 'area' ? nodeB.name : `${listB[0].count}x ${listB[0].name}`;
  
  const initialStartLog = {
    time: 0,
    type: 'start',
    event: lang.value === 'ru'
      ? `Начало сражения: ${nameA} (Металл: ${totalCostA}, Здоровье: ${totalMaxHpA}) против ${nameB} (Металл: ${totalCostB}, Здоровье: ${totalMaxHpB})`
      : `Combat Initiated: ${nameA} (Cost: ${totalCostA}, HP: ${totalMaxHpA}) vs ${nameB} (Cost: ${totalCostB}, HP: ${totalMaxHpB})`
  };
  log.push(initialStartLog);

  ticks.push({
    time: 0,
    aHp: totalMaxHpA,
    bHp: totalMaxHpB,
    aUnits: aList.map(u => ({ id: u.id, name: u.name, icon: u.icon, hp: u.hp, maxHp: u.maxHp, x: u.x, y: u.y || 0, firingAt: null, maxRange: u.maxRange })),
    bUnits: bList.map(u => ({ id: u.id, name: u.name, icon: u.icon, hp: u.hp, maxHp: u.maxHp, x: u.x, y: u.y || 0, firingAt: null, maxRange: u.maxRange })),
    newLogs: [initialStartLog]
  });
  
  const tick = 0.1;
  const maxSimTime = simSettings.value.maxTime || 120;
  
  let wpnDmgAccA = {};
  let wpnDmgAccB = {};
  
  while (aList.length > 0 && bList.length > 0 && time < maxSimTime) {
    const logStartIdx = log.length;
    
    aList.forEach(u => u.firingAt = null);
    bList.forEach(u => u.firingAt = null);
    
    // 1. Team A actions (fire or move)
    aList.forEach(attacker => {
      if (attacker.hp <= 0) return;
      
      const weapons = attacker.weapons && attacker.weapons.length > 0 
        ? attacker.weapons 
        : [{ name: 'Default Gun', dps: 10, range: 100, target_layers: ['WL_LandHorizontal', 'WL_WaterSurface'] }];
      
      let fired = false;
      
      weapons.forEach(wpn => {
        if (wpn.dps <= 0) return;
        
        const targets = bList.filter(t => t.hp > 0 && canTargetLayer(wpn.target_layers, t.layers));
        if (targets.length > 0) {
          // Sort by 2D distance
          targets.sort((a2, b2) => {
            const dA = Math.hypot(attacker.x - a2.x, (attacker.y||0) - (a2.y||0));
            const dB = Math.hypot(attacker.x - b2.x, (attacker.y||0) - (b2.y||0));
            return dA - dB;
          });
          const target = targets[0];
          const dist2d = Math.hypot(attacker.x - target.x, (attacker.y||0) - (target.y||0));
          
          if (dist2d <= wpn.range) {
            fired = true;
            attacker.firingAt = target.id;
            const dmg = wpn.dps * tick;
            target.hp -= dmg;
            
            const wKey = `${wpn.name}__${target.name}`;
            if (!wpnDmgAccA[wKey]) {
              wpnDmgAccA[wKey] = { wpnName: wpn.name, targetName: target.name, damage: 0, attackerName: attacker.name };
            }
            wpnDmgAccA[wKey].damage += dmg;
          }
        }
      });
      
      if (!fired && attacker.move_speed > 0) {
        const enemies = bList.filter(e => e.hp > 0);
        if (enemies.length > 0) {
          enemies.sort((a2, b2) => {
            const dA = Math.hypot(attacker.x - a2.x, (attacker.y||0) - (a2.y||0));
            const dB = Math.hypot(attacker.x - b2.x, (attacker.y||0) - (b2.y||0));
            return dA - dB;
          });
          const closest = enemies[0];
          const dx = closest.x - attacker.x;
          const dy = (closest.y||0) - (attacker.y||0);
          const dist2d = Math.hypot(dx, dy) || 1;
          // Move in X direction only (Y is static during battle)
          const dir = Math.sign(dx);
          attacker.x += dir * attacker.move_speed * tick;
        }
      }
    });
    
    // 2. Team B actions (fire or move)
    bList.forEach(attacker => {
      if (attacker.hp <= 0) return;
      
      const weapons = attacker.weapons && attacker.weapons.length > 0 
        ? attacker.weapons 
        : [{ name: 'Default Gun', dps: 10, range: 100, target_layers: ['WL_LandHorizontal', 'WL_WaterSurface'] }];
      
      let fired = false;
      
      weapons.forEach(wpn => {
        if (wpn.dps <= 0) return;
        
        const targets = aList.filter(t => t.hp > 0 && canTargetLayer(wpn.target_layers, t.layers));
        if (targets.length > 0) {
          targets.sort((a2, b2) => {
            const dA = Math.hypot(attacker.x - a2.x, (attacker.y||0) - (a2.y||0));
            const dB = Math.hypot(attacker.x - b2.x, (attacker.y||0) - (b2.y||0));
            return dA - dB;
          });
          const target = targets[0];
          const dist2d = Math.hypot(attacker.x - target.x, (attacker.y||0) - (target.y||0));
          
          if (dist2d <= wpn.range) {
            fired = true;
            attacker.firingAt = target.id;
            const dmg = wpn.dps * tick;
            target.hp -= dmg;
            
            const wKey = `${wpn.name}__${target.name}`;
            if (!wpnDmgAccB[wKey]) {
              wpnDmgAccB[wKey] = { wpnName: wpn.name, targetName: target.name, damage: 0, attackerName: attacker.name };
            }
            wpnDmgAccB[wKey].damage += dmg;
          }
        }
      });
      
      if (!fired && attacker.move_speed > 0) {
        const enemies = aList.filter(e => e.hp > 0);
        if (enemies.length > 0) {
          enemies.sort((a2, b2) => {
            const dA = Math.hypot(attacker.x - a2.x, (attacker.y||0) - (a2.y||0));
            const dB = Math.hypot(attacker.x - b2.x, (attacker.y||0) - (b2.y||0));
            return dA - dB;
          });
          const closest = enemies[0];
          const dx = closest.x - attacker.x;
          const dir = Math.sign(dx);
          attacker.x += dir * attacker.move_speed * tick;
        }
      }
    });
    
    const deadB = bList.filter(t => t.hp <= 0);
    const deadA = aList.filter(t => t.hp <= 0);
    
    const processDeathLogs = (deadList, teamName, isTeamA) => {
      const counts = {};
      const icons = {};
      deadList.forEach(d => {
        counts[d.name] = (counts[d.name] || 0) + 1;
        icons[d.name] = d.icon;
      });
      for (const [unitName, count] of Object.entries(counts)) {
        const remainingList = isTeamA ? aList.filter(u => u.name === unitName && u.hp > 0) : bList.filter(u => u.name === unitName && u.hp > 0);
        const initialStackCount = (isTeamA ? listA : listB).filter(u => u.name === unitName).reduce((s, u) => s + u.count, 0);
        const remainingCount = remainingList.length;
        
        log.push({
          time: Number(time.toFixed(1)),
          type: 'death',
          unitName,
          icon: icons[unitName],
          teamName,
          event: lang.value === 'ru'
            ? `${count}x ${unitName} [${teamName}] уничтожено! (Осталось: ${remainingCount}/${initialStackCount})`
            : `${count}x ${unitName} of [${teamName}] destroyed! (Remaining: ${remainingCount}/${initialStackCount})`
        });
      }
    };

    if (deadB.length > 0) processDeathLogs(deadB, nameB, false);
    if (deadA.length > 0) processDeathLogs(deadA, nameA, true);

    bList = bList.filter(t => t.hp > 0);
    aList = aList.filter(t => t.hp > 0);
    
    time += tick;

    const newLogs = log.slice(logStartIdx);
    const tickIndex = Math.round(time / tick);
    if (newLogs.length > 0 || tickIndex % 5 === 0 || aList.length === 0 || bList.length === 0) {
      ticks.push({
        time: Number(time.toFixed(1)),
        aHp: aList.reduce((sum, u) => sum + u.hp, 0),
        bHp: bList.reduce((sum, u) => sum + u.hp, 0),
        aUnits: aList.map(u => ({ id: u.id, name: u.name, icon: u.icon, hp: u.hp, maxHp: u.maxHp, x: u.x, y: u.y || 0, firingAt: u.firingAt, maxRange: u.maxRange })),
        bUnits: bList.map(u => ({ id: u.id, name: u.name, icon: u.icon, hp: u.hp, maxHp: u.maxHp, x: u.x, y: u.y || 0, firingAt: u.firingAt, maxRange: u.maxRange })),
        newLogs
      });
    }
  } // end while

  let winner = null;

  let remainingCount = 0;
  let remainingHpPercent = 0;
  let resultText = '';
  
  const currentHpA = aList.reduce((sum, u) => sum + u.hp, 0);
  const currentHpB = bList.reduce((sum, u) => sum + u.hp, 0);
  
  if (aList.length > 0 && bList.length === 0) {
    winner = 'A';
    remainingCount = aList.length;
    remainingHpPercent = Math.round((currentHpA / totalMaxHpA) * 100);
    resultText = lang.value === 'ru' ? `${nameA} победил!` : `${nameA} Wins!`;
    log.push({
      time: Number(time.toFixed(1)),
      type: 'victory',
      event: lang.value === 'ru'
        ? `Сражение завершено. ${nameA} одержал победу! Выжило: ${remainingCount} шт. (${remainingHpPercent}% здоровья).`
        : `Battle concluded. ${nameA} is victorious! Survivors: ${remainingCount} (${remainingHpPercent}% HP).`
    });
  } else if (bList.length > 0 && aList.length === 0) {
    winner = 'B';
    remainingCount = bList.length;
    remainingHpPercent = Math.round((currentHpB / totalMaxHpB) * 100);
    resultText = lang.value === 'ru' ? `${nameB} победил!` : `${nameB} Wins!`;
    log.push({
      time: Number(time.toFixed(1)),
      type: 'victory',
      event: lang.value === 'ru'
        ? `Сражение завершено. ${nameB} одержал победу! Выжило: ${remainingCount} шт. (${remainingHpPercent}% здоровья).`
        : `Battle concluded. ${nameB} is victorious! Survivors: ${remainingCount} (${remainingHpPercent}% HP).`
    });
  } else {
    winner = 'Draw';
    resultText = lang.value === 'ru' ? 'Ничья / Взаимное уничтожение' : 'Draw / Mutual Annihilation';
    log.push({
      time: Number(time.toFixed(1)),
      type: 'draw',
      event: lang.value === 'ru'
        ? `Сражение завершено вничью. Все юниты с обеих сторон уничтожены.`
        : `Battle finished in a draw. All units destroyed.`
    });
  }
  
  const aSurvivingCounts = {};
  aList.forEach(u => {
    const cardUuid = u.id.split('_')[0];
    aSurvivingCounts[cardUuid] = (aSurvivingCounts[cardUuid] || 0) + 1;
  });
  
  const detailedA = listA.map(stack => {
    return {
      uuid: stack.uuid,
      name: stack.name,
      icon: stack.icon,
      cost: stack.cost,
      initialCount: stack.count,
      survivedCount: aSurvivingCounts[stack.uuid] || 0
    };
  });
  
  const bSurvivingCounts = {};
  bList.forEach(u => {
    const cardUuid = u.id.split('_')[0];
    bSurvivingCounts[cardUuid] = (bSurvivingCounts[cardUuid] || 0) + 1;
  });
  
  const detailedB = listB.map(stack => {
    return {
      uuid: stack.uuid,
      name: stack.name,
      icon: stack.icon,
      cost: stack.cost,
      initialCount: stack.count,
      survivedCount: bSurvivingCounts[stack.uuid] || 0
    };
  });
  
  return {
    winner,
    time: Number(time.toFixed(1)),
    a: {
      name: nameA,
      icon: listA[0]?.icon || '/units/pa_units_commanders_base_commander_base_commander.png',
      count: listA.reduce((sum, u) => sum + u.count, 0),
      cost: totalCostA,
      hpLeft: Math.round(currentHpA),
      maxHp: totalMaxHpA,
      unitsLeft: aList.length,
      hpPercent: Math.round((currentHpA / totalMaxHpA) * 100),
      detailedUnits: detailedA
    },
    b: {
      name: nameB,
      icon: listB[0]?.icon || '/units/pa_units_commanders_base_commander_base_commander.png',
      count: listB.reduce((sum, u) => sum + u.count, 0),
      cost: totalCostB,
      hpLeft: Math.round(currentHpB),
      maxHp: totalMaxHpB,
      unitsLeft: bList.length,
      hpPercent: Math.round((currentHpB / totalMaxHpB) * 100),
      detailedUnits: detailedB
    },
    remainingCount,
    remainingHpPercent,
    resultText,
    log,
    ticks,
    totalMaxHpA,
    totalMaxHpB
  };
};

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

watch([placedUnits, groupAreas, connections], () => {
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
          PA: TITANS
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
        
        <!-- Language Switcher -->
        <div style="display: flex; gap: 6px; margin-top: 12px; justify-content: flex-end;">
          <button 
            @click="lang = 'ru'"
            :style="{
              padding: '3px 8px',
              fontSize: '0.65rem',
              borderRadius: '3px',
              border: '1px solid',
              borderColor: lang === 'ru' ? '#fff' : 'var(--border-dim)',
              background: lang === 'ru' ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: lang === 'ru' ? '#fff' : 'var(--text-dim)',
              cursor: 'pointer',
              fontWeight: lang === 'ru' ? 'bold' : 'normal',
              fontFamily: 'var(--font-title)'
            }"
          >
            RU
          </button>
          <button 
            @click="lang = 'en'"
            :style="{
              padding: '3px 8px',
              fontSize: '0.65rem',
              borderRadius: '3px',
              border: '1px solid',
              borderColor: lang === 'en' ? '#fff' : 'var(--border-dim)',
              background: lang === 'en' ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: lang === 'en' ? '#fff' : 'var(--text-dim)',
              cursor: 'pointer',
              fontWeight: lang === 'en' ? 'bold' : 'normal',
              fontFamily: 'var(--font-title)'
            }"
          >
            EN
          </button>
        </div>
      </div>
      
      <!-- Category Grid -->
      <div class="category-grid" v-show="!filtersCollapsed">
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

      <!-- Sub filter selectors -->
      <div class="sub-filters-container" v-show="!filtersCollapsed">
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
        >
          <component :is="f.icon" class="chip-icon" />
          <span style="white-space: nowrap;">{{ f.label }}</span>
        </button>
      </div>

      <!-- Target Filter (Кого атакуют) — multi-select -->
      <div class="sub-filters-container filter-group-block" v-show="!filtersCollapsed">
        <div class="filter-group-label">
          <Target :size="11" />
          {{ lang === 'ru' ? 'Кого атакуют' : 'Target Types' }}
          <span v-if="activeTargetFilters.length > 0" class="filter-count-badge">{{ activeTargetFilters.length }}</span>
        </div>
        <div class="filter-group-chips">
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
        <div class="filter-group-label">
          <Star :size="11" />
          {{ lang === 'ru' ? 'Тир' : 'Tier' }}
          <span v-if="activeTierFilters.length > 0" class="filter-count-badge">{{ activeTierFilters.length }}</span>
        </div>
        <div class="filter-group-chips">
          <button
            v-for="tr in ['T1', 'T2', 'Titan']"
            :key="tr"
            @click="toggleTierFilter(tr)"
            :class="['sub-filter-chip', { active: activeTierFilters.includes(tr) }]"
          >{{ tr }}</button>
        </div>
      </div>
      
      <!-- Unit Grid List -->
      <div class="unit-list-container">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 6px;">
          <div class="sidebar-section-title" style="margin-bottom: 0; line-height: 1;">{{ t('dragToCanvas') }}</div>
          <button 
            @click="filtersCollapsed = !filtersCollapsed"
            style="background: transparent; border: none; color: var(--color-cyan); cursor: pointer; font-family: var(--font-title); font-size: 0.65rem; display: flex; align-items: center; gap: 4px; text-transform: uppercase;"
          >
            <component :is="filtersCollapsed ? ChevronDown : ChevronUp" :size="12" />
            {{ filtersCollapsed ? (lang === 'ru' ? 'Показать' : 'Show') : (lang === 'ru' ? 'Скрыть' : 'Hide') }}
          </button>
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
            <div class="sidebar-unit-cost">{{ unit.cost }} M</div>
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
        <button class="qty-btn" @click="resetZoom" style="padding: 2px 6px; color: var(--text-secondary); margin-left: 4px;"><RefreshCw :size="14" /></button>
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
            v-for="placed in placedUnits" 
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
            @mouseup="completeConnection(placed, $event)"
            @contextmenu.prevent.stop="onCardContextMenu(placed, $event)"
          >
            
            <div class="unit-card-header" @mousedown="startDragCard(placed, $event)">
              <img :src="placed.skinIcon || getUnitById(placed.unitId)?.icon" class="unit-card-icon" />
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

              <!-- Layer indicator -->
              <span 
                style="font-family: var(--font-title); font-size: 0.6rem; color: var(--color-cyan); background: rgba(0, 243, 255, 0.08); border: 1px solid rgba(0, 243, 255, 0.2); padding: 2px 4px; border-radius: 2px; text-transform: uppercase; margin-right: 4px; white-space: nowrap;"
                :title="lang === 'ru' ? 'Порядок слоя (Z-Index)' : 'Layer Order (Z-Index)'"
              >
                {{ lang === 'ru' ? 'Слой' : 'Layer' }}: {{ placed.zIndex || 10 }}
              </span>

              <!-- Overlapping warning icon -->
              <div 
                v-if="overlappingCardUuids.includes(placed.uuid)" 
                class="overlap-warning"
                :title="t('overlapping')"
              >
                <AlertTriangle :size="14" />
              </div>
              
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
              <!-- Unit layer badges -->
              <div class="stat-row-tags" v-if="getUnitById(placed.unitId)?.layers?.length">
                <span class="stat-label">{{ lang === 'ru' ? 'Слой' : 'Layer' }}:</span>
                <div class="tags-wrap">
                  <span 
                    v-for="lyr in getUnitById(placed.unitId).layers" 
                    :key="lyr"
                    class="layer-badge"
                    :class="'layer-' + lyr.toLowerCase()"
                  >{{ t(lyr) }}</span>
                </div>
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
        <div class="context-menu-divider"></div>
        <div class="context-menu-item danger" @click="deleteSelectedCards(); closeContextMenu()">
          <Trash2 :size="14" />
          {{ t('deleteSelected') }}
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
                <img :src="entry.icon" style="width:14px;height:14px;object-fit:contain;" />
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
    <div v-if="animSim" class="modal-overlay anim-sim-overlay" @click="stopAnimatedSim">
      <div class="modal-content anim-sim-modal" @click.stop>

        <!-- Header -->
        <div class="modal-header" style="border-bottom: 1px solid rgba(255,255,255,0.06);">
          <h3 class="modal-title" style="display:flex; align-items:center; gap:8px;">
            <Sword :size="16" style="color: var(--color-cyan);" />
            {{ lang === 'ru' ? 'Симуляция боя' : 'Battle Simulation' }}
            <span v-if="animSim.isPlaying" class="anim-live-badge">LIVE</span>
            <span v-else-if="animSim.done" class="anim-done-badge">{{ lang === 'ru' ? 'ЗАВЕРШЕНО' : 'DONE' }}</span>
          </h3>
          <div style="display:flex; gap:8px; align-items:center;">
            <span style="font-family: var(--font-title); font-size: 0.7rem; color: var(--text-dim);">
              {{ animSim.sim.ticks.length > 0 ? animSim.sim.ticks[Math.min(animSim.currentTickIndex, animSim.sim.ticks.length-1)].time.toFixed(1) : '0.0' }}s / {{ animSim.sim.time }}s
            </span>
            <button class="close-btn" @click="stopAnimatedSim"><X :size="18" /></button>
          </div>
        </div>

        <!-- HP Battle Bars -->
        <div style="padding: 20px 24px 12px; display:flex; flex-direction:column; gap:10px;">
          <!-- Team A bar -->
          <div style="display:flex; align-items:center; gap:10px;">
            <img :src="animSim.sim.a.icon" style="width:28px;height:28px;object-fit:contain;border-radius:3px;flex-shrink:0;" />
            <div style="flex:1;">
              <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span style="font-family:var(--font-title); font-size:0.7rem; font-weight:bold; color:#fff; max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">{{ animSim.sim.a.name }}</span>
                <span style="font-family:var(--font-title); font-size:0.65rem; color:var(--color-green);">{{ Math.round(animSim.aHpCur).toLocaleString() }} / {{ Math.round(animSim.sim.totalMaxHpA).toLocaleString() }} HP</span>
              </div>
              <div class="anim-hp-track">
                <div class="anim-hp-bar anim-hp-bar-a" :style="{ width: (animSim.sim.totalMaxHpA > 0 ? (animSim.aHpCur / animSim.sim.totalMaxHpA * 100) : 0) + '%' }"></div>
              </div>
            </div>
          </div>

          <!-- VS divider -->
          <div style="display:flex; align-items:center; gap:8px; padding: 2px 0;">
            <div style="flex:1; height:1px; background:rgba(255,255,255,0.06);"></div>
            <span style="font-family:var(--font-title); font-size:0.65rem; color:var(--text-dim); letter-spacing:0.1em;">VS</span>
            <div style="flex:1; height:1px; background:rgba(255,255,255,0.06);"></div>
          </div>

          <!-- Team B bar -->
          <div style="display:flex; align-items:center; gap:10px;">
            <img :src="animSim.sim.b.icon" style="width:28px;height:28px;object-fit:contain;border-radius:3px;flex-shrink:0;" />
            <div style="flex:1;">
              <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span style="font-family:var(--font-title); font-size:0.7rem; font-weight:bold; color:#fff; max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">{{ animSim.sim.b.name }}</span>
                <span style="font-family:var(--font-title); font-size:0.65rem; color:var(--color-red);">{{ Math.round(animSim.bHpCur).toLocaleString() }} / {{ Math.round(animSim.sim.totalMaxHpB).toLocaleString() }} HP</span>
              </div>
              <div class="anim-hp-track">
                <div class="anim-hp-bar anim-hp-bar-b" :style="{ width: (animSim.sim.totalMaxHpB > 0 ? (animSim.bHpCur / animSim.sim.totalMaxHpB * 100) : 0) + '%' }"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Visual Battlefield Track (2D) -->
        <div style="padding: 0 24px; margin-top: 10px; margin-bottom: 12px;" ref="bfTrackWrap">
          <div class="battlefield-track-2d" v-if="animCurrentTick" ref="bfTrack">
            <div class="bf2d-grid"></div>

            <!-- SVG layer: fire lines + range ellipses -->
            <svg class="bf2d-svg" :key="'svg-' + animSim.currentTickIndex">
              <!-- Range ellipses -->
              <template v-if="isShowRangesEnabled">
                <ellipse
                  v-for="u in animCurrentTick.aUnits" :key="'re-a-' + u.id"
                  class="bf2d-range-circle team-a"
                  :cx="`${getUnitLeftPercent(u.x)}%`"
                  :cy="`${getUnitTopPercent(u.y || 0)}%`"
                  :rx="`${(u.maxRange / 900) * 46}%`"
                  :ry="`${(u.maxRange / 200) * 35}%`"
                  stroke-width="1"
                />
                <ellipse
                  v-for="u in animCurrentTick.bUnits" :key="'re-b-' + u.id"
                  class="bf2d-range-circle team-b"
                  :cx="`${getUnitLeftPercent(u.x)}%`"
                  :cy="`${getUnitTopPercent(u.y || 0)}%`"
                  :rx="`${(u.maxRange / 900) * 46}%`"
                  :ry="`${(u.maxRange / 200) * 35}%`"
                  stroke-width="1"
                />
              </template>

              <!-- Fire lines: Team A shooting -->
              <template v-for="u in animCurrentTick.aUnits" :key="'fl-a-' + u.id">
                <line
                  v-if="u.firingAt && animCurrentTick.bUnits.find(t => t.id === u.firingAt)"
                  class="bf2d-shot-line team-a"
                  :x1="`${getUnitLeftPercent(u.x)}%`"
                  :y1="`${getUnitTopPercent(u.y || 0)}%`"
                  :x2="`${getUnitLeftPercent(animCurrentTick.bUnits.find(t => t.id === u.firingAt).x)}%`"
                  :y2="`${getUnitTopPercent(animCurrentTick.bUnits.find(t => t.id === u.firingAt).y || 0)}%`"
                  stroke-width="1.5"
                />
              </template>

              <!-- Fire lines: Team B shooting -->
              <template v-for="u in animCurrentTick.bUnits" :key="'fl-b-' + u.id">
                <line
                  v-if="u.firingAt && animCurrentTick.aUnits.find(t => t.id === u.firingAt)"
                  class="bf2d-shot-line team-b"
                  :x1="`${getUnitLeftPercent(u.x)}%`"
                  :y1="`${getUnitTopPercent(u.y || 0)}%`"
                  :x2="`${getUnitLeftPercent(animCurrentTick.aUnits.find(t => t.id === u.firingAt).x)}%`"
                  :y2="`${getUnitTopPercent(animCurrentTick.aUnits.find(t => t.id === u.firingAt).y || 0)}%`"
                  stroke-width="1.5"
                />
              </template>
            </svg>

            <!-- Team A units -->
            <div
              v-for="u in animCurrentTick.aUnits"
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
              v-for="u in animCurrentTick.bUnits"
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
            <template v-for="u in animCurrentTick.aUnits" :key="'ff-a-' + u.id + '-' + animSim.currentTickIndex">
              <div
                v-if="u.firingAt"
                class="bf2d-fire-flash team-a"
                :style="{ left: `${getUnitLeftPercent(u.x)}%`, top: `${getUnitTopPercent(u.y || 0)}%` }"
              ></div>
            </template>
            <template v-for="u in animCurrentTick.bUnits" :key="'ff-b-' + u.id + '-' + animSim.currentTickIndex">
              <div
                v-if="u.firingAt"
                class="bf2d-fire-flash team-b"
                :style="{ left: `${getUnitLeftPercent(u.x)}%`, top: `${getUnitTopPercent(u.y || 0)}%` }"
              ></div>
            </template>

          </div>
        </div>


        <!-- Winner Banner (shown once done) -->
        <div v-if="animSim.done" 
          style="margin: 0 24px 12px; padding:10px 16px; border-radius:6px; text-align:center; font-family:var(--font-title); font-size:0.95rem; font-weight:bold; border:1px solid; animation: fadeIn 0.4s ease;"
          :style="{
            borderColor: animSim.sim.winner === 'Draw' ? 'var(--color-orange)' : 'var(--color-green)',
            color: animSim.sim.winner === 'Draw' ? 'var(--color-orange)' : 'var(--color-green)',
            background: animSim.sim.winner === 'Draw' ? 'rgba(249,115,22,0.06)' : 'rgba(34,197,94,0.06)'
          }"
        >
          {{ animSim.sim.resultText }}
          <span v-if="animSim.sim.winner !== 'Draw'"> ({{ animSim.sim.remainingHpPercent }}% {{ t('hpPercentRemaining') }})</span>
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

    <!-- Help / Onboarding Modal -->
    <div v-if="showHelpModal" class="modal-overlay" @click="showHelpModal = false">
      <div class="modal-content" @click.stop style="width: 500px;">
        <div class="modal-header">
          <h3 class="modal-title">{{ t('helpTitle') }}</h3>
          <button class="close-btn" @click="showHelpModal = false">
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

          <!-- Unit layers -->
          <div v-if="unitDetailSpec.layers?.length" style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            <span style="font-size:0.72rem; color:var(--text-dim); font-weight:bold;">{{ lang === 'ru' ? 'Слой юнита:' : 'Unit Layer:' }}</span>
            <span v-for="lyr in unitDetailSpec.layers" :key="lyr" class="layer-badge" :class="'layer-' + lyr.toLowerCase()">{{ t(lyr) }}</span>
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
                      <span v-if="wpn.flight_type" class="flight-type-badge">{{ t('flight_type_' + wpn.flight_type.toLowerCase()) }}</span>
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
        
        <div class="modal-body" style="display:flex; flex-direction:column; gap:16px; padding:20px 0 10px;">
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

        <div style="display:flex; justify-content:flex-end; margin-top:16px;">
          <button class="btn btn-secondary" @click="showSimSettingsModal = false">
            {{ lang === 'ru' ? 'Готово' : 'Done' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Connection Settings Modal -->
    <div v-if="showConnectionSettingsModal && activeEditingConnection" class="modal-overlay" @click="showConnectionSettingsModal = false">
      <div class="modal-content" @click.stop style="width: 640px; max-height: 90vh; display: flex; flex-direction: column;">
        <div class="modal-header">
          <h3 class="modal-title" style="display:flex; align-items:center; gap:8px;">
            <Settings :size="16" style="color:var(--color-cyan);" />
            {{ lang === 'ru' ? 'Настройки связи' : 'Connection Settings' }}
          </h3>
          <button class="close-btn" @click="showConnectionSettingsModal = false"><X :size="18" /></button>
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
          <button class="btn btn-secondary" @click="showConnectionSettingsModal = false">
            {{ lang === 'ru' ? 'Готово' : 'Done' }}
          </button>
        </div>
      </div>
    </div>


    <!-- Commander Skins Picker Modal -->
    <div v-if="showSkinModal" class="modal-overlay" @click="showSkinModal = false">
      <div class="modal-content" @click.stop style="width: 680px; max-height: 80vh; display: flex; flex-direction: column;">
        <div class="modal-header">
          <h3 class="modal-title" style="display:flex; align-items:center; gap:8px;">
            <Palette :size="16" style="color:var(--color-orange);" />
            {{ lang === 'ru' ? 'Выбор скина Командира' : 'Select Commander Skin' }} ({{ allCommanders.length }})
          </h3>
          <button class="close-btn" @click="showSkinModal = false"><X :size="18" /></button>
        </div>
        
        <div class="modal-body" style="overflow-y: auto; padding: 16px; display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px;">
          <div 
            v-for="cmd in allCommanders" 
            :key="cmd.id"
            class="skin-grid-item"
            :class="{ active: skinCard && (skinCard.skinId === cmd.id || (!skinCard.skinId && skinCard.unitId === cmd.id)) }"
            @click="selectSkin(cmd)"
          >
            <img :src="cmd.icon" class="skin-img" />
            <div class="skin-title">{{ cmd.name }}</div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<style>
/* Root styles and animations are defined in style.css */
</style>
