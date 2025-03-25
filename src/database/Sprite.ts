import JSON5 from "json5";
import semver from "semver";
import BufferReader from "../BufferReader";
import { Point, PointSchema } from "../geometry/Point";
import { Rectangle, RectangleSchema } from "../geometry/Rectangle";
import {
  DatLoadingContext,
  JsonLoadingContext,
  LoadingContext,
} from "./LoadingContext";
import { SavingContext } from "./SavingContext";
import {
  asBool8,
  asFloat32,
  asInt16,
  asInt32,
  asUInt8,
  Bool8,
  Bool8Schema,
  Float32,
  Float32Schema,
  Int16,
  Int16Schema,
  NullPointer,
  Pointer,
  UInt8,
  UInt8Schema,
} from "../ts/base-types";
import {
  asResourceId,
  asTribeResourceId,
  ReferenceStringSchema,
  ResourceId,
  ResourceIdSchema,
  SoundEffectId,
  TribeResourceId,
} from "./Types";
import { TextFileWriter } from "../textfile/TextFileWriter";
import { TextFileNames } from "../textfile/TextFile";
import { SoundEffect } from "./SoundEffect";
import { getDataEntry, lcm } from "../util";
import { onParsingError } from "./Error";
import path from "path";
import { readFileSync } from "fs";
import {
  createReferenceString,
  createReferenceIdFromString,
  getIdFromReferenceString,
} from "../json/reference-id";
import { isDefined, Nullable } from "../ts/ts-utils";
import {
  applyJsonFieldsToObject,
  JsonFieldMapping,
  readJsonFileIndex,
  transformJsonToObject,
  transformObjectToJson,
  writeDataEntriesToJson,
  writeDataEntryToJsonFile,
} from "../json/json-serialization";
import { z } from "zod";
import { writeResourceList } from "../textfile/ResourceList";
import { getCombinedGraphicBounds, Graphic } from "../image/Graphic";
import { RawImage } from "../image/RawImage";
import { Logger } from "../Logger";
import { getPaletteWithWaterColors } from "../image/palette";

interface SpriteOverlay {
  spriteId: Int16;
  sprite: Sprite | null;
  padding02: Int16;
  spritePointer: Pointer;
  offset: Point<Int16>;
  angle: Int16;
  padding0e: Int16;
}
const SpriteOverlaySchema = z.object({
  spriteId: ReferenceStringSchema,
  offset: PointSchema(Int16Schema),
  angle: Int16Schema,
});
type SpriteOverlayJson = z.infer<typeof SpriteOverlaySchema>;
export const SpriteOverlayJsonMapping: JsonFieldMapping<
  SpriteOverlay,
  SpriteOverlayJson
>[] = [
  {
    jsonField: "spriteId",
    toJson: (obj) =>
      createReferenceString("Sprite", obj.sprite?.referenceId, obj.spriteId),
  },
  {
    objectField: "spriteId",
    fromJson: (json, _obj, loadingContext) =>
      getIdFromReferenceString<Int16>(
        "Sprite",
        "",
        json.spriteId,
        loadingContext.dataIds.spriteIds,
      ),
  },
  { field: "offset" },
  { field: "angle" },
];

interface SpriteAngleSoundEffect {
  angle: Int16;
  frameNumber: Int16;
  soundEffectId: SoundEffectId<Int16>;
  soundEffect: SoundEffect | null;
}
const SpriteAngleSoundEffectSchema = z.object({
  angle: Int16Schema.optional(),
  frameNumber: Int16Schema,
  soundEffectId: ReferenceStringSchema,
});
type SpriteAngleSoundEffectJson = z.infer<typeof SpriteAngleSoundEffectSchema>;
export const SpriteAngleSoundEffectJsonMapping: JsonFieldMapping<
  SpriteAngleSoundEffect,
  SpriteAngleSoundEffectJson
