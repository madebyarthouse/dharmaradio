# Audio Player Guide

This guide covers the audio player implementation in Dharma Radio.

## Overview

The audio player is a global persistent player that maintains state across route navigation. It uses React Context API to manage playback state and the HTML5 Audio API for actual audio playback.

## Architecture

```
AudioProvider (Context)
    │
    ├─> HTMLAudioElement (ref)
    │
    ├─> State (currentTalk, isPlaying, progress, etc.)
    │
    └─> Controls (play, pause, seek, toggle)
         │
         └─> Components (Player, TalkCard, etc.)
              │
              └─> useAudio() hook
```

## Core Components

### AudioContext

**File**: `app/contexts/audio-context.tsx`

Provides global audio state and controls via React Context.

**State**:
```typescript
{
  currentTalk: PlayerTalk | null,      // Currently loaded talk
  isPlaying: boolean,                   // Play/pause state
  progress: number,                     // Progress percentage (0-100)
  currentTime: number,                  // Current time in seconds
  duration: number,                     // Total duration in seconds
}
```

**Controls**:
```typescript
{
  playTalk: (talk: PlayerTalk) => void,  // Load and play a talk
  pauseTalk: () => void,                 // Pause playback
  togglePlay: () => void,                // Toggle play/pause
  seek: (time: number) => void,          // Seek to specific time
}
```

### PlayerTalk Type

Extended talk information for the player:

```typescript
type PlayerTalk = {
  id: string,
  title: string,
  teacher: string | null,
  duration: number,
  audioUrl: string,
  teacherSlug: string | null | undefined,
  centerName: string | null | undefined,
  centerSlug: string | null | undefined,
  retreatTitle: string | null | undefined,
  retreatSlug: string | null | undefined,
}
```

## Implementation

### Provider Setup

**File**: `app/root.tsx`

Wrap the entire app with AudioProvider:

```tsx
export default function App() {
  return (
    <html lang="en">
      <body>
        <AudioProvider>
          <Outlet />
          <Player />
        </AudioProvider>
      </body>
    </html>
  );
}
```

### Using the Player

**In any component**:

```tsx
import { useAudio } from "~/contexts/audio-context";

function TalkCard({ talk }) {
  const { playTalk, currentTalk, isPlaying } = useAudio();

  const isCurrentTalk = currentTalk?.id === talk.id;

  const handlePlay = () => {
    playTalk({
      id: talk.id,
      title: talk.title,
      teacher: talk.teacherName,
      duration: talk.duration,
      audioUrl: talk.audioUrl,
      teacherSlug: talk.teacherSlug,
      centerName: talk.centerName,
      centerSlug: talk.centerSlug,
      retreatTitle: talk.retreatTitle,
      retreatSlug: talk.retreatSlug,
    });
  };

  return (
    <div>
      <h3>{talk.title}</h3>
      <button onClick={handlePlay}>
        {isCurrentTalk && isPlaying ? "Pause" : "Play"}
      </button>
    </div>
  );
}
```

## Audio Events

The player listens to HTML5 Audio events:

### timeupdate
Updates current time and progress:

```typescript
const handleTimeUpdate = () => {
  setCurrentTime(audio.currentTime);
  setProgress((audio.currentTime / audio.duration) * 100);
};
```

### durationchange
Updates duration when metadata loads:

```typescript
const handleDurationChange = () => {
  setDuration(audio.duration);
};
```

### ended
Resets player when talk finishes:

```typescript
const handleEnded = () => {
  setIsPlaying(false);
  setProgress(0);
  setCurrentTime(0);

  // Track completion event
  posthog?.capture("talk_completed", {
    talk_id: currentTalk.id,
    talk_title: currentTalk.title,
    // ... more metadata
  });
};
```

### play/pause
Syncs isPlaying state:

```typescript
const handlePlay = () => setIsPlaying(true);
const handlePause = () => setIsPlaying(false);
```

## Analytics Integration

The player tracks events with PostHog and Plausible:

### Play Event

```typescript
posthog?.capture("talk_played", {
  talk_id: talk.id,
  talk_title: talk.title,
  teacher_name: talk.teacher,
  teacher_slug: talk.teacherSlug,
  center_name: talk.centerName,
  center_slug: talk.centerSlug,
  retreat_title: talk.retreatTitle,
  retreat_slug: talk.retreatSlug,
  duration: talk.duration,
  audio_url: talk.audioUrl,
});

trackPlausibleEvent({
  event: "play",
  url: window.location.href,
  props: { talk_id: talk.title },
});
```

### Pause Event

```typescript
posthog?.capture("talk_paused", {
  talk_id: currentTalk.id,
  talk_title: currentTalk.title,
  teacher_name: currentTalk.teacher,
  current_time: audio.currentTime,
  duration: currentTalk.duration,
  progress_percent: (audio.currentTime / audio.duration) * 100,
});
```

### Completion Event

```typescript
posthog?.capture("talk_completed", {
  talk_id: currentTalk.id,
  talk_title: currentTalk.title,
  teacher_name: currentTalk.teacher,
  duration: currentTalk.duration,
});
```

### Seek Event

```typescript
posthog?.capture("talk_seeked", {
  talk_id: currentTalk.id,
  from_time: previousTime,
  to_time: time,
  seek_direction: time > previousTime ? "forward" : "backward",
  seek_amount: Math.abs(time - previousTime),
});
```

## Player UI Component

**File**: `app/components/Player.tsx`

The persistent mini-player shown at the bottom of the page:

