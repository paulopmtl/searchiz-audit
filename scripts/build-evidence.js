#!/usr/bin/env node
// Builds evidence/index-evidence.json from the index aggregate Searchiz
// publishes (bin/rails index:evidence): the answers' sample and period, and
// how the pages those answers cited most do on each check.
import { readFileSync, writeFileSync } from "node:fs";
import { get } from "../src/fetch.js";
import { pageChecks, siteChecks } from "../src/checks.js";

const input = JSON.parse(readFileSync(process.argv[2], "utf8"));
const results = {};
let pages = 0;
for (const { url } of input.top_cited_urls) {
  const origin = new URL(url).origin;
  const [page, robots, sitemap] = await Promise.all([get(url), get(`${origin}/robots.txt`, { accept: "text/plain" }), get(`${origin}/sitemap.xml`, { accept: "application/xml" })]);
  if (!page.status || page.status >= 400) continue;
  pages += 1;
  for (const check of [...siteChecks({ robots, sitemap, llms: { status: null }, path: new URL(page.url).pathname }), ...pageChecks(page)]) {
    if (!["pass", "warn", "fail"].includes(check.status)) continue;
    (results[check.id] ??= []).push(check.status === "pass");
  }
}
const checks = Object.fromEntries(Object.entries(results).filter(([, values]) => values.length >= 10).map(([id, values]) => [id, { pages: values.length, pass_rate: Math.round((values.filter(Boolean).length / values.length) * 100) / 100, checked_on: new Date().toISOString().slice(0, 10) }]));
const { top_cited_urls, ...summary } = input;
writeFileSync(new URL("../evidence/index-evidence.json", import.meta.url), `${JSON.stringify({ ...summary, cited_pages_read: pages, checks }, null, 2)}\n`);
console.log(`${pages} cited pages read; ${Object.keys(checks).length} checks with evidence`);
