/**
 * Team editor hooks
 *
 * @license AGPLv3
 */

import type { InnerFocusType, TeamEditorState } from "./battle-team-editor";

export interface SetEditor {
	/** Replaces one cell of the set form, keyed by cell. */
	render?: { [cell: string]: (editor: TeamEditorState, setIndex: number) => preact.ComponentChildren };
	renderSearchBottom?: (editor: TeamEditorState, setIndex: number, type: InnerFocusType) => preact.ComponentChildren;
	deleteSet?: (ev: Event) => void;
	/** Called before the team view would render, for editors that only ever show one set. */
	restoreFocus?: (editor: TeamEditorState) => void;
	/** Tooltips for the shared set-form controls, keyed by control name. */
	titles?: { [control: string]: string };
	/** Editors whose sets aren't team members have nowhere to copy them to. */
	hideCopy?: boolean;
	/** Sample and saved competitive sets don't apply to every kind of set. */
	hideSampleSets?: boolean;
	hideOptions?: boolean;
	/** What the Import/Export tab shows, for an editor whose text isn't a team's. */
	textTab?: (editor: TeamEditorState) => preact.ComponentChildren;
	/** Import/export of whatever this editor considers a "set", in place of PokePaste sets. */
	importExport?: {
		/** The heading, where the text isn't a set's. */
		label?: string,
		export: (editor: TeamEditorState, setIndex: number) => string,
		/** Applies the text, returning an error message to show, or '' on success. */
		import: (editor: TeamEditorState, setIndex: number, text: string) => string,
	};
	back?: (ev?: Event) => void;
	selectAbility?: (editor: TeamEditorState, setIndex: number, name: string) => void;
	/** Return true to claim the click, for pickers that aren't choosing the set's own species. */
	selectSpecies?: (editor: TeamEditorState, setIndex: number, name: string) => boolean;
	/** The same for every other kind of result, for a picker that isn't building a set at all. */
	selectEntry?: (editor: TeamEditorState, setIndex: number, type: string, name: string) => boolean;
}
