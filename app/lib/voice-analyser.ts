/**
 * Listens to a talk without touching the element that plays it.
 *
 * Routing the real <audio> through an AudioContext is irreversible, and on iOS a
 * suspended context in the background can silence it. So while the full-screen
 * player is visible we play a second, same-origin copy of the stream
 * (/audio/:talkId) into an AnalyserNode and then a GainNode at zero: it is heard by
 * the analyser only. It follows the real element's time, pause and rate, and is
 * torn down the moment the view closes or the page is hidden. Background playback
 * never depends on it.
 */

const VOICE_LOW_HZ = 90;
const VOICE_HIGH_HZ = 3200;
/** How far the mirror may drift before it is snapped back to the real element. */
const MAX_DRIFT_SEC = 0.35;

type WindowWithWebkitAudio = Window & { webkitAudioContext?: typeof AudioContext };

export function canAnalyseVoice() {
  if (typeof window === "undefined") return false;
  const Ctor = window.AudioContext ?? (window as WindowWithWebkitAudio).webkitAudioContext;
  if (!Ctor) return false;
  // iOS shares one audio session between media elements; a second playing element
  // could take over the lock screen or interrupt the talk, so iOS gets the ambient light.
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return !ios;
}

export class VoiceAnalyser {
  private context: AudioContext | null = null;
  private mirror: HTMLAudioElement | null = null;
  private analyser: AnalyserNode | null = null;
  private bins: Uint8Array<ArrayBuffer> | null = null;
  private range: [number, number] = [0, 0];
  private interval = 0;
  private disposed = false;
  private readonly onMainEvent = () => this.sync();

  constructor(
    private readonly main: HTMLAudioElement,
    private readonly src: string,
  ) {}

  start() {
    const Ctor = window.AudioContext ?? (window as WindowWithWebkitAudio).webkitAudioContext;
    if (!Ctor) return false;
    try {
      const mirror = new Audio();
      mirror.preload = "auto";
      mirror.setAttribute("playsinline", "");
      // Same origin, so no CORS mode is needed and the samples are readable.
      mirror.src = this.src;
      this.mirror = mirror;

      const context = new Ctor();
      const source = context.createMediaElementSource(mirror);
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.72;
      const silence = context.createGain();
      silence.gain.value = 0;
      source.connect(analyser);
      analyser.connect(silence);
      silence.connect(context.destination);
      this.context = context;
      this.analyser = analyser;
      this.bins = new Uint8Array(analyser.frequencyBinCount);
      const hzPerBin = context.sampleRate / analyser.fftSize;
      this.range = [
        Math.max(1, Math.floor(VOICE_LOW_HZ / hzPerBin)),
        Math.min(analyser.frequencyBinCount - 1, Math.ceil(VOICE_HIGH_HZ / hzPerBin)),
      ];

      for (const name of ["play", "playing", "pause", "seeked", "ratechange", "ended"])
        this.main.addEventListener(name, this.onMainEvent);
      mirror.addEventListener("loadedmetadata", this.onMainEvent);
      this.interval = window.setInterval(this.onMainEvent, 1000);
      this.sync();
      return true;
    } catch {
      this.dispose();
      return false;
    }
  }

  /** Keep the mirror where the real element is. */
  private sync() {
    const { main, mirror, context } = this;
    if (this.disposed || !mirror || !context) return;
    if (main.paused || main.ended) {
      if (!mirror.paused) mirror.pause();
      return;
    }
    if (mirror.playbackRate !== main.playbackRate) mirror.playbackRate = main.playbackRate;
    if (mirror.readyState >= 1 && Math.abs(mirror.currentTime - main.currentTime) > MAX_DRIFT_SEC)
      mirror.currentTime = main.currentTime;
    if (context.state === "suspended") void context.resume().catch(() => undefined);
    if (mirror.paused) void mirror.play().catch(() => undefined);
  }

  /** Loudness of the voice band, 0..1, or null before any audio has arrived. */
  level(): number | null {
    const { analyser, bins, mirror } = this;
    if (!analyser || !bins || !mirror || mirror.paused || mirror.readyState < 3) return null;
    analyser.getByteFrequencyData(bins);
    const [lo, hi] = this.range;
    let sum = 0;
    for (let i = lo; i <= hi; i++) sum += bins[i];
    return sum / ((hi - lo + 1) * 255);
  }

  dispose() {
    this.disposed = true;
    window.clearInterval(this.interval);
    for (const name of ["play", "playing", "pause", "seeked", "ratechange", "ended"])
      this.main.removeEventListener(name, this.onMainEvent);
    if (this.mirror) {
      this.mirror.removeEventListener("loadedmetadata", this.onMainEvent);
      this.mirror.pause();
      // Release the network stream.
      this.mirror.removeAttribute("src");
      this.mirror.load();
    }
    void this.context?.close().catch(() => undefined);
    this.mirror = null;
    this.context = null;
    this.analyser = null;
  }
}
