'use strict';

const fs = require('fs');
const Clapp = require('./modules/clapp-discord');
const cfg = require('../config.js');
const pkg = require('../package.json');
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'local_bluubot> '
});

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

var app = new Clapp.App({
  name: cfg.name,
  desc: pkg.description,
  prefix: cfg.prefix,
  version: pkg.version,
  onReply: (msg, context) => {
    console.log("\nContext>",context);
    try{
      var embed_object = JSON.parse(msg);
      if (!embed_object.embed) {
        console.log("No embed defined");
        throw "No embed defined";
      }else{
        embed_object.embed.footer = {
          text: "Response time: " + new Date().getDifferenceFrom(context.startTime)
        } 
      }
      console.log("Received embed");
      console.log(JSON.stringify(embed_object));
      rl.prompt();
      return;
    }catch(err){
      //do nothing
    }
    // Fired when input is needed to be shown to the user.
    console.log("\nResponse> " + msg + "\n");
    console.log("Message length is", msg.length);
    rl.prompt();
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

//given a string, concatenate queries
//e.g. |bb unit Dark Tone -> |bb unit "Dark Tone"
function concatInput(input) {
  var arr = input.split(' ');
  var msg = arr[0] + " " + arr[1]; //take off |bb and <command>

  var midCommand = false;
  var i = 2;
  for (; i < arr.length; ++i) {
    if (arr[i].indexOf("'") != -1) {
      var aposIndex = arr[i].indexOf("'");
      if (aposIndex > 0 && arr[i].charAt(aposIndex - 1) != "\\") {
        arr[i] = arr[i].replace("'", "\\'");
      }
    }
    if (arr[i].indexOf("--") == -1) {
      if (!midCommand) {
        msg += " \"" + arr[i];
        midCommand = true;
      } else {
        msg += " " + arr[i];
      }
    } else {
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

function parseInput(msg) {
  if (app.isCliSentence(msg)) {
    //process input
    msg = concatInput(msg);
    // log_message(msg);
    app.parseInput(msg, {
      msg: msg,
      useEmbed: msg.indexOf(" --noembed") === -1,
      verbose: msg.indexOf(" --verbose") > -1,
      startTime: new Date()
    });
  } else {
    console.log("Error: Input not valid");
  }
}

// parseInput(process.argv[2]);
rl.prompt();
rl.on('line', parseInput)
  .on('close', () => {
    console.log("Closing " + __filename);
    process.exit(0);
  });