>[] = [
  { field: "angle" },
  { field: "frameNumber" },
  {
    jsonField: "soundEffectId",
    toJson: (obj) =>
      createReferenceString(
        "SoundEffect",
        obj.soundEffect?.referenceId,
        obj.soundEffectId,
      ),
  },
  {
    objectField: "soundEffectId",
    fromJson: (json, _obj, loadingContext) =>
      getIdFromReferenceString<Int16>(
        "SoundEffect",
        "",
        json.soundEffectId,
        loadingContext.dataIds.soundEffectIds,
      ),
  },
];

const SpriteSchema = z.object({
  internalName: z.string(),
  resourceFilename: z.string(),
  resourceId: ResourceIdSchema,
  loaded: Bool8Schema.optional(),
  colorTransformType: UInt8Schema,
  layer: UInt8Schema,
  forcedColorTransform: Int16Schema,
  selectionType: UInt8Schema,
  boundingBox: RectangleSchema(Int16Schema),
  soundEffectId: ReferenceStringSchema,
  framesPerAngle: Int16Schema,
  angleCount: Int16Schema,
  objectSpeedMultiplier: Float32Schema,
  frameDuration: Float32Schema,
  animationReplayDelay: Float32Schema,
  spriteType: UInt8Schema, // todo: split each flag into separate boolean?
  mirroringMode: z.union([UInt8Schema, z.boolean()]),
  overlays: z.array(SpriteOverlaySchema),
  soundEffects: z.array(SpriteAngleSoundEffectSchema),
});
type SpriteJson = z.infer<typeof SpriteSchema>;
export const SpriteJsonMapping: JsonFieldMapping<Sprite, SpriteJson>[] = [
  { field: "internalName" },
  { field: "resourceFilename" },
  { field: "resourceId" },
  { field: "loaded", flags: { internalField: true } },
  { field: "colorTransformType" },
  { field: "layer" },
  { field: "forcedColorTransform" },
  { field: "selectionType" },
  { field: "boundingBox" },
  {
    jsonField: "soundEffectId",
    toJson: (obj) =>
      createReferenceString(
        "SoundEffect",
        obj.soundEffect?.referenceId,
        obj.soundEffectId,
      ),
  },
  {
    objectField: "soundEffectId",
    fromJson: (json, obj, loadingContext) =>
      getIdFromReferenceString<Int16>(
        "SoundEffect",
        obj.referenceId,
        json.soundEffectId,
        loadingContext.dataIds.soundEffectIds,
      ),
  },
  { field: "framesPerAngle" },
  { field: "angleCount" },
  { field: "objectSpeedMultiplier" },
  { field: "frameDuration" },
  { field: "animationReplayDelay" },
  { field: "spriteType" },
  {
    jsonField: "mirroringMode",
    toJson: (obj) => {
      if (!obj.mirroringMode) {
        return false;
      } else if (
        obj.mirroringMode ===
        (obj.angleCount >> 1) + (obj.angleCount >> 2)
      ) {
        return true;
      } else {
        return obj.mirroringMode;
      }
    },
  },
  {
    objectField: "mirroringMode",
    fromJson: (json, obj) => {
      if (typeof json.mirroringMode === "number") {
        return json.mirroringMode;
      } else if (json.mirroringMode) {
        return asUInt8((obj.angleCount >> 1) + (obj.angleCount >> 2));
      } else {
        return asUInt8(0);
      }
    },
  },
  {
    jsonField: "overlays",
    toJson: (obj, savingContext) =>
      obj.overlays.map((overlay) =>
        transformObjectToJson(overlay, SpriteOverlayJsonMapping, savingContext),
      ),
  },
  {
    objectField: "overlays",
    fromJson: (json, _obj, loadingContext) =>
      json.overlays.map((overlay) => ({
        ...transformJsonToObject(
          overlay,
          SpriteOverlayJsonMapping,
          loadingContext,
        ),
        sprite: null,
        padding02: asInt16(0),
        spritePointer: NullPointer,
        padding0e: asInt16(0),
      })),
  },
  {
    jsonField: "soundEffects",
    toJson: (obj, savingContext) => {
      // We have special handling for the case where a sprite just has a single invalid sound effect
      if (
        obj.angleSoundEffects.length === 1 &&
        obj.angleSoundEffects[0].angle === -1
      ) {
        return obj.angleSoundEffects;
      } else {
        // If all angles have the same sound effect, write only one entry without an angle specified
        const transformedEntries = obj.angleSoundEffects
          .filter(
            (soundEffect) =>
              soundEffect.angle >= 0 && soundEffect.angle < obj.angleCount,
          )
          .map((soundEffect) =>
            transformObjectToJson(
              soundEffect,
              SpriteAngleSoundEffectJsonMapping,
              savingContext,
            ),
          ) as (SpriteAngleSoundEffectJson & { angle: Int16 })[];

        const groupedByFrameAndSound: Record<string, Set<Int16>> = {};
        for (const entry of transformedEntries) {
          const soundEffectIdentifier =
            typeof entry.soundEffectId === "number"
              ? `num${entry.soundEffectId}`
              : entry.soundEffectId;
          const key = `${entry.frameNumber}$$${soundEffectIdentifier}`;
          if (!groupedByFrameAndSound[key]) {
            groupedByFrameAndSound[key] = new Set();
          }
          groupedByFrameAndSound[key].add(entry.angle);
        }
        const mergedEntries: SpriteAngleSoundEffectJson[] = [];

        for (const [key, angles] of Object.entries(groupedByFrameAndSound)) {
          const [frameNumber, rawSoundEffectId] = key.split("$$");

          const numericFrameNumber = asInt16(+frameNumber);
          const soundEffectId = rawSoundEffectId.startsWith("num")
            ? +rawSoundEffectId.slice(3)
            : rawSoundEffectId === "null"
              ? null
              : rawSoundEffectId;

          if (angles.size === obj.angleCount) {
            mergedEntries.push({
              frameNumber: numericFrameNumber,
              soundEffectId,
            });
          } else {
            for (const angle of angles) {
              mergedEntries.push({
                frameNumber: numericFrameNumber,
                soundEffectId,
                angle,
              });
            }
          }
        }

        return mergedEntries;
      }
    },
  },
  {
    objectField: "angleSoundEffects",
    fromJson: (json, obj, loadingContext) => {
      const result: SpriteAngleSoundEffect[] = [];
      json.soundEffects.forEach((angleSoundEffect) => {
        if (angleSoundEffect.angle !== undefined) {
          result.push(
            transformJsonToObject(
              angleSoundEffect,
              SpriteAngleSoundEffectJsonMapping,
              loadingContext,
            ),
          );
        } else {
          const baseObject: SpriteAngleSoundEffect = transformJsonToObject(
            angleSoundEffect,
            SpriteAngleSoundEffectJsonMapping,
            loadingContext,
          );
          for (let i = 0; i < obj.angleCount; ++i) {
            result.push({
              ...baseObject,
              angle: asInt16(i),
              soundEffect: null,
            });
          }
        }
      });
      return result.sort((a, b) => a.angle - b.angle);
    },
  },
];

