var Clapp = require('../modules/clapp-discord');

var command_flags = [
    {
        name: 'uptime',
        desc: 'tells you about the uptime of the bot',
        type: 'boolean',
        default: false
    }
];

Date.prototype.getDuration = function(){
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
        minutes: 1000*60,
        hours: 1000*60*60,
        days: 1000*60*60*24
    };

    var divide = function(numerator,denominator){
        return {
            quotient: parseInt(numerator/denominator),
            remainder: numerator % denominator
        };
    };

    //convert time in ms to various attributes
    var total = this.getTime();
    for(var a in attributes){
        var results = divide(total,constants[a]);
        attributes[a] = results.quotient;
        total = results.remainder;
    }

    var msg = "";
    msg += (attributes.days !== 0) ? (attributes.days.toString() + ((attributes.days !== 1) ? " days, " : " day, ")) : "";
    msg += (attributes.hours !== 0) ? (attributes.hours.toString() + ((attributes.hours !== 1) ? " hours, " : " hour, ")) : "";
    msg += (attributes.minutes !== 0) ? (attributes.minutes.toString() + ((attributes.minutes !== 1) ? " minutes, " : " minute, ")) : "";
    msg += (attributes.seconds !== 0) ? (attributes.seconds.toString() + ((attributes.seconds !== 1) ? " seconds, " : " second, ")) : "";
    msg += attributes.ms.toString() + ((attributes.ms !== 1) ? " milliseconds" : " millisecond");

    return msg;
};

var firstStart = Date.now();

module.exports = new Clapp.Command({
    name: "about",
    desc: "print out general info about the bot",
    args: [],
    flags: command_flags,
    fn: (argv, context) => {
        if(argv.flags.uptime){
            return "This bot was last restarted " + new Date(Date.now() - firstStart).getDuration() + " ago.";
        }

        var msg = "This bot was created by BluuArc#2661. ";
        msg += "If you have any problems and/or suggestions in regard to the bot, let him know.\n";
        msg += "You can also contact him via this bot's github page: \n"
        msg += "https://github.com/BluuArc/BluuBot-discord";
        return msg;
    }
});
