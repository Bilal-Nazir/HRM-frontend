import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";

// Keep descriptions as readable text in the existing API, search and audit log.
export const descriptionExtensions = () => [
  StarterKit.configure({
    heading: { levels: [2, 3] },
    underline: false,
    link: { openOnClick: false, defaultProtocol: "https", protocols: ["https", "http", "mailto"] },
  }),
  Markdown.configure({ markedOptions: { breaks: true } }),
];

export function descriptionLink(value: string): string | null {
  const candidate = value.trim();
  if (!candidate || /[\s\u0000-\u001f\u007f]/.test(candidate)) return null;
  const normalized = /^[a-z][a-z\d+.-]*:/i.test(candidate) ? candidate : `https://${candidate}`;
  try {
    const url = new URL(normalized);
    return ["https:", "http:", "mailto:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
