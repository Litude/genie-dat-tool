import JSON5 from "json5";
import semver from "semver";
import BufferReader from "../../BufferReader";
import { TextFileNames } from "../../textfile/TextFile";
import { TextFileWriter } from "../../textfile/TextFileWriter";
import { JsonLoadingContext, LoadingContext } from "../LoadingContext";
import { SavingContext } from "../SavingContext";
import { PrototypeId, ReferenceStringSchema, TerrainId } from "../Types";
import {
  asBool32,
  asInt16,
  asInt32,
  Bool32,
  Bool32Schema,
  Int16,
  Int32,
  Int32Schema,
} from "../../ts/base-types";
import { Terrain } from "./Terrain";
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
import { SceneryObjectPrototype } from "../object/SceneryObjectPrototype";
import { Nullable, trimEnd } from "../../ts/ts-utils";
import { getDataEntry } from "../../util";
import { z } from "zod";
import { readFileSync, writeFileSync } from "fs";
import { BaseObjectPrototype } from "../object/ObjectPrototypes";

// There are two different surrounding terrain placement modes, depending on whether simplePrimarySurroundingTerrainId is set or not
// referred to as here as simple mode and replacement mode

interface TerrainPlacementData {
  terrainId: TerrainId<Int32>;
  terrain: Terrain | null;
  unusedTerrainId: TerrainId<Int32>; // This is only used in the text files but the game skipped this entry
  unusedTerrain: Terrain | null;
  placementType: Int32;
  density: Int32;
  simplePrimarySurroundingTerrainId: TerrainId<Int32>; // If this is non-null. This is the terrain that will surround terrainId (1 tile)
  simplePrimarySurroundingTerrain: Terrain | null;
  targetedPrimarySurroundingTerrainId: TerrainId<Int32>; // In simple mode, terrain of this type will not be replaced with surrounding types. In replacement mode, terrain of this type will be replaced with replacementPrimarySurroundingTerrainId.
  targetedPrimarySurroundingTerrain: Terrain | null;
  replacementPrimarySurroundingTerrainId: TerrainId<Int32>; // In replacement mode, targetedPrimarySurroundingTerrainId surrounding terrainId will be replaced with this terrain. Ignored in simple mode.
  replacementPrimarySurroundingTerrain: Terrain | null;
  replacedSecondarySurroundingTerrainId: TerrainId<Int32>; // In replacement mode, terrain of this type will be replaced with secondarySurroundingTerrainId. Ignored in simple mode.
  replacedSecondarySurroundingTerrain: Terrain | null;
  secondarySurroundingTerrainId: TerrainId<Int32>; // In simple mode, terrain of this type will surround simplePrimarySurroundingTerrainId that in turn surrounds terrainId. (1 tile per type). In replacement mode, replacedSecondarySurroundingTerrainId will be replaced with this terrain.
  secondarySurroundingTerrain: Terrain | null;
  defaultElevation: Int32;
  avoidedTerrainId: TerrainId<Int32>; // Terrain that is not replaced when painting terrainId
  avoidedTerrain: Terrain | null;
  windyPathAvoidingTerrainId: TerrainId<Int32>; // Used for placementType == 17, terrain that is not replaced with windy path
  windyPathAvoidingTerrain: Terrain | null;
  windyPathBorderingTerrainId: TerrainId<Int32>; // Used for placementType == 17, terrain that must be next to terrainId for windy path to be created
  windyPathBorderingTerrain: Terrain | null;
}

const TerrainPlacementDataSchema = z.object({
  terrainId: ReferenceStringSchema,
  unusedTerrainId: ReferenceStringSchema.optional(),
  placementType: Int32Schema,
  density: Int32Schema,
  simplePrimarySurroundingTerrainId: ReferenceStringSchema,
  targetedPrimarySurroundingTerrainId: ReferenceStringSchema,
  replacementPrimarySurroundingTerrainId: ReferenceStringSchema,
  replacedSecondarySurroundingTerrainId: ReferenceStringSchema,
  secondarySurroundingTerrainId: ReferenceStringSchema,
  defaultElevation: Int32Schema,
  avoidedTerrainId: ReferenceStringSchema,
  windyPathAvoidingTerrainId: ReferenceStringSchema,
  windyPathBorderingTerrainId: ReferenceStringSchema,
});
type TerrainPlacementDataJson = z.infer<typeof TerrainPlacementDataSchema>;