export class Sprite {
  referenceId: string = "";
  id: Int16 = asInt16(-1);
  internalName: string = "";
  resourceFilename: string = "";
  resourceId: ResourceId = asInt32<ResourceId>(-1);
  loaded: Bool8 = asBool8(false);
  colorTransformType: UInt8 = asUInt8(0);
  layer: UInt8 = asUInt8(0);
  forcedColorTransform: Int16 = asInt16(-1);
  selectionType: UInt8 = asUInt8(0);
  boundingBox: Rectangle<Int16> = {
    left: asInt16(0),
    top: asInt16(0),
    right: asInt16(0),
    bottom: asInt16(0),
  };
  soundEffectId: SoundEffectId<Int16> = asInt16<SoundEffectId<Int16>>(-1);
  soundEffect: SoundEffect | null = null;
  angleSoundEffectsEnabled: Bool8 = asBool8(false);
  framesPerAngle: Int16 = asInt16(0);
  angleCount: Int16 = asInt16(0);
  objectSpeedMultiplier: Float32 = asFloat32(0);
  frameDuration: Float32 = asFloat32(0); // seconds
  animationReplayDelay: Float32 = asFloat32(0); // seconds
  spriteType: UInt8 = asUInt8(0);
  mirroringMode: UInt8 = asUInt8(0); // If set, is an integer that specifies the last angle that is NOT mirrored. The first angle that is not mirrored is always angleCount >> 2.
  overlays: SpriteOverlay[] = [];
  angleSoundEffects: SpriteAngleSoundEffect[] = [];

