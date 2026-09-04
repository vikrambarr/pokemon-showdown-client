/** Enough of a browser and of PS for client-custom-dex.js to run under node. */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SOURCES = [
	'battle-dex-data.js', 'battle-dex.js', 'battle-teams.js', 'battle-dex-search.js',
	'client-core.js', 'client-custom-dex.js',
];

/** The one ability and move the tests build with, and the two types. */
const ABILITIES = {levitate: {name: "Levitate", rating: 3, num: 26}};
const MOVEDEX = {tackle: {name: "Tackle", type: 'Normal', category: 'Physical', basePower: 40, pp: 35, num: 33}};
const TYPECHART = {normal: {damageTaken: {}}, steel: {damageTaken: {}}};

/** The one method of each panel class client-custom-dex.js replaces. */
const PATCHED = [['MainMenuRoom', 'parseFormats'], ['ChatRoom', 'parseChallenge'], ['TeamEditorState', 'setFormat']];

const element = () => ({
	style: {}, dataset: {}, children: [],
	classList: {add() {}, remove() {}, contains: () => false},
	appendChild() {}, setAttribute() {}, addEventListener() {},
	querySelector: () => null, querySelectorAll: () => [], getElementsByTagName: () => [],
});

const location = {
	href: 'https://play.pokemonshowdown.com/', protocol: 'https:', pathname: '/', hash: '', search: '',
	host: 'play.pokemonshowdown.com', hostname: 'play.pokemonshowdown.com',
};

let loaded = null;

/** The sent-command log and the globals the tests drive. */
exports.load = function () {
	if (loaded) return loaded;

	global.window = global;
	global.location = location;
	global.navigator = {userAgent: 'node'};
	global.localStorage = {getItem: () => null, setItem() {}, removeItem() {}};
	global.addEventListener = () => {};
	global.document = {
		location, cookie: '', body: element(), head: element(), documentElement: element(),
		createElement: element, createTextNode: element, getElementById: () => null,
		querySelector: () => null, querySelectorAll: () => [], addEventListener() {},
	};

	const root = path.resolve(__dirname, '..');
	const run = file => vm.runInThisContext(fs.readFileSync(file, 'utf8'), {filename: file});
	run(path.join(root, 'config/config.js'));
	Config.routes = require(path.join(root, 'config/routes.json'));

	const sent = [];
	const alerts = [];
	const joined = [];
	global.PS = {
		send: message => void sent.push(message),
		alert: message => void alerts.push(message),
		join: roomid => void joined.push(roomid),
		user: {userid: 'uitester', named: true, subscribe() {}},
		prefs: {}, rooms: {},
		teams: {
			list: [], update() {},
			unshift(team) {
				team.key = `${this.list.length + 1}`;
				this.list.unshift(team);
			},
			save() {},
		},
		receive() {}, addRoom() {}, update() {},
	};
	global.BattleTeambuilderTable = {learnsets: {}, gen9: {}};
	global.BattleFormats = {};
	global.BattlePokedex = {};
	global.BattleAbilities = ABILITIES;
	global.BattleMovedex = MOVEDEX;
	global.BattleItems = {};
	global.BattleTypeChart = TYPECHART;
	for (const [name, method] of PATCHED) {
		global[name] = function () {};
		global[name].prototype[method] = function () {};
	}

	for (const source of SOURCES) run(path.join(root, 'play.pokemonshowdown.com/js', source));

	loaded = {sent, alerts, joined, PS, CustomDex, Dex};
	return loaded;
};

/** Back to nothing loaded, timeouts included. */
exports.reset = function () {
	if (loaded.CustomDex.writeTimer) clearTimeout(loaded.CustomDex.writeTimer);
	loaded.CustomDex.writeTimer = null;
	loaded.CustomDex.clear();
	loaded.sent.length = loaded.alerts.length = loaded.joined.length = 0;
	loaded.PS.teams.list.length = 0;
};

/** A directory row, as `formatBuild` sends one: someone else's format. */
exports.listing = function (owner, name, extra = {}) {
	return {
		id: `custom-${owner}-${toID(name)}`, name, owner, mod: '', baseMod: 'gen9', base: '[Gen 9] OU',
		notes: '', views: 0, updated: new Date().toISOString(), ...extra,
	};
};

/** A `customformatdex` answer: the species another owner's format is built with. */
exports.formatDex = function (id, species = []) {
	const overlay = exports.overlay(species);
	return {
		id, Pokedex: overlay.Pokedex, Learnsets: overlay.Learnsets,
		FormatsData: overlay.FormatsData, sprites: {},
	};
};

/** An overlay in the shape `server/custom/dex.ts`'s `toOverlay` sends. */
exports.overlay = function (species = [], formats = []) {
	const overlay = {
		Pokedex: {}, Learnsets: {}, FormatsData: {}, sprites: {},
		entries: [], formats: [], limits: {}, rulesets: [], tags: [], mods: [],
	};
	for (const entry of species) {
		const id = toID(entry.name);
		overlay.Pokedex[id] = {
			name: entry.name, types: entry.types || ['Steel'], abilities: {0: 'Levitate'},
			baseStats: {hp: 80, atk: 80, def: 80, spa: 80, spd: 80, spe: 80},
			eggGroups: ['Field'], weightkg: 10, num: -100001, isNonstandard: 'Custom',
		};
		overlay.Learnsets[id] = {learnset: entry.learnset || {tackle: ['9M']}};
		overlay.FormatsData[id] = {isNonstandard: 'Custom', tier: 'Custom'};
		overlay.entries.push({
			name: entry.name, inheritsFrom: null,
			species: overlay.Pokedex[id], learnset: overlay.Learnsets[id].learnset,
		});
	}
	for (const entry of formats) {
		overlay.formats.push({
			id: `custom-uitester-${toID(entry.name)}`, name: entry.name, owner: 'uitester',
			base: entry.base || '[Gen 9] OU', ruleset: [], banlist: [], unbanlist: [],
		});
	}
	return overlay;
};
