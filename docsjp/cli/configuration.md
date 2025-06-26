# Gemini CLI 設定

Gemini CLI は、環境変数、コマンドライン引数、設定ファイルなど、その動作を設定するためのいくつかの方法を提供します。このドキュメントでは、さまざまな設定方法と利用可能な設定について概説します。

## 設定レイヤー

設定は次の優先順位で適用されます（小さい番号は大きい番号によって上書きされます）。

1.  **デフォルト値:** アプリケーション内のハードコードされたデフォルト。
2.  **ユーザー設定ファイル:** 現在のユーザーのグローバル設定。
3.  **プロジェクト設定ファイル:** プロジェクト固有の設定。
4.  **環境変数:** システム全体またはセッション固有の変数で、`.env` ファイルからロードされる可能性があります。
5.  **コマンドライン引数:** CLI の起動時に渡される値。

## ユーザー設定ファイルとプロジェクト設定ファイル

Gemini CLI は、永続的な設定に `settings.json` ファイルを使用します。これらのファイルには2つの場所があります。

- **ユーザー設定ファイル:**
  - **場所:** `~/.gemini/settings.json`（`~` はホームディレクトリです）。
  - **スコープ:** 現在のユーザーのすべての Gemini CLI セッションに適用されます。
- **プロジェクト設定ファイル:**
  - **場所:** プロジェクトのルートディレクトリ内の `.gemini/settings.json`。
  - **スコープ:** その特定のプロジェクトから Gemini CLI を実行する場合にのみ適用されます。プロジェクト設定はユーザー設定を上書きします。

**設定内の環境変数に関する注意:** `settings.json` ファイル内の文字列値は、`$VAR_NAME` または `${VAR_NAME}` 構文を使用して環境変数を参照できます。これらの変数は、設定がロードされるときに自動的に解決されます。たとえば、`MY_API_TOKEN` という環境変数がある場合、`settings.json` で次のように使用できます: `"apiKey": "$MY_API_TOKEN"`。

### プロジェクトの `.gemini` ディレクトリ

プロジェクト設定ファイルに加えて、プロジェクトの `.gemini` ディレクトリには、次のような Gemini CLI の操作に関連する他のプロジェクト固有のファイルを含めることができます。

