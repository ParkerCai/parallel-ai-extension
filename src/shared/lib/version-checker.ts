export interface VersionInfo {
  buildDate?: string;
  commitHash?: string;
  manifestVersion: string;
  metadataVersion?: string;
}

export interface UpdateStatus {
  currentVersion: string;
  error: string | null;
  latestVersion?: string;
  updateAvailable: boolean;
}

function getRuntimeUrl(path: string) {
  if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
    return chrome.runtime.getURL(path);
  }

  return `/${path}`;
}

export function compareVersions(current: string, latest: string) {
  const currentParts = current.split(".").map(Number);
  const latestParts = latest.split(".").map(Number);
  const maxLength = Math.max(currentParts.length, latestParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const currentPart = currentParts[index] || 0;
    const latestPart = latestParts[index] || 0;

    if (currentPart < latestPart) {
      return -1;
    }

    if (currentPart > latestPart) {
      return 1;
    }
  }

  return 0;
}

export async function loadVersionInfo(): Promise<VersionInfo | null> {
  try {
    const manifest = chrome.runtime.getManifest();
    let metadataVersion: string | undefined;
    let buildDate: string | undefined;
    let commitHash: string | undefined;

    try {
      const response = await fetch(getRuntimeUrl("data/version-info.json"));
      if (response.ok) {
        const payload = (await response.json()) as {
          buildDate?: string;
          commitHash?: string;
          version?: string;
        };

        metadataVersion = payload.version;
        buildDate = payload.buildDate;
        commitHash = payload.commitHash;
      }
    } catch {
      // metadata is optional
    }

    return {
      buildDate,
      commitHash,
      manifestVersion: manifest.version,
      metadataVersion,
    };
  } catch {
    return null;
  }
}

export async function checkForUpdates(): Promise<UpdateStatus> {
  const versionInfo = await loadVersionInfo();
  if (!versionInfo) {
    return {
      currentVersion: "unknown",
      error: "Unable to load version information.",
      updateAvailable: false,
    };
  }

  const latestVersion = versionInfo.metadataVersion;
  const updateAvailable =
    typeof latestVersion === "string"
      ? compareVersions(versionInfo.manifestVersion, latestVersion) < 0
      : false;

  return {
    currentVersion: versionInfo.manifestVersion,
    error: null,
    latestVersion,
    updateAvailable,
  };
}
