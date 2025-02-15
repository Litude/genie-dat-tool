import JSON5 from "json5";
import semver from "semver";
import BufferReader from "../../BufferReader";
import { TextFileNames, textFileStringCompare } from "../../textfile/TextFile";
import { TextFileWriter } from "../../textfile/TextFileWriter";
import { isDefined, Nullable } from "../../ts/ts-utils";
import { getDataEntry } from "../../util";
import { JsonLoadingContext, LoadingContext } from "../LoadingContext";
import { SavingContext } from "../SavingContext";
import { SoundEffect } from "../SoundEffect";
import {
  asBool16,
  asBool8,
  asInt16,
  asInt32,
  asUInt16,
  asUInt8,
  Bool16,
  Bool16Schema,
  Bool8,
  Bool8Schema,
  Int16,
  Int32,
  UInt16,
  UInt8,
} from "../../ts/base-types";
import {
  PaletteIndex,
  ReferenceStringSchema,
  ResourceId,
  SoundEffectId,
  TerrainId,
} from "../Types";
import { Terrain } from "./Terrain";
import { onParsingError } from "../Error";
import path from "path";
import {
  createReferenceString,
  createReferenceIdFromString,
  getIdFromReferenceString,
} from "../../json/reference-id";
import {
  BaseTerrainAnimation,
  BaseTerrainFrameMap,
  BaseTerrainFrameMapJsonMapping,
  BaseTerrainFrameMapSchema,
  BaseTerrainTile,
  BaseTerrainTileSchema,
} from "./BaseTerrainTile";
import { z } from "zod";
import {
  JsonFieldMapping,
  transformObjectToJson,
  readJsonFileIndex,
  writeDataEntriesToJson,
  applyJsonFieldsToObject,
} from "../../json/json-serialization";
import { readFileSync } from "fs";

const BorderSchema = BaseTerrainTileSchema.merge(
  z.object({
    frameMaps: z
      .array(z.array(BaseTerrainFrameMapSchema).min(12).max(13))
      .length(19),
    drawTerrain: Bool8Schema,
    passabilityTerrainId: ReferenceStringSchema,
    overlayBorder: Bool16Schema,
  }),
);

type BorderJson = z.infer<typeof BorderSchema>;

const BorderJsonMapping: JsonFieldMapping<Border, BorderJson>[] = [
  {
    jsonField: "frameMaps",
    toJson: (obj, savingContext) =>
      obj.frameMaps.map((frameMapEntries) =>
        frameMapEntries.map((frameMapEntry) =>
          transformObjectToJson(
            frameMapEntry,
            BaseTerrainFrameMapJsonMapping,
            savingContext,
          ),
        ),
      ),
  },
  {
    objectField: "frameMaps",
    fromJson: (json) => {
      let frameCounter = 0;
      return json.frameMaps.map((nestedMap) =>
        nestedMap.map((entry) => {
          const frameIndex = frameCounter;
          frameCounter += entry.frameCount * entry.animationFrames;
          return {
            frameCount: entry.frameCount,
            animationFrames: entry.animationFrames,
            frameIndex:
              entry.frameIndex === undefined
                ? asInt16(frameIndex)
                : entry.frameIndex,
          };
        }),
      );
    },
  },
  { field: "drawTerrain" },
  {
    jsonField: "passabilityTerrainId",
    toJson: (obj) =>
      createReferenceString(
        "Terrain",
        obj.passabilityTerrain?.referenceId,
        obj.passabilityTerrainId,
      ),
  },
  {
    objectField: "passabilityTerrainId",
    fromJson: (json, obj, loadingContext) =>
      getIdFromReferenceString<Int16>(
        "Terrain",
        obj.referenceId,
        json.passabilityTerrainId,
        loadingContext.dataIds.terrainIds,
      ),
  },
  { field: "overlayBorder" },
];

export class Border extends BaseTerrainTile {
  frameMaps: BaseTerrainFrameMap[][] = [];
  drawTerrain: Bool8 = asBool8(false);
  padding59B: UInt8 = asUInt8(0);
  passabilityTerrainId: TerrainId<Int16> = asInt16<TerrainId<Int16>>(-1);
  passabilityTerrain: Terrain | null = null;
  overlayBorder: Bool16 = asBool16(false);
  padding59E: UInt16 = asUInt16(0);

  readFromBuffer(
    buffer: BufferReader,
    id: Int16,
    loadingContext: LoadingContext,
  ): void {
    this.id = id;
    this.enabled = buffer.readBool8();
    this.random = buffer.readBool8();

    this.internalName = buffer.readFixedSizeString(13);
    this.referenceId = createReferenceIdFromString(this.internalName);
    this.resourceFilename = buffer.readFixedSizeString(13);
    if (semver.gte(loadingContext.version.numbering, "2.0.0")) {
      this.resourceId = buffer.readInt32<ResourceId>();
    } else {
      this.resourceId = asInt32<ResourceId>(-1);
    }

    this.graphicPointer = buffer.readPointer();
    this.soundEffectId = buffer.readInt32<SoundEffectId<Int32>>();
    this.soundEffect = null;

    this.minimapColor1 = buffer.readUInt8<PaletteIndex>();
    this.minimapColor2 = buffer.readUInt8<PaletteIndex>();
    this.minimapColor3 = buffer.readUInt8<PaletteIndex>();

    this.animation = BaseTerrainAnimation.readFromBuffer(
      buffer,
      loadingContext,
    );

    this.drawCount = buffer.readUInt8();

    const shapesPerTile =
      semver.eq(loadingContext.version.numbering, "1.4.0") &&
      loadingContext.version.flavor === "mickey"
        ? 13
        : 12;

    this.frameMaps = [];
    for (let i = 0; i < 19; ++i) {
      this.frameMaps.push([]);
      for (let j = 0; j < shapesPerTile; ++j) {
        this.frameMaps[i].push({
          frameCount: buffer.readInt16(),
          animationFrames: buffer.readInt16(),
          frameIndex: buffer.readInt16(),
        });
      }
    }
    this.drawTerrain = buffer.readBool8();
    this.padding59B = buffer.readUInt8();
    this.passabilityTerrainId = buffer.readInt16<TerrainId<Int16>>();
    this.passabilityTerrain = null;
    if (semver.gte(loadingContext.version.numbering, "2.0.0")) {
      this.overlayBorder = buffer.readBool16();
    } else {
      if (loadingContext.version.flavor !== "mickey") {
        this.padding59E = buffer.readUInt16();
      }
    }
  }

