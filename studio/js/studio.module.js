// studio.module.js — orchestrator (state + wiring)
// Handlers stay dumb, render is DOM-only, this file owns state.

import { commaSplit, maybe, titleCase } from '../../common/helpers.js';
import { emptyCharacter, cloneCharacter } from './character.js';
import { getCharacter, saveCharacter, listCharacters, deleteCharacter } from './storage.js';
import { wireTabs, wireSavedBar, bindEssentials, bindAppearance, bindActions, bindSpeech} from './handlers.js';
import { hydrateEditor, setNameField, hydrateVoiceArchetypes as uiHydrateVoiceArchetypes, updateVoiceArchetype as uiUpdateVoiceArchetype, updatePreview } from './ui.js';
import { refreshSaved as paintSaved, renderChips, renderMarksChips, renderTraitsChips, renderGoals, syncNSFWVisibility } from './render.js';
import { platform } from '../../common/platform/platform.js';

export let original = emptyCharacter();
export let draft    = cloneCharacter(original);
let voiceBaseline = null;

function isDirty() {
    return JSON.stringify(draft) !== JSON.stringify(original);
}

// ---------- helpers ----------
function addFromComma(list, raw, mapFn = x => x) {
    let changed = false;
    for (const p of commaSplit(raw).map(mapFn)) {
        if (!p) continue;
        if (!list.some(x => String(x).toLowerCase() === p.toLowerCase())) {
            list.push(p);
            changed = true;
        }
    }
    return changed;
}

async function hydrateVoiceArchetypes() {
    const list = (await platform?.getVoiceArchetypes()) || [];
    const current = draft?.voice?.archetype || '';
    uiHydrateVoiceArchetypes(list, current, (val) => {
        draft.voice ??= {};
        draft.voice.archetype = val || '';
        updatePreview(draft);
    });
}

// call this when the dropdown changes AND after load()
export async function updateVoiceArchetype(name) {
    draft.voice ??= {};
    draft.voice.archetype = name || '';
    if (!name || !platform?.getArchetype) {
        uiUpdateVoiceArchetype(null);           // clear UI
        updatePreview(draft);
        return;
    }
    const a = await platform.getArchetype(name); // <- provider-normalized object
    if (!a) return;
    Object.assign(draft.voice, {
        formality: a.formality,
        sentenceLength: a.sentenceLength,
        vocabulary: a.vocabulary,
        disfluency: a.disfluency,
        emotionNames: a.emotionNames || [],
        emotionWeights: a.emotionWeights || [],
        catchphrases: a.catchphrases || [],
        avoidList: a.avoidList || [],
        addressingStyle: a.addressingStyle,
        repguardBurst: a.repguardBurst,
        repguardDecay: a.repguardDecay,
        repguardCooling: a.repguardCooling,
    });
    
    voiceBaseline = {
        id: draft.voice.archetype,
        formality: draft.voice.formality,
        sentenceLength: draft.voice.sentenceLength,
        vocabulary: draft.voice.vocabulary,
        disfluency: draft.voice.disfluency,
        emotionNames: [...(draft.voice.emotionNames||[])],
        emotionWeights: [...(draft.voice.emotionWeights||[])],
        catchphrases: [...(draft.voice.catchphrases||[])],
        avoidList: [...(draft.voice.avoidList||[])],
        addressingStyle: draft.voice.addressingStyle,
        repguardBurst: draft.voice.repguardBurst,
        repguardDecay: draft.voice.repguardDecay,
        repguardCooling: draft.voice.repguardCooling,
    };

    uiUpdateVoiceArchetype(a);                // let UI set inputs/labels, etc.
    updatePreview(draft);
}

function doClear() {
    // reset to a fresh record
    original = emptyCharacter();
    draft    = cloneCharacter(original);

    // clear any inline editors (e.g., goals)
    addingGoal = false; // if you used the goals editor flag

    // repaint UI
    hydrateEditor(draft);
    syncNSFWVisibility(!!draft.appearance.nsfwAllowed);
    refreshTraits(); 
    refreshTags(); 
    refreshMarks(); 
    refreshGoals();
    uiUpdateVoiceArchetype('');
    updatePreview(draft);
}

document.addEventListener('pw:saved:delete', async (e) => {
    const id = e.detail?.id;
    if (!id) return;
    await deleteCharacter(id);
    await refreshSavedList();
    // if the open record was deleted, reset the editor
    if (original?.id === id || draft?.id === id) await load();
});

