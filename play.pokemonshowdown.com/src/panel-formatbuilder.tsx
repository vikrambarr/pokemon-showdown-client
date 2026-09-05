/**
 * Formatbuilder panel
 *
 * The teambuilder's room and panel under a second roomid; the team pane lists custom formats.
 *
 * @license AGPLv3
 */

import { PS, type RoomID, type Team } from "./client-main";
import { PSPanelWrapper, PSRoomPanel } from "./panels";
import { BattleLog } from "./battle-log";
import { Dex, TL, type ID, toID } from "./battle-dex";
import { TeambuilderPanel, TeambuilderRoom } from "./panel-teambuilder";
import { SetImportForm, type TeamEditorState } from "./battle-team-editor";
import type { SetEditor } from "./battle-team-editor-hooks";
import { TeamPanel, TeamRoom } from "./panel-teambuilder-team";
import {
	CustomDex, emptyRoster, exportFormat, parseFormat, ROSTER_KINDS, type RosterKind,
	PokebuilderDexSearch,
} from "./client-custom-dex";

/** What each picker edits: the label on its button, and how a rule names one of its entries. */
type NamedTable = { get: (name: string) => { id: ID, name: string, exists: boolean } };
const PICKERS: { [kind in RosterKind]: { label: string, prefix: string, dex: NamedTable, all: string } } = {
	pokemon: { label: 'Pok\u00e9mon', prefix: '', dex: Dex.species, all: 'All Pokemon' },
	move: { label: 'Moves', prefix: 'move:', dex: Dex.moves, all: 'All Moves' },
	ability: { label: 'Abilities', prefix: 'ability:', dex: Dex.abilities, all: 'All Abilities' },
	item: { label: 'Items', prefix: 'item:', dex: Dex.items, all: 'All Items' },
};
/** The rule fields a new base format replaces, and the ones the pickers write into. */
const RULE_LISTS = ['ruleset', 'banlist', 'unbanlist'];
/** The tags a format can ban, in the order the editor shows them. */
const TAG_GROUPS = [
	{ kind: 'pokemon', name: 'Pok\u00e9mon tag' },
	{ kind: 'move', name: 'Move tag' },
	{ kind: 'other', name: 'Tag' },
];
/** How a picker's own entry is spelled, prefixed where a bare name could mean two things. */
function ruleFor(kind: RosterKind, id: ID) {
	return `${PICKERS[kind].prefix}${PICKERS[kind].dex.get(id).name}`;
}
/** Whether a stored rule is a picker's own, so rewriting a list doesn't drop the owner's rules. */
function pickerRule(rule: string) {
	if (ROSTER_KINDS.some(kind => toID(PICKERS[kind].all) === toID(rule))) return true;
	if (/^(?:base)?(?:pokemon|move|ability|item):/.test(rule)) return true;
	return ROSTER_KINDS.some(kind => PICKERS[kind].dex.get(rule).exists);
}

/** The mod a format is played under: its own if it names one, otherwise its base format's. */
function formatMod(format: { mod: string, baseMod?: string }) {
	return format.mod || format.baseMod || Dex.modid;
}

export class FormatbuilderRoom extends TeambuilderRoom {}

/** Kept off the room: a subclass field initializer runs after `TeamRoom` has asked for it. */
const formatTeams: { [id: string]: Team } = {};