  readFromBuffer(
    buffer: BufferReader,
    id: Int16,
    loadingContext: DatLoadingContext,
  ) {
    this.internalName = buffer.readFixedSizeString(21);
    this.referenceId = createReferenceIdFromString(this.internalName);
    this.resourceFilename = buffer.readFixedSizeString(13);
    this.resourceId = semver.gte(loadingContext.version.numbering, "1.3.1")
      ? buffer.readInt32<ResourceId>()
      : asResourceId(buffer.readInt16<TribeResourceId>());
    this.loaded = buffer.readBool8();
    this.colorTransformType = buffer.readUInt8();
    this.layer = buffer.readUInt8();
    this.forcedColorTransform = buffer.readInt16();
    this.selectionType = buffer.readUInt8();
    this.boundingBox = {
      left: buffer.readInt16(),
      top: buffer.readInt16(),
      right: buffer.readInt16(),
      bottom: buffer.readInt16(),
    };

    const overlayCount = buffer.readInt16();

    this.soundEffectId = buffer.readInt16<SoundEffectId<Int16>>();
    this.soundEffect = null;
    this.angleSoundEffectsEnabled = buffer.readBool8();
    this.framesPerAngle = buffer.readInt16();
    this.angleCount = buffer.readInt16();
    this.objectSpeedMultiplier = buffer.readFloat32();
    this.frameDuration = buffer.readFloat32();
    this.animationReplayDelay = buffer.readFloat32();
    this.spriteType = buffer.readUInt8();
    this.id = buffer.readInt16();
    if (this.id !== id) {
      onParsingError(
        `Mismatch between stored Sprite id ${this.id} and ordering ${id}, data might be corrupt!`,
        loadingContext,
      );
    }
    this.mirroringMode = buffer.readUInt8();

    this.overlays = [];
    for (let i = 0; i < overlayCount; ++i) {
      this.overlays.push({
        spriteId: buffer.readInt16(),
        sprite: null,
        padding02: buffer.readInt16(),
        spritePointer: buffer.readPointer(),
        offset: {
          x: buffer.readInt16(),
          y: buffer.readInt16(),
        },
        angle: buffer.readInt16(),
        padding0e: buffer.readInt16(),
      });
    }
    this.angleSoundEffects = [];
    if (this.angleSoundEffectsEnabled) {
      for (let i = 0; i < this.angleCount; ++i) {
        for (let j = 0; j < 3; ++j) {
          const frameNumber = buffer.readInt16();
          const soundEffectId = buffer.readInt16<SoundEffectId<Int16>>();
          if (soundEffectId >= 0 || !loadingContext.cleanedData) {
            this.angleSoundEffects.push({
              angle: asInt16(i),
              frameNumber,
              soundEffectId,
              soundEffect: null,
            });
          }
        }
      }

      // This is a hackish way to keep tower sound effects as they are. It would seem they were originally imported with a non-existing angle number of 1
      // so they were set to -1 during import and such entries are not included by default
      // For entries with soundEffectId -1, angle must be invalid or the game will crash!
      if (!this.angleSoundEffects.length && loadingContext.cleanedData) {
        this.angleSoundEffects.push({
          angle: asInt16(-1),
          frameNumber: asInt16(-1),
          soundEffectId: asInt16<SoundEffectId<Int16>>(-1),
          soundEffect: null,
        });
      }
    }
  }

  readFromJsonFile(
    jsonFile: SpriteJson,
    id: Int16,
    referenceId: string,
    loadingContext: JsonLoadingContext,
  ) {
    this.id = id;
    this.referenceId = referenceId;
    applyJsonFieldsToObject(jsonFile, this, SpriteJsonMapping, loadingContext);
    this.angleSoundEffectsEnabled = asBool8(this.angleSoundEffects.length > 0);
    if (jsonFile.loaded === undefined) {
      this.loaded = asBool8(false);
    }
  }

