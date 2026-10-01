// Small, dependency-free readers for the parts of a page the checks need.
const decode = (text) => text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
const attr = (tag, name) => decode(tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"))?.slice(2).find((value) => value !== undefined) ?? "");

export function tags(html, name) {
  return [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, "gi"))].map((match) => match[0]);
}

export function title(html) {
  return decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/\s+/g, " ").trim();
}

export function meta(html, name) {
  const tag = tags(html, "meta").find((item) => attr(item, "name").toLowerCase() === name);
  return tag ? attr(tag, "content").trim() : null;
}

export function canonical(html) {
  const tag = tags(html, "link").find((item) => attr(item, "rel").toLowerCase().split(/\s+/).includes("canonical"));
  return tag ? attr(tag, "href") : null;
}

export function jsonLd(html) {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const nodes = [];
  const walk = (value) => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object") {
      if (value["@graph"]) walk(value["@graph"]);
      else nodes.push(value);
    }
  };
  for (const block of blocks) {
    try { walk(JSON.parse(block[1])); } catch { nodes.push({ "@invalid": true }); }
  }
  return nodes;
}

export function types(nodes) {
  return [...new Set(nodes.flatMap((node) => [].concat(node["@type"] ?? [])))];
}

export function headings(html, level) {
  return [...html.matchAll(new RegExp(`<h${level}\\b[^>]*>([\\s\\S]*?)<\\/h${level}>`, "gi"))].map((match) => decode(match[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim());
}

export function visibleText(html) {
  return decode(html.replace(/<(script|style|noscript|template)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}
