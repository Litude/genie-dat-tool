import JSON5 from "json5";
import { z } from "zod";
import { Logger } from "../Logger";
import * as DrsFile from "./DrsFile";
import { mkdirSync, readFileSync } from "fs";
import { ResourceId } from "../database/Types";
import { asInt32, asUInt8 } from "../ts/base-types";
import path from "path";
import { clearDirectory } from "../files/file-utils";
import { FileEntry } from "../files/FileEntry";
import yargs from "yargs";
import { parseSlpImage } from "../image/slpImage";
import BufferReader from "../BufferReader";
import { Graphic, writeGraphic } from "../image/Graphic";
import { parseShpImage } from "../image/shpImage";
import { isDefined } from "../ts/ts-utils";
import { readPaletteFile } from "../image/palette";

export interface ExtractDrsFilesCommandArgs {
  filename: string;
  outputDir: string;
  resourceNamesFile?: string;
}

export interface ExtractDrsGraphicsCommandArgs {
  filename: string;
  outputDir: string;
  resourceNamesFile?: string;
  outputFormat: "bmp" | "gif";
  paletteFile: string;
  playerColor: number;
  shadowColor: number;
  transparentColor: number | undefined;
  frameDelay: number;
}

export function addCommands(yargs: yargs.Argv<unknown>) {
  yargs
    .command<ExtractDrsFilesCommandArgs>(
      "extract-files <filename>",
      "Process a DRS file and extract its contents",
      (yargs) => {
        return yargs
          .positional("filename", {
            type: "string",
            describe: "Filename of DRS file that will be parsed",
            demandOption: true,
          })
          .option("output-dir", {
            type: "string",
            describe: "Directory where output files will be written",
            default: "output",
          })
          .option("resource-names-file", {
            type: "string",
            describe:
              "Path to JSON file that contains filenames used for resources",
          });
      },
    )
    .command<ExtractDrsFilesCommandArgs>(
      "extract-graphics <filename>",
      "Process a DRS file and extract its graphics",
      (yargs) => {
        return yargs
          .positional("filename", {
            type: "string",
            describe:
              "Filename(s) of DRS file that will be parsed. Multiple files can be specified separated by a comma, later files take priority.",
            demandOption: true,
          })
          .option("output-dir", {
            type: "string",
            describe: "Directory where output files will be written",
            default: "output",
          })
          .option("resource-names-file", {
            type: "string",
            describe:
              "Path to JSON file(s) that contains filenames used for graphics. Multiple files can be specified separated by a comma, later files take priority.",
          })
          .option("palette-file", {
            type: "string",
            describe: "Palette file that will be used (JASC-PAL or BMP)",
            demandOption: true,
          })
          .option("transparent-color", {
            type: "string",
            describe:
              "Palette index to use as transparent color or 'none' for no transparent index",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            coerce: (arg: any) =>
              arg === "none" ? undefined : (asUInt8(Number(arg)) as number),
            default: 255,
          })
          .option("frame-delay", {
            type: "number",
            describe:
              "Frame delay used for animated gifs, in 1/100 of a second (centiseconds)",
            default: 10,
          })
          .option("player-color", {
            type: "number",
            describe: "Palette index to use as first player color",
            default: 16,
          })
          .option("shadow-color", {
            type: "number",
            describe: "Palette index to use as shadow color",
            default: 0,
          })
          .option("output-format", {
            type: "string",
            describe: "Format that output graphics will be written in",
            choices: ["bmp", "gif"],
            demandOption: true,
          });
      },
    );
}

export function execute(
  argv: ReturnType<typeof yargs.parseSync>,
  showHelp: () => void,
) {
  const commandType = argv._[1];
  switch (commandType) {
    case "extract-files":
      extractDrsFiles(argv as unknown as ExtractDrsFilesCommandArgs);
      break;
    case "extract-graphics":
      extractDrsGraphics(argv as unknown as ExtractDrsGraphicsCommandArgs);
      break;
    default:
      showHelp();
      break;
  }
}

