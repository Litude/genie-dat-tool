import JSON5 from "json5";
import semver from "semver";
import BufferReader from "../../BufferReader";
import { TextFileNames, textFileStringCompare } from "../../textfile/TextFile";
import { TextFileWriter } from "../../textfile/TextFileWriter";
import { isDefined, Nullable } from "../../ts/ts-utils";
import { getDataEntry } from "../../util";
import { JsonLoadingContext, LoadingContext } from "../LoadingContext";
import { SceneryObjectPrototype } from "../object/SceneryObjectPrototype";
import { SavingContext } from "../SavingContext";
import { SoundEffect } from "../SoundEffect";
import {
  BorderId,
  PaletteIndex,
  PaletteIndexSchema,
  PrototypeId,
  ReferenceStringSchema,
  ResourceId,
  SoundEffectId,
  TerrainId,
} from "../Types";
import {
  asInt16,
  asInt32,
  asUInt16,
  asUInt8,
  Bool8,
  Bool8Schema,
  Int16,
  Int16Schema,
  Int32,
  UInt16,
  UInt8,
} from "../../ts/base-types";
import { Border } from "./Border";
import { onParsingError } from "../Error";
import path from "path";
import {
  createReferenceString,
  createReferenceIdFromString,
  getIdFromReferenceString,
} from "../../json/reference-id";
import { z } from "zod";
import {
  BaseTerrainAnimation,
  BaseTerrainFrameMap,
  BaseTerrainFrameMapJsonMapping,
  BaseTerrainFrameMapSchema,
  BaseTerrainTile,
  BaseTerrainTileSchema,
} from "./BaseTerrainTile";
import {
  JsonFieldMapping,
  transformObjectToJson,
  readJsonFileIndex,
  applyJsonFieldsToObject,
  writeDataEntriesToJson,
} from "../../json/json-serialization";
import { readFileSync, writeFileSync } from "fs";
import { BaseObjectPrototype } from "../object/ObjectPrototypes";
import { writeResourceList } from "../../textfile/ResourceList";
import { Logger } from "../../Logger";
import { Graphic } from "../../image/Graphic";
import { Point } from "../../geometry/Point";
import { RawImage } from "../../image/RawImage";
import { GifWriter } from "omggif";
import {
  getPaletteWithWaterColors,
  WaterAnimationDelay,
  WaterAnimationFrameCount,
} from "../../image/palette";
import { TileTypeDeltaYMultiplier } from "./MapProperties";

interface TerrainObjectPlacement {
  prototypeId: PrototypeId<Int16>;
  object: SceneryObjectPrototype | null;
  density: Int16;
  centralize: Bool8;
}

const TerrainSchema = BaseTerrainTileSchema.merge(
  z.object({
    minimapCliffColor1: PaletteIndexSchema,
    minimapCliffColor2: PaletteIndexSchema,
    terrainPatternWidth: Int16Schema,
    terrainPatternHeight: Int16Schema,
    passableTerrainId: ReferenceStringSchema,
    impassableTerrainId: ReferenceStringSchema,
    renderedTerrainId: ReferenceStringSchema,
    borders: z.array(
      z.object({
        borderId: ReferenceStringSchema,
        terrainId: ReferenceStringSchema,
      }),
    ),
    objectPlacements: z
      .array(
        z.object({
          prototypeId: ReferenceStringSchema,
          density: Int16Schema,
          centralize: Bool8Schema,
        }),
      )
      .max(30),
    frameMaps: z.array(BaseTerrainFrameMapSchema).length(19),
  }),
);

type TerrainJson = z.infer<typeof TerrainSchema>;

