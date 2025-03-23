import JSON5 from "json5";
import yargs from "yargs";
import { Logger } from "../Logger";
import { WorldDatabase } from "./WorldDatabase";
import { existsSync, mkdirSync, readFileSync, statSync } from "fs";
import { z } from "zod";
import path from "path";
import { clearDirectory } from "../files/file-utils";
import { Version } from "./Version";
import { isDefined } from "../ts/ts-utils";
import BufferReader from "../BufferReader";
import { decompressFile } from "../deflate";
import { readPaletteFile } from "../image/palette";
import { readGraphics } from "../image/Graphic";
import { asUInt8 } from "../ts/base-types";
import { Point } from "../geometry/Point";

interface ParseDatArgs {
  filename: string;
  inputVersion: string;
  outputVersion: string;
  outputFormat?: "textfile" | "json" | "dat" | "resource-list";
  outputDir: string;
  attributesFile: string;
  habitatsFile: string;
  effectNames?: string;
}

interface ParseJsonArgs {
  directory: string;
  outputVersion: string;
  outputFormat?: "textfile" | "json" | "dat" | "resource-list";
  outputDir: string;
  attributesFile: string;
}

interface ExtractSpritesArgs {
  filename: string;
  inputVersion: string;
  paletteFile: string;
  transparentColor: number;
  shadowOffset: Point<number>;
  animationDelayMultiplier: number;
  graphics: string;
  player: number;
  outputDir: string;
}

export function addCommands(yargs: yargs.Argv<unknown>) {
  return yargs
    .command<ParseDatArgs>(
      "parse-dat <filename>",
      "Process a DAT file",
      (yargs) => {
        return yargs
          .positional("filename", {
            type: "string",
            describe: "Filename of DAT file that will be parsed",
            demandOption: true,
          })
          .option("input-version", {
            type: "string",
            describe: "Force DAT to be parsed as specified version",
            default: "auto",
          })
          .option("output-version", {
            type: "string",
            describe: "Output file as specified version",
            default: "input-version",
          })
          .option("output-format", {
            type: "string",
            describe: "Format that output file will be written in",
            choices: ["textfile", "json", "resource-list"],
          })
          .option("output-dir", {
            type: "string",
            describe: "Directory where output files will be written",
            default: "output",
          })
          .option("attributes-file", {
            type: "string",
            describe:
              "Path to JSON file that contains names used for attributes",
            default: "data/attributes.json5",
          })
          .option("habitats-file", {
            type: "string",
            describe: "Path to JSON file that contains names used for habitats",
          })
          .option("effects-file", {
            type: "string",
            describe: "Path to JSON file that contains names used for effects",
          });
      },
    )
    .command<ParseJsonArgs>(
      "parse-json <directory>",
      "Process a directory of JSON files",
      (yargs) => {
        return yargs
          .positional("directory", {
            type: "string",
            describe: "Root folder of JSON files that will be parsed",
            demandOption: true,
          })
          .option("output-version", {
            type: "string",
            describe: "Output file as specified version",
            default: "input-version",
          })
          .option("output-format", {
            type: "string",
            describe: "Format that output file will be written in",
            choices: ["textfile", "json", "resource-list"],
          })
          .option("output-dir", {
            type: "string",
            describe: "Directory where output files will be written",
            default: "output",
          })
          .option("attributes-file", {
            type: "string",
            describe:
              "Path to JSON file that contains names used for attributes",
            default: "data/attributes.json5",
          });
      },
    )
    .command<ExtractSpritesArgs>(
      "extract-sprites <filename>",
      "Extract sprites from a DAT file",
      (yargs) => {
        return yargs
          .positional("filename", {
            type: "string",
            describe: "Filename of DAT file that will be parsed",
            demandOption: true,
          })
          .option("input-version", {
            type: "string",
            describe: "Force DAT to be parsed as specified version",
            default: "auto",
          })
          .option("palette-file", {
            type: "string",
            describe:
              "Palette file that will be used for sprites (JASC-PAL or BMP)",
            demandOption: true,
          })
          .option("graphics", {
            type: "string",
            describe:
              "Path to DRS file(s) or directory or loose SLP files for graphics. Multiple files can be specified separated by a comma, later files take priority.",
            demandOption: true,
          })
          .option("transparent-color", {
            type: "number",
            describe: "Palette index to use as transparent color",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            coerce: (arg: any) => asUInt8(Number(arg)) as number,
            default: 255,
          })
          .option("shadow-offset", {
            type: "string",
            describe:
              "Additional x,y offset to apply for shadows (required for flying sprite shadows to be visible)",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            coerce: (arg: any): Point<number> => {
              console.log(arg);
              const [x, y] = arg
                .replace(",", " ")
                .split(" ")
                .map((x: string) => Number(x));
              if (!Number.isFinite(x) || !Number.isFinite(y)) {
                throw new Error("Invalid shadow-offset specified!");
              }
              return {
                x,
                y,
              };
            },
            default: "0,0",
          })
          .option("animation-delay-multiplier", {
            type: "number",
            describe:
              "Multiply delay specified in DAT with this value to adjust GIF animation delay",
            default: 1,
          })
          .option("player", {
            type: "number",
            describe: "Player ID to use for player color (1-8)",
            choices: [1, 2, 3, 4, 5, 6, 7, 8],
            default: 1,
          })
          .option("output-dir", {
            type: "string",
            describe: "Directory where output files will be written",
            default: "output",
          });
      },
    )
    .option("list-dat-versions", {
      type: "boolean",
      describe: "List supported DAT versions",
    });
}

