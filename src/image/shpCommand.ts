import yargs from "yargs";
import BufferReader from "../BufferReader";
import { parseShpImage } from "./shpImage";
import { readColormap } from "./colormap";
import {
  addBaseImageCommand,
  BaseImageCommandArgs,
  executeBaseImageCommand,
} from "./baseImageCommand";

interface ConvertShpArgs extends BaseImageCommandArgs {
  colormapFile?: string;
}

export function addCommands(yargs: yargs.Argv<unknown>) {
  addBaseImageCommand(yargs, "SHP", (yargs) => {
    return yargs.option("colormap-file", {
      type: "string",
      describe: "Apply colormap file to graphic",
    });
  });
}

export function execute(
  argv: ReturnType<typeof yargs.parseSync>,
  showHelp: () => void,
) {
  executeBaseImageCommand(
    argv,
    "SHP",
    (buffer: BufferReader, args: ReturnType<typeof yargs.parseSync>) => {
      const { colormapFile } = args as unknown as ConvertShpArgs;
      const frames = parseShpImage(buffer);
      if (colormapFile) {
        const colormap = readColormap(colormapFile);
        frames.forEach((image) => {
          image.applyColormap(colormap);
        });
      }
      return frames;
    },
    showHelp,
  );
}
