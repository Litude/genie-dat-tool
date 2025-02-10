import semver from 'semver';
import BufferReader from "../../BufferReader";
import { TextFileNames } from "../../textfile/TextFile";
import { TextFileWriter } from "../../textfile/TextFileWriter";
import { LoadingContext } from "../LoadingContext";
import { SavingContext } from "../SavingContext";
import { BorderId, PrototypeId, TerrainId } from "../Types";
import { asBool32, asInt16, asInt32, Bool32, Int16, Int32 } from "../../ts/base-types";
import { Border } from "./Border";
import { Terrain } from "./Terrain";
import path from 'path';
import { OldJsonFieldConfig, oldWriteDataEntriesToJson } from '../../json/json-serialization';
import { createReferenceIdFromString, createReferenceString } from '../../json/reference-id';
import { SceneryObjectPrototype } from '../object/SceneryObjectPrototype';
import { Nullable } from '../../ts/ts-utils';
import { getDataEntry } from '../../util';

interface TerrainPlacementData {
    unusedTerrainId: TerrainId<Int32>; // Seems this is some field that was skipped when the text file was parsed by the game and is thus not included in the DAT file data
    unusedTerrain: Terrain | null;
    terrainId: TerrainId<Int32>;
    terrain: Terrain | null;
    placementType: Int32;
    density: Int32;
    primaryBorderingTerrainId: TerrainId<Int32>;
    primaryBorderingTerrain: Terrain | null;
    secondaryBorderingTerrainId: TerrainId<Int32>;
    secondaryBorderingTerrain: Terrain | null;
    secondaryBorderId: TerrainId<Int32>; // TODO: This is probably also a terrain...
    secondaryBorder: Terrain | null; // TODO: This is probably also a terrain...
    specialAltTerrainId: TerrainId<Int32>;
    specialAltTerrain: Terrain | null;
    distantBorderId: BorderId<Int32>;
    distantBorder: Border | null;
    defaultElevation: Int32;
    avoidedTerrainId: TerrainId<Int32>;
    avoidedTerrain: Terrain | null;
    windyAvoidingTerrainId: TerrainId<Int32>;
    windyAvoidingTerrain: Terrain | null;
    windyBorderId: BorderId<Int32>;
    windyBorder: Border | null;
}

interface ObjectPlacementData {
    prototypeId: PrototypeId<Int32>;
    prototype: SceneryObjectPrototype | null;
    placementType: Int32;
    placementCount: Int32;
    placementSpread: Int32;
    objectsPerGroupMax: Int32;
    objectGroups: Int32;
    placementTerrainId1: TerrainId<Int32>;
    placementTerrainId2: TerrainId<Int32>;
    placementTerrainId3: TerrainId<Int32>;
    placementTerrain1: Terrain | null;
    placementTerrain2: Terrain | null;
    placementTerrain3: Terrain | null;
    borderingTerrainId: TerrainId<Int32>;
    borderingTerrain: Terrain | null;
}

