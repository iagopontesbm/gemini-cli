# チュートリアル

このページには、Gemini CLI と対話するためのチュートリアルが含まれています。

## モデルコンテキストプロトコル（MCP）サーバーの設定

> [!CAUTION]
> サードパーティの MCP サーバーを使用する前に、そのソースを信頼し、提供するツールを理解していることを確認してください。サードパーティサーバーの使用は自己責任です。

このチュートリアルでは、例として [GitHub MCP サーバー](https://github.com/github/github-mcp-server) を使用して、MCP サーバーを設定する方法を示します。GitHub MCP サーバーは、問題の作成やプルリクエストへのコメントなど、GitHub リポジトリと対話するためのツールを提供します。

### 前提条件

開始する前に、次のものがインストールされ、設定されていることを確認してください。

- **Docker:** [Docker] をインストールして実行します。
- **GitHub パーソナルアクセストークン（PAT）:** 必要なスコープを持つ新しい [クラシック] または [きめ細かい] PAT を作成します。

[Docker]: https://www.docker.com/
[クラシック]: https://github.com/settings/tokens/new
[きめ細かい]: https://github.com/settings/personal-access-tokens/new

### ガイド

#### `settings.json` で MCP サーバーを設定する

プロジェクトのルートディレクトリで、[`.gemini/settings.json` ファイル](./configuration.md)を作成または開きます。ファイル内に、GitHub MCP サーバーを起動する方法を指示する `mcpServers` 設定ブロックを追加します。

```json
{
  "mcpServers": {
    "github": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e",
        "GITHUB_PERSONAL_ACCESS_TOKEN",
        "ghcr.io/github/github-mcp-server"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_PERSONAL_ACCESS_TOKEN}"
      }
    }
  }
}
```

#### GitHub トークンを設定する

> [!CAUTION]
> 個人リポジトリとプライベートリポジトリにアクセスできる広範なスコープのパーソナルアクセストークンを使用すると、プライベートリポジトリの情報がパブリックリポジトリに漏洩する可能性があります。パブリックリポジトリとプライベートリポジトリの両方へのアクセスを共有しない、きめ細かいアクセストークンを使用することをお勧めします。

環境変数を使用して GitHub PAT を保存します。

```bash
GITHUB_PERSONAL_ACCESS_TOKEN="pat_YourActualGitHubTokenHere"
```

Gemini CLI は、`settings.json` ファイルで定義した `mcpServers` 設定でこの値を使用します。

#### Gemini CLI を起動して接続を確認する

Gemini CLI を起動すると、設定が自動的に読み取られ、バックグラウンドで GitHub MCP サーバーが起動します。その後、自然言語プロンプトを使用して Gemini CLI に GitHub アクションを実行するように依頼できます。例:

```bash
「foo/bar リポジトリで私に割り当てられているすべてのオープンな issue を取得し、それらを優先順位付けしてください」
```
