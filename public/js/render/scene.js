// @ts-check
import { getSpecies } from '../config/species.js';
import { BALANCE } from '../config/balance.js';
import { getQuality } from '../config/quality.js';
import { getLandPet } from '../config/landpets.js';
import { growthScale, stageOf } from '../core/sim.js';
import { drawSprite, drawCover } from './assets.js';
import { drawFishPlaceholder, drawLandPetPlaceholder, hexA } from './placeholder.js';

/**
 * 水族箱畫面（Canvas 2D）。
 * 只負責「把 GameState 畫出來」與「點擊判定」，不修改任何遊戲數值。
 * 日後若要換成 PixiJS／WebGL，只需要重寫這支檔案，對外介面保持一樣即可。
 */

/** @typedef {import('../core/state.js').GameState} GameState */

/**
 * @typedef {Object} FishEnt
 * @property {number} uid
 * @property {number} x @property {number} y
 * @property {number} vx @property {number} vy
 * @property {number} tx @property {number} ty
 * @property {number} face
 * @property {number} phase
 * @property {number} retarget
 * @property {number} idleUntil  小魚停下來懸浮到這個時間
 * @property {number} speedMul
 * @property {number} nextSparkle
 * @property {number} born
 * @property {number} dying  -1 = 活著；否則為開始離去的時間
 * @property {string} species
 * @property {string} quality
 * @property {number} L
 */

/**
 * @typedef {Object} PetEnt
 * @property {string} type
 * @property {'cat'|'dog'} kind
 * @property {number} x
 * @property {number} dir
 * @property {boolean} walking
 * @property {number} nextChange
 * @property {number} hop
 * @property {number} spot          背景指定位置的索引；-1 表示沒有位置（改在地板上走動）
 * @property {string} pose          sit / lie / idle / sleep
 * @property {number} poseUntil
 * @property {number} interactAt    開始播放互動動畫的時間；-1 表示沒有
 * @property {number} moveAt        換位置（淡出→淡入）開始的時間；-1 表示沒有
 * @property {number} moveTo
 * @property {number} phase
 */

/**
 * @typedef {Object} ScreenSpot
 * @property {'cat'|'dog'} kind
 * @property {number} x
 * @property {number} y
 * @property {number} face
 * @property {number} size   動畫格寬度（px）
 */

/** 各種姿勢出現的機率與持續時間（秒） */
const POSES = {
  sit:   { weight: 3, min: 10, max: 22 },
  lie:   { weight: 3, min: 12, max: 26 },
  idle:  { weight: 2, min: 6,  max: 14 },
  sleep: { weight: 3, min: 25, max: 60 },
};
const INTERACT_SEC = 1.2;

