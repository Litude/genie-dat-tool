import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { decompressFile } from "./deflate";
import BufferReader from "./BufferReader";
import { WorldDatabase } from "./database/WorldDatabase";
import { Logger } from "./Logger";
import { Version } from "./database/Version";
import { isDefined } from "./ts/ts-utils";

interface ParseArgs {
    filename: string;
    inputVersion: string;
    outputVersion: string;
    outputFormat?: "textfile" | "json" | "dat" | "resource-list";
    outputDir: string;
  }

const yargsInstance = yargs(hideBin(process.argv))
    .scriptName("genie-dat-tool")
    .usage("$0 <command> [options]")
    .command<ParseArgs>(
        "parse <filename>",
        "Process a DAT file",
        (yargs) => {
          return yargs.positional("filename", {
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
              default: "input-version"
          })
          .option("output-format", {
              type: "string",
              describe: "Format that output file will be written in",
              choices: ["textfile", "json", "dat", "resource-list"]
          })
          .option("output-dir", {
            type: "string",
            describe: "Directory where output files will be written",
            default: "output",
          })
        }
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
        describe: "List supported DAT versions"
    })
    .help()
    .alias("help", "h")

const argv = yargsInstance
    .parseSync()

const VERSION_REGEX = /VER\s+(\d+\.\d+)/

function parseVersion(input: string) {
    const match = input.match(VERSION_REGEX);

    if (match && match[1]) {
        return match[1];
    }
    else {
        return null;
    }
}

const SupportedDatVersions = {
    "1.3": ["1.3.0", "1.3.1"], // There are actually two different revisions of 1.3
    "1.4": ["1.4.0", "1.4.0-mickey"], // There is a special Mickey flavor of 1.4
    "1.5": ["1.5.0"],
    "2.7": ["2.7.0"],
    "3.1": ["3.1.0", "3.1.1"], // There are actually two different revisions of 3.1
    "3.2": ["3.2.0"],
    "3.3": ["3.3.0"],
    "3.4": ["3.4.0", "3.7.0"], // Later trial version identify as 3.4 but are actually 3.7
    "3.5": ["3.5.0"],
    "3.7": ["3.7.0"],
};

function isSupportedDatVersion(version: string): version is keyof (typeof SupportedDatVersions) {
    return Object.keys(SupportedDatVersions).includes(version);
}

function isSupportedParsingVersion(version: string): boolean {
    return Object.values(SupportedDatVersions).flatMap(x => x).includes(version);
}

function getPotentialParsingVersions(headerVersionNumber: string) {
    if (isSupportedDatVersion(headerVersionNumber)) {
        return SupportedDatVersions[headerVersionNumber]
    }
    else {
        Logger.error(`Detected unsupported version ${headerVersionNumber}`)
        return [];
    }
}

function parseDatFile() {
    const { filename, inputVersion: inputVersionParameter, outputVersion: outputVersionParameter, outputFormat, outputDir } = argv as unknown as ParseArgs;
    const dataBuffer = new BufferReader(decompressFile(filename));
    const headerString = dataBuffer.readFixedSizeString(8);
    const headerVersionNumber = parseVersion(headerString);
    if (inputVersionParameter !== "auto" && !isSupportedParsingVersion(inputVersionParameter)) {
        Logger.error(`input-version must be one of:\nauto\n${Object.values(SupportedDatVersions).flatMap(x => x).join('\n')}`);
        return;
    }
    if (outputVersionParameter !== "input-version" && !isSupportedParsingVersion(outputVersionParameter)) {
        Logger.error(`output-version must be one of:\ninput-version\n${Object.values(SupportedDatVersions).flatMap(x => x).join('\n')}`);
    }

    if (headerVersionNumber) {
        Logger.info(`DAT file identifies itself as version ${headerVersionNumber}`);
        const potentialVersions = inputVersionParameter === "auto" ? getPotentialParsingVersions(headerVersionNumber) : [inputVersionParameter];
        if (potentialVersions.length) {
            let worldDatabase: WorldDatabase | null = null;
            let inputVersion: Version | null = null;

            for (let i = 0; i < potentialVersions.length; ++i) {
                const parsingVersion = potentialVersions[i];
                const [numbering, flavor] = parsingVersion.split('-');
                dataBuffer.seek(8);
                inputVersion = {
                    numbering: numbering,
                    flavor,
                };

                Logger.info(`Attempting to parse file as version ${parsingVersion}`);
                worldDatabase = new WorldDatabase();
                if (worldDatabase.readFromBuffer(dataBuffer, { version: inputVersion, abortOnError: i !== potentialVersions.length - 1, cleanedData: false } )) {
                    Logger.info("File parsed successfully");
                    break;
                }
                else {
                    Logger.error(`Parsing file as version ${parsingVersion} failed!`);
                    inputVersion = null;
                    worldDatabase = null;
                }
            }

            if (worldDatabase && inputVersion && outputFormat) {
                const [numbering, flavor] = outputVersionParameter.split('-');
                const textFileVersion: Version = {
                    numbering,
                    flavor
                }
                if (outputVersionParameter === "input-version") {
                    textFileVersion.numbering = inputVersion?.numbering
                    textFileVersion.flavor = inputVersion.flavor;
                }
                const versionFormatted = `${[textFileVersion.numbering, textFileVersion.flavor].filter(isDefined).join('-')}`;

                if (outputFormat === "textfile") {
                    Logger.info(`Writing ${versionFormatted} text files`);
                    worldDatabase.writeToWorldTextFile(outputDir, { version: textFileVersion });
                }
                else if (outputFormat === "json") {
                    Logger.info(`Writing ${versionFormatted} json files`);
                    worldDatabase.writeToJsonFile(outputDir, { version: textFileVersion });
                }
                else {
                    Logger.error(`Output format ${outputFormat} not yet implemented!`);
                }
            }

        }
    }
    else {
        Logger.error(`Input does not seem to be a valid DAT file (No VER header)`);
    }
}

function main() {
    const { listDatVersions } = argv;
    if (listDatVersions) {
        console.log(Object.values(SupportedDatVersions).flatMap(x => x).join('\n'));
    }
    else {
        const commandType = argv._[0];
        if (commandType === "parse") {
            parseDatFile();
        }
        else {
            yargsInstance.showHelp();
        }
    }
}

main();
