// The Khanbogd Khurd coach, drawn side-on and facing right: white body, long dark window band,
// black windscreen, roof vents, wheel arches with silver rims. Coordinates are in a 200 x 72 box.
// Used inside other <svg> elements; colours come from CSS variables so it works on any background.
export default function BusArt() {
  return <g className="bus-art">
    <ellipse className="bus-shadow" cx="100" cy="66.5" rx="88" ry="3.4" />
    <path className="bus-hull" d="M5 52V22Q5 12 15 12H150Q163 12 170 22L188 44Q192 50 188 54H11Q5 54 5 52Z" />
    <path className="bus-roofcap" d="M38 12Q42 6.5 56 6.5H146Q155 6.5 161 12Z" />
    {[0, 1, 2, 3].map(i => <rect key={i} className="bus-vent" x={66 + i * 15} y="8.4" width="10" height="2" rx="1" />)}
    <rect className="bus-glass" x="19" y="19" width="127" height="17" rx="3" />
    {[52, 83, 114].map(x => <rect key={x} className="bus-pillar" x={x} y="19" width="2.2" height="17" />)}
    <path className="bus-glass" d="M149 18H165Q170 18 173 23L185 42H149Z" />
    <path className="bus-shine" d="M152 20H162L157 38H152Z" />
    <path className="bus-wave" d="M26 43Q40 34 58 40Q42 38 26 43Z" />
    <rect className="bus-logo" x="64" y="40.5" width="30" height="3" rx="1.5" />
    <rect className="bus-seam" x="98" y="44" width="1.4" height="9" /><rect className="bus-seam" x="128" y="44" width="1.4" height="9" />
    <rect className="bus-bumper" x="176" y="48" width="14" height="6" rx="2" />
    <path className="bus-arch" d="M30.5 54A14.5 14.5 0 0 1 59.5 54Z" /><path className="bus-arch" d="M120.5 54A14.5 14.5 0 0 1 149.5 54Z" />
    <circle className="bus-headlight" cx="185.5" cy="47" r="2.5" />
    {[45, 135].map(cx => <g key={cx} className="bus-wheel">
      <circle className="tyre" cx={cx} cy="54" r="10.5" /><circle className="rim" cx={cx} cy="54" r="6.4" /><circle className="hub" cx={cx} cy="54" r="2" />
      <path d={`M${cx} 48V60M${cx - 6} 54H${cx + 6}`} />
    </g>)}
  </g>
}
