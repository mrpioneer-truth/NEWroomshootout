'use strict';
window.G = window.G || {};
// 장면 그리기: 상자 조합으로 만든 인물·적·전리품·탄도. 모든 것은 저해상도 버퍼로 들어간다.
(function (G) {
  const SKIN = [0.86, 0.8, 0.72];
  const GUN = [0.12, 0.12, 0.12];
  const GATE_COL = [0.95, 0.45, 0.2];

  const g = () => G.gfx;
  const box = (x, y, z, yaw, pitch, sx, sy, sz, c, emit) => g().cube(g().trs(x, y, z, yaw, pitch, sx, sy, sz), c[0], c[1], c[2], emit || 0);

  // 몸 기준 로컬 좌표(lx, ly, lz)에 놓이는 부품
  function part(a, lx, ly, lz, sx, sy, sz, c, emit) {
    const cs = Math.cos(a.yaw), sn = Math.sin(a.yaw);
    box(a.x + lx * cs + lz * sn, a.y + ly, a.z - lx * sn + lz * cs, a.yaw, 0, sx, sy, sz, c, emit);
  }

  function human(a, col, opts) {
    const o = opts || {};
    if (o.down) { box(a.x, a.y + 0.18, a.z, a.yaw, 0, 0.5, 0.3, 1.4, col.map((v) => v * 0.5)); return; }
    const sw = Math.sin(a.walk || 0) * 0.18;
    const dark = col.map((v) => v * 0.45);
    const emit = o.emit || 0;
    part(a, -0.12, 0.38, sw, 0.17, 0.76, 0.2, dark, emit);
    part(a, 0.12, 0.38, -sw, 0.17, 0.76, 0.2, dark, emit);
    part(a, 0, 1.08, 0, 0.52, 0.62, 0.3, col, emit);
    part(a, 0, 1.6, 0, 0.34, 0.34, 0.34, o.head || SKIN, emit);
    part(a, 0, 1.63, 0.16, 0.36, 0.08, 0.05, o.visor || [0.08, 0.08, 0.08], o.visor ? 1 : 0);
    part(a, -0.3, 1.12, 0.2, 0.13, 0.13, 0.5, col, emit);
    part(a, 0.3, 1.12, 0.2, 0.13, 0.13, 0.5, col, emit);
    part(a, -0.18, 1.18, 0.55, 0.09, 0.12, 0.55, GUN);
  }

  function enemyBody(S, e) {
    const t = S.time, s = e.def.size;
    const marked = G.Actors.has(S, 'mark');
    const rev = S.time < e.revUntil;
    let c = e.def.col;
    if (e.flash > 0) c = [1, 1, 1];
    else if (rev) c = [0.35, 0.55, 1];
    const emit = e.flash > 0 ? 0.9 : marked ? 0.7 : 0;
    const bob = Math.sin(t * 3 + e.bob) * 0.08;
    if (e.type === 'noise') {
      const j = () => (Math.random() - 0.5) * 0.08;
      box(e.x + j(), e.y + s * 0.55 + bob, e.z + j(), e.yaw, 0, s, s, s, c, emit);
      part({ x: e.x, y: e.y + bob, z: e.z, yaw: e.yaw }, 0, s * 0.62, s * 0.5, s * 0.5, 0.1, 0.05, [1, 0.2, 0.1], 1);
      for (let i = 0; i < 2; i++) {
        const a = t * 2.5 + i * Math.PI + e.bob;
        box(e.x + Math.sin(a) * s * 0.8, e.y + s * 0.9, e.z + Math.cos(a) * s * 0.8, a, 0, 0.16, 0.16, 0.16, c, emit);
      }
    } else if (e.type === 'echo') {
      box(e.x, e.y + 0.85 + bob, e.z, t * 2 + e.bob, 0, 0.32, 1.25, 0.32, c, emit);
      box(e.x, e.y + 0.9 + bob, e.z, -t * 3, 0, 0.9, 0.06, 0.9, [0.3, 0.1, 0.08], emit);
      box(e.x, e.y + 0.95 + bob, e.z, e.yaw, 0, 0.18, 0.18, 0.4, [1, 0.35, 0.2], 1);
    } else if (e.type === 'glitch') {
      box(e.x, e.y + 0.4 + bob, e.z, t * 9, 0.7, 0.6, 0.16, 0.16, c, Math.max(emit, 0.5));
      box(e.x, e.y + 0.4 + bob, e.z, -t * 9, -0.7, 0.16, 0.6, 0.16, c, Math.max(emit, 0.5));
    } else if (e.type === 'dummy') {
      const mid = e.y + s * e.stretch * 0.55;
      box(e.x, e.y + mid / 2, e.z, e.yaw, 0, 0.12, mid, 0.12, [0.26, 0.2, 0.14]);
      box(e.x, mid, e.z, e.yaw, 0, 1.05, 1.05, 0.08, c, emit);
      box(e.x, mid, e.z, e.yaw, 0, 0.66, 0.66, 0.1, e.flash > 0 ? [1, 1, 1] : [0.72, 0.1, 0.07], Math.max(emit, 0.25));
      box(e.x, mid, e.z, e.yaw, 0, 0.24, 0.24, 0.12, c, emit);
    } else if (e.type === 'ghost') {
      human(e, e.flash > 0 ? [1, 1, 1] : [0.08, 0.08, 0.09], { head: [0.1, 0.1, 0.1], visor: [1, 0.15, 0.1], emit });
    } else if (e.def.kind === 'anchor') {
      originAnchor(e, t, bob);
    } else if (e.def.kind === 'boss') {
      bossBody(e);
    }
  }

  let ringMesh;
  function ring(x, z, radius, color, y = 0.055) {
    if (!ringMesh) {
      const verts = [];
      const at = (i, r) => [Math.sin(i / 40 * Math.PI * 2) * r, 0, Math.cos(i / 40 * Math.PI * 2) * r, 0, 1, 0, 1, 1, 1];
      for (let i = 0; i < 40; i++) {
        const a = at(i, 1), b = at(i + 1, 1), c = at(i, 0.94), d = at(i + 1, 0.94);
        verts.push(...a, ...b, ...c, ...b, ...d, ...c);
      }
      ringMesh = g().mesh(verts);
    }
    g().draw(ringMesh, g().trs(x, y, z, 0, 0, radius, 1, radius), ...color, 1);
  }

  function originAnchor(e, t, bob) {
    const color = e.flash > 0 ? [1, 1, 0.94] : e.def.col;
    box(e.x, 0.28, e.z, Math.PI / 4, 0, 1.12, 0.55, 1.12, [0.28, 0.2, 0.11]);
    box(e.x, 1.16 + bob, e.z, t * 1.7, Math.PI / 4, 0.77, 0.77, 0.77, color, 1);
    box(e.x, 1.16 + bob, e.z, -t * 1.7, Math.PI / 4, 1.31, 0.065, 0.065, [1, 0.93, 0.7], 1);
    box(e.x, 2.3, e.z, 0, 0, 0.055, 1.6, 0.055, color, 1);
    ring(e.x, e.z, 1.13, color, 0.085);
  }

  function originLinks(e, h, halo, wind) {
    const guard = G.Bosses.isProtected(e);
    const glow = e.blockFlash > 0 ? 1 : guard ? 0.72 : 0.36;
    const color = e.def.col.map((v) => v * glow);
    ring(e.x, e.z, halo + 1.35, color, 0.08);
    ring(e.x, e.z, halo + 2.1 + wind * 0.5, color, 0.095);
    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI / 3 - e.age * (e.phase === 1 ? 0.45 : 1.15);
      const r = halo + 1.6;
      box(e.x + Math.sin(angle) * r, 0.35 + Math.sin(e.age * 3 + i) * 0.19, e.z + Math.cos(angle) * r,
        angle, Math.PI / 4, 0.2, 0.2, 0.2, color, 1);
    }
    for (const node of e.anchors) {
      if (!node.alive) continue;
      const dx = node.x - e.x, dy = 1.15 - (e.y + h * 0.4), dz = node.z - e.z;
      const tetherColor = node.def.col.map((v) => v * (0.49 + 0.15 * Math.sin(e.age * 5 + node.bob)));
      box(e.x + dx * 0.5, 1.15 - dy * 0.5, e.z + dz * 0.5, Math.atan2(dx, dz), Math.atan2(dy, Math.hypot(dx, dz)),
        0.048, 0.048, Math.hypot(dx, dy, dz), tetherColor, 1);
    }
  }

  function bossBody(e) {
    const h = e.def.size * e.stretch, w = e.def.size * e.def.ratio * e.widthScale;
    const wind = e.wind ? 1 - e.wind.time / e.wind.total : 0;
    const charge = e.flash > 0 ? 1.9 : 1 + wind * 0.22;
    const tint = e.def.tint.map((value) => value * charge);
    const rim = e.type === 'origin' ? (e.phase === 2 ? 0.43 : 0.30) + wind * 0.14 : 0;
    if (!g().sprite(e.sprite || e.type, e.x, e.y, e.z, w, h, ...tint, e.lean, rim)) {
      box(e.x, e.y + h * 0.54, e.z, e.yaw, e.lean, w * 0.65, h * 0.72, w * 0.26, e.def.col.map((v) => v * 0.38));
      box(e.x, e.y + h * 0.92, e.z, e.yaw, e.lean, w * 0.34, h * 0.18, w * 0.21, e.def.col, 0.8);
    }
    const halo = Math.max(0.8, w * 0.58);
    ring(e.x, e.z, halo, e.def.col.map((v) => v * (0.45 + wind * 0.55)));
    if (e.type === 'origin') {
      originLinks(e, h, halo, wind);
    } else if (e.phase === 2) {
      for (let i = 0; i < 5; i++) {
        const angle = i / 5 * Math.PI * 2 + e.age * 1.4;
        box(e.x + Math.cos(angle) * halo, h * (0.16 + 0.07 * Math.sin(e.age * 2 + i)), e.z + Math.sin(angle) * halo,
          angle, e.age * 3, 0.1, 0.36, 0.1, e.def.col, 1);
      }
    }
    const warn = e.def.col.map((v) => v * (e.sweep ? 1.55 : 0.75 + wind * 0.38));
    for (const zone of e.zones) {
      if (zone.kind === 'circle') {
        ring(zone.x, zone.z, zone.radius, warn, 0.075);
        ring(zone.x, zone.z, Math.max(0.1, zone.radius * (1 - wind * 0.7)), warn, 0.085);
      } else {
        const length = zone.length;
        const x = zone.x + zone.dx * length / 2, z = zone.z + zone.dz * length / 2;
        box(x, 0.055, z, zone.yaw, 0, zone.width, 0.035, length, warn.map((v) => v * 0.29), 1);
        const edge = Math.max(0.05, zone.width * 0.11);
        for (const sign of [-1, 1]) {
          const offset = (zone.width / 2 - edge / 2) * sign;
          box(x + zone.dz * offset, 0.085, z - zone.dx * offset, zone.yaw, 0, edge, 0.035, length, warn, 1);
        }
      }
    }
    e.waves.forEach((pulse, i) => ring(pulse.x, pulse.z, pulse.radius, e.def.col, 0.12 + i * 0.004));
  }

  function rooms(S, w) {
    w.rooms.forEach((r) => {
      if (r.restored) {
        const [x, z] = r.focus;
        box(x, 0.04, z, S.time * 0.3, 0, 0.95, 0.05, 0.95, r.color, 0.55);
      }
    });
    w.gates.forEach((i) => {
      if (!w.gateMask[i]) return;
      const x = i % w.W + 0.5, z = Math.floor(i / w.W) + 0.5, h = w.cells[i];
      box(x, h / 2, z, 0, 0, 1, h, 1, [0.22, 0.12, 0.075]);
      box(x, 1.1, z, 0, 0, 1.025, 0.14, 1.025, GATE_COL, 0.72);
      box(x, h - 0.4, z, 0, 0, 1.025, 0.1, 1.025, GATE_COL, 0.45);
    });
  }

  function pickups(S) {
    S.pickups.forEach((pk) => {
      const bob = 0.6 + Math.sin(pk.t * 3) * 0.15;
      if (pk.type === 'seal') {
        const c = pk.room.color;
        box(pk.x, bob + 0.3, pk.z, pk.t * 2, 0.6, 0.5, 0.5, 0.5, [c[0] * 1.6, c[1] * 1.6, c[2] * 1.6], 1);
        box(pk.x, 4, pk.z, 0, 0, 0.08, 8, 0.08, [1, 0.95, 0.8], 1);
      } else if (pk.type === 'loot') {
        const c = pk.w.rgb;
        box(pk.x, bob, pk.z, pk.t * 1.5, 0, 0.5, 0.18, 0.18, c, 1);
        box(pk.x, 1.6, pk.z, 0, 0, 0.05, 3.2, 0.05, c, 1);
      } else {
        box(pk.x, bob, pk.z, pk.t, 0, 0.4, 0.12, 0.12, [0.3, 0.95, 0.4], 1);
        box(pk.x, bob, pk.z, pk.t, 0, 0.12, 0.4, 0.12, [0.3, 0.95, 0.4], 1);
      }
    });
  }

  // 총 레벨별 탄환 모양. 2레벨: 굵어지고 맥동, 3레벨: 더 굵어지고 두 가닥이 나선으로 감긴다.
  const TRACER_SCALE = [1, 1, 1.9, 2.9], PULSE_SPEED = 45, PULSE_DEPTH = 0.28;
  // 나선은 길이 1m마다 두 바퀴, 한 바퀴에 점 열두 개. 아주 긴 탄도는 점 수를 제한한다.
  const HELIX_TURNS_PER_M = 2, HELIX_DOTS_PER_TURN = 12, HELIX_MAX_DOTS = 160, HELIX_SPIN = 18, HELIX_RADIUS = [0, 0, 0, 0.11], HELIX_DOT = 0.045;

  function helix(t, d, L, c, time) {
    const up = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    let u = [d[1] * up[2] - d[2] * up[1], d[2] * up[0] - d[0] * up[2], d[0] * up[1] - d[1] * up[0]];
    const ul = Math.hypot(u[0], u[1], u[2]) || 1;
    u = u.map((v) => v / ul);
    const v = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]];
    const r = HELIX_RADIUS[t.lv] * (t.beam ? 1.4 : 1);
    const turns = L * HELIX_TURNS_PER_M;
    const steps = Math.min(HELIX_MAX_DOTS, Math.ceil(turns * HELIX_DOTS_PER_TURN));
    for (const strand of [0, Math.PI]) {
      for (let i = 0; i <= steps; i++) {
        const s = i / steps, phase = s * Math.PI * 2 * turns + time * HELIX_SPIN + strand;
        const ox = (u[0] * Math.cos(phase) + v[0] * Math.sin(phase)) * r;
        const oy = (u[1] * Math.cos(phase) + v[1] * Math.sin(phase)) * r;
        const oz = (u[2] * Math.cos(phase) + v[2] * Math.sin(phase)) * r;
        box(t.a[0] + d[0] * L * s + ox, t.a[1] + d[1] * L * s + oy, t.a[2] + d[2] * L * s + oz, phase, phase, HELIX_DOT, HELIX_DOT, HELIX_DOT, c, 1);
      }
    }
  }

  function fx(S) {
    S.tracers.forEach((t) => {
      const dx = t.b[0] - t.a[0], dy = t.b[1] - t.a[1], dz = t.b[2] - t.a[2], L = Math.hypot(dx, dy, dz);
      if (L < 0.05) return;
      const c = t.col || [1, 0.9, 0.6];
      const lv = t.lv || 1;
      const pulse = lv > 1 ? 1 + PULSE_DEPTH * Math.sin(S.time * PULSE_SPEED) : 1;
      const width = (t.beam ? 0.055 : 0.035) * TRACER_SCALE[lv] * pulse;
      box((t.a[0] + t.b[0]) / 2, (t.a[1] + t.b[1]) / 2, (t.a[2] + t.b[2]) / 2, Math.atan2(dx, dz), Math.atan2(dy, Math.hypot(dx, dz)), width, width, L, c, 1);
      if (lv >= 3) helix(t, [dx / L, dy / L, dz / L], L, c, S.time);
    });
    S.orbs.forEach((o) => box(o.x, o.y, o.z, S.time * 6, 0.6, 0.26, 0.26, 0.26, o.col || [1, 0.25, 0.15], 1));
    S.parts.forEach((q) => box(q.x, q.y, q.z, q.t * 9, q.t * 7, q.s, q.s, q.s, q.col, 0.6));
  }

  function scene(S, cam) {
    const w = G.world;
    g().drawStatic();
    rooms(S, w);
    pickups(S);
    S.enemies.forEach((e) => { if (e.alive) enemyBody(S, e); });
    S.bots.forEach((b) => {
      if (b.charId >= 0) G.Characters.drawOperator(S, b, cam);
      else human(b, [0.08, 0.08, 0.09], { down: !b.alive, visor: [1, 0.15, 0.1] });
    });
    const p = S.player;
    if (p && S.playing) {
      if (!p.alive || (cam.tps && cam.dist > 0.7)) G.Characters.drawOperator(S, p, cam);
    }
    fx(S);
    if (S.visitorFlash > 0 && p) {
      const vx = cam.eye[0] + cam.dir[0] * 6, vz = cam.eye[2] + cam.dir[2] * 6;
      g().sprite('marionette', vx, 0, vz, 2.45, 3.4, 0.52, 0.5, 0.48);
    }
    if (p && S.playing && p.alive && !cam.tps) G.Characters.drawGun(S, p, cam, S.flashT > 0);
  }

  G.Draw = { scene };
})(window.G);
