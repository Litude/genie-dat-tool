import BufferReader from "../../BufferReader";
import { LoadingContext } from "../LoadingContext";
import { Int16 } from "../Types";
import { AnimatedObjectPrototype } from "./AnimatedObjectPrototype";
import { ObjectType } from "./ObjectType";

export class DoppelgangerObjectPrototype extends AnimatedObjectPrototype {
    readFromBuffer(buffer: BufferReader, id: Int16, loadingContext: LoadingContext): void {
        super.readFromBuffer(buffer, id, loadingContext);        
    }
}
