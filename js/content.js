'use strict';
window.G = window.G || {};
// 액션판 전용 수치와 짧은 문장. 인물·방·사건·결말의 원문은 data.js(GAME_DATA)를 그대로 쓴다.
G.GAME_DATA = window.GAME_DATA;
G.CONTENT = {
  colors: [[0.93, 0.72, 0.39], [0.62, 0.86, 0.54], [0.7, 0.88, 0.46], [0.9, 0.46, 0.45], [0.42, 0.76, 0.82], [0.72, 0.64, 0.9]],
  css: ['#edb865', '#9edc89', '#b3e075', '#e67573', '#6bc2d1', '#b8a3e6'],

  // 고유 능력: data.js의 ability 이름을 액션 효과로 옮김
  skills: [
    { name: '반례 찾기', cd: 14, desc: '주변 적이 4초간 뒤집혀 도망치고 받는 피해 +50%. 체력 25 회복.' },
    { name: '한 번 더, 왜?', cd: 14, desc: '7초간 모든 적이 빛나고 치명타 확률 +40%.' },
    { name: '장면 재편집', cd: 12, desc: '3초 전 위치·체력으로 되감기. 즉시 재장전.' },
    { name: '반응 읽기', cd: 16, desc: '5초간 적의 시간이 1/3로 느려진다.' },
    { name: '우회 동선', cd: 8, desc: '앞으로 순간 돌진하고 4초간 이동 속도 +50%.' },
    { name: '공백 만들기', cd: 13, desc: '충격파로 주변 적을 밀어내며 피해. 적 탄환 삭제.' },
  ],
  startWeapon: ['shotgun', 'rifle', 'helsi', 'pistol', 'smg', 'flash'],

  weapons: {
    pistol: { name: '셔터 피스톨', dmg: 20, rate: 4.5, spread: 0.012, mag: 14, reload: 1.0, pellets: 1, sfx: 'shot' },
    smg: { name: '우회 기관단총', dmg: 10, rate: 11, spread: 0.032, mag: 36, reload: 1.3, pellets: 1, sfx: 'smg' },
    shotgun: { name: '광각 샷건', dmg: 10, rate: 1.5, spread: 0.085, mag: 7, reload: 1.5, pellets: 8, sfx: 'shotgun' },
    rifle: { name: '망원 라이플', dmg: 62, rate: 1.5, spread: 0.002, mag: 6, reload: 1.7, pellets: 1, zoom: 26, sfx: 'rifle' },
    flash: { name: '플래시 캐논', dmg: 34, rate: 2.2, spread: 0.015, mag: 9, reload: 1.5, pellets: 1, splash: 2.4, sfx: 'flash' },
    helsi: { name: 'HELSI 레이저', dmg: 172, rate: 14, spread: 0.0015, mag: 12, reload: 2, pellets: 1, zoom: 42, sfx: 'laser', exclusive: true, beam: [0.64, 1, 0.34] },
  },
  rarity: [
    { name: '일반', mult: 1, color: '#d9d6c8', rgb: [0.85, 0.84, 0.78] },
    { name: '희귀', mult: 1.3, color: '#5aa9ff', rgb: [0.35, 0.66, 1] },
    { name: '영웅', mult: 1.65, color: '#c77dff', rgb: [0.78, 0.49, 1] },
    { name: '전설', mult: 2.1, color: '#ffb347', rgb: [1, 0.7, 0.28] },
  ],
  lootPrefix: ['주사위', '물음표', '필름', '프레스증', '시간표', '사물함 열쇠', '백지', '배터리', '로얄밀크티', '최종본_진짜최종', '2%'],

  // 예측 불가 요소: 30–50초마다 건물 규칙이 18초간 바뀐다
  rules: [
    { id: 'lowgrav', name: '저중력', sub: '점프가 세 배 높아진다' },
    { id: 'blackout', name: '정전', sub: '손전등만 남았다' },
    { id: 'mirror', name: '거울 세계', sub: '좌우가 뒤집혔다' },
    { id: 'lowres', name: 'ISO 25600', sub: '화질 붕괴 · 경험치 ×2' },
    { id: 'swarm', name: '잡음 폭주', sub: '왜곡체 무리가 몰려온다' },
    { id: 'lootrain', name: '보급 낙하', sub: '전리품이 쏟아진다' },
    { id: 'slowmo', name: '셔터 1/8000', sub: '적의 시간이 느려진다' },
    { id: 'giant', name: '거인 시점', sub: '벽 너머가 보인다 · 피해 ×1.5' },
    { id: 'shuffle', name: '방 섞기', sub: '파티 전체가 다른 방으로 튕겨진다' },
    { id: 'doppel', name: '접속자 7 / 6', sub: '누군가 접속했다. 아군일까?' },
    { id: 'explosive', name: '플래시 과충전', sub: '모든 총알이 폭발한다' },
    { id: 'burst', name: '연사 모드', sub: '연사 ×2 · 재장전 없음' },
  ],

  statName: { freedom: '자유', clarity: '명료', bond: '연결' },
  statHint: { freedom: '30초 피해 +25%', clarity: '30초 치명타 +30%', bond: '파티 전원 회복·부활' },

  endingHints: {
    open: '보스 처치 (기본)',
    architect: '접속자 7의 방 봉인에서 「출구 설계도」 획득',
    silence: '선택 사건으로 명료 6 이상',
    stay: '봉인 8개 이상 복원',
    chorus: '선택 사건으로 연결 6 이상',
    unwrite: '선택 사건으로 자유 7 이상',
  },

  // 가상의 월드 채팅. 실제 접속자가 아니라 분위기용 NPC 문장이다.
  worldNames: ['익명의 사슴', 'REC_0903', '날먹장인', '2퍼센트', '밀크티러버', '반례수집가', '무음모드', '최종본_v7', '사물함00', '포춘쿠키'],
  worldLines: [
    '저류조 입구 열어 본 사람?', '빈 객석에서 손 봤다는 사람?', '저중력 걸리면 서고 위에 올라가 봐', '전설 샷건 떴다 ㄷㄷ',
    '파티 구함 (5/6)', '접속자 7 누구임', '거울 세계 멀미남', '정전 때 손전등 꺼지면 끝', 'ISO 25600 화질 실화냐',
    '로얄밀크티 분기점 어디', '방 섞기로 출구 앞까지 날아감 ㅋㅋ', '플래시 캐논 개사기', '반향은 옆으로 피하면 됨',
  ],
  botLines: {
    idle: ['ㄱㄱ', '이 방 금방 끝남', '전리품 먹어', '뒤에 하나 더 있음', '오른쪽 조심', '봉인 어디?', '힐 차는 중'],
    kill: ['하나 정리', '나이스', 'ㅋㅋㅋ', '깔끔', '이거 내 킬'],
    rule: ['이번엔 뭐임', 'ㅋㅋㅋ 또 바뀜', '규칙 또 바뀌었다', '헐'],
    down: ['다운!', '살려줘', '아 맞았다'],
    up: ['복귀!', '다시 간다'],
    restore: ['복원 완료', '하나 더', '출구까지 얼마 안 남았다'],
  },
};
