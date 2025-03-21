import yargs from "yargs";
import { GifWriter } from "omggif";
import BufferReader from "../BufferReader";
import { parseShpImage } from "./shpImage";
import { writeFileSync } from "fs";
import path from "path";
import { readPaletteFile } from "./palette";
import { Logger } from "../Logger";
import { readColormap } from "./colormap";
import { Rectangle } from "../geometry/Rectangle";

interface ConvertShpArgs {
  filename: string;
  paletteFile: string;
  colormapFile?: string;
  outputFormat: "bmp" | "gif";
  outputDir: string;
  attributesFile: string;
  habitatsFile: string;
  effectNames?: string;
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
    const { filename, outputDir, paletteFile, colormapFile, outputFormat } =
      argv as unknown as ConvertShpArgs;

    const palette = readPaletteFile(paletteFile);

    const buffer = new BufferReader(filename);
    const shpImages = parseShpImage(buffer);
    Logger.info(`SHP image parsed successfully`);
    shpImages.forEach((image) => {
      image.setPalette(palette);
    });
    if (colormapFile) {
      const colormap = readColormap(colormapFile);
      shpImages.forEach((image) => {
        image.applyColormap(colormap);
      });
    }

    switch (outputFormat) {
      case "bmp": {
        const bmpFiles = shpImages.map((image) => image.toBmpData());
        bmpFiles.forEach((file, index) => {
          const outputPath = path.join(
            outputDir,
            `${path.parse(filename).name}_${index}.bmp`,
          );
          writeFileSync(outputPath, file);
          Logger.info(`Wrote ${outputPath}`);
        });
        break;
      }
      case "gif": {
        const offset = shpImages[0].getOffset();
        const width = shpImages[0].getWidth();
        const height = shpImages[0].getHeight();
        const bounds: Rectangle<number> = {
          left: -offset.x,
          top: -offset.y,
          right: width - offset.x - 1,
          bottom: height - offset.y - 1,
        };
        shpImages.forEach((image) => {
          const offset = image.getOffset();
          const width = image.getWidth();
          const height = image.getHeight();
          bounds.left = Math.min(bounds.left, -offset.x);
          bounds.top = Math.min(bounds.top, -offset.y);
          bounds.right = Math.max(bounds.right, width - offset.x - 1);
          bounds.bottom = Math.max(bounds.bottom, height - offset.y - 1);
        });
        const animationWidth = bounds.right - bounds.left + 1;
        const animationHeight = bounds.bottom - bounds.top + 1;

        const gifBuffer = Buffer.alloc(
          1024 * 1024 + animationWidth * animationHeight * shpImages.length,
        );
        const gifWriter = new GifWriter(
          gifBuffer,
          animationWidth,
          animationHeight,
          {
            loop: 0,
            palette: palette.map((entry) => {
              let value = +entry.blue;
              value |= entry.green << 8;
              value |= entry.red << 16;
              return value;
            }),
          },
        );
        shpImages.forEach((image) => {
          image.appendToGif(gifWriter, bounds);
        });
        const gifData = gifBuffer.subarray(0, gifWriter.end());
        const outputPath = path.join(
          outputDir,
          `${path.parse(filename).name}.gif`,
        );
        writeFileSync(outputPath, gifData);
        Logger.info(`Wrote ${outputPath}`);
        break;
      }
      default:
        Logger.error(`Invalid output format ${outputFormat}`);
    }
  } else {
    showHelp();
  }
}