document.addEventListener('pw:saved:edit', async (e) => {
    const id = e.detail?.id;
    if (!id) return;
    await load(id);                 // reuses existing load(id)
    // optional: jump to Essentials tab
    document.querySelector('.tab[data-tab="essentials"]')?.click();
});

async function refreshSavedList() {
    const list = await listCharacters({ sort: 'name:asc' }); // or your desired default
    paintSaved(list);
}

// keep your existing save(), then call it from onSave
async function doSave() {
    await save();             // your existing save() that upserts draft -> storage
    await refreshSavedList(); // repaint Saved
}

// ---------- stable refreshers ----------
const refreshTraits = () => renderTraitsChips(draft.traits, onRemoveTrait);

function onRemoveTrait(i) {
    draft.traits.splice(i, 1);
    refreshTraits();
    updatePreview(draft);
}

const refreshTags = () => renderChips(maybe('#tags-chips'), draft.tags, onRemoveTag);

function onRemoveTag(i) {
    draft.tags.splice(i, 1);
    refreshTags();
    updatePreview(draft);
}

const refreshMarks = () => renderMarksChips(draft.appearance.notableMarks, onRemoveMark);

function onRemoveMark(i) {
    draft.appearance.notableMarks.splice(i, 1);
    refreshMarks();
    updatePreview(draft);
}

// Goals: “Add” opens an inline editor row with Add/Cancel (and Enter/Escape)
let addingGoal = false;

const refreshGoals = () =>
    renderGoals(maybe('#goals-list'), draft.goals, {
        editing: addingGoal,
        onRemove: onRemoveGoal,
        onMove:   onMoveGoal,
        onCommit: onCommitGoal,
        onCancel: onCancelGoal
    });

function onRemoveGoal(i) {
    draft.goals.splice(i, 1);
    refreshGoals();
    updatePreview(draft);
}

function onMoveGoal(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= draft.goals.length) return;
    const [g] = draft.goals.splice(i, 1);
    draft.goals.splice(j, 0, g);
    refreshGoals();
    updatePreview(draft);
}

function onCommitGoal(text) {
    if (text && !draft.goals.includes(text)) draft.goals.push(text);
    addingGoal = false;
    refreshGoals();
    updatePreview(draft);
}

function onCancelGoal() {
    addingGoal = false;
    refreshGoals();
}

// ---------- load/save ----------
async function load(id) {
    original = (id ? await getCharacter(id) : emptyCharacter()) || emptyCharacter();
    draft = cloneCharacter(original);
    hydrateEditor(draft);
    await hydrateVoiceArchetypes();
    syncNSFWVisibility(!!draft.appearance.nsfwAllowed);
    updatePreview(draft);
    refreshTraits();
    refreshTags();
    refreshMarks();
    refreshGoals();


    const voices = await platform.getVoiceArchetypes();
}

async function save() {
    const saved = await saveCharacter(draft);
    original = cloneCharacter(saved);
    draft = cloneCharacter(saved);
}

function arraysEqual(a=[], b=[]) { return a.length===b.length && a.every((v,i)=>String(v)===String(b[i])); }

function isVoiceCustomized(v, base) {
    if (!base) return false;
    return (
        v.formality !== base.formality ||
        v.sentenceLength !== base.sentenceLength ||
        v.vocabulary !== base.vocabulary ||
        v.disfluency !== base.disfluency ||
        !arraysEqual(v.emotionNames, base.emotionNames) ||
        !arraysEqual(v.emotionWeights, base.emotionWeights) ||
        !arraysEqual(v.catchphrases, base.catchphrases) ||
        !arraysEqual(v.avoidList, base.avoidList) ||
        v.addressingStyle !== base.addressingStyle ||
        v.repguardBurst !== base.repguardBurst ||
        v.repguardDecay !== base.repguardDecay ||
        v.repguardCooling !== base.repguardCooling
    );
}

function maybeMarkVoiceCustom() {
    if (!isVoiceCustomized(draft.voice, voiceBaseline)) return;
    const sel = document.querySelector('#voice-archetype');
    if (sel && sel.value !== 'custom') {
        sel.value = 'custom';
        draft.voice.archetype = 'custom';   // sentinel; do not call getArchetype for this
    }
}