- [カスタムサンドボックスプロファイル](#sandboxing)（例: `.gemini/sandbox-macos-custom.sb`、`.gemini/sandbox.Dockerfile`）。

### `settings.json` で利用可能な設定:

- **`contextFileName`** (文字列または文字列の配列):

  - **説明:** コンテキストファイル（例: `GEMINI.md`、`AGENTS.md`）のファイル名を指定します。単一のファイル名または受け入れられるファイル名のリストを指定できます。
  - **デフォルト:** `GEMINI.md`
  - **例:** `"contextFileName": "AGENTS.md"`

- **`bugCommand`** (オブジェクト):

  - **説明:** `/bug` コマンドのデフォルト URL を上書きします。
  - **デフォルト:** `"urlTemplate": "https://github.com/google-gemini/gemini-cli/issues/new?template=bug_report.yml&title={title}&info={info}"`
  - **プロパティ:**
    - **`urlTemplate`** (文字列): `{title}` および `{info}` プレースホルダーを含めることができる URL。
  - **例:**
    ```json
    "bugCommand": {
      "urlTemplate": "https://bug.example.com/new?title={title}&info={info}"
    }
    ```

- **`fileFiltering`** (オブジェクト):

  - **説明:** @ コマンドおよびファイル検出ツールの git 対応ファイルフィルタリング動作を制御します。
  - **デフォルト:** `"respectGitIgnore": true, "enableRecursiveFileSearch": true`
  - **プロパティ:**
    - **`respectGitIgnore`** (ブール値): ファイルを検出する際に .gitignore パターンを尊重するかどうか。`true` に設定すると、git で無視されるファイル（`node_modules/`、`dist/`、`.env` など）は @ コマンドおよびファイルリスト操作から自動的に除外されます。
    - **`enableRecursiveFileSearch`** (ブール値): プロンプトで @ プレフィックスを補完する際に、現在のツリー以下のファイル名を再帰的に検索するかどうか。
  - **例:**
    ```json
    "fileFiltering": {
      "respectGitIgnore": true,
      "enableRecursiveFileSearch": false
    }
    ```

- **`coreTools`** (文字列の配列):

  - **説明:** モデルで利用可能にするコアツール名のリストを指定できます。これは、組み込みツールのセットを制限するために使用できます。コアツールの一覧については、[組み込みツール](../core/tools-api.md#built-in-tools)を参照してください。
  - **デフォルト:** Gemini モデルで使用可能なすべてのツール。
  - **例:** `"coreTools": ["ReadFileTool", "GlobTool", "SearchText"]`

- **`excludeTools`** (文字列の配列):

  - **説明:** モデルから除外するコアツール名のリストを指定できます。`excludeTools` と `coreTools` の両方にリストされているツールは除外されます。
  - **デフォルト**: 除外されるツールはありません。
  - **例:** `"excludeTools": ["run_shell_command", "findFiles"]`

- **`autoAccept`** (ブール値):

  - **説明:** 安全であると見なされるツールコール（読み取り専用操作など）を、ユーザーの明示的な確認なしに CLI が自動的に受け入れて実行するかどうかを制御します。`true` に設定すると、CLI は安全と見なされるツールの確認プロンプトをバイパスします。
  - **デフォルト:** `false`
  - **例:** `"autoAccept": true`

- **`theme`** (文字列):

  - **説明:** Gemini CLI の視覚的な[テーマ](./themes.md)を設定します。
  - **デフォルト:** `"Default"`
  - **例:** `"theme": "GitHub"`

- **`sandbox`** (ブール値または文字列):

  - **説明:** ツールの実行にサンドボックスを使用するかどうか、およびその方法を制御します。`true` に設定すると、Gemini CLI はビルド済みの `gemini-cli-sandbox` Docker イメージを使用します。詳細については、[サンドボックス](#sandboxing)を参照してください。
  - **デフォルト:** `false`
  - **例:** `"sandbox": "docker"`

- **`toolDiscoveryCommand`** (文字列):

  - **説明:** プロジェクトからツールを検出するためのカスタムシェルコマンドを定義します。シェルコマンドは、[関数宣言](https://ai.google.dev/gemini-api/docs/function-calling#function-declarations)の JSON 配列を `stdout` で返す必要があります。ツールラッパーはオプションです。
  - **デフォルト:** 空
  - **例:** `"toolDiscoveryCommand": "bin/get_tools"`

- **`toolCallCommand`** (文字列):

  - **説明:** `toolDiscoveryCommand` を使用して検出された特定のツールを呼び出すためのカスタムシェルコマンドを定義します。シェルコマンドは次の基準を満たす必要があります。
    - 最初のコマンドライン引数として関数 `name`（[関数宣言](https://ai.google.dev/gemini-api/docs/function-calling#function-declarations)とまったく同じ）を取る必要があります。
    - [`functionCall.args`](https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/inference#functioncall) と同様に、`stdin` で関数引数を JSON として読み取る必要があります。
    - [`functionResponse.response.content`](https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/inference#functionresponse) と同様に、`stdout` で関数出力を JSON として返す必要があります。
  - **デフォルト:** 空
  - **例:** `"toolCallCommand": "bin/call_tool"`

- **`mcpServers`** (オブジェクト):

  - **説明:** カスタムツールを検出して使用するために、1 つ以上のモデルコンテキストプロトコル（MCP）サーバーへの接続を設定します。Gemini CLI は、設定された各 MCP サーバーに接続して、利用可能なツールを検出しようとします。複数の MCP サーバーが同じ名前のツールを公開している場合、競合を避けるために、ツール名は設定で定義したサーバーエイリアスでプレフィックスが付けられます（例: `serverAlias__actualToolName`）。システムは互換性のために MCP ツール定義から特定のスキーマプロパティを削除する場合があることに注意してください。
  - **デフォルト:** 空
  - **プロパティ:**
    - **`<SERVER_NAME>`** (オブジェクト): 名前付きサーバーのサーバーパラメータ。
      - `command` (文字列、必須): MCP サーバーを起動するために実行するコマンド。
      - `args` (文字列の配列、オプション): コマンドに渡す引数。
      - `env` (オブジェクト、オプション): サーバープロセスに設定する環境変数。
      - `cwd` (文字列、オプション): サーバーを起動する作業ディレクトリ。
      - `timeout` (数値、オプション): この MCP サーバーへのリクエストのタイムアウト（ミリ秒単位）。
      - `trust` (ブール値、オプション): このサーバーを信頼し、すべてのツールコール確認をバイパスします。
  - **例:**
    ```json
    "mcpServers": {
      "myPythonServer": {
        "command": "python",
        "args": ["mcp_server.py", "--port", "8080"],
        "cwd": "./mcp_tools/python",
        "timeout": 5000
      },
      "myNodeServer": {
        "command": "node",
        "args": ["mcp_server.js"],
        "cwd": "./mcp_tools/node"
      },
      "myDockerServer": {
        "command": "docker",
        "args": ["run", "i", "--rm", "-e", "API_KEY", "ghcr.io/foo/bar"],
        "env": {
          "API_KEY": "$MY_API_TOKEN"
        }
      },
    }
    ```

- **`checkpointing`** (オブジェクト):

  - **説明:** 会話とファイルの状態を保存および復元できるチェックポイント機能を設定します。詳細については、[チェックポイントドキュメント](../checkpointing.md)を参照してください。
  - **デフォルト:** `{"enabled": false}`
  - **プロパティ:**
    - **`enabled`** (ブール値): `true` の場合、`/restore` コマンドが利用可能になります。

- **`preferredEditor`** (文字列):

  - **説明:** diff の表示に使用する優先エディタを指定します。
  - **デフォルト:** `vscode`
  - **例:** `"preferredEditor": "vscode"`

- **`telemetry`** (オブジェクト)
  - **説明:** Gemini CLI のロギングとメトリクス収集を設定します。詳細については、[テレメトリ](../telemetry.md)を参照してください。
  - **デフォルト:** `{"enabled": false, "target": "local", "otlpEndpoint": "http://localhost:4317", "logPrompts": true}`
  - **プロパティ:**
    - **`enabled`** (ブール値): テレメトリが有効かどうか。
    - **`target`** (文字列): 収集されたテレメトリの宛先。サポートされている値は `local` と `gcp` です。
    - **`otlpEndpoint`** (文字列): OTLP エクスポータのエンドポイント。
    - **`logPrompts`** (ブール値): ユーザープロンプトのコンテンツをログに含めるかどうか。
  - **例:**
    ```json
    "telemetry": {
      "enabled": true,
      "target": "local",
      "otlpEndpoint": "http://localhost:16686",
      "logPrompts": false
    }
    ```
- **`usageStatisticsEnabled`** (ブール値):
  - **説明:** 使用状況統計の収集を有効または無効にします。詳細については、[使用状況統計](#usage-statistics)を参照してください。
  - **デフォルト:** `true`
  - **例:**
    ```json
    "usageStatisticsEnabled": false
    ```

### `settings.json` の例:

```json
{
  "theme": "GitHub",
  "sandbox": "docker",
  "toolDiscoveryCommand": "bin/get_tools",
  "toolCallCommand": "bin/call_tool",
  "mcpServers": {
    "mainServer": {
      "command": "bin/mcp_server.py"
    },
    "anotherServer": {
      "command": "node",
      "args": ["mcp_server.js", "--verbose"]
    }
  },
  "telemetry": {
    "enabled": true,
    "target": "local",
    "otlpEndpoint": "http://localhost:4317",
    "logPrompts": true
  },
  "usageStatisticsEnabled": true
}
```

## シェル履歴

CLI は、実行したシェルコマンドの履歴を保持します。異なるプロジェクト間の競合を避けるために、この履歴はユーザーのホームフォルダ内のプロジェクト固有のディレクトリに保存されます。

- **場所:** `~/.gemini/tmp/<project_hash>/shell_history`
  - `<project_hash>` は、プロジェクトのルートパスから生成された一意の識別子です。
  - 履歴は `shell_history` という名前のファイルに保存されます。

## 環境変数と `.env` ファイル

環境変数は、特に API キーなどの機密情報や、環境間で変更される可能性のある設定など、アプリケーションを設定するための一般的な方法です。

CLI は、`.env` ファイルから環境変数を自動的にロードします。ロード順序は次のとおりです。

1.  現在の作業ディレクトリにある `.env` ファイル。
2.  見つからない場合は、`.env` ファイルが見つかるか、プロジェクトルート（`.git` フォルダで識別）またはホームディレクトリに達するまで、親ディレクトリを上方向に検索します。
3.  それでも見つからない場合は、`~/.env`（ユーザーのホームディレクトリ内）を探します。

- **`GEMINI_API_KEY`** (必須):
  - Gemini API の API キー。
  - **操作に不可欠です。** これがないと CLI は機能しません。
  - シェルプロファイル（例: `~/.bashrc`、`~/.zshrc`）または `.env` ファイルに設定します。
- **`GEMINI_MODEL`**:
  - 使用するデフォルトの Gemini モデルを指定します。
  - ハードコードされたデフォルトを上書きします。
  - 例: `export GEMINI_MODEL="gemini-2.5-flash"`
- **`GOOGLE_API_KEY`**:
  - Google Cloud API キー。
  - エクスプレスモードで Vertex AI を使用するために必要です。
  - 必要な権限があることを確認し、`GOOGLE_GENAI_USE_VERTEXAI=true` 環境変数を設定します。
  - 例: `export GOOGLE_API_KEY="YOUR_GOOGLE_API_KEY"`
- **`GOOGLE_CLOUD_PROJECT`**:
  - Google Cloud プロジェクト ID。
  - Code Assist または Vertex AI を使用するために必要です。
  - Vertex AI を使用する場合は、必要な権限があることを確認し、`GOOGLE_GENAI_USE_VERTEXAI=true` 環境変数を設定します。
  - 例: `export GOOGLE_CLOUD_PROJECT="YOUR_PROJECT_ID"`
- **`GOOGLE_APPLICATION_CREDENTIALS`** (文字列):
  - **説明:** Google アプリケーション認証情報 JSON ファイルへのパス。
  - **例:** `export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/credentials.json"`
- **`OTLP_GOOGLE_CLOUD_PROJECT`**:
  - Google Cloud のテレメトリ用の Google Cloud プロジェクト ID。
  - 例: `export OTLP_GOOGLE_CLOUD_PROJECT="YOUR_PROJECT_ID"`
- **`GOOGLE_CLOUD_LOCATION`**:
  - Google Cloud プロジェクトの場所（例: us-central1）。
  - 非エクスプレスモードで Vertex AI を使用するために必要です。
  - Vertex AI を使用する場合は、必要な権限があることを確認し、`GOOGLE_GENAI_USE_VERTEXAI=true` 環境変数を設定します。
  - 例: `export GOOGLE_CLOUD_LOCATION="YOUR_PROJECT_LOCATION"`
- **`GEMINI_SANDBOX`**:
  - `settings.json` の `sandbox` 設定の代替。
  - `true`、`false`、`docker`、`podman`、またはカスタムコマンド文字列を受け入れます。
- **`SEATBELT_PROFILE`** (macOS 固有):
  - macOS の Seatbelt (`sandbox-exec`) プロファイルを切り替えます。
  - `permissive-open`: （デフォルト）プロジェクトフォルダ（およびその他いくつかのフォルダ、`packages/cli/src/utils/sandbox-macos-permissive-open.sb` を参照）への書き込みを制限しますが、他の操作は許可します。
  - `strict`: デフォルトで操作を拒否する厳格なプロファイルを使用します。
  - `<profile_name>`: カスタムプロファイルを使用します。カスタムプロファイルを定義するには、プロジェクトの `.gemini/` ディレクトリに `sandbox-macos-<profile_name>.sb` という名前のファイルを作成します（例: `my-project/.gemini/sandbox-macos-custom.sb`）。
- **`DEBUG` または `DEBUG_MODE`** (多くの場合、基になるライブラリまたは CLI 自体で使用されます):
  - 詳細なデバッグロギングを有効にするには `true` または `1` に設定します。これはトラブルシューティングに役立ちます。
- **`NO_COLOR`**:
  - CLI のすべてのカラー出力を無効にするには、任意の値に設定します。
- **`CLI_TITLE`**:
  - CLI のタイトルをカスタマイズするには、文字列に設定します。
- **`CODE_ASSIST_ENDPOINT`**:
  - コード支援サーバーのエンドポイントを指定します。
  - これは開発とテストに役立ちます。

## コマンドライン引数

CLI の実行時に直接渡される引数は、その特定のセッションの他の設定を上書きできます。

- **`--model <model_name>`** (**`-m <model_name>`**):
  - このセッションで使用する Gemini モデルを指定します。
  - 例: `npm start -- --model gemini-1.5-pro-latest`
- **`--prompt <your_prompt>`** (**`-p <your_prompt>`**):
  - プロンプトをコマンドに直接渡すために使用されます。これにより、Gemini CLI が非インタラクティブモードで呼び出されます。
- **`--sandbox`** (**`-s`**):
  - このセッションのサンドボックスモードを有効にします。
- **`--sandbox-image`**:
  - サンドボックスイメージ URI を設定します。
- **`--debug_mode`** (**`-d`**):
  - このセッションのデバッグモードを有効にし、より詳細な出力を提供します。
- **`--all_files`** (**`-a`**):
  - 設定されている場合、現在のディレクトリ内のすべてのファイルをプロンプトのコンテキストとして再帰的に含めます。
- **`--help`** (または **`-h`**):
  - コマンドライン引数に関するヘルプ情報を表示します。
- **`--show_memory_usage`**:
  - 現在のメモリ使用量を表示します。
- **`--yolo`**:
  - YOLO モードを有効にし、すべてのツールコールを自動的に承認します。
- **`--telemetry`**:
  - [テレメトリ](../telemetry.md)を有効にします。
- **`--telemetry-target`**:
  - テレメトリターゲットを設定します。詳細については、[テレメトリ](../telemetry.md)を参照してください。
- **`--telemetry-otlp-endpoint`**:
  - テレメトリの OTLP エンドポイントを設定します。詳細については、[テレメトリ](../telemetry.md)を参照してください。
- **`--telemetry-log-prompts`**:
  - テレメトリのプロンプトロギングを有効にします。詳細については、[テレメトリ](../telemetry.md)を参照してください。
- **`--checkpointing`**:
  - [チェックポイント](./commands.md#checkpointing-commands)を有効にします。
- **`--version`**:
  - CLI のバージョンを表示します。

## コンテキストファイル（階層的指示コンテキスト）

CLI の動作に対する厳密な設定ではありませんが、コンテキストファイル（デフォルトは `GEMINI.md` ですが、`contextFileName` 設定で設定可能）は、Gemini モデルに提供される指示コンテキスト（「メモリ」とも呼ばれます）を設定するために不可欠です。この強力な機能により、プロジェクト固有の指示、コーディングスタイルガイド、または関連する背景情報を AI に提供し、AI の応答をニーズに合わせてより調整され、正確にすることができます。CLI には、ロードされたコンテキストファイルの数を示すフッターのインジケーターなど、アクティブなコンテキストについて通知するための UI 要素が含まれています。

- **目的:** これらの Markdown ファイルには、Gemini モデルが対話中に認識してほしい指示、ガイドライン、またはコンテキストが含まれています。システムは、この指示コンテキストを階層的に管理するように設計されています。

### コンテキストファイルのコンテンツの例（例: `GEMINI.md`）

TypeScript プロジェクトのルートにあるコンテキストファイルに含まれる可能性のある概念的な例を次に示します。

```markdown
# プロジェクト: My Awesome TypeScript Library

## 一般的な指示:

- 新しい TypeScript コードを生成する場合は、既存のコーディングスタイルに従ってください。
- すべての新しい関数とクラスに JSDoc コメントがあることを確認してください。
- 適切な場合は、関数型プログラミングパラダイムを優先してください。
- すべてのコードは TypeScript 5.0 および Node.js 18+ と互換性がある必要があります。

## コーディングスタイル:

- インデントには2つのスペースを使用します。
- インターフェイス名の先頭には `I` を付けます（例: `IUserService`）。
- プライベートクラスメンバーの先頭にはアンダースコア（`_`）を付けます。
- 常に厳密等価演算子（`===` および `!==`）を使用します。

## 特定のコンポーネント: `src/api/client.ts`

- このファイルは、すべてのアウトバウンド API リクエストを処理します。
- 新しい API 呼び出し関数を追加する場合は、堅牢なエラー処理とロギングが含まれていることを確認してください。
- すべての GET リクエストに既存の `fetchWithRetry` ユーティリティを使用します。

## 依存関係について:

- 絶対に必要な場合を除き、新しい外部依存関係を導入しないでください。
- 新しい依存関係が必要な場合は、その理由を述べてください。
```

この例は、一般的なプロジェクトコンテキスト、特定のコーディング規則、さらには特定のファイルやコンポーネントに関するメモを提供する方法を示しています。コンテキストファイルがより関連性があり正確であるほど、AI はより適切に支援できます。規則とコンテキストを確立するために、プロジェクト固有のコンテキストファイルを強くお勧めします。

- **階層的なロードと優先順位:** CLI は、いくつかの場所からコンテキストファイル（例: `GEMINI.md`）をロードすることにより、高度な階層メモリシステムを実装します。このリストの下位にあるファイル（より具体的）のコンテンツは、通常、上位にあるファイル（より一般的）のコンテンツを上書きまたは補足します。正確な連結順序と最終的なコンテキストは、`/memory show` コマンドを使用して検査できます。一般的なロード順序は次のとおりです。
  1.  **グローバルコンテキストファイル:**
      - 場所: `~/.gemini/<contextFileName>`（例: ユーザーホームディレクトリの `~/.gemini/GEMINI.md`）。
      - スコープ: すべてのプロジェクトのデフォルトの指示を提供します。
  2.  **プロジェクトルートと上位のコンテキストファイル:**
      - 場所: CLI は、現在の作業ディレクトリで設定されたコンテキストファイルを検索し、次にプロジェクトルート（`.git` フォルダで識別）またはホームディレクトリまでの各親ディレクトリで検索します。
      - スコープ: プロジェクト全体またはその大部分に関連するコンテキストを提供します。
  3.  **サブディレクトリコンテキストファイル（コンテキスト/ローカル）:**
      - 場所: CLI は、現在の作業ディレクトリの下のサブディレクトリでも設定されたコンテキストファイルをスキャンします（`node_modules`、`.git` などの一般的な無視パターンを尊重します）。
      - スコープ: プロジェクトの特定のコンポーネント、モジュール、またはサブセクションに関連する非常に具体的な指示を許可します。
- **連結と UI 表示:** 見つかったすべてのコンテキストファイルの内容は（それらの起点とパスを示す区切り文字とともに）連結され、システムプロンプトの一部として Gemini モデルに提供されます。CLI フッターには、ロードされたコンテキストファイルの数が表示され、アクティブな指示コンテキストをすばやく視覚的に確認できます。
- **メモリ管理コマンド:**
  - `/memory refresh` を使用して、設定されたすべての場所からすべてのコンテキストファイルを強制的に再スキャンおよびリロードします。これにより、AI の指示コンテキストが更新されます。
  - `/memory show` を使用して、現在ロードされている結合された指示コンテキストを表示し、AI によって使用されている階層とコンテンツを確認できます。
  - `/memory` コマンドとそのサブコマンド（`show` および `refresh`）の詳細については、[コマンドドキュメント](./commands.md#memory)を参照してください。

これらの設定レイヤーとコンテキストファイルの階層的な性質を理解して活用することで、AI のメモリを効果的に管理し、Gemini CLI の応答を特定のニーズやプロジェクトに合わせて調整できます。

## サンドボックス

Gemini CLI は、システムを保護するために、サンドボックス環境内で潜在的に安全でない操作（シェルコマンドやファイル変更など）を実行できます。

サンドボックスはデフォルトで無効になっていますが、いくつかの方法で有効にできます。

- `--sandbox` または `-s` フラグを使用します。
- `GEMINI_SANDBOX` 環境変数を設定します。
- サンドボックスは、デフォルトで `--yolo` モードで有効になっています。

デフォルトでは、ビルド済みの `gemini-cli-sandbox` Docker イメージを使用します。

プロジェクト固有のサンドボックスのニーズに合わせて、プロジェクトのルートディレクトリに `.gemini/sandbox.Dockerfile` というカスタム Dockerfile を作成できます。この Dockerfile は、ベースサンドボックスイメージに基づいています。

```dockerfile
FROM gemini-cli-sandbox

# ここにカスタムの依存関係または設定を追加します
# 例:
# RUN apt-get update && apt-get install -y some-package
# COPY ./my-config /app/my-config
```

`.gemini/sandbox.Dockerfile` が存在する場合、Gemini CLI の実行時に `BUILD_SANDBOX` 環境変数を使用して、カスタムサンドボックスイメージを自動的にビルドできます。

```bash
BUILD_SANDBOX=1 gemini -s
```

## 使用状況統計

Gemini CLI の改善に役立てるため、匿名化された使用状況統計を収集しています。このデータは、CLI の使用方法を理解し、一般的な問題を特定し、新機能の優先順位を付けるのに役立ちます。

**収集する内容:**

- **ツールコール:** 呼び出されるツールの名前、成功したか失敗したか、実行にかかった時間をログに記録します。ツールに渡される引数やツールから返されるデータは収集しません。
- **API リクエスト:** 各リクエストに使用された Gemini モデル、リクエストの期間、成功したかどうかをログに記録します。プロンプトや応答の内容は収集しません。
- **セッション情報:** 有効になっているツールや承認モードなど、CLI の設定に関する情報を収集します。

**収集しない内容:**

- **個人を特定できる情報（PII）:** 名前、メールアドレス、API キーなどの個人情報は収集しません。
- **プロンプトと応答のコンテンツ:** プロンプトの内容や Gemini モデルからの応答はログに記録しません。
- **ファイルコンテンツ:** CLI によって読み書きされるファイルのコンテンツはログに記録しません。

**オプトアウトする方法:**

`settings.json` ファイルの `usageStatisticsEnabled` プロパティを `false` に設定することで、いつでも使用状況統計の収集をオプトアウトできます。

```json
{
  "usageStatisticsEnabled": false
}
```
