import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const sharp = require(process.env.PARSONA_SHARP_MODULE ?? 'sharp');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const styles = ['feminine', 'masculine'];
const PREMIUM_MVP_ARTWORK_VERSION = 2;

const colors = {
  navy: '#06162D',
  navyLift: '#0D294A',
  navyGlow: '#123B65',
  ink: '#111319',
  inkLift: '#292B33',
  inkLight: '#41424A',
  blue: '#163F78',
  blueLift: '#245B9E',
  blueShade: '#0D2B55',
  charcoal: '#202630',
  charcoalLift: '#353D49',
  gold: '#C99343',
  cyan: '#5CB8D1',
};

const svg = body => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    <g shape-rendering="geometricPrecision">${body}</g>
  </svg>`,
);

const waveGroups = (side, feminine) => {
  const mirror = side === 'right' ? 'translate(1024 0) scale(-1 1)' : '';
  const opacity = feminine ? '.72' : '.62';
  return `<g transform="${mirror}" fill="none" stroke-linecap="round">
    <path d="M286 244 C226 348 290 426 250 520 C214 606 264 702 224 816" stroke="${colors.inkLift}" stroke-width="30" opacity="${opacity}"/>
    <path d="M324 228 C270 344 334 432 292 536 C258 622 310 704 274 824" stroke="${colors.inkLight}" stroke-width="15" opacity=".48"/>
    <path d="M366 222 C318 342 372 434 334 548 C306 632 346 712 318 824" stroke="#54545B" stroke-width="8" opacity=".32"/>
    <path d="M268 318 C320 366 320 430 278 482" stroke="#07090D" stroke-width="18" opacity=".65"/>
    <path d="M286 560 C342 614 330 686 286 746" stroke="#07090D" stroke-width="16" opacity=".58"/>
  </g>`;
};

const coilTexture = (feminine) => {
  const scale = feminine ? 1 : 1.02;
  const circles = [];
  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 9 - (row % 2); col += 1) {
      const cx = 356 + col * 39 + (row % 2) * 20;
      const cy = 118 + row * 31;
      const radius = 25 - row * 1.2;
      circles.push(`<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${(row + col) % 3 === 0 ? colors.inkLight : colors.inkLift}"/>`);
      circles.push(`<path d="M${cx - radius * .55} ${cy + 2} Q${cx} ${cy - radius * .7} ${cx + radius * .55} ${cy + 2}" fill="none" stroke="#080A0D" stroke-width="7" opacity=".72"/>`);
    }
  }
  return `<g transform="translate(${512 * (1 - scale)} 0) scale(${scale} 1)">${circles.join('')}</g>`;
};

const garmentConstruction = {
  crew: (feminine) => {
    const shoulder = feminine ? 142 : 118;
    return `
      <path d="M${shoulder} 1024 V916 Q164 828 298 792 L407 748 Q425 780 446 804 Q477 824 512 828 Q547 824 578 804 Q599 780 617 748 L726 792 Q860 828 ${1024 - shoulder} 916 V1024Z" fill="${colors.charcoal}"/>
      <path d="M407 748 Q430 798 512 830 Q594 798 617 748 Q584 783 512 790 Q440 783 407 748Z" fill="#111722"/>
      <path d="M432 753 Q452 794 512 808 Q572 794 592 753 Q568 820 512 836 Q456 820 432 753Z" fill="${colors.charcoalLift}"/>
      <path d="M${shoulder} 944 Q255 862 380 844 L344 1024 H${shoulder}Z" fill="#151B24" opacity=".72"/>
      <path d="M${1024 - shoulder} 944 Q769 862 644 844 L680 1024 H${1024 - shoulder}Z" fill="${colors.charcoalLift}" opacity=".38"/>
      <path d="M296 811 Q350 850 379 921" fill="none" stroke="${colors.charcoalLift}" stroke-width="10" opacity=".46"/>
      <path d="M728 811 Q674 850 645 921" fill="none" stroke="#111722" stroke-width="10" opacity=".38"/>`;
  },
  hoodie: (feminine) => {
    const shoulder = feminine ? 126 : 104;
    return `
      <path d="M${shoulder} 1024 V914 Q154 822 296 784 L400 738 Q425 780 450 801 Q480 817 512 820 Q544 817 574 801 Q599 780 624 738 L728 784 Q870 822 ${1024 - shoulder} 914 V1024Z" fill="${colors.blue}"/>
      <path d="M292 787 Q326 680 425 646 L454 776 Q365 814 316 906Z" fill="${colors.blueShade}"/>
      <path d="M732 787 Q698 680 599 646 L570 776 Q659 814 708 906Z" fill="#102F5C"/>
      <path d="M322 790 Q361 704 421 676 L441 765 Q378 798 340 858Z" fill="${colors.blueLift}" opacity=".62"/>
      <path d="M702 790 Q663 704 603 676 L583 765 Q646 798 684 858Z" fill="${colors.navyLift}" opacity=".56"/>
      <path d="M400 738 Q433 806 512 832 Q591 806 624 738 Q580 780 512 788 Q444 780 400 738Z" fill="${colors.blueLift}"/>
      <path d="M475 802 C478 850 472 901 468 950" fill="none" stroke="#D6C9AE" stroke-width="6" stroke-linecap="round"/>
      <path d="M549 802 C546 850 552 901 556 950" fill="none" stroke="#D6C9AE" stroke-width="6" stroke-linecap="round"/>
      <rect x="461" y="946" width="14" height="29" rx="7" fill="${colors.gold}"/>
      <rect x="549" y="946" width="14" height="29" rx="7" fill="${colors.gold}"/>
      <path d="M${shoulder} 944 Q246 864 367 846 L332 1024 H${shoulder}Z" fill="${colors.blueShade}" opacity=".52"/>
      <path d="M${1024 - shoulder} 944 Q778 864 657 846 L692 1024 H${1024 - shoulder}Z" fill="${colors.blueLift}" opacity=".28"/>`;
  },
};

