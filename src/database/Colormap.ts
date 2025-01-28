import BufferReader from "../BufferReader";
import { LoadingContext } from "./LoadingContext";
import { SavingContext } from "./SavingContext";
import { asInt16, asUInt8, ColorId, Int16, PaletteIndex, ResourceId } from "./Types";
import { TextFileWriter } from "../textfile/TextFileWriter";
import { TextFileNames, textFileStringCompare } from "../textfile/TextFile";
import { onParsingError } from "./Error";
import path from "path";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { createJson, createSafeFilenameStem } from "../json/filenames";

const enum ColormapType {
    Default = 0,
    PlayerColor = 1,
    Shadow = 2
}

export class Colormap {
    referenceId: string = "";
    id: ColorId = asInt16(0);
    resourceFilename: string = ""; // includes extension
    resourceId: ResourceId<Int16> = asInt16(-1);
    minimapColor: PaletteIndex = asUInt8(0);
    type: ColormapType = ColormapType.Default;

    readFromBuffer(buffer: BufferReader, id: Int16, loadingContext: LoadingContext) {
        this.resourceFilename = buffer.readFixedSizeString(30);
        this.referenceId = createSafeFilenameStem(this.resourceFilename);
        this.id = buffer.readInt16();
        if (this.id !== id) {
            onParsingError(`Mismatch between stored Colormap id ${this.id} and ordering ${id}, data might be corrupt!`, loadingContext);
        }
        this.resourceId = buffer.readInt16();
        this.minimapColor = buffer.readUInt8();
        this.type = buffer.readUInt8();
    }

    writeToJsonFile(directory: string, savingContext: SavingContext) {
        writeFileSync(path.join(directory, `${this.referenceId}.json`), createJson({
            ...this,
            id: undefined,
            referenceId: undefined,
        }));
    }

    toString() {
        return JSON.stringify(this);
    }
}

export function readColormaps(buffer: BufferReader, loadingContext: LoadingContext) {
    const result: Colormap[] = [];
    const colormapCount = buffer.readInt16();
    for (let i = 0; i < colormapCount; ++i) {
        const colormap = new Colormap();
        colormap.readFromBuffer(buffer, asInt16(i), loadingContext);
        result.push(colormap);
    }
    return result;
}

export function writeColormapsToWorldTextFile(outputDirectory: string, colormaps: Colormap[], savingContext: SavingContext) {
    const textFileWriter = new TextFileWriter(path.join(outputDirectory, TextFileNames.Colormaps));
    textFileWriter.raw(colormaps.length).eol(); // Total colormap entries
    textFileWriter.raw(colormaps.length).eol(); // Entries that have data here (these should always match anyway...)

    const sortedEntries = [...colormaps].sort((a, b) => textFileStringCompare(a.resourceFilename, b.resourceFilename));
    sortedEntries.forEach(currentEntry => {
        textFileWriter
            .integer(currentEntry.id)
            .integer(currentEntry.resourceId)
            .filename(currentEntry.resourceFilename)
            .integer(currentEntry.minimapColor)
            .integer(currentEntry.type)
            .eol()
    });
    textFileWriter.close();
}

export function writeColormapsToJsonFiles(outputDirectory: string, colormaps: Colormap[], savingContext: SavingContext) {
    const colormapDirectory = path.join(outputDirectory, "colormaps");
    rmSync(colormapDirectory, { recursive: true, force: true });
    mkdirSync(colormapDirectory, { recursive: true });

    colormaps.forEach(colormap => {
        colormap.writeToJsonFile(colormapDirectory, savingContext);
    });

    const colormapIds = colormaps.map(colormap => colormap.referenceId);
    writeFileSync(path.join(colormapDirectory, "index.json"), JSON.stringify(colormapIds, undefined, 4));
}
