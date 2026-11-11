import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function RichTextContent({ value }: { value: string }) {
  return <div className="rich-text-content">
    <Markdown remarkPlugins={[remarkGfm]} components={{
      // Raw HTML is escaped by default. Descriptions cannot embed scripts,
      // tracking images, or executable links supplied through pasted content.
      img: ({ alt }) => <span>{alt || ""}</span>,
      a: ({ href, children }) => href
        ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
        : <span>{children}</span>,
    }}>{value}</Markdown>
  </div>;
}
