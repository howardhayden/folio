import { useEffect, useRef } from "react";
import { jsx } from "react/jsx-runtime";
//#region app/components/AsciiArt.tsx
function AsciiArt({ art }) {
	const preRef = useRef(null);
	useEffect(() => {
		const pre = preRef.current;
		const container = pre?.parentElement;
		if (!pre || !container) return;
		const maxChars = Math.max(...art.split("\n").map((line) => line.length));
		const resize = () => {
			pre.style.fontSize = `${container.offsetWidth / maxChars * 1.82}px`;
		};
		resize();
		const observer = new ResizeObserver(resize);
		observer.observe(container);
		return () => observer.disconnect();
	}, [art]);
	return /* @__PURE__ */ jsx("pre", {
		ref: preRef,
		"aria-label": "ASCII art",
		title: "A guy sitting beneath a tree, interacting with a tablet",
		children: art
	});
}
//#endregion
export { AsciiArt };
