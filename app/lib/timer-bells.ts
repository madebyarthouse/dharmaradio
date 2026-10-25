export type BellSound = "bowl" | "bell" | "wood";

/** Offline synthesis: paired, inharmonic modes beat gently as higher modes fade first. */
export class TimerBells {
  private context: AudioContext | null = null;
  private voices = new Set<OscillatorNode>();
  private anchor: HTMLAudioElement | null = null;
  private anchorUrl: string | null = null;

  unlock() {
    try {
      if (!this.context || this.context.state === "closed")
        this.context = new AudioContext();
      void this.context.resume().catch(() => undefined);
      const nav = navigator as Navigator & { audioSession?: { type: string } };
      if (nav.audioSession) nav.audioSession.type = "playback";
    } catch {
      /* Audio is optional; timing and logging still work. */
    }
  }
  keepAlive() {
    this.unlock();
    if (!this.anchor) {
      // An actual media element gives iOS a playback session. A tiny nonzero PCM
      // signal avoids the muted/silent-track optimization; generated locally/offline.
      const rate = 8000,
        samples = rate * 2;
      const buffer = new ArrayBuffer(44 + samples * 2);
      const view = new DataView(buffer);
      const str = (offset: number, value: string) =>
        [...value].forEach((c, i) =>
          view.setUint8(offset + i, c.charCodeAt(0)),
        );
      str(0, "RIFF");
      view.setUint32(4, buffer.byteLength - 8, true);
      str(8, "WAVE");
      str(12, "fmt ");
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true);
      view.setUint32(24, rate, true);
      view.setUint32(28, rate * 2, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      str(36, "data");
      view.setUint32(40, samples * 2, true);
      for (let i = 0; i < samples; i++)
        view.setInt16(
          44 + i * 2,
          Math.round(Math.sin((i * 2 * Math.PI * 40) / rate) * 2),
          true,
        );
      this.anchorUrl = URL.createObjectURL(
        new Blob([buffer], { type: "audio/wav" }),
      );
      this.anchor = new Audio(this.anchorUrl);
      this.anchor.loop = true;
      this.anchor.setAttribute("playsinline", "");
    }
    void this.anchor.play().catch(() => undefined);
    // Best effort only: iOS may suspend JS AND Web Audio while locked, even with
    // media playback/audioSession.type="playback". Media Session grants controls,
    // not background execution. Schedule the entire bell timeline ahead; recover
    // timestamps on visibilitychange. Screen Wake Lock only works while visible.
    // Sources: https://bugs.webkit.org/show_bug.cgi?id=198277
    // https://bugs.webkit.org/show_bug.cgi?id=291892
    // https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API
  }
  getAudioTime() {
    return this.context?.currentTime ?? null;
  }
  stopKeepAlive() {
    this.anchor?.pause();
  }
  strike(sound: BellSound, volume: number, delaySec = 0) {
    const ctx = this.context;
    if (!ctx || ctx.state === "closed" || volume <= 0) return;
    const start = ctx.currentTime + Math.max(0, delaySec);
    const wood = sound === "wood";
    const fundamental = wood ? 420 : sound === "bell" ? 110 : 174;
    const modes = wood
      ? [1, 1.58, 2.13, 3.2]
      : sound === "bell"
        ? [1, 2.01, 2.4, 3.02, 4.17, 5.43]
        : [1, 2.76, 5.4, 8.9];
    modes.forEach((ratio, index) => {
      for (let pair = 0; pair < (wood ? 1 : 2); pair++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = fundamental * ratio;
        osc.detune.value = pair ? 2.4 + index * 0.7 : -1.8;
        const duration = wood
          ? 0.19 / (1 + index * 0.2)
          : (sound === "bowl" ? 14 : 12) / (1 + index * 0.42);
        const amplitude = (volume * (wood ? 0.38 : 0.17)) / (1 + index * 1.15);
        gain.gain.setValueAtTime(0.00001, start);
        gain.gain.exponentialRampToValueAtTime(
          Math.max(0.00002, amplitude),
          start + (wood ? 0.002 : 0.025),
        );
        gain.gain.exponentialRampToValueAtTime(0.00001, start + duration);
        osc.connect(gain).connect(ctx.destination);
        this.voices.add(osc);
        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
          this.voices.delete(osc);
        };
        osc.start(start);
        osc.stop(start + duration + 0.05);
      }
    });
  }
  cancel() {
    for (const osc of this.voices) {
      try {
        osc.stop();
      } catch {
        /* Already ended. */
      }
    }
    this.voices.clear();
  }
  dispose() {
    this.cancel();
    this.stopKeepAlive();
    if (this.anchorUrl) URL.revokeObjectURL(this.anchorUrl);
    this.anchor = null;
    this.anchorUrl = null;
    void this.context?.close().catch(() => undefined);
    this.context = null;
  }
}
