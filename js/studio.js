/* =========================
Character Editor — JS (Essentials + Appearance + Voice + Narrative + Relationships)
Safe to paste; guards on missing elements so it won’t explode if some tabs aren’t present.
========================= */

/* ---------- State ---------- */
const state = {
    gender: '', // 'male' | 'female' | 'non-binary' | ''
    name: '',
    age: null, // optional; required 18+ if NSFW enabled
    role: '',
    traits: [],
    goals: [],
    tags: [],
    appearance: {
        nsfwAllowed: false,
        species: '',
        build: '',
        skinTone: '',
        hairStyle: '',
        hairColor: '',
        eyeColor: '',
        eyeShape: '',
        clothingStyle: '',
        notableMarks: [],
        male: {
            facialHair: '',
            field: ''
        }, // field = nsfw-only
        female: {
            notes: '',
            field: ''
        } // field = nsfw-only
    },
    voice: {
        archetype: '',
        formality: '',
        sentenceLength: '', // 'short' | 'medium' | 'long'
        vocabulary: '', // 'simple' | 'neutral' | 'ornate'
        disfluency: '', // 'off' | 'subtle' | 'realistic'
        emotions: [{
                label: '',
                weight: ''
            },
            {
                label: '',
                weight: ''
            },
            {
                label: '',
                weight: ''
            }
        ],
        catchphrases: [],
        avoid: [''],
        addressing: 'direct',
        guardrails: {
            burstLimit: 2,
            decayTurns: 6,
            topicCooling: 3
        }
    },
    narrative: {
        logline: '',
        pillars: ['', '', ''],
        current: '',
        beats: {
            hook: '',
            complication: '',
            midpoint: '',
            crisis: '',
            resolution: ''
        },
        pov: 'Third person',
        tense: 'Present',
        redlines: []
    },
    relationships: [] // array of {person,type,role,affinity,trust,power,influence,history,status,last,boundaries[],promises[],redlines[],tags[]}
};

/* ---------- Helpers ---------- */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const maybe = s => document.querySelector(s) || null;

function on(el, ev, fn) {
    if (el) el.addEventListener(ev, fn);
    return el;
}

function txt(el, s) {
    if (el) el.textContent = s;
}

function val(el) {
    return el ? el.value : '';
}

function setval(el, v) {
    if (el) el.value = v;
}

function commaSplit(v) {
    return String(v || '').split(/,|\n|\r/).map(s => s.trim()).filter(Boolean);
}

function lines(v) {
    return String(v || '').split(/\n|\r/).map(s => s.trim()).filter(Boolean);
}

function titleCase(s) {
    return s.replace(/\w\S*/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

function slugifyTag(s) {
    return String(s).trim().toLowerCase().replace(/\s+/g, '-');
}

function escapeRegExp(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getVoiceSelect() {
    return document.getElementById('voice-archetype') || document.getElementById('voicearchetype');
}

function changeVoiceArchetype2() {
    const sel = getVoiceSelect();
    if (!sel) return;
    const id = sel.value;
    const cfg = (typeof voiceArchetype !== 'undefined' && voiceArchetype[id]) ? voiceArchetype[id] : null;
    if (!cfg) return;

    // Scalars (no array wrappers)
    const formality = Number(cfg.formality ?? 40);
    document.getElementById('voiceformality').value = formality;
    state.voice.formality = formality;

    // Radios
    const setRadio = (name, want) => {
        for (const el of document.getElementsByName(name)) {
            el.checked = (el.value === String(want));
            if (el.checked) return el.value;
        }
        return undefined;
    };
    state.voice.sentenceLength = setRadio('voice-sentlen', String(cfg.sentenceLength || 'medium')) || '';
    state.voice.vocabulary = setRadio('voice-vocab', String(cfg.vocabulary || 'neutral')) || '';
    // normalize disfluency since some configs used "moderate"
    const disf = (cfg.disfluency === 'moderate') ? 'realistic' : String(cfg.disfluency || 'off');
    state.voice.disfluency = setRadio('voice-disf', disf) || disf;

    // Emotions (names + weights)
    const names = (cfg.emotionNames?.selectAll || []).slice(0, 3);
    const weights = (cfg.emotionWeights?.selectAll || []).slice(0, 3).map(n => Number(n || 0));
    const eIDs = ['voice-emotion-1', 'voice-emotion-2', 'voice-emotion-3'];
    const wIDs = ['voice-weight-1', 'voice-weight-2', 'voice-weight-3'];
    state.voice.emotions = [0, 1, 2].map(i => {
        const name = names[i] || '';
        const wt = Number.isFinite(weights[i]) ? weights[i] : 0;
        const e = document.getElementById(eIDs[i]);
        if (e) e.value = name;
        const w = document.getElementById(wIDs[i]);
        if (w) w.value = wt;
        return {
            label: name,
            weight: wt
        };
    });

    // Catchphrases / avoid (textarea.value)
    const cpTA = document.getElementById('voice-catchphrases');
    if (cpTA) {
        cpTA.value = (cfg.catchphrases?.selectAll || []).join('\n');
    }
    state.voice.catchphrases = (cpTA?.value || '').split(/\r?\n/).filter(Boolean);

    const avTA = document.getElementById('voice-avoid');
    if (avTA) {
        avTA.value = (cfg.avoidList?.selectAll || []).join('\n');
    }
    state.voice.avoid = (avTA?.value || '').split(/\r?\n/).filter(Boolean);

    // Addressing style
    const addrSel = document.getElementById('voice-addressing');
    if (addrSel) {
        for (let i = 0; i < addrSel.options.length; i++) {
            addrSel.options[i].selected = (addrSel.options[i].value === String(cfg.addressingStyle || 'direct'));
        }
        state.voice.addressing = addrSel.value;
    }

    // Repetition guardrails
    const burst = Number(cfg.repguardBurst ?? 2);
    const decay = Number(cfg.repguardDecay ?? 6);
    const cool = Number(cfg.repguardCooling ?? 3);
    const bEl = document.getElementById('voice-burst');
    const dEl = document.getElementById('voice-decay');
    const cEl = document.getElementById('voice-cooling');
    if (bEl) bEl.value = burst;
    if (dEl) dEl.value = decay;
    if (cEl) cEl.value = cool;
    state.voice.guardrails = {
        burstLimit: burst,
        decayTurns: decay,
        topicCooling: cool
    };

    state.voice.archetype = id;
    if (typeof updatePreview === 'function') updatePreview();
}

// Wire it once DOM is ready
(function wireVoiceArchetype() {
    const sel = getVoiceSelect();
    if (!sel) return;
    sel.removeEventListener?.('change', changeVoiceArchetype2);
    sel.addEventListener('change', changeVoiceArchetype2);
})();

function changeVoiceArchetype() {
    let archetype = document.getElementById('voice-archetype').value;
    state.voice.archetype = archetype;

    document.getElementById('voiceformality').value = [voiceArchetype[archetype].formality];
    state.voice.formality = [voiceArchetype[archetype].formality];

    let sentLenEl = document.getElementsByName('voice-sentlen');
    for (i = 0; i < sentLenEl.length; i++) {
        if (sentLenEl[i].value == [voiceArchetype[archetype].sentenceLength]) {
            state.voice.sentenceLength = sentLenEl[i].value;
            sentLenEl[i].checked = true;
        }
    }
    let vocabEl = document.getElementsByName('voice-vocab');
    for (i = 0; i < vocabEl.length; i++) {
        if (vocabEl[i].value == [voiceArchetype[archetype].vocabulary]) {
            state.voice.vocabulary = vocabEl[i].value;
            vocabEl[i].checked = true;
        }
    }
    let disfEl = document.getElementsByName('voice-disf');
    for (i = 0; i < disfEl.length; i++) {
        if (disfEl[i].value == [voiceArchetype[archetype].disfluency]) {
            state.voice.disfluency = disfEl[i].value;
            disfEl[i].checked = true;
        }
    }

    let emotionNames = voiceArchetype[archetype].emotionNames.selectAll.join("|").split("|");
    document.getElementById("voice-emotion-1").value = emotionNames[0];
    state.voice.emotions[0].label = emotionNames[0];
    document.getElementById("voice-emotion-2").value = emotionNames[1];
    state.voice.emotions[1].label = emotionNames[1];
    document.getElementById("voice-emotion-3").value = emotionNames[2];
    state.voice.emotions[2].label = emotionNames[2];

    let emotionWeights = voiceArchetype[archetype].emotionWeights.selectAll.join("|").split("|");
    document.getElementById("voice-weight-1").value = emotionWeights[0];
    state.voice.emotions[0].label = emotionNames[0];
    document.getElementById("voice-weight-2").value = emotionWeights[1];
    state.voice.emotions[1].label = emotionNames[1];
    document.getElementById("voice-weight-3").value = emotionWeights[2];
    state.voice.emotions[2].label = emotionNames[2];

    document.getElementById("voice-catchphrases").innerHTML = [voiceArchetype[archetype].catchphrases.selectAll.join("\n")];
    state.voice.catchphrases = lines(document.getElementById("voice-catchphrases").value);

    document.getElementById("voice-avoid").innerHTML = [voiceArchetype[archetype].avoidList.selectAll.join("\n")];
    state.voice.avoid = lines(document.getElementById("voice-avoid").value);

    //document.getElementById("voice-addressing")
    let addressingEl = document.getElementById("voice-addressing");
    for (i = 0; i < addressingEl.options.length; i++) {
        if (addressingEl.options[i].value == [voiceArchetype[archetype].addressingStyle]) {
            addressingEl.options[i].selected = true;
        }
    }

    document.getElementById("voice-burst").value = [voiceArchetype[archetype].repguardBurst];
    document.getElementById("voice-decay").value = [voiceArchetype[archetype].repguardDecay];
    document.getElementById("voice-cooling").value = [voiceArchetype[archetype].repguardCooling];
}

function renderChips(container, arr, onRemove) {
    if (!container) return;
    container.innerHTML = '';
    arr.forEach((txtVal, i) => {
        const chip = document.createElement('span');
        chip.className = 'chip';
        const label = document.createElement('span');
        label.textContent = txtVal;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.title = 'Remove';
        btn.setAttribute('aria-label', 'Remove ' + txtVal);
        btn.textContent = '×';
        btn.addEventListener('click', () => onRemove(i));
        btn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onRemove(i);
            }
        });
        chip.append(label, btn);
        container.appendChild(chip);
    });
}

