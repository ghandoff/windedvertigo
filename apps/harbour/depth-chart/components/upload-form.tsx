"use client";

import { useState, useCallback, useRef } from "react";
import { FrameworkToggles } from "./framework-toggles";
import type { TeacherConfig } from "@/lib/types";

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

const ACCEPTED_EXTENSIONS = ".pdf,.docx,.txt";

function file_label(file: File): string {
  const ext = file.name.split(".").pop()?.toUpperCase() || "FILE";
  const size_kb = (file.size / 1024).toFixed(0);
  return `${file.name} (${ext}, ${size_kb} KB)`;
}

interface UploadFormProps {
  on_submit: (data: {
    raw_text?: string;
    file?: File;
    subject: string;
    grade_level: string;
    title: string;
    frameworks: TeacherConfig["frameworks"];
  }) => void;
  is_loading: boolean;
  initial_text?: string;
}

export function UploadForm({ on_submit, is_loading, initial_text }: UploadFormProps) {
  const [raw_text, set_raw_text] = useState(initial_text || "");
  const [subject, set_subject] = useState("");
  const [grade_level, set_grade_level] = useState("");
  const [title, set_title] = useState("");
  const [file, set_file] = useState<File | null>(null);
  const [frameworks, set_frameworks] = useState<TeacherConfig["frameworks"]>({ webb_dok: false, solo: false });
  const [drag_active, set_drag_active] = useState(false);
  const file_input_ref = useRef<HTMLInputElement>(null);

  const has_content = file !== null || raw_text.trim().length > 0;

  const handle_submit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!has_content) return;
      on_submit({
        raw_text: file ? undefined : raw_text,
        file: file || undefined,
        subject,
        grade_level,
        title,
        frameworks,
      });
    },
    [raw_text, subject, grade_level, title, file, frameworks, has_content, on_submit]
  );

  const accept_file = useCallback((f: File) => {
    if (ACCEPTED_TYPES.includes(f.type) || /\.(pdf|docx|txt)$/i.test(f.name)) {
      if (f.type === "text/plain") {
        f.text().then((text) => {
          set_raw_text(text);
          set_file(null);
        });
      } else {
        set_file(f);
        set_raw_text("");
      }
    }
  }, []);

  const handle_drop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      set_drag_active(false);
      const f = e.dataTransfer.files[0];
      if (f) accept_file(f);
    },
    [accept_file]
  );

  const handle_file_change = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) accept_file(f);
    },
    [accept_file]
  );

  const clear_file = useCallback(() => {
    set_file(null);
    if (file_input_ref.current) file_input_ref.current.value = "";
  }, []);

  return (
    <form onSubmit={handle_submit} className="space-y-6">
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-[var(--color-text-on-dark-muted)] mb-2">
          lesson plan title
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => set_title(e.target.value)}
          placeholder="e.g., introduction to photosynthesis"
          className="w-full bg-white/5 border border-white/15 rounded-lg px-4 py-3 text-[var(--color-text-on-dark)] placeholder:text-white/30 focus:outline-none focus:border-[var(--wv-champagne)] transition-colors"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="subject" className="block text-sm font-medium text-[var(--color-text-on-dark-muted)] mb-2">
            subject
          </label>
          <input
            id="subject"
            type="text"
            value={subject}
            onChange={(e) => set_subject(e.target.value)}
            placeholder="e.g., biology"
            className="w-full bg-white/5 border border-white/15 rounded-lg px-4 py-3 text-[var(--color-text-on-dark)] placeholder:text-white/30 focus:outline-none focus:border-[var(--wv-champagne)] transition-colors"
          />
        </div>
        <div>
          <label htmlFor="grade_level" className="block text-sm font-medium text-[var(--color-text-on-dark-muted)] mb-2">
            grade level
          </label>
          <input
            id="grade_level"
            type="text"
            value={grade_level}
            onChange={(e) => set_grade_level(e.target.value)}
            placeholder="e.g., year 10, undergraduate"
            className="w-full bg-white/5 border border-white/15 rounded-lg px-4 py-3 text-[var(--color-text-on-dark)] placeholder:text-white/30 focus:outline-none focus:border-[var(--wv-champagne)] transition-colors"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--color-text-on-dark-muted)] mb-2">
          analytical frameworks
        </label>
        <FrameworkToggles frameworks={frameworks} on_change={set_frameworks} />
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--color-text-on-dark-muted)] mb-2">
          lesson plan or syllabus
        </label>

        {/* file upload zone */}
        {!file && (
          <div
            onDragOver={(e) => { e.preventDefault(); set_drag_active(true); }}
            onDragLeave={() => set_drag_active(false)}
            onDrop={handle_drop}
            className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
              drag_active
                ? "border-[var(--wv-champagne)] bg-[var(--wv-champagne)]/5"
                : "border-white/15 hover:border-white/30"
            }`}
            onClick={() => file_input_ref.current?.click()}
          >
            <input
              ref={file_input_ref}
              type="file"
              accept={ACCEPTED_EXTENSIONS}
              onChange={handle_file_change}
              className="hidden"
            />
            <div className="space-y-2">
              <p className="text-sm text-[var(--color-text-on-dark)]">
                drag & drop a file here, or click to browse
              </p>
              <p className="text-xs text-[var(--color-text-on-dark-muted)]">
                PDF, DOCX, or TXT — we'll extract the text automatically
              </p>
            </div>
          </div>
        )}

        {/* selected file display */}
        {file && (
          <div className="flex items-center justify-between bg-white/5 border border-white/15 rounded-lg px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-[var(--wv-champagne)] bg-[var(--wv-champagne)]/10 px-2 py-1 rounded">
                {file.name.split(".").pop()?.toUpperCase()}
              </span>
              <span className="text-sm text-[var(--color-text-on-dark)]">
                {file_label(file)}
              </span>
            </div>
            <button
              type="button"
              onClick={clear_file}
              className="text-xs text-[var(--color-text-on-dark-muted)] hover:text-[var(--color-text-on-dark)] transition-colors"
            >
              remove
            </button>
          </div>
        )}

        {/* text input (show when no file is selected) */}
        {!file && (
          <>
            <div className="flex items-center gap-3 my-3">
              <div className="flex-1 border-t border-white/10" />
              <span className="text-xs text-[var(--color-text-on-dark-muted)]">or paste text</span>
              <div className="flex-1 border-t border-white/10" />
            </div>
            <textarea
              id="raw_text"
              value={raw_text}
              onChange={(e) => set_raw_text(e.target.value)}
              placeholder="paste your lesson plan, syllabus, or course outline here"
              rows={10}
              className="w-full bg-white/5 border border-white/15 rounded-lg px-4 py-3 text-[var(--color-text-on-dark)] placeholder:text-white/30 focus:outline-none focus:border-[var(--wv-champagne)] transition-colors resize-y font-mono text-sm leading-relaxed"
            />
          </>
        )}

        <p className="text-xs text-[var(--color-text-on-dark-muted)] mt-2">
          include learning objectives, outcomes, and any assessment descriptions already in the plan.
        </p>
      </div>

      <button
        type="submit"
        disabled={!has_content || is_loading}
        className="w-full bg-[var(--wv-champagne)] text-[var(--wv-cadet)] font-semibold py-3 px-6 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {is_loading ? "parsing objectives..." : "extract learning objectives"}
      </button>
    </form>
  );
}
