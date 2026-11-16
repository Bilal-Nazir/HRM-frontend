"use client";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import AppShell from "@/components/AppShell";
import Avatar from "@/components/Avatar";
import { ErrorBanner, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import { SessionUser } from "@/lib/auth";
import { errorMessage } from "@/lib/workspace";

type Profile = {
  user: SessionUser;
  employee: { name: string; employeeCode?: string; jobTitle?: string } | null;
};
export default function ProfileSettings() {
  const [profile, setProfile] = useState<Profile | null>(null),
    [name, setName] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const [pending, setPending] = useState<{
    data: string;
    filename: string;
  } | null>(null);
  const input = useRef<HTMLInputElement>(null),
    lock = useRef(false);
  useEffect(() => {
    let cancelled = false;
    api
      .get<Profile>("/auth/profile")
      .then((data) => {
        if (!cancelled) {
          setProfile(data);
          setName(data.user.name || data.employee?.name || data.user.loginId);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);
  function changed(user: SessionUser) {
    setProfile((previous) => (previous ? { ...previous, user } : previous));
    localStorage.setItem("hrm_user", JSON.stringify(user));
    window.dispatchEvent(
      new CustomEvent("hrm-profile-updated", { detail: user }),
    );
  }
  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setSuccess("");
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      setError("Choose a JPG, PNG or WebP photo up to 5 MB.");
      return;
    }
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      setPending({ data, filename: file.name });
    } catch {
      setError("The selected file could not be read.");
    }
  }
  async function updatePhoto(remove = false) {
    if (lock.current || (!remove && !pending)) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const result = remove
        ? await api.delete<{ user: SessionUser }>("/auth/profile/photo")
        : await api.put<{ user: SessionUser }>("/auth/profile/photo", {
            data: pending!.data,
          });
      changed(result.user);
      setPending(null);
      setSuccess(remove ? "Profile photo removed." : "Profile photo updated.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function saveName(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const result = await api.patch<{ user: SessionUser }>("/auth/profile", {
        name: name.trim(),
      });
      changed(result.user);
      setSuccess("Display name updated.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const displayName =
    profile?.employee?.name ||
    profile?.user.name ||
    profile?.user.loginId ||
    "Your profile";
  return (
    <AppShell>
      <PageHeader
        eyebrow="Account settings"
        title="Profile settings"
        description="Add a photo so your team can recognize you in conversations."
      />
      {error && <ErrorBanner message={error} />}
      {success && (
        <div className="success-banner" role="status">
          {success}
        </div>
      )}
      {!profile && !error && <div className="loading-line" />}
      {profile && (
        <section className="card profile-settings-card">
          <div className="card-header">
            <div>
              <h2>Your profile</h2>
              <p>Your photo is shared with your companies and conversations.</p>
            </div>
          </div>
          <div className="profile-photo-settings">
            <div className="profile-photo-preview">
              {pending ? (
                <img src={pending.data} alt="Selected profile photo preview" />
              ) : (
                <Avatar
                  userId={profile.user.userId}
                  version={profile.user.photoVersion}
                  name={displayName}
                />
              )}
            </div>
            <div className="profile-photo-controls">
              <strong>{displayName}</strong>
              <p>{profile.employee?.jobTitle || "Account profile"}</p>
              <div className="profile-photo-actions">
                <input
                  ref={input}
                  className="visually-hidden"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={busy}
                  onChange={choose}
                  aria-label="Choose profile photo"
                />
                <button
                  type="button"
                  className="button button-secondary"
                  disabled={busy}
                  onClick={() => input.current?.click()}
                >
                  <Camera size={16} />
                  {profile.user.photoVersion ? "Change photo" : "Choose photo"}
                </button>
                {profile.user.photoVersion && !pending && (
                  <button
                    type="button"
                    className="button button-secondary"
                    disabled={busy}
                    onClick={() => void updatePhoto(true)}
                  >
                    <Trash2 size={16} />
                    Remove
                  </button>
                )}
                {pending && (
                  <>
                    <button
                      type="button"
                      className="button button-primary"
                      disabled={busy}
                      onClick={() => void updatePhoto()}
                    >
                      {busy ? "Saving…" : "Save photo"}
                    </button>
                    <button
                      type="button"
                      className="button button-secondary"
                      disabled={busy}
                      onClick={() => setPending(null)}
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
              <small>
                {pending?.filename ||
                  "JPG, PNG or WebP · Up to 5 MB. Photos are cropped to a square."}
              </small>
            </div>
          </div>
          {!profile.employee ? (
            <form onSubmit={saveName} className="profile-name-form">
              <label htmlFor="profile-name">Display name</label>
              <input
                id="profile-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={128}
                required
                disabled={busy}
              />
              <button
                type="submit"
                className="button button-primary"
                disabled={busy || !name.trim()}
              >
                {busy ? "Saving…" : "Save name"}
              </button>
            </form>
          ) : (
            <p className="profile-name-note">
              Your employment name is managed by your company admin.
            </p>
          )}
        </section>
      )}
    </AppShell>
  );
}
