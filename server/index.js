import express from "express";
import cors from "cors";
import path from "path";
import net from "net";
import http from "http";
import https from "https";
import dns from "dns/promises";
import { fileURLToPath } from "url";
import rateLimit from "express-rate-limit";
import { runAgentChatStream } from "./agent.js";
import { enrichOpinionOutcome } from "./typesafe.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 8787;
const CL_BASE = "https://www.courtlistener.com";
const TOKEN = process.env.COURTLISTENER_TOKEN || process.env.CL_TOKEN || "";
const ACCESS_PASSWORD = process.env.CASEFILE_ACCESS_PASSWORD || process.env.ACCESS_PASSWORD || process.env.CASEFILE_PASSWORD || "";

// Optional LLM inference via Nebius Token Factory (OpenAI-compatible)
function resolveModelName(name) {
  const trimmed = (name || "").trim();
  if (!trimmed) return "deepseek-ai/DeepSeek-V4.1-Flash";
  if (trimmed.toLowerCase().includes("deepseek")) return "deepseek-ai/DeepSeek-V4.1-Flash";
  if (trimmed.toLowerCase().includes("glm-5.3-flash")) return "zai-org/GLM-5.3-Flash";
  if (trimmed.toLowerCase().includes("glm-5.3")) return "zai-org/GLM-5.3";
  if (trimmed.toLowerCase().includes("glm-5.2")) return "zai-org/GLM-5.2";
  if (trimmed.toLowerCase().includes("glm-5.1")) return "zai-org/GLM-5.1";
  return trimmed;
}

const NEBIUS_KEY = process.env.NEBIUS_API_KEY || process.env.GOOGLE_GEMINI_KEY || "";
const NEBIUS_MODEL = resolveModelName(process.env.NEBIUS_MODEL || "deepseek-ai/DeepSeek-V4.1-Flash");
const NEBIUS_BASE_URL = process.env.NEBIUS_BASE_URL || "https://api.tokenfactory.nebius.com/v1";
const TYPESAFE_API_KEY = (process.env.TYPESAFE_API_KEY || "").trim();

// Optional shared-password gate for a private/pre-launch deploy. When set, every

// Behind a host proxy (Render/Railway/Fly), trust it so rate-limit sees real IPs.
// Only enable when explicitly configured: trusting the proxy unconditionally lets
// any client spoof `X-Forwarded-For` and sidestep the per-IP rate limits below.
// TRUST_PROXY accepts a hop count ("1"), a boolean ("true"/"false"), or an
// Express trust-proxy expression such as "loopback" / a subnet.
const TRUST_PROXY = process.env.TRUST_PROXY;
if (TRUST_PROXY !== undefined && TRUST_PROXY !== "") {
  if (/^\d+$/.test(TRUST_PROXY)) {
    app.set("trust proxy", Number(TRUST_PROXY));
  } else if (TRUST_PROXY === "true" || TRUST_PROXY === "false") {
    app.set("trust proxy", TRUST_PROXY === "true");
  } else {
    app.set("trust proxy", TRUST_PROXY);
  }
}
const CORS_ORIGINS = (process.env.CORS_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
app.use(CORS_ORIGINS.length ? cors({ origin: CORS_ORIGINS }) : cors());
app.use(express.json({ limit: "2mb" }));

// Rate limits. Cheap reads get a generous bucket; the LLM/scraping endpoints
// that cost real money get a tight one so a public URL can't drain the wallet.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_API) || 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many searches at once. Please wait a moment and try again." },
});
const costlyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_COSTLY) || 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Hourly limit reached for text extraction and summaries. Please try again in a little while." },
});

// Access gate + baseline limiter applied to the whole API surface.
app.use("/api", apiLimiter, (req, res, next) => {
  if (!ACCESS_PASSWORD || req.path === "/health") return next();
  const provided = req.get("x-access-password") || req.query.access;
  if (provided === ACCESS_PASSWORD) return next();
  return res.status(401).json({ error: "Password required to access this tool." });
});

