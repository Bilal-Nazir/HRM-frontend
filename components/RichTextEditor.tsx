"use client";

import { useEffect, useId, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { Bold, Italic, Strikethrough, List, ListOrdered, Quote, Code2, Link2, Unlink, Undo2, Redo2, RemoveFormatting } from "lucide-react";
import { descriptionExtensions, descriptionLink } from "@/lib/descriptionEditor";

export default function RichTextEditor({ value, onChange, label = "Description", compact = false }: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  compact?: boolean;
}) {
  const id = useId();
  const [linkOpen, setLinkOpen] = useState(false), [link, setLink] = useState(""), [linkError, setLinkError] = useState("");
  const linkInput = useRef<HTMLInputElement>(null);
  const selection = useRef({ from: 0, to: 0 });
  const editor = useEditor({
    extensions: descriptionExtensions(),
    content: value,
    contentType: "markdown",
    immediatelyRender: false,
    editorProps: { attributes: { role: "textbox", "aria-multiline": "true", "aria-labelledby": `${id}-label`, "data-placeholder": "Add details, requirements, or a checklist…", class: "rich-text-content rich-text-input" } },
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? "" : editor.getMarkdown()),
  });
  const state = useEditorState({ editor, selector: ({ editor }) => editor ? {
    bold: editor.isActive("bold"), italic: editor.isActive("italic"), strike: editor.isActive("strike"),
    bullet: editor.isActive("bulletList"), ordered: editor.isActive("orderedList"), quote: editor.isActive("blockquote"),
    code: editor.isActive("codeBlock"), link: editor.isActive("link"),
    block: editor.isActive("heading", { level: 2 }) ? "2" : editor.isActive("heading", { level: 3 }) ? "3" : "paragraph",
    undo: editor.can().undo(), redo: editor.can().redo(),
  } : null });

  useEffect(() => {
    if (editor && value !== editor.getMarkdown() && !(editor.isEmpty && value === "")) {
      editor.commands.setContent(value, { contentType: "markdown", emitUpdate: false });
    }
  }, [editor, value]);
  useEffect(() => { if (linkOpen) linkInput.current?.focus(); }, [linkOpen]);

  const applyLink = () => {
    if (!editor) return;
    const href = descriptionLink(link);
    if (!href) { setLinkError("Enter a valid website or email link (https:// or mailto:)."); return; }
    const chain = editor.chain().focus().setTextSelection(selection.current).extendMarkRange("link");
    if (selection.current.from === selection.current.to && !editor.isActive("link")) {
      chain.insertContent({ type: "text", text: href, marks: [{ type: "link", attrs: { href, target: "_blank", rel: "noopener noreferrer" } }] }).run();
    } else chain.setLink({ href }).run();
    setLinkOpen(false);
    setLinkError("");
  };
  const tools = [
    { label: "Bold", icon: Bold, active: state?.bold, action: () => editor?.chain().focus().toggleBold().run() },
    { label: "Italic", icon: Italic, active: state?.italic, action: () => editor?.chain().focus().toggleItalic().run() },
    { label: "Strikethrough", icon: Strikethrough, active: state?.strike, action: () => editor?.chain().focus().toggleStrike().run() },
    { label: "Bullet list", icon: List, active: state?.bullet, action: () => editor?.chain().focus().toggleBulletList().run() },
    { label: "Numbered list", icon: ListOrdered, active: state?.ordered, action: () => editor?.chain().focus().toggleOrderedList().run() },
    { label: "Quote", icon: Quote, active: state?.quote, action: () => editor?.chain().focus().toggleBlockquote().run() },
    { label: "Code block", icon: Code2, active: state?.code, action: () => editor?.chain().focus().toggleCodeBlock().run() },
    { label: "Add or edit link", icon: Link2, active: state?.link, action: () => {
      if (!editor) return;
      selection.current = { from: editor.state.selection.from, to: editor.state.selection.to };
      setLink(editor.getAttributes("link").href || ""); setLinkError(""); setLinkOpen(!linkOpen);
    } },
    { label: "Remove link", icon: Unlink, disabled: !state?.link, action: () => editor?.chain().focus().extendMarkRange("link").unsetLink().run() },
    { label: "Clear formatting", icon: RemoveFormatting, action: () => editor?.chain().focus().unsetAllMarks().clearNodes().run() },
    { label: "Undo", icon: Undo2, disabled: !state?.undo, action: () => editor?.chain().focus().undo().run() },
    { label: "Redo", icon: Redo2, disabled: !state?.redo, action: () => editor?.chain().focus().redo().run() },
  ];

  return <div className={`field rich-text-field${compact ? " rich-text-compact" : ""}`}>
    <span className="rich-text-label" id={`${id}-label`}>{label}</span>
    <div className="rich-text-editor">
      <div className="rich-text-toolbar" role="toolbar" aria-label={`${label} formatting`}>
        <select aria-label="Text style" value={state?.block || "paragraph"} disabled={!editor} onChange={(event) => {
          const chain = editor?.chain().focus();
          if (event.target.value === "paragraph") chain?.setParagraph().run();
          else chain?.toggleHeading({ level: Number(event.target.value) as 2 | 3 }).run();
        }}>
          <option value="paragraph">Normal text</option><option value="2">Heading</option><option value="3">Subheading</option>
        </select>
        {tools.map(({ label, icon: Icon, action, active, disabled }) => <button key={label} type="button" title={label} aria-label={label} aria-pressed={active === undefined ? undefined : active} disabled={!editor || disabled} onMouseDown={(event) => event.preventDefault()} onClick={action}><Icon size={16}/></button>)}
      </div>
      {linkOpen && <div className="rich-text-link">
        <label htmlFor={`${id}-link`}>Link address</label>
        <div><input ref={linkInput} id={`${id}-link`} type="text" inputMode="url" placeholder="https://example.com" value={link} aria-invalid={!!linkError} aria-describedby={linkError ? `${id}-link-error` : undefined} onChange={(event) => { setLink(event.target.value); setLinkError(""); }} onKeyDown={(event) => {
          if (event.key === "Enter") { event.preventDefault(); event.stopPropagation(); applyLink(); }
          if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setLinkOpen(false); editor?.commands.focus(); }
        }}/><button type="button" onClick={applyLink}>Apply</button><button type="button" onClick={() => { setLinkOpen(false); editor?.commands.focus(); }}>Cancel</button></div>
        {linkError && <small id={`${id}-link-error`} role="alert">{linkError}</small>}
      </div>}
      <EditorContent editor={editor}/>
      {!editor && <div className="rich-text-loading" role="status">Loading editor…</div>}
    </div>
  </div>;
}
