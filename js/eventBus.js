// eventBus.js — tiny pub/sub for Stage/Studio
export const bus = (() => {
  const listeners = new Set();
  return {
    on(fn){ listeners.add(fn); return () => listeners.delete(fn); },
    emit(evt){ listeners.forEach(fn => { try { fn(evt); } catch(e){} }); },
    clear(){ listeners.clear(); }
  };
})();
