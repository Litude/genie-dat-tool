import BufferReader from "../../BufferReader";
import { createReferenceString } from "../../json/reference-id";
import { OldJsonFieldConfig } from "../../json/json-serialization";
import { TextFileWriter } from "../../textfile/TextFileWriter";
import { Nullable } from "../../ts/ts-utils";
import { getDataEntry } from "../../util";
import { Terrain } from "../landscape/Terrain";
import { LoadingContext } from "../LoadingContext";
import { SavingContext } from "../SavingContext";
import { SoundEffect } from "../SoundEffect";
import { Sprite } from "../Sprite";
import { AbilityId, ActionId, asBool8, asFloat32, asInt16, asUInt8, AttributeId, Bool8, Float32, Int16, PrototypeId, SoundEffectId, SpriteId, TerrainId, UInt8 } from "../Types";
import { ObjectClass, ObjectClasses } from "./ObjectClass";
import { SceneryObjectPrototype } from "./SceneryObjectPrototype";

const jsonFields: OldJsonFieldConfig<Ability>[] = [
    { field: "abilityType" },
    { field: "defaultAbility" },
    { field: "actionType" },
    { field: "objectClass" },
    { field: "objectPrototypeId", toJson: (obj) => createReferenceString("ObjectPrototype", obj.objectPrototype?.referenceId, obj.objectPrototypeId) },
    { field: "terrainId", toJson: (obj) => createReferenceString("Terrain", obj.terrain?.referenceId, obj.terrainId) },
    { field: "attributeType1" },
    { field: "attributeType2" },
    { field: "attributeType3" },
    { field: "attributeType4" },
    { field: "workRate1" },
    { field: "workRate2" },
    { field: "autoSearchTargets" },
    { field: "searchWaitTime" },
    { field: "enableTargeting" },
    { field: "combatLevelFlag" },
    { field: "workFlag1" },
    { field: "workFlag2" },
    { field: "targetDiplomacyType" },
    { field: "holdingAttributeCheck" },
    { field: "buildingTarget" },
    { field: "moveSpriteId", toJson: (obj) => createReferenceString("Sprite", obj.moveSprite?.referenceId, obj.moveSpriteId)},
    { field: "workPreceedingSpriteId", toJson: (obj) => createReferenceString("Sprite", obj.workPreceedingSprite?.referenceId, obj.workPreceedingSpriteId)},
    { field: "workActiveSpriteId", toJson: (obj) => createReferenceString("Sprite", obj.workActiveSprite?.referenceId, obj.workActiveSpriteId)},
    { field: "carrySpriteId", toJson: (obj) => createReferenceString("Sprite", obj.carrySprite?.referenceId, obj.carrySpriteId)},
    { field: "resourceGatheringSoundId", toJson: (obj) => createReferenceString("SoundEffect", obj.resourceGatheringSound?.referenceId, obj.resourceGatheringSoundId) },
    { field: "resourceDepositSoundId", toJson: (obj) => createReferenceString("SoundEffect", obj.resourceDepositSound?.referenceId, obj.resourceDepositSoundId) },
]

export class Ability {
    abilityType: AbilityId<Int16> = asInt16(1); // always 1;
    index: Int16 = asInt16(-1);
    defaultAbility: Bool8 = asBool8(false);
    actionType: ActionId<Int16> = asInt16(0);
    objectClass: ObjectClass = ObjectClasses.None;
    objectPrototypeId: PrototypeId<Int16> = asInt16(-1);
    objectPrototype: SceneryObjectPrototype | null = null;
    terrainId: TerrainId<Int16> = asInt16(-1);
    terrain: Terrain | null = null;
    attributeType1: AttributeId<Int16> = asInt16(-1);
    attributeType2: AttributeId<Int16> = asInt16(-1);
    attributeType3: AttributeId<Int16> = asInt16(-1);
    attributeType4: AttributeId<Int16> = asInt16(-1);
    workRate1: Float32 = asFloat32(0);
    workRate2: Float32 = asFloat32(0);
    workRange: Float32 = asFloat32(0);
    autoSearchTargets: Bool8 = asBool8(false);
    searchWaitTime: Float32 = asFloat32(0);
    enableTargeting: UInt8 = asUInt8(0);
    combatLevelFlag: UInt8 = asUInt8(0);
    workFlag1: Int16 = asInt16(0);
    workFlag2: Int16 = asInt16(0);
    targetDiplomacyType: UInt8 = asUInt8(0); // is this a bit flag?
    holdingAttributeCheck: UInt8 = asUInt8(0);
    buildingTarget: Bool8 = asBool8(false);
    moveSpriteId: SpriteId<Int16> = asInt16(-1);
    moveSprite: Sprite | null = null;
    workPreceedingSpriteId: SpriteId<Int16> = asInt16(-1);
    workPreceedingSprite: Sprite | null = null;
    workActiveSpriteId: SpriteId<Int16> = asInt16(-1);
    workActiveSprite: Sprite | null = null;
    carrySpriteId: SpriteId<Int16> = asInt16(-1);
    carrySprite: Sprite | null = null;
    resourceGatheringSoundId: SoundEffectId<Int16> = asInt16(-1);
    resourceGatheringSound: SoundEffect | null = null;
    resourceDepositSoundId: SoundEffectId<Int16> = asInt16(-1);
    resourceDepositSound: SoundEffect | null = null;