  readFromJsonFile(
    jsonFile: BorderJson,
    id: Int16,
    referenceId: string,
    loadingContext: JsonLoadingContext,
  ) {
    super.readFromJsonFile(jsonFile, id, referenceId, loadingContext);
    applyJsonFieldsToObject(jsonFile, this, BorderJsonMapping, loadingContext);
  }

  linkOtherData(
    terrains: Nullable<Terrain>[],
    soundEffects: SoundEffect[],
    loadingContext: LoadingContext,
  ) {
    this.passabilityTerrain = getDataEntry(
      terrains,
      this.passabilityTerrainId,
      "Terrain",
      this.referenceId,
      loadingContext,
    );
    this.soundEffect = getDataEntry(
      soundEffects,
      this.soundEffectId,
      "SoundEffect",
      this.referenceId,
      loadingContext,
    );
  }

  appendToTextFile(
    textFileWriter: TextFileWriter,
    savingContext: SavingContext,
  ) {
    super.appendToTextFile(textFileWriter, savingContext);

    textFileWriter
      .integer(this.drawTerrain ? 1 : 0)
      .integer(this.passabilityTerrainId)
      .dynamic((writer) => {
        if (semver.gte(savingContext.version.numbering, "2.0.0")) {
          writer.integer(this.overlayBorder ? 1 : 0);
        }
      });

    const shapesPerTile =
      semver.eq(savingContext.version.numbering, "1.4.0") &&
      savingContext.version.flavor === "mickey"
        ? 13
        : 12;
    for (let j = 0; j < 19; ++j) {
      for (let k = 0; k < shapesPerTile; ++k) {
        textFileWriter
          .integer(this.frameMaps[j][k].frameCount)
          .integer(this.frameMaps[j][k].animationFrames);
      }
    }
    textFileWriter.eol();
    textFileWriter.raw(" ").eol();
  }

  toJson(savingContext: SavingContext) {
    return {
      ...super.toJson(savingContext),
      ...transformObjectToJson(this, BorderJsonMapping, savingContext),
    };
  }
}

export function readBordersFromDatFile(
  buffer: BufferReader,
  loadingContext: LoadingContext,
): Nullable<Border>[] {
  const result: Nullable<Border>[] = [];
  for (let i = 0; i < 16; ++i) {
    const border = new Border();
    border.readFromBuffer(buffer, asInt16(i), loadingContext);
    result.push(border.enabled ? border : null);
  }
  return result;
}

export function readAndVerifyBorderCountFromDatFile(
  borders: Nullable<Border>[],
  buffer: BufferReader,
  loadingContext: LoadingContext,
) {
  const borderCount = buffer.readInt16();
  if (borderCount !== borders.filter(isDefined).length) {
    onParsingError(
      `Mismatch between enabled borders and border count, DAT might be corrupt!`,
      loadingContext,
    );
  }
}

export function readBordersFromJsonFiles(
  inputDirectory: string,
  borderIds: (string | null)[],
  loadingContext: JsonLoadingContext,
) {
  const bordersDirectory = path.join(inputDirectory, "borders");
  const borders: Nullable<Border>[] = [];
  borderIds.forEach((borderReferenceId, borderNumberId) => {
    if (borderReferenceId === null) {
      borders.push(null);
    } else {
      const borderJson = BorderSchema.parse(
        JSON5.parse(
          readFileSync(
            path.join(bordersDirectory, `${borderReferenceId}.json`),
          ).toString("utf8"),
        ),
      );
      const border = new Border();
      border.readFromJsonFile(
        borderJson,
        asInt16(borderNumberId),
        borderReferenceId,
        loadingContext,
      );
      borders.push(border);
    }
  });
  return borders;
}

export function writeBordersToWorldTextFile(
  outputDirectory: string,
  borders: Nullable<Border>[],
  savingContext: SavingContext,
) {
  const textFileWriter = new TextFileWriter(
    path.join(outputDirectory, TextFileNames.Borders),
  );
  textFileWriter.raw(borders.filter(isDefined).length).eol(); // Total terrain entries
  const sortedBorders = [...borders]
    .filter(isDefined)
    .sort((a, b) => textFileStringCompare(a.internalName, b.internalName));
  sortedBorders.forEach((border) => {
    border.appendToTextFile(textFileWriter, savingContext);
  });
  textFileWriter.close();
}

export function writeBordersToJsonFiles(
  outputDirectory: string,
  borders: Nullable<Border>[],
  savingContext: SavingContext,
) {
  writeDataEntriesToJson(outputDirectory, "borders", borders, savingContext);
}

export function readBorderIdsFromJsonIndex(inputDirectory: string) {
  return readJsonFileIndex(path.join(inputDirectory, "borders"));
}
