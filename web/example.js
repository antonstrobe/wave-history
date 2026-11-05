const button = document.querySelector('#sound'), volume = document.querySelector('#volume');
let context, output, timer, nextBeat = 0, beat = 0;
function voice(time, frequency, duration, level, kick = false) {
  const oscillator = context.createOscillator(), gain = context.createGain();
  oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(frequency, time);
  if (kick) oscillator.frequency.exponentialRampToValueAtTime(45, time + .14);
  gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(level, time + .006); gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
  oscillator.connect(gain).connect(output); oscillator.start(time); oscillator.stop(time + duration + .03);
  oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
}
function schedule() {
  while (context && nextBeat < context.currentTime + .2) {
    const root = [110, 130.81, 98, 146.83][Math.floor(beat / 8) % 4];
    if (beat % 2 === 0) voice(nextBeat, 100, .24, .6, true);
    voice(nextBeat, root / 2, .23, .23);
    if (beat % 4 === 0) for (const ratio of [1, 1.25, 1.5]) voice(nextBeat, root * ratio * 2, .7, .08);
    voice(nextBeat, 2200 + (beat % 3) * 700, .04, .025);
    nextBeat += 60 / 110 / 2; beat++;
  }
}
async function stop() {
  clearInterval(timer); timer = null;
  const previous = context; context = null; if (previous) await previous.close();
  button.classList.remove('active'); button.setAttribute('aria-pressed', 'false');
  button.textContent = '○ Тестовый звук выключен'; button.title = 'Тестовый звук выключен. Нажмите для воспроизведения.';
}
button.onclick = async () => {
  if (context) { await stop(); return; }
  try {
    context = new AudioContext(); output = context.createGain(); output.gain.value = volume.value / 100;
    output.connect(context.destination); await context.resume(); nextBeat = context.currentTime + .03; beat = 0;
    schedule(); timer = setInterval(schedule, 80);
    button.classList.add('active'); button.setAttribute('aria-pressed', 'true');
    button.textContent = '✓ Тестовый звук включён'; button.title = 'Тестовый звук включён. Нажмите, чтобы остановить.';
    document.querySelector('#example-status').textContent = 'Играет синтетический тестовый звук. Теперь выберите эту вкладку в окне захвата Wave History.';
  } catch { await stop(); document.querySelector('#example-status').textContent = 'Не удалось запустить аудио. Проверьте устройство воспроизведения.'; }
};
volume.oninput = () => { document.querySelector('#volume-value').textContent = volume.value + '%'; if (context) output.gain.setTargetAtTime(volume.value / 100, context.currentTime, .05); };
window.addEventListener('pagehide', stop);
