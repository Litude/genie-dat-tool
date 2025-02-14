import BufferReader from "../../BufferReader";
import {
  createReferenceString,
  getIdFromReferenceString,
} from "../../json/reference-id";
import {
  applyJsonFieldsToObject,
  JsonFieldMapping,
  transformObjectToJson,
} from "../../json/json-serialization";
import { TextFileWriter } from "../../textfile/TextFileWriter";
import { Nullable } from "../../ts/ts-utils";
import { getDataEntry } from "../../util";
import { Habitat } from "../landscape/Habitat";
import { Overlay } from "../landscape/Overlay";
import { Terrain } from "../landscape/Terrain";
import { JsonLoadingContext, LoadingContext } from "../LoadingContext";
import { Technology } from "../research/Technology";
import { SavingContext } from "../SavingContext";
import { SoundEffect } from "../SoundEffect";
import { Sprite } from "../Sprite";
import {
  OverlayId,
  PrototypeId,
  ReferenceStringSchema,
  SoundEffectId,
  SpriteId,
  TechnologyId,
  TerrainId,
} from "../Types";
import {
  asBool8,
  asInt16,
  asUInt8,
  Bool8,
  Bool8Schema,
  Int16,
  Int16Schema,
  UInt8,
  UInt8Schema,
} from "../../ts/base-types";
import {
  AdvancedCombatantObjectPrototype,
  AdvancedCombatantObjectPrototypeSchema,
} from "./AdvancedCombatantObjectPrototype";
import { SceneryObjectPrototype } from "./SceneryObjectPrototype";
import { z } from "zod";

export const BuildingObjectPrototypeSchema =
  AdvancedCombatantObjectPrototypeSchema.merge(
    z.object({
      constructionSpriteId: ReferenceStringSchema,
      adjacentConnectionMode: Bool8Schema,
      graphicsOffset: Int16Schema,
      removeWhenBuilt: UInt8Schema,
      createdObjectIdWhenBuilt: ReferenceStringSchema,
      changedTerrainIdWhenBuilt: ReferenceStringSchema,
      placedOverlayIdWhenBuilt: ReferenceStringSchema,
      researchedTechnologyIdWhenBuilt: ReferenceStringSchema,
      constructionSoundEffectId: ReferenceStringSchema,
    }),
  );
type BuildingObjectPrototypeJson = z.infer<
  typeof BuildingObjectPrototypeSchema
>;

const BuildingObjectPrototypeJsonMapping: JsonFieldMapping<
  BuildingObjectPrototype,
  BuildingObjectPrototypeJson
