import assert from "node:assert/strict";
import { test } from "node:test";
import {
  dayKey,
  minutesByDay,
  summarize,
  type PracticeSession,
} from "../app/lib/practice";
import { isGuidedTitle } from "../app/lib/guided";
import { normalizeSettings, TimerEngine } from "../app/lib/timer-engine";

const session = (startedAt: number, durationSec = 60): PracticeSession => ({
  id: String(startedAt),
  startedAt,
  durationSec,
  kind: "timer",
  talkId: null,
});
test("practice totals use local days, Monday weeks and yesterday grace", () => {
  const now = new Date(2026, 9, 26, 12).getTime(); // Monday, after European DST ends.
  const sessions = [
    session(new Date(2026, 9, 25, 23).getTime(), 90),
    session(new Date(2026, 9, 24, 12).getTime(), 120),
    session(new Date(2026, 9, 20, 12).getTime()),
    session(now + 86400000),
  ];
  assert.equal(dayKey(sessions[0].startedAt), "2026-10-25");
  assert.equal(minutesByDay(sessions).get("2026-10-25"), 1.5);
  assert.deepEqual(summarize(sessions, now), {
    totalMinutes: 4.5,
    sessionCount: 3,
    last7Minutes: 4.5,
    daysThisWeek: 0,
    currentRunDays: 2,
  });
  assert.equal(summarize([...sessions, session(now)], now).currentRunDays, 3);
  assert.equal(summarize([], now).currentRunDays, 0);
});
test("guided title heuristic excludes unguided and word fragments", () => {
  for (const title of ["Guided meditation", "(GUIDED)", "A guided: sit"])
    assert.equal(isGuidedTitle(title), true);
  for (const title of ["Unguided sit", "guidedness", "Talk"])
    assert.equal(isGuidedTitle(title), false);
});
test("timer settings stay within their public bounds", () => {
  assert.deepEqual(
    normalizeSettings({
      minutes: 999,
      volume: -1,
      intervalMinutes: -1,
      settleSeconds: 30,
    }),
    {
      minutes: 180,
      volume: 0,
      intervalMinutes: 0,
      settleSeconds: 30,
      bell: "bowl",
      startStrikes: 1,
      endStrikes: 3,
    },
  );
});
test("timer schedules bells ahead, survives background jumps and completes once", () => {
  const realNow = Date.now;
  let now = 1000000;
  Date.now = () => now;
  try {
    const engine = new TimerEngine();
    const strikes: number[] = [];
    engine.bells.keepAlive = () => undefined;
    engine.bells.stopKeepAlive = () => undefined;
    engine.bells.strike = (_sound, _volume, delay = 0) => {
      strikes.push(delay);
    };
    const results: unknown[] = [];
    engine.onFinish = (result) => results.push(result);
    engine.start({
      minutes: 2,
      intervalMinutes: 1,
      settleSeconds: 10,
      startStrikes: 2,
      endStrikes: 3,
    });
    assert.deepEqual(strikes, [10, 14, 70, 130, 134, 138]);
    now += 70000;
    engine.tick();
    assert.equal(engine.getState().phase, "sitting");
    assert.equal(engine.getClock().elapsedMs, 60000);
    assert.equal(engine.getClock().remainingMs, 60000);
    now += 68000;
    engine.tick();
    engine.tick();
    assert.equal(engine.getState().phase, "complete");
    assert.deepEqual(results, [
      { durationSec: 120, completed: true, startedAt: 1010000 },
    ]);
    engine.dismiss();
    assert.equal(engine.getState().phase, "idle");
  } finally {
    Date.now = realNow;
  }
});
test("pause excludes wall time, settle never counts as practice, early end is idempotent", () => {
  const realNow = Date.now;
  let now = 1000000;
  Date.now = () => now;
  try {
    const engine = new TimerEngine();
    engine.bells.keepAlive = () => undefined;
    engine.bells.stopKeepAlive = () => undefined;
    engine.bells.unlock = () => undefined;
    engine.bells.strike = () => undefined;
    const results: unknown[] = [];
    engine.onFinish = (r) => results.push(r);
    engine.start({ minutes: 20, settleSeconds: 30 });
    now += 10000;
    engine.pause();
    assert.equal(engine.getClock().settleRemainingMs, 20000);
    now += 60000;
    engine.resume();
    now += 80000;
    engine.pause();
    assert.equal(engine.getClock().elapsedMs, 60000);
    now += 86400000;
    engine.tick();
    assert.equal(engine.getClock().elapsedMs, 60000);
    engine.end();
    engine.end();
    assert.deepEqual(results, [
      { durationSec: 60, completed: false, startedAt: 1090000 },
    ]);
    engine.start({ settleSeconds: 60 });
    now += 10000;
    engine.end();
    assert.equal(engine.getState().result?.durationSec, 0);
  } finally {
    Date.now = realNow;
  }
});

