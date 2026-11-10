'use strict';
window.G = window.G || {};
// 여럿이 같은 건물에 접속한다. 방장 브라우저가 적·보스·방·규칙을 계산해 스냅숏을 보내고,
// 각 접속자는 자기 인물만 직접 움직이며 위치·명중·능력을 방장에게 보낸다. 연결은 PeerJS(WebRTC).
(function (G) {
  const PEER_SRC = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
  const ID_PREFIX = 'newroom-online-tape06-';
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', CODE_LEN = 5, OPEN_TRIES = 4, JOIN_TIMEOUT = 9000;
  // 탭을 그냥 닫으면 WebRTC가 끊김을 알리지 않을 때가 있어, 이 시간 동안 소식이 없으면 끊긴 것으로 본다.
  const SILENCE_MS = 20000, WATCH_MS = 1000;
  const SNAP_GAP = 1 / 15, STATE_GAP = 1 / 20, MAX_PLAYERS = 6, PICKUP_RADIUS = 1.4, LERP = 14, LOW_RES = 72;
  const r2 = (v) => Math.round(v * 100) / 100;
  const smooth = (rate, dt) => 1 - Math.exp(-rate * dt);
  const validChar = (c) => Number.isInteger(c) && c >= 0 && c < MAX_PLAYERS;
  const num = (v, fallback = 0) => (Number.isFinite(v) ? v : fallback);
  const plainName = (rp) => rp.name.replace(' · 접속', '');

  const PVP_HIT_MAX = 60, PVP_HITS_PER_MSG = 32;
  let role = 'solo', mode = 'coop', peer = null, code = '', hostConn = null, myId = '';
  let pvpHits = [];
  let snapT = 0, stateT = 0, nextEnemyId = 1, lastSnapAt = 0, lostSent = false, closed = false;
  const peers = new Map(); // 방장: peerId → { conn, rp, pendingChar }
  let hits = [], skills = [];
  let enemyMap = new Map(), lastRule = null, lastBossPhase = 0, ui = {};

  // ---- 연결 ----
  function loadPeer() {
    if (window.Peer) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = PEER_SRC;
      s.onload = () => (window.Peer ? resolve() : reject(new Error('연결 모듈이 비어 있습니다.')));
      s.onerror = () => reject(new Error('연결 모듈을 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.'));
      document.head.append(s);
    });
  }

  function makeCode() {
    return Array.from({ length: CODE_LEN }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  }

  function openPeer(id) {
    return new Promise((resolve, reject) => {
      const p = id ? new window.Peer(id) : new window.Peer();
      const fail = (err) => { p.destroy(); reject(err); };
      p.once('open', () => { p.off('error', fail); resolve(p); });
      p.once('error', fail);
    });
  }

  function watchPeer(p) {
    p.on('error', (err) => console.warn('연결 오류:', err.type || err));
    p.on('disconnected', () => { if (!p.destroyed) p.reconnect(); });
  }

  function send(conn, msg) {
    if (!conn || !conn.open) return;
    try { conn.send(msg); } catch (err) { console.warn('전송 실패:', err); }
  }

  function broadcast(msg) { peers.forEach((p) => { if (p.rp) send(p.conn, msg); }); }

  // ---- 방장 ----
  function takenChars() {
    const S = G.Main.state();
    const list = [];
    if (S.player) list.push(S.player.charId);
    peers.forEach((p) => { if (p.rp) list.push(p.rp.charId); else if (validChar(p.pendingChar)) list.push(p.pendingChar); });
    return list;
  }

  function onHostConnection(conn) {
    conn.on('open', () => {
      if (peers.size >= MAX_PLAYERS - 1) { send(conn, { t: 'full' }); setTimeout(() => conn.close(), 400); return; }
      peers.set(conn.peer, { conn, rp: null, pendingChar: null, seen: performance.now() });
      send(conn, { t: 'welcome', seed: G.Main.state().seed, taken: takenChars(), mode });
      refreshTag();
    });
    conn.on('data', (msg) => {
      try { onHostData(conn.peer, msg); } catch (err) { console.warn('접속자 메시지 처리 실패:', err); }
    });
    conn.on('close', () => dropPeer(conn.peer));
    conn.on('error', (err) => { console.warn('접속자 연결 오류:', err); dropPeer(conn.peer); });
  }

  function admit(peerId) {
    const entry = peers.get(peerId), S = G.Main.state();
    if (!entry || entry.rp || !S.playing || S.range || !validChar(entry.pendingChar)) return;
    const charId = entry.pendingChar, p = S.player;
    const name = `${G.Actors.charName(charId)} · 접속`;
    const rp = Object.assign(G.Actors.createBot(charId, 0, p.x + 1, p.z + 1), {
      remote: true, peerId, name, lvl: 1, duel: false, inv: 2, weapon: G.Actors.makeWeapon(entry.pendingGun || 'pistol', 0),
    });
    S.bots = S.bots.concat([rp]);
    entry.rp = rp;
    entry.pendingChar = null;
    const at = S.checkpoint || G.world.lobby;
    const [x, z] = mode === 'pvp' ? G.Pvp.spawnPoint(S, true) : S.stage > 1 ? at.spawn : [p.x, p.z];
    rp.x = x; rp.z = z;
    if (mode === 'pvp') G.Pvp.join(peerId, G.Actors.charName(charId), charId);
    send(entry.conn, { t: 'start', charId, x, z, yaw: p.yaw, music: G.audio.current() });
    G.hud.chat('system', '', `${plainName(rp)} 님이 접속했습니다`, G.CONTENT.css[charId]);
    refreshTag();
  }

  function dropPeer(peerId) {
    const entry = peers.get(peerId);
    if (!entry) return;
    peers.delete(peerId);
    const S = G.Main.state(), rp = entry.rp;
    if (rp) {
      S.bots = S.bots.filter((b) => b !== rp);
      if (mode === 'pvp') G.Pvp.leave(peerId);
      G.hud.chat('system', '', `${plainName(rp)} 님의 연결이 끊겼습니다`, '#bbb');
    }
    refreshTag();
  }

  function onHostData(peerId, msg) {
    const entry = peers.get(peerId), S = G.Main.state();
    if (!entry || !msg || typeof msg !== 'object') return;
    entry.seen = performance.now();
    if (msg.t === 'join') {
      if (!validChar(msg.charId) || takenChars().includes(msg.charId)) { send(entry.conn, { t: 'taken', taken: takenChars() }); return; }
      entry.pendingChar = msg.charId;
      entry.pendingGun = G.CONTENT.weapons[msg.gun] ? msg.gun : 'pistol';
      admit(peerId);
      return;
    }
    const rp = entry.rp;
    if (!rp) return;
    if (msg.t === 's') applyRemoteState(S, rp, msg);
    else if (msg.t === 'dr' && msg.won) G.Main.duelWin(G.world.rooms[msg.room]);
    else if (msg.t === 'pd' && mode === 'pvp') G.Pvp.kill(S, String(msg.by || ''), peerId);
  }

  function applyRemoteState(S, rp, m) {
    rp.x = num(m.x, rp.x); rp.y = num(m.y, rp.y); rp.z = num(m.z, rp.z); rp.yaw = num(m.yw, rp.yaw);
    rp.alive = !!m.a; rp.hp = num(m.hp, rp.hp); rp.maxHp = Math.max(1, num(m.mh, rp.maxHp));
    rp.lvl = num(m.lv, 1); rp.walk = num(m.w, 0); rp.gunFlash = m.f ? 0.06 : 0; rp.duel = !!m.d; rp.inv = num(m.inv, 0);
    if (typeof m.b === 'string' && G.CONTENT.weapons[m.b] && rp.weapon.base !== m.b) rp.weapon = G.Actors.makeWeapon(m.b, 0);
    (Array.isArray(m.h) ? m.h : []).slice(0, 64).forEach((h) => {
      const e = Array.isArray(h) && S.enemies.find((x) => x.id === h[0] && x.alive);
      if (!e || !Number.isFinite(h[1])) return;
      G.Actors.hurtEnemy(S, e, Math.min(h[1], 5000), !!h[2], 'remote');
      if (!e.alive && e.def.kind !== 'anchor') send(peers.get(rp.peerId)?.conn, { t: 'mk', pts: e.def.xp * G.Actors.SCORE_PER_XP }); // 처치와 점수는 쏜 사람에게
    });
    (Array.isArray(m.k) ? m.k : []).slice(0, 4).forEach((k) => {
      if (k && validChar(k.c)) G.Actors.skillWorld(S, k.c, { x: num(k.x), z: num(k.z) }, num(k.m, 1));
    });
    (Array.isArray(m.tr) ? m.tr : []).slice(0, 24).forEach((t) => S.tracers.push(decodeTracer(t, rp.peerId)));
    if (mode !== 'pvp') return;
    (Array.isArray(m.ph) ? m.ph : []).slice(0, PVP_HITS_PER_MSG).forEach((h) => {
      if (Array.isArray(h)) routePvpHit(S, rp.peerId, String(h[0]), h[1]);
    });
  }

  // 대전: 쏜 사람이 알린 명중을 맞은 사람에게 전달한다. 'h'는 방장 자신.
  function routePvpHit(S, attackerId, targetId, dmg) {
    if (!Number.isFinite(dmg) || dmg <= 0 || attackerId === targetId) return;
    const amount = Math.min(PVP_HIT_MAX, dmg);
    if (targetId === 'h') { G.Pvp.hurt(S, amount, attackerId); return; }
    const target = peers.get(targetId);
    if (target?.rp?.alive && !(target.rp.inv > 0)) send(target.conn, { t: 'hurt', d: r2(amount), by: attackerId, pvp: 1 });
  }

  // 화면이 가려져 프레임이 멈춰도 돌아가도록 타이머로 끊김을 살핀다.
  function watchSilence() {
    const now = performance.now();
    if (role === 'host') {
      peers.forEach(({ conn, seen }, id) => {
        if (now - seen < SILENCE_MS) return;
        dropPeer(id);
        conn.close();
      });
    } else if (role === 'client' && lastSnapAt && !closed) {
      const silent = now - lastSnapAt > SILENCE_MS;
      if (silent && !lostSent) { lostSent = true; if (ui.onLost) ui.onLost(); }
      if (!silent && lostSent) { lostSent = false; if (ui.onBack) ui.onBack(); }
    }
  }

  function hostTick(S, dt) {
    peers.forEach(({ rp }) => {
      if (!rp) return;
      if (!S.duel && mode !== 'pvp') G.Main.remoteRoom(rp);
      if (rp.alive) remotePickups(S, rp);
    });
    snapT -= dt;
    if (snapT > 0) return;
    snapT = SNAP_GAP;
    if (Net.hasPeers()) broadcast(snapshot(S));
  }

  function remotePickups(S, rp) {
    const entry = peers.get(rp.peerId);
    S.pickups = S.pickups.filter((pk) => {
      if (Math.hypot(rp.x - pk.x, rp.z - pk.z) > PICKUP_RADIUS || Math.abs(rp.y - pk.y) > 2) return true;
      if (pk.type === 'seal') G.Main.takeSeal(pk.room);
      else if (pk.type === 'loot') send(entry.conn, { t: 'loot', w: { base: pk.w.base, rarity: pk.w.rarity, name: pk.w.name } });
      else send(entry.conn, { t: 'heal' });
      return false;
    });
  }

  // ---- 스냅숏 ----
  function encodeEnemy(S, e) {
    if (!e.id) e.id = nextEnemyId++;
    const o = { i: e.id, k: e.type, x: r2(e.x), y: r2(e.y), z: r2(e.z), yw: r2(e.yaw), hp: Math.round(e.hp), mh: Math.round(e.maxHp), f: e.flash > 0 ? 1 : 0, rv: S.time < e.revUntil ? 1 : 0, b: r2(e.bob || 0) };
    const d = e.def;
    if (d.kind === 'anchor') o.d = { kind: d.kind, name: d.name, size: d.size, col: d.col };
    if (d.kind !== 'boss') return o;
    o.d = { kind: d.kind, name: d.name, size: d.size, ratio: d.ratio, col: d.col, tint: d.tint };
    return Object.assign(o, {
      ph: e.phase, sp: e.sprite || '', st: r2(e.stretch), ws: r2(e.widthScale), ln: r2(e.lean), ag: r2(e.age),
      wd: e.wind ? r2(1 - e.wind.time / e.wind.total) : 0, sw: e.sweep ? 1 : 0, tl: e.tell || '', ob: e.objective || '',
      bf: r2(e.blockFlash || 0), pr: G.Bosses.isProtected(e) ? 1 : 0,
      zo: e.zones.map((z) => ({ kind: z.kind, x: r2(z.x), z: r2(z.z), radius: r2(z.radius || 0), dx: r2(z.dx || 0), dz: r2(z.dz || 0), length: r2(z.length || 0), width: r2(z.width || 0), yaw: r2(z.yaw || 0) })),
      wv: e.waves.map((w) => [r2(w.x), r2(w.z), r2(w.radius)]),
      an: (e.anchors || []).map((a) => { if (!a.id) a.id = nextEnemyId++; return a.id; }),
    });
  }

  function encodeActor(a, id, name) {
    return { i: id, c: a.charId, n: name || a.name, x: r2(a.x), y: r2(a.y), z: r2(a.z), yw: r2(a.yaw), a: a.alive ? 1 : 0, hp: Math.round(a.hp), mh: Math.round(a.maxHp), w: r2(a.walk || 0), b: a.weapon?.base || 'pistol', f: a.gunFlash > 0 ? 1 : 0, inv: a.inv > 0 ? 1 : 0 };
  }

  function encodeTracer(t) { return [t.a.map(r2), t.b.map(r2), t.col || null, t.beam ? 1 : 0, t.src || '', t.lv || 1]; }

  function decodeTracer(t, src) {
    const ok = Array.isArray(t) && Array.isArray(t[0]) && Array.isArray(t[1]);
    const a = ok ? t[0].slice(0, 3).map(Number) : [0, 0, 0], b = ok ? t[1].slice(0, 3).map(Number) : [0, 0, 0];
    const lv = ok ? Math.max(1, Math.min(3, Number(t[5]) | 0)) : 1;
    return { a, b, t: (ok && t[3] ? 0.09 : 0.06) * (1 + 0.35 * (lv - 1)), col: ok && Array.isArray(t[2]) ? t[2] : null, beam: !!(ok && t[3]), src: src || (ok && t[4]) || '', sent: false, lv };
  }

  function snapshot(S) {
    const w = G.world, p = S.player;
    const fresh = S.tracers.filter((t) => !t.sent);
    fresh.forEach((t) => { t.sent = true; });
    const route = S.routeRoom;
    if (S.boss && !S.boss.id) S.boss.id = nextEnemyId++;
    const hostActor = encodeActor(Object.assign({}, p, { gunFlash: S.flashT }), 'h', `${G.Actors.charName(p.charId)} · 방장`);
    return {
      t: 'snap', st: S.stage, rs: S.routeSeals, rest: S.restored, route: route ? route.slot : -1, rw: route?.wave || 0,
      cp: S.checkpoint ? S.checkpoint.slot : 0, boss: S.boss ? S.boss.id : 0,
      rule: S.rule ? { id: S.rule.id, name: S.rule.name, left: r2(S.rule.left) } : null,
      won: S.won ? 1 : 0, kills: S.kills, stats: S.stats, items: [...S.items], shift: r2(S.shift),
      rooms: w.rooms.map((r) => (r.visited ? 1 : 0) | (r.active ? 2 : 0) | (r.cleared ? 4 : 0) | (r.restored ? 8 : 0)),
      gates: w.gates.filter((i) => w.gateMask[i]),
      en: S.enemies.filter((e) => e.alive).map((e) => encodeEnemy(S, e)),
      ac: [hostActor].concat(S.bots.map((b, i) => encodeActor(b, b.remote ? b.peerId : `b${i}`))),
      orbs: S.orbs.map((o) => [r2(o.x), r2(o.y), r2(o.z), r2(o.vx), r2(o.vy), r2(o.vz)]),
      pk: S.pickups.map((pk) => [pk.type, r2(pk.x), r2(pk.z), pk.room ? pk.room.slot : -1, pk.w?.rgb || null]),
      tr: fresh.map(encodeTracer),
      sc: mode === 'pvp' ? G.Pvp.table() : null,
    };
  }

  // ---- 접속자 ----
  function onClientData(msg) {
    const S = G.Main.state();
    if (!msg || typeof msg !== 'object') return;
    switch (msg.t) {
      case 'welcome':
        mode = msg.mode === 'pvp' ? 'pvp' : 'coop';
        if (ui.onWelcome) ui.onWelcome(Number(msg.seed) >>> 0, Array.isArray(msg.taken) ? msg.taken : []); break;
      case 'taken': if (ui.onTaken) ui.onTaken(Array.isArray(msg.taken) ? msg.taken : []); break;
      case 'full': if (ui.onStatus) ui.onStatus('방이 가득 찼습니다 (최대 6명).'); break;
      case 'start': if (ui.onStart) ui.onStart(msg); break;
      case 'snap': lastSnapAt = performance.now(); if (S.playing) applySnapshot(S, msg); break;
      case 'hurt':
        if (!S.playing || S.duel) break;
        if (msg.pvp) G.Pvp.hurt(S, num(msg.d), String(msg.by || ''));
        else G.Actors.hurtFriendly(S, S.player, num(msg.d));
        break;
      case 'xp': if (S.playing) G.Actors.addXP(S, num(msg.n)); break;
      case 'loot': if (S.playing && msg.w && G.CONTENT.weapons[msg.w.base]) G.Actors.takeLoot(S, G.Actors.makeWeapon(msg.w.base, Math.max(0, Math.min(3, msg.w.rarity | 0)), String(msg.w.name || '').split(' ')[0])); break;
      case 'mk': if (S.playing) G.Actors.creditKill(S, num(msg.pts)); break;
      case 'heal': if (S.playing) S.player.hp = Math.min(S.player.maxHp, S.player.hp + 30); break;
      case 'tp': if (S.playing) G.Main.teleportSelf(num(msg.x), num(msg.z), num(msg.yaw), !!msg.refill); break;
      case 'duel': if (S.playing) G.Main.clientDuel(msg.opts, msg.room); break;
      case 'won': if (S.playing) G.Main.clientWon(); break;
      case 'mu': G.audio.music(String(msg.n)); break;
      case 'cue': if (msg.n) G.audio.cue(String(msg.n)); else G.audio.stopCue(); break;
      case 'sfx': G.audio.play(String(msg.n)); break;
      case 'hud':
        if (S.playing && ['toast', 'banner', 'sub', 'chat', 'rule'].includes(msg.k) && Array.isArray(msg.a)) {
          G.hud[msg.k](...msg.a.slice(0, 4).map((v) => (v == null ? v : String(v))));
        }
        break;
      default: break;
    }
  }

  function applySnapshot(S, m) {
    const w = G.world;
    if (num(m.st) > S.stage) G.Main.clientStage(num(m.st));
    S.routeSeals = num(m.rs); S.restored = num(m.rest); S.kills = num(m.kills); S.shift = Math.max(S.shift, num(m.shift));
    if (m.stats && typeof m.stats === 'object') S.stats = { freedom: num(m.stats.freedom), clarity: num(m.stats.clarity), bond: num(m.stats.bond) };
    S.items = new Set(Array.isArray(m.items) ? m.items.map(String) : []);
    S.routeRoom = w.rooms[m.route] || null;
    if (S.routeRoom) S.routeRoom.wave = num(m.rw);
    S.checkpoint = w.rooms[m.cp] || w.lobby;
    (Array.isArray(m.rooms) ? m.rooms : []).forEach((bits, i) => {
      const r = w.rooms[i];
      if (!r) return;
      const next = { visited: !!(bits & 1), active: !!(bits & 2), cleared: !!(bits & 4), restored: !!(bits & 8) };
      if (next.restored !== r.restored || next.visited !== r.visited) S.mapDirty = true;
      Object.assign(r, next);
    });
    if (w.setClosedGates(Array.isArray(m.gates) ? m.gates : [])) S.mapDirty = true;
    applyRule(S, m.rule);
    applyEnemies(S, Array.isArray(m.en) ? m.en : [], num(m.boss));
    applyActors(S, Array.isArray(m.ac) ? m.ac : []);
    S.orbs = (Array.isArray(m.orbs) ? m.orbs : []).map(([x, y, z, vx, vy, vz]) => ({ x, y, z, vx, vy, vz, life: 1 }));
    S.pickups = (Array.isArray(m.pk) ? m.pk : []).map(([type, x, z, slot, rgb], i) => ({ type, x, z, y: 0, t: S.pickups[i]?.t || 0, room: w.rooms[slot] || w.lobby, w: { rgb: rgb || [0.85, 0.84, 0.78] } }));
    (Array.isArray(m.tr) ? m.tr : []).forEach((t) => { const d = decodeTracer(t); if (d.src !== myId) S.tracers.push(Object.assign(d, { sent: true })); });
    if (Array.isArray(m.sc)) {
      S.scores = m.sc.filter(Array.isArray).slice(0, MAX_PLAYERS).map((r) => [String(r[0]), String(r[1]), num(r[2]), num(r[3]), num(r[4])]);
    }
    if (m.won && !S.won) G.Main.clientWon();
  }

  function applyRule(S, rule) {
    const id = rule ? String(rule.id) : null;
    if (id !== lastRule) {
      if (lastRule === 'lowres') G.gfx.setLowRes(G.Main.NORMAL_RES);
      if (id === 'lowres') G.gfx.setLowRes(LOW_RES);
      lastRule = id;
    }
    S.rule = rule ? { id, name: String(rule.name), left: num(rule.left) } : null;
  }

  function applyEnemies(S, list, bossId) {
    const seen = new Map();
    list.forEach((o) => {
      const def = o.d ? Object.assign({}, o.d) : G.Actors.TYPES[o.k];
      if (!def || !Number.isFinite(o.x)) return;
      const e = enemyMap.get(o.i) || { id: o.i, net: true, type: o.k, x: o.x, y: o.y, z: o.z, alive: true, zones: [], waves: [], anchors: [], walk: 0, stretch: 1, widthScale: 1, lean: 0, age: 0, phase: 1 };
      Object.assign(e, {
        def, tx: o.x, ty: o.y, tz: o.z, yaw: o.yw, hp: o.hp, maxHp: o.mh, flash: o.f ? 0.08 : 0,
        revUntil: o.rv ? S.time + 0.3 : 0, bob: o.b, r: Math.min(0.9, (def.size || 1) * 0.42),
      });
      if (def.kind === 'boss') {
        Object.assign(e, {
          phase: o.ph, sprite: o.sp || null, stretch: o.st, widthScale: o.ws, lean: o.ln, age: o.ag,
          wind: o.wd > 0 ? { time: 1 - o.wd, total: 1 } : null, sweep: o.sw ? {} : null, tell: o.tl, objective: o.ob,
          blockFlash: o.bf, prot: !!o.pr, zones: Array.isArray(o.zo) ? o.zo : [], waves: (o.wv || []).map(([x, z, radius]) => ({ x, z, radius })), anchorIds: o.an || [],
        });
      }
      seen.set(o.i, e);
    });
    enemyMap.forEach((e, id) => {
      if (seen.has(id)) return;
      G.Actors.burst(S, e.x, e.y + (e.def.size || 1) * 0.55, e.z, e.def.col, e.def.kind === 'boss' ? 56 : 14, 5);
      G.audio.sfx('kill');
    });
    seen.forEach((e) => { if (e.anchorIds) e.anchors = e.anchorIds.map((id) => seen.get(id)).filter(Boolean); });
    enemyMap = seen;
    S.enemies = [...seen.values()];
    S.boss = seen.get(bossId) || null;
    const phase = S.boss?.type === 'origin' ? S.boss.phase : 0;
    if (phase === 2 && lastBossPhase !== 2) G.Voice.say('awake');
    lastBossPhase = phase;
  }

  function applyActors(S, list) {
    const old = new Map(S.bots.map((b) => [b.netId, b]));
    S.bots = list.filter((o) => o.i !== myId && Number.isInteger(o.c) && Number.isFinite(o.x)).map((o) => {
      const b = old.get(o.i) || { netId: o.i, x: o.x, y: o.y, z: o.z, r: 0.32, weapon: { base: 'pistol' }, slot: 0 };
      Object.assign(b, {
        charId: o.c, name: String(o.n || G.Actors.charName(o.c)), tx: o.x, ty: o.y, tz: o.z, yaw: o.yw, alive: !!o.a,
        hp: o.hp, maxHp: Math.max(1, o.mh), walk: o.w, gunFlash: o.f ? 0.06 : 0, inv: o.inv ? 0.2 : 0,
      });
      if (b.weapon.base !== o.b && G.CONTENT.weapons[o.b]) b.weapon = G.Actors.makeWeapon(o.b, 0);
      return b;
    });
  }

  // 스냅숏 사이를 부드럽게 잇고, 자기 상태를 방장에게 보낸다.
  function clientTick(S, dt) {
    const k = smooth(LERP, dt);
    const ease = (a) => {
      if (a.tx === undefined) return;
      a.x += (a.tx - a.x) * k; a.y += (a.ty - a.y) * k; a.z += (a.tz - a.z) * k;
    };
    S.enemies.forEach(ease);
    S.bots.forEach(ease);
    S.orbs.forEach((o) => { o.x += o.vx * dt; o.y += o.vy * dt; o.z += o.vz * dt; });
    S.pickups.forEach((pk) => { pk.t += dt; });
    stateT -= dt;
    if (stateT > 0 || !S.player) return;
    stateT = STATE_GAP;
    const p = S.player;
    const mine = S.tracers.filter((t) => !t.sent && !t.src);
    mine.forEach((t) => { t.sent = true; });
    send(hostConn, {
      t: 's', x: r2(p.x), y: r2(p.y), z: r2(p.z), yw: r2(p.yaw), a: p.alive ? 1 : 0, hp: Math.round(p.hp), mh: p.maxHp, lv: p.lvl,
      w: r2(p.walk), b: p.weapon.base, f: S.flashT > 0 ? 1 : 0, d: S.duel ? 1 : 0, inv: r2(p.inv), h: hits, k: skills, tr: mine.map(encodeTracer), ph: pvpHits,
    });
    hits = [];
    skills = [];
    pvpHits = [];
  }

  function refreshTag() {
    const tag = document.getElementById('netTag');
    if (!tag) return;
    tag.hidden = role === 'solo';
    const kind = mode === 'pvp' ? '대전 ' : '';
    tag.textContent = role === 'host' ? `${kind}방 ${code} · ${Net.humans()}명` : `${kind}방 ${code}`;
  }

  const Net = {
    isHost: () => role === 'host',
    isClient: () => role === 'client',
    active: () => role !== 'solo',
    code: () => code,
    mode: () => mode,
    myId: () => (role === 'host' ? 'h' : myId),
    hasPeers: () => [...peers.values()].some((p) => p.rp),
    humans: () => 1 + [...peers.values()].filter((p) => p.rp).length,
    setUI(handlers) { ui = handlers || {}; },

    async host(wanted) {
      await loadPeer();
      mode = wanted === 'pvp' ? 'pvp' : 'coop';
      let lastErr = null;
      for (let i = 0; i < OPEN_TRIES && !peer; i++) {
        const tryCode = makeCode();
        try {
          peer = await openPeer(ID_PREFIX + tryCode);
          code = tryCode;
        } catch (err) {
          lastErr = err;
          if (err.type !== 'unavailable-id') break;
        }
      }
      if (!peer) throw new Error(lastErr?.type === 'browser-incompatible' ? '이 브라우저는 실시간 연결을 지원하지 않습니다.' : '방을 열지 못했습니다. 잠시 뒤 다시 시도해 주세요.');
      role = 'host';
      watchPeer(peer);
      peer.on('connection', onHostConnection);
      G.audio.relay = (kind, name) => broadcast(kind === 'music' ? { t: 'mu', n: name } : kind === 'cue' ? { t: 'cue', n: name || '' } : { t: 'sfx', n: name });
      G.hud.relay = (kind, args) => broadcast({ t: 'hud', k: kind, a: args });
      return code;
    },

    async join(rawCode) {
      const wanted = String(rawCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (wanted.length !== CODE_LEN) throw new Error(`방 코드는 ${CODE_LEN}자리입니다.`);
      await loadPeer();
      try { peer = await openPeer(null); } catch (err) { throw new Error('연결 서버에 접속하지 못했습니다.'); }
      myId = peer.id;
      watchPeer(peer);
      await new Promise((resolve, reject) => {
        const conn = peer.connect(ID_PREFIX + wanted, { reliable: true, serialization: 'json' });
        const timer = setTimeout(() => reject(new Error('방을 찾을 수 없습니다. 코드를 확인해 주세요.')), JOIN_TIMEOUT);
        peer.once('error', (err) => { clearTimeout(timer); reject(new Error(err.type === 'peer-unavailable' ? '방을 찾을 수 없습니다. 코드를 확인해 주세요.' : '접속하지 못했습니다.')); });
        conn.on('open', () => { clearTimeout(timer); hostConn = conn; resolve(); });
        conn.on('data', (msg) => { try { onClientData(msg); } catch (err) { console.warn('방장 메시지 처리 실패:', err); } });
        conn.on('close', () => {
          closed = true;
          if (!lostSent && ui.onLost) { lostSent = true; ui.onLost(); }
        });
      });
      role = 'client';
      code = wanted;
      return code;
    },

    requestChar(charId, gun) { send(hostConn, { t: 'join', charId, gun }); },

    // 방장: 게임을 시작하면 기다리던 접속자를 받는다.
    onHostStarted() { peers.forEach((_, id) => admit(id)); refreshTag(); },

    tick(S, dt) {
      if (role === 'host') hostTick(S, dt);
      else if (role === 'client') clientTick(S, dt);
    },

    // 접속자: 명중과 능력은 모아 다음 상태 메시지로 보낸다.
    queueHit(id, dmg, crit) { hits.push([id, Math.round(dmg), crit ? 1 : 0]); },
    queueSkill(charId, at, mult) { skills.push({ c: charId, x: r2(at.x), z: r2(at.z), m: r2(mult) }); },
    sendDuelResult(room, won) { send(hostConn, { t: 'dr', room, won: !!won }); },

    // 대전: 명중·죽음을 알린다. 방장은 바로 처리하고 접속자는 방장에게 보낸다.
    pvpHit(targetId, dmg) {
      if (role === 'host') routePvpHit(G.Main.state(), 'h', targetId, dmg);
      else pvpHits.push([targetId, r2(dmg)]);
    },
    pvpDeath(by) {
      if (role === 'host') G.Pvp.kill(G.Main.state(), by, 'h');
      else send(hostConn, { t: 'pd', by });
    },
    creditRemote(peerId, pts) { send(peers.get(peerId)?.conn, { t: 'mk', pts }); },

    // 방장 → 접속자
    hurtRemote(rp, dmg) { const e = peers.get(rp.peerId); if (e) send(e.conn, { t: 'hurt', d: r2(dmg) }); },
    broadcastXP(n) { broadcast({ t: 'xp', n: Math.round(n) }); },
    teleportClients(x, z, yaw, refill) {
      let k = 0;
      peers.forEach(({ conn, rp }) => {
        if (!rp) return;
        k += 1;
        rp.x = x + Math.sin(k * 1.3) * 1.2;
        rp.z = z + Math.cos(k * 1.3) * 1.2;
        send(conn, { t: 'tp', x: r2(rp.x), z: r2(rp.z), yaw: r2(yaw), refill: !!refill });
      });
    },
    startDuel(opts, room) { broadcast({ t: 'duel', opts, room }); },
    won() { broadcast({ t: 'won' }); },
    refreshTag,
  };

  setInterval(watchSilence, WATCH_MS);
  G.Net = Net;
})(window.G);
