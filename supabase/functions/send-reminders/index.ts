import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { timingSafeEqual } from "node:crypto";
Deno.serve(async (request) => {
  const secret = Deno.env.get("REMINDER_CRON_SECRET");
  const bearer =
    request.headers.get("Authorization")?.replace(/^Bearer /, "") ?? "";
  if (
    !secret ||
    bearer.length !== secret.length ||
    !timingSafeEqual(
      new TextEncoder().encode(bearer),
      new TextEncoder().encode(secret),
    )
  )
    return new Response("Unauthorized", { status: 401 });
  if (request.method !== "POST")
    return new Response("Method not allowed", { status: 405 });
  const pub = Deno.env.get("VAPID_PUBLIC_KEY"),
    priv = Deno.env.get("VAPID_PRIVATE_KEY"),
    subject = Deno.env.get("VAPID_SUBJECT");
  if (!pub || !priv || !subject)
    return new Response("Push is not configured", { status: 503 });
  webpush.setVapidDetails(subject, pub, priv);
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  let sent = 0;
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await db
      .from("push_subscriptions")
      .select("*")
      .order("id")
      .range(offset, offset + 99);
    if (error) return new Response("Read failed", { status: 500 });
    for (const sub of data ?? []) {
      try {
        const { data: profile } = await db
          .from("profiles")
          .select("prefs")
          .eq("id", sub.user_id)
          .single();
        const reminder = profile?.prefs?.reminder;
        if (
          !reminder?.enabled ||
          !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(reminder.time)
        )
          continue;
        const parts = new Intl.DateTimeFormat("en-CA", {
          timeZone: sub.timezone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        }).formatToParts(new Date());
        const part = (type: string) =>
          parts.find((p) => p.type === type)?.value;
        const day = `${part("year")}-${part("month")}-${part("day")}`;
        if (`${part("hour")}:${part("minute")}` < reminder.time) continue;
        // Validate again in the service path to prevent SSRF even if a row was
        // inserted by privileged tooling without the expected client checks.
        const url = new URL(sub.endpoint);
        if (
          url.protocol !== "https:" ||
          url.port ||
          url.username ||
          url.password ||
          !/^(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)$/.test(
            url.hostname,
          )
        )
          continue;
        const { data: claimed } = await db.rpc("claim_push_reminder", {
          p_id: sub.id,
          p_day: day,
        });
        if (!claimed) continue;
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            JSON.stringify({
              title: "DailyMark",
              body: "Time for a quick note or today's quiz.",
            }),
            { TTL: 3600, timeout: 10000 },
          );
          sent++;
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410)
            await db.from("push_subscriptions").delete().eq("id", sub.id);
          // Failed delivery remains reserved for this day to prevent retry storms.
        }
      } catch {
        /* Invalid timezone or subscription: skip this device. */
      }
    }
    if (!data || data.length < 100) break;
  }
  return Response.json({ sent }, { headers: { "Cache-Control": "no-store" } });
});