// ---------- boot ----------
document.addEventListener('DOMContentLoaded', () => {
    wireTabs();
    wireSavedBar();
    bindActions({ onSave: doSave, onClear: doClear });

    bindEssentials({
        onName:   v => { draft.name   = v; updatePreview(draft); },
        onRole:   v => { draft.role   = v; updatePreview(draft); },
        onAge:    v => { draft.age    = v ? Number(v) : null; updatePreview(draft); },
        onGender: v => { draft.gender = v; updatePreview(draft); },
        onNSFW:   v => { draft.appearance.nsfwAllowed = !!v; syncNSFWVisibility(!!v); updatePreview(draft); },

        onTraits: v => {
            if (addFromComma(draft.traits, v, titleCase)) {
                refreshTraits();
                updatePreview(draft);
            }
            const el = maybe('#traits-input'); if (el) el.value = '';
        },

        // New: “Add Goal” opens an editor row (no textbox needed in Essentials)
        onGoalAdd: () => {
            if (!addingGoal) { addingGoal = true; refreshGoals(); }
        },

        onTags: v => {
            if (addFromComma(draft.tags, v, titleCase)) {
                refreshTags();
                updatePreview(draft);
            }
            const el = maybe('#tags-input'); if (el) el.value = '';
        },
        onRandName: v => {
            platform.getRandomName(draft.gender).then(a => { 
                if(!a) return;
                draft.name = a; 
                setNameField(a);
                updatePreview(draft)
            });
        }
    });

    bindAppearance({
        onSpecies:   v => { draft.appearance.species       = v; updatePreview(draft); },
        onBuild:     v => { draft.appearance.build         = v; updatePreview(draft); },
        onSkin:      v => { draft.appearance.skinTone      = v; updatePreview(draft); },
        onHairStyle: v => { draft.appearance.hairStyle     = v; updatePreview(draft); },
        onHairColor: v => { draft.appearance.hairColor     = v; updatePreview(draft); },
        onEyeColor:  v => { draft.appearance.eyeColor      = v; updatePreview(draft); },
        onEyeShape:  v => { draft.appearance.eyeShape      = v; updatePreview(draft); },
        onClothes:   v => { draft.appearance.clothingStyle = v; updatePreview(draft); },

        onMarks: v => {
            if (addFromComma(draft.appearance.notableMarks, v, titleCase)) {
                refreshMarks();
                updatePreview(draft);
            }
            const el = maybe('#marks-input'); if (el) el.value = '';
        }
    });

    bindSpeech({
        onArchetype: v => { updateVoiceArchetype(v); }, 
        onFormality: v => { draft.voice.formality = v; maybeMarkVoiceCustom(); updatePreview(draft); },
        onSentenceLength: v => { draft.voice.sentenceLength = v; maybeMarkVoiceCustom(); updatePreview(draft); },
        onVocabulary: v => { draft.voice.vocabulary = v; maybeMarkVoiceCustom(); updatePreview(draft); },
        onDisfluency: v => { draft.voice.disfluency = v; maybeMarkVoiceCustom(); updatePreview(draft); },
        onEmotionName: (i, val) => { (draft.voice.emotionNames ||= [ '', '', '' ])[i] = val; maybeMarkVoiceCustom(); updatePreview(draft); },
        onEmotionWeight: (i, n) => { (draft.voice.emotionWeights ||= [ 0, 0, 0 ])[i] = n; maybeMarkVoiceCustom(); updatePreview(draft); },
        onCatchphrases: text => { draft.voice.catchphrases = text.split(/\r?\n/).filter(Boolean); maybeMarkVoiceCustom(); updatePreview(draft); },
        onAvoidList: text => { draft.voice.avoidList = text.split(/\r?\n/).filter(Boolean); maybeMarkVoiceCustom(); updatePreview(draft); },
        onAddressing: v => { draft.voice.addressingStyle = v; maybeMarkVoiceCustom(); updatePreview(draft); },
        onBurst: v => { draft.voice.repguardBurst = v; maybeMarkVoiceCustom(); updatePreview(draft); },
        onDecay: v => { draft.voice.repguardDecay = v; maybeMarkVoiceCustom(); updatePreview(draft); },
        onCooling: v => { draft.voice.repguardCooling = v; maybeMarkVoiceCustom(); updatePreview(draft); }
    });

    updatePreview(draft);
    refreshSavedList();

    load(); // initial character
    
});

export async function genRandomName() { 
    platform.getRandomName(draft.gender).then(a => { 
        if(!a) return;
        draft.name = a; 
        setNameField(a);
        updatePreview(draft)
    });
};

globalThis.generateName = () => genRandomName();