/** 可預測的亂數（讓背景每次重繪都一樣） @param {number} seed */
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export class Scene {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {() => GameState} getState
   * @param {import('./assets.js').AssetBank} assets
   */
  constructor(canvas, getState, assets) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('瀏覽器不支援 Canvas');
    this.ctx = ctx;
    this.getState = getState;
    this.assets = assets;

    this.w = 0; this.h = 0; this.dpr = 1;
    this.unit = 1;
    this.sandTop = 0;
    this.swim = { left: 0, right: 0, top: 0, bottom: 0 };
    this.petY = 0;

    /** @type {Map<number, FishEnt>} */
    this.fish = new Map();
    /** @type {Map<string, PetEnt>} */
    this.pets = new Map();
    /** @type {{x:number,y:number,r:number,v:number,ph:number}[]} */
    this.bubbles = [];
    /** @type {{x:number,y:number,text:string,color:string,t:number}[]} */
    this.floats = [];
    /** @type {{x:number,y:number,vx:number,vy:number,t:number,kind:'heart'|'spark',color:string}[]} */
    this.particles = [];
    /** @type {{x:number,h:number,w:number,ph:number,color:string,front:boolean}[]} */
    this.plants = [];
    /** @type {number|null} */
    this.selectedUid = null;

    /** @type {import('./assets.js').SpriteEntry|null} 目前使用的背景 */
    this.bgEntry = null;
    /** @type {{dx:number,dy:number,s:number}|null} 背景圖在畫面上的位置與縮放 */
    this.bgPlace = null;
    /** @type {{x:number,y:number,w:number,h:number,r:number}|null} 水族箱水域（魚只畫在裡面） */
    this.tankClip = null;
    this.petRange = { min: 40, max: 400 };
    this.petUnit = 1;
    /** @type {ScreenSpot[]} 陸地寵物在畫面上的固定位置 */
    this.spots = [];

    this.bg = document.createElement('canvas');
    this.time = 0;
    this.resize();
  }

  /** 視窗大小改變時重新排版 */
  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = w; this.h = h; this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);

    const portrait = h > w;
    this.bgEntry = (portrait ? this.assets.backgroundPortrait : this.assets.background)
      ?? this.assets.background ?? this.assets.backgroundPortrait;
    this.bgPlace = null;
    this.tankClip = null;
    this.petRange = { min: 40, max: w - 40 };
    this.spots = [];

    const layout = this.bgEntry?.layout;
    if (this.bgEntry && layout) {
      // 背景圖有版面設定：魚游在圖中的水族箱裡，陸地寵物走在地板上
      const iw = this.bgEntry.img.naturalWidth;
      const ih = this.bgEntry.img.naturalHeight;
      const s = Math.max(w / iw, h / ih);
      const dw = iw * s, dh = ih * s;
      const dx = clamp(w / 2 - layout.focusX * dw, w - dw, 0);
      const dy = (h - dh) / 2;
      this.bgPlace = { dx, dy, s };
      const X = (/** @type {number} */ u) => dx + u * dw;
      const Y = (/** @type {number} */ v) => dy + v * dh;
      const t = layout.tank;
      this.tankClip = { x: X(t.x0), y: Y(t.y0), w: X(t.x1) - X(t.x0), h: Y(t.y1) - Y(t.y0), r: t.r * dw };
      this.swim = {
        left: Math.max(X(layout.swim.x0), 16),
        right: Math.min(X(layout.swim.x1), w - 16),
        top: Y(layout.swim.y0),
        bottom: Y(layout.swim.y1),
      };
      this.unit = Math.max(0.8, Math.min(1.8,
        (this.swim.bottom - this.swim.top) / 330,
        (this.swim.right - this.swim.left) / 320));
      // 房間場景中，陸地寵物站在地板上，相對魚要大一些
      this.petUnit = this.unit * Math.max(0.9, Math.min(1.5, w / 700));
      this.sandTop = this.swim.bottom;
      this.petY = Y(layout.floorY);
      this.petRange = { min: Math.max(X(layout.floorX[0]), 30), max: Math.min(X(layout.floorX[1]), w - 30) };
      if (layout.pets) {
        const pl = layout.pets;
        this.spots = pl.spots.map((sp) => ({
          kind: sp.kind, x: X(sp.x), y: Y(sp.y), face: sp.face,
          size: (sp.kind === 'cat' ? pl.catSize : pl.dogSize) * dw,
        }));
      }
    } else {
      // 手機上魚也要夠大看得清楚：以短邊為基準縮放
      this.unit = Math.max(0.85, Math.min(1.6, Math.min(w, h) / 440));
      this.petUnit = this.unit;
      const sandH = Math.max(110, Math.min(200, h * 0.18));
      this.sandTop = h - sandH;
      this.petY = this.sandTop + Math.min(34, sandH * 0.28);
      this.swim = {
        left: 24,
        right: w - 24,
        top: Math.min(90, h * 0.14),
        bottom: this.sandTop - 14 * this.unit,
      };
    }

    this.buildBackground();
    this.buildPlants();
    // 讓既有的魚留在可游範圍內
    for (const f of this.fish.values()) {
      f.x = clamp(f.x, this.swim.left, this.swim.right);
      f.y = clamp(f.y, this.swim.top, this.swim.bottom);
      this.pickTarget(f);
    }
    for (const p of this.pets.values()) {
      p.x = clamp(p.x, this.petRange.min, this.petRange.max);
      // 換了背景（例如手機轉向）後，重新分配位置
      p.spot = -1;
    }
    for (const p of this.pets.values()) p.spot = this.freeSpot(p.kind, -1);
  }

  buildBackground() {
    const { w, h, dpr } = this;
    const c = this.bg;
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    const bgEntry = this.bgEntry;
    if (bgEntry && this.bgPlace) {
      const { dx, dy, s } = this.bgPlace;
      g.imageSmoothingQuality = 'high';
      g.drawImage(bgEntry.img, dx, dy, bgEntry.img.naturalWidth * s, bgEntry.img.naturalHeight * s);
    } else if (bgEntry) {
      // 沒有版面設定的背景：底部對齊，確保沙地永遠在畫面下方
      drawCover(g, bgEntry.img, 0, 0, w, h, 1);
    } else {
      // 水
      const water = g.createLinearGradient(0, 0, 0, h);
      water.addColorStop(0, '#1d8fbf');
      water.addColorStop(0.35, '#0f5f8f');
      water.addColorStop(0.75, '#08395e');
      water.addColorStop(1, '#062a46');
      g.fillStyle = water;
      g.fillRect(0, 0, w, h);

      // 水面光
      const top = g.createRadialGradient(w * 0.5, -h * 0.2, 10, w * 0.5, -h * 0.2, h * 0.9);
      top.addColorStop(0, 'rgba(190,240,255,.45)');
      top.addColorStop(1, 'rgba(190,240,255,0)');
      g.fillStyle = top;
      g.fillRect(0, 0, w, h);

      // 遠景岩石
      const rnd = seeded(7);
      g.fillStyle = 'rgba(4,30,52,.55)';
      g.beginPath();
      g.moveTo(0, this.sandTop + 10);
      for (let x = 0; x <= w + 40; x += 40) {
        g.lineTo(x, this.sandTop - 20 - rnd() * 60 * this.unit - (Math.sin(x / 180) + 1) * 30 * this.unit);
      }
      g.lineTo(w, this.sandTop + 10);
      g.closePath();
      g.fill();
    }

    if (this.assets.sand) {
      drawCover(g, this.assets.sand.img, 0, this.sandTop - 20, w, h - this.sandTop + 20, 0);
    } else if (!bgEntry) {
      // 沙地
      const sand = g.createLinearGradient(0, this.sandTop, 0, h);
      sand.addColorStop(0, '#d9c08c');
      sand.addColorStop(0.3, '#c4a670');
      sand.addColorStop(1, '#8a6f45');
      g.fillStyle = sand;
      g.beginPath();
      g.moveTo(0, this.sandTop + 12);
      for (let x = 0; x < w + 20; x += 20) {
        const xx = Math.min(x, w);
        g.lineTo(xx, this.sandTop + Math.sin(xx / 90) * 6 + Math.sin(xx / 37) * 3);
      }
      g.lineTo(w, h);
      g.lineTo(0, h);
      g.closePath();
      g.fill();
      // 沙粒
      const rnd = seeded(11);
      for (let i = 0; i < (w * (h - this.sandTop)) / 220; i++) {
        const x = rnd() * w;
        const y = this.sandTop + 8 + rnd() * (h - this.sandTop);
        g.fillStyle = rnd() > 0.5 ? 'rgba(255,240,200,.35)' : 'rgba(90,60,30,.25)';
        g.fillRect(x, y, 1.5, 1.5);
      }
      // 小石頭
      for (let i = 0; i < w / 60; i++) {
        const x = rnd() * w;
        const y = this.sandTop + 20 + rnd() * (h - this.sandTop - 20);
        const r = (3 + rnd() * 7) * this.unit;
        g.beginPath();
        g.ellipse(x, y, r * 1.4, r, 0, 0, Math.PI * 2);
        g.fillStyle = `rgba(${90 + rnd() * 60},${80 + rnd() * 40},${70 + rnd() * 30},.8)`;
        g.fill();
      }
    }
  }

  buildPlants() {
    const rnd = seeded(23);
    this.plants = [];
    const n = Math.max(5, Math.round(this.w / 110));
    for (let i = 0; i < n; i++) {
      const front = i % 4 === 0 && (i < 2 || i > n - 3);
      this.plants.push({
        x: (i + 0.2 + rnd() * 0.6) * (this.w / n),
        h: (70 + rnd() * 140) * this.unit * (front ? 0.8 : 1),
        w: (6 + rnd() * 6) * this.unit,
        ph: rnd() * 10,
        color: ['#2f8f5b', '#3fa86a', '#257a52', '#5cb85c'][Math.floor(rnd() * 4)],
        front,
      });
    }
  }

  /** @param {FishEnt} f */
  pickTarget(f) {
    const sp = getSpecies(f.species);
    const s = this.swim;
    if (sp.shape === 'jelly') {
      f.tx = clamp(f.x + (Math.random() - 0.5) * 120, s.left + 40, s.right - 40);
      f.ty = s.top + Math.random() * (s.bottom - s.top) * 0.8;
    } else if (Math.random() < 0.3) {
      // 偶爾停下來發呆（使用懸浮動畫）
      f.tx = f.x; f.ty = f.y;
      f.idleUntil = this.time + 2 + Math.random() * 3;
      f.retarget = f.idleUntil;
      return;
    } else {
      f.tx = s.left + Math.random() * (s.right - s.left);
      f.ty = s.top + Math.random() * (s.bottom - s.top);
    }
    f.retarget = this.time + 4 + Math.random() * 8;
  }

  /** 實際身體大小（動畫圖四周有留白） @param {FishEnt} f */
  bodySize(f) {
    return this.assets.fish[f.species] ? f.L * 0.6 : f.L * 0.8;
  }

  /** 讓畫面上的魚與存檔資料一致 */
  sync() {
    const state = this.getState();
    const seen = new Set();
    for (const d of state.fish) {
      seen.add(d.uid);
      let e = this.fish.get(d.uid);
      if (!e) {
        const isNew = d.ageSec < 3;
        e = {
          uid: d.uid, species: d.species, quality: d.quality,
          x: this.swim.left + Math.random() * (this.swim.right - this.swim.left),
          // 新來的夥伴從上半部隨機位置淡入，避免一次放很多隻時全部擠在水面
          y: this.swim.top + Math.random() * (this.swim.bottom - this.swim.top) * (isNew ? 0.5 : 1),
          vx: 0, vy: 0, tx: 0, ty: 0,
          face: Math.random() > 0.5 ? 1 : -1,
          phase: Math.random() * 10,
          retarget: 0,
          idleUntil: 0,
          speedMul: 0.75 + Math.random() * 0.5,
          nextSparkle: this.time + 2 + Math.random() * 8,
          born: this.time,
          dying: -1,
          L: 0,
        };
        this.pickTarget(e);
        this.fish.set(d.uid, e);
      }
      e.L = getSpecies(d.species).size * this.unit * BALANCE.creatureScale * growthScale(d);
      this.assets.requestFish(d.species);
    }
    for (const e of this.fish.values()) {
      if (!seen.has(e.uid) && e.dying < 0) e.dying = this.time;
    }

    const petSeen = new Set();
    for (const p of state.landPets) {
      petSeen.add(p.type);
      this.assets.requestPet(p.type);
      if (!this.pets.has(p.type)) {
        const kind = getLandPet(p.type).kind;
        this.pets.set(p.type, {
          type: p.type,
          kind,
          x: this.petRange.min + Math.random() * (this.petRange.max - this.petRange.min),
          dir: Math.random() > 0.5 ? 1 : -1,
          walking: false,
          nextChange: this.time + 1 + Math.random() * 3,
          hop: 0,
          spot: this.freeSpot(kind, -1),
          pose: this.randomPose(),
          poseUntil: this.time + 5 + Math.random() * 10,
          interactAt: -1,
          moveAt: -1,
          moveTo: -1,
          phase: Math.random() * 10,
        });
      }
    }
    for (const k of [...this.pets.keys()]) if (!petSeen.has(k)) this.pets.delete(k);
  }

  /** @param {number} dt 秒 */
  update(dt) {
    this.time += dt;
    const t = this.time;
    this.sync();

    // 魚
    for (const f of this.fish.values()) {
      if (f.dying >= 0) {
        f.vy = -12;
        f.y += f.vy * dt;
        if (t - f.dying > 2.5) this.fish.delete(f.uid);
        continue;
      }
      const sp = getSpecies(f.species);
      if (t > f.retarget || (t > f.idleUntil && Math.hypot(f.tx - f.x, f.ty - f.y) < 16)) this.pickTarget(f);
      const speed = sp.speed * this.unit * f.speedMul * (0.8 + 0.2 * Math.sin(t * 0.7 + f.phase));
      const dx = f.tx - f.x, dy = f.ty - f.y;
      const d = Math.hypot(dx, dy) || 1;
      const steer = sp.shape === 'jelly' ? 0.6 : 1.6;
      f.vx += ((dx / d) * speed - f.vx) * Math.min(1, steer * dt);
      f.vy += ((dy / d) * speed * 0.6 - f.vy) * Math.min(1, steer * dt);
      if (sp.shape === 'jelly') f.vy += Math.sin(t * 2.2 + f.phase) * 6 * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.x = clamp(f.x, this.swim.left, this.swim.right);
      f.y = clamp(f.y, this.swim.top - 40, this.swim.bottom);
      if (Math.abs(f.vx) > 3) f.face += (Math.sign(f.vx) - f.face) * Math.min(1, dt * 8);

      // 小小的產出光點，表示「牠正在幫你累積資源」
      if (t > f.nextSparkle) {
        f.nextSparkle = t + 5 + Math.random() * 9;
        this.particles.push({
          x: f.x, y: f.y - f.L * 0.2, vx: (Math.random() - 0.5) * 8, vy: -18,
          t: 0, kind: 'spark', color: '#ffd25e',
        });
      }
    }

    // 彼此保持距離，避免擠成一團（只輕輕推開，不影響原本的游動方向）
    const alive = [...this.fish.values()].filter((f) => f.dying < 0);
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const a = alive[i], b = alive[j];
        const min = (this.bodySize(a) + this.bodySize(b)) * 0.5;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.01;
        if (d < min) {
          const push = (min - d) * Math.min(1, dt * 2.5);
          const ux = dx / d, uy = dy / d;
          a.x -= ux * push * 0.5; a.y -= uy * push * 0.5;
          b.x += ux * push * 0.5; b.y += uy * push * 0.5;
          // 改變目標，讓牠們自然散開
          if (d < min * 0.6) { this.pickTarget(a); this.pickTarget(b); }
        }
      }
    }

    // 陸地寵物
    for (const p of this.pets.values()) {
      const lp = getLandPet(p.type);
      if (p.interactAt >= 0 && t - p.interactAt > INTERACT_SEC) p.interactAt = -1;
      if (p.spot >= 0) {
        // 有固定位置：在原地換姿勢；貓偶爾換到貓跳台的另一層
        if (p.moveAt >= 0 && t - p.moveAt > 0.5 && p.moveTo >= 0) { p.spot = p.moveTo; p.moveTo = -1; }
        if (p.moveAt >= 0 && t - p.moveAt > 1) p.moveAt = -1;
        if (t > p.poseUntil && p.interactAt < 0 && p.moveAt < 0) {
          const target = p.kind === 'cat' && Math.random() < 0.3 ? this.freeSpot(p.kind, p.spot) : -1;
          if (target >= 0 && target !== p.spot) { p.moveAt = t; p.moveTo = target; }
          p.pose = this.randomPose(p.pose);
          const ps = POSES[/** @type {keyof typeof POSES} */ (p.pose)];
          p.poseUntil = t + ps.min + Math.random() * (ps.max - ps.min);
        }
        continue;
      }
      if (t > p.nextChange) {
        p.walking = !p.walking;
        if (p.walking && Math.random() < 0.5) p.dir *= -1;
        p.nextChange = t + (p.walking ? 2 + Math.random() * 4 : 2 + Math.random() * 5);
      }
      if (p.walking) {
        p.x += p.dir * lp.speed * this.petUnit * dt;
        const half = lp.size * this.petUnit * 0.5;
        if (p.x < this.petRange.min + half) { p.x = this.petRange.min + half; p.dir = 1; }
        if (p.x > this.petRange.max - half) { p.x = this.petRange.max - half; p.dir = -1; }
      }
      p.hop = Math.max(0, p.hop - dt * 2.5);
    }

    // 氣泡
    if (Math.random() < dt * (1.5 + (this.swim.right - this.swim.left) / 700)) {
      const emit = [0.12, 0.47, 0.83][Math.floor(Math.random() * 3)];
      this.bubbles.push({
        x: this.swim.left + (this.swim.right - this.swim.left) * emit + (Math.random() - 0.5) * 30,
        y: this.sandTop + 4,
        r: (1.5 + Math.random() * 4) * this.unit,
        v: 30 + Math.random() * 40,
        ph: Math.random() * 10,
      });
    }
    for (const b of this.bubbles) {
      b.y -= b.v * dt;
      b.x += Math.sin(t * 3 + b.ph) * 12 * dt;
    }
    this.bubbles = this.bubbles.filter((b) => b.y > (this.tankClip ? this.tankClip.y : 0) - 10);

    for (const fl of this.floats) { fl.t += dt; fl.y -= 26 * dt; }
    this.floats = this.floats.filter((fl) => fl.t < 1.6);
    for (const p of this.particles) {
      p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind === 'heart') p.vy -= 10 * dt;
    }
    this.particles = this.particles.filter((p) => p.t < (p.kind === 'heart' ? 1.4 : 1.8));
  }

  draw() {
    const { ctx, w, h, dpr } = this;
    const t = this.time;
    const state = this.getState();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.bg, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 水族箱內（有版面設定時裁切在水域內）
    ctx.save();
    if (this.tankClip) {
      const c = this.tankClip;
      ctx.beginPath();
      ctx.roundRect(c.x, c.y, c.w, c.h, c.r);
      ctx.clip();
    }
    if (this.assets.effects.lightRays) this.drawLightRays();
    if (this.assets.effects.plants) this.drawPlants(false);
    this.drawBubbles();
    this.drawDecor(state);

    // 魚：小的畫在後面，讓大魚在前
    const list = [...this.fish.values()].sort((a, b) => a.L - b.L);
    const byUid = new Map(state.fish.map((f) => [f.uid, f]));
    for (const f of list) this.drawFish(f, byUid.get(f.uid));
    if (this.assets.effects.plants) this.drawPlants(true);
    ctx.restore();

    for (const p of [...this.pets.values()].sort((a, b) => a.x - b.x)) this.drawPet(p);
    this.drawParticles();
    this.drawFloats();

    // 邊緣暗角，增加景深（只用在占位背景；正式美術保留原本色調）
    if (!this.bgEntry) {
      const vg = ctx.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.35, w / 2, h * 0.5, Math.max(w, h) * 0.8);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,10,25,.35)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);
    }
    void t;
  }

  drawLightRays() {
    const { ctx, w } = this;
    const t = this.time;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const n = Math.max(4, Math.round(w / 260));
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) / n) * w + Math.sin(t * 0.15 + i * 1.7) * 60;
      const spread = (90 + (i % 3) * 40) * this.unit;
      const a = 0.05 + 0.04 * Math.sin(t * 0.4 + i * 2.1);
      const g = ctx.createLinearGradient(0, 0, 0, this.sandTop);
      g.addColorStop(0, `rgba(200,245,255,${a})`);
      g.addColorStop(1, 'rgba(200,245,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - 20, 0);
      ctx.lineTo(x + 20, 0);
      ctx.lineTo(x + spread + 80, this.sandTop);
      ctx.lineTo(x - spread + 80, this.sandTop);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  /** @param {boolean} front */
  drawPlants(front) {
    const { ctx } = this;
    const t = this.time;
    for (const p of this.plants) {
      if (p.front !== front) continue;
      const base = this.sandTop + (front ? 30 : 6);
      ctx.save();
      ctx.globalAlpha = front ? 0.95 : 0.8;
      for (let k = 0; k < 3; k++) {
        const ox = (k - 1) * p.w * 1.3;
        const hh = p.h * (0.7 + k * 0.15);
        const sway = Math.sin(t * 0.9 + p.ph + k) * 14 * this.unit;
        ctx.beginPath();
        ctx.moveTo(p.x + ox - p.w / 2, base);
        ctx.quadraticCurveTo(p.x + ox + sway * 0.4 - p.w, base - hh * 0.5, p.x + ox + sway, base - hh);
        ctx.quadraticCurveTo(p.x + ox + sway * 0.4 + p.w, base - hh * 0.5, p.x + ox + p.w / 2, base);
        ctx.closePath();
        ctx.fillStyle = p.color;
        ctx.fill();
      }
      ctx.restore();
    }
  }

  drawBubbles() {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = 'rgba(220,250,255,.6)';
    ctx.fillStyle = 'rgba(220,250,255,.12)';
    ctx.lineWidth = 1;
    for (const b of this.bubbles) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * 裝飾圖層（預留）。state.decor.placed 的 x / y 是 0~1 的比例座標。
   * @param {GameState} state
   */
  drawDecor(state) {
    for (const d of state.decor.placed) {
      const e = this.assets.decor[d.id];
      if (!e) continue;
      const x = d.x * this.w;
      const y = this.sandTop + d.y * (this.h - this.sandTop);
      this.ctx.save();
      this.ctx.translate(x, y);
      drawSprite(this.ctx, e, 80 * this.unit, this.time);
      this.ctx.restore();
    }
  }

  /**
   * @param {FishEnt} f
   * @param {import('../core/state.js').FishData|undefined} data
   */
  drawFish(f, data) {
    const { ctx } = this;
    const t = this.time;
    const sp = getSpecies(f.species);
    const q = getQuality(f.quality);
    const L = f.L;

    let alpha = Math.min(1, (t - f.born) / 0.8);
    if (f.dying >= 0) alpha = Math.max(0, 1 - (t - f.dying) / 2.5);
    if (alpha <= 0) return;

    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.globalAlpha = alpha;

    const sprite = this.assets.fish[f.species];
    // 品質光暈（紫、金、紅）；動畫圖四周有留白，光暈改以實際身體大小計算
    const AL = sprite ? L * 0.62 : L;
    if (q.aura && f.dying < 0) {
      const pulse = 0.28 + 0.1 * Math.sin(t * 2.5 + f.phase);
      const rg = ctx.createRadialGradient(0, 0, AL * 0.1, 0, 0, AL * 0.95);
      rg.addColorStop(0, hexA(q.color, pulse));
      rg.addColorStop(1, hexA(q.color, 0));
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(0, 0, AL * 0.95, 0, Math.PI * 2);
      ctx.fill();
      if (q.id === 'red' || q.id === 'gold') {
        for (let i = 0; i < 3; i++) {
          const a = t * 1.5 + i * 2.1 + f.phase;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * AL * 0.6, Math.sin(a) * AL * 0.35, 1.8, 0, Math.PI * 2);
          ctx.fillStyle = hexA(q.color, 0.9);
          ctx.fill();
        }
      }
    }

    // 選取框
    if (this.selectedUid === f.uid) {
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(AL * 0.65, 18), 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,.7)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (sp.shape !== 'jelly') {
      const tilt = Math.atan2(f.vy, Math.abs(f.vx) + 20) * 0.6;
      // 轉身時不要壓成一條細線：寬度最少保留 30%
      const fx = (f.face < 0 ? -1 : 1) * Math.max(0.3, Math.abs(f.face));
      ctx.scale(fx, 1);
      ctx.rotate(tilt);
    }
    if (f.dying >= 0) ctx.rotate(Math.min(Math.PI, (t - f.dying) * 1.5));
    if (data && stageOf(data) === 'elder') ctx.globalAlpha = alpha * 0.85;

    if (sprite) {
      const slow = Math.hypot(f.vx, f.vy) < sp.speed * this.unit * 0.3;
      drawSprite(ctx, slow && sprite.hover ? sprite.hover : sprite, L, t + f.phase);
    } else {
      drawFishPlaceholder(ctx, sp, L, t + f.phase);
    }
    ctx.restore();
  }

  /**
   * 找一個沒有其他寵物的位置
   * @param {'cat'|'dog'} kind @param {number} exclude
   */
  freeSpot(kind, exclude) {
    const used = new Set([...this.pets.values()].flatMap((p) => [p.spot, p.moveTo]));
    // 只用完整出現在畫面裡的位置（不同螢幕比例裁切範圍不同）
    const visible = (/** @type {ScreenSpot} */ s) => s.x - s.size * 0.5 >= 0 && s.x + s.size * 0.5 <= this.w && s.y <= this.h;
    const free = this.spots.map((s, i) => i)
      .filter((i) => this.spots[i].kind === kind && i !== exclude && !used.has(i) && visible(this.spots[i]));
    return free.length ? free[Math.floor(Math.random() * free.length)] : -1;
  }

  /** @param {string} [avoid] */
  randomPose(avoid) {
    const list = /** @type {(keyof typeof POSES)[]} */ (Object.keys(POSES)).filter((k) => k !== avoid);
    const total = list.reduce((n, k) => n + POSES[k].weight, 0);
    let r = Math.random() * total;
    for (const k of list) { r -= POSES[k].weight; if (r < 0) return k; }
    return list[0];
  }

  /** 寵物在畫面上的位置與大小 @param {PetEnt} p */
  petPlace(p) {
    if (p.spot >= 0 && this.spots[p.spot]) {
      const s = this.spots[p.spot];
      return { x: s.x, y: s.y, size: s.size, face: s.face };
    }
    const lp = getLandPet(p.type);
    return { x: p.x, y: this.petY, size: lp.size * this.petUnit * 1.4, face: p.dir };
  }

  /** @param {PetEnt} p */
  drawPet(p) {
    const { ctx } = this;
    const sprites = this.assets.pets[p.type];
    if (sprites && p.spot >= 0) {
      this.drawPetSprite(p, sprites);
      return;
    }
    const lp = getLandPet(p.type);
    const S = lp.size * this.petUnit;
    const hop = Math.sin(p.hop * Math.PI) * S * 0.25;
    ctx.save();
    ctx.translate(p.x, this.petY - hop);
    ctx.scale(p.dir, 1);
    if (sprites) {
      const e = sprites.states.idle ?? Object.values(sprites.states)[0];
      const S2 = S * 1.4;
      ctx.scale(sprites.facing, 1);
      ctx.translate(0, -S2 * (sprites.anchorY - 0.5));
      drawSprite(ctx, e, S2, this.time + p.phase);
    } else {
      drawLandPetPlaceholder(ctx, lp, S, this.time, p.walking);
    }
    ctx.restore();
  }

  /**
   * 有美術、有固定位置的寵物
   * @param {PetEnt} p @param {import('./assets.js').PetSprites} sp
   */
  drawPetSprite(p, sp) {
    const { ctx } = this;
    const t = this.time;
    const { x, y, size: S, face } = this.petPlace(p);
    const flip = face * sp.facing;
    let alpha = 1;
    if (p.moveAt >= 0) alpha = Math.abs(t - p.moveAt - 0.5) * 2; // 換位置：淡出再淡入
    const interacting = p.interactAt >= 0 && sp.interact;
    const sheet = interacting ? /** @type {import('./assets.js').SpriteEntry} */ (sp.interact) : (sp.states[p.pose] ?? Object.values(sp.states)[0]);
    const time = interacting ? Math.min(t - p.interactAt, INTERACT_SEC - 0.01) : t + p.phase;

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.translate(x, y);
    // 影子
    ctx.beginPath();
    ctx.ellipse(0, -S * 0.01, S * 0.3, S * 0.04, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(60,30,10,.18)';
    ctx.fill();
    ctx.save();
    ctx.scale(flip, 1);
    ctx.translate(0, -S * (sp.anchorY - 0.5));
    drawSprite(ctx, sheet, S, time);
    ctx.restore();

    // 睡覺時冒出 z
    if (p.pose === 'sleep' && !interacting) {
      const k = (t * 0.6 + p.phase) % 1;
      ctx.globalAlpha *= Math.sin(k * Math.PI);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = 'rgba(80,50,30,.6)';
      ctx.lineWidth = 3;
      ctx.font = `700 ${Math.round(S * 0.12)}px sans-serif`;
      const zx = flip * S * (0.12 + k * 0.08), zy = -S * (0.38 + k * 0.18);
      ctx.strokeText('z', zx, zy);
      ctx.fillText('z', zx, zy);
    }
    // 互動愛心對話框（開始 0.2 秒後出現）
    if (interacting && this.assets.heartBubble && t - p.interactAt > 0.2) {
      const img = this.assets.heartBubble;
      const bw = S * (img.naturalWidth / 384);
      const bh = S * (img.naturalHeight / 384);
      const pop = Math.min(1, (t - p.interactAt - 0.2) * 6);
      const bx = flip > 0 ? -S / 2 + S * (250 / 384) : S / 2 - S * (250 / 384) - bw;
      const by = -S * sp.anchorY + S * (28 / 384);
      ctx.globalAlpha = 1;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, bx + bw * (1 - pop) / 2, by + bh * (1 - pop), bw * pop, bh * pop);
      ctx.imageSmoothingEnabled = true;
    }
    ctx.restore();
  }

  drawParticles() {
    const { ctx } = this;
    for (const p of this.particles) {
      const life = p.kind === 'heart' ? 1.4 : 1.8;
      const a = 1 - p.t / life;
      ctx.save();
      ctx.globalAlpha = Math.max(0, a);
      ctx.translate(p.x, p.y);
      if (p.kind === 'heart') {
        const s = 7 + p.t * 4;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(0, s * 0.35);
        ctx.bezierCurveTo(-s, -s * 0.3, -s * 0.5, -s, 0, -s * 0.45);
        ctx.bezierCurveTo(s * 0.5, -s, s, -s * 0.3, 0, s * 0.35);
        ctx.fill();
      } else {
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 6);
        g.addColorStop(0, hexA('#ffe9a8', 0.9));
        g.addColorStop(1, hexA('#ffd25e', 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  drawFloats() {
    const { ctx } = this;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '700 16px "Noto Sans TC", "PingFang TC", sans-serif';
    ctx.lineWidth = 3;
    for (const fl of this.floats) {
      ctx.globalAlpha = Math.max(0, 1 - fl.t / 1.6);
      ctx.strokeStyle = 'rgba(0,20,40,.7)';
      ctx.strokeText(fl.text, fl.x, fl.y);
      ctx.fillStyle = fl.color;
      ctx.fillText(fl.text, fl.x, fl.y);
    }
    ctx.restore();
  }

  // ===== 對外：特效與點擊 =====

  /** @param {number} x @param {number} y @param {string} text @param {string} [color] */
  floatText(x, y, text, color = '#ffd25e') {
    this.floats.push({ x, y, text, color, t: 0 });
  }

  /** @param {string} type @param {boolean} rewarded */
  petReact(type, rewarded) {
    const p = this.pets.get(type);
    if (!p) return null;
    const { x, y, size } = this.petPlace(p);
    const hasSprite = !!this.assets.pets[type] && p.spot >= 0;
    if (hasSprite) {
      p.interactAt = this.time;
      // 被摸醒了：之後改成坐著
      if (p.pose === 'sleep') { p.pose = 'sit'; p.poseUntil = this.time + 8 + Math.random() * 8; }
    } else {
      p.hop = 1;
      p.walking = false;
      p.nextChange = this.time + 2;
    }
    const n = rewarded ? (hasSprite ? 3 : 5) : (hasSprite ? 0 : 2);
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * size * 0.4,
        y: y - size * 0.45,
        vx: (Math.random() - 0.5) * 30,
        vy: -30 - Math.random() * 20,
        t: 0, kind: 'heart', color: '#ff7aa8',
      });
    }
    return { x, y: y - size * (hasSprite ? 0.72 : 0.65) };
  }

  /**
   * @param {number} x @param {number} y
   * @returns {{kind:'fish', uid:number} | {kind:'pet', type:string} | null}
   */
  hitTest(x, y) {
    for (const p of this.pets.values()) {
      const pl = this.petPlace(p);
      const r = Math.max(pl.size * 0.3, 26);
      if (Math.hypot(x - pl.x, y - (pl.y - pl.size * 0.22)) < r) return { kind: 'pet', type: p.type };
    }
    /** @type {FishEnt|null} */
    let best = null;
    let bestD = Infinity;
    for (const f of this.fish.values()) {
      if (f.dying >= 0) continue;
      const d = Math.hypot(x - f.x, y - f.y);
      const r = Math.max(f.L * (this.assets.fish[f.species] ? 0.38 : 0.6), 24);
      if (d < r && d < bestD) { best = f; bestD = d; }
    }
    return best ? { kind: 'fish', uid: best.uid } : null;
  }
}

/** @param {number} v @param {number} a @param {number} b */
function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
