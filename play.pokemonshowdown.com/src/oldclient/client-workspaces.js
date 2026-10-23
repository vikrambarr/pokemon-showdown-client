(function ($) {

	var WORKSPACE_STATE = ['roomList', 'sideRoomList', 'curRoom', 'curSideRoom', 'sideRoom'];

	var baseApp = _.pick(this.App.prototype, ['initialize', '_addRoom', 'focusRoom', 'removeRoom', 'updateSideRoom', 'updateAutojoin']);
	var baseTopbar = _.pick(Topbar.prototype, ['initialize', 'renderRoomTab', 'updateTabbar']);
	var baseMainMenuRoom = _.pick(MainMenuRoom.prototype, ['initialize']);

	_.extend(this.App.prototype, {
		workspace: 'battle',
		savedCreateRooms: [],
		initialize: function () {
			var self = this;
			this.workspaces = {
				create: { roomList: [], sideRoomList: [], curRoom: null, curSideRoom: null, sideRoom: null }
			};
			Storage.whenPrefsLoaded(function () {
				self.savedCreateRooms = ((Dex.prefs('createrooms') || {})[Config.server.id] || '').split(',');
			});
			baseApp.initialize.apply(this, arguments);
			Storage.whenPrefsLoaded(function () {
				self.savedCreateRooms = [];
			});
		},
		switchWorkspace: function (workspace, id) {
			if (workspace === this.workspace) return;
			if (this.curRoom) this.curRoom.hide();
			if (this.curSideRoom) this.curSideRoom.hide();
			this.workspaces[this.workspace] = _.pick(this, WORKSPACE_STATE);
			_.extend(this, this.workspaces[workspace]);
			this.workspace = workspace;
			this.rooms[''].$('[data-workspace]').hide().filter('[data-workspace="' + workspace + '"]').show();
			if (!this.curRoom) this.curRoom = this.rooms[''];
			if (!this.sideRoom) this.updateSideRoom();
			window.room = this.curRoom;
			this.updateLayout();
			if (!this.rooms[id]) id = this.curRoom.id;
			this.fragment = id;
			this.navigate(id);
			this.updateTitle(this.rooms[id]);
		},
		_addRoom: function (id) {
			var oldRoom = this.rooms[id];
			var workspace = this.workspace;
			if (oldRoom) {
				workspace = oldRoom.workspace;
			} else if (id === '' || id === 'rooms') {
				workspace = '';
			} else if (this.savedCreateRooms.indexOf(id) >= 0) {
				workspace = 'create';
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
			if (room && room.workspace && room.workspace !== this.workspace) this.switchWorkspace(room.workspace, id);
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
		initialize: function () {
			baseTopbar.initialize.apply(this, arguments);
			this.$('.logo').removeClass('logo').wrap('<button class="logo" name="switchWorkspace" style="padding:0;border:0;background:none;line-height:0;cursor:pointer"></button>');
			this.updateTabbar();
		},
		renderRoomTab: function (room) {
			if (room && room.workspace && room.workspace !== app.workspace) return '';
			return baseTopbar.renderRoomTab.apply(this, arguments);
		},
		updateTabbar: function () {
			baseTopbar.updateTabbar.apply(this, arguments);
			var notifying = false;
			for (var id in app.rooms) {
				var room = app.rooms[id];
				if (room.workspace && room.workspace !== app.workspace && room.notificationClass === ' notifying') notifying = true;
			}
			this.$('button.logo').attr('title', app.workspace === 'create' ? "Go to the battle page" : "Go to the creation page").css('filter', notifying ? 'drop-shadow(0 0 6px #ffcc00)' : '');
		},
		switchWorkspace: function () {
			app.switchWorkspace(app.workspace === 'create' ? 'battle' : 'create');
			app.curRoom.focus();
		}
	});

	_.extend(MainMenuRoom.prototype, {
		initialize: function () {
			baseMainMenuRoom.initialize.apply(this, arguments);
			this.$('.mainmenu').attr('data-workspace', 'battle').after('<div class="createmenu" data-workspace="create" style="display:none;padding-bottom:51px"><div class="menugroup"><p><strong>Create</strong></p><p>Custom dexes and formats will be made here.</p></div></div>');
		}
	});

})(window.jQuery);
