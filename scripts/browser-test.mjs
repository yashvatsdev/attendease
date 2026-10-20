import { chromium, expect } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
const base = process.env.TEST_URL || "http://127.0.0.1:3000";
const suffix = Date.now().toString(36);
const roll = "UI" + suffix,
  code = "UI" + suffix,
  name = "Browser Demo Student";
let browser;
const errors = [];
let authCookies = [];
if (process.env.TEST_COOKIE_FILE) {
  const hostname = new URL(base).hostname;
  const lines = (await readFile(process.env.TEST_COOKIE_FILE, "utf8")).split(
    /\r?\n/,
  );
  authCookies = lines
    .filter(
      (line) =>
        line && (!line.startsWith("#") || line.startsWith("#HttpOnly_")),
    )
    .map((line) => {
      const httpOnly = line.startsWith("#HttpOnly_");
      const [domain, , path, secure, expires, name, value] = line
        .replace(/^#HttpOnly_/, "")
        .split("\t");
      return {
        domain,
        path,
        secure: secure === "TRUE",
        httpOnly,
        expires: Number(expires) || -1,
        name,
        value,
      };
    })
    .filter((cookie) => cookie.domain.replace(/^\./, "") === hostname);
  if (!authCookies.length)
    throw Error(
      "No authenticated test cookie matches the deployment hostname.",
    );
}
const authHeaders = authCookies.length
  ? { Cookie: authCookies.map((c) => `${c.name}=${c.value}`).join("; ") }
  : {};
async function cleanup() {
  for (const [resource, key, value] of [
    ["subjects", "code", code],
    ["students", "roll_no", roll],
  ]) {
    const r = await fetch(`${base}/api/${resource}`, { headers: authHeaders });
    if (r.ok) {
      for (const item of await r.json())
        if (item[key] === value)
          await fetch(`${base}/api/${resource}/${item.id}`, {
            method: "DELETE",
            headers: authHeaders,
          });
    }
  }
}
try {
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  if (authCookies.length) await page.context().addCookies(authCookies);
  page.on("pageerror", (e) => errors.push(e.message));
  await mkdir("docs/screenshots", { recursive: true });
  await page.goto(base + "/dashboard");
  await expect(page.getByText("Total students", { exact: true })).toBeVisible();
  await expect(page.getByText("15", { exact: true }).first()).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/dashboard.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Students", exact: true }).click();
  await page.getByRole("button", { name: "Add student", exact: true }).click();
  await page.getByLabel("Roll number", { exact: true }).fill(roll);
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email (optional)").fill(`${suffix}@example.com`);
  await page.getByRole("button", { name: "Save changes" }).click();
  await page
    .getByRole("textbox", { name: "Search by name or roll number" })
    .fill(roll);
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: `Edit ${name}`, exact: true }).click();
  await page.getByLabel("Full name").fill(name + " Updated");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByText(name + " Updated", { exact: true }),
  ).toBeVisible();
  console.log("PASS browser student add, search and edit");
  await page.getByRole("link", { name: "Subjects", exact: true }).click();
  await page.getByRole("button", { name: "Add subject", exact: true }).click();
  await page.getByLabel("Subject code", { exact: true }).fill(code);
  await page
    .getByLabel("Subject name", { exact: true })
    .fill("Browser Demo Subject");
  await page.getByRole("button", { name: "Save changes" }).click();
  const subjectRow = page.getByRole("row").filter({ hasText: code });
  await subjectRow.getByRole("button", { name: "View students" }).click();
  await page
    .getByRole("dialog")
    .getByRole("checkbox", { name: new RegExp(name) })
    .click();
  await expect(
    page.getByRole("dialog").getByRole("checkbox", { name: new RegExp(name) }),
  ).toBeChecked();
  await page.getByRole("button", { name: "Close dialog" }).click();
  console.log("PASS browser subject creation and enrollment");
  await page.getByRole("link", { name: "Attendance", exact: true }).click();
  await page
    .getByLabel(/^Subject/)
    .selectOption({ label: code + " · Browser Demo Subject" });
  await page.getByLabel("Session date").fill("2026-10-20");
  await page.getByRole("button", { name: "Load register" }).click();
  await expect(
    page.getByRole("heading", { name: "Class register" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Present", exact: true }).click();
  await page
    .getByRole("button", { name: "Save attendance", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Attendance saved successfully",
  );
  await page.getByRole("button", { name: "Absent", exact: true }).click();
  await page.getByRole("button", { name: "Save corrections" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Attendance saved successfully",
  );
  console.log("PASS browser attendance save and correction");
  await page.screenshot({
    path: "test-results/attendance.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Reports", exact: true }).click();
  await page
    .getByLabel(/^Student/)
    .selectOption({ label: roll + " · " + name + " Updated" });
  await page
    .getByLabel(/^Subject/)
    .selectOption({ label: code + " · Browser Demo Subject" });
  await expect(
    page.getByRole("table").getByText("0%", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "By student", exact: true }).click();
  await expect(
    page.getByRole("columnheader", { name: "Subject", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "By subject", exact: true }).click();
  await expect(
    page.getByRole("columnheader", { name: "Student", exact: true }),
  ).toHaveCount(0);
  console.log("PASS browser report filters, percentage and grouped reports");
  await page.getByRole("link", { name: "Students", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Search by name or roll number" })
    .fill(roll);
  await page
    .getByRole("button", { name: `Delete ${name} Updated`, exact: true })
    .click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByText(name + " Updated", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: `Delete ${name} Updated`, exact: true })
    .click();
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page.getByText("No matching records.")).toBeVisible();
  await page.getByRole("link", { name: "Subjects", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete Browser Demo Subject", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(
    page.getByText("Browser Demo Subject", { exact: true }),
  ).toHaveCount(0);
  console.log("PASS browser confirmation cancel and cascading deletion");
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      "dashboard",
      "students",
      "subjects",
      "attendance",
      "reports",
    ]) {
      await page.goto(`${base}/${route}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.waitForLoadState("networkidle");
      if (
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        )
      )
        throw Error(`Page overflow at ${width}px on ${route}`);
    }
    if (width === 390) {
      await page.goto(base + "/dashboard");
      await page.waitForLoadState("networkidle");
      await page.screenshot({
        path: "docs/screenshots/mobile.png",
        fullPage: true,
      });
    }
  }
  expect(errors).toEqual([]);
  console.log(
    "PASS all five pages at phone, tablet and desktop widths; no page errors or page overflow",
  );
  console.log("ALL BROWSER WORKFLOWS PASSED");
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await cleanup();
}
