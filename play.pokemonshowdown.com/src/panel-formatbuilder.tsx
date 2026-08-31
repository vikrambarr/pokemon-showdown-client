/**
 * Formatbuilder panel
 *
 * The teambuilder's own room and panel, under a second roomid, so the view is identical
 * to start with and diverges from here. The team pane lists the user's custom formats.
 *
 * @license AGPLv3
 */

import { PS, type RoomID, type Team } from "./client-main";
import { PSPanelWrapper, PSRoomPanel } from "./panels";
import { BattleLog } from "./battle-log";
import { Dex, type ID, toID } from "./battle-dex";
import { TeambuilderPanel, TeambuilderRoom } from "./panel-teambuilder";
import { SetImportForm, type SetEditor, type TeamEditorState } from "./battle-team-editor";
import { TeamPanel, TeamRoom } from "./panel-teambuilder-team";
import {
	CustomDex, emptyRoster, exportFormat, parseFormat, ROSTER_KINDS, type RosterKind,
	PokebuilderDexSearch,
} from "./client-custom-dex";

/** What each picker edits: the label on its button, and how a rule names one of its entries. */
type NamedTable = { get: (name: string) => { id: ID, name: string, exists: boolean } };
const PICKERS: { [kind in RosterKind]: { label: string, prefix: string, dex: NamedTable } } = {
	pokemon: { label: 'Pok\u00e9mon', prefix: '', dex: Dex.species },
	move: { label: 'Moves', prefix: 'move:', dex: Dex.moves },
	ability: { label: 'Abilities', prefix: 'ability:', dex: Dex.abilities },
	item: { label: 'Items', prefix: 'item:', dex: Dex.items },
};
/** The tags a format can ban, in the order the editor shows them. */
const TAG_GROUPS = [
	{ kind: 'pokemon', name: 'Pok\u00e9mon tag' },
	{ kind: 'move', name: 'Move tag' },
	{ kind: 'other', name: 'Tag' },
];
/** The rule that turns a list into an allowlist, one per picker. */
const ALL_OF: { [kind in RosterKind]: string } = {
	pokemon: 'All Pokemon', move: 'All Moves', ability: 'All Abilities', item: 'All Items',
};
/** How a picker's own entry is spelled, prefixed where a bare name could mean two things. */
function ruleFor(kind: RosterKind, id: ID) {
	return `${PICKERS[kind].prefix}${PICKERS[kind].dex.get(id).name}`;
}
/** Whether a stored rule is a picker's own, so rewriting a list doesn't drop the owner's rules. */
function pickerRule(rule: string) {
	if (Object.values(ALL_OF).some(all => toID(all) === toID(rule))) return true;
	if (/^(?:base)?(?:pokemon|move|ability|item):/.test(rule)) return true;
	return ROSTER_KINDS.some(kind => PICKERS[kind].dex.get(rule).exists);
}

/** The mod a format is played under: its own if it names one, otherwise its base format's. */
function formatMod(format: { mod: string, baseMod?: string }) {
	return format.mod || format.baseMod || Dex.modid;
}

export class FormatbuilderRoom extends TeambuilderRoom {}

/**
 * The team each format room is edited through. Kept out of `PS.teams` (these aren't the user's
 * teams) and off the room itself, since a subclass field initializer would run after the
 * `TeamRoom` constructor has already asked for it.
 */
const formatTeams: { [id: string]: Team } = {};

