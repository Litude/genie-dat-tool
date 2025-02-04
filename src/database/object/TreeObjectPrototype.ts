import BufferReader from "../../BufferReader";
import { Int16 } from "../../ts/base-types";
import { LoadingContext } from "../LoadingContext";
import { SceneryObjectPrototype } from "./SceneryObjectPrototype";

export class TreeObjectPrototype extends SceneryObjectPrototype {
    readFromBuffer(buffer: BufferReader, id: Int16, loadingContext: LoadingContext): void {
        super.readFromBuffer(buffer, id, loadingContext);
    }
}
