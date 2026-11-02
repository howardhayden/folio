import type { CSSProperties } from "react";

export function TerminalProgressBar({ percent }: Readonly<{ percent: number }>) {
  return (
    <div className="teaching-manifest-track" aria-hidden="true">
      <span className="teaching-manifest-fill" style={{ "--teaching-support": `${percent}%` } as CSSProperties}>
        <span className="teaching-manifest-caret" />
      </span>
    </div>
  );
}
