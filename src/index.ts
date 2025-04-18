import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import * as DrsCommand from "./drs/drsCommand";
import * as DatCommand from "./database/datCommand";
import * as ScnCommand from "./scenario/scnCommand";
import * as CpnCommand from "./campaign/cpnCommand";
import * as ShpCommand from "./image/shpCommand";
import * as SlpCommand from "./image/slpCommand";
import * as ScpCommand from "./image/scpCommand";

const yargsInstance = yargs(hideBin(process.argv))
  .scriptName("rge-multitool")
  .usage("$0 <command> [options]")
  .command("dat", "Handle DAT files", (yargs) => {
    DatCommand.addCommands(yargs);
  })
  .command("scn", "Handle SCN/SCX files", (yargs) => {
    ScnCommand.addCommands(yargs);
  })
  .command("cpn", "Handle CPN/CPX files", (yargs) => {
    CpnCommand.addCommands(yargs);
  })
  .command("drs", "Handle DRS files", (yargs) => {
    DrsCommand.addCommands(yargs);
  })
  .command("shp", "Handle SHP files", (yargs) => {
    ShpCommand.addCommands(yargs);
  })
  .command("slp", "Handle SLP files", (yargs) => {
    SlpCommand.addCommands(yargs);
  })
  .command("scp", "Handle SCP files", (yargs) => {
    ScpCommand.addCommands(yargs);
  })
  .help()
  .alias("help", "h");

const argv = yargsInstance.strict().parseSync();

function main() {
  const commandType = argv._[0];
  const showHelp = () => yargsInstance.showHelp();
  switch (commandType) {
    case "dat":
      DatCommand.execute(argv, showHelp);
      break;
    case "scn":
      ScnCommand.execute(argv, showHelp);
      break;
    case "cpn":
      CpnCommand.execute(argv, showHelp);
      break;
    case "drs":
      DrsCommand.execute(argv, showHelp);
      break;
    case "shp":
      ShpCommand.execute(argv, showHelp);
      break;
    case "slp":
      SlpCommand.execute(argv, showHelp);
      break;
    case "scp":
      ScpCommand.execute(argv, showHelp);
      break;
    default:
      showHelp();
      break;
  }
}

main();
