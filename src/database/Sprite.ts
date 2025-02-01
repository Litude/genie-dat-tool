import semver from "semver";
import BufferReader from "../BufferReader";
import { Point } from "../geometry/Point";
import { Rectangle } from "../geometry/Rectangle";
import { LoadingContext } from "./LoadingContext";
import { SavingContext } from "./SavingContext";
import { asInt16, asInt32, Bool8, Float32, Int16, Int32, Pointer, ResourceId, SoundEffectId, UInt8 } from "./Types";
import { TextFileWriter } from "../textfile/TextFileWriter";
import { TextFileNames } from "../textfile/TextFile";
import { SoundEffect } from "./SoundEffect";
import { Logger } from "../Logger";
import { getDataEntry } from "../util";
import { onParsingError } from "./Error";
import path from "path";
import { writeFileSync } from "fs";
import { createJson, createReferenceString, createReferenceIdFromString, jsonNumberCleanup } from "../json/filenames";
import { pick } from "../ts/ts-utils";
import { clearDirectory } from "../files/file-utils";

interface SpriteOverlay {
    spriteId: Int16;
    sprite: Sprite | null;
    padding02: Int16;
    spritePointer: Pointer;
    offset: Point<Int16>;
    angle: Int16;
    padding0e: Int16;
}

interface SpriteAngleSoundEffect {
    angle: number;
    frameNumber: number;
    soundEffectId: SoundEffectId<Int16>;
    soundEffect: SoundEffect | null;
}

const spriteJsonFields: (keyof Sprite)[] = [
    'name',
    'resourceFilename',
    'resourceId',
    'colorTransformType',
    'layer',
    'forcedColorTransform',
    'selectionType',
    'boundingBox',
    'framesPerAngle',
    'angleCount',
    'objectSpeedMultiplier',
    'animationDuration',
    'animationReplayDelay',
    'spriteType'
];

export class Sprite {
    referenceId: string;
    id: Int16;
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
    soundEffect: SoundEffect | null;
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

    constructor(buffer: BufferReader, id: Int16, soundEffects: SoundEffect[], loadingContext: LoadingContext) {
        this.name = buffer.readFixedSizeString(21);
        this.referenceId = createReferenceIdFromString(this.name);
        this.resourceFilename = buffer.readFixedSizeString(13);
        this.resourceId = semver.gte(loadingContext.version.numbering, "1.3.1") ? buffer.readInt32() : asInt32(buffer.readInt16());
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
        this.soundEffect = getDataEntry(soundEffects, this.soundEffectId, "SoundEffect", this.referenceId, loadingContext);
        this.angleSoundEffectsEnabled = buffer.readBool8();
        this.framesPerAngle = buffer.readInt16();
        this.angleCount = buffer.readInt16();
        this.objectSpeedMultiplier = buffer.readFloat32();
        this.animationDuration = buffer.readFloat32();
        this.animationReplayDelay = buffer.readFloat32();
        this.spriteType = buffer.readUInt8();
        this.id = buffer.readInt16();
        if (this.id !== id) {
            onParsingError(`Mismatch between stored Sprite id ${this.id} and ordering ${id}, data might be corrupt!`, loadingContext);
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
                    y: buffer.readInt16()
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
                    const soundEffectId = buffer.readInt16();
                    let soundEffect: SoundEffect | null = null;
                    if (soundEffectId >= 0) {
                        if (soundEffectId < soundEffects.length) {
                            soundEffect = soundEffects[soundEffectId];
                        }
                        else {
                            Logger.warn(`Could not find sound effect ${soundEffectId}, data might be corrupt!`)
                        }
                    }
                    this.angleSoundEffects.push({
                        angle: i,
                        frameNumber,
                        soundEffectId,
                        soundEffect,
                    });
                }
            }
        }
    }

    linkOtherData(sprites: (Sprite | null)[], loadingContext: LoadingContext) {
        this.overlays.forEach(overlay => {
            overlay.sprite = getDataEntry(sprites, overlay.spriteId, "Sprite", this.referenceId, loadingContext);
        });
    }

    writeToJsonFile(directory: string, savingContext: SavingContext) {
        const parsedSprite = {
            ...pick(this, spriteJsonFields),
            mirroringMode: this.mirroringMode ? true : false,
            soundEffectId: createReferenceString("SoundEffect", this.soundEffect?.referenceId, this.soundEffectId),
            overlays: this.overlays.map(overlay => ({
                offset: overlay.offset,
                angle: overlay.angle,
                spriteId: createReferenceString("Sprite", overlay.sprite?.referenceId, overlay.spriteId) 
            })),
            angleSoundEffects: this.angleSoundEffects
                .filter(soundEffect => soundEffect.soundEffectId >= 0)
                .map(soundEffect => ({
                    angle: soundEffect.angle,
                    frameNumber: soundEffect.frameNumber,
                    soundEffect: createReferenceString("SoundEffect", soundEffect.soundEffect?.referenceId, soundEffect.soundEffectId)
                }))
        };

        writeFileSync(path.join(directory, `${this.referenceId}.json`), createJson(parsedSprite));
    }

    toString() {
        return JSON.stringify(this);
    }

}

