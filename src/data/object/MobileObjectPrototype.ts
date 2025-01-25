import BufferReader from "../../BufferReader";
import { TextFileWriter } from "../../textfile/TextFileWriter";
import { LoadingContext } from "../LoadingContext";
import { SavingContext } from "../SavingContext";
import { asFloat32, asInt16, asUInt8, Float32, Int16, PrototypeId, SpriteId, UInt8 } from "../Types";
import { AnimatedObjectPrototype } from "./AnimatedObjectPrototype";
import { ObjectType } from "./ObjectType";

export class MobileObjectPrototype extends AnimatedObjectPrototype {
    walkingSpriteId: SpriteId<Int16> = asInt16(-1);
    runningSpriteId: SpriteId<Int16> = asInt16(-1);
    rotationSpeed: Float32 = asFloat32(0);
    sizeClass: UInt8 = asUInt8(0); // obsolete?
    trailingUnitId: PrototypeId<Int16> = asInt16(-1);
    trailingUnitMode: UInt8 = asUInt8(0);
    trailingUnitDensity: Float32 = asFloat32(0);
    moveAlgorithm: UInt8 = asUInt8(0); // obsolete?
    
    readFromBuffer(buffer: BufferReader, id: Int16, loadingContext: LoadingContext): void {
        super.readFromBuffer(buffer, id, loadingContext);
        this.walkingSpriteId = buffer.readInt16();
        this.runningSpriteId = buffer.readInt16();
        this.rotationSpeed = buffer.readFloat32();
        this.sizeClass = buffer.readUInt8();
        this.trailingUnitId = buffer.readInt16();
        this.trailingUnitMode = buffer.readUInt8();
        this.trailingUnitDensity = buffer.readFloat32();
        this.moveAlgorithm = buffer.readUInt8();
    }

    writeToTextFile(textFileWriter: TextFileWriter, savingContext: SavingContext): void {
        super.writeToTextFile(textFileWriter, savingContext);
        textFileWriter
            .indent(4)
            .integer(this.walkingSpriteId)
            .integer(this.runningSpriteId)
            .float(this.rotationSpeed)
            .integer(this.sizeClass)
            .integer(this.trailingUnitId)
            .integer(this.trailingUnitMode)
            .float(this.trailingUnitDensity)
            .integer(this.moveAlgorithm)
            .eol();
    }
}
