/**
 * Client-side custom dex
 *
 * @license AGPLv3
 */

import { PS } from "./client-main";
import { PSModel } from "./client-core";
import { Dex, toID, type ID } from "./battle-dex";
import { DexSearch, type SearchRow, type SearchType } from "./battle-dex-search";
import { MainMenuRoom } from "./panel-mainmenu";
import { ChatRoom } from "./panel-chat";
import { TeamEditorState } from "./battle-team-editor";

declare const BattleTeambuilderTable: any;

export type CustomSpriteSet = { [kind: string]: string };

/** The four lists a format's rules decide, and that the builder edits with a picker each. */
export const ROSTER_KINDS = ['pokemon', 'move', 'ability', 'item'] as const;
export type RosterKind = typeof ROSTER_KINDS[number];
export type Roster = { [kind in RosterKind]: ID[] };
export type FormatBans = { tags: { [tagid: string]: string }, other: string[] };

export function emptyRoster(): Roster {
	return { pokemon: [], move: [], ability: [], item: [] };
}
function toRoster(data: AnyObject | undefined): Roster {
	const roster = emptyRoster();
	for (const kind of ROSTER_KINDS) roster[kind] = (data?.[kind] || []).map(toID);
	return roster;
}

type CustomDexWrite = {
	command: string, id: ID, json?: string, resolve?: (name: string | null) => void,
	/** The CRQ to send it to; formats and species share this queue so they stay ordered. */
	cmd?: string,
};

/** As much of a custom format as a selector needs: what it's called, and what it's built on. */
export interface CustomFormatSummary {
	id: string;
	name: string;
	mod: string;
	baseMod: string;
	base: string;
}

export interface CustomDexOverlay {
	Pokedex: { [id: string]: AnyObject };
	Learnsets: { [id: string]: { learnset?: { [moveid: string]: string[] } } };
	sprites: { [id: string]: CustomSpriteSet };
	limits?: { [field: string]: FieldLimit };
	entries?: { name: string, inheritsFrom: string | null, species: AnyObject, learnset: AnyObject }[];
	formats?: (CustomFormatSummary & { ruleset: string[], banlist: string[], unbanlist: string[] })[];
	/** Sent with the overlay: what the format builder may offer, straight from the sim. */
	rulesets?: { id: ID, name: string, desc?: string }[];
	tags?: { id: ID, name: string, kind: string }[];
	mods?: string[];
}

export interface FieldLimit { min?: number; max?: number; maxLength?: number }

/**
 * The name a custom format plays under, matching the server's own, so that `toID` of it is the id
 * the server registers it by: a selector can offer the name and a challenge resolves it.
 */
/** Which folder a team sorts into. A custom format's id has no gen in it, so they share one. */
export function formatFolder(format: string) {
	return format.startsWith('custom') ? 'custom' : format.slice(0, 4);
}
/** How a format id reads in a team list: a custom format's is its owner and a slug, so it goes by
 * the name it was given instead. */
export function formatText(format: string) {
	return CustomDex.formatEntry(format)?.name || format;
}
/** The heading a list of format folders groups them under. */
export function formatFolderName(folder: string) {
	return folder === 'custom' ? 'Custom' : `Gen ${folder.slice(3)}`;
}
/** The same, without the folder that the list is already showing. */
export function formatBasename(format: string) {
	const text = formatText(format);
	return text === format ? format.slice(formatFolder(format).length) : text;
}

export function formatTitle(entry: { id: string, name: string }) {
	return `Custom (${entry.id.split('-')[1]}) ${entry.name}`;
}

/** Both spellings the server accepts: the id a challenge carries, and the name a selector offers. */
const CUSTOM_FORMAT_NAME = /^custom(?:-[a-z0-9]+-|\s\([a-z0-9]+\)\s)/i;

const ALL_SOURCE_CHARS = '123456789pqga';
const LOAD_TIMEOUT = 20000;
const REQUIRED_FIELDS = ['types', 'abilities', 'baseStats', 'eggGroups', 'weightkg'];

