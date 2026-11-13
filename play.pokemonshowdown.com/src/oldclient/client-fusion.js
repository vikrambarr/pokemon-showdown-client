(function ($) {

	var STATS_FROM_HEAD = { hp: 1, spa: 1, spd: 1 };

	function fusionOf(pokemon) {
		if (!pokemon || typeof pokemon !== 'object') return null;
		if (typeof pokemon.details !== 'string') {
			return pokemon.fusion ? { fusion: pokemon.fusion, altsprite: pokemon.altsprite || '' } : null;
		}
		var fusion = /, fusion: ([^,]+)/.exec(pokemon.details);
		if (!fusion) return null;
		var altsprite = /, alt: ([^,]+)/.exec(pokemon.details);
		return { fusion: fusion[1], altsprite: altsprite ? altsprite[1] : '' };
	}

	function fusedTypes(headTypes, bodyTypes) {
		if (headTypes.length === 2 && headTypes.includes('Flying') && headTypes.includes('Normal')) headTypes = ['Flying'];
		if (bodyTypes.length === 2 && bodyTypes.includes('Flying') && bodyTypes.includes('Normal')) bodyTypes = ['Flying'];
		var types = [headTypes[0]];
		var bonusType = bodyTypes[bodyTypes.length - 1];
		if (!types.includes(bonusType)) types.push(bonusType);
		if (bodyTypes.length === 2 && types.length === 1) types.push(bodyTypes[0]);
		return types;
	}

	var fusedSpecies = {};
	function fuse(dex, species, fusion) {
		var body = dex.species.get(fusion);
		if (!species.exists || !body.exists || body.id === species.id) return species;
		var key = dex.modid + ':' + species.id + ':' + body.id;
		if (fusedSpecies[key]) return fusedSpecies[key];
		var baseStats = {};
		var bst = 0;
		for (var stat in species.baseStats) {
			baseStats[stat] = STATS_FROM_HEAD[stat] ?
				Math.floor(species.baseStats[stat] * 2 / 3 + body.baseStats[stat] / 3) :
				Math.floor(species.baseStats[stat] / 3 + body.baseStats[stat] * 2 / 3);
			bst += baseStats[stat];
		}
		var fused = Object.create(species);
		fused.types = fusedTypes(species.types, body.types);
		fused.baseStats = baseStats;
		fused.bst = bst;
		fused.weightkg = (species.weightkg + body.weightkg) / 2;
		fusedSpecies[key] = fused;
		return fused;
	}

	function fusionSprite(head, data) {
		var index = window.BattleFusionIndex;
		if (!data || !index) return '';
		var headNum = index.nums[toID(head)];
		var bodyNum = index.nums[toID(data.fusion)];
		var files = headNum && bodyNum && index.sprites[headNum];
		if (!files) return '';
		var file = bodyNum + (data.altsprite && files.includes(bodyNum + data.altsprite) ? data.altsprite : '');
		if (!files.includes(file)) return '';
		return Dex.resourcePrefix + 'sprites/fusion-sprites/' + headNum + '.' + file + '.png';
	}

	var parseDetails = Battle.prototype.parseDetails;
	Battle.prototype.parseDetails = function (name, pokemonid, details, output) {
		details = details || '';
		output = parseDetails.call(this, name, pokemonid, details.replace(/, (fusion|alt): [^,]+/g, ''), output);
		output.details = details;
		if (output.searchid) output.searchid = pokemonid + '|' + details;
		return output;
	};

	var runMinor = Battle.prototype.runMinor;
	Battle.prototype.runMinor = function (args, kwArgs, nextArgs, nextKwargs) {
		if (args[0] !== '-displayabilities') return runMinor.apply(this, arguments);
		var poke = this.getPokemon(args[1]);
		if (poke) poke.displayAbilities = args[2].split(',');
		this.log(args, kwArgs);
	};

	var getSpecies = Pokemon.prototype.getSpecies;
	Pokemon.prototype.getSpecies = function (serverPokemon) {
		var species = getSpecies.apply(this, arguments);
		var data = fusionOf(this);
		if (!data || this.volatiles.transform) return species;
		return fuse(this.side.battle.dex, species, data.fusion);
	};

	var getSpriteData = Dex.getSpriteData;
	Dex.getSpriteData = function (pokemon, isFront, options) {
		var spriteData = getSpriteData.apply(this, arguments);
		if (!(pokemon instanceof Pokemon) || pokemon.volatiles.transform) return spriteData;
		var url = fusionSprite(pokemon.getSpeciesForme(), fusionOf(pokemon));
		if (!url) return spriteData;
		spriteData.url = url;
		spriteData.w = 96;
		spriteData.h = 96;
		spriteData.y = 0;
		spriteData.gen = 5;
		spriteData.pixelated = true;
		if (!spriteData.isFrontSprite) spriteData.url += '#flip';
		return spriteData;
	};

	var getTeambuilderSprite = Dex.getTeambuilderSprite;
	Dex.getTeambuilderSprite = function (set, dex) {
		var url = set && fusionSprite(set.species, fusionOf(set));
		if (!url) return getTeambuilderSprite.apply(this, arguments);
		return 'background-image:url(' + url + ');background-position:-2px -3px;background-repeat:no-repeat;' +
			'background-size:100px;image-rendering:pixelated';
	};

	var getPokemonIcon = Dex.getPokemonIcon;
	Dex.getPokemonIcon = function (pokemon, facingLeft) {
		var icon = getPokemonIcon.apply(this, arguments);
		var data = fusionOf(pokemon);
		if (!data || pokemon.volatiles && pokemon.volatiles.transform) return icon;
		var end = icon.indexOf(';');
		var head = (end < 0 ? icon : icon.slice(0, end)).slice(11);
		var body = getPokemonIcon.call(this, data.fusion, facingLeft).split(';')[0].slice(11);
		return 'background:' + head + ';--picon-head:' + head + ';--picon-body:' + body + (end < 0 ? '' : icon.slice(end));
	};

	var showPokemonTooltip = BattleTooltips.prototype.showPokemonTooltip;
	BattleTooltips.prototype.showPokemonTooltip = function (clientPokemon, serverPokemon) {
		var text = showPokemonTooltip.apply(this, arguments);
		var data = fusionOf(clientPokemon || serverPokemon);
		var abilities = clientPokemon && clientPokemon.displayAbilities;
		var buf = '';
		if (data) buf += '<small><b>Fusion: </b>' + BattleLog.escapeHTML(data.fusion) + '</small><br />';
		if (abilities && abilities.length > 1) {
			buf += '<small><b>Abilities: </b>' + BattleLog.escapeHTML(abilities.join(' / ')) + '</small><br />';
		}
		if (!buf) return text;
		var typechange = clientPokemon && clientPokemon.volatiles.typechange;
		if (data && typechange && !clientPokemon.volatiles.typeadd &&
			typechange[1] === clientPokemon.getSpecies().types.join('/')) {
			text = text.replace('<small>(Type changed)</small><br />', '');
		}
		return text.replace(/(<h2>[\s\S]*?<br \/>)/, '$1' + buf);
	};

	var getPokemonAbilityData = BattleTooltips.prototype.getPokemonAbilityData;
	BattleTooltips.prototype.getPokemonAbilityData = function (clientPokemon, serverPokemon) {
		var abilityData = getPokemonAbilityData.apply(this, arguments);
		var data = fusionOf(clientPokemon);
		if (!data || !abilityData.possibilities.length) return abilityData;
		var body = this.battle.dex.species.get(data.fusion);
		for (var key in body.abilities) {
			if (!abilityData.possibilities.includes(body.abilities[key])) abilityData.possibilities.push(body.abilities[key]);
		}
		return abilityData;
	};

	function formatRules(format) {
		var details = window.DexViews && window.DexViews.formatDetails[format];
		return details ? details.rules : [];
	}

	var renderSet = TeambuilderRoom.prototype.renderSet;
	var updateChart = TeambuilderRoom.prototype.updateChart;
	var chartChange = TeambuilderRoom.prototype.chartChange;
	var chartSet = TeambuilderRoom.prototype.chartSet;
	var updatePokemonSprite = TeambuilderRoom.prototype.updatePokemonSprite;
	_.extend(TeambuilderRoom.prototype, {
		renderSet: function (set, i) {
			var buf = renderSet.call(this, set, i);
			var rules = formatRules(this.curTeam.format);
			var isFusion = !!set.fusion || rules.includes('fusionsmod');
			var isDA = !!set.ability2 || rules.includes('doubleabilitymod');
			if (isFusion) buf = buf.replace('<label>Pok&eacute;mon</label>', '<label>Pok&eacute;mon/Head</label>');
			if (!set.species) return buf;
			if (isFusion) {
				var fusionCell = '<div class="setcell-fusion"><label>Fusion/Body</label>' +
					'<input type="text" name="fusion" class="textbox chartinput" value="' + BattleLog.escapeHTML(set.fusion || '') + '" autocomplete="off" />' +
					'<button class="closebutton" name="deleteFusion" aria-label="Delete"><i class="fa fa-times-circle"></i></button></div>';
				buf = buf.replace('<div class="setmenu">', '$&<button name="swapFusion"><i class="fa fa-random"></i>Swap</button> ');
				buf = buf.replace('<div class="setchart', fusionCell + '$&');
				var types = fuse(this.curTeam.dex, this.curTeam.dex.species.get(set.species), set.fusion || '').types;
				buf = buf.replace(/(<div class="setcell setcell-typeicons">)[\s\S]*?(<\/div>)/, '$1' + types.map(function (type) { return Dex.getTypeIcon(type); }).join('') + '$2');
			}
			if (isDA) {
				var abilityCell = /<div class="setcell setcell-ability">[\s\S]*?<\/div>/.exec(buf);
				if (!abilityCell) return buf;
				var ability2 = '<input type="text" name="ability2" class="textbox chartinput" value="' + BattleLog.escapeHTML(set.ability2 || '') + '" autocomplete="off" />';
				var abilitiesCell = abilityCell[0].replace('<label>Ability</label>', '<label>Abilities</label>')
					.replace('setcell-ability"', 'setcell-ability setcell-abilities"').replace('</div>', ability2 + '</div>');
				buf = buf.replace(abilityCell[0], '').replace('<div class="setcell setcell-typeicons">', '<div class="setcell setcell-typeicons setcell-typeicons-da">');
				buf = buf.replace(/(<div class="setrow setrow-icons">[\s\S]*?)(<\/div><div class="setrow">)/, '$1' + abilitiesCell + '$2');
			}
			return buf;
		},
		swapFusion: function (i, button) {
			var set = this.curSetList[+$(button).closest('li').attr('value')];
			if (!set.fusion) return;
			var fusion = set.fusion;
			set.fusion = set.species;
			set.species = fusion;
			delete set.altsprite;
			this.save();
			this.update();
			if (this.curSet) this.updateChart();
		},
		deleteFusion: function (i, button) {
			var set = this.curSetList[+$(button).closest('li').attr('value')];
			delete set.fusion;
			delete set.altsprite;
			this.save();
			this.update();
			if (this.curSet) this.updateChart();
		},
		updateChart: function () {
			var set = this.curSet;
			if (!set || this.curChartName !== 'ability2' || !set.fusion) return updateChart.apply(this, arguments);
			this.curSet = _.extend({}, set, { species: set.fusion });
			try {
				return updateChart.apply(this, arguments);
			} finally {
				this.curSet = set;
			}
		},
		chartChange: function (e, selectNext) {
			var name = e.currentTarget.name;
			if (name !== 'fusion' && name !== 'ability2') return chartChange.apply(this, arguments);
			if (this.curChartName !== name) return;
			var value = e.currentTarget.value;
			var entry = name === 'fusion' ? this.curTeam.dex.species.get(value) : this.curTeam.dex.abilities.get(value);
			if (toID(value) && !entry.exists) {
				$(e.currentTarget).addClass('incomplete');
				return;
			}
			this.chartSet(entry.exists ? entry.name : '', selectNext);
		},
		chartSet: function (val, selectNext) {
			var name = this.curChartName;
			if (name !== 'fusion' && name !== 'ability2') return chartSet.apply(this, arguments);
			var set = this.curSet;
			this.$('input[name=' + name + ']').val(val).removeClass('incomplete');
			if (name === 'fusion') {
				var changed = (set.fusion || '') !== val;
				if (val) {
					set.fusion = val;
				} else {
					delete set.fusion;
				}
				if (changed) {
					delete set.altsprite;
					this.updateSetTop();
				}
				if (selectNext) this.$(this.$('input[name=item]').length ? 'input[name=item]' : 'input[name=ability]').select();
			} else {
				if (val) {
					set.ability2 = val;
				} else {
					delete set.ability2;
				}
				if (selectNext) this.$('input[name=move1]').select();
			}
			this.save();
		},
		updatePokemonSprite: function () {
			updatePokemonSprite.call(this);
			var set = this.curSet;
			if (set && set.fusion) this.$('.pokemonicon-' + this.curSetLoc).attr('style', Dex.getPokemonIcon(set));
		}
	});
	TeambuilderRoom.prototype.chartTypes = _.extend({}, TeambuilderRoom.prototype.chartTypes, { fusion: 'pokemon', ability2: 'ability' });

	var EXTRAS = ['fusion', 'altsprite', 'ability2'];
	var importing = null;
	var packTeam = Storage.packTeam;
	Storage.packTeam = function (team) {
		if (importing && team) {
			for (var k = 0; k < team.length && importing.length; k++) _.extend(team[k], importing.shift());
		}
		var sets = packTeam.call(this, team).split(']');
		for (var i = 0; i < sets.length && team[i]; i++) {
			var set = team[i];
			if (!set.fusion && !set.altsprite && !set.ability2) continue;
			var fields = sets[i].split('|');
			var misc = fields[11].split(',');
			while (misc.length < 6) misc.push('');
			fields[11] = misc.concat(EXTRAS.map(function (key) { return set[key] || ''; })).join(',');
			sets[i] = fields.join('|');
		}
		return sets.join(']');
	};
	_.each(['unpackTeam', 'fastUnpackTeam'], function (name) {
		var unpack = Storage[name];
		Storage[name] = function (buf) {
			var team = unpack.call(this, buf);
			if (!buf) return team;
			var sets = buf.split(']');
			for (var i = 0; i < team.length; i++) {
				var misc = (sets[i].split('|')[11] || '').split(',');
				for (var j = 0; j < EXTRAS.length; j++) {
					if (misc[6 + j]) team[i][EXTRAS[j]] = misc[6 + j];
				}
			}
			return team;
		};
	});
	var importTeam = Storage.importTeam;
	Storage.importTeam = function (buffer, teams) {
		var extras = [];
		var cur = null;
		var lines = buffer.split('\n').filter(function (line) {
			line = $.trim(line);
			if (!line || line === '---' || line.includes('|') || (line.startsWith('===') && teams)) {
				cur = null;
			} else if (!cur) {
				extras.push(cur = {});
			} else if (line.startsWith('Fusion: ') || line.startsWith('Alt: ')) {
				cur[line.startsWith('Fusion: ') ? 'fusion' : 'altsprite'] = line.slice(line.indexOf(' ') + 1);
				return false;
			} else if (/^(Ability|Trait): .* \/ /.test(line)) {
				cur.ability2 = line.slice(line.indexOf(' / ') + 3);
			}
			return true;
		}).map(function (line) {
			return /^\s*(Ability|Trait): .* \/ /.test(line) ? line.slice(0, line.indexOf(' / ')) : line;
		});
		importing = extras;
		try {
			var team = importTeam.call(this, lines.join('\n'), teams);
		} finally {
			importing = null;
		}
		if (team) {
			for (var i = 0; i < team.length && extras.length; i++) _.extend(team[i], extras.shift());
		}
		return team;
	};
	var exportTeam = Storage.exportTeam;
	Storage.exportTeam = function (team, hidestats, shownature) {
		var text = exportTeam.call(this, team, hidestats, shownature);
		if (typeof team === 'string') {
			if (team.indexOf('\n') >= 0) return text;
			team = Storage.unpackTeam(team);
		}
		var sets = text.split('\n\n');
		if (!team) return text;
		for (var i = 0; i < team.length; i++) {
			var set = team[i];
			var lines = sets[i].split('\n');
			for (var j = 0; j < lines.length; j++) {
				if (set.ability2 && lines[j].startsWith('Ability: ')) lines[j] = $.trim(lines[j]) + ' / ' + set.ability2 + '  ';
				if (/^(EVs: |IVs: |[A-Za-z]+ Nature|- )/.test(lines[j]) || j === lines.length - 1) {
					if (set.altsprite) lines.splice(j, 0, 'Alt: ' + set.altsprite + '  ');
					if (set.fusion) lines.splice(j, 0, 'Fusion: ' + set.fusion + '  ');
					break;
				}
			}
			sets[i] = lines.join('\n');
		}
		return sets.join('\n\n');
	};

	$('<style>').text(
		':where([style*="--picon-head"]) { position: relative; }\n' +
		'[style*="--picon-head"] { background: none !important; }\n' +
		'[style*="--picon-head"]::before, [style*="--picon-head"]::after {\n' +
		'\tcontent: ""; position: absolute; top: 0; left: 0; width: 100%; height: 100%;\n' +
		'\tbackground: var(--picon-head); clip-path: inset(0 50% 0 0);\n' +
		'}\n' +
		'[style*="--picon-head"]::after { background: var(--picon-body); clip-path: inset(0 0 0 50%); }\n'
	).appendTo('head');

})(window.jQuery);
