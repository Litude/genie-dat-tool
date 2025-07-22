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
  asBool8,
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
import { readFileSync, writeFileSync } from "fs";
import { writeResourceList } from "../../textfile/ResourceList";
import { Logger } from "../../Logger";
import { Graphic } from "../../image/Graphic";
import { Point } from "../../geometry/Point";
import { RawImage } from "../../image/RawImage";
import {
  getPaletteWithWaterColors,
  ColorCycleAnimationDelay,
  WaterAnimationFrameCount,
} from "../../image/palette";
import { GifWriter } from "omggif";
import { safeFilename } from "../../files/file-utils";
import { TileTypeDeltaYMultiplier } from "./MapProperties";
import {
  movedRectangle,
  Rectangle,
  unionRectangle,
} from "../../geometry/Rectangle";

// When set, this means that the specified direction has a tile different than the current tile
enum BorderNeighbour {
  None = 0,
  North = 1,
  South = 2,
  West = 4,
  East = 8,
  All = BorderNeighbour.North |
    BorderNeighbour.South |
    BorderNeighbour.West |
    BorderNeighbour.East,
}

const BorderFlatPattern = Object.freeze([
  [
    {
      tileType: 0,
      neighbours:
        BorderNeighbour.West | BorderNeighbour.North | BorderNeighbour.South,
    },
    {
      tileType: 0,
      neighbours: BorderNeighbour.West | BorderNeighbour.North,
    },
    {
      tileType: 0,
      neighbours: BorderNeighbour.West | BorderNeighbour.North,
    },
    {
      tileType: 0,
      neighbours:
        BorderNeighbour.West | BorderNeighbour.North | BorderNeighbour.East,
    },
  ],
  [
    {
      tileType: 0,
      neighbours: BorderNeighbour.West | BorderNeighbour.South,
    },
    {
      tileType: 0,
      neighbours: BorderNeighbour.East,
    },
    {
      tileType: 0,
      neighbours: BorderNeighbour.South,
    },
    {
      tileType: 0,
      neighbours: BorderNeighbour.North | BorderNeighbour.East,
    },
  ],
  [
    {
      tileType: 0,
      neighbours: BorderNeighbour.West | BorderNeighbour.South,
    },
    {
      tileType: 0,
      neighbours: BorderNeighbour.North,
    },
    {
      tileType: 0,
      neighbours: BorderNeighbour.West,
    },
    {
      tileType: 0,
      neighbours: BorderNeighbour.North | BorderNeighbour.East,
    },
  ],
  [
    {
      tileType: 0,
      neighbours:
        BorderNeighbour.West | BorderNeighbour.East | BorderNeighbour.South,
    },
    {
      tileType: 0,
      neighbours: BorderNeighbour.East | BorderNeighbour.South,
    },
    {
      tileType: 0,
      neighbours: BorderNeighbour.East | BorderNeighbour.South,
    },
    {
      tileType: 0,
      neighbours:
        BorderNeighbour.North | BorderNeighbour.East | BorderNeighbour.South,
    },
  ],
]);

const BorderHillLargeOutsidePattern = Object.freeze([
  [
    {
      tileType: 12,
      neighbours:
        BorderNeighbour.West | BorderNeighbour.North | BorderNeighbour.South,
    },
    {
      tileType: 7,
      neighbours: BorderNeighbour.West | BorderNeighbour.North,
    },
    {
      tileType: 9,
      neighbours:
        BorderNeighbour.West | BorderNeighbour.North | BorderNeighbour.East,
    },
  ],
  [
    {
      tileType: 8,
      neighbours: BorderNeighbour.South | BorderNeighbour.West,
    },
    null,
    {
      tileType: 5,
      neighbours: BorderNeighbour.North | BorderNeighbour.East,
    },
  ],
  [
    {
      tileType: 10,
      neighbours:
        BorderNeighbour.West | BorderNeighbour.East | BorderNeighbour.South,
    },
    {
      tileType: 6,
      neighbours: BorderNeighbour.East | BorderNeighbour.South,
    },
    {
      tileType: 11,
      neighbours:
        BorderNeighbour.North | BorderNeighbour.East | BorderNeighbour.South,
    },
  ],
]);

