import BufferReader from "../BufferReader";
import { PaletteIndex } from "../database/Types";
import { Point } from "../geometry/Point";
import { Logger } from "../Logger";
import { asUInt8, Int32, UInt32 } from "../ts/base-types";
import { RawImage } from "./RawImage";

interface SlpFrameInfo {
  commandTableOffset: UInt32;
  outlineTableOffset: UInt32;
  paletteOffset: UInt32;
  properties: UInt32;
  width: Int32;
  height: Int32;
  anchor: Point<Int32>;
}

interface SlpParsingOptions {
  playerColor: number;
  shadowColor: number;
}

export function parseSlpImage(
  buffer: BufferReader,
  options: SlpParsingOptions,
): RawImage[] {
  const header = buffer.readFixedSizeString(4);
  if (header !== "2.0N") {
    throw new Error(`Invalid SLP file, header version ${header} not 2.0N!`);
  }

  const frameCount = buffer.readUInt32();
  if (frameCount === 0) {
    throw new Error(`Invalid SLP file, frame count was 0!`);
  }

  const comment = buffer.readFixedSizeString(24);
  if (
    comment !== "RGE RLE shape file" &&
    comment !== "ArtDesk 1.00 SLP Writer"
  ) {
    throw new Error(`Invalid SLP comment: ${comment}`);
  }

  if (comment === "ArtDesk 1.00 SLP Writer") {
    Logger.warn(`AOE2 extensions to SLP not yet supported, reading may fail`);
  }

  const frames: RawImage[] = [];
  const frameInfo: SlpFrameInfo[] = [];

  for (let i = 0; i < frameCount; ++i) {
    frameInfo.push({
      commandTableOffset: buffer.readUInt32(),
      outlineTableOffset: buffer.readUInt32(),
      paletteOffset: buffer.readUInt32(),
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
    for (let y = 0; y < currentFrame.height; ++y) {
      let x = 0;
      const outlineOffset = currentFrame.outlineTableOffset + 4 * y;
      buffer.seek(outlineOffset);
      const leftOffset = buffer.readInt16();
      const rightOffset = buffer.readInt16();
      if (leftOffset === -32768 || rightOffset === -32768) {
        continue;
      }

      const commandOffset = currentFrame.commandTableOffset + 4 * y;
      buffer.seek(commandOffset);
      buffer.seek(buffer.readUInt32());

      let rowEnded = false;
      while (!rowEnded) {
        const commandByte = buffer.readUInt8();
        const command = commandByte & 0xf;
        switch (command) {
          //Lesser draw
          case 0x00:
          case 0x04:
          case 0x08:
          case 0x0c: {
            const length = commandByte >> 2;
            for (let i = 0; i < length; ++i) {
              image.setPixel(
                x++ + leftOffset,
                y,
                buffer.readUInt8<PaletteIndex>(),
              );
            }
            break;
          }
          //Lesser skip
          case 0x01:
          case 0x05:
          case 0x09:
          case 0x0d: {
            const length = commandByte >> 2;
            x += length;
            break;
          }
          // Greater draw
          case 0x02: {
            const length = ((commandByte & 0xf0) << 4) + buffer.readUInt8();
            for (let i = 0; i < length; ++i) {
              image.setPixel(
                x++ + leftOffset,
                y,
                buffer.readUInt8<PaletteIndex>(),
              );
            }
            break;
          }
          // Greater skip
          case 0x03: {
            const length = ((commandByte & 0xf0) << 4) + buffer.readUInt8();
            x += length;
            break;
          }
          // Player color
          case 0x06: {
            let length = commandByte >> 4;
            if (!length) {
              length = buffer.readUInt8();
            }
            for (let i = 0; i < length; ++i) {
              const colorOffset = buffer.readUInt8<PaletteIndex>();
              const color = asUInt8<PaletteIndex>(
                colorOffset + options.playerColor,
              );
              image.setPixel(x++ + leftOffset, y, color);
            }
            break;
          }
          // Fill
          case 0x07: {
            let length = commandByte >> 4;
            if (!length) {
              length = buffer.readUInt8();
            }
            const color = buffer.readUInt8<PaletteIndex>();
            for (let i = 0; i < length; ++i) {
              image.setPixel(x++ + leftOffset, y, color);
            }
            break;
          }
          // Fill player color
          case 0x0a: {
            let length = commandByte >> 4;
            if (!length) {
              length = buffer.readUInt8();
            }
            const colorOffset = buffer.readUInt8<PaletteIndex>();
            const color = asUInt8<PaletteIndex>(
              colorOffset + options.playerColor,
            );
            for (let i = 0; i < length; ++i) {
              image.setPixel(x++ + leftOffset, y, color);
            }
            break;
          }
          // Fill shadow color
          case 0x0b: {
            let length = commandByte >> 4;
            if (!length) {
              length = buffer.readUInt8();
            }
            const color = asUInt8<PaletteIndex>(options.shadowColor);
            for (let i = 0; i < length; ++i) {
              image.setPixel(x++ + leftOffset, y, color);
            }
            break;
          }
          // Extended command
          case 0x0e: {
            const extendedData = buffer.readUInt8();
            Logger.error("Extended command 0x%02x\n", extendedData);
            break;
          }
          // End of row
          case 0x0f:
            rowEnded = true;
            break;
          default:
            Logger.error("Unimplemented command 0x%02x\n", command);
            break;
        }
      }
    }
    frames.push(image);
  }

  return frames;
}

export function detectSlpFile(bufferReader: BufferReader) {
  try {
    bufferReader.seek(0);
    const firstBytes = bufferReader.readFixedSizeString(4);
    if (firstBytes === "2.0N") {
      const frameCount = bufferReader.readUInt32();
      if (frameCount >= 1 && frameCount <= 10000) {
        const comment = bufferReader.readFixedSizeString(24);
        return (
          comment === "RGE RLE shape file" ||
          comment === "ArtDesk 1.00 SLP Writer"
        );
      }
    }
    return false;
  } catch (_e: unknown) {
    return false;
  }
}
