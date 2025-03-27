# Scenario (SCN) File Format

The following variations exist:
* Age of Empires
* Age of Empires II
* Star Wars Galactic Battlegrounds

* Age of Empires II UserPatch
* Age of Empires II HD
* Age of Empires: Definitive Edition (looks like this is pretty much its completely own "branch" of the format, not covered in this file)
* Age of Empires II: Definitive Edition

# Types

sint32 = signed 32-bit integer

uint32 = unsigned 32-bit integer
uint16 = unsigned 16-bit integer

// Generally the safest approach is to use 0 for false and 1 for true.
bool8 = 8-bit boolean
bool32 = 32-bit boolean

str32 = pascal style string with 32-bit length.

char = Single letter (see information about string encoding below)
char[256] = 256 consecutive single letter elements that belong to the same field

# String encodings
Strings are generally encoded using the active legacy codepage of the system, i.e. they are not UTF8. Only the HD edition and Definitive Editions use UTF8 encoded strings.  Strings are generally null terminated, but not always! Thus ons should always assume input is not null termianted but write null terminated strings!

...What about string line breaks...? \r\n seems to be used mostly?

# Basics

There are various different version numbers contained within an SCN file. Essentially it is a container with various data sections, and each of these data sections may have their own version number.

# Basic structure

The container version is uncompressed in container version 1.03, but in continer version 1.02 and 1.01 even the version is compressed. The header (SCN header) is also uncompressed. All other data is compressed.

Since there are no real identifiers for a compressed/uncompressed file, the only way to support both versions is either to try reading the version number as uncompressed and checking if it is a valid version and then falling back to trying to read it as compressed.

| Type                          | Name              | ContainerVersion  | Description |
| ---------                     | -------           | -----------       | ----------- |
| char[4] (ContainerVersion)    | containerVersion  | 1.01->            | Scenario container version. This is not null terminated. Uncompressed in 1.03 and later, compressed in earlier. |
| ScnHeader                     | scenarioHeader    | 1.03->            | Header, see section below. Uncompressed. |
| sint32 (ObjectId)             | nextObjectId      | 1.01->            | The object id that should be used for the next placed object.  |
| float32 (ScnDataVersion)      | scnDataVersion    | 1.01->            | Scenario data version. |
| ScnData                       | scenarioData      | 1.01->            | Scenario data, see section below |
| TerrainData                   | terrainData       | 1.01->            | Terrain data, see section below |
| sint32                        | playerCount       | 1.01->            | Main player count number. This is always 9, but the game probably parses files correctly if there are fewer sections. |
| PlayerSuppData[playerCount]   | playerSuppData    | 1.01-1.04         | Additional player data, see section below. |
| PlayerSuppData[playerCount-1] | playerSuppData    | 1.07->            | Additional player data, see section below. (No entry for Gaia anymore in never version!) |
| PlayerData[playerCount-1]     | playerData        | 1.05              | For this container version only, this data has been moved over here. |
| PlayerObjects[playerCount]    | mapObjects        | 1.01->            | Player object data, see section below |
| char[13]                      | developerTag      | 1.01-1.04         | Tag left by a developer, always "timothy deen\0" (null terminated) |
| sint32                        | playerCount       | 1.06->            | Later versions have the player count a second time and use this later count for the later data. Nevertheless it is also always 9 and should match the previous count or the scenario is seriously broken. |
| PlayerData[playerCount-1]     | playerData        | 1.01-1.04, 1.06-> | Main player data section, see section below. |

## Scenario Header (ScnHeader)
The header only exists for container version 1.03 and later! This is not compressed.

| Type                   | Name               | HeaderVersion    | Description |
| ---------              | -------            | -----------      | -----------    |
| uint32                 | headerSize         | 1->              | Size of header, excluding this field. Always 0 in header version 6? |
| sint32 (HeaderVersion) | headerVersion      | 1->              | Header version (known values are 1, 2, 3 and 6). |
| uint32                 | checksum           | 2->              | Checksum used to ensure scenarios match for multiplayer |
| str32                  | description        | 1->              | Description of scenario, shown in scenario selection preview |
| bool32                 | individualVicConds | 1->              | Whether the scenario has individual victory conditions |
| sint32                 | playerCount        | 1->              | Number of non-gaia players |
| uint32[9]              | dlcInformation     | 3->              | Information about DLC(?) |
| str32                  | authorName         | 3->              | Author name, usually null terminated |
| uint32                 | triggerCount       | 2->              | Trigger count in scenario |

## Scenario Data (ScnData)
The scenario data usually has slots for up to 16 players, but only 9 (or 8) of these are really used. Slot 0-7 are used by players 1-8. Gaia data is generally only stored starting in AoK and there Gaia data is stored in slot 8. Thus slots 9-15 are unused.