export const CustomDex = new class extends PSModel {
	overlay: CustomDexOverlay | null = null;
	loadedFor: ID | null = null;
	loading = false;
	error: string | null = null;
	sprites: { [id: string]: CustomSpriteSet } = {};
	/** Sent with the overlay, straight from the validator, so both ends agree. */
	limits: { [field: string]: FieldLimit } = {};
	ids: ID[] = [];
	baseOf: { [id: string]: ID } = {};
	/**
	 * Each entry as its owner wrote it: overrides only. `Pokedex` holds the *resolved* species
	 * (base + overrides), so saving that back would freeze everything a variant inherits.
	 */
	raw: { [id: string]: { species: AnyObject, learnset: AnyObject, inheritsFrom: string | null } } = {};
	/** Bumped whenever the overlay object is replaced, so derived caches can tell. */
	revision = 0;
	requestedFor: ID | null = null;
	loadTimer: ReturnType<typeof setTimeout> | null = null;
	saved: { [id: string]: string } = {};
	/** What each custom format currently allows, keyed by format id, straight from its rule table. */
	formatLegal: { [formatid: string]: Roster } = {};
	/** The same, with everything the pickers wrote dropped: what "reset" goes back to. */
	formatDefaultLegal: { [formatid: string]: Roster } = {};
	/** The named rulesets each custom format resolves to, base format included. */
	formatRules: { [formatid: string]: ID[] } = {};
	/** The roster request in flight, so the two mount paths asking at once only cost one. */
	legalPending: ID | null = null;
	/** Of those, the ones the format can't switch off, mapped to the reason it can't. */
	formatLockedRules: { [formatid: string]: { [ruleid: string]: string } } = {};
	/** The tags the format bans, and whatever else in its lists no picker or chip covers. */
	formatBans: { [formatid: string]: FormatBans } = {};
	queue: CustomDexWrite[] = [];
	pending: CustomDexWrite | null = null;

	/** Every format a selector may offer, keyed by the id everything outside the builder uses. */
	formatsById: { [formatid: string]: CustomFormatSummary } = {};
	/** Other users' formats, learned from a challenge, so a team can be built for one. */
	foreignFormats: { [formatid: string]: CustomFormatSummary } = {};
	askedFormats: { [formatid: string]: boolean } = {};
	/** The custom species each open battle is using, so leaving one takes its own back out. */
	battleDexes: { [roomid: string]: ID[] } = {};
	/** Art for species that aren't the user's own, looked up the same way theirs is. */
	battleSprites: { [id: string]: CustomSpriteSet } = {};

	has(id: ID) {
		return !!this.overlay?.Pokedex[id];
	}
	formatEntry(format: string | undefined) {
		return this.formatsById[toID(format)] || null;
	}
	/** A custom format's own id says nothing about gen or mod, so its base format's stands in. */
	baseFormat(format: string) {
		const entry = this.formatEntry(format);
		if (!entry) return toID(format);
		return toID(entry.base) || toID(`${entry.mod || entry.baseMod}customgame`);
	}
	/**
	 * Custom formats are kept out of the format list the server sends - every connection pays for
	 * that one - so the user's own are added here instead, where every format selector reads them.
	 */
	registerFormats() {
		for (const id in this.formatsById) delete window.BattleFormats?.[id];
		this.formatsById = {};
		const entries = [...this.overlay?.formats || [], ...Object.values(this.foreignFormats)];
		for (const entry of entries) {
			const name = formatTitle(entry);
			const id = toID(name);
			if (this.formatsById[id]) continue;
			this.formatsById[id] = entry;
			if (!window.BattleFormats) continue;
			window.BattleFormats[id] = {
				id, name, section: 'Custom Formats', column: 0,
				// Never rated, so there's no ladder to search and no tournament to run.
				searchShow: false, challengeShow: true, tournamentShow: false,
				rated: false, isTeambuilderFormat: true, effectType: 'Format',
			};
		}
		PS.teams.update('format');
	}
	/**
	 * Picks up a custom format the user doesn't own, named in full the way a challenge names it,
	 * so that the format they've been challenged to can be built for like any other.
	 */
	learnFormat(format: string | undefined) {
		const id = toID(format);
		if (!id || !format || this.formatsById[id] || this.askedFormats[id]) return;
		if (!CUSTOM_FORMAT_NAME.test(format.trim())) return;
		this.askedFormats[id] = true;
		PS.send(`/cmd customformatinfo ${format.trim()}`);
	}
	receiveFormatInfo(response: AnyObject | null) {
		if (!response || response.actionerror || !response.id) return;
		this.foreignFormats[toID(response.id)] = response as CustomFormatSummary;
		this.registerFormats();
		this.update();
	}
	/**
	 * A battle's own dex. A client only ever holds its own user's custom Pokemon, so without this
	 * an opponent's - and any the format's author supplied - are species that don't exist.
	 */
	loadBattleDex(roomid: string) {
		if (!roomid.startsWith('battle-') || this.battleDexes[roomid]) return;
		if (!roomid.split('-')[1]?.startsWith('custom') || !PS.user.named) return;
		this.battleDexes[roomid] = [];
		PS.send(`/cmd battledex ${roomid}`);
	}
	receiveBattleDex(response: AnyObject | null) {
		if (!response || response.actionerror || !response.roomid) return;
		const ids: ID[] = [];
		for (const id in response.Pokedex) {
			// The user's own are already applied, with any edit they haven't saved yet on top.
			if (this.has(id as ID)) continue;
			ids.push(id as ID);
			window.BattlePokedex[id] ||= response.Pokedex[id];
			if (response.sprites?.[id]) this.battleSprites[id] ||= response.sprites[id];
			for (const mod of Object.values(Dex.moddedDexes)) delete mod.cache.Species[id];
		}
		this.battleDexes[response.roomid] = ids;
		this.update();
	}
	releaseBattleDex(roomid: string) {
		const ids = this.battleDexes[roomid];
		if (!ids) return;
		delete this.battleDexes[roomid];
		const stillOpen: { [id: string]: boolean } = {};
		for (const other in this.battleDexes) {
			for (const id of this.battleDexes[other]) stillOpen[id] = true;
		}
		for (const id of ids) {
			if (stillOpen[id]) continue;
			delete window.BattlePokedex[id];
			delete this.battleSprites[id];
			for (const mod of Object.values(Dex.moddedDexes)) delete mod.cache.Species[id];
		}
	}
	pokedex() {
		return this.overlay?.Pokedex || {};
	}
	requires(id: ID, field: string) {
		return !this.baseOf[id] && REQUIRED_FIELDS.includes(field);
	}
	load(force?: boolean) {
		if (!PS.user.named) {
			if (this.loadedFor) this.clear();
			return;
		}
		const userid = PS.user.userid;
		if (!force && (this.loading || this.loadedFor === userid)) return;

		this.loading = true;
		this.error = null;
		this.requestedFor = userid;
		if (this.loadTimer) clearTimeout(this.loadTimer);
		this.loadTimer = setTimeout(() => this.receive(null), LOAD_TIMEOUT);
		PS.send(`/cmd customdex`);
		this.update();
	}
	receive(overlay: CustomDexOverlay | null) {
		if (this.loadTimer) clearTimeout(this.loadTimer);
		this.loadTimer = null;
		this.loading = false;
		if (!overlay?.Pokedex) {
			this.error = `The server didn't send your custom Pokémon. Are you logged in?`;
		} else {
			this.error = null;
			this.limits = overlay.limits || {};
			this.apply(overlay);
			this.loadedFor = this.requestedFor || PS.user.userid;
		}
		this.update();
	}
	clear() {
		this.unapply(this.ids);
		if (this.loadTimer) clearTimeout(this.loadTimer);
		this.loadTimer = null;
		this.loadedFor = this.requestedFor = null;
		this.overlay = this.pending = null;
		this.loading = false;
		this.sprites = {};
		this.baseOf = {};
		this.saved = {};
		this.ids = [];
		this.queue = [];
		// Whose species a battle's belong to depends on who is asking, so they're asked for again.
		for (const roomid in this.battleDexes) this.releaseBattleDex(roomid);
		this.registerFormats();
		this.update();
	}
	unapply(ids: ID[]) {
		for (const id of ids) {
			delete window.BattlePokedex[id];
			delete BattleTeambuilderTable.learnsets[id];
			delete this.saved[id];
			for (const mod of Object.values(Dex.moddedDexes)) delete mod.cache.Species[id];
		}
	}
	apply(overlay: CustomDexOverlay) {
		// Any write refreshes the whole overlay, so edits the user hasn't saved yet — which may
		// belong to a Pokemon that had nothing to do with this write — have to be carried across.
		const pending: { [id: string]: { species: AnyObject, learnset: AnyObject, raw: AnyObject } } = {};
		for (const id of this.ids) {
			if (!overlay.Pokedex[id] || !this.isDirty(id)) continue;
			pending[id] = {
				species: this.overlay!.Pokedex[id],
				learnset: this.overlay!.Learnsets?.[id]?.learnset || {},
				raw: this.raw[id]?.species || {},
			};
		}

		this.unapply(this.ids.filter(id => !overlay.Pokedex[id]));
		this.overlay = overlay;
		this.revision++;
		this.sprites = overlay.sprites || {};

		this.baseOf = {};
		this.raw = {};
		for (const entry of overlay.entries || []) {
			const id = toID(entry.name);
			if (entry.inheritsFrom) this.baseOf[id] = toID(entry.inheritsFrom);
			this.raw[id] = {
				species: { ...entry.species }, learnset: { ...entry.learnset },
				inheritsFrom: entry.inheritsFrom || null,
			};
		}
		for (const id in pending) {
			overlay.Pokedex[id] = pending[id].species;
			if (overlay.Learnsets) overlay.Learnsets[id] = { learnset: pending[id].learnset };
			if (this.raw[id]) this.raw[id].species = pending[id].raw;
		}

		for (const id in overlay.Pokedex) {
			const data = overlay.Pokedex[id];
			const base = this.baseOf[id];
			window.BattlePokedex[id] = {
				...data,
				tier: data.tier || 'Custom',
				spriteid: data.spriteid || (base && Dex.species.get(base).spriteid) || undefined,
			};
			delete window.BattlePokedexAltForms?.[id];

			const moves: { [moveid: string]: string } = {};
			for (const moveid in overlay.Learnsets?.[id]?.learnset || {}) moves[moveid] = ALL_SOURCE_CHARS;
			BattleTeambuilderTable.learnsets[id] = moves;
		}
		for (const mod of Object.values(Dex.moddedDexes)) {
			for (const id in overlay.Pokedex) delete mod.cache.Species[id];
		}

		this.ids = Object.keys(overlay.Pokedex).sort((a, b) => (
			(overlay.Pokedex[a].name || a).localeCompare(overlay.Pokedex[b].name || b)
		)) as ID[];
		// Everything the server just sent us counts as saved; anything we carried over stays dirty.
		for (const id of this.ids) {
			if (!pending[id]) this.saved[id] = this.speciesJSON(id)!;
		}
		this.registerFormats();
		// A battle open before the overlay arrived asked as nobody, and got nothing back.
		for (const roomid in PS.rooms) this.loadBattleDex(roomid);
	}
	patch(id: ID, changes: AnyObject) {
		if (!this.overlay?.Pokedex[id]) return;
		if (changes.baseStats) {
			let bst = 0;
			for (const stat of Object.values(changes.baseStats as AnyObject)) bst += stat as number;
			changes = { ...changes, bst };
		}
		Object.assign(this.overlay.Pokedex[id], changes);
		Object.assign(window.BattlePokedex[id], changes);
		if (this.raw[id]) Object.assign(this.raw[id].species, changes);
		for (const mod of Object.values(Dex.moddedDexes)) delete mod.cache.Species[id];
		this.update();
	}
	/**
	 * Asks what the format's rules allow now. `changed` is what an edit sends: it always re-asks,
	 * where a request that only wants to be sure waits for the one already out. The default roster
	 * costs the server as much as the real one, so it's asked for only when we don't have it.
	 */
	loadFormatLegal(format: string, changed?: boolean) {
		const entry = this.formatEntry(format);
		// Asked for by full name: a format the asker doesn't own is only findable that way.
		const target = entry ? formatTitle(entry) : format;
		const id = toID(entry?.id || format);
		if (!changed && this.legalPending === id) return;
		this.legalPending = id;
		PS.send(`/cmd customformatlegal ${target}${this.formatDefaultLegal[id] ? '' : ', default'}`);
	}
	receiveFormatLegal(response: AnyObject | null) {
		this.legalPending = null;
		if (!response || response.actionerror || !response.name) return;
		const id = toID(response.id || response.name);
		this.formatLegal[id] = toRoster(response.legal);
		if (response.defaultLegal) this.formatDefaultLegal[id] = toRoster(response.defaultLegal);
		this.formatRules[id] = (response.rules || []).map(toID);
		this.formatLockedRules[id] = response.locked || {};
		this.formatBans[id] = response.bans || { tags: {}, other: [] };
		this.update();
	}
	/** Import can change what an entry inherits from; it lives outside the species overrides. */
	setInherits(id: ID, name: string | null) {
		if (this.raw[id]) this.raw[id].inheritsFrom = name;
	}
	learnset(id: ID): string[] {
		const learnset = this.overlay?.Learnsets?.[id]?.learnset;
		if (!learnset) return [];
		return Object.keys(learnset).map(moveid => Dex.moves.get(moveid).name).sort((a, b) => a.localeCompare(b));
	}
	setLearnset(id: ID, moves: string[]) {
		if (!this.overlay?.Pokedex[id]) return;
		if (!this.overlay.Learnsets) this.overlay.Learnsets = {};
		const max = this.limits.learnset?.max;
		if (max !== undefined && moves.length > max) {
			PS.alert(`A learnset can hold at most ${max} moves.`);
			moves = moves.slice(0, max);
		}
		const previous = this.overlay.Learnsets[id]?.learnset || {};
		const own = this.raw[id]?.learnset || {};
		const learnset: { [moveid: string]: string[] } = {};
		const ownNext: { [moveid: string]: string[] } = {};
		const table: { [moveid: string]: string } = {};
		for (const move of moves) {
			const moveid = toID(move);
			const sources = previous[moveid] || [`${Dex.gen}L1`];
			learnset[moveid] = sources;
			// A move that came from the inherited base stays inherited rather than becoming an override.
			if (own[moveid] || !(moveid in previous)) ownNext[moveid] = own[moveid] || sources;
			table[moveid] = ALL_SOURCE_CHARS;
		}
		this.overlay.Learnsets[id] = { learnset };
		if (this.raw[id]) this.raw[id].learnset = ownNext;
		BattleTeambuilderTable.learnsets[id] = table;
	}
	speciesJSON(id: ID) {
		if (!this.overlay?.Pokedex[id]) return null;
		const entry = this.raw[id];
		const data = entry?.species || this.overlay.Pokedex[id];
		const out: AnyObject = {
			inheritsFrom: entry ? entry.inheritsFrom : null,
			learnset: entry ? entry.learnset : this.overlay.Learnsets?.[id]?.learnset || {},
		};
		for (const field of SPECIES_FIELDS) {
			if (data[field] !== undefined) out[field] = data[field];
		}
		return JSON.stringify(out);
	}
	/** Whether `id` has edits that haven't reached the server. */
	isDirty(id: ID) {
		const json = id && this.speciesJSON(id);
		return !!json && this.saved[id] !== json;
	}
	/** Throws away unsaved edits by reloading the server's copy. */
	discard() {
		this.load(true);
	}
	flush(id: ID) {
		const json = id && this.speciesJSON(id);
		if (!json || this.saved[id] === json) return;
		this.queue = this.queue.filter(job => job.id !== id || !job.json);
		this.write({ command: `edit ${this.overlay!.Pokedex[id].name}, ${json}`, id, json });
	}
	create(name: string) {
		const abilityIds = Object.keys(allOf('ability').table);
		const randomAbility = Dex.abilities.get(abilityIds[Math.floor(Math.random() * abilityIds.length)]).name;
		return new Promise<string | null>(resolve => {
			this.write({
				command: `create ${JSON.stringify({
					name,
					types: ['Normal'],
					abilities: { 0: randomAbility },
					baseStats: { hp: 80, atk: 80, def: 80, spa: 80, spd: 80, spe: 80 },
					eggGroups: ['Field'],
					weightkg: 10,
				})}`,
				id: toID(name),
				resolve,
			});
		});
	}
	/** Formats share the species queue, so every write lands in the order it was made. */
	formatWrite(command: string, name: string) {
		return new Promise<string | null>(resolve => {
			this.write({ cmd: 'customformat', command, id: toID(name), resolve });
		});
	}
	/** A format starts from an existing one; its rules are the starting roster. */
	createFormat(name: string, base: string) {
		return this.formatWrite(`create ${JSON.stringify({ name, base })}`, name);
	}
	/** Throws away every change to the rules, back to the base format they were copied from. */
	resetFormat(name: string) {
		return this.formatWrite(`reset ${name}`, name);
	}
	deleteFormat(name: string) {
		return this.formatWrite(`delete ${name}`, name);
	}
	/**
	 * Applies a format edit to the local overlay right away. Without this, anything that reads the
	 * overlay back sees the server's copy until the write lands, so the UI runs an edit behind.
	 */
	patchFormat(id: string, changes: AnyObject) {
		const entry = this.overlay?.formats?.find(format => format.id === id);
		if (!entry) return;
		Object.assign(entry, changes);
		this.update();
	}
	editFormat(name: string, changes: AnyObject) {
		return this.formatWrite(`edit ${name}, ${JSON.stringify(changes)}`, name);
	}
	rename(oldName: string, newName: string) {
		return new Promise<string | null>(resolve => {
			this.write({
				command: `edit ${oldName}, ${JSON.stringify({ name: newName })}`, id: toID(oldName), resolve,
			});
		});
	}
	write(job: CustomDexWrite) {
		this.queue.push(job);
		this.pump();
	}
	pump() {
		if (this.pending || !this.queue.length) return;
		this.pending = this.queue.shift()!;
		PS.send(`/cmd ${this.pending.cmd || 'custompokemon'} ${this.pending.command}`);
	}
	receiveWrite(response: AnyObject | null) {
		const job = this.pending;
		this.pending = null;
		if (!response || response.actionerror) {
			PS.alert(response?.actionerror || `Couldn't save your custom Pokémon.`);
			job?.resolve?.(null);
			// A refused write leaves whatever was applied locally standing in for it, and the next
			// edit would be built on top of that: go back to the server's copy of both the format
			// and the rules it resolves to.
			this.load(true);
			const format = this.overlay?.formats?.find(entry => toID(entry.name) === job?.id);
			if (format) this.loadFormatLegal(format.id, true);
		} else {
			if (job?.json) this.saved[job.id] = job.json;
			job?.resolve?.(response.name || null);
		}
		this.pump();
		if (response?.overlay) this.receive(response.overlay as CustomDexOverlay);
		else this.update();
	}
	baseResults(): SearchRow[] {
		if (!this.ids.length) return [['header', this.emptyMessage()]];
		return this.ids.map(id => ['pokemon', id] as SearchRow);
	}
	/**
	 * Flip one named ruleset locally, so a chip doesn't sit a click behind the server. Turning a
	 * ruleset on can pull others in with it; the rule table that comes back settles that.
	 */
	patchFormatRules(key: ID, rule: ID, on: boolean) {
		const rules = this.formatRules[key] || [];
		this.formatRules[key] = on ? [...rules, rule] : rules.filter(id => id !== rule);
		this.update();
	}
	/** Every ruleset and tag the builder can toggle, and every mod it can name: all from the server. */
	rulesets() {
		return this.overlay?.rulesets || [];
	}
	tags() {
		return this.overlay?.tags || [];
	}
	mods() {
		return this.overlay?.mods || [];
	}
	/** Why the server's copy isn't here to look at yet, or null once it has actually arrived. */
	pendingReason(kind: string) {
		if (!PS.user.named) return `Log in to see your ${kind}`;
		if (this.error && !this.loading) return this.error;
		if (this.loading || !this.loadedFor) return `Loading your ${kind}...`;
		return null;
	}
	emptyMessage() {
		return this.pendingReason('custom Pokémon') || `You haven't made any custom Pokémon yet`;
	}
	nameMatches(query: ID): SearchRow[] {
		if (!query) return [];
		const starts: SearchRow[] = [];
		const contains: SearchRow[] = [];
		for (const id of this.ids) {
			const index = id.indexOf(query);
			if (index === 0) starts.push(['pokemon', id, 0, query.length]);
			else if (index > 0) contains.push(['pokemon', id]);
		}
		return [...starts, ...contains];
	}
}();

