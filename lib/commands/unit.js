var Clapp = require('../modules/clapp-discord');
var request = require('request-promise');
var fs = require('fs');
var underscore = require('underscore');
var Table = require('easy-table');
var translate = require('google-translate-api');
var client = require('../modules/BFDBReader-node/data_tier_client.js');
var common = require('../modules/Bluubot-common');

var command_args = [
    {
        name: 'name',
        desc: 'search for a unit based on a given name or id; * is considered a wildcard',
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
        desc: 'Print the translation from Japanese to English of a unit. Uses Google Translate API.',
        type: 'boolean',
        internal_type: "print",
        default: false
    },
    {
        name: 'print_raw_effects',
        desc: 'Print the raw data of a unit',
        type: 'boolean',
        internal_type: "print",
        default: false
    },
    {
        name: 'print_ls',
        desc: 'Print the raw leader skill data of a unit (when used with `--noembed`)',
        type: 'boolean',
        internal_type: "print",
        default: false
    },
    {
        name: 'print_es',
        desc: 'Print the raw extra skill data of a unit (when used with `--noembed`)',
        type: 'boolean',
        internal_type: "print",
        default: false
    },
    {
        name: 'print_bb',
        desc: 'Print the raw brave burst data of a unit (when used with `--noembed`)',
        type: 'boolean',
        internal_type: "print",
        default: false
    },
    {
        name: 'print_sbb',
        desc: 'Print the raw sbb data of a unit (when used with `--noembed`)',
        type: 'boolean',
        internal_type: "print",
        default: false
    },
    {
        name: 'print_ubb',
        desc: 'Print the raw ubb data of a unit (when used with `--noembed`)',
        type: 'boolean',
        internal_type: "print",
        default: false
    },
    {
        name: 'print_sp',
        desc: 'Print the SP data of a unit',
        type: 'boolean',
        internal_type: "print",
        default: false
    },
    {
        name: 'print_evo',
        desc: 'Print the evolution data of a unit',
        type: 'boolean',
        internal_type: "print",
        default: false
    },
    {
        name: 'print_sp_skill',
        desc: 'Print the raw SP data of a unit (when used with `--noembed`)',
        type: 'string',
        internal_type: "print",
        default: ''
    },
    {
        name: 'print_arena',
        desc: 'Print the raw arena data of a unit',
        type: 'boolean',
        internal_type: "print",
        default: false
    },
    {
        name: 'print_stats',
        desc: 'Print the lord stats (and imps) of a maxed unit',
        type: 'boolean',
        internal_type: "print",
        default: false
    },
    {
        name: 'print_hitcounts',
        desc: 'Print the hit count tables of a unit (normal, bb, sbb, ubb)',
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
        name: 'list_start',
        desc: 'for range and count; starting value; -1 is default',
        type: 'number',
        internal_type: "list",
        default: -1
    },
    {
        name: 'list_end',
        desc: 'for range only; ending value; -1 is default',
        type: 'number',
        internal_type: "list",
        default: -1
    },
    {
        name: 'list_type',
        desc: 'type of search; possible options include guide (for guide ID) and unit (for unit ID); defaults to guide',
        type: 'string',
        internal_type: "list",
        default: 'guide'
    }
];


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
            desc: "lists information on searching units"
        },
        {
            name: "print_help",
            desc: "lists information on printing units"
        },
        {
            name: "list_help",
            desc: "lists information on listing units"
        }];
        msg += "Use one of the following commands to gain more information on each aspect of the `" + this.name + "` command:\n";
        for (var i = 0; i < helpCmds.length; ++i) {
            msg += "`" + this.name + " --" + helpCmds[i].name + "`: " + helpCmds[i].desc + "\n";
        }
        msg += "\nAlternatively, you could look at the full command documentation here: " + "https://github.com/BluuArc/BluuBot-discord/blob/master/COMMANDS.md\n";
        return msg;
    }
}

