# Shape (SHP) File Format

This document describes the .SHP file format as used by Age of Empires.

## Basic structure

| Type                          | Name              | Description |
| ---------                     | -------           | ----------- |
| char[4]                       | shpVersion        | Only known version is 1.10 which is from 1995, so it is unlikely that earlier versions will be found. |
| sint32                        | frameCount        | Number of frames in SHP file. |
| FrameOffset[frameCount]       | frameOffsets      | Offsets of each frame in the file, see below |
| *FrameData[frameCount]        | frameData         | This does not need to immediately follow the FrameOffset section since the actual location is determined by the offsets. Furthermore it also does not need to be consecutive since each frame has a separate offset value. However, in all official files this data immediately follows the offset data and all frames are stored consecutively. |

### Frame offsets (FrameOffset)

| Type                          | Name              | Description |
| ---------                     | -------           | ----------- |
| uint32                        | dataOffset        | Offset where the frame command data starts. Relative to start of file. |
| uint32                        | paletteOffset     | Offset where the palette data of the frame starts. Relative to start of file. Always 0 and unsupported by game. |

### Frame data (FrameData)
The frame data has some similarities to the more common SLP file format, however this is much more primitive. SHP files have no concept of player colors or shadow colors or other special features that SLP allows. In all simplicity it is RLE compressed bitmap data.

It is worth noting that the coordinate system SHP files differs to that of SLP files. In SLP files, the coordinate 0, 0 refers to the upper-left corner of a single frame. However, SHP files have the hotspot/anchor as the coordinate 0, 0. In addition, the first 4 fields in an SHP file are relative to a third coordinate system, the coordinate system of the source FLC/PCX file. While translating between SHP and SLP coordinate systems is possible; it is not possible to recover the FLC/PCX coordinate system information if only an SLP file is available.

Note that the order of the first 4 fields are in "reverse", i.e. it first contains the y coordinate info and then x.

| Type                          | Name              | Description |
| ---------                     | -------           | ----------- |
| sint16                        | boundY            | Height of the original FLC/PCX file that was converted into an SHP. Unused** by the game. |
| sint16                        | boundX            | Width of the original FLC/PCX file that was converted into an SHP. Unused** by the game. |
| sint16                        | originY           | Hotspot/anchor Y value in the coordinate system of the original FLC/PCX file that was converted into an SHP. Unused by the game. |
| sint16                        | originX           | Hotspot/anchor X value in the coordinate system of the original FLC/PCX file that was converted into an SHP. Unused by the game. |
| sint32                        | minX              | Minimum X value relative to the coordinate system of the image itself. |
| sint32                        | minY              | Minimum Y value relative to the coordinate system of the image itself. |
| sint32                        | maxX              | Maximum X value relative to the coordinate system of the image itself. Inclusive. |
| sint32                        | maxY              | Maximum Y value relative to the coordinate system of the image itself. Inclusive. |
| ShpCommandData                | commandData       | Actual image data, see below. |

** Not strictly unused, is mistakenly used as the width and height of the frame in some unused parts of the game UI code.

The following formulas can be used to calculate additional frame information based on the SHP frame data:<br>
frameWidth = maxX - minY + 1<br>
frameHeight = maxY - minY + 1<br>
slpHotspotX = -minX<br>
slpHotspotY = -minY<br>

### Frame command data (ShpCommandData)

In the SHP frame data, each frame has data stored as palette indices, so only 256 color images are supported (just like SLP files). Also, pixels in a frame can be "skipped". Such pixels should be considered transparent.

Each row of the frame is encoded as a sequence of commands that immediately follow each other. There are exactly **frameHeight** rows of data for a single frame.

Immediately following the end of FrameData is the first command byte of the first row of the current frame. There are 4 different commands supported by the SHP file format, and the type of command is determined by the value of the command byte.

The command byte is divided into two parts: the upper 7 bits are the command count and the least significant 1 bit is the command family; The actual command type is determined by the command family and whether the count is zero or non-zero. This allows for exactly 4 different types of commands.

Instructions that utilize the command count value are therefore limited to a count of 127 and the skip command is limited to a count of 255. If a higher count is needed, the command must be split into two or more commands of the same type.

| Command Type     | Command family     | Command count     | Following bytes      | Description |
| ---------        | -------            | -----------       | --------------       | ----------- |
| Skip             | 1                  | Zero              | 1                    | Immediately following the command byte is 1 byte uint8 value (255 max) that determines the number of transparent/skipped pixels. |
| Draw/Copy        | 1                  | Not zero          | Command count        | The following bytes should be drawn/copied to the image in the order they are specified. |
| Fill/RLE         | 0                  | Not zero          | 1                    | The following byte specifies a color index that should be drawn Command count times. |
| End of Row       | 0                  | Zero              | 0                    | The next byte is the first command byte of the next row. (Or this is the end of the frame data if this is the last row.) |

Skip commands are redundant immediately before an end of row command. There is no need to encode all pixel entries until the end of row. When an end of row instruction is reached, any remaining pixels on the current row are implicitly considered skipped/transparent.

## Additional information

### Player colors

Player colors are not stored in any way in an SHP file. Instead the game is hardcoded to perform color transformation on specific SHP images using colormaps.

### Official encoding

If you want to match the encoding used in official files as closely as possible, these notes should help:<br>
1. If currently in a draw/copy mode, switch to RLE only if there are 3 or more consecutive equal color values that are to be encoded. If in any other mode, 2 consecutive color values are enough.
2. Don't encode redundant skip commands before the end of a row.
3. When commands exceed their max count (127), don't consider the current command as ended. Instead, write and split only after the total count is known. (This affects rule 1 as you could get a slightly different encoding if you consider that copy mode has ended after encoding 127 pixels.)

### Palette
The game palette was reordered at the same time as the game was changed to use SLP files instead of SHP files. (Presumably the motivating factor was to get the player colors reordered so it would be faster to peform color mapping on SLP images.) This means that doing a 1-to-1 conversion from an SLP file to an SHP file for a game graphic and then using the colormappings of the game will result in weird mappings. To actually use the SHP graphics in the game with proper player color mapping, this palette remapping will also have to be reversed.

