// Kait resolusi untuk `node --test` (tanpa paket baru): modul `src/lib/**` memakai impor gaya Next ("./api",
// "@/lib/sissiApi") tanpa ekstensi. Kait ini menambahkan `.ts` dan memetakan alias `@/` ke `src/`.
// `@/lib/sissiApi` diganti `sissiApiStub.mjs` (tanpa jaringan). Pakai: `import "./support/tsResolve.mjs";` di baris pertama berkas tes, lalu `await import(...)` modulnya.
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC = new URL("../../src/", import.meta.url);

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "@/lib/sissiApi") return next(new URL("./sissiApiStub.mjs", import.meta.url).href, context);
    let url = null;
    if (specifier.startsWith("@/")) url = new URL(specifier.slice(2), SRC);
    else if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.includes("/src/")) url = new URL(specifier, context.parentURL);
    if (url && !/\.[cm]?[jt]sx?$/.test(url.pathname)) {
      for (const ext of [".ts", ".tsx", "/index.ts"]) {
        const p = fileURLToPath(url) + ext;
        if (existsSync(p)) return next(pathToFileURL(p).href, context);
      }
    }
    return next(url ? url.href : specifier, context);
  },
});
