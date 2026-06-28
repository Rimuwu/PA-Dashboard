import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runBattleSimulation } from '../src/utils/battleSimulation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const unitsPath = path.join(__dirname, '../src/data/units.json');
const unitsData = JSON.parse(fs.readFileSync(unitsPath, 'utf8'));

const getUnitById = (id) => {
  return unitsData.find(u => u.id === id);
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

const normalizeLayer = (l) => {
  if (!l) return '';
  const str = String(l).toLowerCase();
  if (str.includes('orbital')) return 'orbital';
  if (str.includes('air')) return 'air';
  if (str.includes('underwater') || str.includes('seafloor')) return 'seafloor';
  if (str.includes('anysurface') || str.includes('anyhorizontalgroundorwatersurface')) return 'anysurface';
  if (str.includes('land') || str.includes('ground') || str.includes('surface')) return 'land';
  if (str.includes('water') || str.includes('sea')) return 'sea';
  return str.replace('wl_', '').replace('horizontal', '');
};

const canTargetLayer = (wpnTargetLayers, unitLayers) => {
  if (!wpnTargetLayers || wpnTargetLayers.length === 0) return true;
  if (!unitLayers || unitLayers.length === 0) return true;
  const normalizedUnitLayers = unitLayers.map(normalizeLayer);
  return wpnTargetLayers.some(wpnL => {
    const normWpn = normalizeLayer(wpnL);
    if (normWpn === 'anysurface') {
      return normalizedUnitLayers.includes('land') || normalizedUnitLayers.includes('sea');
    }
    return normalizedUnitLayers.includes(normWpn);
  });
};

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
    const sim = runBattleSimulation(node, testNode, null, fastSettings, 'en', getUnitById, getCombatants);
    if (sim && sim.winner === 'B') {
      bestCount = mid;
      bestSim = sim;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }
  return bestCount !== -1 ? { count: bestCount, sim: bestSim } : { count: maxSearchLimit, sim: null };
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
  
  const combatUnits = unitsData.filter(unit => {
    const isMobile = unit.unit_types?.includes('UNITTYPE_Mobile');
    const isStructure = unit.unit_types?.includes('UNITTYPE_Structure');
    const isCmd = unit.category === 'commander' || unit.id.includes('commander');
    const hasWeapon = unit.weapons && unit.weapons.length > 0;
    return isMobile && !isStructure && !isCmd && hasWeapon && unit.cost > 0;
  });
  
  const total = combatUnits.length;
  console.log(`Starting pregeneration of complete tables for ${total} units...`);
  
  combatUnits.forEach((unit, idx) => {
    const node = { uuid: 'mock-a', type: 'unit', unitId: unit.id, count: 1 };
    
    // Only include candidates that can target at least one of our combatants
    const filteredCandidates = candidates.filter(cand => 
      cand.id !== unit.id && cand.weapons.some(wpn => 
        canTargetLayer(wpn.target_layers, unit.layers || ['WL_LandHorizontal'])
      )
    );
    
    const ratings = [];
    let bestCounterId = null;
    let bestScore = -Infinity;
    
    filteredCandidates.forEach(candidate => {
      const { count: minCount, sim } = findMinWinningCount(node, candidate.id);
      
      let score = 0;
      let resultLabel = '';
      let resultClass = '';
      
      if (sim && sim.winner === 'B') {
        const totalCostSpent = minCount * candidate.cost;
        const costRatio = unit.cost / (totalCostSpent || 1);
        score += 1000 + costRatio * 500 + sim.remainingHpPercent * 2;
        resultLabel = `Wins (${sim.remainingHpPercent}% HP)`;
        resultClass = 'text-green';
      } else {
        score -= 2000;
        resultLabel = 'Cannot win';
        resultClass = 'text-red';
      }
      
      if ((candidate.dps || 0) > (unit.dps || 0)) score += 100;
      if (candidate.cost < unit.cost / (minCount || 1)) score += 100;
      
      ratings.push({
        unitId: candidate.id,
        name: candidate.name,
        icon: candidate.icon,
        cost: candidate.cost,
        dps: candidate.dps || 0,
        spawnCount: minCount,
        resultLabel,
        resultClass,
        score: Math.round(score)
      });
      
      if (score > bestScore) {
        bestScore = score;
        bestCounterId = candidate.id;
      }
    });
    
    ratings.sort((a, b) => b.score - a.score);
    
    resultCache[unit.id] = {
      bestCounterId,
      ratings
    };
    
    const pct = Math.round(((idx + 1) / total) * 100);
    const progressBar = '='.repeat(Math.floor(pct / 5)) + ' '.repeat(20 - Math.floor(pct / 5));
    process.stdout.write(`\r\x1b[KProgress: [${progressBar}] ${pct}% (${idx + 1}/${total}) - ${unit.name}`);
  });
  
  console.log('\nFinished pregeneration!');
  
  const outputPath = path.join(__dirname, '../src/data/hardest_counters.json');
  fs.writeFileSync(outputPath, JSON.stringify(resultCache, null, 2), 'utf8');
  console.log(`Saved pregenerated hardest counters database to ${outputPath}`);
};

pregenerateAll();
