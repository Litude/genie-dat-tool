import BufferReader from "../BufferReader";
import { ResourceId } from "../database/Types";
import { movedRectangle, Rectangle } from "../geometry/Rectangle";
import { RawImage } from "./RawImage";
import { lstatSync, readdirSync, readFileSync, writeFileSync } from "fs";
import * as DrsFile from "../drs/DrsFile";
import { parseSlpImage } from "./slpImage";
import { isDefined } from "../ts/ts-utils";
import {
  ColorCycleAnimationDelay,
  ColorRgb,
  getPaletteWithSimpleColorCycle,
  getPaletteWithWaterColors,
  SimpleColorCycle,
  UiColorCycle1,
  UiColorCycle2,
  WaterAnimationFrameCount,
} from "./palette";
import { GifWriter } from "omggif";
import path from "path";
import { Logger } from "../Logger";
import { encode as bmpEncode } from "bmp-ts";
import { Point } from "../geometry/Point";
import { asInt32, Int16 } from "../ts/base-types";
import { parseShpImage } from "./shpImage";
import { lcm } from "../util";

export class Graphic {
  frames: RawImage[];
  palette: ColorRgb[];
  filename?: string;
  resourceId?: ResourceId;

  constructor(frames: RawImage[]) {
    this.frames = frames;
    this.palette = [];
  }

  isValid() {
    return this.frames.some((frame) => frame.isValid());
  }

  hasWaterAnimation() {
    return this.frames.some((frame) => frame.hasWaterAnimation());
  }

  getBounds(): Rectangle<number> {
    const validFrames = this.frames.filter((frame) => frame.isValid());
    if (!validFrames.length) {
      return {
        left: -1,
        right: -1,
        top: -1,
        bottom: -1,
      };
    } else {
      const currentBounds = validFrames[0].getBounds();
      validFrames.forEach((image, index) => {
        if (index > 0) {
          const nextBounds = image.getBounds();
          currentBounds.left = Math.min(currentBounds.left, nextBounds.left);
          currentBounds.top = Math.min(currentBounds.top, nextBounds.top);
          currentBounds.right = Math.max(currentBounds.right, nextBounds.right);
          currentBounds.bottom = Math.max(
            currentBounds.bottom,
            nextBounds.bottom,
          );
        }
      });
      return currentBounds;
    }
  }

  writeToBmp(
    outputDir: string,
    {
      transparentIndex,
    }: {
      transparentIndex: number | undefined;
    },
    filename?: string,
  ) {
    if (
      this.palette.length !== 256 &&
      this.frames.some((frame) => frame.palette?.length !== 256)
    ) {
      throw Error(
        `Attempted to convert RawImage to BMP but palette length was ${this.palette.length}`,
      );
    }

    const bmpData = this.frames.map((frame) => {
      return bmpEncode({
        data: Buffer.from(
          frame.getRawData().map((entry) => {
            if (entry === null) {
              if (transparentIndex === undefined) {
                throw new Error(
                  `Tried writing image with transparency but no transparent index has been specified!`,
                );
              } else {
                return transparentIndex;
              }
            } else {
              return entry;
            }
          }),
        ),
        bitPP: 8,
        width: frame.getWidth(),
        height: frame.getHeight(),
        palette: (frame.palette ?? this.palette).map((entry) => ({
          red: entry.red,
          green: entry.green,
          blue: entry.blue,
          quad: 0,
        })),
        colors: 256,
        importantColors: 256,
      }).data;
    });
    bmpData.forEach((file, index) => {
      const outputPath = path.join(
        outputDir,
        `${path.parse(filename ?? this.filename ?? "unnamed").name}_${index}.bmp`,
      );
      writeFileSync(outputPath, file);
      Logger.info(`Wrote ${outputPath}`);
    });
  }

