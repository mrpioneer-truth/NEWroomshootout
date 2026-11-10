'use strict';
window.G = window.G || {};
// 예측 불가 장치: 주기적인 건물 규칙 변경과 data.js의 선택 사건(1·2·3 키로 바로 고름), 결말 판정.
(function (G) {
  const FIRST_RULE = 22, RULE_GAP = [30, 50], RULE_LEN = 18;
  const FIRST_EVENT = 45, EVENT_GAP = [55, 85], CHOICE_TIME = 10, BUFF_TIME = 30;
  const LOW_RES = 72, NORMAL_RES = 540;

  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  let lastRule = null;
  let deck = [];

  function shuffledIndices(n) {
    const a = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  function randomRule(S) {
    const pool = G.CONTENT.rules.filter((r) => r.id !== lastRule && !(S.boss && r.id === 'shuffle'));
    return pick(pool);
  }

  function spawnAround(S, types, minD) {
    const room = S.room || S.checkpoint;
    const scale = 1 + room.tier * 0.15 + (S.player.lvl - 1) * 0.05;
    types.forEach((t) => { const [x, z] = G.world.freeSpot(room, S.player.x, S.player.z, minD); G.Actors.spawnEnemy(S, t, x, z, room, scale); });
  }

  function shuffleParty(S) {
    const options = G.world.rooms.filter((r) => r.stage === S.stage && r.visited && r !== S.room);
    const to = options.length ? pick(options) : S.checkpoint;
    const [cx, cz] = G.world.center(to);
    const p = S.player;
    p.x = cx; p.z = cz; p.y = 0; p.vy = 0; p.history = [];
    S.bots.forEach((b, i) => { if (!b.remote) { b.x = cx + Math.sin(i) * 1.5; b.z = cz + Math.cos(i) * 1.5; b.y = 0; } });
    G.Net.teleportClients(cx, cz, 0, false);
    S.room = null;
  }

  const START = {
    lowres: (S) => { G.gfx.setLowRes(LOW_RES); S.xpMult = 2; },
    swarm: (S) => spawnAround(S, ['glitch', 'glitch', 'glitch', 'noise'], 7),
    lootrain: (S) => {
      const room = S.room || S.checkpoint;
      for (let i = 0; i < 5; i++) { const [x, z] = G.world.freeSpot(room, S.player.x, S.player.z, 1); G.Actors.dropLoot(S, x, z, G.Actors.rollRarity(room.tier + 1)); }
    },
    shuffle: shuffleParty,
    doppel: (S) => {
      spawnAround(S, ['ghost'], 6);
      G.hud.chat('system', '', '접속자 7님이 적대 상태로 접속했습니다', '#ff6b5a');
    },
  };

  const Rules = {
    init(S) {
      S.rule = null; S.ruleT = FIRST_RULE; S.eventT = FIRST_EVENT; S.choice = null;
      lastRule = null; deck = [];
    },

    active(S, id) { return !!S.rule && S.rule.id === id; },

    start(S, def) {
      S.rule = { id: def.id, name: def.name, left: RULE_LEN };
      lastRule = def.id;
      S.shift = 1;
      G.hud.rule(def.name, def.sub);
      G.audio.play('shift');
      if (START[def.id]) START[def.id](S);
      if (Math.random() < 0.5) G.Actors.botSay(S, pick(S.bots.filter((b) => b.alive)), 'rule');
    },

    end(S) {
      const id = S.rule && S.rule.id;
      if (id === 'lowres') { G.gfx.setLowRes(NORMAL_RES); S.xpMult = 1; }
      if (id === 'doppel') {
        S.enemies.forEach((e) => { if (e.type === 'ghost') e.alive = false; });
      }
      S.rule = null;
      S.ruleT = rnd(RULE_GAP[0], RULE_GAP[1]);
    },

    force(S) {
      if (S.rule) Rules.end(S);
      Rules.start(S, randomRule(S));
    },

    openChoice(S) {
      const events = G.GAME_DATA.events;
      if (!deck.length) deck = shuffledIndices(events.length);
      const ev = events[deck.pop()];
      S.choice = { ev, left: CHOICE_TIME };
      G.hud.showChoice(ev, (i) => Rules.pick(S, i));
      G.audio.sfx('event');
      if (ev.visitor) { S.visitorFlash = 1.1; S.shift = 1; G.audio.play('shift'); }
    },

    pick(S, i) {
      if (!S.choice) return;
      const choice = S.choice.ev.choices[i];
      if (!choice) return;
      const [label, stat, amount, result] = choice;
      const p = S.player;
      S.stats[stat] += amount;
      if (stat === 'freedom') p.buffs.fury = S.time + BUFF_TIME;
      else if (stat === 'clarity') p.buffs.focus = S.time + BUFF_TIME;
      else {
        p.hp = p.maxHp;
        S.bots.forEach((b) => { b.alive = true; b.hp = b.maxHp; });
      }
      G.hud.hideChoice();
      G.hud.toast(result);
      G.hud.chat('system', '', `${label} → ${G.CONTENT.statName[stat]} +${amount}`, '#c8c4b4');
      S.choice = null;
      S.eventT = rnd(EVENT_GAP[0], EVENT_GAP[1]);
    },

    update(S, dt) {
      if (S.rule) { S.rule.left -= dt; if (S.rule.left <= 0) Rules.end(S); }
      else if (!S.won && !S.boss && S.stage === 1) {
        S.ruleT -= dt;
        if (S.ruleT <= 0) Rules.start(S, randomRule(S));
      }
      if (S.choice) {
        S.choice.left -= dt;
        G.hud.choiceTimer(S.choice.left / CHOICE_TIME);
        if (S.choice.left <= 0) Rules.pick(S, Math.floor(Math.random() * 3));
      } else if (!S.boss && !S.won) {
        S.eventT -= dt;
        if (S.eventT <= 0) Rules.openChoice(S);
      }
    },

    ending(S) {
      const by = (id) => G.GAME_DATA.endings.find((e) => e.id === id);
      if (S.items.has('출구 설계도')) return by('architect');
      if (S.stats.freedom >= 7) return by('unwrite');
      if (S.stats.clarity >= 6) return by('silence');
      if (S.stats.bond >= 6) return by('chorus');
      if (S.restored > G.Main.GATE_NEED) return by('stay');
      return by('open');
    },
  };

  G.Rules = Rules;
})(window.G);
