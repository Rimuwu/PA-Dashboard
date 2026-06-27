<script setup>
import { ref, computed, onMounted, watch } from 'vue';
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
  ArrowDown
} from '@lucide/vue';
import unitsData from './data/units.json';

// Global constants
const CARD_WIDTH = 250;
const CARD_HEIGHT = 180; // approximate height for connection lines

// State variables
const units = ref(unitsData);
const searchQuery = ref('');
const selectedCategory = ref('all');
const activeSubFilter = ref('all'); // all, structures, mobile, combat, factories
const filtersCollapsed = ref(false);

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

// UI Popups & Modals
const activeBattleSimulation = ref(null);
const showHelpModal = ref(false);
const contextMenu = ref(null);
const sidebarHidden = ref(false);

// Translation Dictionary
const translations = {
  en: {
    logoSub: "Unit Comparison Canvas",
    searchPlaceholder: "Search units & structures...",
    dragToCanvas: "Drag to Canvas",
    loadLayout: "Load Layout",
    saveLayout: "Save Layout",
    clear: "Clear",
    help: "Help",
    focusCenter: "Center View",
    all: "All",
    land: "Land",
    air: "Air",
    sea: "Sea",
    orbital: "Orbital",
    commander: "Cmd",
    bldgs: "Buildings",
    units: "Mobile",
    combat: "Combat",
    factories: "Factories",
    spawnBuildable: "Spawn",
    hp: "HP",
    cost: "Cost",
    dps: "DPS",
    range: "Range",
    groupSim: "Group Battle",
    alphaTeam: "Team Alpha",
    betaTeam: "Team Beta",
    combatAnalysis: "Combat Analysis",
    duration: "Duration",
    battleEventsLog: "Battle Events Log",
    helpTitle: "Canvas Instructions",
    help1: "Drag & Drop: Drag units from the sidebar onto the canvas to place them.",
    help2: "Grid & Snap: Toggle grid lines and grid snapping in the control bar.",
    help3: "Connections: Drag links from card ports to compare cards 1v1, or connect Group Areas!",
    help4: "Group Area: Right-click the canvas and select 'Create Group Area'. Drag any unit cards inside the dashed box. Drag connection lines between Group Areas (or single cards) to simulate mass group combat!",
    help5: "Area Selection: Hold Shift and drag on the canvas to select multiple cards, then move them together.",
    grid: "Grid",
    snap: "Snap",
    team: "Team",
    overlapping: "Overlapping!",
    deleteConn: "Delete Connection",
    noSurvivors: "No survivors on either side.",
    createArea: "Create Group Area",
    deleteArea: "Delete Area",
    renameArea: "Rename Area",
    clearArea: "Delete Units Inside",
    duplicateCard: "Duplicate Unit",
    deleteCard: "Delete Unit",
    clearConn: "Clear Connections",
    selection: "Selected Units",
    duplicateSelected: "Duplicate Selection",
    deleteSelected: "Delete Selection",
    groupSelected: "Group into Area",
    showSidebar: "Show Sidebar",
    hideSidebar: "Hide Sidebar",
    bringToFront: "Bring to Front",
    sendToBack: "Send to Back",
    recalculateBattle: "Recalculate Battle"
  },
  ru: {
    logoSub: "Холст сравнения юнитов",
    searchPlaceholder: "Поиск юнитов и зданий...",
    dragToCanvas: "Перетащите на холст",
    loadLayout: "Загрузить",
    saveLayout: "Сохранить",
    clear: "Очистить",
    help: "Справка",
    focusCenter: "В центр",
    all: "Все",
    land: "Наземные",
    air: "Воздушные",
    sea: "Морские",
    orbital: "Орбита",
    commander: "Ком.",
    bldgs: "Здания",
    units: "Мобильные",
    combat: "Боевые",
    factories: "Заводы",
    spawnBuildable: "Создать",
    hp: "ОЗ",
    cost: "Металл",
    dps: "УВС",
    range: "Дальность",
    groupSim: "Групповой бой",
    alphaTeam: "Команда Альфа",
    betaTeam: "Команда Бета",
    combatAnalysis: "Анализ боя",
    duration: "Время",
    battleEventsLog: "Журнал событий боя",
    helpTitle: "Инструкция к холсту",
    help1: "Перетаскивание: Перетащите юнита из левой панели на холст.",
    help2: "Сетка и привязка: Включите сетку и привязку в панели управления.",
    help3: "Связи: Перетащите линию от порта карты к другой для дуэли 1 на 1.",
    help4: "Групповой бой: Нажмите правой кнопкой мыши по холсту -> 'Создать область группового боя'. Перетащите карты юнитов внутрь рамки. Соединяйте области линиями для проведения массовых сражений!",
    help5: "Выбор областью: Зажмите Shift и выделите рамкой несколько карт для перемещения.",
    grid: "Сетка",
    snap: "Привязка",
    team: "Команда",
    overlapping: "Элементы накладываются!",
    deleteConn: "Удалить связь",
    noSurvivors: "Выживших нет ни с одной стороны.",
    createArea: "Создать область группового боя",
    deleteArea: "Удалить область",
    renameArea: "Переименовать область",
    clearArea: "Удалить юниты внутри",
    duplicateCard: "Дублировать",
    deleteCard: "Удалить",
    clearConn: "Очистить связи",
    selection: "Выбранные юниты",
    duplicateSelected: "Дублировать выделенное",
    deleteSelected: "Удалить выделенное",
    groupSelected: "Объединить в область",
    showSidebar: "Показать панель",
    hideSidebar: "Скрыть панель",
    bringToFront: "На передний план",
    sendToBack: "На задний план",
    recalculateBattle: "Пересчитать бой"
  }
};

