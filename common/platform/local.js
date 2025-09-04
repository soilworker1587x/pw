// platforms/local.js
// Local provider: lists & voice archetypes from ./data; AI is a simple sim.
// Returns plain JS arrays/objects (not JSON strings).

/** @type {import('./types.js').Platform} */

const _memo = new Map();
const memo = (k, fn) => _memo.has(k) ? _memo.get(k) : (_memo.set(k, fn()), _memo.get(k));

const slug = (s='') => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const toArray = (v) => Array.isArray(v) ? v : (v == null ? [] : String(v).split(/\r?\n+/));
const toNumArray = (v) => toArray(v).map(x => Number(x)).filter(Number.isFinite);

const dataBase =
  new URLSearchParams(location.search).get('data') ||
  document.querySelector('meta[name="pw-data-base"]')?.content ||
  (location.pathname.includes('/studio/') ? './data/' : './studio/data/');

const urlFor   = (rel) => new URL(`${dataBase}${rel}`, document.baseURI);
const fetchJSON = async (rel) => {
  const res = await fetch(urlFor(rel));
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${rel}`);
  return res.json();
};

// ---------- Normalizers ----------
function normalizeList(raw) {
    // Accept string[] or {list:[...]} or newline string; trim, drop empties, dedupe (case-insensitive).
    const arr = Array.isArray(raw) ? raw : (raw?.list ?? String(raw ?? '').split(/\r?\n+/));
    const out = [];
    const seen = new Set();
    for (let item of arr) {
        if (typeof item === 'object' && item) item = item.value ?? item.label ?? item.name ?? '';
        let s = String(item ?? '').trim();
        if (!s) continue;
        const key = s.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(s);
    }
    return out;
}

function normalizeArchetype(a = {}, fallbackName = '') {
    const names   = toArray(a.emotionNames).map(s => String(s).trim()).filter(Boolean);
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

// ---------- Centralized voice archetypes doc ----------
// Builds a stable in-memory shape from data/voice_archetypes.json.
//
// Returns:
// {
//   list: [{ id, name }, ...],    // for dropdown (unique by id; first occurrence order)
//   items: Archetype[],           // normalized archetypes (first occurrence order; last duplicate wins data)
//   byId: Map<string, Archetype>  // quick lookup by id
// }
async function getVoiceDoc() {
  return memo('va:doc', async () => {
    try {
      const data = await fetchJSON('voice_archetypes.json');

      // Helpers to collect with dedupe by id (last wins for data, first keeps order)
      const byId = new Map();
      const order = [];
      const upsert = (raw) => {
        const idRaw = String(raw?.id ?? '').trim();
        const nameRaw = String(raw?.name ?? idRaw).trim();
        if (!idRaw || !nameRaw) return;
        const id = idRaw; // id is authoritative (no slug transform for lookups)
        if (!byId.has(id)) order.push(id); // first occurrence defines order
        byId.set(id, normalizeArchetype(raw, nameRaw)); // last wins for data
      };

      if (Array.isArray(data)) {
        // Array of full objects [{id,name,...}, ...]
        for (const o of data) upsert(o);
      } else if (data && typeof data === 'object') {
        // Support { list: [...], items: { id: {...}, ... } } variant
        if (data.items && typeof data.items === 'object') {
          for (const o of Object.values(data.items)) upsert(o);
        }
        // If list is provided as names and items may be absent, still build minimal entries
        if (Array.isArray(data.list)) {
          for (const name of data.list) {
            const nm = String(name ?? '').trim();
            if (!nm) continue;
            const id = slug(nm);
            if (!byId.has(id)) {
              // Minimal record from name
              upsert({ id, name: nm });
            }
          }
        }
      }

      // Finalize shapes
      const items = order.map(id => byId.get(id)).filter(Boolean);
      const list  = order
        .map(id => {
          const a = byId.get(id);
          return a ? { id, name: a.name || id } : null;
        })
        .filter(Boolean);

      return { list, items, byId };
    } catch (e) {
      console.warn('[local] voice_archetypes.json not available:', e?.message || e);
      // Graceful empty doc
      return { list: [], items: [], byId: new Map() };
    }
  });
}

// Optional manual refresh (not exported by default)
// function refreshVoiceDoc() { _memo.delete('va:doc'); }

// ---------- Public API ----------
async function getList(name) {
    return memo(`list:${name}`, async () => {
        if (name === 'voice_archetypes') {
            const doc = await getVoiceDoc();
            return doc.list.slice(); // [{id,name}]
        }
        // Default behavior for other lists
        try {
            const raw = await fetchJSON(`${name}.json`);
            return normalizeList(raw); // string[]
        } catch (e) {
            console.warn('[local] list not found:', name, e?.message || e);
            return [];
        }
    });
}

async function getArchetype(id) {
    id = String(id || '').trim();
    if (!id) return null;
    const doc = await getVoiceDoc();
    return doc.byId.get(id) || null; // id-only lookup
}

async function aiComplete({ prompt }) {
    return `[[LOCAL SIM]] ${String(prompt || '').slice(0, 200)}…`;
}

function pick(arr) {
    return arr[Math.floor(Math.random()*arr.length)];
}

async function getRandomName(gender) {
    const g = (gender || '').toLowerCase();
    const pool = g === 'female' ? NAME_BANK.female
        : g === 'non-binary' ? NAME_BANK.neutral
        : NAME_BANK.male;
    return pick(pool) + ' ' + pick(NAME_BANK.last);
}

// Random name (gender-aware)
const NAME_BANK = {
    male: ['Kaelen','Darius','Rowan','Jarek','Marcus','Theron','Alden','Lucan','Corin','Brennan','Silas','Garrick','Liam','Noah','Oliver','Elijah','James','Benjamin','Lucas','Henry','Alexander','Ethan','William','Michael','Daniel','Jacob','Samuel','David','Joseph','Mateo','Jack','Leo'],
    female: ['Seris', 'Maera', 'Liora', 'Anya', 'Kara', 'Mirel', 'Tamsin', 'Elara', 'Nyra', 'Sabine', 'Vera', 'Isolde','Emma', 'Olivia', 'Ava', 'Sophia', 'Isabella', 'Mia', 'Amelia', 'Harper', 'Evelyn', 'Abigail', 'Emily', 'Ella', 'Elizabeth', 'Sofia', 'Avery', 'Charlotte', 'Grace', 'Chloe', 'Victoria', 'Lily'],
    neutral: ['Ash', 'Rei', 'Sage', 'Ryn', 'Vale', 'Ari', 'Noor', 'Kai', 'Ren', 'Sol', 'Quinn', 'Soren'],
    last: ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores'],
};

export default {
    id: 'local',
    capabilities: { lists: true, ai: true },
    getList,
    getVoiceArchetypes() { return getList('voice_archetypes'); },
    getArchetype,
    getRandomName,
    aiComplete
};
