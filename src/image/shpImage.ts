import BufferReader, { BufferReaderSeekWhence } from "../BufferReader";
import { PaletteIndex } from "../database/Types";
import { Rectangle } from "../geometry/Rectangle";
import { Int32 } from "../ts/base-types";
import { RawImage } from "./RawImage";

export function parseShpImage(buffer: BufferReader): RawImage[] {
  const header = buffer.readFixedSizeString(4);
  if (header !== "1.10") {
    throw new Error(`Invalid SHP file, header version not 1.10!`);
  }

  const frameCount = buffer.readUInt32();
  if (frameCount === 0) {
    throw new Error(`Invalid SHP file, frame count was 0!`);
  }
  const frames: RawImage[] = [];

  const frameOffsets: number[] = [];

  for (let i = 0; i < frameCount; ++i) {
    frameOffsets.push(buffer.readUInt32());
    buffer.readUInt32(); // skip palette
  }

  for (let i = 0; i < frameCount; i++) {
    buffer.seek(frameOffsets[i], BufferReaderSeekWhence.Start);

    const _boundY = buffer.readInt16();
    const _boundX = buffer.readInt16();
    const _originY = buffer.readInt16();
    const _originX = buffer.readInt16();
    const bounds: Rectangle<Int32> = {
      left: buffer.readInt32(),
      top: buffer.readInt32(),
      right: buffer.readInt32(),
      bottom: buffer.readInt32(),
    };

    const width = bounds.right - bounds.left + 1;
    const height = bounds.bottom - bounds.top + 1;
    const anchorX = -bounds.left;
    const anchorY = -bounds.top;

    const image = new RawImage(width, height);
    image.setAnchor({ x: anchorX, y: anchorY });

    for (let y = 0; y < height; y++) {
      let x = 0;
      let rowEnded = false;
      while (!rowEnded) {
        const command = buffer.readUInt8();
        const count = command >> 1;

        if (command === 1) {
          // Skip
          x += buffer.readUInt8();
        } else if (command & 0x01) {
          // Copy
          for (let i = 0; i < count; ++i) {
            image.setPixel(x++, y, buffer.readUInt8<PaletteIndex>());
          }
        } else if (command) {
          // RLE
          const color = buffer.readUInt8<PaletteIndex>();
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
