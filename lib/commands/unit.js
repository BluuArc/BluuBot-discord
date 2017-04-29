var Clapp = require('../modules/clapp-discord');
var request = require('request-promise')
var fs = require('fs');
var underscore = require('underscore');
var Table = require('easy-table');

var command_args = [
  {
    name: 'name',
    desc: 'search for a unit based on a given name or id; * is considered a wildcard',
    type: 'string',
    required: false,
    default: '*'
  },
]

var command_flags = [
  {
    name: 'print_help',
    desc: 'tells you stuff about printing info',
    type: 'boolean',
    internal_type: "help",
    default: false
  },
  {
    name: 'translate',
    desc: 'Print the translation from Japanese to English of a unit. Uses Google Translate API.',
    type: 'boolean',
    internal_type: "print",
    default: false
  },
  {
    name: 'raw',
    desc: 'Print the raw data of a unit. Most p_commands require this',
    type: 'boolean',
    internal_type: "print",
    default: false
  },
  {
    name: 'p_ls',
    desc: 'Print the raw leader skill data of a unit',
    type: 'boolean',
    internal_type: "print",
    default: false
  },
  {
    name: 'p_es',
    desc: 'Print the raw extra skill data of a unit',
    type: 'boolean',
    internal_type: "print",
    default: false
  },
  {
    name: 'p_bb',
    desc: 'Print the raw brave burst data of a unit',
    type: 'boolean',
    internal_type: "print",
    default: false
  },
  {
    name: 'p_sbb',
    desc: 'Print the raw sbb data of a unit',
    type: 'boolean',
    internal_type: "print",
    default: false
  },
  {
    name: 'p_ubb',
    desc: 'Print the raw ubb data of a unit',
    type: 'boolean',
    internal_type: "print",
    default: false
  },
  {
    name: 'p_sp',
    desc: 'Print the SP data of a unit, does not require raw flag',
    type: 'boolean',
    internal_type: "print",
    default: false
  },
  {
    name: 'p_evo',
    desc: 'Print the evolution data of a unit, does not require raw flag',
    type: 'boolean',
    internal_type: "print",
    default: false
  },
  {
    name: 'p_sp_skill',
    desc: 'Print the raw SP data of a unit',
    type: 'string',
    internal_type: "print",
    default: ''
  },
  {
    name: 'p_arena',
    desc: 'Print the raw arena data of a unit, does not require raw flag',
    type: 'boolean',
    internal_type: "print",
    default: false
  },
  {
    name: 'p_stats',
    desc: 'Print the lord stats (and imps) of a maxed unit, does not require raw flag',
    type: 'boolean',
    internal_type: "print",
    default: false
  },
  {
    name: 'p_hitcount',
    desc: 'Print the hit count table of a specified field of a unit (normal, bb, sbb, ubb)',
    type: 'string',
    internal_type: "print",
    default: ''
  },
  {
    name: 'search_help',
    desc: 'tells you stuff about searching info',
    type: 'boolean',
    internal_type: "help",
    default: false
  },
  {
    name: 'rarity',
    desc: 'search based on rarity',
    type: 'string',
    internal_type: "search",
    default: '*'
  },
  {
    name: 'element',
    desc: 'search based on element',
    type: 'string',
    internal_type: "search",
    default: '*'
  },
  {
    name: 'gender',
    desc: 'search based on gender (male,female,or other)',
    type: 'string',
    internal_type: "search",
    default: '*'
  },
  {
    name: 'move_speed',
    desc: 'search based on move speed',
    type: 'string',
    internal_type: "search",
    default: '*'
  },
  {
    name: 'ls_desc',
    desc: 'search based on its LS name or description',
    type: 'string',
    internal_type: "search",
    default: '*'
  },
  {
    name: 'ls_effect',
    desc: 'search based LS buffs (raw JSON)',
    type: 'string',
    internal_type: "search",
    default: '*'
  },
  {
    name: 'bb_desc',
    desc: 'search based on its bb name or description',
    type: 'string',
    internal_type: "search",
    default: '*'
  },
  {
    name: 'bb_effect',
    desc: 'search based bb buffs (raw JSON)',
    type: 'string',
    internal_type: "search",
    default: '*'
  },
  {
    name: 'sbb_desc',
    desc: 'search based on its sbb name or description',
    type: 'string',
    internal_type: "search",
    default: '*'
  },
  {
    name: 'sbb_effect',
    desc: 'search based sbb buffs (raw JSON)',
    type: 'string',
    internal_type: "search",
    default: '*'
  },
  {
    name: 'ubb_desc',
    desc: 'search based on its ubb name or description',
    type: 'string',
    internal_type: "search",
    default: '*'
  },
  {
    name: 'ubb_effect',
    desc: 'search based ubb buffs (raw JSON)',
    type: 'string',
    internal_type: "search",
    default: '*'
  },
  {
    name: 'es_desc',
    desc: 'search based on its es name or description',
    type: 'string',
    internal_type: "search",
    default: '*'
  },
  {
    name: 'es_effect',
    desc: 'search based es buffs (raw JSON)',
    type: 'string',
    internal_type: "search",
    default: '*'
  },
  {
    name: 'sp_desc',
    desc: 'search based on its sp name or description',
    type: 'string',
    internal_type: "search",
    default: '*'
  },
  {
    name: 'sp_effect',
    desc: 'search based sp buffs (raw JSON)',
    type: 'string',
    internal_type: "search",
    default: '*'
  },
  {
    name: 'evo_mat',
    desc: 'search based on what single unit it needs to evolve',
    type: 'string',
    internal_type: "search",
    default: '*'
  },
  {
    name: 'server',
    desc: 'search based on what server it\'s on',
    type: 'string',
    internal_type: "search",
    default: '*'
  },
  {
    name: 'all_desc',
    desc: 'search based on its all of it\'s names and descriptions',
    type: 'string',
    internal_type: "search",
    default: '*'
  },
  {
    name: 'all_effect',
    desc: 'search based on all of it\'s effects',
    type: 'string',
    internal_type: "search",
    default: '*'
  },
  {
    name: 'reload_db',
    desc: 'Reload the local database, if you give it the right password',
    type: 'string',
    internal_type: "reload",
    default: '*'
  },
  {
    name: 'strict',
    desc: 'Use this flag to always return the full results; e.g. when searching Feeva, this will make it return all options, not just Feeva\'s final form',
    type: 'boolean',
    internal_type: "search",
    default: false
  },
  {
    name: 'list_help',
    desc: 'tells you stuff about listing info',
    type: 'boolean',
    internal_type: "help",
    default: false
  },
  {
    name: 'l_range',
    desc: 'list units in a given range of guide or unit IDs',
    internal_type: "list",
    type: 'boolean',
    default: false
  },
  {
    name: 'l_count',
    desc: 'list a number of units from a given start guide or unit ID',
    type: 'boolean',
    internal_type: "list",
    default: false
  },
  {
    name: 'l_start',
    desc: 'for range and count; starting value; -1 is default',
    type: 'number',
    internal_type: "list",
    default: -1
  },
  {
    name: 'l_end',
    desc: 'for range only; ending value; -1 is default',
    type: 'number',
    internal_type: "list",
    default: -1
  },
  {
    name: 'l_num_count',
    desc: 'for count; number of units to print; -1 is default',
    type: 'number',
    default: -1
  },
  {
    name: 'l_type',
    desc: 'type of search; possible options include guide (for guide ID) and unit (for unit ID); defaults to guide',
    type: 'string',
    internal_type: "list",
    default: 'guide'
  },
  {
    name: 'about',
    desc: 'show info about the bot',
    type: 'boolean',
    internal_type: 'help',
    default: false
  }
];

