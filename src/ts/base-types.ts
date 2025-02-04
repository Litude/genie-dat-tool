import { z } from "zod";

// Size restricted numeric types
export type Int8 = number & { __brand: "Int8" };
export type Int16 = number & { __brand: "Int16" };
export type Int32 = number & { __brand: "Int32" };

export function asInt8(value: number) : Int8;
export function asInt8<T extends Int8>(value: number) : T;
export function asInt8(value: number) {
    return createBrandedInteger(value, -128, 127, "Int8");
}

export function asInt16(value: number) : Int16;
export function asInt16<T extends Int16>(value: number) : T;
export function asInt16(value: number) {
    return createBrandedInteger(value, -32768, 32767, "Int16");
}

export function asInt32(value: number) : Int32;
export function asInt32<T extends Int32>(value: number) : T;
export function asInt32(value: number) {
    return createBrandedInteger(value, -2147483648, 2147483647, "Int32");
}

export type UInt8 = number & { __brand: "UInt8" };
export type UInt16 = number & { __brand: "UInt16" };
export type UInt32 = number & { __brand: "UInt32" };

export function asUInt8(value: number) : UInt8;
export function asUInt8<T extends UInt8>(value: number) : T;
export function asUInt8(value: number) {
    return createBrandedInteger(value, 0, 255, "UInt8");
}

export function asUInt16(value: number) : UInt16;
export function asUInt16<T extends UInt16>(value: number) : T;
export function asUInt16(value: number) {
    return createBrandedInteger(value, 0, 65535, "UInt16");
}

export function asUInt32(value: number) : UInt32;
export function asUInt32<T extends UInt32>(value: number) : T;
export function asUInt32(value: number) {
    return createBrandedInteger(value, 0, 4294967295, "UInt32");
}

export type Float32 = number & { __brand: "Float32" };
export type Float64 = number & { __brand: "Float64" };

export function asFloat32(value: number) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error(`Value ${value} is not a valid finite number for Float32`);
    }
    const float32Value = Math.fround(value);
    if (!Number.isFinite(float32Value)) {
      throw new Error(`Value ${value} is out of Float32 range`);
    }
    return float32Value as Float32;
}
export function asFloat64(value: number) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error(`Value ${value} is not a valid finite number for Float64`);
    }
    return value as Float64;
}

export type Bool8 = boolean & { __brand: "Bool8" };
export type Bool16 = boolean & { __brand: "Bool16" };
export type Bool32 = boolean & { __brand: "Bool32" };

export function asBool8(value: boolean) {
    return value as Bool8;
}
export function asBool16(value: boolean) {
    return value as Bool16;
}
export function asBool32(value: boolean) {
    return value as Bool32;
}

export type Pointer = number & { __brand: "Pointer" };
export const NullPointer = 0 as Pointer;

function createBrandedInteger<T extends string>(
    value: number,
    min: number,
    max: number,
    brand: T
  ): number & { __brand: T } {
    if (!Number.isInteger(value) || value < min || value > max) {
      throw new Error(`Value ${value} is not a valid ${brand}`);
    }
    return value as number & { __brand: T };
  }
  
  export const Bool8Schema: z.Schema<Bool8> = z.boolean() as any;
  export const Bool16Schema: z.Schema<Bool16> = z.boolean() as any;
  export const Bool32Schema: z.Schema<Bool32> = z.boolean() as any;
  
  export const UInt8Schema: z.Schema<UInt8> = z.number()
    .int()
    .min(0, { message: "Number must be positive (uint8)"})
    .max(255, { message: "Number must be at most 255 (uint8)"}) as any;
  
  export const UInt16Schema: z.Schema<UInt16> = z.number()
      .int()
      .min(0, { message: "Number must be positive (uint16)"})
      .max(65535, { message: "Number must be at most 65535 (uint16)"}) as any;
  
  export const UInt32Schema: z.Schema<UInt32> = z.number()
      .int()
      .min(0, { message: "Number must be positive (uint32)"})
      .max(4294967295, { message: "Number must be at most 4294967295 (uint32)"}) as any;
  
  export const Int8Schema: z.Schema<Int8> = z.number()
      .int()
      .min(-128, { message: "Number must be at least -128 (int8)" })
      .max(127, { message: "Number must be at most 127 (int8)" }) as any;
  
  export const Int16Schema: z.Schema<Int16> = z.number()
    .int()
    .min(-32768, { message: "Number must be at least -32768 (int16)" })
    .max(32767, { message: "Number must be at most 32767 (int16)" }) as any;
  
  export const Int32Schema: z.Schema<Int32> = z.number()
    .int()
    .min(-2147483648, { message: "Number must be at least -2147483648 (int32)" })
    .max(2147483647, { message: "Number must be at most 2147483647 (int32)" }) as any;
  
  export const Float32Schema: z.Schema<Float32> = z.number() as any;
