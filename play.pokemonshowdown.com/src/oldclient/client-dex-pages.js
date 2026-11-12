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

	function listValue(text) {
		return text.split(',').map(function (part) { return $.trim(part); }).filter(Boolean);
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
	var REGIONS = { Alola: "Alolan", Galar: "Galarian", Hisui: "Hisuian", Paldea: "Paldean" };
	var familyLinks = { view: null, links: null };

	function linksOf(view) {
		if (familyLinks.view === view) return familyLinks.links;
		var links = {};
		var link = function (a, b) {
			if (!b || a === b || !view.species[b]) return;
			(links[a] = links[a] || []).push(b);
			(links[b] = links[b] || []).push(a);
		};
		for (var id in view.species) {
			var species = view.dex.species.get(id);
			links[id] = links[id] || [];
			link(id, toID(species.prevo));
			(species.evos || []).forEach(function (evo) { link(id, toID(evo)); });
			link(id, toID(species.baseSpecies));
			link(id, toID(species.changesFrom));
			[].concat(species.battleOnly || []).forEach(function (base) { link(id, toID(base)); });
		}
		familyLinks.view = view;
		familyLinks.links = links;
		return links;
	}

	function evoParent(view, species) {
		var prevo = toID(species.prevo);
		if (prevo && prevo !== species.id && view.species[prevo]) return prevo;
		var parents = (linksOf(view)[species.id] || []).filter(function (id) {
			return id !== species.id && (view.dex.species.get(id).evos || []).indexOf(species.name) >= 0;
		});
		return parents[0] || '';
	}

	function inBattle(species) {
		return !!species.battleOnly || species.isMega || species.isPrimal || /gmax$/.test(species.formeid);
	}

	function formeBase(view, species) {
		var base = toID([].concat(species.battleOnly || [])[0] || species.changesFrom || species.baseSpecies);
		return base !== species.id && view.species[base] ? base : '';
	}

	function dexFamily(view, start) {
		var links = linksOf(view);
		var ids = [start.id];
		for (var i = 0; i < ids.length; i++) {
			(links[ids[i]] || []).forEach(function (id) {
				if (ids.indexOf(id) < 0) ids.push(id);
			});
		}
		var members = {};
		var parents = {};
		var bases = {};
		ids.forEach(function (id) { members[id] = view.dex.species.get(id); });
		ids.forEach(function (id) {
			var parent = evoParent(view, members[id]);
			parents[id] = members[parent] ? parent : '';
			bases[id] = members[formeBase(view, members[id])] ? formeBase(view, members[id]) : '';
		});
		var same = function (a, b) {
			return JSON.stringify(a.baseStats) === JSON.stringify(b.baseStats) && JSON.stringify(a.abilities) === JSON.stringify(b.abilities);
		};
		var stripped = {};
		ids.forEach(function (id) {
			var species = members[id];
			if (!bases[id] || inBattle(species) || !same(species, members[bases[id]])) return;
			if (parents[id] && parents[id] !== parents[bases[id]]) return;
			if (ids.some(function (other) { return parents[other] === id || bases[other] === id; })) return;
			stripped[id] = true;
		});
		var regions = {};
		var regionOf = function (id, depth) {
			if (regions[id] !== undefined) return regions[id];
			var region = members[id].forme.split('-')[0];
			if (!REGIONS[region]) region = !members[id].forme && parents[id] && depth < 20 ? regionOf(parents[id], depth + 1) : '';
			regions[id] = region;
			return region;
		};
		var placed = {};
		var visit = function (id, rows) {
			if (placed[id]) return;
			placed[id] = true;
			rows.push({ species: members[id] });
			var region = regionOf(id, 0);
			var under = function (test) {
				return ids.filter(function (other) { return !placed[other] && test(other); });
			};
			under(function (other) { return bases[other] === id && inBattle(members[other]); }).forEach(function (other) { visit(other, rows); });
			var strip = under(function (other) { return stripped[other] && bases[other] === id; });
			if (strip.length) {
				strip.forEach(function (other) { placed[other] = true; });
				rows.push({ base: members[id], strip: strip.map(function (other) { return members[other]; }) });
			}
			var evos = members[id].evos || [];
			var order = function (other) {
				var index = evos.indexOf(members[other].name);
				return index < 0 ? evos.length : index;
			};
			under(function (other) { return parents[other] === id && regionOf(other, 0) === region; }).sort(function (a, b) {
				return order(a) - order(b);
			}).forEach(function (other) { visit(other, rows); });
			under(function (other) {
				return bases[other] === id && !parents[other] && !inBattle(members[other]) && regionOf(other, 0) === region;
			}).forEach(function (other) { visit(other, rows); });
		};
		var sections = [''].concat(Object.keys(REGIONS)).map(function (region) {
			var rows = [];
			ids.filter(function (id) {
				if (placed[id] || stripped[id] || regionOf(id, 0) !== region) return false;
				if (parents[id] && regionOf(parents[id], 0) === region) return false;
				return !bases[id] || inBattle(members[id]) ? !bases[id] : regionOf(bases[id], 0) !== region;
			}).sort(function (a, b) {
				return members[a].num - members[b].num || ids.indexOf(a) - ids.indexOf(b);
			}).forEach(function (id) { visit(id, rows); });
			return { title: REGIONS[region] || '', rows: rows };
		});
		ids.forEach(function (id) {
			if (!placed[id]) visit(id, sections[0].rows);
		});
		var stages = {};
		var stageOf = function (id, depth) {
			if (stages[id] === undefined) {
				var from = parents[id] || bases[id];
				stages[id] = from && depth < 20 ? stageOf(from, depth + 1) + (parents[id] ? 1 : 0) : 0;
			}
			return stages[id];
		};
		var last = Math.max.apply(null, ids.map(function (id) { return stageOf(id, 0); }));
		sections.forEach(function (section) {
			section.rows.forEach(function (row) {
				if (!row.species || !last) return;
				row.stage = stageOf(row.species.id, 0) + 1;
				row.hue = Math.round((row.stage - 1) * 280 / last);
			});
		});
		return sections.filter(function (section) { return section.rows.length; });
	}

	function stageHue(view, species) {
		var hue;
		dexFamily(view, species).forEach(function (section) {
			section.rows.forEach(function (row) {
				if (row.species && row.species.id === species.id) hue = row.hue;
			});
		});
		return stageAttrs(hue);
	}

	function stageAttrs(hue) {
		return hue === undefined ? '' : ' class="dexstaged" style="--hue: ' + hue + '"';
	}

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
			if (!editable) return value ? { M: "always male", F: "always female", N: "nonbinary" }[value] : male + '% male';
			return '<select class="button" name="gender">' + options([['', "male or female"], ['M', "always male"], ['F', "always female"], ['N', "nonbinary"]]) + '</select>' +
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

	var learnsetsLoading = null;

	function loadLearnsets() {
		if (window.BattleLearnsets) return Promise.resolve();
		if (!learnsetsLoading) {
			learnsetsLoading = new Promise(function (resolve, reject) {
				var script = document.createElement('script');
				script.src = Dex.resourcePrefix + 'data/learnsets.js';
				script.onload = resolve;
				script.onerror = function () {
					learnsetsLoading = null;
					reject(new Error("Learnsets couldn't be loaded."));
				};
				document.body.appendChild(script);
			});
		}
		return learnsetsLoading;
	}

	function hasStandardSprites(id) {
		return !!(window.BattlePokedex && BattlePokedex[id] && BattlePokedex[id].exists !== false) && !DexViews.custom.Pokedex[id];
	}

	var CODE = {
		whole: function (min, max, def) {
			return { kind: 'int', min: min, max: max, def: def !== undefined ? def : Math.max(min, Math.min(0, max)) };
		},
		num: function (min, max, def) {
			return { kind: 'num', min: min, max: max, def: def !== undefined ? def : min };
		},
		text: function (max, def) {
			return { kind: 'text', max: max, def: def };
		},
		json: function (def) {
			return { kind: 'json', def: def };
		},
		bool: function (def) {
			return { kind: 'select', options: [true, false], def: def !== undefined ? def : true };
		},
		choice: function (options, def) {
			return { kind: 'select', options: options, def: def };
		},
		fixed: function (def) {
			return { kind: 'fixed', def: def };
		},
		list: function (item, min, max, multiline) {
			return { kind: 'list', item: item, min: min, max: max, multiline: multiline };
		},
		tuple: function (items) {
			return { kind: 'tuple', items: items };
		},
		map: function (value, keys, required) {
			return { kind: 'map', value: value, keys: keys, required: required || [] };
		},
		obj: function (fields, optional, required, defs) {
			return { kind: 'obj', fields: fields, optional: !!optional, required: required || [], defs: defs || {} };
		},
		of: function (value) {
			if (typeof value === 'number') return CODE.num(-1000000, 1000000, value);
			if (typeof value === 'boolean') return CODE.bool(value);
			if (typeof value === 'string') return CODE.text(1024, value);
			if ($.isPlainObject(value) && !value.handler) {
				var fields = {};
				for (var key in value) fields[key] = CODE.of(value[key]);
				return CODE.obj(fields, false, Object.keys(fields));
			}
			return CODE.json(value);
		}
	};

	function codeOptions(node) {
		var options = typeof node.options === 'function' ? node.options() : node.options;
		return (options || []).filter(function (option) { return !(option && option.group); }).map(function (option) {
			return Array.isArray(option) ? option : [option, option];
		});
	}

	function codeDefault(node) {
		if (node.def !== undefined) return $.extend(true, {}, { value: node.def }).value;
		if (node.kind === 'select') return (codeOptions(node)[0] || [''])[0];
		if (node.kind === 'list') {
			var item = node.min ? codeDefault(node.item) : undefined;
			return item === undefined ? [] : [item];
		}
		if (node.kind === 'tuple') return node.items.map(codeDefault);
		if (node.kind === 'map') return {};
		if (node.kind === 'obj') {
			var value = {};
			$.each(node.required, function (i, key) { value[key] = codeDefault(node.fields[key]); });
			return $.extend(value, node.defs);
		}
		return undefined;
	}

	function codeChild(node, key, value) {
		if (!node) return CODE.of(value);
		if (node.kind === 'list') return node.item;
		if (node.kind === 'tuple') return node.items[key];
		if (node.kind === 'map') return node.value;
		if (node.kind === 'obj') return node.fields[key] || CODE.of(value);
		return CODE.of(value);
	}

	function codeKey(key) {
		return /^([A-Za-z_$][\w$]*|\d+)$/.test(key) ? key : JSON.stringify(key);
	}

	function codeLiteral(value) {
		return BattleLog.escapeHTML(JSON.stringify(value) || 'undefined');
	}

	function codeLines(html) {
		return html.split('\n').map(function (line) {
			var depth = /^\t*/.exec(line)[0].length;
			return '<span class="dexcodeline" style="padding-left: ' + (depth + 1) * 4 + 'ch">' + (line.slice(depth) || ' ') + '</span>';
		}).join('');
	}

	function codeWidth(text) {
		return Math.min(String(text).length + 2, 72);
	}

	function codeLeafHTML(path, value, node, editable, hue) {
		var escape = BattleLog.escapeHTML;
		var attrs = ' data-codepath="' + escape(path) + '" data-kind="' + node.kind + '"';
		var color = '--hue: ' + hue;
		if (node.kind === 'fixed') return '<span class="dexcodeleaf"' + attrs + '>' + codeLiteral(value) + '</span>';
		if (!editable) return '<span class="dexcodeleaf"' + attrs + '><mark class="dexmark" style="' + color + '">' + codeLiteral(value) + '</mark></span>';
		var inner;
		if (node.kind === 'int' || node.kind === 'num') {
			var shown = typeof value === 'number' ? String(value) : '';
			inner = '<input type="number" class="dexinline dexmark" value="' + shown + '" min="' + node.min + '" max="' + node.max + '" step="' + (node.kind === 'int' ? 1 : 'any') +
				'" style="width: ' + (codeWidth(shown) + 2) + 'ch; ' + color + '" />';
		} else if (node.kind === 'select') {
			var options = codeOptions(node);
			var current = JSON.stringify(value);
			if (value !== undefined && !options.some(function (option) { return JSON.stringify(option[0]) === current; })) options = [[value, value]].concat(options);
			inner = '<select class="dexinline dexmark" style="width: ' + (codeWidth(current || '') + 2) + 'ch; ' + color + '">' + options.map(function (option) {
				var literal = JSON.stringify(option[0]);
				return '<option value="' + escape(literal) + '"' + (literal === current ? ' selected' : '') + '>' + escape(literal) + '</option>';
			}).join('') + '</select>';
		} else if (node.kind === 'json') {
			var json = value === undefined ? '' : JSON.stringify(value);
			inner = '<input type="text" class="dexinline dexmark" value="' + escape(json) + '" style="width: ' + codeWidth(json) + 'ch; ' + color + '" autocomplete="off" />';
		} else {
			var text = value === undefined || value === null ? '' : String(value);
			inner = '"<input type="text" class="dexinline dexmark" value="' + escape(text).replace(/\n/g, '&#10;') + '"' + (node.max ? ' maxlength="' + node.max + '"' : '') +
				' style="width: ' + codeWidth(text) + 'ch; ' + color + '" autocomplete="off" />"';
		}
		return '<span class="dexcodeleaf"' + attrs + '>' + inner + '</span>';
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
			}
			edit[this.kind] = fields;
			room.editDex(edit);
		}
	});

	DexViews.ui.abilitySlotsOf = abilitySlotsOf;
	DexViews.ui.DexCopyPopup = DexCopyPopup;
	DexViews.ui.CODE = CODE;

	_.extend(window.DexBuilderRoom.prototype, {
		openDexFamily: function (name) {
			var view = DexViews.current = this.dexView;
			var species = view.dex.species.get(name);
			if (!view.species[species.id]) return;
			if (this.$('.dexpage').is(':visible')) this.dexScrollTop = this.dexScroller().scrollTop();
			this.dexFamilyOf = species.name;
			this.dexSpecies = null;
			this.$('.dexmonpage').removeClass('dexcodetab');
			this.dexEffect = null;
			this.dexPicker = null;
			this.dexListSearch = null;
			this.$('.dexsearchpage, .dexpage').hide();
			this.$('.dexmonpage').show();
			this.dexScroller().scrollTop(0);

			var room = this;
			var editable = this.dexEditable;
			var entries = DexViews.entries[view.dexid];
			var family = dexFamily(view, species);
			var key = [];
			$.each(family, function (i, section) {
				$.each(section.rows, function (j, row) {
					if (row.stage) key[row.stage - 1] = '<span class="dexstagekey" style="--hue: ' + row.hue + '">' + row.stage + '</span>';
				});
			});
			var buf = '<div class="pad"><button name="closeDexPokemon" class="button"><i class="fa fa-chevron-left"></i> Pok&eacute;mon</button>' +
				(key.length ? '<span class="dexstagekeys">' + key.join('') + '</span>' : '') + '</div>';
			buf += '<div class="teamchartbox dexfamily"><ol class="teamchart">';
			$.each(family, function (i, section) {
				if (section.title) buf += '<li class="dexfamilyhead"><h3>' + section.title + '</h3></li>';
				$.each(section.rows, function (j, row) {
					if (row.strip) {
						buf += '<li class="dexformestrip"><label>' + BattleLog.escapeHTML(row.base.name) + ' formes (' + row.strip.length + ')</label>';
						$.each(row.strip, function (k, forme) {
							buf += '<button name="openDexForme" value="' + BattleLog.escapeHTML(forme.name) + '" class="button"><span class="picon" style="' + Dex.getPokemonIcon(forme.name) + '"></span>' + BattleLog.escapeHTML(forme.forme) + '</button>';
						});
						buf += '</li>';
						return;
					}
					buf += '<li data-species="' + BattleLog.escapeHTML(row.species.name) + '"' + stageAttrs(row.hue) + '><div class="setmenu"><button name="copyDexPokemon" value="' + BattleLog.escapeHTML(row.species.name) + '"><i class="fa fa-clone"></i>Copy</button>';
					if (editable) buf += room.dexMembershipHTML(row.species);
					buf += '</div>' + room.dexSpeciesRowHTML(row.species, editable) + '</li>';
					if (editable && !inBattle(row.species)) {
						var value = ' value="' + BattleLog.escapeHTML(row.species.name) + '" class="button"';
						buf += '<li class="dexaddrow"><button name="addDexEvo"' + value + '><i class="fa fa-plus"></i> Add evo</button> <button name="addDexPrevo"' + value + '><i class="fa fa-plus"></i> Add prevo</button> <button name="addDexForme"' + value + '><i class="fa fa-plus"></i> Add forme</button></li>';
					}
				});
			});
			buf += '</ol></div>';
			this.$('.dexmonpage').html('<div class="teamwrapper">' + buf + '</div>');
			if (entries) {
				this.$('.dexfamily li[data-species]').each(function () {
					$(this).find('.dexlearnsetlabel').text('Learnset (' + room.dexLearnsetCount(view.dex.species.get(this.dataset.species)) + ')');
				});
			}
			this.scaleDex();
			var current = this.$('.dexfamily li[data-species="' + BattleLog.escapeHTML(species.name) + '"]')[0];
			if (current && current.previousElementSibling) current.scrollIntoView({ block: 'nearest' });
		},
		openDexForme: function (name) {
			this.openDexPokemon(name);
		},
		openDexFamilyRow: function (el) {
			var name = this.dexFamilyOf && $(el).closest('.dexfamily li[data-species]').attr('data-species');
			if (name) this.openDexPokemon(name);
			return !!name;
		},
		backDexFamily: function (value, button) {
			if (button) return this.leaveDex(button, function () { this.backDexFamily(); });
			this.openDexFamily(this.dexSpecies.name);
		},
		addDexEvo: function (value, button) {
			this.addDexRelative('evo', value, button);
		},
		addDexPrevo: function (value, button) {
			this.addDexRelative('prevo', value, button);
		},
		addDexForme: function (value, button) {
			this.addDexRelative('forme', value, button);
		},
		addDexRelative: function (relation, value, button) {
			var room = this;
			var view = this.dexView;
			var species = view.dex.species.get(value);
			var prevo = species.prevo && view.species[toID(species.prevo)] ? view.dex.species.get(species.prevo) : null;
			var relationText = { evo: "Evolves from ", prevo: "Evolves into ", forme: "Forme of " }[relation] + BattleLog.escapeHTML(species.name);
			if (relation === 'prevo' && prevo) relationText = "Evolves from " + BattleLog.escapeHTML(prevo.name) + " into " + BattleLog.escapeHTML(species.name);
			app.addPopup(DexViews.ui.DexNamePopup, {
				value: relation === 'forme' ? species.name + '-' : '',
				fields: '<p>' + relationText + '</p>',
				sourceEl: button,
				callback: function (name) {
					if (view.species[toID(name)]) return app.addPopup(Popup, { message: name + " is already in this dex." });
					if (relation === 'forme' && name.indexOf(species.name + '-') !== 0) {
						return app.addPopup(Popup, { message: "A forme's name is its base species, a dash, then the forme, like \"" + species.name + "-Delta\"." });
					}
					var fields = { name: name };
					if (DexViews.custom.Pokedex[species.id]) {
						$.each(['types', 'abilities', 'baseStats', 'eggGroups', 'weightkg'], function (i, key) { fields[key] = species[key]; });
					} else {
						fields.inheritsFrom = species.name;
					}
					if (relation === 'evo') fields.prevo = species.name;
					if (relation === 'forme') fields.baseSpecies = species.name;
					if (relation === 'prevo') {
						fields.evos = [species.name];
						if (prevo) fields.prevo = prevo.name;
					}
					room.pendingSpecies = name;
					room.editDex({ pokemon: fields });
					if (relation === 'evo') room.editDex({ pokemon: { name: species.name, evos: (species.evos || []).concat([name]) } });
					if (relation !== 'prevo') return;
					room.editDex({ pokemon: { name: species.name, prevo: name } });
					if (prevo) {
						room.editDex({ pokemon: { name: prevo.name, evos: prevo.evos.map(function (evo) { return toID(evo) === species.id ? name : evo; }) } });
					}
				}
			});
		},
		dexCodeHTML: function (name, value, node) {
			var html = codeKey(toID(name)) + ': ' + this.dexCodeValueHTML('', value, node, 0) + ',';
			var order = [];
			var groups = {};
			var count = 0;
			html.replace(/@@(L|G\d+)@@/g, function (token, id) {
				if (id === 'L') {
					order.push(count++);
				} else {
					if (!(id in groups)) groups[id] = count++;
					order.push(groups[id]);
				}
				return token;
			});
			var i = 0;
			return '<pre class="dexcodetext">' + codeLines(html.replace(/@@(L|G\d+)@@/g, function () {
				return String(Math.round(order[i++] * 280 / Math.max(count - 1, 1)));
			})) + '</pre>';
		},
		dexCodeValueHTML: function (path, value, node, depth) {
			var room = this;
			var escape = BattleLog.escapeHTML;
			var editable = this.dexCodeCanEdit(path);
			var pad = new Array(depth + 1).join('\t');
			var childPath = function (key) { return path === '' ? String(key) : path + '.' + key; };
			var remove = function (key) {
				return ' <button class="dexcodex" name="removeDexCode" value="' + escape(childPath(key)) + '" title="Remove">&times;</button>';
			};
			var pending = this.dexCodePending || {};
			if (value && value.handler) return this.dexCodeHandlerHTML(value.handler, depth);
			if (node.kind === 'list' || node.kind === 'tuple') {
				var items = (value || []).map(function (item, i) {
					var html = room.dexCodeValueHTML(childPath(i), item, codeChild(node, i, item), depth + 1);
					return html + (editable && node.kind === 'list' && value.length > node.min ? remove(i) : '');
				});
				if (pending[childPath(items.length)]) items.push(codeLeafHTML(childPath(items.length), undefined, node.item, true, '@@L@@'));
				if (editable && node.kind === 'list' && items.length < node.max) {
					items.push('<button class="dexcodeplus" name="addDexCode" value="' + escape(path) + '" title="Add">+</button>');
				}
				if (node.multiline && items.length) return '[\n' + items.map(function (item) { return pad + '\t' + item; }).join(',\n') + ',\n' + pad + ']';
				return '[' + items.join(', ') + ']';
			}
			if (node.kind === 'map' || node.kind === 'obj') {
				value = value || {};
				var keys = Object.keys(value).filter(function (key) {
					return value[key] && value[key].handler || node.kind === 'map' || node.fields[key] || node.generic;
				});
				$.each(pending, function (full) {
					var split = full.lastIndexOf('.');
					var key = full.slice(split + 1);
					if ((split < 0 ? '' : full.slice(0, split)) === path && keys.indexOf(key) < 0 && node.kind === 'obj' && node.fields[key]) keys.push(key);
				});
				var multiline = depth === 0 || node.multiline || keys.some(function (key) { return value[key] && value[key].handler; });
				var lines = keys.map(function (key) {
					var item = value[key];
					if (item && item.handler) return room.dexCodeHandlerHTML(item.handler, depth + 1);
					var removable = editable && (node.kind === 'map' || node.optional) && node.required.indexOf(key) < 0;
					return codeKey(key) + ': ' + room.dexCodeValueHTML(childPath(key), item, codeChild(node, key, item), depth + 1) + (removable ? remove(key) : '');
				});
				var free = !editable ? [] : node.kind === 'map' ? codeOptions({ options: node.keys }).filter(function (option) { return !(option[0] in value); }) :
					node.optional ? Object.keys(node.fields).filter(function (key) { return keys.indexOf(key) < 0 && room.dexCodeCanEdit(childPath(key)); }).map(function (key) { return [key, key]; }) : [];
				if (free.length) {
					lines.push('<select class="dexinline dexcodeaddkey" data-codepath="' + escape(path) + '" style="width: 4ch"><option value="">+</option>' + free.map(function (option) {
						return '<option value="' + escape(String(option[0])) + '">' + escape(String(option[1])) + '</option>';
					}).join('') + '</select>');
				}
				if (!lines.length) return '{}';
				if (multiline) return '{\n' + lines.map(function (line) { return pad + '\t' + line; }).join(',\n') + ',\n' + pad + '}';
				return '{' + lines.join(', ') + '}';
			}
			return codeLeafHTML(path, value, node, editable, '@@L@@');
		},
		dexCodeNodeAt: function (path) {
			var keys = path.split('.');
			var values = this.dexCodeValues();
			var value = values[keys[0]];
			var node = this.dexCodeTopNode(keys[0], value);
			for (var i = 1; i < keys.length; i++) {
				node = codeChild(node, keys[i], value && value[keys[i]]);
				value = value && value[keys[i]];
			}
			return node;
		},
		dexCodeEdit: function (path, change) {
			var keys = path.split('.');
			var root = {};
			root[keys[0]] = $.extend(true, {}, { value: this.dexCodeValues()[keys[0]] }).value;
			var parent = root;
			for (var i = 0; i < keys.length - 1; i++) {
				if (parent[keys[i]] === undefined) parent[keys[i]] = /^\d+$/.test(keys[i + 1]) ? [] : {};
				parent = parent[keys[i]];
			}
			change(parent, keys[keys.length - 1]);
			this.dexCodePending = {};
			this.dexCodeSave(keys[0], root[keys[0]]);
		},
		changeDexCode: function (e) {
			var $leaf = $(e.currentTarget).closest('[data-codepath]');
			var kind = $leaf.attr('data-kind');
			var raw = e.currentTarget.value;
			var value = raw;
			if (kind === 'int' || kind === 'num') {
				if (!$.trim(raw) || isNaN(Number(raw))) return;
				value = Number(raw);
			} else if (kind === 'select') {
				value = JSON.parse(raw);
			} else if (kind === 'json') {
				try {
					value = JSON.parse(raw);
				} catch (err) {}
			} else if (!$.trim(raw)) {
				return;
			}
			this.dexCodeEdit($leaf.attr('data-codepath'), function (parent, key) { parent[key] = value; });
		},
		removeDexCode: function (path) {
			this.dexCodeEdit(path, function (parent, key) {
				if (Array.isArray(parent)) parent.splice(Number(key), 1);
				else delete parent[key];
			});
		},
		addDexCode: function (path) {
			var node = this.dexCodeNodeAt(path);
			var item = codeDefault(node.item);
			var list = this.dexCodeValues();
			$.each(path.split('.'), function (i, key) { list = list && list[key]; });
			if (node.item.kind === 'select') {
				var unused = codeOptions(node.item).filter(function (option) {
					return !(list || []).some(function (entry) { return JSON.stringify(entry) === JSON.stringify(option[0]); });
				})[0];
				if (unused) item = unused[0];
			}
			if (item === undefined) {
				this.dexCodePending = {};
				this.dexCodePending[path + '.' + this.dexCodeLength(path)] = true;
				return this.refreshDexCode();
			}
			this.dexCodeEdit(path, function (parent, key) { parent[key] = (parent[key] || []).concat([item]); });
		},
		dexCodeLength: function (path) {
			var value = this.dexCodeValues();
			$.each(path.split('.'), function (i, key) { value = value && value[key]; });
			return value ? value.length : 0;
		},
		addDexCodeKey: function (e) {
			var key = e.currentTarget.value;
			var path = e.currentTarget.dataset.codepath;
			if (!key) return;
			var full = path ? path + '.' + key : key;
			var node = this.dexCodeNodeAt(full);
			var value = codeDefault(node);
			if (value === undefined || node.kind === 'list' && node.min && !value.length) {
				this.dexCodePending = {};
				this.dexCodePending[full] = true;
				if (node.kind === 'list') this.dexCodePending[full + '.0'] = true;
				return this.refreshDexCode();
			}
			if (!path) {
				this.dexCodePending = {};
				return this.dexCodeSave(key, value);
			}
			this.dexCodeEdit(path, function (parent, last) {
				parent[last] = parent[last] || {};
				parent[last][key] = value;
			});
		},
		dexCodeValues: function () {
			return this.dexEffect ? this.dexEffectCodeValues() : this.dexSpeciesCodeValues(this.dexSpecies);
		},
		dexCodeTopNode: function (key, value) {
			return codeChild(this.dexEffect ? this.dexEffectCodeNode() : this.dexSpeciesCodeNode(), key, value);
		},
		dexCodeCanEdit: function (path) {
			if (!this.dexEditable) return false;
			return this.dexEffect ? path === '' || this.dexEffectCanEdit(path.split('.')[0]) : true;
		},
		dexCodeSave: function (key, value) {
			if (this.dexEffect) return this.saveDexEffectCode(key, value);
			var fields = {};
			fields[key] = value === undefined ? null : value;
			if (key === 'learnset') {
				var old = this.dexSpeciesLearnset(this.dexSpecies);
				var changes = fields.learnset = {};
				$.each(old, function (move) {
					if (!value || !(move in value)) changes[move] = null;
				});
				$.each(value || {}, function (move, sources) {
					if (JSON.stringify(sources) !== JSON.stringify(old[move])) changes[move] = sources;
				});
			}
			this.saveDexPokemon(fields);
			this.refreshDexCode();
		},
		markDexCodeEdits: function (now, was) {
			this.$('.dexmonpage .dexcodebox [data-codepath]').each(function () {
				var path = this.dataset.codepath.split('.');
				var get = function (object) {
					for (var i = 0; i < path.length && object !== undefined && object !== null; i++) object = object[path[i]];
					return object;
				};
				if (DexViews.ui.changedValue(get(now), get(was))) $(this).addClass('dexedited');
			});
		},
		dexSpeciesCodeValues: function (species) {
			var value = {};
			var put = function (key, item) {
				if (item === undefined || item === null || item === '' || item === 0 || Array.isArray(item) && !item.length) return;
				value[key] = $.extend(true, {}, { item: item }).item;
			};
			put('types', species.types);
			put('gender', species.gender);
			if (!species.gender) put('genderRatio', species.genderRatio);
			put('baseStats', species.baseStats);
			put('abilities', species.abilities);
			put('heightm', species.heightm);
			put('weightkg', species.weightkg);
			put('color', species.color);
			put('prevo', species.prevo);
			put('evos', species.evos);
			put('evoType', species.evoType);
			put('evoLevel', species.evoLevel);
			put('evoItem', species.evoItem);
			put('evoMove', species.evoMove);
			put('evoCondition', species.evoCondition);
			put('eggGroups', species.eggGroups);
			put('tags', species.tags);
			if (DexViews.custom.Pokedex[species.id] && species.forme) {
				put('baseSpecies', species.baseSpecies);
				put('forme', species.forme);
			}
			put('cosmeticFormes', species.cosmeticFormes);
			if (species.requiredItems && species.requiredItems.length === 1) put('requiredItem', species.requiredItems[0]);
			put('battleOnly', species.battleOnly);
			if (species.changesFrom !== species.baseSpecies && species.changesFrom !== species.name) put('changesFrom', species.changesFrom);
			value.learnset = this.dexSpeciesLearnset(species);
			return value;
		},
		dexSpeciesLearnset: function (species) {
			var view = this.dexView;
			var learnset = DexViews.learnsetOf(view, species.id) || {};
			var all = window.BattleLearnsets || {};
			var base = all[species.id] || all[toID(species.changesFrom || species.baseSpecies)] || {};
			var result = {};
			Object.keys(learnset).sort().forEach(function (id) {
				if (!learnset[id]) return;
				result[id] = (Array.isArray(learnset[id]) ? learnset[id] : base.learnset && base.learnset[id] || [view.gen + 'M']).slice();
			});
			return result;
		},
		dexSpeciesCodeNode: function () {
			var room = this;
			var view = this.dexView;
			var text = CODE.text;
			var types = function () {
				return view.dex.types.names().filter(function (name) { return view.dex.types.get(name).exists !== false; });
			};
			var names = function (table, standard, store) {
				return function () {
					var ids = Object.keys($.extend({}, standard, view[store]));
					return ids.map(function (id) {
						var entry = view.dex[table].get(id);
						return entry.exists && !(table === 'species' && room.dexSpecies && entry.id === room.dexSpecies.id) ? entry.name : '';
					}).filter(Boolean).sort();
				};
			};
			var abilities = names('abilities', window.BattleAbilities, 'Abilities');
			var species = CODE.choice(names('species', window.BattlePokedex, 'Pokedex'));
			var items = CODE.choice(names('items', window.BattleItems, 'Items'));
			var moves = CODE.choice(names('moves', window.BattleMovedex, 'Moves'));
			var stats = {};
			$.each(BattleStatNames, function (stat) { stats[stat] = CODE.whole(1, 255, 50); });
			var fields = {
				types: CODE.list(CODE.choice(types, 'Normal'), 1, 2),
				gender: CODE.choice(['M', 'F', 'N']),
				genderRatio: CODE.obj({ M: CODE.num(0, 1, 0.5), F: CODE.num(0, 1, 0.5) }, false, ['M', 'F']),
				baseStats: CODE.obj(stats, false, Object.keys(stats)),
				abilities: CODE.map(CODE.choice(abilities), ['0', '1', 'H', 'S'], ['0']),
				heightm: CODE.num(0.01, 200, 1),
				weightkg: CODE.num(0, 10000, 10),
				color: CODE.choice(COLORS),
				prevo: species,
				evos: CODE.list(species, 1, 32),
				evoType: CODE.choice(EVO_TYPES.map(function (type) { return type[0]; }).filter(Boolean)),
				evoLevel: CODE.whole(1, 100, 1),
				evoItem: items,
				evoMove: moves,
				evoCondition: text(128),
				eggGroups: CODE.list(text(20, 'Undiscovered'), 0, 8),
				tags: CODE.list(text(40), 1, 8),
				cosmeticFormes: CODE.list(text(40), 1, 32),
				requiredItem: items,
				requiredAbility: CODE.choice(abilities),
				requiredMove: moves,
				battleOnly: CODE.json(),
				changesFrom: species,
				maxHP: CODE.whole(1, 999, 1),
				learnset: $.extend(CODE.map($.extend(CODE.list(text(12), 1, 30), { def: [view.gen + 'M'] }), function () {
					var learned = room.dexSpecies ? room.dexSpeciesLearnset(room.dexSpecies) : {};
					return Object.keys($.extend({}, window.BattleMovedex, view.Moves)).filter(function (id) {
						var move = view.dex.moves.get(id);
						return move.exists && !move.isZ && !move.isMax && !learned[id];
					}).sort();
				}), { multiline: true })
			};
			if (this.dexSpecies && DexViews.custom.Pokedex[this.dexSpecies.id]) {
				fields.baseSpecies = species;
				fields.forme = text(30);
			}
			return CODE.obj(fields, true, ['types', 'baseStats', 'abilities', 'eggGroups', 'weightkg']);
		},
		dexSpritesCodeHTML: function (species) {
			var room = this;
			var view = this.dexView;
			var sprites = view.sprites[species.id] || {};
			return '<div class="setchart dexcodebox dexspritebox">' + SPRITE_CELLS.map(function (cell) {
				var image = sprites[cell[0]] && view.images[sprites[cell[0]]];
				var html = image ? '<img src="' + Dex.resourcePrefix + 'sprites/custom/' + BattleLog.escapeHTML(image.file) + '" alt=""' + (image.pixelated ? ' class="pixelated"' : '') + ' />' :
					(room.dexStandardSprite(cell[0]) || { html: '<em>No sprite</em>' }).html;
				return '<button class="dexspritecell" name="showDexSprite" value="' + cell[0] + '"><span class="dexspriteimg">' + html + '</span><small>' + cell[2] + '</small></button>';
			}).join('') + '</div>';
		},
		dexSpeciesCodeHTML: function (species) {
			var values = this.dexSpeciesCodeValues(species);
			var node = this.dexSpeciesCodeNode();
			node.fields = $.extend({}, node.fields);
			delete node.fields.learnset;
			delete values.learnset;
			return this.dexCodeHTML(species.id, values, node);
		},
		dexLearnsetCodeHTML: function (species) {
			var node = this.dexSpeciesCodeNode();
			return '<div class="setchart dexcodebox">' + this.dexCodeHTML(species.id, { learnset: this.dexSpeciesLearnset(species) }, CODE.obj({ learnset: node.fields.learnset }, false, ['learnset'])) + '</div>';
		},
		refreshDexCode: function () {
			var top = this.$('.dexmonpage [data-panel=code]').scrollTop();
			this.refreshDexPage();
			this.$('.dexmonpage [data-panel=code]').scrollTop(top);
		},
		openDexPokemon: function (name, picked) {
			var view = DexViews.current = this.dexView;
			var species = view.dex.species.get(name);
			if (!view.species[species.id]) return;
			if (this.$('.dexpage').is(':visible')) this.dexScrollTop = this.dexScroller().scrollTop();
			this.dexSpecies = species;
			this.dexFamilyOf = null;
			this.dexEffect = null;
			this.dexEditField = null;
			this.dexPicker = null;
			this.$('.dexsearchpage, .dexpage').hide();
			this.$('.dexmonpage').show();
			this.dexScroller().scrollTop(0);

			var editable = this.dexEditable;
			var buf = '<div class="pad">';
			buf += '<button name="backDexFamily" class="button"><i class="fa fa-chevron-left"></i> Family</button></div>';
			buf += '<div class="teambar"><button name="showDexMonPanel" value="list" class="pokemon"><i class="fa fa-pencil"></i> Editor</button>' +
				' <button name="showDexMonPanel" value="code" class="pokemon"><i class="fa fa-code"></i> Code</button></div>';
			if (this.dexCodeFor !== 'Pokedex:' + species.id) {
				this.dexCodeFor = 'Pokedex:' + species.id;
				this.dexCodePending = {};
			}

			buf += '<div class="teamchartbox individual"><ol class="teamchart"><li' + stageHue(view, species) + '>';
			buf += this.dexPokemonMenuHTML();
			buf += this.dexSpeciesRowHTML(species, editable);
			buf += '</li></ol></div>';
			buf += '<div class="teambuilder-results" data-panel="list"></div><div class="teambuilder-results" data-panel="picker"></div>';
			if (editable) buf += '<div class="teambuilder-results" data-panel="field"></div>';
			buf += '<div class="dexstatresults" data-panel="stats" style="display:none">' + this.dexStatsHTML(species, species.bst) + '</div>';
			buf += '<div class="dexstatresults dexeffectpanel" data-panel="details" style="display:none">' + this.dexDetailsHTML() + '</div>';
			if (editable) buf += this.dexAttributePanelHTML();
			buf += '<div class="dexstatresults dexeffectpanel dexcode" data-panel="code" style="display:none"><div class="pad">' + this.dexSpritesCodeHTML(species) +
				'<div class="setchart dexcodebox">' + this.dexSpeciesCodeHTML(species) + '</div>' +
				this.dexLearnsetCodeHTML(species) + '</div></div>';
			this.dexSpeciesBST = species.bst;
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
		dexSpeciesRowHTML: function (species, editable) {
			var view = this.dexView;
			var sprites = view.sprites[species.id] || {};
			var standard = hasStandardSprites(species.id);
			var buf = '<div class="setchart-nickname"><label>Sprites</label><div class="textbox spritebox">';
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
			buf += '<div class="setcell setcell-details"><label>Attributes</label><button class="textbox setdetails" tabindex="-1" name="showDexDetails">';
			buf += '<span class="detailcell detailcell-first"><label>Gender</label>' +
				(species.gender ? { M: 'Male', F: 'Female', N: '&mdash;' }[species.gender] : ratio ? (ratio.M * 100) + '% M' : '50% M') + '</span>';
			buf += '<span class="detailcell"><label>Weight</label>' + (species.weightkg || '&mdash;') + ' kg</span>';
			buf += '<span class="detailcell"><label>Height</label>' + (species.heightm || '&mdash;') + ' m</span>';
			var origin = view.origins[species.id];
			if (origin) buf += '<span class="detailcell"><label>Origin</label>' + BattleLog.escapeHTML(origin) + '</span>';
			buf += '</button></div></div>';
			buf += '<div class="setrow setrow-icons"><div class="setcell"><span class="itemicon"></span></div><div class="setcell setcell-typeicons dextypeselects">';
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
				for (var k = 0; k < species.types.length; k++) buf += '<span class="dextypeslot" title="' + BattleLog.escapeHTML(species.types[k]) + '">' + Dex.getTypeIcon(species.types[k]) + '</span>';
			}
			buf += '</div></div>';
			buf += '<div class="setrow setrow-abilities">';
			buf += '<div class="setcell"><label>Abilities</label><div class="textbox dexchipbox dexabilitybox">' + this.dexAbilityChipsHTML(abilitySlotsOf(species), !editable) + '</div></div>';
			buf += '</div></div>';

			buf += '<div class="setcol setcol-moves">';
			buf += '<div class="setcell"><label>Evolves from</label><div class="textbox dexchipbox dexprevobox">' + this.dexPrevoChipsHTML(species.prevo || '', !editable) + '</div></div>';
			buf += '<div class="setcell dexevocell"><label>Evolves into</label><div class="textbox dexchipbox dexevobox">' + this.dexEvoChipsHTML(species.evos || [], !editable) + '</div></div>';
			buf += '<div class="setcell setcell-learnset"><label class="dexlearnsetlabel">Learnset</label><input type="text" class="textbox dexfield learnsetcount" name="listsearch" placeholder="Moves" autocomplete="off" /></div>';
			buf += '</div>';

			buf += '<div class="setcol setcol-stats"><div class="setrow"><label>Stats</label><button class="textbox setstats" tabindex="-1" name="showDexStats">';
			buf += '<span class="statrow statrow-head"><label></label> <span class="statgraph"></span> <em>Base</em></span>';
			for (var stat in BattleStatNames) {
				var value = species.baseStats[stat];
				var width = Math.min(value * 75 / 255, 75);
				var color = Math.min(Math.floor(value * 180 / 255), 360);
				buf += '<span class="statrow" data-stat="' + stat + '"><label>' + BattleStatNames[stat] + '</label> <span class="statgraph"><span style="width:' + width + 'px;background:hsl(' + color + ',40%,75%);"></span></span> <em>' + value + '</em></span>';
			}
			buf += '</button></div></div>';
			return buf + '</div>';
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
		dexMenuHTML: function (copy, remove, removeValue, extra) {
			var buf = '<div class="setmenu">' + (this.dexEditable ? this.dexSaveHTML('dexsave') : '') + this.dexEditsHTML() +
				' <button name="' + copy + '"><i class="fa fa-clone"></i>Copy</button>' + (this.dexEditable && extra || '');
			if (this.dexEditable && remove) {
				buf += ' <button name="' + remove[0] + '"' + (removeValue ? ' value="' + BattleLog.escapeHTML(removeValue) + '"' : '') + '><i class="fa fa-trash"></i>' + remove[1] + '</button>';
			}
			return buf + '</div>';
		},
		dexPokemonMenuHTML: function () {
			return this.dexMenuHTML('copyDexPokemon', null, '', this.dexMembershipHTML(this.dexSpecies));
		},
		dexMembershipHTML: function (species) {
			var value = ' value="' + BattleLog.escapeHTML(species.name) + '"';
			if (!this.dexView.species[species.id]) return ' <button name="addDexPokemon"' + value + '><i class="fa fa-plus-circle"></i>Add to dex</button>';
			var entries = DexViews.entries[this.dexView.dexid];
			return ' <button name="deleteDexPokemon"' + value + '><i class="fa fa-trash"></i>Delete</button>' +
				(entries && entries.originals[species.id] ? ' <button name="resetDexPokemon"' + value + '><i class="fa fa-undo"></i>Reset to base</button>' : '');
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
			this.markDexCodeEdits(this.dexSpeciesCodeValues(species), this.dexSpeciesCodeValues(was));
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
			var evos = species.evos || [];
			var wasEvos = was.evos || [];
			mark($page.find('.dexprevobox .dexchip'), changed(species.prevo, was.prevo));
			mark($page.find('.dexprevobox'), !!was.prevo && !species.prevo);
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
		dexAbilityChipsHTML: function (entries, readonly) {
			var chips = entries.map(function (entry, i) {
				return '<span class="dexchip"' + (readonly ? '' : ' draggable="true" data-index="' + i + '"') + '><small>' + entry[0] + ':</small> ' + BattleLog.escapeHTML(entry[1]) +
					(readonly ? '' : ' <button class="dexchipx" name="removeDexAbility" value="' + BattleLog.escapeHTML(entry[1]) + '" tabindex="-1">&times;</button>') + '</span>';
			}).join('');
			if (readonly) return chips || '<span class="dexplaceholder">Abilities</span>';
			return chips + '<input type="text" class="chartinput dexchipinput" name="abilities"' + (entries.length ? '' : ' placeholder="Abilities"') + ' autocomplete="off" />';
		},
		dexPrevoChipsHTML: function (prevo, readonly) {
			var chip = prevo ? '<span class="dexchip">' + BattleLog.escapeHTML(prevo) +
				(readonly ? '' : ' <button class="dexchipx" name="removeDexPrevo" value="' + BattleLog.escapeHTML(prevo) + '" tabindex="-1">&times;</button>') + '</span>' : '';
			if (readonly) return chip || '<span class="dexplaceholder">From</span>';
			return chip + '<input type="text" class="chartinput dexchipinput" name="prevo"' + (prevo ? '' : ' placeholder="From"') + ' autocomplete="off" />';
		},
		dexEvoChipsHTML: function (evos, readonly) {
			var chips = evos.map(function (evo) {
				return '<span class="dexchip">' + BattleLog.escapeHTML(evo) +
					(readonly ? '' : ' <button class="dexchipx" name="removeDexEvo" value="' + BattleLog.escapeHTML(evo) + '" tabindex="-1">&times;</button>') + '</span>';
			}).join('');
			if (readonly) return chips || '<span class="dexplaceholder">Into</span>';
			return chips + '<input type="text" class="chartinput dexchipinput" name="evos"' + (evos.length ? '' : ' placeholder="Into"') + ' autocomplete="off" />';
		},
		dexLearnsetCount: function (species) {
			var view = this.dexView;
			var $results = $('<div></div>');
			var search = new BattleSearch($results, $results);
			viewSearch(search, view);
			search.setType('move', 'gen' + view.gen + 'ag', { species: species.name, moves: [] });
			return search.engine.results.filter(function (row) { return row[0] === 'move'; }).length;
		},
		updateDexLearnsetCount: function (entriesLoaded) {
			var view = this.dexView;
			var species = this.dexSpecies;
			if (!species) return;
			if (!DexViews.entries[view.dexid]) return DexViews.loadEntries(view.dexid);
			this.$('.dexmonpage .setmenu').replaceWith(this.dexPokemonMenuHTML());
			this.markDexEdits();
			this.$('.dexmonpage .dexlearnsetlabel').text('Learnset (' + this.dexLearnsetCount(species) + ')');
			if (entriesLoaded) this.setDexLearnsetList();
		},
		closeDexPokemon: function (value, button) {
			if (button) return this.leaveDex(button, function () { this.closeDexPokemon(); });
			this.dexSpecies = null;
			this.dexFamilyOf = null;
			this.dexEffect = null;
			this.$('.dexmonpage').removeClass('dexcodetab').hide().empty();
			this.$('.dexpage').show();
			if (this.dexSearch && this.dexSearchView !== this.dexView) this.setupDexSearch(this.dexView);
			this.dexScroller().scrollTop(this.dexScrollTop || 0);
		},
		dexDetailsHTML: function () {
			var species = this.dexSpecies;
			var editable = this.dexEditable;
			var room = this;
			if (this.dexDetailsFor !== species.id) {
				this.dexDetailsFor = species.id;
				this.dexAddedDetails = {};
			}
			var boxes = DETAILS.filter(function (detail) { return room.dexDetailShown(detail[0]); }).map(function (detail) {
				var removable = editable && ALWAYS_DETAILS.indexOf(detail[0]) < 0;
				var parts = detail[2].split('___');
				var value = detailHTML(species, detail[0], editable);
				return ['data-detail="' + detail[0] + '"', detail[1], parts[0] + (editable ? value : '<span class="dexvalue">' + value + '</span>') + parts[1], removable && ['removeDexDetail', detail[0]]];
			});
			var data = this.dexView.Pokedex[species.id] || {};
			var origin = this.dexView.origins[species.id];
			$.each([["Origin", origin], ["Category", data.category && 'The ' + data.category + ' Pok\u00e9mon'], ["Dex entry", data.dexEntry]], function (i, info) {
				if (info[1]) boxes.push(['', info[0], BattleLog.escapeHTML(info[1])]);
			});
			return this.dexSentencesHTML(boxes.map(function (box, i) {
				return room.dexSentenceHTML(box[0], box[1], box[2], box[3], Math.round(i * 280 / Math.max(boxes.length - 1, 1)));
			}).join(''), editable && 'name="showDexDetailList"');
		},
		dexDetailShown: function (key) {
			return ALWAYS_DETAILS.indexOf(key) >= 0 || !!(this.dexAddedDetails || {})[key] || detailValue(this.dexSpecies, key) !== '';
		},
		dexDetailListHTML: function (query) {
			var room = this;
			query = toID(query);
			var rows = DETAILS.filter(function (detail) {
				return !room.dexDetailShown(detail[0]) && (!query || toID(detail[1] + ' ' + detail[2]).indexOf(query) >= 0);
			}).map(function (detail) {
				return DexViews.ui.sentenceRowHTML('detail|' + detail[0], detail[1], detail[2]);
			});
			return DexViews.ui.chartHTML([['', rows]], "No more attributes to add.");
		},
		dexSentenceHTML: function (attrs, title, body, remove, hue) {
			var hued = hue !== undefined && hue !== null;
			return '<div class="dexsentence' + (hued ? ' dexhued" style="--hue: ' + hue : '') + '"' + (attrs ? ' ' + attrs : '') + '>' +
				(remove ? '<button class="button dexremoveattr" name="' + remove[0] + '" value="' + remove[1] + '" title="Remove"><i class="fa fa-times"></i></button>' : '') +
				'<label class="dexsentencehead">' + title + '</label>' + body + '</div>';
		},
		dexSentencesHTML: function (boxes, button) {
			return '<div class="pad"><div class="dexfieldsection dexeffectfields">' + boxes + '</div>' +
				(button ? '<p><button class="button" ' + button + '><i class="fa fa-plus"></i> New attribute</button></p>' : '') + '</div>';
		},
		dexAttributePanelHTML: function () {
			return '<div class="dexstatresults dexeffectpanel" data-panel="attributes"><div class="pad"><p><input type="search" class="textbox dexattrsearch" placeholder="Search attributes" size="30" autocomplete="off" /></p></div>' +
				'<div class="dexattrlist"></div></div>';
		},
		searchDexAttributes: function () {
			var query = this.$('.dexmonpage .dexattrsearch').val();
			this.$('.dexmonpage .dexattrlist').html(this.dexEffect ? this.dexAttributeListHTML(query) : this.dexDetailListHTML(query));
		},
		keyDexAttributeSearch: function (e) {
			if (e.keyCode === 13) this.$('.dexmonpage .dexattrlist a[data-entry]').first().click();
			if (e.keyCode !== 27) return;
			if (this.dexEffect) this.showDexEffectPanel('fields', true);
			else this.showDexMonPanel('details', true);
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
			this.$('.dexmonpage').toggleClass('dexcodetab', panel === 'code');
			this.$('.dexmonpage .teambar button').each(function () {
				this.disabled = (this.value === 'code') === (panel === 'code');
			});
			var room = this;
			var species = this.dexSpecies;
			if (panel === 'code' && !window.BattleLearnsets) {
				loadLearnsets().then(function () {
					if (room.dexSpecies === species && room.dexPanel === 'code') room.refreshDexCode();
				}, function () {});
			}
		},
		showDexDetails: function (value, button) {
			this.openDexFamilyRow(button);
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
		showDexStats: function (value, button) {
			this.openDexFamilyRow(button);
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
			var species = this.dexView.dex.species.get(value || this.dexSpecies.name);
			var line = evoParent(this.dexView, species) || (species.evos || []).some(function (evo) { return this.dexView.species[toID(evo)]; }, this);
			app.addPopup(DexCopyPopup, { room: this, kind: 'pokemon', name: species.name, line: !!line, sourceEl: button });
		},
		showDexPagePanel: function (panel, keep) {
			if (this.dexEffect) return this.showDexEffectPanel(panel, keep);
			this.showDexMonPanel(panel, keep);
		},
		focusDexNameSearch: function (e) {
			if (this.openDexFamilyRow(e.currentTarget)) return this.$('.dexmonpage input[name=namesearch]').focus();
			e.currentTarget.select();
			this.showDexPagePanel('picker', true);
		},
		searchDexNameSearch: function (e) {
			if (this.dexPanel !== 'picker') this.showDexPagePanel('picker', true);
			if (this.dexPicker) this.dexPicker.find($.trim(e.currentTarget.value));
		},
		blurDexNameSearch: function (e) {
			var current = this.dexEffect ? this.dexEffectData : this.dexSpecies;
			if (current) e.currentTarget.value = current.name;
		},
		focusDexListSearch: function (e) {
			if (this.openDexFamilyRow(e.currentTarget)) return this.$('.dexmonpage input[name=listsearch]').focus();
			if (this.dexPanel !== 'list') this.showDexPagePanel('list', true);
		},
		searchDexList: function (e) {
			if (this.dexPanel !== 'list') this.showDexPagePanel('list', true);
			this.dexListSearch.find($.trim(e.currentTarget.value));
		},
		setupDexPicker: function () {
			var table = this.dexEffect && this.dexEffect.table;
			var search = this.dexPicker = DexViews.ui.panelSearch(this.$('.dexmonpage [data-panel=picker]'));
			if (table === 'Conditions') return this.setupDexConditionList(search);
			viewSearch(search, this.dexView, DexViews.ui.dexEntryResults(this.dexid));
			search.setType(table ? DexViews.ui.EFFECT_KINDS[table] : 'pokemon', 'gen' + this.dexView.gen);
		},
		reopenDexPokemon: function (name, panel) {
			var self = this;
			if (this.$('.dexmonpage input[type=range]:active').length) {
				$(document).one('mouseup', function () {
					setTimeout(function () {
						if (self.dexSpecies && self.dexSpecies.name === name) self.reopenDexPokemon(name, panel);
					});
				});
				return;
			}
			var focused = this.$('.dexmonpage input:focus').attr('name');
			this.openDexPokemon(name);
			if (panel && panel !== 'field') this.showDexMonPanel(panel, true);
			if (focused) this.$('.dexmonpage input[name="' + focused + '"]').focus();
		},
		focusDexField: function (e) {
			var name = e.currentTarget.name;
			if (this.openDexFamilyRow(e.currentTarget)) return this.$('.dexmonpage input[name="' + name + '"]').focus();
			if (this.dexEditField === name && this.dexPanel === 'field') return;
			this.dexEditField = name;
			this.showDexMonPanel('field', true);
			this.listDexRelatives(name);
		},
		searchDexField: function (e) {
			this.dexFieldSearch.find($.trim(e.currentTarget.value));
		},
		dexRelativeIds: function (field) {
			var species = this.dexView.dex.species.get(this.dexSpecies.id);
			var names = field === 'evos' ? species.evos || [] : field === 'prevo' && species.prevo ? [species.prevo] :
				field === 'abilities' ? DexViews.ui.abilitySlotsOf(species).map(function (entry) { return entry[1]; }) : [];
			var ids = {};
			for (var i = 0; i < names.length; i++) ids[toID(names[i])] = 1;
			return ids;
		},
		focusDexChips: function (e) {
			if (!$(e.target).closest('button').length) $(e.currentTarget).find('input').focus();
		},
		dexAbilitySlots: function () {
			return DexViews.ui.abilitySlotsOf(this.dexView.dex.species.get(this.dexSpecies.id));
		},
		removeDexAbility: function (name, button) {
			this.openDexFamilyRow(button);
			this.toggleDexAbility(name);
		},
		toggleDexAbility: function (name) {
			var entries = this.dexAbilitySlots();
			var index = entries.findIndex(function (entry) { return toID(entry[1]) === toID(name); });
			if (index >= 0) {
				entries.splice(index, 1);
				if (entries.length && entries[0][0] !== '0') entries[0] = ['0', entries[0][1]];
			} else {
				var used = entries.map(function (entry) { return entry[0]; });
				var slot = ['0', '1', 'H', 'S'].filter(function (free) { return !used.includes(free); })[0];
				if (!slot) return app.addPopup(Popup, { message: "A Pok\u00e9mon can have at most four abilities." });
				entries.push([slot, name]);
			}
			this.setDexAbilities(entries);
		},
		setDexAbilities: function (entries) {
			var abilities = {};
			for (var i = 0; i < entries.length; i++) abilities[entries[i][0]] = entries[i][1];
			this.saveDexPokemon({ abilities: abilities });
			this.$('.dexmonpage .dexabilitybox').html(this.dexAbilityChipsHTML(this.dexAbilitySlots()));
			this.markDexEdits();
			if (this.dexPanel !== 'field' || this.dexEditField !== 'abilities') return;
			this.listDexRelatives('abilities');
			this.$('.dexmonpage input[name=abilities]').focus();
		},
		dragDexAbility: function (e) {
			var transfer = e.originalEvent.dataTransfer;
			transfer.effectAllowed = 'move';
			transfer.setData('text/plain', e.currentTarget.dataset.index);
		},
		dragOverDexAbility: function (e) {
			e.preventDefault();
			e.originalEvent.dataTransfer.dropEffect = 'move';
		},
		dropDexAbility: function (e) {
			e.preventDefault();
			var from = Number(e.originalEvent.dataTransfer.getData('text/plain'));
			var chips = $(e.currentTarget).find('.dexchip');
			if (isNaN(from) || !chips[from]) return;
			var to = chips.length - 1;
			for (var i = 0; i < chips.length; i++) {
				if (e.originalEvent.clientX < chips[i].getBoundingClientRect().right) {
					to = i;
					break;
				}
			}
			if (to === from) return;
			this.openDexFamilyRow(e.currentTarget);
			var entries = this.dexAbilitySlots();
			var names = entries.map(function (entry) { return entry[1]; });
			names.splice(to, 0, names.splice(from, 1)[0]);
			this.setDexAbilities(entries.map(function (entry, j) { return [entry[0], names[j]]; }));
		},
		removeDexPrevo: function (name, button) {
			this.openDexFamilyRow(button);
			this.setDexPrevo('');
		},
		setDexPrevo: function (name) {
			this.saveDexPokemon({ prevo: name || null });
			this.$('.dexmonpage .dexprevobox').html(this.dexPrevoChipsHTML(name));
			this.markDexEdits();
			if (this.dexPanel !== 'field' || this.dexEditField !== 'prevo') return;
			this.listDexRelatives('prevo');
			this.$('.dexmonpage input[name=prevo]').focus();
		},
		removeDexEvo: function (name, button) {
			this.openDexFamilyRow(button);
			this.toggleDexEvo(name);
		},
		toggleDexEvo: function (name) {
			var evos = (this.dexView.dex.species.get(this.dexSpecies.id).evos || []).slice();
			var index = evos.findIndex(function (evo) { return toID(evo) === toID(name); });
			if (index >= 0) evos.splice(index, 1);
			else evos.push(name);
			this.saveDexPokemon({ evos: evos.length ? evos : null });
			this.$('.dexmonpage .dexevobox').html(this.dexEvoChipsHTML(evos));
			this.markDexEdits();
			if (this.dexPanel !== 'field' || this.dexEditField !== 'evos') return;
			this.listDexRelatives('evos');
			this.$('.dexmonpage input[name=evos]').focus();
		},
		listDexRelatives: function (field) {
			var search = this.dexFieldSearch = DexViews.ui.panelSearch(this.$('.dexmonpage [data-panel=field]'));
			DexViews.ui.viewSearch(search, this.dexView);
			search.setType(field === 'abilities' ? 'ability' : 'pokemon', 'gen' + this.dexView.gen + 'ag', undefined, this.dexRelativeIds(field));
		},
		clickDexMonEntry: function (e) {
			e.preventDefault();
			if (this.dexEffect) return this.clickDexEffectEntry(e);
			var entry = e.currentTarget.dataset.entry.split('|');
			if (entry[0] === 'detail') return this.addDexDetail(entry[1]);
			var panel = $(e.currentTarget).closest('[data-panel]').attr('data-panel');
			var search = { list: this.dexListSearch, picker: this.dexPicker, field: this.dexFieldSearch }[panel];
			var field = panel === 'field' && this.dexEditField;
			var dexView = this.dexView;
			if (entry[0] === 'move' && panel === 'list') {
				if (this.dexEditable) this.toggleDexLearnset(toID(entry[1]));
				else this.openDexEffect('Moves', entry[1], this.dexSpecies.name);
				return;
			}
			if (entry[0] === 'pokemon' && panel === 'picker') {
				this.openDexPokemon(dexView.dex.species.get(entry[1]).name, true);
				return;
			} else if (entry[0] === 'ability' && field === 'abilities') {
				this.toggleDexAbility(dexView.dex.abilities.get(entry[1]).name);
				return;
			} else if (entry[0] === 'pokemon' && field === 'evos') {
				this.toggleDexEvo(dexView.dex.species.get(entry[1]).name);
				return;
			} else if (entry[0] === 'pokemon' && field === 'prevo') {
				this.setDexPrevo(dexView.dex.species.get(entry[1]).name);
				return;
			}
			if (search && search.addFilter(e.currentTarget)) search.find('');
		},
		toggleDexMove: function (speciesid, moveid) {
			var view = this.dexView;
			var species = view.dex.species.get(speciesid);
			var own = DexViews.learnsetOf(view, speciesid);
			var learnset = {};
			if (!own) {
				var base = toID(typeof species.battleOnly === 'string' ? species.battleOnly : species.baseSpecies);
				for (var id in DexViews.learnsetOf(view, base) || {}) learnset[id] = [view.gen + 'M'];
			}
			learnset[moveid] = own && own[moveid] ? null : [view.gen + 'M'];
			this.draftDex('pokemon', species.id, { name: species.name, learnset: learnset });
		},
		refreshDexList: function (update) {
			var $results = this.$('.dexmonpage [data-panel=list]');
			var top = $results.scrollTop();
			update.call(this);
			$results.scrollTop(top);
			this.dexListSearch.updateScroll();
		},
		toggleDexLearnset: function (moveid) {
			this.refreshDexList(function () {
				this.toggleDexMove(this.dexSpecies.id, moveid);
				this.setDexLearnsetList();
				this.updateDexLearnsetCount();
			});
		},
		slideDexStat: function (e) {
			var stat = e.currentTarget.name.slice(11);
			var value = Number(e.currentTarget.value);
			var color = Math.min(Math.floor(value * 180 / 255), 360);
			e.currentTarget.style.setProperty('--fill', 'hsl(' + color + ',85%,45%)');
			e.currentTarget.style.setProperty('--pct', (value * 100 / 255) + '%');
			var $row = this.$('.dexmonpage .setstats .statrow[data-stat=' + stat + ']');
			$row.find('.statgraph span').css({ width: Math.min(value * 75 / 255, 75) + 'px', background: 'hsl(' + color + ',40%,75%)' });
			$row.find('em').text(value);
			this.$('.dexmonpage input[name=stat-' + stat + ']').val(value);
			this.$('.dexmonpage .dexmin-' + stat).text(stat === 'hp' ? 2 * value + 110 : Math.floor((2 * value + 5) * 0.9));
			this.$('.dexmonpage .dexmax-' + stat).text(stat === 'hp' ? 2 * value + 204 : Math.floor((2 * value + 99) * 1.1));
			var bst = 0;
			this.$('.dexmonpage input[type=number][name^=stat-]').each(function () { bst += Number(this.value) || 0; });
			this.$('.dexmonpage .dexbst').text(bst);
		},
		typeDexStat: function (e) {
			var $slider = this.$('.dexmonpage input[name=statslider-' + e.currentTarget.name.slice(5) + ']');
			$slider.val(Math.min(255, Math.max(0, Number(e.currentTarget.value) || 0)));
			this.slideDexStat({ currentTarget: $slider[0] });
		},
		saveDexStats: function () {
			var baseStats = {};
			this.$('.dexmonpage input[type=number][name^=stat-]').each(function () {
				baseStats[this.name.slice(5)] = Math.min(255, Math.max(0, Number(this.value) || 0));
			});
			this.saveDexPokemon({ baseStats: baseStats });
		},
		saveDexPokemon: function (fields, refresh) {
			this.draftDex('pokemon', this.dexSpecies.id, $.extend({ name: this.dexSpecies.name }, fields));
			if (refresh) this.refreshDexPage();
		},
		changeDexType: function (e) {
			this.openDexFamilyRow(e.currentTarget);
			var types = this.dexSpecies.types.slice();
			types[Number(e.currentTarget.dataset.index)] = e.currentTarget.value;
			this.saveDexPokemon({ types: types.filter(Boolean) }, true);
		},
		showDexDetailList: function () {
			this.showDexMonPanel('attributes', true);
			this.$('.dexmonpage .dexattrsearch').val('').focus();
			this.searchDexAttributes();
		},
		addDexDetail: function (key) {
			this.dexAddedDetails[key] = true;
			this.$('.dexmonpage [data-panel=details]').html(this.dexDetailsHTML());
			this.showDexMonPanel('details', true);
			this.markDexEdits();
			this.$('.dexmonpage [data-detail=' + key + ']').find('input, select').first().focus();
		},
		removeDexDetail: function (key) {
			delete this.dexAddedDetails[key];
			var edit = {};
			edit[key] = key === 'eggGroups' ? [] : null;
			this.saveDexPokemon(edit, true);
		},
		changeDexDetail: function (e) {
			var key = $(e.currentTarget).closest('[data-detail]').attr('data-detail');
			var value = $.trim(e.currentTarget.value);
			var edit = {};
			if (key === 'gender') {
				var gender = this.$('.dexmonpage [data-detail=gender] select').val();
				var male = Math.min(100, Math.max(0, Number(this.$('.dexmonpage [data-detail=gender] input').val()) || 0)) / 100;
				edit.gender = gender || null;
				if (!gender) edit.genderRatio = { M: male, F: Math.round((1 - male) * 1000) / 1000 };
			} else if (['weightkg', 'heightm', 'evoLevel'].includes(key)) {
				edit[key] = value ? Number(value) : null;
			} else if (['eggGroups', 'tags'].includes(key)) {
				edit[key] = value ? listValue(value) : key === 'eggGroups' ? [] : null;
			} else {
				edit[key] = value || null;
			}
			this.saveDexPokemon(edit, true);
		},
		showDexSprite: function (kind, button) {
			if (this.openDexFamilyRow(button)) button = this.$('.dexmonpage button[name=showDexSprite][value="' + kind + '"]')[0];
			app.addPopup(DexViews.ui.DexSpritePopup, { room: this, kind: kind, sourceEl: button });
		},
		newDexPokemon: function (value, button) {
			var room = this;
			app.addPopup(DexViews.ui.DexNamePopup, {
				sourceEl: button,
				callback: function (name) {
					var id = toID(name);
					if (room.dexView.species[id]) return room.openDexPokemon(name);
					room.pendingSpecies = name;
					if (room.dexView.dex.species.get(id).exists && !DexViews.custom.Pokedex[id]) return room.addDexPokemon(name);
					room.editDex({ pokemon: {
						name: name, types: ['Normal'], abilities: { 0: 'No Ability' }, baseStats: { hp: 50, atk: 50, def: 50, spa: 50, spd: 50, spe: 50 },
						eggGroups: ['Undiscovered'], weightkg: 10
					} });
				}
			});
		},
		addDexPokemon: function (name) {
			this.editDex({ addpokemon: { names: [name] } });
		},
		deleteDexPokemon: function (name, button) {
			this.confirmDeletePokemon([toID(name)], button);
		},
		resetDexPokemon: function (name, button) {
			this.deleteDexEntries('Pokedex', [toID(name)], true, button);
		}
	});

	_.extend(window.DexBuilderRoom.prototype.events, {
		'change .dexmonpage .dexcodebox .dexcodeleaf input, .dexmonpage .dexcodebox .dexcodeleaf select': 'changeDexCode',
		'change .dexmonpage .dexcodebox select.dexcodeaddkey': 'addDexCodeKey',
		'input .dexmonpage .dexattrsearch': 'searchDexAttributes',
		'keydown .dexmonpage .dexattrsearch': 'keyDexAttributeSearch',
		'focus .dexmonpage input[name=namesearch]': 'focusDexNameSearch',
		'input .dexmonpage input[name=namesearch]': 'searchDexNameSearch',
		'blur .dexmonpage input[name=namesearch]': 'blurDexNameSearch',
		'focus .dexmonpage input[name=listsearch]': 'focusDexListSearch',
		'input .dexmonpage input[name=listsearch]': 'searchDexList',
		'click .dexmonpage .utilichart a[data-entry]': 'clickDexMonEntry',
		'focus .dexmonpage input.chartinput': 'focusDexField',
		'input .dexmonpage input.chartinput': 'searchDexField',
		'input .dexmonpage input[name^=statslider]': 'slideDexStat',
		'input .dexmonpage input[type=number][name^=stat-]': 'typeDexStat',
		'change .dexmonpage input[name^=stat]': 'saveDexStats',
		'change .dexmonpage select[name=dextype]': 'changeDexType',
		'change .dexmonpage [data-detail] input, .dexmonpage [data-detail] select': 'changeDexDetail',
		'click .dexmonpage .dexchipbox': 'focusDexChips',
		'dragstart .dexmonpage .dexabilitybox .dexchip': 'dragDexAbility',
		'dragover .dexmonpage .dexabilitybox': 'dragOverDexAbility',
		'drop .dexmonpage .dexabilitybox': 'dropDexAbility'
	});

	document.addEventListener('wheel', function (e) {
		var box = e.target.closest && e.target.closest('.dexmonchart .dexfield, .dexmonchart .dexchipbox');
		if (!box || e.deltaX || e.shiftKey || box.scrollWidth <= box.clientWidth) return;
		var before = box.scrollLeft;
		box.scrollLeft += e.deltaY * (e.deltaMode ? 16 : 1);
		if (box.scrollLeft !== before) e.preventDefault();
	}, { passive: false });

})(window.jQuery);
