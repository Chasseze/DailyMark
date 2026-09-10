import { createClient } from "npm:@supabase/supabase-js@2";
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Cache-Control": "no-store",
};
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers });
  const reply = (body: unknown, status = 200) =>
    Response.json(body, { status, headers });
  if (request.method !== "POST")
    return reply({ error: "Method not allowed" }, 405);
  try {
    const { token, path } = await request.json();
    if (
      typeof token !== "string" ||
      token.length > 100 ||
      typeof path !== "string" ||
      path.length > 300 ||
      !/^[a-f0-9-]+\/[a-f0-9-]+\/[a-f0-9-]+\.(jpg|png|webp|gif)$/.test(path)
    )
      return reply({ error: "Invalid request" }, 400);
    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: share } = await db
      .from("share_tokens")
      .select("user_id")
      .eq("token", token)
      .maybeSingle();
    if (!share || path.split("/")[0] !== share.user_id)
      return reply({ error: "Attachment unavailable" }, 404);
    const { data, error } = await db.rpc("get_shared_content", {
      p_token: token,
    });
    if (error || !data) return reply({ error: "Share unavailable" }, 404);
    const bodies: string[] =
      data.type === "note"
        ? [data.content]
        : data.notes.map((n: { content: string }) => n.content);
    // Only a URL belonging to THIS storage endpoint, included in the authorized
    // share's actual Markdown, may be signed. No owner-folder-wide access.
    const origin = new URL(
      Deno.env.get("PUBLIC_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!,
    ).origin;
    const allowed = bodies.some((body) =>
      [...body.matchAll(/https?:\/\/[^\s<>"')]+/g)].some((match) => {
        try {
          const u = new URL(match[0]);
          return (
            u.origin === origin &&
            decodeURIComponent(u.pathname) ===
              `/storage/v1/object/public/note-images/${path}`
          );
        } catch {
          return false;
        }
      }),
    );
    if (!allowed) return reply({ error: "Attachment unavailable" }, 404);
    const signed = await db.storage
      .from("note-images")
      .createSignedUrl(path, 60);
    if (signed.error) return reply({ error: "Attachment unavailable" }, 404);
    return reply(signed.data);
  } catch {
    return reply({ error: "Invalid request" }, 400);
  }
});
