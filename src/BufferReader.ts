import { Bool16, Bool32, Bool8, Float32, Float64, Int16, Int32, Int8, Pointer, UInt16, UInt32, UInt8 } from "./database/Types";

export default class BufferReader {
    private buffer: Buffer;
    private offset: number;

    constructor(buffer: Buffer) {
        this.buffer = buffer;
        this.offset = 0;
    }
    
    readBool8(): Bool8 {
        const value = this.buffer.readUInt8(this.offset);
        this.offset += 1;
        return Boolean(value) as Bool8;
    }
    
    readBool16(): Bool16 {
        const value = this.buffer.readUInt16LE(this.offset);
        this.offset += 2;
        return Boolean(value) as Bool16;
    }
    
    readBool32(): Bool32 {
        const value = this.buffer.readUInt32LE(this.offset);
        this.offset += 4;
        return Boolean(value) as Bool32;
    }

    readInt8(): Int8 {
        const value = this.buffer.readInt8(this.offset);
        this.offset += 1;
        return value as Int8;
    }

    readInt16(): Int16 {
        const value = this.buffer.readInt16LE(this.offset);
        this.offset += 2;
        return value as Int16;
    }

    readInt32(): Int32 {
        const value = this.buffer.readInt32LE(this.offset);
        this.offset += 4;
        return value as Int32;
    }
    
    readUInt8(): UInt8 {
        const value = this.buffer.readUInt8(this.offset);
        this.offset += 1;
        return value as UInt8;
    }

    readUInt16(): UInt16 {
        const value = this.buffer.readUInt16LE(this.offset);
        this.offset += 2;
        return value as UInt16;
    }

    readUInt32(): UInt32 {
        const value = this.buffer.readUInt32LE(this.offset);
        this.offset += 4;
        return value as UInt32;
    }

    readFloat32(): Float32 {
        const value = this.buffer.readFloatLE(this.offset);
        this.offset += 4;
        return value as Float32;
    }

    readFloat64(): Float64 {
        const value = this.buffer.readDoubleLE(this.offset);
        this.offset += 8;
        return value as Float64;
    }

    // Pointers should not be stored, but AOE does it anyway :)
    readPointer(): Pointer {
        const value = this.buffer.readUInt32LE(this.offset);
        this.offset += 4;
        return value as Pointer;
    }

    readFixedSizeString(size: number): string {
        const value = this.buffer.toString('latin1', this.offset, this.offset + size);
        this.offset += size;
        const nullTerminatorIndex = value.indexOf("\0");
        if (nullTerminatorIndex !== -1) {
            return value.slice(0, nullTerminatorIndex);
        }
        else {
            return value;
        }
    }

    readPascalString16(): string {
        const stringLength = this.readInt16();
        return this.readFixedSizeString(stringLength);
    }

    tell(): number {
        return this.offset;
    }

    size(): number {
        return this.buffer.length;
    }

    endOfBuffer(): boolean {
        return this.offset === this.buffer.length;
    }
}