/** A format room borrows the team editor's screen, so it needs a team to render. */
export class FormatRoom extends TeamRoom {
	override pendingMessage() {
		return CustomDex.pendingReason('formats');
	}
	override roomLabel() {
		return 'Format';
	}
	formatEntry() {
		return CustomDex.overlay?.formats?.find(entry => entry.id === this.id.slice(7));
	}
	/**
	 * Applies an edit locally so nothing sits a click behind, then asks what rules it produced.
	 * `keepsDefault` is for the pickers: what the rules allow on their own doesn't count their own
	 * output, so only they can edit a list without changing what "reset" goes back to.
	 */
	applyEdit(changes: AnyObject, keepsDefault?: boolean) {
		const entry = this.formatEntry();
		if (!entry) return;
		CustomDex.patchFormat(entry.id, changes);
		if (!keepsDefault) delete CustomDex.formatDefaultLegal[this.legalKey()];
		void CustomDex.editFormat(entry.name, changes)
			.then(() => CustomDex.loadFormatLegal(entry.id, true));
	}
	/** The picker on this page chooses what the custom format is built on, not what it is. */
	override setFormat(format: string) {
		this.team.format = toID(format);
		// `TeamRoom` sets the format on open too, and that isn't an edit.
		if (toID(this.formatEntry()?.base) === toID(format)) return;
		// A different base means different rules and a different roster: ask for both again.
		this.applyEdit({ base: format || null });
	}
	/** Nothing here belongs to PS.teams; the server is the store. */
	override save() {}

	/** The lists being edited, where they have diverged from what the server holds. */
	pending: { [kind in RosterKind]?: ID[] } = {};
	afterUnsaved: (() => void) | null = null;

	legalKey() {
		return toID(this.formatEntry()?.id);
	}
	/**
	 * Which rulesets this format sets itself, on or off, leaving out the ones it says nothing about.
	 * Its own spellings carry the sim's `^` prefix, which is what lets a setting be stored even when
	 * it agrees with the base format and would otherwise be refused as a rule that does nothing.
	 */
	ruleSettings() {
		const settings: { [ruleid: string]: 'on' | 'off' } = {};
		for (const rule of this.formatEntry()?.ruleset || []) {
			const spec = rule.replace(/^\^/, '');
			settings[toID(spec.replace(/^!/, ''))] = spec.startsWith('!') ? 'off' : 'on';
		}
		return settings;
	}
	savedRoster(kind: RosterKind): ID[] {
		return (CustomDex.formatLegal[this.legalKey()] || emptyRoster())[kind];
	}
	defaultRoster(kind: RosterKind): ID[] {
		return (CustomDex.formatDefaultLegal[this.legalKey()] || emptyRoster())[kind];
	}
	/** What a picker shows: the working copy if there is one, else the server's. */
	roster(kind: RosterKind): ID[] {
		return this.pending[kind] || this.savedRoster(kind);
	}
	sameRoster(a: ID[], b: ID[]) {
		if (a.length !== b.length) return false;
		const has: { [id: string]: boolean } = {};
		for (const id of b) has[id] = true;
		return a.every(id => has[id]);
	}
	unsavedKinds() {
		return ROSTER_KINDS.filter(kind => {
			const pending = this.pending[kind];
			return pending && !this.sameRoster(pending, this.savedRoster(kind));
		});
	}
	unsaved() {
		return !!this.unsavedKinds().length;
	}
	/** Whether a picker is already showing what the format's rules allow on their own. */
	atDefault(kind: RosterKind) {
		const base = this.defaultRoster(kind);
		return !!base.length && this.sameRoster(this.roster(kind), base);
	}
	setRoster(kind: RosterKind, roster: ID[]) {
		this.pending[kind] = roster;
		this.update(null);
	}
	/**
	 * Legality lives in the rules, so each list is stored as whichever spelling is shorter: the
	 * difference from what the rules allow on their own, or `-All X` plus the list as an allowlist.
	 * Trimming OU by three Pokemon is three bans; keeping twelve of them is thirteen rules.
	 */
	saveRoster() {
		const entry = this.formatEntry();
		if (!entry) return;
		// The pickers' own spellings are ours to rewrite; everything else is the owner's own rule.
		const banlist = entry.banlist.filter(rule => !pickerRule(rule));
		const unbanlist = entry.unbanlist.filter(rule => !pickerRule(rule));
		// A `for` loop here compiles to a closure the client's build refuses; `forEach` is one already.
		ROSTER_KINDS.forEach(kind => {
			const roster = this.roster(kind);
			const base = this.defaultRoster(kind);
			const bans = base.filter(id => !roster.includes(id)).map(id => ruleFor(kind, id));
			const unbans = roster.filter(id => !base.includes(id)).map(id => ruleFor(kind, id));
			if (1 + roster.length < bans.length + unbans.length) {
				// `-All Pokemon` has to precede every other Pokemon rule, tag bans included.
				banlist.unshift(ALL_OF[kind]);
				unbanlist.push(...roster.map(id => ruleFor(kind, id)));
			} else {
				banlist.push(...bans);
				unbanlist.push(...unbans);
			}
		});
		this.pending = {};
		this.applyEdit({ banlist, unbanlist }, true);
	}
	discardRoster() {
		this.pending = {};
		this.update(null);
	}
	confirmUnsaved(then: () => void, elem?: HTMLElement | null) {
		if (!this.unsaved()) {
			then();
			return true;
		}
		this.afterUnsaved = then;
		PS.join('formatunsaved' as RoomID, { parentElem: elem, parentRoomid: this.id });
		return false;
	}
	override interruptClose(explicit?: boolean, elem?: HTMLElement | null) {
		if (this.unsaved()) {
			this.afterUnsaved = () => PS.leave(this.id);
			PS.join('formatunsaved' as RoomID, { parentElem: elem, parentRoomid: this.id });
			return `You have unsaved changes to ${this.title}`;
		}
		return super.interruptClose(explicit, elem);
	}
	override listRoomid() {
		return 'formatbuilder';
	}
	override findTeam(): Team | null {
		const id = this.id.slice(7);
		const format = CustomDex.overlay?.formats?.find(entry => entry.id === id);
		if (!format) {
			// Missing from an overlay that has arrived means deleted, rather than still on its way.
			if (CustomDex.overlay) delete formatTeams[id];
			return null;
		}
		const team = (formatTeams[id] ||= {
			name: format.name,
			format: toID(format.base || format.mod),
			folder: '',
			packedTeam: '',
			iconCache: null,
			isBox: false,
			key: id,
		});
		team.name = format.name;
		return team;
	}
}

