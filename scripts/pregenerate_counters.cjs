const fs = require('fs');
const path = require('path');

const unitsPath = path.join(__dirname, '../src/data/units.json');
const unitsData = JSON.parse(fs.readFileSync(unitsPath, 'utf8'));

const getUnitById = (id) => {
  return unitsData.find(u => u.id === id);
};

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
  }
  return [];
};

const runBattleSimulation = (nodeA, nodeB) => {
  const listA = getCombatants(nodeA);
  const listB = getCombatants(nodeB);
  
  if (listA.length === 0 || listB.length === 0) return null;
  
  const initialDistance = 300;
  
  let aList = [];
  listA.forEach((stack, stackIdx) => {
    const spec = getUnitById(stack.unitId);
    const defaultX = -initialDistance / 2 - stackIdx * 25;
    const defaultY = (stackIdx - Math.floor(listA.length / 2)) * 20;
    
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
        x: defaultX - i * 8,
        y: defaultY + (i % 3 - 1) * 10,
        firingAt: null,
        maxRange,
        visionRadius: spec?.vision_radius || 0,
        radarRadius: spec?.radar_radius || 0
      });
    }
  });
  
  let bList = [];
  listB.forEach((stack, stackIdx) => {
    const spec = getUnitById(stack.unitId);
    const defaultX = initialDistance / 2 + stackIdx * 25;
    const defaultY = (stackIdx - Math.floor(listB.length / 2)) * 20;
    
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
        x: defaultX + i * 8,
        y: defaultY + (i % 3 - 1) * 10,
        firingAt: null,
        maxRange,
        visionRadius: spec?.vision_radius || 0,
        radarRadius: spec?.radar_radius || 0
      });
    }
  });
  
  if (aList.length === 0 || bList.length === 0) return null;

  // Short circuit if neither side can hit the other
  const canAAttackB = aList.some(attacker => 
    attacker.weapons?.some(wpn => 
      bList.some(target => canTargetLayer(wpn.target_layers, target.layers))
    )
  );
  const canBAttackA = bList.some(attacker => 
    attacker.weapons?.some(wpn => 
      aList.some(target => canTargetLayer(wpn.target_layers, target.layers))
    )
  );
  if (!canAAttackB && !canBAttackA) {
    return { winner: 'Draw', remainingHpPercent: 0 };
  }
  
  const totalMaxHpA = aList.reduce((sum, u) => sum + u.maxHp, 0);
  const totalMaxHpB = bList.reduce((sum, u) => sum + u.maxHp, 0);
  
  let time = 0;
  const tick = 0.1;
  const maxSimTime = 120;
  
  while (aList.length > 0 && bList.length > 0 && time < maxSimTime) {
    aList.forEach(u => u.firingAt = null);
    bList.forEach(u => u.firingAt = null);
    
    aList.forEach(attacker => {
      if (attacker.hp <= 0) return;
      const weapons = attacker.weapons?.length > 0 ? attacker.weapons : [{ name: 'Default Gun', dps: 10, range: 100, target_layers: ['WL_LandHorizontal', 'WL_WaterSurface'] }];
      let fired = false;
      weapons.forEach(wpn => {
        if (wpn.dps <= 0) return;
        const targets = bList.filter(t => t.hp > 0 && canTargetLayer(wpn.target_layers, t.layers));
        if (targets.length > 0) {
          targets.sort((x, y) => {
            const dA = Math.hypot(attacker.x - x.x, attacker.y - x.y);
            const dB = Math.hypot(attacker.x - y.x, attacker.y - y.y);
            return dA - dB;
          });
          const target = targets[0];
          const dist2d = Math.hypot(attacker.x - target.x, attacker.y - target.y);
          if (dist2d <= wpn.range) {
            fired = true;
            attacker.firingAt = target.id;
            target.hp -= wpn.dps * tick;
          }
        }
      });
      if (!fired && attacker.move_speed > 0) {
        const enemies = bList.filter(e => e.hp > 0);
        if (enemies.length > 0) {
          enemies.sort((x, y) => {
            const dA = Math.hypot(attacker.x - x.x, attacker.y - x.y);
            const dB = Math.hypot(attacker.x - y.x, attacker.y - y.y);
            return dA - dB;
          });
          const closest = enemies[0];
          const dx = closest.x - attacker.x;
          const dir = Math.sign(dx);
          attacker.x += dir * attacker.move_speed * tick;
        }
      }
    });
    
    bList.forEach(attacker => {
      if (attacker.hp <= 0) return;
      const weapons = attacker.weapons?.length > 0 ? attacker.weapons : [{ name: 'Default Gun', dps: 10, range: 100, target_layers: ['WL_LandHorizontal', 'WL_WaterSurface'] }];
      let fired = false;
      weapons.forEach(wpn => {
        if (wpn.dps <= 0) return;
        const targets = aList.filter(t => t.hp > 0 && canTargetLayer(wpn.target_layers, t.layers));
        if (targets.length > 0) {
          targets.sort((x, y) => {
            const dA = Math.hypot(attacker.x - x.x, attacker.y - x.y);
            const dB = Math.hypot(attacker.x - y.x, attacker.y - y.y);
            return dA - dB;
          });
          const target = targets[0];
          const dist2d = Math.hypot(attacker.x - target.x, attacker.y - target.y);
          if (dist2d <= wpn.range) {
            fired = true;
            attacker.firingAt = target.id;
            target.hp -= wpn.dps * tick;
          }
        }
      });
      if (!fired && attacker.move_speed > 0) {
        const enemies = aList.filter(e => e.hp > 0);
        if (enemies.length > 0) {
          enemies.sort((x, y) => {
            const dA = Math.hypot(attacker.x - x.x, attacker.y - x.y);
            const dB = Math.hypot(attacker.x - y.x, attacker.y - y.y);
            return dA - dB;
          });
          const closest = enemies[0];
          const dx = closest.x - attacker.x;
          const dir = Math.sign(dx);
          attacker.x += dir * attacker.move_speed * tick;
        }
      }
    });
    
    bList = bList.filter(t => t.hp > 0);
    aList = aList.filter(t => t.hp > 0);
    time += tick;
  }
  
  let winner = null;
  let remainingHpPercent = 0;
  const currentHpA = aList.reduce((sum, u) => sum + u.hp, 0);
  const currentHpB = bList.reduce((sum, u) => sum + u.hp, 0);
  
  if (aList.length > 0 && bList.length === 0) {
    winner = 'A';
    remainingHpPercent = Math.round((currentHpA / totalMaxHpA) * 100);
  } else if (bList.length > 0 && aList.length === 0) {
    winner = 'B';
    remainingHpPercent = Math.round((currentHpB / totalMaxHpB) * 100);
  } else {
    winner = 'Draw';
  }
  
  return { winner, remainingHpPercent };
};

