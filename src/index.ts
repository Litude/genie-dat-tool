import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import * as DrsCommand from "./drs/command";
import * as DatCommand from "./database/command";

const yargsInstance = yargs(hideBin(process.argv))
  .scriptName("rge-multitool")
  .usage("$0 <command> [options]")
  .command("dat", "Handle DAT files", (yargs) => {
    DatCommand.addCommands(yargs);
  })
  .command("drs", "Handle DRS files", (yargs) => {
    DrsCommand.addCommands(yargs);
  })
  .help()
  .alias("help", "h");

const argv = yargsInstance.parseSync();

function main() {
  const commandType = argv._[0];
  switch (commandType) {
    case "dat":
      DatCommand.execute(argv, () => yargsInstance.showHelp());
      break;
    case "drs":
      DrsCommand.execute(argv, () => yargsInstance.showHelp());
      break;
    default:
      yargsInstance.showHelp();
      break;
  }
}

main();