export class FormatPanel extends TeamPanel {
	static override readonly id = 'format';
	static override readonly routes = ['format-*'];
	static override readonly Model = FormatRoom;
	static override readonly title = 'Format';

	/** Whether the pinned "Legal" section is collapsed. */
	hideSelected = false;

	room() {
		return this.props.room as FormatRoom;
	}
	/** Which of the four lists the picker on screen is editing. */
	pickerKind(editor?: TeamEditorState | null): RosterKind {
		const type = editor?.innerFocus?.type as RosterKind;
		return ROSTER_KINDS.includes(type) ? type : 'pokemon';
	}
	syncRoster(editor: TeamEditorState) {
		const search = editor.search as PokebuilderDexSearch;
		const room = this.room();
		search.roster = this.hideSelected ? [] : room.roster(this.pickerKind(editor));
		search.selectedSpecies = room.roster('pokemon');
		search.selectedMoves = room.roster('move');
		search.selectedAbilities = room.roster('ability');
		search.selectedItems = room.roster('item');
		if (ROSTER_KINDS.includes(editor.innerFocus?.type as RosterKind)) search.refresh();
	}
	editRoster(kind: RosterKind, change: (roster: ID[]) => ID[]) {
		const room = this.room();
		room.setRoster(kind, change(room.roster(kind)));
		const editor = room.editor;
		if (editor) this.syncRoster(editor);
		this.forceUpdate();
	}
	openPicker = (ev: Event) => {
		const kind = (ev.currentTarget as HTMLButtonElement).value as RosterKind;
		const editor = this.room().editor;
		if (!editor) return;
		editor.innerFocus = { setIndex: 0, type: kind, typeIndex: -1 };
		editor.setSearchType(kind, 0, '', -1);
		// No set is being edited, so there's no current choice to pin above the list. Without this
		// the item picker opens on a "(no item)" row, which is a set's choice and not a format's.
		editor.search.prependResults = null;
		this.syncRoster(editor);
		editor.update();
	};
	toggleHideSelected = () => {
		this.hideSelected = !this.hideSelected;
		const editor = this.room().editor;
		if (editor) this.syncRoster(editor);
		this.forceUpdate();
	};
	override renderStorage() {
		return null;
	}
	/** Smogon has no teambuilding article about a format that doesn't exist yet. */
	override usesResources() {
		return false;
	}
	/** The base format picker moves down into the form, beside the format's other settings. */
	override renderFormatSelect() {
		return null;
	}
	/** Picking a base format now replaces the format's rules, so it asks first. */
	override handleChangeFormat = (ev: Event) => {
		const room = this.room();
		const base = (ev.currentTarget as HTMLButtonElement).value;
		const entry = room.formatEntry();
		if (!entry || toID(base) === toID(entry.base)) return;
		// The dropdown closes every popup right after handing over its value, this one included, so
		// the question has to wait until it has finished doing that.
		setTimeout(() => void PS.confirm(
			`Start this format's rules over from ${BattleLog.formatName(base)}? Its rules and legal ` +
			`Pokémon are replaced by that format's.`,
			{ okButton: 'Replace rules' }
		).then(confirmed => {
			if (confirmed) room.setFormat(base);
			this.forceUpdate();
		}), 0);
	};
	/** Throws away every rule change, back to the base format the rules were copied from. */
	resetFormat = (ev: Event) => {
		// Without this the click reaches PS's outside-click handler and closes the question again.
		ev.preventDefault();
		ev.stopImmediatePropagation();
		const room = this.room();
		const entry = room.formatEntry();
		if (!entry) return;
		void PS.confirm(
			`Put this format's rules back to ${BattleLog.formatName(entry.base)}'s? Every rule, ban and ` +
			`list you've changed goes back to how that format has them.`,
			{ okButton: 'Reset rules', parentElem: ev.currentTarget as HTMLElement }
		).then(confirmed => {
			if (!confirmed) return;
			room.pending = {};
			delete CustomDex.formatDefaultLegal[room.legalKey()];
			void CustomDex.resetFormat(entry.name).then(() => CustomDex.loadFormatLegal(entry.id, true));
		});
	};
	changeMod = (ev: Event) => {
		const mod = (ev.currentTarget as HTMLSelectElement).value;
		this.room().applyEdit({ mod: mod || null });
	};
	/** A tag ban is a rule like any other: the format's own line if it has one, an unban if not. */
	toggleTag = (ev: Event) => {
		const room = this.room();
		const entry = room.formatEntry();
		if (!entry) return;
		const id = toID((ev.currentTarget as HTMLButtonElement).value);
		const tag = CustomDex.tags().find(candidate => candidate.id === id);
		if (!tag) return;
		const named = (rule: string) => toID(rule.replace(/^tag:/, '')) === id;
		const banlist = entry.banlist.filter(rule => !named(rule));
		const unbanlist = entry.unbanlist.filter(rule => !named(rule));
		const rule = `tag:${tag.name}`;
		if (CustomDex.formatBans[room.legalKey()]?.tags[id] === 'banned') {
			if (banlist.length === entry.banlist.length) unbanlist.push(rule);
		} else if (unbanlist.length === entry.unbanlist.length) {
			banlist.push(rule);
		}
		room.applyEdit({ banlist, unbanlist });
	};
	toggleRule = (ev: Event) => {
		const room = this.room();
		const entry = room.formatEntry();
		if (!entry) return;
		const id = toID((ev.currentTarget as HTMLButtonElement).value);
		const rule = CustomDex.rulesets().find(candidate => candidate.id === id);
		if (!rule) return;
		const setting = room.ruleSettings()[id];
		const on = (CustomDex.formatRules[room.legalKey()] || []).includes(id);
		const named = (existing: string) => toID(existing.replace(/^\^/, '').replace(/^!/, '')) === id;
		const others = entry.ruleset.filter(existing => !named(existing));
		// Turning a rule off means deleting the line that adds it, or repealing it when a ruleset
		// like `Standard` is what brings it in. Turning one on is the same in reverse.
		const ruleset = on ?
			setting === 'on' ? others : [...others, `!${rule.name}`] :
			setting === 'off' ? others : [...others, rule.name];
		CustomDex.patchFormatRules(room.legalKey(), id, !on);
		room.applyEdit({ ruleset });
	};
	resetRoster = () => {
		const kind = this.pickerKind(this.room().editor);
		this.editRoster(kind, () => this.room().defaultRoster(kind).slice());
	};
	clearRoster = () => this.editRoster(this.pickerKind(this.room().editor), () => []);
	saveRoster = () => {
		this.room().saveRoster();
		this.forceUpdate();
	};