PS.user.subscribe(() => {
	CustomDex.load();
});

const spriteIdOf = (pokemon: any): ID => toID(pokemon?.speciesForme || pokemon?.species || pokemon);
const customArt = (pokemon: any, kinds: string[]) => {
	const id = spriteIdOf(pokemon);
	const set = CustomDex.sprites[id] || CustomDex.battleSprites[id];
	if (!set) return null;
	for (const kind of kinds) {
		if (set[kind]) return set[kind];
	}
	return null;
};

const dexGetPokemonIcon = Dex.getPokemonIcon.bind(Dex);
Dex.getPokemonIcon = (pokemon: any, facingLeft?: boolean) => {
	const url = CustomDex.ids.length && customArt(pokemon, ['icon']);
	if (!url) return dexGetPokemonIcon(pokemon, facingLeft);
	return `background:transparent url(${url}) no-repeat scroll 0 0` +
		(pokemon?.fainted ? `;opacity:.3;filter:grayscale(100%) brightness(.5)` : ``);
};

const dexGetPokemonIconNum = Dex.getPokemonIconNum.bind(Dex);
Dex.getPokemonIconNum = (id: ID, isFemale?: boolean, facingLeft?: boolean) => (
	dexGetPokemonIconNum(CustomDex.baseOf[id] || id, isFemale, facingLeft)
);