//custom print help function
function print_help(header, internal_type, footer) {
  var msg = header;
  for (f in command_flags) {
    var curFlag = command_flags[f];
    if (curFlag.internal_type == internal_type) {
      msg += "`--" + curFlag.name;
      if (curFlag.type != "boolean") {
        msg += " <" + curFlag.type + ">";
      }
      msg += "`: " + curFlag.desc + "\n";
    }
  }
  msg += footer;
  return msg;
}

//automatically set raw flag
function set_raw_flag(flags){
  var raw = flags.raw;
  for(f in command_flags){
    var curFlag = command_flags[f];
    if(curFlag.internal_type == "print" && curFlag.name != "translate")
      if(flags[curFlag.name]){
        raw = true;
        break;
      }
  }
  flags.raw = raw;
}

module.exports = new Clapp.Command({
  name: "unit",
  desc: "returns a unit based on input; use unit --search_help, unit --print_help, and unit --list_help for more info",
  fn: (argv, context) => {
    try {
      return new Promise(function (fulfill, reject) {

        if(argv.flags.about){
          var msg = "This bot was created by BluuArc#2661. ";
          msg += "If you have any problems and/or suggestions in regard to the bot, let him know.\n";
          msg += "You can also contact him via this bot's github page: \n"
          msg += "https://github.com/BluuArc/BluuBot-discord";
          fulfill(msg);
        }

        if(argv.flags.reload_db != '*'){
          console.log("reload_db is " + argv.flags.reload_db);
          fulfill(reload_database(argv.flags.reload_db));
        }

        //help commands
        if (argv.flags.print_help || argv.flags.search_help || argv.flags.list_help) {
          var header = "";
          var footer = "";
          var internal_type = "";
          if (argv.flags.print_help) { //print info about printing info
            header = "There are a few commands related to printing unit info.\n---\n";
            internal_type = "print";
            footer = "\nThe p_sp_skill command is different from the rest as it requires an ID to work. You can see those IDs by looking at the regular SP skills of a unit (without the raw command)\n";
            footer += "Some of the commands can be chained together, but if the combined result passes the character limit, nothing is shown.\n";
            footer += "The raw flag will be automatically set to true if any one of these are used\n";
            footer += "Example: `|bb unit Feeva --rarity 8 --raw --p_sp_skill 51001004` prints the value of the BB fill on spark SP for Feeva\n";
            footer += "Example: `|bb unit gabriela --rarity 8 --p_hitcount sbb` prints the hit count table for Gabriela's SBB";
          } else if (argv.flags.search_help) { // print search info
            header = "There are a few commands related to searching unit info.\n---\n";
            internal_type = "search";
            footer = "\nFor all of these (and the first argument of the unit command where you input the name), the asterisk can be used as a wildcard\n";
            footer += "Due to system limitiations, all queries must be one word\n";
            footer += "Example: `|bb unit --element dark --rarity 8` prints all OE dark units";
          } else if (argv.flags.list_help) {
            header = "There are a few commands related to listing unit info.\n---\n"
            internal_type = "list";
            footer = "\nExample: `|bb unit --l_range --l_type unit --l_start 60660 --l_end 60670` prints all units whose ID starts with 60660 and the first unit above 60670\n";
            footer += "Example: `|bb unit --l_range --l_start 1600` prints all units whose guide ID is 1600 or larger";
          }
          fulfill(print_help(header, internal_type, footer));
        }//end help

        //automatically set raw flag
        set_raw_flag(argv.flags);


        // console.log(argv.flags);
        // console.log(argv.args);
        //list commands
        if (argv.flags.l_range || argv.flags.l_count) {
          if (argv.flags.l_count) {
            var step1 = do_count_query(argv.flags.l_start, argv.flags.l_num_count, argv.flags.l_type);
          } else {
            var step1 = do_range_query(argv.flags.l_start, argv.flags.l_end, argv.flags.l_type);
          }
          var step2 = step1.then(function (data) { //extract IDs from results
            return data;
          });
          var step3 = step2.then(function (arr) { //process results as array of IDs
            var msg = "";
            if(arr === undefined){
              reject("Problem with data");
            }
            if(arr.length > 0){
              msg = "Multiple units found. Please try the command again using one of the IDs below.\n---\n";
              var u = 0;
              for(u = 0; u < arr.length; ++u){
                msg += arr[u] + "\n";
                if(msg.length >= 1800)
                  break;
              }

              if(u != arr.length){
                var diff = arr.length - u;
                msg += "...and " + diff + ((diff == 1) ? " other" : " others");
                if (diff > 2000) {
                  msg += "\nAre you trying to get all of the units? Check your search options again, especially for double dashes.";
                }
              }
            }
            return msg;
          });
          var step4 = step3.then(function (result) {
            fulfill(result);
          });
        } else {//print and search commands
          var step1 = basic_search_unit(argv.args.name, argv.flags) //query for unit in server
            .catch(function (err) {
              console.log("Error in step1: ");
              console.log(err);
              fulfill("Error: can't connect to database server");
            });
          var step2 = step1.then(function (result) { //process result
            if (result.length == 0)
              fulfill("No unit found with those parameters.");
            else if (result.length == 1)
              return print_unit(result[0], argv.flags);
            else
              return get_units(result, "");
          }, function (err) {
            console.log("Error in step2: ");
            console.log(err);
            reject("Error: invalid response from server");
          });
          var step3 = step2.then(function (result) { //print result
            fulfill(result)
          }).catch(function (err) {
            console.log("Error in step3: ");
            console.log(err);
            reject("Error: something went wrong");
          });
        }
      });
    } catch (err) {
      console.log(err);
      return "No unit found with those parameters."
    }
  },
  args: command_args,
  flags: command_flags
});