	/** Picking a species makes it legal or illegal, rather than starting a set. */
	/** Everything about the format that isn't one of its four lists. */
	override renderExtras(): preact.ComponentChildren {
		const room = this.room();
		const entry = room.formatEntry();
		if (!entry) return null;
		const active = CustomDex.formatRules[room.legalKey()] || [];
		const locked = CustomDex.formatLockedRules[room.legalKey()] || {};
		const bans = CustomDex.formatBans[room.legalKey()];
		const settings = room.ruleSettings();
		return <div class="formatsettings">
			<p>
				<label class="label">
					Base format:{}
					<button
						name="format" value={room.team.format} data-selecttype="teambuilder"
						class="select formatselect" data-href="/formatdropdown" onChange={this.handleChangeFormat}
					>
						<i class="fa fa-folder-o" aria-hidden></i> {BattleLog.formatName(room.team.format)}
					</button>
				</label> {}
				<label class="label">
					Mod:{}
					<select class="select formatselect" value={entry.mod || ''} onChange={this.changeMod}>
						<option value="">Same as base format{entry.baseMod ? ` (${entry.baseMod})` : ''}</option>
						{CustomDex.mods().map(mod => <option value={mod}>{mod}</option>)}
					</select>
				</label> {}
				<button class="button" onClick={this.resetFormat} disabled={!entry.base}>
					<i class="fa fa-undo" aria-hidden></i> Reset rules
				</button>
			</p>
			<p class="pickers">
				{ROSTER_KINDS.map(kind => <button class="button big" value={kind} onClick={this.openPicker}>
					<i class="fa fa-check-square-o" aria-hidden></i> Select Legal {PICKERS[kind].label} {}
					<small>({room.roster(kind).length})</small>
				</button>)}
			</p>
			<label class="label">Rulesets</label>
			<div class="rulechips">
				{CustomDex.rulesets().map(rule => {
					const stuck = locked[rule.id];
					const setting = settings[rule.id];
					const on = active.includes(rule.id);
					// A rule this format doesn't name itself is one another ruleset brings in.
					const indirect = on && setting !== 'on';
					const source = on ? (indirect ? 'On, brought in by another ruleset' : 'On') :
						setting === 'off' ? 'Off, switched off by this format' : 'Off';
					return <button
						class={`chip${on ? ' cur' : setting === 'off' ? ' off' : ''}${indirect ? ' inherit' : ''}${
							stuck ? ' locked' : ''}`}
						value={rule.id} onClick={this.toggleRule} disabled={!!stuck}
						title={stuck || `${source}${rule.desc ? ` — ${rule.desc}` : ''}`}
					>
						{rule.name}
					</button>;
				})}
				{!CustomDex.rulesets().length && <span class="chipnote">{}
					{CustomDex.pendingReason('formats') || 'No rulesets'}
				</span>}
			</div>
			<p class="chipnote">
				These are this format's own rules: the base format only fills them in to start with.
				A dashed ruleset is one another ruleset brings in.
			</p>
			<label class="label">Banned tags</label>
			{TAG_GROUPS.map(group => <div class="rulechips">
				{CustomDex.tags().map(tag => tag.kind === group.kind && <button
					class={`chip${bans?.tags[tag.id] === 'banned' ? ' banned' :
					bans?.tags[tag.id] ? ' unbanned' : ''}`}
					value={tag.id} onClick={this.toggleTag}
					title={`${group.name}: ${bans?.tags[tag.id] || 'allowed'}`}
				>
					{tag.name}
				</button>)}
			</div>)}
			<p class="chipnote">
				A tag bans everything it covers at once. Individual Pok&eacute;mon, moves, abilities
				and items are on the pages above.
				{!!bans?.other.length && <> This format also has: {bans.other.join(', ')}.</>}
			</p>
		</div>;
	}

