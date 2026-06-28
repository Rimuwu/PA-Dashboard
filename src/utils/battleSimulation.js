export const normalizeLayer = (l) => {
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

export const getLayerAltitude = (layers) => {
  if (!layers || layers.length === 0) return 0;
  let maxAlt = 0;
  layers.forEach(l => {
    const norm = normalizeLayer(l);
    let alt = 0;
    if (norm === 'orbital') alt = 450;
    else if (norm === 'air') alt = 80;
    else if (norm === 'seafloor') alt = -60;
    else if (norm === 'sea') alt = 0;
    else if (norm === 'land') alt = 0;
    if (Math.abs(alt) > Math.abs(maxAlt)) {
      maxAlt = alt;
    }
  });
  return maxAlt;
};

export const canTargetLayer = (wpnTargetLayers, unitLayers) => {
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
        weapons: spec?.weapons ? spec.weapons.map((w, wIdx) => ({
          name: w.name || `Weapon #${wIdx + 1}`,
          dps: w.dps || 0,
          damage: w.damage || 0,
          splash_damage: w.splash_damage || 0,
          splash_radius: w.splash_radius || 0,
          rate_of_fire: w.rate_of_fire || 1.0,
          range: w.range || 100,
          min_range: w.min_range || 0,
          muzzle_velocity: w.muzzle_velocity || 0,
          max_velocity: w.max_velocity || 0,
          flight_type: w.flight_type || '',
          target_layers: w.target_layers || [],
          auto_attack: w.auto_attack,
          manual_fire: w.manual_fire,
          nextFireTime: 0
        })) : [],
        layers: stack.layers,
        altitude: getLayerAltitude(stack.layers),
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
        weapons: spec?.weapons ? spec.weapons.map((w, wIdx) => ({
          name: w.name || `Weapon #${wIdx + 1}`,
          dps: w.dps || 0,
          damage: w.damage || 0,
          splash_damage: w.splash_damage || 0,
          splash_radius: w.splash_radius || 0,
          rate_of_fire: w.rate_of_fire || 1.0,
          range: w.range || 100,
          min_range: w.min_range || 0,
          muzzle_velocity: w.muzzle_velocity || 0,
          max_velocity: w.max_velocity || 0,
          flight_type: w.flight_type || '',
          target_layers: w.target_layers || [],
          auto_attack: w.auto_attack,
          manual_fire: w.manual_fire,
          nextFireTime: 0
        })) : [],
        layers: stack.layers,
        altitude: getLayerAltitude(stack.layers),
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
  let damageQueue = [];
  
  while (aList.length > 0 && bList.length > 0 && time < maxSimTime) {
    const logStartIdx = log.length;
    
    aList.forEach(u => { u.firingAt = null; u.fires = (u.fires || []).filter(f => time < f.expireTime); });
    bList.forEach(u => { u.firingAt = null; u.fires = (u.fires || []).filter(f => time < f.expireTime); });
    
    // 1. Team A actions (fire or move)
    aList.forEach(attacker => {
      if (attacker.hp <= 0) return;
      
      const rawWeapons = attacker.weapons && attacker.weapons.length > 0 
        ? attacker.weapons 
        : [{ name: 'Default Gun', dps: 10, range: 100, target_layers: ['WL_LandHorizontal', 'WL_WaterSurface'] }];
      const weapons = rawWeapons.filter(w => !w.manual_fire && w.auto_attack !== false);
      
      let fired = false;
      let shortestTargetingRange = Infinity;
      
      weapons.forEach(wpn => {
        if (wpn.dps <= 0) return;
        
        if (wpn.nextFireTime === undefined) {
          wpn.nextFireTime = 0;
        }
        if (time < wpn.nextFireTime) {
          return;
        }
        
        const targets = bList.filter(t => t.hp > 0 && canTargetLayer(wpn.target_layers, t.layers));
        if (targets.length > 0) {
          if (wpn.range < shortestTargetingRange) {
            shortestTargetingRange = wpn.range;
          }
          let target = targets[0];
          let minDist = Math.hypot(attacker.x - target.x, (attacker.y||0) - (target.y||0));
          for (let k = 1; k < targets.length; k++) {
            const t = targets[k];
            const dist = Math.hypot(attacker.x - t.x, (attacker.y||0) - (t.y||0));
            if (dist < minDist) {
              minDist = dist;
              target = t;
            }
          }
          const dist2d = minDist;
          
          if (dist2d <= wpn.range) {
            fired = true;
            
            const attackerAlt = attacker.altitude || 0;
            const targetAlt = target.altitude || 0;
            const altDiff = targetAlt - attackerAlt;
            const dist3d = Math.hypot(attacker.x - target.x, (attacker.y||0) - (target.y||0), altDiff);
            
            const isDiscrete = wpn.rate_of_fire > 0;
            const dmg = isDiscrete ? (wpn.damage || (wpn.dps / wpn.rate_of_fire)) : (wpn.dps * tick);
            
            attacker.firingAt = target.id;
            attacker.fires.push({ targetId: target.id, wpnName: wpn.name, range: wpn.range, expireTime: time + 0.3 });
            
            let flightTime = 0;
            if (wpn.muzzle_velocity && wpn.muzzle_velocity < 400) {
              flightTime = dist3d / wpn.muzzle_velocity;
              if (wpn.flight_type === 'Staged') {
                flightTime += 1.5;
              } else if (wpn.flight_type === 'Seeking') {
                flightTime += 0.5;
              }
            }
            
            damageQueue.push({
              spawnTime: time,
              applyTime: time + flightTime,
              startX: attacker.x,
              startY: attacker.y || 0,
              targetId: target.id,
              damage: dmg,
              splashDamage: wpn.splash_damage ? wpn.splash_damage : 0,
              splashRadius: wpn.splash_radius || 0,
              team: 'A'
            });
            
            wpn.nextFireTime = time + (isDiscrete ? (1.0 / wpn.rate_of_fire) : tick);
            
            const wKey = `${wpn.name}__${target.name}`;
            if (!wpnDmgAccA[wKey]) {
              wpnDmgAccA[wKey] = { wpnName: wpn.name, targetName: target.name, damage: 0, attackerName: attacker.name };
            }
            wpnDmgAccA[wKey].damage += dmg;
          }
        }
      });
      
      if (attacker.fires && attacker.fires.length > 0) {
        attacker.firingAt = attacker.fires[0].targetId;
      }
      
      let shouldMove = !fired;
      if (attacker.move_speed > 0) {
        const enemies = bList.filter(e => e.hp > 0);
        if (enemies.length > 0) {
          let closest = enemies[0];
          let minDist = Math.hypot(attacker.x - closest.x, (attacker.y||0) - (closest.y||0));
          for (let k = 1; k < enemies.length; k++) {
            const e = enemies[k];
            const dist = Math.hypot(attacker.x - e.x, (attacker.y||0) - (e.y||0));
            if (dist < minDist) {
              minDist = dist;
              closest = e;
            }
          }
          if (fired && shortestTargetingRange !== Infinity) {
            if (minDist > shortestTargetingRange) {
              shouldMove = true;
            }
          }
          if (shouldMove) {
            const dx = closest.x - attacker.x;
            const dir = Math.sign(dx);
            attacker.x += dir * attacker.move_speed * tick;
          }
        }
      }
    });
    
    // 2. Team B actions (fire or move)
    bList.forEach(attacker => {
      if (attacker.hp <= 0) return;
      
      const rawWeapons = attacker.weapons && attacker.weapons.length > 0 
        ? attacker.weapons 
        : [{ name: 'Default Gun', dps: 10, range: 100, target_layers: ['WL_LandHorizontal', 'WL_WaterSurface'] }];
      const weapons = rawWeapons.filter(w => !w.manual_fire && w.auto_attack !== false);
      
      let fired = false;
      let shortestTargetingRange = Infinity;
      
      weapons.forEach(wpn => {
        if (wpn.dps <= 0) return;
        
        if (wpn.nextFireTime === undefined) {
          wpn.nextFireTime = 0;
        }
        if (time < wpn.nextFireTime) {
          return;
        }
        
        const targets = aList.filter(t => t.hp > 0 && canTargetLayer(wpn.target_layers, t.layers));
        if (targets.length > 0) {
          if (wpn.range < shortestTargetingRange) {
            shortestTargetingRange = wpn.range;
          }
          let target = targets[0];
          let minDist = Math.hypot(attacker.x - target.x, (attacker.y||0) - (target.y||0));
          for (let k = 1; k < targets.length; k++) {
            const t = targets[k];
            const dist = Math.hypot(attacker.x - t.x, (attacker.y||0) - (t.y||0));
            if (dist < minDist) {
              minDist = dist;
              target = t;
            }
          }
          const dist2d = minDist;
          
          if (dist2d <= wpn.range) {
            fired = true;
            
            const attackerAlt = attacker.altitude || 0;
            const targetAlt = target.altitude || 0;
            const altDiff = targetAlt - attackerAlt;
            const dist3d = Math.hypot(attacker.x - target.x, (attacker.y||0) - (target.y||0), altDiff);
            
            const isDiscrete = wpn.rate_of_fire > 0;
            const dmg = isDiscrete ? (wpn.damage || (wpn.dps / wpn.rate_of_fire)) : (wpn.dps * tick);
            
            attacker.firingAt = target.id;
            attacker.fires.push({ targetId: target.id, wpnName: wpn.name, range: wpn.range, expireTime: time + 0.3 });
            
            let flightTime = 0;
            if (wpn.muzzle_velocity && wpn.muzzle_velocity < 400) {
              flightTime = dist3d / wpn.muzzle_velocity;
              if (wpn.flight_type === 'Staged') {
                flightTime += 1.5;
              } else if (wpn.flight_type === 'Seeking') {
                flightTime += 0.5;
              }
            }
            
            damageQueue.push({
              spawnTime: time,
              applyTime: time + flightTime,
              startX: attacker.x,
              startY: attacker.y || 0,
              targetId: target.id,
              damage: dmg,
              splashDamage: wpn.splash_damage ? wpn.splash_damage : 0,
              splashRadius: wpn.splash_radius || 0,
              team: 'B'
            });
            
            wpn.nextFireTime = time + (isDiscrete ? (1.0 / wpn.rate_of_fire) : tick);
            
            const wKey = `${wpn.name}__${target.name}`;
            if (!wpnDmgAccB[wKey]) {
              wpnDmgAccB[wKey] = { wpnName: wpn.name, targetName: target.name, damage: 0, attackerName: attacker.name };
            }
            wpnDmgAccB[wKey].damage += dmg;
          }
        }
      });
      
      if (attacker.fires && attacker.fires.length > 0) {
        attacker.firingAt = attacker.fires[0].targetId;
      }
      
      let shouldMove = !fired;
      if (attacker.move_speed > 0) {
        const enemies = aList.filter(e => e.hp > 0);
        if (enemies.length > 0) {
          let closest = enemies[0];
          let minDist = Math.hypot(attacker.x - closest.x, (attacker.y||0) - (closest.y||0));
          for (let k = 1; k < enemies.length; k++) {
            const e = enemies[k];
            const dist = Math.hypot(attacker.x - e.x, (attacker.y||0) - (e.y||0));
            if (dist < minDist) {
              minDist = dist;
              closest = e;
            }
          }
          if (fired && shortestTargetingRange !== Infinity) {
            if (minDist > shortestTargetingRange) {
              shouldMove = true;
            }
          }
          if (shouldMove) {
            const dx = closest.x - attacker.x;
            const dir = Math.sign(dx);
            attacker.x += dir * attacker.move_speed * tick;
          }
        }
      }
    });
    
    // 3. Process damage queue
    damageQueue.forEach(event => {
      if (time >= event.applyTime) {
        const enemyList = event.team === 'A' ? bList : aList;
        const target = enemyList.find(u => u.id === event.targetId);
        if (target && target.hp > 0) {
          target.hp -= event.damage;
          
          // Apply splash damage
          if (event.splashRadius > 0 && event.splashDamage > 0) {
            enemyList.forEach(u => {
              if (u.id !== target.id && u.hp > 0) {
                const dist = Math.hypot(u.x - target.x, (u.y||0) - (target.y||0));
                if (dist <= event.splashRadius) {
                  u.hp -= event.splashDamage;
                }
              }
            });
          }
        }
      }
    });
    damageQueue = damageQueue.filter(event => time < event.applyTime);
    
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
          aUnits: aList.map(u => ({ id: u.id, name: u.name, icon: u.icon, hp: u.hp, maxHp: u.maxHp, x: u.x, y: u.y || 0, firingAt: u.firingAt, fires: u.fires || [], maxRange: u.maxRange, visionRadius: u.visionRadius, radarRadius: u.radarRadius, weapons: u.weapons ? u.weapons.map(w => ({ name: w.name, range: w.range })) : [] })),
          bUnits: bList.map(u => ({ id: u.id, name: u.name, icon: u.icon, hp: u.hp, maxHp: u.maxHp, x: u.x, y: u.y || 0, firingAt: u.firingAt, fires: u.fires || [], maxRange: u.maxRange, visionRadius: u.visionRadius, radarRadius: u.radarRadius, weapons: u.weapons ? u.weapons.map(w => ({ name: w.name, range: w.range })) : [] })),
          projectiles: damageQueue.map(p => {
            const duration = p.applyTime - p.spawnTime;
            const elapsed = time - p.spawnTime;
            const progress = duration > 0 ? Math.min(1, Math.max(0, elapsed / duration)) : 1;
            const targetList = p.team === 'A' ? bList : aList;
            const target = targetList.find(u => u.id === p.targetId);
            const endX = target ? target.x : p.startX;
            const endY = target ? (target.y || 0) : p.startY;
            return {
              x: p.startX + (endX - p.startX) * progress,
              y: p.startY + (endY - p.startY) * progress,
              team: p.team
            };
          }),
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