function clHeaders(extra = {}) {
  const h = {
    Accept: "application/json",
    "User-Agent": "CaseFile/1.0 (legal-research-demo; contact@casefile.local)",
    ...extra,
  };
  if (TOKEN) h.Authorization = `Token ${TOKEN}`;
  return h;
}

async function clFetch(urlPath, options = {}) {
  const url = urlPath.startsWith("http") ? urlPath : `${CL_BASE}${urlPath}`;
  const res = await fetch(url, {
    ...options,
    headers: { ...clHeaders(options.headers || {}), ...(options.headers || {}) },
  });
  return res;
}

function absoluteLink(relativeOrAbsolute) {
  if (!relativeOrAbsolute) return "";
  if (relativeOrAbsolute.startsWith("http")) return relativeOrAbsolute;
  return `${CL_BASE}${relativeOrAbsolute.startsWith("/") ? "" : "/"}${relativeOrAbsolute}`;
}

function mapSearchResult(item) {
  const opinion = Array.isArray(item.opinions) ? item.opinions[0] : null;
  const opinionId = opinion?.id ?? null;
  const clusterId = item.cluster_id ?? null;
  const linkPath = item.absolute_url || (clusterId ? `/opinion/${clusterId}/` : "");
  const snippet =
    opinion?.snippet ||
    item.snippet ||
    item.syllabus ||
    "";

  return {
    Id: String(opinionId || clusterId || item.docket_id || ""),
    Link: absoluteLink(linkPath),
    Title: item.caseName || item.caseNameFull || "Untitled case",
    caseNameFull: item.caseNameFull || item.caseName || "",
    court: item.court || item.court_citation_string || "",
    courtId: item.court_id || "",
    dateFiled: item.dateFiled || null,
    docketNumber: item.docketNumber || "",
    citation: Array.isArray(item.citation) ? item.citation : [],
    status: item.status || "",
    clusterId,
    opinionId,
    downloadUrl: opinion?.download_url || null,
    snippet: cleanText(snippet),
    opinionText: cleanText(snippet),
    extracted: false,
  };
}

function cleanText(htmlOrText) {
  if (!htmlOrText) return "";
  let t = String(htmlOrText);
  t = t.replace(/<script[\s\S]*?<\/script>/gi, " ");
  t = t.replace(/<style[\s\S]*?<\/style>/gi, " ");
  t = t.replace(/<br\s*\/?>/gi, "\n");
  t = t.replace(/<\/p>/gi, "\n\n");
  t = t.replace(/<\/div>/gi, "\n");
  t = t.replace(/<[^>]+>/g, " ");
  t = t
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  t = t.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  t = t.replace(/[ \t]{2,}/g, " ").trim();
  // Strip common CourtListener chrome
  t = t.replace(/skip to main content/gi, "");
  t = t.replace(/It appears you are using Adblock[\s\S]{0,120}/gi, "");
  return t.trim();
}

// Heuristic: is this string actually binary (PDF/image bytes) rather than
// readable text? Catches PDFs that lie about their content-type.
function looksBinary(s) {
  if (!s) return false;
  const head = s.slice(0, 1000);
  if (head.startsWith("%PDF")) return true;
  if (/endstream|endobj|\/FlateDecode|xref\b/.test(head)) return true;
  // Count replacement char (U+FFFD) and C0 control chars (except tab/newline/CR).
  let bad = 0;
  for (let k = 0; k < head.length; k++) {
    const c = head.charCodeAt(k);
    if (c === 0xfffd || (c < 0x20 && c !== 9 && c !== 10 && c !== 13)) bad++;
  }
  return head.length ? bad / head.length > 0.05 : false;
}