function extractDrsFiles(args: ExtractDrsFilesCommandArgs) {
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
    } else {
      Logger.error(`Error reading ${resourceNamesFile}`);
    }
  }

  if (Object.keys(filenames).length) {
    // list json resources that don't exist
    // list resources that don't have a json entry
    result.files.forEach((file) => {
      if (file.resourceId !== undefined) {
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

function extractDrsGraphics(args: ExtractDrsGraphicsCommandArgs) {
  const {
    filename: drsFilenames,
    outputDir,
    outputFormat,
    transparentColor,
    frameDelay,
    resourceNamesFile,
    paletteFile,
    playerColor,
    shadowColor,
  } = args;

  const palette = readPaletteFile(paletteFile);

  const rawResult = drsFilenames
    .replaceAll(" ", ",")
    .split(",")
    .reverse()
    .map((filename) => DrsFile.readFromFile(filename).files);

  // If multiple files are specified, proritize files from later files
  const seenIds = new Set<ResourceId>();
  const result = rawResult
    .map((entries) => {
      return entries.filter((entry) => {
        if (!entry.resourceId) {
          return false;
        }
        if (!seenIds.has(entry.resourceId)) {
          seenIds.add(entry.resourceId);
          return true;
        } else {
          return false;
        }
      });
    })
    .reverse()
    .flat();

  DrsFile.detectBinaryFileTypes(result);
  const graphics = result
    .map((entry) => {
      let graphic: Graphic | null = null;
      if (entry.filename.endsWith(".slp")) {
        graphic = new Graphic(
          parseSlpImage(new BufferReader(entry.data), {
            playerColor,
            shadowColor,
          }),
        );
      } else if (entry.filename.endsWith(".shp")) {
        graphic = new Graphic(parseShpImage(new BufferReader(entry.data)));
      }
      if (graphic) {
        graphic.filename = entry.filename;
        graphic.resourceId = entry.resourceId;
        graphic.palette = palette;
      }
      return graphic;
    })
    .filter(isDefined);

  const screenInformations = DrsFile.extractScreenInformationResources(result);
  const palettes = DrsFile.extractPaletteResources(result);

  screenInformations.forEach((screenInfo) => {
    const resources = screenInfo.screenInfo.getAllGraphicResources();
    const palette = palettes.find(
      (palette) =>
        palette.resourceId === screenInfo.screenInfo.palette?.resourceId ||
        palette.filename === screenInfo.screenInfo.palette?.filename,
    );
    if (palette) {
      resources.forEach((resource) => {
        const match = graphics.find(
          (graphic) => graphic.resourceId === resource.resourceId,
        );
        if (match) {
          match.palette = palette.palette;
        }
      });
    }
  });

  const { defaultNames: filenames, extraNames } =
    DrsFile.extractFilenamesFromResources(result);
  const orphanResourceIds: ResourceId[] = [];
  const orphanFilenameEntries: {
    resourceId: ResourceId;
    filename: string;
  }[] = [];

  console.log(resourceNamesFile);

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
    } else {
      Logger.error(`Error reading ${resourceNamesFile}`);
    }
  }

  if (Object.keys(filenames).length) {
    // list json resources that don't exist
    // list resources that don't have a json entry
    graphics.forEach((file) => {
      if (file.resourceId !== undefined && file.filename !== undefined) {
        console.log(`Handling ${file.resourceId}`);
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
  }

  Object.entries(filenames).forEach(([key, filename]) => {
    const resourceId = asInt32<ResourceId>(+key);
    if (!graphics.some((file) => file.resourceId === resourceId)) {
      orphanFilenameEntries.push({
        resourceId,
        filename,
      });
    }
  });
  const subdirectory = path.parse(
    drsFilenames.replaceAll(" ", ",").split(",")[0],
  ).name;

  const graphicsDirectory = path.join(outputDir, "graphics", subdirectory);
  mkdirSync(graphicsDirectory, { recursive: true });
  clearDirectory(graphicsDirectory);

  graphics.forEach((graphic) => {
    writeGraphic(
      outputFormat,
      graphic,
      { transparentIndex: transparentColor, delay: frameDelay },
      graphic.filename ?? "unnamed",
      graphicsDirectory,
    );
  });
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
