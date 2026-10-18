import type { TFunction } from "i18next";

export const CROP_KEYS = [
  "rice", "wheat", "maize", "soybean", "cotton", "sugarcane", "chickpea", "groundnut", "onion", "tomato",
] as const;

/** Translated crop name for a key ("rice") or a stored English name ("Rice"); unknown names pass through. */
export function cropLabel(t: TFunction, nameOrKey: string): string {
  const key = nameOrKey.trim().toLowerCase();
  return (CROP_KEYS as readonly string[]).includes(key) ? t(`crops.names.${key}`) : nameOrKey;
}

/** "Rice • Field A" → translated crop part, field part untouched (it is the farmer's own text). */
export function taskCropLabel(t: TFunction, label: string): string {
  const [crop = "", ...rest] = label.split(" • ");
  return [cropLabel(t, crop), ...rest].join(" • ");
}
