// Runs before every `vite build`. Two jobs:
//   1. Kill any background `node ./node_modules/vite/bin/vite.js ...` processes.
//      These get orphaned by Claude Code sessions and re-clobber dist/ in dev
//      mode the moment we touch a file, breaking the next build.
//   2. Remove dist/ so leftover dev artifacts (dist/vendor/, dist/src/, etc.)
//      from a previous dev run can't survive into the new build.
//
// Cross-platform: uses tasklist/wmic on Windows, `ps` on POSIX.

import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { platform } from "node:os";

function killRogueVite() {
  const isWin = platform() === "win32";
  let killed = 0;

  try {
    if (isWin) {
      // wmic deprecated but still around; CIM is the modern path
      const cmd =
        'powershell -NoProfile -Command "' +
        "Get-CimInstance Win32_Process -Filter \\\"Name='node.exe'\\\" | " +
        "Where-Object { $_.CommandLine -match 'vite' } | " +
        "ForEach-Object { Stop-Process -Id $_.ProcessId -Force; $_.ProcessId }" +
        '"';
      const out = execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
      killed = out.split(/\s+/).filter(Boolean).length;
    } else {
      // pgrep returns non-zero when nothing matches; tolerate that
      const out = execSync("pgrep -f 'node.*vite' || true", { encoding: "utf8" });
      const pids = out.split(/\s+/).filter(Boolean);
      for (const pid of pids) {
        try {
          process.kill(Number(pid), "SIGTERM");
          killed++;
        } catch {}
      }
    }
  } catch {
    // best-effort; never block the build
  }

  if (killed > 0) {
    console.log(`prebuild: killed ${killed} rogue vite process(es)`);
  }
}

killRogueVite();
rmSync("dist", { recursive: true, force: true });
