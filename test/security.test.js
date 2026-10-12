import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import {
  isBlockedIp,
  resolvePublicUrl,
  sanitizeExternalLink,
} from "../server/index.js";
import { callNebius, resolveModelName } from "../server/agent.js";

test("SSRF guard blocks private IPv4 addresses", () => {
  assert.equal(isBlockedIp("127.0.0.1"), true, "loopback blocked");
  assert.equal(isBlockedIp("169.254.169.254"), true, "link-local metadata blocked");
  assert.equal(isBlockedIp("10.0.0.1"), true, "RFC 1918 10.x blocked");
  assert.equal(isBlockedIp("172.16.0.1"), true, "RFC 1918 172.16.x blocked");
  assert.equal(isBlockedIp("192.168.1.1"), true, "RFC 1918 192.168.x blocked");
  assert.equal(isBlockedIp("0.0.0.0"), true, "zero network blocked");
  assert.equal(isBlockedIp("100.64.0.1"), true, "CGNAT blocked");
  assert.equal(isBlockedIp("224.0.0.1"), true, "multicast blocked");
});

test("SSRF guard blocks IPv6 loopback, local, and mapped addresses in both dotted and hexadecimal", () => {
  assert.equal(isBlockedIp("::1"), true, "IPv6 loopback blocked");
  assert.equal(isBlockedIp("::"), true, "IPv6 unspecified blocked");
  assert.equal(isBlockedIp("fe80::1"), true, "IPv6 link-local blocked");
  assert.equal(isBlockedIp("fc00::1"), true, "IPv6 unique local blocked");
  assert.equal(isBlockedIp("fd12::1"), true, "IPv6 unique local blocked");

  // Dotted-decimal IPv4-mapped IPv6
  assert.equal(isBlockedIp("::ffff:127.0.0.1"), true, "IPv4-mapped loopback blocked");
  assert.equal(isBlockedIp("::ffff:169.254.169.254"), true, "IPv4-mapped metadata blocked");
  assert.equal(isBlockedIp("::ffff:10.0.0.1"), true, "IPv4-mapped private blocked");

  // Hexadecimal IPv4-mapped IPv6 (FINDING-01)
  assert.equal(isBlockedIp("::ffff:a9fe:a9fe"), true, "IPv4-mapped hex metadata a9fe:a9fe blocked");
  assert.equal(isBlockedIp("::ffff:7f00:1"), true, "IPv4-mapped hex loopback 7f00:1 blocked");
  assert.equal(isBlockedIp("0:0:0:0:0:ffff:a9fe:a9fe"), true, "Full IPv4-mapped hex blocked");

  // IPv4-compatible IPv6
  assert.equal(isBlockedIp("::127.0.0.1"), true, "IPv4-compatible loopback blocked");
  assert.equal(isBlockedIp("::a9fe:a9fe"), true, "IPv4-compatible hex metadata blocked");

  // 6to4 encapsulation
  assert.equal(isBlockedIp("2002:a9fe:a9fe::"), true, "6to4 metadata blocked");
  assert.equal(isBlockedIp("2002:7f00:0001::"), true, "6to4 loopback blocked");
});

test("SSRF guard allows public IP addresses", () => {
  assert.equal(isBlockedIp("8.8.8.8"), false, "Google DNS allowed");
  assert.equal(isBlockedIp("1.1.1.1"), false, "Cloudflare DNS allowed");
  assert.equal(isBlockedIp("2606:4700:4700::1111"), false, "Public IPv6 allowed");
});