  linkOtherData(
    sprites: Nullable<Sprite>[],
    soundEffects: SoundEffect[],
    loadingContext: LoadingContext,
  ) {
    this.soundEffect = getDataEntry(
      soundEffects,
      this.soundEffectId,
      "SoundEffect",
      this.referenceId,
      loadingContext,
    );
    this.angleSoundEffects.forEach((angleSoundEffect) => {
      angleSoundEffect.soundEffect = getDataEntry(
        soundEffects,
        angleSoundEffect.soundEffectId,
        "SoundEffect",
        this.referenceId,
        loadingContext,
      );
    });
    this.overlays.forEach((overlay) => {
      overlay.sprite = getDataEntry(
        sprites,
        overlay.spriteId,
        "Sprite",
        this.referenceId,
        loadingContext,
      );
    });
  }

  appendToTextFile(
    textFileWriter: TextFileWriter,
    savingContext: SavingContext,
  ) {
    const angleSoundEffectCount = this.angleSoundEffectsEnabled
      ? this.angleSoundEffects.length
      : 0;

    textFileWriter
      .integer(this.id)
      .string(this.internalName, 17)
      .filename(this.resourceFilename)
      .integer(
        semver.gte(savingContext.version.numbering, "1.3.1")
          ? this.resourceId
          : asTribeResourceId(this.resourceId),
      )
      .integer(this.framesPerAngle)
      .integer(this.angleCount)
      .integer(this.mirroringMode === 0 ? 0 : 1)
      .integer(this.colorTransformType)
      .integer(this.layer)
      .integer(this.forcedColorTransform)
      .integer(this.spriteType & 0x04 ? 1 : 0) // Randomize on start flag
      .integer(this.selectionType)
      .integer(this.spriteType & 0x01 ? 1 : 0) // Animated flag
      .integer(this.spriteType & 0x02 ? 1 : 0) // Directional flag
      .integer(this.spriteType & 0x08 ? 1 : 0) // Loop once flag
      .integer(this.boundingBox.left)
      .integer(this.boundingBox.top)
      .integer(this.boundingBox.right)
      .integer(this.boundingBox.bottom)
      .float(this.objectSpeedMultiplier)
      .float(this.frameDuration)
      .float(this.animationReplayDelay)
      .integer(this.overlays.length)
      .integer(this.soundEffectId)
      .integer(angleSoundEffectCount)
      .eol();

    for (let j = 0; j < this.overlays.length; ++j) {
      const overlay = this.overlays[j];
      textFileWriter
        .indent(2)
        .integer(overlay.spriteId)
        .integer(overlay.offset.x)
        .integer(overlay.offset.y)
        .integer(overlay.angle)
        .eol();
    }
    if (this.angleSoundEffectsEnabled) {
      for (let j = 0; j < this.angleSoundEffects.length; ++j) {
        const soundEffect = this.angleSoundEffects[j];
        textFileWriter
          .indent(4)
          .integer(soundEffect.angle)
          .integer(soundEffect.frameNumber)
          .integer(soundEffect.soundEffectId)
          .eol();
      }
    }
  }

  writeToJsonFile(directory: string, savingContext: SavingContext) {
    writeDataEntryToJsonFile(directory, this, SpriteJsonMapping, savingContext);
  }

  private getActualAngleGraphicIndex(inputAngle: number) {
    if (!this.mirroringMode) {
      return {
        angle: Math.min(inputAngle, this.angleCount - 1),
        mirrored: false,
      };
    } else {
      if (this.angleCount === 2) {
        return {
          angle: 0,
          mirrored: inputAngle === 1,
        };
      } else {
        if (
          inputAngle <= this.mirroringMode &&
          inputAngle >= this.angleCount >> 2
        ) {
          return {
            angle: inputAngle - (this.angleCount >> 2),
            mirrored: false,
          };
        } else {
          const halfAngleCount = this.angleCount >> 1;
          const midValue =
            inputAngle <= halfAngleCount
              ? halfAngleCount - inputAngle
              : this.angleCount + halfAngleCount - inputAngle;
          return {
            angle: midValue - (this.angleCount >> 2),
            mirrored: true,
          };
        }
      }
    }
  }