function renderGoals() {
    const wrap = maybe('#goals-list');
    if (!wrap) return;
    wrap.textContent = '';
    state.goals.forEach((g, i) => {
        const row = document.createElement('div');
        row.className = 'goal';
        const input = document.createElement('input');
        input.type = 'text';
        input.value = g;
        input.placeholder = 'e.g., Convince captain to open the gate';
        input.addEventListener('input', e => {
            state.goals[i] = e.target.value;
            updatePreview();
        });
        input.addEventListener('blur', () => {
            if (!input.value.trim()) {
                state.goals.splice(i, 1);
                renderGoals();
                updatePreview();
            }
        });
        const up = document.createElement('button');
        up.className = 'btn move';
        up.type = 'button';
        up.textContent = '↑';
        const dn = document.createElement('button');
        dn.className = 'btn move';
        dn.type = 'button';
        dn.textContent = '↓';
        const rm = document.createElement('button');
        rm.className = 'btn move';
        rm.type = 'button';
        rm.textContent = '×';
        up.addEventListener('click', () => {
            if (i > 0) {
                [state.goals[i - 1], state.goals[i]] = [state.goals[i], state.goals[i - 1]];
                renderGoals();
                updatePreview();
            }
        });
        dn.addEventListener('click', () => {
            if (i < state.goals.length - 1) {
                [state.goals[i + 1], state.goals[i]] = [state.goals[i], state.goals[i + 1]];
                renderGoals();
                updatePreview();
            }
        });
        rm.addEventListener('click', () => {
            state.goals.splice(i, 1);
            renderGoals();
            updatePreview();
        });
        row.append(input, up, dn, rm);
        wrap.appendChild(row);
    });
}

function composeAppearanceLine(a) {
    let genderWord = '';
    if (state.gender === 'female') genderWord = 'woman';
    else if (state.gender === 'male') genderWord = 'man';
    else if (state.gender === 'non-binary') genderWord = 'person';

    const leadParts = [a.build, a.species, genderWord].filter(Boolean).join(' ').trim();
    const hairSeg = [a.hairStyle, a.hairColor ? a.hairColor + ' hair' : ''].filter(Boolean).join(' ');
    const eyeSeg = a.eyeColor ? a.eyeColor + ' eyes' : '';

    const tail = [];
    if (a.skinTone) tail.push(a.skinTone + ' skin');
    if (a.male.facialHair) tail.push(a.male.facialHair);

    let marksSeg = '';
    if (a.notableMarks && a.notableMarks.length) {
        const m = a.notableMarks.slice(0, 3);
        const last = m.pop();
        const joined = m.length ? m.join(', ') + ' and ' + last : last;
        marksSeg = 'notable for ' + joined;
    }
    const clothesSeg = a.clothingStyle ? 'typically wearing ' + a.clothingStyle : '';

    let s = '';
    if (leadParts) s += leadParts;
    if (hairSeg) s += (s ? ', ' : '') + hairSeg;
    if (eyeSeg) s += (s ? ', ' : '') + eyeSeg;
    if (tail.length) s += (s ? ', ' : '') + 'with ' + (tail.length === 1 ? tail[0] : tail.slice(0, -1).join(', ') + ' and ' + tail[tail.length - 1]);
    if (marksSeg) s += (s ? ', ' : '') + marksSeg;
    if (clothesSeg) s += (s ? ', ' : '') + clothesSeg;
    if (s && !/[.!?]$/.test(s)) s += '.';

    const MAX = 220;
    if (s.length > MAX && clothesSeg) {
        s = s.replace(new RegExp(',\\s*' + escapeRegExp(clothesSeg) + '\\.?$'), '').replace(/\.$/, '.');
    }
    if (s.length > MAX && marksSeg) {
        s = s.replace(/,\s*notable for [^.]+(?=\.|$)/, '');
    }
    return s || '(add details in Appearance tab)';
}

