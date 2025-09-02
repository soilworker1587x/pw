// render.js — pure-ish rendering helpers (DOM writes allowed)
import { $, maybe, escapeHtml, when } from '../../common/helpers.js';

export function renderChips(container, arr=[], onRemove){
    if (!container) return;
    container.innerHTML = '';
    for (let i=0;i<arr.length;i++){
        const chip = document.createElement('span'); 
        chip.className='chip';
        const label = document.createElement('span'); 
        label.textContent = arr[i];
        const btn = document.createElement('button'); 
        btn.type='button'; 
        btn.textContent='×'; 
        btn.title='Remove';
        btn.addEventListener('click', () => onRemove?.(i));
        chip.append(label, btn); 
        container.appendChild(chip);
    }
}

// render.js
export function renderGoals(container, goals = [], { onRemove, onMove, onCommit, onCancel, editing = false } = {}) {
      if (!container) return;
      container.innerHTML = '';
      const frag = document.createDocumentFragment();

      // normal rows
      for (let i = 0; i < goals.length; i++) {
          const row = document.createElement('div'); 
          row.className = 'goal';
          const label = document.createElement('div'); 
          label.className = 'goal-label'; 
          label.style.flex='1'; 
          label.textContent = goals[i];
          const actions = document.createElement('div'); 
          actions.className = 'goal-actions';
          const mk = (a,t) => { 
              const b=document.createElement('button'); 
              b.type='button'; 
              b.className='btn tiny'; b.dataset.action=a; b.dataset.index=String(i); b.textContent=t; return b; 
          };
          actions.append(mk('up','↑'), mk('down','↓'), mk('del','×'));
          row.append(label, actions); 
          frag.appendChild(row);
      }

      // editor row (for adding)
      if (editing) {
          const row = document.createElement('div'); 
          row.className = 'goal goal-edit';
          const input = document.createElement('input'); 
          input.type='text'; 
          input.placeholder='New goal…'; 
          input.className='goal-input'; 
          input.autofocus = true;
          const actions = document.createElement('div'); 
          actions.className = 'goal-actions';
          const add = document.createElement('button'); 
          add.type='button'; 
          add.className='btn tiny'; 
          add.dataset.action='commit'; 
          add.textContent='Add';
          const cancel = document.createElement('button'); 
          cancel.type='button'; 
          cancel.className='btn tiny'; 
          cancel.dataset.action='cancel'; 
          cancel.textContent='Cancel';
          actions.append(add, cancel);
          row.append(input, actions); 
          frag.appendChild(row);
      }

      container.appendChild(frag);

      // delegate once
      if (!container.__goalsDelegated) {
          container.__goalsDelegated = true;
          container.addEventListener('click', (e) => {
              const btn = e.target.closest('button[data-action]'); if (!btn) return;
              const a = btn.dataset.action, i = Number(btn.dataset.index);
              if (a === 'del') onRemove?.(i);
              else if (a === 'up') onMove?.(i, -1);
              else if (a === 'down') onMove?.(i, +1);
              else if (a === 'commit') {
                const val = container.querySelector('.goal-edit .goal-input')?.value?.trim() || '';
                if (val) onCommit?.(val);
              } else if (a === 'cancel') onCancel?.();
        });
        // Enter/Escape inside editor
        container.addEventListener('keydown', (e) => {
            if (!e.target.closest('.goal-edit')) return;
            if (e.key === 'Enter') { e.preventDefault(); 
              const v = e.target.closest('.goal-edit')?.querySelector('.goal-input')?.value?.trim()||''; if (v) onCommit?.(v); }
            else if (e.key === 'Escape') { e.preventDefault(); onCancel?.(); }
        });
    }
}

export async function refreshSaved(chars) {
    const rows = $('#pw-saved-rows');
    const count = $('#pw-saved-count');
    if(!rows) return;
    rows.innerHTML = '';
    count && (count.textContent = String(chars.length));
    for (const c of chars) {
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
            </td>`;
        rows.appendChild(tr);
    }
}

export function syncNSFWVisibility(nsfwAllowed, root = document){
    const maleRow   = maybe('#male-nsfw-field-row', root);
    const femaleRow = maybe('#female-nsfw-field-row', root);
    if (maleRow)   maleRow.style.display   = nsfwAllowed ? '' : 'none';
    if (femaleRow) femaleRow.style.display = nsfwAllowed ? '' : 'none';

    const ageInput = maybe('#age', root);
    if (ageInput) ageInput.setAttribute('min', nsfwAllowed ? '18' : '0');

    const ageHint = maybe('#age-hint', root);
    if (ageHint) {
        ageHint.textContent = nsfwAllowed ? 'Required (18+) because NSFW is enabled.' : 'Optional. Required (18+) only when NSFW is enabled.';
    }
}

export function renderMarksChips(marks, onRemove, root=document){
    renderChips(maybe('#marks-chips', root), marks, onRemove);
}

export function renderTraitsChips(traits, onRemove, root=document){
    renderChips(maybe('#traits-chips', root), traits, onRemove);
}

export function renderTagsChips(tags, onRemove, root=document) {
    renderChips(maybe('#tags-chips', root), tags, onRemove);
}

export function renderVoiceArchetype(archetype) {

}