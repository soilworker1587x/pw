// stageDevConsoleWiring.js — boot Dev Console in Stage and wrap model client
import { DevConsole } from './devconsole.js';
import { StageBus } from './stageBusHooks.js';
import { bus } from './eventBus.js';

function extractUsage(resp){
  try {
    const u = resp?.usage;
    if (!u) return null;
    if ('input_tokens' in u || 'output_tokens' in u) {
      return { input: Number(u.input_tokens||0), output: Number(u.output_tokens||0) };
    }
    if ('prompt_tokens' in u || 'completion_tokens' in u) {
      return { input: Number(u.prompt_tokens||0), output: Number(u.completion_tokens||0) };
    }
    if ('total_tokens' in u) { return { input: Number(u.total_tokens||0), output: 0 }; }
  } catch {}
  return null;
}

export function initStageDevConsole({ mount, settingsGet, settingsSet, modelClient, endpoint }){
  const dc = DevConsole.init({ mount, settingsGet, settingsSet });
  bus.on(evt => dc.log(evt));

  const btn = document.getElementById('btn-console-stage');
  if (btn) btn.addEventListener('click', () => dc.toggle());
  document.addEventListener('keydown', e => { if (e.ctrlKey && e.key === '`') dc.toggle(); });

  const wrapped = {
    async send(payload){
      const t0 = performance.now();
      try {
        StageBus.requestSent({ model: payload?.model, endpoint });
        const resp = await modelClient.send(payload);
        StageBus.responseReceived({ usage: extractUsage(resp), durationMs: performance.now() - t0 });
        return resp;
      } catch (err) {
        StageBus.error(err);
        throw err;
      }
    }
  };
  return { devConsole: dc, client: wrapped, emitPromptBuilt: StageBus.promptBuilt };
}
