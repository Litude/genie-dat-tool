import BufferReader from "../../BufferReader";
import { LoadingContext } from "../LoadingContext";
import { ObjectType } from "./ObjectType";
import { SceneryObjectPrototype } from "./SceneryObjectPrototype";

export class TreeObjectPrototype extends SceneryObjectPrototype {
    readFromBuffer(buffer: BufferReader, loadingContext: LoadingContext): void {
        super.readFromBuffer(buffer, loadingContext);
    }
}