function voiceSummary(v) {
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

/* ---------- Narrative helpers ---------- */
function updateCanonFacts() {
    const facts = [];
    if (state.name) facts.push(`Name: ${state.name}`);
    if (state.role) facts.push(`Role: ${state.role}`);
    if (state.gender) facts.push(`Gender: ${state.gender}`);
    const a = state.appearance;
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

function narrativeSummary() {
    const n = state.narrative;
    if (n.logline) return n.logline;
    const beats = n.beats || {};
    const pieces = [beats.hook, beats.complication, beats.midpoint, beats.crisis, beats.resolution].filter(Boolean);
    if (pieces.length) return pieces.join(' • ');
    const pillars = (n.pillars || []).filter(Boolean);
    if (pillars.length) return 'Pillars: ' + pillars.join(' / ');
    return '—';
}

/* ---------- Relationships helpers ---------- */
function renderRelationships() {
    const list = maybe('#rel-list');
    if (!list) return;
    list.textContent = '';
    if (!state.relationships.length) {
        const p = document.createElement('p');
        p.className = 'hint';
        p.textContent = 'No relationships yet.';
        list.appendChild(p);
        updatePreview(); // keep side synced
        return;
    }
    state.relationships.forEach((r, idx) => {
        const row = document.createElement('div');
        row.className = 'goal'; // reuse simple flex row styling
        const label = document.createElement('div');
        label.style.flex = '1';
        label.textContent = `${r.person} — ${r.type}${r.role ? ' (' + r.role + ')' : ''} • Affinity ${r.affinity} • Trust ${r.trust}`;
        const del = document.createElement('button');
        del.className = 'btn move';
        del.type = 'button';
        del.textContent = '×';
        del.addEventListener('click', () => {
            state.relationships.splice(idx, 1);
            renderRelationships();
            updatePreview();
        });
        row.append(label, del);
        list.appendChild(row);
    });
    updatePreview();
}

function readRelationshipForm() {
    const r = {
        person: val(maybe('#rel-person')).trim(),
        type: val(maybe('#rel-type')),
        role: val(maybe('#rel-role')).trim(),
        affinity: Math.max(0, Math.min(100, parseInt(val(maybe('#rel-affinity')), 10) || 0)),
        trust: Math.max(0, Math.min(100, parseInt(val(maybe('#rel-trust')), 10) || 0)),
        power: val(maybe('#rel-power')),
        influence: Math.max(0, Math.min(100, parseInt(val(maybe('#rel-influence')), 10) || 0)),
        history: val(maybe('#rel-history')).trim(),
        status: val(maybe('#rel-status')),
        last: val(maybe('#rel-last')).trim(),
        boundaries: lines(val(maybe('#rel-boundaries'))),
        promises: lines(val(maybe('#rel-promises'))),
        redlines: lines(val(maybe('#rel-redlines'))),
        tags: commaSplit(val(maybe('#rel-tags')))
    };
    return r;
}

function clearRelationshipForm() {
    ['#rel-person', '#rel-role', '#rel-affinity', '#rel-trust', '#rel-history', '#rel-last', '#rel-boundaries', '#rel-promises', '#rel-redlines', '#rel-tags', '#rel-influence'].forEach(id => {
        const el = maybe(id);
        if (el) el.value = '';
    });
    setval(maybe('#rel-type'), 'Mentor');
    setval(maybe('#rel-status'), 'Active');
    setval(maybe('#rel-power'), 'Equal');
}

/* ---------- Preview + Status ---------- */
function updatePreview() {
    txt(maybe('#prev-name'), state.name || '(unnamed)');

    // Traits (≤3 shown)
    const shown = state.traits.slice(0, 3);
    const extra = state.traits.length - shown.length;
    txt(maybe('#prev-traits'), (shown.join(' • ') + (extra > 0 ? ' +' + extra : '')) || '—');

    // Goals (≤3)
    const ol = maybe('#prev-goals');
    if (ol) {
        ol.textContent = '';
        state.goals.slice(0, 3).forEach(g => {
            const li = document.createElement('li');
            li.textContent = g || '—';
            ol.appendChild(li);
        });
    }

    // Tags
    txt(maybe('#prev-tags'), state.tags.length ? state.tags.join(', ') : '—');

    // Appearance one-liner
    txt(maybe('#prev-appearance'), composeAppearanceLine(state.appearance));

    // Voice preview (if present)
    const pv = maybe('#prev-voice');
    if (pv) txt(pv, voiceSummary(state.voice) || '—');

    // Narrative preview (if present)
    const pn = maybe('#prev-narrative');
    if (pn) txt(pn, narrativeSummary());

    // Relationships preview (if present)
    const pr = maybe('#prev-rel');
    if (pr) {
        pr.textContent = '';
        if (!state.relationships.length) {
            const li = document.createElement('li');
            li.textContent = '—';
            pr.appendChild(li);
        } else {
            state.relationships.slice(0, 5).forEach(r => {
                const li = document.createElement('li');
                li.textContent = `${r.person} — ${r.type}${r.role ? ' (' + r.role + ')' : ''}`;
                pr.appendChild(li);
            });
        }
    }

    // Status & buttons
    const nameOk = Boolean(state.name && state.name.trim().length >= 2);
    const ageOk = !state.appearance.nsfwAllowed || (Number.isFinite(state.age) && state.age >= 18);
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
    if (ageInput) ageInput.classList.toggle('invalid', state.appearance.nsfwAllowed && !ageOk);

    // Keep canon facts in sync
    updateCanonFacts();
}

/* ---------- Tabs ---------- */
$$('.tab').forEach(tab => {
    on(tab, 'click', () => {
        if (tab.classList.contains('disabled')) return;
        $$('.tab').forEach(t => {
            t.classList.remove('active');
            t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        const target = tab.dataset.tab;
        $$('.panel').forEach(p => p.style.display = 'none');
        const panel = maybe('#panel-' + target);
        if (panel) panel.style.display = '';
    });
});

/* ---------- Essentials wiring ---------- */
$$('input[name="gender"]').forEach(el => {
    on(el, 'change', e => {
        state.gender = e.target.checked ? e.target.value : '';
        updatePreview();
    });
});

on(maybe('#nameBox'), 'input', e => {
    state.name = e.target.value.trim();
    updatePreview();
});

function mirrorNameBoxIntoState() {
    const el = maybe('#nameBox');
    if (el) el.dispatchEvent(new Event('input', { bubbles: true }));
}

// Random name (gender-aware)
const NAME_BANK = {
    male: ['Kaelen', 'Darius', 'Rowan', 'Jarek', 'Marcus', 'Theron', 'Alden', 'Lucan', 'Corin', 'Brennan', 'Silas', 'Garrick'],
    female: ['Seris', 'Maera', 'Liora', 'Anya', 'Kara', 'Mirel', 'Tamsin', 'Elara', 'Nyra', 'Sabine', 'Vera', 'Isolde'],
    neutral: ['Ash', 'Rei', 'Sage', 'Ryn', 'Vale', 'Ari', 'Noor', 'Kai', 'Ren', 'Sol', 'Quinn', 'Soren']
};

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)] || '';
}
on(maybe('#name-random'), 'click', e => {
    e.preventDefault();
    let pool = [];
    if (state.gender === 'male') pool = NAME_BANK.male;
    else if (state.gender === 'female') pool = NAME_BANK.female;
    else if (state.gender === 'non-binary') pool = NAME_BANK.neutral;
    else pool = NAME_BANK.male.concat(NAME_BANK.female, NAME_BANK.neutral);
    const n = pick(pool);
    if (n) {
        state.name = n;
        setval(maybe('#name'), n);
        updatePreview();
    }
});

// Age (optional globally; required 18+ if NSFW)
on(maybe('#age'), 'input', e => {
    const v = parseInt(e.target.value, 10);
    state.age = Number.isFinite(v) ? v : null;
    updatePreview();
});

// Role
on(maybe('#role'), 'input', e => {
    state.role = e.target.value;
});

// Traits chips
function addTraitsFromInput() {
    const raw = maybe('#traits-input');
    const parts = commaSplit(raw && raw.value).map(titleCase);
    for (const p of parts) {
        if (!p) continue;
        if (state.traits.length >= 5) break;
        if (!state.traits.some(t => t.toLowerCase() === p.toLowerCase())) state.traits.push(p);
    }
    if (raw) raw.value = '';
    renderChips(maybe('#traits-chips'), state.traits, (idx) => {
        state.traits.splice(idx, 1);
        renderChips(maybe('#traits-chips'), state.traits, () => {});
        updatePreview();
    });
    updatePreview();
}

on(maybe('#traits-add'), 'click', e => {
    e.preventDefault();
    addTraitsFromInput();
});
on(maybe('#traits-input'), 'keydown', e => {
    if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        addTraitsFromInput();
    }
    if (e.key === 'Backspace' && !e.target.value && state.traits.length) {
        state.traits.pop();
        renderChips(maybe('#traits-chips'), state.traits, () => {});
        updatePreview();
    }
});

