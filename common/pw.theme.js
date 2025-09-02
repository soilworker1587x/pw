// pw.theme.js — shared theme switcher (dark/light)
export function initThemeSwitch(sel = '#themeSwitch', { defaultTheme = 'dark' } = {}) {
  const btn = document.querySelector(sel);
  if (!btn) return;

  const saved = localStorage.getItem('theme');
  let theme = saved || defaultTheme;

  apply(theme);

  function apply(t){
    document.documentElement.dataset.theme = t;
    btn.setAttribute('aria-checked', String(t === 'dark'));
    localStorage.setItem('theme', t);
  }

  btn.addEventListener('click', () => apply(theme = theme === 'dark' ? 'light' : 'dark'));
  btn.addEventListener('keydown', e => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); btn.click(); }
  });

  return { get theme(){ return theme; }, setTheme: t => apply(theme = t) };
}

// auto-init
document.addEventListener('DOMContentLoaded', () => initThemeSwitch());
