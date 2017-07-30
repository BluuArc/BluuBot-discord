var client_local = require('./data_tier_client.js');
var fs = require('fs');
client_local.setAddress("http://127.0.0.1:8081"); //default client setup

var BuffProcessor = function (unit_names, item_names, options) {
    let no_buff_data_msg = "Message length is 0";
    options = options || {};
    unit_names = unit_names || {};
    item_names = item_names || {};
    let client = options.client || client_local;

    function debug_log() {
        if (options.verbose) {
            console.log(...arguments);
        }
    }

    function initializeNames(){
        function setNameArrays() {
            console.log("Getting new names.json");
            let units = client.searchUnit({ name_id: "" });
            let items = client.searchItem({ name_id: "" });
            return Promise.all([units, items])
                .then(function (results) {
                    let unitIDs = results[0];
                    let itemIDs = results[1];

                    let promises = [];
                    let itemCount = 0, unitCount = 0;
                    for (let unit of unitIDs) {
                        let curUnitPromise = client.getUnit(unit).then(function (unitResult) {
                            unit_names[unitResult.id.toString()] = (unitResult.translated_name || unitResult.name) + ` (${unitResult.id})`;
                            return;
                        });
                        promises.push(curUnitPromise);
                    }
                    for (let item of itemIDs) {
                        let curItemPromise = client.getItem(item).then(function (itemResult) {
                            item_names[itemResult.id.toString()] = (itemResult.translated_name || itemResult.name) + ` (${itemResult.id})`;
                            return;
                        });
                        promises.push(curItemPromise);
                    }

                    return Promise.all(promises);
                }).then(function () {
                    let names = {
                        unit: unit_names,
                        item: item_names
                    };
                    fs.writeFileSync('./names.json', JSON.stringify(names), 'utf8');
                    console.log("Wrote names.json");
                });
        }
        let loadPromise;
        try {
            if (fs.existsSync('./names.json')) {
                let names = JSON.parse(fs.readFileSync('./names.json'));
                unit_names = names.unit;
                item_names = names.item;
                loadPromise = Promise.resolve();
            } else {
                throw "No names.json found";
            }
        } catch (err) {
            loadPromise = setNameArrays();
        }
        return loadPromise;
    }
    this.initializeNames = initializeNames;

    //helper functions
    function print_effect_legacy(effects) {
        var print_array = function (arr) {
            var text = "[";

            for (var i in arr) {
                if (arr[i] instanceof Array) text += print_array(arr[i]);
                else if (arr[i] instanceof Object) text += JSON.stringify(arr[i]); //most likely a JSON object
                else text += arr[i];

                text += ",";
            }

            if (text.length > 1) {
                text = text.substring(0, text.length - 1); //remove last comma
            }

            text += "]";
            return text;
        }
        var text_arr = [];
        //convert each effect into its own string
        for (var param in effects) {
            if (param !== "passive id" && param !== "effect delay time(ms)\/frame") {
                var tempText = effects[param];
                if (effects[param] instanceof Array) tempText = print_array(effects[param]); //parse array
                else if (effects[param] instanceof Object) tempText = JSON.stringify(effects[param]); //parse JSON object
                text_arr.push("" + param + ": " + tempText);
            }
        }

        //convert array into a single string
        var i = 0;
        var text = "";
        for (i = 0; i < text_arr.length; ++i) {
            text += text_arr[i];
            if (i + 1 != text_arr.length) text += " / ";
        }
        return text + "";
    }

    function to_proper_case(input) {
        return `${input[0].toUpperCase()}${input.slice(1).toLowerCase()}`;
    }

    function get_polarized_number(number) {
        if (number < 0) return number.toString();
        else return "+" + number.toString();
    }

    function get_formatted_minmax(min, max) {
        if (min !== max) {
            if (max > 0) return min + "-" + max;
            else return min + " to " + max;
        }
        else return min || max;
    }

    function multi_param_buff_handler(options) {
        /*
        options = {
            all: array of objects with keys values and name; e.g. {value:50, name: "ATK"}
            values: array of values, can contain indices of undefined
            names: array of names for each value
            special_case: {
                isSpecialCase(value,names_array): given a value or names_array, return a bool for if params are a special case
                func(value,names_array): handle the special case and return a string
            }
            prefix(names_arr) || prefix: if function, return a formatted string for a given array of names
                if string, then this will be inserted before every value listing
            numberFn(number): special function to get a specific formatted string for a value (like returning polarity or percent with number)
            suffix(names_arr) || suffix: if function, return a formatted string for a given array of names
                if string, then this will be appended after joining of names_arr
            buff_separator: separator between buff names, default is "/"
            message_separator: separator between different value strings, default is ", "
        }
        required: all or (values and names), special_case.func if special_case.isSpecialCase() is used
        all else is optional
        */
        if (!options) throw "multi_param_buff_handler: No options defined";
        if (options.all) { //array of objects with keys value and name
            options.values = [];
            options.names = [];
            for (let i = 0; i < options.all.length; ++i) {
                let [curValue, curName] = [options.all[i]["value"], options.all[i]["name"]];
                options.values.push(curValue);
                options.names.push(curName);
            }
        }
        if (!options.values || !options.names) throw "multi_param_buff_handler: No values, names, or all array defined";

        //create a JSON object keyed by buff values
        // debug_log(options);
        let common_values = {}, msg = "";
        for (let i = 0; i < options.values.length; ++i) {
            if (options.values[i] !== undefined) { //in case some values are undefined
                let curValue = options.values[i].toString();
                if (!common_values[curValue]) {
                    common_values[curValue] = [];
                };
                //value of each key is an array of names with that shared value
                common_values[curValue].push(options.names[i]);
            }
        }

        // debug_log(common_values);

        //create a string from common_values object
        var msg_arr = []; //array of shared values
        for (let v in common_values) {
            let msg = "";
            //handle special cases
            if (options.special_case && options.special_case.isSpecialCase(v, common_values[v])) {
                msg = options.special_case.func(v, common_values[v]);
                if (msg.length > 0) msg_arr.push(msg);
                continue;
            }
            //format output according to options
            if (options.prefix) {
                if (typeof options.prefix === "function") msg += options.prefix(common_values[v]);
                else msg += options.prefix;
            }
            if (options.numberFn) msg += options.numberFn(v);
            else msg += v;
            if (typeof options.suffix === "function") msg += options.suffix(common_values[v]);
            else {
                msg += common_values[v].join(options.buff_separator || "/");
                if (typeof options.suffix === "string") msg += options.suffix;
            }
            msg_arr.push(msg);
        }

        let result_msg = "";
        result_msg += msg_arr.join(options.message_separator || ", ");
        return result_msg;
    }
    this.multi_param_buff_handler = multi_param_buff_handler;

    function hp_adr_buff_handler(hp, atk, def, rec, options) {
        options = options || {};
        options.all = options.all || [
            { value: hp, name: "HP" },
            { value: atk, name: "ATK" },
            { value: def, name: "DEF" },
            { value: rec, name: "REC" }
        ];

        options.numberFn = options.numberFn || function (number) {
            return `${get_polarized_number(number)}% `;
        };

        return multi_param_buff_handler(options);
    }

    function bc_hc_items_handler(bc, hc, item, options) {
        options = options || {};
        let extra_values = options.extra_values || {};
        options.all = [
            { value: bc, name: "BC" },
            { value: hc, name: "HC" },
            { value: item, name: "Item" },
            { value: extra_values.zel, name: 'Zel'},
            { value: extra_values.karma, name: 'Karma'}
        ];

        options.numberFn = function (number) {
            return `${get_polarized_number(number)}% `;
        };

        return multi_param_buff_handler(options);
    }

    function bb_atk_buff_handler(bb, sbb, ubb, options) {
        options = options || {};
        options.all = options.all || [
            { value: bb, name: "BB" },
            { value: sbb, name: "SBB" },
            { value: ubb, name: "UBB" }
        ];

        options.numberFn = options.numberFn || function (number) {
            return `${get_polarized_number(number)}% `;
        };

        return multi_param_buff_handler(options);
    }

    function variable_elemental_mitigation_handler(effect,buff_keys) {
        let elements = ['Fire', 'Water', 'Earth', 'Thunder', 'Light', 'Dark'];
        let buffs = buff_keys || ['mitigate fire attacks (21)', 'mitigate water attacks (22)', 'mitigate earth attacks (23)', 'mitigate thunder attacks (24)', 'mitigate light attacks (25)', 'mitigate dark attacks (26)'];
        let values = [];
        for (let b of buffs) {
            values.push(effect[b]);
        }

        let options = {
            names: elements,
            values: values,
            numberFn: function (value) { return `${value}% `; },
            suffix: " mitigation",
            special_case: {
                isSpecialCase: function (val, names) { return names.length >= 4; },
                func: function (value, names) {
                    let msg = `${value}% `;
                    if (names.length < 6) {
                        for (let n of names) {
                            msg += n[0].toUpperCase();
                        }
                    } else {
                        msg += "all elemental";
                    }
                    msg += " mitigation";
                    return msg;
                }
            }
        };

        return multi_param_buff_handler(options);

    }

    function elemental_bool_handler(options) {
        options.names = options.names || ['Fire', 'Water', 'Earth', 'Thunder', 'Light', 'Dark'];

        options.numberFn = options.numberFn || function (d) { return ""; };

        options.special_case = options.special_case || {
            isSpecialCase: function (value, name_arr) { return value == "true" && name_arr.length === 6; },
            func: function (value, names_array) {
                return "all elemental";
            }
        }

        return multi_param_buff_handler(options);
    }

    //give an options object with at least an array of values for each ailment
    function ailment_handler(options) {
        if (!options || !options.values) throw "ailment_handler: No options or values defined";
        if (options.values.length === 6)
            options.names = options.names || ["Injury", "Poison", "Sick", "Weaken", "Curse", "Paralysis"];
        else if (options.values.length === 3)
            options.names = options.names || ["ATK Down", "DEF Down", "REC Down"];
        else if (options.values.length === 9)
            options.names = options.names || ["Injury", "Poison", "Sick", "Weaken", "Curse", "Paralysis", "ATK Down", "DEF Down", "REC Down"];

        options.numberFn = options.numberFn || function (value) {
            return `${value}%`;
        }

        return multi_param_buff_handler(options);
    }

    function ailments_cured_handler(ailments_array) {
        function contains_all_status_ailments(arr) {
            var containsAll = true;
            var ailments = ['poison', 'weaken', 'sick', 'injury', 'curse', 'paralysis'];
            for (let a = 0; a < ailments.length; ++a) {
                if (arr.indexOf(ailments[a]) === -1) {
                    containsAll = false; break;
                }
            }
            return containsAll;
        }

        function contains_all_stat_reductions(arr) {
            var containsAll = true;
            var ailments = ['atk down', 'def down', 'rec down'];
            for (let a = 0; a < ailments.length; ++a) {
                if (arr.indexOf(ailments[a]) === -1) {
                    containsAll = false; break;
                }
            }
            return containsAll;
        }

        var msg = "";
        if (ailments_array.length === 9) {
            msg += "all ailments";
        } else if (ailments_array.length === 6 && contains_all_status_ailments(ailments_array)) {
            msg += "all status ailments";
        } else if (ailments_array.length === 3 && contains_all_stat_reductions(ailments_array)) {
            msg += "all status reductions";
        } else {
            msg += ailments_array.join("/");
        }
        return msg;
    }

    function get_target(area, type, options) {
        debug_log("Received target data",area,type, options);
        options = options || {};
        let isPassive = options.isPassive|| options.sp || false;
        if (typeof area === "object" && area["target type"] && area["target area"]) {
            type = area["target type"];
            area = area["target area"];
        } else if (typeof type === "object" && type["target type"] && type["target area"]) {
            area = type["target area"];
            type = type["target type"];
        }else if (typeof area === "object" && area["passive target"]) {
            type = area['passive target'];
            isPassive = true;
        } else if (typeof type === "object" && type["passive target"]) {
            type = type['passive target'];
            isPassive = true;
        }

        if(type !== 'party' && type !== 'self' && type !== 'enemy'){ //default to self
            if(!options.isLS){
                debug_log("Defaulting to self");
                type = "self";
            }else{
                type = 'party';
            }
        }

        let prefix = options.prefix || "to ";
        let suffix = options.suffix || "";

        //special case for when options.prefix is ""
        if (typeof options.prefix === "string" && options.prefix.length === 0)
            prefix = "";

        if(!options.isPassive){
            if (area === "single" && type === "self") {
                return ` ${prefix}self${suffix}`;
            } else if (area === "aoe" && type === "party") {
                return ` ${prefix}allies${suffix}`;
            } else if (area === "aoe" && type === "enemy") {
                return ` ${prefix}enemies${suffix}`;
            } else if (area === "single" && type === "enemy") {
                return ` ${prefix}an enemy${suffix}`;
            } else if (area === "single" && type === "party") {
                return ` ${prefix}an ally${suffix}`;
            } else {
                return ` (${area},${type})`;
            }
        }else{
            if(type === 'self'){
                return ` ${prefix}self${suffix}`;
            }else if(type === 'party'){
                return ` ${prefix}allies${suffix}`;
            }else{
                return ` (${type})`;
            }
        }
    }

    function get_turns(turns, msg, sp, buff_desc) {
        let turnMsg = "";
        if ((msg.length === 0 && sp) || (turns === 0 && !sp) || (turns && sp) || (turns !== undefined && turns !== 0)) {
            if (msg.length === 0 && sp) turnMsg = `Allows current ${buff_desc}${(buff_desc.toLowerCase().indexOf("buff") === -1) ? " buff(s)" : ""} to last for additional `;
            else turnMsg += ` for `;
            turnMsg += `${turns} ${(+turns === 1 ? "turn" : "turns")}`;
        }
        return turnMsg;
    }

    function regular_atk_helper(effect) {
        let msg = "";
        // if (effect["bb flat atk"]) msg += " (+" + effect["bb flat atk"] + " flat ATK)";
        if (effect["bb bc%"]) msg += ", innate " + get_polarized_number(effect["bb bc%"]) + "% BC drop rate";
        if (effect["bb crit%"]) msg += ", innate " + get_polarized_number(effect["bb crit%"]) + "% crit rate";
        if (effect["bb hc%"]) msg += ", innate " + get_polarized_number(effect["bb hc%"]) + "% HC drop rate";
        return msg;
    }

    function base_buffed_resistance_handler(base,buffed,buff_name){
        if(base === 100 && buffed === 100){
            return buff_name;
        }else{
            let options = {
                all: [
                    { value: base, name: "base" },
                    { value: buffed, name: "buffed" }
                ],
                numberFn: (d) => { return `${get_polarized_number(d)}% `; }
            }

            let resist = multi_param_buff_handler(options);
            if (resist.length > 0) {
                resist += ` ${buff_name}`;
            }
            return resist;
        }
    }

    var buff_types = {
        attack: `unit attacks enemy`,
        buff: `unit gains some sort of enhancement to their stats or attacks, can last more than one turn`,
        debuff: `unit's attack inflicts some ailment onto the enemy`,
        effect: `buff does something directly to the unit(s) on that turn; multiple instances of itself on the same turn will stack`,
        passive: `always active`,
        conditional: 'only activates when certain criteria are met',
        timed: `only active for a certain amount of time`,
        none: `buff doesn't do anything; either bugged or developer value`,
        unknown: `it is unknown what buffs of these types do or how to interpret them correctly`
    };
    var proc_buffs = {
        '1': {
            desc: "Regular Attack",
            type: ["attack"],
            notes: ["Unless otherwise specified, the attack will always be toward the enemy"],
            func: function (effect, other_data) {
                other_data = other_data || {};
                let damage_frames = other_data.damage_frames || {};
                var numHits = damage_frames.hits || "NaN";
                var msg = "";
                if (!other_data.sp) {
                    msg += numHits.toString() + ((numHits === 1) ? " hit " : " hits ");
                }
                let damage = [];
                if (effect["bb atk%"]) damage.push(`${effect["bb atk%"]}%`);
                if (effect["bb dmg%"]) damage.push(`${effect["bb dmg%"]}%`); //case when using a burst from bbs.json
                switch (damage.length) {
                    case 1: msg += `${damage[0]} `; break;
                    case 2: msg += `${damage[0]} (${damage[1]} power) `; break;
                    default: break;
                }

                if (other_data.sp) msg += "to BB ATK%";

                if (!other_data.sp) {
                    msg += (effect["target area"].toUpperCase() === "SINGLE") ? "ST" : effect["target area"].toUpperCase();
                }
                let extra = [];
                if (effect["bb flat atk"]) extra.push("+" + effect["bb flat atk"] + " flat ATK");
                if (damage_frames["hit dmg% distribution (total)"] !== undefined && damage_frames["hit dmg% distribution (total)"] !== 100)
                    extra.push(`at ${damage_frames["hit dmg% distribution (total)"]}% power`);
                if (extra.length > 0) msg += ` (${extra.join(", ")})`;

                msg += regular_atk_helper(effect);

                if (!other_data.sp) {
                    if (effect["target type"] !== "enemy") msg += ` to ${effect["target type"]}`;
                }
                return msg;
            }
        },
        '2': {
            desc: "Burst Heal",
            type: ["effect"],
            notes: ["if no hits are mentioned, then the burst heal happens all at once", "over multiple hits means that for every hit, units heal a fraction of the burst heal"],
            func: function (effect, other_data) {
                let damage_frames = other_data.damage_frames || {};
                var msg = get_formatted_minmax(effect['heal low'], effect['heal high']) + " HP burst heal ";
                msg += "(+" + effect['rec added% (from healer)'] + "% healer REC)";
                if (damage_frames.hits > 1)
                    msg += " over " + damage_frames.hits + " hits";
                // msg += " (" + effect["target area"] + "," + effect["target type"] + ")";
                if (!other_data.sp) msg += get_target(effect, other_data);
                return msg;
            }
        },
        '3': {
            desc: "Heal over Time (HoT)",
            type: ["buff"],
            func: function (effect, other_data) {
                other_data = other_data || {};
                var msg = "";
                if (effect["gradual heal low"] || effect['gradual heal high']) {
                    msg = get_formatted_minmax(effect["gradual heal low"], effect["gradual heal high"]) + " HP HoT";
                    msg += " (+" + effect["rec added% (from target)"] + "% target REC)";
                }

                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;

                if (!other_data.sp) msg += get_target(effect, other_data);

                msg += get_turns(effect["gradual heal turns (8)"], msg, other_data.sp, this.desc);

                return msg;
            }
        },
        '4': {
            desc: "BB Gauge Refill",
            type: ["effect"],
            notes: ["This effect is similar to the regular BC insta-fill buff (proc 31), but has the option of filling a percentage of the BB gauge", "Filling 100% of own BB gauge means that the gauge will be refilled to SBB if it's unlocked"],
            func: function (effect, other_data) {
                var msg = "";
                if (effect["bb bc fill%"]) {
                    if (effect["bb bc fill%"] !== 100)
                        msg += `${get_polarized_number(effect["bb bc fill%"])}% BB gauge of`;
                    else
                        msg += "Fills BB gauge of";
                }

                if (effect["bb bc fill"]) {
                    if (effect["bb bc fill%"]) msg += " and ";
                    msg += `${get_polarized_number(effect["bb bc fill"])} BC fill to`;
                }
                if (!other_data.sp) msg += get_target(effect, other_data, {
                    prefix: ''
                });

                if (effect["bb bc fill%"] === 100) {
                    msg += " to max";
                }

                return msg;
            }
        },
        '5': {
            desc: "Regular and Elemental ATK/DEF/REC/Crit Rate",
            type: ["buff"],
            func: function (effect, other_data) {
                var msg = "";
                if (effect["atk% buff (1)"] || effect["def% buff (3)"] || effect["rec% buff (5)"]) { //regular tri-stat
                    msg += hp_adr_buff_handler(undefined, effect["atk% buff (1)"], effect["def% buff (3)"], effect["rec% buff (5)"]);
                }
                if (effect["crit% buff (7)"]) {//crit rate buff
                    if (msg.length > 0) msg += ", ";
                    msg += get_polarized_number(effect["crit% buff (7)"]) + "% crit rate";
                }

                if (effect["atk% buff (2)"] || effect["def% buff (4)"] || effect["rec% buff (6)"]) {//decreased buffs
                    if (msg.length > 0) msg += ", ";
                    msg += hp_adr_buff_handler(undefined, effect["atk% buff (2)"], effect["def% buff (4)"], effect["rec% buff (6)"]);
                }

                if (effect["atk% buff (13)"] || effect["def% buff (14)"] || effect["rec% buff (15)"]) { //elemental tri-stat
                    msg += hp_adr_buff_handler(undefined, effect["atk% buff (13)"], effect["def% buff (14)"], effect["rec% buff (15)"]);
                }
                if (effect["crit% buff (16)"]) { //elemental crit buff
                    if (msg.length > 0) msg += ", ";
                    msg += get_polarized_number(effect["crit% buff (16)"]) + "% crit rate";
                }
                if (effect['element buffed'] !== "all") {
                    msg += " of " + to_proper_case(effect['element buffed'] || "null");
                }

                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;

                if (!other_data.sp) msg += get_target(effect, other_data);

                msg += get_turns(effect["buff turns"], msg, other_data.sp, this.desc);

                return msg;
            }
        },
        '6': {
            desc: "BC/HC/Item Drop Rate",
            type: ["buff"],
            func: function (effect, other_data) {
                debug_log('proc 6', effect);
                var msg = "";
                if (effect["bc drop rate% buff (10)"] || effect["hc drop rate% buff (9)"] || effect["item drop rate% buff (11)"])
                    msg += bc_hc_items_handler(effect["bc drop rate% buff (10)"], effect["hc drop rate% buff (9)"], effect["item drop rate% buff (11)"]) + " droprate";

                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;

                if (!other_data.sp) msg += get_target(effect, other_data);
                msg += get_turns(effect["drop rate buff turns"], msg, other_data.sp, this.desc);

                return msg;
            }
        },
        '7': {
            desc: "Guaranteed Angel Idol (AI)",
            type: ["buff"],
            notes: ["This is the one that is guaranteed to work; no chance of failing", "if you see false in the result, please let the developer (BluuArc) know"],
            func: function (effect, other_data) {
                var info_arr = [];
                if (effect["angel idol buff (12)"] !== true) info_arr.push(effect["angel idol buff (12)"]);
                info_arr.push(`recover ${effect["angel idol recover hp%"] || 100}% HP on use`);
                let msg = `gives Angel Idol (${info_arr.join(", ")})`;
                if (!other_data.sp) msg += get_target(effect, other_data);
                return msg;
            }
        },
        '8': {
            desc: "Increase Max HP",
            type: ["buff"],
            func: function (effects, other_data) {
                let msg = "";
                if (effects["max hp increase"]) {
                    msg = `${get_polarized_number(effects["max hp increase"])} HP boost to max HP`;
                } else {
                    msg = `${get_polarized_number(effects["max hp% increase"])}% Max HP`;
                }
                if (!other_data.sp) msg += get_target(effects, other_data);
                return msg;
            }
        },
        '9': {
            desc: "ATK/DEF/REC down to enemy",
            type: ["debuff"],
            notes: ['Not sure if this is implemented properly on SP for unit 30517 or 61027'],
            func: function (effect, other_data) {
                var msg = "";
                let chance, amount; //used to check values for SP
                //case  that both buffs are present with same proc chance
                if (effect['buff #1'] !== undefined && effect['buff #2'] !== undefined && effect['buff #1']['proc chance%'] === effect['buff #2']['proc chance%']) {
                    debug_log("entered double branch");
                    let debuff1 = effect['buff #1'];
                    let debuff2 = effect['buff #2'];
                    chance = debuff1['proc chance%'];
                    let atk = debuff1['atk% buff (1)'] || debuff2['atk% buff (1)'] || debuff1['atk% buff (2)'] || debuff2['atk% buff (2)'];
                    let def = debuff1['def% buff (3)'] || debuff2['def% buff (3)'] || debuff1['def% buff (4)'] || debuff2['def% buff (4)'] || debuff1['def% buff (14)'] || debuff2['def% buff (14)'];
                    let rec = debuff1['rec% buff (5)'] || debuff2['rec% buff (5)'] || debuff1['rec% buff (6)'] || debuff2['rec% buff (6)'];
                    amount = atk || 0 + def || 0 + rec || 0;
                    msg += debuff1['proc chance%'] + "% chance to inflict " + hp_adr_buff_handler(undefined, atk, def, rec);
                } else if (effect['buff #1']) {
                    let debuff = effect['buff #1'];
                    chance = debuff['proc chance%'];
                    let atk = debuff['atk% buff (1)'] || debuff['atk% buff (2)'];
                    let def = debuff['def% buff (3)'] || debuff['def% buff (4)'] || debuff['def% buff (14)'];
                    let rec = debuff['rec% buff (5)'] || debuff['rec% buff (6)'];
                    amount = atk || 0 + def || 0 + rec || 0;
                    msg += debuff['proc chance%'] + "% chance to inflict " + hp_adr_buff_handler(undefined, atk, def, rec);
                } else if (effect['buff #2']) {
                    if (msg.length > 0) msg += ", ";
                    let debuff = effect['buff #2'];
                    chance = debuff['proc chance%'];
                    let atk = debuff['atk% buff (1)'] || debuff['atk% buff (2)'];
                    let def = debuff['def% buff (3)'] || debuff['def% buff (4)'] || debuff['def% buff (14)'];
                    let rec = debuff['rec% buff (5)'] || debuff['rec% buff (6)'];
                    amount = atk || 0 + def || 0 + rec || 0;
                    msg += debuff['proc chance%'] + "% chance to inflict " + hp_adr_buff_handler(undefined, atk, def, rec);
                }
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!chance && !amount && other_data.sp) msg = "";
                msg += get_turns(effect["buff turns"], msg, other_data.sp, this.desc);

                if (effect['element buffed'] !== 'all') msg += ` of ${to_proper_case(effect['element buffed'] || "null")} types`;
                // msg += ` for ${effect["buff turns"]} ${effect["buff turns"] === 1 ? "turn" : "turns"}`;
                if (!other_data.sp) msg += get_target(effect, other_data);
                return msg;
            }
        },
        '10': {
            desc: "Status Ailment Removal",
            type: ["effect"],
            notes: ["if you see false in the result, please let the developer (BluuArc) know", 'This seems similar to proc 38, the usual status removal buff'],
            func: function (effect, other_data) {
                let msg = "Removes all status ailments";
                if (effect["remove all status ailments"] !== true) {
                    msg += ` ${effect["remove all status ailments"]}) `;
                }
                if (!other_data.sp) msg += get_target(effect, undefined, {
                    prefix: 'from '
                });
                return msg;
            }
        },
        '11': {
            desc: "Inflict Status Ailment",
            type: ["debuff"],
            notes: ["Some bursts have a 'null' parameter; it's currently unknown as to what it does"],
            func: function (effect, other_data) {
                let options = {};
                options.values = [
                    effect["injury%"],
                    effect["poison%"],
                    effect["sick%"],
                    effect["weaken%"],
                    effect["curse%"],
                    effect["paralysis%"]
                ];

                options.suffix = function (names) {
                    if (names.length === 6) {
                        return " chance to inflict any status ailment";
                    } else {
                        return ` chance to inflict ${names.join("/")}`;
                    }
                }

                let msg = ailment_handler(options);
                if (msg.length === 0 && (!effect[null] || !other_data.sp)) throw no_buff_data_msg;

                if (effect[null]) {
                    if (msg.length === 0)
                        msg += `Unknown param 'null' (${effect[null]})`;
                    else
                        msg += `, Unknown param 'null' (${effect[null]})`;
                }
                if (!other_data.sp) msg += get_target(effect, other_data);
                return msg;
            }
        },
        '12': {
            desc: "Guaranteed Revive",
            type: ["effect"],
            notes: ["As of June 2017, this is only found on at least one NPC attack and some items"],
            func: function (effect, other_data) {
                let revive_target = get_target(effect, other_data, {
                    prefix: "",
                    suffix: ""
                });

                let msg = `revive${revive_target} with ${effect['revive to hp%']}% HP`;
                return msg;
            }
        },
        '13': {
            desc: "Random Target (RT) Attack",
            type: ["attack"],
            func: function (effect, other_data) {
                other_data = other_data || {};
                let damage_frames = other_data.damage_frames || {};
                var numHits = effect.hits || "NaN";
                // var numHits = effect.hits;
                let msg = "";
                if (!other_data.sp) {
                    msg += numHits.toString() + ((numHits === 1) ? " hit" : " hits");
                }
                if (effect["bb atk%"]) msg += ` ${effect["bb atk%"]}%`;

                if (!other_data.sp) msg += " ";
                else msg += " to BB ATK%";

                if (!other_data.sp) {
                    if (effect["random attack"] === false) msg += (effect["target area"].toUpperCase() === "SINGLE") ? "ST" : effect["target area"].toUpperCase();
                    else msg += "RT";
                }
                let extra = [];
                if (effect["bb flat atk"]) extra.push("+" + effect["bb flat atk"] + " flat ATK");
                if (damage_frames["hit dmg% distribution (total)"] !== undefined && damage_frames["hit dmg% distribution (total)"] !== 100)
                    extra.push(`at ${damage_frames["hit dmg% distribution (total)"]}% power`);
                if (extra.length > 0) msg += ` (${extra.join(", ")})`;

                msg += regular_atk_helper(effect);

                if (!other_data.sp) {
                    if (effect["target type"] !== "enemy") msg += ` to ${effect["target type"]}`;
                }
                return msg;
            }
        },
        '14': {
            desc: "HP Draining Attack",
            type: ["attack"],
            notes: ["Unless otherwise specified, the attack will always be toward the enemy"],
            func: function (effect, other_data) {
                other_data = other_data || {};
                let damage_frames = other_data.damage_frames || {};
                var numHits = damage_frames.hits || "NaN";
                var msg = "";
                if (!other_data.sp) {
                    msg += numHits.toString() + ((numHits === 1) ? " hit" : " hits");
                }
                let damage = [];
                if (effect["bb atk%"]) damage.push(`${effect["bb atk%"]}%`);
                if (effect["bb dmg%"]) damage.push(`${effect["bb dmg%"]}%`); //case when using a burst from bbs.json
                switch (damage.length) {
                    case 1: msg += ` ${damage[0]}`; break;
                    case 2: msg += ` ${damage[0]} (${damage[1]} power)`; break;
                    default: break;
                }

                if (!other_data.sp) msg += " ";
                else msg += " to BB ATK%";

                if (!other_data.sp) {
                    msg += (effect["target area"].toUpperCase() === "SINGLE") ? "ST" : effect["target area"].toUpperCase();
                }
                let extra = [];
                if (effect["bb flat atk"]) extra.push("+" + effect["bb flat atk"] + " flat ATK");
                extra.push(`heal ${get_formatted_minmax(effect["hp drain% low"], effect["hp drain% high"])}% of damage dealt`);
                if (damage_frames["hit dmg% distribution (total)"] !== undefined && damage_frames["hit dmg% distribution (total)"] !== 100)
                    extra.push(`at ${damage_frames["hit dmg% distribution (total)"]}% power`);
                if (extra.length > 0) msg += ` (${extra.join(", ")})`;

                msg += regular_atk_helper(effect);

                if (!other_data.sp) {
                    if (effect["target type"] !== "enemy") msg += ` to ${effect["target type"]}`;
                }
                return msg;
            }
        },
        '16': {
            desc: "Elemental Mitigation",
            type: ["buff"],
            notes: ["This is different from proc ID 39 in that each element can have a different value of mitigation; otherwise it's almost the same"],
            func: function (effect, other_data) {
                let msg = variable_elemental_mitigation_handler(effect);
                if (effect['mitigate all attacks (20)'] !== undefined) {
                    if (msg.length > 0) msg += ", ";
                    msg += `${effect['mitigate all attacks (20)']}% all attack mitigation`;
                }
                if (!other_data.sp) msg += get_target(effect, other_data);
                msg += get_turns(effect['buff turns'], msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '17': {
            desc: "Status Negation/Resistance",
            type: ["buff"],
            func: function (effect, other_data) {
                let options = {};
                options.values = [
                    effect["resist injury% (33)"],
                    effect["resist poison% (30)"],
                    effect["resist sick% (32)"],
                    effect["resist weaken% (31)"],
                    effect["resist curse% (34)"],
                    effect["resist paralysis% (35)"]
                ];

                options.suffix = function (names) {
                    if (names.length === 6) {
                        return " all status ailments";
                    } else {
                        return ` ${names.join("/")}`;
                    }
                };

                options.numberFn = function (value) {
                    if (value == 100)
                        return "Negates";
                    else
                        return `${value}% resistance to`;
                };

                options.special_case = {
                    isSpecialCase: function (value, names) {
                        // debug_log("Received:", value, names.length, value == 100, names.length === 6);
                        return value == 0 || names.length === 6;
                    },
                    func: function (value, names) {
                        if(value == 0) return "";
                        if(value == 100)
                            return "Negates all status ailments";
                        else
                            return `${value}% resistance to all status ailments`;
                    }
                };

                let msg = "";
                if (effect["resist injury% (33)"] || effect["resist poison% (30)"] || effect["resist sick% (32)"] || 
                    effect["resist weaken% (31)"] || effect["resist curse% (34)"] || effect["resist paralysis% (35)"])
                    msg += ailment_handler(options);
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;

                if (!other_data.sp) msg += get_target(effect, other_data, {
                    prefix: 'for '
                });
                msg += get_turns(effect['resist status ails turns'], msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '18': {
            desc: "Mitigation",
            type: ["buff"],
            func: function (effect, other_data) {
                var msg = "";
                if (effect['dmg% reduction']) msg += `${effect["dmg% reduction"]}% mitigation`;
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data);
                msg += get_turns(effect['dmg% reduction turns (36)'], msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '19': {
            desc: "BC Fill per Turn",
            type: ["buff"],
            func: function (effect, other_data) {
                var msg = "";
                if (effect['increase bb gauge gradual']) msg += get_polarized_number(effect["increase bb gauge gradual"]) + " BC/turn";

                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data);
                msg += get_turns(effect['increase bb gauge gradual turns (37)'], msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '20': {
            desc: "BC Fill on Hit",
            type: ["buff"],
            func: function (effect, other_data) {
                var msg = "";
                if (effect["bc fill when attacked%"] || effect["bc fill when attacked low"] || effect["bc fill when attacked high"]) {
                    if (effect["bc fill when attacked%"] !== undefined && effect["bc fill when attacked%"] !== 100) {
                        msg += `${effect["bc fill when attacked%"]}% chance to fill `;
                    } else if (effect["bc fill when attacked%"] !== undefined && effect["bc fill when attacked%"] === 100) {
                        msg += "Fills ";
                    }
                    msg += `${get_formatted_minmax(effect["bc fill when attacked low"], effect["bc fill when attacked high"])} BC when hit`;
                }
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data);
                msg += get_turns(effect["bc fill when attacked turns (38)"], msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '22': {
            desc: "Defense Ignore",
            type: ["buff"],
            func: function (effect, other_data) {
                var msg = "";
                if (effect['defense% ignore']) msg += `${effect['defense% ignore']}% DEF ignore`;
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data, {
                    prefix: "to attacks of "
                });
                msg += get_turns(effect["defense% ignore turns (39)"], msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '23': {
            desc: "Spark Damage",
            type: ["buff"],
            func: function (effect, other_data) {
                var msg = "";
                if (effect["spark dmg% buff (40)"]) msg += get_polarized_number(effect["spark dmg% buff (40)"]) + "% spark DMG";

                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data, {
                    prefix: "to attacks of "
                });
                msg += get_turns(effect["buff turns"], msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '24': {
            desc: "Stat Conversion",
            type: ["buff"],
            func: function (effect, other_data) {
                let msg = "";
                if (effect['converted attribute'] || effect['atk% buff (46)'] || effect['def% buff (47)'] || effect['rec% buff (48)']) {
                    let source_buff = (effect['converted attribute'] !== undefined) ? (effect['converted attribute'] || "null").toUpperCase().slice(0, 3) : undefined;
                    if (source_buff === "ATT") source_buff = "ATK";
                    let options = {
                        suffix: " conversion",
                    };
                    if (source_buff) {
                        options.numberFn = function (value) { return `${value}% ${source_buff}->` };
                    }
                    msg = hp_adr_buff_handler(undefined, effect['atk% buff (46)'], effect['def% buff (47)'], effect['rec% buff (48)'], options);
                    // var buff = adr_buff_handler(effect['atk% buff (46)'], effect['def% buff (47)'], effect['rec% buff (48)']);
                    // msg = "Convert " + buff.replace('% ', "% " + source_buff + " to ");
                }

                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data);
                msg += get_turns(effect["% converted turns"], msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '26': {
            desc: "Hit Count Increase",
            type: ['buff'],
            notes: ['Add the damage noted in this buff to 100% to get the actual damage of normal attacks',`+# means that the unit has # additional more hits, so +2 means that each hit has 2 more hits following it, effectively tripling the original hit count`],
            func: function (effect, other_data) {
                let msg = "";
                if (effect['hit increase/hit'] || effect['extra hits dmg%'])
                    msg += `${get_polarized_number(effect['hit increase/hit'] || 0)} ${(effect['hit increase/hit'] === 1) ? "hit" : "hits"} to normal attacks (at ${(get_polarized_number(effect['extra hits dmg%'] || 0))}% damage)`;

                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data, {
                    prefix: "of "
                });
                msg += get_turns(effect["hit increase buff turns (50)"], msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '27': {
            desc: "HP% Damage Attack",
            type: ['attack'],
            func: function (effect, other_data) {
                other_data = other_data || {};
                let damage_frames = other_data.damage_frames || {};
                var numHits = damage_frames.hits || "NaN";
                var msg = "";
                if (!other_data.sp) {
                    msg += numHits.toString() + ((numHits === 1) ? " hit" : " hits");
                }
                if (effect["bb atk%"]) msg += ` ${effect["bb atk%"]}%`;

                if (!other_data.sp) msg += " ";
                else msg += " to BB ATK%";

                if (!other_data.sp) {
                    msg += (effect["target area"].toUpperCase() === "SINGLE") ? "ST" : effect["target area"].toUpperCase();
                }
                let extra = [];
                if (effect["bb flat atk"]) extra.push("+" + effect["bb flat atk"] + " flat ATK");
                if (damage_frames["hit dmg% distribution (total)"] !== undefined && damage_frames["hit dmg% distribution (total)"] !== 100)
                    extra.push(`at ${damage_frames["hit dmg% distribution (total)"]}% power`);
                if (effect['hp% damage high'] || effect['hp% damage low'] || effect['hp% damage chance%']) {
                    extra.push(`${effect['hp% damage chance%']}% chance to deal ${get_formatted_minmax(effect['hp% damage low'], effect['hp% damage high'])}% of target's max HP`);
                }
                if (extra.length > 0) msg += ` (${extra.join(", ")})`;

                msg += regular_atk_helper(effect);

                if (!other_data.sp) {
                    if (effect["target type"] !== "enemy") msg += ` to ${effect["target type"]}`;
                }
                return msg;
            }
        },
        '28': {
            desc: "Fixed Damage Attack",
            type: ['attack'],
            func: function (effect, other_data) {
                other_data = other_data || {};
                let damage_frames = other_data.damage_frames || {};
                var numHits = damage_frames.hits || "NaN";
                var msg = "";
                if (!other_data.sp) {
                    msg += numHits.toString() + ((numHits === 1) ? " hit " : " hits ");
                }
                if (effect["fixed damage"] !== undefined) msg += `fixed ${effect["fixed damage"]} damage `;

                if (!other_data.sp) {
                    msg += (effect["target area"].toUpperCase() === "SINGLE") ? "ST" : effect["target area"].toUpperCase();
                }

                if (!other_data.sp) {
                    if (effect["target type"] !== "enemy") msg += ` to ${effect["target type"]}`;
                }
                return msg;
            }
        },
        '29': {
            desc: "Multi-Elemental Attack",
            notes: ["These elements are added onto the attack of the unit's base element"],
            type: ["attack"],
            func: function (effect, other_data) {
                other_data = other_data || {};
                let damage_frames = other_data.damage_frames || {};
                var numHits = damage_frames.hits || "NaN";
                var msg = "";
                if (!other_data.sp) {
                    msg += numHits.toString() + ((numHits === 1) ? " hit" : " hits");
                }
                let damage = [];
                if (effect["bb atk%"]) damage.push(`${effect["bb atk%"]}%`);
                if (effect["bb dmg%"]) damage.push(`${effect["bb dmg%"]}%`); //case when using a burst from bbs.json
                switch (damage.length) {
                    case 1: msg += ` ${damage[0]}`; break;
                    case 2: msg += ` ${damage[0]} (${damage[1]} power)`; break;
                    default: break;
                }

                if (!other_data.sp) msg += " ";
                else msg += " to BB ATK%";

                if (effect['bb elements']) {
                    let elements = effect['bb elements'].map(function (e) { return to_proper_case(e || "null") });
                    msg += elements.join("/") + " ";
                }

                if (!other_data.sp) {
                    msg += (effect["target area"].toUpperCase() === "SINGLE") ? "ST" : effect["target area"].toUpperCase();
                }
                let extra = [];
                if (effect["bb flat atk"]) extra.push("+" + effect["bb flat atk"] + " flat ATK");
                if (damage_frames["hit dmg% distribution (total)"] !== undefined && damage_frames["hit dmg% distribution (total)"] !== 100)
                    extra.push(`at ${damage_frames["hit dmg% distribution (total)"]}% power`);
                if (extra.length > 0) msg += ` (${extra.join(", ")})`;

                msg += regular_atk_helper(effect);

                if (!other_data.sp) {
                    if (effect["target type"] !== "enemy") msg += ` to ${effect["target type"]}`;
                }
                return msg;
            }
        },
        '30': {
            desc: "Elemental Buffs",
            type: ["buff"],
            notes: ["FWETLD corresponds to fire, water, earth, thunder, light, and dark, respectively"],
            func: function (effect, other_data) {
                let msg = "";
                if (effect['elements added'] && effect['elements added'].length > 0) {
                    let elements = effect['elements added'].map(function (v) { return v ? to_proper_case(v) : "Null"; });
                    msg += "Add ";
                    if (elements.length < 3) {
                        msg += elements.join("/");
                    } else if (elements.length < 6) {
                        msg += elements.map(function (v) { return v[0].toUpperCase(); }).join("");
                    } else {
                        msg += "all elements";
                    }
                    msg += " to attacks";
                }
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data, {
                    prefix: "of "
                });
                msg += get_turns(effect["elements added turns"], msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '31': {
            desc: "BC Insta-fill/Flat BB Gauge Increase",
            type: ["effect"],
            func: function (effect, other_data) {
                var msg = ""
                if (effect["increase bb gauge"] !== undefined) msg += `${get_polarized_number(effect["increase bb gauge"])} BC fill`;
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data);
                return msg;
            }
        },
        '32': {
            desc: "Change Base Element",
            type: ['buff'],
            notes: ['This is first seen with Grah\'s attacks in Trial 2'],
            func: function (effect, other_data) {
                let msg = "";
                if (effect['set attack element attribute']) {
                    msg += `Change base element`;
                }
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data, {
                    prefix: "of "
                });
                if (effect['set attack element attribute']) {
                    msg += ` to ${to_proper_case(effect['set attack element attribute'])}`;
                }
                return msg;
            }
        },
        '33': {
            desc: "Buff Wipe/Buff Removal",
            type: ['debuff'],
            func: function (effect, other_data) {
                let msg = "";
                if (effect['clear buff chance%'] !== undefined) {
                    msg += `${effect['clear buff chance%']}% chance to remove buffs`;
                }
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data, {
                    prefix: "of "
                });
                return msg;
            }
        },
        '34': {
            desc: "BB Gauge Reduction",
            type: ['debuff'],
            func: function (effect, other_data) {
                let msg = "";
                let reductions = [];
                if (effect['base bb gauge reduction low'] || effect['base bb gauge reduction high'])
                    reductions.push(`${get_formatted_minmax(effect['base bb gauge reduction low'], effect['base bb gauge reduction high'])} BC`);
                if (effect['bb gauge% reduction low'] || effect['bb gauge% reduction high'])
                    reductions.push(`${get_formatted_minmax(effect['bb gauge% reduction low'], effect['bb gauge% reduction high'])}%`);
                if (effect['bb gauge reduction chance%'] !== undefined && reductions.length > 0) {
                    msg += `${effect['bb gauge reduction chance%']}% chance to reduce BB gauge`;
                }

                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data, {
                    prefix: "of "
                });

                if (effect['bb gauge reduction chance%'] !== undefined && reductions.length > 0) {
                    msg += ` by ${reductions.join(" and ")}`;
                }
                return msg;
            }
        },
        '36': {
            desc: "LS Lock",
            type: ['debuff'],
            func: function (effect, other_data) {
                let msg = "";
                if (effect['invalidate LS chance%'] !== undefined) {
                    if (effect['invalidate LS chance%'] == 100){
                        msg += "Nullifies LS effects";
                    }else{
                        msg += `${effect['invalidate LS chance%']}% chance to nullify LS effects`;
                    }
                }

                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data, {
                    prefix: "of "
                });
                msg += get_turns(effect["invalidate LS turns (60)"], msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '38': {
            desc: "Status Cleanse (Ailments and/or Stat Reductions)",
            notes: ["Status ailments refers to the basic 6 paralysis,injury,etc.", "Stat reductions refer to ATK/DEF/REC down", "Ailments refers to both status ailments and stat reductions"],
            type: ["effect"],
            func: function (effect, other_data) {
                var msg = "";
                if (effect["ailments cured"]) msg += `Clears ${ailments_cured_handler(effect["ailments cured"])}`;
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data, {
                    prefix: "inflicted on "
                });
                return msg;
            }
        },
        '39': {
            desc: "Elemental Mitigation",
            type: ["buff"],
            notes: ["This is different from proc ID 16 in that there's one mitigation value for the given elements; otherwise it's almost the same"],
            func: function (effect, other_data) {
                let msg = "";
                let options = {
                    values: [
                        effect['mitigate fire attacks'],
                        effect['mitigate water attacks'],
                        effect['mitigate earth attacks'],
                        effect['mitigate thunder attacks'],
                        effect['mitigate light attacks'],
                        effect['mitigate dark attacks'],
                    ]
                };

                let any_element = effect['mitigate fire attacks'] || effect['mitigate water attacks'] || effect['mitigate earth attacks'] || effect['mitigate thunder attacks'] || effect['mitigate light attacks'] || effect['mitigate dark attacks'];
                if (effect['dmg% mitigation for elemental attacks'])
                    msg += `${effect['dmg% mitigation for elemental attacks']}% elemental mitigation`;
                if (any_element) {
                    msg += ` from ${elemental_bool_handler(options)} attacks`;
                }

                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data);
                msg += get_turns(effect['dmg% mitigation for elemental attacks buff turns'], msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '40': {
            desc: "Status Ailment Inflict When Attacking",
            type: ["buff"],
            func: function (effect, other_data) {
                let msg = "";
                let options = {};
                options.values = [
                    effect["injury% buff"],
                    effect["poison% buff"],
                    effect["sick% buff"],
                    effect["weaken% buff"],
                    effect["curse% buff"],
                    effect["paralysis% buff"]
                ];

                options.suffix = function (names) {
                    if (names.length === 6) {
                        return " chance to inflict any status ailment";
                    } else {
                        return ` chance to inflict ${names.join("/")}`;
                    }
                }

                let ails = ailment_handler(options);
                if (ails.length > 0) msg += `Adds ${ails} to attacks`;
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data, {
                    prefix: "of "
                });
                msg += get_turns(effect['buff turns'], msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '43': {
            desc: "Burst OD Fill",
            type: ["effect"],
            notes: ["I'm inferring that target type 4 implies the player's OD gauge"],
            func: function (effect, other_data) {
                var msg = ""
                if (effect["increase od gauge%"]) msg += `${get_polarized_number(effect["increase od gauge%"])}% OD gauge fill`;
                if (msg.length === 0 && (!effect[null] || !other_data.sp)) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data, {
                    prefix: "of "
                });
                if (msg.indexOf("(single,4)") > -1) msg = msg.replace("(single,4)", "of player");
                return msg;
            }
        },
        '44': {
            desc: "Damage Over Time (DoT)",
            notes: ["unit 720176 has some weird values with this ID"],
            type: ["debuff"],
            func: function (effect, other_data) {
                let msg = "";
                let values = [];
                if (effect["dot atk%"] !== undefined)
                    msg += effect["dot atk%"] + "% DoT";
                if (effect['dot flat atk'])
                    values.push(get_polarized_number(effect["dot flat atk"]) + " flat ATK");
                if (effect['dot dmg%'])
                    values.push(get_polarized_number(effect['dot dmg%']) + "% multiplier");

                if (values.length > 0) {
                    msg += ` (${values.join(", ")})`;
                }

                if (effect['dot element affected'] === false) {
                    msg += " (EWD doesn't apply)";
                }

                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data);
                msg += get_turns(effect["dot turns (71)"], msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '45': {
            desc: "BB/SBB/UBB ATK",
            type: ["buff"],
            func: function (effect, other_data) {
                let msg = "";
                if (effect["bb atk% buff"] || effect["sbb atk% buff"] || effect["ubb atk% buff"])
                    msg += bb_atk_buff_handler(effect["bb atk% buff"], effect["sbb atk% buff"], effect["ubb atk% buff"], {
                        suffix: " ATK"
                    });

                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data);
                msg += get_turns(effect["buff turns (72)"], msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '47': {
            desc: "HP Scaling Attack",
            type: ["attack"],
            func: function (effect, other_data) {
                other_data = other_data || {};
                let damage_frames = other_data.damage_frames || {};
                var numHits = damage_frames.hits || "NaN";
                var max_total = (+effect["bb base atk%"] || 0) + (+effect["bb added atk% based on hp"] || 0);
                var msg = "";
                if (!other_data.sp) {
                    msg += numHits.toString() + ((numHits === 1) ? " hit" : " hits");
                }
                if (effect["bb base atk%"] || effect["bb added atk% based on hp"]) {
                    if (effect["bb base atk%"] !== max_total)
                        msg += ` ${get_formatted_minmax(effect["bb base atk%"] || 0, max_total)}%`;
                    else
                        msg += ` ${max_total}-${max_total}%`;
                }

                if (!other_data.sp) msg += " ";
                else msg += " to BB ATK%";

                if (!other_data.sp) {
                    msg += (effect["target area"].toUpperCase() === "SINGLE") ? "ST" : effect["target area"].toUpperCase();
                }
                let extra = [];
                if (effect["bb flat atk"]) extra.push("+" + effect["bb flat atk"] + " flat ATK");
                if (damage_frames["hit dmg% distribution (total)"] !== undefined && damage_frames["hit dmg% distribution (total)"] !== 100)
                    extra.push(`at ${damage_frames["hit dmg% distribution (total)"]}% power`);
                if (effect['bb added atk% proportional to hp']) extra.push(`proportional to ${effect['bb added atk% proportional to hp']} HP`);
                if (extra.length > 0) msg += ` (${extra.join(", ")})`;

                msg += regular_atk_helper(effect);

                if (!other_data.sp) {
                    if (effect["target type"] !== "enemy") msg += ` to ${effect["target type"]}`;
                }
                return msg;
            }
        },
        '51': {
            desc: "Status Reduction Inflict When Attacking",
            type: ["buff"],
            func: function (effect, other_data) {
                let msg = "";
                let options = {};
                let reduction_turns = effect['stat% debuff turns'] || 0;
                options.values = [
                    effect["inflict atk% debuff chance% (74)"],
                    effect["inflict def% debuff chance% (75)"],
                    effect["inflict rec% debuff chance% (76)"],
                ];

                options.suffix = function (names) {
                    return ` chance to inflict ${reduction_turns} turn ${names.join("/")}`;
                }

                let ails = ailment_handler(options);
                //insert reduction values
                if (effect['inflict atk% debuff (2)'] !== undefined) {
                    ails = ails.replace("ATK", `${effect['inflict atk% debuff (2)']}% ATK`);
                }
                if (effect['inflict def% debuff (4)'] !== undefined) {
                    ails = ails.replace("DEF", `${effect['inflict def% debuff (4)']}% DEF`);
                }
                if (effect['inflict rec% debuff (6)'] !== undefined) {
                    ails = ails.replace("REC", `${effect['inflict rec% debuff (6)']}% REC`);
                }

                if (ails.length > 0) msg += `Adds ${ails} to attacks`;
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data, {
                    prefix: "of "
                });
                msg += get_turns(effect['buff turns'], msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '52': {
            desc: "BB Fill Rate Increase/BC Efficacy/Ares Buff",
            type: ['buff'],
            func: function (effect, other_data) {
                let msg = "";
                if (effect['bb gauge fill rate% buff']) {
                    msg += `${get_polarized_number(effect['bb gauge fill rate% buff'])}% BB gauge fill rate`;
                }

                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data, {
                    prefix: "of "
                });
                msg += get_turns(effect['buff turns (77)'], msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '53': {
            desc: "Ailment Reflect",
            type: ["buff"],
            func: function (effect, other_data) {
                let msg = "";
                let options = {};
                options.values = [
                    effect["counter inflict injury% (81)"],
                    effect["counter inflict poison% (78)"],
                    effect["counter inflict sick% (80)"],
                    effect["counter inflict weaken% (79)"],
                    effect["counter inflict curse% (82)"],
                    effect["counter inflict paralysis% (83)"]
                ];

                options.suffix = function (names) {
                    if (names.length === 6) {
                        return " chance to inflict any status ailment";
                    } else {
                        return ` chance to inflict ${names.join("/")}`;
                    }
                }

                let ails = ailment_handler(options);
                if (ails.length > 0) msg += `Adds ${ails} when hit`;
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data);
                msg += get_turns(effect['counter inflict ailment turns'], msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '54': {
            desc: "Critical Hit Damage",
            type: ["buff"],
            func: function (effect, other_data) {
                var msg = "";
                if (effect['crit multiplier%']) msg += get_polarized_number(effect["crit multiplier%"]) + "% crit DMG";

                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data);
                msg += get_turns(effect['buff turns (84)'], msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '55': {
            desc: "Elemental Weakness Damage (EWD)",
            notes: ["FWETLD corresponds to fire, water, earth, thunder, light, and dark, respectively"],
            type: ["buff"],
            func: function (effect, other_data) {
                let msg = "";
                let options = {
                    values: [
                        effect['fire units do extra elemental weakness dmg'],
                        effect['water units do extra elemental weakness dmg'],
                        effect['earth units do extra elemental weakness dmg'],
                        effect['thunder units do extra elemental weakness dmg'],
                        effect['light units do extra elemental weakness dmg'],
                        effect['dark units do extra elemental weakness dmg'],
                    ]
                };

                let any_element = (effect['fire units do extra elemental weakness damage'] || effect['water units do extra elemental weakness damage'] ||
                    effect['earth units do extra elemental weakness damage'] || effect['thunder units do extra elemental weakness damage'] ||
                    effect['light units do extra elemental weakness damage'] || effect['dark units do extra elemental weakness damage']);

                let elements = elemental_bool_handler(options);
                if (effect['elemental weakness multiplier%'] || any_element) {
                    msg += `${get_polarized_number(effect['elemental weakness multiplier%'] || 0)}%${(elements.length > 0 ? ` ${elements} ` : " ")}EWD to attacks`;
                }

                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data, {
                    prefix: "of "
                });
                msg += get_turns(effect['elemental weakness buff turns'], msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '56': {
            desc: "Chance Angel Idol (AI)",
            notes: ["This buff cannot be buff wiped"],
            type: ["buff"],
            func: function (effect, other_data) {
                var msg = "";

                if (effect["angel idol recover chance%"])
                    msg += `${effect["angel idol recover chance%"]}% chance Angel Idol`;
                if (effect["angel idol recover hp%"])
                    msg += " (recovers " + effect["angel idol recover hp%"] + "% HP on proc)";

                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data);
                msg += get_turns(effect['angel idol buff turns (91)'], msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '57': {
            desc: "BC Drop Resistance",
            type: ['buff'],
            notes: ['A positive value means that less BC are likely to be dropped when hit', 'A negative value means that more BC are likely to be dropped when hit'],
            func: function (effect, other_data) {
                let msg = "";

                let options = {
                    all: [
                        { value: effect['base bc drop% resist buff'], name: "base" },
                        { value: effect['buffed bc drop% resist buff'], name: "buffed" }
                    ],
                    numberFn: (d) => { return `${get_polarized_number(d)}% `; }
                }

                let resistances = multi_param_buff_handler(options);

                if (resistances.length > 0)
                    msg += `${resistances} BC drop resistance`;

                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data);
                msg += get_turns(effect['bc drop% resist buff turns (92)'], msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '58': {
            desc: "Spark Vulnerability to Enemy",
            type: ["debuff"],
            func: function (effect, other_data) {
                var msg = "";
                if (effect["spark dmg received apply%"] || effect["spark dmg% received"]) {
                    msg += `${effect["spark dmg received apply%"] || 0}% chance to inflict ${get_polarized_number(effect["spark dmg% received"] || 0)}% Spark vulnerability debuff`;
                }

                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                msg += get_turns(+(effect["spark dmg received debuff turns (94)"] || 0) + 1, msg, other_data.sp, this.desc);
                if (!other_data.sp) msg += get_target(effect, other_data);
                return msg;
            }
        },
        '61': {
            desc: "Team BB Gauge Scaling Attack",
            type: ['attack'],
            func: function (effect, other_data) {
                other_data = other_data || {};
                let damage_frames = other_data.damage_frames || {};
                var numHits = damage_frames.hits || "NaN";
                var max_total = (+effect["bb base atk%"] || 0) + (+effect["bb max atk% based on ally bb gauge and clear bb gauges"] || 0);
                var msg = "";
                if (!other_data.sp) {
                    msg += numHits.toString() + ((numHits === 1) ? " hit" : " hits");
                }
                if (effect["bb base atk%"] || effect["bb max atk% based on ally bb gauge and clear bb gauges"]) {
                    if (effect["bb base atk%"] !== max_total)
                        msg += ` ${get_formatted_minmax(effect["bb base atk%"] || 0, max_total)}%`;
                    else
                        msg += ` ${max_total}-${max_total}%`;
                }

                if (!other_data.sp) msg += " ";
                else msg += " to BB ATK%";

                if (!other_data.sp) {
                    msg += (effect["target area"].toUpperCase() === "SINGLE") ? "ST" : effect["target area"].toUpperCase();
                }
                let extra = [];
                if (effect["bb flat atk"]) extra.push("+" + effect["bb flat atk"] + " flat ATK");
                if (damage_frames["hit dmg% distribution (total)"] !== undefined && damage_frames["hit dmg% distribution (total)"] !== 100)
                    extra.push(`at ${damage_frames["hit dmg% distribution (total)"]}% power`);
                if (effect['bb max atk% based on ally bb gauge and clear bb gauges']) extra.push(`proportional to allies' BB gauges, drains BB gauges`);
                if (extra.length > 0) msg += ` (${extra.join(", ")})`;

                // msg += regular_atk_helper(effect);

                if (!other_data.sp) {
                    if (effect["target type"] !== "enemy") msg += ` to ${effect["target type"]}`;
                }
                return msg;
            }
        },
        '62': {
            desc: "Elemental Barrier",
            type: ["buff"],
            notes: ["This buff cannot be buff wiped", "Unless otherwise specified, assume that the barrier has 100% DMG absorption"],
            func: function (effect, other_data) {
                var msg = "";
                let extra_effects = [];
                if (effect["elemental barrier hp"])
                    msg += `${effect["elemental barrier hp"]} HP`;
                if (effect["elemental barrier def"] !== undefined)
                    extra_effects.push(`${effect["elemental barrier def"]} DEF`);
                if (effect["elemental barrier absorb dmg%"] !== undefined && effect["elemental barrier absorb dmg%"] != 100) {
                    extra_effects.push(`${effect["elemental barrier absorb dmg%"]}% DMG absorption`);
                }
                if (extra_effects.length > 0)
                    msg += ` (${extra_effects.join("/")})`;
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                msg += ` ${to_proper_case(effect["elemental barrier element"] || "none")} barrier`;
                if (!other_data.sp) msg = msg.replace("All", "all elemental");
                else msg = msg.replace("All ", "");
                msg = msg.replace("None", "non-elemental");
                if (!other_data.sp) msg += get_target(effect, other_data, {
                    prefix: "on "
                });
                return msg;
            }
        },
        '64': {
            desc: "Consective Use Boosting Attack",
            type: ["attack"],
            notes: ["This refers to attacks whose power increases on consecutive use"],
            func: function (effect, other_data) {
                other_data = other_data || {};
                let damage_frames = other_data.damage_frames || {};
                var numHits = damage_frames.hits || "NaN";
                var max_total = (+effect["bb base atk%"] || 0) + (+effect["bb atk% inc per use"] || 0) * (+effect["bb atk% max number of inc"] || 0);
                var msg = "";
                if (!other_data.sp) {
                    msg += numHits.toString() + ((numHits === 1) ? " hit" : " hits");
                }
                if (effect["bb base atk%"] || effect["bb atk% inc per use"] || effect['bb atk% max number of inc']) {
                    if (effect["bb base atk%"] !== max_total)
                        msg += ` ${get_formatted_minmax(effect["bb base atk%"] || 0, max_total)}%`;
                    else
                        msg += ` ${max_total}-${max_total}%`;
                }

                if (!other_data.sp) msg += " ";
                else msg += " to BB ATK%";

                if (!other_data.sp) {
                    msg += (effect["target area"].toUpperCase() === "SINGLE") ? "ST" : effect["target area"].toUpperCase();
                }
                let extra = [];
                if (effect["bb flat atk"]) extra.push("+" + effect["bb flat atk"] + " flat ATK");
                if (damage_frames["hit dmg% distribution (total)"] !== undefined && damage_frames["hit dmg% distribution (total)"] !== 100)
                    extra.push(`at ${damage_frames["hit dmg% distribution (total)"]}% power`);
                // if (effect['bb added atk% proportional to hp']) extra.push(`proportional to ${effect['bb added atk% proportional to hp']} HP`);
                if(effect["bb atk% inc per use"] || effect['bb atk% max number of inc']){
                    extra.push(`${get_polarized_number(effect["bb atk% inc per use"])}%/use, max ${effect["bb atk% max number of inc"]} uses`);
                }
                if (extra.length > 0) msg += ` (${extra.join(", ")})`;

                msg += regular_atk_helper(effect);

                if (!other_data.sp) {
                    if (effect["target type"] !== "enemy") msg += ` to ${effect["target type"]}`;
                }
                return msg;
            }
        },
        '65': {
            desc: "Damage Boost to Status Afflicted Foes",
            type: ["buff"],
            func: function (effect, other_data) {
                var msg = "";
                if (effect["atk% buff when enemy has ailment"])
                    msg += `${get_polarized_number(effect["atk% buff when enemy has ailment"])}% ATK to status afflicted foes to attacks`;
                
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data,{
                    prefix: "of "
                });
                msg += get_turns(effect['atk% buff turns (110)'], msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '66': {
            desc: "Chance Revive",
            type: ["effect"],
            func: function (effect, other_data) {
                var msg = "";
                if (effect['revive unit chance%'] || effect['revive unit hp%'])
                    msg +=`${effect["revive unit chance%"] || 0}% chance to revive`
                
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data, {
                    prefix: ""
                });
                if (effect['revive unit chance%'] || effect['revive unit hp%'])
                    msg += ` with ${effect["revive unit hp%"] || 0 }% HP`;
                return msg;
            }
        },
        '67': {
            desc: "BC Fill on Spark",
            type: ["buff"],
            func: function (effect, other_data) {
                var msg = "";
                if (effect["bc fill on spark%"] || effect["bc fill on spark high"] || effect["bc fill on spark low"]){
                    if (effect["bc fill on spark%"] && effect["bc fill on spark%"] === 100)
                        msg += "Fills ";
                    else
                        msg += `${effect["bc fill on spark%"] || 0}% chance to fill `;
                    msg += `${get_formatted_minmax(effect["bc fill on spark low"] || 0, effect["bc fill on spark high"] || 0) } BC on spark`;
                }
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data, {
                    prefix: "for "
                });
                msg += get_turns(effect['bc fill on spark buff turns (111)'], msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '68': {
            desc: "Guard Mitigation",
            type: ['buff'],
            func: function(effect,other_data){
                let msg = "";
                if (effect['guard increase mitigation%']){
                    msg += `${get_polarized_number(effect['guard increase mitigation%'])}% guard mitigation`;
                }
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data);
                msg += get_turns(effect['guard increase mitigation buff turns (113)'], msg, other_data.sp, this.desc);
                return msg;
            }

        },
        '69': {
            desc: "BC Fill on Guard",
            type: ["effect"],
            notes: ['The BC fill mentioned here is an instant increase, not gradual'],
            func: function (effect, other_data) {
                var msg = "";
                if (effect['bb bc fill% on guard']) msg += `${get_polarized_number(effect["bb bc fill% on guard"])}% BB gauge`;
                if (effect["bb bc fill on guard"] !== undefined) msg += `${msg.length > 0 ? " and " : ""}${get_polarized_number(effect["bb bc fill on guard"])} BC fill`;
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (effect["bb bc fill on guard"] !== undefined) msg += ` when guarding`;
                if (!other_data.sp) msg += get_target(effect, other_data);
                msg += get_turns(effect['bb bc fill on guard buff turns (114)'], msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '71': {
            desc: "BB Gauge Fill Rate Debuff/Ares Debuff",
            type: ['debuff'],
            notes: ['As of June 27, 2017, this is only found on enemy skills'],
            func: function(effect,other_data){
                let msg = "";
                if (effect['bb fill inc%']) {
                    msg += `${get_polarized_number(effect['bb fill inc%'])}% BB gauge fill rate`;
                }

                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data, {
                    prefix: "of "
                });
                msg += get_turns(effect['bb fill inc buff turns (112)'], msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '73': {
            desc: "Stat Down/Reduction Negation/Resistance",
            type: ["buff"],
            func: function (effect, other_data) {
                let options = {};
                options.values = [
                    effect["atk down resist% (120)"],
                    effect["def down resist% (121)"],
                    effect["rec down resist% (122)"],
                ];

                options.suffix = function (names) {
                    if (names.length === 6) {
                        return " all stat reductions";
                    } else {
                        return ` ${names.join("/")}`;
                    }
                };

                options.numberFn = function (value) {
                    if (value == 100)
                        return "Negates";
                    else
                        return `${value}% resistance to`;
                };

                options.special_case = {
                    isSpecialCase: function (value, names) {
                        // debug_log("Received:", value, names.length, value == 100, names.length === 6);
                        return value == 0 || names.length === 3;
                    },
                    func: function (value, names) {
                        if(value == 0) return "";
                        if(value == 100)
                            return "Negates all stat reductions";
                        else   
                            return `${value}% resistance to all stat reductions`;
                    }
                };

                let msg = "";
                if (effect["atk down resist% (120)"] || effect["def down resist% (121)"] || effect["rec down resist% (122)"])
                    msg += ailment_handler(options);
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;

                if (!other_data.sp) msg += get_target(effect, other_data, {
                    prefix: 'for '
                });
                msg += get_turns(effect['stat down immunity buff turns'], msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '75': {
            desc: 'Element Scaling Attack',
            type: ['attack'],
            notes: ['The original description on BB 20892 states that BB Atk would be boosted relative to number of water types in party','However, data shows ATK, DEF, and REC values that may be boosted at time of attack', "I'm not sure if the value given is a base or a max, so this value may be incorrect"],
            func: function (effect, other_data) {
                other_data = other_data || {};
                let damage_frames = other_data.damage_frames || {};
                var numHits = damage_frames.hits || "NaN";
                var max_total = (+effect["atk% buff (1)"] || 0);
                var msg = "";
                if (!other_data.sp) {
                    msg += numHits.toString() + ((numHits === 1) ? " hit" : " hits");
                }
                if (effect["atk% buff (1)"]) {
                    msg += ` 0-${max_total}%`;
                }

                if (!other_data.sp) msg += " ";
                else msg += " to BB ATK%";

                if (!other_data.sp) {
                    msg += (effect["target area"].toUpperCase() === "SINGLE") ? "ST" : effect["target area"].toUpperCase();
                }
                let extra = [];
                if (damage_frames["hit dmg% distribution (total)"] !== undefined && damage_frames["hit dmg% distribution (total)"] !== 100)
                    extra.push(`at ${damage_frames["hit dmg% distribution (total)"]}% power`);
                if (effect['counted element for buff multiplier']) extra.push(`proportional to number of ${to_proper_case(effect['counted element for buff multiplier'])} types in party`);
                if (effect['def% buff (3)'] || effect['rec% buff (5)']){
                    let stat_msg = hp_adr_buff_handler(undefined, undefined, effect['def% buff (3)'],effect['rec% buff (5)'],{
                        message_separator: " and "
                    });
                    extra.push(stat_msg + " to self for duration of attack");
                }
                if (extra.length > 0) msg += ` (${extra.join(", ")})`;

                msg += regular_atk_helper(effect);

                if (!other_data.sp) {
                    if (effect["target type"] !== "enemy") msg += ` to ${effect["target type"]}`;
                }
                return msg;
            }
        },
        '76': {
            desc: "Chance for Extra Actions",
            type: ['buff'],
            func: function(effect,other_data){
                let msg = "";

                if (effect['chance% for extra action'] || effect['max number of extra actions']){
                    msg += `Adds ${effect['chance% for extra action'] || 0}% chance to do at most ${effect['max number of extra actions'] || 0} extra ${effect['max number of extra actions'] === 1 ? "action" : "actions"}`;
                }

                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data);
                msg += get_turns(effect['extra action buff turns (123)'], msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '78': {
            desc: "Self ATK/DEF/REC/Crit Rate",
            notes: ["Stacks with the regular party ATK/DEF/REC/Crit Rate buff", "Example of a unit having both party and self is Silvie (840128)"],
            type: ["buff"],
            func: function (effect, other_data) {
                var msg = "";
                let own_msg = ((effect['target area']) === 'single' && (effect['target type']) === 'self') ? "own " : "";
                if (effect["self atk% buff"] || effect["self def% buff"] || effect["self rec% buff"]) { //regular tri-stat
                    msg += hp_adr_buff_handler(undefined, effect["self atk% buff"], effect["self def% buff"], effect["self rec% buff"], {
                        numberFn: (v) => {return `${v}% ${own_msg}`;}
                    });
                }
                if (effect["self crit% buff"]) {//crit rate buff
                    if (msg.length > 0) msg += ", ";
                    msg += get_polarized_number(effect["self crit% buff"]) + `% ${own_msg}crit rate`;
                }

                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp && own_msg.length === 0) msg += get_target(effect, other_data);
                msg += get_turns(effect["self stat buff turns"], msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '83': {
            desc: "Spark Critical",
            type: ["buff"],
            func: function (effect, other_data) {
                var msg = "";
                if (effect["spark dmg inc chance%"] || effect["spark dmg inc% buff"])
                    msg += `${effect["spark dmg inc chance%"] || 0}% chance for ${get_polarized_number(effect["spark dmg inc% buff"] || 0)}% spark critical`;
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data);
                msg += get_turns(effect["spark dmg inc buff turns (131)"], msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '84': {
            desc: "OD Fill Rate",
            type: ["buff"],
            func: function (effect, other_data) {
                var msg = "";
                if (effect["od fill rate% buff"])
                    msg += `${get_polarized_number(effect["od fill rate% buff"])}% OD gauge fill rate`;
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data);
                msg += get_turns(effect["od fill rate buff turns (132)"], msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '85': {
            desc: "Heal on Hit",
            type: ["buff"],
            func: function (effect, other_data) {
                let msg = "";
                
                if (effect["hp recover from dmg chance"] || effect["hp recover from dmg% low"] || effect["hp recover from dmg% high"]){
                    msg += `${effect["hp recover from dmg chance"] || 0}% chance to heal `;
                    msg += `${get_formatted_minmax(effect["hp recover from dmg% low"] || 0, effect["hp recover from dmg% high"] || 0)}% DMG when hit`;
                }

                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data);
                msg += get_turns(effect["hp recover from dmg buff turns (133)"], msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '86': {
            desc: "Chance HP Drain/Absorption When Attacking",
            type: ['buff'],
            func: function(effect,other_data){
                let msg = "";

                if (effect["hp drain chance%"] || effect["hp drain% low"] || effect["hp drain% high"]) {
                    if(effect['hp drain chance%'] != 100)
                        msg += `${effect["hp drain chance%"] || 0}% chance of healing `;
                    else
                        msg += "Heals "
                    msg += `${get_formatted_minmax(effect["hp drain% low"] || 0, effect["hp drain% high"] || 0)}% of damage dealt`;
                }

                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data,{
                    prefix: 'for '
                });
                msg += get_turns(effect["hp drain buff turns (134)"], msg, other_data.sp, this.desc);
                return msg;
            }    
        },
        '87': {
            desc: "Chance to Heal on Spark",
            type: ['buff'],
            func: function (effect, other_data) {
                let msg = "";

                if (effect["spark recover hp chance%"] || effect["spark recover hp low"] || effect["spark recover hp high"]) {
                    if (effect["spark recover hp chance%"] == 100)
                        msg += "Heals ";
                    else
                        msg += `${effect["spark recover hp chance%"] || 0}% chance of healing `;
                    msg += `${get_formatted_minmax(effect["spark recover hp low"] || 0, effect["spark recover hp high"] || 0)} HP on spark`;
                }

                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data,{
                    prefix: 'for '
                });
                msg += get_turns(effect["spark recover hp buff turns (135)"], msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '88': {
            desc: "Spark Damage (Self)",
            type: ["buff"],
            notes: ["Should stack with other spark buffs (such as 23)"],
            func: function (effect, other_data) {
                let msg = "";
                if (effect["spark dmg inc%"]) msg += get_polarized_number(effect["spark dmg inc%"]);
                if(msg.length > 0){
                    if (effect["target area"] === "single" && effect["target type"] === "self") {
                        msg += "% own spark DMG";
                    }else{
                        msg += "% spark DMG";
                    }
                }
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp && (effect['target area'] !== 'single' || effect['target type'] !== 'self')) msg += get_target(effect, other_data, {
                    prefix: "to attacks of "
                });
                msg += get_turns(effect["spark dmg inc% turns (136)"], msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '93': {
            desc: "Critical, Spark, and EWD Damage Resistance",
            type: ['buff'],
            notes: ['Negation means that the buff has 100% resistance'],
            func: function (effect, other_data) {
                let msg = "";
                let resistances = [];
                let negations = [];

                //check for available resistances/negations
                let critResist = base_buffed_resistance_handler(effect['crit dmg base damage resist% (143)'], effect['crit dmg buffed damage resist% (143)'],"Critical");
                if(critResist.length > 0){
                    if (critResist.indexOf("%") === -1){ //100% resistance -> negation
                        negations.push(critResist);
                    }else{
                        resistances.push(critResist);
                    }
                }

                let ewdResist = base_buffed_resistance_handler(effect['strong base element damage resist% (144)'], effect['strong buffed element damage resist% (144)'],"Elemental");
                if(ewdResist.length > 0){
                    if(ewdResist.indexOf("%") === -1){ //100% resistance -> negation
                        negations.push(ewdResist);
                    }else{
                        resistances.push(ewdResist);
                    }
                }

                let sparkResist = base_buffed_resistance_handler(effect['spark dmg base resist% (145)'], effect['spark dmg buffed resist% (145)'],"Spark");
                if(sparkResist.length > 0){
                    if(sparkResist.indexOf("%") === -1){ //100% resistance -> negation
                        negations.push(sparkResist);
                    }else{
                        resistances.push(sparkResist);
                    }
                }

                //join them together in the message
                if(negations.length > 0){
                    msg += `${negations.join("/")} damage negation`;
                }
                if (resistances.length > 0){
                    if(msg.length > 0) msg += " and ";
                    msg += `${resistances.join(", ")} damage resistance`;
                }

                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data);
                msg += get_turns(effect['dmg resist turns'], msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '94': {
            desc: "AOE Normal Attack",
            type: ['buff'],
            notes: ['Add the damage noted in this buff to 100% to get the actual damage of normal attacks','The data doesn\'t seems to have a turn parameter as of June 29, 2017'],
            func: function (effect, other_data) {
                let msg = "";
                if (effect['chance to aoe'] || effect['aoe atk inc%']){
                    if (effect['chance to aoe'] === 100){
                        msg += "Normal attacks ";
                    }else{
                        msg += `${effect['chance to aoe']}% chance for normal attacks to `;
                    }
                    msg += `hit all foes (at ${(get_polarized_number(effect['aoe atk inc%'] || 0))}% damage)`;
                }

                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data);
                msg += get_turns(effect["buff turns"] || "???", msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '902': {
            desc: "Timed ATK (Raid)",
            type: ['buff','timed'],
            notes: ['Found on item 70400'],
            func: function (effect, other_data) {
                let msg = "";
                if (effect['atk% buff (100)']){
                    msg += `${get_polarized_number(effect['atk% buff (100)'])}% ATK`;
                }
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data);
                msg += ` for ${effect['buff timer (seconds)']} seconds`;
                return msg;
            }
        },
        '10000': {
            desc: "Taunt",
            type: ['buff'],
            notes: ['Data doesn\'t seem right for BB 8410022', 'Values here should be additive with other similar buffs like proc 5'],
            func: function(effect,other_data){
                let msg = "";
                let taunt_values;
                if (effect['def% buff'] || effect['atk% buff'] || effect['crit% buff']){
                    let options = {
                        all: [
                            { name: "ATK", value: effect['atk% buff']},
                            { name: "DEF", value: effect['def% buff']},
                            { name: "Crit Rate", value: effect['crit% buff']}
                        ],
                        numberFn: (v) => { return `${get_polarized_number(v)}% `}
                    };

                    taunt_values = multi_param_buff_handler(options);

                }
                msg += `Casts Taunt`;
                if(taunt_values)
                    msg += ` (${taunt_values})`;
                else
                    msg += ` (no extra buffs)`;

                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data);
                msg += get_turns(effect["taunt turns (10000)"], msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '10001': {
            desc: "Stealth",
            type: ['buff'],
            notes: ['Values here should be additive with other similar buffs like proc 5'],
            func: function (effect, other_data) {
                let msg = "";
                let stealth_values;
                if (effect['atk% buff'] || effect['def% buff'] || effect['rec% buff'] || effect['crit% buff']) {
                    let options = {
                        all: [
                            { name: "ATK", value: effect['atk% buff'] },
                            { name: "DEF", value: effect['def% buff'] },
                            { name: "REC", value: effect['rec% buff'] },
                            { name: "Crit Rate", value: effect['crit% buff'] }
                        ],
                        numberFn: (v) => { return `${get_polarized_number(v)}% ` }
                    };

                    stealth_values = multi_param_buff_handler(options);

                }
                msg += `Casts Stealth`;
                if (stealth_values)
                    msg += ` (${stealth_values})`;
                else
                    msg += ` (no extra buffs)`;

                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data);
                msg += get_turns(effect["stealth turns (10001)"], msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '10002': {
            desc: "Elemental Shield (GL)",
            type: ['buff'],
            func: function(effect,other_data){
                var msg = "";
                let extra_effects = [];
                if (effect["shield hp"])
                    msg += `${effect["shield hp"]} HP`;
                if (effect["shield def"] !== undefined)
                    extra_effects.push(`${effect["shield def"]} DEF`);
                if (extra_effects.length > 0)
                    msg += ` (${extra_effects.join("/")})`;
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                msg += ` ${to_proper_case(effect["shield element"] || "none")} shield`;
                if (!other_data.sp) msg = msg.replace("All", "non-elemental"); //based on description of item 800404
                else msg = msg.replace("All ", "");
                if (!other_data.sp) msg += get_target(effect, other_data, {
                    prefix: "on "
                });
                msg += get_turns(effect["shield turns (10002)"], msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '11000': {
            desc: "HP Scaling Attack (GL)",
            type: ["attack"],
            func: function (effect, other_data) {
                other_data = other_data || {};
                let damage_frames = other_data.damage_frames || {};
                var numHits = damage_frames.hits || "NaN";
                var max_total = (+effect["bb base atk%"] || 0) + (+effect["bb added atk% based on hp"] || 0);
                var msg = "";
                if (!other_data.sp) {
                    msg += numHits.toString() + ((numHits === 1) ? " hit" : " hits");
                }
                if (effect["bb base atk%"] || effect["bb added atk% based on hp"]) {
                    if (effect["bb base atk%"] !== max_total)
                        msg += ` ${get_formatted_minmax(effect["bb base atk%"] || 0, max_total)}%`;
                    else
                        msg += ` ${max_total}-${max_total}%`;
                }

                if (!other_data.sp) msg += " ";
                else msg += " to BB ATK%";

                if (!other_data.sp) {
                    msg += (effect["target area"].toUpperCase() === "SINGLE") ? "ST" : effect["target area"].toUpperCase();
                }
                let extra = [];
                if (effect["bb flat atk"]) extra.push("+" + effect["bb flat atk"] + " flat ATK");
                if (damage_frames["hit dmg% distribution (total)"] !== undefined && damage_frames["hit dmg% distribution (total)"] !== 100)
                    extra.push(`at ${damage_frames["hit dmg% distribution (total)"]}% power`);
                if (effect['bb added atk% proportional to hp']) extra.push(`proportional to ${effect['bb added atk% proportional to hp']} HP`);
                if (extra.length > 0) msg += ` (${extra.join(", ")})`;

                msg += regular_atk_helper(effect);

                if (!other_data.sp) {
                    if (effect["target type"] !== "enemy") msg += ` to ${effect["target type"]}`;
                }
                return msg;
            }
        },
    };//end proc_buffs

    //general handler for all unknown procs
    function unknown_proc_handler(effect, other_data) {
        let msg = "";
        if (effect['unknown proc param']) msg += `Unknown proc effects {${effect['unknown proc param']}}`;
        if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
        if (!other_data.sp) msg += get_target(effect, other_data);
        return msg;
    }

    function unknown_proc_attack_handler(effect, other_data) {
        other_data = other_data || {};
        let damage_frames = other_data.damage_frames || {};
        var numHits = damage_frames.hits || "NaN";
        var msg = `${numHits} hit attack (?)`;
        if (effect['unknown proc param'])
            msg += `, unknown proc effects {${effect['unknown proc param']}}`;
        if (!other_data.sp) msg += get_target(effect, other_data);
        return msg;
    }

    var unknown_proc_buffs = {
        '': {
            desc: "Damage over Time (EU Version?)",
            type: ['debuff', 'unknown'],
            notes: ['This is first found on the SBB for 720236', 'Values for this aren\'t fully known, just guessed based on the numbers', 'It uses the interpreter for proc 44 to generate the description'],
            func: function (effect, other_data) {
                let data = effect['unknown proc param'].split(',');
                // debug_log(data);
                if (data.length === 6) { //fix for bb 730236 by adding missing index (?) parameter
                    data = data.slice(0, 2).concat([0]).concat(data.slice(2));
                }
                // debug_log(data);
                let proc_44 = {
                    'dot atk%': parseInt(data[0]),
                    'dot flat atk': parseInt(data[1]),
                    'dot unit index': parseInt(data[2]),
                    'dot dmg%': parseInt(data[3]),
                    'dot element affected': data[4] == 1,
                    'dot turns (71)': parseInt(data[5]),
                    'unknown proc param6': data[6],
                    'target area': effect['target area'],
                    'target type': effect['target type'],
                    'proc id': 44
                };
                return proc_buffs['44'].func(proc_44, other_data);
            }
        },
        '0': {
            desc: "None",
            type: ["none"],
            notes: ["First found on item 800104"],
            func: function (effect) {
                return "No effect";
            }
        },
        '2-5': {
            desc: "Greatly replenishes a Unit's HP & boosts DEF and REC for 2 turns",
            type: ["effect"],
            notes: ["First found on item Nian Gao (800305)"],
            func: function (effect, other_data) {
                let params = effect["unknown proc param"].split(",");
                // let params = effect["unknown proc param"].split("-");
                // let params2 = params[0].split(","), params5 = params[1].split(",");
                // let proc2 = {
                //     "heal low": params2[0],
                //     "heal high": params2[1],
                //     "rec added% (from healer)": params[2],
                //     "target area": (params2[3] === 0) ? "single" : "aoe",
                //     "target type": (params2[3] === 0) ? "self" : "party"
                // };
                // let proc5 = {

                // }
                let [min_heal, max_heal, def, rec, turns] = [params[0], params[1], params[5], params[6], params[8]];
                let msg = `${get_formatted_minmax(min_heal, max_heal)} HP burst heal and ${adr_buff_handler(undefined, def, rec)} for ${turns} turns`;
                msg += get_target(other_data);
                return msg;
            }
        },
        '27 ': {
            desc: "Unknown values",
            type: ["unknown"],
            notes: ["Note that this is unknown proc '27 ', and not '27'", "This is only found on BB 70640027"],
            func: function (effect, other_data) {
                return unknown_proc_handler(effect, other_data);
            }
        },
        '37': {
            desc: "Add a Unit to Battle",
            type: ['effect', 'unknown'],
            notes: ['Not much is known about this except that it adds a unit to the field', 'This is first found on BB 3181'],
            func: function (effect, other_data) {
                let msg = "";
                if (effect['unknown proc param'])
                    msg += `Adds a unit to the battle`;

                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) {
                    switch (effect['target type']) {
                        case "self": msg += " on own side"; break;
                        case "enemy": msg += " on enemy's side"; break;
                        case "party": msg += " on ally's side"; break;
                    }
                }

                if (effect['unknown proc param'])
                    msg += `. Unknown params {${effect['unknown proc param']}}`;

                return msg;
            }
        },
        '42': {
            desc: "Unknown values",
            type: ['unknown'],
            notes: ['This is first found on BB 3000655'],
            func: function (effect, other_data) {
                return unknown_proc_attack_handler(effect, other_data);
            }
        },
        '46': {
            desc: "Unknown attack",
            type: ['attack', 'unknown'],
            notes: ['This is first found on BB 2002561'],
            func: function (effect, other_data) {
                return unknown_proc_attack_handler(effect, other_data);
            }
        },
        '48': {
            desc: "Unknown attack",
            type: ['attack', 'unknown'],
            notes: ['This is first found on BB 310990'],
            func: function (effect, other_data) {
                return unknown_proc_attack_handler(effect, other_data);
            }
        },
        '49': {
            desc: "Unknown values",
            type: ['unknown'],
            notes: ['This is first found on BB 3669'],
            func: function (effect, other_data) {
                return unknown_proc_handler(effect, other_data);
            }
        },
        '50': {
            desc: "Damage Reflect",
            type: ['buff'],
            notes: ['I\'ve interpreted this to the best of my ability, but the meanings for the values may be incorrect', 'First found on BB 310833, but it\'s more remembered by Revenge Shift (BB 5000193)'],
            func: function (effect, other_data) {
                let msg = "";
                let dmg_reflect_turns;
                if (effect['unknown proc param']) {
                    let data = effect['unknown proc param'].split(",");
                    let dmg_reflect_low = data[0];
                    let dmg_reflect_high = data[1];
                    let dmg_reflect_chance = data[2];
                    dmg_reflect_turns = data[3];
                    let unknown_params = data.slice(4);
                    if (dmg_reflect_low || dmg_reflect_high || dmg_reflect_chance)
                        msg += `Adds ${dmg_reflect_chance}% chance to reflect ${get_formatted_minmax(dmg_reflect_low, dmg_reflect_high)}% damage when hit`;
                    if (unknown_params.length > 0) {
                        msg += ` (unknown extra ${unknown_params.length === 1 ? "value" : "values"} ${unknown_params.join(",")})`;
                    }
                }
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data);
                if (dmg_reflect_turns !== undefined) msg += get_turns(dmg_reflect_turns, msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '59': {
            desc: "BB ATK Reduction",
            type: ['debuff'],
            func: function (effect, other_data) {
                let msg = "";
                let data = effect['unknown proc param'].split(",");
                let [bb, sbb, ubb] = [data[0], data[1], data[2]];
                let turns = data[3];
                let unknown_params = data.slice(4);
                if (bb || sbb || ubb)
                    msg += bb_atk_buff_handler(bb, sbb, ubb, {
                        suffix: " ATK"
                    });

                if (unknown_params.length > 0) {
                    msg += ` (unknown extra ${unknown_params.length === 1 ? "value" : "values"} ${unknown_params.join(",")})`;
                }

                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data);
                msg += get_turns(turns, msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '60': {
            desc: "Unknown values",
            type: ['unknown'],
            notes: ['This is only found on BB 5000253'],
            func: function (effect, other_data) {
                return unknown_proc_handler(effect, other_data);
            }
        },
        '63': {
            desc: "Selective Buff Wipe",
            type: ['debuff'],
            notes: ['The default description used for this can be found on BB 2760006', 'Don\'t know the exact meanings of the unknown proc params'],
            func: function (effect, other_data) {
                let msg = "";
                if (effect['unknown proc param']) {
                    msg += "clear all buff except Angel Idol (?)";
                    msg += ` (unknown proc effects {${effect['unknown proc param']}})`;
                }

                if (!other_data.sp) msg += get_target(effect, other_data, {
                    prefix: "of "
                });
                return msg;
            }
        },
        '70': {
            desc: "Unknown values",
            type: ['unknown'],
            notes: ['This is first found on BB 9103900'],
            func: function(effect,other_data){
                return unknown_proc_handler(effect,other_data);
            }
        },
        '79': {
            desc: "Increase XP Received",
            type: ['buff'],
            notes: ['This seems to apply to regular XP, not anything in Summoner Arc'],
            func: function(effect,other_data){
                let msg = "";
                let data = effect['unknown proc param'].split(",");
                if(data.length > 0){
                    let xp_boost = (100 + (+data[0]))/100;
                    let timer = data[1];
                    msg += `gain x${xp_boost} XP`;
                    if(timer){
                        msg += ` for ${timer} minutes`;
                    }else{
                        msg += ` from the next quest`;
                    }
                }
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                return msg;
            }
        },
        '82': {
            desc: "Unknown values",
            type: ['unknown'],
            notes: ['This is first found on BB 2004356'],
            func: function(effect,other_data){
                return unknown_proc_handler(effect,other_data);
            }
        },
        '85 ': {
            desc: "Heal on Hit (typo)",
            type: ["buff"],
            notes: ['This is the same as the regular proc 85 (Heal on Hit)', 'There may have been a typo putting this into the data, causing it to look like an unknown proc','This is first found on BB 760247'],
            func: function(effect,other_data){
                let msg = "";
                let proc_85_effect;
                if(effect['unknown proc param']){
                    let data = effect['unknown proc param'].split(',');
                    proc_85_effect = {
                        'hp recover from dmg% low': data[0],
                        'hp recover from dmg% high': data[1],
                        'hp recover from dmg chance': data[2],
                        'hp recover from dmg buff turns (133)': data[3],
                        'target area': effect['target area'],
                        'target type': effect['target type']
                    };
                    msg += proc_buffs['85'].func(proc_85_effect,other_data);
                }

                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                return msg;
            }

        },
        '89': {
            desc: "Stat Conversion (Self)",
            type: ['buff', 'unknown'],
            notes: ['Should stack with the normal stat conversion (24)', 'This is first found on BB 60097', 'Not too sure if I translated these values correcty'],
            func: function(effect,other_data){
                let msg = "";
                if(effect['unknown proc param']){
                    // 4,10,0,0,3,10
                    let data = effect['unknown proc param'].split(",");
                    let proc_24_effect = {
                        'converted attribute': ((type) => {
                            switch(type){
                                case '1': return "ATK";
                                case '2': return "DEF";
                                case '3': return "REC";
                                case '4': return "HP";
                                default: return type;
                            }
                        })(data[0].toString()),
                        'atk% buff (46)': (data[1] != 0) ? data[1] : undefined,
                        'def% buff (47)': (data[2] != 0) ? data[2] : undefined,
                        'rec% buff (48)': (data[3] != 0) ? data[3] : undefined,
                        '% converted turns': data[4],
                        'target area': effect['target area'],
                        'target type': effect['target type']
                    };
                    // console.log(proc_24_effect);
                    msg += proc_buffs['24'].func(proc_24_effect,other_data);
                    if(data.slice(5).length > 0){
                        msg += `, unknown proc effects {${data.slice(5).join(",")}}`;
                    }
                }
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                return msg;
            }
        },
        '95': {
            desc: 'ES Lock',
            type: ['debuff'],
            notes: ['This can be found on BB 8470189'],
            func: function(effect,other_data){
                let msg = "";
                let es_lock_turns;
                if(effect['unknown proc param']){
                    let data = effect['unknown proc param'].split(",");
                    let es_lock_chance = parseInt(data[0]);
                    es_lock_turns = parseInt(data[1]);
                    if(!isNaN(es_lock_chance)){
                        if(es_lock_chance === 100){
                            msg += "Nullifies";
                        }else{
                            msg += `${es_lock_chance}% chance to nullify`;
                        }
                        msg += " ES effects";

                        if (data.slice(2).length > 0) {
                            msg += ` (unknown proc effects '${data.slice(2).join(",")}')`;
                        }
                    }
                }

                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data, {
                    prefix: "of "
                });
                msg += get_turns(es_lock_turns, msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '96': {
            desc: 'Sphere Lock',
            type: ['debuff'],
            notes: ['This can be found on BB 8470189'],
            func: function (effect, other_data) {
                let msg = "";
                let es_lock_turns;
                if (effect['unknown proc param']) {
                    let data = effect['unknown proc param'].split(",");
                    let es_lock_chance = parseInt(data[0]);
                    es_lock_turns = parseInt(data[1]);
                    if (!isNaN(es_lock_chance)) {
                        if (es_lock_chance === 100) {
                            msg += "Nullifies";
                        } else {
                            msg += `${es_lock_chance}% chance to nullify`;
                        }
                        msg += " sphere effects";
                    }

                    if (data.slice(2).length > 0) {
                        msg += ` (unknown proc effects '${data.slice(2).join(",")}')`;
                    }
                }

                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data, {
                    prefix: "of "
                });
                msg += get_turns(es_lock_turns, msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '97': {
            desc: "Attack to Specific Element (Opposing Type?)",
            type: ['attack'],
            notes: ['This can be found on unit 11047','Not sure what determines the targeted element','If the unit is a Fire type, then the weaker element would be Earth'],
            func: function(effect,other_data){
                other_data = other_data || {};
                let damage_frames = other_data.damage_frames || {};
                var numHits = damage_frames.hits || "NaN";
                var msg = "";
                if(effect['unknown proc param']){
                    let data = effect['unknown proc param'].split(",");
                    let translated_effect = {
                        'bb atk%': +data[1],
                        'bb flat atk': +data[2],
                        'unknown params': ([data[0]] || []).concat(data.slice(3)),
                        'target area': effect['target area'],
                        'target type': effect['target type']
                    };
                    if (!other_data.sp) {
                        msg += numHits.toString() + ((numHits === 1) ? " hit " : " hits ");
                    }

                    if (translated_effect["bb atk%"]) msg += `${translated_effect["bb atk%"]}%`;

                    if (!other_data.sp) msg += " ";
                    else msg += " to BB ATK%";

                    if (!other_data.sp) {
                        msg += (translated_effect["target area"].toUpperCase() === "SINGLE") ? "ST" : translated_effect["target area"].toUpperCase();
                    }
                    let extra = [];
                    if (translated_effect["bb flat atk"]) extra.push("+" + translated_effect["bb flat atk"] + " flat ATK");
                    if (damage_frames["hit dmg% distribution (total)"] !== undefined && damage_frames["hit dmg% distribution (total)"] !== 100)
                        extra.push(`at ${damage_frames["hit dmg% distribution (total)"]}% power`);
                    if(translated_effect['unknown params'].length > 0){
                        extra.push( `unknown proc effects '${translated_effect['unknown params'].join(",")}'`);
                    }
                    if (extra.length > 0) msg += ` (${extra.join(", ")})`;

                    msg += regular_atk_helper(translated_effect);

                    if (!other_data.sp) msg += get_target(effect, other_data, {
                        prefix: "on ",
                        suffix: " of the weaker element"
                    });
                }
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                return msg;
            }
        },
        '113': {
            desc: "OD Fill per Turn",
            type: ["buff"],
            func: function (effect, other_data) {
                var msg = "";
                if(effect['unknown proc param']){
                    let data = effect['unknown proc param'].split(",");
                    let translated_effect = {
                        'od fill gradual': +data[2],
                        'od fill gradual turns': +data[3],
                        'unknown params': data.slice(0,2).concat(data.slice(4)),
                        'target area': effect['target area'],
                        'target type': effect['target type']
                    };
                    if (translated_effect['od fill gradual']) msg += get_polarized_number(translated_effect["od fill gradual"]) + " OD fill/turn";

                    if(translated_effect['unknown params'].length > 0){
                        msg += ` (unknown proc effects '${translated_effect['unknown params'].join(",")}')`;
                    }
                    if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                    if (!other_data.sp) msg += get_target(translated_effect, other_data);
                    msg += get_turns(translated_effect['od fill gradual turns'], msg, other_data.sp, this.desc);
                }
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                return msg;
            }
        },
        '119': {
            desc: 'Lose BC Per Turn',
            type: ['debuff','unknown'],
            notes: ['This can be found on BB 5001083 and 7500129'],
            func: function(effect,other_data){
                let msg = '';
                if(effect['unknown proc param']){
                    msg += `Lose BC per turn (unknown proc effects '${effect['unknown proc param']}')`;
                }
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                return msg;
            }
        },
        '126': {
            desc: "Damage over Time (DoT) Mitigation",
            type: ["buff"],
            func: function (effect, other_data) {
                var msg = "";
                if(effect['unknown proc param']){
                    let data = effect['unknown proc param'].split(",");
                    let translated_effect = {
                        'dot miti%': +data[0],
                        'dot miti turns': +data[1],
                        'unknown params': data.slice(2),
                        'target area': effect['target area'],
                        'target type': effect['target type']
                    };

                    if (translated_effect['dot miti%']) msg += `${translated_effect["dot miti%"]}% DoT mitigation`;
                    if (translated_effect['unknown params'].length > 0) {
                        msg += ` (unknown proc effects '${translated_effect['unknown params'].join(",")}')`;
                    }
                    if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                    if (!other_data.sp) msg += get_target(translated_effect, other_data);
                    msg += get_turns(translated_effect['dot miti turns'], msg, other_data.sp, this.desc);
                }
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                return msg;
            }
        },
        '127': {
            desc: "Lock On to Unit (?)",
            type: ['debuff', 'unknown'],
            notes: ['This can be found on BB 5001089 and 5001088', 'The definition here is only a guess as to what it does'],
            func: function(effect,other_data){
                var msg = "";
                if (effect['unknown proc param']) {
                    let data = effect['unknown proc param'].split(",");
                    let translated_effect = {
                        'lock on turns': +data[0],
                        'unknown params': data.slice(1),
                        'target area': effect['target area'],
                        'target type': effect['target type']
                    };

                    msg += `Mark a unit to be targeted`;
                    if(translated_effect['lock on turns']) msg += get_turns(translated_effect['lock on turns'], msg, other_data.sp, this.desc);
                    if (translated_effect['unknown params'].length > 0) {
                        msg += ` (unknown proc effects '${translated_effect['unknown params'].join(",")}')`;
                    }
                    if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                    if (!other_data.sp) msg += get_target(translated_effect, other_data,{
                        prefix: "on the side of "
                    });
                }
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                return msg;
            }
        },
        '130': {
            desc: "ATK/DEF/REC Down Reflect",
            type: ["debuff"],
            notes: ['This can be found on BB 61137'],
            func: function (effect, other_data) {
                var msg = "";
                let amount,chance,translated_effect = {};
                if(effect['unknown proc param']){
                    let data = effect['unknown proc param'].split(",").map((v) => {return +v});
                    translated_effect = {
                        'atk% debuff': data[0] || undefined,'def% debuff': data[1] || undefined,'rec% debuff': data[2] || undefined,
                        'atk% chance': data[3] || undefined,'def% chance': data[4] || undefined,'rec% chance': data[5] || undefined,
                        'debuff turns': data[6] || undefined,
                        'reflect turns': data[7] || undefined,
                        'unknown params': data.slice(8)
                    }

                    let [atk, def, rec] = [get_polarized_number(translated_effect['atk% debuff'] || 0),get_polarized_number(translated_effect['def% debuff'] || 0),get_polarized_number(translated_effect['rec% debuff'] || 0)]

                    //used to check values for SP
                    amount = (translated_effect['atk% debuff'] || 0) + (translated_effect['def% debuff'] || 0) + (translated_effect['rec% debuff'] || 0);
                    chance = (translated_effect['atk% chance'] || 0) + (translated_effect['def% chance'] || 0) + ( translated_effect['rec% chance'] || 0);
                    if (amount !== 0 || chance !== 0){
                        msg += hp_adr_buff_handler(undefined, translated_effect['atk% chance'], translated_effect['def% chance'], translated_effect['rec% chance'],
                        {
                            numberFn: (v) => {return `${v}% chance to inflict ${translated_effect['debuff turns'] || 0} turn `;},
                            // suffix: " reduction"
                        });

                        msg = msg.replace("ATK",`${atk}% ATK Down`).replace("DEF",`${def}% DEF Down`).replace("REC",`${rec}% REC Down`);

                        if(translated_effect['unknown params'].length > 0){
                            msg += ` (unknown proc effects '${translated_effect['unknown params'].join(",")}')`;
                        }
                    }
                }  
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!chance && !amount && other_data.sp) msg = "";
                if (!other_data.sp) msg += get_target(effect, other_data, {
                    prefix: "when hit to ",
                });
                if(translated_effect) msg += get_turns(translated_effect["reflect turns"], msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '132': {
            desc: "Chance to Decrease Critical Damage/EWD Resistance",
            type: ['debuff'],
            notes: ['This can be found on BB 151147'],
            func: function(effect,other_data){
                var msg = "";
                let amount, chance, translated_effect = {};
                if (effect['unknown proc param']) {
                    let data = effect['unknown proc param'].split(",").map((v) => { return +v });
                    translated_effect = {
                        'crit resist decrease': data[0],
                        'ewd resist decrease': data[1],
                        'crit decrease chance': data[2],
                        'ewd decrease chance': data[3],
                        'buff turns': data[4],
                        'unknown params': data.slice(5),
                        // 'target area': effect['target area'],
                        // 'target type': effect['target type']
                    };

                    let [crit,ewd] = [translated_effect['crit resist decrease'] || 0,translated_effect['ewd resist decrease'] || 0];
                    amount = crit + ewd;
                    chance = (translated_effect['crit decrease chance'] || 0) + (translated_effect['ewd decrease chance'] || 0);

                    if(amount !== 0 || chance !== 0){
                        let options = {
                            all: [
                                {name: `${crit}% Crit DMG Vulnerability`, value: translated_effect['crit decrease chance']},
                                {name: `${ewd}% EWD Vulnerability`, value: translated_effect['ewd decrease chance']}
                            ],
                            special_case: {
                                isSpecialCase: (value,names) => { return value == 0},
                                func: (value,names_array) => {return "";}
                            },
                            numberFn: (v) => { return `${v}% chance to inflict `;}
                        };
                        msg += multi_param_buff_handler(options);

                        if (translated_effect['unknown params'].length > 0) {
                            msg += ` (unknown proc effects '${translated_effect['unknown params'].join(",")}')`;
                        }
                    }
                }
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!chance && !amount && other_data.sp) msg = "";
                if (!other_data.sp) msg += get_target(effect, other_data);
                if (translated_effect) msg += get_turns(translated_effect["reflect turns"], msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '901': {
            desc: "Raid Heal (On Map)",
            type: ['effect'],
            notes: ['Found on item 70300', 'Not sure if the values here are raw HP, %HP, or something else'],
            func: function(effect,other_data){
                let msg = "";
                if(effect['unknown proc param']){
                    msg += `Heals`;
                }
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data, {
                    prefix: "",
                    suffix: " in the surrounding area"
                });
                if(msg.length > 0){
                    msg += ` (unknown proc effects '${effect['unknown proc param']}')`;
                }
                return msg;
            }
        },
        '903': {
            desc: "Show Boss Location (Raid)",
            type: ['timed'],
            notes: ['Found on item 70000'],
            func: function (effect, other_data) {
                var msg = "";
                let amount, chance, translated_effect = {};
                if (effect['unknown proc param']) {
                    let data = effect['unknown proc param'].split(",").map((v) => { return +v });
                    translated_effect = {
                        'buff timer (seconds)': data[1],
                        'unknown params': [data[0]].concat(data.slice(2))
                    };

                    if(translated_effect['buff timer (seconds)']){
                        msg += `Shows the location of bosses on the map`;
                    }

                    if (translated_effect['unknown params']) {
                        msg += ` (unknown proc effects '${translated_effect['unknown params']}')`;
                    }

                    if(translated_effect['buff timer (seconds)']){
                        msg += ` for ${translated_effect['buff timer (seconds)']} seconds`;
                    }
                }
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                return msg;       
            }
        },
        '905': {
            desc: "Teleports Player to Camp (Raid)",
            type: ['effect'],
            notes: ['Found on item 70200'],
            func: function(effect,other_data){
                let msg = `Moves${get_target(effect, other_data, {
                    prefix: "",
                    suffix: " to Camp"
                })} (unknown proc effects '${effect['unknown proc param']}')`;
                return msg;
            }
        },
        '906': {
            desc: "Escape Current Battle (Raid)",
            type: ['effect'],
            notes: ['Found on item 70100', "There are no parameters with this proc, according to item 70100"],
            func: function(effect,other_data){
                return "Allows user to escape from battle (params?)";
            }
        },
        '907': {
            desc: "Timed DEF (Raid)",
            type: ['buff', 'timed'],
            notes: ['Found on item 70500'],
            func: function (effect, other_data) {
                let msg = "";
                if (effect['unknown proc param']) {
                    let data = effect['unknown proc param'].split(",").map((v) => { return +v });
                    translated_effect = {
                        'reduction% buff': data[0],
                        'buff timer (seconds)': data[1],
                        'unknown params': [data[0]].concat(data.slice(2))
                    };
                    msg += `${get_polarized_number(translated_effect['reduction% buff'])}% damage reduction`;
                }
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data);
                if(translated_effect) msg += ` for ${translated_effect['buff timer (seconds)']} seconds`;
                return msg;
            }
        },
        '908': {
            desc: "Increase Item Drop Rate (Raid)",
            type: ['buff'],
            func: function (effect, other_data) {
                let msg = "";
                let data = effect['unknown proc param'].split(",");
                if (data.length > 0) {
                    let boost = (100 + (+data[0])) / 100;
                    msg += `Multiplies Raid Item drop rate by ${boost} for the current Raid quest when activated from the map`;
                }
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                return msg;
            }
        },
        '10004': {
            desc: "Damage Immunity to BB/SBB/UBB/Normals",
            type: ['buff'],
            notes: ["Can be found on BB 8470117"],
            func: function(effect,other_data){
                let msg = "";
                let translated_effect;
                if (effect['unknown proc param']) {
                    // chance,turns,unknown,bb,sbb,ubb,normal,unknown
                    let data = effect['unknown proc param'].split(",").map((v) => { return +v });
                    translated_effect = {
                        'immune chance': data[0],
                        'immune turns': data[1],
                        'immune to bb': data[3] == 1 || undefined,
                        'immune to sbb': data[4] == 1 || undefined,
                        'immune to ubb': data[5] == 1 || undefined,
                        'immune to normals': data[6] == 1 || undefined,
                        'unknown params': [data[2]].concat(data.slice(7))
                    };
                    let options = {
                        all: [
                            { name: "BB", value: translated_effect['immune to bb'] },
                            { name: "SBB", value: translated_effect['immune to sbb'] },
                            { name: "UBB", value: translated_effect['immune to ubb'] },
                            { name: "Normal", value: translated_effect['immune to normals'] },
                        ],
                        numberFn: (v) => { return ""},
                        special_case: {
                            isSpecialCase: (value,names) => { return value === false; },
                            func: (value,names) => { return ""; }
                        },
                        suffix: " attacks"
                    };
                    if(translated_effect['immune chance'] === 100){
                        options.prefix = "Give full damage immunity from ";
                    }else{
                        options.prefix = `${translated_effect['immune chance']}% chance to ignore damage from `;
                    }
                    msg += multi_param_buff_handler(options);
                    if (msg.length > 0 && translated_effect['unknown params'].length > 0) {
                        msg += ` (unknown proc effects '${translated_effect['unknown params'].join(",")}')`;
                    }
                }
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data);
                if (translated_effect) msg += get_turns(translated_effect["immune turns"], msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '10005': {
            desc: "Turn Skip",
            type: ['debuff'],
            notes: ['Can be found on BB 8400911'],
            func: function(effect,other_data){
                let msg = "";
                let translated_effect;
                if (effect['unknown proc param']) {
                    let data = effect['unknown proc param'].split(",").map((v) => { return +v });
                    translated_effect = {
                        'turnskip chance': data[0],
                        'number of turns skipped': data[1],
                        'unknown params': data.slice(2)
                    };

                    if(translated_effect['turnskip chance'] || translated_effect['number of turns skipped']){
                        if (translated_effect['turnskip chance'] == 100){
                            msg += "Inflicts ";
                        }else{
                            msg += `${translated_effects['turnskip chance'] || 0}% chance to inflict`;
                        }

                        msg += `${translated_effect['number of turns skipped']} turn Turn Skip`;
                    }
                    
                    if (msg.length > 0 && translated_effect['unknown params'].length > 0) {
                        msg += ` (unknown proc effects '${translated_effect['unknown params'].join(",")}')`;
                    }
                }
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data);
                return msg;
            }
        },
        '10007': {
            desc: 'Chance Evasion',
            type: ['buff'],
            notes: ['Can be found on BB 820397'],
            func: function(effect,other_data){
                let msg = "";
                let translated_effect;
                if (effect['unknown proc param']) {
                    // unknown,turns,unknown,chance
                    let data = effect['unknown proc param'].split(",").map((v) => { return +v });
                    translated_effect = {
                        'evasion chance': data[3],
                        'evasion turns': data[1],
                        'unknown params': [data[0],data[2]].concat(data.slice(4))
                    };
                    
                    if (translated_effect['evasion chance']) {
                        if (translated_effect['evasion chance'] == 100) {
                            msg += "Evades ";
                        } else {
                            msg += `${translated_effect['evasion chance']}% chance to evade `;
                        }

                        msg += `attacks`;
                    }

                    if (msg.length > 0 && translated_effect['unknown params'].length > 0) {
                        msg += ` (unknown proc effects '${translated_effect['unknown params'].join(",")}')`;
                    }
                }
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data);
                if (translated_effect) msg += get_turns(translated_effect["evasion turns"], msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '70001': {
            desc: "Mana Bubble Shield (EU)",
            type: ['buff'],
            notes: ['This can be found on BB 720153'],
            func: function(effect,other_data){
                let msg = "";
                let translated_effect;
                if (effect['unknown proc param']) {
                    // unknown,turns,unknown,chance
                    let data = effect['unknown proc param'].split(",").map((v) => { return +v });
                    if(data.length === 2){
                        data.unshift(3); //add missing value, 3 is based on other bursts that have this proc
                    }
                    translated_effect = {
                        'rec convert': data[1],
                        'unknown params': [data[0]].concat(data.slice(2))
                    };

                    if(translated_effect['rec convert']){
                        msg += `Cast a Mana Bubble Shield (based on ${translated_effect['rec convert']}% REC)`;
                    }

                    if (msg.length > 0 && translated_effect['unknown params'].length > 0) {
                        msg += ` (unknown proc effects '${translated_effect['unknown params'].join(",")}')`;
                    }
                }
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data);
                // if (translated_effect) msg += get_turns(translated_effect["evasion turns"], msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '70002': {
            desc: "Chance to Cast Double BB/SBB/UBB",
            type: ['buff'],
            notes: ['Can be found on BB 1750165', 'Any unit in the evolution line of listed units should work'],
            func: function(effect,other_data){
                //get the highest version of a given unit category
                function get_unit_name(category){
                    let name;
                    let prefix = category - (category % 10); //remove last digit
                    for(let i = 7; i >= 2; --i){
                        if(unit_names[`${category+i}`]){
                            name = unit_names[`${category + i}`];
                            break;
                        }
                    }
                    return name || category;
                }
                let msg = "";
                let translated_effect;
                if (effect['unknown proc param']) {
                    // unknown,turns,unknown,chance
                    let data = effect['unknown proc param'].split(",").map((v) => { return +v });
                    translated_effect = {
                        'base chance': data[0]*100,
                        'buff turns': data[1],
                        'chance added per special unit': data[2]*100,
                        'special units': data.slice(3).filter((v) => { return v !== 0; })
                    };

                    if(translated_effect['base chance']){
                        msg += `${translated_effect['base chance']}% chance`;
                    }

                    if (translated_effect['chance added per special unit'] || translated_effect['special units'].length > 0) {
                        let names = translated_effect['special units'].map(get_unit_name);
                        msg += ` (${get_polarized_number(translated_effect['chance added per special unit'])}% chance`;
                        if(names.length > 0){
                            if(names.length == 1){
                                msg += ` if ${names[0]} is `;
                            }else{
                                msg += ` per unit in {${names.join(", ")}} `;
                            }
                            msg += "found in squad";
                        }
                        msg += ")";
                    }

                    if (msg.length > 0){
                        msg += " to cast double BB/SBB/UBB";
                    }
                }
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data);
                if (translated_effect) msg += get_turns(translated_effect["buff turns"], msg, other_data.sp, this.desc);
                return msg;
            }
        }
    };

    //get names of IDs in array
    function get_names(arr, type) {
        let names = [];
        if (type === 'unit') {
            for (let val of arr) {
                if(val.name){
                    if(val.id === undefined)
                        names.push(val.name);
                    else
                        names.push(`${val.name} (${val.id})`);
                }else{
                    val = (val.id !== undefined) ? val.id.toString() : val.toString();
                    if(+val % 10 === 0){ //specify a range of units
                        //get highest rarity unit in set
                        let highest_name;
                        for(let i = 0; i <= 9; ++i){
                            let index = `${+val + i}`;
                            // console.log("checking index",index, unit_names[index]);
                            if(unit_names[index] !== undefined){
                                // names.push(unit_names[index]);
                                highest_name = unit_names[index];
                            }
                        }
                        names.push(`any evolution of ${highest_name || val}`);
                    }else{//specify a specific unit
                        // debug_log(val,unit_names[val]);
                        names.push(unit_names[val] || val);
                    }
                }
            }
        } else if (type === 'item') {
            for (let val of arr) {
                val = val.toString();
                // debug_log(val,item_names[val]);
                names.push(item_names[val] || val);
            }
        }
        return names;
    }

    function get_conditions(effect){
        let conditions = {
            unit: [],
            item: []
        };
        debug_log('raw conditions',JSON.stringify(effect.conditions,null,2));
        let vowels = 'aeiou';
        if (effect['conditions'] && effect['conditions'].length > 0) {
            for (let condition of effect['conditions']) {
                if(condition['sphere category required'] !== undefined){
                    conditions.item.push(`${vowels.indexOf(condition['sphere category required'][0].toLowerCase()) > -1 ? 'an' : 'a'} ${condition['sphere category required']} sphere`);
                } else if(condition['item required'] !== undefined){
                    if (condition['item required'] instanceof Array && condition['item required'].length > 0) {
                        for (let item of condition['item required']) {
                            if (conditions.item.indexOf(item) === -1) {
                                conditions.item.push(item);
                            }
                        }
                    }else{
                        conditions.item.push(condition['item required']);
                    }
                } else if(condition['unit required'] !== undefined){
                    if (condition['unit required'] instanceof Array && condition['unit required'].length > 0) {
                        for (let unit of condition['unit required']) {
                            if (conditions.unit.indexOf(unit) === -1) {
                                conditions.unit.push(unit);
                            }
                        }
                    }else{
                        conditions.unit.push(condition['unit required']);
                    }
                } else if(condition.unknown !== undefined){
                    if(condition.unknown === '6,3'){ //special case for zelnite
                        conditions.item.push(`a Drop sphere`);
                    }else{
                        conditions.item.push(`unknown sphere type ${condition['unknown']}`);
                    }
                }
            }
        }
        debug_log("conditions", conditions);
        return conditions;
    }

    function print_conditions(effect){
        let conditions = get_conditions(effect);
        let cond_msg = [], msg = "";
        if (conditions.unit.length > 0) {
            let names = get_names(conditions.unit, 'unit');
            if (conditions.unit.length === 1 && names.length === 1) {
                cond_msg.push(`${names[0]} is in squad`);
            } else {
                cond_msg.push(`${names.join(" or ")} are in squad`);
            }
        }
        if (conditions.item.length > 0) {
            let names = get_names(conditions.item, 'item');
            if (conditions.item.length === 1) {
                cond_msg.push(`${names[0]} is equipped`);
            } else {
                cond_msg.push(`${names.join(" or ")} are equipped`);
            }
        }
        if (cond_msg.length > 0) {
            msg += `If ${cond_msg.join(" or ")}, then `;
        }
        return msg;
    }

    //checks if we need to get the target data
    function needTarget(effect,other_data){
        return (!other_data.isLS && !other_data.sp && (effect['passive target'] !== undefined && effect['passive target'] !== 'self'));
    }

    function print_hp_conditions(effect){
        let hp_conditions = [];
        let msg = "";
        if (effect['hp above % buff requirement'] !== undefined) {
            if (effect['hp above % buff requirement'] != 100)
                hp_conditions.push(` when HP > ${effect['hp above % buff requirement']}%`);
            else
                hp_conditions.push(' when HP is full');
        } else if (effect['hp above % passive requirement'] !== undefined) {
            if (effect['hp above % passive requirement'] != 100)
                hp_conditions.push(` when HP > ${effect['hp above % passive requirement']}%`);
            else
                hp_conditions.push(' when HP is full');
        }
        if (effect['hp below % buff requirement'] !== undefined) {
            hp_conditions.push(` when HP < ${effect['hp below % buff requirement']}%`);
        }else if (effect['hp below % passive requirement'] !== undefined) {
            hp_conditions.push(` when HP < ${effect['hp below % passive requirement']}%`);
        }

        if (hp_conditions.length > 0) {
            msg += hp_conditions.join(' &');
        }
        return msg;
    }

    function print_bb_gauge_conditions(effect) {
        let hp_conditions = [];
        let msg = "";
        if (effect['bb gauge above % buff requirement'] !== undefined) {
            if (effect['bb gauge above % buff requirement'] != 100)
                hp_conditions.push(` when BB Gauge > ${effect['bb gauge above % buff requirement']}%`);
            else
                hp_conditions.push(' when BB Gauge is full');
        } else if (effect['bb gauge above % passive requirement'] !== undefined) {
            if (effect['bb gauge above % passive requirement'] != 100)
                hp_conditions.push(` when BB Gauge > ${effect['bb gauge above % passive requirement']}%`);
            else
                hp_conditions.push(' when BB Gauge is full');
        }
        if (effect['bb gauge below % buff requirement'] !== undefined) {
            hp_conditions.push(` when BB Gauge < ${effect['bb gauge below % buff requirement']}%`);
        } else if (effect['bb gauge below % passive requirement'] !== undefined) {
            hp_conditions.push(` when BB Gauge < ${effect['bb gauge below % passive requirement']}%`);
        }

        if (hp_conditions.length > 0) {
            msg += hp_conditions.join(' &');
        }
        return msg;
    }

    var passive_buffs = {
        '1': {
            desc: "Regular HP/ATK/DEF/REC/Crit Rate Boost",
            type: ["passive"],
            func: function (effect, other_data) {
                // console.log("other_data",other_data);
                other_data = other_data || {};
                let msg = print_conditions(effect);
                if (effect["hp% buff"] || effect["atk% buff"] || effect["def% buff"] || effect["rec% buff"]) { //regular tri-stat
                    msg += hp_adr_buff_handler(effect["hp% buff"], effect["atk% buff"], effect["def% buff"], effect["rec% buff"]);
                }

                if(effect['crit% buff']){
                    if(msg.length > 0) msg += ", ";
                    msg += `${get_polarized_number(effect['crit% buff'])}% Crit Rate`;
                }
               
                if (msg.length === 0) throw no_buff_data_msg;

                if (needTarget(effect,other_data)){
                    msg += get_target(effect,other_data, {
                        isPassive: true,
                    });
                }
                return msg;
            }
        },
        '2': {
            desc: "Elemental HP/ATK/DEF/REC/Crit Rate Boost",
            type: ["passive"],
            func: function (effect, other_data) {
                // console.log("other_data",other_data);
                other_data = other_data || {};
                let msg = print_conditions(effect);
                if (effect["hp% buff"] || effect["atk% buff"] || effect["def% buff"] || effect["rec% buff"]) { //regular tri-stat
                    msg += hp_adr_buff_handler(effect["hp% buff"], effect["atk% buff"], effect["def% buff"], effect["rec% buff"]);
                }

                if (effect['crit% buff']) {
                    if (msg.length > 0) msg += ", ";
                    msg += `${get_polarized_number(effect['crit% buff'])}% Crit Rate`;
                }

                if (msg.length === 0) throw no_buff_data_msg;

                if(effect['elements buffed']){
                    let elements = effect['elements buffed'].map((s) => { return to_proper_case(s); }).join("/");
                    msg += ` of ${elements} types`;
                }


                if (needTarget(effect, other_data)) {
                    msg += get_target(effect, other_data, {
                        isPassive: true,
                    });
                }
                return msg;
            }
        },
        '3': {
            desc: "Type-Based HP/ATK/DEF/REC Boost",
            type: ["passive"],
            func: function (effect, other_data) {
                // console.log("other_data",other_data);
                other_data = other_data || {};
                let msg = print_conditions(effect);
                if (effect["hp% buff"] || effect["atk% buff"] || effect["def% buff"] || effect["rec% buff"]) { //regular tri-stat
                    msg += hp_adr_buff_handler(effect["hp% buff"], effect["atk% buff"], effect["def% buff"], effect["rec% buff"]);
                }

                if (msg.length === 0) throw no_buff_data_msg;

                if (effect['unit type buffed'] !== undefined) {
                    msg += ` of ${to_proper_case((effect['unit type buffed'] || "null"))} types`;
                }


                if (needTarget(effect, other_data)) {
                    msg += get_target(effect, other_data, {
                        isPassive: true,
                    });
                }
                return msg;
            }
        },
        '4': {
            desc: "Status Negation/Resistance",
            type: ["passive"],
            func: function (effect, other_data) {
                let options = {};
                options.values = [
                    effect["injury resist%"],
                    effect["poison resist%"],
                    effect["sick resist%"],
                    effect["weaken resist%"],
                    effect["curse resist%"],
                    effect["paralysis resist%"]
                ];

                options.suffix = function (names) {
                    if (names.length === 6) {
                        return " all status ailments";
                    } else {
                        return ` ${names.join("/")}`;
                    }
                };

                options.numberFn = function (value) {
                    if (value == 100)
                        return "Negates";
                    else
                        return `${value}% resistance to`;
                };

                options.special_case = {
                    isSpecialCase: function (value, names) {
                        // debug_log("Received:", value, names.length, value == 100, names.length === 6);
                        return value == 0 || names.length === 6;
                    },
                    func: function (value, names) {
                        if (value == 0) return "";
                        if (value == 100)
                            return "Negates all status ailments";
                        else
                            return `${value}% resistance to all status ailments`;
                    }
                };

                let msg = print_conditions(effect);
                if (effect["injury resist%"] || effect["poison resist%"] || effect["sick resist%"] ||
                    effect["weaken resist%"] || effect["curse resist%"] || effect["paralysis resist%"])
                    msg += ailment_handler(options);
                
                if (msg.length === 0) throw no_buff_data_msg;

                if (needTarget(effect, other_data)) {
                    msg += get_target(effect, other_data, {
                        isPassive: true,
                        prefix: 'for'
                    });
                }
                return msg;
            }
        },
        '5': {
            desc: "Elemental Mitigation",
            type: ["passive"],
            func: function (effect, other_data) {
                let msg = print_conditions(effect);
                msg += variable_elemental_mitigation_handler(effect, ['fire resist%', 'water resist%', 'earth resist%', 'thunder resist%', 'light resist%', 'dark resist%']);
                
                if (msg.length === 0) throw no_buff_data_msg;

                if (needTarget(effect, other_data)) {
                    msg += get_target(effect, other_data, {
                        isPassive: true,
                        prefix: 'for'
                    });
                }
                return msg;
            }
        },
        '8': {
            desc: "Mitigation",
            type: ["passive"],
            func: function (effect, other_data) {
                let msg = print_conditions(effect);
                if(effect['dmg% mitigation'] !== undefined){
                    msg += `${effect['dmg% mitigation']}% mitigation`;
                }

                if (msg.length === 0) throw no_buff_data_msg;

                if (needTarget(effect, other_data)) {
                    msg += get_target(effect, other_data, {
                        isPassive: true,
                        prefix: 'for'
                    });
                }
                return msg;
            }
        },
        '9': {
            desc: "BC Fill per Turn",
            type: ['passive'],
            func: function(effect,other_data){
                let msg = print_conditions(effect);

                if(effect['bc fill per turn']){
                    msg += `${effect['bc fill per turn']} BC/turn`;
                }

                if (msg.length === 0) throw no_buff_data_msg;

                if (needTarget(effect, other_data)) {
                    msg += get_target(effect, other_data, {
                        isPassive: true,
                        prefix: 'for'
                    });
                }
                return msg;
            }
        },
        '10': {
            desc: 'HC Efficacy',
            type: ['passive'],
            func: function(effect,other_data){
                let msg = print_conditions(effect);
                if(effect['hc effectiveness%']){
                    msg += `${effect['hc effectiveness%']}% HC efficacy`;
                }

                if (msg.length === 0) throw no_buff_data_msg;

                if (needTarget(effect, other_data)) {
                    msg += get_target(effect, other_data, {
                        isPassive: true,
                        prefix: 'for'
                    });
                }
                return msg;
            }
        },
        '11': {
            desc: "HP Conditional ATK/DEF/REC/Crit Rate Boost",
            type: ['conditional','buff'],
            notes: ['This is a flat boost when the HP conditions are met (i.e. not scaling relative to HP)'],
            func: function (effect, other_data) {
                other_data = other_data || {};
                let msg = print_conditions(effect);
                if (effect["atk% buff"] || effect["def% buff"] || effect["rec% buff"]) { //regular tri-stat
                    msg += hp_adr_buff_handler(undefined, effect["atk% buff"], effect["def% buff"], effect["rec% buff"]);
                }

                if (effect['crit% buff']) {
                    if (msg.length > 0) msg += ", ";
                    msg += `${get_polarized_number(effect['crit% buff'])}% Crit Rate`;
                }

                msg += print_hp_conditions(effect);

                if (msg.length === 0) throw no_buff_data_msg;

                if (needTarget(effect, other_data)) {
                    msg += get_target(effect, other_data, {
                        isPassive: true,
                    });
                }
                return msg;
            }
        },
        '12': {
            desc: "HP Conditional BC/HC/Item/Zel/Karma Drop Rate",
            type: ['conditional','buff'],
            func: function (effect, other_data) {
                var msg = print_conditions(effect);
                if (effect["bc drop rate% buff"] || effect["hc drop rate% buff"] || effect["item drop rate% buff"] || 
                    effect["zel drop rate% buff"] || effect["karma drop rate% buff"])
                    msg += bc_hc_items_handler(effect["bc drop rate% buff"], effect["hc drop rate% buff"], effect["item drop rate% buff"], {
                        extra_values: {
                            zel: effect["zel drop rate% buff"],
                            karma: effect["karma drop rate% buff"]
                        }
                    }) + " droprate";

                msg += print_hp_conditions(effect);

                if (msg.length === 0) throw no_buff_data_msg;

                if (needTarget(effect, other_data)) {
                    msg += get_target(effect, other_data, {
                        isPassive: true,
                    });
                }
                return msg;
            }
        },
        '13': {
            desc: 'BC Fill on Enemy Defeat',
            type: ['effect'],
            func: function(effect,other_data){
                let msg = print_conditions(effect);
                if (effect['bc fill on enemy defeat%'] !== undefined || effect['bc fill on enemy defeat low'] || effect['bc fill on enemy defeat high']){
                    if (effect['bc fill on enemy defeat%'] != 100){
                        msg += `${effect['bc fill on enemy defeat%']}% chance to fill `;
                    }else{
                        msg += `Fills `;
                    }

                    msg += `${get_formatted_minmax(effect['bc fill on enemy defeat low'] || 0, effect['bc fill on enemy defeat high'] || 0)} BC when an enemy is defeated`;
                }

                if (msg.length === 0) throw no_buff_data_msg;

                if (needTarget(effect, other_data)) {
                    msg += get_target(effect, other_data, {
                        isPassive: true,
                    });
                }
                return msg;
            }
        },
        '14': {
            desc: 'Chance Mitigation',
            type: ['effect'],
            func: function(effect,other_data){
                let msg = print_conditions(effect);
                if (effect['dmg reduction chance%'] !== undefined || effect['dmg reduction%']){
                    msg += `${effect['dmg reduction chance%']}% chance for ${get_polarized_number(effect['dmg reduction%'])}% mitigation`;
                }
                if (msg.length === 0) throw no_buff_data_msg;

                if (needTarget(effect, other_data)) {
                    msg += get_target(effect, other_data, {
                        isPassive: true,
                    });
                }
                return msg;
            }
        },
        '15': {
            desc: '%HP Heal on Enemy Defeat',
            type: ['effect'],
            func: function (effect, other_data) {
                let msg = print_conditions(effect);
                if (effect['hp% recover on enemy defeat low'] || effect['hp% recover on enemy defeat high']) {
                    msg += `Recover ${get_formatted_minmax(effect['hp% recover on enemy defeat low'] || 0, effect['hp% recover on enemy defeat high'] || 0)}% HP when an enemy is defeated`;
                }

                if (msg.length === 0) throw no_buff_data_msg;

                if (needTarget(effect, other_data)) {
                    msg += get_target(effect, other_data, {
                        isPassive: true,
                    });
                }
                return msg;
            }
        },
        '16': {
            desc: '%HP Heal on Victory',
            type: ['effect'],
            func: function (effect, other_data) {
                let msg = print_conditions(effect);
                if (effect['hp% recover on battle win low'] || effect['hp% recover on battle win high']) {
                    msg += `Recover ${get_formatted_minmax(effect['hp% recover on battle win low'] || 0, effect['hp% recover on battle win high'] || 0)}% HP when winning a battle`;
                }

                if (msg.length === 0) throw no_buff_data_msg;

                if (needTarget(effect, other_data)) {
                    msg += get_target(effect, other_data, {
                        isPassive: true,
                    });
                }
                return msg;
            }
        },
        '17': {
            desc: "Chance HP Drain/Absorption When Attacking",
            type: ['effect'],
            func: function (effect, other_data) {
                let msg = print_conditions(effect);

                if (effect["hp drain chance%"] || effect["hp drain% low"] || effect["hp drain% high"]) {
                    if(effect['hp drain chance%'] != 100)
                        msg += `${effect["hp drain chance%"] || 0}% chance of healing `;
                    else
                        msg += "Heals "
                    msg += `${get_formatted_minmax(effect["hp drain% low"] || 0, effect["hp drain% high"] || 0)}% of damage dealt`;
                }

                if (msg.length === 0) throw no_buff_data_msg;

                if (needTarget(effect, other_data)) {
                    msg += get_target(effect, other_data, {
                        isPassive: true,
                    });
                }
                return msg;
            }
        },
        '19': {
            desc: "BC/HC/Item/Zel/Karma Drop Rate",
            type: ['passive'],
            func: function (effect, other_data) {
                var msg = print_conditions(effect);
                if (effect["bc drop rate% buff"] || effect["hc drop rate% buff"] || effect["item drop rate% buff"] ||
                    effect["zel drop rate% buff"] || effect["karma drop rate% buff"])
                    msg += bc_hc_items_handler(effect["bc drop rate% buff"], effect["hc drop rate% buff"], effect["item drop rate% buff"], {
                        extra_values: {
                            zel: effect["zel drop rate% buff"],
                            karma: effect["karma drop rate% buff"]
                        }
                    }) + " droprate";

                if (msg.length === 0) throw no_buff_data_msg;

                if (needTarget(effect, other_data)) {
                    msg += get_target(effect, other_data, {
                        isPassive: true,
                    });
                }
                return msg;
            }
        },
        '20': {
            desc: "Inflict Status Ailment",
            type: ["debuff"],
            func: function (effect, other_data) {
                let options = {};
                options.values = [
                    effect["injury%"],
                    effect["poison%"],
                    effect["sick%"],
                    effect["weaken%"],
                    effect["curse%"],
                    effect["paralysis%"]
                ];

                options.suffix = function (names) {
                    if (names.length === 6) {
                        return " chance to inflict any status ailment";
                    } else {
                        return ` chance to inflict ${names.join("/")}`;
                    }
                }

                let msg = print_conditions(effect) + ailment_handler(options);
                if (msg.length === 0) throw no_buff_data_msg;

                if (needTarget(effect, other_data)) {
                    msg += get_target(effect, other_data, {
                        isPassive: true,
                    });
                }
                return msg;
            }
        },
        '21': {
            desc: "First X Turns HP/ATK/DEF/REC/Crit Rate Boost",
            type: ["timed","buff"],
            notes: ["These buffs are active at start of battle for a set amount of turns"],
            func: function (effect, other_data) {
                // console.log("other_data",other_data);
                other_data = other_data || {};
                let msg = print_conditions(effect);
                if (effect["first x turns atk% (1)"] || effect["first x turns def% (3)"] || effect["first x turns rec% (5)"]) { //regular tri-stat
                    msg += hp_adr_buff_handler(undefined, effect["first x turns atk% (1)"], effect["first x turns def% (3)"], effect["first x turns rec% (5)"]);
                }

                if (effect['first x turns crit% (7)']) {
                    if (msg.length > 0) msg += ", ";
                    msg += `${get_polarized_number(effect['first x turns crit% (7)'])}% Crit Rate`;
                }

                if(effect['first x turns'] !== undefined){
                    msg += ` for first ${effect['first x turns']} turns`;
                }

                if (msg.length === 0) throw no_buff_data_msg;

                if (needTarget(effect, other_data)) {
                    msg += get_target(effect, other_data, {
                        isPassive: true,
                    });
                }
                return msg;
            }
        },
        '23': {
            desc: "BC Fill on Victory",
            type: ['effect'],
            func: function(effect,other_data){
                let msg = print_conditions(effect);
                if (effect['battle end bc fill low'] || effect['battle end bc fill high']) {
                    msg += `${get_formatted_minmax(effect['battle end bc fill low'] || 0, effect['battle end bc fill high'] || 0)} BC fill when winning a battle`;
                }

                if (msg.length === 0) throw no_buff_data_msg;

                if (needTarget(effect, other_data)) {
                    msg += get_target(effect, other_data, {
                        isPassive: true,
                    });
                }
                return msg;
            }
        },
        '24': {
            desc: "Heal on Hit",
            type: ["effect"],
            func: function (effect, other_data) {
                let msg = print_conditions(effect);

                if (effect["dmg% to hp% when attacked chance%"] || effect["dmg% to hp% when attacked low"] || effect["dmg% to hp% when attacked high"]) {
                    msg += `${effect["dmg% to hp% when attacked chance%"] || 0}% chance to heal `;
                    msg += `${get_formatted_minmax(effect["dmg% to hp% when attacked low"] || 0, effect["dmg% to hp% when attacked high"] || 0)}% DMG when hit`;
                }

                if (msg.length === 0) throw no_buff_data_msg;

                if (needTarget(effect, other_data)) {
                    msg += get_target(effect, other_data, {
                        isPassive: true,
                    });
                }
                return msg;
            }
        },
        '25': {
            desc: "BC Fill on Hit",
            type: ["effect"],
            func: function (effect, other_data) {
                let msg = print_conditions(effect);
                if (effect["bc fill when attacked%"] || effect["bc fill when attacked low"] || effect["bc fill when attacked high"]) {
                    if (effect["bc fill when attacked%"] !== undefined && effect["bc fill when attacked%"] != 100) {
                        msg += `${effect["bc fill when attacked%"]}% chance to fill `;
                    } else if (effect["bc fill when attacked%"] !== undefined && effect["bc fill when attacked%"] == 100) {
                        msg += "Fill ";
                    }
                    msg += `${get_formatted_minmax(effect["bc fill when attacked low"] || 0, effect["bc fill when attacked high"] || 0)} BC when hit`;
                }
                if (msg.length === 0) throw no_buff_data_msg;
                if (needTarget(effect, other_data)) {
                    msg += get_target(effect, other_data, {
                        isPassive: true,
                    });
                }
                return msg;
            }
        },
        '26': {
            desc: "Damage Reflect",
            type: ['effect'],
            func: function (effect, other_data) {
                let msg = print_conditions(effect);
                if(effect['dmg% reflect chance%'] || effect['dmg% reflect high'] || effect['dmg% reflect low']){
                    if (effect['dmg% reflect chance%'] != 100){
                        msg += `${effect['dmg% reflect chance%']}% chance to reflect `;
                    }else{
                        msg += `Reflect `;
                    }
                    msg += `${get_formatted_minmax(effect['dmg% reflect low'] || 0, effect['dmg% reflect high'] || 0)}% damage when hit `;
                }
                if (msg.length === 0) throw no_buff_data_msg;
                if (needTarget(effect, other_data)) {
                    msg += get_target(effect, other_data, {
                        isPassive: true,
                    });
                }
                return msg;
            }
        },
        '27': {
            desc: "Increase/Decrease Chance of Being Targeted",
            type: ['passive'],
            func: function(effect,other_data){
                let msg = print_conditions(effect);
                if(effect['target% chance'] !== undefined){
                    msg += `${get_polarized_number(effect['target% chance'])}% chance of being targeted`;
                }
                if (msg.length === 0) throw no_buff_data_msg;
                if (needTarget(effect, other_data)) {
                    msg += get_target(effect, other_data, {
                        isPassive: true,
                    });
                }
                return msg;
            }
        },
        '28': {
            desc: 'HP Conditional Increase/Decrease Chance of Being Targeted',
            type: ['conditional', 'effect'],
            func: function(effect,other_data){
                let msg = print_conditions(effect);
                if (effect['target% chance'] !== undefined) {
                    msg += `${get_polarized_number(effect['target% chance'])}% chance of being targeted`;
                }
                
                msg += print_hp_conditions(effect);

                if (msg.length === 0) throw no_buff_data_msg;
                if (needTarget(effect, other_data)) {
                    msg += get_target(effect, other_data, {
                        isPassive: true,
                    });
                }
                return msg;
            }
        },
        '29': {
            desc: "Defense Ignore",
            type: ["passive"],
            func: function (effect, other_data) {
                var msg = print_conditions(effect);
                if (effect['ignore def%'])
                    msg += `${effect['ignore def%']}% change to ignore target's defense`;
                if (msg.length === 0) throw no_buff_data_msg;
                if (needTarget(effect, other_data)) {
                    msg += get_target(effect, other_data, {
                        isPassive: true,
                    });
                }
                return msg;
            }
        },
        '30': {
            desc: "BB Gauge Conditional ATK/DEF/REC/Crit Rate Boost",
            type: ['conditional', 'buff'],
            func: function (effect, other_data) {
                other_data = other_data || {};
                let msg = print_conditions(effect);
                if (effect['hp% buff'] || effect["atk% buff"] || effect["def% buff"] || effect["rec% buff"]) { //regular tri-stat
                    msg += hp_adr_buff_handler(effect['hp% buff'], effect["atk% buff"], effect["def% buff"], effect["rec% buff"]);
                }

                if (effect['crit% buff']) {
                    if (msg.length > 0) msg += ", ";
                    msg += `${get_polarized_number(effect['crit% buff'])}% Crit Rate`;
                }

                msg += print_bb_gauge_conditions(effect);

                if (msg.length === 0) throw no_buff_data_msg;

                if (needTarget(effect, other_data)) {
                    msg += get_target(effect, other_data, {
                        isPassive: true,
                    });
                }
                return msg;
            }
        },
        '31': {
            desc: "Spark Damage and BC/HC/Zel/Karma Increase on Spark",
            type: ["passive"],
            func: function (effect, other_data) {
                let msg = print_conditions(effect);
                let buffs = [];
                if (effect["damage% for spark"]) 
                    buffs.push(get_polarized_number(effect["damage% for spark"]) + "% spark DMG");

                if (effect['bc drop% for spark'] || effect['hc drop% for spark'] || 
                    effect['zel drop% for spark'] || effect['karma drop% for spark'] || effect["item drop% for spark"]){
                    buffs.push(bc_hc_items_handler(effect["bc drop% for spark"], effect["hc drop% for spark"], effect["item drop% for spark"], {
                        extra_values: {
                            zel: effect["zel drop% for spark"],
                            karma: effect["karma drop% for spark"]
                        }
                    }) + " droprate on spark");
                }

                msg += buffs.join(" and ");

                if (msg.length === 0) throw no_buff_data_msg;
                if (needTarget(effect, other_data)) {
                    msg += get_target(effect, other_data, {
                        isPassive: true,
                    });
                }
                return msg;
            }
        },
        '32': {
            desc: "BB Fill Rate Increase/BC Efficacy",
            type: ['passive'],
            func: function (effect, other_data) {
                let msg = print_conditions(effect);
                if (effect['bb gauge fill rate%']) {
                    msg += `${get_polarized_number(effect['bb gauge fill rate%'])}% BB gauge fill rate`;
                }

                if (msg.length === 0) throw no_buff_data_msg;
                if (needTarget(effect, other_data)) {
                    msg += get_target(effect, other_data, {
                        isPassive: true,
                    });
                }
                return msg;
            }
        },
        '33': {
            desc: "HP per Turn/Heal over Time (HoT)",
            type: ["passive"],
            func: function (effect, other_data) {
                let msg = print_conditions(effect);
                if (effect["turn heal low"] || effect['turn heal high']) {
                    msg = `${get_formatted_minmax(effect["turn heal low"], effect["turn heal high"])} HP/turn`;
                    msg += ` (${get_polarized_number(effect["rec% added (turn heal)"])}% target REC)`;
                }

                if (msg.length === 0) throw no_buff_data_msg;
                if (needTarget(effect, other_data)) {
                    msg += get_target(effect, other_data, {
                        isPassive: true,
                    });
                }
                return msg;
            }
        },
        '34': {
            desc: "Critical Hit Damage",
            type: ["passive"],
            func: function (effect, other_data) {
                let msg = print_conditions(effect);
                if (effect['crit multiplier%'])
                    msg += `${get_polarized_number(effect["crit multiplier%"])}% crit DMG`;

                if (msg.length === 0) throw no_buff_data_msg;
                if (needTarget(effect, other_data)) {
                    msg += get_target(effect, other_data, {
                        isPassive: true,
                    });
                }
                return msg;
            }
        },
        '35': {
            desc: "BC Fill when Attacking",
            type: ['effect'],
            notes: ['This only applies to normal attacks'],
            func: function(effect,other_data){
                let msg = print_conditions(effect);
                if (effect['bc fill when attacking%'] || effect['bc fill when attacking low'] || effect['bc fill when attacking high']){
                    if (effect['bc fill when attacking%'] != 100){
                        msg += `${effect['bc fill when attacking%']}% chance to fill `;
                    }else{
                        msg += "Fill ";
                    }

                    msg += `${get_formatted_minmax(effect['bc fill when attacking low'] || 0,effect['bc fill when attacking high'] || 0)} BC when attacking`;
                }
                if (msg.length === 0) throw no_buff_data_msg;
                if (needTarget(effect, other_data)) {
                    msg += get_target(effect, other_data, {
                        isPassive: true,
                    });
                }
                return msg;
            }
        },
        '36': {
            desc: "Perform Additional Actions",
            type: ['effect'],
            notes: ['This seems to be the passive variant of Rahotep\'s buff (proc 76)'],
            func: function(effect,other_data){
                let msg = print_conditions(effect);
                if(effect['additional actions']){
                    msg += `Perform ${effect['additional actions']} extra ${effect['additional actions'] == 1 ? "action" : "actions"}`;
                }
                if (msg.length === 0) throw no_buff_data_msg;
                if (needTarget(effect, other_data)) {
                    msg += get_target(effect, other_data, {
                        isPassive: true,
                    });
                }
                return msg;
            }
        },
        '37': {
            desc: "Hit Count Increase",
            type: ['passive'],
            notes: ['Add the damage noted in this buff to 100% to get the actual damage of normal attacks', `+# means that the unit has # additional more hits, so +2 means that each hit has 2 more hits following it, effectively tripling the original hit count`],
            func: function (effect, other_data) {
                let msg = print_conditions(effect);
                if (effect['hit increase/hit'] || effect['extra hits dmg%'])
                    msg += `${get_polarized_number(effect['hit increase/hit'] || 0)} ${(effect['hit increase/hit'] === 1) ? "hit" : "hits"} to normal attacks (at ${(get_polarized_number(effect['extra hits dmg%'] || 0))}% damage)`;

                if (msg.length === 0) throw no_buff_data_msg;
                if (needTarget(effect, other_data)) {
                    msg += get_target(effect, other_data, {
                        isPassive: true,
                    });
                }
                return msg;
            }
        },
        '40': {
            desc: "Stat Conversion",
            type: ["passive"],
            func: function (effect, other_data) {
                let msg = print_conditions(effect);
                if (effect['converted attribute'] || effect['hp% buff'] || effect['atk% buff'] || effect['def% buff'] || effect['rec% buff']) {
                    let source_buff = (effect['converted attribute'] !== undefined) ? (effect['converted attribute'] || "null").toUpperCase().slice(0, 3) : undefined;
                    if (source_buff === "ATT") source_buff = "ATK";
                    let options = {
                        suffix: " conversion",
                    };
                    if (source_buff) {
                        options.numberFn = function (value) { return `${value}% ${source_buff}->` };
                    }
                    msg += hp_adr_buff_handler(effect['hp% buff'], effect['atk% buff'], effect['def% buff'], effect['rec% buff'], options);
                }

                if (msg.length === 0) throw no_buff_data_msg;
                if (needTarget(effect, other_data)) {
                    msg += get_target(effect, other_data, {
                        isPassive: true,
                    });
                }
                return msg;
            }
        },
        '41': {
            desc: "Unique Element Conditional ATK/DEF/REC/Crit Rate Boost",
            type: ['conditional', 'passive'],
            func: function (effect, other_data) {
                let msg = print_conditions(effect);
                if (effect['hp% buff'] || effect["atk% buff"] || effect["def% buff"] || effect["rec% buff"]) { //regular tri-stat
                    msg += hp_adr_buff_handler(effect['hp% buff'], effect["atk% buff"], effect["def% buff"], effect["rec% buff"]);
                }

                if (effect['crit% buff']) {
                    if (msg.length > 0) msg += ", ";
                    msg += `${get_polarized_number(effect['crit% buff'])}% Crit Rate`;
                }

                if(effect['unique elements required']){
                    msg += ` when ${effect['unique elements required']} or more unique elements are in squad`;
                }

                if (msg.length === 0) throw no_buff_data_msg;
                if (needTarget(effect, other_data)) {
                    msg += get_target(effect, other_data, {
                        isPassive: true,
                    });
                }
                return msg;
            }
        },
        '42': {
            desc: "Gender Conditional HP/ATK/DEF/REC/Crit Rate Boost",
            type: ['conditional', 'passive'],
            func: function (effect, other_data) {
                let msg = print_conditions(effect);
                if (effect['hp% buff'] || effect["atk% buff"] || effect["def% buff"] || effect["rec% buff"]) { //regular tri-stat
                    msg += hp_adr_buff_handler(effect['hp% buff'], effect["atk% buff"], effect["def% buff"], effect["rec% buff"]);
                }

                if (effect['crit% buff']) {
                    if (msg.length > 0) msg += ", ";
                    msg += `${get_polarized_number(effect['crit% buff'])}% Crit Rate`;
                }

                if (effect['gender required']) {
                    msg += ` for ${effect['gender required']} units`;
                }

                if (msg.length === 0) throw no_buff_data_msg;
                if (needTarget(effect, other_data)) {
                    msg += get_target(effect, other_data, {
                        isPassive: true,
                    });
                }
                return msg;
            }
        },
        '43': {
            desc: "Chance to Take 1 Damage",
            type: ['effect'],
            func: function(effect,other_data){
                let msg = print_conditions(effect);
                if(effect['take 1 dmg%'] !== undefined){
                    msg += `${effect['take 1 dmg%']}% chance to take 1 damage`;
                }
                if (msg.length === 0) throw no_buff_data_msg;
                if (needTarget(effect, other_data)) {
                    msg += get_target(effect, other_data, {
                        isPassive: true,
                    });
                }
                return msg;
            }
        },
        '44': {
            desc: "Flat HP/ATK/DEF/REC/Crit Rate Boost",
            type: ['passive'],
            notes: ['Flat as in the values here are not percentages but rather values directly added to stats'],
            func: function (effect, other_data) {
                let msg = print_conditions(effect);
                if (effect['hp buff'] || effect["atk buff"] || effect["def buff"] || effect["rec buff"]) { //regular tri-stat
                    msg += hp_adr_buff_handler(effect['hp buff'], effect["atk buff"], effect["def buff"], effect["rec buff"], {
                        numberFn: function (number) {
                            return `${get_polarized_number(number)} `;
                        }
                    });
                }

                if (effect['crit buff']) {
                    if (msg.length > 0) msg += ", ";
                    msg += `${get_polarized_number(effect['crit buff'])} Crit Rate`;
                }

                if (msg.length === 0) throw no_buff_data_msg;
                if (needTarget(effect, other_data)) {
                    msg += get_target(effect, other_data, {
                        isPassive: true,
                    });
                }
                return msg;
            }
        },
        '45': {
            desc: "Critical Hit Resistance",
            type: ['passive'],
            func: function(effect,other_data){
                let msg = print_conditions(effect);
                if(effect['base crit% resist'] || effect['buff crit% resist']){
                    if(effect['base crit% resist'] == 100 && effect['buff crit% resist'] == 100){
                        msg += "Negates ";
                    }else{
                        msg += `${effect['base crit% resist'] || 0}%/${effect['buff crit% resist'] || 0}% base/buffed resistance to `;
                    }
                    msg += "critical hits";
                }
                if (msg.length === 0) throw no_buff_data_msg;
                if (needTarget(effect, other_data)) {
                    msg += get_target(effect, other_data, {
                        isPassive: true,
                    });
                }
                return msg;
            }
        },
        '66': {
            desc: "Add effect to BB/SBB",
            type: ["passive"],
            func: function (effect, other_data) {
                let burst_type = (function (bb, sbb, ubb) {
                    let options = {
                        all: [
                            { name: "BB", value: bb },
                            { name: "SBB", value: sbb },
                            { name: "UBB", value: ubb }
                        ],
                        numberFn: function (value) { return ""; }
                    };

                    return multi_param_buff_handler(options);
                })(effect["trigger on bb"], effect["trigger on sbb"], effect["trigger on ubb"]);

                let msg = print_conditions(effect);

                let buff = [];
                for (let e of effect['triggered effect']) {
                    buff.push(print_buff(e, {
                        isPassive: false,
                        sp: false
                    }));
                }

                msg += `${msg.length > 0 ? "add" : "Add"} effect to ${burst_type} {${buff.join(" / ").trim()}}`;
                if (effect['passive target'] !== undefined && effect['passive target'] !== 'self')
                    msg += ` to ${effect['passive target']}`;
                return msg;
            }
        },
    };

    //general handler for all unknown passives
    function unknown_passive_handler(effect, other_data) {
        let msg = "";
        if (effect['unknown passive params']) msg += `Unknown passive effects {${effect['unknown passive params']}}`;
        if (msg.length === 0) throw no_buff_data_msg;
        if (needTarget(effect, other_data)) {
            msg += get_target(effect, other_data, {
                isPassive: true,
                prefix: 'for'
            });
        }
        return msg;
    }


    var unknown_passive_buffs = {
        '6': {
            desc: "Unknown values",
            type: ['unknown'],
            notes: ['Found on ES 8'],
            func: function(effect,other_data){
                return unknown_passive_handler(effect,other_data);
            }
        },
        '7': {
            desc: "Unknown values",
            type: ['unknown'],
            notes: ['Found on LS 9'],
            func: function (effect, other_data) {
                return unknown_passive_handler(effect, other_data);
            }
        },
        '38': {
            desc: "Unknown values",
            type: ['unknown'],
            notes: ['Found on LS 14 and ES 14'],
            func: function (effect, other_data) {
                return unknown_passive_handler(effect, other_data);
            }
        },
        '39': {
            desc: "Unknown values",
            type: ['unknown'],
            notes: ['Found on LS 15 and ES 15'],
            func: function (effect, other_data) {
                return unknown_passive_handler(effect, other_data);
            }
        },
    };

    var unknown_buffs = {

    }

    var buff_list = {
        proc: proc_buffs,
        unknown_proc: unknown_proc_buffs,
        passive: passive_buffs,
        unknown_passive: unknown_passive_buffs,
        unknown_buff: unknown_buffs
    }

    //effects - regular effects object with buff ID and other related buff info
    //other_data - other data needed to print effects, if any
    //type - one of the keys in buff_list
    function general_handler(effects, other_data, type) {
        other_data = other_data || {};
        let handler = buff_list[type.replace(" ", "_")], id = effects[`${type} id`];
        if (!handler || id === undefined) {
            if (!id) debug_log("Couldn't find ID in", type);
            return `Unknown buff type "${type}"`;
        }

        try {
            let msg = `Received ${type} id ${id} `;
            if (handler[id]) {
                msg += `${handler[id].desc}`;
                if (handler[id].notes) msg += "\n  " + handler[id].notes.join(" / ");
                debug_log(msg);

                return handler[id].func(effects, other_data) + ` [${id}]`;
            } else {
                debug_log(msg);
                return `${to_proper_case(type)} ID ${id} is not supported yet`;
            }
        } catch (err) {
            debug_log(`Error at ${to_proper_case(type)} ${id} =>`, err);
            if (err === no_buff_data_msg)
                return `No valid data found for ${to_proper_case(type)} ID ${id} (${handler[id].desc})`;
            else
                return `${to_proper_case(type)} ID ${id} has an error`;
        }
    }

    function getBuffsOfType(buff_type) {
        let filtered_buffs = {};
        for (let type in buff_list) {
            filtered_buffs[type] = [];
            let keys = Object.keys(buff_list[type]);
            for (let id of keys) {
                if (buff_list[type][id].type.indexOf(buff_type) > -1) {
                    filtered_buffs[type].push(id);
                }
            }
        }
        return filtered_buffs;
    }
    this.getBuffsOfType = getBuffsOfType;

    //given an effects object, print get its effects
    function print_buff(effect, other_data) {
        var msg = "";
        // debug_log("Received " + effects);
        if (effect["proc id"] !== undefined) {
            msg = general_handler(effect, other_data, "proc");
        } else if (effect["passive id"] !== undefined) {
            msg = general_handler(effect, other_data, "passive");
        } else if (effect["unknown proc id"] !== undefined) {
            msg = general_handler(effect, other_data, "unknown proc");
        } else if (effect["unknown passive id"] !== undefined) {
            msg = general_handler(effect, other_data, "unknown passive");
        } else if (effect["unknown buff id"] !== undefined) {
            msg = general_handler(effect, other_data, "unknown buff");
        } else {
            debug_log("Unknown effect object. Using legacy printer.");
            msg = print_effect_legacy(effect);
        }
        return msg;
    }

    this.print_buff = print_buff;
    this.buff_list = buff_list;
    this.buff_types = buff_types;
};

module.exports = BuffProcessor;