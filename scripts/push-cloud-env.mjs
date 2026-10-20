import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";

// Values travel only through stdin, never command arguments or console output.
const keys = [
  "DB_HOST",
  "DB_PORT",
  "DB_USER",
  "DB_PASSWORD",
  "DB_NAME",
  "DB_SSL",
  "DB_SSL_CA",
];
try {
  const config = JSON.parse(await readFile(".secrets/cloud-db.json", "utf8"));
  if (keys.some((key) => typeof config[key] !== "string" || !config[key]))
    throw Error(
      "Cloud configuration is incomplete. Run npm.cmd run db:cloud:configure.",
    );
  if (
    config.DB_NAME !== "attendease" ||
    config.DB_SSL !== "true" ||
    ["localhost", "127.0.0.1", "::1"].includes(config.DB_HOST)
  )
    throw Error("Hosted MySQL with TLS is required.");
  for (const key of keys) {
    await new Promise((resolve, reject) => {
      const args = [
        "--scope",
        "techtroop",
        "env",
        "add",
        key,
        "production",
        "--project",
        "attendease",
        "--type",
        "secret",
        "--yes",
      ];
      const child =
        process.platform === "win32"
          ? spawn(
              process.env.ComSpec || "cmd.exe",
              ["/d", "/s", "/c", "vercel.cmd " + args.join(" ")],
              { stdio: ["pipe", "pipe", "pipe"], windowsHide: true },
            )
          : spawn("vercel", args, { stdio: ["pipe", "pipe", "pipe"] });
      // Capture no CLI output, so a provider/CLI error cannot echo a secret.
      child.stdout.resume();
      child.stderr.resume();
      child.on("error", () =>
        reject(Error(`Could not start Vercel CLI for ${key}.`)),
      );
      child.stdin.on("error", () => {});
      child.on("close", (code) =>
        code === 0
          ? resolve()
          : reject(
              Error(
                `Vercel could not add ${key}. Check CLI login, project permissions or an existing variable. Values were not logged.`,
              ),
            ),
      );
      child.stdin.end(config[key]);
    });
    console.log(`Added ${key} as a production Secret (value hidden).`);
  }
} catch (error) {
  console.error(
    error.code === "ENOENT"
      ? "Cloud credentials are missing. Run npm.cmd run db:cloud:configure privately."
      : error.message,
  );
  process.exitCode = 1;
}
