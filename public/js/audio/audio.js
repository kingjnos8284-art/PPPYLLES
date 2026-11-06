// @ts-check
/**
 * 音樂與音效。
 *
 * 聲音來源的優先順序：
 *   1. /assets/manifest.json 的 audio 區塊有指定檔案 → 播放檔案
 *   2. 沒有檔案 → 用 Web Audio 即時合成（音樂是隨機演奏的音樂盒旋律＋水聲，音效是合成的短音）
 * 所以之後拿到正式的音樂／音效檔，只要放進 assets/audio/ 並寫進 manifest，不用改程式。
 *
 * 手機瀏覽器規定「使用者點過畫面」之後才能發出聲音，所以第一次點擊時才真正啟動。
 * iOS 特別注意：
 *   - 只有「手指放開」（touchend／click）才算允許播放，按下（pointerdown／touchstart）不算
 *   - 從背景切回來、接電話後，聲音常被卡在暫停狀態，所以每次點擊都檢查並喚醒
 *   - 預設會被側邊的靜音鍵靜音；iOS 17 起可以宣告成「播放媒體」，不受靜音鍵影響
 * 音量設定存在這台裝置（不跟著遊戲存檔），重新開始遊戲也不會被清掉。
 */

/** @typedef {'tap'|'open'|'close'|'buy'|'fail'|'newFish'|'select'|'grow'|'release'|'cat'|'dog'|'heart'|'offline'|'unlock'} SfxName */

const SETTINGS_KEY = 'pppylles.audio';

/** @type {AudioContext|null} */
let ctx = null;
/** @type {GainNode} */ let master;
/** @type {GainNode} */ let musicBus;
/** @type {GainNode} */ let sfxBus;
/** @type {ConvolverNode} */ let reverb;
/** @type {GainNode} */ let reverbSend;
let unlocked = false;
let theme = 'forest';

/** @type {{ music: Record<string, string|null>, sfx: Record<string, string|null> }} */
let files = { music: {}, sfx: {} };
/** @type {Map<string, AudioBuffer>} */
const sfxBuffers = new Map();

const settings = loadSettings();

function loadSettings() {
  const def = { music: 0.5, sfx: 0.7 };
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null');
    if (raw && typeof raw.music === 'number' && typeof raw.sfx === 'number') return { music: raw.music, sfx: raw.sfx };
  } catch { /* 讀不到就用預設 */ }
  return def;
}

function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* 無痕模式等情況存不了，不影響遊戲 */ }
}

/** 音量曲線：滑桿 0～1 → 實際增益（人耳對音量是對數感受） */
const curve = (/** @type {number} */ v) => v * v;

// ───────────────────────────── 啟動 ─────────────────────────────

/**
 * 讀取 manifest 的 audio 區塊，並在第一次點擊時啟動聲音
 * @param {string} themeId
 */
export async function initAudio(themeId) {
  theme = themeId;
  try {
    const res = await fetch('/assets/manifest.json', { cache: 'no-cache' });
    const m = res.ok ? await res.json() : {};
    files = { music: m.audio?.music ?? {}, sfx: m.audio?.sfx ?? {} };
  } catch { /* 沒有 manifest 就全部用合成聲音 */ }

  // 每次點擊都確認聲音在播放中（第一次就啟動；之後被系統暫停了就喚醒）
  const wake = () => {
    if (!unlocked) { start(); return; }
    if (ctx && ctx.state !== 'running' && document.visibilityState === 'visible') {
      ctx.resume().catch(() => {});
      if (musicEl && settings.music > 0) musicEl.play().catch(() => {});
    }
  };
  for (const ev of ['touchend', 'pointerup', 'click', 'keydown']) {
    window.addEventListener(ev, wake, { capture: true, passive: true });
  }

  // 切到背景時暫停，回來再繼續
  document.addEventListener('visibilitychange', () => {
    if (!ctx || !unlocked) return;
    if (document.visibilityState === 'hidden') {
      ctx.suspend();
      musicEl?.pause();
    } else {
      // iOS 可能不允許在這裡恢復；不行的話，下一次點擊時會再喚醒
      ctx.resume().catch(() => {});
      if (musicEl && settings.music > 0) musicEl.play().catch(() => {});
    }
  });

  // 所有按鈕：輕輕的點擊聲
  document.addEventListener('click', (e) => {
    const t = /** @type {HTMLElement|null} */ (e.target);
    const btn = t?.closest?.('button');
    if (btn && !btn.disabled && !btn.hasAttribute('data-nosfx')) sfx('tap');
  }, true);
}

