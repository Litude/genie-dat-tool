import BufferReader from "../../BufferReader";
import { TextFileWriter } from "../../textfile/TextFileWriter";
import { LoadingContext } from "../LoadingContext";
import { SavingContext } from "../SavingContext";
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
    
    readFromBuffer(buffer: BufferReader, id: Int16, loadingContext: LoadingContext): void {
        super.readFromBuffer(buffer, id, loadingContext);
        this.defaultAbility = buffer.readInt16();
        this.searchRadius = buffer.readFloat32();
        this.workRate = buffer.readFloat32();

        this.dropSites = [];
        const dropSiteCount = loadingContext.version >= 1.31 ? 2 : 1;
        for (let i = 0; i < dropSiteCount; ++i) {
            this.dropSites.push(buffer.readInt16());
        }
        for (let i = this.dropSites.length; i < 2; ++i) {
            this.dropSites.push(asInt16(-1));
        }

        this.abilitySwapGroup = buffer.readUInt8();
        this.attackSoundId = buffer.readInt16();
        if (loadingContext.version >= 3.11) {
            this.moveSoundId = buffer.readInt16();
        }
        else {
            this.moveSoundId = this.attackSoundId;
        }
        this.runPattern = buffer.readUInt8();

        this.abilityList = [];
        const abilityCount = buffer.readInt16();
        for (let i = 0; i < abilityCount; ++i) {
            const ability = new Ability();
            ability.readFromBuffer(buffer, loadingContext);
            this.abilityList.push(ability);
        }
    }

    writeToTextFile(textFileWriter: TextFileWriter, savingContext: SavingContext): void {
        super.writeToTextFile(textFileWriter, savingContext)
        textFileWriter
            .indent(4)
            .float(this.searchRadius)
            .float(this.workRate)
            .integer(this.dropSites[0])
            .conditional(savingContext.version >= 1.31, writer => writer.integer(this.dropSites[1]))
            .integer(this.abilitySwapGroup)
            .integer(this.attackSoundId)
            .conditional(
                savingContext.version >= 3.11,
                writer => writer.integer(this.moveSoundId)
            )
            .integer(this.runPattern)
            .eol();
        
        textFileWriter
            .indent(4)
            .raw(this.abilityList.length)
            .eol();

        this.abilityList.forEach(ability => {
            ability.writeToTextFile(textFileWriter, savingContext);
        })
    }
}
