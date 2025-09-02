// storage.js — DB layer (Dexie v2, no globals)
let _db = null;
let _ready = null;

function initDexie(){
  const Dexie = window?.Dexie;
  if (!Dexie) return null;
  const db = new Dexie('personaWorksDB');
  db.version(2).stores({
    characters: `
      id, name, role, gender, age, *traits, *goals, *tags,
      appearance.nsfwAllowed,
      appearance.species,
      appearance.build,
      appearance.skinTone,
      appearance.hairStyle,
      appearance.hairColor,
      appearance.eyeColor,
      appearance.eyeShape,
      appearance.clothingStyle
    `
  }).upgrade(tx =>
    tx.table('characters').toCollection().modify(rec => {
      rec.appearance ??= {};
      if (rec.appearanceSpecies && !rec.appearance.species) rec.appearance.species = rec.appearanceSpecies;
      rec.createdAt ??= Date.now();
      rec.updatedAt ??= rec.createdAt;
    })
  );
  return db;
}

async function ensureDB(){
  if (_ready) return _ready;
  _ready = (async () => (_db = initDexie()))();
  return _ready;
}

export async function listCharacters({ sort='name:desc' } = {}){
  await ensureDB(); if (!_db) return [];
  const arr = await _db.table('characters').toArray();
  
  //if (sort === 'name:desc') arr.sort((a,b)=>(b?.updatedAt||0)-(a?.updatedAt||0));
  return arr;
}

export async function getCharacter(id){
  await ensureDB(); if (!_db) return null;
  return _db.table('characters').get(id);
}

import { normalizeCharacter } from './character.js';
export async function saveCharacter(partial){
  await ensureDB(); if (!_db) return null;
  const rec = normalizeCharacter(partial);
  console.log(rec);
  await _db.table('characters').put(rec);
  return rec;
}

export async function deleteCharacter(id){
  await ensureDB(); if (!_db) return false;
  await _db.table('characters').delete(id);
  return true;
}

export async function exportAll(){
  const characters = await listCharacters();
  return { brand:'PersonaWorks', type:'personaworks.characters', version:1, exportedAt:new Date().toISOString(), characters };
}

export async function importBundle(src){
  await ensureDB(); if (!_db) return { ok:0, fail:0 };
  const data = typeof src === 'string' ? JSON.parse(src)
    : (src?.characters ? src : JSON.parse(await src.text?.()));
  let ok=0, fail=0;
  for (const rec of (data?.characters||[])){
    try { await _db.table('characters').put(rec); ok++; } catch { fail++; }
  }
  return { ok, fail };
}