| Type                       | Name                     | ScnDataVersion    | Description |
| ---------                  | -------                  | -----------       | -----------    |
| char[16][256]              | playerNames              | 1.14->            | Player names. |
| int32[16] (StringId)       | playerNameStringIds      | 1.16->            | Localized player name string ids |
| bool32[16]                 | playersEnabled           | 1.14->            | Boolean whether player slot is enabled. Setting the max player count in the scenario editor modified these fields. Having non-consecutive enabled fields can cause bugs but also allows for interesting effects (allow later player colors without enabling all players in AoE) |
| sint32[16] (ScnPlayerType) | playerTypes              | 1.14->            | Which player types may use slot in single player, see Appendix. |
| int32[16] (CivilizationId) | playerCivilizations      | 1.14->            | 0 is Gaia, 1 is Egyptian (order as stored in .DAT) |
| int32[16] (AiEmotion)      | aiEmotionalStates        | 1.14->            | Deprecated, does nothing in any known version. See Appendix. |
| bool8                      | conquestVictory          | 1.07->            | Global conquest victory is enabled |
| ScnEvents                  | scenarioEvents           | 1.00->            | Scenario event data, see section below |
| ScnPresentationData        | presentationData         | 1.00->            | Scenario presentation data, see section below |
| ScnAiFiles                 | aiFiles                  | 1.00->            | AI file information, see section below. |
| uint32 (Verify)            | checkpoint1              | 1.03->            | Skipped by the game but can be used to validate reading since this is always 0xFFFFFF9D |
| char[16][256]              | playerNames              | 1.00-1.13         | Player names. Later versions have them further up. |
| ScnPlayerInfo[16]          | playerData               | 1.00->            | Player specific data, see section below. |
| uint32 (Verify)            | checkpoint2              | 1.03->            | Skipped by the game but can be used to validate reading since this is always 0xFFFFFF9D |
| ScnGlobalVic               | globalVictoryData        | 1.00->            | Global victory condition information, see section below. |
| sint32[16][16] (Diplomacy) | playerDiplomacyStances   | 1.00->            | Diplomacy stances for each player to each player.<br>0 = Ally<br>1 = Neutral<br>2 = Unused<br>3 = Enemy |
| ScnIndvVic[16][12]         | playerIndividualVictory  | 1.00->            | Player individual victory conditions, up to 12 entries per player. See section below. |
| uint32 (Verify)            | checkpoint3              | 1.03->            | Skipped by the game but can be used to validate reading since this is always 0xFFFFFF9D |
| bool32[16][16]             | playerAlliedVictory      | 1.01              | This early version seems to have included the possibility to have a separate allied victory stance with each player |
| bool32[16]                 | playerAlliedVictory      | 1.02->            | Allied victory states for each player. If true, allied victory is checked for the player. Used by scenario editor |
| ScnTechDisables            | techDisables             | 1.04->            | Information for disabling/enabling player techonlogies, units and buildings. See section below.
| bool32                     | lengthenCombat           | 1.05->            | If true, lengthen combat is enabled (i.e. effect 100 is executed). This is buggy since it will be executed again when saving a game. |
| bool32                     | enableCheats             | 1.12->            | Does nothing, but was likely planned for allowing cheats to be enabled or disabling trading (i.e. executing effect 105) |
| bool32                     | fullTechTree             | 1.12->            | If true, full tech tree is enabled. Civilization effect is not used and in ROR, effect 210 is executed |
| int32[16] (ScenarioAgeId)  | playerStartingAges       | 1.06->            | Starting age of player, 0 = Stone Age, 1 = Tool Age, 2 = Bronze Age, 3 = Iron Age, 4 = Post-Iron Age. For earlier versions, this should be read from the player attributes instead. |
| uint32 (Verify)            | checkpoint4              | 1.03->            | Skipped by the game but can be used to validate reading since this is always 0xFFFFFF9D |
| int32                      | gameViewPositionX        | 1.19->            | Local player initial view x coordinate |
| int32                      | gameViewPositionY        | 1.19->            | Local player initial view y coordinate |
| int32 (RandomMapId)        | aiRandomMapType          | 1.21->            | Scenario random map type (used by AI) |

### Scenario Data Events (ScnEvents)
This is actually a very simple trigger like system that is supported in all known versions with identical data. However, the functionality is very limited and saved games are a bit buggy with this functionality. Since the official scenario editor does not offer any way of actual editing these, they have fallen into obscurity. It seems that this was long since abandoned since the functionality is identical in the January 1997 build of Age of Empires.

| Type                   | Name                     | ScnDataVersion    | Description   |
| ---------              | -------                  | -----------       | -----------   |
| sint16                 | eventCount (eventCnt)    | 1.00->            | Number of event entries. |
| sint16 (EventObjId)    | nextEventObjectId        | 1.00->            | The event object id that should be assigned to the next new event object. |
| float32                | updateTime               | 1.00->            | Time when events were previously updated, always -1.0 for scenarios. |
| EventEntry[eventCnt]   | eventEntries             | 1.00->            | Actual event entries. |

#### EventEntry
Event entries use their own ids that are called EventObjId for objects that have not been created yet. Once the object has been created, the game automatically updates all events that refer to this EventObjId to actually refer to the created ObjId.

While the format bascially supports using objects that are already present in the scenario editor (when player id is not -1), this is actually parsed by the game before the objects have been loaded. Thus it is unable to find any objects and it will not work... So in vanilla AoE, it is only possible to use the event system on objects that have been created by the event system.

| Type                   | Name                     | ScnDataVersion    | Description   |
| ---------              | -------                  | -----------       | -----------   |
| float32                | eventTime                | 1.00->            | The game time when this event should occur. In seconds. |
| uint8 (EventType)      | eventType                | 1.00->            | Type of event.<br>0 = Attack Object (non-functional)<br>1 = Create Object<br>2 = Move Object<br>3 = Unused<br>4 = Destroy Object |
| int16 (PrototypeId)    | objectPrototypeId        | 1.00->            | Prototype id of object to be created (object .DAT id). Used for create object event. |
| uint8 (PlayerSlot)     | playerId                 | 1.00->            | Player whose object is to be created. 0 = Gaia, 1-7 = Players 1-7 |
| float32                | eventPositionX           | 1.00->            | X position of event (where to create object = 1, or where to move object = 2) |
| float32                | eventPositionY           | 1.00->            | Y position of event (where to create object = 1, or where to move object = 2) |
| float32                | eventPositionZ           | 1.00->            | Z position of event (where to create object = 1, or where to move object = 2) |
| uint16                 | taskType                 | 1.00->            | Unused. Perhaps meant for the unused event type 3 that would have allowed to task villagers? |
| sint16 (*)             | sourceObjectId           | 1.00->            | If the following player id is -1 (unassigned), this is an EventObjId. Else this is ObjectId. |
| sint16 (PlayerSlot)    | sourcePlayerId           | 1.00->            | If -1, the object has not been created yet. Else this is the owner id of the object (0 = Gaia, 1-7 = Players 1 - 7) |
| sint16 (*)             | targetObjectId           | 1.00->            | Used by non-funtional attack event. If the following player id is -1 (unassigned), this is an EventObjId. Else this is ObjectId. |
| sint16 (PlayerSlot)    | targetPlayerId           | 1.00->            | Used by non-funtional attack event. If -1, the object has not been created yet. Else this is the owner id of the object (0 = Gaia, 1-7 = Players 1 - 7) |

