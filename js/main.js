'use strict';
window.G = window.G || {};
// 게임 진행: 여섯 구역의 봉인과 격리전을 거쳐 최초의 출생을 마주한다.
(function (G) {
  const EYE_H = 1.55, GIANT_EYE = 3.7, MOVE_SPEED = 5.4, SPRINT_MULT = 1.45, AIM_MOVE = 0.6, HASTE = 1.5, GIANT_SPEED = 1.25;
  const JUMP_V = 6.4, GRAVITY = 18, LOW_GRAV = 0.32;
  const FOV = 77, AIM_FOV = 48, TPS_BACK = 3.0, TPS_AIM_BACK = 1.6, TPS_SIDE = 0.7, LOOK_SENS = 0.00325, AIM_SENS = 0.49;
  const GATE_NEED = G.World.sealsNeeded, RESPAWN_TIME = 3, REGEN_DELAY = 6, REGEN_RATE = 5, HIST_STEP = 0.1, HIST_LEN = 30;
  const WORLD_CHAT_GAP = [16, 34], END_DELAY = 2.5, NORMAL_RES = 540;
  const WAVE_INTERVAL = 2.4, AUTO_WAVE = 'auto';
  // 보스 직전의 판: 순서대로 야바위와 패 낚기를 번갈아 하며 뒤로 갈수록 빨라진다.
  const BOSS_ORDER = ['weaver', 'marionette', 'whiteout', 'strider', 'drowned', 'family', 'chorus', 'neck', 'shroud', 'origin'];
  const FINAL_DUELS = ['shell', 'cards'];
  const DUEL_BOSS_CUT = 0.2, DUEL_BUFF = 25, DUEL_HP_COST = 0.3, VOICE_STAGE = 4, DOWN_VOICE_CHANCE = 0.5;
  const STAGE_MUSIC = { 2: 'reservoir', 3: 'orchard', 4: 'procession', 5: 'veil', 6: 'origin' };
  const SAVE_KEY = 'newroom-online-v1';
  const $ = (id) => document.getElementById(id);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const smooth = (rate, dt) => 1 - Math.exp(-rate * dt);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const rule = (id) => G.Rules.active(S, id);
  let S = null, last = 0, crashed = false;

  function loadSave() {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (d && Array.isArray(d.endings)) return { endings: d.endings.filter((x) => typeof x === 'string'), bestLevel: Number(d.bestLevel) || 1, helsi: d.helsi === true };
    } catch (err) {
      console.warn('저장 기록을 읽지 못했습니다:', err);
    }
    return { endings: [], bestLevel: 1, helsi: false };
  }

  function writeSave(d) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(d)); } catch (err) { console.warn('저장하지 못했습니다:', err); }
  }

  function newState(seed) {
    G.world = G.World.build(seed, G.GAME_DATA);
    G.gfx.setStatic(G.world.staticVerts);
    G.world.staticVerts = null;
    G.gfx.setLowRes(NORMAL_RES);
    return {
      seed, playing: false, paused: false, time: 0, player: null, bots: [], enemies: [], orbs: [], tracers: [], parts: [], pickups: [],
      room: null, tps: false, aiming: false, cam: null, fovNow: FOV, stats: { freedom: 0, clarity: 0, bond: 0 }, items: new Set(),
      stage: 1, mapStage: 1, restored: 0, routeSeals: 0, routeRoom: G.world.lobby.next, kills: 0,
      boss: null, duel: null, won: false, endT: 0, endingShown: false, checkpoint: G.world.lobby,
      hurt: 0, shift: 0, flashT: 0, recoil: 0, hitMarkT: 0, visitorFlash: 0, xpMult: 1, mapDirty: true, worldChatT: 8,
    };
  }

  // ---- 시작 ----
  // 접속자는 방장의 승인을 받은 뒤 이 총과 능력으로 들어간다
  let chosenGun = 'pistol', chosenSkill = null;

  function startGame(charId, gun, skill) {
    chosenGun = gun;
    chosenSkill = skill;
    if (G.Net.isClient()) {
      G.Net.requestChar(charId, gun);
      G.Lobby.gunNote('방장에게 접속을 요청하는 중…');
      return;
    }
    launch(charId, null, gun, skill, false);
    if (G.Net.isHost()) G.Net.onHostStarted();
  }

  // 시험 사격: 입구 로비에서 표적만 두고 고른 총을 쏴 본다. Esc로 총 선택에 돌아간다.
  function startRange(charId, gun, skill) {
    launch(charId, null, gun, skill, true);
  }

  function endRange() {
    if (!S.range) return;
    S = newState(S.seed);
    if (document.pointerLockElement) document.exitPointerLock();
    G.hud.show(false);
    $('touch').hidden = true;
    $('rangeExit').hidden = true;
    $('pause').hidden = true;
    $('menu').hidden = false;
    G.Lobby.backToGuns();
  }

  // at: 접속자일 때 방장이 정해 준 시작 위치·음악
  function launch(charId, at, gun, skill, range) {
    G.audio.unlock();
    const client = !!at;
    const pvp = !range && G.Net.active() && G.Net.mode() === 'pvp'; // 대전 방: 과수원에서 서로 겨룬다
    const [cx, cz] = client ? [at.x, at.z] : pvp ? G.Pvp.spawnPoint(S, false) : G.world.center(G.world.lobby);
    S.player = G.Actors.createPlayer(charId, cx, client || pvp ? cz : cz - 2, gun, skill);
    S.player.yaw = client ? Number(at.yaw) || 0 : 0;
    S.bots = []; // 파티는 실제로 접속한 사람만으로 꾸린다. 다른 접속자는 방장이 추가한다.
    G.Rules.init(S);
    S.playing = true;
    S.time = 0;
    $('menu').hidden = true;
    $('touch').hidden = !G.input.touch;
    G.hud.reset();
    G.hud.show(true);
    G.input.lock();
    $('rangeExit').hidden = !range;
    if (range) {
      S.range = true;
      G.Range.setup(S);
      G.hud.toast('시험 사격 · 1·2·3 키로 총 레벨 미리 보기 · Esc로 총 선택', null, true);
      return;
    }
    G.Net.refreshTag();
    if (pvp) {
      S.pvp = true;
      S.scores = [];
      S.checkpoint = G.Pvp.arena();
      G.hud.toast(`대전 · 다른 접속자를 쓰러뜨려라 · 먼저 ${G.Pvp.GOAL}킬`, '#ff8a7a', true);
    }
    if (client) {
      if (at.music) G.audio.music(String(at.music));
      G.hud.chat('system', '', `방 ${G.Net.code()}에 접속했습니다`, '#c8c4b4', true);
      return;
    }
    if (pvp) {
      G.Pvp.join('h', G.Actors.charName(charId), charId);
      G.audio.music('orchard');
      G.hud.chat('system', '', '대전 방이 열렸습니다 · 함께할 사람을 기다리는 중', '#c8c4b4', true);
      return;
    }
    G.audio.music('ambience');
    G.hud.chat('system', '', G.Net.isHost() ? '방이 열렸습니다 · 함께할 사람을 기다리는 중' : '혼자 접속했습니다 · 동료 없음', '#c8c4b4', true);
    G.hud.toast('공조실로 이동 · 봉인을 회수하면 다음 통로가 열린다', null, true);
  }

  // ---- 플레이어 ----
  function startReload(p) {
    if (p.reloadT > 0 || p.ammo >= p.weapon.mag) return;
    p.reloadT = p.weapon.reload;
  }

  function updateWeapon(p, inp, dt) {
    p.fireCd = Math.max(inp.fire ? -dt : 0, p.fireCd - dt);
    if (p.reloadT > 0) {
      p.reloadT -= dt;
      if (p.reloadT <= 0) p.ammo = p.weapon.mag;
    } else if (inp.fire && p.fireCd <= 0) {
      if (p.ammo > 0 || rule('burst')) G.Actors.playerFire(S);
      else startReload(p);
    }
  }

  function updatePlayer(dt) {
    const p = S.player, inp = G.input;
    p.inv = Math.max(0, p.inv - dt);
    p.skillCd = Math.max(0, p.skillCd - dt);
    if (!p.alive) {
      inp.lookX = 0; inp.lookY = 0;
      p.lookX = 0; p.lookY = 0;
      p.respawnT -= dt;
      if (p.respawnT <= 0) respawn();
      computeCamera(dt);
      return;
    }
    const mir = rule('mirror') ? -1 : 1;
    S.aiming = inp.aim;
    const sens = LOOK_SENS * (S.aiming ? AIM_SENS : 1) * (inp.touch ? 0.84 : 1);
    const follow = smooth(64, dt);
    p.lookX = (p.lookX || 0) + inp.lookX * sens * mir;
    p.lookY = (p.lookY || 0) + inp.lookY * sens;
    const yawStep = p.lookX * follow, pitchStep = p.lookY * follow;
    p.lookX -= yawStep;
    p.lookY -= pitchStep;
    p.yaw -= yawStep;
    p.pitch = clamp(p.pitch - pitchStep, -1.4, 1.4);
    if (Math.abs(p.pitch) === 1.4) p.lookY = 0;
    inp.lookX = 0; inp.lookY = 0;

    let mx = inp.moveX * mir, mz = inp.moveZ;
    const ml = Math.hypot(mx, mz);
    if (ml > 1) { mx /= ml; mz /= ml; }
    const sy = Math.sin(p.yaw), cy = Math.cos(p.yaw);
    const spd = MOVE_SPEED * (inp.sprint && !S.aiming ? SPRINT_MULT : 1) * (S.aiming ? AIM_MOVE : 1)
      * (G.Actors.has(S, 'haste') ? HASTE : 1) * (rule('giant') ? GIANT_SPEED : 1);
    const oldX = p.x, oldZ = p.z;
    if (ml > 0.05) {
      G.world.move(p, (sy * mz - cy * mx) * spd * dt, (cy * mz + sy * mx) * spd * dt);
    }
    const travel = Math.hypot(p.x - oldX, p.z - oldZ);
    p.walk += travel * 1.6;
    if (inp.consume('jump') && p.onGround) p.vy = JUMP_V;
    G.Actors.fall(p, dt, GRAVITY * (rule('lowgrav') ? LOW_GRAV : 1));

    if (inp.consume('view')) { S.tps = !S.tps; G.hud.toast(S.tps ? '3인칭 (TPS)' : '1인칭 (FPS)', null, true); }
    if (inp.consume('skill')) G.Actors.useSkill(S);
    if (inp.consume('reload')) startReload(p);
    const ch = inp.consume('choice');
    if (ch && S.choice) G.Rules.pick(S, ch - 1);
    else if (ch && S.range) G.Actors.setGunLevel(S, ch, true); // 시험 사격: 1·2·3으로 총 레벨 미리 보기
    const pace = dt > 0 ? clamp(travel / (dt * MOVE_SPEED), 0, 1.55) : 0;
    p.gait = (p.gait || 0) + ((p.onGround ? pace : 0) - (p.gait || 0)) * smooth(11, dt);
    const lean = -mx * pace * (S.aiming ? 0.003 : 0.016);
    p.lean = (p.lean || 0) + (lean - (p.lean || 0)) * smooth(10, dt);
    computeCamera(dt);
    updateWeapon(p, inp, dt);

    if (S.time - p.lastHurt > REGEN_DELAY && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + REGEN_RATE * dt);
    p.histT -= dt;
    if (p.histT <= 0) {
      p.histT = HIST_STEP;
      p.history.push({ x: p.x, y: p.y, z: p.z, hp: p.hp });
      if (p.history.length > HIST_LEN) p.history.shift();
    }
    const r = G.world.roomAt(p.x, p.z);
    if (r !== S.room) enterRoom(r);
  }

  function playerDown() {
    const p = S.player;
    p.alive = false;
    p.hp = 0;
    p.respawnT = RESPAWN_TIME;
    G.hud.dead(true);
    if (S.pvp) G.Pvp.died(S);
    if (S.stage >= VOICE_STAGE && Math.random() < DOWN_VOICE_CHANCE) G.Voice.say('down');
  }

  function respawn() {
    const p = S.player, room = S.checkpoint || G.world.lobby;
    const [cx, cz] = S.pvp ? G.Pvp.spawnPoint(S, false) : room.spawn;
    p.x = cx; p.z = cz; p.y = 0; p.vy = 0;
    p.yaw = S.pvp ? Math.random() * Math.PI * 2 : room.entryYaw; p.pitch = 0;
    p.hp = p.maxHp; p.alive = true; p.inv = 2; p.history = [];
    p.ammo = p.weapon.mag; p.reloadT = 0;
    S.room = null;
    G.hud.dead(false);
    G.hud.toast('재접속 완료', null, true);
  }

  // ---- 방 ----
  function enterRoom(r) {
    S.room = r;
    if (!r || S.range) return;
    if (r.stage !== S.mapStage) {
      S.mapStage = r.stage;
      S.mapDirty = true;
    }
    if (S.pvp) return; // 대전에는 방 진행이 없다
    if (!r.seen) {
      r.seen = true;
      if (!r.boss) { G.hud.banner(r.name, r.cat, true); G.audio.play('neon', true); }
    }
    if (G.Net.isClient()) return; // 방은 방장이 연다
    if (!r.visited) { r.visited = true; S.mapDirty = true; }
    if (r.active || r.cleared) return;
    if (r.stage > 1) enterEncounter(r);
    activateRoom(r);
  }

  // 방장: 다른 접속자가 먼저 들어간 방도 연다. 격리 구역이면 모두 그 방으로 옮긴다.
  function remoteRoom(rp) {
    const r = G.world.roomAt(rp.x, rp.z);
    if (r === rp.room) return;
    rp.room = r;
    if (!r || r.active || r.cleared) return;
    if (!r.visited) { r.visited = true; S.mapDirty = true; }
    if (r.stage > 1) {
      enterEncounter(r);
      if (G.world.roomAt(S.player.x, S.player.z) !== r) teleportSelf(r.spawn[0], r.spawn[1], r.entryYaw, true);
    }
    activateRoom(r);
  }

  function teleportSelf(x, z, yaw, refill) {
    const p = S.player;
    p.x = x; p.z = z; p.y = 0; p.vy = 0; p.yaw = yaw; p.history = [];
    if (refill) { p.hp = p.maxHp; p.ammo = p.weapon.mag; p.reloadT = 0; }
    S.room = null;
  }

  function activateRoom(r) {
    r.active = true;
    if (r.boss) {
      if (r.prelude) { r.wave = 1; r.waveWait = WAVE_INTERVAL; spawnRegulars(r); G.hud.toast(`${r.name} · 접근하는 잔향을 정리하라`, '#ffe0a0'); }
      else openBoss(r);
      return;
    }
    if (r.waves) {
      r.wave = 1;
      r.waveWait = WAVE_INTERVAL;
    }
    spawnRegulars(r);
  }

  function spawnRegulars(r) {
    const p = S.player;
    const n = r.isSecret ? 4 : 3 + r.tier + Math.min(2, Math.floor(p.lvl / 3));
    const list = r.boss ? r.prelude : r.waves;
    const group = list?.[r.wave - 1];
    const types = group && group !== AUTO_WAVE ? Object.entries(group).flatMap(([type, count]) => Array(count).fill(type)) : Array.from({ length: n }, () => {
      const roll = Math.random();
      return r.tier <= 1 ? (roll < 0.65 ? 'noise' : 'echo') : roll < 0.45 ? 'noise' : roll < 0.75 ? 'echo' : 'glitch';
    });
    if (r.isSecret) types.push('ghost');
    const scale = 1 + r.tier * 0.14 + (p.lvl - 1) * 0.05;
    const used = [];
    for (const type of types) {
      const clearance = r.isSecret && type === 'ghost' ? 6 : 5;
      const [x, z] = G.world.freeSpot(r, p.x, p.z, clearance, used);
      used.push([x, z]);
      G.Actors.spawnEnemy(S, type, x, z, r, scale);
    }
  }

  function updateRooms(dt) {
    const counts = {};
    S.enemies.forEach((e) => { if (e.alive && e.room) counts[e.room.slot] = (counts[e.room.slot] || 0) + 1; });
    G.world.rooms.forEach((r) => {
      if (!r.active || r.cleared || counts[r.slot]) return;
      if (r.boss && !r.bossStarted) { advancePrelude(r, dt); return; }
      if (r.stage > 1 && !r.waves) return;
      if (r.waves && r.wave < r.waves.length) {
        r.waveWait -= dt;
        if (r.waveWait <= 0) {
          r.wave += 1;
          r.waveWait = WAVE_INTERVAL;
          spawnRegulars(r);
          G.hud.toast(`${r.name} · 증원 ${r.wave}/${r.waves.length}`, '#ffe0a0');
          G.audio.play('shift');
        }
        return;
      }
      r.cleared = true;
      const [x, z] = r.focus;
      S.pickups.push({ type: 'seal', room: r, x, z, y: 0, t: 0 });
      G.hud.toast(`${r.name} · 봉인 회수 가능`, '#fff6c8');
      G.audio.sfx('clear');
      S.mapDirty = true;
    });
  }

  // 보스방의 사전 습격이 끝나면 판을 연다.
  function advancePrelude(r, dt) {
    if (!r.prelude || r.preludeDone || S.duel || !S.player.alive) return;
    r.waveWait -= dt;
    if (r.waveWait > 0) return;
    if (r.wave < r.prelude.length) {
      r.wave += 1;
      r.waveWait = WAVE_INTERVAL;
      spawnRegulars(r);
      G.hud.toast(`${r.name} · 습격 ${r.wave}/${r.prelude.length}`, '#ffe0a0');
      G.audio.play('shift');
      return;
    }
    r.preludeDone = true;
    openBoss(r);
  }

  // 판(야바위 → 패 낚기)은 마지막 보스 앞에서만 연다. 다른 보스는 바로 나온다.
  function openBoss(r) {
    if (r.final) { startDuel(r, 0); return; }
    r.bossStarted = true;
    spawnBoss(r);
  }

  function startDuel(r, step) {
    S.duel = r;
    G.input.clear();
    if (S.choice) G.Rules.pick(S, Math.floor(Math.random() * 3));
    if (document.exitPointerLock && document.pointerLockElement) document.exitPointerLock();
    // 접속자 전원이 각자 같은 판을 하고, 이긴 사람 수만큼 보스 체력이 깎인다.
    if (step === 0) { r.duelPlayers = G.Net.humans(); r.duelCut = 0; }
    const cut = DUEL_BOSS_CUT * 100 / FINAL_DUELS.length / r.duelPlayers;
    const opts = {
      kind: FINAL_DUELS[step],
      level: BOSS_ORDER.length - 1,
      bossName: G.Bosses.name(r.boss),
      voice: S.stage >= VOICE_STAGE,
      rewardText: `보스 체력 -${Math.round(cut * 10) / 10}%${r.duelPlayers > 1 ? '(1인당)' : ''} · 분노 ${DUEL_BUFF}초`,
      penaltyText: `배터리 -${DUEL_HP_COST * 100 / FINAL_DUELS.length}%`,
    };
    G.Net.startDuel(opts, r.slot);
    G.Duel.start(opts, (result) => {
      if (result.won) duelWin(r);
      duelPersonal(result.won);
      if (step + 1 < FINAL_DUELS.length) startDuel(r, step + 1);
      else endDuel(r);
    });
  }

  function endDuel(r) {
    S.duel = null;
    G.input.clear();
    r.bossStarted = true;
    const boss = spawnBoss(r);
    if (r.duelCut) boss.hp = Math.max(1, Math.round(boss.hp - boss.maxHp * r.duelCut));
    G.input.lock();
  }

  // 판 승리 한 번마다 보스 체력을 깎는다. 보스가 아직 없으면 등장할 때 깎는다.
  function duelWin(r) {
    if (!r || !r.boss) return;
    const share = DUEL_BOSS_CUT / FINAL_DUELS.length / (r.duelPlayers || 1);
    if (S.boss && S.boss.room === r) S.boss.hp = Math.max(1, Math.round(S.boss.hp - S.boss.maxHp * share));
    else r.duelCut = (r.duelCut || 0) + share;
  }

  function duelPersonal(won) {
    const p = S.player;
    if (won) {
      p.buffs.fury = S.time + DUEL_BUFF;
      G.hud.toast('판 승리 · 보스의 체력이 깎였다', '#c8f0c0', true);
      return;
    }
    p.hp = Math.max(1, p.hp - p.maxHp * DUEL_HP_COST / FINAL_DUELS.length);
    p.lastHurt = S.time;
    S.hurt = 0.6;
    G.hud.toast('판 패배 · 배터리가 새어 나갔다', '#ff8a7a', true);
  }

  // ---- 접속자 전용 ----
  const DUEL_KINDS = ['shell', 'cards'];
  function clientDuel(raw, roomSlot) {
    if (S.duel || !raw || !DUEL_KINDS.includes(raw.kind)) return;
    const opts = {
      kind: raw.kind, level: clamp(Number(raw.level) | 0, 0, BOSS_ORDER.length - 1), bossName: String(raw.bossName || ''),
      voice: !!raw.voice, rewardText: String(raw.rewardText || ''), penaltyText: String(raw.penaltyText || ''),
    };
    S.duel = true;
    G.input.clear();
    if (document.exitPointerLock && document.pointerLockElement) document.exitPointerLock();
    G.Duel.start(opts, (result) => {
      S.duel = null;
      G.input.clear();
      duelPersonal(result.won);
      G.Net.sendDuelResult(roomSlot, result.won);
      G.input.lock();
    });
  }

  function clientStage(stage) {
    S.stage = stage;
    if (stage >= VOICE_STAGE) G.Voice.once('stage' + stage);
  }

  function clientWon() {
    if (S.won) return;
    S.won = true;
    S.endT = END_DELAY;
    G.Voice.say('exit');
  }

  function takeSeal(r) {
    if (r.restored) return;
    const p = S.player;
    r.restored = true;
    if (r.stage === 1) S.restored += 1;
    S.checkpoint = r;
    S.mapDirty = true;
    G.Actors.addXP(S, 40 + r.tier * 15);
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.35);
    if (r.memory.length) G.hud.sub(pick(r.memory));
    if (r.required) {
      if (r.stage === 1) S.routeSeals += 1;
      S.routeRoom = r.next;
      if (r.stage > 1) G.world.sealEntrance(r, false);
      G.world.openFrom(r);
      const notice = r.stage === 1 ? `봉인 ${S.routeSeals}/${GATE_NEED}` : '봉인 회수';
      G.hud.toast(`${notice} · ${r.next.name} 개방`, '#fff6c8');
      G.audio.play('shift');
      S.shift = 0.35;
    } else G.hud.toast(`${r.name} · 기록 회수`, '#fff6c8');
    if (r.isSecret) { S.items.add('출구 설계도'); G.hud.chat('system', '', '「출구 설계도」를 얻었다', '#ffb347'); }
  }

  function enterEncounter(r) {
    if (r.stage > S.stage) {
      S.stage = r.stage;
      if (!r.boss || r.prelude) G.audio.music(STAGE_MUSIC[r.stage]);
      if (S.stage >= VOICE_STAGE) G.Voice.once('stage' + S.stage);
    }
    S.checkpoint = r;
    S.player.history = [];
    S.player.hp = S.player.maxHp;
    S.player.ammo = S.player.weapon.mag;
    S.player.reloadT = 0;
    const [x, z] = r.spawn;
    G.world.sealEntrance(r, true);
    G.Net.teleportClients(x, z, r.entryYaw, true);
    S.orbs = [];
    S.mapDirty = true;
    S.shift = 0.5;
  }

  function spawnBoss(r) {
    if (S.rule) G.Rules.end(S);
    const [x, z] = r.mark;
    const boss = G.Bosses.spawn(S, r.boss, x, z, r);
    const track = r.stage === 1 ? r.boss : r.boss === 'shroud' ? 'veil-shroud' : STAGE_MUSIC[r.stage];
    G.audio.music(track);
    G.hud.banner(boss.def.name, r.cat);
    return boss;
  }

  function bossDown(enemy) {
    if (!S.boss || (enemy && S.boss !== enemy)) return;
    const room = S.boss.room;
    S.boss = null;
    G.audio.stopCue();
    S.orbs = [];
    if (room.stage === 1) { G.audio.music('ambience'); return; }
    room.cleared = true;
    G.world.sealEntrance(room, false);
    G.world.openFrom(room);
    S.routeRoom = room.next || null;
    S.enemies.forEach((e) => { if (e.room === room) e.alive = false; });
    S.mapDirty = true;
    if (!room.final) {
      G.hud.banner('격리문 개방', room.next.name);
      G.audio.sfx('clear');
      return;
    }
    S.won = true;
    S.endT = END_DELAY;
    if (S.rule) G.Rules.end(S);
    G.hud.banner('출구 완성', 'EXIT DESIGNED');
    G.Voice.say('exit');
    G.Net.won();
  }

  // ---- 카메라·렌더 ----
  function computeCamera(dt) {
    const p = S.player;
    const gait = p.gait || 0;
    const zoom = S.aiming ? 1 : 0;
    p.camZoom = (p.camZoom || 0) + (zoom - (p.camZoom || 0)) * smooth(13, dt);
    const bob = Math.cos(p.walk * 2) * gait * (1 - p.camZoom * 0.78) * 0.021;
    const head = [p.x, p.y + (rule('giant') ? GIANT_EYE : EYE_H) + bob, p.z];
    const pitch = clamp(p.pitch + S.recoil * 0.038, -1.41, 1.41);
    const cp = Math.cos(pitch);
    const dir = [Math.sin(p.yaw) * cp, Math.sin(pitch), Math.cos(p.yaw) * cp];
    let eye = head, minT = 0, dist = 0;
    if (!p.alive) {
      eye = [p.x - Math.sin(p.yaw) * 4, p.y + 6, p.z - Math.cos(p.yaw) * 4];
      S.cam = { eye, dir, target: [p.x, p.y, p.z], fov: FOV, minT: 0, tps: true, dist: 9, dead: true };
      return S.cam;
    }
    if (S.tps) {
      const back = TPS_BACK + (TPS_AIM_BACK - TPS_BACK) * p.camZoom;
      const right = [-Math.cos(p.yaw), 0, Math.sin(p.yaw)];
      const want = [head[0] - dir[0] * back + right[0] * TPS_SIDE, head[1] - dir[1] * back + 0.3, head[2] - dir[2] * back + right[2] * TPS_SIDE];
      const v = [want[0] - head[0], want[1] - head[1], want[2] - head[2]];
      const L = Math.hypot(v[0], v[1], v[2]);
      const n = v.map((c) => c / L);
      const clearance = Math.max(0.05, G.world.raycast(head[0], head[1], head[2], n[0], n[1], n[2], L) - 0.26);
      const previous = S.cam?.tps && !S.cam.dead ? S.cam.dist : clearance;
      dist = Math.min(clearance, previous + (clearance - previous) * smooth(15, dt));
      eye = [head[0] + n[0] * dist, head[1] + n[1] * dist, head[2] + n[2] * dist];
      minT = dist * 0.9;
    }
    const fovTarget = S.aiming ? (p.weapon.zoom || AIM_FOV) : FOV + clamp((gait - 0.9) * 13, 0, 7);
    S.fovNow += (fovTarget - S.fovNow) * smooth(10, dt);
    const roll = (p.lean || 0) + Math.sin(p.walk) * gait * (1 - p.camZoom) * 0.006;
    S.cam = { eye, dir, target: eye.map((coordinate, i) => coordinate + dir[i]), fov: S.fovNow, minT, tps: S.tps, dist, roll };
    return S.cam;
  }

  function attractCamera() {
    const [x, z] = G.world.lobby.focus;
    const t = S.time * 0.05, c = [x + 35, 0, z + 28];
    const eye = [c[0] + Math.sin(t) * 34, 24, c[2] + Math.cos(t) * 34];
    return { eye, dir: [0, 0, 1], target: c, fov: 60, minT: 0, tps: true, dist: 0 };
  }

  function render(dt) {
    const p = S.player;
    const cam = S.playing ? computeCamera(0) : attractCamera();
    const black = S.playing && rule('blackout');
    const room = S.room;
    const fog = black ? [0.012, 0.012, 0.014] : (room?.fog || [0.1, 0.105, 0.098]);
    const fogDist = !S.playing ? 110 : black ? 15 : (room?.fogDist || 52);
    const amb = black ? 0.05 : (room?.amb ?? 0.8);
    const env = S.exposure || (S.exposure = { fog: fog.slice(), fogDist, amb });
    const blend = smooth(5, dt);
    for (let i = 0; i < 3; i++) env.fog[i] += (fog[i] - env.fog[i]) * blend;
    env.fogDist += (fogDist - env.fogDist) * blend;
    env.amb += (amb - env.amb) * blend;
    const light = p ? [p.x + cam.dir[0] * 2, p.y + 1.5 + cam.dir[1] * 2, p.z + cam.dir[2] * 2] : cam.target;
    G.gfx.begin(cam, {
      fog: env.fog,
      fogDist: env.fogDist,
      amb: env.amb,
      light,
      lightOn: black ? 1.4 : 0.35,
      flash: S.flashT > 0 ? 1 : 0,
    });
    G.Draw.scene(S, cam);
    const finalTarget = S.boss?.type === 'origin' ? S.boss.phase : 0;
    S.finalGrade = (S.finalGrade || 0) + (finalTarget - (S.finalGrade || 0)) * smooth(3.5, dt);
    G.gfx.end({
      time: S.time,
      hurt: S.hurt,
      mirror: S.playing && rule('mirror') ? 1 : 0,
      mono: S.playing && rule('lowres') ? 1 : p && !p.alive ? 0.8 : 0,
      shift: S.shift,
      finalGrade: S.finalGrade,
    });
    if (S.playing) G.hud.update(S, dt);
  }

  function worldChat(dt) {
    S.worldChatT -= dt;
    if (S.worldChatT > 0) return;
    S.worldChatT = rnd(WORLD_CHAT_GAP[0], WORLD_CHAT_GAP[1]);
    G.hud.chat('world', pick(G.CONTENT.worldNames), pick(G.CONTENT.worldLines), '#9ab');
  }

  function updateWorld(dt) {
    const eScale = (S.time < (S.slowUntil || 0) ? 0.3 : 1) * (rule('slowmo') ? 0.45 : 1);
    G.Actors.updateBots(S, dt);
    G.Actors.updateEnemies(S, dt * eScale);
    G.Actors.updateOrbs(S, dt * eScale);
    G.Actors.updatePickups(S, dt);
    updateRooms(dt);
    G.Rules.update(S, dt);
    worldChat(dt);
  }

  function update(dt) {
    S.time += dt;
    G.input.poll();
    updatePlayer(dt);
    G.Actors.updateFx(S, dt);
    if (S.range) G.Range.update(S, dt);
    else if (!G.Net.isClient() && !S.pvp) updateWorld(dt); // 접속자는 방장이 보낸 세계를 그대로 쓴다. 대전에는 적이 없다
    if (!S.range) G.Voice.update(S, dt);
    S.hurt = Math.max(0, S.hurt - dt * 1.4);
    S.shift = Math.max(0, S.shift - dt * 1.3);
    S.recoil = Math.max(0, S.recoil - dt * 1.5);
    S.flashT -= dt; S.hitMarkT -= dt; S.visitorFlash -= dt;
    if (S.won && !S.endingShown) { S.endT -= dt; if (S.endT <= 0) showEnding(); }
  }

  function frame(ts) {
    const dt = Math.min(0.05, Math.max(0, (ts - last) / 1000));
    last = ts;
    try {
      if (S.playing && !S.range && G.Net.active()) G.Net.tick(S, dt);
      if (!S.playing) S.time += dt;
      else if (!S.paused && !S.duel) update(dt);
      render(dt);
    } catch (err) {
      if (!crashed) { crashed = true; console.error(err); G.hud.toast('오류가 발생했습니다. 새로고침해 주세요.', '#ff6b5a', true); }
    }
    requestAnimationFrame(frame);
  }

  // ---- 메뉴·결말 ----
  function showEnding() {
    S.endingShown = true;
    S.paused = true;
    const end = G.Rules.ending(S), p = S.player, saved = loadSave();
    const found = saved.endings.includes(end.id) ? saved.endings : saved.endings.concat([end.id]);
    writeSave({ ...saved, endings: found, bestLevel: Math.max(saved.bestLevel, p.lvl) });
    if (document.exitPointerLock) document.exitPointerLock();
    G.audio.music('ending');
    const list = G.GAME_DATA.endings.map((e) => `<li class="${found.includes(e.id) ? 'got' : ''}${e.id === end.id ? ' now' : ''}"><b>${e.num}</b> ${found.includes(e.id) ? esc(e.name) : '???'}<small>${esc(G.CONTENT.endingHints[e.id])}</small></li>`).join('');
    const st = S.stats;
    $('ending').innerHTML = `<div class="end-in"><small>ENDING ${end.num} · REC STOP</small><h2>${esc(end.name)}</h2>
      <p class="story">${esc(end.story)}</p>
      <div class="stats">점수 ${(p.score || 0).toLocaleString()} · 내 처치 ${p.kills || 0} · LV ${p.lvl} · 전체 처치 ${S.kills} · 복원 ${S.restored} · 자유 ${st.freedom} · 명료 ${st.clarity} · 연결 ${st.bond}</div>
      <ul>${list}</ul>
      <div class="btns"><button id="endStay">계속 탐험</button><button id="endNew" class="primary">새 건물에서 다시</button></div></div>`;
    $('ending').hidden = false;
    $('endStay').addEventListener('click', () => { $('ending').hidden = true; S.paused = false; G.audio.music('ambience'); G.input.lock(); });
    $('endNew').addEventListener('click', () => window.location.reload());
  }

  function onLockChange(locked) {
    if (S.range) { if (!locked) endRange(); return; }
    if (!S.playing || G.input.touch || S.endingShown || S.duel || S.netLost) return;
    S.paused = !locked && !G.Net.hasPeers() && !G.Net.isClient();
    if (!locked) G.Voice.stop();
    $('pause').hidden = locked;
  }

  function boot() {
    const canvas = $('view');
    try {
      G.gfx.init(canvas);
    } catch (err) {
      $('menu').innerHTML = `<div class="menu-in"><h1>NEW방 <span>ONLINE</span></h1><p>${esc(err.message)}</p><p>Chrome · Edge · Safari 최신 버전에서 열어 주세요.</p></div>`;
      return;
    }
    G.Bosses.loadTextures();
    G.hud.init();
    G.audio.init();
    G.input.init(canvas);
    G.input.onLockChange = onLockChange;
    S = newState((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
    G.Characters.buildMenu((charId) => G.Lobby.chooseGun(charId), loadSave());
    G.Lobby.init({
      reseed: (seed) => { S = newState(seed); },
      enter: startGame,
      range: startRange,
      helsiUnlocked: () => loadSave().helsi,
      unlockHelsi: () => writeSave({ ...loadSave(), helsi: true }),
      clientStart: (msg) => launch(msg.charId, msg, chosenGun, chosenSkill, false),
      lost: () => {
        S.netLost = true;
        S.paused = true;
        $('pause').dataset.normal = $('pause').dataset.normal || $('pause').innerHTML;
        $('pause').innerHTML = '<div>방장과의 연결이 끊겼습니다<small>방장 화면이 다시 열리면 이어집니다 · 오래 걸리면 새로고침</small></div>';
        $('pause').hidden = false;
      },
      back: () => {
        S.netLost = false;
        S.paused = false;
        if ($('pause').dataset.normal) $('pause').innerHTML = $('pause').dataset.normal;
        $('pause').hidden = G.input.locked || G.input.touch;
      },
    });
    $('pause').addEventListener('click', () => G.input.lock());
    $('rangeExit').addEventListener('click', endRange);
    requestAnimationFrame(frame);
  }

  G.Main = {
    GATE_NEED, NORMAL_RES, takeSeal, bossDown, playerDown, state: () => S,
    remoteRoom, teleportSelf, duelWin, clientDuel, clientStage, clientWon,
  };
  boot();
})(window.G);
