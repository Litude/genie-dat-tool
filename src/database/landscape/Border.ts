import BufferReader from "../../BufferReader";
import { Logger } from "../../Logger";
import { TextFileNames, textFileStringCompare } from "../../textfile/TextFile";
import { TextFileWriter } from "../../textfile/TextFileWriter";
import { isDefined } from "../../ts/ts-utils";
import { getEntryOrLogWarning } from "../../util";
import { LoadingContext } from "../LoadingContext";
import { SavingContext } from "../SavingContext";
import { SoundEffect } from "../SoundEffect";
import { asBool16, asBool8, asFloat32, asInt16, asInt32, asUInt8, Bool16, Bool8, Float32, Int16, Int32, NullPointer, PaletteIndex, Pointer, ResourceId, SoundEffectId, TerrainId, UInt8 } from "../Types";
import { Terrain } from "./Terrain";

interface FrameMap {
    frameCount: Int16;
    animationFrames: Int16;
    frameIndex: Int16;
}

const internalFields: (keyof Border)[] = [
    "graphicPointer",
    "padding59B",
    "drawCount"
];

export class Border {
    id: Int16 = asInt16(-1);
    enabled: Bool8 = asBool8(false);
    random: Bool8 = asBool8(false);
    internalName: string = "";
    resourceFilename: string = "";
    resourceId: ResourceId<Int32> = asInt32(-1);
    graphicPointer: Pointer = NullPointer;
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
    passabilityTerrainType: Terrain | null = null;
    overlayBorder: Bool16 = asBool16(false);

    readFromBuffer(buffer: BufferReader, id: Int16, soundEffects: SoundEffect[], terrains: (Terrain | null)[], loadingContext: LoadingContext): void {
        this.id = id
        this.enabled = buffer.readBool8();
        this.random = buffer.readBool8();

        this.internalName = buffer.readFixedSizeString(13);
        this.resourceFilename = buffer.readFixedSizeString(13);
        this.resourceId = buffer.readInt32();

        this.graphicPointer = buffer.readPointer(); // overwritten quickly by the game
        const soundEffectId = buffer.readInt32();
        this.soundEffect = getEntryOrLogWarning(soundEffects, soundEffectId, "SoundEffect");

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

        this.frameMaps = [];
        for (let i = 0; i < 19; ++i) {
            this.frameMaps.push([]);
            for (let j = 0; j < 12; ++j) {
                this.frameMaps[i].push({
                    frameCount: buffer.readInt16(),
                    animationFrames: buffer.readInt16(),
                    frameIndex: buffer.readInt16()
                });
            }
        }
        this.drawTerrain = buffer.readBool8();
        this.padding59B = buffer.readUInt8();
        const passabilityTerrainTypeId = buffer.readInt16();
        this.passabilityTerrainType = getEntryOrLogWarning(terrains, passabilityTerrainTypeId, "Terrain");
        this.overlayBorder = buffer.readBool16();
    }

    toString() {
        return JSON.stringify(this);
    }
}

export function readMainBorderData(buffer: BufferReader, soundEffects: SoundEffect[], terrains: (Terrain | null)[], loadingContext: LoadingContext): (Border | null)[] {
    const result: Border[] = [];
    console.log(`Offset is ${buffer.tell()}`)
    for (let i = 0; i < 16; ++i) {
        const border = new Border();
        border.readFromBuffer(buffer, asInt16(i), soundEffects, terrains, loadingContext);
        result.push(border);
    }
    return result.map(border => border.enabled ? border : null);
}

export function readSecondaryBorderData(borders: (Border | null)[], buffer: BufferReader, loadingContext: LoadingContext) {
    const borderCount = buffer.readInt16();
    if (borderCount !== borders.filter(isDefined).length) {
        Logger.warn(`Mismatch between enabled borders and border count, DAT might be corrupt!`)
    }
}


export function writeBordersToWorldTextFile(borders: (Border | null)[], savingContext: SavingContext) {
    const textFileWriter = new TextFileWriter(TextFileNames.Borders);
    textFileWriter.raw(borders.filter(isDefined).length).eol(); // Total terrain entries
    const sortedBorders = [...borders].filter(isDefined).sort((a, b) => textFileStringCompare(a.internalName, b.internalName));
    sortedBorders.forEach(border => {
        textFileWriter
            .integer(border.id)
            .string(border.internalName.replaceAll(" ", "_"), 17)
            .filename(border.resourceFilename)
            .integer(border.resourceId)
            .integer(border.random ? 1 : 0)
            .integer(border.minimapColor2)
            .integer(border.minimapColor1)
            .integer(border.minimapColor3)
            .integer(border.soundEffect?.id ?? -1)
            .integer(border.animated ? 1 : 0)
            .integer(border.animationFrameCount)
            .float(border.animationFrameDelay)
            .float(border.animationReplayDelay)
            .integer(border.drawTerrain ? 1 : 0)
            .integer(border.passabilityTerrainType?.id ?? -1)
            .integer(border.overlayBorder ? 1 : 0);
        for (let j = 0; j < 19; ++j) {
            for (let k = 0; k < 12; ++k) {
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
