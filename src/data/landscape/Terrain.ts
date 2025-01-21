import BufferReader from "../../BufferReader";
import { LoadingContext } from "../LoadingContext";
import { asBool8, asFloat32, asInt16, asInt32, asUInt16, asUInt8, Bool8, BorderId, Float32, Int16, Int32, NullPointer, PaletteIndex, Pointer, PrototypeId, ResourceId, SoundEffectId, TerrainId, UInt16, UInt8 } from "../Types";

interface FrameMap {
    frameCount: Int16;
    animationFrames: Int16;
    frameIndex: Int16;
}

interface TerrainObjectPlacement {
    prototypeId: PrototypeId<Int16>;
    density: Int16;
    centralize: Bool8;
}

const internalFields: (keyof Terrain)[] = [
    "graphicPointer",
    "padding0196",
    "drawCount"
];

export class Terrain {
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
    minimapCliffColor1: PaletteIndex = asUInt8(0);
    minimapCliffColor2: PaletteIndex = asUInt8(0);
    passableTerrain: TerrainId<UInt8> = asUInt8(0);
    impassableTerrain: TerrainId<UInt8> = asUInt8(0);

    // TODO: Move animation stuff to common interface?
    animated: Bool8 = asBool8(false);
    animationFrameCount: Int16 = asInt16(0);
    animationReplayFrameDelay: Int16 = asInt16(0); // add an additional frameDelay * replayFrameDelay amount of delay?
    animationFrameDelay: Float32 = asFloat32(0); // seconds
    animationReplayDelay: Float32 = asFloat32(0); // seconds
    frame: Int16 = asInt16(0);
    drawFrame: Int16 = asInt16(0);
    animationUpdateTime: Float32 = asFloat32(0);
    frameChanged: Bool8 = asBool8(false);

    drawCount: UInt8 = asUInt8(0); // definitely overwritten...
    frameMaps: FrameMap[] = [];
    renderedTerrain: TerrainId<Int16> = asInt16(-1);
    terrainPatternHeight: Int16 = asInt16(0);
    terrainPatternWidth: Int16 = asInt16(0);
    borderTypes: BorderId<Int16>[] = [];
    objectPlacements: TerrainObjectPlacement[] = [];
    padding0196: UInt16 = asUInt16(0);

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
        this.minimapCliffColor1 = buffer.readUInt8();
        this.minimapCliffColor2 = buffer.readUInt8();

        this.passableTerrain = buffer.readUInt8();
        this.impassableTerrain = buffer.readUInt8();

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
            this.frameMaps.push({
                frameCount: buffer.readInt16(),
                animationFrames: buffer.readInt16(),
                frameIndex: buffer.readInt16()
            });
        }
        this.renderedTerrain = buffer.readInt16();
        this.terrainPatternHeight = buffer.readInt16();
        this.terrainPatternWidth = buffer.readInt16();

        this.borderTypes = [];
        for (let i = 0; i < 32; ++i) {
            this.borderTypes.push(buffer.readInt16());
        }

        const placementObjectTypes: PrototypeId<Int16>[] = [];
        const placementObjectDensities: Int16[] = [];
        const placementObjectCentralize: Bool8[] = [];
        for (let i = 0; i < 30; ++i) {
            placementObjectTypes.push(buffer.readInt16());
        }
        for (let i = 0; i < 30; ++i) {
            placementObjectDensities.push(buffer.readInt16());
        }
        for (let i = 0; i < 30; ++i) {
            placementObjectCentralize.push(buffer.readBool8());
        }
        const placementObjectCount = buffer.readInt16();
        this.objectPlacements = [];
        for (let i = 0; i < placementObjectCount; ++i) {
            this.objectPlacements.push({
                prototypeId: placementObjectTypes[i],
                density: placementObjectDensities[i],
                centralize: placementObjectCentralize[i]
            });
        }
        this.padding0196 = buffer.readUInt16();

    }

    toString() {
        return JSON.stringify(this);
    }
}

export function readMainTerrainData(buffer: BufferReader, loadingContext: LoadingContext): Terrain[] {
    const result: Terrain[] = [];
    for (let i = 0; i < 32; ++i) {
        const terrain = new Terrain();
        terrain.readFromBuffer(buffer, loadingContext);
        result.push(terrain);
    }
    return result;
}

export function readSecondaryTerrainData(terrains: Terrain[], buffer: BufferReader, loadingContext: LoadingContext) {
    const terrainCount = buffer.readInt16();
    terrains.splice(terrainCount);
}
