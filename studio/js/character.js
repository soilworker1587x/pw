import { maybe, escapeRegExp } from "../../common/helpers.js";

// character.js — model + helpers (v2)
export const CHARACTER_VERSION = 2;

export function emptyCharacter(){
  return {
    id: null, name:'', role:'', gender:'male', age:null,
    traits:[], goals:[], tags:[],
    appearance:{
      nsfwAllowed:false, species:'', build:'', skinTone:'',
      hairStyle:'', hairColor:'', eyeColor:'', eyeShape:'', clothingStyle:'',
      notableMarks: []
    },
    voice:{
      archetype:'', formality:0, sentenceLength:'', vocabulary:'', disfluency:'none',
      emotions:[{label:'',weight:0},{label:'',weight:0},{label:'',weight:0}],
      catchphrases:[], avoid:[], addressing:'neutral', guardrails: {burstLimit:2, decayTurns:3, topicCooling:2}
    },
    narrative:{ logline:'', pillars:['','',''] },
    relationships:[],
    createdAt:null, updatedAt:null
  };
}

export function cloneCharacter(c){ return structuredClone(c ?? emptyCharacter()); }

export function normalizeCharacter(partial={}){
  const now = Date.now();
  const c = { ...emptyCharacter(), ...partial };
  c.id ||= (crypto.randomUUID?.() || 'id_' + now.toString(36));
  c.gender = (['male','female','non-binary'].includes(c.gender)) ? c.gender : 'male';
  c.createdAt ||= now;
  c.updatedAt = now;
  c.traits = normList(c.traits);
  c.goals  = normList(c.goals);
  c.tags   = normList(c.tags);
  c.name = (c.name||'').trim();
  return c;
}

export function validateCharacter(c){
  const errors = [];
  if (!c.name) errors.push('name: required');
  if (c.age != null && (!Number.isFinite(c.age) || c.age < 0 || c.age > 500)) errors.push('age: out of range');
  return { ok: errors.length === 0, errors };
}

export function diffCharacters(a,b){ return JSON.stringify(a) !== JSON.stringify(b); }

function normList(v){ return (v||[]).map(s => String(s).trim()).filter(Boolean); }

export function composeAppearanceLine(input){
    
    const char = (input && input.appearance) ? input : { appearance: (input || {}), gender: input?.gender };
    const a = char.appearance || {};
    const gender = char.gender || '';

    let genderWord = gender==='female'?'woman':gender==='male'?'man':gender==='non-binary'?'person':'';

    const lead = [a.build, a.species, (a.build||a.species)?genderWord:'' ].filter(Boolean).join(' ').trim();
    const hair = (([a.hairStyle, a.hairColor].filter(Boolean).join(' ')) || '') && ([a.hairStyle, a.hairColor].filter(Boolean).join(' ') + ' hair');

    const eyes = a.eyeColor ? a.eyeColor + ' eyes' : '';

    const tail = [];
    if (a.skinTone) tail.push(a.skinTone + ' skin');
    if (a.male && a.male.facialHair) tail.push(a.male.facialHair);

    let marks = '';
    if (Array.isArray(a.notableMarks) && a.notableMarks.length){
        const m = a.notableMarks.slice(0,3);
        const last = m.pop();
        const joined = m.length ? m.join(', ') + ' and ' + last : last;
        marks = 'notable for ' + joined;
    }
    const clothes = a.clothingStyle ? 'typically wearing ' + a.clothingStyle : '';

    let s = '';
    if (lead) s += lead;
    if (hair) s += (s ? ', ' : '') + hair;
    if (eyes) s += (s ? ', ' : '') + eyes;
    if (tail.length) s += (s ? ', ' : '') + 'with ' + (tail.length === 1 ? tail[0] : tail.slice(0,-1).join(', ') + ' and ' + tail[tail.length-1]);
    if (marks) s += (s ? ', ' : '') + marks;
    if (clothes) s += (s ? ', ' : '') + clothes;
    if (s && !/[.!?]$/.test(s)) s += '.';

    const MAX = 220;
    if (s.length > MAX && clothes){
        s = s.replace(new RegExp(',\s*' + escapeRegExp(clothes) + '\.?$'), '').replace(/\.$/, '.');
    }
    if (s.length > MAX && marks){
        s = s.replace(/,\s*notable for [^.]+(?=\.|$)/, '');
    }
    return s || '(add details in Appearance tab)';
}

export function voiceSummary(v) {
    const emo = (v.emotions || []).filter(e => e.label).slice(0, 3).map(e => `${e.label} ${e.weight ?? 0}`);
    const bits = [
        v.archetype,
        `Formality ${v.formality}`,
        `Sentences: ${v.sentenceLength}`,
        `Vocab: ${v.vocabulary}`,
        `Disfluency: ${v.disfluency}`
    ];
    if (emo.length) bits.push('Tones: ' + emo.join(', '));
    return bits.filter(Boolean).join(' • ');
}

export function narrativeSummary(n) {
    if (n.logline) return n.logline;
    const beats = n.beats || {};
    const pieces = [beats.hook, beats.complication, beats.midpoint, beats.crisis, beats.resolution].filter(Boolean);
    if (pieces.length) return pieces.join(' • ');
    const pillars = (n.pillars || []).filter(Boolean);
    if (pillars.length) return 'Pillars: ' + pillars.join(' / ');
    return '—';
}

export function updateCanonFacts(c) {
    const facts = [];
    if (c.name) facts.push(`Name: ${c.name}`);
    if (c.role) facts.push(`Role: ${c.role}`);
    if (c.gender) facts.push(`Gender: ${c.gender}`);
    const a = c.appearance;
    if (a.species) facts.push(`Species: ${a.species}`);
    const hair = [a.hairStyle, a.hairColor && (a.hairColor + ' hair')].filter(Boolean).join(' ');
    if (hair) facts.push(`Hair: ${hair}`);
    const eyes = [a.eyeColor && (a.eyeColor + ' eyes'), a.eyeShape].filter(Boolean).join(', ');
    if (eyes) facts.push(`Eyes: ${eyes}`);
    if (a.skinTone) facts.push(`Skin: ${a.skinTone}`);
    if (a.clothingStyle) facts.push(`Clothing: ${a.clothingStyle}`);
    if (a.notableMarks.length) facts.push(`Marks: ${a.notableMarks.join(', ')}`);

    const ul = maybe('#narr-canon');
    if (ul) {
        ul.textContent = '';
        facts.forEach(f => {
            const li = document.createElement('li');
            li.textContent = f;
            ul.appendChild(li);
        });
    }
}