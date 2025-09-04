// handlers.js — event handlers + simple wiring
import { $, qsa, eId, on, maybe } from '../../common/helpers.js';
import { exportAll } from './storage.js';

export function wireTabs(){
    qsa('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
          if (tab.classList.contains('disabled')) return;
          qsa('.tab').forEach(t => {
            t.classList.remove('active'); t.setAttribute('aria-selected','false');
          });
          tab.classList.add('active'); tab.setAttribute('aria-selected','true');
          const target = tab.dataset.tab;
          qsa('.panel').forEach(p => p.style.display='none');
          const panel = eId('panel-'+target); if (panel) panel.style.display='';
        });
    });
}

export function bindEssentials({onName, onRole, onAge, onGender, onNSFW, onTraits, onGoalAdd, onTags, onRandName}) {
    on(maybe("#nameBox"), 'input', e => onName?.(e.target.value));
    on(maybe("#role"), 'input', e => onRole?.(e.target.value));
    on(maybe("#age"), 'input', e => onAge?.(e.target.value));
    on(maybe('#nsfw'), 'change', e => onNSFW?.(!!e.target.checked));

    qsa('input[name="gender"]').forEach(radio => {
        radio.addEventListener('change', e => { if(e.target.checked) onGender?.(e.target.value)});
    });

    on(maybe('#traits-add'), 'click', e => {e.preventDefault(); onTraits(maybe('#traits-input')?.value || '' ); });
    on(maybe('#traits-input'), 'keydown', e => { if(e.key === 'Enter' ) { e.preventDefault(); onTraits(maybe('#traits-input')?.value || '')}});
    on(maybe('#goal-add'), 'click', e => { e.preventDefault(); onGoalAdd?.(); });
    on(maybe('#tags-add'), 'click', e => {e.preventDefault(); onTags(maybe('#tags-input')?.value || '' ); });
    on(maybe('#tags-input'), 'keydown', e => { if(e.key === 'Enter' ) { e.preventDefault(); onTags(maybe('#tags-input')?.value || '')}});
    //on(maybe('#namerandom'), 'click', e => {e.preventDefault(); onRandName(maybe('#namerandom')?.value || '' ); });
}

export function bindAppearance({onSpecies,onBuild,onSkin,onHairStyle,onHairColor,onEyeColor,onEyeShape,onClothes,onMarks}) {
    on(maybe("#species"), 'input', e => onSpecies?.(e.target.value.trim()));

    on(maybe('#build'), 'input', e => onBuild?.(e.target.value.trim()));
    on(maybe('#skin'), 'input', e => onSkin?.(e.target.value.trim()));
    // Hair
    on(maybe('#hair-style'), 'input', e => onHairStyle?.(e.target.value.trim()));
    on(maybe('#hair-color'), 'input', e => onHairColor?.(e.target.value.trim()));
    // Eyes
    on(maybe('#eye-color'), 'input', e => onEyeColor?.(e.target.value.trim()));
    on(maybe('#eye-shape'), 'input', e => onEyeShape?.(e.target.value.trim()));
    // Clothing
    on(maybe('#clothes'), 'input', e => onClothes?.(e.target.value.trim()));

    on(maybe('#marks-add'), 'click', e => {e.preventDefault(); onMarks(maybe('#marks-input')?.value || '' ); });
    on(maybe('#marks-input'), 'keydown', e => { if(e.key === 'Enter' ) { e.preventDefault(); onMarks(maybe('#marks-input')?.value || '')}});
}

