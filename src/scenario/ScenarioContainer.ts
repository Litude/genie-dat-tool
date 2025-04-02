import { inflateRawSync } from "zlib";
import BufferReader from "../BufferReader";
import { ParsingError } from "../database/Error";
import { asFloat32, asInt32, asUInt32, Float32, Int32 } from "../ts/base-types";
import { ScenarioHeader } from "./ScenarioHeader";
import { ObjectId } from "../database/Types";
import { ScenarioLoadingContext } from "./ScenarioLoadingContext";
import { ScenarioData } from "./ScenarioData";
import { FileEntry } from "../files/FileEntry";
import { Logger } from "../Logger";
import path from "path";

export enum ScenarioParsingAmount {
  Header = 0,
  Data = 1, // everything needed for extracting data
  Complete = 2,
}

export class ScenarioContainer {
  version: string = "";
  dataVersion: Float32 = asFloat32(0.0);
  header: ScenarioHeader = new ScenarioHeader();
  nextObjectId: ObjectId<Int32> = asInt32<ObjectId<Int32>>(-1);
  scenarioData: ScenarioData = new ScenarioData();

  extractEmbeddedFiles(outputPath: string) {
    const modifyDate = this.header.modifyDate;
    const presentationFiles =
      this.scenarioData.presentationData.getEmbeddedFiles(modifyDate);
    const aiFiles = this.scenarioData.aiData.flatMap((aiData) =>
      aiData.getEmbeddedFiles(modifyDate),
    );
    const uniqueAiFiles: Record<string, FileEntry> = {};
    const duplicateNames: Record<string, string[]> = {};
    aiFiles.forEach((file) => {
      const normalizedFilename = file.filename.toLocaleLowerCase();
      if (!uniqueAiFiles[normalizedFilename]) {
        uniqueAiFiles[normalizedFilename] = file;
      } else {
        if (uniqueAiFiles[normalizedFilename].data.compare(file.data) !== 0) {
          if (
            (duplicateNames[normalizedFilename] ?? []).every(
              (duplicateName) =>
                uniqueAiFiles[duplicateName].data.compare(file.data) !== 0,
            )
          ) {
            Logger.info(
              `Duplicate entry with filename ${file.filename}, but content differs!`,
            );
            // Find a new filename, max 100 attempts
            let success = false;
            for (let i = 1; i < 100; ++i) {
              const nameParts = path.parse(file.filename);
              const newName = `${nameParts.name}_${i}${nameParts.ext}`;
              if (!uniqueAiFiles[newName.toLocaleLowerCase()]) {
                Logger.info(
                  `Duplicate renamed from ${file.filename} to ${newName}`,
                );
                if (!duplicateNames[normalizedFilename]) {
                  duplicateNames[normalizedFilename] = [];
                }
                duplicateNames[normalizedFilename].push(newName);
                file.filename = newName;
                uniqueAiFiles[newName] = file;
                success = true;
                break;
              }
            }

            if (!success) {
              Logger.error(
                `Unable to find suitable filename for duplicate entry, skipping...`,
              );
            }
          }
        }
      }
    });
    const allFiles = [...presentationFiles, ...Object.values(uniqueAiFiles)];
    allFiles.forEach((file) => {
      file.writeToFile(outputPath);
      Logger.info(`Extracted file ${file.filename}`);
    });
  }

  static readFromBuffer(
    inputBuffer: BufferReader,
    modifyDate: number,
    parsingAmount: ScenarioParsingAmount = ScenarioParsingAmount.Data,
  ) {
    let buffer = inputBuffer;

    const loadingContext: ScenarioLoadingContext = {
      containerVersion: 0.0,
      dataVersion: 0.0,
    };

    const scenario = new ScenarioContainer();
    let scenarioVersion = 0;
    const versionString = buffer.readFixedSizeString(4);
    if (versionString.match(/^\d\.\d\d$/)) {
      scenario.version = versionString;
      scenarioVersion = parseFloat(versionString);
      loadingContext.containerVersion = scenarioVersion;

      if (scenarioVersion < 1.03) {
        throw new ParsingError(
          `Unexpected version number ${scenarioVersion} for uncompressed header scenario`,
        );
      }
      scenario.header = ScenarioHeader.readFromBuffer(buffer, modifyDate);
      const startOffset = buffer.tell();
      const endOffset = buffer.size();
      const compressedData = buffer.data().subarray(startOffset, endOffset);

      if (parsingAmount > ScenarioParsingAmount.Header) {
        buffer = new BufferReader(inflateRawSync(compressedData));
      }
    } else {
      // We may have a completely compressed old scenario
      try {
        buffer = new BufferReader(inflateRawSync(buffer.data()));
      } catch (_err: unknown) {
        throw new ParsingError(
          `Parsing file as scenario file failed, it is probably not a scenario`,
        );
      }
      const versionString = buffer.readFixedSizeString(4);

      if (versionString.match(/^\d\.\d\d$/)) {
        scenario.version = versionString;
        scenarioVersion = parseFloat(versionString);
        if (scenarioVersion < 1.0 || scenarioVersion >= 1.03) {
          throw new ParsingError(
            `Unexpected version number ${scenario.version} for compressed header scenario`,
          );
        }
        scenario.header.checksum = asUInt32(Math.round(modifyDate / 1000));
        scenario.header.modifyDate = modifyDate;
      }
    }

    if (parsingAmount > ScenarioParsingAmount.Header) {
      if (scenarioVersion < 1.01 || scenarioVersion > 1.21) {
        throw new Error(`Unsupported scenario version ${scenarioVersion}`);
      }

      scenario.nextObjectId = buffer.readInt32<ObjectId<Int32>>();

      scenario.dataVersion = buffer.readFloat32();
      // We need to round the float value to the matching double value so version number comparisons will work correctly
      loadingContext.dataVersion = parseFloat(scenario.dataVersion.toFixed(6));

      scenario.scenarioData = ScenarioData.readFromBuffer(
        buffer,
        loadingContext,
      );
    }

    return scenario;
  }
}
