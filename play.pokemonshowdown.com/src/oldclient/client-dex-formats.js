(function ($) {

	var DexViews = window.DexViews;
	var request = window.DexViews.ui.request;
	var viewSearch = window.DexViews.ui.viewSearch;
	var dropEmptyHeaders = window.DexViews.ui.dropEmptyHeaders;
	var shownInDex = window.DexViews.ui.shownInDex;
	var setTierStyle = window.DexViews.ui.setTierStyle;
	var DexConfirmPopup = DexViews.ui.DexConfirmPopup;

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

	window.DexViews.ui.DexFormatPopup = DexFormatPopup;

	var DexEnginePopup = Popup.extend({
		initialize: function (data) {
			this.pick = data.pick;
			this.$el.html('<ul class="popupmenu">' + data.details.engines.map(function (engine) {
				return '<li><button class="option' + (engine.id === data.details.engine ? ' cur' : '') + '" name="pickEngine" value="' + BattleLog.escapeHTML(engine.id) + '">' +
					BattleLog.escapeHTML(engine.name) + '</button></li>';
			}).join('') + '</ul>');
		},
		pickEngine: function (engine) {
			this.close();
			this.pick(engine);
		}
	});

	var formatRules = {};

	function ruleSpecId(spec) {
		return toID(spec.replace(/^[\^!]+/, '').split('=')[0]);
	}

	function requestFormat(target) {
		var formatid = target.split(',')[0];
		if (!formatRules[formatid]) {
			formatRules[formatid] = request('dexrules', formatid);
			formatRules[formatid].then(null, function () { delete formatRules[formatid]; });
		}
		return Promise.all([request('dexformat', target), formatRules[formatid]]).then(function (results) {
			return $.extend({}, results[0], { rulesets: results[1].rulesets, tags: results[1].tags });
		});
	}

	var FORMAT_PICKERS = [['pokemon', 'Pok&eacute;mon', 'Pok\u00E9mon'], ['move', 'Moves', 'moves'], ['ability', 'Abilities', 'abilities'], ['item', 'Items', 'items']];
	var FORMAT_TABS = [['rule', 'Rulesets'], ['banlist', 'Banlist']];
	var FORMAT_BAN_TABS = [['ban', 'Tags'], ['pokemon', 'Pok&eacute;mon'], ['item', 'Items'], ['move', 'Moves'], ['ability', 'Abilities']];
	var FORMAT_TAG_GROUPS = [['pokemon', "Pok\u00E9mon tags"], ['move', "Move tags"], ['other', "Other tags"]];
	var FORMAT_BAN_STATES = { '': "Allowed", banned: "Banned", restricted: "Restricted", unbanned: "Unbanned" };
	var FORMAT_GAME_TYPES = { singles: 'Singles', doubles: 'Doubles', triples: 'Triples', multi: 'Multi', freeforall: 'Free-for-all' };

	_.extend(window.DexBuilderRoom.prototype, {
		selectDexFormat: function (format, button) {
			var room = this;
			app.addPopup(DexFormatPopup, { format: format, sourceEl: button, section: this.dexSummary.name, dexid: this.dexSummary.id, onselect: function (newFormat) {
				room.dexFormat = newFormat;
				room.openDexFormat(newFormat);
			} });
		},
		openDexFormat: function (formatid) {
			this.dexFormat = formatid;
			this.dexFormatId = formatid;
			this.dexFormatSearch = null;
			this.$('.dexformatpage').html('<div class="pad"><p><em style="font-size:20pt">Loading...</em></p></div>');
			var room = this;
			requestFormat(this.dexFormatTarget(formatid)).then(function (details) {
				room.renderDexFormat(details);
			}, function () {
				if (room.dexFormatId === formatid) room.renderDexFormat(null);
			});
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
				settings[ruleSpecId(spec)] = /^!(?!!)/.test(spec) ? 'off' : 'on';
			}
			var buf = '<div class="pad" style="padding-top:0">';
			buf += '<p><label class="label">Format:</label><button class="select formatselect" name="selectDexFormat" value="' + BattleLog.escapeHTML(details.id) + '">' + BattleLog.escapeFormat(details.id) + '</button></p>';
			buf += '<div class="formatsettings"><p>';
			buf += '<label class="label">Dex: <strong>' + BattleLog.escapeHTML(details.dex) + '</strong></label> ';
			buf += '<label class="label">Mod: <strong>' + BattleLog.escapeHTML(details.mod) + '</strong></label> ';
			var engineName = BattleLog.escapeHTML((details.engines.find(function (engine) { return engine.id === details.engine; }) || { name: details.engine }).name);
			buf += '<label class="label">Engine: ' + (this.dexEditable ? '<button class="select" name="selectDexEngine">' + engineName + '</button>' : '<strong>' + engineName + '</strong>') + '</label> ';
			buf += '<label class="label">Game type: <strong>' + BattleLog.escapeHTML(FORMAT_GAME_TYPES[details.gameType] || details.gameType) + '</strong></label></p>';
			if (this.dexEditable) {
				buf += '<p><label class="label">Name: <input type="text" class="textbox" name="formatname" value="' + BattleLog.escapeHTML(details.name) + '" size="20" maxlength="40" /></label> ' +
					'<button class="button" name="newDexFormat"><i class="fa fa-plus"></i> New format</button> ' +
					'<button class="button" name="deleteDexFormat"><i class="fa fa-trash"></i> Delete format</button>' + this.dexSaveHTML('button dexsave') + '</p>';
			}
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
			this.scaleDex();
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
			var search = this.dexFormatSearch = this.createDexList($list, 'dexFormatZoom');
			window.DexViews.ui.rowClasses(search, function (id, type) {
				return type === kind && banned[id] ? ' banned' : '';
			});
			var room = this;
			viewSearch(search, view, function (typedSearch, searchType) {
				typedSearch.dexid = room.dexid;
				setTierStyle(typedSearch, details);
				var getBaseResults = typedSearch.getBaseResults;
				typedSearch.getBaseResults = function () {
					var seen = {};
					var bannedRows = [];
					var results = dropEmptyHeaders(getBaseResults.call(this).filter(function (row) {
						if (row[0] !== searchType) return true;
						if (seen[row[1]] || !legal[row[1]] && !banned[row[1]]) return false;
						seen[row[1]] = 1;
						if (!onTop[row[1]]) return true;
						bannedRows.push(row);
						return false;
					}), searchType);
					for (var id in legal) {
						if (!seen[id]) results.push([searchType, id]);
					}
					for (var bannedid in banned) {
						if (!seen[bannedid]) (onTop[bannedid] ? bannedRows : results).push([searchType, bannedid]);
					}
					if (!results.some(function (row) { return row[0] === 'header'; })) results.unshift(['header', picker[1]]);
					if (!bannedRows.length) return results;
					var count = bannedRows.filter(function (row) { return shownInDex(view, row); }).length;
					bannedRows.unshift(['header', "Banned " + picker[2] + " (" + count + ")"]);
					return bannedRows.concat(results);
				};
			});
			$page.find('.dexformatsearch').show().find('input').val('').attr('placeholder', 'Search legal ' + picker[2]);
			search.setType(kind, 'gen' + view.gen + 'ag');
		},
		renderDexFormatTree: function (query) {
			query = query.toLowerCase();
			var details = this.dexFormatDetails;
			var tree = this.dexFormatTree;
			var editable = this.dexEditable;
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
				var value = activeHere && details.values[ruleid] || '';
				var valueBuf = '';
				if (rule.value && editable) {
					valueBuf = ' <input type="text" class="textbox" name="dexRuleValue" data-rule="' + ruleid + '" value="' + BattleLog.escapeHTML(value) + '" size="8"' +
						(rule.options ? ' list="dexrulevalues-' + ruleid + '"' : '') + ' />';
					if (rule.options) {
						valueBuf += '<datalist id="dexrulevalues-' + ruleid + '">' + rule.options.map(function (option) {
							return '<option value="' + BattleLog.escapeHTML(option) + '"></option>';
						}).join('') + '</datalist>';
					}
				} else if (value) {
					valueBuf = ' <strong>' + BattleLog.escapeHTML(value) + '</strong>';
				}
				if (query && !childBuf && !(rule.name + ' ' + (rule.desc || '')).toLowerCase().includes(query)) return '';
				var title = on ? (source ? "Required by " + source + (elsewhere ? ", highlighted there" : "") : elsewhere ? "On, highlighted at the top" : "On") :
					off ? "Off, switched off by this format" : "Off";
				return '<li><button type="button" class="button' + (on ? (elsewhere ? ' ruleelsewhere' : ' ruleon') : '') + '" title="' + BattleLog.escapeHTML(title) + '"' +
					(editable ? ' name="toggleDexRule" value="' + ruleid + '"' : '') + '>' +
					BattleLog.escapeHTML(rule.name) + '</button>' + valueBuf +
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
					groupBuf += '<li><button type="button" class="button' + (ban.state && ban.state !== 'unbanned' ? ' ruleoff' : '') + '" title="' + BattleLog.escapeHTML(title) + '"' +
						(this.dexEditable ? ' name="toggleDexBan" value="' + BattleLog.escapeHTML(ban.name) + '"' : '') + '>' +
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
		refreshDexFormat: function (changed) {
			if (changed || !this.dexFormat || !this.dexFormatDetails) {
				this.dexFormatId = '';
				this.showDexTab('formats');
				return;
			}
			var self = this;
			var formatid = this.dexFormat;
			requestFormat(this.dexFormatTarget(formatid)).then(function (details) {
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
			requestFormat(target).then(function (preview) {
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
		selectDexEngine: function (value, button) {
			var room = this;
			app.addPopup(DexEnginePopup, { details: this.dexFormatDetails, sourceEl: button, pick: function (engine) {
				if (engine !== room.dexFormatDetails.engine) room.saveDexFormat({ engine: engine });
			} });
		},
		renameDexFormat: function (e) {
			var name = $.trim(e.currentTarget.value);
			if (name && name !== this.dexFormatDetails.name) this.saveDexFormat({ name: name });
		},
		toggleDexRule: function (ruleid) {
			var details = this.dexFormatDetails;
			var rule = this.dexFormatTree.byId[ruleid];
			if (rule.value) return this.setDexRuleValue(ruleid, details.rules.includes(ruleid) ? '' : null);
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
		setDexRuleValue: function (ruleid, value) {
			var details = this.dexFormatDetails;
			var rule = this.dexFormatTree.byId[ruleid];
			var own = details.ruleset.filter(function (spec) { return ruleSpecId(spec) === ruleid; })[0];
			var inherited = own ? /^\^?!/.test(own) : details.rules.includes(ruleid);
			var ruleset = details.ruleset.filter(function (spec) { return spec !== own; });
			if (value === null) {
				if (!own || own.includes('=')) return this.$('input[name=dexRuleValue][data-rule="' + ruleid + '"]').focus();
			} else if (!value) {
				if (inherited) ruleset.push('!' + rule.name);
			} else if (inherited && value === (own ? (details.defaults || {})[ruleid] : details.values[ruleid])) {
				if (!own) return;
			} else {
				ruleset.push((inherited ? '!!' : '') + rule.name + ' = ' + value);
				if (ruleset[ruleset.length - 1] === own) return;
			}
			this.saveDexFormat({ ruleset: ruleset }, function (local) {
				local.rules = local.rules.filter(function (other) { return other !== ruleid; }).concat(value === '' ? [] : [ruleid]);
				if (value) local.values[ruleid] = value;
				else delete local.values[ruleid];
			});
		},
		changeDexRuleValue: function (e) {
			this.setDexRuleValue(e.currentTarget.dataset.rule, $.trim(e.currentTarget.value));
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
			app.addPopup(DexViews.ui.DexNamePopup, {
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
		}
	});

	_.extend(window.DexBuilderRoom.prototype.events, {
		'input input[name=formatsearch]': 'searchDexFormat',
		'click .dexformatpage .utilichart a[data-entry]': 'clickDexFormatEntry',
		'change input[name=formatname]': 'renameDexFormat',
		'change input[name=dexRuleValue]': 'changeDexRuleValue'
	});

})(window.jQuery);
