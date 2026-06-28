// Helper to normalize layer names across different PA spec versions
export const normalizeLayer = (l) => {
  if (!l) return '';
  const str = String(l).toLowerCase().replace('wl_', '').replace('horizontal', '');
  if (str.includes('orbital')) return 'orbital';
  if (str.includes('air')) return 'air';
  if (str.includes('land') || str.includes('ground') || str.includes('surface')) return 'land';
  if (str.includes('water') || (str.includes('sea') && !str.includes('seafloor'))) return 'sea';
  if (str.includes('seafloor') || str.includes('underwater')) return 'seafloor';
  return str;
};

export const canTargetLayer = (wpnTargetLayers, unitLayers) => {
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

export const getVictoryEaseDetails = (hpPercent, langVal) => {
  if (hpPercent >= 80) {
    return {
      text: langVal === 'ru' ? 'Триумфальная победа' : 'Decisive Victory',
      color: 'var(--color-green)'
    };
  } else if (hpPercent >= 50) {
    return {
      text: langVal === 'ru' ? 'Уверенная победа' : 'Solid Victory',
      color: 'var(--color-green)'
    };
  } else if (hpPercent >= 20) {
    return {
      text: langVal === 'ru' ? 'Трудная победа' : 'Close Victory',
      color: 'var(--color-orange)'
    };
  } else {
    return {
      text: langVal === 'ru' ? 'Пиррова победа' : 'Pyrrhic Victory',
      color: 'var(--color-red)'
    };
  }
};

// Dynamic battle simulator running mass group or card combat
export const runBattleSimulation = (nodeA, nodeB, conn, simSettingsVal, langVal, getUnitById, getCombatants) => {
  const listA = getCombatants(nodeA);
  const listB = getCombatants(nodeB);
  
  if (listA.length === 0 || listB.length === 0) return null;
  
  const initialDistance = conn?.settings?.initialDistance || simSettingsVal?.initialDistance || 300;
  
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
        maxRange,
        visionRadius: spec?.vision_radius || 0,
        radarRadius: spec?.radar_radius || 0
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
        maxRange,
        visionRadius: spec?.vision_radius || 0,
        radarRadius: spec?.radar_radius || 0
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
  
  const fastMode = simSettingsVal?.fastMode || false;
  if (!fastMode) {
    const initialStartLog = {
      time: 0,
      type: 'start',
      event: langVal === 'ru'
        ? `Начало сражения: ${nameA} (Металл: ${totalCostA}, Здоровье: ${totalMaxHpA}) против ${nameB} (Металл: ${totalCostB}, Здоровье: ${totalMaxHpB})`
        : `Combat Initiated: ${nameA} (Cost: ${totalCostA}, HP: ${totalMaxHpA}) vs ${nameB} (Cost: ${totalCostB}, HP: ${totalMaxHpB})`
    };
    log.push(initialStartLog);
    ticks.push({
      time: 0,
      aHp: totalMaxHpA,
      bHp: totalMaxHpB,
      aUnits: aList.map(u => ({ id: u.id, name: u.name, icon: u.icon, hp: u.hp, maxHp: u.maxHp, x: u.x, y: u.y || 0, firingAt: null, maxRange: u.maxRange, visionRadius: u.visionRadius, radarRadius: u.radarRadius, weapons: u.weapons ? u.weapons.map(w => ({ name: w.name, range: w.range })) : [] })),
      bUnits: bList.map(u => ({ id: u.id, name: u.name, icon: u.icon, hp: u.hp, maxHp: u.maxHp, x: u.x, y: u.y || 0, firingAt: null, maxRange: u.maxRange, visionRadius: u.visionRadius, radarRadius: u.radarRadius, weapons: u.weapons ? u.weapons.map(w => ({ name: w.name, range: w.range })) : [] })),
      newLogs: [initialStartLog]
    });
  }
  
  const tick = 0.1;
  let maxSimTime = simSettingsVal?.maxTime || 120;
  
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
    time = maxSimTime;
  }

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
      if (fastMode) return;
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
          event: langVal === 'ru'
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

    if (!fastMode) {
      const newLogs = log.slice(logStartIdx);
      const tickIndex = Math.round(time / tick);
      if (newLogs.length > 0 || tickIndex % 5 === 0 || aList.length === 0 || bList.length === 0) {
        ticks.push({
          time: Number(time.toFixed(1)),
          aHp: aList.reduce((sum, u) => sum + u.hp, 0),
          bHp: bList.reduce((sum, u) => sum + u.hp, 0),
          aUnits: aList.map(u => ({ id: u.id, name: u.name, icon: u.icon, hp: u.hp, maxHp: u.maxHp, x: u.x, y: u.y || 0, firingAt: u.firingAt, maxRange: u.maxRange, visionRadius: u.visionRadius, radarRadius: u.radarRadius, weapons: u.weapons ? u.weapons.map(w => ({ name: w.name, range: w.range })) : [] })),
          bUnits: bList.map(u => ({ id: u.id, name: u.name, icon: u.icon, hp: u.hp, maxHp: u.maxHp, x: u.x, y: u.y || 0, firingAt: u.firingAt, maxRange: u.maxRange, visionRadius: u.visionRadius, radarRadius: u.radarRadius, weapons: u.weapons ? u.weapons.map(w => ({ name: w.name, range: w.range })) : [] })),
          newLogs
        });
      }
    }
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
    resultText = langVal === 'ru' ? `${nameA} победил!` : `${nameA} Wins!`;
    if (!fastMode) {
      log.push({
        time: Number(time.toFixed(1)),
        type: 'victory',
        event: langVal === 'ru'
          ? `Сражение завершено. ${nameA} одержал победу! Выжило: ${remainingCount} шт. (${remainingHpPercent}% здоровья).`
          : `Battle concluded. ${nameA} is victorious! Survivors: ${remainingCount} (${remainingHpPercent}% HP).`
      });
    }
  } else if (bList.length > 0 && aList.length === 0) {
    winner = 'B';
    remainingCount = bList.length;
    remainingHpPercent = Math.round((currentHpB / totalMaxHpB) * 100);
    resultText = langVal === 'ru' ? `${nameB} победил!` : `${nameB} Wins!`;
    if (!fastMode) {
      log.push({
        time: Number(time.toFixed(1)),
        type: 'victory',
        event: langVal === 'ru'
          ? `Сражение завершено. ${nameB} одержал победу! Выжило: ${remainingCount} шт. (${remainingHpPercent}% здоровья).`
          : `Battle concluded. ${nameB} is victorious! Survivors: ${remainingCount} (${remainingHpPercent}% HP).`
      });
    }
  } else {
    winner = 'Draw';
    resultText = langVal === 'ru' ? 'Ничья / Взаимное уничтожение' : 'Draw / Mutual Annihilation';
    if (!fastMode) {
      log.push({
        time: Number(time.toFixed(1)),
        type: 'draw',
        event: langVal === 'ru'
          ? `Сражение завершено вничью. Все юниты с обеих сторон уничтожены.`
          : `Battle finished in a draw. All units destroyed.`
      });
    }
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