	setEditor: SetEditor = {
		hideCopy: true,
		hideSampleSets: true,
		/** The tab edits the whole format, not a set: there are no sets here. */
		textTab: editor => <SetImportForm editor={editor} setIndex={0} onChange={() => editor.update()} />,
		importExport: {
			label: 'Format',
			export: () => {
				const entry = this.room().formatEntry();
				return entry ? exportFormat(entry) : '';
			},
			import: (_editor, _setIndex, text) => {
				const parsed = parseFormat(text);
				if (typeof parsed === 'string') return parsed;
				// The name is what the room is open on, so the text describes everything but that.
				this.room().applyEdit(parsed);
				return '';
			},
		},
		titles: { pokemon: 'Pokemon allowed in this format' },
		hideOptions: true,
		back: (ev?: Event) => {
			ev?.preventDefault();
			ev?.stopImmediatePropagation();
			const room = this.room();
			room.confirmUnsaved(() => {
				room.editor!.innerFocus = null;
				room.update(null);
			}, ev?.currentTarget as HTMLElement);
		},
		renderEmptyActions: () => {
			const room = this.room();
			const kind = this.pickerKind(room.editor);
			const unsaved = room.unsaved();
			return <>
				<button class="option" onClick={this.saveRoster} disabled={!unsaved}>
					<i class={`fa fa-${unsaved ? 'floppy-o' : 'check'}`} aria-hidden></i> {}
					{unsaved ? 'Save' : 'Saved'}
				</button> {}
				<button class="option" onClick={this.toggleHideSelected}>
					<i class={`fa fa-${this.hideSelected ? 'eye' : 'eye-slash'}`} aria-hidden></i> {}
					{this.hideSelected ? 'Show' : 'Hide'} selected
				</button> {}
				<button class="option" onClick={this.resetRoster} disabled={room.atDefault(kind)}>
					<i class="fa fa-undo" aria-hidden></i> Reset to default
				</button> {}
				<button class="option" onClick={this.clearRoster} disabled={!room.roster(kind).length}>
					<i class="fa fa-ban" aria-hidden></i> Remove all
				</button>
			</>;
		},
		/** Every click in every one of these pickers means the same thing: allowed, or not. */
		selectEntry: (editor, _setIndex, type, name) => {
			const kind = type as RosterKind;
			if (!ROSTER_KINDS.includes(kind)) return false;
			const id = PICKERS[kind].dex.get(name).id;
			// "(no item)" is a choice a set can make, not an entry a format can allow.
			if (!id) return true;
			this.editRoster(kind, roster => (
				roster.includes(id) ? roster.filter(entry => entry !== id) : [...roster, id]
			));
			this.syncRoster(editor);
			return true;
		},
	};

