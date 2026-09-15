import {BAY} from './physics.ts';
/** One short ceiling diffuser centred on each of the eight shelf units per bay. */
export const GALLERY_LIGHT_COUNT=8;
export const GALLERY_LIGHT_LENGTH=.8;
export const GALLERY_LIGHT_PERIOD=BAY/GALLERY_LIGHT_COUNT;

/** Transport must repeat both the eight lamps and six railing posts per bay. */
export const GALLERY_POST_COUNT=6;
export const GALLERY_TRANSPORT_PERIOD=BAY/2;
