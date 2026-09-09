import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { staticExportRoutes, staticSourceCopies } from "../app/semantic/routes.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "site");
const serverEntry = resolve(root, "dist/server/index.js");
const clientAssets = resolve(root, "dist/client");

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(clientAssets, output, { recursive: true });

const { default: render } = await import(`${pathToFileURL(serverEntry).href}?build=${Date.now()}`);

async function renderFollowingCanonicalRedirects(pathname, accept) {
  let requestUrl = new URL(pathname, "https://hah.dev");
  for (let redirectCount = 0; redirectCount <= 2; redirectCount += 1) {
    const response = await render(new Request(requestUrl, { headers: { accept } }));
    if (![301, 308].includes(response.status)) return response;
    const location = response.headers.get("location");
    if (!location) throw new Error(`Static render ${pathname} returned a redirect without a location.`);
    requestUrl = new URL(location, requestUrl);
    if (requestUrl.origin !== "https://hah.dev") {
      throw new Error(`Static render ${pathname} redirected outside hah.dev.`);
    }
  }
  throw new Error(`Static render ${pathname} exceeded the canonical redirect limit.`);
}

for (const { pathname, output: filename, accept, contentType, expectedStatus } of staticExportRoutes) {
  const response = await renderFollowingCanonicalRedirects(pathname, accept);
  if (response.status !== expectedStatus) {
    throw new Error(`Static render ${pathname} returned ${response.status}; expected ${expectedStatus}.`);
  }
  const returnedType = response.headers.get("content-type") ?? "";
  if (!returnedType.toLowerCase().startsWith(contentType)) {
    throw new Error(`Static render ${pathname} returned ${returnedType || "no content type"}; expected ${contentType}.`);
  }
  const body = await response.text();
  const destination = resolve(output, filename);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, body);
}

for (const { source, output: filename } of staticSourceCopies) {
  const sourcePath = resolve(root, source);
  const destination = resolve(output, filename);
  await mkdir(dirname(destination), { recursive: true });
  await cp(sourcePath, destination);
}

await writeFile(resolve(output, "CNAME"), `${(await readFile(resolve(root, "CNAME"), "utf8")).trim()}\n`);
await writeFile(resolve(output, ".nojekyll"), "");
