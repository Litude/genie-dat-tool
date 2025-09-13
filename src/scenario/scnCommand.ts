import {
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "fs";
import yargs from "yargs";
import { ScenarioContainer, ScenarioParsingAmount } from "./ScenarioContainer";
import BufferReader from "../BufferReader";
import path from "path";
import { clearDirectory } from "../files/file-utils";
import { Logger } from "../Logger";
import { Temporal } from "temporal-polyfill";

interface ExtractScenarioResourcesCommandArgs {
  filename: string;
  encoding: string;
  metadata: boolean;
  fakeEsTime: boolean;
  outputDir: string;
}

interface WriteScenarioMetaDataCommandArgs {
  filename: string;
  outputDir: string;
}

export function addCommands(yargs: yargs.Argv<unknown>) {
  yargs.command<ExtractScenarioResourcesCommandArgs>(
    "extract-resources <filename>",
    "Process a SCN file and extract its bundled resources (bitmaps and AI files)",
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
        .option("metadata", {
          type: "boolean",
          describe: "Write additional scenario metadata",
          default: false,
        })
        .option("fake-es-time", {
          type: "boolean",
          describe:
            "Makes the UTC value of the timestamp CST (Ensemble Studios time), making the time less accurate but more consistent with other files in the original game. This is only used if the file includes a UTC timestamp (header version 2). Also fixes issues with some files having year 1995 instead of 1997.",
          default: false,
        })
        .option("output-dir", {
          type: "string",
          describe: "Directory where output files will be written",
          default: "output",
        });
    },
  );

  yargs.command<WriteScenarioMetaDataCommandArgs>(
    "write-metadata <filename>",
    "Write scenario metadata to a file",
    (yargs) => {
      return yargs
        .positional("filename", {
          type: "string",
          describe:
            "Filename of scenario file that will be parsed. This can also be a path to a directory containing scenario files.",
          demandOption: true,
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
  switch (commandType) {
    case "extract-resources":
      extractScenarioResources(
        argv as unknown as ExtractScenarioResourcesCommandArgs,
      );
      break;
    case "write-metadata":
      executeWriteScenarioMetaDataCommand(
        argv as unknown as WriteScenarioMetaDataCommandArgs,
      );
      break;
    default:
      showHelp();
      break;
  }
}

function getScenarioFilePaths(filePath: string): string[] {
  const scenarioFiles: string[] = [];
  const stat = lstatSync(filePath);
  if (stat.isDirectory()) {
    const filenames = readdirSync(filePath).map((entry) => ({
      filename: entry,
      normalizedFilename: entry.toLocaleLowerCase(),
    }));
    for (const file of filenames) {
      if (
        file.normalizedFilename.endsWith(".scn") ||
        file.normalizedFilename.endsWith(".scx")
      ) {
        scenarioFiles.push(path.join(filePath, file.filename));
      }
    }
  } else if (stat.isFile()) {
    scenarioFiles.push(filePath);
  }
  return scenarioFiles;
}

function extractScenarioResources(args: ExtractScenarioResourcesCommandArgs) {
  const { filename, encoding, outputDir } = args;

  let actualOutputDir = outputDir;
  const scenarioFiles = getScenarioFilePaths(filename);
  if (scenarioFiles.length === 0) {
    Logger.error(`No scenario files found in ${filename}`);
    return;
  }
  if (scenarioFiles.length > 1) {
    actualOutputDir = path.join(
      actualOutputDir,
      "scnresources",
      path.parse(filename).name,
    );
    clearDirectory(actualOutputDir);
    Logger.info(
      `Multiple scenario files found, output will be written to ${actualOutputDir}`,
    );
  } else {
    mkdirSync(outputDir, { recursive: true });
    actualOutputDir = path.join(actualOutputDir, "scnresources");
  }

  for (const scenarioFilename of scenarioFiles) {
    Logger.info(`Processing scenario file ${scenarioFilename}`);
    try {
      const scenarioFile = readFileSync(scenarioFilename);
      const fileStats = statSync(scenarioFilename);
      const scenario = ScenarioContainer.readFromBuffer(
        new BufferReader(scenarioFile),
        fileStats.mtimeMs,
        ScenarioParsingAmount.Data,
        encoding,
      );

      const outputDirectory = path.join(
        actualOutputDir,
        path.parse(scenarioFilename).name,
      );
      clearDirectory(outputDirectory);
      let modificationTime = scenario.header.modifyDate;
      if (args.fakeEsTime && scenario.header.headerVersion >= 2) {
        // Convert the modification time to Ensemble Studios time (CST)
        const zonedDateTime =
          Temporal.Instant.fromEpochMilliseconds(
            modificationTime,
          ).toZonedDateTimeISO("America/Chicago");
        const utcDateTime = Temporal.ZonedDateTime.from({
          year: zonedDateTime.year === 1995 ? 1997 : zonedDateTime.year,
          month: zonedDateTime.month,
          day: zonedDateTime.day,
          hour: zonedDateTime.hour,
          minute: zonedDateTime.minute,
          second: zonedDateTime.second,
          millisecond: zonedDateTime.millisecond,
          timeZone: "UTC",
        });
        modificationTime = utcDateTime.toInstant().epochMilliseconds;
      }
      scenario.extractEmbeddedFiles(outputDirectory, modificationTime);
    } catch (error) {
      Logger.error(
        `Error processing scenario file ${scenarioFilename}: ${error}`,
      );
      continue;
    }
  }

  Logger.info(`Scenario file extraction finished`);
}

function executeWriteScenarioMetaDataCommand(
  args: WriteScenarioMetaDataCommandArgs,
) {
  const { filename: inputPath, outputDir: inputOutputDir } = args;
  let outputDir = path.join(inputOutputDir, "scnmeta");
  let printSummary = false;

  const scenarioFiles: string[] = [];
  const stat = lstatSync(inputPath);
  if (stat.isDirectory()) {
    outputDir = path.join(outputDir, path.basename(inputPath));
    const filenames = readdirSync(inputPath).map((entry) => ({
      filename: entry,
      normalizedFilename: entry.toLocaleLowerCase(),
    }));
    for (const file of filenames) {
      if (
        file.normalizedFilename.endsWith(".scn") ||
        file.normalizedFilename.endsWith(".scx")
      ) {
        scenarioFiles.push(path.join(inputPath, file.filename));
      }
    }
    clearDirectory(outputDir);
    printSummary = true;
  } else {
    scenarioFiles.push(inputPath);
    mkdirSync(outputDir, { recursive: true });
  }

  const dataVersionsSummary: Record<
    string,
    { earliest: string; latest: string }
  > = {};
  const containerVersionsSummary: Record<
    string,
    { earliest: string; latest: string }
  > = {};
  const headerVersionsSummary: Record<
    string,
    { earliest: string; latest: string }
  > = {};
  for (const filename of scenarioFiles) {
    Logger.info(`Processing scenario file ${filename}`);
    try {
      const scenarioFile = readFileSync(filename);
      const fileStats = statSync(filename);
      const scenario = ScenarioContainer.readFromBuffer(
        new BufferReader(scenarioFile),
        fileStats.mtimeMs,
      );
      writeScenarioMetaData(scenario, outputDir, filename, {
        dataVersions: dataVersionsSummary,
        containerVersions: containerVersionsSummary,
        headerVersions: headerVersionsSummary,
      });
    } catch (error) {
      Logger.error(`Error processing scenario file ${filename}: ${error}`);
      continue;
    }
  }

  if (printSummary) {
    Logger.info(`Summary of versions:`);
    Logger.info(`Data Versions:`);
    for (const [version, summary] of Object.entries(dataVersionsSummary).sort(
      (a, b) => parseFloat(a[0]) - parseFloat(b[0]),
    )) {
      Logger.info(
        `  ${version}: Earliest: ${summary.earliest}, Latest: ${summary.latest}`,
      );
    }
    Logger.info(`Container Versions:`);
    for (const [version, summary] of Object.entries(
      containerVersionsSummary,
    ).sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))) {
      Logger.info(
        `  ${version}: Earliest: ${summary.earliest}, Latest: ${summary.latest}`,
      );
    }
    Logger.info(`Header Versions:`);
    for (const [version, summary] of Object.entries(headerVersionsSummary).sort(
      (a, b) => parseInt(a[0]) - parseInt(b[0]),
    )) {
      Logger.info(
        `  ${version}: Earliest: ${summary.earliest}, Latest: ${summary.latest}`,
      );
    }
  }
}

function writeScenarioMetaData(
  scenario: ScenarioContainer,
  outputDir: string,
  filename: string,
  versionSummaries: {
    dataVersions: Record<string, { earliest: string; latest: string }>;
    containerVersions: Record<string, { earliest: string; latest: string }>;
    headerVersions: Record<string, { earliest: string; latest: string }>;
  },
) {
  const outputFile = path.join(
    outputDir,
    `${path.basename(filename, path.extname(filename))}.json`,
  );
  const modifyDate = new Date(scenario.header.modifyDate).toISOString();
  const dataVersion = scenario.dataVersion.toFixed(2).toString();
  if (!versionSummaries.dataVersions[dataVersion]) {
    versionSummaries.dataVersions[dataVersion] = {
      earliest: modifyDate,
      latest: modifyDate,
    };
  } else {
    const version = versionSummaries.dataVersions[dataVersion];
    version.earliest = new Date(
      Math.min(
        new Date(version.earliest).getTime(),
        new Date(modifyDate).getTime(),
      ),
    ).toISOString();
    version.latest = new Date(
      Math.max(
        new Date(version.latest).getTime(),
        new Date(modifyDate).getTime(),
      ),
    ).toISOString();
  }
  if (!versionSummaries.containerVersions[scenario.version]) {
    versionSummaries.containerVersions[scenario.version] = {
      earliest: modifyDate,
      latest: modifyDate,
    };
  } else {
    const version = versionSummaries.containerVersions[scenario.version];
    version.earliest = new Date(
      Math.min(
        new Date(version.earliest).getTime(),
        new Date(modifyDate).getTime(),
      ),
    ).toISOString();
    version.latest = new Date(
      Math.max(
        new Date(version.latest).getTime(),
        new Date(modifyDate).getTime(),
      ),
    ).toISOString();
  }
  if (!versionSummaries.headerVersions[scenario.header.headerVersion]) {
    versionSummaries.headerVersions[scenario.header.headerVersion] = {
      earliest: modifyDate,
      latest: modifyDate,
    };
  } else {
    const version =
      versionSummaries.headerVersions[scenario.header.headerVersion];
    version.earliest = new Date(
      Math.min(
        new Date(version.earliest).getTime(),
        new Date(modifyDate).getTime(),
      ),
    ).toISOString();
    version.latest = new Date(
      Math.max(
        new Date(version.latest).getTime(),
        new Date(modifyDate).getTime(),
      ),
    ).toISOString();
  }

  const metadata = {
    internalName: scenario.scenarioData.presentationData.scenarioFilename,
    modificationTime: new Date(scenario.header.modifyDate).toISOString(),
    containerVersion: scenario.version,
    headerVersion: scenario.header.headerVersion,
    dataVersion: dataVersion,
    nextObjectId: scenario.nextObjectId,
    playerNames: scenario.scenarioData.playerNames,
    playerTypes: scenario.scenarioData.playerTypes,
    playerCivilizations: scenario.scenarioData.playerCivilizations,
    description: scenario.scenarioData.presentationData.descriptionMessage,
    instructions: scenario.scenarioData.presentationData.instructionsMessage,
    hints: scenario.scenarioData.presentationData.hintsMessage,
    victory: scenario.scenarioData.presentationData.victoryMessage,
    defeat: scenario.scenarioData.presentationData.defeatMessage,
    history: scenario.scenarioData.presentationData.historyMessage,
    //scouts: scenario.scenarioData.presentationData.scoutsMessage,
    introVideo: scenario.scenarioData.presentationData.introVideoName,
    victoryVideo: scenario.scenarioData.presentationData.victoryVideoName,
    defeatVideo: scenario.scenarioData.presentationData.defeatVideoName,
    bitmapFilename:
      scenario.scenarioData.presentationData.instructionsBitmapName,
    playerAiData: scenario.scenarioData.aiData.map((aiData) => ({
      strategyFile: `${aiData.aiStrategy.name} (${aiData.aiStrategy.fileSize})`,
      cityPlanFile: `${aiData.aiCityPlan.name} (${aiData.aiCityPlan.fileSize})`,
      personalityFile: `${aiData.aiPersonality.name} (${aiData.aiPersonality.fileSize})`,
    })),
  };
  writeFileSync(outputFile, JSON.stringify(metadata, null, 2));
  Logger.info(`Scenario metadata written to ${outputFile}`);
}
