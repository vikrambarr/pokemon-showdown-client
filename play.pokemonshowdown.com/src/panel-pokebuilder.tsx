/**
 * Pokébuilder panel
 *
 * @author Guangcong Luo <guangcongluo@gmail.com>
 * @license AGPLv3
 */

import { PS, PSRoom, type RoomID, type RoomOptions, type Team } from "./client-main";
import { PSIcon, PSPanelWrapper, PSRoomPanel } from "./panels";
import { Dex, toID, type ID } from "./battle-dex";
import { BattleStatNames } from "./battle-dex-data";
import { BattleLog } from "./battle-log";
import { SetImportForm, TeamEditor, type SetEditor, type TeamEditorState } from "./battle-team-editor";
import {
	abilitySlots, COLORS, CustomDex, EGG_GROUPS, EVO_TYPES, exportSpecies, exportSpeciesList,
	type ParsedSpecies, parseSpecies, parseSpeciesList, PokebuilderDexSearch, speciesAbilities, TAGS,
} from "./client-custom-dex";

class PokebuilderRoom extends PSRoom {
	team: Team = {
		name: `Untitled`,
		format: Dex.modid,
		folder: '',
		packedTeam: '',
		iconCache: null,
		isBox: false,
		key: 'pokebuilder',
	};
	editor?: TeamEditorState;
	override clientCommands = this.parseClientCommands({
		'validate'(target) {
			if (this.team.format.length <= 4) {
				return this.errorReply(`You must select a format first.`);
			}
			this.send(`/utm ${this.team.packedTeam}`);
			this.send(`/vtm ${this.team.format}`);
		},
	});
	constructor(options: RoomOptions) {
		super(options);
		this.title = `Pokébuilder`;
	}
	override onParentKeyDown = (e?: Event) => {
		return this.editor?.handleParentKeyDown?.(e as KeyboardEvent);
	};
	setFormat(format: string) {
		this.team.format = toID(format);
	}
	openIds(): ID[] {
		return (this.editor?.sets || []).map(set => toID(set.species)).filter(Boolean);
	}
	/** Every open Pokemon with edits the server hasn't got yet. */
	unsavedIds() {
		return this.openIds().filter(id => CustomDex.isDirty(id));
	}
	flushAll() {
		for (const id of this.openIds()) CustomDex.flush(id);
	}
	/** What to do once the unsaved-changes popup is answered. */
	afterUnsaved: (() => void) | null = null;
	confirmUnsaved(then: () => void, elem?: HTMLElement | null) {
		if (!this.unsavedIds().length) {
			then();
			return true;
		}
		this.afterUnsaved = then;
		PS.join('pokebuilderunsaved' as RoomID, { parentElem: elem, parentRoomid: this.id });
		return false;
	}
	override interruptClose(explicit?: boolean, elem?: HTMLElement | null) {
		if (this.unsavedIds().length) {
			// `onbeforeunload` asks with `explicit`, and a popup opened behind the browser's
			// own prompt outlives a cancelled reload
			if (!explicit) {
				this.afterUnsaved = () => PS.leave(this.id);
				PS.join('pokebuilderunsaved' as RoomID, { parentElem: elem, parentRoomid: this.id });
			}
			return `You have unsaved Pokémon in ${this.title}`;
		}
		return super.interruptClose(explicit, elem);
	}
}

class PokebuilderUnsavedPanel extends PSRoomPanel {
	static readonly id = 'pokebuilderunsaved';
	static readonly routes = ['pokebuilderunsaved'];
	static readonly location = 'modal-popup';
	static readonly noURL = true;

	builder() {
		return this.props.room.getParent() as PokebuilderRoom | undefined;
	}
	finish(save: boolean) {
		const room = this.builder();
		if (!room) return;
		if (save) room.flushAll();
		else CustomDex.discard();
		const then = room.afterUnsaved;
		room.afterUnsaved = null;
		PS.leave(this.props.room.id);
		then?.();
	}
	saveAndGo = () => this.finish(true);
	discardAndGo = () => this.finish(false);
	cancel = () => {
		const room = this.builder();
		if (room) room.afterUnsaved = null;
		PS.leave(this.props.room.id);
	};

	override render() {
		const names = (this.builder()?.unsavedIds() || [])
			.map(id => CustomDex.overlay?.Pokedex[id]?.name || id);
		return <PSPanelWrapper room={this.props.room} width={480}><div class="pad">
			<p>You have unsaved changes to {names.join(', ') || 'your custom Pokémon'}.</p>
			<p>
				<button class="button" onClick={this.saveAndGo}><strong>Save changes</strong></button> {}
				<button class="button" onClick={this.discardAndGo}>Quit without saving</button> {}
				<button class="button" onClick={this.cancel}>Cancel</button>
			</p>
		</div></PSPanelWrapper>;
	}
}

const clampField = (field: string, amount: number) => {
	const { min, max } = CustomDex.limits[field] || {};
	return Math.min(Math.max(amount, min ?? -Infinity), max ?? Infinity);
};
const INT_FIELDS = ['evoLevel', 'maxHP'];
const NUMBER_FIELDS = ['weightkg', 'heightm', ...INT_FIELDS];
const MAX_ABILITIES = 3;
const MAX_BASE_STAT = 255;
const statLimit = () => CustomDex.limits.baseStat || { min: 1, max: MAX_BASE_STAT };
const SPRITES = [
	{ kind: 'front', label: 'F', width: 96, height: 96 },
	{ kind: 'back', label: 'B', width: 96, height: 96 },
	{ kind: 'front-shiny', label: 'F*', width: 96, height: 96 },
	{ kind: 'back-shiny', label: 'B*', width: 96, height: 96 },
	{ kind: 'icon', label: 'I', width: 40, height: 30 },
];
const STAT_BAR_WIDTH = 180;

