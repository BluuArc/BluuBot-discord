// 'use strict';

const fs = require('fs');
const Clapp = require('./modules/clapp-discord');
const cfg = require('../config.js');
const pkg = require('../package.json');
const Discord = require('discord.js');
const bot = new Discord.Client();

var status_index = 0;
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

var msgCounter = {
    received: 0,
    sent: 0
};

var app = new Clapp.App({
    name: cfg.name,
    desc: pkg.description,
    prefix: cfg.prefix,
    version: pkg.version,
    onReply: (msg, context) => {
        function multi_send(msg_arr) {
            function send_recursive(msg_arr, callbackFn) {
                if (msg_arr.length === 0) {
                    callbackFn();
                } else {
                    var sent_promise;
                    if (typeof msg_arr[0] === "string") {
                        sent_promise = context.msg.channel.send(msg_arr.shift(), { split: true })
                    } else {
                        sent_promise = context.msg.channel.send("", msg_arr.shift());
                    }
                    sent_promise.then(function () {
                        send_recursive(msg_arr, callbackFn);
                    }).catch(function (err) {
                        console.log(err);
                        context.channel.send("\nSorry, an error occurred trying send this message");
                        send_recursive(msg_arr, callbackFn);
                    });
                }
            }
            return new Promise(function (fulfill, reject) {
                send_recursive(msg_arr, fulfill);
            });
        }

        if (context.verbose)
            console.log(context);
        // Fired when input is needed to be shown to the user.
        try {
            var embed_object = JSON.parse(msg);
            // console.log("got embed object",msg);
            if (embed_object instanceof Array) {//send multiple messages
                if (context.verbose) {
                    console.log("Sending array", embed_object);
                }
                var sent_promise;
                if (typeof embed_object[0] === "string") {
                    sent_promise = context.msg.reply(embed_object.shift());
                } else {
                    sent_promise = context.msg.reply("\nIssues viewing the embed(s)? Try adding `--noembed` to the end of your previous command for a text-only version.", embed_object.shift())
                }
                sent_promise.then(function (response) {
                    msgCounter.sent++;
                    // console.log(embed_object);
                    if (embed_object.length > 0)
                        return multi_send(embed_object);
                    else
                        return;
                }).catch(console.log);
                return;
            } else if (!embed_object.embed) { //should be an embed object
                console.log("No embed defined");
                throw "No embed defined";
            } else {
                if (embed_object.embed.footer) {
                    embed_object.embed.footer.text = "Response time: " + new Date().getDifferenceFrom(context.startTime);
                } else {
                    embed_object.embed.footer = {
                        text: "Response time: " + new Date().getDifferenceFrom(context.startTime)
                    };
                }
                if (context.verbose)
                    console.log("Sending embed object", embed_object);
                // context.msg.channel.send(embed_object);
                context.msg.reply("\nIssues viewing the embed below? Try adding `--noembed` to the end of your previous command for a text-only version.", embed_object)
                    .then(function (bot_response) {
                        msgCounter.sent++;
                    }).catch(function (err) {
                        console.log(err);
                        context.msg.reply("\nSorry, an error occurred trying to get the embed object, probably due to one of the output fields being too long. Try again with `--noembed` if applicable");
                    });
            }
            return;
        } catch (err) {
            //do nothing
        }

        var reply;
        if (context.messageToEdit && context.newMessage) {
            reply = context.messageToEdit.then(function (msg) {
                return msg.edit('\n' + context.newMessage);
            }).catch(function () {
                console.log(err);
                context.msg.channel.send('\nSorry, but an error occurred while trying to process your command');
            });
        } else {
            if (context.msg.content.indexOf('about --uptime') > -1) {
                reply = context.msg.reply('\n' + msg + `\nCommands Received: ${msgCounter.received}, Responses Sent: ${msgCounter.sent + 1} (including this one)`, { split: true });
            } else {
                reply = context.msg.reply('\n' + msg, { split: true })
                    .catch(err => {
                        console.log(err);
                        // context.msg.channel.send('\nSorry, but an error occurred while trying to process your command');
                    });
            }
        }

        reply.then(bot_response => {
            if (context.verbose) {
                console.log("Successfully sent message");
            }
            msgCounter.sent++;
            if (cfg.deleteAfterReply.enabled) {
                context.msg.delete(cfg.deleteAfterReply.time)
                    .then(msg => console.log(`Deleted message from ${msg.author}`))
                    .catch(console.log);
                bot_response.delete(cfg.deleteAfterReply.time)
                    .then(msg => console.log(`Deleted message from ${msg.author}`))
                    .catch(console.log);
            }
        }).catch(err => {
            console.log(err);
            context.msg.channel.send('\nSorry, but an error occurred while trying to process your command');
        });
    }
});

// Load every command in the commands folder
fs.readdirSync('./lib/commands/').forEach(file => {
    app.addCommand(require("./commands/" + file));
});

//convert a date object to the following format
//yyyy-mm-dd hh:mm:ss
function get_formatted_date(date) {
    function get_formatted_num(num, expected_length) {
        var str = "";
        var num_str = num.toString();
        var num_zeros = expected_length - num_str.length;
        for (var i = 0; i < num_zeros; ++i) {
            str += '0';
        }
        str += num_str;
        return str;
    }
    var msg = get_formatted_num(date.getFullYear(), 4) + "-";
    msg += get_formatted_num(date.getMonth() + 1, 2) + "-";
    msg += get_formatted_num(date.getDate(), 2) + " ";
    msg += get_formatted_num(date.getHours(), 2) + ":";
    msg += get_formatted_num(date.getMinutes(), 2) + ":";
    msg += get_formatted_num(date.getSeconds(), 2);
    return msg;
}

