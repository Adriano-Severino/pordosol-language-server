import {
    createConnection,
    TextDocuments,
    Diagnostic,
    DiagnosticSeverity,
    ProposedFeatures,
    InitializeParams,
    DidChangeConfigurationNotification,
    CompletionItem,
    CompletionItemKind,
    TextDocumentPositionParams,
    TextDocumentSyncKind,
    InitializeResult,
    TextDocumentChangeEvent,
    HoverParams,
    Hover,
    MarkupKind,
    Position,
    Range
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';

// Criar conexão usando IPC do Node.js
const connection = createConnection(ProposedFeatures.all);

// Gerenciador de documentos de texto
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

// Capabilities do cliente
let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

// Inicialização do servidor
connection.onInitialize((params: InitializeParams) => {
    const capabilities = params.capabilities;

    // Verificar capabilities do cliente
    hasConfigurationCapability = !!(
        capabilities.workspace && !!capabilities.workspace.configuration
    );
    hasWorkspaceFolderCapability = !!(
        capabilities.workspace && !!capabilities.workspace.workspaceFolders
    );
    hasDiagnosticRelatedInformationCapability = !!(
        capabilities.textDocument &&
        capabilities.textDocument.publishDiagnostics &&
        capabilities.textDocument.publishDiagnostics.relatedInformation
    );

    const result: InitializeResult = {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Incremental,
            // Autocomplete com trigger characters
            completionProvider: {
                resolveProvider: true,
                triggerCharacters: ['.', ' ', '(', '=', 's', 'e', 'i', 't', 'b']
            },
            // Hover para informações
            hoverProvider: true,
            // Assinatura de funções
            signatureHelpProvider: {
                triggerCharacters: ['(', ',']
            }
        }
    };

    if (hasWorkspaceFolderCapability) {
        result.capabilities.workspace = {
            workspaceFolders: {
                supported: true
            }
        };
    }
    return result;
});

connection.onInitialized(() => {
    if (hasConfigurationCapability) {
        connection.client.register(DidChangeConfigurationNotification.type, undefined);
    }
    if (hasWorkspaceFolderCapability) {
        connection.workspace.onDidChangeWorkspaceFolders(_event => {
            connection.console.log('Por Do Sol: Workspace folder change event received.');
        });
    }
});

// Configurações da linguagem Por Do Sol
interface PorDoSolSettings {
    maxNumberOfProblems: number;
    enableStrictMode: boolean;
    showWarnings: boolean;
}

const defaultSettings: PorDoSolSettings = { 
    maxNumberOfProblems: 1000,
    enableStrictMode: true,
    showWarnings: true
};
let globalSettings: PorDoSolSettings = defaultSettings;

// Cache de configurações por documento
const documentSettings: Map<string, Promise<PorDoSolSettings>> = new Map();

