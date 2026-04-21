import { useCallback, useEffect, useState } from "react";

import { checkForUpdates, loadVersionInfo, type UpdateStatus, type VersionInfo } from "@/shared/lib/version-checker";

export function useVersionCheck() {
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void loadVersionInfo().then((nextInfo) => {
      if (!cancelled) {
        setVersionInfo(nextInfo);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const runCheck = useCallback(async () => {
    setChecking(true);
    try {
      const status = await checkForUpdates();
      setUpdateStatus(status);
      return status;
    } finally {
      setChecking(false);
    }
  }, []);

  return {
    checking,
    runCheck,
    updateStatus,
    versionInfo,
  };
}
