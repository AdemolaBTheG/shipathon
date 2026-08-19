const MAX_URL_LENGTH = 2_048;

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return false;
  }

  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    parts[0] === 0
  );
}

export function parsePublicUrl(value: unknown) {
  if (typeof value !== "string" || value.length > MAX_URL_LENGTH) return null;

  try {
    const url = new URL(value.trim());
    const hostname = url.hostname.toLowerCase();
    const ipv6Hostname = hostname.replace(/^\[|\]$/g, "");
    const isPrivateIpv6 =
      ipv6Hostname.includes(":") &&
      (ipv6Hostname === "::1" ||
        ipv6Hostname.startsWith("fc") ||
        ipv6Hostname.startsWith("fd") ||
        ipv6Hostname.startsWith("fe80:"));
    const isLocal =
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      isPrivateIpv6 ||
      isPrivateIpv4(hostname);

    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      url.username ||
      url.password ||
      !hostname ||
      isLocal
    ) {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}
