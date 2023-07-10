import * as vscode from "vscode";
import { IPCServer, createIPCServer } from "./ipcServer";
import { TerminalEnvironmentManager } from "./terminal";

export async function activate(context: vscode.ExtensionContext) {
	console.log("Autodebug extension activated");

	const config = vscode.workspace.getConfiguration("autodebug", null);
	const enabled = config.get<boolean>("enabled");

	if (!enabled) {
		console.log("Autodebug disabled");
		return;
	}

	let ipcServer: IPCServer | undefined = undefined;

	try {
		ipcServer = await createIPCServer(context.storageUri?.toString());
		context.subscriptions.push(ipcServer);
	} catch (err) {
		console.error(`Failed to create autodebug IPC: ${err}`);
	}

	const terminalEnvironmentManager = new TerminalEnvironmentManager(context, [ipcServer]);
	context.subscriptions.push(terminalEnvironmentManager);

	console.log("Autodebug extension running");
}

export function deactivate() {}
