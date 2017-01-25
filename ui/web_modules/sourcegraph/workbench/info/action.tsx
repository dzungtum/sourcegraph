import { Subscription } from "rxjs";

import { KeyCode, KeyMod } from "vs/base/common/keyCodes";
import { IDisposable } from "vs/base/common/lifecycle";
import { editorContribution } from "vs/editor/browser/editorBrowserExtensions";
import { EmbeddedCodeEditorWidget } from "vs/editor/browser/widget/embeddedCodeEditorWidget";
import * as editorCommon from "vs/editor/common/editorCommon";
import { IEditorContribution, IModel } from "vs/editor/common/editorCommon";
import { EditorAction, IActionOptions, ServicesAccessor, editorAction } from "vs/editor/common/editorCommonExtensions";
import { CommonEditorRegistry } from "vs/editor/common/editorCommonExtensions";
import { PeekContext, getOuterEditor } from "vs/editor/contrib/zoneWidget/browser/peekViewWidget";
import { ContextKeyExpr } from "vs/platform/contextkey/common/contextkey";
import { IEditorService } from "vs/platform/editor/common/editor";
import { KeybindingsRegistry } from "vs/platform/keybinding/common/keybindingsRegistry";

import { normalisePosition } from "sourcegraph/editor/contrib";
import { DefinitionData, fetchDependencyReferences, provideDefinition, provideGlobalReferences, provideReferences, provideReferencesCommitInfo } from "sourcegraph/util/RefsBackend";
import { ReferencesModel } from "sourcegraph/workbench/info/referencesModel";
import { infoStore } from "sourcegraph/workbench/info/sidebar";

import ModeContextKeys = editorCommon.ModeContextKeys;

interface Props {
	editorModel: IModel;
	lspParams: {
		position: {
			line: number,
			character: number
		},
	};
};

const OpenInfoPanelID = "editor.contrib.openInfoPanel";

@editorContribution
export class ReferenceAction implements IEditorContribution {
	private toDispose: IDisposable[] = [];

	public getId(): string {
		return OpenInfoPanelID;
	}

	public dispose(): void {
		this.toDispose.forEach(disposable => disposable.dispose());
	}

}

export class DefinitionActionConfig {
	constructor(
		public sideBarID: string = "",
	) {
		//
	}
}

export class DefinitionAction extends EditorAction {

	private _configuration: DefinitionActionConfig;
	private globalFetchSubscription?: Promise<Subscription | undefined>;

	constructor(configuration: DefinitionActionConfig, opts: IActionOptions) {
		super(opts);
		this._configuration = configuration;
	}

	public run(accessor: ServicesAccessor, editor: editorCommon.ICommonCodeEditor): void {
		const editorService = accessor.get(IEditorService);
		const outerEditor = getOuterEditor(accessor, {});

		editor.onDidChangeModel(event => {
			let oldModel = event.oldModelUrl;
			let newModel = event.newModelUrl;
			if (oldModel.toString() !== newModel.toString()) {
				this.prepareInfoStore(false, "");
			}
		});

		this.onResult(editorService, editor, outerEditor);
	}

	async renderSidePanelForData(props: Props): Promise<Subscription | undefined> {
		const defPromise = provideDefinition(props.editorModel, props.lspParams.position);
		const localRefsPromise = provideReferences(props.editorModel, props.lspParams.position);
		const def = await defPromise;
		const id = this._configuration.sideBarID;
		if (!def) {
			return;
		}
		this.prepareInfoStore(true, this._configuration.sideBarID);
		this.dispatchInfo(id, def);

		const localRefs = await localRefsPromise;
		if (this._configuration.sideBarID !== id) {
			return;
		}
		if (!localRefs || localRefs.length === 0) {
			this.dispatchInfo(id, def, null);
			return;
		}

		let refModel = new ReferencesModel(localRefs, props.editorModel.uri);
		this.dispatchInfo(id, def, refModel);

		const localRefsWithCommitInfo = await provideReferencesCommitInfo(localRefs);
		refModel = new ReferencesModel(localRefsWithCommitInfo, props.editorModel.uri);
		if (this._configuration.sideBarID !== id) {
			return;
		}
		this.dispatchInfo(id, def, refModel);

		const depRefs = await fetchDependencyReferences(props.editorModel, props.lspParams.position);
		if (!depRefs || this._configuration.sideBarID !== id) {
			this.dispatchInfo(id, def, refModel, true);
			return;
		}

		let localAndGlobalRefs = localRefsWithCommitInfo;
		return provideGlobalReferences(props.editorModel, depRefs).subscribe(refs => {
			localAndGlobalRefs = localAndGlobalRefs.concat(refs);
			refModel = new ReferencesModel(localAndGlobalRefs, props.editorModel.uri);
			this.dispatchInfo(id, def, refModel);
		}, () => null, () => this.dispatchInfo(id, def, refModel, true));
	}

