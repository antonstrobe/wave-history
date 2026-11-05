(() => {
  const id = 'project-wave-history';
  const style = document.createElement('style');
  style.textContent = `#${id}{overflow:hidden;border:1px solid #31443a;border-radius:20px;background:#0d1712;color:#e5efe8;min-width:0}#${id} img{display:block;width:100%;aspect-ratio:16/10;object-fit:cover;background:#060808}#${id} .wave-card-body{padding:24px}#${id} .wave-card-label{font-size:11px;letter-spacing:.08em;color:#8bd9af;text-transform:uppercase}#${id} h3{font-family:inherit;font-size:25px;font-weight:600;line-height:1.2;margin:12px 0}#${id} p{font-size:14px;line-height:1.7;color:#a7baad;margin:12px 0}#${id} .wave-card-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:20px}#${id} .wave-card-actions a{padding:9px 12px;border:1px solid #385543;border-radius:8px;font-size:12px;color:#b4f5be;text-decoration:none}#${id} a:focus-visible{outline:2px solid #b4f5be;outline-offset:4px}#${id} .wave-card-actions a:hover{background:#1b3223}#${id} small{display:block;margin-top:12px;color:#718e7b;font-size:10px}`;
  document.head.append(style);
  function install() {
    const grid = document.querySelector('#projects .project-grid');
    if (!grid || document.getElementById(id)) return;
    const card = document.createElement('article'); card.id = id;
    card.innerHTML = '<a href="/wave-history/" aria-label="Открыть Wave History в браузере"><img src="/wave-history/preview.png" alt="Белые звуковые волны в трёхмерном пространстве" loading="lazy"></a><div class="wave-card-body"><span class="wave-card-label">Аудио · Three.js · Windows</span><h3>Wave History</h3><p>Звук становится объёмными волнами. Захват аудио вкладки или компьютера, история спектра с шагом 50 мс, семь видов и полный экран.</p><div class="wave-card-actions"><a href="/wave-history/">Запустить в браузере ↗</a><a href="https://github.com/antonstrobe/wave-history/releases/latest/download/Wave.History.Portable.exe">Скачать для Windows</a><a href="https://github.com/antonstrobe/wave-history" target="_blank" rel="noopener">GitHub ↗</a></div><small>На изображении демонстрационный сигнал. Для захвата своего звука потребуется разрешение браузера.</small></div>';
    grid.prepend(card);
  }
  let scheduled = false;
  const observer = new MutationObserver(() => { if (!scheduled) { scheduled = true; requestAnimationFrame(() => { scheduled = false; install(); }); } });
  if (document.body) { install(); observer.observe(document.body, { childList: true, subtree: true }); }
  else window.addEventListener('DOMContentLoaded', () => { install(); observer.observe(document.body, { childList: true, subtree: true }); }, { once: true });
})();

