(function ($) {

	var logout = this.User.prototype.logout;
	_.extend(this.User.prototype, {
		logout: function () {
			Storage.prefs('challengeonly', null);
			logout.call(this);
		},
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

	var updateOptions = OptionsPopup.prototype.update;
	OptionsPopup.prototype.update = function () {
		updateOptions.call(this);
		if (Config.discordlogin) this.$('button[name=changepassword], button[name=register]').parent().remove();
	};

	var initializeLogin = LoginPopup.prototype.initialize;
	_.extend(LoginPopup.prototype, {
		initialize: function (data) {
			initializeLogin.call(this, data);
			var $name = this.$('input[name=username]').closest('p');
			if (!Config.discordlogin || app.user.get('registered') || !$name.length) return;
			$name.nextAll().remove();
			$name.replaceWith(
				'<p>Log in with Discord to play on this server.</p>' +
				'<p class="buttonbar"><button type="button" name="discord" class="button"><strong>Discord login</strong></button> ' +
				'<button type="button" name="challengeOnly" class="button"><strong>Challenge-only</strong></button> ' +
				'<button type="button" name="close" class="button">Cancel</button></p>'
			);
		},
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
