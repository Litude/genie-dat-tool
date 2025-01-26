import semver from 'semver';
import BufferReader from "../../BufferReader";
import { TextFileNames } from "../../textfile/TextFile";
import { TextFileWriter } from "../../textfile/TextFileWriter";
import { LoadingContext } from "../LoadingContext";
import { SavingContext } from "../SavingContext";
import { asBool32, asInt16, asInt32, Bool32, BorderId, Int16, Int32, PrototypeId, TerrainId } from "../Types";
import { Border } from "./Border";
import { Terrain } from "./Terrain";

interface TerrainPlacementData {
    unusedTerrainId: TerrainId<Int32>; // Seems this is some field that was skipped when the text file was parsed by the game and is thus not included in the DAT file data
    terrainId: TerrainId<Int32>;
    placementType: Int32;
    density: Int32;
    borderId: BorderId<Int32>;
    borderingType: TerrainId<Int32>;
    secondaryBorderId: BorderId<Int32>;
    terrainTypeSpecialAlt: TerrainId<Int32>;
    borderTypeDistant: BorderId<Int32>;
    defaultElevation: Int32;
    avoidedTerrainId: TerrainId<Int32>;
    windyAvoidingType: TerrainId<Int32>;
    windyBorderId: BorderId<Int32>;
}

interface ObjectPlacementData {
    prototypeId: PrototypeId<Int32>;
    placementType: Int32;
    placementCount: Int32;
    placementSpread: Int32;
    objectsPerGroupMax: Int32;
    objectGroupsPerPlayer: Int32; // TODO: Was this per player...?
    placementTerrain1: TerrainId<Int32>;
    placementTerrain2: TerrainId<Int32>;
    placementTerrain3: TerrainId<Int32>;
    borderingTerrain: TerrainId<Int32>;
}

export class TribeRandomMap {
    id: Int16 = asInt16(-1);
    internalName: string = "";
    primaryTerrainId: TerrainId<Int32> = asInt32(-1); // TODO: this is really more like primary?
    secondaryTerrainId: TerrainId<Int32> = asInt32(-1);
    startingAvoidingTerrainId: TerrainId<Int32> = asInt32(-1);
    radiusBetweenPlayers: Int32 = asInt32(0);
    terrainPlacements: TerrainPlacementData[] = [];
    objectPlacements: ObjectPlacementData[] = [];
    distance: Int32 = asInt32(0);
    distanceBetweenPlayers: Int32 = asInt32(0);
    boolField: Bool32 = asBool32(false);
    minimumClearingCount: Int32 = asInt32(0);
    randomizeStartingLocations: Bool32 = asBool32(false);
    startingLocationDistributionType: Int32 = asInt32(0);
    
    readFromBuffer(buffer: BufferReader, id: Int16, terrains: (Terrain | null)[], borders: (Border | null)[], loadingContext: LoadingContext): void {
        this.id = id;
        this.internalName = `Map ${id + 1}`;
        this.primaryTerrainId = buffer.readInt32();
        this.secondaryTerrainId = buffer.readInt32();
        this.startingAvoidingTerrainId = buffer.readInt32();
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
                terrainId: buffer.readInt32(),
                placementType: buffer.readInt32(),
                density: buffer.readInt32(),
                borderId: buffer.readInt32(),
                borderingType: buffer.readInt32(),
                secondaryBorderId: buffer.readInt32(),
                terrainTypeSpecialAlt: buffer.readInt32(),
                borderTypeDistant: buffer.readInt32(),
                defaultElevation: buffer.readInt32(),
                avoidedTerrainId: buffer.readInt32(),
                windyAvoidingType: buffer.readInt32(),
                windyBorderId: buffer.readInt32()
            });
        }
        for (let i = 0; i < 60; ++i) {
            this.objectPlacements.push({
                prototypeId: buffer.readInt32(),
                placementType: buffer.readInt32(),
                placementCount: buffer.readInt32(),
                placementSpread: buffer.readInt32(),
                objectsPerGroupMax: buffer.readInt32(),
                objectGroupsPerPlayer: buffer.readInt32(),
                placementTerrain1: buffer.readInt32(),
                placementTerrain2: buffer.readInt32(),
                placementTerrain3: buffer.readInt32(),
                borderingTerrain: buffer.readInt32()
            });
        }

        this.terrainPlacements = this.terrainPlacements.slice(0, terrainPlacementEntries);
        this.objectPlacements = this.objectPlacements.slice(0, objectPlacementEntries);
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


export function writeTribeRandomMapsToWorldTextFile(maps: TribeRandomMap[], savingContext: SavingContext) {
    const textFileWriter = new TextFileWriter(TextFileNames.TribeRandomMaps);
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
                .integer(terrainPlacement.borderId)
                .integer(terrainPlacement.borderingType)
                .integer(terrainPlacement.secondaryBorderId)
                .integer(terrainPlacement.terrainTypeSpecialAlt)
                .integer(terrainPlacement.borderTypeDistant)
                .integer(terrainPlacement.defaultElevation)
                .integer(terrainPlacement.avoidedTerrainId)
                .integer(terrainPlacement.windyAvoidingType)
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
                .integer(objectPlacement.objectGroupsPerPlayer)
                .integer(objectPlacement.placementTerrain1)
                .integer(objectPlacement.placementTerrain2)
                .integer(objectPlacement.placementTerrain3)
                .integer(objectPlacement.borderingTerrain)
                .eol()
        });
    })

    textFileWriter.close();
}