test("foreground recovery drops stale bells when the audio clock was suspended", () => {
  const realNow = Date.now;
  let now = 1000000;
  Date.now = () => now;
  try {
    const engine = new TimerEngine();
    engine.bells.keepAlive = () => undefined;
    engine.bells.stopKeepAlive = () => undefined;
    engine.bells.unlock = () => undefined;
    engine.bells.getAudioTime = () => 0; // Frozen audio clock, advancing wall clock.
    let canceled = 0;
    engine.bells.cancel = () => {
      canceled++;
    };
    const strikes: number[] = [];
    engine.bells.strike = (_s, _v, delay = 0) => {
      strikes.push(delay);
    };
    engine.start({
      minutes: 3,
      settleSeconds: 0,
      intervalMinutes: 1,
      endStrikes: 1,
    });
    strikes.length = 0;
    now += 90000;
    engine.recoverAudio();
    assert.equal(canceled, 2);
    assert.equal(engine.getClock().elapsedMs, 90000);
    assert.deepEqual(strikes, [30, 90]); // No stale start bell or minute-one bell.
    strikes.length = 0;
    now += 100000;
    engine.recoverAudio();
    assert.equal(engine.getState().phase, "complete");
    assert.deepEqual(strikes, [0]); // A single catch-up end notification.
  } finally {
    Date.now = realNow;
  }
});

test("a completed timer cannot leave frozen future bells waiting to replay", () => {
  const realNow = Date.now;
  let now = 1000000;
  Date.now = () => now;
  try {
    const engine = new TimerEngine();
    engine.bells.keepAlive = () => undefined;
    engine.bells.stopKeepAlive = () => undefined;
    engine.bells.unlock = () => undefined;
    engine.bells.getAudioTime = () => 0;
    let canceled = 0,
      strikes = 0;
    engine.bells.cancel = () => {
      canceled++;
    };
    engine.bells.strike = () => {
      strikes++;
    };
    engine.start({ minutes: 1, settleSeconds: 0, endStrikes: 1 });
    strikes = 0;
    now += 70000;
    engine.tick();
    assert.equal(engine.getState().phase, "complete");
    assert.equal(canceled, 2);
    assert.equal(strikes, 0);
    engine.recoverAudio();
    engine.recoverAudio();
    assert.equal(strikes, 1);
  } finally {
    Date.now = realNow;
  }
});
test("breath patterns move through their phases and loop", async () => {
  const { breathAt, BREATH_PATTERN_KEYS } = await import("../app/lib/breath");
  assert.deepEqual(BREATH_PATTERN_KEYS, ["calm", "box", "478"]);
  assert.equal(breathAt("calm", 0).kind, "in");
  assert.equal(breathAt("calm", 0).count, 4);
  assert.equal(breathAt("calm", 0).fullness, 0);
  assert.equal(breathAt("calm", 4000).kind, "out");
  assert.equal(breathAt("calm", 4000).fullness, 1);
  assert.equal(breathAt("calm", 10_000).kind, "in"); // 4 + 6 seconds, then again
  assert.equal(breathAt("box", 4500).kind, "hold");
  assert.equal(breathAt("box", 12_500).kind, "rest");
  assert.equal(breathAt("box", 12_500).fullness, 0);
  assert.equal(breathAt("478", 4000).count, 7);
  assert.equal(breathAt("478", 11_000).kind, "out");
  assert.equal(breathAt("478", 18_999).count, 1);
});
