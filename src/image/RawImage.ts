import { PaletteIndex } from "../database/Types";
import { Point } from "../geometry/Point";
import { GifWriter } from "omggif";
import { Rectangle } from "../geometry/Rectangle";
import { ColorRgb } from "./palette";
import { Logger } from "../Logger";

export class RawImage {
  width: number;
  height: number;
  data: Array<PaletteIndex | null>;
  anchor: Point<number>;
  palette?: ColorRgb[]; // If a frame has a palette, it overrides the palette used by the graphic (needed for water animation)
  delay?: number; // If specified, overrides default delay

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = Array(width * height).fill(null);
    this.anchor = { x: 0, y: 0 };
  }

  isValid() {
    return this.anchor.x > -32768 && this.anchor.y > -32768;
  }

  hasWaterAnimation() {
    return this.data.some(
      (color) => color !== null && color >= 248 && color <= 254,
    );
  }

  setPixel(x: number, y: number, value: PaletteIndex | null): void {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      Logger.error("pixel coordinates out of bounds");
      //throw new Error("Pixel coordinates out of bounds");
    } else {
      this.data[y * this.width + x] = value;
    }
  }

  getPixel(x: number, y: number): PaletteIndex | null {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      throw new Error("Pixel coordinates out of bounds");
    }
    return this.data[y * this.width + x];
  }

  getRawData() {
    return this.data;
  }

  setAnchor(offset: Point<number>) {
    this.anchor = { ...offset };
  }

  getAnchor() {
    return { ...this.anchor };
  }

  getWidth() {
    return this.width;
  }

  getHeight() {
    return this.height;
  }

  // These bounds are right, bottom inclusive!
  getBounds(): Rectangle<number> {
    return {
      left: -this.anchor.x,
      top: -this.anchor.y,
      right: this.width - this.anchor.x - 1,
      bottom: this.height - this.anchor.y - 1,
    };
  }

  overlayImage(image: RawImage, offset: Point<number> = { x: 0, y: 0 }) {
    if (image.isValid()) {
      const { x: otherAnchorX, y: otherAnchorY } = image.getAnchor();
      const imageOffsetX = this.anchor.x - otherAnchorX;
      const imageOffsetY = this.anchor.y - otherAnchorY;
      for (let y = 0; y < image.getHeight(); ++y) {
        for (let x = 0; x < image.getWidth(); ++x) {
          const value = image.getPixel(x, y);
          if (value !== null) {
            this.setPixel(
              x + offset.x + imageOffsetX,
              y + offset.y + imageOffsetY,
              value,
            );
          }
        }
      }
    }
  }

  flippedHorizontally() {
    const flippedImage = this.clone();
    flippedImage.flipHorizontally();
    return flippedImage;
  }

  clone() {
    const cloned = new RawImage(this.width, this.height);
    cloned.anchor = structuredClone(this.anchor);
    cloned.data = structuredClone(this.data);
    cloned.palette = this.palette ? structuredClone(this.palette) : undefined;
    cloned.delay = this.delay;
    return cloned;
  }

  private flipHorizontally() {
    const newAnchorX = this.width - this.anchor.x - 1;
    for (let y = 0; y < this.height; ++y) {
      for (let x = 0; x < Math.floor(this.width / 2); ++x) {
        const leftPixel = this.getPixel(x, y);
        const rightPixel = this.getPixel(this.width - 1 - x, y);
        this.setPixel(x, y, rightPixel);
        this.setPixel(this.width - 1 - x, y, leftPixel);
      }
    }
    this.anchor.x = newAnchorX;
  }

  applyColormap(colormap: PaletteIndex[]) {
    this.data = this.data.map((entry) =>
      entry !== null ? colormap[entry] : entry,
    );
  }

  appendToGif(
    gifWriter: GifWriter,
    bounds: Rectangle<number>,
    {
      delay,
      transparentIndex,
    }: { delay: number; transparentIndex: number | undefined } = {
      delay: 10,
      transparentIndex: undefined,
    },
  ) {
    const offsetX = -this.anchor.x - bounds.left;
    const offsetY = -this.anchor.y - bounds.top;
    const useTransparency = this.data.some((entry) => entry === null);
    gifWriter.addFrame(
      offsetX,
      offsetY,
      this.width,
      this.height,
      this.data.map((entry) => {
        if (entry === null) {
          if (transparentIndex === undefined) {
            throw new Error(
              `Tried writing GIF but entry has transparent color and no index has been specified!`,
            );
          } else {
            return transparentIndex;
          }
        } else {
          return entry;
        }
      }),
      {
        delay: this.delay ?? delay,
        disposal: 2,
        transparent: useTransparency ? transparentIndex : undefined,
        palette: this.palette?.map((entry) => {
          let value = +entry.blue;
          value |= entry.green << 8;
          value |= entry.red << 16;
          return value;
        }),
      },
    );
  }
}