//given a list of units, return a string message
function get_units(unit_ids, accumulator) {
  if (unit_ids.length == 0)//processed all IDs
    return accumulator;
  else if (accumulator.length >= 1800) {//cap for character limit
    var diff = unit_ids.length;
    accumulator += "...and " + diff + ((diff == 1) ? " other" : " others");
    if (diff > 2000) {
      accumulator += "\nAre you trying to get all of the units? Check your search options again, especially for double dashes.";
    }
    return accumulator;
  }
  else {//recursively process units
    if (accumulator.length == 0) {
      accumulator = "Multiple units found. Please try the command again using one of the IDs below.\n---\n";
      unit_ids = underscore.chain(unit_ids).reverse().value(); //process in reverse order
    }
    var cur_id = unit_ids.pop();
    return get_unit(cur_id).then(function (unit) {
      accumulator += get_unit_name(unit) + "\n";
      return get_units(unit_ids, accumulator);
    });
  }
}

function load_server(server_file){
  try {
    var url = fs.readFileSync('server_url.txt');
    return url;
  } catch (err) {
    console.log(err);
    return "";
  }
}

function reload_database(input){
  var pass = fs.readFileSync('reload.txt', 'utf8');
  if (pass == input) {
    var url = load_server('server_url.txt');
    if (url.length == 0)
      return JSON.stringify({ error: "can't open server_url.txt or file is empty" });

    var options = {
      method: 'GET',
      uri: url + "/reload/"
    };
    return request(options).then(function(response){
      return response;
    });
  }else{
    return "No.";
  }
}

