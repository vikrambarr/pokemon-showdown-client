(function ($) {

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

	function optionHTML(value, label, current) {
		return '<option value="' + BattleLog.escapeHTML(value) + '"' + (value === current ? ' selected' : '') + '>' + BattleLog.escapeHTML(label) + '</option>';
	}

	function worldOptions(current, exceptid, unofficial) {
		var group = function (label, list) {
			if (!list.length) return '';
			return '<optgroup label="' + label + '">' + list.map(function (dex) {
				return { id: dex.id, label: '[Gen ' + DexViews.genOf(dex.mod) + '] ' + dex.name };
			}).sort(function (a, b) {
				return a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' });
			}).map(function (dex) {
				return optionHTML(dex.id, dex.label, current);
			}).join('') + '</optgroup>';
		};
		var others = DexViews.list.filter(function (dex) { return dex.id !== exceptid; });
		var buf = '<optgroup label="Games">';
		for (var gen = 9; gen >= 1; gen--) buf += optionHTML('gen' + gen, 'Gen ' + gen, current);
		buf += '</optgroup>' + group("Official dexes", others.filter(function (dex) { return dex.official; }));
		return buf + (unofficial ? group("Dexes", others.filter(function (dex) { return !dex.official; })) : '');
	}

	function baseOptions(summary) {
		var current = summary ? baseValue(summary) : 'gen9';
		var buf = worldOptions(current, summary && summary.id, true);
		return buf.indexOf(' selected>') < 0 ? optionHTML(current, summary.base, current) + buf : buf;
	}

	var DexNamePopup = Popup.extend({
		type: 'semimodal',
		initialize: function (data) {
			this.callback = data.callback;
			this.$el.html('<form class="dexcreate"><p><label class="label">Name:<br /><input type="text" class="textbox autofocus" name="name" maxlength="40" value="' + BattleLog.escapeHTML(data.value || '') + '" /></label></p>' + (data.fields || '') +
				'<p class="buttonbar"><button type="submit" class="button"><strong>Create</strong></button> <button type="button" name="close" class="button">Cancel</button></p></form>');
			var input = this.$('input[name=name]')[0];
			if (data.value) setTimeout(function () { input.setSelectionRange(input.value.length, input.value.length); });
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
			buf += '<p><label class="label">Description:<br /><textarea class="textbox" name="description" rows="4" maxlength="512">' +
				BattleLog.escapeHTML(summary.description || '') + '</textarea></label></p></form>';
			buf += '<p><small>' + summary.counts.map(function (count) {
				return '<strong>' + count.name + ':</strong> ' + count.total + ' total, ' + count.custom + ' custom, ' + count.modified + ' modified';
			}).join('<br />') + '</small></p>';
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

	function megabytes(bytes) {
		return bytes < 1024 * 1024 ? Math.ceil(bytes / 1024) + ' KB' : (bytes / 1024 / 1024).toFixed(1).replace(/\.0$/, '') + ' MB';
	}

	function storageHTML(room) {
		if (!room.dexStorage || toID(room.dexSummary.owner) !== app.user.get('userid') || room.dexSummary.official) return '';
		return '<p><small>Your sprite storage: ' + megabytes(room.dexStorage.sprites) + ' of ' + megabytes(room.dexStorage.spriteLimit) + '</small></p>';
	}

	function storageFolderHTML(storage) {
		return '<div class="folder"><div class="text"><small>Data: ' + (storage ? megabytes(storage.data) + ' of ' + megabytes(storage.dataLimit) : '') + '</small></div></div>' +
			'<div class="folder"><div class="text"><small>Sprites: ' + (storage ? megabytes(storage.sprites) + ' of ' + megabytes(storage.spriteLimit) : '') + '</small></div></div>';
	}

	function shrinkSprite(file, kind) {
		var box = kind === 'type' ? { max: 64, width: 32, height: 14 } : kind.slice(0, 4) === 'icon' ? { max: 64, width: 40, height: 30 } : { max: 192, width: 96, height: 96 };
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

	function uploadSprite(room, name, kind, file) {
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
			app.send('/crq dexes');
		}, function (err) {
			room.setSaveState('failed');
			app.addPopup(Popup, { message: err.message });
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
			buf += storageHTML(room);
			buf += '<p class="buttonbar"><button type="submit" class="button"><strong>Upload</strong></button>' +
				(image ? ' <button type="button" name="clearSprite" class="button">Remove</button>' : '') +
				' <button type="button" name="close" class="button">Cancel</button></p></form>';
			this.$el.html(buf);
		},
		submit: function () {
			var file = this.$('input[name=file]')[0].files[0];
			if (!file) return;
			this.close();
			uploadSprite(this.room, this.room.dexSpecies.name, this.kind, file);
		},
		clearSprite: function () {
			this.close();
			this.room.editDex({ sprite: { name: this.room.dexSpecies.name, kind: this.kind, image: null } });
		}
	});

	DexViews.ui.DexSpritePopup = DexSpritePopup;

	var SOURCED = { pokemon: 1, move: 1, ability: 1, item: 1 };

	function speciesIds(view, name) {
		var species = view.dex.species.get(name);
		var formes = species.baseSpecies === species.name ? [species.name].concat(species.otherFormes || []) : [species.name];
		var entries = DexViews.entries[view.dexid];
		return formes.map(toID).filter(function (id) {
			return view.dex.species.get(id).exists && (id === species.id || view.species[id] || !entries || entries.world[id]);
		});
	}

	function namesHTML(names, noun) {
		return names.length > 12 ? names.length + ' ' + noun : BattleLog.escapeHTML(names.join(', '));
	}

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

	var DexTypePopup = Popup.extend({
		events: {
			'change input[name=file]': 'previewType'
		},
		initialize: function (data) {
			this.room = data.room;
			this.name = data.name;
			var room = this.room;
			var id = toID(data.name);
			var entries = DexViews.entries[room.dexid];
			this.own = entries && entries.types[id];
			this.vanilla = !!window.BattleTypeChart[id];
			this.removed = !!(room.dexView.TypeChart[id] && room.dexView.TypeChart[id].isNonstandard);
			var buf = '<form class="dextypeform"><p><span class="dextypepreview">' + Dex.getTypeIcon(data.name) + '</span> <strong>' + BattleLog.escapeHTML(data.name) + '</strong></p>';
			if (this.removed) {
				buf += '<p><small>Removed from this dex.</small></p>';
			} else {
				var image = this.image = DexViews.typeSprite(room.dexView, id);
				if (image) {
					buf += '<p><img src="' + DexViews.imageURL(image) + '" width="' + image.width * 2 + '" height="' + image.height * 2 + '" alt="" class="pixelated" /></p>' +
						'<p><small>' + image.width + '&times;' + image.height + (image.artist ? ', by ' + BattleLog.escapeHTML(image.artist) : '') + '</small></p>';
				}
				buf += '<p><input type="file" name="file" accept="image/png,image/gif" /></p>';
				buf += '<p><small>' + (room.dexSummary.official ? 'Official dex: any size' : 'Best at 32&times;14. Bigger than 64&times;64 is shrunk to 32&times;14') + '. Pixel art only.</small></p>';
				buf += storageHTML(room);
			}
			buf += '<p class="buttonbar">';
			if (this.removed) {
				buf += '<button type="button" name="restoreType" class="button"><strong>Restore</strong></button> ';
			} else {
				buf += '<button type="submit" class="button"><strong>Done</strong></button> ';
				if (this.image) buf += '<button type="button" name="clearSprite" class="button">Remove sprite</button> ';
				buf += '<button type="button" name="deleteType" class="button">Delete</button> ';
			}
			if (this.own && this.vanilla) buf += '<button type="button" name="resetType" class="button">Reset to base</button> ';
			this.$el.html(buf + '<button type="button" name="close" class="button">Cancel</button></p></form>');
		},
		previewType: function () {
			var file = this.$('input[name=file]')[0].files[0];
			if (this.objectURL) URL.revokeObjectURL(this.objectURL);
			this.objectURL = file ? URL.createObjectURL(file) : null;
			var src = this.objectURL || this.image && DexViews.imageURL(this.image);
			this.$('.dextypepreview').html(src ? '<img src="' + BattleLog.escapeHTML(src) + '" alt="" class="pixelated" style="max-width:32px;max-height:14px" />' : Dex.getTypeIcon(this.name));
		},
		submit: function () {
			var file = this.$('input[name=file]')[0].files[0];
			this.close();
			if (file) uploadSprite(this.room, this.name, 'type', file);
		},
		clearSprite: function () {
			this.close();
			this.room.editDex({ sprite: { name: this.name, kind: 'type', image: null } });
		},
		close: function () {
			if (this.objectURL) URL.revokeObjectURL(this.objectURL);
			Popup.prototype.close.apply(this, arguments);
		},
		deleteType: function () {
			var name = BattleLog.escapeHTML(this.name);
			this.confirmType(this.vanilla ? 'Remove the ' + name + ' type from this dex? Its matchups become neutral, and Pok&eacute;mon and moves that have it keep it.' :
				'Delete the ' + name + ' type from this dex?', "Delete", this.vanilla ? { type: { name: this.name, removed: true } } : { deletetype: this.name });
		},
		restoreType: function () {
			this.confirmType(null, null, { type: { name: this.name, removed: null } });
		},
		resetType: function () {
			this.confirmType('Reset ' + BattleLog.escapeHTML(this.name) + ' to its base matchups and look? Every edit to it in this dex is removed.',
				"Reset to base", { deletetype: this.name });
		},
		confirmType: function (message, button, edit) {
			var room = this.room;
			var key = 'TypeChart:' + toID(this.name);
			var save = function () {
				if (room.dexDraft) delete room.dexDraft.effects[key];
				room.applyDexDraft();
				room.editDex(edit);
			};
			this.close();
			if (!message) return save();
			app.addPopup(DexConfirmPopup, { message: message, button: button, callback: save });
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
			'input input[name=tiersearch]': 'searchDexTiers',
			'change select[name=tierstyle]': 'changeTierStyle',
			'click .dextierpage a[data-entry]': 'clickDexTierEntry',
			'change select[name=dexsource]': 'changeDexSource',
			'click .dextypeedit td[data-defender]': 'cycleDexTypeMatchup',
			'click .dextypeedit th[data-type]': 'openDexType',
			'click .dexremovedtypes button[data-type]': 'openDexType'
		},
		initialize: function () {
			this.$el.addClass('ps-room-light').addClass('scrollable');
			this.curFolder = '';
			this.update();
		},
		focus: function (e) {
			if (!e) app.send('/crq dexes');
		},
		loadDexStorage: function () {
			var room = this;
			if (!app.user.get('registered')) return;
			DexViews.ui.request('dexstorage', '').then(function (storage) {
				room.dexStorage = storage;
				room.updateFolderList();
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
			var all = slots.concat(shared, official);
			var folders = all.map(function (summary) { return summary.id; });
			if (folders.indexOf(this.curFolder) < 0) this.curFolder = folders[0] || '';
			this.folderLists = { slots: slots, shared: shared, official: official };
			this.updateFolderList();
			var storageKey = JSON.stringify([userid, slots.map(function (summary) { return summary.hash; })]);
			if (storageKey !== this.dexStorageKey) {
				this.dexStorageKey = storageKey;
				this.loadDexStorage();
			}
			var summary = all[folders.indexOf(this.curFolder)];
			var key = JSON.stringify([userid, summary]);
			this.dexOptions = this.dexOptionsHTML(slots, shared, official);
			this.$('select[name=dexpicker]').html(this.dexOptions);
			if (key === this.teamListKey) return this.settleDexSave();
			this.teamListKey = key;
			this.updateTeamList(summary);
		},
		dexPickerHTML: function (heading) {
			return '<div class="dexpicker">' + heading + '<select name="dexpicker">' + this.dexOptions + '</select></div>';
		},
		updateFolderList: function () {
			var slots = this.folderLists.slots;
			var shared = this.folderLists.shared;
			var official = this.folderLists.official;
			var buf = '<div class="folderlist"><div class="folderlistbefore"></div>';
			buf += '<div class="folder"><h3>Dexes</h3></div>';
			for (var i = 0; i < slots.length; i++) buf += this.folderHTML(slots[i]);
			buf += '<div class="folder"><div class="selectFolder" data-value="+"><i class="fa fa-plus"></i><em>(new dex)</em></div></div>';
			buf += '<div class="foldersep"></div><div class="folder"><h3>Storage</h3></div>' + storageFolderHTML(this.dexStorage);
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
			return (this.curFolder ? '' : '<option value="" selected disabled>(choose a dex)</option>') + options("Dexes", slots, '<option value="+">(new dex)</option>') +
				options("Shared with you", shared) + options("Official", official);
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
			var buf = '<button class="button dexmenu" name="openDexSettings" title="Dex settings"><i class="fa fa-ellipsis-h"></i></button>';
			this.showDex(summary, editable, buf + this.dexPickerHTML('<h2 class="dexheading">' + this.dexHeadingHTML() + '</h2>'));
		},
		showDex: function (summary, editable, buf) {
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
			buf += '<div class="dexpage"><div class="dexbuildertabs"></div><div class="dexbuildersub">' +
				'<p class="dexsubbar"><button class="button" name="closeDexTab"><i class="fa fa-chevron-left"></i> Dex</button> <strong class="dexsubtitle"></strong></p>' +
				'<ul class="dexformattabs dexscope"></ul><p class="dexpokemonsearch"><input type="search" class="textbox" name="pokemonsearch" placeholder="Search Pok&eacute;mon" size="30" autocomplete="off" />' +
				' <button class="button" name="newDexPokemon" style="display:none"><i class="fa fa-plus"></i> Create</button>' +
				'<button class="button" name="newDexEffect" style="display:none"><i class="fa fa-plus"></i> Create</button> <span class="dexsourcepick"></span> <span class="dexselectbar dexselectslot"></span></p>' +
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
		dexTabs: function (summary) {
			return summary.counts.map(function (count, i) {
				return [i, TAB_ICONS[count.table], count.name];
			}).concat([['tiers', 'sort-amount-desc', "Tiers"], ['formats', 'trophy', "Formats"]]);
		},
		dexTabsHTML: function (summary) {
			return this.dexTabs(summary).map(function (tab) {
				return '<button class="button dexbuildertab" name="showDexTab" value="' + tab[0] + '"><i class="fa fa-' + tab[1] + '"></i>' + tab[2] + '</button>';
			}).join('');
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
			} else if (this.dexFamilyOf) {
				if (dexView.species[toID(this.dexFamilyOf)]) {
					this.openDexFamily(this.dexFamilyOf);
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
				buf += ' <span class="dextierselection dexselectslot"></span>';
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
				return type === 'pokemon' && own[speciesid] && own[speciesid][info[2]] ? ' dextieroverride' : '';
			});
			this.tierSelect = DexViews.ui.selectable(search, {
				type: function () { return 'pokemon'; },
				enabled: function () { return room.dexEditable && !!info[2]; },
				canSelect: function () { return true; },
				$bar: function () { return room.$('.dextierselection'); },
				actions: function () {
					return [{ label: "Move to tier&hellip;", icon: 'sort-amount-desc', applies: function () { return true; }, run: function (ids, button) {
						app.addPopup(DexTierPopup, { room: room, species: ids.map(function (id) { return room.dexView.dex.species.get(id).name; }), sourceEl: button });
					} }];
				}
			});
			DexViews.ui.viewSearch(search, this.dexView, function (typedSearch) {
				typedSearch.isNatDex = style === 'natdex';
				typedSearch.isDoubles = style === 'doubles' || style === 'vgc';
				typedSearch.isVGC = style === 'vgc';
				typedSearch.tierOverrides = overrides;
			});
			search.setType('pokemon', 'gen' + this.dexView.gen);
			this.tierSelect.render();
			scroller.scrollTop(top);
		},
		selectTierFormat: function (value, button) {
			var room = this;
			var summary = this.dexSummary;
			app.addPopup(DexViews.ui.DexFormatPopup, {
				format: this.tierFormat || '', sourceEl: button, section: summary.name, dexid: summary.id, selectType: 'watch',
				onselect: function (format) {
					room.tierFormat = format;
					room.renderDexTiers();
				}
			});
		},
		changeTierStyle: function (e) {
			this.selectTierStyle(e.currentTarget.value);
		},
		selectTierStyle: function (style) {
			this.tierStyle = style;
			this.renderDexTierPage(null);
		},
		searchDexTiers: function (e) {
			this.tierSearch.find(e.currentTarget.value);
		},
		clickDexTierEntry: function (e) {
			e.preventDefault();
			if (this.tierSelect.click(e)) return;
			var entry = e.currentTarget.dataset.entry.split('|');
			if (entry[0] !== 'pokemon') {
				if (this.tierSearch.addFilter(e.currentTarget)) this.tierSearch.find('');
				return;
			}
			if (!this.dexEditable || this.tierActiveStyle === 'vgc') return;
			e.stopPropagation();
			app.dismissPopups();
			app.addPopup(DexTierPopup, { room: this, species: [this.dexView.dex.species.get(entry[1]).name], sourceEl: e.currentTarget });
		},
		saveDexTiers: function (names, tier) {
			var field = TIER_STYLES.filter(function (entry) { return entry[0] === this.tierActiveStyle; }, this)[0][2];
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
			if (home) {
				this.dexTab = '';
				this.$('.dexbuildertab').removeClass('cur').blur();
				return;
			}
			if (tab !== this.dexTab) this.dexScroller().scrollTop(0);
			if (String(tab) !== this.dexTab) {
				this.dexScope = 'in';
				this.dexSource = '';
			}
			if (this.dexSelect) this.dexSelect.stop();
			if (!this.dexSearch) {
				this.dexTab = String(tab);
				return;
			}
			var tiers = String(tab) === 'tiers';
			this.$('.dextierpage').toggle(tiers);
			this.scaleDex();
			if (tiers) {
				this.dexTab = 'tiers';
				this.$('.dexscope, .dexpokemonsearch, .dexpokemon, .dextabempty, .dexformatpage').hide();
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
			if (kind || conditions) this.$('input[name=pokemonsearch]').attr('placeholder', $('<span>').html('Search ' + count.name).text());
			var typedSearch = this.dexSearch.engine.typedSearch;
			if (kind && (typedSearch.searchType !== kind || typedSearch.dexScope !== this.dexScopeKey(kind))) {
				this.$('input[name=pokemonsearch]').val('');
				this.dexSearch.setType(kind, 'gen' + this.dexSourceGen(kind));
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
				this.dexTabSelect = DexViews.ui.selectable(this.dexTabSearch, this.dexSelectOptions(function () { return 'condition'; }));
			}
			this.$('.dexformatpage').toggle(formats);
			if (pokemon) this.dexSearch.updateScroll();
			if (formats && this.dexFormatId !== this.dexFormat) this.openDexFormat(this.dexFormat);
			if (formats && this.dexFormatSearch) this.dexFormatSearch.updateScroll();
			this.$('.dexsubtitle').text(this.$('.dexbuildertab[value="' + this.dexTab + '"]').contents().filter(function () { return this.nodeType === 3; }).text());
			var table = this.dexSummary.counts[this.dexTab] && this.dexSummary.counts[this.dexTab].table;
			this.$('button[name=newDexPokemon]').toggle(this.dexEditable && table === 'Pokedex' && this.dexScope !== 'out');
			this.$('button[name=newDexEffect]').toggle(this.dexEditable && !!EFFECT_KINDS[table] && this.dexScope !== 'out').attr('title', 'Create a new ' + EFFECT_KINDS[table]);
			var scopeTabs = this.dexScopeHTML(this.dexKind());
			this.$('.dexscope').html(scopeTabs).toggle(!!scopeTabs);
			this.$('.dexsourcepick').html(this.dexSourceHTML(kind));
			this.activeDexSelect().render();
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
			var room = this;
			var search = this.dexSearch = this.createDexList(this.$('.dexpokemon'), 'dexListZoom');
			this.dexSelect = DexViews.ui.selectable(search, this.dexSelectOptions(function () {
				return search.engine.typedSearch ? search.engine.typedSearch.searchType : '';
			}));
			var entryResults = DexViews.ui.dexEntryResults(dexid);
			DexViews.ui.viewSearch(search, view, function (typedSearch, searchType) {
				entryResults(typedSearch, searchType);
				room.scopeDexSearch(typedSearch, searchType);
			});
			this.scaleDex();
			search.setType('pokemon', 'gen' + view.gen);
			this.showDexTab(this.dexTab);
		},
		renderDexTypes: function () {
			DexViews.current = this.dexView;
			var dex = this.dexView.dex;
			var names = dex.types.names().filter(function (name) { return dex.types.get(name).exists !== false; });
			var editable = this.dexEditable;
			var buf = editable ? '<p><button class="button" name="newDexEffect"><i class="fa fa-plus"></i> Create</button>' + this.dexSaveHTML('button dexsave') + '</p>' : '';
			buf += '<p><small>Rows are the attacking type, columns are the defending type.' + (editable ? ' Click a matchup to change it.' : '') + '</small></p>';
			buf += '<div class="ladder dextypechart' + (editable ? ' dextypeedit' : '') + '"><table><tr><th></th>';
			var typeHeader = function (name) {
				return '<th title="' + BattleLog.escapeHTML(name) + '"' + (editable ? ' data-type="' + BattleLog.escapeHTML(name) + '"' : '') + '>' + Dex.getTypeIcon(name) + '</th>';
			};
			for (var i = 0; i < names.length; i++) buf += typeHeader(names[i]);
			buf += '</tr>';
			for (var i = 0; i < names.length; i++) {
				buf += '<tr>' + typeHeader(names[i]);
				for (var j = 0; j < names.length; j++) {
					var taken = (dex.types.get(names[j]).damageTaken || {})[names[i]] || 0;
					buf += '<td class="' + ['', 'super', 'resist', 'immune'][taken] + '"' +
						(editable ? ' data-attacker="' + BattleLog.escapeHTML(names[i]) + '" data-defender="' + BattleLog.escapeHTML(names[j]) + '"' : '') + '>' + ['', '2', '&frac12;', '0'][taken] + '</td>';
				}
				buf += '</tr>';
			}
			buf += '</table></div>';
			var removed = Object.keys(this.dexView.TypeChart).filter(function (id) { return dex.types.get(id).isNonstandard; });
			if (!removed.length) return buf;
			buf += '<p class="dexremovedtypes"><small>Removed types:</small> ';
			for (var i = 0; i < removed.length; i++) {
				var name = dex.types.get(removed[i]).name;
				buf += editable ? '<button class="button" data-type="' + BattleLog.escapeHTML(name) + '" title="Restore ' + BattleLog.escapeHTML(name) + '">' + Dex.getTypeIcon(name) + '</button> ' : Dex.getTypeIcon(name) + ' ';
			}
			return buf + '</p>';
		},
		openDexType: function (e) {
			e.stopPropagation();
			app.addPopup(DexTypePopup, { room: this, name: e.currentTarget.dataset.type, sourceEl: e.currentTarget });
		},
		cycleDexTypeMatchup: function (e) {
			var cell = e.currentTarget.dataset;
			var taken = this.dexView.dex.types.get(cell.defender).damageTaken || {};
			var damageTaken = {};
			damageTaken[cell.attacker] = [2, 0.5, 0, 1][taken[cell.attacker] || 0];
			this.draftDex('effects', 'TypeChart:' + toID(cell.defender), { name: cell.defender, damageTaken: damageTaken });
			this.$('.dextabempty').html(this.renderDexTypes());
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
			if (this.activeDexSelect().click(e)) return;
			var entry = e.currentTarget.dataset.entry.split('|');
			if (SOURCED[entry[0]] && entry[0] === this.dexKind() && this.dexScope === 'out' && this.dexSource) {
				this.openSourceEntry(entry[0], entry[1]);
				return;
			}
			if (entry[0] === 'pokemon') {
				this.openDexFamily(entry[1]);
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
		activeDexSelect: function () {
			return this.dexTabSearch && this.dexTabSearch !== this.dexSearch ? this.dexTabSelect : this.dexSelect;
		},
		dexSelectOptions: function (type) {
			var room = this;
			return {
				type: type,
				enabled: function () { return room.dexEditable; },
				canSelect: function () { return true; },
				$bar: function () { return room.$('.dexselectbar'); },
				actions: function () { return room.dexSelectActions(type()); }
			};
		},
		dexSelectActions: function (kind) {
			var room = this;
			var entries = DexViews.entries[this.dexid];
			if (!entries) return [];
			if (this.dexScope === 'out' && SOURCED[kind]) {
				var source = this.dexSource || '';
				return [{ label: "Add to dex", icon: 'plus', applies: function () { return true; }, run: function (ids, button, done) {
					room.addDexEntriesFrom(kind, source, ids);
					done();
				} }];
			}
			if (kind === 'pokemon') {
				var own = entries.originals;
				return [
					{ label: "Delete", icon: 'trash', applies: function () { return true; }, run: function (ids, button, done) {
						room.deleteDexEntries('Pokedex', ids, false, button, done);
					} },
					{ label: "Reset", icon: 'undo', applies: function (id) { return !!own[id]; }, run: function (ids, button, done) {
						room.deleteDexEntries('Pokedex', ids, true, button, done);
					} }
				];
			}
			var table = DexViews.ui.ENTRY_TABLES[kind];
			var mine = entries.own[table] || {};
			return [
				{ label: "Delete", icon: 'trash', applies: function (id) { return mine[id] === 'custom' || kind !== 'condition' && !!entries[table][id]; }, run: function (ids, button, done) {
					room.deleteDexEntries(table, ids, false, button, done);
				} },
				{ label: "Reset", icon: 'undo', applies: function (id) { return mine[id] === 'edited'; }, run: function (ids, button, done) {
					room.deleteDexEntries(table, ids, true, button, done);
				} }
			];
		},
		dexSourceData: null,
		dexKind: function () {
			var count = this.dexSummary && this.dexSummary.counts[this.dexTab];
			return count && { Pokedex: 'pokemon', Moves: 'move', Abilities: 'ability', Items: 'item', Conditions: 'condition' }[count.table] || '';
		},
		dexSourceView: function (kind) {
			var data = this.dexSourceData;
			if (!this.dexSource && kind === 'pokemon') return this.dexView;
			return data && data.key === kind + ':' + (this.dexSource || '') ? data.view || this.dexView : null;
		},
		dexSourceIds: function (kind) {
			var entries = DexViews.entries[this.dexid];
			if (!this.dexSource && kind === 'pokemon') return Object.keys(entries ? entries.world : {});
			return this.dexSourceView(kind) ? this.dexSourceData.ids : [];
		},
		dexScopeKey: function (kind) {
			if (this.dexScope !== 'out' || !SOURCED[kind]) return this.dexScope || 'in';
			return 'out:' + (this.dexSource || '') + (this.dexSourceView(kind) ? ':loaded' : '');
		},
		dexSourceGen: function (kind) {
			var view = this.dexScope === 'out' && SOURCED[kind] && this.dexSourceView(kind);
			return (view || this.dexView).gen;
		},
		dexScopeHTML: function (kind) {
			if (!SOURCED[kind] && kind !== 'condition') return '';
			return ['in', 'out'].map(function (scope) {
				return '<li><button class="button' + (scope === this.dexScope ? ' cur' : '') + '" name="setDexScope" value="' + scope + '">' + (scope === 'in' ? "This dex" : "Other dexes") + '</button></li>';
			}, this).join('');
		},
		dexSourceHTML: function (kind) {
			if (!SOURCED[kind] || this.dexScope !== 'out') return '';
			var current = this.dexSource || '';
			return '<label>from <select name="dexsource" class="button">' + optionHTML('', "This dex's world", current) + worldOptions(current, this.dexid) + '</select></label>';

		},
		changeDexSource: function (e) {
			this.dexSource = e.currentTarget.value;
			this.loadDexSource();
		},
		loadDexSource: function () {
			var room = this;
			var kind = this.dexKind();
			var source = this.dexSource || '';
			this.showDexTab(this.dexTab);
			if (this.dexScope !== 'out' || !SOURCED[kind] || this.dexSourceView(kind)) return;
			var key = kind + ':' + source;
			var summary = DexViews.list.filter(function (each) { return each.id === source; })[0];
			var gen = /^gen(\d)$/.exec(source);
			Promise.all([DexViews.ui.request('dexsource', this.dexid + ', ' + source + ', ' + kind), summary && DexViews.load(summary)]).then(function (results) {
				if (room.dexKind() + ':' + (room.dexSource || '') !== key) return;
				room.dexSourceData = { key: key, ids: results[0].species, view: results[1] || (gen ? room.genView(Number(gen[1])) : null) };
				room.showDexTab(room.dexTab);
			}, function (err) {
				app.addPopup(Popup, { message: err.message });
			});
		},
		genView: function (gen) {
			return {
				gen: gen, dex: Dex.forGen(gen), species: {}, Pokedex: {}, Learnsets: {}, FormatsData: {}, Moves: {}, Abilities: {}, Items: {}, TypeChart: {},
				sprites: {}, itemSprites: {}, typeSprites: {}, images: {}, origins: {}
			};
		},
		scopeDexSearch: function (typedSearch, searchType) {
			var view = this.dexView;
			var entries = DexViews.entries[this.dexid];
			var shownInDex = DexViews.ui.shownInDex;
			typedSearch.dexScope = this.dexScopeKey(searchType);
			if (this.dexScope !== 'out' || !SOURCED[searchType]) return;
			var source = this.dexSourceView(searchType);
			var table = DexViews.ui.ENTRY_TABLES[searchType];
			var getter = DexViews.ui.GETTERS[table];
			var pool = {};
			$.each(this.dexSourceIds(searchType), function (i, id) {
				var inDex = searchType === 'pokemon' ? view.species[id] : !entries || entries[table][id];
				if (!inDex && source && source.dex[getter].get(id).exists) pool[id] = 1;
			});
			if (source) {
				typedSearch.dex = source.dex;
				typedSearch.dexView = source;
			}
			typedSearch.dexPool = pool;
			typedSearch.dexFilter = function (row) {
				return row[0] === searchType ? !!pool[row[1]] : shownInDex(typedSearch.dexView, row);
			};
		},
		setDexScope: function (scope) {
			if (scope === this.dexScope) return;
			this.dexScope = scope;
			if (!DexViews.entries[this.dexid]) DexViews.loadEntries(this.dexid);
			this.loadDexSource();
		},
		openSourceEntry: function (kind, name) {
			var source = this.dexSource;
			var table = DexViews.ui.ENTRY_TABLES[kind];
			if (/^gen\d$/.test(source)) {
				window.open('https://' + Config.routes.dex + '/' + { Pokedex: 'pokemon', Moves: 'moves', Abilities: 'abilities', Items: 'items' }[table] + '/' + toID(name), '_blank');
				return;
			}
			DexViews.ui.openDexPage(app, source);
			var room = app.rooms['dex-' + source];
			var tries = 0;
			var open = function () {
				if (room && room.dexView) return kind === 'pokemon' ? room.openDexFamily(name) : room.openDexEffect(table, toID(name));
				if (++tries < 40) setTimeout(open, 250);
			};
			open();
		},
		addDexEntriesFrom: function (kind, source, ids) {
			var dex = (this.dexSourceView(kind) || this.dexView).dex;
			var getter = DexViews.ui.GETTERS[DexViews.ui.ENTRY_TABLES[kind]];
			var edit = {};
			edit[kind === 'pokemon' ? 'addpokemon' : 'add' + kind] = { from: source, names: ids.map(function (id) { return dex[getter].get(id).name; }) };
			this.editDex(edit);
		},
		dexEntryName: function (table, id) {
			if (table === 'Conditions') return this.dexConditionInfo(id).name;
			return this.dexView.dex[DexViews.ui.GETTERS[table]].get(id).name || id;
		},
		deleteDexEntries: function (table, ids, reset, button, done) {
			var room = this;
			var view = this.dexView;
			var pokemon = table === 'Pokedex';
			var whole = pokemon && !reset;
			var names = ids.map(function (id) { return room.dexEntryName(table, id); });
			var shown = whole ? [] : names;
			$.each(whole ? ids : [], function (i, id) {
				$.each(speciesIds(view, id), function (j, formeid) {
					var name = view.dex.species.get(formeid).name;
					if (view.species[formeid] && shown.indexOf(name) < 0) shown.push(name);
				});
			});
			if (!shown.length) return;
			var noun = pokemon ? 'Pok&eacute;mon' : table.toLowerCase();
			var one = shown.length === 1;
			var warning = 'Teams using ' + (one ? 'it' : 'them') + ' stop being legal, ' + (pokemon ? 'dexes set in this one lose ' + (one ? 'it' : 'them') + ' too, ' : '') +
				'and ' + (one ? 'its' : 'their') + ' edits are lost.';
			var message = reset ? 'Reset ' + namesHTML(shown, noun) + ' to ' + (one ? 'its' : 'their') + ' base data? Every edit to ' + (one ? 'it' : 'them') + ' in this dex is removed.' :
				'Delete ' + namesHTML(shown, noun) + ' from this dex?<br /><small>' + warning + '</small>';
			app.addPopup(DexConfirmPopup, {
				message: message,
				button: reset ? "Reset to base" : "Delete",
				sourceEl: button,
				callback: function () {
					var layer = room.dexDraft && room.dexDraft[pokemon ? 'pokemon' : 'effects'];
					$.each(ids, function (i, id) {
						if (layer) delete layer[pokemon ? id : table + ':' + id];
						if (whole) return;
						var edit = {};
						edit[(reset ? 'reset' : 'delete') + (pokemon ? 'pokemon' : EFFECT_KINDS[table])] = names[i];
						room.editDex(edit, names[i]);
					});
					if (whole) room.editDex({ deletepokemon: names });
					room.applyDexDraft();
					if (done) done();
					if (whole && (room.dexSpecies || room.dexFamilyOf)) room.closeDexPokemon();
				}
			});
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
			this.$('select[name=dexpicker]').val(this.curFolder);
			this.openDexFolder(value, e.currentTarget);
		},
		openDexFolder: function (dexid, sourceEl) {
			if (dexid === this.curFolder) return;
			this.leaveDex(sourceEl, function () {
				this.curFolder = dexid;
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
			if (this.dexFamilyOf) return this.openDexFamily(this.dexFamilyOf);
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
			if (data.skipped) answers.skipped = (answers.skipped || []).concat(data.skipped);
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
			if (!errors.length && answers.skipped) app.addPopup(Popup, { message: "Some Pok\u00e9mon weren't added:\n\n- " + answers.skipped.join('\n- ') });
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

	window.DexViewRoom = window.DexBuilderRoom.extend({
		type: 'dexview',
		title: 'Dex',
		isSideRoom: true,
		minWidth: 320,
		maxWidth: 1024,
		initialize: function () {
			this.$el.addClass('ps-room-light').addClass('scrollable').addClass('dexviewroom');
			this.$el.html('<div class="teampane"><p><em>Loading...</em></p></div>');
			this.$('.teampane').on('scroll', this.updateDexScroll.bind(this));
			this.update();
		},
		viewedSummary: function () {
			var self = this;
			var dexid = this.id.slice(4);
			var summary = DexViews.list.filter(function (dex) { return dex.id === dexid; })[0];
			if (summary) return summary;
			if (this.viewQuery) return this.viewQuery;
			if (!DexViews.list.length || this.viewQuerying) return null;
			this.viewQuerying = true;
			DexViews.query(dexid).then(function (data) {
				self.viewQuery = data;
				self.update();
			}, function () {
				app.removeRoom(self.id);
				app.addPopup(Popup, { message: "There's no dex called \"" + dexid + "\"." });
			});
			return null;
		},
		update: function () {
			var summary = this.viewedSummary();
			if (!summary) return;
			if (this.title !== summary.name) {
				this.title = summary.name;
				app.topbar.updateTabbar();
			}
			if (this.dexid !== summary.id) return this.showDex(summary, false, '');
			if (this.dexKey(summary) !== this.dexKey(this.dexSummary)) return this.loadDex(summary);
			this.$('.dexheader').html(this.dexHeaderHTML(summary));
		},
		dexHeaderHTML: function (summary) {
			var buf = '<h2>' + (summary.official ? OFFICIAL_BADGE : '') + BattleLog.escapeHTML(summary.name) + '</h2>';
			if (summary.description) buf += '<p>' + BattleLog.escapeHTML(summary.description).replace(/\n/g, '<br />') + '</p>';
			buf += '<p><strong>Made by:</strong> ' + BattleLog.escapeHTML(summary.owner);
			if (summary.editors && summary.editors.length) buf += '<br /><strong>Edited by:</strong> ' + BattleLog.escapeHTML(summary.editors.join(', '));
			buf += '<br /><strong>World:</strong> ' + BattleLog.escapeHTML(summary.base) + ' (Gen ' + DexViews.genOf(summary.mod) + ')';
			buf += '<br /><small>' + summary.counts.map(function (count) {
				return '<strong>' + count.name + ':</strong> ' + count.total + ' total, ' + count.custom + ' custom, ' + count.modified + ' modified';
			}).join(' &middot; ') + '</small>';
			return buf + '</p><p><button class="button" name="worldDex"><i class="fa fa-globe"></i> Use as world</button>' +
				(DexViews.ui.canEdit(summary) ? ' <button class="button" name="editViewedDex"><i class="fa fa-pencil"></i> Edit</button>' : '') + '</p>';
		},
		dexTabsHTML: function (summary) {
			return '<div class="dexheader">' + this.dexHeaderHTML(summary) + '</div><ul class="dexformattabs">' + this.dexTabs(summary).map(function (tab) {
				return '<li><button class="button" name="showDexTab" value="' + tab[0] + '">' + tab[2] + '</button></li>';
			}).join('') + '</ul>';
		},
		showDexTab: function (tab) {
			window.DexBuilderRoom.prototype.showDexTab.call(this, tab === '' || tab === null || tab === undefined ? '0' : tab);
		},
		editViewedDex: function () {
			var dexid = this.dexid;
			app.joinRoom('dexbuilder', window.DexBuilderRoom);
			app.rooms.dexbuilder.openDexFolder(dexid);
		}
	});

})(window.jQuery);