const dexGetTeambuilderSpriteData = Dex.getTeambuilderSpriteData.bind(Dex);
Dex.getTeambuilderSpriteData = (pokemon: any, dex?: any) => {
	const data = dexGetTeambuilderSpriteData(pokemon, dex);
	if (CustomDex.ids.length && CustomDex.sprites[spriteIdOf(pokemon)]?.front) data.pixelated = true;
	return data;
};

const tintCache: { [key: string]: string } = {};
function tintColor(type: string) {
	const key = `${document.documentElement.className} ${document.body.className} ${type}`;
	if (!tintCache[key]) {
		const probe = document.createElement('div');
		probe.className = `tint-${type}`;
		probe.style.display = 'none';
		document.body.appendChild(probe);
		tintCache[key] = getComputedStyle(probe).backgroundColor;
		probe.remove();
	}
	return tintCache[key];
}
function tintGradient(types: readonly string[]) {
	if (types.length < 2) return '';
	return `linear-gradient(to top left,${tintColor(types[1])} 0 50%,${tintColor(types[0])} 50% 100%)`;
}

const dexGetTeambuilderSprite = Dex.getTeambuilderSprite.bind(Dex);
Dex.getTeambuilderSprite = (pokemon: any, dex?: any, xOffset = 0, yOffset = 0) => {
	const id = CustomDex.ids.length ? spriteIdOf(pokemon) : '' as ID;
	if (!CustomDex.has(id)) return dexGetTeambuilderSprite(pokemon, dex, xOffset, yOffset);
	const gradient = tintGradient(Dex.species.get(id).types);
	const url = customArt(pokemon, pokemon?.shiny ? ['front-shiny', 'front'] : ['front']);
	if (!url) {
		const base = dexGetTeambuilderSprite(pokemon, dex, xOffset, yOffset);
		return gradient ? `${base};background-image:${gradient};background-size:auto` : base;
	}
	return `background-image:url(${url})${gradient ? `,${gradient}` : ''};` +
		`background-position:${8 + xOffset}px ${10 + yOffset}px${gradient ? ',0 0' : ''};` +
		`background-repeat:no-repeat;background-size:96px${gradient ? ',auto' : ''}`;
};

/** What the format's rules leave in. Whatever it drops turns up under "Illegal results" instead. */
function keepLegal(kind: RosterKind, roster: ID[], rows: SearchRow[]): SearchRow[] {
	const legal: { [id: string]: boolean } = {};
	for (const id of roster) legal[id] = true;
	return dropEmptyHeaders(rows.filter(row => row[0] !== kind || legal[row[1]]));
}

/**
 * A team built for a custom format searches as the format it's based on, narrowed to what its
 * rules actually allow. The tier tables the search is built from know neither, so the base format
 * stands in for the gen and tier order, and the roster the server works out does the rest.
 */
const dexSearchSetType = DexSearch.prototype.setType;
DexSearch.prototype.setType = function (this: DexSearch, searchType, format, speciesOrSet) {
	const entry = searchType ? CustomDex.formatEntry(format) : null;
	if (!entry) return dexSearchSetType.call(this, searchType, format, speciesOrSet);

	dexSearchSetType.call(this, searchType, CustomDex.baseFormat(format || ''), speciesOrSet);
	const search = this.typedSearch;
	const kind = ROSTER_KINDS.find(candidate => candidate === searchType);
	if (!search || !kind) return;

	const key = toID(entry.id);
	// Asked for once: working one out costs the server a full pass over the dex.
	if (!CustomDex.formatLegal[key]) CustomDex.loadFormatLegal(entry.id);
	const roster = () => CustomDex.formatLegal[key]?.[kind] || null;
	const baseResults = search.getBaseResults.bind(search);
	const results = search.getResults.bind(search);
	let usedRoster = roster();
	search.getBaseResults = () => {
		// Custom species are in the dex but in none of the tier tables, so they're added by hand.
		const rows = kind === 'pokemon' && CustomDex.ids.length ? [
			['header', 'Custom'] as SearchRow,
			...CustomDex.ids.map(id => ['pokemon', id] as SearchRow),
			...baseResults(),
		] : baseResults();
		return usedRoster ? keepLegal(kind, usedRoster, rows) : rows;
	};
	search.getResults = (filters, sortCol, reverseSort) => {
		// The roster comes from the server, so the first list built may well predate it.
		if (usedRoster !== roster()) {
			usedRoster = roster();
			search.baseResults = search.baseIllegalResults = null;
		}
		return results(filters, sortCol, reverseSort);
	};
};

/**
 * Both of these fire on messages that can arrive before this file has run - the script list puts
 * it after everything it patches - so they're hooked here rather than called from there, where an
 * early `|formats|` would throw before the client had finished loading.
 */
