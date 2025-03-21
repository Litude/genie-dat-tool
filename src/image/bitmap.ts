import BufferReader from "../BufferReader";

export function detectBitmapFile(bufferReader: BufferReader) {
  try {
    bufferReader.seek(0);
    const firstBytes = bufferReader.readFixedSizeString(2);
    if (firstBytes === "BM") {
      const fileSize = bufferReader.readUInt32();
      return fileSize === bufferReader.size();
    }
    return false;
  } catch (_e: unknown) {
    return false;
  }
}
