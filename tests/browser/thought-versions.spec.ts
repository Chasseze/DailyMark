import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";

const config = JSON.parse(readFileSync("work/local-status.json", "utf8"));
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(config.API_URL))
  throw new Error("Thought tests require an isolated local backend");
const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY);
const userClient = createClient(config.API_URL, config.ANON_KEY);
function sql(query: string) {
  execFileSync("docker", [
    "exec",
    "supabase_db_workspace",
    "psql",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    query,
  ]);
}
const email = `thought-browser-${Date.now()}@example.test`;
const password = "ThoughtTest!2026";
const thoughtId = randomUUID();
let userId: string;
const originalBody =
  "A saved idea worth returning to.\n\n## Try this\n\nReflect before you react.";
async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/desk$/);
}
async function saveThought(id: string) {
  const found = await userClient.from("thought_bookmarks").select("thought_id").eq("thought_id", id).maybeSingle();
  if (found.error) throw found.error;
  if (!found.data) {
    const result = await userClient.from("thought_bookmarks").insert({ user_id: userId, thought_id: id });
    if (result.error) throw result.error;
  }
}
test.beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  userId = data.user.id;
  sql(
    `insert into public.thoughts(id,title,content,author,source_name,source_url,collection) values('${thoughtId}','Room for reflection','${originalBody}','Source Author','Source Publication','https://example.com/source','Reflection')`,
  );
  const session = await userClient.auth.signInWithPassword({ email, password });
  if (session.error) throw session.error;
});
test.afterAll(async () => {
  if (userId) await admin.auth.admin.deleteUser(userId);
  await userClient.auth.signOut();
  sql(`delete from public.thoughts where id='${thoughtId}'`);
});

