import BufferReader from "../../BufferReader";
import { Int16 } from "../../ts/base-types";
import { LoadingContext } from "../LoadingContext";
import { AnimatedObjectPrototype } from "./AnimatedObjectPrototype";

export class DoppelgangerObjectPrototype extends AnimatedObjectPrototype {
    readFromBuffer(buffer: BufferReader, id: Int16, loadingContext: LoadingContext): void {
        super.readFromBuffer(buffer, id, loadingContext);
    }
}
