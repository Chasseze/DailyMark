import { test, expect } from "@playwright/test";
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
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/desk$/);
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
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/notes/${noteId}$`));
  await expect(
    page.getByText("Source credit:", { exact: false }),
  ).toContainText("Source Author · Source Publication");
  await page.getByText("Compare with saved source", { exact: true }).click();
  await expect(
    page.getByText("A saved idea worth returning to.", { exact: true }),
  ).toBeVisible();
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
  await page.goto(`/thoughts/${thoughtId}`);
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
