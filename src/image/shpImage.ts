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

    // SHP supports empty images where width < 0 and height < 0
    if (width > 0 && height > 0) {
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
    } else {
      // TODO: This is what Shape file Converter does, what should we really do...?
      const image = new RawImage(3, 3);
      image.setAnchor({ x: anchorX, y: anchorY });
      frames.push(image);
    }
  }

  return frames;
}

export function detectShpFile(bufferReader: BufferReader) {
  try {
    bufferReader.seek(0);
    const firstBytes = bufferReader.readFixedSizeString(4);
    if (firstBytes === "1.10") {
      const frameCount = bufferReader.readUInt32();
      // If all frame offsets seem plausible, we assume that this is an SHP file
      if (frameCount >= 1 && frameCount <= 1000) {
        const headerSize = 8 + frameCount * 8;
        const minimumFrameData = 4 * 2 + 4 * 4;
        const maxFrameOffset = bufferReader.size() - minimumFrameData;
        for (let i = 0; i < frameCount; ++i) {
          const frameOffset = bufferReader.readUInt32();
          const _paletteOffset = bufferReader.readUInt32();
          if (frameOffset < headerSize || frameOffset > maxFrameOffset) {
            return false;
          }
        }
        return true;
      }
    }
    return false;
  } catch (_e: unknown) {
    return false;
  }
}
