import yargs from "yargs";
import BufferReader from "../BufferReader";
import { parseShpImage } from "./shpImage";
import {
  applySystemColors,
  getPaletteWithWaterColors,
  readPaletteFile,
} from "./palette";
import { Logger } from "../Logger";
import { readColormap } from "./colormap";
import { Graphic, writeGraphic } from "./Graphic";
import { asUInt8 } from "../ts/base-types";
import { mkdirSync } from "fs";
import path from "path";

interface ConvertShpArgs {
  filename: string;
  paletteFile: string;
  forceSystemColors: boolean;
  forceWaterColors: boolean;
  colormapFile?: string;
  outputFormat: "bmp" | "gif" | "gif-frames";
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
        .option("force-system-colors", {
          type: "boolean",
          describe:
            "Forces the 20 reserved Windows system colors to appear in all palettes. AoE does not always have these properly set in all palettes but some graphics still use them. Use this to correct strange green pixels.",
          default: false,
        })
        .option("force-water-colors", {
          type: "boolean",
          describe:
            "Forces the 7 water colors to appear in the palette. These will override the system colors if specified.",
          default: false,
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
          choices: ["bmp", "gif", "gif-frames"],
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
      forceSystemColors,
      forceWaterColors,
      colormapFile,
      outputFormat,
      transparentColor,
      frameDelay,
    } = argv as unknown as ConvertShpArgs;

    let palette = readPaletteFile(paletteFile);
    if (forceSystemColors) {
      applySystemColors(palette);
    }
    if (forceWaterColors) {
      palette = getPaletteWithWaterColors(palette, 0);
    }

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
