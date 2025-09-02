import { qs } from "./ui.js";
import { state, BUNDLE_TYPE, BUNDLE_VERSION } from "./state.js";
import { renderCharList, renderTabs, selectCharacter } from "./render.js";

// Load saved or demo
export function loadSavedOrDemo() {
    try {
        const saved = localStorage.getItem('pw_chat_bundle');
        if (saved) importBundle(JSON.parse(saved), { filename: 'saved.json' });
        else loadDemo();
    } catch { 
        loadDemo(); 
    }
}

export function loadDemo() {
    const demo = {
      type: BUNDLE_TYPE,
      version: BUNDLE_VERSION,
      exportedAt: new Date().toISOString(),
      characters: [
        { id:'aria-001', name:'Aria Farwind', role:'Scout', gender:'female', age:27, traits:['brave','curious'], tags:['npc','riverfolk'], appearance:{ species:'elf' }, schemaVersion:1, createdAt:Date.now(), updatedAt:Date.now() },
        { id:'daren-002', name:'Daren Blackwood', role:'Quartermaster', gender:'male', age:33, traits:['pragmatic','dry humor'], tags:['guild','trusted'], appearance:{ species:'human' }, schemaVersion:1, createdAt:Date.now(), updatedAt:Date.now() },
        { id:'mira-003', name:'Mira Stoneveil', role:'Archivist', gender:'female', age:41, traits:['methodical','kind'], tags:['npc','library'], appearance:{ species:'dwarf' }, schemaVersion:1, createdAt:Date.now(), updatedAt:Date.now() },
        { id:'vex-004', name:'Vex Talon', role:'Smuggler', gender:'non-binary', age:29, traits:['witty','reckless'], tags:['underworld','pilot'], appearance:{ species:'tiefling' }, schemaVersion:1, createdAt:Date.now(), updatedAt:Date.now() }
      ]
    };
    importBundle(demo, { filename: 'demo.json' });
}

export function importBundle(bundle, meta) {
    meta = meta || {};
    if (!bundle || bundle.type !== BUNDLE_TYPE){ alert('Wrong bundle type'); return; }
    if (typeof bundle.version !== 'number' || bundle.version < 1){ alert('Unsupported bundle version'); return; }

    const chars = Array.isArray(bundle.characters) ? bundle.characters : [];
    const clean = (arr) => Array.isArray(arr) ? arr.map(x => String(x||'').trim()).filter(Boolean) : [];
    const num = (n) => (typeof n === 'number' && isFinite(n)) ? n : null;

    state.characters = chars.map(c => ({
      id: String(c.id || (String(Date.now()) + Math.random().toString(36).slice(2,8))),
      name: String(c.name || 'Unnamed Character'),
      role: String(c.role || ''),
      gender: String(c.gender || ''),
      age: num(c.age),
      traits: clean(c.traits),
      goals: clean(c.goals),
      tags: clean(c.tags),
      appearance: { species: String(c.appearance?.species || '') },
      schemaVersion: (typeof c.schemaVersion === 'number' ? c.schemaVersion : 1),
      createdAt: (typeof c.createdAt === 'number' ? c.createdAt : Date.now()),
      updatedAt: (typeof c.updatedAt === 'number' ? c.updatedAt : Date.now())
    }));

    state.bundleMeta = {
      exportedAt: bundle.exportedAt || new Date().toISOString(),
      filename: meta.filename || 'bundle.json',
      count: state.characters.length
    };

    try {
      localStorage.setItem('pw_chat_bundle', JSON.stringify({
        type: BUNDLE_TYPE, version: BUNDLE_VERSION,
        exportedAt: state.bundleMeta.exportedAt,
        characters: state.characters
      }));
    } catch {}

    const bi = qs('#bundle-info');
    if (bi) bi.textContent = `${state.bundleMeta.count} chars - ${state.bundleMeta.filename}`;

    state.selected = {};
    const searchBox = qs('#char-search');
    if (searchBox) searchBox.value = '';
    state.sessions = [];
    state.currentSessionId = null;
    renderCharList();
    if (state.characters.length) selectCharacter(state.characters[0].id);
    renderTabs();
}