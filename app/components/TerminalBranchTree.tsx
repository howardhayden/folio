import type { ToolBranch } from "../data";

function branchPrefix(ancestorContinues: readonly boolean[], isLast: boolean) {
  const ancestors = ancestorContinues
    .map((continues) => (continues ? "│  " : "   "))
    .join("");

  return `${ancestors}${isLast ? "└─ " : "├─ "}`;
}

function notePrefix(ancestorContinues: readonly boolean[], branchContinues: boolean) {
  return [...ancestorContinues, branchContinues]
    .map((continues) => (continues ? "│  " : "   "))
    .join("");
}

export function TerminalBranchTree({
  branches,
  ancestorContinues = [],
}: Readonly<{
  branches: readonly ToolBranch[];
  ancestorContinues?: readonly boolean[];
}>) {
  const nested = ancestorContinues.length > 0;

  return (
    <ul className={nested ? "tool-branch-children" : "tool-branch-list"}>
      {branches.map((branch, index) => {
        const isLast = index === branches.length - 1;
        const continues = !isLast;

        return (
          <li className="tool-branch-node" key={`${branch.label}-${index}`}>
            <div className="tool-branch-line">
              <span className="tool-branch-prefix" aria-hidden="true">
                {branchPrefix(ancestorContinues, isLast)}
              </span>
              <span className="tool-branch-label">{branch.label}</span>
            </div>

            {branch.notes?.length ? (
              <ul className="tool-branch-notes" aria-label={`${branch.label} details`}>
                {branch.notes.map((note, noteIndex) => (
                  <li className="tool-branch-note" key={`${branch.label}-note-${noteIndex}`}>
                    <div className="tool-branch-line tool-branch-note-line">
                      <span className="tool-branch-prefix" aria-hidden="true">
                        {notePrefix(ancestorContinues, continues)}
                      </span>
                      <span className="tool-branch-label">{note}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}

            {branch.children?.length ? (
              <TerminalBranchTree
                branches={branch.children}
                ancestorContinues={[...ancestorContinues, continues]}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
