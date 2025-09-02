import { StageBus } from '../../common/stageBusHooks.js';

export function dcEmit(type, payload){
    try {
      if (type === 'PROMPT_BUILT') StageBus.promptBuilt(payload);
      if (type === 'REQUEST_SENT') StageBus.requestSent(payload);
      if (type === 'RESPONSE_RECEIVED') StageBus.responseReceived(payload);
      if (type === 'ERROR') StageBus.error(payload);
    } catch {}
  }