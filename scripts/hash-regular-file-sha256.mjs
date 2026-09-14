import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { appendFile, open } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_MAXIMUM_BYTES = 1_073_741_824;
const READ_BUFFER_BYTES = 1024 * 1024;

function fail(message) {
  throw new Error(`Regular-file SHA-256 failed: ${message}`);
}

function sameFileIdentity(before, after) {
  return before.dev === after.dev
    && before.ino === after.ino
    && before.size === after.size
    && before.mtimeNs === after.mtimeNs;
}

/** Hash one bounded regular file without following a final symbolic link. */
export async function hashRegularFileSha256(pathname, {
  maximumBytes = DEFAULT_MAXIMUM_BYTES,
} = {}) {
  if (typeof pathname !== "string" || pathname.length === 0) fail("a pathname is required.");
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1) {
    fail("maximumBytes must be a positive safe integer.");
  }

  let handle;
  try {
    handle = await open(
      resolve(pathname),
      fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0),
    );
  } catch (error) {
    fail(`the target could not be opened without following a symbolic link (${error instanceof Error ? error.message : String(error)}).`);
  }

  try {
    const before = await handle.stat({ bigint: true });
    if (!before.isFile()) fail("the target must be one regular file.");
    if (before.size < 1n || before.size > BigInt(maximumBytes)) {
      fail(`the target must be 1 through ${maximumBytes} bytes.`);
    }

    const hash = createHash("sha256");
    const buffer = Buffer.allocUnsafe(READ_BUFFER_BYTES);
    let position = 0;
    while (position < Number(before.size)) {
      const remaining = Number(before.size) - position;
      const { bytesRead } = await handle.read(
        buffer,
        0,
        Math.min(buffer.byteLength, remaining),
        position,
      );
      if (bytesRead < 1) fail("the target ended before its recorded size.");
      hash.update(buffer.subarray(0, bytesRead));
      position += bytesRead;
    }

    const after = await handle.stat({ bigint: true });
    if (!sameFileIdentity(before, after) || position !== Number(before.size)) {
      fail("the target changed while it was being hashed.");
    }
    return Object.freeze({
      sha256: hash.digest("hex"),
      byteCount: position,
    });
  } finally {
    await handle.close();
  }
}

function cliArguments(argumentsList) {
  if (argumentsList.length !== 1 && argumentsList.length !== 3) {
    fail("usage: node scripts/hash-regular-file-sha256.mjs <file> [--github-output <path>].");
  }
  const [pathname, option, githubOutputPath] = argumentsList;
  if (argumentsList.length === 3 && (option !== "--github-output" || !githubOutputPath)) {
    fail("the only supported option is --github-output <path>.");
  }
  return { pathname, githubOutputPath };
}

const isCommand = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isCommand) {
  const { pathname, githubOutputPath } = cliArguments(process.argv.slice(2));
  const result = await hashRegularFileSha256(pathname);
  if (githubOutputPath) {
    await appendFile(
      resolve(githubOutputPath),
      `sha256=${result.sha256}\nbyte_count=${result.byteCount}\n`,
      { encoding: "utf8", mode: 0o600 },
    );
  }
  process.stdout.write(`${result.sha256}  ${result.byteCount}\n`);
}
