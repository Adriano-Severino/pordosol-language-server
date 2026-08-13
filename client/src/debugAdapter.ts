import * as vscode from 'vscode';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export function registerDebugAdapter(context: vscode.ExtensionContext) {
    const factory: vscode.DebugAdapterDescriptorFactory = {
        createDebugAdapterDescriptor: (session: vscode.DebugSession) => {
            return new vscode.DebugAdapterInlineImplementation(new PordosolInlineAdapter());
        }
    };
    context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('pordosol', factory));
}

class PordosolInlineAdapter implements vscode.DebugAdapter, vscode.Disposable {
    private proc: ChildProcessWithoutNullStreams | undefined;
    private readonly pendingDebugCommands: string[] = [];
    private readonly onDidSendMessageEmitter = new vscode.EventEmitter<any>();
    onDidSendMessage = this.onDidSendMessageEmitter.event;

    // Mapa de código: por arquivo .pbc, lista de blocos com codeIds e range de linhas
    private pbcIndex: { [pbcPath: string]: Array<{ codeIds: string[]; headerLine: number; startLine: number; length: number }> } = {};
    // Controle de breakpoints enviados: por source path, lista de {codeId, ip}
    private sentBpsBySource: Map<string, Array<{ codeId: string; ip: number }>> = new Map();

    handleMessage(message: any): void {
        switch (message.type) {
            case 'request':
                this.handleRequest(message);
                break;
        }
    }

    dispose() {
        try { this.proc?.kill(); } catch { }
    }

