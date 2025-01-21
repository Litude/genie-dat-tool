import BufferReader from "../../BufferReader";
import { LoadingContext } from "../LoadingContext";
import { AbilityId, ActionId, asBool8, asFloat32, asInt16, asUInt8, AttributeId, Bool8, Float32, Int16, PrototypeId, SoundEffectId, SpriteId, TerrainId, UInt8 } from "../Types";
import { ObjectClass } from "./ObjectClass";

export class Ability {
    abilityType: AbilityId<Int16> = asInt16(1); // always 1;
    index: Int16 = asInt16(-1);
    defaultAbility: Bool8 = asBool8(false);
    actionType: ActionId<Int16> = asInt16(0);
    objectClass: Int16 = ObjectClass.None;
    objectPrototypeId: PrototypeId<Int16> = asInt16(-1);
    terrainId: TerrainId<Int16> = asInt16(-1);
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
    workProceedingSpriteId: SpriteId<Int16> = asInt16(-1);
    workActiveSpriteId: SpriteId<Int16> = asInt16(-1);
    carrySpriteId: SpriteId<Int16> = asInt16(-1);
    resourceGatheringSoundId: SoundEffectId<Int16> = asInt16(-1);
    resourceDepositSoundId: SoundEffectId<Int16> = asInt16(-1);

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
        this.workProceedingSpriteId = buffer.readInt16();
        this.workActiveSpriteId = buffer.readInt16();
        this.carrySpriteId = buffer.readInt16();
        this.resourceGatheringSoundId = buffer.readInt16();
        this.resourceDepositSoundId = buffer.readInt16();
    }
}