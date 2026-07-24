import { HAIR_IDS, SKIN_IDS, TOP_IDS, V2_LABELS } from './constants';
import type {
  AccessoryId,
  BaseStyleId,
  V2AssetCategory,
  V2AssetManifestEntry,
  V2AssetPaths,
} from './types';

const BOTH = ['feminine', 'masculine'] as const;

function entry(
  category: V2AssetCategory,
  id: string,
  paths: V2AssetPaths,
  description: { en: string; es: string },
  compatibleBaseStyles: readonly BaseStyleId[] = BOTH,
): V2AssetManifestEntry {
  return {
    id,
    category,
    compatibleBaseStyles,
    paths,
    label: V2_LABELS[id],
    description,
    status: 'pending',
    version: 2,
  };
}

const background = entry(
  'background',
  'parqueen_navy',
  {
    feminine: '/parsona-v2/backgrounds/parqueen_navy.webp',
    masculine: '/parsona-v2/backgrounds/parqueen_navy.webp',
  },
  { en: 'Fixed premium ParQueen navy background.', es: 'Fondo prémium fijo azul marino ParQueen.' },
);

const skins = SKIN_IDS.map(id => entry(
  'skin',
  id,
  {
    feminine: `/parsona-v2/bases/feminine/${id}.webp`,
    masculine: `/parsona-v2/bases/masculine/${id}.webp`,
  },
  {
    en: `${V2_LABELS[id].en} base face and neck layer.`,
    es: `Capa base de rostro y cuello ${V2_LABELS[id].es.toLowerCase()}.`,
  },
));

const hair = HAIR_IDS.map(id => entry(
  'hair',
  id,
  {
    feminine: null,
    masculine: null,
    feminineBack: `/parsona-v2/hair/feminine/${id}.back.webp`,
    masculineBack: `/parsona-v2/hair/masculine/${id}.back.webp`,
    feminineFront: `/parsona-v2/hair/feminine/${id}.front.webp`,
    masculineFront: `/parsona-v2/hair/masculine/${id}.front.webp`,
  },
  {
    en: `${V2_LABELS[id].en} back and front hair layers.`,
    es: `Capas posterior y frontal de ${V2_LABELS[id].es.toLowerCase()}.`,
  },
));

const accessoryIds: readonly AccessoryId[] = [
  'round_glasses', 'square_glasses', 'cap_beanie', 'head_covering',
];
const accessories = accessoryIds.map(id => entry(
  'accessory',
  id,
  {
    feminine: `/parsona-v2/accessories/feminine/${id}.webp`,
    masculine: `/parsona-v2/accessories/masculine/${id}.webp`,
  },
  {
    en: `${V2_LABELS[id].en} transparent accessory layer.`,
    es: `Capa transparente de ${V2_LABELS[id].es.toLowerCase()}.`,
  },
));

const tops = TOP_IDS.map(id => entry(
  'top',
  id,
  {
    feminine: `/parsona-v2/tops/feminine/${id}.webp`,
    masculine: `/parsona-v2/tops/masculine/${id}.webp`,
  },
  {
    en: `${V2_LABELS[id].en} top and shoulders layer.`,
    es: `Capa de torso y hombros: ${V2_LABELS[id].es.toLowerCase()}.`,
  },
));

export const PARSONA_V2_MANIFEST: readonly V2AssetManifestEntry[] = [
  background,
  ...skins,
  ...hair,
  ...accessories,
  ...tops,
];