connection.onDidChangeConfiguration(change => {
    if (hasConfigurationCapability) {
        documentSettings.clear();
    } else {
        globalSettings = <PorDoSolSettings>(
            (change.settings.pordosolLanguageServer || defaultSettings)
        );
    }
    // Revalidar todos os documentos
    documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource: string): Promise<PorDoSolSettings> {
    if (!hasConfigurationCapability) {
        return Promise.resolve(globalSettings);
    }
    let result = documentSettings.get(resource);
    if (!result) {
        result = connection.workspace.getConfiguration({
            scopeUri: resource,
            section: 'pordosolLanguageServer'
        });
        documentSettings.set(resource, result);
    }
    return result;
}

// Remover configurações quando documento é fechado
documents.onDidClose(e => {
    documentSettings.delete(e.document.uri);
});

// AUTOCOMPLETAR INTELIGENTE PARA POR DO SOL
connection.onCompletion(
    (textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
        const document = documents.get(textDocumentPosition.textDocument.uri);
        if (!document) {
            return [];
        }

        const text = document.getText();
        const position = textDocumentPosition.position;
        const lineText = document.getText({
            start: { line: position.line, character: 0 },
            end: { line: position.line, character: position.character }
        });

        const completions: CompletionItem[] = [];

        // Palavras-chave principais da linguagem Por Do Sol
        const keywords = [
            {
                label: 'se',
                kind: CompletionItemKind.Keyword,
                insertText: 'se ${1:condicao} então {\n\t$2\n}',
                documentation: 'Estrutura condicional se-então-senão da linguagem Por Do Sol',
                detail: 'Condicional - Por Do Sol'
            },
            {
                label: 'enquanto',
                kind: CompletionItemKind.Keyword,
                insertText: 'enquanto ${1:condicao} {\n\t$2\n}',
                documentation: 'Loop enquanto condição for verdadeira na linguagem Por Do Sol',
                detail: 'Loop - Por Do Sol'
            },
            {
                label: 'imprima',
                kind: CompletionItemKind.Function,
                insertText: 'imprima(${1:valor});',
                documentation: 'Função para imprimir valores na tela (linguagem Por Do Sol)',
                detail: 'Função de saída - Por Do Sol'
            },
            {
                label: 'então',
                kind: CompletionItemKind.Keyword,
                insertText: 'então',
                documentation: 'Usado após condição no comando se (linguagem Por Do Sol)',
                detail: 'Palavra-chave condicional'
            },
            {
                label: 'senão',
                kind: CompletionItemKind.Keyword,
                insertText: 'senão {\n\t$1\n}',
                documentation: 'Bloco alternativo da estrutura se (linguagem Por Do Sol)',
                detail: 'Condicional alternativa'
            }
        ];

        // Tipos de dados
        const types = [
            {
                label: 'inteiro',
                kind: CompletionItemKind.TypeParameter,
                insertText: 'inteiro ${1:nome} = ${2:0};',
                documentation: 'Tipo de dados para números inteiros de 64 bits (linguagem Por Do Sol)',
                detail: 'Tipo de dados - Por Do Sol'
            },
            {
                label: 'texto',
                kind: CompletionItemKind.TypeParameter,
                insertText: 'texto ${1:nome} = "${2:valor}";',
                documentation: 'Tipo de dados para strings de texto (linguagem Por Do Sol)',
                detail: 'Tipo de dados - Por Do Sol'
            },
            {
                label: 'booleano',
                kind: CompletionItemKind.TypeParameter,
                insertText: 'booleano ${1:nome} = ${2|verdadeiro,falso|};',
                documentation: 'Tipo de dados lógico verdadeiro/falso (linguagem Por Do Sol)',
                detail: 'Tipo de dados - Por Do Sol'
            }
        ];

        // Valores booleanos
        const booleans = [
            {
                label: 'verdadeiro',
                kind: CompletionItemKind.Value,
                insertText: 'verdadeiro',
                documentation: 'Valor booleano verdadeiro (linguagem Por Do Sol)',
                detail: 'Valor booleano'
            },
            {
                label: 'falso',
                kind: CompletionItemKind.Value,
                insertText: 'falso',
                documentation: 'Valor booleano falso (linguagem Por Do Sol)',
                detail: 'Valor booleano'
            }
        ];

        // Operadores
        const operators = [
            {
                label: '==',
                kind: CompletionItemKind.Operator,
                insertText: '== ',
                documentation: 'Operador de igualdade (linguagem Por Do Sol)',
                detail: 'Comparação'
            },
            {
                label: '!=',
                kind: CompletionItemKind.Operator,
                insertText: '!= ',
                documentation: 'Operador de diferença (linguagem Por Do Sol)',
                detail: 'Comparação'
            },
            {
                label: '>=',
                kind: CompletionItemKind.Operator,
                insertText: '>= ',
                documentation: 'Maior ou igual que (linguagem Por Do Sol)',
                detail: 'Comparação'
            },
            {
                label: '<=',
                kind: CompletionItemKind.Operator,
                insertText: '<= ',
                documentation: 'Menor ou igual que (linguagem Por Do Sol)',
                detail: 'Comparação'
            }
        ];

        // Autocompletar inteligente baseado no contexto
        if (lineText.trim().length === 0) {
            // Início de linha - mostrar tudo
            completions.push(...keywords, ...types);
        } else if (lineText.includes('inteiro') || lineText.includes('texto') || lineText.includes('booleano')) {
            // Contexto de declaração
            if (lineText.includes('=')) {
                // Após =, mostrar valores e variáveis
                completions.push(...booleans, ...getVariableNames(text));
            } else {
                // Mostrar operador de atribuição
                completions.push({
                    label: '=',
                    kind: CompletionItemKind.Operator,
                    insertText: '= ',
                    documentation: 'Operador de atribuição (linguagem Por Do Sol)'
                });
            }
        } else if (lineText.includes('se ') && !lineText.includes('então')) {
            // Contexto de condição
            completions.push(...operators, ...getVariableNames(text));
            completions.push({
                label: 'então',
                kind: CompletionItemKind.Keyword,
                insertText: 'então {\n\t$1\n}',
                documentation: 'Bloco de execução da condição (linguagem Por Do Sol)'
            });
        } else if (lineText.includes('imprima(')) {
            // Dentro de imprima, mostrar variáveis disponíveis
            completions.push(...getVariableNames(text));
        } else {
            // Contexto geral
            completions.push(...keywords, ...types);
        }

        return completions;
    }
);

// Resolver detalhes adicionais do autocompletar
connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
    return item;
});

