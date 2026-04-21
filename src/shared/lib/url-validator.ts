export function isValidUrl(urlString: string | null | undefined) {
  if (!urlString || typeof urlString !== "string") {
    return false;
  }

  try {
    const url = new URL(urlString);
    return (url.protocol === "http:" || url.protocol === "https:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export function sanitizeUrl(urlString: string | null | undefined) {
  if (!isValidUrl(urlString)) {
    return null;
  }

  try {
    return new URL((urlString ?? "").trim()).href;
  } catch {
    return null;
  }
}
