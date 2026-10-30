(() => {
  "use strict";

  // ---------- 멤버 관리 ----------
  const DEFAULT_MEMBERS = [
    { name: "김보석", img: "assets/boseok.png" },
    { name: "백민우", img: "assets/minwoo.png" },
    { name: "장윤성", img: "assets/yunseong.png" },
    { name: "장준혁", img: "assets/junhyuk.png" },
    { name: "이정웅", img: "assets/jeongwoong.png" },
  ];
  const COLORS = ["#ff5a5f", "#3db2ff", "#ffcc33", "#5ee07a", "#c77dff", "#ff8a3d", "#2ee6d6", "#ff7ac6"];
  const STORE_KEY = "rolling.members.v2";

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
  };

  // ---------- 사운드 ----------
  let actx = null;
  function beep(freq, dur = 0.12, type = "square", vol = 0.08, slide = 0) {
    if (muted) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator();
      const g = actx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, actx.currentTime);
      if (slide) o.frequency.linearRampToValueAtTime(freq + slide, actx.currentTime + dur);
      g.gain.setValueAtTime(vol, actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
      o.connect(g).connect(actx.destination);
      o.start();
      o.stop(actx.currentTime + dur);
    } catch (e) { /* 오디오 미지원 */ }
  }
  const sfx = {
    count: () => beep(440, 0.15),
    go: () => beep(880, 0.35),
    item: () => { beep(660, 0.08); setTimeout(() => beep(990, 0.1), 70); },
    boost: () => beep(300, 0.4, "sawtooth", 0.06, 600),
    hit: () => beep(220, 0.3, "square", 0.08, -150),
    zap: () => beep(1200, 0.25, "sawtooth", 0.05, -1000),
    swap: () => beep(500, 0.3, "triangle", 0.1, 500),
    finish: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.18, "triangle", 0.1), i * 110)),
  };

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
      shake: 0,
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
    r.float.push({ text, color, t: 0 });
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
      return;
    }
    if (target.shield) {
      target.shield = false;
      floatText(target, "방어!", "#3db2ff");
      say(`🛡️ ${target.name} 방패로 막아냄!`);
      return;
    }
    if (kind === "zap") {
      target.slowT = 1.8;
      floatText(target, "찌릿!", "#ffe14d");
    } else if (kind === "banana") {
      target.stunT = 1.1;
      floatText(target, "미끄덩!", "#ffe14d");
      say(`🍌 ${by.name} → ${target.name} 바나나 명중!`);
    }
    race.shake = Math.max(race.shake, 6);
    sfx.hit();
  }

  function useItem(r, item) {
    const st = standings().filter((x) => !x.finished);
    const idx = st.indexOf(r);
    const ahead = idx > 0 ? st[idx - 1] : null;
    const behind = idx < st.length - 1 ? st[idx + 1] : null;
    const it = ITEMS[item];
    floatText(r, `${it.icon} ${it.name}`);
    sfx.item();

    switch (item) {
      case "boost":
        r.boostT = 1.8;
        say(`🚀 ${r.name} 부스터 발동!!`);
        sfx.boost();
        break;
      case "zap":
        say(`⚡ ${r.name} 번개 소환! 다들 느려짐!`);
        race.flash = 1;
        sfx.zap();
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
        race.shake = 10;
        sfx.swap();
        break;
      case "giant":
        r.giantT = 3;
        say(`🍄 ${r.name} 거대화!!`);
        sfx.boost();
        break;
      case "shield":
        r.shield = true;
        say(`🛡️ ${r.name} 방패 장착`);
        break;
      case "sleep":
        r.stunT = 1.4;
        say(`💤 ${r.name} 졸음… 꽝!`);
        sfx.hit();
        break;
    }
  }

  function update(dt) {
    const R = race;
    if (R.countdown > 0) {
      R.countdown -= dt;
      const c = Math.ceil(R.countdown);
      if (c !== R.lastCount && c > 0 && c <= 3) { R.lastCount = c; sfx.count(); }
      if (R.countdown <= 0) { sfx.go(); say("🏁 출발!!"); }
      return;
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

      // 아이템 박스 획득
      for (const b of R.boxes) {
        if (!b.taken && b.lane === r.lane && prevX < b.x && r.x >= b.x) {
          b.taken = true;
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
    R.shake = Math.max(0, R.shake - dt * 30);

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

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

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
      const a = 1 - f.t / 1.3;
      ctx.globalAlpha = Math.max(0, a);
      ctx.font = "bold 16px sans-serif";
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      const fy = y - 70 * scale - f.t * 30 - i * 18;
      ctx.strokeText(f.text, x, fy);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, x, fy);
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

  function drawOverlayText() {
    const R = race;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (R.countdown > 0) {
      const c = Math.ceil(R.countdown);
      const frac = R.countdown - Math.floor(R.countdown);
      const text = c > 3 ? "준비~" : String(c);
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.scale(1 + frac * 0.5, 1 + frac * 0.5);
      ctx.font = "900 80px sans-serif";
      ctx.lineWidth = 8;
      ctx.strokeStyle = "#000";
      ctx.strokeText(text, 0, 0);
      ctx.fillStyle = "#ffcc33";
      ctx.fillText(text, 0, 0);
      ctx.restore();
    } else if (R.t < 0.8) {
      ctx.font = "900 80px sans-serif";
      ctx.globalAlpha = 1 - R.t / 0.8;
      ctx.lineWidth = 8;
      ctx.strokeStyle = "#000";
      ctx.strokeText("GO!", W / 2, H / 2);
      ctx.fillStyle = "#5ee07a";
      ctx.fillText("GO!", W / 2, H / 2);
      ctx.globalAlpha = 1;
    }
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
    if (race.shake > 0) ctx.translate((Math.random() - 0.5) * race.shake, (Math.random() - 0.5) * race.shake);
    drawBackground();
    drawBoxes();
    race.runners.slice().sort((a, b) => a.lane - b.lane).forEach(drawRunner);
    drawEffects();
    ctx.restore();
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
    setTimeout(() => {
      $("result").classList.remove("hidden");
      sfx.finish();
      startConfetti();
    }, 300);
  }

  $("startBtn").onclick = startRace;
  $("againBtn").onclick = startRace;
  $("backBtn").onclick = () => {
    stopConfetti();
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
    const tick = () => {
      cctx.clearRect(0, 0, cf.width, cf.height);
      pieces.forEach((p) => {
        p.x += p.vx; p.y += p.vy; p.rot += p.vr;
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
