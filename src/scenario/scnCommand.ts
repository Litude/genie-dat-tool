import { readFileSync, statSync } from "fs";
import yargs from "yargs";
import { ScenarioContainer } from "./ScenarioContainer";
import BufferReader from "../BufferReader";
import path from "path";
import { clearDirectory } from "../files/file-utils";

interface ExtractScenarioFilesCommandArgs {
  filename: string;
  metadata: boolean;
  outputDir: string;
}

export function addCommands(yargs: yargs.Argv<unknown>) {
  yargs.command<ExtractScenarioFilesCommandArgs>(
    "extract-files <filename>",
    "Process a SCN file and extract its bundled files (bitmaps and AI files)",
    (yargs) => {
      return yargs
        .positional("filename", {
          type: "string",
          describe: "Filename of scenario file that will be parsed",
          demandOption: true,
        })
        .option("metadata", {
          type: "boolean",
          describe: "Write additional scenario metadata",
          default: false,
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
    case "extract-files":
      extractScenarioFiles(argv as unknown as ExtractScenarioFilesCommandArgs);
      break;
    default:
      showHelp();
      break;
  }
}

function extractScenarioFiles(args: ExtractScenarioFilesCommandArgs) {
  const { filename, outputDir } = args;
  const scenarioFile = readFileSync(filename);
  const fileStats = statSync(filename);
  const scenario = ScenarioContainer.readFromBuffer(
    new BufferReader(scenarioFile),
    fileStats.mtimeMs,
  );

  const outputDirectory = path.join(
    outputDir,
    "scnfiles",
    path.parse(filename).name,
  );
  clearDirectory(outputDirectory);
  scenario.extractEmbeddedFiles(outputDirectory);
  //console.log(JSON.stringify(scenario));
}
