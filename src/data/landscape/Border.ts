import BufferReader from "../../BufferReader";
import { LoadingContext } from "../LoadingContext";
import { asBool16, asBool8, asFloat32, asInt16, asInt32, asUInt8, Bool16, Bool8, Float32, Int16, Int32, NullPointer, PaletteIndex, Pointer, ResourceId, SoundEffectId, TerrainId, UInt8 } from "../Types";

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
    enabled: Bool8 = asBool8(false);
    random: Bool8 = asBool8(false);
    internalName: string = "";
    resourceFilename: string = "";
    resourceId: ResourceId<Int32> = asInt32(-1);
    graphicPointer: Pointer = NullPointer;
    soundEffectId: SoundEffectId<Int32> = asInt32(-1);
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
    passabilityTerrainType: TerrainId<Int16> = asInt16(-1);
    overlayBorder: Bool16 = asBool16(false);

    readFromBuffer(buffer: BufferReader, loadingContext: LoadingContext): void {
        this.enabled = buffer.readBool8();
        this.random = buffer.readBool8();

        this.internalName = buffer.readFixedSizeString(13);
        this.resourceFilename = buffer.readFixedSizeString(13);
        this.resourceId = buffer.readInt32();

        this.graphicPointer = buffer.readPointer(); // overwritten quickly by the game
        this.soundEffectId = buffer.readInt32();

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
        this.passabilityTerrainType = buffer.readInt16();
        this.overlayBorder = buffer.readBool16();
    }

    toString() {
        return JSON.stringify(this);
    }
}

export function readMainBorderData(buffer: BufferReader, loadingContent: LoadingContext): Border[] {
    const result: Border[] = [];
    console.log(`Offset is ${buffer.tell()}`)
    for (let i = 0; i < 16; ++i) {
        const border = new Border();
        border.readFromBuffer(buffer, loadingContent);
        result.push(border);
    }
    return result;
}

export function readSecondaryBorderData(borders: Border[], buffer: BufferReader, loadingContent: LoadingContext) {
    // TODO: Should the first border be completely removed?
    const borderCount = buffer.readInt16() + 1; // need to add one to account for dummy border
    // If the dummy border is removed, need to shift all referencing ids by -1?
    borders.splice(borderCount);
}