  writeToGif(
    outputDir: string,
    {
      delay,
      replayDelay,
      transparentIndex,
    }: {
      delay: number;
      replayDelay: number;
      transparentIndex: number | undefined;
    },
    filename?: string,
  ) {
    if (this.palette.length !== 256) {
      throw Error(
        `Attempted to convert RawImage to GIF but palette length was ${this.palette.length}`,
      );
    }

    const animationBounds = this.getBounds();
    const animationWidth = animationBounds.right - animationBounds.left + 1;
    const animationHeight = animationBounds.bottom - animationBounds.top + 1;
    const gifBuffer = Buffer.alloc(
      1024 * 1024 + animationWidth * animationHeight * this.frames.length,
    );
    const gifWriter = new GifWriter(
      gifBuffer,
      animationWidth,
      animationHeight,
      {
        loop: 0,
        palette: this.frames.every((frame) => frame.palette)
          ? undefined
          : this.palette.map((entry) => {
              let value = +entry.blue;
              value |= entry.green << 8;
              value |= entry.red << 16;
              return value;
            }),
      },
    );
    this.frames.forEach((image, index) => {
      image.appendToGif(gifWriter, animationBounds, {
        delay:
          image.delay ??
          (index === this.frames.length - 1 ? delay + replayDelay : delay),
        transparentIndex,
      });
    });
    const gifData = gifBuffer.subarray(0, gifWriter.end());
    const outputPath = path.join(
      outputDir,
      `${path.parse(filename ?? this.filename ?? "unnamed").name}.gif`,
    );
    writeFileSync(outputPath, gifData);
    //Logger.info(`Wrote ${outputPath}`);
  }

  writeToGifFrames(
    outputDir: string,
    {
      transparentIndex,
    }: {
      transparentIndex: number | undefined;
    },
    filename?: string,
  ) {
    if (
      this.palette.length !== 256 &&
      this.frames.some((frame) => frame.palette?.length !== 256)
    ) {
      throw Error(
        `Attempted to convert RawImage to GIF frames but palette length was ${this.palette.length}`,
      );
    }

    this.frames.forEach((frame, index) => {
      const width = frame.getWidth();
      const height = frame.getHeight();

      const gifBuffer = Buffer.alloc(1024 * 1024 + width * height);
      const gifWriter = new GifWriter(gifBuffer, width, height, {
        palette: (frame.palette ?? this.palette).map((entry) => {
          let value = +entry.blue;
          value |= entry.green << 8;
          value |= entry.red << 16;
          return value;
        }),
      });
      frame.appendToGif(gifWriter, frame.getBounds(), {
        delay: 0,
        transparentIndex,
      });
      const gifData = gifBuffer.subarray(0, gifWriter.end());
      const outputPath = path.join(
        outputDir,
        `${path.parse(filename ?? this.filename ?? "unnamed").name}_${index}.gif`,
      );
      writeFileSync(outputPath, gifData);
    });
  }

  slice(start?: number, end?: number) {
    const sliced = new Graphic(this.frames.slice(start, end));
    sliced.filename = this.filename;
    sliced.resourceId = this.resourceId;
    sliced.palette = this.palette;
    return sliced;
  }

  mirrored() {
    const mirrored = new Graphic(
      this.frames.map((frame) => frame.flippedHorizontally()),
    );
    mirrored.filename = this.filename;
    mirrored.resourceId = this.resourceId;
    mirrored.palette = this.palette;
    return mirrored;
  }
}

export function getCombinedGraphicBounds(
  graphics: {
    graphic: Graphic;
    offset: Point<Int16>;
  }[],
): Rectangle<number> | null {
  const firstValidIndex = graphics.findIndex((graphic) =>
    graphic.graphic.isValid(),
  );

  if (firstValidIndex !== -1) {
    const currentBounds = movedRectangle(
      graphics[firstValidIndex].graphic.getBounds(),
      graphics[firstValidIndex].offset,
    );
    graphics.slice(firstValidIndex + 1).forEach((image) => {
      if (image.graphic.isValid()) {
        const nextBounds = movedRectangle(
          image.graphic.getBounds(),
          image.offset,
        );
        currentBounds.left = Math.min(currentBounds.left, nextBounds.left);
        currentBounds.top = Math.min(currentBounds.top, nextBounds.top);
        currentBounds.right = Math.max(currentBounds.right, nextBounds.right);
        currentBounds.bottom = Math.max(
          currentBounds.bottom,
          nextBounds.bottom,
        );
      }
    });
    return currentBounds;
  } else {
    return null;
  }
}

