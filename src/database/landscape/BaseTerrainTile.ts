import semver from "semver";
import { z } from "zod";
import { SoundEffect } from "../SoundEffect";
import { asBool8, asFloat32, asInt16, asInt32, asUInt8, Bool8, Float32, Int16, Int32, NullPointer, PaletteIndex, Pointer, ResourceId, SoundEffectId, UInt8 } from "../Types";
import { float32Schema, int16Schema, int32Schema, uint8Schema, JsonFieldMapping, transformObjectToJson } from "../../json/json-serialization";
import { LoadingContext } from "../LoadingContext";
import BufferReader from "../../BufferReader";
import { TextFileWriter } from "../../textfile/TextFileWriter";
import { SavingContext } from "../SavingContext";

export class BaseTerrainAnimation {
    animated: Bool8 = asBool8(false);
    frameCount: Int16 = asInt16(0);
    replayFrameDelay: Int16 = asInt16(0); // add an additional frameDelay * replayFrameDelay amount of delay?
    frameDelay: Float32 = asFloat32(0); // seconds
    replayDelay: Float32 = asFloat32(0); // seconds
    frame: Int16 = asInt16(0);
    drawFrame: Int16 = asInt16(0);
    animationUpdateTime: Float32 = asFloat32(0);
    frameChanged: Bool8 = asBool8(false);
    
    readFromBuffer(buffer: BufferReader, loadingContext: LoadingContext) {
        this.animated = buffer.readBool8();
        this.frameCount = buffer.readInt16();
        this.replayFrameDelay = buffer.readInt16();
        this.frameDelay = buffer.readFloat32();
        this.replayDelay = buffer.readFloat32();

        // TODO: Are these overwritten by the game as well?
        this.frame = buffer.readInt16();
        this.drawFrame = buffer.readInt16();

        this.animationUpdateTime = buffer.readFloat32();
        this.frameChanged = buffer.readBool8();
        return this;
    }

    static readFromBuffer(buffer: BufferReader, loadingContext: LoadingContext): BaseTerrainAnimation {
        const instance = new BaseTerrainAnimation();
        instance.readFromBuffer(buffer, loadingContext);
        return instance;
    };

    appendToTextFile(textFile: TextFileWriter, savingContext: SavingContext) {
        textFile
            .integer(this.animated ? 1 : 0)
            .integer(this.frameCount)
            .float(this.frameDelay)
            .float(this.replayDelay)
    }
}

export const BaseTerrainAnimationSchema = z.object({
    animated: z.boolean().default(false),
    frameCount: int16Schema.default(asInt16(0)),
    replayFrameDelay: int16Schema.default(asInt16(0)),
    frameDelay: float32Schema.default(asFloat32(0)),
    replayDelay: float32Schema.default(asFloat32(0)),
})

export type BaseTerrainAnimationJson = z.infer<typeof BaseTerrainAnimationSchema>;

export const BaseTerrainAnimationJsonMapping: JsonFieldMapping<BaseTerrainAnimation, BaseTerrainAnimationJson>[] = [
    { field: "animated" },
    { field: "frameCount", toCondition: (obj) => obj.animated },
    { field: "replayFrameDelay", toCondition: (obj) => obj.animated },
    { field: "frameDelay", toCondition: (obj) => obj.animated },
    { field: "replayDelay", toCondition: (obj) => obj.animated }
]

export class BaseTerrainTile {
    referenceId: string = "";
    id: Int16 = asInt16(-1);
    enabled: Bool8 = asBool8(false);
    random: Bool8 = asBool8(false);
    internalName: string = "";
    resourceFilename: string = "";
    resourceId: ResourceId<Int32> = asInt32(-1);
    graphicPointer: Pointer = NullPointer;
    soundEffectId: SoundEffectId<Int32> = asInt32(-1);
    soundEffect: SoundEffect | null = null;
    minimapColor1: PaletteIndex = asUInt8(0);
    minimapColor2: PaletteIndex = asUInt8(0);
    minimapColor3: PaletteIndex = asUInt8(0);
    animation: BaseTerrainAnimation = new BaseTerrainAnimation();    
    drawCount: UInt8 = asUInt8(0);

    appendToTextFile(textFile: TextFileWriter, savingContext: SavingContext) {
        textFile
            .integer(this.id)
            .string(this.internalName.replaceAll(" ", "_"), 17)
            .filename(this.resourceFilename)
            .conditional(semver.gte(savingContext.version.numbering, "2.0.0"), writer => writer.integer(this.resourceId))
            .integer(this.random ? 1 : 0)
            .integer(this.minimapColor2)
            .integer(this.minimapColor1)
            .integer(this.minimapColor3)
            .integer(this.soundEffectId)

        this.animation.appendToTextFile(textFile, savingContext);
    }
}

export const BaseTerrainTileSchema = z.object({
    enabled: z.boolean().optional().default(true).describe("Whether this is a valid entry. Should always be true, else the entry is ignored."),
    random: z.boolean().optional().default(false).describe("Whether tiles of the terrain are randomized."),
    internalName: z.string().max(13),
    resourceFilename: z.string().max(13),
    resourceId: int32Schema.optional().default(asInt32(-1)),
    soundEffectId: int32Schema.optional().default(asInt32(-1)),
    minimapColor1: uint8Schema,
    minimapColor2: uint8Schema,
    minimapColor3: uint8Schema,
    animation: BaseTerrainAnimationSchema.default({}),
})

export type BaseTerrainTileJson = z.infer<typeof BaseTerrainTileSchema>;

export const BaseTerrainJsonMapping: JsonFieldMapping<BaseTerrainTile, BaseTerrainTileJson>[] = [
    { field: "enabled", flags: { internalField: true } },
    { field: "random", flags: { internalField: true } },
    { field: "internalName" },
    { field: "resourceFilename" },
    { field: "resourceId", versionFrom: "2.0.0" },
    { field: "soundEffectId" },
    { field: "minimapColor1" },
    { field: "minimapColor2" },
    { field: "minimapColor3" },
    { jsonField: "animation", toJson: (obj, savingContext) => transformObjectToJson(obj.animation, BaseTerrainAnimationJsonMapping, savingContext) },
]

export interface BaseTerrainFrameMap {
    frameCount: Int16;
    animationFrames: Int16;
    frameIndex: Int16;
}

export const BaseTerrainFrameMapSchema = z.object({
    frameCount: int16Schema,
    animationFrames: int16Schema,
    frameIndex: int16Schema.optional()
});

export type BaseTerrainFrameMapJson = z.infer<typeof BaseTerrainFrameMapSchema>;

export const BaseTerrainFrameMapJsonMapping: JsonFieldMapping<BaseTerrainFrameMap, BaseTerrainFrameMapJson>[] = [
    { field: "frameCount" },
    { field: "animationFrames" },
    { field: "frameIndex", flags: { internalField: true } },
];