// SSRF guard: only allow fetching public http(s) URLs. Court download links are
// third-party hosts we cannot enumerate, so instead of a host allow-list we
// reject any URL that resolves to a private, loopback, link-local, or otherwise
// non-public address. This blocks a client-supplied downloadUrl from being used
// to reach internal services or cloud metadata endpoints via this server.
function isBlockedIp(ip) {
  const type = net.isIP(ip); // 4, 6, or 0
  if (type === 4) {
    const p = ip.split(".").map(Number);
    if (p.length !== 4 || p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
    const [a, b] = p;
    if (a === 0) return true; // "this" network
    if (a === 10) return true; // private
    if (a === 127) return true; // loopback
    if (a === 169 && b === 254) return true; // link-local (incl. cloud metadata)
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast + reserved
    return false;
  }
  if (type === 6) {
    const v = ip.toLowerCase().split("%")[0]; // drop zone id
    if (v === "::1" || v === "::") return true; // loopback / unspecified
    if (v.startsWith("fe80")) return true; // link-local
    if (v.startsWith("fc") || v.startsWith("fd")) return true; // unique local
    // IPv4-mapped IPv6 (::ffff:a.b.c.d) — validate the embedded IPv4.
    const mapped = v.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isBlockedIp(mapped[1]);
    return false;
  }
  return true; // not a valid IP literal — treat as blocked
}

// Hard ceiling on any single third-party download we will buffer.
const MAX_DOWNLOAD_BYTES = Number(process.env.MAX_DOWNLOAD_BYTES) || 2_000_000;

// Validate a URL and return the exact address to connect to. Returning the
// address (rather than a bare boolean) lets the caller pin the connection to the
// IP that was actually validated — without pinning, the hostname is resolved a
// second time at connect and a hostile DNS server can answer "public" during
// validation and "internal" at connect time (DNS rebinding).
async function resolvePublicUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

  const host = parsed.hostname;
  // Bare IP literal: no DNS involved, so validate it directly.
  const literal = net.isIP(host);
  if (literal) {
    if (isBlockedIp(host)) return null;
    return { parsed, address: host, family: literal };
  }

  // Resolve once, reject if ANY answer is non-public, and pin the first address.
  try {
    const records = await dns.lookup(host, { all: true });
    if (!records.length) return null;
    for (const { address } of records) {
      if (isBlockedIp(address)) return null;
    }
    return { parsed, address: records[0].address, family: records[0].family };
  } catch {
    return null; // unresolvable host — do not fetch
  }
}

// Single request to an already-validated target, pinned to `address`. The URL's
// hostname is preserved so the Host header and TLS SNI stay correct.
//
// `deadline` is an absolute wall-clock timestamp, not an idle timeout: a hostile
// endpoint can trickle one byte at a time to reset an inactivity timer forever,
// so the socket is destroyed once the deadline passes regardless of activity.
function requestPinned({ parsed, address, family }, { headers, deadline }) {
  return new Promise((resolve, reject) => {
    const mod = parsed.protocol === "https:" ? https : http;
    // Node calls lookup with {all:true} when autoSelectFamily is on (default in
    // Node 20+), which expects an array; older callers expect (address, family).
    const lookup = (_hostname, opts, cb) =>
      opts && opts.all ? cb(null, [{ address, family }]) : cb(null, address, family);

    const req = mod.request(parsed, { method: "GET", headers, lookup }, resolve);
    const timer = setTimeout(
      () => req.destroy(new Error("download deadline exceeded")),
      Math.max(1, deadline - Date.now())
    );
    timer.unref?.(); // never hold the process open
    const clear = () => clearTimeout(timer);
    req.on("close", clear); // fires once the response is done or the socket dies
    req.on("error", (err) => {
      clear();
      reject(err);
    });
    req.end();
  });
}

// Read a response body with a hard byte ceiling, aborting mid-stream once the
// limit is passed. Buffering the whole body first (res.text()) would let a
// hostile endpoint stream unbounded data and exhaust memory before any cap.
async function readCapped(res, maxBytes, deadline) {
  const declared = Number(res.headers["content-length"]);
  if (Number.isFinite(declared) && declared > maxBytes) {
    res.destroy();
    return null;
  }
  const chunks = [];
  let total = 0;
  try {
    for await (const chunk of res) {
      // Stop on wall-clock deadline as well as size: a slow trickle can stay
      // under the byte cap indefinitely while holding the connection open.
      if (deadline && Date.now() > deadline) {
        res.destroy();
        return null;
      }
      total += chunk.length;
      if (total > maxBytes) {
        res.destroy();
        return null; // oversized — stop reading immediately
      }
      chunks.push(chunk);
    }
  } catch {
    return null;
  }
  return Buffer.concat(chunks).toString("utf8");
}

