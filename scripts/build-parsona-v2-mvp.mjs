import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const sharp = require(process.env.PARSONA_SHARP_MODULE ?? 'sharp');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const styles = ['feminine', 'masculine'];

const colors = {
  navy: '#06162D',
  navyLift: '#0A2342',
  ink: '#151923',
  inkLift: '#252C3A',
  blue: '#1D4F91',
  blueLift: '#2E6EB8',
  ivory: '#E9E3DA',
  glass: '#A8D8E8',
};

const svg = body => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    <g shape-rendering="geometricPrecision">${body}</g>
  </svg>`,
);

const assets = [{
  runtime: 'backgrounds/parqueen_navy.webp',
  master: 'backgrounds/parqueen_navy.png',
  source: svg(`
    <rect width="1024" height="1024" fill="${colors.navy}"/>
    <circle cx="512" cy="430" r="405" fill="${colors.navyLift}" opacity=".28"/>
    <path d="M0 890 Q512 820 1024 890 V1024 H0Z" fill="#030812" opacity=".22"/>
  `),
}];

for (const style of styles) {
  const feminine = style === 'feminine';
  assets.push(
    {
      runtime: `hair/${style}/short_fade.back.webp`,
      master: `hair/${style}/short_fade.back.png`,
      source: svg(`
        <path d="M292 315 Q276 410 296 493 L322 477 Q310 405 326 332Z" fill="${colors.ink}"/>
        <path d="M732 315 Q748 410 728 493 L702 477 Q714 405 698 332Z" fill="${colors.ink}"/>
        <path d="M360 612 Q512 675 664 612 Q635 704 512 724 Q389 704 360 612Z" fill="${colors.ink}" opacity=".72"/>
      `),
    },
    {
      runtime: `hair/${style}/short_fade.front.webp`,
      master: `hair/${style}/short_fade.front.png`,
      source: svg(`
        <path d="M308 298 Q315 156 424 112 Q512 76 600 112 Q709 156 716 298
          Q668 252 614 238 Q560 224 512 238 Q464 224 410 238 Q356 252 308 298Z"
          fill="${colors.ink}"/>
        <path d="M330 267 Q386 166 512 146 Q638 166 694 267 Q632 225 512 224 Q392 225 330 267Z"
          fill="${colors.inkLift}" opacity=".64"/>
        <path d="M312 296 Q330 272 352 260 L342 340 Q322 331 304 318Z" fill="${colors.ink}"/>
        <path d="M712 296 Q694 272 672 260 L682 340 Q702 331 720 318Z" fill="${colors.ink}"/>
      `),
    },
    {
      runtime: `hair/${style}/long_hair.back.webp`,
      master: `hair/${style}/long_hair.back.png`,
      source: svg(`
        <path d="M512 78 Q332 78 258 238 Q218 330 234 495 L206 820
          Q292 887 385 824 Q448 874 512 842 Q576 874 639 824 Q732 887 818 820
          L790 495 Q806 330 766 238 Q692 78 512 78Z" fill="${colors.ink}"/>
        <path d="M288 258 Q246 454 286 758 Q328 815 374 792 Q338 522 372 246Z"
          fill="${colors.inkLift}" opacity=".58"/>
        <path d="M736 258 Q778 454 738 758 Q696 815 650 792 Q686 522 652 246Z"
          fill="${colors.inkLift}" opacity=".36"/>
      `),
    },
    {
      runtime: `hair/${style}/long_hair.front.webp`,
      master: `hair/${style}/long_hair.front.png`,
      source: svg(`
        <path d="M512 82 Q380 78 310 184 Q282 228 278 320
          Q330 264 394 238 Q456 213 512 230 Q568 213 630 238 Q694 264 746 320
          Q742 228 714 184 Q644 78 512 82Z" fill="${colors.ink}"/>
        <path d="M278 304 Q302 276 334 252 Q316 432 344 592 Q320 636 286 650
          Q258 490 278 304Z" fill="${colors.ink}"/>
        <path d="M746 304 Q722 276 690 252 Q708 432 680 592 Q704 636 738 650
          Q766 490 746 304Z" fill="${colors.ink}"/>
        <path d="M354 211 Q430 122 512 132 Q594 122 670 211 Q590 176 512 198
          Q434 176 354 211Z" fill="${colors.inkLift}" opacity=".62"/>
        ${feminine
          ? `<path d="M299 372 Q278 512 306 604 Q326 570 335 526 Q316 430 332 326Z" fill="${colors.inkLift}" opacity=".52"/>`
          : `<path d="M725 372 Q746 512 718 604 Q698 570 689 526 Q708 430 692 326Z" fill="${colors.inkLift}" opacity=".42"/>`}
      `),
    },
    {
      runtime: `tops/${style}/crew_neck.webp`,
      master: `tops/${style}/crew_neck.png`,
      source: svg(`
        <path d="M132 1024 V890 Q154 816 278 788 L407 758
          Q426 806 512 824 Q598 806 617 758 L746 788 Q870 816 892 890 V1024Z"
          fill="${colors.ivory}"/>
        <path d="M407 758 Q427 824 512 838 Q597 824 617 758
          Q586 806 512 812 Q438 806 407 758Z" fill="#C6BFB6"/>
        <path d="M132 930 Q246 862 360 850 L330 1024 H132Z" fill="#D8D1C8" opacity=".64"/>
        <path d="M892 930 Q778 862 664 850 L694 1024 H892Z" fill="#FFFFFF" opacity=".28"/>
      `),
    },
    {
      runtime: `tops/${style}/hoodie.webp`,
      master: `tops/${style}/hoodie.png`,
      source: svg(`
        <path d="M118 1024 V902 Q150 812 302 780 L412 754
          Q438 798 512 810 Q586 798 612 754 L722 780 Q874 812 906 902 V1024Z"
          fill="${colors.blue}"/>
        <path d="M302 780 Q340 700 423 680 L438 788 Q368 824 332 900Z" fill="#173F75"/>
        <path d="M722 780 Q684 700 601 680 L586 788 Q656 824 692 900Z" fill="#173F75"/>
        <path d="M412 754 Q436 824 512 838 Q588 824 612 754
          Q572 786 512 790 Q452 786 412 754Z" fill="${colors.blueLift}"/>
        <path d="M478 802 L470 946" stroke="${colors.ivory}" stroke-width="8" stroke-linecap="round" opacity=".72"/>
        <path d="M546 802 L554 946" stroke="${colors.ivory}" stroke-width="8" stroke-linecap="round" opacity=".72"/>
        <circle cx="470" cy="950" r="10" fill="${colors.ivory}"/>
        <circle cx="554" cy="950" r="10" fill="${colors.ivory}"/>
      `),
    },
    {
      runtime: `accessories/${style}/round_glasses.webp`,
      master: `accessories/${style}/round_glasses.png`,
      source: svg(`
        <circle cx="400" cy="390" r="58" fill="${colors.glass}" opacity=".10"
          stroke="#263342" stroke-width="13"/>
        <circle cx="624" cy="390" r="58" fill="${colors.glass}" opacity=".10"
          stroke="#263342" stroke-width="13"/>
        <path d="M458 390 Q512 368 566 390" fill="none" stroke="#263342" stroke-width="12" stroke-linecap="round"/>
        <path d="M342 382 L300 370" fill="none" stroke="#263342" stroke-width="12" stroke-linecap="round"/>
        <path d="M682 382 L724 370" fill="none" stroke="#263342" stroke-width="12" stroke-linecap="round"/>
        <path d="M370 366 Q396 346 430 364" fill="none" stroke="#5D7B91" stroke-width="5" opacity=".58"/>
        <path d="M594 366 Q620 346 654 364" fill="none" stroke="#5D7B91" stroke-width="5" opacity=".58"/>
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
  await raster.clone().webp({ quality: 94, alphaQuality: 100, smartSubsample: true }).toFile(runtime);
}
