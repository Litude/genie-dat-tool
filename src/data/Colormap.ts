import BufferReader from "../BufferReader";
import { LoadingContext } from "./LoadingContext";
import { SavingContext } from "./SavingContext";
import { asInt16, asUInt8, ColorId, Int16, PaletteIndex, ResourceId } from "./Types";
import { TextFileWriter } from "../textfile/TextFileWriter";
import { TextFileNames } from "../textfile/TextFile";

const enum ColormapType {
    Default = 0,
    PlayerColor = 1,
    Shadow = 2
}

export class Colormap {
    id: ColorId = asInt16(0); // todo: check if this matches index?
    resourceFilename: string = ""; // includes extension
    resourceId: ResourceId<Int16> = asInt16(-1);
    minimapColor: PaletteIndex = asUInt8(0);
    type: ColormapType = ColormapType.Default;

    constructor(buffer: BufferReader, loadingContext: LoadingContext) {
        this.resourceFilename = buffer.readFixedSizeString(30);
        this.id = buffer.readInt16();
        this.resourceId = buffer.readInt16();
        this.minimapColor = buffer.readUInt8();
        this.type = buffer.readUInt8();
    }

    toString() {
        return JSON.stringify(this);
    }
}

export function readColormaps(buffer: BufferReader, loadingContext: LoadingContext) {
    const result: Colormap[] = [];
    const colormapCount = buffer.readInt16();
    for (let i = 0; i < colormapCount; ++i) {
        result.push(new Colormap(buffer, loadingContext));
    }
    return result;
}

export function writeColormapsToWorldTextFile(colormaps: Colormap[], savingContext: SavingContext) {
    const textFileWriter = new TextFileWriter(TextFileNames.Colormaps);
    textFileWriter.raw(colormaps.length).eol(); // Total colormap entries
    textFileWriter.raw(colormaps.length).eol(); // Entries that have data here (these should always match anyway...)

    const sortedEntries = [...colormaps].sort((a, b) => a.resourceFilename.localeCompare(b.resourceFilename));
    for (let i = 0; i < sortedEntries.length; ++i) {
        const currentEntry = sortedEntries[i];
        textFileWriter
            .integer(currentEntry.id)
            .integer(currentEntry.resourceId)
            .filename(currentEntry.resourceFilename)
            .integer(currentEntry.minimapColor)
            .integer(currentEntry.type)
            .eol()
    }
    textFileWriter.close();
}