>[] = [
  {
    jsonField: "constructionSpriteId",
    toJson: (obj) =>
      createReferenceString(
        "Sprite",
        obj.constructionSprite?.referenceId,
        obj.constructionSpriteId,
      ),
  },
  {
    objectField: "constructionSpriteId",
    fromJson: (json, obj, loadingContext) =>
      getIdFromReferenceString<SpriteId>(
        "Sprite",
        obj.referenceId,
        json.constructionSpriteId,
        loadingContext.dataIds.spriteIds,
      ),
  },
  { field: "adjacentConnectionMode" },
  { field: "graphicsOffset" },
  { field: "removeWhenBuilt" },
  {
    jsonField: "createdObjectIdWhenBuilt",
    toJson: (obj) =>
      createReferenceString(
        "ObjectPrototype",
        obj.createdObjectWhenBuilt?.referenceId,
        obj.createdObjectIdWhenBuilt,
      ),
  },
  {
    objectField: "createdObjectIdWhenBuilt",
    fromJson: (json, obj, loadingContext) =>
      getIdFromReferenceString<PrototypeId<Int16>>(
        "ObjectPrototype",
        obj.referenceId,
        json.createdObjectIdWhenBuilt,
        loadingContext.dataIds.prototypeIds,
      ),
  },
  {
    jsonField: "changedTerrainIdWhenBuilt",
    toJson: (obj) =>
      createReferenceString(
        "Terrain",
        obj.changedTerrainWhenBuilt?.referenceId,
        obj.changedTerrainIdWhenBuilt,
      ),
  },
  {
    objectField: "changedTerrainIdWhenBuilt",
    fromJson: (json, obj, loadingContext) =>
      getIdFromReferenceString<TerrainId<Int16>>(
        "Terrain",
        obj.referenceId,
        json.changedTerrainIdWhenBuilt,
        loadingContext.dataIds.terrainIds,
      ),
  },
  {
    jsonField: "placedOverlayIdWhenBuilt",
    toJson: (obj) =>
      createReferenceString(
        "Overlay",
        obj.placedOverlayWhenBuilt?.referenceId,
        obj.placedOverlayIdWhenBuilt,
      ),
  },
  {
    objectField: "placedOverlayIdWhenBuilt",
    fromJson: (json, obj, loadingContext) =>
      getIdFromReferenceString<OverlayId<Int16>>(
        "Overlay",
        obj.referenceId,
        json.placedOverlayIdWhenBuilt,
        loadingContext.dataIds.overlayIds,
      ),
  },
  {
    jsonField: "researchedTechnologyIdWhenBuilt",
    toJson: (obj) =>
      createReferenceString(
        "Technology",
        obj.researchedTechnologyWhenBuilt?.referenceId,
        obj.researchedTechnologyIdWhenBuilt,
      ),
  },
  {
    objectField: "researchedTechnologyIdWhenBuilt",
    fromJson: (json, obj, loadingContext) =>
      getIdFromReferenceString<TechnologyId<Int16>>(
        "Technology",
        obj.referenceId,
        json.researchedTechnologyIdWhenBuilt,
        loadingContext.dataIds.technologyIds,
      ),
  },
  {
    jsonField: "constructionSoundEffectId",
    toJson: (obj) =>
      createReferenceString(
        "SoundEffect",
        obj.constructionSoundEffect?.referenceId,
        obj.constructionSoundEffectId,
      ),
  },
  {
    objectField: "constructionSoundEffectId",
    fromJson: (json, obj, loadingContext) =>
      getIdFromReferenceString<SoundEffectId<Int16>>(
        "SoundEffect",
        obj.referenceId,
        json.constructionSoundEffectId,
        loadingContext.dataIds.soundEffectIds,
      ),
  },
];

export class BuildingObjectPrototype extends AdvancedCombatantObjectPrototype {
  constructionSpriteId: SpriteId = asInt16<SpriteId>(-1);
  constructionSprite: Sprite | null = null;
  adjacentConnectionMode: Bool8 = asBool8(false);
  graphicsOffset: Int16 = asInt16(0); // TODO: Is this the same offset for both the icon graphic and the drawn graphic?
  removeWhenBuilt: UInt8 = asUInt8(0);
  createdObjectIdWhenBuilt: PrototypeId<Int16> =
    asInt16<PrototypeId<Int16>>(-1); // this was probably meant to be combined with the above flag so a unit is created when building is finished and the building itself is removed (not removing the building causes bugs such as the unit being created again when loading a game)
  createdObjectWhenBuilt: SceneryObjectPrototype | null = null;
  changedTerrainIdWhenBuilt: TerrainId<Int16> = asInt16<TerrainId<Int16>>(-1); // changes terrain when building is completed
  changedTerrainWhenBuilt: Terrain | null = null;
  placedOverlayIdWhenBuilt: OverlayId<Int16> = asInt16(-1); // presumably the Build-Road object would remove itself when finished and place an overlay tile of road
  placedOverlayWhenBuilt: Overlay | null = null;
  researchedTechnologyIdWhenBuilt: TechnologyId<Int16> =
    asInt16<TechnologyId<Int16>>(-1); // most buildings unlock some kind of "shadow" technology when built such as enabling its units to be created
  researchedTechnologyWhenBuilt: Technology | null = null;
  constructionSoundEffectId: SoundEffectId<Int16> =
    asInt16<SoundEffectId<Int16>>(-1);
  constructionSoundEffect: SoundEffect | null = null;