const TerrainJsonMapping: JsonFieldMapping<Terrain, TerrainJson>[] = [
  { field: "minimapCliffColor1" },
  { field: "minimapCliffColor2" },
  { field: "terrainPatternWidth" },
  { field: "terrainPatternHeight" },
  {
    jsonField: "passableTerrainId",
    toJson: (obj) =>
      createReferenceString(
        "Terrain",
        obj.passableTerrain?.referenceId,
        obj.passableTerrainId,
      ),
  },
  {
    objectField: "passableTerrainId",
    fromJson: (json, obj, loadingContext) =>
      getIdFromReferenceString<Int16>(
        "Terrain",
        obj.referenceId,
        json.passableTerrainId,
        loadingContext.dataIds.terrainIds,
      ),
  },
  {
    jsonField: "impassableTerrainId",
    toJson: (obj) =>
      createReferenceString(
        "Terrain",
        obj.impassableTerrain?.referenceId,
        obj.impassableTerrainId,
      ),
  },
  {
    objectField: "impassableTerrainId",
    fromJson: (json, obj, loadingContext) =>
      getIdFromReferenceString<Int16>(
        "Terrain",
        obj.referenceId,
        json.impassableTerrainId,
        loadingContext.dataIds.terrainIds,
      ),
  },
  {
    jsonField: "renderedTerrainId",
    toJson: (obj) =>
      createReferenceString(
        "Terrain",
        obj.renderedTerrain?.referenceId,
        obj.renderedTerrainId,
      ),
  },
  {
    objectField: "renderedTerrainId",
    fromJson: (json, obj, loadingContext) =>
      getIdFromReferenceString<Int16>(
        "Terrain",
        obj.referenceId,
        json.renderedTerrainId,
        loadingContext.dataIds.terrainIds,
      ),
  },
  {
    jsonField: "borders",
    toJson: (obj) =>
      obj.borderTypes
        .map((entry, index) => {
          if (entry?.border) {
            return {
              borderId: createReferenceString(
                "Border",
                entry.border.referenceId,
                obj.borderTypeIds[index],
              ),
              terrainId: createReferenceString(
                "Terrain",
                entry.terrain?.referenceId,
                index,
              ),
            };
          } else {
            return null;
          }
        })
        .filter(isDefined),
  },
  {
    objectField: "borderTypeIds",
    fromJson: (json, obj, loadingContext) => {
      const borderTypeIds: BorderId<Int16>[] = Array.from({
        length: loadingContext.maxTerrainCount,
      }).map((_entry) => asInt16(0));

      const mappedBorders = json.borders.map((entry) => ({
        terrainId: getIdFromReferenceString(
          "Terrain",
          obj.referenceId,
          entry.terrainId,
          loadingContext.dataIds.terrainIds,
        ),
        borderId: getIdFromReferenceString<Int16>(
          "Border",
          obj.referenceId,
          entry.borderId,
          loadingContext.dataIds.borderIds,
        ),
      }));
      return borderTypeIds.map((_entry, index) => {
        const borderEntry = mappedBorders.find(
          (entry) => entry.terrainId === index,
        );
        if (borderEntry) {
          return borderEntry.borderId;
        } else {
          return asInt16(0);
        }
      });
    },
  },
  {
    jsonField: "objectPlacements",
    toJson: (obj) =>
      obj.objectPlacements.map((objectPlacement) => ({
        prototypeId: createReferenceString(
          "ObjectPrototype",
          objectPlacement.object?.referenceId,
          objectPlacement.prototypeId,
        ),
        density: objectPlacement.density,
        centralize: objectPlacement.centralize,
      })),
  },
  {
    objectField: "objectPlacements",
    fromJson: (json, obj, loadingContext) =>
      json.objectPlacements.map((objectPlacement) => ({
        prototypeId: getIdFromReferenceString<PrototypeId<Int16>>(
          "ObjectPrototype",
          obj.referenceId,
          objectPlacement.prototypeId,
          loadingContext.dataIds.prototypeIds,
        ),
        object: null,
        density: objectPlacement.density,
        centralize: objectPlacement.centralize,
      })),
  },
  {
    jsonField: "frameMaps",
    toJson: (obj, savingContext) =>
      obj.frameMaps.map((frameMapEntry) =>
        transformObjectToJson(
          frameMapEntry,
          BaseTerrainFrameMapJsonMapping,
          savingContext,
        ),
      ),
  },
  {
    objectField: "frameMaps",
    fromJson: (json) => {
      let frameCounter = 0;
      return json.frameMaps.map((entry) => {
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
      });
    },
  },
];