export function readGraphics(
  filePaths: string[],
  palette: ColorRgb[],
  playerColor: number,
): Graphic[] {
  const result = filePaths
    .map((filePath) => {
      const stat = lstatSync(filePath);
      if (stat.isDirectory()) {
        const filenames = readdirSync(filePath).map((entry) =>
          entry.toLocaleLowerCase(),
        );
        return filenames
          .map((filename) => {
            if (filename.endsWith(".slp")) {
              const buffer = new BufferReader(
                readFileSync(path.join(filePath, filename)),
              );
              const frames = parseSlpImage(buffer, {
                playerColor,
                shadowColor: 0,
              });
              const graphic = new Graphic(frames);
              graphic.palette = palette;
              graphic.filename = filename.slice(0, -4);
              const [, resourceIdStr] = filename.match(/^(\d+)\.slp$/) ?? [];
              if (resourceIdStr) {
                graphic.resourceId = asInt32<ResourceId>(+resourceIdStr);
              }
              return graphic;
            } else if (filename.endsWith(".shp")) {
              const buffer = new BufferReader(
                readFileSync(path.join(filePath, filename)),
              );
              const frames = parseShpImage(buffer);
              const graphic = new Graphic(frames);
              graphic.palette = palette;
              graphic.filename = filename.slice(0, -4);
              const [, resourceIdStr] = filename.match(/^(\d+)\.shp$/) ?? [];
              if (resourceIdStr) {
                graphic.resourceId = asInt32<ResourceId>(+resourceIdStr);
              }
              return graphic;
            } else {
              return null;
            }
          })
          .filter(isDefined);
      } else if (stat.isFile()) {
        const drsResult = DrsFile.readFromFile(filePath);
        const graphics = drsResult.files
          .map((file) => {
            if (file.filename.endsWith(".slp")) {
              const frames = parseSlpImage(new BufferReader(file.data), {
                playerColor,
                shadowColor: 0,
              });
              const graphic = new Graphic(frames);
              graphic.palette = palette;
              graphic.filename = file.filename;
              graphic.resourceId = file.resourceId;
              return graphic;
            } else {
              return null;
            }
          })
          .filter(isDefined);
        return graphics;
      } else {
        throw new Error(
          `Unable to read graphics at ${filePath}, is the path correct?`,
        );
      }
    })
    .flat()
    .reverse(); // reverse so graphics added last are found first, giving later entries higher priority
  return result;
}