// Redirect-safe, rebinding-safe, size-capped fetch for third-party URLs.
// Every hop is re-validated and pinned; the body is streamed under a byte cap.
async function safeFetch(
  rawUrl,
  { headers = {}, totalTimeoutMs = 10_000, maxRedirects = 5, maxBytes = MAX_DOWNLOAD_BYTES } = {}
) {
  // One absolute budget for the whole operation — DNS, connect, every redirect
  // hop, and the body read. A per-request idle timeout would let a hostile host
  // trickle bytes (or chain slow redirects) and hold resources indefinitely.
  const deadline = Date.now() + totalTimeoutMs;
  let url = rawUrl;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    if (Date.now() >= deadline) return null;

    const target = await resolvePublicUrl(url);
    if (!target) return null; // blocked, unresolvable, or non-http(s)
    if (Date.now() >= deadline) return null; // DNS may have consumed the budget

    let res;
    try {
      res = await requestPinned(target, { headers, deadline });
    } catch {
      return null; // connection error or deadline hit
    }
    const status = res.statusCode;

    if (status >= 300 && status < 400) {
      const loc = res.headers.location;
      // Destroy rather than drain: draining a hostile redirect body is itself an
      // unbounded read, and we never need a redirect's content.
      res.destroy();
      if (!loc) return null;
      try {
        url = new URL(loc, url).toString(); // resolve relative redirects
      } catch {
        return null;
      }
      continue; // next hop re-validates + re-pins at the top of the loop
    }

    const contentType = String(res.headers["content-type"] || "").toLowerCase();
    const text = await readCapped(res, maxBytes, deadline);
    if (text === null) return null; // oversized, too slow, or read error
    return { ok: status >= 200 && status < 300, status, contentType, text };
  }
  return null; // too many redirects
}

async function fetchOpinionFullText(caseItem) {
  // 1) Authenticated API path
  if (TOKEN && caseItem.opinionId) {
    try {
      const res = await clFetch(`/api/rest/v4/opinions/${caseItem.opinionId}/`);
      if (res.ok) {
        const data = await res.json();
        const text =
          data.plain_text ||
          cleanText(data.html_with_citations || data.html || data.html_lawbox || "");
        if (text && text.length > 80) {
          return { text, source: "courtlistener-api", extracted: true };
        }
      }
    } catch {
      /* fall through */
    }
  }

  // 2) Public download_url from court site when present. safeFetch validates the
  // URL and every redirect hop against the SSRF guard before fetching.
  if (caseItem.downloadUrl && /^https?:\/\//i.test(caseItem.downloadUrl)) {
    try {
      const res = await safeFetch(caseItem.downloadUrl, {
        headers: {
          "User-Agent": "CaseFile/1.0 (legal-research-demo)",
          Accept: "text/html,application/xhtml+xml,text/plain",
        },
        // Total wall-clock budget for DNS + connect + redirects + body.
        totalTimeoutMs: Number(process.env.DOWNLOAD_TIMEOUT_MS) || 10_000,
      });
      if (res && res.ok) {
        // Only accept textual downloads. Court sites frequently serve PDFs,
        // whose raw bytes would otherwise be dumped as mojibake.
        const ctype = res.contentType;
        const isTextual = /text\/html|xhtml|text\/plain/.test(ctype) || ctype === "";
        if (isTextual) {
          const raw = res.text;
          if (!looksBinary(raw)) {
            const text = cleanText(raw);
            if (text && text.length > 200) {
              // Cap extremely long downloads for JSON export sanity
              const capped =
                text.length > 120000 ? text.slice(0, 120000) + "\n\n[truncated]" : text;
              return { text: capped, source: "court-download", extracted: true };
            }
          }
        }
        // Non-text (PDF, etc.) — fall through to the snippet rather than
        // returning unreadable bytes.
      }
    } catch {
      /* fall through */
    }
  }

  // 3) Snippet fallback from search index
  return {
    text: caseItem.snippet || caseItem.opinionText || "",
    source: "search-snippet",
    extracted: Boolean(caseItem.snippet && caseItem.snippet.length > 40),
  };
}

