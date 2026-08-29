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
import { TeamPanel } from "./panel-teambuilder-team";
import {
	abilitySlots, COLORS, CustomDex, EGG_GROUPS, EVO_TYPES, PokebuilderDexSearch, speciesAbilities,
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

const INT_FIELDS = ['evoLevel', 'maxHP'];
const NUMBER_FIELDS = ['weightkg', 'heightm', ...INT_FIELDS];
const MAX_ABILITIES = 3;
const MAX_BASE_STAT = 255;
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

	editingId = '' as ID;

	loadResources() {
		const format = this.props.room.team.format;
		if (format.length <= 4) return;
		TeamPanel.getFormatResources(format).then(() => {
			this.forceUpdate();
		});
	}

	override componentWillUnmount() {
		CustomDex.flush(this.editingId);
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
		this.loadResources();
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
		CustomDex.patch(this.speciesId(setIndex), { abilities: table });
		this.save();
		set.abilities = abilities;
		set.ability = abilities[0] || '';
	}
	syncAbilitySearch(setIndex: number) {
		const editor = this.props.room.editor;
		this.abilitiesFor(setIndex);
		if (editor?.innerFocus?.type === 'ability') (editor.search as PokebuilderDexSearch).refresh();
	}
	openAbilities = (ev: Event) => {
		const setIndex = setIndexOf(ev);
		this.openPicker(setIndex, 'ability');
		this.syncAbilitySearch(setIndex);
		this.props.room.editor?.update();
	};
	removeAbility = (ev: Event) => {
		ev.stopPropagation();
		const editor = this.props.room.editor;
		if (!editor) return;
		const target = ev.currentTarget as HTMLElement;
		this.setEditor.selectAbility(editor, setIndexOf(ev), target.getAttribute('data-ability')!);
		editor.update();
	};
	openMoves = (ev: Event) => {
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
		const value = Math.min(Math.abs(parseInt(target.value)), MAX_BASE_STAT);
		if (!value) return;
		const setIndex = setIndexOf(ev);
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
		const setIndex = setIndexOf(ev);
		const typeIndex = Number(target.getAttribute('data-type-index'));
		const types = this.typesFor(setIndex).slice();
		if (target.value && types.some((type, i) => i !== typeIndex && type === target.value)) return;
		types[typeIndex] = target.value as Dex.TypeName;
		CustomDex.patch(this.speciesId(setIndex), { types: types.filter(Boolean) });
		this.save();
		editor.update();
	};
	rename = (ev: Event) => {
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
				this.editingId = toID(renamed);
				editor.update();
			});
		});
	};
	back = () => {
		const editor = this.props.room.editor;
		if (!editor) return;
		CustomDex.flush(this.editingId);
		this.editingId = '' as ID;
		editor.sets.splice(0);
		editor.save();
		this.openPicker(0, 'pokemon');
		editor.update();
	};
	detail = (ev: Event) => {
		const target = ev.currentTarget as HTMLInputElement;
		const setIndex = setIndexOf(ev);
		const value = target.type === 'checkbox' ? target.checked : target.value.trim();
		this.patchField(setIndex, target.name, value);
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
			changes[field] = amount;
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
			const slots = this.abilitySlotsFor(setIndex);
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
			<button class="button rename" data-set-index={setIndex} onClick={this.rename} aria-label="Rename">
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
				{SPRITES.map((sprite, kindIndex) => (
					<button class="button" data-href={`pbsprite-${setIndex}-${kindIndex}`}>{sprite.label}</button>
				))}
			</div>
		),
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
		this.loadResources();
	};
	save = () => {
		const editor = this.props.room.editor;
		const id = toID(editor?.sets[editor.innerFocus?.setIndex ?? 0]?.species);
		if (id !== this.editingId) {
			CustomDex.flush(this.editingId);
			this.editingId = id;
		}
		if (id) CustomDex.queueSave(id);
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
				team={team} onChange={this.save} resources={TeamPanel.renderResources(team.format)}
				narrow={room.width < 550}
				editorRef={this.initEditor}
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
	override render() {
		const { set, kind, width, height } = this.sprite();
		const url = CustomDex.sprites[toID(set?.species)]?.[kind];
		return <PSPanelWrapper room={this.props.room}><div class="pad">
			<p><strong>{kind}</strong> <small>({width}&times;{height})</small></p>
			<p>{url ? (
				<img src={url} width={width} height={height} alt={kind} class="pixelated" />
			) : <em>No sprite yet</em>}</p>
			<p><button class="button" onClick={this.pick}>Upload sprite</button></p>
			<input type="file" accept="image/*" style="display:none" onChange={this.upload} />
		</div></PSPanelWrapper>;
	}
}

PS.addRoomType(PokebuilderPanel);
PS.addRoomType(SpritePanel);
