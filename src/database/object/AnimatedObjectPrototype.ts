import BufferReader from "../../BufferReader";
import { JsonFieldMapping, transformObjectToJson } from "../../json/json-serialization";
import { TextFileWriter } from "../../textfile/TextFileWriter";
import { LoadingContext } from "../LoadingContext";
import { SavingContext } from "../SavingContext";
import { asFloat32, Float32, Float32Schema, Int16 } from "../../ts/base-types";
import { SceneryObjectPrototype, SceneryObjectPrototypeSchema } from "./SceneryObjectPrototype";
import { z } from "zod";

export const AnimatedObjectPrototypeSchema = SceneryObjectPrototypeSchema.merge(z.object({
    movementSpeed: Float32Schema
}))

type AnimatedObjectPrototypeJson = z.infer<typeof AnimatedObjectPrototypeSchema>;

const AnimatedObjectPrototypeJsonMapping: JsonFieldMapping<AnimatedObjectPrototype, AnimatedObjectPrototypeJson>[] = [{
    field: "movementSpeed"
}]

export class AnimatedObjectPrototype extends SceneryObjectPrototype {
    movementSpeed: Float32 = asFloat32(0);

    readFromBuffer(buffer: BufferReader, id: Int16, loadingContext: LoadingContext): void {
        super.readFromBuffer(buffer, id, loadingContext);
        this.movementSpeed = buffer.readFloat32();
    }

    writeToTextFile(textFileWriter: TextFileWriter, savingContext: SavingContext): void {
        super.writeToTextFile(textFileWriter, savingContext);
        textFileWriter
            .indent(4)
            .float(this.movementSpeed)
            .eol();
    }
    
    toJson(savingContext: SavingContext) {
        return {
            ...super.toJson(savingContext),
            ...transformObjectToJson(this, AnimatedObjectPrototypeJsonMapping, savingContext)
        }
    }
}