const assets = [{
  runtime: 'backgrounds/parqueen_navy.webp',
  master: 'backgrounds/parqueen_navy.png',
  source: svg(`
    <rect width="1024" height="1024" fill="${colors.navy}"/>
    <circle cx="512" cy="410" r="388" fill="${colors.navyLift}" opacity=".40"/>
    <circle cx="512" cy="410" r="306" fill="${colors.navyGlow}" opacity=".13"/>
    <path d="M0 900 Q512 836 1024 900 V1024 H0Z" fill="#020711" opacity=".25"/>
  `),
}];

for (const style of styles) {
  const feminine = style === 'feminine';
  assets.push(
    {
      runtime: `hair/${style}/short_fade.back.webp`,
      master: `hair/${style}/short_fade.back.png`,
      source: svg(`
        <path d="M302 250 Q282 344 294 449 L321 438 Q314 334 337 259Z" fill="#11141A"/>
        <path d="M722 250 Q742 344 730 449 L703 438 Q710 334 687 259Z" fill="#11141A"/>
        <path d="M309 286 Q297 364 309 419" fill="none" stroke="${colors.inkLight}" stroke-width="11" opacity=".48"/>
        <path d="M715 286 Q727 364 715 419" fill="none" stroke="${colors.inkLight}" stroke-width="11" opacity=".38"/>
      `),
    },
    {
      runtime: `hair/${style}/short_fade.front.webp`,
      master: `hair/${style}/short_fade.front.png`,
      source: svg(`
        <path d="M307 285 Q310 183 360 132 Q419 72 512 78 Q605 72 664 132 Q714 183 717 285
          Q672 256 626 244 Q565 229 512 241 Q459 229 398 244 Q352 256 307 285Z" fill="${colors.ink}"/>
        ${coilTexture(feminine)}
        <path d="M318 275 Q368 244 420 237 Q466 232 512 242 Q558 232 604 237 Q656 244 706 275"
          fill="none" stroke="#090B0F" stroke-width="16" stroke-linecap="round"/>
        <path d="M317 285 Q326 272 342 263 L337 328 Q321 324 307 309Z" fill="${colors.ink}"/>
        <path d="M707 285 Q698 272 682 263 L687 328 Q703 324 717 309Z" fill="${colors.ink}"/>
      `),
    },
    {
      runtime: `hair/${style}/long_hair.back.webp`,
      master: `hair/${style}/long_hair.back.png`,
      source: svg(`
        <path d="M512 66 Q338 62 258 209 Q214 291 224 444 L196 846
          Q250 891 319 862 Q370 901 425 861 Q468 889 512 865 Q556 889 599 861
          Q654 901 705 862 Q774 891 828 846 L800 444 Q810 291 766 209 Q686 62 512 66Z"
          fill="${colors.ink}"/>
        ${waveGroups('left', feminine)}
        ${waveGroups('right', feminine)}
        <path d="M401 108 Q337 191 330 300 Q327 389 365 470" fill="none" stroke="#080A0E" stroke-width="25" opacity=".75"/>
        <path d="M623 108 Q687 191 694 300 Q697 389 659 470" fill="none" stroke="#080A0E" stroke-width="25" opacity=".75"/>
      `),
    },
    {
      runtime: `hair/${style}/long_hair.front.webp`,
      master: `hair/${style}/long_hair.front.png`,
      source: svg(`
        <path d="M512 68 Q404 65 329 148 Q285 198 273 292
          Q326 245 390 220 Q453 194 500 222 L512 244 L524 222 Q571 194 634 220
          Q698 245 751 292 Q739 198 695 148 Q620 65 512 68Z" fill="${colors.ink}"/>
        <path d="M500 84 Q462 119 433 175 Q465 155 500 159Z" fill="${colors.inkLight}" opacity=".52"/>
        <path d="M524 84 Q562 119 591 175 Q559 155 524 159Z" fill="${colors.inkLift}" opacity=".66"/>
        <path d="M275 282 Q319 242 360 222 Q318 334 349 430 Q373 506 335 584 Q322 620 318 666
          Q274 636 267 570 Q251 412 275 282Z" fill="${colors.ink}"/>
        <path d="M749 282 Q705 242 664 222 Q706 334 675 430 Q651 506 689 584 Q702 620 706 666
          Q750 636 757 570 Q773 412 749 282Z" fill="${colors.ink}"/>
        <path d="M315 278 C281 375 348 431 307 516 C285 561 320 604 342 624" fill="none" stroke="${colors.inkLight}" stroke-width="16" opacity=".55"/>
        <path d="M709 278 C743 375 676 431 717 516 C739 561 704 604 682 624" fill="none" stroke="${colors.inkLift}" stroke-width="16" opacity=".58"/>
        <path d="M365 211 Q428 128 500 111" fill="none" stroke="#55555C" stroke-width="9" opacity=".38"/>
        <path d="M659 211 Q596 128 524 111" fill="none" stroke="#3C3D45" stroke-width="9" opacity=".44"/>
      `),
    },
    {
      runtime: `tops/${style}/crew_neck.webp`,
      master: `tops/${style}/crew_neck.png`,
      source: svg(garmentConstruction.crew(feminine)),
    },
    {
      runtime: `tops/${style}/hoodie.webp`,
      master: `tops/${style}/hoodie.png`,
      source: svg(garmentConstruction.hoodie(feminine)),
    },
    {
      runtime: `accessories/${style}/round_glasses.webp`,
      master: `accessories/${style}/round_glasses.png`,
      source: svg(`
        <ellipse cx="400" cy="390" rx="49" ry="44" fill="${colors.cyan}" opacity=".055"
          stroke="${colors.gold}" stroke-width="7"/>
        <ellipse cx="624" cy="390" rx="49" ry="44" fill="${colors.cyan}" opacity=".055"
          stroke="${colors.gold}" stroke-width="7"/>
        <path d="M449 390 Q512 370 575 390" fill="none" stroke="${colors.gold}" stroke-width="7" stroke-linecap="round"/>
        <path d="M351 385 Q326 378 299 368" fill="none" stroke="${colors.gold}" stroke-width="7" stroke-linecap="round"/>
        <path d="M673 385 Q698 378 725 368" fill="none" stroke="${colors.gold}" stroke-width="7" stroke-linecap="round"/>
        <path d="M366 370 Q397 352 428 368" fill="none" stroke="#F0C779" stroke-width="3" opacity=".55"/>
        <path d="M596 368 Q627 352 658 370" fill="none" stroke="#F0C779" stroke-width="3" opacity=".55"/>
      `),
    },
  );
}

for (const asset of assets) {
  const master = path.join(root, 'artwork/parsona-v2/masters', asset.master);
  const runtime = path.join(root, 'public/parsona-v2', asset.runtime);
  await mkdir(path.dirname(master), { recursive: true });
  await mkdir(path.dirname(runtime), { recursive: true });
  const raster = sharp(asset.source, { density: 96 }).resize(1024, 1024);
  await raster.clone().png({ compressionLevel: 9, palette: false }).toFile(master);
  await raster.clone().webp({ quality: 96, alphaQuality: 100, smartSubsample: true }).toFile(runtime);
}

void PREMIUM_MVP_ARTWORK_VERSION;
