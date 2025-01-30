import semver from 'semver';
import BufferReader from "../../BufferReader";
import { Logger } from "../../Logger";
import { TextFileNames, textFileStringCompare } from "../../textfile/TextFile";
import { TextFileWriter } from "../../textfile/TextFileWriter";
import { isDefined, pick } from "../../ts/ts-utils";
import { getDataEntry } from "../../util";
import { LoadingContext } from "../LoadingContext";
import { SavingContext } from "../SavingContext";
import { SoundEffect } from "../SoundEffect";
import { asBool16, asBool8, asFloat32, asInt16, asInt32, asUInt16, asUInt8, Bool16, Bool8, Float32, Int16, Int32, NullPointer, PaletteIndex, Pointer, ResourceId, SoundEffectId, TerrainId, UInt16, UInt8 } from "../Types";
import { Terrain } from "./Terrain";
import { onParsingError } from '../Error';
import path from 'path';
import { createJson, createReferenceString, createReferenceIdFromString, writeJsonFileIndex } from '../../json/filenames';
import { clearDirectory } from '../../files/file-utils';
import { writeFileSync } from 'fs';

interface FrameMap {
    frameCount: Int16;
    animationFrames: Int16;
    frameIndex: Int16;
}

const animationFields: (keyof Border)[] = [  
    "animationFrameCount",
    "animationFrameDelay",
    "animationReplayDelay",
];

const jsonFields: (keyof Border)[] = [
    "internalName",
    "resourceFilename",
    "resourceId",
    "minimapColor1",
    "minimapColor2",
    "minimapColor3",
    "animated",
    "drawTerrain",
    "overlayBorder"
];

export class Border {
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
    animated: Bool8 = asBool8(false);
    animationFrameCount: Int16 = asInt16(0);
    animationReplayFrameDelay: Int16 = asInt16(0); // add an additional frameDelay * replayFrameDelay amount of delay?
    animationFrameDelay: Float32 = asFloat32(0); // seconds
    animationReplayDelay: Float32 = asFloat32(0); // seconds
    frame: Int16 = asInt16(0);
    drawFrame: Int16 = asInt16(0);
    animationUpdateTime: Float32 = asFloat32(0.0);
    frameChanged: Bool8 = asBool8(false);
    drawCount: UInt8 = asUInt8(0); // definitely overwritten...
    frameMaps: FrameMap[][] = [];
    drawTerrain: Bool8 = asBool8(false);
    padding59B: UInt8 = asUInt8(0);
    passabilityTerrainId: TerrainId<Int16> = asInt16(-1);
    passabilityTerrainType: Terrain | null = null;
    overlayBorder: Bool16 = asBool16(false);
    padding59E: UInt16 = asUInt16(0);

    readFromBuffer(buffer: BufferReader, id: Int16, soundEffects: SoundEffect[], terrains: (Terrain | null)[], loadingContext: LoadingContext): void {
        this.id = id
        this.enabled = buffer.readBool8();
        this.random = buffer.readBool8();

        this.internalName = buffer.readFixedSizeString(13);
        this.referenceId = createReferenceIdFromString(this.internalName);
        this.resourceFilename = buffer.readFixedSizeString(13);
        if (semver.gte(loadingContext.version.numbering, "2.0.0")) {
            this.resourceId = buffer.readInt32();
        }
        else {
            this.resourceId = asInt32(-1);
        }

        this.graphicPointer = buffer.readPointer(); // overwritten quickly by the game
        this.soundEffectId = buffer.readInt32();
        this.soundEffect = getDataEntry(soundEffects, this.soundEffectId, "SoundEffect", this.referenceId, loadingContext);

        this.minimapColor1 = buffer.readUInt8();
        this.minimapColor2 = buffer.readUInt8();
        this.minimapColor3 = buffer.readUInt8();

        this.animated = buffer.readBool8();
        this.animationFrameCount = buffer.readInt16();
        this.animationReplayFrameDelay = buffer.readInt16();
        this.animationFrameDelay = buffer.readFloat32();
        this.animationReplayDelay = buffer.readFloat32();

        // TODO: Are these overwritten by the game as well?
        this.frame = buffer.readInt16();
        this.drawFrame = buffer.readInt16();

        this.animationUpdateTime = buffer.readFloat32();
        this.frameChanged = buffer.readBool8();

        this.drawCount = buffer.readUInt8();

        const shapesPerTile = (semver.eq(loadingContext.version.numbering, "1.4.0") && loadingContext.version.flavor === "mickey") ? 13 : 12;

        this.frameMaps = [];
        for (let i = 0; i < 19; ++i) {
            this.frameMaps.push([]);
            for (let j = 0; j < shapesPerTile; ++j) {
                this.frameMaps[i].push({
                    frameCount: buffer.readInt16(),
                    animationFrames: buffer.readInt16(),
                    frameIndex: buffer.readInt16()
                });
            }
        }
        this.drawTerrain = buffer.readBool8();
        this.padding59B = buffer.readUInt8();
        this.passabilityTerrainId = buffer.readInt16();
        this.passabilityTerrainType = getDataEntry(terrains, this.passabilityTerrainId, "Terrain", this.referenceId, loadingContext);
        if (semver.gte(loadingContext.version.numbering, "2.0.0")) {
            this.overlayBorder = buffer.readBool16();
        }
        else {
            if (loadingContext.version.flavor !== "mickey") {
                this.padding59E = buffer.readUInt16();
            }
        }
    }
    
