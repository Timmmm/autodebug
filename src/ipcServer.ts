/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from "vscode";
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

export interface IIPCServer extends Disposable {
	readonly ipcHandlePath: string | undefined;
	getEnv(): { [key: string]: string };
	registerHandler(name: string, handler: IIPCHandler): Disposable;
}

export interface ITerminalEnvironmentProvider {
	featureDescription?: string;
	getTerminalEnv(): { [key: string]: string };
}

export class IPCServer implements IIPCServer, ITerminalEnvironmentProvider, Disposable {

	private handlers = new Map<string, IIPCHandler>();
	get ipcHandlePath(): string { return this._ipcHandlePath; }

	private pendingData: string = "";

	constructor(private server: net.Server, private _ipcHandlePath: string) {
		this.server.on("connection", socket => this.onConnection(socket));
	}

	registerHandler(name: string, handler: IIPCHandler): Disposable {
		this.handlers.set(`/${name}`, handler);
		return toDisposable(() => this.handlers.delete(name));
	}

	private onConnection(socket: net.Socket): void {
		// socket.addListener("error", ...); // TODO
		socket.addListener("data", data => this.onData(data));
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
		console.log(`got request: ${req}`);
	// 	if (!req.url) {
	// 		console.warn(`Request lacks url`);
	// 		return;
	// 	}

	// 	const handler = this.handlers.get(req.url);

	// 	if (!handler) {
	// 		console.warn(`IPC handler for ${req.url} not found`);
	// 		return;
	// 	}

	// 	const chunks: Buffer[] = [];
	// 	req.on("data", d => chunks.push(d));
	// 	req.on("end", () => {
	// 		const request = JSON.parse(Buffer.concat(chunks).toString("utf8"));
	// 		handler.handle(request).then(result => {
	// 			res.writeHead(200);
	// 			res.end(JSON.stringify(result));
	// 		}, () => {
	// 			res.writeHead(500);
	// 			res.end();
	// 		});
	// 	});
	// }
	}

	getEnv(): { [key: string]: string } {
		// eslint-disable-next-line @typescript-eslint/naming-convention
		return { AUTODEBUG_IPC_HANDLE: this.ipcHandlePath };
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
