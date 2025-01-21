import BufferReader from "../../BufferReader";
import { Point3D } from "../../geometry/Point";
import { LoadingContext } from "../LoadingContext";
import { asFloat32, asInt16, asUInt8, Float32, HabitatId, Int16, Percentage, PrototypeId, SpriteId, UInt8 } from "../Types";
import { ActorObjectPrototype } from "./ActorObjectPrototype";
import { ObjectType } from "./ObjectType";

interface DamageValue {
    type: Int16;
    amount: Int16;
}

export class CombatantObjectPrototype extends ActorObjectPrototype {
    baseArmor: UInt8 = asUInt8(0);
    attackTypes: DamageValue[] = [];
    armorTypes: DamageValue[] = [];
    bonusHabitat: HabitatId<Int16> = asInt16(-1); // attack/defense values are multiplied based on this value
    maxRange: Float32 = asFloat32(0);
    blastRadius: Float32 = asFloat32(0); // or is this diameter?
    attackSpeed: Float32 = asFloat32(0);
    projectileUnitId: PrototypeId<Int16> = asInt16(-1);
    accuracy: Percentage<Int16> = asInt16(0);
    breakOffCombat: UInt8 = asUInt8(0); // obsolete?
    attackFrame: Int16 = asInt16(0); // is this only for projectiles?
    projectileOffset: Point3D<Float32> = {
        x: asFloat32(0),
        y: asFloat32(0),
        z: asFloat32(0)
    };
    blastAttackLevel: UInt8 = asUInt8(0);
    minRange: Float32 = asFloat32(0);
    attackSpriteId: SpriteId<Int16> = asInt16(-1);
    originalArmorValue: Int16 = asInt16(0);
    originalAttackValue: Int16 = asInt16(0);
    originalRangeValue: Float32 = asFloat32(0);
    originalAttackSpeed: Float32 = asFloat32(0);
    
    readFromBuffer(buffer: BufferReader, loadingContext: LoadingContext): void {
        super.readFromBuffer(buffer, loadingContext);
        this.baseArmor = buffer.readUInt8();

        const attackTypeCount = buffer.readInt16();
        this.attackTypes = [];
        for (let i = 0; i < attackTypeCount; ++i) {
            this.attackTypes.push({
                type: buffer.readInt16(),
                amount: buffer.readInt16()
            });
        }
        const armorTypeCount = buffer.readInt16();
        this.armorTypes = [];
        for (let i = 0; i < armorTypeCount; ++i) {
            this.armorTypes.push({
                type: buffer.readInt16(),
                amount: buffer.readInt16()
            });
        }
        this.bonusHabitat = buffer.readInt16();
        this.maxRange = buffer.readFloat32();
        this.blastRadius = buffer.readFloat32();
        this.attackSpeed = buffer.readFloat32();
        this.projectileUnitId = buffer.readInt16();
        this.accuracy = buffer.readInt16();
        this.breakOffCombat = buffer.readUInt8();
        this.attackFrame = buffer.readInt16();
        this.projectileOffset = {
            x: buffer.readFloat32(),
            y: buffer.readFloat32(),
            z: buffer.readFloat32()
        };
        this.blastAttackLevel = buffer.readUInt8();
        this.minRange = buffer.readFloat32();
        this.attackSpriteId = buffer.readInt16();
        this.originalArmorValue = buffer.readInt16();
        this.originalAttackValue = buffer.readInt16();
        this.originalRangeValue = buffer.readFloat32();
        this.originalAttackSpeed = buffer.readFloat32();
    }
}
