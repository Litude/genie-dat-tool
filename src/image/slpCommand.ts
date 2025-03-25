import yargs from "yargs";
import BufferReader from "../BufferReader";
import { parseSlpImage } from "./slpImage";
import { applySystemColors, readPaletteFile } from "./palette";
import { Logger } from "../Logger";
import { Graphic, writeGraphic } from "./Graphic";
import { asUInt8 } from "../ts/base-types";
import path from "path";
import { mkdirSync } from "fs";

interface ConvertSlpArgs {
  filename: string;
  paletteFile: string;
  forceSystemColors: boolean;
  playerColor: number;
  shadowColor: number;
  transparentColor: number | undefined;
  frameDelay: number;
  outputFormat: "bmp" | "gif";
  outputDir: string;
}

export function addCommands(yargs: yargs.Argv<unknown>) {
  return yargs.command<ConvertSlpArgs>(
    "convert <filename>",
    "Convert an SLP file",
    (yargs) => {
      return yargs
        .positional("filename", {
          type: "string",
          describe: "Filename of SLP file that will be converted",
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
        .option("player-color", {
          type: "number",
          describe: "Palette index to use as first player color",
          default: 16,
        })
        .option("shadow-color", {
          type: "number",
          describe: "Palette index to use as shadow color",
          default: 0,
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
      forceSystemColors,
      outputFormat,
      transparentColor,
      frameDelay,
      playerColor,
      shadowColor,
    } = argv as unknown as ConvertSlpArgs;

    const palette = readPaletteFile(paletteFile);
    if (forceSystemColors) {
      applySystemColors(palette);
    }

    const buffer = new BufferReader(filename);
    const slpFrames = parseSlpImage(buffer, { playerColor, shadowColor });
    const graphic = new Graphic(slpFrames);
    graphic.palette = palette;
    Logger.info(`SLP image parsed successfully`);

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
