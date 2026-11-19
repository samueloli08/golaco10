
(() => {
  'use strict';

  /* =========================================================
  Utilidades
  ========================================================= */
  const $ = (id) => document.getElementById(id);
  const DEBUG = location.hash === '#debug';
  const stage = $('stage');
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const clamp =(v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const angDiff = (a, b) => {
    let d = a - b;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return d;
  };
  function gauss() {
    let u = 0, v = 0;
    while (!u) u = Math.random();
    while (!v) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  const store = {
    get(k, d) {
      try {
        const v = localStorage.getItem('golaco10:' + k);
        return v === null ? d : JSON.parse(v);
      } catch (e) {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem('golaco10:' + k, JSON.stringify(v));
      } catch (e) {
      /* sem armazenamento */ }
    }
  };
  const fmtTime = (s) => {
    s = Math.max(0, Math.ceil(s));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  };
  const fmtPts = (n) => Math.round(n).toLocaleString('pt-BR');
  const code3 = (name, fb) => (name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || fb;

  /* =========================================================
  Campo (coordenadas do mundo: 1280 x 720)
  ========================================================= */
  const W = 1280, H = 720;
  const F = { l: 90, r: 1190, t: 118, b: 688 };
  F.w = F.r - F.l;
  F.h = F.b - F.t;
  F.cx = (F.l + F.r) / 2;
  F.cy = (F.t + F.b) / 2;
  const GOAL_HALF = 78, GT = F.cy - GOAL_HALF, GB = F.cy + GOAL_HALF, GOAL_DEPTH = 40;
  const POST_R = 4.5, BALL_R = 7, PR = 14;
  const STEP = 1 / 60;
  const BOX_D = 175, BOX_H = 175, SBOX_D = 62, SBOX_H = 104, PEN_X = 122;

  const ownGoalX = (t) => t === 'home' ? F.l : F.r;
  const atkGoalX = (t) => t === 'home' ? F.r : F.l;
  const fwd = (t) => t === 'home' ? 1 : -1;
  const other = (t) => t === 'home' ? 'away' : 'home';

  /* =========================================================
  Uniformes, fases e níveis de dificuldade
  ========================================================= */
  const SKINS = ['#f1c7a3', '#d9a27a', '#b97a50', '#8d5a3a', '#6b4129', '#e8b896'];
  const HAIRS = ['#1b120c', '#2b1a10', '#4a2d16', '#0d0d0d', '#6b4423', '#c9a36a', '#8a3b12'];
  const KIT_HOME = { shirt: '#ffd23f', trim: '#0f8a4a', shorts: '#2348c9', socks: '#f4f1e8', num: '#0f8a4a' };
  const KIT_P2_VS = { shirt: '#2a5bd7', trim: '#f4f1e8', shorts: '#f4f1e8', socks: '#2a5bd7', num: '#f4f1e8' };
  const KIT_GK_HOME = { shirt: '#18242b', trim: '#3ddc84', shorts: '#18242b', socks: '#18242b', num: '#3ddc84', gloves: '#3ddc84' };
  const KIT_GK_VS = { shirt: '#ff7a1a', trim: '#1a1a1a', shorts: '#1a1a1a', socks: '#ff7a1a', num: '#1a1a1a', gloves: '#f4f1e8' };
  const gkKit = (shirt, trim) => ({ shirt, trim, shorts: '#1a1a1a', socks: shirt, num: trim, gloves: '#f4f1e8' });

  const PHASES = [
    { name: 'Amistoso na várzea', rival: 'Tartarugas FC',
      kit: { shirt: '#d9412f', trim: '#ffe1c2', shorts: '#2b0f0c', socks: '#d9412f', num: '#ffe1c2' }, gk: gkKit('#5a5a5a', '#ffe1c2'),
      n: 1, spd: 150, trap: 380, tackle: .26, tackleCD: 1.25, shootRange: 250, acc: .45, passProb: .25, dashProb: 0,
      k: { spd: 135, react: .42, err: 1.4, catchV: 450 }, goals: 2, time: 90 },
    { name: 'Campeonato estadual', rival: 'Tubarões EC',
      kit: { shirt: '#1597b8', trim: '#f4f1e8', shorts: '#0b3f52', socks: '#1597b8', num: '#f4f1e8' }, gk: gkKit('#c2185b', '#f4f1e8'),
      n: 2, spd: 165, trap: 420, tackle: .32, tackleCD: 1.15, shootRange: 280, acc: .55, passProb: .35, dashProb: .1,
      k: { spd: 155, react: .35, err: 1.15, catchV: 480 }, goals: 2, time: 100 },
    { name: 'Copa nacional', rival: 'Leões da Serra',
      kit: { shirt: '#ef8a17', trim: '#1d1d1d', shorts: '#1d1d1d', socks: '#ef8a17', num: '#1d1d1d' }, gk: gkKit('#6a1b9a', '#f4f1e8'),
      n: 2, spd: 180, trap: 460, tackle: .4, tackleCD: 1.05, shootRange: 310, acc: .63, passProb: .45, dashProb: .2,
      k: { spd: 178, react: .3, err: .95, catchV: 520 }, goals: 3, time: 120 },
    { name: 'Libertadores', rival: 'Cóndores CF',
      kit: { shirt: '#f4f1e8', trim: '#14213d', shorts: '#14213d', socks: '#f4f1e8', num: '#14213d' }, gk: gkKit('#2e7d32', '#f4f1e8'),
      n: 3, spd: 190, trap: 500, tackle: .46, tackleCD: 1, shootRange: 330, acc: .7, passProb: .5, dashProb: .3,
      k: { spd: 210, react: .23, err: .72, catchV: 560 }, goals: 3, time: 130 },
    { name: 'Semifinal do Mundial', rival: 'Dragões United',
      kit: { shirt: '#7b2cbf', trim: '#e0c3fc', shorts: '#3c096c', socks: '#7b2cbf', num: '#e0c3fc' }, gk: gkKit('#00897b', '#f4f1e8'),
      n: 3, spd: 200, trap: 540, tackle: .52, tackleCD: .95, shootRange: 350, acc: .76, passProb: .55, dashProb: .38,
      k: { spd: 222, react: .2, err: .66, catchV: 590 }, goals: 3, time: 140 },
    { name: 'Final do Mundial', rival: 'Titãs Imperiais',
      kit: { shirt: '#121826', trim: '#c9a227', shorts: '#121826', socks: '#121826', num: '#c9a227' }, gk: gkKit('#d32f2f', '#f4f1e8'),
      n: 4, spd: 205, trap: 580, tackle: .55, tackleCD: .9, shootRange: 360, acc: .76, passProb: .6, dashProb: .45,
      k: { spd: 236, react: .17, err: .6, catchV: 620 }, goals: 3, time: 150 },
  ];
  const HOME_K = { spd: 210, react: .24, err: .75, catchV: 540 };
  const VERSUS = { name: 'Clássico', goals: 5, time: 180, n: 0, spd: 200, trap: 900, tackle: .4, tackleCD: 1, shootRange: 320, acc: .7, passProb: .4, dashProb: .2, k: { spd: 196, react: .27, err: .9, catchV: 540 }
  };
  const DEMO = { name: 'Demo', goals: 99, time: 9999, n: 2, spd: 205, trap: 480, tackle: .4, tackleCD: 1.05, shootRange: 330, acc: .68, passProb: .5, dashProb: .3, k: { spd: 200, react: .26, err: .9, catchV: 540 }
  };

  const FORM = {
    1: [[.36, .5]],
    2: [[.3, .33], [.3, .67]],
    3: [[.24, .5], [.42, .27], [.42, .73]],
    4: [[.22, .34], [.22, .66], [.44, .26], [.44, .74]],
    5: [[.2, .5], [.3, .24], [.3, .76], [.5, .36], [.5, .64]],
  };

  /* =========================================================
  Som (Web Audio, tudo sintetizado)
  ========================================================= */
  const Sfx = (() => {
    let ac = null, master = null, nbuf = null, ambGain = null;
    let muted = store.get('muted', false);
    function init() {
      if (ac) {
        if (ac.state === 'suspended') ac.resume().catch(() => {});
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        ac = new AC();
      } catch (e) {
        ac = null;
        return;
      }
      master = ac.createGain();
      master.gain.value = muted ? 0 : .8;
      master.connect(ac.destination);
      const len = ac.sampleRate * 2;
      nbuf = ac.createBuffer(1, len, ac.sampleRate);
      const d = nbuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const amb = ac.createBufferSource();
      amb.buffer = nbuf;
      amb.loop = true;
      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 520;
      bp.Q.value = .6;
      ambGain = ac.createGain();
      ambGain.gain.value = .04;
      amb.connect(bp).connect(ambGain).connect(master);
      amb.start();
    }
    function env(g, t, a, peak, dur) {
      g.gain.setValueAtTime(.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(.0002, peak), t + a);
      g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    }
    function tone(f, dur, type, peak, f2, delay) {
      if (!ac || muted) return;
      const t = ac.currentTime + (delay || 0);
      const o = ac.createOscillator();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(f, t);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
      const g = ac.createGain();
      env(g, t, .005, peak, dur);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + dur + .05);
    }
    function noise(dur, ftype, freq, peak, attack, delay, q) {
      if (!ac || muted) return;
      const t = ac.currentTime + (delay || 0);
      const s = ac.createBufferSource();
      s.buffer = nbuf;
      const f = ac.createBiquadFilter();
      f.type = ftype;
      f.frequency.value = freq;
      f.Q.value = q || 1;
      const g = ac.createGain();
      env(g, t, attack || .004, peak, dur);
      s.connect(f).connect(g).connect(master);
      s.start(t, Math.random() * 1.5);
      s.stop(t + dur + .05);
    }
    function whistle(n) {
      if (!ac || muted) return;
      for (let i = 0; i < n; i++) {
        const t = ac.currentTime + i * .34;
        const long = (n > 1 && i === n - 1) ? .62 : .24;
        const o = ac.createOscillator();
        o.type = 'sine';
        o.frequency.value = 2850;
        const lfo = ac.createOscillator();
        lfo.frequency.value = 34;
        const lg = ac.createGain();
        lg.gain.value = 150;
        lfo.connect(lg).connect(o.frequency);
        const g = ac.createGain();
        g.gain.setValueAtTime(.0001, t);
        g.gain.exponentialRampToValueAtTime(.14, t + .02);
        g.gain.setValueAtTime(.14, t + long - .05);
        g.gain.exponentialRampToValueAtTime(.0001, t + long);
        o.connect(g).connect(master);
        o.start(t);
        lfo.start(t);
        o.stop(t + long + .05);
        lfo.stop(t + long + .05);
      }
    }
    return {
      init,
      get muted() {
        return muted;
      },
      setMuted(m) {
        muted = m;
        store.set('muted', m);
        if (master) master.gain.value = m ? 0 : .8;
      },
      excite(v) {
        if (ambGain && ac) ambGain.gain.setTargetAtTime(.035 + v * .07, ac.currentTime, .4);
      },
      kick(p) {
        tone(150, .14, 'sine', .4 + p * .3, 45);
        noise(.05, 'lowpass', 2200, .18 + p * .25);
      },
      pass() {
        tone(175, .1, 'sine', .3, 60);
        noise(.04, 'lowpass', 1600, .12);
      },
      post() {
        tone(1180, .5, 'triangle', .22);
        tone(1760, .35, 'sine', .1);
      },
      tackle() {
        noise(.16, 'lowpass', 500, .45);
        tone(95, .14, 'sine', .3, 45);
      },
      dash() {
        noise(.18, 'bandpass', 3000, .1, .03, 0, .8);
      },
      catchBall() {
        tone(240, .08, 'sine', .28, 120);
        noise(.05, 'lowpass', 900, .22);
      },
      whistle,
      goal() {
        noise(3.2, 'bandpass', 700, .5, .35, 0, .5);
        noise(2.6, 'bandpass', 1500, .2, .4, .1, .7);
        tone(233, 1, 'sawtooth', .05);
        tone(349, 1, 'sawtooth', .04, null, .02);
      },
      ole() {
        noise(.7, 'bandpass', 820, .16, .15, 0, .6);
      },
      groan() {
        noise(1.2, 'lowpass', 420, .22, .2);
      },
      beep(hi) {
        tone(hi ? 988 : 660, hi ? .3 : .12, 'square', .07);
      },
      click() {
        tone(520, .05, 'square', .05);
      },
    };
  })();

  /* =========================================================
  Estado do jogo
  ========================================================= */
  const G = {
    mode: 'demo', phaseIdx: 0, ph: DEMO,
    players: [], keepers: {}, cpu: { home: DEMO, away: DEMO }, roles: { home: {}, away: {}
    },
    score: { home: 0, away: 0 }, time: 0, golden: false, clock: 0,
    state: 'idle', cdT: 0, cdLen: 2.6, goalT: 0, overT: 0, goFlash: 0, demoT: 0,
    kickoffTeam: 'home', points: 0, phaseStartPoints: 0, matchPoints: 0,
    lastPass: null, lastDribble: new Map(), particles: [], floaters: [], net: null, shake: 0,
    names: store.get('names', ['Craque', 'Artilheiro']),
    paused: false, resultShown: false, lastTick: -1, inMatch: false,
  };
  const ball = { x: F.cx, y: F.cy, vx: 0, vy: 0, z: 0, vz: 0, rot: 0, owner: null, lastKicker: null, kickTime: -1, shot: null, noTouch: null, noTouchT: 0, trail: [] };
  const isCampaign = () => G.mode === 'solo' || G.mode === 'coop';

  function newPlayer(o) {
    return Object.assign({
      x: F.cx, y: F.cy, vx: 0, vy: 0, dvx: 0, dvy: 0, r: PR, face: 0,
      team: 'home', role: 'field', human: -1, name: '', num: 0, kit: KIT_HOME,
      skin: SKINS[0], hair: HAIRS[0], hairStyle: 0, speed: 200,
      charge: 0, charging: false, dashT: 0, dashCD: 0, slideT: 0, recoverT: 0, stunT: 0,
      tackleCD: 0, pokeCD: 0, lungeT: 0, decideT: 0, kickAnim: 0, diveT: 0, diveDir: 0,
      anim: Math.random() * 6, hold: 0, aimY: F.cy, formI: 0, formN: 1, dribbled: new Set(),
      stats: { goals: 0, shots: 0, steals: 0, dribbles: 0, assists: 0 },
      kp: null, err: 0, reactLeft: 0, shotId: -1, dived: false, lastTy: F.cy,
    }, o);
  }

  function setupMatch() {
    const mode = G.mode;
    const ph = mode === 'versus' ? VERSUS : mode === 'demo' ? DEMO : PHASES[G.phaseIdx];
    G.ph = ph;
    G.players = [];
    G.score = { home: 0, away: 0 };
    G.time = ph.time;
    G.golden = false;
    G.clock = 0;
    G.matchPoints = 0;
    G.lastPass = null;
    G.lastDribble = new Map();
    G.particles = [];
    G.floaters = [];
    G.net = null;
    G.shake = 0;
    G.resultShown = false;
    G.lastTick = -1;
    G.demoT = 0;
    const add = (p) => {
      G.players.push(p);
      return p;
    };
    const [n1, n2] = G.names;

    if (mode === 'solo' || mode === 'coop') {
      G.cpu.home = Object.assign({}, DEMO, { k: HOME_K });
      G.cpu.away = ph;
      add(newPlayer({ team: 'home', human: 0, name: n1, num: 10, kit: KIT_HOME, skin: '#c58c5c', hair: '#1b120c', hairStyle: 1, speed: 240 }));
      if (mode === 'coop') add(newPlayer({ team: 'home', human: 1, name: n2, num: 11, kit: KIT_HOME, skin: '#8d5a3a', hair: '#0d0d0d', hairStyle: 2, speed: 240 }));
      const n = Math.min(5, ph.n + (mode === 'coop' ? 1 : 0));
      const nums = [4, 3, 6, 8, 5];
      for (let i = 0; i < n; i++) add(newPlayer({ team: 'away', num: nums[i], kit: ph.kit, skin: pick(SKINS), hair: pick(HAIRS), hairStyle: i % 4, speed: ph.spd, formI: i, formN: n }));
      G.keepers.home = add(newPlayer({ team: 'home', role: 'keeper', num: 1, kit: KIT_GK_HOME, kp: HOME_K, speed: HOME_K.spd, r: 15, skin: '#e8b896', hair: '#4a2d16', hairStyle: 2 }));
      G.keepers.away = add(newPlayer({ team: 'away', role: 'keeper', num: 1, kit: ph.gk, kp: ph.k, speed: ph.k.spd, r: 15, skin: pick(SKINS), hair: pick(HAIRS), hairStyle: 0 }));
    } else if (mode === 'versus') {
      G.cpu.home = VERSUS;
      G.cpu.away = VERSUS;
      add(newPlayer({ team: 'home', human: 0, name: n1, num: 10, kit: KIT_HOME, skin: '#c58c5c', hair: '#1b120c', hairStyle: 1, speed: 240 }));
      add(newPlayer({ team: 'away', human: 1, name: n2, num: 9, kit: KIT_P2_VS, skin: '#8d5a3a', hair: '#0d0d0d', hairStyle: 2, speed: 240 }));
      G.keepers.home = add(newPlayer({ team: 'home', role: 'keeper', num: 1, kit: KIT_GK_HOME, kp: VERSUS.k, speed: VERSUS.k.spd, r: 15, skin: '#e8b896', hair: '#4a2d16', hairStyle: 2 }));
      G.keepers.away = add(newPlayer({ team: 'away', role: 'keeper', num: 1, kit: KIT_GK_VS, kp: VERSUS.k, speed: VERSUS.k.spd, r: 15, skin: '#b97a50', hair: '#1b120c', hairStyle: 0 }));
    } else {
      G.cpu.home = DEMO;
      G.cpu.away = DEMO;
      for (let i = 0; i < 2; i++) add(newPlayer({ team: 'home', num: [10, 9][i], kit: KIT_HOME, skin: pick(SKINS), hair: pick(HAIRS), hairStyle: i + 1, speed: 210, formI: i, formN: 2 }));
      for (let i = 0; i < 2; i++) add(newPlayer({ team: 'away', num: [7, 11][i], kit: PHASES[3].kit, skin: pick(SKINS), hair: pick(HAIRS), hairStyle: i, speed: 210, formI: i, formN: 2 }));
      G.keepers.home = add(newPlayer({ team: 'home', role: 'keeper', num: 1, kit: KIT_GK_HOME, kp: DEMO.k, speed: DEMO.k.spd, r: 15 }));
      G.keepers.away = add(newPlayer({ team: 'away', role: 'keeper', num: 1, kit: PHASES[3].gk, kp: DEMO.k, speed: DEMO.k.spd, r: 15 }));
    }
  }

  function resetBall() {
    Object.assign(ball, { x: F.cx, y: F.cy, vx: 0, vy: 0, z: 0, vz: 0, owner: null, lastKicker: null, shot: null, noTouch: null, noTouchT: 0 });
    ball.trail.length = 0;
  }

  function placeForKickoff(team) {
    resetBall();
    G.kickoffTeam = team;
    G.lastPass = null;
    for (const p of G.players) {
      Object.assign(p, { vx: 0, vy: 0, dvx: 0, dvy: 0, charging: false, charge: 0, dashT: 0, slideT: 0, recoverT: 0, stunT: 0, diveT: 0, hold: 0, kickAnim: 0, lungeT: 0 });
      p.face = p.team === 'home' ? 0 : Math.PI;
    }
    for (const T of ['home', 'away']) {
      const s = -fwd(T); // do centro para o próprio gol
      const fps = G.players.filter((p) => p.team === T && p.role === 'field');
      const humans = fps.filter((p) => p.human >= 0), cpus = fps.filter((p) => p.human < 0);
      humans.forEach((p, i) => {
        p.x = F.cx + s * 130;
        p.y = humans.length > 1 ? F.cy + (i ? 95 : -95) : F.cy;
      });
      for (const p of cpus) {
        const [u, v] = FORM[p.formN][p.formI];
        p.x = ownGoalX(T) - s * u * F.w;
        if (Math.abs(p.x - F.cx) < 105) p.x = F.cx + s * 105;
        p.y = F.t + v * F.h;
      }
      if (T === team) {
        const taker = humans[0] || cpus[0];
        if (taker) {
          taker.x = F.cx + s * 24;
          taker.y = F.cy;
        }
      }
      const k = G.keepers[T];
      k.x = ownGoalX(T) + fwd(T) * 22;
      k.y = F.cy;
      k.face = T === 'home' ? 0 : Math.PI;
    }
  }

  /* =========================================================
  Entrada: teclado, toque e controle
  ========================================================= */
  const keys = new Set();
  const KEYMAP = [
    { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], shoot: ['KeyF', 'Space'], dash: ['KeyG', 'ShiftLeft'] },
    { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], shoot: ['KeyK', 'Enter', 'NumpadEnter', 'Numpad1'], dash: ['KeyL', 'ShiftRight', 'Numpad2'] },
  ];
  const GAME_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
  const anyKey = (list) => list.some((k) => keys.has(k));
  const touch = { slots: [{ x: 0, y: 0, shoot: false, dash: false }, { x: 0, y: 0, shoot: false, dash: false }] };
  const pads = [null, null];
  const prevIn = [{ shoot: false, dash: false }, { shoot: false, dash: false }];
  const NO_INPUT = { x: 0, y: 0, shoot: false, shootPressed: false, shootReleased: false, dashPressed: false };

  function readInput(slot) {
    const maps = G.mode === 'solo' ? KEYMAP : [KEYMAP[slot]];
    let x = 0, y = 0, shoot = false, dash = false;
    for (const m of maps) {
      if (anyKey(m.left)) x -= 1;
      if (anyKey(m.right)) x += 1;
      if (anyKey(m.up)) y -= 1;
      if (anyKey(m.down)) y += 1;
      if (anyKey(m.shoot)) shoot = true;
      if (anyKey(m.dash)) dash = true;
    }
    x = clamp(x, -1, 1);
    y = clamp(y, -1, 1);
    const t = touch.slots[slot];
    x += t.x;
    y += t.y;
    shoot = shoot || t.shoot;
    dash = dash || t.dash;
    const gp = pads[slot];
    if (gp) {
      x += gp.x;
      y += gp.y;
      shoot = shoot || gp.shoot;
      dash = dash || gp.dash;
    }
    const prev = prevIn[slot];
    const res = { x: clamp(x, -1, 1), y: clamp(y, -1, 1), shoot, shootPressed: shoot && !prev.shoot, shootReleased: !shoot && prev.shoot, dashPressed: dash && !prev.dash };
    prev.shoot = shoot;
    prev.dash = dash;
    return res;
  }

  const padPrev = [{}, {}];
  function pollGamepads() {
    pads[0] = pads[1] = null;
    if (!navigator.getGamepads) return;
    let list = [];
    try {
      list = Array.from(navigator.getGamepads()).filter((p) => p && p.connected);
    } catch (e) {
      return;
    }
    list.slice(0, 2).forEach((pad, i) => {
      const slot = G.mode === 'solo' ? 0 : i;
      const b = (n) => !!(pad.buttons[n] && pad.buttons[n].pressed);
      let x = pad.axes[0] || 0, y = pad.axes[1] || 0;
      if (Math.hypot(x, y) < .22) {
        x = 0;
        y = 0;
      }
      if (b(14)) x = -1;
      if (b(15)) x = 1;
      if (b(12)) y = -1;
      if (b(13)) y = 1;
      const st = { x, y, shoot: b(0) || b(2) || b(7), dash: b(1) || b(3) || b(6), start: b(9) };
      if (pads[slot]) {
        const o = pads[slot];
        pads[slot] = { x: o.x + x, y: o.y + y, shoot: o.shoot || st.shoot, dash: o.dash || st.dash, start: o.start || st.start };
      }
      else pads[slot] = st;
      const pp = padPrev[i];
      if (st.start && !pp.start) togglePause();
      if ((st.shoot || st.start) && !(pp.shoot || pp.start) && !G.inMatchActive()) clickPrimary();
      pp.start = st.start;
      pp.shoot = st.shoot;
    });
  }

  window.addEventListener('keydown', (e) => {
    const typing = e.target && e.target.tagName === 'INPUT';
    if (typing) {
      if (e.code === 'Enter') {
        e.preventDefault();
        clickPrimary();
      } return;
    }
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (G.inMatch) {
        togglePause();
        e.preventDefault();
        return;
      }
    }
    if (!G.inMatchActive() && (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter')) {
      const ae = document.activeElement;
      if (ae && ae.tagName === 'BUTTON' && !ae.closest('.touch')) return; // o botão em foco já responde
      if (visibleOverlay()) {
        e.preventDefault();
        clickPrimary();
        return;
      }
    }
    if (GAME_KEYS.has(e.code) && G.inMatch) e.preventDefault();
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
  });
  window.addEventListener('blur', () => {
    keys.clear();
  });

  /* ---------- joystick e botões na tela ---------- */
  const touchEl = $('touch');
  let isTouch = false;
  try {
    isTouch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  } catch (e) {
    isTouch = false;
  }
  const stickState = [{ pid: null, ox: 0, oy: 0 }, { pid: null, ox: 0, oy: 0 }];
  const STICK_MAX = 48;

  function stickHome(slot) {
    const zone = touchEl.querySelector('.zone[data-slot="' + slot + '"]');
    const stick = $('stick' + slot);
    const zr = zone.getBoundingClientRect();
    const x = slot === 0 ? Math.min(110, zr.width * .45) : zr.width - Math.min(110, zr.width * .45);
    stick.style.left = x + 'px';
    stick.style.top = (zr.height - 100) + 'px';
    stick.classList.remove('active');
    stick.firstElementChild.style.transform = '';
  }
  touchEl.querySelectorAll('.zone').forEach((zone) => {
    const slot = +zone.dataset.slot;
    const st = stickState[slot], ts = touch.slots[slot];
    const stick = $('stick' + slot), knob = stick.firstElementChild;
    const move = (e) => {
      let dx = e.clientX - st.ox, dy = e.clientY - st.oy;
      const len = Math.hypot(dx, dy);
      if (len > STICK_MAX * 1.5) {
        // o joystick acompanha o dedo
        const k = (len - STICK_MAX * 1.5) / len;
        st.ox += dx * k;
        st.oy += dy * k;
        const zr = zone.getBoundingClientRect();
        stick.style.left = (st.ox - zr.left) + 'px';
        stick.style.top = (st.oy - zr.top) + 'px';
        dx = e.clientX - st.ox;
        dy = e.clientY - st.oy;
      }
      const l2 = Math.hypot(dx, dy), m = Math.min(1, l2 / STICK_MAX);
      const nx = l2 ? dx / l2 : 0, ny = l2 ? dy / l2 : 0;
      knob.style.transform = 'translate(' + (nx * m * STICK_MAX) + 'px,' + (ny * m * STICK_MAX) + 'px)';
      const mm = m < .18 ? 0 : (m - .18) / .82;
      ts.x = nx * mm;
      ts.y = ny * mm;
    };
    zone.addEventListener('pointerdown', (e) => {
      if (st.pid !== null) return;
      e.preventDefault();
      st.pid = e.pointerId;
      st.ox = e.clientX;
      st.oy = e.clientY;
      try {
        zone.setPointerCapture(e.pointerId);
      } catch (err) {
      /* ok */ }
      const zr = zone.getBoundingClientRect();
      stick.style.left = (e.clientX - zr.left) + 'px';
      stick.style.top = (e.clientY - zr.top) + 'px';
      stick.classList.add('active');
      move(e);
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId === st.pid) move(e);
    });
    const end = (e) => {
      if (e.pointerId !== st.pid) return;
      st.pid = null;
      ts.x = 0;
      ts.y = 0;
      stickHome(slot);
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
    zone.addEventListener('lostpointercapture', end);
  });
  touchEl.querySelectorAll('.tbtn').forEach((b) => {
    const ts = touch.slots[+b.dataset.slot], act = b.dataset.act;
    const down = (e) => {
      e.preventDefault();
      ts[act] = true;
      b.classList.add('on');
      try {
        b.setPointerCapture(e.pointerId);
      } catch (err) {
      /* ok */ }
    };
    const up = () => {
      ts[act] = false;
      b.classList.remove('on');
    };
    b.addEventListener('pointerdown', down);
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('lostpointercapture', up);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  });
  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' && !isTouch) {
      isTouch = true;
      syncTouchUI();
    }
  }, { passive: true });

  function syncTouchUI() {
    const show = isTouch && G.inMatch && G.mode !== 'demo';
    touchEl.hidden = !show;
    touchEl.classList.toggle('one', G.mode === 'solo');
    touchEl.classList.toggle('two', G.mode !== 'solo');
    if (show) requestAnimationFrame(() => {
      stickHome(0);
      stickHome(1);
    });
    if (!show) {
      for (const s of touch.slots) {
        s.x = s.y = 0;
        s.shoot = s.dash = false;
      }
    }
  }

  /* =========================================================
  Física e regras
  ========================================================= */
  function gainBall(p) {
    ball.owner = p;
    ball.z = 0;
    ball.vz = 0;
    ball.shot = null;
    ball.lastKicker = p;
    p.hold = 0;
    p.decideT = .3;
    if (p.human < 0) p.aimY = F.cy + rand(-48, 48);
    if (G.lastPass && G.lastPass.to !== p) G.lastPass = null;
  }

  function kickRaw(p, ang, speed, pw) {
    ball.owner = null;
    ball.vx = Math.cos(ang) * speed + p.vx * .15;
    ball.vy = Math.sin(ang) * speed + p.vy * .15;
    ball.vz = 40 + pw * 170;
    ball.noTouch = p;
    ball.noTouchT = .2;
    ball.lastKicker = p;
    ball.kickTime = G.clock;
    ball.shot = { kicker: p, team: p.team, x: p.x, y: p.y, pw, t: G.clock };
    p.kickAnim = .22;
    p.charging = false;
    p.charge = 0;
    const gx = atkGoalX(p.team);
    const toGoal = Math.cos(angDiff(Math.atan2(F.cy - p.y, gx - p.x), ang)) > .75;
    if (toGoal && pw > .3 && p.role === 'field') p.stats.shots++;
    if (pw > .3) Sfx.kick(pw);
    else Sfx.pass();
    burst(ball.x, ball.y + 3, 3 + pw * 8, ['#7fd36b', '#4fae4a', '#c9f0a8'], 90 + pw * 120, 'grass');
  }

  function doPass(p, m) {
    const lead = .32;
    const tx = m.x + m.vx * lead + Math.cos(m.face) * 10, ty = m.y + m.vy * lead + Math.sin(m.face) * 10;
    const d = Math.hypot(tx - p.x, ty - p.y);
    const speed = clamp(270 + d * 1.25, 320, 760);
    kickRaw(p, Math.atan2(ty - p.y, tx - p.x), speed, .15);
    ball.vz = 30;
    G.lastPass = { from: p, to: m, t: G.clock };
  }

  function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
    const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
    return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
  }
  function openness(from, to) {
    let m = 200;
    for (const o of G.players) if (o.team !== from.team) m = Math.min(m, segDist(o.x, o.y, from.x, from.y, to.x, to.y));
    return m;
  }
  function bestPass(p) {
    let best = null, bs = -1e9;
    for (const m of G.players) {
      if (m === p || m.team !== p.team || m.role !== 'field') continue;
      const d = dist(p, m);
      if (d < 80 || d > 480) continue;
      const open = openness(p, m);
      if (open < 34) continue;
      const prog = (m.x - p.x) * fwd(p.team);
      const s = prog * .8 + open * .6 - d * .1;
      if (s > bs) {
        bs = s;
        best = m;
      }
    }
    return best;
  }

  function aimAssist(p, ang) {
    const gx = atkGoalX(p.team);
    const dg = Math.abs(gx - p.x);
    if (dg > 650) return ang;
    const toC = Math.atan2(F.cy - p.y, gx - p.x);
    if (Math.cos(angDiff(ang, toC)) < .2) return ang;
    const aT = Math.atan2(GT + 12 - p.y, gx - p.x), aB = Math.atan2(GB - 12 - p.y, gx - p.x);
    const dT = angDiff(aT, ang), dB = angDiff(aB, ang);
    if (dT * dB <= 0) return ang; // já está no alvo
    const d = Math.abs(dT) < Math.abs(dB) ? dT : dB;
    if (Math.abs(d) < .4) return ang + d * .7;
    return ang;
  }

  function humanKick(p, pw) {
    if (pw < .3) {
      let mate = null, md = 1e9;
      for (const m of G.players) {
        if (m === p || m.team !== p.team || m.role !== 'field' || m.human < 0) continue;
        const a = Math.atan2(m.y - p.y, m.x - p.x), d = dist(p, m);
        if (Math.abs(angDiff(a, p.face)) < .9 && d < 640 && d < md) {
          md = d;
          mate = m;
        }
      }
      if (mate) {
        doPass(p, mate);
        return;
      }
    }
    kickRaw(p, aimAssist(p, p.face), 340 + pw * 900, pw);
  }

  function steal(th, v) {
    gainBall(th);
    v.recoverT = Math.max(v.recoverT, .38);
    v.charging = false;
    v.charge = 0;
    if (th.slideT > 0) {
      th.slideT = 0;
      th.recoverT = .12;
    }
    th.stats.steals++;
    G.lastPass = null;
    Sfx.tackle();
    burst(ball.x, ball.y, 8, ['#e9f5db', '#7fd36b'], 160, 'grass');
    if (th.human >= 0) {
      if (isCampaign()) addPoints(20, th.x, th.y - 58, 'DESARME +20', '#e9f5db');
      else floater('DESARME!', th.x, th.y - 58, '#e9f5db');
    }
  }

  function registerDribble(c, v) {
    if (c.dribbled.has(v)) return;
    c.dribbled.add(v);
    c.stats.dribbles++;
    G.lastDribble.set(c, G.clock);
    if (c.human >= 0) {
      Sfx.ole();
      if (isCampaign()) addPoints(25, c.x, c.y - 58, 'DRIBLE +25', '#ffd23f');
      else floater('DRIBLE!', c.x, c.y - 58, '#ffd23f');
    }
  }

  function cpuTackle(p, c, T) {
    p.tackleCD = T.tackleCD * rand(.85, 1.2);
    p.lungeT = .18;
    if (c.dashT > 0) {
      registerDribble(c, p);
      p.stunT = .55;
      return;
    }
    if (Math.random() < T.tackle) steal(p, c);
    else p.stunT = .28;
  }

  /* ---------- jogador humano ---------- */
  function updateHuman(p, inp, dt) {
    let mx = inp.x, my = inp.y;
    const mag = Math.hypot(mx, my);
    if (mag > 1) {
      mx /= mag;
      my /= mag;
    }
    const moving = mag > .18;
    if (moving && p.slideT <= 0) p.face = Math.atan2(my, mx);
    const has = ball.owner === p;

    if (inp.shootPressed && p.stunT <= 0) {
      p.charging = true;
      p.charge = 0;
    }
    if (p.charging) p.charge = Math.min(1, p.charge + dt * 1.3);
    if (inp.shootReleased && p.charging) {
      const pw = p.charge;
      p.charging = false;
      p.charge = 0;
      if (ball.owner === p) humanKick(p, pw);
      else if (!ball.owner && dist(p, ball) < p.r + BALL_R + 18 && ball.z < 30 && !(ball.noTouch === p && ball.noTouchT > 0)) humanKick(p, pw);
    }
    if (inp.dashPressed && p.dashCD <= 0 && p.slideT <= 0 && p.recoverT <= 0 && p.stunT <= 0) {
      if (has) {
        p.dashT = .32;
        p.dashCD = 1.05;
        p.dribbled.clear();
        Sfx.dash();
        burst(p.x, p.y, 6, ['#ffffff', '#ffd23f'], 120, 'spark');
      }
      else {
        p.slideT = .3;
        p.dashCD = .9;
        Sfx.dash();
      }
    }
    const spd = p.speed * (has ? .93 : 1) * (p.charging ? .62 : 1) * (p.recoverT > 0 ? .35 : 1) * (p.stunT > 0 ? .3 : 1);
    p.dvx = mx * spd;
    p.dvy = my * spd;

    const c = ball.owner && ball.owner.role === 'field' ? ball.owner : null;
    if (p.slideT > 0 && c && c.team !== p.team) {
      if (dist(p, ball) < p.r + BALL_R + 10 || dist(p, c) < p.r + c.r + 8) {
        if (c.dashT > 0) {
          registerDribble(c, p);
          p.slideT = 0;
          p.recoverT = .45;
        }
        else steal(p, c);
      }
    } else if (p.slideT <= 0 && c && c.team !== p.team && p.pokeCD <= 0 && p.stunT <= 0 && dist(p, ball) < p.r + BALL_R + 3) {
      p.pokeCD = .55;
      if (c.dashT <= 0 && Math.random() < (c.human >= 0 ? .3 : .38)) steal(p, c);
    }
    if (has && p.dashT > 0) {
      for (const o of G.players) {
        if (o.team !== p.team && o.role === 'field' && !p.dribbled.has(o) && dist(o, p) < 46) {
          registerDribble(p, o);
          o.stunT = Math.max(o.stunT, .45);
        }
      }
    }
  }

  /* ---------- inteligência dos jogadores de linha ---------- */
  function computeRoles() {
    for (const t of ['home', 'away']) {
      const cpus = G.players.filter((p) => p.team === t && p.human < 0 && p.role === 'field');
      const R = G.roles[t] = { presser: null, cover: null, chaser: null };
      if (!cpus.length) continue;
      const c = ball.owner;
      if (c && c.team !== t) {
        const s = cpus.slice().sort((a, b) => dist(a, c) - dist(b, c));
        R.presser = s[0];
        R.cover = s[1] || null;
      } else if (!c) {
        let best = null, bt = 1e9;
        for (const p of cpus) {
          if (p.stunT > 0) continue;
          const d = dist(p, ball), look = Math.min(.8, d / p.speed);
          const tt = Math.hypot(ball.x + ball.vx * look * .6 - p.x, ball.y + ball.vy * look * .6 - p.y) / p.speed;
          if (tt < bt) {
            bt = tt;
            best = p;
          }
        }
        R.chaser = best;
      }
    }
  }

  function formationPos(p) {
    const [u, v] = FORM[p.formN][p.formI];
    const has = ball.owner && ball.owner.team === p.team;
    let x = ownGoalX(p.team) + fwd(p.team) * (u + (has ? .18 : 0)) * F.w;
    let y = F.t + v * F.h;
    x = lerp(x, ball.x, .28);
    y = lerp(y, ball.y, .3);
    return { x, y };
  }

  function seek(p, tx, ty, spd) {
    const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
    if (d < 4) {
      p.dvx = 0;
      p.dvy = 0;
      return;
    }
    const s = Math.min(spd, d * 5);
    p.dvx = dx / d * s;
    p.dvy = dy / d * s;
  }

  function cpuShoot(p, T) {
    const gx = atkGoalX(p.team);
    const k = G.keepers[other(p.team)];
    let aimY = k && k.y < F.cy ? GB - 14 : GT + 14;
    if (Math.random() < .25) aimY = F.cy + rand(-40, 40);
    aimY += gauss() * (1 - T.acc) * 70;
    kickRaw(p, Math.atan2(aimY - p.y, gx - p.x), 340 + rand(.68, .95) * 900, .8);
  }

  function cpuCarry(p, dt, T) {
    p.hold += dt;
    const gx = atkGoalX(p.team), gy = p.aimY;
    let dx = gx - p.x, dy = gy - p.y;
    const dl = Math.hypot(dx, dy) || 1;
    dx /= dl;
    dy /= dl;
    let ax = 0, ay = 0, nearest = 1e9;
    for (const o of G.players) {
      if (o.team === p.team) continue;
      const ox = o.x - p.x, oy = o.y - p.y, d = Math.hypot(ox, oy) || 1;
      if (d < nearest) nearest = d;
      if (d < 150 && o.role === 'field') {
        const ahead = (ox * dx + oy * dy) / d;
        if (ahead > -.3) {
          const w = (150 - d) / 150 * 1.5;
          const sgn = (-ox * dy + oy * dx) > 0 ? -1 : 1;
          ax += -dy * sgn * w - ox / d * w * .5;
          ay += dx * sgn * w - oy / d * w * .5;
        }
      }
    }
    if (p.y < F.t + 60) ay += .8;
    if (p.y > F.b - 60) ay -= .8;
    const mx = dx + ax, my = dy + ay, ml = Math.hypot(mx, my) || 1;
    const spd = p.speed * .9;
    p.dvx = mx / ml * spd;
    p.dvy = my / ml * spd;
    if (p.dashT <= 0) p.face = Math.atan2(p.dvy, p.dvx);
    p.decideT -= dt;
    if (p.decideT <= 0) {
      p.decideT = .22;
      const dg = Math.hypot(gx - p.x, F.cy - p.y);
      if (dg < T.shootRange && Math.abs(p.y - F.cy) < 230) {
        cpuShoot(p, T);
        return;
      }
      if (nearest < 62) {
        if (p.dashCD <= 0 && Math.random() < T.dashProb) {
          p.dashT = .3;
          p.dashCD = 1.7;
          p.dribbled.clear();
          return;
        }
        if (Math.random() < T.passProb) {
          const m = bestPass(p);
          if (m) {
            doPass(p, m);
            return;
          }
        }
      }
      if (p.hold > 4.5 && dg < 560) cpuShoot(p, T);
    }
  }

  function updateCPU(p, dt) {
    const T = G.cpu[p.team];
    const R = G.roles[p.team];
    const c = ball.owner;
    if (p.stunT > 0) {
      p.dvx = 0;
      p.dvy = 0;
      return;
    }
    if (c === p) {
      cpuCarry(p, dt, T);
      return;
    }
    let tx, ty, spd = p.speed;
    if (c && c.team === p.team) {
      const lanes = [-.27, .27, 0, -.38, .38];
      tx = clamp(c.x + fwd(p.team) * (110 + (p.formI % 2) * 60), F.l + 60, F.r - 60);
      ty = F.cy + lanes[p.formI % lanes.length] * F.h;
      spd *= .85;
    } else if (c) {
      const og = ownGoalX(p.team);
      const gx = og - c.x, gy = F.cy - c.y, gl = Math.hypot(gx, gy) || 1;
      if (p === R.presser) {
        tx = c.x + c.vx * .18 + gx / gl * 16;
        ty = c.y + c.vy * .18 + gy / gl * 16;
        if (dist(p, c) < p.r + c.r + 10 && p.tackleCD <= 0 && c.role === 'field') cpuTackle(p, c, T);
      } else if (p === R.cover) {
        const k = Math.min(150, gl * .42);
        tx = c.x + gx / gl * k;
        ty = c.y + gy / gl * k;
        spd *= .9;
      } else {
        const fp = formationPos(p);
        let m = null, md = 1e9;
        for (const o of G.players) {
          if (o.team === p.team || o.role !== 'field' || o === c) continue;
          const d = Math.hypot(o.x - fp.x, o.y - fp.y);
          if (d < md) {
            md = d;
            m = o;
          }
        }
        if (m && md < 260) {
          const mx = og - m.x, my = F.cy - m.y, ml = Math.hypot(mx, my) || 1;
          tx = m.x + mx / ml * 34;
          ty = m.y + my / ml * 34;
        }
        else {
          tx = fp.x;
          ty = fp.y;
        }
        spd *= .82;
      }
    } else if (p === R.chaser) {
      const look = Math.min(.7, dist(p, ball) / p.speed);
      tx = ball.x + ball.vx * look * .6;
      ty = ball.y + ball.vy * look * .6;
    } else {
      const fp = formationPos(p);
      tx = fp.x;
      ty = fp.y;
      spd *= .75;
    }
    seek(p, tx, ty, spd);
  }

  /* ---------- goleiros ---------- */
  function keeperRelease(k) {
    const mates = G.players.filter((p) => p.team === k.team && p.role === 'field');
    if (!mates.length) {
      kickRaw(k, k.team === 'home' ? 0 : Math.PI, 700, .7);
      return;
    }
    let best = null, bs = -1e9;
    for (const m of mates) {
      const s = openness(k, m) - Math.abs(m.y - k.y) * .1 + rand(0, 30);
      if (s > bs) {
        bs = s;
        best = m;
      }
    }
    doPass(k, best);
  }

  function updateKeeper(k, dt) {
    const s = k.team === 'home' ? -1 : 1;
    const lineX = s < 0 ? F.l : F.r;
    const out = -s;
    const P = k.kp;
    let spdMul = 1;
    if (ball.owner === k) {
      k.hold += dt;
      seek(k, lineX + out * 34, F.cy + clamp(k.y - F.cy, -40, 40), P.spd * .6);
      if (k.hold > .9) keeperRelease(k);
      return;
    }
    const bd = Math.abs(ball.x - lineX);
    let tx = lineX + out * (24 + (bd < 420 ? (1 - bd / 420) * 26 : 0));
    let ty = clamp(F.cy + (ball.y - F.cy) * .42, GT + 8, GB - 8);
    const sp = Math.hypot(ball.vx, ball.vy);
    const toward = !ball.owner && ball.vx * out < -200;
    const c = ball.owner;
    if (toward) {
      const t = (tx - ball.x) / ball.vx;
      if (t > 0 && t < 1.4) {
        if (k.shotId !== ball.kickTime) {
          k.shotId = ball.kickTime;
          k.dived = false;
          k.err = gauss() * P.err * (14 + sp * .022);
          k.reactLeft = P.react * rand(.8, 1.2);
        }
        if (k.reactLeft > 0) {
          k.reactLeft -= dt;
          ty = k.lastTy;
        }
        else {
          ty = clamp(ball.y + ball.vy * t + k.err, GT - 16, GB + 16);
          tx = lineX + out * 18;
          if (!k.dived && Math.abs(ty - k.y) > 24 && t < .42) {
            k.diveT = .45;
            k.dived = true;
            k.diveDir = Math.sign(ty - k.y) || 1;
          }
        }
      }
    } else if (!c) {
      const inBox = bd < 150 && Math.abs(ball.y - F.cy) < 140;
      if (inBox && sp < 420) {
        tx = ball.x;
        ty = ball.y;
        spdMul = 1.1;
      }
    } else if (c.team !== k.team) {
      const cd = Math.abs(c.x - lineX);
      if (cd < 140 && Math.abs(c.y - F.cy) < 160) {
        tx = lerp(tx, c.x, .7);
        ty = lerp(ty, c.y, .7);
        spdMul = 1.1;
      }
      if (k.tackleCD <= 0 && dist(k, ball) < k.r + BALL_R + 6) {
        k.tackleCD = .7;
        if (c.dashT <= 0 && Math.random() < .55) {
          steal(k, c);
          Sfx.catchBall();
          if (G.mode !== 'demo') floater('DEFESA!', k.x, k.y - 60, '#f4f1e8');
        }
      }
    }
    k.lastTy = ty;
    tx = s < 0 ? clamp(tx, lineX + 6, lineX + 170) : clamp(tx, lineX - 170, lineX - 6);
    ty = clamp(ty, F.cy - 190, F.cy + 190);
    seek(k, tx, ty, P.spd * spdMul * (k.diveT > 0 ? 2.1 : 1));
    if (k.diveT <= 0) k.face = Math.atan2(ball.y - k.y, ball.x - k.x);
  }

  function keeperTouch(k, sp, d) {
    const P = k.kp;
    const isShot = ball.shot && ball.shot.team !== k.team && ball.shot.pw > .3;
    if (sp > P.catchV * 1.7 && d > k.r + BALL_R + 3 && Math.random() < .3) {
      ball.vx *= .82;
      ball.vy += rand(-70, 70);
      ball.noTouch = k;
      ball.noTouchT = .3;
      return;
    }
    if (sp < P.catchV) {
      gainBall(k);
      Sfx.catchBall();
      if (isShot && G.mode !== 'demo') floater('DEFESA!', k.x, k.y - 60, '#f4f1e8');
    } else {
      const out = k.team === 'home' ? 1 : -1;
      const a = Math.atan2(rand(-.9, .9), out);
      const v = sp * rand(.3, .45);
      ball.vx = Math.cos(a) * v;
      ball.vy = Math.sin(a) * v + (ball.y < k.y ? -60 : 60);
      ball.vz = 120;
      ball.noTouch = k;
      ball.noTouchT = .3;
      Sfx.tackle();
      G.shake = Math.max(G.shake, .3);
      if (G.mode !== 'demo') floater('ESPALMOU!', k.x, k.y - 60, '#f4f1e8');
    }
  }

  /* ---------- bola ---------- */
  function checkCapture() {
    if (ball.owner) return;
    const sp = Math.hypot(ball.vx, ball.vy);
    let best = null, bd = 1e9;
    for (const p of G.players) {
      if (p === ball.noTouch && ball.noTouchT > 0) continue;
      if (p.stunT > 0 || (p.recoverT > 0 && p.role !== 'keeper')) continue;
      const reach = p.r + BALL_R + (p.role === 'keeper' ? (p.diveT > 0 ? 20 : 7) : 3);
      const d = dist(p, ball);
      if (d < reach && ball.z < (p.role === 'keeper' ? 60 : 22) && d < bd) {
        best = p;
        bd = d;
      }
    }
    if (!best) return;
    const p = best;
    if (p.role === 'keeper') {
      keeperTouch(p, sp, bd);
      return;
    }
    if (p.slideT > 0) {
      ball.vx = Math.cos(p.face) * 360 + p.vx * .2;
      ball.vy = Math.sin(p.face) * 360 + p.vy * .2;
      ball.noTouch = p;
      ball.noTouchT = .15;
      Sfx.kick(.3);
      return;
    }
    const trap = p.human >= 0 ? 900 : G.cpu[p.team].trap;
    if (sp < trap) {
      gainBall(p);
      return;
    }
    const nx = (ball.x - p.x) / (bd || 1), ny = (ball.y - p.y) / (bd || 1);
    const vn = ball.vx * nx + ball.vy * ny;
    if (vn < 0) {
      ball.vx -= 1.6 * vn * nx;
      ball.vy -= 1.6 * vn * ny;
    }
    ball.vx *= .5;
    ball.vy *= .5;
    ball.noTouch = p;
    ball.noTouchT = .12;
    Sfx.tackle();
  }

  function attachBall(dt) {
    const p = ball.owner;
    const sp = Math.hypot(p.vx, p.vy);
    const off = p.r + BALL_R + 1 + Math.min(6, sp * .02) + Math.sin(p.anim * 2) * 1.5;
    const tx = p.x + Math.cos(p.face) * off, ty = p.y + Math.sin(p.face) * off;
    const k = Math.min(1, dt * 20);
    ball.x += (tx - ball.x) * k;
    ball.y += (ty - ball.y) * k;
    ball.vx = p.vx;
    ball.vy = p.vy;
    ball.z = 0;
    ball.vz = 0;
    ball.rot += sp * dt * .09;
  }

  function collideBounds() {
    const r = BALL_R;
    if (ball.x > F.l && ball.x < F.r) {
      if (ball.y - r < F.t) {
        ball.y = F.t + r;
        ball.vy = Math.abs(ball.vy) * .62;
      }
      if (ball.y + r > F.b) {
        ball.y = F.b - r;
        ball.vy = -Math.abs(ball.vy) * .62;
      }
    }
    for (const s of [-1, 1]) {
      const lx = s < 0 ? F.l : F.r;
      const beyond = s < 0 ? ball.x - r < lx : ball.x + r > lx;
      if (!beyond) continue;
      const behind = s < 0 ? ball.x < lx : ball.x > lx;
      if (behind && ball.y > GT - r && ball.y < GB + r) {
        if (ball.y - r < GT) {
          ball.y = GT + r;
          ball.vy = Math.abs(ball.vy) * .2;
        }
        if (ball.y + r > GB) {
          ball.y = GB - r;
          ball.vy = -Math.abs(ball.vy) * .2;
        }
        const back = lx + s * GOAL_DEPTH;
        if (s < 0 ? ball.x - r < back : ball.x + r > back) {
          ball.x = back - s * r;
          ball.vx = -ball.vx * .12;
          ball.vy *= .6;
        }
      } else if (behind || ball.y < GT || ball.y > GB) {
        ball.x = lx - s * r;
        ball.vx = -ball.vx * .62;
      }
      for (const py of [GT, GB]) {
        const dx = ball.x - lx, dy = ball.y - py, d = Math.hypot(dx, dy);
        if (d > 0 && d < r + POST_R) {
          const nx = dx / d, ny = dy / d;
          ball.x = lx + nx * (r + POST_R);
          ball.y = py + ny * (r + POST_R);
          const vn = ball.vx * nx + ball.vy * ny;
          if (vn < 0) {
            ball.vx -= 1.7 * vn * nx;
            ball.vy -= 1.7 * vn * ny;
            if (-vn > 250 && !ball.owner) {
              Sfx.post();
              G.shake = Math.max(G.shake, .5);
              if (G.mode !== 'demo' && G.state === 'play') floater('NA TRAVE!', lx - s * 40, py - 40, '#f4f1e8');
            }
          }
        }
      }
    }
  }

  function checkGoal() {
    if (G.state !== 'play') return false;
    for (const s of [-1, 1]) {
      const lx = s < 0 ? F.l : F.r;
      const over = s < 0 ? ball.x + BALL_R < lx : ball.x - BALL_R > lx;
      if (over && ball.y > GT && ball.y < GB) {
        onGoal(s);
        return true;
      }
    }
    return false;
  }

  function updateBall(dt) {
    if (ball.noTouchT > 0) ball.noTouchT -= dt;
    if (ball.owner) {
      attachBall(dt);
      collideBounds();
      checkGoal();
      ball.trail.length = 0;
      return;
    }
    const sub = 4, h = dt / sub;
    for (let i = 0; i < sub; i++) {
      ball.x += ball.vx * h;
      ball.y += ball.vy * h;
      collideBounds();
      if (checkGoal()) break;
    }
    ball.vz -= 900 * dt;
    ball.z += ball.vz * dt;
    if (ball.z <= 0) {
      ball.z = 0;
      ball.vz = ball.vz < -90 ? -ball.vz * .42 : 0;
    }
    const f = Math.exp(-(ball.z > 0 ? .35 : 1.15) * dt);
    ball.vx *= f;
    ball.vy *= f;
    const sp = Math.hypot(ball.vx, ball.vy);
    if (sp < 6) {
      ball.vx = 0;
      ball.vy = 0;
    }
    ball.rot += sp * dt * .05;
    if (sp > 480) {
      ball.trail.push({ x: ball.x, y: ball.y - ball.z });
      if (ball.trail.length > 9) ball.trail.shift();
    }
    else if (ball.trail.length) ball.trail.shift();
  }

  /* ---------- integração ---------- */
  function tickTimers(p, dt) {
    const wasSlide = p.slideT > 0;
    for (const k of ['dashT', 'dashCD', 'slideT', 'recoverT', 'stunT', 'tackleCD', 'pokeCD', 'lungeT', 'kickAnim', 'diveT']) if (p[k] > 0) p[k] = Math.max(0, p[k] - dt);
    if (wasSlide && p.slideT <= 0) p.recoverT = Math.max(p.recoverT, .28);
  }

  function integrate(p, dt) {
    if (p.dashT > 0 || p.slideT > 0) {
      const s = p.slideT > 0 ? 470 : (p.human >= 0 ? 430 : 380);
      p.vx = Math.cos(p.face) * s;
      p.vy = Math.sin(p.face) * s;
    } else {
      const a = p.role === 'keeper' ? 16 : (p.human >= 0 ? 14 : 9);
      const k = Math.min(1, a * dt);
      p.vx += (p.dvx - p.vx) * k;
      p.vy += (p.dvy - p.vy) * k;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.role === 'keeper') p.x = clamp(p.x, F.l + 6, F.r - 6);
    else p.x = clamp(p.x, F.l + p.r, F.r - p.r);
    p.y = clamp(p.y, F.t + p.r * .6, F.b - p.r * .4);
    const sp = Math.hypot(p.vx, p.vy);
    p.anim += sp * dt * .085;
    if (p.human < 0 && p.role === 'field' && sp > 25 && p.dashT <= 0 && ball.owner !== p) p.face = Math.atan2(p.vy, p.vx);
    if (p.dashT > 0 && Math.random() < .5) G.particles.push({ x: p.x, y: p.y - 18, vx: 0, vy: 0, life: .22, t: 0, color: p.kit.shirt, size: 9, type: 'ghost' });
  }

  function separate() {
    const ps = G.players;
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i], b = ps[j];
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), m = a.r + b.r - 6;
        if (d > 0 && d < m) {
          const wa = a.role === 'keeper' ? .25 : 1, wb = b.role === 'keeper' ? .25 : 1, wt = wa + wb;
          const o = m - d, nx = dx / d, ny = dy / d;
          a.x -= nx * o * wa / wt;
          a.y -= ny * o * wa / wt;
          b.x += nx * o * wb / wt;
          b.y += ny * o * wb / wt;
        }
      }
    }
  }

  function world(dt, inputs, live) {
    G.clock += dt;
    for (const p of G.players) tickTimers(p, dt);
    if (live) computeRoles();
    for (const p of G.players) {
      if (!live) {
        if (p.human >= 0) {
          const inp = inputs[p.human];
          let x = inp.x, y = inp.y;
          const m = Math.hypot(x, y);
          if (m > 1) {
            x /= m;
            y /= m;
          }
          p.dvx = x * p.speed * .85;
          p.dvy = y * p.speed * .85;
          if (m > .2) p.face = Math.atan2(y, x);
          p.charging = false;
          p.charge = 0;
        } else {
          p.dvx = 0;
          p.dvy = 0;
        }
        continue;
      }
      if (p.role === 'keeper') updateKeeper(p, dt);
      else if (p.human >= 0) updateHuman(p, inputs[p.human], dt);
      else updateCPU(p, dt);
    }
    for (const p of G.players) integrate(p, dt);
    separate();
    updateBall(dt);
    if (live) checkCapture();
  }

  /* =========================================================
  Pontuação, gols e fim de partida
  ========================================================= */
  function addPoints(n, x, y, label, color) {
    G.points += n;
    G.matchPoints += n;
    if (label) floater(label, x, y, color || '#ffd23f');
  }
  function floater(text, x, y, color, size) {
    G.floaters.push({ text, x, y, color, t: 0, life: G.state === 'goal' ? 2.2 : 1.3, size: size || 22 });
  }
  function burst(x, y, n, colors, speed, type) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), v = rand(.3, 1) * speed;
      G.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (type === 'grass' ? 60 : 0), life: rand(.3, .6), t: 0, color: pick(colors), size: rand(2, 4), type });
    }
  }
  function confetti(x, y, colors) {
    for (let i = 0; i < 90; i++) {
      G.particles.push({ x: x + rand(-30, 30), y: y + rand(-30, 30), vx: rand(-260, 260), vy: rand(-420, -80), life: rand(1.4, 2.4), t: 0, color: pick(colors), size: rand(4, 7), rot: rand(0, 6), vr: rand(-10, 10), type: 'confetti' });
    }
  }
  function teamName(team) {
    if (G.mode === 'versus') return team === 'home' ? G.names[0] : G.names[1];
    if (isCampaign()) return team === 'home' ? (G.mode === 'coop' ? 'Amarelinha' : G.names[0]) : G.ph.rival;
    return team === 'home' ? 'Amarelinha' : 'Visitante';
  }

  function onGoal(side) {
    const team = side > 0 ? 'home' : 'away';
    G.score[team]++;
    G.state = 'goal';
    G.goalT = 0;
    const scorerCand = ball.owner || ball.lastKicker;
    ball.owner = null;
    G.net = { side, y: ball.y, amt: 18 };
    G.shake = 1;
    G.kickoffTeam = other(team);
    if (G.mode === 'demo') {
      Sfx.excite(.6);
      return;
    }

    const scorer = scorerCand && scorerCand.team === team && scorerCand.role === 'field' ? scorerCand : null;
    const colors = team === 'home' ? ['#ffd23f', '#0f8a4a', '#2348c9', '#f4f1e8'] : [G.players.find((p) => p.team === 'away' && p.role === 'field').kit.shirt, '#f4f1e8', '#ffd23f'];
    confetti(side > 0 ? F.r - 20 : F.l + 20, F.cy, colors);
    Sfx.goal();
    let sub;
    if (scorer) {
      scorer.stats.goals++;
      sub = (scorer.name || teamName(team)) + ' marcou';
    }
    else sub = 'Gol contra';

    if (isCampaign() && team === 'home') {
      let pts = 100 * (G.phaseIdx + 1);
      const gx = side > 0 ? F.r : F.l;
      let fy = F.cy + 120;
      const fx = gx - side * 230;
      addPoints(pts, fx, fy, 'GOL +' + pts, '#ffd23f');
      const shot = ball.shot;
      if (scorer && shot && shot.kicker === scorer) {
        if (Math.abs(gx - shot.x) > 430) {
          fy += 30;
          addPoints(150, fx, fy, 'GOLAÇO DE LONGE +150', '#ffffff');
          sub = 'Golaço de ' + (scorer.name || 'longe');
        }
        if (shot.pw > .9) {
          fy += 30;
          addPoints(50, fx, fy, 'BOMBA +50', '#ff9d6b');
        }
        const ld = G.lastDribble.get(scorer);
        if (ld !== undefined && shot.t - ld < 2.2) {
          fy += 30;
          addPoints(75, fx, fy, 'DRIBLE + GOL +75', '#ffd23f');
        }
      }
      const lp = G.lastPass;
      if (scorer && lp && lp.to === scorer && lp.from !== scorer && lp.from.team === team && lp.from.human >= 0 && G.clock - lp.t < 4.5) {
        lp.from.stats.assists++;
        fy += 30;
        addPoints(50, fx, fy, 'ASSISTÊNCIA +50', '#5fd4ff');
        sub += ', passe de ' + lp.from.name;
      }
    } else if (isCampaign()) {
      Sfx.groan();
    }
    showBanner(team === 'home' || G.mode === 'versus' ? 'GOOOL!' : 'GOL DELES', sub);
    updateHUD(true);
  }

  function afterGoal() {
    hideBanner();
    if (G.mode === 'demo') {
      if (G.score.home + G.score.away > 6) G.score = { home: 0, away: 0 };
      placeForKickoff(G.kickoffTeam);
      G.state = 'play';
      G.demoT = 0;
      return;
    }
    const lead = G.score.home > G.score.away ? 'home' : G.score.away > G.score.home ? 'away' : null;
    if (G.golden || (lead && G.score[lead] >= G.ph.goals)) {
      endMatch();
      return;
    }
    placeForKickoff(G.kickoffTeam);
    G.state = 'countdown';
    G.cdT = 0;
    G.cdLen = 1.2;
  }

  function endMatch() {
    G.state = 'over';
    G.overT = 0;
    Sfx.whistle(3);
    hideToast();
  }

  function showResult() {
    G.resultShown = true;
    const T = $('resTitle'), E = $('resEyebrow'), S = $('resScore'), X = $('resExtra'), A = $('resActions');
    X.textContent = '';
    A.textContent = '';
    const sh = G.score.home, sa = G.score.away;
    const btn = (label, primary, fn) => {
      const b = el('button', 'btn ' + (primary ? 'btn-primary' : 'btn-ghost'), label);
      b.type = 'button';
      if (primary) b.dataset.primary = '';
      b.addEventListener('click', () => {
        Sfx.click();
        fn();
      });
      A.appendChild(b);
      return b;
    };
    const humans = G.players.filter((p) => p.human >= 0).sort((a, b) => a.human - b.human);

    if (G.mode === 'versus') {
      const win = sh > sa ? 0 : 1;
      E.textContent = 'Clássico · fim de jogo';
      T.textContent = (G.names[win] || 'Jogador ' + (win + 1)) + ' venceu!';
      S.textContent = G.names[0] + ' ' + sh + ' x ' + sa + ' ' + G.names[1];
      X.appendChild(statsTable(humans, false));
      btn('Revanche', true, () => startMatchFlow());
      btn('Menu', false, goMenu);
    } else {
      const ph = G.ph, idx = G.phaseIdx;
      const won = sh > sa;
      const rows = el('div', 'rows');
      const row = (label, val, total) => {
        const r = el('div', 'row' + (total ? ' total' : ''));
        r.append(el('span', '', label), el('b', '', (val > 0 && !total ? '+' : '') + fmtPts(val)));
        rows.appendChild(r);
      };
      S.textContent = teamName('home') + ' ' + sh + ' x ' + sa + ' ' + ph.rival;
      row('Pontos na partida', G.matchPoints);
      let isRecord = false;
      if (won) {
        const bWin = 250 * (idx + 1), bDiff = (sh - sa) * 50, bTime = Math.round(G.time) * 5;
        G.points += bWin + bDiff + bTime;
        row('Vitória na fase ' + (idx + 1), bWin);
        row('Saldo de gols', bDiff);
        if (bTime > 0) row('Tempo restante', bTime);
      }
      row('Total', G.points, true);
      const last = idx === PHASES.length - 1;
      if (!won || last) isRecord = saveRecord();
      if (won && last) {
        E.textContent = 'Final do Mundial · ' + ph.rival + ' batido';
        T.textContent = 'Campeão do mundo!';
        confetti(F.cx, F.t + 60, ['#ffd23f', '#0f8a4a', '#2348c9', '#f4f1e8']);
        Sfx.goal();
      } else if (won) {
        E.textContent = 'Fase ' + (idx + 1) + ' de ' + PHASES.length + ' · ' + ph.name;
        T.textContent = 'Vitória!';
      } else {
        E.textContent = 'Fase ' + (idx + 1) + ' de ' + PHASES.length + ' · ' + ph.name;
        T.textContent = 'Derrota';
      }
      X.appendChild(rows);
      if (isRecord) X.appendChild(el('div', 'new-record', 'Novo recorde'));
      X.appendChild(statsTable(humans, G.mode === 'coop'));
      if (won && !last) btn('Próxima fase', true, () => {
        G.phaseIdx++;
        G.phaseStartPoints = G.points;
        startMatchFlow();
      });
      else if (won && last) btn('Jogar de novo', true, () => {
        G.phaseIdx = 0;
        G.points = 0;
        G.phaseStartPoints = 0;
        startMatchFlow();
      });
      else btn('Tentar de novo', true, () => {
        G.points = G.phaseStartPoints;
        startMatchFlow();
      });
      btn('Menu', false, goMenu);
    }
    showOverlay('result');
    setTimeout(() => {
      const p = A.querySelector('[data-primary]');
      if (p && !isTouch) p.focus({ preventScroll: true });
    }, 50);
  }

  function statsTable(humans, withAssists) {
    const wrap = el('div', 'stats-wrap');
    const t = el('table', 'stats');
    const head = el('tr');
    const cols = ['Gols', 'Chutes', 'Dribles', 'Desarmes'];
    if (withAssists) cols.push('Assist.');
    head.appendChild(el('th', '', 'Jogador'));
    for (const c of cols) head.appendChild(el('th', '', c));
    const thead = el('thead');
    thead.appendChild(head);
    t.appendChild(thead);
    const tb = el('tbody');
    for (const p of humans) {
      const tr = el('tr');
      const td = el('td');
      const tag = el('i', 'tag');
      tag.style.setProperty('--c', p.human ? 'var(--p2)' : 'var(--p1)');
      td.append(tag, document.createTextNode(p.name));
      tr.appendChild(td);
      const vals = [p.stats.goals, p.stats.shots, p.stats.dribbles, p.stats.steals];
      if (withAssists) vals.push(p.stats.assists);
      for (const v of vals) tr.appendChild(el('td', '', String(v)));
      tb.appendChild(tr);
    }
    t.appendChild(tb);
    wrap.appendChild(t);
    return wrap;
  }

  function saveRecord() {
    const key = 'record-' + G.mode;
    const prev = store.get(key, 0);
    if (G.points > prev) {
      store.set(key, Math.round(G.points));
      renderRecords();
      return G.points > 0;
    }
    return false;
  }
  function renderRecords() {
    const box = $('records');
    box.textContent = '';
    for (const [k, label] of [['solo', 'Recorde solo'], ['coop', 'Recorde dupla']]) {
      const r = el('div', 'record');
      r.append(el('span', '', label), el('b', '', fmtPts(store.get('record-' + k, 0))));
      box.appendChild(r);
    }
  }

  /* =========================================================
  Laço principal
  ========================================================= */
  G.inMatchActive = () => G.inMatch && !G.paused && visibleOverlay() === null;

  function step(dt) {
    const inputs = [readInput(0), readInput(1)];
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 2.4);
    if (G.net) {
      G.net.amt *= Math.exp(-dt * 3);
      if (G.net.amt < .3) G.net = null;
    }
    if (G.goFlash > 0) G.goFlash -= dt;
    // flashes de câmera na torcida
    if (Math.random() < .25) G.particles.push({ x: rand(F.l - 40, F.r + 40), y: rand(Math.max(4, F.t - 140), F.t - 46), vx: 0, vy: 0, life: .12, t: 0, color: '#fff', size: 3, type: 'flash' });
    for (let i = G.particles.length - 1; i >= 0; i--) {
      const q = G.particles[i];
      q.t += dt;
      if (q.t >= q.life) {
        G.particles.splice(i, 1);
        continue;
      }
      if (q.type === 'confetti') {
        q.vy += 520 * dt;
        q.vx *= Math.exp(-1.6 * dt);
        q.vy *= Math.exp(-.9 * dt);
        q.rot += q.vr * dt;
      }
      else if (q.type === 'grass') {
        q.vy += 400 * dt;
      }
      q.x += q.vx * dt;
      q.y += q.vy * dt;
    }
    for (let i = G.floaters.length - 1; i >= 0; i--) {
      const f = G.floaters[i];
      f.t += dt;
      f.y -= 34 * dt;
      if (f.t > f.life) G.floaters.splice(i, 1);
    }

    switch (G.state) {
      case 'countdown': {
        G.cdT += dt;
        if (G.cdLen > 2) {
          const n = 3 - Math.floor(G.cdT / .8);
          if (n !== G.lastTick && n > 0) {
            G.lastTick = n;
            Sfx.beep(false);
          }
        }
        if (G.cdT >= (G.cdLen > 2 ? 2.4 : G.cdLen)) {
          G.state = 'play';
          G.goFlash = .7;
          G.lastTick = -1;
          Sfx.whistle(1);
          Sfx.beep(true);
        }
        world(dt, inputs.map(() => NO_INPUT), false);
        for (const p of G.players) {
          p.vx = p.vy = 0;
        }
        break;
      }
      case 'play': {
        world(dt, inputs, true);
        if (G.mode === 'demo') {
          G.demoT += dt;
          if (G.demoT > 45) {
            placeForKickoff(Math.random() < .5 ? 'home' : 'away');
            G.demoT = 0;
          } break;
        }
        if (!G.golden && G.state === 'play') {
          G.time -= dt;
          const sec = Math.ceil(G.time);
          if (sec <= 5 && sec > 0 && sec !== G.lastTick) {
            G.lastTick = sec;
            Sfx.beep(false);
          }
          if (G.time <= 0) {
            G.time = 0;
            if (G.score.home !== G.score.away) endMatch();
            else {
              G.golden = true;
              Sfx.whistle(2);
              showToast('Gol de ouro · quem marcar vence', 3200);
            }
          }
        }
        G.exciteT = (G.exciteT || 0) - dt;
        if (G.exciteT <= 0) {
          G.exciteT = .3;
          Sfx.excite(Math.max(0, 1 - Math.min(Math.abs(ball.x - F.l), Math.abs(ball.x - F.r)) / 300));
        }
        break;
      }
      case 'goal': {
        world(dt, inputs, false);
        G.goalT += dt;
        if (G.goalT > (G.mode === 'demo' ? 1.6 : 2.7)) afterGoal();
        break;
      }
      case 'over': {
        world(dt, inputs.map(() => NO_INPUT), false);
        G.overT += dt;
        if (G.overT > 1.5 && !G.resultShown) showResult();
        break;
      }
      default: break;
    }
  }

  let last = performance.now(), acc = 0;
  function frame(now) {
    const dt = Math.min(.1, (now - last) / 1000);
    last = now;
    pollGamepads();
    if (!G.paused) {
      acc += dt;
      let n = 0;
      while (acc >= STEP && n < 6) {
        step(STEP);
        acc -= STEP;
        n++;
      }
      if (n >= 6) acc = 0;
    }
    render(now / 1000);
    updateHUD(false);
    requestAnimationFrame(frame);
  }

  /* =========================================================
  Desenho
  ========================================================= */
  let dpr = 1, view = { scale: 1, ox: 0, oy: 0, cw: W, ch: H };
  const staticLayer = document.createElement('canvas');
  const sctx = staticLayer.getContext('2d');
  const DISPLAY = '"Big Shoulders Display", Impact, "Arial Narrow", sans-serif';
  const BODY = '"Saira Semi Condensed", "Arial Narrow", sans-serif';

  function resize() {
    const r = stage.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    view.cw = r.width;
    view.ch = r.height;
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    view.scale = Math.min(r.width / W, r.height / H);
    view.ox = (r.width - W * view.scale) / 2;
    view.oy = (r.height - H * view.scale) / 2;
    if (view.ch > view.cw * 1.05) view.oy = Math.max(view.oy * .55, 70);
    buildStatic();
    checkRotate();
    if (!touchEl.hidden) {
      stickHome(0);
      stickHome(1);
    }
  }

  function rr(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function buildStatic() {
    staticLayer.width = canvas.width;
    staticLayer.height = canvas.height;
    const c = sctx, s = view.scale * dpr;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#06120d';
    c.fillRect(0, 0, staticLayer.width, staticLayer.height);
    c.setTransform(s, 0, 0, s, view.ox * dpr, view.oy * dpr);
    const x0 = -view.ox / view.scale - 4, y0 = -view.oy / view.scale - 4;
    const x1 = (view.cw - view.ox) / view.scale + 4, y1 = (view.ch - view.oy) / view.scale + 4;

    // arquibancada
    const sg = c.createLinearGradient(0, y0, 0, F.t);
    sg.addColorStop(0, '#040b08');
    sg.addColorStop(1, '#0d2219');
    c.fillStyle = sg;
    c.fillRect(x0, y0, x1 - x0, y1 - y0);
    const crowd = ['#ffd23f', '#ffd23f', '#f2c230', '#0f8a4a', '#159f55', '#f4f1e8', '#2348c9', '#3a5fd9', '#6b4129', '#8d5a3a', '#d9a27a', '#ff4d3d'];
    let seed = 7;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const crowdRect = (ax, ay, bx, by) => {
      for (let y = ay; y < by; y += 7) {
        const fade = 0.35 + 0.65 * clamp((y - ay) / Math.max(1, by - ay), 0, 1);
        for (let x = ax + (((y / 7) | 0) % 2) * 3.5; x < bx; x += 7) {
          if (rnd() < .1) continue;
          c.globalAlpha = fade * (.4 + rnd() * .38);
          c.fillStyle = crowd[(rnd() * crowd.length) | 0];
          c.beginPath();
          c.arc(x + rnd() * 2, y + rnd() * 2, 2.4 + rnd() * .9, 0, Math.PI * 2);
          c.fill();
        }
      }
      c.globalAlpha = 1;
    };
    crowdRect(x0, y0, x1, F.t - 40);
    crowdRect(x0, F.b + 34, x1, y1);
    crowdRect(x0, F.t - 40, F.l - GOAL_DEPTH - 18, F.b + 34);
    crowdRect(F.r + GOAL_DEPTH + 18, F.t - 40, x1, F.b + 34);
    // faixas da torcida
    const flags = [[F.l + 150, '#0f8a4a', '#ffd23f'], [F.r - 280, '#2348c9', '#f4f1e8']];
    for (const [fx, a, b] of flags) {
      if (F.t - 40 - y0 < 30) break;
      c.fillStyle = a;
      c.fillRect(fx, F.t - 74, 130, 26);
      c.fillStyle = b;
      c.font = '900 17px ' + DISPLAY;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(fx < F.cx ? 'RUMO AO HEXA' : 'VAI, CAMISA 10', fx + 65, F.t - 60);
    }
    // refletores
    for (const lx of [x0 + 40, x1 - 40]) {
      const g = c.createRadialGradient(lx, y0 + 20, 0, lx, y0 + 20, 520);
      g.addColorStop(0, 'rgba(255,250,220,.24)');
      g.addColorStop(1, 'rgba(255,250,220,0)');
      c.fillStyle = g;
      c.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
    // pista ao redor do gramado
    c.fillStyle = '#16502a';
    c.fillRect(F.l - GOAL_DEPTH - 14, F.t - 34, F.w + 2 * (GOAL_DEPTH + 14), F.h + 66);
    // placas de publicidade
    const ads = ['GOLAÇO 10', 'FUTEBOL ARTE', 'BOLA NA REDE', 'OLÉ!', 'CAMISA 10', 'TORCIDA', 'CRAQUE'];
    const boards = (y, h) => {
      const x0b = F.l - GOAL_DEPTH - 14, total = F.w + 2 * (GOAL_DEPTH + 14);
      const nB = Math.round(total / 170), w = total / nB;
      for (let i = 0; i < nB; i++) {
        const x = x0b + i * w;
        const bg = ['#0b1a12', '#2348c9', '#0f8a4a', '#111'][i % 4];
        const fg = ['#ffd23f', '#f4f1e8', '#ffd23f', '#5fd4ff'][i % 4];
        c.fillStyle = bg;
        c.fillRect(x, y, w - 2, h);
        c.fillStyle = fg;
        c.font = '900 ' + (h * .72) + 'px ' + DISPLAY;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.save();
        c.beginPath();
        c.rect(x, y, w - 2, h);
        c.clip();
        c.fillText(ads[i % ads.length], x + w / 2, y + h / 2 + 1);
        c.restore();
      }
    };
    boards(F.t - 32, 18);
    if (F.b + 30 < y1) boards(F.b + 12, 16);

    // gramado listrado
    const stripes = 14, sw = F.w / stripes;
    for (let i = 0; i < stripes; i++) {
      c.fillStyle = i % 2 ? '#2a8a43' : '#30984b';
      c.fillRect(F.l + i * sw, F.t, sw + .5, F.h);
    }
    // borda externa do gramado (além das linhas)
    c.fillStyle = '#25803e';
    c.fillRect(F.l - GOAL_DEPTH - 6, F.t - 12, F.w + 2 * (GOAL_DEPTH + 6), 12);
    c.fillRect(F.l - GOAL_DEPTH - 6, F.b, F.w + 2 * (GOAL_DEPTH + 6), 12);
    c.fillRect(F.l - GOAL_DEPTH - 6, F.t, GOAL_DEPTH + 6, F.h);
    c.fillRect(F.r, F.t, GOAL_DEPTH + 6, F.h);
    // brilho dos refletores no gramado
    const lg = c.createRadialGradient(F.cx, F.cy - 80, 50, F.cx, F.cy, F.w * .7);
    lg.addColorStop(0, 'rgba(255,255,230,.10)');
    lg.addColorStop(1, 'rgba(0,0,0,.22)');
    c.fillStyle = lg;
    c.fillRect(F.l - GOAL_DEPTH, F.t - 12, F.w + GOAL_DEPTH * 2, F.h + 24);

    // linhas
    c.strokeStyle = 'rgba(255,255,255,.88)';
    c.lineWidth = 3;
    c.lineJoin = 'round';
    c.strokeRect(F.l, F.t, F.w, F.h);
    c.beginPath();
    c.moveTo(F.cx, F.t);
    c.lineTo(F.cx, F.b);
    c.stroke();
    c.beginPath();
    c.arc(F.cx, F.cy, 76, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = 'rgba(255,255,255,.9)';
    c.beginPath();
    c.arc(F.cx, F.cy, 4, 0, Math.PI * 2);
    c.fill();
    for (const s of [-1, 1]) {
      const lx = s < 0 ? F.l : F.r, inw = -s;
      c.strokeRect(Math.min(lx, lx + inw * BOX_D), F.cy - BOX_H, BOX_D, BOX_H * 2);
      c.strokeRect(Math.min(lx, lx + inw * SBOX_D), F.cy - SBOX_H, SBOX_D, SBOX_H * 2);
      const px = lx + inw * PEN_X;
      c.beginPath();
      c.arc(px, F.cy, 3.5, 0, Math.PI * 2);
      c.fill();
      const lim = Math.acos((BOX_D - PEN_X) / 76);
      c.beginPath();
      if (s < 0) c.arc(px, F.cy, 76, -lim, lim);
      else c.arc(px, F.cy, 76, Math.PI - lim, Math.PI + lim);
      c.stroke();
      for (const cy of [F.t, F.b]) {
        c.beginPath();
        const a0 = s < 0 ? (cy === F.t ? 0 : -Math.PI / 2) : (cy === F.t ? Math.PI / 2 : Math.PI);
        c.arc(lx, cy, 14, a0, a0 + Math.PI / 2);
        c.stroke();
      }
    }
    // sombra interna
    const vg = c.createLinearGradient(0, F.t, 0, F.t + 40);
    vg.addColorStop(0, 'rgba(0,0,0,.25)');
    vg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = vg;
    c.fillRect(F.l, F.t, F.w, 40);
  }

  function drawGoal(s, front) {
    const lx = s < 0 ? F.l : F.r, bx = lx + s * GOAL_DEPTH;
    const HF = 34, HB = 20;
    const bul = G.net && G.net.side === s ? G.net.amt : 0;
    const by = G.net ? G.net.y : F.cy;
    const bxAt = (y) => bx + s * bul * Math.exp(-((y - by) * (y - by)) / 900);
    if (!front) {
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      ctx.fillRect(Math.min(lx, bx), GT, GOAL_DEPTH, GB - GT);
      // rede lateral de trás
      ctx.fillStyle = 'rgba(255,255,255,.07)';
      ctx.beginPath();
      ctx.moveTo(lx, GT);
      ctx.lineTo(lx, GT - HF);
      ctx.lineTo(bx, GT - HB);
      ctx.lineTo(bx, GT);
      ctx.closePath();
      ctx.fill();
      // malha da rede (teto + fundo)
      ctx.strokeStyle = 'rgba(255,255,255,.34)';
      ctx.lineWidth = .9;
      ctx.beginPath();
      for (let y = GT; y <= GB + .1; y += 8) {
        const b = bxAt(y);
        ctx.moveTo(lx, y - HF);
        ctx.lineTo(b, y - HB);
        ctx.lineTo(b, y);
      }
      for (const f of [.25, .5, .75, 1]) {
        let first = true;
        for (let y = GT; y <= GB + .1; y += 8) {
          const b = bxAt(y);
          const px = lerp(lx, b, f), py = lerp(y - HF, y - HB, f);
          if (first) {
            ctx.moveTo(px, py);
            first = false;
          } else ctx.lineTo(px, py);
        }
      }
      for (const f of [.33, .66]) {
        let first = true;
        for (let y = GT; y <= GB + .1; y += 8) {
          const b = bxAt(y), py = lerp(y - HB, y, f);
          if (first) {
            ctx.moveTo(b, py);
            first = false;
          } else ctx.lineTo(b, py);
        }
      }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(244,241,232,.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bx, GT);
      ctx.lineTo(bx, GT - HB);
      ctx.lineTo(lx, GT - HF);
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,.08)';
      ctx.beginPath();
      ctx.moveTo(lx, GB);
      ctx.lineTo(lx, GB - HF);
      ctx.lineTo(bx, GB - HB);
      ctx.lineTo(bx, GB);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.3)';
      ctx.lineWidth = .9;
      ctx.beginPath();
      for (const f of [.25, .5, .75]) {
        ctx.moveTo(lerp(lx, bx, f), GB);
        ctx.lineTo(lerp(lx, bx, f), lerp(GB - HF, GB - HB, f));
      }
      ctx.moveTo(lx, GB - HF * .5);
      ctx.lineTo(bx, GB - HB * .5);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(244,241,232,.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bx, GB);
      ctx.lineTo(bx, GB - HB);
      ctx.lineTo(lx, GB - HF);
      ctx.stroke();
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(0,0,0,.35)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(lx + 2, GT);
      ctx.lineTo(lx + 2, GT - HF);
      ctx.lineTo(lx + 2, GB - HF);
      ctx.lineTo(lx + 2, GB);
      ctx.stroke();
      ctx.strokeStyle = '#f7f5ee';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(lx, GT);
      ctx.lineTo(lx, GT - HF);
      ctx.lineTo(lx, GB - HF);
      ctx.lineTo(lx, GB);
      ctx.stroke();
      ctx.lineCap = 'butt';
    }
  }

  function drawShadow(x, y, rx) {
    ctx.fillStyle = 'rgba(0,0,0,.32)';
    ctx.beginPath();
    ctx.ellipse(x, y + 1, rx, rx * .36, 0, 0, Math.PI * 2);
    ctx.fill();
    // sombras múltiplas dos refletores
    ctx.fillStyle = 'rgba(0,0,0,.12)';
    ctx.beginPath();
    ctx.ellipse(x - 8, y + 2, rx * .9, rx * .3, -.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 8, y + 2, rx * .9, rx * .3, .5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPlayer(p) {
    const k = p.kit;
    const sp = Math.hypot(p.vx, p.vy);
    const run = sp > 18;
    const sw = run ? Math.sin(p.anim) : 0;
    const flip = Math.cos(p.face) < -0.05 ? -1 : 1;
    const back = Math.sin(p.face) < -0.6;
    const isK = p.role === 'keeper';
    const sc = isK ? 1.08 : 1;
    // marcação do jogador humano
    if (p.human >= 0) {
      const col = p.human ? '#5fd4ff' : '#ffd23f';
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 1, 17, 6.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      if (p.dashCD > 0) {
        ctx.strokeStyle = 'rgba(0,0,0,.45)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y + 1, 17, 6.5, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (p.dashCD / 1.05));
        ctx.stroke();
      }
    }
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.slideT > 0) {
      ctx.rotate(flip * 1.2);
      ctx.translate(0, 4);
    }
    if (isK && p.diveT > 0) {
      ctx.translate(0, -6);
      ctx.rotate(p.diveDir * flip * 1.1);
    }
    if (p.stunT > 0 && p.role === 'field') ctx.rotate(Math.sin(G.clock * 40) * .08);
    ctx.scale(sc * flip, sc);
    const lunge = p.lungeT > 0 ? 6 : 0;
    // pernas
    for (const sg of [1, -1]) {
      let fx = sg * 3 + sg * sw * 5, fy = -1;
      if (p.kickAnim > 0 && sg === 1) {
        fx = 10 + lunge;
        fy = -5;
      }
      else if (sg === 1) fx += lunge;
      const hx = sg * 3.4, hy = -13;
      ctx.strokeStyle = p.skin;
      ctx.lineWidth = 4.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(lerp(hx, fx, .55), lerp(hy, fy, .55));
      ctx.stroke();
      ctx.strokeStyle = k.socks;
      ctx.beginPath();
      ctx.moveTo(lerp(hx, fx, .55), lerp(hy, fy, .55));
      ctx.lineTo(fx, fy - 1);
      ctx.stroke();
      ctx.fillStyle = '#141414';
      ctx.beginPath();
      ctx.ellipse(fx + 1.5, fy, 3.6, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // braços
    const armSw = run ? -sw * 4 : 0;
    for (const sg of [1, -1]) {
      const ax = sg * 8.5, ay = -29;
      const hx = sg * 10 + armSw * sg, hy = -19;
      ctx.strokeStyle = k.shirt;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(lerp(ax, hx, .5), lerp(ay, hy, .5));
      ctx.stroke();
      ctx.strokeStyle = p.skin;
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.moveTo(lerp(ax, hx, .5), lerp(ay, hy, .5));
      ctx.lineTo(hx, hy);
      ctx.stroke();
      if (isK) {
        ctx.fillStyle = k.gloves || '#fff';
        ctx.beginPath();
        ctx.arc(hx, hy, 3.1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // calção
    ctx.fillStyle = k.shorts;
    rr(ctx, -7.5, -19, 15, 7.5, 2.5);
    ctx.fill();
    // camisa
    ctx.fillStyle = k.shirt;
    rr(ctx, -8.5, -33, 17, 16, 4);
    ctx.fill();
    ctx.fillStyle = k.trim;
    ctx.fillRect(-8.5, -21, 17, 1.6);
    if (!back) {
      ctx.beginPath();
      ctx.moveTo(-3.5, -33);
      ctx.lineTo(0, -29.5);
      ctx.lineTo(3.5, -33);
      ctx.closePath();
      ctx.fill();
    }
    // número
    ctx.save();
    ctx.scale(flip, 1);
    ctx.fillStyle = k.num;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 ' + (back ? 10 : 7.5) + 'px ' + DISPLAY;
    ctx.fillText(String(p.num), back ? 0 : 3.2 * flip, back ? -25.5 : -25);
    ctx.restore();
    // cabeça
    ctx.fillStyle = p.skin;
    ctx.beginPath();
    ctx.arc(0, -39.5, 6.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.hair;
    if (back) {
      ctx.beginPath();
      ctx.arc(0, -40, 6.9, 0, Math.PI * 2);
      ctx.fill();
    }
    else if (p.hairStyle === 1) {
      ctx.beginPath();
      ctx.arc(-1, -42.5, 7.4, Math.PI * .95, Math.PI * 2.1);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-4.5, -40.5, 3.6, 0, Math.PI * 2);
      ctx.fill();
    }
    else if (p.hairStyle === 2) {
      ctx.beginPath();
      ctx.arc(0, -40.5, 6.8, Math.PI * 1.05, Math.PI * 1.95);
      ctx.fill();
    }
    else if (p.hairStyle === 3) {
      ctx.beginPath();
      ctx.arc(-1, -41, 7.2, Math.PI * .8, Math.PI * 2.05);
      ctx.fill();
      ctx.fillRect(-7.5, -41, 3.4, 8);
    }
    else {
      ctx.beginPath();
      ctx.arc(-.5, -41.5, 7, Math.PI * .98, Math.PI * 2.02);
      ctx.fill();
    }
    if (!back) {
      ctx.fillStyle = '#111';
      ctx.fillRect(2.4, -40.6, 1.4, 1.6);
      ctx.fillRect(4.8, -40.6, 1.3, 1.6);
    }
    ctx.restore();

    // nome e barra de força
    if (p.human >= 0) {
      const col = p.human ? '#5fd4ff' : '#ffd23f';
      const ty = p.y - 60;
      ctx.font = '700 11px ' + BODY;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(6,18,13,.85)';
      ctx.strokeText(p.name, p.x, ty - 6);
      ctx.fillStyle = col;
      ctx.fillText(p.name, p.x, ty - 6);
      ctx.beginPath();
      ctx.moveTo(p.x - 5, ty - 4);
      ctx.lineTo(p.x + 5, ty - 4);
      ctx.lineTo(p.x, ty + 2);
      ctx.closePath();
      ctx.fill();
      if (p.charging) {
        const w = 36, h = 6, bx = p.x - w / 2, byy = p.y - 54;
        ctx.fillStyle = 'rgba(6,18,13,.85)';
        ctx.fillRect(bx - 2, byy - 2, w + 4, h + 4);
        const g = ctx.createLinearGradient(bx, 0, bx + w, 0);
        g.addColorStop(0, '#7fd36b');
        g.addColorStop(.6, '#ffd23f');
        g.addColorStop(1, '#ff4d3d');
        ctx.fillStyle = g;
        ctx.fillRect(bx, byy, w * p.charge, h);
      }
    }
  }

  function drawBall() {
    const bx = ball.x, by = ball.y - ball.z - 5;
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    const sr = Math.max(3, 7 - ball.z * .05);
    ctx.beginPath();
    ctx.ellipse(ball.x, ball.y + 1, sr, sr * .45, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < ball.trail.length; i++) {
      const t = ball.trail[i], a = (i + 1) / ball.trail.length;
      ctx.fillStyle = 'rgba(255,255,255,' + (a * .25) + ')';
      ctx.beginPath();
      ctx.arc(t.x, t.y - 5, BALL_R * a * .9, 0, Math.PI * 2);
      ctx.fill();
    }
    const g = ctx.createRadialGradient(bx - 2.5, by - 2.5, 1, bx, by, BALL_R);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#cdd3d8');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(bx, by, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.arc(bx, by, BALL_R, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#1d1d1d';
    for (let i = 0; i < 3; i++) {
      const a = ball.rot + i * 2.094;
      const px = bx + Math.cos(a) * BALL_R * .62, py = by + Math.sin(a * .7 + i) * BALL_R * .45;
      ctx.beginPath();
      ctx.arc(px, py, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,.55)';
    ctx.lineWidth = .9;
    ctx.beginPath();
    ctx.arc(bx, by, BALL_R, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawBigText(txt, scale, alpha, color) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(F.cx, F.cy - 10);
    ctx.scale(scale, scale);
    ctx.transform(1, 0, -.16, 1, 0, 0);
    ctx.font = '900 150px ' + DISPLAY;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 12;
    ctx.strokeStyle = '#0b1a12';
    ctx.lineJoin = 'round';
    ctx.strokeText(txt, 0, 0);
    ctx.fillStyle = color;
    ctx.fillText(txt, 0, 0);
    ctx.restore();
  }

  function render(t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(staticLayer, 0, 0);
    const s = view.scale * dpr;
    let sx = 0, sy = 0;
    if (G.shake > 0) {
      sx = rand(-1, 1) * G.shake * 7;
      sy = rand(-1, 1) * G.shake * 7;
    }
    ctx.setTransform(s, 0, 0, s, (view.ox + sx * view.scale) * dpr, (view.oy + sy * view.scale) * dpr);

    drawGoal(-1, false);
    drawGoal(1, false);
    for (const p of G.players) drawShadow(p.x, p.y, p.role === 'keeper' ? 12 : 11);
    const ents = G.players.slice();
    ents.push(ball);
    ents.sort((a, b) => a.y - b.y);
    for (const e of ents) {
      if (e === ball) drawBall();
      else drawPlayer(e);
    }
    drawGoal(-1, true);
    drawGoal(1, true);

    for (const q of G.particles) {
      const a = 1 - q.t / q.life;
      if (q.type === 'flash') {
        const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, 10);
        g.addColorStop(0, 'rgba(255,255,255,' + a + ')');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(q.x - 10, q.y - 10, 20, 20);
      } else if (q.type === 'confetti') {
        ctx.save();
        ctx.globalAlpha = Math.min(1, a * 2);
        ctx.translate(q.x, q.y);
        ctx.rotate(q.rot);
        ctx.fillStyle = q.color;
        ctx.fillRect(-q.size / 2, -q.size / 4, q.size, q.size / 2);
        ctx.restore();
      } else if (q.type === 'ghost') {
        ctx.globalAlpha = a * .35;
        ctx.fillStyle = q.color;
        ctx.beginPath();
        ctx.ellipse(q.x, q.y, 8, 13, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else {
        ctx.globalAlpha = a;
        ctx.fillStyle = q.color;
        ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
        ctx.globalAlpha = 1;
      }
    }
    for (const f of G.floaters) {
      const a = f.t < .15 ? f.t / .15 : 1 - Math.max(0, (f.t - .8) / (f.life - .8));
      const sc = f.t < .15 ? .6 + f.t / .15 * .4 : 1;
      ctx.save();
      ctx.globalAlpha = clamp(a, 0, 1);
      ctx.translate(f.x, f.y);
      ctx.scale(sc, sc);
      ctx.font = '900 ' + f.size + 'px ' + DISPLAY;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(6,18,13,.9)';
      ctx.lineJoin = 'round';
      ctx.strokeText(f.text, 0, 0);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, 0, 0);
      ctx.restore();
    }
    if (G.mode !== 'demo') {
      if (G.state === 'countdown') {
        if (G.cdLen > 2) {
          const n = 3 - Math.floor(G.cdT / .8), fr = (G.cdT % .8) / .8;
          if (n > 0) drawBigText(String(n), 1.25 - fr * .35, 1 - Math.max(0, fr - .7) / .3, '#f4f1e8');
        } else drawBigText('PREPARA', .6, .9, '#f4f1e8');
      }
      if (G.goFlash > 0 && G.state === 'play') drawBigText('VAI!', 1.1 + (.7 - G.goFlash) * .5, Math.min(1, G.goFlash / .3), '#ffd23f');
    }
  }

  /* =========================================================
  Interface (HUD, telas e botões)
  ========================================================= */
  const OVERLAYS = ['menu', 'help', 'intro', 'pause', 'result', 'rotate'];
  let helpReturn = 'menu';
  function visibleOverlay() {
    for (const id of OVERLAYS) if (!$(id).hidden) return id;
    return null;
  }
  function showOverlay(id) {
    for (const o of OVERLAYS) $(o).hidden = o !== id;
    if (id) {
      const p = $(id).querySelector('[data-primary]');
      if (p && !isTouch) setTimeout(() => {
        try {
          p.focus({ preventScroll: true });
        } catch (e) {
          p.focus();
        }
      }, 30);
    }
  }
  function clickPrimary() {
    const id = visibleOverlay();
    if (!id) return;
    const p = $(id).querySelector('[data-primary]');
    if (p) p.click();
  }

  const hud = { el: $('hud'), hs: $('homeScore'), as: $('awayScore'), hn: $('homeName'), an: $('awayName'), clock: $('clock'), sub: $('boardSub'), pts: $('pointsVal'), ptsBox: $('pointsBox') };
  function setText(e, v) {
    v = String(v);
    if (e._v !== v) {
      e._v = v;
      e.textContent = v;
    }
  }
  function updateHUD() {
    if (hud.el.hidden) return;
    setText(hud.hs, G.score.home);
    setText(hud.as, G.score.away);
    setText(hud.clock, G.golden ? 'Gol de ouro' : fmtTime(G.time));
    hud.clock.classList.toggle('urgent', !G.golden && G.time <= 10 && G.state === 'play');
    hud.clock.classList.toggle('gold', G.golden);
    setText(hud.pts, fmtPts(G.points));
  }
  function setupHUD() {
    const vs = G.mode === 'versus';
    let hn, an;
    if (vs) {
      hn = code3(G.names[0], 'J1');
      an = code3(G.names[1], 'J2');
      if (hn === an) {
        hn += '1';
        an += '2';
      }
    }
    else {
      hn = G.mode === 'coop' ? 'AMA' : code3(G.names[0], 'J1');
      an = code3(G.ph.rival, 'RIV');
    }
    setText(hud.hn, hn);
    setText(hud.an, an);
    $('homeSwatch').style.setProperty('--c', KIT_HOME.shirt);
    $('awaySwatch').style.setProperty('--c', vs ? KIT_P2_VS.shirt : G.ph.kit.shirt);
    setText(hud.sub, vs ? 'Clássico · primeiro a ' + VERSUS.goals + ' gols' : 'Fase ' + (G.phaseIdx + 1) + ' · ' + G.ph.name + ' · primeiro a ' + G.ph.goals);
    hud.ptsBox.style.visibility = vs ? 'hidden' : 'visible';
  }

  let bannerTimer = 0, toastTimer = 0;
  function showBanner(title, sub) {
    const b = $('banner');
    $('bannerTitle').textContent = title;
    $('bannerSub').textContent = sub || '';
    $('bannerSub').hidden = !sub;
    b.hidden = false;
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(hideBanner, 2600);
  }
  function hideBanner() {
    $('banner').hidden = true;
  }
  function showToast(text, ms) {
    const t = $('toast');
    t.textContent = text;
    t.hidden = false;
    t.classList.remove('show');
    void t.offsetWidth;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, ms || 2200);
  }
  function hideToast() {
    $('toast').hidden = true;
  }

  function readMenu() {
    const mode = document.querySelector('input[name="mode"]:checked').value;
    const n1 = ($('name1').value || '').trim().slice(0, 12) || 'Craque';
    const n2 = ($('name2').value || '').trim().slice(0, 12) || 'Artilheiro';
    G.names = [n1, n2];
    store.set('names', G.names);
    store.set('mode', mode);
    return mode;
  }
  function syncNames() {
    const mode = document.querySelector('input[name="mode"]:checked').value;
    $('names').classList.toggle('solo', mode === 'solo');
  }

  function startMatchFlow() {
    // monta a partida e mostra a ficha da fase
    G.paused = false;
    setupMatch();
    placeForKickoff('home');
    G.state = 'idle';
    G.inMatch = true;
    hideBanner();
    hideToast();
    $('hud').hidden = false;
    $('pauseBtn').hidden = false;
    setupHUD();
    updateHUD();
    syncTouchUI();
    const vs = G.mode === 'versus';
    const ph = G.ph;
    $('introEyebrow').textContent = vs ? 'Clássico · 2 jogadores' : 'Fase ' + (G.phaseIdx + 1) + ' de ' + PHASES.length + (G.mode === 'coop' ? ' · dupla' : '');
    $('introTitle').textContent = vs ? 'Um contra um' : ph.name;
    const chip = (node, label, color) => {
      node.textContent = '';
      const i = el('i');
      i.style.setProperty('--c', color);
      node.append(i, document.createTextNode(label));
    };
    chip($('introHome'), vs ? G.names[0] : teamName('home'), KIT_HOME.shirt);
    chip($('introAway'), vs ? G.names[1] : ph.rival, vs ? KIT_P2_VS.shirt : ph.kit.shirt);
    $('introGoal').textContent = 'Primeiro a ' + ph.goals + ' gols';
    $('introTime').textContent = fmtTime(ph.time) + ' · empate vira gol de ouro';
    const nOpp = G.players.filter((p) => p.team === 'away' && p.role === 'field' && p.human < 0).length;
    $('introOpp').textContent = vs ? 'Goleiros controlados pela máquina' : nOpp + ' na linha + goleiro';
    const diff = $('introDiff');
    diff.textContent = '';
    const lvl = vs ? 3 : G.phaseIdx + 1;
    for (let i = 0; i < 6; i++) diff.appendChild(el('i', i < lvl ? 'on' : ''));
    diff.setAttribute('aria-label', 'Dificuldade ' + lvl + ' de 6');
    showOverlay('intro');
  }

  function kickoffMatch() {
    Sfx.init();
    showOverlay(null);
    placeForKickoff('home');
    G.state = 'countdown';
    G.cdT = 0;
    G.cdLen = 2.6;
    G.lastTick = -1;
    G.paused = false;
    syncTouchUI();
    checkRotate();
  }

  function goMenu() {
    G.inMatch = false;
    G.paused = false;
    $('hud').hidden = true;
    $('pauseBtn').hidden = true;
    hideBanner();
    hideToast();
    G.mode = 'demo';
    G.phaseIdx = 0;
    setupMatch();
    placeForKickoff('home');
    G.state = 'play';
    syncTouchUI();
    renderRecords();
    showOverlay('menu');
  }

  function togglePause() {
    if (!G.inMatch) return;
    const ov = visibleOverlay();
    if (G.paused && ov === 'pause') {
      resumeGame();
      return;
    }
    if (ov !== null) return;
    if (G.state === 'idle' || G.state === 'over') return;
    G.paused = true;
    for (const s of touch.slots) {
      s.x = s.y = 0;
      s.shoot = s.dash = false;
    }
    showOverlay('pause');
  }
  function resumeGame() {
    showOverlay(null);
    G.paused = false;
    last = performance.now();
    keys.clear();
  }

  $('menuForm').addEventListener('submit', (e) => {
    e.preventDefault();
    Sfx.init();
    Sfx.click();
    const mode = readMenu();
    G.mode = mode;
    G.phaseIdx = 0;
    G.points = 0;
    G.phaseStartPoints = 0;
    startMatchFlow();
  });
  document.querySelectorAll('input[name="mode"]').forEach((r) => r.addEventListener('change', () => {
    syncNames();
    Sfx.click();
  }));
  $('helpBtn').addEventListener('click', () => {
    Sfx.init();
    Sfx.click();
    helpReturn = 'menu';
    showOverlay('help');
  });
  $('pauseHelpBtn').addEventListener('click', () => {
    Sfx.click();
    helpReturn = 'pause';
    showOverlay('help');
  });
  $('helpBack').addEventListener('click', () => {
    Sfx.click();
    showOverlay(helpReturn);
  });
  $('introGo').addEventListener('click', () => {
    Sfx.click();
    kickoffMatch();
  });
  $('introMenu').addEventListener('click', () => {
    Sfx.click();
    goMenu();
  });
  $('resumeBtn').addEventListener('click', () => {
    Sfx.click();
    resumeGame();
  });
  $('restartBtn').addEventListener('click', () => {
    Sfx.click();
    G.points = G.phaseStartPoints;
    startMatchFlow();
  });
  $('quitBtn').addEventListener('click', () => {
    Sfx.click();
    goMenu();
  });
  $('pauseBtn').addEventListener('click', () => {
    Sfx.init();
    togglePause();
  });
  $('soundBtn').addEventListener('click', () => {
    Sfx.init();
    Sfx.setMuted(!Sfx.muted);
    syncSoundBtn();
    Sfx.click();
  });
  $('fsBtn').addEventListener('click', () => {
    const d = document, root = d.documentElement;
    try {
      if (d.fullscreenElement || d.webkitFullscreenElement) {
        (d.exitFullscreen || d.webkitExitFullscreen).call(d);
        return;
      }
      const req = root.requestFullscreen || root.webkitRequestFullscreen;
      if (req) {
        const r = req.call(root);
        if (r && r.then) r.then(() => {
          try {
            screen.orientation.lock('landscape').catch(() => {});
          } catch (e) {
          /* ok */ }
        }).catch(() => {});
      }
    } catch (e) {
    /* sem tela cheia */ }
  });
  $('rotateOk').addEventListener('click', () => {
    rotateDismissed = true;
    showOverlay(rotateReturn);
  });
  function syncSoundBtn() {
    $('soundBtn').classList.toggle('muted', Sfx.muted);
    $('soundBtn').setAttribute('aria-pressed', String(!Sfx.muted));
  }

  let rotateDismissed = false, rotateReturn = null;
  function checkRotate() {
    const portrait = view.ch > view.cw * 1.05;
    const ov = visibleOverlay();
    if (isTouch && portrait && !rotateDismissed && G.inMatch && G.state !== 'idle' && ov === null) {
      rotateReturn = null;
      G.paused = true;
      showOverlay('rotate');
    }
    else if (ov === 'rotate' && !portrait) {
      showOverlay(rotateReturn);
      G.paused = false;
      last = performance.now();
    }
  }
  $('rotateOk').addEventListener('click', () => {
    G.paused = false;
    last = performance.now();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && G.inMatch && !G.paused && (G.state === 'play' || G.state === 'countdown' || G.state === 'goal') && visibleOverlay() === null) togglePause();
  });

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => buildStatic()).catch(() => {});

  /* =========================================================
  Início
  ========================================================= */
  function boot(data) {
    data = data || {};
    if (Array.isArray(data.names) && data.names.length === 2) G.names = data.names.map((n) => String(n).slice(0, 12));
    $('name1').value = G.names[0];
    $('name2').value = G.names[1];
    const savedMode = store.get('mode', 'solo');
    const radio = document.querySelector('input[name="mode"][value="' + (data.mode || savedMode) + '"]');
    if (radio) radio.checked = true;
    syncNames();
    syncSoundBtn();
    renderRecords();
    resize();
    goMenu();
    if (data.inMatch && (data.mode === 'solo' || data.mode === 'coop' || data.mode === 'versus')) {
      G.mode = data.mode;
      G.phaseIdx = clamp(data.phaseIdx | 0, 0, PHASES.length - 1);
      G.points = G.phaseStartPoints = Math.max(0, +data.points || 0);
      startMatchFlow();
    }
    requestAnimationFrame((t) => {
      last = t;
      requestAnimationFrame(frame);
    });
  }

  try {
    const hot = window.claude && window.claude.hot;
    if (hot && hot.snapshot) hot.snapshot(() => ({ names: G.names, mode: G.inMatch ? G.mode : null, inMatch: G.inMatch, phaseIdx: G.phaseIdx, points: G.phaseStartPoints }));
    if (hot && hot.ready) hot.ready(boot);
    else boot((hot && hot.data) || {});
  } catch (e) {
    boot({});
  }

  if (DEBUG) window.__golaco = { G, ball, F, PHASES, setupMatch, placeForKickoff, world, kickRaw, step, startMatchFlow, kickoffMatch, NO_INPUT, GT, GB };
})();