const TerrainPlacementDataJsonMapping: JsonFieldMapping<
  TerrainPlacementData,
  TerrainPlacementDataJson
>[] = [
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
        "TribeMap_Terrain",
        json.terrainId,
        loadingContext.dataIds.terrainIds,
      ),
  },
  { objectField: "terrain", fromJson: () => null },
  {
    jsonField: "unusedTerrainId",
    flags: { unusedField: true, internalField: true },
    toJson: (obj) =>
      createReferenceString(
        "Terrain",
        obj.unusedTerrain?.referenceId,
        obj.unusedTerrainId,
      ),
  },
  {
    objectField: "unusedTerrainId",
    fromJson: (json, _obj, loadingContext) =>
      json.unusedTerrainId !== undefined
        ? getIdFromReferenceString<TerrainId<Int32>>(
            "Terrain",
            "TribeMap_Terrain",
            json.unusedTerrainId,
            loadingContext.dataIds.terrainIds,
          )
        : asInt32<TerrainId<Int32>>(-1),
  },
  { objectField: "unusedTerrain", fromJson: () => null },
  { field: "placementType" },
  { field: "density" },
  {
    jsonField: "simplePrimarySurroundingTerrainId",
    toJson: (obj) =>
      createReferenceString(
        "Terrain",
        obj.simplePrimarySurroundingTerrain?.referenceId,
        obj.simplePrimarySurroundingTerrainId,
      ),
  },
  {
    objectField: "simplePrimarySurroundingTerrainId",
    fromJson: (json, _obj, loadingContext) =>
      getIdFromReferenceString<TerrainId<Int32>>(
        "Terrain",
        "TribeMap_Terrain",
        json.simplePrimarySurroundingTerrainId,
        loadingContext.dataIds.terrainIds,
      ),
  },
  { objectField: "simplePrimarySurroundingTerrain", fromJson: () => null },
  {
    jsonField: "targetedPrimarySurroundingTerrainId",
    toJson: (obj) =>
      createReferenceString(
        "Terrain",
        obj.targetedPrimarySurroundingTerrain?.referenceId,
        obj.targetedPrimarySurroundingTerrainId,
      ),
  },
  {
    objectField: "targetedPrimarySurroundingTerrainId",
    fromJson: (json, _obj, loadingContext) =>
      getIdFromReferenceString<TerrainId<Int32>>(
        "Terrain",
        "TribeMap_Terrain",
        json.targetedPrimarySurroundingTerrainId,
        loadingContext.dataIds.terrainIds,
      ),
  },
  { objectField: "targetedPrimarySurroundingTerrain", fromJson: () => null },
  {
    jsonField: "replacementPrimarySurroundingTerrainId",
    toJson: (obj) =>
      createReferenceString(
        "Terrain",
        obj.replacementPrimarySurroundingTerrain?.referenceId,
        obj.replacementPrimarySurroundingTerrainId,
      ),
  },
  {
    objectField: "replacementPrimarySurroundingTerrainId",
    fromJson: (json, _obj, loadingContext) =>
      getIdFromReferenceString<TerrainId<Int32>>(
        "Terrain",
        "TribeMap_Terrain",
        json.replacementPrimarySurroundingTerrainId,
        loadingContext.dataIds.terrainIds,
      ),
  },
  { objectField: "replacementPrimarySurroundingTerrain", fromJson: () => null },
  {
    jsonField: "replacedSecondarySurroundingTerrainId",
    toJson: (obj) =>
      createReferenceString(
        "Terrain",
        obj.replacedSecondarySurroundingTerrain?.referenceId,
        obj.replacedSecondarySurroundingTerrainId,
      ),
  },
  {
    objectField: "replacedSecondarySurroundingTerrainId",
    fromJson: (json, _obj, loadingContext) =>
      getIdFromReferenceString<TerrainId<Int32>>(
        "Terrain",
        "TribeMap_Terrain",
        json.replacedSecondarySurroundingTerrainId,
        loadingContext.dataIds.terrainIds,
      ),
  },
  { objectField: "replacedSecondarySurroundingTerrain", fromJson: () => null },
  {
    jsonField: "secondarySurroundingTerrainId",
    toJson: (obj) =>
      createReferenceString(
        "Terrain",
        obj.secondarySurroundingTerrain?.referenceId,
        obj.secondarySurroundingTerrainId,
      ),
  },
  {
    objectField: "secondarySurroundingTerrainId",
    fromJson: (json, _obj, loadingContext) =>
      getIdFromReferenceString<TerrainId<Int32>>(
        "Terrain",
        "TribeMap_Terrain",
        json.secondarySurroundingTerrainId,
        loadingContext.dataIds.terrainIds,
      ),
  },
  { objectField: "secondarySurroundingTerrain", fromJson: () => null },
  { field: "defaultElevation" },
  {
    jsonField: "avoidedTerrainId",
    toJson: (obj) =>
      createReferenceString(
        "Terrain",
        obj.avoidedTerrain?.referenceId,
        obj.avoidedTerrainId,
      ),
  },
  {
    objectField: "avoidedTerrainId",
    fromJson: (json, _obj, loadingContext) =>
      getIdFromReferenceString<TerrainId<Int32>>(
        "Terrain",
        "TribeMap_Terrain",
        json.avoidedTerrainId,
        loadingContext.dataIds.terrainIds,
      ),
  },
  { objectField: "avoidedTerrain", fromJson: () => null },
  {
    jsonField: "windyPathAvoidingTerrainId",
    toJson: (obj) =>
      createReferenceString(
        "Terrain",
        obj.windyPathAvoidingTerrain?.referenceId,
        obj.windyPathAvoidingTerrainId,
      ),
  },
  {
    objectField: "windyPathAvoidingTerrainId",
    fromJson: (json, _obj, loadingContext) =>
      getIdFromReferenceString<TerrainId<Int32>>(
        "Terrain",
        "TribeMap_Terrain",
        json.windyPathAvoidingTerrainId,
        loadingContext.dataIds.terrainIds,
      ),
  },
  { objectField: "windyPathAvoidingTerrain", fromJson: () => null },
  {
    jsonField: "windyPathBorderingTerrainId",
    toJson: (obj) =>
      createReferenceString(
        "Terrain",
        obj.windyPathBorderingTerrain?.referenceId,
        obj.windyPathBorderingTerrainId,
      ),
  },
  {
    objectField: "windyPathBorderingTerrainId",
    fromJson: (json, _obj, loadingContext) =>
      getIdFromReferenceString<TerrainId<Int32>>(
        "Terrain",
        "TribeMap_Terrain",
        json.windyPathBorderingTerrainId,
        loadingContext.dataIds.terrainIds,
      ),
  },
  { objectField: "windyPathBorderingTerrain", fromJson: () => null },
];

