import BufferReader from "../BufferReader";
import { ResourceId } from "../database/Types";
import { movedRectangle, Rectangle } from "../geometry/Rectangle";
import { RawImage } from "./RawImage";
import { lstatSync, writeFileSync } from "fs";
import * as DrsFile from "../drs/DrsFile";
import { parseSlpImage } from "./slpImage";
import { isDefined } from "../ts/ts-utils";
import { ColorRgb } from "./palette";
import { GifWriter } from "omggif";
import path from "path";
import { Logger } from "../Logger";
import { encode as bmpEncode } from "bmp-ts";
import { Point } from "../geometry/Point";
import { Int16 } from "../ts/base-types";

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
    if (this.palette.length !== 256) {
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
        palette: this.palette.map((entry) => ({
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
        // TODO: Loose slp files
        throw new Error(`Reading loose SLP files not yet implemented!`);
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

export function writeGraphic(
  outputFormat: "gif" | "bmp",
  graphic: Graphic,
  {
    transparentIndex,
    delay,
  }: { transparentIndex: number | undefined; delay: number },
  filename: string,
  outputDir: string,
) {
  switch (outputFormat) {
    case "bmp": {
      graphic.writeToBmp(outputDir, { transparentIndex }, filename);
      return true;
    }
    case "gif": {
      const animationBounds = graphic.getBounds();
      const animationWidth = animationBounds.right - animationBounds.left + 1;
      const animationHeight = animationBounds.bottom - animationBounds.top + 1;

      const normalizedGraphic = new Graphic(
        graphic.frames.map((image) => {
          const normalizedImage = new RawImage(animationWidth, animationHeight);
          normalizedImage.setAnchor({
            x: -animationBounds.left,
            y: -animationBounds.top,
          });
          normalizedImage.overlayImage(image);
          return normalizedImage;
        }),
      );
      normalizedGraphic.palette = graphic.palette;
      normalizedGraphic.writeToGif(
        outputDir,
        { delay, replayDelay: 0, transparentIndex },
        filename,
      );
      return true;
    }
    default:
      Logger.error(`Invalid output format ${outputFormat}`);
      return false;
  }
}
