import { readFile } from "node:fs/promises";

try {
  const config = JSON.parse(await readFile(".secrets/cloud-db.json", "utf8"));
  for (const key of [
    "DB_HOST",
    "DB_PORT",
    "DB_USER",
    "DB_PASSWORD",
    "DB_NAME",
    "DB_SSL",
    "DB_SSL_CA",
  ]) {
    if (typeof config[key] !== "string" || !config[key])
      throw Error(
        "Cloud configuration is incomplete. Run npm.cmd run db:cloud:configure.",
      );
    process.env[key] = config[key];
  }
  if (
    config.DB_NAME !== "attendease" ||
    config.DB_SSL !== "true" ||
    ["localhost", "127.0.0.1", "::1"].includes(config.DB_HOST)
  )
    throw Error("A hosted attendease database with verified TLS is required.");
  // Avoid loading the local database credentials when operating on the cloud.
  process.env.DB_ENV_FILE = ".secrets/no-dotenv-file";
  await import("./database.mjs");
} catch (error) {
  console.error(
    error.code === "ENOENT"
      ? "Cloud credentials are missing. Run npm.cmd run db:cloud:configure privately."
      : error.message,
  );
  process.exitCode = 1;
}
