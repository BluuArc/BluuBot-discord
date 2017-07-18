//contains all the common functions between modules/commands
var fs = require('fs');
var request = require('request-promise');
var translate = require('google-translate-api');
let EffectPrinter = require('../BFDBReader-node/effect_printer.js');


function common_library(){
    //custom print help function
    function print_help(header, internal_type, footer, command_flags) {
        let msg = header;
        for (let f in command_flags) {
            let curFlag = command_flags[f];
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
    this.print_help = print_help;

    function print_debug_message(context, msg_arr) {
        if (context.verbose) {
            for (let i = 0; i < msg_arr.length; ++i)
                console.log(msg_arr[i]);
        }
    }
    this.print_debug_message = print_debug_message;

    function initialize_client(client){
        try {
            var url = fs.readFileSync('server_url.txt');
            client.setAddress(url);
        } catch (err) {
            console.log(err);
        }
    }
    this.initialize_client = initialize_client;

    function create_sectional_messages_regular(data_arr, msg_len, acc_limit) {
        var msg_arr = [];
        var curMsg = "";
        var local_data = data_arr.slice();
        //process all the data
        while (local_data.length > 0) {
            //reached msg limit, push curMsg
            if (curMsg.length + local_data[0].length > msg_len) {
                //reached accumulator limit, stop
                if (msg_arr.length === acc_limit - 1) {
                    curMsg += `...and ${local_data.length} more.`;
                    msg_arr.push(curMsg);
                    curMsg = "";
                    break;
                } else {
                    msg_arr.push(curMsg);
                    curMsg = "";
                }
            } else { //keep adding to curMsg
                curMsg += local_data.shift();
            }
        }

        //push curMsg if anything remains
        if (curMsg.length > 0) {
            msg_arr.push(curMsg);
        }

        return msg_arr;
    }
    this.create_sectional_messages_regular = create_sectional_messages_regular;

    //given a data array, create an array of messages no longer than the specified length
    //promisified for compatibility with code that uses old promisified version
    function create_sectional_messages(data_arr,msg_len,acc_limit){
        return Promise.resolve(create_sectional_messages_regular(data_arr,msg_len,acc_limit));
    }
    this.create_sectional_messages = create_sectional_messages;

    //legacy load_server function
    function load_server(server_file) {
        try {
            var url = fs.readFileSync('server_url.txt');
            return url;
        } catch (err) {
            console.log(err);
            return "";
        }
    }
    this.load_server = load_server;

    //legacy get_request_options
    function get_request_options(query) {
        var result = "";
        for (var q in query) {
            result += `${q}=${query[q].toString()}&`;
        }
        return result;
    }
    this.get_request_options = get_request_options;


    function print_array(arr) {
        var text = "[";

        for (var i = 0; i < arr.length; ++i) {
            if (arr[i] instanceof Array) text += print_array(arr[i]);
            else if (arr[i] instanceof Object) text += JSON.stringify(arr[i]); //most likely a JSON object
            else text += arr[i];

            if (i !== arr.length - 1)
                text += ",";
        }

        text += "]";
        return text;
    }
    this.print_array = print_array;

    function print_effects(effects) {
        var text_arr = [];
        //convert each effect into its own string
        for (var param in effects) {
            if (param !== "passive id" && param !== "effect delay time(ms)\/frame") {
                var tempText = effects[param];
                if (effects[param] instanceof Array) tempText = print_array(effects[param]); //parse array
                else if (effects[param] instanceof Object) tempText = JSON.stringify(effects[param]); //parse JSON object
                text_arr.push(`${param}: ${tempText}`);
            }
        }

        //convert array into a single string
        var text = text_arr.join(" / ");
        return text;
    }
    this.print_effects = print_effects;
    function isJapaneseText(name) {
        return name.search(/[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/) > -1;
    }
    this.isJapaneseText = isJapaneseText;

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
    function translate_object(unit) {
        //recursively translate all fields
        function translate_object_recursive(object, levels) {
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
                    promises = promises.concat(translate_object_recursive(object, local_levels));
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
        var promises = translate_object_recursive(new_unit, []);
        return Promise.all(promises)
            .then(function (translated_objects) {
                for (var r in translated_objects) {
                    merge_field(new_unit, translated_objects[r]);
                }
                return new_unit;
            });
    }
    this.translate_object = translate_object;

    //check if a URL exists
    function doesLinkExist(url){
        var options = {
            method: 'GET',
            uri: url
        };

        return new Promise(function(fulfill,reject){
            request(options).then(function(result){
                fulfill(true);
            }).catch(function(err){
                fulfill(false);
            });
        });
    }
    this.doesLinkExist = doesLinkExist;

    function getServerUrl(server){
        var servers = {
            "eu": "http://static-bravefrontier.gumi-europe.net/content/",
            "gl": "http://2.cdn.bravefrontier.gumi.sg/content/",
            "jp": "http://cdn.android.brave.a-lim.jp/",
        };
        return servers[server];
    }
    this.getServerUrl = getServerUrl;

    function createFieldsArray(title,prefix, data_arr){
        var curMsg = prefix;

        var msg_max = (950 - prefix.length < 900) ? (950-prefix.length) : 900;
        var msg_arr = create_sectional_messages_regular(data_arr,msg_max,5);
        
        var field_arr = [];
        field_arr.push({
            name: (msg_arr.length > 1) ? `${title} - 1` : title ,
            value: prefix + msg_arr[0]
        });
        if(msg_arr.length > 1){
            for(let m = 1; m < msg_arr.length; ++m){
                field_arr.push({
                    name: `${title} - ${m+1}`,
                    value: msg_arr[m]
                });     
            }
        }
        return field_arr;
    }
    this.createFieldsArray = createFieldsArray;

    //wrapper for constructor of effect printer
    function initializeEffectPrinter(client, verbose){
        let ep = new EffectPrinter({}, {
            verbose: verbose,
            client: client
        });

        return ep.init().then(function(){
            return ep;
        });
    }    
    this.initializeEffectPrinter = initializeEffectPrinter;

    //check if a given buff translation is incomplete or has an error
    function buffTranslationNotComplete(msg){
        let local_msg = msg.toLowerCase();
        let keywords = ['unknown', '?', 'not supported', 'error', 'no valid data found'];
        let inComplete = false;
        //search for keywords
        for(let k of keywords){
            if(local_msg.indexOf(k) > -1){
                inComplete = true;
                break;
            }
        }
        return inComplete;
    }
    this.buffTranslationNotComplete = buffTranslationNotComplete;

    function printJSON(target, fields){
        let finalTarget = target;
        if(fields && fields.length > 0){
            try{
                let localFields = fields.slice();
                let curField;
                while(finalTarget !== undefined && localFields.length > 0){
                    curField = localFields.shift();
                    finalTarget = finalTarget[curField];
                }
            }catch(err){
                finalTarget = undefined;
            }
        }

        try{
            let json = JSON.stringify(finalTarget, null, 2).split('\n').map((d) => { return `${d}\n`; });
            return create_sectional_messages_regular(json, 1750,5).map((d) => { return "```" + d + "```\n"; });
        }catch(err){
            if(!finalTarget){
                return "No target object specified";
            }else{
                return `No property ${fields} found in object`;
            }
        }
        
    }
    this.printJSON = printJSON;
}

module.exports = new common_library();