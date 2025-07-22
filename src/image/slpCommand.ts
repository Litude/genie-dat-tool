import yargs from "yargs";
import BufferReader from "../BufferReader";
import { parseSlpImage } from "./slpImage";
import {
  addBaseImageCommand,
  BaseImageCommandArgs,
  executeBaseImageCommand,
} from "./baseImageCommand";

export interface ConvertSlpArgs extends BaseImageCommandArgs {
  playerColor: number;
  shadowColor: number;
}

export function addCommands(yargs: yargs.Argv<unknown>) {
  addBaseImageCommand(yargs, "SLP", (yargs) => {
    return yargs
      .option("player-color", {
        type: "number",
        describe: "Palette index to use as first player color",
        default: 16,
      })
      .option("shadow-color", {
        type: "number",
        describe: "Palette index to use as shadow color",
        default: 0,
      });
  });
}

export function execute(
  argv: ReturnType<typeof yargs.parseSync>,
  showHelp: () => void,
) {
  executeBaseImageCommand(
    argv,
    "SLP",
    (buffer: BufferReader, args: ReturnType<typeof yargs.parseSync>) => {
      const { playerColor, shadowColor } = args as unknown as ConvertSlpArgs;
      return parseSlpImage(buffer, { playerColor, shadowColor });
    },
    showHelp,
  );
}
