import JSON5 from "json5";
import { z } from "zod";
import { Logger } from "../Logger";
import { DrsFile } from "./DrsFile";
import { readFileSync } from "fs";
import { ResourceId } from "../database/Types";
import { asInt32 } from "../ts/base-types";

export interface ParseDrsCommandArgs {
  filename: string;
  outputDir: string;
  resourceNamesFile?: string;
}

export function parseDrsFile(args: ParseDrsCommandArgs) {
  const { filename, outputDir, resourceNamesFile } = args;
  Logger.info(`Parsing DRS file ${filename}`);

  const files = DrsFile.readFromFile(filename);

  DrsFile.detectBinaryFileTypes(files);
  const filenames = DrsFile.extractFilenamesFromResources(files);

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
        } else if (filenames[key] !== filename) {
          Logger.warn(
            `Extracted filename ${filenames[key]} for resource ${key} but ${filename} was provided as input and will override it`,
          );
        }
      });
    }
  }

  if (Object.keys(filenames).length) {
    // list json resources that don't exist
    // list resources that don't have a json entry
    files.forEach((file) => {
      if (file.resourceId) {
        const newFilename = filenames[file.resourceId.toString()];
        if (!newFilename) {
          orphanResourceIds.push(file.resourceId);
        } else {
          file.filename = newFilename;
        }
      }
    });

    Object.entries(filenames).forEach(([key, filename]) => {
      const resourceId = asInt32<ResourceId>(+key);
      if (!files.some((file) => file.resourceId === resourceId)) {
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

  files.forEach((file) => {
    file.writeToFile(outputDir);
  });
  Logger.info(`Finished writing DRS files`);

  if (orphanFilenameEntries.length) {
    Logger.info(
      `The following entries exist in the JSON file but not in the processed DRS file:`,
    );
    Logger.info(
      orphanFilenameEntries
        .map((entry) => `${entry.resourceId}: ${entry.filename}`)
        .join("\n"),
    );
  }
  if (orphanResourceIds.length) {
    Logger.info(
      `The following DRS resources exist but did not have an entry in the provided JSON file:`,
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
