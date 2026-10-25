import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import type { PracticeSession } from "../app/lib/practice";

test("practice migrates anonymous history, merges server data, and rolls back failed mutations", async () => {
  const dom = new JSDOM("<div id='root'></div>", {
    url: "http://localhost:5180",
  });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  const globals: Record<string, unknown> = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    localStorage: dom.window.localStorage,
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  for (const [name, value] of Object.entries(globals)) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, {
      value,
      configurable: true,
      writable: true,
    });
  }
  const realFetch = globalThis.fetch;
  const realWarn = console.warn;
  const account = {
    id: "practice-test",
    name: "Tester",
    email: "practice@example.test",
    image: null,
  };
  let signedIn = false,
    failPost = false,
    failDelete = false;
  const remote: PracticeSession[] = [
    {
      id: crypto.randomUUID(),
      durationSec: 180,
      startedAt: Date.now() - 60000,
      kind: "guided",
      talkId: null,
    },
  ];
  const uploads: PracticeSession[][] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
      "http://localhost:5180",
    );
    if (url.pathname === "/api/me")
      return Response.json({
        user: signedIn ? account : null,
        savedIds: [],
        likedIds: [],
        progress: [],
        playlists: [],
      });
    if (url.pathname.startsWith("/api/auth")) return Response.json(null);
    if (url.pathname === "/api/me/practice") {
      if (init?.method === "POST") {
        if (failPost)
          return Response.json({ error: "Failed" }, { status: 500 });
        const sessions = JSON.parse(String(init.body))
          .sessions as PracticeSession[];
        uploads.push(sessions);
        for (const s of sessions)
          if (!remote.some((r) => r.id === s.id)) remote.push(s);
        return Response.json({ ok: true });
      }
      return Response.json({ sessions: [...remote] });
    }
    if (
      url.pathname.startsWith("/api/me/practice/") &&
      init?.method === "DELETE"
    ) {
      if (failDelete)
        return Response.json({ error: "Failed" }, { status: 500 });
      const index = remote.findIndex(
        (s) => s.id === url.pathname.split("/").pop(),
      );
      if (index >= 0) remote.splice(index, 1);
      return Response.json({ ok: true });
    }
    throw new Error(`Unexpected request ${url}`);
  };
  console.warn = () => undefined; // Expected mutation failures are asserted below.
  const { createRoot } = await import("react-dom/client");
  const { LibraryProvider, useLibrary } = await import(
    "../app/contexts/library-context"
  );
  const { PracticeProvider, usePractice } = await import(
    "../app/contexts/practice-context"
  );
  let practice: ReturnType<typeof usePractice>;
  let library: ReturnType<typeof useLibrary>;
  function Probe() {
    practice = usePractice();
    library = useLibrary();
    return null;
  }
  const root = createRoot(document.getElementById("root")!);
  const flush = async (work: () => void | Promise<void>) =>
    act(async () => {
      await work();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  try {
    await flush(() =>
      root.render(
        createElement(
          LibraryProvider,
          null,
          createElement(PracticeProvider, null, createElement(Probe)),
        ),
      ),
    );
    assert.equal(practice!.status, "ready");
    await flush(() => practice.log({ durationSec: 59, kind: "timer" }));
    assert.equal(practice!.sessions.length, 0);
    await flush(() => practice.log({ durationSec: 120, kind: "timer" }));
    const localId = practice!.sessions[0].id;
    assert.equal(
      JSON.parse(localStorage.getItem("dharmaradio:practice:v1")!)[0].id,
      localId,
    );
    signedIn = true;
    await flush(() => library.refresh());
    await flush(() => undefined);
    assert.equal(practice!.synced, true);
    assert.equal(practice!.sessions.length, 2);
    assert.equal(uploads.flat().filter((s) => s.id === localId).length, 1);
    assert.deepEqual(
      JSON.parse(localStorage.getItem("dharmaradio:practice:v1")!),
      [],
    );
    failPost = true;
    await flush(() => practice.log({ durationSec: 200, kind: "timer" }));
    assert.equal(practice!.sessions.length, 2);
    failDelete = true;
    await flush(() => practice.remove(localId));
    assert.ok(practice!.sessions.some((s) => s.id === localId));
    failDelete = false;
    await flush(() => practice.remove(localId));
    assert.ok(!practice!.sessions.some((s) => s.id === localId));
    signedIn = false;
    await flush(() => library.refresh());
    assert.equal(practice!.synced, false);
    assert.equal(practice!.sessions.length, 0);
  } finally {
    await act(async () => root.unmount());
    // Better Auth's browser store has a short deferred session revalidation.
    // Let it settle before removing the test's DOM globals.
    await new Promise((resolve) => setTimeout(resolve, 3200));
    dom.window.close();
    globalThis.fetch = realFetch;
    console.warn = realWarn;
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
});
