// build.js — bundle (esbuild) + inline for Perchance
// Usage:
//   node build.js studio
//   node build.js studio --out dist/studio.html
//   node build.js studio --entry ./js/studio.module.js
//   node build.js studio --iife           # force classic <script> bundle (default is ESM)
//   node build.js studio --wrap-ready     # ensure code runs after DOM is ready
//   node build.js studio --perchance-only # exclude platforms/local.js from the bundle
//   node build.js studio --verbose
//
// Requires: npm i -D esbuild

const fs = require('fs');
const path = require('path');
let esbuild; try { esbuild = require('esbuild'); } catch { console.error('npm i -D esbuild'); process.exit(1); }

const mode = process.argv[2];
if (!mode) { console.error('Usage: node build.js <folder> [--out <file>] [--entry <path>] [--iife] [--wrap-ready] [--perchance-only] [--verbose]'); process.exit(1); }
const arg = k => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i+1] : null; };
const has = k => process.argv.includes(k);

const OUT_PATH        = arg('--out');
const CLI_ENTRY       = arg('--entry');
const VERBOSE         = has('--verbose');
const FORCE_IIFE      = has('--iife');        // default is ESM (module)
const WRAP_READY      = has('--wrap-ready');  // wrap injected JS to run after DOM is ready
const PERCHANCE_ONLY  = has('--perchance-only');

const root = __dirname;
const dir  = path.join(root, mode);
const htmlPath = path.join(dir, `${mode}.html`);
if (!fs.existsSync(htmlPath)) { console.error(`Missing ${htmlPath}`); process.exit(1); }
let html = fs.readFileSync(htmlPath, 'utf8');