export function readSprites(buffer: BufferReader, soundEffects: SoundEffect[], loadingContext: LoadingContext) {
    const result: (Sprite | null)[] = [];
    const validSprites: boolean[] = [];
    const spriteCount = buffer.readInt16();

    if (semver.gte(loadingContext.version.numbering, "3.7.0")) {
        for (let i = 0; i < spriteCount; ++i) {
            validSprites.push(Boolean(buffer.readBool32()))
        }
    }
    else {
        for (let i = 0; i < spriteCount; ++i) {
            validSprites.push(true);
        }
    }

    for (let i = 0; i < spriteCount; ++i) {
        if (validSprites[i]) {
            const sprite = new Sprite(buffer, asInt16(i), soundEffects, loadingContext)
            if (sprite.name && sprite.resourceFilename) {
                result.push(sprite);
            }
            else {
                result.push(null);
            }
        }
        else {
            result.push(null);
        }
    }
    return result;
}

export function writeSpritesToWorldTextFile(outputDirectory: string, sprites: (Sprite | null)[], savingContext: SavingContext) {
    const textFileWriter = new TextFileWriter(path.join(outputDirectory, TextFileNames.Sprites));
    textFileWriter.raw(sprites.length).eol(); // Total sprites entries
    textFileWriter.raw(sprites.filter(sprite => sprite?.name).length).eol(); // Entries that have data here

    sprites.forEach(sprite => {
        if (sprite) {
            // This is a hackish way to keep tower sound effects as they are. It would seem they were originally imported with a non-existing angle number of 1
            // so they were set to -1 during import and such entries are not included by default
            let subsituteEntry = false;
            let angleSoundEffectCount = sprite.angleSoundEffectsEnabled ? sprite.angleSoundEffects.reduce((acc, cur) => acc + (cur.soundEffectId >= 0 ? 1 : 0), 0) : 0;
            if (angleSoundEffectCount === 0 && sprite.angleSoundEffectsEnabled) {
                angleSoundEffectCount = sprite.angleCount;
                subsituteEntry = true;
            }

            textFileWriter
                .integer(sprite.id)
                .string(sprite.name.replaceAll(' ', '_'), 17)
                .filename(sprite.resourceFilename)
                .integer(sprite.resourceId)
                .integer(sprite.framesPerAngle)
                .integer(sprite.angleCount)
                .integer(sprite.mirroringMode === 0 ? 0 : 1)
                .integer(sprite.colorTransformType)
                .integer(sprite.layer)
                .integer(sprite.forcedColorTransform)
                .integer(sprite.spriteType & 0x04 ? 1 : 0) // Randomize on start flag
                .integer(sprite.selectionType)
                .integer(sprite.spriteType & 0x01 ? 1 : 0) // Animated flag
                .integer(sprite.spriteType & 0x02 ? 1 : 0) // Directional flag
                .integer(sprite.spriteType & 0x08 ? 1 : 0) // Loop once flag
                .integer(sprite.boundingBox.left)
                .integer(sprite.boundingBox.top)
                .integer(sprite.boundingBox.right)
                .integer(sprite.boundingBox.bottom)
                .float(sprite.objectSpeedMultiplier)
                .float(sprite.animationDuration)
                .float(sprite.animationReplayDelay)
                .integer(sprite.overlays.length)
                .integer(sprite.soundEffectId)
                .integer(angleSoundEffectCount)
                .eol();
                
            for (let j = 0; j < sprite.overlays.length; ++j) {
                const overlay = sprite.overlays[j];
                textFileWriter
                    .indent(2)
                    .integer(overlay.spriteId)
                    .integer(overlay.offset.x)
                    .integer(overlay.offset.y)
                    .integer(overlay.angle)
                    .eol();
            }
            if (sprite.angleSoundEffectsEnabled) {
                if (subsituteEntry) {
                    for (let j = 0; j < sprite.angleCount; ++j) {
                        textFileWriter
                        .indent(4)
                        .integer(-1)
                        .integer(-1)
                        .integer(-1)
                        .eol();
                    }
                }
                else {
                    for (let j = 0; j < sprite.angleSoundEffects.length; ++j) {
                        const soundEffect = sprite.angleSoundEffects[j];
                        if (soundEffect.soundEffectId >= 0) {
                            textFileWriter
                            .indent(4)
                            .integer(soundEffect.angle)
                            .integer(soundEffect.frameNumber)
                            .integer(soundEffect.soundEffectId)
                            .eol();
                        }
                    }
                }
            }
        }
    })

    textFileWriter.close();
}


export function writeSpritesToJsonFiles(outputDirectory: string, sprites: (Sprite | null)[], savingContext: SavingContext) {
    const spriteDirectory = path.join(outputDirectory, "sprites");
    clearDirectory(spriteDirectory);

    sprites.forEach(sprite => {
        sprite?.writeToJsonFile(spriteDirectory, savingContext);
    });

    const spriteIds = sprites.map(sprite => sprite?.referenceId ?? null);
    writeFileSync(path.join(spriteDirectory, "index.json"), JSON.stringify(spriteIds, undefined, 4));
}