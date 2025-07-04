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

const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

connection.onInitialize((params: InitializeParams) => {
    const capabilities = params.capabilities;

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
            completionProvider: {
                resolveProvider: true,
                triggerCharacters: ['.', ' ', '(', '=', 's', 'e', 'i', 't', 'b', 'c', 'f', 'n', '$', '{']
            },
            hoverProvider: true,
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

interface PorDoSolSettings {
    maxNumberOfProblems: number;
    enableStrictMode: boolean;
    showWarnings: boolean;
    enableOwnershipAnalysis: boolean;
}

const defaultSettings: PorDoSolSettings = {
    maxNumberOfProblems: 1000,
    enableStrictMode: true,
    showWarnings: true,
    enableOwnershipAnalysis: true
};
let globalSettings: PorDoSolSettings = defaultSettings;

const documentSettings: Map<string, Promise<PorDoSolSettings>> = new Map();

connection.onDidChangeConfiguration(change => {
    if (hasConfigurationCapability) {
        documentSettings.clear();
    } else {
        globalSettings = <PorDoSolSettings>(
            (change.settings.pordosolLanguageServer || defaultSettings)
        );
    }
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

documents.onDidClose(e => {
    documentSettings.delete(e.document.uri);
});

// AUTOCOMPLETAR AVANÇADO COM ORIENTAÇÃO A OBJETOS
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

        // Palavras-chave principais expandidas
        const keywords = [
            {
                label: 'se',
                kind: CompletionItemKind.Keyword,
                insertText: 'se (${1:condicao}) {\n\t$2\n}',
                documentation: 'Estrutura condicional se-então-senão da linguagem Por Do Sol',
                detail: 'Condicional - Por Do Sol',
                data: 1
            },
            {
                label: 'senão',
                kind: CompletionItemKind.Keyword,
                insertText: 'senão {\n\t$1\n}',
                documentation: 'Bloco alternativo da estrutura se (linguagem Por Do Sol)',
                detail: 'Condicional alternativa',
                data: 11
            },
            {
                label: 'enquanto',
                kind: CompletionItemKind.Keyword,
                insertText: 'enquanto (${1:condicao}) {\n\t$2\n}',
                documentation: 'Loop enquanto condição for verdadeira na linguagem Por Do Sol',
                detail: 'Loop - Por Do Sol',
                data: 12
            },
            {
                label: 'para',
                kind: CompletionItemKind.Keyword,
                insertText: 'para (${1:inteiro i = 0}; ${2:i < 10}; ${3:i = i + 1}) {\n\t$4\n}',
                documentation: 'Loop for com inicialização, condição e incremento',
                detail: 'Loop For - Por Do Sol',
                data: 13
            },
            {
                label: 'imprima',
                kind: CompletionItemKind.Function,
                insertText: 'imprima(${1:valor});',
                documentation: 'função para imprimir valores na tela (linguagem Por Do Sol)',
                detail: 'função de saída - Por Do Sol',
                data: 14
            },
            {
                label: 'função',
                kind: CompletionItemKind.Keyword,
                insertText: 'função ${1:nome}(${2:parametros}) => ${3:tipo} {\n\t${4:// código}\n\tretorne ${5:valor};\n}',
                documentation: 'Declaração de função com tipo de retorno',
                detail: 'função - Por Do Sol',
                data: 3
            },
            {
                label: 'retorne',
                kind: CompletionItemKind.Keyword,
                insertText: 'retorne ${1:valor};',
                documentation: 'Retorna valor de uma função',
                detail: 'Return - Por Do Sol',
                data: 15
            },
            {
                label: 'var',
                kind: CompletionItemKind.Keyword,
                insertText: 'var ${1:nome} = ${2:valor};',
                documentation: 'Declaração com inferência de tipo',
                detail: 'Inferência de tipo - Por Do Sol',
                data: 16
            }
        ];

        // Palavras-chave OOP CORRIGIDAS SEM PALAVRA CONSTRUTOR
        const oopKeywords = [
            {
                label: 'classe',
                kind: CompletionItemKind.Class,
                insertText: 'classe ${1:Nome} {\n\t${2:publico} ${3:inteiro} ${4:propriedade};\n\n\t${1:Nome}(${5:parametros}) {\n\t\t${6:// inicialização}\n\t}\n\n\t${2:publico} ${7:vazio} ${8:metodo}() {\n\t\t${9:// código}\n\t}\n}',
                documentation: 'Declaração de classe com propriedades e métodos (sem palavra construtor)',
                detail: 'Classe - Por Do Sol',
                data: 2
            },
            {
                label: 'construtor',
                kind: CompletionItemKind.Constructor,
                insertText: '${1:NomeClasse}(${2:parametros}) {\n\t${3:// inicialização}\n}',
                documentation: 'Método construtor da classe (apenas nome da classe)',
                detail: 'Construtor - Por Do Sol',
                data: 17
            },
            {
                label: 'este',
                kind: CompletionItemKind.Keyword,
                insertText: 'este.',
                documentation: 'Referência à instância atual do objeto (this)',
                detail: 'Referência - Por Do Sol',
                data: 18
            },
            {
                label: 'novo',
                kind: CompletionItemKind.Keyword,
                insertText: 'novo ${1:Classe}(${2:argumentos})',
                documentation: 'Criação de nova instância de classe',
                detail: 'Instanciação - Por Do Sol',
                data: 19
            },
            {
                label: 'espaco',
                kind: CompletionItemKind.Module,
                insertText: 'espaco ${1:Nome} {\n\t${2:// conteúdo}\n}',
                documentation: 'Declaração de namespace/módulo',
                detail: 'Namespace - Por Do Sol',
                data: 20
            }
        ];

        // Modificadores de acesso
        const accessModifiers = [
            {
                label: 'publico',
                kind: CompletionItemKind.Keyword,
                insertText: 'publico ',
                documentation: 'Modificador de acesso público',
                detail: 'Acesso - Por Do Sol',
                data: 21
            },
            {
                label: 'privado',
                kind: CompletionItemKind.Keyword,
                insertText: 'privado ',
                documentation: 'Modificador de acesso privado',
                detail: 'Acesso - Por Do Sol',
                data: 22
            },
            {
                label: 'protegido',
                kind: CompletionItemKind.Keyword,
                insertText: 'protegido ',
                documentation: 'Modificador de acesso protegido',
                detail: 'Acesso - Por Do Sol',
                data: 23
            }
        ];

        // Tipos de dados expandidos
        const types = [
            {
                label: 'inteiro',
                kind: CompletionItemKind.TypeParameter,
                insertText: 'inteiro ${1:nome} = ${2:0};',
                documentation: 'Tipo de dados para números inteiros de 64 bits',
                detail: 'Tipo de dados - Por Do Sol',
                data: 24
            },
            {
                label: 'texto',
                kind: CompletionItemKind.TypeParameter,
                insertText: 'texto ${1:nome} = "${2:valor}";',
                documentation: 'Tipo de dados para strings de texto',
                detail: 'Tipo de dados - Por Do Sol',
                data: 25
            },
            {
                label: 'booleano',
                kind: CompletionItemKind.TypeParameter,
                insertText: 'booleano ${1:nome} = ${2|verdadeiro,falso|};',
                documentation: 'Tipo de dados lógico verdadeiro/falso',
                detail: 'Tipo de dados - Por Do Sol',
                data: 26
            },
            {
                label: 'vazio',
                kind: CompletionItemKind.TypeParameter,
                insertText: 'vazio',
                documentation: 'Tipo void para funções que não retornam valor',
                detail: 'Tipo de dados - Por Do Sol',
                data: 27
            }
        ];

        // Valores e literais
        const values = [
            {
                label: 'verdadeiro',
                kind: CompletionItemKind.Value,
                insertText: 'verdadeiro',
                documentation: 'Valor booleano verdadeiro',
                detail: 'Valor booleano',
                data: 28
            },
            {
                label: 'falso',
                kind: CompletionItemKind.Value,
                insertText: 'falso',
                documentation: 'Valor booleano falso',
                detail: 'Valor booleano',
                data: 29
            }
        ];

        // Interpolação de strings
        if (lineText.includes('$"') || lineText.includes('${')) {
            completions.push(...getVariableNames(text));
            return completions;
        }

        // Contexto de classe
        if (isInsideClass(text, position)) {
            completions.push(...accessModifiers, ...types, ...oopKeywords.slice(1)); // Excluir 'classe'
        }

        // Contexto após 'novo'
        if (lineText.includes('novo ')) {
            completions.push(...getClassNames(text));
        }

        // Contexto após 'este.'
        if (lineText.includes('este.')) {
            completions.push(...getClassMembers(text, position));
        }

        // Contexto geral
        if (lineText.trim().length === 0) {
            completions.push(...keywords, ...oopKeywords, ...types);
        } else if (lineText.includes('=') && !lineText.includes('==')) {
            completions.push(...values, ...getVariableNames(text));
        } else {
            completions.push(...keywords, ...oopKeywords, ...types);
        }

        return completions;
    }
);

// HANDLER PARA RESOLUÇÃO DE COMPLETION ITEMS - CORRIGIDO
connection.onCompletionResolve(
    (item: CompletionItem): CompletionItem => {
        // Verificar se o item tem dados para resolver
        if (item.data === 1) {
            item.detail = 'Condicional Por Do Sol';
            item.documentation = {
                kind: MarkupKind.Markdown,
                value: `**Estrutura condicional**

\`\`\`
se (condicao) 
{
    // código
}
\`\`\`

Executa código baseado em uma condição lógica.`
            };
        } else if (item.data === 2) {
            item.detail = 'Classe Por Do Sol';
            item.documentation = {
                kind: MarkupKind.Markdown,
                value: `**Orientação a Objetos**

\`\`\`
classe MinhaClasse 
{
    publico inteiro propriedade;
    
    MinhaClasse(parametros) 
    {
        // inicialização sem palavra construtor
    }
    
    publico vazio metodo() 
    {
        // código do método
    }
}
\`\`\``
            };
        } else if (item.data === 3) {
            item.detail = 'função Por Do Sol';
            item.documentation = {
                kind: MarkupKind.Markdown,
                value: `**Declaração de função**

\`\`\`
função minhaFunção() => inteiro 
{
    retorne 42;
}
\`\`\``
            };
        } else if (item.data === 11) {
            item.detail = 'Senão - Por Do Sol';
            item.documentation = {
                kind: MarkupKind.Markdown,
                value: `**Bloco alternativo**

\`\`\`
se (condicao) 
{
    // código verdadeiro
} 
senão 
{
    // código falso
}
\`\`\``
            };
        } else if (item.data === 12) {
            item.detail = 'Loop Enquanto - Por Do Sol';
            item.documentation = {
                kind: MarkupKind.Markdown,
                value: `**Loop enquanto**

\`\`\`
enquanto (condicao) 
{
    // código repetitivo
}
\`\`\``
            };
        } else if (item.data === 13) {
            item.detail = 'Loop Para - Por Do Sol';
            item.documentation = {
                kind: MarkupKind.Markdown,
                value: `**Loop for**

\`\`\`
para (inteiro i = 0; i < 10; i = i + 1) 
{
    // código repetitivo
}
\`\`\``
            };
        } else if (item.data === 17) {
            item.detail = 'Construtor - Por Do Sol';
            item.documentation = {
                kind: MarkupKind.Markdown,
                value: `**Método Construtor**

\`\`\`
NomeClasse(parametros) 
{
    // inicialização
    // Sem palavra-chave 'construtor'
}
\`\`\`

O construtor é declarado apenas com o nome da classe.`
            };
        } else if (item.data === 18) {
            item.detail = 'Referência Este - Por Do Sol';
            item.documentation = {
                kind: MarkupKind.Markdown,
                value: `**Referência ao objeto atual**

Usado para acessar propriedades e métodos da instância atual.

\`\`\`
este.propriedade = valor;
este.metodo();
\`\`\``
            };
        } else if (item.data === 19) {
            item.detail = 'Instanciação - Por Do Sol';
            item.documentation = {
                kind: MarkupKind.Markdown,
                value: `**Criação de objeto**

\`\`\`
var objeto = novo MinhaClasse(argumentos);
\`\`\``
            };
        } else if (item.data === 20) {
            item.detail = 'Namespace - Por Do Sol';
            item.documentation = {
                kind: MarkupKind.Markdown,
                value: `**Organização modular**

\`\`\`
espaco MeuNamespace 
{
    classe MinhaClasse { }
}
\`\`\``
            };
        }

        return item;
    }
);

// Funções auxiliares expandidas
function getVariableNames(text: string): CompletionItem[] {
    const variableRegex = /(?:inteiro|texto|booleano|var)\s+(\w+)/g;
    const variables: CompletionItem[] = [];
    let match;

    while ((match = variableRegex.exec(text)) !== null) {
        variables.push({
            label: match[1],
            kind: CompletionItemKind.Variable,
            insertText: match[1],
            documentation: `Variável declarada: ${match[1]}`,
            detail: 'Variável - Por Do Sol',
            data: 100 + variables.length
        });
    }

    return variables;
}

function getClassNames(text: string): CompletionItem[] {
    const classRegex = /classe\s+(\w+)/g;
    const classes: CompletionItem[] = [];
    let match;

    while ((match = classRegex.exec(text)) !== null) {
        classes.push({
            label: match[1],
            kind: CompletionItemKind.Class,
            insertText: match[1],
            documentation: `Classe: ${match[1]}`,
            detail: 'Classe - Por Do Sol',
            data: 200 + classes.length
        });
    }

    return classes;
}

function isInsideClass(text: string, position: Position): boolean {
    const lines = text.split('\n');
    let insideClass = false;
    let braceCount = 0;

    for (let i = 0; i <= position.line; i++) {
        const line = lines[i];
        if (line.includes('classe ')) {
            insideClass = true;
            braceCount = 0;
        }

        for (const char of line) {
            if (char === '{') braceCount++;
            if (char === '}') braceCount--;
        }

        if (insideClass && braceCount === 0 && i > 0) {
            insideClass = false;
        }
    }

    return insideClass && braceCount > 0;
}

function getClassMembers(text: string, position: Position): CompletionItem[] {
    // Implementar análise de membros da classe
    return [];
}

// VALIDAÇÃO EXPANDIDA// VALIDAÇÃO EXPANDIDA E CORRIGIDA
async function validateTextDocument(textDocument: TextDocument): Promise<void> {
    const settings = await getDocumentSettings(textDocument.uri);
    const text = textDocument.getText();
    const diagnostics: Diagnostic[] = [];
    const lines = text.split('\n');

    lines.forEach((line: string, index: number) => {
        const trimmed = line.trim();

        // Pular linhas vazias e comentários
        if (!trimmed || trimmed.startsWith('//')) {
            return;
        }

        // CONTEXTO: Verificar se estamos dentro de uma assinatura de método/construtor
        const isInsideMethodSignature = (lineIndex: number): boolean => {
            // Procurar para trás por uma linha que indica início de método/construtor
            for (let i = lineIndex; i >= 0; i--) {
                const prevLine = lines[i].trim();

                // Se encontrou uma abertura de chaves, não estamos em assinatura
                if (prevLine.endsWith('{')) {
                    return false;
                }

                // Se encontrou início de construtor ou função
                if (prevLine.match(/^(publico|privado|protegido)?\s*(função\s+\w+|[A-Z]\w*)\s*\(/)) {
                    return true;
                }

                // Se a linha atual ou anterior tem parênteses abertos sem fechar
                if (prevLine.includes('(') && !prevLine.includes(')')) {
                    return true;
                }
            }
            return false;
        };

        // CONTEXTO: Verificar se estamos dentro de propriedades { obter; definir; }
        const isInsidePropertyBlock = (lineIndex: number): boolean => {
            const currentLine = lines[lineIndex].trim();
            return currentLine.includes('{ obter; definir; }') ||
                currentLine.includes('{') && currentLine.includes('obter') ||
                currentLine.includes('{') && currentLine.includes('definir');
        };

        // Verificar se é uma linha que claramente deve terminar com ;
        const shouldEndWithSemicolon = (
            // Comando imprima completo em uma linha
            (trimmed.includes('imprima(') && trimmed.includes(')') && !trimmed.endsWith(';')) ||

            // Declaração de variável simples (uma linha só) - MAS NÃO dentro de assinatura
            (trimmed.match(/^(inteiro|texto|booleano|var)\s+\w+\s*=\s*[^,\n(]+$/) &&
                !trimmed.endsWith(';') &&
                !isInsideMethodSignature(index)) ||

            // Atribuição simples (uma linha só) - MAS NÃO dentro de assinatura
            (trimmed.match(/^\w+\s*=\s*[^,\n(]+$/) &&
                !trimmed.endsWith(';') &&
                !isInsideMethodSignature(index)) ||

            // Chamada de função simples (uma linha só)
            (trimmed.match(/^\w+\.\w+\([^)]*\)$/) && !trimmed.endsWith(';'))
        );

        // NÃO VALIDAR se:
        const skipValidation = (
            isInsideMethodSignature(index) ||           // Dentro de assinatura de método
            isInsidePropertyBlock(index) ||             // Dentro de bloco de propriedades
            trimmed.endsWith('{') ||                    // Linha termina com abertura de chave
            trimmed.endsWith('}') ||                    // Linha termina com fechamento de chave
            trimmed.endsWith(',') ||                    // Linha termina com vírgula (parâmetro continua)
            trimmed.endsWith(')') ||                    // Linha termina com parênteses (fim de parâmetros)
            trimmed.includes('publico classe') ||       // Declaração de classe
            trimmed.includes('espaco ') ||              // Declaração de namespace
            trimmed.match(/^(publico|privado|protegido)\s+(inteiro|texto|booleano)\s+\w+\s*{/) // Propriedade com getter/setter
        );

        if (shouldEndWithSemicolon && !skipValidation) {
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: {
                    start: { line: index, character: 0 },
                    end: { line: index, character: line.length }
                },
                message: 'Comando deve terminar com ponto e vírgula (;)',
                source: 'Por Do Sol Language Server',
                code: 'missing-semicolon'
            });
        }

        // Validação de interpolação de strings
        if (trimmed.includes('$"')) {
            const interpolationRegex = /\$"[^"]*\{[^}]*\}[^"]*"/g;
            if (!interpolationRegex.test(trimmed) && trimmed.includes('{')) {
                diagnostics.push({
                    severity: DiagnosticSeverity.Error,
                    range: {
                        start: { line: index, character: trimmed.indexOf('$"') },
                        end: { line: index, character: line.length }
                    },
                    message: 'Interpolação de string mal formada - use $"texto {variavel}"',
                    source: 'Por Do Sol Language Server',
                    code: 'malformed-interpolation'
                });
            }
        }

        // Validação de classes
        if (trimmed.includes('classe ') && !trimmed.match(/classe\s+[A-Z]\w*\s*{?/)) {
            diagnostics.push({
                severity: DiagnosticSeverity.Warning,
                range: {
                    start: { line: index, character: 0 },
                    end: { line: index, character: line.length }
                },
                message: 'Nome de classe deve começar com letra maiúscula',
                source: 'Por Do Sol Language Server',
                code: 'class-naming'
            });
        }

        // Validação para detectar uso incorreto da palavra 'construtor'
        if (trimmed.includes('construtor ') && !trimmed.startsWith('//')) {
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: {
                    start: { line: index, character: trimmed.indexOf('construtor') },
                    end: { line: index, character: trimmed.indexOf('construtor') + 10 }
                },
                message: 'Use apenas o nome da classe para o construtor. Ex: MinhaClasse() em vez de construtor MinhaClasse()',
                source: 'Por Do Sol Language Server',
                code: 'invalid-constructor-keyword'
            });
        }
    });

    connection.sendDiagnostics({
        uri: textDocument.uri,
        diagnostics: diagnostics.slice(0, settings.maxNumberOfProblems)
    });
}

// HOVER EXPANDIDO
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

    const wordMatch = getWordAtPosition(line, position.character);
    if (!wordMatch) {
        return null;
    }

    const word = wordMatch.word;

    const hoverInfo: { [key: string]: string } = {
        'se': '**Condicional** (Por Do Sol)\n\nEstrutura de controle para decisões lógicas.\n\n``````',
        'classe': '**Orientação a Objetos** (Por Do Sol)\n\nDefinição de classe com propriedades e métodos.\n\n``````',
        'construtor': '**Método Construtor** (Por Do Sol)\n\nUse apenas o nome da classe: NomeClasse() {...}\n\n``````',
        'este': '**Referência ao Objeto** (Por Do Sol)\n\nUsado para acessar membros da instância atual.\n\n``````',
        'novo': '**Instanciação** (Por Do Sol)\n\nCriação de nova instância de classe.\n\n``````',
        'espaco': '**Namespace** (Por Do Sol)\n\nOrganização modular do código.\n\n``````',
        'var': '**Inferência de Tipo** (Por Do Sol)\n\nDeclaração com tipo inferido automaticamente.\n\n``````',
        'Função': '**Declaração de Função** (Por Do Sol)\n\nDefinição de função com tipo de retorno.\n\n``````'
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

function getWordAtPosition(line: string, character: number): { word: string; start: number; end: number } | null {
    const wordRegex = /[a-zA-ZÀ-ÿ_][a-zA-ZÀ-ÿ0-9_]*/g;
    let match;

    while ((match = wordRegex.exec(line)) !== null) {
        const start = match.index;
        const end = match.index + match[0].length;

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

documents.onDidChangeContent((change: TextDocumentChangeEvent<TextDocument>) => {
    validateTextDocument(change.document);
});

documents.listen(connection);
connection.listen();