function start() {
  const AC = window.AudioContext ?? /** @type {any} */ (window).webkitAudioContext;
  if (!AC) return;
  // iOS 17+：宣告為播放媒體，側邊靜音鍵打開時也聽得到（像影片一樣）
  try {
    const session = /** @type {any} */ (navigator).audioSession;
    if (session) session.type = 'playback';
  } catch { /* 不支援就算了 */ }
  ctx = new AC();
  unlocked = true;
  // iOS 的解鎖方式：在使用者點擊的當下播一段無聲的聲音
  const silent = ctx.createBuffer(1, 1, 22050);
  const s0 = ctx.createBufferSource();
  s0.buffer = silent;
  s0.connect(ctx.destination);
  s0.start(0);
  master = ctx.createGain();
  master.gain.value = 3.2; // 合成的聲音本身很輕，整體拉高；壓縮器會擋住疊加時的爆音
  // 避免多個聲音疊在一起時爆音
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  master.connect(comp).connect(ctx.destination);

  musicBus = ctx.createGain();
  musicBus.gain.value = curve(settings.music);
  musicBus.connect(master);
  sfxBus = ctx.createGain();
  sfxBus.gain.value = curve(settings.sfx);
  sfxBus.connect(master);

  // 簡易殘響：讓合成的音樂與音效有空間感，像在水裡
  reverb = ctx.createConvolver();
  reverb.buffer = impulse(ctx, 2.8, 2.6);
  reverbSend = ctx.createGain();
  reverbSend.gain.value = 0.32;
  reverbSend.connect(reverb).connect(musicBus);

  ctx.resume().catch(() => {});
  preloadSfx();
  startMusic();
}

/**
 * @param {AudioContext} c @param {number} sec @param {number} decay
 */
function impulse(c, sec, decay) {
  const len = Math.floor(c.sampleRate * sec);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

// ───────────────────────────── 設定 ─────────────────────────────

export function getVolumes() {
  return { ...settings };
}

/**
 * @param {'music'|'sfx'} kind @param {number} v 0～1
 */
export function setVolume(kind, v) {
  settings[kind] = Math.max(0, Math.min(1, v));
  saveSettings();
  if (!ctx) return;
  const bus = kind === 'music' ? musicBus : sfxBus;
  bus.gain.setTargetAtTime(curve(settings[kind]), ctx.currentTime, 0.05);
  if (kind === 'music') {
    if (settings.music > 0) startMusic();
    else stopMusic();
  }
}

/** 換房間背景時換配樂 @param {string} id */
export function setAudioTheme(id) {
  if (id === theme) return;
  theme = id;
  if (ctx && settings.music > 0) { stopMusic(); startMusic(); }
}

// ───────────────────────────── 音效 ─────────────────────────────

async function preloadSfx() {
  if (!ctx) return;
  const c = ctx;
  await Promise.all(Object.entries(files.sfx).map(async ([name, src]) => {
    if (!src) return;
    try {
      const res = await fetch('/assets/' + src);
      if (!res.ok) return;
      sfxBuffers.set(name, await c.decodeAudioData(await res.arrayBuffer()));
    } catch { /* 讀取失敗就用合成音效 */ }
  }));
}

/**
 * 播放音效
 * @param {SfxName} name
 */
export function sfx(name) {
  if (!ctx || settings.sfx <= 0 || ctx.state !== 'running') return;
  const buf = sfxBuffers.get(name);
  if (buf) {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(sfxBus);
    src.start();
    return;
  }
  SYNTH[name]?.(ctx.currentTime + 0.005);
}

/**
 * 一個短音：振盪器＋音量包絡
 * @param {{ type?: OscillatorType, f: number, f2?: number, at: number, dur: number, vol?: number, attack?: number, out?: AudioNode, wet?: number, glide?: number }} o
 */
function tone(o) {
  const c = /** @type {AudioContext} */ (ctx);
  const osc = c.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.f, o.at);
  if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, o.at + (o.glide ?? o.dur));
  const g = c.createGain();
  const vol = o.vol ?? 0.2;
  const atk = o.attack ?? 0.005;
  g.gain.setValueAtTime(0.0001, o.at);
  g.gain.exponentialRampToValueAtTime(vol, o.at + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, o.at + o.dur);
  osc.connect(g).connect(o.out ?? sfxBus);
  if (o.wet) {
    const s = c.createGain();
    s.gain.value = o.wet;
    g.connect(s).connect(reverbSend);
  }
  osc.start(o.at);
  osc.stop(o.at + o.dur + 0.05);
  return { osc, g };
}

