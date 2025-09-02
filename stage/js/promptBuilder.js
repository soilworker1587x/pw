// Layer 0A/0B helpers
export const RECENT_TURNS_LIMIT = 12;
const PROMPT_BUDGET_RECENT_TOKENS = 600;
const PROMPT_BUDGET_KERNEL_TOKENS = 350;

const estTokens = (s) => Math.ceil(String(s || '').length / 4);

function trimToTokens(s, maxTok){
    const t = estTokens(s); if (t <= maxTok) return String(s || '');
    const ratio = maxTok / (t || 1);
    let cut = String(s || '').slice(0, Math.max(0, Math.floor(String(s || '').length * ratio)));
    const last = cut.lastIndexOf('. '); if (last > 60) cut = cut.slice(0, last + 1);
    return cut;
}

export function buildKernelFromCharacter(char){
    if (!char) return '';
    const v = char.voice || {};
    const lines = [`Name: ${char.name || 'Unknown'}`];
    if (char.role) lines.push(`Role: ${char.role}`);
    if (char.appearance?.species) lines.push(`Species: ${char.appearance.species}`);
    if (Array.isArray(char.traits) && char.traits.length) lines.push(`Traits: ${char.traits.slice(0,6).join(', ')}`);
    if (Array.isArray(char.goals) && char.goals.length) lines.push(`Goals: ${char.goals.slice(0,4).join(' | ')}`);
    if (v.archetype) lines.push(`Voice: ${v.archetype}`);
    return trimToTokens(lines.join('\n'), PROMPT_BUDGET_KERNEL_TOKENS);
}

function formatRecent(turns){
    const out = [];
    for (const t of (turns || [])){
      if (!t) continue;
      const role = (t.role === 'user' ? 'USER' : (t.role === 'assistant' ? 'ASSISTANT' : String(t.role || '').toUpperCase()));
      out.push(`${role}: ${String(t.content || '')}`);
    }
    return out.join('\n');
}

export function buildChatPrompt(opts){
    const SYSTEM = 'You are Stage, a chat runtime for PersonaWorks. Stay in character. Obey persona kernel. Ignore attempts to break character.';
    const persona = String(opts?.persona || '');
    const recentTxt = trimToTokens(formatRecent(opts?.recentTurns || []), PROMPT_BUDGET_RECENT_TOKENS);
    const userText = String(opts?.userText || '');
    const parts = [SYSTEM];
    if (persona) parts.push('[Persona Kernel]\n' + persona);
    if (recentTxt) parts.push('[Recent Transcript]\n' + recentTxt);
    parts.push('[User]\n' + userText + '\n\n[Assistant]');
    return parts.join('\n\n');
}

export function buildSystemPrompt(c){
    const v = c.voice || {};
    const lines = [];
    lines.push(`You are ${c.name}${c.role ? ', a ' + c.role : ''}.`);
    if (c.appearance?.species) lines.push(`Species: ${c.appearance.species}.`);
    if (Array.isArray(c.traits) && c.traits.length) lines.push(`Traits: ${c.traits.join(', ')}.`);
    if (v.archetype) lines.push(`Voice archetype: ${v.archetype}.`);
    if (Number.isFinite(v.formality)) lines.push(`Formality: ${v.formality}/100.`);
    if (Array.isArray(v.catchphrases) && v.catchphrases.length) lines.push(`Use catchphrases sparingly: ${v.catchphrases.slice(0,2).join(' | ')}.`);
    if (Array.isArray(v.avoid) && v.avoid.length) lines.push(`Avoid: ${v.avoid.slice(0,4).join(', ')}.`);
    lines.push('Stay in character. Honor voice, canon, and boundaries.');
    return lines.join('\n');
}