/**
 * Pokébuilder panel
 *
 * @author Guangcong Luo <guangcongluo@gmail.com>
 * @license AGPLv3
 */

import { PS, PSRoom, type RoomOptions, type Team } from "./client-main";
import { PSIcon, PSPanelWrapper, PSRoomPanel } from "./panels";
import { Dex, toID, type ID } from "./battle-dex";
import { BattleStatNames } from "./battle-dex-data";
import { BattleLog } from "./battle-log";
import { TeamEditor, type SetEditor, type TeamEditorState } from "./battle-team-editor";
import { Net } from "./client-connection";
import {
	abilitySlots, COLORS, CustomDex, EGG_GROUPS, EVO_TYPES, PokebuilderDexSearch, SPECIES_FIELDS,
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
}

const MAX_ABILITIES = 3;
const MAX_BASE_STAT = 255;
const SAVE_DELAY = 2000;
const SPRITE_KINDS = ['front', 'back', 'front-shiny', 'back-shiny', 'icon'];
const SPRITE_LABELS = ['F', 'B', 'F*', 'B*', 'I'];
const SPRITE_SIZES: [number, number][] = [[96, 96], [96, 96], [96, 96], [96, 96], [40, 30]];
const STAT_BAR_WIDTH = 180;

export type FormatResource = { url: string, resources: { resource_name: string, url: string }[] } | null;
class PokebuilderPanel extends PSRoomPanel<PokebuilderRoom> {
	static readonly id = 'pokebuilder';
	static readonly routes = ['pokebuilder'];
	static readonly Model = PokebuilderRoom;
	static readonly title = 'Pokébuilder';

	focusInitialized = false;
	editingId = '' as ID;
	savedJSON: { [id: string]: string } = {};
	saveTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(props?: { room: PokebuilderRoom }) {
		super(props);
		PokebuilderPanel.getFormatResources(this.props.room.team.format).then(() => {
			this.forceUpdate();
		});
	}

	override componentWillUnmount() {
		this.flush(this.editingId);
		super.componentWillUnmount();
	}

	override componentDidMount() {
		super.componentDidMount();
		this.subscribeTo(CustomDex, () => {
			const search = this.props.room.editor?.search;
			if (search instanceof PokebuilderDexSearch) search.refresh();
			this.forceUpdate();
		});
		this.subscribeTo(PS.user, () => {
			CustomDex.load();
		});
		CustomDex.load();
	}

	static formatResources = {} as Record<string, FormatResource>;

	static getFormatResources(format: string): Promise<FormatResource> {
		if (format in this.formatResources) return Promise.resolve(this.formatResources[format]);
		return Net('https://www.smogon.com/dex/api/formats/by-ps-name/' + format).get()
			.then(result => {
				this.formatResources[format] = JSON.parse(result);
				return this.formatResources[format];
			}).catch(err => {
				this.formatResources[format] = null;
				return this.formatResources[format];
			});
	}

	initEditor = (editor: TeamEditorState) => {
		this.props.room.editor = editor;
		if (this.focusInitialized) return;
		this.focusInitialized = true;

		editor.search = new PokebuilderDexSearch();
		window.search = editor.search;
		editor.showItem = () => false;
		editor.showAbility = () => false;
		editor.getSearchMoves = () => [];
		const setSearchType = editor.setSearchType.bind(editor);
		editor.setSearchType = (type, i, value, typeIndex) => {
			if (type !== 'move') return setSearchType(type, i, value, typeIndex);
			if (editor.innerFocus?.type === 'move') editor.innerFocus.typeIndex = -1;
			this.movesFor(i);
			setSearchType(type, i, '', -1);
		};
		editor.updateSearchMoves = set => {
			CustomDex.setLearnset(toID(set.species), set.moves.filter(Boolean));
			this.save();
			(editor.search as PokebuilderDexSearch).refresh();
		};

		this.openSpecies(editor.sets.length);
	};

	openSpecies(setIndex: number) {
		const editor = this.props.room.editor;
		if (!editor) return;
		editor.innerFocus = { setIndex, type: 'pokemon', typeIndex: -1 };
		editor.setSearchType('pokemon', setIndex, '', -1);
	}

