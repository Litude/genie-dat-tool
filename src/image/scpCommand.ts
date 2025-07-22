import yargs from "yargs";
import BufferReader from "../BufferReader";
import { parseScpImage } from "./scpImage";
import {
  addBaseImageCommand,
  executeBaseImageCommand,
} from "./baseImageCommand";

export function addCommands(yargs: yargs.Argv<unknown>) {
  addBaseImageCommand(yargs, "SCP");
}

export function execute(
  argv: ReturnType<typeof yargs.parseSync>,
  showHelp: () => void,
) {
  executeBaseImageCommand(
    argv,
    "SCP",
    (buffer: BufferReader, _args: ReturnType<typeof yargs.parseSync>) => {
      return parseScpImage(buffer);
    },
    showHelp,
  );
}
