"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getSession } from "@/lib/auth";

const photos = new Map<string, Promise<Blob>>();
export default function Avatar({
  userId,
  version,
  name,
  className = "avatar",
}: {
  userId?: string;
  version?: string;
  name: string;
  className?: string;
}) {
  const [image, setImage] = useState<{ key: string; url: string } | null>(null);
  const session = getSession();
  const key = `${session?.organizationId}:${session?.userId}:${userId}:${version}`;
  useEffect(() => {
    if (!userId || !version || !session?.userId) return;
    let cancelled = false,
      url: string | undefined;
    if (!photos.has(key)) {
      if (photos.size >= 100) photos.delete(photos.keys().next().value!);
      const request = api.download(
        `/auth/people/${encodeURIComponent(userId)}/photo?v=${encodeURIComponent(version)}`,
      );
      photos.set(key, request);
      request.catch(() => {
        photos.delete(key);
      });
    }
    photos
      .get(key)!
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setImage({ key, url });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [key, userId, version, session?.userId]);
  const initials =
    name
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";
  return (
    <span className={`${className} person-avatar`} aria-label={name}>
      {image?.key === key ? (
        <img src={image.url} alt="" onError={() => setImage(null)} />
      ) : (
        initials
      )}
    </span>
  );
}
