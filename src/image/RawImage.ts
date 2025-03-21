import { encode as bmpEncode } from "bmp-ts";
import { PaletteIndex } from "../database/Types";
import { Point } from "../geometry/Point";
import { ColorRgb } from "./palette";
import { GifWriter } from "omggif";
import { Rectangle } from "../geometry/Rectangle";

export class RawImage {
  private width: number;
  private height: number;
  private data: Uint8Array;
  private palette: ColorRgb[];
  private offset: Point<number>;

  constructor(
    width: number,
    height: number,
    defaultValue: PaletteIndex = 255 as PaletteIndex,
  ) {
    this.width = width;
    this.height = height;
    this.data = new Uint8Array(width * height);
    this.offset = { x: 0, y: 0 };
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

  setOffset(offset: Point<number>) {
    this.offset = offset;
  }

  getOffset() {
    return { ...this.offset };
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
    const offsetX = -this.offset.x - bounds.left;
    const offsetY = -this.offset.y - bounds.top;
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
