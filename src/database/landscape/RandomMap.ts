import JSON5 from "json5";
import semver from "semver";
import BufferReader from "../../BufferReader";
import { Point, PointSchema } from "../../geometry/Point";
import { Rectangle, RectangleSchema } from "../../geometry/Rectangle";
import { JsonLoadingContext, LoadingContext } from "../LoadingContext";
import { Nullable, Optional } from "../../ts/ts-utils";
import {
  PlayerId,
  PrototypeId,
  ReferenceStringSchema,
  TerrainId,
} from "../Types";
import {
  asInt16,
  asInt32,
  asUInt16,
  asUInt8,
  Bool8,
  Bool8Schema,
  Int16,
  Int32,
  Int32Schema,
  NullPointer,
  Percentage,
  PercentageSchema,
  Pointer,
  UInt16,
  UInt8,
  UInt8Schema,
} from "../../ts/base-types";
import { SavingContext } from "../SavingContext";
import { Terrain } from "./Terrain";
import { getDataEntry } from "../../util";
import { SceneryObjectPrototype } from "../object/SceneryObjectPrototype";
import { TextFileWriter } from "../../textfile/TextFileWriter";
import { TextFileNames } from "../../textfile/TextFile";
import path from "path";
import {
  applyJsonFieldsToObject,
  createJson,
  JsonFieldMapping,
  readJsonFileIndex,
  transformJsonToObject,
  transformObjectToJson,
  writeDataEntriesToJson,
} from "../../json/json-serialization";
import {
  createReferenceIdFromString,
  createReferenceString,
  getIdFromReferenceString,
} from "../../json/reference-id";
import { z } from "zod";
import { readFileSync, writeFileSync } from "fs";

