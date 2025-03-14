import JSON5 from "json5";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { decompressFile } from "./deflate";
import BufferReader from "./BufferReader";
import { WorldDatabase } from "./database/WorldDatabase";
import { Logger } from "./Logger";
import { Version } from "./database/Version";
import { isDefined } from "./ts/ts-utils";
import path from "path";
import { existsSync, mkdirSync, readFileSync, statSync } from "fs";
import { clearDirectory } from "./files/file-utils";
import { z } from "zod";
import { ParseDrsCommandArgs, parseDrsFile } from "./drs/command";

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

const yargsInstance = yargs(hideBin(process.argv))
  .scriptName("genie-dat-tool")
  .usage("$0 <command> [options]")
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
          describe: "Path to JSON file that contains names used for attributes",
          default: "data/attributes.json5",
        })
        .option("habitats-file", {
          type: "string",
          describe: "Path to JSON file that contains names used for habitats",
          default: "data/habitats.json5",
        })
        .option("effect-names", {
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
          describe: "Path to JSON file that contains names used for attributes",
          default: "data/attributes.json5",
        });
    },
  )
  .command<ParseDrsCommandArgs>(
    "parse-drs <filename>",
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
  // .command(
  //   "generate <type>",
  //   "Generate a new DAT file",
  //   (yargs) => {
  //     return yargs.positional("type", {
  //       describe: "Type of DAT file to generate",
  //       type: "string",
  //       choices: ["empires", "custom"],
  //       demandOption: true,
  //     });
  //   },
  //   (argv) => {
  //     console.log(`Generating DAT file of type: ${argv.type}`);
  //   }
  // )
  .option("list-dat-versions", {
    type: "boolean",
    describe: "List supported DAT versions",
  })
  .help()
  .alias("help", "h");

const argv = yargsInstance.parseSync();

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
  "1.4": ["1.4.0", "1.4.0-mickey", "1.4.1"], // There is a special Mickey flavor of 1.4
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

function parseDatFile() {
  const {
    filename,
    inputVersion: inputVersionParameter,
    outputVersion: outputVersionParameter,
    outputFormat,
    outputDir,
    habitatsFile,
    attributesFile,
    effectNames,
  } = argv as unknown as ParseDatArgs;
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
    return;
  }
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
            { habitatsFile, attributesFile, effectNames },
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

      if (worldDatabase && inputVersion && outputFormat) {
        writeWorldDatabaseOutput(
          worldDatabase,
          filename,
          outputDir,
          inputVersion,
          outputFormat,
          outputVersionParameter,
        );
      }
    }
  } else {
    Logger.error(`Input does not seem to be a valid DAT file (No VER header)`);
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
          "resources",
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

const JsonVersionSchema = z.object({
  version: z.object({
    numbering: z.string().regex(/\d\.\d\.\d/),
    flavor: z.string().optional(),
  }),
  jsonVersion: z.string(),
});

function parseJsonFiles() {
  const { directory, outputDir, outputVersion, outputFormat, attributesFile } =
    argv as unknown as ParseJsonArgs;
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

function main() {
  const { listDatVersions } = argv;
  if (listDatVersions) {
    console.log(
      [...new Set(Object.values(SupportedDatVersions).flatMap((x) => x))]
        .sort()
        .join("\n"),
    );
  } else {
    const commandType = argv._[0];
    switch (commandType) {
      case "parse-dat":
        parseDatFile();
        break;
      case "parse-json":
        parseJsonFiles();
        break;
      case "parse-drs":
        parseDrsFile(argv as unknown as ParseDrsCommandArgs);
        break;
      default:
        yargsInstance.showHelp();
        break;
    }
  }
}

main();
