import semver from "semver";
import BufferReader from "../../BufferReader";
import { Logger } from "../../Logger";
import { TextFileNames, textFileStringCompare } from "../../textfile/TextFile";
import { TextFileWriter } from "../../textfile/TextFileWriter";
import { isDefined } from "../../ts/ts-utils";
import { getDataEntry } from "../../util";
import { LoadingContext } from "../LoadingContext";
import { SceneryObjectPrototype } from "../object/SceneryObjectPrototype";
import { SavingContext } from "../SavingContext";
import { SoundEffect } from "../SoundEffect";
import { asBool8, asFloat32, asInt16, asInt32, asUInt16, asUInt8, Bool8, BorderId, Float32, Int16, Int32, NullPointer, PaletteIndex, Pointer, PrototypeId, ResourceId, SoundEffectId, TerrainId, UInt16, UInt8 } from "../Types";
import { Border } from "./Border";
import { onParsingError } from "../Error";

interface FrameMap {
    frameCount: Int16;
    animationFrames: Int16;
    frameIndex: Int16;
}

interface TerrainObjectPlacement {
    prototypeId: PrototypeId<Int16>;
    object: SceneryObjectPrototype | null;
    density: Int16;
    centralize: Bool8;
}

const internalFields: (keyof Terrain)[] = [
    "graphicPointer",
    "padding0196",
    "drawCount"
];

export class Terrain {
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
    minimapCliffColor1: PaletteIndex = asUInt8(0);
    minimapCliffColor2: PaletteIndex = asUInt8(0);
    passableTerrainId: TerrainId<Int16> = asInt16(-1); // Note! This is stored as 8 bits in the data!
    passableTerrain: Terrain | null = null;
    impassableTerrainId: TerrainId<Int16> = asInt16(-1); // Note! This is stored as 8 bits in the data!
    impassableTerrain: Terrain | null = null;

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
    renderedTerrainId: TerrainId<Int16> = asInt16(-1);
    renderedTerrain: Terrain | null = null;
    terrainPatternHeight: Int16 = asInt16(0);
    terrainPatternWidth: Int16 = asInt16(0);
    borderTypeIds: BorderId<Int16>[] = [];
    borderTypes: (Border | null)[] = [];
    objectPlacements: TerrainObjectPlacement[] = [];
    padding0196: UInt16 = asUInt16(0);

    readFromBuffer(buffer: BufferReader, id: Int16, soundEffects: SoundEffect[], loadingContext: LoadingContext): void {
        this.id = id;
        this.enabled = buffer.readBool8();
        this.random = buffer.readBool8();

        this.internalName = buffer.readFixedSizeString(13);
        this.referenceId = this.internalName;
        this.resourceFilename = buffer.readFixedSizeString(13);
        if (semver.gte(loadingContext.version.numbering, "2.0.0")) {
            this.resourceId = buffer.readInt32();
        }
        else {
            this.resourceId = asInt32(-1);
        }

        this.graphicPointer = buffer.readPointer(); // overwritten by the game
        this.soundEffectId = buffer.readInt32();
        this.soundEffect = getDataEntry(soundEffects, this.soundEffectId, "SoundEffect", this.referenceId, loadingContext);

        this.minimapColor1 = buffer.readUInt8();
        this.minimapColor2 = buffer.readUInt8();
        this.minimapColor3 = buffer.readUInt8();
        this.minimapCliffColor1 = buffer.readUInt8();
        this.minimapCliffColor2 = buffer.readUInt8();

        const rawPassableTerrainId = buffer.readUInt8()
        this.passableTerrainId = asInt16(rawPassableTerrainId === 255 ? -1 : rawPassableTerrainId);
        const rawImpassableTerrainId = buffer.readUInt8();
        this.impassableTerrainId = asInt16(rawImpassableTerrainId === 255 ? -1 : rawImpassableTerrainId);

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
        this.renderedTerrainId = buffer.readInt16();
        this.terrainPatternHeight = buffer.readInt16();
        this.terrainPatternWidth = buffer.readInt16();

        this.borderTypes = [];
        for (let i = 0; i < 32; ++i) {
            this.borderTypeIds.push(buffer.readInt16());
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
                object: null,
                density: placementObjectDensities[i],
                centralize: placementObjectCentralize[i]
            });
        }
        
        this.padding0196 = buffer.readUInt16();

    }

    linkOtherData(terrains: (Terrain | null)[], borders: (Border | null)[], objects: (SceneryObjectPrototype | null)[], loadingContext: LoadingContext) {
        this.passableTerrain = this.passableTerrainId !== 255 ? getDataEntry(terrains, this.passableTerrainId, "Terrain", this.referenceId, loadingContext) : null;
        this.impassableTerrain = this.impassableTerrainId !== 255 ? getDataEntry(terrains, this.impassableTerrainId, "Terrain", this.referenceId, loadingContext) : null;
        this.renderedTerrain = getDataEntry(terrains, this.renderedTerrainId, "Terrain", this.referenceId, loadingContext);
        this.borderTypes = this.borderTypeIds.map(borderId => getDataEntry(borders, borderId, "Border", this.referenceId, loadingContext));
        this.objectPlacements.forEach(placement => {
            placement.object = getDataEntry(objects, placement.prototypeId, "ObjectPrototype", this.referenceId, loadingContext);
        });
    }

    toString() {
        return JSON.stringify(this);
    }
}

