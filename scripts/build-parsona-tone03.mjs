import { createRequire } from 'node:module';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const sharpModule = process.env.PARSONA_SHARP_MODULE ?? 'sharp';
const sharp = require(sharpModule);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const geometry = JSON.parse(
  await readFile(path.join(root, 'artwork/parsona-v2/source/tone_03.geometry.json'), 'utf8'),
);

const { primary, shadow, highlight } = geometry.palette.skin;
const { feature, eyeWhite, iris } = geometry.palette.features;

const shared = {
  neck: '<path d="M424 674 C424 730 418 810 408 864 Q512 876 616 864 C606 810 600 730 600 674 Z"/>',
  ears: [
    '<path d="M303 378 C286 360 255 360 255 430 C255 500 277 548 304 532 L322 468 L318 398 Z"/>',
    '<path d="M721 378 C738 360 769 360 769 430 C769 500 747 548 720 532 L702 468 L706 398 Z"/>',
  ].join(''),
  shadow: [
    '<path d="M304 365 Q325 338 348 350 Q339 379 342 410 Q319 400 304 365 Z" opacity=".20"/>',
    '<path d="M255 430 C255 500 277 548 304 532 L310 503 C288 510 282 466 286 408 C272 402 260 411 255 430 Z" opacity=".42"/>',
    '<path d="M769 430 C769 500 747 548 720 532 L714 503 C736 510 742 466 738 408 C752 402 764 411 769 430 Z" opacity=".28"/>',
    '<path d="M424 674 Q512 710 600 674 Q584 718 512 724 Q440 718 424 674 Z" opacity=".42"/>',
  ].join(''),
  highlight: '<path d="M438 214 Q462 202 486 216 Q470 236 446 242 Z" opacity=".18"/>',
  underBrow: [
    '<path d="M360 358 Q400 346 440 358 Q420 368 400 368 Q380 368 360 358 Z" fill="' + shadow + '" opacity=".16"/>',
    '<path d="M584 358 Q624 346 664 358 Q644 368 624 368 Q604 368 584 358 Z" fill="' + shadow + '" opacity=".16"/>',
  ].join(''),
  eyes: [
    '<path d="M358.5 390 C371 376.5 386 375.5 400 375.5 C414 375.5 429 376.5 441.5 390 C429 404.5 414 404.5 400 404.5 C386 404.5 371 403.5 358.5 390 Z" fill="' + eyeWhite + '"/>',
    '<ellipse cx="400" cy="390" rx="11" ry="12" fill="' + iris + '"/>',
    '<ellipse cx="400" cy="390" rx="5" ry="6" fill="' + feature + '"/>',
    '<path d="M582.5 390 C595 376.5 610 375.5 624 375.5 C638 375.5 653 376.5 665.5 390 C653 404.5 638 404.5 624 404.5 C610 404.5 595 403.5 582.5 390 Z" fill="' + eyeWhite + '"/>',
    '<ellipse cx="624" cy="390" rx="11" ry="12" fill="' + iris + '"/>',
    '<ellipse cx="624" cy="390" rx="5" ry="6" fill="' + feature + '"/>',
  ].join(''),
  nose: [
    '<path d="M503 447 Q510 476 506 505 Q500 515 489 520 Q501 483 503 447 Z" fill="' + shadow + '" opacity=".48"/>',
    '<path d="M514 466 Q520 494 536 515 Q524 522 513 516 Q518 493 514 466 Z" fill="' + highlight + '" opacity=".36"/>',
    '<path d="M488 519 Q497 526 506 521 Q499 530 489 527 Z" fill="' + shadow + '" opacity=".50"/>',
    '<path d="M518 521 Q527 526 536 519 L535 527 Q525 530 518 521 Z" fill="' + shadow + '" opacity=".50"/>',
  ].join(''),
};

