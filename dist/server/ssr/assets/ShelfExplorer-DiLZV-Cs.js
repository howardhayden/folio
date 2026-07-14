import { t as Link } from "./link-CKajqAad.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { Fragment as Fragment$1, jsx, jsxs } from "react/jsx-runtime";
//#region app/components/SiteChrome.tsx
function SiteHeader({ shelfSearch }) {
	return /* @__PURE__ */ jsxs("nav", {
		className: "navbar navbar-expand navbar-light bg-light",
		"aria-label": "Primary navigation",
		children: [/* @__PURE__ */ jsx("a", {
			className: "navbar-brand",
			href: "#",
			children: "HAH"
		}), /* @__PURE__ */ jsx("div", {
			className: "collapse navbar-collapse",
			id: "navbarNav",
			children: /* @__PURE__ */ jsxs("ul", {
				className: "navbar-nav",
				children: [
					/* @__PURE__ */ jsx("li", {
						className: "nav-item",
						children: /* @__PURE__ */ jsx(Link, {
							className: "nav-link",
							href: "/",
							children: "Home"
						})
					}),
					/* @__PURE__ */ jsx("li", {
						className: "nav-item",
						children: /* @__PURE__ */ jsx(Link, {
							className: "nav-link",
							href: "/resume",
							children: "Resume"
						})
					}),
					/* @__PURE__ */ jsx("li", {
						className: "nav-item",
						children: /* @__PURE__ */ jsx(Link, {
							className: "nav-link",
							href: "/tools",
							children: "Tools"
						})
					}),
					/* @__PURE__ */ jsx("li", {
						className: "nav-item",
						children: /* @__PURE__ */ jsx(Link, {
							className: "nav-link",
							href: "/shelf",
							children: "Shelf"
						})
					}),
					shelfSearch
				]
			})
		})]
	});
}
//#endregion
//#region app/shelf/ShelfExplorer.tsx
var MONTH_CODES = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec"
];
var formatDate = (value) => {
	const sourceDate = value.trim();
	const fullDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(sourceDate);
	if (fullDate) {
		const [, year, monthText, dayText] = fullDate;
		const month = Number(monthText);
		const day = Number(dayText);
		const candidate = new Date(Date.UTC(Number(year), month - 1, day));
		return candidate.getUTCFullYear() === Number(year) && candidate.getUTCMonth() === month - 1 && candidate.getUTCDate() === day ? `${dayText} ${MONTH_CODES[month - 1]} ${year}` : sourceDate;
	}
	const monthDate = /^(\d{4})-(\d{2})$/.exec(sourceDate);
	if (monthDate) {
		const [, year, monthText] = monthDate;
		const month = Number(monthText);
		return month >= 1 && month <= 12 ? `${MONTH_CODES[month - 1]} ${year}` : sourceDate;
	}
	return sourceDate;
};
var shuffle = (items) => {
	const shuffled = [...items];
	for (let currentIndex = shuffled.length; currentIndex > 0;) {
		const randomIndex = Math.floor(Math.random() * currentIndex);
		currentIndex -= 1;
		[shuffled[currentIndex], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[currentIndex]];
	}
	return shuffled;
};
function ShelfExplorer({ papers }) {
	const [open, setOpen] = useState(false);
	const [language, setLanguage] = useState("");
	const [publisher, setPublisher] = useState("");
	const [author, setAuthor] = useState("");
	const [collection, setCollection] = useState("");
	const [hydrated, setHydrated] = useState(false);
	const menuRef = useRef(null);
	useEffect(() => {
		const frame = window.requestAnimationFrame(() => setHydrated(true));
		return () => window.cancelAnimationFrame(frame);
	}, []);
	useEffect(() => {
		const handlePointer = (event) => {
			if (open && menuRef.current && !menuRef.current.contains(event.target)) setOpen(false);
		};
		const handleKey = (event) => event.key === "Escape" && setOpen(false);
		document.addEventListener("mousedown", handlePointer);
		document.addEventListener("keydown", handleKey);
		return () => {
			document.removeEventListener("mousedown", handlePointer);
			document.removeEventListener("keydown", handleKey);
		};
	}, [open]);
	const filtered = useMemo(() => {
		const includes = (values, needle) => !needle || values.join(", ").toLowerCase().includes(needle.toLowerCase());
		const matches = papers.filter((paper) => includes(paper.languages, language) && includes(paper.publishers, publisher) && includes(paper.authors, author) && includes(paper.collections, collection));
		return hydrated ? shuffle(matches) : matches;
	}, [
		author,
		collection,
		hydrated,
		language,
		papers,
		publisher
	]);
	return /* @__PURE__ */ jsxs(Fragment$1, { children: [
		/* @__PURE__ */ jsx("noscript", { dangerouslySetInnerHTML: { __html: "<style>.nav-btn#navbarDropdown{display:none}</style>" } }),
		/* @__PURE__ */ jsx(SiteHeader, { shelfSearch: /* @__PURE__ */ jsxs("li", {
			className: `nav-item dropdown ${open ? "show" : ""}`,
			ref: menuRef,
			children: [/* @__PURE__ */ jsx("button", {
				type: "button",
				className: "nav-btn nav-link dropdown-toggle",
				id: "navbarDropdown",
				"aria-haspopup": "true",
				"aria-expanded": open,
				onClick: (event) => {
					event.stopPropagation();
					setOpen((value) => !value);
				},
				children: "Search"
			}), /* @__PURE__ */ jsx("div", {
				className: `dropdown-menu dropdown-menu-right ${open ? "show" : ""}`,
				"aria-labelledby": "navbarDropdown",
				children: /* @__PURE__ */ jsxs("form", {
					onSubmit: (event) => event.preventDefault(),
					children: [
						/* @__PURE__ */ jsx(SearchField, {
							id: "languageInput",
							label: "Language",
							placeholder: " Search Language",
							value: language,
							onChange: setLanguage
						}),
						/* @__PURE__ */ jsx(SearchField, {
							id: "publisherInput",
							label: "Search Publisher",
							placeholder: " Search Publisher",
							value: publisher,
							onChange: setPublisher
						}),
						/* @__PURE__ */ jsx(SearchField, {
							id: "authorInput",
							label: "Search Author",
							placeholder: " Search Author",
							value: author,
							onChange: setAuthor
						}),
						/* @__PURE__ */ jsx(SearchField, {
							id: "collectionInput",
							label: "Search Collection",
							placeholder: " Search Collection",
							value: collection,
							onChange: setCollection
						})
					]
				})
			})]
		}) }),
		/* @__PURE__ */ jsx("main", {
			className: open ? "container mt-4 shelf-page shelf-page-is-blurred" : "container mt-4 shelf-page",
			children: /* @__PURE__ */ jsxs("div", {
				className: "row",
				children: [/* @__PURE__ */ jsxs("aside", {
					className: "col-lg-3 shelf-intro",
					children: [/* @__PURE__ */ jsx("h1", {
						className: "text-center",
						children: "Shelf"
					}), /* @__PURE__ */ jsx("p", { children: "The following materials contain insightful value per their associated collections. They do not reflect my views or those of any employers or associated organizations." })]
				}), /* @__PURE__ */ jsxs("section", {
					className: "col-lg-9",
					"aria-label": `${filtered.length} shelf results`,
					children: [/* @__PURE__ */ jsx("div", {
						id: "papershelf",
						className: "card-columns",
						children: filtered.map((paper) => /* @__PURE__ */ jsx("article", {
							className: "card",
							children: /* @__PURE__ */ jsxs("div", {
								className: "card-body",
								children: [/* @__PURE__ */ jsx("h5", {
									className: "card-title",
									children: paper.title
								}), /* @__PURE__ */ jsxs("dl", {
									className: "paper-meta",
									children: [
										/* @__PURE__ */ jsx(Meta, {
											label: "Language",
											value: paper.languages.join(", ")
										}),
										/* @__PURE__ */ jsx(Meta, {
											label: "Publisher",
											value: paper.publishers.join(", ")
										}),
										/* @__PURE__ */ jsx(Meta, {
											label: "Date",
											value: formatDate(paper.date)
										}),
										/* @__PURE__ */ jsx(Meta, {
											label: "Author(s)",
											value: paper.authors.join(", ")
										}),
										/* @__PURE__ */ jsx(Meta, {
											label: "Collection(s)",
											value: paper.collections.join(", ")
										})
									]
								})]
							})
						}, paper.title))
					}), filtered.length === 0 && /* @__PURE__ */ jsx("p", {
						className: "text-center shelf-empty",
						role: "status",
						children: "No materials match all four fields."
					})]
				})]
			})
		})
	] });
}
function SearchField({ id, label, placeholder, value, onChange }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "form-group",
		children: [/* @__PURE__ */ jsx("label", {
			htmlFor: id,
			children: label
		}), /* @__PURE__ */ jsx("input", {
			type: "text",
			className: "form-control px-0 px-sm-2",
			id,
			placeholder,
			value,
			onChange: (event) => onChange(event.target.value)
		})]
	});
}
function Meta({ label, value }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "paper-meta-item",
		children: [/* @__PURE__ */ jsx("dt", { children: label }), /* @__PURE__ */ jsx("dd", { children: value })]
	});
}
//#endregion
export { ShelfExplorer as default };