export function readMainTerrainData(buffer: BufferReader, soundEffects: SoundEffect[], loadingContext: LoadingContext): (Terrain | null)[] {
    const result: (Terrain | null)[] = [];
    for (let i = 0; i < 32; ++i) {
        const terrain = new Terrain();
        terrain.readFromBuffer(buffer, asInt16(i), soundEffects, loadingContext);
        result.push(terrain.enabled ? terrain : null);
    }
    return result;
}

export function readSecondaryTerrainData(terrains: (Terrain | null)[], buffer: BufferReader, loadingContext: LoadingContext) {
    const terrainCount = buffer.readInt16();
    if (terrainCount !== terrains.filter(x => x).length) {
        onParsingError(`Mismatch between enabled terrains and terrain count, DAT might be corrupt!`, loadingContext);
    }
}

function writeTerrainObjectsToWorldTextFile(terrains: (Terrain | null)[], savingContext: SavingContext) {
    const textFileWriter = new TextFileWriter(TextFileNames.TerrainObjects);
    const parsedEntries = [...terrains]
        .filter(isDefined)
        .sort((a, b) => textFileStringCompare(a.internalName, b.internalName))
        .flatMap(terrain => terrain.objectPlacements.map(placement => ({ ...placement, terrainId: terrain.id })));
    textFileWriter.raw(parsedEntries.length).eol();

    parsedEntries.forEach(entry => {
        if (entry.prototypeId >= 0) {
            textFileWriter
                .integer(entry.terrainId)
                .integer(entry.prototypeId)
                .integer(entry.density)
                .integer(entry.centralize ? 1 : 0)
                .eol()
        }
    });
    textFileWriter.close();
}

export function writeTerrainsToWorldTextFile(terrains: (Terrain | null)[], savingContext: SavingContext) {
    const textFileWriter = new TextFileWriter(TextFileNames.Terrains);
    textFileWriter.raw(terrains.filter(isDefined).length).eol(); // Total terrain entries
    const sortedTerrains = [...terrains].filter(isDefined).sort((a, b) => textFileStringCompare(a.internalName, b.internalName));


    for (let i = 0; i < sortedTerrains.length; ++i) {
        const terrain = sortedTerrains[i];
        const borderEntries = terrain.borderTypes.map((border, id) => ({
            terrain: border ? getDataEntry(terrains, id, "Terrain", terrain.referenceId, { abortOnError: false }) : null,
            border
        })).sort((a, b) => {
            if (a.terrain && b.terrain) {
                return textFileStringCompare(a.terrain.internalName, b.terrain.internalName);
            }
            else {
                return a.terrain ? 1 : - 1;
            }
        });
        const borderCount = borderEntries.filter(entry => entry.border).length;
        textFileWriter
            .integer(terrain.id)
            .string(terrain.internalName.replaceAll(" ", "_"), 17)
            .filename(terrain.resourceFilename)
            .conditional(semver.gte(savingContext.version.numbering, "2.0.0"), writer => writer.integer(terrain.resourceId))
            .integer(terrain.random ? 1 : 0)
            .integer(terrain.minimapColor2)
            .integer(terrain.minimapColor1)
            .integer(terrain.minimapColor3)
            .integer(terrain.soundEffectId)
            .integer(terrain.animated ? 1 : 0)
            .integer(terrain.animationFrameCount)
            .float(terrain.animationFrameDelay)
            .float(terrain.animationReplayDelay)
            .integer(terrain.renderedTerrainId)
            .integer(terrain.terrainPatternHeight)
            .integer(terrain.terrainPatternWidth)
            .integer(terrain.minimapCliffColor1)
            .integer(terrain.minimapCliffColor2)
            .integer(terrain.impassableTerrainId)
            .integer(terrain.passableTerrainId)
            .integer(borderCount);
        for (let j = 0; j < 19; ++j) {
            textFileWriter
                .integer(terrain.frameMaps[j].frameCount)
                .integer(terrain.frameMaps[j].animationFrames);
        }
        for (let j = 0; j < terrain.borderTypes.length; ++j) {
            const borderEntry = borderEntries[j];
            if (borderEntry.border) {
                textFileWriter
                    .integer(borderEntry.terrain?.id ?? -1)
                    .integer(borderEntry.border.id);
            }
        }
        textFileWriter.eol();

    }

    textFileWriter.close();
    writeTerrainObjectsToWorldTextFile(terrains, savingContext);
}
