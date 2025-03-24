import BufferReader from "../BufferReader";
import { PaletteIndex, ResourceId } from "../database/Types";
import { asInt32, asUInt8 } from "../ts/base-types";
import { isDefined } from "../ts/ts-utils";
import { ResourceDescriptor } from "./ResourceDescriptor";

export class ScreenInformation {
  backgrounds: {
    primary?: ResourceDescriptor;
    shaded?: ResourceDescriptor;
  }[] = [];
  palette?: ResourceDescriptor;
  cursor?: ResourceDescriptor;
  shadeColorMap?: ResourceDescriptor;
  shadeAmount?: {
    unit: string;
    amount: number;
  };
  buttons?: ResourceDescriptor;
  dialogInformation?: ResourceDescriptor;
  backgroundPosition: number = 0;
  backgroundColor: PaletteIndex = asUInt8<PaletteIndex>(0);
  bevelColors: [
    PaletteIndex,
    PaletteIndex,
    PaletteIndex,
    PaletteIndex,
    PaletteIndex,
    PaletteIndex,
  ] = [
    asUInt8<PaletteIndex>(0),
    asUInt8<PaletteIndex>(0),
    asUInt8<PaletteIndex>(0),
    asUInt8<PaletteIndex>(0),
    asUInt8<PaletteIndex>(0),
    asUInt8<PaletteIndex>(0),
  ];
  textColorPrimary: [PaletteIndex, PaletteIndex, PaletteIndex] = [
    asUInt8<PaletteIndex>(0),
    asUInt8<PaletteIndex>(0),
    asUInt8<PaletteIndex>(0),
  ];
  textColorSecondary: [PaletteIndex, PaletteIndex, PaletteIndex] = [
    asUInt8<PaletteIndex>(0),
    asUInt8<PaletteIndex>(0),
    asUInt8<PaletteIndex>(0),
  ];
  focusColorPrimary: [PaletteIndex, PaletteIndex, PaletteIndex] = [
    asUInt8<PaletteIndex>(0),
    asUInt8<PaletteIndex>(0),
    asUInt8<PaletteIndex>(0),
  ];
  focusColorSecondary: [PaletteIndex, PaletteIndex, PaletteIndex] = [
    asUInt8<PaletteIndex>(0),
    asUInt8<PaletteIndex>(0),
    asUInt8<PaletteIndex>(0),
  ];
  stateColorPrimary: [PaletteIndex, PaletteIndex, PaletteIndex] = [
    asUInt8<PaletteIndex>(0),
    asUInt8<PaletteIndex>(0),
    asUInt8<PaletteIndex>(0),
  ];
  stateColorSecondary: [PaletteIndex, PaletteIndex, PaletteIndex] = [
    asUInt8<PaletteIndex>(0),
    asUInt8<PaletteIndex>(0),
    asUInt8<PaletteIndex>(0),
  ];

  getAllGraphicResources(): ResourceDescriptor[] {
    const result: ResourceDescriptor[] = [];
    result.push(
      ...this.backgrounds
        .map((bg) => [bg.primary, bg.shaded].filter(isDefined))
        .filter(isDefined)
        .flat(),
    );
    if (this.cursor) {
      result.push(this.cursor);
    }
    if (this.buttons) {
      result.push(this.buttons);
    }
    return result;
  }

