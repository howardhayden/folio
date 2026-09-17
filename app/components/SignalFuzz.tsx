type BackgroundStaticFilterProps = {
  animated?: boolean;
  id: string;
};

function BackgroundStaticFilter({ animated = false, id }: BackgroundStaticFilterProps) {
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
        baseFrequency="0.52 0.66"
        numOctaves="1"
        seed="11"
        stitchTiles="stitch"
        result="static-noise"
      >
        {animated ? (
          <animate
            attributeName="seed"
            values="11;23;37;53;71;89;107;11"
            dur=".1s"
            calcMode="discrete"
            repeatCount="indefinite"
          />
        ) : null}
      </feTurbulence>
      <feColorMatrix
        in="static-noise"
        type="matrix"
        values={`0 0 0 0 1
                 0 0 0 0 1
                 0 0 0 0 1
                 .2126 .7152 .0722 0 0`}
        result="static-luminance"
      />
      <feComponentTransfer in="static-luminance" result="front-static">
        <feFuncA type="discrete" tableValues=".02 .06 .11 .18" />
      </feComponentTransfer>
      <feComposite
        in="front-static"
        in2="SourceAlpha"
        operator="in"
        result="clipped-static"
      />
      <feComposite in="clipped-static" in2="SourceGraphic" operator="over" />
    </filter>
  );
}

export function BackgroundStaticDefs() {
  return (
    <svg
      className="background-static-defs"
      width="0"
      height="0"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <BackgroundStaticFilter id="background-gradient-green-blue-static" />
        <BackgroundStaticFilter id="background-gradient-green-blue-static-animated" animated />
      </defs>
    </svg>
  );
}
