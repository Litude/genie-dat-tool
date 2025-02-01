import semver from "semver";
import BufferReader from "../../BufferReader";
import { Point } from "../../geometry/Point";
import { Rectangle } from "../../geometry/Rectangle";
import { LoadingContext } from "../LoadingContext";
import { Nullable, Optional } from "../../ts/ts-utils";
import { asInt16, asInt32, Bool8, Int16, Int32, NullPointer, Percentage, PlayerId, Pointer, PrototypeId, TerrainId, UInt16, UInt8 } from "../Types";
import { SavingContext } from "../SavingContext";
import { Terrain } from "./Terrain";
import { getDataEntry } from "../../util";
import { SceneryObjectPrototype } from "../object/SceneryObjectPrototype";
import { TextFileWriter } from "../../textfile/TextFileWriter";
import { TextFileNames } from "../../textfile/TextFile";
import path from "path";
import { JsonFieldConfig, writeDataEntriesToJson } from "../../json/json-serializer";
import { createReferenceString } from "../../json/filenames";

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
    terrainId: TerrainId<UInt8>;
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
    terrainId: TerrainId<Int32>;
    terrain: Terrain | null;
    clumpCount: Int32;
    terrainSpacing: Int32;
    replacedTerrainId: TerrainId<Int32>;
    replacedTerrain: Terrain | null;
    clumpinessFactor: Int32;
}

interface ObjectPlacementData {
    prototypeId: PrototypeId<Int32>;
    prototype: SceneryObjectPrototype | null;
    placementTerrainId: TerrainId<Int32>;
    placementTerrain: Terrain | null;
    groupMode: UInt8;
    scaleByMapSize: Bool8;
    padding0A: UInt16;
    objectsPerGroup: Int32;
    objectsPerGroupVariance: Int32;
    objectGroupsPerPlayer: Int32;
    objectGroupRadius: Int32;
    placementPlayerId: PlayerId<Int32>; // -1 means all players
    placementBaseLandId: Int32;
    minDistanceToPlayers: Int32;
    maxDistanceToPlayers: Int32;
}

interface ElevationPlacementData {
    coverageProportion: Percentage<Int32>;
    elevationHeight: Int32;
    clumpinessFactor: Int32;
    elevationSpacing: Int32;
    placementTerrainId: TerrainId<Int32>;
    placementTerrain: Terrain | null;
    placementElevation: Int32;
}

const internalFields: (keyof RandomMap)[] = [
    "preMapData",
    "baseLandDataPointer",
    "terrainDataPointer",
    "objectDataPointer",
    "elevationDataPointer"
];