const t = (key) => {
  return translations[lang.value][key] || key;
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
  return units.value.filter(u => {
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
    
    return matchesSearch && matchesCategory && matchesSub;
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
  placedUnit.count = Math.max(1, placedUnit.count + amount);
  saveToLocalStorage();
};

const updateCount = (placedUnit, e) => {
  const val = parseInt(e.target.value);
  placedUnit.count = isNaN(val) ? 1 : Math.max(1, val);
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
        toUuid
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
    snapToGrid: snapToGrid.value
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
    } catch (e) {
      console.error("Failed to load layout from local storage:", e);
    }
  }
};

// Remove connection port link
const removeConnection = (uuid) => {
  connections.value = connections.value.filter(c => c.uuid !== uuid);
  saveToLocalStorage();
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
    uuid: conn.uuid
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
  const conn = activeConnections.value.find(c => c.fromUuid === area.uuid || c.toUuid === area.uuid);
  if (conn && conn.simResult) {
    openSimModal(conn.simResult);
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
      count: node.count
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
        count: placed.count
      };
    }).filter(x => x.unitId !== undefined);
  }
  return [];
};

// Dynamic battle simulator running mass group or card combat
const runBattleSimulation = (nodeA, nodeB) => {
  const listA = getCombatants(nodeA);
  const listB = getCombatants(nodeB);
  
  if (listA.length === 0 || listB.length === 0) return null;
  
  let aList = [];
  listA.forEach(stack => {
    const spec = getUnitById(stack.unitId);
    for (let i = 0; i < stack.count; i++) {
      aList.push({
        id: stack.uuid + '_' + i,
        name: stack.name,
        icon: stack.icon,
        hp: stack.health,
        maxHp: stack.health,
        cost: stack.cost,
        weapons: spec?.weapons || [],
        layers: spec?.layers || ['WL_LandHorizontal']
      });
    }
  });
  
  let bList = [];
  listB.forEach(stack => {
    const spec = getUnitById(stack.unitId);
    for (let i = 0; i < stack.count; i++) {
      bList.push({
        id: stack.uuid + '_' + i,
        name: stack.name,
        icon: stack.icon,
        hp: stack.health,
        maxHp: stack.health,
        cost: stack.cost,
        weapons: spec?.weapons || [],
        layers: spec?.layers || ['WL_LandHorizontal']
      });
    }
  });
  
  if (aList.length === 0 || bList.length === 0) return null;
  
  // Sort by cost/range to determine combat positioning
  aList.sort((x, y) => {
    const xMaxRange = x.weapons.length > 0 ? Math.max(...x.weapons.map(w => w.range)) : 0;
    const yMaxRange = y.weapons.length > 0 ? Math.max(...y.weapons.map(w => w.range)) : 0;
    return xMaxRange - yMaxRange;
  });
  bList.sort((x, y) => {
    const xMaxRange = x.weapons.length > 0 ? Math.max(...x.weapons.map(w => w.range)) : 0;
    const yMaxRange = y.weapons.length > 0 ? Math.max(...y.weapons.map(w => w.range)) : 0;
    return xMaxRange - yMaxRange;
  });
  
  const totalCostA = aList.reduce((sum, u) => sum + u.cost, 0);
  const totalCostB = bList.reduce((sum, u) => sum + u.cost, 0);
  
  const totalMaxHpA = aList.reduce((sum, u) => sum + u.maxHp, 0);
  const totalMaxHpB = bList.reduce((sum, u) => sum + u.maxHp, 0);
  
  let time = 0;
  let log = [];
  
  const nameA = nodeA.type === 'area' ? nodeA.name : `${nodeA.count}x ${listA[0].name}`;
  const nameB = nodeB.type === 'area' ? nodeB.name : `${nodeB.count}x ${listB[0].name}`;
  
  log.push({
    time: 0,
    type: 'start',
    event: lang.value === 'ru'
      ? `Начало сражения: ${nameA} (Металл: ${totalCostA}, Здоровье: ${totalMaxHpA}) против ${nameB} (Металл: ${totalCostB}, Здоровье: ${totalMaxHpB})`
      : `Combat Initiated: ${nameA} (Cost: ${totalCostA}, HP: ${totalMaxHpA}) vs ${nameB} (Cost: ${totalCostB}, HP: ${totalMaxHpB})`
  });
  
  const tick = 0.1;
  while (aList.length > 0 && bList.length > 0 && time < 120) {
    // 1. Team A fires at Team B
    let deadB = [];
    aList.forEach(attacker => {
      const weapons = attacker.weapons && attacker.weapons.length > 0 
        ? attacker.weapons 
        : [{ dps: 10, range: 100, target_layers: ['WL_LandHorizontal', 'WL_WaterSurface'] }];
        
      weapons.forEach(wpn => {
        if (wpn.dps <= 0) return;
        
        // Find front-most target that is in target_layers
        const target = bList.find(t => t.hp > 0 && t.layers && t.layers.some(l => wpn.target_layers.includes(l)));
        if (target) {
          target.hp -= wpn.dps * tick;
          if (target.hp <= 0 && !deadB.includes(target)) {
            deadB.push(target);
          }
        }
      });
    });

    // 2. Team B fires at Team A
    let deadA = [];
    bList.forEach(attacker => {
      const weapons = attacker.weapons && attacker.weapons.length > 0 
        ? attacker.weapons 
        : [{ dps: 10, range: 100, target_layers: ['WL_LandHorizontal', 'WL_WaterSurface'] }];
        
      weapons.forEach(wpn => {
        if (wpn.dps <= 0) return;
        
        // Find front-most target that is in target_layers
        const target = aList.find(t => t.hp > 0 && t.layers && t.layers.some(l => wpn.target_layers.includes(l)));
        if (target) {
          target.hp -= wpn.dps * tick;
          if (target.hp <= 0 && !deadA.includes(target)) {
            deadA.push(target);
          }
        }
      });
    });

    // 3. Process deaths and log
    deadB.forEach(dead => {
      log.push({
        time: Number(time.toFixed(1)),
        type: 'death',
        unitName: dead.name,
        icon: dead.icon,
        teamName: nameB,
        event: lang.value === 'ru'
          ? `силы [${nameB}] уничтожен!`
          : `of [${nameB}] destroyed!`
      });
    });
    
    deadA.forEach(dead => {
      log.push({
        time: Number(time.toFixed(1)),
        type: 'death',
        unitName: dead.name,
        icon: dead.icon,
        teamName: nameA,
        event: lang.value === 'ru'
          ? `силы [${nameA}] уничтожен!`
          : `of [${nameA}] destroyed!`
      });
    });

    // Filter out the dead units
    bList = bList.filter(t => t.hp > 0);
    aList = aList.filter(t => t.hp > 0);
    
    time += tick;
  }
  
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
      event: lang.value === 'ru'
        ? `🏆 Сражение завершено. ${nameA} одержал победу! Выжило: ${remainingCount} шт. (${remainingHpPercent}% здоровья).`
        : `🏆 Battle concluded. ${nameA} is victorious! Survivors: ${remainingCount} (${remainingHpPercent}% HP).`
    });
  } else if (bList.length > 0 && aList.length === 0) {
    winner = 'B';
    remainingCount = bList.length;
    remainingHpPercent = Math.round((currentHpB / totalMaxHpB) * 100);
    resultText = lang.value === 'ru' ? `${nameB} победил!` : `${nameB} Wins!`;
    log.push({
      time: Number(time.toFixed(1)),
      event: lang.value === 'ru'
        ? `🏆 Сражение завершено. ${nameB} одержал победу! Выжило: ${remainingCount} шт. (${remainingHpPercent}% здоровья).`
        : `🏆 Battle concluded. ${nameB} is victorious! Survivors: ${remainingCount} (${remainingHpPercent}% HP).`
    });
  } else {
    winner = 'Draw';
    resultText = lang.value === 'ru' ? 'Ничья / Взаимное уничтожение' : 'Draw / Mutual Annihilation';
    log.push({
      time: Number(time.toFixed(1)),
      event: lang.value === 'ru'
        ? `💀 Сражение завершено вничью. Все юниты с обеих сторон уничтожены.`
        : `💀 Battle finished in a draw. All units destroyed.`
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
    log
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
    
    // Run simulation
    const simResult = runBattleSimulation(nodeA, nodeB);
    
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

// Lifecycle
onMounted(() => {
  loadFromLocalStorage();
  window.addEventListener('click', closeContextMenu);
  window.addEventListener('keydown', handleKeyDown);
});

watch([placedUnits, groupAreas, connections], () => {
  saveToLocalStorage();
}, { deep: true });

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
            <div class="sidebar-unit-name">{{ unit.name }}</div>
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
      <div class="controls-bar">
        <!-- Grid and Snap switches -->
        <div style="display: flex; align-items: center; gap: 12px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-dim); padding: 4px 12px; border-radius: 3px; font-family: var(--font-title); font-size: 0.7rem; text-transform: uppercase; color: var(--text-secondary);">
          <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none;">
            <input type="checkbox" v-model="gridEnabled" style="cursor: pointer;" />
            <span>{{ t('grid') }}</span>
          </label>
          <div style="width: 1px; height: 12px; background: var(--border-dim);"></div>
          <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none;">
            <input type="checkbox" v-model="snapToGrid" style="cursor: pointer;" />
            <span>{{ t('snap') }}</span>
          </label>
        </div>

        <button class="btn btn-secondary" @click="goToCenter">
          <Crosshair :size="14" />
          {{ t('focusCenter') }}
        </button>
        <button class="btn btn-secondary" @click="triggerFileInput">
          <FolderOpen :size="14" />
          {{ t('loadLayout') }}
        </button>
        <button class="btn btn-secondary" @click="saveToFile">
          <Save :size="14" />
          {{ t('saveLayout') }}
        </button>
        <button class="btn btn-danger" @click="clearBoard">
          <RefreshCw :size="14" />
          {{ t('clear') }}
        </button>
        <button class="btn" style="border-color: var(--border-dim); color: #fff; background: rgba(255,255,255,0.05);" @click="showHelpModal = true">
          <Info :size="14" />
          {{ t('help') }}
        </button>
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
            @click="openSimModal(conn.simResult)"
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
              <img :src="getUnitById(placed.unitId)?.icon" class="unit-card-icon" />
              <div class="unit-card-title">{{ getUnitById(placed.unitId)?.name }}</div>
              
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
                <span class="stat-value">{{ getUnitById(placed.unitId)?.health }}</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">{{ t('cost') }}:</span>
                <span class="stat-value" style="color: var(--color-orange);">{{ (getUnitById(placed.unitId)?.cost * placed.count).toLocaleString() }} M</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">{{ t('dps') }}:</span>
                <span class="stat-value">{{ getUnitById(placed.unitId)?.dps * placed.count }}</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">{{ t('range') }}:</span>
                <span class="stat-value">{{ getUnitById(placed.unitId)?.range }}</span>
              </div>
              
              <!-- Quantity Controller -->
              <div class="qty-controller">
                <button class="qty-btn" @click="adjustCount(placed, -1)" @mousedown.stop>&minus;</button>
                <input 
                  type="number" 
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

    <!-- Battle Simulation Modal -->
    <div v-if="activeBattleSimulation" class="modal-overlay" @click="activeBattleSimulation = null">
      <div class="modal-content" @click.stop>
        
        <div class="modal-header">
          <h3 class="modal-title">{{ t('combatAnalysis') }}</h3>
          <button class="close-btn" @click="activeBattleSimulation = null">
            <X :size="18" />
          </button>
        </div>
        
        <div class="modal-body">
          
          <div class="battle-sim-grid">
            
            <!-- Side A -->
            <div :class="['sim-side', { 'side-winner': activeBattleSimulation.winner === 'A', 'side-loser': activeBattleSimulation.winner === 'B' }]">
              <div class="sim-side-title">{{ activeBattleSimulation.winner === 'A' ? 'Winner' : 'Loser' }}</div>
              <img :src="activeBattleSimulation.a.icon" class="sim-unit-img" />
              <div class="sim-unit-name">{{ activeBattleSimulation.a.name }}</div>
              <div class="sim-unit-count">{{ activeBattleSimulation.a.count }} {{ lang === 'ru' ? 'шт.' : 'Units' }}</div>
              
              <div class="sim-stats-container">
                <div class="sim-stat-box" style="border-color: var(--color-green);">
                  <div class="sim-stat-val">{{ activeBattleSimulation.a.hpLeft.toLocaleString() }}</div>
                  <div class="sim-stat-lbl">HP Left</div>
                </div>
                <div class="sim-stat-box" style="border-color: var(--color-orange);">
                  <div class="sim-stat-val">{{ activeBattleSimulation.a.cost.toLocaleString() }}</div>
                  <div class="sim-stat-lbl">Metal Cost</div>
                </div>
              </div>

              <!-- Detailed Units List (Group Battle analysis) -->
              <div 
                v-if="activeBattleSimulation.a.detailedUnits && activeBattleSimulation.a.detailedUnits.length > 0"
                class="sim-detailed-list" 
                style="margin-top: 15px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 12px; text-align: left; max-height: 180px; overflow-y: auto;"
              >
                <div 
                  v-for="u in activeBattleSimulation.a.detailedUnits" 
                  :key="u.name" 
                  style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; background: rgba(255,255,255,0.02); padding: 4px 8px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.04);"
                >
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <img :src="u.icon" style="width: 20px; height: 20px; object-fit: contain; background: transparent; border-radius: 2px;" />
                    <span style="font-size: 0.7rem; font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px;" :title="u.name">{{ u.name }}</span>
                  </div>
                  <div style="font-family: var(--font-title); font-size: 0.65rem; font-weight: bold; color: var(--text-secondary);">
                    <span :style="{ color: u.survivedCount > 0 ? 'var(--color-green)' : 'var(--color-red)' }">{{ u.survivedCount }}</span> / <span>{{ u.initialCount }}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Mid VS details -->
            <div>
              <div class="sim-vs-circle">
                <Sword :size="24" class="sim-vs-icon" />
              </div>
              <div class="sim-duration">
                {{ t('duration') }}<br>
                <strong>{{ activeBattleSimulation.time }}s</strong>
              </div>
            </div>
            
            <!-- Side B -->
            <div :class="['sim-side', { 'side-winner': activeBattleSimulation.winner === 'B', 'side-loser': activeBattleSimulation.winner === 'A' }]">
              <div class="sim-side-title">{{ activeBattleSimulation.winner === 'B' ? 'Winner' : 'Loser' }}</div>
              <img :src="activeBattleSimulation.b.icon" class="sim-unit-img" />
              <div class="sim-unit-name">{{ activeBattleSimulation.b.name }}</div>
              <div class="sim-unit-count">{{ activeBattleSimulation.b.count }} {{ lang === 'ru' ? 'шт.' : 'Units' }}</div>
              
              <div class="sim-stats-container">
                <div class="sim-stat-box" style="border-color: var(--color-green);">
                  <div class="sim-stat-val">{{ activeBattleSimulation.b.hpLeft.toLocaleString() }}</div>
                  <div class="sim-stat-lbl">HP Left</div>
                </div>
                <div class="sim-stat-box" style="border-color: var(--color-orange);">
                  <div class="sim-stat-val">{{ activeBattleSimulation.b.cost.toLocaleString() }}</div>
                  <div class="sim-stat-lbl">Metal Cost</div>
                </div>
              </div>

              <!-- Detailed Units List (Group Battle analysis) -->
              <div 
                v-if="activeBattleSimulation.b.detailedUnits && activeBattleSimulation.b.detailedUnits.length > 0"
                class="sim-detailed-list" 
                style="margin-top: 15px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 12px; text-align: left; max-height: 180px; overflow-y: auto;"
              >
                <div 
                  v-for="u in activeBattleSimulation.b.detailedUnits" 
                  :key="u.name" 
                  style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; background: rgba(255,255,255,0.02); padding: 4px 8px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.04);"
                >
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <img :src="u.icon" style="width: 20px; height: 20px; object-fit: contain; background: transparent; border-radius: 2px;" />
                    <span style="font-size: 0.7rem; font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px;" :title="u.name">{{ u.name }}</span>
                  </div>
                  <div style="font-family: var(--font-title); font-size: 0.65rem; font-weight: bold; color: var(--text-secondary);">
                    <span :style="{ color: u.survivedCount > 0 ? 'var(--color-green)' : 'var(--color-red)' }">{{ u.survivedCount }}</span> / <span>{{ u.initialCount }}</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          <!-- Battle Result Header Banner -->
          <div 
            style="text-align: center; padding: 12px; border-radius: 6px; margin-bottom: 24px; font-family: var(--font-title); font-size: 1rem; font-weight: bold; border: 1px solid;"
            :style="{
              backgroundColor: activeBattleSimulation.winner === 'Draw' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.05)',
              borderColor: activeBattleSimulation.winner === 'Draw' ? 'var(--color-red)' : 'var(--color-green)',
              color: activeBattleSimulation.winner === 'Draw' ? 'var(--color-red)' : 'var(--color-green)'
            }"
          >
            {{ activeBattleSimulation.resultText }} 
            <span v-if="activeBattleSimulation.winner !== 'Draw'">
              ({{ activeBattleSimulation.remainingHpPercent }}% {{ t('hpPercentRemaining') }})
            </span>
          </div>
          
          <!-- Tick-by-tick logs -->
          <h4 class="battle-logs-title">{{ t('battleEventsLog') }}</h4>
          <div class="battle-logs-list">
            <div v-for="(entry, index) in activeBattleSimulation.log" :key="index" class="log-entry" style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <span class="log-time" style="white-space: nowrap;">[{{ entry.time.toFixed(1) }}s]</span>
              
              <!-- Unit death format: render icon and bold name -->
              <span v-if="entry.type === 'death'" style="display: inline-flex; align-items: center; gap: 6px;">
                <span>💥</span>
                <img :src="entry.icon" style="width: 16px; height: 16px; object-fit: contain; background: transparent; display: inline-block; vertical-align: middle; border-radius: 2px;" />
                <strong style="color: #fff; font-size: 0.72rem; white-space: nowrap;">{{ entry.unitName }}</strong>
                <span class="log-msg">{{ entry.event }}</span>
              </span>
              
              <!-- Standard info format -->
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

  </div>
</template>

<style>
/* Root styles and animations are defined in style.css */
</style>
