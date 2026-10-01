# searchiz-audit

Can AI search read your site, and does the page say clearly who you are?
Deterministic checks, ready-made fixes, and, for every check, how the pages
AI answers actually cite do on it.

```sh
npx github:searchiz/searchiz-audit example.com
npx github:searchiz/searchiz-audit example.com/pricing --format json --out audit.json --diffs ./fixes
```

No account and no telemetry: the only requests go to the site you name.

## What it checks

| Category | Checks |
|---|---|
| access | AI search crawlers allowed by robots.txt (OAI-SearchBot, Claude-SearchBot, PerplexityBot, Googlebot, bingbot, Applebot), page answers, HTTPS, no noindex, sitemap |
| structure | canonical address, structured data that says who you are (Organization, LocalBusiness, Product...), one main heading |
| content | title and meta description length, answers customer questions (FAQ or question headings), enough text to quote |
| extras | llms.txt (reported, not scored) |

Scores are 0 to 100 per category: a pass counts 1, a warning half. A page or
file that could not be read is `unknown`, never a failure.

## Evidence from the index

Each check shows how the pages AI answers cite most do on it. The numbers come
from the [Searchiz public AI recommendation index](https://searchiz.com/method):
`evidence/index-evidence.json` holds the sample (3,465 valid answers to
discovery questions from ChatGPT and Gemini, 22 September to 1 October 2026),
the kinds of sites those answers cited, and the result of these same checks on
the 32 most-cited pages that could be read on 1 October 2026. Only aggregated,
public data; nothing about any Searchiz customer.

These are observations about what gets cited, not proof that a fix causes a
citation.

## Ready-made changes

With `--diffs <dir>` the audit writes what it can prepare:

- `robots.txt.patch` lets the blocked AI search crawlers in, checked with the
  same robots rules as [searchiz-bots](https://github.com/searchiz/searchiz-bots);
- `structured-data.html`, `canonical.html`, `meta-description.html`: snippets.
  Anything only you know is marked `REPLACE`; never publish a placeholder.

Example output: [examples/searchiz.com.md](examples/searchiz.com.md).

## Use it from an agent

[searchiz-skill](https://github.com/searchiz/searchiz-skill) runs this audit
from Claude Code, Codex, Cursor or OpenClaw and opens a pull request with the
fixes.

## Scope

A free tool, not a product: no support promise and no roadmap. Wrong results
are welcome as issues.

Open source tells you what could be wrong. Searchiz tells you whether AI
actually recommends you, and fixes it: [run a free scan](https://searchiz.com).

## License

MIT