interface PreMapData {
  mapTypeId: Int32;
  border: Rectangle<Int32>;
  borderEdgeFade: Int32;
  waterShapeLandPlacementEdge: Int32;
  baseTerrainId: TerrainId<Int32>;
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
const BaseLandDataSchema = z.object({
  baseLandId: Int32Schema,
  terrainId: ReferenceStringSchema,
  landSpacing: Int32Schema,
  baseSize: Int32Schema,
  zone: UInt8Schema,
  placementType: UInt8Schema,
  origin: PointSchema(Int32Schema),
  landProportion: PercentageSchema(UInt8Schema),
  playerPlacement: UInt8Schema,
  playerBaseRadius: Int32Schema,
  edgeFade: Int32Schema,
  clumpinessFactor: Int32Schema.optional(),
});
type BaseLandDataJson = z.infer<typeof BaseLandDataSchema>;
const BaseLandDataJsonMapping: JsonFieldMapping<
  BaseLandData,
  BaseLandDataJson
>[] = [
  { field: "baseLandId" },
  {
    jsonField: "terrainId",
    toJson: (obj) =>
      createReferenceString("Terrain", obj.terrain?.referenceId, obj.terrainId),
  },
  {
    objectField: "terrainId",
    fromJson: (json, _obj, loadingContext) =>
      getIdFromReferenceString<TerrainId<Int32>>(
        "Terrain",
        "RandomMap_BaseLand",
        json.terrainId,
        loadingContext.dataIds.terrainIds,
      ),
  },
  { objectField: "terrain", fromJson: () => null },
  { objectField: "padding05", fromJson: () => asUInt8(0) },
  { objectField: "padding06", fromJson: () => asUInt16(0) },
  { field: "landSpacing" },
  { field: "baseSize" },
  { field: "zone" },
  { field: "placementType" },
  { objectField: "padding12", fromJson: () => asUInt16(0) },
  { field: "origin" },
  { field: "landProportion" },
  { field: "playerPlacement" },
  { objectField: "padding1E", fromJson: () => asUInt16(0) },
  { field: "playerBaseRadius" },
  { field: "edgeFade" },
  { field: "clumpinessFactor" },
];

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
const TerrainPlacementDataSchema = z.object({
  coverageProportion: PercentageSchema(Int32Schema),
  terrainId: ReferenceStringSchema,
  clumpCount: Int32Schema,
  terrainSpacing: Int32Schema,
  replacedTerrainId: ReferenceStringSchema,
  clumpinessFactor: Int32Schema.optional(),
});
type TerrainPlacementDataJson = z.infer<typeof TerrainPlacementDataSchema>;
const TerrainPlacementDataJsonMapping: JsonFieldMapping<
  TerrainPlacementData,
  TerrainPlacementDataJson
>[] = [
  { field: "coverageProportion" },
  {
    jsonField: "terrainId",
    toJson: (obj) =>
      createReferenceString("Terrain", obj.terrain?.referenceId, obj.terrainId),
  },
  {
    objectField: "terrainId",
    fromJson: (json, _obj, loadingContext) =>
      getIdFromReferenceString<TerrainId<Int32>>(
        "Terrain",
        "RandomMap_TerrainPlacement",
        json.terrainId,
        loadingContext.dataIds.terrainIds,
      ),
  },
  { objectField: "terrain", fromJson: () => null },
  { field: "clumpCount" },
  { field: "terrainSpacing" },
  {
    jsonField: "replacedTerrainId",
    toJson: (obj) =>
      createReferenceString(
        "Terrain",
        obj.replacedTerrain?.referenceId,
        obj.replacedTerrainId,
      ),
  },
  {
    objectField: "replacedTerrainId",
    fromJson: (json, _obj, loadingContext) =>
      getIdFromReferenceString<TerrainId<Int32>>(
        "Terrain",
        "RandomMap_TerrainPlacement",
        json.replacedTerrainId,
        loadingContext.dataIds.terrainIds,
      ),
  },
  { objectField: "replacedTerrain", fromJson: () => null },
  { field: "clumpinessFactor" },
];

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
const ObjectPlacementDataSchema = z.object({
  prototypeId: ReferenceStringSchema,
  placementTerrainId: ReferenceStringSchema,
  groupMode: UInt8Schema,
  scaleByMapSize: Bool8Schema,
  objectsPerGroup: Int32Schema,
  objectsPerGroupVariance: Int32Schema,
  objectGroupsPerPlayer: Int32Schema,
  objectGroupRadius: Int32Schema,
  placementPlayerId: Int32Schema,
  placementBaseLandId: Int32Schema,
  minDistanceToPlayers: Int32Schema,
  maxDistanceToPlayers: Int32Schema,
});
type ObjectPlacementDataJson = z.infer<typeof ObjectPlacementDataSchema>;
const ObjectPlacementDataJsonMapping: JsonFieldMapping<
  ObjectPlacementData,
  ObjectPlacementDataJson
>[] = [
  {
    jsonField: "prototypeId",
    toJson: (obj) =>
      createReferenceString(
        "ObjectPrototype",
        obj.prototype?.referenceId,
        obj.prototypeId,
      ),
  },
  {
    objectField: "prototypeId",
    fromJson: (json, _obj, loadingContext) =>
      getIdFromReferenceString<TerrainId<Int32>>(
        "ObjectPrototype",
        "RandomMap_ObjectPlacement",
        json.prototypeId,
        loadingContext.dataIds.prototypeIds,
      ),
  },
  { objectField: "prototype", fromJson: () => null },
  {
    jsonField: "placementTerrainId",
    toJson: (obj) =>
      createReferenceString(
        "Terrain",
        obj.placementTerrain?.referenceId,
        obj.placementTerrainId,
      ),
  },
  {
    objectField: "placementTerrainId",
    fromJson: (json, _obj, loadingContext) =>
      getIdFromReferenceString<TerrainId<Int32>>(
        "Terrain",
        "RandomMap_ObjectPlacement",
        json.placementTerrainId,
        loadingContext.dataIds.terrainIds,
      ),
  },
  { objectField: "placementTerrain", fromJson: () => null },
  { field: "groupMode" },
  { field: "scaleByMapSize" },
  { objectField: "padding0A", fromJson: () => asUInt16(0) },
  { field: "objectsPerGroup" },
  { field: "objectsPerGroupVariance" },
  { field: "objectGroupsPerPlayer" },
  { field: "objectGroupRadius" },
  { field: "placementPlayerId" },
  { field: "placementBaseLandId" },
  { field: "minDistanceToPlayers" },
  { field: "maxDistanceToPlayers" },
];

interface ElevationPlacementData {
  coverageProportion: Percentage<Int32>;
  elevationHeight: Int32;
  clumpinessFactor: Int32;
  elevationSpacing: Int32;
  placementTerrainId: TerrainId<Int32>;
  placementTerrain: Terrain | null;
  placementElevation: Int32;
}
const ElevationPlacementDataSchema = z.object({
  coverageProportion: PercentageSchema(Int32Schema),
  elevationHeight: Int32Schema,
  clumpinessFactor: Int32Schema.optional(),
  elevationSpacing: Int32Schema,
  placementTerrainId: ReferenceStringSchema,
  placementElevation: Int32Schema,
});
type ElevationPlacementDataJson = z.infer<typeof ElevationPlacementDataSchema>;
const ElevationPlacementDataJsonMapping: JsonFieldMapping<
  ElevationPlacementData,
  ElevationPlacementDataJson
>[] = [
  { field: "coverageProportion" },
  { field: "elevationHeight" },
  { field: "clumpinessFactor" },
  { field: "elevationSpacing" },
  {
    jsonField: "placementTerrainId",
    toJson: (obj) =>
      createReferenceString(
        "Terrain",
        obj.placementTerrain?.referenceId,
        obj.placementTerrainId,
      ),
  },
  {
    objectField: "placementTerrainId",
    fromJson: (json, _obj, loadingContext) =>
      getIdFromReferenceString<TerrainId<Int32>>(
        "Terrain",
        "RandomMap_ElevationPlacement",
        json.placementTerrainId,
        loadingContext.dataIds.terrainIds,
      ),
  },
  { objectField: "placementTerrain", fromJson: () => null },
  { field: "placementElevation" },
];

const RandomMapSchema = z.object({
  internalName: z.string(),
  mapTypeId: Int32Schema,
  border: RectangleSchema(Int32Schema),
  borderEdgeFade: Int32Schema,
  waterShapeLandPlacementEdge: Int32Schema,
  baseTerrainId: ReferenceStringSchema,
  landCover: Int32Schema,
  landId: Int32Schema,
  baseLandData: z.array(BaseLandDataSchema),
  terrainData: z.array(TerrainPlacementDataSchema),
  objectData: z.array(ObjectPlacementDataSchema),
  elevationData: z.array(ElevationPlacementDataSchema),
});
type RandomMapJson = z.infer<typeof RandomMapSchema>;

const RandomMapJsonMapping: JsonFieldMapping<RandomMap, RandomMapJson>[] = [
  { field: "internalName" },
  { field: "mapTypeId" },
  { field: "border" },
  { field: "borderEdgeFade" },
  { field: "waterShapeLandPlacementEdge" },
  {
    jsonField: "baseTerrainId",
    toJson: (obj) =>
      createReferenceString(
        "Terrain",
        obj.baseTerrain?.referenceId,
        obj.baseTerrainId,
      ),
  },
  {
    objectField: "baseTerrainId",
    fromJson: (json, obj, loadingContext) =>
      getIdFromReferenceString<TerrainId<Int32>>(
        "Terrain",
        obj.referenceId,
        json.baseTerrainId,
        loadingContext.dataIds.terrainIds,
      ),
  },
  { field: "landCover" },
  { field: "landId", flags: { unusedField: true } },
  {
    jsonField: "baseLandData",
    toJson: (obj, savingContext) =>
      obj.baseLandData.map((baseLandEntry) =>
        transformObjectToJson(
          baseLandEntry,
          BaseLandDataJsonMapping,
          savingContext,
        ),
      ),
  },
  {
    objectField: "baseLandData",
    fromJson: (json, _obj, loadingContext) =>
      json.baseLandData.map((baseLandData) =>
        transformJsonToObject(
          baseLandData,
          BaseLandDataJsonMapping,
          loadingContext,
        ),
      ),
  },
  {
    jsonField: "terrainData",
    toJson: (obj, savingContext) =>
      obj.terrainData.map((terrainEntry) =>
        transformObjectToJson(
          terrainEntry,
          TerrainPlacementDataJsonMapping,
          savingContext,
        ),
      ),
  },
  {
    objectField: "terrainData",
    fromJson: (json, _obj, loadingContext) =>
      json.terrainData.map((terrainData) =>
        transformJsonToObject(
          terrainData,
          TerrainPlacementDataJsonMapping,
          loadingContext,
        ),
      ),
  },
  {
    jsonField: "objectData",
    toJson: (obj, savingContext) =>
      obj.objectData.map((objectEntry) =>
        transformObjectToJson(
          objectEntry,
          ObjectPlacementDataJsonMapping,
          savingContext,
        ),
      ),
  },
  {
    objectField: "objectData",
    fromJson: (json, _obj, loadingContext) =>
      json.objectData.map((objectData) =>
        transformJsonToObject(
          objectData,
          ObjectPlacementDataJsonMapping,
          loadingContext,
        ),
      ),
  },
  {
    jsonField: "elevationData",
    toJson: (obj, savingContext) =>
      obj.elevationData.map((elevationEntry) =>
        transformObjectToJson(
          elevationEntry,
          ElevationPlacementDataJsonMapping,
          savingContext,
        ),
      ),
  },
  {
    objectField: "elevationData",
    fromJson: (json, _obj, loadingContext) =>
      json.elevationData.map((elevationData) =>
        transformJsonToObject(
          elevationData,
          ElevationPlacementDataJsonMapping,
          loadingContext,
        ),
      ),
  },
];

export class RandomMap {
  id: Int16 = asInt16(-1);
  referenceId: string = "";
  internalName: string = "";
  mapTypeId: Int32 = asInt32(-1);
  preMapData: Omit<PreMapData, "mapTypeId"> | null = null;
  border: Rectangle<Int32> = {
    left: asInt32(0),
    top: asInt32(0),
    right: asInt32(0),
    bottom: asInt32(0),
  };
  borderEdgeFade: Int32 = asInt32(0);
  waterShapeLandPlacementEdge: Int32 = asInt32(0);
  baseTerrainId: TerrainId<Int32> = asInt32<TerrainId<Int32>>(0);
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