const jsonFields: JsonFieldConfig<RandomMap>[] = [
    { key: "mapTypeId"},
    { key: "border" },
    { key: "borderEdgeFade" },
    { key: "waterShapeLandPlacementEdge" },
    { key: "baseTerrainId", transformTo: (obj) => createReferenceString("Terrain", obj.baseTerrain?.referenceId, obj.baseTerrainId) },
    { key: "landCover" },
    { key: "landId", flags: { unusedField: true } },
    { key: "baseLandData", transformTo: (obj, savingContext) => obj.baseLandData.map(baseLandEntry => ({
        baseLandId: baseLandEntry.baseLandId,
        terrainId: createReferenceString("Terrain", baseLandEntry.terrain?.referenceId, baseLandEntry.terrainId),
        landSpacing: baseLandEntry.landSpacing,
        baseSize: baseLandEntry.baseSize,
        zone: baseLandEntry.zone,
        placementType: baseLandEntry.placementType,
        origin: baseLandEntry.origin,
        landProportion: baseLandEntry.landProportion,
        playerPlacement: baseLandEntry.playerPlacement,
        playerBaseRadius: baseLandEntry.playerBaseRadius,
        edgeFade: baseLandEntry.edgeFade,
        clumpinessFactor: savingContext.internalFields ? baseLandEntry.clumpinessFactor : undefined,
    }))},
    { key: "terrainData", transformTo: (obj, savingContext) => obj.terrainData.map(terrainEntry => ({
        terrainId: createReferenceString("Terrain", terrainEntry.terrain?.referenceId, terrainEntry.terrainId),
        coverageProportion: terrainEntry.coverageProportion,
        clumpCount: terrainEntry.clumpCount,
        terrainSpacing: terrainEntry.terrainSpacing,
        replacedTerrainId: createReferenceString("Terrain", terrainEntry.replacedTerrain?.referenceId, terrainEntry.replacedTerrainId),
        clumpinessFactor: savingContext.internalFields ? terrainEntry.clumpinessFactor : undefined,
    }))},
    { key: "objectData", transformTo: (obj) => obj.objectData.map(objectEntry => ({
        prototypeId: createReferenceString("ObjectPrototype", objectEntry.prototype?.referenceId, objectEntry.prototypeId),
        placementTerrainId: createReferenceString("Terrain", objectEntry.placementTerrain?.referenceId, objectEntry.placementTerrainId),
        groupMode: objectEntry.groupMode,
        scaleByMapSize: objectEntry.scaleByMapSize,
        objectsPerGroup: objectEntry.objectsPerGroup,
        objectsPerGroupVariance: objectEntry.objectsPerGroupVariance,
        objectGroupsPerPlayer: objectEntry.objectGroupsPerPlayer,
        objectGroupRadius: objectEntry.objectGroupRadius,
        placementPlayerId: objectEntry.placementPlayerId,
        placementBaseLandId: objectEntry.placementBaseLandId,
        minDistanceToPlayers: objectEntry.minDistanceToPlayers,
        maxDistanceToPlayers: objectEntry.maxDistanceToPlayers,
    }))},
    { key: "elevationData", flags: { unusedField: true }, transformTo: (obj, savingContext) => obj.elevationData.map(elevationEntry => ({
        elevationHeight: elevationEntry.elevationHeight,
        coverageProportion: elevationEntry.coverageProportion,
        elevationSpacing: elevationEntry.elevationSpacing,
        placementTerrain: createReferenceString("Terrain", elevationEntry.placementTerrain?.referenceId, elevationEntry.placementTerrainId),
        placementElevation: elevationEntry.placementElevation,
        clumpinessFactor: savingContext.internalFields ? elevationEntry.clumpinessFactor : undefined,
    }))}
];

export class RandomMap {
    id: Int16 = asInt16(-1);
    referenceId: string = "";
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
    baseTerrainId: TerrainId<Int32> = asInt32(0);
    baseTerrain: Terrain | null = null;
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

