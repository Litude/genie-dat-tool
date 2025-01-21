import BufferReader from "../BufferReader";
import { LoadingContext } from "./LoadingContext";
import { ArchitectureStyleId, asInt16, asUInt8, Float32, Int16, StateEffectId, UInt8 } from "./Types";

export class Civilization {
    civilizationType: UInt8 = asUInt8(1); // should always be 1 for a valid civilization
    internalName: string = "";
    bonusEffect: StateEffectId<Int16> = asInt16(-1);
    attributes: Float32[] = [];
    architectureStyle: ArchitectureStyleId<UInt8> = asUInt8(0);

    readFromBuffer(buffer: BufferReader, loadingContext: LoadingContext): void {
        this.civilizationType = buffer.readUInt8();
        this.internalName = buffer.readFixedSizeString(20);
        const attributeCount = buffer.readInt16();
        this.bonusEffect = buffer.readInt16();

        this.attributes = [];
        for (let i = 0; i < attributeCount; ++i) {
            this.attributes.push(buffer.readFloat32());
        }
        this.architectureStyle = buffer.readUInt8();
    }
}