  readFromBuffer(
    buffer: BufferReader,
    id: Int16,
    loadingContext: LoadingContext,
  ): void {
    super.readFromBuffer(buffer, id, loadingContext);

    this.constructionSpriteId = buffer.readInt16<SpriteId>();
    this.adjacentConnectionMode = buffer.readBool8();
    this.graphicsOffset = buffer.readInt16();
    this.removeWhenBuilt = buffer.readUInt8();
    this.createdObjectIdWhenBuilt = buffer.readInt16<PrototypeId<Int16>>();
    this.changedTerrainIdWhenBuilt = buffer.readInt16<TerrainId<Int16>>();
    this.placedOverlayIdWhenBuilt = buffer.readInt16();
    this.researchedTechnologyIdWhenBuilt =
      buffer.readInt16<TechnologyId<Int16>>();
    this.constructionSoundEffectId = buffer.readInt16<SoundEffectId<Int16>>();
  }

  readFromJsonFile(
    jsonFile: BuildingObjectPrototypeJson,
    id: PrototypeId<Int16>,
    referenceId: string,
    loadingContext: JsonLoadingContext,
  ) {
    super.readFromJsonFile(jsonFile, id, referenceId, loadingContext);
    applyJsonFieldsToObject(
      jsonFile,
      this,
      BuildingObjectPrototypeJsonMapping,
      loadingContext,
    );
  }

  linkOtherData(
    sprites: Nullable<Sprite>[],
    soundEffects: Nullable<SoundEffect>[],
    terrains: Nullable<Terrain>[],
    habitats: Nullable<Habitat>[],
    objects: Nullable<SceneryObjectPrototype>[],
    technologies: Nullable<Technology>[],
    overlays: Nullable<Overlay>[],
    loadingContext: LoadingContext,
  ) {
    super.linkOtherData(
      sprites,
      soundEffects,
      terrains,
      habitats,
      objects,
      technologies,
      overlays,
      loadingContext,
    );
    this.constructionSprite = getDataEntry(
      sprites,
      this.constructionSpriteId,
      "Sprite",
      this.referenceId,
      loadingContext,
    );
    this.createdObjectWhenBuilt = getDataEntry(
      objects,
      this.createdObjectIdWhenBuilt,
      "ObjectPrototype",
      this.referenceId,
      loadingContext,
    );
    this.changedTerrainWhenBuilt = getDataEntry(
      terrains,
      this.changedTerrainIdWhenBuilt,
      "Terrain",
      this.referenceId,
      loadingContext,
    );
    this.placedOverlayWhenBuilt = getDataEntry(
      overlays,
      this.placedOverlayIdWhenBuilt,
      "Overlay",
      this.referenceId,
      loadingContext,
    );
    this.researchedTechnologyWhenBuilt = getDataEntry(
      technologies,
      this.researchedTechnologyIdWhenBuilt,
      "Technology",
      this.referenceId,
      loadingContext,
    );
    this.constructionSoundEffect = getDataEntry(
      soundEffects,
      this.constructionSoundEffectId,
      "SoundEffect",
      this.referenceId,
      loadingContext,
    );
  }

  appendToTextFile(
    textFileWriter: TextFileWriter,
    savingContext: SavingContext,
  ): void {
    super.appendToTextFile(textFileWriter, savingContext);
    textFileWriter
      .indent(4)
      .integer(this.constructionSpriteId)
      .integer(this.adjacentConnectionMode ? 1 : 0)
      .integer(this.graphicsOffset)
      .integer(this.removeWhenBuilt)
      .integer(this.createdObjectIdWhenBuilt)
      .integer(this.changedTerrainIdWhenBuilt)
      .integer(this.placedOverlayIdWhenBuilt)
      .integer(this.researchedTechnologyIdWhenBuilt)
      .integer(this.constructionSoundEffectId)
      .eol();
  }

  toJson(savingContext: SavingContext) {
    return {
      ...super.toJson(savingContext),
      ...transformObjectToJson(
        this,
        BuildingObjectPrototypeJsonMapping,
        savingContext,
      ),
    };
  }
}
