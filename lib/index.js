// 'use strict';

const fs      = require('fs');
const Clapp   = require('./modules/clapp-discord');
const cfg     = require('../config.js');
const pkg     = require('../package.json');
const Discord = require('discord.js');
const bot     = new Discord.Client();

var status_index = 0;

var app = new Clapp.App({
  name: cfg.name,
  desc: pkg.description,
  prefix: cfg.prefix,
  version: pkg.version,
  onReply: (msg, context) => {
    // console.log(context);
    // Fired when input is needed to be shown to the user.
    try {
      var embed_object = JSON.parse(msg);
      // console.log("got embed object",msg);
      if(!embed_object.embed) throw "No embed defined";
      console.log("Sending embed object");
      // context.msg.channel.send(embed_object);
      context.msg.reply("",embed_object).catch(function(err){
        console.log(err);
        context.msg.reply("\nSorry, an error occurred trying to get the embed object.");
      });
      return;
    } catch (err) {
      //do nothing
    }

    var reply;
    if(context.messageToEdit && context.newMessage){
      reply = context.messageToEdit.then(function(msg){
        msg.edit('\n' + context.newMessage);
      }).catch(function(){
          console.log(err);
          context.msg.reply('\nSorry, but an error occurred while trying to process your command');
      });
    }else{
      reply = context.msg.reply('\n' + msg);
    }

    reply.then(bot_response => {
      if (cfg.deleteAfterReply.enabled) {
        context.msg.delete(cfg.deleteAfterReply.time)
          .then(msg => console.log(`Deleted message from ${msg.author}`))
          .catch(console.log);
        bot_response.delete(cfg.deleteAfterReply.time)
          .then(msg => console.log(`Deleted message from ${msg.author}`))
          .catch(console.log);
      }
    }).catch(err =>{
      console.log(err);
      context.msg.reply('\nSorry, but an error occurred while trying to process your command'); 
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

function update_status(curIndex){
  var msg = ["translate with --translate", 
    "try unit --print_help", 
    "try unit --search_help", 
    "try unit --list_help",
    "try unit --about", 
    "try item --print_help",
    "try item --search_help",
    "try unit --help",
    "try item --help",
    "unit and item search",
    "send commands over PM",
    "squashing bugs"];

    if(curIndex >= msg.length){
      curIndex = 0;
    }

    bot.user.setGame(msg[curIndex]);
    return curIndex+1;
}

function log_message(msg){
  var log_contents = "";
  try{
    log_contents += "[" + get_formatted_date(new Date(msg.createdTimestamp)) + "] ";
  }catch(err){
    console.log(err);
    console.log("Error reading messaage time stamp");
    log_contents += "[" + get_formatted_date(new Date()) + "] ";
  }

  if (msg.channel.type !== "dm"){
    try{
      log_contents += msg.channel.guild.name;
    }catch(err){
      console.log(err);
      console.log("Error reading guild name");
      log_contents += "Some Server";
    }
    log_contents += "/";

    try{
      log_contents += msg.channel.name;
    }catch(err){
      console.log(err);
      console.log("Error reading channel name");
      log_contents += "Some Channel";
    }
    log_contents += "->";
  }else{
    log_contents += "DM->";
  }

  try{
    log_contents += msg.author.username;
  }catch(err){
    console.log(err);
    console.log("Error reading username");
    log_contents += "Some Username";
  }
  log_contents += ": ";

  try{
    log_contents += msg.content;
  }catch(err){
    console.log(err);
    console.log("Error reading message contents");
    log_contents += "Some command";
  }

  console.log(log_contents);

}

//given a string, concatenate queries
//e.g. |bb unit Dark Tone -> |bb unit "Dark Tone"
function concatInput(input){
  var arr = input.split(' ');
  var msg = arr[0] + " " + arr[1]; //take off |bb and <command>

  var midCommand = false;
  var i = 2;
  for(; i < arr.length; ++i){
    if(arr[i].indexOf("'") != -1){
      var aposIndex = arr[i].indexOf("'");
      if(aposIndex > 0 && arr[i].charAt(aposIndex - 1) != "\\"){
        arr[i] = arr[i].replace("'", "\\'");
      }
    }
    if(arr[i].indexOf("--") == -1){
      if(!midCommand){
        msg += " \"" + arr[i];
        midCommand = true;
      }else{
        msg += " " + arr[i];
      }
    }else{
      if(midCommand){
        msg += "\"";
        midCommand = false; 
      }
      msg += " " + arr[i];
    }
  }
  //close query, if necessary
  if(midCommand){
    msg += "\"";
  }
  
  return msg;
}


function useEmbed(input){
  return input.indexOf(" --embed") > -1;
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
    //process input
    msg.content = concatInput(msg.content);
    log_message(msg);
    app.parseInput(msg.content, {
      msg: msg,
      useEmbed: useEmbed(msg.content)
      // Keep adding properties to the context as you need them
    });
  }
});

bot.login(cfg.token).then(() => {
  console.log('Running!');
  console.log("Waiting for messages");
  var interval = 30*1000; //update every 30 seconds

  status_index = update_status(status_index);

  // bot.user.setGame("learning to translate");
  setInterval(function(){
    status_index = update_status(status_index);
  },interval);
});
