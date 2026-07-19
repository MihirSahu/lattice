import type { ChildProcess } from "node:child_process";

type TerminationOptions = {
  processGroup?: boolean;
};

function isMissingProcessError(error: unknown) {
  return error instanceof Error && "code" in error && error.code === "ESRCH";
}

export function terminateProcessWithGrace(
  child: ChildProcess,
  graceMs: number,
  onForceKill?: () => void,
  options: TerminationOptions = {}
) {
  const processGroup = options.processGroup && process.platform !== "win32" && child.pid
    ? child.pid
    : null;
  const isRunning = () => {
    if (!processGroup) {
      return child.exitCode === null && child.signalCode === null;
    }

    try {
      process.kill(-processGroup, 0);
      return true;
    } catch (error) {
      return !isMissingProcessError(error);
    }
  };
  const kill = (signal: NodeJS.Signals) => {
    if (!processGroup) {
      return child.kill(signal);
    }

    try {
      process.kill(-processGroup, signal);
      return true;
    } catch (error) {
      if (isMissingProcessError(error)) {
        return false;
      }

      return child.kill(signal);
    }
  };

  if (!isRunning()) {
    return null;
  }

  kill("SIGTERM");

  let cleared = false;
  const clear = () => {
    if (cleared) {
      return;
    }

    cleared = true;
    clearTimeout(forceKillTimer);

    if (!processGroup) {
      child.off("close", clear);
    }
  };
  const forceKillTimer = setTimeout(() => {
    clear();

    if (!isRunning()) {
      return;
    }

    onForceKill?.();
    kill("SIGKILL");
  }, Math.max(0, graceMs));

  forceKillTimer.unref();

  if (!processGroup) {
    child.once("close", clear);
  }

  return clear;
}
