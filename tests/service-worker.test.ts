import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

class MemoryCache {
  entries = new Map<string, Response>();
  async match(request: Request | string) {
    return this.entries
      .get(typeof request === "string" ? request : request.url)
      ?.clone();
  }
  async put(request: Request, response: Response) {
    this.entries.set(request.url, response.clone());
  }
  async addAll(urls: string[]) {
    for (const url of urls) this.entries.set(url, new Response(url));
  }
  async keys() {
    return [...this.entries.keys()].map((url) => new Request(url));
  }
  async delete(request: Request) {
    return this.entries.delete(request.url);
  }
}
function worker() {
  const handlers = new Map<string, (event: unknown) => void>();
  const cacheStores = new Map<string, MemoryCache>();
  let online = true;
  const context = {
    __PWA_ASSETS__: [],
    URL,
    Request,
    Response,
    AbortController,
    setTimeout,
    clearTimeout,
    self: {
      location: { origin: "https://dharma.test" },
      addEventListener: (name: string, handler: (event: unknown) => void) =>
        handlers.set(name, handler),
    },
    caches: {
      open: async (name: string) => {
        if (!cacheStores.has(name)) cacheStores.set(name, new MemoryCache());
        return cacheStores.get(name)!;
      },
    },
    fetch: async (request: Request) => {
      if (!online) throw new Error("offline");
      return new Response(new URL(request.url).pathname, {
        headers: {
          "Content-Type": "text/html",
          "Cache-Control": "public, max-age=60",
        },
      });
    },
  };
  vm.runInNewContext(
    readFileSync(
      new URL("../app/pwa/service-worker.js", import.meta.url),
      "utf8",
    ),
    context,
  );
  return {
    cached(name: string) {
      return [...cacheStores.entries()]
        .filter(([key]) => key.includes(name))
        .flatMap(([, store]) => [...store.entries.keys()]);
    },
    async install() {
      const waiting: Promise<unknown>[] = [];
      handlers.get("install")!({ waitUntil: (p: Promise<unknown>) => waiting.push(p) });
      await Promise.all(waiting);
    },
    offline() {
      online = false;
    },
    online() {
      online = true;
    },
    async navigate(path: string, headers?: HeadersInit) {
      const request = new Request(`https://dharma.test${path}`, { headers });
      Object.defineProperty(request, "mode", { value: "navigate" });
      let response: Promise<Response> | undefined;
      const waiting: Promise<unknown>[] = [];
      handlers.get("fetch")!({
        request,
        respondWith: (r: Promise<Response>) => {
          response = r;
        },
        waitUntil: (p: Promise<unknown>) => waiting.push(p),
      });
      const resolved = await response;
      await Promise.all(waiting);
      return resolved;
    },
  };
}
test("offline sit/practice opens the last successful shell independent of query strings", async () => {
  const sw = worker();
  await sw.navigate("/?source=installed");
  sw.offline();
  assert.equal(await (await sw.navigate("/?source=other"))?.text(), "/");
  assert.equal(await (await sw.navigate("/practice"))?.text(), "/");
  sw.online();
  await sw.navigate("/practice?view=week");
  sw.offline();
  assert.equal(
    await (await sw.navigate("/practice?view=month"))?.text(),
    "/practice",
  );
});
test("API, audio and Range requests always bypass service worker interception", async () => {
  const sw = worker();
  for (const path of ["/api/me/practice", "/audio/talk.mp3", "/audio/123", "/talk.wav"])
    assert.equal(await sw.navigate(path), undefined);
  assert.equal(await sw.navigate("/", { Range: "bytes=0-200" }), undefined);
  assert.equal(
    await sw.navigate("/", { Authorization: "Bearer test" }),
    undefined,
  );
});
test("browsing archive pages cannot evict the offline timer shell", async () => {
  const sw = worker();
  await sw.navigate("/");
  await sw.navigate("/practice");
  for (let i = 0; i < 35; i++) await sw.navigate(`/talks?page=${i}`);
  sw.offline();
  assert.equal(await (await sw.navigate("/"))?.text(), "/");
  assert.equal(await (await sw.navigate("/practice"))?.text(), "/practice");
});
test("the timer lives at /sit and opens offline, even before its first visit", async () => {
  const sw = worker();
  await sw.install();
  assert.deepEqual(sw.cached("pages"), ["https://dharma.test/sit"]);
  sw.offline();
  assert.equal(await (await sw.navigate("/sit?from=shortcut"))?.text(), "/sit");
  // Practice falls back to the timer shell rather than home.
  assert.equal(await (await sw.navigate("/practice"))?.text(), "/sit");
});
test("installing offline still succeeds", async () => {
  const sw = worker();
  sw.offline();
  await sw.install();
  assert.deepEqual(sw.cached("pages"), []);
});
test("browsing cannot evict the /sit shell", async () => {
  const sw = worker();
  await sw.navigate("/sit");
  for (let i = 0; i < 35; i++) await sw.navigate(`/talks?page=${i}`);
  sw.offline();
  assert.equal(await (await sw.navigate("/sit"))?.text(), "/sit");
});