common.initialize_client(client);
module.exports = new MyCommand({
    name: "unit",
    desc: "returns a unit based on input; use unit --search_help, unit --print_help, and unit --list_help for more info",
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
                        header = "There are a few commands related to printing unit info.\n---\n";
                        internal_type = "print";
                        footer = "\nThe print_sp_skill command is different from the rest as it requires an ID to work. You can see those IDs by looking at the regular SP skills of a unit (without the raw command)\n";
                        footer += "Some of the commands can be chained together, but if the combined result passes the character limit, nothing is shown.\n";
                        footer += "The raw flag will be automatically set to true if any one of these are used\n";
                        footer += "Example: `|bb unit Feeva --rarity 8 --print_sp_skill 51001004 --noembed` prints the value of the BB fill on spark SP for Feeva without the embedding format\n";
                        footer += "Example: `|bb unit gabriela --rarity 8 --print_hitcounts` prints the hit count tables for Gabriela";
                    } else if (argv.flags.search_help) { // print search info
                        header = "There are a few commands related to searching unit info.\n---\n";
                        internal_type = "search";
                        footer = "\nFor all of these (and the first argument of the unit command where you input the name), the asterisk can be used as a wildcard\n";
                        footer += "Example: `|bb unit --element dark --rarity 8` prints all OE dark units";
                    } else if (argv.flags.list_help) {
                        header = "There are a few commands related to listing unit info.\n---\n";
                        internal_type = "list";
                        footer = "\nYou only need to specify either `list_start` or `list_end` for the command to activate; both can be used together.\n";
                        footer += "Example: `|bb unit --list_type unit --list_start 60660 --list_end 60670` prints all units whose ID is between 60660 and 60670 inclusively.\n";
                        footer += "Example: `|bb unit --l_start 1600` prints all units whose guide ID is 1600 or larger";
                    }
                    fulfill(common.print_help(header, internal_type, footer,command_flags));
                    return;
                }//end help

                //list commands
                if(argv.flags.list_start !== -1 || argv.flags.list_end !== -1){
                    var list_query = do_list_query(argv.flags.list_start, argv.flags.list_end, argv.flags.list_type, context)
                            .catch(function(err) {
                            console.log("Error in do_list_query:", err);
                            fulfill("Error: can't connect to database server");
                        });

                    var list_process = list_query.then(function(results){
                        if(results){
                            var formatted_results = [];
                            for(var i = 0; i < results.length; ++i){
                                formatted_results.push(results[i] + "\n");
                            }
                            if(context.useEmbed){
                                return common.create_sectional_messages(formatted_results,950,5)
                                    .then(function(msg_arr){
                                            var embed = {
                                                title: "Listing results",
                                                description: `${formatted_results.length} units found. Please try the command again using one of the IDs below.`,
                                                fields: []
                                            };
                                            if(msg_arr.length > 0){
                                                for(var i = 0; i < msg_arr.length; ++i){
                                                    embed.fields.push({
                                                        name: `Results - ${i+1}`,
                                                        value: msg_arr[i]
                                                    });
                                                }
                                            }else{
                                                embed.description = "No units found with your parameters.";
                                            }

                                            return embed;
                                    }).catch(function(err){
                                        console.log("List error",err);
                                        reject(err);
                                    });
                            } else {
                                if (formatted_results.length > 0) {
                                    msg = `${formatted_results.length} units found. Please try the command again using one of the IDs below.\n---\n`;
                                    var u = 0;
                                    var max = (formatted_results.length < 100) ? formatted_results.length : 100;
                                    for (u = 0; u < max; ++u) {
                                        msg += formatted_results[u];
                                    }

                                    if (formatted_results.length > max) {
                                        var diff = formatted_results.length - u;
                                        msg += "...and " + diff + ((diff == 1) ? " other" : " others");
                                        if (diff > 2000) {
                                            msg += "\nAre you trying to get all of the units? Check your search options again, especially for double dashes.";
                                        }
                                    }
                                }
                                return Promise.resolve(msg);
                            }
                        }else{
                            reject("Problem with data");
                        }
                    }).catch(function(err){
                        console.log("Error with list_process",err);  
                        reject(err);
                    });

                    var list_post = list_process
                        .then(function(msg){
                            if (context.useEmbed && (typeof msg).toLowerCase() === "object") {
                                fulfill(JSON.stringify({ embed: msg }));
                            } else if (msg instanceof Array) {
                                fulfill(JSON.stringify(msg));
                            } else {
                                fulfill(msg);
                            }
                        }).catch(function (err) {
                            console.log("Error with list_post", err);
                            reject(err);
                        });
                    return;
                }

                //automatically set effects flag
                var legacy_fields = ['print_ls', 'print_es', 'print_bb', 'print_sbb','print_ubb'];
                for(var i = 0; i < legacy_fields.length; ++i){
                    if(argv.flags[legacy_fields[i]]){
                        argv.flags.print_raw_effects = true;
                        break;
                    }
                }
                //special cases for embedding and not embedding
                if(context.useEmbed){
                    if(argv.flags.print_sp_skill.length > 0){
                        argv.flags.print_sp = true;
                    }

                }else{
                    if(argv.flags.print_arena || argv.flags.print_hitcounts || argv.flags.print_sp || argv.flags.print_sp_skill.length > 0){
                        argv.flags.print_raw_effects = true;
                    }
                }

                var search_results = Promise.resolve(search_unit(argv.args.name, argv.flags,context))
                    .catch(function(err){
                        console.log("Error in search_results:",err);
                        fulfill("Error: can't connect to database server");
                    });
                
                var process_results = search_results.then(function(results){
                    common.print_debug_message(context,["reached process_results with",results]);
                    if(results === undefined || results.length === 0){
                        fulfill("No unit found with those parameters");
                        return;
                    }else if (results.length === 1){
                        return print_unit(results[0],argv.flags,context);
                    }else{
                        return print_multiple_results(results,context);
                    }
                }).catch(function(err){
                    console.log("Error with process_results:",err);
                    fulfill("Error with processing results.");
                });

                var print_results = process_results.then(function(msg){
                    common.print_debug_message(context,["reached print_results with",msg,"useEmbed", context.useEmbed]);
                    if(msg === undefined){
                        fulfill("No unit found with those parameters");
                    }
                    if(context.useEmbed && (typeof msg).toLowerCase() === "object"){
                        fulfill(JSON.stringify({embed: msg}));
                    }else if(msg instanceof Array){
                        fulfill(JSON.stringify(msg));
                    }else{
                        fulfill(msg);
                    }
                }).catch(function(err){
                    console.log("Error with print_results:",err);
                    fulfill("Error with printing results");
                });

            });
        } catch (err) {
            console.log(err);
            return "Error trying to process unit command";
        }
    }
});

