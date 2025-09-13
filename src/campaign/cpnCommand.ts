import { readFileSync, statSync } from "fs";
import yargs from "yargs";
import BufferReader from "../BufferReader";
import path from "path";
import { clearDirectory } from "../files/file-utils";
import { Logger } from "../Logger";
import { Campaign } from "./Campaign";
import { FileEntry } from "../files/FileEntry";
import { Temporal } from "temporal-polyfill";

interface ExtractCampaignScenariosCommandArgs {
  filename: string;
  encoding: string;
  outputDir: string;
  fakeEsTime: boolean;
}

export function addCommands(yargs: yargs.Argv<unknown>) {
  yargs.command<ExtractCampaignScenariosCommandArgs>(
    "extract-scenarios <filename>",
    "Process a CPN file and extract its bundled scenarios",
    (yargs) => {
      return yargs
        .positional("filename", {
          type: "string",
          describe: "Filename of campaign file that will be parsed",
          demandOption: true,
        })
        .option("encoding", {
          type: "string",
          describe:
            "Encoding of the campaign file (default: latin1). Can be any encoding supported by iconv-lite.",
          default: "latin1",
        })
        .option("output-dir", {
          type: "string",
          describe: "Directory where output files will be written",
          default: "output",
        })
        .option("fake-es-time", {
          type: "boolean",
          describe:
            "Makes the UTC value of the timestamp CST (Ensemble Studios time), making the time less accurate but more consistent with other files in the original game. This is only used if the file includes a UTC timestamp (header version 2). Also fixes issues with some files having year 1995 instead of 1997.",
          default: false,
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
    case "extract-scenarios":
      extractCampaignScenarios(
        argv as unknown as ExtractCampaignScenariosCommandArgs,
      );
      break;
    default:
      showHelp();
      break;
  }
}

function extractCampaignScenarios(args: ExtractCampaignScenariosCommandArgs) {
  const { filename, encoding, outputDir, fakeEsTime } = args;
  const campaignFile = readFileSync(filename);
  const fileStats = statSync(filename);
  const campaign = Campaign.readFromBuffer(
    new BufferReader(campaignFile),
    encoding,
    fileStats.mtimeMs,
  );

  const outputDirectory = path.join(
    outputDir,
    "scenarios",
    path.parse(filename).name,
  );
  clearDirectory(outputDirectory);
  campaign.scenarios.forEach((scenario) => {
    let modificationTime = scenario.modifyDate;
    if (fakeEsTime && scenario.headerVersion >= 2) {
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
    const scenarioFile = new FileEntry({
      data: scenario.data,
      filename: scenario.filename,
      modificationTime,
    });
    Logger.info(`Writing ${scenario.filename}`);
    scenarioFile.writeToFile(outputDirectory);
  });
  Logger.info(`Campaign scenario extraction finished`);
}
