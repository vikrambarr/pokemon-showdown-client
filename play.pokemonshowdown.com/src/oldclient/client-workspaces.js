(function ($) {

	var WORKSPACE_STATE = ['roomList', 'sideRoomList', 'curRoom', 'curSideRoom', 'sideRoom'];

	var baseApp = _.pick(this.App.prototype, ['initialize', '_addRoom', 'focusRoom', 'removeRoom', 'updateSideRoom', 'updateAutojoin']);
	var baseTopbar = _.pick(Topbar.prototype, ['renderRoomTab', 'updateTabbarMini', 'click']);
	var baseMainMenuRoom = _.pick(MainMenuRoom.prototype, ['initialize']);
	var baseTabListPopup = _.pick(TabListPopup.prototype, ['click']);

	var WORKSPACE_TABS = [['battle', 'gamepad', "Play"], ['create', 'wrench', "Create"]];

	function renderWorkspaceTabs(homeTab, mini) {
		var notifying = {};
		for (var id in app.rooms) {
			var room = app.rooms[id];
			if (room.workspace && room.notificationClass === ' notifying') notifying[room.workspace] = true;
		}
		return WORKSPACE_TABS.map(function (tab) {
			var label = '<i class="fa fa-' + tab[1] + '"></i> <span>' + tab[2] + '</span>';
			if (app.workspace === tab[0]) return homeTab.replace('<i class="fa fa-home"></i> <span>Home</span>', label);
			if (mini) return '';
			return '<li><a class="button' + (notifying[tab[0]] ? ' notifying' : '') + '" href="' + app.root + '" data-switchto="' + tab[0] + '">' +
				label + '</a></li>';
		}).join('');
	}

	function clickWorkspaceTab(e) {
		var workspace = $(e.currentTarget).attr('data-switchto');
		if (!workspace) return false;
		e.preventDefault();
		e.stopPropagation();
		app.switchWorkspace(workspace);
		app.curRoom.focus();
		return true;
	}

	_.extend(this.App.prototype, {
		workspace: 'battle',
		savedCreateRooms: [],
		initialize: function () {
			var self = this;
			if (/[?&]workspace=create(&|$)/.test(location.search)) this.workspace = 'create';
			this.workspaces = {};
			this.workspaces[this.workspace === 'create' ? 'battle' : 'create'] = {
				roomList: [], sideRoomList: [], curRoom: null, curSideRoom: null, sideRoom: null
			};
			Storage.whenPrefsLoaded(function () {
				self.savedCreateRooms = ((Dex.prefs('createrooms') || {})[Config.server.id] || '').split(',');
			});
			baseApp.initialize.apply(this, arguments);
			Storage.whenPrefsLoaded(function () {
				self.savedCreateRooms = [];
			});
			$(document).one('mousedown keydown', function () {
				self.userActed = true;
			});
		},
		switchWorkspace: function (workspace, id) {
			if (workspace === this.workspace) return;
			if (this.curRoom) this.curRoom.hide();
			if (this.curSideRoom) this.curSideRoom.hide();
			this.workspaces[this.workspace] = _.pick(this, WORKSPACE_STATE);
			_.extend(this, this.workspaces[workspace]);
			this.workspace = workspace;
			$('[data-workspace]').hide().filter('[data-workspace="' + workspace + '"]').show();
			if (!this.curRoom) this.curRoom = this.rooms[''];
			if (!this.sideRoom) this.updateSideRoom();
			window.room = this.curRoom;
			this.updateLayout();
			if (!this.rooms[id]) id = this.curRoom.id;
			this.fragment = id;
			this.navigate(id);
			this.updateTitle(this.rooms[id]);
		},
		_addRoom: function (id, type, nojoin) {
			var oldRoom = this.rooms[id];
			var workspace = this.workspace;
			if (oldRoom) {
				workspace = oldRoom.workspace;
			} else if (id === '' || id === 'rooms') {
				workspace = '';
			} else if (this.savedCreateRooms.indexOf(id) >= 0) {
				workspace = 'create';
			} else if (nojoin && !this.userActed) {
				workspace = 'battle';
			}
			var active = workspace && workspace !== this.workspace && _.pick(this, WORKSPACE_STATE);
			if (active) _.extend(this, this.workspaces[workspace]);
			var room = baseApp._addRoom.apply(this, arguments);
			if (active) {
				this.workspaces[workspace] = _.pick(this, WORKSPACE_STATE);
				_.extend(this, active);
			}
			room.workspace = workspace;
			return room;
		},
		focusRoom: function (id) {
			var room = this.rooms[id];
			if (room && room.workspace && room.workspace !== this.workspace) {
				if (!this.userActed && id !== this.initialFragment) return false;
				this.switchWorkspace(room.workspace, id);
			}
			return baseApp.focusRoom.apply(this, arguments);
		},
		removeRoom: function (id, alreadyLeft) {
			var room = this.rooms[id];
			if (!room || !room.workspace || room.workspace === this.workspace) return baseApp.removeRoom.apply(this, arguments);
			var state = this.workspaces[room.workspace];
			delete this.rooms[id];
			var index = state.roomList.indexOf(room);
			if (index >= 0) state.roomList.splice(index, 1);
			index = state.sideRoomList.indexOf(room);
			if (index >= 0) state.sideRoomList.splice(index, 1);
			if (state.curRoom === room) state.curRoom = this.rooms[''];
			if (state.sideRoom === room || state.curSideRoom === room) state.sideRoom = state.curSideRoom = null;
			room.destroy(alreadyLeft);
			this.topbar.updateTabbar();
			return true;
		},
		updateSideRoom: function (id) {
			baseApp.updateSideRoom.apply(this, arguments);
			if (!this.sideRoom || !this.sideRoom.workspace || this.sideRoom.workspace === this.workspace) return;
			this.sideRoom = null;
			for (var i in this.rooms) {
				var room = this.rooms[i];
				if (room.isSideRoom && (!room.workspace || room.workspace === this.workspace)) this.sideRoom = room;
			}
		},
		updateAutojoin: function () {
			var active = _.pick(this, WORKSPACE_STATE);
			var hidden = this.workspaces[this.workspace === 'create' ? 'battle' : 'create'];
			this.roomList = active.roomList.concat(active.sideRoomList, hidden.roomList);
			this.sideRoomList = hidden.sideRoomList;
			baseApp.updateAutojoin.apply(this, arguments);
			_.extend(this, active);
			if (!Config.server.registered) return;

			var create = this.workspace === 'create' ? active : hidden;
			var rooms = create.roomList.concat(create.sideRoomList);
			var createRooms = [];
			for (var i = 0; i < rooms.length; i++) {
				if (rooms[i].type === 'chat') createRooms.push(rooms[i].id);
			}
			var saved = Dex.prefs('createrooms') || {};
			if ((saved[Config.server.id] || '') === createRooms.join(',')) return;
			saved[Config.server.id] = createRooms.join(',');
			Storage.prefs('createrooms', saved);
		}
	});

	_.extend(Topbar.prototype, {
		renderRoomTab: function (room) {
			if (room && room.workspace && room.workspace !== app.workspace) return '';
			var buf = baseTopbar.renderRoomTab.apply(this, arguments);
			if (room !== app.rooms['']) return buf;
			return renderWorkspaceTabs(buf, this.mini) + (this.mini ? '' : '</ul><ul>');
		},
		updateTabbarMini: function () {
			this.mini = true;
			baseTopbar.updateTabbarMini.apply(this, arguments);
			this.mini = false;
		},
		click: function (e) {
			if (!clickWorkspaceTab(e)) baseTopbar.click.apply(this, arguments);
		}
	});

	_.extend(TabListPopup.prototype, {
		click: function (e) {
			if (!clickWorkspaceTab(e)) return baseTabListPopup.click.apply(this, arguments);
			this.close();
		}
	});

	_.extend(MainMenuRoom.prototype, {
		initialize: function () {
			baseMainMenuRoom.initialize.apply(this, arguments);
			var buf = '<div class="menugroup"><form class="battleform">';
			buf += '<p><label class="label">Format:</label>' + this.renderFormats() + '</p>';
			buf += '<p><label class="label">Team:</label>' + this.renderTeams() + '</p>';
			buf += '<p style="margin-top:94px"><button class="button mainmenu1 big" name="openDexBuilder"><strong>Create!</strong><br /><small>Make and edit your dexes</small></button></p></form></div>';
			this.$('.mainmenu').attr('data-workspace', 'battle').after('<div class="createmenu" data-workspace="create" style="padding-bottom:51px">' + buf + '</div>');
			var $join = this.$('.rightmenu .menugroup').attr('data-workspace', 'battle');
			$join.clone().attr('data-workspace', 'create').insertAfter($join).find('button').text("Dex search").val('rooms');
			this.$('[data-workspace]').hide().filter('[data-workspace="' + app.workspace + '"]').show();
		},
		openDexBuilder: function () {
			app.joinRoom('dexbuilder', DexBuilderRoom);
		}
	});

})(window.jQuery);