export function execute(
  argv: ReturnType<typeof yargs.parseSync>,
  showHelp: () => void,
) {
  const { listDatVersions } = argv;
  if (listDatVersions) {
    console.log(
      [...new Set(Object.values(SupportedDatVersions).flatMap((x) => x))]
        .sort()
        .join("\n"),
    );
  } else {
    const commandType = argv._[1];
    switch (commandType) {
      case "parse-dat":
        parseDatFile(argv as unknown as ParseDatArgs);
        break;
      case "parse-json":
        parseJsonFiles(argv as unknown as ParseJsonArgs);
        break;
      case "extract-sprites":
        extractSprites(argv as unknown as ExtractSpritesArgs);
        break;
      default:
        showHelp();
        break;
    }
  }
}

const VERSION_REGEX = /VER\s+(\d+\.\d+)/;

function parseVersion(input: string) {
  const match = input.match(VERSION_REGEX);

  if (match && match[1]) {
    return match[1];
  } else {
    return null;
  }
}

const SupportedDatVersions = {
  "1.3": ["1.3.0", "1.3.1"], // There are actually two different revisions of 1.3
  "1.4": ["1.4.0", "1.4.0-mickey", "1.4.1"], // There is a special Mickey flavor of 1.4. 1.4.0 and 1.4.1 only differ in textfile format
  "1.5": ["1.5.0"],
  "2.7": ["2.7.0"],
  "3.1": ["3.1.0", "3.1.1"], // There are actually two different revisions of 3.1
  "3.2": ["3.2.0"],
  "3.3": ["3.3.0"],
  "3.4": ["3.4.0", "3.7.0"], // Later trial version identify as 3.4 but are actually 3.7
  "3.5": ["3.5.0"],
  "3.7": ["3.7.0"],
};

function isSupportedDatVersion(
  version: string,
): version is keyof typeof SupportedDatVersions {
  return Object.keys(SupportedDatVersions).includes(version);
}

function isSupportedParsingVersion(version: string): boolean {
  return Object.values(SupportedDatVersions)
    .flatMap((x) => x)
    .includes(version);
}

function getPotentialParsingVersions(headerVersionNumber: string) {
  if (isSupportedDatVersion(headerVersionNumber)) {
    return SupportedDatVersions[headerVersionNumber];
  } else {
    Logger.error(`Detected unsupported version ${headerVersionNumber}`);
    return [];
  }
}

