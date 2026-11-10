'use strict';
window.G = window.G || {};
// 첫 화면 흐름: 목소리 언어 → 접속 방식(혼자 · 방 만들기 · 코드로 참가) → 인물(겉모습) → 총 · Q 능력 → 입장.
(function (G) {
  const $ = (id) => document.getElementById(id);
  const GUN_ORDER = ['pistol', 'smg', 'shotgun', 'rifle', 'flash', 'helsi'];
  const LOCKED_GUN = 'helsi', HELSI_STREAK = 10;
  // 막대 길이 기준(가득 찬 값). HELSI는 기준을 넘어 꽉 찬다.
  const FULL = { dps: 320, shot: 180, mag: 40, reload: 2.2 };
  const pct = (v, full) => Math.max(4, Math.min(100, v / full * 100));

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  let hooks = null, chosenChar = 0, chosenGun = 'pistol', chosenSkill = 0, charsInfo = '';

  function showStep(id) {
    ['langPick', 'modePick', 'gunPick'].forEach((step) => { $(step).hidden = step !== id; });
    document.querySelector('.menu-in').hidden = id !== 'chars';
  }

  function focusFirst(selector) {
    const node = document.querySelector(selector);
    if (node) node.focus({ preventScroll: true });
  }

  function info(text) {
    charsInfo = text || '';
    const node = $('netInfo');
    node.textContent = charsInfo;
    node.hidden = !charsInfo;
  }

  function gunNote(text) { $('gunMsg').textContent = text || ''; }

  // 다른 사람이 고른 인물은 누를 수 없다.
  function markTaken(taken) {
    document.querySelectorAll('.char').forEach((button) => {
      const used = taken.includes(Number(button.dataset.id));
      button.disabled = used;
      button.classList.toggle('taken', used);
    });
  }

  function openChars(text) {
    showStep('chars');
    info(text);
    focusFirst('.char:not(:disabled)');
  }

  function statRow(label, value, full, shown) {
    return `<span class="stat"><em>${label}</em><i><u style="width:${pct(value, full)}%"></u></i><small>${shown}</small></span>`;
  }

  function gunCard(base, locked) {
    const w = G.CONTENT.weapons[base];
    const dps = w.dmg * w.pellets * w.rate, shot = w.dmg * w.pellets;
    const stats = statRow('초당 피해', dps, FULL.dps, Math.round(dps))
      + statRow('한 발', shot, FULL.shot, Math.round(shot) + (w.pellets > 1 ? ` (${w.pellets}발)` : ''))
      + statRow('탄창', w.mag, FULL.mag, w.mag)
      + statRow('장전', w.reload, FULL.reload, w.reload.toFixed(1) + '초');
    const extra = w.splash ? '<small class="gun-tag">폭발 범위 피해</small>' : w.zoom ? '<small class="gun-tag">고배율 조준</small>' : '';
    if (locked) {
      return `<div class="gun locked" data-gun="${base}"><b>${w.name}</b>${stats}
        <p class="gun-lock">잠김 · 눈알 야바위 ${HELSI_STREAK}번 연속 성공 시 해금</p>
        <button type="button" class="gun-challenge">야바위 도전</button></div>`;
    }
    const on = base === chosenGun;
    return `<button type="button" class="gun${on ? ' on' : ''}" data-gun="${base}" role="radio" aria-checked="${on}"><b>${w.name}</b>${stats}${extra}</button>`;
  }

  function renderGuns() {
    const unlocked = hooks.helsiUnlocked();
    if (chosenGun === LOCKED_GUN && !unlocked) chosenGun = 'pistol';
    const grid = $('guns');
    grid.innerHTML = GUN_ORDER.map((base) => gunCard(base, base === LOCKED_GUN && !unlocked)).join('');
    grid.querySelectorAll('button.gun').forEach((card) => {
      card.addEventListener('click', () => { chosenGun = card.dataset.gun; renderGuns(); focusFirst(`button.gun[data-gun="${chosenGun}"]`); });
    });
    const challenge = grid.querySelector('.gun-challenge');
    if (challenge) challenge.addEventListener('click', startChallenge);
    updateGo();
  }

  function updateGo() {
    $('gunGo').textContent = `입장 · ${G.CONTENT.weapons[chosenGun].name} + ${G.CONTENT.skills[chosenSkill].name}`;
  }

  // Q 능력은 인물과 따로 고른다. 그 인물의 원래 능력에는 표시를 단다.
  function renderSkills() {
    const grid = $('skills');
    grid.innerHTML = G.CONTENT.skills.map((sk, i) => {
      const on = i === chosenSkill;
      const own = i === chosenChar ? '<em class="skill-own">원래 능력</em>' : '';
      return `<button type="button" class="skill${on ? ' on' : ''}" data-skill="${i}" role="radio" aria-checked="${on}">
        <b>${esc(sk.name)}</b>${own}<small>재사용 ${sk.cd}초</small><span>${esc(sk.desc)}</span></button>`;
    }).join('');
    grid.querySelectorAll('button.skill').forEach((card) => {
      card.addEventListener('click', () => {
        chosenSkill = Number(card.dataset.skill);
        renderSkills();
        focusFirst(`button.skill[data-skill="${chosenSkill}"]`);
      });
    });
    updateGo();
  }

  function startChallenge() {
    G.Duel.start({
      kind: 'shell', level: 0, streak: HELSI_STREAK, bossName: 'HELSI 금고', voice: false,
      rewardText: 'HELSI 레이저 해금', penaltyText: '처음부터 다시',
    }, (result) => {
      if (result.won) {
        hooks.unlockHelsi();
        chosenGun = LOCKED_GUN;
        gunNote('HELSI 레이저를 손에 넣었다. 이제 언제든 고를 수 있다.');
      } else gunNote(`${result.wins}번 연속 성공 · 다시 도전할 수 있다.`);
      renderGuns();
    });
  }

  // 인물을 고른 뒤 총 고르기로 넘어간다.
  function chooseGun(charId) {
    chosenChar = charId;
    chosenSkill = charId;
    $('gunWho').textContent = `${G.GAME_DATA.characters[charId].name}의 장비`;
    gunNote('');
    showStep('gunPick');
    renderGuns();
    renderSkills();
    focusFirst('button.gun.on');
  }

  function backToGuns() {
    showStep('gunPick');
    renderGuns();
    renderSkills();
    focusFirst('button.gun.on');
  }

  function initGunStep() {
    $('gunBack').addEventListener('click', () => openChars(charsInfo));
    $('gunTest').addEventListener('click', () => hooks.range(chosenChar, chosenGun, chosenSkill));
    $('gunGo').addEventListener('click', () => hooks.enter(chosenChar, chosenGun, chosenSkill));
  }

  function init(handlers) {
    hooks = handlers;
    const msg = $('modeMsg');
    const controls = [...document.querySelectorAll('#modePick button, #joinCode')];
    const busy = (on, text) => {
      controls.forEach((b) => { b.disabled = on; });
      msg.textContent = text || '';
    };

    document.querySelectorAll('#langPick [data-lang]').forEach((button) => {
      button.addEventListener('click', () => {
        G.Voice.setLang(button.dataset.lang);
        G.Voice.unlock();
        G.audio.unlock();
        showStep('modePick');
        focusFirst('#modePick [data-mode]');
      });
    });

    document.querySelector('[data-mode="solo"]').addEventListener('click', () => openChars(''));

    // 협동(기본 진행을 함께)과 대전(서로 겨루기)은 방을 만들 때 정한다. 참가자는 방의 모드를 따른다.
    document.querySelectorAll('[data-mode="coop"], [data-mode="pvp"]').forEach((button) => {
      button.addEventListener('click', async () => {
        const pvp = button.dataset.mode === 'pvp';
        busy(true, '방을 여는 중…');
        try {
          const code = await G.Net.host(button.dataset.mode);
          busy(false);
          openChars(`${pvp ? '대전 ' : ''}방 코드 ${code} · 함께할 사람에게 알려 주세요 (최대 6명)`);
        } catch (err) {
          busy(false, err.message);
        }
      });
    });

    G.Net.setUI({
      onWelcome: (seed, taken) => {
        hooks.reseed(seed);
        busy(false);
        markTaken(taken);
        openChars(`${G.Net.mode() === 'pvp' ? '대전 ' : ''}방 ${G.Net.code()}에 연결됨 · 인물을 고르세요`);
      },
      onTaken: (taken) => {
        markTaken(taken);
        openChars('다른 사람이 먼저 고른 인물입니다. 다른 인물을 고르세요.');
      },
      onStart: (start) => {
        if (Number.isInteger(start.charId)) hooks.clientStart(start);
      },
      onStatus: (text) => { busy(false, text); info(text); gunNote(text); },
      onLost: hooks.lost,
      onBack: hooks.back,
    });

    $('joinForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      busy(true, '방을 찾는 중…');
      try {
        await G.Net.join($('joinCode').value);
        msg.textContent = '연결됨 · 건물 정보를 받는 중…';
      } catch (err) {
        busy(false, err.message);
      }
    });

    initGunStep();
    showStep('langPick');
    focusFirst('#langPick [data-lang]');
  }

  G.Lobby = { init, info, gunNote, markTaken, chooseGun, backToGuns };
})(window.G);
