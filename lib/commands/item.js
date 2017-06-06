var Clapp = require('../modules/clapp-discord');
var request = require('request-promise');
var fs = require('fs');
var underscore = require('underscore');
var translate = require('google-translate-api');
var cheerio = require('cheerio');
var upndown = require('upndown');
var und = new upndown();
var client = require('../modules/BFDBReader-node/data_tier_client.js');

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
    name: 'print_effects',
    desc: 'Print the effect(s) of an item',
    type: 'boolean',
    internal_type: "print",
    default: false
  },
  {
    name: 'print_recipe',
    desc: 'Print the crafting recipe of an item',
    type: 'boolean',
    internal_type: "print",
    default: false
  },
  {
    name: 'print_usage',
    desc: 'Print the items that use this item as a crafting material',
    type: 'boolean',
    internal_type: "print",
    default: false
  },
  {
    name: 'print_location',
    desc: 'Print where this item can be found',
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
    name: 'desc',
    desc: 'search based an item\'s description',
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
  }
];

//custom print help function
function print_help(header, internal_type, footer) {
  var msg = header;
  for (var f in command_flags) {
    var curFlag = command_flags[f];
    if (curFlag.internal_type === internal_type) {
      msg += "`--" + curFlag.name;
      if (curFlag.type !== "boolean") {
        msg += " <" + curFlag.type + ">";
      }
      msg += "`: " + curFlag.desc + "\n";
    }
  }
  msg += footer;
  return msg;
}


class MyCommand extends Clapp.Command {
  constructor(options) {
    super(options);
  }

  //custom help command
  _getHelp(app) {
    /**
     * You may use "app" and "this" to document your help.
     * App is the Clapp.App instance of the app containing this
     * command, and "this" is the command itself.
     */
    var msg = "";
    var helpCmds = [{
      name: "search_help",
      desc: "lists information on searching items"
    },
    {
      name: "print_help",
      desc: "lists information on printing items"
    }];
    msg += "Use one of the following commands to gain more information on each aspect of the `" + this.name + "` command:\n";
    for (var i = 0; i < helpCmds.length; ++i) {
      msg += "`" + this.name + " --" + helpCmds[i].name + "`: " + helpCmds[i].desc + "\n";
    }
    msg += "\nAlternatively, you could look at the full command documentation here: " + "https://github.com/BluuArc/BluuBot-discord/blob/master/COMMANDS.md\n";
    return msg;
  }
}