  writeToGif(
    graphics: Graphic[],
    {
      transparentIndex,
      shadowOffset,
      delayMultiplier,
      animateWater,
    }: {
      transparentIndex: number;
      shadowOffset: Point<number>;
      delayMultiplier: number;
      animateWater: boolean;
    },
    outputDirectory: string,
  ) {
    // TODO: Make this a parameter, flying things need a Z offset to make the shadow visible. But building and projectile
    // shadows will break with this

    const mainGraphic = graphics.find(
      (graphic) =>
        graphic.filename === this.resourceFilename ||
        graphic.resourceId === this.resourceId,
    );
    const backgroundGraphic = mainGraphic
      ? {
          graphic: mainGraphic,
          offset: { x: asInt16(0), y: asInt16(0) },
          angle: asInt16(-1),
          sprite: this,
        }
      : null;
    // If any overlays are specified, the main graphic is only drawn in case
    // there is an overlay specified with sprite id -1
    const actualGraphics = this.overlays.length
      ? this.overlays.map((overlay) => {
          const overlaySprite = overlay.sprite;
          if (overlaySprite) {
            const overlayGraphic = graphics.find(
              (graphic) =>
                graphic.filename === overlaySprite.internalName ||
                graphic.resourceId === overlaySprite.resourceId,
            );
            if (overlayGraphic) {
              return {
                graphic: overlayGraphic,
                offset: overlay.offset,
                angle: overlay.angle,
                sprite: overlay.sprite,
              };
            }
          } else if (overlay.spriteId === -1 && mainGraphic) {
            return {
              graphic: mainGraphic,
              offset: overlay.offset,
              angle: overlay.angle,
              sprite: this,
            };
          }
          return null;
        })
      : [backgroundGraphic];
    const allGraphics = actualGraphics
      .filter(isDefined)
      .sort((a, b) => (a.sprite?.layer ?? 0) - (b.sprite?.layer ?? 0));

    allGraphics.forEach((graphic) => {
      if ((graphic.sprite?.layer ?? 99) <= 10) {
        graphic.offset = {
          x: asInt16(graphic.offset.x + shadowOffset.x),
          y: asInt16(graphic.offset.y + shadowOffset.y),
        };
      }
    });

    // AOE does not support recursive deltas, so we don't need to support that either

    if (allGraphics.length) {
      for (let i = 0; i < this.angleCount; ++i) {
        const combinedFrames: RawImage[] = [];
        const { angle: mainAngle } = this.getActualAngleGraphicIndex(i);
        const angleGraphics = allGraphics
          .map((graphic) => {
            const sprite = graphic.sprite;
            if (!sprite) {
              throw new Error("Sprite was null!?");
            }
            const multiplier = sprite.angleCount / this.angleCount;
            const { angle, mirrored } =
              graphic.sprite!.getActualAngleGraphicIndex(
                Math.floor(i * multiplier),
              );

            return {
              ...graphic,
              graphic: mirrored
                ? graphic.graphic
                    .slice(
                      angle * sprite.framesPerAngle,
                      angle * sprite.framesPerAngle +
                        Math.min(sprite.framesPerAngle, this.framesPerAngle),
                    )
                    .mirrored()
                : graphic.graphic.slice(
                    angle * sprite.framesPerAngle,
                    angle * sprite.framesPerAngle +
                      Math.min(sprite.framesPerAngle, this.framesPerAngle),
                  ),
            };
          })
          .filter(
            (graphic) => graphic.angle === mainAngle || graphic.angle === -1,
          );

        const shouldAnimateWater =
          animateWater &&
          angleGraphics.some((graphic) => graphic.graphic.hasWaterAnimation());

        const totalBounds = getCombinedGraphicBounds(angleGraphics);
        if (totalBounds) {
          if (shouldAnimateWater) {
            Logger.info(`${this.internalName}_${i} has water animation`);
            const waterAnimationLength = 20 * 7;
            const animationFrameLength = Math.round(this.frameDuration * 100);
            const finalFrameLength =
              animationFrameLength +
              Math.round(this.animationReplayDelay * 100);
            const animationLength =
              this.framesPerAngle * animationFrameLength +
              Math.round(this.animationReplayDelay * 100);
            const totalAnimationLength = lcm(
              waterAnimationLength,
              animationLength,
            );
            // If there is no regular animation we only need to animate the water pixels
            if (animationLength === 0) {
              for (let j = 0; j < 7; ++j) {
                const combinedFrame = new RawImage(
                  totalBounds.right - totalBounds.left + 1,
                  totalBounds.bottom - totalBounds.top + 1,
                );
                combinedFrame.setAnchor({
                  x: -totalBounds.left,
                  y: -totalBounds.top,
                });
                angleGraphics.forEach((graphic) => {
                  combinedFrame.overlayImage(
                    graphic.graphic.frames[0],
                    graphic.offset,
                  );
                });
                combinedFrame.palette = getPaletteWithWaterColors(
                  graphics[0].palette,
                  j,
                );
                combinedFrames.push(combinedFrame);
              }
              const finalGraphic = new Graphic(combinedFrames);
              finalGraphic.palette = graphics[0].palette;
              finalGraphic.filename = `${this.internalName}_${i}`;
              finalGraphic.writeToGif(outputDirectory, {
                delay: 20 * delayMultiplier,
                replayDelay: 0,
                transparentIndex,
              });
            } else {
              const totalLength = totalAnimationLength;
              let waterFrame = 0;
              let animationFrame = 0;
              let waterFrameRemaining = 20;
              let animationFrameRemaining =
                this.framesPerAngle === animationFrame + 1
                  ? finalFrameLength
                  : animationFrameLength;
              let length = 0;
              while (length < totalLength) {
                const combinedFrame = new RawImage(
                  totalBounds.right - totalBounds.left + 1,
                  totalBounds.bottom - totalBounds.top + 1,
                );
                combinedFrame.setAnchor({
                  x: -totalBounds.left,
                  y: -totalBounds.top,
                });
                combinedFrame.palette = getPaletteWithWaterColors(
                  graphics[0].palette,
                  waterFrame,
                );
                const frameLength = Math.min(
                  waterFrameRemaining,
                  animationFrameRemaining,
                );
                combinedFrame.delay = frameLength;
                angleGraphics.forEach((graphic) => {
                  const index =
                    animationFrame >= graphic.graphic.frames.length
                      ? 0
                      : animationFrame;
                  combinedFrame.overlayImage(
                    graphic.graphic.frames[index],
                    graphic.offset,
                  );
                });
                combinedFrames.push(combinedFrame);

                length += frameLength;
                waterFrameRemaining -= frameLength;
                animationFrameRemaining -= frameLength;
                if (waterFrameRemaining === 0) {
                  waterFrame = (waterFrame + 1) % 7;
                  waterFrameRemaining = 20;
                }
                if (animationFrameRemaining === 0) {
                  animationFrame = (animationFrame + 1) % this.framesPerAngle;
                  animationFrameRemaining =
                    this.framesPerAngle === animationFrame + 1
                      ? finalFrameLength
                      : animationFrameLength;
                }
              }

              const finalGraphic = new Graphic(combinedFrames);
              finalGraphic.palette = graphics[0].palette;
              finalGraphic.filename = `${this.internalName}_${i}`;
              finalGraphic.writeToGif(outputDirectory, {
                // delays are specified in individual frames, these are ignored
                delay: 0,
                replayDelay: 0,
                transparentIndex,
              });
            }
          } else {
            for (let j = 0; j < this.framesPerAngle; ++j) {
              const combinedFrame = new RawImage(
                totalBounds.right - totalBounds.left + 1,
                totalBounds.bottom - totalBounds.top + 1,
              );
              combinedFrame.setAnchor({
                x: -totalBounds.left,
                y: -totalBounds.top,
              });
              angleGraphics.forEach((graphic) => {
                const index = j >= graphic.graphic.frames.length ? 0 : j;
                combinedFrame.overlayImage(
                  graphic.graphic.frames[index],
                  graphic.offset,
                );
              });
              combinedFrames.push(combinedFrame);
            }
            const finalGraphic = new Graphic(combinedFrames);
            finalGraphic.palette = graphics[0].palette;
            finalGraphic.filename = `${this.internalName}_${i}`;
            finalGraphic.writeToGif(outputDirectory, {
              delay: Math.round(this.frameDuration * 100 * delayMultiplier),
              replayDelay: Math.round(
                this.animationReplayDelay * 100 * delayMultiplier,
              ),
              transparentIndex,
            });
          }
        }
      }
    } else {
      Logger.info(`Skipping ${this.internalName} since no graphics exist`);
    }
  }
}

