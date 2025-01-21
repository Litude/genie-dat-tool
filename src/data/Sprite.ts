import { createWriteStream } from "fs";
import BufferReader from "../BufferReader";
import { Point } from "../geometry/Point";
import { Rectangle } from "../geometry/Rectangle";
import { LoadingContext } from "./LoadingContext";
import { SavingContext } from "./SavingContext";
import { Bool8, Float32, Int16, Int32, Pointer, ResourceId, SoundEffectId, UInt8 } from "./Types";
import { EOL } from "os";
import { formatInteger, formatString } from "../Formatting";

interface SpriteOverlay {
    spriteId: Int16;
    padding02: Int16;
    spritePointer: Pointer;
    offset: Point<Int16>;
    angle: Int16;
    padding0e: Int16;
}

interface SpriteAngleSoundEffect {
    frameNumber: number;
    soundEffectId: number;
}

export class Sprite {
    id: Int16; // todo: check if this matches index?
    name: string;
    resourceFilename: string;
    resourceId: ResourceId<Int32>;
    loaded: Bool8;
    colorTransformType: UInt8;
    layer: UInt8;
    forcedColorTransform: Int16;
    selectionType: UInt8;
    boundingBox: Rectangle<Int16>;
    soundEffectId: SoundEffectId<Int16>;
    angleSoundEffectsEnabled: Bool8;
    framesPerAngle: Int16;
    angleCount: Int16;
    objectSpeedMultiplier: Float32;
    animationDuration: Float32; // seconds
    animationReplayDelay: Float32; // seconds
    spriteType: UInt8;
    mirroringMode: UInt8;
    overlays: SpriteOverlay[];
    angleSoundEffects: SpriteAngleSoundEffect[];

    constructor(buffer: BufferReader, loadingContext: LoadingContext) {
        this.name = buffer.readFixedSizeString(21);
        this.resourceFilename = buffer.readFixedSizeString(13);
        this.resourceId = buffer.readInt32();
        this.loaded = buffer.readBool8();
        this.colorTransformType = buffer.readUInt8();
        this.layer = buffer.readUInt8();
        this.forcedColorTransform = buffer.readInt16();
        this.selectionType = buffer.readUInt8();
        this.boundingBox = {
            left: buffer.readInt16(),
            top: buffer.readInt16(),
            right: buffer.readInt16(),
            bottom: buffer.readInt16()
        };

        const overlayCount = buffer.readInt16();

        this.soundEffectId = buffer.readInt16();
        this.angleSoundEffectsEnabled = buffer.readBool8();
        this.framesPerAngle = buffer.readInt16();
        this.angleCount = buffer.readInt16();
        this.objectSpeedMultiplier = buffer.readFloat32();
        this.animationDuration = buffer.readFloat32();
        this.animationReplayDelay = buffer.readFloat32();
        this.spriteType = buffer.readUInt8();
        this.id = buffer.readInt16();
        this.mirroringMode = buffer.readUInt8();

        this.overlays = [];
        for (let i = 0; i < overlayCount; ++i) {
            this.overlays.push({
                spriteId: buffer.readInt16(),
                padding02: buffer.readInt16(),
                spritePointer: buffer.readPointer(),
                offset: {
                    x: buffer.readInt16(),
                    y: buffer.readInt16()
                },
                angle: buffer.readInt16(),
                padding0e: buffer.readInt16(),
            });
        }
        this.angleSoundEffects = [];
        if (this.angleSoundEffectsEnabled) {
            for (let i = 0; i < this.angleCount; ++i) {
                const frameNumbers: number[] = [];
                const soundEffectIds: number[] = [];
                for (let j = 0; j < 3; ++j) {
                    frameNumbers.push(buffer.readInt16());
                }
                for (let j = 0; j < 3; ++j) {
                    soundEffectIds.push(buffer.readInt16());
                }
                // TODO: Should entries with -1 in both fields be excluded to make the data cleaner?
                // Also could have a boolean indicating whether a sound effect is meant for all frames or not
                for (let j = 0; j < 3; ++j) {
                    this.angleSoundEffects.push({
                        frameNumber: frameNumbers[j],
                        soundEffectId: soundEffectIds[j],
                    })
                }
            }
        }

    }

    toString() {
        return JSON.stringify(this);
    }

}

export function readSprites(buffer: BufferReader, loadingContext: LoadingContext) {
    console.log(`Offset at start is ${buffer.tell()}`)
    const result: (Sprite | null)[] = [];
    const validSprites: boolean[] = [];
    const spriteCount = buffer.readInt16();

    for (let i = 0; i < spriteCount; ++i) {
        validSprites.push(Boolean(buffer.readBool32()))
    }

    for (let i = 0; i < spriteCount; ++i) {
        if (validSprites[i]) {
            result.push(new Sprite(buffer, loadingContext));
        }
        else {
            result.push(null);
        }
    }
    return result;
}

export function writeSpritesToWorldTextFile(sprites: Sprite[], savingContext: SavingContext) {
    const writeStream = createWriteStream('tr_spr.txt');
    writeStream.write(`${sprites.length}${EOL}`) // Total sprites entries
    writeStream.write(`${sprites.length}${EOL}`) // Entries that have data here (these should always match because there are no null sprite entries)

    // for (let i = 0; i < sprites.length; ++i) {
    //     const sprite = sprites[i]
    //     writeStream.write([
    //         formatInteger(sprite.id),
    //         formatString(sprite.name, 17),
    //         formatString(sprite.resourceFilename, 9),
    //         formatInteger(sprite.resourceId),
    //         formatInteger(sprite.framesPerAngle),
    //         formatInteger(sprite.angleCount),
    //         formatInteger(sprite.mirroringMode === 0 ? 0 : 1),
    //         EOL
    //     ].join(""))

    //     for (let j = 0; j < soundEffect.samples.length; ++j) {
    //         const sample = soundEffect.samples[j];
    //         const filename = sample.resourceFilename.endsWith(".wav") ? sample.resourceFilename.slice(0, -4) : sample.resourceFilename;
    //         writeStream.write([
    //             "  ",
    //             formatInteger(sample.resourceId),
    //             formatString(filename, 9),
    //             formatInteger(sample.playbackProbability),
    //             EOL
    //         ].join(""))
    //     }
    // }
    writeStream.close();
}
