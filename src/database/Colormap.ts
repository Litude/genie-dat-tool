import BufferReader from "../BufferReader";
import { LoadingContext } from "./LoadingContext";
import { SavingContext } from "./SavingContext";
import { asResourceId, asTribeResourceId, ColorId, ColorMapTypeValue, PaletteIndex, PaletteIndexSchema, ResourceId, ResourceIdSchema, TribeResourceId } from "./Types";
import { asInt16, asInt32, asUInt8, Int16 } from "../ts/base-types";
import { TextFileWriter } from "../textfile/TextFileWriter";
import { TextFileNames, textFileStringCompare } from "../textfile/TextFile";
import { onParsingError } from "./Error";
import path from "path";
import { createReferenceIdFromString } from "../json/reference-id";
import { JsonFieldMapping, writeDataEntriesToJson, writeDataEntryToJsonFile } from "../json/json-serialization";
import { z } from "zod";

enum ColormapType {
    Default = asUInt8<ColorMapTypeValue>(0),
    PlayerColor = asUInt8<ColorMapTypeValue>(1),
    Shadow = asUInt8<ColorMapTypeValue>(2)
}

const ColormapSchema = z.object({
    internalName: z.string(),
    resourceFilename: z.string(),
    resourceId: ResourceIdSchema,
    minimapColor: PaletteIndexSchema,
    type: z.nativeEnum(ColormapType),
})

type ColormapJson = z.infer<typeof ColormapSchema>;

export const ColormapJsonMapping: JsonFieldMapping<Colormap, ColormapJson>[] = [
    { field: "internalName" },
    { field: "resourceFilename" },
    { field: "resourceId" },
    { field: "minimapColor" },
    { field: "type" }
];

export class Colormap {
    internalName: string = "";
    referenceId: string = "";
    id: ColorId = asInt16(0);
    resourceFilename: string = ""; // includes extension
    resourceId: ResourceId = asInt32<ResourceId>(-1);
    minimapColor: PaletteIndex = asUInt8<PaletteIndex>(0);
    type: ColormapType = ColormapType.Default;

    readFromBuffer(buffer: BufferReader, id: Int16, loadingContext: LoadingContext) {
        this.resourceFilename = buffer.readFixedSizeString(30);
        this.internalName = this.resourceFilename.endsWith(".col") ? this.resourceFilename.slice(0, -4) : this.resourceFilename;
        this.referenceId = createReferenceIdFromString(this.internalName);
        this.id = buffer.readInt16();
        if (this.id !== id) {
            onParsingError(`Mismatch between stored Colormap id ${this.id} and ordering ${id}, data might be corrupt!`, loadingContext);
        }
        this.resourceId = asResourceId(buffer.readInt16<TribeResourceId>());
        this.minimapColor = buffer.readUInt8<PaletteIndex>();
        this.type = buffer.readUInt8();
    }
    
    appendToTextFile(textFileWriter: TextFileWriter, savingContext: SavingContext) {
        textFileWriter
            .integer(this.id)
            .integer(asTribeResourceId(this.resourceId))
            .filename(this.resourceFilename)
            .integer(this.minimapColor)
            .integer(this.type)
            .eol()
    }

    writeToJsonFile(directory: string, savingContext: SavingContext) {
        writeDataEntryToJsonFile(directory, this, ColormapJsonMapping, savingContext);
    }

    toString() {
        return JSON.stringify(this);
    }
}

export function readColormapsFromDatFile(buffer: BufferReader, loadingContext: LoadingContext) {
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
        currentEntry.appendToTextFile(textFileWriter, savingContext);
    });
    textFileWriter.close();
}

export function writeColormapsToJsonFiles(outputDirectory: string, colormaps: Colormap[], savingContext: SavingContext) {
    writeDataEntriesToJson(outputDirectory, "colormaps", colormaps, ColormapJsonMapping, savingContext);
}