	/** Which species the rules allow is the server's to work out, so it gets asked. */
	loadLegal() {
		const entry = this.room().formatEntry();
		if (entry) CustomDex.loadFormatLegal(entry.id);
	}

	override componentDidMount() {
		super.componentDidMount();
		this.subscribeTo(CustomDex, () => {
			const editor = this.props.room.editor;
			if (editor) this.syncRoster(editor);
			this.forceUpdate();
		});
		CustomDex.load();
		this.loadLegal();
	}

	override initEditor = (editor: TeamEditorState) => {
		this.props.room.editor = editor;
		editor.setEditor = this.setEditor;
		const search = new PokebuilderDexSearch();
		search.speciesMode = 'every';
		editor.search = search;
		// There are no sets here, so nothing to add one to, and no set's moves to search within.
		editor.canAdd = () => false;
		editor.getSearchMoves = () => [];
		this.syncRoster(editor);
		this.loadLegal();
	};
}

export class FormatbuilderPanel extends TeambuilderPanel {
	static override readonly id = 'formatbuilder';
	static override readonly routes = ['formatbuilder'];
	static override readonly Model = FormatbuilderRoom;
	static override readonly title = 'Formatbuilder';

	override componentDidMount() {
		super.componentDidMount();
		this.subscribeTo(CustomDex);
		CustomDex.load();
	}

	/** No folders yet; the sidebar keeps its shape so the pane beside it doesn't move. */
	override renderFolderList() {
		return <div class="folderlist">
			<div class="folderlistbefore"></div>
			<div class="folderlistafter"></div>
		</div>;
	}

