import { BufferSeekWhence } from "./BufferReader";
import {
  Bool32,
  Bool8,
  Float32,
  Float64,
  Int16,
  Int32,
  Int8,
  UInt16,
  UInt32,
  UInt8,
} from "./ts/base-types";

export class BufferWriter {
  private buffer: Buffer;
  private offset: number;
  private writtenSize: number;

  constructor(initialSize: number = 10240) {
    this.buffer = Buffer.alloc(initialSize);
    this.offset = 0;
    this.writtenSize = 0;
  }

  private ensureCapacity(additionalSize: number): void {
    const requiredSize = this.offset + additionalSize;
    if (requiredSize > this.buffer.length) {
      let newSize = this.buffer.length * 2;
      while (newSize < requiredSize) {
        newSize *= 2;
      }
      const newBuffer = Buffer.alloc(newSize);
      this.buffer.copy(newBuffer);
      this.buffer = newBuffer;
    }
  }

  private updateSizeAndOffset(writeAmount: number) {
    this.offset += writeAmount;
    // Since seeking can change the offset, the size might not actually increase if this location already has data
    this.writtenSize = Math.max(this.writtenSize, this.offset);
  }

  writeBool8(value: Bool8): void {
    this.ensureCapacity(1);
    this.buffer.writeUInt8(value ? 1 : 0, this.offset);
    this.updateSizeAndOffset(1);
  }

  writeBool32(value: Bool32): void {
    this.ensureCapacity(4);
    this.buffer.writeUInt32LE(value ? 1 : 0, this.offset);
    this.updateSizeAndOffset(4);
  }

  writeUInt8(value: UInt8): void {
    this.ensureCapacity(1);
    this.buffer.writeUInt8(value, this.offset);
    this.updateSizeAndOffset(1);
  }

  writeUInt16(value: UInt16): void {
    this.ensureCapacity(2);
    this.buffer.writeUInt16LE(value, this.offset);
    this.updateSizeAndOffset(2);
  }

  writeUInt32(value: UInt32): void {
    this.ensureCapacity(4);
    this.buffer.writeUInt32LE(value, this.offset);
    this.updateSizeAndOffset(4);
  }

  writeInt8(value: Int8): void {
    this.ensureCapacity(1);
    this.buffer.writeInt8(value, this.offset);
    this.updateSizeAndOffset(1);
  }

  writeInt16(value: Int16): void {
    this.ensureCapacity(2);
    this.buffer.writeInt16LE(value, this.offset);
    this.updateSizeAndOffset(2);
  }

  writeInt32(value: Int32): void {
    this.ensureCapacity(4);
    this.buffer.writeInt32LE(value, this.offset);
    this.updateSizeAndOffset(4);
  }

  writeFloat32(value: Float32): void {
    this.ensureCapacity(4);
    this.buffer.writeFloatLE(value, this.offset);
    this.updateSizeAndOffset(4);
  }

  writeFloat64(value: Float64): void {
    this.ensureCapacity(8);
    this.buffer.writeDoubleLE(value, this.offset);
    this.updateSizeAndOffset(8);
  }

  writeFixedSizeString(
    input: string,
    size: number,
    encoding: BufferEncoding = "latin1",
  ) {
    const stringBuffer = Buffer.from(input, encoding);
    const writeSize = Math.min(stringBuffer.length, size);
    this.ensureCapacity(size);
    stringBuffer.copy(this.buffer, this.offset, 0, writeSize);
    this.buffer.fill(0, this.offset + writeSize, this.offset + size);
    this.updateSizeAndOffset(size);
  }

  writeBuffer(data: Buffer): void {
    this.ensureCapacity(data.length);
    data.copy(this.buffer, this.offset);
    this.updateSizeAndOffset(data.length);
  }

  tell(): number {
    return this.offset;
  }

  size() {
    return this.writtenSize;
  }

  resize(newSize: number) {
    this.ensureCapacity(newSize);
    this.writtenSize = newSize;
    this.offset = Math.max(0, Math.min(this.offset, this.writtenSize));
  }

  seek(offset: number, whence: BufferSeekWhence = BufferSeekWhence.Start) {
    switch (whence) {
      case BufferSeekWhence.Start:
        this.offset = offset;
        break;
      case BufferSeekWhence.Relative:
        this.offset += offset;
        break;
      case BufferSeekWhence.End:
        this.offset = this.writtenSize + offset;
        break;
    }
    this.offset = Math.max(0, Math.min(this.offset, this.writtenSize));
  }

  data() {
    return this.buffer.subarray(0, this.writtenSize);
  }
}
