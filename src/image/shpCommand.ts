import yargs from "yargs";
import BufferReader from "../BufferReader";
import { parseShpImage } from "./shpImage";
import { readPaletteFile } from "./palette";
import { Logger } from "../Logger";
import { readColormap } from "./colormap";
import { Graphic, writeGraphic } from "./Graphic";
import { asUInt8 } from "../ts/base-types";
import { mkdirSync } from "fs";
import path from "path";

interface ConvertShpArgs {
  filename: string;
  paletteFile: string;
  colormapFile?: string;
  outputFormat: "bmp" | "gif";
  transparentColor: number | undefined;
  frameDelay: number;
  outputDir: string;
}

export function addCommands(yargs: yargs.Argv<unknown>) {
  return yargs.command<ConvertShpArgs>(
    "convert <filename>",
    "Convert an SHP file",
    (yargs) => {
      return yargs
        .positional("filename", {
          type: "string",
          describe: "Filename of SHP file that will be converted",
          demandOption: true,
        })
        .option("palette-file", {
          type: "string",
          describe: "Palette file that will be used (JASC-PAL or BMP)",
          demandOption: true,
        })
        .option("colormap-file", {
          type: "string",
          describe: "Apply colormap file to graphic",
        })
        .option("transparent-color", {
          type: "string",
          describe:
            "Palette index to use as transparent color or 'none' for no transparent index",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          coerce: (arg: any) =>
            arg === "none" ? undefined : (asUInt8(Number(arg)) as number),
          default: 255,
        })
        .option("frame-delay", {
          type: "number",
          describe:
            "Frame delay used for animated gifs, in 1/100 of a second (centiseconds)",
          default: 10,
        })
        .option("output-format", {
          type: "string",
          describe: "Format that output file will be written in",
          choices: ["bmp", "gif"],
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

  if (commandType === "convert") {
    const {
      filename,
      outputDir,
      paletteFile,
      colormapFile,
      outputFormat,
      transparentColor,
      frameDelay,
    } = argv as unknown as ConvertShpArgs;

    console.log(`Transparent color input is ${transparentColor}`);

    const palette = readPaletteFile(paletteFile);

    const buffer = new BufferReader(filename);
    const shpFrames = parseShpImage(buffer);
    const graphic = new Graphic(shpFrames);
    graphic.palette = palette;
    Logger.info(`SHP image parsed successfully`);
    if (colormapFile) {
      const colormap = readColormap(colormapFile);
      shpFrames.forEach((image) => {
        image.applyColormap(colormap);
      });
    }

    const graphicsDirectory = path.join(outputDir, "graphics");
    mkdirSync(graphicsDirectory, { recursive: true });

    writeGraphic(
      outputFormat,
      graphic,
      { transparentIndex: transparentColor, delay: frameDelay },
      filename,
      graphicsDirectory,
    );
  } else {
    showHelp();
  }
}
