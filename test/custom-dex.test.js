const assert = require('assert').strict;
const {describe, it, after, beforeEach} = require('node:test');

const shim = require('./custom-dex-shim.js');
const {sent, alerts, joined, CustomDex, PS} = shim.load();

/** The overlay a server that already holds one Pokemon and one format answers a write with. */
const loaded = () => shim.overlay([{name: 'Testmon'}], [{name: 'Custom OU'}]);

/** A write only ends when its `|queryresponse|` arrives; nothing else clears the queue. */
const answer = (response = loaded()) => CustomDex.receiveWrite({name: 'Testmon', overlay: response});

describe('CustomDex', () => {
	beforeEach(shim.reset);
	after(shim.reset);

	it('should ask the server for the overlay', () => {
		CustomDex.load(true);
		assert.deepEqual(sent, ['/cmd customdex']);
		CustomDex.receive(loaded());
		assert.equal(CustomDex.error, null);
	});

	it('should put the overlay into the tables the teambuilder reads', () => {
		CustomDex.receive(loaded());
		assert.equal(BattlePokedex.testmon.name, 'Testmon');
		assert.equal(BattlePokedex.testmon.tier, 'Custom');
		assert(BattleTeambuilderTable.learnsets.testmon.tackle, `the teambuilder can't offer its moves`);
		assert.equal(Dex.species.get('Testmon').exists, true);
		assert.deepEqual(CustomDex.ids, ['testmon']);
	});

	it('should offer the custom format under the id a team file stores', () => {
		CustomDex.receive(loaded());
		assert(BattleFormats.customuitestercustomou);
		assert.equal(CustomDex.formatEntry('customuitestercustomou').id, 'custom-uitester-customou');
		assert.equal(CustomDex.baseFormat('customuitestercustomou'), 'gen9ou');
	});

	it('should send the Pokemon the pokebuilder creates', () => {
		CustomDex.receive(loaded());
		void CustomDex.create('Newmon');
		assert.deepEqual(sent, [
			`/cmd custompokemon create {"name":"Newmon","types":["Normal"],"abilities":{"0":"Levitate"},` +
			`"baseStats":{"hp":80,"atk":80,"def":80,"spa":80,"spd":80,"spe":80},"eggGroups":["Field"],"weightkg":10}`,
		]);
		answer();
	});

	it('should send an edit only for a Pokemon that changed', () => {
		CustomDex.receive(loaded());
		assert(!CustomDex.isDirty('testmon'));
		CustomDex.flush('testmon');
		assert.deepEqual(sent, []);

		CustomDex.patch('testmon', {types: ['Fire']});
		assert(CustomDex.isDirty('testmon'));
		CustomDex.flush('testmon');
		assert.equal(sent.length, 1);
		assert.match(sent[0], /^\/cmd custompokemon edit Testmon, \{/);
		assert.deepEqual(JSON.parse(sent[0].slice(sent[0].indexOf('{'))).types, ['Fire']);
	});

	it('should count an edit as saved once the server answers', () => {
		CustomDex.receive(loaded());
		CustomDex.patch('testmon', {types: ['Fire']});
		CustomDex.flush('testmon');
		answer(shim.overlay([{name: 'Testmon', types: ['Fire']}], [{name: 'Custom OU'}]));
		assert(!CustomDex.isDirty('testmon'));
	});

	it('should carry an unsaved edit across the overlay another write answers with', () => {
		CustomDex.receive(loaded());
		CustomDex.patch('testmon', {types: ['Fire']});
		void CustomDex.createFormat('Second', '[Gen 9] OU');
		answer();
		assert.deepEqual(CustomDex.pokedex().testmon.types, ['Fire'], `the edit was thrown away`);
		assert(CustomDex.isDirty('testmon'));
	});

	it('should send the format the formatbuilder creates', () => {
		CustomDex.receive(loaded());
		void CustomDex.createFormat('My Format', '[Gen 9] OU');
		assert.deepEqual(sent, ['/cmd customformat create {"name":"My Format","base":"[Gen 9] OU"}']);
		answer();
	});

	it('should send a roster change as an edit of the format', () => {
		CustomDex.receive(loaded());
		const changes = {banlist: ['tag:custom'], unbanlist: []};
		CustomDex.patchFormat('custom-uitester-customou', changes);
		assert.deepEqual(CustomDex.formatEntry('customuitestercustomou').banlist, ['tag:custom']);
		void CustomDex.editFormat('Custom OU', changes);
		assert.deepEqual(sent, ['/cmd customformat edit Custom OU, {"banlist":["tag:custom"],"unbanlist":[]}']);
		answer();
	});

	it('should keep one write in flight at a time', () => {
		CustomDex.receive(loaded());
		void CustomDex.createFormat('First', '[Gen 9] OU');
		void CustomDex.createFormat('Second', '[Gen 9] OU');
		assert.equal(sent.length, 1, `both writes went out at once`);
		answer();
		assert.equal(sent.length, 2);
		assert.match(sent[1], /"name":"Second"/);
		answer();
	});

	it('should read an exported Pokemon back', () => {
		CustomDex.receive(loaded());
		CustomDex.patch('testmon', {weightkg: 12.5, heightm: 1.2});
		const parsed = parseSpecies(exportSpecies('testmon'));
		assert.equal(typeof parsed, 'object', `${parsed}`);
		assert.equal(parsed.name, 'Testmon');
		assert.equal(parsed.fields.weightkg, 12.5);
		assert.equal(parsed.fields.heightm, 1.2);
		assert.deepEqual(parsed.moves, ['Tackle']);
	});

	it('should read a whole exported list back', () => {
		CustomDex.receive(shim.overlay([{name: 'Testmon'}, {name: 'Othermon'}], []));
		const parsed = parseSpeciesList(exportSpeciesList());
		assert.deepEqual(parsed.map(entry => entry.name).sort(), ['Othermon', 'Testmon']);
	});

	it(`should apply another owner's species for their format`, () => {
		CustomDex.receive(loaded());
		const entry = shim.listing('other', 'Shared OU');
		assert.equal(CustomDex.adoptFormat(entry), 'customothersharedou');
		assert(BattleFormats.customothersharedou, `not offered in a selector`);

		sent.length = 0;
		CustomDex.loadFormatDex('customothersharedou');
		assert.deepEqual(sent, ['/cmd customformatdex Custom (other) Shared OU']);
		CustomDex.receiveFormatDex(shim.formatDex(entry.id, [{name: 'Sharedmon'}]));
		assert.equal(BattlePokedex.sharedmon.name, 'Sharedmon');
		assert(BattleTeambuilderTable.learnsets.sharedmon.tackle, `the builder can't offer its moves`);
		assert.equal(Dex.species.get('Sharedmon').exists, true);
		assert.deepEqual(CustomDex.formatDexes.customothersharedou, ['sharedmon']);
	});

	it('should ask for no dex of a format we own', () => {
		CustomDex.receive(loaded());
		sent.length = 0;
		CustomDex.loadFormatDex('customuitestercustomou');
		assert.deepEqual(sent, []);
	});

	it(`should take another owner's species back out on logout`, () => {
		CustomDex.receive(loaded());
		const entry = shim.listing('other', 'Shared OU');
		CustomDex.adoptFormat(entry);
		CustomDex.loadFormatDex('customothersharedou');
		CustomDex.receiveFormatDex(shim.formatDex(entry.id, [{name: 'Sharedmon'}]));
		CustomDex.clear();
		assert.equal(BattlePokedex.sharedmon, undefined);
		assert.equal(BattleFormats.customothersharedou, undefined);
		assert.deepEqual(CustomDex.formatDexes, {});
	});

	it('should re-learn the formats our saved teams name', () => {
		PS.teams.list = [{format: 'customothersharedou', name: 'Team', packedTeam: ''}];
		try {
			CustomDex.receive(loaded());
			assert.deepEqual(sent.slice(-1), ['/cmd customformatinfo customothersharedou']);
			CustomDex.receiveFormatInfo(shim.listing('other', 'Shared OU'));
			// Without this a saved team shows the id its format collapsed to, not its name.
			assert.equal(CustomDex.formatEntry('customothersharedou').name, 'Shared OU');
		} finally {
			PS.teams.list = [];
		}
	});

	it(`should open a team in the format the directory's button names`, () => {
		CustomDex.receive(loaded());
		CustomDex.receiveFormatBuild(shim.listing('other', 'Shared OU', {password: 'hunter2'}));
		assert.equal(PS.teams.list[0].format, 'customothersharedou');
		assert.deepEqual(joined, [`team-${PS.teams.list[0].key}`]);
		// The password stays with it: the roster and the dex are gated on it too.
		CustomDex.loadFormatDex('customothersharedou');
		assert.deepEqual(sent.slice(-1), ['/cmd customformatdex Custom (other) Shared OU, hunter2']);
	});

	it('should preview an unsaved format edit instead of storing it', () => {
		CustomDex.receive(loaded());
		CustomDex.loadFormatDraft('custom-uitester-customou', {ruleset: ['Sleep Clause Mod']}, true);
		assert.deepEqual(sent, [
			'/cmd customformatdraft Custom OU, default, {"ruleset":["Sleep Clause Mod"]}',
		]);
	});

	it('should hand a refused preview back to the room that asked for it', () => {
		CustomDex.receive(loaded());
		CustomDex.receiveFormatLegal({actionerror: `Those rules don't work together.`});
		assert.equal(CustomDex.draftError, `Those rules don't work together.`);
		assert.deepEqual(alerts, [], `a preview is the room's to undo, not an alert of its own`);
	});

	it('should rename a format as an edit of its name', () => {
		CustomDex.receive(loaded());
		void CustomDex.editFormat('Custom OU', {name: 'Custom UU'});
		assert.deepEqual(sent, ['/cmd customformat edit Custom OU, {"name":"Custom UU"}']);
		answer();
	});

	it('should report the reason the server refused a write', () => {
		CustomDex.receive(loaded());
		void CustomDex.create('Testmon');
		CustomDex.receiveWrite({actionerror: `You already have a custom Pokemon named "Testmon".`});
		assert.deepEqual(alerts, [`You already have a custom Pokemon named "Testmon".`]);
		assert(sent.includes('/cmd customdex'));
	});
});
