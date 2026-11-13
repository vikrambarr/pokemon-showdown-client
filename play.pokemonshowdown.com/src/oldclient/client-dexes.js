(function ($) {

	var TIERS = [
		'AG', '(AG)', 'Uber', '(Uber)', 'OU', '(OU)', 'UUBL', 'UU', 'RUBL', 'RU', 'NUBL', 'NU', '(NU)', 'PUBL', 'PU', '(PU)', 'ZUBL', 'ZU',
		'DUber', '(DUber)', 'DOU', 'DBL', '(DOU)', 'DUU', '(DUU)', 'Mythical', 'Restricted Legendary', 'Regular', 'New', 'NFE', 'LC', 'CAP', 'CAP NFE', 'CAP LC', 'Unreleased', 'Illegal'
	];
	var DOUBLES_TIERS = ['DUber', '(DUber)', 'DOU', 'DBL', '(DOU)', 'DUU', '(DUU)', 'NFE', 'LC', 'Unreleased', 'Illegal'];
	var NATDEX_MODS = ['gen9insurgence', 'gen9uranium', 'gen9infinity', 'gen9infinitefusion', 'gen9chaos', 'gen9chaosmayhem'];
	var EFFECT_KINDS = { Moves: 'move', Abilities: 'ability', Items: 'item', Conditions: 'condition', TypeChart: 'type' };
	var ENTRY_TABLES = { pokemon: 'Pokedex', move: 'Moves', ability: 'Abilities', item: 'Items', condition: 'Conditions' };
	var SEARCH_TABLES = { move: 'Moves', ability: 'Abilities', item: 'Items' };
	var GETTERS = { Pokedex: 'species', Moves: 'moves', Abilities: 'abilities', Items: 'items' };

	var FORMAT_TIERS = ['Random Battle', 'Randbat', 'OU', 'Ubers', 'UU', 'RU', 'NU', 'PU', 'AG', 'LC', 'VGC'];
	var FORMAT_GROUPS = [/Doubles|VGC/, /Free-for-all|FFA|Multi/i, /Draft/, /Custom Game|\bCG$/];
	var FORMAT_VARIANTS = [/Doubles|VGC/, /Free-for-all|FFA/i, /Multi/];

	var DexViews = window.DexViews;
	var requests = {};
	var preloaded = {};
	DexViews.list = [];
	DexViews.formats = {};
	DexViews.entries = {};
	DexViews.formatDetails = {};

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

	var missingEntries = {};

	function toSet(ids) {
		var set = {};
		for (var i = 0; i < ids.length; i++) set[ids[i]] = 1;
		return set;
	}

	function loadEntries(dexid) {
		if (DexViews.entries[dexid] || !dexid || missingEntries[dexid]) return;
		var ready = preloaded[dexid];
		var current = DexViews.list.filter(function (other) { return other.id === dexid; })[0];
		delete preloaded[dexid];
		(ready && current && ready.hash === current.hash ? Promise.resolve(ready.entries) : request('dexentries', dexid)).then(function (data) {
			var entries = { custom: data.custom, modified: data.modified, names: data.names, choices: data.choices, species: data.Pokedex, world: toSet(data.world || []), needed: toSet(data.needed || []), own: data.own, originals: data.originals || {}, conditions: data.conditions || {}, types: data.types || {} };
			$.each(['Moves', 'Abilities', 'Items', 'Conditions'], function (i, table) {
				var ids = entries[table] = {};
				for (var j = 0; j < data[table].length; j++) ids[data[table][j]] = 1;
			});
			DexViews.entries[dexid] = entries;
			var summary = DexViews.list.filter(function (other) { return other.id === dexid; })[0];
			var view = summary && DexViews.views[summary.hash];
			if (view && view.dexid) DexViews.entries[view.dexid] = entries;
			$.each(dexRooms(), function (j, room) {
				if (room.dexid !== dexid && !(room.dexView && room.dexView.dexid === dexid)) return;
				var typedSearch = room.dexSearch && room.dexSearch.engine.typedSearch;
				if (typedSearch) room.dexSearch.setType(typedSearch.searchType, 'gen' + room.dexView.gen);
				if (room.dexSelect) room.dexSelect.render();
				if (room.dexFormatSearch && room.dexFormatKind) room.showDexFormatList(room.dexFormatKind);
				if (room.dexSpecies) room.updateDexLearnsetCount(true);
				if (room.dexSummary && room.dexSummary.counts[room.dexTab] && room.dexSummary.counts[room.dexTab].table === 'TypeChart') room.showDexTab(room.dexTab);
				if (room.dexEffect && room.dexEffectData) room.renderDexEffect();
			});
		}, function () {
			missingEntries[dexid] = true;
		});
	}

	DexViews.loadEntries = loadEntries;

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
				format.id = data.id;
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

	function loadFormatDetails(room, formatid) {
		if (DexViews.formatDetails[formatid]) return;
		request('dexformat', formatid).then(function (details) {
			var legal = {};
			for (var i = 0; i < details.legal.pokemon.length; i++) legal[details.legal.pokemon[i]] = 1;
			DexViews.formatDetails[formatid] = { rules: details.rules, gameType: details.gameType, mod: details.mod, tiers: details.tiers, legal: legal };
			if (!room.curTeam || room.curTeam.format !== formatid) return;
			room.update();
			if (room.curSet && room.curChartType) room.updateChart(true);
		}, function () {});
	}

	function useTeamDex(room) {
		var team = room.curTeam;
		var summary = team && formatDex(team.format);
		if (!summary) return;
		loadFormatDetails(room, team.format);
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
	var updateFolderList = TeambuilderRoom.prototype.updateFolderList;
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
		updateFolderList: function () {
			var curFolder = this.curFolder;
			var curFolderKeep = this.curFolderKeep;
			if (formatDex(curFolder)) this.curFolder = 'genX' + curFolder;
			if (formatDex(curFolderKeep)) this.curFolderKeep = 'genX' + curFolderKeep;
			try {
				updateFolderList.apply(this, arguments);
			} finally {
				this.curFolder = curFolder;
				this.curFolderKeep = curFolderKeep;
			}
			var $header = this.$('.folderpane h3').filter(function () { return $(this).text() === '???'; }).closest('.folder');
			var folders = $header.nextUntil('.foldersep').filter(function () {
				if (!$(this).find('.selectFolder').attr('data-value').startsWith('genXgenX')) return true;
				$(this).remove();
				return false;
			}).get().map(function (el) {
				var $select = $(el).find('.selectFolder');
				var format = $select.attr('data-value').slice(4);
				var summary = formatDex(format);
				$select.attr('data-value', format);
				if (summary) $select.contents().last().replaceWith(BattleLog.escapeHTML(format.slice(summary.id.length)));
				return { el: el, dex: summary ? summary.name : '???', format: format };
			}).sort(function (a, b) {
				return (a.dex === '???') - (b.dex === '???') || a.dex.localeCompare(b.dex) || a.format.localeCompare(b.format);
			});
			var $last = $header;
			var dex = null;
			for (var i = 0; i < folders.length; i++) {
				if (folders[i].dex !== dex) {
					dex = folders[i].dex;
					$last = $('<div class="folder"><h3></h3></div>').find('h3').text(dex).end().insertAfter($last);
				}
				$last = $(folders[i].el).insertAfter($last);
			}
			$header.remove();
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
			var previous = {};
			$.each(DexViews.list, function (i, summary) { previous[summary.id] = summary; });
			DexViews.list = list.map(function (summary) { return summary.hash ? summary : previous[summary.id]; });
			addFormats();
			if (app.rooms.teambuilder) app.rooms.teambuilder.updateFolderList();
			if (app.rooms.rooms) app.rooms.rooms.updateDexSearch();
			$.each(dexRooms(), function (i, room) {
				room.update();
			});
		});
		app.on('response:dexcreate response:dexedit', function (data) {
			if (!data) return;
			if (data.dex) DexViews.layers[data.dex.hash] = DexViews.layers[data.dex.hash] || Promise.resolve(data.dex);
			if (data.entries) preloaded[data.id] = { hash: data.hash, entries: data.entries };
			if (app.rooms.dexbuilder && app.rooms.dexbuilder.answerDexEdit(data)) return;
			showSaveProblems(data.error ? [data.error] : [], data.stale);
			if (app.rooms.dexbuilder && app.rooms.dexbuilder.saveState === 'saving') app.rooms.dexbuilder.setSaveState(data.error ? 'failed' : 'saved');
			if (data.id !== undefined && app.rooms.dexbuilder) app.rooms.dexbuilder.curFolder = data.id || '';
			if (data.formatid) {
				delete DexViews.formatDetails[data.formatid];
				if (app.rooms.dexbuilder) app.rooms.dexbuilder.dexFormat = data.formatid;
			}
			listDexes(data.dexes);
		});
		app.on('response:dexfork response:dexforkline', function (data) {
			if (!data) return;
			app.addPopup(Popup, { htmlMessage: data.error ? BattleLog.escapeHTML(data.error) : BattleLog.sanitizeHTML(data.html) });
			app.send('/crq dexes');
		});
		$.each(['dex', 'dexentries', 'dexeffect', 'dexformat', 'dexrules', 'dexupload', 'dexstorage', 'dexsource', 'dexcredits', 'dexsetcredits', 'dexcreditsearch', 'dexeditors'], function (i, cmd) {
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
			var suffix = format.startsWith(summary.id) ? format.slice(summary.id.length) : 'ou';
			var search = getTypedSearch.call(this, searchType, 'gen' + view.gen + suffix, speciesOrSet);
			if (!search) return search;
			search.dex = view.dex;
			search.dexView = view;
			search.formatDetails = DexViews.formatDetails[toID(format)];
			if (search.formatDetails) setTierStyle(search, search.formatDetails);
			var table = SEARCH_TABLES[searchType];
			if (!table) return search;
			var getDefaultResults = search.getDefaultResults;
			search.getDefaultResults = function () {
				var results = getDefaultResults.apply(this, arguments).slice();
				var start = results.findIndex(function (row) { return row[0] === 'header' && row[1] === table; }) + 1;
				var listed = {};
				for (var i = 0; i < results.length; i++) listed[results[i][1]] = 1;
				Object.keys(view[table]).sort().forEach(function (id) {
					if (!DexViews.custom[table][id] || listed[id] || view[table][id].isPokeball) return;
					var end = start;
					while (end < results.length && results[end][0] !== 'header' && results[end][1] < id) end++;
					results.splice(end, 0, [searchType, id]);
				});
				return results;
			};
			return search;
		};

		var inFormatDex = function (formatid, callback) {
			var summary = formatid && formatDex(formatid);
			var view = summary && DexViews.views[summary.hash];
			if (!view) return callback(formatid);
			var mod = Dex.mod;
			Dex.mod = function () { return view.dex; };
			try {
				return callback('gen' + view.gen + formatid.slice(summary.id.length));
			} finally {
				Dex.mod = mod;
			}
		};
		var StatGuesser = window.BattleStatGuesser;
		var StatOptimizer = window.BattleStatOptimizer;
		window.BattleStatGuesser = function (formatid) {
			return inFormatDex(formatid, function (id) { return new StatGuesser(id); });
		};
		window.BattleStatOptimizer = function (set, formatid) {
			return inFormatDex(formatid, function (id) { return StatOptimizer(set, id); });
		};

		var TypedSearch = window.BattleTypedSearch;

		var find = DexSearch.prototype.find;
		DexSearch.prototype.find = function (query) {
			var changed = find.apply(this, arguments);
			var view = this.typedSearch && this.typedSearch.dexView;
			if (!this.results) return changed;
			if (view && !DexViews.entries[view.dexid]) loadEntries(view.dexid);
			var filter = this.typedSearch && this.typedSearch.dexFilter;
			this.results = this.results.filter(function (row) {
				return filter ? filter(row) : shownInDex(view, row);
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

		DexViews.learnsetOf = learnsetOf;

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
			var seen = {};
			while (learnsetid && !seen[learnsetid]) {
				seen[learnsetid] = 1;
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
			var override = !this.isVGC && this.tierOverrides && this.tierOverrides[species.id];
			var field = this.isDoubles ? 'doublesTier' : this.isNatDex ? 'natDexTier' : 'tier';
			if (override && override[field]) return override[field];
			var data = DexViews.tierData(this.dexView, species);
			if (this.isVGC) {
				var tags = this.dex.species.get(species.baseSpecies).tags || [];
				if (species.isNonstandard && species.isNonstandard !== 'Unobtainable') return 'Illegal';
				if (tags.includes('Mythical')) return 'Mythical';
				if (tags.includes('Restricted Legendary')) return 'Restricted Legendary';
				if (data.tier === 'NFE' || data.tier === 'LC') return data.tier;
				return 'Regular';
			}
			var tier = (this.isDoubles ? data.doublesTier : this.isNatDex ? data.natDexTier : '') || data.tier ||
				((data.doublesTier || data.natDexTier) && 'Illegal');
			if (tier && this.isDoubles && !DOUBLES_TIERS.includes(tier)) return '(DUU)';
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
			for (var id in this.dexPool || this.dexView.species) {
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
				if (order[i] === 'Illegal' && this.formatDetails || this.isLC && order[i] !== 'LC') continue;
				results.push(['header', tierHeader(order[i])]);
				tiers[order[i]].sort(function (a, b) { return a.num - b.num || (a.name < b.name ? -1 : 1); });
				for (var j = 0; j < tiers[order[i]].length; j++) results.push(['pokemon', tiers[order[i]][j].id]);
			}
			var legal = this.formatDetails && this.formatDetails.legal;
			return dropEmptyHeaders(results.filter(function (row) {
				return row[0] !== 'pokemon' || !self.dex.species.get(row[1]).isCosmeticForme && (!legal || legal[row[1]]);
			}));
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
				var view = this.dexid && this.dexView;
				var entries = view && DexViews.entries[this.dexid];
				if (view && !entries) loadEntries(this.dexid);
				if (!entries) return results;
				var dexRows = [];
				var listed = {};
				$.each([[entries.custom[info[1]], "Custom "], [entries.modified[info[1]], "Modified "]], function (j, group) {
					var ids = group[0].filter(function (id) { return view[info[1]][id] && !view[info[1]][id].isPokeball; }).sort();
					for (var k = 0; k < ids.length; k++) listed[ids[k]] = 1;
					if (ids.length) dexRows.push(['header', group[1] + info[3]]);
					dexRows = dexRows.concat(ids.map(function (id) { return [info[2], id]; }));
				});
				if (results.length && results[0][0] !== 'header') results = [['header', info[1]]].concat(results);
				if (!dexRows.length) return results;
				results = results.filter(function (row) { return !listed[row[1]]; });
				return dexRows.concat(results);
			};
		});
	});

	function shownInDex(view, row) {
		var table = DexViews.custom[ENTRY_TABLES[row[0]]] && ENTRY_TABLES[row[0]];
		if (!table || !view) return !table || !DexViews.custom[table][row[1]];
		if (table === 'Pokedex') return !!view.species[row[1]];
		var entries = DexViews.entries[view.dexid];
		return entries ? !!entries[table][row[1]] : !DexViews.custom[table][row[1]] || !!view[table][row[1]];
	}

	function learnRows(titles, learned, inherited, others, editable) {
		$.each([learned, inherited, others], function (i, list) {
			list.sort(function (a, b) { return a[1] < b[1] ? -1 : 1; });
		});
		var results = [['header', titles[0] + " (" + learned.length + ")"]].concat(learned);
		if (inherited.length) results = results.concat([['header', "From pre-evolutions (" + inherited.length + ")"]], inherited);
		return editable ? results.concat([['header', titles[1]]], others) : results;
	}

	function showSaveProblems(errors, stale) {
		if (errors.length) {
			app.addPopup(Popup, {
				message: (errors.length === 1 ? "Your change wasn't saved for the following reason:" : "Your changes weren't saved for the following reasons:") +
					"\n\n- " + errors.join('\n- ')
			});
		} else if (stale) {
			app.addPopup(Popup, {
				htmlMessage: "These don't work in the new world and are skipped until you fix them or clear the dex:<br />" +
					stale.map(function (problem) { return BattleLog.escapeHTML(problem); }).join('<br />')
			});
		}
	}

	function listDexes(dexes) {
		if (dexes) app.trigger('response:dexes', dexes);
		else app.send('/crq dexes');
	}

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

	function panelSearch($results) {
		var search = new BattleSearch($results, $results);
		$results.off('scroll').on('scroll', function () {
			search.updateScroll();
		});
		search.$viewport = {
			scrollTop: function () {
				return $results.scrollTop();
			},
			height: function () {
				return $results.css('overflow-y') === 'visible' ? 0 : $results.height();
			}
		};
		return search;
	}

	function dexEntryResults(dexid) {
		return function (typedSearch, searchType) {
			typedSearch.dexid = dexid;
			if (searchType === 'pokemon') {
				typedSearch.getBaseResults = function () {
					var dex = this.dex;
					var entries = !this.dexPool && DexViews.entries[dexid];
					var custom = toSet(entries ? entries.custom.Pokedex || [] : []);
					var modified = toSet(entries ? entries.modified.Pokedex || [] : []);
					var ids = Object.keys(this.dexPool || this.dexView.species).filter(function (id) {
						var species = dex.species.get(id);
						return species.exists && !species.isCosmeticForme;
					}).sort(function (a, b) {
						return dex.species.get(a).name.localeCompare(dex.species.get(b).name);
					});
					var results = [];
					$.each([["Custom Pok\u00e9mon", custom], ["Modified Pok\u00e9mon", modified], ["Pok\u00e9mon", null]], function (i, group) {
						var rows = ids.filter(function (id) {
							return group[1] ? !!group[1][id] : !custom[id] && !modified[id];
						});
						if (rows.length) results.push(['header', group[0]]);
						results = results.concat(rows.map(function (id) { return ['pokemon', id]; }));
					});
					return results;
				};
				return;
			}
			var table = SEARCH_TABLES[searchType];
			if (!table) return;
			typedSearch.getBaseResults = function () {
				var shown = DexViews.entries[dexid];
				var pool = this.dexPool;
				var seen = {};
				var results = dropEmptyHeaders(this.getDefaultResults().filter(function (row) {
					if (row[0] !== searchType) return true;
					seen[row[1]] = 1;
					return pool ? !!pool[row[1]] : !!shown && !!shown[table][row[1]];
				}));
				var others = Object.keys(pool || (shown ? shown[table] : {})).filter(function (id) { return !seen[id]; }).sort();
				if (!others.length) return results;
				return results.concat([['header', "Other " + table.toLowerCase()]], others.map(function (id) {
					return [searchType, id];
				}));
			};
		};
	}

	var selections = [];

	function selectable(search, options) {
		var sel = { on: false, picked: {}, base: {}, anchor: '', pressed: false, timer: null };
		var copy = function (picked) {
			return $.extend({}, picked);
		};
		var rows = function () {
			var type = options.type();
			return (search.resultSet || []).filter(function (row) {
				return row[0] === type && options.canSelect(toID(row[1]));
			}).map(function (row) { return toID(row[1]); });
		};
		var refresh = function () {
			var type = options.type();
			$(options.$bar()).closest('p').toggleClass('dexselectmode', sel.on);
			$(search.el).toggleClass('dexselecting', sel.on).find('a[data-entry]').each(function () {
				var entry = this.dataset.entry.split('|');
				$(this).toggleClass('cur', sel.on && entry[0] === type && !!sel.picked[toID(entry[1])]);
			});
			render();
		};
		var render = function () {
			var $bar = options.$bar();
			$bar.off('click.dexselect').on('click.dexselect', 'button[data-select], button[data-select-action]', function (e) {
				e.preventDefault();
				e.stopPropagation();
				var command = this.dataset.select;
				if (command === 'start') return sel.start();
				if (command === 'stop') return sel.stop();
				if (command === 'all') return sel.all();
				var action = options.actions()[this.dataset.selectAction];
				var ids = Object.keys(sel.picked).filter(action.applies);
				if (ids.length) action.run(ids, this, sel.stop);
			});
			if (!options.enabled()) return $bar.empty();
			if (!sel.on) {
				return $bar.html('<button class="button" data-select="start"><i class="fa fa-check-square-o"></i> Multi-select</button>');
			}
			var ids = Object.keys(sel.picked);
			var buf = '<button class="button" data-select="stop" title="Cancel"><i class="fa fa-times"></i></button> <strong>' + ids.length + ' selected</strong>';
			$.each(options.actions(), function (i, action) {
				var count = ids.filter(action.applies).length;
				if (!count) return;
				buf += ' <button class="button" data-select-action="' + i + '"><i class="fa fa-' + action.icon + '"></i> <strong>' + action.label + '</strong>' +
					(count !== ids.length ? ' (' + count + ')' : '') + '</button>';
			});
			$bar.html(buf + ' <button class="button" data-select="all" title="Select all"><i class="fa fa-check-square"></i> All</button>');
		};
		var toggle = function (id) {
			if (sel.picked[id]) delete sel.picked[id];
			else sel.picked[id] = 1;
			sel.anchor = id;
			sel.base = copy(sel.picked);
		};
		var range = function (id, add) {
			if (add) sel.base = copy(sel.picked);
			var list = rows();
			var from = list.indexOf(sel.anchor);
			var to = list.indexOf(id);
			if (from < 0) from = to;
			sel.picked = copy(sel.base);
			for (var i = Math.min(from, to); i <= Math.max(from, to); i++) sel.picked[list[i]] = 1;
		};
		var pick = function (target, shift, add) {
			var entry = target.dataset.entry.split('|');
			if (entry[0] !== options.type()) return false;
			var id = toID(entry[1]);
			if (!sel.on) {
				if (!(add || shift) || !options.enabled()) return false;
				sel.start();
			}
			if (!options.canSelect(id)) return true;
			if (shift && sel.anchor) range(id, add);
			else toggle(id);
			refresh();
			return true;
		};
		sel.start = function () {
			sel.on = true;
			sel.picked = {};
			sel.base = {};
			sel.anchor = '';
			if (selections.indexOf(sel) < 0) selections.push(sel);
			refresh();
		};
		sel.stop = function () {
			sel.on = false;
			sel.picked = {};
			refresh();
		};
		sel.render = refresh;
		sel.visible = function () {
			return $(search.el).is(':visible');
		};
		sel.all = function () {
			$.each(rows(), function (i, id) { sel.picked[id] = 1; });
			sel.base = copy(sel.picked);
			refresh();
		};
		sel.click = function (e) {
			if (sel.pressed) {
				sel.pressed = false;
				return true;
			}
			if (!sel.on && !e.ctrlKey && !e.metaKey && !e.shiftKey) return false;
			return pick(e.currentTarget, e.shiftKey, e.ctrlKey || e.metaKey);
		};
		var renderRow = search.renderRow;
		search.renderRow = function (id, type, matchStart, matchLength, errorMessage, attrs) {
			if (sel.on && type === options.type() && sel.picked[toID(id)]) attrs = attrs ? attrs.replace('class="', 'class="cur ') : ' class="cur"';
			return renderRow.call(this, id, type, matchStart, matchLength, errorMessage, attrs);
		};
		var clear = function () {
			clearTimeout(sel.timer);
			sel.timer = null;
		};
		$(search.el).addClass('dexselectable').on('pointerdown', 'a[data-entry]', function (e) {
			var event = e.originalEvent;
			sel.pressed = false;
			if (event.pointerType === 'mouse' || !options.enabled()) return;
			var target = this;
			sel.point = [event.clientX, event.clientY];
			clear();
			sel.timer = setTimeout(function () {
				sel.timer = null;
				sel.pressed = pick(target, sel.on, true);
			}, 500);
		}).on('pointermove', function (e) {
			var event = e.originalEvent;
			if (sel.timer && Math.abs(event.clientX - sel.point[0]) + Math.abs(event.clientY - sel.point[1]) > 10) clear();
		}).on('pointerup pointercancel', clear).on('contextmenu', 'a[data-entry]', function (e) {
			if (sel.pressed || sel.timer) e.preventDefault();
		});
		return sel;
	}

	window.addEventListener('keydown', function (e) {
		var sel = selections.filter(function (each) { return each.on && each.visible(); })[0];
		if (!sel || app.popups.length) return;
		if (e.keyCode === 27) {
			sel.stop();
			e.preventDefault();
		} else if (e.keyCode === 65 && (e.ctrlKey || e.metaKey) && !$(e.target).is('input, textarea, select')) {
			sel.all();
			e.preventDefault();
		}
	}, true);

	function chartHTML(groups, empty) {
		var buf = '';
		$.each(groups, function (i, group) {
			if (group[0]) buf += '<li class="result"><h3>' + group[0] + '</h3></li>';
			buf += group[1].join('');
		});
		return '<ul class="utilichart">' + (buf || '<li class="result"><p><em>' + empty + '</em></p></li>') + '</ul>';
	}

	function chartRowHTML(entry, cols, attrs) {
		return '<li class="result"><a data-entry="' + entry + '"' + (attrs || '') + '>' + cols + '</a></li>';
	}

	function sentenceRowHTML(entry, title, sentence) {
		return chartRowHTML(entry, '<span class="col movenamecol">' + title + '</span> ' +
			'<span class="col dexattrsentence">' + sentence.replace(/___/g, '<span class="dexblank"></span>') + '</span>');
	}

	function rowClasses(search, getClasses) {
		search.renderRow = function (id, type, matchStart, matchLength, errorMessage, attrs) {
			var classes = getClasses(id, type);
			if (classes) attrs = attrs ? attrs.replace('class="', 'class="' + classes.slice(1) + ' ') : ' class="' + classes.slice(1) + '"';
			return BattleSearch.prototype.renderRow.call(this, id, type, matchStart, matchLength, errorMessage, attrs);
		};
	}

	function setTierStyle(search, details) {
		var isChampions = details.mod.startsWith('champions');
		search.isNatDex = details.rules.includes('natdexmod') || NATDEX_MODS.includes(details.mod);
		search.isDoubles = details.gameType === 'doubles' && !isChampions;
		search.isVGC = search.isDoubles && details.rules.includes('flatrules');
		search.isLC = details.rules.includes('littlecup');
		search.tierOverrides = details.tiers || null;
	}

	function tierHeader(tier) {
		if (tier === '(DUU)') return "Below DUU";
		if (tier.charAt(0) === '(') return tier.slice(1, -1) + " by technicality";
		if (tier === 'NFE') return "NFEs not in a higher tier";
		return tier;
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
	var roomsFocus = RoomsRoom.prototype.focus;
	_.extend(RoomsRoom.prototype, {
		events: _.extend({}, RoomsRoom.prototype.events, {
			'input input[name=dexsearch]': 'updateDexSearch',
			'submit form.dexsearch': 'submitDexSearch',
			'click a[data-dex]': 'clickDex'
		}),
		initialize: function () {
			roomsInitialize.apply(this, arguments);
			this.$('.pad').first().attr('data-workspace', 'battle');
			this.$el.append(
				'<div data-workspace="create"><div class="pad dexsearchpage">' + HIDE_BUTTON +
				'<h2>Search dexes</h2><form class="dexsearch"><p><label>Dex or creator:<br />' +
				'<input type="search" class="textbox" name="dexsearch" placeholder="(blank = all dexes)" size="30" autocomplete="off" /></label></p>' +
				'<p><button type="submit" class="button"><i class="fa fa-search"></i> <strong>Search</strong></button></p></form>' +
				'<div class="dexresults" style="max-width:480px"><p><em style="font-size:20pt">Loading...</em></p></div></div></div>'
			);
			this.$('[data-workspace]').hide().filter('[data-workspace="' + app.workspace + '"]').show();
			this.updateDexSearch();
		},
		focus: function () {
			if (app.workspace !== 'create') return roomsFocus.apply(this, arguments);
			app.send('/crq dexes');
			this.$('input[name=dexsearch]').focus();
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
			openDexPage(app, e.currentTarget.dataset.dex);
		}
	});

	function openDexPage(app, dexid) {
		if (app.workspace !== 'create') app.switchWorkspace('create');
		app.joinRoom('dex-' + dexid, window.DexViewRoom);
	}

	function dexRooms() {
		return _.filter(app.rooms, function (room) { return room instanceof window.DexBuilderRoom; });
	}

	var renderRoomTab = Topbar.prototype.renderRoomTab;
	Topbar.prototype.renderRoomTab = function (room) {
		if (!room || !(room instanceof window.DexBuilderRoom)) return renderRoomTab.apply(this, arguments);
		if (room.workspace && room.workspace !== app.workspace) return '';
		var icon = room.type === 'dexview' ? 'book' : 'pencil-square-o';
		return '<li><a class="roomtab button closable' + (app.curRoom === room || app.curSideRoom === room ? ' cur' : '') + '" href="' + app.root + room.id + '"><i class="fa fa-' + icon + '"></i> <span>' + BattleLog.escapeHTML(room.title) + '</span></a>' +
			'<button class="closebutton" name="closeRoom" value="' + room.id + '" aria-label="Close"><i class="fa fa-times-circle"></i></button></li>';
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

	function canonical(value) {
		if (value === undefined || value === null || value === '' || value === false) return '';
		if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
		if (typeof value !== 'object') return String(value);
		var keys = Object.keys(value).sort().filter(function (key) { return canonical(value[key]); });
		return keys.length ? '{' + keys.map(function (key) { return key + ':' + canonical(value[key]); }).join(',') + '}' : '';
	}

	function changedValue(value, original) {
		return canonical(value) !== canonical(original);
	}

	DexViews.ui = {
		request: request, compareFormats: compareFormats, openDexPage: openDexPage, DexConfirmPopup: DexConfirmPopup,
		HIDE_BUTTON: HIDE_BUTTON, OFFICIAL_BADGE: OFFICIAL_BADGE, canEdit: canEdit, viewSearch: viewSearch, panelSearch: panelSearch, rowClasses: rowClasses, selectable: selectable,
		EFFECT_KINDS: EFFECT_KINDS, ENTRY_TABLES: ENTRY_TABLES, GETTERS: GETTERS, dexEntryResults: dexEntryResults, chartHTML: chartHTML, chartRowHTML: chartRowHTML, sentenceRowHTML: sentenceRowHTML,
		dropEmptyHeaders: dropEmptyHeaders, shownInDex: shownInDex, learnRows: learnRows, showSaveProblems: showSaveProblems, listDexes: listDexes, setTierStyle: setTierStyle, tierHeader: tierHeader, changedValue: changedValue
	};

})(window.jQuery);
