import { encode as bmpEncode } from "bmp-ts";
import { PaletteIndex } from "../database/Types";
import { Point } from "../geometry/Point";
import { ColorRgb } from "./palette";
import { GifWriter } from "omggif";
import { Rectangle } from "../geometry/Rectangle";
import path from "path";
import { writeFileSync } from "fs";
import { Logger } from "../Logger";

export class RawImage {
  private width: number;
  private height: number;
  private data: Uint8Array;
  private palette: ColorRgb[];
  private anchor: Point<number>;

  constructor(
    width: number,
    height: number,
    defaultValue: PaletteIndex = 255 as PaletteIndex,
  ) {
    this.width = width;
    this.height = height;
    this.data = new Uint8Array(width * height);
    this.anchor = { x: 0, y: 0 };
    this.palette = [];
    this.data.fill(defaultValue);
  }

  setPixel(x: number, y: number, value: PaletteIndex): void {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      throw new Error("Pixel coordinates out of bounds");
    }
    this.data[y * this.width + x] = value;
  }

  getPixel(x: number, y: number): PaletteIndex {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      throw new Error("Pixel coordinates out of bounds");
    }
    return this.data[y * this.width + x] as PaletteIndex;
  }

  getRawData(): Uint8Array {
    return this.data;
  }

  setPalette(palette: ColorRgb[]): void {
    if (palette.length !== 256) {
      throw new Error("Palette must be exactly 256 colors!");
    }
    this.palette = palette;
  }

  setAnchor(offset: Point<number>) {
    this.anchor = { ...offset };
  }

  getAnchor() {
    return { ...this.anchor };
  }

  getPalette(): ColorRgb[] {
    return this.palette;
  }

  getWidth() {
    return this.width;
  }

  getHeight() {
    return this.height;
  }

  getBounds(): Rectangle<number> {
    return {
      left: -this.anchor.x,
      top: -this.anchor.y,
      right: this.width - this.anchor.x - 1,
      bottom: this.height - this.anchor.y - 1,
    };
  }

  overlayImage(image: RawImage, offset: Point<number> = { x: 0, y: 0 }) {
    const { x: otherAnchorX, y: otherAnchorY } = image.getAnchor();
    const imageOffsetX = this.anchor.x - otherAnchorX;
    const imageOffsetY = this.anchor.y - otherAnchorY;
    for (let y = 0; y < image.getHeight(); ++y) {
      for (let x = 0; x < image.getWidth(); ++x) {
        this.setPixel(
          x + offset.x + imageOffsetX,
          y + offset.y + imageOffsetY,
          image.getPixel(x, y),
        );
      }
    }
  }

  applyColormap(colormap: PaletteIndex[]) {
    this.data = this.data.map((entry) => colormap[entry]);
  }

  toBmpData(): Buffer {
    if (this.palette.length !== 256) {
      throw Error(
        `Attempted to convert RawImage to BMP but palette length was ${this.palette.length}`,
      );
    }
    return bmpEncode({
      data: Buffer.from(this.data),
      bitPP: 8,
      width: this.width,
      height: this.height,
      palette: this.palette.map((entry) => ({
        red: entry.red,
        green: entry.green,
        blue: entry.blue,
        quad: 0,
      })),
      colors: 256,
      importantColors: 256,
    }).data;
  }

  appendToGif(gifWriter: GifWriter, bounds: Rectangle<number>) {
    const offsetX = -this.anchor.x - bounds.left;
    const offsetY = -this.anchor.y - bounds.top;
    gifWriter.addFrame(
      offsetX,
      offsetY,
      this.width,
      this.height,
      Array.from(this.data),
      {
        delay: 10,
        disposal: 2,
        transparent: 255,
      },
    );
  }
}

function calculateImageArrayBounds(images: RawImage[]) {
  const currentBounds = images[0].getBounds();
  images.forEach((image, index) => {
    if (index > 0) {
      const nextBounds = image.getBounds();
      currentBounds.left = Math.min(currentBounds.left, nextBounds.left);
      currentBounds.top = Math.min(currentBounds.top, nextBounds.top);
      currentBounds.right = Math.max(currentBounds.right, nextBounds.right);
      currentBounds.bottom = Math.max(currentBounds.bottom, nextBounds.bottom);
    }
  });
  return currentBounds;
}

export function writeRawImages(
  outputFormat: "gif" | "bmp",
  images: RawImage[],
  palette: ColorRgb[],
  filename: string,
  outputDir: string,
) {
  switch (outputFormat) {
    case "bmp": {
      const bmpFiles = images.map((image) => image.toBmpData());
      bmpFiles.forEach((file, index) => {
        const outputPath = path.join(
          outputDir,
          `${path.parse(filename).name}_${index}.bmp`,
        );
        writeFileSync(outputPath, file);
        Logger.info(`Wrote ${outputPath}`);
      });
      return true;
    }
    case "gif": {
      const animationBounds = calculateImageArrayBounds(images);
      const animationWidth = animationBounds.right - animationBounds.left + 1;
      const animationHeight = animationBounds.bottom - animationBounds.top + 1;

      const mappedImages = images.map((image) => {
        const normalizedImage = new RawImage(animationWidth, animationHeight);
        normalizedImage.setAnchor({
          x: -animationBounds.left,
          y: -animationBounds.top,
        });
        normalizedImage.setPalette(image.getPalette());
        normalizedImage.overlayImage(image);
        return normalizedImage;
      });

      const gifBuffer = Buffer.alloc(
        1024 * 1024 + animationWidth * animationHeight * images.length,
      );
      const gifWriter = new GifWriter(
        gifBuffer,
        animationWidth,
        animationHeight,
        {
          loop: 0,
          palette: palette.map((entry) => {
            let value = +entry.blue;
            value |= entry.green << 8;
            value |= entry.red << 16;
            return value;
          }),
        },
      );
      mappedImages.forEach((image) => {
        image.appendToGif(gifWriter, animationBounds);
      });
      const gifData = gifBuffer.subarray(0, gifWriter.end());
      const outputPath = path.join(
        outputDir,
        `${path.parse(filename).name}.gif`,
      );
      writeFileSync(outputPath, gifData);
      Logger.info(`Wrote ${outputPath}`);
      return true;
    }
    default:
      Logger.error(`Invalid output format ${outputFormat}`);
      return false;
  }
}