const jsonFields: OldJsonFieldConfig<TribeRandomMap>[] = [
    { field: "internalName", flags: { unusedField: true } },
    { field: "primaryTerrainId", toJson: (obj) => createReferenceString("Terrain", obj.primaryTerrain?.referenceId, obj.primaryTerrainId) },
    { field: "secondaryTerrainId", toJson: (obj) => createReferenceString("Terrain", obj.secondaryTerrain?.referenceId, obj.secondaryTerrainId) },
    { field: "startingAvoidingTerrainId", toJson: (obj) => createReferenceString("Terrain", obj.startingAvoidingTerrain?.referenceId, obj.startingAvoidingTerrainId) },
    { field: "radiusBetweenPlayers" },
    { field: "terrainPlacements", toJson: (obj, savingContext) => obj.terrainPlacements.map(terrainPlacement => ({
        unusedTerrainId: savingContext.excludeUnused ? undefined : createReferenceString("Terrain", terrainPlacement.unusedTerrain?.referenceId, terrainPlacement.unusedTerrainId),
        terrainId: createReferenceString("Terrain", terrainPlacement.terrain?.referenceId, terrainPlacement.terrainId),
        placementType: terrainPlacement.placementType,
        density: terrainPlacement.density,
        primaryBorderingTerrainId: createReferenceString("Terrain", terrainPlacement.primaryBorderingTerrain?.referenceId, terrainPlacement.primaryBorderingTerrainId),
        secondaryBorderingTerrainId: createReferenceString("Terrain", terrainPlacement.secondaryBorderingTerrain?.referenceId, terrainPlacement.secondaryBorderingTerrainId),
        secondaryBorderId: createReferenceString("Border", terrainPlacement.secondaryBorder?.referenceId, terrainPlacement.secondaryBorderId),
        specialAltTerrainId: createReferenceString("Terrain", terrainPlacement.specialAltTerrain?.referenceId, terrainPlacement.specialAltTerrainId),
        distantBorderId: createReferenceString("Border", terrainPlacement.distantBorder?.referenceId, terrainPlacement.distantBorderId),
        avoidedTerrainId: createReferenceString("Terrain", terrainPlacement.avoidedTerrain?.referenceId, terrainPlacement.avoidedTerrainId),
        windyAvoidingTerrainId: createReferenceString("Terrain", terrainPlacement.windyAvoidingTerrain?.referenceId, terrainPlacement.windyAvoidingTerrainId),
        windyBorderId: createReferenceString("Border", terrainPlacement.windyBorder?.referenceId, terrainPlacement.windyBorderId),
    }))},
    { field: "objectPlacements", toJson: (obj) => obj.objectPlacements.map(objectPlacement => ({
        prototypeId: createReferenceString("ObjectPrototype", objectPlacement.prototype?.referenceId, objectPlacement.prototypeId),
        placementType: objectPlacement.placementType,
        placementCount: objectPlacement.placementCount,
        placementSpread: objectPlacement.placementSpread,
        objectsPerGroupMax: objectPlacement.objectsPerGroupMax,
        objectGroups: objectPlacement.objectGroups,
        placementTerrainId1: createReferenceString("Terrain", objectPlacement.placementTerrain1?.referenceId, objectPlacement.placementTerrainId1),
        placementTerrainId2: createReferenceString("Terrain", objectPlacement.placementTerrain2?.referenceId, objectPlacement.placementTerrainId2),
        placementTerrainId3: createReferenceString("Terrain", objectPlacement.placementTerrain3?.referenceId, objectPlacement.placementTerrainId3),
        borderingTerrainId: createReferenceString("Border", objectPlacement.borderingTerrain?.referenceId, objectPlacement.borderingTerrainId),
    }))},
    { field: "distance" },
    { field: "distanceBetweenPlayers" },
    { field: "boolField" },
    { field: "minimumClearingCount" },
    { field: "randomizeStartingLocations" },
    { field: "startingLocationDistributionType" },
]


export class TribeRandomMap {
    referenceId: string = "";
    id: Int16 = asInt16(-1);
    internalName: string = "";
    primaryTerrainId: TerrainId<Int32> = asInt32(-1);
    primaryTerrain: Terrain | null = null;
    secondaryTerrainId: TerrainId<Int32> = asInt32(-1);
    secondaryTerrain: Terrain | null = null;
    startingAvoidingTerrainId: TerrainId<Int32> = asInt32(-1);
    startingAvoidingTerrain: Terrain | null = null;
    radiusBetweenPlayers: Int32 = asInt32(0);
    terrainPlacements: TerrainPlacementData[] = [];
    objectPlacements: ObjectPlacementData[] = [];
    distance: Int32 = asInt32(0);
    distanceBetweenPlayers: Int32 = asInt32(0);
    boolField: Bool32 = asBool32(false);
    minimumClearingCount: Int32 = asInt32(0);
    randomizeStartingLocations: Bool32 = asBool32(false);
    startingLocationDistributionType: Int32 = asInt32(0);
    
