import { readFileSync, statSync } from "fs";
import BufferReader, { BufferReaderSeekWhence } from "../BufferReader";
import { Logger } from "../Logger";
import { UInt32 } from "../ts/base-types";
import { FileEntry } from "../files/FileEntry";
import { ResourceId } from "../database/Types";

interface ResourceTypeDirectory {
  resourceType: string;
  entryDirectoryOffset: UInt32;
  entryCount: UInt32;
}

const extensionMap: Record<string, string> = {
  voc: "voc",
  wav: "wav",
  ilbm: "lbm",
  pcx: "pcx",
  gif: "gif",
  shp: "shp",
  slp: "slp",
  cell: "cel",
  ccsr: "ccs",
  ront: "fnt",
  rgbp: "rgb",
  bina: "bin",
};

export class DrsFile {
  static readFromFile(path: string): FileEntry[] {
    const compressedData = readFileSync(path);
    const fileStats = statSync(path);
    return this.readFromBuffer(
      new BufferReader(compressedData),
      fileStats.mtimeMs,
    );
  }

  static readFromBuffer(
    buffer: BufferReader,
    modificationTime: number,
  ): FileEntry[] {
    const headerString = buffer.readFixedSizeString(40).slice(0, 36);
    if (headerString === "Copyright (c) 1996 Ensemble Studios.") {
      return this.readDrs1996(buffer, modificationTime);
    } else if (headerString === "Copyright (c) 1997 Ensemble Studios.") {
      return this.readDrs1997(buffer, modificationTime);
    } else {
      Logger.error(
        `Encountered unrecognized DRS header ${headerString}, perhaps it is not a DRS file`,
      );
      return [];
    }
  }

  private static readDrs1996(
    buffer: BufferReader,
    modificationTime: number,
  ): FileEntry[] {
    buffer.seek(-271, BufferReaderSeekWhence.End);
    const version = buffer.readUInt8();
    if (version !== 1) {
      Logger.error(`Encountered unsupported DRS 1996 version ${version}`);
      return [];
    }
    const internalFilename = buffer.readFixedSizeString(260);
    Logger.info(`DRS internal filename is ${internalFilename}`);

    const password = buffer.readFixedSizeString(10);
    if (password !== "tribe") {
      Logger.warn(
        `Encountered DRS file with unexpected password ${password}, continuing anyway`,
      );
    }

    buffer.seek(40, BufferReaderSeekWhence.Start);
    const smallestResourceId = buffer.readInt32<ResourceId>();
    const largestResourceId = buffer.readInt32<ResourceId>();
    const entryCount = buffer.readUInt32();

    const results: FileEntry[] = [];

    for (let i = 0; i < entryCount; ++i) {
      const resourceType = buffer
        .readFixedSizeString(4)
        .split("")
        .reverse()
        .join("")
        .trim();
      const resourceId = buffer.readInt32<ResourceId>();
      if (resourceId < smallestResourceId) {
        Logger.warn(
          `Smallest resource id should be ${smallestResourceId}, but found resource with id ${resourceId}`,
        );
      }
      if (resourceId > largestResourceId) {
        Logger.warn(
          `Largest resource id should be ${largestResourceId}, but found resource with id ${resourceId}`,
        );
      }

      const rscDataOffset = buffer.readUInt32();

      const currentDirectoryOffset = buffer.tell();
      buffer.seek(rscDataOffset);

      const rscResourceType = buffer
        .readFixedSizeString(4)
        .split("")
        .reverse()
        .join("")
        .trim();

      if (rscResourceType !== resourceType) {
        Logger.error(
          `Different resource type specified in central directory and resource entry for ${resourceId}. ${resourceType} != ${rscResourceType}`,
        );
        return [];
      }
      const rscResourceId = buffer.readInt32<ResourceId>();
      // There are official files where these don't match, so only log a warning
      // If this occurs in an official file, it should mean that the data for both resources is identical
      if (rscResourceId !== resourceId) {
        Logger.warn(
          `Different resource id specified in central directory and resource entry. ${resourceId} != ${rscResourceId}`,
        );
      }
      const entrySize = buffer.readUInt32();

      let extension = extensionMap[resourceType] ?? "bin";
      const data = buffer.slice(buffer.tell(), buffer.tell() + entrySize);
      if (extension === "bin") {
        extension = detectBinaryFileType(data);
      }

      results.push(
        new FileEntry({
          data,
          resourceId,
          filename: `${resourceId}.${extension}`,
          modificationTime,
        }),
      );

      buffer.seek(currentDirectoryOffset);
    }

    Logger.info(`Finished parsing DRS, got ${results.length} files`);

    return results;
  }

