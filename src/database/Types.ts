// Very generic types, do we really want to use these??
// export type Integer = number;
// export type Float = number;

import { z } from "zod";
import { asInt16, asInt32, Int16, Int32, Int32Schema, UInt8, UInt8Schema } from "../ts/base-types";


export type Percentage<T> = T;

// TODO: Move the stuff above and below to a separate file...

// Special types (Most of these can't have size restricted types because the game is very inconsistent in what underlying type is used)
export type PrototypeId<T> = T;
export type ObjectId<T> = T;
export type ColorId = Int16;
export type PaletteIndex = UInt8 & { __type: "PaletteIndex" };
export type TribeResourceId = Int16 & { __type: "TribeResourceId" };
export type ResourceId = Int32 & { __type: "ResourceId" };
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
export type TechnologyType = Int16;

export type ColorMapTypeValue = UInt8 & { __type: "ColorMapTypeValue" };

// Legacy 16-bit resource ids seem to have used 0 to indicate no resource, while final 32-bit resource ids use -1
// These updates the values to match final ids
export function asResourceId(legacyResourceId: TribeResourceId): ResourceId {
    return asInt32<ResourceId>(legacyResourceId === 0 ? -1 : legacyResourceId);
}
export function asTribeResourceId(resourceId: ResourceId): TribeResourceId {
    return asInt16<TribeResourceId>(resourceId === -1 ? 0 : resourceId);
}

export const PaletteIndexSchema: z.Schema<PaletteIndex> = UInt8Schema as any;
export const ResourceIdSchema: z.Schema<ResourceId> = Int32Schema as any;

export const ReferenceStringSchema = z.union([z.string(), z.number(), z.null()]);
