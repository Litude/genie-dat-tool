import BufferReader from "../../BufferReader";
import { LoadingContext } from "../LoadingContext";
import { asFloat32, Float32 } from "../Types";
import { ObjectType } from "./ObjectType";
import { SceneryObjectPrototype } from "./SceneryObjectPrototype";

export class AnimatedObjectPrototype extends SceneryObjectPrototype {
    movementSpeed: Float32 = asFloat32(0);

    readFromBuffer(buffer: BufferReader, loadingContext: LoadingContext): void {
        super.readFromBuffer(buffer, loadingContext);
        this.movementSpeed = buffer.readFloat32();
    }
}
