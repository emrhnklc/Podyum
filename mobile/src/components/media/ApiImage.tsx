import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { PreviewImage } from "./PreviewImage";

// Özel medyayı Bearer ile alır; URL/token diske veya herkese açık bir cache'e yazılmaz.
// Data URI web/native Image'ın HTTP header farkını ortadan kaldırır.
export function ApiImage({ path }: { path: string | null }) {
  const { client, session } = useAuth();
  const sessionId = session?.sessionId;
  const identity = `${sessionId}:${path}`;
  const [image, setImage] = useState<{ identity: string; uri: string } | null>(null);
  useEffect(() => {
    if (!path || !/^\/v1\/media\/[0-9a-f-]+\/content(?:\?variant=thumbnail)?$/i.test(path) || !sessionId) return;
    const abort = new AbortController();
    let reader: FileReader | null = null;
    void client.response(path as `/${string}`, { headers: { Accept: "image/webp" }, signal: abort.signal })
      .then((response) => response.blob()).then((blob) => {
        if (abort.signal.aborted) return;
        reader = new FileReader();
        reader.onload = () => { if (!abort.signal.aborted && typeof reader?.result === "string") setImage({ identity, uri: reader.result }); };
        reader.readAsDataURL(blob);
      }).catch(() => {});
    return () => { abort.abort(); if (reader?.readyState === 1) reader.abort(); };
  }, [client, identity, path, sessionId]);
  return <PreviewImage uri={image?.identity === identity ? image.uri : undefined} />;
}
