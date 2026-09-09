import vinext from "vinext";
import { defineConfig, type Plugin } from "vite";

const MLC_WORKER_REALM_CHECKS = new Map([
  ["/node_modules/@mlc-ai/web-llm/lib/index.js", 12],
  ["/node_modules/@mlc-ai/web-tokenizers/lib/index.js", 2],
]);
const EXACT_WINDOW_TYPEOF = /\btypeof(\s+)window\b(?!\s*(?:\.|\[|\?\.))/gu;

export function preserveMlcWorkerRealmChecks(): Plugin {
  return {
    name: "lattice:preserve-mlc-worker-realm-checks",
    enforce: "pre",
    transform(code, id) {
      const moduleId = id.replaceAll("\\", "/").split("?", 1)[0];
      const expectedCount = [...MLC_WORKER_REALM_CHECKS]
        .find(([suffix]) => moduleId.endsWith(suffix))?.[1];
      if (expectedCount === undefined) return null;

      let replacementCount = 0;
      const transformed = code.replace(EXACT_WINDOW_TYPEOF, (_match, spacing: string) => {
        replacementCount += 1;
        return `typeof${spacing}globalThis.window`;
      });
      if (replacementCount !== expectedCount) {
        throw new Error(
          `The pinned MLC worker realm contract changed in ${moduleId}: expected ${expectedCount} exact typeof window checks, found ${replacementCount}.`,
        );
      }
      return { code: transformed, map: null };
    },
  };
}

export default defineConfig({
    server: {
      host: "0.0.0.0",
      allowedHosts: ["terminal.local"],
    },
    worker: {
      plugins: () => [preserveMlcWorkerRealmChecks()],
    },
    plugins: [vinext()],
});
