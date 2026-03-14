import crypto from "node:crypto";
import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// Vite 7 uses `crypto.hash()`, which is unavailable in Node 20.11.x.
// Cloudflare's build image currently pins that version, so we provide the
// same functionality via `createHash()` during config/build evaluation.
if (typeof crypto.hash !== "function") {
  Object.assign(crypto, {
    hash(
      algorithm: string,
      data: crypto.BinaryLike,
      outputEncoding: crypto.BinaryToTextEncoding,
    ) {
      return crypto.createHash(algorithm).update(data).digest(outputEncoding);
    },
  });
}

export default defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    reactRouter(),
    tsconfigPaths(),
  ],
});
