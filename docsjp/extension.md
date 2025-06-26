# Gemini CLI 拡張機能

Gemini CLI は、その機能を設定および拡張するために使用できる拡張機能をサポートしています。

## 仕組み

起動時に、Gemini CLI は次の2つの場所で拡張機能を検索します。

1.  `<workspace>/.gemini/extensions`
2.  `<home>/.gemini/extensions`

Gemini CLI は両方の場所からすべての拡張機能をロードします。同じ名前の拡張機能が両方の場所に存在する場合、ワークスペースディレクトリの拡張機能が優先されます。

各場所内では、個々の拡張機能は `gemini-extension.json` ファイルを含むディレクトリとして存在します。例:

`<workspace>/.gemini/extensions/my-extension/gemini-extension.json`

### `gemini-extension.json`

`gemini-extension.json` ファイルには、拡張機能の設定が含まれています。ファイルは次の構造をしています。

```json
{
  "name": "my-extension",
  "version": "1.0.0",
  "mcpServers": {
    "my-server": {
      "command": "node my-server.js"
    }
  },
  "contextFileName": "GEMINI.md"
}
```

- `name`: 拡張機能の名前。これは拡張機能を一意に識別するために使用されます。これは拡張機能ディレクトリの名前と一致する必要があります。
- `version`: 拡張機能のバージョン。
- `mcpServers`: 設定する MCP サーバーのマップ。キーはサーバーの名前で、値はサーバー設定です。これらのサーバーは、[`settings.json` ファイル](./cli/configuration.md)で設定された MCP サーバーと同様に起動時にロードされます。拡張機能と `settings.json` ファイルの両方が同じ名前の MCP サーバーを設定している場合、`settings.json` ファイルで定義されたサーバーが優先されます。
- `contextFileName`: 拡張機能のコンテキストを含むファイルの名前。これはワークスペースからコンテキストをロードするために使用されます。このプロパティが使用されていないが、拡張機能ディレクトリに `GEMINI.md` ファイルが存在する場合、そのファイルがロードされます。

Gemini CLI が起動すると、すべての拡張機能をロードし、それらの設定をマージします。競合がある場合は、ワークスペース設定が優先されます。
