import * as path from 'path';
import { workspace, ExtensionContext } from 'vscode';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: ExtensionContext) {
    // Caminho do servidor - baseado no search result [2]
    const serverModule = context.asAbsolutePath(
        path.join('server', 'out', 'server.js')
    );

    // Opções de debug para desenvolvimento
    const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

    // Configuração do servidor
    const serverOptions: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
            options: debugOptions
        }
    };

    // Configuração do cliente - registrar para arquivos .pr
    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: 'file', language: 'pordosol' }],
        synchronize: {
            // Notificar sobre mudanças em arquivos de configuração
            fileEvents: workspace.createFileSystemWatcher('**/.pordosolrc')
        }
    };

    // Criar e iniciar o cliente
    client = new LanguageClient(
        'pordosolLanguageServer',
        'Por Do Sol Language Server',
        serverOptions,
        clientOptions
    );

    // Iniciar o cliente (isso também inicia o servidor)
    client.start();
}

export function deactivate(): Promise<void> | undefined {
    if (!client) {
        return undefined;
    }
    return client.stop();
}