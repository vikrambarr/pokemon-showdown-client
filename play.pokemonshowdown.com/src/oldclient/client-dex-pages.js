(function ($) {

	var DexViews = window.DexViews;
	var request = DexViews.ui.request;
	var DexConfirmPopup = DexViews.ui.DexConfirmPopup;
	var HIDE_BUTTON = DexViews.ui.HIDE_BUTTON;
	var viewSearch = DexViews.ui.viewSearch;

	function editableDexes() {
		return DexViews.list.filter(function (summary) {
			return !summary.official && DexViews.ui.canEdit(summary);
		});
	}

	var MOVE_TARGETS = {
		normal: "Adjacent", any: "Any", self: "Self", adjacentAlly: "Adjacent ally", adjacentAllyOrSelf: "Ally or self",
		adjacentFoe: "Adjacent foe", allAdjacent: "All adjacent", allAdjacentFoes: "Adjacent foes", allies: "Allies",
		allySide: "Ally side", foeSide: "Foe side", all: "Field", randomNormal: "Random foe", scripted: "Scripted"
	};

	var SPRITE_CELLS = [['front', 'F'], ['back', 'B'], ['front-shiny', 'F*'], ['back-shiny', 'B*'], ['icon', 'I']];

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

	_.extend(RoomsRoom.prototype, {
		openDexPokemon: function (name) {
			var view = DexViews.current = this.dexView;
			var species = view.dex.species.get(name);
			if (!view.species[species.id]) return;
			if (this.$('.dexpage').is(':visible')) this.dexScrollTop = this.dexScroller().scrollTop();
			this.dexSpecies = species;
			this.dexMove = null;
			this.$('.dexsearchpage, .dexpage').hide();
			this.$('.dexmonpage').show();
			this.dexScroller().scrollTop(0);

			var buf = '<div class="pad">';
			buf += HIDE_BUTTON + '<button name="closeDexPokemon" class="button"><i class="fa fa-chevron-left"></i> Dex</button></div>';
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
			if (family.length > 1) buf += '<button name="forkLine" value="' + BattleLog.escapeHTML(species.name) + '"><i class="fa fa-code-fork"></i>Fork evo line</button> ';
			buf += '<button name="forkSpecies" value="' + BattleLog.escapeHTML(species.name) + '"><i class="fa fa-code-fork"></i>Fork</button></div>';
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
			buf += '<div class="setcell setcell-pokemon"><label>Pok&eacute;mon</label><input type="text" class="textbox" readonly value="' + BattleLog.escapeHTML(species.name) + '" /></div></div>';

			var ratio = species.genderRatio;
			buf += '<div class="setcol setcol-details"><div class="setrow">';
			buf += '<div class="setcell setcell-details"><label>Details</label><button class="textbox setdetails" tabindex="-1" name="showDexDetails">';
			buf += '<span class="detailcell detailcell-first"><label>Gender</label>' +
				(species.gender ? { M: 'Male', F: 'Female', N: '&mdash;' }[species.gender] : ratio ? (ratio.M * 100) + '% M' : '50% M') + '</span>';
			buf += '<span class="detailcell"><label>Weight</label>' + (species.weightkg || '&mdash;') + ' kg</span>';
			buf += '<span class="detailcell"><label>Height</label>' + (species.heightm || '&mdash;') + ' m</span>';
			buf += '<span class="detailcell"><label>Egg</label>' + BattleLog.escapeHTML((species.eggGroups || [])[0] || '\u2014') + '</span>';
			buf += '</button></div></div>';
			buf += '<div class="setrow setrow-icons"><div class="setcell"><span class="itemicon"></span></div><div class="setcell setcell-typeicons">';
			for (var k = 0; k < species.types.length; k++) buf += Dex.getTypeIcon(species.types[k]);
			buf += '</div></div>';
			var abilities = species.abilities;
			var abilityCells = [['Ability 1', abilities['0']], ['Ability 2', abilities['1'] || abilities['S']], ['Hidden', abilities['H']]];
			buf += '<div class="setrow setrow-abilities">';
			for (var a = 0; a < abilityCells.length; a++) {
				var ability = BattleLog.escapeHTML(abilityCells[a][1] || '');
				buf += '<div class="setcell"><label>' + abilityCells[a][0] + '</label><input type="text" class="textbox" readonly value="' + ability + '" title="' + ability + '" /></div>';
			}
			buf += '</div></div>';

			var rows = [
				'From: ' + (species.prevo || '\u2014'),
				'Into: ' + ((species.evos || []).join(', ') || '\u2014')
			];
			buf += '<div class="setcol setcol-moves"><div class="setcell"><label>Evolves</label>';
			for (var m = 0; m < rows.length; m++) {
				if (m) buf += '<div class="setcell">';
				buf += '<input type="text" class="textbox" readonly value="' + BattleLog.escapeHTML(rows[m]) + '" title="' + BattleLog.escapeHTML(rows[m]) + '" /></div>';
			}
			buf += '<div class="setcell setcell-learnset"><input type="text" class="textbox learnsetcount" readonly value="Learnset:" /></div>';
			buf += '</div>';

			buf += '<div class="setcol setcol-stats"><div class="setrow"><label>Stats</label><button class="textbox setstats" >';
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
			this.dexSpeciesBST = bst;
			this.$('.dexmonpage').html('<div class="teamwrapper">' + buf + '</div>');

			var $results = this.$('.teambuilder-results');
			var search = new BattleSearch($results, $results);
			viewSearch(search, view);
			$results.on('scroll', function () {
				search.updateScroll();
			});
			search.setType('move', 'gen' + view.gen + 'ag', { species: species.name, moves: [] });
			var count = search.resultSet.filter(function (row) { return row[0] === 'move'; }).length;
			this.$('.learnsetcount').val('Learnset: ' + count + (count === 1 ? ' move' : ' moves'));
			this.scaleDexPokemon();
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
			this.dexMove = null;
			this.$('.dexmonpage').hide().empty();
			this.$('.dexpage').show();
			this.dexScroller().scrollTop(this.dexScrollTop || 0);
		},
		clickDexMove: function (e) {
			e.preventDefault();
			var entry = e.currentTarget.dataset.entry.split('|');
			if (entry[0] === 'move') this.openDexMove(entry[1], this.dexSpecies && this.dexSpecies.name);
			if (entry[0] === 'pokemon') this.openDexPokemon(entry[1]);
		},
		openDexMove: function (id, from) {
			var view = DexViews.current = this.dexView;
			var move = view.dex.moves.get(id);
			if (!move.exists) return;
			if (this.$('.dexpage').is(':visible')) this.dexScrollTop = this.dexScroller().scrollTop();
			this.dexSpecies = null;
			this.dexMove = move;
			this.dexMoveFrom = from || '';
			this.dexMoveData = null;
			this.dexMoveList = 'learn';
			this.$('.dexsearchpage, .dexpage').hide();
			this.$('.dexmonpage').show();
			this.dexScroller().scrollTop(0);
			var room = this;
			request('dexeffect', this.dexid + ', move, ' + move.id).then(function (data) {
				room.renderDexMove(data);
			}, function () {
				if (room.dexMove === move) room.$('.dexmovebase').val('\u2014');
			});

			var buf = '<div class="pad">';
			buf += HIDE_BUTTON + '<button name="closeDexMove" class="button"><i class="fa fa-chevron-left"></i> ' + BattleLog.escapeHTML(from || 'Dex') + '</button></div>';
			buf += '<div class="teambar"><button disabled class="pokemon">' + BattleLog.escapeHTML(move.name) + '</button></div>';
			buf += '<div class="teamchartbox individual"><ol class="teamchart"><li>';
			buf += '<div class="setmenu"><button name="showDexMoveList" value="learn"><i class="fa fa-list"></i>Learned by</button> ' +
				'<button name="showDexMoveList" value="code"><i class="fa fa-code"></i>Code</button></div>';
			buf += '<div class="setchart dexmonchart">';

			buf += '<div class="setcol setcol-icon"><div class="setcell-sprite dexmoveicons">' + Dex.getTypeIcon(move.type) + Dex.getCategoryIcon(move.category) + '</div>';
			buf += '<div class="setcell setcell-pokemon"><label>Name</label><input type="text" class="textbox" readonly value="' + BattleLog.escapeHTML(move.name) + '" /></div></div>';

			buf += '<div class="setcol setcol-details"><div class="setrow">';
			buf += '<div class="setcell setcell-details"><label>Base move</label><input type="text" class="textbox dexmovebase" readonly value="Loading..." /></div></div>';
			var cells = [
				['Type', move.type], ['Category', move.category], ['Power', move.basePower || '\u2014'],
				['Accuracy', move.accuracy && move.accuracy !== true ? move.accuracy + '%' : '\u2014']
			];
			buf += '<div class="setrow setrow-abilities">';
			for (var c = 0; c < cells.length; c++) {
				var value = BattleLog.escapeHTML(String(cells[c][1]));
				buf += '<div class="setcell"><label>' + cells[c][0] + '</label><input type="text" class="textbox" readonly value="' + value + '" title="' + value + '" /></div>';
			}
			buf += '</div></div>';

			var text = view.dex.text.get(move);
			var descs = [['Short description', text.shortDesc || ''], ['Description', text.desc || '']];
			buf += '<div class="setcol setcol-moves">';
			for (var d = 0; d < descs.length; d++) {
				var desc = BattleLog.escapeHTML(descs[d][1]);
				buf += '<div class="setcell"><label>' + descs[d][0] + '</label><input type="text" class="textbox" readonly value="' + desc + '" title="' + desc + '" /></div>';
			}
			buf += '<div class="setcell setcell-learnset"><button class="textbox learnsetcount" name="showDexMoveList" value="learn">Learned by:</button></div>';
			buf += '</div>';

			var multihit = Array.isArray(move.multihit) ? move.multihit.join('-') : move.multihit;
			var attributes = [
				['PP', move.pp === 1 || move.noPPBoosts ? move.pp : move.pp * 8 / 5], ['Priority', (move.priority > 0 ? '+' : '') + move.priority],
				['Target', MOVE_TARGETS[move.target] || move.target], ['Hits', multihit || 1], ['Crit', move.critRatio || 1],
				['Contact', move.flags && move.flags.contact ? 'Yes' : 'No']
			];
			buf += '<div class="setcol setcol-stats"><div class="setrow"><label>Attributes</label><button class="textbox setstats dexmoveattributes" name="showDexMoveDetails">';
			for (var t = 0; t < attributes.length; t++) {
				buf += '<span class="statrow"><label>' + attributes[t][0] + '</label> <em>' + BattleLog.escapeHTML(String(attributes[t][1])) + '</em></span>';
			}
			buf += '</button></div></div>';
			buf += '</div></li></ol></div>';
			buf += '<div class="teambuilder-results"></div><div class="teambuilder-results dexcode" style="display:none"></div>';
			this.$('.dexmonpage').html('<div class="teamwrapper">' + buf + '</div>');

			var $results = this.$('.teambuilder-results').first();
			var search = this.dexMoveSearch = new BattleSearch($results, $results);
			viewSearch(search, view, function (typedSearch) {
				var getBaseResults = typedSearch.getBaseResults;
				typedSearch.getBaseResults = function () {
					return DexViews.ui.dropEmptyHeaders(getBaseResults.call(this).filter(function (row) {
						return row[0] !== 'pokemon' || this.canLearn(row[1], move.id);
					}, this), 'pokemon');
				};
			});
			$results.on('scroll', function () {
				search.updateScroll();
			});
			search.setType('pokemon', 'gen' + view.gen);
			var count = search.resultSet.filter(function (row) { return row[0] === 'pokemon'; }).length;
			this.$('.learnsetcount').text('Learned by: ' + count);
			this.scaleDexPokemon();
		},
		renderDexMove: function (data) {
			if (!this.dexMove || data.id !== this.dexMove.id || data.dexid !== this.dexid) return;
			this.dexMoveData = data;
			var base = data.base ? this.dexView.dex.moves.get(data.base).name : '\u2014';
			this.$('.dexmovebase').val(base).attr('title', base);
			if (this.dexMoveList === 'code') this.showDexMoveList('code');
		},
		showDexMoveList: function (list) {
			if (!this.dexMove) return;
			this.dexMoveList = list;
			var $code = this.$('.dexmonpage .dexcode');
			this.$('.dexmonpage .setmenu button').removeClass('cur').filter('[value="' + list + '"]').addClass('cur');
			this.$('.dexmonpage .teambuilder-results').first().toggle(list === 'learn');
			$code.toggle(list === 'code');
			if (list === 'learn') {
				this.dexMoveSearch.updateScroll();
				return;
			}
			var data = this.dexMoveData;
			if (!data) {
				$code.html('<div class="pad"><p><em>Loading...</em></p></div>');
				return;
			}
			var buf = '<div class="pad">';
			buf += '<h3>Data</h3><pre>' + BattleLog.escapeHTML(JSON.stringify(data.data, null, '\t')) + '</pre>';
			if (!data.source.length) buf += '<p><em>No handler code: everything this move does comes from its data.</em></p>';
			for (var i = 0; i < data.source.length; i++) {
				buf += '<h3>' + BattleLog.escapeHTML(data.source[i][0]) + '</h3><pre>' + BattleLog.escapeHTML(data.source[i][1]) + '</pre>';
			}
			$code.html(buf + '</div>');
		},
		showDexMoveDetails: function () {
			var data = this.dexMoveData ? this.dexMoveData.data : this.dexMove;
			var buf = '<table class="dexdetails">';
			var add = function (value, path) {
				if (typeof value === 'function') return;
				if (value && typeof value === 'object' && !Array.isArray(value) && path !== 'flags' && Object.keys(value).length) {
					for (var key in value) add(value[key], path ? path + '.' + key : key);
					return;
				}
				var text = path === 'flags' ? Object.keys(value).join(', ') : typeof value === 'string' ? value : JSON.stringify(value);
				buf += '<tr><th>' + BattleLog.escapeHTML(path) + '</th><td>' + BattleLog.escapeHTML(text || '') + '</td></tr>';
			};
			add(data, '');
			buf += '</table>';
			app.addPopup(Popup, { htmlMessage: buf, sourceEl: app.dispatchingButton, maxWidth: 480 });
		},
		closeDexMove: function () {
			var from = this.dexMoveFrom;
			this.dexMove = null;
			this.dexMoveData = null;
			this.dexMoveSearch = null;
			if (from) {
				this.openDexPokemon(from);
				return;
			}
			this.closeDexPokemon();
		},
		showDexDetails: function () {
			var species = this.dexSpecies;
			var data = this.dexView.Pokedex[species.id] || {};
			var ratio = species.genderRatio;
			var field = function (label, value) {
				return '<tr><th>' + label + '</th><td>' + (value === undefined || value === null || value === '' ? '&mdash;' : value) + '</td></tr>';
			};
			var divider = '<tr class="divider"><td colspan="2"><hr /></td></tr>';
			var buf = '<table class="dexdetails">';
			buf += field('Weight', species.weightkg && species.weightkg + ' kg');
			buf += field('Height', species.heightm && species.heightm + ' m');
			buf += field('Gender', species.gender);
			buf += field('Gender ratio', ratio && (ratio.M * 100) + '% male, ' + (ratio.F * 100) + '% female');
			buf += field('Egg Groups', BattleLog.escapeHTML((species.eggGroups || []).join(', ')));
			buf += divider;
			buf += field('Tags', BattleLog.escapeHTML((species.tags || []).join(', ')));
			buf += divider;
			buf += field('Evo type', BattleLog.escapeHTML(species.evoType || ''));
			buf += field('Evo level', species.evoLevel || '');
			buf += field('Evo condition', BattleLog.escapeHTML(species.evoCondition || ''));
			buf += divider;
			buf += field('Color', BattleLog.escapeHTML(species.color || ''));
			buf += field('Category', data.category && 'The ' + BattleLog.escapeHTML(data.category) + ' Pok&eacute;mon');
			buf += field('Dex entry', BattleLog.escapeHTML(data.dexEntry || ''));
			buf += field('Base stat total', this.dexSpeciesBST);
			buf += '</table>';
			app.addPopup(Popup, { htmlMessage: buf, sourceEl: app.dispatchingButton, maxWidth: 400 });
		},
		showDexSprite: function (kind) {
			var uploadid = (this.dexView.sprites[this.dexSpecies.id] || {})[kind];
			var image = uploadid && this.dexView.images[uploadid];
			if (!image && hasStandardSprites(this.dexSpecies.id)) {
				var dex = Object.getPrototypeOf(Dex);
				var sprite = '<span class="picon" style="' + dex.getPokemonIcon.call(Dex, this.dexSpecies.name) + '"></span>';
				var size = '40&times;30';
				if (kind !== 'icon') {
					var data = dex.getSpriteData.call(Dex, this.dexSpecies.name, kind.slice(0, 5) === 'front', {
						gen: this.dexView.dex.gen, shiny: kind.indexOf('shiny') >= 0, noScale: true
					});
					sprite = '<img src="' + data.url + '" width="' + data.w + '" height="' + data.h + '" alt="' + kind + '"' + (data.pixelated ? ' class="pixelated"' : '') + ' />';
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
					'<img src="' + Dex.resourcePrefix + 'sprites/custom/' + BattleLog.escapeHTML(image.file) + '" width="' + image.width + '" height="' + image.height + '" alt="' + kind + '"' +
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
		forkInto: function (name, line, button) {
			var room = this;
			var source = this.dexSummary;
			var targets = editableDexes().filter(function (dex) { return dex.id !== source.id && dex.parents.indexOf(source.id) < 0; });
			var send = function (target) {
				room.forkTarget = target;
				app.send(line ? '/crq dexforkline ' + target + ', ' + source.id + ', ' + name : '/crq dexfork ' + target + ', ' + source.id + ', pokemon, ' + name);
			};
			if (targets.length === 1) return send(targets[0].id);
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

})(window.jQuery);
