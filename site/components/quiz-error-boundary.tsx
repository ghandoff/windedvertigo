"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class QuizErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[quiz error]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            textAlign: "center",
            padding: "var(--space-3xl) var(--space-lg)",
            maxWidth: 480,
            margin: "0 auto",
          }}
        >
          <h2
            style={{
              fontSize: "1.4rem",
              fontWeight: 700,
              textTransform: "lowercase",
              marginBottom: "var(--space-md)",
              color: "var(--wv-white)",
            }}
          >
            something went sideways
          </h2>
          <p
            style={{
              fontSize: "0.95rem",
              color: "var(--text-secondary)",
              lineHeight: 1.6,
              marginBottom: "var(--space-xl)",
            }}
          >
            our quiz hit an unexpected snag. try refreshing the page — if
            it keeps happening, we&rsquo;d love to hear about it.
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false });
              window.location.reload();
            }}
            style={{
              padding: "12px 24px",
              background: "var(--accent, #b15043)",
              color: "#ffffff",
              border: "none",
              borderRadius: 4,
              fontSize: "0.9rem",
              fontFamily: "inherit",
              fontWeight: 700,
              textTransform: "lowercase",
              cursor: "pointer",
            }}
          >
            refresh &amp; try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
