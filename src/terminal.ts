// Based on VSCode's `extensions/git/src/terminal.ts` 293e46b36015307d159b3ea38ec8dbe534be9c76
// Copyright Microsoft, used under MIT license.

import { ExtensionContext, workspace } from "vscode";
import { filterEvent, IDisposable } from "./util";

export interface ITerminalEnvironmentProvider {
	getTerminalEnv(): { [key: string]: string };
}

export class TerminalEnvironmentManager {

	private readonly disposable: IDisposable;

	constructor(private readonly context: ExtensionContext, private readonly envProviders: (ITerminalEnvironmentProvider | undefined)[]) {
		this.disposable = filterEvent(workspace.onDidChangeConfiguration, e => e.affectsConfiguration("autodebug"))
			(this.refresh, this);

		this.refresh();
	}

	private refresh(): void {
		const config = workspace.getConfiguration("autodebug", null);
		this.context.environmentVariableCollection.clear();

		if (!config.get<boolean>("enabled", true)) {
			return;
		}

		for (const envProvider of this.envProviders) {
			const terminalEnv = envProvider?.getTerminalEnv() ?? {};

			for (const name of Object.keys(terminalEnv)) {
				this.context.environmentVariableCollection.replace(name, terminalEnv[name]!);
			}
		}
	}

	dispose(): void {
		this.disposable.dispose();
	}
}
