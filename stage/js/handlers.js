import { state, selectedIds } from "./state.js";
import { qs } from "./ui.js";
import { newSession, currentSession, currentSessionByChar, switchSession, closeSession, getSessionById } from "./session.js";
import { renderTranscript, renderCharList, getParticipantNames, renderTabs, renderGroupHeader, selectCharacter } from "./render.js";
import { RECENT_TURNS_LIMIT, buildChatPrompt, buildKernelFromCharacter, buildSystemPrompt } from "./promptBuilder.js";
import { loadDemo, importBundle } from "./dataIO.js";
import { dcEmit } from "./telemetry.js";

export function wireGlobalClicks() {
    // Global click delegation (preserved)
    document.addEventListener('click', (ev) => {
    const t = ev.target || ev.srcElement; if (!t) return;
    const closeBtn = t.closest?.('.x') || null;
    const tabEl = t.closest?.('.tab') || null;

    if (t.classList && t.classList.contains('open-chat')) {
        ev.preventDefault();
        const cid = t.getAttribute('data-id');
        if (cid){
            const existing = currentSessionByChar(cid);
            const sid = existing ? existing.id : newSession(cid);
            const {group, characterId } = switchSession(sid);
            renderTabs();
            renderTranscript();
            group ? renderGroupHeader(currentSession()) : (characterId && selectCharacter(characterId));
        }
        return;
    }

    if (closeBtn) {
        ev.preventDefault();
        const sid2 = closeBtn.getAttribute('data-sid');
        if (sid2) closeSession(sid2);
        renderTabs();
        renderTranscript();
        const s = currentSession();
        if (s) (s.group ? renderGroupHeader(s) : selectCharacter(s.characterId));
        return;
    }

    if (tabEl) {
        ev.preventDefault();
        const sid = tabEl.getAttribute('data-sid');
        if (sid) {
            const { group, characterId } = switchSession(sid);
            renderTabs();
            renderTranscript();
            group ? renderGroupHeader(currentSession()) : (characterId && selectCharacter(characterId));
        }
        return;
    }

    const toggler = t.closest?.('.toggle') || null;
    if (toggler) {
        ev.preventDefault();
        const tg = toggler.getAttribute('data-target');
        if (tg){
        const nn = qs(tg);
        if (nn) nn.classList.toggle('hidden');
        }
        return;
    }

    if (t.id === 'toggle-prompt'){
        const pr = qs('#prompt-wrap'); if (pr) pr.classList.toggle('hidden');
        return;
    }
    if (t.id === 'import-btn'){ ev.preventDefault(); qs('#import-file')?.click(); return; }
    if (t.id === 'seed-demo' || t.closest?.('#seed-demo')){ ev.preventDefault(); loadDemo(); return; }
    if (t.id === 'start-chats'){ ev.preventDefault(); startChats(); return; }
    if (t.id === 'start-group'){ ev.preventDefault(); startGroup(); return; }
    if (t.id === 'send'){ ev.preventDefault(); sendMessage(); return; }
    if (t.id === 'regen'){
        ev.preventDefault();
        const s = currentSession(); if (!s) return;
        s.messages.push({ role:'assistant', content:'Regenerated (demo).' });
        renderTranscript(); return;
    }
    if (t.id === 'clear-chat'){
        ev.preventDefault();
        const s2 = currentSession(); if (!s2) return;
        s2.messages = []; renderTranscript(); return;
    }
    if (t.id === 'toggle-left'){ const a = qs('#left'); if (a) a.style.display = (a.style.display === 'none' ? '' : 'none'); return; }
    if (t.id === 'toggle-right'){ const b = qs('#right'); if (b) b.style.display = (b.style.display === 'none' ? '' : 'none'); return; }
    });
    
}

export function wireSearch() {
    // Search
    const searchBox = qs('#char-search');
    if (searchBox) searchBox.addEventListener('input', renderCharList);
}

export function wireComposer() {
    // Composer (kept identical; original uses #composer key handling to trigger send)
    const composer = qs('#composer');
    if (composer){
        composer.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); sendMessage(); }
        });
    }
}

export function wireImport() {
    const importInput = qs('#import-file');
    if (importInput){
        importInput.addEventListener('change', (e) => {
            const file = e.target.files[0]; if (!file) return;
            const fr = new FileReader();
            fr.onload = () => {
            try {
                const json = JSON.parse(fr.result);
                importBundle(json, { filename: file.name });
            } catch { alert('Invalid JSON bundle'); }
            finally { importInput.value = ''; }
            };
            fr.readAsText(file);
        });
    }
}

