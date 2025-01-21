import BufferReader from "../../BufferReader";
import { LoadingContext } from "../LoadingContext";
import { asInt16, asUInt8, AttributeId, Bool8, Int16, PrototypeId, UInt8 } from "../Types";
import { CombatantObjectPrototype } from "./CombatantObjectPrototype";
import { ObjectType } from "./ObjectType";

interface ResourceCost {
    attributeId: AttributeId<Int16>;
    amount: Int16;
    costDeducted: Bool8; // todo: figure out what this really is...? 
    padding05: UInt8;
}

export class AdvancedCombatantObjectPrototype extends CombatantObjectPrototype {
    resourceCosts: ResourceCost[] = [];
    creationDuration: Int16 = asInt16(0);
    creationLocation: PrototypeId<Int16> = asInt16(-1);
    creationButtonIndex: UInt8 = asUInt8(0);
    originalPierceArmorValue: Int16 = asInt16(0);

    readFromBuffer(buffer: BufferReader, loadingContext: LoadingContext): void {
        super.readFromBuffer(buffer, loadingContext);

        this.resourceCosts = [];
        for (let i = 0; i < 3; ++i) {
            this.resourceCosts.push({
                attributeId: buffer.readInt16(),
                amount: buffer.readInt16(),
                costDeducted: buffer.readBool8(),
                padding05: buffer.readUInt8()
            });
        }
        this.creationDuration = buffer.readInt16();
        this.creationLocation = buffer.readInt16();
        this.creationButtonIndex = buffer.readUInt8();
        this.originalPierceArmorValue = buffer.readInt16();
    }

}