import { spawn } from "node:child_process";

export class ProcessError extends Error {
  constructor(message, { exitCode = null, stderr = "" } = {}) {
    super(message);
    this.name = "ProcessError";
    this.exitCode = exitCode;
    this.stderr = stderr;
  }
}

export function runProcess(
  command,
  args,
  { cwd, timeoutMs = 45_000, maxOutputBytes = 5 * 1024 * 1024 } = {},
) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      detached: true,
      env: { ...process.env, LANG: "C.UTF-8" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];
    let outputBytes = 0;
    let settled = false;
    let timeout;

    const terminate = () => {
      if (!child.pid) return;
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {
        child.kill("SIGKILL");
      }
    };

    const finish = (callback) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      callback();
    };

    const collect = (target) => (chunk) => {
      outputBytes += chunk.length;
      if (outputBytes > maxOutputBytes) {
        terminate();
        finish(() => reject(new ProcessError("Process output exceeded limit")));
        return;
      }
      target.push(chunk);
    };

    child.stdout.on("data", collect(stdout));
    child.stderr.on("data", collect(stderr));
    child.on("error", (error) =>
      finish(() => reject(new ProcessError(error.message))),
    );
    child.on("close", (exitCode) => {
      const stdoutText = Buffer.concat(stdout).toString("utf8").trim();
      const stderrText = Buffer.concat(stderr).toString("utf8").trim();
      if (exitCode === 0) {
        finish(() => resolve({ stdout: stdoutText, stderr: stderrText }));
        return;
      }
      finish(() =>
        reject(
          new ProcessError(
            stderrText
              ? `Process exited unsuccessfully: ${stderrText.slice(-500)}`
              : "Process exited unsuccessfully",
            {
            exitCode,
            stderr: stderrText.slice(-2_000),
            },
          ),
        ),
      );
    });

    timeout = setTimeout(() => {
      terminate();
      finish(() => reject(new ProcessError("Process timed out")));
    }, timeoutMs);
  });
}
