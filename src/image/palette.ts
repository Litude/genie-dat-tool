import { decode as bmpDecode } from "bmp-ts";
import BufferReader from "../BufferReader";
import { asUInt8, UInt8 } from "../ts/base-types";
import { detectBitmapFile, DetectionResult } from "./bitmap";
import { PaletteIndex } from "../database/Types";

export interface ColorRgb {
  red: UInt8;
  green: UInt8;
  blue: UInt8;
}

const color = (red: number, green: number, blue: number) => {
  return {
    red: asUInt8<PaletteIndex>(red),
    green: asUInt8<PaletteIndex>(green),
    blue: asUInt8<PaletteIndex>(blue),
  };
};

export interface SimpleColorCycle {
  colorIndex: PaletteIndex;
  colors: Readonly<ColorRgb[]>;
}

export const WaterColorCycleColors: Readonly<ColorRgb[]> = [
  color(23, 39, 124),
  color(39, 63, 144),
  color(63, 95, 159),
  color(87, 123, 180),
  color(63, 95, 160),
  color(39, 63, 145),
  color(23, 39, 123),
];

// Animation that changes from red to black and back to red (used in palette index 247)
// The only known use of this color index is in BTNBORD.SHP
export const UiColorCycleColors1: Readonly<ColorRgb[]> = [
  color(255, 0, 0),
  color(217, 0, 0),
  color(185, 0, 0),
  color(150, 0, 0),
  color(120, 0, 0),
  color(90, 0, 0),
  color(75, 0, 0),
  color(20, 0, 0),
  color(0, 0, 0),
  color(20, 0, 0),
  color(75, 0, 0),
  color(90, 0, 0),
  color(120, 0, 0),
  color(150, 0, 0),
  color(185, 0, 0),
  color(217, 0, 0),
];

export const UiColorCycle1: SimpleColorCycle = {
  colorIndex: asUInt8<PaletteIndex>(247),
  colors: UiColorCycleColors1,
};

// Animation that changes from red to white and back to red (used in palette index 246)
// No graphics are known to use this color index, but it was probably used for some UI animations
export const UiColorCycleColors2: Readonly<ColorRgb[]> = [
  color(255, 0, 0),
  color(255, 30, 30),
  color(255, 60, 60),
  color(255, 100, 100),
  color(255, 160, 160),
  color(255, 200, 200),
  color(255, 254, 254),
  color(255, 200, 200),
  color(255, 160, 160),
  color(255, 100, 100),
  color(255, 60, 60),
  color(255, 30, 30),
];

export const UiColorCycle2: SimpleColorCycle = {
  colorIndex: asUInt8<PaletteIndex>(246),
  colors: UiColorCycleColors2,
};

export const ColorCycleAnimationDelay = 20; // cs, common for all color cycle animations
export const WaterAnimationFrameCount = WaterColorCycleColors.length;
export const UiAnimationFrameCount1 = UiColorCycleColors1.length;
export const UiAnimationFrameCount2 = UiColorCycleColors2.length;

function isValidBmpPaletteFile(buffer: BufferReader): boolean {
  const detectionResult = detectBitmapFile(buffer);
  if (detectionResult === DetectionResult.Bitmap) {
    return true;
  } else if (
    detectionResult === DetectionResult.PossiblyTruncatedBitmap &&
    buffer.size() >= 1078
  ) {
    // There is enough data to read the palette, so we assume that what data is here is valid.
    return true;
  } else {
    return false;
  }
}

export function readPaletteFile(input: string | BufferReader): ColorRgb[] {
  const buffer = typeof input === "string" ? new BufferReader(input) : input;
  if (detectJascPaletteFile(buffer)) {
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
  } else if (isValidBmpPaletteFile(buffer)) {
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

export function applySystemColors(palette: ColorRgb[]) {
  if (palette.length !== 256) {
    throw new Error(`Palette length was ${palette.length}, expected 256!`);
  } else {
    palette[0] = color(0, 0, 0);
    palette[1] = color(128, 0, 0);
    palette[2] = color(0, 128, 0);
    palette[3] = color(128, 128, 0);
    palette[4] = color(0, 0, 128);
    palette[5] = color(128, 0, 128);
    palette[6] = color(0, 128, 128);
    palette[7] = color(192, 192, 192);
    palette[8] = color(192, 220, 192);
    palette[9] = color(166, 202, 240);

    palette[246] = color(255, 251, 240);
    palette[247] = color(160, 160, 164);
    palette[248] = color(128, 128, 128);
    palette[249] = color(255, 0, 0);
    palette[250] = color(0, 255, 0);
    palette[251] = color(255, 255, 0);
    palette[252] = color(0, 0, 255);
    palette[253] = color(255, 0, 255);
    palette[254] = color(0, 255, 255);
    palette[255] = color(255, 255, 255);
  }
}

export function detectJascPaletteFile(bufferReader: BufferReader) {
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

export function getPaletteWithWaterColors(
  palette: ColorRgb[],
  waterAnimationState: number,
) {
  if (waterAnimationState < 0 || waterAnimationState > 6) {
    throw new Error(
      `Water animation state must be a number in the range 0-7, got ${waterAnimationState}`,
    );
  }

  const adjustedAnimationState =
    waterAnimationState === 0 ? 0 : 7 - waterAnimationState;

  const clonedPalette = structuredClone(palette);
  for (let i = 0; i < 7; ++i) {
    const waterColor = structuredClone(
      WaterColorCycleColors[(i + adjustedAnimationState) % 7],
    );
    clonedPalette[248 + i] = waterColor;
  }
  return clonedPalette;
}

export function getPaletteWithSimpleColorCycle(
  palette: ColorRgb[],
  colorCycle: SimpleColorCycle,
  cycleIndex: number,
) {
  const actualCycleIndex = cycleIndex % colorCycle.colors.length;
  const clonedPalette = structuredClone(palette);
  clonedPalette[colorCycle.colorIndex] = colorCycle.colors[actualCycleIndex];
  return clonedPalette;
}