    readFromBuffer(buffer: BufferReader, id: Int16, terrains: Nullable<Terrain>[], loadingContext: LoadingContext, preMapData: PreMapData): void {
        this.id = id;
        this.referenceId = `RandomMap_${this.id}`;
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
        this.baseTerrainId = buffer.readInt32();
        this.baseTerrain = getDataEntry(terrains, this.baseTerrainId, "Terrain", this.referenceId, loadingContext);
        this.landCover = buffer.readInt32();
        this.landId = buffer.readInt32();

        const baseLandEntryCount = buffer.readInt32();
        this.baseLandDataPointer = buffer.readPointer();
        this.baseLandData = [];
        for (let i = 0; i < baseLandEntryCount; ++i) {
            const landEntry: BaseLandData = {
                baseLandId: buffer.readInt32(),
                terrainId: buffer.readUInt8(),
                terrain: null,
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
            };
            landEntry.terrain = getDataEntry(terrains, landEntry.terrainId, "Terrain", this.referenceId, loadingContext);
            this.baseLandData.push(landEntry);
        }

        const terrainEntryCount = buffer.readInt32();
        this.terrainDataPointer = buffer.readPointer();
        this.terrainData = [];
        for (let i = 0; i < terrainEntryCount; ++i) {
            const terrainDataEntry: TerrainPlacementData = {
                coverageProportion: buffer.readInt32(),
                terrainId: buffer.readInt32(),
                terrain: null,
                clumpCount: buffer.readInt32(),
                terrainSpacing: buffer.readInt32(),
                replacedTerrainId: buffer.readInt32(),
                replacedTerrain: null,
                clumpinessFactor: buffer.readInt32()
            }
            terrainDataEntry.terrain = getDataEntry(terrains, terrainDataEntry.terrainId, "Terrain", this.referenceId, loadingContext),
            terrainDataEntry.replacedTerrain = getDataEntry(terrains, terrainDataEntry.replacedTerrainId, "Terrain", this.referenceId, loadingContext),
            this.terrainData.push(terrainDataEntry);
        }

        const objectEntryCount = buffer.readInt32();
        this.objectDataPointer = buffer.readPointer();
        this.objectData = [];
        for (let i = 0; i < objectEntryCount; ++i) {
            const objectData: ObjectPlacementData = {
                prototypeId: buffer.readInt32(),
                prototype: null,
                placementTerrainId: buffer.readInt32(),
                placementTerrain: null,
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
            };
            objectData.placementTerrain = getDataEntry(terrains, objectData.placementTerrainId, "Terrain", this.referenceId, loadingContext);
            this.objectData.push(objectData);
        }

        const elevationEntryCount = buffer.readInt32();
        this.elevationDataPointer = buffer.readPointer();
        this.elevationData = [];
        for (let i = 0; i < elevationEntryCount; ++i) {
            const elevationData: ElevationPlacementData = {
                coverageProportion: buffer.readInt32(),
                elevationHeight: buffer.readInt32(),
                clumpinessFactor: buffer.readInt32(),
                elevationSpacing: buffer.readInt32(),
                placementTerrainId: buffer.readInt32(),
                placementTerrain: null,
                placementElevation: buffer.readInt32()
            }
            elevationData.placementTerrain = getDataEntry(terrains, elevationData.placementTerrainId, "Terrain", this.referenceId, loadingContext);
            this.elevationData.push(elevationData);
        }

    }
    
    linkOtherData(objects: (SceneryObjectPrototype | null)[], loadingContext: LoadingContext) {
        this.objectData.forEach(object => {
            object.prototype = getDataEntry(objects, object.prototypeId, "ObjectPrototype", this.referenceId, loadingContext);
        })
    }

    toString() {
        return JSON.stringify(this);
    }
}

export function readRandomMapData(randomMapCount: number, buffer: BufferReader, terrains: (Terrain | null)[], loadingContext: LoadingContext): RandomMap[] {
    const result: RandomMap[] = [];
    if (semver.gte(loadingContext.version.numbering, "2.0.0")) {
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
            randomMap.readFromBuffer(buffer, asInt16(i), terrains, loadingContext, preMapData[i]);
            result.push(randomMap);
        }
    }

    return result;
}

function writeRandomMapDefinitionsToWorldTextFile(outputDirectory: string, randomMaps: RandomMap[], savingContext: SavingContext) {
    const textFileWriter = new TextFileWriter(path.join(outputDirectory, TextFileNames.RandomMapDefinitons));
    textFileWriter.raw(randomMaps.length).eol(); // Total map entries

    for (let i = 0; i < randomMaps.length; ++i) {
        textFileWriter
            .integer(randomMaps[i].mapTypeId)
            .eol();
    }
    textFileWriter.close();
}

function writeRandomMapBaseLandDataToWorldTextFile(outputDirectory: string, randomMaps: RandomMap[], savingContext: SavingContext) {
    const textFileWriter = new TextFileWriter(path.join(outputDirectory, TextFileNames.RandomMapBaseLands));
    textFileWriter.raw(randomMaps.length).eol(); // Total map entries

    for (let i = 0; i < randomMaps.length; ++i) {
        const randomMap = randomMaps[i];
        textFileWriter 
            .integer(i)
            .integer(randomMap.baseLandData.length)
            .integer(randomMap.border.left)
            .integer(randomMap.border.top)
            .integer(randomMap.border.right)
            .integer(randomMap.border.bottom)
            .integer(randomMap.borderEdgeFade)
            .integer(randomMap.waterShapeLandPlacementEdge)
            .integer(randomMap.baseTerrainId)
            .integer(randomMap.landCover)
            .eol()

        for (let j = 0; j < randomMap.baseLandData.length; ++j) {
            const baseLandData = randomMap.baseLandData[j];
            textFileWriter.indent(2)
                .integer(baseLandData.baseLandId)
                .integer(baseLandData.terrainId)
                .integer(baseLandData.landSpacing)
                .integer(baseLandData.baseSize)
                .integer(baseLandData.zone)
                .integer(baseLandData.placementType)
                .integer(baseLandData.origin.x)
                .integer(baseLandData.origin.y)
                .integer(baseLandData.landProportion)
                .integer(baseLandData.playerPlacement)
                .integer(baseLandData.playerBaseRadius)
                .integer(baseLandData.edgeFade)
                .eol();
        }
    }
    textFileWriter.close();
}

