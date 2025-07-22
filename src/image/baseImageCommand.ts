import yargs from "yargs";
import { asUInt8 } from "../ts/base-types";
import { applySystemColors, readPaletteFile } from "./palette";
import { lstatSync, mkdirSync, readdirSync } from "fs";
import path from "path";
import { clearDirectory } from "../files/file-utils";
import BufferReader from "../BufferReader";
import { Logger } from "../Logger";
import { Graphic, writeGraphic } from "./Graphic";
import { RawImage } from "./RawImage";

export interface BaseImageCommandArgs {
  filePath: string;
  paletteFile: string;
  forceSystemColors: boolean;
  firstFrame: number;
  lastFrame: number;
  animateWater: boolean;
  animate1996Ui: boolean;
  transparentColor: number | undefined;
  frameDelay: number;
  replayDelay: number;
  outputFormat: "bmp" | "gif" | "gif-frames";
  outputDir: string;
}

export function addBaseImageCommand(
  yargs: yargs.Argv<unknown>,
  imageType: string,
  modifierFunction?: (yargs: any) => any,
) {
  return yargs.command<BaseImageCommandArgs>(
    "convert <file-path>",
    `Convert ${imageType} files`,
    (yargs) => {
      let builder = yargs
        .positional("file-path", {
          type: "string",
          describe: `File path of ${imageType} file that will be converted. Can also be a directory, in which case all ${imageType} files in the directory will be converted`,
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
        .option("animate-water", {
          type: "boolean",
          describe:
            "Animates water colors in animations that use these color indices. Can make the files significantly larger and processing much slower.",
          default: false,
        })
        .option("animate-1996-ui", {
          type: "boolean",
          describe:
            "Animates the two 1996 UI color cycles in animations that use these color indices. Can make the files significantly larger and processing much slower.",
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
        .option("replay-delay", {
          type: "number",
          describe:
            "Frame delay added to last frame (frame delay is also considered)",
          default: 0,
        })
        .option("first-frame", {
          type: "number",
          describe: "Index of the first frame to include in the output",
          default: 0,
        })
        .option("last-frame", {
          type: "number",
          describe: "Index of the last frame to include in the output",
          default: -1, // -1 means all frames
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

      // Allow further modification of the builder for specific imageTypes
      if (modifierFunction) {
        builder = modifierFunction(builder);
      }
      return builder;
    },
  );
}

export function executeBaseImageCommand(
  argv: ReturnType<typeof yargs.parseSync>,
  imageType: string,
  parserFunction: (
    buffer: BufferReader,
    args: ReturnType<typeof yargs.parseSync>,
  ) => RawImage[],
  showHelp: () => void,
) {
  const commandType = argv._[1];

  if (commandType === "convert") {
    const {
      filePath,
      outputDir,
      paletteFile,
      forceSystemColors,
      animateWater,
      animate1996Ui,
      outputFormat,
      transparentColor,
      frameDelay,
      replayDelay,
      firstFrame,
      lastFrame,
    } = argv as unknown as BaseImageCommandArgs;

    const palette = readPaletteFile(paletteFile);
    if (forceSystemColors) {
      applySystemColors(palette);
    }

    const filePaths: string[] = [];
    let outputDirectory = outputDir;
    const stat = lstatSync(filePath);
    if (stat.isDirectory()) {
      outputDirectory = path.join(
        outputDir,
        "graphics",
        path.basename(filePath),
      );
      clearDirectory(outputDirectory);
      filePaths.push(
        ...readdirSync(filePath)
          .filter(
            (entry) =>
              path.parse(entry).ext.toLowerCase() ===
              `.${imageType.toLocaleLowerCase()}`,
          )
          .map((entry) => path.join(filePath, entry)),
      );
      if (filePaths.length === 0) {
        Logger.error(`No ${imageType} files found in directory ${filePath}.`);
        return;
      }
    } else if (stat.isFile()) {
      filePaths.push(filePath);
      outputDirectory = path.join(outputDir, "graphics");
      mkdirSync(outputDirectory, { recursive: true });
    }

    filePaths.forEach((filename) => {
      const buffer = new BufferReader(filename);
      const frames = parserFunction(buffer, argv);
      const graphic = new Graphic(frames);
      graphic.palette = palette;
      graphic.filename = filename;
      Logger.info(`${imageType} image ${filename} parsed successfully`);

      writeGraphic(
        outputFormat,
        graphic,
        {
          transparentIndex: transparentColor,
          delay: frameDelay,
          replayDelay,
          animateWater,
          animate1996Ui,
          firstFrame,
          lastFrame,
        },
        filename,
        outputDirectory,
      );
    });
  } else {
    showHelp();
  }
}
