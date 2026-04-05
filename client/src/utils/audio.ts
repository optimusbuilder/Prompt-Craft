let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

// ── Engine hum (continuous, call start/stop) ──
let engineOsc: OscillatorNode | null = null;
let engineGain: GainNode | null = null;
let engineFilter: BiquadFilterNode | null = null;

export function startEngine() {
  const ctx = getCtx();
  if (engineOsc) return;

  engineOsc = ctx.createOscillator();
  engineGain = ctx.createGain();
  engineFilter = ctx.createBiquadFilter();

  engineOsc.type = "sawtooth";
  engineOsc.frequency.value = 80;

  engineFilter.type = "lowpass";
  engineFilter.frequency.value = 400;
  engineFilter.Q.value = 2;

  engineGain.gain.value = 0.06;

  engineOsc.connect(engineFilter);
  engineFilter.connect(engineGain);
  engineGain.connect(ctx.destination);
  engineOsc.start();
}

export function updateEngine(speed: number) {
  if (!engineOsc || !engineGain || !engineFilter) return;
  // Map speed (50-180) to pitch and volume
  const norm = Math.max(0, Math.min(1, (speed - 50) / 130));
  engineOsc.frequency.value = 60 + norm * 120;
  engineFilter.frequency.value = 300 + norm * 600;
  engineGain.gain.value = 0.04 + norm * 0.06;
}

export function stopEngine() {
  if (engineOsc) {
    engineOsc.stop();
    engineOsc.disconnect();
    engineOsc = null;
  }
  if (engineGain) { engineGain.disconnect(); engineGain = null; }
  if (engineFilter) { engineFilter.disconnect(); engineFilter = null; }
}

// ── Gunfire burst ──
export function playGunfire() {
  const ctx = getCtx();

  const noise = ctx.createBufferSource();
  const bufferSize = ctx.sampleRate * 0.06;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
  }
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 800;
  filter.Q.value = 1;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.12, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  noise.start();
  noise.stop(ctx.currentTime + 0.06);
}

// ── Hit confirmation ──
export function playHitConfirm() {
  const ctx = getCtx();

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(1200, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1800, ctx.currentTime + 0.03);

  gain.gain.setValueAtTime(0.1, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.08);
}

// ── Explosion ──
export function playExplosion() {
  const ctx = getCtx();

  const noise = ctx.createBufferSource();
  const bufferSize = ctx.sampleRate * 0.5;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15));
  }
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(400, ctx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.4);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.25, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  noise.start();
  noise.stop(ctx.currentTime + 0.5);
}

// ── Damage taken ──
export function playDamage() {
  const ctx = getCtx();

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(200, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.15);

  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.15);
}

// ── Respawn chime ──
export function playRespawn() {
  const ctx = getCtx();

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(440, ctx.currentTime);
  osc.frequency.setValueAtTime(660, ctx.currentTime + 0.1);
  osc.frequency.setValueAtTime(880, ctx.currentTime + 0.2);

  gain.gain.setValueAtTime(0.08, ctx.currentTime);
  gain.gain.setValueAtTime(0.08, ctx.currentTime + 0.25);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.35);
}
