import tailwindcss from "@tailwindcss/postcss";

const BOOTSTRAP_SOURCE_MAP_COMMENT = "# sourceMappingURL=bootstrap.min.css.map";

export function stripBootstrapSourceMapReference() {
  return {
    postcssPlugin: "hah-strip-bootstrap-source-map-reference",
    Once(root) {
      root.walkComments((comment) => {
        if (comment.text.trim() === BOOTSTRAP_SOURCE_MAP_COMMENT) comment.remove();
      });
    },
  };
}

const config = {
  plugins: [tailwindcss(), stripBootstrapSourceMapReference()],
};

export default config;
