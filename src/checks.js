import { BOTS } from "./vendor/bots.js";
import { isAllowed, parseRobots } from "./vendor/robots.js";
import { canonical, headings, jsonLd, meta, title, types, visibleText } from "./html.js";

export const SEARCH_CRAWLERS = BOTS.filter((bot) => bot.kind === "search").map((bot) => bot.name);
const ENTITY_TYPES = ["Organization", "LocalBusiness", "Corporation", "Store", "OnlineStore", "ProfessionalService", "Product", "SoftwareApplication", "WebSite", "Person"];

// Each check: id, category, status (pass | fail | warn | info | unknown),
// what was found, and a fix when there is one. "unknown" means the page could
// not be read; it is never a failure.
export function pageChecks(page, { path = "/" } = {}) {
  if (!page.status || page.status >= 400) {
    return [{ id: "page_reachable", category: "access", status: page.status ? "fail" : "unknown", found: page.status ? `HTTP ${page.status}` : "could not be read" }];
  }
  const html = page.body;
  const noindexMeta = /\bnoindex\b/i.test(meta(html, "robots") ?? "") || /\bnoindex\b/i.test(meta(html, "googlebot") ?? "");
  const noindexHeader = /\bnoindex\b/i.test(page.headers.get("x-robots-tag") ?? "");
  const link = canonical(html);
  let canonicalSelf = null;
  try { canonicalSelf = link ? new URL(link, page.url).href.replace(/\/$/, "") === page.url.split("#")[0].split("?")[0].replace(/\/$/, "") : null; } catch { canonicalSelf = false; }
  const nodes = jsonLd(html);
  const found = types(nodes);
  const pageTitle = title(html);
  const description = meta(html, "description");
  const h1 = headings(html, 1);
  const questions = [...headings(html, 2), ...headings(html, 3)].filter((text) => text.endsWith("?"));
  const words = visibleText(html).split(" ").filter(Boolean).length;
  return [
    { id: "page_reachable", category: "access", status: "pass", found: `HTTP ${page.status}` },
    { id: "https", category: "access", status: page.url.startsWith("https://") ? "pass" : "fail", found: new URL(page.url).protocol.replace(":", "") },
    { id: "indexable", category: "access", status: noindexMeta || noindexHeader ? "fail" : "pass", found: noindexMeta || noindexHeader ? `noindex in ${noindexMeta ? "meta robots" : "X-Robots-Tag"}` : "no noindex" },
    { id: "canonical", category: "structure", status: link ? (canonicalSelf ? "pass" : "warn") : "fail", found: link ?? "none", fix: link ? null : "canonical" },
    { id: "structured_data", category: "structure", status: found.some((type) => ENTITY_TYPES.includes(type)) ? "pass" : "fail", found: found.length ? found.join(", ") : "none", fix: found.some((type) => ENTITY_TYPES.includes(type)) ? null : "json_ld" },
    { id: "single_h1", category: "structure", status: h1.length === 1 ? "pass" : "warn", found: `${h1.length} h1` },
    { id: "title", category: "content", status: pageTitle.length >= 10 && pageTitle.length <= 70 ? "pass" : pageTitle ? "warn" : "fail", found: pageTitle ? `${pageTitle.length} characters` : "none" },
    { id: "meta_description", category: "content", status: description && description.length >= 50 && description.length <= 160 ? "pass" : description ? "warn" : "fail", found: description ? `${description.length} characters` : "none", fix: description ? null : "meta_description" },
    { id: "answers_questions", category: "content", status: types(nodes).includes("FAQPage") || questions.length >= 2 ? "pass" : "warn", found: types(nodes).includes("FAQPage") ? "FAQPage" : `${questions.length} question headings` },
    { id: "content_depth", category: "content", status: words >= 300 ? "pass" : "warn", found: `${words} words` }
  ];
}

export function siteChecks({ robots, sitemap, llms, path = "/" }) {
  const groups = robots.status === 200 ? parseRobots(robots.body) : robots.status === 404 ? [] : null;
  const blocked = groups ? SEARCH_CRAWLERS.filter((name) => !isAllowed(groups, name, path)) : [];
  const sitemapInRobots = robots.status === 200 && /^\s*sitemap\s*:/im.test(robots.body);
  return [
    { id: "search_crawlers", category: "access", status: groups === null ? "unknown" : blocked.length ? "fail" : "pass", found: groups === null ? "robots.txt could not be read" : blocked.length ? `blocked: ${blocked.join(", ")}` : `allowed: ${SEARCH_CRAWLERS.join(", ")}`, blocked, fix: blocked.length ? "robots" : null },
    { id: "sitemap", category: "access", status: sitemap.status === 200 || sitemapInRobots ? "pass" : sitemap.status === null ? "unknown" : "warn", found: sitemap.status === 200 ? "/sitemap.xml" : sitemapInRobots ? "declared in robots.txt" : "none found" },
    { id: "llms_txt", category: "extras", status: "info", found: llms.status === 200 ? "present" : "absent" }
  ];
}
