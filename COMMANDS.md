# Command Overview

## General
* The general format of input into the bot is as follows: `|bb [unit|item] [search queries]`
    * The `|bb` can be changed to some other starting command liks `~bb` via the `config.js` file.
    * Note that `|bb` is using the [pipe character](https://en.wikipedia.org/wiki/Vertical_bar) (under the backspace and above the enter key on a QWERTY keyboard), not a lowercase L.
* Some terminology for commands
    * `--p_<command>` is the format for commands used to printing stuff
    * `--l_<command>` is the format for commands used to list stuff
    * `ls` stands for Leader Skill
    * `bb` stands for Brave Burst. `sbb` stands for Super Brave Burst. `ubb` stands for Ultimate Brave Burst.
    * `sp` stands for Skill Points
    * `es` stands for Extra Skill
    * OE stands for Omni Evolution (rarity of 8 in the data)
    * EU is an alias for the European version of BF, GL is an alias for the Global version of BF, and JP is an alias for the Japanese version of BF
* Tips
    * Results too long? Try adding another search parameter (such as element, rarity, or server) to further refine your results. 
        * This can also save you an extra command. For example, getting the info for the EU version of Arthur can easily be done in one command with `|bb unit arthur --server EU` instead of using `|bb unit arthur` and getting the correct ID based on that.
* API Changes
    * As of May 27, 2017
        * Introduced embedding formatting for most messages; can still use old text format by putting `--noembed` in your command query.
        * Some small aliasing has been done in that background, so that typing in stuff like `--print_evo`, `--print_sbb`, and `--list_range` is equivalent to `--p_evo`, `--p_sbb`, and `--l_range`, respectively.
        * For embedded messages, I've introduced `--print_raw_effects` to print the stats for all of a unit's LS, ES, BB, SBB, and UBB in a single post, where applicable.
        * `--print_hitcount <string>` has changed to `--print_hitcounts` to print all of the hitcounts of a single unit.

---

## Units

* For this section, the general format for input is `|bb unit [name] [--p_command(s) [flag, if any]]`

### Searching Units
* Typing in `|bb unit --search_help` will give you a shortened version of what's in this section
* Not using any of these commands below will make the bot only search by name, guide ID, or unit ID
    * EX: `|bb unit Zekuu` will only list units with Zekuu in the name
    * EX: `|bb unit 10011` will only print the unit with unit ID 10011. Note that this can give unexpected results if any units share unit IDs (rare).
    * EX: `|bb unit 1562` will print the unit with guide ID 1562. Note that this can give unexpected results if any units share guide IDs.

| Command | Description | Example | Notes |
| :---: | :---: | :---: | :---: |
| none (i.e. just name only) | search for a unit by name or ID | `\|bb unit Zekuu` prints the info for Zekuu's OE form | |
| `--rarity <string>` | search for a unit based on a rarity (1-8) | `\|bb unit --rarity 8` lists all the units in their OE form | |
| `--element <string>` | search based on element (fire, water, earth, thunder, light, or dark) | `\|bb unit --element fire` lists all the fire units | |
| `--gender <string>` | search based on gender (male,female,or other) | `\|bb unit --gender other` lists all the genderless units | |
| `--move_speed <string>` | search based on move speed (1-5) | `\|bb unit --move_speed 5` lists all units with a move speed of 5 | |
| `--ls_desc <string>` | search based on its LS name or description | `\|bb unit --ls_desc reduction` lists all units with the word "reduction" in their leader skill | see note below this table about searching using name or description |
| `--ls_effect <string>` | search based LS buffs (raw JSON) | `\|bb unit --ls_effect xp gained increase` lists all units with some form of XP buff on LS | see note below this table about JSON searches |
| `--bb_desc <string>` | search based on its bb name or description | `\|bb unit --bb_desc bc efficacy` lists all units who have "BC efficacy" in their BB description | see note below this table about searching using name or description |
| `--bb_effect <string>` | search based BB buffs (raw JSON) | `\|bb unit --bb_effect ailments cured` lists all units who cure status ailments on BB | see note below this table about JSON searches |
| `--sbb_desc <string>` | search based on its SBB name or description | `\|bb unit --sbb_desc remaining HP` lists all units who have an HP scaling SBB | see note below this table about searching using name or description |
| `--sbb_effect <string>` | search based SBB buffs (raw JSON) | `\|bb unit --sbb_effect bc fill when attacked` lists all units with the BC fill when attacked buff on SBB | see note below this table about JSON searches |
| `--ubb_desc <string>` | search based on its UBB name or description | `\|bb unit --ubb_desc raising allies` lists all the units with the raising allies from KO buff (i.e. revive) on UBB | see note below this table about searching using name or description | 
| `--ubb_effect <string>` | search based UBB buffs (raw JSON) | `\|bb unit --ubb_effect hit increase buff` lists all the units with a hit count buff on UBB | see note below this table about JSON searches |
| `--es_desc <string>` | search based on its ES name or description | `\|bb unit --es_desc negates all status ailments` lists all units with negates all status ailments on their ES | see note below this table about searching using name or description | 
| `--es_effect <string>` | search based ES buffs (raw JSON) | `\|bb unit --es_effect mitigation for elemental attacks` lists all hte units who have some form of elemental mitigation on their ES | see note below this table about JSON searches |
| `--sp_desc <string>` | search based on its SP names or descriptions | `\|bb unit --sp_desc status ailment removal` lists all units who can cleanse ailments via SP | see note below this table about searching using name or description | 
| `--sp_effect <string>` | search based sp buffs (raw JSON) | `\|bb unit --sp_effect add to bb` lists all the units who add something to their BB via SP | see note below this table about JSON searches |
| `--server <string>` | search based on what server it's on (gl, eu, or jp) | `\|bb unit arthur --server GL` lists the info of Arthur for global instead of a result listing for Arthur on EU and GL | |
| `--all_desc <string>` | search based on its all of it's names and descriptions | `\|bb unit --all_desc damage reduction for 2 turns` lists all the units with some form of mitigation that lasts 2 turns on LS, ES, BB, SBB, UBB, or SP | see note below this table about searching using name or description | 
| `--all_effect <string>` | search based on all of its effects (raw JSON) | `\|bb unit --all_effect angel idol` lists all the units with some form of angel idol on LS, ES, BB, SBB, UBB, or SP | see note below this table about JSON searches |
| `--strict` | Use this flag to always return the full results instead of the shortened results | `\|bb unit Feeva --strict` returns a search listing of all of Feeva's forms instead of just printing her OE info


* Queries for each command aren't limited to those commands (e.g. you could search for `hit increase buff` in BB or SBB as well, not only UBB), but there may be some buffs that are exclusive to a specific part of the unit, such as timed buffs only being found on LS or ES.
* Your searches can be further refined by chaining some of these together
    * EX: `|bb unit --element dark --rarity 8 --all_effect reduction` lists all dark OE units who have some form of mitigation on LS, ES, BB, SBB, UBB, or SP
    * EX: `|bb unit --rarity 8 --element fire` lists all OE fire units
* If in the search results only one unit of different is found, the bot will automatically display the info of the unit with the highest rarity (unless if you're searching by guide ID, rarity, or using `--strict`)
* For commands that search by name or description, they only work for units that are already in English (i.e. don't need `--translate` by default).
* For commands that use JSON, refer to how buffs are worded in JSON form (via `--p_ls`, `--p_bb`, etc. commands).
    * For example, AI buffs are start off worded as `angel idol`. So searching `|bb unit --all_effect angel idol` will give a list of all units who have some form of angel idol on LS, ES, BB, SBB, UBB, and/or SP enhancements.
    * Note that searching via raw JSON is a little buggy, so searching up anything with special characters like `dmg% reduction` can turn up no results.

### Printing Units
* Typing in `|bb unit --print_help` will give you a shortened version of what's in this section
* Not using any of these commands below will make the bot print the general info of a unit
* If more than one unit exists in the search results, the bot will print the output in a similar format to the output below (this is the output for `|bb unit agress`).
```
Multiple units found. Please try the command again using one of the IDs below.
---
1489: Dawn Emperor Agress (51066)
1490: Supreme Emperor Agress (51067)
21: Iron Magress (60011)
22: Heavy Magress (60012)
23: Black Magress (60013)
24: Death Magress (60014)
343: Unholy Magress (60015)
806: Dark Legend Magress (60016)
1307: Umbra Halcyon Magress (60017)
```
* EX: `|bb unit Zekuu` will print Zekuu's info in a similar format to the output below.
```
1518: Halting Victory Zekuu | 8* | dark | 48 Cost | male
* 1 hit (42DC) | Move Speed: 3 | Move Type: Moving
* LS: Conquering Blade Flash - 50% boost to max HP, 200% boost to Atk for first 3 turns, probable considerable reduction of BB gauge fill rate for 2 turns & considerably boosts ABP and CBP gain
* ES: Undiminished Flash - Considerably boosts critical damage & Spark damage enormously boosts BB gauge
* BB: Lament - (30BC/1hits/20DC) Powerful Dark attack on all foes, high probable Injury and Curse effects, considerably boosts own Atk for 3 turns & enormously boosts own critical hit rate for 3 turns
* SBB: Myriad - (32BC/1hits/20DC) Powerful Dark attack on all foes, powerful Dark attack on single foe, high probable Injury and Curse effects, considerably boosts own Atk for 3 turns, enormously boosts own critical hit rate and boosts own critical damage for 3 turns
* UBB: Blood Mist - (30BC/1hits/40DC) Massive Dark attack on all foes, enormously boosts Atk for 3 turns, enormously boosts all elemental damage for 3 turns & enormously boosts Spark damage and critical damage for 3 turns
---
http://2.cdn.bravefrontier.gumi.sg/content/unit/img/unit_ills_full_61057.png
```

| Command | Description | Example | Notes |
| :---: | :---: | :---: | :---: |
| `--translate` | Print the translation from Japanese to English of a unit. Uses Google Translate API. | `\|bb unit 51156 --translate` prints the translation for the JP version of Juno Seto | |
| `--p_raw_effects` | Prints out the raw JSON data of a unit's LS, ES, BB, SBB, and UBB where applicable | `\|bb unit feeva --print_raw_effects` prints the raw JSON data for Feeva | can be used to find possible search queries for buffs; applicable only when not using `--noembed`
| `--p_ls` | Print the raw leader skill data of a unit | `\|bb unit Zeis --p_ls --noembed` prints the raw JSON data of Zeis's LS | can be used to find possible search queries for buffs
| `--p_es` | Print the raw extra skill data of a unit | `\|bb unit galea --p_es --noembed` prints the raw JSON data of Galea's ES | can be used to find possible search queries for buffs
| `--p_bb` | Print the raw brave burst data of a unit | `\|bb unit wannahon --p_bb --noembed` prints the raw JSON data of Wannahon's BB | can be used to find possible search queries for buffs
| `--p_sbb` | Print the raw sbb data of a unit | `\|bb unit durumn --p_sbb --noembed` prints the raw JSON data of Durumn's SBB | can be used to find possible search queries for buffs
| `--p_ubb` | Print the raw ubb data of a unit | `\|bb unit ceulfan --p_ubb --noembed` prints the raw JSON data for Ceulfan's UBB | can be used to find possible search queries for buffs
| `--p_sp` | Print the SP data of a unit, does not require raw flag | `\|bb unit keres --p_sp` prints out the SP options for Keres | can be used to find possible search queries for buffs
| `--p_sp_skill <string>` | Print the raw JSON data of a unit's SP option given an ID or index | `\|bb unit keres --p_sp_skill 9` and `|bb unit keres --p_sp_skill 1000001026 --noembed` print the raw JSON data of the SP option `[30 SP] | (Special) - Adds Light, Dark damage reduction for 1 turn effect to BB/SBB (1000001026,9)` from Keres | can be used to find possible search queries for buffs; at the end of every SP listing is an ordered pair of numbers and either number can be used to print that SP skill's info. In this example, the ordered pair is (1000001026,9), meaning that you could either use 1000001026 or 9 as the input to this command
| `--p_evo` | Print the evolution data of a unit | `\|bb unit vargas --rarity 7 --p_evo` prints out the evolution materials to go from 7\* Vargas to OE Vargas | |
| `--p_arena` | Print the raw arena data of a unit | `\|bb unit selena --p_arena` prints out the arena data for Selena | |  
| `--p_stats` | Print the stats table of a unit; it features the base stats along with the maxed lord, anima, etc. stats of a unit and its imp caps | `|\bb unit Eze --rarity 8 --p_stats` prints the stats table for OE Eze
| ~~`--p_hitcount <string>`~~ | ~~Print the hit count table of a specified field of a unit (normal, bb, sbb, ubb)~~ | ~~`\|bb unit gabriela --p_hitcount sbb` prints out the hit count table of Gabriela's SBB~~ | ~~Supports most units with 2-tier attacks (like Gabriela); units with random hits will only have one hit shown on the table~~; replaced with `--p_hitcounts` as of May 27, 2017 | 
| `--p_hitounts` | Same as the old `--p_hitcount <string>`, but prints out the data for all types of attacks for a unit instead of a single one | `\|bb unit gabriela --p_hitcounts` prints out the hit count table of Gabriela normal attacks, BB, SBB, and UBB | You can attach `--noembed` at the end to print out the tables that are too large for embedded messages.


* Some of the commands can be chained together, but if the combined result passes the character limit, nothing or an error is shown.

### Listing Units
* Typing in `|bb unit --list_help` will give you a shortened version of what's in this section
* ~~There are two types of listing options: `l_range` and `l_count`~~
    * The bot and server now only support `l_range` as of June 9, 2017

| Command | Description | 
| :---: | :---: | 
| ~~`--l_range`~~ | ~~list units in a given range of guide or unit IDs~~ Deprecated as of June 9, 2017; no longer necessary
| `--l_start <number>` | for range and count; starting value; -1 is default |
| `--l_end <number>` | for range only; ending value; -1 is default |
| `--l_type <string>` | type of search; possible options include guide (for guide ID) and unit (for unit ID); defaults to guide

* EX: `|bb unit --l_type unit --l_start 60660 --l_end 60670` prints all units whose ID is between 60660 and 60670 inclusively
* EX: `|bb unit --l_start 1600` prints all units whose guide ID is 1600 or larger

---

## Items

* For this section, the general format for input is `|bb item [name] [--p_command(s) [flag, if any]]`

### Searching Items
* Typing in `|bb item --search_help` will give you a shortened version of what's in this section
* Not using any of these commands below will make the bot only search by name or item ID
    * EX: `|bb item cure` will only list items with cure in the name
    * EX: `|bb item 20000` will only print the item with item ID 20000. Note that this can give unexpected results if any items share item IDs.

| Command | Description | Example | Notes |
| :---: | :---: | :---: | :---: |
| none (i.e. just name only) | search for an item by name or ID | `\|bb unit heaven's edge` prints the info for Heaven's Edge | |
| `--rarity <string>` | search based on rarity (0-7) | `\|bb item --rarity 7` lists all the items that have a 7\* rarity | |
| `--type <string>` | search based on the item type. Possible types include material, consumable, sphere, evomat, summoner\_consumable, and ls\_sphere | `\|bb item --type ls_sphere` lists all the LS spheres you can use in SArc | |
| `--desc <string>` | search based on an item's description | `\|bb item --desc guild raid` lists all the items with guild raid in their description | see note below this table about searching using name or description | 
| `--effect <string>` | search based an item's effects (raw JSON) | `\|bb item --effect hit increase/hit` lists all spheres with a hit count buff | see note below this table about JSON searches |
| `--sphere_type <string>` | search based on a sphere type. Possible types include Status Boost, Critical, Drop, Status Ailment, Damage Reducing, Status Ailments Resistant, BB Gauge, HP Recovery, Expose Target, Damage Reflecting, Spark, Defense Penetrating, Atk Boosting, and Special | `\|bb item --sphere_type Defense Penetrating` lists all the spheres that have the type Defense Penetrating 
| `--server <string>` | search based on what server it's on (eu, gl, or jp) | `\|bb item grail --server eu` lists the EU version of The Grail sphere | |

* Your searches can be further refined by chaining some of these together
    * EX: `|bb item --sphere_type status boost --rarity 7` lists all the Status Boost spheres with a rarity of 7
* For commands that search by name or description, they only work for items that are already in English (i.e. don't need `--translate` by default).
* For commands that use JSON, refer to how buffs are worded in JSON form (via `--p_effects`).
    * For example, spark buffs are worded as `damage% for spark`. So searching `|bb item --effect for spark` will give a list of all items that have a spark buff
    * Note that searching via raw JSON is a little buggy, so searching up anything with special characters like `dmg% reduction` can turn up no results.

### Printing Items
* Typing in `|bb item --print_help` will give you a shortened version of what's in this section
* Not using any of these commands below will make the bot print the general info of an item
* If more than one item exists in the search results, the bot will print the output in a similar format to the output below (this is the output for `|bb item cure`).
```
Multiple items found. Please try the command again using one of the IDs below.
---
Cure (20000)
High Cure (20001)
Mega Cure (20002)
Cure Bracer (33800)
Cure Gizmo 2 (34804)
Cured Glass (42000)
```
* EX: `|bb item heaven's edge` will print the info for Heaven's Edge in a similar format to the output below.
```
Heaven's Edge (47410) | sphere | 7* | Sphere Type: Status Boost
* Sell Price: 100 000 | Max Stack: 1
Desc: Grants a myriad of abilities
---
http://2.cdn.bravefrontier.gumi.sg/content/item/sphere_thum_5_2.png
```

| Command | Description | Example | Notes |
| :---: | :---: | :---: | :---: |
| `--translate` | Print the translation from Japanese to English of an item. Uses Google Translate API. | `\|bb item 47214 --translate` prints the translation for item 47214 | |
| `--p_effects` | Print the effect(s) of an item | `\|bb item leto crown --p_effects` prints out the effects for Leto Crown | can be used to find possible search queries for buffs
| `--p_recipe` | Print the crafting recipe of an item | `\|bb item lunar essence orb --p_recipe` prints out the recipe to make Lunar Essence Orb | |
| `--p_usage` | Print the items that use this item as a crafting material | `\|bb item distilled ether --p_usage` prints out the items that use Distilled Ether as a crafting material | |
| `--p_location` | Print where this item can be found. Uses the GL and EU wiki | `\|bb item sacred jewel --p_location` prints out places where you can obtain a Sacred Jewel | Pulls data from either wiki and posts that information. JP items are not supported at this time. |

* Some of the commands can be chained together, but if the combined result passes the character limit, nothing or an error is shown.

### Listing Items
* Typing in `|bb item --list_help` will give you a shortened version of what's in this section

| Command | Description | 
| :---: | :---: | 
| `--l_start <number>` | starting value for listing IDs; -1 is default |
| `--l_end <number>` | ending value for listing IDs; -1 is default |

* EX: `|bb item --list_start 20000 --list_end 30000` prints all items whose ID is between 20000 and 30000 inclusively.
* EX: `|bb item --l_start 50000` lists all the items whose ID is greater than or equal to with 50000.


---

## Other

| Command | Description | Example | Notes |
| :---: | :---: | :---: | :---: |
| `\|bb bfdb` | Prints out information about server updates in an embedded message | | |
| `\|bb about` | Prints out some general info about the bot itseld | | Links back to this GitHub repository |
| `\|bb about --uptime`| Prints out the time since the bot was last updated | | | 
