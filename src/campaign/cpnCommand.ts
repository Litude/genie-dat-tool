import { readFileSync, statSync } from "fs";
import yargs from "yargs";
import BufferReader from "../BufferReader";
import path from "path";
import { clearDirectory } from "../files/file-utils";
import { Logger } from "../Logger";
import { Campaign } from "./Campaign";
import { FileEntry } from "../files/FileEntry";

interface ExtractCampaignScenariosCommandArgs {
  filename: string;
  outputDir: string;
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
        .option("output-dir", {
          type: "string",
          describe: "Directory where output files will be written",
          default: "output",
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
  const { filename, outputDir } = args;
  const campaignFile = readFileSync(filename);
  const fileStats = statSync(filename);
  const campaign = Campaign.readFromBuffer(
    new BufferReader(campaignFile),
    fileStats.mtimeMs,
  );

  const outputDirectory = path.join(
    outputDir,
    "scenarios",
    path.parse(filename).name,
  );
  clearDirectory(outputDirectory);
  campaign.scenarios.forEach((scenario) => {
    const scenarioFile = new FileEntry({
      data: scenario.data,
      filename: scenario.filename,
      modificationTime: scenario.modifyDate,
    });
    Logger.info(`Writing ${scenario.filename}`);
    scenarioFile.writeToFile(outputDirectory);
  });
  Logger.info(`Campaign scenario extraction finished`);
}
