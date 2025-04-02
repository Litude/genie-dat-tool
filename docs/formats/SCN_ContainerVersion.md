SCN Container Version Summary

Version 1.01 (1997-01-01)
- First known version

Version 1.02 (1997-01-15)
- Allied victory information stored to player data

Version 1.03 (1997-01-20)
- Scenario container version number is no longer compressed
- Scenario header added

Version 1.04 (1997-01-26)
- Player technologies researched removed

Version 1.05 (1997-01-29)
- Player Supplemental Data (PlayerSuppData) has been removed
- Player Main Data (PlayerData) has been moved to where PlayerSuppData was previously
- Developer tag removed

Version 1.06 (1997-01-30)
- Player Main Data (PlayerData) has been moved back to where it was before 1.05
- Added a second (duplicate) player count number before the Player Main Data (PlayerData) block

Version 1.07 (1997-02-04)
- Readded Player Supplemental Data (PlayerSuppData) but now with player resource fields instead (which are actually used) and there is no longer a Gaia entry (so one entry less!)
- Removed playerAttributes from Player Main Data (PlayerData) since resources are stored in the supplemental block instead

Version 1.08 (1997-03-31)
- Additional diplomacy stance data stored in Player Main Data (PlayerData)

Version 1.09 (1997-04-08)
- Added version number for the Player Performance Data (PlayerPerformance) block

Version 1.10 (1997-08-09)
- Identical to 1.09 (Possibly introduced with the CGW demo to make it incompatible with other versions). Also header version 2 was introduced at this point.

Version 1.11 (1997-08-12)
*last real version supported by AoE*
- Identical to 1.10 and 1.09. Possibly introduced to make demo scenarios incompatible with final?

Version 1.12 (1998-05-15)
*There are actually two different 1.12. The ROR trial uses 1.12 to restrict scenarios to the demo but these are actually again the same as 1.09-1.11. AoK supports a real 1.12 which is covered here. Best detection is perhaps to check if scenario data version is greater than 1.15 (last supported by AoE)*
- No actual data changes, but slot 8 of scenario data is now considered as definitions of the Gaia player

**TODO: This is probably wrong**
Version 1.13
- Added player color to Player Main Data (PlayerData)
- Added player starting trade goods to Player Supplemental Data (PlayerSuppData)
- Added player starting ore to Player Supplemental Data (PlayerSuppData)

Version 1.20
- Added player population limit to Player Supplemental Data (PlayerSuppData)