(function ($) {

	var DexViews = window.DexViews;
	var DexConfirmPopup = DexViews.ui.DexConfirmPopup;
	var HIDE_BUTTON = DexViews.ui.HIDE_BUTTON;
	var viewSearch = DexViews.ui.viewSearch;

	function editableDexes() {
		return DexViews.list.filter(function (summary) {
			return !summary.official && DexViews.ui.canEdit(summary);
		});
	}

	var SHINY_STAR = '<span class="shinystar"><i class="fa fa-star"></i><span>';
	var SPRITE_CELLS = [
		['front', 'F'], ['back', 'B'], ['front-shiny', SHINY_STAR + 'F</span></span>'], ['back-shiny', SHINY_STAR + 'B</span></span>'], ['icon', 'I']
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

	function hasStandardSprites(id) {
		return !!(window.BattlePokedex && BattlePokedex[id]) && !DexViews.custom.Pokedex[id];
	}

	var DexForkPopup = Popup.extend({
		type: 'semimodal',
		initialize: function (data) {
			this.callback = data.callback;
			var buf = '<form class="dexcreate"><p><label class="label">Fork ' + BattleLog.escapeHTML(data.name) + (data.line ? '\'s evolution line' : '') + ' into:<br /><select name="target" class="button">';
			for (var i = 0; i < data.targets.length; i++) {
				var target = data.targets[i];
				buf += '<option value="' + BattleLog.escapeHTML(target.id) + '"' + (target.id === data.target ? ' selected' : '') + '>' + BattleLog.escapeHTML(target.name) + '</option>';
			}
			buf += '</select></label></p>';
			buf += '<p class="buttonbar"><button type="submit" class="button"><strong>Fork</strong></button> <button type="button" name="close" class="button">Cancel</button></p></form>';
			this.$el.html(buf);
		},
		submit: function (data) {
			this.close();
			this.callback(data.target);
		}
	});

	DexViews.ui.abilitySlotsOf = abilitySlotsOf;

	_.extend(RoomsRoom.prototype, {
		openDexPokemon: function (name) {
			var view = DexViews.current = this.dexView;
			var species = view.dex.species.get(name);
			if (!view.species[species.id]) return;
			if (this.$('.dexpage').is(':visible')) this.dexScrollTop = this.dexScroller().scrollTop();
			this.dexSpecies = species;
			this.dexEffect = null;
			this.$('.dexsearchpage, .dexpage').hide();
			this.$('.dexmonpage').show();
			this.dexScroller().scrollTop(0);

			var editable = this.dexEditable;
			var buf = '<div class="pad">';
			buf += (editable ? '' : HIDE_BUTTON) + '<button name="closeDexPokemon" class="button"><i class="fa fa-chevron-left"></i> ' + (editable ? 'Pok&eacute;mon' : 'Dex') + '</button></div>';
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
				buf += this.dexEditsHTML() + ' ';
				if (family.length > 1) buf += '<button name="forkLine" value="' + BattleLog.escapeHTML(species.name) + '"><i class="fa fa-code-fork"></i>Fork evo line</button> ';
				buf += '<button name="forkSpecies" value="' + BattleLog.escapeHTML(species.name) + '"><i class="fa fa-code-fork"></i>Fork</button></div>';
			}
			var sprites = view.sprites[species.id] || {};
			var standard = hasStandardSprites(species.id);
			buf += '<div class="setchart-nickname"><label>Sprites</label><div class="textbox spritebox">';
			for (var j = 0; j < SPRITE_CELLS.length; j++) {
				var kind = SPRITE_CELLS[j][0];
				buf += '<button class="spritecell ' + (standard || sprites[kind] && view.images[sprites[kind]] ? 'has' : 'missing') + '" name="showDexSprite" value="' + kind + '">' + SPRITE_CELLS[j][1] + '</button>';
			}
			buf += '</div></div>';
			var spriteData = Dex.getTeambuilderSpriteData({ species: species.name }, view.dex);
			buf += '<div class="setchart dexmonchart' + (spriteData.pixelated ? ' pixelated' : '') + '" style="' + Dex.getTeambuilderSprite({ species: species.name }, view.dex) + ';">';

			buf += '<div class="setcol setcol-icon"><div class="setcell-sprite"></div>';
			buf += '<div class="setcell setcell-pokemon"><label>Pok&eacute;mon</label><input type="text" class="textbox dexfield" name="monsearch" value="' + BattleLog.escapeHTML(species.name) + '" autocomplete="off" /></div></div>';

			var ratio = species.genderRatio;
			buf += '<div class="setcol setcol-details"><div class="setrow">';
			buf += '<div class="setcell setcell-details"><label>Details</label><button class="textbox setdetails" tabindex="-1" name="showDexDetails">';
			buf += '<span class="detailcell detailcell-first"><label>Gender</label>' +
				(species.gender ? { M: 'Male', F: 'Female', N: '&mdash;' }[species.gender] : ratio ? (ratio.M * 100) + '% M' : '50% M') + '</span>';
			buf += '<span class="detailcell"><label>Weight</label>' + (species.weightkg || '&mdash;') + ' kg</span>';
			buf += '<span class="detailcell"><label>Height</label>' + (species.heightm || '&mdash;') + ' m</span>';
			var origin = view.origins[species.id];
			buf += '<span class="detailcell"><label>' + (origin ? 'Origin' : 'Egg') + '</label>' + BattleLog.escapeHTML(origin || (species.eggGroups || [])[0] || '\u2014') + '</span>';
			buf += '</button></div></div>';
			buf += '<div class="setrow setrow-icons"><div class="setcell"><span class="itemicon"></span></div><div class="setcell setcell-typeicons' + (editable ? ' dextypeselects' : '') + '">';
			if (editable) {
				var typeNames = view.dex.types.names().filter(function (name) { return view.dex.types.get(name).exists !== false; });
				for (var t = 0; t < 2; t++) {
					var current = species.types[t] || '';
					var other = species.types[1 - t];
					buf += '<span class="dextypeslot" title="Change ' + (t ? 'secondary' : 'primary') + ' type">' +
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
				for (var k = 0; k < species.types.length; k++) buf += Dex.getTypeIcon(species.types[k]);
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
			buf += '<div class="setcell setcell-learnset"><label class="dexlearnsetlabel">Learnset</label><input type="text" class="textbox dexfield learnsetcount" name="movesearch" placeholder="Moves" autocomplete="off" /></div>';
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
			buf += '<div class="teambuilder-results"></div>';
			buf += '<div class="dexstatresults" style="display:none">' + this.dexStatsHTML(species, bst) + '</div>';
			this.dexSpeciesBST = bst;
			this.$('.dexmonpage').html('<div class="teamwrapper">' + buf + '</div>');

			var $results = this.$('.teambuilder-results');
			var search = this.dexPokemonSearch = new BattleSearch($results, $results);
			var room = this;
			search.renderRow = function (id, type, matchStart, matchLength, errorMessage, attrs) {
				var classes = type !== 'move' ? '' : (room.dexMoveEdited(id) ? ' dexedited' : '') + (room.dexEditable && room.dexLearnset[id] ? ' cur' : '');
				if (classes) attrs = attrs ? attrs.replace('class="', 'class="' + classes.slice(1) + ' ') : ' class="' + classes.slice(1) + '"';
				return BattleSearch.prototype.renderRow.call(this, id, type, matchStart, matchLength, errorMessage, attrs);
			};
			this.markDexEdits();
			$results.on('scroll', function () {
				search.updateScroll();
			});
			this.setDexLearnsetList();
			this.updateDexLearnsetCount();
			this.scaleDexPokemon();
		},
		setDexLearnsetList: function () {
			var search = this.dexPokemonSearch;
			var dexView = this.dexView;
			var species = this.dexSpecies;
			var editable = this.dexEditable;
			this.dexEditField = null;
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
					$.each([learned, inherited, others], function (k, list) {
						list.sort(function (a, b) { return a[1] < b[1] ? -1 : 1; });
					});
					var results = [['header', "Learnset (" + learned.length + ")"]].concat(learned);
					if (inherited.length) results = results.concat([['header', "From pre-evolutions (" + inherited.length + ")"]], inherited);
					return editable ? results.concat([['header', "Other moves"]], others) : results;
				};
			});
			search.setType('move', 'gen' + dexView.gen + 'ag', { species: species.name, moves: [] });
			var query = $.trim(this.$('.dexmonpage input[name=movesearch]').val() || '');
			if (query) search.find(query);
		},
		dexEditsHTML: function () {
			var on = !!Storage.prefs('dexshowedits');
			return ' <button name="toggleDexEdits"><i class="fa fa-' + (on ? 'eye-slash' : 'eye') + '"></i>' + (on ? 'Hide' : 'Show') + ' edits</button>';
		},
		toggleDexEdits: function () {
			Storage.prefs('dexshowedits', !Storage.prefs('dexshowedits'));
			var self = this;
			$.each([app.rooms.rooms, app.rooms.dexbuilder], function (i, room) {
				if (!room || !room.markDexEdits) return;
				room.$('button[name=toggleDexEdits]').replaceWith(self.dexEditsHTML());
				room.markDexEdits();
			});
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
			var origin = this.dexView.origins[species.id];
			var cells = [['gender', 'genderRatio'], ['weightkg'], ['heightm'], origin ? [] : ['eggGroups']];
			var hidden = ['color', 'tags', 'evoType', 'evoLevel', 'evoItem', 'evoMove', 'evoCondition'].concat(origin ? ['eggGroups'] : []);
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
			$page.find('.teambuilder-results a[data-entry^="move|"]').each(function () {
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
			if (entriesLoaded && !this.dexEditField) this.setDexLearnsetList();
		},
		scaleDexPokemon: function () {
			var $teamwrapper = this.$('.dexmonpage .teamwrapper');
			var width = this.dexScroller().width();
			if (!$teamwrapper.length || !width) return;
			if (width < 640) {
				var scale = width / 640;
				$teamwrapper.css({ transform: 'scale(' + scale + ')', width: '640px', height: (this.dexScroller().height() / scale) + 'px' });
			} else {
				$teamwrapper.css({ transform: '', width: '', height: '' });
			}
		},
		closeDexPokemon: function () {
			this.dexSpecies = null;
			this.dexEffect = null;
			this.$('.dexmonpage').hide().empty();
			this.$('.dexpage').show();
			this.dexScroller().scrollTop(this.dexScrollTop || 0);
		},
		focusDexMonSearch: function (e) {
			e.currentTarget.select();
			if (this.dexEditField === 'monsearch') return;
			this.dexEditField = 'monsearch';
			this.$('.dexmonpage .dexstatresults').hide();
			this.$('.dexmonpage .teambuilder-results').show();
			this.$('.dexmonpage .setstats').removeClass('cur');
			var dexid = this.dexid;
			viewSearch(this.dexPokemonSearch, this.dexView, function (typedSearch) {
				typedSearch.dexid = dexid;
			});
			this.dexPokemonSearch.setType('pokemon', 'gen' + this.dexView.gen);
		},
		searchDexMonSearch: function (e) {
			if (this.dexEditField !== 'monsearch') this.focusDexMonSearch(e);
			this.dexPokemonSearch.find($.trim(e.currentTarget.value));
		},
		focusDexMoveSearch: function () {
			if (this.dexEditField || this.$('.dexmonpage .dexstatresults').is(':visible')) this.showDexLearnset();
		},
		searchDexMoveSearch: function (e) {
			if (this.dexEditField || this.$('.dexmonpage .dexstatresults').is(':visible')) this.showDexLearnset();
			this.dexPokemonSearch.find($.trim(e.currentTarget.value));
		},
		blurDexMonSearch: function (e) {
			if (this.dexSpecies) e.currentTarget.value = this.dexSpecies.name;
		},
		clickDexMove: function (e) {
			e.preventDefault();
			if (this.dexEffect) return this.clickDexEffectEntry(e);
			var entry = e.currentTarget.dataset.entry.split('|');
			if (entry[0] === 'move') this.openDexEffect('Moves', entry[1], this.dexSpecies && this.dexSpecies.name);
			if (entry[0] === 'pokemon') this.openDexPokemon(entry[1]);
		},
		showDexDetails: function () {
			var species = this.dexSpecies;
			var data = this.dexView.Pokedex[species.id] || {};
			var ratio = species.genderRatio;
			var self = this;
			var field = function (label, value, keys) {
				return '<tr' + (keys && self.dexSpeciesChanged(keys) ? ' class="dexedited"' : '') + '><th>' + label + '</th><td>' +
					(value === undefined || value === null || value === '' ? '&mdash;' : value) + '</td></tr>';
			};
			var divider = '<tr class="divider"><td colspan="2"><hr /></td></tr>';
			var buf = '<table class="dexdetails' + (Storage.prefs('dexshowedits') ? ' dexshowedits' : '') + '">';
			buf += field('Weight', species.weightkg && species.weightkg + ' kg', ['weightkg']);
			buf += field('Height', species.heightm && species.heightm + ' m', ['heightm']);
			buf += field('Gender', species.gender, ['gender']);
			buf += field('Gender ratio', ratio && (ratio.M * 100) + '% male, ' + (ratio.F * 100) + '% female', ['genderRatio']);
			buf += field('Egg Groups', BattleLog.escapeHTML((species.eggGroups || []).join(', ')), ['eggGroups']);
			buf += field('Origin', BattleLog.escapeHTML(this.dexView.origins[species.id] || ''));
			buf += divider;
			buf += field('Tags', BattleLog.escapeHTML((species.tags || []).join(', ')), ['tags']);
			buf += divider;
			buf += field('Evo type', BattleLog.escapeHTML(species.evoType || ''), ['evoType']);
			buf += field('Evo level', species.evoLevel || '', ['evoLevel']);
			buf += field('Evo condition', BattleLog.escapeHTML(species.evoCondition || ''), ['evoCondition']);
			buf += divider;
			buf += field('Color', BattleLog.escapeHTML(species.color || ''), ['color']);
			buf += field('Category', data.category && 'The ' + BattleLog.escapeHTML(data.category) + ' Pok&eacute;mon');
			buf += field('Dex entry', BattleLog.escapeHTML(data.dexEntry || ''));
			buf += field('Base stat total', this.dexSpeciesBST);
			buf += '</table>';
			app.addPopup(Popup, { htmlMessage: buf, sourceEl: app.dispatchingButton, maxWidth: 400 });
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
			this.showDexLearnset(!this.$('.dexmonpage .dexstatresults').is(':visible'));
		},
		showDexLearnset: function (stats) {
			stats = stats === true;
			this.$('.dexmonpage .dexstatresults').toggle(stats);
			this.$('.dexmonpage .teambuilder-results').toggle(!stats);
			this.$('.dexmonpage .setstats').toggleClass('cur', stats);
			if (this.dexEditField === 'monsearch') this.setDexLearnsetList();
		},
		showDexSprite: function (kind) {
			var uploadid = (this.dexView.sprites[this.dexSpecies.id] || {})[kind];
			var image = uploadid && this.dexView.images[uploadid];
			if (!image && hasStandardSprites(this.dexSpecies.id)) {
				var dex = Object.getPrototypeOf(Dex);
				var sprite = '<span class="dexiconpreview"><span class="picon" style="' + dex.getPokemonIcon.call(Dex, this.dexSpecies.name) + '"></span></span>';
				var size = '40&times;30';
				if (kind !== 'icon') {
					var data = dex.getSpriteData.call(Dex, this.dexSpecies.name, kind.slice(0, 5) === 'front', {
						gen: this.dexView.dex.gen, shiny: kind.indexOf('shiny') >= 0, noScale: true
					});
					sprite = '<img src="' + data.url + '" width="' + data.w * 2 + '" height="' + data.h * 2 + '" alt="' + kind + '"' + (data.pixelated ? ' class="pixelated"' : '') + ' />';
					size = data.w + '&times;' + data.h;
				}
				app.addPopup(Popup, {
					htmlMessage: '<strong>' + kind + '</strong> <small>(' + size + ')</small>\n' + sprite,
					sourceEl: app.dispatchingButton
				});
				return;
			}
			if (!image) {
				app.addPopup(Popup, { message: "No " + kind + " sprite.", sourceEl: app.dispatchingButton });
				return;
			}
			app.addPopup(Popup, {
				htmlMessage: '<strong>' + kind + '</strong> <small>(' + image.width + '&times;' + image.height + ')</small>\n' +
					'<img src="' + Dex.resourcePrefix + 'sprites/custom/' + BattleLog.escapeHTML(image.file) + '" width="' + image.width * 2 + '" height="' + image.height * 2 + '" alt="' + kind + '"' +
					(image.pixelated ? ' class="pixelated"' : '') + ' />' +
					(image.artist ? '\n<small>by ' + BattleLog.escapeHTML(image.artist) + '</small>' : ''),
				sourceEl: app.dispatchingButton
			});
		},
		forkSpecies: function (name, button) {
			this.forkInto(name, false, button);
		},
		forkLine: function (name, button) {
			this.forkInto(name, true, button);
		},
		forkInto: function (name, line, button, kind) {
			var room = this;
			var source = this.dexSummary;
			var targets = editableDexes().filter(function (dex) { return dex.id !== source.id && dex.parents.indexOf(source.id) < 0; });
			var send = function (target) {
				room.forkTarget = target;
				app.send(line ? '/crq dexforkline ' + target + ', ' + source.id + ', ' + name : '/crq dexfork ' + target + ', ' + source.id + ', ' + (kind || 'pokemon') + ', ' + name);
			};
			if (!targets.length) {
				app.addPopup(DexConfirmPopup, {
					message: "You don't have a dex to fork " + BattleLog.escapeHTML(name) + " into yet.",
					button: "Open Dexbuilder",
					sourceEl: button,
					callback: function () { app.joinRoom('dexbuilder', window.DexBuilderRoom); }
				});
				return;
			}
			app.addPopup(DexForkPopup, { name: name, line: line, targets: targets, target: this.forkTarget, sourceEl: button, callback: send });
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
