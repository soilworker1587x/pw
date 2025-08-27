(function() {
    function onReady(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn);
        } else {
            fn();
        }
    }
    onReady(init);

    function init() {
        if (window.__pw_chat_init) return;
        window.__pw_chat_init = true;
        var BUNDLE_TYPE = 'personaworks.characters';
        var BUNDLE_VERSION = 1;
        var state = {
            characters: [],
            sessions: [],
            currentSessionId: null,
            selectedCharId: null,
            selected: {},
            bundleMeta: null
        };
        var COLOR_PALETTE = ['#8b5cf6', '#34d399', '#f59e0b', '#f472b6', '#a78bfa', '#22d3ee', '#fb7185'];
        var COLOR_MAP = {};

        function colorFor(id) {
            if (!COLOR_MAP[id]) {
                var i = Object.keys(COLOR_MAP).length % COLOR_PALETTE.length;
                COLOR_MAP[id] = COLOR_PALETTE[i];
            }
            return COLOR_MAP[id];
        }

        function qs(s) {
            return document.querySelector(s);
        }

        function el(tag, attrs, kids) {
            var n = document.createElement(tag);
            attrs = attrs || {};
            kids = kids || [];
            for (var k in attrs) {
                if (!attrs.hasOwnProperty(k)) continue;
                var v = attrs[k];
                if (k === 'class') n.className = v;
                else if (k === 'html') n.innerHTML = v;
                else n.setAttribute(k, v);
            }
            if (!Array.isArray(kids)) kids = [kids];
            for (var i = 0; i < kids.length; i++) {
                var ch = kids[i];
                if (Array.isArray(ch)) {
                    for (var j = 0; j < ch.length; j++) {
                        if (ch[j]) n.appendChild(ch[j]);
                    }
                } else if (ch) {
                    n.appendChild(ch);
                }
            }
            return n;
        }

        function text(s) {
            return document.createTextNode(String(s));
        }

        function escapeHTML(s) {
            var out = String(s);
            out = out.split('&').join('&amp;');
            out = out.split('<').join('&lt;');
            out = out.split('>').join('&gt;');
            out = out.split('"').join('&quot;');
            return out;
        }

        function setSelected(id, on) {
            if (on) state.selected[id] = 1;
            else delete state.selected[id];
            updateSelCount();
        }

        function selectedIds() {
            var a = [];
            for (var k in state.selected) {
                if (state.selected.hasOwnProperty(k)) a.push(k);
            }
            return a;
        }

        document.addEventListener('click', function(ev) {
            var t = ev.target || ev.srcElement;
            if (!t) return;
            var closeBtn = t.closest ? t.closest('.x') : null;
            var tabEl = t.closest ? t.closest('.tab') : null;
            if (t.classList && t.classList.contains('open-chat')) {
                ev.preventDefault();
                var cid = t.getAttribute('data-id');
                if (cid) {
                    var existing = currentSessionByChar(cid);
                    var sid = existing ? existing.id : newSession(cid);
                    switchSession(sid);
                }
                return;
            }
            if (closeBtn) {
                ev.preventDefault();
                var sid2 = closeBtn.getAttribute('data-sid');
                if (sid2) closeSession(sid2);
                return;
            }
            if (tabEl) {
                ev.preventDefault();
                var sid = tabEl.getAttribute('data-sid');
                if (sid) switchSession(sid);
                return;
            }
            var toggler = t.closest ? t.closest('.toggle') : null;
            if (toggler) {
                ev.preventDefault();
                var tg = toggler.getAttribute('data-target');
                if (tg) {
                    var nn = qs(tg);
                    if (nn) {
                        nn.classList.toggle('hidden');
                    }
                }
                return;
            }
            if (t.id === 'toggle-prompt') {
                var pr = qs('#prompt-wrap');
                if (pr) pr.classList.toggle('hidden');
                return;
            }
            if (t.id === 'import-btn') {
                ev.preventDefault();
                var f = qs('#import-file');
                if (f) f.click();
                return;
            }
            if (t.id === 'seed-demo' || (t.closest && t.closest('#seed-demo'))) {
                ev.preventDefault();
                loadDemo();
                return;
            }
            if (t.id === 'start-chats') {
                ev.preventDefault();
                startChats();
                return;
            }
            if (t.id === 'start-group') {
                ev.preventDefault();
                startGroup();
                return;
            }
            if (t.id === 'send') {
                ev.preventDefault();
                sendMessage();
                return;
            }
            if (t.id === 'regen') {
                ev.preventDefault();
                var s = currentSession();
                if (!s) return;
                s.messages.push({
                    role: 'assistant',
                    content: 'Regenerated (demo).'
                });
                renderTranscript();
                return;
            }
            if (t.id === 'clear-chat') {
                ev.preventDefault();
                var s2 = currentSession();
                if (!s2) return;
                s2.messages = [];
                renderTranscript();
                return;
            }
            if (t.id === 'toggle-left') {
                var a = qs('#left');
                if (a) a.style.display = (a.style.display === 'none' ? '' : 'none');
                return;
            }
            if (t.id === 'toggle-right') {
                var b = qs('#right');
                if (b) b.style.display = (b.style.display === 'none' ? '' : 'none');
                return;
            }
        });

        var importInput = qs('#import-file');
        if (importInput) {
            importInput.addEventListener('change', function(e) {
                var file = e.target.files[0];
                if (!file) return;
                var fr = new FileReader();
                fr.onload = function() {
                    try {
                        var json = JSON.parse(fr.result);
                        importBundle(json, {
                            filename: file.name
                        });
                    } catch (err) {
                        alert('Invalid JSON bundle');
                    } finally {
                        importInput.value = '';
                    }
                };
                fr.readAsText(file);
            });
        }

        var searchBox = qs('#char-search');
        if (searchBox) {
            searchBox.addEventListener('input', renderCharList);
        }
        var composer = qs('#composer');
        if (composer) {
            composer.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                }
            });
        }

        try {
            var saved = localStorage.getItem('pw_chat_bundle');
            if (saved) {
                importBundle(JSON.parse(saved), {
                    filename: 'saved.json'
                });
            } else {
                loadDemo();
            }
        } catch (e) {
            loadDemo();
        }

        function loadDemo() {
            var demo = {
                type: BUNDLE_TYPE,
                version: BUNDLE_VERSION,
                exportedAt: new Date().toISOString(),
                characters: [{
                    id: 'aria-001',
                    name: 'Aria Farwind',
                    role: 'Scout',
                    gender: 'female',
                    age: 27,
                    traits: ['brave', 'curious'],
                    tags: ['npc', 'riverfolk'],
                    appearance: {
                        species: 'elf'
                    },
                    schemaVersion: 1,
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                }, {
                    id: 'daren-002',
                    name: 'Daren Blackwood',
                    role: 'Quartermaster',
                    gender: 'male',
                    age: 33,
                    traits: ['pragmatic', 'dry humor'],
                    tags: ['guild', 'trusted'],
                    appearance: {
                        species: 'human'
                    },
                    schemaVersion: 1,
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                }, {
                    id: 'mira-003',
                    name: 'Mira Stoneveil',
                    role: 'Archivist',
                    gender: 'female',
                    age: 41,
                    traits: ['methodical', 'kind'],
                    tags: ['npc', 'library'],
                    appearance: {
                        species: 'dwarf'
                    },
                    schemaVersion: 1,
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                }, {
                    id: 'vex-004',
                    name: 'Vex Talon',
                    role: 'Smuggler',
                    gender: 'non-binary',
                    age: 29,
                    traits: ['witty', 'reckless'],
                    tags: ['underworld', 'pilot'],
                    appearance: {
                        species: 'tiefling'
                    },
                    schemaVersion: 1,
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                }]
            };
            importBundle(demo, {
                filename: 'demo.json'
            });
        }

        function importBundle(bundle, meta) {
            meta = meta || {};
            if (!bundle || bundle.type !== BUNDLE_TYPE) {
                alert('Wrong bundle type');
                return;
            }
            if (typeof bundle.version !== 'number' || bundle.version < 1) {
                alert('Unsupported bundle version');
                return;
            }
            var chars = Array.isArray(bundle.characters) ? bundle.characters : [];

            function clean(arr) {
                if (!Array.isArray(arr)) return [];
                var out = [];
                for (var i = 0; i < arr.length; i++) {
                    var s = String(arr[i] || '').trim();
                    if (s) out.push(s);
                }
                return out;
            }

            function num(n) {
                return (typeof n === 'number' && isFinite(n)) ? n : null;
            }
            state.characters = chars.map(function(c) {
                return {
                    id: String(c.id || String(Date.now()) + Math.random().toString(36).slice(2, 8)),
                    name: String(c.name || 'Unnamed Character'),
                    role: String(c.role || ''),
                    gender: String(c.gender || ''),
                    age: num(c.age),
                    traits: clean(c.traits),
                    goals: clean(c.goals),
                    tags: clean(c.tags),
                    appearance: {
                        species: String((c.appearance && c.appearance.species) || '')
                    },
                    schemaVersion: (typeof c.schemaVersion === 'number' ? c.schemaVersion : 1),
                    createdAt: (typeof c.createdAt === 'number' ? c.createdAt : Date.now()),
                    updatedAt: (typeof c.updatedAt === 'number' ? c.updatedAt : Date.now())
                };
            });
            state.bundleMeta = {
                exportedAt: bundle.exportedAt || new Date().toISOString(),
                filename: meta.filename || 'bundle.json',
                count: state.characters.length
            };
            try {
                localStorage.setItem('pw_chat_bundle', JSON.stringify({
                    type: BUNDLE_TYPE,
                    version: BUNDLE_VERSION,
                    exportedAt: state.bundleMeta.exportedAt,
                    characters: state.characters
                }));
            } catch (e) {}
            var bi = qs('#bundle-info');
            if (bi) bi.textContent = state.bundleMeta.count + ' chars - ' + state.bundleMeta.filename;
            state.selected = {};
            if (searchBox) searchBox.value = '';
            state.sessions = [];
            state.currentSessionId = null;
            renderCharList();
            if (state.characters.length) selectCharacter(state.characters[0].id);
            renderTabs();
        }

        function renderCharList() {
            var box = qs('#char-list');
            if (!box) return;
            box.innerHTML = '';
            var q = (searchBox && searchBox.value ? searchBox.value.toLowerCase() : '');
            var chars = state.characters.filter(function(c) {
                var hay = (c.name + ' ' + c.role + ' ' + (c.appearance.species || '') + ' ' + (c.tags || []).join(' ')).toLowerCase();
                return hay.indexOf(q) >= 0;
            });
            if (!chars.length) {
                box.appendChild(el('div', {
                    class: 'muted'
                }, [text('No characters. Import or Load Demo.')]));
                updateSelCount();
                return;
            }
            for (var i = 0; i < chars.length; i++) {
                var c = chars[i];
                var row = el('div', {
                    class: 'card char'
                });
                if (state.selectedCharId === c.id) row.style.outline = '1px solid var(--acc)';
                var pick = el('input', {
                    type: 'checkbox',
                    class: 'pick'
                });
                pick.checked = !!state.selected[c.id];
                (function(id) {
                    pick.addEventListener('click', function(ev) {
                        ev.stopPropagation();
                        setSelected(id, ev.currentTarget.checked);
                    });
                })(c.id);
                var left = el('div', {class:'info',style:'flex:1 1 auto;min-width:0'}, [el('div', {
                    class: 'name'
                }, [text(c.name)]), el('div', {
                    class: 'meta'
                }, [text((c.role || '-') + ' - ' + (c.appearance.species || '-'))]), el('div', {}, [(function() {
                    var kids = [];
                    var lim = Math.min(4, c.tags.length);
                    for (var j = 0; j < lim; j++) {
                        kids.push(el('span', {
                            class: 'chip'
                        }, [text(c.tags[j])]));
                    }
                    if (c.tags.length > 4) {
                        kids.push(el('span', {
                            class: 'muted'
                        }, [text('+' + (c.tags.length - 4))]));
                    }
                    return kids;
                })()])]);
                var right = el('div', {class:'actions',style:'margin-left:auto;display:flex;align-items:center;gap:8px;white-space:nowrap'}, [el('button',{class:'btn small open-chat','data-id':c.id},[text('Open')]), el('span', {class: 'dot',
                    style: 'background:' + colorFor(c.id)
                })]);
                (function(id) {
                    row.addEventListener('click', function() {
                        selectCharacter(id);
                    });
                })(c.id);
                row.appendChild(el('div', {class:'rowwrap', 
                    style: 'display:flex;align-items:flex-start;gap:8px;width:100%'
                }, [pick, left, right]));
                box.appendChild(row);
            }
            updateSelCount();
        }

        function updateSelCount() {
            var n = qs('#sel-count');
            if (n) n.textContent = Object.keys(state.selected).length + ' selected';
        }

        function selectCharacter(id) {
            state.selectedCharId = id;
            var c = null;
            for (var i = 0; i < state.characters.length; i++) {
                if (state.characters[i].id === id) {
                    c = state.characters[i];
                    break;
                }
            }
            if (!c) return;
            var av = qs('#char-avatar');
            if (av) av.textContent = (c.name || 'PC').slice(0, 2).toUpperCase();
            var tt = qs('#char-title');
            if (tt) tt.textContent = c.name;
            var sb = qs('#char-sub');
            if (sb) sb.textContent = (c.role ? c.role + ' - ' : '') + (c.appearance.species || '-');
            var det = qs('#char-details');
            if (det) det.innerHTML = '<div><b>Role:</b> ' + escapeHTML(c.role || '-') + '</div>' + '<div><b>Gender:</b> ' + escapeHTML(c.gender || '-') + '</div>' + '<div><b>Age:</b> ' + (c.age == null ? '-' : String(Number(c.age))) + '</div>' + '<div><b>Species:</b> ' + escapeHTML(c.appearance.species || '-') + '</div>' + '<div><b>Traits:</b> ' + escapeHTML((c.traits || []).join(', ') || '-') + '</div>' + '<div><b>Tags:</b> ' + ((c.tags || []).map(function(t) {
                return '<span class="chip">' + escapeHTML(t) + '</span>';
            }).join(' ') || '-') + '</div>';
            var prev = qs('#prompt-wrap');
            if (prev) prev.textContent = buildSystemPrompt(c);
            renderCharList();
        }

        function buildSystemPrompt(c) {
            var v = c.voice || {};
            var lines = [];
            lines.push('You are ' + c.name + (c.role ? ', a ' + c.role : '') + '.');
            if (c.appearance && c.appearance.species) lines.push('Species: ' + c.appearance.species + '.');
            if (Array.isArray(c.traits) && c.traits.length) lines.push('Traits: ' + c.traits.join(', ') + '.');
            if (v.archetype) lines.push('Voice archetype: ' + v.archetype + '.');
            if (Number.isFinite(v.formality)) lines.push('Formality: ' + v.formality + '/100.');
            if (Array.isArray(v.catchphrases) && v.catchphrases.length) lines.push('Use catchphrases sparingly: ' + v.catchphrases.slice(0,2).join(' | ') + '.');
            if (Array.isArray(v.avoid) && v.avoid.length) lines.push('Avoid: ' + v.avoid.slice(0,4).join(', ') + '.');
            lines.push('Stay in character. Honor voice, canon, and boundaries.');
            return lines.join('\n');
        }

        function newSession(characterId) {
            var id = 's_' + Math.random().toString(36).slice(2, 10);
            state.sessions.unshift({
                id: id,
                characterId: characterId,
                startedAt: Date.now(),
                messages: []
            });
            return id;
        }

        function currentSession() {
            for (var i = 0; i < state.sessions.length; i++) {
                if (state.sessions[i].id === state.currentSessionId) return state.sessions[i];
            }
            return null;
        }

        function getSessionById(id) {
            for (var i = 0; i < state.sessions.length; i++) {
                if (state.sessions[i].id === id) return state.sessions[i];
            }
            return null;
        }

        function currentSessionByChar(cid) {
            for (var i = 0; i < state.sessions.length; i++) {
                if (state.sessions[i].characterId === cid) return state.sessions[i];
            }
            return null;
        }

        function switchSession(id) {
            state.currentSessionId = id;
            renderTranscript();
            renderTabs();
            var s = currentSession();
            if (s) {
                if (s.group) {
                    renderGroupHeader(s);
                } else {
                    selectCharacter(s.characterId);
                }
            }
        }

        function closeSession(id) {
            for (var i = 0; i < state.sessions.length; i++) {
                if (state.sessions[i].id === id) {
                    var was = (state.sessions[i].id === state.currentSessionId);
                    state.sessions.splice(i, 1);
                    if (was) {
                        state.currentSessionId = state.sessions[0] ? state.sessions[0].id : null;
                    }
                    break;
                }
            }
            renderTabs();
            renderTranscript();
            var s = currentSession();
            if (s) {
                if (s.group) {
                    renderGroupHeader(s);
                } else {
                    selectCharacter(s.characterId);
                }
            }
        }

        function renderTabs() {
            var bar = qs('#session-tabs');
            if (!bar) return;
            bar.innerHTML = '';
            for (var i = 0; i < state.sessions.length; i++) {
                var s = state.sessions[i];
                var name = '?';
                if (s.group) {
                    name = 'Group';
                } else {
                    var c = null;
                    for (var j = 0; j < state.characters.length; j++) {
                        if (state.characters[j].id === s.characterId) {
                            c = state.characters[j];
                            break;
                        }
                    }
                    name = c ? c.name : '?';
                }
                var tab = el('div', {
                    class: 'tab' + (s.id === state.currentSessionId ? ' active' : ''),
                    'data-sid': s.id
                }, [text(name)]);
                var x = el('button', {
                    class:'x',
                    'data-sid': s.id
                }, [text('x')]);
                tab.appendChild(x);
                bar.appendChild(tab);
            }
        }

        function renderTranscript() {
            var box = qs('#transcript');
            if (!box) return;
            box.innerHTML = '';
            var sess = currentSession();
            if (!sess) {
                box.appendChild(el('div', {
                    class: 'muted'
                }, [text('No session. Click Start Chats.')]));
                return;
            }
            if (!sess.messages.length) {
                box.appendChild(el('div', {
                    class: 'muted'
                }, [text('New session. Say hello!')]));
            }
            for (var i = 0; i < sess.messages.length; i++) {
                var m = sess.messages[i];
                var b = el('div', {
                    class: 'bubble ' + (m.role === 'user' ? 'user' : 'assistant')
                });
                var html = escapeHTML(m.content).split('\n').join('<br>');
                b.innerHTML = html;
                var meta = el('div', {
                    class: 'meta-row'
                }, [el('span', {}, [text(m.role)]), el('span', {}, [text('-')])]);
                b.appendChild(meta);
                box.appendChild(b);
            }
            box.scrollTop = box.scrollHeight;
        }

        // Full replacement: sendMessage()
        function sendMessage() {
            // 1) Read input
            var inputEl = document.getElementById('chat-input');
            if (!inputEl) return;
            var content = (inputEl.value || '').trim();
            if (!content) return;
            inputEl.value = '';

            // 2) Resolve the current session (fallback-safe)
            //    Assumes you maintain `state.sessions` and `state.currentSessionId`.
            var sess = null;
            if (state && Array.isArray(state.sessions)) {
                for (var i = 0; i < state.sessions.length; i++) {
                if (state.sessions[i].id === state.currentSessionId) {
                    sess = state.sessions[i];
                    break;
                }
                }
            }
            if (!sess) return;

            // 3) Read UI knobs for logging (safe fallbacks)
            var tempEl = document.getElementById('temp');
            var maxEl  = document.getElementById('max-tokens');
            var temperature = tempEl ? Number(tempEl.value || 0.7) : 0.7;
            var maxTokens   = maxEl ? Number(maxEl.value || 1024) : 1024;

            // 4) Helper: find persona/character tied to this session (non-group only)
            function getActiveCharacterForSession(s) {
                if (!s || s.group) return null;
                if (!state || !Array.isArray(state.characters)) return null;
                for (var i = 0; i < state.characters.length; i++) {
                if (state.characters[i].id === s.characterId) return state.characters[i];
                }
                return null;
            }

            // 5) Push user message into the session (existing behavior)
            sess.messages.push({ role: 'user', content: content });
            renderTranscript();

            // 6) Dev Console: PROMPT_BUILT
            var persona = getActiveCharacterForSession(sess);
            var preview = persona ? buildSystemPrompt(persona) : (sess.group ? '(group session)' : '(no persona)');
            dcEmit('PROMPT_BUILT', {
                personaId: persona ? persona.id : (sess.group ? '(group)' : null),
                model: 'mock',                        // swap with real model id when you hook a provider
                temperature: temperature,
                promptPreview: String(preview || '').slice(0, 300)
            });

            // 7) Dev Console: REQUEST_SENT (start latency timer)
            var t0 = performance.now();
            dcEmit('REQUEST_SENT', {
                model: 'mock',
                endpoint: '/mock/demo'
            });

            // 8) Demo reply (your existing simulated assistant)
            setTimeout(function () {
                // Pick a display name: character name, group participant, or fallback
                var name = 'assistant';
                if (persona && persona.name) {
                name = persona.name;
                } else if (sess.group && typeof getParticipantNames === 'function') {
                var list = getParticipantNames(sess);
                if (Array.isArray(list) && list.length) name = list[0];
                }
                var reply = '(demo)[' + name + '] echo: ' + content.slice(0, 200);

                // Push assistant reply (existing behavior)
                sess.messages.push({ role: 'assistant', content: reply });
                renderTranscript();

                // 9) Dev Console: RESPONSE_RECEIVED (tokens + latency, rough estimates)
                var durationMs   = performance.now() - t0;
                var inputTokens  = Math.round((String(preview || '').length + content.length) / 4); // crude estimate
                var outputTokens = Math.round(reply.length / 4);
                dcEmit('RESPONSE_RECEIVED', {
                usage: { input_tokens: inputTokens, output_tokens: outputTokens },
                durationMs: durationMs
                });
            }, 120); // keep snappy for demo; adjust as you like
        }


        function startChats() {
            var ids = selectedIds();
            if (!ids.length && state.selectedCharId) ids = [state.selectedCharId];
            if (!ids.length) {
                alert('Pick at least one character.');
                return;
            }
            for (var i = 0; i < ids.length; i++) {
                var cid = ids[i];
                var exists = currentSessionByChar(cid);
                if (!exists) {
                    var sid = newSession(cid);
                    if (!state.currentSessionId) switchSession(sid);
                }
            }
            var first = null;
            for (var j = 0; j < state.sessions.length; j++) {
                if (ids.indexOf(state.sessions[j].characterId) >= 0) {
                    first = state.sessions[j];
                    break;
                }
            }
            if (first) switchSession(first.id);
        }

        function startGroup() {
            var ids = selectedIds();
            if (ids.length < 2) {
                ids = [];
                for (var i = 0; i < state.characters.length && ids.length < 2; i++) {
                    ids.push(state.characters[i].id);
                }
            }
            if (ids.length < 2) {
                alert('Pick at least two characters.');
                return;
            }
            var gid = 'g_' + Math.random().toString(36).slice(2, 10);
            state.sessions.unshift({
                id: gid,
                group: true,
                participantIds: ids.slice(),
                startedAt: Date.now(),
                messages: []
            });
            var names = getParticipantNames({
                participantIds: ids
            });
            var s = getSessionById(gid);
            if (!s) {
                state.currentSessionId = gid;
                s = getSessionById(gid);
            }
            s.messages.push({
                role: 'user',
                content: '(group) Session started.'
            });
            if (names[0]) s.messages.push({
                role: 'assistant',
                content: '[' + names[0] + '] Checking in.'
            });
            if (names[1]) s.messages.push({
                role: 'assistant',
                content: '[' + names[1] + '] Ready to coordinate.'
            });
            switchSession(gid);
        }

        function getParticipantNames(sess) {
            var ids = (sess && sess.participantIds) ? sess.participantIds : [];
            var out = [];
            for (var i = 0; i < ids.length; i++) {
                var id = ids[i];
                var nm = null;
                for (var j = 0; j < state.characters.length; j++) {
                    if (state.characters[j].id === id) {
                        nm = state.characters[j].name;
                        break;
                    }
                }
                out.push(nm || id);
            }
            return out;
        }

        function renderGroupHeader(sess) {
            var names = getParticipantNames(sess);
            var av = qs('#char-avatar');
            if (av) av.textContent = 'GR';
            var tt = qs('#char-title');
            if (tt) tt.textContent = 'Group chat';
            var sb = qs('#char-sub');
            if (sb) {
                var label = names.slice(0, 2).join(', ');
                if (names.length > 2) label += ' +' + (names.length - 2);
                sb.textContent = label || '-';
            }
            var det = qs('#char-details');
            if (det) {
                var chips = '';
                for (var i = 0; i < names.length; i++) {
                    chips += ('<span class="chip">' + escapeHTML(names[i]) + '</span> ');
                }
                det.innerHTML = '<div><b>Participants:</b> ' + (chips || '-') + '</div>';
            }
            var prev = qs('#prompt-wrap');
            if (prev) prev.textContent = 'Group session with participants: ' + (names.join(', ') || '-') + '.';
        }

        window.__pw_chat = {
            state: state
        };
    }
})();
// Update token usage UI if present
function updateTokenStats(used, max){
    try{
        var usedEl = document.getElementById('tok-used');
        var maxEl  = document.getElementById('tok-max');
        var bar    = document.getElementById('tokbar-fill');
        if(usedEl) usedEl.textContent = used||0;
        if(maxEl)  maxEl.textContent  = max||0;
        if(bar && max>0){
            var pct = Math.max(0, Math.min(100, Math.round((used/max)*100)));
            bar.style.width = pct + '%';
            bar.setAttribute('aria-valuenow', pct);
        }
    }catch(e){/* noop */}
}

// Stable color mapping based on id hash
function hashCode(str){var h=0, i=0, chr; if(!str) return 0; for(i=0;i<str.length;i++){chr=str.charCodeAt(i); h=((h<<5)-h)+chr; h|=0;} return Math.abs(h);}
var COLOR_PALETTE = ['#e57373','#64b5f6','#81c784','#ffd54f','#ba68c8','#4db6ac','#ff8a65','#7986cb','#a1887f','#90a4ae'];
(function(){ try{ if(typeof colorFor==='function'){ var _cf = colorFor; colorFor = function(id){ var idx = hashCode(String(id)) % COLOR_PALETTE.length; return COLOR_PALETTE[idx]; }; } }catch(e){} })();

function dcEmit(type, payload) {
  try {
    const api = window.PWStageBus; // from the module bootstrap
    if (!api) return;
    if (type === 'PROMPT_BUILT')  api.promptBuilt(payload);
    if (type === 'REQUEST_SENT')  api.requestSent(payload);
    if (type === 'RESPONSE_RECEIVED') api.responseReceived(payload);
    if (type === 'ERROR')         api.error(payload);
  } catch(e) {}
}