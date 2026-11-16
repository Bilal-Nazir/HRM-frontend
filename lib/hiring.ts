import { resolveApiUrl } from "@/lib/apiUrl";

export type HiringQuestion = { id: string; label: string; required: boolean };
export type HiringPage = {
  id: string;
  publicId: string;
  title: string;
  introduction: string;
  description: string;
  location: string;
  workMode: string;
  employmentType: string;
  accentColor: string;
  status: "draft" | "published" | "closed" | "archived";
  questions: HiringQuestion[];
  applicants?: number;
  newApplicants?: number;
  createdAt?: string;
};
export type PublicHiringPage = Omit<HiringPage, "id"> & { companyName: string };
export type HiringApplication = {
  id: string;
  pageId: string;
  pageTitle: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  createdAt: string;
  cvName: string;
  cvType: string;
  cvSize: number;
  coverLetter?: string;
  notes?: string;
  consentAt?: string;
  reviewedAt?: string;
  answers?: { questionId: string; label: string; value: string }[];
};
export const applicationStatuses = [
  "new",
  "reviewing",
  "shortlisted",
  "rejected",
  "hired",
];
export const newHiringPage = (): HiringPage => ({
  id: "",
  publicId: "",
  title: "",
  introduction: "",
  description: "",
  location: "",
  workMode: "On-site",
  employmentType: "Full-time",
  accentColor: "#0d9488",
  status: "draft",
  questions: [],
});
export const MAX_CV_BYTES = 5 * 1024 * 1024;
export async function readCv(file: File) {
  if (
    !/\.(pdf|docx?)$/i.test(file.name) ||
    file.size === 0 ||
    file.size > MAX_CV_BYTES
  )
    throw new Error("Choose a PDF, DOC or DOCX file up to 5 MB.");
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () =>
      reject(
        new Error("Could not read your CV. Please choose the file again."),
      );
    reader.readAsDataURL(file);
  });
  return { name: file.name, data };
}
// Candidate pages intentionally do not use the employee API client: no tokens,
// session refreshes, cookies or login redirects are sent to these public routes.
export async function careersRequest<T>(
  publicId: string,
  body?: unknown,
): Promise<T> {
  const base = resolveApiUrl(
    process.env.NEXT_PUBLIC_API_URL,
    process.env.NODE_ENV === "production",
  );
  const response = await fetch(
    `${base}/careers/${encodeURIComponent(publicId)}${body === undefined ? "" : "/applications"}`,
    {
      method: body === undefined ? "GET" : "POST",
      credentials: "omit",
      cache: "no-store",
      ...(body !== undefined && {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    },
  );
  const result = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      result.message ||
        (response.status === 404
          ? "This hiring page is not available or is no longer accepting applications."
          : "Unable to connect. Please try again."),
    );
  return result.data as T;
}
