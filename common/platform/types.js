// JSDoc = implicit “interface” (works great with editors)
/**
 * @typedef {Object} Platform
 * @property {string} id
 * @property {(name:string)=>Promise<string[]>} getList
 * @property {()=>Promise<string[]>} getVoiceArchetypes
 * @property {(opts:{prompt:string})=>Promise<string>} aiComplete
 * @property {{lists:boolean, ai:boolean}} capabilities
 * @property {(gender)=>Promise{string}} getRandomName
 * 
 */

/**
 * @typedef {'short'|'medium'|'long'|string} SentenceLength
 * @typedef {'simple'|'neutral'|'rich'|string} Vocabulary
 * @typedef {'off'|'subtle'|'visible'|string} Disfluency
 */

/**
 * Normalized voice archetype object returned by providers.
 * All providers must map their source into this shape.
 * @typedef {Object} Archetype
 * @property {string} id
 * @property {string} name
 * @property {number} formality
 * @property {SentenceLength} sentenceLength
 * @property {Vocabulary} vocabulary
 * @property {Disfluency} disfluency
 * @property {string[]} emotionNames
 * @property {number[]} emotionWeights
 * @property {string[]} catchphrases
 * @property {string[]} avoidList
 * @property {'direct'|'formal'|'casual'|string} addressingStyle
 * @property {number} repguardBurst
 * @property {number} repguardDecay
 * @property {number} repguardCooling
 */
export const _ = null;