interface ObjectPlacementData {
  prototypeId: PrototypeId<Int32>;
  prototype: SceneryObjectPrototype | null;
  placementType: Int32;
  placementCount: Int32;
  placementSpread: Int32;
  objectsPerGroupMax: Int32;
  objectGroups: Int32;
  placementTerrainIds: TerrainId<Int32>[];
  placementTerrains: Nullable<Terrain>[];
  borderingTerrainId: TerrainId<Int32>;
  borderingTerrain: Terrain | null;
}
const ObjectPlacementDataSchema = z.object({
  prototypeId: ReferenceStringSchema,
  placementType: Int32Schema,
  placementCount: Int32Schema,
  placementSpread: Int32Schema,
  objectsPerGroupMax: Int32Schema,
  objectGroups: Int32Schema,
  placementTerrainIds: z.array(ReferenceStringSchema).max(3),
  borderingTerrainId: ReferenceStringSchema,
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
      getIdFromReferenceString<PrototypeId<Int32>>(
        "ObjectPrototype",
        "TribeMap_Object",
        json.prototypeId,
        loadingContext.dataIds.prototypeIds,
      ),
  },
  { objectField: "prototype", fromJson: () => null },
  { field: "placementType" },
  { field: "placementCount" },
  { field: "placementSpread" },
  { field: "objectsPerGroupMax" },
  { field: "objectGroups" },
  {
    jsonField: "placementTerrainIds",
    toJson: (obj) =>
      obj.placementTerrains.map((terrain, index) =>
        createReferenceString(
          "Terrain",
          terrain?.referenceId,
          obj.placementTerrainIds[index] ?? -1,
        ),
      ),
  },
  {
    objectField: "placementTerrainIds",
    fromJson: (json, _obj, loadingContext) =>
      json.placementTerrainIds.map((terrainId) =>
        getIdFromReferenceString<TerrainId<Int32>>(
          "Terrain",
          "TribeMap_Object",
          terrainId,
          loadingContext.dataIds.terrainIds,
        ),
      ),
  },
  {
    jsonField: "borderingTerrainId",
    toJson: (obj) =>
      createReferenceString(
        "Terrain",
        obj.borderingTerrain?.referenceId,
        obj.borderingTerrainId,
      ),
  },
  {
    objectField: "borderingTerrainId",
    fromJson: (json, _obj, loadingContext) =>
      getIdFromReferenceString<TerrainId<Int32>>(
        "Terrain",
        "TribeMap_Object",
        json.borderingTerrainId,
        loadingContext.dataIds.terrainIds,
      ),
  },
];