function readDatFile(
  filename: string,
  inputVersionParameter: string,
  {
    habitatNamesFile,
    attributeNamesFile,
    effectNamesFile,
  }: {
    habitatNamesFile?: string;
    attributeNamesFile?: string;
    effectNamesFile?: string;
  } = {},
) {
  const dataBuffer = new BufferReader(decompressFile(filename));
  const headerString = dataBuffer.readFixedSizeString(8);
  const headerVersionNumber = parseVersion(headerString);
  if (
    inputVersionParameter !== "auto" &&
    !isSupportedParsingVersion(inputVersionParameter)
  ) {
    Logger.error(
      `input-version must be one of:\nauto\n${Object.values(
        SupportedDatVersions,
      )
        .flatMap((x) => x)
        .join("\n")}`,
    );
    return null;
  }

  if (headerVersionNumber) {
    Logger.info(`DAT file identifies itself as version ${headerVersionNumber}`);
    const potentialVersions =
      inputVersionParameter === "auto"
        ? getPotentialParsingVersions(headerVersionNumber)
        : [inputVersionParameter];
    if (potentialVersions.length) {
      let worldDatabase: WorldDatabase | null = null;
      let inputVersion: Version | null = null;

      for (let i = 0; i < potentialVersions.length; ++i) {
        const parsingVersion = potentialVersions[i];
        const [numbering, flavor] = parsingVersion.split("-");
        dataBuffer.seek(8);
        inputVersion = {
          numbering: numbering,
          flavor,
        };

        Logger.info(`Attempting to parse file as version ${parsingVersion}`);
        worldDatabase = new WorldDatabase();
        if (
          worldDatabase.readFromBuffer(
            dataBuffer,
            { habitatNamesFile, attributeNamesFile, effectNamesFile },
            {
              version: inputVersion,
              abortOnError: i !== potentialVersions.length - 1,
              cleanedData: true,
            },
          )
        ) {
          Logger.info("DAT file parsed successfully");
          break;
        } else {
          Logger.error(`Parsing file as version ${parsingVersion} failed!`);
          inputVersion = null;
          worldDatabase = null;
        }
      }

      if (worldDatabase && inputVersion) {
        return { worldDatabase, version: inputVersion };
      }
    }
  } else {
    Logger.error(`Input does not seem to be a valid DAT file (No VER header)`);
  }
  return null;
}

function parseDatFile(args: ParseDatArgs) {
  const {
    filename,
    inputVersion: inputVersionParameter,
    outputVersion: outputVersionParameter,
    outputFormat,
    outputDir,
    habitatsFile,
    attributesFile,
    effectNames,
  } = args;

  if (
    outputVersionParameter !== "input-version" &&
    !isSupportedParsingVersion(outputVersionParameter)
  ) {
    Logger.error(
      `output-version must be one of:\ninput-version\n${Object.values(
        SupportedDatVersions,
      )
        .flatMap((x) => x)
        .join("\n")}`,
    );
    return;
  }

  const datResult = readDatFile(filename, inputVersionParameter, {
    habitatNamesFile: habitatsFile,
    attributeNamesFile: attributesFile,
    effectNamesFile: effectNames,
  });
  if (datResult) {
    if (outputFormat) {
      const { worldDatabase, version: inputVersion } = datResult;
      writeWorldDatabaseOutput(
        worldDatabase,
        filename,
        outputDir,
        inputVersion,
        outputFormat,
        outputVersionParameter,
      );
    } else {
      // Support for not specifying output format so parsing of DAT files can be tested without writing anything
      Logger.info(
        "No output format specified, specify one with --output-format to write output",
      );
    }
  } else {
    Logger.error(`Input does not seem to be a valid DAT file (No VER header)`);
  }
}

function extractSprites(args: ExtractSpritesArgs) {
  const {
    filename,
    inputVersion: inputVersionParameter,
    paletteFile,
    graphics,
    outputDir,
    transparentColor,
    shadowOffset,
    animationDelayMultiplier,
    player,
  } = args;
  const datResult = readDatFile(filename, inputVersionParameter);
  if (datResult) {
    const { worldDatabase } = datResult;
    writeWorldDatabaseSprites(
      worldDatabase,
      filename,
      outputDir,
      paletteFile,
      graphics,
      { transparentColor, shadowOffset, animationDelayMultiplier, player },
    );
  }
}

