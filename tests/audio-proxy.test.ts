import assert from "node:assert/strict";
import { test } from "node:test";
import { isAllowedAudioUrl, proxyAudio, sanitizeRange } from "../app/lib/audio-proxy.server.ts";

const TALK = "https://dharmaseed.org/talks/1/talk-1.mp3";
const MEDIA = "https://media.dharmaseed.org/cache/audio/talk-1.mp3";

/** A fake fetch that follows dharmaseed's redirect and serves ranges like the media host. */
function upstream(calls: { url: string; init?: RequestInit }[], finalUrl = MEDIA) {
  return (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const range = new Headers(init?.headers).get("Range");
    const body = "0123456789";
    const response = range
      ? new Response(body.slice(0, 4), {
          status: 206,
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Length": "4",
            "Content-Range": "bytes 0-3/10",
            "Access-Control-Allow-Origin": "https://elsewhere.example",
            "Set-Cookie": "tracking=1",
          },
        })
      : new Response(body, { status: 200, headers: { "Content-Type": "audio/mpeg", "Content-Length": "10" } });
    Object.defineProperty(response, "url", { value: finalUrl });
    return response;
  }) as typeof fetch;
}

test("only https dharmaseed hosts are allowed", () => {
  assert.equal(isAllowedAudioUrl(TALK), true);
  assert.equal(isAllowedAudioUrl(MEDIA), true);
  assert.equal(isAllowedAudioUrl("http://dharmaseed.org/a.mp3"), false);
  assert.equal(isAllowedAudioUrl("https://dharmaseed.org.evil.example/a.mp3"), false);
  assert.equal(isAllowedAudioUrl("not a url"), false);
});

test("ranges are forwarded only in the single bytes= form", () => {
  assert.equal(sanitizeRange("bytes=0-99"), "bytes=0-99");
  assert.equal(sanitizeRange("bytes=100-"), "bytes=100-");
  assert.equal(sanitizeRange("bytes=-"), null);
  assert.equal(sanitizeRange("bytes=0-1,5-9"), null);
  assert.equal(sanitizeRange(null), null);
});

test("a ranged request streams 206 with ranges, an audio type and no foreign headers", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const request = new Request("https://dharma.test/audio/1", { headers: { Range: "bytes=0-3" } });
  const response = await proxyAudio(request, TALK, upstream(calls));
  assert.equal(response.status, 206);
  assert.equal(await response.text(), "0123");
  assert.equal(response.headers.get("Content-Range"), "bytes 0-3/10");
  assert.equal(response.headers.get("Content-Length"), "4");
  assert.equal(response.headers.get("Accept-Ranges"), "bytes");
  assert.equal(response.headers.get("Content-Type"), "audio/mpeg");
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), null);
  assert.equal(response.headers.get("Set-Cookie"), null);
  assert.equal(calls[0].url, TALK);
  assert.equal(calls[0].init?.redirect, "follow");
  assert.equal(new Headers(calls[0].init?.headers).get("Range"), "bytes=0-3");
});

test("a full request streams 200", async () => {
  const response = await proxyAudio(new Request("https://dharma.test/audio/1"), TALK, upstream([]));
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "0123456789");
});

test("a redirect off the allow-list is refused", async () => {
  const response = await proxyAudio(
    new Request("https://dharma.test/audio/1"),
    TALK,
    upstream([], "https://evil.example/x.mp3"),
  );
  assert.equal(response.status, 502);
});

test("stored URLs off the allow-list are never fetched", async () => {
  const calls: { url: string }[] = [];
  const response = await proxyAudio(new Request("https://dharma.test/audio/1"), "https://evil.example/a.mp3", upstream(calls));
  assert.equal(response.status, 404);
  assert.equal(calls.length, 0);
});

test("writes are rejected", async () => {
  const response = await proxyAudio(new Request("https://dharma.test/audio/1", { method: "POST" }), TALK, upstream([]));
  assert.equal(response.status, 405);
});
