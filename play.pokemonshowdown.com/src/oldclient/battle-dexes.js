(function () {

	function whenLoaded(globals, callback) {
		var check = function () {
			for (var i = 0; i < globals.length; i++) {
				if (!window[globals[i]]) return false;
			}
			document.removeEventListener('load', check, true);
			callback(window.jQuery);
			return true;
		};
		if (!check()) document.addEventListener('load', check, true);
	}

	whenLoaded(['jQuery', 'Dex', 'Battle', 'Pokemon', 'BattleLog'], function ($) {

		var GLOBALS = {
			Pokedex: ['BattlePokedex', 'pokemon'],
			Moves: ['BattleMovedex', 'move'],
			Items: ['BattleItems', 'item'],
			Abilities: ['BattleAbilities', 'ability']
		};

		var TYPES = [
			'normal', 'fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost', 'steel',
			'fire', 'water', 'grass', 'electric', 'psychic', 'ice', 'dragon', 'dark', 'fairy', 'stellar'
		];

		var TYPE_GLYPHS = {
			'-': '....|....|....|WWWs|ssss|....|....|....',
			'0': '.WWs.|WssWs|Ws.Ws|WsWWs|WWsWs|WssWs|sWWss|.sss.',
			'1': '.Ws.|WWs.|sWs.|.Ws.|.Ws.|.Ws.|WWWs|ssss',
			'2': '.WWs.|WssWs|ss.Ws|..Wss|.Wss.|Wss..|WWWWs|sssss',
			'3': 'WWWs.|sssWs|...Ws|.WWss|.ssWs|...Ws|WWWss|ssss.',
			'4': 'Ws.Ws|Ws.Ws|Ws.Ws|WWWWs|sssWs|...Ws|...Ws|...ss',
			'5': 'WWWWs|Wssss|Ws...|WWWs.|sssWs|...Ws|WWWss|ssss.',
			'6': '.WWs.|Wsss.|Ws...|WWWs.|WssWs|Ws.Ws|sWWss|.sss.',
			'7': 'WWWWs|sssWs|...Ws|..Wss|..Ws.|.Wss.|.Ws..|.ss..',
			'8': '.WWs.|WssWs|Ws.Ws|sWWss|WssWs|Ws.Ws|sWWss|.sss.',
			'9': '.WWs.|WssWs|Ws.Ws|sWWWs|.ssWs|...Ws|.WWss|.sss.',
			'?': '.WWs.|WssWs|ss.Ws|..Wss|.Wss.|.ss..|.Ws..|.ss..',
			A: '.WWs.|WssWs|Ws.Ws|Ws.Ws|WWWWs|WssWs|Ws.Ws|ss.ss',
			B: 'WWWs.|WssWs|Ws.Ws|WWWss|WssWs|Ws.Ws|WWWss|ssss.',
			C: '.WWs.|WssWs|Ws.ss|Ws...|Ws...|Ws.Ws|sWWss|.sss.',
			D: 'WWWs.|WssWs|Ws.Ws|Ws.Ws|Ws.Ws|Ws.Ws|WWWss|ssss.',
			E: 'WWWWs|Wssss|Ws...|WWWs.|Wsss.|Ws...|WWWWs|sssss',
			F: 'WWWWs|Wssss|Ws...|WWWs.|Wsss.|Ws...|Ws...|ss...',
			G: '.WWs.|WssWs|Ws.ss|WsWWs|WssWs|Ws.Ws|sWWss|.sss.',
			H: 'Ws.Ws|Ws.Ws|Ws.Ws|WWWWs|WssWs|Ws.Ws|Ws.Ws|ss.ss',
			I: 'WWWs|sWss|.Ws.|.Ws.|.Ws.|.Ws.|WWWs|ssss',
			J: '...Ws|...Ws|...Ws|...Ws|Ws.Ws|Ws.Ws|sWWss|.sss.',
			K: 'Ws.Ws|WsWs.|WWs..|Ws...|WWs..|WsWs.|WssWs|ss.ss',
			L: 'Ws...|Ws...|Ws...|Ws...|Ws...|Ws...|WWWWs|sssss',
			M: 'Ws..Ws|WWsWWs|WWWWWs|WsWsWs|Wss.Ws|Ws..Ws|Ws..Ws|ss..ss',
			N: 'Ws.Ws|WWsWs|WWsWs|WWWWs|WsWWs|WsWWs|WssWs|ss.ss',
			O: '.WWs.|WssWs|Ws.Ws|Ws.Ws|Ws.Ws|Ws.Ws|sWWss|.sss.',
			P: 'WWWs.|WssWs|Ws.Ws|WWWss|Wsss.|Ws...|Ws...|ss...',
			Q: '.WWs.|WssWs|Ws.Ws|Ws.Ws|Ws.Ws|WsWss|sWsWs|.ssss',
			R: 'WWWs.|WssWs|Ws.Ws|WWWs.|WsWs.|WssWs|Ws.Ws|ss.ss',
			S: '.WWs.|WssWs|Ws.ss|sWWs.|.ssWs|Ws.Ws|sWWss|.sss.',
			T: 'WWWs|sWss|.Ws.|.Ws.|.Ws.|.Ws.|.Ws.|.ss.',
			U: 'Ws.Ws|Ws.Ws|Ws.Ws|Ws.Ws|Ws.Ws|Ws.Ws|sWWss|.sss.',
			V: 'Ws..Ws|Ws..Ws|Ws..Ws|sWsWss|.WsWs.|.sWss.|..Ws..|..ss..',
			W: 'Ws..Ws|Ws..Ws|Ws..Ws|Ws..Ws|WsWsWs|WWsWWs|Ws.sWs|s...ss',
			X: 'Ws..Ws|Ws..Ws|sWsWss|.sWss.|.WsWs.|WsssWs|Ws..Ws|ss..ss',
			Y: 'Ws..Ws|Ws..Ws|sWsWs.|.sWs..|..Ws..|..Ws..|..Ws..|..ss..',
			Z: 'WWWWs|sssWs|..Wss|..Ws.|.Wss.|Wss..|WWWWs|sssss'
		};

		var DexViews = window.DexViews = {
			layers: {},
			loading: {},
			failed: {},
			views: {},
			custom: { Pokedex: {}, Moves: {}, Items: {}, Abilities: {} },
			sprites: {},
			itemSprites: {},
			types: {},
			current: null,
			query: null,
			genOf: genOf,
			load: loadDex,
			draft: draftView,
			mergeEffect: mergeEffect,
			tierData: tierData,
			indexSearch: indexSearch
		};
		var unindexed = [];
		var drafts = 0;

		function genOf(mod) {
			var gen = /^gen(\d)/.exec(mod);
			return gen ? Number(gen[1]) : 9;
		}

		function fetchLayer(hash, dexid) {
			if (!DexViews.layers[hash]) {
				DexViews.layers[hash] = new Promise(function (resolve, reject) {
					$.getJSON(Dex.resourcePrefix + 'dexes/' + hash + '.json').done(resolve).fail(function () {
						if (!dexid || !DexViews.query) return reject(new Error("The dex " + hash + " isn't available."));
						DexViews.query(dexid).then(resolve, reject);
					});
				});
			}
			return DexViews.layers[hash];
		}

		function loadView(hash, dexid) {
			if (DexViews.views[hash]) return Promise.resolve(DexViews.views[hash]);
			if (!DexViews.loading[hash]) {
				DexViews.loading[hash] = fetchLayer(hash, dexid).then(function (layer) {
					var parentids = layer.parentids || [];
					return Promise.all((layer.parents || []).map(function (parent, i) {
						return loadView(parent, parentids[i]);
					})).then(function (parents) {
						return register(hash, layer, parents);
					});
				});
				DexViews.loading[hash].then(null, function () {
					delete DexViews.loading[hash];
					delete DexViews.layers[hash];
					DexViews.failed[hash] = true;
				});
			}
			return DexViews.loading[hash];
		}

		function within(view, fn, self, args) {
			var previous = DexViews.current;
			DexViews.current = view;
			try {
				return fn.apply(self, args);
			} finally {
				DexViews.current = previous;
			}
		}

		function loadDex(summary) {
			return loadView(summary.hash, summary.id);
		}

		function merge(view, source, attributes) {
			var tables = ['Pokedex', 'Moves', 'Abilities', 'Items', 'TypeChart', 'FormatsData', 'images', 'itemSprites'];
			for (var i = 0; i < tables.length; i++) {
				var table = source[tables[i]];
				for (var id in table) {
					view[tables[i]][id] = attributes && typeof table[id] === 'object' ?
						$.extend({}, view[tables[i]][id], table[id]) : table[id];
				}
			}
			for (var id in source.Learnsets) {
				view.Learnsets[id] = {
					learnset: $.extend({}, attributes && view.Learnsets[id] && view.Learnsets[id].learnset, source.Learnsets[id].learnset)
				};
			}
			for (var id in source.sprites) view.sprites[id] = $.extend({}, view.sprites[id], source.sprites[id]);
		}

		function mergeTiers(parents) {
			var table = window.BattleTeambuilderTable || {};
			var original = {
				tier: table.overrideTier || {}, natDexTier: (table.gen9natdex || {}).overrideTier || {}, doublesTier: (table.gen9doubles || {}).overrideTier || {}
			};
			var merged = {};
			var taken = {};
			for (var i = 0; i < parents.length; i++) {
				for (var id in parents[i].FormatsData) {
					var entry = parents[i].FormatsData[id];
					var target = merged[id] || (merged[id] = {});
					var done = taken[id] || (taken[id] = {});
					for (var key in entry) {
						if (done[key]) continue;
						target[key] = entry[key];
						if (!original[key] || original[key][id] !== entry[key]) done[key] = true;
					}
				}
			}
			return merged;
		}

		function register(hash, layer, parents) {
			var gen = genOf(layer.mod);
			var view = {
				hash: layer.hash, dexid: layer.dexid, name: layer.name, mod: layer.mod, gen: gen,
				modid: 'gen' + gen + 'dex' + layer.hash, species: {},
				Pokedex: {}, Learnsets: {}, FormatsData: {}, Moves: {}, Abilities: {}, Items: {}, TypeChart: {},
				sprites: {}, itemSprites: {}, images: {}, origins: {}
			};
			for (var i = parents.length - 1; i >= 0; i--) merge(view, parents[i], true);
			for (var j = parents.length - 1; j >= 0; j--) $.extend(view.origins, parents[j].origins);
			for (var id in layer.Pokedex) {
				var standard = window.BattlePokedex && BattlePokedex[id] && !DexViews.custom.Pokedex[id];
				if (layer.origins && layer.origins[id]) view.origins[id] = layer.origins[id];
				else if (!view.origins[id] && !standard) view.origins[id] = layer.name;
			}
			if (gen === 9 && parents.length > 1) view.FormatsData = mergeTiers(parents);
			merge(view, layer, false);
			for (var i = 0; i < layer.species.length; i++) view.species[layer.species[i]] = 1;
			view.dex = makeDex(view);
			inject(view);
			DexViews.views[hash] = DexViews.views[layer.hash] = view;
			return view;
		}

		function mergeEffect(target, fields, keepNull) {
			for (var key in fields) {
				var value = fields[key];
				if (value === null && !keepNull) {
					delete target[key];
				} else if ($.isPlainObject(value)) {
					var merged = $.isPlainObject(target[key]) && ['megaStone', 'boosts', 'boost'].indexOf(key) < 0 ? $.extend({}, target[key]) : {};
					target[key] = mergeEffect(merged, value, keepNull);
				} else {
					target[key] = value;
				}
			}
			return target;
		}

		function draftView(view, pokemon, previous, effects) {
			if (previous && previous.draftOf) {
				delete Dex.moddedDexes[previous.modid];
				delete BattleTeambuilderTable[previous.modid];
			}
			var draft = $.extend({}, view, {
				draftOf: view, modid: view.modid + 'draft' + (++drafts), Pokedex: $.extend({}, view.Pokedex), Learnsets: $.extend({}, view.Learnsets),
				Moves: $.extend({}, view.Moves), Abilities: $.extend({}, view.Abilities), Items: $.extend({}, view.Items)
			});
			$.each(effects || {}, function (table, entries) {
				if (!draft[table]) return;
				for (var id in entries) {
					var fields = $.extend({}, entries[id]);
					$.each(['name', 'inheritsFrom', 'slots', 'replace', 'events', 'spriteFrom'], function (i, key) { delete fields[key]; });
					var data = view[table][id] || window[GLOBALS[table][0]][id] || {};
					draft[table][id] = mergeEffect($.extend(true, {}, data), fields);
				}
			});
			for (var id in pokemon) {
				var fields = $.extend({}, pokemon[id]);
				var learnset = fields.learnset;
				delete fields.learnset;
				delete fields.name;
				if (!$.isEmptyObject(fields)) draft.Pokedex[id] = $.extend({}, view.Pokedex[id] || view.dex.species.get(id), fields);
				if (!learnset) continue;
				var moves = $.extend({}, DexViews.learnsetOf(view, id));
				for (var moveid in learnset) {
					if (learnset[moveid]) moves[moveid] = learnset[moveid];
					else delete moves[moveid];
				}
				draft.Learnsets[id] = { learnset: moves };
			}
			draft.dex = makeDex(draft);
			return draft;
		}

		function tierData(view, species) {
			var data = view.FormatsData[species.id];
			if (data && (data.tier || data.doublesTier || data.natDexTier) || !DexViews.custom.Pokedex[species.id]) return data || {};
			var base = toID(species.battleOnly || species.baseSpecies);
			return (base !== species.id && view.FormatsData[base]) || data || {};
		}

		function makeDex(view) {
			var overrideTier = {};
			for (var id in view.FormatsData) {
				if (view.FormatsData[id].tier) overrideTier[id] = view.FormatsData[id].tier;
			}
			BattleTeambuilderTable[view.modid] = {
				overrideSpeciesData: {}, overrideMoveData: {}, overrideItemData: {}, overrideAbilityData: {}, overrideTier: overrideTier
			};
			var dex = Dex.mod(view.modid);
			dex.dexView = view;

			var getSpecies = dex.species.get;
			dex.species.get = function (name) {
				var id = toID(name);
				var data = view.Pokedex[id];
				if (!data) return getSpecies(name);
				if (!dex.cache.Species.hasOwnProperty(id)) {
					data = $.extend({}, data, { id: id });
					data.tier = tierData(view, data).tier || data.tier || 'Illegal';
					data.nfe = !!(data.evos && data.evos.some(function (evo) { return view.species[toID(evo)]; }));
					dex.cache.Species[id] = new window.Species(id, data.name, data);
				}
				return dex.cache.Species[id];
			};

			$.each({
				moves: [view.Moves, 'Moves', window.Move],
				items: [view.Items, 'Items', window.Item],
				abilities: [view.Abilities, 'Abilities', window.Ability]
			}, function (key, info) {
				var get = dex[key].get;
				dex[key].get = function (name) {
					var id = toID(name);
					var data = info[0][id];
					if (!data) return get(name);
					if (!dex.cache[info[1]].hasOwnProperty(id)) dex.cache[info[1]][id] = new info[2](id, data.name, data);
					return dex.cache[info[1]][id];
				};
			});

			var getType = dex.types.get;
			dex.types.get = function (name) {
				var id = toID(name);
				if (!view.TypeChart[id]) return getType(name);
				if (!dex.cache.Types.hasOwnProperty(id)) {
					var typeName = id.charAt(0).toUpperCase() + id.slice(1);
					dex.cache.Types[id] = $.extend({}, Dex.types.get(typeName), view.TypeChart[id], {
						id: id, name: typeName, exists: true, effectType: 'Type'
					});
				}
				return dex.cache.Types[id];
			};
			var typeNames = dex.types.names;
			dex.types.names = function () {
				var names = typeNames().slice();
				for (var id in view.TypeChart) {
					var typeName = dex.types.get(id).name;
					if (!names.includes(typeName)) names.push(typeName);
				}
				return names;
			};

			var getText = dex.text.get;
			dex.text.get = function (effect, lang) {
				var table = { Move: view.Moves, Ability: view.Abilities, Item: view.Items }[effect && effect.effectType];
				var data = table && table[effect.id];
				if (!data || !(data.desc || data.shortDesc)) return getText(effect, lang);
				return { name: effect.name, desc: data.desc || data.shortDesc, shortDesc: data.shortDesc || data.desc };
			};
			return dex;
		}

		function inject(view) {
			var added = [];
			$.each(GLOBALS, function (table, info) {
				var data = window[info[0]] || (window[info[0]] = {});
				for (var id in view[table]) {
					if (data[id] && !DexViews.custom[table][id]) continue;
					if (!data[id]) added.push([id, info[1]]);
					var entry = $.extend({}, view[table][id]);
					if (table === 'Pokedex') entry.tier = tierData(view, { id: id, baseSpecies: entry.baseSpecies || '' }).tier || entry.tier;
					data[id] = entry;
					DexViews.custom[table][id] = 1;
				}
			});
			for (var id in view.sprites) {
				DexViews.sprites[id] = DexViews.sprites[id] || {};
				for (var kind in view.sprites[id]) {
					var image = view.images[view.sprites[id][kind]];
					if (image) DexViews.sprites[id][kind] = image;
				}
			}
			for (var id in view.itemSprites) {
				if (view.images[view.itemSprites[id]]) DexViews.itemSprites[id] = view.images[view.itemSprites[id]];
			}
			for (var id in view.TypeChart) {
				if (TYPES.indexOf(id) >= 0) continue;
				if (!DexViews.types[id]) added.push([id, 'type']);
				DexViews.types[id] = typeStyle(id, view.TypeChart[id]);
			}
			unindexed = unindexed.concat(added);
			indexSearch();
		}

		function typeStyle(id, entry) {
			var name = id.charAt(0).toUpperCase() + id.slice(1);
			return {
				name: name,
				label: entry.label || name.toUpperCase().replace(/[^A-Z0-9?-]/g, '').slice(0, 6),
				color: entry.color || '#9a9aa8'
			};
		}

		function indexSearch() {
			if (!unindexed.length || !window.BattleSearchIndex) return;
			var entries = unindexed.sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; });
			unindexed = [];
			var index = [];
			var offsets = [];
			var moved = [];
			var i = 0;
			var j = 0;
			while (i < BattleSearchIndex.length || j < entries.length) {
				if (j < entries.length && (i >= BattleSearchIndex.length || entries[j][0] < BattleSearchIndex[i][0])) {
					index.push(entries[j]);
					offsets.push('');
					j++;
				} else {
					moved[i] = index.length;
					index.push(BattleSearchIndex[i]);
					offsets.push(BattleSearchIndexOffset[i]);
					i++;
				}
			}
			for (i = 0; i < index.length; i++) {
				if (index[i].length > 2) index[i][2] = moved[index[i][2]];
			}
			window.BattleSearchIndex = index;
			window.BattleSearchIndexOffset = offsets;
		}

		function imageURL(image) {
			return Dex.resourcePrefix + 'sprites/custom/' + image.file;
		}

		function fit(image, width, height) {
			var scale = Math.min(width / image.width, height / image.height);
			return [Math.round(image.width * scale), Math.round(image.height * scale)];
		}

		function spritesOf(view, id) {
			var sprites = view ? view.sprites[id] : DexViews.sprites[id];
			if (!sprites || !view) return sprites;
			var images = {};
			for (var kind in sprites) {
				if (view.images[sprites[kind]]) images[kind] = view.images[sprites[kind]];
			}
			return images;
		}

		function spriteImage(view, species, isFront, shiny, gender, afd) {
			var sprites = spritesOf(view, species.id);
			if (!sprites && species.baseSpecies && species.isCosmeticForme) sprites = spritesOf(view, toID(species.baseSpecies));
			if (!sprites) return null;
			var facings = isFront ? ['front'] : ['back', 'front'];
			for (var i = 0; i < facings.length; i++) {
				var kinds = [];
				if (afd) kinds.push('afd-' + facings[i] + (shiny ? '-shiny' : ''), 'afd-' + facings[i]);
				if (gender === 'F') kinds.push(facings[i] + (shiny ? '-shiny' : '') + '-f');
				kinds.push(facings[i] + (shiny ? '-shiny' : ''), facings[i]);
				for (var j = 0; j < kinds.length; j++) {
					if (sprites[kinds[j]]) return { image: sprites[kinds[j]], flip: i > 0 };
				}
			}
			return null;
		}

		function viewOf(dex) {
			return dex && dex.dexView || null;
		}

		var getSpriteData = Dex.getSpriteData;
		Dex.getSpriteData = function (pokemon, isFront, options) {
			var spriteData = getSpriteData.apply(this, arguments);
			var view = null;
			var shiny = options && options.shiny;
			var gender = options && options.gender;
			var species = pokemon;
			if (pokemon instanceof Pokemon) {
				var transform = pokemon.volatiles.transform;
				shiny = transform ? transform[2] : pokemon.shiny;
				gender = transform ? transform[3] : pokemon.gender;
				view = viewOf(pokemon.side.battle.dex);
				species = pokemon.getSpeciesForme();
			}
			species = view ? view.dex.species.get(species) : Dex.species.get(species);
			var found = spriteImage(view, species, isFront, shiny, gender, Dex.afdMode || options && options.afd);
			if (!found) return spriteData;
			var size = fit(found.image, 96, 96);
			spriteData.url = imageURL(found.image) + (!found.image.flip !== !found.flip ? '#flip' : '');
			spriteData.w = size[0];
			spriteData.h = size[1];
			spriteData.y = found.image.y || 0;
			spriteData.pixelated = !!found.image.pixelated;
			if (found.image.gen) spriteData.gen = found.image.gen;
			return spriteData;
		};

		var getPokemonIcon = Dex.getPokemonIcon;
		Dex.getPokemonIcon = function (pokemon, facingLeft) {
			var icon = getPokemonIcon.apply(this, arguments);
			if (!pokemon || typeof pokemon === 'string' && pokemon.startsWith('pokeball')) return icon;
			var id = toID(pokemon);
			if (typeof pokemon !== 'string') {
				if (pokemon.speciesForme) id = toID(pokemon.speciesForme);
				if (pokemon.species) id = toID(pokemon.species);
				if (pokemon.volatiles && pokemon.volatiles.formechange && !pokemon.volatiles.transform) {
					id = toID(pokemon.volatiles.formechange[1]);
				}
			}
			var view = pokemon instanceof Pokemon ? viewOf(pokemon.side.battle.dex) : DexViews.current;
			var sprites = spritesOf(view, id) || spritesOf(null, id);
			var image = sprites && (pokemon.gender === 'F' && sprites['icon-f'] || sprites.icon);
			if (!image) return icon;
			var size = fit(image, 40, 30);
			var end = icon.indexOf(';');
			return 'background:transparent url(' + imageURL(image) + ') no-repeat center / ' + size[0] + 'px ' + size[1] + 'px' +
				(image.pixelated ? ';image-rendering:pixelated' : '') + (end < 0 ? '' : icon.slice(end));
		};

		function animatedSprite(set, dex) {
			if (Dex.prefs('noanim') || Dex.prefs('nogif')) return '';
			if (Dex.getTeambuilderSpriteData(set, dex || Dex).spriteDir !== 'sprites/gen5') return '';
			var data = getSpriteData.call(Dex, set.species, true, { gen: 5, shiny: set.shiny, gender: set.gender, noScale: true });
			if (!/\/gen5ani/.test(data.url)) return '';
			return 'background-image:url(' + data.url + ');background-position:' + (10 + (96 - data.w) / 2) + 'px ' +
				(5 + (96 - data.h) / 2) + 'px;background-repeat:no-repeat';
		}

		var getTeambuilderSprite = Dex.getTeambuilderSprite;
		Dex.getTeambuilderSprite = function (set, dex) {
			if (!set || !set.species) return getTeambuilderSprite.apply(this, arguments);
			var view = viewOf(dex);
			var species = (view ? view.dex : Dex).species.get(set.species);
			var found = spriteImage(view, species, true, set.shiny, set.gender, Dex.afdMode);
			if (!found) return animatedSprite(set, dex) || getTeambuilderSprite.apply(this, arguments);
			var size = fit(found.image, 96, 96);
			return 'background-image:url(' + imageURL(found.image) + ');background-position:' + (10 + (96 - size[0]) / 2) + 'px ' +
				(5 + (96 - size[1]) / 2) + 'px;background-repeat:no-repeat;background-size:' + size[0] + 'px ' + size[1] + 'px' +
				(found.image.pixelated ? ';image-rendering:pixelated' : '');
		};

		var getItemIcon = Dex.getItemIcon;
		Dex.getItemIcon = function (item) {
			var id = item && toID(typeof item === 'string' ? item : item.id || item.name);
			var view = DexViews.current;
			var image = id && (view && view.images[view.itemSprites[id]] || DexViews.itemSprites[id]);
			if (!image) return getItemIcon.apply(this, arguments);
			var size = fit(image, 24, 24);
			return 'background:transparent url(' + imageURL(image) + ') no-repeat center / ' + size[0] + 'px ' + size[1] + 'px' +
				(image.pixelated ? ';image-rendering:pixelated' : '');
		};

		var typeIcons = {};
		function typeIconURL(type) {
			var key = type.label + type.color;
			if (typeIcons[key]) return typeIcons[key];
			var canvas = document.createElement('canvas');
			canvas.width = 32;
			canvas.height = 14;
			var context = canvas.getContext('2d');
			var rgb = [1, 3, 5].map(function (i) { return parseInt(type.color.slice(i, i + 2), 16); });
			context.fillStyle = 'rgb(' + rgb.map(function (c) { return Math.round(c * 0.45 + 15); }).join(',') + ')';
			context.fillRect(0, 1, 32, 12);
			context.fillStyle = type.color;
			context.fillRect(1, 2, 30, 10);
			var glyphs = type.label.split('').map(function (c) { return (TYPE_GLYPHS[c] || TYPE_GLYPHS['?']).split('|'); });
			var width = function (gap) {
				return glyphs.reduce(function (sum, glyph) { return sum + glyph[0].length - 1; }, 0) + gap * (glyphs.length - 1);
			};
			var gap = glyphs.length <= 3 ? 3 : glyphs.length === 4 ? 2 : 1;
			if (width(gap) > 30) gap = 0;
			var start = 1 + Math.max(0, Math.ceil((30 - width(gap) - 1) / 2));
			['s', 'W'].forEach(function (pixel) {
				context.fillStyle = pixel === 'W' ? '#ffffff' : '#525252';
				var x = start;
				glyphs.forEach(function (glyph) {
					for (var row = 0; row < glyph.length; row++) {
						for (var col = 0; col < glyph[row].length; col++) {
							if (glyph[row][col] === pixel && x + col >= 1 && x + col <= 30) context.fillRect(x + col, 3 + row, 1, 1);
						}
					}
					x += glyph[0].length - 1 + gap;
				});
			});
			typeIcons[key] = canvas.toDataURL();
			return typeIcons[key];
		}

		var getTypeIcon = Dex.getTypeIcon;
		Dex.getTypeIcon = function (type, b) {
			var id = toID(type);
			var view = DexViews.current;
			var custom = TYPES.indexOf(id) < 0 && (view && view.TypeChart[id] ? typeStyle(id, view.TypeChart[id]) : DexViews.types[id]);
			if (!custom) return getTypeIcon.apply(this, arguments);
			return '<img src="' + typeIconURL(custom) + '" alt="' + BattleLog.escapeHTML(custom.name) + '" height="14" width="32" class="pixelated' + (b ? ' b' : '') + '" />';
		};

		var runMajor = Battle.prototype.runMajor;
		Battle.prototype.runMajor = function (args, kwArgs, preempt) {
			if (args[0] !== 'dex') return runMajor.apply(this, arguments);
			var hash = args[1];
			if (DexViews.views[hash]) {
				this.dex = DexViews.views[hash].dex;
				return;
			}
			if (DexViews.failed[hash]) {
				this.log(['error', "This battle's dex couldn't be loaded, so some of it may look wrong."]);
				return;
			}
			var battle = this;
			this.currentStep--;
			this.atQueueEnd = true;
			loadView(hash).then(function () {
				battle.add();
			}, function () {
				battle.add();
			});
		};

		var runMinor = Battle.prototype.runMinor;
		Battle.prototype.runMinor = function (args, kwArgs) {
			runMinor.apply(this, arguments);
			if (args[0] === '-status' && args[2] === 'frb') {
				var poke = this.getPokemon(args[1]);
				if (poke) this.scene.resultAnim(poke, 'Frostbitten', 'frb');
			}
		};

		whenLoaded(['BattleSearch'], function () {
			var renderRow = window.BattleSearch.prototype.renderRow;
			window.BattleSearch.prototype.renderRow = function () {
				return within(viewOf(this.engine && this.engine.dex), renderRow, this, arguments);
			};
		});

		whenLoaded(['BattleTooltips'], function () {
			var showTooltip = window.BattleTooltips.prototype.showTooltip;
			window.BattleTooltips.prototype.showTooltip = function () {
				return within(viewOf(this.battle && this.battle.dex), showTooltip, this, arguments);
			};
		});

		whenLoaded(['PokemonSprite'], function () {
			var updateStatbar = window.PokemonSprite.prototype.updateStatbar;
			window.PokemonSprite.prototype.updateStatbar = function (pokemon) {
				updateStatbar.apply(this, arguments);
				if (pokemon.status === 'frb' && this.$statbar) this.$statbar.find('.status').prepend('<span class="frb">FRB</span> ');
			};
		});

		$('<style>').text(
			'img[src*="#flip"] { transform: scaleX(-1); }\n' +
			'.statbar span.frb { padding: 1px 2px; border: 0; border-radius: 3px; background: #009AA4; color: #FFFFFF; }\n' +
			'.battle .frbresult strong { color: #FFFFFF; background: #009AA4; }\n'
		).appendTo('head');
	});

})();
