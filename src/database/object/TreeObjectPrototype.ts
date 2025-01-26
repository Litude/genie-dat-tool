import BufferReader from "../../BufferReader";
import { LoadingContext } from "../LoadingContext";
import { Int16 } from "../Types";
import { SceneryObjectPrototype } from "./SceneryObjectPrototype";

export class TreeObjectPrototype extends SceneryObjectPrototype {
    readFromBuffer(buffer: BufferReader, id: Int16, loadingContext: LoadingContext): void {
        super.readFromBuffer(buffer, id, loadingContext);
    }
}