const mainMenuParseFormats = MainMenuRoom.prototype.parseFormats;
MainMenuRoom.prototype.parseFormats = function (this: MainMenuRoom, formatsList: string[]) {
	// A format list replaces `BattleFormats` wholesale, so the custom ones have to go back in.
	mainMenuParseFormats.call(this, formatsList);
	CustomDex.registerFormats();
};

const chatParseChallenge = ChatRoom.prototype.parseChallenge;
ChatRoom.prototype.parseChallenge = function (this: ChatRoom, challengeString: string | null) {
	const challenge = chatParseChallenge.call(this, challengeString);
	CustomDex.learnFormat(challenge?.formatName);
	return challenge;
};

const dexGetSpriteData = Dex.getSpriteData.bind(Dex);
Dex.getSpriteData = (pokemon: any, isFront: boolean, options?: any) => {
	const data = dexGetSpriteData(pokemon, isFront, options);
	const shiny = data.shiny ? '-shiny' : '';
	// A back sprite is optional: a species with only a front one faces the wrong way rather than
	// falling back to art of something else entirely.
	const url = customArt(pokemon, isFront ?
		[`front${shiny}`, 'front'] : [`back${shiny}`, 'back', `front${shiny}`, 'front']);
	// Uploads are held to 96x96, which is the size the default sprite box already is.
	return url ? { ...data, url, w: 96, h: 96, y: 0, pixelated: true } : data;
};

const dexForFormat = Dex.forFormat.bind(Dex);
Dex.forFormat = (format: string) => dexForFormat(CustomDex.baseFormat(format));

const teamEditorSetFormat = TeamEditorState.prototype.setFormat;
TeamEditorState.prototype.setFormat = function (this: TeamEditorState, format: string) {
	if (!CustomDex.formatEntry(format)) return teamEditorSetFormat.call(this, format);
	// A custom format's id is its owner and its name, so everything the editor reads out of an id
	// by substring - level, forme legality, whether it's Let's Go - has to come from the base.
	teamEditorSetFormat.call(this, CustomDex.baseFormat(format));
	this.format = this.team.format = toID(format);
};

const INSTAFILTERABLE: SearchType[] = ['type', 'ability', 'move'];

const allCache: { [type: string]: { rows: SearchRow[], table: { [id: string]: AnyObject } } } = {};
function allOf(searchType: 'ability' | 'move' | 'item') {
	if (!allCache[searchType]) {
		const source = searchType === 'ability' ? BattleAbilities :
			searchType === 'item' ? BattleItems : BattleMovedex;
		const ids = Object.keys(source).filter(id => id !== 'noability');
		const get = (id: string) => (searchType === 'ability' ? Dex.abilities.get(id) :
			searchType === 'item' ? Dex.items.get(id) : Dex.moves.get(id)).name;
		ids.sort((a, b) => get(a).localeCompare(get(b)));
		const rows: SearchRow[] = [['header', 'All']];
		const table: { [id: string]: AnyObject } = {};
		for (const id of ids) {
			rows.push([searchType, id as ID]);
			table[id] = source[id];
		}
		allCache[searchType] = { rows, table };
	}
	return allCache[searchType];
}

const PICKER_SORTS = ['type', 'category', 'ability'];

function pinMoves(typedSearch: AnyObject, rows: SearchRow[]): SearchRow[] {
	const set = typedSearch.set;
	const selected: { [id: string]: boolean } = {};
	for (const move of set?.moves || []) {
		if (move) selected[toID(move)] = true;
	}
	const ids = Object.keys(selected);
	const species = Dex.species.get(set?.species);
	const useful: SearchRow[] = [];
	const useless: SearchRow[] = [];
	const rest: SearchRow[] = [];
	let sortRow: SearchRow | null = null;
	for (const row of rows) {
		if (row[0] === 'sortmove') {
			sortRow = row;
		} else {
			if (row[0] === 'move' && selected[row[1]]) {
				(typedSearch.moveIsNotUseless(row[1], species, ids, set) ? useful : useless).push(row);
			}
			rest.push(row);
		}
	}
	if (rest.length && rest[0][0] !== 'header') rest.unshift(['header', 'All']);
	return [
		...(sortRow ? [sortRow] : []),
		...dropEmptyHeaders([
			['header', 'Selected: Moves'], ...useful,
			['header', 'Selected: Usually Useless'], ...useless,
			...rest,
		]),
	];
}

/**
 * PokePaste for a whole species rather than a battle set: a name on the first line, `Key: Value`
 * lines with ` / ` between repeated values, then the learnset as `- Move` lines.
 */
const STAT_LABELS: { [stat: string]: string } = {
	hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe',
};
const STAT_IDS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

/**
 * A format as text, the way a species is: its name, what it's built on, then its rules. The rules
 * are spelled the way the sim spells them everywhere else - bare to add a ruleset, `-` to ban, `+`
 * to unban - so a line here is a line a challenge would take.
 */
export function exportFormat(format: {
	name: string, base: string, mod: string, ruleset: string[], banlist: string[], unbanlist: string[],
}): string {
	const lines = [format.name];
	if (format.base) lines.push(`Base: ${format.base}`);
	if (format.mod) lines.push(`Mod: ${format.mod}`);
	lines.push('');
	return [
		...lines, ...format.ruleset,
		...format.banlist.map(rule => `-${rule}`), ...format.unbanlist.map(rule => `+${rule}`),
	].join('\n');
}

export interface ParsedFormat {
	base: string | null; mod: string | null; ruleset: string[]; banlist: string[]; unbanlist: string[];
}

/**
 * The same text back into fields. `Base: X @@@ a, b` is how a challenge writes a format, so that
 * spelling is taken too, on any line. The name is the format's identity rather than one of its
 * fields, so a first line that isn't a rule is read past.
 */
export function parseFormat(text: string): ParsedFormat | string {
	const parsed: ParsedFormat = { base: null, mod: null, ruleset: [], banlist: [], unbanlist: [] };
	const lines: string[] = [];
	for (const line of text.split('\n')) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		if (!trimmed.includes('@@@')) {
			lines.push(trimmed);
			continue;
		}
		const [base, rules] = trimmed.split('@@@');
		if (base.trim()) lines.push(`Base: ${base.trim()}`);
		for (const rule of rules.split(',')) {
			if (rule.trim()) lines.push(rule.trim());
		}
	}
	let readName = false;
	for (const line of lines) {
		const field = /^(base|mod)\s*:(.*)$/i.exec(line);
		if (field) {
			parsed[field[1].toLowerCase() as 'base' | 'mod'] = field[2].trim() || null;
		} else if (line.startsWith('-')) {
			parsed.banlist.push(line.slice(1).trim());
		} else if (line.startsWith('+')) {
			parsed.unbanlist.push(line.slice(1).trim());
		} else if (!readName && line === lines[0]) {
			readName = true;
		} else {
			parsed.ruleset.push(line);
		}
	}
	if (!parsed.base && !parsed.mod) {
		return `Name a "Base:" format to build on, or a "Mod:" to start from scratch.`;
	}
	return parsed;
}

