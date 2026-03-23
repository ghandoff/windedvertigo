"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  Fragment,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import type {
  ConferenceExperienceData,
  ConferenceScreen,
  ConferenceItem,
} from "@/lib/notion";

/* ── helpers ── */

/** Render text with newlines as <br /> elements (safe alternative to dangerouslySetInnerHTML) */
function TextWithBreaks({ text }: { text: string }) {
  const parts = text.split("\n");
  return (
    <>
      {parts.map((line, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {line}
        </Fragment>
      ))}
    </>
  );
}

/** Get items of a given type from a screen */
function itemsOf(screen: ConferenceScreen, type: string): ConferenceItem[] {
  return screen.items.filter((it) => it.itemType === type);
}

/* ══════════════════════════════════════════════
   PARTICLES
   ══════════════════════════════════════════════ */

function Particles({
  count,
  color,
  minSize,
  maxSize,
}: {
  count: number;
  color: string;
  minSize: number;
  maxSize: number;
}) {
  const [particles] = useState(() =>
    Array.from({ length: count }, (_, i) => ({
      key: i,
      size: minSize + Math.random() * (maxSize - minSize),
      left: Math.random() * 100,
      top: 40 + Math.random() * 60,
      po: (0.1 + Math.random() * 0.25).toString(),
      py: `${-(100 + Math.random() * 300)}px`,
      px: `${Math.random() * 60 - 30}px`,
      duration: `${8 + Math.random() * 12}s`,
      delay: `${Math.random() * 10}s`,
    })),
  );

  return (
    <div className="particles">
      {particles.map((p) => (
        <div
          key={p.key}
          className="particle"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.left}%`,
            top: `${p.top}%`,
            background: color,
            "--po": p.po,
            "--py": p.py,
            "--px": p.px,
            animationDuration: p.duration,
            animationDelay: p.delay,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════
   DRAGGABLE ELEMENT (Making Space)
   ══════════════════════════════════════════════ */

function DraggableElement({
  children,
  className,
  style,
}: {
  children?: React.ReactNode;
  className: string;
  style: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  const onDown = useCallback(
    (ex: number, ey: number) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      offsetRef.current = { x: ex - r.left, y: ey - r.top };
      setDragging(true);
    },
    [],
  );

  useEffect(() => {
    if (!dragging) return;
    const el = ref.current;
    if (!el) return;

    const onMove = (ex: number, ey: number) => {
      el.style.left = `${ex - offsetRef.current.x}px`;
      el.style.top = `${ey - offsetRef.current.y}px`;
      el.style.transform = "rotate(0deg)";
    };
    const handleMouseMove = (e: globalThis.MouseEvent) => onMove(e.clientX, e.clientY);
    const handleTouchMove = (e: globalThis.TouchEvent) => {
      const t = e.touches[0];
      onMove(t.clientX, t.clientY);
    };
    const handleUp = () => setDragging(false);

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleUp);
    document.addEventListener("touchmove", handleTouchMove, { passive: true });
    document.addEventListener("touchend", handleUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleUp);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleUp);
    };
  }, [dragging]);

  return (
    <div
      ref={ref}
      className={`${className}${dragging ? " dragging" : ""}`}
      style={style}
      onMouseDown={(e) => {
        e.preventDefault();
        onDown(e.clientX, e.clientY);
      }}
      onTouchStart={(e) => {
        const t = e.touches[0];
        onDown(t.clientX, t.clientY);
      }}
    >
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════════
   SCREEN RENDERERS
   ══════════════════════════════════════════════ */

function CoverScreen({
  screen,
  onGo,
}: {
  screen: ConferenceScreen;
  onGo: (i: number) => void;
}) {
  return (
    <>
      <Particles count={20} minSize={2} maxSize={5} color="rgba(203,120,88,0.3)" />
      <div className="cover-fade label">
        <TextWithBreaks text={screen.timeLabel || "experience design concept"} />
      </div>
      <h1 className="cover-fade">
        <TextWithBreaks text={screen.heading || "reimagining PEDAL Conference 2025"} />
      </h1>
      <div className="cover-fade sub">
        <TextWithBreaks text={screen.body || "same speakers. same themes. same venue.\ndifferent architecture around them."} />
      </div>
      <button className="enter" onClick={() => onGo(1)}>
        {screen.secondaryBody || "enter the day"}
      </button>
      <div className="foot">
        winded.vertigo &middot; PEDAL Centre, University of Cambridge &middot; 2025
      </div>
    </>
  );
}

function BeforeScreen({ screen }: { screen: ConferenceScreen }) {
  const appFeatures = itemsOf(screen, "app-feature");
  return (
    <div className="before-day">
      <div className="before-text">
        <div className="moment-time">
          <TextWithBreaks text={screen.timeLabel} />
        </div>
        <h2
          className="moment-speaker"
          style={{ fontSize: "clamp(24px,3.5vw,36px)" }}
        >
          <TextWithBreaks text={screen.heading} />
        </h2>
        <p className="moment-note">
          <TextWithBreaks text={screen.body} />
        </p>
        <p className="moment-detail" style={{ opacity: 1, animation: "none" }}>
          <TextWithBreaks text={screen.secondaryBody} />
        </p>
      </div>
      <div className="phone-mockup">
        <div className="phone-screen">
          <div className="app-header">PEDAL Conference 2025</div>
          <div className="app-badge">
            <div className="app-badge-circle">QR</div>
            <div className="app-badge-name">your conference page</div>
          </div>
          <div className="app-features">
            {appFeatures.map((f) => (
              <div key={f.id} className="app-feature">
                <span className="app-dot" /> {f.text}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function QuestionWallScreen({ screen }: { screen: ConferenceScreen }) {
  const wallCards = itemsOf(screen, "wall-card");
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [wallReady, setWallReady] = useState(false);
  const [questionHidden, setQuestionHidden] = useState(false);
  const [userCards, setUserCards] = useState<string[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (wallReady) return;
    setWallReady(true);
    const timer = setTimeout(() => setQuestionHidden(true), 2500);
    return () => clearTimeout(timer);
  }, [wallReady]);

  const addToWall = useCallback(() => {
    const val = inputRef.current?.value.trim();
    if (!val) return;
    setUserCards((prev) => [...prev, val]);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const cols = typeof window !== "undefined" ? Math.max(1, Math.floor((window.innerWidth) / 210)) : 4;

  return (
    <>
      <div className="wall-time">
        <TextWithBreaks text={screen.timeLabel} />
      </div>
      <div
        className="wall-question"
        style={{ opacity: questionHidden ? 0 : undefined }}
      >
        <TextWithBreaks text={screen.heading} />
      </div>
      <div className="wall-surface" ref={surfaceRef}>
        {wallCards.map((c, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const colW = typeof window !== "undefined" ? window.innerWidth / cols : 210;
          return (
            <div
              key={c.id}
              className={`wc${c.isChildVoice ? " child" : ""}`}
              style={{
                left: `${col * colW + 15 + Math.random() * 20}px`,
                top: `${40 + row * 160 + Math.random() * 30}px`,
                "--d": `${i * 0.15}s`,
                "--r": `${Math.random() * 5 - 2.5}deg`,
              } as React.CSSProperties}
            >
              {c.text}
              <div className="wc-attr">&mdash; {c.secondaryText}</div>
            </div>
          );
        })}
        {userCards.map((text, i) => (
          <div
            key={`user-${i}`}
            className="wc"
            style={{
              left: `${20 + Math.random() * 60}%`,
              top: `${10 + Math.random() * 50}%`,
              "--d": "0s",
              "--r": `${Math.random() * 5 - 2.5}deg`,
              zIndex: 10,
            } as React.CSSProperties}
          >
            {text}
            <div className="wc-attr">&mdash; you</div>
          </div>
        ))}
      </div>
      <div className="wall-prompt">
        <textarea
          ref={inputRef}
          placeholder="add yours to the wall\u2026"
          rows={2}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              addToWall();
            }
          }}
        />
        <button onClick={addToWall}>pin</button>
      </div>
    </>
  );
}

function SpeakerScreen({ screen }: { screen: ConferenceScreen }) {
  const ghosts = itemsOf(screen, "ghost-card");
  const positions = [
    { left: "5%", top: "8%", r: "-2deg" },
    { right: "8%", top: "12%", r: "1deg" },
    { left: "3%", top: "40%", r: "-1deg" },
    { right: "4%", top: "55%", r: "3deg" },
    { left: "10%", bottom: "20%", r: "-3deg" },
    { right: "12%", bottom: "25%", r: "2deg" },
    { left: "60%", top: "5%", r: "1deg" },
    { right: "30%", bottom: "10%", r: "-1deg" },
    { left: "25%", bottom: "8%", r: "2deg" },
  ];

  return (
    <div className="morgan-scene">
      {ghosts.map((g, i) => {
        const pos = positions[i % positions.length];
        const { r, ...cssPos } = pos;
        return (
          <div
            key={g.id}
            className="ghost-card"
            style={{ ...cssPos, "--r": r } as unknown as React.CSSProperties}
          >
            {g.text}
          </div>
        );
      })}
      <div className="morgan-center">
        <div className="moment-time">
          <TextWithBreaks text={screen.timeLabel} />
        </div>
        <div className="moment-speaker">
          <TextWithBreaks text={screen.heading} />
        </div>
        <div className="moment-note">
          <TextWithBreaks text={screen.body} />
        </div>
        {screen.secondaryBody && (
          <div className="moment-detail">
            <TextWithBreaks text={screen.secondaryBody} />
          </div>
        )}
      </div>
    </div>
  );
}

function MakingSpaceScreen({ screen }: { screen: ConferenceScreen }) {
  const childrenCards = itemsOf(screen, "children-card");
  const colours = [
    "#b15043", "#273248", "#cb7858", "#b15043", "#273248",
    "#cb7858", "#43b187", "#436db1", "#58cbb2", "#5872cb",
  ];
  const blockSizes = [
    { w: 110, h: 70 }, { w: 130, h: 55 }, { w: 85, h: 85 },
    { w: 150, h: 50 }, { w: 95, h: 95 }, { w: 120, h: 60 },
    { w: 80, h: 80 }, { w: 140, h: 45 }, { w: 90, h: 100 },
    { w: 115, h: 70 },
  ];

  return (
    <>
      <div className="time-badge">
        <TextWithBreaks text={screen.timeLabel} />
      </div>
      <div className="bench-brief">
        <TextWithBreaks text={screen.heading} />
      </div>
      <div className="bench">
        {childrenCards.map((c, i) => (
          <DraggableElement
            key={c.id}
            className="material mat-card"
            style={{
              "--r": `${Math.random() * 10 - 5}deg`,
              left: `${40 + i * 220}px`,
              top: `${60 + Math.random() * 80}px`,
            } as React.CSSProperties}
          >
            &ldquo;{c.text}&rdquo;
            <div className="mc-attr">&mdash; {c.secondaryText}</div>
          </DraggableElement>
        ))}
        {blockSizes.map((sz, i) => (
          <DraggableElement
            key={`block-${i}`}
            className="material mat-block"
            style={{
              width: sz.w,
              height: sz.h,
              background: colours[i % colours.length],
              borderRadius: `${2 + Math.random() * 6}px`,
              left: `${30 + Math.random() * 600}px`,
              top: `${180 + Math.random() * 200}px`,
              transform: `rotate(${Math.random() * 25 - 12}deg)`,
              opacity: 0.7 + Math.random() * 0.3,
            }}
          />
        ))}
        {Array.from({ length: 6 }, (_, i) => (
          <DraggableElement
            key={`tube-${i}`}
            className="material mat-tube"
            style={{
              width: `${80 + Math.random() * 100}px`,
              height: `${10 + Math.random() * 14}px`,
              background: colours[(i + 3) % colours.length],
              opacity: 0.4 + Math.random() * 0.3,
              left: `${60 + Math.random() * 500}px`,
              top: `${200 + Math.random() * 200}px`,
              transform: `rotate(${Math.random() * 40 - 20}deg)`,
            }}
          />
        ))}
      </div>
      <div className="bench-note">
        <TextWithBreaks text={screen.body} />
      </div>
    </>
  );
}

function HallOfMirrorsScreen({ screen }: { screen: ConferenceScreen }) {
  const lenses = itemsOf(screen, "lens-card");
  const positions = [
    { left: "6%", top: "12%" },
    { right: "6%", top: "16%" },
    { left: "4%", bottom: "28%" },
    { right: "4%", bottom: "24%" },
  ];

  return (
    <>
      <div className="time-badge">
        <TextWithBreaks text={screen.timeLabel} />
      </div>
      <div className="table-scene">
        <div className="table-top">
          <div className="table-question">
            <TextWithBreaks text={screen.heading} />
          </div>
        </div>
        {lenses.map((l, i) => (
          <div
            key={l.id}
            className="table-lens"
            style={{
              animationDelay: `${0.8 + i * 0.6}s`,
              ...positions[i % positions.length],
            }}
          >
            <div className="lens-role">{l.secondaryText}</div>
            <div className="lens-text">{l.text}</div>
          </div>
        ))}
      </div>
      <div className="scene-label">
        <TextWithBreaks text={screen.body} />
      </div>
    </>
  );
}

function DraperScreen({ screen }: { screen: ConferenceScreen }) {
  const voices = itemsOf(screen, "floating-voice");
  const yPositions = [15, 30, 50, 65, 82];

  return (
    <div className="draper-scene">
      <div className="draper-center">
        <div className="moment-time">
          <TextWithBreaks text={screen.timeLabel} />
        </div>
        <div className="moment-speaker">
          <TextWithBreaks text={screen.heading} />
        </div>
        <div className="moment-note">
          <TextWithBreaks text={screen.body} />
        </div>
      </div>
      {voices.map((v, i) => (
        <div
          key={v.id}
          className="floating-voice"
          style={{
            right: "8%",
            top: `${yPositions[i % yPositions.length]}%`,
            animationDelay: `${1 + i * 1.2}s`,
            animationDuration: `${7 + i * 0.5}s`,
            "--wx": `${-(20 + Math.random() * 40)}px`,
          } as React.CSSProperties}
        >
          &ldquo;{v.text}&rdquo;
          <div className="fv-age">&mdash; {v.secondaryText}</div>
        </div>
      ))}
    </div>
  );
}

function SessionChoiceScreen({
  screen,
  onGo,
}: {
  screen: ConferenceScreen;
  onGo: (i: number) => void;
}) {
  const doors = itemsOf(screen, "door");
  // Default next screen is current + 1
  return (
    <div className="door-choice">
      {doors.map((d, i) => (
        <Fragment key={d.id}>
          {i > 0 && <div className="door-divider" />}
          <button className="door" onClick={() => onGo(screen.order + 1)}>
            <div className="d-label">{d.secondaryText}</div>
            <h3>{d.text}</h3>
            <p>
              <TextWithBreaks text={d.url || ""} />
            </p>
            <div className="d-foot">both rooms are the right room.</div>
          </button>
        </Fragment>
      ))}
    </div>
  );
}

function CollageScreen({ screen }: { screen: ConferenceScreen }) {
  const fragments = itemsOf(screen, "collage-fragment");
  const [userFragments, setUserFragments] = useState<
    { text: string; x: number; y: number }[]
  >([]);
  const stripColours = [
    "var(--cadet)", "var(--redwood)", "var(--sienna)",
    "var(--mint)", "var(--lavender)",
  ];
  const positions = [
    { l: 3, t: 8 }, { l: 55, t: 5 }, { l: 30, t: 30 },
    { l: 70, t: 35 }, { l: 5, t: 55 }, { l: 50, t: 60 },
    { l: 75, t: 65 },
  ];

  const handleClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    const text = prompt("add something from this morning that is still with you:");
    if (!text?.trim()) return;
    setUserFragments((prev) => [
      ...prev,
      { text: text.trim(), x: e.clientX, y: e.clientY },
    ]);
  };

  return (
    <>
      <div className="collage-instruct">
        <TextWithBreaks text={screen.timeLabel} />
      </div>
      <div className="collage-surface" onClick={handleClick}>
        {fragments.map((f, i) => {
          const pos = positions[i % positions.length];
          return (
            <div
              key={f.id}
              className="c-fragment c-text"
              style={{
                left: `${pos.l}%`,
                top: `${pos.t}%`,
                color: f.variant === "primary" ? "var(--redwood)" : "var(--cadet)",
                fontSize: `${13 + Math.random() * 5}px`,
                fontStyle: f.isChildVoice ? "italic" : undefined,
                "--fr": `${Math.random() * 6 - 3}deg`,
                "--fx": `${Math.random() > 0.5 ? "" : "-"}${40 + Math.random() * 60}px`,
                "--fy": `${Math.random() > 0.5 ? "" : "-"}${20 + Math.random() * 40}px`,
                animationDelay: `${i * 0.4}s`,
              } as React.CSSProperties}
            >
              {f.text}
            </div>
          );
        })}
        {/* decorative strips */}
        {Array.from({ length: 10 }, (_, i) => (
          <div
            key={`strip-${i}`}
            className="c-fragment c-strip"
            style={{
              left: `${3 + Math.random() * 85}%`,
              top: `${3 + Math.random() * 85}%`,
              width: `${30 + Math.random() * 120}px`,
              background: stripColours[i % stripColours.length],
              "--o": (0.15 + Math.random() * 0.3).toString(),
              "--fr": `${Math.random() * 40 - 20}deg`,
              "--fx": `${Math.random() > 0.5 ? "80" : "-80"}px`,
              "--fy": "0px",
              animationDelay: `${0.2 + i * 0.15}s`,
            } as React.CSSProperties}
          />
        ))}
        {/* decorative circles */}
        {Array.from({ length: 8 }, (_, i) => {
          const sz = 8 + Math.random() * 35;
          return (
            <div
              key={`circle-${i}`}
              className="c-fragment c-circle"
              style={{
                width: sz,
                height: sz,
                left: `${8 + Math.random() * 80}%`,
                top: `${8 + Math.random() * 75}%`,
                background: stripColours[i % stripColours.length],
                "--o": (0.1 + Math.random() * 0.25).toString(),
                "--fr": "0deg",
                "--fx": "0px",
                "--fy": `${30 + Math.random() * 50}px`,
                animationDelay: `${0.5 + i * 0.2}s`,
              } as React.CSSProperties}
            />
          );
        })}
        {/* user-added fragments */}
        {userFragments.map((uf, i) => (
          <div
            key={`user-${i}`}
            className="c-fragment c-user"
            style={{
              left: uf.x,
              top: uf.y,
              position: "absolute",
              "--o": "0.9",
              "--fr": `${Math.random() * 4 - 2}deg`,
              "--fx": "0px",
              "--fy": "0px",
            } as React.CSSProperties}
          >
            {uf.text}
          </div>
        ))}
      </div>
      <div className="collage-hint">
        click anywhere on the surface, or type below and press enter.
      </div>
    </>
  );
}

function RiskyPlayScreen({ screen }: { screen: ConferenceScreen }) {
  const breathLines = itemsOf(screen, "breath-line");
  return (
    <div className="dark-scene">
      <div style={{ textAlign: "center" }}>
        {breathLines.map((bl, i) => (
          <div key={bl.id} className={`breath-line breath-${i + 1}`}>
            {bl.text}
          </div>
        ))}
      </div>
      <div className="dark-hold" />
      <div className="speaker-emerge">
        <div className="moment-time">
          <TextWithBreaks text={screen.timeLabel} />
        </div>
        <div className="moment-speaker" style={{ marginTop: 12 }}>
          <TextWithBreaks text={screen.heading} />
        </div>
        <div className="moment-note" style={{ marginTop: 20 }}>
          <TextWithBreaks text={screen.body} />
        </div>
        {screen.secondaryBody && (
          <div className="post-activity">
            <TextWithBreaks text={screen.secondaryBody} />
          </div>
        )}
      </div>
    </div>
  );
}

function TracksScreen({ screen }: { screen: ConferenceScreen }) {
  const tracks = itemsOf(screen, "track");
  const variantClass: Record<string, string> = {
    panel: "track-panel",
    quiet: "track-quiet",
    network: "track-network",
  };

  return (
    <>
      <div className="time-badge">
        <TextWithBreaks text={screen.timeLabel} />
      </div>
      <div className="tracks-container">
        {tracks.map((t) => (
          <div
            key={t.id}
            className={`track ${variantClass[t.variant] || ""}`}
          >
            <div className="track-label">{t.secondaryText}</div>
            <h3>{t.name}</h3>
            <p>
              <TextWithBreaks text={t.text} />
            </p>
          </div>
        ))}
      </div>
    </>
  );
}

function MappingScreen({ screen }: { screen: ConferenceScreen }) {
  const prompts = itemsOf(screen, "map-prompt");
  const positions = [
    { left: "10%", top: "35%" },
    { right: "10%", top: "40%" },
    { left: "25%", top: "65%" },
  ];

  return (
    <>
      <div className="time-badge">
        <TextWithBreaks text={screen.timeLabel} />
      </div>
      <div className="map-canvas">
        <div className="map-description">
          <h2>
            <TextWithBreaks text={screen.heading} />
          </h2>
          <p>
            <TextWithBreaks text={screen.body} />
          </p>
        </div>
        {prompts.map((p, i) => {
          const pos = positions[i % positions.length];
          return (
            <div
              key={p.id}
              className="map-prompt"
              style={{
                animationDelay: `${0.3 + i * 0.4}s`,
                ...pos,
              }}
            >
              <label>{p.text}</label>
              <textarea placeholder="write here\u2026" aria-label={p.text} />
            </div>
          );
        })}
        <div className="map-output">
          <TextWithBreaks text={screen.secondaryBody} />
        </div>
        <div className="map-timer">ten minutes. no debrief required.</div>
      </div>
    </>
  );
}

function ClosingScreen({ screen }: { screen: ConferenceScreen }) {
  const cascadeItems = itemsOf(screen, "cascade-item");

  return (
    <div className="closing-scene">
      {cascadeItems.map((a, i) => {
        const angle = (i / Math.max(cascadeItems.length, 1)) * Math.PI * 2 + Math.random() * 0.5;
        const radius = 180 + Math.random() * 160;
        return (
          <div
            key={a.id}
            className={`cascade-item${a.variant === "secondary" ? " cascade-voice" : ""}`}
            style={{
              animationDelay: `${0.2 + i * 0.18}s`,
              left: `calc(50% + ${Math.cos(angle) * radius}px)`,
              top: `calc(50% + ${Math.sin(angle) * radius}px)`,
              transform: "translate(-50%, -50%)",
            }}
          >
            {a.text}
          </div>
        );
      })}
      <div className="closing-center">
        <div className="moment-time">
          <TextWithBreaks text={screen.timeLabel} />
        </div>
        <div className="moment-speaker">
          <TextWithBreaks text={screen.heading} />
        </div>
        <div className="moment-note" style={{ marginTop: 12 }}>
          <TextWithBreaks text={screen.body} />
        </div>
        {screen.secondaryBody && (
          <div className="closing-final">
            <TextWithBreaks text={screen.secondaryBody} />
          </div>
        )}
      </div>
    </div>
  );
}

function CardFlipScreen({ screen }: { screen: ConferenceScreen }) {
  const [flipped, setFlipped] = useState(false);

  const toggle = useCallback(() => setFlipped((f) => !f), []);

  return (
    <div
      className={`card-flip-container${flipped ? " flipped" : ""}`}
      tabIndex={0}
      role="button"
      aria-label="card on your chair — press enter or click to flip"
      onClick={(e) => {
        if ((e.target as HTMLElement).tagName === "TEXTAREA") return;
        toggle();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
      }}
    >
      <div className="card-inner">
        <div className="card-front">
          <div className="card-q">
            <TextWithBreaks text={screen.heading} />
          </div>
          <textarea
            placeholder="write here, or don&apos;t."
            aria-label="your response"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="card-sub">
            <TextWithBreaks text={screen.body} />
          </div>
          <div className="card-flip-hint">click to turn over</div>
        </div>
        <div className="card-back">
          <div className="card-back-label">
            <TextWithBreaks text={screen.timeLabel || "GARDEN PARTY"} />
          </div>
          <div className="card-back-time">
            <TextWithBreaks text={screen.secondaryBody || "4:30 p.m. · the garden"} />
          </div>
          <div className="card-back-body">
            {screen.items
              .filter((it) => it.itemType === "cta-button")
              .map((it) => (
                <span key={it.id}>{it.text}</span>
              ))}
            {screen.items.filter((it) => it.itemType === "cta-button").length === 0 && (
              <span>
                if you want to stay in touch with people from today, the badge QR
                will have a simple directory in one week.
              </span>
            )}
          </div>
          <div className="card-flip-hint">click to turn back</div>
        </div>
      </div>
    </div>
  );
}

function GardenScreen({ screen }: { screen: ConferenceScreen }) {
  return (
    <div className="garden-scene">
      <div className="garden-center">
        <div className="garden-label">
          <TextWithBreaks text={screen.timeLabel} />
        </div>
        <div className="garden-title">
          <TextWithBreaks text={screen.heading} />
        </div>
        <div className="garden-note">
          <TextWithBreaks text={screen.body} />
        </div>
        {screen.secondaryBody && (
          <div className="garden-aside">
            <TextWithBreaks text={screen.secondaryBody} />
          </div>
        )}
      </div>
    </div>
  );
}

function DirectoryScreen({ screen }: { screen: ConferenceScreen }) {
  const sections = itemsOf(screen, "directory-section");
  const people = itemsOf(screen, "directory-person");
  const childrenVoices = screen.items.filter(
    (it) => it.itemType === "directory-item" && it.isChildVoice,
  );
  const nonChildItems = screen.items.filter(
    (it) => it.itemType === "directory-item" && !it.isChildVoice,
  );

  return (
    <div className="directory-mockup">
      <div className="dir-phone">
        <div className="dir-screen">
          <div className="dir-header">
            <TextWithBreaks text={screen.heading} />
          </div>
          {sections.map((s) => (
            <div key={s.id} className="dir-section">
              <div className="dir-section-label">{s.text}</div>
              {nonChildItems
                .filter((it) => it.secondaryText === s.text || it.variant === s.name)
                .map((it) => (
                  <div key={it.id} className="dir-item">
                    {it.text}
                  </div>
                ))}
            </div>
          ))}
          <div className="dir-prompt">return to something from the day</div>
          {people.length > 0 && (
            <div className="dir-section">
              <div className="dir-section-label">WHO WAS THERE</div>
              {people.map((p) => (
                <div key={p.id} className="dir-person">
                  {p.text}
                </div>
              ))}
            </div>
          )}
          {childrenVoices.length > 0 && (
            <div className="dir-section dir-children">
              <div className="dir-section-label">CHILDREN&apos;S VOICES</div>
              {childrenVoices.map((cv) => (
                <div key={cv.id} className="dir-item">
                  {cv.text}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CTAScreen({ screen }: { screen: ConferenceScreen }) {
  const serviceCards = itemsOf(screen, "service-card");
  const ctaButtons = itemsOf(screen, "cta-button");

  return (
    <div className="final-scene">
      <Particles count={15} minSize={2} maxSize={4} color="rgba(203,120,88,0.25)" />
      <div className="final-text">
        <div className="ft-body">
          <TextWithBreaks text={screen.body} />
        </div>
        <div className="ft-quote">
          <TextWithBreaks text={screen.secondaryBody} />
        </div>
        <div className="ft-wv">
          winded.vertigo &middot; windedvertigo.com &middot; hello@windedvertigo.com
        </div>
        <div className="ft-cta">
          <TextWithBreaks text={screen.heading} />
        </div>
      </div>
      {serviceCards.length > 0 && (
        <div className="services-section">
          <div className="services-label">
            some of the ways we work with conferences and events
          </div>
          <div className="services-grid">
            {serviceCards.map((sc) => (
              <div key={sc.id} className="service-card">
                <h4>{sc.name}</h4>
                <p>{sc.text}</p>
              </div>
            ))}
          </div>
          <div className="services-cta">
            {ctaButtons.map((b) => (
              <a
                key={b.id}
                href={b.url || "#"}
                className={`cta-btn${b.variant === "primary" ? " cta-primary" : ""}`}
                target={b.url?.startsWith("http") ? "_blank" : undefined}
                rel={b.url?.startsWith("http") ? "noopener" : undefined}
              >
                {b.text}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════
   SCREEN DISPATCHER
   ══════════════════════════════════════════════ */

function renderScreen(
  screen: ConferenceScreen,
  onGo: (i: number) => void,
) {
  switch (screen.screenType) {
    case "cover":
      return <CoverScreen screen={screen} onGo={onGo} />;
    case "before":
      return <BeforeScreen screen={screen} />;
    case "question-wall":
      return <QuestionWallScreen screen={screen} />;
    case "speaker":
      return <SpeakerScreen screen={screen} />;
    case "making-space":
      return <MakingSpaceScreen screen={screen} />;
    case "hall-of-mirrors":
      return <HallOfMirrorsScreen screen={screen} />;
    case "draper":
      return <DraperScreen screen={screen} />;
    case "session-choice":
      return <SessionChoiceScreen screen={screen} onGo={onGo} />;
    case "collage":
      return <CollageScreen screen={screen} />;
    case "risky-play":
      return <RiskyPlayScreen screen={screen} />;
    case "tracks":
      return <TracksScreen screen={screen} />;
    case "mapping":
      return <MappingScreen screen={screen} />;
    case "closing":
      return <ClosingScreen screen={screen} />;
    case "card-flip":
      return <CardFlipScreen screen={screen} />;
    case "garden":
      return <GardenScreen screen={screen} />;
    case "directory":
      return <DirectoryScreen screen={screen} />;
    case "cta":
      return <CTAScreen screen={screen} />;
    default:
      return (
        <div style={{ textAlign: "center", color: "#fff" }}>
          <p>Unknown screen type: {screen.screenType}</p>
        </div>
      );
  }
}

/* ══════════════════════════════════════════════
   MAIN CLIENT COMPONENT
   ══════════════════════════════════════════════ */

export function ConferenceClient({ data }: { data: ConferenceExperienceData }) {
  const { screens, agenda } = data;
  const [cur, setCur] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [narratorOn, setNarratorOn] = useState(true);
  const [agendaExpanded, setAgendaExpanded] = useState(true);
  const [mobileAgendaExpanded, setMobileAgendaExpanded] = useState(false);
  const [narratorDrawerExpanded, setNarratorDrawerExpanded] = useState(true);
  const prevRef = useRef(0);

  // Start narrator off on mobile
  useEffect(() => {
    if (window.innerWidth <= 768) {
      setNarratorOn(false);
      setNarratorDrawerExpanded(false);
    }
  }, []);

  const go = useCallback(
    (i: number) => {
      if (i < 0 || i >= screens.length || i === cur || transitioning) return;
      setTransitioning(true);
      prevRef.current = cur;
      setCur(i);
      setTimeout(() => setTransitioning(false), 800);
    },
    [cur, screens.length, transitioning],
  );

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") return;
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        go(cur + 1);
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(cur - 1);
      }
      if (e.key === "n" || e.key === "N") {
        setNarratorOn((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [cur, go]);

  // Close mobile agenda on outside click
  useEffect(() => {
    if (!mobileAgendaExpanded) return;
    const handler = (e: globalThis.MouseEvent) => {
      const el = document.getElementById("agenda-mobile-el");
      if (el && !el.contains(e.target as Node)) {
        setMobileAgendaExpanded(false);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [mobileAgendaExpanded]);

  const currentScreen = screens[cur];
  const prevScreen = screens[prevRef.current];
  const forward = cur > prevRef.current;

  // Find current agenda index
  const currentAgendaIdx = (() => {
    let best = 0;
    for (let i = agenda.length - 1; i >= 0; i--) {
      if (agenda[i].screenNumber <= cur) {
        best = i;
        break;
      }
    }
    return best;
  })();

  // Show nav on all screens except cover (first screen)
  // The Notion "Show Nav" checkbox defaults to unchecked (false), so we derive
  // visibility from screen position rather than relying on the checkbox value.
  const showNav = cur > 0;
  const narrator = currentScreen?.narratorText
    ? { scene: currentScreen.narratorScene, text: currentScreen.narratorText }
    : null;
  const showAgenda = cur !== 0 && cur !== screens.length - 1;

  return (
    <div className="conf-experience">
      {/* Progress bar */}
      <div
        className="conf-progress"
        style={{ width: `${(cur / Math.max(screens.length - 1, 1)) * 100}%` }}
      />

      {/* Screens */}
      {screens.map((screen, i) => {
        let className = "sc";
        if (screen.backgroundImageUrl) className += " sc-bg";
        className += ` screen-${screen.screenType}`;

        if (i === cur) {
          className += " active";
        } else if (transitioning && i === prevRef.current) {
          className += forward ? " exit-left" : " exit-right";
        }

        const bgStyle: React.CSSProperties = {};
        if (screen.backgroundImageUrl) {
          bgStyle.backgroundImage = `url(${screen.backgroundImageUrl})`;
        }

        return (
          <section
            key={screen.id}
            id={screen.screenId}
            className={className}
            aria-label={screen.ariaLabel}
            style={bgStyle}
          >
            {screen.backgroundOverlay && (
              <style>{`#${screen.screenId}.sc-bg::before { background: ${screen.backgroundOverlay}; }`}</style>
            )}
            {renderScreen(screen, go)}
          </section>
        );
      })}

      {/* Narrator toggle */}
      <button
        className="narrator-toggle"
        aria-pressed={narratorOn}
        aria-label="toggle narrator overlay"
        onClick={() => setNarratorOn((prev) => !prev)}
      >
        <span className="eye-icon">&#9673;</span> narrator
      </button>

      {/* Narrator overlay */}
      <div
        className={`narrator-overlay${!narrator || !narratorOn ? " hidden" : ""}${!narratorDrawerExpanded ? " narrator-collapsed" : ""}`}
        aria-live="polite"
      >
        <div
          className="narrator-scene"
          onClick={() => {
            if (window.innerWidth <= 768) {
              setNarratorDrawerExpanded((prev) => !prev);
            }
          }}
        >
          {narrator?.scene}
        </div>
        <div className="narrator-text">{narrator?.text}</div>
        <div className="narrator-hint">
          tap narrator (top-right) to hide this
        </div>
      </div>

      {/* Desktop agenda */}
      <nav
        className={`agenda-card${agendaExpanded ? "" : " collapsed"}`}
        role="navigation"
        aria-label="conference agenda"
        aria-hidden={!showAgenda}
      >
        <button
          className="agenda-toggle-btn"
          aria-expanded={agendaExpanded}
          onClick={() => setAgendaExpanded((prev) => !prev)}
        >
          {agendaExpanded ? "\u25BE agenda" : "\u25B8 agenda"}
        </button>
        <div className="agenda-body">
          <ul className="agenda-list">
            {agenda.map((a, i) => {
              let cls = "agenda-item";
              if (a.screenNumber < cur) cls += " done";
              else if (i === currentAgendaIdx) cls += " current";
              return (
                <li key={i}>
                  <button
                    className={cls}
                    tabIndex={0}
                    onClick={() => go(a.screenNumber)}
                  >
                    <span className="agenda-dot" />
                    <span className="agenda-time">{a.time}</span>
                    <span className="agenda-label">{a.label}</span>
                    <span className="paul-avatar">P</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      {/* Mobile agenda */}
      <nav
        id="agenda-mobile-el"
        className={`agenda-mobile${mobileAgendaExpanded ? " expanded" : ""}`}
        role="navigation"
        aria-label="conference agenda (mobile)"
        aria-hidden={!showAgenda}
      >
        <button
          className="agenda-mobile-toggle"
          aria-expanded={mobileAgendaExpanded}
          onClick={() => setMobileAgendaExpanded((prev) => !prev)}
        >
          <div className="agenda-mobile-current">
            <div className="paul-avatar-m">P</div>
            <span>
              {agenda[currentAgendaIdx]?.time} &mdash;{" "}
              {agenda[currentAgendaIdx]?.label}
            </span>
          </div>
          <span className="agenda-mobile-chevron">&#9656;</span>
        </button>
        <div className="agenda-mobile-body">
          <ul className="agenda-mobile-list">
            {agenda.map((a, i) => {
              let cls = "agenda-item";
              if (a.screenNumber < cur) cls += " done";
              else if (i === currentAgendaIdx) cls += " current";
              return (
                <li key={i}>
                  <button
                    className={cls}
                    tabIndex={0}
                    onClick={() => {
                      go(a.screenNumber);
                      setMobileAgendaExpanded(false);
                    }}
                  >
                    <span className="agenda-dot" />
                    <span className="agenda-time">{a.time}</span>
                    <span className="agenda-label">{a.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      {/* Nav bar */}
      <nav
        className={`conf-nav${showNav ? " visible" : ""}`}
        aria-label="screen navigation"
      >
        <button
          className="n-btn"
          disabled={cur === 0}
          aria-label="previous screen"
          onClick={() => go(cur - 1)}
        >
          &larr; back
        </button>
        <div>
          <span className="n-time">{currentScreen?.navTime}</span>
          <span className="n-label">{currentScreen?.navLabel}</span>
        </div>
        <button
          className="n-btn"
          disabled={cur === screens.length - 1}
          aria-label="next screen"
          onClick={() => go(cur + 1)}
        >
          next &rarr;
        </button>
      </nav>
    </div>
  );
}