// Field shape the enrichment LLM is asked to fill (values are descriptions).
const ENRICH_SCHEMA = {
  summary: "2-3 sentence neutral summary of the holding",
  court: "issuing court",
  jurisdiction: "federal | state name | tribal | other",
  outcome: "affirmed | reversed | remanded | dismissed | mixed | unknown",
  precedents: "array of cited case names, [] if none",
};

// Best-effort structured extraction over the opinion text using TypeSafe AI and/or Nebius Token Factory. Returns null when no
// key is configured or the call fails, so enrichment never breaks a request.
export async function enrichWithLlm(caseItem) {
  const text = caseItem.opinionText || caseItem.snippet || "";
  if (!text) return null;

  // Leverage TypeSafe System One for sub-100ms calibrated outcome extraction if available
  const activeTypeSafeKey = process.env.TYPESAFE_API_KEY || TYPESAFE_API_KEY;
  const activeNebiusKey = process.env.NEBIUS_API_KEY || NEBIUS_KEY;

  let typeSafeOutcome = null;
  if (activeTypeSafeKey) {
    try {
      const outcomeRes = await enrichOpinionOutcome(text, activeTypeSafeKey);
      if (outcomeRes?.outcome && outcomeRes.outcome !== "unknown") {
        typeSafeOutcome = outcomeRes.outcome;
      }
    } catch (err) {
      console.warn("[enrich] TypeSafe outcome enrichment fallback:", err.message);
    }
  }

  if (!activeNebiusKey) {
    if (typeSafeOutcome) {
      return {
        summary: caseItem.snippet ? `${cleanText(caseItem.snippet).slice(0, 220)}...` : `Disposition: ${typeSafeOutcome}`,
        court: caseItem.court || "",
        jurisdiction: "",
        outcome: typeSafeOutcome,
        precedents: [],
      };
    }
    return null;
  }

  const systemInstruction =
    "You are an expert legal-case data extractor. Return ONLY valid JSON matching this schema: " +
    JSON.stringify(ENRICH_SCHEMA) +
    ". Do not include extra text, explanations, or code fencing.";

  const userPrompt =
    `Case: ${caseItem.Title || "Untitled"}\nCourt (hint): ${caseItem.court || "unknown"}\n\n` +
    `Opinion text:\n${text.slice(0, 24000)}`;

  try {
    const activeModel = resolveModelName(process.env.NEBIUS_MODEL || NEBIUS_MODEL);
    const timeoutMs = Number(process.env.LLM_TIMEOUT_MS) || 60000;
    const res = await fetch(`${NEBIUS_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${activeNebiusKey}`,
      },
      body: JSON.stringify({
        model: activeModel,
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[enrich] Nebius HTTP ${res.status}: ${body.slice(0, 300)}`);
      if (typeSafeOutcome) {
        return {
          summary: "",
          court: caseItem.court || "",
          jurisdiction: "",
          outcome: typeSafeOutcome,
          precedents: [],
        };
      }
      return null;
    }

    const data = await res.json();
    let raw = data?.choices?.[0]?.message?.content || "";
    if (!raw) {
      console.error(`[enrich] Empty response: ${JSON.stringify(data).slice(0, 300)}`);
      if (typeSafeOutcome) {
        return {
          summary: "",
          court: caseItem.court || "",
          jurisdiction: "",
          outcome: typeSafeOutcome,
          precedents: [],
        };
      }
      return null;
    }
    raw = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/```json/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(raw);
    return {
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      court: typeof parsed.court === "string" ? parsed.court : "",
      jurisdiction: typeof parsed.jurisdiction === "string" ? parsed.jurisdiction : "",
      outcome: typeSafeOutcome || (typeof parsed.outcome === "string" ? parsed.outcome : ""),
      precedents: Array.isArray(parsed.precedents) ? parsed.precedents.map(String) : [],
    };
  } catch (e) {
    console.error(`[enrich] ${e.name}: ${e.message}`);
    if (typeSafeOutcome) {
      return {
        summary: "",
        court: caseItem.court || "",
        jurisdiction: "",
        outcome: typeSafeOutcome,
        precedents: [],
      };
    }
    return null;
  }
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "CaseFile",
    courtlistenerToken: Boolean(TOKEN),
    nebiusToken: Boolean(NEBIUS_KEY),
    typesafeAvailable: Boolean(TYPESAFE_API_KEY),
    llmEnrichment: Boolean(NEBIUS_KEY || TYPESAFE_API_KEY),
    model: NEBIUS_MODEL,
  });
});