const BorderValleyLargeOutsidePattern = Object.freeze([
  [
    {
      tileType: 16,
      neighbours:
        BorderNeighbour.West | BorderNeighbour.North | BorderNeighbour.South,
    },
    {
      tileType: 6,
      neighbours: BorderNeighbour.West | BorderNeighbour.North,
    },
    {
      tileType: 14,
      neighbours:
        BorderNeighbour.West | BorderNeighbour.North | BorderNeighbour.East,
    },
  ],
  [
    {
      tileType: 5,
      neighbours: BorderNeighbour.South | BorderNeighbour.West,
    },
    null,
    {
      tileType: 8,
      neighbours: BorderNeighbour.North | BorderNeighbour.East,
    },
  ],
  [
    {
      tileType: 13,
      neighbours:
        BorderNeighbour.West | BorderNeighbour.East | BorderNeighbour.South,
    },
    {
      tileType: 7,
      neighbours: BorderNeighbour.East | BorderNeighbour.South,
    },
    {
      tileType: 15,
      neighbours:
        BorderNeighbour.North | BorderNeighbour.East | BorderNeighbour.South,
    },
  ],
]);

const BorderOverlayFlatPattern = Object.freeze([
  [
    null,
    {
      tileType: 0,
      neighbours: BorderNeighbour.South | BorderNeighbour.East,
    },
    null,
  ],
  [
    {
      tileType: 0,
      neighbours: BorderNeighbour.North | BorderNeighbour.East,
    },
    null,
    {
      tileType: 0,
      neighbours: BorderNeighbour.South | BorderNeighbour.West,
    },
  ],
  [
    null,
    {
      tileType: 0,
      neighbours: BorderNeighbour.North | BorderNeighbour.West,
    },
    null,
  ],
]);

function getInvertedNeighbours(input: BorderNeighbour) {
  let result: BorderNeighbour = 0 as BorderNeighbour;
  if ((input & BorderNeighbour.North) === 0) {
    result |= BorderNeighbour.North;
  }
  if ((input & BorderNeighbour.South) === 0) {
    result |= BorderNeighbour.South;
  }
  if ((input & BorderNeighbour.West) === 0) {
    result |= BorderNeighbour.West;
  }
  if ((input & BorderNeighbour.East) === 0) {
    result |= BorderNeighbour.East;
  }
  return result;
}

function getInvertedTilePattern(
  input: readonly Nullable<{
    tileType: number;
    neighbours: BorderNeighbour;
  }>[][],
) {
  return input.map((patternRow) => {
    return patternRow.map((entry) => {
      if (entry) {
        return {
          tileType: entry.tileType,
          neighbours: getInvertedNeighbours(entry.neighbours),
        };
      } else {
        return null;
      }
    });
  });
}

