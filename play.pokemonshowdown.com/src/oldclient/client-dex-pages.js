(function ($) {

	var DexViews = window.DexViews;
	var viewSearch = DexViews.ui.viewSearch;

	function editableDexes() {
		return DexViews.list.filter(function (summary) {
			return !summary.official && DexViews.ui.canEdit(summary);
		});
	}

	var SHINY_STAR = '<span class="shinystar"><i class="fa fa-star"></i><span>';
	var SPRITE_CELLS = [
		['front', 'F', 'Front'], ['back', 'B', 'Back'], ['front-shiny', SHINY_STAR + 'F</span></span>', 'Shiny front'], ['back-shiny', SHINY_STAR + 'B</span></span>', 'Shiny back'], ['icon', 'I', 'Icon']
	];

	function fieldHTML(value, className) {
		return '<div class="textbox dexfield' + (className ? ' ' + className : '') + '" title="' + value + '">' + value + '</div>';
	}

	function inputHTML(value, name, placeholder) {
		return '<input type="text" class="textbox chartinput dexfield" name="' + name + '" value="' + BattleLog.escapeHTML(value) + '"' +
			(placeholder ? ' placeholder="' + placeholder + '"' : '') + ' autocomplete="off" />';
	}

	function abilitySlotsOf(species) {
		return ['0', '1', 'H', 'S'].filter(function (slot) {
			return species.abilities[slot] && species.abilities[slot] !== 'No Ability';
		}).map(function (slot) { return [slot, species.abilities[slot]]; });
	}

	var EVO_TYPES = [
		['', "leveling up"], ['trade', "trading"], ['useItem', "using an item"], ['levelMove', "leveling up knowing a move"],
		['levelExtra', "leveling up with a condition"], ['levelFriendship', "leveling up with high friendship"],
		['levelHold', "leveling up holding an item"], ['other', "another method"]
	];
	var COLORS = ['Black', 'Blue', 'Brown', 'Gray', 'Green', 'Pink', 'Purple', 'Red', 'White', 'Yellow'];
	var DETAILS = [
		['weightkg', "Weight", "Weighs ___ kg"], ['heightm', "Height", "Is ___ m tall"], ['gender', "Gender", "Is ___"],
		['eggGroups', "Egg groups", "Is in the ___ egg groups"], ['color', "Color", "Is colored ___"], ['tags', "Tags", "Has the tags ___"],
		['evoType', "Evolution method", "Evolves by ___"], ['evoLevel', "Evolution level", "Evolves at level ___"],
		['evoItem', "Evolution item", "Evolves using ___"], ['evoMove', "Evolution move", "Evolves knowing ___"],
		['evoCondition', "Evolution condition", "Evolves ___"]
	];
	var ALWAYS_DETAILS = ['weightkg', 'heightm', 'gender'];

	function detailValue(species, key) {
		if (key === 'eggGroups' || key === 'tags') return (species[key] || []).join(', ');
		if (key === 'gender') return species.gender || '';
		if (key === 'weightkg' || key === 'heightm' || key === 'evoLevel') return species[key] ? String(species[key]) : '';
		return species[key] === undefined || species[key] === null ? '' : String(species[key]);
	}

	function detailHTML(species, key, editable) {
		var value = detailValue(species, key);
		var escaped = BattleLog.escapeHTML(value);
		var options = function (list) {
			return list.map(function (option) {
				return '<option value="' + BattleLog.escapeHTML(option[0]) + '"' + (option[0] === value ? ' selected' : '') + '>' + option[1] + '</option>';
			}).join('');
		};
		var input = function (type, size, attrs) {
			return '<input type="' + type + '" class="textbox" name="' + key + '" value="' + escaped + '" size="' + size + '"' + (attrs || '') + ' autocomplete="off" />';
		};
		if (key === 'gender') {
			var ratio = species.genderRatio;
			var male = ratio ? ratio.M * 100 : 50;
			if (!editable) return value ? { M: "always male", F: "always female", N: "genderless" }[value] : male + '% male';
			return '<select class="button" name="gender">' + options([['', "male or female"], ['M', "always male"], ['F', "always female"], ['N', "genderless"]]) + '</select>' +
				(value ? '' : ', <input type="number" class="textbox" name="male" value="' + male + '" min="0" max="100" step="12.5" />% male');
		}
		if (key === 'evoType') {
			if (!editable) return EVO_TYPES.filter(function (type) { return type[0] === value; }).concat([[value, escaped]])[0][1];
			return '<select class="button" name="evoType">' + options(EVO_TYPES) + '</select>';
		}
		if (key === 'color') {
			if (!editable) return escaped || '&mdash;';
			return '<select class="button" name="color">' + options([['', '&mdash;']].concat(COLORS.map(function (color) { return [color, color]; }))) + '</select>';
		}
		if (!editable) return escaped || '&mdash;';
		if (key === 'weightkg' || key === 'heightm') return input('number', 6, ' min="0" step="0.1"');
		if (key === 'evoLevel') return input('number', 4, ' min="1" max="100"');
		return input('text', key === 'eggGroups' || key === 'tags' ? 24 : 16);
	}

	function hasStandardSprites(id) {
		return !!(window.BattlePokedex && BattlePokedex[id]) && !DexViews.custom.Pokedex[id];
	}

	var DexCopyPopup = Popup.extend({
		type: 'semimodal',
		events: {
			'change select[name=target]': 'updateTarget'
		},
		initialize: function (data) {
			this.room = data.room;
			this.kind = data.kind;
			this.name = data.name;
			var room = this.room;
			var source = room.dexSummary;
			var targets = editableDexes().filter(function (dex) { return dex.id !== source.id && dex.parents.indexOf(source.id) < 0; });
			if (room.dexEditable) targets.unshift(source);
			var buf = '<form class="dexcreate"><p><label class="label">Copy ' + BattleLog.escapeHTML(data.name) + ' into:<br /><select name="target" class="button">';
			for (var i = 0; i < targets.length; i++) {
				var target = targets[i];
				buf += '<option value="' + BattleLog.escapeHTML(target.id) + '"' + (target.id === room.copyTarget ? ' selected' : '') + '>' +
					BattleLog.escapeHTML(target.name) + (target.id === source.id ? ' (this dex)' : '') + '</option>';
			}
			buf += '</select></label></p>';
			buf += '<p class="dexcopyname"><label class="label">New name:<br /><input type="text" class="textbox" name="name" maxlength="40" /></label></p>';
			if (data.line) buf += '<p class="dexcopyline"><label class="checkbox"><input type="checkbox" name="line" /> With its evolution line</label></p>';
			buf += '<p class="buttonbar"><button type="submit" class="button"><strong>Copy</strong></button> <button type="button" name="close" class="button">Cancel</button></p></form>';
			this.$el.html(targets.length ? buf : '<p>You don\'t have a dex to copy ' + BattleLog.escapeHTML(data.name) + ' into yet.</p>' +
				'<p class="buttonbar"><button type="button" name="close" class="button">Close</button></p>');
			this.updateTarget();
		},
		updateTarget: function () {
			var here = this.$('select[name=target]').val() === this.room.dexid;
			this.$('.dexcopyname').toggle(here);
			this.$('.dexcopyline').toggle(!here);
			if (here) this.$('input[name=name]').focus();
		},
		submit: function (data) {
			var room = this.room;
			var source = room.dexSummary;
			if (data.target !== source.id) {
				this.close();
				room.copyTarget = data.target;
				app.send(data.line ? '/crq dexforkline ' + data.target + ', ' + source.id + ', ' + this.name :
					'/crq dexfork ' + data.target + ', ' + source.id + ', ' + this.kind + ', ' + this.name);
				return;
			}
			var name = $.trim(data.name);
			if (!name) return;
			this.close();
			room.copyTarget = data.target;
			var fields = { name: name, inheritsFrom: this.name };
			var edit = {};
			if (this.kind === 'pokemon') {
				if (room.dexView.species[toID(name)]) return room.openDexPokemon(name);
				room.pendingSpecies = name;
			} else {
				var table = room.dexEffect.table;
				var entries = DexViews.entries[room.dexid];
				if (entries && entries[table][toID(name)]) return room.openDexEffect(table, toID(name));
				room.pendingEffect = [table, toID(name)];
				fields.countsAs = true;
			}
			edit[this.kind] = fields;
			room.editDex(edit);
		}
	});

	DexViews.ui.abilitySlotsOf = abilitySlotsOf;
	DexViews.ui.DexCopyPopup = DexCopyPopup;

	_.extend(window.DexBuilderRoom.prototype, {
		openDexPokemon: function (name, picked) {
			var view = DexViews.current = this.dexView;
			var species = view.dex.species.get(name);
			if (!view.species[species.id]) return;
			if (this.$('.dexpage').is(':visible')) this.dexScrollTop = this.dexScroller().scrollTop();
			this.dexSpecies = species;
			this.dexEffect = null;
			this.dexEditField = null;
			this.dexPicker = null;
			this.$('.dexsearchpage, .dexpage').hide();
			this.$('.dexmonpage').show();
			this.dexScroller().scrollTop(0);

			var editable = this.dexEditable;
			var buf = '<div class="pad">';
			buf += '<button name="closeDexPokemon" class="button"><i class="fa fa-chevron-left"></i> Pok&eacute;mon</button></div>';
			buf += '<div class="teambar">';
			var prevoOf = function (child) {
				if (child.prevo && view.species[toID(child.prevo)]) return view.dex.species.get(child.prevo);
				var parents = [];
				for (var id in view.species) {
					var parent = view.dex.species.get(id);
					if ((parent.evos || []).indexOf(child.name) >= 0) parents.push(parent);
				}
				return parents.length === 1 ? parents[0] : null;
			};
			var descend = function (names, deep) {
				for (var f = 0; f < names.length; f++) {
					if (f && !deep) break;
					var evos = view.dex.species.get(names[f]).evos || [];
					for (var e = 0; e < evos.length; e++) {
						if (view.species[toID(evos[e])] && names.indexOf(evos[e]) < 0) names.push(evos[e]);
					}
				}
				return names;
			};
			var ancestors = [];
			for (var parent = prevoOf(species); parent && ancestors.length < 5; parent = prevoOf(parent)) {
				if (parent.id === species.id || ancestors.indexOf(parent.name) >= 0) break;
				ancestors.unshift(parent.name);
			}
			var family = descend([ancestors[0] || species.name], true);
			if (family.length > 6) {
				var line = function (deep) {
					return ancestors.concat(descend([species.name], deep).filter(function (name) { return ancestors.indexOf(name) < 0; }));
				};
				family = line(true);
				if (family.length > 6) family = line(false);
			}
			this.dexFamilySize = family.length;
			var start = 0;
			var end = family.length;
			if (end > 6) {
				start = family.indexOf(species.name) - 2;
				if (start < 0) start = 0;
				if (start + 5 > end) start = end - 5;
				end = start + 5;
			}
			for (var i = start; i < end; i++) {
				var relative = view.dex.species.get(family[i]);
				var pokemonicon = '<span class="picon" style="' + Dex.getPokemonIcon(relative.name) + '"></span>';
				if (relative.id === species.id) {
					buf += '<button disabled class="pokemon">' + pokemonicon + BattleLog.escapeHTML(relative.name) + '</button> ';
				} else {
					buf += '<button name="openDexPokemon" value="' + BattleLog.escapeHTML(relative.name) + '" class="pokemon">' + pokemonicon + BattleLog.escapeHTML(relative.name) + '</button> ';
				}
			}
			buf += '</div>';

			buf += '<div class="teamchartbox individual"><ol class="teamchart"><li>';
			buf += '<div class="setmenu">';
			if (editable) {
				buf += this.dexSaveHTML('dexsave') + this.dexEditsHTML() + ' <button name="copyDexPokemon"><i class="fa fa-clone"></i>Copy</button> <button name="deleteDexPokemon" value="' + BattleLog.escapeHTML(species.name) + '"><i class="fa fa-trash"></i>' +
					(DexViews.custom.Pokedex[species.id] ? 'Delete' : 'Reset to base') + '</button></div>';
			} else {
				buf += this.dexEditsHTML() + ' <button name="copyDexPokemon"><i class="fa fa-clone"></i>Copy</button></div>';
			}
			var sprites = view.sprites[species.id] || {};
			var standard = hasStandardSprites(species.id);
			buf += '<div class="setchart-nickname"><label>Sprites</label><div class="textbox spritebox">';
			for (var j = 0; j < SPRITE_CELLS.length; j++) {
				var kind = SPRITE_CELLS[j][0];
				buf += '<button class="spritecell ' + (standard || sprites[kind] && view.images[sprites[kind]] ? 'has' : 'missing') + '" name="showDexSprite" value="' + kind + '" title="' + SPRITE_CELLS[j][2] + '">' + SPRITE_CELLS[j][1] + '</button>';
			}
			buf += '</div></div>';
			var spriteData = Dex.getTeambuilderSpriteData({ species: species.name }, view.dex);
			buf += '<div class="setchart dexmonchart' + (spriteData.pixelated ? ' pixelated' : '') + '" style="' + Dex.getTeambuilderSprite({ species: species.name }, view.dex) + ';">';

			buf += '<div class="setcol setcol-icon"><div class="setcell-sprite"></div>';
			buf += '<div class="setcell setcell-pokemon"><label>Pok&eacute;mon</label><input type="text" class="textbox dexfield" name="namesearch" value="' + BattleLog.escapeHTML(species.name) + '" autocomplete="off" /></div></div>';

			var ratio = species.genderRatio;
			buf += '<div class="setcol setcol-details"><div class="setrow">';
			buf += '<div class="setcell setcell-details"><label>Details</label><button class="textbox setdetails" tabindex="-1" name="showDexDetails">';
			buf += '<span class="detailcell detailcell-first"><label>Gender</label>' +
				(species.gender ? { M: 'Male', F: 'Female', N: '&mdash;' }[species.gender] : ratio ? (ratio.M * 100) + '% M' : '50% M') + '</span>';
			buf += '<span class="detailcell"><label>Weight</label>' + (species.weightkg || '&mdash;') + ' kg</span>';
			buf += '<span class="detailcell"><label>Height</label>' + (species.heightm || '&mdash;') + ' m</span>';
			var origin = view.origins[species.id];
			if (origin) buf += '<span class="detailcell"><label>Origin</label>' + BattleLog.escapeHTML(origin) + '</span>';
			buf += '</button></div></div>';
			buf += '<div class="setrow setrow-icons"><div class="setcell"><span class="itemicon"></span></div><div class="setcell setcell-typeicons' + (editable ? ' dextypeselects' : '') + '">';
			if (editable) {
				var typeNames = view.dex.types.names().filter(function (name) { return view.dex.types.get(name).exists !== false; });
				for (var t = 0; t < 2; t++) {
					var current = species.types[t] || '';
					var other = species.types[1 - t];
					buf += '<span class="dextypeslot" title="' + BattleLog.escapeHTML(current || 'None') + '">' +
						(current ? Dex.getTypeIcon(current) : '<span class="dextypeblank"></span>');
					buf += '<select name="dextype" class="dextypearrow base-select" data-index="' + t + '"><button></button>';
					if (t) buf += '<option value=""' + (current ? '' : ' selected') + '>&mdash;</option>';
					for (var k = 0; k < typeNames.length; k++) {
						if (typeNames[k] === other) continue;
						buf += '<option value="' + BattleLog.escapeHTML(typeNames[k]) + '"' + (typeNames[k] === current ? ' selected' : '') + '>' + Dex.getTypeIcon(typeNames[k]) + '</option>';
					}
					buf += '</select><svg class="dextypecaret" width="10" height="7" viewBox="0 0 14 9"><path d="M1 1H13L7 8Z" fill="#fff" stroke="#000" stroke-width="1.5" stroke-linejoin="round" /></svg></span>';
				}
			} else {
				for (var k = 0; k < species.types.length; k++) buf += '<span title="' + BattleLog.escapeHTML(species.types[k]) + '">' + Dex.getTypeIcon(species.types[k]) + '</span>';
			}
			buf += '</div></div>';
			var abilities = species.abilities;
			buf += '<div class="setrow setrow-abilities">';
			if (editable) {
				buf += '<div class="setcell"><label>Abilities</label><div class="textbox dexchipbox dexabilitybox">' + this.dexAbilityChipsHTML(abilitySlotsOf(species)) + '</div></div>';
			} else {
				var abilityCells = [['Ability 1', abilities['0']], ['Ability 2', abilities['1']], ['Hidden', abilities['H']]];
				if (abilities['S']) abilityCells.push(['Special', abilities['S']]);
				for (var c = 0; c < abilityCells.length; c++) {
					buf += '<div class="setcell"><label>' + abilityCells[c][0] + '</label>' + fieldHTML(BattleLog.escapeHTML(abilityCells[c][1] || '')) + '</div>';
				}
			}
			buf += '</div></div>';

			var rows = [
				'From: ' + (species.prevo || '\u2014'),
				'Into: ' + ((species.evos || []).join(', ') || '\u2014')
			];
			if (editable) rows = [inputHTML(species.prevo || '', 'prevo', 'From'), '<div class="textbox dexchipbox dexevobox">' + this.dexEvoChipsHTML(species.evos || []) + '</div>'];
			buf += '<div class="setcol setcol-moves"><div class="setcell"><label>Evolves</label>';
			for (var m = 0; m < rows.length; m++) {
				if (m) buf += '<div class="setcell">';
				buf += (editable ? rows[m] : fieldHTML(BattleLog.escapeHTML(rows[m]))) + '</div>';
			}
			buf += '<div class="setcell setcell-learnset"><label class="dexlearnsetlabel">Learnset</label><input type="text" class="textbox dexfield learnsetcount" name="listsearch" placeholder="Moves" autocomplete="off" /></div>';
			buf += '</div>';

			buf += '<div class="setcol setcol-stats"><div class="setrow"><label>Stats</label><button class="textbox setstats" tabindex="-1" name="showDexStats">';
			buf += '<span class="statrow statrow-head"><label></label> <span class="statgraph"></span> <em>Base</em></span>';
			var bst = 0;
			for (var stat in BattleStatNames) {
				var value = species.baseStats[stat];
				bst += value;
				var width = Math.min(value * 75 / 255, 75);
				var color = Math.min(Math.floor(value * 180 / 255), 360);
				buf += '<span class="statrow"><label>' + BattleStatNames[stat] + '</label> <span class="statgraph"><span style="width:' + width + 'px;background:hsl(' + color + ',40%,75%);"></span></span> <em>' + value + '</em></span>';
			}
			buf += '</button></div></div>';
			buf += '</div></li></ol></div>';
			buf += '<div class="teambuilder-results" data-panel="list"></div><div class="teambuilder-results" data-panel="picker"></div>';
			if (editable) buf += '<div class="teambuilder-results" data-panel="field"></div>';
			buf += '<div class="dexstatresults" data-panel="stats" style="display:none">' + this.dexStatsHTML(species, bst) + '</div>';
			buf += '<div class="dexstatresults dexeffectpanel" data-panel="details" style="display:none">' + this.dexDetailsHTML() + '</div>';
			this.dexSpeciesBST = bst;
			this.$('.dexmonpage').html('<div class="teamwrapper">' + buf + '</div>');

			var search = this.dexListSearch = DexViews.ui.panelSearch(this.$('.dexmonpage [data-panel=list]'));
			var room = this;
			DexViews.ui.rowClasses(search, function (id, type) {
				return type !== 'move' ? '' : (room.dexMoveEdited(id) ? ' dexedited' : '') + (room.dexEditable && room.dexLearnset[id] ? ' cur' : '');
			});
			this.markDexEdits();
			this.setDexLearnsetList();
			this.updateDexLearnsetCount();
			this.showDexMonPanel(picked ? 'picker' : 'list', true);
			this.scaleDex();
		},
		setDexLearnsetList: function () {
			var search = this.dexListSearch;
			var dexView = this.dexView;
			var species = this.dexSpecies;
			var editable = this.dexEditable;
			var own = this.dexLearnset = {};
			var learnset = DexViews.learnsetOf(dexView, species.id) || {};
			for (var id in learnset) {
				if (learnset[id]) own[id] = 1;
			}
			viewSearch(search, dexView, function (typedSearch, searchType) {
				if (searchType !== 'move') return;
				var getBaseResults = typedSearch.getBaseResults;
				typedSearch.getBaseResults = function () {
					var entries = DexViews.entries[dexView.dexid];
					var learned = [];
					var inherited = [];
					var others = [];
					var seen = {};
					var rows = getBaseResults.call(this);
					for (var i = 0; i < rows.length; i++) {
						if (rows[i][0] !== 'move' || seen[rows[i][1]] || entries && !entries.Moves[rows[i][1]]) continue;
						seen[rows[i][1]] = 1;
						(own[rows[i][1]] ? learned : inherited).push(rows[i]);
					}
					var ids = editable ? Object.keys(BattleMovedex).concat(Object.keys(dexView.Moves)) : [];
					for (var j = 0; j < ids.length; j++) {
						var move = this.dex.moves.get(ids[j]);
						if (!move.exists || move.isMax || move.isZ || seen[move.id] || entries && !entries.Moves[move.id]) continue;
						seen[move.id] = 1;
						others.push(['move', move.id]);
					}
					return DexViews.ui.learnRows(["Learnset", "Other moves"], learned, inherited, others, editable);
				};
			});
			search.setType('move', 'gen' + dexView.gen + 'ag', { species: species.name, moves: [] });
			var query = $.trim(this.$('.dexmonpage input[name=listsearch]').val() || '');
			if (query) search.find(query);
		},
		dexEditsHTML: function () {
			var on = !!Storage.prefs('dexshowedits');
			return ' <button name="toggleDexEdits"><i class="fa fa-' + (on ? 'eye-slash' : 'eye') + '"></i>' + (on ? 'Hide' : 'Show') + ' edits</button>';
		},
		toggleDexEdits: function () {
			Storage.prefs('dexshowedits', !Storage.prefs('dexshowedits'));
			var self = this;
			this.$('button[name=toggleDexEdits]').replaceWith(self.dexEditsHTML());
			this.markDexEdits();
		},
		dexSpeciesBase: function () {
			var species = this.dexSpecies;
			var entries = species && DexViews.entries[this.dexView.dexid];
			if (!entries) return null;
			var original = entries.originals[species.id];
			if (original === null) return null;
			if (!original) {
				var saved = this.dexBaseView || this.dexView;
				return { species: saved.dex.species.get(species.id), learnset: DexViews.learnsetOf(saved, species.id) || {} };
			}
			var learnset = {};
			for (var i = 0; i < original.learnset.length; i++) learnset[original.learnset[i]] = 1;
			return { species: new window.Species(species.id, original.name, original), learnset: learnset };
		},
		dexSpeciesChanged: function (keys) {
			var base = this.dexEditBase;
			if (!base || !this.dexSpecies) return false;
			var species = this.dexView.dex.species.get(this.dexSpecies.id);
			return keys.some(function (key) { return DexViews.ui.changedValue(species[key], base.species[key]); });
		},
		markDexEdits: function () {
			this.$el.toggleClass('dexshowedits', !!Storage.prefs('dexshowedits'));
			var $page = this.$('.dexmonpage');
			$page.find('.dexedited').removeClass('dexedited');
			if (this.dexEffect) return this.markDexEffectEdits();
			var base = this.dexEditBase = this.dexSpeciesBase();
			$page.find('button[name=toggleDexEdits]').toggle(!!base);
			if (!base) return;
			var self = this;
			var species = this.dexView.dex.species.get(this.dexSpecies.id);
			var was = base.species;
			var changed = DexViews.ui.changedValue;
			var mark = function ($el, edited) {
				if (edited) $el.addClass('dexedited');
			};
			$page.find('.setcell-typeicons').children().each(function (t) {
				mark($(this), changed(species.types[t], was.types[t]));
			});
			var slots = abilitySlotsOf(species);
			$page.find('.dexabilitybox .dexchip').each(function (i) {
				mark($(this), !!slots[i] && changed(slots[i][1], was.abilities[slots[i][0]]));
			});
			mark($page.find('.dexabilitybox'), abilitySlotsOf(was).some(function (entry) { return !species.abilities[entry[0]]; }));
			$page.find('.setrow-abilities > .setcell > .dexfield').each(function (i) {
				mark($(this), changed(species.abilities[['0', '1', 'H', 'S'][i]], was.abilities[['0', '1', 'H', 'S'][i]]));
			});
			var evos = species.evos || [];
			var wasEvos = was.evos || [];
			var $evolves = $page.find('.setcol-moves > .setcell');
			mark($evolves.eq(0).children('.dexfield'), changed(species.prevo, was.prevo));
			mark($evolves.eq(1).children('.dexfield'), changed(evos, wasEvos));
			$page.find('.dexevobox .dexchip').each(function (i) {
				mark($(this), wasEvos.indexOf(evos[i]) < 0);
			});
			mark($page.find('.dexevobox'), wasEvos.some(function (evo) { return evos.indexOf(evo) < 0; }));
			var moves = this.dexEditMoves = DexViews.learnsetOf(this.dexView, species.id) || {};
			mark($page.find('.learnsetcount'), Object.keys(moves).concat(Object.keys(base.learnset)).some(function (id) {
				return !moves[id] !== !base.learnset[id];
			}));
			var cells = [['gender', 'genderRatio'], ['weightkg'], ['heightm'], []];
			$page.find('[data-panel=details] .dexsentence').each(function () {
				var key = this.getAttribute('data-detail');
				mark($(this), self.dexSpeciesChanged(key === 'gender' ? ['gender', 'genderRatio'] : [key]));
			});
			var hidden = ['eggGroups', 'color', 'tags', 'evoType', 'evoLevel', 'evoItem', 'evoMove', 'evoCondition'];
			if (this.dexSpeciesChanged(hidden)) {
				mark($page.find('.setdetails'), true);
			} else {
				$page.find('.setdetails .detailcell').each(function (i) {
					mark($(this), self.dexSpeciesChanged(cells[i]));
				});
			}
			Object.keys(BattleStatNames).forEach(function (stat, i) {
				var edited = changed(species.baseStats[stat], was.baseStats[stat]);
				mark($page.find('.setstats'), edited);
				mark($page.find('input[name=stat-' + stat + ']'), edited);
				mark($page.find('.basestatscol > div').eq(i + 1).children('b'), edited);
			});
			$page.find('[data-panel=list] a[data-entry^="move|"]').each(function () {
				mark($(this), self.dexMoveEdited(toID(this.dataset.entry.slice(5))));
			});
		},
		dexMoveEdited: function (id) {
			var base = this.dexEditBase;
			return !!base && !this.dexEditMoves[id] !== !base.learnset[id];
		},
		dexAbilityChipsHTML: function (entries) {
			return entries.map(function (entry, i) {
				return '<span class="dexchip" draggable="true" data-index="' + i + '"><small>' + entry[0] + ':</small> ' + BattleLog.escapeHTML(entry[1]) +
					' <button class="dexchipx" name="removeDexAbility" value="' + BattleLog.escapeHTML(entry[1]) + '" tabindex="-1">&times;</button></span>';
			}).join('') + '<input type="text" class="chartinput dexchipinput" name="abilities"' + (entries.length ? '' : ' placeholder="Abilities"') + ' autocomplete="off" />';
		},
		dexEvoChipsHTML: function (evos) {
			return evos.map(function (evo) {
				return '<span class="dexchip">' + BattleLog.escapeHTML(evo) + ' <button class="dexchipx" name="removeDexEvo" value="' + BattleLog.escapeHTML(evo) + '" tabindex="-1">&times;</button></span>';
			}).join('') + '<input type="text" class="chartinput dexchipinput" name="evos"' + (evos.length ? '' : ' placeholder="Into"') + ' autocomplete="off" />';
		},
		updateDexLearnsetCount: function (entriesLoaded) {
			var view = this.dexView;
			var species = this.dexSpecies;
			if (!species) return;
			if (!DexViews.entries[view.dexid]) return DexViews.loadEntries(view.dexid);
			this.markDexEdits();
			var $results = $('<div></div>');
			var search = new BattleSearch($results, $results);
			viewSearch(search, view);
			search.setType('move', 'gen' + view.gen + 'ag', { species: species.name, moves: [] });
			var count = search.engine.results.filter(function (row) { return row[0] === 'move'; }).length;
			this.$('.dexmonpage .dexlearnsetlabel').text('Learnset (' + count + ')');
			if (entriesLoaded) this.setDexLearnsetList();
		},
		closeDexPokemon: function (value, button) {
			if (button) return this.leaveDex(button, function () { this.closeDexPokemon(); });
			this.dexSpecies = null;
			this.dexEffect = null;
			this.$('.dexmonpage').hide().empty();
			this.$('.dexpage').show();
			if (this.dexSearch && this.dexSearchView !== this.dexView) this.setupDexSearch(this.dexView);
			this.dexScroller().scrollTop(this.dexScrollTop || 0);
		},
		dexDetailsHTML: function () {
			var species = this.dexSpecies;
			var editable = this.dexEditable;
			if (this.dexDetailsFor !== species.id) {
				this.dexDetailsFor = species.id;
				this.dexAddedDetails = {};
				this.dexDetailList = false;
			}
			var added = this.dexAddedDetails;
			var shown = function (key) {
				return ALWAYS_DETAILS.indexOf(key) >= 0 || added[key] || detailValue(species, key) !== '';
			};
			if (this.dexDetailList) {
				var rows = DETAILS.filter(function (detail) { return !shown(detail[0]); }).map(function (detail) {
					return DexViews.ui.sentenceRowHTML('detail|' + detail[0], detail[1], detail[2]);
				});
				return '<div class="dexattrlist">' + DexViews.ui.chartHTML([['', rows]], "No more attributes to add.") + '</div>';
			}
			var boxes = DETAILS.filter(function (detail) { return shown(detail[0]); }).map(function (detail) {
				var removable = editable && ALWAYS_DETAILS.indexOf(detail[0]) < 0;
				var parts = detail[2].split('___');
				return '<div class="dexsentence" data-detail="' + detail[0] + '">' +
					(removable ? '<button class="button dexremoveattr" name="removeDexDetail" value="' + detail[0] + '" title="Remove"><i class="fa fa-times"></i></button>' : '') +
					'<label class="dexsentencehead">' + detail[1] + '</label>' + parts[0] + detailHTML(species, detail[0], editable) + parts[1] + '</div>';
			}).join('');
			var data = this.dexView.Pokedex[species.id] || {};
			var origin = this.dexView.origins[species.id];
			$.each([["Origin", origin], ["Category", data.category && 'The ' + data.category + ' Pok\u00e9mon'], ["Dex entry", data.dexEntry]], function (i, info) {
				if (info[1]) boxes += '<div class="dexsentence"><label class="dexsentencehead">' + info[0] + '</label>' + BattleLog.escapeHTML(info[1]) + '</div>';
			});
			var buf = '<div class="pad"><div class="dexfieldsection dexeffectfields">' + boxes + '</div>';
			if (editable) buf += '<p><button class="button" name="showDexDetailList"><i class="fa fa-plus"></i> New attribute</button></p>';
			return buf + '</div>';
		},
		showDexPanel: function (panel) {
			this.dexPanel = panel;
			this.$('.dexmonpage [data-panel]').each(function () {
				$(this).toggle(this.dataset.panel === panel);
			});
			if (panel === 'picker' && !this.dexPicker) this.setupDexPicker();
			var search = { list: this.dexListSearch, picker: this.dexPicker }[panel];
			if (search) search.updateScroll();
		},
		showDexMonPanel: function (panel, keep) {
			if (!keep && panel === this.dexPanel) panel = 'list';
			this.showDexPanel(panel);
			this.$('.dexmonpage .setstats').toggleClass('cur', panel === 'stats');
			this.$('.dexmonpage .setdetails').toggleClass('cur', panel === 'details');
		},
		showDexDetails: function () {
			this.dexDetailList = false;
			this.$('.dexmonpage [data-panel=details]').html(this.dexDetailsHTML());
			this.markDexEdits();
			this.showDexMonPanel('details');
		},
		dexStatsHTML: function (species, bst) {
			var buf = '<div class="resultheader"><h3>Stats</h3></div><div class="statform">';
			var rows = { label: '<div></div>', base: '<div><em>Base</em></div>', slider: '<div></div>', min: '<div><em>Min</em></div>', max: '<div><em>Max</em></div>' };
			for (var stat in BattleStatNames) {
				var base = species.baseStats[stat];
				var color = Math.min(Math.floor(base * 180 / 255), 360);
				rows.label += '<div><label>' + BattleStatNames[stat] + '</label></div>';
				rows.base += this.dexEditable ? '<div><input type="number" name="stat-' + stat + '" value="' + base + '" min="0" max="255" class="textbox inputform numform" /></div>' :
					'<div><b>' + base + '</b></div>';
				rows.slider += '<div><input type="range" value="' + base + '" min="0" max="255" class="evslider"' +
					(this.dexEditable ? ' name="statslider-' + stat + '"' : ' tabindex="-1" aria-hidden="true"') + ' style="--fill:hsl(' + color + ',85%,45%);--pct:' + (base * 100 / 255) + '%" /></div>';
				rows.min += '<div><b class="dexmin-' + stat + '">' + (stat === 'hp' ? 2 * base + 110 : Math.floor((2 * base + 5) * 0.9)) + '</b></div>';
				rows.max += '<div><b class="dexmax-' + stat + '">' + (stat === 'hp' ? 2 * base + 204 : Math.floor((2 * base + 99) * 1.1)) + '</b></div>';
			}
			rows.label += '<div><label>Total</label></div>';
			rows.base += '<div><b class="dexbst">' + bst + '</b></div>';
			buf += '<div class="col labelcol">' + rows.label + '</div><div class="col ' + (this.dexEditable ? 'evcol' : 'basestatscol') + '">' + rows.base + '</div>';
			buf += '<div class="col evslidercol">' + rows.slider + '</div><div class="col">' + rows.min + '</div><div class="col">' + rows.max + '</div>';
			return buf + '<div style="clear:both"></div></div>';
		},
		showDexStats: function () {
			this.showDexMonPanel('stats');
		},
		dexStandardSprite: function (kind) {
			if (!hasStandardSprites(this.dexSpecies.id)) return null;
			var dex = Object.getPrototypeOf(Dex);
			if (kind === 'icon') {
				return { size: '40&times;30', html: '<span class="dexiconpreview"><span class="picon" style="' + dex.getPokemonIcon.call(Dex, this.dexSpecies.name) + '"></span></span>' };
			}
			var data = dex.getSpriteData.call(Dex, this.dexSpecies.name, kind.slice(0, 5) === 'front', {
				gen: this.dexView.dex.gen, shiny: kind.indexOf('shiny') >= 0, noScale: true
			});
			return {
				size: data.w + '&times;' + data.h,
				html: '<img src="' + data.url + '" width="' + data.w * 2 + '" height="' + data.h * 2 + '" alt="' + kind + '"' + (data.pixelated ? ' class="pixelated"' : '') + ' />'
			};
		},
		copyDexPokemon: function (value, button) {
			app.addPopup(DexCopyPopup, { room: this, kind: 'pokemon', name: this.dexSpecies.name, line: this.dexFamilySize > 1, sourceEl: button });
		}
	});

	document.addEventListener('wheel', function (e) {
		var box = e.target.closest && e.target.closest('.dexmonchart .dexfield, .dexmonchart .dexchipbox');
		if (!box || e.deltaX || e.shiftKey || box.scrollWidth <= box.clientWidth) return;
		var before = box.scrollLeft;
		box.scrollLeft += e.deltaY * (e.deltaMode ? 16 : 1);
		if (box.scrollLeft !== before) e.preventDefault();
	}, { passive: false });

})(window.jQuery);
