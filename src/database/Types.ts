// Very generic types, do we really want to use these??
// export type Integer = number;
// export type Float = number;

// Size restricted numeric types
export type Int8 = number & { __brand: "Int8" };
export type Int16 = number & { __brand: "Int16" };
export type Int32 = number & { __brand: "Int32" };

export function asInt8(value: number) {
    return createBrandedInteger(value, -128, 127, "Int8");
}
export function asInt16(value: number) {
    return createBrandedInteger(value, -32768, 32767, "Int16");
}
export function asInt32(value: number) {
    return createBrandedInteger(value, -2147483648, 2147483647, "Int32");
}

export type UInt8 = number & { __brand: "UInt8" };
export type UInt16 = number & { __brand: "UInt16" };
export type UInt32 = number & { __brand: "UInt32" };

export function asUInt8(value: number) {
    return createBrandedInteger(value, 0, 255, "UInt8");
}
export function asUInt16(value: number) {
    return createBrandedInteger(value, 0, 65535, "UInt16");
}
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

export type Percentage<T> = T;

// Special types (Most of these can't have size restricted types because the game is very inconsistent in what underlying type is used)
export type PrototypeId<T> = T;
export type ObjectId<T> = T;
export type ColorId = Int16;
export type PaletteIndex = UInt8; // are these always uint8?
export type ResourceId<T> = T;
export type TerrainId<T> = T;
export type BorderId<T> = T;
export type SoundEffectId<T> = T;
export type PlayerId<T> = T;
export type StringId<T> = T;
export type SpriteId<T> = T;
export type HabitatId<T> = T;
export type AttributeId<T> = T;
export type AbilityId<T> = T;
export type ActionId<T> = T;
export type OverlayId<T> = T;
export type StateEffectId<T> = T;
export type TechnologyId<T> = T;
export type ArchitectureStyleId<T> = T;
export type AgeId<T> = T;

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
