'use strict';
window.G = window.G || {};
// 보스 직전의 판: 야바위(눈알 잔 섞기)와 패 낚기(목표 패가 뒤집히는 순간 잡기). 세 판 두 선승.
(function (G) {
  const WIN_NEED = 2, MAX_ROUNDS = 3;
  const SHOW_MS = 1100, PICK_MS = 3200, REVEAL_MS = 1300, READY_MS = 900;
  const LIFT_PX = 46, ARC_PX = 26, FOUR_CUP_LEVEL = 5, MAX_LEVEL = 9;
  const SUITS = [['◆', true], ['♠', false], ['♥', true], ['♣', false]];
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const $ = (id) => document.getElementById(id);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pickIdx = (n) => Math.floor(Math.random() * n);
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  let run = null; // 진행 중인 판. 끝나면 null.

  // 판이 바뀌거나 끝난 뒤에는 예약된 콜백이 실행되지 않는다.
  function later(ms, fn) {
    const token = run;
    setTimeout(() => { if (run && run === token) fn(); }, ms);
  }

  function frame(fn) {
    const token = run;
    requestAnimationFrame((t) => { if (run && run === token) fn(t); });
  }

  function setMsg(text, tone) {
    const m = run.root.querySelector('.duel-msg');
    m.textContent = text;
    m.className = 'duel-msg' + (tone ? ' ' + tone : '');
  }

  function setScore() {
    if (run.streak) {
      run.root.querySelector('.duel-score').innerHTML = `<span>연속 성공 <b>${run.wins}</b> / ${run.streak}</span>`;
      return;
    }
    run.root.querySelector('.duel-score').innerHTML = `<span>나 <b>${run.wins}</b></span><span>판 ${Math.max(1, Math.min(run.round, MAX_ROUNDS))}/${MAX_ROUNDS}</span><span>상대 <b>${run.losses}</b></span>`;
  }

  function roundOver(won, text) {
    if (won) run.wins += 1; else run.losses += 1;
    setMsg(text, won ? 'good' : 'bad');
    G.audio.sfx(won ? 'clear' : 'hurt');
    setScore();
    run.input = null;
    // 연속 도전: 한 번이라도 틀리면 끝, 목표만큼 맞히면 성공. 맞힐수록 빨라진다.
    if (run.streak) run.level = Math.min(MAX_LEVEL, run.wins);
    const decided = run.streak ? !won || run.wins >= run.streak : run.wins >= WIN_NEED || run.losses >= WIN_NEED;
    later(REVEAL_MS, () => (decided ? finish() : nextRound()));
  }

  function nextRound() {
    run.round += 1;
    setScore();
    if (run.kind === 'shell' && run.cupCount !== cupsFor(run.level)) shellSetup();
    if (run.kind === 'shell') shellRound(); else cardRound();
  }

  // ---- 야바위 ----
  function slotX(i) { return ((i + 1) / (run.cupCount + 1)) * 100; }
  const cupsFor = (level) => (level >= FOUR_CUP_LEVEL ? 4 : 3);

  function placeCups(lifted) {
    run.cups.forEach((c) => {
      const up = lifted === true || (Array.isArray(lifted) && lifted.includes(c));
      c.el.style.left = slotX(c.slot) + '%';
      c.el.style.transform = `translateY(${up ? -LIFT_PX : 0}px)`;
    });
    run.root.querySelector('.eyeball').style.left = slotX(run.cups[run.ball].slot) + '%';
  }

  function shellSetup() {
    const table = run.root.querySelector('.duel-table');
    table.innerHTML = '<span class="eyeball"></span>';
    run.cupCount = cupsFor(run.level);
    run.ball = 0;
    run.cups = Array.from({ length: run.cupCount }, (_, i) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'cup';
      el.disabled = true;
      el.setAttribute('aria-label', `잔 ${i + 1}`);
      el.innerHTML = '<b></b><i></i>';
      table.appendChild(el);
      const cup = { el, slot: i };
      el.addEventListener('click', () => { if (run && run.input === 'cup') reveal(cup); });
      return cup;
    });
  }

  function labelCups() {
    run.cups.forEach((c) => { c.el.querySelector('b').textContent = c.slot + 1; });
  }

  function shellRound() {
    run.ball = pickIdx(run.cupCount);
    run.cups.forEach((c) => { c.el.disabled = true; c.el.querySelector('b').textContent = ''; });
    const eye = run.root.querySelector('.eyeball');
    eye.style.opacity = '1';
    placeCups(true);
    setMsg('눈알이 들어간 잔을 기억해');
    later(SHOW_MS, () => {
      placeCups(false);
      later(260, () => { eye.style.opacity = '0'; shuffle(); });
    });
  }

  function shuffle() {
    const round = run.streak ? 0 : run.round; // 연속 도전은 단계(level)만으로 어려워진다
    const swaps = Math.round(5 + run.level * 1.1 + round * 2);
    const dur = Math.max(150, 430 - run.level * 26 - round * 40);
    let done = 0;
    setMsg('섞는 중…');
    const step = () => {
      if (done >= swaps) { openPick(); return; }
      const a = pickIdx(run.cupCount);
      let b = pickIdx(run.cupCount - 1);
      if (b >= a) b += 1;
      const ca = run.cups.find((c) => c.slot === a), cb = run.cups.find((c) => c.slot === b);
      const start = performance.now();
      const anim = (now) => {
        const t = Math.min(1, (now - start) / dur), e = ease(t), arc = Math.sin(Math.PI * e) * ARC_PX;
        ca.el.style.left = (slotX(a) + (slotX(b) - slotX(a)) * e) + '%';
        cb.el.style.left = (slotX(b) + (slotX(a) - slotX(b)) * e) + '%';
        ca.el.style.transform = `translateY(${-arc}px)`;
        cb.el.style.transform = `translateY(${arc * 0.5}px)`;
        if (t < 1) { frame(anim); return; }
        ca.slot = b; cb.slot = a;
        placeCups(false);
        done += 1;
        if (done % 4 === 0) G.audio.sfx('orb');
        step();
      };
      frame(anim);
    };
    step();
  }

  function openPick() {
    run.cups.forEach((c) => { c.el.disabled = false; });
    labelCups();
    run.input = 'cup';
    setMsg(`어느 잔? 클릭 또는 숫자키 1–${run.cupCount}`);
    const round = run.round;
    later(PICK_MS, () => {
      if (run.input !== 'cup' || run.round !== round) return;
      reveal(null);
    });
  }

  function reveal(cup) {
    run.input = null;
    run.cups.forEach((c) => { c.el.disabled = true; });
    const right = run.cups[run.ball];
    placeCups(cup ? [cup, right] : [right]);
    run.root.querySelector('.eyeball').style.opacity = '1';
    if (!cup) roundOver(false, '시간 초과 · 눈알이 너를 보고 있었다');
    else if (cup === right) roundOver(true, '맞혔다');
    else roundOver(false, '빈 잔');
  }

  // ---- 패 낚기 ----
  function cardHtml(card, extra) {
    const [suit, red] = SUITS[card.s];
    return `<div class="pcard${red ? ' red' : ''}${extra ? ' ' + extra : ''}"><b>${suit}</b><span>${RANKS[card.r]}</span></div>`;
  }

  function cardSetup() {
    run.root.querySelector('.duel-table').outerHTML = `<div class="card-stage">
      <div><div class="duel-tag">이 패를 잡아라</div><div class="slot-target"></div></div>
      <div><div class="duel-tag">덱</div><div class="slot-deck"></div></div></div>
      <button type="button" class="snap-btn">잡기 · Space</button>`;
    run.root.querySelector('.snap-btn').addEventListener('click', snap);
    run.root.querySelector('.slot-deck').addEventListener('click', snap);
  }

  // 절반 이상은 무늬나 숫자 하나가 같아 헷갈린다.
  function decoy(target) {
    const roll = Math.random();
    let s = pickIdx(SUITS.length), r = pickIdx(RANKS.length);
    if (roll < 0.35) s = target.s;
    else if (roll < 0.6) r = target.r;
    if (s === target.s && r === target.r) r = (r + 1 + pickIdx(RANKS.length - 1)) % RANKS.length;
    return { s, r };
  }

  function cardRound() {
    const target = { s: pickIdx(SUITS.length), r: pickIdx(RANKS.length) };
    const before = Math.round(rnd(5, 9 + run.level * 0.5));
    run.sequence = Array.from({ length: before }, () => decoy(target)).concat([target, decoy(target), decoy(target)]);
    run.target = target;
    run.flip = -1;
    run.root.querySelector('.slot-target').innerHTML = cardHtml(target, 'target');
    run.root.querySelector('.slot-deck').innerHTML = '<div class="pcard back"></div>';
    setMsg('준비…');
    run.input = null;
    later(READY_MS, () => { run.input = 'snap'; setMsg('목표 패가 뒤집히는 순간 잡아라'); flipNext(); });
  }

  function flipNext() {
    if (run.input !== 'snap') return;
    run.flip += 1;
    const card = run.sequence[run.flip];
    if (!card) { roundOver(false, '놓쳤다 · 패는 이미 지나갔다'); return; }
    run.root.querySelector('.slot-deck').innerHTML = cardHtml(card, 'flip');
    const interval = Math.max(330, 780 - run.level * 38 - run.round * 55);
    const flip = run.flip, round = run.round;
    later(interval, () => { if (run.round === round && run.flip === flip) flipNext(); });
  }

  function snap() {
    if (!run || run.input !== 'snap' || run.flip < 0) return;
    run.input = null;
    const card = run.sequence[run.flip];
    const hit = card.s === run.target.s && card.r === run.target.r;
    roundOver(hit, hit ? '잡았다' : '헛손 · 다른 패였다');
  }

  // ---- 공통 ----
  function onKey(e) {
    if (!run) return;
    if (run.input === 'cup' && /^Digit[1-4]$/.test(e.code)) {
      const cup = run.cups.find((c) => c.slot === Number(e.code.slice(5)) - 1);
      if (cup) { e.preventDefault(); reveal(cup); }
    } else if (run.input === 'snap' && (e.code === 'Space' || e.code === 'Enter')) {
      e.preventDefault();
      snap();
    } else if (run.input === 'go' && (e.code === 'Space' || e.code === 'Enter')) {
      e.preventDefault();
      const go = run.root.querySelector('.duel-go');
      if (go) go.click();
    }
  }

  function finish() {
    const won = run.streak ? run.wins >= run.streak : run.wins >= WIN_NEED;
    if (run.voice) G.Voice.say(won ? 'duelWin' : 'duelLose');
    const btns = run.root.querySelector('.duel-btns');
    const label = run.streak ? '돌아가기' : `${esc(run.bossName)}와 대면`;
    btns.innerHTML = `<button type="button" class="primary duel-go">${label} · Space</button>`;
    btns.hidden = false;
    setMsg(won ? `판 승리 · ${run.rewardText}` : `판 패배 · ${run.penaltyText}`, won ? 'good' : 'bad');
    run.input = 'go';
    const done = run.onDone, result = { won, wins: run.wins, losses: run.losses };
    btns.querySelector('.duel-go').addEventListener('click', () => {
      run.root.hidden = true;
      run.root.innerHTML = '';
      run = null;
      done(result);
    }, { once: true });
  }

  const Duel = {
    active: () => !!run,

    /**
     * @param {{kind:'shell'|'cards', level:number, bossName:string, voice:boolean, rewardText:string, penaltyText:string}} opts
     * @param {(result:{won:boolean,wins:number,losses:number}) => void} onDone
     */
    start(opts, onDone) {
      const root = $('duel');
      run = { ...opts, root, onDone, round: 0, wins: 0, losses: 0, input: 'go' };
      const title = opts.streak ? `눈알 야바위 ${opts.streak}연속` : opts.kind === 'shell' ? '눈알 야바위' : '패 낚기';
      const rule = opts.kind === 'shell'
        ? '눈알이 든 잔을 기억하고, 섞인 뒤 그 잔을 고른다. 판이 갈수록 빨라진다.'
        : '왼쪽의 패가 덱에서 뒤집히는 순간 Space 또는 클릭. 다른 패에 손대면 진다.';
      root.innerHTML = `<div class="duel-in"><small>${opts.streak ? '해금 도전' : '보스 앞의 판 · 세 판 두 선승'}</small>
        <h2>${esc(opts.bossName)} · ${title}</h2><p class="duel-rule">${rule}<br>${opts.streak ? `${opts.streak}번 연속으로 맞히면 ${esc(opts.rewardText)} · 한 번이라도 틀리면 ${esc(opts.penaltyText)}` : `이기면 ${esc(opts.rewardText)} · 지면 ${esc(opts.penaltyText)}`}</p>
        <div class="duel-score"></div><div class="duel-table"></div><div class="duel-msg"></div>
        <div class="duel-btns"><button type="button" class="primary duel-go">시작 · Space</button></div></div>`;
      root.hidden = false;
      setScore();
      root.querySelector('.duel-go').addEventListener('click', () => {
        run.input = null;
        const btns = run.root.querySelector('.duel-btns');
        btns.innerHTML = '';
        btns.hidden = true;
        if (run.kind === 'shell') shellSetup(); else cardSetup();
        nextRound();
      }, { once: true });
      if (opts.voice) G.Voice.say('duel');
    },
  };

  window.addEventListener('keydown', onKey, true);
  G.Duel = Duel;
})(window.G);