```tsx
export function Player() {
  const { currentTalk, isPlaying, progress, currentTime, duration, togglePlay, seek } = useAudio();

  if (!currentTalk) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t">
      <div className="flex items-center gap-4 p-4">
        {/* Talk info */}
        <div>
          <h4>{currentTalk.title}</h4>
          <p>{currentTalk.teacher}</p>
        </div>

        {/* Play/pause button */}
        <button onClick={togglePlay}>
          {isPlaying ? <Pause /> : <Play />}
        </button>

        {/* Progress bar */}
        <input
          type="range"
          min={0}
          max={duration}
          value={currentTime}
          onChange={(e) => seek(Number(e.target.value))}
        />

        {/* Time display */}
        <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
      </div>
    </div>
  );
}
```

## Keyboard Shortcuts

The player supports keyboard shortcuts (can be added):

```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === " " && e.target === document.body) {
      e.preventDefault();
      togglePlay();
    }
    if (e.key === "ArrowLeft") {
      seek(Math.max(0, currentTime - 10));
    }
    if (e.key === "ArrowRight") {
      seek(Math.min(duration, currentTime + 10));
    }
  };

  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, [togglePlay, seek, currentTime, duration]);
```

## Autoplay Handling

Browser autoplay policies require user interaction:

```typescript
const playPromise = audio.play();
if (playPromise !== undefined) {
  playPromise
    .then(() => {
      // Autoplay started
      setIsPlaying(true);
    })
    .catch((error) => {
      // Autoplay blocked
      console.error("Playback failed:", error);
      setIsPlaying(false);
    });
}
```

## State Persistence

Currently, player state is in-memory only. For persistence across page reloads:

### LocalStorage (future)

```typescript
// Save state
useEffect(() => {
  if (currentTalk) {
    localStorage.setItem("lastPlayedTalk", JSON.stringify({
      talk: currentTalk,
      currentTime,
    }));
  }
}, [currentTalk, currentTime]);

// Restore state
useEffect(() => {
  const saved = localStorage.getItem("lastPlayedTalk");
  if (saved) {
    const { talk, currentTime } = JSON.parse(saved);
    // Restore talk and seek to position
  }
}, []);
```

## Audio Preloading

The player uses `preload="metadata"` to load duration without downloading the full file:

```tsx
<audio ref={audioRef} preload="metadata" />
```

Options:
- `preload="none"` - Don't preload anything (slowest start)
- `preload="metadata"` - Preload duration/metadata only (recommended)
- `preload="auto"` - Preload entire file (fastest start, uses bandwidth)

## Performance Considerations

### Memory Management

Only one audio element exists globally, reducing memory usage:

```typescript
const audioRef = useRef<HTMLAudioElement>(null);
```

### Lazy Loading

Audio files are loaded only when playback starts:

```typescript
if (currentTalk?.id !== talk.id) {
  audio.src = talk.audioUrl; // Only load new talk
}
```

### Event Cleanup

Always clean up event listeners:

```typescript
useEffect(() => {
  const audio = audioRef.current;
  if (!audio) return;

  audio.addEventListener("timeupdate", handleTimeUpdate);

  return () => {
    audio.removeEventListener("timeupdate", handleTimeUpdate);
  };
}, []);
```

## Future Enhancements

### Playlist/Queue

```typescript
type AudioContextType = {
  // ... existing
  queue: PlayerTalk[],
  addToQueue: (talk: PlayerTalk) => void,
  playNext: () => void,
  playPrevious: () => void,
}
```

### Playback Speed

```typescript
const [playbackRate, setPlaybackRate] = useState(1.0);

const changeSpeed = (rate: number) => {
  if (audioRef.current) {
    audioRef.current.playbackRate = rate;
    setPlaybackRate(rate);
  }
};
```

### Sleep Timer

```typescript
const [sleepTimer, setSleepTimer] = useState<number | null>(null);

useEffect(() => {
  if (!sleepTimer) return;

  const timer = setTimeout(() => {
    pauseTalk();
    setSleepTimer(null);
  }, sleepTimer * 60 * 1000);

  return () => clearTimeout(timer);
}, [sleepTimer]);
```

### Equalizer

Use Web Audio API for EQ:

```typescript
const audioContext = new AudioContext();
const source = audioContext.createMediaElementSource(audio);
const equalizer = audioContext.createBiquadFilter();

source.connect(equalizer);
equalizer.connect(audioContext.destination);

equalizer.type = "lowpass";
equalizer.frequency.value = 1000;
```

### Download Support

```typescript
const downloadTalk = async (talk: PlayerTalk) => {
  const response = await fetch(talk.audioUrl);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `${talk.title}.mp3`;
  a.click();

  URL.revokeObjectURL(url);
};
```

## Troubleshooting

### Audio Not Playing

1. Check audio URL is valid
2. Check CORS headers on audio files
3. Check browser autoplay policy
4. Check browser console for errors

### Progress Not Updating

1. Verify `timeupdate` event listener is attached
2. Check `audio.duration` is valid (not NaN)
3. Ensure audio metadata is loaded

### Playback Interrupted

1. Check network connection
2. Check audio file hosting
3. Verify no browser extensions blocking audio
4. Check browser console for errors

## Related Files

- `app/contexts/audio-context.tsx` - Audio context provider
- `app/components/Player.tsx` - Player UI component
- `app/components/talk-card.tsx` - Talk card with play button
- `app/utils/plausible.ts` - Analytics tracking
- `app/root.tsx` - App root with AudioProvider

## Next Steps

- [UI Components](./ui-components.md) - Component library
- [Architecture](./architecture.md) - System overview
- [Routing & Loaders](./routing-loaders.md) - Page routing