  readFromBuffer(
    buffer: BufferReader,
    id: Int16,
    _loadingContext: LoadingContext,
    preMapData: PreMapData,
  ): void {
    this.id = id;
    this.internalName = `RandomMap ${this.id + 1}`;
    this.referenceId = createReferenceIdFromString(this.internalName);
    this.mapTypeId = preMapData.mapTypeId;
    const copiedMapData: Optional<PreMapData, "mapTypeId"> = { ...preMapData };
    delete copiedMapData.mapTypeId;
    this.preMapData = copiedMapData;
    this.border.left = buffer.readInt32();
    this.border.top = buffer.readInt32();
    this.border.right = buffer.readInt32();
    this.border.bottom = buffer.readInt32();
    this.borderEdgeFade = buffer.readInt32();
    this.waterShapeLandPlacementEdge = buffer.readInt32();
    this.baseTerrainId = buffer.readInt32<TerrainId<Int32>>();
    this.baseTerrain = null;
    this.landCover = buffer.readInt32();
    this.landId = buffer.readInt32();

    const baseLandEntryCount = buffer.readInt32();
    this.baseLandDataPointer = buffer.readPointer();
    this.baseLandData = [];
    for (let i = 0; i < baseLandEntryCount; ++i) {
      const landEntry: BaseLandData = {
        baseLandId: buffer.readInt32(),
        terrainId: buffer.readUInt8<TerrainId<UInt8>>(),
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
          y: buffer.readInt32(),
        },
        landProportion: buffer.readUInt8(),
        playerPlacement: buffer.readUInt8(),
        padding1E: buffer.readUInt16(),
        playerBaseRadius: buffer.readInt32(),
        edgeFade: buffer.readInt32(),
        clumpinessFactor: buffer.readInt32(),
      };
      this.baseLandData.push(landEntry);
    }

