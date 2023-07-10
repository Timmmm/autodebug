/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, debug } from "vscode";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import * as net from "net";
import * as crypto from "crypto";
import { toDisposable } from "./util";



function getIPCHandlePath(id: string): string {
	if (process.platform === "win32") {
		return `\\\\.\\pipe\\autodebug-${id}-sock`;
	}

	if (process.platform !== "darwin" && process.env["XDG_RUNTIME_DIR"]) {
		return path.join(process.env["XDG_RUNTIME_DIR"] as string, `autodebug-${id}.sock`);
	}

	return path.join(os.tmpdir(), `autodebug-${id}.sock`);
}

export interface IIPCHandler {
	handle(request: any): Promise<any>;
}

// `context` is fed into a hash to make the random IPC socket name.
export async function createIPCServer(context?: string): Promise<IPCServer> {
	const server = net.createServer();
	const hash = crypto.createHash("sha1");

	if (!context) {
		console.warn("No context given to autodebug");
		const buffer = await new Promise<Buffer>((c, e) => crypto.randomBytes(20, (err, buf) => err ? e(err) : c(buf)));
		hash.update(buffer);
	} else {
		hash.update(context);
	}

	const ipcHandlePath = getIPCHandlePath(hash.digest("hex").substr(0, 10));

	if (process.platform !== "win32") {
		try {
			await fs.promises.unlink(ipcHandlePath);
		} catch {
			// noop
		}
	}

	return new Promise((c, e) => {
		try {
			server.on("error", err => e(err));
			server.listen(ipcHandlePath);
			c(new IPCServer(server, ipcHandlePath));
		} catch (err) {
			e(err);
		}
	});
}

export interface ITerminalEnvironmentProvider {
	getTerminalEnv(): { [key: string]: string };
}

export class IPCServer implements ITerminalEnvironmentProvider, Disposable {

	private handlers = new Map<string, IIPCHandler>();
	get ipcHandlePath(): string { return this._ipcHandlePath; }

	private pendingData: string = "";

	constructor(private server: net.Server, private _ipcHandlePath: string) {
		this.server.on("connection", socket => this.onConnection(socket));
	}

	// TODO: Use this?
	registerHandler(name: string, handler: IIPCHandler): Disposable {
		this.handlers.set(`/${name}`, handler);
		return toDisposable(() => this.handlers.delete(name));
	}

	private onConnection(socket: net.Socket): void {
		console.log("autodebug connection");
		// TODO: Make a Client class, otherwise if multiple things connect
		// at the same time it will break.
		socket.addListener("data", data => this.onData(data));
		socket.addListener("error", err => {
			// TODO: Show error to the user.
			console.error(err);
		});
	}

	private onData(data: Buffer): void {
		const dataStr = data.toString("utf8");
		this.pendingData += dataStr;
		const newline = this.pendingData.indexOf("\n");
		if (newline !== -1) {
			const req = this.pendingData.slice(0, newline);
			this.pendingData = this.pendingData.slice(newline+1);
			this.onRequest(req);
		}
	}

	private onRequest(req: string): void {
		console.log(`autodebug request3: ${req}`);
		try {
			const config = JSON.parse(req);
			debug.startDebugging(undefined, config);
		} catch (e) {
			console.log(`error starting debug: ${e}`);
		}
	}

	getTerminalEnv(): { [key: string]: string } {
		// eslint-disable-next-line @typescript-eslint/naming-convention
		return { AUTODEBUG_IPC_HANDLE: this.ipcHandlePath };
	}

	dispose(): void {
		this.handlers.clear();
		this.server.close();

		if (this._ipcHandlePath && process.platform !== "win32") {
			fs.unlinkSync(this._ipcHandlePath);
		}
	}
}
