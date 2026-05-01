'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { STEPS } from './steps';
import type { Platform, StepContent } from './types';
import { PageHeader } from '@/app/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Compass, RotateCcw, ArrowLeft, ArrowRight, Check, Copy, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'wv-docent-state-v1';

type StoredState = {
  platform: Platform | null;
  completedIds: string[];
  currentIndex: number;
  name?: string;
};

function loadState(): StoredState {
  if (typeof window === 'undefined') return { platform: null, completedIds: [], currentIndex: 0 };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { platform: null, completedIds: [], currentIndex: 0 };
    const parsed = JSON.parse(raw);
    return {
      platform: parsed.platform ?? null,
      completedIds: Array.isArray(parsed.completedIds) ? parsed.completedIds : [],
      currentIndex: typeof parsed.currentIndex === 'number' ? parsed.currentIndex : 0,
      name: typeof parsed.name === 'string' ? parsed.name : undefined,
    };
  } catch {
    return { platform: null, completedIds: [], currentIndex: 0 };
  }
}

function saveState(s: StoredState) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* localStorage disabled — fine */
  }
}

/** Best-effort platform detection from userAgent — falls back to mac. */
function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'mac';
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('win')) return 'windows';
  return 'mac';
}

/**
 * Render inline markdown: **bold** and `code`. Returns a fragment safe
 * to drop inside any text-bearing element. Kept tiny and local — we
 * only support the two constructs that show up in docent copy.
 */
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={i}
          className="rounded bg-muted px-1 py-0.5 text-[0.85em] font-mono text-foreground"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