function update_status(curIndex) {
    var msg = ["translate with --translate",
        "try unit --print_help",
        "try unit --search_help",
        "try unit --list_help",
        "try unit --about",
        "try item --print_help",
        "try item --search_help",
        "try unit --help",
        "try item --help",
        "try |bb about",
        "try aboout --uptime",
        "try |bb bfdb for DB info",
        "unit and item search",
        "send commands over PM",
        "making fancy embeds",
        "squashing bugs"];

    if (curIndex >= msg.length) {
        curIndex = 0;
    }

    bot.user.setGame(msg[curIndex]);
    return curIndex + 1;
}

function log_message(msg) {
    var log_contents = "";
    try {
        log_contents += "[" + get_formatted_date(new Date(msg.createdTimestamp)) + "] ";
    } catch (err) {
        console.log(err);
        console.log("Error reading messaage time stamp");
        log_contents += "[" + get_formatted_date(new Date()) + "] ";
    }

    if (msg.channel.type !== "dm") {
        try {
            log_contents += msg.channel.guild.name;
        } catch (err) {
            console.log(err);
            console.log("Error reading guild name");
            log_contents += "Some Server";
        }
        log_contents += "/";

        try {
            log_contents += msg.channel.name;
        } catch (err) {
            console.log(err);
            console.log("Error reading channel name");
            log_contents += "Some Channel";
        }
        log_contents += "->";
    } else {
        log_contents += "DM->";
    }

    try {
        log_contents += msg.author.username;
    } catch (err) {
        console.log(err);
        console.log("Error reading username");
        log_contents += "Some Username";
    }
    log_contents += ": ";

    try {
        log_contents += msg.content;
    } catch (err) {
        console.log(err);
        console.log("Error reading message contents");
        log_contents += "Some command";
    }

    console.log(log_contents);

}

//given a string, concatenate queries
//also convert l to list and p to print
//e.g. |bb unit Dark Tone -> |bb unit "Dark Tone"
function cleanInput(input) {
    var arr = input.split(' ');
    var msg = arr[0] + " " + arr[1]; //take off |bb and <command>

    var midCommand = false;
    var i = 2;
    for (; i < arr.length; ++i) {
        //escape any existing parentheses
        if (arr[i].indexOf("'") !== -1) {
            var aposIndex = arr[i].indexOf("'");
            if (aposIndex > 0 && arr[i].charAt(aposIndex - 1) != "\\") {
                arr[i] = arr[i].replace("'", "\\'");
            }
        }

        //we haven't reached another command, so keep concatenating
        if (arr[i].indexOf("--") == -1) {
            if (!midCommand) {
                msg += " \"" + arr[i];
                midCommand = true;
            } else {
                msg += " " + arr[i];
            }
        } else {//found a command
            //convert l to list and p to print
            if (arr[i].indexOf("--l_") > -1) {
                arr[i] = arr[i].replace("--l_", "--list_");
            } else if (arr[i].indexOf("--p_") > -1) {
                arr[i] = arr[i].replace("--p_", "--print_");
            }

            // if (arr[i].indexOf("hitcount") > 1 && arr[i].indexOf("hitcounts") === -1) {
            //     arr[i] = arr[i].replace("hitcount", "hitcounts");
            // }
            if (midCommand) {
                msg += "\"";
                midCommand = false;
            }
            msg += " " + arr[i];
        }
    }
    //close query, if necessary
    if (midCommand) {
        msg += "\"";
    }

    return msg;
}

function onlySingleCommandsPresent(msg) {
    let parts = msg.split(' ');
    let knownCommands = [];
    for (let p of parts) {
        if (p.indexOf('--') === 0) { // found a command
            let command = p.split('--')[1];
            if (knownCommands.indexOf(command) === -1) {
                knownCommands.push(command);
            } else {
                return false;
            }
        }
    }
    return true;
}

bot.on('message', msg => {
    // console.log(msg);
    // Fired when someone sends a message
    // Disabled for now
    // if(msg.content.toLowerCase() == "nice"){
    //   msg.channel.send("job");
    // }

    // if(msg.content.toLowerCase() == "cool"){
    //   msg.channel.send("cool cool cool");
    // }

    if (app.isCliSentence(msg.content)) {
        msgCounter.received++;
        //process input
        msg.content = cleanInput(msg.content);
        log_message(msg);
        if(onlySingleCommandsPresent(msg.content)){
            app.parseInput(msg.content, {
                msg: msg,
                useEmbed: msg.content.indexOf(" --noembed") === -1,
                verbose: msg.content.indexOf(" --verbose") > -1,
                startTime: new Date()
            });
        }else{
            msg.reply("\nError: Please enter each command only once (e.g. don't use `--p_sp_skill` more than once in one message)");
        }
    }
});

bot.login(cfg.token).then(() => {
    console.log('Running!');
    console.log("Waiting for messages");
    var interval = 30 * 1000; //update every 30 seconds

    status_index = update_status(status_index);

    // bot.user.setGame("learning to translate");
    setInterval(function () {
        status_index = update_status(status_index);
    }, interval);
});