	private prepareInfoStore(prepare: boolean, id: string): void {
		if (!prepare && this.globalFetchSubscription) {
			this.globalFetchSubscription.then(sub => sub && sub.unsubscribe());
		}
		infoStore.dispatch({ defData: null, prepareData: { open: prepare }, loadingComplete: true, id });
	}

	private dispatchInfo(id: string, defData: DefinitionData, refModel?: ReferencesModel | null, loadingComplete?: boolean): void {
		if (id === this._configuration.sideBarID) {
			infoStore.dispatch({ defData, refModel, loadingComplete, id });
		} else if (this.globalFetchSubscription) {
			this.globalFetchSubscription.then(sub => sub && sub.unsubscribe());
		}
	}

	private onResult(editorService: IEditorService, editor: editorCommon.ICommonCodeEditor, outerEditor: editorCommon.ICommonCodeEditor): void {
		const model = editor.getModel();
		const position = normalisePosition(model, editor.getPosition());
		const word = model.getWordAtPosition(position);
		if (!word) {
			return;
		}

		this._configuration.sideBarID = model.uri.toString() + position.lineNumber + ":" + position.column;

		if (editor instanceof EmbeddedCodeEditorWidget) {
			const range = {
				startLineNumber: position.lineNumber,
				startColumn: word.startColumn,
				endLineNumber: position.lineNumber,
				endColumn: word.endColumn,
			};
			this.prepareInfoStore(true, this._configuration.sideBarID);
			editorService.openEditor({
				resource: model.uri,
				options: {
					selection: range,
					revealIfVisible: true,
				}
			}, true).then(() => {
				this.openInSidebar(editor, position);
			});

			return;
		}

		if (ContextKeyExpr.and(ModeContextKeys.hasDefinitionProvider, PeekContext.notInPeekEditor)) {
			this.openInSidebar(editor, position);
		}
	}

	private openInSidebar(editor: editorCommon.ICommonCodeEditor, pos: editorCommon.IPosition): void {
		this.globalFetchSubscription = this.renderSidePanelForData({
			editorModel: editor.getModel(),
			lspParams: {
				position: {
					line: pos.lineNumber - 1,
					character: pos.column - 1,
				},
			},
		});

		this.highlightWord(editor, pos);
	}

	private highlightWord(editor: editorCommon.ICommonCodeEditor, position: editorCommon.IPosition): void {
		const model = editor.getModel();
		const word = model.getWordAtPosition(position);
		editor.setSelection({
			startLineNumber: position.lineNumber,
			startColumn: word.startColumn,
			endLineNumber: position.lineNumber,
			endColumn: word.endColumn,
		});
	}

}

@editorAction
export class GoToDefinitionAction extends DefinitionAction {

	public static ID: string = "editor.action.openSidePanel";

	constructor() {
		super(new DefinitionActionConfig(), {
			id: GoToDefinitionAction.ID,
			label: "Open Side Panel",
			alias: "Open Side Panel",
			precondition: ModeContextKeys.hasDefinitionProvider,
		});
	}
}

function closeActiveReferenceSearch(): void {
	infoStore.dispatch({ defData: null, prepareData: { open: false }, loadingComplete: true, id: "" });
}

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: "closeSidePaneWidget",
	weight: CommonEditorRegistry.commandWeight(-202),
	primary: KeyCode.Escape,
	secondary: [KeyMod.Shift | KeyCode.Escape | KeyCode.Delete], // tslint:disable-line
	when: ContextKeyExpr.and(ContextKeyExpr.not("config.editor.stablePeek")),
	handler: closeActiveReferenceSearch
});
