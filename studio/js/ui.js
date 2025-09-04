// ui.js — orchestrator for Studio
import { $, txt, maybe } from '../../common/helpers.js';
import { emptyCharacter, composeAppearanceLine, voiceSummary, narrativeSummary, updateCanonFacts } from './character.js';

export function setNameField(value) {
    $('#nameBox').value = value;
}

export function hydrateEditor(c){
    const set = (sel,v)=>{ const el=document.querySelector(sel); if (el) el.value=(v??''); };
    const setChecked = (name,v)=> document.querySelectorAll(`input[name="${name}"]`).forEach(r=> r.checked=(r.value===String(v||'')));
    
    set('#char-id', c.id||'');
    syncSaveButtonLabel(); 
    set('#nameBox', c.name||'');
    set('#role', c.role||'');
    setChecked('gender', c.gender||'');
    set('#age', c.age!=null? String(c.age):'');
    // tags/traits/goals hydration left to render functions during typing
}

export function hydrateVoiceArchetypes(list, current, onChange) {
    const sel = $('#voice-archetype');
    if(!sel) return;
    sel.innerHTML = '';
    sel.append(new Option('-- Select Archetype --', ''));
    sel.append(new Option('Custom', 'custom'));
    for(const v of list) sel.append(new Option(v.name, v.id)) 
    sel.value = current || '';
    sel.onchange = e => onChange?.(e.target.value || '');
}

export function updateVoiceArchetype(a) {
    // When null/empty, clear the inputs
    const set = (sel, v) => { const el = document.querySelector(sel); if (el) el.value = v ?? ''; };

    if (!a) {
        set('#voiceformality','');
        ['#voice-emotion-1','#voice-emotion-2','#voice-emotion-3','#voice-weight-1','#voice-weight-2','#voice-weight-3']
          .forEach(s => set(s,''));
        set('#voice-catchphrases','');
        set('#voice-avoid','');
        return;
    }

    set('#voiceformality', a.formality);
    // radios/selects (ensure names/ids match your markup)
    document.querySelector(`input[name="voice-sentlen"][value="${a.sentenceLength}"]`)?.click();
    document.querySelector(`input[name="voice-vocab"][value="${a.vocabulary}"]`)?.click();
    document.querySelector(`input[name="voice-disf"][value="${a.disfluency}"]`)?.click();
    document.querySelector('#voice-addressing') && (document.querySelector('#voice-addressing').value = a.addressingStyle);

    // emotions 1..3
    (a.emotionNames||[]).forEach((n,i)=> set(`#voice-emotion-${i+1}`, n));
    (a.emotionWeights||[]).forEach((w,i)=> set(`#voice-weight-${i+1}`, w));

    // textareas (newline-joined)
    set('#voice-catchphrases', (a.catchphrases||[]).join('\n'));
    set('#voice-avoid', (a.avoidList||[]).join('\n'));
}

export function syncSaveButtonLabel() {
    const id  = document.querySelector('#char-id')?.value?.trim();
    const btn = document.querySelector('#save');
    if (!btn) return;
    const txt = id ? 'Update' : 'Save New';
    if (btn.textContent !== txt) btn.textContent = txt;
    btn.setAttribute('aria-label', txt);
}

export function updatePreview(character) {
    const c = character ?? emptyCharacter();

    txt(maybe('#prev-name'), c.name || '(unnamed)');

    // Traits (≤3 shown)
    const shown = c.traits.slice(0, 3);
    const extra = c.traits.length - shown.length;
    txt(maybe('#prev-traits'), (shown.join(' • ') + (extra > 0 ? ' +' + extra : '')) || '—');

    // Goals (≤3)
    const ol = maybe('#prev-goals');
    if (ol) {
        ol.textContent = '';
        c.goals.slice(0, 3).forEach(g => {
            const li = document.createElement('li');
            li.textContent = g || '—';
            ol.appendChild(li);
        });
    }

    // Tags
    txt(maybe('#prev-tags'), c.tags.length ? c.tags.join(', ') : '—');

    // Appearance one-liner
    txt(maybe('#prev-appearance'), composeAppearanceLine(c));

    // Voice preview (if present)
    const pv = maybe('#prev-voice');
    if (pv) txt(pv, voiceSummary(c.voice) || '—');

    // Narrative preview (if present)
    const pn = maybe('#prev-narrative');
    if (pn) txt(pn, narrativeSummary(c.narrative));

    // Relationships preview (if present)
    const pr = maybe('#prev-rel');
    if (pr) {
        pr.textContent = '';
        if (!c.relationships.length) {
            const li = document.createElement('li');
            li.textContent = '—';
            pr.appendChild(li);
        } else {
            c.relationships.slice(0, 5).forEach(r => {
                const li = document.createElement('li');
                li.textContent = `${r.person} — ${r.type}${r.role ? ' (' + r.role + ')' : ''}`;
                pr.appendChild(li);
            });
        }
    }

    // Status & buttons
    const nameOk = Boolean(c.name && c.name.trim().length >= 2);
    const ageOk = !c.appearance.nsfwAllowed || (Number.isFinite(c.age) && c.age >= 18);
    const ok = nameOk && ageOk;

    const msg = maybe('#status-msg');
    if (msg) {
        msg.textContent = ok ? 'Ready to save or generate.' : (!nameOk ? 'Name required.' : 'Age must be 18+ when NSFW is enabled.');
        msg.classList.toggle('status-ok', ok);
        msg.classList.toggle('status-warn', !ok);
    }

    const saveBtn = maybe('#save');
    const genBtn = maybe('#generate');
    if (saveBtn) saveBtn.disabled = !ok;
    if (genBtn) genBtn.disabled = !ok;

    const ageInput = maybe('#age');
    if (ageInput) ageInput.classList.toggle('invalid', c.appearance.nsfwAllowed && !ageOk);

    // Keep canon facts in sync
    updateCanonFacts(c);

    const lines = [];
    if (c.name) lines.push(`Name: ${c.name}`);
    if (c.role) lines.push(`Role: ${c.role}`);
    if (c.gender) lines.push(`Gender: ${c.gender}`);
    if (c.age!=null) lines.push(`Age: ${c.age}`);
    if (c.tags?.length) lines.push(`Tags: ${c.tags.join(', ')}`);
    //pre.textContent = lines.join('\n');
}

export function mirrorNameBoxIntoState() {
    const el = maybe('#nameBox');
    if (el) el.dispatchEvent(new Event('input', { bubbles: true }));
}

globalThis.mirrorNameBoxIntoState = () => mirrorNameBoxIntoState();