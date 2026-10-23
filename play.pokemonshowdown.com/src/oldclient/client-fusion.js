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
		if (!spriteData.isFrontSprite) spriteData.flip = true;
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

	function fusionCell(set) {
		if (!set.fusion) return '';
		return '<span class="detailcell"><label>Fusion</label>' + BattleLog.escapeHTML(set.fusion) + '</span>';
	}

	var renderSet = TeambuilderRoom.prototype.renderSet;
	var updateDetailsForm = TeambuilderRoom.prototype.updateDetailsForm;
	var detailsChange = TeambuilderRoom.prototype.detailsChange;
	var updatePokemonSprite = TeambuilderRoom.prototype.updatePokemonSprite;
	_.extend(TeambuilderRoom.prototype, {
		renderSet: function (set, i) {
			var buf = renderSet.call(this, set, i);
			if (!set || !set.fusion) return buf;
			return buf.replace(/(name="details">[\s\S]*?)(<\/button>)/, '$1' + fusionCell(set) + '$2');
		},
		updateDetailsForm: function () {
			updateDetailsForm.call(this);
			var set = this.curSet;
			if (!set) return;
			var buf = '<div class="formrow"><label class="formlabel">Fusion:</label><div>' +
				'<input type="text" name="fusion" class="textbox" value="' + BattleLog.escapeHTML(set.fusion || '') + '" /></div></div>';
			buf += '<div class="formrow"><label class="formlabel">Ability 2:</label><div>' +
				'<input type="text" name="ability2" class="textbox" value="' + BattleLog.escapeHTML(set.ability2 || '') + '" /></div></div>';
			this.$chart.find('form.detailsform').append(buf);
		},
		detailsChange: function (e) {
			var set = this.curSet;
			if (set) {
				var fusion = this.curTeam.dex.species.get(this.$chart.find('input[name=fusion]').val());
				if (fusion.exists) {
					set.fusion = fusion.name;
				} else {
					delete set.fusion;
					delete set.altsprite;
				}
				var ability2 = this.curTeam.dex.abilities.get(this.$chart.find('input[name=ability2]').val());
				if (ability2.exists) {
					set.ability2 = ability2.name;
				} else {
					delete set.ability2;
				}
			}
			detailsChange.call(this, e);
			if (set) this.$('button[name=details]').append(fusionCell(set));
		},
		updatePokemonSprite: function () {
			updatePokemonSprite.call(this);
			var set = this.curSet;
			if (set && set.fusion) this.$('.pokemonicon-' + this.curSetLoc).attr('style', Dex.getPokemonIcon(set));
		}
	});

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
