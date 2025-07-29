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
import { PaletteIndex, ResourceId, SoundEffectId } from "../Types";
import {
  asBool8,
  asInt16,
  asInt32,
  asUInt8,
  Bool8,
  Bool8Schema,
  Int16,
  Int32,
  UInt8,
} from "../../ts/base-types";
import { onParsingError } from "../Error";
import path from "path";
import { createReferenceIdFromString } from "../../json/reference-id";
import {
  BaseTerrainAnimation,
  BaseTerrainFrameMap,
  BaseTerrainFrameMapJsonMapping,
  BaseTerrainFrameMapSchema,
  BaseTerrainTile,
  BaseTerrainTileSchema,
} from "./BaseTerrainTile";
import {
  applyJsonFieldsToObject,
  JsonFieldMapping,
  readJsonFileIndex,
  transformObjectToJson,
  writeDataEntriesToJson,
} from "../../json/json-serialization";
import { z } from "zod";
import { readFileSync, writeFileSync } from "fs";
import { writeResourceList } from "../../textfile/ResourceList";
import { Logger } from "../../Logger";
import { Graphic } from "../../image/Graphic";
import { Point } from "../../geometry/Point";
import { RawImage } from "../../image/RawImage";
import {
  movedRectangle,
  Rectangle,
  unionRectangle,
} from "../../geometry/Rectangle";
import {
  getPaletteWithWaterColors,
  ColorCycleAnimationDelay,
  WaterAnimationFrameCount,
} from "../../image/palette";
import { GifWriter } from "omggif";
import { safeFilename } from "../../files/file-utils";
import { TileTypeDeltaYMultiplier } from "./MapProperties";

const OverlaySchema = BaseTerrainTileSchema.merge(
  z.object({
    frameMaps: z
      .array(z.array(BaseTerrainFrameMapSchema).length(16))
      .length(19),
    drawTerrain: Bool8Schema,
  }),
);

type OverlayJson = z.infer<typeof OverlaySchema>;

const OverlayJsonMapping: JsonFieldMapping<Overlay, OverlayJson>[] = [
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
];

export class Overlay extends BaseTerrainTile {
  frameMaps: BaseTerrainFrameMap[][] = [];
  drawTerrain: Bool8 = asBool8(false);
  padding59B: UInt8 = asUInt8(0);

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

    // NOTE: Unlike terrains and borders, here the sound effect comes first and then the graphic
    this.soundEffectId = buffer.readInt32<SoundEffectId<Int32>>();
    this.soundEffect = null;
    this.graphicPointer = buffer.readPointer();

    this.minimapColor1 = buffer.readUInt8<PaletteIndex>();
    this.minimapColor2 = buffer.readUInt8<PaletteIndex>();
    this.minimapColor3 = buffer.readUInt8<PaletteIndex>();

    this.animation = BaseTerrainAnimation.readFromBuffer(
      buffer,
      loadingContext,
    );

    this.drawCount = buffer.readUInt8();