/** A format room borrows the team editor's screen, so it needs a team to render. */
export class FormatRoom extends TeamRoom {
	override pendingMessage() {
		return CustomDex.pendingReason('formats');
	}
	override roomLabel() {
		return TL.term.format;
	}
	override listLabel() {
		return TL.term.formats;
	}
	override missingMessage() {
		return this.teamDeleted ? `${TL.term.format} was deleted` : `${TL.term.format} doesn't exist`;
	}
	/** The format as the server holds it, before anything this page is still holding. */
	savedEntry() {
		return CustomDex.overlay?.formats?.find(entry => entry.id === this.id.slice(7));
	}
	formatEntry() {
		const entry = this.savedEntry();
		if (!entry || !this.draft) return entry;
		return { ...entry, ...this.draft } as typeof entry;
	}
	applyEdit(changes: AnyObject) {
		if (!this.savedEntry()) return;
		this.lastDraft = this.draft;
		this.draft = { ...this.draft, ...changes };
		this.preview(RULE_LISTS.some(field => field in changes) || 'base' in changes || 'mod' in changes);
		this.update(null);
	}
	preview(newDefault?: boolean) {
		const entry = this.savedEntry();
		if (!entry) return;
		if (!this.draft) {
			CustomDex.loadFormatLegal(entry.id, true);
			return;
		}
		CustomDex.loadFormatDraft(entry.id, this.draft, newDefault || !CustomDex.formatDefaultLegal[this.legalKey()]);
	}
	refuseDraft(error: string) {
		this.draft = this.lastDraft;
		this.lastDraft = null;
		this.preview(true);
		this.update(null);
		PS.alert(error);
	}
	/** The picker on this page chooses what the custom format is built on, not what it is. */
	override setFormat(format: string) {
		this.team.format = toID(format);
		// `TeamRoom` sets the format on open too, and that isn't an edit.
		if (toID(this.formatEntry()?.base) === toID(format)) return;
		// A different base means different rules and a different roster: both start over from it.
		this.pending = {};
		const draft: AnyObject = { ...this.draft };
		for (const field of RULE_LISTS) delete draft[field];
		this.draft = draft;
		this.applyEdit({ base: format || null });
	}
	/** Nothing here belongs to PS.teams; the server is the store. */
	override save() {}

	/** The format's own fields as edited, until the Save button sends them. */
	draft: AnyObject | null = null;
	/** The last draft the server took, to go back to when it refuses the next one. */
	lastDraft: AnyObject | null = null;
	/** The lists being edited, where they have diverged from what the server holds. */
	pending: { [kind in RosterKind]?: ID[] } = {};
	afterUnsaved: (() => void) | null = null;

