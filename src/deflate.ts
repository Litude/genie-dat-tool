import { readFileSync } from "fs";
import { inflateRawSync } from "zlib";

export const decompressFile = (inputFile: string) => {
  const compressedData = readFileSync(inputFile);
  return inflateRawSync(compressedData);
};
