import { Version } from "./Version";

export interface LoadingContext {
  version: Version;
  abortOnError: boolean;
  cleanedData: boolean;
}

export interface JsonLoadingContext extends LoadingContext {
  terrainCount: number;
  maxTerrainCount: number;
  dataIds: {
    habitatIds: Record<string, number>;
    terrainIds: Record<string, number>;
    overlayIds: Record<string, number>;
    borderIds: Record<string, number>;
    spriteIds: Record<string, number>;
    soundEffectIds: Record<string, number>;
    stateEffectIds: Record<string, number>;
    prototypeIds: Record<string, number>;
    technologyIds: Record<string, number>;
  };
}
