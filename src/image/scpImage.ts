import BufferReader from "../BufferReader";
import { PaletteIndex } from "../database/Types";
import { Point } from "../geometry/Point";
import { Logger } from "../Logger";
import { Int32, UInt32 } from "../ts/base-types";
import { RawImage } from "./RawImage";

interface ScpFrameInfo {
  dataOffset: UInt32;
  outlineTableOffset: UInt32;
  drawFunction: Int32;
  properties: UInt32;
  width: Int32;
  height: Int32;
  anchor: Point<Int32>;
}

export function parseScpImage(buffer: BufferReader): RawImage[] {
  const header = buffer.readFixedSizeString(4);
  if (header !== "2.0C") {
    throw new Error(`Invalid SCP file, header version ${header} not 2.0C!`);
  }

  const frameCount = buffer.readUInt32();
  if (frameCount === 0) {
    throw new Error(`Invalid SCP file, frame count was 0!`);
  }

  const comment = buffer.readFixedSizeString(24);
  if (comment !== "RGE Compiled shape file") {
    throw new Error(`Invalid SCP comment: ${comment}`);
  }

  const frames: RawImage[] = [];
  const frameInfo: ScpFrameInfo[] = [];

  for (let i = 0; i < frameCount; ++i) {
    frameInfo.push({
      dataOffset: buffer.readUInt32(),
      outlineTableOffset: buffer.readUInt32(),
      drawFunction: buffer.readInt32(),
      properties: buffer.readUInt32(),
      width: buffer.readInt32(),
      height: buffer.readInt32(),
      anchor: {
        x: buffer.readInt32(),
        y: buffer.readInt32(),
      },
    });
  }

  for (let i = 0; i < frameCount; ++i) {
    const currentFrame = frameInfo[i];
    const image = new RawImage(currentFrame.width, currentFrame.height);
    image.setAnchor(currentFrame.anchor);
    let dataOffset: number = currentFrame.dataOffset;
    for (let y = 0; y < currentFrame.height; ++y) {
      const outlineOffset = currentFrame.outlineTableOffset + 8 * y;
      buffer.seek(outlineOffset);
      const leftOffset = buffer.readInt32();
      const rightOffset = buffer.readInt32();
      const rowPixelCount = currentFrame.width - (leftOffset + rightOffset);
      if (rowPixelCount > 0) {
        buffer.seek(dataOffset);
        if (rowPixelCount % 4 === 0 && leftOffset % 4 === 0) {
          for (let i = 0; i < rowPixelCount; ++i) {
            image.setPixel(leftOffset + i, y, buffer.readUInt8<PaletteIndex>());
          }
        } else {
          const alignedLeft = (leftOffset + 3) & ~0x3;

          const leftRemaining = Math.min(
            alignedLeft - leftOffset,
            rowPixelCount,
          );

          const temp = rowPixelCount - leftRemaining;
          const rightRemaining = temp % 4;
          const directCopyCount = temp - rightRemaining;

          for (let i = 0; i < directCopyCount; ++i) {
            image.setPixel(
              alignedLeft + i,
              y,
              buffer.readUInt8<PaletteIndex>(),
            );
          }
          if (leftRemaining === 3 && rightRemaining === 3) {
            image.setPixel(leftOffset + 1, y, buffer.readUInt8<PaletteIndex>());
            image.setPixel(
              currentFrame.width - rightOffset - 2,
              y,
              buffer.readUInt8<PaletteIndex>(),
            );
            image.setPixel(
              currentFrame.width - rightOffset - 3,
              y,
              buffer.readUInt8<PaletteIndex>(),
            );
            image.setPixel(leftOffset, y, buffer.readUInt8<PaletteIndex>());
            image.setPixel(
              currentFrame.width - rightOffset - 1,
              y,
              buffer.readUInt8<PaletteIndex>(),
            );
            image.setPixel(leftOffset + 2, y, buffer.readUInt8<PaletteIndex>());
          } else if (leftRemaining === 3 && rightRemaining === 2) {
            image.setPixel(leftOffset + 1, y, buffer.readUInt8<PaletteIndex>());
            image.setPixel(
              currentFrame.width - rightOffset - 1,
              y,
              buffer.readUInt8<PaletteIndex>(),
            );
            image.setPixel(
              currentFrame.width - rightOffset - 2,
              y,
              buffer.readUInt8<PaletteIndex>(),
            );
            image.setPixel(leftOffset, y, buffer.readUInt8<PaletteIndex>());
            buffer.readUInt8<PaletteIndex>();
            image.setPixel(leftOffset + 2, y, buffer.readUInt8<PaletteIndex>());
          } else if (leftRemaining === 3 && rightRemaining === 1) {
            image.setPixel(leftOffset + 1, y, buffer.readUInt8<PaletteIndex>());
            image.setPixel(leftOffset, y, buffer.readUInt8<PaletteIndex>());
            image.setPixel(
              currentFrame.width - rightOffset - 1,
              y,
              buffer.readUInt8<PaletteIndex>(),
            );
            image.setPixel(leftOffset + 2, y, buffer.readUInt8<PaletteIndex>());
          } else if (leftRemaining === 3 && rightRemaining === 0) {
            image.setPixel(leftOffset + 1, y, buffer.readUInt8<PaletteIndex>());
            image.setPixel(leftOffset, y, buffer.readUInt8<PaletteIndex>());
            buffer.readUInt8<PaletteIndex>();
            image.setPixel(leftOffset + 2, y, buffer.readUInt8<PaletteIndex>());
          } else if (leftRemaining === 2 && rightRemaining === 3) {
            image.setPixel(leftOffset, y, buffer.readUInt8<PaletteIndex>());
            image.setPixel(
              currentFrame.width - rightOffset - 2,
              y,
              buffer.readUInt8<PaletteIndex>(),
            );
            image.setPixel(
              currentFrame.width - rightOffset - 3,
              y,
              buffer.readUInt8<PaletteIndex>(),
            );
            image.setPixel(leftOffset + 1, y, buffer.readUInt8<PaletteIndex>());
            image.setPixel(
              currentFrame.width - rightOffset - 1,
              y,
              buffer.readUInt8<PaletteIndex>(),
            );
          } else if (leftRemaining === 2 && rightRemaining === 2) {
            image.setPixel(leftOffset, y, buffer.readUInt8<PaletteIndex>());
            image.setPixel(
              currentFrame.width - rightOffset - 1,
              y,
              buffer.readUInt8<PaletteIndex>(),
            );
            image.setPixel(
              currentFrame.width - rightOffset - 2,
              y,
              buffer.readUInt8<PaletteIndex>(),
            );
            image.setPixel(leftOffset + 1, y, buffer.readUInt8<PaletteIndex>());
          } else if (leftRemaining === 2 && rightRemaining === 1) {
            image.setPixel(leftOffset, y, buffer.readUInt8<PaletteIndex>());
            image.setPixel(leftOffset + 1, y, buffer.readUInt8<PaletteIndex>());
            image.setPixel(
              currentFrame.width - rightOffset - 1,
              y,
              buffer.readUInt8<PaletteIndex>(),
            );
          } else if (leftRemaining === 2 && rightRemaining === 0) {
            image.setPixel(leftOffset, y, buffer.readUInt8<PaletteIndex>());
            image.setPixel(leftOffset + 1, y, buffer.readUInt8<PaletteIndex>());
          } else if (leftRemaining === 1 && rightRemaining === 3) {
            image.setPixel(
              currentFrame.width - rightOffset - 3,
              y,
              buffer.readUInt8<PaletteIndex>(),
            );
            image.setPixel(leftOffset, y, buffer.readUInt8<PaletteIndex>());
            image.setPixel(
              currentFrame.width - rightOffset - 1,
              y,
              buffer.readUInt8<PaletteIndex>(),
            );
            image.setPixel(
              currentFrame.width - rightOffset - 2,
              y,
              buffer.readUInt8<PaletteIndex>(),
            );
          } else if (leftRemaining === 1 && rightRemaining === 2) {
            image.setPixel(
              currentFrame.width - rightOffset - 2,
              y,
              buffer.readUInt8<PaletteIndex>(),
            );
            image.setPixel(leftOffset, y, buffer.readUInt8<PaletteIndex>());
            buffer.readUInt8<PaletteIndex>();
            image.setPixel(
              currentFrame.width - rightOffset - 1,
              y,
              buffer.readUInt8<PaletteIndex>(),
            );
          } else if (leftRemaining === 1 && rightRemaining === 1) {
            image.setPixel(
              currentFrame.width - rightOffset - 1,
              y,
              buffer.readUInt8<PaletteIndex>(),
            );
            image.setPixel(leftOffset, y, buffer.readUInt8<PaletteIndex>());
          } else if (leftRemaining === 1 && rightRemaining === 0) {
            buffer.readUInt8<PaletteIndex>();
            image.setPixel(leftOffset, y, buffer.readUInt8<PaletteIndex>());
          } else if (leftRemaining === 0 && rightRemaining === 3) {
            image.setPixel(
              currentFrame.width - rightOffset - 3,
              y,
              buffer.readUInt8<PaletteIndex>(),
            );
            image.setPixel(
              currentFrame.width - rightOffset - 2,
              y,
              buffer.readUInt8<PaletteIndex>(),
            );
            image.setPixel(
              currentFrame.width - rightOffset - 1,
              y,
              buffer.readUInt8<PaletteIndex>(),
            );
          } else if (leftRemaining === 0 && rightRemaining === 2) {
            image.setPixel(
              currentFrame.width - rightOffset - 2,
              y,
              buffer.readUInt8<PaletteIndex>(),
            );
            image.setPixel(
              currentFrame.width - rightOffset - 1,
              y,
              buffer.readUInt8<PaletteIndex>(),
            );
          } else if (leftRemaining === 0 && rightRemaining === 1) {
            image.setPixel(
              currentFrame.width - rightOffset - 1,
              y,
              buffer.readUInt8<PaletteIndex>(),
            );
          } else {
            Logger.error(
              `Unimplemented in frame ${i} row ${y}: Left ${leftRemaining}, Right ${rightRemaining}`,
            );
          }
        }
      }

      // All rows are padded to a multiple of 4;
      const rowByteCount = (rowPixelCount + 3) & ~0x3;
      dataOffset += rowByteCount;
    }
    frames.push(image);
  }

  return frames;
}

export function detectScpFile(bufferReader: BufferReader) {
  try {
    bufferReader.seek(0);
    const firstBytes = bufferReader.readFixedSizeString(4);
    if (firstBytes === "2.0C") {
      const frameCount = bufferReader.readUInt32();
      if (frameCount >= 1 && frameCount <= 10000) {
        const comment = bufferReader.readFixedSizeString(24);
        return comment === "RGE Compiled shape file";
      }
    }
    return false;
  } catch (_e: unknown) {
    return false;
  }
}
