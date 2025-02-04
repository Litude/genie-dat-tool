import BufferReader from "../../BufferReader";
import { OldJsonFieldConfig } from "../../json/json-serialization";
import { TextFileWriter } from "../../textfile/TextFileWriter";
import { LoadingContext } from "../LoadingContext";
import { SavingContext } from "../SavingContext";
import { asFloat32, asUInt8, Float32, Int16, UInt8 } from "../../ts/base-types";
import { CombatantObjectPrototype } from "./CombatantObjectPrototype";
import { SceneryObjectPrototype } from "./SceneryObjectPrototype";

const jsonFields: OldJsonFieldConfig<ProjectileObjectPrototype>[] = [
    { field: "projectileType" },
    { field: "targettingMode" },
    { field: "hitMode" },
    { field: "vanishMode" },
    { field: "areaEffect" },
    { field: "projectileArc" }
]

export class ProjectileObjectPrototype extends CombatantObjectPrototype {
    projectileType: UInt8 = asUInt8(0);
    targettingMode: UInt8 = asUInt8(0);
    hitMode: UInt8 = asUInt8(0);
    vanishMode: UInt8 = asUInt8(0);
    areaEffect: UInt8 = asUInt8(0);
    projectileArc: Float32 = asFloat32(0);

    readFromBuffer(buffer: BufferReader, id: Int16, loadingContext: LoadingContext): void {
        super.readFromBuffer(buffer, id, loadingContext);
        this.projectileType = buffer.readUInt8();
        this.targettingMode = buffer.readUInt8();
        this.hitMode = buffer.readUInt8();
        this.vanishMode = buffer.readUInt8();
        this.areaEffect = buffer.readUInt8();
        this.projectileArc = buffer.readFloat32();
    }
        
    getJsonConfig(): OldJsonFieldConfig<SceneryObjectPrototype>[] {
        return super.getJsonConfig().concat(jsonFields as OldJsonFieldConfig<SceneryObjectPrototype>[]);
    }

    writeToTextFile(textFileWriter: TextFileWriter, savingContext: SavingContext): void {
        super.writeToTextFile(textFileWriter, savingContext);
        textFileWriter
            .indent(4)
            .integer(this.projectileType)
            .integer(this.targettingMode)
            .integer(this.hitMode)
            .integer(this.vanishMode)
            .integer(this.areaEffect)
            .float(this.projectileArc)
            .eol();
    }
}
