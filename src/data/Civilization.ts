import BufferReader from "../BufferReader";
import { TextFileNames } from "../textfile/TextFile";
import { TextFileWriter } from "../textfile/TextFileWriter";
import { LoadingContext } from "./LoadingContext";
import { SavingContext } from "./SavingContext";
import { ArchitectureStyleId, asInt16, asUInt8, Float32, Int16, StateEffectId, UInt8 } from "./Types";

export class Civilization {
    id: Int16 = asInt16(-1);
    civilizationType: UInt8 = asUInt8(1); // should always be 1 for a valid civilization
    internalName: string = "";
    bonusEffect: StateEffectId<Int16> = asInt16(-1);
    attributes: Float32[] = [];
    architectureStyle: ArchitectureStyleId<UInt8> = asUInt8(0);

    readFromBuffer(buffer: BufferReader, id: Int16, loadingContext: LoadingContext): void {
        this.id = id;
        this.civilizationType = buffer.readUInt8();
        this.internalName = buffer.readFixedSizeString(20);
        const attributeCount = buffer.readInt16();
        this.bonusEffect = buffer.readInt16();

        this.attributes = [];
        for (let i = 0; i < attributeCount; ++i) {
            this.attributes.push(buffer.readFloat32());
        }
        this.architectureStyle = buffer.readUInt8();
    }
}

export function writeCivilizationsToWorldTextFile(civilizations: Civilization[], savingContext: SavingContext) {
    const textFileWriter = new TextFileWriter(TextFileNames.Civilizations);

    textFileWriter.raw(civilizations.length).eol(); // Total civilization entries
    textFileWriter.raw(civilizations.length).eol(); // Entries that have data here (these should always match because there are no null civilization entries)

    const sortedCivilizations = [...civilizations].sort((a, b) => a.internalName.localeCompare(b.internalName));
    for (let i = 0; i < sortedCivilizations.length; ++i) {
        const civilization = sortedCivilizations[i];

        textFileWriter
            .integer(civilization.id)
            .integer(civilization.civilizationType)
            .string(civilization.internalName, 17)
            .integer(civilization.bonusEffect)
            .integer(civilization.attributes.length)
            .integer(civilization.attributes.filter(x => x).length)
            .eol();

        // TODO: Attributes should be sorted acc to name...
        for (let j = 0; j < civilization.attributes.length; ++j) {
            if (civilization.attributes[j]) {
                textFileWriter
                    .indent(2)
                    .integer(j)
                    .float(civilization.attributes[j])
                    .eol();
            }
        }

        textFileWriter
            .indent(2)
            .integer(civilization.architectureStyle)
            .eol();
    }
    textFileWriter.close();

}