import BufferReader from "../../BufferReader";
import { JsonFieldConfig } from "../../json/json-serializer";
import { TextFileWriter } from "../../textfile/TextFileWriter";
import { LoadingContext } from "../LoadingContext";
import { SavingContext } from "../SavingContext";
import { asFloat32, Float32, Int16 } from "../Types";
import { SceneryObjectPrototype } from "./SceneryObjectPrototype";

const jsonFields: JsonFieldConfig<AnimatedObjectPrototype>[] = [{
    key: "movementSpeed"
}]

export class AnimatedObjectPrototype extends SceneryObjectPrototype {
    movementSpeed: Float32 = asFloat32(0);

    readFromBuffer(buffer: BufferReader, id: Int16, loadingContext: LoadingContext): void {
        super.readFromBuffer(buffer, id, loadingContext);
        this.movementSpeed = buffer.readFloat32();
    }

    getJsonConfig(): JsonFieldConfig<SceneryObjectPrototype>[] {
        return super.getJsonConfig().concat(jsonFields as JsonFieldConfig<SceneryObjectPrototype>[]);
    }

    writeToTextFile(textFileWriter: TextFileWriter, savingContext: SavingContext): void {
        super.writeToTextFile(textFileWriter, savingContext);
        textFileWriter
            .indent(4)
            .float(this.movementSpeed)
            .eol();
    }
}