Since the EventObjId allows referring to units that have not been created yet, it is possible to create an object, move it and then finally delete it if so desired. The following three events will achieve this:
1. Create object (EventType = 1); Clubman (PrototypeId = 73); Source object id = 1; Source player id = -1; Postion 5, 5, 0; Time: 5 (after 5 seconds of game time)
2. Move object (EventType = 2); Source object id = 1; Source player id = -1; Position 15, 15, 0; Time: 10 (after standing for 5 seconds, move the clubman to a new position)
3. Delete object (EventType = 3); Source object id = 1; Source player id = -1; Time: 60 (remove the clubman from the game after 1 minute of game time)

### Scenario Presentation Data (ScnPresentationData)
| Type                  | Name                     | ScnDataVersion    | Description |
| ---------             | -------                  | -----------       | -----------   |
| str16                 | scenarioFilename         | 1.00->            | Scenario filename as saved, including extension |
| int32 (StringId)      | instructionsStringId     | 1.16->            | Localized scenario instructions string id |
| int32 (StringId)      | hintsStringId            | 1.16->            | Localized scenario hints message string id |
| int32 (StringId)      | victoryStringId          | 1.16->            | Localized scenario victory message string id |
| int32 (StringId)      | defeatStringId           | 1.16->            | Localized scenario defeat message string id |
| int32 (StringId)      | historyStringId          | 1.16->            | Localized scenario history message string id |
| int32 (StringId)      | scoutsStringId           | 1.22->            | Localized scenario scouts message string id |
| str16                 | descriptionMessage       | 1.00-1.02         | Scenario description message for preview, moved to header in later versions |
| str16                 | instructionsMessage      | 1.00->            | Scenario instructions message |
| str16                 | hintsMessage             | 1.11->            | Scenario hints message |
| str16                 | victoryMessage           | 1.00-1.02, 1.11-> | Scenario victory message |
| str16                 | defeatMessage            | 1.00-1.02, 1.11-> | Scenario defeat message |
| str16                 | historyMessage           | 1.11->            | Scenario history message |
| str16                 | scoutsMessage            | 1.22->            | Scenario scouts message |
| str16                 | introVideoName           | 1.00->            | Video name shown before instructions. Filename without extension. |
| str16                 | victoryVideoName         | 1.00->            | Video name shown after victory. Filename without extension. |
| str16                 | defeatVideoName          | 1.00->            | Video name shown after defeat. Filename without extension. |
| str16                 | instructionBitmapName    | 1.09->            | Bitmap name shown in scenario instructions. Filename without extension. |
| Bitmap                | instructionBitmap        | 1.10->            | Bitmap content shown in scenario instructions, see section below |

#### Bitmap
| Type                  | Name                     | ScnDataVersion    | Description |
| ---------             | -------                  | -----------       | -----------   |
| sint32                | memoryAllocationType     | 1.00->            | This should always be 2 if a bitmap is included. Else the bitmap will not be deleted properly and will leak memory! |
| sint32                | bitmapWidth (width)      | 1.00->            | Width of the bitmap in pixels, 0 if no bitmap is included. NOTE! The width in pixel data is rounded up to the nearest number multiplyable by 4 to get the **pitch** value! |
| sint32                | bitmapHeight (height)    | 1.00->            | Height of the bitmap in pixels, 0 if no bitmap is included |
| BITMAPINFOHEADER      | bitmapInfoHeader         | 1.00->            | Standard BMP BITMAPINFOHEADER header structure |
| RGBQUAD[256]          | bitmapPalette            | 1.00->            | Standard BMP RGBQUAD palette structure (this is actually ignored since the palette is decided by the game, but should optimally match the palette of the instructions screen) |
| uint8[pitch*height]   | bitmapPixelData          | 1.00->            | Each entry corresponds to a palette entry |


### Scenario Data AI Files (ScnAiFiles)
| Type              | Name                             | ScnDataVersion    | Description   |
| ---------         | -------                          | -----------       | -----------   |
| str16[16]         | aiStrategyNames                  | 1.00->            | AI Strategy (.ai) filename without extension. "Random" (localized!!!) is a special name which causes the strategy to be randomized. If file does not exist, no strategy is loaded and the AI only does basic functions. |
| str16[16]         | aiCityPlanNames                  | 1.00->            | AI city plan (.cty) filename without extension. If "Random" (localized!!!) or file does not exist, influence placement is used instead. |
| str16[16]         | aiPersonalityNames               | 1.08->            | AI personality (.per) Filename without extension. Random (localized!!!) is a special name which causes the personality to be randomzied if (and only if) the strategy is also Random! |
| AiFileData[16]    | aiFileData                       | 1.00->            | File sizes and possibly content of AI files |
| char[16][aiSize]  | aiStrategies                     | 1.00-1.02         | AI strategy file (.ai) content here for earlier versions, size is still above | 
| char[16][ctySize] | aiCityPlans                      | 1.00-1.02         | AI city plan file (.cty) content here for earlier versions, size is still above |
| uint8[16]         | aiRuleTypes                      | 1.20->            | Rules type used by AI (?) |

