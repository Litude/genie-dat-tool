import BufferReader from "../../BufferReader";
import { LoadingContext } from "../LoadingContext";
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
    
    readFromBuffer(buffer: BufferReader, loadingContext: LoadingContext): void {
        super.readFromBuffer(buffer, loadingContext);
        this.walkingSpriteId = buffer.readInt16();
        this.runningSpriteId = buffer.readInt16();
        this.rotationSpeed = buffer.readFloat32();
        this.sizeClass = buffer.readUInt8();
        this.trailingUnitId = buffer.readInt16();
        this.trailingUnitMode = buffer.readUInt8();
        this.trailingUnitDensity = buffer.readFloat32();
        this.moveAlgorithm = buffer.readUInt8();
    }
}
