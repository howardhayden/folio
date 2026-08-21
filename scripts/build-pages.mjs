import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "site");
const serverEntry = resolve(root, "dist/server/index.js");
const clientAssets = resolve(root, "dist/client");

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(clientAssets, output, { recursive: true });

const { default: render } = await import(`${pathToFileURL(serverEntry).href}?build=${Date.now()}`);
const routes = [
  ["/", "index.html"],
  ["/not-found", "404.html"],
];

for (const [pathname, filename] of routes) {
  const response = await render(new Request(`https://hah.dev${pathname}`, {
    headers: { accept: "text/html" },
  }));
  const html = await response.text();
  const destination = resolve(output, filename);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, html);
}

await writeFile(resolve(output, "CNAME"), `${(await readFile(resolve(root, "CNAME"), "utf8")).trim()}\n`);
await writeFile(resolve(output, ".nojekyll"), "");
