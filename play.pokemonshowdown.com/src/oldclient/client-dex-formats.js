(function ($) {

	var request = window.DexViews.ui.request;
	var viewSearch = window.DexViews.ui.viewSearch;
	var dropEmptyHeaders = window.DexViews.ui.dropEmptyHeaders;
	var setTierStyle = window.DexViews.ui.setTierStyle;

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
			request('dexformat', this.dexFormatTarget(formatid)).then(function (details) {
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
				settings[toID(spec.replace(/^!/, ''))] = spec.charAt(0) === '!' ? 'off' : 'on';
			}
			var buf = '<div class="pad" style="padding-top:0">';
			buf += '<p><label class="label">Format:</label><button class="select formatselect" name="selectDexFormat" value="' + BattleLog.escapeHTML(details.id) + '">' + BattleLog.escapeFormat(details.id) + '</button></p>';
			buf += '<div class="formatsettings"><p>';
			buf += '<label class="label">Dex: <strong>' + BattleLog.escapeHTML(details.dex) + '</strong></label> ';
			buf += '<label class="label">Mod: <strong>' + BattleLog.escapeHTML(details.mod) + '</strong></label> ';
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
					bannedRows.unshift(['header', "Banned " + picker[2]]);
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
				if (query && !childBuf && !(rule.name + ' ' + (rule.desc || '')).toLowerCase().includes(query)) return '';
				var title = on ? (source ? "Required by " + source + (elsewhere ? ", highlighted there" : "") : elsewhere ? "On, highlighted at the top" : "On") :
					off ? "Off, switched off by this format" : "Off";
				return '<li><button type="button" class="button' + (on ? (elsewhere ? ' ruleelsewhere' : ' ruleon') : '') + '" title="' + BattleLog.escapeHTML(title) + '"' +
					(editable ? ' name="toggleDexRule" value="' + ruleid + '"' : '') + '>' +
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
		}
	});

})(window.jQuery);
