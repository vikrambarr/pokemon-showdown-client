/**
 * Client-side custom dex
 *
 * @license AGPLv3
 */

import { PS } from "./client-main";
import { PSModel } from "./client-core";
import { Dex, toID, type ID } from "./battle-dex";
import { DexSearch, type SearchRow, type SearchType } from "./battle-dex-search";

declare const BattleTeambuilderTable: any;

export type CustomSpriteSet = { [kind: string]: string };

type CustomDexWrite = { command: string, id: ID, json?: string, resolve?: (name: string | null) => void };

export interface CustomDexOverlay {
	Pokedex: { [id: string]: AnyObject };
	Learnsets: { [id: string]: { learnset?: { [moveid: string]: string[] } } };
	sprites: { [id: string]: CustomSpriteSet };
	entries?: { name: string, inheritsFrom: string | null }[];
}

const ALL_SOURCE_CHARS = '123456789pqga';
const LOAD_TIMEOUT = 20000;
const SAVE_DELAY = 2000;
const REQUIRED_FIELDS = ['types', 'abilities', 'baseStats', 'eggGroups', 'weightkg'];

export const CustomDex = new class extends PSModel {
	overlay: CustomDexOverlay | null = null;
	loadedFor: ID | null = null;
	loading = false;
	error: string | null = null;
	sprites: { [id: string]: CustomSpriteSet } = {};
	ids: ID[] = [];
	baseOf: { [id: string]: ID } = {};
	requestedFor: ID | null = null;
	loadTimer: ReturnType<typeof setTimeout> | null = null;
	saved: { [id: string]: string } = {};
	queue: CustomDexWrite[] = [];
	pending: CustomDexWrite | null = null;
	saveTimer: ReturnType<typeof setTimeout> | null = null;

	has(id: ID) {
		return !!this.overlay?.Pokedex[id];
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
			this.apply(overlay);
			this.loadedFor = this.requestedFor || PS.user.userid;
		}
		this.update();
	}
	clear() {
		this.unapply(this.ids);
		if (this.saveTimer) clearTimeout(this.saveTimer);
		if (this.loadTimer) clearTimeout(this.loadTimer);
		this.loadTimer = this.saveTimer = null;
		this.loadedFor = this.requestedFor = null;
		this.overlay = this.pending = null;
		this.loading = false;
		this.sprites = {};
		this.baseOf = {};
		this.saved = {};
		this.ids = [];
		this.queue = [];
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
		this.unapply(this.ids.filter(id => !overlay.Pokedex[id]));
		this.overlay = overlay;
		this.sprites = overlay.sprites || {};

		this.baseOf = {};
		for (const entry of overlay.entries || []) {
			if (entry.inheritsFrom) this.baseOf[toID(entry.name)] = toID(entry.inheritsFrom);
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
		for (const mod of Object.values(Dex.moddedDexes)) delete mod.cache.Species[id];
		this.update();
	}
	learnset(id: ID): string[] {
		const learnset = this.overlay?.Learnsets?.[id]?.learnset;
		if (!learnset) return [];
		return Object.keys(learnset).map(moveid => Dex.moves.get(moveid).name).sort((a, b) => a.localeCompare(b));
	}
	setLearnset(id: ID, moves: string[]) {
		if (!this.overlay?.Pokedex[id]) return;
		if (!this.overlay.Learnsets) this.overlay.Learnsets = {};
		const previous = this.overlay.Learnsets[id]?.learnset || {};
		const learnset: { [moveid: string]: string[] } = {};
		const table: { [moveid: string]: string } = {};
		for (const move of moves) {
			const moveid = toID(move);
			learnset[moveid] = previous[moveid] || ['9L1'];
			table[moveid] = ALL_SOURCE_CHARS;
		}
		this.overlay.Learnsets[id] = { learnset };
		BattleTeambuilderTable.learnsets[id] = table;
	}
	speciesJSON(id: ID) {
		const data = this.overlay?.Pokedex[id];
		if (!data) return null;
		const out: AnyObject = { learnset: this.overlay!.Learnsets?.[id]?.learnset || {} };
		for (const field of SPECIES_FIELDS) {
			if (data[field] !== undefined) out[field] = data[field];
		}
		return JSON.stringify(out);
	}
	queueSave(id: ID) {
		if (this.saveTimer) clearTimeout(this.saveTimer);
		this.saveTimer = setTimeout(() => this.flush(id), SAVE_DELAY);
	}
	flush(id: ID) {
		if (this.saveTimer) clearTimeout(this.saveTimer);
		this.saveTimer = null;
		const json = id && this.speciesJSON(id);
		if (!json || this.saved[id] === json) return;
		this.queue = this.queue.filter(job => job.id !== id || !job.json);
		this.write({ command: `edit ${this.overlay!.Pokedex[id].name}, ${json}`, id, json });
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
		PS.send(`/cmd custompokemon ${this.pending.command}`);
	}
	receiveWrite(response: AnyObject | null) {
		const job = this.pending;
		this.pending = null;
		if (!response || response.actionerror) {
			PS.alert(response?.actionerror || `Couldn't save your custom Pokémon.`);
			job?.resolve?.(null);
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
	emptyMessage() {
		if (!PS.user.named) return `Log in to see your custom Pokémon`;
		if (this.error && !this.loading) return this.error;
		if (this.loading || !this.loadedFor) return `Loading your custom Pokémon...`;
		return `You haven't made any custom Pokémon yet`;
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
	const set = CustomDex.sprites[spriteIdOf(pokemon)];
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

const INSTAFILTERABLE: SearchType[] = ['type', 'ability', 'move'];

const allCache: { [type: string]: { rows: SearchRow[], table: { [id: string]: AnyObject } } } = {};
function allOf(searchType: 'ability' | 'move') {
	if (!allCache[searchType]) {
		const source = searchType === 'ability' ? BattleAbilities : BattleMovedex;
		const ids = Object.keys(source).filter(id => id !== 'noability');
		const get = (id: string) => (searchType === 'ability' ? Dex.abilities.get(id) : Dex.moves.get(id)).name;
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

export const SPECIES_FIELDS = [
	'types', 'baseStats', 'abilities', 'eggGroups', 'weightkg', 'heightm', 'color', 'gender',
	'genderRatio', 'evoType', 'evoLevel', 'evoCondition', 'forme', 'maxHP', 'cannotDynamax', 'tags',
];

export const EGG_GROUPS = [
	'Amorphous', 'Bug', 'Ditto', 'Dragon', 'Fairy', 'Field', 'Flying', 'Grass', 'Human-Like',
	'Mineral', 'Monster', 'Undiscovered', 'Water 1', 'Water 2', 'Water 3',
];
export const COLORS = ['Green', 'Red', 'Blue', 'White', 'Brown', 'Yellow', 'Purple', 'Pink', 'Gray', 'Black'];
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

export class PokebuilderDexSearch extends DexSearch {
	override setType(searchType: SearchType | '', format = '' as ID, speciesOrSet: ID | Dex.PokemonSet = '' as ID) {
		super.setType(searchType, format, speciesOrSet);
		this.restrict();
	}
	restrict() {
		const typedSearch = this.typedSearch as any;
		if (typedSearch?.searchType === 'pokemon') {
			typedSearch.getTable = () => CustomDex.pokedex();
			typedSearch.getBaseResults = typedSearch.getDefaultResults = () => CustomDex.baseResults();
		} else if (typedSearch?.searchType === 'ability' || typedSearch?.searchType === 'move') {
			const kind: 'ability' | 'move' = typedSearch.searchType;
			typedSearch.getTable = () => allOf(kind).table;
			typedSearch.getBaseResults = typedSearch.getDefaultResults = () => allOf(kind).rows;
			if (!typedSearch.unpinnedResults) {
				typedSearch.unpinnedResults = typedSearch.getResults.bind(typedSearch);
				typedSearch.getResults = (filters: AnyObject, sortCol: string, reverseSort: boolean) => {
					const rows = typedSearch.unpinnedResults(filters, sortCol, reverseSort);
					if (PICKER_SORTS.includes(sortCol)) return rows;
					return kind === 'move' ? pinMoves(typedSearch, rows) : pinAbilities(typedSearch, rows);
				};
			}
		} else {
			return;
		}
		typedSearch.baseResults = null;
		typedSearch.baseIllegalResults = null;
		typedSearch.illegalReasons = null;
	}
	refresh() {
		this.restrict();
		this.results = null;
		this.find(this.query);
	}
	override textSearch(query: string): SearchRow[] {
		if (this.typedSearch?.searchType !== 'pokemon') return super.textSearch(query);
		const id = toID(query);
		const rows = super.textSearch(query).filter(([rowType, value]) => (
			rowType !== 'pokemon' || CustomDex.has(value)
		));
		return (this.results = dropEmptyHeaders(
			[...CustomDex.nameMatches(id), ...this.instafilterCustom(id, rows), ...rows]
		));
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