const BorderSchema = BaseTerrainTileSchema.merge(
  z.object({
    frameMaps: z
      .array(z.array(BaseTerrainFrameMapSchema).min(12).max(13))
      .length(19),
    drawTerrain: Bool8Schema,
    passabilityTerrainId: ReferenceStringSchema,
    borderStyle: Int16Schema,
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
  { field: "borderStyle" },
];

export class Border extends BaseTerrainTile {
  frameMaps: BaseTerrainFrameMap[][] = [];
  drawTerrain: Bool8 = asBool8(false);
  padding59B: UInt8 = asUInt8(0);
  passabilityTerrainId: TerrainId<Int16> = asInt16<TerrainId<Int16>>(-1);
  passabilityTerrain: Terrain | null = null;
  borderStyle: Int16 = asInt16(0);
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
      this.borderStyle = buffer.readInt16();
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
          writer.integer(this.borderStyle);
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

  private writeTilePatternToGif(
    tilePattern: readonly Nullable<{
      tileType: number;
      neighbours: BorderNeighbour;
    }>[][],
    patternName: string,
    getShapeNumber: (neighbour: BorderNeighbour) => number,
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
        const tileEntry = tilePattern[y][x];
        if (tileEntry !== null) {
          const tileShape = getShapeNumber(tileEntry.neighbours);
          if (tileShape !== -1) {
            const tileFrame = this.frameMaps[tileEntry.tileType][tileShape];
            if (tileFrame.frameCount > 0) {
              const frameNumber = tileFrame.frameIndex;
              tiles.push({
                tileType: tileEntry.tileType,
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
      }
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

    const totalBounds = tiles.reduce((acc: Rectangle<number> | null, tile) => {
      const regularBounds = graphic.frames[tile.frame].getBounds();
      const additionalYDelta =
        tile.coordinate.y > tile.coordinate.x
          ? TileTypeDeltaYMultiplier[tile.tileType] * -elevationHeight
          : 0;
      const movedBounds = movedRectangle(regularBounds, {
        x: tile.draw.x * (tileSize.x >> 1),
        y: tile.draw.y * (tileSize.y >> 1) + additionalYDelta,
      });
      return acc ? unionRectangle(acc, movedBounds) : movedBounds;
    }, null);

    if (!totalBounds) {
      return;
    }

    const imageWidth = totalBounds.right - totalBounds.left + 1;
    const imageHeight = totalBounds.bottom - totalBounds.top + 1;

    const imageFrame = new RawImage(imageWidth, imageHeight);
    imageFrame.anchor.x = -totalBounds.left;
    imageFrame.anchor.y = -totalBounds.top;

    tiles.forEach((tile) => {
      const frame = graphic.frames[tile.frame];
      const additionalYDelta =
        tile.coordinate.y > tile.coordinate.x
          ? TileTypeDeltaYMultiplier[tile.tileType] * -elevationHeight
          : 0;
      imageFrame.overlayImage(frame, {
        x: tile.draw.x * (tileSize.x >> 1),
        y: tile.draw.y * (tileSize.y >> 1) + additionalYDelta,
      });
    });

    const palette = graphic.palette;
    if (animateWater && graphic.hasWaterAnimation()) {
      for (let i = 0; i < WaterAnimationFrameCount; ++i) {
        const waterFrame = imageFrame.clone();
        waterFrame.palette = getPaletteWithWaterColors(palette, i);
        waterFrame.delay = Math.round(ColorCycleAnimationDelay * delayMultiplier);
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
        {
          left: totalBounds.left,
          top: totalBounds.top,
          right: imageWidth,
          bottom: imageHeight,
        },
        {
          delay: 0,
          transparentIndex,
        },
      );
    });
    const gifData = gifBuffer.subarray(0, gifWriter.end());
    const outputPath = path.join(
      outputDirectory,
      `${safeFilename(this.internalName ?? "unnamed", true)}_${patternName}.gif`,
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
          graphic.filename?.toLocaleLowerCase() === this.resourceFilename,
      );
      if (!graphic) {
        Logger.error(
          `Skipping ${this.internalName} because graphic ${this.resourceId} - ${this.resourceFilename} was not found!`,
        );
        return;
      }

      // TODO: Move all these patterns to JSON for easier updating and making the code much more readable...
      if (this.borderStyle === 0) {
        this.writeTilePatternToGif(
          BorderFlatPattern,
          "Flat",
          Border.getRegularBorderShapeNumber,
          graphic,
          tileSize,
          elevationHeight,
          outputDirectory,
          { transparentIndex, animateWater, delayMultiplier },
        );

        this.writeTilePatternToGif(
          BorderHillLargeOutsidePattern,
          "Hill-Outside",
          Border.getRegularBorderShapeNumber,
          graphic,
          tileSize,
          elevationHeight,
          outputDirectory,
          { transparentIndex, animateWater, delayMultiplier },
        );
        this.writeTilePatternToGif(
          getInvertedTilePattern(BorderHillLargeOutsidePattern),
          "Hill-Inside",
          Border.getRegularBorderShapeNumber,
          graphic,
          tileSize,
          elevationHeight,
          outputDirectory,
          { transparentIndex, animateWater, delayMultiplier },
        );

        this.writeTilePatternToGif(
          BorderValleyLargeOutsidePattern,
          "Valley-Outside",
          Border.getRegularBorderShapeNumber,
          graphic,
          tileSize,
          elevationHeight,
          outputDirectory,
          { transparentIndex, animateWater, delayMultiplier },
        );
        this.writeTilePatternToGif(
          getInvertedTilePattern(BorderValleyLargeOutsidePattern),
          "Valley-Inside",
          Border.getRegularBorderShapeNumber,
          graphic,
          tileSize,
          elevationHeight,
          outputDirectory,
          { transparentIndex, animateWater, delayMultiplier },
        );
      } else if (this.borderStyle === 1) {
        this.writeTilePatternToGif(
          BorderOverlayFlatPattern,
          "Flat",
          Border.getOverlayBorderShapeNumber,
          graphic,
          tileSize,
          elevationHeight,
          outputDirectory,
          { transparentIndex, animateWater, delayMultiplier },
        );
      } else {
        // There should only be types 0 and 1
        Logger.error(
          `Skipping ${this.internalName} due to unsupported border style ${this.borderStyle}`,
        );
      }
    }
  }

  toJson(savingContext: SavingContext) {
    return {
      ...super.toJson(savingContext),
      ...transformObjectToJson(this, BorderJsonMapping, savingContext),
    };
  }

  static getRegularBorderShapeNumber(neighbours: BorderNeighbour) {
    switch (neighbours) {
      // Shapes with all neighbours, no neighbours or only opposite neighbours are not supported
      // and will return -1
      case BorderNeighbour.None:
      case BorderNeighbour.All:
      case BorderNeighbour.North | BorderNeighbour.South:
      case BorderNeighbour.West | BorderNeighbour.East:
        return -1;
      case BorderNeighbour.West | BorderNeighbour.North | BorderNeighbour.South:
        return 0;
      case BorderNeighbour.West | BorderNeighbour.North | BorderNeighbour.East:
        return 1;
      case BorderNeighbour.West | BorderNeighbour.East | BorderNeighbour.South:
        return 2;
      case BorderNeighbour.North | BorderNeighbour.East | BorderNeighbour.South:
        return 3;
      case BorderNeighbour.West:
        return 4;
      case BorderNeighbour.North:
        return 5;
      case BorderNeighbour.South:
        return 6;
      case BorderNeighbour.East:
        return 7;
      case BorderNeighbour.West | BorderNeighbour.North:
        return 8;
      case BorderNeighbour.East | BorderNeighbour.South:
        return 9;
      case BorderNeighbour.West | BorderNeighbour.South:
        return 10;
      case BorderNeighbour.North | BorderNeighbour.East:
        return 11;
      default:
        throw new Error(`Invalid border neighbour value ${neighbours}`);
    }
  }

  static getOverlayBorderShapeNumber(neighbours: BorderNeighbour) {
    switch (neighbours) {
      case BorderNeighbour.North | BorderNeighbour.West:
        return 0;
      case BorderNeighbour.North | BorderNeighbour.East:
        return 1;
      case BorderNeighbour.South | BorderNeighbour.West:
        return 2;
      case BorderNeighbour.South | BorderNeighbour.East:
        return 3;
      default:
        return -1;
    }
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

export function writeBordersResourceList(
  outputDirectory: string,
  borders: Nullable<Border>[],
) {
  writeResourceList(
    "Borders",
    outputDirectory,
    borders.filter(isDefined),
    ".slp",
  );
}
