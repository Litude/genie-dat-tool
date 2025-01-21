import BufferReader from "../../BufferReader";
import { LoadingContext } from "../LoadingContext";
import { AbilityId, asFloat32, asInt16, asUInt8, Float32, Int16, PrototypeId, SoundEffectId, UInt8 } from "../Types";
import { Ability } from "./Ability";
import { MobileObjectPrototype } from "./MobileObjectPrototype";
import { ObjectType } from "./ObjectType";

export class ActorObjectPrototype extends MobileObjectPrototype {
    defaultAbility: AbilityId<Int16> = asInt16(-1);
    searchRadius: Float32 = asFloat32(0);
    workRate: Float32 = asFloat32(0);
    dropSites: PrototypeId<Int16>[] = [];
    abilitySwapGroup: UInt8 = asUInt8(0);
    attackSoundId: SoundEffectId<Int16> = asInt16(-1);
    moveSoundId: SoundEffectId<Int16> = asInt16(-1);
    runPattern: UInt8 = asUInt8(0);
    abilityList: Ability[] = [];
    
    readFromBuffer(buffer: BufferReader, loadingContext: LoadingContext): void {
        super.readFromBuffer(buffer, loadingContext);
        this.defaultAbility = buffer.readInt16();
        this.searchRadius = buffer.readFloat32();
        this.workRate = buffer.readFloat32();

        this.dropSites = [];
        for (let i = 0; i < 2; ++i) {
            this.dropSites.push(buffer.readInt16());
        }
        this.abilitySwapGroup = buffer.readUInt8();
        this.attackSoundId = buffer.readInt16();
        this.moveSoundId = buffer.readInt16();
        this.runPattern = buffer.readUInt8();

        this.abilityList = [];
        const abilityCount = buffer.readInt16();
        for (let i = 0; i < abilityCount; ++i) {
            const ability = new Ability();
            ability.readFromBuffer(buffer, loadingContext);
            this.abilityList.push(ability);
        }
    }
}