	legalKey() {
		return toID(this.formatEntry()?.id);
	}
	/** Which rulesets the format sets itself. The sim's `^` prefix stores one that agrees with the base. */
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
	/** Everything this page is holding: the format's own fields, and what the pickers chose. */
	changes() {
		const roster = this.rosterChanges();
		if (!this.draft && !roster) return null;
		return { ...this.draft, ...roster };
	}
	unsaved() {
		return !!this.draft || !!this.unsavedKinds().length;
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
	/** Each list is stored as whichever is shorter: the difference, or `-All X` plus an allowlist. */
	rosterChanges() {
		const entry = this.formatEntry();
		if (!entry || !this.unsavedKinds().length) return null;
		// The pickers' own spellings are ours to rewrite; everything else is the owner's own rule.
		const banlist = entry.banlist.filter(rule => !pickerRule(rule));
		const unbanlist = entry.unbanlist.filter(rule => !pickerRule(rule));
		// `-All Pokemon` has to precede every other rule of theirs, so the emptied lists lead.
		const emptiedBans: string[] = [];
		// A `for` loop here compiles to a closure the client's build refuses; `forEach` is one already.
		ROSTER_KINDS.forEach(kind => {
			const roster = this.roster(kind);
			const base = this.defaultRoster(kind);
			const inRoster: { [id: string]: boolean } = {};
			const inBase: { [id: string]: boolean } = {};
			for (const id of roster) inRoster[id] = true;
			for (const id of base) inBase[id] = true;
			const bans = base.filter(id => !inRoster[id]).map(id => ruleFor(kind, id));
			const unbans = roster.filter(id => !inBase[id]).map(id => ruleFor(kind, id));
			// emptying a picker means `-All X`; the diff would need a default we may not have yet
			const emptied = !!this.pending[kind] && !roster.length;
			if (emptied || 1 + roster.length < bans.length + unbans.length) {
				emptiedBans.push(PICKERS[kind].all);
				unbanlist.push(...roster.map(id => ruleFor(kind, id)));
			} else {
				banlist.push(...bans);
				unbanlist.push(...unbans);
			}
		});
		banlist.unshift(...emptiedBans);
		return { banlist, unbanlist };
	}
	/** One write for the whole page, so a picker's changes and the rules around them land together. */
	saveEdits() {
		const entry = this.savedEntry();
		const changes = this.changes();
		if (!entry || !changes) return Promise.resolve(null);
		this.draft = null;
		this.lastDraft = null;
		this.pending = {};
		this.update(null);
		return CustomDex.editFormat(entry.name, changes).then(name => {
			CustomDex.loadFormatLegal(entry.id, true);
			return name;
		});
	}
	discardEdits() {
		this.draft = null;
		this.lastDraft = null;
		this.pending = {};
		this.preview();
		this.update(null);
	}
	override interruptClose(explicit?: boolean, elem?: HTMLElement | null) {
		if (this.unsaved()) {
			// see PokebuilderRoom: a popup opened behind the browser's prompt outlives a cancel
			if (!explicit) {
				this.afterUnsaved = () => PS.leave(this.id);
				PS.join('formatunsaved' as RoomID, { parentElem: elem, parentRoomid: this.id });
			}
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
		search.selected = {};
		for (const kind of ROSTER_KINDS) search.selected[kind] = room.roster(kind);
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
		// no set is being edited, so "(no item)" is a set's choice and not a format's
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
	override isTeam() {
		return false;
	}
	/** Picking a base format now replaces the format's rules, so it asks first. */
	override handleChangeFormat = (ev: Event) => {
		const room = this.room();
		const base = (ev.currentTarget as HTMLButtonElement).value;
		const entry = room.formatEntry();
		if (!entry || toID(base) === toID(entry.base)) return;
		// the dropdown closes every popup after handing over its value, this one included
		setTimeout(() => PS.confirm(
			`Start this format's rules over from ${BattleLog.formatName(base)}? Its rules and legal ` +
			`Pokémon are replaced by that format's.`,
			{ okButton: TL`[Replace rules]` }
		).then(confirmed => {
			if (confirmed) room.setFormat(base);
			this.forceUpdate();
		}), 0);
	};
	/** Throws away every rule change, back to the base format the rules were copied from. */
	resetFormat = (ev: Event) => {
		ev.stopImmediatePropagation();
		ev.preventDefault();
		const room = this.room();
		const entry = room.formatEntry();
		if (!entry) return;
		PS.confirm(
			`Put this format's rules back to ${BattleLog.formatName(entry.base)}'s? Every rule, ban and ` +
			`list you've changed goes back to how that format has them.`,
			{ okButton: TL`[Reset rules]`, parentElem: ev.currentTarget as HTMLElement }
		).then(confirmed => {
			if (!confirmed) return;
			room.draft = null;
			room.lastDraft = null;
			room.pending = {};
			delete CustomDex.formatDefaultLegal[room.legalKey()];
			CustomDex.resetFormat(entry.name).then(() => CustomDex.loadFormatLegal(entry.id, true));
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
		// off means deleting the line that adds it, or repealing it when a ruleset brings it in
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
	saveEdits = () => {
		void this.room().saveEdits();
		this.forceUpdate();
	};
	discardEdits = () => {
		this.room().discardEdits();
		this.forceUpdate();
	};
	/** The name is the one thing an edit can't hold: it names the format every write asks for. */
	override handleRename = (ev: Event) => {
		// Only once the box is done being typed in: a rename moves the room to the new name's id.
		if (ev.type !== 'change') return;
		const room = this.room();
		const entry = room.savedEntry();
		const name = (ev.currentTarget as HTMLInputElement).value.trim();
		if (!entry || !name || name === entry.name) return;
		void room.saveEdits()
			.then(() => CustomDex.editFormat(entry.name, { name }))
			.then(renamed => {
				const format = CustomDex.overlay?.formats?.find(candidate => candidate.name === renamed);
				if (!format) return;
				// The id a format plays under is its name's, so renaming it moves this room.
				PS.leave(room.id);
				PS.join(`format-${format.id}` as RoomID);
			});
	};

	renderSave() {
		const unsaved = this.room().unsaved();
		return <>
			<button
				class="option" onClick={this.saveEdits} disabled={!unsaved}
				title={unsaved ? 'Save changes to the server' : 'No unsaved changes'}
			>
				<i class={`fa fa-${unsaved ? 'floppy-o' : 'check'}`} aria-hidden></i> {}
				{unsaved ? 'Save' : 'Saved'}
			</button> {}
			<button class="option" onClick={this.discardEdits} disabled={!unsaved}>
				<i class="fa fa-times" aria-hidden></i> Discard
			</button>
		</>;
	}
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
			<p style="text-align:right">{this.renderSave()}</p>
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
			label: 'Import/Export Format',
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
		/** A picker is a page of this format, not a page of its own: nothing is saved leaving it. */
		back: (ev?: Event) => {
			ev?.stopImmediatePropagation();
			ev?.preventDefault();
			const room = this.room();
			room.editor!.innerFocus = null;
			room.update(null);
		},
		render: {
			emptyActions: () => {
				const room = this.room();
				const kind = this.pickerKind(room.editor);
				return <>
					{this.renderSave()} {}
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

	loadLegal() {
		const room = this.room();
		// A held edit is asked about as a draft; the stored rules would answer the wrong question.
		if (room.draft) return room.preview();
		const entry = room.formatEntry();
		if (entry) CustomDex.loadFormatLegal(entry.id);
	}

	override componentDidMount() {
		super.componentDidMount();
		this.subscribeTo(CustomDex, () => {
			if (CustomDex.draftError) {
				const error = CustomDex.draftError;
				CustomDex.draftError = null;
				this.room().refuseDraft(error);
			}
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
	static override getTitle() {
		return this.title;
	}

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
		ev.stopImmediatePropagation();
		ev.preventDefault();
		const name = (ev.currentTarget as HTMLButtonElement).value;
		PS.confirm(`Delete "${name}"? Teams built for it stay, but the format is gone.`, {
			okButton: TL`[Delete]`, parentElem: ev.currentTarget as HTMLElement,
		}).then(confirmed => {
			if (confirmed) CustomDex.deleteFormat(name);
		});
	};
	renameFormat = (ev: Event) => {
		ev.stopImmediatePropagation();
		ev.preventDefault();
		const oldName = (ev.currentTarget as HTMLButtonElement).value;
		const oldId = CustomDex.overlay?.formats?.find(entry => entry.name === oldName)?.id || '';
		PS.prompt(`Rename \`\`${oldName}\`\` to?`, {
			defaultValue: oldName, okButton: TL`[Rename]`, parentElem: ev.currentTarget as HTMLElement,
		}).then(name => {
			name = (name || '').trim();
			if (!name || name === oldName) return;
			CustomDex.editFormat(oldName, { name }).then(renamed => {
				const format = CustomDex.overlay?.formats?.find(entry => entry.name === renamed);
				// A format plays under its name's id, so an open room for it moves too.
				if (!format || !PS.rooms[`format-${oldId}` as RoomID]) return;
				PS.leave(`format-${oldId}` as RoomID);
				PS.join(`format-${format.id}` as RoomID);
			});
		});
	};
	createFormat = (ev: Event) => {
		ev.stopImmediatePropagation();
		ev.preventDefault();
		PS.prompt(`Name your new format:`, {
			okButton: TL`[Create]`, parentElem: ev.currentTarget as HTMLElement,
		}).then(name => {
			name = (name || '').trim();
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
								class="option" onClick={this.renameFormat} value={format.name}
								aria-label="Rename" title="Rename"
							>
								<i class="fa fa-pencil" aria-hidden></i> Rename
							</button> {}
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
				</button> {}
				<a class="button" href="view-customformats-browse">
					<i class="fa fa-globe" aria-hidden></i> Browse formats
				</a>
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
		const then = room.afterUnsaved;
		room.afterUnsaved = null;
		PS.leave(this.props.room.id);
		// Leaving before the write lands would abandon it, so the room goes once the server has it.
		if (save) void room.saveEdits().then(() => then?.());
		else {
			room.discardEdits();
			then?.();
		}
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
				You have unsaved changes to {room?.team?.name || 'this format'}
				{lists.length ? `, including which ${lists.join(' and ')} it allows` : ''}.
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