function graphicWithColorCycles(
  graphic: Graphic,
  animateWater: boolean,
  animate1996Ui: boolean,
  animationDelay: number, // in cs
  firstFrameIndex: number,
  lastFrameIndex: number,
): Graphic {
  if (!animateWater && !animate1996Ui) {
    return graphic;
  }

  const frames =
    lastFrameIndex === -1
      ? graphic.frames.slice(firstFrameIndex)
      : graphic.frames.slice(firstFrameIndex, lastFrameIndex + 1);
  const frameCount = frames.length;
  if (!frameCount) {
    Logger.warn(
      `No frames found in graphic, returning empty graphic with color cycles`,
    );
    return new Graphic([]);
  }

  const cycledGraphic = new Graphic([]);
  cycledGraphic.filename = graphic.filename;
  cycledGraphic.resourceId = graphic.resourceId;

  const colorCycleCounts: number[] = [];
  const simpleColorCycles: SimpleColorCycle[] = [];

  let palette = graphic.palette;

  let useWaterColors = false;
  if (animateWater) {
    palette = getPaletteWithWaterColors(palette, 0);
    if (frames.some((frame) => frame.hasWaterAnimation())) {
      useWaterColors = true;
      colorCycleCounts.push(WaterAnimationFrameCount);
      Logger.info(
        `Graphic ${graphic.filename ?? graphic.resourceId} has water animation`,
      );
    }
  }
  if (animate1996Ui) {
    palette = getPaletteWithSimpleColorCycle(palette, UiColorCycle1, 0);
    palette = getPaletteWithSimpleColorCycle(palette, UiColorCycle2, 0);
    if (frames.some((frame) => frame.hasColorCycleAnimation(UiColorCycle1))) {
      Logger.info(
        `Graphic ${graphic.filename ?? graphic.resourceId} has 1996 UI color cycle animation 1`,
      );
      simpleColorCycles.push(UiColorCycle1);
    }
    if (frames.some((frame) => frame.hasColorCycleAnimation(UiColorCycle2))) {
      Logger.info(
        `Graphic ${graphic.filename ?? graphic.resourceId} has 1996 UI color cycle animation 2`,
      );
      simpleColorCycles.push(UiColorCycle2);
    }
  }
  simpleColorCycles.forEach((colorCycle) => {
    colorCycleCounts.push(colorCycle.colors.length);
  });

  // If no color cycles are found, return the original graphic
  // but update the palette to include the first state of each requested color cycle
  if (!colorCycleCounts.length) {
    const copy = graphic.slice();
    copy.palette = palette;
    copy.frames = frames;
    return copy;
  }

  const cycleTotalDurations = colorCycleCounts.map(
    (count) => count * ColorCycleAnimationDelay,
  );
  let totalDuration = frameCount > 1 ? animationDelay * frameCount : 1;
  cycleTotalDurations.forEach((duration) => {
    totalDuration = lcm(totalDuration, duration);
  });
  Logger.debug(
    `Total duration of color cycle animation is ${totalDuration} cs, with ${frameCount} frames and ${colorCycleCounts.length} color cycles`,
  );
  if (frameCount > 1) {
    Logger.debug(
      `Animation will be repeated ${totalDuration / (animationDelay * frameCount) - 1} times to allow for color cycles, totaling ${totalDuration / Math.min(animationDelay, ColorCycleAnimationDelay)} frames`,
    );
  } else {
    Logger.debug(
      `Graphic ${graphic.filename ?? graphic.resourceId} has no animation frames, so only color cycles will be applied`,
    );
  }

  let length = 0;
  let colorCycleFrameRemaining = ColorCycleAnimationDelay;
  let animationFrameRemaining = animationDelay;
  let colorCycleIndex = 0;
  let animationIndex = 0;
  while (length < totalDuration) {
    if (useWaterColors) {
      palette = getPaletteWithWaterColors(
        palette,
        colorCycleIndex % WaterAnimationFrameCount,
      );
    }
    simpleColorCycles.forEach((colorCycle) => {
      palette = getPaletteWithSimpleColorCycle(
        palette,
        colorCycle,
        colorCycleIndex,
      );
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
    const frame = frames[animationIndex % frames.length].clone();
    frame.palette = palette;
    frame.delay = frameLength;
    if (colorCycleFrameRemaining === 0) {
      colorCycleFrameRemaining = ColorCycleAnimationDelay;
      ++colorCycleIndex;
    }
    if (frameCount > 1 && animationFrameRemaining === 0) {
      animationFrameRemaining = animationDelay;
      ++animationIndex;
    }
    cycledGraphic.frames.push(frame);
  }
  return cycledGraphic;
}

export function writeGraphic(
  outputFormat: "gif" | "bmp" | "gif-frames",
  graphic: Graphic,
  {
    transparentIndex,
    delay,
    replayDelay,
    animateWater,
    animate1996Ui,
    firstFrame,
    lastFrame,
  }: {
    transparentIndex: number | undefined;
    delay: number;
    replayDelay: number;
    animateWater: boolean;
    animate1996Ui: boolean;
    firstFrame: number;
    lastFrame: number;
  },
  filename: string,
  outputDir: string,
) {
  const parsedGraphic = graphicWithColorCycles(
    graphic,
    animateWater,
    animate1996Ui,
    delay,
    firstFrame,
    lastFrame,
  );
  switch (outputFormat) {
    case "bmp": {
      parsedGraphic.writeToBmp(outputDir, { transparentIndex }, filename);
      return true;
    }
    case "gif": {
      const animationBounds = parsedGraphic.getBounds();
      const animationWidth = animationBounds.right - animationBounds.left + 1;
      const animationHeight = animationBounds.bottom - animationBounds.top + 1;

      const normalizedGraphic = new Graphic(
        parsedGraphic.frames.map((image) => {
          const normalizedImage = new RawImage(animationWidth, animationHeight);
          normalizedImage.setAnchor({
            x: -animationBounds.left,
            y: -animationBounds.top,
          });
          normalizedImage.overlayImage(image);
          normalizedImage.palette = image.palette;
          normalizedImage.delay = image.delay;
          return normalizedImage;
        }),
      );
      normalizedGraphic.palette = parsedGraphic.palette;
      normalizedGraphic.writeToGif(
        outputDir,
        { delay, replayDelay, transparentIndex },
        filename,
      );
      return true;
    }
    case "gif-frames": {
      parsedGraphic.writeToGifFrames(outputDir, { transparentIndex }, filename);
      return true;
    }
    default:
      Logger.error(`Invalid output format ${outputFormat}`);
      return false;
  }
}