#### AiFileData
| Type              | Name                             | ScnDataVersion    | Description   |
| ---------         | -------                          | -----------       | -----------   |
| uint32            | aiStrategyFileSize (aiSize)      | 1.00->            | File size of the possibly bundled AI strategy (.ai) file |
| uint32            | aiCityPlanFileSize (ctySize)     | 1.00->            | File size of the possibly bundled AI city plan (.cty) file |
| uint32            | aiPersonalityFileSize (perSize)  | 1.08->            | File size of the possibly bundled AI personality (.per) file |
| char[aiSize]      | aiStrategies                     | 1.15->            | AI strategy file (.ai) content. This is a text file. | 
| char[ctySize]     | aiCityPlans                      | 1.15->            | AI city plan file (.cty) content. This is a text file. |
| char[perSize]     | aiPersonalities                  | 1.15->            | AI personality file (.per) content. This is a text file. |

### Scenario Technology Disables (ScnTechDisables)
| Type                          | Name                            | ScnDataVersion  | Description   |
| ---------                     | -------                         | -----------     | -----------   |
| bool32[16][20] (EnableTechId) | playerEnabledTechnologies       | 1.04-1.17       | List of enabled technologies that can be disabled. Enabled if true, disabled if false. |
| int32[16]                     | playerDisabledTechnologyCount   | 1.18->          | Number of valid entries in next section per player.
| int32[16][30] (TechologyId)   | playerDisabledTechnologyEntries | 1.18->          | Tecnologyh entries. Disabled if true.
| int32[16]                     | playerDisabledUnitsCount        | 1.18->          | Number of valid entries in next section per player.
| int32[16][30] (PrototypeId)   | playerDisabledUnitsEntires      | 1.18->          | Units entries. Disabled if true. This can also be used for building entries is so desired, though the official editor uses it for units. (However do not use it for the Town Center since it has special handling!)
| int32[16]                     | playerDisabledBuildingCount     | 1.18->          | Number of valid entries in next section per player.
| int32[16][20] (PrototypeId)   | playerDisabledBuildingEntires   | 1.18->          | Building entries. Disabled if true. This can also be used for unit entries is so desired, though the official editor uses it for buildings.

### Scenario Data Player Info (ScnPlayerInfo)
| Type                   | Name                           | ScnDataVersion    | Description |
| ---------              | -------                        | -----------       | -----------    |
| bool32                 | playerEnabled                  | 1.00-1.13         | Boolean whether player slot is enabled. Here for earlier scenario versions |
| int32                  | playerStartingGold             | 1.00->            | Player starting gold as shown in the scenario editor |
| int32                  | playerStartingWood             | 1.00->            | Player starting wood as shown in the scenario editor |
| int32                  | playerStartingFood             | 1.00->            | Player starting food as shown in the scenario editor |
| int32                  | playerStartingStone            | 1.00->            | Player starting stone as shown in the scenario editor |
| int32                  | playerStartingOre              | 1.17->            | Player starting ore as shown in the scenario editor |
| int32                  | playerStartingTradeGoods       | 1.17->            | Player starting trade goods as shown in the scenario editor |
| sint32 (ScnPlayerType) | playerType                     | 1.00-1.13         | Which player types may use slot in single player, see Appendix. Here for earlier scenario versions |
| int32 (CivilizationId) | playerCivilization             | 1.00-1.13         | 0 is Gaia, 1 is Egyptian (order as stored in .DAT). Here for earlier scenario versions |
| int32 (AiEmotion)      | playerAiEmotionalState         | 1.00-1.13         | Deprecated, does nothing in any known version. Here for earlier scenario versions |

### Scenario Data Global Victory (ScnGlobalVic)
| Type                     | Name                            | ScnDataVersion    | Description |
| ---------                | -------                         | -----------       | -----------    |
| bool32                   | customGlobalVictoryConquest     | 1.00->            | Whether conquest is checked in the custom global victory options. However, this is actually overwritten by the earlier conquest value. While this is present in earlier versions than the other conquest value, it was actually non-functional. To preserve functionality, this should be ignored in all versions. |
| sint32                   | customGlobalVictoryRuins        | 1.00->            | Number of ruins required in the custom global victory. |
| sint32                   | customGlobalVictoryArtifacts    | 1.00->            | Number of artifacts required in the custom global victory. |
| sint32                   | customGlobalVictoryDiscoveries  | 1.00->            | Number of discoveries required in the custom global victory. |
| sint32                   | customGlobalVictoryExploration  | 1.00->            | Exploration percentage required in the custom global victory. |
| sint32                   | customGlobalVictoryGold         | 1.00->            | Gold required in the custom global victory. |
| bool32                   | customGlobalVictoryAllRequired  | 1.00->            | If true, all custom global victory conditions must be met. Otherwise meeting any one will lead to victory. |
| sint32 (GlobalCondition) | globalVictoryMainCondition      | 1.13->            | 0 = Standard<br>1 = Conquest<br>2 = Score<br>3 = Time Limit<br>4 = Custom
| sint32                   | globalVictoryScoreThreshold     | 1.13->            | For main condition Score (= 2), the score amount required for victory. |
| sint32                   | globalVictoryTimeLimit          | 1.13->            | For main condition Time Limit (= 3), the amount of time (in 1/10 of a second) until the game ends. |