test("saved sources survive adaptation, sharing, export, unsave and mobile reading", async ({
  page,
  browser,
}) => {
  await signIn(page);
  await page.goto(`/thoughts/${thoughtId}`);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Room for reflection",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save thought", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Saved source", exact: true }),
  ).toBeVisible();
  sql(
    `update public.thoughts set content='A later catalog revision' where id='${thoughtId}'`,
  );
  await page.reload();
  await expect(
    page.getByText("A saved idea worth returning to.", { exact: true }),
  ).toBeVisible();
  const concurrent = await Promise.all([
    userClient.rpc("create_thought_version", { p_thought_id: thoughtId }),
    userClient.rpc("create_thought_version", { p_thought_id: thoughtId }),
  ]);
  for (const result of concurrent) expect(result.error).toBeNull();
  expect(concurrent[0].data).toBe(concurrent[1].data);
  await page
    .getByRole("button", { name: "Create my version", exact: true })
    .click();
  await expect(page).toHaveURL(/\/notes\/[^/]+\/edit$/);
  const noteId = page.url().split("/").at(-2)!;
  expect(noteId).toBe(concurrent[0].data);
  await expect(
    page.getByText("Personal copy · Unedited", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Note content in Markdown")).toHaveValue(
    originalBody,
  );
  await page
    .getByLabel("Note title", { exact: true })
    .fill("My evolving interpretation");
  await page
    .getByLabel("Note content in Markdown")
    .fill(
      "My own experience adds another perspective.\n\n## My reflections\n\nPause, then choose a response.",
    );
  await expect(
    page.getByText("Personal adaptation · Edited by you", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Back to saved thought/ }).click();
  await expect(page.getByText("You have unsaved changes.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Keep editing", exact: true }).click();
  await expect(page.getByText("You have unsaved changes.", { exact: true })).toHaveCount(0);
  await expect(page).toHaveURL(/\/edit$/);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/notes/${noteId}$`));
  await expect(
    page.getByText("Source credit:", { exact: false }),
  ).toContainText("Source Author · Source Publication");
  await page.getByText("Compare with saved source", { exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Preserved source text" }).getByText("A saved idea worth returning to.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Highlighted changes" }).locator("ins").filter({ hasText: "My own experience" })).toBeVisible();
  const downloadEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export Markdown", exact: true })
    .click();
  const download = await downloadEvent;
  const markdown = readFileSync((await download.path())!, "utf8");
  for (const text of [
    "Personal adaptation",
    "Source Author · Source Publication",
    "https://example.com/source",
    "A saved idea worth returning to.",
    "My own experience",
  ])
    expect(markdown).toContain(text);
  const shareCreated = page.waitForResponse(
    (response) =>
      response.url().includes("/rest/v1/share_tokens") &&
      response.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Copy share link", exact: true })
    .click();
  await shareCreated;
  const shares = await admin
    .from("share_tokens")
    .select("token")
    .eq("note_id", noteId)
    .single();
  if (shares.error) throw shares.error;
  const guest = await browser.newContext();
  const sharedPage = await guest.newPage();
  await sharedPage.goto(`/s/${shares.data.token}`);
  await expect(
    sharedPage.getByText("Personal adaptation · Edited by the note author", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    sharedPage.getByText("Source credit:", { exact: false }),
  ).toContainText("Source Author · Source Publication");
  await guest.close();
  await page.getByRole("link", { name: /Back to saved thought/ }).click();
  await expect(page).toHaveURL(new RegExp(`/thoughts/${thoughtId}$`));
  await page.getByRole("button", { name: "My version", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "My evolving interpretation" }),
  ).toBeVisible();
  await page.screenshot({
    path: "work/thought-version-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", { name: "My evolving interpretation" }),
  ).toBeVisible();
  await page.getByText("Compare with saved source", { exact: true }).click();
  await expect(page.getByRole("region", { name: "Highlighted changes" })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "work/thought-version-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Remove from saved", exact: true })
    .click();
  await page.goto(`/notes/${noteId}`);
  await expect(
    page.getByText("Personal adaptation · Edited by you", { exact: true }),
  ).toBeVisible();
  const savedSource = await userClient
    .from("thought_sources")
    .select("snapshot")
    .eq("note_id", noteId)
    .single();
  expect(savedSource.data?.snapshot.content).toBe(originalBody);
});

test("cold source failures remain visible and Retry recovers on mobile", async ({ page }) => {
  await saveThought(thoughtId);
  const version = await userClient.rpc("create_thought_version", { p_thought_id: thoughtId });
  if (version.error) throw version.error;
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  const failSource = async (route: import("@playwright/test").Route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Source request temporarily unavailable" }) });
  await page.route("**/rest/v1/thought_sources*", failSource);
  await page.goto(`/thoughts/${thoughtId}`);
  await expect(page.getByRole("alert").filter({ hasText: "Source request temporarily unavailable" }).last()).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("button", { name: "Save thought", exact: true })).toBeDisabled();
  await page.unroute("**/rest/v1/thought_sources*", failSource);
  await page.getByRole("button", { name: "Retry", exact: true }).last().click();
  await expect(page.getByRole("button", { name: "Remove from saved", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "My version", exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("a failed refresh preserves previously loaded saved thoughts", async ({ page }) => {
  const secondId = randomUUID();
  sql(`insert into public.thoughts(id,title,content) values('${secondId}','Retry fixture','Another saved idea')`);
  try {
    await saveThought(thoughtId);
    await signIn(page);
    await page.goto("/thoughts");
    await expect(page.getByRole("link", { name: /Retry fixture/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Saved ·/ })).toBeVisible();
    await page.getByRole("link", { name: /Retry fixture/ }).click();
    // The detail route is lazy: wait for its committed provider to load before
    // injecting a refresh failure (rather than failing its initial load).
    await expect(page.getByRole("heading", { name: "Retry fixture", exact: true, level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Saved ·/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save thought", exact: true })).toBeEnabled();
    await page.route("**/rest/v1/thought_sources*", route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Source refresh failed" }) }));
    await page.getByRole("button", { name: "Save thought", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Source refresh failed" }).first()).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: /^Saved ·/ }).click();
    await expect(page.getByRole("link", { name: /Room for reflection/ })).toBeVisible();
    await expect(page.getByText("Nothing saved yet", { exact: true })).toHaveCount(0);
    await page.unroute("**/rest/v1/thought_sources*");
    await page.getByRole("button", { name: "Retry", exact: true }).first().click();
    await expect(page.getByRole("alert")).toHaveCount(0);
  } finally {
    await userClient.from("thought_bookmarks").delete().eq("thought_id", secondId);
    sql(`delete from public.thoughts where id='${secondId}'`);
  }
});

test("catalog removal leaves a saved thought readable and editable", async ({ page }) => {
  const removedId = randomUUID();
  sql(`insert into public.thoughts(id,title,content) values('${removedId}','Removed catalog thought','A source that must stay available')`);
  await saveThought(removedId);
  sql(`delete from public.thoughts where id='${removedId}'`);
  await signIn(page);
  await page.goto("/thoughts");
  await page.getByRole("button", { name: /^Saved ·/ }).click();
  await page.getByRole("link", { name: /Removed catalog thought/ }).click();
  await expect(page.getByRole("heading", { name: "Removed catalog thought", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Create my version", exact: true }).click();
  await expect(page.getByLabel("Note content in Markdown")).toHaveValue("A source that must stay available");
  await expect(page.getByRole("link", { name: /Back to saved thought/ })).toBeVisible();
});

test("the snapshot export remains valid during concurrent personal-version creation", async () => {
  const concurrentId = randomUUID();
  sql(`insert into public.thoughts(id,title,content) values('${concurrentId}','Concurrent export source','Consistent original')`);
  try {
    const [exported, created] = await Promise.all([
      userClient.rpc("export_backup", {}),
      userClient.rpc("create_thought_version", { p_thought_id: concurrentId }),
    ]);
    if (exported.error) throw exported.error;
    if (created.error) throw created.error;
    const payload = exported.data as { notes: { id: string }[]; thoughtSources: { note_id: string | null }[] };
    const ids = new Set(payload.notes.map(n => n.id));
    for (const source of payload.thoughtSources) if (source.note_id) expect(ids.has(source.note_id)).toBe(true);
  } finally {
    sql(`delete from public.thoughts where id='${concurrentId}'`);
  }
});