const linkRe   = /<link\s+[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>\s*/ig;
const scriptRe = /<script\s+([^>]*?)src=["']([^"']+)["']([^>]*)>\s*<\/script>\s*/ig;
const isRemote = u => /^(https?:)?\/\//i.test(u);

const norm = p => {
  if (!p) return p;
  let s = String(p).trim().replace(/\\/g,'/');
  if (/^https?:\/\//i.test(s) || s.startsWith('data:')) return s;
  if (s.startsWith('/')) s = '.'+s;
  if (!(s.startsWith('./') || s.startsWith('../'))) s = './'+s;
  return s;
};
const readLocal = rel => {
  const full = path.resolve(dir, rel);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : null;
};
const existsLocal = rel => fs.existsSync(path.resolve(dir, rel));

// Prevent inline parser traps: </script>, <!--, </style>
const escapeInlineJs = code =>
  String(code)
    .replace(/<\/script/gi, '<\\/script')
    .replace(/<!--/g, '\\x3C!--');
const escapeInlineCss = css =>
  String(css).replace(/<\/style/gi, '<\\/style');

// Optional wrapper to ensure code runs after DOM is ready
const wrapReady = (code) => {
  if (!WRAP_READY) return code;
  return `(function(){function __pwReady(f){if(document.readyState!=='loading'){Promise.resolve().then(f);return;}document.addEventListener('DOMContentLoaded',f,{once:true});}__pwReady(function(){\n${code}\n});})();`;
};

// Safe injection at the *last* closing tag (avoid false positives inside script strings)
function injectBeforeClosingTag(doc, tag, content) {
  const needle = `</${tag}>`;
  const idx = doc.toLowerCase().lastIndexOf(needle.toLowerCase());
  if (idx === -1) throw new Error(`HTML missing ${needle}`);
  return doc.slice(0, idx) + content + doc.slice(idx);
}

// collect local CSS/JS (keep remotes in HTML)
const cssHrefs = [];
html = html.replace(linkRe, (tag, href) => isRemote(href) ? tag : (cssHrefs.push(norm(href)), ''));

const moduleTags = []; // keep HTML order
const classicSrcs = [];
html = html.replace(scriptRe, (full, before, src, after) => {
  if (isRemote(src)) return full;
  const attrs = `${before||''} ${after||''}`;
  const isModule = /\btype\s*=\s*["']module["']/.test(attrs);
  const n = norm(src);
  if (isModule) moduleTags.push(n);
  else classicSrcs.push(n);
  return '';
});

// theme.css (optional at repo root)
const themePath = path.join(root, 'theme.css');
const themeCss  = fs.existsSync(themePath) ? fs.readFileSync(themePath, 'utf8') : '';

// diagnostics
const missingCss  = cssHrefs.filter(p => !existsLocal(p));
const missingMods = moduleTags.filter(p => !existsLocal(p));
if (missingCss.length)  console.warn('WARN missing CSS:', missingCss.join(', '));
if (missingMods.length) console.warn('WARN missing modules:', missingMods.join(', '));
console.log(`Found: CSS=${cssHrefs.length}, modules=${moduleTags.length}, classic=${classicSrcs.length}`);

// -------- tiny plugin: exclude platforms/local.js when --perchance-only --------
const excludeLocalPlugin = {
  name: 'exclude-local',
  setup(build) {
    if (!PERCHANCE_ONLY) return;
    // Match any import that ends with /platforms/local.js (relative or absolute)
    const filter = /(^|\/)platforms\/local\.js$/;
    build.onResolve({ filter }, args => {
      return { path: args.path, namespace: 'pw-shim' };
    });
    build.onLoad({ filter: /.*/, namespace: 'pw-shim' }, () => {
      // Minimal stub so static import resolves but contributes no code
      const contents = `
        const noop = async () => undefined;
        export default {
          id: 'local',
          capabilities: { lists: false, ai: false },
          getList: async () => [],
          getVoiceArchetypes: async () => [],
          getArchetype: async () => null,
          aiComplete: async () => ''
        };
      `;
      return { contents, loader: 'js' };
    });
  }
};

// -------- bundle CSS (preserve order) --------
async function bundleCss() {
  if (!cssHrefs.length && !themeCss) return '';
  let synthetic = '';
  if (themeCss) synthetic += `/* theme.css */\n${themeCss}\n`;
  for (const href of cssHrefs) synthetic += `@import "${href}";\n`;

  const result = await esbuild.build({
    stdin: { contents: synthetic, resolveDir: dir, sourcefile: 'inline.css', loader: 'css' },
    absWorkingDir: dir,
    outfile: 'bundle.css',
    bundle: true, write: false, minify: false, logLevel: 'silent',
    loader: {
      '.css':'css',
      '.png':'dataurl','.jpg':'dataurl','.jpeg':'dataurl','.gif':'dataurl',
      '.webp':'dataurl','.svg':'text',
      '.woff':'dataurl','.woff2':'dataurl','.ttf':'dataurl','.eot':'dataurl'
    }
  });
  if (result.outputFiles && result.outputFiles.length && VERBOSE) {
    console.log('CSS outputs:', result.outputFiles.map(f => f.path));
  }
  const out = result.outputFiles.find(f => f.path.endsWith('bundle.css')) || result.outputFiles[0];
  return out ? out.text : '';
}

// -------- bundle modules (ESM by default; IIFE if --iife) --------
async function bundleModules() {
  const format = FORCE_IIFE ? 'iife' : 'esm';
  const outfile = FORCE_IIFE ? 'bundle.js' : 'bundle.mjs';

  const buildCfg = {
    absWorkingDir: dir,
    outfile,
    bundle: true, format,
    treeShaking: false, keepNames: true,
    platform: 'browser', target: 'es2018',
    write: false, minify: false, logLevel: 'silent',
    define: { 'process.env.NODE_ENV': '"production"' },
    loader: {
      '.css':'css',
      '.png':'dataurl','.jpg':'dataurl','.jpeg':'dataurl','.gif':'dataurl',
      '.webp':'dataurl','.svg':'text',
      '.woff':'dataurl','.woff2':'dataurl','.ttf':'dataurl','.eot':'dataurl'
    },
    plugins: [excludeLocalPlugin] // <— exclude platforms/local.js if flagged
  };

  let res;
  if (CLI_ENTRY) {
    const entryAbs = path.resolve(dir, norm(CLI_ENTRY));
    console.log(`Module entry (CLI, ${format}):`, path.relative(root, entryAbs));
    res = await esbuild.build({ ...buildCfg, entryPoints: [entryAbs] });
  } else if (moduleTags.length) {
    const synthetic = moduleTags.map(s => `import "${s}";`).join('\n') + `\n;window.__PW_BOOT__=true;\n`;
    res = await esbuild.build({
      ...buildCfg,
      stdin: { contents: synthetic, resolveDir: dir, sourcefile: 'all-modules.mjs', loader: 'js' }
    });
  } else {
    return { js:'', css:'', format };
  }

  if (res.outputFiles && res.outputFiles.length && VERBOSE) {
    console.log('Module outputs:', res.outputFiles.map(f => f.path));
  }
  const jsOut  = res.outputFiles.find(f => f.path.endsWith(outfile)) || res.outputFiles.find(f => /\.(m?js)$/.test(f.path));
  const cssOut = res.outputFiles.filter(f => f.path.endsWith('.css'));
  return { js: jsOut ? jsOut.text : '', css: cssOut.map(f => f.text).join('\n'), format };
}

// -------- inline classic (shallow) --------
function inlineClassic() {
  if (!classicSrcs.length) return '';
  let buf = '';
  for (const src of classicSrcs) {
    const code = readLocal(src);
    if (code == null) { console.warn(`WARN classic not found: ${src}`); continue; }
    buf += `/* ${src} */\n${code}\n\n`;
  }
  return buf;
}

// -------- build & inject --------
(async () => {
  const cssBundled = await bundleCss();
  const modBundle  = await bundleModules(); // { js, css, format }
  const classicJs  = inlineClassic();

  const cssCombined = [cssBundled, modBundle.css].filter(Boolean).map(escapeInlineCss).join('\n');
  const cssBlock    = cssCombined ? `<style>\n${cssCombined}\n</style>\n` : '';

  const classicBlock = classicJs
    ? `<script>\n${wrapReady(escapeInlineJs(classicJs))}\n</script>\n`
    : '';

  const moduleBlock = modBundle.js
    ? (modBundle.format === 'esm'
        ? `<script type="module">\n${wrapReady(escapeInlineJs(modBundle.js))}\n</script>\n`
        : `<script>\n${wrapReady(escapeInlineJs(modBundle.js))}\n</script>\n`)
    : '';

  // Use LAST </head> and </body> to avoid matching strings inside inline code
  html = injectBeforeClosingTag(html, 'head', cssBlock);
  html = injectBeforeClosingTag(html, 'body', `${classicBlock}${moduleBlock}`);

  const outFile = OUT_PATH ? path.resolve(root, OUT_PATH) : path.join(root, `${mode}-merged.html`);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, html, 'utf8');

  console.log([
    `Built ${path.relative(root, outFile)}`,
    `- CSS: ${cssHrefs.length} local link(s) bundled`,
    `- JS (classic): ${classicSrcs.length} local script(s) inlined`,
    `- JS (module): format=${modBundle.format || 'n/a'} (${moduleTags.length} tag(s))`,
    WRAP_READY ? '- Wrap-ready: enabled' : '',
    PERCHANCE_ONLY ? '- Excluded: platforms/local.js' : ''
  ].filter(Boolean).join('\n'));
})().catch(err => { console.error(err); process.exit(1); });