    readFromBuffer(buffer: BufferReader, id: Int16, terrains: Nullable<Terrain>[], borders: Nullable<Border>[], loadingContext: LoadingContext): void {
        this.id = id;
        this.internalName = `Map ${id + 1}`;
        this.referenceId = createReferenceIdFromString(this.internalName);
        this.primaryTerrainId = buffer.readInt32();
        this.primaryTerrain = getDataEntry(terrains, this.primaryTerrainId, "Terrain", this.referenceId, loadingContext);
        this.secondaryTerrainId = buffer.readInt32();
        this.secondaryTerrain = getDataEntry(terrains, this.secondaryTerrainId, "Terrain", this.referenceId, loadingContext);
        this.startingAvoidingTerrainId = buffer.readInt32();
        this.startingAvoidingTerrain = getDataEntry(terrains, this.startingAvoidingTerrainId, "Terrain", this.referenceId, loadingContext);
        this.radiusBetweenPlayers = buffer.readInt32();

        const terrainPlacementEntries = buffer.readInt32();
        const objectPlacementEntries = buffer.readInt32();

        this.distance = buffer.readInt32();
        this.distanceBetweenPlayers = buffer.readInt32();
        this.boolField = buffer.readBool32();
        this.minimumClearingCount = buffer.readInt32();
        this.randomizeStartingLocations = buffer.readBool32();
        this.startingLocationDistributionType = buffer.readInt32();

        this.terrainPlacements = [];
        for (let i = 0; i < 20; ++i) {
            this.terrainPlacements.push({
                unusedTerrainId: asInt32(-1),
                unusedTerrain: null,
                terrainId: buffer.readInt32(),
                terrain: null,
                placementType: buffer.readInt32(),
                density: buffer.readInt32(),
                primaryBorderingTerrainId: buffer.readInt32(),
                primaryBorderingTerrain: null,
                secondaryBorderingTerrainId: buffer.readInt32(),
                secondaryBorderingTerrain: null,
                secondaryBorderId: buffer.readInt32(),
                secondaryBorder: null,
                specialAltTerrainId: buffer.readInt32(),
                specialAltTerrain: null,
                distantBorderId: buffer.readInt32(),
                distantBorder: null,
                defaultElevation: buffer.readInt32(),
                avoidedTerrainId: buffer.readInt32(),
                avoidedTerrain: null,
                windyAvoidingTerrainId: buffer.readInt32(),
                windyAvoidingTerrain: null,
                windyBorderId: buffer.readInt32(),
                windyBorder: null,
            });
        }
        for (let i = 0; i < 60; ++i) {
            this.objectPlacements.push({
                prototypeId: buffer.readInt32(),
                prototype: null,
                placementType: buffer.readInt32(),
                placementCount: buffer.readInt32(),
                placementSpread: buffer.readInt32(),
                objectsPerGroupMax: buffer.readInt32(),
                objectGroups: buffer.readInt32(),
                placementTerrainId1: buffer.readInt32(),
                placementTerrainId2: buffer.readInt32(),
                placementTerrainId3: buffer.readInt32(),
                placementTerrain1: null,
                placementTerrain2: null,
                placementTerrain3: null,
                borderingTerrainId: buffer.readInt32(),
                borderingTerrain: null,
            });
        }

        this.terrainPlacements = this.terrainPlacements.slice(0, terrainPlacementEntries);
        this.objectPlacements = this.objectPlacements.slice(0, objectPlacementEntries);
        
        // Make sure all non-valid data has been cleaned before linking these
        this.terrainPlacements.forEach(terrainPlacement => {
            terrainPlacement.unusedTerrain = getDataEntry(terrains, terrainPlacement.unusedTerrainId, "Terrain", this.referenceId, loadingContext);
            terrainPlacement.terrain = getDataEntry(terrains, terrainPlacement.terrainId, "Terrain", this.referenceId, loadingContext);
            terrainPlacement.secondaryBorderingTerrain = getDataEntry(terrains, terrainPlacement.secondaryBorderingTerrainId, "Terrain", this.referenceId, loadingContext);
            terrainPlacement.specialAltTerrain = getDataEntry(terrains, terrainPlacement.specialAltTerrainId, "Terrain", this.referenceId, loadingContext);
            terrainPlacement.avoidedTerrain = getDataEntry(terrains, terrainPlacement.avoidedTerrainId, "Terrain", this.referenceId, loadingContext);
            terrainPlacement.windyAvoidingTerrain = getDataEntry(terrains, terrainPlacement.windyAvoidingTerrainId, "Terrain", this.referenceId, loadingContext);
            
            terrainPlacement.primaryBorderingTerrain = getDataEntry(terrains, terrainPlacement.primaryBorderingTerrainId, "Terrain", this.referenceId, loadingContext);
            terrainPlacement.secondaryBorder = getDataEntry(terrains, terrainPlacement.secondaryBorderId, "Terrain", this.referenceId, loadingContext);
            terrainPlacement.distantBorder = getDataEntry(borders, terrainPlacement.distantBorderId, "Border", this.referenceId, loadingContext);
            terrainPlacement.windyBorder = getDataEntry(borders, terrainPlacement.windyBorderId, "Border", this.referenceId, loadingContext);
        });

        this.objectPlacements.forEach(objectPlacement => {
            objectPlacement.placementTerrain1 = getDataEntry(terrains, objectPlacement.placementTerrainId1, "Terrain", this.referenceId, loadingContext);
            objectPlacement.placementTerrain2 = getDataEntry(terrains, objectPlacement.placementTerrainId2, "Terrain", this.referenceId, loadingContext);
            objectPlacement.placementTerrain3 = getDataEntry(terrains, objectPlacement.placementTerrainId3, "Terrain", this.referenceId, loadingContext);
            objectPlacement.borderingTerrain = getDataEntry(terrains, objectPlacement.borderingTerrainId, "Terrain", this.referenceId, loadingContext);
        });
    }

