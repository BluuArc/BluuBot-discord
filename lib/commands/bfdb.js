var Clapp = require('../modules/clapp-discord');
var request = require('request-promise');
var fs = require('fs');
var client = require('../modules/BFDBReader-node/data_tier_client.js');
var common = require('../modules/Bluubot-common');

var command_flags = [
    {
        name: 'status',
        desc: 'tells you the status of the server',
        type: 'boolean',
        internal_type: "general",
        default: false
    },
    {
        name: 'reload_db',
        desc: 'Reload the local database, if you give it the right password',
        type: 'string',
        internal_type: "reload",
        default: '*'
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
        var msg = "You can use any one of the following commands below with the `" + this.name + "` command:\n";
        for(var f in this.flags){
            var curFlag = this.flags[f];
            // console.log(curFlag);
            if(curFlag.name !== "reload_db"){
                msg += "`--" + curFlag.name;
                if (curFlag.type !== "boolean") {
                    msg += " <" + curFlag.type + ">";
                }
                msg += "`: " + curFlag.desc + "\n";
            }
        }
        msg += "\nAlternatively, you could look at the full command documentation here: " + "https://github.com/BluuArc/BluuBot-discord/blob/master/COMMANDS.md\n";
        return msg;
    }
}

Date.prototype.getDifferenceFrom = function (other) {
    var difference = new Date(this - other);
    var attributes = {
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        ms: 0
    };

    //conversion from this to milliseconds
    const constants = {
        ms: 1,
        seconds: 1000,
        minutes: 1000 * 60,
        hours: 1000 * 60 * 60,
        days: 1000 * 60 * 60 * 24
    };

    var divide = function (numerator, denominator) {
        return {
            quotient: parseInt(numerator / denominator),
            remainder: numerator % denominator
        };
    };

    //convert time in ms to various attributes
    var total = difference.getTime();
    for (var a in attributes) {
        if (total > constants[a]) {
            var results = divide(total, constants[a]);
            attributes[a] = results.quotient;
            total = results.remainder;
        }
    }

    var msg = "";
    msg += (attributes.days !== 0) ? (attributes.days.toString() + ((attributes.days !== 1) ? " days, " : " day, ")) : "";
    msg += (attributes.hours !== 0) ? (attributes.hours.toString() + ((attributes.hours !== 1) ? " hours, " : " hour, ")) : "";
    msg += (attributes.minutes !== 0) ? (attributes.minutes.toString() + ((attributes.minutes !== 1) ? " minutes, " : " minute, ")) : "";
    msg += (attributes.seconds !== 0) ? (attributes.seconds.toString() + ((attributes.seconds !== 1) ? " seconds, " : " second, ")) : "";
    msg += attributes.ms.toString() + ((attributes.ms !== 1) ? " milliseconds" : " millisecond");

    return msg;
};


common.initialize_client(client);
module.exports = new MyCommand({
    name: "bfdb",
    desc: "print out general info the Brave Frontier database this bot connects to",
    args: [],
    flags: command_flags,
    fn: (argv, context) => {
        return new Promise(function(fulfill,reject){
            // console.log(context);
            if (argv.flags.reload_db !== '*') {
                console.log("reload_db is " + argv.flags.reload_db);
                fulfill(reload_database(argv.flags.reload_db,context));
                return;
            }
            var update_time;
            client.getStatus()
                .then(function(result){
                    console.log(JSON.stringify(result));
                    var mapping = {
                        gl: "Global",
                        jp: "Japan",
                        eu: "Europe"
                    };
                    var types = [
                        "Units",
                        "Items",
                        "ES",
                        "BBs"
                    ];
                    update_time = result.last_update;
                    //get details for each field
                    var promises = [];
                    for(var m in mapping){
                        for(var t = 0; t < types.length; ++t){
                            promises.push(get_server_statistics(result[m],mapping[m],types[t]));
                        }
                    }
                    return Promise.all(promises)
                        // .catch(console.log);
                })
                .then(function(formatted_results){
                    // console.log("got formatted statistics");
                    //make embed
                    var curIndex = 0;
                    var embed = {
                        color: 3447003,
                        title: 'Database Server Statistics',
                        description: "Database was last updated with new values " + new Date().getDifferenceFrom(new Date(update_time)) + " ago.",
                        fields: []
                    };

                    for(var i = 0; i < formatted_results.length; ++i){
                        var curArr = formatted_results[i];
                        for(var j = 0; j < curArr.length; ++j){
                            embed.fields.push(curArr[j]);
                        }
                    }
                    // console.log("showing statistics");
                    fulfill(JSON.stringify({embed: embed}));
                })
                .catch(function(err){
                    console.log(Object.keys(err));
                    reject(err);
                });

        })
    }
});