// Send message (preserves original input id: #chat-input)
export function sendMessage() {
    const inputEl = document.getElementById('chat-input'); // keep as-is to avoid behavior changes
    if (!inputEl) return;
    const content = (inputEl.value || '').trim(); 
    if (!content) return;
    inputEl.value = '';

    let sess = currentSession(); 
    if (!sess) return;

    const temperature = Number(document.getElementById('temp')?.value || 0.7);
    const maxTokens = Number(document.getElementById('max-tokens')?.value || 1024);

    // Push user
    sess.messages.push({ role:'user', content }); 
    renderTranscript();

    // Build preview + console events
    try {
      const personaChar = (!sess.group) ? state.characters.find(c => c.id === sess.characterId) : null;
      const kernel = buildKernelFromCharacter(personaChar);
      const prior = sess.messages.slice(0, -1);
      const recentTurns = prior.slice(-RECENT_TURNS_LIMIT);
      const fullPrompt = buildChatPrompt({ persona: kernel, recentTurns, userText: content });
      const prevBox = document.querySelector('#prompt-wrap'); if (prevBox) prevBox.textContent = fullPrompt;

      dcEmit('PROMPT_BUILT', {
        personaId: personaChar ? personaChar.id : (sess.group ? '(group)' : null),
        model: 'mock',
        temperature,
        promptPreview: String(fullPrompt || '').slice(0, 300)
      });
    } catch (e) {
      dcEmit('ERROR', { where:'L0B', message:String(e?.message || e) });
    }

    const persona = (!sess.group) ? state.characters.find(c => c.id === sess.characterId) : null;
    const preview = persona ? buildSystemPrompt(persona) : (sess.group ? '(group session)' : '(no persona)');
    dcEmit('PROMPT_BUILT', {
      personaId: persona ? persona.id : (sess.group ? '(group)' : null),
      model: 'mock',
      temperature,
      promptPreview: String(preview || '').slice(0, 300)
    });

    const t0 = performance.now();
    dcEmit('REQUEST_SENT', { model:'mock', endpoint:'/mock/demo' });

    setTimeout(() => {
      let name = 'assistant';
      if (persona?.name) name = persona.name;
      else if (sess.group && typeof getParticipantNames === 'function'){
        const list = getParticipantNames(sess); if (Array.isArray(list) && list.length) name = list[0];
      }
      const reply = content.slice(0, 200);
      sess.messages.push({ role:'assistant', content: reply }); 
      renderTranscript();

      const durationMs = performance.now() - t0;
      const inputTokens = Math.round((String(preview || '').length + content.length) / 4);
      const outputTokens = Math.round(reply.length / 4);

      dcEmit('RESPONSE_RECEIVED', {
        usage: { input_tokens: inputTokens, output_tokens: outputTokens },
        durationMs
      });
    }, 120);
}

export function startChats() {
    let ids = selectedIds();
    if (!ids.length && state.selectedCharId) ids = [state.selectedCharId];
    if (!ids.length){ alert('Pick at least one character.'); 
        return; 
    }

    for (const cid of ids){
      const exists = currentSessionByChar(cid);
      if (!exists){
        const sid = newSession(cid);
        if (!state.currentSessionId) switchSession(sid);
      }
    }
    const first = state.sessions.find(s => ids.includes(s.characterId));
    if (first) {
        const { group, characterId } = switchSession(first.id);
            
        renderTabs();
        renderTranscript();
        group ? renderGroupHeader(currentSession()) : (characterId && selectCharacter(characterId));
    }
}

export function startGroup() {
    let ids = selectedIds();
    if (ids.length < 2){ ids = state.characters.slice(0,2).map(c => c.id); }
    if (ids.length < 2){ alert('Pick at least two characters.'); return; }

    const gid = 'g_' + Math.random().toString(36).slice(2,10);
    state.sessions.unshift({ id: gid, group:true, participantIds: ids.slice(), startedAt: Date.now(), messages: [] });

    const names = getParticipantNames({ participantIds: ids });
    let s = getSessionById(gid);
    if (!s){ state.currentSessionId = gid; s = getSessionById(gid); }

    s.messages.push({ role:'user', content:'(group) Session started.' });
    if (names[0]) s.messages.push({ role:'assistant', content:`[${names[0]}] Checking in.` });
    if (names[1]) s.messages.push({ role:'assistant', content:`[${names[1]}] Ready to coordinate.` });
    const { group, characterId } = switchSession(gid);
    renderTabs();
    renderTranscript();
    group ? renderGroupHeader(currentSession()) : (characterId && selectCharacter(characterId));
}