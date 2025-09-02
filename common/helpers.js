/* ---------- Helpers ---------- */
export const $ = s => document.querySelector(s);
export const qsa = s => document.querySelectorAll(s);
export const eId = s => document.getElementById(s);
export const $$ = s => Array.from(document.querySelectorAll(s));
export const maybe = s => document.querySelector(s) || null;
export function on(el, ev, fn){ if (el) el.addEventListener(ev, fn); return el; }
export function txt(el, s){ if (el) el.textContent = s; }
export function val(el){ return el ? el.value : ''; }
export function commaSplit(v){ return String(v||'').split(/,|\n|\r/).map(s=>s.trim()).filter(Boolean); }
export function lines(v){ return String(v||'').split(/\n|\r/).map(s=>s.trim()).filter(Boolean); }
export function titleCase(s){ return String(s||'').replace(/\w\S*/g, w=> w[0].toUpperCase()+w.slice(1).toLowerCase()); }
export function slugifyTag(s){ return String(s).trim().toLowerCase().replace(/\s+/g,'-'); }
export function escapeRegExp(str){ return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

export function setVal(target, v) { 
    const el = (typeof target === 'string') ? $(target) : target; 
    if (el) el.value = (v ?? '');
    return el; 
}

export function escapeHtml(v) {
  const s = String(v ?? '');
  const map = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;', '/':'&#x2F;', '`':'&#x60;', '=':'&#x3D;' };
  return s.replace(/[&<>"'`=\/]/g, ch => map[ch]);
}

export function when(ts){
    if(!Number.isFinite(ts)) return '';
    try{ return new Date(ts).toLocaleString(); }catch(e){ return ''; }
}