export default function DocentClient() {
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  // hydrate from localStorage once; auto-detect platform if none stored
  useEffect(() => {
    const s = loadState();
    // hydrating from localStorage on mount — the pattern is intentional
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlatform(s.platform ?? detectPlatform());
    setCompletedIds(s.completedIds);
    setCurrentIndex(Math.min(s.currentIndex, STEPS.length - 1));
    setHydrated(true);
  }, []);

  // persist
  useEffect(() => {
    if (!hydrated) return;
    saveState({ platform, completedIds, currentIndex });
  }, [hydrated, platform, completedIds, currentIndex]);

  const currentStep = STEPS[currentIndex];
  const isLast = currentIndex === STEPS.length - 1;
  const isFirst = currentIndex === 0;

  const contentSteps = useMemo(() => STEPS.filter((s) => !s.meta), []);
  const contentStepCount = contentSteps.length;
  const contentStepPosition = useMemo(() => {
    if (currentStep?.meta) return 0;
    return contentSteps.findIndex((s) => s.id === currentStep?.id) + 1;
  }, [contentSteps, currentStep]);

  const merged = useMemo<StepContent | null>(() => {
    if (!currentStep) return null;
    const shared = currentStep.shared;
    const plat = platform ? currentStep.platforms?.[platform] : undefined;
    if (!shared && !plat) return null;
    return {
      intro: plat?.intro ?? shared?.intro,
      body: [...(shared?.body ?? []), ...(plat?.body ?? [])],
      doneLooksLike: plat?.doneLooksLike ?? shared?.doneLooksLike,
      helpPrompt: plat?.helpPrompt ?? shared?.helpPrompt ?? '',
    };
  }, [currentStep, platform]);

  const isDone = currentStep ? completedIds.includes(currentStep.id) : false;

  const toggleDone = useCallback(() => {
    if (!currentStep) return;
    setCompletedIds((prev) =>
      prev.includes(currentStep.id) ? prev.filter((id) => id !== currentStep.id) : [...prev, currentStep.id],
    );
  }, [currentStep]);

  const goNext = useCallback(() => setCurrentIndex((i) => Math.min(i + 1, STEPS.length - 1)), []);
  const goPrev = useCallback(() => setCurrentIndex((i) => Math.max(i - 1, 0)), []);

  const resetAll = useCallback(() => {
    if (!window.confirm('reset all progress and start over? this clears your platform choice and completed steps for this browser.')) return;
    setPlatform(null);
    setCompletedIds([]);
    setCurrentIndex(0);
    setHelpOpen(false);
  }, []);

  if (!hydrated || !currentStep || !merged) {
    return <div aria-hidden="true" />;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader title="the docent" description="a guided setup for new teammates — ~30 minutes, mac or windows.">
        <Button
          variant="ghost"
          size="sm"
          onClick={resetAll}
          className="text-muted-foreground"
          aria-label="reset docent progress"
        >
          <RotateCcw className="h-4 w-4 mr-2" aria-hidden="true" />
          reset progress
        </Button>
      </PageHeader>

      {/* progress bar (only on content steps) */}
      {!currentStep.meta && (
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-widest text-muted-foreground">
            <span>
              step {contentStepPosition} of {contentStepCount}
            </span>
            {platform && <span>{platform === 'mac' ? 'mac' : 'windows'}</span>}
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-accent transition-all duration-500 motion-reduce:transition-none"
              style={{ width: `${(contentStepPosition / contentStepCount) * 100}%` }}
              aria-hidden="true"
            />
          </div>
        </div>
      )}

      {/* step content card */}
      <Card className="mb-6">
        <CardContent className="space-y-6 p-6 sm:p-8">
          <div className="flex items-start gap-3">
            {currentStep.meta && currentStep.id === 'welcome' && (
              <div className="shrink-0 rounded-full bg-accent p-2 text-white">
                <Compass className="h-5 w-5" aria-hidden="true" />
              </div>
            )}
            <div className="flex-1">
              <h2 className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
                {currentStep.title}
              </h2>
              <p className="mt-2 text-muted-foreground">{currentStep.subtitle}</p>
            </div>
          </div>

          <StepBody content={merged} platform={platform} />

          {/* done-looks-like */}
          {!currentStep.meta && merged.doneLooksLike && (
            <div className="rounded-lg border border-border bg-muted/40 p-4">
              <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
                you&apos;re done when
              </div>
              <p className="text-sm text-foreground/90">{renderInline(merged.doneLooksLike)}</p>
              <label className="mt-3 flex cursor-pointer items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={isDone}
                  onChange={toggleDone}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                <span className={cn('transition-colors', isDone && 'line-through text-muted-foreground')}>
                  i&apos;ve done this step.
                </span>
              </label>
            </div>
          )}
        </CardContent>
      </Card>

      {/* footer navigation */}
      <nav className="flex flex-wrap items-center justify-between gap-3 pb-10">
        <Button variant="outline" onClick={goPrev} disabled={isFirst} aria-label="go to previous step">
          <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" />
          back
        </Button>

        {!currentStep.meta && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setHelpOpen(true)}
            className="text-muted-foreground"
          >
            <HelpCircle className="h-4 w-4 mr-2" aria-hidden="true" />
            stuck? ask claude
          </Button>
        )}

        <Button
          onClick={goNext}
          disabled={isLast}
          aria-label={isLast ? 'already at the last step' : 'go to next step'}
        >
          {isLast ? 'all done' : (
            <>
              next
              <ArrowRight className="h-4 w-4 ml-2" aria-hidden="true" />
            </>
          )}
        </Button>
      </nav>

      <HelpModal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        prompt={merged.helpPrompt}
        platform={platform}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// step body renderer
