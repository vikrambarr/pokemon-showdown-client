(function ($) {

	var DexViews = window.DexViews;
	var request = DexViews.ui.request;
	var DexConfirmPopup = DexViews.ui.DexConfirmPopup;
	var viewSearch = DexViews.ui.viewSearch;
	var mergeEffect = DexViews.mergeEffect;
	var escape = BattleLog.escapeHTML;

	var KINDS = DexViews.ui.EFFECT_KINDS;
	var CODE = DexViews.ui.CODE;
	var NAMES = { Moves: 'Move', Abilities: 'Ability', Items: 'Item', Conditions: 'Condition' };
	var ICONS = { Abilities: 'star', Conditions: 'cloud' };
	var CONTROL = ['name', 'inheritsFrom', 'slots', 'events', 'spriteFrom'];
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
			dance: "Copied by Pokemon with the Ability Dancer.",
			defrost: "Thaws the user when it uses this move while frozen.",
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
			powder: "Has no effect on Grass types, Overcoat or Safety Goggles.",
			protect: "Blocked by Detect, Protect, Spiky Shield, and if not a Status move, King's Shield.",
			pulse: "Power is multiplied by 1.5 when used by a Pokemon with the Ability Mega Launcher.",
			punch: "Power is multiplied by 1.2 when used by a Pokemon with the Ability Iron Fist.",
			recharge: "If successful, the user must recharge on the next turn.",
			reflectable: "Bounced back to the original user by Magic Coat or the Ability Magic Bounce.",
			slicing: "Power is multiplied by 1.5 when used by a Pokemon with the Ability Sharpness.",
			snatch: "Can be stolen by Snatch.",
			sound: "Has no effect on Pokemon with the Ability Soundproof.",
			wind: "Activates the Wind Power and Wind Rider Abilities."
		},
		Abilities: {
			breakable: "Can be suppressed by Mold Breaker and related effects.",
			cantsuppress: "Ability can't be suppressed by e.g. Gastro Acid or Neutralizing Gas.",
			failroleplay: "Role Play fails if target has this Ability.",
			failskillswap: "Skill Swap fails if either the user or target has this Ability.",
			noentrain: "Entrainment fails if user has this Ability.",
			noreceiver: "Receiver and Power of Alchemy can't copy this Ability.",
			notrace: "Trace cannot copy this Ability.",
			notransform: "Disables the Ability if the user is Transformed."
		}
	};
	var PROPERTIES = {
		Moves: {
			breaksProtect: "Breaks protection.",
			ignoreAbility: "Ignores the target's Ability.",
			ignoreDefensive: "Ignores the target's defense boosts.",
			ignoreEvasion: "Ignores the target's evasion boosts.",
			infiltrates: "Goes through screens and Substitute.",
			sleepUsable: "Can be used while asleep.",
			stealsBoosts: "Steals the target's stat boosts.",
			thawsTarget: "Thaws a frozen target.",
			tracksTarget: "Ignores redirection like Follow Me."
		},
		Abilities: {
			suppressWeather: "Turns off the weather's effects while it's out."
		},
		Items: {
			ignoreKlutz: "Still works when the holder has Klutz."
		},
		Conditions: {
			affectsFainted: "Keeps working on fainted Pokémon.",
			noCopy: "Baton Pass doesn't pass it on."
		}
	};
	var MOVE_NUMBERS = [
		['basePower', "Power", 'int', [0, 1000, 5], 'BP'], ['accuracy', "Accuracy", 'accuracy', null, '%'],
		['pp', "PP", 'pp'], ['priority', "Priority", 'priority']
	];
	var DAMAGE_STATS = 'overrideOffensivePokemon overrideOffensiveStat overrideDefensivePokemon overrideDefensiveStat';
	var flagSentence = function (path, text) {
		return [path, text, function (field) { return '<label class="checkbox">' + field(path, 'bool') + ' ' + text + '</label>'; }, true];
	};
	var SENTENCES = {
		Moves: [
			["Animation", [
				['animations', "Plays ___ then ___", function (field, data, room) { return 'Plays ' + field('animations', 'animations', defaultAnimations(room.dexEffect.id)); }]
			]],
			["Damage", [
				[DAMAGE_STATS, "Attacks with ___ ___ against ___ ___", function (field, data, room) { return room.dexDamageStatsHTML(data); }],
				['ignoreImmunity', "This move ___ type immunities", function (field, data) {
					return field('ignoreImmunity', 'immunity', data.category === 'Status');
				}],
				['damage', "Deals ___ damage", function (field) { return 'Deals ' + field('damage', 'fixeddamage') + ' damage'; }],
				['ohko', "Knocks out the target in one hit, but ___ types are immune", function (field) {
					return 'Knocks out the target in one hit, but ' + field('ohko', 'ohkotype') + ' types are immune';
				}]
			]],
			["Hits", [
				['multihit multiaccuracy', "Hits ___ to ___ times, checking accuracy ___", function (field) {
					return 'Hits ' + field('multihit', 'range') + ' times, checking accuracy ' + field('multiaccuracy', 'flag', ["once", "before every hit"]);
				}],
				['critRatio willCrit', "Its critical hit ratio is ___", function (field) {
					return 'Its critical hit ratio is ' + field('critRatio willCrit', 'crit');
				}]
			]],
			["Target", [
				['status', "Inflicts ___ on the target", function (field) { return 'Inflicts ' + field('status', 'select', 'status') + ' on the target'; }],
				['volatileStatus', "Gives the target ___", function (field) {
					return 'Gives the target ' + field('volatileStatus', 'select', 'condition:volatileStatus');
				}],
				['boosts', "Changes the target's ___", function (field) { return 'Changes the target\'s ' + field('boosts', 'boostlist'); }],
				flagSentence('forceSwitch', "Forces the target to switch out")
			]],
			["User", [
				['self.boosts', "Changes the user's ___ after each hit", function (field) {
					return 'Changes the user\'s ' + field('self.boosts', 'boostlist') + ' after each hit';
				}],
				['selfBoost.boosts', "Changes the user's ___ once after the move", function (field) {
					return 'Changes the user\'s ' + field('selfBoost.boosts', 'boostlist') + ' once after the move';
				}],
				['self.volatileStatus', "Gives the user ___", function (field) {
					return 'Gives the user ' + field('self.volatileStatus', 'select', 'condition:volatileStatus');
				}],
				['drain', "Heals the user by ___/___ of the damage dealt", function (field) {
					return 'Heals the user by ' + field('drain', 'fraction') + ' of the damage dealt';
				}],
				['recoil', "Hurts the user by ___/___ of the damage dealt", function (field) {
					return 'Hurts the user by ' + field('recoil', 'fraction') + ' of the damage dealt';
				}],
				flagSentence('hasCrashDamage', "Gets the power boost from Reckless"),
				['heal', "Heals the user by ___/___ of its max HP", function (field) { return 'Heals the user by ' + field('heal', 'fraction') + ' of its max HP'; }],
				['selfSwitch', "The user switches out ___", function (field) {
					return 'The user switches out ' + field('selfSwitch', 'select', [['true', "normally"], ['copyvolatile', "passing on its stat changes"], ['shedtail', "leaving a substitute"]]);
				}],
				['selfdestruct', "The user faints ___", function (field) {
					return 'The user faints ' + field('selfdestruct', 'select', [['always', "always"], ['ifHit', "if it hits"]]);
				}]
			]],
			["Chance", [
				['secondaries', "Has a ___% chance to inflict ___, give the target ___, or change stats", function (field) { return field('secondaries', 'secondaries'); }],
				flagSentence('hasSheerForceBoost', "Gets the power boost from Sheer Force")
			]],
			["Field", [
				['weather', "Sets the weather to ___", function (field) { return 'Sets the weather to ' + field('weather', 'select', 'condition:weather'); }],
				['terrain', "Sets the terrain to ___", function (field) { return 'Sets the terrain to ' + field('terrain', 'select', 'condition:terrain'); }],
				['pseudoWeather', "Starts ___ on the field", function (field) {
					return 'Starts ' + field('pseudoWeather', 'select', 'condition:pseudoWeather') + ' on the field';
				}],
				['sideCondition', "Sets ___ on a side", function (field) { return 'Sets ' + field('sideCondition', 'select', 'condition:sideCondition') + ' on a side'; }],
				['slotCondition', "Sets ___ on a slot", function (field) { return 'Sets ' + field('slotCondition', 'select', 'condition:slotCondition') + ' on a slot'; }]
			]]
		],
		Abilities: [],
		Items: [
			["Fling", [
				['fling.basePower fling.status fling.volatileStatus', "When flung, has ___ power, inflicts ___ and gives the target ___", function (field) {
					return 'When flung, has ' + field('fling.basePower', 'int', [0, 250]) + ' power, inflicts ' + field('fling.status', 'select', 'status') +
						' and gives the target ' + field('fling.volatileStatus', 'select', 'condition:volatileStatus');
				}]
			]],
			["Natural Gift", [
				['naturalGift.type naturalGift.basePower', "Makes Natural Gift ___-type with ___ power", function (field) {
					return 'Makes Natural Gift ' + field('naturalGift.type', 'select', 'type') + '-type with ' + field('naturalGift.basePower', 'int', [0, 250]) + ' power';
				}]
			]],
			["Held", [
				['boosts', "Changes the holder's ___", function (field) { return 'Changes the holder\'s ' + field('boosts', 'boostlist'); }]
			]],
			["Icon", [
				['spriteFrom', "Uses the icon of ___", function (field) { return 'Uses the icon of ' + field('spriteFrom', 'select', 'ref:Items'); }],
				['spritenum', "Uses icon number ___", function (field) { return 'Uses icon number ' + field('spritenum', 'int', [0, 761]); }]
			]]
		],
		Conditions: []
	};
	var TITLES = {
		countsAs: "Counts as", ignoreImmunity: "Type immunities",
		damage: "Fixed damage", ohko: "One-hit KO", 'multihit multiaccuracy': "Hits", 'critRatio willCrit': "Critical hits",
		status: "Status", volatileStatus: "Target's volatile status", 'Moves:boosts': "Target's stat changes", forceSwitch: "Forced switch",
		'self.boosts': "User's stat changes", 'selfBoost.boosts': "User's stat changes", 'self.volatileStatus': "User's volatile status",
		drain: "Drain", recoil: "Recoil", hasCrashDamage: "Reckless", heal: "Healing", selfSwitch: "Switching out", selfdestruct: "Fainting",
		secondaries: "Secondary effect", hasSheerForceBoost: "Sheer Force", weather: "Weather", terrain: "Terrain",
		pseudoWeather: "Field condition", sideCondition: "Side condition", slotCondition: "Slot condition", animations: "Animation",
		'fling.basePower fling.status fling.volatileStatus': "Fling", 'naturalGift.type naturalGift.basePower': "Natural Gift",
		'Items:boosts': "Holder's stat changes", spriteFrom: "Icon", spritenum: "Icon number"
	};
	TITLES[DAMAGE_STATS] = "Damage";
	var ALWAYS_SHOWN = ['countsAs'];
	var CRIT_CHOICES = [['1', "normal"], ['2', "high"], ['3', "very high"], ['4', "maximum"], ['always', "100% (always crits)"]];
	var BOOST_CHOICES = [6, 5, 4, 3, 2, 1, 0, -1, -2, -3, -4, -5, -6].map(function (amount) { return [amount, amount ? priorityText(amount) : '']; });
	var GETTERS = DexViews.ui.GETTERS;
	var CARET = '<svg class="dextypecaret" width="10" height="7" viewBox="0 0 14 9"><path d="M1 1H13L7 8Z" fill="#fff" stroke="#000" stroke-width="1.5" stroke-linejoin="round" /></svg>';

	function getPath(object, path) {
		if (path.indexOf(' ') >= 0) {
			return path.split(' ').every(function (each) { return getPath(object, each); }) || undefined;
		}
		var keys = path.split('.');
		for (var i = 0; i < keys.length && object; i++) object = object[keys[i]];
		return object;
	}

	function flagPath(table, flag) {
		return PROPERTIES[table] && PROPERTIES[table][flag] ? flag : 'flags.' + flag;
	}

	function setFlags(table, data) {
		return Object.keys($.extend({}, data.flags, PROPERTIES[table])).filter(function (flag) {
			return getPath(data, flagPath(table, flag));
		}).sort(function (a, b) { return toID(a).localeCompare(toID(b)); });
	}

	function setPath(object, path, value) {
		if (path.indexOf(' ') >= 0) {
			path.split(' ').forEach(function (each) { setPath(object, each, value); });
			return object;
		}
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
		if (options === 'stat') return STATS.slice(1, 6);
		if (options === 'flag') return Object.keys(FLAGS.Moves).concat(Object.keys(FLAGS.Abilities)).sort();
		if (options.slice(0, 4) === 'ref:') return refOptions(options.slice(4).split(','), 'id', view);
		if (options.slice(0, 5) === 'name:') return refOptions(options.slice(5).split(','), 'name', view);
		if (options.slice(0, 10) === 'condition:') {
			var choices = entries && entries.choices;
			if (!choices) return null;
			var used = choices[options.slice(10)] || [];
			var label = function (id) { return [id, escape(choices.names[id] || id)]; };
			var field = ['weather', 'terrain', 'pseudoWeather', 'sideCondition', 'slotCondition'].indexOf(options.slice(10)) >= 0;
			var rest = field ? [] : choices.all;
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

	function sentenceText(control, value, options) {
		if (control === 'flag') return value ? options[1] : options[0];
		var choice = control === 'select' && Array.isArray(options) && options.filter(function (option) { return String(option[0]) === String(value); })[0];
		if (choice) return choice[1];
		if (control === 'select' && blank(value)) return "nothing";
		return valueText(control, value, options);
	}

	function secondarySentence(secondary) {
		var parts = [];
		if (secondary.status) parts.push('inflict ' + summaryName(secondary.status) + ' on the target');
		if (secondary.volatileStatus) parts.push('give the target ' + summaryName(secondary.volatileStatus));
		if (secondary.boosts) parts.push('change the target\'s ' + boostsText(secondary.boosts));
		if (secondary.self && secondary.self.boosts) parts.push('change the user\'s ' + boostsText(secondary.self.boosts));
		return escape('Has a ' + (secondary.chance || 100) + '% chance to ' + (parts.join(' and ') || 'run its code'));
	}

	function priorityText(priority) {
		return (priority > 0 ? '+' : priority < 0 ? '\u2212' : '\u2007\u2009') + Math.abs(priority);
	}

	function summaryName(value) {
		var status = STATUSES.filter(function (entry) { return entry[0] === value; })[0];
		if (status) return status[1];
		var id = toID(value);
		return entries && entries.choices && entries.choices.names[id] || BattleMovedex[id] && BattleMovedex[id].name || String(value);
	}

	function secondaryList(data) {
		return data.secondaries || (data.secondary ? [data.secondary] : []);
	}

	function attributeSummary(entry, data) {
		if (entry[0] === 'secondaries') return secondaryList(data).map(secondaryText).join('; ');
		if (entry[0] === 'critRatio willCrit') return data.willCrit ? "Always" : "Stage " + (data.critRatio || 1);
		if (entry[0] === 'animations') return (data.animations || []).map(summaryName).join(", ");
		if (entry[0] === 'ignoreImmunity') {
			var ignored = data.ignoreImmunity;
			return ignored === true ? "Ignored" : ignored ? "Ignored for " + Object.keys(ignored).filter(function (type) { return ignored[type]; }).join(", ") : "Respected";
		}
		if (entry[0] === DAMAGE_STATS) {
			var special = data.category === 'Special';
			var uses = data.overrideOffensivePokemon === 'target' || data.overrideOffensiveStat ?
				"Uses " + (data.overrideOffensivePokemon === 'target' ? "target's " : "") + BOOSTS[data.overrideOffensiveStat || (special ? 'spa' : 'atk')] : '';
			var hits = data.overrideDefensivePokemon === 'source' || data.overrideDefensiveStat ?
				"hits " + (data.overrideDefensivePokemon === 'source' ? "user's " : "") + BOOSTS[data.overrideDefensiveStat || (special ? 'spd' : 'def')] : '';
			return uses && hits ? uses + ", " + hits : uses || hits.charAt(0).toUpperCase() + hits.slice(1);
		}
		var parts = [];
		$.each(entry[0].split(' '), function (i, path) {
			var value = getPath(data, path);
			var text = blank(value) || value === false ? '' : value === true ? (path === 'multiaccuracy' ? "each hit" : "Yes") :
				Array.isArray(value) ? value.join(path === 'multihit' ? '\u2013' : '/') : typeof value === 'object' ? boostsText(value) :
				typeof value === 'number' ? String(value) : summaryName(value);
			if (text && parts.indexOf(text) < 0) parts.push(text);
		});
		return parts.join(', ');
	}

	function animationOptions() {
		return Object.keys(BattleMovedex).filter(function (id) {
			return BattleMovedex[id].num > 0 && !DexViews.custom.Moves[id];
		}).map(function (id) {
			return [id, escape(BattleMovedex[id].name)];
		}).sort(function (a, b) {
			return a[1] < b[1] ? -1 : 1;
		});
	}

	function defaultAnimations(id) {
		var anims = window.BattleMoveAnims;
		if (!anims || !anims[id]) return ['tackle'];
		var match = /^function\s*\w*\(scene,(\w+)\)\{var attacker=\1\[0\],defender=\1\[1\];((?:\s*BattleMoveAnims\['\w+'\]\.anim\(scene,\[attacker,defender\]\);)+)\s*\}$/.exec(String(anims[id].anim));
		if (match) return match[2].match(/'\w+'/g).map(function (quoted) { return quoted.slice(1, -1); }).slice(0, 2);
		for (var generic in BattleOtherAnims) {
			if (BattleOtherAnims[generic].anim === anims[id].anim) return [id];
		}
		for (var other in anims) {
			if (anims[other].anim === anims[id].anim) return [other];
		}
	}

	function valueText(control, value, options) {
		if (control === 'animations') value = value || options;
		if (control === 'immunity') {
			var ignores = blank(value) ? options : value;
			if (!ignores) return "Respects type immunities";
			return "Ignores type immunities" + (ignores === true ? '' : " when its type is " + escape(Object.keys(ignores).filter(function (type) { return ignores[type]; }).join(" or ")));
		}
		if (control === 'secondaries') {
			return (value || []).map(function (secondary) { return escape(secondaryText(secondary)); }).join('<br />') || '&mdash;';
		}
		if (blank(value)) return '&mdash;';
		if (control === 'accuracy' && value === true) return '&mdash;';
		if (control === 'priority') return priorityText(value);
		if (control === 'boostlist') return escape(boostsText(value)) || '&mdash;';
		if (control === 'crit') return value[1] ? CRIT_CHOICES[4][1] : (CRIT_CHOICES.filter(function (choice) { return choice[0] === String(value[0] || 1); })[0] || [0, value[0]])[1];
		if (control === 'flag') return value ? options[1] : options[0];
		if (control === 'fixeddamage' && value === 'level') return "the user's level in";
		if (control === 'ohkotype' && value === true) return "no";
		if (control === 'fraction' && Array.isArray(value)) return value.join('/');
		if (control === 'range' && Array.isArray(value)) return value.join('&ndash;');
		if (control === 'animations' && Array.isArray(value)) {
			return value.map(function (id) { return escape(BattleMovedex[id] ? BattleMovedex[id].name : id); }).join(', then ');
		}
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
		case 'shortdescbox':
			return '<textarea class="textbox' + cls + '" maxlength="' + options + '" rows="3">' + escape(blank(value) ? '' : String(value)) + '</textarea>';
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
		case 'boostlist':
			var used = Object.keys(value || {}).filter(function (stat) { return value[stat]; });
			var statChoices = function (keep) {
				return Object.keys(BOOSTS).filter(function (stat) { return stat === keep || used.indexOf(stat) < 0; }).map(function (stat) { return [stat, BOOSTS[stat]]; });
			};
			var pairs = used.map(function (stat) {
				return '<span class="dexboostpair"><select class="button dexbooststat">' + optionsHTML(statChoices(stat), stat) + '</select> by ' +
					'<select class="button dexboostcell' + (value[stat] > 0 ? ' dexboostup' : ' dexboostdown') + '" data-stat="' + stat + '">' + optionsHTML(BOOST_CHOICES, value[stat]) + '</select></span>';
			}).join(', ');
			var rest = statChoices();
			return pairs + (rest.length ? (pairs ? ' ' : '') + '<select class="button dexboostadd">' + optionsHTML(rest, '', '+ stat') + '</select>' : '');
		case 'fixeddamage':
			return '<select class="button">' + optionsHTML([['amount', "a set amount of"], ['level', "the user's level in"]], value === 'level' ? 'level' : 'amount') + '</select>' +
				(value === 'level' ? '' : ' ' + number(value, [1, 1000]));
		case 'ohkotype':
			return '<select class="button">' + optionsHTML([['true', "no"]].concat(selectOptions('type', view)), value === true ? 'true' : value) + '</select>';
		case 'crit':
			var crit = Array.isArray(value) ? value : [];
			return '<select class="button">' + optionsHTML(CRIT_CHOICES, crit[1] ? 'always' : String(crit[0] || 1)) + '</select>';
		case 'flag':
			return '<select class="button">' + optionsHTML([['', options[0]], ['true', options[1]]], value ? 'true' : '') + '</select>';
		case 'bool':
			return '<input type="checkbox"' + (value ? ' checked' : '') + ' />';
		case 'immunity':
			var ignored = blank(value) ? options : value;
			var only = $.isPlainObject(ignored) ? Object.keys(ignored).filter(function (type) { return ignored[type]; })[0] : '';
			return 'This move <select class="button' + cls + '" data-default="' + options + '">' +
				optionsHTML([['false', "respects"], ['true', "ignores"]], ignored ? 'true' : 'false') + '</select> type immunities' +
				(ignored ? ' when its type is <select class="button">' + optionsHTML(selectOptions('type', view), only, "any type") + '</select>' : '');
		case 'pick':
			return '<select class="button' + cls + '" data-default="' + options[1] + '">' + optionsHTML(options[0], blank(value) ? options[1] : value) + '</select>';
		case 'animations':
			var moves = animationOptions();
			var animations = Array.isArray(value) ? value : options;
			return '<select class="button' + cls + '" data-default="' + options.join(' ') + '">' + optionsHTML(moves, animations[0], '&mdash;') + '</select> then ' +
				'<select class="button' + cls + '">' + optionsHTML(moves, animations[1], '&mdash;') + '</select>';
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
		case 'boostlist':
			var boosts = {};
			$wrap.find('.dexboostpair').each(function () {
				var amount = Number($(this).find('.dexboostcell').val());
				if (amount) boosts[$(this).find('.dexbooststat').val()] = amount;
			});
			var extra = $wrap.find('.dexboostadd').val();
			if (extra) boosts[extra] = boosts[extra] || 1;
			return $.isEmptyObject(boosts) ? null : boosts;
		case 'fixeddamage':
			return inputs.eq(0).val() === 'level' ? 'level' : inputs.length > 1 ? readNumber(inputs[1]) : null;
		case 'ohkotype':
			return inputs.val() === 'true' ? true : inputs.val();
		case 'crit':
			var chosen = inputs.val();
			return chosen === 'always' ? { critRatio: null, willCrit: true } : { critRatio: chosen === '1' ? null : Number(chosen), willCrit: null };
		case 'flag':
			return inputs.val() === 'true' ? true : null;
		case 'bool':
			return inputs[0].checked;
		case 'immunity':
			var type = inputs.eq(1).val();
			var immunity = inputs.eq(0).val() === 'false' ? false : type ? {} : true;
			if (type && immunity) immunity[type] = true;
			return String(immunity) === inputs.eq(0).attr('data-default') ? null : immunity;
		case 'pick':
			return inputs.val() === inputs.attr('data-default') ? null : inputs.val();
		case 'animations':
			var chosen = inputs.map(function () { return this.value; }).get().filter(Boolean);
			return chosen.length && chosen.join(' ') !== inputs.first().attr('data-default') ? chosen : null;
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

	_.extend(window.DexBuilderRoom.prototype, {
		openDexEffect: function (table, id, from, keep) {
			var view = DexViews.current = this.dexView;
			id = toID(id);
			var getter = GETTERS[table];
			var entries = DexViews.entries[this.dexid];
			if (!entries) DexViews.loadEntries(this.dexid);
			var name = getter ? view.dex[getter].get(id).name : entries && entries.names && entries.names[id];
			if (this.$('.dexpage').is(':visible')) this.dexScrollTop = this.dexScroller().scrollTop();
			var shown = !!this.dexEffectData && this.$('.dexmonpage').is(':visible');
			keep = keep && this.dexEffect && this.dexEffect.table === table && this.dexEffect.id === id;
			var effect = this.dexEffect = { table: table, id: id, name: name || id, from: keep ? this.dexEffect.from : from || '' };
			if (this.dexCodeFor !== table + ':' + id) {
				this.dexCodeFor = table + ':' + id;
				this.dexCodePending = {};
			}
			this.dexSpecies = null;
			this.$('.dexsearchpage, .dexpage').hide();
			this.$('.dexmonpage').show();
			if (keep && this.dexEffectData) {
				this.renderDexEffect();
			} else {
				this.dexEffectData = null;
				this.dexAddedAttributes = {};
				this.dexPickedAttributes = [];
				this.dexPanel = table === 'Moves' || table === 'Abilities' ? 'list' : 'fields';
				if (!shown) this.showDexEffectLoading("Loading...");
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
				if (room.dexEffect === effect) room.showDexEffectLoading(err.message);
			});
		},
		showDexEffectLoading: function (message) {
			this.dexScroller().scrollTop(0);
			this.$('.dexmonpage').html('<div class="teamwrapper"><div class="pad">' + this.dexEffectBackHTML() + '</div>' +
				'<div class="pad"><p><em>' + escape(message) + '</em></p></div></div>');
		},
		dexEffectBackHTML: function () {
			var effect = this.dexEffect;
			return '<button name="closeDexEffect" class="button"><i class="fa fa-chevron-left"></i> ' +
				escape(effect.from || this.dexSummary.counts.filter(function (count) { return count.table === effect.table; }).map(function (count) {
					return BattleLog.unescapeHTML(count.name);
				})[0] || 'Dex') + '</button>';
		},
		dexEffectValues: function () {
			var draft = $.extend({}, this.dexEffectDraft());
			for (var i = 0; i < CONTROL.length; i++) delete draft[CONTROL[i]];
			var data = mergeEffect($.extend(true, {}, this.dexEffectData.data), draft);
			return data;
		},
		dexEffectCanEdit: function (path) {
			var top = path.split(/[. ]/)[0];
			var editable = this.dexEffectData.editable;
			if (!this.dexEditable || editable && editable.indexOf(top) < 0 && top !== 'spriteFrom') return false;
			return top.slice(0, 9) !== 'secondary' || !this.dexEffectData.handlers.some(function (handler) {
				return handler.path.slice(0, 9) === 'secondary';
			});
		},
		dexEffectFieldHTML: function (path, control, options, data, className) {
			var value = control === 'secondaries' ? [secondaryList(data)[options]] :
				path.indexOf(' ') >= 0 && control !== 'bool' ? path.split(' ').map(function (each) { return getPath(data, each); }) : getPath(data, path);
			if (!this.dexEffectCanEdit(path) && !className) {
				if (control === 'bool') return '<input type="checkbox" disabled' + (value ? ' checked' : '') + ' data-edit="' + escape(path) + '" />';
				return '<span class="dexvalue" data-edit="' + escape(path) + '">' + (control === 'secondaries' ? secondarySentence(value[0] || {}) : sentenceText(control, value, options)) + '</span>';
			}
			if (!this.dexEffectCanEdit(path)) {
				return '<div class="textbox dexfield' + (className ? ' ' + className : '') + '" data-edit="' + escape(path) + '">' + valueText(control, value, options) + '</div>';
			}
			if (control === 'secondaries') {
				var view = this.dexView;
				var sub = function (field, subControl, subOptions) {
					return wrap('data-sub', field, subControl, controlHTML(subControl, getPath(value[0], field), subOptions, view));
				};
				return wrap('data-path', path, control, '<div class="dexsecondary"><div>Has a ' + sub('chance', 'int', [1, 100]) + '% chance to</div>' +
					'<div>inflict ' + sub('status', 'select', 'status') + ' on the target</div>' +
					'<div>give the target ' + sub('volatileStatus', 'select', 'condition:volatileStatus') + '</div>' +
					'<div>change the target\'s ' + sub('boosts', 'boostlist') + '</div>' +
					'<div>change the user\'s ' + sub('self.boosts', 'boostlist') + '</div></div>', 'div');
			}
			return wrap('data-path', path, control, controlHTML(control, value, options, this.dexView, className));
		},
		renderDexEffect: function () {
			var effect = this.dexEffect;
			var info = this.dexEffectData;
			var table = effect.table;
			DexViews.current = this.dexView;
			var data = this.dexEffectValues();
			entries = DexViews.entries[this.dexid] || null;
			var scrolls = {};
			this.$('.dexmonpage [data-panel]').each(function () { scrolls[this.dataset.panel] = this.scrollTop; });
			var focused = this.$('.dexmonpage input:focus');
			var focusKey = focused.length && (focused.attr('name') || focused.closest('[data-path]').attr('data-path'));

			var buf = '<div class="pad">' + this.dexEffectBackHTML() + '</div>';
			var start = table === 'Moves' || table === 'Abilities' ? 'list' : 'fields';
			buf += '<div class="teambar"><button name="showDexEffectPanel" value="' + start + '" class="pokemon"><i class="fa fa-pencil"></i> Editor</button>';
			buf += ' <button name="showDexEffectPanel" value="code" class="pokemon"><i class="fa fa-code"></i> Code</button>';
			buf += '</div>';
			buf += '<div class="teamchartbox individual"><ol class="teamchart"><li>';
			buf += this.dexMenuHTML('copyDexEffect', info.edited && ['deleteDexEffect', info.official ? 'Reset to base' : 'Delete']);
			buf += '<div class="setchart dexmonchart dexeffectchart">';

			buf += '<div class="setcol setcol-icon"><div class="setcell-sprite dexmoveicons">' + this.dexEffectIconHTML(data) + '</div>';
			buf += '<div class="setcell setcell-pokemon"><label>' + NAMES[table] + '</label><input type="text" class="textbox dexfield" name="namesearch" value="' + escape(info.name) + '" autocomplete="off" /></div></div>';

			buf += '<div class="setcol setcol-details">';
			var limit = table === 'Moves' ? 55 : 90;
			var count = this.dexEffectCanEdit('shortDesc') ? ' (<span class="dexdesccount">' + (data.shortDesc || '').length + '/' + limit + '</span>)' : '';
			var desc = table === 'Moves' ? ['shortdesc', 'dexfield'] : ['shortdescbox', 'dexfield dexdescbox'];
			if (table !== 'Conditions') {
				buf += '<div class="setrow"><div class="setcell dexshortdesc"><label>Short description' + count + '</label>' + this.dexEffectFieldHTML('shortDesc', desc[0], limit, data, desc[1]) + '</div></div>';
			}
			if (table === 'Moves') {
				buf += '<div class="setrow dexmovenumbers">';
				for (var n = 0; n < MOVE_NUMBERS.length; n++) {
					buf += '<div class="setcell' + (MOVE_NUMBERS[n][4] ? ' dexunitcell' : '') + '"><label>' + MOVE_NUMBERS[n][1] + '</label>' + this.dexEffectFieldHTML(MOVE_NUMBERS[n][0], MOVE_NUMBERS[n][2], MOVE_NUMBERS[n][3], data, 'dexfield') +
						(MOVE_NUMBERS[n][4] ? '<span class="dexunit">' + MOVE_NUMBERS[n][4] + '</span>' : '') + '</div>';
				}
				buf += '</div>';
			}
			buf += '<div class="setrow setrow-abilities">';
			if (FLAGS[table] || PROPERTIES[table]) buf += '<div class="setcell"><label class="dexflaglabel">Flags (' + setFlags(table, data).length + ')</label><div class="textbox dexchipbox dexflagbox">' + this.dexFlagChipsHTML(data) + '</div></div>';
			buf += '</div></div>';

			buf += '<div class="setcol setcol-moves">';
			var cells = {
				Moves: [['Target', 'target', 'select', MOVE_TARGETS], ['Learned by']],
				Abilities: [['Pokémon']],
				Items: [],
				Conditions: [['Duration', 'duration', 'int', [1, 100]], ['Counter max', 'counterMax', 'int', [1, 10000]]]
			}[table];
			for (var c = 0; c < cells.length; c++) {
				buf += '<div class="setcell' + (cells[c][1] ? '' : ' setcell-learnset') + '"><label' + (cells[c][1] ? '' : ' class="dexlearnsetlabel" data-name="' + cells[c][0] + '"') + '>' + cells[c][0] + '</label>';
				buf += cells[c][1] ? this.dexEffectFieldHTML(cells[c][1], cells[c][2], cells[c][3], data, 'dexfield') :
					'<input type="text" class="textbox dexfield learnsetcount" name="listsearch" placeholder="Pok&eacute;mon" autocomplete="off" />';
				buf += '</div>';
			}
			buf += '</div>';

			buf += '<div class="setcol setcol-stats">' + this.dexEffectStatsHTML(data) + '</div>';
			buf += '</div></li></ol></div>';
			if (table === 'Moves' || table === 'Abilities') buf += '<div class="teambuilder-results" data-panel="list"></div>';
			buf += '<div class="teambuilder-results" data-panel="picker"></div>';
			if (FLAGS[table] || PROPERTIES[table]) buf += '<div class="dexstatresults dexeffectpanel" data-panel="flags"></div>';
			buf += '<div class="dexstatresults dexeffectpanel" data-panel="fields">' + this.dexEffectFieldsHTML(data) + '</div>';
			buf += this.dexAttributePanelHTML();
			if (table !== 'Conditions') {
				buf += '<div class="dexstatresults dexeffectpanel" data-panel="description"><div class="pad dexfieldsection dexeffectfields">' +
					'<label class="label">Description</label>' + this.dexEffectFieldHTML('desc', 'textarea', null, data) + '</div></div>';
			}
			buf += '<div class="dexstatresults dexeffectpanel dexcode" data-panel="code">' + this.dexEffectCodeHTML() + '</div>';
			this.$('.dexmonpage').html('<div class="teamwrapper">' + buf + '</div>');
			this.dexPicker = null;
			this.$('.dexmonpage pre select.dexinline').each(function () { fitInline(this); });

			if (table === 'Moves' || table === 'Abilities') this.setupDexEffectList();
			this.showDexEffectPanel(this.dexPanel, true);
			this.$('.dexmonpage [data-panel]').each(function () {
				if (scrolls[this.dataset.panel]) this.scrollTop = scrolls[this.dataset.panel];
			});
			if (focusKey) {
				var $focus = this.$('.dexmonpage input[name="' + focusKey + '"]');
				if (!$focus.length) $focus = this.$('.dexmonpage [data-path="' + focusKey + '"] input').first();
				$focus.focus();
			}
			this.scaleDex();
			this.markDexEdits();
		},
		markDexEffectEdits: function () {
			var info = this.dexEffectData;
			var original = info && info.original;
			var $page = this.$('.dexmonpage');
			$page.find('button[name=toggleDexEdits]').toggle(!!original);
			if (!original) return;
			this.markDexCodeEdits(this.dexEffectCodeValues(), original);
			var self = this;
			var data = this.dexEffectValues();
			var valueOf = function (object, path) {
				if (path === 'secondaries') return secondaryList(object);
				if (path === 'countsAs') return !!object.countsAs;
				if (path.indexOf(' ') >= 0) return path.split(' ').map(function (each) { return getPath(object, each); });
				return getPath(object, path);
			};
			var mark = function ($field, now, was) {
				if (!DexViews.ui.changedValue(now, was)) return;
				$field.addClass('dexedited');
				$field.filter('[data-control=boostlist]').find('select[data-stat]').each(function () {
					if ((now || {})[this.dataset.stat] !== (was || {})[this.dataset.stat]) $(this).addClass('dexedited');
				});
			};
			$page.find('[data-path], [data-edit]').each(function () {
				var path = this.getAttribute('data-path') || this.getAttribute('data-edit');
				if (path === 'secondaries') return;
				mark($(this), valueOf(data, path), valueOf(original, path));
			});
			var secondaries = [valueOf(data, 'secondaries'), valueOf(original, 'secondaries')];
			$page.find('.dexsecondary').each(function (i) {
				mark($(this).closest('[data-path]'), secondaries[0][i], secondaries[1][i]);
				$(this).find('[data-sub]').each(function () {
					mark($(this), getPath(secondaries[0][i] || {}, this.dataset.sub), getPath(secondaries[1][i] || {}, this.dataset.sub));
				});
			});
			var table = this.dexEffect.table;
			if (setFlags(table, original).some(function (flag) { return !getPath(data, flagPath(table, flag)); })) $page.find('.dexflagbox').addClass('dexedited');
			var slots = {};
			$.each(info.handlers, function (i, handler) {
				$.each(handler.slots, function (j, slot) { slots[handler.path + ':' + slot.index] = slot; });
			});
			var inMain = {};
			$page.find('.setchart [data-path], .setchart [data-edit]').each(function () {
				inMain[this.getAttribute('data-path') || this.getAttribute('data-edit')] = true;
			});
			if ($page.find('[data-panel=fields] .dexedited').filter(function () {
				return !inMain[this.getAttribute('data-path') || this.getAttribute('data-edit')];
			}).length) $page.find('.setstats').addClass('dexedited');
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
			var self = this;
			var table = this.dexEffect.table;
			var flags = setFlags(table, data);
			var editable = Object.keys($.extend({ flags: 1 }, PROPERTIES[table])).some(function (flag) { return self.dexEffectCanEdit(flag); });
			return flags.map(function (flag) {
				return '<span class="dexchip" data-edit="' + escape(flagPath(table, flag)) + '">' + escape(toID(flag)) + (self.dexEffectCanEdit(flagPath(table, flag)) ? ' <button class="dexchipx" name="toggleDexEffectFlag" value="' + escape(flag) + '" tabindex="-1">&times;</button>' : '') + '</span>';
			}).join('') + (editable ? '<input type="text" class="dexchipinput" name="effectflags"' + (flags.length ? '' : ' placeholder="Flags"') + ' autocomplete="off" />' : '');
		},
		dexFlagListHTML: function (query) {
			var self = this;
			var data = this.dexEffectValues();
			var table = this.dexEffect.table;
			var descs = $.extend({}, FLAGS[table], PROPERTIES[table]);
			var set = setFlags(table, data);
			query = toID(query);
			var ids = Object.keys($.extend({}, descs, data.flags)).filter(function (flag) {
				return !query || toID(flag).indexOf(query) >= 0 || toID(descs[flag] || '').indexOf(query) >= 0;
			}).sort(function (a, b) { return toID(a).localeCompare(toID(b)); });
			var shown = ids.filter(function (flag) { return set.indexOf(flag) >= 0; });
			var others = ids.filter(function (flag) { return set.indexOf(flag) < 0 && self.dexEffectCanEdit(flagPath(table, flag)); });
			var row = function (flag) {
				var editable = self.dexEffectCanEdit(flagPath(table, flag));
				return DexViews.ui.chartRowHTML('flag|' + escape(flag), '<span class="col movenamecol">' + escape(toID(flag)) + '</span> <span class="col movedesccol">' + escape(descs[flag] || '') + '</span>',
					' data-edit="' + escape(flagPath(table, flag)) + '"' + (editable && set.indexOf(flag) >= 0 ? ' class="cur"' : ''));
			};
			var groups = [["Flags (" + shown.length + ")", shown.map(row)]];
			if (others.length) groups.push(["Other flags", others.map(row)]);
			return DexViews.ui.chartHTML(groups);
		},
		dexEffectStatsHTML: function (data) {
			var self = this;
			var table = this.dexEffect.table;
			var lines = [];
			$.each(this.dexEffectSections(data), function (i, section) {
				$.each(section[1], function (j, entry) {
					if (ALWAYS_SHOWN.indexOf(entry[0]) >= 0 || entry[0].slice(0, 10) === 'condition.' || !self.dexAttributeShown(entry, data)) return;
					var title = entry[4] || TITLES[table + ':' + entry[0]] || TITLES[entry[0]] || section[0];
					var summaries = entry[0] === 'secondaries' ? secondaryList(data).map(secondaryText) : [attributeSummary(entry, data)];
					$.each(summaries, function (k, text) {
						var summary = escape(text) || '&mdash;';
						lines.push('<span class="dexattrline" data-attr="' + escape(entry[0]) + '" title="' + escape(title) + ': ' + summary + '"><span class="dexattrname">' + title + '</span>' +
							'<span class="dexattrvalue">' + summary + '</span></span>');
					});
				});
			});
			if (lines.length > 3) lines = lines.slice(0, 2).concat(['<span class="dexattrmore">+' + (lines.length - 2) + ' more</span>']);
			if (!lines.length) lines = ['<span class="dexattrmore">None</span>'];
			return '<div class="setrow"><label>Attributes</label><button class="textbox setstats dexmoveattributes" tabindex="-1" name="showDexEffectPanel" value="fields">' +
				'<span class="dexattrlines">' + lines.join('') + '</span></button></div>';
		},
		dexEffectSections: function (data) {
			var table = this.dexEffect.table;
			var sections = SENTENCES[table].slice();
			var info = this.dexEffectData;
			if (info.base && info.base !== info.id) {
				var original = valueText('select', info.base, 'ref:' + table);
				var counts = "Wherever the battle engine or another effect checks for " + original + ", this copy counts too. Both can be active at once.";
				if (!data.countsAs && info.lost && (info.lost.engine.length || info.lost.references.length)) {
					counts += " Without it, this copy misses how the engine treats " + original + " and " + info.lost.references.length + " effects that check for it by name.";
				}
				sections.splice(1, 0, ["Counts as", [['countsAs', "", function (field) {
					return '<label class="checkbox">' + field('countsAs', 'bool') + ' Counts as ' + original + '</label><p><small>' + counts + '</small></p>';
				}]]]);
			}
			if (table === 'Moves' && $.isPlainObject(data.condition)) {
				var leaves = [];
				var collect = function (object, prefix) {
					$.each(object, function (key, value) {
						if ($.isPlainObject(value)) return collect(value, prefix + key + '.');
						if (['number', 'boolean', 'string'].indexOf(typeof value) < 0) return;
						var path = prefix + key;
						var control = typeof value === 'number' ? 'num' : typeof value === 'boolean' ? 'bool' : 'text';
						leaves.push([path, "", function (field) { return field(path, control); }, false, path.slice(10)]);
					});
				};
				collect(data.condition, 'condition.');
				if (leaves.length) sections.push(["Condition", leaves]);
			}
			return sections;
		},
		dexAttributeShown: function (entry, data) {
			if (ALWAYS_SHOWN.indexOf(entry[0]) >= 0 || entry[0].slice(0, 10) === 'condition.' || (this.dexAddedAttributes || {})[entry[0]]) return true;
			if (entry[0] === 'secondaries') return !!(data.secondaries || data.secondary);
			return entry[0].split(' ').some(function (path) {
				var value = getPath(data, path);
				return !blank(value) && (value !== false || !entry[3]) && !($.isPlainObject(value) && $.isEmptyObject(value));
			});
		},
		dexEffectFieldsHTML: function (data) {
			var self = this;
			var editable = this.dexEditable && this.dexEffectData.editable;
			var table = this.dexEffect.table;
			var field = function (path, control, options) {
				return self.dexEffectFieldHTML(path, control, options, data);
			};
			var boxes = '';
			var groups = SENTENCES[table];
			var picked = this.dexPickedAttributes || [];
			var later = [];
			var box = function (entry, section, index) {
				if (entry[0] === 'secondaries' && index === undefined) {
					return $.each(secondaryList(data), function (i) { box(entry, section, i); });
				}
				var removable = editable && self.dexEffectCanEdit(entry[0]) && ALWAYS_SHOWN.indexOf(entry[0]) < 0 && entry[0].slice(0, 10) !== 'condition.';
				var title = entry[4] || TITLES[table + ':' + entry[0]] || TITLES[entry[0]] || section[0];
				var remove = index === undefined ? ['removeDexAttribute', escape(entry[0])] : ['removeDexSecondary', index];
				var fieldAt = index === undefined ? field : function (path, control) {
					return self.dexEffectFieldHTML(path, control, index, data);
				};
				var group = groups.indexOf(section);
				boxes += self.dexSentenceHTML('data-attribute="' + escape(entry[0]) + '"', title, entry[2](fieldAt, data, self), removable && remove,
					groups.length > 1 ? group < 0 ? null : Math.round(group * 280 / (groups.length - 1)) : '@@A@@');
			};
			$.each(this.dexEffectSections(data), function (i, section) {
				$.each(section[1], function (j, entry) {
					if (!self.dexAttributeShown(entry, data)) return;
					if (picked.indexOf(entry[0]) >= 0) later[picked.indexOf(entry[0])] = [entry, section];
					else box(entry, section);
				});
			});
			$.each(later, function (i, pair) {
				if (pair) box(pair[0], pair[1]);
			});
			var count = boxes.split('@@A@@').length - 1;
			var index = 0;
			boxes = boxes.replace(/@@A@@/g, function () { return String(Math.round(index++ * 280 / Math.max(count - 1, 1))); });
			return this.dexSentencesHTML(boxes, editable && 'name="showDexEffectPanel" value="attributes"');
		},
		dexAttributeListHTML: function (query) {
			var self = this;
			var data = this.dexEffectValues();
			query = toID(query);
			var groups = [];
			$.each(this.dexEffectSections(data), function (i, section) {
				var rows = [];
				$.each(section[1], function (j, entry) {
					if (self.dexAttributeShown(entry, data) && entry[0] !== 'secondaries' || !self.dexEffectCanEdit(entry[0]) || !entry[1]) return;
					if (query && toID(entry[1] + ' ' + section[0] + ' ' + (TITLES[self.dexEffect.table + ':' + entry[0]] || TITLES[entry[0]] || '')).indexOf(query) < 0) return;
					var title = entry[4] || TITLES[self.dexEffect.table + ':' + entry[0]] || TITLES[entry[0]] || section[0];
					rows.push(DexViews.ui.sentenceRowHTML('attribute|' + escape(entry[0]), title, escape(entry[1])));
				});
				if (rows.length) groups.push([section[0], rows]);
			});
			return DexViews.ui.chartHTML(groups, "No more attributes to add.");
		},
		dexAttributeEntry: function (path) {
			var found = null;
			$.each(this.dexEffectSections(this.dexEffectValues()), function (i, section) {
				$.each(section[1], function (j, entry) {
					if (!found && (entry[0] === path || entry[0].split(' ').indexOf(path) >= 0)) found = entry;
				});
			});
			return found;
		},
		showDexAttribute: function (path) {
			var entry = this.dexAttributeEntry(path);
			if (!entry) return;
			this.dexPanel = 'fields';
			var data = this.dexEffectValues();
			if (entry[0] === 'secondaries' && this.dexEditable && this.dexEffectCanEdit(entry[0])) {
				this.addDexSecondary();
				this.showDexEffectPanel('fields', true);
				var $last = this.$('.dexmonpage [data-panel=fields] [data-path=secondaries]').last();
				$last[0].scrollIntoView({ block: 'center' });
				return $last.find('input').first().focus();
			}
			if (!this.dexAttributeShown(entry, data) && this.dexEditable && this.dexEffectCanEdit(entry[0])) {
				if (entry[3]) {
					var fields = {};
					setPath(fields, entry[0], true);
					this.saveDexEffect(fields);
				}
				this.dexAddedAttributes = this.dexAddedAttributes || {};
				this.dexAddedAttributes[entry[0]] = true;
				this.dexPickedAttributes = (this.dexPickedAttributes || []).concat([entry[0]]);
				this.renderDexEffect();
			}
			this.showDexEffectPanel('fields', true);
			var $field = this.$('.dexmonpage [data-panel=fields] [data-path="' + (entry[0].split(' ').indexOf(path) >= 0 ? path : entry[0].split(' ')[0]) + '"]');
			if (!$field.length) $field = this.$('.dexmonpage [data-panel=fields] [data-path="' + entry[0] + '"]');
			if (!$field.length) return;
			$field[0].scrollIntoView({ block: 'center' });
			$field.find('input:not([type=checkbox]), select, textarea').first().focus();
		},
		clickDexAttributeLine: function (e) {
			e.preventDefault();
			e.stopPropagation();
			this.showDexAttribute(e.currentTarget.dataset.attr);
		},
		dexDamageStatsHTML: function (data) {
			var self = this;
			var special = data.category === 'Special';
			var who = [['source', "User's"], ['target', "Target's"]];
			var stats = STATS.slice(1, 6).map(function (stat) { return [stat, BOOSTS[stat]]; });
			var pick = function (path, choices, fallback) {
				if (self.dexEffectCanEdit(path)) return self.dexEffectFieldHTML(path, 'pick', [choices, fallback], data);
				var value = getPath(data, path) || fallback;
				return '<strong>' + choices.filter(function (choice) { return choice[0] === value; })[0][1] + '</strong>';
			};
			return 'Attacks with ' + pick('overrideOffensivePokemon', who, 'source') + ' ' + pick('overrideOffensiveStat', stats, special ? 'spa' : 'atk') +
				' against ' + pick('overrideDefensivePokemon', who, 'target') + ' ' + pick('overrideDefensiveStat', stats, special ? 'spd' : 'def');
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
				var options = slot.condition ? 'condition:' + slot.condition : slot.kind === 'ref' ? (slot.form === 'name' ? 'name:' : 'ref:') + slot.tables.join(',') :
					{ type: 'type', category: CATEGORIES, status: 'status', flag: 'flag' }[slot.kind] || (slot.original === 'hp' ? STATS.slice(0, 6) :
					slot.key || ['accuracy', 'evasion'].indexOf(slot.original) >= 0 ? Object.keys(BOOSTS) : STATS.slice(1, 6));
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
			return '<div class="pad"><div class="setchart dexcodebox">' + this.dexCodeHTML(this.dexEffect.id, this.dexEffectCodeValues(), this.dexEffectCodeNode()) + '</div></div>';
		},
		dexEffectCodeValues: function () {
			var info = this.dexEffectData;
			var data = this.dexEffectValues();
			var values = {};
			$.each(data, function (key, value) {
				if ((info.editable ? info.editable.indexOf(key) >= 0 : key !== 'name') && !blank(value)) values[key] = value;
			});
			$.each(info.handlers, function (i, handler) {
				var keys = handler.path.split('.');
				var object = values;
				for (var j = 0; j < keys.length - 1; j++) {
					if (!$.isPlainObject(object[keys[j]])) object[keys[j]] = $.extend(true, {}, getPath(data, keys.slice(0, j + 1).join('.')));
					object = object[keys[j]];
				}
				object[keys[keys.length - 1]] = { handler: handler };
			});
			return values;
		},
		dexEffectCodeNode: function () {
			var view = this.dexView;
			var table = this.dexEffect.table;
			var conditions = function (kind) {
				return function () { return selectOptions('condition:' + kind, view) || []; };
			};
			var refs = function (refTable) {
				return function () { return refOptions([refTable], 'id', view) || []; };
			};
			var flags = function (flagTable) {
				return CODE.map(CODE.fixed(1), Object.keys(FLAGS[flagTable]));
			};
			var boosts = CODE.map(CODE.whole(-6, 6, 1), Object.keys(BOOSTS));
			var statuses = STATUSES.map(function (status) { return status[0]; });
			var secondaryFieldsOf = function () {
				return {
					chance: CODE.whole(1, 100, 100), boosts: boosts, status: CODE.choice(statuses), volatileStatus: CODE.choice(conditions('volatileStatus')),
					sideCondition: CODE.choice(conditions('sideCondition')), pseudoWeather: CODE.choice(conditions('pseudoWeather'))
				};
			};
			var secondary = CODE.obj($.extend(secondaryFieldsOf(), { self: CODE.obj(secondaryFieldsOf(), true) }), true, [], { chance: 100 });
			var fraction = CODE.tuple([CODE.whole(1, 100, 1), CODE.whole(1, 100, 2)]);
			var text = { desc: CODE.text(1024), shortDesc: CODE.text(table === 'Moves' ? 55 : 90), countsAs: CODE.choice(refs(table)) };
			var fields = {
				Moves: {
					accuracy: CODE.json(100), basePower: CODE.whole(0, 1000), category: CODE.choice(CATEGORIES), pp: CODE.whole(1, 64, 10),
					priority: CODE.whole(-7, 7), type: CODE.choice(function () { return selectOptions('type', view); }),
					target: CODE.choice(MOVE_TARGETS.map(function (target) { return target[0]; })), critRatio: CODE.whole(1, 6, 2), flags: flags('Moves'),
					drain: fraction, recoil: fraction, heal: fraction, secondary: secondary, secondaries: CODE.list(secondary, 1, 5, true),
					self: CODE.obj(secondaryFieldsOf(), true), boosts: boosts, selfBoost: CODE.obj({ boosts: boosts }, false, ['boosts']),
					status: CODE.choice(statuses), volatileStatus: CODE.choice(conditions('volatileStatus')), sideCondition: CODE.choice(conditions('sideCondition')),
					slotCondition: CODE.choice(conditions('slotCondition')), pseudoWeather: CODE.choice(conditions('pseudoWeather')),
					weather: CODE.choice(conditions('weather')), terrain: CODE.choice(conditions('terrain')), multihit: CODE.json(2),
					selfSwitch: CODE.choice([true, 'copyvolatile', 'shedtail']), selfdestruct: CODE.choice(['always', 'ifHit']), ignoreImmunity: CODE.json(true),
					overrideOffensiveStat: CODE.choice(STATS.slice(1, 6)), overrideDefensiveStat: CODE.choice(STATS.slice(1, 6)),
					overrideOffensivePokemon: CODE.choice(['target', 'source']), overrideDefensivePokemon: CODE.choice(['target', 'source']),
					damage: CODE.json('level'), ohko: CODE.json(true),
					animations: CODE.list(CODE.choice(function () { return animationOptions(); }), 1, 2)
				},
				Abilities: { flags: flags('Abilities'), suppressWeather: CODE.bool() },
				Items: {
					fling: CODE.obj({ basePower: CODE.whole(0, 250, 10), status: CODE.choice(statuses), volatileStatus: CODE.choice(conditions('volatileStatus')) },
						true, [], { basePower: 10 }),
					naturalGift: CODE.obj({ basePower: CODE.whole(0, 250, 80), type: CODE.choice(function () { return selectOptions('type', view); }) },
						true, [], { basePower: 80, type: 'Normal' }),
					boosts: boosts, ignoreKlutz: CODE.bool(), spritenum: CODE.whole(0, 2000)
				},
				Conditions: { duration: CODE.whole(1, 100, 5), counterMax: CODE.whole(1, 10000, 1), noCopy: CODE.bool(), affectsFainted: CODE.bool() }
			}[table];
			$.each(PROPERTIES[table] || {}, function (key) { fields[key] = fields[key] || CODE.bool(); });
			$.extend(fields, text);
			var editable = this.dexEffectData.editable;
			$.each(fields, function (key) {
				if (editable && editable.indexOf(key) < 0) delete fields[key];
			});
			$.each(this.dexEffectCodeValues(), function (key, value) {
				if (!fields[key]) fields[key] = CODE.of(value);
			});
			return CODE.obj(fields, true, { Moves: ['accuracy', 'basePower', 'category', 'flags', 'pp', 'priority', 'target', 'type'], Abilities: ['flags'] }[table] || []);
		},
		dexCodeHandlerHTML: function (handler, depth) {
			var html = this.dexEffectCodeBlockHTML(handler, this.dexEffectSlotGroups(), !!this.dexEditable);
			return html.replace(/--hue: (\d+)/g, '--hue: @@G$1@@').replace(/\n/g, '\n' + new Array(depth + 1).join('\t'));
		},
		saveDexEffectCode: function (key, value) {
			var data = this.dexEffectValues();
			var strip = function (item) {
				if (!$.isPlainObject(item)) return Array.isArray(item) ? item.map(strip) : item;
				var result = {};
				$.each(item, function (field, part) {
					if (!(part && part.handler)) result[field] = strip(part);
				});
				return result;
			};
			var nulled = function (was, now) {
				if (!$.isPlainObject(was) || !$.isPlainObject(now)) return now;
				var result = $.extend({}, now);
				$.each(was, function (field, part) {
					result[field] = field in now ? nulled(part, now[field]) : null;
				});
				return result;
			};
			var clean = value === undefined ? undefined : strip(value);
			var fields = {};
			if (key === 'secondary' || key === 'secondaries') {
				fields = secondaryFields(clean === undefined ? [] : key === 'secondary' ? [clean] : clean, data.secondary);
			} else {
				fields[key] = clean === undefined ? null : nulled(data[key], clean);
			}
			this.saveDexEffect(fields);
			this.renderDexEffect();
		},
		setupDexMoveLearners: function () {
			var effect = this.dexEffect;
			var editable = this.dexEditable;
			var view = this.dexView;
			var saved = this.dexBaseView || view;
			var entries = DexViews.entries[this.dexid];
			var $results = this.$('.dexmonpage [data-panel=list]');
			var search = this.dexListSearch = DexViews.ui.panelSearch($results);
			var learners = {};
			var count = 0;
			var learnedBefore = function (id) {
				var original = entries && entries.originals[id];
				if (original === null) return learners[id];
				if (original) return original.learnset.indexOf(effect.id) >= 0;
				var learnset = DexViews.learnsetOf(saved, id);
				return !!(learnset && learnset[effect.id]);
			};
			DexViews.ui.rowClasses(search, function (id, type) {
				return type !== 'pokemon' ? '' : (editable && learners[id] ? ' cur' : '') + (learners[id] !== learnedBefore(id) ? ' dexedited' : '');
			});
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
					count = learned.length + inherited.length;
					return DexViews.ui.learnRows(["Learned by", "Other Pokémon"], learned, inherited, others, editable);
				};
			});
			search.setType('pokemon', 'gen' + view.gen);
			this.dexEffectListCount(count);
		},
		setupDexEffectList: function () {
			var effect = this.dexEffect;
			if (effect.table === 'Moves') return this.setupDexMoveLearners();
			var view = this.dexView;
			var $results = this.$('.dexmonpage [data-panel=list]');
			var search = this.dexListSearch = DexViews.ui.panelSearch($results);
			viewSearch(search, view, function (typedSearch) {
				var getBaseResults = typedSearch.getBaseResults;
				typedSearch.getBaseResults = function () {
					return DexViews.ui.dropEmptyHeaders(getBaseResults.call(this).filter(function (row) {
						if (row[0] !== 'pokemon') return true;
						var abilities = this.dex.species.get(row[1]).abilities;
						return Object.keys(abilities).some(function (slot) { return toID(abilities[slot]) === effect.id; });
					}, this), 'pokemon');
				};
			});
			search.setType('pokemon', 'gen' + view.gen);
			this.dexEffectListCount(search.resultSet.filter(function (row) { return row[0] === 'pokemon'; }).length);
		},
		dexEffectListCount: function (count) {
			var $label = this.$('.dexmonpage .dexlearnsetlabel');
			$label.text($label.attr('data-name') + ' (' + count + ')');
			var query = $.trim(this.$('.dexmonpage input[name=listsearch]').val() || '');
			if (query) this.dexListSearch.find(query);
		},
		showDexEffectPanel: function (panel, keep) {
			if (!this.dexEffectData) return;
			var table = this.dexEffect.table;
			var start = table === 'Moves' || table === 'Abilities' ? 'list' : 'fields';
			if (!keep && panel === this.dexPanel && panel !== start && panel !== 'flags') panel = start;
			if (panel === 'flags') {
				this.$('.dexmonpage [data-panel=flags]').html(this.dexFlagListHTML(this.$('.dexmonpage input[name=effectflags]').val()));
				if (!keep) this.markDexEdits();
			}
			this.showDexPanel(panel);
			if (panel === 'attributes' && keep !== true) {
				this.$('.dexmonpage .dexattrsearch').val('').focus();
				this.$('.dexmonpage .dexattrlist').html(this.dexAttributeListHTML(''));
			}
			this.$('.dexmonpage .setstats').toggleClass('cur', panel === 'fields' && start !== 'fields');
			this.$('.dexmonpage').toggleClass('dexcodetab', panel === 'code');
			this.$('.dexmonpage .teambar button').each(function () {
				this.disabled = (this.value === 'code') === (panel === 'code');
			});
		},
		clickDexEffectEntry: function (e) {
			var entry = e.currentTarget.dataset.entry.split('|');
			var table = DexViews.ui.ENTRY_TABLES[entry[0]];
			var panel = $(e.currentTarget).closest('[data-panel]').attr('data-panel');
			if (entry[0] === 'attribute') return this.showDexAttribute(entry[1]);
			if (table && panel === 'picker') {
				this.openDexEffect(table, entry[1], this.dexEffect.from);
				this.dexPanel = 'picker';
				return;
			}
			if (entry[0] === 'flag') {
				if (this.dexEditable) this.toggleDexEffectFlag(entry[1]);
				return;
			}
			if (entry[0] === 'pokemon' && this.dexEditable && this.dexEffect.table === 'Moves') {
				this.refreshDexList(function () {
					this.toggleDexMove(toID(entry[1]), this.dexEffect.id);
					this.setupDexEffectList();
				});
				return;
			}
			if (entry[0] === 'pokemon') {
				this.openDexPokemon(entry[1]);
				return;
			}
			var search = panel === 'picker' ? this.dexPicker : this.dexListSearch;
			if (search && search.addFilter(e.currentTarget)) search.find('');
		},
		closeDexEffect: function (value, button) {
			if (button) return this.leaveDex(button, function () { this.closeDexEffect(); });
			var from = this.dexEffect && this.dexEffect.from;
			this.dexEffect = null;
			this.dexEffectData = null;
			this.dexListSearch = null;
			if (from) return this.openDexPokemon(from);
			this.closeDexPokemon();
		},
		setupDexConditionList: function (search) {
			var room = this;
			var renderRow = search.renderRow;
			search.renderRow = function (id, type, matchStart, matchLength, errorMessage, attrs) {
				if (type !== 'condition') return renderRow.apply(this, arguments);
				var info = room.dexConditionInfo(id);
				return DexViews.ui.chartRowHTML('condition|' + id, '<span class="col movenamecol">' + escape(info.name) + '</span> ' +
					'<span class="col widelabelcol"><em>Kind</em><br />' + (CONDITION_KINDS[info.kind] || '&mdash;') + '</span> ' +
					'<span class="col movedesccol">' + escape(info.desc) + '</span>', attrs);
			};
			search.find = function (query) {
				this.q = toID(query);
				this.resultSet = room.dexConditionRows(this.q);
				this.renderedIndex = 0;
				this.renderingDone = false;
				this.updateScroll();
				return true;
			};
			search.find('');
		},
		dexConditionInfo: function (id) {
			var entries = DexViews.entries[this.dexid];
			var names = entries.names || {};
			var status = STATUSES.filter(function (entry) { return entry[0] === id; })[0];
			var info = entries.conditions[id] || ['', ''];
			return { name: status && (names[id] || id) === id ? status[1] : names[id] || id, kind: info[0], desc: info[1] };
		},
		dexConditionRows: function (query) {
			var entries = DexViews.entries[this.dexid];
			if (!entries || !entries.Conditions) return [['html', '<p><em>Loading...</em></p>']];
			var room = this;
			var custom = entries.custom.Conditions || [];
			var modified = entries.modified.Conditions || [];
			var nameOf = function (id) {
				return room.dexConditionInfo(id).name;
			};
			var kinds = Object.keys(CONDITION_KINDS);
			var rank = function (id) {
				var kind = kinds.indexOf((entries.conditions[id] || [''])[0]);
				return kind < 0 ? kinds.length : kind;
			};
			var ids = Object.keys(entries.Conditions).sort(function (a, b) {
				return rank(a) - rank(b) || nameOf(a).localeCompare(nameOf(b));
			}).filter(function (id) {
				return !query || toID(nameOf(id)).indexOf(query) >= 0;
			});
			var groups = [
				["Custom conditions", ids.filter(function (id) { return custom.indexOf(id) >= 0; })],
				["Modified conditions", ids.filter(function (id) { return modified.indexOf(id) >= 0; })],
				["Conditions", ids.filter(function (id) { return custom.indexOf(id) < 0 && modified.indexOf(id) < 0; })]
			];
			var rows = [];
			$.each(groups, function (i, group) {
				if (!group[1].length) return;
				rows.push(['header', escape(group[0])]);
				$.each(group[1], function (j, id) { rows.push(['condition', id]); });
			});
			return rows;
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
				if (field === 'secondaries') {
					fields = secondaryFields(readField(this.$('.dexmonpage [data-path=secondaries]')), this.dexEffectValues().secondary);
				} else if (field.indexOf(' ') >= 0 && $.isPlainObject(value)) {
					$.each(value, function (each, part) { setPath(fields, each, part); });
				} else {
					setPath(fields, field, value);
				}
			}
			this.saveDexEffect(fields);
			var edited = $(e.currentTarget).closest('.dexsentence').attr('data-attribute');
			if (edited) (this.dexAddedAttributes = this.dexAddedAttributes || {})[edited] = true;
			$(e.currentTarget).filter('.dexboostcell').toggleClass('dexboostup', Number(e.currentTarget.value) > 0).toggleClass('dexboostdown', Number(e.currentTarget.value) < 0);
			var data = this.dexEffectValues();
			if (['type', 'category'].indexOf($wrap.attr('data-path')) >= 0 ||
				['immunity', 'fixeddamage', 'boostlist', 'secondaries'].indexOf($wrap.attr('data-control')) >= 0) return this.renderDexEffect();
			if (this.$('.dexmonpage [data-path="' + $wrap.attr('data-path') + '"]').length > 1) return this.renderDexEffect();
			this.$('.dexmonpage .dexmoveicons').html(this.dexEffectIconHTML(data));
			this.$('.dexmonpage .setcol-stats').html(this.dexEffectStatsHTML(data));
			this.$('.dexmonpage .setstats').toggleClass('cur', this.dexPanel === 'fields' && !!this.$('.dexmonpage [data-panel=list]').length);
			this.markDexEdits();
		},
		resizeDexInline: function (e) {
			fitInline(e.currentTarget);
		},
		focusDexShortDesc: function () {
			this.showDexEffectPanel('description', true);
		},
		countDexShortDesc: function (e) {
			this.$('.dexmonpage .dexdesccount').text(e.currentTarget.value.length + '/' + e.currentTarget.maxLength);
		},
		removeDexAttribute: function (path) {
			delete (this.dexAddedAttributes || {})[path];
			var fields = {};
			if (path === 'secondaries') {
				fields = secondaryFields([], this.dexEffectValues().secondary);
			} else {
				$.each(path.split(' '), function (i, each) { setPath(fields, each, null); });
			}
			this.saveDexEffect(fields);
			this.renderDexEffect();
		},
		addDexSecondary: function () {
			var data = this.dexEffectValues();
			this.saveDexEffect(secondaryFields(secondaryList(data).concat([{ chance: 100 }]), data.secondary));
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
			var table = this.dexEffect.table;
			var path = flagPath(table, flag);
			if (!this.dexEffectCanEdit(path)) return;
			var fields = {};
			setPath(fields, path, getPath(this.dexEffectValues(), path) ? null : path === flag || 1);
			this.saveDexEffect(fields);
			var data = this.dexEffectValues();
			var $input = this.$('.dexmonpage input[name=effectflags]');
			var query = $input.val();
			var focused = $input.is(':focus') || this.dexPanel === 'flags';
			this.$('.dexmonpage .dexflagbox').html(this.dexFlagChipsHTML(data));
			this.$('.dexmonpage .dexflaglabel').text('Flags (' + setFlags(table, data).length + ')');
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
			if (!count || !KINDS[count.table]) return;
			var room = this;
			app.addPopup(DexViews.ui.DexNamePopup, {
				sourceEl: button,
				callback: function (name) {
					if (count.table === 'TypeChart') {
						if (!room.dexView.dex.types.get(name).exists) room.editDex({ type: { name: name } });
						return;
					}
					var entries = DexViews.entries[room.dexid];
					if (entries && entries[count.table][toID(name)]) return room.openDexEffect(count.table, toID(name));
					room.pendingEffect = [count.table, toID(name)];
					var edit = {};
					edit[KINDS[count.table]] = { name: name };
					room.editDex(edit);
				}
			});
		},
		copyDexEffect: function (value, button) {
			app.addPopup(DexViews.ui.DexCopyPopup, { room: this, kind: KINDS[this.dexEffect.table], name: this.dexEffectData.name, sourceEl: button });
		}
	});
	_.extend(window.DexBuilderRoom.prototype.events, {
		'click .dexmonpage .dexmoveattributes [data-attr]': 'clickDexAttributeLine',
		'change .dexmonpage .dexeffectfield input': 'changeDexEffectField',
		'change .dexmonpage .dexeffectfield select': 'changeDexEffectField',
		'change .dexmonpage .dexeffectfield textarea': 'changeDexEffectField',
		'focus .dexmonpage input[name=effectflags]': 'focusDexEffectFlags',
		'input .dexmonpage input[name=effectflags]': 'searchDexEffectFlags',
		'input .dexmonpage input.dexinline': 'resizeDexInline',
		'input .dexmonpage .dexshortdesc .dexfield': 'countDexShortDesc',
		'focus .dexmonpage .dexshortdesc .dexfield': 'focusDexShortDesc'
	});

})(window.jQuery);