// Goals
on(maybe('#goal-add'), 'click', e => {
    e.preventDefault();
    if (state.goals.length >= 3) return;
    state.goals.push('');
    renderGoals();
    updatePreview();
});

// Tags chips
function addTagsFromInput() {
    const raw = maybe('#tags-input');
    const parts = commaSplit(raw && raw.value).map(slugifyTag);
    for (const p of parts) {
        if (!p) continue;
        if (!state.tags.some(t => t.toLowerCase() === p.toLowerCase())) state.tags.push(p);
    }
    if (raw) raw.value = '';
    renderChips(maybe('#tags-chips'), state.tags, (idx) => {
        state.tags.splice(idx, 1);
        renderChips(maybe('#tags-chips'), state.tags, () => {});
        updatePreview();
    });
    updatePreview();
}
on(maybe('#tags-add'), 'click', e => {
    e.preventDefault();
    addTagsFromInput();
});
on(maybe('#tags-input'), 'keydown', e => {
    if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        addTagsFromInput();
    }
    if (e.key === 'Backspace' && !e.target.value && state.tags.length) {
        state.tags.pop();
        renderChips(maybe('#tags-chips'), state.tags, () => {});
        updatePreview();
    }
});

/* ---------- Appearance wiring ---------- */
function apSet(k, v) {
    state.appearance[k] = v;
    updatePreview();
}

function syncNSFWVisibility() {
    const maleRow = maybe('#male-nsfw-field-row');
    const femaleRow = maybe('#female-nsfw-field-row');
    if (maleRow) maleRow.style.display = state.appearance.nsfwAllowed ? '' : 'none';
    if (femaleRow) femaleRow.style.display = state.appearance.nsfwAllowed ? '' : 'none';

    const ageInput = maybe('#age');
    if (ageInput) ageInput.setAttribute('min', state.appearance.nsfwAllowed ? '18' : '0');

    const ageHint = maybe('#age-hint');
    if (ageHint) {
        ageHint.textContent = state.appearance.nsfwAllowed ?
            'Required (18+) because NSFW is enabled.' :
            'Optional. Required (18+) only when NSFW is enabled.';
    }
}

on(maybe('#nsfw'), 'change', e => {
    state.appearance.nsfwAllowed = !!e.target.checked;
    syncNSFWVisibility();
    updatePreview();
});

// Basics
on(maybe('#species'), 'input', e => apSet('species', e.target.value.trim()));
on(maybe('#build'), 'input', e => apSet('build', e.target.value.trim()));
on(maybe('#skin'), 'input', e => apSet('skinTone', e.target.value.trim()));
// Hair
on(maybe('#hair-style'), 'input', e => apSet('hairStyle', e.target.value.trim()));
on(maybe('#hair-color'), 'input', e => apSet('hairColor', e.target.value.trim()));
// Eyes
on(maybe('#eye-color'), 'input', e => apSet('eyeColor', e.target.value.trim()));
on(maybe('#eye-shape'), 'input', e => apSet('eyeShape', e.target.value.trim()));
// Clothing
on(maybe('#clothes'), 'input', e => apSet('clothingStyle', e.target.value.trim()));

// Notable marks chips
function addMarksFromInput() {
    const raw = maybe('#marks-input');
    const parts = commaSplit(raw && raw.value);
    for (const p of parts) {
        if (!p) continue;
        if (!state.appearance.notableMarks.some(x => x.toLowerCase() === p.toLowerCase()))
            state.appearance.notableMarks.push(p);
    }
    if (raw) raw.value = '';
    renderChips(maybe('#marks-chips'), state.appearance.notableMarks, (idx) => {
        state.appearance.notableMarks.splice(idx, 1);
        renderChips(maybe('#marks-chips'), state.appearance.notableMarks, () => {});
        updatePreview();
    });
    updatePreview();
}
on(maybe('#marks-add'), 'click', e => {
    e.preventDefault();
    addMarksFromInput();
});
on(maybe('#marks-input'), 'keydown', e => {
    if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        addMarksFromInput();
    }
    if (e.key === 'Backspace' && !e.target.value && state.appearance.notableMarks.length) {
        state.appearance.notableMarks.pop();
        renderChips(maybe('#marks-chips'), state.appearance.notableMarks, () => {});
        updatePreview();
    }
});

// Male / Female specifics
on(maybe('#male-facial-hair'), 'input', e => {
    state.appearance.male.facialHair = e.target.value.trim();
    updatePreview();
});
on(maybe('#male-field'), 'input', e => {
    state.appearance.male.field = e.target.value;
});
on(maybe('#female-notes'), 'input', e => {
    state.appearance.female.notes = e.target.value;
});
on(maybe('#female-field'), 'input', e => {
    state.appearance.female.field = e.target.value;
});

/* ---------- Voice wiring (binds only if Voice panel exists) ---------- */
function vSet(k, v) {
    state.voice[k] = v;
    updatePreview();
}

function vRadio(groupName, key) {
    $$(`input[name="${groupName}"]`).forEach(el => {
        on(el, 'change', e => {
            if (e.target.checked) vSet(key, e.target.value);
        });
    });
}
on(maybe('#voice-archetype'), 'change', e => vSet('archetype', e.target.value));
on(maybe('#voiceformality'), 'input', e => vSet('formality', parseInt(e.target.value, 10) || 0));
vRadio('voice-sentlen', 'sentenceLength');
vRadio('voice-vocab', 'vocabulary');
vRadio('voice-disf', 'disfluency');
// Emotions (up to 3)
function bindEmotion(i) {
    const li = maybe(`#voice-emotion-${i}`);
    const wi = maybe(`#voice-weight-${i}`);
    if (!li || !wi) return;
    if (!state.voice.emotions[i - 1]) state.voice.emotions[i - 1] = {
        label: '',
        weight: 0
    };
    on(li, 'input', e => {
        state.voice.emotions[i - 1].label = e.target.value.trim();
        updatePreview();
    });
    on(wi, 'input', e => {
        const n = parseInt(e.target.value, 10);
        state.voice.emotions[i - 1].weight = Number.isFinite(n) ? n : 0;
        updatePreview();
    });
}
bindEmotion(1);
bindEmotion(2);
bindEmotion(3);
on(maybe('#voice-catchphrases'), 'input', e => {
    state.voice.catchphrases = lines(e.target.value);
    updatePreview();
});
on(maybe('#voice-avoid'), 'input', e => {
    state.voice.avoid = lines(e.target.value);
    updatePreview();
});
on(maybe('#voice-addressing'), 'change', e => vSet('addressing', e.target.value));
on(maybe('#voice-burst'), 'input', e => {
    state.voice.guardrails.burstLimit = Math.max(1, parseInt(e.target.value, 10) || 1);
    updatePreview();
});
on(maybe('#voice-decay'), 'input', e => {
    state.voice.guardrails.decayTurns = Math.max(1, parseInt(e.target.value, 10) || 1);
    updatePreview();
});
on(maybe('#voice-cooling'), 'input', e => {
    state.voice.guardrails.topicCooling = Math.max(1, parseInt(e.target.value, 10) || 1);
    updatePreview();
});