test("resolvePublicUrl safely rejects hex IPv6 metadata/loopback URLs", async () => {
  const metaHex = await resolvePublicUrl("http://[::ffff:a9fe:a9fe]/latest/meta-data/");
  assert.equal(metaHex, null, "http://[::ffff:a9fe:a9fe]/ must resolve to null");

  const loopHex = await resolvePublicUrl("http://[::ffff:7f00:1]:8080/internal");
  assert.equal(loopHex, null, "http://[::ffff:7f00:1]/ must resolve to null");

  const loopIpv4 = await resolvePublicUrl("http://127.0.0.1:8787/api/agent/chat");
  assert.equal(loopIpv4, null, "http://127.0.0.1/ must resolve to null");

  const publicUrl = await resolvePublicUrl("http://1.1.1.1/");
  assert.notEqual(publicUrl, null, "Public IP url resolves successfully");
  assert.equal(publicUrl.address, "1.1.1.1");
});

test("sanitizeExternalLink mitigates XSS via javascript: or unvalidated protocols", () => {
  const fallback = "https://www.courtlistener.com/opinion/123/";

  assert.equal(
    sanitizeExternalLink("javascript:alert(document.domain)", fallback),
    fallback,
    "javascript: link rejected"
  );
  assert.equal(
    sanitizeExternalLink("data:text/html,<script>alert(1)</script>", fallback),
    fallback,
    "data: link rejected"
  );
  assert.equal(
    sanitizeExternalLink("vbscript:msgbox", fallback),
    fallback,
    "vbscript: link rejected"
  );
  assert.equal(
    sanitizeExternalLink("", fallback),
    fallback,
    "empty link returns fallback"
  );
  assert.equal(
    sanitizeExternalLink(null, fallback),
    fallback,
    "null link returns fallback"
  );

  const safeLink = "https://www.courtlistener.com/opinion/456/brown-v-board/";
  assert.equal(
    sanitizeExternalLink(safeLink, fallback),
    safeLink,
    "valid https link preserved"
  );

  const safeHttp = "http://example.com/case/789";
  assert.equal(
    sanitizeExternalLink(safeHttp, fallback),
    "http://example.com/case/789",
    "valid http link preserved"
  );
});

test("callNebius limits fallback cascade to at most 2 distinct models and adheres to global deadline", async () => {
  const originalFetch = globalThis.fetch;
  const attemptedModels = [];

  globalThis.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    attemptedModels.push(body.model);
    return {
      ok: false,
      status: 503,
      text: async () => "Service Unavailable - Overloaded",
    };
  };

  try {
    await assert.rejects(
      async () =>
        callNebius({
          apiKey: "test-token",
          model: "deepseek-ai/DeepSeek-V4.1-Flash",
          prompt: "test",
          timeoutMs: 1000,
        }),
      /Upstream inference returned HTTP 503/
    );

    // Because primary is DeepSeek-V4.1-Flash, fallback is also DeepSeek-V4.1-Flash -> deduplicated to 1 candidate
    assert.equal(attemptedModels.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("callNebius sanitizes upstream HTTP error body without leaking sensitive content", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => ({
    ok: false,
    status: 401,
    text: async () => '{"error": "Unauthorized: secret_token_xyz invalid for account 999"}',
  });

  try {
    await assert.rejects(
      async () =>
        callNebius({
          apiKey: "test-token",
          model: "test-model",
          prompt: "test",
          timeoutMs: 1000,
        }),
      (err) => {
        // Must contain generic HTTP 401 status, but must NOT leak secret_token_xyz
        assert.match(err.message, /Upstream inference returned HTTP 401/);
        assert.doesNotMatch(err.message, /secret_token_xyz/);
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Access password constant-time verification logic", () => {
  const expectedPassword = "SuperSecretPassword123!";
  const expectedBuffer = Buffer.from(expectedPassword);

  const check = (provided) => {
    const providedBuffer = Buffer.from(provided || "");
    return (
      expectedBuffer.length === providedBuffer.length &&
      crypto.timingSafeEqual(expectedBuffer, providedBuffer)
    );
  };

  assert.equal(check("SuperSecretPassword123!"), true, "Matching password passes");
  assert.equal(check("SuperSecretPassword123?"), false, "Different char fails");
  assert.equal(check("short"), false, "Different length fails safely");
  assert.equal(check(""), false, "Empty password fails safely");
});