const TribeRandomMapSchema = z.object({
  internalName: z.string(),
  baseTerrainId: ReferenceStringSchema,
  baseLandTerrainId: ReferenceStringSchema,
  baseLandAvoidingTerrainId: ReferenceStringSchema,
  radiusBetweenPlayers: Int32Schema,
  terrainPlacements: z.array(TerrainPlacementDataSchema).max(20),
  objectPlacements: z.array(ObjectPlacementDataSchema).max(60),
  distance: Int32Schema.optional(),
  distanceBetweenPlayers: Int32Schema,
  boolField: Bool32Schema.optional(),
  minimumClearingCount: Int32Schema,
  randomizeStartingLocations: Bool32Schema,
  startingLocationDistributionType: Int32Schema,
});
type TribeRandomMapJson = z.infer<typeof TribeRandomMapSchema>;

const TribeRandomMapJsonMapping: JsonFieldMapping<
  TribeRandomMap,
  TribeRandomMapJson
>[] = [
  { field: "internalName", flags: { unusedField: true } },
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
  {
    jsonField: "baseLandTerrainId",
    toJson: (obj) =>
      createReferenceString(
        "Terrain",
        obj.baseLandTerrain?.referenceId,
        obj.baseLandTerrainId,
      ),
  },
  {
    objectField: "baseLandTerrainId",
    fromJson: (json, obj, loadingContext) =>
      getIdFromReferenceString<TerrainId<Int32>>(
        "Terrain",
        obj.referenceId,
        json.baseLandTerrainId,
        loadingContext.dataIds.terrainIds,
      ),
  },
  {
    jsonField: "baseLandAvoidingTerrainId",
    toJson: (obj) =>
      createReferenceString(
        "Terrain",
        obj.baseLandAvoidingTerrain?.referenceId,
        obj.baseLandAvoidingTerrainId,
      ),
  },
  {
    objectField: "baseLandAvoidingTerrainId",
    fromJson: (json, obj, loadingContext) =>
      getIdFromReferenceString<TerrainId<Int32>>(
        "Terrain",
        obj.referenceId,
        json.baseLandAvoidingTerrainId,
        loadingContext.dataIds.terrainIds,
      ),
  },
  { field: "radiusBetweenPlayers" },
  {
    jsonField: "terrainPlacements",
    toJson: (obj, savingContext) =>
      obj.terrainPlacements.map((terrainPlacement) =>
        transformObjectToJson(
          terrainPlacement,
          TerrainPlacementDataJsonMapping,
          savingContext,
        ),
      ),
  },
  {
    objectField: "terrainPlacements",
    fromJson: (json, _obj, loadingContext) =>
      json.terrainPlacements.map((terrainPlacement) =>
        transformJsonToObject(
          terrainPlacement,
          TerrainPlacementDataJsonMapping,
          loadingContext,
        ),
      ),
  },
  {
    jsonField: "objectPlacements",
    toJson: (obj, savingContext) =>
      obj.objectPlacements.map((objectPlacement) =>
        transformObjectToJson(
          objectPlacement,
          ObjectPlacementDataJsonMapping,
          savingContext,
        ),
      ),
  },
  {
    objectField: "objectPlacements",
    fromJson: (json, _obj, loadingContext) =>
      json.objectPlacements.map((objectPlacement) =>
        transformJsonToObject(
          objectPlacement,
          ObjectPlacementDataJsonMapping,
          loadingContext,
        ),
      ),
  },
  { field: "distance" },
  { field: "distanceBetweenPlayers" },
  { field: "boolField" },
  { field: "minimumClearingCount" },
  { field: "randomizeStartingLocations" },
  { field: "startingLocationDistributionType" },
];

