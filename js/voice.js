'use strict';
window.G = window.G || {};
// 봉헌 회랑(IV)부터 들려오는 목소리. 두 단어마다 무서운 남자·미친 여자·소녀·소년으로 바뀐다.
// 이름은 VI 구역에 들어설 때까지 말하지 않는다.
(function (G) {
  const FIRST_STAGE = 4, AMBIENT_GAP = [26, 46], FIRST_DELAY = 9, WORDS_PER_VOICE = 2;
  const SUB_HOLD_MS = 2600;
  const LOCALE = { ko: 'ko-KR', en: 'en-US', ja: 'ja-JP' };
  // 일부 시스템 음성은 우스꽝스러워 제외한다.
  const NOVELTY = /bahh|bells|boing|bubbles|cellos|good news|bad news|jester|organ|superstar|trinoids|wobble|zarvox|albert/i;
  const MALE = /\bmale\b|otoya|hattori|ichiro|keita|takumi|daniel|fred|alex|aaron|arthur|gordon|ralph|oliver|thomas|james|george|david|mark|guy|tom|jian|minsu|injoon|hyunsu|bong|whisper|eddy|reed|rocko|grandpa|junior|rishi/i;
  const FEMALE = /female/i;

  // 인물: 목소리 풀, 음높이, 속도. 약간의 흔들림을 더해 매번 다르게 들린다.
  const PERSONAS = {
    // prefer: 인물에 가장 어울리는 시스템 음성 이름. 없으면 같은 성별, 그것도 없으면 그 언어의 아무 음성.
    man: { pool: 'male', prefer: /grandpa|rocko|whisper|fred|ralph|otoya|hattori|daniel/i, pitch: 0.08, rate: 0.7, jitter: 0.05 },
    madwoman: { pool: 'female', prefer: /shelley|grandma|moira|karen/i, pitch: 1.78, rate: 1.4, jitter: 0.18 },
    girl: { pool: 'female', prefer: /sandy|flo|kyoko|유나|yuna|samantha|kathy/i, pitch: 2, rate: 0.94, jitter: 0.06 },
    boy: { pool: 'male', prefer: /eddy|junior|reed/i, pitch: 1.72, rate: 1.02, jitter: 0.08, fallbackPitch: 1.3 },
  };
  const PERSONA_IDS = Object.keys(PERSONAS);

  const LINES = {
    ambient: [
      { ko: '당신 심장, 지금 분당 백십이 번 뛰어요. 내가 세고 있었어. 한 번도 안 틀렸지.', en: "Your heart is beating one hundred and twelve times a minute. I've been counting. I haven't missed a single one, have I?", ja: 'あなたの 心臓、 いま 一分間に 百十二回 打ってますよ。 ずっと 数えてた。 一度も 間違えて ないでしょ。' },
      { ko: '문이 열린 게 아니에요. 내가 당신을 들이마신 거야.', en: "The door didn't open. I breathed you in.", ja: '扉が 開いたんじゃ ありません。 わたしが あなたを 吸い込んだの。' },
      { ko: '여섯이 들어왔는데 발소리는 일곱이에요. 세어 봐. 아, 뒤는 돌아보지 말고.', en: "Six of you came in. I count seven sets of footsteps. Go on, count them. Just don't turn around.", ja: '六人で 入ってきたのに、 足音は 七つ です。 数えて みな。 ああ、 振り返っちゃ だめ。' },
      { ko: '빛은 일 초에 삼십만 킬로미터를 가요. 그런데 여기까지는 아직 못 왔어. 앞으로도 못 와.', en: "Light travels three hundred thousand kilometers a second. It still hasn't reached this place. It never will.", ja: '光は 一秒で 三十万キロ 進みます。 なのに ここには まだ 届いてない。 これからも 届かない よ。' },
      { ko: '렌즈는 세상을 거꾸로 맺어요. 당신이 보는 건 전부 뒤집힌 거야. 나만 빼고.', en: 'A lens forms every image upside down. Everything you see is inverted. Everything except me.', ja: 'レンズは 世界を 逆さに 結びます。 あなたが 見てるもの、 全部 逆さま。 わたし 以外は ね。' },
      { ko: '엄마 뱃속 기억나요? 난 기억해. 거기가 원래 내 방이었거든.', en: 'Do you remember the womb? I do. It was my room long before it was yours.', ja: 'お母さんの お腹の中、 覚えて ますか。 わたしは 覚えてる。 あそこ、 もともと わたしの 部屋 だったから。' },
      { ko: '쏜 총알 수 다 세고 있어요. 마지막 한 발은 내가 정해 줄게.', en: "I'm counting every bullet you fire. I'll be the one who decides the last.", ja: '撃った 弾の数、 全部 数えて ますよ。 最後の 一発は、 わたしが 決めて あげる。' },
      { ko: '숨 참지 마요. 어차피 그 숨, 처음부터 내 거였어.', en: "Don't hold your breath. That breath was mine to begin with.", ja: '息を 止めないで。 どうせ その息、 最初から わたしの もの だった。' },
      { ko: '죽으면 끝이라고 배웠죠? 귀엽다. 끝은 태어나기 전부터 거기 있었어요.', en: 'They taught you that death is the end. How sweet. The end was waiting before you were born.', ja: '死んだら 終わりって 習いました よね。 かわいい。 終わりは 生まれる 前から そこに あったのに。' },
      { ko: '파티원들 눈 깜빡이는 간격, 재 봤어요? 다섯 다 정확히 같아. 사람은 그렇게 못 해.', en: "Have you timed how your friends blink? The exact same interval, all five of them. People can't do that.", ja: '仲間の まばたきの 間隔、 測って みました? 五人とも ぴったり 同じ。 人間には できない よ。' },
      { ko: '녹화 버튼, 누가 눌렀는지 기억나요? 당신 손가락은 아니었어.', en: "Do you remember who pressed record? It wasn't your finger.", ja: '録画ボタン、 誰が 押したか 覚えて ますか。 あなたの 指じゃ なかった よ。' },
      { ko: '엔트로피는 절대 줄지 않아요. 당신이 나갈 확률은 절대 늘지 않고. 우주는 원래 공평하거든.', en: 'Entropy never decreases. Your odds of leaving never increase. The universe is fair like that.', ja: 'エントロピーは 決して 減らない。 あなたが 出られる 確率は 決して 増えない。 宇宙って 公平 でしょ。' },
      { ko: '괜찮아요. 아프지 않게 해 줄게. 아픈 건 기억하는 쪽이니까.', en: "It's alright. I'll make it painless. Pain belongs to whoever remembers.", ja: '大丈夫 ですよ。 痛く しないから。 痛いのは、 覚えてる ほう だから。' },
      { ko: '지금 들리는 거, 귀로 듣는 거 아니에요. 고막은 아직 조용해. 난 그 안쪽에 있어.', en: "You're not hearing this with your ears. Your eardrums are perfectly still. I'm further in than that.", ja: 'いま 聞こえてる これ、 耳で 聞いてる んじゃない。 鼓膜は 静かな まま。 わたしは もっと 内側に いる。' },
      { ko: '자는 동안 당신은 밤마다 두 번씩 여기 와요. 깨면 잊는 것뿐이지. 오늘은 안 잊게 해 줄게.', en: "You come here twice a night in your sleep. You just forget when you wake. Tonight I'll let you remember.", ja: '眠ってる 間、 あなたは 毎晩 二度 ここに 来てる。 起きたら 忘れる だけ。 今夜は 忘れさせて あげない。' },
      { ko: '벽 안에 든 건 콘크리트가 아니야. 당신보다 먼저 온 사람들이에요. 아직 숨 쉬어.', en: "That isn't concrete inside the walls. It's the people who came before you. They're still breathing.", ja: '壁の 中にあるの、 コンクリートじゃ ない。 あなたより 先に 来た 人たち です。 まだ 息 してる。' },
    ],
    stage4: { ko: '아, 드디어 내 목소리가 닿네요. 오래 기다렸어. 정확히는, 당신이 태어나기 전부터.', en: "Ah. My voice finally reaches you. I've waited so long. Since before you were born, to be precise.", ja: 'ああ、 やっと 声が 届きました ね。 ずっと 待ってた。 正確には、 あなたが 生まれる 前から。' },
    stage5: { ko: '장막 너머에서 목이 자라는 소리, 들려요? 잘 들어 봐. 그거 당신 목이야.', en: "Can you hear a neck growing behind the veil? Listen closely. It's your neck.", ja: '幕の 向こうで 首が 伸びる 音、 聞こえ ますか。 よく 聞いて。 それ、 あなたの 首 だよ。' },
    stage6: { ko: '이제 이름을 알려 줄게요. 나는 무명태. 이름 없는 것들이 처음 태어난 자궁이야. 바알제붑도 아자토스도 내 안에서 울었어.', en: 'Now I will tell you my name. I am Mumyeongtae. The womb where every nameless thing was first born. Beelzebub and Azathoth both cried inside me.', ja: 'そろそろ 名前を 教えて あげる。 わたしは ムミョンテ。 名前の ないものが 最初に 生まれた 子宮。 ベルゼブブも アザトースも、 わたしの 中で 泣いたの。' },
    awake: { ko: '가면 벗었어요. 이제 보이지? 그래, 이게 처음부터 당신 얼굴이었어.', en: 'The mask is off. Now you see it? Yes. This was your face all along.', ja: '仮面を 外し ました。 見える でしょ。 そう、 これが 最初から あなたの 顔 だった。' },
    down: { ko: '또 접속하네요. 돌아올 때마다 조금씩 덜 돌아와. 눈치챘어?', en: 'Reconnecting again. A little less of you comes back each time. Have you noticed?', ja: 'また 接続 するんですね。 戻るたびに 少しずつ 減ってる。 気づいてた?' },
    duel: { ko: '패를 섞을게요. 눈 깜빡이면 진 거야. 당신 눈꺼풀은 내 편이고.', en: "I'll shuffle the deck. Blink and you lose. And your eyelids are on my side.", ja: '札を 切ります ね。 まばたき したら 負け。 あなたの まぶたは わたしの 味方 だけど。' },
    duelWin: { ko: '잘 봤네요. 그 눈, 마음에 들어. 나중에 가져갈게.', en: "Good eyes. I like them. I'll take them later.", ja: 'よく 見えて ますね。 その目、 気に入った。 あとで もらう ね。' },
    duelLose: { ko: '틀렸어요. 괜찮아, 처음부터 정답은 없었으니까.', en: "Wrong. It's alright. There was never a right answer.", ja: 'はずれ です。 いいの、 最初から 正解なんて なかった から。' },
    exit: { ko: '나간다고요? 좋아요. 문 밖도 내 안이야.', en: 'Leaving? Fine. Outside the door is still inside me.', ja: '出ていく んですか。 いいですよ。 扉の 外も、 わたしの 中 だから。' },
  };

  const synth = window.speechSynthesis || null;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  let lang = 'ko', pools = { male: [], female: [], any: [] }, ambientT = FIRST_DELAY, deck = [], lastPersona = null;
  let subTimer = 0, speaking = false;
  const said = new Set();

  function classify() {
    if (!synth) return;
    const voices = synth.getVoices().filter((v) => v.lang && v.lang.toLowerCase().replace('_', '-').startsWith(lang) && !NOVELTY.test(v.name));
    const male = voices.filter((v) => MALE.test(v.name) && !FEMALE.test(v.name));
    const female = voices.filter((v) => !male.includes(v));
    pools = { male, female, any: voices };
  }

  function chunks(text) {
    const words = text.split(/\s+/).filter(Boolean);
    const out = [];
    for (let i = 0; i < words.length; i += WORDS_PER_VOICE) out.push(words.slice(i, i + WORDS_PER_VOICE).join(lang === 'ja' ? '' : ' '));
    return out;
  }

  function nextPersona() {
    const options = PERSONA_IDS.filter((id) => id !== lastPersona);
    lastPersona = options[Math.floor(Math.random() * options.length)];
    return PERSONAS[lastPersona];
  }

  function voiceFor(persona) {
    const own = pools[persona.pool];
    const preferred = own.filter((v) => persona.prefer.test(v.name));
    const list = preferred.length ? preferred : own.length ? own : pools.any;
    return { voice: list.length ? list[Math.floor(Math.random() * list.length)] : null, native: own.length > 0 };
  }

  function utter(text, persona) {
    const u = new SpeechSynthesisUtterance(text);
    const { voice, native } = voiceFor(persona);
    u.lang = LOCALE[lang];
    if (voice) u.voice = voice;
    const basePitch = native || persona.fallbackPitch === undefined ? persona.pitch : persona.fallbackPitch;
    u.pitch = clamp(basePitch + rnd(-persona.jitter, persona.jitter), 0, 2);
    u.rate = clamp(persona.rate + rnd(-persona.jitter, persona.jitter), 0.5, 2);
    u.volume = 1;
    return u;
  }

  function subtitle(el, parts, shown) {
    el.innerHTML = '';
    parts.slice(0, shown).forEach((p) => {
      const span = document.createElement('span');
      span.textContent = p + (lang === 'ja' ? '' : ' ');
      el.appendChild(span);
    });
    el.classList.toggle('show', shown > 0);
  }

  function speak(line) {
    const text = line && line[lang];
    if (!text || !G.audio.isOn()) return;
    const parts = chunks(text);
    const el = document.getElementById('whisper');
    clearTimeout(subTimer);
    if (!synth) {
      subtitle(el, parts, parts.length);
      subTimer = setTimeout(() => el.classList.remove('show'), SUB_HOLD_MS + parts.length * 500);
      return;
    }
    synth.cancel();
    speaking = true;
    // onstart를 보내지 않는 브라우저도 있어 끝난 조각 기준으로도 자막을 넘긴다.
    let shown = 1;
    const advance = (n) => { if (n > shown) { shown = n; subtitle(el, parts, n); } };
    subtitle(el, parts, 1);
    parts.forEach((part, i) => {
      const u = utter(part, nextPersona());
      u.onstart = () => advance(i + 1);
      const done = () => {
        advance(Math.min(parts.length, i + 2));
        if (i !== parts.length - 1) return;
        speaking = false;
        subTimer = setTimeout(() => el.classList.remove('show'), SUB_HOLD_MS);
      };
      u.onend = done;
      u.onerror = (ev) => {
        if (ev.error !== 'interrupted' && ev.error !== 'canceled') console.warn('음성 합성 오류:', ev.error);
        done();
      };
      synth.speak(u);
    });
  }

  function shuffled(n) {
    const a = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  const Voice = {
    setLang(id) {
      lang = LOCALE[id] ? id : 'ko';
      document.documentElement.dataset.voice = lang;
      classify();
    },

    lang: () => lang,

    // 사용자 클릭 안에서 한 번 불러야 브라우저가 이후 음성 합성을 허용한다.
    unlock() {
      if (!synth) return;
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      synth.speak(u);
    },

    say(key) {
      if (!LINES[key] || Array.isArray(LINES[key])) return;
      speak(LINES[key]);
    },

    // 한 번만 들려줄 대사(구역 진입 등)
    once(key) {
      if (said.has(key)) return;
      said.add(key);
      Voice.say(key);
    },

    stop() {
      if (synth) synth.cancel();
      speaking = false;
      const el = document.getElementById('whisper');
      if (el) el.classList.remove('show');
    },

    update(S, dt) {
      if (S.stage < FIRST_STAGE || S.won) return;
      if (speaking || (synth && synth.speaking)) return;
      ambientT -= dt;
      if (ambientT > 0) return;
      ambientT = rnd(AMBIENT_GAP[0], AMBIENT_GAP[1]);
      if (!deck.length) deck = shuffled(LINES.ambient.length);
      speak(LINES.ambient[deck.pop()]);
    },
  };

  if (synth && synth.addEventListener) synth.addEventListener('voiceschanged', classify);
  G.Voice = Voice;
})(window.G);
