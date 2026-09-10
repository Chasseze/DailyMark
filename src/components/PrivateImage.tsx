import { useEffect, useState } from "react";
import { requireSupabase, supabaseRest } from "../lib/supabase";

function attachmentPath(src: string): string | null {
  try {
    const url = new URL(src);
    if (url.origin !== new URL(supabaseRest.url).origin) return null;
    const match = url.pathname.match(
      /^\/storage\/v1\/object\/(?:public|sign|authenticated)\/note-images\/(.+)$/,
    );
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

export default function PrivateImage({
  src,
  alt,
  title,
  shareToken,
}: {
  src: string;
  alt: string;
  title?: string;
  shareToken?: string;
}) {
  const path = attachmentPath(src);
  const [resolved, setResolved] = useState<{ src: string; url: string } | null>(
    null,
  );
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!path) return;
    let active = true;
    const resolve = async () => {
      try {
        const db = requireSupabase();
        const result = shareToken
          ? await db.functions.invoke("shared-image", {
              body: { token: shareToken, path },
            })
          : await db.storage.from("note-images").createSignedUrl(path, 300);
        if (result.error) throw result.error;
        if (active) {
          setResolved({ src, url: result.data.signedUrl });
          setFailed(false);
        }
      } catch {
        if (active) setFailed(true);
      }
    };
    void resolve();
    const timer = window.setInterval(
      () => void resolve(),
      shareToken ? 45_000 : 240_000,
    );
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [path, src, shareToken]);
  if (path && (!resolved || resolved.src !== src || failed))
    return (
      <span role="status">
        {failed ? "Attachment unavailable" : "Loading attachment…"}
      </span>
    );
  return (
    <img
      src={path ? resolved!.url : src}
      alt={alt}
      title={title}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
    />
  );
}
