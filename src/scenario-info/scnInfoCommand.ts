import { mkdirSync, readFileSync, writeFileSync } from "fs";
import yargs from "yargs";
import BufferReader from "../BufferReader";
import path from "path";
import { Logger } from "../Logger";
import { ScenarioHeader } from "../scenario/ScenarioHeader";

interface ExtractScenarioInfoMetadataCommandArgs {
  filename: string;
  encoding: string;
  outputDir: string;
}

export function addCommands(yargs: yargs.Argv<unknown>) {
  yargs.command<ExtractScenarioInfoMetadataCommandArgs>(
    "extract-metadata <filename>",
    "Process a SCN INF file and extract its bundled resources (bitmaps and AI files)",
    (yargs) => {
      return yargs
        .positional("filename", {
          type: "string",
          describe: "Filename of scenario file that will be parsed",
          demandOption: true,
        })
        .option("encoding", {
          type: "string",
          describe:
            "Encoding of the scenario file (default: latin1). Can be any encoding supported by iconv-lite.",
          default: "latin1",
        })
        .option("output-dir", {
          type: "string",
          describe: "Directory where output files will be written",
          default: "output",
        });
    },
  );

  return yargs;
}

export function execute(
  argv: ReturnType<typeof yargs.parseSync>,
  showHelp: () => void,
) {
  const commandType = argv._[1];
  console.log(commandType);
  switch (commandType) {
    case "extract-metadata":
      extractScenarioInfoMetadata(
        argv as unknown as ExtractScenarioInfoMetadataCommandArgs,
      );
      break;
    default:
      showHelp();
      break;
  }
}

function extractScenarioInfoMetadata(
  args: ExtractScenarioInfoMetadataCommandArgs,
) {
  const { filename, encoding, outputDir } = args;
  mkdirSync(outputDir, { recursive: true });

  Logger.info(`Processing scenario info file ${filename}`);
  const scenarioInfoFile = readFileSync(filename);

  const bufferReader = new BufferReader(scenarioInfoFile);

  const scenarioCount = bufferReader.readUInt32();
  Logger.info(`Found ${scenarioCount} embedded scenario metadata files`);

  const entries: {
    fileModifyTime: string;
    filename: string;
    header: Omit<ScenarioHeader, "modifyDate" | "checksum"> & {
      modifyDate: string | undefined;
      checksum?: number;
    };
  }[] = [];

  for (let i = 0; i < scenarioCount; i++) {
    const modifyTime = bufferReader.readUInt32();
    const filename = bufferReader.readFixedSizeString(260, encoding);
    Logger.info(
      `Reading scenario metadata ${i + 1}/${scenarioCount}: ${filename} (modify time: ${new Date(
        modifyTime * 1000,
      ).toISOString()})`,
    );
    const scenarioHeader = ScenarioHeader.readFromBuffer(
      bufferReader,
      modifyTime * 1000,
      encoding,
      { parseVersionZero: true, allowSizeMismatch: true },
    );
    entries.push({
      fileModifyTime: new Date(modifyTime * 1000).toISOString(),
      filename,
      header: {
        ...scenarioHeader,
        modifyDate:
          scenarioHeader.headerVersion >= 2
            ? new Date(scenarioHeader.modifyDate).toISOString()
            : undefined,
        checksum:
          scenarioHeader.headerVersion >= 2
            ? scenarioHeader.checksum
            : undefined,
      },
    });
  }

  const outputFilename =
    path.basename(filename, path.extname(filename)) + "_inf_metadata.json";
  const outputFilePath = path.join(outputDir, outputFilename);
  Logger.info(`Writing metadata to ${outputFilePath}`);

  const outputData = entries;
  const outputJson = JSON.stringify(outputData, null, 2);
  writeFileSync(outputFilePath, outputJson, { encoding: "utf-8" });

  Logger.info(`Scenario metadata extraction finished`);
}
