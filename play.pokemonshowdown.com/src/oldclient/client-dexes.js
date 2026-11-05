(function ($) {

	var TIERS = [
		'AG', 'Uber', '(Uber)', 'OU', '(OU)', 'UUBL', 'UU', 'RUBL', 'RU', 'NUBL', 'NU', '(NU)', 'PUBL', 'PU', '(PU)', 'ZUBL', 'ZU',
		'NFE', 'LC', 'DUber', '(DUber)', 'DOU', '(DOU)', 'DBL', 'DUU', '(DUU)', 'CAP', 'CAP NFE', 'CAP LC', 'Unreleased', 'Illegal'
	];

	var FORMAT_TIERS = ['Random Battle', 'Randbat', 'OU', 'Ubers', 'UU', 'RU', 'NU', 'PU', 'AG', 'LC', 'VGC'];
	var FORMAT_GROUPS = [/Doubles|VGC/, /Free-for-all|FFA|Multi/i, /Draft/, /Custom Game|\bCG$/];
	var FORMAT_VARIANTS = [/Doubles|VGC/, /Free-for-all|FFA/i, /Multi/];

	var DexViews = window.DexViews;
	var requests = {};
	DexViews.list = [];
	DexViews.formats = {};
	DexViews.entries = {};

	function request(cmd, target) {
		var key = cmd + ' ' + target;
		if (requests[key]) return requests[key].promise;
		var entry = requests[key] = { tries: 0 };
		entry.promise = new Promise(function (resolve, reject) {
			entry.resolve = resolve;
			entry.reject = reject;
		});
		var send = function () {
			entry.tries++;
			app.send('/crq ' + key);
			entry.timer = setTimeout(function () {
				if (entry.tries < 3) return send();
				delete requests[key];
				entry.reject(new Error("The server didn't answer."));
			}, 10000);
		};
		send();
		return entry.promise;
	}

	function answer(cmd, data) {
		var key = data && cmd + ' ' + data.query;
		var entry = key && requests[key];
		if (!entry) return;
		clearTimeout(entry.timer);
		delete requests[key];
		if (data.error || data.missing) {
			entry.reject(new Error(data.error || "That doesn't exist."));
		} else {
			entry.resolve(data);
		}
	}

	function loadEntries(dexid) {
		if (DexViews.entries[dexid] || !dexid) return;
		request('dexentries', dexid).then(function (data) {
			var entries = { custom: data.custom, modified: data.modified };
			$.each(['Moves', 'Abilities', 'Items'], function (i, table) {
				var ids = entries[table] = {};
				for (var j = 0; j < data[table].length; j++) ids[data[table][j]] = 1;
			});
			DexViews.entries[dexid] = entries;
			var room = app.rooms.rooms;
			if (!room || room.dexid !== dexid) return;
			var typedSearch = room.dexSearch && room.dexSearch.engine.typedSearch;
			if (typedSearch && typedSearch.searchType !== 'pokemon') room.dexSearch.setType(typedSearch.searchType, 'gen' + room.dexView.gen);
			if (room.dexFormatSearch && room.dexFormatKind) room.showDexFormatList(room.dexFormatKind);
		}, function () {});
	}

	DexViews.query = function (dexid) {
		return request('dex', dexid);
	};

	Storage.whenPrefsLoaded(function () {
		if (Storage.prefs('bwgfx') === undefined) Storage.prefs('bwgfx', true);
	});

	function lastMatch(patterns, name) {
		for (var i = patterns.length - 1; i >= 0; i--) {
			if (patterns[i].test(name)) return i;
		}
		return -1;
	}

	function formatOrder(data) {
		var name = data.name.replace(/^\[[^\]]*\] /, '');
		var group = lastMatch(FORMAT_GROUPS, name) + 1;
		if (!group && !FORMAT_TIERS.includes(name)) group = 0.5;
		var tier = lastMatch(FORMAT_TIERS.map(function (word) { return new RegExp('\\b' + word + '\\b'); }), name);
		return [group, lastMatch(FORMAT_VARIANTS, name), group === 0.5 ? -1 : tier, name];
	}

	function compareFormats(a, b) {
		var orderA = formatOrder(a);
		var orderB = formatOrder(b);
		for (var i = 0; i < orderA.length; i++) {
			if (orderA[i] !== orderB[i]) return orderA[i] < orderB[i] ? -1 : 1;
		}
		return 0;
	}

	function addFormats() {
		if (!window.BattleFormats || !DexViews.list.length) return;
		var column = 0;
		for (var id in BattleFormats) column = Math.max(column, BattleFormats[id].column || 0);
		DexViews.formats = {};
		for (var i = 0; i < DexViews.list.length; i++) {
			var summary = DexViews.list[i];
			summary.gen = DexViews.genOf(summary.mod);
			summary.formats.sort(compareFormats);
			for (var j = 0; j < summary.formats.length; j++) {
				var data = summary.formats[j];
				var view = DexViews.views[summary.hash];
				var format = new window.BattleFormat(data.name, {
					name: data.name, section: summary.name, column: column + 1, team: null,
					searchShow: false, challengeShow: true, tournamentShow: true, rated: false,
					isTeambuilderFormat: data.name.slice(-11) !== 'Custom Game', teambuilderFormat: '',
					gen: summary.gen, mod: view ? view.modid : 'gen' + summary.gen, dexid: summary.id
				});
				if (Dex.formats.cache[data.id]) {
					BattleFormats[data.id] = Object.assign(Dex.formats.cache[data.id], format);
				} else {
					BattleFormats[data.id] = Dex.formats.cache[data.id] = format;
				}
				DexViews.formats[data.id] = summary;
			}
		}
	}

	function formatDex(format) {
		return DexViews.formats[toID(format)] || null;
	}

	function loadedDex(summary) {
		var view = DexViews.views[summary.hash];
		if (!view) return null;
		for (var id in DexViews.formats) {
			if (DexViews.formats[id] === summary) BattleFormats[id].mod = view.modid;
		}
		return view.dex;
	}

	function useTeamDex(room) {
		var team = room.curTeam;
		var summary = team && formatDex(team.format);
		if (!summary) return;
		var dex = loadedDex(summary);
		if (dex) {
			team.dex = dex;
			return;
		}
		DexViews.load(summary).then(function () {
			if (room.curTeam !== team) return;
			team.dex = loadedDex(summary);
			room.update();
		});
	}

	var getGen = TeambuilderRoom.prototype.getGen;
	var edit = TeambuilderRoom.prototype.edit;
	var focus = TeambuilderRoom.prototype.focus;
	var changeFormat = TeambuilderRoom.prototype.changeFormat;
	var update = TeambuilderRoom.prototype.update;
	_.extend(TeambuilderRoom.prototype, {
		getGen: function (format) {
			var summary = formatDex(format);
			return summary ? summary.gen : getGen.apply(this, arguments);
		},
		edit: function (i) {
			if (i && i.currentTarget) i = $(i.currentTarget).data('value');
			var team = Storage.teams[+i];
			var summary = team && formatDex(team.format);
			if (summary && !loadedDex(summary) && !DexViews.failed[summary.hash]) {
				var self = this;
				this.$el.html('<div class="pad"><p><em>Loading ' + BattleLog.escapeHTML(summary.name) + '...</em></p></div>');
				var done = function () { edit.call(self, i); useTeamDex(self); };
				DexViews.load(summary).then(done, done);
				return;
			}
			edit.call(this, i);
			useTeamDex(this);
		},
		focus: function () {
			focus.apply(this, arguments);
			useTeamDex(this);
		},
		changeFormat: function (format) {
			changeFormat.apply(this, arguments);
			useTeamDex(this);
		},
		update: function () {
			update.apply(this, arguments);
			if (this.curTeam || !Storage.teams) return;
			var self = this;
			var waiting = [];
			for (var i = 0; i < Storage.teams.length; i++) {
				var summary = formatDex(Storage.teams[i].format);
				if (!summary || DexViews.views[summary.hash] || DexViews.loading[summary.hash] || DexViews.failed[summary.hash]) continue;
				waiting.push(DexViews.load(summary));
			}
			if (waiting.length) {
				Promise.all(waiting).then(function () {
					if (!self.curTeam) self.update();
				}, function () {});
			}
		}
	});

	$(function () {
		app.on('response:dexes', function (list) {
			if (!list) return;
			DexViews.list = list;
			addFormats();
			if (app.rooms.rooms) {
				app.rooms.rooms.updateDexSearch();
				app.rooms.rooms.updateDexPage();
			}
			if (app.rooms.dexbuilder) app.rooms.dexbuilder.update();
		});
		app.on('response:dexcreate response:dexedit', function (data) {
			if (!data) return;
			if (data.error) {
				app.addPopup(Popup, { message: data.error });
			} else if (data.stale) {
				app.addPopup(Popup, {
					htmlMessage: "These don't work in the new world and are skipped until you fix them or clear the dex:<br />" +
						data.stale.map(function (problem) { return BattleLog.escapeHTML(problem); }).join('<br />')
				});
			}
			if (app.rooms.dexbuilder && app.rooms.dexbuilder.saveState === 'saving') app.rooms.dexbuilder.setSaveState(data.error ? 'failed' : 'saved');
			if (data.id !== undefined && app.rooms.dexbuilder) app.rooms.dexbuilder.curFolder = data.id || '';
			app.send('/crq dexes');
		});
		app.on('response:dexfork response:dexforkline', function (data) {
			if (!data) return;
			app.addPopup(Popup, { htmlMessage: data.error ? BattleLog.escapeHTML(data.error) : BattleLog.sanitizeHTML(data.html) });
			app.send('/crq dexes');
		});
		$.each(['dex', 'dexentries', 'dexeffect', 'dexformat'], function (i, cmd) {
			app.on('response:' + cmd, function (data) {
				answer(cmd, data);
			});
		});
		app.on('init:formats', function () {
			if (DexViews.list.length) {
				addFormats();
			} else {
				app.send('/crq dexes');
			}
		});
		if (window.BattleFormats) app.send('/crq dexes');
		app.user.on('change:named', function () {
			if (app.user.get('named')) app.send('/crq dexes');
		});

		DexViews.indexSearch();

		var getTypedSearch = DexSearch.prototype.getTypedSearch;
		DexSearch.prototype.getTypedSearch = function (searchType, format, speciesOrSet) {
			var summary = format && formatDex(format);
			var view = summary && DexViews.views[summary.hash];
			if (!view) return getTypedSearch.apply(this, arguments);
			var search = getTypedSearch.call(this, searchType, 'gen' + view.gen + format.slice(summary.id.length), speciesOrSet);
			if (!search) return search;
			search.dex = view.dex;
			search.dexView = view;
			search.dexid = summary.id;
			return search;
		};

		var TypedSearch = window.BattleTypedSearch;

		var find = DexSearch.prototype.find;
		DexSearch.prototype.find = function (query) {
			var changed = find.apply(this, arguments);
			var view = this.typedSearch && this.typedSearch.dexView;
			if (!this.results) return changed;
			this.results = this.results.filter(function (row) {
				var table = { pokemon: 'Pokedex', move: 'Moves', item: 'Items', ability: 'Abilities' }[row[0]];
				if (!table || !DexViews.custom[table][row[1]]) return true;
				return !!view && !!(table === 'Pokedex' ? view.species[row[1]] : view[table][row[1]]);
			}).filter(function (row, index, rows) {
				return row[0] !== 'header' || (rows[index + 1] && rows[index + 1][0] !== 'header');
			});
			return changed;
		};
		var PokemonSearch = Object.getPrototypeOf(getTypedSearch('pokemon'));
		var MoveSearch = Object.getPrototypeOf(getTypedSearch('move'));
		var ItemSearch = Object.getPrototypeOf(getTypedSearch('item'));
		var AbilitySearch = Object.getPrototypeOf(getTypedSearch('ability'));

		function learnsetOf(view, id) {
			if (view.Learnsets[id]) return view.Learnsets[id].learnset;
			var learnset = BattleTeambuilderTable.learnsets[id];
			if (!learnset) return null;
			var moves = {};
			for (var moveid in learnset) {
				if (learnset[moveid].includes(String(view.gen))) moves[moveid] = 1;
			}
			return moves;
		}

		function firstLearnsetid(view, search, speciesid) {
			if (learnsetOf(view, speciesid)) return speciesid;
			var species = search.dex.species.get(speciesid);
			if (!species.exists) return '';
			var base = toID(typeof species.battleOnly === 'string' ? species.battleOnly : species.baseSpecies);
			return learnsetOf(view, base) ? base : '';
		}

		function learnableMoves(search, speciesid) {
			var view = search.dexView;
			var moves = {};
			var learnsetid = firstLearnsetid(view, search, speciesid);
			while (learnsetid) {
				var learnset = learnsetOf(view, learnsetid);
				for (var moveid in learnset) moves[moveid] = 1;
				learnsetid = search.nextLearnsetid(learnsetid, speciesid, true);
			}
			return moves;
		}

		var canLearn = TypedSearch.prototype.canLearn;
		TypedSearch.prototype.canLearn = function (speciesid, moveid) {
			if (!this.dexView) return canLearn.apply(this, arguments);
			return !!learnableMoves(this, speciesid)[moveid];
		};

		function nameForme(pokemon) {
			if (!pokemon.forme || pokemon.name.endsWith('-' + pokemon.forme)) return pokemon;
			var species = Object.create(pokemon);
			species.forme = '';
			return species;
		}

		var renderPokemonRow = BattleSearch.prototype.renderPokemonRow;
		BattleSearch.prototype.renderPokemonRow = function (pokemon, matchStart, matchLength, errorMessage, attrs) {
			return renderPokemonRow.call(this, nameForme(pokemon), matchStart, matchLength, errorMessage, attrs);
		};

		var renderTaggedPokemonRowInner = BattleSearch.prototype.renderTaggedPokemonRowInner;
		BattleSearch.prototype.renderTaggedPokemonRowInner = function (pokemon, tag, errorMessage) {
			return renderTaggedPokemonRowInner.call(this, nameForme(pokemon), tag, errorMessage);
		};

		var getTier = TypedSearch.prototype.getTier;
		TypedSearch.prototype.getTier = function (species) {
			if (!this.dexView) return getTier.apply(this, arguments);
			var data = DexViews.tierData(this.dexView, species);
			var tier = (this.isDoubles && data.doublesTier) || (this.isNatDex && data.natDexTier) || data.tier;
			if (tier) return tier;
			var formatType = this.formatType;
			this.formatType = this.isDoubles ? 'doubles' : this.isNatDex ? 'natdex' : formatType;
			tier = getTier.apply(this, arguments);
			this.formatType = formatType;
			return tier;
		};

		var getPokemonResults = PokemonSearch.getBaseResults;
		PokemonSearch.getBaseResults = function () {
			if (!this.dexView) return getPokemonResults.apply(this, arguments);
			var self = this;
			var tiers = {};
			for (var id in this.dexView.species) {
				var species = this.dex.species.get(id);
				if (!species.exists) continue;
				var tier = this.getTier(species) || 'Illegal';
				(tiers[tier] || (tiers[tier] = [])).push(species);
			}
			var order = Object.keys(tiers).sort(function (a, b) {
				var i = TIERS.indexOf(a);
				var j = TIERS.indexOf(b);
				if (i < 0) i = TIERS.length - 2;
				if (j < 0) j = TIERS.length - 2;
				return i - j || (a < b ? -1 : a > b ? 1 : 0);
			});
			var results = [];
			for (var i = 0; i < order.length; i++) {
				results.push(['header', order[i]]);
				tiers[order[i]].sort(function (a, b) { return a.num - b.num || (a.name < b.name ? -1 : 1); });
				for (var j = 0; j < tiers[order[i]].length; j++) results.push(['pokemon', tiers[order[i]][j].id]);
			}
			return results.filter(function (row) {
				return row[0] !== 'pokemon' || !self.dex.species.get(row[1]).isCosmeticForme;
			});
		};

		var getMoveResults = MoveSearch.getBaseResults;
		MoveSearch.getBaseResults = function () {
			if (!this.dexView || !this.species) return getMoveResults.apply(this, arguments);
			var view = this.dexView;
			var species = this.dex.species.get(this.species);
			var learned = learnableMoves(this, species.id);
			var format = this.format;
			if (learned.sketch || format.includes('hackmons') || format.endsWith('bh') || format.includes('customgame')) {
				for (var id in BattleMovedex) {
					var move = this.dex.moves.get(id);
					if (move.exists && !move.isMax && !move.isZ) learned[move.id] = 1;
				}
			}
			var moves = Object.keys(learned).filter(function (moveid) {
				return this.dex.moves.get(moveid).exists;
			}, this).sort();
			var usable = [];
			var useless = [];
			for (var i = 0; i < moves.length; i++) {
				var isUsable = DexViews.custom.Moves[moves[i]] && view.Moves[moves[i]] ||
					this.moveIsNotUseless(moves[i], species, moves, this.set);
				(isUsable ? usable : useless).push(['move', moves[i]]);
			}
			if (usable.length) usable.unshift(['header', "Moves"]);
			if (useless.length) useless.unshift(['header', "Usually useless moves"]);
			return usable.concat(useless);
		};

		$.each([[MoveSearch, 'Moves', 'move', "moves"], [AbilitySearch, 'Abilities', 'ability', "abilities"], [ItemSearch, 'Items', 'item', "items"]], function (i, info) {
			var getDefaultResults = info[0].getDefaultResults;
			info[0].getDefaultResults = function () {
				var results = getDefaultResults.apply(this, arguments);
				var view = this.dexView;
				var entries = view && DexViews.entries[this.dexid];
				if (view && !entries) loadEntries(this.dexid);
				if (!entries) return results;
				var dexRows = [];
				var listed = {};
				$.each([[entries.custom[info[1]], " custom "], [entries.modified[info[1]], " modified "]], function (j, group) {
					var ids = group[0].filter(function (id) { return view[info[1]][id] && !view[info[1]][id].isPokeball; }).sort();
					for (var k = 0; k < ids.length; k++) listed[ids[k]] = 1;
					if (ids.length) dexRows.push(['header', view.name + group[1] + info[3]]);
					dexRows = dexRows.concat(ids.map(function (id) { return [info[2], id]; }));
				});
				if (!dexRows.length) return results;
				results = results.filter(function (row) { return !listed[row[1]]; });
				if (results.length && results[0][0] !== 'header') results.unshift(['header', info[1]]);
				return dexRows.concat(results);
			};
		});
	});

	function canEdit(summary) {
		return [summary.owner].concat(summary.editors || []).some(function (name) { return toID(name) === app.user.get('userid'); });
	}

	function viewSearch(search, view, extend) {
		search.engine.getTypedSearch = function (searchType, format, speciesOrSet) {
			var typedSearch = DexSearch.prototype.getTypedSearch.call(this, searchType, format, speciesOrSet);
			if (!typedSearch) return typedSearch;
			typedSearch.dex = view.dex;
			typedSearch.dexView = view;
			if (extend) extend(typedSearch, searchType);
			return typedSearch;
		};
	}

	function dropEmptyHeaders(rows, type) {
		return rows.filter(function (row, index) {
			var next = rows[index + 1];
			return row[0] !== 'header' || (next && (type ? next[0] === type : next[0] !== 'header'));
		});
	}

	function dexButton(summary) {
		var details = '[Gen ' + DexViews.genOf(summary.mod) + '] ' + summary.species + ' Pok&eacute;mon';
		if (summary.formats.length) details += ', ' + summary.formats.length + (summary.formats.length === 1 ? ' format' : ' formats');
		return '<div><a href="' + app.root + 'dex-' + BattleLog.escapeHTML(summary.id) + '" class="blocklink" data-dex="' + BattleLog.escapeHTML(summary.id) + '">' +
			(summary.official ? OFFICIAL_BADGE : '') +
			'<small>' + details + '<br /></small>' +
			'<strong>' + BattleLog.escapeHTML(summary.name) + '</strong> by <strong>' + BattleLog.escapeHTML(summary.owner) + '</strong></a></div>';
	}

	function dexSection(title, list) {
		if (!list.length) return '';
		return '<h2 class="rooms-chatrooms">' + BattleLog.escapeHTML(title) + '</h2>' + list.map(dexButton).join('');
	}

	var OFFICIAL_BADGE = '<span class="dexbadge"><i class="fa fa-check-circle"></i> Official</span>';

	var HIDE_BUTTON = '<button class="button" style="float:right;font-size:10pt;margin-top:3px" name="closeHide"><i class="fa fa-caret-right"></i> Hide</button>';

	var roomsInitialize = RoomsRoom.prototype.initialize;
	var roomsShow = RoomsRoom.prototype.show;
	var roomsFocus = RoomsRoom.prototype.focus;
	_.extend(RoomsRoom.prototype, {
		events: _.extend({}, RoomsRoom.prototype.events, {
			'input input[name=dexsearch]': 'updateDexSearch',
			'submit form.dexsearch': 'submitDexSearch',
			'click a[data-dex]': 'clickDex',
			'scroll': 'updateDexScroll',
			'input input[name=pokemonsearch]': 'searchPokemon',
			'keydown input[name=pokemonsearch]': 'searchPokemonKey',
			'click .dexpokemon a[data-entry]': 'clickDexEntry',
			'click .dexmonpage .utilichart a[data-entry]': 'clickDexMove',
			'input input[name=formatsearch]': 'searchDexFormat',
			'click .dexformatpage .utilichart a[data-entry]': 'clickDexFormatEntry'
		}),
		initialize: function () {
			roomsInitialize.apply(this, arguments);
			this.$('.pad').first().attr('data-workspace', 'battle');
			this.forkTarget = '';
			this.$el.append(
				'<div data-workspace="create"><div class="pad dexsearchpage">' + HIDE_BUTTON +
				'<h2>Search dexes</h2><form class="dexsearch"><p><label>Dex or username:<br />' +
				'<input type="search" class="textbox" name="dexsearch" placeholder="(blank = all dexes)" size="30" autocomplete="off" /></label></p>' +
				'<p><button type="submit" class="button"><i class="fa fa-search"></i> <strong>Search</strong></button></p></form>' +
				'<div class="dexresults" style="max-width:480px"><p><em style="font-size:20pt">Loading...</em></p></div></div>' +
				'<div class="dexpage" style="display:none"></div>' +
				'<div class="dexmonpage" style="display:none;position:absolute;top:0;left:0;right:0;bottom:0"></div></div>'
			);
			this.$('[data-workspace]').hide().filter('[data-workspace="' + app.workspace + '"]').show();
			this.updateDexSearch();
		},
		focus: function () {
			if (app.workspace !== 'create') return roomsFocus.apply(this, arguments);
			app.send('/crq dexes');
			if (!this.dexid) this.$('input[name=dexsearch]').focus();
		},
		submitDexSearch: function (e) {
			e.preventDefault();
			this.updateDexSearch();
		},
		updateDexSearch: function () {
			var $results = this.$('.dexresults');
			if (!$results.length || !DexViews.list.length) return;
			var query = toID(this.$('input[name=dexsearch]').val());
			if (!query) {
				$results.html(
					dexSection("Official dexes", DexViews.list.filter(function (summary) { return summary.official; })) +
					dexSection("Dexes", DexViews.list.filter(function (summary) { return !summary.official; }))
				);
				return;
			}
			var named = DexViews.list.filter(function (summary) { return toID(summary.name).includes(query); });
			var byUser = DexViews.list.filter(function (summary) {
				return [summary.owner].concat(summary.editors || []).some(function (name) { return toID(name).includes(query); });
			});
			$results.html(
				dexSection("Dex names", named) + dexSection("Made by", byUser) ||
				'<p><em>No dexes or users match "' + BattleLog.escapeHTML(this.$('input[name=dexsearch]').val()) + '".</em></p>'
			);
		},
		clickDex: function (e) {
			e.preventDefault();
			e.stopImmediatePropagation();
			this.openDex(e.currentTarget.dataset.dex);
		},
		openDex: function (dexid) {
			if (this.dexid !== dexid) {
				this.dexid = dexid;
				this.dexTab = '0';
				this.dexView = null;
				this.dexSearch = null;
				this.$('.dexpage').html('<div class="pad">' + HIDE_BUTTON + '<p><em style="font-size:20pt">Loading...</em></p></div>');
			}
			if (this.$('.dexsearchpage').is(':visible')) this.searchScrollTop = this.$el.scrollTop();
			this.$('.dexsearchpage, .dexmonpage, .dexformatpage').hide();
			this.$('.dexmonpage, .dexformatpage').empty();
			this.dexFormatId = '';
			this.dexSpecies = null;
			this.$('.dexpage').show();
			this.dexScroller().scrollTop(0);
			this.updateDexPage();
		},
		closeDex: function () {
			this.dexid = '';
			this.dexSummary = null;
			this.dexView = null;
			this.dexSearch = null;
			this.dexSpecies = null;
			this.dexFormatId = '';
			this.$('.dexpage, .dexmonpage, .dexformatpage').hide().empty();
			this.$('.dexsearchpage').show();
			this.$el.scrollTop(this.searchScrollTop || 0);
			this.$('input[name=dexsearch]').focus();
		},
		updateDexPage: function () {
			var self = this;
			var dexid = this.dexid;
			if (!dexid) return;
			var summary = DexViews.list.filter(function (dex) { return dex.id === dexid; })[0];
			if (!summary && !DexViews.list.length) return;
			var found = summary ? DexViews.load(summary) : DexViews.query(dexid).then(function (data) {
				summary = data;
				return DexViews.load(data);
			});
			found.then(function (view) {
				if (self.dexid === dexid) self.renderDex(summary, view);
			}, function () {
				if (self.dexid !== dexid) return;
				self.$('.dexpage').html('<div class="pad">' + HIDE_BUTTON + '<p><button class="button" name="closeDex"><i class="fa fa-chevron-left"></i> Search</button></p>' +
					'<p>There\'s no dex called "' + BattleLog.escapeHTML(dexid) + '".</p></div>');
			});
		},
		dexScroller: function () {
			return this.$el;
		},
		renderDex: function (summary, view) {
			DexViews.current = view;
			var sameView = this.dexView === view;
			this.dexSummary = summary;
			this.dexView = view;
			summary.formats.sort(compareFormats);
			if (!summary.formats.some(function (format) { return format.id === this.dexFormat; }, this)) {
				this.dexFormat = summary.formats.length ? summary.formats[0].id : '';
			}
			var buf = '<h2>' + (summary.official ? OFFICIAL_BADGE : '') + BattleLog.escapeHTML(summary.name) + '</h2>';
			if (summary.description) buf += '<p>' + BattleLog.escapeHTML(summary.description).replace(/\n/g, '<br />') + '</p>';
			buf += '<p>';
			buf += '<strong>Made by:</strong> ' + BattleLog.escapeHTML(summary.owner);
			if (summary.editors && summary.editors.length) buf += '<br /><strong>Edited by:</strong> ' + BattleLog.escapeHTML(summary.editors.join(', '));
			buf += '<br /><strong>World:</strong> ' + BattleLog.escapeHTML(summary.base) + ' (Gen ' + view.gen + ')';
			buf += '<br /><small>' + summary.counts.map(function (count) {
				return '<strong>' + count.name + ':</strong> ' + count.total + ' total, ' + count.custom + ' custom, ' + count.modified + ' modified';
			}).join(' &middot; ') + '</small>';
			buf += '</p><p><button class="button" name="worldDex"><i class="fa fa-globe"></i> Use as world</button>' +
				(canEdit(summary) ?
					' <button class="button" name="editDex"><i class="fa fa-pencil"></i> Edit</button>' : '') + '</p>';
			if (sameView && this.dexSearch) {
				this.$('.dexheader').html(buf);
				this.showDexTab(this.dexTab);
				return;
			}
			var tabs = summary.counts.map(function (count, i) {
				return '<li><button class="button" name="showDexTab" value="' + i + '">' + count.name + '</button></li>';
			}).join('');
			tabs += this.dexFormat ? '<li><button class="button" name="showDexTab" value="formats">Formats</button></li>' :
				'<li><button class="button disabled" disabled>Formats</button></li>';
			this.$('.dexpage').html(
				'<div class="pad">' + HIDE_BUTTON + '<p><button class="button" name="closeDex"><i class="fa fa-chevron-left"></i> Search</button></p>' +
				'<div class="dexheader">' + buf + '</div><ul class="dexformattabs">' + tabs + '</ul>' +
				'<p class="dexpokemonsearch"><input type="search" class="textbox" name="pokemonsearch" placeholder="Search Pok&eacute;mon" size="30" autocomplete="off" /></p>' +
				'<div class="dextabempty"></div></div>' +
				'<div class="dexpokemon"></div><div class="dexformatpage"></div>'
			);
			this.dexFormatId = '';
			this.dexFormatSearch = null;

			var dexid = this.dexid;
			var search = this.dexSearch = new BattleSearch(this.$('.dexpokemon'), this.dexScroller());
			viewSearch(search, view, function (typedSearch, searchType) {
				typedSearch.dexid = dexid;
				if (searchType === 'pokemon') return;
				typedSearch.getBaseResults = function () {
					var table = { move: 'Moves', ability: 'Abilities', item: 'Items' }[searchType];
					var shown = DexViews.entries[dexid];
					var seen = {};
					var results = dropEmptyHeaders(this.getDefaultResults().filter(function (row) {
						if (row[0] !== searchType) return true;
						seen[row[1]] = 1;
						return !!shown && !!shown[table][row[1]];
					}));
					var others = Object.keys(shown ? shown[table] : {}).filter(function (id) { return !seen[id]; }).sort();
					if (!others.length) return results;
					return results.concat([['header', "Other " + table.toLowerCase()]], others.map(function (id) {
						return [searchType, id];
					}));
				};
			});
			var room = this;
			search.$viewport = {
				scrollTop: function () {
					return room.dexScroller()[0].scrollTop / room.dexListZoom;
				},
				height: function () {
					return room.dexScroller()[0].clientHeight / room.dexListZoom;
				}
			};
			this.scaleDexList();
			search.setType('pokemon', 'gen' + view.gen);
			this.showDexTab(this.dexTab);
		},
		showDexTab: function (tab) {
			this.dexTab = tab = String(tab || 0);
			var count = this.dexSummary.counts[tab];
			var kind = count && { Pokedex: 'pokemon', Moves: 'move', Abilities: 'ability', Items: 'item' }[count.table];
			var pokemon = !!kind;
			var formats = tab === 'formats';
			var buf = pokemon || formats ? '' : count.table === 'TypeChart' ? this.renderDexTypes() :
				'<p><em>' + count.name + ' view coming soon.</em></p>';
			this.$('.dexpage .dexformattabs button[name=showDexTab]').removeClass('cur').filter('[value="' + tab + '"]').addClass('cur');
			if (kind && kind !== 'pokemon') loadEntries(this.dexid);
			if (kind && this.dexSearch.engine.typedSearch.searchType !== kind) {
				this.$('input[name=pokemonsearch]').val('').attr('placeholder', 'Search ' + BattleLog.unescapeHTML(count.name));
				this.dexSearch.setType(kind, 'gen' + this.dexView.gen);
			}
			this.$('.dexpokemonsearch, .dexpokemon').toggle(pokemon);
			this.$('.dextabempty').toggle(!!buf).html(buf);
			this.$('.dexformatpage').toggle(formats);
			if (pokemon) this.dexSearch.updateScroll();
			if (formats && this.dexFormatId !== this.dexFormat) this.openDexFormat(this.dexFormat);
			if (formats && this.dexFormatSearch) this.dexFormatSearch.updateScroll();
		},
		renderDexTypes: function () {
			DexViews.current = this.dexView;
			var dex = this.dexView.dex;
			var names = dex.types.names().filter(function (name) { return dex.types.get(name).exists !== false; });
			var buf = '<p><small>Rows are the attacking type, columns are the defending type.</small></p>';
			buf += '<div class="ladder dextypechart"><table><tr><th></th>';
			for (var i = 0; i < names.length; i++) buf += '<th>' + Dex.getTypeIcon(names[i]) + '</th>';
			buf += '</tr>';
			for (var i = 0; i < names.length; i++) {
				buf += '<tr><th>' + Dex.getTypeIcon(names[i]) + '</th>';
				for (var j = 0; j < names.length; j++) {
					var taken = (dex.types.get(names[j]).damageTaken || {})[names[i]] || 0;
					buf += '<td class="' + ['', 'super', 'resist', 'immune'][taken] + '">' + ['', '2', '&frac12;', '0'][taken] + '</td>';
				}
				buf += '</tr>';
			}
			return buf + '</table></div>';
		},
		scaleDexList: function () {
			var width = this.dexScroller().width();
			this.dexListZoom = this.dexListZoom || 1;
			if (!width) return;
			this.dexListZoom = width < 640 ? width / 640 : 1;
			this.$('.dexpokemon').css({ zoom: this.dexListZoom === 1 ? '' : this.dexListZoom, width: this.dexListZoom === 1 ? '' : '640px' });
			if (this.dexSearch) this.dexSearch.updateScroll();
		},
		updateDexScroll: function () {
			if (this.dexSearch) this.dexSearch.updateScroll();
			if (this.dexFormatSearch) this.dexFormatSearch.updateScroll();
		},
		searchPokemon: function (e) {
			this.dexSearch.find(e.currentTarget.value);
		},
		searchPokemonKey: function (e) {
			if (e.keyCode === 8 && !e.currentTarget.value) this.dexSearch.removeFilter();
		},
		clickDexEntry: function (e) {
			e.preventDefault();
			var entry = e.currentTarget.dataset.entry.split('|');
			if (entry[0] === 'pokemon') {
				this.openDexPokemon(entry[1]);
				return;
			}
			if (entry[0] === 'move') {
				this.openDexMove(entry[1]);
				return;
			}
			if (!this.dexSearch.addFilter(e.currentTarget)) return;
			this.$('input[name=pokemonsearch]').val('');
			this.dexSearch.find('');
		},
		worldDex: function (value, button) {
			var summary = this.dexSummary;
			if (!app.user.get('named')) {
				app.addPopup(Popup, { message: "Log in to make dexes.", sourceEl: button });
				return;
			}
			app.addPopup(PromptPopup, {
				message: "Name of your dex set in " + summary.name + ":",
				button: "Create",
				value: (summary.name + " " + app.user.get('name')).slice(0, 40),
				sourceEl: button,
				callback: function (name) {
					name = $.trim(name);
					if (!name) return;
					app.joinRoom('dexbuilder', window.DexBuilderRoom);
					app.send('/crq dexcreate ' + JSON.stringify({ name: name, base: summary.id }));
				}
			});
		},
		editDex: function () {
			var dexid = this.dexSummary.id;
			app.joinRoom('dexbuilder', window.DexBuilderRoom);
			app.rooms.dexbuilder.curFolder = dexid;
			app.rooms.dexbuilder.update();
		},
		show: function () {
			roomsShow.apply(this, arguments);
			this.scaleDexList();
			this.scaleDexPokemon();
			this.scaleDexFormat();
		}
	});

	function openDexPage(app, dexid) {
		if (app.workspace !== 'create') app.switchWorkspace('create');
		app.joinRoom('rooms');
		app.rooms.rooms.openDex(dexid);
	}

	var renderRoomTab = Topbar.prototype.renderRoomTab;
	Topbar.prototype.renderRoomTab = function (room) {
		if (!room || room.type !== 'dexbuilder') return renderRoomTab.apply(this, arguments);
		if (room.workspace && room.workspace !== app.workspace) return '';
		return '<li><a class="roomtab button closable' + (app.curRoom === room || app.curSideRoom === room ? ' cur' : '') + '" href="' + app.root + 'dexbuilder"><i class="fa fa-pencil-square-o"></i> <span>Dexbuilder</span></a>' +
			'<button class="closebutton" name="closeRoom" value="dexbuilder" aria-label="Close"><i class="fa fa-times-circle"></i></button></li>';
	};

	var tryJoinRoom = window.App.prototype.tryJoinRoom;
	window.App.prototype.tryJoinRoom = function (id) {
		if (id === 'dexbuilder') {
			if (this.workspace !== 'create') this.switchWorkspace('create');
			return this.joinRoom(id, window.DexBuilderRoom);
		}
		if (!id || !id.startsWith('dex-')) return tryJoinRoom.apply(this, arguments);
		openDexPage(this, id.slice(4));
	};

	var dispatchFragment = window.App.prototype.dispatchFragment;
	window.App.prototype.dispatchFragment = function (fragment) {
		var roomid = toRoomid(fragment || '');
		if (!roomid.startsWith('dex-')) return dispatchFragment.apply(this, arguments);
		dispatchFragment.call(this, 'rooms');
		openDexPage(this, roomid.slice(4));
	};

	var DexConfirmPopup = Popup.extend({
		type: 'semimodal',
		initialize: function (data) {
			this.callback = data.callback;
			this.$el.html('<form><p>' + data.message + '</p><p class="buttonbar"><button type="submit" class="button"><strong>' + data.button + '</strong></button> ' +
				'<button type="button" name="close" class="button autofocus">Cancel</button></p></form>');
		},
		submit: function () {
			this.close();
			this.callback();
		}
	});

	DexViews.ui = {
		request: request, compareFormats: compareFormats, openDexPage: openDexPage, DexConfirmPopup: DexConfirmPopup,
		HIDE_BUTTON: HIDE_BUTTON, OFFICIAL_BADGE: OFFICIAL_BADGE, canEdit: canEdit, viewSearch: viewSearch,
		dropEmptyHeaders: dropEmptyHeaders
	};

})(window.jQuery);
