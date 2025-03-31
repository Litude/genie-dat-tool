import { readFileSync, statSync } from "fs";
import BufferReader, { BufferReaderSeekWhence } from "../BufferReader";
import { Logger } from "../Logger";
import { asInt32, UInt32 } from "../ts/base-types";
import { FileEntry } from "../files/FileEntry";
import { ResourceId } from "../database/Types";
import { ParsingError } from "../database/Error";
import { TextFileWriter } from "../textfile/TextFileWriter";
import path from "path";
import { detectColormapFile } from "../image/colormap";
import { detectJascPaletteFile, readPaletteFile } from "../image/palette";
import { detectSlpFile } from "../image/slpImage";
import { detectShpFile } from "../image/shpImage";
import { detectBitmapFile } from "../image/bitmap";
import { ResourceDescriptor } from "./ResourceDescriptor";
import { detectSinFile, ScreenInformation } from "./ScreenInformation";
import { isDefined } from "../ts/ts-utils";

interface ResourceTypeDirectory {
  resourceType: string;
  entryDirectoryOffset: UInt32;
  entryCount: UInt32;
}

interface DrsParsingResult {
  files: FileEntry[];
  filename: string | null;
  password: string;
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

export function readFromFile(path: string): DrsParsingResult {
  const compressedData = readFileSync(path);
  const fileStats = statSync(path);
  return readFromBuffer(new BufferReader(compressedData), fileStats.mtimeMs);
}

export function readFromBuffer(
  buffer: BufferReader,
  modificationTime: number,
): DrsParsingResult {
  const headerString = buffer.readFixedSizeString(40).slice(0, 36);
  let result: DrsParsingResult;
  if (headerString === "Copyright (c) 1996 Ensemble Studios.") {
    result = readDrs1996(buffer, modificationTime);
  } else if (headerString === "Copyright (c) 1997 Ensemble Studios.") {
    result = readDrs1997(buffer, modificationTime);
  } else {
    Logger.error(
      `Encountered unrecognized DRS header ${headerString}, perhaps it is not a DRS file`,
    );
    throw new ParsingError(
      `Encountered unrecognized DRS header ${headerString}, perhaps it is not a DRS file`,
    );
  }
  if (result.files.length) {
    Logger.info(`Finished parsing DRS, got ${result.files.length} files`);
  }
  return result;
}

export function detectBinaryFileTypes(entries: FileEntry[]) {
  entries.forEach((entry) => {
    if (entry.filename.endsWith(".bin")) {
      const extension = detectBinaryFileType(entry.data);
      if (extension !== "bin") {
        entry.filename = entry.filename.slice(0, -3) + extension;
      }
    }
  });
}

export function extractScreenInformationResources(entries: FileEntry[]) {
  return entries
    .map((entry) => {
      if (entry.filename.endsWith(".sin")) {
        const { data, ...rest } = entry;
        return {
          ...rest,
          screenInfo: ScreenInformation.readFromBuffer(new BufferReader(data)),
        };
      } else {
        return null;
      }
    })
    .filter(isDefined);
}

export function extractPaletteResources(entries: FileEntry[]) {
  return entries
    .map((entry) => {
      if (entry.filename.endsWith(".pal")) {
        const { data, ...rest } = entry;
        return {
          ...rest,
          palette: readPaletteFile(new BufferReader(data)),
        };
      } else {
        return null;
      }
    })
    .filter(isDefined);
}

export function extractFilenamesFromResources(entries: FileEntry[]) {
  const defaultNames: Record<string, string> = {};
  const extraNames: Record<string, ResourceId> = {};

  const screenInfoResources = extractScreenInformationResources(entries);
  const extractedFilenames: ResourceDescriptor[] = screenInfoResources.flatMap(
    (screenInfoResource) =>
      screenInfoResource.screenInfo.getAllResourceDescriptors(),
  );

  // Graphic files could be either slp or shp, but we can use the previously detected
  // extension to determine this
  extractedFilenames.forEach((filenameEntry) => {
    if (filenameEntry.filename.endsWith(".slp")) {
      const dataEntry = entries.find(
        (entry) => entry.resourceId === filenameEntry.resourceId,
      );
      if (dataEntry && dataEntry.filename.endsWith(".shp")) {
        filenameEntry.filename = filenameEntry.filename.slice(0, -3) + "shp";
      }
    }
  });

  extractedFilenames.forEach((filenameEntry) => {
    if (!defaultNames[filenameEntry.resourceId]) {
      defaultNames[filenameEntry.resourceId] = filenameEntry.filename;
    } else if (
      defaultNames[filenameEntry.resourceId].toLocaleLowerCase() !==
      filenameEntry.filename.toLocaleLowerCase()
    ) {
      Logger.warn(
        `Found multiple filenames for resource ${filenameEntry.resourceId}: ${filenameEntry.filename} and ${defaultNames[filenameEntry.resourceId]}. The resource will be duplicated so that both will be used!`,
      );
      extraNames[filenameEntry.filename] = filenameEntry.resourceId;
    }
  });

  return { defaultNames, extraNames };
}

function readDrs1996(
  buffer: BufferReader,
  modificationTime: number,
): DrsParsingResult {
  buffer.seek(-271, BufferReaderSeekWhence.End);
  const version = buffer.readUInt8();
  if (version !== 1) {
    Logger.error(`Encountered unsupported DRS 1996 version ${version}`);
    throw new ParsingError(
      `Encountered unsupported DRS 1996 version ${version}`,
    );
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
      throw new ParsingError(
        `Different resource type specified in central directory and resource entry for ${resourceId}. ${resourceType} != ${rscResourceType}`,
      );
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

  return {
    files: results,
    password,
    filename: internalFilename,
  };
}

function readDrs1997(
  buffer: BufferReader,
  modificationTime: number,
): DrsParsingResult {
  const version = buffer.readFixedSizeString(4);
  if (version !== "1.00") {
    Logger.error(`Encountered unsupported DRS 1997 version ${version}`);
    throw new ParsingError(
      `Encountered unsupported DRS 1997 version ${version}`,
    );
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

  let largestResourceId = asInt32<ResourceId>(0);
  let smallestResourceId = asInt32<ResourceId>(100000);

  resourceTypeDirectories.forEach((directory) => {
    const resourceType = directory.resourceType;
    buffer.seek(directory.entryDirectoryOffset);
    for (let i = 0; i < directory.entryCount; ++i) {
      const resourceId = buffer.readInt32<ResourceId>();
      if (resourceId < smallestResourceId) {
        smallestResourceId = resourceId;
      }
      if (resourceId > largestResourceId) {
        largestResourceId = resourceId;
      }
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

  const filename = detectFilenameFromResourceIds(
    smallestResourceId,
    largestResourceId,
  );
  if (filename !== null) {
    Logger.info(
      `DRS internal filename detected as ${filename} based on contained files`,
    );
  }

  return {
    files: results,
    password,
    filename,
  };
}

function detectFilenameFromResourceIds(
  smallestResourceId: ResourceId,
  largestResourceId: ResourceId,
) {
  if (
    smallestResourceId >= 0 &&
    smallestResourceId < 5000 &&
    largestResourceId >= 0 &&
    largestResourceId < 10000
  ) {
    return "graphics.drs";
  } else if (
    smallestResourceId >= 5000 &&
    smallestResourceId < 10000 &&
    largestResourceId >= 5000 &&
    largestResourceId < 10000
  ) {
    return "sounds.drs";
  } else if (
    smallestResourceId >= 15000 &&
    smallestResourceId < 20000 &&
    largestResourceId >= 15000 &&
    largestResourceId < 20000
  ) {
    return "Terrain.drs";
  } else if (
    smallestResourceId >= 20000 &&
    smallestResourceId < 25000 &&
    largestResourceId >= 20000 &&
    largestResourceId < 25000
  ) {
    return "Border.drs";
  } else if (
    smallestResourceId >= 50000 &&
    smallestResourceId < 55000 &&
    largestResourceId >= 50000 &&
    largestResourceId < 55000
  ) {
    return "Interfac.drs";
  } else if (
    smallestResourceId >= 54000 &&
    smallestResourceId < 65000 &&
    largestResourceId >= 54000 &&
    largestResourceId < 65000
  ) {
    return "gamedata.drs";
  } else {
    return null;
  }
}

function detectWavFile(bufferReader: BufferReader) {
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

function detectDatFile(bufferReader: BufferReader) {
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
  if (detectWavFile(bufferReader)) {
    return "wav";
  } else if (detectBitmapFile(bufferReader)) {
    return "bmp";
  } else if (detectShpFile(bufferReader)) {
    return "shp";
  } else if (detectSlpFile(bufferReader)) {
    return "slp";
  } else if (detectJascPaletteFile(bufferReader)) {
    return "pal";
  } else if (detectSinFile(bufferReader)) {
    return "sin";
  } else if (detectColormapFile(bufferReader)) {
    return "col";
  } else if (detectDatFile(bufferReader)) {
    return "dat";
  } else {
    return "bin";
  }
}

export function writeResourceList(
  filename: string,
  password: string,
  outputDirectory: string,
  files: FileEntry[],
) {
  if (files.length) {
    const textFileWriter = new TextFileWriter(
      path.join(outputDirectory, `${path.parse(filename).name}.rm`),
    );
    textFileWriter.raw(filename).eol();
    textFileWriter.raw(password).eol();
    textFileWriter.raw("").eol();
    files.forEach((entry) => {
      const resourceId = entry.resourceId;
      if (resourceId !== undefined) {
        textFileWriter
          .filenameWithExtension(entry.filename)
          .integer(resourceId)
          .eol();
      }
    });
    textFileWriter.close();
  }
}