export function readSpritesFromDatFile(
  buffer: BufferReader,
  loadingContext: DatLoadingContext,
): Nullable<Sprite>[] {
  const result: Nullable<Sprite>[] = [];
  const validSprites: boolean[] = [];
  const spriteCount = buffer.readInt16();

  if (semver.gte(loadingContext.version.numbering, "3.7.0")) {
    for (let i = 0; i < spriteCount; ++i) {
      validSprites.push(Boolean(buffer.readBool32()));
    }
  } else {
    for (let i = 0; i < spriteCount; ++i) {
      validSprites.push(true);
    }
  }

  for (let i = 0; i < spriteCount; ++i) {
    if (validSprites[i]) {
      const sprite = new Sprite();
      sprite.readFromBuffer(buffer, asInt16(i), loadingContext);
      if (sprite.internalName && sprite.resourceFilename) {
        result.push(sprite);
      } else {
        result.push(null);
      }
    } else {
      result.push(null);
    }
  }
  return result;
}

export function readSpritesFromJsonFiles(
  inputDirectory: string,
  spriteIds: (string | null)[],
  loadingContext: JsonLoadingContext,
) {
  const spritesDirectory = path.join(inputDirectory, "sprites");
  const sprites: Nullable<Sprite>[] = [];
  spriteIds.forEach((spriteReferenceId, spriteNumberId) => {
    if (spriteReferenceId === null) {
      sprites.push(null);
    } else {
      const spriteJson = SpriteSchema.parse(
        JSON5.parse(
          readFileSync(
            path.join(spritesDirectory, `${spriteReferenceId}.json`),
          ).toString("utf8"),
        ),
      );
      const sprite = new Sprite();
      sprite.readFromJsonFile(
        spriteJson,
        asInt16(spriteNumberId),
        spriteReferenceId,
        loadingContext,
      );
      sprites.push(sprite);
    }
  });
  return sprites;
}

