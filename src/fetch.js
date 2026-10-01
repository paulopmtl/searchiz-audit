const MAX_BYTES = 3_000_000;
export const USER_AGENT = "Mozilla/5.0 (compatible; searchiz-audit/1.0; +https://github.com/searchiz/searchiz-audit)";

// One GET with a timeout and a size cap. Never throws: a failure is returned
// as status null so a check can report "could not read", not "missing".
export async function get(url, { fetchImpl = fetch, accept = "text/html" } = {}) {
  try {
    const response = await fetchImpl(url, { headers: { "User-Agent": USER_AGENT, Accept: accept }, redirect: "follow", signal: AbortSignal.timeout(20000) });
    const text = (await response.text()).slice(0, MAX_BYTES);
    return { url: response.url || url, status: response.status, headers: response.headers, body: text };
  } catch (error) {
    return { url, status: null, headers: new Headers(), body: "", error: String(error?.message ?? error) };
  }
}
