import { useEffect, useState, useRef } from "react";

type WaveformData = number[];

export function useAudioWaveform(audioUrl: string | null, numBars: number = 80) {
  const [waveform, setWaveform] = useState<WaveformData>([]);
  const [isLoading, setIsLoading] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const previousUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!audioUrl || audioUrl === previousUrlRef.current) return;

    previousUrlRef.current = audioUrl;
    setIsLoading(true);

    const generateWaveform = async () => {
      try {
        // Create audio context if it doesn't exist
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext ||
            (window as any).webkitAudioContext)();
        }

        const audioContext = audioContextRef.current;

        // Fetch the audio file
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();

        // Decode audio data
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        // Get channel data (use first channel for simplicity)
        const channelData = audioBuffer.getChannelData(0);
        const samplesPerBar = Math.floor(channelData.length / numBars);

        // Calculate average amplitude for each bar
        const waveformData: number[] = [];
        for (let i = 0; i < numBars; i++) {
          const start = i * samplesPerBar;
          const end = start + samplesPerBar;
          let sum = 0;

          // Calculate RMS (root mean square) for better visual representation
          for (let j = start; j < end && j < channelData.length; j++) {
            sum += channelData[j] * channelData[j];
          }

          const rms = Math.sqrt(sum / samplesPerBar);
          // Normalize to 0-100 range and apply some scaling for better visuals
          const normalized = Math.min(100, Math.max(10, rms * 300));
          waveformData.push(normalized);
        }

        setWaveform(waveformData);
        setIsLoading(false);
      } catch (error) {
        console.error("Error generating waveform:", error);
        // Fallback to random waveform if generation fails
        const fallbackWaveform = Array.from({ length: numBars }, () =>
          Math.floor(Math.random() * 90) + 10
        );
        setWaveform(fallbackWaveform);
        setIsLoading(false);
      }
    };

    generateWaveform();

    return () => {
      // Cleanup audio context on unmount
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [audioUrl, numBars]);

  return { waveform, isLoading };
}