    linkOtherData(objects: Nullable<SceneryObjectPrototype>[], loadingContext: LoadingContext) {
        this.objectPlacements.forEach(objectPlacement => {
            objectPlacement.prototype = getDataEntry(objects, objectPlacement.prototypeId, "ObjectPrototype", this.referenceId, loadingContext);
        });
    }
    
}


export function readTribeRandomMapData(randomMapCount: number, buffer: BufferReader, terrains: (Terrain | null)[], borders: (Border | null)[], loadingContext: LoadingContext): TribeRandomMap[] {
    const result: TribeRandomMap[] = [];
    if (semver.lt(loadingContext.version.numbering, "2.0.0")) {
        for (let i = 0; i < randomMapCount; ++i) {
            const randomMap = new TribeRandomMap();
            randomMap.readFromBuffer(buffer, asInt16(i), terrains, borders, loadingContext);
            result.push(randomMap);
        }
    }
    return result;
}


export function writeTribeRandomMapsToWorldTextFile(outputDirectory: string, maps: TribeRandomMap[], savingContext: SavingContext) {
    const textFileWriter = new TextFileWriter(path.join(outputDirectory, TextFileNames.TribeRandomMaps));
    textFileWriter.raw(maps.length).eol();
    maps.forEach(map => {
        textFileWriter
            .string(map.internalName.replaceAll(' ', '_'), 17)
            .integer(map.primaryTerrainId)
            .integer(map.secondaryTerrainId)
            .integer(map.startingAvoidingTerrainId)
            .integer(map.radiusBetweenPlayers)
            .integer(map.distance)
            .integer(map.distanceBetweenPlayers)
            .integer(map.boolField ? 1 : 0)
            .integer(map.minimumClearingCount)
            .integer(map.randomizeStartingLocations ? 1 : 0)
            .integer(map.startingLocationDistributionType)
            .eol();

        textFileWriter
            .integer(map.terrainPlacements.length)
            .eol()
            .integer(map.objectPlacements.length)
            .eol();

        map.terrainPlacements.forEach(terrainPlacement => {
            textFileWriter
                .indent(3)
                .integer(terrainPlacement.unusedTerrainId)
                .integer(terrainPlacement.placementType)
                .integer(terrainPlacement.terrainId)
                .integer(terrainPlacement.density)
                .integer(terrainPlacement.primaryBorderingTerrainId)
                .integer(terrainPlacement.secondaryBorderingTerrainId)
                .integer(terrainPlacement.secondaryBorderId)
                .integer(terrainPlacement.specialAltTerrainId)
                .integer(terrainPlacement.distantBorderId)
                .integer(terrainPlacement.defaultElevation)
                .integer(terrainPlacement.avoidedTerrainId)
                .integer(terrainPlacement.windyAvoidingTerrainId)
                .integer(terrainPlacement.windyBorderId)
                .eol();
        });

        map.objectPlacements.forEach(objectPlacement => {
            textFileWriter
                .indent(3)
                .integer(objectPlacement.placementType)
                .integer(objectPlacement.prototypeId)
                .integer(objectPlacement.placementCount)
                .integer(objectPlacement.placementSpread)
                .integer(objectPlacement.objectsPerGroupMax)
                .integer(objectPlacement.objectGroups)
                .integer(objectPlacement.placementTerrainId1)
                .integer(objectPlacement.placementTerrainId2)
                .integer(objectPlacement.placementTerrainId3)
                .integer(objectPlacement.borderingTerrainId)
                .eol()
        });
    })

    textFileWriter.close();
}

export function writeTribeRandomMapsToJsonFiles(outputDirectory: string, maps: Nullable<TribeRandomMap>[], savingContext: SavingContext) {
    if (semver.lt(savingContext.version.numbering, "2.0.0")) {
        oldWriteDataEntriesToJson(outputDirectory, "tribemaps", maps, jsonFields, savingContext);
    }
}