### Scenario Data Individual Victory (ScnIndvVic)
| Type                     | Name                            | ScnDataVersion    | Description |
| ---------                | -------                         | -----------       | -----------    |
| sint32 (PrototypeId)     | objectPrototypeId               | 1.00->            | Prototype id of object used for create and destroy object conditions. |
| bool32                   | quantityAll                     | 1.00->            | This is set to true for the destroy all objects condition. |
| sint32 (PlayerSlot)      | targetPlayer                    | 1.00->            | Target player for object. 0 = Gaia, 1-7 = Players 1-7, -1 = None/All |
| sint32 (PrototypeId?)    | targetObjectPrototypeId         | 1.00->            | Unused. Perhaps prototype id of target? |
| float                    | areaLeft                        | 1.00->            | Condition area left bound |
| float                    | areaTop                         | 1.00->            | Condition area top bound |
| float                    | areaRight                       | 1.00->            | Condition area right bound, inclusive |
| float                    | areaBottom                      | 1.00->            | Condition area bottom bound, inclusive |
| sint32 (IndividualCond)  | individualVictoryCondition      | 1.00->            | Individual victory condition type, see appendix. |
| sint32                   | quantity                        | 1.00->            | Quantity or attribute value for condition. |
| sint32 (*)               | propertyType                    | 1.00->            | This is either IndividualAttributeId, AttributeId or TechnologyId depending on the individualVictoryCondition value |
| sint32 (ScenarioObjId)   | sourceObjectId                  | 1.00->            | Scenario object id of the condition source object |
| sint32 (ScenarioObjId)   | targetObjectId                  | 1.00->            | Scenario object id of the condition target object |
| sint32                   | sourceObjectPointer             | 1.00->            | This is only used by earlier versions of the game at runtime and should always be 0 |
| sint32                   | targetObjectPointer             | 1.00->            | This is only used by earlier versions if the gane at runtime and should always be 0 |

## Terrain Data
Terrain data of the map follows. The format basically supports non-square maps, but only square maps actually work properly! This data is identical in all known versions.

| Type                        | Name               | ContainerVersion  | Description |
| ---------                   | -------            | -----------       | ----------- |
| sint32                      | mapWidth (width)   | 1.01->            | Map width, 255 is actually max supported but even that is unstable. 254 seems to work okay. |
| sint32                      | mapHeight (height) | 1.01->            | Map height, 255 is actually max supported but even that is unstable. 254 seems to work okay. |
| TileData[width*height]      | tileData           | 1.01->            | Tile data follows for each tile of the map in row-major order. |

### Tile Data (TileData)
| Type                        | Name               | ContainerVersion  | Description |
| ---------                   | -------            | -----------       | ----------- |
| uint8 (TerrainId)           | terrain            | 1.01->            | Terrain type for tile.  |
| uint8                       | elevation          | 1.01->            | Elevation of the tile |
| uint8 (OverlayId)           | overlay            | 1.01->            | Overlay type for tile. No known version supports this anymore and it is always 0, but the data is still present in all known versions. |


## Player Supplemental Data (PlayerSuppData)
| Type                        | Name               | ContainerVersion  | Description |
| ---------                   | -------            | -----------       | ----------- |
| uint8 (PlayerType)          | playerType         | 1.01-1.04         | Player type data (not scneario player type), this can be ignored since this is overwritten when a game is started. |
| uint8 (CivilizationId)      | playerCivilization | 1.01-1.04         | Player civilization data again, this can be ignored |
| float                       | playerFood         | 1.07->            | Player starting food, this is used by the game. (Previous was for editor only) |
| float                       | playerWood         | 1.07->            | Player starting wood, this is used by the game. (Previous was for editor only) |
| float                       | playerGold         | 1.07->            | Player starting gold, this is used by the game. (Previous was for editor only) |
| float                       | playerStone        | 1.07->            | Player starting stone, this is used by the game. (Previous was for editor only) |
| float                       | playerOre          | 1.13->            | Player starting ore, this is used by the game. (Previous was for editor only) |
| float                       | playerTradeGoods   | 1.13->            | Player starting trade goods, this is used by the game. (Previous was for editor only) |
| float                       | playerPopLimit     | 1.20->            | Player population limit |

## Player Object Data (PlayerObjects)
| Type                        | Name               | ContainerVersion  | Description |
| ---------                   | -------            | -----------       | ----------- |
| sint32                      | objectCount        | 1.01->            | How many objects for this player |
| ObjectData[objectCount]     | objects            | 1.01->            | Entry for each map object |

### Object Data (ObjectData)
| float                       | positionX          | 1.01->            | Object x position |
| float                       | positionY          | 1.01->            | Object y position |
| float                       | positionZ          | 1.01->            | Object z position |
| sint32 (ObjectId)           | objectId           | 1.01->            | Object id, should be unique for each object |
| sint16 (PrototypeId)        | prototypeId        | 1.01->            | Object prototype id, see Appendix |
| uint8 (ObjectState)         | objectState        | 1.01->            | Whether object is alive or building is built or a foundation, see Appendix |
| float                       | direction          | 1.01->            | Facing direction or angle of object (in radians) |


