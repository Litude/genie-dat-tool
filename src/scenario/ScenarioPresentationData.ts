import { StringId } from "../database/Types";
import {
  asInt16,
  asInt32,
  asUInt16,
  asUInt32,
  Int16,
  Int32,
  UInt32,
  UInt8,
} from "../ts/base-types";
import BufferReader from "../BufferReader";
import { ScenarioLoadingContext } from "./ScenarioLoadingContext";
import { BufferWriter } from "../BufferWriter";
import { FileEntry } from "../files/FileEntry";

interface BitmapInfoHeader {
  size: UInt32;
  width: Int32;
  height: Int32;
  planes: Int16;
  bitCount: Int16;
  compression: UInt32;
  imageSize: UInt32;
  horizontalResolution: Int32;
  verticalResolution: Int32;
  colorsUsed: UInt32;
  colorsImportant: UInt32;
}

interface BitmapColor {
  blue: UInt8;
  green: UInt8;
  red: UInt8;
  reserved: UInt8;
}

export interface ScenarioBitmap {
  memoryAllocationType: Int32;
  bitmapWidth: Int32;
  bitmapHeight: Int32;
  bitmapOrientation: Int16;
  bitmapData: {
    bitmapInfoHeader: BitmapInfoHeader;
    bitmapPalette: BitmapColor[];
    bitmapPixelData: Buffer;
  } | null;
}

export class ScenarioPresentationData {
  scenarioFilename: string = ""; // with extension
  instructionsStringId: StringId<Int32> = asInt32<StringId<Int32>>(-1);
  hintsStringId: StringId<Int32> = asInt32<StringId<Int32>>(-1);
  victoryStringId: StringId<Int32> = asInt32<StringId<Int32>>(-1);
  defeatStringId: StringId<Int32> = asInt32<StringId<Int32>>(-1);
  historyStringId: StringId<Int32> = asInt32<StringId<Int32>>(-1);
  scoutsStringId: StringId<Int32> = asInt32<StringId<Int32>>(-1);
  descriptionMessage: string = "";
  instructionsMessage: string = "";
  hintsMessage: string = "";
  victoryMessage: string = "";
  defeatMessage: string = "";
  historyMessage: string = "";
  scoutsMessage: string = "";
  introVideoName: string = ""; // no extension
  victoryVideoName: string = ""; // no extension
  defeatVideoName: string = ""; // no extension
  instructionsBitmapName: string = ""; // no extension
  bitmap: ScenarioBitmap = {
    memoryAllocationType: asInt32(0),
    bitmapWidth: asInt32(0),
    bitmapHeight: asInt32(0),
    bitmapOrientation: asInt16(1),
    bitmapData: null,
  };

  getEmbeddedFiles(modifyDate: number) {
    const result: FileEntry[] = [];
    if (
      this.bitmap.bitmapWidth > 0 &&
      this.bitmap.bitmapHeight > 0 &&
      this.bitmap.bitmapData
    ) {
      const bitmapFileSize =
        14 + // BITMAPFILEHEADER
        40 + // BITMAPINFOHEADER
        1024 + // palette size (256 * 4)
        this.bitmap.bitmapData.bitmapPixelData.length;
      const outputBuffer = new BufferWriter(bitmapFileSize);
      outputBuffer.writeFixedSizeString("BM", 2);
      outputBuffer.writeUInt32(asUInt32(bitmapFileSize));
      outputBuffer.writeUInt16(asUInt16(0));
      outputBuffer.writeUInt16(asUInt16(0));
      outputBuffer.writeUInt32(asUInt32(14 + 40 + 1024));

      const infoHeader = this.bitmap.bitmapData.bitmapInfoHeader;

      outputBuffer.writeUInt32(infoHeader.size);
      outputBuffer.writeInt32(infoHeader.width);
      outputBuffer.writeInt32(infoHeader.height);
      outputBuffer.writeInt16(infoHeader.planes);
      outputBuffer.writeInt16(infoHeader.bitCount);
      outputBuffer.writeUInt32(infoHeader.compression);
      outputBuffer.writeUInt32(infoHeader.imageSize);
      outputBuffer.writeInt32(infoHeader.horizontalResolution);
      outputBuffer.writeInt32(infoHeader.verticalResolution);
      outputBuffer.writeUInt32(infoHeader.colorsUsed);
      outputBuffer.writeUInt32(infoHeader.colorsImportant);

      const palette = this.bitmap.bitmapData.bitmapPalette;
      if (palette.length !== 256) {
        throw new Error(`Unexpected bitmap palette length ${palette.length}`);
      }
      for (let i = 0; i < palette.length; ++i) {
        outputBuffer.writeUInt8(palette[i].blue);
        outputBuffer.writeUInt8(palette[i].green);
        outputBuffer.writeUInt8(palette[i].red);
        outputBuffer.writeUInt8(palette[i].reserved);
      }
      outputBuffer.writeBuffer(this.bitmap.bitmapData.bitmapPixelData);

      const outputData = outputBuffer.data();
      const outputFile = new FileEntry({
        data: outputData,
        filename: `${this.instructionsBitmapName}.bmp`,
        modificationTime: modifyDate,
      });
      result.push(outputFile);
    }
    return result;
  }

