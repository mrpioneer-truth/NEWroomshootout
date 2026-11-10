'use strict';
window.G = window.G || {};
// 연속된 건물 지도. 정적 메시, 충돌, 봉인문, 미니맵이 같은 타일을 사용한다.
(function (G) {
  const W = 268, H = 359, WALL_H = 5, VOID_H = 99, STEP_UP = 0.42, RAY_STEP = 0.08;
  const idx = (x, z) => z * W + x;
  const scale = (c, k) => c.map((v) => v * k);
  const METAL = [0.19, 0.21, 0.21], STEEL = [0.32, 0.36, 0.35], INK = [0.12, 0.135, 0.14];

  const PLAN = [
    { key: 'lobby', name: '입구 로비', cat: 'I / 체크인', bounds: [5, 4, 16, 13], focus: [8, 7], color: [0.68, 0.66, 0.48] },
    { key: 'filter', name: '공조실', cat: 'I / 이중 필터', bounds: [5, 21, 22, 14], focus: [12, 8], waves: ['auto', 'auto'], color: [0.49, 0.65, 0.49], memoryId: 5 },
    { key: 'weave', name: '직조실', cat: 'I / 방호 기둥', bounds: [33, 18, 22, 20], focus: [12, 10], boss: 'weaver', mark: [15, 10], color: [0.68, 0.48, 0.33], memoryId: 0 },
    { key: 'archive', name: '기록 서고', cat: 'I / 삼중 서가', bounds: [41, 44, 27, 15], focus: [12, 8], waves: ['auto', 'auto'], color: [0.49, 0.55, 0.7], memoryId: 2 },
    { key: 'theatre', name: '빈 객석', cat: 'I / 계단식 극장', bounds: [75, 41, 18, 22], focus: [9, 13], boss: 'marionette', mark: [10, 13], color: [0.72, 0.37, 0.36], memoryId: 3 },
    { key: 'white', name: '백색 현상실', cat: 'I / 교차 차광막', bounds: [74, 69, 23, 18], focus: [11, 10], boss: 'whiteout', mark: [12, 11], color: [0.65, 0.71, 0.67], memoryId: 1 },
    { key: 'detour', name: '우회 수송로', cat: 'I / 두 갈래 보행로', bounds: [42, 73, 26, 17], focus: [11, 9], waves: ['auto', 'auto', 'auto'], color: [0.78, 0.63, 0.32], memoryId: 4 },
    { key: 'gantry', name: '송신 격납고', cat: 'I / 고가 송신기', bounds: [42, 96, 25, 18], focus: [12, 9], boss: 'strider', mark: [13, 12], color: [0.47, 0.6, 0.63], memoryId: 6 },
    { key: 'reservoir', name: '침수 저류조', cat: 'II / 지하 저류조', bounds: [28, 123, 52, 41], focus: [25, 19], spawn: [25, 5], boss: 'drowned', prelude: [{ noise: 3, echo: 2 }, { noise: 3, echo: 3, glitch: 2 }], mark: [26, 22], stage: 2, wall: 8, color: [0.28, 0.53, 0.54], fog: [0.04, 0.08, 0.08], fogDist: 60 },
    { key: 'orchard', name: '검은 과수원', cat: 'III / 야외 격리 구역', bounds: [91, 124, 64, 46], focus: [33, 23], spawn: [5, 21], boss: 'family', prelude: [{ noise: 3, echo: 3 }, { noise: 2, echo: 3, glitch: 3 }, { echo: 4, glitch: 3 }], mark: [39, 23], stage: 3, wall: 7, color: [0.61, 0.43, 0.34], fog: [0.102, 0.068, 0.052], fogDist: 68 },
    { key: 'procession', name: '봉헌 회랑', cat: 'IV / 지하 행렬', bounds: [99, 178, 39, 28], focus: [20, 17], spawn: [20, 4], waves: [{ noise: 2, echo: 2, glitch: 2 }, { noise: 3, echo: 3, glitch: 3 }, { noise: 2, echo: 4, glitch: 4 }], stage: 4, wall: 7, color: [0.62, 0.58, 0.40], fog: [0.086, 0.073, 0.047], memory: ['숲을 빠져나온 것은 일행뿐이었다. 발소리는 여섯을 넘었다.'] },
    { key: 'choir', name: '백색 수도원', cat: 'IV / 지하 합창석', bounds: [148, 174, 43, 38], focus: [22, 20], spawn: [4, 18], boss: 'chorus', prelude: [{ noise: 3, echo: 3, glitch: 2 }, { noise: 2, echo: 4, glitch: 3 }], mark: [25, 19], stage: 4, wall: 9, color: [0.69, 0.69, 0.55], fog: [0.093, 0.096, 0.073], fogDist: 62 },
    { key: 'spindles', name: '추의 회랑', cat: 'V / 교차 통로', bounds: [145, 222, 40, 24], focus: [22, 13], spawn: [20, 4], waves: [{ noise: 3, echo: 3 }, { noise: 2, echo: 4, glitch: 3 }, { noise: 3, echo: 3, glitch: 4 }], stage: 5, wall: 7, color: [0.44, 0.46, 0.65], fog: [0.049, 0.055, 0.09], memory: ['추가 한 번 떨어질 때마다 장막 너머의 목이 자라났다.'] },
    { key: 'well', name: '장막 우물', cat: 'V / 마른 수직갱', bounds: [197, 219, 40, 32], focus: [21, 16], spawn: [4, 14], boss: 'neck', prelude: [{ noise: 3, echo: 3, glitch: 2 }, { echo: 4, glitch: 4 }], mark: [23, 16], stage: 5, wall: 10, color: [0.4, 0.49, 0.58], fog: [0.049, 0.07, 0.086], fogDist: 58 },
    { key: 'wake', name: '무명 수장고', cat: 'V / 분실 기록실', bounds: [198, 260, 40, 26], focus: [18, 13], spawn: [21, 4], waves: [{ noise: 2, echo: 2, glitch: 2 }, { noise: 2, echo: 4, glitch: 3 }, { noise: 2, echo: 2, glitch: 3, ghost: 1 }, { echo: 4, glitch: 4, ghost: 1 }], stage: 5, wall: 7, color: [0.56, 0.45, 0.57], fog: [0.078, 0.05, 0.078], memory: ['기록에는 두 이름만 남아 있었다. 바알제붑과 아자토스.'] },
    { key: 'dance', name: '장례 무도장', cat: 'V / 흰 막 아래', bounds: [147, 259, 41, 37], focus: [19, 17], spawn: [36, 15], boss: 'shroud', prelude: [{ noise: 2, echo: 4, glitch: 3 }, { echo: 3, glitch: 4, ghost: 1 }], mark: [18, 18], stage: 5, wall: 8, color: [0.61, 0.56, 0.66], fog: [0.091, 0.064, 0.086], fogDist: 60 },
    { key: 'vestibule', name: '첫 울음의 전실', cat: 'VI / 출생 기록실', bounds: [144, 307, 47, 30], focus: [24, 17], spawn: [25, 4], waves: [{ noise: 2, echo: 4, glitch: 1, ghost: 1 }, { noise: 2, echo: 3, glitch: 3, ghost: 2 }, { noise: 3, echo: 3, glitch: 4, ghost: 2 }], stage: 6, wall: 8, color: [0.61, 0.40, 0.40], fog: [0.087, 0.047, 0.047], memory: ['바알제붑의 날개와 아자토스의 꿈은 같은 어둠에서 태어났다. 그 어둠에는 이름이 없었다.'] },
    { key: 'origin', name: '발생 이전의 천막', cat: 'VI / 최초의 출생', bounds: [201, 306, 62, 47], focus: [36, 23], spawn: [5, 17], boss: 'origin', prelude: [{ noise: 3, echo: 4, glitch: 3 }, { echo: 4, glitch: 4, ghost: 2 }], mark: [39, 23], stage: 6, final: true, wall: 13, color: [0.51, 0.48, 0.48], fog: [0.093, 0.079, 0.078], fogDist: 74, amb: 0.68 },
    { key: 'seventh', name: '일곱 번째 자리', cat: 'I / 잠긴 기록', bounds: [14, 47, 18, 16], focus: [9, 8], side: true, secret: true, color: [0.61, 0.5, 0.65] },
    { key: 'storage', name: '보조 창고', cat: 'I / 잔류 신호', bounds: [14, 73, 19, 16], focus: [9, 8], side: true, color: [0.69, 0.54, 0.44], memoryId: 8 },
  ];

  // 좌표는 맞닿는 두 방의 통로 중심. 경로는 꺾이고, 서고와 수송로에서 옆방으로 갈라진다.
  const LINKS = [
    ['lobby', 'filter', 'z', 13, 5], ['filter', 'weave', 'x', 28, 5],
    ['weave', 'archive', 'z', 48, 5], ['archive', 'theatre', 'x', 50, 5],
    ['theatre', 'white', 'z', 82, 5], ['white', 'detour', 'x', 79, 5],
    ['detour', 'gantry', 'z', 53, 5], ['gantry', 'reservoir', 'z', 53, 7],
    ['reservoir', 'orchard', 'x', 145, 7],
    ['orchard', 'procession', 'z', 119, 7], ['procession', 'choir', 'x', 192, 7],
    ['choir', 'spindles', 'z', 165, 7], ['spindles', 'well', 'x', 233, 7],
    ['well', 'wake', 'z', 219, 7], ['wake', 'dance', 'x', 274, 7],
    ['dance', 'vestibule', 'z', 169, 7], ['vestibule', 'origin', 'x', 323, 9],
    ['archive', 'seventh', 'x', 52, 5], ['detour', 'storage', 'x', 81, 5],
  ];

  function rng(seed) {
    let s = (seed >>> 0) || 0x9e3779b9;
    return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
  }

  // 좌표는 각 방의 원점 기준. box는 순수 시각 효과, block은 충돌도 만드는 설비다.
  const DESIGN = {
    lobby({ box, block, floor, c }) {
      floor(7.45, 1, 1.1, 11, scale(c, 0.75));
      block(2, 3, 4, 2, 1.05, STEEL);
      block(11, 8, 3, 1, 0.55, METAL);
      box(2.1, 1.05, 3.1, 3.8, 0.11, 1.8, c);
      box(2.5, 1.16, 3.2, 1.35, 0.58, 0.3, INK);
      box(2.65, 1.35, 3.18, 1, 0.24, 0.04, [0.29, 0.68, 0.53]);
      box(7, 3.9, 11.9, 2, 0.2, 0.1, c);
    },
    filter({ box, block, floor, c }) {
      block(3, 5, 7, 1, 3.25);
      block(14, 9, 5, 1, 3.7);
      for (let x = 4; x <= 9; x++) {
        box(x + 0.12, 0.28, 4.91, 0.11, 2.7, 0.11, METAL);
        box(x + 0.12, 0.28, 5.99, 0.11, 2.7, 0.11, METAL);
      }
      for (const x of [3, 17]) {
        block(x, 10, 2, 2, 1.1, METAL);
        box(x, 1.1, 10.7, 2, 0.22, 0.55, c);
      }
      for (const x of [4, 17]) box(x, 3.85, 2, 0.24, 0.25, 9.5, STEEL);
      floor(7.4, 1, 1.2, 3, scale(c, 0.8));
      floor(9, 7.4, 12, 0.7, scale(c, 0.7));
    },
    weave({ box, block, floor, c }) {
      for (const x of [4, 16]) for (const z of [4, 14]) {
        block(x, z, 2, 2, 4.2, scale(c, 0.67));
        box(x - 0.12, 3.4, z - 0.12, 2.24, 0.18, 2.24, c);
        box(x + 0.35, 3.56, z + 0.9, 1.3, 0.16, 12 - (z - 4), METAL);
      }
      for (const z of [5, 15]) {
        box(3, 3.7, z, 16, 0.16, 0.2, METAL);
        for (let x = 4; x <= 17; x += 2) box(x, 3.23, z, 0.065, 0.5, 0.065, c);
      }
      for (let i = 0; i < 7; i++) floor(8 + i, 6, 0.1, 8, scale(c, 0.64 + i * 0.04));
    },
    archive({ box, block, floor, c }) {
      for (const x of [8, 15, 21]) {
        block(x, 2, 1, 3, 2.45, METAL);
        block(x, 9, 1, 4, 2.45, METAL);
        for (const y of [0.35, 1.05, 1.78]) {
          box(x - 0.1, y, 2, 1.2, 0.1, 3, c);
          box(x - 0.1, y, 9, 1.2, 0.1, 4, c);
        }
      }
      floor(1, 6.4, 24.8, 2.6, scale(c, 0.58));
      box(2, 3.6, 7, 23, 0.14, 0.2, scale(c, 1.12));
    },
    theatre({ box, block, floor, c }) {
      for (const x of [2, 13]) for (let i = 0; i < 5; i++) {
        const h = 0.33 + (4 - i) * 0.28, z = 3 + 2 * i;
        block(x, z, 3, 1, h, scale(c, 0.5 + i * 0.06));
        box(x, h, z + 0.12, 3, 0.085, 0.13, c);
      }
      block(3, 16, 12, 2, 0.36, scale(c, 0.54));
      floor(6.5, 2, 4, 14, scale(c, 0.7));
      for (const x of [2.2, 15.6]) {
        box(x, 0.3, 14, 0.22, 4.2, 0.4, c);
        box(x, 4.35, 4, 0.2, 0.16, 11, METAL);
      }
      box(2, 4.4, 14, 14, 0.35, 0.35, scale(c, 0.65));
    },
    white({ box, block, floor, c }) {
      block(5, 4, 1, 5, 2.55, scale(c, 0.7));
      block(16, 8, 1, 6, 2.55, scale(c, 0.7));
      for (let i = 0; i < 4; i++) {
        box(5.44, 2.61 + i * 0.28, 4, 0.12, 0.14, 5, c);
        box(16.44, 2.61 + i * 0.28, 8, 0.12, 0.14, 6, c);
      }
      for (const x of [3, 9, 14, 20]) box(x, 4.2, 2, 0.24, 0.1, 12, c);
      for (const z of [3, 7, 11, 15]) floor(2, z, 19, 0.1, scale(c, 0.74));
    },
    detour({ box, block, floor, c }) {
      block(7, 5, 13, 2, 1.65, METAL);
      box(7, 1.65, 5.2, 13, 0.26, 1.6, STEEL);
      block(7, 11, 13, 2, 0.28, scale(c, 0.5));
      block(8, 11, 11, 2, 0.55, scale(c, 0.55));
      block(9, 11, 9, 2, 0.82, scale(c, 0.62));
      floor(3, 7.9, 20, 0.28, scale(c, 0.86));
      floor(7, 14, 12, 0.28, scale(c, 0.86));
      for (const x of [7, 13, 19]) box(x, 2, 5.86, 0.18, 1.3, 0.18, c);
      box(7, 3.25, 5.86, 12.18, 0.2, 0.18, c);
    },
    gantry({ box, block, floor, c }) {
      for (const x of [4, 19]) for (const z of [5, 11]) {
        block(x, z, 2, 2, 1.2, METAL);
        box(x + 0.65, 1.2, z + 0.65, 0.7, 4.2, 0.7, c);
      }
      for (const z of [5.8, 11.8]) box(4.5, 5.05, z, 17, 0.42, 0.36, STEEL);
      for (const x of [6, 18]) box(x, 4.9, 3, 0.18, 0.18, 12, c);
      for (let x = 8; x <= 16; x += 2) floor(x, 3, 0.15, 11, scale(c, 0.62));
    },
    reservoir({ box, block, floor, c }) {
      floor(2, 2, 48, 37, [0.12, 0.28, 0.29]);
      for (const x of [7, 36]) for (const z of [8, 27]) {
        block(x, z, 7, 4, 0.76, [0.23, 0.32, 0.3]);
        block(x + 2, z + 1, 3, 2, 2.35, METAL);
        box(x, 0.79, z + 0.15, 7, 0.08, 0.22, c);
      }
      for (const x of [15, 34]) for (const z of [6, 19, 32]) {
        block(x, z, 2, 2, 4.5, METAL);
        box(x - 0.12, 3.7, z - 0.12, 2.24, 0.17, 2.24, c);
      }
      for (const x of [5, 46]) box(x, 5.9, 5, 0.75, 0.74, 31, STEEL);
      floor(23.3, 1, 4.4, 39, [0.28, 0.32, 0.31], 0.027);
      floor(2, 19.9, 48, 4.2, [0.29, 0.33, 0.32], 0.03);
      for (let i = 0; i < 18; i++) {
        const x = 1.8 + i * 2.65;
        floor(x, 3 + i % 4 * 0.4, 1.25, 0.13, scale(c, 0.74), 0.026);
        floor(x, 37 - i % 4 * 0.4, 1.25, 0.13, scale(c, 0.69), 0.026);
      }
    },
    orchard({ box, block, floor, c, rand }) {
      const bark = [0.19, 0.147, 0.112], ash = [0.29, 0.21, 0.157];
      for (const [x, z] of [[6, 5], [6, 33], [15, 9], [17, 36], [25, 4], [31, 38], [38, 6], [46, 36], [53, 5], [55, 31], [58, 12], [59, 38], [61, 20]]) {
        const h = 4.9 + rand() * 2.4;
        block(x, z, 2, 2, h, bark);
        box(x - 1.7, h - 1.4, z + 0.5, 2.3, 0.44, 0.7, ash);
        box(x - 1.68, h - 1.2, z + 0.55, 0.32, 1.65, 0.35, bark);
        box(x + 1.7, h - 0.8, z + 0.4, 1.9, 0.48, 0.8, bark);
        box(x + 3.05, h - 0.56, z + 0.55, 0.42, 1.4, 0.45, ash);
        box(x - 0.7, h - 0.05, z - 0.55, 4, 0.32, 2.2, bark);
        for (let i = 0; i < 4; i++) floor(x - 1 + i, z + 2.2, 0.45, 0.5, ash);
      }
      floor(3, 20.1, 49, 1.7, scale(c, 0.59));
      for (let i = 0; i < 40; i++) {
        const a = i / 40 * Math.PI * 2;
        floor(34 + Math.cos(a) * 12, 23 + Math.sin(a) * 10, 0.7, 0.7, scale(c, 0.88));
        floor(34 + Math.cos(a) * 9.5, 23 + Math.sin(a) * 8, 0.28, 0.28, scale(c, 0.63));
      }
      for (const x of [23, 47]) for (const z of [14, 31]) {
        block(x, z, 1, 1, 1.1, ash);
        box(x + 0.23, 1.15, z + 0.23, 0.54, 0.2, 0.54, c);
      }
    },
    procession({ box, block, floor, c }) {
      floor(17.5, 1, 4, 26, scale(c, 0.58));
      for (const x of [6, 12, 25, 31]) for (const z of [6, 13, 20]) {
        block(x, z, 2, 2, 1.05, METAL);
        box(x + 0.25, 1.05, z + 0.28, 1.5, 2.8, 1.45, scale(c, 0.51));
        box(x + 0.69, 3.84, z + 0.65, 0.58, 0.67, 0.7, scale(c, 1.05));
        box(x + 0.69, 3.23, z + 0.23, 0.58, 0.12, 0.09, c);
      }
      for (const z of [8, 14, 20, 25]) floor(3, z, 32, 0.16, scale(c, 0.79));
    },
    choir({ box, block, floor, c }) {
      floor(2, 16.4, 39, 3.6, scale(c, 0.65));
      floor(16.3, 3, 2.5, 32, scale(c, 0.67));
      for (const x of [7, 12, 18, 25, 31, 36]) {
        for (const z of [7, 25]) {
          block(x, z, 1, 5, 0.82, scale(c, 0.5));
          box(x - 0.09, 0.82, z, 0.16, 0.28, 5, c);
        }
      }
      for (const x of [4, 38]) for (const z of [4, 32]) {
        block(x, z, 2, 2, 7.8, scale(c, 0.49));
        box(x - 0.22, 6.9, z - 0.22, 2.44, 0.28, 2.44, c);
      }
      for (const x of [4.5, 38.5]) box(x, 7.4, 4, 0.36, 0.42, 30, METAL);
    },
    spindles({ box, block, floor, c }) {
      for (const [x, z, d] of [[6, 3, 10], [14, 11, 10], [26, 3, 10], [33, 11, 10]]) {
        block(x, z, 1, d, 2.2, STEEL);
        box(x, 2.2, z, 1, 0.23, d, c);
        for (let i = z; i < z + d; i += 3) {
          box(x + 0.38, 3.8, i, 0.23, 2.8, 0.23, METAL);
          box(x - 0.1, 3.35, i - 0.23, 1.2, 0.66, 0.7, scale(c, 0.76));
        }
      }
      for (const x of [3, 11, 21, 30, 37]) floor(x, 2, 0.16, 20, scale(c, 0.8));
    },
    well({ box, block, floor, c }) {
      for (let z = 4; z < 28; z += 1) {
        const half = 15 * Math.sqrt(1 - Math.pow((z - 16) / 12, 2));
        floor(23 - half, z, Math.max(half * 2, 0.2), 1, [0.073, 0.083, 0.112]);
      }
      for (let i = 0; i < 52; i++) {
        const a = i / 52 * Math.PI * 2;
        floor(22.5 + Math.sin(a) * 15, 15.5 + Math.cos(a) * 12, 0.65, 0.65, scale(c, 0.94), 0.024);
      }
      for (const [x, z] of [[5, 4], [33, 4], [5, 25], [33, 25]]) {
        block(x, z, 2, 2, 4.8, METAL);
        box(x - 0.14, 4.1, z - 0.14, 2.28, 0.17, 2.28, c);
      }
      for (const z of [5, 25]) box(5, 7.9, z, 30, 0.28, 0.42, scale(c, 0.52));
    },
    wake({ box, block, floor, c }) {
      for (const x of [7, 12, 26, 31]) for (const z of [5, 18]) {
        block(x, z, 2, 4, 2.75, scale(c, 0.44));
        for (const y of [0.65, 1.45, 2.25]) {
          box(x - 0.035, y, z - 0.09, 2.07, 0.09, 4.18, STEEL);
          box(x + 0.4, y + 0.15, z - 0.1, 1.2, 0.27, 0.14, c);
        }
      }
      floor(1, 11, 37, 3, scale(c, 0.55));
      for (const x of [8, 17, 24, 33]) box(x, 4.1, 4, 0.2, 0.17, 17, c);
    },
    dance({ box, block, floor, c }) {
      for (let z = 9; z < 28; z++) for (let x = 9; x < 30; x++) {
        floor(x, z, 1, 1, scale(c, (x + z) % 2 === 0 ? 0.36 : 0.72));
      }
      for (const [x, z] of [[6, 4], [32, 4], [6, 29], [32, 29]]) {
        block(x, z, 1, 4, 3.2, scale(c, 0.64));
        for (let i = 0; i < 4; i++) {
          box(x - 0.12, 0.35 + i * 0.4, z + i, 0.15, 2.8 - i * 0.4, 0.35, scale(c, 1.13));
        }
        box(x - 0.16, 3.24, z - 0.16, 1.32, 0.16, 4.32, METAL);
      }
      for (const z of [4, 30]) box(5, 4.5, z, 29, 0.18, 0.2, c);
    },
    vestibule({ box, block, floor, c }) {
      floor(21.5, 1, 6, 28, scale(c, 0.55));
      for (const z of [7, 14, 21]) {
        for (const x of [10, 35]) {
          block(x, z, 2, 2, 4.8, scale(c, 0.51));
          box(x - 0.13, 3.9, z - 0.13, 2.26, 0.25, 2.26, c);
        }
        box(10, 4.55, z + 0.6, 27, 0.42, 0.72, METAL);
      }
      for (let i = 0; i < 8; i++) {
        const x = 20.6 - i * 0.9, z = 5 + i * 1.9;
        floor(x, z, 0.62, 0.62, c);
        floor(47 - x, z, 0.62, 0.62, c);
      }
    },
    origin({ box, block, floor, c }) {
      const bone = [0.61, 0.58, 0.52], velvet = [0.25, 0.075, 0.081], coal = [0.082, 0.071, 0.072];
      floor(1, 15.5, 27, 3.3, scale(c, 0.62));
      for (let i = 0; i < 60; i++) {
        const angle = i / 60 * Math.PI * 2, x = Math.cos(angle), z = Math.sin(angle);
        floor(38.6 + x * 14, 22.6 + z * 11, 0.79, 0.79, i % 2 ? velvet : bone);
        floor(38.8 + x * 11.5, 22.8 + z * 8.9, 0.4, 0.4, bone);
      }
      for (const z of [4, 40]) for (const x of [7, 18, 30, 42, 54]) {
        block(x, z, 2, 2, 3.65, coal);
        box(x - 0.12, 3.65, z - 0.12, 2.24, 0.22, 2.24, velvet);
        box(x + 0.78, 3.88, z + 0.78, 0.42, 6.9, 0.42, scale(bone, 0.66));
      }
      for (const z of [2, 44]) for (let x = 2; x < 60; x += 4) {
        box(x, 5.6, z, 3.9, 5.1, 0.14, x % 8 < 4 ? velvet : scale(bone, 0.64));
      }
      for (const z of [11, 34]) box(3, 10.6, z, 55, 0.15, 0.15, scale(bone, 0.54));
    },
    seventh({ box, block, floor, c }) {
      for (let i = 0; i < 7; i++) {
        block(2 + i * 2, 3, 1, 1, 0.7, METAL);
        box(2 + i * 2, 0.7, 3, 1, i === 3 ? 1.3 : 0.58, 0.16, c);
      }
      floor(5, 5, 8, 6, scale(c, 0.55));
      box(4, 3.3, 3.1, 10, 0.16, 0.2, c);
    },
    storage({ box, block, c }) {
      for (const [x, z, w, d, h] of [[2, 2, 3, 3, 2.6], [4, 11, 2, 3, 1.25], [12, 3, 3, 2, 1.8], [13, 11, 3, 3, 2.25]]) {
        block(x, z, w, d, h, METAL);
        box(x, 0.52, z - 0.02, w, 0.12, 0.09, c);
        box(x, h, z, w, 0.12, d, scale(c, 0.71));
      }
    },
  };

  function build(seed, data) {
    const rand = rng(seed);
    const cells = new Float32Array(W * H).fill(VOID_H);
    const roomIndex = new Int16Array(W * H).fill(-1);
    const gateMask = new Uint8Array(W * H);
    const gates = [], staticVerts = [];
    const box = (x, y, z, w, h, d, col) => G.gfx.pushBox(staticVerts, x, y, z, w, h, d, col);

    const rooms = PLAN.map((p, slot) => {
      const [x0, z0, width, depth] = p.bounds;
      const info = data.rooms[p.memoryId];
      const absolute = ([x, z]) => [x0 + x, z0 + z];
      const stage = p.stage || 1;
      const isLobby = p.key === 'lobby';
      const room = {
        ...p, slot, stage, x0, z0, width, depth, wall: p.wall || WALL_H,
        focus: absolute(p.focus), spawn: absolute(p.spawn || p.focus), mark: p.mark && absolute(p.mark),
        entryYaw: 0, isLobby, isSecret: !!p.secret, required: !isLobby && !p.side && (stage === 1 || !!p.waves),
        tier: isLobby ? 0 : stage > 1 ? stage + 1 : Math.min(3, 1 + Math.floor((slot - 1) / 3)),
        owner: info && info.owner, memory: p.secret ? ['일곱 번째 자리가 출구를 향해 돌아가 있었다.'] : p.memory || info?.memory || [],
        visited: false, active: false, cleared: isLobby, restored: false,
      };
      for (let z = z0; z < z0 + depth; z++) for (let x = x0; x < x0 + width; x++) {
        cells[idx(x, z)] = 0;
        roomIndex[idx(x, z)] = slot;
      }
      box(x0, -0.11, z0, width, 0.11, depth, scale(p.color, stage > 1 ? 0.53 : 0.46));
      return room;
    });
    const named = new Map(rooms.map((r) => [r.key, r]));
    const gateRows = new Map(), incoming = new Map();
    const corridorTint = [0.26, 0.28, 0.24];
    const corridorCells = new Set();
    LINKS.forEach(([from, to, axis, at, span]) => {
      const a = named.get(from), b = named.get(to);
      const alongX = axis === 'x';
      const start = (r) => alongX ? r.x0 : r.z0;
      const end = (r) => start(r) + (alongX ? r.width : r.depth);
      const forward = start(a) < start(b);
      const lo = forward ? end(a) - 1 : end(b) - 1;
      const hi = forward ? start(b) : start(a);
      const half = (span - 1) / 2;
      const xy = (d, n) => alongX ? [d, n] : [n, d];
      const row = [];
      b.entryYaw = alongX ? (forward ? Math.PI / 2 : -Math.PI / 2) : (forward ? 0 : Math.PI);
      for (let d = lo; d <= hi; d++) for (let n = at - half; n <= at + half; n++) {
        const [x, z] = xy(d, n);
        cells[idx(x, z)] = 0;
        if (d > lo && d < hi) corridorCells.add(idx(x, z));
      }
      const [sx, sz] = xy(lo + 1, at - half);
      const length = hi - lo - 1;
      box(sx, -0.11, sz, alongX ? length : span, 0.11, alongX ? span : length, corridorTint);
      const color = scale(b.color, 0.92);
      for (const n of [at - half + 1.18, at + half - 0.21]) {
        const [x, z] = xy(lo + 0.3, n);
        box(x, 0.006, z, alongX ? length + 1.4 : 0.12, 0.012, alongX ? 0.12 : length + 1.4, color);
      }
      // 바닥 점선과 화살촉. 큰 구역으로 향하는 방향이 문 앞에서 읽힌다.
      for (let d = lo + 2; d < hi - 1; d += 3) {
        const [x, z] = xy(d, at + 0.35);
        box(x, 0.007, z, alongX ? 1 : 0.25, 0.013, alongX ? 0.25 : 1, color);
      }
      if (!b.side) {
        const d = Math.floor((lo + hi) / 2);
        for (let n = at - half + 1; n <= at + half - 1; n++) {
          const [x, z] = xy(d, n);
          row.push(idx(x, z));
        }
        gates.push(...row);
        gateRows.set(a, row);
        incoming.set(b, row);
        b.entry = xy(d + 0.5, at + 0.5);
        for (const side of [-1, 1]) {
          for (let i = 0; i < 4; i++) {
            const [x, z] = xy(d + 0.42 + (forward ? -1 : 1) * (1 + i * 0.21), at + 0.42 + side * i * 0.21);
            box(x, 0.013, z, 0.25, 0.01, 0.25, color);
          }
          const [x, z] = xy(d + 0.2, at + (side < 0 ? -half + 0.91 : half - 0.06));
          box(x, 0.35, z, alongX ? 0.6 : 0.16, 4.5, alongX ? 0.16 : 0.6, scale(color, 0.65));
        }
        const [fx, fz] = xy(d + 0.16, at - half + 0.85);
        box(fx, WALL_H, fz, alongX ? 0.66 : span - 1.7, 0.55, alongX ? span - 1.7 : 0.66, METAL);
        box(fx, WALL_H + 0.11, fz, alongX ? 0.7 : span - 1.7, 0.09, alongX ? span - 1.7 : 0.7, color);
        a.next = b;
      }
    });

    // 각 외벽은 한 타일 두께. 통로와 맞닿는 곳에는 문 너비만큼 개구부가 남는다.
    for (let z = 1; z < H - 1; z++) for (let x = 1; x < W - 1; x++) {
      const i = idx(x, z);
      if (cells[i] !== 0 || !(roomIndex[i] >= 0 || corridorCells.has(i))) continue;
      if ([i - 1, i + 1, i - W, i + W].every((n) => cells[n] !== VOID_H)) continue;
      const r = rooms[roomIndex[i]];
      const wall = r ? r.wall : WALL_H;
      const c = r ? scale(r.color, 0.42) : scale(corridorTint, 0.85);
      const tone = 0.87 + rand() * 0.24;
      cells[i] = wall;
      box(x, 0, z, 1, wall, 1, scale(c, tone));
      if ((x + z) % 3 === 0) box(x - 0.018, 0.72, z - 0.018, 1.036, 0.095, 1.036, scale(c, 1.42));
      if ((x + z) % 7 === 0) box(x - 0.025, wall - 0.5, z - 0.025, 1.05, 0.23, 1.05, scale(c, 1.37));
    }

    rooms.forEach((r) => {
      const localBox = (x, y, z, w, h, d, col) => box(r.x0 + x, y, r.z0 + z, w, h, d, col);
      const block = (x, z, w, d, h, col = scale(r.color, 0.65)) => {
        for (let j = z; j < z + d; j++) for (let i = x; i < x + w; i++) {
          const n = idx(r.x0 + i, r.z0 + j);
          cells[n] = Math.max(cells[n], h);
        }
        localBox(x, -0.001, z, w, h, d, col);
      };
      const floor = (x, z, w, d, col, y = 0.016) => localBox(x, y, z, w, 0.008, d, col);
      DESIGN[r.key]({ box: localBox, block, floor, c: r.color, rand });
    });

    const setGate = (row, closed) => {
      if (!row) return;
      for (const i of row) {
        gateMask[i] = closed ? 1 : 0;
        cells[i] = closed ? WALL_H : 0;
      }
    };
    gateRows.forEach((row, room) => setGate(row, !room.isLobby));

    const inBounds = (x, z) => x >= 0 && z >= 0 && x < W && z < H;
    const heightAt = (x, z) => inBounds(x, z) ? cells[idx(Math.floor(x), Math.floor(z))] : VOID_H;
    const roomAt = (x, z) => inBounds(x, z) ? rooms[roomIndex[idx(Math.floor(x), Math.floor(z))]] || null : null;

    const blocked = (x, z, r, foot) => {
      for (let iz = Math.floor(z - r); iz <= Math.floor(z + r); iz++) {
        for (let ix = Math.floor(x - r); ix <= Math.floor(x + r); ix++) {
          if (heightAt(ix, iz) > foot + STEP_UP) return true;
        }
      }
      return false;
    };

    const groundAt = (x, z, r, foot) => {
      let g = 0;
      for (let iz = Math.floor(z - r); iz <= Math.floor(z + r); iz++) {
        for (let ix = Math.floor(x - r); ix <= Math.floor(x + r); ix++) {
          const h = heightAt(ix, iz);
          if (h <= foot + STEP_UP && h > g) g = h;
        }
      }
      return g;
    };

    const move = (a, dx, dz) => {
      let hit = false;
      if (!blocked(a.x + dx, a.z, a.r, a.y)) a.x += dx; else hit = true;
      if (!blocked(a.x, a.z + dz, a.r, a.y)) a.z += dz; else hit = true;
      return hit;
    };

    const raycast = (ox, oy, oz, dx, dy, dz, max) => {
      for (let t = 0; t < max; t += RAY_STEP) {
        const y = oy + dy * t;
        if (y < 0 || y < heightAt(ox + dx * t, oz + dz * t)) return t;
      }
      return max;
    };

    const los = (a, ay, b, by) => {
      const dx = b.x - a.x, dy = by - ay, dz = b.z - a.z, d = Math.hypot(dx, dy, dz);
      return d < 0.01 || raycast(a.x, ay, a.z, dx / d, dy / d, dz / d, d) >= d - 0.05;
    };

    const freeSpot = (room, ax, az, minD, used = []) => {
      let best = room.focus, score = -Infinity;
      for (let i = 0; i < 90; i++) {
        const x = room.x0 + 2.5 + Math.floor(Math.random() * (room.width - 4));
        const z = room.z0 + 2.5 + Math.floor(Math.random() * (room.depth - 4));
        if (blocked(x, z, 0.85, 0) || heightAt(x, z) !== 0) continue;
        const playerD = Math.hypot(x - ax, z - az);
        const spacing = used.reduce((d, [xx, zz]) => Math.min(d, Math.hypot(x - xx, z - zz)), Infinity);
        if (playerD >= minD && spacing >= 1.8) return [x, z];
        const rank = Math.min(playerD / Math.max(1, minD), spacing / 1.8);
        if (rank > score) { best = [x, z]; score = rank; }
      }
      return best;
    };

    const mapBounds = {
      1: [4, 3, 95, 121], 2: [26, 116, 62, 50], 3: [83, 121, 74, 56],
      4: [96, 170, 99, 48], 5: [140, 212, 103, 92], 6: [140, 296, 126, 59],
    };
    const lobby = named.get('lobby');
    return {
      W, H, WALL_H, VOID_H, cells, gateMask, gates, rooms, staticVerts, heightAt, roomAt,
      move, groundAt, raycast, los, freeSpot, blocked, mapBounds, lobby,
      openFrom: (room) => setGate(gateRows.get(room), false),
      sealEntrance: (room, closed) => setGate(incoming.get(room), closed),
      // 접속자: 방장이 보낸 닫힌 문 목록으로 맞춘다. 바뀐 것이 있으면 true.
      setClosedGates: (closed) => {
        const want = new Set(closed);
        let changed = false;
        for (const i of gates) {
          const shut = want.has(i);
          if (!!gateMask[i] === shut) continue;
          gateMask[i] = shut ? 1 : 0;
          cells[i] = shut ? WALL_H : 0;
          changed = true;
        }
        return changed;
      },
      center: (room) => room.focus,
    };
  }

  G.World = { build, sealsNeeded: PLAN.filter((p) => p.key !== 'lobby' && !p.side && !p.stage).length };
})(window.G);