## Player Main Data (PlayerData)
| Type                             | Name                     | ContainerVersion  | Description |
| ---------                        | -------                  | -----------       | ----------- |
| str16                            | playerInternalName       | 1.01->            | Player internal name, this is never used |
| float                            | gameViewPositionX        | 1.01->            | Game view X position, ignored? |
| float                            | gameViewPositionY        | 1.01->            | Game view Y position, ignored? |
| sint16                           | minimapPositionX         | 1.01->            | Minimap X position, ignored? |
| sint16                           | minimapPositionY         | 1.01->            | Minimap Y position, ignored? |
| bool8                            | alliedVictory            | 1.02->            | Allied victory enabled, used by game |
| float[attributeCount]            | playerAttributes         | 1.01-1.06         | First attributeCount (assume 29) attributes of player data. The most important ones are player resources (and starting age for older scenario versions), but the game reads all of these. NOTE: attributeCount is not necessarily constant, but can be detected based on the following field! For the first player, the value that immediately follows these is ALWAYS 0x01030009 and this should never occur in an actual attribute field. All players have the same attributeCount. |
| sint16                           | diplomacyCount           | 1.01->            | Number of diplomacy entries that follow |
| uint8[diplomacyCount]            | diplomacyStances1        | 1.01->            | TODO: Diplomacy stances? | 
| sint32[diplomacyCount]           | diplomacyStances2        | 1.08->            | TODO: Diplomacy stances? |
| sint32 (PlayerColor)             | playerColor              | 1.13->            | Player color index |
| float (PlayerPerformanceVersion) | playerPerformanceVersion | 1.09->            | Version of PlayerPerformance data that follows, if not present version is 0.00 |
| PlayerPerformance                | playerPefromance         | 1.01->            | PlayerPerformance, see below. |
| PlayerTechTree                   | playerTechTree           | 1.01-1.03         | PlayerTechTree, see below. Old versions include the whole tech tree since scenario player settings could not be modified before starting. |

### Player Peformance Data (PlayerPerformance)
This struct also contains information about player scores. This basically means that it is possible for a scenario to define additional scoring conditions (the base game scoring conditions will always be applied).

| Type                      | Name                    | PlayerPerformanceVersion | Description |
| ---------                 | -------                 | -----------              | ----------- |
| sint32                    | victoryConditionCount   | 0.00->                   | Number of victory condition entries |
| uint8                     | victoryState            | 0.00->                   | Should be 0 for scenarios. 0 = Undecided, 1 = Loss, 2 = Victory. |
| VictoryCondition[vcCount] | victoryConditions       | 0.00->                   | Victory condition entries, see below. This is what the scenario editor "translates" individual victory condtions into. |
| sint32                    | playerScore             | 1.00->                   | Player current score. This should be set to zero for scenarios since the game will update this anyway. |
| sint32                    | scoreConditionCount     | 1.00->                   | Number of score condition entries. |
| ScoreCondition[scCount]   | scoreConditions         | 1.00->                   | The type of things that affect player score, see below. |


#### Player Victory Condition (VictoryCondition)
| Type                        | Name                  | PlayerPerformanceVersion | Description |
| ---------                   | -------               | -----------              | ----------- |
| uint8 (PlayerVcType)        | conditionType         | 0.00->                   | Constant for victory condition type, see Appendix |
| sint32 (PrototypeId)        | prototypeId           | 0.00->                   | Prototype id for condition data |
| sint32 (PlayerSlot)         | targetPlayer          | 0.00->                   | Player that is target of the condition |
| float                       | areaLeft              | 0.00->                   | Condition area left bound |
| float                       | areaTop               | 0.00->                   | Condition area top bound |
| float                       | areaRight             | 0.00->                   | Condition area right bound, inclusive |
| float                       | areaBottom            | 0.00->                   | Condition area bottom bound, inclusive |
| sint32 (*)                  | quantity1             | 0.00->                   | Quantity for Create/Destroy X amount conditions. AttributeId for Attribute condition. |
| sint32 (*)                  | quantity2             | 0.00->                   | Quantity for Attribute, Exploration and Score conditions. TechnologyId for Technology condition. |
| sint32 (ObjectId)           | sourceObjectId        | 0.00->                   | Object id for source object. See Appendix |
| sint32 (ObjectId)           | targetObjectId        | 0.00->                   | Object id for target object. See Appendix |
| uint8 (VictoryGroup)        | victoryGroup          | 0.00->                   | Victory group for condition. When all conditions of one group have been achieved, the player wins. See Appendix |
| bool8                       | teamTogether          | 0.00->                   | This controls whether allies are also considered for the condition. Does not do anything for some conditions. For attributes/exploration/score, this means that team quantities are summed. Also works for Create X amount objects and Capture. |
| uint8 (PlayerVcState)       | conditionState        | 0.00->                   | This is updated as the game runs. See Appendix |

#### Player Score Condition (ScoreCondition)
| Type                        | Name                  | PlayerPerformanceVersion | Description |
| ---------                   | -------               | -----------              | ----------- |
| uint8 (PlayerScType)        | conditionType         | 1.00->                   | Constant for score condition type, see Appendix |
| uint8 (PlayerScState)       | conditionState        | 1.00->                   | This is updated as the game runs. Should be 0 for scenarios. See Appendix. |
| sint32 (AttributeId)        | attributeId           | 1.00->                   | Attribute id for score condition. See Appendix |
| sint32                      | requiredAmount        | 1.00->                   | How much is needed for the condition to be fulfilled. (Might be fulfillable multiple times depending on conditionType) |
| sint32                      | scoreAmount           | 1.00->                   | How much score meeting this condition will yield. |
| sint32                      | accruedScore          | 1.00->                   | Used by the game to keep track of condition accrued score. Should be 0 for scenarios. |
| uint8 (StatisticsType)      | statisticsType        | 1.00->                   | This is used by the Achievements screen to lookup for values for columns. If two with the same value exist, only the first will be picked so they should be unique. |
| uint8 (StatisticsCategory)  | statisticsCategory    | 1.00->                   | This is used by the Achievements screen to group scores into categories. |
| float                       | playerAttributeAmount | 1.00->                   | Used by the game to keep track of attribute changes. Should be 0 for scenarios. |

