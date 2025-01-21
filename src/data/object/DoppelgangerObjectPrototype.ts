import BufferReader from "../../BufferReader";
import { LoadingContext } from "../LoadingContext";
import { AnimatedObjectPrototype } from "./AnimatedObjectPrototype";
import { ObjectType } from "./ObjectType";

export class DoppelgangerObjectPrototype extends AnimatedObjectPrototype {
    readFromBuffer(buffer: BufferReader, loadingContext: LoadingContext): void {
        super.readFromBuffer(buffer, loadingContext);        
    }
}