//returns an array of results
function search_unit(name,other_queries,context){
    //replace wildcards with empty strings
    function get_query_value(query_value) {
        return (query_value == "*") ? "" : query_value;
    }

    common.print_debug_message(context, ["reached search unit with",name]);
    //check for unit or guide id
    try {
        if (!isNaN(name)) {
            var id = parseInt(name);
            if (id >= 10000) {//it's a unit id
                return [id];
            } else { //it's a guide id
                return (search_unit(id + ":", other_queries));
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
        strict: other_queries.strict,
        verbose: context.verbose
    };

    common.print_debug_message(context,["searching with",query]);
    return client.searchUnit(query);
}

//print info for a single unit
function print_unit(unit_id, flags, context){
    var colors = {
        fire: 0xe06666,
        water: 0x6fa8dc,
        earth: 0x93c47d,
        thunder: 0xffd966,
        light: 0xd9d9d9,
        dark: 0x8e7cc3
    };

    function get_unit_move_type(move_type) {
        switch (move_type) {
            case "1": return "Moving";
            case "2": return "Teleporting";
            case "3": return "Non-Moving";
            default: return "Unknown move type " + move_type;
        }
    }

    function print_burst_dc_info(burst){
        var msg = "";
        try {
            var endLevel = burst.levels[burst.levels.length - 1];

            var numHits = burst["damage frames"][0].hits;
            var dc = numHits * burst["drop check count"];
            var proc = burst["damage frames"][0]["proc id"];
            //check for non-attacking burst
            var non_attack_proc = ["2",'5','51','18','3','38'];
            if (non_attack_proc.indexOf(proc) > -1) {
                numHits = 0;
            }
            msg += "(" + endLevel["bc cost"] + "BC/" + numHits + "hits/" + dc + "DC) ";
        } catch (err) {
            console.log(err);
            msg = "None";
        }
        return msg;
    }

    function print_burst_effects(burst) {
        var msg = "";
        try {
            var endLevel = burst.levels[burst.levels.length - 1];

            for(var e in endLevel.effects){
                msg += "```";
                msg += common.print_effects(endLevel.effects[e]) + "\n";
                msg += "```";
            }
        } catch (err) {
            console.log(err);
            msg = "None";
        }
        return msg;
    }

    function print_stat_table(unit){
        //input: object with 4 fields for hp/atk/def/rec
        function getStats(unit_stats) {
            var newStats = {};
            for (var s in unit_stats) {
                newStats[s.replace(" ", "_")] = unit_stats[s];
            }
            return newStats;
        }
        var names = ["_base", "_lord", "anima", "breaker", "guardian", "oracle"];
        var data = [];

        //get stat data
        for (var u in names) {
            data.push(getStats(unit.stats[names[u]]));
            data[u].name = names[u];
        }
        data.push(getStats(unit.imp));
        data[data.length - 1].name = "imps";

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

    function getSPCategory(num) {
        var sp_categories = {
            "1": "Parameter Boost",
            "2": "Spark",
            "3": "Critical Hits",
            "4": "Attack Boost",
            "5": "BB Gauge",
            "6": "HP Recovery",
            "7": "Drops",
            "8": "Ailment Resistance",
            "9": "Ailment Infliction",
            "10": "Damage Reduction",
            "11": "Special"
        };
        return sp_categories[num.toString()];
    }


    function get_evo_line(unit_id) {
        function get_first_unit(unit_id) {
            return new Promise(function (fulfill, reject) {
                function get_unit_helper(unit_id, callbackFn) {
                    client.getUnit(unit_id)
                        .then(function (result) {
                            if (result.prev === undefined) {
                                // console.log(result);
                                callbackFn(result.id);
                            }
                            else
                                get_unit_helper(result.prev, callbackFn);
                        }).catch(reject);
                }
                get_unit_helper(unit_id, fulfill);
            });
        }

        function get_evo_helper(unit_id, evo_acc, fulfillFn,rejectFn) {
            if (evo_acc === undefined)
                evo_acc = [];
            evo_acc.push(unit_id);
            client.getUnit(unit_id)
                .then(function (result) {
                    if (result.next === undefined) {
                        fulfillFn(evo_acc);
                    } else {
                        return get_evo_helper(result.next, evo_acc, fulfillFn,rejectFn);
                    }
                }).catch(rejectFn);
        }

        return new Promise(function (fulfill, reject) {
            get_first_unit(unit_id).then(function (result) {
                get_evo_helper(result, [], fulfill,reject);
            }).catch(reject);
        });
    }

    //print the entire evolution line of a unit (and materials)
    function print_evo(unit) {
        function print_evo_helper(unit_arr) {
            function print_recursive(unit_arr, acc, callbackFn) {
                if (unit_arr.length < 2) {
                    callbackFn(acc);
                } else {
                    var curUnit = unit_arr.shift();
                    if (acc === undefined || acc.length === 0) {
                        acc = curUnit.name + " (" + curUnit.id + ") -> " + unit_arr[0].name + " (" + unit_arr[0].id + ")\n";
                    } else {
                        acc += "\n" + curUnit.name + " (" + curUnit.id + ") -> " + unit_arr[0].name + " (" + unit_arr[0].id + ")\n";
                    }

                    acc += get_evo_mats(curUnit) + "\n";
                    print_recursive(unit_arr, acc, callbackFn);
                }
            }
            return new Promise(function (fulfill, reject) {
                print_recursive(unit_arr, "", fulfill);
            });
        }

        function get_evo_mats(unit) {
            //count evo mats for duplicates
            var mats = [];
            var count = [];
            mats.push(unit.evo_mats[0].name + " (" + unit.evo_mats[0].id + ")");
            count.push(1);
            for (var mat = 1; mat < unit.evo_mats.length; ++mat) {
                var formatted = unit.evo_mats[mat].name + " (" + unit.evo_mats[mat].id + ")";
                var index = mats.indexOf(formatted);
                if (index === -1) {
                    mats.push(formatted);
                    count.push(1);
                } else {
                    count[index]++;
                }
            }

            //convert to string
            var msg = "";
            for (var i = 0; i < mats.length; ++i) {
                if (count[i] > 1) {
                    msg += count[i] + "x ";
                }
                msg += mats[i];
                if (i < mats.length - 1) {
                    msg += ", ";
                }
            }

            return msg;
        }

        return new Promise(function (fulfill, reject) {
            get_evo_line(unit.id).then(function (result_arr) {
                // console.log(result_arr);
                if (result_arr.length < 2) {
                    return "This unit does not have any evolutions.";
                } else {
                    return client.getUnits(result_arr).then(print_evo_helper).catch(reject);
                }
            }).then(fulfill).catch(reject);
        });
    }

    function print_hit_table(timing_array, distribution_array, nodiff) {
        var table = new Table();
        var size = timing_array.length;
        var data = [];
        //create data set
        for (var i = 0; i < size; ++i) {
            data.push({
                num: (i + 1),
                timing: timing_array[i],
                distribution: distribution_array[i],
                diff: (i !== 0) ? timing_array[i] - timing_array[i - 1] : 0
            });
        }

        // console.log(data);

        //put data set onto table
        data.forEach(function (hit) {
            table.cell('Hit#', hit.num);
            table.cell('Frame#', hit.timing);
            table.cell('DMG%/hit', hit.distribution);
            if (nodiff === undefined || nodiff === true)
                table.cell('Time Diff', hit.diff);
            table.newRow();
        })

        // console.log(table.toString());
        var msg = "```" + table.toString() + "```\n";
        if (msg.length > 1000 && (nodiff === undefined || nodiff === true)) {
            return print_hit_table(timing_array, distribution_array, false);
        } else {
            return msg;
        }
    }

    function translate_to_english(msg, fields, endField) {
        return translate(msg, { from: 'ja', to: 'en' })
            .then(function (result) {
                var result_text = "";
                if (result.text.indexOf("null") === result.text.length - 4) {
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
                throw err;
            });
    }

    //given a unit, return a promise that contains the translated unit object
    function translate_unit(unit) {
        //recursively translate all fields
        function translate_unit_recursive(object, levels) {
            var promises = [];
            // var translatable_fields = ["desc", "name", "dependency comment"];

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
                } else if ((typeof curField === "string") && curField.length > 0 && common.isJapaneseText(curField)) {
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


    function print_embed(unit,flags){
        return new Promise(function(fulfill,reject){
            let name = (unit.translated_name) ? unit.translated_name : unit.name;
            var embed = {
                color: colors[unit.element],
                title: `${unit.guide_id}: ${name} (${unit.id})`,
                fields: []
            };

            var field_arr = [];
            var extra_data, e;

            //general info
            var numHits = unit["damage frames"].hits;
            embed.description = unit.rarity + "\* | " + unit.element + " | " + unit.cost + " Cost | " + unit.gender + "\n";
            embed.description += "Move Speed: " + unit.movement.skill["move speed type"];
            embed.description += "\nMove Type: " + get_unit_move_type(unit.movement.skill["move type"]);
            embed.description += "\nNormal Attack: " + numHits + (numHits == 1 ? " hit (" : " hits (") + (unit["drop check count"] * numHits) + "DC)";
            embed.description += "\nAvailability: " + unit.server.join(", ").toUpperCase();
            if(unit.translated_name) embed.description += `\nOriginal Name: ${unit.name}`;
            if(flags.print_stats){
                field_arr.push({
                    name: "Stats",
                    value: "```" + print_stat_table(unit) + "```"
                });
            }

            //footer info
            var server = unit.server[0];
            var url = (function (server) {
                switch (server) {
                    case "eu": return "http://static-bravefrontier.gumi-europe.net/content/unit/img/";
                    case "gl": return "http://2.cdn.bravefrontier.gumi.sg/content/unit/img/";
                    case "jp": return "http://cdn.android.brave.a-lim.jp/unit/img/";
                    default: break;
                }
            })(server);

            embed.footer = {
                icon_url: `${url}unit_ills_thum_${unit.id}.png`
            };

            embed.image = {
                url: `${url}unit_ills_full_${unit.id}.png`
            };

            embed.url = `${url}unit_ills_full_${unit.id}.png`;
            
            if(flags.print_arena){
                if(unit.ai){
                    var data = "";
                    for(var a in unit.ai){
                        data += "```" + common.print_effects(unit.ai[a]) + "\n```";
                    }
                    field_arr.push({
                        name: "Arena AI",
                        value: data
                    });
                }else{
                    field_arr.push({
                        name: "Arena AI",
                        value: "None/Data not found"
                    })
                }
            }

            
            if(flags.print_sp){
                if(unit.skills !== undefined){
                    for(var s = 0; s < unit.skills.length; ++s){
                        var curEnhance = unit.skills[s];
                        var curSkill = curEnhance.skill;
                        var title = curSkill.bp + " SP - " + getSPCategory(curEnhance.category) + " (" + s + ")";
                        var desc = `**${curSkill.desc}**`;
                        desc += "\nID: " + curSkill.id + "\n";
                        // var title = curSkill.bp + "SP - " + curSkill.desc + " (" + s + ")";
                        // var desc = "Type: " + getSPCategory(curEnhance.category) + " | ID: " + curSkill.id + "\n";
                        if(curEnhance.dependency !== ""){
                            try {
                                desc += "*Requires SP with ID " + curEnhance.dependency.split('@')[1] + " to use this enhancement.*\n";
                            } catch (err) {
                                console.log("Error parsing " + curEnhance.dependency);
                                desc += "*Requires SP with ID " + curEnhance.dependency + " to use this enhancement.*\n";
                            }
                        }
                        // console.log(curSkill.effects);
                        //print effects
                        desc += "```";
                        for(var effect = 0; effect < curSkill.effects.length; ++effect){
                            if(curSkill.effects[effect] instanceof Array){
                                desc += common.print_array(curSkill.effects[effect]);
                            }else if(curSkill.effects[effect] instanceof Object){
                                for(var elem in curSkill.effects[effect]){
                                    desc += elem + ": " + common.print_effects(curSkill.effects[effect][elem]);
                                }
                            }else{
                                desc += curSkill.effects[effect];
                            }
                            desc += "\n";
                        }
                        desc += "```";
                        field_arr.push({
                            name: title,
                            value: desc
                        });
                    }
                }else{
                    field_arr.push({
                        name: "No SP Enhancements found",
                        value: "No data found"
                    });
                }
            }else if(flags.print_evo){
                print_evo(unit)
                    .then(function(result){
                        common.print_debug_message(context,["entered print evo with", result]);
                        //convert result into field array
                        var embedded_results = result.split('\n\n');
                        for(var i = 0; i < embedded_results.length; ++i){
                            var current_fields = embedded_results[i].split('\n');
                            if(current_fields.length < 2){ //no evolutions
                                field_arr.push({
                                    name: `${unit.name} (${unit.id})`,
                                    value: "This unit does not have any evolutions."
                                });
                                break;
                            }else{
                                field_arr.push({
                                    name: current_fields[0],
                                    value: current_fields[1]
                                });
                            }
                        }

                        //process field array
                        for (var i = 0; i < field_arr.length; ++i) {
                            embed.fields.push(field_arr[i]);
                        }

                        

                        fulfill(embed);
                    }).catch(reject);
                    return;
            }else if(flags.print_hitcounts){
                //print normal hitcounts
                field_arr.push({
                    name: "Hit Count Data for Normal Attacks",
                    value: print_hit_table(unit["damage frames"]["frame times"], unit["damage frames"]["hit dmg% distribution"])
                });

                //print burst hitcounts
                var bursts = ['bb','sbb','ubb'];
                for(var b = 0; b < bursts.length; ++b){
                    var burst = unit[bursts[b]];
                    var burst_data = "";
                    if(burst){
                        var proc = burst["damage frames"][0]["proc id"];
                        //only print tables if burst is attacking
                        var non_attack_burst = ["2", "5", "51", "18", "3", "38"];
                        if (non_attack_burst.indexOf(proc) === -1) {
                            // burst_data += "* Hit Count Data for " + hit_type.toUpperCase() + ":\n";
                            burst_data += print_hit_table(burst["damage frames"][0]["frame times"], burst["damage frames"][0]["hit dmg% distribution"]);
                            //print tables for bursts with multiple attacks
                            try {
                                var multi_attack_burst = ["1", "64", "47", "13", "14", "29", "97"];
                                for (var i = 1; i < burst["damage frames"].length; ++i) {
                                    proc = burst["damage frames"][i]["proc id"];
                                    if (multi_attack_burst.indexOf(proc) > -1) {
                                        burst_data += print_hit_table(burst["damage frames"][i]["frame times"], burst["damage frames"][i]["hit dmg% distribution"]);
                                    }
                                }
                            } catch (err) {
                                console.log("Error in printing hit counts",err);
                            }
                        } else {
                            burst_data += "This unit does not have an attacking " + bursts[b].toUpperCase() + "\n";
                        }
                    } else {
                        // burst_data += "This unit does not have a field for " + bursts[b] + "\n";
                        // do nothing
                    }

                    if(burst_data.length > 0){
                        field_arr.push({
                            name: "Hit Count Data for " + bursts[b].toUpperCase(),
                            value: (burst_data.length > 1000) ? "This table is too large to show in embeds. Try again with `--noembed`." : burst_data
                        });
                    }
                }
            }else{
                if(unit["leader skill"]){
                    try{
                        var ls = unit["leader skill"];
                        extra_data = ls.desc;
                        if(flags.print_raw_effects){
                            extra_data = "";
                            for(e in ls.effects){
                                extra_data += "```";
                                extra_data += common.print_effects(ls.effects[e]) + "\n";
                                extra_data += "```";
                            }
                        }
                        field_arr.push({
                            name: "Leader Skill: " + ls.name,
                            value: extra_data
                        });
                    }catch(err){
                        console.log("Error with getting LS data",err);
                        field_arr.push({
                            name: "Leader Skill: Error",
                            value: "Error getting data"
                        });
                    }
                }else{
                    field_arr.push({
                        name: "Leader Skill: None",
                        value: "No data found"
                    });
                }

                if(unit["extra skill"]){
                    try{
                        var es = unit["extra skill"];
                        extra_data = es.desc;
                        if (flags.print_raw_effects) {
                            extra_data = "```target: " + es.target + "\n```";
                            extra_data += "\n";
                            for (e in es.effects) {
                                extra_data += "```";
                                extra_data += common.print_effects(es.effects[e]) + "\n";
                                extra_data += "```";
                            }
                        }
                        field_arr.push({
                            name: "Extra Skill: " + es.name,
                            value: extra_data
                        });
                    } catch (err) {
                        console.log("Error with getting ES data", err);
                        field_arr.push({
                            name: "Extra Skill: Error",
                            value: "Error getting data"
                        });
                    }
                }

                if(unit.bb){
                    try{
                        var bb = unit.bb;
                        var drop_checks_bb = print_burst_dc_info(bb);
                        extra_data = (drop_checks_bb === "None") ? "None" : (drop_checks_bb + "\n" + bb.desc);
                        if (flags.print_raw_effects && drop_checks_bb !== "None") {
                            extra_data = print_burst_effects(bb);
                        }
                        field_arr.push({
                            name: "Brave Burst: " + bb.name,
                            value: extra_data
                        });
                    } catch (err) {
                        console.log("Error with getting BB data", err);
                        field_arr.push({
                            name: "Brave Burst: Error",
                            value: "Error getting data"
                        });
                    }
                }else{
                    field_arr.push({
                        name: "Brave Burst: None",
                        value: "No data found"
                    });
                }

                if (unit.sbb) {
                    try{
                        var sbb = unit.sbb;
                        var drop_checks_sbb = print_burst_dc_info(sbb);
                        extra_data = (drop_checks_sbb === "None") ? "None" : (drop_checks_sbb + "\n" + sbb.desc);
                        if (flags.print_raw_effects && drop_checks_sbb !== "None") {
                            extra_data = print_burst_effects(sbb);
                        }
                        field_arr.push({
                            name: "Super Brave Burst: " + sbb.name,
                            value: extra_data
                        });
                    } catch (err) {
                        console.log("Error with getting SBB data", err);
                        field_arr.push({
                            name: "Super Brave Burst: Error",
                            value: "Error getting data"
                        });
                    }
                }

                if (unit.ubb) {
                    try{
                        var ubb = unit.ubb;
                        var drop_checks_ubb = print_burst_dc_info(ubb);
                        extra_data = (drop_checks_ubb === "None") ? "None" : (drop_checks_ubb + "\n" + ubb.desc);
                        if (flags.print_raw_effects && drop_checks_ubb !== "None") {
                            extra_data = print_burst_effects(ubb);
                        }
                        field_arr.push({
                            name: "Ultimate Brave Burst: " + ubb.name,
                            value: extra_data
                        });
                    } catch (err) {
                        console.log("Error with getting BB data", err);
                        field_arr.push({
                            name: "Brave Burst: Error",
                            value: "Error getting data"
                        });
                    }
                }
            }

            for(var i = 0; i < field_arr.length; ++i){
                embed.fields.push(field_arr[i]);
            }

            if(common.isJapaneseText(JSON.stringify(embed))){
                embed.fields.push({
                    name: "Note",
                    value: "Looks like this has some Japanese text in it. If this isn't what you wanted, try running the command again with `--translate`"
                });
            }
            fulfill(embed);
        });
    }

    //fallback function for when user doesn't want embeds
    function print_regular(unit,flags){
        function print_burst(burst, print_raw, sub_point) {
            var msg = "";
            try {
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
                if (msg.indexOf("\n") == -1) {
                    msg += "\n";
                }

                if (print_raw) {
                    for (e in endLevel["effects"]) {
                        msg += "```";
                        msg += common.print_effects(endLevel["effects"][e]) + "\n";
                        msg += "```";
                    }
                }
            } catch (err) {
                console.log(err);
                msg = "None";
            }
            return msg;
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

                        if (sp[s]["dependency"] !== "") {
                            try {
                                msg += "```Requires " + sp[s]["dependency"].split('@')[1] + " to be unlocked to use this enhancement.\n```";
                            } catch (err) {
                                console.log("Error parsing " + sp[s]["dependency"]);
                                msg += "```Requires " + sp[s]["dependency"] + " to be unlocked to use this enhancement.\n```";
                            }
                        }
                        var point = sub_point;
                        msg += "```";
                        //print effects of each skill
                        for (e in curSkill["effects"]) {
                            if (curSkill["effects"][e] instanceof Array) {
                                msg += common.print_array(curSkill["effects"][e]);
                            } else if (curSkill["effects"][e] instanceof Object) {
                                for (elem in curSkill["effects"][e]) {
                                    msg += "" + elem + ": " + common.print_effects(curSkill["effects"][e][elem]);
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

        function handle_hitcount_flag(unit, hit_type) {
            var msg = "";
            if (hit_type == "normal") {
                msg += "* Hit Count Data for Normal Attacks:\n";
                msg += print_hit_table(unit["damage frames"]["frame times"], unit["damage frames"]["hit dmg% distribution"]);
            } else {
                var burst = unit[hit_type];
                if (burst != undefined) {
                    var proc = burst["damage frames"][0]["proc id"];
                    //only print tables if burst is attacking
                    var non_attack_burst = ["2", "5", "51", "18", "3", "38"];
                    if (non_attack_burst.indexOf(proc) == -1) {
                        msg += "* Hit Count Data for " + hit_type.toUpperCase() + ":\n";
                        msg += print_hit_table(burst["damage frames"][0]["frame times"], burst["damage frames"][0]["hit dmg% distribution"]);
                        //print tables for bursts with multiple attacks
                        try {
                            var multi_attack_burst = ["1", "64", "47", "13", "14", "29", "97"];
                            for (i = 1; i < burst["damage frames"].length; ++i) {
                                proc = burst["damage frames"][i]["proc id"];
                                if (multi_attack_burst.indexOf(proc) > -1) {
                                    msg += print_hit_table(burst["damage frames"][i]["frame times"], burst["damage frames"][i]["hit dmg% distribution"]);
                                }
                            }
                        } catch (err) {
                            console.log(err);
                        }
                    } else {
                        msg += "This unit does not have an attacking " + hit_type.toUpperCase() + "\n";
                    }
                } else {
                    msg += "This unit does not have a field for " + hit_type + "\n";
                }
            }
            return msg;
        }

        return new Promise(function(fulfill,reject){
            // fulfill([unit.name, unit.id,unit.gender]);
            common.print_debug_message(context,["Entered print_regular with",flags]);
            try {
                var numHits = unit["damage frames"]["hits"];
                var msg = "";
                let name = (unit.translated_name) ? unit.translated_name : unit.name;
                msg += unit["guide_id"] + ": " + name + " | " + unit["rarity"] + "\* | " + unit["element"] + " | " + unit["cost"] + " Cost | " + unit["gender"] + "\n";
                msg += "* " + unit["damage frames"]["hits"] + ((numHits == 1) ? " hit (" : " hits (") + (unit["drop check count"] * numHits) + "DC) | ";
                msg += "Move Speed: " + unit["movement"]["skill"]["move speed type"] + " | ";
                msg += "Move Type: " + get_unit_move_type(unit["movement"]["skill"]["move type"]) + "\n";

                var sub_point = "  |> ";
                var sub_sub_point = "  |>> ";
                if (flags.print_raw_effects) { //print raw stats
                    common.print_debug_message(context,["entered raw_effects branch"]);
                    if (!flags.print_sp && !flags.print_evo && !flags.print_arena && !flags.print_stats && flags.print_sp_skill === "" && !flags.print_hitcounts) {
                        common.print_debug_message(context, ["entered individual print branch"]);
                        if (flags.print_ls) {
                            msg += "* LS: ";
                            if (unit["leader skill"] != undefined) {
                                var ls = unit["leader skill"];
                                msg += ls["name"] + " - " + ls["desc"] + "\n";
                                for (e in ls["effects"]) {
                                    msg += "```";
                                    msg += common.print_effects(ls["effects"][e]) + "\n";
                                    msg += "```";
                                }
                            } else {
                                msg += "None\n";
                            }
                        }

                        if (flags.print_es) {
                            if (unit["extra skill"] != undefined) {
                                var es = unit["extra skill"];
                                msg += "* ES: " + es["name"] + " - " + es["desc"] + "\n";
                                msg += "```target: " + es["target"] + "\n```";
                                for (e in es["effects"]) {
                                    msg += "```";
                                    msg += common.print_effects(es["effects"][e]) + "\n";
                                    msg += "```";
                                }
                            }
                        }

                        if (flags.print_bb) {
                            if (unit["bb"] != undefined) {
                                var bb = unit["bb"];
                                msg += "* BB: " + print_burst(bb, flags.print_raw_effects, sub_point);
                            } else {
                                msg += "* BB: None\n";
                            }
                        }

                        if (flags.print_sbb) {
                            if (unit["sbb"] != undefined) {
                                msg += "* SBB: " + print_burst(unit["sbb"], flags.print_raw_effects, sub_point);
                            } else {
                                msg += "* SBB: None\n"
                            }
                        }

                        if (flags.print_ubb) {
                            if (unit["ubb"] != undefined) {
                                msg += "* UBB: " + print_burst(unit["ubb"], flags.print_raw_effects, sub_point);
                            } else {
                                msb += "* UBB: None\n"
                            }
                        }

                        if (flags.print_arena) {
                            msg += "Arena AI: ";
                            if (unit["ai"] != undefined) {
                                msg += "\n";
                                for (a in unit["ai"]) {
                                    msg += "```" + common.print_effects(unit["ai"][a]) + "\n```";
                                }
                            } else {
                                msg += "None/Data is missing\n";
                            }
                        }
                    } else {
                        common.print_debug_message(context, ["entered sp/evo/arena/etc. branch"]);
                        if (flags.print_sp) {
                            if (unit["skills"] != undefined) {
                                msg += "SP Enhancements:\n"
                                msg += print_sp(unit["skills"], false, "", "* ");
                            } else {
                                msg += "SP Enhancements: None\n";
                            }
                        } else if (flags.print_evo) {
                            if (unit["evo_mats"] != undefined) {
                                msg += unit["name"] + " needs the following material(s) to evolve\n";
                                for (mat in unit["evo_mats"]) {
                                    msg += "* " + unit["evo_mats"][mat]["name"] + " (" + unit["evo_mats"][mat]["id"] + ")\n";
                                }
                            } else {
                                msg += "This unit currently cannot evolve any further.\n";
                            }
                        } else if (flags.print_arena) {
                            msg += "Arena AI: ";
                            if (unit["ai"] != undefined) {
                                msg += "\n";
                                for (a in unit["ai"]) {
                                    msg += "```" + common.print_effects(unit["ai"][a]) + "\n```";
                                }
                            } else {
                                msg += "None/Data is missing\n";
                            }
                        } else if (flags.print_stats) {
                            msg += "```" + print_stat_table(unit) + "```";
                        } else if (flags.print_sp_skill != "") {//print sp info
                            if (unit["skills"] != undefined) {
                                msg += "SP Enhancements:\n"
                                msg += print_sp(unit["skills"], flags.print_raw_effects, "* ", sub_point, sub_sub_point, flags.print_sp_skill);
                            } else {
                                msg += "SP Enhancements: None\n";
                            }
                        } else if (flags.print_hitcounts) {//print hit count tables
                            // msg += handle_hitcount_flag(unit, flags.print_hitcount.toLowerCase());
                            msg += handle_hitcount_flag(unit,"normal");
                            var msg_arr = [msg];
                            var hit_types = ['bb','sbb','ubb'];
                            for(var i = 0; i < hit_types.length; ++i){
                                if(unit[hit_types[i]]){
                                    msg_arr.push(handle_hitcount_flag(unit,hit_types[i]));
                                }
                            }
                            fulfill(msg_arr);
                            return;
                        }
                    }
                } else {//print regular description
                    if (!flags.print_sp && !flags.p_evo && !flags.p_arena && !flags.p_stats) {
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
                            msg += print_burst(bb, flags.print_raw_effects);
                        } else {
                            msg += "None\n";
                        }

                        if (unit["sbb"] != undefined) {
                            msg += "* SBB: " + print_burst(unit["sbb"], flags.print_raw_effects);
                        }

                        if (unit["ubb"] != undefined) {
                            msg += "* UBB: " + print_burst(unit["ubb"], flags.print_raw_effects);
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
                if (common.isJapaneseText(msg)) {
                    msg += "\n\nLooks like this has some Japanese text in it. If this isn't what you wanted, try running the command again with `--translate`";
                }
                fulfill(msg);
            } catch (err) {
                console.log(err)
                fulfill("Error: " + unit["id"] + " has a problem.");
            }
        });
    }

    return new Promise(function(fulfill,reject){
        client.getUnit(unit_id)
            .then(function(unit){
                if(context.verbose){
                    console.log(unit);
                }
                if(unit.error){
                    fulfill("Error: " + unit.error);
                    return;
                }

                var print;
                if(flags.translate){
                    common.print_debug_message(context, ["Entered translation branch"]);
                    var translation = translate_unit(unit);
                    if (context.useEmbed)
                        print = translation.then(function(result){
                            if(result.translated_name) delete result.translated_name;
                            common.print_debug_message(context, ["Translated", result]);
                            return print_embed(result,flags);   
                        });
                    else
                        print = translation.then(function (result) {
                            if (result.translated_name) delete result.translated_name;
                            common.print_debug_message(context, ["Translated", result]);
                            return print_regular(result, flags);
                        });
                }else{
                    if(context.useEmbed)
                        print = print_embed(unit, flags);
                    else
                        print = print_regular(unit,flags);
                }
                print.then(fulfill).catch(reject);
            }).catch(reject);
    });
}

function print_multiple_results(results, context){
    function print_embed(result_arr, prefix){
        var embed = {
            title: 'Search Results',
            description: prefix,
            fields: []
        };

        var field_arr = [
            {
                name: "Results - Page 1"
            }
        ];
        var msg = "";
        //create first result field
        while(result_arr.length !== 0 && msg.length < 900){
            msg += result_arr.shift();
        }

        field_arr[0].value = msg;
        //hit character limit for one field, so make more
        if(result_arr.length !== 0){
            return common.create_sectional_messages(result_arr,950,4)
                .then(function(msg_arr){
                    var i;
                    //make embed fields
                    for (i = 0; i < msg_arr.length; ++i) {
                        field_arr.push({
                            name: `Results - Page ${i + 2}`,
                            value: msg_arr[i]
                        });
                    }
                    for(i = 0; i < field_arr.length; ++i){
                        embed.fields.push(field_arr[i]);
                    }
                    return embed;
                });
        }else{
            embed.fields.push(field_arr[0]);
            return embed;
        }
    }

    function print_regular(result_arr,prefix){
        var msg = prefix;
        var max = (result_arr.length < 100) ? result_arr.length : 100;
        for(var i = 0; i < max; ++i){
            msg += result_arr[i];
        }

        if(result_arr.length > max){
            msg += "...and " + (result_arr.length - max) + " more";
        }
        if(result_arr.length > 2000){
            msg += "\nAre you trying to get all of the units? Check your search options again, especially for double dashes.";
        }

        return msg;
    }


    return new Promise(function(fulfill,reject){
        client.getUnits(results)
            .then(function(results){
                var msg = results.length + " units found. Please try the command again using one of the IDs below.\n";
                var formatted_results = [];
                for(var i = 0; i < results.length; ++i){
                    let name = (results[i].translated_name) ? results[i].translated_name : results[i].name;
                    formatted_results.push(`${results[i].guide_id}: ${name} (${results[i].id})\n`);
                }

                if(context.useEmbed){
                    return print_embed(formatted_results, msg);
                }else{
                    return print_regular(formatted_results, msg + "--\n");
                }
            }).then(fulfill).catch(reject);

    });
}

function do_list_query(start, end, type, context) {
    var url = common.load_server('server_url.txt');
    if (url.length == 0) {
        console.log(err);
        throw "Error: can't open server_url.json";
    }

    var query = {
        type: (type == "unit") ? "unit_id" : "guide_id",
        verbose: context.verbose
    };
    if (start !== -1) {
        query.start = start;
    }
    if (end !== -1) {
        query.end = end;
    }


    common.print_debug_message(context, ["Sending", query, "for list_query"]);
    var options = {
        method: 'GET',
        uri: url + "/list/units?" + common.get_request_options(query)
    };

    common.print_debug_message(context, ["Sending options", options, "for list_query"]);

    return request(options).then(function(response){
        try {
            var result_arr = JSON.parse(response);
            return result_arr;
        } catch (err) {
            return ["Error: problem with server response"];
        }
    });
}