function writeRandomMapTerrainPlacementDataToWorldTextFile(outputDirectory: string, randomMaps: RandomMap[], savingContext: SavingContext) {
    const textFileWriter = new TextFileWriter(path.join(outputDirectory, TextFileNames.RandomMapTerrains));
    textFileWriter.raw(randomMaps.length).eol(); // Total map entries

    for (let i = 0; i < randomMaps.length; ++i) {
        const randomMap = randomMaps[i];
        textFileWriter 
            .integer(i)
            .integer(randomMap.terrainData.length)
            .eol()

        for (let j = 0; j < randomMap.terrainData.length; ++j) {
            const terrainData = randomMap.terrainData[j];
            textFileWriter.indent(2)
                .integer(terrainData.coverageProportion)
                .integer(terrainData.terrainId)
                .integer(terrainData.clumpCount)
                .integer(terrainData.terrainSpacing)
                .integer(terrainData.replacedTerrainId)
                .eol();
        }
    }
    textFileWriter.close();
}

function writeRandomMapObjectPlacementDataToWorldTextFile(outputDirectory: string, randomMaps: RandomMap[], savingContext: SavingContext) {
    const textFileWriter = new TextFileWriter(path.join(outputDirectory, TextFileNames.RandomMapObjects));
    textFileWriter.raw(randomMaps.length).eol(); // Total map entries

    for (let i = 0; i < randomMaps.length; ++i) {
        const randomMap = randomMaps[i];
        textFileWriter 
            .integer(i)
            .integer(randomMap.objectData.length)
            .eol()

        for (let j = 0; j < randomMap.objectData.length; ++j) {
            const objectData = randomMap.objectData[j];
            textFileWriter.indent(2)
                .integer(objectData.prototypeId)
                .integer(objectData.placementTerrainId)
                .integer(objectData.groupMode)
                .integer(objectData.scaleByMapSize ? 1 : 0)
                .integer(objectData.objectsPerGroup)
                .integer(objectData.objectsPerGroupVariance)
                .integer(objectData.objectGroupsPerPlayer)
                .integer(objectData.objectGroupRadius)
                .integer(objectData.placementPlayerId)
                .integer(objectData.placementBaseLandId)
                .integer(objectData.minDistanceToPlayers)
                .integer(objectData.maxDistanceToPlayers)
                .eol();
        }
    }
    textFileWriter.close();
}

export function writeRandomMapsToWorldTextFile(outputDirectory: string, randomMaps: RandomMap[], savingContext: SavingContext) {
    writeRandomMapDefinitionsToWorldTextFile(outputDirectory, randomMaps, savingContext);
    writeRandomMapBaseLandDataToWorldTextFile(outputDirectory, randomMaps, savingContext);
    writeRandomMapTerrainPlacementDataToWorldTextFile(outputDirectory, randomMaps, savingContext);
    writeRandomMapObjectPlacementDataToWorldTextFile(outputDirectory, randomMaps, savingContext);
}

export function writeRandomMapsToJsonFiles(outputDirectory: string, randomMaps: RandomMap[], savingContext: SavingContext) {
    if (semver.gte(savingContext.version.numbering, "2.0.0")) {
        writeDataEntriesToJson(outputDirectory, "randommaps", randomMaps, jsonFields, savingContext);
    }
}
