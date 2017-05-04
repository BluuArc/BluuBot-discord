var Clapp = require('../modules/clapp-discord');
var request = require('request-promise');
var fs = require('fs');
var underscore = require('underscore');
var translate = require('google-translate-api');

var command_args = [
  {
    name: 'name',
    desc: 'search for an item based on a given name or id; * is considered a wildcard',
    type: 'string',
    required: false,
    default: '*'
  },
];

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
    desc: 'Print the translation from Japanese to English of an item. Uses Google Translate API.',
    type: 'boolean',
    internal_type: "print",
    default: false
  },
  {
    name: 'raw',
    desc: 'Print the raw data of an item. Most p_commands require this',
    type: 'boolean',
    internal_type: "print",
    default: false
  },
  {
    name: 'p_effects',
    desc: 'Print the effect(s) of an item',
    type: 'boolean',
    internal_type: "print",
    default: false
  },
  {
    name: 'p_recipe',
    desc: 'Print the crafting recipe of an item',
    type: 'boolean',
    internal_type: "print",
    default: false
  },
  {
    name: 'p_usage',
    desc: 'Print the items that use this item as a crsfting material',
    type: 'boolean',
    internal_type: "print",
    default: false
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
    name: 'type',
    desc: 'search based on the item type. Possible types include material, consumable, sphere, evomat, summoner_consumable, and ls_sphere',
    type: 'string',
    internal_type: "search",
    default: '*'
  },
  {
    name: 'effect',
    desc: 'search based an item\'s effects (raw JSON)',
    type: 'string',
    internal_type: "search",
    default: '*'
  },
  {
    name: 'sphere_type',
    desc: 'search based on a sphere type. Possible types include Status Boost, Critical, Drop, Status Ailment, Damage Reducing, Status Ailments Resistant, BB Gauge, HP Recovery, Expose Target, Damage Reflecting, Spark, Defense Penetrating, Atk Boosting, and Special',
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
    name: 'reload_db',
    desc: 'Reload the local database, if you give it the right password',
    type: 'string',
    internal_type: "reload",
    default: '*'
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
  for (var f in command_flags) {
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
function set_raw_flag(flags) {
  var raw = flags.raw;
  for (var f in command_flags) {
    var curFlag = command_flags[f];
    if (curFlag.internal_type == "print" && curFlag.name != "translate")
      if (flags[curFlag.name]) {
        raw = true;
        break;
      }
  }
  flags.raw = raw;
}

module.exports = new Clapp.Command({
  name: "item",
  desc: "returns an item based on input; use item --search_help and item --print_help for more info",
  fn: (argv, context) => {
    try {
      return new Promise(function (fulfill, reject) {

        if (argv.flags.about) {
          var msg = "This bot was created by BluuArc#2661. ";
          msg += "If you have any problems and/or suggestions in regard to the bot, let him know.\n";
          msg += "You can also contact him via this bot's github page: \n";
          msg += "https://github.com/BluuArc/BluuBot-discord";
          fulfill(msg);
        }

        if (argv.flags.reload_db != '*') {
          console.log("reload_db is " + argv.flags.reload_db);
          fulfill(reload_database(argv.flags.reload_db));
        }

        //help commands
        if (argv.flags.print_help || argv.flags.search_help || argv.flags.list_help) {
          var header = "";
          var footer = "";
          var internal_type = "";
          if (argv.flags.print_help) { //print info about printing info
            header = "There are a few commands related to printing item info.\n---\n";
            internal_type = "print";
            footer += "\nSome of the commands can be chained together, but if the combined result passes the character limit, nothing is shown.\n";
            footer += "The raw flag will be automatically set to true if any one of these are used\n";
            footer += "Example: `|bb item heaven's edge --p_effects` prints out the effects of Heaven's Edge\n"; 
            footer += "Example: `|bb item lunar essance --p_recipe` prints out the recipe to make the Lunar Essence Orb\n";
            footer += "Example: `|bb item distilled ether --p_usage` prints out the items that use Distilled Ether.\n";
          } else if (argv.flags.search_help) { // print search info
            header = "There are a few commands related to searching item info.\n---\n";
            internal_type = "search";
            footer = "\nFor all of these (and the first argument of the item command where you input the name), the asterisk can be used as a wildcard\n";
            footer += "Example: `|bb item --type ls_sphere` prints out all of the LS spheres you can use in SArc.\n";
          }
          fulfill(print_help(header, internal_type, footer));
        }//end help

        //automatically set raw flag
        set_raw_flag(argv.flags);

        //print and search commands
        var step1 = search_item(argv.args.name, argv.flags) //query for unit in server
          .catch(function (err) {
            console.log("Error in step1: ");
            console.log(err);
            fulfill("Error: can't connect to database server");
          });
        var step2 = step1.then(function (result) { //process result
          if (result.length === 0)
            fulfill("No item found with those parameters.");
          else if (result.length == 1)
            return print_item(result[0], argv.flags);
          else
            return get_items_list(result);
        }, function (err) {
          console.log("Error in step2: ");
          console.log(err);
          reject("Error: invalid response from server");
        });
        var step3 = step2.then(function (result) { //print result
          if (result.length > 2000) {
            fulfill("Error: Output for this command exceeds character limit (" + result.length + "). Please try another command.");
          }
          fulfill(result);
        }).catch(function (err) {
          console.log("Error in step3: ");
          console.log(err);
          reject("Error: something went wrong");
        });

      });
    } catch (err) {
      console.log(err);
      return "No item found with those parameters.";
    }
  },
  args: command_args,
  flags: command_flags
});

function translate_to_english(msg, fields, endField) {
  return translate(msg, { from: 'ja', to: 'en' })
    .then(function (result) {
      var result_text = "";
      if (result.text.indexOf("null") == result.text.length - 4) {
        result_text = result.text.replace("null", "");
      } else {
        result_text = result.text;
      }
      return {
        translation: result_text,
        fields: fields.concat(endField)
      };
    }).catch(err => {
      console.error(err);
    });
}

//given an item, return a promise that contains the translated unit object
function translate_unit(unit) {
  //recursively translate all fields
  function translate_unit_recursive(object, levels) {
    var promises = [];
    var translatable_fields = ["desc", "name", "dependency comment"];

    //get to desired position
    var curObject = object;
    for (var f in levels) {
      curObject = curObject[levels[f]];
    }

    var local_levels = levels.slice();
    //check each field
    for (var field in curObject) {
      local_levels.push(field);
      var curField = curObject[field];

      if (Array.isArray(curField) || (typeof curField == "object")) {
        //recursively translate all sub fields
        promises = promises.concat(translate_unit_recursive(object, local_levels));
      } else if (translatable_fields.indexOf(field) > -1 && (typeof curField == "string") && curField.length > 0) {
        //translate current field
        var curPromise = translate_to_english(curField, local_levels, field);
        promises.push(curPromise);
      }
      local_levels.pop();
    }
    return promises;
  }

  //merge the data of the sub_object into the fields of the main_object
  function merge_field(main_object, sub_object) {
    var cur_position = main_object;
    var f = 0;
    for (f = 0; f < sub_object.fields.length - 1; ++f) {
      cur_position = cur_position[sub_object.fields[f]];
    }

    cur_position[sub_object.fields[f]] = sub_object.translation;
  }

  //make a copy of the unit
  var new_unit = JSON.parse(JSON.stringify(unit));
  var promises = translate_unit_recursive(new_unit, []);
  return Promise.all(promises)
    .then(function (translated_objects) {
      for (var r in translated_objects) {
        merge_field(new_unit, translated_objects[r]);
      }
      return new_unit;
    });
}

//given a list of items, return a message
function get_items_list(item_ids, accumulator) {
  if (item_ids.length === 0) { //finished processing IDs
    return accumulator;
  } else if (accumulator !== undefined && accumulator.length >= 1800) { //cap for character limit
    var diff = item_ids.length;
    accumulator += "...and " + diff + ((diff == 1) ? " other" : " others");
    if (diff > 1200) {
      accumulator += "\nAre you trying to get all of the items? Check your search options again, especially for double dashes.";
    }
    return accumulator;
  } else { //recursively process all items
    if (accumulator === undefined || accumulator.length === 0) { //starting message
      accumulator = "Multiple items found. Please try the command again using one of the IDs below.\n---\n";
      item_ids = underscore.chain(item_ids).reverse().value(); //process in reverse order
    }
    var cur_id = item_ids.pop();
    return get_item(cur_id).then(function (item) {
      accumulator += item.name + " (" + item.id + ")\n";
      return get_items_list(item_ids, accumulator);
    });
  }
}

function load_server(server_file) {
  try {
    var url = fs.readFileSync('server_url.txt');
    return url;
  } catch (err) {
    console.log(err);
    return "";
  }
}

function reload_database(input) {
  var pass = fs.readFileSync('reload.txt', 'utf8');
  if (pass == input) {
    var url = load_server('server_url.txt');
    if (url.length === 0)
      return JSON.stringify({ error: "can't open server_url.txt or file is empty" });

    var options = {
      method: 'GET',
      uri: url + "/reload/"
    };
    return request(options).then(function (response) {
      return response;
    });
  } else {
    return "No.";
  }
}

//get the data for a single item
function get_item(item_id) {
  var url = load_server('server_url.txt');
  if (url.length === 0)
    return JSON.stringify({ error: "can't open server_url.txt or file is empty" });

  var options = {
    method: 'GET',
    uri: url + "/item/" + item_id
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
    console.log("Error with get_item(" + item_id + ")");
    console.log(err);
    return { error: "problem with server response" };
  });
}

function print_effects(effects) {
  function print_array(arr) {
    var text = "[";

    for (var i in arr) {
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
  var text_arr = [];
  //convert each effect into its own string
  for (var param in effects) {
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

function print_formatted_number(number) {
  var str = number.toString();
  var result = "";
  var nextComma = str.length % 3;
  if (str.length < 4) {
    return str;
  } else {
    for (var i = 0; i < str.length - 3; ++i) {
      result += str.charAt(i);
      //1000 -> 1 000
      //10000 -> 10 000
      //100000 (l 6) -> 100 000
      if (nextComma === 1) {
        result += " ";
        nextComma = 2;
      } else if (nextComma === 0) {
        nextComma = 2;
      } else {
        nextComma--;
      }
    }
    result += str.slice(-3);
  }
  return result;
}

function isJapaneseText(name) {
  return name.search(/[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/) > -1;
}

function print_item(id, flags) {
  try { // check if input has error field
    if (id.error !== undefined) {
      return "Error: " + id.error;
    }
  } catch (err) {
    //do nothing, as field doesn't exist
  }

  if (!isNaN(id)) {//if given an id, get the item first then try printing again
    return get_item(id).then(function (item) {
      return print_item(item, flags);
    });
  } else if (flags.translate) {
    flags.translate = false;
    var curItem = id;
    if (isJapaneseText(JSON.stringify(curItem))) { //translated item
      return translate_unit(id).then(function (item) {
        return print_item(item, flags);
      });
    } else { //item already in english
      return print_item(curItem, flags);
    }
  } else {
    var item = id;
    var msg = "";

    msg += item.name + " (" + item.id + ") | " + item.type + " | " + item.rarity + "\*";
    if (item["sphere type text"] !== undefined) {
      msg += " | Sphere Type: " + item["sphere type text"];
    }
    msg += "\n";
    msg += "* Sell Price: " + print_formatted_number(item.sell_price) + " | ";
    if (item["max equipped"]) msg += "Max Equipped: " + item["max equipped"] + " | ";
    msg += "Max Stack: " + item.max_stack + "\n";
    msg += "Desc: " + item.desc + "\n";

    //print effects
    if (flags.p_effects) {
      if (item.effect !== undefined) {
        var effect_list = (item.effect.effect !== undefined) ? item.effect.effect : item.effect;
        for (var e in effect_list) {
          msg += "```";
          msg += print_effects(effect_list[e]) + "\n";
          msg += "```";
        }
      } else {
        msg += "This item doesn't seem like it does anything.\n";
      }
    }

    //print recipe
    if (flags.p_recipe) {
      if (item.recipe !== undefined) {
        msg += "Crafting Recipe:\n";
        if (item.recipe.karma !== undefined)
          msg += "* " + print_formatted_number(item.recipe.karma) + " Karma\n";
        //get items
        for (var m in item.recipe.materials) {
          var curMaterial = item.recipe.materials[m];
          msg += "* " + curMaterial.count + "x " + curMaterial.name + " (" + curMaterial.id + ")\n";
        }
      } else {
        msg += "This item cannot be crafted.\n";
      }
    }

    //print usage
    if (flags.p_usage) {
      if (item.usage !== undefined && item.usage.length > 0) {
        msg += "This item is used to make:\n";
        for (var i in item.usage) {
          msg += "* " + item.usage[i].name + " (" + item.usage[i].id + ")\n";
        }
      } else {
        msg += "This item isn't used to make anything else.\n";
      }
    }

    msg += "---\n";

    var urls = {
      gl: "http://2.cdn.bravefrontier.gumi.sg/content/item/",
      eu: "http://static-bravefrontier.gumi-europe.net/content/item/",
      jp: "http://cdn.android.brave.a-lim.jp/item/"
    };
    msg += urls[item.server[0]] + item.thumbnail;
    if (isJapaneseText(msg)) {
      msg += "\nLooks like this has some Japanese text in it. If this isn't what you wanted, try running the command again with `--translate`";
    }
    return msg;
  }
}

//replace wildcards with empty strings
function get_query_value(query_value) {
  return (query_value == "*" || query_value === undefined) ? "" : query_value;
}

function get_request_options(query) {
  var result = "";
  for (var q in query) {
    result += q + "=" + query[q].toString() + "&";
  }
  return result;
}

function search_item(name, other_queries) {
  //check for item ID
  try {
    if (name !== undefined && name.toString().length > 0 && !isNaN(name)) {
      var id = parseInt(name);
      return get_item(id).then(function (item) {
        //return id if item exists, return error message otherwise
        return (item.id !== undefined) ? [id] : [item];
      });
    }
  } catch (err) {
    //don't do anything, just do a regular search
  }

  var query = {
    item_name_id: get_query_value(name),
    item_desc: get_query_value(other_queries.item_desc),
    rarity: get_query_value(other_queries.rarity),
    type: get_query_value(other_queries.type),
    effect: get_query_value(other_queries.effect),
    sphere_type: get_query_value(other_queries.sphere_type),
    server: get_query_value(other_queries.server),
    translate: get_query_value(other_queries.translate),
  };

  /* possible sphere types
      Status Boost, Critical, Drop, Status Ailment, Damage Reducing, Status Ailments Resistant, BB Gauge, HP Recovery, Expose Target, Damage Reflecting, Spark, Defense Penetrating, Atk Boosting, Special
  */

  /*
      possible item types
      material, consumable, sphere, evomat, summoner_consumable, ls_sphere

  */

  //do a regular search
  var url = load_server('server_url.txt');
  if (url.length === 0) {
    console.log(err);
    throw "Error: can't open server_url.json";
  }

  var options = {
    method: 'GET',
    uri: url + "/search/item/options?" + get_request_options(query)
  };

  return request(options)
    .then(function (response) {
      try {
        return JSON.parse(response);
      } catch (err) {
        return ["Error: problem with server response"];
      }
    });
}
