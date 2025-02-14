export const TextFileNames = {
  MainFile: "tr_wrld.txt",
  Habitats: "tr_tset.txt",
  Colormaps: "tr_colr.txt",
  SoundEffects: "tr_snd.txt",
  Sprites: "tr_spr.txt",
  Terrains: "tr_terr.txt",
  TerrainObjects: "tr_tobj.txt",
  Overlays: "tr_ovly.txt",
  Borders: "tr_bdr.txt",
  TribeRandomMaps: "tr_map.txt",
  RandomMapDefinitons: "tr_rmap.txt",
  RandomMapBaseLands: "tr_rland.txt",
  RandomMapTerrains: "tr_rterr.txt",
  RandomMapElevations: "tr_relev.txt", // this file actually never existed, hence all official maps have this as empty
  RandomMapObjects: "tr_robj.txt",
  StateEffects: "tr_eff.txt",
  Civilizations: "tr_play.txt",
  ObjectPrototypes: "tr_obj.txt",
  Technologies: "tr_tech.txt",
  TribeAi: "tr_ai.txt",
  TechnologyTrees: "tr_tree.txt",
};

export function textFileStringCompare(a: string, b: string) {
  return a < b ? -1 : b < a ? 1 : 0;
}
