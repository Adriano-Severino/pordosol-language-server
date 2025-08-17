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
    DocumentSymbol,
    DocumentSymbolParams,
    SymbolKind,
    SymbolInformation,
    WorkspaceSymbolParams,
    DefinitionParams,
    Location,
    TextDocumentChangeEvent,
    HoverParams,
    Hover,
    MarkupKind,
    Position,
    Range
} from 'vscode-languageserver/node';
import {
    SignatureHelpParams,
    SignatureHelp,
    SignatureInformation,
    ParameterInformation
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
            definitionProvider: true,
            documentSymbolProvider: true,
            workspaceSymbolProvider: true,
            diagnosticProvider: {
                interFileDependencies: false,
                workspaceDiagnostics: false
            },
            completionProvider: {
                resolveProvider: true,
                // adiciona ':' para sugerir após herança
                triggerCharacters: ['.', ' ', '(', '=', ':', 's', 'e', 'i', 't', 'b', 'c', 'f', 'n', '$', '{']
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
            },
            {
                label: 'usando',
                kind: CompletionItemKind.Keyword,
                insertText: 'usando ${1:Namespace};',
                documentation: 'Importa tipos de um namespace (similar a using em C#)',
                detail: 'Import - Por Do Sol',
                data: 41
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
            },
            {
                label: 'estática',
                kind: CompletionItemKind.Keyword,
                insertText: 'estática ',
                documentation: 'Modificador para membros estáticos da classe',
                detail: 'Modificador estático - Por Do Sol',
                data: 30
            },
            {
                label: 'sobrescreve',
                kind: CompletionItemKind.Keyword,
                insertText: 'sobrescreve ',
                documentation: 'Modificador para sobrescrever um membro redefinível (override)',
                detail: 'Modificador de Sobrescrita - Por Do Sol',
                data: 31
            },
            {
                label: 'redefinível',
                kind: CompletionItemKind.Keyword,
                insertText: 'redefinível ',
                documentation: 'Modificador para permitir que um membro seja sobrescrito em classes derivadas (virtual)',
                detail: 'Modificador Redefinível - Por Do Sol',
                data: 32
            },
            {
                label: 'abstrata',
                kind: CompletionItemKind.Keyword,
                insertText: 'abstrata ',
                documentation: 'Define classe ou método abstrato que deve ser implementado por classes derivadas',
                detail: 'Modificador Abstrato - Por Do Sol',
                data: 34
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
            },
            {
                label: 'decimal',
                kind: CompletionItemKind.TypeParameter,
                insertText: 'decimal ${1:nome} = ${2:0.0m};',
                documentation: 'Tipo de dados para números decimais de alta precisão, similar ao C#',
                detail: 'Tipo de dados decimal - Por Do Sol',
                data: 33
            },
            {
                label: 'duplo',
                kind: CompletionItemKind.TypeParameter,
                insertText: 'duplo ${1:nome} = ${2:0.0};',
                documentation: 'Tipo de ponto flutuante de dupla precisão (64 bits), equivalente a double',
                detail: 'Tipo de dados - Por Do Sol',
                data: 35
            },
            {
                label: 'flutuante',
                kind: CompletionItemKind.TypeParameter,
                insertText: 'flutuante ${1:nome} = ${2:0.0f};',
                documentation: 'Tipo de ponto flutuante de precisão simples (32 bits), equivalente a float',
                detail: 'Tipo de dados - Por Do Sol',
                data: 36
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
    const variableRegex = /(?:inteiro|texto|booleano|duplo|flutuante|decimal|var)\s+(\w+)/g;
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
    const completions: CompletionItem[] = [];
    const symbols = buildDocumentSymbols(text);

    // Encontra a classe que contém a posição
    const cls = findEnclosingClass(symbols, position);
    if (cls) {
        const children = cls.children || [];
        for (const c of children) {
            if (c.kind === SymbolKind.Method) {
                completions.push({
                    label: c.name,
                    kind: CompletionItemKind.Method,
                    insertText: `${c.name}($1)`
                });
            } else if (c.kind === SymbolKind.Property) {
                completions.push({
                    label: c.name,
                    kind: CompletionItemKind.Property,
                    insertText: c.name
                });
            }
        }
    }

    // Heurística: se linha contém VARIAVEL., tentar deduzir tipo básico e sugerir membros da classe correspondente
    const lineStart = { line: position.line, character: 0 };
    const lineEnd = { line: position.line + 1, character: 0 };
    const lineText = documents.get(Array.from(documents.keys())[0] || '') ? '' : '';
    // Como não temos acesso direto ao documento aqui, mantemos apenas membros de 'este.' via classe atual.
    // Futuro: ampliar para resolver tipos de variáveis (var x = novo Classe();) e sugerir membros de Classe.

    return completions;
}

// VALIDAÇÃO EXPANDIDA - Função para calcular diagnósticos (reutilizável)
async function computeDiagnostics(textDocument: TextDocument): Promise<Diagnostic[]> {
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
        const isClassDecl = /^(publico|privado|protegido)?\s*(abstrata\s+)?classe\b/.test(trimmed);
        const skipValidation = (
            isInsideMethodSignature(index) ||           // Dentro de assinatura de método
            isInsidePropertyBlock(index) ||             // Dentro de bloco de propriedades
            trimmed.endsWith('{') ||                    // Linha termina com abertura de chave
            trimmed.endsWith('}') ||                    // Linha termina com fechamento de chave
            trimmed.endsWith(',') ||                    // Linha termina com vírgula (parâmetro continua)
            trimmed.endsWith(')') ||                    // Linha termina com parênteses (fim de parâmetros)
            isClassDecl ||                               // Declaração de classe (inclui abstrata)
            trimmed.includes('espaco ') ||              // Declaração de namespace
            trimmed.match(/^(publico|privado|protegido)\s+(inteiro|texto|booleano|duplo|flutuante|decimal)\s+\w+\s*{/) // Propriedade com getter/setter
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

    return diagnostics.slice(0, settings.maxNumberOfProblems);
}

// Envio de diagnósticos por push (compatibilidade)
async function validateTextDocument(textDocument: TextDocument): Promise<void> {
    const diagnostics = await computeDiagnostics(textDocument);
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

// Suporte ao protocolo de diagnósticos por pull
connection.onRequest('textDocument/diagnostic', async (params: any) => {
    try {
        const uri: string | undefined = params?.textDocument?.uri;
        if (!uri) return { kind: 'full', items: [] };
        const doc = documents.get(uri);
        if (!doc) return { kind: 'full', items: [] };
        const items = await computeDiagnostics(doc);
        return { kind: 'full', items };
    } catch {
        return { kind: 'full', items: [] };
    }
});

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
    // Função auxiliar para buscar informações do símbolo
    function getSymbolInfo(text: string, word: string): any {
        // Exemplo simplificado: busca por variáveis, funções e classes
        const variableRegex = new RegExp(`(?:inteiro|texto|booleano|var)\\s+${word}\\b`);
        const functionRegex = new RegExp(`função\\s+${word}\\s*\\([^)]*\\)\\s*=>`);
        const classRegex = new RegExp(`classe\\s+${word}\\b`);
        if (variableRegex.test(text)) {
            return { type: 'variable', name: word, dataType: 'desconhecido', scope: 'local' };
        } else if (functionRegex.test(text)) {
            return { type: 'function', name: word, signature: `${word}()`, returnType: 'desconhecido' };
        } else if (classRegex.test(text)) {
            return { type: 'class', name: word, members: [] };
        }
        // Palavras-chave
        const keywords = ['se', 'classe', 'construtor', 'este', 'novo', 'espaco', 'usando', 'var', 'função', 'sobrescreve', 'redefinível', 'abstrata'];
        if (keywords.includes(word)) {
            return { type: 'keyword', name: word, documentation: staticHoverInfo[word] };
        }
        return null;
    }

    // Fallback para informações estáticas de palavras-chave
    const staticHoverInfo: { [key: string]: string } = {
        'se': '**Condicional** (Por Do Sol)\n\nEstrutura de controle para decisões lógicas.\n',
        'classe': '**Orientação a Objetos** (Por Do Sol)\n\nDefinição de classe com propriedades e métodos.\n',
        'construtor': '**Método Construtor** (Por Do Sol)\n\nUse apenas o nome da classe: NomeClasse() {...}\n',
        'este': '**Referência ao Objeto** (Por Do Sol)\n\nUsado para acessar membros da instância atual.\n',
        'novo': '**Instanciação** (Por Do Sol)\n\nCriação de nova instância de classe.\n',
        'espaco': '**Namespace** (Por Do Sol)\n\nOrganização modular do código.\n',
        'var': '**Inferência de Tipo** (Por Do Sol)\n\nDeclaração com tipo inferido automaticamente.\n',
        'função': '**Declaração de Função** (Por Do Sol)\n\nDefinição de função com tipo de retorno.\n',
        'sobrescreve': '**Modificador de Sobrescrita** (Por Do Sol)\n\nIndica que um método ou propriedade sobrescreve um membro da classe base.\n',
        'redefinível': '**Modificador Redefinível** (Por Do Sol)\n\nPermite que um método ou propriedade seja sobrescrito em classes derivadas.\n'
        ,
        'decimal': '**Tipo decimal** (Por Do Sol)\n\nTipo de dados para números decimais de alta precisão, similar ao C#.\nExemplo: `decimal meuDecimal = 10.5m;`',
        'duplo': '**Tipo duplo (double)** (Por Do Sol)\n\nPonto flutuante de 64 bits. Exemplo: `duplo x = 3.0;`',
        'flutuante': '**Tipo flutuante (float)** (Por Do Sol)\n\nPonto flutuante de 32 bits. Exemplo: `flutuante y = 2.5f;`',
        'abstrata': '**Modificador Abstrato** (Por Do Sol)\n\nDefine classes e métodos sem implementação, a serem implementados por derivados. ',
        'usando': '**Importação de Namespace** (Por Do Sol)\n\nEx.: `usando Testes;`'
    };

    if (staticHoverInfo[word]) {
        const range: Range = {
            start: { line: position.line, character: wordMatch.start },
            end: { line: position.line, character: wordMatch.end }
        };

        return {
            contents: {
                kind: MarkupKind.Markdown,
                value: staticHoverInfo[word]
            },
            range: range
        };
    }

    return null;
});

// SIGNATURE HELP (parâmetros enquanto digita)
connection.onSignatureHelp((params: SignatureHelpParams): SignatureHelp | null => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return null;
    const pos = params.position;
    const text = document.getText();
    const lines = text.split('\n');
    const line = lines[pos.line] || '';

    // Encontra o nome da função/método antes do '('
    const uptoChar = line.slice(0, pos.character);
    const callMatch = /(\w+)\s*\($/.exec(uptoChar) || /(\w+)\s*\([^(]*$/.exec(uptoChar);
    if (!callMatch) return null;
    const name = callMatch[1];

    // Conta vírgulas desde o '('
    const parenIdx = uptoChar.lastIndexOf('(');
    const activeParameter = parenIdx >= 0 ? (uptoChar.slice(parenIdx + 1).match(/,/g)?.length || 0) : 0;

    // Tenta localizar declaração: função nome( ... ) ou método [mods] tipo nome( ... )
    const funcDecl = new RegExp(`^\\s*função\\s+${escapeRegex(name)}\\s*\\(([^)]*)\\)`);
    const methodDecl = new RegExp(`^\\s*(?:publico|privado|protegido)?\\s*(?:estática\\s+)?(?:redefinível\\s+|sobrescreve\\s+|abstrata\\s+)?(?:inteiro|texto|booleano|duplo|flutuante|decimal|vazio)\\s+${escapeRegex(name)}\\s*\\(([^)]*)\\)`);

    let paramsList: string | null = null;
    for (const l of lines) {
        let m = funcDecl.exec(l);
        if (m) { paramsList = m[1]; break; }
        m = methodDecl.exec(l);
        if (m) { paramsList = m[1]; break; }
    }
    if (paramsList === null) return null;

    const paramsArr = paramsList.split(',').map(s => s.trim()).filter(Boolean);
    const parameters: ParameterInformation[] = paramsArr.map(p => ({ label: p }));
    const label = `${name}(${paramsArr.join(', ')})`;
    const signature: SignatureInformation = {
        label,
        parameters
    };
    return {
        signatures: [signature],
        activeSignature: 0,
        activeParameter: Math.min(activeParameter, Math.max(0, parameters.length - 1))
    };
});

function findEnclosingClass(symbols: DocumentSymbol[], position: Position): DocumentSymbol | null {
    for (const s of symbols) {
        if (s.kind === SymbolKind.Class && rangeContains(s.range, position)) {
            // procurar membro mais interno ou retornar a própria classe
            if (s.children) {
                const inner = findEnclosingClass(s.children as DocumentSymbol[], position);
                return inner || s;
            }
            return s;
        }
        if (s.children && s.children.length) {
            const child = findEnclosingClass(s.children as DocumentSymbol[], position);
            if (child) return child;
        }
    }
    return null;
}

function rangeContains(range: Range, pos: Position): boolean {
    if (pos.line < range.start.line || pos.line > range.end.line) return false;
    if (pos.line === range.start.line && pos.character < range.start.character) return false;
    if (pos.line === range.end.line && pos.character > range.end.character) return false;
    return true;
}

// GO TO DEFINITION (F12)
connection.onDefinition((params: DefinitionParams): Location | Location[] | null => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return null;

    const pos = params.position;
    const lineText = document.getText({ start: { line: pos.line, character: 0 }, end: { line: pos.line + 1, character: 0 } });
    const wordInfo = getWordAtPosition(lineText, pos.character);
    if (!wordInfo) return null;
    const word = wordInfo.word;

    const text = document.getText();
    const lines = text.split('\n');

    // Procurar definições em ordem de prioridade: função, método, classe, interface, enumeração, variável
    const patterns: { kind: string; regex: RegExp }[] = [
        // função nome(
        { kind: 'function', regex: new RegExp(`(^|\\s)função\\s+${escapeRegex(word)}\\s*\\(`) },
        // método: [mods] tipo nome(
        { kind: 'method', regex: new RegExp(`(^|\\s)(publico|privado|protegido)?\\s*(estática\\s+)?(redefinível\\s+|sobrescreve\\s+|abstrata\\s+)?(inteiro|texto|booleano|duplo|flutuante|decimal|vazio)\\s+${escapeRegex(word)}\\s*\\(`) },
        // classe Nome
        { kind: 'class', regex: new RegExp(`(^|\\s)classe\\s+${escapeRegex(word)}(\\b|\\s|{)`) },
        // interface Nome
        { kind: 'interface', regex: new RegExp(`(^|\\s)interface\\s+${escapeRegex(word)}(\\b|\\s|{)`) },
        // enumeração Nome
        { kind: 'enum', regex: new RegExp(`(^|\\s)enumeração\\s+${escapeRegex(word)}(\\b|\\s|{)`) },
        // variável: (tipo|var) nome (=|;|,)
        { kind: 'variable', regex: new RegExp(`(^|\\s)(inteiro|texto|booleano|duplo|flutuante|decimal|var)\\s+${escapeRegex(word)}(\\s*[=;,)])`) }
    ];

    for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        for (const p of patterns) {
            const m = p.regex.exec(l);
            if (m) {
                const col = l.indexOf(word);
                if (col >= 0) {
                    const location: Location = {
                        uri: document.uri,
                        range: {
                            start: { line: i, character: col },
                            end: { line: i, character: col + word.length }
                        }
                    };
                    return location;
                }
            }
        }
    }

    return null;
});

function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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

// ------------------------
// DOCUMENT SYMBOLS (Outline/Breadcrumbs)
// ------------------------
connection.onDocumentSymbol((params: DocumentSymbolParams): DocumentSymbol[] => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return [];
    const text = document.getText();
    return buildDocumentSymbols(text);
});

// ------------------------
// WORKSPACE SYMBOLS (Ir para símbolo)
// ------------------------
connection.onWorkspaceSymbol(async (params: WorkspaceSymbolParams): Promise<SymbolInformation[]> => {
    const query = (params.query || '').toLowerCase();
    const results: SymbolInformation[] = [];

    // 1) símbolos dos documentos abertos
    for (const doc of documents.all()) {
        const symbols = buildDocumentSymbols(doc.getText());
        results.push(...flattenToSymbolInformation(symbols, doc.uri));
    }

    // 2) varrer arquivos .pr do workspace (limitado)
    try {
        const folders = await connection.workspace.getWorkspaceFolders();
        if (folders && folders.length) {
            const uris = folders.map(f => f.uri);
            const paths = uris.filter(u => u.startsWith('file://')).map(u => uriToFsPath(u));
            const prFiles = collectPrFiles(paths, 200);
            for (const filePath of prFiles) {
                try {
                    const content = safeReadFile(filePath);
                    if (!content) continue;
                    const symbols = buildDocumentSymbols(content);
                    const fileUri = 'file://' + filePath.replace(/\\/g, '/');
                    results.push(...flattenToSymbolInformation(symbols, fileUri));
                } catch { /* ignore */ }
            }
        }
    } catch { /* ignore */ }

    if (!query) return results.slice(0, 500);
    return results.filter(s => s.name.toLowerCase().includes(query)).slice(0, 500);
});

function buildDocumentSymbols(text: string): DocumentSymbol[] {
    const lines = text.split('\n');
    const lineOffsets = computeLineOffsets(lines);
    const symbols: DocumentSymbol[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || !trimmed) continue;

        // espaco Nome { ... }
        let m = /^\s*espaco\s+([A-Z][\wÀ-ÿ_]*)\s*\{/.exec(line);
        if (m) {
            const name = m[1];
            const startChar = line.indexOf(m[0]);
            const startOffset = lineOffsets[i] + startChar;
            const endOffset = findMatchingBrace(text, startOffset + line.indexOf('{', startChar));
            const range = makeRangeFromOffsets(lineOffsets, startOffset, endOffset);
            const selRange = makeSelectionRange(line, i, name, line.indexOf(name));
            const children = parseClassLikeMembers(text, i, endOffset, lineOffsets);
            symbols.push({ name, kind: SymbolKind.Namespace, range, selectionRange: selRange, children });
            continue;
        }

        // classe Nome { ... }
        m = /^\s*(?:publico|privado|protegido)?\s*(?:abstrata\s+)?classe\s+([A-Z][\wÀ-ÿ_]*)[^\{]*\{/.exec(line);
        if (m) {
            const name = m[1];
            const startChar = line.indexOf(m[0]);
            const startOffset = lineOffsets[i] + startChar;
            const endOffset = findMatchingBrace(text, startOffset + line.indexOf('{', startChar));
            const range = makeRangeFromOffsets(lineOffsets, startOffset, endOffset);
            const selRange = makeSelectionRange(line, i, name, line.indexOf(name));
            const children = parseClassLikeMembers(text, i, endOffset, lineOffsets);
            symbols.push({ name, kind: SymbolKind.Class, range, selectionRange: selRange, children });
            continue;
        }

        // interface Nome { ... }
        m = /^\s*interface\s+([A-Z][\wÀ-ÿ_]*)[^\{]*\{/.exec(line);
        if (m) {
            const name = m[1];
            const startChar = line.indexOf(m[0]);
            const startOffset = lineOffsets[i] + startChar;
            const endOffset = findMatchingBrace(text, startOffset + line.indexOf('{', startChar));
            const range = makeRangeFromOffsets(lineOffsets, startOffset, endOffset);
            const selRange = makeSelectionRange(line, i, name, line.indexOf(name));
            const children = parseClassLikeMembers(text, i, endOffset, lineOffsets);
            symbols.push({ name, kind: SymbolKind.Interface, range, selectionRange: selRange, children });
            continue;
        }

        // enumeração Nome { ... }
        m = /^\s*enumeração\s+([A-Z][\wÀ-ÿ_]*)[^\{]*\{/.exec(line);
        if (m) {
            const name = m[1];
            const startChar = line.indexOf(m[0]);
            const startOffset = lineOffsets[i] + startChar;
            const endOffset = findMatchingBrace(text, startOffset + line.indexOf('{', startChar));
            const range = makeRangeFromOffsets(lineOffsets, startOffset, endOffset);
            const selRange = makeSelectionRange(line, i, name, line.indexOf(name));
            symbols.push({ name, kind: SymbolKind.Enum, range, selectionRange: selRange, children: [] });
            continue;
        }

        // função nome(...)
        m = /^\s*função\s+([A-Za-zÀ-ÿ_][\wÀ-ÿ_]*)\s*\(/.exec(line);
        if (m) {
            const name = m[1];
            const nameIdx = line.indexOf(name);
            const startOffset = lineOffsets[i] + (nameIdx >= 0 ? nameIdx : 0);
            // tentar achar corpo { ... }
            const braceIdx = line.indexOf('{');
            let range;
            if (braceIdx >= 0) {
                const endOffset = findMatchingBrace(text, lineOffsets[i] + braceIdx);
                range = makeRangeFromOffsets(lineOffsets, lineOffsets[i] + braceIdx, endOffset);
            } else {
                // sem corpo (talvez assinatura) -> linha inteira
                range = {
                    start: { line: i, character: 0 },
                    end: { line: i, character: line.length }
                };
            }
            const selRange = makeSelectionRange(line, i, name, nameIdx);
            symbols.push({ name, kind: SymbolKind.Function, range, selectionRange: selRange });
            continue;
        }

        // variável top-level: (tipo|var) nome = ... ;
        m = /^\s*(inteiro|texto|booleano|duplo|flutuante|decimal|var)\s+([A-Za-zÀ-ÿ_][\wÀ-ÿ_]*)\b/.exec(line);
        if (m) {
            const name = m[2];
            const idx = line.indexOf(name);
            const selRange = makeSelectionRange(line, i, name, idx);
            const range = { start: { line: i, character: 0 }, end: { line: i, character: line.length } };
            symbols.push({ name, kind: SymbolKind.Variable, range, selectionRange: selRange });
            continue;
        }
    }

    return symbols;
}

function parseClassLikeMembers(text: string, startLine: number, blockEndOffset: number, lineOffsets: number[]): DocumentSymbol[] {
    const symbols: DocumentSymbol[] = [];
    const startOffset = lineOffsets[startLine];
    const segment = text.slice(startOffset, blockEndOffset);
    const segLines = segment.split('\n');

    for (let j = 0; j < segLines.length; j++) {
        const line = segLines[j];
        const absLine = startLine + j;
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('//')) continue;

        // método: [mods] tipo nome(
        let m = /^\s*(?:publico|privado|protegido)?\s*(?:estática\s+)?(?:redefinível\s+|sobrescreve\s+|abstrata\s+)?(inteiro|texto|booleano|duplo|flutuante|decimal|vazio)\s+([A-Za-zÀ-ÿ_][\wÀ-ÿ_]*)\s*\(/.exec(line);
        if (m) {
            const name = m[2];
            const nameIdx = line.indexOf(name);
            const braceIdx = line.indexOf('{');
            let range;
            if (braceIdx >= 0) {
                const endOffset = findMatchingBrace(text, lineOffsets[absLine] + braceIdx);
                range = makeRangeFromOffsets(lineOffsets, lineOffsets[absLine] + braceIdx, endOffset);
            } else {
                range = { start: { line: absLine, character: 0 }, end: { line: absLine, character: line.length } };
            }
            const selRange = makeSelectionRange(line, absLine, name, nameIdx);
            symbols.push({ name, kind: SymbolKind.Method, range, selectionRange: selRange });
            continue;
        }

        // propriedade: [mods] tipo Nome { obter; definir; }
        m = /^\s*(?:publico|privado|protegido)?\s*(?:estática\s+)?(inteiro|texto|booleano|duplo|flutuante|decimal)\s+([A-Za-zÀ-ÿ_][\wÀ-ÿ_]*)\s*\{\s*(?:obter;)?\s*(?:definir;)?\s*\}/.exec(line);
        if (m) {
            const name = m[2];
            const nameIdx = line.indexOf(name);
            const selRange = makeSelectionRange(line, absLine, name, nameIdx);
            const range = { start: { line: absLine, character: 0 }, end: { line: absLine, character: line.length } };
            symbols.push({ name, kind: SymbolKind.Property, range, selectionRange: selRange });
            continue;
        }
    }
    return symbols;
}

function computeLineOffsets(lines: string[]): number[] {
    const offsets: number[] = [];
    let acc = 0;
    for (const l of lines) {
        offsets.push(acc);
        acc += l.length + 1; // assume \n
    }
    return offsets;
}

function makeRangeFromOffsets(lineOffsets: number[], startOffset: number, endOffset: number) {
    const start = offsetToPos(lineOffsets, startOffset);
    const end = offsetToPos(lineOffsets, Math.max(endOffset, startOffset));
    return { start, end };
}

function offsetToPos(lineOffsets: number[], offset: number): Position {
    // encontrar maior linha com offset <= dado
    let line = 0;
    for (let i = 0; i < lineOffsets.length; i++) {
        if (lineOffsets[i] <= offset) line = i; else break;
    }
    const char = offset - lineOffsets[line];
    return { line, character: char };
}

function makeSelectionRange(line: string, lineNum: number, name: string, nameIdx: number) {
    const startChar = Math.max(0, nameIdx);
    const endChar = startChar + name.length;
    return { start: { line: lineNum, character: startChar }, end: { line: lineNum, character: endChar } };
}

function findMatchingBrace(text: string, openBraceOffset: number): number {
    let depth = 0;
    for (let i = openBraceOffset; i < text.length; i++) {
        const ch = text[i];
        if (ch === '{') depth++;
        else if (ch === '}') {
            depth--;
            if (depth === 0) return i + 1; // posição após '}'
        }
    }
    return openBraceOffset + 1;
}

function flattenToSymbolInformation(docSymbols: DocumentSymbol[], uri: string, containerName?: string): SymbolInformation[] {
    const out: SymbolInformation[] = [];
    for (const s of docSymbols) {
        out.push({ name: s.name, kind: s.kind as unknown as SymbolKind, location: { uri, range: s.selectionRange }, containerName });
        if (s.children && s.children.length) {
            out.push(...flattenToSymbolInformation(s.children, uri, s.name));
        }
    }
    return out;
}

// Utilitários de workspace
import * as fs from 'fs';
import * as path from 'path';

function uriToFsPath(uri: string): string {
    // file:///C:/x/y -> C:\x\y
    const without = uri.replace('file:///', '');
    return without.replace(/\//g, path.sep);
}

function collectPrFiles(roots: string[], maxFiles: number): string[] {
    const out: string[] = [];
    for (const root of roots) {
        walk(root);
        if (out.length >= maxFiles) break;
    }
    return out.slice(0, maxFiles);

    function walk(dir: string) {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch { return; }
        for (const e of entries) {
            if (out.length >= maxFiles) return;
            const p = path.join(dir, e.name);
            if (e.isDirectory()) {
                if (e.name === 'node_modules' || e.name.startsWith('.git')) continue;
                walk(p);
            } else if (e.isFile() && (p.endsWith('.pr') || p.endsWith('.pds'))) {
                out.push(p);
            }
        }
    }
}

function safeReadFile(p: string): string | null {
    try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

documents.onDidChangeContent((change: TextDocumentChangeEvent<TextDocument>) => {
    validateTextDocument(change.document);
});

documents.listen(connection);
connection.listen();