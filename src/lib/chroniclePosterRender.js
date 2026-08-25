/**
 * Canvas-based Chronicle poster renderer (3 design variants).
 * Single sans-serif type system + reserved footer so text never overlaps.
 */

const FONT =
  '"Segoe UI", "Helvetica Neue", Helvetica, Arial, "Noto Sans", sans-serif';

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function wrapText(ctx, text, maxWidth) {
  const words = String(text || '')
    .trim()
    .split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function setFont(ctx, weight, sizePx) {
  ctx.font = `${weight} ${Math.round(sizePx)}px ${FONT}`;
}

function drawChakra(ctx, cx, cy, r, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, r * 0.06);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 24; i += 1) {
    const a = (i / 24) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.12, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function drawTricolourBands(ctx, w, bandH) {
  const band = bandH / 3;
  ctx.fillStyle = '#FF671F';
  ctx.fillRect(0, 0, w, band);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, band, w, band);
  ctx.fillStyle = '#046A38';
  ctx.fillRect(0, band * 2, w, band);
}

function drawContainImage(ctx, img, x, y, maxW, maxH, radius = 12) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return { h: 0 };
  const scale = Math.min(maxW / iw, maxH / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = x + (maxW - dw) / 2;
  const dy = y + (maxH - dh) / 2;
  ctx.save();
  drawRoundedRect(ctx, dx, dy, dw, dh, radius);
  ctx.clip();
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
  ctx.save();
  drawRoundedRect(ctx, dx, dy, dw, dh, radius);
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.12)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  return { h: maxH };
}

