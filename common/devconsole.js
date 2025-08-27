// devconsole.js — Drop-in Dev Console for Stage/Studio
export const DevConsole = (() => {
  const DEFAULTS = { enabled:false, level:"info", maxEntries:200, redactFields:["apiKey","nsfw","notes"] };
  const LEVEL_ORDER = ["debug","info","warn","error"];

  const redact = (obj, fields) => {
    try {
      const clone = (obj && typeof obj === "object") ? structuredClone(obj) : obj;
      const walk = (o) => {
        if (!o || typeof o !== "object") return;
        for (const k of Object.keys(o)) {
          if (fields.includes(k)) o[k] = "***";
          else if (o[k] && typeof o[k] === "object") walk(o[k]);
        }
      };
      walk(clone);
      return clone;
    } catch { return obj; }
  };
  const nowStr = () => {
    const d = new Date();
    return d.toTimeString().split(' ')[0] + "." + String(d.getMilliseconds()).padStart(3,'0');
  };

  function createRoot(mount){
    const root = document.createElement("div");
    root.className = "pw-dc pw-dc--hidden";
    root.innerHTML = `
      <div class="pw-dc__bar">
        <span class="pw-dc__title">Dev Console</span>
        <button class="pw-dc__btn" data-action="pause">Pause</button>
        <button class="pw-dc__btn" data-action="clear">Clear</button>
        <button class="pw-dc__btn" data-action="export">Export</button>
        <span class="pw-dc__badge" data-id="count">0</span>
        <div class="pw-dc__filters">
          <label><input type="checkbox" data-filter-type="debug" checked> debug</label>
          <label><input type="checkbox" data-filter-type="info"  checked> info</label>
          <label><input type="checkbox" data-filter-type="warn"  checked> warn</label>
          <label><input type="checkbox" data-filter-type="error" checked> error</label>
          <select data-filter-scope>
            <option value="">scope:*</option>
            <option value="studio">studio</option>
            <option value="stage">stage</option>
            <option value="system">system</option>
          </select>
          <input type="text" placeholder="search..." data-filter-search style="min-width:160px">
        </div>
        <div class="pw-dc__spacer"></div>
      </div>
      <div class="pw-dc__tabs">
        <div class="pw-dc__tab pw-dc__tab--active" data-tab="logs">Logs</div>
        <div class="pw-dc__tab" data-tab="payload">Payload</div>
        <div class="pw-dc__tab" data-tab="tokens">Tokens</div>
      </div>
      <div class="pw-dc__body">
        <div class="pw-dc__list" data-panel="logs"></div>
        <pre class="pw-dc__json" data-panel="payload"></pre>
        <div class="pw-dc__stats" data-panel="tokens" style="display:none">
          <div>Total input tokens: <span data-id="tok-in">0</span></div>
          <div>Total output tokens: <span data-id="tok-out">0</span></div>
          <div>Requests: <span data-id="reqs">0</span></div>
          <div>Average latency (ms): <span data-id="lat">0</span></div>
        </div>
      </div>
    `;
    (mount || document.body).appendChild(root);
    return root;
  }

  function init({ mount, settingsGet, settingsSet }){
    const state = {
      paused:false,
      entries:[],
      filters:{ types:new Set(["debug","info","warn","error"]), scope:"", search:"" },
      selected:null,
      totals:{ in:0, out:0, reqs:0, latSum:0 },
      cfg:null
    };
    const getSetting = async (k, d) => (settingsGet ? await settingsGet(k, d) : d);
    const setSetting = async (k, v) => (settingsSet ? await settingsSet(k, v) : void 0);

    const root = createRoot(mount);
    const refs = {
      list: root.querySelector('[data-panel="logs"]'),
      json: root.querySelector('[data-panel="payload"]'),
      tokens: root.querySelector('[data-panel="tokens"]'),
      count: root.querySelector('[data-id="count"]'),
      tokIn: root.querySelector('[data-id="tok-in"]'),
      tokOut: root.querySelector('[data-id="tok-out"]'),
      reqs: root.querySelector('[data-id="reqs"]'),
      lat: root.querySelector('[data-id="lat"]'),
    };

    // Tabs
    const tabs = root.querySelectorAll(".pw-dc__tab");
    const panels = { logs: refs.list, payload: refs.json, tokens: refs.tokens };
    tabs.forEach(t => t.addEventListener("click", () => {
      tabs.forEach(x => x.classList.remove("pw-dc__tab--active"));
      t.classList.add("pw-dc__tab--active");
      const tab = t.getAttribute("data-tab");
      Object.entries(panels).forEach(([k,el]) => {
        if (k === tab) {
          el.style.display = "block";
          if (k === "payload") refs.json.classList.add("pw-dc__json--show");
        } else {
          if (k === "payload") refs.json.classList.remove("pw-dc__json--show");
          el.style.display = "none";
        }
      });
    }));

    // Actions
    root.querySelector('[data-action="pause"]').addEventListener("click", () => {
      state.paused = !state.paused;
      root.querySelector('[data-action="pause"]').textContent = state.paused ? "Resume" : "Pause";
    });
    root.querySelector('[data-action="clear"]').addEventListener("click", () => {
      state.entries.length = 0; state.selected = null; state.totals = { in:0, out:0, reqs:0, latSum:0 };
      render();
    });
    root.querySelector('[data-action="export"]').addEventListener("click", () => {
      const blob = new Blob([JSON.stringify({ meta:{ app:"PersonaWorks Stage", version:"1.0.0", ts:Date.now() }, settings:{ level: state?.cfg?.level, maxEntries: state?.cfg?.maxEntries }, logs: state.entries }, null, 2)], { type:"application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `devconsole_export_${Date.now()}.json`; a.click(); URL.revokeObjectURL(a.href);
    });

    // Filters
    root.querySelectorAll('[data-filter-type]').forEach(cb => {
      cb.addEventListener("change", () => {
        const t = cb.getAttribute("data-filter-type");
        if (cb.checked) state.filters.types.add(t); else state.filters.types.delete(t);
        render();
      });
    });
    root.querySelector('[data-filter-scope]').addEventListener("change", (e) => { state.filters.scope = e.target.value || ""; render(); });
    root.querySelector('[data-filter-search]').addEventListener("input", (e) => { state.filters.search = e.target.value.toLowerCase(); render(); });

    // Load cfg
    (async () => {
      const enabled = await getSetting("devConsole.enabled", DEFAULTS.enabled);
      const level = await getSetting("devConsole.level", DEFAULTS.level);
      const maxEntries = await getSetting("devConsole.maxEntries", DEFAULTS.maxEntries);
      const redactFields = await getSetting("devConsole.redactFields", DEFAULTS.redactFields);
      state.cfg = { enabled, level, maxEntries, redactFields };
      await setSetting("devConsole.enabled", enabled);
      await setSetting("devConsole.level", level);
      await setSetting("devConsole.maxEntries", maxEntries);
      await setSetting("devConsole.redactFields", redactFields);
      if (enabled) root.classList.remove("pw-dc--hidden");
    })();

    function toggle(force){
      const show = (typeof force === "boolean") ? force : root.classList.contains("pw-dc--hidden");
      root.classList.toggle("pw-dc--hidden", !show);
      if (state?.cfg) setSetting("devConsole.enabled", show);
    }
    function levelAllowed(type){
      const idx = LEVEL_ORDER.indexOf(state?.cfg?.level || "info");
      const tIdx = LEVEL_ORDER.indexOf(type);
      return (tIdx >= idx);
    }
    function addEntry(evt){
      if (!evt) return;
      if (state.paused) return;
      const type = (evt.type || "info").toLowerCase();
      if (!levelAllowed(type)) return;
      const entry = {
        type, ts: Date.now(), time: nowStr(), scope: evt.scope || "",
        message: String(evt.message || ""),
        data: redact(evt.data, state.cfg?.redactFields || DEFAULTS.redactFields),
        durationMs: typeof evt.durationMs === "number" ? Math.round(evt.durationMs) : null,
        tokens: evt.tokens || null
      };
      state.entries.push(entry);
      const cap = state?.cfg?.maxEntries || DEFAULTS.maxEntries;
      if (state.entries.length > cap) state.entries.splice(0, state.entries.length - cap);
      if (entry.tokens && typeof entry.tokens === "object") {
        state.totals.in += (Number(entry.tokens.input)||0);
        state.totals.out += (Number(entry.tokens.output)||0);
        state.totals.reqs += 1; state.totals.latSum += (entry.durationMs || 0);
      }
      renderRow(entry); refs.count.textContent = String(state.entries.length);
    }
    function filtered(){
      return state.entries.filter(e => {
        if (!state.filters.types.has(e.type)) return false;
        if (state.filters.scope && state.filters.scope !== e.scope) return false;
        if (state.filters.search){
          const hay = (e.message + " " + JSON.stringify(e.data||{})).toLowerCase();
          if (!hay.includes(state.filters.search)) return false;
        }
        return true;
      });
    }
    function render(){ refs.list.innerHTML = ""; filtered().forEach(renderRow); refs.count.textContent = String(state.entries.length);
      if (state.selected) refs.json.textContent = JSON.stringify(state.selected, null, 2); else refs.json.textContent = "";
      refs.tokIn.textContent = String(state.totals.in); refs.tokOut.textContent = String(state.totals.out);
      refs.reqs.textContent = String(state.totals.reqs);
      refs.lat.textContent = state.totals.reqs ? Math.round(state.totals.latSum / state.totals.reqs) : 0;
    }
    function renderRow(entry){
      // apply current filters on incremental add, too
      if (!state.filters.types.has(entry.type)) return;
      if (state.filters.scope && state.filters.scope !== entry.scope) return;
      if (state.filters.search){
        const hay = (entry.message + " " + JSON.stringify(entry.data||{})).toLowerCase();
        if (!hay.includes(state.filters.search)) return;
      }
      const row = document.createElement("div");
      row.className = "pw-dc__row" + (entry.type === "error" ? " pw-dc__row--err" : "");
      row.innerHTML = `<div class="pw-dc__cell">${entry.time}</div>
        <div class="pw-dc__cell">${entry.scope || "-"}</div>
        <div class="pw-dc__cell">[${entry.type}] ${entry.message}${entry.durationMs?` • ${entry.durationMs}ms`:""}</div>`;
      row.addEventListener("click", () => {
        state.selected = entry;
        refs.json.textContent = JSON.stringify(entry, null, 2);
        root.querySelector('[data-tab="payload"]').click();
      });
      refs.list.appendChild(row);
    }
    function destroy(){ root.remove(); }
    function log(evt){ addEntry(evt); }
    Object.values({ logs: refs.list, payload: refs.json, tokens: refs.tokens }).forEach(el => el.style.display = "none");
    refs.list.style.display = "block";
    return { log, toggle, destroy };
  }
  return { init };
})();
