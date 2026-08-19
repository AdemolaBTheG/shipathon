import dns from "node:dns/promises";
import net from "node:net";

const MAX_URL_LENGTH = 2_048;

const SOCIAL_HOSTS = Object.freeze({
  instagram: ["instagram.com"],
  tiktok: ["tiktok.com"],
});

function matchesDomain(hostname, domain) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function isPrivateIpv4(address) {
  const parts = address.split(".").map(Number);
  return (
    parts.length === 4 &&
    (parts[0] === 0 ||
      parts[0] === 10 ||
      parts[0] === 127 ||
      (parts[0] === 169 && parts[1] === 254) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      parts[0] >= 224)
  );
}

function isPrivateIpv6(address) {
  const normalized = address.toLowerCase();
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  );
}

function isPrivateAddress(address) {
  const family = net.isIP(address);
  return family === 4
    ? isPrivateIpv4(address)
    : family === 6
      ? isPrivateIpv6(address)
      : true;
}

export function socialPlatform(url) {
  const hostname = url.hostname.toLowerCase();
  return (
    Object.entries(SOCIAL_HOSTS).find(([, domains]) =>
      domains.some((domain) => matchesDomain(hostname, domain)),
    )?.[0] ?? null
  );
}

export async function parseSocialUrl(value) {
  if (typeof value !== "string" || value.length > MAX_URL_LENGTH) return null;

  try {
    const url = new URL(value.trim());
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      !socialPlatform(url)
    ) {
      return null;
    }

    const addresses = await dns.lookup(url.hostname, { all: true });
    if (
      addresses.length === 0 ||
      addresses.some(({ address }) => isPrivateAddress(address))
    ) {
      return null;
    }

    url.hash = "";
    return url;
  } catch {
    return null;
  }
}
