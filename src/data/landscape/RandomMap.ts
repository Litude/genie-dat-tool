import BufferReader from "../../BufferReader";
import { Point } from "../../geometry/Point";
import { Rectangle } from "../../geometry/Rectangle";
import { LoadingContext } from "../LoadingContext";
import { Optional } from "../../ts/ts-utils";
import { asInt32, Bool8, Int32, NullPointer, Percentage, PlayerId, Pointer, PrototypeId, TerrainId, UInt16, UInt8 } from "../Types";
import { SavingContext } from "../SavingContext";
import { Terrain } from "./Terrain";
import { getEntryOrLogWarning } from "../../util";
import { SceneryObjectPrototype } from "../object/SceneryObjectPrototype";
import { TextFileWriter } from "../../textfile/TextFileWriter";
import { TextFileNames } from "../../textfile/TextFile";

interface PreMapData {
    mapTypeId: Int32;
    border: Rectangle<Int32>;
    borderEdgeFade: Int32;
    waterShapeLandPlacementEdge: Int32;
    baseTerrain: TerrainId<Int32>;
    landCover: Int32;
    landId: Int32;
    baseLandDataEntryCount: Int32;
    baseLandDataPointer: Pointer;
    terrainDataEntryCount: Int32;
    terrainDataPointer: Pointer;
    objectDataEntryCount: Int32;
    objectDataPointer: Pointer;
    elevationDataEntryCount: Int32;
    elevationDataPointer: Pointer;
}

interface BaseLandData {
    baseLandId: Int32;
    terrain: Terrain | null;
    padding05: UInt8;
    padding06: UInt16;
    landSpacing: Int32;
    baseSize: Int32;
    zone: UInt8;
    placementType: UInt8;
    padding12: UInt16;
    origin: Point<Int32>;
    landProportion: Percentage<UInt8>;
    playerPlacement: UInt8;
    padding1E: UInt16;
    playerBaseRadius: Int32;
    edgeFade: Int32;
    clumpinessFactor: Int32;
}

interface TerrainPlacementData {
    coverageProportion: Percentage<Int32>;
    terrain: Terrain | null;
    clumpCount: Int32;
    terrainSpacing: Int32;
    replacedTerrain: Terrain | null;
    clumpinessFactor: Int32;
}

interface ObjectPlacementData {
    prototypeId: PrototypeId<Int32>;
    objectPrototype: SceneryObjectPrototype | null;
    placementTerrain: Terrain | null;
    groupMode: UInt8;
    scaleByMapSize: Bool8;
    padding0A: UInt16;
    objectsPerGroup: Int32;
    objectsPerGroupVariance: Int32;
    objectGroupsPerPlayer: Int32;
    objectGroupRadius: Int32;
    placementPlayerId: PlayerId<Int32>;
    placementBaseLandId: Int32;
    minDistanceToPlayers: Int32;
    maxDistanceToPlayers: Int32;
}

interface ElevationPlacementData {
    coverageProportion: Percentage<Int32>;
    elevationHeight: Int32;
    clumpinessFactor: Int32;
    elevationSpacing: Int32;
    placementTerrain: Terrain | null;
    placementElevation: Int32;
}

const internalFields: (keyof RandomMap)[] = [
    "preMapData",
    "baseLandDataPointer",
    "terrainDataPointer",
    "objectDataPointer",
    "elevationDataPointer"
]

export class RandomMap {
    mapTypeId: Int32 = asInt32(-1);
    preMapData: Omit<PreMapData, 'mapTypeId'> | null = null;
    border: Rectangle<Int32> = {
        left: asInt32(0),
        top: asInt32(0),
        right: asInt32(0),
        bottom: asInt32(0)
    };
    borderEdgeFade: Int32 = asInt32(0);
    waterShapeLandPlacementEdge: Int32 = asInt32(0);
    baseTerrain: TerrainId<Int32> = asInt32(0);
    landCover: Int32 = asInt32(0);
    landId: Int32 = asInt32(0);
    baseLandData: BaseLandData[] = [];
    terrainData: TerrainPlacementData[] = [];
    objectData: ObjectPlacementData[] = [];
    elevationData: ElevationPlacementData[] = [];
    
    baseLandDataPointer: Pointer = NullPointer;
    terrainDataPointer: Pointer = NullPointer;
    objectDataPointer: Pointer = NullPointer;
    elevationDataPointer: Pointer = NullPointer;

