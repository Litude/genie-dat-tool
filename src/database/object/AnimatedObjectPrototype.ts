import BufferReader from "../../BufferReader";
import { OldJsonFieldConfig } from "../../json/json-serialization";
import { TextFileWriter } from "../../textfile/TextFileWriter";
import { LoadingContext } from "../LoadingContext";
import { SavingContext } from "../SavingContext";
import { asFloat32, Float32, Int16 } from "../../ts/base-types";
import { SceneryObjectPrototype } from "./SceneryObjectPrototype";

const jsonFields: OldJsonFieldConfig<AnimatedObjectPrototype>[] = [{
    field: "movementSpeed"
}]

export class AnimatedObjectPrototype extends SceneryObjectPrototype {
    movementSpeed: Float32 = asFloat32(0);

    readFromBuffer(buffer: BufferReader, id: Int16, loadingContext: LoadingContext): void {
        super.readFromBuffer(buffer, id, loadingContext);
        this.movementSpeed = buffer.readFloat32();
    }

    getJsonConfig(): OldJsonFieldConfig<SceneryObjectPrototype>[] {
        return super.getJsonConfig().concat(jsonFields as OldJsonFieldConfig<SceneryObjectPrototype>[]);
    }

    writeToTextFile(textFileWriter: TextFileWriter, savingContext: SavingContext): void {
        super.writeToTextFile(textFileWriter, savingContext);
        textFileWriter
            .indent(4)
            .float(this.movementSpeed)
            .eol();
    }
}