initialize_client();
module.exports = new MyCommand({
  name: "item",
  desc: "returns an item based on input; use item --search_help and item --print_help for more info",
  args: command_args,
  flags: command_flags,
  fn: (argv, context) => {
    try {
      return new Promise(function (fulfill, reject) {
        //help commands
        if (argv.flags.print_help || argv.flags.search_help || argv.flags.list_help) {
          var header = "";
          var footer = "";
          var internal_type = "";
          if (argv.flags.print_help) { //print info about printing info
            header = "There are a few commands related to printing item info.\n---\n";
            internal_type = "print";
            footer += "\nSome of the commands can be chained together, but if the combined result passes the character limit, nothing is shown.\n";
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
          return;
        }//end help

        //print and search commands
        var search_results = Promise.resolve(search_item(argv.args.name,argv.flags,context))
          .catch(function(err){
            console.log("Error in search_results",err);
            fulfill("Error: can't connect to database server");
          });

        var process_results = search_results.then(function (results) {
          print_debug_message(context, ["reached process_results with", results]);
          if (results === undefined || results.length === 0) {
            fulfill("No item found with those parameters");
            return;
          } else if (results.length === 1) {
            return print_item(results[0], argv.flags, context);
          } else {
            return print_multiple_results(results, context);
          }
        }).catch(function (err) {
          console.log("Error with process_results:", err);
          fulfill("Error with processing results.");
        });

        var print_results = process_results.then(function (msg) {
          print_debug_message(context, ["reached print_results with", msg, "useEmbed", context.useEmbed]);
          if (msg === undefined) {
            fulfill("No item found with those parameters");
          }
          if (context.useEmbed && (typeof msg).toLowerCase() === "object") {
            fulfill(JSON.stringify({ embed: msg }));
          } else if (msg instanceof Array) {
            fulfill(JSON.stringify(msg));
          } else {
            fulfill(msg);
          }
        }).catch(function (err) {
          console.log("Error with print_results:", err);
          fulfill("Error with printing results");
        });
      });
    } catch (err) {
      console.log("Item Command Error:\n",err);
      return "Error trying to process item command";
    }
  }
});

function print_debug_message(context, msg_arr) {
  if (context.verbose) {
    for (var i = 0; i < msg_arr.length; ++i)
      console.log(msg_arr[i]);
  }
}

function initialize_client() {
  try {
    var url = fs.readFileSync('server_url.txt');
    client.setAddress(url);
  } catch (err) {
    console.log(err);
  }
}

//given a data array, create an array of messages no longer than the specified length
function create_sectional_messages(data_arr, max_length, arr_limit) {
  function recursive_creation(data_arr, max_length, accumulator, arr_limit, callbackFn) {
    if (data_arr.length === 0) {
      callbackFn(accumulator);
      return;
    } else {
      var msg = "";
      while (data_arr.length !== 0 && msg.length < max_length) {
        msg += data_arr.shift();
      }

      if (data_arr.length > 0 && accumulator.length === arr_limit - 1) {
        msg += "...and " + data_arr.length + " more.";
        data_arr = [];
      }

      accumulator.push(msg);
      recursive_creation(data_arr, max_length, accumulator, arr_limit, callbackFn);
    }
  }
  var temp_arr = data_arr.slice();
  return new Promise(function (fulfill, reject) {
    //by default, limit extra messages to 4 more only
    recursive_creation(temp_arr, max_length, [], (arr_limit !== undefined) ? arr_limit : 4, fulfill);
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

function print_item(item_id, flags, context){
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
        } else if ((typeof curField === "string") && curField.length > 0 && isJapaneseText(curField)) {
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

  function get_item_location(item, flags){
    var url = {
      gl_wiki: "http://bravefrontierglobal.wikia.com/wiki/",
      eu_wiki: "http://bravefrontiereurope.wikia.com/wiki/",
      randall: "01Main-Randall.png",
      sphere_house: "Facility_sphere.png",
      synthesis: "Facility_item.png",
    };
    var options = {
      method: 'GET',
      uri: ""
    };
    var raw_html = "";

    //get url
    try {
      if (item.server[0] === 'gl') {
        options.uri = url.gl_wiki;
      } else if (item.server[0] === 'eu') {
        options.uri = url.eu_wiki;
      } else {
        return "JP items not supported at the moment.";
      }
      options.uri += item.name.replace(" ", "_");
    } catch (err) {
      console.log(err);
      return "Error reading item data.";
    }

    //try to find item on wiki
    return request.get(options)
      .then(function (response) {
        var $ = cheerio.load(response);
        var raw_text = $('.mw-content-text').text();
        raw_html = $('.mw-content-text').html();
        if (raw_text.indexOf("How to Obtain") > -1 || raw_html.indexOf(url.randall) > -1 || raw_html.indexOf(url.sphere_house) > -1 || raw_html.indexOf(url.synthesis) > -1) {
          if (raw_text.indexOf("How to Obtain") > -1)
            return html_to_md_promise($('.mw-content-text').find('ul').html());
          else
            return "";
        } else {
          return "No known way to obtain this item.";
        }
      })
      .then(function (msg) {
        if (msg == "* No known way to obtain this item") {
          return msg;
        } else {
          if (msg.length !== 0)
            msg += "\n";
          if (raw_html.indexOf(url.randall) > -1) {
            msg += "* Sphere Crafting Area in Imperial Capital Randall\n";
          }
          if (raw_html.indexOf(url.sphere_house) > -1) {
            msg += "* Sphere House in Town\n";
          }

          if (raw_html.indexOf(url.synthesis) > -1) {
            msg += "* Synthesis House in Town\n";
          }
        }
        return remove_links(msg);
      })
      .then(function (result) {
        var msg = "";
        var noembed = !context.useEmbed;
        if(noembed){
          msg += item.name + " (" + item.id + ") | " + item.type + " | " + item.rarity + "\*";
          if (item["sphere type text"] !== undefined) {
            msg += " | Sphere Type: " + item["sphere type text"];
          }
          msg += "\n";
          msg += "* Sell Price: " + print_formatted_number(item.sell_price) + " | ";
          if (item["max equipped"]) msg += "Max Equipped: " + item["max equipped"] + " | ";
          msg += "Max Stack: " + item.max_stack + "\n";
        }
        msg += "How to obtain " + item.name + ":\n" + result + "Source: " + options.uri + "\n";

        if(noembed){
          msg += "---\n";
          var image_urls = {
            gl: "http://2.cdn.bravefrontier.gumi.sg/content/item/",
            eu: "http://static-bravefrontier.gumi-europe.net/content/item/",
            jp: "http://cdn.android.brave.a-lim.jp/item/"
          };
          msg += image_urls[item.server[0]] + item.thumbnail;
          if (isJapaneseText(msg)) {
            msg += "\nLooks like this has some Japanese text in it. If this isn't what you wanted, try running the command again with `--translate`";
          }
        }
        return msg;
      })
      .catch(function (err) {
        console.log(Object.keys(err));
        console.log(err.statusCode);
        return ("Error: Item not found on wiki or can't connect to wiki.");
      });
  }

  //print all the materials needed for the given item id
  function get_full_recipe(item_id) {
    function full_recipe_recursive(item_id_arr, mat_acc, callbackFn) {
      if (item_id_arr.length === 0) {
        var result_arr = [];
        if (mat_acc !== undefined && mat_acc.result_str.length > 0) {
          //combine data into a single array with item name and item quantity
          for (var i = 0; i < mat_acc.result_str.length; ++i) {
            var count = mat_acc.counts[i];
            var mat = mat_acc.result_str[i];
            result_arr.push({
              name: mat,
              count: count
            });
          }

          result_arr.sort(function (a, b) {
            if (b.count !== a.count) return b.count - a.count;//descending order by count
            //alphabetical
            else if (a.name < b.name) return -1;
            else if (a.name > b.name) return 1;
          });
        }
        callbackFn(result_arr);
      } else {
        if (mat_acc === undefined) {
          mat_acc = {
            result_id: [],
            result_str: [],
            counts: []
          };
        }
        var curItemObject = item_id_arr.shift();
        // console.log(curItemObject);
        var curItemQty = curItemObject.count;
        var curItemID = curItemObject.id;
        var index = mat_acc.result_id.indexOf(curItemID);
        if (index === -1) {//item not in list yet
          client.getItem(curItemID)
            .then(function (item) {
              if (item.recipe !== undefined && item.recipe.materials !== undefined) {//we haven't reached the most basic item yet
                // console.log(item.recipe.materials);
                for (var m = 0; m < item.recipe.materials.length; ++m) {
                  var curMat = item.recipe.materials[m];
                  var curMatIndex = mat_acc.result_id.indexOf(curMat.id);
                  if (curMatIndex === -1) { //not in list yet
                    item_id_arr.push({
                      id: curMat.id,
                      count: curMat.count * curItemQty
                    });
                  } else {
                    mat_acc.counts[index] += curMat.count * curItemQty;
                  }
                }//end for every material
              } else if (item.id !== item_id) { //we've reached a base material
                mat_acc.result_id.push(item.id);
                mat_acc.result_str.push(item.name + " (" + item.id + ")");
                mat_acc.counts.push(curItemQty);
              }
              full_recipe_recursive(item_id_arr, mat_acc, callbackFn);
            });
        } else { //item already in list, increment count for that item
          mat_acc.counts[index] += curItemQty;
          full_recipe_recursive(item_id_arr, mat_acc, callbackFn);
        }

      }//end else
    }
    return new Promise(function (fulfill, reject) {
      full_recipe_recursive([{
        id: item_id,
        count: 1
      }], undefined, fulfill);
    });
  }

  //return 2 arrays, one with immediate usage, one with end usage
  function get_full_usage(item_id) {
    function recursive_usage(id_arr, acc, callbackFn) {
      if (id_arr.length === 0) {
        // console.log(acc);
        callbackFn(acc);
      } else {
        if (acc === undefined) {
          acc = {
            immediate: [],
            end: []
          };
        }

        var id = id_arr.shift();
        //get item
        client.getItem(id).then(function (item) {
          var name = `${item.name} (${item.id})`;
          if (acc.immediate.length === 0) {
            for (let i = 0; i < item.usage.length; ++i) {
              acc.immediate.push(`${item.usage[i].name} (${item.usage[i].id})`);
            }
          }

          if (item.usage.length === 0) { //found an end material, push to end array
            if (item.id !== item_id && acc.immediate.indexOf(name) == -1 && acc.end.indexOf(name) === -1)
              acc.end.push(name);
          } else {//found an intermediate material, push all usage items to array
            for (let i = 0; i < item.usage.length; ++i) {
              if (id_arr.indexOf(item.usage[i].id) === -1) {
                id_arr.push(item.usage[i].id);
              }
            }
            // console.log(id_arr);
          }
          recursive_usage(id_arr, acc, callbackFn);
        });
      }
    }

    return new Promise(function (fulfill, reject) {
      recursive_usage([item_id], undefined, fulfill);
    });
  }


  function print_embed(item,flags){
    var item_name = `${item.name} (${item.id})`;
    return new Promise(function(fulfill,reject){
      var embed = {
        title: item_name,
        fields: []
      };

      //general info
      embed.description = `Type: ${item.type}`;
      if(item["sphere type text"]){
        embed.description += ` (${item["sphere type text"]})`;
      }
      embed.description += `\nSell Price: ${print_formatted_number(item.sell_price)} Zel`;
      if(item["max equipped"]){
        embed.description += `\nMax Equipped: ${item["max equipped"]}`;
      }
      embed.description += `\nMax Stack: ${item.max_stack}`;
      embed.description += "\nAvailability: " + item.server.join(", ").toUpperCase();

      var data_promise;
      if(flags.print_location){
        data_promise = get_item_location(item,flags)
          .then(function(result){
            embed.fields.push({
              name: "Possible Location(s)",
              value: result
            });
            return;
          });
      }else if(flags.print_recipe){
        if (item.recipe === undefined) {
          embed.fields.push({
            name: "Recipe",
            value: `${item_name} cannot be crafted`
          });
          data_promise = Promise.resolve();
        } else {
          data_promise = get_full_recipe(item.id)
            .then(function(result){
              //convert materials into arrays to separate into message arrays
              var immediate_arr = [], full_arr = [];
              for(var m in item.recipe.materials){
                var curMaterial = item.recipe.materials[m];
                immediate_arr.push(curMaterial.count + "x " + curMaterial.name + " (" + curMaterial.id + ")\n");
              }

              //only add full field if it's more than immediate materials
              if(immediate_arr.length !== result.length){
                for (var i = 0; i < result.length; ++i) {
                  full_arr.push(`${result[i].count}x ${result[i].name}\n`);
                }
              }

              var immediate_promise = create_sectional_messages(immediate_arr, 900,20);
              var full_promise = create_sectional_messages(full_arr,900,20);

              return Promise.all([immediate_promise,full_promise])
                .then(function(result){
                  return {
                    immediate: result[0],
                    full: result[1]
                  };
                });
            })
            .then(function (result) {
              // var item_name = `${item.name} (${item.id})`;
              var msg_immediate = `Immediate Crafting Recipe for ${item_name}:\n`;
              if (item.recipe.karma !== undefined)
                msg_immediate += print_formatted_number(item.recipe.karma) + " Karma\n";
              msg_immediate += result.immediate[0];
              //get items
              embed.fields.push({
                name: "Immediate Recipe",
                value: msg_immediate
              });
              for (var i = 1; i < result.immediate.length; ++i){
                embed.fields.push({
                  name: `Immediate Recipe - ${i+1}`,
                  value: result.immediate[i]
                });
              }

              
              if(result.full.length > 0){
                var msg_full = `Full Crafting Recipe for ${item_name}:\n`;
                msg_full += result.full[0];
                embed.fields.push({
                  name: "Full Recipe",
                  value: msg_full
                });

                for (var i = 1; i < result.full.length; ++i) {
                  embed.fields.push({
                    name: `Full Recipe - ${i+1}`,
                    value: result.full[i]
                  });
                }

              }
              
              return;
            });
        }
      }else if(flags.print_usage){
        if (item.usage.length === 0) {
          embed.fields.push({
            name: "Usage",
            value: `${item_name} isn't used to make anything.`
          });
          data_promise = Promise.resolve();
        } else {
          data_promise = get_full_usage(item.id)
            .then(function(result){
              //do some preprocessing
              var max = (result.immediate.length > result.end.length) ? result.immediate.length : result.end.length;
              for(var i = 0; i < max; ++i){
                if(i < result.immediate.length){
                  result.immediate[i] += "\n";
                }

                if(i < result.end.length){
                  result.end[i] += "\n";
                }
              }

              var immediate_promise = create_sectional_messages(result.immediate,900,20);
              var end_promise = create_sectional_messages(result.end,900,20);

              //make sure each result array is of proper message length
              return Promise.all([immediate_promise,end_promise])
                .then(function(results){
                  return {
                    immediate: results[0],
                    end: results[1]
                  };
                });
            }).then(function (result) {
              var msg_immediate = `${item_name} can be used to immediately make:\n`;
              msg_immediate += result.immediate[0];
              embed.fields.push({
                name: "Immediate Usage",
                value: msg_immediate
              });
              for (let i = 1; i < result.immediate.length; ++i) {
                  embed.fields.push({
                    name: `Immediate Usage - ${i+1}`,
                    value: result.immediate[i]
                  }); 
              }


              if(result.end.length > 0){
                var msg_full = "It is also a material for the following other items:\n";
                msg_full += result.end[0];
                embed.fields.push({
                  name: "Full Usage",
                  value: msg_full
                });

                for (let i = 1; i < result.end.length; ++i) {
                  embed.fields.push({
                    name: `Full Usage - ${i+1}`,
                    value: result.end[i]
                  });
                }
              }

              return;
          });
        }
      }else{
        embed.fields.push({
          name: "Description",
          value: item.desc
        });
        if(item.effect !== undefined){
          let effect_msg = "";
          let effect_arr = [];
          var effect_list = (item.effect.effect !== undefined) ? item.effect.effect : item.effect;
          for (var e in effect_list) {
            effect_arr.push("```" + print_effects(effect_list[e]) + "\n```");
          }
          data_promise = create_sectional_messages(effect_arr,900,20)
            .then(function(msg_arr){
              for(var i = 0; i < msg_arr.length; ++i){
                embed.fields.push({
                  name: "Effects - " + (i+1),
                  value: msg_arr[i]
                });
              }
              return;
            })  
          // embed.fields.push({
          //   name: "Effects",
          //   value: effect_msg
          // });
        }else{
          embed.fields.push({
            name: "Effects",
            value: "This item doesn't seem like it does anything."
          });
          data_promise = Promise.resolve();
        }
      }

      data_promise.then(function(){
        if (isJapaneseText(JSON.stringify(embed))) {
          embed.fields.push({
            name: "Note",
            value: "Looks like this has some Japanese text in it. If this isn't what you wanted, try running the command again with `--translate`"
          });
        }

        //add footer data
        var image_url = {
            gl: "http://2.cdn.bravefrontier.gumi.sg/content/item/",
            eu: "http://static-bravefrontier.gumi-europe.net/content/item/",
            jp: "http://cdn.android.brave.a-lim.jp/item/"
        };

        embed.image = {
          url: `${image_url[item.server[0]]}${item.thumbnail}`
        };

        fulfill(embed);
      });
    });
  }

  function print_regular(item,flags){
    var msg = "";
    if(flags.print_location){
      return get_item_location(item,flags);
    }else if(flags.print_recipe){
      if(item.recipe === undefined){
        return Promise.resolve(`${item.name} (${item.id}) cannot be crafted.`);
      }else{
        return get_full_recipe(item.id)
          .then(function(result){
            var item_name = `${item.name} (${item.id})`;
            var msg_immediate = `Immediate Crafting Recipe for ${item_name}:\n`;
            if (item.recipe.karma !== undefined)
              msg_immediate += print_formatted_number(item.recipe.karma) + " Karma\n";
            //get items
            for (var m in item.recipe.materials) {
              var curMaterial = item.recipe.materials[m];
              msg_immediate += curMaterial.count + "x " + curMaterial.name + " (" + curMaterial.id + ")\n";
            }

            var msg_full = `Full Crafting Recipe for ${item_name}:\n`;
            for (var i = 0; i < result.length; ++i) {
              // var count = result.counts[i];
              // var mat = result.result_str[i];
              // msg += count + "x " + mat + "\n";
              msg_full += `${result[i].count}x ${result[i].name}\n`;
            }

            console.log(msg_full);
            return [msg_immediate,msg_full];
          });
        }
    }else if(flags.print_usage){
      var item_name = `${item.name} (${item.id})`;
      if(item.usage.length === 0){
        return Promise.resolve(`${item_name} isn't used to make anything.`);
      }else{
        return get_full_usage(item.id).then(function (result) {
          // return JSON.stringify(result,null,'  ');
          var msg_immediate = `${item_name} can be used to immediately make:\n`;
          for (let i = 0; i < result.immediate.length; ++i) {
            msg_immediate += result.immediate[i] + "\n";
          }

          var msg_full = "It is also a material for the following other items:\n";
          for (let i = 0; i < result.end.length; ++i) {
            msg_full += result.end[i] + "\n";
          }

          return [msg_immediate,msg_full];
        });
      }
    }else{
      return new Promise(function(fulfill,reject){
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
        if (flags.print_effects) {
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
        if (flags.print_recipe) {
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
        if (flags.print_usage) {
          if (item.usage !== undefined && item.usage.length > 0) {
            msg += "This item is used to make:\n";
            for (var i in item.usage) {
              msg += "* " + item.usage[i].name + " (" + item.usage[i].id + ")\n";
              if (msg.length > 1800) {
                msg += "...and " + (item.usage.length - i) + " others.\n";
                break;
              }
            }
          } else {
            msg += "This item isn't used to make anything else.\n";
          }
        }

        msg += "---\n";

        var image_url = {
          gl: "http://2.cdn.bravefrontier.gumi.sg/content/item/",
          eu: "http://static-bravefrontier.gumi-europe.net/content/item/",
          jp: "http://cdn.android.brave.a-lim.jp/item/"
        };
        msg += image_url[item.server[0]] + item.thumbnail;
        if (isJapaneseText(msg)) {
          msg += "\nLooks like this has some Japanese text in it. If this isn't what you wanted, try running the command again with `--translate`";
        }
        fulfill(msg);
      });
    }
  }

  return new Promise(function(fulfill,reject){
    client.getItem(item_id)
      .then(function(item){
        if(context.verbose){
          console.log(item);
        }
        if(item.error){
          fulfill(`Error: ${item.error}`);
          return;
        }

        var print;
        if (flags.translate) {
          print_debug_message(context, ["Entered translation branch"]);
          var translation = translate_unit(item);
          if (context.useEmbed)
            print = translation.then(function (result) {
              print_debug_message(context, ["Translated", result]);
              return print_embed(result, flags);
            });
          else
            print = translation.then(function (result) {
              print_debug_message(context, ["Translated", result]);
              return print_regular(result, flags);
            });
        } else {
          if (context.useEmbed)
            print = print_embed(item, flags);
          else
            print = print_regular(item, flags);
        }
        print.then(fulfill);
      });
  });
}

function get_request_options(query) {
  var result = "";
  for (var q in query) {
    result += q + "=" + query[q].toString() + "&";
  }
  return result;
}

function search_item(name, other_queries,context) {
  //replace wildcards with empty strings
  function get_query_value(query_value) {
    return (query_value == "*" || query_value === undefined) ? "" : query_value;
  }
  //check for item ID
  try {
    if (name !== undefined && name.toString().length > 0 && !isNaN(name)) {
      var id = parseInt(name);
      return [id];
    }
  } catch (err) {
    //don't do anything, just do a regular search
  }

  var query = {
    item_name_id: get_query_value(name),
    item_desc: get_query_value(other_queries.desc),
    rarity: get_query_value(other_queries.rarity),
    type: get_query_value(other_queries.type),
    effect: get_query_value(other_queries.effect),
    sphere_type: get_query_value(other_queries.sphere_type),
    server: get_query_value(other_queries.server),
    translate: get_query_value(other_queries.translate),
    verbose: context.verbose
  };

  /* possible sphere types
      Status Boost, Critical, Drop, Status Ailment, Damage Reducing, Status Ailments Resistant, BB Gauge, HP Recovery, Expose Target, Damage Reflecting, Spark, Defense Penetrating, Atk Boosting, Special
  */

  /*
      possible item types
      material, consumable, sphere, evomat, summoner_consumable, ls_sphere

  */

  //do a regular search
  // var url = load_server('server_url.txt');
  // if (url.length === 0) {
  //   console.log(err);
  //   throw "Error: can't open server_url.json";
  // }

  // var options = {
  //   method: 'GET',
  //   uri: url + "/search/item/options?" + get_request_options(query)
  // };

  // return request(options)
  //   .then(function (response) {
  //     try {
  //       return JSON.parse(response);
  //     } catch (err) {
  //       return ["Error: problem with server response"];
  //     }
  //   });
  print_debug_message(context,["searching with", query]);
  return client.searchItem(query);
}

function html_to_md_promise(html) {
  if (und === undefined) und = new upndown();
  return new Promise(function (fulfill, reject) {
    und.convert(html, function (err, md) {
      if (err) reject(err);
      else fulfill(md);
    });
  });
}

//remove markdown links in a string message
function remove_links(msg) {
  var arr = msg.split('\n');
  var result = "";

  for (var s in arr) {
    var curLine = arr[s];
    var firstBracket = curLine.indexOf("[");
    while (firstBracket != -1) {
      var secondBracket = curLine.indexOf(']');
      var lastParenthesis = curLine.indexOf(")", firstBracket);
      if (secondBracket == -1 || lastParenthesis == -1) {
        break;
      }
      curLine = curLine.slice(0, firstBracket) + curLine.slice(firstBracket + 1, secondBracket) + curLine.slice(lastParenthesis + 1);
      firstBracket = curLine.indexOf("[", firstBracket + 1);
    }
    result += curLine + "\n";
  }
  return result;
}

//given an item, get its location data
function get_item_location(id, flags) {
  try { // check if input has error field
    if (id.error !== undefined) {
      return "Error: " + id.error;
    }
  } catch (err) {
    //do nothing, as field doesn't exist
  }

  if (!isNaN(id)) {//if given an id, get the item first then try printing again
    return get_item(id).then(function (item) {
      return get_item_location(item, flags);
    });
  } else if (flags.translate) {
    flags.translate = false;
    var curItem = id;
    if (isJapaneseText(JSON.stringify(curItem))) { //translated item
      return translate_unit(id).then(function (item) {
        return get_item_location(item, flags);
      });
    } else { //item already in english
      return get_item_location(curItem, flags);
    }
  } else {
    var url = {
      gl_wiki: "http://bravefrontierglobal.wikia.com/wiki/",
      eu_wiki: "http://bravefrontiereurope.wikia.com/wiki/",
      randall: "01Main-Randall.png",
      sphere_house: "Facility_sphere.png",
      synthesis: "Facility_item.png",
    };
    var options = {
      method: 'GET',
      uri: ""
    };
    var raw_html = "";
    var item = id;

    //get url
    try {
      if (item.server[0] == 'gl') {
        options.uri = url.gl_wiki;
      } else if (item.server[0] == 'eu') {
        options.uri = url.eu_wiki;
      } else {
        return "JP items not supported at the moment.";
      }
      options.uri += item.name.replace(" ", "_");
    } catch (err) {
      console.log(err);
      return "Error reading item data.";
    }

    //try to find item on wiki
    return request.get(options)
      .then(function (response) {
        var $ = cheerio.load(response);
        var raw_text = $('.mw-content-text').text();
        raw_html = $('.mw-content-text').html();
        if (raw_text.indexOf("How to Obtain") > -1 || raw_html.indexOf(url.randall) > -1 || raw_html.indexOf(url.sphere_house) > -1 || raw_html.indexOf(url.synthesis) > -1) {
          if (raw_text.indexOf("How to Obtain") > -1)
            return html_to_md_promise($('.mw-content-text').find('ul').html());
          else
            return "";
        } else {
          return "No known way to obtain this item.";
        }
      })
      .then(function (msg) {
        if (msg == "* No known way to obtain this item") {
          return msg;
        } else {
          if (msg.length !== 0)
            msg += "\n";
          if (raw_html.indexOf(url.randall) > -1) {
            msg += "* Sphere Crafting Area in Imperial Capital Randall\n";
          }
          if (raw_html.indexOf(url.sphere_house) > -1) {
            msg += "* Sphere House in Town\n";
          }

          if (raw_html.indexOf(url.synthesis) > -1) {
            msg += "* Synthesis House in Town\n";
          }
        }
        return remove_links(msg);
      })
      .then(function (result) {
        var msg = "";
        msg += item.name + " (" + item.id + ") | " + item.type + " | " + item.rarity + "\*";
        if (item["sphere type text"] !== undefined) {
          msg += " | Sphere Type: " + item["sphere type text"];
        }
        msg += "\n";
        msg += "* Sell Price: " + print_formatted_number(item.sell_price) + " | ";
        if (item["max equipped"]) msg += "Max Equipped: " + item["max equipped"] + " | ";
        msg += "Max Stack: " + item.max_stack + "\n";
        msg += "How to obtain " + item.name + ":\n" + result + "Source: " + options.uri + "\n";

        msg += "---\n";

        var image_urls = {
          gl: "http://2.cdn.bravefrontier.gumi.sg/content/item/",
          eu: "http://static-bravefrontier.gumi-europe.net/content/item/",
          jp: "http://cdn.android.brave.a-lim.jp/item/"
        };
        msg += image_urls[item.server[0]] + item.thumbnail;
        if (isJapaneseText(msg)) {
          msg += "\nLooks like this has some Japanese text in it. If this isn't what you wanted, try running the command again with `--translate`";
        }
        return msg;
      })
      .catch(function (err) {
        console.log(Object.keys(err));
        console.log(err.statusCode);
        return ("Error: Item not found on wiki or can't connect to wiki.");
      });
  }
}

//print an array of results
function print_multiple_results(results, context) {
  function print_embed(result_arr, prefix) {
    var embed = {
      title: 'Search Results',
      description: prefix,
      fields: []
    };

    var field_arr = [{
      name: "Results - Page 1"
    }];
    var msg = "";
    while (result_arr.length !== 0 && msg.length < 900) {
      msg += result_arr.shift();
    }

    field_arr[0].value = msg;
    //hit character limit for one field
    if (result_arr.length !== 0) {
      return create_sectional_messages(result_arr, 900)
        .then(function (msg_arr) {
          var i;
          for (i = 0; i < msg_arr.length; ++i) {
            field_arr.push({
              name: "Results - Page " + (i + 2),
              value: msg_arr[i]
            });
          }
          for (i = 0; i < field_arr.length; ++i) {
            embed.fields.push(field_arr[i]);
          }
          return embed;
        });
    } else {
      embed.fields.push(field_arr[0]);
      return embed;
    }
  }

  function print_regular(result_arr, prefix) {
    var msg = prefix;
    var max = (result_arr.length < 100) ? result_arr.length : 100;
    // var max = result_arr.length;
    for (var i = 0; i < max; ++i) {
      msg += result_arr[i];
    }

    if (result_arr.length > max) {
      msg += "...and " + (result_arr.length - max) + " more";
    }
    if (result_arr.length > 1000) {
      msg += "\nAre you trying to get all of the items? Check your search options again, especially for double dashes.";
    }

    return msg;
  }


  return new Promise(function (fulfill, reject) {
    client.getItems(results)
      .then(function (results) {
        var msg = results.length + " items found. Please try the command again using one of the IDs below.\n";
        var formatted_results = [];
        for (var i = 0; i < results.length; ++i) {
          formatted_results.push(`${results[i].name} (${results[i].id})\n`);
        }

        if (context.useEmbed) {
          return print_embed(formatted_results, msg);
        } else {
          return print_regular(formatted_results, msg + "--\n");
        }
      }).then(fulfill).catch(reject);
  });
}