    writeToJsonFile(directory: string, savingContext: SavingContext) {
        writeFileSync(path.join(directory, `${this.referenceId}.json`), createJson({
            ...pick(this, jsonFields),
            ...this.animated ? pick(this, animationFields) : {},
            soundEffectId: createReferenceString("SoundEffect", this.soundEffect?.referenceId, this.soundEffectId),
            passabilityTerrainId: createReferenceString("Terrain", this.passabilityTerrainType?.referenceId, this.passabilityTerrainId),
            frames: this.frameMaps.map(tileFrames =>
                tileFrames.map(frameEntry => ({
                    frameCount: frameEntry.frameCount,
                    animationFrames: frameEntry.animationFrames
                }))
            )
        }));
    }

    toString() {
        return JSON.stringify(this);
    }
}

export function readMainBorderData(buffer: BufferReader, soundEffects: SoundEffect[], terrains: (Terrain | null)[], loadingContext: LoadingContext): (Border | null)[] {
    const result: (Border | null)[] = [];
    for (let i = 0; i < 16; ++i) {
        const border = new Border();
        border.readFromBuffer(buffer, asInt16(i), soundEffects, terrains, loadingContext);
        result.push(border.enabled ? border : null);
    }
    return result;
}

export function readSecondaryBorderData(borders: (Border | null)[], buffer: BufferReader, loadingContext: LoadingContext) {
    const borderCount = buffer.readInt16();
    if (borderCount !== borders.filter(isDefined).length) {
        onParsingError(`Mismatch between enabled borders and border count, DAT might be corrupt!`, loadingContext)
    }
}


export function writeBordersToWorldTextFile(outputDirectory: string, borders: (Border | null)[], savingContext: SavingContext) {
    const textFileWriter = new TextFileWriter(path.join(outputDirectory, TextFileNames.Borders));
    textFileWriter.raw(borders.filter(isDefined).length).eol(); // Total terrain entries
    const sortedBorders = [...borders].filter(isDefined).sort((a, b) => textFileStringCompare(a.internalName, b.internalName));
    sortedBorders.forEach(border => {
        textFileWriter
            .integer(border.id)
            .string(border.internalName.replaceAll(" ", "_"), 17)
            .filename(border.resourceFilename)
            .conditional(semver.gte(savingContext.version.numbering, "2.0.0"), writer => writer.integer(border.resourceId))
            .integer(border.random ? 1 : 0)
            .integer(border.minimapColor2)
            .integer(border.minimapColor1)
            .integer(border.minimapColor3)
            .integer(border.soundEffectId)
            .integer(border.animated ? 1 : 0)
            .integer(border.animationFrameCount)
            .float(border.animationFrameDelay)
            .float(border.animationReplayDelay)
            .integer(border.drawTerrain ? 1 : 0)
            .integer(border.passabilityTerrainId)
            .conditional(semver.gte(savingContext.version.numbering, "2.0.0"), writer =>writer.integer(border.overlayBorder ? 1 : 0));

            
        const shapesPerTile = (semver.eq(savingContext.version.numbering, "1.4.0") && savingContext.version.flavor === "mickey") ? 13 : 12;
        for (let j = 0; j < 19; ++j) {
            for (let k = 0; k < shapesPerTile; ++k) {
                textFileWriter
                    .integer(border.frameMaps[j][k].frameCount)
                    .integer(border.frameMaps[j][k].animationFrames);
            }
        }
        textFileWriter.eol();
        textFileWriter.raw(" ").eol();
    })

    textFileWriter.close();
}

export function writeBordersToJsonFiles(outputDirectory: string, borders: (Border | null)[], savingContext: SavingContext) {
    const borderDirectory = path.join(outputDirectory, "borders");
    clearDirectory(borderDirectory);

    borders.forEach(border => {
        border?.writeToJsonFile(borderDirectory, savingContext)
    });
    
    writeJsonFileIndex(borderDirectory, borders);
}
