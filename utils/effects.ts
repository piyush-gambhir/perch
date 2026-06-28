/**
 * Browser-only flourishes: a synthesized "swoosh" close sound (Web Audio) and a
 * confetti burst (requestAnimationFrame particles). No assets, no libraries.
 */

// Runtime prefs, updated from settings so effects stay decoupled from React.
let enableSound = true;
let enableConfetti = true;

/** Update effect preferences (called when settings change). */
export function configureEffects(prefs: { sound?: boolean; confetti?: boolean }): void {
  if (typeof prefs.sound === 'boolean') enableSound = prefs.sound;
  if (typeof prefs.confetti === 'boolean') enableConfetti = prefs.confetti;
}

/** Play a clean "swoosh" when tabs close. Fails silently if audio is unavailable. */
export function playCloseSound(): void {
  if (!enableSound) return;
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const t = ctx.currentTime;

    const duration = 0.25;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const pos = i / data.length;
      const env = pos < 0.1 ? pos / 0.1 : Math.pow(1 - (pos - 0.1) / 0.9, 1.5);
      data[i] = (Math.random() * 2 - 1) * env;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 2.0;
    filter.frequency.setValueAtTime(4000, t);
    filter.frequency.exponentialRampToValueAtTime(400, t + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start(t);

    setTimeout(() => ctx.close(), 500);
  } catch {
    /* audio not supported */
  }
}

// Grayscale set — spans light & dark so some particles show on either background.
const CONFETTI_COLORS = ['#ffffff', '#e5e5e5', '#a3a3a3', '#737373', '#404040', '#171717'];

/** Shoot a confetti burst from screen coordinates (usually a closing card's center). */
export function shootConfetti(x: number, y: number): void {
  if (!enableConfetti) return;
  const particleCount = 17;

  for (let i = 0; i < particleCount; i++) {
    const el = document.createElement('div');
    const isCircle = Math.random() > 0.5;
    const size = 5 + Math.random() * 6;
    const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];

    el.style.cssText = `
      position: fixed;
      left: ${x}px;
      top: ${y}px;
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      border-radius: ${isCircle ? '50%' : '2px'};
      pointer-events: none;
      z-index: 9999;
      transform: translate(-50%, -50%);
      opacity: 1;
    `;
    document.body.appendChild(el);

    const angle = Math.random() * Math.PI * 2;
    const speed = 60 + Math.random() * 120;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed - 80;
    const gravity = 200;

    const startTime = performance.now();
    const duration = 700 + Math.random() * 200;

    function frame(now: number) {
      const elapsed = (now - startTime) / 1000;
      const progress = elapsed / (duration / 1000);
      if (progress >= 1) {
        el.remove();
        return;
      }
      const px = vx * elapsed;
      const py = vy * elapsed + 0.5 * gravity * elapsed * elapsed;
      const opacity = progress < 0.5 ? 1 : 1 - (progress - 0.5) * 2;
      const rotate = elapsed * 200 * (isCircle ? 0 : 1);
      el.style.transform = `translate(calc(-50% + ${px}px), calc(-50% + ${py}px)) rotate(${rotate}deg)`;
      el.style.opacity = String(opacity);
      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }
}

/** Fire confetti from the center of an element's bounding box. */
export function confettiFromElement(el: Element): void {
  const rect = el.getBoundingClientRect();
  shootConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
}
