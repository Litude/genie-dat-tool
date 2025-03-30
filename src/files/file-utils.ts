import { mkdirSync, PathLike, rmSync } from "fs";

export function clearDirectory(directory: PathLike) {
  rmSync(directory, { recursive: true, force: true });
  mkdirSync(directory, { recursive: true });
}

export function safeFilename(input: string, removeExtension: boolean) {
  const invalidChars = /[<>:"/\\|?*]/g; // Invalid Windows filename characters
  let sanitized = input.replace(invalidChars, "-");
  if (removeExtension) {
    sanitized = sanitized.replace(/\.[^/.]+$/, "");
  }
  sanitized = sanitized.trim();
  return sanitized;
}