### Player Technology Tree (PlayerTechTree)
This is only included in very old scenario versions. For later versions it is best to ignore this since it only contains civilization specific data (disabled technologies were not supported yet). Also, having more entries here than in the actual technology tree will cause instabilities. Having less technologies is okay, but the missing technologies will be unresearchable. In older versions, starting ages were actually set by updating the technology tree.

To create a player technology tree compatible with v00.04.03.0113, it should have a technologyCount of 107. For a stone age start, all technologies can be set to state 0 = Hidden. Creating a later age start is much more complicated since the technology states should match what is actually researched in a Tool/Bronze/Iron Age start.

| Type                        | Name                  | ContainerVersion  | Description |
| ---------                   | -------               | -----------       | ----------- |
| sint16                      | technologyCount       | 1.01-1.03         | Number of entires that follow |
| PlayerResearch[techCount]   | technologyEntries     | 1.01-1.03         | Actual technology entries, see below |

#### Player Reserarch State (PlayerResearch)
| Type                        | Name                  | ContainerVersion  | Description |
| ---------                   | -------               | -----------       | ----------- |
| sint16                      | researchProgress      | 1.01-1.03         | Should be 0 for scenarios. Number between 0-100, research progress percentage. |
| sint16 (ResearchState)      | researchState         | 1.01-1.03         | State of this research, see Appendix. |

# Appendix

## Special numbers (enums)
TODO: Make this alphabetical?

### StringId
This number references an entry in the language.dll file. Valid numbers in regular AoE/AoK are up to 65535, higher numbers will wrap around to zero.

-1 = Empty String

### CivilizationId
This is the number of the civilization as seen in the .DAT file. 

0 = Gaia<br>
1 = Egyptian/Britons<br>
2 = Greek/Franks<br>
...

### ScnPlayerType
Determines which player types may occupy the slot in single player games (in multipler this has no effect)

0 = Computer player<br>
1 = Either (human) player

### AiEmotion
This was probably used to serve a similar purpose as personality. The following are the known valid values, but they still have no effect.

0 = Aggressive<br>
1 = Compassionate<br>
2 = Defeinsive<br>
3 = Friendly<br>
4 = Passive<br>
5 = Vengeful

### ScenarioAgeId
This does not correspond to the attribute value (in original AoE, Stone Age has attribute value 1 as a remnant of the ice age)

0 = Stone Age<br>
1 = Tool Age<br>
2 = Bronze Age<br>
3 = Iron Age<br>
4 = Post-Iron Age

### ObjectId
This is the id of one specific object. Each object has its own id, even two separate Villagers have distinctive object ids. Visible in debug builds by pressing Ctrl+I / Alt+I.

-1 = None

### ScenarioObjId
This is almost equivalent to ObjectId, but not quite. There is a one-to-one mapping between these two types. These can be converted to ObjectId by subtracting 1 from the value (i.e. for ScenarioObjId 0 means no object while for ObjectId -1 is no object)

0 = None

### PrototypeId
This is the id of a specific unit type. For example for Villagers this is 83.

-1 = None.

### EnableTechId
The index of the array specifies the technology! Older versions of the game ignore unsupported values (Town Center and Wonder)

0 = Granary<br>
1 = Storage Pit<br>
2 = Dock<br>
3 = Barracks<br>
4 = Market<br>
5 = Archery Range<br>
6 = Stable<br>
7 = Temple<br>
8 = Government Center<br>
9 = Siege Workshop<br>
10 = Academy<br>
11 = Tool Age<br>
12 = Bronze Age<br>
13 = Iron Age<br>
14 = Town Center (Only in later versions)<br>
15 = Wonder (Only in later versions)<br>
16-19 = Unused<br>


### IndividualCond
0 = None<br>
1 = Destroy<br>
2 = CreateObject<br>
3 = BringObject<br>
4 = IndividualAttribute<br>
5 = CaptureObject<br>
6 = Attribute<br>
7 = Technology (Only in later versions)<br>
8 = Score (Only in Achilles)

### IndividualAttributeId
-1 = None<br>
0 = Gold<br>
1 = Wood<br>
2 = Stone<br>
3 = Food<br>
4 = Population<br>
5 = Age<br>
6 = Exploration

### AttributeId
-1 = None<br>
0 = FoodStockpile<br>
1 = WoodStockpile<br>
2 = StoneStockpile<br>
3 = GoldStockpile<br>
4 = PopulationCapacity<br>
5 = Religion (Unused)<br>
6 = Age<br>
7 = ArtifactCount<br>
8 = TradeBonus<br>
9 = TradeGoods<br>
10 = TradeProduction<br>
...


### PlayerVcType
Note that earlier versions of the game will crash if they encounter an unknown type!

0 = CaptureObject<br>
1 = CreateObjects<br>
2 = DestroyObject<br>
3 = DestroyObjects<br>
4 = BringObjectToArea<br>
5 = BringObjectToObject<br>
6 = Attribute<br>
7 = Exploration<br>
8 = CreateObjectsInArea<br>
9 = DestroyAllObjects<br>
10 = DestroyPlayer<br>
11 = Unused<br>
12 = Score (Only in later versions)<br>
100 = Technology (Only in later versions)


### PlayerVcState
The state value should always be 0 for conditions stored in a scenario. This value is updated by the game as follows:

0 = Uncompleted<br>
1 = ObjectDead (For capture/bring object if the object dies)<br>
2 = Completed<br>
3 = ObjectGone (For capture/bring object if the object is not found/no longer exists)

### VictoryGroup
You can use any number for victory groups. The official scenario editor uses the following numbers:

