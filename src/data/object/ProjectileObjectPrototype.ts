import BufferReader from "../../BufferReader";
import { TextFileWriter } from "../../textfile/TextFileWriter";
import { LoadingContext } from "../LoadingContext";
import { SavingContext } from "../SavingContext";
import { asFloat32, asUInt8, Float32, UInt8 } from "../Types";
import { CombatantObjectPrototype } from "./CombatantObjectPrototype";
import { ObjectType } from "./ObjectType";

export class ProjectileObjectPrototype extends CombatantObjectPrototype {
    projectileType: UInt8 = asUInt8(0);
    targettingMode: UInt8 = asUInt8(0);
    hitMode: UInt8 = asUInt8(0);
    vanishMode: UInt8 = asUInt8(0);
    areaEffect: UInt8 = asUInt8(0);
    projectileArc: Float32 = asFloat32(0);

    readFromBuffer(buffer: BufferReader, loadingContext: LoadingContext): void {
        super.readFromBuffer(buffer, loadingContext);
        this.projectileType = buffer.readUInt8();
        this.targettingMode = buffer.readUInt8();
        this.hitMode = buffer.readUInt8();
        this.vanishMode = buffer.readUInt8();
        this.areaEffect = buffer.readUInt8();
        this.projectileArc = buffer.readFloat32();
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
