(function ($) {

	var TIERS = [
		'AG', 'Uber', '(Uber)', 'OU', '(OU)', 'UUBL', 'UU', 'RUBL', 'RU', 'NUBL', 'NU', '(NU)', 'PUBL', 'PU', '(PU)', 'ZUBL', 'ZU',
		'NFE', 'LC', 'DUber', '(DUber)', 'DOU', '(DOU)', 'DBL', 'DUU', '(DUU)', 'CAP', 'CAP NFE', 'CAP LC', 'Unreleased', 'Illegal'
	];

	var FORMAT_TIERS = ['Random Battle', 'Randbat', 'OU', 'Ubers', 'UU', 'RU', 'NU', 'PU', 'AG', 'LC', 'VGC'];
	var FORMAT_GROUPS = [/Doubles|VGC/, /Free-for-all|FFA|Multi/i, /Draft/, /Custom Game|\bCG$/];
	var FORMAT_VARIANTS = [/Doubles|VGC/, /Free-for-all|FFA/i, /Multi/];
	var DEX_SLOTS = 3;

	var DexViews = window.DexViews;
	var queries = [];
	DexViews.list = [];
	DexViews.formats = {};
	DexViews.entries = {};

	function queryDex(dexid) {
		return new Promise(function (resolve, reject) {
			queries.push({ resolve: resolve, reject: reject });
			app.send('/crq dex ' + dexid);
		});
	}

	DexViews.query = queryDex;

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
		app.on('response:dexentries', function (data) {
			if (!data) return;
			DexViews.entries[data.id] = {};
			$.each(['Moves', 'Abilities', 'Items'], function (i, table) {
				var ids = DexViews.entries[data.id][table] = {};
				for (var j = 0; j < data[table].length; j++) ids[data[table][j]] = 1;
			});
			var room = app.rooms.rooms;
			if (room && room.dexid === data.id && room.dexSearch) {
				var typedSearch = room.dexSearch.engine.typedSearch;
				if (typedSearch && typedSearch.searchType !== 'pokemon') room.dexSearch.setType(typedSearch.searchType, 'gen' + room.dexView.gen);
			}
		});
		app.on('response:dexmove', function (data) {
			if (data && app.rooms.rooms) app.rooms.rooms.renderDexMove(data);
		});
		app.on('response:dexformat', function (data) {
			if (app.rooms.rooms) app.rooms.rooms.renderDexFormat(data);
		});
		app.on('response:dex', function (data) {
			var query = queries.shift();
			if (!query) return;
			if (data) {
				query.resolve(data);
			} else {
				query.reject(new Error("That dex doesn't exist."));
			}
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
				var dexid = this.dexid;
				var summary = view && DexViews.list.filter(function (dex) { return dex.id === dexid; })[0];
				var count = summary && summary.counts.filter(function (entry) { return entry.table === info[1]; })[0];
				if (!count || !count.customIds) return results;
				var dexRows = [];
				var listed = {};
				$.each([[count.customIds, " custom "], [count.editedIds, " modified "]], function (j, group) {
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

	function editableDexes() {
		var userid = app.user.get('userid');
		return DexViews.list.filter(function (summary) {
			return !summary.official && [summary.owner].concat(summary.editors || []).some(function (name) { return toID(name) === userid; });
		});
	}

	var OFFICIAL_BADGE = '<span class="dexbadge"><i class="fa fa-check-circle"></i> Official</span>';

	var HIDE_BUTTON = '<button class="button" style="float:right;font-size:10pt;margin-top:3px" name="closeHide"><i class="fa fa-caret-right"></i> Hide</button>';

	var roomsInitialize = RoomsRoom.prototype.initialize;
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
			this.$el.scrollTop(0);
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
		renderDex: function (summary, view) {
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
				return '<strong>' + count.name + ':</strong> ' + count.total + ' total, ' + count.custom + ' custom, ' + count.edited + ' edited';
			}).join(' &middot; ') + '</small>';
			buf += '</p><p><button class="button" name="worldDex"><i class="fa fa-globe"></i> Use as world</button>' +
				([summary.owner].concat(summary.editors || []).some(function (name) { return toID(name) === app.user.get('userid'); }) ?
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
			var search = this.dexSearch = new BattleSearch(this.$('.dexpokemon'), this.$el);
			search.engine.getTypedSearch = function (searchType, format, speciesOrSet) {
				var typedSearch = DexSearch.prototype.getTypedSearch.call(this, searchType, 'gen' + view.gen, speciesOrSet);
				if (!typedSearch) return typedSearch;
				typedSearch.dex = view.dex;
				typedSearch.dexView = view;
				typedSearch.dexid = dexid;
				if (searchType === 'pokemon') return typedSearch;
				typedSearch.getBaseResults = function () {
					var table = { move: 'Moves', ability: 'Abilities', item: 'Items' }[searchType];
					var shown = DexViews.entries[dexid];
					var seen = {};
					var results = this.getDefaultResults().filter(function (row) {
						if (row[0] !== searchType) return true;
						seen[row[1]] = 1;
						return !!shown && !!shown[table][row[1]];
					}).filter(function (row, index, rows) {
						return row[0] !== 'header' || (rows[index + 1] && rows[index + 1][0] !== 'header');
					});
					var others = Object.keys(shown ? shown[table] : {}).filter(function (id) { return !seen[id]; }).sort();
					if (!others.length) return results;
					return results.concat([['header', "Other " + table.toLowerCase()]], others.map(function (id) {
						return [searchType, id];
					}));
				};
				return typedSearch;
			};
			var room = this;
			search.$viewport = {
				scrollTop: function () {
					return room.el.scrollTop / room.dexListZoom;
				},
				height: function () {
					return room.el.clientHeight / room.dexListZoom;
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
			if (kind && kind !== 'pokemon' && !DexViews.entries[this.dexid]) app.send('/crq dexentries ' + this.dexid);
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
			var width = this.$el.width();
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
		selectDexFormat: function (format, button) {
			var room = this;
			app.addPopup(DexFormatPopup, { format: format, sourceEl: button, section: this.dexSummary.name, dexid: this.dexSummary.id, onselect: function (newFormat) {
				room.dexFormat = newFormat;
				room.openDexFormat(newFormat);
			} });
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

	var DexFormatPopup = FormatPopup.extend({
		initialize: function (data) {
			this.open = {};
			this.open[data.section] = true;
			FormatPopup.prototype.initialize.call(this, data);
		},
		updateOpen: function () {},
		shouldDisplayFormat: function (format) {
			return format.dexid === this.data.dexid;
		}
	});

	var FORMAT_PICKERS = [['pokemon', 'Pok&eacute;mon', 'Pok\u00E9mon'], ['move', 'Moves', 'moves'], ['ability', 'Abilities', 'abilities'], ['item', 'Items', 'items']];
	var FORMAT_TABS = [['rule', 'Rulesets'], ['banlist', 'Banlist']];
	var FORMAT_BAN_TABS = [['ban', 'Tags'], ['pokemon', 'Pok&eacute;mon'], ['item', 'Items'], ['move', 'Moves'], ['ability', 'Abilities']];
	var FORMAT_TAG_GROUPS = [['pokemon', "Pok\u00E9mon tags"], ['move', "Move tags"], ['other', "Other tags"]];
	var FORMAT_BAN_STATES = { '': "Allowed", banned: "Banned", restricted: "Restricted", unbanned: "Unbanned" };
	var FORMAT_GAME_TYPES = { singles: 'Singles', doubles: 'Doubles', triples: 'Triples', multi: 'Multi', freeforall: 'Free-for-all' };

	var MOVE_TARGETS = {
		normal: "Adjacent", any: "Any", self: "Self", adjacentAlly: "Adjacent ally", adjacentAllyOrSelf: "Ally or self",
		adjacentFoe: "Adjacent foe", allAdjacent: "All adjacent", allAdjacentFoes: "Adjacent foes", allies: "Allies",
		allySide: "Ally side", foeSide: "Foe side", all: "Field", randomNormal: "Random foe", scripted: "Scripted"
	};

	var SPRITE_CELLS = [['front', 'F'], ['back', 'B'], ['front-shiny', 'F*'], ['back-shiny', 'B*'], ['icon', 'I']];

	function hasStandardSprites(id) {
		return !!(window.BattlePokedex && BattlePokedex[id]) && !DexViews.custom.Pokedex[id];
	}

	var roomsShow = RoomsRoom.prototype.show;
	_.extend(RoomsRoom.prototype, {
		openDexPokemon: function (name) {
			var view = this.dexView;
			var species = view.dex.species.get(name);
			if (!view.species[species.id]) return;
			if (this.$('.dexpage').is(':visible')) this.dexScrollTop = this.$el.scrollTop();
			this.dexSpecies = species;
			this.dexMove = null;
			this.$('.dexsearchpage, .dexpage').hide();
			this.$('.dexmonpage').show();
			this.$el.scrollTop(0);

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
			search.engine.getTypedSearch = function (searchType, format, speciesOrSet) {
				var typedSearch = DexSearch.prototype.getTypedSearch.call(this, searchType, format, speciesOrSet);
				if (typedSearch) {
					typedSearch.dex = view.dex;
					typedSearch.dexView = view;
				}
				return typedSearch;
			};
			$results.on('scroll', function () {
				search.updateScroll();
			});
			search.setType('move', 'gen' + view.gen + 'ag', { species: species.name, moves: [] });
			var count = search.resultSet.filter(function (row) { return row[0] === 'move'; }).length;
			this.$('.learnsetcount').val('Learnset: ' + count + (count === 1 ? ' move' : ' moves'));
			this.scaleDexPokemon();
		},
		show: function () {
			roomsShow.apply(this, arguments);
			this.scaleDexList();
			this.scaleDexPokemon();
			this.scaleDexFormat();
		},
		scaleDexFormat: function () {
			var width = this.$el.width();
			this.dexFormatZoom = this.dexFormatZoom || 1;
			if (!width) return;
			this.dexFormatZoom = width < 670 ? width / 670 : 1;
			this.$('.dexformatwrapper').css({ zoom: this.dexFormatZoom === 1 ? '' : this.dexFormatZoom, width: this.dexFormatZoom === 1 ? '' : '670px' });
			if (this.dexFormatSearch) this.dexFormatSearch.updateScroll();
		},
		scaleDexPokemon: function () {
			var $teamwrapper = this.$('.dexmonpage .teamwrapper');
			var width = this.$el.width();
			if (!$teamwrapper.length || !width) return;
			if (width < 640) {
				var scale = width / 640;
				$teamwrapper.css({ transform: 'scale(' + scale + ')', width: '640px', height: (this.$el.height() / scale) + 'px' });
			} else {
				$teamwrapper.css({ transform: '', width: '', height: '' });
			}
		},
		closeDexPokemon: function () {
			this.dexSpecies = null;
			this.dexMove = null;
			this.$('.dexmonpage').hide().empty();
			this.$('.dexpage').show();
			this.$el.scrollTop(this.dexScrollTop || 0);
		},
		clickDexMove: function (e) {
			e.preventDefault();
			var entry = e.currentTarget.dataset.entry.split('|');
			if (entry[0] === 'move') this.openDexMove(entry[1], this.dexSpecies && this.dexSpecies.name);
			if (entry[0] === 'pokemon') this.openDexPokemon(entry[1]);
		},
		openDexMove: function (id, from) {
			var view = this.dexView;
			var move = view.dex.moves.get(id);
			if (!move.exists) return;
			if (this.$('.dexpage').is(':visible')) this.dexScrollTop = this.$el.scrollTop();
			this.dexSpecies = null;
			this.dexMove = move;
			this.dexMoveFrom = from || '';
			this.dexMoveData = null;
			this.dexMoveList = 'learn';
			this.$('.dexsearchpage, .dexpage').hide();
			this.$('.dexmonpage').show();
			this.$el.scrollTop(0);
			app.send('/crq dexmove ' + this.dexid + ',' + move.id);

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
				['Type', move.type], ['Category', move.category], ['Power', move.basePower || '—'],
				['Accuracy', move.accuracy && move.accuracy !== true ? move.accuracy + '%' : '—']
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
			search.engine.getTypedSearch = function (searchType, format, speciesOrSet) {
				var typedSearch = DexSearch.prototype.getTypedSearch.call(this, searchType, format, speciesOrSet);
				if (!typedSearch) return typedSearch;
				typedSearch.dex = view.dex;
				typedSearch.dexView = view;
				var getBaseResults = typedSearch.getBaseResults;
				typedSearch.getBaseResults = function () {
					return getBaseResults.call(this).filter(function (row) {
						return row[0] !== 'pokemon' || this.canLearn(row[1], move.id);
					}, this).filter(function (row, index, rows) {
						return row[0] !== 'header' || (rows[index + 1] && rows[index + 1][0] === 'pokemon');
					});
				};
				return typedSearch;
			};
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
			this.$('.dexmovebase').val(data.base || '—').attr('title', data.base);
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
			if (!data.code.length) buf += '<p><em>No handler code: everything this move does comes from its data.</em></p>';
			for (var i = 0; i < data.code.length; i++) {
				buf += '<h3>' + BattleLog.escapeHTML(data.code[i][0]) + '</h3><pre>' + BattleLog.escapeHTML(data.code[i][1]) + '</pre>';
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
		openDexFormat: function (formatid) {
			this.dexFormat = formatid;
			this.dexFormatId = formatid;
			this.dexFormatSearch = null;
			this.$('.dexformatpage').html('<div class="pad"><p><em style="font-size:20pt">Loading...</em></p></div>');
			app.send('/crq dexformat ' + formatid);
		},
		renderDexFormat: function (details) {
			if (!this.dexFormatId) return;
			var $page = this.$('.dexformatpage');
			if (!details || details.id !== this.dexFormatId) {
				if (!details) $page.find('em').text("That format isn't available.");
				return;
			}
			this.dexFormatDetails = details;
			var settings = {};
			for (var i = 0; i < details.ruleset.length; i++) {
				var spec = details.ruleset[i].replace(/^\^/, '');
				settings[toID(spec.replace(/^!/, ''))] = spec.charAt(0) === '!' ? 'off' : 'on';
			}
			var buf = '<div class="pad" style="padding-top:0">';
			buf += '<p><label class="label">Format:</label><button class="select formatselect" name="selectDexFormat" value="' + BattleLog.escapeHTML(details.id) + '">' + BattleLog.escapeFormat(details.id) + '</button></p>';
			buf += '<div class="formatsettings"><p>';
			buf += '<label class="label">Dex: <strong>' + BattleLog.escapeHTML(details.dex) + '</strong></label> ';
			buf += '<label class="label">Mod: <strong>' + BattleLog.escapeHTML(details.mod) + '</strong></label> ';
			buf += '<label class="label">Game type: <strong>' + BattleLog.escapeHTML(FORMAT_GAME_TYPES[details.gameType] || details.gameType) + '</strong></label></p>';
			buf += '</div><ul class="dexformattabs">';
			for (var j = 0; j < FORMAT_TABS.length; j++) {
				buf += '<li><button class="button" name="showDexFormatList" value="' + FORMAT_TABS[j][0] + '">' + FORMAT_TABS[j][1] + '</button></li>';
			}
			buf += '</ul><ul class="dexformattabs dexformatsubtabs">';
			for (var n = 0; n < FORMAT_BAN_TABS.length; n++) {
				buf += '<li><button class="button" name="showDexFormatList" value="' + FORMAT_BAN_TABS[n][0] + '">' + FORMAT_BAN_TABS[n][1] + '</button></li>';
			}
			buf += '</ul>';
			var ruleById = {};
			var brought = {};
			for (var k = 0; k < details.rulesets.length; k++) ruleById[details.rulesets[k].id] = details.rulesets[k];
			for (var id in ruleById) {
				var ruleChildren = ruleById[id].children || [];
				for (var c = 0; c < ruleChildren.length; c++) brought[ruleChildren[c]] = 1;
			}
			var ruleRoots = Object.keys(ruleById).filter(function (ruleid) {
				var source = details.sources[ruleid];
				return !brought[ruleid] || details.rules.includes(ruleid) && (!source || !ruleById[toID(source)]);
			});
			ruleRoots.sort(function (a, b) {
				return (details.rules.includes(b) ? 1 : 0) - (details.rules.includes(a) ? 1 : 0) || (ruleById[a].name < ruleById[b].name ? -1 : 1);
			});
			this.dexFormatTree = { byId: ruleById, roots: ruleRoots, settings: settings };
			var banGroups = [];
			for (var g = 0; g < FORMAT_TAG_GROUPS.length; g++) {
				var changed = [];
				var unchanged = [];
				for (var t = 0; t < details.tags.length; t++) {
					var tag = details.tags[t];
					if (tag.kind !== FORMAT_TAG_GROUPS[g][0]) continue;
					var ban = details.bans.tags[tag.id];
					(ban && ban.state !== 'unbanned' ? changed : unchanged).push({ name: tag.name, desc: tag.desc, state: ban ? ban.state : '', source: ban && ban.source });
				}
				banGroups.push({ name: FORMAT_TAG_GROUPS[g][1], count: changed.length, bans: changed.concat(unchanged) });
			}
			if (details.bans.other.length) {
				var otherBans = details.bans.other.filter(function (other) { return other.state !== 'unbanned'; });
				var otherUnbans = details.bans.other.filter(function (other) { return other.state === 'unbanned'; });
				banGroups.push({ name: "Other bans", count: otherBans.length, bans: otherBans.concat(otherUnbans) });
			}
			this.dexFormatBans = banGroups;
			buf += '<p class="dexformatsearch" style="display:none"><input type="search" class="textbox" name="formatsearch" size="30" autocomplete="off" /></p></div>';
			buf += '<div class="dexformatlist"></div>';
			$page.html('<div class="dexformatwrapper">' + buf + '</div>');
			this.scaleDexFormat();
			this.showDexFormatList(this.dexFormatKind || 'rule');
		},
		showDexFormatList: function (kind) {
			var $page = this.$('.dexformatpage');
			if (kind === 'banlist') kind = this.dexFormatBanKind || 'ban';
			if (kind !== 'rule') this.dexFormatBanKind = kind;
			this.dexFormatKind = kind;
			$page.find('.dexformattabs button').removeClass('cur').filter('[value="' + kind + '"], [value="' + (kind === 'rule' ? 'rule' : 'banlist') + '"]').addClass('cur');
			$page.find('.dexformatsubtabs').toggle(kind !== 'rule');
			if (kind === 'rule' || kind === 'ban') {
				this.dexFormatSearch = null;
				$page.find('.dexformatsearch').show().find('input').val('').attr('placeholder', kind === 'rule' ? "Search rulesets" : "Search banlist");
				if (kind === 'rule') {
					this.renderDexFormatTree('');
				} else {
					this.renderDexFormatBans('');
				}
				return;
			}
			var view = this.dexView;
			var details = this.dexFormatDetails;
			var picker = FORMAT_PICKERS.filter(function (entry) { return entry[0] === kind; })[0];
			var legal = {};
			for (var i = 0; i < details.legal[kind].length; i++) legal[details.legal[kind][i]] = 1;
			var banned = {};
			for (var b = 0; b < details.banned[kind].length; b++) banned[details.banned[kind][b]] = 1;
			var outright = {};
			for (var n = 0; n < details.outright.length; n++) outright[details.outright[n]] = 1;
			var onTop = kind === 'pokemon' ? outright : banned;
			var $list = $page.find('.dexformatlist');
			var search = this.dexFormatSearch = new BattleSearch($list, this.$el);
			search.renderRow = function (id, type, matchStart, matchLength, errorMessage, attrs) {
				if (type === kind && banned[id]) attrs = attrs ? attrs.replace('class="', 'class="banned ') : ' class="banned"';
				return BattleSearch.prototype.renderRow.call(this, id, type, matchStart, matchLength, errorMessage, attrs);
			};
			var room = this;
			search.$viewport = {
				scrollTop: function () {
					return room.el.scrollTop / room.dexFormatZoom;
				},
				height: function () {
					return room.el.clientHeight / room.dexFormatZoom;
				}
			};
			search.engine.getTypedSearch = function (searchType, format, speciesOrSet) {
				var typedSearch = DexSearch.prototype.getTypedSearch.call(this, searchType, format, speciesOrSet);
				if (!typedSearch) return typedSearch;
				typedSearch.dex = view.dex;
				typedSearch.dexView = view;
				typedSearch.dexid = room.dexid;
				typedSearch.isNatDex = details.rules.includes('natdexmod');
				typedSearch.isDoubles = details.gameType !== 'singles';
				var getBaseResults = typedSearch.getBaseResults;
				typedSearch.getBaseResults = function () {
					var seen = {};
					var bannedRows = [];
					var results = getBaseResults.call(this).filter(function (row) {
						if (row[0] !== searchType) return true;
						if (seen[row[1]] || !legal[row[1]] && !banned[row[1]]) return false;
						seen[row[1]] = 1;
						if (!onTop[row[1]]) return true;
						bannedRows.push(row);
						return false;
					}).filter(function (row, index, rows) {
						return row[0] !== 'header' || (rows[index + 1] && rows[index + 1][0] === searchType);
					});
					for (var id in legal) {
						if (!seen[id]) results.push([searchType, id]);
					}
					for (var bannedid in banned) {
						if (!seen[bannedid]) (onTop[bannedid] ? bannedRows : results).push([searchType, bannedid]);
					}
					if (!results.some(function (row) { return row[0] === 'header'; })) results.unshift(['header', picker[1]]);
					if (!bannedRows.length) return results;
					bannedRows.unshift(['header', "Banned " + picker[2]]);
					return bannedRows.concat(results);
				};
				return typedSearch;
			};
			$page.find('.dexformatsearch').show().find('input').val('').attr('placeholder', 'Search legal ' + picker[2]);
			search.setType(kind, 'gen' + view.gen + 'ag');
		},
		renderDexFormatTree: function (query) {
			query = query.toLowerCase();
			var details = this.dexFormatDetails;
			var tree = this.dexFormatTree;
			var renderNode = function (ruleid, ancestors, parentActive) {
				var rule = tree.byId[ruleid];
				var on = details.rules.includes(ruleid);
				var off = !on && tree.settings[ruleid] === 'off';
				var source = details.sources[ruleid];
				var parent = ancestors.length ? ancestors[ancestors.length - 1] : '';
				var activeHere = on && parentActive && (!parent || toID(source || '') === parent);
				var elsewhere = on && !activeHere;
				var kids = (rule.children || []).filter(function (child) {
					return tree.byId[child] && !ancestors.includes(child);
				}).sort(function (a, b) {
					return tree.byId[a].name < tree.byId[b].name ? -1 : 1;
				});
				var childBuf = '';
				for (var i = 0; i < kids.length; i++) childBuf += renderNode(kids[i], ancestors.concat([ruleid]), activeHere);
				if (query && !childBuf && !(rule.name + ' ' + (rule.desc || '')).toLowerCase().includes(query)) return '';
				var title = on ? (source ? "Required by " + source + (elsewhere ? ", highlighted there" : "") : elsewhere ? "On, highlighted at the top" : "On") :
					off ? "Off, switched off by this format" : "Off";
				return '<li><button type="button" class="button' + (on ? (elsewhere ? ' ruleelsewhere' : ' ruleon') : '') + '" title="' + BattleLog.escapeHTML(title) + '">' +
					BattleLog.escapeHTML(rule.name) + '</button>' +
					(rule.desc ? ' <small class="ruletreedesc">' + BattleLog.sanitizeHTML(rule.desc) + '</small>' : '') +
					(childBuf ? '<ul>' + childBuf + '</ul>' : '') + '</li>';
			};
			var buf = '';
			for (var i = 0; i < tree.roots.length; i++) buf += renderNode(tree.roots[i], [], true);
			this.$('.dexformatlist').html(
				'<div class="ruletree"><strong>' + BattleLog.escapeFormat(details.id) + '</strong>' +
				(buf ? '<ul>' + buf + '</ul>' : '<p><em>Nothing matches.</em></p>') + '</div>'
			);
		},
		renderDexFormatBans: function (query) {
			query = query.toLowerCase();
			var buf = '';
			for (var g = 0; g < this.dexFormatBans.length; g++) {
				var group = this.dexFormatBans[g];
				var groupBuf = '';
				for (var i = 0; i < group.bans.length; i++) {
					var ban = group.bans[i];
					if (query && !(ban.name + ' ' + (ban.desc || '')).toLowerCase().includes(query)) continue;
					var title = FORMAT_BAN_STATES[ban.state] + (ban.source ? " by " + ban.source : "");
					groupBuf += '<li><button type="button" class="button' + (ban.state && ban.state !== 'unbanned' ? ' ruleoff' : '') + '" title="' + BattleLog.escapeHTML(title) + '">' +
						BattleLog.escapeHTML(ban.name) + '</button>' +
						(ban.desc ? ' <small class="ruletreedesc">' + BattleLog.sanitizeHTML(ban.desc) + '</small>' : '') + '</li>';
				}
				if (groupBuf) buf += '<li><strong>' + BattleLog.escapeHTML(group.name) + '</strong> <small>(' + group.count + ')</small><ul>' + groupBuf + '</ul></li>';
			}
			this.$('.dexformatlist').html(
				'<div class="ruletree"><strong>' + BattleLog.escapeFormat(this.dexFormatDetails.id) + '</strong>' +
				(buf ? '<ul>' + buf + '</ul>' : '<p><em>Nothing matches.</em></p>') + '</div>'
			);
		},
		searchDexFormat: function (e) {
			if (this.dexFormatSearch) {
				this.dexFormatSearch.find(e.currentTarget.value);
			} else if (this.dexFormatKind === 'rule') {
				this.renderDexFormatTree(e.currentTarget.value);
			} else if (this.dexFormatKind === 'ban') {
				this.renderDexFormatBans(e.currentTarget.value);
			}
		},
		clickDexFormatEntry: function (e) {
			e.preventDefault();
			var entry = e.currentTarget.dataset.entry.split('|');
			if (['pokemon', 'move', 'ability', 'item'].includes(entry[0]) || !this.dexFormatSearch.addFilter(e.currentTarget)) return;
			this.$('input[name=formatsearch]').val('');
			this.dexFormatSearch.find('');
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
		}
	});

	function baseValue(summary) {
		return summary.parents.length ? summary.parents.join('+') : summary.mod;
	}

	function baseOptions(summary) {
		var current = summary ? baseValue(summary) : 'gen9';
		var found = false;
		var option = function (value, label) {
			if (value === current) found = true;
			return '<option value="' + BattleLog.escapeHTML(value) + '"' + (value === current ? ' selected' : '') + '>' + BattleLog.escapeHTML(label) + '</option>';
		};
		var group = function (label, list) {
			if (!list.length) return '';
			return '<optgroup label="' + label + '">' + list.map(function (dex) {
				return { id: dex.id, label: '[Gen ' + DexViews.genOf(dex.mod) + '] ' + dex.name };
			}).sort(function (a, b) {
				return a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' });
			}).map(function (dex) {
				return option(dex.id, dex.label);
			}).join('') + '</optgroup>';
		};
		var others = DexViews.list.filter(function (dex) { return !summary || dex.id !== summary.id; });
		var buf = '<optgroup label="Games">';
		for (var gen = 9; gen >= 1; gen--) buf += option('gen' + gen, 'Gen ' + gen);
		buf += '</optgroup>';
		buf += group("Official dexes", others.filter(function (dex) { return dex.official; }));
		buf += group("Dexes", others.filter(function (dex) { return !dex.official; }));
		if (!found) buf = option(current, summary.base) + buf;
		return buf;
	}

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

	var DexCreatePopup = Popup.extend({
		type: 'semimodal',
		initialize: function () {
			var buf = '<form class="dexcreate"><p><label class="label">Name:<input type="text" class="textbox autofocus" name="name" maxlength="40" /></label></p>';
			buf += '<p><label class="label">World:<br /><select name="base" class="button">' + baseOptions(null) + '</select></label></p>';
			buf += '<p><label class="label"><input type="checkbox" name="unlisted" /> Private (unlisted)</label></p>';
			buf += '<p class="buttonbar"><button type="submit" class="button"><strong>Create</strong></button> <button type="button" name="close" class="button">Cancel</button></p></form>';
			this.$el.html(buf);
		},
		submit: function (data) {
			if (!$.trim(data.name)) return;
			this.close();
			app.send('/crq dexcreate ' + JSON.stringify({ name: $.trim(data.name), base: data.base, visibility: data.unlisted ? 'private' : 'public' }));
		}
	});

	window.DexBuilderRoom = window.Room.extend({
		type: 'dexbuilder',
		title: 'Dexbuilder',
		events: {
			'click .selectFolder': 'selectFolder',
			'click .team': 'clickDexTeam',
			'submit form.dexsettings': 'submitDexSettings',
			'change form.dexsettings input[name=name]': 'saveDexName',
			'change form.dexsettings input[name=private]': 'saveDexPrivate',
			'change form.dexsettings select[name=base]': 'saveDexBase',
			'input form.dexsettings textarea[name=description]': 'queueDexDescription',
			'change form.dexsettings textarea[name=description]': 'saveDexDescription',
			'submit form.dexeditors': 'addDexEditor'
		},
		initialize: function () {
			this.$el.addClass('ps-room-light').addClass('scrollable');
			this.curFolder = '';
			this.update();
		},
		focus: function () {
			app.send('/crq dexes');
		},
		update: function () {
			if (!this.$('.folderpane').length) this.$el.html('<div class="folderpane"></div><div class="teampane"></div>');
			var userid = app.user.get('userid');
			var dexes = DexViews.list.filter(function (summary) {
				return [summary.owner].concat(summary.editors || []).some(function (name) { return toID(name) === userid; });
			});
			var official = dexes.filter(function (summary) { return summary.official; });
			var slots = dexes.filter(function (summary) { return !summary.official && toID(summary.owner) === userid; });
			var shared = dexes.filter(function (summary) { return !summary.official && toID(summary.owner) !== userid; });
			var all = slots.concat(shared, official);
			var folders = all.map(function (summary) { return summary.id; });
			if (folders.indexOf(this.curFolder) < 0) this.curFolder = folders[0] || '';
			this.free = Math.max(0, DEX_SLOTS - slots.length);
			this.updateFolderList(slots, shared, official);
			var summary = all[folders.indexOf(this.curFolder)];
			var key = JSON.stringify([userid, summary, this.free]);
			if (key === this.teamListKey) return;
			this.teamListKey = key;
			this.updateTeamList(summary);
		},
		updateFolderList: function (slots, shared, official) {
			var buf = '<div class="folderlist"><div class="folderlistbefore"></div>';
			buf += '<div class="folder"><h3>Dexes</h3></div>';
			for (var i = 0; i < slots.length; i++) buf += this.folderHTML(slots[i]);
			buf += '<div class="folder"><div class="selectFolder" data-value="+"><i class="fa fa-plus"></i><em>(new dex)</em></div></div>';
			if (shared.length) buf += '<div class="foldersep"></div><div class="folder"><h3>Shared with you</h3></div>';
			for (var i = 0; i < shared.length; i++) buf += this.folderHTML(shared[i]);
			if (official.length) buf += '<div class="foldersep"></div><div class="folder"><h3>Official</h3></div>';
			for (var i = 0; i < official.length; i++) buf += this.folderHTML(official[i]);
			buf += '<div class="folderlistafter"></div></div>';
			this.$('.folderpane').html(buf);
		},
		folderHTML: function (summary) {
			var cur = this.curFolder === summary.id;
			return '<div class="folder' + (cur ? ' cur"><div class="folderhack3"><div class="folderhack1"></div><div class="folderhack2"></div>' : '">') +
				'<div class="selectFolder" data-value="' + BattleLog.escapeHTML(summary.id) + '"><i class="fa ' + (cur ? 'fa-folder-open' : 'fa-folder') + '"></i>' +
				BattleLog.escapeHTML(summary.name) + '</div></div>' + (cur ? '</div>' : '');
		},
		updateTeamList: function (summary) {
			var sameDex = summary && this.curSummary && this.curSummary.id === summary.id && this.$('form.dexsettings').length;
			this.curSummary = summary;
			if (!summary) {
				var buf = '<h2><i class="fa fa-folder-open-o"></i> Dexes</h2>';
				buf += '<ul class="teamlist"><li><p><em>' + (app.user.get('named') ? 'you don\'t have any dexes lol' : 'log in to make dexes') + '</em></p></li></ul>';
				this.$('.teampane').html(buf);
				return;
			}
			var userid = app.user.get('userid');
			var isOwner = toID(summary.owner) === userid;
			if (sameDex) {
				this.syncDexSettings();
				this.$('.dexheading').html(this.dexHeadingHTML());
				this.$('.dexrest').html(this.dexRestHTML(isOwner, userid));
				return;
			}
			this.saveState = '';
			var locked = isOwner ? '' : ' disabled';
			var buf = '<h2 class="dexheading">' + this.dexHeadingHTML() + '</h2>';
			buf += '<form class="dexsettings"><div class="dexsettingsrow">';
			buf += '<p><label class="label">Name:</label><input type="text" class="textbox" name="name" value="' + BattleLog.escapeHTML(summary.name) + '" size="24" maxlength="40"' + locked + ' /></p>';
			buf += '<p><label class="label">World:</label><select name="base" class="button"' + locked + '>' + baseOptions(summary) + '</select></p>';
			buf += '<p><label class="checkbox"><input type="checkbox" name="private"' + (summary.visibility === 'private' ? ' checked' : '') + locked + ' /> Private (unlisted)</label></p>';
			buf += '</div><p><label class="label">Description:</label><textarea class="textbox" name="description" rows="4" maxlength="512">' + BattleLog.escapeHTML(summary.description || '') + '</textarea></p></form>';
			buf += '<div class="dexrest">' + this.dexRestHTML(isOwner, userid) + '</div>';
			this.$('.teampane').html(buf);
		},
		dexHeadingHTML: function () {
			var summary = this.curSummary;
			var state = this.saveState === 'saving' ? '<i class="fa fa-refresh"></i> Saving...' :
				this.saveState === 'failed' ? '<i class="fa fa-exclamation-triangle"></i> Not saved' :
				this.saveState === 'saved' ? '<i class="fa fa-check"></i> Saved' : '';
			return (summary.official ? OFFICIAL_BADGE : '') + '<i class="fa fa-folder-open"></i> ' + BattleLog.escapeHTML(summary.name) +
				(state ? ' <small class="dexsavestate">' + state + '</small>' : '');
		},
		dexRestHTML: function (isOwner, userid) {
			var summary = this.curSummary;
			var buf = '<h3>Editors</h3><form class="dexeditors">';
			if (!summary.editors.length) buf += '<p><em>Only ' + BattleLog.escapeHTML(summary.owner) + ' can edit this dex.</em></p>';
			for (var i = 0; i < summary.editors.length; i++) {
				var editor = summary.editors[i];
				buf += '<p>' + BattleLog.escapeHTML(editor) + (isOwner || toID(editor) === userid ?
					' <button class="button small" name="removeDexEditor" value="' + BattleLog.escapeHTML(editor) + '"><i class="fa fa-times"></i> Remove</button>' : '') + '</p>';
			}
			if (isOwner) {
				buf += '<p><input type="text" class="textbox" name="editor" placeholder="Username" size="20" /> <button type="submit" class="button"><i class="fa fa-user-plus"></i> Add editor</button></p>';
			}
			buf += '</form>';
			buf += '<p><button class="button" name="viewDex"><i class="fa fa-book"></i> View dex page</button>';
			if (isOwner) {
				buf += ' <button class="button" name="clearDex"><i class="fa fa-eraser"></i> Clear dex</button>' +
					' <button class="button" name="deleteDex"><i class="fa fa-trash"></i> Delete dex</button>';
			}
			buf += '</p>';

			summary.formats.sort(compareFormats);
			buf += '<h2>Formats <small style="font-weight: normal">(' + summary.formats.length + ')</small></h2>';
			buf += '<ul class="teamlist">';
			if (!summary.formats.length) buf += '<li><p><em>this dex doesn\'t have any formats lol</em></p></li>';
			for (var i = 0; i < summary.formats.length; i++) {
				buf += '<li><div class="team" data-format="' + BattleLog.escapeHTML(summary.formats[i].id) + '"><strong>' + BattleLog.escapeHTML(summary.formats[i].name) + '</strong><small></small></div></li>';
			}
			buf += '</ul>';
			return buf;
		},
		syncDexSettings: function () {
			var summary = this.curSummary;
			var $form = this.$('form.dexsettings');
			var $name = $form.find('input[name=name]');
			if (!$name.is(':focus')) $name.val(summary.name);
			$form.find('select[name=base]').html(baseOptions(summary));
			$form.find('input[name=private]').prop('checked', summary.visibility === 'private');
			var $description = $form.find('textarea[name=description]');
			if (!$description.is(':focus') && !this.descriptionTimer) $description.val(summary.description || '');
		},
		setSaveState: function (state) {
			this.saveState = state;
			if (this.curSummary) this.$('.dexheading').html(this.dexHeadingHTML());
		},
		selectFolder: function (e) {
			var value = e.currentTarget.dataset.value;
			if (value === '+') {
				this.newDex(e.currentTarget);
				return;
			}
			this.curFolder = value;
			this.update();
		},
		newDex: function (sourceEl) {
			if (!app.user.get('named')) {
				app.addPopup(Popup, { message: "Log in to make dexes.", sourceEl: sourceEl });
				return;
			}
			if (!this.free) {
				app.addPopup(Popup, { message: "You can own at most " + DEX_SLOTS + " dexes.", sourceEl: sourceEl });
				return;
			}
			app.addPopup(DexCreatePopup, { sourceEl: sourceEl });
		},
		editDex: function (edit) {
			this.setSaveState('saving');
			app.send('/crq dexedit ' + this.curSummary.id + ', ' + JSON.stringify(edit));
		},
		submitDexSettings: function (e) {
			e.preventDefault();
			this.saveDexName();
		},
		saveDexName: function () {
			var $name = this.$('form.dexsettings input[name=name]');
			var name = $.trim($name.val());
			if (!name || name === this.curSummary.name) return $name.val(this.curSummary.name);
			this.editDex({ name: name });
		},
		saveDexPrivate: function (e) {
			this.editDex({ visibility: e.currentTarget.checked ? 'private' : 'public' });
		},
		queueDexDescription: function () {
			var self = this;
			clearTimeout(this.descriptionTimer);
			this.descriptionTimer = setTimeout(function () { self.saveDexDescription(); }, 1000);
		},
		saveDexDescription: function () {
			clearTimeout(this.descriptionTimer);
			this.descriptionTimer = null;
			var description = $.trim(this.$('form.dexsettings textarea[name=description]').val());
			if (description !== (this.curSummary.description || '')) this.editDex({ description: description });
		},
		saveDexBase: function (e) {
			var summary = this.curSummary;
			var $select = $(e.currentTarget);
			var base = $select.val();
			var label = $select.find('option:selected').text();
			$select.val(baseValue(summary));
			var self = this;
			app.addPopup(DexConfirmPopup, {
				message: 'Change the world of ' + BattleLog.escapeHTML(summary.name) + ' to ' + BattleLog.escapeHTML(label) + '?<br /><br />' +
					'Its Pok&eacute;mon go back to the new world\'s, and custom or edited things that don\'t work on it are skipped until you fix them. ' +
					'If too much breaks, you may need to clear the dex.',
				button: "Change world",
				sourceEl: e.currentTarget,
				callback: function () { self.editDex({ base: base }); }
			});
		},
		addDexEditor: function (e) {
			e.preventDefault();
			var name = $.trim(this.$('input[name=editor]').val());
			if (name) this.editDex({ editor: name, add: true });
		},
		removeDexEditor: function (name) {
			this.editDex({ editor: name });
		},
		viewDex: function () {
			openDexPage(app, this.curSummary.id);
		},
		clearDex: function () {
			var self = this;
			app.addPopup(DexConfirmPopup, {
				message: 'Clear ' + BattleLog.escapeHTML(this.curSummary.name) + '?<br /><br />This deletes every custom or edited Pok&eacute;mon, move, ability, item, condition and type, and puts back the world\'s Pok&eacute;mon. ' +
					'Its name, description, editors and formats are kept.',
				button: "Clear dex",
				callback: function () { self.editDex({ clear: true }); }
			});
		},
		deleteDex: function () {
			var self = this;
			app.addPopup(DexConfirmPopup, {
				message: 'Delete ' + BattleLog.escapeHTML(this.curSummary.name) + '? This can\'t be undone. Replays of its battles keep working.',
				button: "Delete dex",
				callback: function () { self.editDex({ 'delete': true }); }
			});
		},
		clickDexTeam: function (e) {
			var data = e.currentTarget.dataset;
			app.joinRoom('rooms');
			app.rooms.rooms.openDex(this.curFolder);
			app.rooms.rooms.dexFormat = data.format;
			app.rooms.rooms.showDexTab('formats');
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

})(window.jQuery);
