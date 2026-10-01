import { readFileSync } from "node:fs";
import { get } from "./fetch.js";
import { pageChecks, siteChecks } from "./checks.js";
import { canonicalTag, descriptionTag, jsonLdTemplate, robotsPatch } from "./diffs.js";

const EVIDENCE = JSON.parse(readFileSync(new URL("../evidence/index-evidence.json", import.meta.url), "utf8"));
const WEIGHT = { pass: 1, warn: 0.5, fail: 0 };

export function normalizeUrl(input) {
  let text = String(input ?? "").trim();
  if (!/^https?:\/\//i.test(text)) text = `https://${text}`;
  const url = new URL(text);
  if (!url.hostname.includes(".")) throw new Error("Enter a public site such as example.com");
  return url.href;
}

export function score(checks) {
  const categories = {};
  for (const check of checks) {
    if (!(check.status in WEIGHT)) continue;
    (categories[check.category] ??= []).push(WEIGHT[check.status]);
  }
  const result = Object.fromEntries(Object.entries(categories).map(([name, values]) => [name, Math.round((100 * values.reduce((a, b) => a + b, 0)) / values.length)]));
  const values = Object.values(result);
  return { overall: values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null, categories: result };
}

export async function audit(input, { fetchImpl = fetch } = {}) {
  const url = normalizeUrl(input);
  const origin = new URL(url).origin;
  const [page, robots, sitemap, llms] = await Promise.all([
    get(url, { fetchImpl }), get(`${origin}/robots.txt`, { fetchImpl, accept: "text/plain" }),
    get(`${origin}/sitemap.xml`, { fetchImpl, accept: "application/xml" }), get(`${origin}/llms.txt`, { fetchImpl, accept: "text/plain" })
  ]);
  const path = new URL(page.url || url).pathname || "/";
  const checks = [...siteChecks({ robots, sitemap, llms, path }), ...pageChecks(page, { path })].map((check) => ({ ...check, evidence: EVIDENCE.checks?.[check.id] ?? null }));
  const diffs = {};
  for (const check of checks) {
    if (check.fix === "robots") {
      const patch = robotsPatch(robots.status === 200 ? robots.body : "", check.blocked, path);
      if (patch) diffs["robots.txt.patch"] = patch;
    }
    if (check.fix === "json_ld") diffs["structured-data.html"] = jsonLdTemplate(origin);
    if (check.fix === "canonical") diffs["canonical.html"] = canonicalTag(page.url || url);
    if (check.fix === "meta_description") diffs["meta-description.html"] = descriptionTag();
  }
  return {
    tool: "searchiz-audit", version: "1.0.0", url, audited_at: new Date().toISOString(),
    score: score(checks), checks: checks.map(({ fix, blocked, ...check }) => check), diffs,
    index: { period: EVIDENCE.period, valid_answers: EVIDENCE.valid_answers, engines: EVIDENCE.engines, answers_citing_kind: EVIDENCE.answers_citing_kind, source: EVIDENCE.source, method: EVIDENCE.method }
  };
}