function writeWorldDatabaseOutput(
  worldDatabase: WorldDatabase,
  filename: string,
  outputDirectory: string,
  inputVersion: Version,
  outputFormat: string,
  outputVersionParameter: string,
) {
  if (worldDatabase && inputVersion && outputFormat) {
    const [numbering, flavor] = outputVersionParameter.split("-");
    const outputVersion: Version = {
      numbering,
      flavor,
    };
    if (outputVersionParameter === "input-version") {
      outputVersion.numbering = inputVersion?.numbering;
      outputVersion.flavor = inputVersion.flavor;
    }
    const versionFormatted = `${[outputVersion.numbering, outputVersion.flavor].filter(isDefined).join("-")}`;

    mkdirSync(outputDirectory, { recursive: true });
    const fileOutputDir = path.parse(filename).name;
    switch (outputFormat) {
      case "textfile": {
        const textOutputDir = path.join(
          outputDirectory,
          "textfile",
          fileOutputDir,
        );
        clearDirectory(textOutputDir);
        Logger.info(`Writing ${versionFormatted} text files`);
        worldDatabase.writeToWorldTextFile(textOutputDir, {
          version: outputVersion,
        });
        break;
      }
      case "json": {
        const jsonOutputDir = path.join(outputDirectory, "json", fileOutputDir);
        clearDirectory(jsonOutputDir);
        Logger.info(`Writing ${versionFormatted} json files`);
        worldDatabase.writeToJsonFile(jsonOutputDir, {
          version: outputVersion,
        });
        break;
      }
      case "resource-list": {
        const resourceListOutputDir = path.join(
          outputDirectory,
          "reslists",
          fileOutputDir,
        );
        clearDirectory(resourceListOutputDir);
        worldDatabase.writeResourceLists(resourceListOutputDir);
        break;
      }
      default:
        Logger.error(`Unknown output format ${outputFormat}!`);
    }
  }
}

function writeWorldDatabaseSprites(
  worldDatabase: WorldDatabase,
  filename: string,
  outputDirectory: string,
  palettePath: string,
  graphicsPath: string,
  {
    transparentColor,
    shadowOffset,
    animationDelayMultiplier,
    player,
  }: {
    transparentColor: number;
    shadowOffset: Point<number>;
    animationDelayMultiplier: number;
    player: number;
  },
) {
  const paletteFile = readPaletteFile(palettePath);
  const colormap = worldDatabase.colormaps.find(
    (color) => color.id === player - 1,
  );
  const graphics = readGraphics(
    graphicsPath.replaceAll(" ", ",").split(","),
    paletteFile,
    colormap?.playerColorBase ?? 16,
  );
  const spriteOutputDirectory = path.join(outputDirectory, "sprites");
  mkdirSync(spriteOutputDirectory, { recursive: true });

  const finalDirectory = path.join(
    spriteOutputDirectory,
    path.parse(filename).name,
  );
  clearDirectory(finalDirectory);
  worldDatabase.sprites.forEach((sprite) => {
    Logger.info(`Processing ${sprite?.internalName}`);
    sprite?.writeToGif(
      graphics,
      {
        transparentIndex: transparentColor,
        shadowOffset,
        delayMultiplier: animationDelayMultiplier,
      },
      finalDirectory,
    );
  });
}

const JsonVersionSchema = z.object({
  version: z.object({
    numbering: z.string().regex(/\d\.\d\.\d/),
    flavor: z.string().optional(),
  }),
  jsonVersion: z.string(),
});

function parseJsonFiles(args: ParseJsonArgs) {
  const { directory, outputDir, outputVersion, outputFormat, attributesFile } =
    args;
  if (existsSync(directory) && statSync(directory).isDirectory()) {
    let versionData: z.infer<typeof JsonVersionSchema>;
    try {
      versionData = JsonVersionSchema.parse(
        JSON5.parse(
          readFileSync(path.join(directory, "version.json")).toString("utf8"),
        ),
      );
    } catch (err: unknown) {
      Logger.error(
        `Failed reading version.json: ${err && typeof err === "object" && "message" in err ? err.message : ""}`,
      );
      return;
    }
    Logger.info(
      `JSON data identifies itself as version ${[versionData.version.numbering, versionData.version.flavor].filter(isDefined).join("-")}`,
    );
    const worldDatabase = new WorldDatabase();
    worldDatabase.readFromJsonFiles(directory, { attributesFile });

    Logger.info("JSON parsing finished");
    if (outputFormat) {
      writeWorldDatabaseOutput(
        worldDatabase,
        directory,
        outputDir,
        versionData.version,
        outputFormat,
        outputVersion,
      );
    }
  } else {
    Logger.error("Invalid directory argument");
  }
}