export class Terrain extends BaseTerrainTile {
  minimapCliffColor1: PaletteIndex = asUInt8<PaletteIndex>(0);
  minimapCliffColor2: PaletteIndex = asUInt8<PaletteIndex>(0);
  passableTerrainId: TerrainId<Int16> = asInt16<TerrainId<Int16>>(-1); // Note! This is stored as 8 bits in the data!
  passableTerrain: Terrain | null = null;
  impassableTerrainId: TerrainId<Int16> = asInt16<TerrainId<Int16>>(-1); // Note! This is stored as 8 bits in the data!
  impassableTerrain: Terrain | null = null;

  frameMaps: BaseTerrainFrameMap[] = [];
  renderedTerrainId: TerrainId<Int16> = asInt16<TerrainId<Int16>>(-1);
  renderedTerrain: Terrain | null = null;
  terrainPatternHeight: Int16 = asInt16(0);
  terrainPatternWidth: Int16 = asInt16(0);
  borderTypeIds: BorderId<Int16>[] = [];
  borderTypes: ({ border: Border | null; terrain: Terrain | null } | null)[] =
    [];
  objectPlacements: TerrainObjectPlacement[] = [];
  padding0196: UInt16 = asUInt16(0);

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
    this.minimapCliffColor1 = buffer.readUInt8<PaletteIndex>();
    this.minimapCliffColor2 = buffer.readUInt8<PaletteIndex>();

    const rawPassableTerrainId = buffer.readUInt8<TerrainId<UInt8>>();
    this.passableTerrainId = asInt16<TerrainId<Int16>>(
      rawPassableTerrainId === 255 ? -1 : rawPassableTerrainId,
    );
    const rawImpassableTerrainId = buffer.readUInt8<TerrainId<UInt8>>();
    this.impassableTerrainId = asInt16<TerrainId<Int16>>(
      rawImpassableTerrainId === 255 ? -1 : rawImpassableTerrainId,
    );

    this.animation = BaseTerrainAnimation.readFromBuffer(
      buffer,
      loadingContext,
    );

    this.drawCount = buffer.readUInt8();

    this.frameMaps = [];
    for (let i = 0; i < 19; ++i) {
      this.frameMaps.push({
        frameCount: buffer.readInt16(),
        animationFrames: buffer.readInt16(),
        frameIndex: buffer.readInt16(),
      });
    }
    this.renderedTerrainId = buffer.readInt16<TerrainId<Int16>>();
    this.terrainPatternHeight = buffer.readInt16();
    this.terrainPatternWidth = buffer.readInt16();

    this.borderTypeIds = [];
    for (let i = 0; i < 32; ++i) {
      this.borderTypeIds.push(buffer.readInt16());
    }

    const placementObjectTypes: PrototypeId<Int16>[] = [];
    const placementObjectDensities: Int16[] = [];
    const placementObjectCentralize: Bool8[] = [];
    for (let i = 0; i < 30; ++i) {
      placementObjectTypes.push(buffer.readInt16<PrototypeId<Int16>>());
    }
    for (let i = 0; i < 30; ++i) {
      placementObjectDensities.push(buffer.readInt16());
    }
    for (let i = 0; i < 30; ++i) {
      placementObjectCentralize.push(buffer.readBool8());
    }
    const placementObjectCount = buffer.readInt16();
    this.objectPlacements = [];
    for (let i = 0; i < placementObjectCount; ++i) {
      this.objectPlacements.push({
        prototypeId: placementObjectTypes[i],
        object: null,
        density: placementObjectDensities[i],
        centralize: placementObjectCentralize[i],
      });
    }