//get the data for a single unit
function get_unit(unit_id) {
  var url = load_server('server_url.txt');
  if(url.length == 0) 
    return JSON.stringify({ error: "can't open server_url.txt or file is empty" });

  var options = {
    method: 'GET',
    uri: url + "/unit/" + unit_id
  };

  //return the JSON unit object
  return request(options).then(function (response) {
    try {
      var result = JSON.parse(response);
      return result;
    } catch (err) {
      return { error: "problem with server response" };
    }
  }, function (err) {
    console.log("Error with get_unit(" + unit_id + ")");
    console.log(err);
    return { error: "problem with server response" };
  });
}

function get_unit_name(unit) {
  try {
    return unit["guide_id"] + ": " + unit["name"] + " (" + unit["id"] + ")";
  } catch (err) {
    console.log(err)
    return "Error: " + unit["id"] + " has a problem."
  }
}

function print_burst(burst, print_raw, sub_point) {
  var msg = "";
  try{
    var endLevel = burst["levels"][burst["levels"].length - 1];

    var numHits = burst["damage frames"][0]["hits"];
    var dc = numHits * burst["drop check count"];
    var proc = burst["damage frames"][0]["proc id"];
    //check for non-attacking burst
    if ((proc == "2" || proc == "5" || proc == "51" ||
      proc == "18" || proc == "3" || proc == "38")) {
      numHits = 0;
    }
    msg += burst["name"] + " - (" + endLevel["bc cost"] + "BC/" + numHits + "hits/" + dc + "DC) " + burst["desc"];
    if(msg.indexOf("\n") == -1){
      msg += "\n";
    }
    
    if (print_raw) {
      for (e in endLevel["effects"]) {
        msg += "```";
        msg += print_effects(endLevel["effects"][e]) + "\n";
        msg += "```";
      }
    }
  }catch(err){
    console.log(err);
    msg = "None";
  }
  return msg;
}

function print_array(arr) {
  var text = "[";

  for (i in arr) {
    if (arr[i] instanceof Array) text += print_array(arr[i]);
    else if (arr[i] instanceof Object) text += JSON.stringify(arr[i]); //most likely a JSON object
    else text += arr[i];

    text += ",";
  }

  if (text.length > 1) {
    text = text.substring(0, text.length - 1); //remove last comma
  }

  text += "]";
  return text;
}

function print_effects(effects) {
  var text_arr = [];
  //convert each effect into its own string
  for (param in effects) {
    if (param != "passive id" && param != "effect delay time(ms)\/frame") {
      var tempText = effects[param];
      if (effects[param] instanceof Array) tempText = print_array(effects[param]); //parse array
      else if (effects[param] instanceof Object) tempText = JSON.stringify(effects[param]); //parse JSON object
      text_arr.push("" + param + ": " + tempText);
    }
  }

  //convert array into a single string
  var i = 0;
  var text = "";
  for (i = 0; i < text_arr.length; ++i) {
    text += text_arr[i];
    if (i + 1 != text_arr.length) text += " / ";
  }
  return text + "";
}