    const terrainEntryCount = buffer.readInt32();
    this.terrainDataPointer = buffer.readPointer();
    this.terrainData = [];
    for (let i = 0; i < terrainEntryCount; ++i) {
      const terrainDataEntry: TerrainPlacementData = {
        coverageProportion: buffer.readInt32(),
        terrainId: buffer.readInt32<TerrainId<Int32>>(),
        terrain: null,
        clumpCount: buffer.readInt32(),
        terrainSpacing: buffer.readInt32(),
        replacedTerrainId: buffer.readInt32<TerrainId<Int32>>(),
        replacedTerrain: null,
        clumpinessFactor: buffer.readInt32(),
      };
      this.terrainData.push(terrainDataEntry);
    }

    const objectEntryCount = buffer.readInt32();
    this.objectDataPointer = buffer.readPointer();
    this.objectData = [];
    for (let i = 0; i < objectEntryCount; ++i) {
      const objectData: ObjectPlacementData = {
        prototypeId: buffer.readInt32<PrototypeId<Int32>>(),
        prototype: null,
        placementTerrainId: buffer.readInt32<TerrainId<Int32>>(),
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
        maxDistanceToPlayers: buffer.readInt32(),
      };
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
        placementTerrainId: buffer.readInt32<TerrainId<Int32>>(),
        placementTerrain: null,
        placementElevation: buffer.readInt32(),
      };
      this.elevationData.push(elevationData);
    }
  }

  readFromJsonFile(
    jsonFile: RandomMapJson,
    id: Int16,
    referenceId: string,
    loadingContext: JsonLoadingContext,
  ) {
    this.id = id;
    this.referenceId = referenceId;
    applyJsonFieldsToObject(
      jsonFile,
      this,
      RandomMapJsonMapping,
      loadingContext,
    );
  }

  linkOtherData(
    terrains: Nullable<Terrain>[],
    objects: (SceneryObjectPrototype | null)[],
    loadingContext: LoadingContext,
  ) {
    this.baseTerrain = getDataEntry(
      terrains,
      this.baseTerrainId,
      "Terrain",
      this.referenceId,
      loadingContext,
    );
    this.baseLandData.forEach((landEntry) => {
      landEntry.terrain = getDataEntry(
        terrains,
        landEntry.terrainId,
        "Terrain",
        this.referenceId,
        loadingContext,
      );
    });
    this.terrainData.forEach((terrainData) => {
      terrainData.terrain = getDataEntry(
        terrains,
        terrainData.terrainId,
        "Terrain",
        this.referenceId,
        loadingContext,
      );
      terrainData.replacedTerrain = getDataEntry(
        terrains,
        terrainData.replacedTerrainId,
        "Terrain",
        this.referenceId,
        loadingContext,
      );
    });
    this.objectData.forEach((objectData) => {
      objectData.prototype = getDataEntry(
        objects,
        objectData.prototypeId,
        "ObjectPrototype",
        this.referenceId,
        loadingContext,
      );
      objectData.placementTerrain = getDataEntry(
        terrains,
        objectData.placementTerrainId,
        "Terrain",
        this.referenceId,
        loadingContext,
      );
    });
    this.elevationData.forEach((elevationData) => {
      elevationData.placementTerrain = getDataEntry(
        terrains,
        elevationData.placementTerrainId,
        "Terrain",
        this.referenceId,
        loadingContext,
      );
    });
  }

  writeToJsonFile(directory: string, savingContext: SavingContext) {
    writeFileSync(
      path.join(directory, `${this.referenceId}.json`),
      createJson(this.toJson(savingContext)),
    );
  }

  toJson(savingContext: SavingContext) {
    return transformObjectToJson(this, RandomMapJsonMapping, savingContext);
  }
}

