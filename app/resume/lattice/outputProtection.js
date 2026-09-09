export function mayRevealLatticeOutput({
  documentHidden,
  windowFocused,
  printing,
  now,
  shieldUntil,
}) {
  return !documentHidden && windowFocused && !printing && now >= shieldUntil;
}

export function isLatticeClarificationTarget(target) {
  const element = target?.nodeType === 1 ? target : target?.parentElement;
  return Boolean(element?.closest?.(".lattice-clarification-input"));
}
