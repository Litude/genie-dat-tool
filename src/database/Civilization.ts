import semver from "semver";
import BufferReader from "../BufferReader";
import { TextFileNames, textFileStringCompare } from "../textfile/TextFile";
import { TextFileWriter } from "../textfile/TextFileWriter";
import { Attribute, createDefaultAttribute } from "./Attributes";
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
        if (semver.gte(loadingContext.version.numbering, "1.4.0")) {
            this.bonusEffect = buffer.readInt16();
        }

        this.attributes = [];
        for (let i = 0; i < attributeCount; ++i) {
            this.attributes.push(buffer.readFloat32());
        }
        this.architectureStyle = buffer.readUInt8();
    }
}

export function writeCivilizationsToWorldTextFile(civilizations: Civilization[], attributes: Attribute[], savingContext: SavingContext) {
    const textFileWriter = new TextFileWriter(TextFileNames.Civilizations);

    textFileWriter.raw(civilizations.length).eol(); // Total civilization entries
    textFileWriter.raw(civilizations.length).eol(); // Entries that have data here (these should always match because there are no null civilization entries)

    const sortedCivilizations = [...civilizations].sort((a, b) => textFileStringCompare(a.internalName, b.internalName));
    sortedCivilizations.forEach(civilization => {

        textFileWriter
            .integer(civilization.id)
            .integer(civilization.civilizationType)
            .string(civilization.internalName, 17)
            .conditional(semver.gte(savingContext.version.numbering, "1.4.0"), writer => writer.integer(civilization.bonusEffect))
            .integer(civilization.attributes.length)
            .integer(civilization.attributes.filter(x => x).length)
            .eol();

        const civAttributes = civilization.attributes.map((attributeAmount, id) => {
            const attribute = attributes[id] ? attributes[id] : createDefaultAttribute(id);
            return {
                ...attribute,
                amount: attributeAmount
            }
        }).sort((a, b) => textFileStringCompare(a.internalName, b.internalName))
        .filter(entry => entry.amount)

        civAttributes.forEach(attribute => {
            textFileWriter
                .indent(2)
                .integer(attribute.id)
                .float(attribute.amount)
                .eol();
        })

        textFileWriter
            .indent(2)
            .integer(civilization.architectureStyle)
            .eol();
    })
    textFileWriter.close();

}
