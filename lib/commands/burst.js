var Clapp = require('../modules/clapp-discord');
var request = require('request-promise');
var fs = require('fs');
var translate = require('google-translate-api');
var client = require('../modules/BFDBReader-node/data_tier_client.js');
var common = require('../modules/Bluubot-common');
let ep;

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
        desc: 'Print the translation from Japanese to English of an brave burst. Uses Google Translate API.',
        type: 'boolean',
        internal_type: "print",
        default: false
    },
    {
        name: 'print_effects',
        desc: 'Print the effect(s) of an brave burst',
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
    desc: "returns a brave burst based on input; use es --search_help and es --print_help for more info",
    args: command_args,
    flags: command_flags,
    fn: (argv, context) => {
        try{
            return new Promise(function(fulfill,reject){
                fulfill("Not implemented yet");
            });
        }catch(err){
            console.log("Burst Command Error:\n",err);
            return "Error trying to process burst command";
        }
    }
})