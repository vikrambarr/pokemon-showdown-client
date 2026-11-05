(function ($) {

	var DEX_SLOTS = 3;

	var DexViews = window.DexViews;
	var compareFormats = DexViews.ui.compareFormats;
	var DexConfirmPopup = DexViews.ui.DexConfirmPopup;
	var openDexPage = DexViews.ui.openDexPage;
	var OFFICIAL_BADGE = DexViews.ui.OFFICIAL_BADGE;

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

})(window.jQuery);