// Extrair nomes de variáveis do código
function getVariableNames(text: string): CompletionItem[] {
    const variableRegex = /(?:inteiro|texto|booleano)\s+(\w+)/g;
    const variables: CompletionItem[] = [];
    let match;

    while ((match = variableRegex.exec(text)) !== null) {
        variables.push({
            label: match[1],
            kind: CompletionItemKind.Variable,
            insertText: match[1],
            documentation: `Variável declarada: ${match[1]} (linguagem Por Do Sol)`,
            detail: 'Variável - Por Do Sol'
        });
    }

    return variables;
}

// VALIDAÇÃO DE SINTAXE EM TEMPO REAL
documents.onDidChangeContent((change: TextDocumentChangeEvent<TextDocument>) => {
    validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
    const settings = await getDocumentSettings(textDocument.uri);
    const text = textDocument.getText();
    const diagnostics: Diagnostic[] = [];

    const lines = text.split('\n');
    
    lines.forEach((line: string, index: number) => {
        const trimmed = line.trim();
        
        // Verificar comandos sem ponto e vírgula
        if (trimmed && 
            (trimmed.includes('imprima(') || 
             trimmed.match(/^(inteiro|texto|booleano)\s+\w+/) ||
             trimmed.includes(' = ')) &&
            !trimmed.endsWith(';') && 
            !trimmed.endsWith('{') &&
            !trimmed.endsWith('}') &&
            !trimmed.startsWith('//')) {
            
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: {
                    start: { line: index, character: 0 },
                    end: { line: index, character: line.length }
                },
                message: 'Comando deve terminar com ponto e vírgula (;) - Linguagem Por Do Sol',
                source: 'Por Do Sol Language Server',
                code: 'missing-semicolon'
            });
        }

        // Verificar strings não fechadas
        if (trimmed.includes('"') && (trimmed.split('"').length - 1) % 2 !== 0) {
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: {
                    start: { line: index, character: trimmed.indexOf('"') },
                    end: { line: index, character: line.length }
                },
                message: 'String não fechada - adicione aspas duplas no final (Por Do Sol)',
                source: 'Por Do Sol Language Server',
                code: 'unclosed-string'
            });
        }

        // Verificar palavras-chave em inglês (sugerir português)
        const englishKeywords = ['if', 'while', 'print', 'int', 'string', 'bool', 'then', 'else'];
        englishKeywords.forEach(keyword => {
            if (trimmed.includes(keyword)) {
                const suggestions: { [key: string]: string } = {
                    'if': 'se',
                    'while': 'enquanto',
                    'print': 'imprima',
                    'int': 'inteiro',
                    'string': 'texto',
                    'bool': 'booleano',
                    'then': 'então',
                    'else': 'senão'
                };
                
                if (settings.showWarnings) {
                    diagnostics.push({
                        severity: DiagnosticSeverity.Warning,
                        range: {
                            start: { line: index, character: trimmed.indexOf(keyword) },
                            end: { line: index, character: trimmed.indexOf(keyword) + keyword.length }
                        },
                        message: `Use '${suggestions[keyword]}' em vez de '${keyword}' na linguagem Por Do Sol`,
                        source: 'Por Do Sol Language Server',
                        code: 'use-portuguese'
                    });
                }
            }
        });
    });

    // Limitar número de problemas
    connection.sendDiagnostics({ 
        uri: textDocument.uri, 
        diagnostics: diagnostics.slice(0, settings.maxNumberOfProblems) 
    });
}

