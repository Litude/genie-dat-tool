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
    const _smallestResourceId = buffer.readInt32<ResourceId>();
    const _largestResourceId = buffer.readInt32<ResourceId>();
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
      if (rscResourceId !== resourceId) {
        Logger.warn(
          `Different resource id specified in central directory and resource entry. ${resourceId} != ${rscResourceId}`,
        );
      }
      const entrySize = buffer.readUInt32();

      const extension = extensionMap[resourceType] ?? "bin";
      results.push(
        new FileEntry({
          data: buffer.slice(buffer.tell(), buffer.tell() + entrySize),
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