export function exportSpecies(id: ID): string {
	const data = CustomDex.overlay?.Pokedex[id];
	if (!data) return '';
	const out: string[] = [data.name || id];
	const line = (label: string, value: any) => {
		if (value === undefined || value === null || value === '') return;
		out.push(`${label}: ${value}`);
	};
	const list = (value: any) => (value || []).join(' / ');
	const abilities = data.abilities || {};
	line('Inherits From', CustomDex.raw[id]?.inheritsFrom);
	line('Types', list(data.types));
	line('Abilities', [abilities['0'], abilities['1']].filter(Boolean).join(' / '));
	line('Hidden Ability', abilities.H);
	if (data.baseStats) {
		line('Base Stats', STAT_IDS.map(stat => `${data.baseStats[stat]} ${STAT_LABELS[stat]}`).join(' / '));
	}
	line('Egg Groups', list(data.eggGroups));
	if (data.weightkg !== undefined && data.weightkg !== null) line('Weight', `${data.weightkg} kg`);
	if (data.heightm !== undefined && data.heightm !== null) line('Height', `${data.heightm} m`);
	line('Gender', data.gender);
	if (data.genderRatio) {
		line('Gender Ratio', `${Math.round(data.genderRatio.M * 8)}:${Math.round(data.genderRatio.F * 8)}`);
	}
	line('Evolves From', data.prevo);
	line('Evolves Into', list(data.evos));
	line('Evo Type', data.evoType);
	line('Evo Level', data.evoLevel);
	line('Evo Condition', data.evoCondition);
	line('Tags', list(data.tags));
	line('Forme', data.forme);
	line('Max HP', data.maxHP);
	if (data.cannotDynamax) line('Cannot Dynamax', 'Yes');
	line('Color', data.color);
	line('Category', data.category);
	line('Dex Entry', (data.dexEntry || '').replace(/\s+/g, ' ').trim());
	for (const move of CustomDex.learnset(id)) out.push(`- ${move}`);
	return out.join('\n');
}

export interface ParsedSpecies { name: string; fields: AnyObject; moves: string[] }

function named(table: { get: (name: string) => AnyObject }, value: string, what: string) {
	const entry = table.get(value);
	if (!entry.exists) throw new Error(`"${value}" is not a ${what}.`);
	return entry.name as string;
}
function oneOf(value: string, options: readonly string[], what: string) {
	const match = options.find(option => toID(option) === toID(value));
	if (!match) throw new Error(`"${value}" is not a ${what}. Try: ${options.join(', ')}.`);
	return match;
}
function number(value: string, what: string, field?: string, whole?: boolean) {
	const parsed = Number(value.trim());
	if (!value.trim() || !Number.isFinite(parsed)) throw new Error(`"${what}" needs a number.`);
	if (whole && !Number.isInteger(parsed)) throw new Error(`"${what}" must be a whole number.`);
	const { min, max } = (field && CustomDex.limits[field]) || {};
	if (min !== undefined && parsed < min) throw new Error(`"${what}" can't be below ${min}.`);
	if (max !== undefined && parsed > max) throw new Error(`"${what}" can't be above ${max}.`);
	return parsed;
}
function capped(value: string, what: string, field: string) {
	const maxLength = CustomDex.limits[field]?.maxLength;
	if (maxLength !== undefined && value.length > maxLength) {
		throw new Error(`"${what}" can be at most ${maxLength} characters.`);
	}
	return value;
}

/** Returns the parsed species, or an error message to show the user. */
export function parseSpecies(text: string): ParsedSpecies | string {
	const fields: AnyObject = {};
	const abilities: AnyObject = {};
	const moves: string[] = [];
	let name = '';
	let sawAbility = false;
	try {
		for (const raw of text.split('\n')) {
			const trimmed = raw.trim();
			if (!trimmed) continue;
			if (trimmed.startsWith('-')) {
				moves.push(named(Dex.moves, trimmed.slice(1).trim(), 'move'));
				continue;
			}
			if (!name) {
				name = trimmed;
				continue;
			}
			const colon = trimmed.indexOf(':');
			if (colon < 0) throw new Error(`Couldn't read the line "${trimmed}".`);
			const value = trimmed.slice(colon + 1).trim();
			const parts = value.split('/').map(part => part.trim()).filter(Boolean);
			switch (toID(trimmed.slice(0, colon))) {
			case 'types':
				fields.types = parts.map(part => named(Dex.types, part, 'type'));
				break;
			case 'abilities':
				parts.forEach((part, i) => (abilities[i] = named(Dex.abilities, part, 'ability')));
				sawAbility = true;
				break;
			case 'hiddenability':
				abilities.H = named(Dex.abilities, value, 'ability');
				sawAbility = true;
				break;
			case 'basestats': {
				const baseStats: AnyObject = {};
				for (const part of parts) {
					const words = part.split(/\s+/);
					let stat = '';
					for (const statID of STAT_IDS) {
						if (toID(STAT_LABELS[statID]) === toID(words[1])) stat = statID;
					}
					if (!stat) throw new Error(`"${words[1] || part}" is not a stat.`);
					baseStats[stat] = number(words[0], 'Base Stats', 'baseStat', true);
				}
				fields.baseStats = baseStats;
				break;
			}
			case 'egggroups':
				fields.eggGroups = parts.map(part => oneOf(part, EGG_GROUPS, 'egg group'));
				break;
			case 'inheritsfrom': fields.inheritsFrom = named(Dex.species, value, 'Pokemon'); break;
			case 'weight': fields.weightkg = number(value, 'Weight', 'weightkg'); break;
			case 'height': fields.heightm = number(value, 'Height', 'heightm'); break;
			case 'forme': fields.forme = capped(value, 'Forme', 'forme'); break;
			case 'maxhp': fields.maxHP = number(value, 'Max HP', 'maxHP', true); break;
			case 'cannotdynamax': fields.cannotDynamax = toID(value) !== 'no'; break;
			case 'gender': fields.gender = oneOf(value, ['M', 'F', 'N'], 'gender'); break;
			case 'genderratio': {
				const [male] = value.split(':');
				const eighths = number(male, 'Gender Ratio');
				fields.genderRatio = { M: eighths / 8, F: 1 - eighths / 8 };
				break;
			}
			case 'evolvesfrom': fields.prevo = named(Dex.species, value, 'Pokemon'); break;
			case 'evolvesinto':
				fields.evos = parts.map(part => named(Dex.species, part, 'Pokemon'));
				break;
			case 'evotype': fields.evoType = oneOf(value, EVO_TYPES, 'evolution type'); break;
			case 'evolevel': fields.evoLevel = number(value, 'Evo Level', 'evoLevel', true); break;
			case 'evocondition': fields.evoCondition = capped(value, 'Evo Condition', 'evoCondition'); break;
			case 'tags': fields.tags = parts.map(part => oneOf(part, TAGS, 'tag')); break;
			case 'color': fields.color = oneOf(value, COLORS, 'colour'); break;
			case 'category': fields.category = capped(value, 'Category', 'category'); break;
			case 'dexentry': fields.dexEntry = capped(value, 'Dex Entry', 'dexEntry'); break;
			default:
				throw new Error(`"${trimmed.slice(0, colon)}" isn't a field.`);
			}
		}
	} catch (err: any) {
		return err.message;
	}
	if (!name) return `Start with the Pokemon's name on the first line.`;
	const maxName = CustomDex.limits.name?.maxLength;
	if (maxName !== undefined && name.length > maxName) {
		return `Names can be at most ${maxName} characters.`;
	}
	const maxMoves = CustomDex.limits.learnset?.max;
	if (maxMoves !== undefined && moves.length > maxMoves) {
		return `A learnset can hold at most ${maxMoves} moves.`;
	}
	if (sawAbility) fields.abilities = abilities;
	return { name, fields, moves };
}

export const SPECIES_FIELDS = [
	'types', 'baseStats', 'abilities', 'eggGroups', 'weightkg', 'heightm', 'color', 'gender',
	'genderRatio', 'prevo', 'evos', 'evoType', 'evoLevel', 'evoCondition', 'forme', 'maxHP',
	'cannotDynamax', 'tags', 'category', 'dexEntry',
];

