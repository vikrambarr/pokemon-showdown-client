(function ($) {

	var DEX_SLOTS = 3;

	var DexViews = window.DexViews;
	var DexConfirmPopup = DexViews.ui.DexConfirmPopup;
	var OFFICIAL_BADGE = DexViews.ui.OFFICIAL_BADGE;
	var PICKER_CARET = ' <i class="fa fa-caret-down dexpickercaret"></i>';
	var TAB_ICONS = { Pokedex: 'paw', Moves: 'bolt', Abilities: 'star', Items: 'shopping-bag', Conditions: 'cloud', TypeChart: 'th' };
	var SINGLES_TIERS = ['AG', 'Uber', '(Uber)', 'OU', '(OU)', 'UUBL', 'UU', 'RUBL', 'RU', 'NUBL', 'NU', '(NU)', 'PUBL', 'PU', '(PU)', 'ZUBL', 'ZU', 'NFE', 'LC', 'Illegal', 'Unreleased'];
	var DOUBLES_TIERS = ['DUber', '(DUber)', 'DOU', 'DBL', '(DOU)', 'DUU', '(DUU)', 'NFE', 'LC', 'Illegal', 'Unreleased'];
	var TIER_STYLES = [['singles', "Singles", 'tier'], ['natdex', "National Dex", 'natDexTier'], ['doubles', "Doubles", 'doublesTier'], ['vgc', "VGC", '']];
	var EFFECT_KINDS = DexViews.ui.EFFECT_KINDS;
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

	var DexNamePopup = Popup.extend({
		type: 'semimodal',
		initialize: function (data) {
			this.callback = data.callback;
			this.$el.html('<form class="dexcreate"><p><label class="label">Name:<br /><input type="text" class="textbox autofocus" name="name" maxlength="40" /></label></p>' + (data.fields || '') +
				'<p class="buttonbar"><button type="submit" class="button"><strong>Create</strong></button> <button type="button" name="close" class="button">Cancel</button></p></form>');
		},
		submit: function (data) {
			var name = $.trim(data.name);
			if (!name) return;
			this.close();
			this.callback(name, data);
		}
	});

	DexViews.ui.DexNamePopup = DexNamePopup;

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
			buf += '<p><label class="label">Description:<br /><textarea class="textbox" name="description" rows="4" maxlength="512"' + (this.room.dexEditable ? '' : ' disabled') + '>' +
				BattleLog.escapeHTML(summary.description || '') + '</textarea></label></p></form>';
			buf += '<p><small>' + summary.counts.map(function (count) {
				return '<strong>' + count.name + ':</strong> ' + count.total + ' total, ' + count.custom + ' custom, ' + count.modified + ' modified';
			}).join('<br />') + '</small></p>';
			buf += '<p class="dexdatasize">' + this.dataSizeHTML() + '</p>';
			buf += '<p><button class="button" name="worldDex"><i class="fa fa-globe"></i> Use as world</button></p>';
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
			this.$('.dexdatasize').html(this.dataSizeHTML());
		},
		dataSizeHTML: function () {
			var summary = this.room.curSummary;
			var storage = this.room.dexStorage;
			if (summary.official || !storage) return '';
			return '<small>Battle data: ' + Math.ceil(summary.size / 1024) + ' KB of ' + Math.round(storage.data / 1024) + ' KB</small>';
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
		worldDex: function (value, button) {
			this.close();
			this.room.worldDex(value, this.sourceEl);
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

	function mergeFields(target, fields) {
		for (var key in fields) target[key] = key === 'learnset' ? $.extend({}, target.learnset, fields.learnset) : fields[key];
		return target;
	}

	function listValue(text) {
		return text.split(',').map(function (part) { return $.trim(part); }).filter(Boolean);
	}

	function megabytes(bytes) {
		return bytes < 1024 * 1024 ? Math.ceil(bytes / 1024) + ' KB' : (bytes / 1024 / 1024).toFixed(1).replace(/\.0$/, '') + ' MB';
	}

	function storageHTML(storage, bare) {
		return storage ? (bare ? '' : 'Your storage: ') + megabytes(storage.used) + ' of ' + megabytes(storage.limit) : '';
	}

	function shrinkSprite(file, kind) {
		var box = kind.slice(0, 4) === 'icon' ? { max: 64, width: 40, height: 30 } : { max: 192, width: 96, height: 96 };
		return new Promise(function (resolve) {
			var image = new Image();
			var url = URL.createObjectURL(file);
			image.onerror = function () {
				URL.revokeObjectURL(url);
				resolve(file);
			};
			image.onload = function () {
				URL.revokeObjectURL(url);
				if (image.naturalWidth <= box.max && image.naturalHeight <= box.max) return resolve(file);
				var scale = Math.min(box.width / image.naturalWidth, box.height / image.naturalHeight);
				var canvas = document.createElement('canvas');
				canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
				canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
				var context = canvas.getContext('2d');
				context.imageSmoothingEnabled = false;
				context.drawImage(image, 0, 0, canvas.width, canvas.height);
				canvas.toBlob(function (blob) { resolve(blob || file); }, 'image/png');
			};
			image.src = url;
		});
	}

	var DexSpritePopup = Popup.extend({
		initialize: function (data) {
			this.room = data.room;
			this.kind = data.kind;
			var room = this.room;
			var uploadid = (room.dexView.sprites[room.dexSpecies.id] || {})[data.kind];
			var image = uploadid && room.dexView.images[uploadid];
			var standard = !image && room.dexStandardSprite(data.kind);
			var buf = '<form><p><strong>' + SPRITE_KINDS[data.kind] + ' sprite</strong></p>';
			if (image) {
				buf += '<p><img src="' + Dex.resourcePrefix + 'sprites/custom/' + BattleLog.escapeHTML(image.file) + '" width="' + image.width * 2 + '" height="' + image.height * 2 + '" alt=""' +
					(image.pixelated ? ' class="pixelated"' : '') + ' /></p><p><small>' + image.width + '&times;' + image.height +
					(image.artist ? ', by ' + BattleLog.escapeHTML(image.artist) : '') + '</small></p>';
			} else if (standard) {
				buf += '<p>' + standard.html + '</p><p><small>Standard sprite (' + standard.size + ')</small></p>';
			} else {
				buf += '<p><em>No sprite.</em></p>';
			}
			if (!room.dexEditable) {
				this.$el.html(buf + '<p class="buttonbar"><button type="button" name="close" class="button">Close</button></p></form>');
				return;
			}
			buf += '<p><input type="file" name="file" accept="image/png,image/gif" /></p>';
			buf += '<p><small>' + (room.dexSummary.official ? 'Official dex: any size' : data.kind.slice(0, 4) === 'icon' ? 'Best at 40&times;30. Bigger than 64&times;64 is shrunk to 40&times;30' :
				'Best at 96&times;96. Bigger than 192&times;192 is shrunk to 96&times;96') + '. Pixel art only.</small></p>';
			if (!room.dexSummary.official && room.dexStorage) buf += '<p><small>' + storageHTML(room.dexStorage) + '</small></p>';
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
			var kind = this.kind;
			this.close();
			room.setSaveState('saving');
			(room.dexSummary.official ? Promise.resolve(file) : shrinkSprite(file, kind)).then(function (shrunk) {
				file = shrunk;
				return DexViews.ui.request('dexupload', room.dexid + ', ' + name + ', ' + kind);
			}).then(function (data) {
				return new Promise(function (resolve) {
					$.ajax({ url: data.url, method: 'POST', data: file, processData: false, contentType: file.type, dataType: 'json' }).done(resolve).fail(function (xhr) {
						resolve(xhr.responseJSON || { error: "The upload didn't work." });
					});
				});
			}).then(function (result) {
				room.setSaveState(result.error ? 'failed' : 'saved');
				if (result.error) app.addPopup(Popup, { message: result.error });
				room.dexStorageKey = null;
				app.send('/crq dexes');
			}, function (err) {
				room.setSaveState('failed');
				app.addPopup(Popup, { message: err.message });
			});
		},
		clearSprite: function () {
			this.close();
			this.room.dexStorageKey = null;
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
				typedSearch.tierOverrides = room.tierBaseOverrides;
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

	var DexUnsavedPopup = Popup.extend({
		type: 'semimodal',
		initialize: function (data) {
			this.room = data.room;
			this.callback = data.callback;
			this.$el.html('<p>' + BattleLog.escapeHTML(data.name) + ' has unsaved changes.</p>' +
				'<p class="buttonbar"><button type="button" class="button" name="saveChanges"><strong>Save</strong></button> ' +
				'<button type="button" class="button" name="discardChanges">Discard</button> <button type="button" name="close" class="button">Cancel</button></p>');
		},
		saveChanges: function () {
			this.close();
			this.room.dexQuitting = this.callback;
			if (!this.room.saveDexDraft()) this.room.dexQuitting = null;
		},
		discardChanges: function () {
			this.close();
			this.room.dexDraft = null;
			this.room.applyDexDraft();
			this.callback();
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
			'click .dextabempty a[data-entry]': 'clickDexEntry',
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
			'change .dexmonpage select[name=dextype]': 'changeDexType',
			'change .dexmonpage [data-detail] input, .dexmonpage [data-detail] select': 'changeDexDetail',
			'click .dexmonpage .dexchipbox': 'focusDexChips',
			'dragstart .dexmonpage .dexabilitybox .dexchip': 'dragDexAbility',
			'dragover .dexmonpage .dexabilitybox': 'dragOverDexAbility',
			'drop .dexmonpage .dexabilitybox': 'dropDexAbility',
			'change input[name=formatname]': 'renameDexFormat'
		},
		initialize: function () {
			this.$el.addClass('ps-room-light').addClass('scrollable');
			this.curFolder = '';
			this.update();
		},
		focus: function (e) {
			if (!e) app.send('/crq dexes');
		},
		viewDex: function (dexid) {
			this.leaveDex(null, function () {
				this.viewDexId = dexid;
				this.curFolder = dexid;
				this.update();
			});
		},
		viewedSummary: function () {
			var self = this;
			var dexid = this.viewDexId;
			if (!dexid) return null;
			var summary = DexViews.list.filter(function (dex) { return dex.id === dexid; })[0];
			if (summary) return summary;
			if (this.viewQuery && this.viewQuery.id === dexid) return this.viewQuery;
			if (!DexViews.list.length || this.viewQuerying === dexid) return null;
			this.viewQuerying = dexid;
			DexViews.query(dexid).then(function (data) {
				if (self.viewDexId !== dexid) return;
				self.viewQuery = data;
				self.update();
			}, function () {
				if (self.viewDexId !== dexid) return;
				self.viewDexId = '';
				if (self.curFolder === dexid) self.curFolder = '';
				self.update();
				app.addPopup(Popup, { message: "There's no dex called \"" + dexid + "\"." });
			});
			return null;
		},
		loadDexStorage: function () {
			var room = this;
			if (!app.user.get('registered')) return;
			DexViews.ui.request('dexstorage', '').then(function (storage) {
				room.dexStorage = storage;
				room.$('.dexstorage').text(storageHTML(storage, true));
				if (room.settingsPopup) room.settingsPopup.sync();
			}, function () {});
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
			var viewed = this.viewedSummary();
			if (viewed && dexes.indexOf(viewed) >= 0) viewed = null;
			var all = slots.concat(shared, official, viewed ? [viewed] : []);
			var folders = all.map(function (summary) { return summary.id; });
			if (folders.indexOf(this.curFolder) < 0 && this.curFolder !== this.viewDexId) this.curFolder = folders[0] || '';
			this.free = Math.max(0, DEX_SLOTS - slots.length);
			this.updateFolderList(slots, shared, official, viewed);
			var storageKey = JSON.stringify([userid, slots.concat(shared).map(function (summary) { return summary.id; })]);
			if (storageKey !== this.dexStorageKey) {
				this.dexStorageKey = storageKey;
				this.loadDexStorage();
			}
			var summary = all[folders.indexOf(this.curFolder)];
			var key = JSON.stringify([userid, summary, this.free]);
			this.dexOptions = this.dexOptionsHTML(slots, shared, official, viewed);
			this.$('select[name=dexpicker]').html(this.dexOptions);
			if (key === this.teamListKey) return this.settleDexSave();
			this.teamListKey = key;
			this.updateTeamList(summary);
		},
		dexPickerHTML: function (heading) {
			return '<div class="dexpicker">' + heading + '<select name="dexpicker">' + this.dexOptions + '</select></div>';
		},
		updateFolderList: function (slots, shared, official, viewed) {
			var buf = '<div class="folderlist"><div class="folderlistbefore"></div>';
			if (viewed) buf += '<div class="folder"><h3>Viewing</h3></div>' + this.folderHTML(viewed) + '<div class="foldersep"></div>';
			buf += '<div class="folder"><h3>Dexes</h3></div>';
			for (var i = 0; i < slots.length; i++) buf += this.folderHTML(slots[i]);
			buf += '<div class="folder"><div class="selectFolder" data-value="+"><i class="fa fa-plus"></i><em>(new dex)</em></div></div>';
			buf += '<div class="foldersep"></div><div class="folder"><h3>Storage</h3><small class="dexstorage">' + storageHTML(this.dexStorage, true) + '</small></div>';
			if (shared.length) buf += '<div class="foldersep"></div><div class="folder"><h3>Shared with you</h3></div>';
			for (var i = 0; i < shared.length; i++) buf += this.folderHTML(shared[i]);
			if (official.length) buf += '<div class="foldersep"></div><div class="folder"><h3>Official</h3></div>';
			for (var i = 0; i < official.length; i++) buf += this.folderHTML(official[i]);
			buf += '<div class="folderlistafter"></div></div>';
			this.$('.folderpane').html(buf);
		},
		dexOptionsHTML: function (slots, shared, official, viewed) {
			var self = this;
			var options = function (label, list, extra) {
				if (!list.length && !extra) return '';
				return '<optgroup label="' + label + '">' + list.map(function (summary) {
					return '<option value="' + BattleLog.escapeHTML(summary.id) + '"' + (self.curFolder === summary.id ? ' selected' : '') + '>' + BattleLog.escapeHTML(summary.name) + '</option>';
				}).join('') + (extra || '') + '</optgroup>';
			};
			return (this.curFolder ? '' : '<option value="" selected disabled>(choose a dex)</option>') + options("Viewing", viewed ? [viewed] : []) +
				options("Dexes", slots, '<option value="+">(new dex)</option>') + options("Shared with you", shared) + options("Official", official);
		},
		folderHTML: function (summary) {
			var cur = this.curFolder === summary.id;
			return '<div class="folder' + (cur ? ' cur"><div class="folderhack3"><div class="folderhack1"></div><div class="folderhack2"></div>' : '">') +
				'<div class="selectFolder" data-value="' + BattleLog.escapeHTML(summary.id) + '"><i class="fa ' + (cur ? 'fa-folder-open' : 'fa-folder') + '"></i>' +
				BattleLog.escapeHTML(summary.name) + '</div></div>' + (cur ? '</div>' : '');
		},
		updateTeamList: function (summary) {
			var editable = !!summary && DexViews.ui.canEdit(summary);
			var sameDex = summary && this.curSummary && this.curSummary.id === summary.id && this.dexEditable === editable && this.$('.dexheading').length;
			this.curSummary = summary;
			if (!sameDex) this.resetDexDraft();
			if (!summary) {
				this.$el.removeClass('dexsubpage');
				if (this.settingsPopup) this.settingsPopup.dismiss();
				var buf = this.dexPickerHTML('<h2><i class="fa fa-folder-open-o"></i> Dexes' + PICKER_CARET + '</h2>');
				buf += '<ul class="teamlist"><li><p><em>' + (this.curFolder ? 'Loading...' : app.user.get('named') ? 'you don\'t have any dexes lol' : 'log in to make dexes') + '</em></p></li></ul>';
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
				else this.settleDexSave();
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
			this.dexEffect = null;
			this.dexFormat = '';
			this.dexFormatId = '';
			this.dexEditable = editable;
			var buf = '<button class="button dexmenu" name="openDexSettings" title="' + (editable ? 'Dex settings' : 'Dex info') + '"><i class="fa fa-ellipsis-h"></i></button>';
			buf += this.dexPickerHTML('<h2 class="dexheading">' + this.dexHeadingHTML() + '</h2>');
			buf += '<div class="dexpage"><div class="dexbuildertabs"></div><div class="dexbuildersub" style="display:none">' +
				'<p><button class="button" name="closeDexTab"><i class="fa fa-chevron-left"></i> Dex</button> <strong class="dexsubtitle"></strong></p>' +
				'<p class="dexpokemonsearch"><input type="search" class="textbox" name="pokemonsearch" placeholder="Search Pok&eacute;mon" size="30" autocomplete="off" />' +
				' <button class="button" name="newDexPokemon"><i class="fa fa-plus"></i> New Pok&eacute;mon</button>' +
				'<button class="button" name="newDexEffect"><i class="fa fa-plus"></i> <span></span></button></p>' +
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
			this.dexLoading = true;
			DexViews.load(summary).then(function (loadedView) {
				if (self.dexid !== summary.id || self.dexSummary !== summary) return;
				self.dexLoading = false;
				self.renderBuilderDex(summary, loadedView);
			}, function (err) {
				self.dexLoading = false;
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
			var sameView = this.dexBaseView === loadedView && this.dexSearch;
			this.settleDexSave();
			this.dexBaseView = loadedView;
			this.applyDexDraft();
			var dexView = this.dexView;
			var formats = summary.formats.map(function (format) { return format.id; });
			var oldFormat = this.dexFormat;
			if (!formats.includes(this.dexFormat)) this.dexFormat = formats[0] || '';
			if (sameView) {
				if (this.dexTab === 'formats') this.refreshDexFormat(oldFormat !== this.dexFormat);
				if (this.dexTab === 'tiers') this.renderDexTiers();
				return;
			}
			var panel = this.dexPanel;
			this.dexFormatId = '';
			this.dexFormatSearch = null;
			this.setupDexSearch(dexView);
			var pending = this.pendingSpecies;
			this.pendingSpecies = null;
			var species = this.dexSpecies;
			var pendingEffect = this.pendingEffect;
			this.pendingEffect = null;
			if (pending && dexView.species[toID(pending)]) {
				this.openDexPokemon(pending);
			} else if (pendingEffect) {
				this.openDexEffect(pendingEffect[0], pendingEffect[1]);
			} else if (this.dexEffect) {
				this.openDexEffect(this.dexEffect.table, this.dexEffect.id, this.dexEffect.from, true);
			} else if (species) {
				if (dexView.species[species.id]) {
					this.reopenDexPokemon(species.name, panel);
				} else {
					this.closeDexPokemon();
				}
			}
		},
		closeDexTab: function (value, button) {
			if (button) return this.leaveDex(button, function () { this.closeDexTab(); });
			this.showDexTab('');
			this.dexScroller().scrollTop(0);
		},
		renderDexTiers: function () {
			var self = this;
			var formatid = this.tierFormat;
			if (!this.dexSummary.formats.some(function (format) { return format.id === formatid; })) formatid = this.tierFormat = '';
			this.tierSelected = this.tierSelected || {};
			if (!formatid) return this.renderDexTierPage(null);
			DexViews.ui.request('dexformat', this.dexFormatTarget(formatid)).then(function (details) {
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
			var formatid = details ? details.id : '';
			var base = {};
			var own = $.extend(true, {}, details ? details.tiers : {});
			$.each(this.dexTierOps(), function (i, op) {
				if (op.reset) {
					if (op.format === formatid) own = {};
					return;
				}
				var target = !op.format ? base : op.format === formatid ? own : null;
				if (!target) return;
				$.each(op.species, function (j, name) {
					var entry = target[toID(name)] || (target[toID(name)] = {});
					if (op.tier) entry[op.field] = op.tier;
					else delete entry[op.field];
				});
			});
			var overrides = $.extend(true, {}, base, own);
			var overridden = Object.keys(own).some(function (id) { return !$.isEmptyObject(own[id]); });
			this.tierBaseOverrides = base;
			this.tierDetails = details;
			this.tierActiveStyle = style;
			var buf = '<p><label class="label">Format:</label><button class="select formatselect" name="selectTierFormat" value="' + BattleLog.escapeHTML(this.tierFormat || '') + '">' +
				(this.tierFormat ? BattleLog.escapeFormat(this.tierFormat) : '(All formats)') + '</button>' + (this.dexEditable ? this.dexSaveHTML('button dexsave') : '') + '</p>';
			if (details) {
				buf += '<p><small>' + BattleLog.escapeFormat(details.id) + ' uses <strong>' + info[1] + '</strong> tiers. Changes here only affect this format.</small>' +
					(this.dexEditable && info[2] && overridden ? ' <button class="button" name="resetDexTiers">Reset to All formats</button>' : '') + '</p>';
			} else {
				buf += '<p><label class="label">Tiers: <select name="tierstyle" class="button">' + TIER_STYLES.map(function (entry) {
					return '<option value="' + entry[0] + '"' + (entry[0] === style ? ' selected' : '') + '>' + entry[1] + '</option>';
				}).join('') + '</select></label></p>';
			}
			buf += '<p class="dextierbar"><input type="search" class="textbox" name="tiersearch" placeholder="Search Pok&eacute;mon" size="24" autocomplete="off" />';
			if (this.dexEditable && info[2]) {
				buf += ' <span class="dextierselection"></span>';
			} else if (this.dexEditable) {
				buf += ' <small>VGC groups come from each Pok&eacute;mon\'s tags, so they can\'t be changed here.</small>';
			}
			buf += '</p><div class="teambuilder-results dextierlist"></div>';
			this.$('.dextierpage').html(buf);
			var $list = this.$('.dextierlist');
			var search = this.tierSearch = this.createDexList($list, 'dexListZoom');
			this.scaleDex();
			DexViews.ui.rowClasses(search, function (id, type) {
				var speciesid = toID(id);
				return type !== 'pokemon' ? '' : (own[speciesid] && own[speciesid][info[2]] ? ' dextieroverride' : '') + (room.tierSelected[speciesid] ? ' cur' : '');
			});
			DexViews.ui.viewSearch(search, this.dexView, function (typedSearch) {
				typedSearch.isNatDex = style === 'natdex';
				typedSearch.isDoubles = style === 'doubles' || style === 'vgc';
				typedSearch.isVGC = style === 'vgc';
				typedSearch.tierOverrides = overrides;
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
			if (!this.dexEditable || this.tierActiveStyle === 'vgc') return;
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
			this.draftDex('tiers', '', { format: this.tierFormat || undefined, field: field, species: names, tier: tier });
			this.renderDexTierPage(this.tierDetails);
		},
		resetDexTiers: function (value, button) {
			var self = this;
			app.addPopup(DexConfirmPopup, {
				message: 'Put every Pok&eacute;mon in ' + BattleLog.escapeFormat(this.tierFormat) + ' back on its All formats tier?',
				button: "Reset tiers",
				sourceEl: button,
				callback: function () {
					self.draftDex('tiers', '', { format: self.tierFormat, field: 'tier', reset: true });
					self.renderDexTierPage(self.tierDetails);
				}
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
			DexViews.ui.request('dexformat', this.dexFormatTarget(formatid)).then(function (details) {
				if (self.dexFormat === formatid && self.dexTab === 'formats') self.showDexFormatDetails(details);
			});
		},
		showDexFormatDetails: function (details) {
			var scroller = this.dexScroller();
			var top = scroller.scrollTop();
			var query = this.$('input[name=formatsearch]').val();
			this.renderDexFormat(details);
			if (query) this.$('input[name=formatsearch]').val(query).trigger('input');
			scroller.scrollTop(top);
		},
		dexScroller: function () {
			return this.$('.teampane');
		},
		show: function () {
			Room.prototype.show.apply(this, arguments);
			this.scaleDex();
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
			this.scaleDex();
			if (tiers) {
				this.dexTab = 'tiers';
				this.$('.dexpokemonsearch, .dexpokemon, .dextabempty, .dexformatpage').hide();
				this.$('.dexsubtitle').text("Tiers");
				this.renderDexTiers();
				return;
			}
			this.dexTab = tab = String(tab || 0);
			var count = this.dexSummary.counts[tab];
			var kind = count && { Pokedex: 'pokemon', Moves: 'move', Abilities: 'ability', Items: 'item' }[count.table];
			var pokemon = !!kind;
			var formats = tab === 'formats';
			var conditions = !!count && count.table === 'Conditions';
			var buf = pokemon || formats ? '' : conditions ? '<div class="dexconditionlist"></div>' : this.renderDexTypes();
			this.$('.dexpage button[name=showDexTab]').removeClass('cur').filter('[value="' + tab + '"]').addClass('cur');
			if (count && count.table !== 'Pokedex') DexViews.loadEntries(this.dexid);
			if (this.dexTabSearch && this.dexTabSearch !== this.dexSearch) this.$('input[name=pokemonsearch]').val('');
			if (kind || conditions) this.$('input[name=pokemonsearch]').attr('placeholder', 'Search ' + BattleLog.unescapeHTML(count.name));
			if (kind && this.dexSearch.engine.typedSearch.searchType !== kind) {
				this.$('input[name=pokemonsearch]').val('');
				this.dexSearch.setType(kind, 'gen' + this.dexView.gen);
			}
			this.$('.dexpokemonsearch').toggle(pokemon || conditions);
			this.$('.dexpokemon').toggle(pokemon);
			this.$('.dextabempty').toggle(!!buf).html(buf);
			this.dexTabSearch = this.dexSearch;
			if (conditions) {
				this.$('input[name=pokemonsearch]').val('');
				if (this.dexSearch.q) this.dexSearch.find('');
				this.dexTabSearch = this.createDexList(this.$('.dexconditionlist'), 'dexListZoom');
				this.setupDexConditionList(this.dexTabSearch);
			}
			this.$('.dexformatpage').toggle(formats);
			if (pokemon) this.dexSearch.updateScroll();
			if (formats && this.dexFormatId !== this.dexFormat) this.openDexFormat(this.dexFormat);
			if (formats && this.dexFormatSearch) this.dexFormatSearch.updateScroll();
			this.$('.dexsubtitle').text(this.$('.dexbuildertab[value="' + this.dexTab + '"]').contents().filter(function () { return this.nodeType === 3; }).text());
			var table = this.dexSummary.counts[this.dexTab] && this.dexSummary.counts[this.dexTab].table;
			this.$('button[name=newDexPokemon]').toggle(this.dexEditable && table === 'Pokedex');
			this.$('button[name=newDexEffect]').toggle(this.dexEditable && !!EFFECT_KINDS[table]).find('span').text('New ' + EFFECT_KINDS[table]);
			if (this.dexTab !== 'formats' || this.dexFormat) return;
			this.$('.dexformatpage').html('<div class="pad"><p><em>This dex has no formats yet.</em></p>' +
				(this.dexEditable ? '<p><button class="button" name="newDexFormat"><i class="fa fa-plus"></i> New format</button></p>' : '') + '</div>');
		},
		dexScrollerWidth: function () {
			var $scroller = this.dexScroller();
			return $scroller.length && $scroller[0].clientWidth - parseFloat($scroller.css('padding-left')) - parseFloat($scroller.css('padding-right'));
		},
		setupDexSearch: function (view) {
			this.dexSearchView = view;
			var dexid = this.dexid;
			var search = this.dexSearch = this.createDexList(this.$('.dexpokemon'), 'dexListZoom');
			DexViews.ui.viewSearch(search, view, DexViews.ui.dexEntryResults(dexid));
			this.scaleDex();
			search.setType('pokemon', 'gen' + view.gen);
			this.showDexTab(this.dexTab);
		},
		renderDexTypes: function () {
			DexViews.current = this.dexView;
			var dex = this.dexView.dex;
			var names = dex.types.names().filter(function (name) { return dex.types.get(name).exists !== false; });
			var buf = '<p><small>Rows are the attacking type, columns are the defending type.</small></p>';
			buf += '<div class="ladder dextypechart"><table><tr><th></th>';
			for (var i = 0; i < names.length; i++) buf += '<th title="' + BattleLog.escapeHTML(names[i]) + '">' + Dex.getTypeIcon(names[i]) + '</th>';
			buf += '</tr>';
			for (var i = 0; i < names.length; i++) {
				buf += '<tr><th title="' + BattleLog.escapeHTML(names[i]) + '">' + Dex.getTypeIcon(names[i]) + '</th>';
				for (var j = 0; j < names.length; j++) {
					var taken = (dex.types.get(names[j]).damageTaken || {})[names[i]] || 0;
					buf += '<td class="' + ['', 'super', 'resist', 'immune'][taken] + '">' + ['', '2', '&frac12;', '0'][taken] + '</td>';
				}
				buf += '</tr>';
			}
			return buf + '</table></div>';
		},
		scaleDex: function () {
			var monWidth = this.$('.dexmonpage').width();
			if (monWidth) this.$('.dexmonpage .teamwrapper').css('transform', monWidth < 640 ? 'scale(' + monWidth / 640 + ')' : 'none').toggleClass('scaled', monWidth < 640);
			var width = this.dexScrollerWidth();
			if (!width) return;
			var bleed = parseFloat(this.dexScroller().css('padding-left'));
			this.dexListZoom = width < 640 ? (width + bleed) / 640 : 1;
			this.dexFormatZoom = width < 670 ? (width + bleed) / 670 : 1;
			var observer = this.dexScaleObserver || (this.dexScaleObserver = new ResizeObserver(function (entries) {
				for (var i = 0; i < entries.length; i++) {
					var el = entries[i].target;
					el.style.marginBottom = el.dexZoom === 1 ? '' : -el.offsetHeight * (1 - el.dexZoom) + 'px';
				}
			}));
			var scale = function ($box, zoom, boxWidth) {
				$box.each(function () {
					this.dexZoom = zoom;
					observer.observe(this);
				}).css({
					transform: zoom === 1 ? '' : 'scale(' + zoom + ')',
					width: zoom === 1 ? '' : boxWidth + 'px',
					marginLeft: zoom === 1 ? '' : -bleed + 'px',
					marginRight: zoom === 1 ? '' : -boxWidth * (1 - zoom) + 'px'
				}).each(function () {
					this.style.marginBottom = zoom === 1 ? '' : -this.offsetHeight * (1 - zoom) + 'px';
				});
			};
			scale(this.$('.dexpokemon, .dextierlist'), this.dexListZoom, 640);
			scale(this.$('.dexformatwrapper'), this.dexFormatZoom, 670);
			this.updateDexScroll();
		},
		createDexList: function ($list, zoom) {
			var room = this;
			var search = new BattleSearch($list, this.dexScroller());
			search.$viewport = {
				scrollTop: function () {
					return room.dexScroller()[0].scrollTop / (room[zoom] || 1);
				},
				height: function () {
					return room.dexScroller()[0].clientHeight / (room[zoom] || 1);
				}
			};
			this.dexLists = (this.dexLists || []).filter(function (other) {
				return other.el !== search.el && $.contains(document.documentElement, other.el);
			});
			this.dexLists.push(search);
			return search;
		},
		updateDexScroll: function () {
			$.each(this.dexLists || [], function (i, search) {
				if ($(search.el).is(':visible')) search.updateScroll();
			});
		},
		searchPokemon: function (e) {
			(this.dexTabSearch || this.dexSearch).find(e.currentTarget.value);
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
			var table = DexViews.ui.ENTRY_TABLES[entry[0]];
			if (table) {
				this.openDexEffect(table, entry[1]);
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
		removeDexAbility: function (name) {
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
			var entries = this.dexAbilitySlots();
			var names = entries.map(function (entry) { return entry[1]; });
			names.splice(to, 0, names.splice(from, 1)[0]);
			this.setDexAbilities(entries.map(function (entry, j) { return [entry[0], names[j]]; }));
		},
		removeDexEvo: function (name) {
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
			var $input = field && this.$('.dexmonpage input[name="' + field + '"]');
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
				$input.val(dexView.dex.species.get(entry[1]).name);
			} else {
				if (search && search.addFilter(e.currentTarget)) search.find('');
				return;
			}
			this.saveDexField({ currentTarget: $input[0] });
			if (field === 'prevo') this.listDexRelatives('prevo');
		},
		saveDexField: function (e) {
			var name = e.currentTarget.name;
			if (name === 'evos' || name === 'abilities') return;
			var dex = this.dexView.dex;
			var $input = $(e.currentTarget).removeClass('incomplete');
			var value = $.trim($input.val());
			if (value && !dex.species.get(value).exists) {
				$input.addClass('incomplete');
				return;
			}
			this.saveDexPokemon({ prevo: value || null });
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
			var types = this.dexSpecies.types.slice();
			types[Number(e.currentTarget.dataset.index)] = e.currentTarget.value;
			this.saveDexPokemon({ types: types.filter(Boolean) }, true);
		},
		showDexDetailList: function () {
			this.dexDetailList = true;
			this.$('.dexmonpage [data-panel=details]').html(this.dexDetailsHTML());
		},
		addDexDetail: function (key) {
			this.dexAddedDetails[key] = true;
			this.dexDetailList = false;
			this.$('.dexmonpage [data-panel=details]').html(this.dexDetailsHTML());
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
			app.addPopup(DexSpritePopup, { room: this, kind: kind, sourceEl: button });
		},
		newDexPokemon: function (value, button) {
			var room = this;
			app.addPopup(DexNamePopup, {
				sourceEl: button,
				callback: function (name) {
					if (room.dexView.species[toID(name)]) return room.openDexPokemon(name);
					room.pendingSpecies = name;
					room.editDex({ pokemon: { name: name } });
				}
			});
		},
		deleteDexPokemon: function (name, button) {
			var self = this;
			var custom = DexViews.custom.Pokedex[toID(name)];
			var message = custom ? 'Delete ' + BattleLog.escapeHTML(name) + ' from this dex?' :
				'Reset ' + BattleLog.escapeHTML(name) + ' to its base data? Every edit to it in this dex is removed.';
			app.addPopup(DexConfirmPopup, {
				message: message,
				button: custom ? "Delete" : "Reset to base",
				sourceEl: button,
				callback: function () {
					if (self.dexDraft) delete self.dexDraft.pokemon[toID(name)];
					self.applyDexDraft();
					self.editDex({ deletepokemon: name });
				}
			});
		},
		saveDexFormat: function (fields, tweak) {
			var room = this;
			var details = this.dexFormatDetails;
			var formatid = details.id;
			var before = this.dexDraft && this.dexDraft.formats[formatid];
			if (before) before = $.extend({}, before);
			this.draftDex('formats', formatid, $.extend({ id: formatid, name: details.name }, fields));
			var local = $.extend($.extend(true, {}, details), fields);
			if (tweak) tweak(local);
			this.showDexFormatDetails(local);
			var target = this.dexFormatTarget(formatid);
			DexViews.ui.request('dexformat', target).then(function (preview) {
				if (room.dexFormatTarget(formatid) === target && room.dexFormat === formatid) room.showDexFormatDetails(preview);
			}, function (err) {
				if (room.dexFormatTarget(formatid) !== target) return;
				if (before) room.dexDraft.formats[formatid] = before;
				else delete room.dexDraft.formats[formatid];
				room.applyDexDraft();
				if (room.dexFormat === formatid) room.showDexFormatDetails(details);
				app.addPopup(Popup, { message: "That change doesn't work for the following reason:\n\n- " + err.message });
			});
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
			var on = index >= 0 ? ruleset[index].charAt(0) === '!' : !details.rules.includes(ruleid);
			if (index >= 0) {
				ruleset.splice(index, 1);
			} else {
				ruleset.push((details.rules.includes(ruleid) ? '!' : '') + rule.name);
			}
			this.saveDexFormat({ ruleset: ruleset }, function (local) {
				local.rules = local.rules.filter(function (other) { return other !== ruleid; }).concat(on ? [ruleid] : []);
			});
		},
		toggleDexBan: function (name, button, banned, kind) {
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
			var nowBanned = banlist.some(matches) || !unbanlist.some(matches) && !banned;
			this.saveDexFormat({ banlist: banlist, unbanlist: unbanlist }, function (local) {
				var state = nowBanned ? 'banned' : 'unbanned';
				for (var list in local.banned) {
					local.banned[list] = local.banned[list].filter(function (other) { return other !== id; });
				}
				if (nowBanned && kind) local.banned[kind].push(id);
				if (local.bans.tags[id] || local.tags.some(function (tag) { return tag.id === id; })) local.bans.tags[id] = { state: state };
				$.each(local.bans.other, function (i, other) {
					if (toID(other.name) === id) local.bans.other[i] = $.extend({}, other, { state: state, source: '' });
				});
			});
		},
		clickDexFormatEntry: function (e) {
			e.preventDefault();
			var entry = e.currentTarget.dataset.entry.split('|');
			if (['pokemon', 'move', 'ability', 'item'].includes(entry[0])) {
				if (!this.dexEditable) return;
				var name = this.dexView.dex[DexViews.ui.GETTERS[DexViews.ui.ENTRY_TABLES[entry[0]]]].get(entry[1]).name;
				this.toggleDexBan(name, null, this.dexFormatDetails.banned[entry[0]].includes(entry[1]), entry[0]);
				return;
			}
			if (!this.dexFormatSearch.addFilter(e.currentTarget)) return;
			this.$('input[name=formatsearch]').val('');
			this.dexFormatSearch.find('');
		},
		newDexFormat: function (value, button) {
			var room = this;
			var options = '';
			for (var id in BattleFormats) {
				var format = BattleFormats[id];
				if (format.dexid || format.team || !id.startsWith('gen')) continue;
				options += '<option value="' + id + '"' + (id === 'gen' + this.dexView.gen + 'ou' ? ' selected' : '') + '>' + BattleLog.escapeHTML(format.name) + '</option>';
			}
			app.addPopup(DexNamePopup, {
				fields: '<p><label class="label">Start from:<br /><select name="from" class="button">' + options + '</select></label></p>',
				sourceEl: button,
				callback: function (name, data) {
					room.editDex({ format: { name: name, from: data.from } });
				}
			});
		},
		deleteDexFormat: function (value, button) {
			var self = this;
			var details = this.dexFormatDetails;
			app.addPopup(DexConfirmPopup, {
				message: 'Delete the format ' + BattleLog.escapeFormat(details.id) + '?',
				button: "Delete format",
				sourceEl: button,
				callback: function () {
					if (self.dexDraft) delete self.dexDraft.formats[details.id];
					self.applyDexDraft();
					self.editDex({ deleteformat: details.id });
				}
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
			if (!this.dexEditable) state = '<i class="fa fa-eye"></i> View only';
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
			if (value === this.curFolder) return;
			this.$('select[name=dexpicker]').val(this.curFolder);
			this.leaveDex(e.currentTarget, function () {
				this.curFolder = value;
				this.update();
			});
		},
		leaveDex: function (sourceEl, callback) {
			if (!this.dexDraft) return callback.call(this);
			app.addPopup(DexUnsavedPopup, { room: this, name: this.curSummary.name, sourceEl: sourceEl, callback: callback.bind(this) });
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
			app.addPopup(DexNamePopup, {
				fields: '<p><label class="label">World:<br /><select name="base" class="button">' + baseOptions(null) + '</select></label></p>' +
					'<p><label class="label"><input type="checkbox" name="unlisted" /> Private (unlisted)</label></p>',
				sourceEl: sourceEl,
				callback: function (name, data) {
					app.send('/crq dexcreate ' + JSON.stringify({ name: name, base: data.base, visibility: data.unlisted ? 'private' : 'public' }));
				}
			});
		},
		draftDex: function (kind, key, fields) {
			var draft = this.dexDraft || (this.dexDraft = { pokemon: {}, tiers: [], formats: {}, effects: {} });
			if (kind === 'tiers') draft.tiers.push(fields);
			else if (kind === 'effects') draft.effects[key] = DexViews.mergeEffect(draft.effects[key] || {}, fields, true);
			else mergeFields(draft[kind][key] || (draft[kind][key] = {}), fields);
			this.applyDexDraft();
		},
		applyDexDraft: function () {
			var draft = this.dexDraft;
			if (draft && $.isEmptyObject(draft.pokemon) && !draft.tiers.length && $.isEmptyObject(draft.formats) && $.isEmptyObject(draft.effects)) this.dexDraft = null;
			var pokemon = {};
			var effects = {};
			$.each([this.dexSaving, this.dexDraft], function (i, layer) {
				if (!layer) return;
				for (var id in layer.pokemon) mergeFields(pokemon[id] || (pokemon[id] = {}), layer.pokemon[id]);
				for (var key in layer.effects) {
					var split = key.split(':');
					var table = effects[split[0]] || (effects[split[0]] = {});
					table[split[1]] = DexViews.mergeEffect(table[split[1]] || {}, layer.effects[key], true);
				}
			});
			var base = this.dexBaseView;
			if (base) this.dexView = DexViews.current = $.isEmptyObject(pokemon) && $.isEmptyObject(effects) ? base : DexViews.draft(base, pokemon, this.dexView, effects);
			this.updateDexDraftBar();
			if (this.dexSpecies || this.dexEffectData) this.markDexEdits();
		},
		dexTierOps: function () {
			return [].concat(this.dexSaving ? this.dexSaving.tiers : [], this.dexDraft ? this.dexDraft.tiers : []);
		},
		dexFormatTarget: function (formatid) {
			var fields = null;
			$.each([this.dexSaving, this.dexDraft], function (i, layer) {
				if (layer && layer.formats[formatid]) fields = $.extend(fields || {}, layer.formats[formatid]);
			});
			return fields ? formatid + ', ' + JSON.stringify(fields) : formatid;
		},
		updateDexDraftBar: function () {
			var draft = this.dexDraft;
			var count = draft ? Object.keys(draft.pokemon).length + draft.tiers.length + Object.keys(draft.formats).length + Object.keys(draft.effects).length : 0;
			this.$el.toggleClass('dexdrafting', !!(count || this.dexSaving));
			this.$('.dexsave').prop('disabled', !!this.dexSaving);
		},
		dexSaveHTML: function (className) {
			return ' <button name="saveDexDraft" class="' + className + '"' + (this.dexSaving ? ' disabled' : '') + '><i class="fa fa-floppy-o"></i>' +
				(className === 'dexsave' ? '' : ' ') + 'Save</button>';
		},
		refreshDexPage: function () {
			if (this.dexEffect) return this.renderDexEffect();
			if (this.dexSpecies) return this.reopenDexPokemon(this.dexSpecies.name, this.dexPanel);
			if (this.dexTab === 'tiers') return this.renderDexTierPage(this.tierDetails);
			if (this.dexTab === 'formats') return this.refreshDexFormat();
			if (!this.dexSearch || this.dexSearchView === this.dexView) return;
			var top = this.dexScroller().scrollTop();
			this.setupDexSearch(this.dexView);
			this.dexScroller().scrollTop(top);
		},
		saveDexDraft: function () {
			var draft = this.dexDraft;
			if (!draft || this.dexSaving) return false;
			var room = this;
			var problems = [];
			$.each(draft.pokemon, function (id, fields) {
				if (fields.abilities && $.isEmptyObject(fields.abilities)) problems.push(fields.name + ": A Pok\u00e9mon needs at least one ability.");
			});
			if (problems.length) {
				app.addPopup(Popup, {
					message: (problems.length === 1 ? "Your changes weren't saved for the following reason:" : "Your changes weren't saved for the following reasons:") +
						"\n\n- " + problems.join('\n- '),
					sourceEl: null
				});
				return false;
			}
			this.dexSaving = draft;
			this.dexDraft = null;
			$.each(draft.pokemon, function (id, fields) {
				room.editDex({ pokemon: fields }, fields.name, ['pokemon', id, fields]);
			});
			$.each(draft.tiers, function (i, op) {
				room.editDex({ tiers: op }, op.reset ? "Tiers" : op.species.join(', '), ['tiers', '', op]);
			});
			$.each(draft.formats, function (id, fields) {
				room.editDex({ format: fields }, fields.name, ['formats', id, fields]);
			});
			$.each(draft.effects, function (key, fields) {
				var edit = {};
				edit[EFFECT_KINDS[key.split(':')[0]]] = fields;
				room.editDex(edit, fields.name, ['effects', key, fields]);
			});
			this.updateDexDraftBar();
			return true;
		},
		resetDexDraft: function () {
			this.dexDraft = null;
			this.dexQuitting = null;
			this.dexSaving = null;
			this.dexSavingDone = false;
			this.dexBaseView = null;
			this.updateDexDraftBar();
		},
		settleDexSave: function () {
			if (!this.dexSavingDone || this.dexInFlight || this.dexLoading) return;
			this.dexSaving = null;
			this.dexSavingDone = false;
			this.applyDexDraft();
		},
		editDex: function (edit, label, restore) {
			this.dexEdits = this.dexEdits || [];
			this.dexEdits.push({ dexid: this.curSummary.id, edit: edit, label: label, restore: restore });
			if (!this.dexInFlight) this.nextDexEdit();
		},
		nextDexEdit: function () {
			var next = this.dexInFlight = this.dexEdits.shift() || null;
			if (!next) return;
			this.setSaveState('saving');
			app.send('/crq dexedit ' + next.dexid + ', ' + JSON.stringify(next.edit));
		},
		answerDexEdit: function (data) {
			var sent = this.dexInFlight;
			if (!sent) return false;
			var answers = this.dexAnswers || (this.dexAnswers = { dexid: sent.dexid, errors: [], failed: [], saved: false });
			if (data.error) {
				answers.errors.push((sent.label ? sent.label + ': ' : '') + data.error);
				if (sent.restore) answers.failed.push(sent.restore);
			} else {
				answers.saved = true;
			}
			if (data.stale) answers.stale = data.stale;
			if (sent.edit['delete'] && !data.error) this.curFolder = '';
			if (data.formatid) {
				delete DexViews.formatDetails[data.formatid];
				this.dexFormat = data.formatid;
			}
			this.nextDexEdit();
			if (this.dexInFlight) return true;
			this.dexAnswers = null;
			this.finishDexSave(answers);
			return true;
		},
		finishDexSave: function (answers) {
			var errors = answers.errors;
			var quit = this.dexQuitting;
			this.dexQuitting = null;
			this.setSaveState(errors.length ? 'failed' : 'saved');
			DexViews.ui.showSaveProblems(errors, answers.stale);
			if (answers.dexid !== this.dexid) return app.send('/crq dexes');
			if (answers.failed.length) {
				var later = this.dexDraft;
				this.dexDraft = null;
				var room = this;
				$.each(answers.failed, function (i, restore) {
					room.draftDex(restore[0], restore[1], restore[2]);
				});
				if (later) {
					var draft = this.dexDraft;
					draft.tiers = draft.tiers.concat(later.tiers);
					$.each(['pokemon', 'formats'], function (i, kind) {
						for (var key in later[kind]) mergeFields(draft[kind][key] || (draft[kind][key] = {}), later[kind][key]);
					});
					for (var key in later.effects) draft.effects[key] = DexViews.mergeEffect(draft.effects[key] || {}, later.effects[key], true);
				}
			}
			if (this.dexSaving && answers.saved) {
				this.dexSavingDone = true;
			} else {
				this.dexSaving = null;
			}
			this.applyDexDraft();
			app.send('/crq dexes');
			if (quit && !errors.length) quit.call(this);
		}
	});

})(window.jQuery);