function getSPCategory(num) {
  switch (num) {
    case "1": return "Parameter Boost";
    case "2": return "Spark";
    case "3": return "Critical Hits";
    case "4": return "Attack Boost";
    case "5": return "BB Gauge";
    case "6": return "HP Recovery";
    case "7": return "Drops";
    case "8": return "Ailment Resistance";
    case "9": return "Ailment Infliction";
    case "10": return "Damage Reduction";
    case "11": return "Special";
    default: return "Undefined";
  }
}

function print_sp(sp, print_raw, main_point, sub_point, sub_sub_point, id) {
  var msg = "";
  if (print_raw) {
    if (id == undefined || id.length == 0) {
      return "Error: no SP ID specified\n";
    }
    for (s in sp) {
      var curSkill = sp[s]["skill"];
      if (curSkill["id"] == id || s == id) {
        var level;
        if (sp[s]["dependency"] == "")
          level = 1;
        else {
          level = 2;
        }
        //print header for each skill
        // msg += (level == 1) ? main_point : sub_point;
        msg += main_point;
        msg += "**[**" + curSkill["bp"] + " SP**]** | (" + getSPCategory(sp[s]["category"]) + ") - " + curSkill["desc"] + " (" + curSkill["id"] + "," + s + ")\n";

        if (sp[s]["dependency"] != ""){
          try{
              msg += "```Requires " + sp[s]["dependency"].split('@')[1] + " to be unlocked to use this enhancement.\n```";
          }catch(err){
              console.log("Error parsing " + sp[s]["dependency"]);
              msg += "```Requires " + sp[s]["dependency"] + " to be unlocked to use this enhancement.\n```";
          }
        }
        var point = sub_point;
        msg += "```";
        //print effects of each skill
        for (e in curSkill["effects"]) {
          if (curSkill["effects"][e] instanceof Array) {
            msg += print_array(curSkill["effects"][e]);
          } else if (curSkill["effects"][e] instanceof Object) {
            for (elem in curSkill["effects"][e]) {
              msg += "" + elem + ": " + print_effects(curSkill["effects"][e][elem]);
            }
          } else {
            msg += curSkill["effects"][e];
          }
          msg += "\n";
        }
        msg += "```";
      }//end if check
    }//end for
  } else {
    for (s in sp) {
      var curSkill = sp[s]["skill"];
      if (sp[s]["dependency"] == "")
        msg += main_point;
      else {
        msg += sub_point;
      }
      msg += "**[**" + curSkill["bp"] + " SP**]** | (" + getSPCategory(sp[s]["category"]) + ") - " + curSkill["desc"] + " (" + curSkill["id"] + "," + s + ")\n";
    }
  }
  return msg;
}

function handle_hitcount_flag(unit, hit_type){
  var msg = "";
  if (hit_type == "normal") {
    msg += "* Hit Count Data for Normal Attacks:\n";
    msg += print_hit_table(unit["damage frames"]["frame times"], unit["damage frames"]["hit dmg% distribution"]);
  } else {
    var burst = unit[hit_type];
    if (burst != undefined) {
      var proc = burst["damage frames"][0]["proc id"];
      //only print tables if burst is attacking
      var non_attack_burst = ["2","5","51","18","3","38"];
      if (non_attack_burst.indexOf(proc) == -1) {
        msg += "* Hit Count Data for " + hit_type.toUpperCase() +":\n";
        msg += print_hit_table(burst["damage frames"][0]["frame times"], burst["damage frames"][0]["hit dmg% distribution"]);
        //print tables for bursts with multiple attacks
        try {
          var multi_attack_burst = ["1","64","47","13","14","29","97"];
          for (i = 1; i < burst["damage frames"].length; ++i) {
            proc = burst["damage frames"][i]["proc id"];
            if (multi_attack_burst.indexOf(proc) > -1) {
                msg += print_hit_table(burst["damage frames"][i]["frame times"], burst["damage frames"][i]["hit dmg% distribution"]);
            }
          }
        } catch (err) {
          console.log(err);
        }
      }else{
        msg += "This unit does not have an attacking " + hit_type.toUpperCase() + "\n";
      }
    } else {
      msg += "This unit does not have a field for " + hit_type + "\n";
    }
  }
  return msg;
}

