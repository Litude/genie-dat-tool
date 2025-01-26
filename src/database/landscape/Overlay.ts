import semver from 'semver';
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

interface FrameMap {
    frameCount: Int16;
    animationFrames: Int16;
    frameIndex: Int16;
}

export class Overlay {
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

    readFromBuffer(buffer: BufferReader, id: Int16, soundEffects: SoundEffect[], loadingContext: LoadingContext): void {
        this.id = id
        this.enabled = buffer.readBool8();
        this.random = buffer.readBool8();

        this.internalName = buffer.readFixedSizeString(13);
        this.resourceFilename = buffer.readFixedSizeString(13);
        if (semver.gte(loadingContext.version.numbering, "2.0.0")) {
            this.resourceId = buffer.readInt32();
        }
        else {
            this.resourceId = asInt32(-1);
        }

        this.soundEffectId = buffer.readInt32();
        this.soundEffect = getEntryOrLogWarning(soundEffects, this.soundEffectId, "SoundEffect");
        this.graphicPointer = buffer.readPointer(); // overwritten quickly by the game

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
            for (let j = 0; j < 16; ++j) {
                this.frameMaps[i].push({
                    frameCount: buffer.readInt16(),
                    animationFrames: buffer.readInt16(),
                    frameIndex: buffer.readInt16()
                });
            }
        }
        this.drawTerrain = buffer.readBool8();
        this.padding59B = buffer.readUInt8();
    }

    toString() {
        return JSON.stringify(this);
    }
}

export function readMainOverlayData(buffer: BufferReader, soundEffects: SoundEffect[], loadingContext: LoadingContext): (Overlay | null)[] {
    const result: (Overlay | null)[] = [];
    if (semver.lt(loadingContext.version.numbering, "2.0.0")) {
        for (let i = 0; i < 16; ++i) {
            const overlay = new Overlay();
            overlay.readFromBuffer(buffer, asInt16(i), soundEffects, loadingContext);
            result.push(overlay.enabled ? overlay : null);
        }
    }
    return result;
}

export function readSecondaryOverlayData(overlays: (Overlay | null)[], buffer: BufferReader, loadingContext: LoadingContext) {
    if (semver.lt(loadingContext.version.numbering, "2.0.0")) {
        const overlayCount = buffer.readInt16();
        if (overlayCount !== overlays.filter(isDefined).length) {
            Logger.warn(`Mismatch between enabled overlays and overlay count, DAT might be corrupt!`)
        }
    }
}


export function writeOverlaysToWorldTextFile(overlays: (Overlay | null)[], savingContext: SavingContext) {
    const textFileWriter = new TextFileWriter(TextFileNames.Overlays);
    textFileWriter.raw(overlays.filter(isDefined).length).eol(); // Total overlay entries
    const sortedOverlays = [...overlays].filter(isDefined).sort((a, b) => textFileStringCompare(a.internalName, b.internalName));
    sortedOverlays.forEach(overlay => {
        textFileWriter
            .integer(overlay.id)
            .string(overlay.internalName.replaceAll(" ", "_"), 17)
            .filename(overlay.resourceFilename)
            .conditional(semver.gte(savingContext.version.numbering, "2.0.0"), writer => writer.integer(overlay.resourceId))
            .integer(overlay.random ? 1 : 0)
            .integer(overlay.minimapColor2)
            .integer(overlay.minimapColor1)
            .integer(overlay.minimapColor3)
            .integer(overlay.soundEffectId)
            .integer(overlay.animated ? 1 : 0)
            .integer(overlay.animationFrameCount)
            .float(overlay.animationFrameDelay)
            .float(overlay.animationReplayDelay)
            .integer(overlay.drawTerrain ? 1 : 0)
        for (let j = 0; j < 19; ++j) {
            for (let k = 0; k < 16; ++k) {
                textFileWriter
                    .integer(overlay.frameMaps[j][k].frameCount)
                    .integer(overlay.frameMaps[j][k].animationFrames);
            }
        }
        textFileWriter.eol();
        textFileWriter.raw(" ").eol();
    })

    textFileWriter.close();
}
