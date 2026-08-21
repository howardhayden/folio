type FilmGrainFilterProps = {
  animated?: boolean;
  id: string;
};

function FilmGrainFilter({ animated = false, id }: FilmGrainFilterProps) {
  return (
    <filter
      id={id}
      x="-10%"
      y="-10%"
      width="120%"
      height="120%"
      colorInterpolationFilters="sRGB"
    >
      <feTurbulence
        type="fractalNoise"
        baseFrequency="0.38 0.54"
        numOctaves="2"
        seed="11"
        stitchTiles="stitch"
        result="grain"
      >
        {animated ? (
          <animate
            attributeName="seed"
            values="11;23;37;53;11"
            dur=".48s"
            calcMode="discrete"
            repeatCount="indefinite"
          />
        ) : null}
      </feTurbulence>
      <feOffset in="grain" dx="0" dy="0" result="woven-grain">
        {animated ? (
          <>
            <animate
              attributeName="dx"
              values="0;.32;-.26;.18;0"
              keyTimes="0;.25;.5;.75;1"
              keySplines=".37 0 .63 1;.37 0 .63 1;.37 0 .63 1;.37 0 .63 1"
              dur="7.6s"
              calcMode="spline"
              repeatCount="indefinite"
            />
            <animate
              attributeName="dy"
              values="0;-.36;.44;-.28;0"
              keyTimes="0;.25;.5;.75;1"
              keySplines=".37 0 .63 1;.37 0 .63 1;.37 0 .63 1;.37 0 .63 1"
              dur="7.6s"
              calcMode="spline"
              repeatCount="indefinite"
            />
          </>
        ) : null}
      </feOffset>
      <feColorMatrix
        in="woven-grain"
        type="matrix"
        values={`.2126 .7152 .0722 0 0
                 .2126 .7152 .0722 0 0
                 .2126 .7152 .0722 0 0
                 .2126 .7152 .0722 0 0`}
        result="grain-luminance"
      />
      <feComponentTransfer in="grain-luminance" result="subtle-grain">
        <feFuncA type="linear" slope=".08" intercept=".008" />
      </feComponentTransfer>
      <feComposite
        in="subtle-grain"
        in2="SourceAlpha"
        operator="in"
        result="clipped-grain"
      />
      <feBlend
        in="SourceGraphic"
        in2="clipped-grain"
        mode="soft-light"
      />
    </filter>
  );
}

export function SignalFuzzDefs() {
  return (
    <svg
      className="signal-fuzz-defs"
      width="0"
      height="0"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <FilmGrainFilter id="signal-film-grain-static" />
        <FilmGrainFilter id="signal-film-grain" animated />
      </defs>
    </svg>
  );
}