app.get("/api/search", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) {
      return res.status(400).json({ error: "Please enter a search query." });
    }

    const pageSize = Math.min(Math.max(parseInt(req.query.page_size, 10) || 15, 1), 30);
    const orderBy = String(req.query.order_by || "score desc");
    const params = new URLSearchParams({
      q,
      type: "o",
      order_by: orderBy,
      page_size: String(pageSize),
    });

    // Mirror n8n template filters when requested
    if (req.query.stat_Published === "on" || req.query.published === "1") {
      params.set("stat_Published", "on");
    }
    if (req.query.court) params.set("court", String(req.query.court));

    const clRes = await clFetch(`/api/rest/v4/search/?${params.toString()}`);
    if (!clRes.ok) {
      const body = await clRes.text();
      return res.status(clRes.status).json({
        error: "Court case search failed",
        detail: body.slice(0, 500),
      });
    }

    const data = await clRes.json();
    // CourtListener may ignore page_size without a token; enforce client page size here.
    const results = (data.results || []).map(mapSearchResult).slice(0, pageSize);

    res.json({
      query: q,
      count: data.count ?? results.length,
      next: data.next || null,
      results,
      meta: {
        source: "courtlistener",
        orderedBy: orderBy,
        pageSize,
        tokenMode: Boolean(TOKEN),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Search failed", detail: String(err.message || err) });
  }
});

