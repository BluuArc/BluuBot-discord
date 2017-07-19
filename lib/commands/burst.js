var Clapp = require('../modules/clapp-discord');
var request = require('request-promise');
var fs = require('fs');
var translate = require('google-translate-api');
var Table = require('easy-table');
var client = require('../modules/BFDBReader-node/data_tier_client.js');
var common = require('../modules/Bluubot-common');
let BuffProcessor = require('../modules/BFDBReader-node/buff_processor.js');
let ep, bp;

var command_args = [
    {
        name: 'name',
        desc: 'search for a brave burst based on a given name or id; * is considered a wildcard',
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
        desc: 'Print the translation from Japanese to English of a brave burst. Uses Google Translate API.',
        type: 'boolean',
        internal_type: "print",
        default: false
    },
    {
        name: 'print_effects',
        desc: 'Print the raw JSON effect(s) of a brave burst',
        type: 'boolean',
        internal_type: "print",
        default: false
    },
    {
        name: 'print_hitcounts',
        desc: 'Print the hitcount table of a brave burst, if applicable',
        type: 'boolean',
        internal_type: "print",
        default: false
    },
    {
        name: 'print_procs',
        desc: 'Print the proc info of a brave burst',
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
        name: 'desc',
        desc: 'search based an brave burst\'s description',
        type: 'string',
        internal_type: "search",
        default: '*'
    },
    {
        name: 'effects',
        desc: 'search based an brave burst\'s effects (raw JSON)',
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
        name: 'list_help',
        desc: 'tells you stuff about listing info',
        type: 'boolean',
        internal_type: "help",
        default: false
    },
    {
        name: 'list_start',
        desc: 'starting value for listing IDs; -1 is default',
        type: 'number',
        internal_type: "list",
        default: -1
    },
    {
        name: 'list_end',
        desc: 'ending value for listing IDs; -1 is default',
        type: 'number',
        internal_type: "list",
        default: -1
    },
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
            desc: "lists information on searching ES"
        },
        {
            name: "print_help",
            desc: "lists information on printing ES"
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
    name: "burst",
    desc: "returns a brave burst based on input; use es --search_help and es --print_help for more info; only works for non-unit brave bursts",
    args: command_args,
    flags: command_flags,
    fn: (argv, context) => {
        try{
            return new Promise(function(fulfill,reject){
                //help commands
                if (argv.flags.print_help || argv.flags.search_help || argv.flags.list_help) {
                    var header = "";
                    var footer = "";
                    var internal_type = "";
                    if (argv.flags.print_help) { //print info about printing info
                        header = "There are a few commands related to printing brave burst info.\n---\n";
                        internal_type = "print";
                        footer += "\nSome of the commands can be chained together, but if the combined result passes the character limit, nothing is shown.\n";
                        // footer += "Example: `|bb item heaven's edge --p_effects` prints out the effects of Heaven's Edge\n";
                    } else if (argv.flags.search_help) { // print search info
                        header = "There are a few commands related to searching brave burst info.\n---\n";
                        internal_type = "search";
                        footer = "\nFor all of these (and the first argument of the burst command where you input the name), the asterisk can be used as a wildcard\n";
                        // footer += "Example: `|bb item --type ls_sphere` prints out all of the LS spheres you can use in SArc.\n";
                    } else if (argv.flags.list_help) {
                        header = "There are a few commands related to listing ES info.\n---\n";
                        internal_type = "list";
                        footer = "\nYou only need to specify either `list_start` or `list_end` for the command to activate; both can be used together.\n";
                        // footer += "Example: `|bb item --list_start 20000 --list_end 30000` prints all items whose ID is between 20000 and 30000 inclusively.\n";
                        // footer += "Example: `|bb item --l_start 50000` lists all the items whose ID is greater than or equal to with 50000.";

                    }
                    fulfill(common.print_help(header, internal_type, footer, command_flags));
                    return;
                }//end help

                if (argv.flags.list_start !== -1 || argv.flags.list_end !== -1) {
                    var list_query = do_list_query(argv.flags.list_start, argv.flags.list_end, context)
                        .catch(function (err) {
                            console.log("Error in list_query:", err);
                            fulfill("Error: can't connect to database server");
                        });

                    var list_process = list_query.then(function (results) {
                        if (results) {
                            var formatted_results = results.map(function (d) {
                                return `${d}\n`;
                            });

                            if (context.useEmbed) {
                                return common.create_sectional_messages(formatted_results, 900, 5)
                                    .then(function (msg_arr) {
                                        var embed = {
                                            title: "Listing results",
                                            description: `${formatted_results.length} bursts found. Please try the command again using one of the IDs below.`,
                                            fields: []
                                        };
                                        if (msg_arr.length > 0) {
                                            for (var i = 0; i < msg_arr.length; ++i) {
                                                embed.fields.push({
                                                    name: `Results - ${i + 1}`,
                                                    value: msg_arr[i]
                                                });
                                            }
                                        } else {
                                            embed.description = "No burst found with your parameters.";
                                        }

                                        return embed;

                                    }).catch(function (err) {
                                        console.log("List error", err);
                                        reject(err);
                                    });
                            } else {
                                if (formatted_results.length > 0) {
                                    msg = `${formatted_results.length} burst found. Please try the command again using one of the IDs below.\n---\n`;
                                    var u = 0;
                                    var max = (formatted_results.length < 100) ? formatted_results.length : 100;
                                    for (u = 0; u < max; ++u) {
                                        msg += formatted_results[u];
                                    }

                                    if (formatted_results.length > max) {
                                        var diff = formatted_results.length - u;
                                        msg += "...and " + diff + ((diff == 1) ? " other" : " others");
                                        if (diff > 20000) {
                                            msg += "\nAre you trying to get all of the bursts? Check your search options again, especially for double dashes.";
                                        }
                                    }
                                }
                                return Promise.resolve(msg);
                            }
                        } else {
                            reject("Problem with data");
                        }
                    }).catch(function (err) {
                        console.log("Error with list_process", err);
                        reject(err);
                    });

                    var list_post = list_process.then(function (msg) {
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

                //print and search commands
                var search_results = common.initializeEffectPrinter(client, context.verbose).then(function (new_ep) {
                    ep = new_ep;
                    bp = ep.buff_processor;
                    return Promise.resolve(search_bbs(argv.args.name, argv.flags, context))
                }).catch(function (err) {
                    console.log("Error in search_results", err);
                    fulfill("Error: can't connect to database server");
                });

                var process_results = search_results.then(function (results) {
                    common.print_debug_message(context, ["reached process_results with", results]);
                    if (results === undefined || results.length === 0) {
                        fulfill("No brave burst found with those parameters");
                        return;
                    } else if (results.length === 1) {
                        return print_burst(results[0], argv.flags, context);
                    }else if(results.length >= 20000 && argv.flags.print_procs){
                        return print_procs();
                    } else {
                        return print_multiple_results(results, context);
                    }
                }).catch(function (err) {
                    console.log("Error with process_results:", err);
                    fulfill("Error with processing results.");
                });

                var print_results = process_results.then(function (msg) {
                    common.print_debug_message(context, ["reached print_results with", msg, "useEmbed", context.useEmbed]);
                    if (msg === undefined) {
                        fulfill("No ES found with those parameters");
                    }
                    if ((context.useEmbed && (typeof msg).toLowerCase() === "object") || msg instanceof Array) {
                        fulfill(JSON.stringify(msg));
                    } else {
                        fulfill(msg);
                    }
                }).catch(function (err) {
                    console.log("Error with print_results:", err);
                    fulfill("Error with printing results");
                });
            });
        }catch(err){
            console.log("Burst Command Error:\n",err);
            return "Error trying to process burst command";
        }
    }
});

function do_list_query(start, end, context) {
    var url = common.load_server('server_url.txt');
    if (url.length == 0) {
        console.log(err);
        throw "Error: can't open server_url.txt";
    }

    var query = {
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
        uri: url + "/list/bbs?" + common.get_request_options(query)
    };

    return request(options).then(function (response) {
        try {
            var result_arr = JSON.parse(response);
            return result_arr;
        } catch (err) {
            return ["Error: problem with server response"];
        }
    });
}

//print all procs
function print_procs(){
    let msg = "All currently translated buffs:\n";
    let buff_list = bp.buff_list;
    let count = 0;
    for(let b in buff_list){
        msg += `**${b}:**\n`
        for(let entry in buff_list[b]){
            count++;
            msg += ` * ${buff_list[b][entry].desc} (${entry})\n`;
        }
        if(count === 0){
            msg += " * None\n";
        }
        count = 0;
    }
    return msg;
}

function search_bbs(name,other_queries,context){
    //replace wildcards with empty strings
    function get_query_value(query_value) {
        return (query_value == "*" || query_value === undefined) ? "" : query_value;
    }
    //check for ES ID
    try {
        if (name !== undefined && name.toString().length > 0 && !isNaN(name)) {
            var id = parseInt(name);
            return [id];
        }
    } catch (err) {
        //don't do anything, just do a regular search
    }

    var query = {
        name_id: get_query_value(name),
        desc: get_query_value(other_queries.desc),
        effects: get_query_value(other_queries.effects),
        server: get_query_value(other_queries.server),
        translate: get_query_value(other_queries.translate),
        verbose: context.verbose
    };

    common.print_debug_message(context, ["searching with", query]);
    return client.searchBraveBurst(query);
}

//print an array of results
function print_multiple_results(results, context) {
    function print_embed(result_arr, prefix) {
        var embed = {
            title: 'Search Results',
            description: prefix,
            fields: []
        };

        var field_arr = common.createFieldsArray("Results", "", result_arr);
        for (let f = 0; f < field_arr.length; ++f) {
            embed.fields.push(field_arr[f]);
        }

        // embed.fields.push(field_arr[0]);
        embed.fields.push({
            name: "Search Help",
            value: "Not sure how to search? Try `--search_help` to see more filter options"
        });

        return {
            embed: embed
        };
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
        if (result_arr.length > 20000) {
            msg += "\nAre you trying to get all of the ES? Check your search options again, especially for double dashes.";
        }

        return msg;
    }


    return new Promise(function (fulfill, reject) {
        client.getBraveBursts(results)
            .then(function (results) {
                var msg = results.length + " bursts found. Please try the command again using one of the IDs below.\n";
                var formatted_results = [];
                for (var i = 0; i < results.length; ++i) {
                    let name = (results[i].translated_name) ? results[i].translated_name : results[i].name;
                    formatted_results.push(`${name} (${results[i].id})\n`);
                }

                if (context.useEmbed) {
                    return print_embed(formatted_results, msg);
                } else {
                    return print_regular(formatted_results, msg + "--\n");
                }
            }).then(fulfill).catch(reject);
    });
}

function print_burst(burst_id,flags,context){
    function print_burst_dc_info(burst) {
        var msg = "";
        try {
            var endLevel = burst.levels[burst.levels.length - 1];

            var numHits = burst["damage frames"][0].hits;
            var dc = numHits * burst["drop check count"];
            var proc = burst["damage frames"][0]["proc id"];
            //check for non-attacking burst
            let attacking_procs = ['1', '13', '14', '27', '28', '29', '47', '61', '64', '75', '11000'];
            let attacking_unknown_procs = ['46', '48', '97'];
            if (attacking_procs.indexOf(proc) === -1 && attacking_unknown_procs.indexOf(proc) === -1) {
                numHits = 0;
            }
            msg += "(" + endLevel["bc cost"] + "BC/" + numHits + "hits/" + dc + "DC) ";
        } catch (err) {
            console.log(err);
            msg = "None";
        }
        return msg;
    }
    function print_hit_table(timing_array, distribution_array) {
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

        //put data set onto table
        data.forEach(function (hit) {
            table.cell('Hit#', hit.num);
            table.cell('Frame#', hit.timing);
            table.cell('DMG%/hit', hit.distribution);
            table.cell('Time Diff', hit.diff);
            table.newRow();
        })

        let fields = common.create_sectional_messages_regular(table.toString().split("\n").map((m) => { return `${m}\n`;}),900).map((m) => { return "```" + m + "```\n"; });
        return fields;
    }

    function print_embed(burst,flags){
        let burst_name = (burst.translated_name) ? (`${burst.translated_name} (${burst.id})`) : (`${burst.name} (${burst.id})`);
        return new Promise(function(fulfill,reject){
            let embed = {
                title: burst_name,
                fields: []
            };
            let extra_commands = [];
            let notes = [];
            let endLevel = burst.levels[burst.levels.length - 1];

            //general info
            embed.description = "Availability: " + burst.server.join(", ").toUpperCase();
            if (burst.translated_name) {
                embed.description += `\nOriginal Name: ${burst.name}`;
            }

            embed.fields.push({
                name: "Description",
                value: burst.desc || "None"
            });

            let data_promise;
            if(flags.print_hitcounts){ //placeholder for any future features
                let attacking_procs = ['1', '13', '14', '27', '28', '29', '47', '61', '64', '75', '11000'];
                let attacking_unknown_procs = ['46', '48', '97'];
                let tables_arr = [];
                for(let d of burst['damage frames']){
                    console.log(d);
                    let id = d['proc id'] || d['unknown proc id'];
                    if(attacking_procs.indexOf(id) > -1 || attacking_unknown_procs.indexOf(id) > -1){
                        let table_fields = print_hit_table(d['frame times'], d['hit dmg% distribution']);
                        tables_arr.push(table_fields);
                    }
                }

                if(tables_arr.length > 0){
                    for (let atk = 0; atk < tables_arr.length; ++atk) {
                        let middle = (tables_arr.length > 1) ? `: Attack #${atk + 1}` : "";
                        let table_fields = common.createFieldsArray(`Hitcount Table${middle}`, "", tables_arr[atk]);
                        for (let t of table_fields) {
                            embed.fields.push(t);
                        }
                    }
                }else{
                    embed.fields.push({
                        name: "Hitcount Tables",
                        value: "No attack data found"
                    });
                }
                data_promise = Promise.resolve();
            }else if(flags.print_procs){
                let procs = common.analyzeObjectForValuesOf(burst,'proc id');
                let unknown_procs = common.analyzeObjectForValuesOf(burst,'unknown proc id');

                let proc_arr = [];
                for(let p of procs){
                    let curMsg = "";
                    let proc = bp.buff_list.proc[p];
                    if(proc){
                        curMsg += `* ${proc.desc} (${p})\n`
                        // curMsg += ` * Type: ${proc.type.join('/')}\n`;
                        if (proc.notes) {
                            // curMsg += ` * Notes:\n`;
                            for (let n of proc.notes) {
                                curMsg += `   - ${n}\n`;
                            }
                        }
                    }else{
                        if(unknown_procs.indexOf(p) === -1){
                            curMsg += ` * Unsupported proc (${p})\n`;
                        }
                    }
                    if(curMsg.length > 0 && proc_arr.indexOf(curMsg) === -1)
                        proc_arr.push(curMsg);
                }

                let uProc_arr = [];
                for (let p of unknown_procs) {
                    let curMsg = "";
                    let proc = bp.buff_list.unknown_proc[p];
                    if (proc) {
                        curMsg += ` * ${proc.desc} (${p})\n`
                        // curMsg += ` * Type: ${proc.type.join('/')}\n`;
                        if (proc.notes) {
                            // curMsg += ` * Notes:\n`;
                            for (let n of proc.notes) {
                                curMsg += `   - ${n}\n`;
                            }
                        }
                    } else {
                        curMsg += `Unsupported unknown proc (${p})\n`;
                    }
                    uProc_arr.push(curMsg);
                }

                let field_arr;
                if(proc_arr.length > 0){
                    field_arr = common.createFieldsArray("Proc Buffs", "",proc_arr);
                    for(let f of field_arr){
                        embed.fields.push(f);
                    }
                }

                if(uProc_arr.length > 0){
                    field_arr = common.createFieldsArray("Unknown Proc Buffs","", uProc_arr);
                    for(let f of field_arr){
                        embed.fields.push(f);
                    }
                }

                //at least one buff type exists -> add note
                //commented out for now until buff searching by type is implemented
                // if(field_arr !== undefined){
                //     let buff_types = bp.buff_types;
                //     let type_arr = [];
                //     type_arr.push("Note: These are defined by me to help in searching specific types of buffs. There's no 'official' typings for these buffs");
                //     for(let t in buff_types){
                //         type_arr.push(` * ${t}: ${buff_types[t]}\n`);
                //     }

                //     field_arr = common.createFieldsArray("Note about Buff Types","",type_arr);
                //     for(let f of field_arr){
                //         embed.fields.push(f);
                //     }
                // }

                // extra_commands.push("`--print_hitcounts` to print the hitcount data");
                data_promise = Promise.resolve();
            }else{
                let effect_arr = [];
                
                for(let e of endLevel.effects){
                    effect_arr.push("```" + common.print_effects(e) + "```\n");
                }

                let field_arr;
                if(flags.print_effects){
                    field_arr = common.createFieldsArray("Effects", "", effect_arr);
                    for (let f = 0; f < field_arr.length; ++f) {
                        embed.fields.push(field_arr[f]);
                    }
                }


                let buff_translation = ep.printBurst(burst).split(" / ").map((s) => { return `* ${s}\n`; });
                field_arr = common.createFieldsArray("Buff Translation","",buff_translation);
                for (let f = 0; f < field_arr.length; ++f) {
                    embed.fields.push(field_arr[f]);
                }

                data_promise = Promise.resolve();
            }

            data_promise.then(function () {
                if (common.isJapaneseText(JSON.stringify(embed))) {
                    extra_commands.push("Looks like this has some Japanese text in it. If this isn't what you wanted, try running the command again with `--translate`");
                }

                notes.push("* Please note that buff translations are still a work in progress and as of June 26, 2017, passive buffs aren't supported yet");

                if(!flags.print_effects){
                    extra_commands.push("`--print_effects` to print the raw JSON data");
                }

                if(!flags.print_hitcounts)
                    extra_commands.push("`--print_hitcounts` to print the hitcount data");

                if(!flags.print_procs)
                    extra_commands.push("`--print_procs` to print a proc breakdown (may occasionally contain notes about each proc)");

                if (extra_commands.length > 0) {
                    let command_fields = common.createFieldsArray("Available Commands", "", extra_commands.map((f) => { return `* ${f}\n` }));
                    for (let f of command_fields) {
                        embed.fields.push(f);
                    }
                }

                if (notes.length > 0) {
                    let note_fields = common.createFieldsArray("Notes", "", notes.map((f) => { return `${f}\n`; }));
                    for (let f of note_fields) {
                        embed.fields.push(f);
                    }
                }

                fulfill({ embed: embed });
            });
        });
    }

    function print_regular(burst,flags){
        return print_embed(burst,flags)
            .then((embed) => {
                return common.convertEmbedToText(embed.embed);
            });
    }

    return client.getBraveBurst(burst_id)
        .then(function(burst){
            common.print_debug_message(context, ["Reached print_burst with", burst]);

            if (burst.error) {
                return (`Error: ${burst.error}`);
            }

            let translation;
            if(flags.translate){
                translation = common.translate_object(burst)
                    .then((result) => {
                        if(result.translated_name) delete result.translated_name;
                        common.print_debug_message(context, ["Translated", result]);
                        return result;
                    });
            }else{
                translation = Promise.resolve(burst);
            }

            return translation.then(function(burst){
                if(context.useEmbed)
                    return print_embed(burst,flags);
                else
                    return print_regular(burst,flags);
            });
        });
}