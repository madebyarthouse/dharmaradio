import { useEffect, useRef } from "react";
import { VoiceAnalyser, canAnalyseVoice } from "~/lib/voice-analyser";
import { cn } from "~/lib/cn";

type Rgb = [number, number, number];

/** Resolve a CSS colour (oklch tokens included) to RGB through a 1px canvas. */
function resolveColor(css: string): Rgb {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [230, 160, 80];
  ctx.fillStyle = css;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
}

const rgba = ([r, g, b]: Rgb, a: number) => `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a)).toFixed(3)})`;

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * A light that listens: a saffron glow behind the artwork that swells with the
 * speaker's voice, and slow rings that leave it when a phrase begins. Calm by
 * design, heavily smoothed. With no audio to analyse it breathes on its own;
 * under reduced motion it only brightens and dims.
 */
export function Visualizer({
  talkId,
  playing,
  getMediaElement,
  className,
}: {
  talkId: number;
  playing: boolean;
  getMediaElement: () => HTMLAudioElement | null;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playingRef = useRef(playing);
  playingRef.current = playing;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const styles = getComputedStyle(canvas);
    const accent = resolveColor(styles.getPropertyValue("--accent").trim() || "orange");
    const core = resolveColor(styles.getPropertyValue("--sun-core").trim() || "white");
    const reduced = prefersReducedMotion();

    let analyser: VoiceAnalyser | null = null;
    const connect = () => {
      const main = getMediaElement();
      if (analyser || !main || !canAnalyseVoice() || document.visibilityState !== "visible") return;
      const next = new VoiceAnalyser(main, `/audio/${talkId}`);
      if (next.start()) analyser = next;
    };
    const disconnect = () => {
      analyser?.dispose();
      analyser = null;
    };
    // Hidden pages never keep a second stream or an AudioContext alive.
    const onVisibility = () => (document.visibilityState === "visible" ? connect() : disconnect());
    document.addEventListener("visibilitychange", onVisibility);
    connect();

    let width = 0;
    let height = 0;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const box = canvas.getBoundingClientRect();
      width = box.width;
      height = box.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    let level = 0;
    let baseline = 0;
    let lastRing = 0;
    let lastReport = 0;
    let silentSince = performance.now();
    const rings: { born: number; strength: number }[] = [];
    let frame = 0;

    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      const isPlaying = playingRef.current;
      const heard = analyser?.level() ?? null;
      if (heard && heard > 0.002) silentSince = now;
      // Live voice when we have it; otherwise a slow, breath-paced swell.
      const live = heard !== null && now - silentSince < 2500;
      const ambient = isPlaying ? 0.22 + 0.1 * Math.sin((now / 6000) * Math.PI * 2) : 0.08;
      // Speech in the voice band reads about 0.05..0.65; map it to 0..0.85, leaving headroom.
      const target = live ? Math.min(0.85, Math.max(0, (heard - 0.05) / 0.65) * 0.85) : ambient;

      const attack = reduced ? 0.04 : 0.18;
      const release = reduced ? 0.02 : 0.05;
      level += (target - level) * (target > level ? attack : release);
      baseline += (level - baseline) * 0.02;

      if (now - lastReport > 400) {
        lastReport = now;
        canvas.dataset.source = live ? "voice" : "ambient";
        canvas.dataset.level = level.toFixed(3);
      }

      const cx = width / 2;
      const cy = height / 2;
      const unit = Math.min(width, height) / 2;
      ctx.clearRect(0, 0, width, height);

      // The glow: wide and faint, then a warmer core.
      const reach = unit * (0.62 + 0.38 * level);
      const glow = ctx.createRadialGradient(cx, cy, unit * 0.12, cx, cy, reach);
      glow.addColorStop(0, rgba(accent, 0.34 + 0.4 * level));
      glow.addColorStop(0.45, rgba(accent, 0.12 + 0.2 * level));
      glow.addColorStop(1, rgba(accent, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      const warm = ctx.createRadialGradient(cx, cy, 0, cx, cy, unit * (0.32 + 0.12 * level));
      warm.addColorStop(0, rgba(core, 0.22 + 0.3 * level));
      warm.addColorStop(1, rgba(core, 0));
      ctx.fillStyle = warm;
      ctx.fillRect(0, 0, width, height);

      if (reduced) return;

      // A ring leaves the light when a phrase begins.
      if (live && level - baseline > 0.07 && now - lastRing > 700) {
        lastRing = now;
        rings.push({ born: now, strength: Math.min(1, (level - baseline) * 6) });
      } else if (!live && isPlaying && now - lastRing > 6000) {
        lastRing = now;
        rings.push({ born: now, strength: 0.35 });
      }
      const life = 3200;
      for (let i = rings.length - 1; i >= 0; i--) {
        const age = (now - rings[i].born) / life;
        if (age >= 1) {
          rings.splice(i, 1);
          continue;
        }
        const eased = 1 - Math.pow(1 - age, 3);
        ctx.beginPath();
        ctx.arc(cx, cy, unit * (0.42 + 0.55 * eased), 0, Math.PI * 2);
        ctx.strokeStyle = rgba(accent, 0.42 * rings[i].strength * Math.pow(1 - age, 2));
        ctx.lineWidth = 1.25;
        ctx.stroke();
      }
    };
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      disconnect();
    };
  }, [talkId, getMediaElement]);

  return <canvas ref={canvasRef} aria-hidden className={cn("pointer-events-none", className)} />;
}