function print_hit_table(timing_array, distribution_array){
  var table = new Table;
  var size = timing_array.length;
  var data = [];
  //create data set
  for(var i = 0; i < size; ++i){
    data.push({
      num: (i+1),
      timing: timing_array[i],
      distribution: distribution_array[i]
    });
  }

  //put data set onto table
  data.forEach(function(hit){
    table.cell('Hit #', hit.num);
    table.cell('Frame #', hit.timing);
    table.cell('DMG% Distribution', hit.distribution);
    table.newRow();
  })

  // console.log(table.toString());
  return "```" + table.toString() + "```\n";
}

function get_unit_move_type(move_type){
  switch(move_type){
    case "1": return "Moving";
    case "2": return "Teleporting";
    case "3": return "Non-Moving";
    default: return "Unknown move type " + move_type;
  }
}

//input: object with 4 fields for hp/atk/def/rec
function getStats(unit_stats) {
  var newStats = {};
  for (var s in unit_stats) {
    newStats[s.replace(" ", "_")] = unit_stats[s];
  }
  return newStats;
}

function getStatTable(unit) {
  var names = ["_base", "_lord", "anima", "breaker", "guardian", "oracle"];
  var data = [];

  for (var u in names) {
    data.push(getStats(unit.stats[names[u]]));
    data[u]["name"] = names[u];
  }
  data.push(getStats(unit.imp));
  data[data.length - 1]["name"] = "imps";

  //create table
  var t = new Table();

  data.forEach(function (stats) {
    // console.log(stats);
    t.cell('Stats', stats.name.replace("_", ""));
    if (stats.name != "imps") {
      t.cell('HP', (stats.hp !== undefined) ? stats.hp : (stats.hp_min + "-" + stats.hp_max));
      t.cell('ATK', (stats.atk !== undefined) ? stats.atk : (stats.atk_min + "-" + stats.atk_max));
      t.cell('DEF', (stats.def !== undefined) ? stats.def : (stats.def_min + "-" + stats.def_max));
      t.cell('REC', (stats.rec !== undefined) ? stats.rec : (stats.rec_min + "-" + stats.rec_max));
    } else {
      t.cell('HP', stats.max_hp);
      t.cell('ATK', stats.max_atk);
      t.cell('DEF', stats.max_def);
      t.cell('REC', stats.max_rec);
    }
    t.newRow();
  });
  return t.toString();
}