  static readFromBuffer(
    buffer: BufferReader,
    loadingContext: ScenarioLoadingContext,
  ) {
    const presentationData = new ScenarioPresentationData();
    presentationData.scenarioFilename = buffer.readPascalString16();
    if (loadingContext.dataVersion >= 1.16) {
      presentationData.instructionsStringId =
        buffer.readInt32<StringId<Int32>>();
      presentationData.hintsStringId = buffer.readInt32<StringId<Int32>>();
      presentationData.victoryStringId = buffer.readInt32<StringId<Int32>>();
      presentationData.defeatStringId = buffer.readInt32<StringId<Int32>>();
      presentationData.historyStringId = buffer.readInt32<StringId<Int32>>();
      if (loadingContext.dataVersion >= 1.22) {
        presentationData.scoutsStringId = buffer.readInt32<StringId<Int32>>();
      }
    }
    if (loadingContext.dataVersion <= 1.02) {
      presentationData.descriptionMessage = buffer.readPascalString16();
    }
    presentationData.instructionsMessage = buffer.readPascalString16();
    if (loadingContext.dataVersion >= 1.11) {
      presentationData.hintsMessage = buffer.readPascalString16();
    }

    if (
      loadingContext.dataVersion <= 1.02 ||
      loadingContext.dataVersion >= 1.11
    ) {
      presentationData.victoryMessage = buffer.readPascalString16();
      presentationData.defeatMessage = buffer.readPascalString16();
    }

    if (loadingContext.dataVersion >= 1.11) {
      presentationData.historyMessage = buffer.readPascalString16();
    }
    if (loadingContext.dataVersion >= 1.22) {
      presentationData.scoutsMessage = buffer.readPascalString16();
    }

    presentationData.introVideoName = buffer.readPascalString16();
    presentationData.victoryVideoName = buffer.readPascalString16();
    presentationData.defeatVideoName = buffer.readPascalString16();

    if (loadingContext.dataVersion >= 1.09) {
      presentationData.instructionsBitmapName = buffer.readPascalString16();
    }
    // eslint-disable-next-line prettier/prettier
    if (loadingContext.dataVersion >= 1.10) {
      const bitmap = presentationData.bitmap;
      bitmap.memoryAllocationType = buffer.readInt32();
      bitmap.bitmapWidth = buffer.readInt32();
      bitmap.bitmapHeight = buffer.readInt32();
      bitmap.bitmapOrientation = buffer.readInt16();
      if (bitmap.bitmapWidth > 0 && bitmap.bitmapHeight > 0) {
        const bitmapInfoHeader: BitmapInfoHeader = {
          size: buffer.readUInt32(),
          width: buffer.readInt32(),
          height: buffer.readInt32(),
          planes: buffer.readInt16(),
          bitCount: buffer.readInt16(),
          compression: buffer.readUInt32(),
          imageSize: buffer.readUInt32(),
          horizontalResolution: buffer.readInt32(),
          verticalResolution: buffer.readInt32(),
          colorsUsed: buffer.readUInt32(),
          colorsImportant: buffer.readUInt32(),
        };
        if (bitmapInfoHeader.bitCount !== 8) {
          throw new Error(
            `Tried parsing Bitmap file but bits per pixel was ${bitmapInfoHeader.bitCount} which is not supported!`,
          );
        }
        if (
          bitmapInfoHeader.colorsUsed !== 0 &&
          bitmapInfoHeader.colorsUsed !== 256
        ) {
          throw new Error(
            `Tried parsing Bitmap file but palette contains only ${bitmapInfoHeader.colorsUsed} which is not supported!`,
          );
        }

        const bitmapPalette: BitmapColor[] = [];
        for (let i = 0; i < 256; ++i) {
          bitmapPalette.push({
            blue: buffer.readUInt8(),
            green: buffer.readUInt8(),
            red: buffer.readUInt8(),
            reserved: buffer.readUInt8(),
          });
        }

        const bitmapPitch = (bitmapInfoHeader.width + 3) & ~3;
        const bitmapSize = bitmapInfoHeader.height * bitmapPitch;
        const bitmapPixelData = buffer.readBuffer(bitmapSize);

        bitmap.bitmapData = {
          bitmapInfoHeader,
          bitmapPalette,
          bitmapPixelData,
        };
      }
    }

    return presentationData;
  }
}
