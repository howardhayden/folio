"use client";

import { useEffect, useMemo, useRef } from "react";
import { AsciiArt } from "./AsciiArt";
import { createNaturalSwatFrames } from "./asciiArmMotion.js";

export function NaturalSwatAsciiArt({
  art,
  description,
}: {
  art: string;
  description?: string;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const naturalSwatFrames = useMemo(
    () => createNaturalSwatFrames(art) as Record<string, string>,
    [art],
  );

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const pre = wrapper?.querySelector<HTMLPreElement>(
      "pre[data-ascii-frame]",
    );
    if (!pre) return;

    const applyNaturalArm = () => {
      const poseName = pre.dataset.asciiFrame;
      const correctedFrame = poseName
        ? naturalSwatFrames[poseName]
        : undefined;
      if (correctedFrame && pre.textContent !== correctedFrame) {
        pre.textContent = correctedFrame;
      }
    };

    const observer = new MutationObserver(applyNaturalArm);
    observer.observe(pre, {
      attributes: true,
      attributeFilter: ["data-ascii-frame"],
    });
    applyNaturalArm();

    return () => observer.disconnect();
  }, [naturalSwatFrames]);

  return (
    <div
      ref={wrapperRef}
      data-ascii-arm="raised-bent-elbow"
      data-ascii-pen="rear-right"
      style={{ minWidth: 0, width: "100%" }}
    >
      <AsciiArt art={art} description={description} />
    </div>
  );
}