/**
 * 一段濾波後的雜訊（水聲、刷過的聲音）
 * @param {{ at: number, dur: number, vol: number, from: number, to: number, q?: number, type?: BiquadFilterType }} o
 */
function noise(o) {
  const c = /** @type {AudioContext} */ (ctx);
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  const f = c.createBiquadFilter();
  f.type = o.type ?? 'bandpass';
  f.Q.value = o.q ?? 1.2;
  f.frequency.setValueAtTime(o.from, o.at);
  f.frequency.exponentialRampToValueAtTime(o.to, o.at + o.dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, o.at);
  g.gain.exponentialRampToValueAtTime(o.vol, o.at + o.dur * 0.25);
  g.gain.exponentialRampToValueAtTime(0.0001, o.at + o.dur);
  src.connect(f).connect(g).connect(sfxBus);
  src.start(o.at);
  src.stop(o.at + o.dur + 0.05);
}

/** @type {AudioBuffer|null} */
let noiseBuf = null;
/** @param {AudioContext} c */
function noiseBuffer(c) {
  if (noiseBuf) return noiseBuf;
  noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

/** 泡泡破掉的「啵」 @param {number} at @param {number} [pitch] @param {number} [vol] */
function pop(at, pitch = 1, vol = 0.18) {
  tone({ f: 380 * pitch, f2: 1250 * pitch, at, dur: 0.09, vol, glide: 0.06, wet: 0.15 });
}

/** 音名 → 頻率（A4 = 440） @param {number} midi */
const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

/** 合成音效 @type {Record<SfxName, (t: number) => void>} */
const SYNTH = {
  // 按鈕：很輕的木質點擊
  tap: (t) => tone({ f: 1050, f2: 720, at: t, dur: 0.05, vol: 0.07, glide: 0.04 }),
  // 打開面板：往上刷過
  open: (t) => {
    noise({ at: t, dur: 0.16, vol: 0.09, from: 500, to: 2400 });
    tone({ f: hz(76), at: t + 0.03, dur: 0.18, vol: 0.06, type: 'triangle', wet: 0.2 });
  },
  // 關閉面板：往下刷過
  close: (t) => {
    noise({ at: t, dur: 0.14, vol: 0.1, from: 2000, to: 450 });
    tone({ f: hz(72), at: t + 0.02, dur: 0.14, vol: 0.05, type: 'triangle' });
  },
  // 購買成功：兩聲清脆的珍珠音
  buy: (t) => {
    tone({ f: hz(88), at: t, dur: 0.18, vol: 0.12, type: 'triangle', wet: 0.3 });
    tone({ f: hz(95), at: t + 0.08, dur: 0.45, vol: 0.12, type: 'triangle', wet: 0.4 });
  },
  // 錢不夠／不能做：低低的「咚」
  fail: (t) => {
    tone({ f: 220, f2: 140, at: t, dur: 0.16, vol: 0.12, type: 'triangle' });
    tone({ f: 165, f2: 110, at: t + 0.12, dur: 0.2, vol: 0.1, type: 'triangle' });
  },
  // 新水母入住：咕嚕咕嚕的水泡＋上揚的音
  newFish: (t) => {
    noise({ at: t, dur: 0.35, vol: 0.06, from: 300, to: 1400, q: 3 });
    [0, 0.07, 0.15, 0.24].forEach((d, i) => pop(t + d, 0.8 + i * 0.18, 0.13));
    [72, 76, 79, 84].forEach((n, i) => tone({ f: hz(n), at: t + 0.25 + i * 0.09, dur: 0.6, vol: 0.08, type: 'triangle', wet: 0.4 }));
  },
  // 點選水母：一個泡泡
  select: (t) => pop(t, 1.1, 0.14),
  // 長大：閃亮的琶音
  grow: (t) => {
    [79, 83, 86, 91, 95].forEach((n, i) => {
      tone({ f: hz(n), at: t + i * 0.07, dur: 0.7, vol: 0.07, wet: 0.5 });
      tone({ f: hz(n) * 2.76, at: t + i * 0.07, dur: 0.3, vol: 0.015 });
    });
  },
  // 放生：一串泡泡往上漂走、越來越小聲
  release: (t) => {
    for (let i = 0; i < 7; i++) pop(t + i * 0.11 + Math.random() * 0.04, 0.7 + i * 0.12, 0.13 * (1 - i / 9));
    noise({ at: t, dur: 0.9, vol: 0.035, from: 400, to: 2600, q: 2 });
  },
  // 貓：小小聲的「喵」
  cat: (t) => meow(t),
  // 狗：兩聲短短的「汪」
  dog: (t) => {
    for (const d of [0, 0.17]) {
      tone({ type: 'sawtooth', f: 330, f2: 190, at: t + d, dur: 0.12, vol: 0.06, attack: 0.01 });
      noise({ at: t + d, dur: 0.1, vol: 0.05, from: 900, to: 400 });
    }
  },
  // 愛心：輕輕的叮
  heart: (t) => {
    tone({ f: hz(93), at: t, dur: 0.5, vol: 0.05, wet: 0.5 });
    tone({ f: hz(100), at: t + 0.06, dur: 0.5, vol: 0.04, wet: 0.5 });
  },
  // 離線收益：溫暖的和弦
  offline: (t) => {
    [60, 64, 67, 72, 76].forEach((n, i) => tone({ f: hz(n), at: t + i * 0.05, dur: 1.4, vol: 0.06, type: 'triangle', attack: 0.03, wet: 0.5 }));
    SYNTH.buy(t + 0.35);
  },
  // 解鎖背景：小小的號角
  unlock: (t) => {
    [67, 72, 76, 79, 84].forEach((n, i) => tone({ f: hz(n), at: t + i * 0.1, dur: i === 4 ? 1.4 : 0.35, vol: 0.08, type: 'triangle', wet: 0.45 }));
    [60, 64, 67].forEach((n) => tone({ f: hz(n), at: t + 0.4, dur: 1.6, vol: 0.05, attack: 0.08, wet: 0.5 }));
  },
};

/** 貓叫：鋸齒波的音高先上揚再下滑，經過帶通濾波做出「口腔」的共鳴 @param {number} t */
function meow(t) {
  const c = /** @type {AudioContext} */ (ctx);
  const osc = c.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(620, t);
  osc.frequency.linearRampToValueAtTime(980, t + 0.14);
  osc.frequency.linearRampToValueAtTime(560, t + 0.42);
  const f = c.createBiquadFilter();
  f.type = 'bandpass'; f.Q.value = 2.5;
  f.frequency.setValueAtTime(1100, t);
  f.frequency.linearRampToValueAtTime(1800, t + 0.15);
  f.frequency.linearRampToValueAtTime(900, t + 0.42);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.14, t + 0.05);
  g.gain.setValueAtTime(0.14, t + 0.25);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
  osc.connect(f).connect(g).connect(sfxBus);
  osc.start(t);
  osc.stop(t + 0.5);
}

