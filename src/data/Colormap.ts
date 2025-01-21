import BufferReader from "../BufferReader";
import { LoadingContext } from "./LoadingContext";
import { asInt16, asUInt8, ColorId, Int16, PaletteIndex, ResourceId } from "./Types";

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

export function readColormaps(buffer: BufferReader, loadingContent: LoadingContext) {
    const result: Colormap[] = [];
    const colormapCount = buffer.readInt16();
    for (let i = 0; i < colormapCount; ++i) {
        result.push(new Colormap(buffer, loadingContent));
    }
    return result;
}