export class TribeRandomMap {
  referenceId: string = "";
  id: Int16 = asInt16(-1);
  internalName: string = "";
  baseTerrainId: TerrainId<Int32> = asInt32<TerrainId<Int32>>(-1);
  baseTerrain: Terrain | null = null;
  baseLandTerrainId: TerrainId<Int32> = asInt32<TerrainId<Int32>>(-1);
  baseLandTerrain: Terrain | null = null;
  baseLandAvoidingTerrainId: TerrainId<Int32> = asInt32<TerrainId<Int32>>(-1);
  baseLandAvoidingTerrain: Terrain | null = null;
  radiusBetweenPlayers: Int32 = asInt32(0);
  terrainPlacements: TerrainPlacementData[] = [];
  objectPlacements: ObjectPlacementData[] = [];
  distance: Int32 = asInt32(0);
  distanceBetweenPlayers: Int32 = asInt32(0);
  boolField: Bool32 = asBool32(false);
  minimumClearingCount: Int32 = asInt32(0);
  randomizeStartingLocations: Bool32 = asBool32(false);
  startingLocationDistributionType: Int32 = asInt32(0);

  readFromBuffer(
    buffer: BufferReader,
    id: Int16,
    _loadingContext: LoadingContext,
  ): void {
    this.id = id;
    this.internalName = `Map ${id + 1}`;
    this.referenceId = createReferenceIdFromString(this.internalName);
    this.baseTerrainId = buffer.readInt32<TerrainId<Int32>>();
    this.baseTerrain = null;
    this.baseLandTerrainId = buffer.readInt32<TerrainId<Int32>>();
    this.baseLandTerrain = null;
    this.baseLandAvoidingTerrainId = buffer.readInt32<TerrainId<Int32>>();
    this.baseLandAvoidingTerrain = null;

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
        terrainId: buffer.readInt32<TerrainId<Int32>>(),
        terrain: null,
        unusedTerrainId: asInt32<TerrainId<Int32>>(-1),
        unusedTerrain: null,
        placementType: buffer.readInt32(),
        density: buffer.readInt32(),
        simplePrimarySurroundingTerrainId: buffer.readInt32<TerrainId<Int32>>(),
        simplePrimarySurroundingTerrain: null,
        targetedPrimarySurroundingTerrainId:
          buffer.readInt32<TerrainId<Int32>>(),
        targetedPrimarySurroundingTerrain: null,
        replacementPrimarySurroundingTerrainId:
          buffer.readInt32<TerrainId<Int32>>(),
        replacementPrimarySurroundingTerrain: null,
        replacedSecondarySurroundingTerrainId:
          buffer.readInt32<TerrainId<Int32>>(),
        replacedSecondarySurroundingTerrain: null,
        secondarySurroundingTerrainId: buffer.readInt32<TerrainId<Int32>>(),
        secondarySurroundingTerrain: null,
        defaultElevation: buffer.readInt32(),
        avoidedTerrainId: buffer.readInt32<TerrainId<Int32>>(),
        avoidedTerrain: null,
        windyPathAvoidingTerrainId: buffer.readInt32<TerrainId<Int32>>(),
        windyPathAvoidingTerrain: null,
        windyPathBorderingTerrainId: buffer.readInt32<TerrainId<Int32>>(),
        windyPathBorderingTerrain: null,
      });
    }
    for (let i = 0; i < 60; ++i) {
      const prototypeId = buffer.readInt32<PrototypeId<Int32>>();
      const placementType = buffer.readInt32();
      const placementCount = buffer.readInt32();
      const placementSpread = buffer.readInt32();
      const objectsPerGroupMax = buffer.readInt32();
      const objectGroups = buffer.readInt32();
      let placementTerrainIds: TerrainId<Int32>[] = [];
      for (let i = 0; i < 3; ++i) {
        placementTerrainIds.push(buffer.readInt32<TerrainId<Int32>>());
      }
      placementTerrainIds = trimEnd(
        placementTerrainIds,
        (entry) => entry === asInt32<TerrainId<Int32>>(-1),
      );
      const borderingTerrainId = buffer.readInt32<TerrainId<Int32>>();

      this.objectPlacements.push({
        prototypeId,
        prototype: null,
        placementType,
        placementCount,
        placementSpread,
        objectsPerGroupMax,
        objectGroups,
        placementTerrainIds,
        placementTerrains: [],
        borderingTerrainId,
        borderingTerrain: null,
      });
    }

    this.terrainPlacements = this.terrainPlacements.slice(
      0,
      terrainPlacementEntries,
    );
    this.objectPlacements = this.objectPlacements.slice(
      0,
      objectPlacementEntries,
    );
  }

  readFromJsonFile(
    jsonFile: TribeRandomMapJson,
    id: Int16,
    referenceId: string,
    loadingContext: JsonLoadingContext,
  ) {
    this.id = id;
    this.referenceId = referenceId;
    applyJsonFieldsToObject(
      jsonFile,
      this,
      TribeRandomMapJsonMapping,
      loadingContext,
    );
  }

  linkOtherData(
    terrains: Nullable<Terrain>[],
    objects: Nullable<BaseObjectPrototype>[],
    loadingContext: LoadingContext,
  ) {
    this.baseTerrain = getDataEntry(
      terrains,
      this.baseTerrainId,
      "Terrain",
      this.referenceId,
      loadingContext,
    );
    this.baseLandTerrain = getDataEntry(
      terrains,
      this.baseLandTerrainId,
      "Terrain",
      this.referenceId,
      loadingContext,
    );
    this.baseLandAvoidingTerrain = getDataEntry(
      terrains,
      this.baseLandAvoidingTerrainId,
      "Terrain",
      this.referenceId,
      loadingContext,
    );

    this.objectPlacements.forEach((objectPlacement) => {
      objectPlacement.prototype = getDataEntry(
        objects,
        objectPlacement.prototypeId,
        "ObjectPrototype",
        this.referenceId,
        loadingContext,
      );
      objectPlacement.placementTerrains =
        objectPlacement.placementTerrainIds.map((terrainId) =>
          getDataEntry(
            terrains,
            terrainId,
            "Terrain",
            this.referenceId,
            loadingContext,
          ),
        );
      objectPlacement.borderingTerrain = getDataEntry(
        terrains,
        objectPlacement.borderingTerrainId,
        "Terrain",
        this.referenceId,
        loadingContext,
      );
    });
    this.terrainPlacements.forEach((terrainPlacement) => {
      terrainPlacement.terrain = getDataEntry(
        terrains,
        terrainPlacement.terrainId,
        "Terrain",
        this.referenceId,
        loadingContext,
      );
      terrainPlacement.targetedPrimarySurroundingTerrain = getDataEntry(
        terrains,
        terrainPlacement.targetedPrimarySurroundingTerrainId,
        "Terrain",
        this.referenceId,
        loadingContext,
      );
      terrainPlacement.replacedSecondarySurroundingTerrain = getDataEntry(
        terrains,
        terrainPlacement.replacedSecondarySurroundingTerrainId,
        "Terrain",
        this.referenceId,
        loadingContext,
      );
      terrainPlacement.avoidedTerrain = getDataEntry(
        terrains,
        terrainPlacement.avoidedTerrainId,
        "Terrain",
        this.referenceId,
        loadingContext,
      );
      terrainPlacement.windyPathAvoidingTerrain = getDataEntry(
        terrains,
        terrainPlacement.windyPathAvoidingTerrainId,
        "Terrain",
        this.referenceId,
        loadingContext,
      );
      terrainPlacement.simplePrimarySurroundingTerrain = getDataEntry(
        terrains,
        terrainPlacement.simplePrimarySurroundingTerrainId,
        "Terrain",
        this.referenceId,
        loadingContext,
      );
      terrainPlacement.replacementPrimarySurroundingTerrain = getDataEntry(
        terrains,
        terrainPlacement.replacementPrimarySurroundingTerrainId,
        "Terrain",
        this.referenceId,
        loadingContext,
      );
      terrainPlacement.secondarySurroundingTerrain = getDataEntry(
        terrains,
        terrainPlacement.secondarySurroundingTerrainId,
        "Terrain",
        this.referenceId,
        loadingContext,
      );
      terrainPlacement.windyPathBorderingTerrain = getDataEntry(
        terrains,
        terrainPlacement.windyPathBorderingTerrainId,
        "Terrain",
        this.referenceId,
        loadingContext,
      );
    });
  }

  appendToTextFile(
    textFileWriter: TextFileWriter,
    _savingContext: SavingContext,
  ): void {
    textFileWriter
      .string(this.internalName, 17)
      .integer(this.baseTerrainId)
      .integer(this.baseLandTerrainId)
      .integer(this.baseLandAvoidingTerrainId)
      .integer(this.radiusBetweenPlayers)
      .integer(this.distance)
      .integer(this.distanceBetweenPlayers)
      .integer(this.boolField ? 1 : 0)
      .integer(this.minimumClearingCount)
      .integer(this.randomizeStartingLocations ? 1 : 0)
      .integer(this.startingLocationDistributionType)
      .eol();

    textFileWriter
      .integer(this.terrainPlacements.length)
      .eol()
      .integer(this.objectPlacements.length)
      .eol();

    this.terrainPlacements.forEach((terrainPlacement) => {
      textFileWriter
        .indent(3)
        .integer(terrainPlacement.unusedTerrainId)
        .integer(terrainPlacement.placementType)
        .integer(terrainPlacement.terrainId)
        .integer(terrainPlacement.density)
        .integer(terrainPlacement.simplePrimarySurroundingTerrainId)
        .integer(terrainPlacement.targetedPrimarySurroundingTerrainId)
        .integer(terrainPlacement.replacementPrimarySurroundingTerrainId)
        .integer(terrainPlacement.replacedSecondarySurroundingTerrainId)
        .integer(terrainPlacement.secondarySurroundingTerrainId)
        .integer(terrainPlacement.defaultElevation)
        .integer(terrainPlacement.avoidedTerrainId)
        .integer(terrainPlacement.windyPathAvoidingTerrainId)
        .integer(terrainPlacement.windyPathBorderingTerrainId)
        .eol();
    });

    this.objectPlacements.forEach((objectPlacement) => {
      textFileWriter
        .indent(3)
        .integer(objectPlacement.placementType)
        .integer(objectPlacement.prototypeId)
        .integer(objectPlacement.placementCount)
        .integer(objectPlacement.placementSpread)
        .integer(objectPlacement.objectsPerGroupMax)
        .integer(objectPlacement.objectGroups)
        .integer(
          objectPlacement.placementTerrainIds.at(0) ??
            asInt32<TerrainId<Int32>>(-1),
        )
        .integer(
          objectPlacement.placementTerrainIds.at(1) ??
            asInt32<TerrainId<Int32>>(-1),
        )
        .integer(
          objectPlacement.placementTerrainIds.at(2) ??
            asInt32<TerrainId<Int32>>(-1),
        )
        .integer(objectPlacement.borderingTerrainId)
        .eol();
    });
  }

  writeToJsonFile(directory: string, savingContext: SavingContext) {
    writeFileSync(
      path.join(directory, `${this.referenceId}.json`),
      createJson(this.toJson(savingContext)),
    );
  }

  toJson(savingContext: SavingContext) {
    return transformObjectToJson(
      this,
      TribeRandomMapJsonMapping,
      savingContext,
    );
  }
}