function print_unit(id, flags) {
  try { // check if input has error field
    if (id["error"] != undefined) {
      return "Error: " + id["error"];
    }
  } catch (err) {
    //do nothing, as field doesn't exist
  }
  if (!isNaN(id)) {//if given an id, get the unit first then try printing again
    return get_unit(id).then(function (unit) {
      return print_unit(unit, flags);
    });
  } else {
    var unit = id;
    try {
      var numHits = unit["damage frames"]["hits"];
      var msg = "";

      if (!flags.sp) {
        msg += unit["guide_id"] + ": " + unit["name"] + " | " + unit["rarity"] + "\* | " + unit["element"] + " | " + unit["cost"] + " Cost | " + unit["gender"] + "\n";
        msg += "* " + unit["damage frames"]["hits"] + ((numHits == 1) ? " hit (" : " hits (") + (unit["drop check count"] * numHits) + "DC) | ";
        msg += "Move Speed: " + unit["movement"]["skill"]["move speed type"] + " | ";
        msg += "Move Type: " + get_unit_move_type(unit["movement"]["skill"]["move type"]) + "\n";
      }
      var sub_point = "  |> ";
      var sub_sub_point = "  |>> ";
      if (flags.raw) { //print raw stats
        if (!flags.p_sp && !flags.p_evo && !flags.p_arena && !flags.p_stats && flags.p_sp_skill == "" && flags.p_hitcount == "") {
          if (flags.p_ls) {
            msg += "* LS: ";
            if (unit["leader skill"] != undefined) {
              var ls = unit["leader skill"];
              msg += ls["name"] + " - " + ls["desc"] + "\n";
              for (e in ls["effects"]) {
                msg += "```";
                msg += print_effects(ls["effects"][e]) + "\n";
                msg += "```";
              }
            } else {
              msg += "None\n";
            }
          }

          if (flags.p_es) {
            if (unit["extra skill"] != undefined) {
              var es = unit["extra skill"];
              msg += "* ES: " + es["name"] + " - " + es["desc"] + "\n";
              msg += "```target: " + es["target"] + "\n```";
              for (e in es["effects"]) {
                msg += "```";
                msg += print_effects(es["effects"][e]) + "\n";
                msg += "```";
              }
            }
          }

          if (flags.p_bb) {
            if (unit["bb"] != undefined) {
              var bb = unit["bb"];
              msg += "* BB: " + print_burst(bb, flags.raw, sub_point);
            } else {
              msg += "* BB: None\n";
            }
          }

          if (flags.p_sbb) {
            if (unit["sbb"] != undefined) {
              msg += "* SBB: " + print_burst(unit["sbb"], flags.raw, sub_point);
            } else {
              msg += "* SBB: None\n"
            }
          }

          if (flags.p_ubb) {
            if (unit["ubb"] != undefined) {
              msg += "* UBB: " + print_burst(unit["ubb"], flags.raw, sub_point);
            } else {
              msb += "* UBB: None\n"
            }
          }

          if (flags.p_arena) {
            msg += "Arena AI: ";
            if (unit["ai"] != undefined) {
              msg += "\n";
              for (a in unit["ai"]) {
                msg += "```" + print_effects(unit["ai"][a]) + "\n```";
              }
            } else {
              msg += "None/Data is missing\n";
            }
          }
        } else {
          if (flags.p_sp) {
            if (unit["skills"] != undefined) {
              msg += "SP Enhancements:\n"
              msg += print_sp(unit["skills"], false, "", "* ");
            } else {
              msg += "SP Enhancements: None\n";
            }
          } else if (flags.p_evo) {
            if (unit["evo_mats"] != undefined) {
              msg += unit["name"] + " needs the following material(s) to evolve\n";
              for (mat in unit["evo_mats"]) {
                msg += "* " + unit["evo_mats"][mat]["name"] + " (" + unit["evo_mats"][mat]["id"] + ")\n";
              }
            } else {
              msg += "This unit currently cannot evolve any further.\n";
            }
          } else if (flags.p_arena) {
            msg += "Arena AI: ";
            if (unit["ai"] != undefined) {
              msg += "\n";
              for (a in unit["ai"]) {
                msg += "```" + print_effects(unit["ai"][a]) + "\n```";
              }
            } else {
              msg += "None/Data is missing\n";
            }
          } else if (flags.p_stats) {
            var stat_table = getStatTable(unit);
            msg += "```";
            msg += stat_table;
            msg += "```";
          }else if (flags.p_sp_skill != ""){//print sp info
            if (unit["skills"] != undefined) {
              msg += "SP Enhancements:\n"
              msg += print_sp(unit["skills"], flags.raw, "* ", sub_point, sub_sub_point, flags.p_sp_skill);
            } else {
              msg += "SP Enhancements: None\n";
            }
          } else if (flags.p_hitcount != "") {//print hit count table
            msg += handle_hitcount_flag(unit,flags.p_hitcount.toLowerCase());
          }
        }
      } else {//print regular description
        if (!flags.p_sp && !flags.p_evo && !flags.p_arena && !flags.p_stats) {
          msg += "* LS: ";
          if (unit["leader skill"] != undefined) {
            var ls = unit["leader skill"];
            var ls_msg = ls["name"] + " - " + ls["desc"];
            msg += ls_msg;
            if (ls_msg.indexOf("\n") == -1) {
              msg += "\n";
            }
          } else {
            msg += "None\n";
          }

          if (unit["extra skill"] != undefined) {
            var es = unit["extra skill"];
            var es_msg = "* ES: " + es["name"] + " - " + es["desc"];
            msg += es_msg;
            if (es_msg.indexOf("\n") == -1) {
              msg += "\n";
            }
          }

          msg += "* BB: ";
          if (unit["bb"] != undefined) {
            var bb = unit["bb"];
            msg += print_burst(bb, flags.raw);
          } else {
            msg += "None\n";
          }

          if (unit["sbb"] != undefined) {
            msg += "* SBB: " + print_burst(unit["sbb"], flags.raw);
          }

          if (unit["ubb"] != undefined) {
            msg += "* UBB: " + print_burst(unit["ubb"], flags.raw);
          }
        }

      }
      msg += "---\n"
      var server = unit["server"][0];
      var id = unit["id"];
      switch (server) {
        case "eu": msg += "http://static-bravefrontier.gumi-europe.net/content/unit/img/"; break;
        case "gl": msg += "http://2.cdn.bravefrontier.gumi.sg/content/unit/img/"; break;
        case "jp": msg += "http://cdn.android.brave.a-lim.jp/unit/img/"; break;
        default: break;
      }
      msg += "unit_ills_full_" + id + ".png";
      return msg;
    } catch (err) {
      console.log(err)
      return "Error: " + unit["id"] + " has a problem."
    }
  }
}