export function wireSavedBar() {
    const bar = $('#pw-savedbar');
    const toggle = $('#pw-saved-toggle');
    const content = $('#pw-saved-content');
    if (!bar || !toggle) return;

    const setCollapsed = (v)=>{
        bar.classList.toggle('collapsed', v);
        document.body.classList.toggle('pw-saved-open', !v);
        toggle.textContent = v ? '▲ Saved Characters' : '▼ Saved Characters';
        toggle.setAttribute('aria-expanded', String(!v));
        if (content) content.hidden = v;
        document.dispatchEvent(new CustomEvent('pw:saved:toggle', { detail: { collapsed: v }}));
    };

    toggle.addEventListener('click', ()=> setCollapsed(!bar.classList.contains('collapsed')));

    // Buttons -> events
    $('#pw-saved-refresh')?.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('pw:saved:refresh'));
    });
    $('#pw-saved-export')?.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('pw:saved:export'));
    });

    // Delegate edit & delete on row buttons
    const rows = $('#pw-saved-rows');
    rows && rows.addEventListener('click', (e)=>{
        const editBtn = e.target.closest('button[data-edit]');
        if (editBtn) {
            e.preventDefault();
            const id = editBtn.getAttribute('data-edit');
            if (id) document.dispatchEvent(new CustomEvent('pw:saved:edit', { detail: { id } }));
            return;
        }
        const delBtn = e.target.closest('button[data-del]');
        if (delBtn) {
            e.preventDefault();
            const id = delBtn.getAttribute('data-del');
            if (!id) return;
            if (!confirm('Delete this character?')) return;
            document.dispatchEvent(new CustomEvent('pw:saved:delete', { detail: { id } }));
        }
    });

    // Import
    const importBtn = $('#pw-saved-import');
    const importInput = $('#pw-saved-import-file');
    if (importBtn && importInput) {
        importBtn.addEventListener('click', () => importInput.click());
        importInput.addEventListener('change', (e) => {
            const f = e.target.files && e.target.files[0];
            if (f) document.dispatchEvent(new CustomEvent('pw:saved:import', { detail: { file: f } }));
            importInput.value = '';
        });
    }

    const exportBtn = $('#pw-saved-export');
    if (exportBtn) exportBtn.addEventListener('click', onExportClick);

    // Start collapsed by default
    setCollapsed(true);
}


// add or extend this near your other action binders
export function bindActions({ onSave, onClear } = {}) {
    on(maybe('#save'),  'click', e => { e.preventDefault(); onSave?.();  });
    on(maybe('#reset'), 'click', e => { e.preventDefault(); onClear?.(); });

    // optional: Ctrl/Cmd+S for save
    document.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
            e.preventDefault(); onSave?.();
        }
    });
}

async function onExportClick(e) {
    e.preventDefault();
    try {
        const bundle = await exportAll(); // { brand, type, version, exportedAt, characters: [...] }
        const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        const ts   = new Date().toISOString().replace(/[:.]/g, '-');
        a.href = url;
        a.download = `persona-characters-${ts}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (err) {
        console.error('Export failed:', err);
        alert('Export failed. Check console for details.');
    }
}

export function bindSpeech({
      onArchetype,
      onFormality,
      onSentenceLength,
      onVocabulary,
      onDisfluency,
      onEmotionName,
      onEmotionWeight,
      onCatchphrases,
      onAvoidList,
      onAddressing,
      onBurst,
      onDecay,
      onCooling
    } = {}) {
    // Archetype
    on(maybe('#voice-archetype'), 'change', e => onArchetype?.(e.target.value));

    // Sliders / numbers
    on(maybe('#voiceformality'), 'input', e => onFormality?.(Number(e.target.value)));
    on(maybe('#voice-burst'),    'input', e => onBurst?.(Math.max(1, Number(e.target.value)||0)));
    on(maybe('#voice-decay'),    'input', e => onDecay?.(Math.max(1, Number(e.target.value)||0)));
    on(maybe('#voice-cooling'),  'input', e => onCooling?.(Math.max(1, Number(e.target.value)||0)));

    // Radio groups
    qsa('input[name="voice-sentlen"]').forEach(r =>
        r.addEventListener('change', e => { if (e.target.checked) onSentenceLength?.(e.target.value); })
    );
    qsa('input[name="voice-vocab"]').forEach(r =>
        r.addEventListener('change', e => { if (e.target.checked) onVocabulary?.(e.target.value); })
    );
    qsa('input[name="voice-disf"]').forEach(r =>
        r.addEventListener('change', e => { if (e.target.checked) onDisfluency?.(e.target.value); })
    );

    // Emotions (1..3)
    for (let i = 1; i <= 3; i++) {
        on(maybe(`#voice-emotion-${i}`), 'input', e => onEmotionName?.(i - 1, e.target.value.trim()));
        on(maybe(`#voice-weight-${i}`), 'input', e => {
          const n = Math.max(0, Math.min(100, Number(e.target.value) || 0));
            onEmotionWeight?.(i - 1, n);
        });
    }

    // Textareas
    on(maybe('#voice-catchphrases'), 'input', e => onCatchphrases?.(e.target.value));
    on(maybe('#voice-avoid'),        'input', e => onAvoidList?.(e.target.value));

    // Selects
    on(maybe('#voice-addressing'), 'change', e => onAddressing?.(e.target.value));
}