  private static readDrs1997(
    buffer: BufferReader,
    modificationTime: number,
  ): FileEntry[] {
    const version = buffer.readFixedSizeString(4);
    if (version !== "1.00") {
      Logger.error(`Encountered unsupported DRS 1997 version ${version}`);
      return [];
    }

    const password = buffer.readFixedSizeString(12);
    if (password !== "tribe") {
      Logger.warn(
        `Encountered DRS file with unexpected password ${password}, continuing anyway`,
      );
    }

    const resourceTypeDirectories: ResourceTypeDirectory[] = [];

    const resourceTypes = buffer.readInt32();
    const _directorySize = buffer.readUInt32();

    for (let i = 0; i < resourceTypes; ++i) {
      resourceTypeDirectories.push({
        resourceType: buffer
          .readFixedSizeString(4)
          .split("")
          .reverse()
          .join("")
          .trim(),
        entryDirectoryOffset: buffer.readUInt32(),
        entryCount: buffer.readUInt32(),
      });
    }

    const results: FileEntry[] = [];

    resourceTypeDirectories.forEach((directory) => {
      const resourceType = directory.resourceType;
      buffer.seek(directory.entryDirectoryOffset);
      for (let i = 0; i < directory.entryCount; ++i) {
        const resourceId = buffer.readInt32<ResourceId>();
        const dataOffset = buffer.readUInt32();
        const entrySize = buffer.readUInt32();
        const extension = extensionMap[resourceType] ?? "bin";
        results.push(
          new FileEntry({
            data: buffer.slice(dataOffset, dataOffset + entrySize),
            resourceId,
            filename: `${resourceId}.${extension}`,
            modificationTime,
          }),
        );
      }
    });

    Logger.info(`Finished parsing DRS, got ${results.length} files`);

    return results;
  }
}

function checkIfWavFile(bufferReader: BufferReader) {
  try {
    bufferReader.seek(0);
    const firstBytes = bufferReader.readFixedSizeString(4);
    if (firstBytes === "RIFF") {
      bufferReader.seek(8);
      return bufferReader.readFixedSizeString(8) === "WAVEfmt ";
    }
    return false;
  } catch (_e: unknown) {
    return false;
  }
}

function checkIfBmpFile(bufferReader: BufferReader) {
  try {
    bufferReader.seek(0);
    const firstBytes = bufferReader.readFixedSizeString(2);
    if (firstBytes === "BM") {
      const fileSize = bufferReader.readUInt32();
      return fileSize === bufferReader.size();
    }
    return false;
  } catch (_e: unknown) {
    return false;
  }
}

function checkIfShpFile(bufferReader: BufferReader) {
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

function checkIfSlpFile(bufferReader: BufferReader) {
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

function checkIfPalFile(bufferReader: BufferReader) {
  try {
    if (bufferReader.isAscii()) {
      const contents = bufferReader.toString("ascii").trim();
      return contents.startsWith("JASC-PAL");
    }
    return false;
  } catch (_e: unknown) {
    return false;
  }
}

function checkIfSinFile(bufferReader: BufferReader) {
  try {
    if (bufferReader.isAscii()) {
      const contents = bufferReader.toString("ascii").trim();
      return contents.startsWith("background1_files ");
    }
    return false;
  } catch (_e: unknown) {
    return false;
  }
}

function checkIfColFile(bufferReader: BufferReader) {
  try {
    if (bufferReader.isAscii()) {
      const contents = bufferReader.toString("ascii").trim();
      const validLines = contents.split("\r\n").filter((line) => line);
      if (validLines.length === 256) {
        return validLines.every((line) => {
          const num = Number(line);
          if (!Number.isInteger(num) || num < 0 || num > 255) {
            return false;
          }
          return true;
        });
      }
    }
    return false;
  } catch (_e: unknown) {
    return false;
  }
}

function checkIfDatFile(bufferReader: BufferReader) {
  // Not really a good check at the moment...
  try {
    bufferReader.seek(0);
    if (bufferReader.size() === 147304) {
      const firstInt = bufferReader.readInt32();
      if (firstInt === 68) {
        bufferReader.seek(-4, BufferReaderSeekWhence.End);
        return bufferReader.readInt32() === -192;
      }
    }
    return false;
  } catch (_e: unknown) {
    return false;
  }
}

function detectBinaryFileType(data: Buffer<ArrayBufferLike>): string {
  const bufferReader = new BufferReader(data);
  // 1996 DRS format files have bin for wav, shp and slp as well so need to detect these too...
  if (checkIfWavFile(bufferReader)) {
    return "wav";
  } else if (checkIfBmpFile(bufferReader)) {
    return "bmp";
  } else if (checkIfShpFile(bufferReader)) {
    return "shp";
  } else if (checkIfSlpFile(bufferReader)) {
    return "slp";
  } else if (checkIfPalFile(bufferReader)) {
    return "pal";
  } else if (checkIfSinFile(bufferReader)) {
    return "sin";
  } else if (checkIfColFile(bufferReader)) {
    return "col";
  } else if (checkIfDatFile(bufferReader)) {
    return "dat";
  } else {
    return "bin";
  }
}