export const EGG_GROUPS = [
	'Amorphous', 'Bug', 'Ditto', 'Dragon', 'Fairy', 'Field', 'Flying', 'Grass', 'Human-Like',
	'Mineral', 'Monster', 'Undiscovered', 'Water 1', 'Water 2', 'Water 3',
];
export const COLORS = ['Green', 'Red', 'Blue', 'White', 'Brown', 'Yellow', 'Purple', 'Pink', 'Gray', 'Black'];
export const TAGS = [
	'Sub-Legendary', 'Restricted Legendary', 'Mythical', 'Paradox', 'Ultra Beast',
	'True Past', 'Past Unobtainable', 'Pokestar',
];
export const EVO_TYPES = [
	'trade', 'useItem', 'levelMove', 'levelExtra', 'levelFriendship', 'levelHold', 'other',
];

export function abilitySlots(count: number, existing?: readonly string[]) {
	if (existing?.length === count) return existing.slice();
	return count > 2 ? ['0', '1', 'H'] : count > 1 ? ['0', 'H'] : ['0'];
}

export function speciesAbilities(species: AnyObject | null | undefined): [string, string][] {
	return Object.entries(species?.abilities || {})
		.filter(([, name]) => name && name !== 'No Ability') as [string, string][];
}

/** What a format allows, pinned above everything there is, the way selected moves are. */
function pinRoster(kind: RosterKind, roster: ID[], rows: SearchRow[]): SearchRow[] {
	const legal: { [id: string]: boolean } = {};
	for (const id of roster) legal[id] = true;
	const inFormat: SearchRow[] = [];
	const rest: SearchRow[] = [];
	let sortRow: SearchRow | null = null;
	/** The section the next legal species falls under, until its divider has been emitted. */
	let divider: SearchRow | null = null;
	for (const row of rows) {
		if (row[0] === 'sortpokemon') {
			sortRow = row;
			continue;
		}
		if (row[0] === 'header') {
			// Tagged, so a divider still says which section it belongs to once the title scrolls off.
			// A list with no sections of its own has only the one everything is under, and that's
			// nothing to divide.
			divider = row[1] === 'All' ? null : ['header', `Legal: ${row[1]}`];
		} else if (row[0] === kind && legal[row[1]]) {
			if (divider) {
				inFormat.push(divider);
				divider = null;
			}
			inFormat.push(row);
		}
		rest.push(row);
	}
	// Each section drops its own empty dividers: a title followed by its first divider only looks
	// like the empty section `dropEmptyHeaders` exists to collapse.
	const below = dropEmptyHeaders(rest);
	return [
		...(sortRow ? [sortRow] : []),
		...(inFormat.length ? [
			['header', `Legal in this format (${roster.length})`] as SearchRow, ...dropEmptyHeaders(inFormat),
		] : []),
		// Lists that already open with one don't need a second heading over the same rows.
		...(below[0]?.[0] === 'header' && below[0][1] === 'All' ? [] : [['header', 'All'] as SearchRow]),
		...below,
	];
}

function pinAbilities(typedSearch: AnyObject, rows: SearchRow[]): SearchRow[] {
	const ids: ID[] = (typedSearch.set?.abilities || []).map(toID);
	const species = Dex.species.get(typedSearch.set?.species);
	const slots = abilitySlots(ids.length, speciesAbilities(species).map(([slot]) => slot));
	const regular: SearchRow[] = [];
	const hidden: SearchRow[] = [];
	for (let i = 0; i < ids.length; i++) {
		(slots[i] === 'H' ? hidden : regular).push(['ability', ids[i]]);
	}
	return dropEmptyHeaders([
		['header', 'Selected: Abilities'], ...regular,
		['header', 'Selected: Hidden Ability'], ...hidden,
		...rows,
	]);
}

/**
 * Whether a species can take part in an evolution line at all. Cosmetic formes are stat-less stubs
 * that render as blank rows; the rest are formes a Pokemon turns into mid-battle or holds an item
 * for, plus fan-made entries. Custom species (no dex entry) always qualify.
 */
function evolvable(data: AnyObject | undefined) {
	if (!data) return true;
	// `Dex.species.get()` caches its Species objects back into BattlePokedex, so a lookup of '' (which
	// the picker does on open) leaves a nameless entry behind. Raw dex data has no `exists` field.
	if (data.exists === false || !data.name) return false;
	if (data.isCosmeticForme || data.battleOnly || data.changesFrom || data.requiredItem) return false;
	if (data.forme === 'Gmax' || data.forme === 'Eternamax' || (data.forme || '').endsWith('Totem')) return false;
	return !data.isNonstandard || data.isNonstandard === 'Past';
}

let everyCache: { key: string, rows: SearchRow[], table: { [id: string]: AnyObject } } | null = null;
let officialCache: { rows: SearchRow[], table: { [id: string]: AnyObject } } | null = null;
let assembled: { key: string, value: { rows: SearchRow[], table: { [id: string]: AnyObject } } } | null = null;
const tierCache: { [gen: string]: SearchRow[] } = {};

/**
 * Formes that only ever exist mid-battle, which no teambuilder offers, so the picker shouldn't
 * either: the tier tables leave exactly these out, and the server won't call them legal
 * (`unbuildableForme` in `chat-plugins/custom-formats.ts` keeps the same list). Battle-only alone is
 * the wrong test, since Zacian-Crowned, Palafin-Hero and every mega are battle-only and buildable.
 */
const UNBUILDABLE_BASES = [
	'Aegislash', 'Castform', 'Cherrim', 'Cramorant', 'Eiscue', 'Meloetta', 'Mimikyu', 'Minior',
	'Morpeko', 'Ramnarok', 'Wishiwashi',
];
function unbuildableForme(id: ID) {
	const species = Dex.species.get(id);
	if (!species.forme) return false;
	return UNBUILDABLE_BASES.includes(species.baseSpecies) || species.forme.includes('Totem') ||
		species.forme.includes('Zen') || (species.baseSpecies === 'Ogerpon' && species.forme.includes('Tera'));
}

/**
 * The teambuilder's own tier order, tier headers included. Built the way `getBaseResults` builds
 * it, so whichever runs first the other still finds its `tierSet`.
 */
function tierRows(gen: number): SearchRow[] {
	if (!tierCache[gen]) {
		const table = (gen < 9 ? BattleTeambuilderTable?.[`gen${gen}`] : BattleTeambuilderTable) || {};
		if (!table.tierSet) {
			table.tierSet = (table.tiers || []).map((r: any) => (typeof r === 'string' ? ['pokemon', r] : [r[0], r[1]]));
			table.tiers = null;
		}
		tierCache[gen] = table.tierSet;
	}
	return tierCache[gen];
}

/** Every species there is, with no eligibility filter: a format roster can hold anything. */
function everySpecies(gen: number) {
	const key = `${gen}|${CustomDex.revision}|${CustomDex.ids.join(',')}`;
	if (everyCache?.key !== key) {
		const own: { [id: string]: boolean } = {};
		for (const id of CustomDex.ids) own[id] = true;
		const listed: { [id: string]: boolean } = {};
		const tiered: SearchRow[] = [];
		for (const row of tierRows(gen)) {
			if (row[0] === 'header') {
				tiered.push(row);
			} else if (window.BattlePokedex[row[1]]?.name && !own[row[1]] && !listed[row[1]]) {
				listed[row[1]] = true;
				tiered.push(row);
			}
		}
		const rest = (Object.keys(window.BattlePokedex) as ID[])
			.filter(id => id && window.BattlePokedex[id]?.name && !own[id] && !listed[id] && !unbuildableForme(id));
		const names: { [id: string]: string } = {};
		for (const id of rest) names[id] = Dex.species.get(id).name;
		rest.sort((a, b) => names[a].localeCompare(names[b]));
		const table: { [id: string]: AnyObject } = {};
		for (const id of [...Object.keys(listed), ...rest]) table[id] = window.BattlePokedex[id];
		everyCache = {
			key,
			rows: dropEmptyHeaders([
				['header', 'Custom'], ...CustomDex.ids.map(id => ['pokemon', id] as SearchRow),
				...tiered,
				// Whatever the tier table leaves out: past-gen formes, megas, Gmax, Pokestar.
				['header', 'Illegal'], ...rest.map(id => ['pokemon', id] as SearchRow),
			]),
			table: { ...table, ...CustomDex.pokedex() },
		};
	}
	return everyCache;
}

