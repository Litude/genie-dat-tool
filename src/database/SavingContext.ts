import { Version } from "./Version";

export interface SavingContext {
    version: Version;
    internalFields?: boolean;
    excludeUnused?: boolean;
}