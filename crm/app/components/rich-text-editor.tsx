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
  Heading1, Heading2, Minus,
} from "lucide-react";
import { useCallback, useEffect, useRef } from "react";

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** "email" shows full toolbar; "social" hides headings/alignment */
  mode?: "email" | "social";
  /** minimum editor height in px */
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
        class: `prose prose-sm max-w-none focus:outline-none px-3 py-2`,
        style: `min-height: ${minHeight}px`,
      },
    },
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML());
    },
  });

  // Sync external content changes (e.g., template pre-fill)
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    // Only update if content meaningfully changed (not just whitespace)
    if (content && content !== current && content !== "<p></p>") {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

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

        {/* Horizontal rule (email only) */}
        {mode === "email" && (
          <ToolbarButton
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title="horizontal line"
          >
            <Minus size={s} />
          </ToolbarButton>
        )}
      </div>

      {/* Editor content */}
      <EditorContent editor={editor} />

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