/** Every species, the owner's own first. Custom entries live in BattlePokedex but not in the tier tables. */
function allSpecies(exclude?: ID) {
	if (!officialCache) {
		const ids = Object.keys(window.BattlePokedex)
			.filter(id => id && !CustomDex.has(id as ID) && evolvable(window.BattlePokedex[id]));
		const names: { [id: string]: string } = {};
		for (const id of ids) names[id] = Dex.species.get(id).name;
		ids.sort((a, b) => names[a].localeCompare(names[b]));
		const table: { [id: string]: AnyObject } = {};
		for (const id of ids) table[id] = window.BattlePokedex[id];
		officialCache = { rows: ids.map(id => ['pokemon', id as ID] as SearchRow), table };
	}
	const key = `${CustomDex.revision}|${exclude || ''}|${CustomDex.ids.join(',')}`;
	if (assembled?.key !== key) {
		assembled = {
			key,
			value: {
				rows: dropEmptyHeaders([
					['header', 'Custom'],
					...CustomDex.ids.filter(id => id !== exclude).map(id => ['pokemon', id] as SearchRow),
					['header', 'All'], ...officialCache.rows.filter(row => row[1] !== exclude),
				]),
				table: { ...officialCache.table, ...CustomDex.pokedex() },
			},
		};
	}
	return assembled.value;
}

export class PokebuilderDexSearch extends DexSearch {
	/**
	 * 'own' is the builder's own species list, 'all' the prevo/evos picker (evolution-capable
	 * species only), 'every' a format roster (anything at all).
	 */
	speciesMode: 'own' | 'all' | 'every' = 'own';
	/** The species being edited: it can't be its own relative. */
	pickerExclude: ID | null = null;
	/** Species already open in another set, so the builder's own list can't open one twice. */
	openIds: ID[] = [];
	/** What a format allows, pinned above the rest, when this search is a format's own picker. */
	roster: ID[] | null = null;
	override setType(searchType: SearchType | '', format = '' as ID, speciesOrSet: ID | Dex.PokemonSet = '' as ID) {
		super.setType(searchType, format, speciesOrSet);
		this.restrict();
	}
	restrict() {
		const typedSearch = this.typedSearch as any;
		if (typedSearch?.searchType === 'pokemon') {
			const mode = this.speciesMode;
			const exclude = this.pickerExclude || undefined;
			// The unsorted order is the tier order, so that's what the sort row's reset button restores.
			this.firstPokemonColumn = mode === 'every' ? 'Tier' : 'Number';
			const source = () => (mode === 'every' ? everySpecies(typedSearch.dex.gen) : allSpecies(exclude));
			typedSearch.getTable = () => (mode === 'own' ? CustomDex.pokedex() : source().table);
			typedSearch.getBaseResults = typedSearch.getDefaultResults = () => (
				mode === 'own' ? dropEmptyHeaders(CustomDex.baseResults().filter(this.notOpen)) : source().rows
			);
			if (!typedSearch.unpinnedResults) {
				typedSearch.unpinnedResults = typedSearch.getResults.bind(typedSearch);
				typedSearch.getResults = (filters: AnyObject, sortCol: string, reverseSort: boolean) => {
					const rows = typedSearch.unpinnedResults(filters, sortCol, reverseSort);
					if (!this.roster || sortCol) return rows;
					return pinRoster('pokemon', this.roster, rows);
				};
			}
		} else if (typedSearch?.searchType === 'ability' || typedSearch?.searchType === 'move' ||
			typedSearch?.searchType === 'item') {
			const kind: 'ability' | 'move' | 'item' = typedSearch.searchType;
			typedSearch.getTable = () => allOf(kind).table;
			typedSearch.getBaseResults = typedSearch.getDefaultResults = () => allOf(kind).rows;
			if (!typedSearch.unpinnedResults) {
				typedSearch.unpinnedResults = typedSearch.getResults.bind(typedSearch);
				typedSearch.getResults = (filters: AnyObject, sortCol: string, reverseSort: boolean) => {
					const rows = typedSearch.unpinnedResults(filters, sortCol, reverseSort);
					// A format's own list is pinned whole; a set's picker pins what the set has.
					if (this.roster) return sortCol ? rows : pinRoster(kind, this.roster, rows);
					if (PICKER_SORTS.includes(sortCol)) return rows;
					return kind === 'move' ? pinMoves(typedSearch, rows) :
						kind === 'ability' ? pinAbilities(typedSearch, rows) : rows;
				};
			}
		} else {
			return;
		}
		typedSearch.baseResults = null;
		typedSearch.baseIllegalResults = null;
		typedSearch.illegalReasons = null;
	}
	/** A species open in another set is already being edited there. */
	notOpen = (row: SearchRow) => row[0] !== 'pokemon' || !this.openIds.includes(row[1]);
	refresh() {
		this.restrict();
		this.results = null;
		this.find(this.query);
	}
	override textSearch(query: string): SearchRow[] {
		if (this.typedSearch?.searchType !== 'pokemon') return super.textSearch(query);
		const id = toID(query);
		if (this.speciesMode !== 'own') {
			const every = this.speciesMode === 'every';
			const keep = (row: SearchRow) => row[0] !== 'pokemon' || (row[1] !== this.pickerExclude &&
				// Own creations are always eligible; their 'Custom' isNonstandard isn't disqualifying.
				(every || CustomDex.has(row[1]) || evolvable(window.BattlePokedex[row[1]])));
			return (this.results = dropEmptyHeaders([
				...CustomDex.nameMatches(id).filter(keep), ...super.textSearch(query).filter(keep),
			]));
		}
		const rows = super.textSearch(query).filter(row => (
			row[0] !== 'pokemon' || (CustomDex.has(row[1]) && this.notOpen(row))
		));
		return (this.results = dropEmptyHeaders([
			...CustomDex.nameMatches(id).filter(this.notOpen),
			...this.instafilterCustom(id, rows).filter(this.notOpen), ...rows,
		]));
	}
	instafilterCustom(query: ID, rows: SearchRow[]): SearchRow[] {
		const typedSearch = this.typedSearch as any;
		if (!query || !typedSearch) return [];

		let matched: SearchType | null = null;
		for (const row of rows) {
			if (row[1] === query && INSTAFILTERABLE.includes(row[0] as SearchType)) {
				matched = row[0] as SearchType;
				break;
			}
		}
		if (!matched) return [];

		const filter = this.normalizeFilter(matched, query);
		const matches: SearchRow[] = [];
		for (const id of CustomDex.ids) {
			if (typedSearch.filter(['pokemon', id], [filter])) matches.push(['pokemon', id]);
		}
		return matches.length ? [['header', `${filter[1]} Pokémon`], ...matches] : [];
	}
	normalizeFilter(type: SearchType, value: ID): [string, string] {
		switch (type) {
		case 'type': return [type, this.capitalizeFirst(value)];
		case 'ability': return [type, this.dex.abilities.get(value).name];
		default: return [type, toID(value)];
		}
	}
}

function dropEmptyHeaders(rows: SearchRow[]): SearchRow[] {
	const out: SearchRow[] = [];
	for (const row of rows) {
		if (row[0] === 'header' && out.length && out[out.length - 1][0] === 'header') {
			out[out.length - 1] = row;
		} else {
			out.push(row);
		}
	}
	if (out.length && out[out.length - 1][0] === 'header') out.pop();
	return out;
}