const variants = {
  feminine: {
    head: '<path d="M512 108 C390 108 300 181 300 300 L300 480 C300 585 374 660 512 700 C650 660 724 585 724 480 L724 300 C724 181 634 108 512 108 Z"/>',
    contours: [
      '<path d="M336 500 Q356 548 407 586 Q375 575 348 544 Z" fill="' + shadow + '" opacity=".34"/>',
      '<path d="M688 500 Q668 548 617 586 Q649 575 676 544 Z" fill="' + shadow + '" opacity=".22"/>',
      '<path d="M430 650 Q512 680 594 650 Q562 687 512 696 Q462 687 430 650 Z" fill="' + highlight + '" opacity=".23"/>',
      '<path d="M483 626 Q512 634 541 626 Q530 641 512 643 Q494 641 483 626 Z" fill="' + shadow + '" opacity=".18"/>',
    ].join(''),
    brows: [
      '<path d="M354 340 Q400 320 446 338" fill="none" stroke="' + feature + '" stroke-width="10" stroke-linecap="round" opacity=".78"/>',
      '<path d="M578 338 Q624 320 670 340" fill="none" stroke="' + feature + '" stroke-width="10" stroke-linecap="round" opacity=".78"/>',
    ].join(''),
    lips: [
      '<path d="M470 598 Q488 590 512 596 Q536 590 554 598 Q535 607 512 606 Q489 607 470 598 Z" fill="' + shadow + '" opacity=".72"/>',
      '<path d="M474 602 Q493 611 512 609 Q531 611 550 602 Q540 621 512 623 Q484 621 474 602 Z" fill="' + highlight + '" opacity=".52"/>',
      '<path d="M501 603 Q512 606 523 603 Q512 610 501 603 Z" fill="' + feature + '" opacity=".42"/>',
    ].join(''),
  },
  masculine: {
    head: '<path d="M512 108 C390 108 300 181 300 300 L300 492 C300 600 356 664 512 700 C668 664 724 600 724 492 L724 300 C724 181 634 108 512 108 Z"/>',
    contours: [
      '<path d="M328 497 Q356 568 425 615 Q381 604 345 557 Z" fill="' + shadow + '" opacity=".40"/>',
      '<path d="M696 497 Q668 568 599 615 Q643 604 679 557 Z" fill="' + shadow + '" opacity=".29"/>',
      '<path d="M410 643 Q512 679 614 643 Q578 688 512 697 Q446 688 410 643 Z" fill="' + shadow + '" opacity=".20"/>',
      '<path d="M485 626 Q512 634 539 626 Q530 640 512 642 Q494 640 485 626 Z" fill="' + shadow + '" opacity=".20"/>',
    ].join(''),
    brows: [
      '<path d="M350 338 Q400 324 450 338" fill="none" stroke="' + feature + '" stroke-width="12" stroke-linecap="round" opacity=".86"/>',
      '<path d="M574 338 Q624 324 674 338" fill="none" stroke="' + feature + '" stroke-width="12" stroke-linecap="round" opacity=".86"/>',
    ].join(''),
    lips: [
      '<path d="M473 598 Q492 592 512 597 Q532 592 551 598 Q533 605 512 605 Q491 605 473 598 Z" fill="' + shadow + '" opacity=".76"/>',
      '<path d="M477 602 Q495 608 512 607 Q529 608 547 602 Q538 616 512 618 Q486 616 477 602 Z" fill="' + highlight + '" opacity=".38"/>',
      '<path d="M502 603 Q512 606 522 603 Q512 609 502 603 Z" fill="' + feature + '" opacity=".44"/>',
    ].join(''),
  },
};

function svgFor(variant) {
  const styled = variants[variant];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    <g shape-rendering="geometricPrecision">
      <g fill="${primary}">${shared.neck}${shared.ears}${styled.head}</g>
      <g fill="${shadow}">${shared.shadow}</g>
      <g fill="${highlight}">${shared.highlight}</g>
      ${styled.contours}
      ${styled.brows}
      ${shared.underBrow}
      ${shared.eyes}
      ${shared.nose}
      ${styled.lips}
    </g>
  </svg>`;
}

for (const variant of ['feminine', 'masculine']) {
  const master = path.join(root, `artwork/parsona-v2/masters/bases/${variant}/tone_03.png`);
  const runtime = path.join(root, `public/parsona-v2/bases/${variant}/tone_03.webp`);
  await mkdir(path.dirname(master), { recursive: true });
  await mkdir(path.dirname(runtime), { recursive: true });
  const source = Buffer.from(svgFor(variant));
  const raster = sharp(source, { density: 96 }).resize(1024, 1024);
  await raster.clone().png({ compressionLevel: 9, palette: false }).toFile(master);
  await raster.clone().webp({ quality: 96, alphaQuality: 100, smartSubsample: true }).toFile(runtime);
}