    readFromBuffer(buffer: BufferReader, terrains: (Terrain | null)[], loadingContext: LoadingContext, preMapData: PreMapData): void {
        this.mapTypeId = preMapData.mapTypeId;
        const copiedMapData: Optional<PreMapData, 'mapTypeId'> = { ...preMapData };
        delete copiedMapData.mapTypeId;
        this.preMapData = copiedMapData;
        this.border.left = buffer.readInt32();
        this.border.top = buffer.readInt32();
        this.border.right = buffer.readInt32();
        this.border.bottom = buffer.readInt32();
        this.borderEdgeFade = buffer.readInt32();
        this.waterShapeLandPlacementEdge = buffer.readInt32();
        this.baseTerrain = buffer.readInt32();
        this.landCover = buffer.readInt32();
        this.landId = buffer.readInt32();

        const baseLandEntryCount = buffer.readInt32();
        this.baseLandDataPointer = buffer.readPointer();
        this.baseLandData = [];
        for (let i = 0; i < baseLandEntryCount; ++i) {
            this.baseLandData.push({
                baseLandId: buffer.readInt32(),
                terrain: getEntryOrLogWarning(terrains, buffer.readUInt8(), "Terrain"),
                padding05: buffer.readUInt8(),
                padding06: buffer.readUInt16(),
                landSpacing: buffer.readInt32(),
                baseSize: buffer.readInt32(),
                zone: buffer.readUInt8(),
                placementType: buffer.readUInt8(),
                padding12: buffer.readUInt16(),
                origin: {
                    x: buffer.readInt32(),
                    y: buffer.readInt32()
                },
                landProportion: buffer.readUInt8(),
                playerPlacement: buffer.readUInt8(),
                padding1E: buffer.readUInt16(),
                playerBaseRadius: buffer.readInt32(),
                edgeFade: buffer.readInt32(),
                clumpinessFactor: buffer.readInt32()
            });
        }

        const terrainEntryCount = buffer.readInt32();
        this.terrainDataPointer = buffer.readPointer();
        this.terrainData = [];
        for (let i = 0; i < terrainEntryCount; ++i) {
            this.terrainData.push({
                coverageProportion: buffer.readInt32(),
                terrain: getEntryOrLogWarning(terrains, buffer.readInt32(), "Terrain"),
                clumpCount: buffer.readInt32(),
                terrainSpacing: buffer.readInt32(),
                replacedTerrain: getEntryOrLogWarning(terrains, buffer.readInt32(), "Terrain"),
                clumpinessFactor: buffer.readInt32()
            });
        }

        const objectEntryCount = buffer.readInt32();
        this.objectDataPointer = buffer.readPointer();
        this.objectData = [];
        for (let i = 0; i < objectEntryCount; ++i) {
            this.objectData.push({
              prototypeId: buffer.readInt32(),
              objectPrototype: null,
              placementTerrain: getEntryOrLogWarning(terrains, buffer.readInt32(), "Terrain"),
              groupMode: buffer.readUInt8(),
              scaleByMapSize: buffer.readBool8(),
              padding0A: buffer.readUInt16(),
              objectsPerGroup: buffer.readInt32(),
              objectsPerGroupVariance: buffer.readInt32(),
              objectGroupsPerPlayer: buffer.readInt32(),
              objectGroupRadius: buffer.readInt32(),
              placementPlayerId: buffer.readInt32(),
              placementBaseLandId: buffer.readInt32(),
              minDistanceToPlayers: buffer.readInt32(),
              maxDistanceToPlayers: buffer.readInt32()
            });
        }

        const elevationEntryCount = buffer.readInt32();
        this.elevationDataPointer = buffer.readPointer();
        this.elevationData = [];
        for (let i = 0; i < elevationEntryCount; ++i) {
            this.elevationData.push({
                coverageProportion: buffer.readInt32(),
                elevationHeight: buffer.readInt32(),
                clumpinessFactor: buffer.readInt32(),
                elevationSpacing: buffer.readInt32(),
                placementTerrain: getEntryOrLogWarning(terrains, buffer.readInt32(), "Terrain"),
                placementElevation: buffer.readInt32()
            });
        }

    }
    
    linkOtherData(objects: (SceneryObjectPrototype | null)[]) {
        this.objectData.forEach(object => {
            object.objectPrototype = getEntryOrLogWarning(objects, object.prototypeId, "ObjectPrototype");
        })
    }

    toString() {
        return JSON.stringify(this);
    }
}

export function readRandomMapData(randomMapCount: number, buffer: BufferReader, terrains: (Terrain | null)[], loadingContext: LoadingContext): RandomMap[] {
    const result: RandomMap[] = [];

    const preMapData: PreMapData[] = [];
    for (let i = 0; i < randomMapCount; ++i) {
        preMapData.push({
            mapTypeId: buffer.readInt32(),
            border: {
                left: buffer.readInt32(),
                top: buffer.readInt32(),
                right: buffer.readInt32(),
                bottom: buffer.readInt32()
            },
            borderEdgeFade: buffer.readInt32(),
            waterShapeLandPlacementEdge: buffer.readInt32(),
            baseTerrain: buffer.readInt32(),
            landCover: buffer.readInt32(),
            landId: buffer.readInt32(),
            baseLandDataEntryCount: buffer.readInt32(),
            baseLandDataPointer: buffer.readPointer(),
            terrainDataEntryCount: buffer.readInt32(),
            terrainDataPointer: buffer.readPointer(),
            objectDataEntryCount: buffer.readInt32(),
            objectDataPointer: buffer.readPointer(),
            elevationDataEntryCount: buffer.readInt32(),
            elevationDataPointer: buffer.readPointer()
        })
    }

    for (let i = 0; i < randomMapCount; ++i) {
        const randomMap = new RandomMap();
        randomMap.readFromBuffer(buffer, terrains, loadingContext, preMapData[i]);
        result.push(randomMap);
    }

    return result;
}

function writeRandomMapLandDataToWorldTextFile(randomMaps: RandomMap[], savingContext: SavingContext) {
    const textFileWriter = new TextFileWriter(TextFileNames.RandomMapDefinitons);
    textFileWriter.raw(randomMaps.length).eol(); // Total map entries

    for (let i = 0; i < randomMaps.length; ++i) {
        textFileWriter
            .integer(randomMaps[i].mapTypeId)
            .eol();
    }
    textFileWriter.close();
}

export function writeRandomMapsToWorldTextFile(randomMaps: RandomMap[], savingContext: SavingContext) {
    writeRandomMapLandDataToWorldTextFile(randomMaps, savingContext);
}