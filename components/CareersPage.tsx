"use client";

import { CSSProperties, FormEvent, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, FileUp } from "lucide-react";
import HiringPagePreview from "@/components/HiringPagePreview";
import { PublicHiringPage, careersRequest, readCv } from "@/lib/hiring";

export default function CareersPage() {
  const { publicId } = useParams<{ publicId: string }>();
  const [page, setPage] = useState<PublicHiringPage | null>(null),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState("");
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [received, setReceived] = useState(false),
    [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError("");
    setPage(null);
    setReceived(false);
    careersRequest<{ page: PublicHiringPage }>(publicId)
      .then((result) => {
        if (active) setPage(result.page);
      })
      .catch((error: Error) => {
        if (active) setLoadError(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [publicId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !page) return;
    const form = new FormData(event.currentTarget),
      file = fileRef.current?.files?.[0];
    setError("");
    setBusy(true);
    try {
      if (!file) throw new Error("Please attach your CV.");
      const cv = await readCv(file),
        answers = Object.fromEntries(
          page.questions.map((q) => [
            q.id,
            String(form.get(`answer-${q.id}`) || ""),
          ]),
        );
      await careersRequest(publicId, {
        name: form.get("name"),
        email: form.get("email"),
        phone: form.get("phone"),
        coverLetter: form.get("coverLetter"),
        website: form.get("website"),
        consent: form.get("consent") === "on",
        answers,
        cv,
      });
      setReceived(true);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not submit your application.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main
      className="careers-public"
      style={
        { "--hiring-accent": page?.accentColor || "#0d9488" } as CSSProperties
      }
    >
      {loading ? (
        <div className="hiring-public-state" role="status">
          Loading opportunity…
        </div>
      ) : loadError ? (
        <div className="hiring-public-state" role="alert">
          <h1>Hiring page unavailable</h1>
          <p>{loadError}</p>
          <button type="button" onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      ) : (
        page && (
          <>
            <div className="careers-layout">
              <HiringPagePreview page={page} companyName={page.companyName} />
              <section
                className="hiring-application-form"
                aria-labelledby="application-title"
              >
                {received ? (
                  <div className="hiring-receipt" role="status">
                    <CheckCircle2 size={36} />
                    <h2>Application received</h2>
                    <p>
                      Thank you for applying to {page.companyName}. Their team
                      will review your details and CV.
                    </p>
                  </div>
                ) : page.status !== "published" ? (
                  <>
                    <h2>Applications closed</h2>
                    <p>This role is no longer accepting applications.</p>
                  </>
                ) : (
                  <form onSubmit={submit}>
                    <h2 id="application-title">Apply for this role</h2>
                    <p>
                      Send your application directly to {page.companyName}. No
                      account needed.
                    </p>
                    <label className="field">
                      Full name <span aria-hidden="true">*</span>
                      <input
                        name="name"
                        autoComplete="name"
                        required
                        maxLength={120}
                      />
                    </label>
                    <label className="field">
                      Email <span aria-hidden="true">*</span>
                      <input
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        maxLength={254}
                      />
                    </label>
                    <label className="field">
                      Phone <small>(optional)</small>
                      <input
                        name="phone"
                        type="tel"
                        autoComplete="tel"
                        maxLength={60}
                      />
                    </label>
                    <label className="field">
                      CV <span aria-hidden="true">*</span>
                      <span className="hiring-cv-upload">
                        <FileUp size={22} />
                        <span>
                          {fileName || "Choose your CV"}
                          <small>PDF, DOC or DOCX · Up to 5 MB</small>
                        </span>
                        <input
                          ref={fileRef}
                          name="cv"
                          type="file"
                          accept=".pdf,.doc,.docx"
                          required
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            setFileName(file?.name || "");
                            setError(
                              file &&
                                (file.size > 5 * 1024 * 1024 ||
                                  !/\.(pdf|docx?)$/i.test(file.name))
                                ? "Choose a PDF, DOC or DOCX up to 5 MB."
                                : "",
                            );
                          }}
                        />
                      </span>
                    </label>
                    <label className="field">
                      Cover letter <small>(optional)</small>
                      <textarea
                        name="coverLetter"
                        rows={5}
                        maxLength={8000}
                        placeholder="Tell us a little about yourself…"
                      />
                    </label>
                    {page.questions.map((q) => (
                      <label className="field" key={q.id}>
                        {q.label}
                        {q.required && <span aria-hidden="true"> *</span>}
                        <textarea
                          name={`answer-${q.id}`}
                          rows={3}
                          maxLength={3000}
                          required={q.required}
                        />
                      </label>
                    ))}
                    <div className="hiring-honeypot" aria-hidden="true">
                      <label>
                        Website
                        <input
                          name="website"
                          tabIndex={-1}
                          autoComplete="off"
                        />
                      </label>
                    </div>
                    <label className="hiring-consent">
                      <input type="checkbox" name="consent" required />
                      <span>
                        I agree to share my details and CV with{" "}
                        {page.companyName} for recruitment.
                      </span>
                    </label>
                    {error && (
                      <div role="alert" className="error-banner">
                        {error}
                      </div>
                    )}
                    <button className="hiring-submit" disabled={busy}>
                      {busy ? "Sending application…" : "Submit application"}
                    </button>
                    <small>
                      Your application is visible to the hiring company’s admin
                      and BeMyAdmin’s Super Admin.
                    </small>
                  </form>
                )}
              </section>
            </div>
            <footer className="careers-footer">
              Applications powered by BeMyAdmin
            </footer>
          </>
        )
      )}
    </main>
  );
}
