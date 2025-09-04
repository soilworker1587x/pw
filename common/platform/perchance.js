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

async function getVoiceDoc() {
    return memo('va:doc', async () => {
        const el = document.getElementById('voiceArchetype');
        const text = (el?.value ?? '').trim();
        const items = parseVoiceArchetypePC(text);
        
        const byId = new Map(items.map(a => [a.id, a]));
        const list = items.map(a => ({ id: a.id, name: a.name || a.id }));
        
        return { list, items, byId };
    });
}

function parseVoiceArchetypePC(text) {
  const records = text.split('|').map(r => r.trim()).filter(Boolean);
  return records.map(rec => {
    const obj = {};
    // split into key/value pairs
    const pairs = rec.split(/,(?=\w+:|[a-zA-Z]+=)/g); 
    // regex: split on commas only if followed by key:
    for (let pair of pairs) {
      let [k, v] = pair.split(/[:=]/); // handles id: / sentenceLength=
      k = k.trim(); v = (v ?? '').trim();

      switch (k) {
        case 'formality':
        case 'repguardBurst':
        case 'repguardDecay':
        case 'repguardCooling':
          obj[k] = Number(v);
          break;
        case 'emotionWeights':
          obj[k] = v ? v.split(',').map(n => Number(n.trim())) : [];
          break;
        case 'catchphrases':
        case 'avoidList':
          obj[k] = v ? v.split('+').map(s => s.trim()) : [];
          break;
        default:
          obj[k] = v;
      }
    }

    // Normalize into Stage/Studio shape
    return {
      id: obj.id,
      name: obj.name,
      formality: obj.formality,
      sentenceLength: obj.sentenceLength,
      vocabulary: obj.vocabulary,
      disfluency: obj.disfluency === 'off' ? 'none' : obj.disfluency,
      emotions: (obj.emotionNames || '').split(',').map((label, i) => ({
        label: label.trim(),
        weight: (obj.emotionWeights && obj.emotionWeights[i]) || 0
      })).filter(e => e.label),
      catchphrases: obj.catchphrases,
      avoidList: obj.avoidList,
      addressing: obj.addressingStyle,
      guardrails: {
        burstLimit: obj.repguardBurst,
        decayTurns: obj.repguardDecay,
        topicCooling: obj.repguardCooling
      }
    };
  });
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
        const doc = await getVoiceDoc();
        return doc.list;
    },

    async getVoiceArchetypes() {
        const doc = await getVoiceDoc();
        return doc.list;
    },

    async getArchetype(name) {
        if (!name) return null;
        const voiceDoc = await getVoiceDoc();
        return voiceDoc.byId.get(name) || null;
    },

    aiComplete(opts) {
        return pcAIComplete(opts || {});
    },
    getRandomName(gender) {
        return pcGetRandomName(gender);
    }
};