    readFromBuffer(buffer: BufferReader, loadingContext: LoadingContext): void {
        this.abilityType = buffer.readInt16();
        this.index = buffer.readInt16();
        this.defaultAbility = buffer.readBool8();
        this.actionType = buffer.readInt16();
        this.objectClass = buffer.readInt16();
        this.objectPrototypeId = buffer.readInt16();
        this.terrainId = buffer.readInt16();
        this.attributeType1 = buffer.readInt16();
        this.attributeType2 = buffer.readInt16();
        this.attributeType3 = buffer.readInt16();
        this.attributeType4 = buffer.readInt16();
        this.workRate1 = buffer.readFloat32();
        this.workRate2 = buffer.readFloat32();
        this.workRange = buffer.readFloat32();
        this.autoSearchTargets = buffer.readBool8();
        this.searchWaitTime = buffer.readFloat32();
        this.enableTargeting = buffer.readUInt8();
        this.combatLevelFlag = buffer.readUInt8();
        this.workFlag1 = buffer.readInt16();
        this.workFlag2 = buffer.readInt16();
        this.targetDiplomacyType = buffer.readUInt8();
        this.holdingAttributeCheck = buffer.readUInt8();
        this.buildingTarget = buffer.readBool8();
        this.moveSpriteId = buffer.readInt16();
        this.workPreceedingSpriteId = buffer.readInt16();
        this.workActiveSpriteId = buffer.readInt16();
        this.carrySpriteId = buffer.readInt16();
        this.resourceGatheringSoundId = buffer.readInt16();
        this.resourceDepositSoundId = buffer.readInt16();
    }
    
    linkOtherData(parentReferenceId: string, sprites: Nullable<Sprite>[], soundEffects: Nullable<SoundEffect>[], terrains: Nullable<Terrain>[], objects: Nullable<SceneryObjectPrototype>[], loadingContext: LoadingContext) {
        this.objectPrototype = getDataEntry(objects, this.objectPrototypeId, "ObjectPrototype", parentReferenceId, loadingContext);
        this.terrain = getDataEntry(terrains, this.terrainId, "Terrain", parentReferenceId, loadingContext);
        this.moveSprite = getDataEntry(sprites, this.moveSpriteId, "Sprite", parentReferenceId, loadingContext);
        this.workPreceedingSprite = getDataEntry(sprites, this.workPreceedingSpriteId, "Sprite", parentReferenceId, loadingContext);
        this.workActiveSprite = getDataEntry(sprites, this.workActiveSpriteId, "Sprite", parentReferenceId, loadingContext);
        this.carrySprite = getDataEntry(sprites, this.carrySpriteId, "Sprite", parentReferenceId, loadingContext);

        this.resourceGatheringSound = getDataEntry(soundEffects, this.resourceGatheringSoundId, "SoundEffect", parentReferenceId, loadingContext);
        this.resourceDepositSound = getDataEntry(soundEffects, this.resourceDepositSoundId, "SoundEffect", parentReferenceId, loadingContext);
    }

    writeToTextFile(textFileWriter: TextFileWriter, savingContext: SavingContext) {
        textFileWriter
            .indent(6)
            .integer(this.abilityType)
            .integer(this.index)
            .integer(this.defaultAbility ? 1 : 0)
            .integer(this.actionType)
            .integer(this.objectClass)
            .integer(this.objectPrototypeId)
            .integer(this.terrainId)
            .integer(this.attributeType1)
            .integer(this.attributeType2)
            .integer(this.attributeType3)
            .integer(this.attributeType4)
            .float(this.workRate1)
            .float(this.workRate2)
            .float(this.workRange)
            .integer(this.autoSearchTargets ? 1 : 0)
            .float(this.searchWaitTime)
            .eol();

        textFileWriter
            .indent(10)
            .integer(this.enableTargeting)
            .integer(this.combatLevelFlag)
            .integer(this.workFlag1)
            .integer(this.workFlag2)
            .integer(this.targetDiplomacyType)
            .integer(this.holdingAttributeCheck)
            .integer(this.buildingTarget ? 1 : 0)
            .integer(this.moveSpriteId)
            .integer(this.workPreceedingSpriteId)
            .integer(this.workActiveSpriteId)
            .integer(this.carrySpriteId)
            .integer(this.resourceGatheringSoundId)
            .integer(this.resourceDepositSoundId)
            .eol();
    }
    
    getJsonConfig(): OldJsonFieldConfig<Ability>[] {
        return jsonFields; 
    }
}
