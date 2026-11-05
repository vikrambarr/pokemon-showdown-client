(function ($) {

	var DEX_SLOTS = 3;

	var DexViews = window.DexViews;
	var DexConfirmPopup = DexViews.ui.DexConfirmPopup;
	var OFFICIAL_BADGE = DexViews.ui.OFFICIAL_BADGE;
	var PICKER_CARET = ' <i class="fa fa-caret-down dexpickercaret"></i>';
	var TAB_ICONS = { Pokedex: 'paw', Moves: 'bolt', Abilities: 'star', Items: 'shopping-bag', Conditions: 'cloud', TypeChart: 'th' };
	var VIEW_METHODS = [
		'setupDexSearch', 'createDexList', 'showDexTab', 'renderDexTypes', 'scaleDexList', 'updateDexScroll', 'searchPokemon', 'searchPokemonKey', 'clickDexEntry',
		'openDexPokemon', 'scaleDexPokemon', 'closeDexPokemon', 'clickDexMove', 'openDexMove', 'renderDexMove', 'showDexMoveList',
		'showDexMoveDetails', 'closeDexMove', 'dexStatsHTML', 'showDexStats', 'showDexLearnset', 'selectDexFormat', 'scaleDexFormat',
		'openDexFormat', 'renderDexFormat', 'showDexFormatList', 'renderDexFormatTree', 'renderDexFormatBans', 'searchDexFormat'
	];
	var view = _.pick(RoomsRoom.prototype, VIEW_METHODS);
	var SINGLES_TIERS = ['AG', 'Uber', '(Uber)', 'OU', '(OU)', 'UUBL', 'UU', 'RUBL', 'RU', 'NUBL', 'NU', '(NU)', 'PUBL', 'PU', '(PU)', 'ZUBL', 'ZU', 'NFE', 'LC', 'Illegal', 'Unreleased'];
	var DOUBLES_TIERS = ['DUber', '(DUber)', 'DOU', 'DBL', '(DOU)', 'DUU', '(DUU)', 'NFE', 'LC', 'Illegal', 'Unreleased'];
	var TIER_STYLES = [['singles', "Singles", 'tier'], ['natdex', "National Dex", 'natDexTier'], ['doubles', "Doubles", 'doublesTier'], ['vgc', "VGC", '']];
	var EVO_TYPES = ['', 'trade', 'useItem', 'levelMove', 'levelExtra', 'levelFriendship', 'levelHold', 'other'];
	var SPRITE_KINDS = { front: 'Front', back: 'Back', 'front-shiny': 'Shiny front', 'back-shiny': 'Shiny back', icon: 'Icon' };

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

	var DexSettingsPopup = Popup.extend({
		width: 340,
		events: {
			'change input[name=name]': 'saveDexName',
			'change input[name=private]': 'saveDexPrivate',
			'change select[name=base]': 'saveDexBase',
			'input textarea[name=description]': 'queueDexDescription',
			'change textarea[name=description]': 'saveDexDescription',
			'submit form': 'submitForm',
			'click .username': 'clickUsername'
		},
		initialize: function (data) {
			this.room = data.room;
			this.room.settingsPopup = this;
			this.$el.css('max-width', this.width);
			var summary = this.room.curSummary;
			var locked = this.isOwner() ? '' : ' disabled';
			var buf = '<form class="dexsettings">';
			buf += '<p><label class="label">Name:<br /><input type="text" class="textbox" name="name" value="' + BattleLog.escapeHTML(summary.name) + '" size="24" maxlength="40"' + locked + ' /></label></p>';
			buf += '<p><label class="checkbox"><input type="checkbox" name="private"' + (summary.visibility === 'private' ? ' checked' : '') + locked + ' /> Private (unlisted)</label></p>';
			buf += '<p><label class="label">World:<br /><select name="base" class="button"' + locked + '>' + baseOptions(summary) + '</select></label></p>';
			buf += '<p><label class="label">Description:<br /><textarea class="textbox" name="description" rows="4" maxlength="512">' + BattleLog.escapeHTML(summary.description || '') + '</textarea></label></p></form>';
			buf += '<div class="dexrest">' + this.dexRestHTML() + '</div>';
			this.$el.html(buf);
		},
		remove: function () {
			if (this.descriptionTimer) this.saveDexDescription();
			if (this.room.settingsPopup === this) this.room.settingsPopup = null;
			return Popup.prototype.remove.apply(this, arguments);
		},
		dismiss: function () {
			var index = app.popups.indexOf(this);
			if (index >= 0) app.popups.splice(index, 1);
			this.remove();
		},
		isOwner: function () {
			return toID(this.room.curSummary.owner) === app.user.get('userid');
		},
		sync: function () {
			var summary = this.room.curSummary;
			var $form = this.$('form.dexsettings');
			var $name = $form.find('input[name=name]');
			if (!$name.is(':focus')) $name.val(summary.name);
			$form.find('select[name=base]').html(baseOptions(summary));
			$form.find('input[name=private]').prop('checked', summary.visibility === 'private');
			var $description = $form.find('textarea[name=description]');
			if (!$description.is(':focus') && !this.descriptionTimer) $description.val(summary.description || '');
			this.$('.dexrest').html(this.dexRestHTML());
		},
		dexRestHTML: function () {
			var summary = this.room.curSummary;
			var userid = app.user.get('userid');
			var isOwner = this.isOwner();
			var buf = '<h3>Editors</h3><form class="dexeditors"><ul class="dexeditorlist">';
			buf += '<li>' + this.editorHTML(summary.owner) + ' <small>owner</small></li>';
			for (var i = 0; i < summary.editors.length; i++) {
				var editor = summary.editors[i];
				buf += '<li>' + this.editorHTML(editor) + (isOwner || toID(editor) === userid ?
					' <button class="button small" name="removeDexEditor" value="' + BattleLog.escapeHTML(editor) + '" title="Remove"><i class="fa fa-times"></i></button>' : '') + '</li>';
			}
			buf += '</ul>';
			if (isOwner) {
				buf += '<p><input type="text" class="textbox" name="editor" placeholder="Username" size="20" /> <button type="submit" class="button"><i class="fa fa-user-plus"></i> Add editor</button></p>';
			}
			buf += '</form>';
			if (isOwner) buf += '<p><button class="button" name="deleteDex"><i class="fa fa-trash"></i> Delete dex</button></p>';
			return buf;
		},
		editorHTML: function (name) {
			return '<button type="button" class="username" data-name="' + BattleLog.escapeHTML(name) + '" style="' + BattleLog.hashColor(toID(name)) + '">' + BattleLog.escapeHTML(name) + '</button>';
		},
		clickUsername: function (e) {
			e.preventDefault();
			e.stopPropagation();
			app.addPopup(UserPopup, { name: $(e.currentTarget).data('name'), sourceEl: e.currentTarget, sourcePopup: this, position: 'right' });
		},
		editDex: function (edit) {
			this.room.editDex(edit);
		},
		submitForm: function (e) {
			e.preventDefault();
			if ($(e.currentTarget).hasClass('dexeditors')) return this.addDexEditor();
			this.saveDexName();
		},
		saveDexName: function () {
			var $name = this.$('form.dexsettings input[name=name]');
			var name = $.trim($name.val());
			if (!name || name === this.room.curSummary.name) return $name.val(this.room.curSummary.name);
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
			if (description !== (this.room.curSummary.description || '')) this.editDex({ description: description });
		},
		saveDexBase: function (e) {
			var summary = this.room.curSummary;
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
				sourcePopup: this,
				callback: function () { self.editDex({ base: base }); }
			});
		},
		addDexEditor: function () {
			var name = $.trim(this.$('input[name=editor]').val());
			if (name) this.editDex({ editor: name, add: true });
		},
		removeDexEditor: function (name) {
			this.editDex({ editor: name });
		},
		deleteDex: function () {
			var self = this;
			app.addPopup(DexConfirmPopup, {
				message: 'Delete ' + BattleLog.escapeHTML(this.room.curSummary.name) + '? This can\'t be undone. Replays of its battles keep working.',
				button: "Delete dex",
				callback: function () { self.editDex({ 'delete': true }); }
			});
		}
	});

	function listValue(text) {
		return text.split(',').map(function (part) { return $.trim(part); }).filter(Boolean);
	}

	var DexTypesPopup = Popup.extend({
		initialize: function (data) {
			this.room = data.room;
			var dex = this.room.dexView.dex;
			var types = this.room.dexSpecies.types;
			var names = dex.types.names().filter(function (name) { return dex.types.get(name).exists !== false; });
			var select = function (name, value, blank) {
				return '<select name="' + name + '" class="button">' + (blank ? '<option value="">(none)</option>' : '') + names.map(function (type) {
					return '<option value="' + BattleLog.escapeHTML(type) + '"' + (type === value ? ' selected' : '') + '>' + BattleLog.escapeHTML(type) + '</option>';
				}).join('') + '</select>';
			};
			this.$el.html('<form><p><label class="label">Type 1:<br />' + select('type1', types[0]) + '</label></p>' +
				'<p><label class="label">Type 2:<br />' + select('type2', types[1], true) + '</label></p>' +
				'<p class="buttonbar"><button type="submit" class="button"><strong>Save</strong></button> <button type="button" name="close" class="button">Cancel</button></p></form>');
		},
		submit: function (data) {
			this.close();
			this.room.saveDexPokemon({ types: [data.type1].concat(data.type2 && data.type2 !== data.type1 ? [data.type2] : []) });
		}
	});

	var DexDetailsPopup = Popup.extend({
		initialize: function (data) {
			this.room = data.room;
			var species = this.species = this.room.dexSpecies;
			var ratio = species.genderRatio;
			var text = function (label, name, value, size) {
				return '<p><label class="label">' + label + ':<br /><input type="text" class="textbox" name="' + name + '" value="' + BattleLog.escapeHTML(value === undefined || value === null ? '' : String(value)) + '" size="' + (size || 20) + '" /></label></p>';
			};
			var buf = '<form class="dexdetailsform">';
			buf += text('Weight (kg)', 'weightkg', species.weightkg, 8) + text('Height (m)', 'heightm', species.heightm, 8);
			buf += '<p><label class="label">Gender:<br /><select name="gender" class="button">';
			buf += [['', 'Ratio'], ['M', 'Always male'], ['F', 'Always female'], ['N', 'Genderless']].map(function (option) {
				return '<option value="' + option[0] + '"' + ((species.gender || '') === option[0] ? ' selected' : '') + '>' + option[1] + '</option>';
			}).join('') + '</select></label></p>';
			buf += text('Male %', 'male', ratio ? ratio.M * 100 : 50, 6);
			buf += text('Egg groups', 'eggGroups', (species.eggGroups || []).join(', '));
			buf += text('Color', 'color', species.color || '');
			buf += text('Tags', 'tags', (species.tags || []).join(', '));
			buf += '<p><label class="label">Evo type:<br /><select name="evoType" class="button">' + EVO_TYPES.map(function (type) {
				return '<option value="' + type + '"' + ((species.evoType || '') === type ? ' selected' : '') + '>' + (type || '(level)') + '</option>';
			}).join('') + '</select></label></p>';
			buf += text('Evo level', 'evoLevel', species.evoLevel || '', 6) + text('Evo item', 'evoItem', species.evoItem || '');
			buf += text('Evo move', 'evoMove', species.evoMove || '') + text('Evo condition', 'evoCondition', species.evoCondition || '');
			buf += '<p class="buttonbar"><button type="submit" class="button"><strong>Save</strong></button> <button type="button" name="close" class="button">Cancel</button></p></form>';
			this.old = this.values(species);
			this.$el.html(buf);
		},
		values: function (species) {
			var ratio = species.genderRatio;
			return {
				weightkg: String(species.weightkg || ''), heightm: String(species.heightm || ''), gender: species.gender || '',
				male: String(ratio ? ratio.M * 100 : 50), eggGroups: (species.eggGroups || []).join(', '), color: species.color || '',
				tags: (species.tags || []).join(', '), evoType: species.evoType || '', evoLevel: String(species.evoLevel || ''),
				evoItem: species.evoItem || '', evoMove: species.evoMove || '', evoCondition: species.evoCondition || ''
			};
		},
		submit: function (data) {
			var old = this.old;
			var edit = {};
			var changed = function (key) { return $.trim(data[key]) !== old[key]; };
			for (var key in old) {
				if (!changed(key) || key === 'male' || key === 'gender') continue;
				var value = $.trim(data[key]);
				if (['weightkg', 'heightm', 'evoLevel'].includes(key)) {
					edit[key] = value ? Number(value) : null;
				} else if (['eggGroups', 'tags'].includes(key)) {
					edit[key] = value ? listValue(value) : null;
				} else {
					edit[key] = value || null;
				}
			}
			if (changed('gender') || changed('male')) {
				if (data.gender) {
					edit.gender = data.gender;
				} else {
					var male = Math.min(100, Math.max(0, Number(data.male) || 0)) / 100;
					edit.gender = null;
					edit.genderRatio = { M: male, F: Math.round((1 - male) * 1000) / 1000 };
				}
			}
			this.close();
			if (Object.keys(edit).length) this.room.saveDexPokemon(edit);
		}
	});

	var DexSpritePopup = Popup.extend({
		initialize: function (data) {
			this.room = data.room;
			this.kind = data.kind;
			var room = this.room;
			var uploadid = (room.dexView.sprites[room.dexSpecies.id] || {})[data.kind];
			var image = uploadid && room.dexView.images[uploadid];
			var buf = '<form><p><strong>' + SPRITE_KINDS[data.kind] + ' sprite</strong></p>';
			if (image) {
				buf += '<p><img src="' + Dex.resourcePrefix + 'sprites/custom/' + BattleLog.escapeHTML(image.file) + '" width="' + image.width * 2 + '" height="' + image.height * 2 + '" alt=""' +
					(image.pixelated ? ' class="pixelated"' : '') + ' /></p>';
			} else {
				buf += '<p><em>No custom sprite.</em></p>';
			}
			buf += '<p><input type="file" name="file" accept="image/png,image/gif" /></p>';
			buf += '<p><label class="checkbox"><input type="checkbox" name="pixelated"' + (!image || image.pixelated ? ' checked' : '') + ' /> Pixel art</label></p>';
			buf += '<p class="buttonbar"><button type="submit" class="button"><strong>Upload</strong></button>' +
				(image ? ' <button type="button" name="clearSprite" class="button">Remove</button>' : '') +
				' <button type="button" name="close" class="button">Cancel</button></p></form>';
			this.$el.html(buf);
		},
		submit: function () {
			var file = this.$('input[name=file]')[0].files[0];
			if (!file) return;
			var room = this.room;
			var name = room.dexSpecies.name;
			var settings = { pixelated: this.$('input[name=pixelated]').is(':checked') };
			this.close();
			room.setSaveState('saving');
			DexViews.ui.request('dexupload', room.dexid + ', ' + name + ', ' + this.kind + ', ' + JSON.stringify(settings)).then(function (data) {
				return new Promise(function (resolve) {
					$.ajax({ url: data.url, method: 'POST', data: file, processData: false, contentType: file.type, dataType: 'json' }).done(resolve).fail(function (xhr) {
						resolve(xhr.responseJSON || { error: "The upload didn't work." });
					});
				});
			}).then(function (result) {
				room.setSaveState(result.error ? 'failed' : 'saved');
				if (result.error) app.addPopup(Popup, { message: result.error });
				app.send('/crq dexes');
			}, function (err) {
				room.setSaveState('failed');
				app.addPopup(Popup, { message: err.message });
			});
		},
		clearSprite: function () {
			this.close();
			this.room.editDex({ sprite: { name: this.room.dexSpecies.name, kind: this.kind, image: null } });
		}
	});

	var DexTierPopup = Popup.extend({
		initialize: function (data) {
			this.room = data.room;
			this.names = data.species;
			var room = this.room;
			var style = room.tierActiveStyle;
			var typedSearch = room.tierSearch.engine.typedSearch;
			var dex = room.dexView.dex;
			var current = this.names.length === 1 ? typedSearch.getTier(dex.species.get(this.names[0])) : '';
			var base = '';
			if (room.tierDetails && this.names.length === 1) {
				var overrides = typedSearch.tierOverrides;
				typedSearch.tierOverrides = null;
				base = typedSearch.getTier(dex.species.get(this.names[0]));
				typedSearch.tierOverrides = overrides;
			}
			var buf = '<p><strong>' + (this.names.length === 1 ? BattleLog.escapeHTML(this.names[0]) : this.names.length + ' Pok&eacute;mon') + '</strong></p><div class="dextierbuttons">';
			buf += (style === 'doubles' ? DOUBLES_TIERS : SINGLES_TIERS).map(function (tier) {
				return '<button class="button' + (tier === current ? ' cur' : '') + '" name="pickTier" value="' + BattleLog.escapeHTML(tier) + '">' +
					BattleLog.escapeHTML(DexViews.ui.tierHeader(tier)) + (tier === base ? ' <small>(All formats)</small>' : '') + '</button>';
			}).join('') + '</div>';
			if (room.tierDetails) buf += '<p><button class="button" name="pickTier" value="">Use the All formats tier</button></p>';
			this.$el.html(buf);
		},
		pickTier: function (tier) {
			this.close();
			this.room.saveDexTiers(this.names, tier || null);
		}
	});

	var DexNewPokemonPopup = Popup.extend({
		type: 'semimodal',
		initialize: function (data) {
			this.room = data.room;
			this.$el.html('<form><p><label class="label">Name:<br /><input type="text" class="textbox autofocus" name="name" maxlength="40" /></label></p>' +
				'<p><label class="label">Copy from (optional):<br /><input type="text" class="textbox" name="from" placeholder="Pikachu" /></label></p>' +
				'<p class="buttonbar"><button type="submit" class="button"><strong>Create</strong></button> <button type="button" name="close" class="button">Cancel</button></p></form>');
		},
		submit: function (data) {
			var name = $.trim(data.name);
			if (!name) return;
			this.close();
			var room = this.room;
			if (room.dexView.species[toID(name)]) return room.openDexPokemon(name);
			room.pendingSpecies = name;
			var input = { name: name };
			if ($.trim(data.from)) input.inheritsFrom = $.trim(data.from);
			room.editDex({ pokemon: input });
		}
	});

	var DexNewFormatPopup = Popup.extend({
		type: 'semimodal',
		initialize: function (data) {
			this.room = data.room;
			var gen = this.room.dexView.gen;
			var options = '';
			for (var id in BattleFormats) {
				var format = BattleFormats[id];
				if (format.dexid || format.team || !id.startsWith('gen')) continue;
				options += '<option value="' + id + '"' + (id === 'gen' + gen + 'ou' ? ' selected' : '') + '>' + BattleLog.escapeHTML(format.name) + '</option>';
			}
			this.$el.html('<form><p><label class="label">Name:<br /><input type="text" class="textbox autofocus" name="name" maxlength="40" /></label></p>' +
				'<p><label class="label">Start from:<br /><select name="from" class="button">' + options + '</select></label></p>' +
				'<p class="buttonbar"><button type="submit" class="button"><strong>Create</strong></button> <button type="button" name="close" class="button">Cancel</button></p></form>');
		},
		submit: function (data) {
			var name = $.trim(data.name);
			if (!name) return;
			this.close();
			this.room.editDex({ format: { name: name, from: data.from } });
		}
	});

	window.DexBuilderRoom = window.Room.extend({
		type: 'dexbuilder',
		title: 'Dexbuilder',
		events: {
			'click .selectFolder': 'selectFolder',
			'change select[name=dexpicker]': 'selectFolder',
			'input input[name=pokemonsearch]': 'searchPokemon',
			'keydown input[name=pokemonsearch]': 'searchPokemonKey',
			'click .dexpokemon a[data-entry]': 'clickDexEntry',
			'click .dexmonpage .utilichart a[data-entry]': 'clickDexMonEntry',
			'input input[name=formatsearch]': 'searchDexFormat',
			'input input[name=tiersearch]': 'searchDexTiers',
			'change select[name=tierstyle]': 'changeTierStyle',
			'click .dextierpage a[data-entry]': 'clickDexTierEntry',
			'click .dexformatpage .utilichart a[data-entry]': 'clickDexFormatEntry',
			'focus .dexmonpage input.chartinput': 'focusDexField',
			'input .dexmonpage input.chartinput': 'searchDexField',
			'change .dexmonpage input.chartinput': 'saveDexField',
			'input .dexmonpage input[name^=statslider]': 'slideDexStat',
			'input .dexmonpage input[type=number][name^=stat-]': 'typeDexStat',
			'change .dexmonpage input[name^=stat]': 'saveDexStats',
			'change input[name=formatname]': 'renameDexFormat'
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
			if (!this.$('.folderpane').length) {
				this.$el.html('<div class="folderpane"></div><div class="teampane"></div>');
				this.$('.teampane').on('scroll', this.updateDexScroll.bind(this));
			}
			var userid = app.user.get('userid');
			var dexes = DexViews.list.filter(DexViews.ui.canEdit);
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
			this.dexOptions = this.dexOptionsHTML(slots, shared, official);
			this.$('select[name=dexpicker]').html(this.dexOptions);
			if (key === this.teamListKey) return;
			this.teamListKey = key;
			this.updateTeamList(summary);
		},
		dexPickerHTML: function (heading) {
			return '<div class="dexpicker">' + heading + '<select name="dexpicker">' + this.dexOptions + '</select></div>';
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
		dexOptionsHTML: function (slots, shared, official) {
			var self = this;
			var options = function (label, list, extra) {
				if (!list.length && !extra) return '';
				return '<optgroup label="' + label + '">' + list.map(function (summary) {
					return '<option value="' + BattleLog.escapeHTML(summary.id) + '"' + (self.curFolder === summary.id ? ' selected' : '') + '>' + BattleLog.escapeHTML(summary.name) + '</option>';
				}).join('') + (extra || '') + '</optgroup>';
			};
			return (this.curFolder ? '' : '<option value="" selected disabled>(choose a dex)</option>') + options("Dexes", slots, '<option value="+">(new dex)</option>') + options("Shared with you", shared) + options("Official", official);
		},
		folderHTML: function (summary) {
			var cur = this.curFolder === summary.id;
			return '<div class="folder' + (cur ? ' cur"><div class="folderhack3"><div class="folderhack1"></div><div class="folderhack2"></div>' : '">') +
				'<div class="selectFolder" data-value="' + BattleLog.escapeHTML(summary.id) + '"><i class="fa ' + (cur ? 'fa-folder-open' : 'fa-folder') + '"></i>' +
				BattleLog.escapeHTML(summary.name) + '</div></div>' + (cur ? '</div>' : '');
		},
		updateTeamList: function (summary) {
			var sameDex = summary && this.curSummary && this.curSummary.id === summary.id && this.$('.dexheading').length;
			this.curSummary = summary;
			if (!summary) {
				this.$el.removeClass('dexsubpage');
				if (this.settingsPopup) this.settingsPopup.dismiss();
				var buf = this.dexPickerHTML('<h2><i class="fa fa-folder-open-o"></i> Dexes' + PICKER_CARET + '</h2>');
				buf += '<ul class="teamlist"><li><p><em>' + (app.user.get('named') ? 'you don\'t have any dexes lol' : 'log in to make dexes') + '</em></p></li></ul>';
				this.$('.teampane').html(buf);
				return;
			}
			if (this.settingsPopup) {
				if (sameDex) this.settingsPopup.sync();
				else this.settingsPopup.dismiss();
			}
			if (sameDex) {
				this.$('.dexheading').html(this.dexHeadingHTML());
				if (this.dexKey(summary) !== this.dexKey(this.dexSummary)) this.loadDex(summary);
				return;
			}
			this.saveState = '';
			this.$el.removeClass('dexsubpage');
			this.dexid = summary.id;
			this.dexSummary = summary;
			this.dexTab = '';
			this.dexView = null;
			this.dexSearch = null;
			this.dexSpecies = null;
			this.dexMove = null;
			this.dexFormat = '';
			this.dexFormatId = '';
			this.dexEditable = true;
			var buf = '<button class="button dexmenu" name="openDexSettings" title="Dex settings"><i class="fa fa-ellipsis-h"></i></button>';
			buf += this.dexPickerHTML('<h2 class="dexheading">' + this.dexHeadingHTML() + '</h2>');
			buf += '<div class="dexpage"><div class="dexbuildertabs"></div><div class="dexbuildersub" style="display:none">' +
				'<p><button class="button" name="closeDexTab"><i class="fa fa-chevron-left"></i> Dex</button> <strong class="dexsubtitle"></strong></p>' +
				'<p class="dexpokemonsearch"><input type="search" class="textbox" name="pokemonsearch" placeholder="Search Pok&eacute;mon" size="30" autocomplete="off" />' +
				' <button class="button" name="newDexPokemon"><i class="fa fa-plus"></i> New Pok&eacute;mon</button></p>' +
				'<div class="dextabempty"></div><div class="dexpokemon"></div><div class="dexformatpage"></div><div class="dextierpage" style="display:none"></div></div></div>' +
				'<div class="dexmonpage" style="display:none"></div>';
			this.$('.teampane').html(buf);
			this.loadDex(summary);
		},
		loadDex: function (summary) {
			var self = this;
			if (this.dexSummary && this.dexSummary.hash !== summary.hash) delete DexViews.entries[summary.id];
			DexViews.loadEntries(summary.id);
			this.dexSummary = summary;
			this.$('.dexbuildertabs').html(this.dexTabsHTML(summary));
			DexViews.load(summary).then(function (loadedView) {
				if (self.dexid !== summary.id || self.dexSummary !== summary) return;
				self.renderBuilderDex(summary, loadedView);
			}, function (err) {
				if (self.dexid === summary.id) self.$('.dextabempty').show().html('<p>' + BattleLog.escapeHTML(err.message) + '</p>');
			});
		},
		dexKey: function (summary) {
			return summary.hash + summary.updated + JSON.stringify(summary.formats);
		},
		dexTabsHTML: function (summary) {
			var buf = summary.counts.map(function (count, i) {
				return '<button class="button dexbuildertab" name="showDexTab" value="' + i + '"><i class="fa fa-' + TAB_ICONS[count.table] + '"></i>' +
					count.name + '</button>';
			}).join('');
			buf += '<button class="button dexbuildertab" name="showDexTab" value="tiers"><i class="fa fa-sort-amount-desc"></i>Tiers</button>';
			return buf + '<button class="button dexbuildertab" name="showDexTab" value="formats"><i class="fa fa-trophy"></i>Formats</button>';
		},
		renderBuilderDex: function (summary, loadedView) {
			var sameView = this.dexView === loadedView && this.dexSearch;
			this.dexView = DexViews.current = loadedView;
			var formats = summary.formats.map(function (format) { return format.id; });
			var oldFormat = this.dexFormat;
			if (!formats.includes(this.dexFormat)) this.dexFormat = formats[0] || '';
			if (sameView) {
				if (this.dexTab === 'formats') this.refreshDexFormat(oldFormat !== this.dexFormat);
				if (this.dexTab === 'tiers') this.renderDexTiers();
				return;
			}
			var statsOpen = this.$('.dexmonpage .dexstatresults').is(':visible');
			this.dexFormatId = '';
			this.dexFormatSearch = null;
			this.setupDexSearch(loadedView);
			var pending = this.pendingSpecies;
			this.pendingSpecies = null;
			var species = this.dexSpecies;
			if (pending && loadedView.species[toID(pending)]) {
				this.openDexPokemon(pending);
			} else if (species) {
				if (loadedView.species[species.id]) {
					this.openDexPokemon(species.name);
					if (statsOpen) this.showDexLearnset(true);
				} else {
					this.closeDexPokemon();
				}
			}
		},
		closeDexTab: function () {
			this.showDexTab('');
			this.dexScroller().scrollTop(0);
		},
		renderDexTiers: function () {
			var self = this;
			var formatid = this.tierFormat;
			if (!this.dexSummary.formats.some(function (format) { return format.id === formatid; })) formatid = this.tierFormat = '';
			this.tierSelected = this.tierSelected || {};
			if (!formatid) return this.renderDexTierPage(null);
			DexViews.ui.request('dexformat', formatid).then(function (details) {
				if (self.tierFormat === formatid && self.dexTab === 'tiers') self.renderDexTierPage(details);
			}, function (err) {
				if (self.tierFormat === formatid) self.$('.dextierpage').html('<p>' + BattleLog.escapeHTML(err.message) + '</p>');
			});
		},
		renderDexTierPage: function (details) {
			var room = this;
			var scroller = this.dexScroller();
			var top = scroller.scrollTop();
			var style = this.tierStyle || 'singles';
			if (details) {
				var probe = {};
				DexViews.ui.setTierStyle(probe, details);
				style = probe.isVGC ? 'vgc' : probe.isDoubles ? 'doubles' : probe.isNatDex ? 'natdex' : 'singles';
			}
			var info = TIER_STYLES.filter(function (entry) { return entry[0] === style; })[0];
			var overrides = details ? details.tiers : {};
			this.tierDetails = details;
			this.tierActiveStyle = style;
			var buf = '<p><label class="label">Format:</label><button class="select formatselect" name="selectTierFormat" value="' + BattleLog.escapeHTML(this.tierFormat || '') + '">' +
				(this.tierFormat ? BattleLog.escapeFormat(this.tierFormat) : '(All formats)') + '</button></p>';
			if (details) {
				buf += '<p><small>' + BattleLog.escapeFormat(details.id) + ' uses <strong>' + info[1] + '</strong> tiers. Changes here only affect this format.</small>' +
					(info[2] && Object.keys(overrides).length ? ' <button class="button" name="resetDexTiers">Reset to All formats</button>' : '') + '</p>';
			} else {
				buf += '<p><label class="label">Tiers: <select name="tierstyle" class="button">' + TIER_STYLES.map(function (entry) {
					return '<option value="' + entry[0] + '"' + (entry[0] === style ? ' selected' : '') + '>' + entry[1] + '</option>';
				}).join('') + '</select></label></p>';
			}
			buf += '<p class="dextierbar"><input type="search" class="textbox" name="tiersearch" placeholder="Search Pok&eacute;mon" size="24" autocomplete="off" />';
			if (info[2]) {
				buf += ' <span class="dextierselection"></span>';
			} else {
				buf += ' <small>VGC groups come from each Pok&eacute;mon\'s tags, so they can\'t be changed here.</small>';
			}
			buf += '</p><div class="teambuilder-results dextierlist"></div>';
			this.$('.dextierpage').html(buf);
			var $list = this.$('.dextierlist');
			var search = this.tierSearch = this.createDexList($list, 'dexListZoom');
			this.scaleDexList();
			search.renderRow = function (id, type, matchStart, matchLength, errorMessage, attrs) {
				if (type === 'pokemon') {
					var speciesid = toID(id);
					var classes = (overrides[speciesid] && overrides[speciesid][info[2]] ? ' dextieroverride' : '') + (room.tierSelected[speciesid] ? ' cur' : '');
					if (classes) attrs = (attrs || '') + ' class="' + classes.slice(1) + '"';
				}
				return BattleSearch.prototype.renderRow.call(this, id, type, matchStart, matchLength, errorMessage, attrs);
			};
			DexViews.ui.viewSearch(search, this.dexView, function (typedSearch) {
				typedSearch.isNatDex = style === 'natdex';
				typedSearch.isDoubles = style === 'doubles' || style === 'vgc';
				typedSearch.isVGC = style === 'vgc';
				typedSearch.tierOverrides = details ? overrides : null;
			});
			search.setType('pokemon', 'gen' + this.dexView.gen);
			this.updateTierSelection();
			scroller.scrollTop(top);
		},
		selectTierFormat: function (value, button) {
			var room = this;
			var summary = this.dexSummary;
			app.addPopup(DexViews.ui.DexFormatPopup, {
				format: this.tierFormat || '', sourceEl: button, section: summary.name, dexid: summary.id, selectType: 'watch',
				onselect: function (format) {
					room.tierFormat = format;
					room.tierSelected = {};
					room.renderDexTiers();
				}
			});
		},
		changeTierStyle: function (e) {
			this.selectTierStyle(e.currentTarget.value);
		},
		selectTierStyle: function (style) {
			this.tierStyle = style;
			this.tierSelected = {};
			this.renderDexTierPage(null);
		},
		searchDexTiers: function (e) {
			this.tierSearch.find(e.currentTarget.value);
		},
		clearDexTiers: function () {
			this.tierSelected = {};
			this.updateTierSelection();
		},
		updateTierSelection: function () {
			var selected = this.tierSelected;
			this.$('.dextierlist a[data-entry^="pokemon|"]').each(function () {
				$(this).toggleClass('cur', !!selected[toID(this.dataset.entry.slice(8))]);
			});
			var count = Object.keys(selected).length;
			var hint = '<small>Shift-click or ' + (/Mac/.test(navigator.platform) ? 'Cmd' : 'Ctrl') + '-click to select several.</small>';
			if (count) {
				hint = count + ' selected <button class="button" name="moveDexTiers"><strong>Move to tier&hellip;</strong></button> ' +
					'<button class="button" name="clearDexTiers">Clear</button>';
			}
			this.$('.dextierselection').html(hint);
		},
		clickDexTierEntry: function (e) {
			e.preventDefault();
			var entry = e.currentTarget.dataset.entry.split('|');
			if (entry[0] !== 'pokemon') {
				if (this.tierSearch.addFilter(e.currentTarget)) this.tierSearch.find('');
				return;
			}
			if (this.tierActiveStyle === 'vgc') return;
			e.stopPropagation();
			app.dismissPopups();
			var dex = this.dexView.dex;
			var name = dex.species.get(entry[1]).name;
			var id = toID(name);
			if (e.shiftKey && this.tierAnchor) {
				var rows = (this.tierSearch.engine.results || this.tierSearch.engine.typedSearch.getBaseResults()).filter(function (row) {
					return row[0] === 'pokemon';
				}).map(function (row) { return toID(row[1]); });
				var from = rows.indexOf(this.tierAnchor);
				var to = rows.indexOf(id);
				if (from < 0) from = to;
				for (var i = Math.min(from, to); i <= Math.max(from, to); i++) this.tierSelected[rows[i]] = dex.species.get(rows[i]).name;
				this.updateTierSelection();
				return;
			}
			this.tierAnchor = id;
			if (e.shiftKey || e.ctrlKey || e.metaKey) {
				if (this.tierSelected[id]) delete this.tierSelected[id];
				else this.tierSelected[id] = name;
				this.updateTierSelection();
				return;
			}
			this.clearDexTiers();
			app.addPopup(DexTierPopup, { room: this, species: [name], sourceEl: e.currentTarget });
		},
		moveDexTiers: function (value, button) {
			var names = _.values(this.tierSelected);
			if (names.length) app.addPopup(DexTierPopup, { room: this, species: names, sourceEl: button });
		},
		saveDexTiers: function (names, tier) {
			var field = TIER_STYLES.filter(function (entry) { return entry[0] === this.tierActiveStyle; }, this)[0][2];
			this.tierSelected = {};
			this.editDex({ tiers: { format: this.tierFormat || undefined, field: field, species: names, tier: tier } });
		},
		resetDexTiers: function (value, button) {
			var self = this;
			app.addPopup(DexConfirmPopup, {
				message: 'Put every Pok&eacute;mon in ' + BattleLog.escapeFormat(this.tierFormat) + ' back on its All formats tier?',
				button: "Reset tiers",
				sourceEl: button,
				callback: function () { self.editDex({ tiers: { format: self.tierFormat, field: 'tier', reset: true } }); }
			});
		},
		refreshDexFormat: function (changed) {
			if (changed || !this.dexFormat || !this.dexFormatDetails) {
				this.dexFormatId = '';
				this.showDexTab('formats');
				return;
			}
			var self = this;
			var formatid = this.dexFormat;
			DexViews.ui.request('dexformat', formatid).then(function (details) {
				if (self.dexFormat !== formatid || self.dexTab !== 'formats') return;
				var scroller = self.dexScroller();
				var top = scroller.scrollTop();
				var query = self.$('input[name=formatsearch]').val();
				self.renderDexFormat(details);
				if (query) self.$('input[name=formatsearch]').val(query).trigger('input');
				scroller.scrollTop(top);
			});
		},
		dexScroller: function () {
			return this.$('.teampane');
		},
		showDexTab: function (tab) {
			var home = tab === '' || tab === null || tab === undefined;
			this.$el.toggleClass('dexsubpage', !home);
			this.$('.dexbuildertabs').toggle(home);
			this.$('.dexbuildersub').toggle(!home);
			if (home) {
				this.dexTab = '';
				this.$('.dexbuildertab').removeClass('cur').blur();
				return;
			}
			if (tab !== this.dexTab) this.dexScroller().scrollTop(0);
			if (!this.dexSearch) {
				this.dexTab = String(tab);
				return;
			}
			var tiers = String(tab) === 'tiers';
			this.$('.dextierpage').toggle(tiers);
			this.scaleDexList();
			this.scaleDexFormat();
			if (tiers) {
				this.dexTab = 'tiers';
				this.$('.dexpokemonsearch, .dexpokemon, .dextabempty, .dexformatpage').hide();
				this.$('.dexsubtitle').text("Tiers");
				this.renderDexTiers();
				return;
			}
			view.showDexTab.call(this, tab);
			this.$('.dexsubtitle').text(this.$('.dexbuildertab[value="' + this.dexTab + '"]').contents().filter(function () { return this.nodeType === 3; }).text());
			this.$('button[name=newDexPokemon]').toggle(this.dexTab === '0');
			if (this.dexTab !== 'formats' || this.dexFormat) return;
			this.$('.dexformatpage').html('<div class="pad"><p><em>This dex has no formats yet.</em></p>' +
				'<p><button class="button" name="newDexFormat"><i class="fa fa-plus"></i> New format</button></p></div>');
		},
		openDexPokemon: function (name) {
			view.openDexPokemon.call(this, name);
			if (this.dexSpecies) this.setDexLearnsetList();
		},
		showDexLearnset: function (stats) {
			view.showDexLearnset.call(this, stats);
			if (stats !== true) this.setDexLearnsetList();
		},
		setDexLearnsetList: function () {
			var search = this.dexPokemonSearch;
			var dexView = this.dexView;
			var species = this.dexSpecies;
			this.dexEditField = null;
			var own = this.dexLearnset = {};
			var learnset = DexViews.learnsetOf(dexView, species.id) || {};
			for (var id in learnset) {
				if (learnset[id]) own[id] = 1;
			}
			DexViews.ui.viewSearch(search, dexView, function (typedSearch, searchType) {
				if (searchType !== 'move') return;
				var getBaseResults = typedSearch.getBaseResults;
				typedSearch.getBaseResults = function () {
					var learned = [];
					var inherited = [];
					var others = [];
					var seen = {};
					var rows = getBaseResults.call(this);
					for (var i = 0; i < rows.length; i++) {
						if (rows[i][0] !== 'move' || seen[rows[i][1]]) continue;
						seen[rows[i][1]] = 1;
						(own[rows[i][1]] ? learned : inherited).push(rows[i]);
					}
					var ids = Object.keys(BattleMovedex).concat(Object.keys(dexView.Moves));
					for (var j = 0; j < ids.length; j++) {
						var move = this.dex.moves.get(ids[j]);
						if (!move.exists || move.isMax || move.isZ || seen[move.id]) continue;
						seen[move.id] = 1;
						others.push(['move', move.id]);
					}
					others.sort(function (a, b) { return a[1] < b[1] ? -1 : 1; });
					var results = [['header', "Learnset (" + learned.length + ") \u2014 click a move to remove it"]].concat(learned);
					if (inherited.length) results = results.concat([['header', "From pre-evolutions (" + inherited.length + ")"]], inherited);
					return results.concat([['header', "Other moves \u2014 click a move to add it"]], others);
				};
			});
			search.setType('move', 'gen' + dexView.gen + 'ag', { species: species.name, moves: [] });
		},
		focusDexField: function (e) {
			var name = e.currentTarget.name;
			if (this.dexEditField === name) return;
			this.dexEditField = name;
			this.$('.dexmonpage .dexstatresults').hide();
			this.$('.dexmonpage .teambuilder-results').show();
			var type = name.startsWith('ability') ? 'ability' : 'pokemon';
			var dexView = this.dexView;
			DexViews.ui.viewSearch(this.dexPokemonSearch, dexView);
			this.dexPokemonSearch.setType(type, 'gen' + dexView.gen + 'ag');
			this.searchDexField(e);
		},
		searchDexField: function (e) {
			var value = e.currentTarget.value;
			if (e.currentTarget.name === 'evos') value = value.split(',').pop();
			this.dexPokemonSearch.find($.trim(value));
		},
		clickDexMonEntry: function (e) {
			e.preventDefault();
			var entry = e.currentTarget.dataset.entry.split('|');
			var field = this.dexEditField;
			var dexView = this.dexView;
			if (entry[0] === 'move' && !field) {
				if (!this.canLearnFromPrevo(entry[1])) this.toggleDexLearnset(entry[1]);
				return;
			}
			var $input = field && this.$('.dexmonpage input[name="' + field + '"]');
			if (entry[0] === 'ability' && field && field.startsWith('ability')) {
				$input.val(dexView.dex.abilities.get(entry[1]).name);
			} else if (entry[0] === 'pokemon' && (field === 'prevo' || field === 'evos')) {
				var name = dexView.dex.species.get(entry[1]).name;
				$input.val(field === 'evos' ? listValue($input.val()).slice(0, -1).concat([name]).join(', ') : name);
			} else {
				if (this.dexPokemonSearch.addFilter(e.currentTarget)) this.dexPokemonSearch.find('');
				return;
			}
			this.saveDexField({ currentTarget: $input[0] });
		},
		saveDexField: function (e) {
			var name = e.currentTarget.name;
			var dex = this.dexView.dex;
			var $input = $(e.currentTarget).removeClass('incomplete');
			var value = $.trim($input.val());
			if (name.startsWith('ability')) {
				var abilities = {};
				var bad = false;
				this.$('.dexmonpage input[name^=ability]').each(function () {
					var ability = $.trim(this.value);
					if (!ability) return;
					if (!dex.abilities.get(ability).exists) {
						$(this).addClass('incomplete');
						bad = true;
					}
					abilities[this.name.slice(7)] = ability;
				});
				if (!bad) this.saveDexPokemon({ abilities: abilities });
				return;
			}
			var names = name === 'evos' ? listValue(value) : value ? [value] : [];
			if (names.some(function (species) { return !dex.species.get(species).exists; })) {
				$input.addClass('incomplete');
				return;
			}
			this.saveDexPokemon(name === 'evos' ? { evos: names.length ? names : null } : { prevo: value || null });
		},
		canLearnFromPrevo: function (moveid) {
			var typedSearch = this.dexPokemonSearch.engine.typedSearch;
			return !this.dexLearnset[moveid] && typedSearch.canLearn(this.dexSpecies.id, moveid);
		},
		toggleDexLearnset: function (moveid) {
			var learnset = {};
			learnset[moveid] = this.dexLearnset[moveid] ? null : [this.dexView.gen + 'M'];
			this.saveDexPokemon({ learnset: learnset });
		},
		slideDexStat: function (e) {
			var stat = e.currentTarget.name.slice(11);
			var value = Number(e.currentTarget.value);
			var color = Math.min(Math.floor(value * 180 / 255), 360);
			e.currentTarget.style.setProperty('--fill', 'hsl(' + color + ',85%,45%)');
			e.currentTarget.style.setProperty('--pct', (value * 100 / 255) + '%');
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
		saveDexPokemon: function (fields) {
			this.editDex({ pokemon: $.extend({ name: this.dexSpecies.name }, fields) });
		},
		editDexTypes: function (value, button) {
			app.addPopup(DexTypesPopup, { room: this, sourceEl: button });
		},
		showDexDetails: function (value, button) {
			app.addPopup(DexDetailsPopup, { room: this, sourceEl: button, maxWidth: 320 });
		},
		showDexSprite: function (kind, button) {
			app.addPopup(DexSpritePopup, { room: this, kind: kind, sourceEl: button });
		},
		newDexPokemon: function (value, button) {
			app.addPopup(DexNewPokemonPopup, { room: this, sourceEl: button });
		},
		deleteDexPokemon: function (name, button) {
			var self = this;
			var custom = DexViews.custom.Pokedex[toID(name)];
			app.addPopup(DexConfirmPopup, {
				message: custom ? 'Delete ' + BattleLog.escapeHTML(name) + ' from this dex?' : 'Undo every edit to ' + BattleLog.escapeHTML(name) + ' in this dex?',
				button: custom ? "Delete" : "Undo edits",
				sourceEl: button,
				callback: function () { self.editDex({ deletepokemon: name }); }
			});
		},
		saveDexFormat: function (fields) {
			var details = this.dexFormatDetails;
			this.editDex({ format: $.extend({ id: details.id, name: details.name }, fields) });
		},
		renameDexFormat: function (e) {
			var name = $.trim(e.currentTarget.value);
			if (name && name !== this.dexFormatDetails.name) this.saveDexFormat({ name: name });
		},
		toggleDexRule: function (ruleid) {
			var details = this.dexFormatDetails;
			var rule = this.dexFormatTree.byId[ruleid];
			var ruleset = details.ruleset.slice();
			var index = ruleset.findIndex(function (spec) { return !spec.includes('=') && toID(spec.replace(/^[!^]/, '')) === ruleid; });
			if (index >= 0) {
				ruleset.splice(index, 1);
			} else {
				ruleset.push((details.rules.includes(ruleid) ? '!' : '') + rule.name);
			}
			this.saveDexFormat({ ruleset: ruleset });
		},
		toggleDexBan: function (name, button, banned) {
			var details = this.dexFormatDetails;
			var id = toID(name);
			var banlist = details.banlist.slice();
			var unbanlist = details.unbanlist.slice();
			var matches = function (spec) { return toID(spec) === id; };
			if (banlist.some(matches)) {
				banlist = banlist.filter(function (spec) { return !matches(spec); });
			} else if (unbanlist.some(matches)) {
				unbanlist = unbanlist.filter(function (spec) { return !matches(spec); });
			} else {
				if (banned === undefined) banned = !!$(button).hasClass('ruleoff');
				(banned ? unbanlist : banlist).push(name);
			}
			this.saveDexFormat({ banlist: banlist, unbanlist: unbanlist });
		},
		clickDexFormatEntry: function (e) {
			e.preventDefault();
			var entry = e.currentTarget.dataset.entry.split('|');
			if (['pokemon', 'move', 'ability', 'item'].includes(entry[0])) {
				var table = { pokemon: 'species', move: 'moves', ability: 'abilities', item: 'items' }[entry[0]];
				var name = this.dexView.dex[table].get(entry[1]).name;
				this.toggleDexBan(name, null, this.dexFormatDetails.banned[entry[0]].includes(entry[1]));
				return;
			}
			if (!this.dexFormatSearch.addFilter(e.currentTarget)) return;
			this.$('input[name=formatsearch]').val('');
			this.dexFormatSearch.find('');
		},
		newDexFormat: function (value, button) {
			app.addPopup(DexNewFormatPopup, { room: this, sourceEl: button });
		},
		deleteDexFormat: function (value, button) {
			var self = this;
			var details = this.dexFormatDetails;
			app.addPopup(DexConfirmPopup, {
				message: 'Delete the format ' + BattleLog.escapeFormat(details.id) + '?',
				button: "Delete format",
				sourceEl: button,
				callback: function () { self.editDex({ deleteformat: details.id }); }
			});
		},
		openDexSettings: function (value, target) {
			app.addPopup(DexSettingsPopup, { room: this, sourceEl: target });
		},
		dexHeadingHTML: function () {
			var summary = this.curSummary;
			var state = this.saveState === 'saving' ? '<i class="fa fa-refresh"></i> Saving...' :
				this.saveState === 'failed' ? '<i class="fa fa-exclamation-triangle"></i> Not saved' :
				this.saveState === 'saved' ? '<i class="fa fa-check"></i> Saved' : '';
			return (summary.official ? OFFICIAL_BADGE : '') + '<i class="fa fa-folder-open"></i> ' + BattleLog.escapeHTML(summary.name) +
				PICKER_CARET + (state ? ' <small class="dexsavestate">' + state + '</small>' : '');
		},
		setSaveState: function (state) {
			this.saveState = state;
			if (this.curSummary) this.$('.dexheading').html(this.dexHeadingHTML());
		},
		selectFolder: function (e) {
			var value = e.currentTarget.dataset.value || e.currentTarget.value;
			if (value === '+') {
				this.newDex(e.currentTarget);
				this.$('select[name=dexpicker]').val(this.curFolder);
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
		}
	});
	_.defaults(window.DexBuilderRoom.prototype, view);

})(window.jQuery);
