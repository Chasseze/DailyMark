import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
const config = JSON.parse(readFileSync("work/local-status.json", "utf8"));
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(config.API_URL))
  throw new Error("Browser tests require an isolated local backend");
const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY);
const email = `browser-${Date.now()}@example.test`;
const password = "BrowserTest!2026";
let userId: string;
test.beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  userId = data.user.id;
});
test.afterAll(async () => {
  if (userId) await admin.auth.admin.deleteUser(userId);
});
test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/desk$/);
  await page.getByRole("link", { name: "Notes", exact: true }).first().click();
  await page
    .getByLabel("New from template")
    .selectOption({ label: "Meeting notes" });
  await expect(page.getByLabel("Note title", { exact: true })).toBeVisible();
});
test("navigation blocks unsaved writing and Save continues", async ({
  page,
}) => {
  await page
    .getByLabel("Note title", { exact: true })
    .fill("Unsaved navigation test");
  await page
    .getByRole("link", { name: "Settings", exact: true })
    .first()
    .click();
  await expect(page.getByText("You have unsaved changes.")).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).last().click();
  await expect(page).toHaveURL(/\/settings$/);
  const { data } = await admin
    .from("notes")
    .select("title")
    .eq("user_id", userId)
    .eq("title", "Unsaved navigation test");
  expect(data).toHaveLength(1);
});
test("a rejected save preserves the editor and prevents navigation", async ({
  page,
}) => {
  await page.route("**/rest/v1/notes?*", async (route) => {
    if (route.request().method() === "PATCH")
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: "Test network failure" }),
      });
    else await route.continue();
  });
  await page
    .getByLabel("Note content in Markdown")
    .fill("Writing that must survive a failed request");
  await page
    .getByRole("link", { name: "Settings", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Save", exact: true }).last().click();
  await expect(page.getByRole("alert")).toContainText("Test network failure");
  await expect(page.getByLabel("Note content in Markdown")).toHaveValue(
    "Writing that must survive a failed request",
  );
  await expect(page).toHaveURL(/\/edit$/);
});
test("a stale client cannot overwrite another device", async ({ page }) => {
  const id = page.url().split("/").at(-2)!;
  const { error } = await admin
    .from("notes")
    .update({ content: "Newer device content" })
    .eq("id", id);
  if (error) throw error;
  await page.getByLabel("Note content in Markdown").fill("Older device edit");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "changed on another device",
  );
  const { data } = await admin
    .from("notes")
    .select("content")
    .eq("id", id)
    .single();
  expect(data?.content).toBe("Newer device content");
});
