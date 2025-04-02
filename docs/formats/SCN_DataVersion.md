SCN Data Version Summary

Version 1.00 (1997-01-01)
- First known version

Version 1.01 (1997-01-16)
- Added allied victory (separate allied victory stance with each player similar to diplomacy, total of 16*16 values. Possibly a bug, because the game already allowed allied victory with just one value)

Version 1.02 (1997-01-17)
- Allied victory changed to single value per player, similar to final

Version 1.03 (1997-01-20)
- Removed description message
- Removed victory message
- Removed defeat message
- Removed embedded AI .ai (.bld) files from scenarios
- Removed embedded AI .cty files from scenarios
- Added 4 padding byte sets of 0xFFFFFF9D 

Version 1.04 (1997-01-22)
- Added technology/building disables (total of 20 values, but Town Center and Wonder were not supported initially!)

Version 1.05 (1997-01-26)
- Added lengthen combat option boolean

Version 1.06 (1997-01-28)
- Added player starting ages

Version 1.07 (1997-02-14)
- Added conquest victory boolean

Version 1.08 (1997-02-28)
- Added support for AI .per files (filename and size)

Version 1.09 (1997-04-02)
- Added support for instruction bitmap filename

Version 1.10 (1997-04-02)
- Added support for embedded instruction bitmap file

Version 1.11 (1997-04-09)
- Readded victory message
- Readded defeat message
- Added hints message
- Added history message

Version 1.12 (1997-05-15)
- Added enable cheats option boolean
- Added full tech tree option boolean

Version 1.13 (1997-05-30)
- Added support for global victory condition (Standard, Conquest, Time Limit, Score or Custom)
- Added support for global victory score threshold
- Added support for global victory time limits

Version 1.14 (1997-06-03)
- Moved player names to the top of the scenario data
- Moved playerEnabled, playerType, playerCivilization, playerAiEmotionalState out of ScnPlayerStartInfo to the top of the scenario data into their own substructure

Version 1.15 (1997-09-03)
*Last version supported by AoE*
- Readded support for embedded AI .ai files
- Readded support for embedded AI .cty files
- Added support for embedded AI .per files

Version 1.16 (1998-04-13)
- Added support for localized player names with string ids
- Added support for localized instructions message with string ids
- Added support for localized hints message with string ids
- Added support for localized victory message with string ids
- Added support for localized defeat message with string ids
- Added support for localized history message with string ids

Version 1.17 (1998-05-15)
- Added support for player starting ore amount
- Added support for player starting trade goods amount

Version 1.18 (1999-01-21)
- Removed old technology/building disables data
- Added new technology disables which allows specifying up to 30 TechologyId(s) to be disabled
- Added new units disables which allows specifying up to 30 PrototypeId(s) to be disabled
- Added new buildings disables which allows specifying up to 20 PrototypeId(s) to be disabled

Version 1.19 (1999-02-05)
- Added support for setting human player initial game view location (x and y coordiantes)

Version 1.20 (1999-06-16)
- Added support for AI rule type

Version 1.21 (2000-??-??)
- Added support for specifying scenario random map type (for AI)

Version 1.22 (2000-05-04)
- Added scouts message and string id

