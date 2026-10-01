import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { audit, score } from "../src/audit.js";
import { markdown } from "../src/report.js";
import { isAllowed } from "../src/vendor/robots.js";
import { robotsPatch } from "../src/diffs.js";

const vectors = JSON.parse(readFileSync(new URL("./robots-vectors.json", import.meta.url), "utf8"));

test("robots matching is the same as the Searchiz app and searchiz-bots", () => {
  for (const item of vectors.cases) assert.equal(isAllowed(item.robots, item.agent, item.path), item.allowed);
});

const site = (pages) => async (url) => {
  const page = pages[url];
  if (!page) return { url, status: 404, headers: new Headers(), text: async () => "" };
  return { url, status: page.status ?? 200, headers: new Headers(page.headers ?? {}), text: async () => page.body };
};

test("a thin page blocked to AI search gets failing checks, index evidence and fixes", async () => {
  const fetchImpl = site({
    "https://shop.example.com/": { body: "<html><head><title>Hi</title></head><body><h1>Shop</h1><p>Welcome</p></body></html>" },
    "https://shop.example.com/robots.txt": { body: "User-agent: OAI-SearchBot\nDisallow: /\n\nUser-agent: *\nAllow: /" }
  });
  const result = await audit("shop.example.com", { fetchImpl });
  const byId = Object.fromEntries(result.checks.map((check) => [check.id, check]));
  assert.equal(byId.search_crawlers.status, "fail");
  assert.match(byId.search_crawlers.found, /OAI-SearchBot/);
  assert.equal(byId.structured_data.status, "fail");
  assert.equal(byId.sitemap.status, "warn");
  assert.ok(byId.structured_data.evidence.pages >= 10);
  assert.ok(result.diffs["robots.txt.patch"].includes("+User-agent: OAI-SearchBot"));
  assert.ok(result.diffs["structured-data.html"].includes("REPLACE"));
  const report = markdown(result);
  assert.match(report, /valid answers to discovery questions/);
  assert.doesNotMatch(report, /[–—]/);
});

test("an unreadable site is unknown, never a failure about the business", async () => {
  const result = await audit("down.example.com", { fetchImpl: async () => { throw new Error("offline"); } });
  const byId = Object.fromEntries(result.checks.map((check) => [check.id, check]));
  assert.equal(byId.page_reachable.status, "unknown");
  assert.equal(byId.search_crawlers.status, "unknown");
  assert.equal(result.score.overall, null);
});

test("the robots patch really releases every blocked crawler", () => {
  const patch = robotsPatch("User-agent: *\nDisallow: /", ["OAI-SearchBot", "PerplexityBot"]);
  const after = "User-agent: *\nDisallow: /\n" + patch.split("\n").filter((line) => line.startsWith("+") && !line.startsWith("+++")).map((line) => line.slice(1)).join("\n");
  assert.ok(isAllowed(after, "OAI-SearchBot", "/"));
  assert.ok(isAllowed(after, "PerplexityBot", "/"));
  assert.ok(!isAllowed(after, "GPTBot", "/"));
});

test("scores count warnings as half and ignore notes", () => {
  assert.deepEqual(score([{ category: "a", status: "pass" }, { category: "a", status: "warn" }, { category: "b", status: "info" }]), { overall: 75, categories: { a: 75 } });
});
