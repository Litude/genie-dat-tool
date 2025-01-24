import BufferReader from "../../BufferReader";
import { TextFileWriter } from "../../textfile/TextFileWriter";
import { LoadingContext } from "../LoadingContext";
import { SavingContext } from "../SavingContext";
import { asFloat32, Float32 } from "../Types";
import { ObjectType } from "./ObjectType";
import { SceneryObjectPrototype } from "./SceneryObjectPrototype";

export class AnimatedObjectPrototype extends SceneryObjectPrototype {
    movementSpeed: Float32 = asFloat32(0);

    readFromBuffer(buffer: BufferReader, loadingContext: LoadingContext): void {
        super.readFromBuffer(buffer, loadingContext);
        this.movementSpeed = buffer.readFloat32();
    }

    writeToTextFile(textFileWriter: TextFileWriter, savingContext: SavingContext): void {
        super.writeToTextFile(textFileWriter, savingContext);
        textFileWriter
            .indent(4)
            .float(this.movementSpeed)
            .eol();
    }
}