export function readRandomMapsFromBuffer(
  randomMapCount: number,
  buffer: BufferReader,
  loadingContext: LoadingContext,
): RandomMap[] {
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
          bottom: buffer.readInt32(),
        },
        borderEdgeFade: buffer.readInt32(),
        waterShapeLandPlacementEdge: buffer.readInt32(),
        baseTerrainId: buffer.readInt32<TerrainId<Int32>>(),
        landCover: buffer.readInt32(),
        landId: buffer.readInt32(),
        baseLandDataEntryCount: buffer.readInt32(),
        baseLandDataPointer: buffer.readPointer(),
        terrainDataEntryCount: buffer.readInt32(),
        terrainDataPointer: buffer.readPointer(),
        objectDataEntryCount: buffer.readInt32(),
        objectDataPointer: buffer.readPointer(),
        elevationDataEntryCount: buffer.readInt32(),
        elevationDataPointer: buffer.readPointer(),
      });
    }

    for (let i = 0; i < randomMapCount; ++i) {
      const randomMap = new RandomMap();
      randomMap.readFromBuffer(
        buffer,
        asInt16(i),
        loadingContext,
        preMapData[i],
      );
      result.push(randomMap);
    }
  }

  return result;
}

function writeRandomMapDefinitionsToWorldTextFile(
  outputDirectory: string,
  randomMaps: RandomMap[],
  _savingContext: SavingContext,
) {
  const textFileWriter = new TextFileWriter(
    path.join(outputDirectory, TextFileNames.RandomMapDefinitons),
  );
  textFileWriter.raw(randomMaps.length).eol(); // Total map entries

  for (let i = 0; i < randomMaps.length; ++i) {
    textFileWriter.integer(randomMaps[i].mapTypeId).eol();
  }
  textFileWriter.close();
}

