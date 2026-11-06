(function ($) {

	var DexViews = window.DexViews;
	var request = DexViews.ui.request;
	var DexConfirmPopup = DexViews.ui.DexConfirmPopup;
	var HIDE_BUTTON = DexViews.ui.HIDE_BUTTON;
	var viewSearch = DexViews.ui.viewSearch;
	var mergeEffect = DexViews.mergeEffect;
	var escape = BattleLog.escapeHTML;

	var KINDS = { Moves: 'move', Abilities: 'ability', Items: 'item', Conditions: 'condition' };
	var NAMES = { Moves: 'Move', Abilities: 'Ability', Items: 'Item', Conditions: 'Condition' };
	var ICONS = { Abilities: 'star', Conditions: 'cloud' };
	var CONTROL = ['name', 'inheritsFrom', 'slots', 'replace', 'events', 'spriteFrom'];
	var BOOSTS = { atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe', accuracy: 'Acc', evasion: 'Eva' };
	var STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe', 'accuracy', 'evasion'];
	var STATUSES = [['brn', "Burn"], ['par', "Paralysis"], ['slp', "Sleep"], ['frz', "Freeze"], ['psn', "Poison"], ['tox', "Toxic"]];
	var CATEGORIES = ['Physical', 'Special', 'Status'];
	var CONDITION_KINDS = {
		status: "Status", volatileStatus: "Volatile", sideCondition: "Side", slotCondition: "Slot", pseudoWeather: "Field", weather: "Weather", terrain: "Terrain"
	};
	var YES = [['true', "Yes"]];
	var MOVE_TARGETS = [
		['normal', "Adjacent"], ['any', "Any"], ['self', "Self"], ['adjacentAlly', "Adjacent ally"], ['adjacentAllyOrSelf', "Ally or self"],
		['adjacentFoe', "Adjacent foe"], ['allAdjacent', "All adjacent"], ['allAdjacentFoes', "Adjacent foes"], ['allies', "Allies"],
		['allySide', "Ally side"], ['foeSide', "Foe side"], ['all', "Field"], ['randomNormal', "Random foe"], ['scripted', "Scripted"]
	];
	var FLAGS = {
		Moves: {
			allyanim: "The move plays its animation when used on an ally.",
			bite: "Power is multiplied by 1.5 when used by a Pokemon with the Ability Strong Jaw.",
			bullet: "Has no effect on Pokemon with the Ability Bulletproof.",
			bypasssub: "Ignores a target's substitute.",
			cantusetwice: "The user cannot select this move after a previous successful use.",
			charge: "The user is unable to make a move between turns.",
			contact: "Makes contact.",
			dance: "When used by a Pokemon, other Pokemon with the Ability Dancer can attempt to execute the same move.",
			defrost: "Thaws the user if executed successfully while the user is frozen.",
			distance: "Can target a Pokemon positioned anywhere in a Triple Battle.",
			failcopycat: "Cannot be selected by Copycat.",
			failencore: "Encore fails if target used this move.",
			failinstruct: "Cannot be repeated by Instruct.",
			failmefirst: "Cannot be selected by Me First.",
			failmimic: "Cannot be copied by Mimic.",
			futuremove: "Targets a slot, and in 2 turns damages that slot.",
			gravity: "Prevented from being executed or selected during Gravity's effect.",
			heal: "Prevented from being executed or selected during Heal Block's effect.",
			metronome: "Can be selected by Metronome.",
			minimize: "Deals double damage if the user is minimized.",
			mirror: "Can be copied by Mirror Move.",
			mustpressure: "Additional PP is deducted due to Pressure when it ordinarily would not.",
			noassist: "Cannot be selected by Assist.",
			nonsky: "Prevented from being executed or selected in a Sky Battle.",
			noparentalbond: "Cannot be made to hit twice via Parental Bond.",
			nosketch: "Cannot be copied by Sketch.",
			nosleeptalk: "Cannot be selected by Sleep Talk.",
			pledgecombo: "Gems will not activate. Cannot be redirected by Storm Drain / Lightning Rod.",
			powder: "Has no effect on Pokemon which are Grass-type, have the Ability Overcoat, or hold Safety Goggles.",
			protect: "Blocked by Detect, Protect, Spiky Shield, and if not a Status move, King's Shield.",
			pulse: "Power is multiplied by 1.5 when used by a Pokemon with the Ability Mega Launcher.",
			punch: "Power is multiplied by 1.2 when used by a Pokemon with the Ability Iron Fist.",
			recharge: "If this move is successful, the user must recharge on the following turn and cannot make a move.",
			reflectable: "Bounced back to the original user by Magic Coat or the Ability Magic Bounce.",
			slicing: "Power is multiplied by 1.5 when used by a Pokemon with the Ability Sharpness.",
			snatch: "Can be stolen from the original user and instead used by another Pokemon using Snatch.",
			sound: "Has no effect on Pokemon with the Ability Soundproof.",
			wind: "Activates the Wind Power and Wind Rider Abilities."
		},
		Abilities: {
			breakable: "Can be suppressed by Mold Breaker and related effects.",
			cantsuppress: "Ability can't be suppressed by e.g. Gastro Acid or Neutralizing Gas.",
			failroleplay: "Role Play fails if target has this Ability.",
			failskillswap: "Skill Swap fails if either the user or target has this Ability.",
			noentrain: "Entrainment fails if user has this Ability.",
			noreceiver: "Receiver and Power of Alchemy will not activate if an ally faints with this Ability.",
			notrace: "Trace cannot copy this Ability.",
			notransform: "Disables the Ability if the user is Transformed."
		}
	};
	var MOVE_NUMBERS = [
		['basePower', "Power", 'int', [0, 1000, 5], 'BP'], ['accuracy', "Accuracy", 'accuracy', null, '%'],
		['pp', "PP", 'pp'], ['priority', "Priority", 'priority']
	];
	var SECTIONS = {
		Moves: [
			["Attributes", MOVE_NUMBERS.concat([
				['critRatio', "Crit ratio", 'int', [0, 6]], ['multihit', "Hits", 'range'],
				['damage', "Fixed damage", 'damage'], ['ohko', "One-hit KO", 'select', 'ohko']
			])],
			["Effects", [
				['status', "Status", 'select', 'status'], ['volatileStatus', "Volatile status", 'select', 'condition:volatileStatus'], ['boosts', "Stat changes", 'boosts'],
				['selfBoost.boosts', "User's stat changes after hitting", 'boosts'], ['drain', "Drain", 'fraction'], ['recoil', "Recoil", 'fraction'],
				['heal', "Heal", 'fraction'], ['selfSwitch', "User switches out", 'select', YES.concat(['copyvolatile', 'shedtail'])],
				['selfdestruct', "User faints", 'select', [['always', "Always"], ['ifHit', "If it hits"]]]
			]],
			["Field", [
				['weather', "Weather", 'select', 'condition:weather'], ['terrain', "Terrain", 'select', 'condition:terrain'],
				['pseudoWeather', "Field condition", 'select', 'condition:pseudoWeather'],
				['sideCondition', "Side condition", 'select', 'condition:sideCondition'],
				['slotCondition', "Slot condition", 'select', 'condition:slotCondition']
			]],
			["Secondary effects", [['secondaries', "", 'secondaries']]],
			["After use", [['self.boosts', "User's stats", 'boosts'], ['self.volatileStatus', "User's volatile status", 'select', 'condition:volatileStatus']]],
			["Damage calculation", [
				['overrideOffensiveStat', "Attacks with", 'select', 'stat'], ['overrideDefensiveStat', "Hits against", 'select', 'stat'],
				['overrideOffensivePokemon', "Attacking stat from", 'select', [['target', "Target"], ['source', "User"]]],
				['overrideDefensivePokemon', "Defending stat from", 'select', [['target', "Target"], ['source', "User"]]],
				['ignoreImmunity', "Ignores immunities", 'select', [['true', "Yes"], ['false', "No"]]]
			]],
			["Switches", [
				['breaksProtect', "Breaks protection", 'bool'], ['forceSwitch', "Forces a switch", 'bool'],
				['hasCrashDamage', "Crash damage on a miss", 'bool'], ['hasSheerForceBoost', "Boosted by Sheer Force", 'bool'],
				['ignoreAbility', "Ignores abilities", 'bool'], ['ignoreDefensive', "Ignores defense boosts", 'bool'],
				['ignoreEvasion', "Ignores evasion", 'bool'], ['infiltrates', "Goes through screens and Substitute", 'bool'],
				['multiaccuracy', "Checks accuracy every hit", 'bool'], ['sleepUsable', "Usable while asleep", 'bool'],
				['stealsBoosts', "Steals boosts", 'bool'], ['thawsTarget', "Thaws the target", 'bool'],
				['tracksTarget', "Ignores redirection", 'bool'], ['willCrit', "Always crits", 'bool']
			]]
		],
		Abilities: [["Attributes", [['suppressWeather', "Suppresses weather", 'bool']]]],
		Items: [
			["Fling", [['fling.basePower', "Power", 'int', [0, 250]], ['fling.status', "Status", 'select', 'status'], ['fling.volatileStatus', "Volatile status", 'select', 'condition:volatileStatus']]],
			["Natural Gift", [['naturalGift.basePower', "Power", 'int', [0, 250]], ['naturalGift.type', "Type", 'select', 'type']]],
			["Effects", [['boosts', "Stat changes", 'boosts'], ['ignoreKlutz', "Works with Klutz", 'bool']]],
			["Icon", [['spriteFrom', "Use the icon of", 'select', 'ref:Items'], ['spritenum', "Sprite number", 'int', [0, 761]]]]
		],
		Conditions: [["Attributes", [
			['duration', "Duration", 'int', [1, 100]], ['counterMax', "Counter max", 'int', [1, 10000]],
			['noCopy', "Not passed by Baton Pass", 'bool'], ['affectsFainted', "Affects fainted Pokémon", 'bool']
		]]]
	};
	var SECONDARY = [
		['chance', "Chance (%)", 'int', [1, 100]], ['status', "Status", 'select', 'status'], ['volatileStatus', "Volatile status", 'select', 'condition:volatileStatus'],
		['boosts', "Target's stats", 'boosts'], ['self.boosts', "User's stats", 'boosts']
	];
	var GETTERS = { Moves: 'moves', Abilities: 'abilities', Items: 'items', Pokedex: 'species' };
	var CARET = '<svg class="dextypecaret" width="10" height="7" viewBox="0 0 14 9"><path d="M1 1H13L7 8Z" fill="#fff" stroke="#000" stroke-width="1.5" stroke-linejoin="round" /></svg>';

	function getPath(object, path) {
		var keys = path.split('.');
		for (var i = 0; i < keys.length && object; i++) object = object[keys[i]];
		return object;
	}

	function setPath(object, path, value) {
		var keys = path.split('.');
		for (var i = 0; i < keys.length - 1; i++) object = object[keys[i]] || (object[keys[i]] = {});
		object[keys[keys.length - 1]] = value;
		return object;
	}

	function blank(value) {
		return value === undefined || value === null || value === '';
	}

	var entries = null;

	function refOptions(tables, form, view) {
		if (!entries) return null;
		var options = [];
		$.each(tables, function (i, table) {
			var ids = table === 'Pokedex' ? entries.species : Object.keys(entries[table] || {});
			$.each(ids || [], function (j, id) {
				var name = GETTERS[table] ? view.dex[GETTERS[table]].get(id).name : entries.names[id];
				options.push([form === 'name' ? name || id : id, escape(name || id)]);
			});
		});
		return options.sort(function (a, b) { return a[1].localeCompare(b[1]); });
	}

	function selectOptions(options, view) {
		if (options === 'status') return STATUSES;
		if (options === 'stat') return STATS;
		if (options === 'flag') return Object.keys(FLAGS.Moves).concat(Object.keys(FLAGS.Abilities)).sort();
		if (options.slice(0, 4) === 'ref:') return refOptions(options.slice(4).split(','), 'id', view);
		if (options.slice(0, 5) === 'name:') return refOptions(options.slice(5).split(','), 'name', view);
		if (options.slice(0, 10) === 'condition:') {
			var choices = entries && entries.choices;
			if (!choices) return null;
			var used = choices[options.slice(10)] || [];
			var label = function (id) { return [id, escape(choices.names[id] || id)]; };
			var rest = choices.all.filter(function (id) { return used.indexOf(id) < 0; });
			return used.map(label).concat(used.length && rest.length ? [{ group: "Other" }] : [], rest.map(label));
		}
		var types = view.dex.types.names().filter(function (name) { return view.dex.types.get(name).exists !== false; });
		if (options === 'type') return types;
		if (options === 'ohko') return YES.concat(types);
		return options;
	}

	function optionsHTML(options, value, blankLabel) {
		var buf = blankLabel !== undefined ? '<option value=""' + (blank(value) ? ' selected' : '') + '>' + blankLabel + '</option>' : '';
		var found = blank(value);
		var exact = options.some(function (option) { return String(value) === String(Array.isArray(option) ? option[0] : option); });
		var grouped = false;
		for (var i = 0; i < options.length; i++) {
			if (options[i].group) {
				buf += (grouped ? '</optgroup>' : '') + '<optgroup label="' + escape(options[i].group) + '">';
				grouped = true;
				continue;
			}
			var option = Array.isArray(options[i]) ? options[i] : [options[i], escape(options[i])];
			var selected = !found && (exact ? String(value) === String(option[0]) : toID(value) === toID(option[0]));
			if (selected) found = true;
			buf += '<option value="' + escape(option[0]) + '"' + (selected ? ' selected' : '') + '>' + option[1] + '</option>';
		}
		if (grouped) buf += '</optgroup>';
		if (!found && typeof value !== 'object') buf += '<option value="' + escape(String(value)) + '" selected>' + escape(String(value)) + '</option>';
		return buf;
	}

	function boostsText(boosts) {
		return Object.keys(boosts || {}).map(function (stat) {
			return (BOOSTS[stat] || stat) + ' ' + (boosts[stat] > 0 ? '+' : '') + boosts[stat];
		}).join(', ');
	}

	function secondaryText(secondary) {
		var parts = [];
		if (secondary.chance) parts.push(secondary.chance + '%');
		if (secondary.status) parts.push(secondary.status);
		if (secondary.volatileStatus) parts.push(secondary.volatileStatus);
		if (secondary.boosts) parts.push(boostsText(secondary.boosts));
		if (secondary.self && secondary.self.boosts) parts.push("user " + boostsText(secondary.self.boosts));
		return parts.join(' ') || "(code)";
	}

	function priorityText(priority) {
		return (priority > 0 ? '+' : priority < 0 ? '\u2212' : '\u2007\u2009') + Math.abs(priority);
	}

	function moveGridCells(data) {
		var clamp = function (value) { return Math.max(0, Math.min(1, value)); };
		var power = data.ohko ? ["OHKO", 1] : data.damage ? [(data.damage === 'level' ? "Lv" : data.damage) + " dmg", null] :
			data.basePower ? [data.basePower + " BP", clamp((data.basePower - 20) / 130)] : ["&mdash; BP", null];
		var priority = data.priority || 0;
		var crit = data.critRatio || 1;
		var hits = Array.isArray(data.multihit) ? data.multihit : data.multihit ? [data.multihit, data.multihit] : [1, 1];
		var average = hits[0] === 2 && hits[1] === 5 ? 3.1 : (hits[0] + hits[1]) / 2;
		var secondaries = data.secondaries || (data.secondary ? [data.secondary] : []);
		var effect = secondaries.length ? [secondaries.map(secondaryText).join('; '), clamp(0.5 + (secondaries[0].chance || 100) / 200)] : ["&mdash;", null];
		var drain = data.drain ? [Math.round(data.drain[0] / data.drain[1] * 100) + "% drain", clamp(data.drain[0] / data.drain[1] * 1.5)] :
			data.recoil ? [Math.round(data.recoil[0] / data.recoil[1] * 100) + "% recoil", clamp(1 - data.recoil[0] / data.recoil[1] * 2)] :
			data.heal ? [Math.round(data.heal[0] / data.heal[1] * 100) + "% heal", clamp(data.heal[0] / data.heal[1] * 2)] : ["&mdash;", null];
		return [
			["Power", power[0], power[1]],
			["Accuracy", data.accuracy === true ? "Sure hit" : data.accuracy + "%", data.accuracy === true ? 1 : clamp((data.accuracy - 50) / 50)],
			["PP", data.pp + " PP", clamp((data.pp - 5) / 35)],
			["Priority", (priority > 0 ? "+" : "") + priority + " priority", priority ? clamp(0.5 + priority / 8) : null],
			["Crit ratio", data.willCrit ? "Sure crit" : "+" + (crit - 1) + " crit", data.willCrit ? 1 : crit > 1 ? clamp(0.5 + (crit - 1) / 4) : null],
			["Hits", hits[0] === hits[1] ? hits[0] + (hits[0] === 1 ? " hit" : " hits") : hits[0] + "&ndash;" + hits[1] + " hits", average > 1 ? clamp(0.5 + (average - 1) / 8) : null],
			[secondaries.length ? "Secondary effect" : "No secondary effect", effect[0], effect[1]],
			[data.drain ? "Drain" : data.recoil ? "Recoil" : data.heal ? "Heal" : "No drain, recoil or heal", drain[0], drain[1]]
		];
	}

	function valueText(control, value, options) {
		if (control === 'secondaries') {
			return (value || []).map(function (secondary) { return escape(secondaryText(secondary)); }).join('<br />') || '&mdash;';
		}
		if (blank(value)) return '&mdash;';
		if (control === 'accuracy' && value === true) return '&mdash;';
		if (control === 'priority') return priorityText(value);
		if (control === 'boosts') return escape(boostsText(value)) || '&mdash;';
		if (control === 'fraction' && Array.isArray(value)) return value.join('/');
		if (control === 'range' && Array.isArray(value)) return value.join('&ndash;');
		if (typeof value === 'boolean') return value ? "Yes" : "No";
		if (typeof value === 'object') return escape(JSON.stringify(value));
		if (control === 'select' && typeof options === 'string' && options.slice(0, 10) === 'condition:' && entries && entries.choices) {
			return escape(entries.choices.names[toID(value)] || String(value));
		}
		if (control === 'select' && typeof options === 'string' && options.slice(0, 4) === 'ref:') {
			var ref = (refOptions(options.slice(4).split(','), 'id', DexViews.current) || []).filter(function (entry) { return entry[0] === toID(value); })[0];
			if (ref) return ref[1];
		}
		if (control === 'select' && Array.isArray(options)) {
			var option = options.filter(function (entry) { return Array.isArray(entry) && String(entry[0]) === String(value); })[0];
			if (option) return option[1];
		}
		return escape(String(value));
	}

	function controlHTML(control, value, options, view, className) {
		var cls = className ? ' ' + className : '';
		var number = function (current, range, extra) {
			return '<input type="number" class="textbox' + cls + '"' + (range ? ' min="' + range[0] + '" max="' + range[1] + '"' + (range[2] ? ' step="' + range[2] + '"' : '') : ' step="any"') +
				' value="' + (blank(current) || typeof current !== 'number' ? '' : current) + '"' + (extra || '') + ' />';
		};
		switch (control) {
		case 'int':
			return number(value, options);
		case 'num':
			return number(value);
		case 'accuracy':
			return number(value === true ? '' : value, [0, 100, 5], ' placeholder="&mdash;"' + (value === true ? ' title="Never misses"' : ''));
		case 'pp':
			return '<select class="button' + cls + '">' + optionsHTML([1, 5, 10, 15, 20, 25, 30, 35, 40], value) + '</select>';
		case 'shortdesc':
			return '<input type="text" class="textbox' + cls + '" maxlength="' + options + '" value="' + escape(blank(value) ? '' : String(value)) + '" autocomplete="off" />';
		case 'priority':
			var priorities = [];
			for (var priority = 7; priority >= -7; priority--) priorities.push([priority, priorityText(priority)]);
			return '<select class="button' + cls + '">' + optionsHTML(priorities, value) + '</select>';
		case 'range':
			var hits = Array.isArray(value) ? value : [value, value];
			return number(hits[0], [1, 10]) + ' &ndash; ' + number(hits[1], [1, 10]);
		case 'fraction':
			var parts = Array.isArray(value) ? value : [];
			return number(parts[0], [1, 100]) + ' / ' + number(parts[1], [1, 100]);
		case 'boosts':
			return Object.keys(BOOSTS).map(function (stat) {
				return '<label class="dexboost">' + BOOSTS[stat] + ' ' + number(value && value[stat], [-6, 6], ' data-stat="' + stat + '"') + '</label>';
			}).join(' ');
		case 'damage':
			return number(value === 'level' ? '' : value, [1, 1000], value === 'level' ? ' disabled' : '') +
				' <label class="checkbox"><input type="checkbox"' + (value === 'level' ? ' checked' : '') + ' /> Equal to the user\'s level</label>';
		case 'bool':
			return '<input type="checkbox"' + (value ? ' checked' : '') + ' />';
		case 'textarea':
			return '<textarea class="textbox" rows="3">' + escape(blank(value) ? '' : String(value)) + '</textarea>';
		case 'select':
			var choices = selectOptions(options, view);
			if (!choices) return controlHTML('text', value, null, view, className);
			return '<select class="button' + cls + '">' + optionsHTML(choices, value === true ? 'true' : value === false ? 'false' : value, '&mdash;') + '</select>';
		default:
			return '<input type="text" class="textbox' + cls + '" value="' + escape(blank(value) ? '' : String(value)) + '" autocomplete="off" />';
		}
	}

	function wrap(attr, value, control, inner, tag) {
		tag = tag || 'span';
		return '<' + tag + ' class="dexeffectfield" ' + attr + '="' + escape(value) + '" data-control="' + control + '">' + inner + '</' + tag + '>';
	}

	function secondaryFields(list, current) {
		if (list.length !== 1) return { secondary: null, secondaries: list.length ? list : null };
		var secondary = $.extend({}, list[0]);
		for (var key in current || {}) {
			if (!(key in secondary)) secondary[key] = null;
		}
		return { secondary: secondary, secondaries: null };
	}

	function pairKind(src, first, second) {
		if (first.kind !== 'number' || second.kind !== 'number') return null;
		var before = src.slice(Math.max(0, first.start - 20), first.start);
		var between = src.slice(first.start + first.length, second.start);
		var after = src.charAt(second.start + second.length);
		if (/^, ?$/.test(between)) {
			if (/\[$/.test(before) && after === ']') return second.original === 4096 ? 'ratio' : 'fraction';
			if (/\.randomChance\($/.test(before) && after === ')') return 'chance';
			if (/\.random\($/.test(before) && after === ')') return 'range';
		}
		if (/\* ?$/.test(before) && /^ ?\/ ?$/.test(between)) return 'percent';
		return null;
	}

	function numberPairs(handler) {
		var src = handler.code || '';
		var pairs = {};
		var slots = handler.slots.slice().sort(function (a, b) { return a.start - b.start; });
		for (var i = 0; i + 1 < slots.length; i++) {
			var kind = pairKind(src, slots[i], slots[i + 1]);
			if (!kind) continue;
			pairs[slots[i].index] = { slot: slots[i + 1], kind: kind };
			pairs[slots[i + 1].index] = null;
			i++;
		}
		return pairs;
	}

	function round(value) {
		return Number(value.toFixed(4));
	}

	function pairMeaning(kind, top, bottom) {
		if (kind === 'ratio') return '\u00d7' + round(top / bottom);
		if (kind === 'chance' || kind === 'percent') return round(top / bottom * 100) + '%';
		if (kind === 'range') return top + '\u2013' + (bottom - 1);
		return '= ' + round(top / bottom);
	}

	function fitInline(el) {
		var text = el.tagName === 'SELECT' ? el.options[el.selectedIndex] ? el.options[el.selectedIndex].text : '' : el.value;
		el.style.width = (text.length + (el.type === 'text' ? 1 : 3)) + 'ch';
	}

	function readNumber(input) {
		var value = $.trim($(input).val());
		return value === '' || isNaN(Number(value)) ? null : Number(value);
	}

	function readField($wrap) {
		var control = $wrap.attr('data-control');
		var inputs = $wrap.find('input, select, textarea').not($wrap.find('[data-sub] input, [data-sub] select'));
		switch (control) {
		case 'int':
		case 'num':
		case 'pp':
		case 'priority':
			return readNumber(inputs[0]);
		case 'accuracy':
			var accuracy = readNumber(inputs[0]);
			return accuracy === null ? true : accuracy;
		case 'range':
			var low = readNumber(inputs[0]);
			var high = readNumber(inputs[1]);
			if (low === null || high === null || low === high) return low === null ? high : low;
			return [Math.min(low, high), Math.max(low, high)];
		case 'fraction':
			var top = readNumber(inputs[0]);
			var bottom = readNumber(inputs[1]);
			return top === null || bottom === null ? null : [top, bottom];
		case 'boosts':
			var boosts = {};
			inputs.each(function () {
				var amount = readNumber(this);
				if (amount) boosts[this.dataset.stat] = amount;
			});
			return $.isEmptyObject(boosts) ? null : boosts;
		case 'bool':
			return inputs[0].checked;
		case 'damage':
			$(inputs[0]).prop('disabled', inputs[1].checked);
			return inputs[1].checked ? 'level' : readNumber(inputs[0]);
		case 'secondaries':
			return $wrap.find('.dexsecondary').map(function () {
				var secondary = {};
				$(this).find('[data-sub]').each(function () {
					var value = readField($(this));
					if (value !== null && value !== false) setPath(secondary, this.dataset.sub, value);
				});
				return secondary;
			}).get();
		default:
			var text = $.trim(inputs.val());
			return text === '' ? null : text === 'true' ? true : text === 'false' ? false : text;
		}
	}

	var DexNewEffectPopup = Popup.extend({
		type: 'semimodal',
		initialize: function (data) {
			this.room = data.room;
			this.table = data.table;
			this.from = data.from;
			this.$el.html('<form><p><label class="label">Name:<br /><input type="text" class="textbox autofocus" name="name" maxlength="40" /></label></p>' +
				'<p class="buttonbar"><button type="submit" class="button"><strong>Create</strong></button> <button type="button" name="close" class="button">Cancel</button></p></form>');
		},
		submit: function (data) {
			var name = $.trim(data.name);
			if (!name) return;
			this.close();
			var room = this.room;
			var entries = DexViews.entries[room.dexid];
			if (entries && entries[this.table][toID(name)]) return room.openDexEffect(this.table, toID(name));
			room.pendingEffect = [this.table, toID(name)];
			var edit = {};
			edit[KINDS[this.table]] = { name: name };
			if (this.from) edit[KINDS[this.table]].inheritsFrom = this.from;
			if (this.from) edit[KINDS[this.table]].countsAs = true;
			room.editDex(edit);
		}
	});

	var viewMethods = {
		openDexEffect: function (table, id, from, keep) {
			var view = DexViews.current = this.dexView;
			id = toID(id);
			var getter = { Moves: 'moves', Abilities: 'abilities', Items: 'items' }[table];
			var entries = DexViews.entries[this.dexid];
			if (!entries) DexViews.loadEntries(this.dexid);
			var name = getter ? view.dex[getter].get(id).name : entries && entries.names && entries.names[id];
			if (this.$('.dexpage').is(':visible')) this.dexScrollTop = this.dexScroller().scrollTop();
			keep = keep && this.dexEffect && this.dexEffect.table === table && this.dexEffect.id === id;
			var effect = this.dexEffect = { table: table, id: id, name: name || id, from: keep ? this.dexEffect.from : from || '' };
			this.dexSpecies = null;
			this.$('.dexsearchpage, .dexpage').hide();
			this.$('.dexmonpage').show();
			if (keep && this.dexEffectData) {
				this.renderDexEffect();
			} else {
				this.dexEffectData = null;
				this.dexEffectPanel = table === 'Moves' || table === 'Abilities' ? 'list' : 'fields';
				this.dexScroller().scrollTop(0);
				this.$('.dexmonpage').html('<div class="teamwrapper"><div class="pad">' + this.dexEffectBackHTML() + '</div>' +
					'<div class="pad"><p class="dexeffectloading"><em>Loading...</em></p></div></div>');
			}
			var room = this;
			request('dexeffect', this.dexid + ', ' + KINDS[table] + ', ' + id).then(function (data) {
				if (room.dexEffect !== effect) return;
				$.each(data.handlers, function (i, handler) {
					$.each(handler.slots, function (j, slot) {
						slot.fixed = slot.kind === 'ref' && [data.id, data.base].indexOf(toID(slot.value)) >= 0;
					});
				});
				room.dexEffectData = data;
				effect.name = data.name;
				room.renderDexEffect();
			}, function (err) {
				if (room.dexEffect === effect) room.$('.dexmonpage .dexeffectloading').text(err.message);
			});
		},
		dexEffectBackHTML: function () {
			var effect = this.dexEffect;
			return (this.dexEditable ? '' : HIDE_BUTTON) + '<button name="closeDexEffect" class="button"><i class="fa fa-chevron-left"></i> ' +
				escape(effect.from || this.dexSummary.counts.filter(function (count) { return count.table === effect.table; }).map(function (count) {
					return BattleLog.unescapeHTML(count.name);
				})[0] || 'Dex') + '</button>';
		},
		dexEffectDraft: function () {
			return null;
		},
		dexEffectValues: function () {
			var draft = $.extend({}, this.dexEffectDraft());
			for (var i = 0; i < CONTROL.length; i++) delete draft[CONTROL[i]];
			var data = mergeEffect($.extend(true, {}, this.dexEffectData.data), draft);
			return data;
		},
		dexEffectCanEdit: function (path) {
			var top = path.split('.')[0];
			var editable = this.dexEffectData.editable;
			if (!this.dexEditable || editable && editable.indexOf(top) < 0 && top !== 'spriteFrom') return false;
			return top.slice(0, 9) !== 'secondary' || !this.dexEffectData.handlers.some(function (handler) {
				return handler.path.slice(0, 9) === 'secondary';
			});
		},
		dexEffectFieldHTML: function (path, control, options, data, className) {
			var value = control === 'secondaries' ? data.secondaries || (data.secondary ? [data.secondary] : []) : getPath(data, path);
			if (!this.dexEffectCanEdit(path)) {
				return '<div class="textbox dexfield' + (className ? ' ' + className : '') + '" data-edit="' + escape(path) + '">' + valueText(control, value, options) + '</div>';
			}
			if (control === 'secondaries') {
				var view = this.dexView;
				var rows = value.map(function (secondary, i) {
					return '<div class="dexsecondary"><table class="dexdetails">' + SECONDARY.map(function (field) {
						return '<tr><th>' + field[1] + '</th><td>' + wrap('data-sub', field[0], field[2], controlHTML(field[2], getPath(secondary, field[0]), field[3], view)) + '</td></tr>';
					}).join('') + '</table><button class="button" name="removeDexSecondary" value="' + i + '"><i class="fa fa-times"></i> Remove</button></div>';
				}).join('');
				return wrap('data-path', path, control, rows + '<p><button class="button" name="addDexSecondary"><i class="fa fa-plus"></i> Add a secondary effect</button></p>', 'div');
			}
			return wrap('data-path', path, control, controlHTML(control, value, options, this.dexView, className));
		},
		renderDexEffect: function () {
			var effect = this.dexEffect;
			var info = this.dexEffectData;
			var table = effect.table;
			var view = DexViews.current = this.dexView;
			var data = this.dexEffectValues();
			var editable = !!this.dexEditable;
			entries = DexViews.entries[this.dexid] || null;
			var scrolls = {};
			this.$('.dexmonpage [data-panel]').each(function () { scrolls[this.dataset.panel] = this.scrollTop; });
			var focused = this.$('.dexmonpage input:focus');
			var focusKey = focused.length && (focused.attr('name') || focused.closest('[data-path]').attr('data-path'));

			var buf = '<div class="pad">' + this.dexEffectBackHTML() + '</div>';
			buf += '<div class="teambar"><button disabled class="pokemon">' + escape(info.name) + '</button></div>';
			buf += '<div class="teamchartbox individual"><ol class="teamchart"><li>';
			buf += '<div class="setmenu">' + (info.handlers.length ? '<button name="showDexEffectPanel" value="code"><i class="fa fa-code"></i>Code</button>' : '') + this.dexEditsHTML();
			if (editable) buf += this.dexSaveHTML('dexsave') + ' <button name="copyDexEffect"><i class="fa fa-clone"></i>Copy</button>';
			if (editable && info.edited) {
				buf += ' <button name="deleteDexEffect"><i class="fa fa-trash"></i>' + (info.official ? 'Reset to base' : 'Delete') + '</button>';
			} else if (!editable) {
				buf += ' <button name="forkDexEffect"><i class="fa fa-code-fork"></i>Fork</button>';
			}
			buf += '</div>';
			buf += '<div class="setchart dexmonchart dexeffectchart' + (table === 'Moves' ? ' dexmovechart' : '') + '">';

			buf += '<div class="setcol setcol-icon"><div class="setcell-sprite dexmoveicons">' + this.dexEffectIconHTML(data) + '</div>';
			buf += '<div class="setcell setcell-pokemon"><label>' + NAMES[table] + '</label><input type="text" class="textbox dexfield" name="effectsearch" value="' + escape(info.name) + '" autocomplete="off" /></div></div>';

			buf += '<div class="setcol setcol-details">';
			if (table === 'Moves') {
				var count = this.dexEffectCanEdit('shortDesc') ? ' (<span class="dexdesccount">' + (data.shortDesc || '').length + '/55</span>)' : '';
				buf += '<div class="setrow"><div class="setcell dexshortdesc"><label>Short description' + count + '</label>' + this.dexEffectFieldHTML('shortDesc', 'shortdesc', 55, data, 'dexfield') + '</div></div>';
				buf += '<div class="setrow dexmovenumbers">';
				for (var n = 0; n < MOVE_NUMBERS.length; n++) {
					buf += '<div class="setcell' + (MOVE_NUMBERS[n][4] ? ' dexunitcell' : '') + '"><label>' + MOVE_NUMBERS[n][1] + '</label>' + this.dexEffectFieldHTML(MOVE_NUMBERS[n][0], MOVE_NUMBERS[n][2], MOVE_NUMBERS[n][3], data, 'dexfield') +
						(MOVE_NUMBERS[n][4] ? '<span class="dexunit">' + MOVE_NUMBERS[n][4] + '</span>' : '') + '</div>';
				}
				buf += '</div>';
			}
			buf += '<div class="setrow setrow-abilities">';
			if (FLAGS[table]) buf += '<div class="setcell"><label class="dexflaglabel">Flags (' + Object.keys(data.flags || {}).filter(function (flag) { return data.flags[flag]; }).length + ')</label><div class="textbox dexchipbox dexflagbox">' + this.dexFlagChipsHTML(data) + '</div></div>';
			buf += '</div></div>';

			buf += '<div class="setcol setcol-moves">';
			var cells = {
				Moves: [['Target', 'target', 'select', MOVE_TARGETS], ['Learned by']],
				Abilities: [['Weather', 'suppressWeather', 'select', [['true', "Suppresses"], ['false', "Doesn't suppress"]]], ['Pokémon']],
				Items: [['Fling power', 'fling.basePower', 'int', [0, 250]], ['Natural Gift type', 'naturalGift.type', 'select', 'type']],
				Conditions: [['Duration', 'duration', 'int', [1, 100]], ['Counter max', 'counterMax', 'int', [1, 10000]]]
			}[table];
			for (var c = 0; c < cells.length; c++) {
				buf += '<div class="setcell' + (cells[c][1] ? '' : ' setcell-learnset') + '"><label' + (cells[c][1] ? '' : ' class="dexlearnsetlabel" data-name="' + cells[c][0] + '"') + '>' + cells[c][0] + '</label>';
				buf += cells[c][1] ? this.dexEffectFieldHTML(cells[c][1], cells[c][2], cells[c][3], data, 'dexfield') :
					'<input type="text" class="textbox dexfield learnsetcount" name="learnersearch" placeholder="Pok&eacute;mon" autocomplete="off" />';
				buf += '</div>';
			}
			buf += '</div>';

			buf += '<div class="setcol setcol-stats">' + this.dexEffectStatsHTML(data) + '</div>';
			buf += '</div></li></ol></div>';
			if (table === 'Moves' || table === 'Abilities') buf += '<div class="teambuilder-results" data-panel="list"></div>';
			buf += '<div class="teambuilder-results" data-panel="effects"></div>';
			if (FLAGS[table]) buf += '<div class="dexstatresults dexeffectpanel" data-panel="flags"></div>';
			buf += '<div class="dexstatresults dexeffectpanel" data-panel="fields">' + this.dexEffectFieldsHTML(data) + '</div>';
			buf += '<div class="dexstatresults dexeffectpanel dexcode" data-panel="code">' + this.dexEffectCodeHTML() + '</div>';
			this.$('.dexmonpage').html('<div class="teamwrapper">' + buf + '</div>');
			this.dexEffectPicker = null;
			this.$('.dexmonpage pre select.dexinline').each(function () { fitInline(this); });

			if (table === 'Moves' || table === 'Abilities') this.setupDexEffectList();
			this.showDexEffectPanel(this.dexEffectPanel, true);
			this.$('.dexmonpage [data-panel]').each(function () {
				if (scrolls[this.dataset.panel]) this.scrollTop = scrolls[this.dataset.panel];
			});
			if (focusKey) {
				var $focus = this.$('.dexmonpage input[name="' + focusKey + '"]');
				if (!$focus.length) $focus = this.$('.dexmonpage [data-path="' + focusKey + '"] input').first();
				$focus.focus();
			}
			this.scaleDexPokemon();
			this.markDexEdits();
		},
		markDexEffectEdits: function () {
			var info = this.dexEffectData;
			var original = info && info.original;
			var $page = this.$('.dexmonpage');
			$page.find('button[name=toggleDexEdits]').toggle(!!original);
			if (!original) return;
			var self = this;
			var data = this.dexEffectValues();
			var valueOf = function (object, path) {
				if (path === 'secondaries') return object.secondaries || (object.secondary ? [object.secondary] : []);
				if (path === 'countsAs') return !!object.countsAs;
				return getPath(object, path);
			};
			$page.find('[data-path], [data-edit]').each(function () {
				var path = this.getAttribute('data-path') || this.getAttribute('data-edit');
				if (DexViews.ui.changedValue(valueOf(data, path), valueOf(original, path))) $(this).addClass('dexedited');
			});
			var flags = data.flags || {};
			if (Object.keys(original.flags || {}).some(function (flag) { return original.flags[flag] && !flags[flag]; })) $page.find('.dexflagbox').addClass('dexedited');
			var slots = {};
			$.each(info.handlers, function (i, handler) {
				$.each(handler.slots, function (j, slot) { slots[handler.path + ':' + slot.index] = slot; });
			});
			if ($page.find('[data-panel=fields] .dexedited').not('[data-path=shortDesc], [data-path=desc], [data-path=countsAs], [data-edit=shortDesc], [data-edit=desc], [data-edit=countsAs]').length) $page.find('.setstats').addClass('dexedited');
			$page.find('[data-slotkeys]').each(function () {
				if (this.getAttribute('data-slotkeys').split(' ').some(function (key) {
					return slots[key] && String(self.dexEffectSlotValue(key, slots[key])) !== String(slots[key].original);
				})) $(this).addClass('dexedited');
			});
			$page.find('[data-event]').each(function () {
				var path = this.getAttribute('data-event');
				if ($(this).find('select').val() !== path.slice(path.lastIndexOf('.') + 1)) $(this).addClass('dexedited');
			});
		},
		dexEffectIconHTML: function (data) {
			var table = this.dexEffect.table;
			if (table === 'Moves') return this.dexEffectIconSelectHTML('type', data.type) + this.dexEffectIconSelectHTML('category', data.category);
			if (table === 'Items') return '<span class="itemicon dexitemicon" style="' + Dex.getItemIcon($.extend({}, data, { id: this.dexEffect.id })) + '"></span>';
			return '<i class="fa fa-' + ICONS[table] + ' dexeffecticon"></i>';
		},
		dexEffectIconSelectHTML: function (path, value) {
			var view = this.dexView;
			var icon = function (name) { return path === 'type' ? Dex.getTypeIcon(name) : Dex.getCategoryIcon(name); };
			if (!this.dexEffectCanEdit(path)) return '<span data-edit="' + path + '" title="' + escape(value) + '">' + icon(value) + '</span>';
			var names = path === 'type' ? selectOptions('type', view) : CATEGORIES;
			var options = names.map(function (name) {
				return '<option value="' + escape(name) + '"' + (name === value ? ' selected' : '') + '>' + icon(name) + '</option>';
			}).join('');
			return wrap('data-path', path, 'select', '<span class="dextypeslot" title="' + escape(value) + '">' + icon(value) +
				'<select class="dextypearrow base-select"><button></button>' + options + '</select>' + CARET + '</span>');
		},
		dexFlagChipsHTML: function (data) {
			var flags = Object.keys(data.flags || {}).filter(function (flag) { return data.flags[flag]; });
			var editable = this.dexEffectCanEdit('flags');
			return flags.map(function (flag) {
				return '<span class="dexchip" data-edit="flags.' + escape(flag) + '">' + escape(flag) + (editable ? ' <button class="dexchipx" name="toggleDexEffectFlag" value="' + escape(flag) + '" tabindex="-1">&times;</button>' : '') + '</span>';
			}).join('') + (editable ? '<input type="text" class="dexchipinput" name="effectflags"' + (flags.length ? '' : ' placeholder="Flags"') + ' autocomplete="off" />' : '');
		},
		dexFlagListHTML: function (query) {
			var data = this.dexEffectValues();
			var flags = data.flags || {};
			var editable = this.dexEffectCanEdit('flags');
			var descs = FLAGS[this.dexEffect.table];
			query = toID(query);
			var ids = Object.keys($.extend({}, descs, flags)).filter(function (flag) {
				return !query || flag.indexOf(query) >= 0 || toID(descs[flag] || '').indexOf(query) >= 0;
			}).sort();
			var set = ids.filter(function (flag) { return flags[flag]; });
			var groups = [["Flags (" + set.length + ")", set]];
			if (editable) groups.push(["Other flags", ids.filter(function (flag) { return !flags[flag]; })]);
			var buf = '<ul class="utilichart">';
			$.each(groups, function (i, group) {
				buf += '<li class="result"><h3>' + group[0] + '</h3></li>';
				$.each(group[1], function (j, flag) {
					buf += '<li class="result"><a data-entry="flag|' + flag + '" data-edit="flags.' + flag + '"' + (editable && flags[flag] ? ' class="cur"' : '') + '>' +
						'<span class="col movenamecol">' + flag + '</span> <span class="col movedesccol">' + escape(descs[flag] || '') + '</span></a></li>';
				});
			});
			return buf + '</ul>';
		},
		dexEffectStatsHTML: function (data) {
			var table = this.dexEffect.table;
			var rows;
			if (table === 'Abilities') {
				rows = [
					['Flags', Object.keys(data.flags || {}).length], ['Weather', data.suppressWeather ? 'Off' : '—'],
					['Handlers', this.dexEffectData.handlers.length]
				];
			} else if (table === 'Items') {
				rows = [
					['Fling', data.fling && data.fling.basePower || '—'], ['Gift', data.naturalGift && data.naturalGift.basePower || '—'],
					['Gift type', data.naturalGift && data.naturalGift.type || '—'], ['Boosts', boostsText(data.boosts) || '—'],
					['Klutz', data.ignoreKlutz ? 'Works' : '—']
				];
			} else {
				rows = [
					['Duration', data.duration || '—'], ['Counter', data.counterMax || '—'],
					['No copy', data.noCopy ? 'Yes' : 'No'], ['Fainted', data.affectsFainted ? 'Yes' : 'No']
				];
			}
			var buf = '<div class="setrow"><label>All attributes</label><button class="textbox setstats dexmoveattributes" tabindex="-1" name="showDexEffectPanel" value="fields">';
			if (table === 'Moves') {
				buf += '<span class="dexmovegrid">';
				$.each(moveGridCells(data), function (i, cell) {
					var hue = Math.round(cell[2] * 120);
					buf += '<span title="' + cell[0] + '"' + (cell[2] === null ? '' : ' style="background:hsl(' + hue + ',40%,75%);border-color:hsl(' + hue + ',40%,45%)"') + '>' + cell[1] + '</span>';
				});
				return buf + '</span></button></div>';
			}
			for (var i = 0; i < rows.length; i++) {
				buf += '<span class="statrow"><label>' + rows[i][0] + '</label> <em title="' + escape(String(rows[i][1])) + '">' + escape(String(rows[i][1])) + '</em></span>';
			}
			return buf + '</button></div>';
		},
		dexEffectFieldsHTML: function (data) {
			var self = this;
			var sections = SECTIONS[this.dexEffect.table].slice();
			if (this.dexEffect.table === 'Moves' && $.isPlainObject(data.condition)) {
				var leaves = [];
				var collect = function (object, prefix) {
					$.each(object, function (key, value) {
						if ($.isPlainObject(value)) return collect(value, prefix + key + '.');
						if (['number', 'boolean', 'string'].indexOf(typeof value) >= 0) {
							leaves.push([prefix + key, (prefix + key).slice(10), typeof value === 'number' ? 'num' : typeof value === 'boolean' ? 'bool' : 'text']);
						}
					});
				};
				collect(data.condition, 'condition.');
				if (leaves.length) sections.push(["Its condition", leaves]);
			}
			sections.unshift(["Description", [['shortDesc', "Short", 'shortdesc', this.dexEffect.table === 'Moves' ? 55 : 90], ['desc', "Full", 'textarea']]]);
			var info = this.dexEffectData;
			if (info.base && info.base !== info.id) {
				var original = valueText('select', info.base, 'ref:' + this.dexEffect.table);
				var counts = "Wherever the battle engine or another effect checks for " + original + ", this copy counts too. Both can be active at once.";
				if (!data.countsAs && info.lost && (info.lost.engine.length || info.lost.references.length)) {
					counts += " Without it, this copy misses how the engine treats " + original + " and " + info.lost.references.length + " effects that check for it by name.";
				}
				sections.splice(1, 0, ["Counts as", [['countsAs', "Counts as " + original, 'bool']], counts]);
			}
			var buf = '<div class="pad">';
			if (this.dexEditable && this.dexEffectData.editable) {
				buf += '<p><small>Legality, forme and engine fields can only be changed in official dexes, so they aren\'t listed here.</small></p>';
			}
			$.each(sections, function (i, section) {
				var rows = '';
				$.each(section[1], function (j, field) {
					if (!self.dexEffectCanEdit(field[0]) && blank(field[2] === 'secondaries' ? data.secondaries || data.secondary : getPath(data, field[0]))) return;
					rows += '<tr><th>' + field[1] + '</th><td>' + self.dexEffectFieldHTML(field[0], field[2], field[3], data) + '</td></tr>';
				});
				if (rows) buf += '<div class="resultheader"><h3>' + section[0] + '</h3></div><table class="dexdetails dexeffectfields">' + rows + '</table>';
				if (rows && section[2]) buf += '<p><small>' + section[2] + '</small></p>';
			});
			return buf + '</div>';
		},
		dexEffectSlotValue: function (key, slot) {
			var slots = (this.dexEffectDraft() || {}).slots || {};
			return Object.prototype.hasOwnProperty.call(slots, key) ? slots[key] === null ? slot.original : slots[key] : slot.value;
		},
		dexEffectSlotGroups: function () {
			var groups = [];
			var byValue = {};
			var colors = {};
			$.each(this.dexEffectData.handlers, function (i, handler) {
				if (!handler.editable) return;
				var pairs = numberPairs(handler);
				$.each(handler.slots, function (j, slot) {
					if (pairs[slot.index] === null || slot.fixed) return;
					var member = { key: handler.path + ':' + slot.index, slot: slot, path: handler.path };
					var pair = pairs[slot.index];
					if (pair) member.pair = { key: handler.path + ':' + pair.slot.index, slot: pair.slot, kind: pair.kind };
					var id = slot.kind === 'number' ? null : slot.kind + '|' + toID(slot.original);
					if (id && byValue[id]) {
						byValue[id].push(member);
					} else {
						var group = [member];
						if (id) byValue[id] = group;
						groups.push(group);
					}
					colors[member.key] = groups.indexOf(byValue[id] || groups[groups.length - 1]);
					if (member.pair) colors[member.pair.key] = colors[member.key];
				});
			});
			$.each(colors, function (key, index) {
				colors[key] = Math.round(index * 360 / groups.length);
			});
			return { groups: groups, colors: colors };
		},
		dexEffectEventHTML: function (handler, src, editable) {
			var original = handler.path.slice(handler.path.lastIndexOf('.') + 1);
			if (!handler.events.length || src.slice(0, original.length) !== original) return '';
			var events = (this.dexEffectDraft() || {}).events || {};
			var event = Object.prototype.hasOwnProperty.call(events, handler.path) ? events[handler.path] || original : handler.event;
			if (!editable) return escape(event);
			return wrap('data-event', handler.path, 'select', '<select class="dexinline dexevent">' + optionsHTML([original].concat(handler.events), event) + '</select>');
		},
		dexEffectCodeBlockHTML: function (handler, grouping, editable) {
			var self = this;
			var src = handler.code || '';
			if (!handler.editable || !handler.slots.length) {
				var source = (this.dexEffectData.source || []).filter(function (entry) { return entry[0] === handler.path; })[0];
				var plain = source ? source[1] : src;
				var name = this.dexEffectEventHTML(handler, plain, editable);
				var skip = name ? handler.path.length - handler.path.lastIndexOf('.') - 1 : 0;
				return name + escape(plain.slice(skip));
			}
			var view = this.dexView;
			var colors = grouping.colors;
			var linked = {};
			$.each(grouping.groups, function (i, group) {
				var byValue = {};
				$.each(group, function (j, member) {
					var value = toID(self.dexEffectSlotValue(member.key, member.slot));
					(byValue[value] = byValue[value] || []).push(member.key);
				});
				$.each(byValue, function (value, keys) {
					$.each(keys, function (j, key) { linked[key] = keys.join(' '); });
				});
			});
			var rows = src.split('\n');
			var indent = Math.min.apply(null, rows.slice(1).filter(function (row) { return $.trim(row); }).map(function (row) {
				return row.length - row.replace(/^\s+/, '').length;
			}));
			if (!isFinite(indent)) indent = 0;
			var buf = this.dexEffectEventHTML(handler, src, editable);
			var at = buf ? handler.path.length - handler.path.lastIndexOf('.') - 1 : 0;
			var slots = handler.slots.slice().sort(function (a, b) { return a.start - b.start; });
			var pairs = numberPairs(handler);
			var text = function (from, until) {
				var chunk = src.slice(from, until);
				return escape(indent ? chunk.replace(new RegExp('\n[ \t]{0,' + indent + '}', 'g'), '\n') : chunk);
			};
			var shownOf = function (slot) {
				var value = self.dexEffectSlotValue(handler.path + ':' + slot.index, slot);
				var shown = src.slice(slot.start, slot.start + slot.length);
				if (String(value) === String(slot.original)) return shown;
				if (slot.kind === 'stat' && /^[a-z]+$/.test(shown)) return String(value);
				if (typeof value === 'number') return value < 0 || Object.is(value, -0) ? '(' + value + ')' : String(value);
				return JSON.stringify(value);
			};
			var style = function (key, width, keys) {
				return ' data-slotkeys="' + escape(keys || key) + '" style="--hue: ' + colors[key] + (width ? '; width: ' + width + 'ch' : '') + '"';
			};
			var controlOf = function (slot) {
				var key = handler.path + ':' + slot.index;
				var value = self.dexEffectSlotValue(key, slot);
				var was = String(value) === String(slot.original) ? '' : ' title="Was ' + escape(String(slot.original)) + '"';
				if (slot.kind === 'number') {
					return wrap('data-slot', key, 'num', '<input type="number" class="dexinline dexmark" step="' + (slot.original % 1 ? 0.1 : 1) +
						'" value="' + value + '"' + style(key, String(value).length + 3) + was + ' />');
				}
				var options = slot.kind === 'ref' ? (slot.form === 'name' ? 'name:' : 'ref:') + slot.tables.join(',') :
					{ type: 'type', category: CATEGORIES, stat: 'stat', status: 'status', flag: 'flag' }[slot.kind];
				var choices = selectOptions(options, view);
				var listed = choices && choices.some(function (choice) { return toID(Array.isArray(choice) ? choice[0] : choice) === toID(value); });
				if (choices && !listed && slot.kind === 'ref') {
					var name = slot.tables.map(function (table) {
						return GETTERS[table] ? view.dex[GETTERS[table]].get(String(value)).name : entries && entries.names[toID(value)];
					}).filter(Boolean)[0];
					choices = [[value, escape(name || String(value))]].concat(choices);
				}
				var inner = choices ? '<select class="dexinline dexmark"' + style(key) + was + '>' + optionsHTML(choices, value) + '</select>' :
					'<input type="text" class="dexinline dexmark" value="' + escape(String(value)) + '"' + style(key, String(value).length + 1) + was + ' />';
				return wrap('data-slot', linked[key] || key, choices ? 'select' : 'text', inner);
			};
			$.each(slots, function (i, slot) {
				if (pairs[slot.index] === null) return;
				var key = handler.path + ':' + slot.index;
				var pair = pairs[slot.index];
				buf += text(at, slot.start);
				at = pair ? pair.slot.start + pair.slot.length : slot.start + slot.length;
				if (slot.fixed) {
					buf += escape(shownOf(slot));
					return;
				}
				if (!pair) {
					buf += editable ? controlOf(slot) : '<mark class="dexmark"' + style(key) + '>' + escape(shownOf(slot)) + '</mark>';
					return;
				}
				var meaning = pairMeaning(pair.kind, self.dexEffectSlotValue(key, slot), self.dexEffectSlotValue(handler.path + ':' + pair.slot.index, pair.slot));
				var between = text(slot.start + slot.length, pair.slot.start);
				buf += editable ? '<span class="dexpair" data-kind="' + pair.kind + '" title="' + escape(meaning) + '">' + controlOf(slot) + between + controlOf(pair.slot) + '</span>' :
					'<mark class="dexmark"' + style(key, 0, key + ' ' + handler.path + ':' + pair.slot.index) + ' title="' + escape(meaning) + '">' + escape(shownOf(slot)) + between + escape(shownOf(pair.slot)) + '</mark>';
			});
			buf += text(at, src.length);
			return buf;
		},
		dexEffectCodeHTML: function () {
			var self = this;
			var info = this.dexEffectData;
			var editable = !!this.dexEditable;
			var buf = '<div class="pad">';
			var grouping = this.dexEffectSlotGroups();
			$.each(info.handlers, function (i, handler) {
				buf += '<h3>' + escape(handler.path) + '</h3>';
				if (!handler.editable) buf += '<p><small>This code can\'t be changed here.</small></p>';
				buf += '<pre data-code="' + escape(handler.path) + '">' + self.dexEffectCodeBlockHTML(handler, grouping, editable) + '</pre>';
			});
			return buf + '</div>';
		},
		setupDexMoveLearners: function () {
			var effect = this.dexEffect;
			var editable = this.dexEditable;
			var view = this.dexView;
			var saved = this.dexBaseView || view;
			var entries = DexViews.entries[this.dexid];
			var $results = this.$('.dexmonpage [data-panel=list]');
			var search = this.dexEffectSearch = new BattleSearch($results, $results);
			var learners = {};
			var count = 0;
			var learnedBefore = function (id) {
				var original = entries && entries.originals[id];
				if (original === null) return learners[id];
				if (original) return original.learnset.indexOf(effect.id) >= 0;
				var learnset = DexViews.learnsetOf(saved, id);
				return !!(learnset && learnset[effect.id]);
			};
			search.renderRow = function (id, type, matchStart, matchLength, errorMessage, attrs) {
				var classes = type !== 'pokemon' ? '' : (editable && learners[id] ? ' cur' : '') + (learners[id] !== learnedBefore(id) ? ' dexedited' : '');
				if (classes) attrs = attrs ? attrs.replace('class="', 'class="' + classes.slice(1) + ' ') : ' class="' + classes.slice(1) + '"';
				return BattleSearch.prototype.renderRow.call(this, id, type, matchStart, matchLength, errorMessage, attrs);
			};
			viewSearch(search, view, function (typedSearch) {
				var getBaseResults = typedSearch.getBaseResults;
				typedSearch.getBaseResults = function () {
					var learned = [];
					var inherited = [];
					var others = [];
					var seen = {};
					$.each(getBaseResults.call(this), function (i, row) {
						if (row[0] !== 'pokemon' || seen[row[1]]) return;
						seen[row[1]] = 1;
						var learnset = DexViews.learnsetOf(view, row[1]);
						learners[row[1]] = !!(learnset && learnset[effect.id]);
						(learners[row[1]] ? learned : this.canLearn(row[1], effect.id) ? inherited : others).push(row);
					}.bind(this));
					$.each([learned, inherited, others], function (i, list) {
						list.sort(function (a, b) { return a[1] < b[1] ? -1 : 1; });
					});
					count = learned.length + inherited.length;
					var results = [['header', "Learned by (" + learned.length + ")"]].concat(learned);
					if (inherited.length) results = results.concat([['header', "From pre-evolutions (" + inherited.length + ")"]], inherited);
					return editable ? results.concat([['header', "Other Pokémon"]], others) : results;
				};
			});
			$results.off('scroll').on('scroll', function () {
				search.updateScroll();
			});
			search.setType('pokemon', 'gen' + view.gen);
			this.dexEffectListCount(count);
		},
		setupDexEffectList: function () {
			var effect = this.dexEffect;
			if (effect.table === 'Moves') return this.setupDexMoveLearners();
			var view = this.dexView;
			var $results = this.$('.dexmonpage [data-panel=list]');
			var search = this.dexEffectSearch = new BattleSearch($results, $results);
			viewSearch(search, view, function (typedSearch) {
				var getBaseResults = typedSearch.getBaseResults;
				typedSearch.getBaseResults = function () {
					return DexViews.ui.dropEmptyHeaders(getBaseResults.call(this).filter(function (row) {
						if (row[0] !== 'pokemon') return true;
						if (effect.table === 'Moves') return this.canLearn(row[1], effect.id);
						var abilities = this.dex.species.get(row[1]).abilities;
						return Object.keys(abilities).some(function (slot) { return toID(abilities[slot]) === effect.id; });
					}, this), 'pokemon');
				};
			});
			$results.on('scroll', function () {
				search.updateScroll();
			});
			search.setType('pokemon', 'gen' + view.gen);
			this.dexEffectListCount(search.resultSet.filter(function (row) { return row[0] === 'pokemon'; }).length);
		},
		dexEffectListCount: function (count) {
			var $label = this.$('.dexmonpage .dexlearnsetlabel');
			$label.text($label.attr('data-name') + ' (' + count + ')');
			var query = $.trim(this.$('.dexmonpage input[name=learnersearch]').val() || '');
			if (query) this.dexEffectSearch.find(query);
		},
		focusDexLearnerSearch: function () {
			if (this.dexEffectPanel !== 'list') this.showDexEffectPanel('list', true);
		},
		searchDexLearners: function (e) {
			if (this.dexEffectPanel !== 'list') this.showDexEffectPanel('list', true);
			this.dexEffectSearch.find($.trim(e.currentTarget.value));
		},
		showDexEffectPanel: function (panel, keep) {
			if (!this.dexEffectData) return;
			var table = this.dexEffect.table;
			var start = table === 'Moves' || table === 'Abilities' ? 'list' : 'fields';
			if (!keep && panel === this.dexEffectPanel && panel !== start && panel !== 'flags') panel = start;
			if (panel === 'code' && !this.dexEffectData.handlers.length) panel = start;
			this.dexEffectPanel = panel;
			if (panel === 'flags') {
				this.$('.dexmonpage [data-panel=flags]').html(this.dexFlagListHTML(this.$('.dexmonpage input[name=effectflags]').val()));
				if (!keep) this.markDexEdits();
			}
			this.$('.dexmonpage [data-panel]').each(function () {
				$(this).toggle(this.dataset.panel === panel);
			});
			this.$('.dexmonpage .setstats').toggleClass('cur', panel === 'fields' && start !== 'fields');
			this.$('.dexmonpage .setmenu button[value=code]').toggleClass('cur', panel === 'code');
			if (panel === 'list' && this.dexEffectSearch) this.dexEffectSearch.updateScroll();
			if (panel === 'effects' && !this.dexEffectPicker) this.setupDexEffectPicker();
		},
		setupDexEffectPicker: function () {
			var table = this.dexEffect.table;
			var $results = this.$('.dexmonpage [data-panel=effects]');
			if (table === 'Conditions') {
				this.dexEffectPicker = true;
				$results.html(this.dexConditionsHTML().replace(/^<p>.*?<\/p>/, ''));
				return;
			}
			var kind = { Moves: 'move', Abilities: 'ability', Items: 'item' }[table];
			var dexid = this.dexid;
			var search = this.dexEffectPicker = new BattleSearch($results, $results);
			viewSearch(search, this.dexView, function (typedSearch) {
				typedSearch.dexid = dexid;
				typedSearch.getBaseResults = function () {
					var shown = DexViews.entries[dexid];
					var seen = {};
					var results = DexViews.ui.dropEmptyHeaders(this.getDefaultResults().filter(function (row) {
						if (row[0] !== kind) return true;
						seen[row[1]] = 1;
						return !!shown && !!shown[table][row[1]];
					}));
					var others = Object.keys(shown ? shown[table] : {}).filter(function (id) { return !seen[id]; }).sort();
					if (!others.length) return results;
					return results.concat([['header', "Other " + table.toLowerCase()]], others.map(function (id) {
						return [kind, id];
					}));
				};
			});
			$results.off('scroll').on('scroll', function () {
				search.updateScroll();
			});
			search.setType(kind, 'gen' + this.dexView.gen);
		},
		focusDexEffectSearch: function (e) {
			e.currentTarget.select();
			this.showDexEffectPanel('effects', true);
		},
		searchDexEffects: function (e) {
			var query = e.currentTarget.value;
			if (this.dexEffectPanel !== 'effects') this.showDexEffectPanel('effects', true);
			if (this.dexEffectPicker !== true) return this.dexEffectPicker.find(query);
			query = toID(query);
			this.$('.dexmonpage [data-panel=effects] .result').each(function () {
				var $a = $(this).children('a');
				$(this).toggle(!$a.length || !query || toID($a.children('.movenamecol').text()).indexOf(query) >= 0);
			});
		},
		blurDexEffectSearch: function (e) {
			if (this.dexEffectData) e.currentTarget.value = this.dexEffectData.name;
		},
		clickDexEffectEntry: function (e) {
			var entry = e.currentTarget.dataset.entry.split('|');
			var table = { move: 'Moves', ability: 'Abilities', item: 'Items', condition: 'Conditions' }[entry[0]];
			if (table && $(e.currentTarget).closest('[data-panel=effects]').length) {
				this.openDexEffect(table, entry[1], this.dexEffect.from);
				return;
			}
			if (entry[0] === 'flag') {
				if (this.dexEditable) this.toggleDexEffectFlag(entry[1]);
				return;
			}
			if (entry[0] === 'pokemon') {
				this.openDexPokemon(entry[1]);
				return;
			}
			if (this.dexEffectSearch && this.dexEffectSearch.addFilter(e.currentTarget)) this.dexEffectSearch.find('');
		},
		closeDexEffect: function () {
			var from = this.dexEffect && this.dexEffect.from;
			this.dexEffect = null;
			this.dexEffectData = null;
			this.dexEffectSearch = null;
			if (from) return this.openDexPokemon(from);
			this.closeDexPokemon();
		},
		forkDexEffect: function (value, button) {
			this.forkInto(this.dexEffect.name, false, button, KINDS[this.dexEffect.table]);
		},
		dexConditionsHTML: function () {
			var entries = DexViews.entries[this.dexid];
			if (!entries || !entries.Conditions) return '<p><em>Loading...</em></p>';
			var names = entries.names || {};
			var custom = entries.custom.Conditions || [];
			var modified = entries.modified.Conditions || [];
			var statuses = {};
			$.each(STATUSES, function (i, status) { statuses[status[0]] = status[1]; });
			var nameOf = function (id) {
				return statuses[id] && (names[id] || id) === id ? statuses[id] : names[id] || id;
			};
			var kinds = Object.keys(CONDITION_KINDS);
			var rank = function (id) {
				var kind = kinds.indexOf((entries.conditions[id] || [''])[0]);
				return kind < 0 ? kinds.length : kind;
			};
			var ids = Object.keys(entries.Conditions).sort(function (a, b) {
				return rank(a) - rank(b) || nameOf(a).localeCompare(nameOf(b));
			});
			var groups = [
				[this.dexView.name + " custom conditions", ids.filter(function (id) { return custom.indexOf(id) >= 0; })],
				[this.dexView.name + " modified conditions", ids.filter(function (id) { return modified.indexOf(id) >= 0; })],
				["Conditions", ids.filter(function (id) { return custom.indexOf(id) < 0 && modified.indexOf(id) < 0; })]
			];
			var buf = this.dexEditable ? '<p><button class="button" name="newDexEffect"><i class="fa fa-plus"></i> New condition</button></p>' : '';
			buf += '<ul class="utilichart">';
			$.each(groups, function (i, group) {
				if (!group[1].length) return;
				buf += '<li class="result"><h3>' + escape(group[0]) + '</h3></li>';
				$.each(group[1], function (j, id) {
					var info = entries.conditions[id] || ['', ''];
					buf += '<li class="result"><a data-entry="condition|' + id + '"><span class="col movenamecol">' + escape(nameOf(id)) + '</span> ' +
						'<span class="col widelabelcol"><em>Kind</em><br />' + (CONDITION_KINDS[info[0]] || '&mdash;') + '</span> ' +
						'<span class="col movedesccol">' + escape(info[1]) + '</span></a></li>';
				});
			});
			return buf + '</ul>';
		}
	};

	var builderMethods = {
		closeDexEffect: function (value, button) {
			if (button) return this.leaveDex(button, function () { this.closeDexEffect(); });
			viewMethods.closeDexEffect.call(this);
		},
		clickDexEffectEntry: function (e) {
			var entry = e.currentTarget.dataset.entry.split('|');
			if (entry[0] !== 'pokemon' || this.dexEffect.table !== 'Moves' || !this.dexEditable) return viewMethods.clickDexEffectEntry.call(this, e);
			var $results = this.$('.dexmonpage [data-panel=list]');
			var top = $results.scrollTop();
			this.toggleDexMove(toID(entry[1]), this.dexEffect.id);
			this.setupDexEffectList();
			$results.scrollTop(top);
			this.dexEffectSearch.updateScroll();
		},
		dexEffectDraft: function () {
			var effect = this.dexEffect;
			var key = effect.table + ':' + effect.id;
			var fields = null;
			$.each([this.dexSaving, this.dexDraft], function (i, layer) {
				if (layer && layer.effects && layer.effects[key]) fields = mergeEffect(fields || {}, layer.effects[key], true);
			});
			return fields;
		},
		saveDexEffect: function (fields) {
			var effect = this.dexEffect;
			this.draftDex('effects', effect.table + ':' + effect.id, $.extend({ name: this.dexEffectData.name }, fields));
		},
		changeDexEffectField: function (e) {
			if (!this.dexEffectData) return;
			var $wrap = $(e.currentTarget).closest('[data-path], [data-slot], [data-event]');
			var value = readField($wrap);
			var fields = {};
			if ($wrap.attr('data-slot')) {
				var handlers = this.dexEffectData.handlers;
				var slotOf = function (key) {
					var split = key.lastIndexOf(':');
					return handlers.filter(function (handler) { return handler.path === key.slice(0, split); })[0].slots[Number(key.slice(split + 1))];
				};
				var keys = $wrap.attr('data-slot').split(' ');
				fields.slots = {};
				$.each(keys, function (i, key) {
					var slot = slotOf(key);
					var same = slot.kind === 'number' ? String(value) === String(slot.original) : toID(value) === toID(slot.original);
					fields.slots[key] = value === null || same ? null : value;
				});
				this.$('.dexmonpage [data-slot]').filter(function () { return this.dataset.slot === $wrap.attr('data-slot'); })
					.find('select, input').val($(e.currentTarget).val()).each(function () { fitInline(this); });
				var $pair = $wrap.closest('.dexpair');
				if ($pair.length) {
					var parts = $pair.find('input').map(function () { return Number(this.value); }).get();
					$pair.attr('title', pairMeaning($pair.attr('data-kind'), parts[0], parts[1]));
				}
			} else if ($wrap.attr('data-event')) {
				var path = $wrap.attr('data-event');
				fields.events = {};
				fields.events[path] = value === path.slice(path.lastIndexOf('.') + 1) ? null : value;
			} else {
				var field = $wrap.attr('data-path');
				if (field === 'secondaries') fields = secondaryFields(value, this.dexEffectValues().secondary);
				else setPath(fields, field, value);
			}
			this.saveDexEffect(fields);
			var data = this.dexEffectValues();
			if ($wrap.attr('data-path') === 'type' || $wrap.attr('data-path') === 'category') return this.renderDexEffect();
			if (this.$('.dexmonpage [data-path="' + $wrap.attr('data-path') + '"]').length > 1) return this.renderDexEffect();
			this.$('.dexmonpage .dexmoveicons').html(this.dexEffectIconHTML(data));
			this.$('.dexmonpage .setcol-stats').html(this.dexEffectStatsHTML(data));
			this.$('.dexmonpage .setstats').toggleClass('cur', this.dexEffectPanel === 'fields' && !!this.$('.dexmonpage [data-panel=list]').length);
			this.markDexEdits();
		},
		resizeDexInline: function (e) {
			fitInline(e.currentTarget);
		},
		countDexShortDesc: function (e) {
			this.$('.dexmonpage .dexdesccount').text(e.currentTarget.value.length + '/' + e.currentTarget.maxLength);
		},
		addDexSecondary: function () {
			var $wrap = this.$('.dexmonpage [data-path=secondaries]');
			this.saveDexEffect(secondaryFields(readField($wrap).concat([{ chance: 100 }]), this.dexEffectValues().secondary));
			this.renderDexEffect();
		},
		removeDexSecondary: function (index) {
			var list = readField(this.$('.dexmonpage [data-path=secondaries]'));
			list.splice(Number(index), 1);
			this.saveDexEffect(secondaryFields(list, this.dexEffectValues().secondary));
			this.renderDexEffect();
		},
		focusDexEffectFlags: function () {
			this.showDexEffectPanel('flags', true);
		},
		searchDexEffectFlags: function (e) {
			this.$('.dexmonpage [data-panel=flags]').html(this.dexFlagListHTML(e.currentTarget.value));
			this.markDexEdits();
		},
		toggleDexEffectFlag: function (flag) {
			var flags = this.dexEffectValues().flags || {};
			var change = {};
			change[flag] = flags[flag] ? null : 1;
			this.saveDexEffect({ flags: change });
			var data = this.dexEffectValues();
			var $input = this.$('.dexmonpage input[name=effectflags]');
			var query = $input.val();
			var focused = $input.is(':focus') || this.dexEffectPanel === 'flags';
			this.$('.dexmonpage .dexflagbox').html(this.dexFlagChipsHTML(data));
			this.$('.dexmonpage .dexflaglabel').text('Flags (' + Object.keys(data.flags || {}).filter(function (key) { return data.flags[key]; }).length + ')');
			this.$('.dexmonpage .setcol-stats').html(this.dexEffectStatsHTML(data));
			this.$('.dexmonpage [data-panel=flags]').html(this.dexFlagListHTML(query));
			if (focused) this.$('.dexmonpage input[name=effectflags]').val(query).focus();
			this.markDexEdits();
		},
		deleteDexEffect: function (value, button) {
			var self = this;
			var effect = this.dexEffect;
			var info = this.dexEffectData;
			var message = info.official ? 'Reset ' + escape(info.name) + ' to its base data? Every edit to it in this dex is removed.' :
				'Delete ' + escape(info.name) + ' from this dex?';
			app.addPopup(DexConfirmPopup, {
				message: message,
				button: info.official ? "Reset to base" : "Delete",
				sourceEl: button,
				callback: function () {
					if (self.dexDraft) delete self.dexDraft.effects[effect.table + ':' + effect.id];
					self.applyDexDraft();
					var edit = {};
					edit['delete' + KINDS[effect.table]] = info.name;
					self.editDex(edit);
					if (!info.official) self.closeDexEffect();
				}
			});
		},
		newDexEffect: function (value, button) {
			var count = this.dexSummary.counts[this.dexTab];
			if (count && KINDS[count.table]) app.addPopup(DexNewEffectPopup, { room: this, table: count.table, sourceEl: button });
		},
		copyDexEffect: function (value, button) {
			var effect = this.dexEffect;
			app.addPopup(DexNewEffectPopup, { room: this, table: effect.table, from: effect.id, sourceEl: button });
		}
	};

	_.extend(RoomsRoom.prototype, viewMethods);
	_.each([RoomsRoom, window.DexBuilderRoom], function (Room) {
		_.extend(Room.prototype.events, {
			'focus .dexmonpage input[name=effectsearch]': 'focusDexEffectSearch',
			'input .dexmonpage input[name=effectsearch]': 'searchDexEffects',
			'blur .dexmonpage input[name=effectsearch]': 'blurDexEffectSearch',
			'focus .dexmonpage input[name=monsearch]': 'focusDexMonSearch',
			'input .dexmonpage input[name=monsearch]': 'searchDexMonSearch',
			'blur .dexmonpage input[name=monsearch]': 'blurDexMonSearch',
			'focus .dexmonpage input[name=movesearch]': 'focusDexMoveSearch',
			'input .dexmonpage input[name=movesearch]': 'searchDexMoveSearch',
			'focus .dexmonpage input[name=learnersearch]': 'focusDexLearnerSearch',
			'input .dexmonpage input[name=learnersearch]': 'searchDexLearners'
		});
	});
	_.extend(window.DexBuilderRoom.prototype, builderMethods);
	_.defaults(window.DexBuilderRoom.prototype, viewMethods);
	_.extend(window.DexBuilderRoom.prototype.events, {
		'change .dexmonpage .dexeffectfield input': 'changeDexEffectField',
		'change .dexmonpage .dexeffectfield select': 'changeDexEffectField',
		'change .dexmonpage .dexeffectfield textarea': 'changeDexEffectField',
		'focus .dexmonpage input[name=effectflags]': 'focusDexEffectFlags',
		'input .dexmonpage input[name=effectflags]': 'searchDexEffectFlags',
		'input .dexmonpage input.dexinline': 'resizeDexInline',
		'input .dexmonpage .dexshortdesc input': 'countDexShortDesc'
	});

})(window.jQuery);
