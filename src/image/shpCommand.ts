import yargs from "yargs";
import BufferReader from "../BufferReader";
import { parseShpImage } from "./shpImage";
import { readPaletteFile } from "./palette";
import { Logger } from "../Logger";
import { readColormap } from "./colormap";
import { writeRawImages } from "./RawImage";

interface ConvertShpArgs {
  filename: string;
  paletteFile: string;
  colormapFile?: string;
  outputFormat: "bmp" | "gif";
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

    writeRawImages(outputFormat, shpImages, palette, filename, outputDir);
  } else {
    showHelp();
  }
}
