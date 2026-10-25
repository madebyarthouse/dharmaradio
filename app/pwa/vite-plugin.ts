import crypto from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Plugin } from "vite";
import { config } from "../config";

// React Router can copy SSR-only CSS into build/client after the client build.
// The global post-build hook inventories the final static output, including those
// late assets, without bundling any service-worker code into the Cloudflare Worker.
export function pwaPlugin(): Plugin {
  return {
    name: "dharmaradio-pwa",
    apply: "build",
    buildApp: {
      order: "post",
      async handler(builder) {
        const client = builder.environments.client;
        if (!client?.isBuilt)
          throw new Error("PWA requires a completed Vite client build");
        const outputDir = path.resolve(
          client.config.root,
          client.config.build.outDir,
        );
        const assets = (
          await readdir(path.join(outputDir, "assets"), { recursive: true })
        )
          .filter((name) => /\.(?:js|css|woff2?|ttf|svg)$/.test(name))
          .map((name) => `/assets/${name.split(path.sep).join("/")}`)
          .sort();
        assets.push("/pwa-offline.html");
        const template = await readFile(
          new URL("./service-worker.js", import.meta.url),
          "utf8",
        );
        const offlineHtml = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="${config.themeColor}"><title>Offline · Dharma Radio</title><main><h1>You’re offline</h1><p>Reconnect to browse Dharma Radio and stream talks. Previously visited pages may still be available.</p><p><a href="/">Try again</a></p></main></html>`;
        const version = crypto
          .createHash("sha256")
          .update(template)
          .update(offlineHtml)
          .update(JSON.stringify(assets))
          .digest("hex")
          .slice(0, 16);
        const source = template
          .replace('"__PWA_VERSION__"', JSON.stringify(version))
          .replace(
            "const PRECACHE_URLS = __PWA_ASSETS__;",
            `const PRECACHE_URLS = ${JSON.stringify(assets)};`,
          );
        await writeFile(path.join(outputDir, "pwa-offline.html"), offlineHtml);
        await writeFile(path.join(outputDir, "sw.js"), source);
        builder.config.logger.info(
          `PWA: emitted sw.js with ${assets.length} precached resources`,
        );
      },
    },
  };
}
