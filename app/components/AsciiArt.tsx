"use client";

import { useEffect, useRef } from "react";

export function AsciiArt({ art }: { art: string }) {
  const preRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const pre = preRef.current;
    const container = pre?.parentElement;
    if (!pre || !container) return;

    const maxChars = Math.max(...art.split("\n").map((line) => line.length));
    let disposed = false;
    let frame = 0;
    const resize = () => {
      const containerBox = container.getBoundingClientRect();
      const containerStyle = window.getComputedStyle(container);
      const paddingLeft = Number.parseFloat(containerStyle.paddingLeft);
      const paddingRight = Number.parseFloat(containerStyle.paddingRight);
      const contentCenter = (containerBox.left + paddingLeft + containerBox.right - paddingRight) / 2;
      const pageSafeWidth = 2 * Math.max(0, Math.min(contentCenter, window.innerWidth - contentCenter)) * 0.98;
      const intendedFontSize = (container.offsetWidth / maxChars) * 1.82;
      const probe = pre.cloneNode(true) as HTMLPreElement;

      probe.removeAttribute("aria-label");
      probe.removeAttribute("title");
      probe.setAttribute("aria-hidden", "true");
      Object.assign(probe.style, {
        fontSize: "100px",
        maxWidth: "none",
        pointerEvents: "none",
        position: "absolute",
        transition: "none",
        visibility: "hidden",
        whiteSpace: "pre",
        width: "max-content",
      });
      container.appendChild(probe);
      const referenceWidth = probe.getBoundingClientRect().width;
      probe.remove();

      if (referenceWidth > 0 && pageSafeWidth > 0) {
        const intendedWidth = (referenceWidth / 100) * intendedFontSize;
        const safetyScale = Math.min(1, pageSafeWidth / intendedWidth);
        pre.style.fontSize = `${intendedFontSize * safetyScale}px`;
      }
    };
    const scheduleResize = () => {
      if (disposed) return;
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(resize);
    };
    scheduleResize();

    const observer = new ResizeObserver(scheduleResize);
    observer.observe(container);
    void document.fonts?.ready.then(scheduleResize);
    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [art]);

  return <pre ref={preRef} aria-label="ASCII art" title="A guy sitting beneath a tree, interacting with a tablet">{art}</pre>;
}
