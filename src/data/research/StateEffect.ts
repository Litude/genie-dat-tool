import BufferReader from "../../BufferReader";
import { LoadingContext } from "../LoadingContext";
import { Float32, Int16, UInt8 } from "../Types";

interface EffectCommand {
    commandType: UInt8;
    value1: Int16;
    value2: Int16;
    value3: Int16;
    value4: Float32;
}

export class StateEffect {
    internalName: string = "";
    commands: EffectCommand[] = [];

    readFromBuffer(buffer: BufferReader, loadingContext: LoadingContext): void {
        this.internalName = buffer.readFixedSizeString(31);
        const commandCount = buffer.readInt16();
        this.commands = [];
        for (let i = 0; i < commandCount; ++i) {
            this.commands.push({
                commandType: buffer.readUInt8(),
                value1: buffer.readInt16(),
                value2: buffer.readInt16(),
                value3: buffer.readInt16(),
                value4: buffer.readFloat32(),
            });
        }
    }

    toString() {
        return JSON.stringify(this);
    }
}

export function readStateEffects(buffer: BufferReader, loadingContext: LoadingContext): StateEffect[] {
    const result: StateEffect[] = [];
    const effectCount = buffer.readInt32();
    for (let i = 0; i < effectCount; ++i) {
        const stateEffect = new StateEffect();
        stateEffect.readFromBuffer(buffer, loadingContext);
        result.push(stateEffect);
    }

    return result;
}