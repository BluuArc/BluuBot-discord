'use strict';

const fs      = require('fs');
const Clapp   = require('./modules/clapp-discord');
const cfg     = require('../config.js');
const pkg     = require('../package.json');
const Discord = require('discord.js');
const bot     = new Discord.Client();

var app = new Clapp.App({
  name: cfg.name,
  desc: pkg.description,
  prefix: cfg.prefix,
  version: pkg.version,
  onReply: (msg, context) => {
    // Fired when input is needed to be shown to the user.

    context.msg.reply('\n' + msg).then(bot_response => {
      if (cfg.deleteAfterReply.enabled) {
        context.msg.delete(cfg.deleteAfterReply.time)
          .then(msg => console.log(`Deleted message from ${msg.author}`))
          .catch(console.log);
        bot_response.delete(cfg.deleteAfterReply.time)
          .then(msg => console.log(`Deleted message from ${msg.author}`))
          .catch(console.log);
      }
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

bot.on('message', msg => {
  // console.log(msg);
  // Fired when someone sends a message
  if(msg.content.toLowerCase() == "nice"){
    msg.channel.send("job");
  }

  if (app.isCliSentence(msg.content)) {
    var log_contents = "";
    log_contents += "[" + get_formatted_date(new Date(msg.createdTimestamp)) + "] ";
    log_contents += msg.channel.guild.name + "/" + msg.channel.name + "->" + msg.author.username + ": " + msg.content;

    console.log(log_contents);

    app.parseInput(msg.content, {
      msg: msg
      // Keep adding properties to the context as you need them
    });
  }
});

bot.login(cfg.token).then(() => {
  console.log('Running!');
  console.log("Waiting for messages");
  bot.user.setGame("learning to translate");
});