// ────────────────────────────────────────────────────────────────
function StepBody({ content, platform }: { content: StepContent; platform: Platform | null }) {
  return (
    <div className="space-y-5">
      {content.intro && (
        <p className="text-foreground/90 leading-relaxed">{renderInline(content.intro)}</p>
      )}

      {content.body.map((block, i) => {
        switch (block.kind) {
          case 'paragraph':
            return (
              <p key={i} className="text-foreground/90 leading-relaxed">
                {renderInline(block.text)}
              </p>
            );
          case 'heading':
            return (
              <h3
                key={i}
                className="mt-2 text-sm font-semibold uppercase tracking-widest text-accent"
              >
                {block.text}
              </h3>
            );
          case 'output':
            return (
              <div
                key={i}
                className="overflow-hidden rounded-lg border border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30"
              >
                {block.label && (
                  <div className="border-b border-emerald-200 bg-emerald-100/50 px-4 py-2 text-xs uppercase tracking-widest text-emerald-700 dark:border-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-300">
                    {block.label}
                  </div>
                )}
                <pre className="whitespace-pre-wrap px-4 py-3 font-mono text-sm text-foreground/90">
                  {block.text}
                </pre>
                {block.note && (
                  <div className="border-t border-emerald-200 bg-emerald-50/80 px-4 py-2 text-xs text-emerald-800/80 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300/80">
                    {block.note}
                  </div>
                )}
              </div>
            );
          case 'commands':
            return (
              <div key={i} className="space-y-3">
                {block.commands.map((cmd, j) => (
                  <CodeBlock key={j} label={cmd.label} command={cmd.command} note={cmd.note} platform={platform} />
                ))}
              </div>
            );
          case 'claudePrompt':
            return <ClaudePromptBlock key={i} prompt={block.prompt} label={block.label} note={block.note} />;
          case 'accounts':
            return (
              <ul key={i} className="space-y-3">
                {block.items.map((item) => (
                  <li
                    key={item.label}
                    className="rounded-lg border border-border bg-card p-4"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-base font-semibold text-foreground underline decoration-accent decoration-2 underline-offset-4 hover:text-foreground/80"
                      >
                        {item.label} ↗
                      </a>
                      {item.requiresInvite && (
                        <Badge variant="secondary" className="bg-accent/10 text-accent border-accent/30">
                          needs invite
                        </Badge>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {renderInline(item.instruction)}
                    </p>
                  </li>
                ))}
              </ul>
            );
          case 'callout':
            return <Callout key={i} tone={block.tone} text={block.text} />;
          case 'download':
            return (
              <a
                key={i}
                href={block.href}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg border-2 border-accent bg-accent/5 p-4 transition hover:bg-accent/10"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-foreground">{block.label}</span>
                  <span className="text-accent" aria-hidden="true">↗</span>
                </div>
                {block.note && <p className="mt-2 text-sm text-muted-foreground">{block.note}</p>}
              </a>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// code block (terminal commands)
// ────────────────────────────────────────────────────────────────
function CodeBlock({
  label,
  command,
  note,
  platform,
}: {
  label?: string;
  command: string;
  note?: string;
  platform: Platform | null;
}) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      /* ignore */
    }
  };

  const shellLabel = platform === 'windows' ? 'PS>' : '$';
  const pasteHint =
    platform === 'windows'
      ? 'paste in terminal with ctrl+v, then press return'
      : 'paste in terminal with ⌘+v, then press return';

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-muted/40">
      {label && (
        <div className="border-b border-border px-4 py-2 text-xs uppercase tracking-widest text-muted-foreground">
          {label}
        </div>
      )}
      <div className="flex items-start gap-3 px-4 py-3">
        <span className="select-none font-mono text-sm text-accent" aria-hidden="true">
          {shellLabel}
        </span>
        <code className="flex-1 break-all font-mono text-sm text-foreground">{command}</code>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCopy}
          className="shrink-0 h-7 px-2 text-xs uppercase tracking-widest"
          aria-label={copied ? 'copied' : 'copy command'}
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 mr-1" aria-hidden="true" /> copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3 mr-1" aria-hidden="true" /> copy
            </>
          )}
        </Button>
      </div>
      {copied && (
        <div
          className="border-t border-emerald-200 bg-emerald-50/60 px-4 py-2 text-xs text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
        >
          {pasteHint}
        </div>
      )}
      {note && !copied && (
        <div className="border-t border-border bg-muted/60 px-4 py-2 text-xs text-muted-foreground">
          {note}
        </div>
      )}
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? 'command copied to clipboard' : ''}
      </span>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// claude prompt block — the distinctive sienna one
// ────────────────────────────────────────────────────────────────
function ClaudePromptBlock({
  prompt,
  label,
  note,
}: {
  prompt: string;
  label?: string;
  note?: string;
}) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border-2 border-[var(--chart-3)] bg-[var(--chart-3)]/5">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--chart-3)]/30 bg-[var(--chart-3)]/10 px-4 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-widest text-[var(--chart-3)]">
          {label ?? 'paste this into claude code'}
        </span>
        <Button
          onClick={onCopy}
          size="sm"
          className="h-7 bg-[var(--chart-3)] text-white hover:bg-[var(--chart-3)]/90 text-xs uppercase tracking-widest"
          aria-label={copied ? 'copied' : 'copy prompt'}
        >
          {copied ? (
            <><Check className="h-3 w-3 mr-1" aria-hidden="true" /> copied</>
          ) : (
            <><Copy className="h-3 w-3 mr-1" aria-hidden="true" /> copy prompt</>
          )}
        </Button>
      </div>
      <pre className="whitespace-pre-wrap px-4 py-4 font-mono text-sm leading-relaxed text-foreground/90">
        {prompt}
      </pre>
      {copied && (
        <div
          className="border-t border-emerald-200 bg-emerald-50/60 px-4 py-2 text-xs text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
        >
          copied — switch to your claude code window and paste (⌘+v on mac, ctrl+v on windows), then press return.
        </div>
      )}
      {note && !copied && (
        <div className="border-t border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
          {note}
        </div>
      )}
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? 'claude prompt copied to clipboard' : ''}
      </span>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// callout
// ────────────────────────────────────────────────────────────────
function Callout({ tone, text }: { tone: 'info' | 'warn' | 'success' | 'tip'; text: string }) {
  const variants = {
    info: {
      wrapper:
        'border-l-4 border-l-blue-400 bg-blue-50/60 border-y border-r border-blue-200 dark:border-l-blue-500 dark:bg-blue-950/30 dark:border-blue-900',
      icon: '★',
      iconClass: 'text-blue-600 dark:text-blue-300',
    },
    warn: {
      wrapper:
        'border-l-4 border-l-amber-400 bg-amber-50/60 border-y border-r border-amber-200 dark:border-l-amber-500 dark:bg-amber-950/30 dark:border-amber-900',
      icon: '⚠',
      iconClass: 'text-amber-700 dark:text-amber-300',
    },
    success: {
      wrapper:
        'border-l-4 border-l-emerald-400 bg-emerald-50/60 border-y border-r border-emerald-200 dark:border-l-emerald-500 dark:bg-emerald-950/30 dark:border-emerald-900',
      icon: '✓',
      iconClass: 'text-emerald-700 dark:text-emerald-300',
    },
    tip: {
      wrapper:
        'border-l-4 border-l-[var(--chart-3)] bg-[var(--chart-3)]/5 border-y border-r border-[var(--chart-3)]/30 dark:bg-[var(--chart-3)]/10',
      icon: '💡',
      iconClass: 'text-[var(--chart-3)]',
    },
  }[tone];

  return (
    <div className={cn('flex gap-3 rounded-md p-4', variants.wrapper)}>
      <span aria-hidden="true" className={cn('shrink-0 text-lg leading-none', variants.iconClass)}>
        {variants.icon}
      </span>
      <p className="text-sm leading-relaxed text-foreground/90">{renderInline(text)}</p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// help modal (shadcn Dialog)
// ────────────────────────────────────────────────────────────────
function HelpModal({
  open,
  onClose,
  prompt,
  platform,
}: {
  open: boolean;
  onClose: () => void;
  prompt: string;
  platform: Platform | null;
}) {
  const [copied, setCopied] = useState(false);
  const fullPrompt = `i'm setting up my development environment for winded.vertigo apps. i'm on ${
    platform === 'mac' ? 'macos' : platform === 'windows' ? 'windows' : 'my laptop'
  }.\n\n${prompt}\n\n(if it helps, here's what i tried and what went wrong:)\n[paste your terminal output or error message here]`;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      /* ignore */
    }
  };

  // reset copied state when opening fresh
  useEffect(() => {
    // resetting transient UI flag when dialog opens — intentional sync with parent prop
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setCopied(false);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>stuck? copy this into claude.</DialogTitle>
          <DialogDescription>
            paste this prompt (with your own details filled in) into claude code, claude.ai, or claude desktop.
          </DialogDescription>
        </DialogHeader>

        <pre className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-md bg-muted/60 p-4 font-mono text-sm text-foreground/90">
          {fullPrompt}
        </pre>

        <div className="flex items-center justify-between gap-3">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            {copied ? 'copied — paste into claude' : 'ready to copy'}
          </span>
          <Button onClick={onCopy}>
            {copied ? (
              <><Check className="h-4 w-4 mr-2" aria-hidden="true" /> copied</>
            ) : (
              <><Copy className="h-4 w-4 mr-2" aria-hidden="true" /> copy prompt</>
            )}
          </Button>
        </div>
        <span role="status" aria-live="polite" className="sr-only">
          {copied ? 'help prompt copied to clipboard' : ''}
        </span>
      </DialogContent>
    </Dialog>
  );
}
