import BufferReader from "../../BufferReader";
import { LoadingContext } from "../LoadingContext";
import { asInt16, asInt32, asUInt8, AttributeId, Bool8, Int16, Int32, PrototypeId, StateEffectId, StringId, TechnologyId, UInt8 } from "../Types";

interface TechnologyResourceCost {
    attributeId: AttributeId<Int16>;
    amount: Int16;
    costDeducted: Bool8;
}

export class Technology {
    internalName: string = "";
    prerequisiteTechnologyIds: TechnologyId<Int16>[] = [];
    resourceCosts: TechnologyResourceCost[] = [];
    minimumPrerequisites: Int16 = asInt16(0);
    researchLocation: PrototypeId<Int16> = asInt16(-1);
    nameStringId: StringId<Int16> = asInt16(-1);
    researchStringId: StringId<Int16> = asInt16(-1);
    researchDuration: Int16 = asInt16(0);
    stateEffectId: StateEffectId<Int16> = asInt16(-1);
    technologyType: Int16 = asInt16(0); // used by old AI for tracking similar technologies
    iconNumber: Int16 = asInt16(0);
    researchButtonIndex: UInt8 = asUInt8(0);
    helpDialogStringId: StringId<Int32> = asInt32(-1); // The game actually only supports 16-bit string indexes, higher values will overflow
    helpPageStringId: StringId<Int32> = asInt32(-1);
    hotkeyStringId: StringId<Int32> = asInt32(-1);

    readFromBuffer(buffer: BufferReader, loadingContext: LoadingContext): void {
        this.prerequisiteTechnologyIds = [];
        for (let i = 0; i < 4; ++i) {
            this.prerequisiteTechnologyIds.push(buffer.readInt16());
        }
        this.resourceCosts = [];
        for (let i = 0; i < 3; ++i) {
            this.resourceCosts.push({
                attributeId: buffer.readInt16(),
                amount: buffer.readInt16(),
                costDeducted: buffer.readBool8()
            });
        }
        this.minimumPrerequisites = buffer.readInt16();
        this.researchLocation = buffer.readInt16();
        this.nameStringId = buffer.readInt16();
        this.researchStringId = buffer.readInt16();
        this.researchDuration = buffer.readInt16();
        this.stateEffectId = buffer.readInt16();
        this.technologyType = buffer.readInt16();
        this.iconNumber = buffer.readInt16();
        this.researchButtonIndex = buffer.readUInt8();
        this.helpDialogStringId = buffer.readInt32();
        this.helpPageStringId = buffer.readInt32();
        this.hotkeyStringId = buffer.readInt32();
        this.internalName = buffer.readPascalString16();
    }

    toString() {
        return this.internalName;
    }
}

export function readTechnologiesFromBuffer(buffer: BufferReader, loadingContent: LoadingContext): Technology[] {
    const result: Technology[] = [];
    const technologyCount = buffer.readInt16();
    for (let i = 0; i < technologyCount; ++i) {
        const technology = new Technology();
        technology.readFromBuffer(buffer, loadingContent);
        result.push(technology);
    }

    return result;
}