//server_stats - contains number of units/items and list of newest/items
//server_name - name of the server to use in the message
//type - Units or Items
//returns an array of field objects (each contains name and value)
function get_server_statistics(server_stats, server_name, type){
    var newest = server_stats["newest_" + type.toLowerCase()];
    var msg = "";
    return new Promise(function(fulfill,reject){
        try{
            //print header info
            msg = server_name + " has ";
            msg += server_stats["num_" + type.toLowerCase()] + " " + type + ". ";
            if (newest.length > 0 && newest.length !== server_stats["num_" + type.toLowerCase()])
                msg += "The " + newest.length + " new " + type.toLowerCase() + " are:\n";
            else{
                msg += "There are " + newest.length + " new " + type.toLowerCase() + ".";
                fulfill([
                    {
                        name: server_name + " Server - " + type,
                        value: msg
                    }
                ]);
                return;
            }
        }catch(err){
            console.log(err);
            reject("Error trying to get server_statistics with [" + " " + server_stats + " " + server_name + " " + type + "]");
            return;
        }

        //get list of new stuff
        var field_arr = [
            {
                name: server_name + " Server - " + type
            }
        ];
        var parsed_newest;
        if(type === "Units"){
            parsed_newest = client.getUnits(newest);
        }else if(type === "Items"){
            parsed_newest = client.getItems(newest);
        }else if(type === "ES"){
            parsed_newest = client.getExtraSkills(newest);
        } else if(type === "BBs"){
            parsed_newest = client.getBraveBursts(newest);
        }else{
            msg += "Error: Unknown type " + type;
            field_arr[0].value = msg;
            fulfill(field_arr);
            return;
        }
        parsed_newest.then(function (results) {
            var parsed_results = [];
            for (var i = 0; i < results.length; ++i) {
                let name = (results[i].translated_name) ? results[i].translated_name : results[i].name;
                parsed_results.push(name + " (" + results[i].id + ")\n");
            }

            while (parsed_results.length !== 0 && msg.length < 900) {
                msg += parsed_results.shift();
            }

            field_arr[0].value = msg;
            //create more objects as necessary
            if (parsed_results.length !== 0) {
                common.create_sectional_messages(parsed_results, 900,2)
                    .then(function (msg_arr) {
                        for (var i = 0; i < msg_arr.length; ++i) {
                            field_arr.push({
                                name: field_arr[0].name + " - " + (i + 2),
                                value: msg_arr[i]
                            });
                        }
                        field_arr[0].name += " - 1";
                        fulfill(field_arr);
                    });
            } else {
                fulfill(field_arr);
            }
        });
    });

}

function reload_database(input,context) {
    var pass = fs.readFileSync('reload.txt', 'utf8');
    if (pass === input) {
        var url = common.load_server('server_url.txt');
        if (url.length === 0)
            return JSON.stringify({ error: "can't open server_url.txt or file is empty" });

        var options = {
            method: 'GET',
            uri: url + "/reload/"
        };
        // context.needsEdit = true;
        request(options);
        return("Started reloading process.");
        // context.messageToEdit = context.msg.reply("Reloading database...");
        // context.newMessage = "Finished reloading database.";
    } else {
        return "No.";
    }
}