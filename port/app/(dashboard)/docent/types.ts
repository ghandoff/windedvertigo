export type Platform = 'mac' | 'windows';

export type CommandBlock = {
  /** Optional label shown above the command block */
  label?: string;
  /** The literal command a user will copy into their terminal */
  command: string;
  /** Optional note rendered below the block */
  note?: string;
};

export type AccountChecklistItem = {
  label: string;
  /** URL to open to sign up */
  href: string;
  /** Short instruction rendered next to the link */
  instruction: string;
  /** Whether garrett needs to invite this person after they sign up */
  requiresInvite?: boolean;
};

export type StepContent = {
  /** Intro paragraph(s) rendered at the top of the step */
  intro?: string;
  /** Ordered body: strings become paragraphs, CommandBlocks become terminal blocks, AccountChecklists render a checklist */
  body: Array<
    | { kind: 'paragraph'; text: string }
    | { kind: 'heading'; text: string }
    | { kind: 'commands'; commands: CommandBlock[] }
    | { kind: 'accounts'; items: AccountChecklistItem[] }
    | { kind: 'callout'; tone: 'info' | 'warn' | 'success' | 'tip'; text: string }
    | { kind: 'download'; label: string; href: string; note?: string }
    | { kind: 'output'; label?: string; text: string; note?: string }
    | { kind: 'claudePrompt'; label?: string; prompt: string; note?: string }
  >;
  /** Text describing what "done" looks like for this step (for the user's own satisfaction) */
  doneLooksLike?: string;
  /** The pre-written prompt to paste into Claude Code if the user gets stuck */
  helpPrompt: string;
};

export type Step = {
  id: string;
  title: string;
  /** Shown under the title as a one-liner */
  subtitle: string;
  /** Content that's the same regardless of platform */
  shared?: StepContent;
  /** Platform-specific content, merged with shared content in order: shared intro → platform intro → shared body → platform body */
  platforms?: Partial<Record<Platform, StepContent>>;
  /** If true, the step is skipped in the navigation count (used for welcome/platform-pick/celebration) */
  meta?: boolean;
};
