
import { state, setSelected } from './state.js';
import { escapeHTML, el, qs, text, colorFor } from './ui.js';
import { currentSession } from './session.js';
import { buildKernelFromCharacter, buildChatPrompt, RECENT_TURNS_LIMIT } from './promptBuilder.js';


export function renderCharList(){
    const box = qs('#char-list'); if (!box) return;
    box.innerHTML = '';
    const q = (qs('#char-search')?.value || '').toLowerCase();

    const chars = state.characters.filter(c => {
      const hay = (c.name + ' ' + c.role + ' ' + (c.appearance.species || '') + ' ' + (c.tags || []).join(' ')).toLowerCase();
      return hay.includes(q);
    });

    if (!chars.length){
      box.appendChild(el('div', { class:'muted' }, [text('No characters. Import or Load Demo.')]));
      updateSelCount(); return;
    }

    for (const c of chars){
      const row = el('div', { class:'card char' });
      if (state.selectedCharId === c.id) row.style.outline = '1px solid var(--acc)';

      const pick = el('input', { type:'checkbox', class:'pick' });
      pick.checked = !!state.selected[c.id];
      pick.addEventListener('click', (ev) => { ev.stopPropagation(); setSelected(c.id, ev.currentTarget.checked); updateSelCount();});

      const left = el('div', { class:'info', style:'flex:1 1 auto;min-width:0' }, [
        el('div', { class:'name' }, [text(c.name)]),
        el('div', { class:'meta' }, [text((c.role || '-') + ' - ' + (c.appearance.species || '-'))]),
        el('div', {}, [
          ...c.tags.slice(0,4).map(t => el('span', { class:'chip' }, [text(t)])),
          ...(c.tags.length > 4 ? [el('span', { class:'muted' }, [text('+' + (c.tags.length - 4))])] : [])
        ])
      ]);

      const right = el('div', { class:'actions', style:'margin-left:auto;display:flex;align-items:center;gap:8px;white-space:nowrap' }, [
        el('button', { class:'btn small open-chat', 'data-id':c.id }, [text('Open')]),
        el('span', { class:'dot', style:'background:' + colorFor(c.id) })
      ]);

      row.addEventListener('click', () => selectCharacter(c.id));
      row.appendChild(el('div', { class:'rowwrap', style:'display:flex;align-items:flex-start;gap:8px;width:100%' }, [pick, left, right]));
      box.appendChild(row);
    }

    updateSelCount();
}

function updateSelCount(){
    const n = qs('#sel-count'); if (n) n.textContent = `${Object.keys(state.selected).length} selected`;
}

export function selectCharacter(id){
    state.selectedCharId = id;
    const c = state.characters.find(x => x.id === id);
    if (!c) return;

    const av = qs('#char-avatar'); if (av) av.textContent = (c.name || 'PC').slice(0,2).toUpperCase();
    const tt = qs('#char-title'); if (tt) tt.textContent = c.name;
    const sb = qs('#char-sub'); if (sb) sb.textContent = (c.role ? c.role + ' - ' : '') + (c.appearance.species || '-');

    const det = qs('#char-details');
    if (det){
      det.innerHTML =
        `<div><b>Role:</b> ${escapeHTML(c.role || '-')}</div>` +
        `<div><b>Gender:</b> ${escapeHTML(c.gender || '-')}</div>` +
        `<div><b>Age:</b> ${c.age == null ? '-' : String(Number(c.age))}</div>` +
        `<div><b>Species:</b> ${escapeHTML(c.appearance.species || '-')}</div>` +
        `<div><b>Traits:</b> ${escapeHTML((c.traits || []).join(', ') || '-')}</div>` +
        `<div><b>Tags:</b> ${((c.tags || []).map(t => `<span class="chip">${escapeHTML(t)}</span>`).join(' ') || '-')}</div>`;
    }

    const prev = qs('#prompt-wrap');
    if (prev){
      const sessPrev = currentSession();
      const hist = (sessPrev?.messages || []).slice(-RECENT_TURNS_LIMIT);
      const kernelPrev = buildKernelFromCharacter(c);
      prev.textContent = buildChatPrompt({ persona: kernelPrev, recentTurns: hist, userText: '(your next message here)' });
    }

    renderCharList();
}

export function renderTabs(){
    const bar = qs('#session-tabs'); if (!bar) return;
    bar.innerHTML = '';
    for (const s of state.sessions){
      let name = 'Group';
      if (!s.group){
        const c = state.characters.find(x => x.id === s.characterId);
        name = c ? c.name : '?';
      }
      const tab = el('div', { class:'tab' + (s.id === state.currentSessionId ? ' active' : ''), 'data-sid': s.id }, [text(name)]);
      const x = el('button', { class:'x', 'data-sid': s.id }, [text('x')]);
      tab.appendChild(x);
      bar.appendChild(tab);
    }
}

export function renderTranscript(){
    const box = qs('#transcript'); if (!box) return;
    box.innerHTML = '';
    const sess = currentSession();
    if (!sess){
      box.appendChild(el('div', { class:'muted' }, [text('No session. Click Start Chats.')]));
      return;
    }
    if (!sess.messages.length){
      box.appendChild(el('div', { class:'muted' }, [text('New session. Say hello!')]));
    }
    for (const m of sess.messages){
        const b = el('div', { class:'bubble ' + (m.role === 'user' ? 'user' : 'assistant') });
        //const name = (m.role === 'user') ? 'You' : (sess.group ? 'Assistant' : (state.characters.find(c => c.id === sess.characterId)?.name || 'Assistant'));
        //b.setAttribute('data-name', name);
        b.textContent = m.content;
        box.appendChild(b);
    }
    box.scrollTop = box.scrollHeight;
}

export function getParticipantNames(sess){
    const ids = sess?.participantIds || [];
    const out = [];
    for (const id of ids){
      const nm = state.characters.find(c => c.id === id)?.name || id;
      out.push(nm);
    }
    return out;
}

export function renderGroupHeader(sess){
    const names = getParticipantNames(sess);
    const av = qs('#char-avatar'); if (av) av.textContent = 'GR';
    const tt = qs('#char-title'); if (tt) tt.textContent = 'Group chat';
    const sb = qs('#char-sub');
    if (sb){
      let label = names.slice(0,2).join(', ');
      if (names.length > 2) label += ' +' + (names.length - 2);
      sb.textContent = label || '-';
    }
    const det = qs('#char-details');
    if (det){
      const chips = names.map(n => `<span class="chip">${escapeHTML(n)}</span> `).join('');
      det.innerHTML = `<div><b>Participants:</b> ${chips || '-'}</div>`;
    }
    const prev = qs('#prompt-wrap');
    if (prev) prev.textContent = 'Group session with participants: ' + (names.join(', ') || '-') + '.';
}