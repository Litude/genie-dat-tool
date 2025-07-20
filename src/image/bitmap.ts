import BufferReader from "../BufferReader";

export const enum DetectionResult {
  NotBitmap,
  Bitmap,
  PossiblyTruncatedBitmap,
}

export function detectBitmapFile(bufferReader: BufferReader) {
  try {
    bufferReader.seek(0);
    const firstBytes = bufferReader.readFixedSizeString(2);
    if (firstBytes === "BM") {
      const fileSize = bufferReader.readUInt32();
      if (fileSize === bufferReader.size()) {
        return DetectionResult.Bitmap;
      } else {
        return DetectionResult.PossiblyTruncatedBitmap;
      }
    }
    return DetectionResult.NotBitmap;
  } catch (_e: unknown) {
    return DetectionResult.NotBitmap;
  }
}
