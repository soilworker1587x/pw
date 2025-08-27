// stageBusHooks.js — emit helpers for Stage
import { bus } from './eventBus.js';
export const StageBus = {
  promptBuilt({ personaId, model, temperature, promptPreview }) {
    bus.emit({ type: "PROMPT_BUILT", scope: "stage", message: "Prompt built",
      data: { personaId, model, temperature, promptPreview } });
  },
  requestSent({ model, endpoint }) {
    bus.emit({ type: "REQUEST_SENT", scope: "stage", message: "Request sent",
      data: { model, endpoint } });
  },
  responseReceived({ usage, durationMs }) {
    bus.emit({ type: "RESPONSE_RECEIVED", scope: "stage", message: "Response received",
      data: { usage }, durationMs, tokens: usage || null });
  },
  error(err) {
    bus.emit({ type: "ERROR", scope: "stage", message: String(err?.message || err),
      data: { stack: String(err?.stack || "") } });
  }
};
