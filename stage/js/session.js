import { state } from "./state.js";

export function newSession(characterId) {
    const id = 's_' + Math.random().toString(36).slice(2,10);
    state.sessions.unshift({ id, characterId, startedAt: Date.now(), messages: [] });
    return id;
}
  
export function currentSession() { 
    return state.sessions.find(s => s.id === state.currentSessionId) || null; 
}

export function getSessionById(id) { 
    return state.sessions.find(s => s.id === id) || null; 
}

export function currentSessionByChar(cid) { 
    return state.sessions.find(s => s.characterId === cid) || null; 
}

export function switchSession(id) {
    state.currentSessionId = id;
    const s = currentSession();
    return { group: !!s?.group, characterId: s?.characterId ?? null };
}

export function closeSession(id) {
    const idx = state.sessions.findIndex(s => s.id === id);
    if (idx >= 0) {
        const was = (state.sessions[idx].id === state.currentSessionId);
        state.sessions.splice(idx, 1);
        if (was) state.currentSessionId = state.sessions[0]?.id || null;
    }
    return { currentSessionId: state.currentSessionId };
}