app.post("/api/extract", costlyLimiter, async (req, res) => {
  try {
    const cases = Array.isArray(req.body?.cases) ? req.body.cases : [];
    if (!cases.length) {
      return res.status(400).json({ error: "Please choose at least one case." });
    }

    // Cap how many opinions we scrape per call to bound cost/latency. The default
    // search page is 15, so cover a full page; anything beyond is reported as
    // skipped rather than silently dropped.
    const MAX_EXTRACT = Number(process.env.EXTRACT_MAX) || 15;
    const limit = Math.min(cases.length, MAX_EXTRACT);
    const extracted = [];

    for (let i = 0; i < limit; i++) {
      const c = cases[i];
      const full = await fetchOpinionFullText(c);
      extracted.push({
        Id: c.Id,
        Link: c.Link,
        Title: c.Title,
        court: c.court || "",
        dateFiled: c.dateFiled || null,
        docketNumber: c.docketNumber || "",
        citation: c.citation || [],
        opinionText: full.text,
        textSource: full.source,
        extracted: full.extracted,
      });
      // Gentle pacing to respect upstream
      if (i < limit - 1) await new Promise((r) => setTimeout(r, 350));
    }

    res.json({
      count: extracted.length,
      requested: cases.length,
      skipped: Math.max(0, cases.length - limit),
      cases: extracted,
      schema: ["Id", "Link", "Title", "opinionText"],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not get full text", detail: String(err.message || err) });
  }
});

app.post("/api/enrich", costlyLimiter, async (req, res) => {
  try {
    const cases = Array.isArray(req.body?.cases) ? req.body.cases : [];
    if (!cases.length) {
      return res.status(400).json({ error: "Please choose at least one case." });
    }
    if (!NEBIUS_KEY && !TYPESAFE_API_KEY) {
      return res.json({
        count: 0,
        cases: [],
        mode: "disabled",
        detail: "Configure NEBIUS_API_KEY or TYPESAFE_API_KEY on the server to turn on AI summaries.",
      });
    }

    const limit = Math.min(cases.length, 8);
    const enriched = [];
    for (let i = 0; i < limit; i++) {
      const meta = await enrichWithLlm(cases[i]);
      enriched.push({ Id: cases[i].Id, enriched: Boolean(meta), ...(meta || {}) });
      // Pace requests, echoing the n8n Wait node between case extractions.
      if (i < limit - 1) await new Promise((r) => setTimeout(r, 500));
    }

    const mode = NEBIUS_KEY ? "nebius" : "typesafe";
    const model = NEBIUS_KEY ? NEBIUS_MODEL : "jev-latest";
    res.json({ count: enriched.length, cases: enriched, mode, model });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create AI summaries", detail: String(err.message || err) });
  }
});

// Fetches a third-party download URL like /api/extract, so it carries the same
// tighter limiter rather than only the generous baseline one.
app.get("/api/case/:id", costlyLimiter, async (req, res) => {
  try {
    const id = req.params.id;
    const seed = {
      Id: id,
      Link: req.query.link ? String(req.query.link) : `${CL_BASE}/opinion/${id}/`,
      Title: String(req.query.title || "Case"),
      opinionId: /^\d+$/.test(id) ? Number(id) : null,
      downloadUrl: req.query.downloadUrl ? String(req.query.downloadUrl) : null,
      snippet: "",
    };
    const full = await fetchOpinionFullText(seed);
    res.json({
      Id: seed.Id,
      Link: seed.Link,
      Title: seed.Title,
      opinionText: full.text,
      textSource: full.source,
      extracted: full.extracted,
    });
  } catch (err) {
    res.status(500).json({ error: "Could not open court case", detail: String(err.message || err) });
  }
});

// Autonomous Legal Agent SSE Chat Stream
app.post("/api/agent/chat", async (req, res) => {
  try {
    await runAgentChatStream({
      req,
      res,
      clToken: TOKEN,
      nebiusKey: NEBIUS_KEY,
      nebiusModel: NEBIUS_MODEL,
      nebiusBaseUrl: NEBIUS_BASE_URL,
      typesafeKey: TYPESAFE_API_KEY,
    });
  } catch (err) {
    console.error("[agent] Unhandled chat stream error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "AI assistant ran into an issue", detail: err.message });
    }
  }
});

// Production static serve (SPA fallback)
const dist = path.join(__dirname, "..", "dist");
app.use(express.static(dist));
app.use((req, res, next) => {
  if (req.method !== "GET" || req.path.startsWith("/api")) return next();
  res.sendFile(path.join(dist, "index.html"), (err) => {
    if (err) next();
  });
});

const isTestMode =
  process.env.NODE_ENV === "test" ||
  process.env.npm_lifecycle_event === "test" ||
  Boolean(process.env.TEST_ENV);

if (!isTestMode) {
  app.listen(PORT, () => {
    console.log(`CaseFile API on http://localhost:${PORT}`);
    console.log(`CourtListener token: ${TOKEN ? "configured" : "not set (search + snippets)"}`);
    console.log(`LLM inference: ${NEBIUS_KEY ? `Nebius (${NEBIUS_MODEL})` : "off (set NEBIUS_API_KEY)"}`);
    console.log(`TypeSafe System One: ${TYPESAFE_API_KEY ? "ready (jev-latest)" : "not configured (optional)"}`);
    console.log(`Access gate: ${ACCESS_PASSWORD ? "ON (password required)" : "off (public)"}`);
    console.log(
      `Rate limits: ${apiLimiter.max ?? "?"}/15m api, ${costlyLimiter.max ?? "?"}/60m extract+enrich`
    );
  });
}