    this.padding0196 = buffer.readUInt16();
  }

  readFromJsonFile(
    jsonFile: TerrainJson,
    id: Int16,
    referenceId: string,
    loadingContext: JsonLoadingContext,
  ) {
    super.readFromJsonFile(jsonFile, id, referenceId, loadingContext);
    applyJsonFieldsToObject(jsonFile, this, TerrainJsonMapping, loadingContext);
  }

  linkOtherData(
    terrains: Nullable<Terrain>[],
    borders: Nullable<Border>[],
    soundEffects: SoundEffect[],
    objects: Nullable<BaseObjectPrototype>[],
    loadingContext: LoadingContext,
  ) {
    this.passableTerrain =
      this.passableTerrainId !== 255
        ? getDataEntry(
            terrains,
            this.passableTerrainId,
            "Terrain",
            this.referenceId,
            loadingContext,
          )
        : null;
    this.impassableTerrain =
      this.impassableTerrainId !== 255
        ? getDataEntry(
            terrains,
            this.impassableTerrainId,
            "Terrain",
            this.referenceId,
            loadingContext,
          )
        : null;
    this.renderedTerrain = getDataEntry(
      terrains,
      this.renderedTerrainId,
      "Terrain",
      this.referenceId,
      loadingContext,
    );
    this.borderTypes = this.borderTypeIds.map((borderId, terrainId) => {
      if (borderId > 0) {
        return {
          border: getDataEntry(
            borders,
            borderId,
            "Border",
            this.referenceId,
            loadingContext,
          ),
          terrain: getDataEntry(
            terrains,
            terrainId,
            "Terrain",
            this.referenceId,
            loadingContext,
          ),
        };
      } else {
        return null;
      }
    });
    this.soundEffect = getDataEntry(
      soundEffects,
      this.soundEffectId,
      "SoundEffect",
      this.referenceId,
      loadingContext,
    );
    this.objectPlacements.forEach((placement) => {
      placement.object = getDataEntry(
        objects,
        placement.prototypeId,
        "ObjectPrototype",
        this.referenceId,
        loadingContext,
      );
    });
  }

  appendToTextFile(
    textFileWriter: TextFileWriter,
    savingContext: SavingContext,
  ) {
    super.appendToTextFile(textFileWriter, savingContext);

    const borderEntries = [...this.borderTypes].sort((a, b) => {
      if (a?.terrain && b?.terrain) {
        return textFileStringCompare(
          a.terrain.internalName,
          b.terrain.internalName,
        );
      } else {
        return a?.terrain ? 1 : -1;
      }
    });
    const borderCount = borderEntries.filter((entry) => entry?.border).length;
    textFileWriter
      .integer(this.renderedTerrainId)
      .integer(this.terrainPatternHeight)
      .integer(this.terrainPatternWidth)
      .integer(this.minimapCliffColor1)
      .integer(this.minimapCliffColor2)
      .integer(this.impassableTerrainId)
      .integer(this.passableTerrainId)
      .integer(borderCount);
    for (let j = 0; j < 19; ++j) {
      textFileWriter
        .integer(this.frameMaps[j].frameCount)
        .integer(this.frameMaps[j].animationFrames);
    }
    for (let j = 0; j < this.borderTypes.length; ++j) {
      const borderEntry = borderEntries[j];
      if (borderEntry?.border) {
        textFileWriter
          .integer(borderEntry.terrain?.id ?? -1)
          .integer(borderEntry.border.id);
      }
    }
    textFileWriter.eol();
  }

  toJson(savingContext: SavingContext) {
    return {
      ...super.toJson(savingContext),
      ...transformObjectToJson(this, TerrainJsonMapping, savingContext),
    };
  }

  private writeFlatPatternToGif(
    graphic: Graphic,
    tileSize: Point<number>,
    outputDirectory: string,
    transparentIndex: number,
    animateWater: boolean,
    delayMultiplier: number,
  ) {
    const frameIndex = this.frameMaps[0].frameIndex;
    const frameCount = this.frameMaps[0].frameCount;

    const widthPadding = graphic.frames[0].width - tileSize.x;
    const heightPadding = graphic.frames[0].height - tileSize.y;

    const tiles: {
      frame: number;
      coordinate: Point<number>;
      draw: Point<number>;
    }[] = [];

    const frames: RawImage[] = [];

    for (let y = 0; y < this.terrainPatternHeight; ++y) {
      for (let x = 0; x < this.terrainPatternWidth; ++x) {
        const yModifier = y ? y % this.terrainPatternHeight : 0;
        const xModifier = x ? x % this.terrainPatternWidth : 0;
        const frameNumber =
          frameIndex +
          Math.min(
            xModifier + this.terrainPatternWidth * yModifier,
            frameCount - 1,
          );
        tiles.push({
          frame: frameNumber,
          coordinate: {
            x,
            y,
          },
          draw: {
            x: x + y,
            y: y - x + (this.terrainPatternWidth - 1),
          },
        });
      }
    }
    tiles.sort((a, b) => {
      if (a.draw.y < b.draw.y) {
        return -1;
      } else if (b.draw.y < a.draw.y) {
        return 1;
      } else {
        if (a.draw.x < b.draw.x) {
          return -1;
        } else if (b.draw.x < a.draw.x) {
          return 1;
        } else {
          return 0;
        }
      }
    });

    const imageWidth =
      tileSize.x * this.terrainPatternWidth + ((widthPadding + 1) & ~0x1);
    const imageHeight =
      tileSize.y * this.terrainPatternHeight + ((heightPadding + 1) & ~0x1);

    const imageFrame = new RawImage(imageWidth, imageHeight);

    tiles.forEach((tile) => {
      const frame = graphic.frames[tile.frame];
      imageFrame.overlayImage(frame, {
        x: tile.draw.x * (tileSize.x >> 1) + Math.ceil(widthPadding / 2),
        y: tile.draw.y * (tileSize.y >> 1) + Math.ceil(heightPadding / 2),
      });
    });

    const palette = graphic.palette;
    if (animateWater && graphic.hasWaterAnimation()) {
      for (let i = 0; i < WaterAnimationFrameCount; ++i) {
        const waterFrame = imageFrame.clone();
        waterFrame.palette = getPaletteWithWaterColors(palette, i);
        waterFrame.delay = Math.round(WaterAnimationDelay * delayMultiplier);
        frames.push(waterFrame);
      }
    } else {
      frames.push(imageFrame);
    }

    const image = new Graphic(frames);
    image.palette = graphic.palette;

    const gifBuffer = Buffer.alloc(1024 * 1024 + imageWidth * imageHeight);

    const gifWriter = new GifWriter(gifBuffer, imageWidth, imageHeight, {
      loop: 0,
      palette: image.frames.every((frame) => frame.palette)
        ? undefined
        : image.palette.map((entry) => {
            let value = +entry.blue;
            value |= entry.green << 8;
            value |= entry.red << 16;
            return value;
          }),
    });
    image.frames.forEach((image) => {
      image.appendToGif(
        gifWriter,
        { left: 0, top: 0, right: imageWidth, bottom: imageHeight },
        {
          delay: 0,
          transparentIndex,
        },
      );
    });
    const gifData = gifBuffer.subarray(0, gifWriter.end());
    const outputPath = path.join(
      outputDirectory,
      `${path.parse(this.internalName ?? "unnamed").name}_Flat.gif`,
    );
    writeFileSync(outputPath, gifData);
  }

  private writeTilePatternToGif(
    tilePattern: Nullable<number>[][],
    patternName: string,
    graphic: Graphic,
    tileSize: Point<number>,
    elevationHeight: number,
    outputDirectory: string,
    {
      transparentIndex,
      animateWater,
      delayMultiplier,
    }: {
      transparentIndex: number;
      animateWater: boolean;
      delayMultiplier: number;
    },
  ) {
    const tiles: {
      tileType: number;
      frame: number;
      coordinate: Point<number>;
      draw: Point<number>;
    }[] = [];

    for (let y = 0; y < tilePattern.length; ++y) {
      for (let x = 0; x < tilePattern[y].length; ++x) {
        const tileType = tilePattern[y][x];
        if (tileType !== null && this.frameMaps[tileType].frameCount > 0) {
          const frameNumber = this.frameMaps[tileType].frameIndex;
          tiles.push({
            tileType,
            frame: frameNumber,
            coordinate: {
              x,
              y,
            },
            draw: {
              x: x + y,
              y: y - x + (tilePattern[y].length - 1),
            },
          });
        }
      }
    }

    if (!tiles.length) {
      return;
    }

    const frames: RawImage[] = [];

    tiles.sort((a, b) => {
      if (a.draw.y < b.draw.y) {
        return -1;
      } else if (b.draw.y < a.draw.y) {
        return 1;
      } else {
        if (a.draw.x < b.draw.x) {
          return -1;
        } else if (b.draw.x < a.draw.x) {
          return 1;
        } else {
          return 0;
        }
      }
    });

    const widthPadding = 1;
    const heightPadding = 1;

    const imageWidth =
      tileSize.x * tilePattern[0].length + ((widthPadding + 1) & ~0x1);
    const imageHeight =
      tileSize.y * tilePattern.length + ((heightPadding + 1) & ~0x1);

    const imageFrame = new RawImage(imageWidth, imageHeight);

    tiles.forEach((tile) => {
      const frame = graphic.frames[tile.frame];
      const additionalYDelta =
        tile.coordinate.y > tile.coordinate.x
          ? TileTypeDeltaYMultiplier[tile.tileType] * -elevationHeight
          : 0;
      imageFrame.overlayImage(frame, {
        x: tile.draw.x * (tileSize.x >> 1) + widthPadding,
        y: tile.draw.y * (tileSize.y >> 1) + additionalYDelta + heightPadding,
      });
    });

    const palette = graphic.palette;
    if (animateWater && graphic.hasWaterAnimation()) {
      for (let i = 0; i < WaterAnimationFrameCount; ++i) {
        const waterFrame = imageFrame.clone();
        waterFrame.palette = getPaletteWithWaterColors(palette, i);
        waterFrame.delay = Math.round(WaterAnimationDelay * delayMultiplier);
        frames.push(waterFrame);
      }
    } else {
      frames.push(imageFrame);
    }

    const image = new Graphic(frames);
    image.palette = graphic.palette;

    const gifBuffer = Buffer.alloc(1024 * 1024 + imageWidth * imageHeight);

    const gifWriter = new GifWriter(gifBuffer, imageWidth, imageHeight, {
      loop: 0,
      palette: image.frames.every((frame) => frame.palette)
        ? undefined
        : image.palette.map((entry) => {
            let value = +entry.blue;
            value |= entry.green << 8;
            value |= entry.red << 16;
            return value;
          }),
    });
    image.frames.forEach((image) => {
      image.appendToGif(
        gifWriter,
        { left: 0, top: 0, right: imageWidth, bottom: imageHeight },
        {
          delay: 0,
          transparentIndex,
        },
      );
    });
    const gifData = gifBuffer.subarray(0, gifWriter.end());
    const outputPath = path.join(
      outputDirectory,
      `${path.parse(this.internalName ?? "unnamed").name}_${patternName}.gif`,
    );
    writeFileSync(outputPath, gifData);
  }

  writeToGif(
    graphics: Graphic[],
    tileSize: Point<number>,
    elevationHeight: number,
    {
      transparentIndex,
      delayMultiplier,
      animateWater,
    }: {
      transparentIndex: number;
      delayMultiplier: number;
      animateWater: boolean;
    },
    outputDirectory: string,
  ) {
    if (
      this.resourceId !== -1 ||
      this.resourceFilename.toLocaleLowerCase() !== "none"
    ) {
      const graphic = graphics.find(
        (graphic) =>
          graphic.resourceId === this.resourceId ||
          graphic.filename === this.resourceFilename,
      );
      if (!graphic) {
        Logger.error(
          `Skipping ${this.internalName} because graphic ${this.resourceId} - ${this.resourceFilename} was not found!`,
        );
        return;
      }
      this.writeFlatPatternToGif(
        graphic,
        tileSize,
        outputDirectory,
        transparentIndex,
        animateWater,
        delayMultiplier,
      );
      this.writeTilePatternToGif(
        [
          [4, 7, 1],
          [8, null, 5],
          [2, 6, 3],
        ],
        "Hill-Large",
        graphic,
        tileSize,
        elevationHeight,
        outputDirectory,
        {
          transparentIndex,
          animateWater,
          delayMultiplier,
        },
      );
      this.writeTilePatternToGif(
        [
          [12, 9],
          [10, 11],
        ],
        "Hill-Small",
        graphic,
        tileSize,
        elevationHeight,
        outputDirectory,
        {
          transparentIndex,
          animateWater,
          delayMultiplier,
        },
      );
      this.writeTilePatternToGif(
        [
          [16, 14],
          [13, 15],
        ],
        "Valley-Small",
        graphic,
        tileSize,
        elevationHeight,
        outputDirectory,
        {
          transparentIndex,
          animateWater,
          delayMultiplier,
        },
      );

      this.writeTilePatternToGif(
        [
          [16, 6, 14],
          [5, null, 8],
          [13, 7, 15],
        ],
        "Valley-Large",
        graphic,
        tileSize,
        elevationHeight,
        outputDirectory,
        {
          transparentIndex,
          animateWater,
          delayMultiplier,
        },
      );
    }
  }
}

