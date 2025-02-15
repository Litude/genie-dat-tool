import semver from "semver";
import BufferReader from "../../BufferReader";
import { Point3D, Point3DSchema } from "../../geometry/Point";
import { TextFileWriter } from "../../textfile/TextFileWriter";
import {
  DatLoadingContext,
  JsonLoadingContext,
  LoadingContext,
} from "../LoadingContext";
import { SavingContext } from "../SavingContext";
import {
  HabitatId,
  Percentage,
  PrototypeId,
  ReferenceStringSchema,
  SpriteId,
} from "../Types";
import {
  asFloat32,
  asInt16,
  asUInt8,
  Float32,
  Float32Schema,
  Int16,
  Int16Schema,
  UInt8,
  UInt8Schema,
} from "../../ts/base-types";
import {
  ActorObjectPrototype,
  ActorObjectPrototypeSchema,
} from "./ActorObjectPrototype";
import {
  applyJsonFieldsToObject,
  JsonFieldMapping,
  transformObjectToJson,
} from "../../json/json-serialization";
import { Habitat } from "../landscape/Habitat";
import { SceneryObjectPrototype } from "./SceneryObjectPrototype";
import { Sprite } from "../Sprite";
import {
  createReferenceString,
  getIdFromReferenceString,
} from "../../json/reference-id";
import { Nullable } from "../../ts/ts-utils";
import { SoundEffect } from "../SoundEffect";
import { Terrain } from "../landscape/Terrain";
import { getDataEntry } from "../../util";
import { Technology } from "../research/Technology";
import { Overlay } from "../landscape/Overlay";
import { z } from "zod";

interface DamageValue {
  type: Int16;
  amount: Int16;
}

export const DamageValueSchema = z.object({
  type: Int16Schema,
  amount: Int16Schema,
});

export const CombatantObjectPrototypeSchema = ActorObjectPrototypeSchema.merge(
  z.object({
    baseArmor: UInt8Schema,
    attackTypes: z.array(DamageValueSchema),
    armorTypes: z.array(DamageValueSchema),
    bonusHabitatId: ReferenceStringSchema,
    maxRange: Float32Schema,
    blastRadius: Float32Schema,
    attackSpeed: Float32Schema,
    projectileUnitId: ReferenceStringSchema,
    accuracy: Int16Schema,
    breakOffCombat: UInt8Schema.optional(),
    attackFrame: Int16Schema,
    projectileOffset: Point3DSchema(Float32Schema),
    blastAttackLevel: UInt8Schema,
    minRange: Float32Schema,
    attackSpriteId: ReferenceStringSchema,
    originalArmorValue: Int16Schema.optional(),
    originalAttackValue: Int16Schema.optional(),
    originalRangeValue: Float32Schema.optional(),
    originalAttackSpeed: Float32Schema.optional(),
  }),
);

type CombatantObjectPrototypeJson = z.infer<
  typeof CombatantObjectPrototypeSchema
>;

const CombatantObjectPrototypeJsonMapping: JsonFieldMapping<
  CombatantObjectPrototype,
  CombatantObjectPrototypeJson
