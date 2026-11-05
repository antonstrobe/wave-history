import { BANDS, HISTORY_BANDS, HistoryBuffer, packSpectrum } from './dsp.js';
import { Terrain } from './terrain.js';
import { RhythmTracker } from './shape.js';
import { PRESETS } from './presets.js';
const $ = id => document.getElementById(id);
const desktop = location.protocol === 'wave:';
const captureSupported = !!navigator.mediaDevices?.getDisplayMedia && !!window.AudioWorkletNode;
const config = { interval: 50, seconds: 12, gain: 1.5, smoothing: 0.2 };
let history = new HistoryBuffer(240, HISTORY_BANDS), terrain;
let mode = 'idle', paused = false, busy = false, stream, context, source, processor, mute;
let demoTimer, demoTime = 0, previous = new Float32Array(HISTORY_BANDS), lastFrame = 0;
const packetRow = new Float32Array(HISTORY_BANDS);
const rhythm = new RhythmTracker();
let selectedPreset = 'radial', renderPhase = 0;
const metrics = { packets: 0, rms: 0, time: 0, intervals: [], sampleRate: 0, maxBand: 0, peakBand: 0, gaps: 0 };
if (!desktop) {
  document.body.classList.add('web');
  document.querySelectorAll('.web-only').forEach(el => { el.hidden = false; });
  $('source-title').textContent = 'Звук вкладки или экрана';
  $('source-device').textContent = 'Выберите источник в окне браузера';
  $('start-empty').textContent = 'Выбрать вкладку со звуком';
  if (!captureSupported) $('browser-support').textContent = 'Захват звука здесь недоступен. Откройте страницу в Chrome или Edge на компьютере. Демонстрация доступна и без захвата.';
}
let lastAudioTime = null;
try { terrain = new Terrain($('scene')); terrain.allocate(history.rows); terrain.update(history, config.gain); }
catch (error) { showMessage('Не удалось запустить 3D. Проверьте поддержку WebGL и драйвер видеокарты. ' + error.message); $('capture').disabled = true; $('demo').disabled = true; }
function showMessage(text) { $('message').textContent = text; $('message').hidden = false; }
function toggle(button, enabled, label, hint) {
  button.classList.toggle('active', enabled); button.setAttribute('aria-pressed', String(enabled));
  button.innerHTML = `<span class="state-mark">${enabled ? '✓' : '○'}</span><span>${label} ${enabled ? 'включена' : 'выключена'}</span>`;
  button.title = hint;
}
function updateUI() {
  const live = mode === 'live', demo = mode === 'demo';
  $('capture').classList.toggle('active', live); $('capture').setAttribute('aria-pressed', String(live));
  $('capture').innerHTML = `<span class="state-mark">${live ? '✓' : '○'}</span><span>Захват ${live ? 'включён' : 'выключен'}</span>`;
  $('capture').title = live ? 'Захват включён. Нажмите для отключения звука компьютера.' : 'Захват выключен. Нажмите для подключения звука компьютера.';
  $('demo').textContent = (demo ? '✓ ' : '') + 'Демо ' + (demo ? 'включено' : 'выключено');
  $('demo').classList.toggle('active', demo); $('demo').setAttribute('aria-pressed', String(demo));
  $('demo').title = demo ? 'Демонстрация включена. Нажмите для отключения синтетических волн.' : 'Демонстрация выключена. Нажмите для показа синтетических волн.';
  toggle($('pause'), paused, 'Пауза', paused ? 'Пауза включена. Нажмите, чтобы начать новую непрерывную историю.' : 'Пауза выключена. Нажмите, чтобы остановить историю.');
  $('source-tag').textContent = paused ? 'ПАУЗА' : live ? (desktop ? 'СИСТЕМНЫЙ ЗВУК' : 'ЗАХВАТ ЗВУКА') : demo ? 'ДЕМОНСТРАЦИЯ' : 'НЕТ ДАННЫХ';
  $('top-status').textContent = live ? 'ЗАХВАТ ВКЛЮЧЁН' : demo ? 'СИНТЕТИЧЕСКИЙ СИГНАЛ' : 'ОЖИДАНИЕ ИСТОЧНИКА';
  $('signal-dot').classList.toggle('active', live || demo);
  $('empty-state').hidden = mode !== 'idle' || history.count > 0;
  $('scene-description').textContent = demo ? 'Демонстрация: синтетические волны, без звука.' : paused ? 'История остановлена. Сцену можно вращать.' : live ? (terrain?.options.flow === 'radial' ? 'Бас в центре. Звук расходится кругами и плавно затихает.' : terrain?.options.flow === 'center' ? 'Свежий звук в центре. Волны расходятся, сохраняя форму.' : 'Новый срез каждые ' + config.interval + ' мс. Прошлое уходит в глубину.') : 'Каждая линия хранит мгновение.';
  $('source-note').textContent = demo ? 'Демо не использует аудиоустройства. Это пример формы волн.' : 'Аудио обрабатывается на этом устройстве. Запись и отправка звука не ведутся.';
  $('capture').disabled = busy || !captureSupported || !terrain; $('demo').disabled = busy || !terrain; $('start-empty').disabled = busy || !captureSupported || !terrain; $('demo-empty').disabled = busy || !terrain;
}
function clearHistory() {
  history.clear(); previous.fill(0); rhythm.reset(); lastAudioTime = null; lastFrame = 0; renderPhase = 0;
  terrain?.update(history, config.gain);
}
function addFrame(bands, rms, left = bands, right = left) {
  metrics.rms = rms; metrics.maxBand = Math.max(...bands); metrics.peakBand = bands.indexOf(metrics.maxBand);
  const db = rms > 0 ? 20 * Math.log10(rms) : -120;
  $('db').textContent = db < -90 ? '< -90 dB' : db.toFixed(1) + ' dB';
  $('signal-label').textContent = mode === 'demo' ? 'Синтетический сигнал' : db < -75 ? 'Тишина' : 'Сигнал поступает';
  $('meter-fill').style.width = Math.max(0, Math.min(100, (db + 75) / 75 * 100)) + '%';
  if (paused) return;
  packSpectrum(bands, left, right, packetRow);
  for (let b = 0; b < HISTORY_BANDS; b++) previous[b] = packetRow[b] * (1 - config.smoothing) + previous[b] * config.smoothing;
  const accent = rhythm.capture(bands, rms, config.interval / 1000);
  history.push(previous, accent); metrics.accent = accent;
  terrain?.update(history, config.gain); lastFrame = performance.now();
}
async function releaseAudio() {
  if (stream) { for (const t of stream.getTracks()) { t.onended = null; t.stop(); } stream = null; }
  source?.disconnect(); processor?.disconnect(); mute?.disconnect();
  if (processor) processor.port.onmessage = null;
  source = processor = mute = null;
  const old = context; context = null;
  if (old && old.state !== 'closed') await old.close();
}
async function stop() {
  clearInterval(demoTimer); demoTimer = null; mode = 'idle';
  await releaseAudio(); paused = false;
  $('signal-label').textContent = 'Нет данных'; $('db').textContent = '-- dB'; $('meter-fill').style.width = '0%';
  updateUI();
}
async function startCapture() {
  if (busy || !terrain) return;
  if (mode === 'live') { await stop(); return; }
  busy = true; updateUI(); $('message').hidden = true;
  try {
    await stop();
    stream = await navigator.mediaDevices.getDisplayMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, suppressLocalAudioPlayback: false },
      video: desktop ? { width: 1, height: 1, frameRate: 1 } : { displaySurface: 'browser', frameRate: 1 },
      ...(!desktop ? { systemAudio: 'include', selfBrowserSurface: 'exclude', surfaceSwitching: 'include' } : {})
    });
    const track = stream.getAudioTracks()[0];
    if (!track) throw new Error(desktop ? 'Windows не предоставила аудиопоток. Проверьте активное устройство воспроизведения.' : 'Источник выбран без звука. Выберите вкладку с аудио и отметьте «Передавать звук вкладки». Для всего ПК выберите экран и передачу системного звука, если браузер её предлагает.');
    // Electron keeps loopback alive without video. Browsers may tie both tracks to one capture session.
    // A disabled browser video track produces black frames; no video is read, recorded or transmitted.
    for (const video of stream.getVideoTracks()) { if (desktop) video.stop(); else video.enabled = false; }
    context = new AudioContext({ latencyHint: 'interactive' });
    await context.audioWorklet.addModule('./audio-worklet.js');
    processor = new AudioWorkletNode(context, 'history-processor', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], channelCount: 2, channelCountMode: 'explicit', channelInterpretation: 'speakers' });
    processor.port.postMessage({ interval: config.interval });
    source = context.createMediaStreamSource(new MediaStream([track]));
    mute = context.createGain(); mute.gain.value = 0;
    source.connect(processor).connect(mute).connect(context.destination);
    clearHistory(); mode = 'live'; metrics.packets = 0; metrics.intervals = []; metrics.sampleRate = context.sampleRate;
    processor.port.onmessage = ({ data }) => {
      if (mode !== 'live') return;
      metrics.packets++; metrics.time = data.time;
      if (lastAudioTime !== null) {
        const delta = (data.time - lastAudioTime) * 1000;
        metrics.intervals.push(delta); if (metrics.intervals.length > 160) metrics.intervals.shift();
        const missing = Math.min(history.rows, Math.max(0, Math.round(delta / config.interval) - 1));
        if (!paused && missing) { previous.fill(0); for (let i = 0; i < missing; i++) history.push(previous); metrics.gaps += missing; }
      }
      lastAudioTime = data.time; addFrame(data.bands, data.rms, data.leftBands, data.rightBands);
    };
    track.onended = async () => { if (mode === 'live') { await stop(); showMessage('Передача звука завершена. Можно выбрать источник снова.'); } };
    await context.resume();
  } catch (error) {
    await stop();
    showMessage(!desktop && error.name === 'NotAllowedError' ? 'Разрешение на захват не получено. Нажмите кнопку и выберите источник со звуком.' : 'Не удалось подключить звук. ' + error.message);
  } finally { busy = false; updateUI(); }
}
function demoBands(t) {
  return Float32Array.from({ length: BANDS }, (_, b) => {
    const x = b / (BANDS - 1);
    const a = Math.exp(-(((x - 0.23 - 0.07 * Math.sin(t * .7)) / .12) ** 2)) * (.43 + .14 * Math.sin(t * 1.7));
    const c = Math.exp(-(((x - .57 - .11 * Math.sin(t * .4)) / .1) ** 2)) * (.36 + .17 * Math.sin(t * 2.1));
    const d = Math.exp(-(((x - .8) / .06) ** 2)) * (.12 + .09 * Math.sin(t * 3));
    return Math.max(0, a + c + d + .026 * Math.sin(x * 170 + t * 4) + .018 * Math.sin(x * 340 - t * 9));
  });
}
async function startDemo() {
  if (busy || !terrain) return;
  if (mode === 'demo') { await stop(); return; }
  await stop(); $('message').hidden = true; clearHistory(); mode = 'demo'; demoTime = config.seconds;
  for (let r = 0; r < history.rows; r++) { const t = r * config.interval / 1000, bands = demoBands(t + .4); history.push(packSpectrum(bands, demoBands(t), demoBands(t + .8)), rhythm.capture(bands, demoRms(t), config.interval / 1000)); }
  previous.set(packSpectrum(demoBands(demoTime + .4), demoBands(demoTime), demoBands(demoTime + .8))); terrain.update(history, config.gain);
  demoTimer = setInterval(demoTick, config.interval);
  updateUI();
}
function demoTick() {
  if (!paused) { demoTime += config.interval / 1000; addFrame(demoBands(demoTime + .4), demoRms(demoTime), demoBands(demoTime), demoBands(demoTime + .8)); }
}
function demoRms(t) { return .04 + .12 * Math.exp(-(t % .5) / .06); }
function rebuildHistory() {
  history = new HistoryBuffer(Math.round(config.seconds * 1000 / config.interval), HISTORY_BANDS);
  terrain?.allocate(history.rows); clearHistory();
  $('row-count').textContent = history.rows; $('interval-value').textContent = config.interval + ' мс';
  $('history-value').textContent = config.seconds + ' сек'; $('slice-rate').textContent = (1000 / config.interval).toLocaleString('ru-RU', { maximumFractionDigits: 1 }) + ' срезов / сек';
  processor?.port.postMessage({ interval: config.interval });
  if (mode === 'demo') { clearInterval(demoTimer); demoTimer = setInterval(demoTick, config.interval); }
  updateUI();
}
$('capture').onclick = startCapture; $('start-empty').onclick = startCapture;
$('demo').onclick = startDemo; $('demo-empty').onclick = startDemo;
$('pause').onclick = () => { paused = !paused; if (!paused) clearHistory(); updateUI(); };
$('clear').onclick = () => { clearHistory(); updateUI(); };
$('reset-camera').onclick = () => terrain?.resetCamera();
for (const id of ['interval', 'history']) $(id).oninput = event => { config[id === 'history' ? 'seconds' : 'interval'] = +event.target.value; rebuildHistory(); };
$('gain').oninput = event => { config.gain = +event.target.value; $('gain-value').textContent = config.gain.toFixed(1) + '×'; terrain?.update(history, config.gain); };
$('smoothing').oninput = event => { config.smoothing = event.target.value / 100; $('smoothing-value').textContent = event.target.value + '%'; };
for (const id of ['longitudinal', 'slices']) $(id).onclick = () => {
  terrain?.setMode(id);
  updateLineUI();
};
function updateLineUI() {
  const radial = terrain?.options.flow === 'radial';
  for (const name of ['longitudinal', 'slices']) {
    const chosen = name === terrain?.mode, label = radial ? (name === 'longitudinal' ? 'Кольца' : 'Волны') : (name === 'longitudinal' ? 'Дорожки' : 'Срезы');
    $(name).classList.toggle('selected', chosen); $(name).setAttribute('aria-pressed', String(chosen));
    $(name).textContent = (chosen ? '✓ ' : '') + label;
    $(name).title = (chosen ? 'Выбран режим: ' : 'Переключить на режим: ') + label.toLowerCase();
  }
}
const effectControls = [
  ['mirror', 'mirror-status', 'mirrored', 'Стереозеркало включено', 'Стереозеркало выключено'],
  ['taper', 'taper-status', 'taper', 'Затухание следа включено', 'Затухание следа выключено'],
  ['variation', 'variation-status', 'variation', 'Лёгкая асимметрия включена', 'Лёгкая асимметрия выключена'],
  ['black-surface', 'black-status', 'black', 'Чёрная поверхность включена', 'Чёрная поверхность выключена'],
  ['random-colors', 'colors-status', 'colors', 'Случайные цвета включены', 'Случайные цвета выключены'],
  ['mountains', 'mountains-status', 'mountains', 'Горный рельеф включён', 'Горный рельеф выключен'],
  ['flight', 'flight-status', 'flight', 'Полёт включён', 'Полёт выключен']
];
function updateEffectsUI() {
  if (!terrain) return;
  const opts = terrain.options;
  for (const [id, status, key, on, off] of effectControls) {
    $(id).checked = opts[key]; $(status).textContent = opts[key] ? on : off;
    const hint = (opts[key] ? on : off) + '. Нажмите, чтобы ' + (opts[key] ? 'выключить.' : 'включить.');
    $(id).title = hint; $(id).closest('label').title = hint;
  }
  $('transparency').value = opts.transparency; $('transparency').disabled = !opts.black;
  $('transparency-value').textContent = opts.transparency + '%';
  $('variation-amount').value = opts.variationAmount; $('variation-amount').disabled = !opts.variation || (!opts.mirrored && opts.flow !== 'radial');
  $('variation-value').textContent = opts.variationAmount + '%';
  const labels = opts.mirrored ? ['16 кГц · L', 'Левый канал', '35 Гц · БАС · 35 Гц', 'Правый канал', 'R · 16 кГц'] : ['35 Гц', 'Низкие', 'Средние', 'Высокие', '16 кГц'];
  document.querySelectorAll('.axis span').forEach((node, i) => node.textContent = labels[i]);
  document.querySelector('.axis').hidden = opts.flow === 'radial';
  $('mirror-help').textContent = opts.flow === 'radial' ? 'Левый и правый каналы формируют разные стороны круга. Бас управляет горкой в центре.' : 'Левый канал слева, правый справа. Бас в центре, высокие частоты по краям.';
  updateLineUI();
  $('reset-camera').disabled = opts.flight;
  $('reset-camera').title = opts.flight ? 'Автокамера включена. Выключите полёт, чтобы управлять видом.' : 'Вернуть исходное положение камеры и центр сцены.';
}
for (const [id, , key] of effectControls) $(id).onchange = event => { terrain?.setOptions({ [key]: event.target.checked }, history, config.gain); markCustom(); updateEffectsUI(); };
$('transparency').oninput = event => { terrain?.setOptions({ transparency: +event.target.value }, history, config.gain); markCustom(); updateEffectsUI(); };
$('variation-amount').oninput = event => { terrain?.setOptions({ variationAmount: +event.target.value }, history, config.gain); markCustom(); updateEffectsUI(); };
function saveView() {
  if (!terrain || new URLSearchParams(location.search).has('test')) return;
  try { localStorage.setItem('wave-view-v2', JSON.stringify({ preset: selectedPreset, view: terrain.options })); } catch {}
}
function showPreset() {
  const preset = PRESETS.find(p => p.id === selectedPreset);
  $('visual-preset').value = selectedPreset;
  $('preset-active').textContent = preset ? '✓ Выбран: ' + preset.name : '✓ Свои настройки';
  $('preset-description').textContent = preset?.description || 'Текущий вариант изменён вручную. Готовые варианты доступны в списке.';
}
function markCustom() { selectedPreset = 'custom'; showPreset(); saveView(); }
function applyPreset(id) {
  const preset = PRESETS.find(p => p.id === id); if (!preset || !terrain) return;
  terrain.setOptions(preset.view, history, config.gain);
  $(terrain.options.flow === 'radial' ? 'slices' : 'longitudinal').click();
  if (!terrain.options.flight) terrain.resetCamera();
  selectedPreset = id; updateEffectsUI(); showPreset(); updateUI(); saveView();
}
$('visual-preset').onchange = event => applyPreset(event.target.value);
if (!new URLSearchParams(location.search).has('test')) {
  try {
    const saved = JSON.parse(localStorage.getItem('wave-view-v2'));
    if (saved && PRESETS.some(p => p.id === saved.preset)) applyPreset(saved.preset);
    else if (saved?.preset === 'custom' && saved.view) {
      const valid = {};
      for (const [key, value] of Object.entries(saved.view)) {
        if (!(key in terrain.options)) continue;
        if (typeof terrain.options[key] === 'boolean' && typeof value === 'boolean') valid[key] = value;
        if (key === 'transparency' && Number.isFinite(value)) valid[key] = Math.min(100, Math.max(0, value));
        if (key === 'variationAmount' && Number.isFinite(value)) valid[key] = Math.min(8, Math.max(0, value));
        if (key === 'flow' && ['radial', 'center', 'ribbon'].includes(value)) valid[key] = value;
      }
      terrain.setOptions(valid, history, config.gain); selectedPreset = 'custom';
    }
  } catch {}
}
showPreset();
updateEffectsUI();
let cursorTimer;
function cursorActivity() {
  clearTimeout(cursorTimer); document.body.classList.remove('hide-cursor');
  if (document.body.classList.contains('immersive')) cursorTimer = setTimeout(() => document.body.classList.add('hide-cursor'), 1200);
}
function setImmersive(enabled) {
  document.body.classList.toggle('immersive', enabled);
  if (terrain) terrain.renderer.domElement.title = enabled ? '' : terrain.help;
  cursorActivity();
}
async function fullscreen() {
  try {
    if (document.fullscreenElement) { await document.exitFullscreen(); setImmersive(false); }
    else { await document.documentElement.requestFullscreen({ navigationUI: 'hide' }); setImmersive(true); }
  } catch (error) { setImmersive(false); showMessage('Не удалось перейти на полный экран. ' + error.message); }
}
$('fullscreen').onclick = fullscreen; $('clean-fullscreen').onclick = fullscreen;
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) setImmersive(false); });
window.addEventListener('pointermove', cursorActivity);
window.addEventListener('keydown', event => {
  if (event.code === 'F11') { event.preventDefault(); if (!event.repeat) fullscreen(); }
  if (event.code === 'Space' && !['INPUT', 'BUTTON', 'SELECT'].includes(document.activeElement.tagName)) { event.preventDefault(); $('pause').click(); }
  if (event.code === 'KeyH' && !['INPUT', 'SELECT'].includes(document.activeElement.tagName)) setImmersive(!document.body.classList.contains('immersive'));
  if (event.code === 'Escape') { setImmersive(false); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); }
});
window.addEventListener('beforeunload', () => { clearInterval(demoTimer); clearTimeout(cursorTimer); stream?.getTracks().forEach(track => track.stop()); context?.close(); });
let frames = 0, fpsAt = performance.now(), lastRender = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  const running = mode !== 'idle' && !paused;
  if (running && lastFrame) renderPhase = Math.min(1, (now - lastFrame) / config.interval);
  terrain?.render(renderPhase, Math.min(.1, (now - lastRender) / 1000), running);
  lastRender = now;
  frames++; if (now - fpsAt >= 1000) { $('fps').textContent = Math.round(frames * 1000 / (now - fpsAt)) + ' FPS'; frames = 0; fpsAt = now; }
}
requestAnimationFrame(animate); updateUI();
if (new URLSearchParams(location.search).has('test')) {
  window.waveTest = { trace: stamp => terrain?.trace(history, stamp), snapshot: () => ({ mode, paused, busy, rows: history.rows, count: history.count, latestStamp: history.stamp(0), preset: selectedPreset, metrics: structuredClone(metrics), config: { ...config }, view: terrain?.diagnostics(), immersive: document.body.classList.contains('immersive'), audioState: context?.state ?? 'closed', tracks: stream?.getTracks().map(t => ({ kind: t.kind, state: t.readyState })) || [], heights: terrain ? [terrain.maxHeight] : [], glError: terrain?.renderer.getContext().getError() }) };
}
