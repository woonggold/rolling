(() => {
  "use strict";

  // ---------- 멤버 관리 ----------
  const DEFAULT_MEMBERS = [
    { name: "김보석", img: "assets/boseok.png" },
    { name: "백민우", img: "assets/minwoo.png" },
    { name: "장윤성", img: "assets/yunseong.png" },
    { name: "장준혁", img: "assets/junhyuk.png" },
    { name: "이정웅", img: "assets/jeongwoong.png" },
    { name: "이성복", img: "assets/seongbok.png" },
  ];
  const COLORS = ["#ff5a5f", "#3db2ff", "#ffcc33", "#5ee07a", "#c77dff", "#ff8a3d", "#2ee6d6", "#ff7ac6"];
  const STORE_KEY = "rolling.members.v3";

  let members = loadMembers();
  let mode = "first";
  let trackLen = 6500;
  let muted = false;

  function loadMembers() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY));
      if (Array.isArray(saved) && saved.length) return saved;
    } catch (e) { /* 저장소 사용 불가 */ }
    return DEFAULT_MEMBERS.map((m) => ({ ...m }));
  }
  function saveMembers() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(members)); } catch (e) { /* 무시 */ }
  }

  // 사진이 없으면 이니셜 아바타 생성
  function initialAvatar(name, color) {
    const c = document.createElement("canvas");
    c.width = c.height = 160;
    const g = c.getContext("2d");
    g.fillStyle = color;
    g.fillRect(0, 0, 160, 160);
    g.fillStyle = "#fff";
    g.font = "bold 80px sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(name.slice(0, 1), 80, 86);
    return c.toDataURL("image/png");
  }

  // 업로드 사진을 정사각형 160px로 줄여서 저장
  function fileToSquare(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const s = Math.min(img.width, img.height);
          const c = document.createElement("canvas");
          c.width = c.height = 160;
          c.getContext("2d").drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 160, 160);
          resolve(c.toDataURL("image/jpeg", 0.85));
        };
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  const $ = (id) => document.getElementById(id);
  const memberList = $("memberList");

  function renderMembers() {
    memberList.innerHTML = "";
    members.forEach((m, i) => {
      const div = document.createElement("div");
      div.className = "member";
      div.style.setProperty("--c", COLORS[i % COLORS.length]);
      div.innerHTML = `<button class="del" title="삭제">✕</button><img alt="" /><div class="name"></div>`;
      div.querySelector("img").src = m.img;
      div.querySelector(".name").textContent = m.name;
      div.querySelector(".del").onclick = () => {
        members.splice(i, 1);
        saveMembers();
        renderMembers();
      };
      memberList.appendChild(div);
    });
    $("startBtn").disabled = members.length < 2;
    $("startBtn").textContent = members.length < 2 ? "2명 이상 필요해요" : "출발! 🏁";
  }

  $("newPhoto").onchange = (e) => {
    e.target.parentElement.classList.toggle("has-file", !!e.target.files[0]);
  };
  $("addForm").onsubmit = async (e) => {
    e.preventDefault();
    const name = $("newName").value.trim();
    if (!name) return;
    const file = $("newPhoto").files[0];
    let img;
    try {
      img = file ? await fileToSquare(file) : initialAvatar(name, COLORS[members.length % COLORS.length]);
    } catch (err) {
      img = initialAvatar(name, COLORS[members.length % COLORS.length]);
    }
    members.push({ name, img });
    saveMembers();
    $("newName").value = "";
    $("newPhoto").value = "";
    $("newPhoto").parentElement.classList.remove("has-file");
    renderMembers();
  };
  $("resetBtn").onclick = () => {
    members = DEFAULT_MEMBERS.map((m) => ({ ...m }));
    saveMembers();
    renderMembers();
  };

  function bindSeg(id, set) {
    const seg = $(id);
    seg.querySelectorAll("button").forEach((b) => {
      b.onclick = () => {
        seg.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
        set(b.dataset.v);
      };
    });
  }
  bindSeg("modeSeg", (v) => (mode = v));
  bindSeg("lenSeg", (v) => (trackLen = Number(v)));

  $("muteBtn").onclick = () => {
    muted = !muted;
    $("muteBtn").textContent = muted ? "🔇" : "🔊";
    if (master) master.gain.setTargetAtTime(muted ? 0 : 1, actx.currentTime, 0.02);
  };

  // ---------- 사운드 ----------
  // 버스 구조: 효과음(sfxBus) / 음악(musicBus → duckBus) → master → 리미터 → 스피커
  let actx = null, master = null, sfxBus = null, musicBus = null, duckBus = null, noiseBuf = null;
  function audio() {
    if (actx) return actx;
    try {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      const limiter = actx.createDynamicsCompressor(); // 소리가 겹쳐도 찢어지지 않게 하는 안전망
      limiter.threshold.value = -8;
      limiter.ratio.value = 12;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.25;
      limiter.connect(actx.destination);
      master = actx.createGain();
      master.gain.value = muted ? 0 : 1;
      master.connect(limiter);
      sfxBus = actx.createGain();
      sfxBus.gain.value = 0.9;
      sfxBus.connect(master);
      duckBus = actx.createGain(); // 큰 사건 때 음악만 살짝 줄이는 용도 (음악 볼륨과 분리)
      duckBus.connect(master);
      musicBus = actx.createGain();
      musicBus.gain.value = 0.5;
      musicBus.connect(duckBus);
      noiseBuf = actx.createBuffer(1, actx.sampleRate, actx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { actx = null; }
    return actx;
  }

  // delay: 지금부터 몇 초 뒤, vary: 반복음이 기계적으로 안 들리게 음높이를 살짝 흔듦
  function beep(freq, dur = 0.12, type = "square", vol = 0.08, slide = 0, delay = 0, bus = null, vary = true) {
    if (muted || !audio()) return;
    try {
      const t0 = actx.currentTime + delay;
      const f = vary ? freq * (1 + (Math.random() - 0.5) * 0.06) : freq;
      const o = actx.createOscillator();
      const g = actx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, t0);
      if (slide) o.frequency.linearRampToValueAtTime(Math.max(20, f + slide), t0 + dur);
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(bus || sfxBus);
      o.start(t0);
      o.stop(t0 + dur + 0.02);
    } catch (e) { /* 오디오 미지원 */ }
  }

  // 노이즈: 타격감, 휙 소리, 하이햇/스네어
  function noise(dur, vol, freq, delay = 0, bus = null, ftype = "bandpass", sweepTo = 0) {
    if (muted || !audio()) return;
    try {
      const t0 = actx.currentTime + delay;
      const src = actx.createBufferSource();
      src.buffer = noiseBuf;
      const flt = actx.createBiquadFilter();
      flt.type = ftype;
      flt.frequency.setValueAtTime(freq, t0);
      if (sweepTo) flt.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
      const g = actx.createGain();
      g.gain.setValueAtTime(vol * (0.85 + Math.random() * 0.3), t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(flt).connect(g).connect(bus || sfxBus);
      src.start(t0, Math.random() * 0.5);
      src.stop(t0 + dur + 0.02);
    } catch (e) { /* 오디오 미지원 */ }
  }

  function kick(delay, vol = 0.5) {
    if (muted || !audio()) return;
    const t0 = actx.currentTime + delay;
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.frequency.setValueAtTime(150, t0);
    o.frequency.exponentialRampToValueAtTime(40, t0 + 0.12);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
    o.connect(g).connect(musicBus);
    o.start(t0);
    o.stop(t0 + 0.2);
  }

  // 큰 사건이 터지면 음악을 잠깐 낮췄다가 되돌림
  function duck(depth = 0.35, hold = 0.35) {
    if (!duckBus) return;
    const t = actx.currentTime;
    duckBus.gain.cancelScheduledValues(t);
    duckBus.gain.setTargetAtTime(depth, t, 0.02);
    duckBus.gain.setTargetAtTime(1, t + hold, 0.25);
  }

  const sfx = {
    count: () => { beep(523, 0.14, "square", 0.1, 0, 0, null, false); noise(0.05, 0.15, 3000); },
    go: () => {
      [523, 659, 784].forEach((f) => beep(f, 0.5, "sawtooth", 0.06, 0, 0, null, false));
      beep(1046, 0.5, "square", 0.05, 0, 0, null, false);
      noise(0.5, 0.25, 600, 0, null, "bandpass", 5000);
    },
    item: () => [660, 880, 1320].forEach((f, i) => beep(f, 0.08, "square", 0.07, 0, i * 0.05)),
    boost: () => { beep(200, 0.5, "sawtooth", 0.07, 900); noise(0.6, 0.3, 400, 0, null, "bandpass", 4000); },
    hit: () => { beep(220, 0.3, "square", 0.09, -150); noise(0.25, 0.4, 900, 0, null, "lowpass", 120); },
    zap: () => {
      beep(1400, 0.3, "sawtooth", 0.06, -1200);
      noise(0.35, 0.35, 5000, 0, null, "highpass");
      noise(0.5, 0.3, 300, 0.05, null, "lowpass", 60);
    },
    swap: () => { beep(500, 0.18, "triangle", 0.12, 600); beep(1100, 0.22, "triangle", 0.12, -600, 0.16); },
    giant: () => [196, 262, 330, 392, 523].forEach((f, i) => beep(f, 0.12, "square", 0.07, 30, i * 0.06)),
    block: () => { beep(1568, 0.25, "triangle", 0.1); beep(2093, 0.3, "sine", 0.06, 0, 0.03); },
    pass: () => { beep(880, 0.07, "square", 0.05, 0); beep(1175, 0.09, "square", 0.05, 0, 0.06); },
    lead: () => [784, 988, 1175, 1568].forEach((f, i) => beep(f, 0.1, "square", 0.06, 0, i * 0.045)),
    spurt: () => [392, 392, 523].forEach((f, i) => beep(f, i === 2 ? 0.45 : 0.12, "sawtooth", 0.08, 0, i * 0.14, null, false)),
    finish: () => {
      [523, 659, 784, 1046].forEach((f, i) => beep(f, 0.18, "triangle", 0.12, 0, i * 0.11, null, false));
      [523, 659, 784, 1046].forEach((f) => beep(f, 0.9, "sawtooth", 0.035, 0, 0.44, null, false));
      noise(1.2, 0.2, 6000, 0.44, null, "highpass");
    },
  };

  // ---------- 배경음 (상황에 따라 레이어가 쌓이는 음악) ----------
  // layer 0: 킥/스네어/하이햇/베이스, 1: 라스트 스퍼트(16비트 하이햇 + 아르페지오), 2: 접전(크래시 추가)
  const BASS = [110, 87.31, 130.81, 98]; // A F C G
  const CHORDS = [[440, 523, 659], [349, 440, 523], [523, 659, 784], [392, 494, 587]];
  const music = { on: false, step: 0, next: 0, bpm: 138, layer: 0, timer: 0 };
  function startMusic() {
    if (!audio()) return;
    if (actx.resume) actx.resume();
    stopMusic();
    Object.assign(music, { on: true, step: 0, next: actx.currentTime + 0.05, bpm: 138, layer: 0 });
    music.timer = setInterval(scheduleMusic, 25);
  }
  function stopMusic() {
    music.on = false;
    clearInterval(music.timer);
  }
  function scheduleMusic() {
    if (!music.on) return;
    // 프레임 시간이 아니라 오디오 시계 기준으로 미리 예약해야 박자가 밀리지 않음
    while (music.next < actx.currentTime + 0.12) {
      playStep(music.step, music.next - actx.currentTime);
      music.next += 60 / music.bpm / 4;
      music.step = (music.step + 1) % 64;
    }
  }
  function playStep(s, d) {
    if (muted) return;
    const bar = Math.floor(s / 16), i = s % 16, L = music.layer;
    if (i % 4 === 0) kick(d, 0.45);
    if (i === 4 || i === 12) { noise(0.14, 0.22, 1800, d, musicBus); beep(190, 0.08, "triangle", 0.12, -60, d, musicBus, false); }
    if (i % 2 === 1 || L >= 1) noise(0.03, i % 2 ? 0.08 : 0.04, 8000, d, musicBus, "highpass");
    if (i % 2 === 0) beep(BASS[bar] * (i % 4 === 2 ? 2 : 1), 0.12, "triangle", 0.22, 0, d, musicBus, false);
    if (L >= 1) beep(CHORDS[bar][i % 3] * (i >= 8 ? 2 : 1), 0.07, "square", 0.025, 0, d, musicBus, false);
    if (L >= 2 && s % 32 === 0) noise(1.1, 0.12, 7000, d, musicBus, "highpass");
  }

  // ---------- 아이템 ----------
  const ITEMS = {
    boost:  { icon: "🚀", name: "부스터" },
    zap:    { icon: "⚡", name: "번개" },
    banana: { icon: "🍌", name: "바나나" },
    swap:   { icon: "🌀", name: "자리 바꾸기" },
    giant:  { icon: "🍄", name: "거대화" },
    shield: { icon: "🛡️", name: "방패" },
    sleep:  { icon: "💤", name: "졸음" },
  };

  // r: 0 = 선두, 1 = 꼴찌. 뒤처질수록 좋은 아이템 확률 ↑
  function rollItem(r, isLeader) {
    const w = {
      boost: 20 + 22 * r,
      zap: 4 + 18 * r,
      banana: 16,
      swap: isLeader ? 0 : 3 + 15 * r,
      giant: 8 + 6 * r,
      shield: 14,
      sleep: 20 - 16 * r,
    };
    let total = 0;
    for (const k in w) total += w[k];
    let x = Math.random() * total;
    for (const k in w) {
      x -= w[k];
      if (x <= 0) return k;
    }
    return "boost";
  }

  // ---------- 레이스 ----------
  const canvas = $("canvas");
  const ctx = canvas.getContext("2d");
  const ticker = $("ticker");
  const rankBoard = $("rankBoard");

  const BASE_SPEED = 270;
  const LANE_H = 118;
  const SKY_H = 70;

  let W = 0, H = 0, dpr = 1;
  let race = null;
  let rafId = 0;

  function resize() {
    if (!race) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = SKY_H + race.runners.length * LANE_H + 20;
    canvas.style.height = H + "px";
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", resize);

  function laneY(i) { return SKY_H + i * LANE_H + LANE_H / 2; }

  function makeRace() {
    const runners = members.map((m, i) => {
      const img = new Image();
      img.src = m.img;
      return {
        id: i,
        name: m.name,
        src: m.img,
        img,
        color: COLORS[i % COLORS.length],
        lane: i,
        x: 0,
        speed: 0,
        pace: 1,
        paceTarget: 1,
        paceTimer: 0,
        phase: Math.random() * 10,
        boostT: 0, slowT: 0, stunT: 0, giantT: 0,
        squash: 0, // 찌그러짐 연출 세기 (0이면 원래 모양)
        squashT: 1,
        rank: i,
        passCool: 0,
        dustT: 0,
        shield: false,
        finished: false,
        finishTime: 0,
        float: [],
      };
    });

    // 아이템 박스 배치
    const boxes = [];
    for (let x = 700; x < trackLen - 500; x += 550 + Math.random() * 350) {
      runners.forEach((r) => {
        if (Math.random() < 0.65) boxes.push({ x: x + (Math.random() - 0.5) * 160, lane: r.lane, taken: false });
      });
    }

    return {
      runners,
      boxes,
      projectiles: [],
      bolts: [],
      flash: 0,
      t: 0,
      countdown: 3.5,
      lastCount: 4,
      timeScale: 1,
      camX: 0,
      scale: 1,
      order: [],
      done: false,
      endTimer: 0,
      trauma: 0, // 화면 흔들림 누적량 (0~1, 시간이 지나면 저절로 줄어듦)
      shakeT: 0,
      hitStop: 0, // 남은 정지 프레임 시간 (실제 시간 기준)
      parts: [], // 파티클 (트랙 좌표)
      banners: [], // 화면 중앙 큰 글자
      leaderId: -1,
      leadBannerT: -9,
      spurt: false,
      zoom: 1,
    };
  }

  function say(text) {
    const d = document.createElement("div");
    d.textContent = text;
    ticker.appendChild(d);
    while (ticker.children.length > 4) ticker.removeChild(ticker.firstChild);
    setTimeout(() => d.remove(), 3500);
  }

  function floatText(r, text, color = "#fff") {
    r.float.push({ text, color, t: 0, dx: (Math.random() - 0.5) * 30 });
  }

  // ---------- 손맛(juice) ----------
  // 모션 줄이기 설정을 켠 사람은 흔들림을 약하게
  const SHAKE_MUL = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches ? 0.3 : 1;
  const easeOutBack = (k) => { const c1 = 1.70158, c3 = c1 + 1, m = k - 1; return 1 + c3 * m * m * m + c1 * m * m; };

  function addTrauma(a) { race.trauma = Math.min(1, race.trauma + a); }
  // 더 긴 정지가 이미 걸려 있으면 짧은 걸로 덮어쓰지 않음
  function freeze(sec) { race.hitStop = Math.max(race.hitStop, sec); }
  function squash(r, amt) { r.squash = amt; r.squashT = 0; }

  function burst(x, y, n, colors, opt = {}) {
    const sp = opt.speed || 260;
    for (let i = 0; i < n && race.parts.length < 400; i++) {
      const a = opt.dir != null ? opt.dir + (Math.random() - 0.5) * (opt.spread || 1) : Math.random() * Math.PI * 2;
      const v = sp * (0.35 + Math.random() * 0.65);
      race.parts.push({
        x, y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        life: 0, max: (opt.life || 0.6) * (0.6 + Math.random() * 0.6),
        size: (opt.size || 5) * (0.6 + Math.random() * 0.8),
        c: colors[Math.floor(Math.random() * colors.length)],
        g: opt.gravity != null ? opt.gravity : 600,
        kind: opt.kind || "sq",
        rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12,
      });
    }
  }

  function banner(text, color = "#ffcc33", dur = 1.3, size = 54) {
    race.banners = race.banners.filter((b) => b.t > 0.25); // 새 배너가 오면 오래된 것만 남김
    race.banners.push({ text, color, t: 0, dur, size });
  }

  // 사건 중요도별 피드백 묶음: 작음 / 중간 / 큼
  function feedback(r, tier) {
    const x = r.x, y = laneY(r.lane) - 20;
    if (tier === "small") {
      addTrauma(0.12);
      squash(r, 0.25);
      burst(x, y, 6, ["#fff", r.color], { speed: 160, life: 0.4 });
    } else if (tier === "medium") {
      addTrauma(0.38);
      freeze(0.06);
      squash(r, 0.45);
      burst(x, y, 14, ["#ffe14d", "#fff", "#ff8a3d"], { speed: 320, kind: "star", size: 7 });
    } else {
      addTrauma(0.75);
      freeze(0.13);
      squash(r, 0.6);
      burst(x, y, 34, COLORS, { speed: 460, life: 0.9, size: 7 });
      duck(0.3, 0.5);
    }
  }

  // 순위 (완주자는 완주 순, 나머지는 거리 순)
  function standings() {
    const fin = race.order.slice();
    const rest = race.runners.filter((r) => !r.finished).sort((a, b) => b.x - a.x);
    return fin.concat(rest);
  }

  // 공격 적용 (방패/거대화 체크)
  function attack(target, kind, by) {
    if (target.giantT > 0) {
      floatText(target, "무적!", "#ffcc33");
      say(`🍄 ${target.name} 거대화로 ${kind === "zap" ? "번개" : "바나나"} 무시!`);
      squash(target, 0.2);
      return;
    }
    if (target.shield) {
      target.shield = false;
      floatText(target, "방어!", "#3db2ff");
      say(`🛡️ ${target.name} 방패로 막아냄!`);
      sfx.block();
      burst(target.x, laneY(target.lane) - 10, 18, ["#3db2ff", "#bfe6ff", "#fff"], { speed: 300, gravity: 0, life: 0.45 });
      addTrauma(0.15);
      return;
    }
    if (kind === "zap") {
      target.slowT = 1.8;
      floatText(target, "찌릿!", "#ffe14d");
      squash(target, 0.35);
      burst(target.x, laneY(target.lane) - 25, 8, ["#ffe14d", "#fff"], { speed: 220, gravity: 0, life: 0.35, kind: "line" });
    } else if (kind === "banana") {
      target.stunT = 1.1;
      floatText(target, "미끄덩!", "#ffe14d");
      say(`🍌 ${by.name} → ${target.name} 바나나 명중!`);
      feedback(target, "medium");
      sfx.hit();
    }
  }

  function useItem(r, item) {
    const st = standings().filter((x) => !x.finished);
    const idx = st.indexOf(r);
    const ahead = idx > 0 ? st[idx - 1] : null;
    const behind = idx < st.length - 1 ? st[idx + 1] : null;
    const it = ITEMS[item];
    floatText(r, `${it.icon} ${it.name}`);
    sfx.item();
    feedback(r, "small");

    switch (item) {
      case "boost":
        r.boostT = 1.8;
        say(`🚀 ${r.name} 부스터 발동!!`);
        sfx.boost();
        addTrauma(0.2);
        break;
      case "zap":
        say(`⚡ ${r.name} 번개 소환! 다들 느려짐!`);
        race.flash = 0.8;
        sfx.zap();
        addTrauma(0.55);
        freeze(0.08);
        duck(0.35, 0.4);
        race.runners.forEach((o) => {
          if (o !== r && !o.finished) {
            race.bolts.push({ r: o, t: 0 });
            attack(o, "zap", r);
          }
        });
        break;
      case "banana": {
        const target = ahead || behind;
        if (!target) { say(`🍌 ${r.name} 바나나… 던질 사람이 없네`); break; }
        race.projectiles.push({ from: r, to: target, t: 0 });
        break;
      }
      case "swap":
        if (!ahead) { say(`🌀 ${r.name} 자리 바꾸기… 근데 이미 1등!`); break; }
        [r.x, ahead.x] = [ahead.x, r.x];
        floatText(ahead, "엥?!", "#c77dff");
        say(`🌀 ${r.name} ↔ ${ahead.name} 자리 바꿈!! 대역전!`);
        race.flash = 0.6;
        sfx.swap();
        feedback(r, "large");
        squash(ahead, 0.5);
        burst(ahead.x, laneY(ahead.lane) - 20, 16, ["#c77dff", "#fff"], { speed: 300 });
        banner("🌀 대역전!", "#c77dff");
        break;
      case "giant":
        r.giantT = 3;
        say(`🍄 ${r.name} 거대화!!`);
        sfx.giant();
        addTrauma(0.35);
        squash(r, 0.7);
        break;
      case "shield":
        r.shield = true;
        say(`🛡️ ${r.name} 방패 장착`);
        break;
      case "sleep":
        r.stunT = 1.4;
        say(`💤 ${r.name} 졸음… 꽝!`);
        beep(400, 0.5, "sine", 0.1, -250);
        break;
    }
  }

  // 추월, 선두 교체, 라스트 스퍼트 같은 '이야기'를 감지해서 연출
  function trackDrama(slow) {
    const R = race;
    const st = standings();
    st.forEach((r, i) => {
      if (!r.finished && i < r.rank && r.passCool <= 0 && R.t > 1.5) {
        r.passCool = 1.2;
        floatText(r, "추월!", "#5ee07a");
        squash(r, 0.2);
        sfx.pass();
      }
      r.rank = i;
    });
    const lead = st[0];
    if (R.order.length === 0 && lead.id !== R.leaderId) {
      if (R.leaderId !== -1 && R.t > 1.5 && R.t - R.leadBannerT > 2) {
        R.leadBannerT = R.t;
        banner(`👑 ${lead.name} 선두!`, lead.color, 1.1, 40);
        sfx.lead();
        addTrauma(0.15);
      }
      R.leaderId = lead.id;
    }
    if (!R.spurt && lead.x > trackLen * 0.75) {
      R.spurt = true;
      banner("🔥 라스트 스퍼트! 🔥", "#ff5a5f", 1.5);
      sfx.spurt();
      duck(0.4, 0.5);
      music.layer = 1;
      music.bpm = 160;
    }
    if (R.spurt && music.on) music.layer = slow ? 2 : 1;
  }

  // 흔들림·파티클·배너는 슬로모션/정지와 상관없이 실제 시간으로 흐름
  function updateJuice(dt) {
    const R = race;
    R.trauma = Math.max(0, R.trauma - dt * 1.3);
    R.shakeT += dt * 30;
    R.banners.forEach((b) => (b.t += dt));
    R.banners = R.banners.filter((b) => b.t < b.dur);
    R.runners.forEach((r) => (r.squashT += dt));
    R.parts.forEach((p) => {
      p.life += dt;
      p.vy += p.g * dt;
      p.vx *= 1 - Math.min(1, dt * 2);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    });
    R.parts = R.parts.filter((p) => p.life < p.max);
    // 라스트 스퍼트/접전일 때 살짝 줌인
    const zt = R.timeScale < 0.7 ? 1.08 : R.spurt && !R.done ? 1.03 : 1;
    R.zoom += (zt - R.zoom) * Math.min(1, dt * 3);
  }

  function update(dt) {
    const R = race;
    updateJuice(dt);
    if (R.countdown > 0) {
      R.countdown -= dt;
      const c = Math.ceil(R.countdown);
      if (c !== R.lastCount && c > 0 && c <= 3) {
        R.lastCount = c;
        sfx.count();
        addTrauma(0.12);
        R.runners.forEach((r) => squash(r, 0.15));
      }
      if (R.countdown <= 0) {
        sfx.go();
        say("🏁 출발!!");
        addTrauma(0.4);
        R.runners.forEach((r) => {
          squash(r, 0.5);
          burst(r.x - 10, laneY(r.lane) + 24, 10, ["#e8d3b0", "#fff"], { dir: Math.PI, spread: 1.2, speed: 220, gravity: 200 });
        });
        startMusic();
      }
      return;
    }

    // 정지 프레임: 실제 시간은 흐르지만 게임은 거의 멈춤
    if (R.hitStop > 0) {
      R.hitStop -= dt;
      dt *= 0.05;
    }

    // 결정적인 순간 슬로모션
    const st = standings();
    const running = st.filter((r) => !r.finished);
    let slow = false;
    if (mode === "first" && R.order.length === 0 && running.length >= 2) {
      const [a, b] = running;
      slow = trackLen - a.x < 380 && a.x - b.x < 160;
    } else if (mode === "last" && running.length === 2) {
      const [a, b] = running;
      slow = trackLen - a.x < 380 && a.x - b.x < 160;
    }
    R.timeScale += ((slow ? 0.3 : 1) - R.timeScale) * Math.min(1, dt * 6);
    dt *= R.timeScale;
    R.t += dt;

    const n = running.length;
    running.forEach((r, i) => {
      // 컨디션 랜덤 변화
      r.paceTimer -= dt;
      if (r.paceTimer <= 0) {
        r.paceTarget = 0.82 + Math.random() * 0.36;
        r.paceTimer = 0.4 + Math.random() * 0.7;
      }
      r.pace += (r.paceTarget - r.pace) * Math.min(1, dt * 3);

      const behindFrac = n > 1 ? i / (n - 1) : 0; // 뒤처질수록 살짝 보정
      let mult = r.pace * (1 + 0.1 * behindFrac);
      if (R.order.length > 0) mult *= 1.35; // 누가 들어오면 나머지 가속
      if (r.boostT > 0) mult *= 1.9;
      if (r.giantT > 0) mult *= 1.3;
      if (r.slowT > 0) mult *= 0.45;
      if (r.stunT > 0) mult = 0;

      r.boostT -= dt; r.giantT -= dt; r.slowT -= dt; r.stunT -= dt;
      r.speed = BASE_SPEED * mult;
      const prevX = r.x;
      r.x += r.speed * dt;
      r.phase += dt * (r.speed / 22);
      r.passCool -= dt;

      // 발밑 먼지 / 부스터 불똥
      r.dustT -= dt;
      if (r.dustT <= 0 && r.speed > 40) {
        r.dustT = r.boostT > 0 ? 0.03 : 0.12;
        const fy = laneY(r.lane) + 22;
        if (r.boostT > 0) burst(r.x - 18, fy - 18, 2, ["#ff5a28", "#ffbe28", "#fff6c8"], { dir: Math.PI, spread: 0.6, speed: 260, gravity: -150, life: 0.35, size: 6 });
        else burst(r.x - 8, fy, 1, ["rgba(240,220,190,0.8)"], { dir: Math.PI + 0.3, spread: 0.6, speed: 90, gravity: -40, life: 0.45, size: 6, kind: "dust" });
      }

      // 아이템 박스 획득
      for (const b of R.boxes) {
        if (!b.taken && b.lane === r.lane && prevX < b.x && r.x >= b.x) {
          b.taken = true;
          burst(b.x, laneY(b.lane), 14, ["#ff5a5f", "#3db2ff", "#ffcc33", "#5ee07a", "#fff"], { speed: 300, life: 0.5 });
          const rank = standings().filter((x) => !x.finished).indexOf(r);
          const frac = n > 1 ? rank / (n - 1) : 0;
          useItem(r, rollItem(frac, rank === 0));
        }
      }

      if (r.x >= trackLen && !r.finished) {
        r.finished = true;
        r.finishTime = R.t;
        R.order.push(r);
        if (R.order.length === 1) {
          say(`🏆 ${r.name} 1등으로 골인!!`);
          sfx.finish();
          feedback(r, "large");
          burst(trackLen, SKY_H, 50, COLORS, { dir: Math.PI / 2, spread: 2.5, speed: 500, life: 1.4, size: 8 });
          banner(mode === "first" ? `🏆 ${r.name} 골인!` : `🏁 ${r.name} 1등 골인`, "#ffcc33", 1.6);
        } else {
          say(`🏁 ${r.name} ${R.order.length}등 골인`);
          beep(660, 0.15, "triangle");
        }
      }
    });

    // 완주자는 계속 천천히 앞으로
    R.runners.forEach((r) => {
      if (r.finished) { r.speed *= 0.96; r.x += r.speed * dt; r.phase += dt * (r.speed / 22); }
      r.float.forEach((f) => (f.t += dt));
      r.float = r.float.filter((f) => f.t < 1.3);
    });

    // 바나나 투척
    R.projectiles.forEach((p) => {
      p.t += dt / 0.45;
      if (p.t >= 1 && !p.hit) { p.hit = true; attack(p.to, "banana", p.from); }
    });
    R.projectiles = R.projectiles.filter((p) => !p.hit);
    R.bolts.forEach((b) => (b.t += dt));
    R.bolts = R.bolts.filter((b) => b.t < 0.4);

    R.flash = Math.max(0, R.flash - dt * 3);
    trackDrama(slow);

    // 당첨자가 확정되면 종료
    const decided = mode === "first" ? R.order.length >= 1 : R.order.length >= R.runners.length - 1;
    if (decided && !R.done) {
      if (mode === "last" && R.order.length === R.runners.length - 1) {
        const loser = R.runners.find((r) => !r.finished);
        loser.finished = true;
        R.order.push(loser);
      }
      R.endTimer += dt;
      if (R.endTimer > 1.6) {
        // 남은 사람은 현재 거리 순으로 순위 확정
        standings().forEach((r) => { if (!R.order.includes(r)) R.order.push(r); });
        R.done = true;
        stopMusic();
        showResult();
      }
    }
  }

  // ---------- 그리기 ----------
  function sx(x) { return (x - race.camX) * race.scale + W / 2; }

  function updateCamera(dt) {
    const R = race;
    const xs = R.runners.map((r) => r.x);
    const min = Math.min(...xs), max = Math.max(...xs);
    const spread = max - min + 360;
    const targetScale = Math.min(1, Math.max(0.25, (W - 80) / spread));
    const targetCam = (min + max) / 2 + 60;
    const k = Math.min(1, dt * 4);
    R.scale += (targetScale - R.scale) * k;
    R.camX += (targetCam - R.camX) * k;
  }

  function drawBackground() {
    const R = race;
    // 하늘 + 관중
    const g = ctx.createLinearGradient(0, 0, 0, SKY_H);
    g.addColorStop(0, "#6ec6ff");
    g.addColorStop(1, "#b9e4ff");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, SKY_H);

    const crowdOff = (R.camX * 0.35) % 24;
    ctx.fillStyle = "#4a4f6a";
    ctx.fillRect(0, SKY_H - 34, W, 34);
    for (let x = -24 - crowdOff; x < W + 24; x += 12) {
      const seed = Math.floor((x + R.camX * 0.35) / 12);
      const hue = (seed * 67) % 360;
      const bob = Math.sin(R.t * 8 + seed) * 2;
      ctx.fillStyle = `hsl(${hue},70%,60%)`;
      ctx.beginPath();
      ctx.arc(x, SKY_H - 22 + (seed % 2) * 8 + bob, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 트랙
    const n = R.runners.length;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i % 2 ? "#c4553f" : "#cf5f47";
      ctx.fillRect(0, SKY_H + i * LANE_H, W, LANE_H);
    }
    ctx.fillStyle = "#3a8f3e";
    ctx.fillRect(0, SKY_H + n * LANE_H, W, H);
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 2;
    for (let i = 0; i <= n; i++) {
      ctx.beginPath();
      ctx.moveTo(0, SKY_H + i * LANE_H);
      ctx.lineTo(W, SKY_H + i * LANE_H);
      ctx.stroke();
    }

    // 속도감 줄무늬
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 3;
    const step = 140;
    const left = R.camX - W / 2 / R.scale;
    const right = R.camX + W / 2 / R.scale;
    for (let x = Math.floor(left / step) * step; x < right; x += step) {
      for (let i = 0; i < n; i++) {
        const y = SKY_H + i * LANE_H + 14 + ((x / step) % 3) * 22;
        ctx.beginPath();
        ctx.moveTo(sx(x), y);
        ctx.lineTo(sx(x + 50), y);
        ctx.stroke();
      }
    }

    // 거리 표시
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    for (let x = Math.ceil(left / 500) * 500; x < right; x += 500) {
      if (x <= 0 || x >= trackLen) continue;
      const px = sx(x);
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(px - 1, SKY_H, 2, n * LANE_H);
      ctx.fillStyle = "#fff";
      ctx.fillText(`${Math.round((trackLen - x) / 10)}m`, px, SKY_H + n * LANE_H + 15);
    }

    // 출발선
    const s0 = sx(0);
    if (s0 > -10 && s0 < W + 10) {
      ctx.fillStyle = "#fff";
      ctx.fillRect(s0 - 3, SKY_H, 6, n * LANE_H);
    }
    // 결승선 (체크무늬)
    const f = sx(trackLen);
    if (f > -30 && f < W + 30) {
      const sz = 10;
      for (let y = 0; y < n * LANE_H; y += sz) {
        for (let c = 0; c < 2; c++) {
          ctx.fillStyle = ((y / sz + c) % 2) ? "#111" : "#fff";
          ctx.fillRect(f + c * sz - sz, SKY_H + y, sz, sz);
        }
      }
      ctx.fillStyle = "#ffcc33";
      ctx.font = "bold 16px sans-serif";
      ctx.fillText("FINISH", f, SKY_H - 40);
      ctx.fillStyle = "#222";
      ctx.fillRect(f - 2, SKY_H - 36, 4, 36);
    }
  }

  function drawBoxes() {
    const R = race;
    for (const b of R.boxes) {
      if (b.taken) continue;
      const x = sx(b.x);
      if (x < -30 || x > W + 30) continue;
      const y = laneY(b.lane) + Math.sin(R.t * 4 + b.x) * 4;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.sin(R.t * 3 + b.x) * 0.25);
      const hue = (R.t * 120 + b.x) % 360;
      ctx.fillStyle = `hsla(${hue},90%,60%,0.9)`;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 3;
      roundRect(-15, -15, 30, 30, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 20px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("?", 0, 1);
      ctx.restore();
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawRunner(r) {
    const R = race;
    const x = sx(r.x);
    if (x < -80 || x > W + 80) return;
    const scale = r.giantT > 0 ? 1.35 : 1;
    const running = R.countdown <= 0 && r.speed > 5;
    const bob = running ? Math.abs(Math.sin(r.phase)) * -6 : 0;
    const y = laneY(r.lane) - 2;

    // 찌그러졌다가 튕기며 원래대로 (부피는 유지: 가로↑ 세로↓)
    let sqx = 1, sqy = 1;
    const sk = r.squashT / 0.4;
    if (sk < 1 && r.squash) {
      const a = r.squash * (1 - sk) * Math.cos(sk * Math.PI * 3);
      sqx = 1 + a * 0.6;
      sqy = 1 - a * 0.6;
    }

    // 부스터 속도선
    if (r.boostT > 0 || r.giantT > 0) {
      ctx.strokeStyle = r.boostT > 0 ? "rgba(255,255,255,0.55)" : "rgba(255,204,51,0.45)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const ly = y - 40 + ((i * 23 + R.t * 400) % 80);
        const lx = x - 40 - ((i * 37 + R.t * 900) % 120);
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx - 40 - i * 6, ly);
        ctx.stroke();
      }
    }

    ctx.save();
    ctx.translate(x, y + 26);
    ctx.scale(scale * sqx, scale * sqy);
    ctx.translate(0, -26);

    // 그림자
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(0, 26, 22, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // 부스터 불꽃
    if (r.boostT > 0) {
      for (let i = 0; i < 3; i++) {
        const len = 30 + Math.random() * 25;
        ctx.fillStyle = i === 0 ? "rgba(255,90,40,0.8)" : i === 1 ? "rgba(255,190,40,0.8)" : "rgba(255,255,200,0.9)";
        ctx.beginPath();
        ctx.moveTo(-14, bob - 4 - i * 2);
        ctx.lineTo(-14 - len * (1 - i * 0.3), bob + 4);
        ctx.lineTo(-14, bob + 12 + i * 2);
        ctx.fill();
      }
    }

    // 다리
    const legSwing = running ? Math.sin(r.phase) * 12 : 0;
    ctx.strokeStyle = "#2b2b3a";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-3, 12 + bob);
    ctx.lineTo(-3 + legSwing, 26);
    ctx.moveTo(3, 12 + bob);
    ctx.lineTo(3 - legSwing, 26);
    ctx.stroke();

    // 몸통
    ctx.fillStyle = r.color;
    roundRect(-11, -6 + bob, 22, 22, 7);
    ctx.fill();
    // 팔
    ctx.strokeStyle = r.color;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-8, 0 + bob);
    ctx.lineTo(-8 - legSwing * 0.8, 10 + bob);
    ctx.moveTo(8, 0 + bob);
    ctx.lineTo(8 + legSwing * 0.8, 10 + bob);
    ctx.stroke();

    // 얼굴
    const hy = -30 + bob;
    const tilt = r.stunT > 0 ? Math.sin(R.t * 20) * 0.3 : running ? Math.sin(r.phase) * 0.08 : 0;
    ctx.save();
    ctx.translate(0, hy);
    ctx.rotate(tilt);
    ctx.beginPath();
    ctx.arc(0, 0, 27, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.save();
    ctx.clip();
    if (r.img.complete && r.img.naturalWidth) ctx.drawImage(r.img, -27, -27, 54, 54);
    ctx.restore();
    ctx.lineWidth = 4;
    ctx.strokeStyle = r.color;
    ctx.stroke();
    ctx.restore();

    // 상태 이펙트
    if (r.shield) {
      ctx.strokeStyle = "rgba(61,178,255,0.8)";
      ctx.fillStyle = "rgba(61,178,255,0.15)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, -10 + bob, 46, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    if (r.slowT > 0) {
      ctx.strokeStyle = "#ffe14d";
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const a = R.t * 10 + i * 2.1;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 30, hy + Math.sin(a) * 30);
        ctx.lineTo(Math.cos(a) * 38, hy + Math.sin(a) * 38 + 6);
        ctx.stroke();
      }
    }
    if (r.stunT > 0) {
      ctx.font = "16px sans-serif";
      ctx.textAlign = "center";
      for (let i = 0; i < 3; i++) {
        const a = R.t * 6 + i * 2.1;
        ctx.fillText("⭐", Math.cos(a) * 24, hy - 32 + Math.sin(a) * 6);
      }
    }
    ctx.restore();

    // 이름표
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    const label = r.name;
    const tw = ctx.measureText(label).width + 10;
    const ly = y + 30 * scale + 12;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    roundRect(x - tw / 2, ly - 11, tw, 15, 6);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillText(label, x, ly);

    // 떠오르는 텍스트
    r.float.forEach((f, i) => {
      const a = 1 - Math.max(0, f.t - 0.8) / 0.5;
      const pop = easeOutBack(Math.min(1, f.t / 0.22));
      ctx.globalAlpha = Math.max(0, a);
      const fy = Math.max(16 + i * 20, y - 70 * scale - (1 - Math.pow(1 - Math.min(1, f.t / 1.3), 3)) * 40 - i * 20);
      ctx.save();
      ctx.translate(x + f.dx * Math.min(1, f.t), fy);
      ctx.scale(pop, pop);
      ctx.font = "900 18px sans-serif";
      ctx.lineWidth = 5;
      ctx.lineJoin = "round";
      ctx.strokeStyle = "rgba(0,0,0,0.75)";
      ctx.strokeText(f.text, 0, 0);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, 0, 0);
      ctx.restore();
      ctx.globalAlpha = 1;
    });
  }

  function drawEffects() {
    const R = race;
    // 바나나 투척
    R.projectiles.forEach((p) => {
      const t = Math.min(1, p.t);
      const x0 = sx(p.from.x), y0 = laneY(p.from.lane) - 30;
      const x1 = sx(p.to.x), y1 = laneY(p.to.lane);
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t - Math.sin(t * Math.PI) * 70;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t * 12);
      ctx.font = "26px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🍌", 0, 0);
      ctx.restore();
    });
    // 번개
    R.bolts.forEach((b) => {
      const x = sx(b.r.x);
      const yTop = 0;
      const yBot = laneY(b.r.lane) - 20;
      ctx.strokeStyle = `rgba(255,240,120,${1 - b.t / 0.4})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x, yTop);
      let yy = yTop;
      while (yy < yBot) {
        yy += 14;
        ctx.lineTo(x + (Math.random() - 0.5) * 22, Math.min(yy, yBot));
      }
      ctx.stroke();
    });
    if (R.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${R.flash * 0.5})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawParticles(back) {
    for (const p of race.parts) {
      if ((p.kind === "dust") !== back) continue; // 먼지는 사람 뒤, 나머지는 앞
      const k = p.life / p.max;
      const x = sx(p.x);
      if (x < -20 || x > W + 20) continue;
      ctx.globalAlpha = Math.max(0, 1 - k);
      ctx.fillStyle = p.c;
      if (p.kind === "dust") {
        ctx.beginPath();
        ctx.arc(x, p.y, p.size * (0.6 + k * 1.4), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === "line") {
        ctx.strokeStyle = p.c;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, p.y);
        ctx.lineTo(x - p.vx * 0.05, p.y - p.vy * 0.05);
        ctx.stroke();
      } else if (p.kind === "star") {
        ctx.save();
        ctx.translate(x, p.y);
        ctx.rotate(p.rot);
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const rr = i % 2 ? p.size * 0.45 : p.size;
          ctx.lineTo(Math.cos((i * Math.PI) / 5) * rr, Math.sin((i * Math.PI) / 5) * rr);
        }
        ctx.fill();
        ctx.restore();
      } else {
        ctx.save();
        ctx.translate(x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }

  // 접전 슬로모션 때 가장자리가 붉게 맥박침
  function drawVignette() {
    const R = race;
    const k = Math.max(0, (1 - R.timeScale) / 0.7);
    if (k < 0.05) return;
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 160);
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, "rgba(255,40,60,0)");
    g.addColorStop(1, `rgba(255,40,60,${(0.25 + 0.2 * pulse) * k})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function bigText(text, x, y, size, color, sc = 1, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.translate(x, y);
    ctx.scale(sc, sc);
    ctx.font = `900 ${size}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = size / 7;
    ctx.strokeStyle = "#000";
    ctx.strokeText(text, 0, 0);
    ctx.fillStyle = color;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  function drawOverlayText() {
    const R = race;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (R.countdown > 0) {
      const c = Math.ceil(R.countdown);
      const age = 1 - (R.countdown - Math.floor(R.countdown)); // 이 숫자가 뜬 뒤 흐른 시간
      const text = c > 3 ? "준비~" : String(c);
      const col = c === 1 ? "#ff5a5f" : c === 2 ? "#ff8a3d" : "#ffcc33";
      bigText(text, W / 2, H / 2, c > 3 ? 64 : 110, col, easeOutBack(Math.min(1, age / 0.3)), 1 - Math.max(0, age - 0.75) / 0.25);
    } else if (R.t < 0.9) {
      bigText("GO!", W / 2, H / 2, 120, "#5ee07a", 1 + R.t * 0.8, 1 - R.t / 0.9);
    }
    // 큰 배너: 튀어나왔다가 사라짐
    R.banners.forEach((b) => {
      const sc = easeOutBack(Math.min(1, b.t / 0.25));
      const a = 1 - Math.max(0, b.t - (b.dur - 0.3)) / 0.3;
      bigText(b.text, W / 2, Math.min(H * 0.38, SKY_H + 90), Math.min(b.size, W / (b.text.length * 0.75)), b.color, sc, a);
    });
    if (R.timeScale < 0.7) {
      ctx.font = "900 28px sans-serif";
      ctx.fillStyle = `rgba(255,90,95,${0.6 + Math.sin(performance.now() / 120) * 0.4})`;
      ctx.fillText("🔥 접전!! 🔥", W / 2, 22);
    }
    // 남은 거리 (선두 기준)
    const lead = Math.max(...R.runners.map((r) => r.x));
    const left = Math.max(0, Math.round((trackLen - lead) / 10));
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "right";
    ctx.fillStyle = "#13233a";
    ctx.fillText(left > 0 ? `결승까지 ${left}m` : "골인!", W - 12, 16);
  }

  let lastBoard = "";
  function updateBoard() {
    const st = standings();
    const key = st.map((r) => r.id).join(",");
    if (key === lastBoard) return;
    lastBoard = key;
    rankBoard.innerHTML = "";
    st.forEach((r, i) => {
      const li = document.createElement("li");
      li.style.borderColor = r.color;
      li.innerHTML = `<img alt="" /><span class="no">${i + 1}</span><span></span>`;
      li.querySelector("img").src = r.src;
      li.lastChild.textContent = r.name;
      rankBoard.appendChild(li);
    });
  }

  let lastTs = 0;
  function frame(ts) {
    const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0);
    lastTs = ts;
    if (!race) return;
    update(dt);
    updateCamera(dt);

    ctx.save();
    // 흔들림 = trauma² (작은 사건은 살짝, 큰 사건은 확), 매 프레임 랜덤이 아닌 사인파로 부드럽게
    const R = race;
    const sh = R.trauma * R.trauma * SHAKE_MUL;
    if (R.zoom !== 1) {
      ctx.translate(W / 2, H / 2);
      ctx.scale(R.zoom, R.zoom);
      ctx.translate(-W / 2, -H / 2);
    }
    if (sh > 0) {
      ctx.translate(W / 2, H / 2);
      ctx.rotate(0.03 * sh * Math.sin(R.shakeT * 1.1));
      ctx.translate(-W / 2 + 16 * sh * (0.6 * Math.sin(R.shakeT * 1.7) + 0.4 * Math.sin(R.shakeT * 3.9)), -H / 2 + 10 * sh * (0.6 * Math.sin(R.shakeT * 2.3) + 0.4 * Math.sin(R.shakeT * 4.7)));
    }
    drawBackground();
    drawBoxes();
    drawParticles(true);
    race.runners.slice().sort((a, b) => a.lane - b.lane).forEach(drawRunner);
    drawEffects();
    drawParticles(false);
    ctx.restore();
    drawVignette();
    drawOverlayText();
    updateBoard();

    if (!race.done) rafId = requestAnimationFrame(frame);
  }

  function startRace() {
    if (members.length < 2) return;
    cancelAnimationFrame(rafId);
    $("setup").classList.add("hidden");
    $("result").classList.add("hidden");
    $("race").classList.remove("hidden");
    ticker.innerHTML = "";
    lastBoard = "";
    stopConfetti();
    stopMusic();
    audio(); // 버튼 클릭(사용자 동작) 안에서 오디오를 깨워둬야 브라우저가 소리를 막지 않음
    if (actx && actx.resume) actx.resume();
    race = makeRace();
    resize();
    lastTs = performance.now();
    rafId = requestAnimationFrame(frame);
  }

  // ---------- 결과 ----------
  function showResult() {
    const order = race.order;
    const picked = mode === "first" ? order[0] : order[order.length - 1];
    $("resultLabel").textContent = mode === "first" ? "🥇 1등 당첨!" : "🐢 꼴등 당첨!";
    $("resultFace").src = picked.src;
    $("resultFace").style.borderColor = picked.color;
    $("resultName").textContent = picked.name;
    const ol = $("resultRank");
    ol.innerHTML = "";
    order.forEach((r) => {
      const li = document.createElement("li");
      li.textContent = r.name;
      if (r === picked) li.style.color = "#ffcc33";
      ol.appendChild(li);
    });
    // 두구두구… 하고 공개
    for (let i = 0; i < 16; i++) noise(0.06, 0.12 + i * 0.012, 1500, i * 0.055);
    kick(0.9, 0.7);
    setTimeout(() => {
      $("result").classList.remove("hidden");
      sfx.finish();
      startConfetti();
    }, 900);
  }

  $("startBtn").onclick = startRace;
  $("againBtn").onclick = startRace;
  $("backBtn").onclick = () => {
    stopConfetti();
    stopMusic();
    race = null;
    $("result").classList.add("hidden");
    $("race").classList.add("hidden");
    $("setup").classList.remove("hidden");
  };

  // ---------- 꽃가루 ----------
  const cf = $("confetti");
  const cctx = cf.getContext("2d");
  let pieces = [];
  let cfRaf = 0;
  function startConfetti() {
    cf.width = innerWidth;
    cf.height = innerHeight;
    pieces = Array.from({ length: 160 }, () => ({
      x: Math.random() * cf.width,
      y: -20 - Math.random() * cf.height,
      vx: (Math.random() - 0.5) * 2,
      vy: 2 + Math.random() * 3,
      rot: Math.random() * 6,
      vr: (Math.random() - 0.5) * 0.3,
      c: COLORS[Math.floor(Math.random() * COLORS.length)],
    }));
    cancelAnimationFrame(cfRaf);
    let last = performance.now();
    const tick = (ts = last) => {
      const k = Math.min(3, (ts - last) / (1000 / 60)); // 60fps 기준 배율 (주사율과 무관하게 같은 속도)
      last = ts;
      cctx.clearRect(0, 0, cf.width, cf.height);
      pieces.forEach((p) => {
        p.x += p.vx * k; p.y += p.vy * k; p.rot += p.vr * k;
        if (p.y > cf.height + 20) { p.y = -20; p.x = Math.random() * cf.width; }
        cctx.save();
        cctx.translate(p.x, p.y);
        cctx.rotate(p.rot);
        cctx.fillStyle = p.c;
        cctx.fillRect(-5, -3, 10, 6);
        cctx.restore();
      });
      cfRaf = requestAnimationFrame(tick);
    };
    tick();
  }
  function stopConfetti() {
    cancelAnimationFrame(cfRaf);
    cctx.clearRect(0, 0, cf.width, cf.height);
  }

  renderMembers();
})();
