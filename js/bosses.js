'use strict';
window.G = window.G || {};
(function (G) {
  const TAU = Math.PI * 2;
  const DATA = {
    weaver: { name: '실을 잣는 자', hp: 1250, size: 2.85, ratio: 0.719, xp: 112, speed: 1.7, range: 5, gap: 1.65, col: [1, 0.57, 0.29], tint: [1.25, 1.13, 1.06], cue: 'knocks' },
    marionette: { name: '꼭두각시', hp: 1500, size: 3.45, ratio: 0.686, xp: 136, speed: 2.4, range: 7, gap: 1.25, col: [1, 0.45, 0.43], tint: [1, 0.96, 0.87], cue: 'strobo' },
    whiteout: { name: '백색 잔상', hp: 1800, size: 3.65, ratio: 0.292, xp: 160, speed: 2.9, range: 5, gap: 1.35, col: [0.68, 0.89, 1], tint: [0.9, 0.98, 1.05], cue: 'whistle' },
    strider: { name: '긴다리', hp: 2200, size: 4.95, ratio: 0.393, xp: 220, speed: 2.1, range: 9, gap: 1.4, col: [1, 0.69, 0.36], tint: [1.32, 1.2, 1.08], cue: 'encounter' },
    drowned: { name: '물 밑의 손님', hp: 3900, size: 6.4, ratio: 1.094, xp: 390, speed: 2.4, range: 11, gap: 1.4, col: [0.32, 0.94, 0.78], tint: [1.22, 1.37, 1.18], cue: 'chant' },
    family: { name: '그림자 가족', hp: 6200, size: 8.6, ratio: 0.827, xp: 600, speed: 2.2, range: 12, gap: 1.5, col: [1, 0.38, 0.46], tint: [1.25, 1.13, 1.13], cue: 'scream' },
    chorus: { name: '백색 성가대', hp: 4850, size: 7.4, ratio: 0.595, xp: 450, speed: 1.55, range: 11, gap: 1.9, col: [1, 0.85, 0.5], tint: [1.02, 1.04, 1.14], cue: 'whistle' },
    neck: { name: '장막의 목', hp: 5400, size: 8.8, ratio: 0.229, xp: 530, speed: 2.15, range: 13, gap: 1.7, col: [1, 0.48, 0.63], tint: [1.36, 1.18, 1.15], cue: 'strobo' },
    shroud: { name: '수의의 무용수', hp: 6200, size: 6.8, ratio: 0.576, xp: 620, speed: 2.8, range: 9, gap: 2.15, col: [0.57, 0.94, 1], tint: [1, 1.1, 1.16], cue: 'knocks' },
    origin: { name: '무명태', hp: 10600, size: 12.3, ratio: 0.224, xp: 1250, speed: 1.15, range: 19, gap: 2.6, col: [0.91, 0.47, 1], tint: [1.22, 1.12, 1.25], cue: 'chant' },
  };
  const ORIGIN_SPLIT = 0.58;
  const BOSS_HP_MULT = 3; // 난이도: 보스와 연결핵 체력 배율
  const ORIGIN_REVEAL = 2.7;
  const ANCHOR_COLOR = [1, 0.75, 0.36];

  const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const angles = (yaw) => ({ dx: Math.sin(yaw), dz: Math.cos(yaw) });
  const friends = (S) => [S.player, ...S.bots];
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  // 점프 회피: 발이 바닥에서 이만큼 떠 있으면 바닥 공격(파동·회전하는 빛·낙인)을 넘은 것으로 본다.
  // 예전에는 높이 0.85m를 넘겨야 해서 점프의 절반 구간에서만 피해졌다.
  const JUMP_CLEAR = 0.25;
  const airborne = (f) => f.y - G.world.groundAt(f.x, f.z, f.r || 0.32, f.y) > JUMP_CLEAR;

  function spawn(S, type, x, z, room) {
    const def = { ...DATA[type], kind: 'boss' };
    const hp = Math.round(def.hp * BOSS_HP_MULT * G.Actors.partyScale() * (1 + Math.min(0.3, (S.player.lvl - 1) * 0.035)));
    const e = {
      type, def, x, y: 0, z, room, hp, maxHp: hp, r: 0.55, alive: true, phase: 1, turn: 0, tell: '',
      yaw: 0, age: 0, walk: 0, flash: 0, revUntil: 0, cooldown: 0.6, stretch: 1, widthScale: 1,
      lean: 0, zones: [], waves: [], charge: null, wind: null, sweep: null,
    };
    if (type === 'origin') {
      e.home = { x, z };
      e.rites = 0;
      e.awakeAttacks = 0;
      e.exposed = 0;
      e.revealT = 0;
      e.anchors = [];
      e.anchorCount = 0;
      e.objective = '의식 후 가면 노출';
      e.cooldown = 2.8;
      G.hud.sub('무명태 · 태초에 바알제붑과 아자토스를 낳은 자');
    }
    S.boss = e;
    S.enemies.push(e);
    G.audio.cue?.(def.cue);
    return e;
  }

  function insideRoom(e, x, z) {
    const r = e.room;
    return !r || (x > r.x0 + 1 && z > r.z0 + 1 && x < r.x0 + r.width - 1 && z < r.z0 + r.depth - 1);
  }

  function move(e, dx, dz) {
    if (!insideRoom(e, e.x + dx, e.z + dz)) return true;
    const x = e.x, z = e.z, visualY = e.y;
    e.y = 0;
    const hit = G.world.move(e, dx, dz);
    e.y = visualY;
    e.walk += Math.hypot(e.x - x, e.z - z) * 3;
    return hit;
  }

  function pointInRoom(e, x, z) {
    const r = e.room;
    if (!r) return { x, z };
    return { x: clamp(x, r.x0 + 1.8, r.x0 + r.width - 1.8), z: clamp(z, r.z0 + 1.8, r.z0 + r.depth - 1.8) };
  }

  function teleportSpot(e, p, min, max) {
    const start = Math.random() * TAU;
    for (let i = 0; i < 24; i++) {
      const { dx, dz } = angles(start + i / 24 * TAU);
      const r = min + (max - min) * Math.random();
      const at = pointInRoom(e, p.x + dx * r, p.z + dz * r);
      if (flat(at, p) < min - 0.1 || G.world.blocked(at.x, at.z, e.r, 0)) continue;
      if (G.world.los(at, 0.9, p, p.y + 1.1)) return [at.x, at.z];
    }
    return G.world.freeSpot(e.room, p.x, p.z, min);
  }

  function chase(e, p, dt) {
    const d = flat(e, p) || 0.01;
    const { dx, dz } = angles(e.yaw);
    const strafe = Math.sin(e.age * (e.type === 'marionette' ? 2.6 : 0.7));
    const toward = d > e.def.range ? 1 : d < e.def.range * 0.65 ? -0.65 : 0;
    const reverse = e.reversed ? -0.75 : 1;
    const s = e.def.speed * dt;
    const sideways = e.type === 'marionette' ? 1 : 0.38;
    move(e, (dx * toward * reverse + dz * strafe * sideways) * s, (dz * toward * reverse - dx * strafe * sideways) * s);
  }

  function circle(at, radius) {
    return { kind: 'circle', x: at.x, z: at.z, radius };
  }

  function lane(at, yaw, length, width) {
    return { kind: 'lane', x: at.x, z: at.z, yaw, length, width, ...angles(yaw) };
  }

  function across(p, yaw, length, width) {
    const { dx, dz } = angles(yaw);
    return lane({ x: p.x - dx * length / 2, z: p.z - dz * length / 2 }, yaw, length, width);
  }

  function start(e, tell, time, zones, fire) {
    e.tell = tell;
    e.zones = zones;
    e.wind = { time, total: time, fire };
  }

  function areaHit(S, e, zones, dmg, alreadyHit) {
    for (const f of friends(S)) {
      if (!f.alive || airborne(f) || alreadyHit?.has(f) || !insideRoom(e, f.x, f.z)) continue;
      const hit = zones.some((zone) => {
        const x = f.x - zone.x, z = f.z - zone.z;
        if (zone.kind === 'circle') return Math.hypot(x, z) < zone.radius;
        const along = x * zone.dx + z * zone.dz;
        return along > 0 && along < zone.length && Math.abs(x * zone.dz - z * zone.dx) < zone.width / 2;
      });
      if (hit) {
        alreadyHit?.add(f);
        G.Actors.hurtFriendly(S, f, dmg);
      }
    }
  }

  function scatter(S, e, x, z, radius, n) {
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU;
      G.Actors.burst(S, x + Math.sin(a) * radius, 0.15, z + Math.cos(a) * radius, e.def.col, 1, 3.6);
    }
  }

  function strike(S, e, zones, dmg) {
    areaHit(S, e, zones, dmg);
    zones.forEach((zone) => {
      if (zone.kind === 'circle') scatter(S, e, zone.x, zone.z, zone.radius * 0.8, 12);
      else for (let i = 1; i < 12; i++) {
        const distance = zone.length * i / 12;
        G.Actors.burst(S, zone.x + zone.dx * distance, 0.18, zone.z + zone.dz * distance, e.def.col, 1, 3.4);
      }
    });
    G.audio.sfx('boom');
  }

  function wave(S, e, x, z, speed, max, dmg) {
    const pulse = { x, z, radius: 0.2, speed, max, dmg, hits: new Set() };
    e.waves.push(pulse);
    G.audio.sfx('orb');
    scatter(S, e, x, z, 1.2, 18);
    return pulse;
  }

  function advanceWave(S, e, w, dt) {
    const oldRadius = w.radius;
    w.radius += w.speed * dt;
    for (const f of friends(S)) {
      if (!f.alive || airborne(f) || w.hits.has(f) || !insideRoom(e, f.x, f.z)) continue;
      const d = flat(w, f);
      if (d < oldRadius - 0.7 || d > w.radius + 0.7) continue;
      w.hits.add(f);
      G.Actors.hurtFriendly(S, f, w.dmg);
    }
    return w.radius < w.max;
  }

  function fan(S, e, yaw, n, spread, speed, dmg) {
    for (let i = 0; i < n; i++) {
      const { dx, dz } = angles(yaw + (i - (n - 1) / 2) * spread);
      S.orbs.push({ x: e.x + dx, y: 1.12, z: e.z + dz, vx: dx * speed, vy: 0, vz: dz * speed, dmg, life: 3.6, boss: e, col: e.def.col });
    }
    G.audio.sfx('orb');
  }

  function striderCharge(S, e, dt) {
    const a = e.charge;
    const step = Math.min(a.left, 16 * dt);
    const hitWall = move(e, a.dx * step, a.dz * step);
    a.left -= step;
    const front = { x: e.x + a.dx * 0.35, z: e.z + a.dz * 0.35 };
    for (const f of friends(S)) {
      if (!f.alive || f.y > 1.25 || a.hits.has(f) || !insideRoom(e, f.x, f.z) || flat(f, front) > 1.48) continue;
      a.hits.add(f);
      G.Actors.hurtFriendly(S, f, 29);
    }
    if (hitWall || a.left <= 0) {
      scatter(S, e, e.x, e.z, 1.1, 16);
      G.audio.sfx('boom');
      e.charge = null;
      e.tell = '';
    }
  }

  function sweepLane(e, yaw, length, width) {
    const { dx, dz } = angles(yaw);
    const reach = G.world.raycast(e.x, 0.45, e.z, dx, 0, dz, length);
    return lane(e, yaw, reach, width);
  }

  function windSweep(S, e, yaw, extent, length, duration, damage, count) {
    const edgeAngles = Array.from({ length: count }, (_, i) => yaw + i * TAU / count);
    const warning = edgeAngles.flatMap((angle) => [-1, 0, 1].map((offset) => sweepLane(e, angle + extent * offset, length, 0.45)));
    start(e, count > 1 ? '겹쳐 도는 시선 · 빛 사이로' : '목의 그림자 · 빛을 넘어 점프', 1.15, warning, () => {
      e.sweep = { edgeAngles, extent, length, duration, damage, time: 0, hits: new Set() };
      e.tell = '회전하는 빛 · 점프';
      G.audio.sfx('orb');
    });
  }

  function advanceSweep(S, e, dt) {
    const s = e.sweep;
    s.time = Math.min(s.duration, s.time + dt);
    const offset = s.extent * (2 * s.time / s.duration - 1);
    e.zones = s.edgeAngles.map((angle) => sweepLane(e, angle + offset, s.length, 1.6));
    areaHit(S, e, e.zones, s.damage, s.hits);
    if (s.time === s.duration) {
      e.sweep = null;
      e.zones = [];
      e.tell = '';
      if (e.type === 'origin') e.awakeAttacks += 1;
    }
  }

  function shroudDance(S, e, p, step = 0) {
    const a = e.yaw + (step % 2 ? -1 : 1) * Math.PI / 2;
    const distance = 3.9 - step * 0.5;
    const at = pointInRoom(e, p.x + Math.sin(a) * distance, p.z + Math.cos(a) * distance);
    if (G.world.blocked(at.x, at.z, e.r, 0)) {
      const [x, z] = teleportSpot(e, p, 3.4, 6);
      at.x = x; at.z = z;
    }
    const zone = circle(at, 2.4 + step * 0.24);
    start(e, `빈 옷의 왈츠 ${step + 1}/3 · 원 밖으로`, step === 0 ? 1.05 : 0.8, [zone], () => {
      scatter(S, e, e.x, e.z, 0.6, 10);
      e.x = at.x; e.z = at.z;
      e.landT = 0.75;
      strike(S, e, [zone], 32);
      if (step < 2) shroudDance(S, e, p, step + 1);
    });
  }

  function originRite(S, e, p) {
    const yaw = e.yaw, { dx, dz } = angles(yaw);
    const complete = () => { e.rites += 1; e.exposed = 2.9; };
    switch (e.turn % 3) {
      case 1: {
        const wings = [-1, 1].map((side) => across({ x: p.x + side * dz * 3.4, z: p.z - side * dx * 3.4 }, yaw, 23, 2.45));
        const zones = [circle(p, 1.7), ...wings];
        start(e, '바알제붑의 첫 울음 · 날개 틈으로', 1.45, zones, () => { strike(S, e, zones, 34); complete(); });
        break;
      }
      case 2: {
        const at = pointInRoom(e, p.x + dx * 5, p.z + dz * 5);
        start(e, '아자토스의 박동 · 파동 위로 점프', 1.45, [circle(at, 2.6)], () => {
          wave(S, e, at.x, at.z, 10.7, 20, 27);
          wave(S, e, e.x, e.z, 8.7, 27, 25);
          complete();
        });
        break;
      }
      default: {
        const zones = [across(p, yaw + Math.PI / 4, 24, 2.55), across(p, yaw - Math.PI / 4, 24, 2.55)];
        start(e, '두 탄생의 자국 · 교차점 밖으로', 1.3, zones, () => { strike(S, e, zones, 38); complete(); });
      }
    }
  }

  function originAwake(S, e, p) {
    const yaw = e.yaw;
    switch (e.turn % 3) {
      case 1: {
        const { dx, dz } = angles(yaw);
        const at = pointInRoom(e, p.x + dz * 6, p.z - dx * 6);
        start(e, '겹파동 · 바닥의 두 고리를 넘기', 1.15, [circle(at, 2.1), circle(e, 4.3)], () => {
          wave(S, e, e.x, e.z, 12.3, 29, 25);
          wave(S, e, at.x, at.z, 9.9, 17, 24);
          e.awakeAttacks += 1;
        });
        break;
      }
      case 2:
        windSweep(S, e, yaw, 0.83, 31, 1.8, 39, 2);
        break;
      default: {
        const { dx, dz } = angles(yaw);
        const spots = [-1, 0, 1].map((side) => circle(pointInRoom(e, p.x + dz * side * 4.6, p.z - dx * side * 4.6), 2.55));
        start(e, '무명 낙인 · 빛나는 원 밖으로', 1.05, spots, () => {
          strike(S, e, spots, 35);
          const late = circle(p, 2.3);
          start(e, '잔류 낙인 · 계속 이동', 0.95, [late], () => {
            strike(S, e, [late], 31);
            e.awakeAttacks += 1;
          });
        });
      }
    }
  }

  const attack = {
    weaver(S, e, p) {
      const { dx, dz } = angles(e.yaw);
      const zones = [circle(p, 2.05)];
      for (const side of [-1, 1]) zones.push(circle(pointInRoom(e, p.x + dz * 2.85 * side, p.z - dx * 2.85 * side), 1.3));
      start(e, '실 매듭 · 원 밖으로', 1.0, zones, () => strike(S, e, zones, 21));
    },
    marionette(S, e, p) {
      const sideways = e.yaw + Math.PI / 2;
      const offset = e.turn % 2 ? 2.65 : -2.65;
      const second = { x: p.x + Math.sin(e.yaw) * offset, z: p.z + Math.cos(e.yaw) * offset };
      const zones = [across(p, sideways, 11, 1.35), across(second, sideways, 11, 1.15)];
      start(e, '당겨지는 실 · 줄 사이로', 0.92, zones, () => strike(S, e, zones, 24));
    },
    whiteout(S, e, p) {
      const [x, z] = teleportSpot(e, p, 4, 7.5);
      scatter(S, e, e.x, e.z, 0.8, 10);
      e.x = x; e.z = z;
      const zone = circle(e, 1.65);
      start(e, '백색 파동 · 점프로 회피', 0.85, [zone], () => wave(S, e, x, z, 8.5, 9.5, 23));
    },
    strider(S, e) {
      const { dx, dz } = angles(e.yaw);
      const length = Math.max(0, G.world.raycast(e.x, 0.43, e.z, dx, 0, dz, 17) - 0.65);
      if (length < 1.2) { e.cooldown = 0.55; return; }
      const zone = lane(e, e.yaw, length, 2.95);
      start(e, '직선 돌진 · 옆으로', 0.86, [zone], () => {
        e.charge = { dx, dz, left: length, hits: new Set() };
        e.tell = '돌진';
        G.audio.sfx('orb');
      });
    },
    drowned(S, e, p) {
      if (e.turn % 2 === 1) {
        const [x, z] = teleportSpot(e, p, 5.5, 9);
        const zone = circle({ x, z }, 2.9);
        start(e, '잠수 · 물결에서 벗어나기', 1.25, [zone], () => {
          e.x = x; e.z = z;
          e.rise = 0.7;
          strike(S, e, [zone], 30);
          const pulse = wave(S, e, x, z, 10.5, 19, 20);
          pulse.hits = new Set(friends(S).filter((f) => flat(f, zone) < zone.radius));
        });
      } else {
        const yaw = e.yaw;
        const zones = [-0.26, 0, 0.26].map((a) => lane(e, yaw + a, 17, 0.32));
        start(e, '물살 부채꼴 · 틈새로', 1.03, zones, () => fan(S, e, yaw, 5, 0.13, 13, 23));
      }
    },
    family(S, e, p) {
      if (e.turn % 2 === 1) {
        const yaw = e.yaw + (e.phase > 1 ? Math.PI / 4 : Math.PI / 2);
        const zones = [across(p, yaw, 19, 2.05), across(p, yaw + Math.PI / 2, 19, 2.05)];
        if (e.phase > 1) zones.push(circle(p, 3.15));
        start(e, '가족사진 · 교차선에서 벗어나기', e.phase === 1 ? 1.25 : 0.9, zones, () => strike(S, e, zones, e.phase === 1 ? 25 : 35));
      } else {
        const yaw = e.yaw;
        const zone = circle(e, 3.1);
        start(e, '합창 · 파동 위로 점프', e.phase === 1 ? 1.1 : 0.86, [zone], () => {
          wave(S, e, e.x, e.z, 12.5, 22, 22);
          fan(S, e, yaw, e.phase === 1 ? 5 : 9, 0.19, e.phase === 1 ? 10 : 14, 16);
        });
      }
    },
    chorus(S, e, p) {
      const yaw = e.yaw;
      if (e.turn % 2 === 1) {
        const { dx, dz } = angles(yaw);
        const spots = [-1, 0, 1].map((side) => pointInRoom(e, e.x + dz * side * 4.3, e.z - dx * side * 4.3));
        start(e, '삼중 화음 · 고리 사이로', 1.3, spots.map((at) => circle(at, 1.55)), () => {
          spots.forEach((at, i) => wave(S, e, at.x, at.z, 8.5 + 1.3 * i, 18, 17));
        });
      } else {
        const zones = [-0.4, -0.2, 0, 0.2, 0.4].map((angle) => sweepLane(e, yaw + angle, 24, 0.35));
        start(e, '다섯 비명 · 탄막 틈으로', 1.1, zones, () => fan(S, e, yaw, 5, 0.2, 14, 23));
      }
    },
    neck(S, e) {
      const yaw = e.yaw;
      if (e.turn % 2 === 0) {
        windSweep(S, e, yaw, 1.04, 25, 1.55, 35, 1);
      } else {
        const hit = sweepLane(e, yaw, 25, 3.7);
        start(e, '고개 내리찍기 · 길 밖으로', 1.2, [hit], () => {
          e.landT = 0.55;
          strike(S, e, [hit], 37);
        });
      }
    },
    shroud(S, e, p) {
      if (e.turn % 2 === 1) {
        shroudDance(S, e, p);
      } else {
        const zones = [-0.58, 0, 0.58].map((angle) => across(p, e.yaw + Math.PI / 2 + angle, 18, 1.28));
        start(e, '찢어진 수의 · 사선 사이로', 1.2, zones, () => strike(S, e, zones, 36));
      }
    },
    origin(S, e, p) {
      if (e.phase === 1) originRite(S, e, p);
      else originAwake(S, e, p);
    },
  };

  function phaseTwo(S, e) {
    e.phase = 2;
    e.turn = 0;
    e.waves = [];
    S.orbs = S.orbs.filter((o) => o.boss !== e);
    const zone = circle(e, 3.2);
    e.phaseGuard = true;
    start(e, '두 번째 노출 · 충격파', 1.2, [zone], () => {
      e.phaseGuard = false;
      wave(S, e, e.x, e.z, 13, 24, 25);
    });
    G.hud.banner('그림자 가족', '2단계 · 두 번째 노출');
    G.audio.cue?.('scream');
    S.shift = Math.max(S.shift, 0.7);
  }

  function originHealthFloor(e) {
    const ratio = e.phase === 1
      ? ORIGIN_SPLIT + Math.max(0, 3 - e.rites) * 0.064
      : Math.max(0, 2 - e.awakeAttacks) * 0.07;
    return e.maxHp * ratio;
  }

  function isProtected(e) {
    if (e.net) return !!e.prot;
    if (e.type !== 'origin') return false;
    const floor = originHealthFloor(e);
    return e.revealT > 0 || e.anchorCount > 0 || (floor > 0 && e.hp <= floor);
  }

  function originDamage(S, e, amount, byPlayer) {
    const reduced = amount * (e.phase === 1 && !e.exposed ? 0.25 : 1) * (byPlayer ? 1 : 0.52);
    const hp = isProtected(e) ? e.hp : Math.max(originHealthFloor(e), e.hp - reduced);
    if (hp === e.hp && byPlayer && S.time >= (e.blockFxAt || 0)) {
      e.blockFxAt = S.time + 0.42;
      e.blockFlash = 0.24;
      G.audio.sfx('event');
    }
    return hp;
  }

  function addOriginAnchors(S, e) {
    const used = [];
    e.anchors = [[-6, -8], [-8, 8], [6, 8]].map(([dx, dz], i) => {
      let { x, z } = pointInRoom(e, e.home.x + dx, e.home.z + dz);
      if (G.world.blocked(x, z, 0.6, 0)) [x, z] = G.world.freeSpot(e.room, e.x, e.z, 4, used);
      used.push([x, z]);
      const hp = Math.round((150 + S.player.lvl * 12) * BOSS_HP_MULT * G.Actors.partyScale());
      const def = { kind: 'anchor', name: `연결핵 ${['I', 'II', 'III'][i]}`, size: 1.72, col: ANCHOR_COLOR };
      return { type: 'origin-anchor', def, parent: e, x, y: 0.2, z, room: e.room, hp, maxHp: hp, r: 0.6, alive: true, revUntil: 0, flash: 0, bob: 2 * i };
    });
    e.anchorCount = e.anchors.length;
    S.enemies.push(...e.anchors);
    G.hud.sub('금빛 연결핵 세 개를 쏴야 얼굴이 드러난다');
  }

  function anchorDown(S, anchor) {
    const e = anchor.parent;
    e.anchorCount -= 1;
    G.Actors.burst(S, anchor.x, 1.35, anchor.z, ANCHOR_COLOR, 22, 5);
    G.audio.sfx('clear');
    if (e.anchorCount === 0) {
      e.awakeAttacks = 0;
      e.flash = 0.18;
      G.hud.toast('연결 해제 · 무명태 본체에 사격', '#ffe3aa');
      G.audio.sfx('boom');
    }
  }

  function startOriginReveal(S, e) {
    e.phase = 2;
    e.turn = 0;
    e.revealT = ORIGIN_REVEAL;
    e.wind = null;
    e.zones = [];
    e.waves = [];
    e.tell = '';
    e.objective = '두 탄생의 얼굴';
    S.orbs = S.orbs.filter((o) => o.boss !== e);
    S.shift = Math.max(S.shift, 0.47);
    G.audio.music('origin-awake');
    G.Voice.say('awake');
    G.hud.banner('무명태', '두 번째 노출 · 두 탄생의 얼굴');
    G.hud.sub('두 신의 울음은 하나의 얼굴에서 흘러나왔다.');
    scatter(S, e, e.x, e.z, 4.2, 38);
  }

  function updateOrigin(S, e, dt) {
    e.blockFlash = Math.max(0, (e.blockFlash || 0) - dt);
    if (e.phase === 1) {
      e.exposed = Math.max(0, e.exposed - dt);
      e.objective = e.exposed > 0 && !isProtected(e) ? '가면 균열 · 지금 사격' : '의식 후 가면 노출';
      if (e.rites >= 3 && e.hp <= e.maxHp * ORIGIN_SPLIT) startOriginReveal(S, e);
    }
    if (e.revealT > 0) {
      e.revealT = Math.max(0, e.revealT - dt);
      if (e.revealT < 1.4 && !e.sprite) {
        e.sprite = 'origin-face';
        e.def.size = 10.8;
        e.def.ratio = 0.913;
        e.def.col = [1, 0.38, 0.48];
        e.def.tint = [1.27, 1.04, 1.13];
      }
      if (e.revealT === 0) {
        addOriginAnchors(S, e);
        e.cooldown = 3.4;
      }
      return true;
    }
    if (e.phase === 2) {
      e.objective = e.anchorCount > 0 ? `연결핵 ${e.anchorCount}/3 · 사격`
        : isProtected(e) ? '마지막 울음 · 공격을 피하기' : '본체 노출 · 사격';
    }
    return false;
  }

  function animate(e, dt) {
    const wind = e.wind ? 1 - e.wind.time / e.wind.total : 0;
    e.widthScale = 1;
    e.stretch = 1;
    e.lean = 0;
    if (e.type === 'weaver') {
      e.y = Math.sin(e.age * 3.1) * 0.11;
      e.stretch = 0.96 + Math.sin(e.age * 2.8) * 0.04 + wind * 0.19;
      e.lean = Math.sin(e.age * 2) * 0.045;
    } else if (e.type === 'marionette') {
      e.y = 0.25 + Math.sin(e.age * 3.8) * 0.22;
      e.lean = Math.sin(e.age * 3.8) * (0.12 + wind * 0.12);
    } else if (e.type === 'whiteout') {
      const flicker = Math.sin(e.age * 31) > 0.82;
      e.y = 0.3 + Math.sin(e.age * 3) * 0.16;
      e.widthScale = flicker ? 0.73 : 1 + wind * 0.12;
      e.lean = flicker ? 0.085 : -0.035;
    } else if (e.type === 'strider') {
      e.y = Math.abs(Math.sin(e.walk)) * (e.charge ? 0.36 : 0.16);
      e.stretch = 1 - wind * 0.12;
      e.lean = e.charge ? 0.22 : Math.sin(e.walk) * 0.07;
    } else if (e.type === 'drowned') {
      e.rise = Math.max(0, (e.rise || 0) - dt);
      const sinking = e.tell.startsWith('잠수') ? wind * 0.65 : e.rise * 0.72;
      e.y = -0.2 - sinking * e.def.size + Math.sin(e.age * 2.6) * 0.16;
      e.lean = Math.sin(e.age * 1.7) * 0.08;
    } else if (e.type === 'family') {
      const pulse = Math.sin(e.age * (e.phase === 1 ? 1.8 : 3.1));
      e.y = pulse * 0.15;
      e.stretch = (e.phase === 1 ? 1 : 1.1) + wind * 0.12 + pulse * 0.025;
      e.widthScale = 1 + wind * 0.085;
      e.lean = pulse * 0.043;
    } else if (e.type === 'chorus') {
      const breath = Math.sin(e.age * 2.6);
      e.y = Math.max(0, breath) * 0.27;
      e.stretch = 1 + breath * 0.06 + wind * 0.1;
      e.widthScale = 1 + wind * 0.24;
      e.lean = breath * 0.027;
    } else if (e.type === 'neck') {
      e.landT = Math.max(0, (e.landT || 0) - dt);
      e.y = 0.05 + Math.sin(e.age * 1.8) * 0.09;
      e.stretch = 1 + wind * 0.15 - e.landT * 0.38;
      e.lean = e.sweep
        ? Math.sin((2 * e.sweep.time / e.sweep.duration - 1) * e.sweep.extent) * 0.32
        : Math.sin(e.age * 1.95) * (0.09 + wind * 0.13);
    } else if (e.type === 'shroud') {
      e.landT = Math.max(0, (e.landT || 0) - dt);
      e.y = 0.25 + Math.sin(e.age * 4.1) * 0.23 + Math.sin(e.landT / 0.75 * Math.PI) * 1.25;
      e.stretch = 1 + Math.sin(e.age * 4.1) * 0.05 + wind * 0.08;
      e.lean = Math.sin(e.age * 4.1) * (0.11 + wind * 0.12);
    } else if (e.type === 'origin') {
      const pulse = Math.sin(e.age * (e.phase === 1 ? 1.34 : 2.65));
      const shift = e.revealT > 0 ? Math.sin(e.revealT / ORIGIN_REVEAL * Math.PI) : 0;
      e.y = (e.sprite ? 0.66 : 0.1) + pulse * 0.16 + shift * 1.2;
      e.stretch = 1 + pulse * 0.025 + wind * 0.11 - shift * 0.25;
      e.widthScale = 1 + wind * 0.075 - shift * 0.22;
      e.lean = pulse * (e.sprite ? 0.018 : 0.035) + shift * Math.sin(e.age * 12) * 0.065;
    }
  }

  function update(S, e, dt) {
    e.flash = Math.max(0, e.flash - dt);
    e.age += dt;
    const p = S.player;
    const active = p.alive && insideRoom(e, p.x, p.z);
    const revealing = active && e.type === 'origin' && updateOrigin(S, e, dt);
    animate(e, dt);
    if (!active || revealing) return;
    e.reversed = S.time < e.revUntil;
    if (e.type === 'family' && e.phase === 1 && e.hp <= e.maxHp * 0.5) phaseTwo(S, e);
    e.waves = e.waves.filter((pulse) => advanceWave(S, e, pulse, dt));
    if (e.sweep) { advanceSweep(S, e, dt); return; }
    if (e.charge) { striderCharge(S, e, dt); return; }
    if (e.wind) {
      e.wind.time -= dt;
      if (e.wind.time > 0) return;
      const fire = e.wind.fire;
      e.wind = null;
      e.zones = [];
      e.tell = '';
      fire();
      e.cooldown = e.def.gap * (e.phase > 1 ? 0.64 : 1);
      return;
    }
    e.yaw = Math.atan2(p.x - e.x, p.z - e.z);
    if (e.type !== 'origin') chase(e, p, dt);
    else if (e.phase === 1) {
      const x = e.home.x + Math.cos(e.age * 0.48) * 3;
      const z = e.home.z + Math.sin(e.age * 0.48) * 2;
      move(e, (x - e.x) * dt * e.def.speed, (z - e.z) * dt * e.def.speed);
    }
    e.cooldown -= dt;
    if (e.cooldown <= 0) {
      e.turn += 1;
      attack[e.type](S, e, p);
    }
  }

  function loadTextures() {
    const ids = [...Object.keys(DATA), 'origin-face'];
    if (location.protocol !== 'file:') {
      ids.forEach((id) => G.gfx.loadTexture(id, 'assets/bosses/' + id + '.webp'));
      return;
    }
    // 로컬 파일은 브라우저가 이미지의 WebGL 업로드를 차단하므로 데이터 URL을 사용한다.
    const script = document.createElement('script');
    script.src = 'assets/bosses/offline.js';
    script.onload = () => ids.forEach((id) => G.gfx.loadTexture(id, G.OfflineBossSprites[id]));
    script.onerror = () => console.warn('오프라인 보스 이미지를 불러오지 못했습니다.');
    document.head.append(script);
  }

  G.Bosses = { name: (type) => DATA[type].name, spawn, update, loadTextures, anchorDown, originDamage, isProtected };
})(window.G);