0 = ScoreVictoryGroup (When score is the global victory condition, a Player Victory Condition with this group is added)<br>
1 = IndividualVictoryGroup (All individual victory conditions created in the scenario editor use the same group, thus all must be achieved)<br>
8 = GlobalVictoryAllGroup (If all is ticket, the custom global victory conditions use the same group)<br>
8 = GlobalVictoryAnyGroupExploration (If any is ticket, they are placed into separate groups)<br>
9 = GlobalVictoryAnyGroupArtifacts<br>
10 = GlobalVictoryAnyGroupRuins<br>
11 = GlobalVictoryAnyGroupDiscoveries<br>
12 = GlobalVictoryAnyGroupGold<br>

### PlayerSlot
Player slots have Gaia at 0 and Player 1 at 1. Note that this is different from the ScenarioData indexes where Player 1 is at 0 and Gaia is at 8!

-1 = None<br>
0 = Gaia<br>
1 = Player1<br>
2 = Player2<br>
3 = Player3<br>
4 = Player4<br>
5 = Player5<br>
6 = Player6<br>
7 = Player7<br>
8 = Player8


### PlayerType
0 = BasePlayer (causes game to crash...)<br>
1 = Human<br>
2 = Gaia<br>
3 = Computer<br>

EventType
EventObjId
Verify
TechnologyId


### Player Score Condition Type (PlayerScType)
0 = AttributeAmount<br>
1 = AttributeFirst<br>
2 = AttributeGlobalHighest<br>
3 = AttributeGlobalHighestFirst<br>
4 = AttributePersonalHighest<br>
5 = AttributeGlobalLowest (since AoK)<br>
6 = Unused<br>
7 = AttributeDifference (since AoK)<br>

### Player Statistics Category (StatisticsCategory)
0 = Military<br>
1 = Economy<br>
2 = Religion<br>
3 = Technology<br>
4 = Summary<br>
5 = Society

### Player Statistics Type (StatisticsType)
0 = Kills<br>
1 = Razings<br>
2 = KillsLessLosses<br>
3 = LargestArmy<br>
4 = GoldCollected (GoldStockpile in AoK)<br>
5 = VillagerHigh<br>
6 = VillagerBonus<br>
7 = Exploration<br>
8 = MostExplored<br>
9 = TributeGiven (Discoveries in Alpha)<br>
10 = Conversions<br>
11 = MostConversions<br>
12 = RuinsCaptured (MonumentsCaptured in AoK)<br>
13 = ArtifactsCaptured (RelicsCaptured in AoK)<br>
14 = Temples<br>
15 = AllRuins (AllMonuments in AoK)<br>
16 = AllArtifacts (AllRelics in AoK)<br>
17 = Technologies<br>
18 = MostTechnologies<br>
19 = BronzeAgeFirst<br>
20 = IronAgeFirst<br>
21 = AllTechnologies<br>
22 = Survival<br>
23 = Wonder<br>
(AoK starts)<br>
24 = FoodStockpile<br>
25 = WoodStockpile<br>
26 = StoneStockpile<br>
27 = RelicGold<br>
28 = TradeProfit<br>
29 = ObjectCostSum<br>
30 = TechnologyCostSum<br>
31 = KilledUnitsCostSum<br>
32 = TributeReceived<br>
33 = TributePlayer1<br>
34 = TributePlayer2<br>
35 = TributePlayer3<br>
36 = TributePlayer4<br>
37 = TributePlayer5<br>
38 = TributePlayer6<br>
39 = TributePlayer7<br>
40 = TributePlayer8<br>

49 = KillsPlayer1<br>
50 = KillsPlayer2<br>
51 = KillsPlayer3<br>
52 = KillsPlayer4<br>
53 = KillsPlayer5<br>
54 = KillsPlayer6<br>
55 = KillsPlayer7<br>
56 = KillsPlayer8<br>

64 = RazingsPlayer1<br>
65 = RazingsPlayer2<br>
66 = RazingsPlayer3<br>
67 = RazingsPlayer4<br>
68 = RazingsPlayer5<br>
69 = RazingsPlayer6<br>
70 = RazingsPlayer7<br>
71 = RazingsPlayer8<br>

80 = RazedBuildingsCostSum<br>
81 = CastlesBuilt<br>

83 = WondersBuilt<br>
84 = FoodCollected<br>
85 = WoodCollected<br>
86 = StoneCollected<br>
87 = GoldCollected<br>
88 = UnitsLost<br>
89 = BuildingsLost<br>

91 = TributeSent<br>

123 = CastlesWondersCostSum<br>

### ResearchState
-1 = Disabled<br>
0 = Hidden (all prerequisites have not been yet met)<br>
1 = Available<br>
2 = InProgress<br>
3 = Researched<br>

ScnContainer	Function	      PlayerVersion
1.01            load_scenario1    1.00
1.02            load_scenario2    1.03
1.03            load_scenario2    1.03
1.04            load_scenario3    1.04
1.05            load_scenario4    1.04 (bug or not?)
1.06            load_scenario5    1.06
1.07            load_scenario6    1.07
1.08            load_scenario7    1.08
1.09            load_scenario8    1.11
1.10            load_scenario8    1.11
1.11            load_scenario8    1.11
1.12*           load_scenario8    1.11
1.12            load_scenario9    1.12
1.13            load_scenario10   1.12
1.14            load_scenario11   1.12
1.15            load_scenario11   1.12
1.16            load_scenario11   1.12
1.17            load_scenario11   ?????
1.18            load_scenario11   1.13
1.19            load_scenario11   1.13
1.20            load_scenario11   1.14
1.21            load_scenario11   1.14

* ROR trial fake 1.12