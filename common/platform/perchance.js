/** @type {import('./types.js').Platform} */

// platforms/perchance.js
// Provider for Perchance-backed lists/archetypes/AI.
// Returns plain JS arrays/objects (not JSON strings).

const _memo = new Map();
const memo = (k, fn) => _memo.has(k) ? _memo.get(k) : (_memo.set(k, fn()), _memo.get(k));

const slug = (s='') => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const toArray = (v) => Array.isArray(v) ? v : (v == null ? [] : String(v).split(/\r?\n+/));
const toNumArray = (v) => toArray(v).map(x => Number(x)).filter(n => Number.isFinite(n));

function normalizeList(raw) {
  // Accept: string[], string (newline), or objects with {value|label|name}|weight via "x|42"
  const arr = Array.isArray(raw) ? raw : String(raw ?? '').split(/\r?\n+/);
  const out = [];
  const seen = new Set();
  for (let item of arr) {
    if (!item && item !== 0) continue;
    if (typeof item === 'object' && item) item = item.value ?? item.label ?? item.name ?? '';
    let s = String(item).trim();
    if (!s) continue;
    // strip comments and weights like "foo|30"
    s = s.replace(/\s*#.*$/, '');
    s = s.split('|')[0].trim();
    if (!s || seen.has(s.toLowerCase())) continue;
    seen.add(s.toLowerCase());
    out.push(s);
  }
  return out;
}

function normalizeArchetype(a = {}, fallbackName = '') {
  const names = toArray(a.emotionNames).map(s => String(s).trim()).filter(Boolean);
  const weights = toNumArray(a.emotionWeights);
  return {
    id: a.id || slug(fallbackName),
    name: a.name || fallbackName || (a.id ? String(a.id) : ''),
    formality: Number(a.formality) || 0,
    sentenceLength: a.sentenceLength || 'medium',
    vocabulary: a.vocabulary || 'simple',
    disfluency: a.disfluency || 'off',
    emotionNames: names,
    emotionWeights: weights.slice(0, names.length),
    catchphrases: toArray(a.catchphrases).map(s => String(s).trim()).filter(Boolean),
    avoidList: toArray(a.avoidList).map(s => String(s).trim()).filter(Boolean),
    addressingStyle: a.addressingStyle || a.addressing || 'direct',
    repguardBurst: a.repguardBurst ?? 1,
    repguardDecay: a.repguardDecay ?? 6,
    repguardCooling: a.repguardCooling ?? 3
  };
}

// ---- Perchance bridges (customize if your page exposes different globals) ----
async function pcGetListRaw(name) {
  if (typeof globalThis.getPerchanceList === 'function') {
    const v = globalThis.getPerchanceList(name);
    return v?.then ? await v : v;
  }
  if (globalThis.__PC_LISTS__ && name in globalThis.__PC_LISTS__) {
    return globalThis.__PC_LISTS__[name];
  }
  console.warn('[perchance] list not found:', name);
  return [];
}

async function pcGetArchetypeRaw(name) {
  // Prefer a direct map by name; fallbacks are optional
  if (globalThis.__PC_ARCHETYPES__ && name in globalThis.__PC_ARCHETYPES__) {
    return globalThis.__PC_ARCHETYPES__[name];
  }
  if (typeof globalThis.getPerchanceArchetype === 'function') {
    const v = globalThis.getPerchanceArchetype(name);
    return v?.then ? await v : v;
  }
  console.warn('[perchance] archetype not found:', name);
  return null;
}

async function pcAIComplete({ prompt }) {
  if (globalThis.__PC_AI__?.complete) {
    return await globalThis.__PC_AI__.complete({ prompt });
  }
  if (typeof globalThis.perchanceAI === 'function') {
    return await globalThis.perchanceAI(prompt);
  }
  // Dev-friendly fallback
  return `[[PC AI MOCK]] ${String(prompt).slice(0, 200)}…`;
}

async function pcGetRandomName(gender) {

}

// ---- Platform implementation ----
export default {
  id: 'perchance',
  capabilities: { lists: true, ai: true },

  async getList(name) {
    return memo(`list:${name}`, async () => {
      const raw = await pcGetListRaw(name);
      return normalizeList(raw);
    });
  },

  getVoiceArchetypes() {
    return this.getList('voice_archetypes');
  },

  async getArchetype(name) {
    if (!name) return null;
    const raw = await pcGetArchetypeRaw(name);
    if (!raw) return null;
    return normalizeArchetype(raw, name);
  },

  aiComplete(opts) {
    return pcAIComplete(opts || {});
  },
  getRandomName(gender) {
    return pcGetRandomName(gender);
  }
};