    this.frameMaps = [];
    for (let i = 0; i < 19; ++i) {
      this.frameMaps.push([]);
      for (let j = 0; j < 16; ++j) {
        this.frameMaps[i].push({
          frameCount: buffer.readInt16(),
          animationFrames: buffer.readInt16(),
          frameIndex: buffer.readInt16(),
        });
      }
    }
    this.drawTerrain = buffer.readBool8();
    this.padding59B = buffer.readUInt8();
  }

  readFromJsonFile(
    jsonFile: OverlayJson,
    id: Int16,
    referenceId: string,
    loadingContext: JsonLoadingContext,
  ) {
    super.readFromJsonFile(jsonFile, id, referenceId, loadingContext);
    applyJsonFieldsToObject(jsonFile, this, OverlayJsonMapping, loadingContext);
  }

  linkOtherData(soundEffects: SoundEffect[], loadingContext: LoadingContext) {
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

    textFileWriter.integer(this.drawTerrain ? 1 : 0);

    for (let j = 0; j < 19; ++j) {
      for (let k = 0; k < 16; ++k) {
        textFileWriter
          .integer(this.frameMaps[j][k].frameCount)
          .integer(this.frameMaps[j][k].animationFrames);
      }
    }
    textFileWriter.eol();
    textFileWriter.raw(" ").eol();
  }

  private writeFlatPatternToGif(
    graphic: Graphic,
    tileSize: Point<number>,
    outputDirectory: string,
    transparentIndex: number,
    animateWater: boolean,
    delayMultiplier: number,
  ) {
    const frameIndex = this.frameMaps[0][0].frameIndex;
    const frameCount = this.frameMaps[0][0].frameCount;

    const tiles: {
      frame: number;
      coordinate: Point<number>;
      draw: Point<number>;
    }[] = [];

    const frames: RawImage[] = [];

    const patternHeight = Math.round(frameCount ** 0.5);
    const patternWidth = patternHeight;

    for (let y = 0; y < patternHeight; ++y) {
      for (let x = 0; x < patternWidth; ++x) {
        const yModifier = y ? y % patternHeight : 0;
        const xModifier = x ? x % patternWidth : 0;
        const frameNumber =
          frameIndex +
          Math.min(xModifier + patternWidth * yModifier, frameCount - 1);
        tiles.push({
          frame: frameNumber,
          coordinate: {
            x,
            y,
          },
          draw: {
            x: x + y,
            y: y - x + (patternWidth - 1),
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

    const totalBounds = tiles.reduce((acc: Rectangle<number> | null, tile) => {
      const regularBounds = graphic.frames[tile.frame].getBounds();
      const movedBounds = movedRectangle(regularBounds, {
        x: tile.draw.x * (tileSize.x >> 1),
        y: tile.draw.y * (tileSize.y >> 1),
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
      imageFrame.overlayImage(frame, {
        x: tile.draw.x * (tileSize.x >> 1),
        y: tile.draw.y * (tileSize.y >> 1),
      });
    });

    const palette = graphic.palette;
    if (animateWater && graphic.hasWaterAnimation()) {
      for (let i = 0; i < WaterAnimationFrameCount; ++i) {
        const waterFrame = imageFrame.clone();
        waterFrame.palette = getPaletteWithWaterColors(palette, i);
        waterFrame.delay = Math.round(
          ColorCycleAnimationDelay * delayMultiplier,
        );
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
      `${safeFilename(this.internalName ?? "unnamed", true)}_Flat.gif`,
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
        if (tileType !== null && this.frameMaps[tileType][0].frameCount > 0) {
          const frameNumber = this.frameMaps[tileType][0].frameIndex;
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
        waterFrame.delay = Math.round(
          ColorCycleAnimationDelay * delayMultiplier,
        );
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
      if (this.drawTerrain === false) {
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
      } else {
        // No known graphics for these types of overlays --> No way of supporting them
        Logger.error(
          `Skipping ${this.internalName} because semi-transparent overlays are not supported`,
        );
      }
    }
  }

  toJson(savingContext: SavingContext) {
    return {
      ...super.toJson(savingContext),
      ...transformObjectToJson(this, OverlayJsonMapping, savingContext),
    };
  }
}

export function readOverlaysFromDatFile(
  buffer: BufferReader,
  loadingContext: LoadingContext,
): Nullable<Overlay>[] {
  const result: Nullable<Overlay>[] = [];
  if (semver.lt(loadingContext.version.numbering, "2.0.0")) {
    for (let i = 0; i < 16; ++i) {
      const overlay = new Overlay();
      overlay.readFromBuffer(buffer, asInt16(i), loadingContext);
      result.push(overlay.enabled ? overlay : null);
    }
  }
  return result;
}

export function readAndVerifyOverlayCountFromDatFile(
  overlays: Nullable<Overlay>[],
  buffer: BufferReader,
  loadingContext: LoadingContext,
) {
  if (semver.lt(loadingContext.version.numbering, "2.0.0")) {
    const overlayCount = buffer.readInt16();
    if (overlayCount !== overlays.filter(isDefined).length) {
      onParsingError(
        `Mismatch between enabled overlays and overlay count, DAT might be corrupt!`,
        loadingContext,
      );
    }
  }
}

export function readOverlaysFromJsonFiles(
  inputDirectory: string,
  overlayIds: (string | null)[],
  loadingContext: JsonLoadingContext,
) {
  const overlaysDirectory = path.join(inputDirectory, "overlays");
  const overlays: Nullable<Overlay>[] = [];
  overlayIds.forEach((overlayReferenceId, overlayNumberId) => {
    if (overlayReferenceId === null) {
      overlays.push(null);
    } else {
      const overlayJson = OverlaySchema.parse(
        JSON5.parse(
          readFileSync(
            path.join(overlaysDirectory, `${overlayReferenceId}.json`),
          ).toString("utf8"),
        ),
      );
      const overlay = new Overlay();
      overlay.readFromJsonFile(
        overlayJson,
        asInt16(overlayNumberId),
        overlayReferenceId,
        loadingContext,
      );
      overlays.push(overlay);
    }
  });
  return overlays;
}

export function writeOverlaysToWorldTextFile(
  outputDirectory: string,
  overlays: Nullable<Overlay>[],
  savingContext: SavingContext,
) {
  const textFileWriter = new TextFileWriter(
    path.join(outputDirectory, TextFileNames.Overlays),
  );
  textFileWriter.raw(overlays.filter(isDefined).length).eol(); // Total overlay entries
  const sortedOverlays = [...overlays]
    .filter(isDefined)
    .sort((a, b) => textFileStringCompare(a.internalName, b.internalName));
  sortedOverlays.forEach((overlay) => {
    overlay.appendToTextFile(textFileWriter, savingContext);
  });

  textFileWriter.close();
}

export function writeOverlaysToJsonFiles(
  outputDirectory: string,
  overlays: Nullable<Overlay>[],
  savingContext: SavingContext,
) {
  if (semver.lt(savingContext.version.numbering, "2.0.0")) {
    writeDataEntriesToJson(
      outputDirectory,
      "overlays",
      overlays,
      savingContext,
    );
  }
}

export function readOverlayIdsFromJsonIndex(inputDirectory: string) {
  try {
    return readJsonFileIndex(path.join(inputDirectory, "overlays"));
  } catch (_err: unknown) {
    return [];
  }
}

export function writeOverlaysResourceList(
  outputDirectory: string,
  overlays: Nullable<Overlay>[],
) {
  writeResourceList(
    "Overlays",
    outputDirectory,
    overlays.filter(isDefined),
    ".slp",
  );
}