export function readTribeRandomMapsFromBuffer(
  randomMapCount: number,
  buffer: BufferReader,
  loadingContext: LoadingContext,
): TribeRandomMap[] {
  const result: TribeRandomMap[] = [];
  if (semver.lt(loadingContext.version.numbering, "2.0.0")) {
    for (let i = 0; i < randomMapCount; ++i) {
      const randomMap = new TribeRandomMap();
      randomMap.readFromBuffer(buffer, asInt16(i), loadingContext);
      result.push(randomMap);
    }
  }
  return result;
}

export function writeTribeRandomMapsToWorldTextFile(
  outputDirectory: string,
  maps: TribeRandomMap[],
  savingContext: SavingContext,
) {
  const textFileWriter = new TextFileWriter(
    path.join(outputDirectory, TextFileNames.TribeRandomMaps),
  );
  textFileWriter.raw(maps.length).eol();
  maps.forEach((map) => {
    map.appendToTextFile(textFileWriter, savingContext);
  });
  textFileWriter.close();
}

export function writeTribeRandomMapsToJsonFiles(
  outputDirectory: string,
  maps: Nullable<TribeRandomMap>[],
  savingContext: SavingContext,
) {
  if (semver.lt(savingContext.version.numbering, "2.0.0")) {
    writeDataEntriesToJson(outputDirectory, "tribemaps", maps, savingContext);
  }
}

