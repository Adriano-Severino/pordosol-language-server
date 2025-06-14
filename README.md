# Por Do Sol Language Server

Servidor de Linguagem (LSP) inteligente para a linguagem Por Do Sol.

## Funcionalidades
- Autocompletar inteligente
- Hover com informações detalhadas
- Validação de sintaxe em tempo real
- Suporte a arquivos `.pr`

## Instalação

1. **Clone o repositório:**
   ```sh
   git clone https://github.com/seu-usuario/pordosol-language-server.git
   cd pordosol-language-server
   ```

2. **Instale as dependências:**
   ```sh
   npm install
   ```
   Isso instalará as dependências do projeto principal, do cliente e do servidor.

3. **Compile o projeto:**
   ```sh
   npm run compile
   ```

## Como usar no VS Code

1. **Abra a pasta do projeto no VS Code.**
2. **Inicie a extensão em modo de desenvolvimento:**
   - Pressione `F5` para abrir uma nova janela do VS Code com a extensão carregada.
3. **Abra um arquivo `.pr`** para começar a usar os recursos da linguagem Por Do Sol.

## Scripts úteis
- `npm run compile` — Limpa e compila todo o projeto
- `npm run watch` — Compila em modo watch
- `npm run clean` — Remove arquivos de build

## Estrutura do Projeto
- `client/` — Cliente VS Code (extensão)
- `server/` — Servidor LSP
- `language-configuration.json` — Configuração de sintaxe

## Licença
Este projeto está licenciado sob a Licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## Exemplo de código Por Do Sol

```pordosol
// Exemplo simples de código Por Do Sol
inicio
    inteiro idade = 25
    texto nome = "joana"
    se (idade >= 18) 
    {
        escreva("Maior de idade: " + nome)
    } 
    senao 
    {
        escreva("Menor de idade: " + nome)
    }


espaco Meu_Programa.Domain
{
    publico classe Pessoa2
    {
        publico texto Nome { buscar; definir; }
        publico inteiro Idade { buscar; definir; }
        publico texto Sobrenome { buscar; definir; }
        publico texto Endereco { buscar; definir; }
        publico texto Telefone { buscar; definir; }

        // ✅ Construtor com parâmetros padrão (como C#)
        publico Pessoa2(texto nome, texto endereco, texto telefone, inteiro idade = 24, texto sobrenome = "Silva") {
            Nome = nome;
            Endereco = endereco;
            Telefone = telefone;
            Idade = idade;
            Sobrenome = sobrenome;
        }

        publico vazio apresentar() {
            imprima($"Nome: {Nome}, Endereço: {Endereco}, Telefone: {Telefone}, Idade: {Idade}, Sobrenome: {Sobrenome}");
        }
    }

    publico funcao teste_pessoa() 
    {
        // ✅ Passa apenas 3 parâmetros, usa padrões para idade (24) e sobrenome ("Silva")
        Pessoa2 p1 = novo Pessoa2("Joana", "Rua de exemplo", "123456789");
        
        // ✅ Passa 4 parâmetros, usa padrão apenas para sobrenome ("Silva")
        Pessoa2 p2 = novo Pessoa2("Maria", "Rua B", "987654321", 30);
        
        // ✅ Passa todos os 5 parâmetros
        Pessoa2 p3 = novo Pessoa2("Mariano", "Rua C", "123456789", 35, "Silva");
        
        p1.apresentar();
        p2.apresentar();
        p3.apresentar();
    }
}

inteiro a = 10;
inteiro b = 5;

imprima("=== Teste Aritmética ===");
imprima(a);
imprima(b);
imprima(a + b);
imprima(a - b);
imprima(a * b);

se (a > b) {
    imprima("a é maior que b");
} senão {
    imprima("a não é maior que b");
}
fim
```