const pregenerateAll = () => {
  const resultCache = {};
  
  const candidates = unitsData.filter(u => {
    const isMobile = u.unit_types?.includes('UNITTYPE_Mobile');
    const isStructure = u.unit_types?.includes('UNITTYPE_Structure');
    const isCmd = u.category === 'commander' || u.id.includes('commander');
    const hasWeapon = u.weapons && u.weapons.length > 0;
    return isMobile && !isStructure && !isCmd && hasWeapon && u.cost > 0;
  });
  
  console.log(`Starting pregeneration for ${unitsData.length} units with ${candidates.length} candidates...`);
  
  unitsData.forEach((unit, idx) => {
    const isMobile = unit.unit_types?.includes('UNITTYPE_Mobile');
    const isStructure = unit.unit_types?.includes('UNITTYPE_Structure');
    const isCmd = unit.category === 'commander' || unit.id.includes('commander');
    const hasWeapon = unit.weapons && unit.weapons.length > 0;
    if (!isMobile || isStructure || isCmd || !hasWeapon || unit.cost <= 0) return;
    
    let bestCandidate = null;
    let bestScore = Infinity;
    
    const mockNodeA = { uuid: 'mock-a', type: 'unit', unitId: unit.id, count: 1 };
    
    candidates.forEach(candidate => {
      const count = Math.max(1, Math.round(unit.cost / candidate.cost));
      const mockNodeB = { uuid: 'mock-b', type: 'unit', unitId: candidate.id, count };
      
      const sim = runBattleSimulation(mockNodeA, mockNodeB);
      if (!sim) return;
      
      let score = 0;
      if (sim.winner === 'A') {
        score = sim.remainingHpPercent;
      } else if (sim.winner === 'B') {
        score = -sim.remainingHpPercent;
      } else {
        score = 0;
      }
      
      if (score < bestScore) {
        bestScore = score;
        bestCandidate = candidate.id;
      }
    });
    
    if (bestCandidate) {
      resultCache[unit.id] = bestCandidate;
    }
  });
  
  const outputPath = path.join(__dirname, '../src/data/hardest_counters.json');
  fs.writeFileSync(outputPath, JSON.stringify(resultCache, null, 2), 'utf8');
  console.log(`Saved pregenerated hardest counters to ${outputPath}`);
};

pregenerateAll();