/* ---------- Narrative wiring ---------- */
on(maybe('#narr-logline'), 'input', e => {
    state.narrative.logline = e.target.value;
    updateCanonFacts();
    updatePreview();
});
on(maybe('#narr-pillar-1'), 'input', e => {
    state.narrative.pillars[0] = e.target.value;
    updatePreview();
});
on(maybe('#narr-pillar-2'), 'input', e => {
    state.narrative.pillars[1] = e.target.value;
    updatePreview();
});
on(maybe('#narr-pillar-3'), 'input', e => {
    state.narrative.pillars[2] = e.target.value;
    updatePreview();
});
on(maybe('#narr-current'), 'input', e => {
    state.narrative.current = e.target.value;
    updatePreview();
});

on(maybe('#narr-beat-hook'), 'input', e => {
    state.narrative.beats.hook = e.target.value;
    updatePreview();
});
on(maybe('#narr-beat-complication'), 'input', e => {
    state.narrative.beats.complication = e.target.value;
    updatePreview();
});
on(maybe('#narr-beat-midpoint'), 'input', e => {
    state.narrative.beats.midpoint = e.target.value;
    updatePreview();
});
on(maybe('#narr-beat-crisis'), 'input', e => {
    state.narrative.beats.crisis = e.target.value;
    updatePreview();
});
on(maybe('#narr-beat-resolution'), 'input', e => {
    state.narrative.beats.resolution = e.target.value;
    updatePreview();
});

on(maybe('#narr-pov'), 'change', e => {
    state.narrative.pov = e.target.value;
    updatePreview();
});
on(maybe('#narr-tense'), 'change', e => {
    state.narrative.tense = e.target.value;
    updatePreview();
});
on(maybe('#narr-redlines'), 'input', e => {
    state.narrative.redlines = lines(e.target.value);
    updatePreview();
});

/* ---------- Relationships wiring ---------- */
on(maybe('#rel-add'), 'click', e => {
    e.preventDefault();
    const r = readRelationshipForm();
    if (!r.person) {
        alert('Person is required.');
        return;
    }
    // simple de-dupe by person+type
    if (!state.relationships.some(x => x.person.toLowerCase() === r.person.toLowerCase() && x.type === r.type)) {
        state.relationships.push(r);
    }
    renderRelationships();
    clearRelationshipForm();
});

on(maybe('#rel-clear'), 'click', e => {
    e.preventDefault();
    clearRelationshipForm();
});

// Keep preview list in sync if user is typing person live (optional sugar)
on(maybe('#rel-person'), 'input', () => {
    /* no-op; rely on add to commit */ });

// Make sure you have: <input type="hidden" id="char-id" />
// Save button already wired as: on(maybe('#save'),'click', ...)

// Replace your current save handler body with this:
on(maybe('#save'), 'click', async (e) => {
    e.preventDefault();
    const btn = e.currentTarget || maybe('#save');
    const prev = btn?.textContent;
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Saving…';
    }

    // helpers
    const now = () => Date.now();
    const newId = () => (crypto?.randomUUID ? crypto.randomUUID() : String(now()));

    try {
        await window.dbReady; // Dexie ready and schema loaded

        // --- ID policy ---
        // If #char-id has a value => update that record.
        // If empty OR Shift/Alt held => create a NEW record.
        const idEl = document.querySelector('#char-id');
        const forceNew = e.shiftKey || e.altKey || !!document.querySelector('#save-as-new:checked');
        let id = (forceNew ? '' : (idEl?.value || ''));

        if (!id) {
            id = newId(); // create
            if (idEl) idEl.value = id; // lock form to this record for further edits
            if (window.pwUpdateSaveLabel) window.pwUpdateSaveLabel();
        }

        // --- pull from your current state object (Essentials tab only) ---
        // (These are the exact properties your page keeps updated.)
        const name = state.name || '';
        const role = state.role || '';
        const gender = state.gender || '';

        // Age must be a finite number or null. NaN will trigger DataError on the 'age' index.
        const ageClean =
            (typeof state.age === 'number' && isFinite(state.age)) ? state.age :
            (state.age === '' || state.age == null) ? null : null;

        const traits = Array.isArray(state.traits) ? state.traits : [];
        const goals = Array.isArray(state.goals) ? state.goals : [];
        const tags = Array.isArray(state.tags) ? state.tags : [];

        // preserve createdAt if updating
        const existing = await db.characters.get(id);
        const rec = {
            id,
            name,
            role,
            gender,
            age: ageClean, // never NaN
            traits,
            goals,
            tags,
            voice: {
                archetype: state.voice?.archetype || 'custom',
                formality: Number(state.voice?.formality) || 0,
                sentenceLength: state.voice?.sentenceLength || 'medium',
                vocabulary: state.voice?.vocabulary || 'neutral',
                disfluency: state.voice?.disfluency || 'off',
                emotions: (state.voice?.emotions || [])
                .filter(e => e && e.label)
                .slice(0, 3)
                .map(e => ({ label: String(e.label), weight: Number(e.weight) || 0 })),
                catchphrases: (state.voice?.catchphrases || []).filter(Boolean),
                avoid: (state.voice?.avoid || []).filter(Boolean),
                addressing: state.voice?.addressing || 'direct',
                guardrails: {
                burstLimit: Math.max(1, Number(state.voice?.guardrails?.burstLimit) || 2),
                decayTurns: Math.max(1, Number(state.voice?.guardrails?.decayTurns) || 6),
                topicCooling: Math.max(1, Number(state.voice?.guardrails?.topicCooling) || 3),
                }
            },
            appearance: state.appearance || {},
            createdAt: existing?.createdAt || now(),
            updatedAt: now()
        };

        // IMPORTANT: use put (upsert) since we control the string PK 'id'
        await db.characters.put(rec);

        // refresh list panel if present
        if (typeof window.refreshCharacterList === 'function') window.refreshCharacterList();

        if (btn) btn.textContent = forceNew ? 'Saved as New ✓' : 'Saved ✓';
        console.log('[save] character saved:', rec);
    } catch (err) {
        console.error('Save failed:', err);
        alert('Failed to save character. Check console for details.');
        if (btn) btn.textContent = 'Error';
    } finally {
        if (btn) setTimeout(() => {
            btn.textContent = prev;
            btn.disabled = false;
        }, 900);
    }
    document.dispatchEvent(new CustomEvent('pw:saved-changed'));

});

on(maybe('#generate'), 'click', () => {
    alert('Generate: not implemented yet (AI call later).');
    console.log(state);
});


