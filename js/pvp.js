'use strict';
window.G = window.G || {};
// 대전 모드: 같은 방에 접속한 사람끼리 검은 과수원에서 서로 쏜다. 적·보스·봉인은 없다.
// 쏜 사람 화면에서 명중을 판정해 방장에게 알리고, 방장이 맞은 사람에게 전달한다.
// 방장이 처치·데스를 집계하고 순위표를 모두에게 공개한다.
(function (G) {
  const ARENA = 'orchard', GOAL = 20, RESET_MS = 7000, KILL_POINTS = 500;
  // 사람은 체력이 낮아 총 피해를 줄이고 한 발 피해에 상한을 둔다(레이저 한 방 처치 방지).
  const DMG_SCALE = 0.6, HIT_CAP = 40;
  const BODY_Y = 0.95, BODY_RX = 0.42, BODY_RY = 0.95, SPAWN_TRIES = 8;
  const scores = new Map(); // 방장만 쓴다: id → { name, charId, k, d }
  let resetTimer = 0;

  const arena = () => G.world.rooms.find((r) => r.key === ARENA);
  const idOf = (b) => b.netId || b.peerId;

  // 다른 사람들에게서 가장 먼 빈자리.
  function spawnPoint(S, forOther) {
    const room = arena();
    const others = S.bots.filter((b) => b.alive).concat(forOther && S.player?.alive ? [S.player] : []);
    let best = room.spawn, bestD = -1;
    for (let i = 0; i < SPAWN_TRIES; i++) {
      const [x, z] = G.world.freeSpot(room, room.focus[0], room.focus[1], 0);
      const d = others.reduce((m, b) => Math.min(m, Math.hypot(b.x - x, b.z - z)), 99);
      if (d > bestD) { bestD = d; best = [x, z]; }
    }
    return best;
  }

  // 시선과 다른 플레이어 몸통(타원체)의 교차. 가장 가까운 사람을 돌려준다.
  function rayPlayer(S, o, d, maxT, minT) {
    let best = null, bt = maxT;
    for (const b of S.bots) {
      if (!b.alive) continue;
      const ox = (b.x - o[0]) / BODY_RX, oy = (b.y + BODY_Y - o[1]) / BODY_RY, oz = (b.z - o[2]) / BODY_RX;
      const dx = d[0] / BODY_RX, dy = d[1] / BODY_RY, dz = d[2] / BODY_RX;
      const a = dx * dx + dy * dy + dz * dz;
      const tc = (ox * dx + oy * dy + oz * dz) / a;
      if (tc < minT) continue;
      const closest = (ox - dx * tc) ** 2 + (oy - dy * tc) ** 2 + (oz - dz * tc) ** 2;
      if (closest > 1) continue;
      const t = Math.max(minT, tc - Math.sqrt((1 - closest) / a));
      if (t < bt) { bt = t; best = b; }
    }
    return best ? { b: best, t: bt } : null;
  }

  function hit(S, b, base) {
    const dmg = Math.min(HIT_CAP, base * DMG_SCALE);
    G.hud.floatText(b.x, b.y + 2.2, b.z, Math.round(dmg), '#ffffff', false);
    S.hitMarkT = 0.12;
    G.audio.sfx('hit');
    G.Net.pvpHit(idOf(b), dmg);
  }

  function splash(S, pt, radius, base, skip) {
    S.bots.forEach((b) => {
      if (!b.alive || b === skip) return;
      const d = Math.hypot(b.x - pt[0], b.y + BODY_Y - pt[1], b.z - pt[2]);
      if (d < radius) hit(S, b, base * (1 - d / radius * 0.5));
    });
    G.Actors.burst(S, pt[0], pt[1], pt[2], [1, 0.62, 0.2], 12, 4);
    S.flashT = Math.max(S.flashT, 0.05);
    G.audio.sfx('boom');
  }

  // 이 화면의 플레이어가 다른 사람에게 맞았다.
  function hurt(S, dmg, by) {
    const p = S.player;
    if (!p.alive || p.inv > 0 || !Number.isFinite(dmg) || dmg <= 0) return;
    p.hp -= Math.min(HIT_CAP, dmg);
    p.lastHurt = S.time;
    S.hurt = Math.min(1, S.hurt + dmg / 28);
    S.lastAttacker = by;
    G.audio.sfx('hurt');
    if (p.hp <= 0) G.Main.playerDown();
  }

  function died(S) {
    const p = S.player;
    p.deaths = (p.deaths || 0) + 1;
    G.Net.pvpDeath(S.lastAttacker || '');
    S.lastAttacker = '';
  }

  // ---- 방장: 집계와 순위표 ----
  const table = () => [...scores.entries()].map(([id, s]) => [id, s.name, s.charId, s.k, s.d]);

  function publish() { G.Main.state().scores = table(); }

  function join(id, name, charId) {
    scores.set(id, { name, charId, k: 0, d: 0 });
    publish();
  }

  function leave(id) {
    scores.delete(id);
    publish();
  }

  function reset() {
    scores.forEach((s) => { s.k = 0; s.d = 0; });
    resetTimer = 0;
    publish();
    G.hud.banner('새 판', '순위 초기화');
  }

  function kill(S, killerId, victimId) {
    const victim = scores.get(victimId);
    if (!victim) return;
    victim.d += 1;
    const killer = killerId !== victimId ? scores.get(killerId) : null;
    if (!killer) {
      G.hud.chat('system', '', `${victim.name} 쓰러짐`, '#bbb');
      publish();
      return;
    }
    killer.k += 1;
    G.hud.chat('system', '', `${killer.name} ▸ ${victim.name} 처치`, '#ff8a7a');
    if (killerId === 'h') G.Actors.creditKill(S, KILL_POINTS);
    else G.Net.creditRemote(killerId, KILL_POINTS);
    if (killer.k >= GOAL && !resetTimer) {
      G.hud.banner(`${killer.name} 우승`, `${GOAL}킬 달성 · 곧 새 판`);
      resetTimer = setTimeout(reset, RESET_MS);
    }
    publish();
  }

  // 순위: 처치 많은 순, 같으면 데스 적은 순.
  function ranking(S) {
    return (S.scores || []).slice().sort((a, b) => b[3] - a[3] || a[4] - b[4]);
  }

  G.Pvp = { ARENA, GOAL, HIT_CAP, arena, spawnPoint, rayPlayer, hit, splash, hurt, died, join, leave, kill, table, ranking };
})(window.G);
