'use strict';
window.G = window.G || {};
// 시험 사격장: 입구 로비에 표적 셋과 좌우로 움직이는 표적 하나를 세우고 최근 3초의 초당 피해를 잰다.
(function (G) {
  const STILL_TARGETS = 3, MIN_DIST = 5, DPS_WINDOW = 3, SLIDE_SPEED = 2.2;

  function setup(S) {
    const room = G.world.lobby, p = S.player, used = [];
    S.rangeHits = [];
    S.rangeDps = 0;
    for (let i = 0; i <= STILL_TARGETS; i++) {
      const [x, z] = G.world.freeSpot(room, p.x, p.z, MIN_DIST, used);
      used.push([x, z]);
      const target = G.Actors.spawnEnemy(S, 'dummy', x, z, room, 1);
      target.yaw = Math.atan2(p.x - x, p.z - z);
      target.stretch = 2; // 맞는 범위를 표적판 높이(가슴께)로 올린다
      if (i === STILL_TARGETS) target.slide = 1; // 마지막 하나는 좌우로 움직인다
    }
  }

  function update(S, dt) {
    G.Actors.updateEnemies(S, dt);
    S.enemies.forEach((e) => {
      if (!e.slide) return;
      if (G.world.move(e, e.slide * SLIDE_SPEED * dt, 0)) e.slide = -e.slide;
    });
    S.rangeHits = S.rangeHits.filter(([t]) => S.time - t < DPS_WINDOW);
    S.rangeDps = S.rangeHits.reduce((sum, [, amount]) => sum + amount, 0) / DPS_WINDOW;
  }

  G.Range = { setup, update };
})(window.G);
