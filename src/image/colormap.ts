import BufferReader from "../BufferReader";
import { PaletteIndex } from "../database/Types";
import { asUInt8 } from "../ts/base-types";

export function readColormap(path: string) {
  const bufferReader = new BufferReader(path);
  if (bufferReader.isAscii()) {
    const contents = bufferReader.toString("ascii").trim();
    const validLines = contents
      .replaceAll("\r\n", "\n")
      .split("\n")
      .map((x) => x.trim())
      .filter((line) => line);
    if (validLines.length === 256) {
      return validLines.map((line) => asUInt8<PaletteIndex>(Number(line)));
    } else {
      throw new Error(`Invalid colormap file`);
    }
  } else {
    throw new Error(`Invalid colormap file`);
  }
}
