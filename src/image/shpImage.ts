import BufferReader, { BufferReaderSeekWhence } from "../BufferReader";
import { PaletteIndex } from "../database/Types";
import { Rectangle } from "../geometry/Rectangle";
import { Int32 } from "../ts/base-types";
import { RawImage } from "./RawImage";

export function parseShpImage(shpData: BufferReader): RawImage[] {
  const header = shpData.readFixedSizeString(4);
  if (header !== "1.10") {
    throw new Error(`Invalid SHP file, header version not 1.10!`);
  }

  const frameCount = shpData.readUInt32();
  if (frameCount === 0) {
    throw new Error(`Invalid SHP file, frame count was 0!`);
  }
  const frames: RawImage[] = [];

  const frameOffsets: number[] = [];

  for (let i = 0; i < frameCount; ++i) {
    frameOffsets.push(shpData.readUInt32());
    shpData.readUInt32(); // skip palette
  }

  for (let i = 0; i < frameCount; i++) {
    shpData.seek(frameOffsets[i], BufferReaderSeekWhence.Start);

    const _boundY = shpData.readInt16();
    const _boundX = shpData.readInt16();
    const _originY = shpData.readInt16();
    const _originX = shpData.readInt16();
    const bounds: Rectangle<Int32> = {
      left: shpData.readInt32(),
      top: shpData.readInt32(),
      right: shpData.readInt32(),
      bottom: shpData.readInt32(),
    };

    const width = bounds.right - bounds.left + 1;
    const height = bounds.bottom - bounds.top + 1;
    const offsetX = -bounds.left;
    const offsetY = -bounds.top;

    const image = new RawImage(width, height);
    image.setOffset({ x: offsetX, y: offsetY });

    for (let y = 0; y < height; y++) {
      let x = 0;
      let rowEnded = false;
      while (!rowEnded) {
        const command = shpData.readUInt8();
        const count = command >> 1;

        if (command === 1) {
          // Skip
          x += shpData.readUInt8();
        } else if (command & 0x01) {
          // Copy
          for (let i = 0; i < count; ++i) {
            image.setPixel(x++, y, shpData.readUInt8<PaletteIndex>());
          }
        } else if (command) {
          // RLE
          const color = shpData.readUInt8<PaletteIndex>();
          for (let i = 0; i < count; ++i) {
            image.setPixel(x++, y, color);
          }
        } else {
          // command === 0
          // End of row
          rowEnded = true;
        }
      }
    }

    frames.push(image);
  }

  return frames;
}
