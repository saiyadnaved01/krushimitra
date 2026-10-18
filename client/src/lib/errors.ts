import type { TFunction } from "i18next";
import { ApiError } from "@/api/client";

/** A user-facing, translated message for any error. Falls back to the server's English text. */
export function errorMessage(t: TFunction, err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code && t(`errors.${err.code}`, { defaultValue: "" })) return t(`errors.${err.code}`);
    if (err.message) return err.message;
  }
  if (err instanceof Error && err.message) return err.message;
  return t("errors.generic");
}