	deleteFormat = (ev: Event) => {
		// Without this the same click reaches PS's outside-click handler and closes the question.
		ev.preventDefault();
		ev.stopImmediatePropagation();
		const name = (ev.currentTarget as HTMLButtonElement).value;
		void PS.confirm(`Delete "${name}"? Teams built for it stay, but the format is gone.`, {
			okButton: 'Delete', parentElem: ev.currentTarget as HTMLElement,
		}).then(confirmed => {
			if (confirmed) void CustomDex.deleteFormat(name);
		});
	};
	createFormat = (ev: Event) => {
		// Without this the same click reaches PS's outside-click handler and closes the prompt.
		ev.preventDefault();
		ev.stopImmediatePropagation();
		PS.prompt(`Name your new format:`, {
			okButton: 'Create', parentElem: ev.currentTarget as HTMLElement,
		}).then(name => {
			name = name?.trim() || '';
			if (!name) return;
			CustomDex.createFormat(name, `${Dex.modid}ou`).then(created => {
				if (!created) return;
				const format = CustomDex.overlay?.formats?.find(entry => entry.name === created);
				if (format) PS.join(`format-${format.id}` as RoomID);
			});
		});
	};

	override renderTeamPane() {
		const formats = CustomDex.overlay?.formats || [];
		return <div class="teampane">
			<h2><span class="teambuilder-folder-title">
				<i class="fa fa-cogs" aria-hidden></i> Formats <small>({formats.length})</small>
			</span></h2>
			<ul class="teamlist">
				{CustomDex.loading ? (
					<li><em>Loading...</em></li>
				) : CustomDex.error ? (
					<li><em class="message-error">{CustomDex.error}</em></li>
				) : !formats.length ? (
					<li><em>you have no custom formats</em></li>
				) : formats.map(format => (
					<li key={format.id}>
						<a href={`format-${format.id}`} class="team">
							<strong>{format.name}</strong>
							<small>{formatMod(format)}</small>
						</a> {}
						<span class="team-controls">
							<button
								class="option" onClick={this.deleteFormat} value={format.name}
								aria-label="Delete" title="Delete"
							>
								<i class="fa fa-trash" aria-hidden></i> Delete
							</button>
						</span>
					</li>
				))}
			</ul>
			<p>
				<button class="button" onClick={this.createFormat}>
					<i class="fa fa-plus-circle" aria-hidden></i> New format
				</button>
			</p>
		</div>;
	}
}

class FormatUnsavedPanel extends PSRoomPanel {
	static readonly id = 'formatunsaved';
	static readonly routes = ['formatunsaved'];
	static readonly location = 'modal-popup';
	static readonly noURL = true;

	format() {
		return this.props.room.getParent() as FormatRoom | undefined;
	}
	finish(save: boolean) {
		const room = this.format();
		if (!room) return;
		if (save) room.saveRoster();
		else room.discardRoster();
		const then = room.afterUnsaved;
		room.afterUnsaved = null;
		PS.leave(this.props.room.id);
		then?.();
	}
	saveAndGo = () => this.finish(true);
	discardAndGo = () => this.finish(false);
	cancel = () => {
		const room = this.format();
		if (room) room.afterUnsaved = null;
		PS.leave(this.props.room.id);
	};

	override render() {
		const room = this.format();
		const lists = (room?.unsavedKinds() || []).map(kind => PICKERS[kind].label.toLowerCase());
		return <PSPanelWrapper room={this.props.room} width={480}><div class="pad">
			<p>
				You have unsaved changes to which {lists.join(' and ') || 'Pok\u00e9mon'} {}
				{room?.team?.name || 'this format'} allows.
			</p>
			<p>
				<button class="button" onClick={this.saveAndGo}><strong>Save changes</strong></button> {}
				<button class="button" onClick={this.discardAndGo}>Quit without saving</button> {}
				<button class="button" onClick={this.cancel}>Cancel</button>
			</p>
		</div></PSPanelWrapper>;
	}
}

PS.addRoomType(FormatbuilderPanel, FormatPanel, FormatUnsavedPanel);
