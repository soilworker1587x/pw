
export const qs = (s) => document.querySelector(s);

export function el(tag, attrs, kids){
    const n = document.createElement(tag);
    attrs = attrs || {}; kids = kids || [];
    for (const k in attrs){
      if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
      const v = attrs[k];
      if (k === 'class') n.className = v;
      else if (k === 'html') n.innerHTML = v;
      else n.setAttribute(k, v);
    }
    if (!Array.isArray(kids)) kids = [kids];
    for (let i=0;i<kids.length;i++){
      const ch = kids[i];
      if (Array.isArray(ch)) ch.forEach(c => c && n.appendChild(c));
      else if (ch) n.appendChild(ch);
    }
    return n;
}

export const text = (s) => document.createTextNode(String(s));

export function escapeHTML(s){
    let out = String(s);
    out = out.split('&').join('&amp;');
    out = out.split('<').join('&lt;');
    out = out.split('>').join('&gt;');
    out = out.split('"').join('&quot;');
    return out;
}
    
export function updateTokenStats(used, max){
  try {
    const usedEl = document.getElementById('tok-used');
    const maxEl = document.getElementById('tok-max');
    const bar = document.getElementById('tokbar-fill');
    if (usedEl) usedEl.textContent = used || 0;
    if (maxEl) maxEl.textContent = max || 0;
    if (bar && max > 0){
      const pct = Math.max(0, Math.min(100, Math.round((used / max) * 100)));
      bar.style.width = pct + '%';
      bar.setAttribute('aria-valuenow', pct);
    }
  } catch {}
}

export function colorFor(id) {
    const idx = hashCode(String(id)) % COLOR_PALETTE_HASH.length;
    return COLOR_PALETTE_HASH[idx];
}

export const COLOR_PALETTE_HASH = Object.freeze(['#e57373', '#64b5f6', '#81c784', '#ffd54f', '#ba68c8', '#4db6ac', '#ff8a65', '#7986cb', '#a1887f', '#90a4ae']);

export function hashCode(str) {
    let h = 0; if (!str) return 0;
    for (let i = 0; i < str.length; i++) { const chr = str.charCodeAt(i); h = ((h << 5) - h) + chr; h |= 0; }
    return Math.abs(h);
}