const setIndexOf = (ev: Event) => Number((ev.currentTarget as HTMLElement).getAttribute('data-set-index'));
const popupSet = (room: PSRoom, setIndex: number) => (
	(room.getParent() as PokebuilderRoom | null)?.editor?.sets[setIndex]
);

class PokebuilderPanel extends PSRoomPanel<PokebuilderRoom> {
	static readonly id = 'pokebuilder';
	static readonly routes = ['pokebuilder'];
	static readonly Model = PokebuilderRoom;
	static readonly title = 'Pokébuilder';

	speciesPicker: 'prevo' | 'evos' | null = null;
	/** Which set the picker below is editing, remembered across focus changes. */
	focusIndex = 0;

	override componentWillUnmount() {
		this.props.room.editor = undefined;
		super.componentWillUnmount();
	}

	override componentDidMount() {
		super.componentDidMount();
		this.subscribeTo(CustomDex, () => {
			const search = this.props.room.editor?.search;
			if (search instanceof PokebuilderDexSearch) search.refresh();
			this.forceUpdate();
		});
		CustomDex.load();
	}

	initEditor = (editor: TeamEditorState) => {
		this.props.room.editor = editor;
		editor.setEditor = this.setEditor;
		editor.search = new PokebuilderDexSearch();
		editor.showItem = () => false;
		editor.showAbility = () => false;
		editor.getSearchMoves = () => [];
		const setSearchType = editor.setSearchType.bind(editor);
		editor.setSearchType = (type, i, value, typeIndex) => {
			this.focusIndex = i;
			// Any plain species focus (a tab, the + tab, the Pokemon field) leaves prevo/evos mode.
			if (type === 'pokemon') {
				this.resetSpeciesPicker();
				(editor.search as PokebuilderDexSearch).openIds =
					editor.sets.map((set, j) => (j === i ? '' : toID(set.species))).filter(Boolean) as ID[];
			}
			if (type !== 'move') return setSearchType(type, i, value, typeIndex);
			if (editor.innerFocus?.type === 'move') editor.innerFocus.typeIndex = -1;
			this.movesFor(i);
			setSearchType(type, i, '', -1);
		};
		editor.updateSearchMoves = set => {
			CustomDex.setLearnset(toID(set.species), set.moves.filter(Boolean));
			this.edited();
			(editor.search as PokebuilderDexSearch).refresh();
		};

		this.openPicker(editor.sets.length, 'pokemon');
	};

	openPicker(setIndex: number, type: 'pokemon' | 'ability' | 'move') {
		const editor = this.props.room.editor;
		if (!editor) return;
		editor.innerFocus = { setIndex, type, typeIndex: -1 };
		editor.setSearchType(type, setIndex, '', -1);
	}

