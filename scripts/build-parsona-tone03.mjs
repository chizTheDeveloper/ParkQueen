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

const { primary, shadow, highlight, feature, eyeWhite, iris } = geometry.palette;

const shared = {
  neck: '<path d="M410 674 C410 760 401 862 384 932 Q512 948 640 932 C623 862 614 760 614 674 Z"/>',
  ears: [
    '<path d="M303 378 C285 360 246 360 246 430 C246 502 271 548 304 532 L322 468 L318 398 Z"/>',
    '<path d="M721 378 C739 360 778 360 778 430 C778 502 753 548 720 532 L702 468 L706 398 Z"/>',
  ].join(''),
  head: '<path d="M512 80 C390 80 300 165 300 300 L300 500 C300 610 380 675 512 700 C644 675 724 610 724 500 L724 300 C724 165 634 80 512 80 Z"/>',
  shadow: [
    '<path d="M300 305 C326 207 380 148 430 126 C375 240 358 412 385 548 C405 626 450 674 512 700 C380 675 300 610 300 500 Z"/>',
    '<path d="M410 674 C410 760 401 862 384 932 Q433 938 464 940 L468 685 Z"/>',
    '<path d="M246 430 C246 502 271 548 304 532 L312 500 C285 510 272 462 276 404 C262 398 250 407 246 430 Z"/>',
  ].join(''),
  highlight: '<path d="M484 126 C540 104 620 139 660 207 C585 169 518 178 455 229 C462 185 470 150 484 126 Z" opacity=".62"/>',
  eyes: [
    '<path d="M350 390 Q397 354 446 390 Q399 423 350 390 Z" fill="' + eyeWhite + '"/>',
    '<ellipse cx="399" cy="390" rx="18" ry="20" fill="' + iris + '"/>',
    '<ellipse cx="399" cy="390" rx="8" ry="10" fill="' + feature + '"/>',
    '<path d="M578 390 Q627 354 674 390 Q625 423 578 390 Z" fill="' + eyeWhite + '"/>',
    '<ellipse cx="625" cy="390" rx="18" ry="20" fill="' + iris + '"/>',
    '<ellipse cx="625" cy="390" rx="8" ry="10" fill="' + feature + '"/>',
  ].join(''),
  nose: [
    '<path d="M512 421 L486 514 Q512 529 538 514" fill="none" stroke="' + shadow + '" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>',
    '<path d="M485 523 Q512 539 539 523" fill="none" stroke="' + feature + '" stroke-width="7" stroke-linecap="round"/>',
  ].join(''),
};

const variants = {
  feminine: {
    contours: [
      '<path d="M344 487 Q365 606 512 671 Q659 606 680 487 Q653 631 512 688 Q371 631 344 487 Z" fill="' + highlight + '" opacity=".28"/>',
      '<path d="M354 500 Q381 570 431 590" fill="none" stroke="' + shadow + '" stroke-width="10" stroke-linecap="round" opacity=".38"/>',
      '<path d="M670 500 Q643 570 593 590" fill="none" stroke="' + shadow + '" stroke-width="10" stroke-linecap="round" opacity=".38"/>',
    ].join(''),
    brows: [
      '<path d="M350 338 Q399 310 450 335" fill="none" stroke="' + feature + '" stroke-width="17" stroke-linecap="round"/>',
      '<path d="M574 335 Q625 310 674 338" fill="none" stroke="' + feature + '" stroke-width="17" stroke-linecap="round"/>',
    ].join(''),
    lips: [
      '<path d="M451 600 Q512 575 573 600 Q512 620 451 600 Z" fill="' + shadow + '"/>',
      '<path d="M458 604 Q512 626 566 604 Q550 640 512 642 Q474 640 458 604 Z" fill="' + highlight + '" opacity=".72"/>',
      '<path d="M454 602 Q512 610 570 602" fill="none" stroke="' + feature + '" stroke-width="6" stroke-linecap="round"/>',
    ].join(''),
  },
  masculine: {
    contours: [
      '<path d="M330 470 Q340 602 512 671 Q684 602 694 470 Q675 630 512 688 Q349 630 330 470 Z" fill="' + shadow + '" opacity=".24"/>',
      '<path d="M342 510 Q365 598 430 625" fill="none" stroke="' + shadow + '" stroke-width="13" stroke-linecap="round" opacity=".48"/>',
      '<path d="M682 510 Q659 598 594 625" fill="none" stroke="' + shadow + '" stroke-width="13" stroke-linecap="round" opacity=".48"/>',
    ].join(''),
    brows: [
      '<path d="M344 336 Q398 316 452 335" fill="none" stroke="' + feature + '" stroke-width="20" stroke-linecap="round"/>',
      '<path d="M572 335 Q626 316 680 336" fill="none" stroke="' + feature + '" stroke-width="20" stroke-linecap="round"/>',
    ].join(''),
    lips: [
      '<path d="M450 600 Q512 584 574 600 Q512 617 450 600 Z" fill="' + shadow + '"/>',
      '<path d="M458 604 Q512 620 566 604 Q550 631 512 633 Q474 631 458 604 Z" fill="' + primary + '"/>',
      '<path d="M454 602 Q512 608 570 602" fill="none" stroke="' + feature + '" stroke-width="6" stroke-linecap="round"/>',
    ].join(''),
  },
};

function svgFor(variant) {
  const styled = variants[variant];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    <g shape-rendering="geometricPrecision">
      <g fill="${primary}">${shared.neck}${shared.ears}${shared.head}</g>
      <g fill="${shadow}">${shared.shadow}</g>
      <g fill="${highlight}">${shared.highlight}</g>
      ${styled.contours}
      ${styled.brows}
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