    private handleRequest(request: any) {
        const { command, arguments: args, seq } = request;
        if (command === 'initialize') {
            this.send({ seq, type: 'response', request_seq: seq, success: true, command, body: { supportsConfigurationDoneRequest: true, supportsStepInRequest: true, supportsStepOverRequest: true, supportsStepOutRequest: true, supportsContinueRequest: true, supportsPauseRequest: true, supportsFunctionBreakpoints: true } });
            // Sem este evento o VS Code não conclui a configuração dos breakpoints.
            this.send({ type: 'event', event: 'initialized' });
        } else if (command === 'launch') {
            const program = args.program as string;
            const interpreterPath = args.interpreterPath as string;
            const cwd = args.cwd as string | undefined;
            const extraArgs = Array.isArray(args.args) ? args.args : [];
            const cliArgs = [program, '--debug', ...extraArgs];
            this.proc = spawn(interpreterPath, cliArgs, { cwd });
            this.proc.stdout.on('data', data => this.output(data.toString()));
            this.proc.stderr.on('data', data => this.output(data.toString()));
            this.proc.on('exit', _code => this.send({ type: 'event', event: 'terminated' }));
            for (const pendingCommand of this.pendingDebugCommands) this.proc.stdin.write(pendingCommand);
            this.pendingDebugCommands.length = 0;
            this.send({ seq, type: 'response', request_seq: seq, success: true, command });
            this.send({ type: 'event', event: 'stopped', body: { reason: 'entry' } });
        } else if (command === 'continue') {
            this.writeDbg('c\n');
            this.send({ seq, type: 'response', request_seq: seq, success: true, command });
        } else if (command === 'stepIn') {
            this.writeDbg('s\n');
            this.send({ seq, type: 'response', request_seq: seq, success: true, command });
        } else if (command === 'stepOver') {
            this.writeDbg('so\n');
            this.send({ seq, type: 'response', request_seq: seq, success: true, command });
        } else if (command === 'stepOut') {
            this.writeDbg('sr\n');
            this.send({ seq, type: 'response', request_seq: seq, success: true, command });
        } else if (command === 'pause') {
            this.writeDbg('p\n');
            this.send({ seq, type: 'response', request_seq: seq, success: true, command });
        } else if (command === 'setBreakpoints') {
            const src = args.source?.path as string | undefined;
            const reqBps = (args.breakpoints || []) as Array<{ line: number }>;
            this.output(`[Por Do Sol] Breakpoints recebidos para ${src ?? 'fonte desconhecida'}: ${reqBps.map(bp => bp.line).join(', ') || 'nenhum'}\n`);
            let respBps: Array<{ verified: boolean; line?: number; message?: string }> = [];
            if (!src) {
                respBps = reqBps.map(_ => ({ verified: false, message: 'Fonte desconhecida' }));
                this.send({ seq, type: 'response', request_seq: seq, success: true, command, body: { breakpoints: respBps } });
                return;
            }

            if (src.endsWith('.pr')) {
                // Mapear .pr para .pbc correspondente
                const pbcPath = src.replace(/\.pr$/, '.pbc');
                
                // Verificar se o .pbc existe
                try {
                    const fs = require('fs');
                    if (!fs.existsSync(pbcPath)) {
                        respBps = reqBps.map(bp => ({ verified: false, line: bp.line, message: 'Arquivo .pbc não encontrado. Compile o arquivo .pr primeiro.' }));
                        this.send({ seq, type: 'response', request_seq: seq, success: true, command, body: { breakpoints: respBps } });
                        return;
                    }
                    
                    // Usar o index do .pbc (similar ao caso .pbc direto)
                    if (!this.pbcIndex[pbcPath]) {
                        try { this.pbcIndex[pbcPath] = this.indexPbc(pbcPath); } catch (e: any) { /* ignore */ this.pbcIndex[pbcPath] = []; }
                    }
                    const blocks = this.pbcIndex[pbcPath] || [];
                    
                    // Construir novo conjunto de BPs desejados
                    const desired: Array<{ codeId: string; ip: number }> = [];
                    for (const bp of reqBps) {
                        const line0 = Math.max(0, (bp.line | 0) - 1);
                        const blk = blocks.find(b => line0 >= b.startLine && line0 < b.startLine + b.length);
                        if (!blk) { respBps.push({ verified: false, line: bp.line, message: 'Fora de um bloco de código' }); continue; }
                        const ip = line0 - blk.startLine;
                        for (const cid of blk.codeIds) desired.push({ codeId: cid, ip });
                        respBps.push({ verified: true, line: bp.line });
                    }
                    
                    // Calcular diff com enviados anteriormente
                    const prev = this.sentBpsBySource.get(pbcPath) || [];
                    const toKey = (x: { codeId: string; ip: number }) => `${x.codeId}#${x.ip}`;
                    const prevSet = new Set(prev.map(toKey));
                    const desiredSet = new Set(desired.map(toKey));
                    const toAdd = desired.filter(x => !prevSet.has(toKey(x)));
                    const toDel = prev.filter(x => !desiredSet.has(toKey(x)));
                    for (const x of toDel) this.writeDbg(`bp del ${x.codeId} ${x.ip}\n`);
                    for (const x of toAdd) this.writeDbg(`bp add ${x.codeId} ${x.ip}\n`);
                    this.sentBpsBySource.set(pbcPath, desired);
                    this.output(`[Por Do Sol] ${desired.length} breakpoint(s) enviado(s) ao interpretador.\n`);
                    this.send({ seq, type: 'response', request_seq: seq, success: true, command, body: { breakpoints: respBps } });
                    
                } catch (e) {
                    respBps = reqBps.map(bp => ({ verified: false, line: bp.line, message: 'Erro ao carregar .pbc' }));
                    this.send({ seq, type: 'response', request_seq: seq, success: true, command, body: { breakpoints: respBps } });
                }
            } else if (src.endsWith('.pbc')) {
                // Garante índice do .pbc
                if (!this.pbcIndex[src]) {
                    try { this.pbcIndex[src] = this.indexPbc(src); } catch (e: any) { /* ignore */ this.pbcIndex[src] = []; }
                }
                const blocks = this.pbcIndex[src] || [];
                // Constrói novo conjunto de BPs desejados
                const desired: Array<{ codeId: string; ip: number }> = [];
                for (const bp of reqBps) {
                    const line0 = Math.max(0, (bp.line | 0) - 1);
                    const blk = blocks.find(b => line0 >= b.startLine && line0 < b.startLine + b.length);
                    if (!blk) { respBps.push({ verified: false, line: bp.line, message: 'Fora de um bloco de código' }); continue; }
                    const ip = line0 - blk.startLine;
                    // Adiciona para todos os codeIds desse bloco (ex.: func: e main:)
                    for (const cid of blk.codeIds) desired.push({ codeId: cid, ip });
                    respBps.push({ verified: true, line: bp.line });
                }
                // Calcula diff com enviados anteriormente
                const prev = this.sentBpsBySource.get(src) || [];
                const toKey = (x: { codeId: string; ip: number }) => `${x.codeId}#${x.ip}`;
                const prevSet = new Set(prev.map(toKey));
                const desiredSet = new Set(desired.map(toKey));
                const toAdd = desired.filter(x => !prevSet.has(toKey(x)));
                const toDel = prev.filter(x => !desiredSet.has(toKey(x)));
                for (const x of toDel) this.writeDbg(`bp del ${x.codeId} ${x.ip}\n`);
                for (const x of toAdd) this.writeDbg(`bp add ${x.codeId} ${x.ip}\n`);
                this.sentBpsBySource.set(src, desired);
                this.send({ seq, type: 'response', request_seq: seq, success: true, command, body: { breakpoints: respBps } });
            } else {
                // Ainda não suportamos mapeamento .pr -> bytecode
                respBps = reqBps.map(bp => ({ verified: false, line: bp.line, message: 'Sem mapa de fonte (.pr). Abra o .pbc para setar breakpoints por enquanto.' }));
                this.send({ seq, type: 'response', request_seq: seq, success: true, command, body: { breakpoints: respBps } });
            }
        } else if (command === 'setFunctionBreakpoints') {
            const fbs = (args.breakpoints || []) as Array<{ name: string }>; // function names
            const desired: Array<{ codeId: string; ip: number }> = [];
            for (const fb of fbs) {
                const name = fb.name.trim();
                if (!name) continue;
                desired.push({ codeId: `func:${name}`, ip: 0 });
                desired.push({ codeId: `main:${name}`, ip: 0 });
            }
            // Envia diretamente (não associado a um arquivo de origem)
            for (const x of desired) this.writeDbg(`bp add ${x.codeId} ${x.ip}\n`);
            const resp = fbs.map(_ => ({ verified: true }));
            this.send({ seq, type: 'response', request_seq: seq, success: true, command, body: { breakpoints: resp } });
        } else if (command === 'disconnect' || command === 'terminate') {
            this.proc?.kill();
            this.send({ seq, type: 'response', request_seq: seq, success: true, command });
        } else if (command === 'threads') {
            this.send({ seq, type: 'response', request_seq: seq, success: true, command, body: { threads: [{ id: 1, name: 'main' }] } });
        } else if (command === 'stackTrace') {
            // Enviar comando stack ao interpretador
            this.writeDbg('stack\n');
            
            // Aguardar resposta (simulado - em produção seria assíncrono)
            // Por enquanto, retorna stack trace vazio
            this.send({ seq, type: 'response', request_seq: seq, success: true, command, body: { stackFrames: [], totalFrames: 0 } });
        } else if (command === 'scopes') {
            // Enviar comando varsjson ao interpretador
            this.writeDbg('varsjson\n');
            
            // Por enquanto, retorna scopes básicos
            this.send({ seq, type: 'response', request_seq: seq, success: true, command, body: { scopes: [{ name: 'Local', variablesReference: 1 }, { name: 'Global', variablesReference: 2 }] } });
        } else if (command === 'variables') {
            // Parsear resposta JSON do interpretador
            // Por enquanto, retorna variáveis vazias
            this.send({ seq, type: 'response', request_seq: seq, success: true, command, body: { variables: [] } });
        } else {
            this.send({ seq, type: 'response', request_seq: seq, success: true, command });
        }
    }

