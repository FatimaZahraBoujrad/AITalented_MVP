import dns from "node:dns/promises";
import net from "node:net";
import type { VerificationOutcome } from "./types";

/**
 * Deployment verifier (§9.2): HTTP 200 within 10s, valid TLS, GET probe.
 * Does NOT call model inference endpoints.
 *
 * SSRF hardening (§9.4, risk table): only http/https, credentials stripped, private /
 * loopback / link-local / unique-local addresses rejected after DNS resolution, and each
 * redirect hop is re-validated. Common non-web ports are refused.
 */

const BLOCKED_PORTS = new Set([22, 25, 3306, 5432, 6379, 11211, 9200, 27017]);
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 10_000;

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local + cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true;
    return false;
  }
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fe80")) return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  if (lower.startsWith("::ffff:")) return isPrivateIp(lower.replace("::ffff:", ""));
  return false;
}

async function assertSafeUrl(url: URL): Promise<string | null> {
  if (url.protocol !== "https:" && url.protocol !== "http:") return "Only http(s) URLs can be verified";
  if (url.username || url.password) return "URL must not contain credentials";
  if (url.port && BLOCKED_PORTS.has(Number(url.port))) return "URL points to a blocked port";

  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(hostname)) {
    return isPrivateIp(hostname) ? "URL resolves to a private or reserved address" : null;
  }
  if (hostname === "localhost" || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    return "URL resolves to a private or reserved address";
  }

  let addresses: { address: string }[] = [];
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch {
    return "DNS lookup failed";
  }
  if (addresses.length === 0) return "DNS lookup returned no address";
  if (addresses.some((a) => isPrivateIp(a.address))) {
    return "URL resolves to a private or reserved address";
  }
  return null;
}

export async function verifyDeploymentUrl(
  deploymentUrl: string | null | undefined,
): Promise<VerificationOutcome> {
  if (!deploymentUrl?.trim()) return { ok: false, reason: "No deployment URL provided", retryable: false };

  let current: URL;
  try {
    current = new URL(deploymentUrl.trim());
  } catch {
    return { ok: false, reason: "Malformed deployment URL", retryable: false };
  }

  const started = Date.now();
  let lastUrl = current;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const unsafe = await assertSafeUrl(current);
    if (unsafe) return { ok: false, reason: unsafe, retryable: false };

    let response: Response;
    try {
      response = await fetch(current.toString(), {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "User-Agent": "aitalented-deploy-verifier" },
        cache: "no-store",
      });
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      const reason =
        name === "TimeoutError"
          ? `Deployment timed out after ${TIMEOUT_MS / 1000}s`
          : `Deployment unreachable (${error instanceof Error ? error.message : "network error"})`;
      return { ok: false, reason, retryable: true };
    }

    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      if (hop === MAX_REDIRECTS) {
        return { ok: false, reason: "Too many redirects", retryable: false };
      }
      try {
        current = new URL(location, current);
      } catch {
        return { ok: false, reason: "Redirected to a malformed URL", retryable: false };
      }
      lastUrl = current;
      continue;
    }

    const latencyMs = Date.now() - started;
    const evidence = {
      status: response.status,
      latencyMs,
      finalUrl: lastUrl.toString(),
      server: response.headers.get("server") ?? undefined,
      contentType: response.headers.get("content-type") ?? undefined,
    };

    if (response.status >= 200 && response.status < 300) {
      return { ok: true, evidence };
    }
    if (response.status >= 500) {
      return { ok: false, reason: `Deployment returned ${response.status}`, retryable: true };
    }
    return { ok: false, reason: `Deployment returned ${response.status}`, retryable: false };
  }

  return { ok: false, reason: "Deployment check failed", retryable: false };
}
