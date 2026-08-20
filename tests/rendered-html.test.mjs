import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function loadWorker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: handler } = await import(workerUrl.href);

  return handler;
}

async function render(pathname) {
  const handler = await loadWorker();

  const response = await handler(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html" },
    }),
  );

  return { response, html: await response.text() };
}

test("renders document metadata", async () => {
  const { response, html } = await render("/");

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  assert.match(html, /<title>hah\.dev<\/title>/);
});

test("renders every primary route with its page heading", async () => {
  const routes = [
    ["/", "Yes, my initials spell", "hah.dev"],
    ["/resume", "Resume", "Resume | hah.dev."],
    ["/tools", "Tools", "Tools | hah.dev."],
    ["/shelf", "Shelf", "Shelf | hah.dev."],
  ];

  for (const [pathname, heading, title] of routes) {
    const { response, html } = await render(pathname);
    assert.equal(response.status, 200, pathname);
    assert.match(html, new RegExp(`<h1[^>]*>[^<]*${heading}`, "i"), pathname);
    assert.ok(html.includes(`<title>${title}</title>`), `${pathname} title`);
  }
});

test("renders CHORUS and consistent project documentation icons", async () => {
  const { html } = await render("/resume");

  assert.match(html, /href="https:\/\/chorus\.observer\/">CHORUS<\/a>/);
  assert.match(
    html,
    /Social simulation of influence, uncertainty, and collective belief\./,
  );
  assert.match(html, /href="https:\/\/chorus\.observer\/notebooks\/"/);
  assert.equal((html.match(/class="bi bi-backpack4"/g) ?? []).length, 2);
});

test("renders shelf records before client hydration", async () => {
  const { html } = await render("/shelf");
  assert.equal((html.match(/<article class="card">/g) ?? []).length, 30);
  assert.match(html, /Ethical Machines/i);
  assert.match(html, /20 Sep 2022/);
  assert.match(html, />1859</);
  assert.match(html, />180 C\.E\.<\/dd>/);
  assert.match(html, /Orb: On the Movements of the Earth/i);
});

test("produces a complete static Pages artifact", async () => {
  const routes = ["index.html", "resume/index.html", "tools/index.html", "shelf/index.html", "404.html"];

  for (const route of routes) {
    const html = await readFile(new URL(`../site/${route}`, import.meta.url), "utf8");
    assert.match(html, /<!DOCTYPE html>/i, route);
  }

  const cname = await readFile(new URL("../site/CNAME", import.meta.url), "utf8");
  assert.equal(cname.trim(), "hah.dev");
});
