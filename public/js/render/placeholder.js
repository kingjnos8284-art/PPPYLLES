// @ts-check
/**
 * 占位圖：在正式美術到位前，用程式畫出可辨識的魚與寵物。
 * 所有圖形都以原點為中心、面向右方繪製。
 */

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../config/species.js').Species} sp
 * @param {number} L      魚身長度（px）
 * @param {number} t      時間（秒），用於擺尾
 * @param {{ silhouette?: boolean }} [opts]
 */
export function drawFishPlaceholder(ctx, sp, L, t, opts = {}) {
  const [c1, c2] = sp.colors;
  const sil = !!opts.silhouette;
  const body = sil ? 'rgba(5,20,35,.85)' : c1;
  const accent = sil ? 'rgba(5,20,35,.85)' : c2;

  if (sp.shape === 'jelly') {
    drawJelly(ctx, L, t, body, accent, sil);
    return;
  }

  const wag = Math.sin(t * 8) * 0.18;
  let rx = L * 0.42, ry = L * 0.2;
  if (sp.shape === 'tall') ry = L * 0.26;
  if (sp.shape === 'round') { rx = L * 0.4; ry = L * 0.36; }
  if (sp.shape === 'long') { rx = L * 0.48; ry = L * 0.12; }

  // 尾鰭
  ctx.save();
  ctx.translate(-rx * 0.85, 0);
  ctx.rotate(wag);
  ctx.beginPath();
  const tl = sp.shape === 'long' ? L * 0.16 : L * 0.3;
  const th = sp.id === 'betta' ? L * 0.34 : sp.id === 'guppy' ? L * 0.26 : L * 0.2;
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-tl * 0.6, -th * 0.4, -tl, -th);
  ctx.quadraticCurveTo(-tl * 0.75, 0, -tl, th);
  ctx.quadraticCurveTo(-tl * 0.6, th * 0.4, 0, 0);
  ctx.fillStyle = accent;
  ctx.globalAlpha = sil ? 1 : 0.9;
  ctx.fill();
  ctx.restore();

  // 背鰭／腹鰭
  ctx.beginPath();
  if (sp.shape === 'tall') {
    ctx.moveTo(-rx * 0.3, -ry * 0.8);
    ctx.quadraticCurveTo(-rx * 0.2, -ry * 2.6, -rx * 0.75, -ry * 2.2);
    ctx.lineTo(-rx * 0.6, -ry * 0.5);
    ctx.moveTo(-rx * 0.3, ry * 0.8);
    ctx.quadraticCurveTo(-rx * 0.2, ry * 2.6, -rx * 0.75, ry * 2.2);
    ctx.lineTo(-rx * 0.6, ry * 0.5);
  } else {
    const fin = sp.id === 'betta' ? 1.6 : 0.9;
    ctx.moveTo(rx * 0.2, -ry * 0.85);
    ctx.quadraticCurveTo(-rx * 0.2, -ry * (1 + fin), -rx * 0.6, -ry * 0.7);
    if (sp.id === 'betta') {
      ctx.moveTo(rx * 0.1, ry * 0.85);
      ctx.quadraticCurveTo(-rx * 0.3, ry * 2.4, -rx * 0.7, ry * 0.6);
    }
  }
  ctx.fillStyle = accent;
  ctx.globalAlpha = sil ? 1 : 0.75;
  ctx.fill();
  ctx.globalAlpha = 1;

  // 身體
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  if (sil) {
    ctx.fillStyle = body;
  } else {
    const g = ctx.createLinearGradient(0, -ry, 0, ry);
    g.addColorStop(0, shade(c1, 0.25));
    g.addColorStop(0.55, c1);
    g.addColorStop(1, shade(c1, -0.3));
    ctx.fillStyle = g;
  }
  ctx.fill();

  if (!sil) {
    // 花紋
    ctx.save();
    ctx.clip();
    ctx.fillStyle = c2;
    if (sp.id === 'clown') {
      for (const x of [0.45, -0.05, -0.5]) {
        ctx.fillRect(rx * x - L * 0.04, -ry, L * 0.08, ry * 2);
      }
    } else if (sp.id === 'neon') {
      ctx.globalAlpha = 0.95;
      ctx.fillRect(-rx, -ry * 0.25, rx * 1.8, ry * 0.35);
      ctx.fillStyle = '#ff4f6d';
      ctx.fillRect(-rx, ry * 0.15, rx * 0.9, ry * 0.6);
    } else if (sp.id === 'angel') {
      for (const x of [0.25, -0.15, -0.55]) {
        ctx.fillRect(rx * x - L * 0.025, -ry, L * 0.05, ry * 2);
      }
    } else if (sp.id === 'discus') {
      ctx.strokeStyle = c2;
      ctx.lineWidth = L * 0.035;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.ellipse(-rx * 0.1, 0, rx * (0.3 + i * 0.2), ry * (0.3 + i * 0.2), 0, -1.2, 1.2);
        ctx.stroke();
      }
    } else if (sp.shape === 'long') {
      ctx.globalAlpha = 0.35;
      for (let i = -4; i < 6; i++) {
        ctx.beginPath();
        ctx.arc(rx * i * 0.18, 0, ry * 0.5, 0, Math.PI * 2);
        ctx.strokeStyle = c2;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }
    ctx.restore();

    // 光澤
    ctx.beginPath();
    ctx.ellipse(rx * 0.1, -ry * 0.45, rx * 0.5, ry * 0.22, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    ctx.fill();

    // 眼睛
    const er = Math.max(1.6, L * 0.045);
    ctx.beginPath();
    ctx.arc(rx * 0.62, -ry * 0.18, er, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(rx * 0.65, -ry * 0.18, er * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = '#0b1522';
    ctx.fill();
  }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} L @param {number} t
 * @param {string} c1 @param {string} c2 @param {boolean} sil
 */
function drawJelly(ctx, L, t, c1, c2, sil) {
  // 水母面向上方，不受左右翻轉影響
  const pulse = 1 + Math.sin(t * 2.2) * 0.08;
  const r = L * 0.42;
  ctx.save();
  ctx.scale(1 / pulse, pulse);
  // 觸手
  ctx.strokeStyle = sil ? c1 : hexA(c2, 0.55);
  ctx.lineWidth = Math.max(1, L * 0.025);
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    const x0 = i * r * 0.22;
    ctx.moveTo(x0, 0);
    for (let k = 1; k <= 6; k++) {
      const y = k * L * 0.12;
      ctx.lineTo(x0 + Math.sin(t * 2 + k * 0.9 + i) * L * 0.05, y);
    }
    ctx.stroke();
  }
  // 傘
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.75, 0, Math.PI, 0);
  ctx.quadraticCurveTo(0, r * 0.18, -r, 0);
  if (sil) {
    ctx.fillStyle = c1;
  } else {
    const g = ctx.createRadialGradient(0, -r * 0.4, r * 0.1, 0, -r * 0.2, r);
    g.addColorStop(0, 'rgba(255,255,255,.75)');
    g.addColorStop(1, hexA(c1, 0.35));
    ctx.fillStyle = g;
  }
  ctx.fill();
  if (!sil) {
    // 四葉紋
    ctx.fillStyle = hexA(c2, 0.5);
    for (const a of [-0.9, -0.3, 0.3, 0.9]) {
      ctx.beginPath();
      ctx.arc(Math.sin(a) * r * 0.45, -r * 0.35, r * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/**
 * 陸地寵物占位圖（面向右、腳底在 y=0）
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../config/landpets.js').LandPetType} p
 * @param {number} S
 * @param {number} t
 * @param {boolean} walking
 */
export function drawLandPetPlaceholder(ctx, p, S, t, walking) {
  const step = walking ? Math.sin(t * 9) : 0;
  const bob = walking ? Math.abs(step) * S * 0.04 : Math.sin(t * 1.5) * S * 0.01;
  ctx.save();
  ctx.translate(0, -bob);

  // 影子
  ctx.beginPath();
  ctx.ellipse(0, bob, S * 0.45, S * 0.08, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,.22)';
  ctx.fill();

  if (p.shape === 'crab') {
    // 殼
    ctx.beginPath();
    ctx.arc(-S * 0.08, -S * 0.32, S * 0.3, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(-S * 0.15, -S * 0.42, 2, -S * 0.08, -S * 0.32, S * 0.3);
    g.addColorStop(0, '#fbe7c6'); g.addColorStop(1, '#c79a63');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(120,80,40,.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(-S * 0.08, -S * 0.32, S * 0.17, 0, Math.PI * 1.6); ctx.stroke();
    // 身體與腳
    ctx.strokeStyle = p.color; ctx.lineWidth = Math.max(2, S * 0.05); ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const a = step * (i % 2 ? 1 : -1) * 0.3;
      ctx.beginPath();
      ctx.moveTo(S * 0.12, -S * 0.12);
      ctx.lineTo(S * (0.2 + i * 0.06) + a * S * 0.1, 0);
      ctx.stroke();
    }
    ctx.beginPath(); ctx.ellipse(S * 0.2, -S * 0.16, S * 0.14, S * 0.1, 0, 0, Math.PI * 2);
    ctx.fillStyle = p.color; ctx.fill();
    // 鉗子
    ctx.beginPath(); ctx.arc(S * 0.38, -S * 0.2, S * 0.08, 0, Math.PI * 2); ctx.fill();
    // 眼
    ctx.strokeStyle = p.color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(S * 0.24, -S * 0.24); ctx.lineTo(S * 0.27, -S * 0.36); ctx.stroke();
    ctx.beginPath(); ctx.arc(S * 0.27, -S * 0.38, S * 0.035, 0, Math.PI * 2); ctx.fillStyle = '#111'; ctx.fill();
  } else if (p.shape === 'turtle') {
    ctx.fillStyle = '#c9b27a';
    for (const x of [-0.25, 0.2]) {
      ctx.beginPath(); ctx.ellipse(S * x + step * S * 0.03, -S * 0.06, S * 0.08, S * 0.08, 0, 0, Math.PI * 2); ctx.fill();
    }
    // 頭
    ctx.beginPath(); ctx.ellipse(S * 0.42, -S * 0.2, S * 0.12, S * 0.1, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(S * 0.47, -S * 0.23, S * 0.022, 0, Math.PI * 2); ctx.fillStyle = '#111'; ctx.fill();
    // 殼
    ctx.beginPath(); ctx.ellipse(0, -S * 0.18, S * 0.38, S * 0.24, 0, Math.PI, 0); ctx.closePath();
    const g = ctx.createLinearGradient(0, -S * 0.42, 0, -S * 0.1);
    g.addColorStop(0, shade(p.color, 0.2)); g.addColorStop(1, shade(p.color, -0.35));
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(30,60,30,.45)'; ctx.lineWidth = 2;
    for (const x of [-0.18, 0, 0.18]) {
      ctx.beginPath(); ctx.arc(S * x, -S * 0.27, S * 0.07, 0, Math.PI * 2); ctx.stroke();
    }
  } else {
    // 水豚
    ctx.fillStyle = shade(p.color, -0.2);
    for (const x of [-0.25, -0.1, 0.18, 0.3]) {
      ctx.fillRect(S * x + step * S * 0.02, -S * 0.12, S * 0.07, S * 0.12);
    }
    ctx.beginPath();
    roundRect(ctx, -S * 0.4, -S * 0.5, S * 0.72, S * 0.42, S * 0.2);
    const g = ctx.createLinearGradient(0, -S * 0.5, 0, -S * 0.08);
    g.addColorStop(0, shade(p.color, 0.15)); g.addColorStop(1, shade(p.color, -0.15));
    ctx.fillStyle = g; ctx.fill();
    ctx.beginPath();
    roundRect(ctx, S * 0.15, -S * 0.56, S * 0.32, S * 0.3, S * 0.12);
    ctx.fillStyle = p.color; ctx.fill();
    ctx.beginPath(); ctx.arc(S * 0.2, -S * 0.55, S * 0.05, 0, Math.PI * 2); ctx.fillStyle = shade(p.color, -0.3); ctx.fill();
    ctx.beginPath(); ctx.arc(S * 0.34, -S * 0.46, S * 0.025, 0, Math.PI * 2); ctx.fillStyle = '#111'; ctx.fill();
    ctx.beginPath(); ctx.arc(S * 0.46, -S * 0.36, S * 0.03, 0, Math.PI * 2); ctx.fillStyle = '#3a2618'; ctx.fill();
  }
  ctx.restore();
}

/** @param {CanvasRenderingContext2D} ctx */
function roundRect(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 調亮（正）或調暗（負） @param {string} hex @param {number} amt */
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = (/** @type {number} */ c) => Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt));
  r = f(r); g = f(g); b = f(b);
  return `rgb(${r},${g},${b})`;
}

/** @param {string} hex @param {number} a */
export function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