on(maybe('#copy-prompt'), 'click', async () => {
    const area = maybe('#prompt-preview');
    if (!area) return;
    try {
        await navigator.clipboard.writeText(area.value || area.textContent || '');
        alert('Prompt copied to clipboard.');
    } catch {
        alert('Could not copy. Select and copy manually.');
    }
});

/* ---------- Theme toggle (persisted) ---------- */
const THEME_KEY = 'characterEditorTheme';
const themeBtn = maybe('#theme-toggle');

function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem(THEME_KEY, t);
    if (themeBtn) themeBtn.textContent = t === 'dark' ? 'Light mode' : 'Dark mode';
}

(function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    const initial = saved || (document.documentElement.getAttribute('data-theme') || 'dark');
    applyTheme(initial);
})();

on(themeBtn, 'click', () => {
    const cur = document.documentElement.getAttribute('data-theme') || 'dark';
    applyTheme(cur === 'dark' ? 'light' : 'dark');
});

/* ---------- Initial render ---------- */
renderChips(maybe('#traits-chips'), state.traits, () => {});
renderChips(maybe('#tags-chips'), state.tags, () => {});
renderChips(maybe('#marks-chips'), state.appearance.notableMarks, () => {});
renderGoals();
renderRelationships();
syncNSFWVisibility();
updateCanonFacts();
updatePreview();

/* ===== Dexie schema: v1 (Essentials) + v2 (Appearance) ===== */
(function() {
    const DEXIE_URLS = [
        'https://unpkg.com/dexie@3.2.4/dist/dexie.min.js',
        'https://cdn.jsdelivr.net/npm/dexie@3.2.4/dist/dexie.min.js'
    ];

    function loadDexie() {
        if (window.Dexie) return Promise.resolve(window.Dexie);
        return new Promise((resolve, reject) => {
            (function tryNext(i) {
                if (i >= DEXIE_URLS.length) return reject(new Error('Dexie failed to load'));
                const s = document.createElement('script');
                s.src = DEXIE_URLS[i];
                s.async = true;
                s.onload = () => resolve(window.Dexie);
                s.onerror = () => tryNext(i + 1);
                document.head.appendChild(s);
            })(0);
        });
    }

    function defineDB(Dexie) {
        class CharacterDB extends Dexie {
            constructor() {
                super('perchance-essentials-db');

                // v1 — Essentials only
                this.version(1).stores({
                    characters: 'id, name, role, gender, age, *traits, *goals, *tags',
                    snapshots: '++id, characterId, createdAt'
                });

                // v2 — Add Appearance indexes (data is already stored; these make queries fast)
                // NOTE: You must restate the *full* index list for characters here.
                this.version(2).stores({
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
                    // snapshots unchanged; no need to restate
                });
            }
        }

        const db = new CharacterDB();
        window.db = db;
        window.Dexie = Dexie;
        return db;
    }

    window.dbReady = loadDexie().then(defineDB);
})();