export function readTerrainsFromDatFile(
  buffer: BufferReader,
  loadingContext: LoadingContext,
): Nullable<Terrain>[] {
  const result: Nullable<Terrain>[] = [];
  for (let i = 0; i < 32; ++i) {
    const terrain = new Terrain();
    terrain.readFromBuffer(buffer, asInt16(i), loadingContext);
    result.push(terrain.enabled ? terrain : null);
  }
  return result;
}

export function readAndVerifyTerrainCountFromDatFile(
  terrains: Nullable<Terrain>[],
  buffer: BufferReader,
  loadingContext: LoadingContext,
) {
  const terrainCount = buffer.readInt16();
  if (terrainCount !== terrains.filter((x) => x).length) {
    onParsingError(
      `Mismatch between enabled terrains and terrain count, DAT might be corrupt!`,
      loadingContext,
    );
  }
}

function writeTerrainObjectsToWorldTextFile(
  outputDirectory: string,
  terrains: Nullable<Terrain>[],
  _savingContext: SavingContext,
) {
  const textFileWriter = new TextFileWriter(
    path.join(outputDirectory, TextFileNames.TerrainObjects),
  );
  const parsedEntries = [...terrains]
    .filter(isDefined)
    .sort((a, b) => textFileStringCompare(a.internalName, b.internalName))
    .flatMap((terrain) =>
      terrain.objectPlacements.map((placement) => ({
        ...placement,
        terrainId: terrain.id,
      })),
    );
  textFileWriter.raw(parsedEntries.length).eol();

  parsedEntries.forEach((entry) => {
    if (entry.prototypeId >= 0) {
      textFileWriter
        .integer(entry.terrainId)
        .integer(entry.prototypeId)
        .integer(entry.density)
        .integer(entry.centralize ? 1 : 0)
        .eol();
    }
  });
  textFileWriter.close();
}

