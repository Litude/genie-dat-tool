import { Mutable } from "../ts/ts-utils";
import { lcm } from "../util";
import { color, ColorRgb } from "./palette";
import { RawImage } from "./RawImage";

export const ColorCycleAnimationDelay = 20; // cs

export interface ColorCycle {
  getName(): string;
  getPaletteColors(
    palette: Readonly<ColorRgb[]>,
    cycleIndex: number,
  ): ColorRgb[];
  getFrameCount(): number;
  getCycleTotalDuration(): number;
  isUsedByImage(frame: Readonly<RawImage>): boolean;
}

class SingleColorCycle implements ColorCycle {
  private name: string;
  private colorIndex: number;
  private colors: Readonly<ColorRgb[]>;

  constructor(name: string, colorIndex: number, colors: Readonly<ColorRgb[]>) {
    this.name = name;
    this.colorIndex = colorIndex;
    this.colors = colors;
  }

  getName(): string {
    return this.name;
  }

  getPaletteColors(
    palette: Readonly<ColorRgb[]>,
    cycleIndex: number,
  ): ColorRgb[] {
    const actualCycleIndex = cycleIndex % this.colors.length;
    const clonedPalette = structuredClone(palette) as Mutable<ColorRgb[]>;
    clonedPalette[this.colorIndex] = this.colors[actualCycleIndex];
    return clonedPalette;
  }
  getFrameCount(): number {
    return this.colors.length;
  }
  getCycleTotalDuration(): number {
    return this.colors.length * ColorCycleAnimationDelay;
  }
  isUsedByImage(frame: Readonly<RawImage>): boolean {
    return frame.data.some(
      (color) => color !== null && color === this.colorIndex,
    );
  }
}

class OffsetColorCycle implements ColorCycle {
  private name: string;
  private colorIndex: number;
  private colors: Readonly<ColorRgb[]>;

  constructor(name: string, colorIndex: number, colors: Readonly<ColorRgb[]>) {
    this.name = name;
    this.colorIndex = colorIndex;
    this.colors = colors;

    if (this.colorIndex + this.colors.length > 256) {
      throw new Error(
        `Color index ${this.colorIndex} with colors length ${this.colors.length} exceeds palette bounds`,
      );
    }
  }

  getName(): string {
    return this.name;
  }

  getPaletteColors(
    palette: Readonly<ColorRgb[]>,
    cycleIndex: number,
  ): ColorRgb[] {
    const adjustedCycleIndex = cycleIndex % 7;
    const clonedPalette = structuredClone(palette) as Mutable<ColorRgb[]>;

    const firstIndexOffset =
      adjustedCycleIndex === 0 ? 0 : this.colors.length - adjustedCycleIndex;

    for (let i = 0; i < this.colors.length; ++i) {
      const waterColor = structuredClone(
        this.colors[(firstIndexOffset + i) % this.colors.length],
      );
      clonedPalette[this.colorIndex + i] = waterColor;
    }
    return clonedPalette;
  }
  getFrameCount(): number {
    return this.colors.length;
  }
  getCycleTotalDuration(): number {
    return this.colors.length * ColorCycleAnimationDelay;
  }
  isUsedByImage(frame: Readonly<RawImage>): boolean {
    const lastColorIndex = this.colorIndex + this.colors.length - 1;
    return frame.data.some(
      (color) =>
        color !== null && color >= this.colorIndex && color <= lastColorIndex,
    );
  }
}

// Animation that changes from red to black and back to red (used in palette index 247)
// The only known real use of this color index is in BTNBORD.SHP
// It was also used in rock_d1.shp and E_stable.shp (by accident since its presence in these makes no sense)
export const Ui1996ColorCycle1 = new SingleColorCycle(
  "UI 1996 Color Cycle 1",
  247,
  [
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
  ],
);

// Animation that changes from red to white and back to red (used in palette index 246)
// No graphics are known to use this color index, but it was probably used for some UI animations
export const Ui1996ColorCycle2 = new SingleColorCycle(
  "UI 1996 Color Cycle 2",
  246,
  [
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
  ],
);

export const WaterColorCycle = new OffsetColorCycle("Water Color Cycle", 248, [
  color(23, 39, 124),
  color(39, 63, 144),
  color(63, 95, 159),
  color(87, 123, 180),
  color(63, 95, 160),
  color(39, 63, 145),
  color(23, 39, 123),
]);

/*
 * Applies color cycles to the frames of a graphic.
 * The frames are cycled through the color cycles, applying the colors to the palette.
 * The resulting frames will have their palette updated with the colors from the color cycles.
 *
 * @param frames - The frames to apply color cycles to.
 * @param defaultFrameDelay - The default delay for each frame, used only if the frame does not have a specific delay.
 * @param inputPalette - The initial palette to use for the frames.
 * @param inputColorCycles - The color cycles to apply to the frames.
 * @returns An array of frames with new delays and color cycles applied.
 */
export function applyColorCyclesToFrames(
  frames: RawImage[],
  defaultFrameDelay: number,
  inputPalette: Readonly<ColorRgb[]>,
  inputColorCycles: ReadonlyArray<ColorCycle>,
): RawImage[] {
  const usedColorCycles = inputColorCycles.filter((cycle) =>
    frames.some((frame) => cycle.isUsedByImage(frame)),
  );
  if (!usedColorCycles.length) {
    return frames;
  }

  const cycleTotalDurations = usedColorCycles.map((cycle) =>
    cycle.getCycleTotalDuration(),
  );
  const frameCount = frames.length;
  let totalDuration =
    frameCount > 1
      ? frames.reduce(
          (acc, frame) => acc + (frame.delay ?? defaultFrameDelay),
          0,
        )
      : 1;
  totalDuration = Math.max(totalDuration, 1);
  cycleTotalDurations.forEach((duration) => {
    totalDuration = lcm(totalDuration, duration);
  });

  let length = 0;
  let colorCycleFrameRemaining = ColorCycleAnimationDelay;
  let animationFrameRemaining = frames[0].delay ?? defaultFrameDelay;
  let colorCycleIndex = 0;
  let animationIndex = 0;
  let palette = structuredClone(inputPalette) as Mutable<ColorRgb[]>;
  const cycledImage: RawImage[] = [];
  while (length < totalDuration) {
    usedColorCycles.forEach((colorCycle) => {
      palette = colorCycle.getPaletteColors(palette, colorCycleIndex);
    });
    let frameLength = 0;
    if (frameCount > 1) {
      frameLength = Math.min(colorCycleFrameRemaining, animationFrameRemaining);
    } else {
      frameLength = colorCycleFrameRemaining;
    }
    length += frameLength;
    colorCycleFrameRemaining -= frameLength;
    animationFrameRemaining -= frameLength;
    const adjustedAnimationIndex = animationIndex % frameCount;
    const frame = frames[adjustedAnimationIndex].clone();
    frame.palette = palette;
    frame.delay = frameLength;
    if (colorCycleFrameRemaining === 0) {
      colorCycleFrameRemaining = ColorCycleAnimationDelay;
      ++colorCycleIndex;
    }
    if (frameCount > 1 && animationFrameRemaining === 0) {
      ++animationIndex;
      const adjustedNewAnimationIndex = animationIndex % frameCount;
      animationFrameRemaining =
        frames[adjustedNewAnimationIndex].delay ?? defaultFrameDelay;
    }
    cycledImage.push(frame);
  }
  return cycledImage;
}