(function(){
  const $ = (s)=>document.querySelector(s);

  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m])); }
  function when(ts){
    if(!Number.isFinite(ts)) return '';
    try{ return new Date(ts).toLocaleString(); }catch(e){ return ''; }
  }

  // Use existing DB if present; otherwise open minimal schema
  function getDB(){
    if (window.PWDB) return window.PWDB;
    if (window.db && typeof window.db.table === 'function') return window.db;
    if (window.Dexie) {
      try{
        const d = new Dexie('personaWorksDB');
        d.version(1).stores({ characters: 'id, name, updatedAt, *tags, appearanceSpecies' });
        return (window.PWDB = d);
      }catch(_){}
    }
    return null;
  }

  async function fetchChars(){
    // Wait for the app’s Dexie to be ready (your code sets window.dbReady)
    if (window.dbReady && !window.db) {
        try { await window.dbReady; } catch (e) {}
    }
    const db = getDB(); if (!db) return [];
    try {
        // Don’t orderBy('updatedAt') — it’s not indexed in your schema.
        const arr = await db.table('characters').toArray();
        // Sort newest first; tolerate missing timestamps.
        arr.sort((a,b)=> (b?.updatedAt||0) - (a?.updatedAt||0));
        return arr;
    } catch (_) {
        return [];
    }
    }

  async function refreshSaved(){
    const rows = $('#pw-saved-rows');
    const count = $('#pw-saved-count');
    if(!rows) return;
    rows.innerHTML = '';
    const list = await fetchChars();
    count && (count.textContent = String(list.length));
    for (const c of list) {
        const tr = document.createElement('tr');
        const species = (c.appearance && (c.appearance.species || c.appearanceSpecies)) || '';
        const tags    = Array.isArray(c.tags) ? c.tags.join(', ') : '';
        const age     = Number.isFinite(c.age) ? String(c.age) : '';
        const role    = c.role || '';
        const voice   = (c.voice && c.voice.archetype) ? c.voice.archetype : '';

        tr.innerHTML = `
            <td title="${escapeHtml(c.name || 'Unnamed')}">${escapeHtml(c.name || 'Unnamed')}</td>
            <td class="muted" style="text-align:right" title="${escapeHtml(age)}">${escapeHtml(age)}</td>
            <td class="muted" title="${escapeHtml(species)}">${escapeHtml(species)}</td>
            <td class="muted" title="${escapeHtml(role)}">${escapeHtml(role)}</td>
            <td class="muted" title="${escapeHtml(tags)}">${escapeHtml(tags)}</td>
            <td class="muted" title="${escapeHtml(voice)}">${escapeHtml(voice)}</td>
            <td class="muted" title="${when(c.updatedAt)}">${when(c.updatedAt)}</td>
            <td class="pw-actions">
            <button class="btn tiny" data-edit="${escapeHtml(c.id)}">Edit</button>
            <button class="btn tiny danger" data-del="${escapeHtml(c.id)}">Delete</button>
            </td>
        `;
        rows.appendChild(tr);
    }
  }

  async function deleteById(id){
    const db = getDB(); if(!db) return;
    try{ await db.table('characters').delete(id); }catch(_){}
    await refreshSaved();
  }
  document.addEventListener('pw:saved-changed', refreshSaved);
  function wireSavedBar(){
    const bar = $('#pw-savedbar');
    const toggle = $('#pw-saved-toggle');
    const content = $('#pw-saved-content');
    if(!bar || !toggle) return;

    const setCollapsed = (v)=>{
      bar.classList.toggle('collapsed', v);
      document.body.classList.toggle('pw-saved-open', !v);
      toggle.textContent = v ? '▲ Saved Characters' : '▼ Saved Characters';
      toggle.setAttribute('aria-expanded', String(!v));
      if(content) content.hidden = v;
    };

    toggle.addEventListener('click', ()=> setCollapsed(!bar.classList.contains('collapsed')));

    $('#pw-saved-refresh') && $('#pw-saved-refresh').addEventListener('click', refreshSaved);

    // NEW: export button
    const exportBtn = $('#pw-saved-export');
    if (exportBtn) exportBtn.addEventListener('click', exportAllSaved);

    // Delegate deletes
    const rows = $('#pw-saved-rows');
    rows && rows.addEventListener('click', (e)=>{
      const btn = e.target.closest('button[data-del]');
      if(!btn) return;
      const id = btn.getAttribute('data-del');
      if(id && confirm('Delete this character?')) deleteById(id);
    });

    // Import button -> hidden file input
    const importBtn = $('#pw-saved-import');
    const importInput = $('#pw-saved-import-file');
    if (importBtn && importInput) {
    importBtn.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', (e) => {
        const f = e.target.files && e.target.files[0];
        if (f) importBundleFile(f).finally(() => { importInput.value = ''; });
    });
    }

    // Keep the list fresh when data changes elsewhere
    document.addEventListener('pw:saved-changed', refreshSaved);

    // Start collapsed by default
    setCollapsed(true);

    // Refresh once DB is ready; otherwise do an immediate best-effort
    if (window.dbReady && typeof window.dbReady.then === 'function') {
        window.dbReady.then(()=> refreshSaved()).catch(()=> refreshSaved());
    } else {
        refreshSaved();
    }

  }

    function deepClone(obj){ return JSON.parse(JSON.stringify(obj || {})); }

    // Remove internal/denorm fields that must not ship in the bundle
    function sanitizeForExport(c){
    const x = deepClone(c);
    if (x.appearanceSpecies) delete x.appearanceSpecies;
    return x;
    }

    function downloadJSONFile(obj, filename){
        const blob = new Blob([JSON.stringify(obj, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    async function exportAllSaved(){
    // ensure DB is ready (plays nice with your existing dbReady)
    if (window.dbReady && !window.db) {
        try { await window.dbReady; } catch(e){}
    }
    const list = await fetchChars(); // existing helper from the saved bar
    if (!list || !list.length) {
        alert('No saved characters to export.');
        return;
    }
    const characters = list.map(sanitizeForExport);
    const bundle = {
        brand: 'PersonaWorks',
        type: 'personaworks.characters',
        version: 1,
        exportedAt: new Date().toISOString(),
        characters
    };
    const ts = new Date().toISOString().replace(/[:.]/g,'-');
    downloadJSONFile(bundle, `personaworks-characters-${ts}.json`);
    }

    // Accepts current + legacy bundle types
    var PW_BUNDLE_TYPE = 'personaworks.characters';
    var PW_LEGACY_TYPES = ['perchance.characters'];

    function isValidBundle(b){
    return b && (b.type === PW_BUNDLE_TYPE || PW_LEGACY_TYPES.includes(b.type))
            && Array.isArray(b.characters);
    }

    function deepClone(obj){ return JSON.parse(JSON.stringify(obj || {})); }

    // Normalize one character for DB, preserving createdAt if record exists
    async function normalizeForDB(c, db){
    const now = Date.now();
    const src = deepClone(c || {});
    const id  = String(src.id || ('id_' + now + Math.random().toString(36).slice(2,8)));
    const name = String(src.name || 'Unnamed');
    const appearance = src.appearance || {};
    const species = String(appearance.species || '').trim();

    // Preserve createdAt if already present in DB
    let createdAt = Number.isFinite(src.createdAt) ? src.createdAt : now;
    try {
        const existing = await db.table('characters').get(id);
        if (existing && Number.isFinite(existing.createdAt)) createdAt = existing.createdAt;
    } catch (_) {}

    // add denorm index field for queries (not exported)
    const appearanceSpecies = species ? species.toLowerCase() : undefined;

    return {
        ...src,
        id, name,
        appearance: { ...appearance, species },
        schemaVersion: (typeof src.schemaVersion === 'number') ? src.schemaVersion : 1,
        createdAt,
        updatedAt: now,
        appearanceSpecies
    };
    }

    async function importBundleFile(file){
    // wait for Dexie
    if (window.dbReady && !window.db) {
        try { await window.dbReady; } catch (_){}
    }
    const db = getDB();
    if (!db) { alert('Storage not available.'); return; }

    const text = await file.text();
    let json;
    try { json = JSON.parse(text); } catch (e) { alert('Invalid JSON.'); return; }

    if (!isValidBundle(json)) {
        alert('Wrong bundle type. Expecting personaworks.characters');
        return;
    }

    const chars = json.characters || [];
    if (!chars.length) { alert('Bundle has no characters.'); return; }

    let ok = 0, fail = 0;
    for (const c of chars) {
        try {
        const rec = await normalizeForDB(c, db);
        await db.table('characters').put(rec);
        ok++;
        } catch (e) {
        fail++;
        }
    }

    document.dispatchEvent(new CustomEvent('pw:saved-changed'));
        alert(`Imported ${ok} character(s)` + (fail ? `, ${fail} failed.` : '.'));
    }

    // Delegate edits & deletes
    const rows = $('#pw-saved-rows');
    rows && rows.addEventListener('click', (e)=>{
    const editBtn = e.target.closest('button[data-edit]');
    if (editBtn) {
        const id = editBtn.getAttribute('data-edit');
        if (id) editById(id);
        return;
    }
    const delBtn = e.target.closest('button[data-del]');
    if (delBtn) {
        const id = delBtn.getAttribute('data-del');
        if (id && confirm('Delete this character?')) deleteById(id);
    }
    });

    async function editById(id){
        const db = getDB(); if (!db) return;
        let rec = null;
        try { rec = await db.table('characters').get(id); } catch (_) {}
        if (!rec) { alert('Character not found.'); return; }

        // If your app exposes a loader, use it; otherwise emit an event for the editor to handle.
        if (typeof window.onEditSavedCharacter === 'function') {
            window.onEditSavedCharacter(rec);
        } else {
            document.dispatchEvent(new CustomEvent('pw:saved-edit', { detail: { record: rec } }));
        }

        // Optional: collapse the saved bar after edit to reveal the editor
        const bar = document.getElementById('pw-savedbar');
        if (bar && !bar.classList.contains('collapsed')) {
            bar.classList.add('collapsed');
            document.body.classList.remove('pw-saved-open');
            const toggle = document.getElementById('pw-saved-toggle');
            if (toggle) {
            toggle.textContent = '▲ Saved Characters';
            toggle.setAttribute('aria-expanded', 'false');
            }
            const content = document.getElementById('pw-saved-content');
            if (content) content.hidden = true;
        }
    }


    document.addEventListener('DOMContentLoaded', wireSavedBar);
})();

// --- Load a saved character into the editor (safe version) ---
(function () {
  const $  = (s)=>document.querySelector(s);
  const $$ = (s)=>Array.from(document.querySelectorAll(s));
  const maybe = (s)=>document.querySelector(s) || null;

  function ensureState(){
    if (!window.state) window.state = {};
    const s = window.state;
    if (!s.appearance) s.appearance = {};
    if (!s.voice) s.voice = {};
    if (!Array.isArray(s.tags)) s.tags = [];
    if (!Array.isArray(s.traits)) s.traits = [];
    if (!Array.isArray(s.goals)) s.goals = [];
    return s;
  }

  function setVal(sel, v){ const el = maybe(sel); if (el) el.value = (v ?? ''); }
  function setChecked(name, v){ $$(`input[name="${name}"]`).forEach(r => r.checked = (r.value === String(v||''))); }
  function ensureArr(x){ return Array.isArray(x) ? x.slice() : []; }
  function whenNum(n){ return Number.isFinite(n) ? String(n) : ''; }

  const renderChips   = window.renderChips   || function(){};
  const renderGoals   = window.renderGoals   || function(){};
  const updatePreview = window.updatePreview || function(){};

  function applyCharacterToEditor(rec){
  if (!rec) return;

  const $  = (s)=>document.querySelector(s);
  const $$ = (s)=>Array.from(document.querySelectorAll(s));
  const maybe = (s)=>document.querySelector(s) || null;
  const setVal = (sel, v)=>{ const el = maybe(sel); if (el) el.value = (v ?? ''); };
  const setChecked = (name, v)=> { $$(`input[name="${name}"]`).forEach(r => r.checked = (r.value === String(v||''))); };
  const ensureArr = (x)=> Array.isArray(x) ? x.slice() : [];

  // bind record id so Save updates this one
  setVal('#char-id', rec.id || '');

  // Essentials
  state.name   = rec.name   || '';
  state.role   = rec.role   || '';
  state.gender = rec.gender || '';
  state.age    = (typeof rec.age === 'number' && isFinite(rec.age)) ? rec.age : null;

  setVal('#name', state.name);
  setVal('#role', state.role);
  setChecked('gender', state.gender);
  setVal('#age', state.age != null ? String(state.age) : '');

  // Lists
  state.tags   = ensureArr(rec.tags);
  state.traits = ensureArr(rec.traits);
  state.goals  = ensureArr(rec.goals);

  (window.renderChips||(()=>{}))(maybe('#tags-chips'),   state.tags,   ()=>{});
  (window.renderChips||(()=>{}))(maybe('#traits-chips'), state.traits, ()=>{});
  (window.renderGoals||(()=>{}))();

  // Appearance
  const a = rec.appearance || {};
  state.appearance = Object.assign({}, state.appearance || {}, {
    nsfwAllowed:   !!a.nsfwAllowed,
    species:       a.species       || '',
    build:         a.build         || '',
    skinTone:      a.skinTone      || '',
    hairStyle:     a.hairStyle     || '',
    hairColor:     a.hairColor     || '',
    eyeColor:      a.eyeColor      || '',
    eyeShape:      a.eyeShape      || '',
    clothingStyle: a.clothingStyle || '',
    notableMarks:  ensureArr(a.notableMarks)
  });

  const nsfw = maybe('#nsfw'); if (nsfw) nsfw.checked = state.appearance.nsfwAllowed;
  setVal('#species',     state.appearance.species);
  setVal('#build',       state.appearance.build);
  setVal('#skin',        state.appearance.skinTone);
  setVal('#hair-style',  state.appearance.hairStyle);
  setVal('#hair-color',  state.appearance.hairColor);
  setVal('#eye-color',   state.appearance.eyeColor);
  setVal('#eye-shape',   state.appearance.eyeShape);
  setVal('#clothes',     state.appearance.clothingStyle);
  (window.renderChips||(()=>{}))(maybe('#marks-chips'), state.appearance.notableMarks, ()=>{});

  // Voice (if present)
  const v = rec.voice || {};
  state.voice = Object.assign({}, state.voice || {}, v);
  if (maybe('#voice-archetype')) {
    setVal('#voice-archetype', v.archetype || 'custom');
    if (typeof window.changeVoiceArchetype2 === 'function') window.changeVoiceArchetype2();
  }
  if (maybe('#voiceformality')) setVal('#voiceformality', Number.isFinite(v.formality) ? String(v.formality) : '40');

  // Make the change visible & recompute status text
  if (typeof window.updatePreview === 'function') window.updatePreview();

  // Enable Save in case it was disabled by validation
  const saveBtn = maybe('#save'); if (saveBtn) saveBtn.disabled = false;

  // Optional: focus name to show it populated
  const nameInput = maybe('#name'); if (nameInput) nameInput.blur(); // keep focus where it was

  if (typeof window.pwNotify === 'function') {
    window.pwNotify(`Loaded: ${state.name || 'Character'}`);
  }

  if (window.pwUpdateSaveLabel) window.pwUpdateSaveLabel();

}


  // Hook for the Saved bar "Edit" button
  window.onEditSavedCharacter = applyCharacterToEditor;
  document.addEventListener('pw:saved-edit', (e)=> applyCharacterToEditor(e.detail && e.detail.record));
})();

// Toast helper
(function(){
  let t = null;
  window.pwNotify = function(msg, opts={}){
    const el = document.getElementById('pw-toast');
    if (!el) return;
    el.textContent = String(msg || '');
    el.classList.add('show');
    clearTimeout(t);
    t = setTimeout(()=> el.classList.remove('show'), opts.ms || 2800);
  };
})();

// Save button label helper
(function(){
  function pwUpdateSaveLabel(){
    var save = document.getElementById('save');
    if (!save) return;
    var idInput = document.getElementById('char-id');
    var hasId = !!(idInput && idInput.value && idInput.value.trim());
    save.textContent = hasId ? 'Update' : 'Save New';
  }
  window.pwUpdateSaveLabel = pwUpdateSaveLabel;
  document.addEventListener('DOMContentLoaded', pwUpdateSaveLabel);
})();

// Clear/Reset form + state
(function(){
  const $  = (s)=>document.querySelector(s);
  const $$ = (s)=>Array.from(document.querySelectorAll(s));
  const maybe = (s)=>document.querySelector(s) || null;

  function setVal(sel, v){ const el = maybe(sel); if (el) el.value = (v ?? ''); }
  function setChecked(name, v){ $$(`input[name="${name}"]`).forEach(r => r.checked = (r.value === String(v||''))); }
  function render(listSel, arr){ if (typeof window.renderChips === 'function') renderChips(maybe(listSel), arr, ()=>{}); }

  function pwResetForm(ask=true){
    const hasAnything = !!(state.name || state.role || (state.tags && state.tags.length) || (state.traits && state.traits.length));
    if (ask && hasAnything && !confirm('Clear the form? Unsaved changes will be lost.')) return;

    // Clear id so future saves create a new record
    const idEl = $('#char-id'); if (idEl) idEl.value = '';

    // Essentials
    state.name = ''; state.role = ''; state.gender = ''; state.age = null;
    setVal('#name',''); setVal('#role',''); setChecked('gender',''); setVal('#age','');

    // Lists
    state.tags = []; state.traits = []; state.goals = [];
    render('#tags-chips',   state.tags);
    render('#traits-chips', state.traits);
    if (typeof window.renderGoals === 'function') renderGoals();

    // Appearance
    state.appearance = {
      nsfwAllowed: false, species:'', build:'', skinTone:'', hairStyle:'', hairColor:'',
      eyeColor:'', eyeShape:'', clothingStyle:'', notableMarks:[]
    };
    const nsfw = $('#nsfw'); if (nsfw) nsfw.checked = false;
    setVal('#species',''); setVal('#build',''); setVal('#skin','');
    setVal('#hair-style',''); setVal('#hair-color','');
    setVal('#eye-color','');  setVal('#eye-shape',''); setVal('#clothes','');
    render('#marks-chips', state.appearance.notableMarks);

    // Voice (minimal reset)
    state.voice = Object.assign({}, state.voice, { archetype: 'custom', formality: 40 });
    setVal('#voice-archetype','custom');
    setVal('#voiceformality','40');

    // Refresh UI bits
    if (typeof window.updatePreview === 'function') updatePreview();
    if (typeof window.pwUpdateSaveLabel === 'function') pwUpdateSaveLabel();
    if (typeof window.pwNotify === 'function') pwNotify('Form cleared. Ready for a new character.');
  }

  window.pwResetForm = pwResetForm;
  document.addEventListener('DOMContentLoaded', ()=>{
    const btn = $('#reset');
    if (btn) btn.addEventListener('click', ()=> pwResetForm(true));
  });
})();