>[] = [
  { field: "baseArmor" },
  { field: "attackTypes" },
  { field: "armorTypes" },
  {
    jsonField: "bonusHabitatId",
    toJson: (obj) =>
      createReferenceString(
        "Habitat",
        obj.bonusHabitat?.referenceId,
        obj.bonusHabitatId,
      ),
  },
  {
    objectField: "bonusHabitatId",
    fromJson: (json, obj, loadingContext) =>
      getIdFromReferenceString<HabitatId>(
        "Habitat",
        obj.referenceId,
        json.habitatId,
        loadingContext.dataIds.habitatIds,
      ),
  },
  { field: "maxRange" },
  { field: "blastRadius" },
  { field: "attackSpeed" },
  {
    jsonField: "projectileUnitId",
    toJson: (obj) =>
      createReferenceString(
        "ObjectPrototype",
        obj.projectileUnit?.referenceId,
        obj.projectileUnitId,
      ),
  },
  {
    objectField: "projectileUnitId",
    fromJson: (json, obj, loadingContext) =>
      getIdFromReferenceString<PrototypeId<Int16>>(
        "ObjectPrototype",
        obj.referenceId,
        json.projectileUnitId,
        loadingContext.dataIds.prototypeIds,
      ),
  },
  { field: "accuracy" },
  { field: "breakOffCombat", flags: { unusedField: true } },
  { field: "attackFrame" },
  { field: "projectileOffset" },
  { field: "blastAttackLevel" },
  { field: "minRange" },
  {
    jsonField: "attackSpriteId",
    toJson: (obj) =>
      createReferenceString(
        "Sprite",
        obj.attackSprite?.referenceId,
        obj.attackSpriteId,
      ),
  },
  {
    objectField: "attackSpriteId",
    fromJson: (json, obj, loadingContext) =>
      getIdFromReferenceString<SpriteId>(
        "Sprite",
        obj.referenceId,
        json.attackSpriteId,
        loadingContext.dataIds.spriteIds,
      ),
  },
  { field: "originalArmorValue", versionFrom: "3.2.0" },
  { field: "originalAttackValue", versionFrom: "3.2.0" },
  { field: "originalRangeValue", versionFrom: "3.2.0" },
  { field: "originalAttackSpeed", versionFrom: "3.2.0" },
];

export class CombatantObjectPrototype extends ActorObjectPrototype {
  baseArmor: UInt8 = asUInt8(0);
  attackTypes: DamageValue[] = [];
  armorTypes: DamageValue[] = [];
  bonusHabitatId: HabitatId = asInt16<HabitatId>(-1); // attack/defense values are multiplied based on this value
  bonusHabitat: Habitat | null = null;
  maxRange: Float32 = asFloat32(0);
  blastRadius: Float32 = asFloat32(0); // or is this diameter?
  attackSpeed: Float32 = asFloat32(0);
  projectileUnitId: PrototypeId<Int16> = asInt16<PrototypeId<Int16>>(-1);
  projectileUnit: SceneryObjectPrototype | null = null;
  accuracy: Percentage<Int16> = asInt16(0);
  breakOffCombat: UInt8 = asUInt8(0); // obsolete?
  attackFrame: Int16 = asInt16(0); // is this only for projectiles?
  projectileOffset: Point3D<Float32> = {
    x: asFloat32(0),
    y: asFloat32(0),
    z: asFloat32(0),
  };
  blastAttackLevel: UInt8 = asUInt8(0);
  minRange: Float32 = asFloat32(0);
  attackSpriteId: SpriteId = asInt16<SpriteId>(-1);
  attackSprite: Sprite | null = null;
  originalArmorValue: Int16 = asInt16(0);
  originalAttackValue: Int16 = asInt16(0);
  originalRangeValue: Float32 = asFloat32(0);
  originalAttackSpeed: Float32 = asFloat32(0);

