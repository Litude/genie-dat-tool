import JSON5 from "json5";
import { z } from "zod";
import { Logger } from "../Logger";
import * as DrsFile from "./DrsFile";
import { readFileSync } from "fs";
import { ResourceId } from "../database/Types";
import { asInt32 } from "../ts/base-types";
import path from "path";
import { clearDirectory } from "../files/file-utils";
import { FileEntry } from "../files/FileEntry";

export interface ParseDrsCommandArgs {
  filename: string;
  outputDir: string;
  resourceNamesFile?: string;
}

export function parseDrsFile(args: ParseDrsCommandArgs) {
  const { filename, outputDir, resourceNamesFile } = args;
  Logger.info(`Parsing DRS file ${filename}`);

  const outputDirectory = path.join(
    outputDir,
    "resources",
    path.parse(filename).name,
  );
  clearDirectory(outputDirectory);

  const result = DrsFile.readFromFile(filename);

  DrsFile.detectBinaryFileTypes(result.files);
  const { defaultNames: filenames, extraNames } =
    DrsFile.extractFilenamesFromResources(result.files);

  const orphanResourceIds: ResourceId[] = [];
  const orphanFilenameEntries: {
    resourceId: ResourceId;
    filename: string;
  }[] = [];

  if (resourceNamesFile) {
    const providedFilenames = getResourceFilenames(resourceNamesFile);
    if (providedFilenames) {
      Object.entries(providedFilenames).forEach(([key, filename]) => {
        if (!filenames[key]) {
          filenames[key] = filename;
          // If provided name was already present as an extra name, delete any such entries
          // (the trial version has some weird entries...)
          Object.keys(extraNames).forEach((key) => {
            if (key.toLocaleLowerCase() === filename.toLocaleLowerCase()) {
              delete extraNames[key];
            }
          });
        } else if (filenames[key] !== filename) {
          Logger.warn(
            `Extracted filename ${filenames[key]} for resource ${key} but ${filename} was provided as input. Input will be ignored.`,
          );
        }
      });
    }
  }

  if (Object.keys(filenames).length) {
    // list json resources that don't exist
    // list resources that don't have a json entry
    result.files.forEach((file) => {
      if (file.resourceId) {
        const newFilename = filenames[file.resourceId.toString()];
        if (!newFilename) {
          orphanResourceIds.push(file.resourceId);
        } else {
          const currentExtension = path.parse(file.filename).ext;
          const newExtension = path.parse(newFilename).ext;
          if (
            currentExtension.toLocaleLowerCase() !== ".bin" &&
            currentExtension.toLocaleLowerCase() !==
              newExtension.toLocaleLowerCase()
          ) {
            Logger.warn(
              `Resource ${file.resourceId} detected file type is ${currentExtension}, but filename extension is ${newExtension}`,
            );
          }
          file.filename = newFilename;
        }
      }
    });

    Object.entries(filenames).forEach(([key, filename]) => {
      const resourceId = asInt32<ResourceId>(+key);
      if (!result.files.some((file) => file.resourceId === resourceId)) {
        orphanFilenameEntries.push({
          resourceId,
          filename,
        });
      }
    });
  } else {
    // Quit if there is an error reading the provided resource file
    return;
  }

  result.files.forEach((file) => {
    file.writeToFile(outputDirectory);
    Logger.info(`File extracted: ${file.resourceId} - ${file.filename}`);
  });

  Object.entries(extraNames).forEach(([filename, resourceId]) => {
    const file = result.files.find((file) => file.resourceId === resourceId);
    if (file) {
      const newFile = new FileEntry(file);
      newFile.filename = filename;
      newFile.writeToFile(outputDirectory);
      Logger.info(
        `Extra file written: ${newFile.resourceId} - ${newFile.filename}`,
      );
    } else {
      Logger.error(
        `Extra file NOT written: ${resourceId} - ${filename}, could not find referenced resource!`,
      );
    }
  });

  DrsFile.writeResourceList(
    result.filename,
    result.password,
    outputDirectory,
    result.files,
  );

  Logger.info(`Finished writing DRS files`);

  if (orphanFilenameEntries.length) {
    Logger.info(
      `The following entries have filenames but do not exist in the processed DRS file:`,
    );
    Logger.info(
      orphanFilenameEntries
        .map((entry) => `${entry.resourceId}: ${entry.filename}`)
        .join("\n"),
    );
  }
  if (orphanResourceIds.length) {
    Logger.info(
      `The following DRS resources exist but did no filename was found for them:`,
    );
    Logger.info(orphanResourceIds.join("\n"));
  }
}

function getResourceFilenames(path: string): Record<string, string> | null {
  try {
    const rawTextData = readFileSync(path);
    if (rawTextData) {
      const resourceNamesText = rawTextData.toString("utf-8");
      const jsonResourceNames = JSON5.parse(resourceNamesText);
      const verifiedResourceNames = z
        .record(z.string().regex(/^\d+$/), z.string())
        .parse(jsonResourceNames);
      return verifiedResourceNames;
    } else {
      return null;
    }
  } catch (err: unknown) {
    if (err instanceof Error) {
      Logger.error(`Error reading DRS filenames from ${path}: ${err.message}`);
    } else {
      Logger.error(`Error reading DRS filenames from ${path}`);
    }
    return null;
  }
}
