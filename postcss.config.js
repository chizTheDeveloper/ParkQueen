// autoprefixer is required for parity, not polish: the Tailwind Play CDN ran it
// too. Dropping it measurably changed the `transition-colors` utility (the CDN
// emitted `-webkit-text-decoration-color` in transition-property; a build
// without autoprefixer does not). Measured delta over the whole bundle is +1KB
// and five vendor-prefixed properties (-moz-column-gap, -moz-user-select,
// -o-object-fit, -o-tab-size, -webkit-text-decoration) — all additive, and it
// adds nothing to the hand-written rules in index.css beyond -moz-user-select
// and -o-object-fit.
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