	abilityEntries(setIndex: number) {
		return speciesAbilities(this.speciesFor(setIndex));
	}
	abilitySlotsFor(setIndex: number) {
		return this.abilityEntries(setIndex).map(([slot]) => slot);
	}
	abilitiesFor(setIndex: number) {
		const set = this.props.room.editor?.sets[setIndex];
		if (!set) return [];
		const abilities = this.abilityEntries(setIndex).map(([, name]) => name);
		set.abilities = abilities;
		return abilities;
	}
	movesFor(setIndex: number) {
		const set = this.props.room.editor?.sets[setIndex];
		if (!set) return [];
		set.moves = CustomDex.learnset(toID(set.species));
		return set.moves;
	}
	speciesFor(setIndex: number) {
		const set = this.props.room.editor?.sets[setIndex];
		return set ? Dex.species.get(set.species) : null;
	}
	statsFor(setIndex: number) {
		return this.speciesFor(setIndex)?.baseStats || null;
	}
	typesFor(setIndex: number) {
		return this.speciesFor(setIndex)?.types || [];
	}
	speciesId(setIndex: number) {
		return toID(this.props.room.editor?.sets[setIndex]?.species);
	}
	setAbilities(setIndex: number, abilities: string[]) {
		const set = this.props.room.editor?.sets[setIndex];
		if (!set) return;
		const table: AnyObject = {};
		const slots = abilitySlots(abilities.length, this.abilitySlotsFor(setIndex));
		abilities.forEach((name, i) => (table[slots[i]] = name));
		// Sturdy on 1 HP is the Shedinja pattern; nothing else sets maxHP, so it tracks the ability.
		const maxHP = abilities.some(name => toID(name) === 'sturdy') ? 1 : null;
		CustomDex.patch(this.speciesId(setIndex), { abilities: table, maxHP });
		this.edited();
		set.abilities = abilities;
		set.ability = abilities[0] || '';
	}
	syncAbilitySearch(setIndex: number) {
		const editor = this.props.room.editor;
		this.abilitiesFor(setIndex);
		if (editor?.innerFocus?.type === 'ability') (editor.search as PokebuilderDexSearch).refresh();
	}
	prevoFor(setIndex: number): string {
		return CustomDex.overlay?.Pokedex[this.speciesId(setIndex)]?.prevo || '';
	}
	evosFor(setIndex: number): string[] {
		return CustomDex.overlay?.Pokedex[this.speciesId(setIndex)]?.evos || [];
	}
	setRelatives(setIndex: number, changes: AnyObject) {
		CustomDex.patch(this.speciesId(setIndex), changes);
		this.edited();
	}
	syncSpeciesSearch(setIndex: number) {
		const editor = this.props.room.editor;
		const search = editor?.search as PokebuilderDexSearch | undefined;
		if (!search || !this.speciesPicker) return;
		search.selected = { pokemon: this.speciesPicker === 'prevo' ?
			[toID(this.prevoFor(setIndex))].filter(Boolean) :
			this.evosFor(setIndex).map(toID) };
		if (editor?.innerFocus?.type === 'pokemon') search.refresh();
	}
	/** Back to the builder's own species list; the relatives pickers borrow the same focus type. */
	resetSpeciesPicker() {
		const search = this.props.room.editor?.search as PokebuilderDexSearch | undefined;
		this.speciesPicker = null;
		if (search) {
			search.speciesMode = 'own';
			search.selected = null;
			search.pickerExclude = null;
		}
	}
	openRelatives(setIndex: number, kind: 'prevo' | 'evos') {
		this.openPicker(setIndex, 'pokemon');
		const search = this.props.room.editor?.search as PokebuilderDexSearch | undefined;
		this.speciesPicker = kind;
		if (search) {
			search.speciesMode = 'all';
			search.pickerExclude = this.speciesId(setIndex);
		}
		this.syncSpeciesSearch(setIndex);
		this.props.room.editor?.update();
	}
	openPrevo = (ev: Event) => this.openRelatives(setIndexOf(ev), 'prevo');
	openEvos = (ev: Event) => this.openRelatives(setIndexOf(ev), 'evos');
	removePrevo = (ev: Event) => {
		ev.stopPropagation();
		const setIndex = setIndexOf(ev);
		this.setRelatives(setIndex, { prevo: null });
		this.syncSpeciesSearch(setIndex);
		this.props.room.editor?.update();
	};
	removeEvo = (ev: Event) => {
		ev.stopPropagation();
		const setIndex = setIndexOf(ev);
		const name = (ev.currentTarget as HTMLElement).getAttribute('data-evo')!;
		const evos = this.evosFor(setIndex).filter(evo => evo !== name);
		this.setRelatives(setIndex, { evos: evos.length ? evos : null });
		this.syncSpeciesSearch(setIndex);
		this.props.room.editor?.update();
	};
	openAbilities = (ev: Event) => {
		const setIndex = setIndexOf(ev);
		this.resetSpeciesPicker();
		this.openPicker(setIndex, 'ability');
		this.syncAbilitySearch(setIndex);
		this.props.room.editor?.update();
	};
	removeAbility = (ev: Event) => {
		ev.stopPropagation();
		const editor = this.props.room.editor;
		if (!editor) return;
		const target = ev.currentTarget as HTMLElement;
		this.setEditor.selectAbility!(editor, setIndexOf(ev), target.getAttribute('data-ability')!);
		editor.update();
	};
	openMoves = (ev: Event) => {
		this.resetSpeciesPicker();
		this.openPicker(setIndexOf(ev), 'move');
		this.props.room.editor?.update();
	};
	dragAbility = (ev: DragEvent) => {
		ev.dataTransfer!.effectAllowed = 'move';
		ev.dataTransfer!.setData('text/plain', (ev.currentTarget as HTMLElement).getAttribute('data-index')!);
	};
	dragOverAbility = (ev: DragEvent) => {
		ev.preventDefault();
		ev.dataTransfer!.dropEffect = 'move';
	};
	dropAbility = (ev: DragEvent) => {
		ev.preventDefault();
		const box = ev.currentTarget as HTMLElement;
		const from = Number(ev.dataTransfer!.getData('text/plain'));
		if (isNaN(from)) return;
		const chips = box.querySelectorAll('.chip');
		let to = chips.length - 1;
		for (let i = 0; i < chips.length; i++) {
			if (ev.clientX < chips[i].getBoundingClientRect().right) {
				to = i;
				break;
			}
		}
		if (to === from) return;
		const setIndex = setIndexOf(ev);
		const abilities = this.abilitiesFor(setIndex).slice();
		abilities.splice(to, 0, abilities.splice(from, 1)[0]);
		this.setAbilities(setIndex, abilities);
		this.props.room.editor?.update();
	};
	openTypePicker = (ev: Event) => {
		(ev.currentTarget as HTMLElement).parentElement!.querySelector('select')!.showPicker();
	};
	changeBaseStat = (ev: Event) => {
		const target = ev.currentTarget as HTMLInputElement;
		const value = Math.min(Math.abs(parseInt(target.value)), statLimit().max!);
		if (!value) return;
		const setIndex = setIndexOf(ev);
		const baseStats = { ...this.statsFor(setIndex) } as AnyObject;
		baseStats[target.name] = value;
		CustomDex.patch(this.speciesId(setIndex), { baseStats });
		this.edited();
		this.props.room.editor?.update();
	};
	changeType = (ev: Event) => {
		const target = ev.currentTarget as HTMLSelectElement;
		const editor = this.props.room.editor;
		if (!editor) return;
		const setIndex = setIndexOf(ev);
		const typeIndex = Number(target.getAttribute('data-type-index'));
		const types = this.typesFor(setIndex).slice();
		if (target.value && types.some((type, i) => i !== typeIndex && type === target.value)) return;
		types[typeIndex] = target.value as Dex.TypeName;
		CustomDex.patch(this.speciesId(setIndex), { types: types.filter(Boolean) });
		this.edited();
		editor.update();
	};
	rename = (ev: Event) => {
		// Without this the same click reaches PS's outside-click handler and closes the prompt.
		ev.preventDefault();
		ev.stopImmediatePropagation();
		const editor = this.props.room.editor;
		const set = editor?.sets[setIndexOf(ev)];
		if (!set) return;
		const oldName = set.species;
		PS.prompt(`Rename \`\`${oldName}\`\` to?`, {
			defaultValue: oldName, okButton: 'Rename', parentElem: ev.currentTarget as HTMLElement,
		}).then(name => {
			name = name?.trim() || '';
			if (!name || name === oldName) return;
			CustomDex.flush(toID(oldName));
			CustomDex.rename(oldName, name).then(renamed => {
				if (!renamed) return;
				set.species = renamed;
				editor.update();
			});
		});
	};
	createSpecies = (ev: Event) => {
		// See rename: an unstopped click reaches PS's outside-click handler and closes the popup.
		ev.preventDefault();
		ev.stopImmediatePropagation();
		const max = CustomDex.limits.species?.max;
		if (max !== undefined && CustomDex.ids.length >= max) {
			return PS.alert(`You already have ${max} custom Pokémon, which is the limit. Delete one first.`);
		}
		PS.prompt(`Name your new Pokémon:`, {
			okButton: 'Create', parentElem: ev.currentTarget as HTMLElement,
		}).then(name => {
			name = name?.trim() || '';
			if (!name) return;
			CustomDex.create(name).then(created => this.openSpecies(created || undefined));
		});
	};
	removeSpecies(name: string, parentElem: HTMLElement, setIndex: number) {
		PS.confirm(`Delete \`\`${name}\`\`? This can't be undone.`, { okButton: 'Delete', parentElem }).then(ok => {
			if (!ok) return;
			// Ahead of the delete in the same serial queue, so a pending edit can't outlive it.
			CustomDex.flush(toID(name));
			CustomDex.write({ command: `delete ${name}`, id: toID(name) });
			const editor = this.props.room.editor;
			if (!editor) return;
			editor.sets.splice(setIndex, 1);
			editor.save();
			if (!editor.sets.length) {
				this.clearEditor();
			} else {
				this.openPicker(Math.min(setIndex, editor.sets.length - 1), 'move');
			}
			editor.update();
		});
	}
	deleteSpecies = (ev: Event) => {
		// See rename: an unstopped click reaches PS's outside-click handler and closes the popup.
		ev.preventDefault();
		ev.stopImmediatePropagation();
		const setIndex = Number((ev.currentTarget as HTMLButtonElement).value);
		const set = this.props.room.editor?.sets[setIndex];
		if (set) this.removeSpecies(set.species, ev.currentTarget as HTMLElement, setIndex);
	};
	openSpecies(name?: string) {
		const editor = this.props.room.editor;
		if (!editor || !name) return;
		this.resetSpeciesPicker();
		const setIndex = Math.min(editor.innerFocus?.setIndex ?? editor.sets.length, editor.sets.length);
		const set = (editor.sets[setIndex] ||= { species: '', moves: [] });
		// the species leaving this slot drops out of `openIds`, so nothing would send its edits
		CustomDex.flush(toID(set.species));
		editor.changeSpecies(set, name);
		editor.save();
		// Where selecting an existing species lands, via focusAdjacentField.
		this.openPicker(setIndex, 'move');
		editor.update();
	}
	/** Applies a pasted species to this slot, renaming it if the paste gives another name. */
	importSpecies(setIndex: number, text: string): string {
		const parsed = parseSpecies(text);
		if (typeof parsed === 'string') return parsed;
		const id = this.speciesId(setIndex);
		if (toID(parsed.name) !== id) {
			CustomDex.flush(id);
			CustomDex.rename(CustomDex.overlay!.Pokedex[id].name, parsed.name).then(renamed => {
				if (!renamed) return;
				const set = this.props.room.editor?.sets[setIndex];
				if (set) set.species = renamed;
				this.applyImport(toID(renamed), parsed);
			});
			return '';
		}
		this.applyImport(id, parsed);
		return '';
	}
	/** Applies a pasted list to the collection, creating whatever it doesn't hold yet. */
	importList(text: string): string {
		const parsed = parseSpeciesList(text);
		if (typeof parsed === 'string') return parsed;
		// one at a time: a Pokemon has to exist before the edit that fills it in, and the list
		// screen has no Save button, so each one goes to the server as it lands
		void parsed.reduce((chain, entry) => chain.then(() => {
			const id = toID(entry.name);
			if (CustomDex.has(id)) return void this.saveImport(id, entry);
			return CustomDex.create(entry.name).then(created => {
				if (created) this.saveImport(toID(created), entry);
			});
		}), Promise.resolve() as Promise<unknown>);
		return '';
	}
	saveImport(id: ID, parsed: ParsedSpecies) {
		this.applyImport(id, parsed);
		CustomDex.flush(id);
	}
	applyImport(id: ID, parsed: ParsedSpecies) {
		const { inheritsFrom, ...fields } = parsed.fields;
		CustomDex.setInherits(id, inheritsFrom ?? null);
		CustomDex.patch(id, fields);
		CustomDex.setLearnset(id, parsed.moves);
		this.edited();
		this.props.room.editor?.update();
	}
	back = (ev?: Event) => {
		// See rename: an unstopped click reaches PS's outside-click handler and closes the popup.
		ev?.preventDefault();
		ev?.stopImmediatePropagation();
		this.props.room.confirmUnsaved(() => this.clearEditor(), ev?.currentTarget as HTMLElement);
	};
	clearEditor() {
		const editor = this.props.room.editor;
		if (!editor) return;
		this.resetSpeciesPicker();
		this.focusIndex = 0;
		editor.sets.splice(0);
		editor.save();
		this.openPicker(0, 'pokemon');
		editor.update();
	}
	detail = (ev: Event) => {
		const target = ev.currentTarget as HTMLInputElement;
		const setIndex = setIndexOf(ev);
		const value = target.type === 'checkbox' ? target.checked : target.value.trim();
		this.patchField(setIndex, target.name, value);
	};
	toggleTag = (ev: Event) => {
		const setIndex = setIndexOf(ev);
		const tag = (ev.currentTarget as HTMLElement).getAttribute('data-tag')!;
		const tags = (CustomDex.overlay?.Pokedex[this.speciesId(setIndex)]?.tags || []).slice();
		const index = tags.indexOf(tag);
		if (index >= 0) {
			tags.splice(index, 1);
		} else {
			tags.push(tag);
		}
		this.patchField(setIndex, 'tags', tags.join(','));
	};
	clearRatio = (ev: Event) => {
		this.patchField(setIndexOf(ev), 'genderRatio', '');
	};
	patchField(setIndex: number, field: string, value: string | boolean) {
		const id = this.speciesId(setIndex);
		const data = CustomDex.overlay?.Pokedex[id];
		if (!data) return;
		const changes: AnyObject = {};
		if (field === 'eggGroup0' || field === 'eggGroup1') {
			const groups = (data.eggGroups || []).slice();
			groups[field === 'eggGroup0' ? 0 : 1] = value as string;
			const kept = groups.filter(Boolean);
			if (!kept.length && CustomDex.requires(id, 'eggGroups')) return;
			changes.eggGroups = kept.length ? kept : null;
		} else if (value === '' || value === false) {
			if (CustomDex.requires(id, field)) return;
			changes[field] = null;
		} else if (NUMBER_FIELDS.includes(field)) {
			const amount = INT_FIELDS.includes(field) ? parseInt(value as string) : Number(value);
			if (!Number.isFinite(amount)) return;
			changes[field] = clampField(field, amount);
		} else if (field === 'genderRatio') {
			const male = Number(value) / 8;
			changes.genderRatio = { M: male, F: Math.round((1 - male) * 1000) / 1000 };
		} else if (field === 'tags') {
			changes.tags = (value as string).split(',').map(tag => tag.trim()).filter(Boolean);
		} else {
			const limit = CustomDex.limits[field]?.maxLength;
			changes[field] = limit ? (value as string).slice(0, limit) : value;
		}
		CustomDex.patch(id, changes);
		this.edited();
	}
	setEditor: SetEditor = {
		back: this.back,
		hideCopy: true,
		hideSampleSets: true,
		renderActions: () => {
			const unsaved = this.props.room.unsavedIds().length;
			return <><button
				class="option" onClick={this.saveEdits} disabled={!unsaved}
				title={unsaved ? 'Save changes to the server' : 'No unsaved changes'}
			>
				<i class={`fa fa-${unsaved ? 'floppy-o' : 'check'}`} aria-hidden></i> {}
				{unsaved ? 'Save' : 'Saved'}
			</button> {}</>;
		},
		/** The tab's text is the Pokemon being edited; the team paste behind it means nothing here. */
		textTab: editor => <SetImportForm
			editor={editor} setIndex={Math.min(this.focusIndex, editor.sets.length - 1)}
			set={editor.sets[Math.min(this.focusIndex, editor.sets.length - 1)]}
			onChange={() => editor.update()}
		/>,
		// no Pokemon is open on the list screen, where the text is the whole collection instead
		importExport: {
			label: 'Pok\u00e9mon',
			export: (_editor, setIndex) => (
				this.speciesId(setIndex) ? exportSpecies(this.speciesId(setIndex)) : exportSpeciesList()
			),
			import: (_editor, setIndex, text) => (
				this.speciesId(setIndex) ? this.importSpecies(setIndex, text) : this.importList(text)
			),
		},
		titles: {
			back: 'Save and return to your Pokemon list',
			import: 'Import or export this Pokemon as text',
			delete: 'Delete this custom Pokemon',
			pokemon: 'Switch to another Pokemon',
			details: 'Change details',
			stats: 'Change stats',
		},
		renderAbilities: (editor, setIndex) => {
			const abilities = this.abilitiesFor(setIndex);
			const slots = this.abilitySlotsFor(setIndex);
			const focus = editor.innerFocus;
			const cur = focus?.type === 'ability' && focus.setIndex === setIndex ? ' cur' : '';
			return <td class="set-abilities" colSpan={2}><div class="border-collapse">
				<label class="label">Abilities</label>
				<div
					class={`textbox chipbox${cur}`} data-set-index={setIndex} onClick={this.openAbilities}
					onDragOver={this.dragOverAbility} onDrop={this.dropAbility}
					title="Change abilities"
				>
					{abilities.map((ability, index) => <span
						class="chip" draggable data-index={index} onDragStart={this.dragAbility}
					>
						<small>{slots[index]}:</small> {ability} <button
							class="chipx" data-set-index={setIndex} data-ability={ability} onClick={this.removeAbility}
						>×</button>
					</span>)}
					{!abilities.length && <span class="chipnote">(choose up to 3 abilities)</span>}
				</div>
			</div></td>;
		},
		renderTypes: (_editor, setIndex) => {
			const types = this.typesFor(setIndex);
			if (!this.speciesId(setIndex)) return <div />;
			return <div class="typeselects">{[0, 1].map(typeIndex => (
				<span class="typeslot" title={typeIndex ? 'Change secondary type' : 'Change primary type'}>
					{types[typeIndex] ? <PSIcon type={types[typeIndex]} new /> : <span class="typeicon-blank" />}
					<select
						name="type" class="typearrow base-select" data-set-index={setIndex} data-type-index={typeIndex}
						onChange={this.changeType} value={types[typeIndex] || ''}
					>
						<button></button>
						{!!typeIndex && <option value="">—</option>}
						{Dex.types.all().map(type => type.name !== types[1 - typeIndex] &&
							<option value={type.name}><PSIcon type={type.name} new /></option>)}
					</select>
					<svg class="typecaret" width="14" height="9" viewBox="0 0 14 9" onClick={this.openTypePicker}>
						<path d="M1 1H13L7 8Z" fill="#fff" stroke="#000" stroke-width="1.5" stroke-linejoin="round" />
					</svg>
				</span>
			))}</div>;
		},
		renderMoves: (editor, setIndex) => {
			const moves = this.movesFor(setIndex);
			const focus = editor.innerFocus;
			const here = focus?.setIndex === setIndex;
			const cur = here && focus?.type === 'move' ? ' cur' : '';
			const picking = (kind: 'prevo' | 'evos') =>
				here && focus?.type === 'pokemon' && this.speciesPicker === kind ? ' cur' : '';
			const prevo = this.prevoFor(setIndex);
			const evos = this.evosFor(setIndex);
			return <div class="border-collapse movescell">
				<label class="label">Evolves from</label>
				<div
					class={`textbox chipbox${picking('prevo')}`} data-set-index={setIndex} onClick={this.openPrevo}
					title="Change pre-evolution"
				>
					{prevo ? <>
						<span class="chipvalue">{prevo}</span> <button
							class="chipx" data-set-index={setIndex} onClick={this.removePrevo}
						>×</button>
					</> : <span class="chipnote">(none)</span>}
				</div>
				<label class="label">Evolves into</label>
				<div
					class={`textbox chipbox${picking('evos')}`} data-set-index={setIndex} onClick={this.openEvos}
					title="Change evolutions"
				>
					{evos.map(evo => <span class="chip">
						{evo} <button
							class="chipx" data-set-index={setIndex} data-evo={evo} onClick={this.removeEvo}
						>×</button>
					</span>)}
					{!evos.length && <span class="chipnote">(no evolutions)</span>}
				</div>
				<label class="label">Learnset</label>
				<div
					class={`textbox chipbox${cur}`} data-set-index={setIndex} onClick={this.openMoves}
					title="Change learnset"
				>
					<span class="chipnote">{moves.length} move{moves.length === 1 ? '' : 's'}</span>
				</div>
			</div>;
		},
		renderStats: (_editor, setIndex) => {
			const stats = this.statsFor(setIndex);
			if (!stats) return null;
			const { min = 1, max = MAX_BASE_STAT } = statLimit();
			return <div style="font-size:10pt" role="dialog" aria-label="Stats"><div class="pad"><table>
				<tr><th></th><th>Base</th><th class="setstatbar"></th></tr>
				{Dex.statNames.map(statID => {
					const value = stats[statID];
					const width = Math.floor(value * STAT_BAR_WIDTH / max);
					const hue = Math.min(width, 360);
					return <tr>
						<th style="text-align:right;font-weight:normal">{BattleStatNames[statID]}</th>
						<td><input
							type="number" min={min} max={max} step={1} name={statID} value={value}
							data-set-index={setIndex} class="textbox stat-input" style="width:52px"
							onInput={this.changeBaseStat} title={`Change base ${BattleStatNames[statID]}`}
						/></td>
						<td class="setstatbar"><label
							class="statslider" title={`Change base ${BattleStatNames[statID]}`}
						>
							<span style={`width:${width}px;background:hsl(${hue},85%,45%);border-color:hsl(${hue},85%,35%)`}></span>
							<input
								type="range" name={statID} min={min} max={max} value={value}
								data-set-index={setIndex} onInput={this.changeBaseStat}
							/>
						</label></td>
					</tr>;
				})}
			</table></div></div>;
		},
		renderStatCell: (_editor, setIndex) => {
			const stats = this.statsFor(setIndex);
			if (!stats) return null;
			return Dex.statNames.map(statID => {
				const value = stats[statID];
				const hue = Math.min(Math.floor(value * 180 / statLimit().max!), 360);
				return <span class="statrow">
					<em>{BattleStatNames[statID]}</em> {}
					<span class="statgraph">
						<span style={`width:${value * 75 / statLimit().max!}px;` +
							`background:hsl(${hue},40%,75%);border-color:hsl(${hue},40%,45%)`}
						></span>
					</span> {}
					<strong>{value}</strong>
				</span>;
			});
		},
		deleteSet: this.deleteSpecies,
		restoreFocus: editor => {
			this.resetSpeciesPicker();
			const setIndex = Math.min(this.focusIndex, editor.sets.length);
			this.openPicker(setIndex, editor.sets[setIndex] ? 'move' : 'pokemon');
		},
		renderSearchBottom: (editor, setIndex, type) => (type === 'pokemon' && !editor.sets[setIndex] && (
			<button class="newmon" onClick={this.createSpecies} title="Create a new custom Pokemon">
				<i class="fa fa-plus" aria-hidden></i> <strong>New Pokémon</strong>
			</button>
		)),
		renderRename: (_editor, setIndex) => (
			<button
				type="button" class="button rename" data-set-index={setIndex}
				onClick={this.rename} aria-label="Rename" title="Change name"
			>
				<i class="fa fa-pencil" aria-hidden></i>
			</button>
		),
		renderDetailCell: (_editor, setIndex) => {
			const data = CustomDex.overlay?.Pokedex[this.speciesId(setIndex)];
			if (!data) return null;
			return <>
				<span class="detailcell"><label>Egg</label> {(data.eggGroups || ['—']).join(', ')}</span>
				<span class="detailcell"><label>Weight</label> {data.weightkg ?? '—'}kg</span>
				<span class="detailcell"><label>Height</label> {data.heightm ?? '—'}m</span>
			</>;
		},
		renderDetails: (_editor, setIndex) => {
			const data = CustomDex.overlay?.Pokedex[this.speciesId(setIndex)];
			if (!data) return null;
			const eggGroups = data.eggGroups || [];
			const eighths = data.genderRatio ? Math.round(data.genderRatio.M * 8) : 4;
			const field = (label: string, control: preact.ComponentChildren) => (
				<tr><th>{label}</th><td>{control}</td></tr>
			);
			const text = (name: string, value: any, title: string, width = 60) => <input
				type={NUMBER_FIELDS.includes(name) ? 'number' : 'text'} name={name} value={value ?? ''}
				min={CustomDex.limits[name]?.min} max={CustomDex.limits[name]?.max}
				maxLength={CustomDex.limits[name]?.maxLength}
				step={INT_FIELDS.includes(name) ? 1 : 'any'} data-set-index={setIndex}
				class="textbox stat-input" style={`width:${width}px`} onChange={this.detail} title={title}
			/>;
			const select = (name: string, value: any, options: string[], title: string, blank = true) => <select
				name={name} value={value || ''} data-set-index={setIndex} class="select"
				onChange={this.detail} title={title}
			>
				{blank && <option value="">—</option>}
				{options.map(option => <option value={option}>{option}</option>)}
			</select>;
			return <div style="font-size:10pt" role="dialog" aria-label="Details"><div class="pad">
				<table class="detailtable">
					{field('Weight', <>{text('weightkg', data.weightkg, 'Change weight in kilograms')} kg</>)}
					{field('Height', <>{text('heightm', data.heightm, 'Change height in metres')} m</>)}
					{field('Gender', select('gender', data.gender, ['M', 'F', 'N'], 'Change gender lock'))}
					{field('Gender ratio', <span class="genderratio">
						<input
							type="range" name="genderRatio" min="0" max="8" step="1"
							class={data.genderRatio ? 'ratioset' : ''} style={`--fill:${9 + eighths * 12}px`}
							value={eighths} data-set-index={setIndex} onInput={this.detail}
							title="Change chance of being male"
						/>
						{!!data.genderRatio && <button
							class="chipx" data-set-index={setIndex} onClick={this.clearRatio}
						>×</button>}
					</span>)}
					{field('Egg Groups', <>
						{select('eggGroup0', eggGroups[0], EGG_GROUPS, 'Change egg group')} {}
						{select('eggGroup1', eggGroups[1], EGG_GROUPS, 'Change second egg group')}
					</>)}
					<tr class="divider"><td colSpan={2}><hr /></td></tr>
					{field('Tags', <span class="tagpicker" title="Change tags">{[
						...TAGS, ...(data.tags || []).filter((tag: string) => !TAGS.includes(tag)),
					].map(tag => <button
						class={`button${(data.tags || []).includes(tag) ? ' cur' : ''}`}
						data-set-index={setIndex} data-tag={tag} onClick={this.toggleTag}
					>{tag}</button>)}</span>)}
					<tr class="divider"><td colSpan={2}><hr /></td></tr>
					{field('Evo type', select('evoType', data.evoType, EVO_TYPES, 'Change how it evolves'))}
					{field('Evo level', text('evoLevel', data.evoLevel, 'Change evolution level', 40))}
					{field('Evo condition',
						text('evoCondition', data.evoCondition, 'Change evolution condition', 160))}
					<tr class="divider"><td colSpan={2}><hr /></td></tr>
					{field('Color', select('color', data.color, COLORS, 'Change Pokedex colour'))}
					{field('Category', <>The {text('category', data.category, 'Change category', 120)} Pokémon</>)}
					{field('Dex entry', <textarea
						name="dexEntry" data-set-index={setIndex} class="textbox dexentry"
						maxLength={CustomDex.limits.dexEntry?.maxLength} title="Change Pokedex entry"
						rows={3} onChange={this.detail} value={data.dexEntry || ''}
					/>)}
				</table>
			</div></div>;
		},
		renderNickname: (_editor, setIndex) => {
			const stored = CustomDex.sprites[this.speciesId(setIndex)] || {};
			return <label class="label">
				<span>Sprites</span>
				<div class="textbox spritebox" title="Change sprites">
					{SPRITES.map((sprite, kindIndex) => (
						<button
							class={`spritecell ${stored[sprite.kind] ? 'has' : 'missing'}`}
							data-href={`pbsprite-${setIndex}-${kindIndex}`}
						>{sprite.label}</button>
					))}
				</div>
			</label>;
		},
		selectSpecies: (_editor, setIndex, name) => {
			if (!this.speciesPicker) return false;
			const id = this.speciesId(setIndex);
			const picked = Dex.species.get(name).name;
			if (!id || toID(picked) === id) return true;
			if (this.speciesPicker === 'prevo') {
				const cleared = toID(this.prevoFor(setIndex)) === toID(picked);
				this.setRelatives(setIndex, { prevo: cleared ? null : picked });
			} else {
				const evos = this.evosFor(setIndex).slice();
				const index = evos.findIndex(evo => toID(evo) === toID(picked));
				if (index >= 0) evos.splice(index, 1);
				else evos.push(picked);
				this.setRelatives(setIndex, { evos: evos.length ? evos : null });
			}
			this.syncSpeciesSearch(setIndex);
			return true;
		},
		selectAbility: (editor, setIndex, name) => {
			const abilities = this.abilitiesFor(setIndex).slice();
			const index = abilities.indexOf(name);
			if (index >= 0) {
				if (abilities.length === 1 && CustomDex.requires(this.speciesId(setIndex), 'abilities')) {
					return PS.alert(`A Pokémon needs at least one ability.`);
				}
				abilities.splice(index, 1);
			} else if (abilities.length < MAX_ABILITIES) {
				abilities.push(name);
			}
			this.setAbilities(setIndex, abilities);
			this.syncAbilitySearch(setIndex);
		},
	};