  readFromBuffer(
    buffer: BufferReader,
    id: Int16,
    loadingContext: DatLoadingContext,
  ): void {
    super.readFromBuffer(buffer, id, loadingContext);
    this.baseArmor = buffer.readUInt8();

    const attackTypeCount = buffer.readInt16();
    this.attackTypes = [];
    for (let i = 0; i < attackTypeCount; ++i) {
      this.attackTypes.push({
        type: buffer.readInt16(),
        amount: buffer.readInt16(),
      });
    }
    const armorTypeCount = buffer.readInt16();
    this.armorTypes = [];
    for (let i = 0; i < armorTypeCount; ++i) {
      this.armorTypes.push({
        type: buffer.readInt16(),
        amount: buffer.readInt16(),
      });
    }
    this.bonusHabitatId = buffer.readInt16<HabitatId>();
    this.maxRange = buffer.readFloat32();
    this.blastRadius = buffer.readFloat32();
    this.attackSpeed = buffer.readFloat32();
    this.projectileUnitId = buffer.readInt16<PrototypeId<Int16>>();
    this.accuracy = buffer.readInt16();
    this.breakOffCombat = buffer.readUInt8();
    this.attackFrame = buffer.readInt16();
    this.projectileOffset = {
      x: buffer.readFloat32(),
      y: buffer.readFloat32(),
      z: buffer.readFloat32(),
    };
    this.blastAttackLevel = buffer.readUInt8();
    this.minRange = buffer.readFloat32();
    this.attackSpriteId = buffer.readInt16<SpriteId>();
    if (semver.gte(loadingContext.version.numbering, "3.2.0")) {
      this.originalArmorValue = buffer.readInt16();
      this.originalAttackValue = buffer.readInt16();
      this.originalRangeValue = buffer.readFloat32();
      this.originalAttackSpeed = buffer.readFloat32();
    } else {
      this.originalArmorValue = asInt16(
        Math.max(this.baseArmor, ...this.armorTypes.map((x) => x.amount)),
      );
      this.originalAttackValue = asInt16(
        Math.max(0, ...this.attackTypes.map((x) => x.amount)),
      );
      this.originalRangeValue = this.maxRange;
      this.originalAttackSpeed = this.attackSpeed;
    }
  }

  readFromJsonFile(
    jsonFile: CombatantObjectPrototypeJson,
    id: PrototypeId<Int16>,
    referenceId: string,
    loadingContext: JsonLoadingContext,
  ) {
    super.readFromJsonFile(jsonFile, id, referenceId, loadingContext);
    applyJsonFieldsToObject(
      jsonFile,
      this,
      CombatantObjectPrototypeJsonMapping,
      loadingContext,
    );

    // 3.2.0+
    if (jsonFile.originalArmorValue === undefined) {
      this.originalArmorValue = asInt16(
        Math.max(this.baseArmor, ...this.armorTypes.map((x) => x.amount)),
      );
    }
    if (jsonFile.originalAttackValue === undefined) {
      this.originalAttackValue = asInt16(
        Math.max(0, ...this.attackTypes.map((x) => x.amount)),
      );
    }
    if (jsonFile.originalRangeValue === undefined) {
      this.originalRangeValue = this.maxRange;
    }
    if (jsonFile.originalAttackSpeed === undefined) {
      this.originalAttackSpeed = this.attackSpeed;
    }
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
    this.bonusHabitat = getDataEntry(
      habitats,
      this.bonusHabitatId,
      "Habitat",
      this.referenceId,
      loadingContext,
    );
    this.projectileUnit = getDataEntry(
      objects,
      this.projectileUnitId,
      "ObjectPrototype",
      this.referenceId,
      loadingContext,
    );
    this.attackSprite = getDataEntry(
      sprites,
      this.attackSpriteId,
      "Sprite",
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
      .integer(this.attackSpriteId)
      .integer(this.baseArmor)
      .integer(this.armorTypes.length)
      .integer(this.attackTypes.length)
      .integer(this.bonusHabitatId)
      .float(this.maxRange)
      .float(this.blastRadius)
      .float(this.attackSpeed)
      .integer(this.projectileUnitId)
      .integer(this.accuracy)
      .integer(this.breakOffCombat)
      .integer(this.attackFrame)
      .float(this.projectileOffset.x)
      .float(this.projectileOffset.y)
      .float(this.projectileOffset.z)
      .integer(this.blastAttackLevel)
      .float(this.minRange)
      .eol();

    [...this.armorTypes, ...this.attackTypes].forEach((damageType) => {
      textFileWriter
        .indent(6)
        .integer(damageType.type)
        .integer(damageType.amount)
        .eol();
    });
  }

  toJson(savingContext: SavingContext) {
    return {
      ...super.toJson(savingContext),
      ...transformObjectToJson(
        this,
        CombatantObjectPrototypeJsonMapping,
        savingContext,
      ),
    };
  }
}