//replace wildcards with empty strings
function get_query_value(query_value) {
  return (query_value == "*") ? "" : query_value;
}

function get_request_options(query) {
  var result = "";
  for (q in query) {
    result += q + "=" + query[q].toString() + "&";
  }
  return result;
}

//return a promise object that contains the request for a search query
function basic_search_unit(name, other_queries) {
  // console.log(other_queries);
  //check for unit or guide id
  try {
    if (!isNaN(name)) {
      var id = parseInt(name);
      if (id >= 10000) {//it's a unit id
        return get_unit(id).then(function (unit) {
          //return id if unit exists, return message otherwise
          // console.log(unit);
          return (unit["id"] != undefined) ? [id] : [unit];
        })
      } else { //it's a guide id
        return (basic_search_unit(id + ":", other_queries));
      }
    }
  } catch (err) {
    //don't do anything, just do a regular search
  }

  var query = {
    unit_name_id: get_query_value(name),
    rarity: get_query_value(other_queries.rarity),
    element: get_query_value(other_queries.element),
    gender: get_query_value(other_queries.gender),
    move_speed: get_query_value(other_queries.move_speed),
    ls_name: get_query_value(other_queries.ls_desc),
    ls_effect: get_query_value(other_queries.ls_effect),
    bb_name: get_query_value(other_queries.bb_desc),
    bb_effect: get_query_value(other_queries.bb_effect),
    sbb_name: get_query_value(other_queries.sbb_desc),
    sbb_effect: get_query_value(other_queries.sbb_effect),
    ubb_name: get_query_value(other_queries.ubb_desc),
    ubb_effect: get_query_value(other_queries.ubb_effect),
    es_name: get_query_value(other_queries.es_desc),
    es_effect: get_query_value(other_queries.es_effect),
    sp_name: get_query_value(other_queries.sp_desc),
    sp_effect: get_query_value(other_queries.sp_effect),
    evo_mats: get_query_value(other_queries.evo_mat),
    server: get_query_value(other_queries.server),
    all_desc: get_query_value(other_queries.all_desc),
    all_effect: get_query_value(other_queries.all_effect),
    translate: get_query_value(other_queries.translate),
    strict: other_queries.strict
  };

  // console.log(query);

  //do a regular search
  var url = load_server('server_url.txt');
  if (url.length == 0) {
    console.log(err);
    throw "Error: can't open server_url.json";
  }

  var options = {
    method: 'GET',
    uri: url + "/search/unit/options?" + get_request_options(query)
  };

  return request(options).then(handle_basic_search_unit_response);
}

//handle the response for basic_search_unit
function handle_basic_search_unit_response(response) {
  try {
    var result_arr = JSON.parse(response);
    return result_arr;
  } catch (err) {
    return ["Error: problem with server response"];
  }
};


function do_range_query(start, end, type) {
  var url = load_server('server_url.txt');
  if (url.length == 0) {
    console.log(err);
    throw "Error: can't open server_url.json";
  }

  var query = {
    type: (type == "unit") ? "unit_id" : "guide_id",
    list_type: "range",
  };
  if (start != -1) {
    query["start"] = start;
  }
  if (end != -1) {
    query["end"] = end;
  }

  var options = {
    method: 'GET',
    uri: url + "/list/units?" + get_request_options(query)
  };

  // console.log(options);
  return request(options).then(handle_basic_search_unit_response)
}

function do_count_query(start, count, type) {
  var url = load_server('server_url.txt');
  if (url.length == 0) {
    console.log(err);
    throw "Error: can't open server_url.json";
  }

  var query = {
    type: (type == "unit") ? "unit_id" : "guide_id",
    list_type: "amount",
  };
  if (start != -1) {
    query["start"] = start;
  }
  if (count != -1) {
    query["count"] = count;
  }

  var options = {
    method: 'GET',
    uri: url + "/list/units?" + get_request_options(query)
  };

  // console.log(options);
  return request(options).then(handle_basic_search_unit_response)
}