	abilitiesFor(setIndex: number) {
		const set = this.props.room.editor?.sets[setIndex];
		if (!set) return [];
		const abilities: string[] = Object.values(Dex.species.get(set.species).abilities)
			.filter(name => name && name !== 'No Ability');
		set.abilities = abilities;
		return abilities;
	}
	movesFor(setIndex: number) {
		const set = this.props.room.editor?.sets[setIndex];
		if (!set) return [];
		set.moves = CustomDex.learnset(toID(set.species));
		return set.moves;
	}
	statsFor(setIndex: number) {
		const set = this.props.room.editor?.sets[setIndex];
		return set ? Dex.species.get(set.species).baseStats : null;
	}
	typesFor(setIndex: number) {
		const set = this.props.room.editor?.sets[setIndex];
		return set ? Dex.species.get(set.species).types : [];
	}
	speciesId(setIndex: number) {
		return toID(this.props.room.editor?.sets[setIndex]?.species);
	}
	setAbilities(setIndex: number, abilities: string[]) {
		const set = this.props.room.editor?.sets[setIndex];
		if (!set) return;
		const table: AnyObject = {};
		const slots = abilitySlots(abilities.length);
		abilities.forEach((name, i) => (table[slots[i]] = name));
		CustomDex.patch(this.speciesId(setIndex), { abilities: table });
		this.save();
		set.abilities = abilities;
		set.ability = abilities[0] || '';
	}
	syncAbilitySearch(setIndex: number) {
		const editor = this.props.room.editor;
		this.abilitiesFor(setIndex);
		if (editor?.innerFocus?.type !== 'ability') return;
		editor.search.results = null;
		editor.search.find(editor.search.query);
	}
	openAbilities = (ev: Event) => {
		const editor = this.props.room.editor;
		if (!editor) return;
		const setIndex = Number((ev.currentTarget as HTMLElement).getAttribute('data-set-index'));
		editor.innerFocus = { setIndex, type: 'ability', typeIndex: -1 };
		editor.setSearchType('ability', setIndex, '', -1);
		this.syncAbilitySearch(setIndex);
		editor.update();
	};
	removeAbility = (ev: Event) => {
		ev.stopPropagation();
		const target = ev.currentTarget as HTMLElement;
		const editor = this.props.room.editor;
		if (!editor) return;
		const setIndex = Number(target.getAttribute('data-set-index'));
		this.setEditor.selectAbility(editor, setIndex, target.getAttribute('data-ability')!);
		editor.update();
	};
	openMoves = (ev: Event) => {
		const editor = this.props.room.editor;
		if (!editor) return;
		const setIndex = Number((ev.currentTarget as HTMLElement).getAttribute('data-set-index'));
		editor.innerFocus = { setIndex, type: 'move', typeIndex: -1 };
		editor.setSearchType('move', setIndex, '', -1);
		editor.update();
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
		const setIndex = Number(box.getAttribute('data-set-index'));
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
		const value = Math.min(Math.abs(parseInt(target.value)), MAX_BASE_STAT);
		if (!value) return;
		const setIndex = Number(target.getAttribute('data-set-index'));
		const baseStats = { ...this.statsFor(setIndex) } as AnyObject;
		baseStats[target.name] = value;
		CustomDex.patch(this.speciesId(setIndex), { baseStats });
		this.save();
		this.props.room.editor?.update();
	};
	changeType = (ev: Event) => {
		const target = ev.currentTarget as HTMLSelectElement;
		const editor = this.props.room.editor;
		if (!editor) return;
		const setIndex = Number(target.getAttribute('data-set-index'));
		const typeIndex = Number(target.getAttribute('data-type-index'));
		const types = this.typesFor(setIndex).slice();
		if (target.value && types.some((type, i) => i !== typeIndex && type === target.value)) return;
		types[typeIndex] = target.value as Dex.TypeName;
		CustomDex.patch(this.speciesId(setIndex), { types: types.filter(Boolean) });
		this.save();
		editor.update();
	};
	speciesJSON(id: ID) {
		const data = CustomDex.overlay?.Pokedex[id];
		if (!data) return null;
		const out: AnyObject = { learnset: CustomDex.overlay!.Learnsets?.[id]?.learnset || {} };
		for (const field of SPECIES_FIELDS) {
			if (data[field] !== undefined) out[field] = data[field];
		}
		return JSON.stringify(out);
	}
	flush(id: ID) {
		if (this.saveTimer) clearTimeout(this.saveTimer);
		this.saveTimer = null;
		const json = id && this.speciesJSON(id);
		if (!json || this.savedJSON[id] === json) return;
		this.savedJSON[id] = json;
		PS.send(`/custompokemon edit ${CustomDex.overlay!.Pokedex[id].name}, ${json}`);
	}
	queueSave(id: ID) {
		if (this.saveTimer) clearTimeout(this.saveTimer);
		this.saveTimer = setTimeout(() => this.flush(id), SAVE_DELAY);
	}
	back = () => {
		const editor = this.props.room.editor;
		if (!editor) return;
		this.flush(this.editingId);
		this.editingId = '' as ID;
		editor.sets.splice(0);
		editor.save();
		this.openSpecies(0);
		editor.update();
	};
	detail = (ev: Event) => {
		const target = ev.currentTarget as HTMLInputElement;
		const setIndex = Number(target.getAttribute('data-set-index'));
		const value = target.type === 'checkbox' ? target.checked : target.value.trim();
		this.patchField(setIndex, target.name, value);
	};
	clearRatio = (ev: Event) => {
		this.patchField(Number((ev.currentTarget as HTMLElement).getAttribute('data-set-index')), 'genderRatio', '');
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
			changes.eggGroups = kept.length ? kept : null;
		} else if (value === '' || value === false) {
			changes[field] = null;
		} else if (field === 'weightkg' || field === 'heightm') {
			changes[field] = Number(value);
		} else if (field === 'evoLevel' || field === 'maxHP') {
			changes[field] = parseInt(value as string);
		} else if (field === 'genderRatio') {
			const male = Number(value) / 8;
			changes.genderRatio = { M: male, F: Math.round((1 - male) * 1000) / 1000 };
		} else if (field === 'tags') {
			changes.tags = (value as string).split(',').map(tag => tag.trim()).filter(Boolean);
		} else {
			changes[field] = value;
		}
		CustomDex.patch(id, changes);
		this.save();
	}
	setEditor: SetEditor = {
		back: this.back,
		renderAbilities: (editor, setIndex) => {
			const abilities = this.abilitiesFor(setIndex);
			const focus = editor.innerFocus;
			const cur = focus?.type === 'ability' && focus.setIndex === setIndex ? ' cur' : '';
			return <td class="set-abilities" colSpan={2}><div class="border-collapse">
				<label class="label">Abilities</label>
				<div
					class={`textbox chipbox${cur}`} data-set-index={setIndex} onClick={this.openAbilities}
					onDragOver={this.dragOverAbility} onDrop={this.dropAbility}
				>
					{abilities.map((ability, index) => <span
						class="chip" draggable data-index={index} onDragStart={this.dragAbility}
					>
						<small>{abilitySlots(abilities.length)[index]}:</small> {ability} <button
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
				<span class="typeslot">
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
			const cur = focus?.type === 'move' && focus.setIndex === setIndex ? ' cur' : '';
			return <div class="border-collapse learnset">
				<label class="label">Learnset</label>
				<div class={`textbox chipbox${cur}`} data-set-index={setIndex} onClick={this.openMoves}>
					<span class="chipnote">{moves.length} move{moves.length === 1 ? '' : 's'}</span>
				</div>
			</div>;
		},
		renderStats: (_editor, setIndex) => {
			const stats = this.statsFor(setIndex);
			if (!stats) return null;
			return <div style="font-size:10pt" role="dialog" aria-label="Stats"><div class="pad"><table>
				<tr><th></th><th>Base</th><th class="setstatbar"></th></tr>
				{Dex.statNames.map(statID => {
					const value = stats[statID];
					const width = Math.floor(value * STAT_BAR_WIDTH / MAX_BASE_STAT);
					const hue = Math.min(width, 360);
					return <tr>
						<th style="text-align:right;font-weight:normal">{BattleStatNames[statID]}</th>
						<td><input
							type="text" inputMode="numeric" name={statID} value={value} data-set-index={setIndex}
							class="textbox stat-input" style="width:40px" onInput={this.changeBaseStat}
						/></td>
						<td class="setstatbar"><label class="statslider">
							<span style={`width:${width}px;background:hsl(${hue},85%,45%);border-color:hsl(${hue},85%,35%)`}></span>
							<input
								type="range" name={statID} min="1" max={MAX_BASE_STAT} value={value}
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
				const hue = Math.min(Math.floor(value * 180 / MAX_BASE_STAT), 360);
				return <span class="statrow">
					<em>{BattleStatNames[statID]}</em> {}
					<span class="statgraph">
						<span style={`width:${value * 75 / MAX_BASE_STAT}px;` +
							`background:hsl(${hue},40%,75%);border-color:hsl(${hue},40%,45%)`}
						></span>
					</span> {}
					<strong>{value}</strong>
				</span>;
			});
		},
		renderRename: (_editor, setIndex) => (
			<button class="button rename" data-href={`pbrename-${setIndex}`} aria-label="Rename">
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
			const text = (name: string, value: any, width = 60) => <input
				type="text" name={name} value={value ?? ''} data-set-index={setIndex}
				class="textbox stat-input" style={`width:${width}px`} onChange={this.detail}
			/>;
			const select = (name: string, value: any, options: string[], blank = true) => <select
				name={name} value={value || ''} data-set-index={setIndex} class="select" onChange={this.detail}
			>
				{blank && <option value="">—</option>}
				{options.map(option => <option value={option}>{option}</option>)}
			</select>;
			return <div style="font-size:10pt" role="dialog" aria-label="Details"><div class="pad">
				<table class="detailtable">
					{field('Egg Groups', <>
						{select('eggGroup0', eggGroups[0], EGG_GROUPS)} {select('eggGroup1', eggGroups[1], EGG_GROUPS)}
					</>)}
					{field('Weight', <>{text('weightkg', data.weightkg)} kg</>)}
					{field('Height', <>{text('heightm', data.heightm)} m</>)}
					{field('Color', select('color', data.color, COLORS))}
					{field('Gender', select('gender', data.gender, ['M', 'F', 'N']))}
					{field('Gender ratio', <span class="genderratio">
						<input
							type="range" name="genderRatio" min="0" max="8" step="1"
							class={data.genderRatio ? 'ratioset' : ''} style={`--fill:${9 + eighths * 12}px`}
							value={eighths} data-set-index={setIndex} onInput={this.detail}
						/>
						{!!data.genderRatio && <button
							class="chipx" data-set-index={setIndex} onClick={this.clearRatio}
						>×</button>}
					</span>)}
					{field('Tags', text('tags', (data.tags || []).join(', '), 160))}
					{field('Forme', text('forme', data.forme, 160))}
					{field('Evo type', select('evoType', data.evoType, EVO_TYPES))}
					{field('Evo level', text('evoLevel', data.evoLevel, 40))}
					{field('Evo condition', text('evoCondition', data.evoCondition, 160))}
					{field('Max HP', text('maxHP', data.maxHP, 40))}
					{field('Dynamax', <label class="checkbox inline"><input
						type="checkbox" name="cannotDynamax" checked={!!data.cannotDynamax}
						data-set-index={setIndex} onChange={this.detail}
					/> Cannot Dynamax</label>)}
				</table>
			</div></div>;
		},
		renderNickname: (_editor, setIndex) => (
			<div class="spritebuttons">
				{SPRITE_LABELS.map((label, kindIndex) => (
					<button class="button" data-href={`pbsprite-${setIndex}-${kindIndex}`}>{label}</button>
				))}
			</div>
		),
		selectAbility: (editor, setIndex, name) => {
			const abilities = this.abilitiesFor(setIndex).slice();
			const index = abilities.indexOf(name);
			if (index >= 0) {
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
		const room = this.props.room;
		room.setFormat((ev.currentTarget as HTMLButtonElement).value);
		this.forceUpdate();
		PokebuilderPanel.getFormatResources(room.team.format).then(() => {
			this.forceUpdate();
		});
	};
	save = () => {
		const editor = this.props.room.editor;
		const id = toID(editor?.sets[editor.innerFocus?.setIndex ?? 0]?.species);
		if (id !== this.editingId) {
			this.flush(this.editingId);
			this.editingId = id;
		} else if (id) {
			this.queueSave(id);
		}
		this.forceUpdate();
	};
	renderResources() {
		const info = PokebuilderPanel.formatResources[this.props.room.team.format];
		const formatName = BattleLog.formatName(this.props.room.team.format);
		return (info && (info.resources.length || info.url)) ? (
			<details class="details" open>
				<summary><strong>Teambuilding resources for {formatName}</strong></summary>
				<div style="margin-left:5px"><ul>
					{info.resources.map(resource => (
						<li><p><a href={resource.url} target="_blank">{resource.resource_name}</a></p></li>
					))}
				</ul>
				<p>
					Find {info.resources.length ? 'more ' : ''}
					helpful resources for {formatName} on <a href={info.url} target="_blank">the Smogon Dex</a>.
				</p></div>
			</details>
		) : null;
	}
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
				team={team} onChange={this.save} resources={this.renderResources()}
				narrow={room.width < 550}
				editorRef={this.initEditor} setEditor={this.setEditor}
			>
				{!!(team.packedTeam && team.format.length > 4) && <p>
					<button data-cmd="/validate" class="button"><i class="fa fa-check"></i> Validate</button>
				</p>}
			</TeamEditor>
		</div></PSPanelWrapper>;
	}
}

class SpritePanel extends PSRoomPanel {
	static readonly id = 'pbsprite';
	static readonly routes = ['pbsprite-*'];
	static readonly location = 'popup';
	static readonly noURL = true;

	kindIndex() {
		return Number(this.props.room.id.slice(this.props.room.id.lastIndexOf('-') + 1));
	}
	set() {
		const parent = this.props.room.getParent() as PokebuilderRoom | null;
		const setIndex = Number(this.props.room.id.split('-')[1]);
		return parent?.editor?.sets[setIndex];
	}
	pick = () => {
		this.base!.querySelector<HTMLInputElement>('input[type=file]')!.click();
	};
	upload = (ev: Event) => {
		const file = (ev.currentTarget as HTMLInputElement).files?.[0];
		const species = this.set()?.species;
		if (!file || !species) return;
		const [width, height] = SPRITE_SIZES[this.kindIndex()];
		const kind = SPRITE_KINDS[this.kindIndex()];
		const image = new Image();
		const src = URL.createObjectURL(file);
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
			PS.send(`/custompokemon setsprite ${species}, ${kind}, ${canvas.toDataURL('image/png')}`);
			setTimeout(() => CustomDex.load(true), 1000);
			this.close();
		};
		image.src = src;
	};
	override render() {
		const room = this.props.room;
		const kind = SPRITE_KINDS[this.kindIndex()];
		const [width, height] = SPRITE_SIZES[this.kindIndex()];
		const url = CustomDex.sprites[toID(this.set()?.species)]?.[kind];
		return <PSPanelWrapper room={room}><div class="pad">
			<p><strong>{kind}</strong> <small>({width}&times;{height})</small></p>
			<p>{url ? (
				<img src={url} width={width} height={height} alt={kind} class="pixelated" />
			) : <em>No sprite yet</em>}</p>
			<p><button class="button" onClick={this.pick}>Upload sprite</button></p>
			<input type="file" accept="image/*" style="display:none" onChange={this.upload} />
		</div></PSPanelWrapper>;
	}
}

class RenamePanel extends PSRoomPanel {
	static readonly id = 'pbrename';
	static readonly routes = ['pbrename-*'];
	static readonly location = 'popup';
	static readonly noURL = true;

	set() {
		const parent = this.props.room.getParent() as PokebuilderRoom | null;
		return parent?.editor?.sets[Number(this.props.room.id.split('-')[1])];
	}
	rename = (ev: Event) => {
		ev.preventDefault();
		const set = this.set();
		const name = this.base!.querySelector<HTMLInputElement>('input[name=name]')!.value.trim();
		if (!set || !name || name === set.species) return this.close();
		PS.send(`/custompokemon edit ${set.species}, ${JSON.stringify({ name })}`);
		set.species = name;
		setTimeout(() => CustomDex.load(true), 1000);
		this.close();
	};
	override render() {
		return <PSPanelWrapper room={this.props.room}><div class="pad">
			<form onSubmit={this.rename}>
				<p><label class="label">Name<input
					type="text" name="name" class="textbox" autofocus value={this.set()?.species || ''}
				/></label></p>
				<p><button type="submit" class="button"><strong>Rename</strong></button></p>
			</form>
		</div></PSPanelWrapper>;
	}
}

PS.addRoomType(PokebuilderPanel);
PS.addRoomType(RenamePanel);
PS.addRoomType(SpritePanel);
