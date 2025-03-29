# Compiled Shape File (SCP) File Format

This document describes the .SCP file format as used by Age of Empires.

The SCP format is the lost cousin of the SLP and SHP file format. This format was only meant to be used for terrain tiles and therefore it imposes some very strict restrictions on what kind of frames can be encoded into SCP files at all.

The following two restrictions apply to frames that are encoded as SCP graphics:
* Transparent pixels are only allowed at the sides of a horizontal line, but not between actual pixel data of lines. This means that all pixels on a single horizontal line must be consecutive.
* Each horizontal line is processed in blocks of 4 pixels, starting from the left. If a block has any pixels, it must also have a pixel set as the first or the last pixel in the block. This means that there are restrictions on how lines with just 1 or 2 pixels can be placed.

Some examples:
```
Invalid:
OXXO OOOO OOOO
OXOO OOOO OOOO
OOOO OXXO OOOO
OOOX XXOX XXXO

Valid:
XOOO OOOO OOOO
OOOX XXXX XOOO
OOOO XOOO OOOO
OOXX OOOO OOOO
```

Only earliest known build of Age of Empires, v00.04.03.0113 from January 1997, still supports using SCP files for terrain graphics, provided that the game is started with the COMPILEDTERRAIN and SLOWDRAW parameters and both SCP and SHP graphics are present for terrain. SCP files can also be created from SHP files by ```shapescn```. It does not validate the two rules specified above and instead creates corrupt graphics so they must be validated manually (all regular terrain tiles conform to these rules)

The reason why they are called compiled shape files is because the game code that draws these files is completely hardcoded to assume certain graphic dimensions and outline. When a file is converted to SCP with ```shapescn```, it also outputs source code that will draw the graphics without analyzing the actual graphic content but by directly performing copying of the raw data from hardcoded positions. This means that if a terrain tile has a slighlty different shape, a different function is used for drawing them. Converting for example the grass tiles or another regular terrain tile (water or desert), will generate 13 different functions for drawing an SCP file. This is because there are 13 different kinds of combinations of graphic dimensions and outlines in a regular terrain graphic. The final SCP files stores information on which function number should be used for drawing the tile. v00.04.03.0113 only includes the 13 functions needed for drawing regular terrain tiles.

While the game itself uses completely hardcoded functions for drawing the tiles, it is possible to parse them correctly by analyzing the data and ignoring the function number information.

## Basic structure

| Type                             | Name              | Description |
| ---------                        | -------           | ----------- |
| char[4]                          | scpVersion        | Always "2.0C". |
| sint32                           | frameCount        | Number of frames in SCP file. |
| char[24]                         | comment           | Always "RGE Compiled shape file\0" (null terminated) |
| FrameInfo[frameCount]            | frameInfo         | Offsets of each frame in the file, see below. |
| *FrameOutline[frameCount*height] | frameOutlines     | Outline data for each frame, see below. |
| *FrameData[frameCount]           | frameData         | Actual frame data, see below. |

\* The actual location of these is determined by the offsets specified in FrameInfo, but in official SCP files these are stored in the specified order.

### Frame info (FrameInfo)
Contains general properties such as dimensions and offsets for each frame.

| Type                          | Name               | Description |
| ---------                     | -------            | ----------- |
| uint32                        | dataOffset         | Offset where the FrameData for this frame starts. Relative to start of file. |
| uint32                        | outlineTableOffset | Offset where the FrameOutline for this frame starts. Relative to start of file. |
| sint32 (DrawFunction)         | drawFunction       | Determines the dimensions and outline of the shape, see below. |
| uint32                        | properties         | Always 0. |
| sint32                        | width              | Width of frame. |
| sint32                        | height             | Height of frame. |
| sint32                        | hotspotX           | Hotspot X coordinate. |
| sint32                        | hotspotY           | Hotspot Y coordinate. |

