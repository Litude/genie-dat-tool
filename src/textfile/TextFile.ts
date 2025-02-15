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

// There are some minor differences because it would seem the sorting was not
// actually automatic because in some cases "-" is before "_" and in other cases
// it is the opposite. This sorting method tries to minimize the differences.
export function textFileStringCompare(a: string, b: string) {
  const isSpecial = (char: string) => /[^a-zA-Z0-9]/.test(char);
  const isNumber = (char: string) => /[0-9]/.test(char);
  const isUpper = (char: string) => /[A-Z]/.test(char);

  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const charA = a[i];
    const charB = b[i];

    // 1. Special characters come first
    if (isSpecial(charA) !== isSpecial(charB)) {
      return isSpecial(charA) ? -1 : 1;
    }

    // 2. Numbers come before letters
    if (isNumber(charA) !== isNumber(charB)) {
      return isNumber(charA) ? -1 : 1;
    }

    // 3. Uppercase comes before lowercase
    if (isUpper(charA) !== isUpper(charB)) {
      return isUpper(charA) ? -1 : 1;
    }

    // 4. If same character family, consider hex value of character
    if (charA !== charB) {
      return charA > charB ? 1 : -1;
    }
  }

  // 5. Shorter strings come first if they are otherwise identical
  return a.length - b.length;
}
