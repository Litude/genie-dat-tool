import { mkdirSync, PathLike, rmSync } from "fs";

export function clearDirectory(directory: PathLike) {
  rmSync(directory, { recursive: true, force: true });
  mkdirSync(directory, { recursive: true });
}
