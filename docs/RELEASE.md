# Reliability, security and usability release

This branch requires the frontend and database changes together. It has not been applied to hosted Supabase or the production Vercel deployment.

## Deployment order

1. Back up the hosted database using the normal Supabase backup workflow.
2. Deploy `shared-image` to Supabase Edge Functions with JWT verification disabled as declared in config. It authenticates each request using the active share token and validates the image owner, authorized note content, and exact storage path. `SUPABASE_SERVICE_ROLE_KEY` remains server-side. Set `PUBLIC_SUPABASE_URL` only if the internal Supabase URL differs from the public URL stored in notes.
3. Apply migrations 0016–0021. They enforce ownership of share targets/notebooks, make `note-images` private, add owner-only version history, atomic backup restore, server-filtered library pages, atomic preferences, and push subscriptions. The local development seed preserves function revocations.
4. Deploy the frontend. The attachment renderer recognizes old public URLs and obtains short-lived authenticated URLs. Existing cached public attachment responses may remain readable until their previous cache lifetime expires; changing bucket policy cannot recall already downloaded bytes. Coordinate the bucket change and frontend deployment to minimize temporary attachment failures for old clients.
5. Confirm hosted Auth password policy is at least 12 characters for new passwords. Existing users can still sign in with their current passwords. Confirm email confirmation, allowed redirect origins, and authentication rate limits in hosted configuration; the checked-in local settings do not update the hosted dashboard automatically.
6. Verify sign-in, a note save, conflict handling in two tabs, an attachment, a public share, revocation, and backup restoration using a disposable account.

Vercel headers restrict script sources, framing, referrers and browser capabilities. If using a custom Supabase hostname, add its exact HTTPS/WSS origins to `connect-src` before deploying. No service-role key belongs in Vite environment variables.

## Optional background reminders

Generate a VAPID key pair with a trusted Web Push tool. Configure these **Edge Function secrets**:

- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` (a `mailto:` contact URL)
- `REMINDER_CRON_SECRET` (a long random secret)

Set `VITE_VAPID_PUBLIC_KEY` to the public key for the frontend build. Deploy `send-reminders` with JWT verification disabled; it requires its own scheduler secret. Configure a trusted scheduler to POST to `/functions/v1/send-reminders` every minute with `Authorization: Bearer <REMINDER_CRON_SECRET>`. Store that secret in the scheduler's secret store, never source control or a URL.

Users explicitly enable a subscription on each browser. The sender uses the device's enrolled timezone and account reminder time, reserves one delivery per device/day, and removes expired subscriptions. Failed sends remain reserved for that day to avoid repeated sends. Re-enable on a browser after changing its timezone. Timing and delivery are best effort and depend on the browser/OS. Without push configuration the app shows an unavailable state and still supports open-tab reminders.

Push endpoints are constrained to supported browser push providers and checked again before the server makes an outbound request. Revocation/deletion of a subscription prevents future deliveries; signing out unsubscribes the local browser.

## Behavior and limits

- Notes save one request at a time per note. Writes compare the server timestamp; stale writes fail without overwriting newer content.
- Route changes with unsaved writing require Save, Discard, or Keep editing. Autosave pauses while the choice is open.
- Version history retains up to 50 previous content/title/tag/notebook edits. Restoring creates a new version. It is not a replacement for database backups.
- Optional device recovery stores title/body only, per account/note, and requires explicit review and Save. It is not an offline synchronization queue. Copies are cleared on sign-out.
- JSON backups include notes, Trash, notebooks and metadata. Restore creates fresh IDs in one transaction and never replaces existing notes. Attachments remain linked to the originating account; the JSON does not contain image bytes. Markdown single-note export remains available.
- Library results use server filters, exact counts and pages of 50. The account context still loads compact metadata in bounded pages for desk/return/wiki-link features; it does not fetch full note bodies until needed. Very large-account metadata streaming is a further optimization, not silent truncation.
- Bulk actions run per note with conflict checks. A failure stops the batch and is shown; already completed actions remain completed.
- Performance diagnostics retain at most 200 event names, durations and timestamps in memory. They contain no note content and are not sent to a telemetry service.

## Verification

`npm test`, `npm run lint`, `npm run build`, `npm audit`.

With an isolated Supabase stack: `docker exec -i supabase_db_<project-id> psql -U postgres -d postgres < tests/security.sql`. These checks run in a rolled-back transaction and test cross-account access, foreign share targets, foreign notebook references, stale writes, history and atomic restore.

`npm run test:browser` uses a local Supabase status JSON in `work/local-status.json` and creates a disposable test account. It covers blocked navigation, failed saves and multi-device conflicts. CI provisions the local stack and browser.

`scripts/check-shared-images.mjs` tests private image access, valid share signing, unrelated/foreign path rejection, revoked tokens and scheduler authorization. Run against an isolated local stack with functions served and `PUBLIC_SUPABASE_URL` set to its public local API URL.
