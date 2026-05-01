"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, Quote, Link as LinkIcon, Image as ImageIcon,
  AlignLeft, AlignCenter, AlignRight, Undo, Redo, Code,
  Heading1, Heading2, Minus, Tags, ChevronDown, Code2, Link2, ExternalLink,
  Paperclip,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AssetPicker } from "./asset-picker";

interface MergeTag {
  label: string;
  value: string;
  group: string;
}

const MERGE_TAGS: MergeTag[] = [
  { group: "contact", label: "first name", value: "{{firstName}}" },
  { group: "contact", label: "org name", value: "{{orgName}}" },
  { group: "contact", label: "contact name", value: "{{contactName}}" },
  { group: "contact", label: "org email", value: "{{orgEmail}}" },
  { group: "contact", label: "org website", value: "{{orgWebsite}}" },
  { group: "sender", label: "sender name", value: "{{senderName}}" },
  { group: "bespoke", label: "bespoke email copy", value: "{{bespokeEmailCopy}}" },
  { group: "bespoke", label: "outreach suggestion", value: "{{outreachSuggestion}}" },
];

const MERGE_TAG_GROUPS: { key: string; label: string }[] = [
  { key: "contact", label: "organization" },
  { key: "sender", label: "sender" },
  { key: "bespoke", label: "bespoke" },
];

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** "email" shows full toolbar; "social" hides headings/alignment */
  mode?: "email" | "social";
  /** minimum editor height in px — used on mobile; desktop gets a larger floor via responsive CSS */
  minHeight?: number;
}

