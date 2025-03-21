import yargs from "yargs";
import BufferReader from "../BufferReader";
import { parseSlpImage } from "./slpImage";
import { readPaletteFile } from "./palette";
import { Logger } from "../Logger";
import { writeRawImages } from "./RawImage";

interface ConvertSlpArgs {
  filename: string;
  paletteFile: string;
  playerColor: number;
  shadowColor: number;
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
      outputFormat,
      playerColor,
      shadowColor,
    } = argv as unknown as ConvertSlpArgs;

    const palette = readPaletteFile(paletteFile);

    const buffer = new BufferReader(filename);
    const slpImages = parseSlpImage(buffer, { playerColor, shadowColor });
    Logger.info(`SLP image parsed successfully`);
    slpImages.forEach((image) => {
      image.setPalette(palette);
    });

    writeRawImages(outputFormat, slpImages, palette, filename, outputDir);
  } else {
    showHelp();
  }
}