function paintBackground(ctx, w, h, { styleId, color, designIndex, patriotic }) {
  if (patriotic && designIndex === 0) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#fff7ed');
    g.addColorStop(0.5, '#ffffff');
    g.addColorStop(1, '#ecfdf5');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    drawTricolourBands(ctx, w, h * 0.1);
    return;
  }
  if (patriotic && designIndex === 1) {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = color.primary;
    ctx.globalAlpha = 0.1;
    ctx.beginPath();
    ctx.arc(w * 0.88, h * 0.18, w * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = color.primary;
    ctx.fillRect(0, 0, 10, h);
    return;
  }
  if (patriotic && designIndex === 2) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#0f172a');
    g.addColorStop(1, '#1e3a5f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    return;
  }
  if (styleId === 'kids' || styleId === 'festive') {
    if (designIndex === 0) {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, color.primary);
      g.addColorStop(1, color.secondary);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    } else if (designIndex === 1) {
      ctx.fillStyle = '#fffbeb';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = color.primary;
      ctx.fillRect(0, 0, w, h * 0.14);
      ctx.fillRect(0, h * 0.86, w, h * 0.14);
    } else {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = color.primary;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(w * 0.15, h * 0.2, w * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    return;
  }
  if (styleId === 'elegant') {
    ctx.fillStyle = designIndex === 1 ? '#fafafa' : '#0f172a';
    ctx.fillRect(0, 0, w, h);
    if (designIndex !== 1) {
      ctx.fillStyle = color.primary;
      ctx.globalAlpha = 0.3;
      ctx.fillRect(0, h * 0.78, w, h * 0.22);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = color.primary;
      ctx.fillRect(w * 0.2, h * 0.08, w * 0.6, 4);
    }
    return;
  }
  // minimal
  if (designIndex === 2) {
    ctx.fillStyle = color.primary;
    ctx.fillRect(0, 0, w, h);
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = color.primary;
    ctx.fillRect(0, 0, w, h * 0.06);
    ctx.fillRect(0, h * 0.94, w, h * 0.06);
  }
}

function padSafe(w) {
  return Math.round(w * 0.07);
}

/**
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function renderChroniclePoster(options) {
  const {
    width,
    height,
    schoolName,
    title,
    message,
    dateLabel,
    logoSrc,
    attachmentSrcs = [],
    styleId = 'patriotic',
    color,
    designIndex = 0,
    emoji = '',
  } = options;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'center';

  const patriotic = styleId === 'patriotic';
  const lightKidsFestive = (styleId === 'kids' || styleId === 'festive') && designIndex === 1;
  const dark =
    ((patriotic && designIndex === 2) ||
      (styleId === 'elegant' && designIndex !== 1) ||
      (styleId === 'minimal' && designIndex === 2) ||
      ((styleId === 'kids' || styleId === 'festive') && designIndex !== 1)) &&
    !lightKidsFestive;

  paintBackground(ctx, width, height, { styleId, color, designIndex, patriotic });

  const pad = padSafe(width);
  const footerH = Math.round(height * 0.1);
  const contentBottom = height - footerH;
  const textColor = dark ? '#ffffff' : '#0f172a';
  const muted = dark ? 'rgba(255,255,255,0.88)' : '#334155';
  const accent = dark ? color.secondary || '#fb923c' : color.primary;

  const logo = await loadImage(logoSrc);
  const loadedAttachments = [];
  for (const src of (attachmentSrcs || []).slice(0, 5)) {
    const img = await loadImage(src);
    if (img) loadedAttachments.push(img);
  }

  // Vertical cursor — top of content (canvas y increases downward; fillText uses baseline)
  let y = pad + (patriotic && designIndex === 0 ? Math.round(height * 0.08) : 0);

  // Logo
  if (logo) {
    const logoSize = Math.round(Math.min(width, height) * 0.1);
    const lx = (width - logoSize) / 2;
    ctx.save();
    drawRoundedRect(ctx, lx - 8, y - 8, logoSize + 16, logoSize + 16, 18);
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.14)' : '#ffffff';
    ctx.fill();
    ctx.drawImage(logo, lx, y, logoSize, logoSize);
    ctx.restore();
    y += logoSize + Math.round(height * 0.028);
  }

  // School name
  const schoolSize = Math.round(width * 0.026);
  setFont(ctx, '600', schoolSize);
  ctx.fillStyle = muted;
  ctx.fillText(String(schoolName || 'School').toUpperCase(), width / 2, y + schoolSize);
  y += schoolSize + Math.round(height * 0.028);

  // Optional emoji (same font family size)
  if (emoji && designIndex !== 1) {
    const emSize = Math.round(width * 0.042);
    setFont(ctx, '500', emSize);
    ctx.fillText(emoji, width / 2, y + emSize * 0.85);
    y += emSize + Math.round(height * 0.02);
  }

  // Chakra for patriotic designs (side or small, never stealing title space badly)
  if (patriotic && designIndex === 0) {
    const r = width * 0.055;
    drawChakra(ctx, width / 2, y + r, r, color.accent || '#06038D');
    y += r * 2 + Math.round(height * 0.025);
  } else if (patriotic && designIndex === 2) {
    drawChakra(ctx, width * 0.82, height * 0.22, width * 0.09, 'rgba(255,255,255,0.28)');
  }

  // Title — same family, bold
  const titleSize = Math.round(width * (title.length > 28 ? 0.052 : 0.062));
  setFont(ctx, '800', titleSize);
  ctx.fillStyle = textColor;
  const titleLines = wrapText(ctx, String(title || '').toUpperCase(), width - pad * 2).slice(0, 3);
  for (const line of titleLines) {
    y += titleSize * 1.12;
    if (y > contentBottom - height * 0.25) break;
    ctx.fillText(line, width / 2, y);
  }
  y += Math.round(height * 0.022);

  // Accent rule
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(width * 0.38, y);
  ctx.lineTo(width * 0.62, y);
  ctx.stroke();
  y += Math.round(height * 0.03);

  // Attachments — wrap into rows of up to 3 for 4–5 images
  if (loadedAttachments.length && y < contentBottom - height * 0.28) {
    const gap = Math.round(width * 0.018);
    const count = loadedAttachments.length;
    const cols = count <= 3 ? count : Math.ceil(count / 2);
    const rows = Math.ceil(count / cols);
    const maxH = Math.round(height * (count === 1 ? 0.22 : rows > 1 ? 0.12 : 0.16));
    const avail = Math.max(60, contentBottom - y - height * 0.18);
    const boxH = Math.min(maxH, Math.floor(avail / rows) - gap);
    const boxW =
      cols === 1
        ? Math.min(width - pad * 2, width * 0.7)
        : (width - pad * 2 - gap * (cols - 1)) / cols;
    for (let r = 0; r < rows; r += 1) {
      const rowItems = loadedAttachments.slice(r * cols, r * cols + cols);
      const rowW = boxW * rowItems.length + gap * (rowItems.length - 1);
      let startX = (width - rowW) / 2;
      const rowY = y + r * (boxH + gap);
      for (let i = 0; i < rowItems.length; i += 1) {
        drawContainImage(ctx, rowItems[i], startX, rowY, boxW, boxH, 14);
        startX += boxW + gap;
      }
    }
    y += rows * boxH + (rows - 1) * gap + Math.round(height * 0.025);
  }

  // Message — clamp lines to remaining space above footer
  const msgSize = Math.round(width * 0.026);
  const lineH = msgSize * 1.4;
  const maxMsgLines = Math.max(2, Math.floor((contentBottom - y - 8) / lineH));
  setFont(ctx, '500', msgSize);
  ctx.fillStyle = muted;
  const msgLines = wrapText(ctx, message, width - pad * 2.1).slice(0, Math.min(5, maxMsgLines));
  for (const line of msgLines) {
    y += lineH;
    if (y > contentBottom - 4) break;
    ctx.fillText(line, width / 2, y);
  }

  // Date — reserved footer band (never overlaps body)
  if (dateLabel) {
    const footerY = height - Math.round(pad * 0.65);
    // soft footer plate on busy backgrounds
    if (dark || styleId === 'kids' || styleId === 'festive') {
      ctx.fillStyle = dark ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.55)';
      ctx.fillRect(0, height - footerH, width, footerH);
    }
    const dateSize = Math.round(width * 0.028);
    setFont(ctx, '700', dateSize);
    ctx.fillStyle = dark ? '#ffffff' : accent;
    ctx.fillText(String(dateLabel).toUpperCase(), width / 2, footerY);
  }

  return canvas;
}

export async function posterToBlob(canvas, type = 'image/png') {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, 0.92);
  });
}

export function posterToDataUrl(canvas) {
  return canvas.toDataURL('image/png');
}