// HOVER PARA INFORMAÇÕES DETALHADAS - VERSÃO CORRIGIDA
connection.onHover((params: HoverParams): Hover | null => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return null;
    }

    const position = params.position;
    const line = document.getText({
        start: { line: position.line, character: 0 },
        end: { line: position.line + 1, character: 0 }
    });
    
    // Melhor detecção de palavra
    const wordMatch = getWordAtPosition(line, position.character);
    if (!wordMatch) {
        return null;
    }
    
    const word = wordMatch.word;
    
    // Informações de hover para palavras-chave
    const hoverInfo: { [key: string]: string } = {
        'se': '**Palavra-chave condicional** (Por Do Sol)\n\nExecuta código baseado em uma condição.\n\n**Sintaxe:**\n``````',
        'então': '**Palavra-chave condicional** (Por Do Sol)\n\nUsada após a condição no comando `se`.\n\n**Exemplo:**\n``````',
        'senão': '**Palavra-chave condicional** (Por Do Sol)\n\nBloco alternativo executado quando a condição é falsa.\n\n**Exemplo:**\n``````',
        'enquanto': '**Palavra-chave de loop** (Por Do Sol)\n\nRepete código enquanto condição for verdadeira.\n\n**Exemplo:**\n``````',
        'imprima': '**Função de saída** (Por Do Sol)\n\nImprime valores na tela.\n\n**Uso:**\n- `imprima("texto")` - Imprime string\n- `imprima(variavel)` - Imprime valor de variável\n\n**Exemplo:**\n``````',
        'inteiro': '**Tipo de dados** (Por Do Sol)\n\nNúmeros inteiros de 64 bits.\n\n**Intervalo:** -9.223.372.036.854.775.808 a 9.223.372.036.854.775.807\n\n**Exemplo:**\n``````',
        'texto': '**Tipo de dados** (Por Do Sol)\n\nStrings de texto Unicode.\n\n**Exemplo:**\n``````',
        'booleano': '**Tipo de dados** (Por Do Sol)\n\nValores lógicos: verdadeiro ou falso.\n\n**Exemplo:**\n``````',
        'verdadeiro': '**Valor booleano** (Por Do Sol)\n\nRepresenta o valor lógico verdadeiro.\n\n**Uso em condições:**\n``````',
        'falso': '**Valor booleano** (Por Do Sol)\n\nRepresenta o valor lógico falso.\n\n**Uso em condições:**\n``````'
    };

    if (hoverInfo[word]) {
        const range: Range = {
            start: { line: position.line, character: wordMatch.start },
            end: { line: position.line, character: wordMatch.end }
        };
        
        return {
            contents: {
                kind: MarkupKind.Markdown,
                value: hoverInfo[word]
            },
            range: range
        };
    }

    return null;
});

// Função para melhor detecção de palavra
function getWordAtPosition(line: string, character: number): { word: string; start: number; end: number } | null {
    // Regex para identificar palavras (incluindo acentos portugueses)
    const wordRegex = /[a-zA-ZÀ-ÿ_][a-zA-ZÀ-ÿ0-9_]*/g;
    let match;
    
    while ((match = wordRegex.exec(line)) !== null) {
        const start = match.index;
        const end = match.index + match[0].length;
        
        // Verificar se a posição do cursor está dentro desta palavra
        if (character >= start && character <= end) {
            return {
                word: match[0],
                start: start,
                end: end
            };
        }
    }
    
    return null;
}

// Escutar conexão
documents.listen(connection);
connection.listen();