export function readTerrainsFromJsonFiles(
  inputDirectory: string,
  terrainIds: (string | null)[],
  loadingContext: JsonLoadingContext,
) {
  const terrainDirectory = path.join(inputDirectory, "terrains");
  const terrains: Nullable<Terrain>[] = [];
  terrainIds.forEach((terrainReferenceId, terrainNumberId) => {
    if (terrainReferenceId === null) {
      terrains.push(null);
    } else {
      const terrainJson = TerrainSchema.parse(
        JSON5.parse(
          readFileSync(
            path.join(terrainDirectory, `${terrainReferenceId}.json`),
          ).toString("utf8"),
        ),
      );
      const terrain = new Terrain();
      terrain.readFromJsonFile(
        terrainJson,
        asInt16(terrainNumberId),
        terrainReferenceId,
        loadingContext,
      );
      terrains.push(terrain);
    }
  });
  return terrains;
}

export function writeTerrainsToWorldTextFile(
  outputDirectory: string,
  terrains: Nullable<Terrain>[],
  savingContext: SavingContext,
) {
  const textFileWriter = new TextFileWriter(
    path.join(outputDirectory, TextFileNames.Terrains),
  );
  textFileWriter.raw(terrains.filter(isDefined).length).eol(); // Total terrain entries
  const sortedTerrains = [...terrains]
    .filter(isDefined)
    .sort((a, b) => textFileStringCompare(a.internalName, b.internalName));

  sortedTerrains.forEach((terrain) => {
    terrain.appendToTextFile(textFileWriter, savingContext);
  });

  textFileWriter.close();
  writeTerrainObjectsToWorldTextFile(outputDirectory, terrains, savingContext);
}

export function writeTerrainsToJsonFiles(
  outputDirectory: string,
  terrains: Nullable<Terrain>[],
  savingContext: SavingContext,
) {
  writeDataEntriesToJson(outputDirectory, "terrains", terrains, savingContext);
}

export function readTerrainIdsFromJsonIndex(inputDirectory: string) {
  return readJsonFileIndex(path.join(inputDirectory, "terrains"));
}

export function writeTerrainsResourceList(
  outputDirectory: string,
  terrains: Nullable<Terrain>[],
) {
  writeResourceList(
    "Terrains",
    outputDirectory,
    terrains.filter(isDefined),
    ".slp",
  );
}