function ToolbarButton({
  onClick,
  active,
  children,
  title,
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        active
          ? "bg-accent/20 text-accent"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="w-px h-5 bg-border mx-0.5" />;
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = "start writing...",
  mode = "email",
  minHeight = 200,
}: RichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mergeTagOpen, setMergeTagOpen] = useState(false);
  const mergeTagRef = useRef<HTMLDivElement>(null);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [htmlMode, setHtmlMode] = useState(false);
  const [htmlSource, setHtmlSource] = useState(content);
  // Track whether the user has made edits inside the Tiptap editor (as opposed to
  // in the raw HTML textarea). We only sync editor.getHTML() → htmlSource when this
  // is true; otherwise we'd overwrite the original Canva/raw HTML with Tiptap's
  // schema-stripped version every time the user clicks the </> toggle.
  const [tiptapDirty, setTiptapDirty] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: mode === "social" ? false : { levels: [1, 2] },
        horizontalRule: mode === "social" ? false : {},
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-accent underline" },
      }),
      Image.configure({
        HTMLAttributes: { class: "max-w-full rounded-lg" },
      }),
      Placeholder.configure({ placeholder }),
      ...(mode === "email"
        ? [TextAlign.configure({ types: ["heading", "paragraph"] })]
        : []),
    ],
    content,
    editorProps: {
      attributes: {
        // min-height is inherited from the responsive wrapper div below
        class: `prose prose-sm max-w-none focus:outline-none px-3 py-2 min-h-[inherit]`,
      },
    },
    onUpdate: ({ editor: e }) => {
      setTiptapDirty(true);
      onChange(e.getHTML());
    },
  });

  // Sync external content changes (e.g., template pre-fill).
  // Skip when in HTML mode — the raw textarea owns the source of truth there,
  // and re-parsing through Tiptap would destroy complex HTML (Canva, etc.).
  useEffect(() => {
    if (!editor || htmlMode) return;
    const current = editor.getHTML();
    if (content && content !== current && content !== "<p></p>") {
      editor.commands.setContent(content);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing editor state with external prop change
      setTiptapDirty(false);
    }
  }, [content, editor, htmlMode]);

  // Close merge tag dropdown on outside click
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (mergeTagRef.current && !mergeTagRef.current.contains(e.target as Node)) {
        setMergeTagOpen(false);
      }
    }
    if (mergeTagOpen) document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [mergeTagOpen]);

  // When toggling into HTML mode, only sync from Tiptap if the user actually
  // typed something there. Otherwise htmlSource already holds the original
  // raw HTML (from useState(content)) and we must not overwrite it with
  // Tiptap's schema-stripped version.
  const toggleHtmlMode = useCallback(() => {
    if (!editor) return;
    if (!htmlMode) {
      if (tiptapDirty) setHtmlSource(editor.getHTML());
    } else {
      // Switching back to Tiptap: push HTML source into editor
      editor.commands.setContent(htmlSource);
      onChange(htmlSource);
    }
    setHtmlMode((v) => !v);
    setTiptapDirty(false);
  }, [editor, htmlMode, htmlSource, onChange, tiptapDirty]);

  const insertMergeTag = useCallback(
    (tag: string) => {
      if (!editor) return;
      editor.chain().focus().insertContent(tag).run();
      setMergeTagOpen(false);
    },
    [editor],
  );

  const addLink = useCallback(() => {
    if (!editor) return;
    const url = window.prompt("enter URL:");
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  }, [editor]);

  const addImage = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImageUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !editor) return;

      // Upload to R2 via the assets API
      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch("/api/assets/upload", {
          method: "POST",
          body: formData,
        });
        if (res.ok) {
          const data = await res.json();
          editor.chain().focus().setImage({ src: data.url, alt: file.name }).run();
        }
      } catch {
        // Fallback: use object URL for preview (won't persist)
        const url = URL.createObjectURL(file);
        editor.chain().focus().setImage({ src: url, alt: file.name }).run();
      }

      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [editor],
  );

  const addImageUrl = useCallback(() => {
    if (!editor) return;
    const url = window.prompt("enter image URL:");
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  const openEmailPopout = useCallback(() => {
    const html = htmlMode ? htmlSource : editor?.getHTML() ?? "";
    const style = "body{margin:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}.wrap{max-width:600px;margin:32px auto;background:#fff;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,.08);padding:40px 48px;line-height:1.6;font-size:15px;color:#111}*{box-sizing:border-box;max-width:100%}img{border-radius:4px}a{color:#6366f1}";
    const doc = `<!doctype html><html><head><meta charset="utf-8"><style>${style}</style></head><body><div class="wrap">${html}</div></body></html>`;
    const blob = new Blob([doc], { type: "text/html" });
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, "_blank", "width=720,height=860,menubar=no,toolbar=no");
    setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
  }, [htmlMode, htmlSource, editor]);

  if (!editor) return null;

  const s = 14; // icon size

  return (
    <div className="border rounded-lg overflow-hidden bg-background">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b bg-muted/30">
        {/* Undo/Redo */}
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="undo">
          <Undo size={s} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="redo">
          <Redo size={s} />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Text formatting */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          title="bold"
        >
          <Bold size={s} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          title="italic"
        >
          <Italic size={s} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive("underline")}
          title="underline"
        >
          <UnderlineIcon size={s} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive("strike")}
          title="strikethrough"
        >
          <Strikethrough size={s} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive("code")}
          title="inline code"
        >
          <Code size={s} />
        </ToolbarButton>

        {/* Headings (email only) */}
        {mode === "email" && (
          <>
            <ToolbarDivider />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              active={editor.isActive("heading", { level: 1 })}
              title="heading 1"
            >
              <Heading1 size={s} />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              active={editor.isActive("heading", { level: 2 })}
              title="heading 2"
            >
              <Heading2 size={s} />
            </ToolbarButton>
          </>
        )}

        <ToolbarDivider />

        {/* Lists */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          title="bullet list"
        >
          <List size={s} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          title="numbered list"
        >
          <ListOrdered size={s} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive("blockquote")}
          title="quote"
        >
          <Quote size={s} />
        </ToolbarButton>

        {/* Alignment (email only) */}
        {mode === "email" && (
          <>
            <ToolbarDivider />
            <ToolbarButton
              onClick={() => editor.chain().focus().setTextAlign("left").run()}
              active={editor.isActive({ textAlign: "left" })}
              title="align left"
            >
              <AlignLeft size={s} />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().setTextAlign("center").run()}
              active={editor.isActive({ textAlign: "center" })}
              title="align center"
            >
              <AlignCenter size={s} />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().setTextAlign("right").run()}
              active={editor.isActive({ textAlign: "right" })}
              title="align right"
            >
              <AlignRight size={s} />
            </ToolbarButton>
          </>
        )}

        <ToolbarDivider />

        {/* Links & Images */}
        <ToolbarButton onClick={addLink} active={editor.isActive("link")} title="add link">
          <LinkIcon size={s} />
        </ToolbarButton>
        <ToolbarButton onClick={addImage} title="upload image">
          <ImageIcon size={s} />
        </ToolbarButton>
        <ToolbarButton onClick={addImageUrl} title="insert image from URL">
          <Link2 size={s} />
        </ToolbarButton>

        {/* Attach BD asset (from library) or upload a file */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setAssetPickerOpen((v) => !v)}
            title="attach asset (library or upload)"
            className={`p-1.5 rounded transition-colors ${
              assetPickerOpen
                ? "bg-accent/20 text-accent"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Paperclip size={s} />
          </button>
          {assetPickerOpen && editor && (
            <AssetPicker
              onInsertHtml={(html) =>
                editor.chain().focus().insertContent(html).run()
              }
              onClose={() => setAssetPickerOpen(false)}
            />
          )}
        </div>

        {/* Horizontal rule (email only) */}
        {mode === "email" && (
          <ToolbarButton
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title="horizontal line"
          >
            <Minus size={s} />
          </ToolbarButton>
        )}

        {/* HTML source toggle */}
        <ToolbarButton onClick={toggleHtmlMode} active={htmlMode} title="edit raw HTML / preview">
          <Code2 size={s} />
        </ToolbarButton>
        {/* Email popout preview (always available, not just in HTML mode) */}
        <ToolbarButton onClick={openEmailPopout} title="open email preview in new window">
          <ExternalLink size={s} />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Merge tags dropdown */}
        <div className="relative" ref={mergeTagRef}>
          <button
            type="button"
            onClick={() => setMergeTagOpen((v) => !v)}
            title="insert merge tag"
            className="flex items-center gap-0.5 px-1.5 py-1 rounded text-xs font-mono font-medium transition-colors text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Tags size={s} />
            <ChevronDown size={10} />
          </button>

          {mergeTagOpen && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-popover border rounded-lg shadow-lg min-w-48 py-1 text-sm max-h-64 overflow-y-auto">
              {MERGE_TAG_GROUPS.map((group) => {
                const tags = MERGE_TAGS.filter((t) => t.group === group.key);
                return (
                  <div key={group.key}>
                    <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                      {group.label}
                    </div>
                    {tags.map((tag) => (
                      <button
                        key={tag.value}
                        type="button"
                        className="w-full text-left px-3 py-1.5 hover:bg-accent/10 transition-colors flex items-center justify-between gap-4"
                        onClick={() => insertMergeTag(tag.value)}
                      >
                        <span>{tag.label}</span>
                        <code className="text-[10px] text-muted-foreground bg-muted px-1 rounded">{tag.value}</code>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Editor content — responsive height: compact on mobile, spacious on desktop */}
      {htmlMode ? (
        <div
          className="flex divide-x min-h-[200px] md:min-h-[480px]"
        >
          <textarea
            className="w-1/2 p-3 font-mono text-xs resize-none focus:outline-none bg-muted/20 text-foreground min-h-[inherit]"
            value={htmlSource}
            onChange={(e) => {
              setHtmlSource(e.target.value);
              onChange(e.target.value);
            }}
            spellCheck={false}
            placeholder="<p>HTML here...</p>"
          />
          <iframe
            className="w-1/2 border-0 min-h-[inherit]"
            sandbox="allow-same-origin"
            srcDoc={`<!doctype html><html><head><style>body{font-family:inherit;font-size:14px;padding:12px;margin:0;line-height:1.6}*{max-width:100%;box-sizing:border-box}</style></head><body>${htmlSource}</body></html>`}
            title="HTML preview"
          />
        </div>
      ) : (
        <div className="min-h-[200px] md:min-h-[480px]">
          <EditorContent editor={editor} />
        </div>
      )}

      {/* Hidden file input for image uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />
    </div>
  );
}