    private send(msg: any) { this.onDidSendMessageEmitter.fire(msg); }
    private output(text: string) {
        this.send({ type: 'event', event: 'output', body: { category: 'stdout', output: text } });
    }
    private writeDbg(cmd: string) {
        try {
            if (this.proc?.stdin.writable) this.proc.stdin.write(cmd);
            else this.pendingDebugCommands.push(cmd);
        } catch { this.pendingDebugCommands.push(cmd); }
    }

    // Cria um índice simples do .pbc: para cada bloco DEFINE_* mapeia as linhas de corpo para IPs e codeIds
    private indexPbc(pbcPath: string): Array<{ codeIds: string[]; headerLine: number; startLine: number; length: number }> {
        const content = fs.readFileSync(pbcPath, 'utf8');
        const lines = content.split(/\r?\n/);
        const blocks: Array<{ codeIds: string[]; headerLine: number; startLine: number; length: number }> = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith('DEFINE_FUNCTION ')) {
                // DEFINE_FUNCTION <nome> <len> [params]
                const parts = line.split(/\s+/);
                const name = parts[1];
                const len = parseInt(parts[2], 10) || 0;
                const start = i + 1;
                const codeIds = [`func:${name}`, `main:${name}`];
                blocks.push({ codeIds, headerLine: i, startLine: start, length: len });
                i = start + len - 1; // skip body
            } else if (line.startsWith('DEFINE_METHOD ')) {
                // DEFINE_METHOD <classe> <nome> <len> [params]
                const parts = line.split(/\s+/);
                const klass = parts[1];
                const name = parts[2];
                const len = parseInt(parts[3], 10) || 0;
                const start = i + 1;
                const codeIds = [name === 'construtor' ? `ctor:${klass}` : `method:${klass}::${name}`];
                // Também indexa pelo nome literal para uso futuro
                blocks.push({ codeIds, headerLine: i, startLine: start, length: len });
                i = start + len - 1;
            } else if (line.startsWith('DEFINE_STATIC_METHOD ')) {
                // DEFINE_STATIC_METHOD <classe> <nome> <len> [params]
                const parts = line.split(/\s+/);
                const klass = parts[1];
                const name = parts[2];
                const len = parseInt(parts[3], 10) || 0;
                const start = i + 1;
                const codeIds = [`static:${klass}::${name}`];
                blocks.push({ codeIds, headerLine: i, startLine: start, length: len });
                i = start + len - 1;
            }
        }
        return blocks;
    }
}