export function readTribeRandomMapsFromJsonFiles(
  inputDirectory: string,
  tribeRandomMapIds: (string | null)[],
  loadingContext: JsonLoadingContext,
) {
  const tribeRandomMapsDirectory = path.join(inputDirectory, "tribemaps");
  const tribeRandomMaps: TribeRandomMap[] = [];
  tribeRandomMapIds.forEach(
    (tribeRandomMapReferenceId, tribeRandomMapNumberId) => {
      if (tribeRandomMapReferenceId === null) {
        throw new Error(`Null TribeRandomMap entries are not supported!`);
      } else {
        const tribeRandomMapJson = TribeRandomMapSchema.parse(
          JSON5.parse(
            readFileSync(
              path.join(
                tribeRandomMapsDirectory,
                `${tribeRandomMapReferenceId}.json`,
              ),
            ).toString("utf8"),
          ),
        );
        const tribeRandomMap = new TribeRandomMap();
        tribeRandomMap.readFromJsonFile(
          tribeRandomMapJson,
          asInt16(tribeRandomMapNumberId),
          tribeRandomMapReferenceId,
          loadingContext,
        );
        tribeRandomMaps.push(tribeRandomMap);
      }
    },
  );
  return tribeRandomMaps;
}

export function readTribeRandomMapIdsFromJsonIndex(inputDirectory: string) {
  try {
    return readJsonFileIndex(path.join(inputDirectory, "tribemaps"));
  } catch (_err: unknown) {
    return [];
  }
}
