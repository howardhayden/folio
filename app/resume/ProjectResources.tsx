type ProjectResource = Readonly<{
  label: string;
  cardLabel?: string;
  contributorName?: string;
  kind?: string;
  opensInNewTab?: boolean;
  url: string;
}>;

type ProjectResourceGroup = Readonly<{
  ariaLabel: string;
  label: "Documentation" | "Contributor(s)";
  resources: readonly ProjectResource[];
  type: "documentation" | "contributors";
}>;

function externalLinkAttributes(opensInNewTab: boolean) {
  return opensInNewTab
    ? { target: "_blank" as const, rel: "noopener noreferrer" }
    : {};
}

export default function ProjectResources({
  projectName,
  resources,
}: Readonly<{
  projectName: string;
  resources: readonly ProjectResource[];
}>) {
  if (!resources.length) return null;

  const documents = resources.filter((resource) => resource.kind !== "contributor");
  const contributors = resources.filter(
    (resource) => resource.kind === "contributor" && Boolean(resource.contributorName),
  );
  const groups: ProjectResourceGroup[] = [];
  if (documents.length) {
    groups.push({
      ariaLabel: `${projectName} documentation`,
      label: "Documentation",
      resources: documents,
      type: "documentation",
    });
  }
  if (contributors.length) {
    groups.push({
      ariaLabel: `${projectName} contributors`,
      label: "Contributor(s)",
      resources: contributors,
      type: "contributors",
    });
  }

  return (
    <nav className="project-resources" aria-label={`${projectName} related links`}>
      <ul className="project-resource-list">
        {groups.map((group, groupIndex) => {
          const isLastGroup = groupIndex === groups.length - 1;
          const childStem = isLastGroup ? "   " : "│  ";

          return (
            <li className="project-resource-node project-resource-group" key={group.type}>
              <div className="project-resource-line">
                <span className="project-resource-prefix" aria-hidden="true">
                  {isLastGroup ? "└─ " : "├─ "}
                </span>
                <span className="project-resource-label project-resource-group-label">
                  {group.label}
                </span>
              </div>
              <ul className="project-resource-children" aria-label={group.ariaLabel}>
                {group.resources.map((resource, index) => {
                  const opensInNewTab = resource.opensInNewTab === true;
                  const externalAttributes = externalLinkAttributes(opensInNewTab);
                  const isLast = index === group.resources.length - 1;
                  const visibleLabel = group.type === "contributors"
                    ? (resource.contributorName ?? resource.cardLabel ?? resource.label)
                    : (resource.cardLabel ?? resource.label);

                  return (
                    <li className="project-resource-node" key={`${resource.label}-${resource.url}`}>
                      <div className="project-resource-line">
                        <span className="project-resource-prefix" aria-hidden="true">
                          {`${childStem}${isLast ? "└─ " : "├─ "}`}
                        </span>
                        <a
                          className="project-resource-label signal-fuzz"
                          href={resource.url}
                          {...externalAttributes}
                          aria-label={opensInNewTab
                            ? `${visibleLabel}, opens in a new tab`
                            : visibleLabel}
                        >
                          {visibleLabel}
                        </a>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