function writeRandomMapBaseLandDataToWorldTextFile(
  outputDirectory: string,
  randomMaps: RandomMap[],
  _savingContext: SavingContext,
) {
  const textFileWriter = new TextFileWriter(
    path.join(outputDirectory, TextFileNames.RandomMapBaseLands),
  );
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
      .eol();

    for (let j = 0; j < randomMap.baseLandData.length; ++j) {
      const baseLandData = randomMap.baseLandData[j];
      textFileWriter
        .indent(2)
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

function writeRandomMapTerrainPlacementDataToWorldTextFile(
  outputDirectory: string,
  randomMaps: RandomMap[],
  _savingContext: SavingContext,
) {
  const textFileWriter = new TextFileWriter(
    path.join(outputDirectory, TextFileNames.RandomMapTerrains),
  );
  textFileWriter.raw(randomMaps.length).eol(); // Total map entries

  for (let i = 0; i < randomMaps.length; ++i) {
    const randomMap = randomMaps[i];
    textFileWriter.integer(i).integer(randomMap.terrainData.length).eol();

    for (let j = 0; j < randomMap.terrainData.length; ++j) {
      const terrainData = randomMap.terrainData[j];
      textFileWriter
        .indent(2)
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

function writeRandomMapObjectPlacementDataToWorldTextFile(
  outputDirectory: string,
  randomMaps: RandomMap[],
  _savingContext: SavingContext,
) {
  const textFileWriter = new TextFileWriter(
    path.join(outputDirectory, TextFileNames.RandomMapObjects),
  );
  textFileWriter.raw(randomMaps.length).eol(); // Total map entries

  for (let i = 0; i < randomMaps.length; ++i) {
    const randomMap = randomMaps[i];
    textFileWriter.integer(i).integer(randomMap.objectData.length).eol();

    for (let j = 0; j < randomMap.objectData.length; ++j) {
      const objectData = randomMap.objectData[j];
      textFileWriter
        .indent(2)
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

export function writeRandomMapsToWorldTextFile(
  outputDirectory: string,
  randomMaps: RandomMap[],
  savingContext: SavingContext,
) {
  writeRandomMapDefinitionsToWorldTextFile(
    outputDirectory,
    randomMaps,
    savingContext,
  );
  writeRandomMapBaseLandDataToWorldTextFile(
    outputDirectory,
    randomMaps,
    savingContext,
  );
  writeRandomMapTerrainPlacementDataToWorldTextFile(
    outputDirectory,
    randomMaps,
    savingContext,
  );
  writeRandomMapObjectPlacementDataToWorldTextFile(
    outputDirectory,
    randomMaps,
    savingContext,
  );
}

export function writeRandomMapsToJsonFiles(
  outputDirectory: string,
  randomMaps: RandomMap[],
  savingContext: SavingContext,
) {
  if (semver.gte(savingContext.version.numbering, "2.0.0")) {
    writeDataEntriesToJson(
      outputDirectory,
      "randommaps",
      randomMaps,
      savingContext,
    );
  }
}

export function readRandomMapsFromJsonFiles(
  inputDirectory: string,
  randomMapIds: (string | null)[],
  loadingContext: JsonLoadingContext,
) {
  const randomMapsDirectory = path.join(inputDirectory, "randommaps");
  const randomMaps: RandomMap[] = [];
  randomMapIds.forEach((randomMapReferenceId, randomMapNumberId) => {
    if (randomMapReferenceId === null) {
      throw new Error(`Null RandomMap entries are not supported!`);
    } else {
      const randomMapJson = RandomMapSchema.parse(
        JSON5.parse(
          readFileSync(
            path.join(randomMapsDirectory, `${randomMapReferenceId}.json`),
          ).toString("utf8"),
        ),
      );
      const randomMap = new RandomMap();
      randomMap.readFromJsonFile(
        randomMapJson,
        asInt16(randomMapNumberId),
        randomMapReferenceId,
        loadingContext,
      );
      randomMaps.push(randomMap);
    }
  });
  return randomMaps;
}

export function readRandomMapIdsFromJsonIndex(inputDirectory: string) {
  try {
    return readJsonFileIndex(path.join(inputDirectory, "randommaps"));
  } catch (_err: unknown) {
    return [];
  }
}