### Frame outline (FrameOutline)
This is very similar to what is in SLP files. However, these are 32-bit numbers instead of 16-bit numbers used in SLP files. There is one entry for each horizontal row of pixels (so there are frame height entries for each frame).

| Type                          | Name               | Description |
| ---------                     | -------            | ----------- |
| sint32                        | leftOutline        | Determines how many transparent/skipped pixels there are at the left side of this row of pixels. |
| sint32                        | rightOutline       | Determines how many transparent/skipped pixels there are at the right side of this row of pixels. |


### Frame data (FrameData)
The actual frame data is just raw pixel data. However, it is not stored in a linear order from left to right. The SCP file format processes data in groups of 4 pixels and this also affects how the data is stored.

First, one can calculate the amount of actual pixels on the current row as follows:

rowPixelCount = frameWidth - (leftOutline + rightOutline);

Now to get the amount of bytes stored for a row, this must be rounded up to the nearest multiple of 4.

rowBytes = (rowPixelCount + 3) & ~0x3;

The data for each row follows the previous row. So once rowBytes of data have been processed, the data of the next row starts.

As previously mentioned, the data is not stored in completely linear order. Instead, the data first contains blocks of 4 pixels that are aligned at coordinates divisible by 4. These are stored linearily in left to right order.

The starting left offset for these pixels can be calculated by rounding up leftOutline to the nearest multiple of 4. This offset can then be used to calculate the total number of pixels that are stored consecutively. Calculate the difference between the rounded outline and leftOutline and subtract this amount from the total amount of row pixels. Then round this result down to the nearest multiple of 4.

linearPixels = (rowPixelCount - (((leftOutline + 3) & ~0x3) - leftOutline)) & ~0x3

In case the row is short and/or not aligned at a coordinate divisible by 4, it is possible that there are no blocks like this.

In either case, there are most likely still extra pixels missing on the left and right side of the line. Since the left coordinate was rounded up to a multiple of 4 and the right coordinate was rounded down to a multiple of 4, there are still 0-3 pixels remaining on both the left and right side of the row of pixels. This data follows these consecutively stored pixels (so the very first pixel is usually stored at the very end), and the exact order of these pixels depends on how many pixels are remaining on the left and right side. See the table below.

| L | R | Pattern  |
| - | - | -------- |
| 3 | 3 | 143052PP |
| 3 | 2 | 1430P2PP |
| 3 | 1 | 1032     |
| 3 | 0 | 10P2     |
| 2 | 3 | 03214PPP |
| 2 | 2 | 0321     |
| 2 | 1 | 012P     |
| 2 | 0 | 01PP     |
| 1 | 3 | 1032     |
| 1 | 2 | 10P2     |
| 1 | 1 | 10PP     |
| 1 | 0 | P0PP     |
| 0 | 3 | 012P     |
| 0 | 2 | 01PP     |
| 0 | 1 | 0PPP     |
| 0 | 0 |          |

L is missing number of pixels on left side, R on right side. Here 0 is the position of leftmost missing pixel in the remaining data, and the highest number is the rightmost missing pixel. P is a padding byte and should be skipped.

### Drawing function (DrawFunction)

This is a number between 1 and 13 that determines the shape of the terrain tile. 

1 = Tile type 0 (Flat tile)
2 = Tile type 1, 9 (Hillside tile N / Pit pair tile N)
3 = Tile type 2, 10 (Hillside tile S / Pit pair tile S)
4 = Tile type 3, 11 (Hillside tile E / Pit pair tile E)
5 = Tile type 4, 12 (Hillside tile W / Pit pair tile W)
6 = Tile type 5 (Hillside tile NE)
7 = Tile type 6 (Hillside tile SE)
8 = Tile type 7 (Hillside tile NW)
9 = Tile type 8 (Hillside tile SW)
10 = Tile type 13 (Pit tile N)
11 = Tile type 14 (Pit tile S)
12 = Tile type 15 (Pit tile W)
13 = Tile type 16 (Pit tile E)
