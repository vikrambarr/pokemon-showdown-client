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
	var YES = [['true', "Yes"]];
	var MOVE_TARGETS = [
		['normal', "Adjacent"], ['any', "Any"], ['self', "Self"], ['adjacentAlly', "Adjacent ally"], ['adjacentAllyOrSelf', "Ally or self"],
		['adjacentFoe', "Adjacent foe"], ['allAdjacent', "All adjacent"], ['allAdjacentFoes', "Adjacent foes"], ['allies', "Allies"],
		['allySide', "Ally side"], ['foeSide', "Foe side"], ['all', "Field"], ['randomNormal', "Random foe"], ['scripted', "Scripted"]
	];
	var FLAGS = {
		Moves: [
			'allyanim', 'bite', 'bullet', 'bypasssub', 'cantusetwice', 'charge', 'contact', 'dance', 'defrost', 'distance', 'failcopycat',
			'failencore', 'failinstruct', 'failmefirst', 'failmimic', 'futuremove', 'gravity', 'heal', 'metronome', 'minimize', 'mirror',
			'mustpressure', 'noassist', 'nonsky', 'noparentalbond', 'nosketch', 'nosleeptalk', 'pledgecombo', 'powder', 'protect', 'pulse',
			'punch', 'recharge', 'reflectable', 'slicing', 'snatch', 'sound', 'wind'
		],
		Abilities: ['breakable', 'cantsuppress', 'failroleplay', 'failskillswap', 'noentrain', 'noreceiver', 'notrace', 'notransform']
	};
	var SECTIONS = {
		Moves: [
			["Attributes", [
				['basePower', "Power", 'int', [0, 1000]], ['accuracy', "Accuracy", 'accuracy'], ['pp', "PP", 'int', [0, 64]],
				['priority', "Priority", 'int', [-7, 7]], ['critRatio', "Crit ratio", 'int', [0, 6]], ['multihit', "Hits", 'range'],
				['damage', "Fixed damage", 'damage'], ['ohko', "One-hit KO", 'select', 'ohko']
			]],
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
		if (options === 'flag') return FLAGS.Moves.concat(FLAGS.Abilities).sort();
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

	function moveEffects(data) {
		var effects = [];
		var secondaries = data.secondaries || (data.secondary ? [data.secondary] : []);
		if (data.boosts) effects.push(['Stats', boostsText(data.boosts)]);
		if (data.selfBoost && data.selfBoost.boosts) effects.push(['User', boostsText(data.selfBoost.boosts)]);
		if (data.status) effects.push(['Status', data.status]);
		if (data.volatileStatus) effects.push(['Volatile', data.volatileStatus]);
		if (secondaries.length) effects.push(['Secondary', secondaries.map(secondaryText).join('; ')]);
		if (data.self && data.self.boosts) effects.push(['After', boostsText(data.self.boosts)]);
		if (data.drain) effects.push(['Drain', data.drain.join('/')]);
		if (data.recoil) effects.push(['Recoil', data.recoil.join('/')]);
		if (data.heal) effects.push(['Heal', data.heal.join('/')]);
		if (data.selfSwitch) effects.push(['Switch', "User"]);
		if (data.forceSwitch) effects.push(['Switch', "Target"]);
		$.each(['weather', 'terrain', 'pseudoWeather', 'sideCondition', 'slotCondition'], function (i, key) {
			if (data[key]) effects.push(['Field', data[key]]);
		});
		if (data.ohko) effects.push(['OHKO', "Yes"]);
		if (data.damage) effects.push(['Damage', data.damage]);
		return effects;
	}

	function valueText(control, value, options) {
		if (control === 'secondaries') {
			return (value || []).map(function (secondary) { return escape(secondaryText(secondary)); }).join('<br />') || '&mdash;';
		}
		if (blank(value)) return '&mdash;';
		if (control === 'accuracy' && value === true) return "Never misses";
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
			return '<input type="number" class="textbox' + cls + '"' + (range ? ' min="' + range[0] + '" max="' + range[1] + '"' : ' step="any"') +
				' value="' + (blank(current) || typeof current !== 'number' ? '' : current) + '"' + (extra || '') + ' />';
		};
		switch (control) {
		case 'int':
			return number(value, options);
		case 'num':
			return number(value);
		case 'code':
		case 'codepair':
			var step = function (current) {
				return '<input type="number" class="textbox" step="' + options.step + '" value="' + (typeof current === 'number' ? current : '') + '" />';
			};
			if (control === 'code') return step(value) + (options.suffix || '');
			return step(value[0]) + ' ' + options.sep + ' ' + step(value[1]);
		case 'accuracy':
			return number(value === true ? '' : value, [0, 100], value === true ? ' disabled' : '') +
				' <label class="checkbox"><input type="checkbox"' + (value === true ? ' checked' : '') + ' /> Never misses</label>';
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

	function pairValue(kind, top, bottom) {
		if (kind === 'ratio') return round(top / bottom);
		if (kind === 'chance' || kind === 'percent') return round(top / bottom * 100);
		if (kind === 'range') return [top, bottom - 1];
		return [top, bottom];
	}

	function pairSlots(kind, value, bottom) {
		if (kind === 'fraction') return value;
		if (kind === 'range') return [value[0], value[1] + 1];
		if (kind === 'ratio') return [Math.round(value * bottom), bottom];
		var top = value * bottom / 100;
		if (kind === 'percent') return [Number(top.toFixed(6)), bottom];
		if (Math.abs(top - Math.round(top)) < 1e-9) return [Math.round(top), bottom];
		return value % 1 ? [Math.round(value * 10), 1000] : [value, 100];
	}

	function pairText(kind, value) {
		if (kind === 'range') return value.join('&ndash;');
		if (kind === 'fraction') return value.join('/');
		return value + (kind === 'ratio' ? '' : '%');
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
		case 'code':
			return readNumber(inputs[0]);
		case 'codepair':
			var pair = [readNumber(inputs[0]), readNumber(inputs[1])];
			return pair[0] === null || pair[1] === null ? null : pair;
		case 'accuracy':
			$(inputs[0]).prop('disabled', inputs[1].checked);
			return inputs[1].checked ? true : readNumber(inputs[0]);
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
			entries = DexViews.entries[this.room.dexid] || null;
			var from = refOptions([this.table], 'id', this.room.dexView);
			var fromHTML = from ? '<select class="button" name="from">' + optionsHTML(from, '', "(nothing)") + '</select>' :
				'<input type="text" class="textbox" name="from" />';
			this.$el.html('<form><p><label class="label">Name:<br /><input type="text" class="textbox autofocus" name="name" maxlength="40" /></label></p>' +
				'<p><label class="label">Copy from (optional):<br />' + fromHTML + '</label></p>' +
				'<p><label class="checkbox"><input type="checkbox" name="counts" checked /> The copy counts as the original</label></p>' +
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
			if ($.trim(data.from)) edit[KINDS[this.table]].inheritsFrom = $.trim(data.from);
			if ($.trim(data.from) && data.counts) edit[KINDS[this.table]].countsAs = true;
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
				return '<div class="textbox dexfield' + (className ? ' ' + className : '') + '">' + valueText(control, value, options) + '</div>';
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
			buf += '<div class="setmenu"><button name="showDexEffectPanel" value="code"><i class="fa fa-code"></i>Code</button>';
			if (editable && info.edited) {
				buf += ' <button name="deleteDexEffect"><i class="fa fa-trash"></i>' + (info.official ? 'Reset to base' : 'Delete') + '</button>';
			} else if (!editable) {
				buf += ' <button name="forkDexEffect"><i class="fa fa-code-fork"></i>Fork</button>';
			}
			buf += '</div>';
			buf += '<div class="setchart dexmonchart dexeffectchart">';

			buf += '<div class="setcol setcol-icon"><div class="setcell-sprite dexmoveicons">' + this.dexEffectIconHTML(data) + '</div>';
			buf += '<div class="setcell setcell-pokemon"><label>' + NAMES[table] + '</label><div class="textbox dexfield" title="' + escape(info.name) + '">' + escape(info.name) + '</div></div></div>';

			var source = !info.official ? 'Custom' : info.edited ? 'Edited' : 'Unedited';
			var base = info.base && info.base !== info.id ? (view.dex[{ Moves: 'moves', Abilities: 'abilities', Items: 'items' }[table] || 'moves'].get(info.base).name || info.base) : '—';
			buf += '<div class="setcol setcol-details"><div class="setrow">';
			buf += '<div class="setcell setcell-details"><label>Details</label><button class="textbox setdetails" tabindex="-1" name="showDexEffectDetails">';
			buf += '<span class="detailcell detailcell-first"><label>Source</label>' + source + '</span>';
			buf += '<span class="detailcell"><label>Legality</label>' + escape(data.isNonstandard || 'Standard') + '</span>';
			buf += '<span class="detailcell"><label>Based on</label>' + escape(base) + '</span>';
			buf += '<span class="detailcell"><label>Counts as</label>' + (data.countsAs && base !== '—' ? escape(base) : '&mdash;') + '</span>';
			buf += '</button></div></div>';
			buf += '<div class="setrow setrow-icons"><div class="setcell"><span class="itemicon"></span></div><div class="setcell setcell-typeicons dextypeselects">';
			if (table === 'Moves') buf += this.dexEffectIconSelectHTML('type', data.type) + this.dexEffectIconSelectHTML('category', data.category);
			buf += '</div></div>';
			buf += '<div class="setrow setrow-abilities">';
			if (FLAGS[table]) buf += '<div class="setcell"><label>Flags</label><div class="textbox dexchipbox dexflagbox">' + this.dexFlagChipsHTML(data) + '</div></div>';
			buf += '</div></div>';

			buf += '<div class="setcol setcol-moves">';
			buf += '<div class="setcell"><label>Description</label>' + this.dexEffectFieldHTML('shortDesc', 'text', null, data, 'dexfield') + '</div>';
			var cells = {
				Moves: [['Target', 'target', 'select', MOVE_TARGETS], ['Learned by']],
				Abilities: [['Weather', 'suppressWeather', 'select', [['true', "Suppresses"], ['false', "Doesn't suppress"]]], ['Pokémon']],
				Items: [['Fling power', 'fling.basePower', 'int', [0, 250]], ['Natural Gift type', 'naturalGift.type', 'select', 'type']],
				Conditions: [['Duration', 'duration', 'int', [1, 100]], ['Counter max', 'counterMax', 'int', [1, 10000]]]
			}[table];
			for (var c = 0; c < cells.length; c++) {
				buf += '<div class="setcell' + (cells[c][1] ? '' : ' setcell-learnset') + '"><label>' + cells[c][0] + '</label>';
				buf += cells[c][1] ? this.dexEffectFieldHTML(cells[c][1], cells[c][2], cells[c][3], data, 'dexfield') :
					'<button class="textbox learnsetcount" tabindex="-1" name="showDexEffectPanel" value="list">&hellip;</button>';
				buf += '</div>';
			}
			buf += '</div>';

			buf += '<div class="setcol setcol-stats">' + this.dexEffectStatsHTML(data) + '</div>';
			buf += '</div></li></ol></div>';
			if (table === 'Moves' || table === 'Abilities') buf += '<div class="teambuilder-results" data-panel="list"></div>';
			if (FLAGS[table]) buf += '<div class="dexstatresults dexeffectpanel" data-panel="flags"></div>';
			buf += '<div class="dexstatresults dexeffectpanel" data-panel="fields">' + this.dexEffectFieldsHTML(data) + '</div>';
			buf += '<div class="dexstatresults dexeffectpanel dexcode" data-panel="code">' + this.dexEffectCodeHTML() + '</div>';
			this.$('.dexmonpage').html('<div class="teamwrapper">' + buf + '</div>');

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
		},
		dexEffectIconHTML: function (data) {
			var table = this.dexEffect.table;
			if (table === 'Moves') return Dex.getTypeIcon(data.type) + Dex.getCategoryIcon(data.category);
			if (table === 'Items') return '<span class="itemicon dexitemicon" style="' + Dex.getItemIcon($.extend({}, data, { id: this.dexEffect.id })) + '"></span>';
			return '<i class="fa fa-' + ICONS[table] + ' dexeffecticon"></i>';
		},
		dexEffectIconSelectHTML: function (path, value) {
			var view = this.dexView;
			var icon = function (name) { return path === 'type' ? Dex.getTypeIcon(name) : Dex.getCategoryIcon(name); };
			if (!this.dexEffectCanEdit(path)) return icon(value);
			var names = path === 'type' ? selectOptions('type', view) : CATEGORIES;
			var options = names.map(function (name) {
				return '<option value="' + escape(name) + '"' + (name === value ? ' selected' : '') + '>' + icon(name) + '</option>';
			}).join('');
			return wrap('data-path', path, 'select', '<span class="dextypeslot" title="Change ' + path + '">' + icon(value) +
				'<select class="dextypearrow base-select"><button></button>' + options + '</select>' + CARET + '</span>');
		},
		dexFlagChipsHTML: function (data) {
			var flags = Object.keys(data.flags || {}).filter(function (flag) { return data.flags[flag]; });
			var editable = this.dexEffectCanEdit('flags');
			return flags.map(function (flag) {
				return '<span class="dexchip">' + escape(flag) + (editable ? ' <button class="dexchipx" name="toggleDexEffectFlag" value="' + escape(flag) + '" tabindex="-1">&times;</button>' : '') + '</span>';
			}).join('') + (editable ? '<input type="text" class="dexchipinput" name="effectflags"' + (flags.length ? '' : ' placeholder="Flags"') + ' autocomplete="off" />' : '');
		},
		dexFlagListHTML: function (query) {
			var data = this.dexEffectValues();
			var flags = data.flags || {};
			query = toID(query);
			var buf = '<ul class="utilichart">';
			$.each(FLAGS[this.dexEffect.table], function (i, flag) {
				if (query && flag.indexOf(query) < 0) return;
				buf += '<li class="result"><a data-entry="flag|' + flag + '"' + (flags[flag] ? ' class="cur"' : '') + '><span class="col movenamecol">' +
					(flags[flag] ? '<i class="fa fa-check"></i> ' : '') + flag + '</span></a></li>';
			});
			return buf + '</ul>';
		},
		dexEffectStatsHTML: function (data) {
			var table = this.dexEffect.table;
			var rows;
			if (table === 'Moves') {
				var multihit = Array.isArray(data.multihit) ? data.multihit.join('-') : data.multihit;
				rows = [
					['Power', data.basePower || '—'], ['Accuracy', data.accuracy === true ? '—' : data.accuracy + '%'],
					['PP', data.pp === 1 || data.noPPBoosts ? data.pp : data.pp * 8 / 5], ['Priority', (data.priority > 0 ? '+' : '') + data.priority]
				].concat(moveEffects(data), [['Crit', data.critRatio || 1], ['Hits', multihit || 1]]).slice(0, 6);
			} else if (table === 'Abilities') {
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
			var buf = '<div class="setrow"><label>Attributes</label><button class="textbox setstats dexmoveattributes" tabindex="-1" name="showDexEffectPanel" value="fields">';
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
			sections.unshift(["Description", [['shortDesc', "Short", 'text'], ['desc', "Full", 'textarea']]]);
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
		dexEffectCodeBlockHTML: function (handler, colors) {
			var self = this;
			var src = handler.code || '';
			if (!handler.editable || !handler.slots.length) {
				var source = (this.dexEffectData.source || []).filter(function (entry) { return entry[0] === handler.path; })[0];
				return escape(source ? source[1] : src);
			}
			var rows = src.split('\n');
			var indent = Math.min.apply(null, rows.slice(1).filter(function (row) { return $.trim(row); }).map(function (row) {
				return row.length - row.replace(/^\s+/, '').length;
			}));
			if (!isFinite(indent)) indent = 0;
			var buf = '';
			var at = 0;
			var slots = handler.slots.slice().sort(function (a, b) { return a.start - b.start; });
			var pairs = numberPairs(handler);
			var text = function (until) {
				var chunk = src.slice(at, until);
				buf += escape(indent ? chunk.replace(new RegExp('\n[ \t]{0,' + indent + '}', 'g'), '\n') : chunk);
				at = until;
			};
			var shownOf = function (slot) {
				var value = self.dexEffectSlotValue(handler.path + ':' + slot.index, slot);
				var shown = src.slice(slot.start, slot.start + slot.length);
				if (String(value) === String(slot.original)) return shown;
				if (slot.kind === 'stat' && /^[a-z]+$/.test(shown)) return String(value);
				if (typeof value === 'number') return value < 0 || Object.is(value, -0) ? '(' + value + ')' : String(value);
				return JSON.stringify(value);
			};
			$.each(slots, function (i, slot) {
				if (pairs[slot.index] === null) return;
				var key = handler.path + ':' + slot.index;
				var pair = pairs[slot.index] && pairs[slot.index].slot;
				text(slot.start);
				var shown = shownOf(slot);
				if (pair) shown += src.slice(slot.start + slot.length, pair.start) + shownOf(pair);
				buf += slot.fixed ? escape(shown) : '<mark class="dexmark" style="--hue: ' + colors[key] + '">' + escape(shown) + '</mark>';
				at = pair ? pair.start + pair.length : slot.start + slot.length;
			});
			text(src.length);
			return buf;
		},
		dexEffectCodeHTML: function () {
			var self = this;
			var info = this.dexEffectData;
			var draft = this.dexEffectDraft() || {};
			var events = draft.events || {};
			var view = this.dexView;
			var editable = !!this.dexEditable;
			var lines = !!this.dexCodeLines;
			var buf = '<div class="pad">';
			if (!info.handlers.length) return buf + '<p><em>No code: everything this ' + KINDS[this.dexEffect.table] + ' does comes from its fields.</em></p></div>';
			var editables = info.handlers.filter(function (handler) { return handler.editable && handler.slots.some(function (slot) { return !slot.fixed; }); });
			if (editables.length && editable) buf += '<p><small>Change the highlighted numbers and names to change what the code does.</small></p>';
			var grouping = this.dexEffectSlotGroups();
			var colors = grouping.colors;
			var mark = function (key, html) {
				return '<mark class="dexmark" style="--hue: ' + colors[key] + '">' + html + '</mark>';
			};
			var lineHTML = function (key, slot, pair) {
				var line = slot.line;
				var length = pair ? pair.slot.start + pair.slot.length - slot.start : slot.length;
				var start = Math.max(0, slot.column - 25);
				var end = Math.min(line.length, slot.column + length + 25);
				return '<code title="' + escape(line.trim()) + '">' + (start ? '&hellip;' : '') + escape(line.slice(start, slot.column)) +
					mark(key, escape(line.slice(slot.column, slot.column + length))) + escape(line.slice(slot.column + length, end)) +
					(end < line.length ? '&hellip;' : '') + '</code>';
			};
			var rowHTML = function (members, label) {
				var slot = members[0].slot;
				var pair = members[0].pair;
				var value = self.dexEffectSlotValue(members[0].key, slot);
				var original = slot.original;
				var text = escape(String(value));
				var was = escape(String(original));
				var control = slot.kind === 'number' ? 'code' : 'select';
				var options = slot.kind === 'ref' ? (slot.form === 'name' ? 'name:' : 'ref:') + slot.tables.join(',') :
					{ type: 'type', category: CATEGORIES, stat: 'stat', status: 'status', flag: 'flag' }[slot.kind];
				if (pair) {
					value = pairValue(pair.kind, value, self.dexEffectSlotValue(pair.key, pair.slot));
					original = pairValue(pair.kind, slot.original, pair.slot.original);
					text = pairText(pair.kind, value);
					was = pairText(pair.kind, original);
					control = Array.isArray(value) ? 'codepair' : 'code';
					options = { suffix: pair.kind === 'ratio' ? '' : '%', sep: pair.kind === 'range' ? '&ndash;' : '/' };
				}
				if (slot.kind === 'number') options = $.extend({ step: Array.isArray(original) || original % 1 === 0 ? 1 : 0.1 }, options);
				var keys = members.map(function (member) { return member.key + (member.pair ? ' ' + member.pair.key : ''); }).join(' ');
				return '<tr><th>' + label + '</th><td>' + (editable ? wrap('data-slot', keys, control, controlHTML(control, value, options, view)) : text) +
					(String(value) !== String(original) ? ' <small>(was ' + was + ')</small>' : '') + '</td></tr>';
			};
			if (!lines && editables.length) {
				var sections = { values: '', numbers: '' };
				$.each(grouping.groups, function (i, group) {
					var values = group.map(function (member) { return toID(self.dexEffectSlotValue(member.key, member.slot)); });
					var split = values.some(function (value) { return value !== values[0]; });
					$.each(split ? group.map(function (member) { return [member]; }) : [group], function (j, members) {
						var slot = members[0].slot;
						var paths = members.map(function (member) { return member.path; }).filter(function (path, k, list) { return list.indexOf(path) === k; });
						var label = lineHTML(members[0].key, slot, members[0].pair);
						if (members.length > 1 || slot.kind !== 'number' && !split) {
							label = '<code title="' + escape(paths.join(', ')) + '">' + mark(members[0].key, escape(slot.line.slice(slot.column, slot.column + slot.length))) + '</code>';
							if (members.length > 1) label += ' <small>&times;' + members.length + '</small>';
						}
						sections[slot.kind === 'number' ? 'numbers' : 'values'] += rowHTML(members, label);
					});
				});
				$.each([['values', "Values"], ['numbers', "Numbers"]], function (i, section) {
					if (sections[section[0]]) {
						buf += '<div class="resultheader"><h3>' + section[1] + '</h3></div><table class="dexdetails dexcodeslots">' + sections[section[0]] + '</table>';
					}
				});
				buf += '<div class="resultheader"><h3>Code</h3></div>';
			}
			$.each(info.handlers, function (i, handler) {
				var original = handler.path.slice(handler.path.lastIndexOf('.') + 1);
				buf += '<h3>' + escape(handler.path) + '</h3>';
				if (handler.events.length) {
					var event = Object.prototype.hasOwnProperty.call(events, handler.path) ? events[handler.path] || original : handler.event;
					buf += '<p><label class="label">Runs on:</label> ' + (editable ? wrap('data-event', handler.path, 'select',
						'<select class="button">' + optionsHTML([original].concat(handler.events), event) + '</select>') : escape(event)) + '</p>';
				}
				if (!handler.editable) {
					buf += '<p><small>This code can\'t be changed here.</small></p>';
				} else if (lines && editables.indexOf(handler) >= 0) {
					buf += '<table class="dexdetails dexcodeslots">';
					var pairs = numberPairs(handler);
					$.each(handler.slots, function (j, slot) {
						if (pairs[slot.index] === null || slot.fixed) return;
						var key = handler.path + ':' + slot.index;
						var found = pairs[slot.index];
						var pair = found && { key: handler.path + ':' + found.slot.index, slot: found.slot, kind: found.kind };
						buf += rowHTML([{ key: key, slot: slot, pair: pair }], lineHTML(key, slot, pair));
					});
					buf += '</table>';
				}
				buf += '<pre data-code="' + escape(handler.path) + '">' + self.dexEffectCodeBlockHTML(handler, colors) + '</pre>';
			});
			if (editables.length) {
				buf += '<p><button class="button" name="toggleDexCodeLines">' + (lines ? "Group repeated values" : "Show each line") + '</button></p>';
			}
			return buf + '</div>';
		},
		toggleDexCodeLines: function () {
			this.dexCodeLines = !this.dexCodeLines;
			this.$('.dexmonpage [data-panel=code]').html(this.dexEffectCodeHTML());
		},
		setupDexEffectList: function () {
			var effect = this.dexEffect;
			var view = this.dexView;
			var $results = this.$('.dexmonpage .teambuilder-results');
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
			var count = search.resultSet.filter(function (row) { return row[0] === 'pokemon'; }).length;
			this.$('.dexmonpage .learnsetcount').text(count + ' Pokémon');
		},
		showDexEffectPanel: function (panel, keep) {
			if (!this.dexEffectData) return;
			var table = this.dexEffect.table;
			var start = table === 'Moves' || table === 'Abilities' ? 'list' : 'fields';
			if (!keep && panel === this.dexEffectPanel && panel !== start && panel !== 'flags') panel = start;
			this.dexEffectPanel = panel;
			if (panel === 'flags') this.$('.dexmonpage [data-panel=flags]').html(this.dexFlagListHTML(this.$('.dexmonpage input[name=effectflags]').val()));
			this.$('.dexmonpage [data-panel]').each(function () {
				$(this).toggle(this.dataset.panel === panel);
			});
			this.$('.dexmonpage .setstats').toggleClass('cur', panel === 'fields' && start !== 'fields');
			this.$('.dexmonpage .setmenu button[value=code]').toggleClass('cur', panel === 'code');
			if (panel === 'list' && this.dexEffectSearch) this.dexEffectSearch.updateScroll();
		},
		showDexEffectDetails: function (value, button) {
			var data = this.dexEffectValues();
			var buf = '<table class="dexdetails">';
			var add = function (entry, path) {
				if (entry && typeof entry === 'object' && !Array.isArray(entry) && path !== 'flags' && Object.keys(entry).length) {
					for (var key in entry) add(entry[key], path ? path + '.' + key : key);
					return;
				}
				var text = path === 'flags' ? Object.keys(entry).join(', ') : typeof entry === 'string' ? entry : JSON.stringify(entry);
				buf += '<tr><th>' + escape(path) + '</th><td>' + escape(text || '') + '</td></tr>';
			};
			add(data, '');
			buf += '</table>';
			app.addPopup(Popup, { htmlMessage: buf, sourceEl: button, maxWidth: 480 });
		},
		clickDexEffectEntry: function (e) {
			var entry = e.currentTarget.dataset.entry.split('|');
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
			var ids = Object.keys(entries.Conditions).sort(function (a, b) {
				return (names[a] || a).localeCompare(names[b] || b);
			});
			var buf = this.dexEditable ? '<p><button class="button" name="newDexEffect"><i class="fa fa-plus"></i> New condition</button></p>' : '';
			buf += '<ul class="utilichart">';
			for (var i = 0; i < ids.length; i++) {
				var tag = custom.indexOf(ids[i]) >= 0 ? 'Custom' : modified.indexOf(ids[i]) >= 0 ? 'Edited' : '';
				buf += '<li class="result"><a data-entry="condition|' + ids[i] + '"><span class="col movenamecol">' + escape(names[ids[i]] || ids[i]) + '</span>' +
					(tag ? ' <span class="col movedesccol">' + tag + '</span>' : '') + '</a></li>';
			}
			return buf + '</ul>';
		}
	};

	var builderMethods = {
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
				var values = keys.map(function () { return value; });
				var first = slotOf(keys[0]);
				var second = keys[1] && slotOf(keys[1]);
				var handler = handlers.filter(function (other) { return other.path === keys[0].slice(0, keys[0].lastIndexOf(':')); })[0];
				var kind = second && pairKind(handler.code || '', first, second);
				if (kind) values = value === null ? [null, null] : pairSlots(kind, value, this.dexEffectSlotValue(keys[1], second));
				fields.slots = {};
				$.each(keys, function (i, key) {
					var slot = slotOf(key);
					var same = slot.kind === 'number' ? String(values[i]) === String(slot.original) : toID(values[i]) === toID(slot.original);
					fields.slots[key] = values[i] === null || same ? null : values[i];
				});
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
			if (fields.slots) {
				var self = this;
				var colors = this.dexEffectSlotGroups().colors;
				$.each(this.dexEffectData.handlers, function (i, handler) {
					self.$('.dexmonpage pre[data-code]').filter(function () { return this.dataset.code === handler.path; }).html(self.dexEffectCodeBlockHTML(handler, colors));
				});
			}
			var data = this.dexEffectValues();
			if ($wrap.attr('data-path') === 'type' || $wrap.attr('data-path') === 'category') return this.renderDexEffect();
			this.$('.dexmonpage .dexmoveicons').html(this.dexEffectIconHTML(data));
			this.$('.dexmonpage .setcol-stats').html(this.dexEffectStatsHTML(data));
			this.$('.dexmonpage .setstats').toggleClass('cur', this.dexEffectPanel === 'fields' && !!this.$('.dexmonpage [data-panel=list]').length);
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
			this.$('.dexmonpage .setcol-stats').html(this.dexEffectStatsHTML(data));
			this.$('.dexmonpage [data-panel=flags]').html(this.dexFlagListHTML(query));
			if (focused) this.$('.dexmonpage input[name=effectflags]').val(query).focus();
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
		}
	};

	_.extend(RoomsRoom.prototype, viewMethods);
	_.extend(window.DexBuilderRoom.prototype, builderMethods);
	_.defaults(window.DexBuilderRoom.prototype, viewMethods);
	_.extend(window.DexBuilderRoom.prototype.events, {
		'change .dexmonpage .dexeffectfield input': 'changeDexEffectField',
		'change .dexmonpage .dexeffectfield select': 'changeDexEffectField',
		'change .dexmonpage .dexeffectfield textarea': 'changeDexEffectField',
		'focus .dexmonpage input[name=effectflags]': 'focusDexEffectFlags',
		'input .dexmonpage input[name=effectflags]': 'searchDexEffectFlags'
	});

})(window.jQuery);