	override focus() {
		const searchBox = this.base?.querySelector<HTMLInputElement>('input[name=value]');
		if (searchBox) {
			searchBox.focus();
			searchBox.select?.();
			return;
		}
		super.focus();
	}

	handleRename = (ev: Event) => {
		this.props.room.team.name = (ev.currentTarget as HTMLInputElement).value.trim();
	};

	handleChangeFormat = (ev: Event) => {
		this.props.room.setFormat((ev.currentTarget as HTMLButtonElement).value);
		this.forceUpdate();
	};
	/** An edit landed locally; saving to the server is the Save button's job now. */
	edited = () => {
		this.forceUpdate();
	};
	saveEdits = () => {
		this.props.room.flushAll();
		this.forceUpdate();
	};
	override render() {
		const { room } = this.props;
		const team = room.team;

		return <PSPanelWrapper room={room}><div class="pokebuilder">
			<div class="team-pad">
				<div style={room.width < 550 ? "margin-top:8px" : "float:right"}><button
					name="format" value={team.format} data-selecttype="teambuilder"
					class="select formatselect" data-href="/formatdropdown" onChange={this.handleChangeFormat}
				>
					<i class="fa fa-folder-o"></i> {BattleLog.formatName(team.format)} {}
					{team.format.length <= 4 && <em>(uncategorized)</em>}
				</button></div>
				<label class="label teamname">
					Name:{}
					<input
						class="textbox" type="text" defaultValue={team.name}
						onInput={this.handleRename} onChange={this.handleRename} onKeyUp={this.handleRename}
					/>
				</label>
			</div>
			<TeamEditor
				team={team} onChange={this.edited}
				narrow={room.width < 550}
				editorRef={this.initEditor}
			/>
		</div></PSPanelWrapper>;
	}
}

