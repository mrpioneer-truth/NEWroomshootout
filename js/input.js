'use strict';
window.G = window.G || {};
// 키보드·마우스(포인터 잠금)·터치 입력. 한 번 누르는 동작은 consume()으로 한 번만 읽는다.
(function (G) {
  const STICK_RADIUS = 55, TOUCH_LOOK = 2.4;
  const EDGE_KEYS = { Space: 'jump', KeyQ: 'skill', KeyV: 'view', KeyR: 'reload', KeyF: 'skill', Digit1: 'c1', Digit2: 'c2', Digit3: 'c3' };

  const input = {
    moveX: 0, moveZ: 0, lookX: 0, lookY: 0, fire: false, aim: false, sprint: false,
    locked: false, touch: false, keys: {}, edges: {}, stick: { x: 0, z: 0 },
    onLockChange: null,

    consume(name) {
      if (name === 'choice') {
        for (let i = 1; i <= 3; i++) if (this.edges['c' + i]) { this.edges['c' + i] = false; return i; }
        return 0;
      }
      const v = !!this.edges[name];
      this.edges[name] = false;
      return v;
    },

    poll() {
      const k = this.keys;
      this.moveX = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0) + this.stick.x;
      this.moveZ = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0) + this.stick.z;
      this.sprint = !!(k.ShiftLeft || k.ShiftRight) || Math.hypot(this.stick.x, this.stick.z) > 0.95;
    },

    clear() {
      this.lookX = 0; this.lookY = 0; this.fire = false; this.aim = false; this.keys = {}; this.edges = {};
    },

    init(canvas) {
      this.canvas = canvas;
      window.addEventListener('keydown', (e) => {
        if (!document.getElementById('menu').hidden || !document.getElementById('duel').hidden || e.target.closest?.('button, summary')) return;
        if (e.code === 'Space') e.preventDefault();
        if (!this.keys[e.code] && EDGE_KEYS[e.code]) this.edges[EDGE_KEYS[e.code]] = true;
        this.keys[e.code] = true;
      });
      window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
      window.addEventListener('blur', () => this.clear());
      // 포인터 잠금이 막힌 환경(일부 임베드 브라우저)에서는 누른 채 끌어서 시점을 돌린다
      document.addEventListener('mousemove', (e) => {
        if (!this.locked && !this.dragLook) return;
        this.lookX += e.movementX;
        this.lookY += e.movementY;
      });
      canvas.addEventListener('mousedown', (e) => {
        if (this.touch) return;
        if (!this.locked) { this.lock(); this.dragLook = true; }
        if (e.button === 0) this.fire = true;
        if (e.button === 2) this.aim = true;
      });
      window.addEventListener('mouseup', (e) => {
        this.dragLook = false;
        if (e.button === 0) this.fire = false;
        if (e.button === 2) this.aim = false;
      });
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
      document.addEventListener('pointerlockchange', () => {
        this.locked = document.pointerLockElement === canvas;
        if (!this.locked) { this.fire = false; this.aim = false; }
        if (this.onLockChange) this.onLockChange(this.locked);
      });
      if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) this.initTouch();
    },

    lock() {
      if (this.touch || !this.canvas.requestPointerLock) return;
      try {
        const r = this.canvas.requestPointerLock();
        if (r && r.catch) r.catch(() => {});
      } catch (err) {
        console.warn('포인터 잠금 실패:', err);
      }
    },

    initTouch() {
      const layer = document.getElementById('touch');
      const knob = layer.querySelector('#stick i');
      let stickId = null, lookId = null, ox = 0, oy = 0, lx = 0, ly = 0;
      this.touch = true;
      layer.querySelectorAll('button').forEach((b) => {
        const key = b.dataset.k;
        b.addEventListener('touchstart', (e) => {
          e.preventDefault(); e.stopPropagation();
          if (key === 'fire') this.fire = true;
          else if (key === 'aim') this.aim = !this.aim;
          else this.edges[key] = true;
        }, { passive: false });
        b.addEventListener('touchend', (e) => { e.preventDefault(); if (key === 'fire') this.fire = false; }, { passive: false });
      });
      const onStart = (e) => {
        for (const t of e.changedTouches) {
          if (t.target.closest && t.target.closest('button, #choice, #menu, #ending, #duel')) continue;
          if (t.clientX < innerWidth * 0.42 && stickId === null) { stickId = t.identifier; ox = t.clientX; oy = t.clientY; }
          else if (lookId === null) { lookId = t.identifier; lx = t.clientX; ly = t.clientY; }
        }
      };
      const onMove = (e) => {
        for (const t of e.changedTouches) {
          if (t.identifier === stickId) {
            const dx = t.clientX - ox, dy = t.clientY - oy, l = Math.min(STICK_RADIUS, Math.hypot(dx, dy)) / (Math.hypot(dx, dy) || 1);
            this.stick.x = dx * l / STICK_RADIUS;
            this.stick.z = -dy * l / STICK_RADIUS;
            knob.style.transform = `translate(${dx * l}px,${dy * l}px)`;
          } else if (t.identifier === lookId) {
            this.lookX += (t.clientX - lx) * TOUCH_LOOK;
            this.lookY += (t.clientY - ly) * TOUCH_LOOK;
            lx = t.clientX; ly = t.clientY;
          }
        }
      };
      const onEnd = (e) => {
        for (const t of e.changedTouches) {
          if (t.identifier === stickId) { stickId = null; this.stick.x = 0; this.stick.z = 0; knob.style.transform = ''; }
          if (t.identifier === lookId) lookId = null;
        }
      };
      window.addEventListener('touchstart', onStart, { passive: true });
      window.addEventListener('touchmove', onMove, { passive: true });
      window.addEventListener('touchend', onEnd);
      window.addEventListener('touchcancel', onEnd);
    },
  };

  G.input = input;
})(window.G);
