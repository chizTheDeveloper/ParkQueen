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
  facePlanes: [
    '<path d="M326 420 Q350 465 381 485 Q351 493 326 475 Z" fill="' + shadow + '" opacity=".18"/>',
    '<path d="M698 420 Q674 465 643 485 Q673 493 698 475 Z" fill="' + shadow + '" opacity=".12"/>',
    '<path d="M458 282 Q512 260 566 282 Q535 298 512 297 Q489 298 458 282 Z" fill="' + highlight + '" opacity=".13"/>',
    '<path d="M456 520 Q512 542 568 520 Q550 562 512 570 Q474 562 456 520 Z" fill="' + highlight + '" opacity=".08"/>',
  ].join(''),
  underBrow: [
    '<path d="M360 358 Q400 346 440 358 Q420 368 400 368 Q380 368 360 358 Z" fill="' + shadow + '" opacity=".16"/>',
    '<path d="M584 358 Q624 346 664 358 Q644 368 624 368 Q604 368 584 358 Z" fill="' + shadow + '" opacity=".16"/>',
  ].join(''),
  eyes: [
    '<path d="M365 390 Q381 380 400 380 Q419 380 435 390 Q418 397 400 397 Q382 397 365 390 Z" fill="' + eyeWhite + '" opacity=".90"/>',
    '<ellipse cx="400" cy="389" rx="8.5" ry="9.5" fill="' + iris + '"/>',
    '<ellipse cx="400" cy="389" rx="4" ry="5" fill="' + feature + '"/>',
    '<path d="M365 390 Q381 378 400 379 Q419 378 435 390" fill="none" stroke="' + feature + '" stroke-width="4.5" stroke-linecap="round" opacity=".68"/>',
    '<path d="M371 397 Q400 403 429 397" fill="none" stroke="' + shadow + '" stroke-width="3" opacity=".24"/>',
    '<path d="M589 390 Q605 380 624 380 Q643 380 659 390 Q642 397 624 397 Q606 397 589 390 Z" fill="' + eyeWhite + '" opacity=".90"/>',
    '<ellipse cx="624" cy="389" rx="8.5" ry="9.5" fill="' + iris + '"/>',
    '<ellipse cx="624" cy="389" rx="4" ry="5" fill="' + feature + '"/>',
    '<path d="M589 390 Q605 378 624 379 Q643 378 659 390" fill="none" stroke="' + feature + '" stroke-width="4.5" stroke-linecap="round" opacity=".68"/>',
    '<path d="M595 397 Q624 403 653 397" fill="none" stroke="' + shadow + '" stroke-width="3" opacity=".24"/>',
  ].join(''),
  nose: [
    '<path d="M501 443 Q507 476 504 508 Q496 519 486 523 Q497 484 501 443 Z" fill="' + shadow + '" opacity=".36"/>',
    '<path d="M515 454 Q520 488 535 515 Q526 523 514 518 Q519 488 515 454 Z" fill="' + highlight + '" opacity=".28"/>',
    '<path d="M484 521 Q496 530 506 523 Q500 535 486 531 Z" fill="' + shadow + '" opacity=".58"/>',
    '<path d="M518 523 Q529 530 540 520 L538 531 Q524 535 518 523 Z" fill="' + shadow + '" opacity=".58"/>',
    '<path d="M495 535 Q512 543 529 535 Q520 550 512 551 Q504 550 495 535 Z" fill="' + highlight + '" opacity=".18"/>',
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
      '<path d="M344 470 Q373 518 417 544 Q385 549 354 526 Z" fill="' + highlight + '" opacity=".12"/>',
      '<path d="M680 470 Q651 518 607 544 Q639 549 670 526 Z" fill="' + highlight + '" opacity=".08"/>',
    ].join(''),
    brows: [
      '<path d="M356 342 Q399 320 444 337 Q405 331 362 349 Z" fill="' + feature + '" opacity=".78"/>',
      '<path d="M580 337 Q625 320 668 342 L662 349 Q619 331 580 337 Z" fill="' + feature + '" opacity=".78"/>',
    ].join(''),
    lips: [
      '<path d="M468 598 Q487 586 512 595 Q537 586 556 598 Q536 606 512 605 Q488 606 468 598 Z" fill="#81584D" opacity=".82"/>',
      '<path d="M472 602 Q492 613 512 609 Q532 613 552 602 Q541 623 512 625 Q483 623 472 602 Z" fill="#A97867" opacity=".88"/>',
      '<path d="M493 603 Q512 609 531 603 Q512 612 493 603 Z" fill="' + feature + '" opacity=".43"/>',
    ].join(''),
  },
  masculine: {
    head: '<path d="M512 108 C390 108 300 181 300 300 L300 492 C300 600 356 664 512 700 C668 664 724 600 724 492 L724 300 C724 181 634 108 512 108 Z"/>',
    contours: [
      '<path d="M328 497 Q356 568 425 615 Q381 604 345 557 Z" fill="' + shadow + '" opacity=".40"/>',
      '<path d="M696 497 Q668 568 599 615 Q643 604 679 557 Z" fill="' + shadow + '" opacity=".29"/>',
      '<path d="M410 643 Q512 679 614 643 Q578 688 512 697 Q446 688 410 643 Z" fill="' + shadow + '" opacity=".20"/>',
      '<path d="M485 626 Q512 634 539 626 Q530 640 512 642 Q494 640 485 626 Z" fill="' + shadow + '" opacity=".20"/>',
      '<path d="M333 470 Q365 532 426 566 Q384 565 348 536 Z" fill="' + shadow + '" opacity=".18"/>',
      '<path d="M691 470 Q659 532 598 566 Q640 565 676 536 Z" fill="' + shadow + '" opacity=".12"/>',
    ].join(''),
    brows: [
      '<path d="M352 340 Q400 322 448 338 Q404 335 357 350 Z" fill="' + feature + '" opacity=".86"/>',
      '<path d="M576 338 Q624 322 672 340 L667 350 Q620 335 576 338 Z" fill="' + feature + '" opacity=".86"/>',
    ].join(''),
    lips: [
      '<path d="M472 598 Q492 590 512 596 Q532 590 552 598 Q534 605 512 604 Q490 605 472 598 Z" fill="#795248" opacity=".82"/>',
      '<path d="M476 602 Q494 610 512 607 Q530 610 548 602 Q539 618 512 620 Q485 618 476 602 Z" fill="#996B5D" opacity=".78"/>',
      '<path d="M496 603 Q512 608 528 603 Q512 611 496 603 Z" fill="' + feature + '" opacity=".45"/>',
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
      ${shared.facePlanes}
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
