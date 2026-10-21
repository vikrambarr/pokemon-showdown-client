(function ($) {

	_.extend(this.User.prototype, {
		discordListening: false,
		discordRename: function () {
			var self = this;
			var origin = Config.testclient ? 'https://' + Config.routes.client : location.origin;
			if (!this.discordListening) {
				this.discordListening = true;
				window.addEventListener('message', function (event) {
					if (event.origin !== origin) return;
					if (!event.data || event.data.type !== 'discord-login') return;
					self.set('registered', {
						username: event.data.username,
						userid: toUserid(event.data.username)
					});
					self.finishRename(event.data.username, event.data.assertion);
				});
			}
			window.open(
				origin + '/api/discord/login?challstr=' + encodeURIComponent(this.challstr) +
				'&serverid=' + encodeURIComponent(Config.server.id),
				'ps-discord-login', 'popup=1,width=500,height=750'
			);
		},
		challengeOnlyRename: function () {
			var seed = Storage.prefs('challengeonly');
			if (!seed) {
				var bytes = new Uint8Array(16);
				window.crypto.getRandomValues(bytes);
				seed = Array.prototype.map.call(bytes, function (b) {
					return ('0' + b.toString(16)).slice(-2);
				}).join('');
				Storage.prefs('challengeonly', seed);
			}
			app.send('/challengeonly ' + seed);
		}
	});

	_.extend(LoginPopup.prototype, {
		discord: function () {
			this.close();
			app.user.discordRename();
		},
		challengeOnly: function () {
			this.close();
			app.user.challengeOnlyRename();
		}
	});

})(window.jQuery);
