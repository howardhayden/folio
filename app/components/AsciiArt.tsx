"use client";

import { useEffect, useRef } from "react";

export function AsciiArt({ art }: { art: string }) {
  const preRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const pre = preRef.current;
    const container = pre?.parentElement;
    if (!pre || !container) return;

    const maxChars = Math.max(...art.split("\n").map((line) => line.length));
    const resize = () => {
      pre.style.fontSize = `${(container.offsetWidth / maxChars) * 1.82}px`;
    };
    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [art]);

  return <pre ref={preRef} aria-label="ASCII art" title="A guy sitting beneath a tree, interacting with a tablet">{art}</pre>;
}