// ───────────────────────────── 音樂 ─────────────────────────────

/** @type {HTMLAudioElement|null} */
let musicEl = null;
/** @type {number|undefined} */
let musicTimer;
/** @type {{ stop: () => void }|null} */
let ambience = null;

/**
 * 每個背景的配樂風格（沒有音樂檔時的即時演奏）
 * chords：每兩小節換一個和弦（MIDI 音高）；scale：旋律可用的音；bell：音色偏鐘聲
 */
const STYLES = {
  forest: {
    bpm: 72,
    chords: [[48, 55, 64, 71], [45, 52, 60, 67], [41, 48, 57, 64], [43, 50, 59, 66]],
    scale: [72, 74, 76, 79, 81, 84, 86, 88],
    bell: false,
  },
  stellar: {
    bpm: 62,
    chords: [[50, 57, 66, 73], [47, 54, 62, 69], [43, 50, 59, 66], [45, 52, 61, 68]],
    scale: [74, 76, 78, 81, 83, 86, 88, 90],
    bell: true,
  },
};

function startMusic() {
  if (!ctx || settings.music <= 0 || musicTimer !== undefined || musicEl) return;
  const src = files.music[theme];
  if (src) {
    // 有音樂檔：用 <audio> 串流播放（不用整首下載完才開始），音量交給 Web Audio 控制
    musicEl = new Audio('/assets/' + src);
    musicEl.loop = true;
    musicEl.crossOrigin = 'anonymous';
    ctx.createMediaElementSource(musicEl).connect(musicBus);
    musicEl.play().catch(() => {});
    return;
  }
  startGenerative();
}

