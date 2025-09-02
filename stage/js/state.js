export const state = {
    characters: [],
    sessions: [],
    currentSessionId: null,
    selectedCharId: null,
    selected: {},
    bundleMeta: null
};

export const BUNDLE_TYPE = 'personaworks.characters';
export const BUNDLE_VERSION = 1;

export function setSelected(id, on){ 
    if (on) state.selected[id] = 1; 
    else delete state.selected[id];  
}

export function selectedIds(){ 
    return Object.keys(state.selected); 
}
