// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { IPCServer, createIPCServer } from "./ipcServer";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
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
		ipcServer = await createIPCServer(context.storageUri);
	} catch (err) {
		console.error(`Failed to create autodebug IPC: ${err}`);
	}
}

// This method is called when your extension is deactivated
export function deactivate() {}