function stopMusic() {
  if (musicEl) { musicEl.pause(); musicEl.src = ''; musicEl = null; }
  if (musicTimer !== undefined) { clearInterval(musicTimer); musicTimer = undefined; }
  ambience?.stop();
  ambience = null;
}

/** 隨機演奏：慢速和弦墊底＋音樂盒旋律＋很淡的水聲 */
function startGenerative() {
  const c = /** @type {AudioContext} */ (ctx);
  const style = STYLES[/** @type {keyof typeof STYLES} */ (theme)] ?? STYLES.forest;
  const beat = 60 / style.bpm;
  let next = c.currentTime + 0.3;
  let step = 0; // 第幾拍
  let lastNote = 3;
  ambience = waterAmbience(c);

  const schedule = () => {
    // 往前排 1.5 秒內的音
    while (next < c.currentTime + 1.5) {
      const bar = Math.floor(step / 4);
      const chord = style.chords[Math.floor(bar / 2) % style.chords.length];
      const beatInBar = step % 4;
      if (beatInBar === 0 && bar % 2 === 0) padChord(next, chord, beat * 8);
      if (beatInBar === 0) tone({ f: hz(chord[0] - 12), at: next, dur: beat * 3.5, vol: 0.05, attack: 0.04, out: musicBus, wet: 0.2 });
      // 旋律：大約一半的拍子有音，偶爾多一個八分音符，音高多半走鄰近的音
      if (Math.random() < 0.5) {
        lastNote = Math.max(0, Math.min(style.scale.length - 1, lastNote + Math.round((Math.random() - 0.5) * 4)));
        melodyNote(next, style.scale[lastNote], style.bell);
        if (Math.random() < 0.18) {
          const n2 = Math.max(0, Math.min(style.scale.length - 1, lastNote + (Math.random() < 0.5 ? -1 : 1)));
          melodyNote(next + beat / 2, style.scale[n2], style.bell);
        }
      }
      next += beat;
      step++;
    }
  };
  schedule();
  musicTimer = window.setInterval(schedule, 300);
}

/** @param {number} at @param {number} midi @param {boolean} bell */
function melodyNote(at, midi, bell) {
  const f = hz(midi);
  const vol = 0.045 + Math.random() * 0.02;
  tone({ f, at, dur: 1.6, vol, attack: 0.004, out: musicBus, wet: 0.7 });
  // 音樂盒／鐘聲的泛音
  tone({ f: f * (bell ? 2.76 : 3), at, dur: bell ? 0.9 : 0.35, vol: vol * (bell ? 0.35 : 0.2), attack: 0.003, out: musicBus, wet: 0.7 });
}

/** @param {number} at @param {number[]} chord @param {number} dur */
function padChord(at, chord, dur) {
  const c = /** @type {AudioContext} */ (ctx);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 900;
  lp.connect(musicBus);
  const send = c.createGain();
  send.gain.value = 0.6;
  lp.connect(send).connect(reverbSend);
  for (const n of chord.slice(1)) {
    for (const det of [-6, 6]) {
      const osc = c.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = hz(n - 12);
      osc.detune.value = det;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.012, at + 2);
      g.gain.setValueAtTime(0.012, at + dur - 1.5);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur + 1);
      osc.connect(g).connect(lp);
      osc.start(at);
      osc.stop(at + dur + 1.1);
    }
  }
}

/** 很淡的水流聲（低通的雜訊，濾波頻率慢慢飄動） @param {AudioContext} c */
function waterAmbience(c) {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  src.loop = true;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 380;
  lp.Q.value = 0.7;
  const lfo = c.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoAmt = c.createGain();
  lfoAmt.gain.value = 140;
  lfo.connect(lfoAmt).connect(lp.frequency);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.05, c.currentTime + 3);
  src.connect(lp).connect(g).connect(musicBus);
  src.start();
  lfo.start();
  return {
    stop() {
      const t = c.currentTime;
      g.gain.setTargetAtTime(0.0001, t, 0.3);
      src.stop(t + 1.5);
      lfo.stop(t + 1.5);
    },
  };
}