export function writeSpritesToWorldTextFile(
  outputDirectory: string,
  sprites: Nullable<Sprite>[],
  savingContext: SavingContext,
) {
  const textFileWriter = new TextFileWriter(
    path.join(outputDirectory, TextFileNames.Sprites),
  );
  textFileWriter.raw(sprites.length).eol(); // Total sprites entries
  textFileWriter
    .raw(sprites.filter((sprite) => sprite?.internalName).length)
    .eol(); // Entries that have data here

  sprites.forEach((sprite) => {
    if (sprite) {
      sprite.appendToTextFile(textFileWriter, savingContext);
    }
  });

  textFileWriter.close();
}

export function writeSpritesToJsonFiles(
  outputDirectory: string,
  sprites: Nullable<Sprite>[],
  savingContext: SavingContext,
) {
  writeDataEntriesToJson(outputDirectory, "sprites", sprites, savingContext);
}

export function readSpriteIdsFromJsonIndex(inputDirectory: string) {
  return readJsonFileIndex(path.join(inputDirectory, "sprites"));
}

export function writeSpriteResourceList(
  outputDirectory: string,
  sprites: Nullable<Sprite>[],
) {
  writeResourceList(
    "Graphics",
    outputDirectory,
    sprites.filter(isDefined),
    ".slp",
  );
}
