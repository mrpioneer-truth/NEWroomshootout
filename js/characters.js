'use strict';
window.G = window.G || {};
(function (G) {
  const steel = [0.12, 0.145, 0.16];
  const alloy = [0.35, 0.39, 0.4];
  const obsidian = [0.047, 0.05, 0.06];

  // Torso width, skin, headwear and two large silhouette details per operator.
  const outfits = [
    { width: 0.55, skin: [0.81, 0.63, 0.49], cap: [0.26, 0.17, 0.09], gear: [
      [0, 1.72, 0.1, 0.37, 0.07, 0.37, 'coat'], [0.24, 1.52, 0, 0.09, 0.23, 0.24, 'cap'],
      [-0.18, 1.14, 0.17, 0.21, 0.23, 0.09, 'cap'],
    ] },
    { width: 0.46, skin: [0.93, 0.77, 0.67], cap: [0.19, 0.23, 0.12], gear: [
      [0, 1.64, 0.165, 0.35, 0.08, 0.08, 'lens'], [0, 1.43, 0, 0.41, 0.15, 0.4, 'coat'],
      [0.15, 1.12, 0.17, 0.10, 0.24, 0.07, 'cap'],
    ] },
    { width: 0.59, skin: obsidian, cap: obsidian, gloss: 1, gear: [
      [0, 1.62, 0.16, 0.34, 0.12, 0.09, 'cap'], [0, 1.64, 0.212, 0.28, 0.022, 0.018, 'lens'],
      [-0.29, 1.24, 0.02, 0.23, 0.18, 0.34, 'cap'], [0.29, 1.24, 0.02, 0.23, 0.18, 0.34, 'cap'],
      [0, 1.18, 0.18, 0.37, 0.20, 0.1, 'cap'],
    ] },
    { width: 0.43, skin: [0.77, 0.55, 0.46], cap: [0.29, 0.14, 0.13], gear: [
      [-0.13, 1.61, 0.17, 0.19, 0.09, 0.08, 'lens'], [-0.16, 1.02, 0.18, 0.20, 0.24, 0.12, 'cap'],
      [0.14, 1.19, 0.17, 0.08, 0.19, 0.04, 'lens'],
    ] },
    { width: 0.47, skin: [0.85, 0.66, 0.55], cap: [0.16, 0.25, 0.30], gear: [
      [-0.18, 1.57, 0, 0.10, 0.29, 0.34, 'coat'], [0.18, 1.57, 0, 0.10, 0.29, 0.34, 'coat'],
      [0, 1.40, 0.05, 0.44, 0.15, 0.39, 'coat'], [0.08, 1.08, 0.19, 0.26, 0.17, 0.10, 'cap'],
    ] },
    { width: 0.53, skin: [0.71, 0.55, 0.49], cap: [0.24, 0.20, 0.34], gear: [
      [0, 1.53, 0.155, 0.30, 0.14, 0.095, 'cap'], [0.19, 1.64, 0, 0.07, 0.21, 0.20, 'lens'],
      [0.21, 1.82, -0.04, 0.025, 0.19, 0.025, 'cap'], [0, 1.05, -0.22, 0.39, 0.46, 0.20, 'cap'],
    ] },
  ];

  const guns = {
    shotgun: { length: 0.33, accent: [0.84, 0.55, 0.31], parts: [
      [0, 0, -0.10, 0.087, 0.075, 0.32, 'steel'],
      [0, 0.015, 0.20, 0.050, 0.055, 0.26, 'alloy'],
      [0, -0.023, 0.15, 0.088, 0.06, 0.20, 'accent'],
      [0, -0.019, -0.19, 0.065, 0.055, 0.17, 'accent'],
    ] },
    rifle: { length: 0.38, accent: [0.6, 0.73, 0.44], parts: [
      [0, 0, -0.045, 0.079, 0.07, 0.35, 'steel'],
      [0, 0, 0.22, 0.030, 0.032, 0.32, 'alloy'],
      [0, 0.068, -0.02, 0.065, 0.061, 0.15, 'steel'],
      [0, 0.068, 0.057, 0.044, 0.04, 0.012, 'accent'],
    ] },
    helsi: { length: 0.36, accent: [0.64, 1, 0.34], parts: [
      [0, 0, -0.05, 0.12, 0.105, 0.43, 'steel'],
      [0, 0, 0.18, 0.064, 0.058, 0.34, 'alloy'],
      [-0.049, 0.035, 0.16, 0.033, 0.035, 0.37, 'alloy'],
      [0.049, 0.035, 0.16, 0.033, 0.035, 0.37, 'alloy'],
      [-0.050, 0.058, 0.16, 0.016, 0.011, 0.34, 'accent'],
      [0.050, 0.058, 0.16, 0.016, 0.011, 0.34, 'accent'],
      [0, -0.033, 0.33, 0.040, 0.026, 0.05, 'accent'],
    ] },
    pistol: { length: 0.18, accent: [0.83, 0.40, 0.4], parts: [
      [0, 0.024, 0.04, 0.056, 0.053, 0.28, 'alloy'],
      [0, -0.018, -0.015, 0.061, 0.065, 0.185, 'steel'],
      [0, 0.055, -0.055, 0.038, 0.012, 0.033, 'accent'],
    ] },
    smg: { length: 0.25, accent: [0.39, 0.76, 0.85], parts: [
      [0, 0, -0.035, 0.088, 0.092, 0.29, 'steel'],
      [0, 0, 0.16, 0.058, 0.066, 0.18, 'alloy'],
      [0, -0.065, 0.04, 0.12, 0.099, 0.115, 'alloy'],
      [0, 0.051, -0.011, 0.055, 0.019, 0.23, 'accent'],
    ] },
    flash: { length: 0.28, accent: [0.65, 0.49, 0.94], parts: [
      [0, 0, -0.07, 0.095, 0.10, 0.30, 'steel'],
      [0, 0, 0.14, 0.14, 0.13, 0.23, 'alloy'],
      [0, 0, 0.254, 0.101, 0.096, 0.035, 'accent'],
    ] },
  };

  function placement(x, y, z, yaw, pitch = 0, scale = 1) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    function local(dx, dy, dz) {
      return [
        x + scale * (dx * cy - dy * sy * sp + dz * sy * cp),
        y + scale * (dy * cp + dz * sp),
        z + scale * (-dx * sy - dy * cy * sp + dz * cy * cp),
      ];
    }
    function box(dx, dy, dz, w, h, d, color, emit = 0, gloss = 0) {
      const [wx, wy, wz] = local(dx, dy, dz);
      const g = G.gfx;
      g.cube(g.trs(wx, wy, wz, yaw, pitch, w * scale, h * scale, d * scale), ...color, emit, 0, gloss);
    }
    return { local, box };
  }

  function gunMount(S, a, cam = S.cam) {
    if (a !== S.player || !cam || cam.tps) {
      const [x, y, z] = placement(a.x, a.y, a.z, a.yaw).local(-0.18, 1.22, 0.46);
      return placement(x, y, z, a.yaw, a.pitch || 0, 1.18);
    }
    const sway = Math.sin(a.walk) * Math.min(a.gait || 0, 1) * 0.012;
    const rightX = -Math.cos(a.yaw), rightZ = Math.sin(a.yaw);
    const zoom = a.camZoom || 0;
    const side = 0.225 - zoom * 0.207 + sway;
    const drop = 0.22 - zoom * 0.115;
    const reload = a.reloadT > 0 ? 0.16 : 0;
    const fwd = 0.59 - S.recoil * 0.36;
    const x = cam.eye[0] + cam.dir[0] * fwd + rightX * side;
    const y = cam.eye[1] + cam.dir[1] * fwd - drop - reload + Math.abs(sway);
    const z = cam.eye[2] + cam.dir[2] * fwd + rightZ * side;
    return placement(x, y, z, a.yaw, a.pitch - reload * 2, 0.9);
  }

  function gunFor(actor) {
    return guns[actor.weapon?.base] || guns.pistol;
  }

  function muzzle(S, a) {
    return gunMount(S, a).local(0, 0, gunFor(a).length);
  }

  function drawGun(S, a, cam, flash) {
    const gun = gunFor(a);
    const { box } = gunMount(S, a, cam);
    const laser = a.weapon?.base === 'helsi';
    const materials = { steel, alloy, accent: gun.accent };
    const glove = a.charId === 2 ? obsidian : G.CONTENT.colors[a.charId];
    const gloveGloss = outfits[a.charId].gloss || 0;
    box(0, -0.072, -0.10, 0.064, 0.13, 0.09, glove, 0, gloveGloss);
    if (a === S.player && !cam.tps) {
      box(-0.02, -0.116, -0.185, 0.094, 0.10, 0.24, glove, 0, gloveGloss);
    }
    gun.parts.forEach(([x, y, z, w, h, d, material]) => {
      box(x, y, z, w, h, d, materials[material], material === 'accent' ? 0.7 : 0, laser ? 0.55 : 0);
    });
    if (flash) {
      const k = 1 + 0.45 * ((a.gunLv || 1) - 1); // 총 레벨이 오를수록 총구 불꽃이 커진다
      box(0, 0, gun.length + 0.015 * k, (laser ? 0.062 : 0.14) * k, (laser ? 0.062 : 0.12) * k, 0.07 * k, laser ? gun.accent : [1, 0.85, 0.4], 1);
    }
  }

  function drawOperator(S, a, cam) {
    const suit = outfits[a.charId];
    const accent = G.CONTENT.colors[a.charId];
    const coat = suit.gloss ? [0.072, 0.079, 0.091] : accent.map((v) => v * 0.68);
    const pants = coat.map((v) => v * 0.53);
    const materials = { coat, cap: suit.cap, lens: accent };
    const { box } = placement(a.x, a.y, a.z, a.yaw);
    const gloss = suit.gloss || 0;
    const emit = a.inv > 0 ? 0.28 : 0;
    if (!a.alive) {
      box(0, 0.16, 0, suit.width, 0.30, 1.42, coat, 0, gloss);
      return;
    }
    const sw = Math.sin(a.walk || 0) * 0.14;
    box(-0.12, 0.39, sw, 0.17, 0.74, 0.21, pants, emit, gloss);
    box(0.12, 0.39, -sw, 0.17, 0.74, 0.21, pants, emit, gloss);
    box(-0.12, 0.07, sw + 0.03, 0.19, 0.14, 0.25, suit.cap, emit, gloss);
    box(0.12, 0.07, -sw + 0.03, 0.19, 0.14, 0.25, suit.cap, emit, gloss);
    box(0, 1.06, 0, suit.width, 0.62, 0.32, coat, emit, gloss);
    box(0, 0.81, 0.01, suit.width * 0.94, 0.07, 0.35, suit.cap, emit, gloss);
    box(0, 1.57, 0, 0.33, 0.33, 0.33, suit.skin, emit, gloss);
    box(0, 1.70, -0.03, 0.36, 0.12, 0.34, suit.cap, emit, gloss);
    box(-suit.width * 0.52, 1.15, 0.14, 0.13, 0.16, 0.45, coat, emit, gloss);
    box(suit.width * 0.52, 1.14, 0.11, 0.13, 0.16, 0.40, coat, emit, gloss);
    suit.gear.forEach(([x, y, z, w, h, d, part]) => box(x, y, z, w, h, d, materials[part], part === 'lens' ? 0.6 : emit, gloss));
    drawGun(S, a, cam, a === S.player ? S.flashT > 0 : a.gunFlash > 0);
  }

  // Portraits use the same equipment silhouettes as the figures inside the building.
  const portraits = [
    `
      <path fill="var(--coat)" d="M15 88 22 52 43 45 67 47 85 62 91 88Z"/>
      <path fill="#bb8c6c" d="M38 25 62 26 65 43 55 54 40 49 34 37Z"/>
      <path fill="#6b4625" d="M32 30 38 17 62 19 72 33 59 36 39 33Z"/>
      <path fill="#191815" d="M31 28 56 30 73 35 56 37 30 33Z"/>
      <path fill="#d7a64e" d="M31 58 53 53 61 74 45 81 32 74Z"/>
      <path fill="#423229" d="M28 73 74 60 83 65 43 82Z"/>`,
    `
      <path fill="var(--coat)" d="M17 88 23 59 39 47 65 46 78 60 87 88Z"/>
      <path fill="#d6ad95" d="M38 24 63 24 68 40 60 53 43 54 36 41Z"/>
      <path fill="#374329" d="M31 36 34 21 51 16 66 19 72 32 57 29 44 31 39 39Z"/>
      <path fill="#18221a" d="M34 33 67 31 68 40 39 44Z"/>
      <path fill="var(--rim)" d="m38 34 13-1-1 6-10 2Zm16-2 12-1v7l-11 1Z"/>
      <path fill="#72895a" d="m31 47 18 5 19-6 2 10-20 10-20-9Z"/>
      <path fill="#333a2b" d="m53 80 25-37 8 4-20 37Z"/>`,
    `
      <defs><linearGradient id="visor-2" x1="0" x2="1" y1="0" y2="1">
        <stop stop-color="#11141a"/>
        <stop offset=".45" stop-color="#596573"/>
        <stop offset=".55" stop-color="#242832"/>
        <stop offset="1" stop-color="#0a0a0d"/>
      </linearGradient></defs>
      <path fill="#14171e" stroke="#849096" stroke-width="1.2" d="M12 88 22 60 38 50 66 50 84 62 94 88Z"/>
      <path fill="url(#visor-2)" stroke="#747e89" d="M32 31 39 19 56 16 68 20 73 35 67 49 54 56 37 48Z"/>
      <path fill="#090b0d" d="M32 32 54 34 72 29 71 41 54 46 36 41Z"/>
      <path fill="#baef7c" d="M35 35 54 38 70 34 69 37 54 42 36 38Z"/>
      <path fill="#4e5660" d="m22 59 16-7 10 11-10 12-20-4Zm45-7 16 10 3 11-18 1-10-13Z"/>
      <path fill="#171a20" stroke="#71808b" d="m31 76 47-22 8 9-45 24Z"/>
      <path stroke="#b8e884" stroke-width="2" d="m46 76 36-17"/>`,
    `
      <path fill="var(--coat)" d="M15 88 22 66 38 51 62 48 77 63 88 88Z"/>
      <path fill="#b7816b" d="M35 27 60 23 67 33 62 48 51 55 38 49 34 41Z"/>
      <path fill="#442624" d="M30 36 33 20 45 16 64 19 73 28 65 34 58 27 42 29 36 39Z"/>
      <path fill="#452523" d="m34 36 18 1 1 8-18-1Z"/>
      <path fill="var(--rim)" d="m35 38 15 1 1 3-15-1Z"/>
      <path fill="#643838" d="M31 59 48 61 46 75 26 77Z"/>
      <path fill="#d7b692" d="M65 56h8v13h-8z"/>
      <path fill="#463031" d="m55 78 17-9 13 1 1 5-21 9Z"/>`,
    `
      <path fill="var(--coat)" d="M16 88 24 58 38 48 65 48 81 65 90 88Z"/>
      <path fill="#32616a" stroke="#69a8b4" d="M30 39 30 26 42 15 57 15 69 24 73 37 68 54 59 61 39 57Z"/>
      <path fill="#102b32" d="M38 30 51 25 63 29 66 41 60 53 45 51 38 44Z"/>
      <path fill="#d7a68b" d="M43 33 58 32 63 41 58 52 47 48 42 41Z"/>
      <path fill="#3b7886" d="m32 45 18 7 16-4 3 10-17 7-18-5Z"/>
      <path fill="#163239" d="m37 77 31-16 18 4 2 7-17 3-3 11-14-1-4-8Z"/>
      <path fill="var(--rim)" d="m53 72 19-9 10 2-17 5Z"/>`,
    `
      <path fill="var(--coat)" d="M13 88 22 63 38 51 65 49 82 62 90 88Z"/>
      <path fill="#b38a7f" d="M35 27 64 27 68 39 59 54 42 52 36 42Z"/>
      <path fill="#373047" d="M30 36 34 23 45 18 61 20 70 28 71 37 58 33 45 36Z"/>
      <path fill="#352e47" d="M36 41 53 43 67 37 65 51 55 58 41 53Z"/>
      <path fill="#a995d0" d="M66 30h7v13h-7zM69 17h2v13h-2z"/>
      <path fill="#38324e" d="m24 66 17-7 9 7-2 19-19-1Z"/>
      <path fill="#59496c" d="m49 75 19-17 15 5 2 13-18 10Z"/>
      <path fill="#cfbcfa" d="m67 65 11-3 4 5-10 7Z"/>`,
  ];

  function buildMenu(startGame, saved) {
    const list = document.getElementById('chars');
    const title = document.getElementById('pickTitle');
    const hint = document.getElementById('pickHint');
    const center = document.getElementById('pickDetail');
    const chars = G.GAME_DATA.characters;

    chars.forEach((c, i) => {
      const a = (i * 60 - 90) * Math.PI / 180;
      const button = document.createElement('button');
      const color = i === 2 ? '#a8b4c2' : G.CONTENT.css[i];
      button.type = 'button';
      button.className = 'char';
      button.dataset.id = c.id;
      button.setAttribute('aria-label', `${c.name} 선택`);
      button.style.setProperty('--x', (50 + Math.cos(a) * 34) + '%');
      button.style.setProperty('--y', (50 + Math.sin(a) * 34) + '%');
      button.style.setProperty('--rim', color);
      button.innerHTML = `<span class="portrait" aria-hidden="true"><svg viewBox="0 0 104 88">
        <path class="portrait-frame" d="M13 25v-8h8m62 0h8v8m-78 36v8h8m62 0h8v-8"/>
        <path class="portrait-grid" d="M20 68h64m-64-12h64m-64-12h64m-64-12h64M28 22v46m12-46v46m12-46v46m12-46v46m12-46v46"/>
        ${portraits[i]}</svg></span><span class="char-name"></span>`;
      button.querySelector('.char-name').textContent = c.name;
      function inspect() {
        title.textContent = c.name;
        hint.textContent = c.tag;
        center.style.setProperty('--pick', color);
      }
      function reset() {
        title.textContent = '인물 선택';
        hint.textContent = '겉모습';
        center.style.removeProperty('--pick');
      }
      button.addEventListener('pointerenter', inspect);
      button.addEventListener('pointerleave', () => { if (document.activeElement !== button) reset(); });
      button.addEventListener('focus', inspect);
      button.addEventListener('blur', reset);
      button.addEventListener('click', () => startGame(c.id));
      list.appendChild(button);
    });

    document.getElementById('record').textContent = `결말 ${saved.endings.length} / ${G.GAME_DATA.endings.length} · LV ${saved.bestLevel}`;
    const sound = document.getElementById('soundBtn');
    sound.addEventListener('click', () => {
      const on = G.audio.toggle();
      sound.setAttribute('aria-pressed', String(on));
      sound.textContent = on ? '소리 켜짐' : '소리 꺼짐';
    });
  }

  G.Characters = { buildMenu, drawGun, drawOperator, muzzle };
})(window.G);