  static readFromBuffer(buffer: BufferReader) {
    const fileLines = buffer
      .toString("utf8")
      .replaceAll("\r\n", "\n")
      .split("\n")
      .map((x) => x.trim())
      .filter((x) => x);

    const screenInfo = new ScreenInformation();

    fileLines.forEach((line) => {
      if (line.match(/^background\d+_files /)) {
        const backgroundMatch = line.match(
          /^background\d+_files\s+(\S+)\s+(\S+)\s+(-?\d+)\s+(-?\d+)/,
        );
        if (backgroundMatch) {
          const [
            ,
            regularFilename,
            darkenedFilename,
            regularResourceIdStr,
            darkenedResourceIdStr,
          ] = backgroundMatch;
          const regularResourceId = Number(regularResourceIdStr);
          const darkenedResourceId = Number(darkenedResourceIdStr);
          const primary =
            regularResourceId >= 0 &&
            regularFilename.toLocaleLowerCase() !== "none"
              ? {
                  resourceId: asInt32<ResourceId>(regularResourceId),
                  filename: `${regularFilename}.slp`, // graphic files could be either slp or shp, we assume slp and fix this later
                }
              : undefined;
          const shaded =
            darkenedResourceId >= 0 &&
            darkenedFilename.toLocaleLowerCase() !== "none"
              ? {
                  resourceId: asInt32<ResourceId>(darkenedResourceId),
                  filename: `${darkenedFilename}.slp`,
                }
              : undefined;
          if (primary || shaded) {
            screenInfo.backgrounds.push({
              primary,
              shaded,
            });
          }
        }
      } else if (line.startsWith("palette_file ")) {
        const paletteMatch = line.match(/^palette_file\s+(\S+)\s+(-?\d+)/);
        if (paletteMatch) {
          const [, filename, resourceIdStr] = paletteMatch;
          const resourceId = Number(resourceIdStr);
          if (resourceId >= 0 && filename.toLocaleLowerCase() !== "none") {
            screenInfo.palette = {
              resourceId: asInt32<ResourceId>(resourceId),
              filename: `${filename}.pal`,
            };
          }
        }
      } else if (line.startsWith("cursor_file ")) {
        const cursorMatch = line.match(/^cursor_file\s+(\S+)\s+(-?\d+)/);
        if (cursorMatch) {
          const [, filename, resourceIdStr] = cursorMatch;
          const resourceId = Number(resourceIdStr);
          if (resourceId >= 0 && filename.toLocaleLowerCase() !== "none") {
            screenInfo.cursor = {
              resourceId: asInt32<ResourceId>(resourceId),
              filename: `${filename}.slp`,
            };
          }
        }
      } else if (line.startsWith("shade_color_table ")) {
        const shadeMatch = line.match(/^shade_color_table\s+(\S+)\s+(-?\d+)/);
        if (shadeMatch) {
          const [, filename, resourceIdStr] = shadeMatch;
          const resourceId = Number(resourceIdStr);
          if (resourceId >= 0 && filename.toLocaleLowerCase() !== "none") {
            screenInfo.shadeColorMap = {
              resourceId: asInt32<ResourceId>(resourceId),
              filename: `${filename}.col`,
            };
          }
        }
      } else if (line.startsWith("shade_amount ")) {
        const shadeMatch = line.match(/^shade_amount\s+(\S+)\s+(-?\d+)/);
        if (shadeMatch) {
          const [, unit, amountStr] = shadeMatch;
          const amount = Number(amountStr);
          if (Number.isFinite(amount)) {
            screenInfo.shadeAmount = {
              amount,
              unit,
            };
          }
        }
      } else if (line.startsWith("button_file ")) {
        const buttonMatch = line.match(/^button_file\s+(\S+)\s+(-?\d+)/);
        if (buttonMatch) {
          const [, filename, resourceIdStr] = buttonMatch;
          const resourceId = Number(resourceIdStr);
          if (resourceId >= 0 && filename.toLocaleLowerCase() !== "none") {
            screenInfo.buttons = {
              resourceId: asInt32<ResourceId>(resourceId),
              filename: `${filename}.slp`,
            };
          }
        }
      } else if (line.startsWith("popup_dialog_sin ")) {
        const dialogMatch = line.match(/^popup_dialog_sin\s+(\S+)\s+(-?\d+)/);
        if (dialogMatch) {
          const [, filename, resourceIdStr] = dialogMatch;
          const resourceId = Number(resourceIdStr);
          if (resourceId >= 0 && filename.toLocaleLowerCase() !== "none") {
            screenInfo.dialogInformation = {
              resourceId: asInt32<ResourceId>(resourceId),
              filename: `${filename}.sin`,
            };
          }
        }
      } else if (line.startsWith("background_position ")) {
        const backgroundPosMatch = line.match(/^background_position\s+(\d+)/);
        if (backgroundPosMatch) {
          const [, backgroundPosStr] = backgroundPosMatch;
          const backgroundPosition = Number(backgroundPosStr);
          if (
            Number.isFinite(backgroundPosition) &&
            Number.isInteger(backgroundPosition)
          ) {
            screenInfo.backgroundPosition = backgroundPosition;
          }
        }
      } else if (line.startsWith("background_color ")) {
        const backgroundColorMatch = line.match(/^background_color\s+(\d+)/);
        if (backgroundColorMatch) {
          const [, backgroundColorStr] = backgroundColorMatch;
          const backgroundColor = Number(backgroundColorStr);
          if (
            Number.isFinite(backgroundColor) &&
            Number.isInteger(backgroundColor)
          ) {
            screenInfo.backgroundColor = asUInt8<PaletteIndex>(backgroundColor);
          }
        }
      } else if (line.startsWith("bevel_colors ")) {
        const bevelColorsMatch = line.match(
          /^bevel_colors\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/,
        );
        if (bevelColorsMatch) {
          const [, ...bevelColorStrings] = bevelColorsMatch;
          const colors = bevelColorStrings.map((string) =>
            asUInt8<PaletteIndex>(Number(string)),
          ) as [
            PaletteIndex,
            PaletteIndex,
            PaletteIndex,
            PaletteIndex,
            PaletteIndex,
            PaletteIndex,
          ];
          screenInfo.bevelColors = colors;
        }
      } else if (line.startsWith("text_color1 ")) {
        const textColor = parseTextColor("text_color1", line);
        if (textColor) {
          screenInfo.textColorPrimary = textColor;
        }
      } else if (line.startsWith("text_color2 ")) {
        const textColor = parseTextColor("text_color2", line);
        if (textColor) {
          screenInfo.textColorSecondary = textColor;
        }
      } else if (line.startsWith("focus_color1 ")) {
        const textColor = parseTextColor("focus_color1", line);
        if (textColor) {
          screenInfo.focusColorPrimary = textColor;
        }
      } else if (line.startsWith("focus_color2 ")) {
        const textColor = parseTextColor("focus_color2", line);
        if (textColor) {
          screenInfo.focusColorSecondary = textColor;
        }
      } else if (line.startsWith("state_color1 ")) {
        const textColor = parseTextColor("state_color1", line);
        if (textColor) {
          screenInfo.stateColorPrimary = textColor;
        }
      } else if (line.startsWith("state_color2 ")) {
        const textColor = parseTextColor("state_color2", line);
        if (textColor) {
          screenInfo.stateColorSecondary = textColor;
        }
      }
    });
    return screenInfo;
  }
}

function parseTextColor(prefix: string, line: string) {
  const colorsMatch = line.match(`^${prefix}\\s+(\\d+)\\s+(\\d+)\\s+(\\d+)`);
  if (colorsMatch) {
    const [, ...colorStrings] = colorsMatch;
    const colors = colorStrings.map((string) =>
      asUInt8<PaletteIndex>(Number(string)),
    ) as [PaletteIndex, PaletteIndex, PaletteIndex];
    return colors;
  }
}
