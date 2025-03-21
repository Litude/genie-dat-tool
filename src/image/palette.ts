import { decode as bmpDecode } from "bmp-ts";
import BufferReader from "../BufferReader";
import { asUInt8, UInt8 } from "../ts/base-types";

export interface ColorRgb {
  red: UInt8;
  green: UInt8;
  blue: UInt8;
}

export function readPaletteFile(path: string): ColorRgb[] {
  const buffer = new BufferReader(path);
  if (checkIfPalFile(buffer)) {
    const [header, version, entryCount, ...entries] = buffer
      .toString("ascii")
      .replaceAll("\r\n", "\n")
      .split("\n")
      .map((x) => x.trim())
      .filter((x) => x);
    if (header !== "JASC-PAL") {
      throw new Error(
        `Invalid JASC-PAL header, expected JASC-PAL but got ${header}!`,
      );
    }
    if (version !== "0100") {
      throw new Error(
        `Invalid JASC-PAL version, expected 0100 but got ${version} `,
      );
    }
    if (entryCount !== "256") {
      throw new Error(
        `Invalid JASC-PAL entry count, expected 256 but got ${entryCount}`,
      );
    }
    const colors: ColorRgb[] = entries.map((entry) => {
      const [, red, green, blue] = entry.match(/(\d+)\s+(\d+)\s+(\d+)/) || [];
      if (red && green && blue) {
        return {
          red: asUInt8(+red),
          green: asUInt8(+green),
          blue: asUInt8(+blue),
        };
      } else {
        throw new Error(`Invalid JASC-PAL line: ${entry}`);
      }
    });
    return colors;
    return [];
  } else if (checkIfBmpFile(buffer)) {
    const bmpFile = bmpDecode(buffer.data());
    const mappedPalette: ColorRgb[] = bmpFile.palette.map((entry) => ({
      red: asUInt8(entry.red),
      green: asUInt8(entry.green),
      blue: asUInt8(entry.blue),
    }));
    if (mappedPalette.length !== 256) {
      throw new Error(
        `Invalid palette, got ${mappedPalette.length} entries but expected 256!`,
      );
    }
    return mappedPalette;
  } else {
    throw new Error(
      `Invalid palette file, should be either BMP file or JASC-PAL`,
    );
  }
}

function checkIfPalFile(bufferReader: BufferReader) {
  try {
    if (bufferReader.isAscii()) {
      const contents = bufferReader.toString("ascii").trim();
      return contents.startsWith("JASC-PAL");
    }
    return false;
  } catch (_e: unknown) {
    return false;
  }
}

function checkIfBmpFile(bufferReader: BufferReader) {
  try {
    bufferReader.seek(0);
    const firstBytes = bufferReader.readFixedSizeString(2);
    if (firstBytes === "BM") {
      const fileSize = bufferReader.readUInt32();
      return fileSize === bufferReader.size();
    }
    return false;
  } catch (_e: unknown) {
    return false;
  }
}