class SpritePanel extends PSRoomPanel {
	static readonly id = 'pbsprite';
	static readonly routes = ['pbsprite-*'];
	static readonly location = 'popup';
	static readonly noURL = true;

	sprite() {
		const [, setIndex, kindIndex] = this.props.room.id.split('-');
		return { set: popupSet(this.props.room, Number(setIndex)), ...SPRITES[Number(kindIndex)] };
	}
	pick = () => {
		this.base!.querySelector<HTMLInputElement>('input[type=file]')!.click();
	};
	upload = (ev: Event) => {
		const file = (ev.currentTarget as HTMLInputElement).files?.[0];
		const { set, kind, width, height } = this.sprite();
		const species = set?.species;
		if (!file || !species) return;
		const image = new Image();
		const src = URL.createObjectURL(file);
		image.onerror = () => {
			URL.revokeObjectURL(src);
			PS.alert(`That image couldn't be read. Try a PNG, JPEG or GIF.`);
		};
		image.onload = () => {
			URL.revokeObjectURL(src);
			const canvas = document.createElement('canvas');
			canvas.width = width;
			canvas.height = height;
			const context = canvas.getContext('2d')!;
			context.imageSmoothingEnabled = false;
			const scale = Math.min(width / image.width, height / image.height);
			const drawWidth = Math.round(image.width * scale);
			const drawHeight = Math.round(image.height * scale);
			context.drawImage(image, (width - drawWidth) >> 1, (height - drawHeight) >> 1, drawWidth, drawHeight);
			CustomDex.write({
				command: `setsprite ${species}, ${kind}, ${canvas.toDataURL('image/png')}`, id: toID(species),
			});
			this.close();
		};
		image.src = src;
	};
	remove = () => {
		const { set, kind } = this.sprite();
		if (!set) return;
		CustomDex.write({ command: `clearsprite ${set.species}, ${kind}`, id: toID(set.species) });
		this.close();
	};
	override render() {
		const { set, kind, width, height } = this.sprite();
		const url = CustomDex.sprites[toID(set?.species)]?.[kind];
		return <PSPanelWrapper room={this.props.room}><div class="pad">
			<p><strong>{kind}</strong> <small>({width}&times;{height})</small></p>
			<p>{url ? (
				<img src={url} width={width} height={height} alt={kind} class="pixelated" />
			) : <em>No sprite yet</em>}</p>
			<p>
				<button class="button" onClick={this.pick}>Upload</button> {}
				{!!url && <button class="button" onClick={this.remove}>Delete</button>}
			</p>
			<input type="file" accept="image/*" style="display:none" onChange={this.upload} />
		</div></PSPanelWrapper>;
	}
}

PS.addRoomType(PokebuilderPanel);
PS.addRoomType(PokebuilderUnsavedPanel);
PS.addRoomType(SpritePanel);
