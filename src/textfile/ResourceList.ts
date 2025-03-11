import path from "path";
import { ResourceId } from "../database/Types";
import { forEachObjectEntry } from "../ts/ts-utils";
import { TextFileWriter } from "./TextFileWriter";
import { textFileStringCompare } from "./TextFile";
import { writeFileSync } from "fs";

type ResourceListType =
  | "Sounds"
  | "Graphics"
  | "Borders"
  | "Terrains"
  | "Overlays";

function getLoggingName(type: ResourceListType) {
  switch (type) {
    case "Sounds":
      return "Sound effect";
    case "Graphics":
      return "Sprite";
    case "Borders":
      return "Border";
    case "Terrains":
      return "Terrain";
    case "Overlays":
      return "Overlay";
    default:
      throw new Error(`Unsupported resource type ${type}`);
  }
}

function getFilenameStem(type: ResourceListType) {
  switch (type) {
    case "Sounds":
      return "sounds";
    case "Graphics":
      return "graphics";
    case "Borders":
      return "border";
    case "Terrains":
      return "terrain";
    case "Overlays":
      return "overlay";
    default:
      throw new Error(`Unsupported resource type ${type}`);
  }
}

export function writeResourceList(
  type: ResourceListType,
  outputDirectory: string,
  resourceEntries: { resourceId: ResourceId; resourceFilename: string }[],
  extension?: string,
) {
  const resourceRecord: Record<ResourceId, string> = {};
  const usedResources = new Set<string>();
  const orphanResources = new Set<string>();
  resourceEntries.forEach((entry) => {
    if (entry.resourceId >= 0) {
      usedResources.add(entry.resourceFilename);
      if (!resourceRecord[entry.resourceId]) {
        resourceRecord[entry.resourceId] = entry.resourceFilename;
      } else if (resourceRecord[entry.resourceId] !== entry.resourceFilename) {
        throw new Error(
          `${getLoggingName(type)} ${entry.resourceId} has multiple file names: ${resourceRecord[entry.resourceId]} and ${entry.resourceFilename}`,
        );
      }
    } else if (entry.resourceFilename.toLocaleLowerCase() !== "none") {
      orphanResources.add(entry.resourceFilename);
    }
  });

  usedResources.forEach((entry) => {
    if (orphanResources.has(entry)) {
      orphanResources.delete(entry);
    }
  });

  const uniqueResourceEntries: { resourceId: ResourceId; filename: string }[] =
    [];
  forEachObjectEntry(resourceRecord, (key, value) => {
    uniqueResourceEntries.push({
      resourceId: key,
      filename: `${value}${extension ? extension : ""}`,
    });
  });
  uniqueResourceEntries.sort((a, b) => a.resourceId - b.resourceId);

  if (uniqueResourceEntries.length) {
    const textFileWriter = new TextFileWriter(
      path.join(outputDirectory, `${getFilenameStem(type)}.rm`),
    );
    textFileWriter.raw(`${getFilenameStem(type)}.drs`).eol();
    textFileWriter.raw("tribe").eol();
    textFileWriter.raw("").eol();
    uniqueResourceEntries.forEach((entry) => {
      textFileWriter
        .filenameWithExtension(entry.filename)
        .integer(entry.resourceId)
        .eol();
    });
    textFileWriter.close();

    const jsonEntries = uniqueResourceEntries.reduce(
      (acc, cur) => {
        acc[cur.resourceId] = cur.filename;
        return acc;
      },
      {} as Record<string, string>,
    );
    writeFileSync(
      path.join(outputDirectory, `${getFilenameStem(type)}.json`),
      JSON.stringify(jsonEntries, undefined, 4),
    );
  }

  if (orphanResources.size > 0) {
    const textFileWriter = new TextFileWriter(
      path.join(outputDirectory, `${getFilenameStem(type)}_orphan.log`),
    );
    [...orphanResources].sort(textFileStringCompare).forEach((entry) => {
      textFileWriter.filenameWithExtension(entry).eol();
    });
    textFileWriter.close();
  }

  if (usedResources.size || orphanResources.size) {
    const textFileWriter = new TextFileWriter(
      path.join(outputDirectory, `${getFilenameStem(type)}_all.log`),
    );
    [...usedResources, ...orphanResources]
      .sort(textFileStringCompare)
      .forEach((entry) => {
        textFileWriter.filenameWithExtension(entry).eol();
      });
    textFileWriter.close();
  }
}
