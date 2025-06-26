# Gemini CLI 可観測性ガイド

テレメトリは、Gemini CLI のパフォーマンス、健全性、および使用状況に関するデータを提供します。有効にすると、トレース、メトリック、および構造化ログを通じて、操作の監視、問題のデバッグ、およびツール使用の最適化を行うことができます。

Gemini CLI のテレメトリシステムは、**[OpenTelemetry] (OTEL)** 標準に基づいて構築されており、互換性のあるバックエンドにデータを送信できます。

[OpenTelemetry]: https://opentelemetry.io/

## テレメトリの有効化

テレメトリは複数の方法で有効にできます。設定は主に [`.gemini/settings.json` ファイル](./cli/configuration.md)と環境変数を介して管理されますが、CLI フラグは特定のセッションに対してこれらの設定を上書きできます。

### 優先順位

次に、テレメトリ設定を適用するための優先順位を示します。上位にリストされている項目ほど優先度が高くなります。

1.  **CLI フラグ (`gemini` コマンド用):**

    - `--telemetry` / `--no-telemetry`: `telemetry.enabled` を上書きします。
    - `--telemetry-target <local|gcp>`: `telemetry.target` を上書きします。
    - `--telemetry-otlp-endpoint <URL>`: `telemetry.otlpEndpoint` を上書きします。
    - `--telemetry-log-prompts` / `--no-telemetry-log-prompts`: `telemetry.logPrompts` を上書きします。

1.  **環境変数:**

    - `OTEL_EXPORTER_OTLP_ENDPOINT`: `telemetry.otlpEndpoint` を上書きします。

1.  **ワークスペース設定ファイル (`.gemini/settings.json`):** このプロジェクト固有のファイルの `telemetry` オブジェクトからの値。

1.  **ユーザー設定ファイル (`~/.gemini/settings.json`):** このグローバルユーザーファイルの `telemetry` オブジェクトからの値。

1.  **デフォルト:** 上記のいずれによっても設定されていない場合に適用されます。
    - `telemetry.enabled`: `false`
    - `telemetry.target`: `local`
    - `telemetry.otlpEndpoint`: `http://localhost:4317`
    - `telemetry.logPrompts`: `true`

**`npm run telemetry -- --target=<gcp|local>` スクリプトの場合:**
このスクリプトへの `--target` 引数は、そのスクリプトの期間と目的のためにのみ `telemetry.target` を上書きします (つまり、開始するコレクターを選択します)。`settings.json` を永続的に変更するものではありません。スクリプトは、まず `settings.json` でデフォルトとして使用する `telemetry.target` を探します。

### 設定例

次のコードをワークスペース (`.gemini/settings.json`) またはユーザー (`~/.gemini/settings.json`) 設定に追加して、テレメトリを有効にし、出力を Google Cloud に送信できます。

```json
{
  "telemetry": {
    "enabled": true,
    "target": "gcp"
  },
  "sandbox": false
}
```

## OTEL コレクターの実行

OTEL コレクターは、テレメトリデータを受信、処理、およびエクスポートするサービスです。
CLI は OTLP/gRPC プロトコルを使用してデータを送信します。

OTEL エクスポーターの標準設定の詳細については、[ドキュメント][otel-config-docs]を参照してください。

[otel-config-docs]: https://opentelemetry.io/docs/languages/sdk-configuration/otlp-exporter/

### ローカル

`npm run telemetry -- --target=local` コマンドを使用して、`.gemini/settings.json` ファイルに必要な設定を構成するなど、ローカルテレメトリパイプラインのセットアッププロセスを自動化します。基になるスクリプトは `otelcol-contrib` (OpenTelemetry Collector) と `jaeger` (トレースを表示するための Jaeger UI) をインストールします。使用するには:

1.  **コマンドの実行**:
    リポジトリのルートからコマンドを実行します。

    ```bash
    npm run telemetry -- --target=local
    ```

    スクリプトは次の処理を行います。

    - 必要に応じて Jaeger と OTEL をダウンロードします。
    - ローカル Jaeger インスタンスを開始します。
    - Gemini CLI からデータを受信するように構成された OTEL コレクターを開始します。
    - ワークスペース設定でテレメトリを自動的に有効にします。
    - 終了時にテレメトリを無効にします。

1.  **トレースの表示**:
    Web ブラウザを開き、**http://localhost:16686** に移動して Jaeger UI にアクセスします。ここで、Gemini CLI 操作の詳細なトレースを検査できます。

1.  **ログとメトリックの検査**:
    スクリプトは OTEL コレクターの出力 (ログとメトリックを含む) を `~/.gemini/tmp/<projectHash>/otel/collector.log` にリダイレクトします。スクリプトは、テレメトリデータ (トレース、メトリック、ログ) をローカルで表示および追跡するためのリンクとコマンドを提供します。

1.  **サービスの停止**:
    スクリプトが実行されているターミナルで `Ctrl+C` を押して、OTEL Collector と Jaeger サービスを停止します。

### Google Cloud

`npm run telemetry -- --target=gcp` コマンドを使用して、Google Cloud プロジェクトにデータを転送するローカル OpenTelemetry コレクターのセットアップを自動化します。これには、`.gemini/settings.json` ファイルに必要な設定を構成することも含まれます。基になるスクリプトは `otelcol-contrib` をインストールします。使用するには:

1.  **前提条件**:

    - Google Cloud プロジェクト ID があること。
    - `GOOGLE_CLOUD_PROJECT` 環境変数をエクスポートして、OTEL コレクターが利用できるようにします。
      ```bash
      export OTLP_GOOGLE_CLOUD_PROJECT="your-project-id"
      ```
    - Google Cloud で認証します (例: `gcloud auth application-default login` を実行するか、`GOOGLE_APPLICATION_CREDENTIALS` が設定されていることを確認します)。
    - Google Cloud アカウント/サービスアカウントに必要な IAM ロールがあることを確認します: 「Cloud Trace Agent」、「Monitoring Metric Writer」、「Logs Writer」。

1.  **コマンドの実行**:
    リポジトリのルートからコマンドを実行します。

    ```bash
    npm run telemetry -- --target=gcp
    ```

    スクリプトは次の処理を行います。

    - 必要に応じて `otelcol-contrib` バイナリをダウンロードします。
    - Gemini CLI からデータを受信し、指定された Google Cloud プロジェクトにエクスポートするように構成された OTEL コレクターを開始します。
    - ワークスペース設定 (`.gemini/settings.json`) でテレメトリを自動的に有効にし、サンドボックスモードを無効にします。
    - Google Cloud Console でトレース、メトリック、ログを表示するための直接リンクを提供します。
    - 終了時 (Ctrl+C) に、元のテレメトリとサンドボックス設定を復元しようとします。

1.  **Gemini CLI の実行:**
    別のターミナルで Gemini CLI コマンドを実行します。これにより、コレクターがキャプチャするテレメトリデータが生成されます。

1.  **Google Cloud でのテレメトリの表示**:
    スクリプトによって提供されるリンクを使用して Google Cloud Console に移動し、トレース、メトリック、ログを表示します。

1.  **ローカルコレクターログの検査**:
    スクリプトはローカル OTEL コレクターの出力を `~/.gemini/tmp/<projectHash>/otel/collector-gcp.log` にリダイレクトします。スクリプトは、コレクターログをローカルで表示および追跡するためのリンクとコマンドを提供します。

1.  **サービスの停止**:
    スクリプトが実行されているターミナルで `Ctrl+C` を押して OTEL Collector を停止します。

## ログとメトリックのリファレンス

次のセクションでは、Gemini CLI 用に生成されるログとメトリックの構造について説明します。

- `sessionId` は、すべてのログとメトリックの共通属性として含まれています。

### ログ

ログは、特定のイベントのタイムスタンプ付きレコードです。Gemini CLI では次のイベントがログに記録されます。

- `gemini_cli.config`: このイベントは、CLI の設定とともに起動時に1回発生します。

  - **属性**:
    - `model` (文字列)
    - `embedding_model` (文字列)
    - `sandbox_enabled` (ブール値)
    - `core_tools_enabled` (文字列)
    - `approval_mode` (文字列)
    - `api_key_enabled` (ブール値)
    - `vertex_ai_enabled` (ブール値)
    - `code_assist_enabled` (ブール値)
    - `log_prompts_enabled` (ブール値)
    - `file_filtering_respect_git_ignore` (ブール値)
    - `debug_mode` (ブール値)
    - `mcp_servers` (文字列)

- `gemini_cli.user_prompt`: このイベントは、ユーザーがプロンプトを送信したときに発生します。

  - **属性**:
    - `prompt_length`
    - `prompt` (この属性は、`log_prompts_enabled` が `false` に設定されている場合は除外されます)

- `gemini_cli.tool_call`: このイベントは、各関数呼び出しに対して発生します。

  - **属性**:
    - `function_name`
    - `function_args`
    - `duration_ms`
    - `success` (ブール値)
    - `decision` (文字列: "accept"、"reject"、または "modify"、該当する場合)
    - `error` (該当する場合)
    - `error_type` (該当する場合)

- `gemini_cli.api_request`: このイベントは、Gemini API へのリクエストを行うときに発生します。

  - **属性**:
    - `model`
    - `request_text` (該当する場合)

- `gemini_cli.api_error`: このイベントは、API リクエストが失敗した場合に発生します。

  - **属性**:
    - `model`
    - `error`
    - `error_type`
    - `status_code`
    - `duration_ms`

- `gemini_cli.api_response`: このイベントは、Gemini API からの応答を受信したときに発生します。

  - **属性**:
    - `model`
    - `status_code`
    - `duration_ms`
    - `error` (オプション)
    - `input_token_count`
    - `output_token_count`
    - `cached_content_token_count`
    - `thoughts_token_count`
    - `tool_token_count`
    - `response_text` (該当する場合)

### メトリック

メトリックは、時間の経過に伴う動作の数値測定です。Gemini CLI では次のメトリックが収集されます。

- `gemini_cli.session.count` (カウンター、Int): CLI 起動ごとに1回インクリメントされます。

- `gemini_cli.tool.call.count` (カウンター、Int): ツール呼び出しをカウントします。

  - **属性**:
    - `function_name`
    - `success` (ブール値)
    - `decision` (文字列: "accept"、"reject"、または "modify"、該当する場合)

- `gemini_cli.tool.call.latency` (ヒストグラム、ms): ツール呼び出しのレイテンシを測定します。

  - **属性**:
    - `function_name`
    - `decision` (文字列: "accept"、"reject"、または "modify"、該当する場合)

- `gemini_cli.api.request.count` (カウンター、Int): すべての API リクエストをカウントします。

  - **属性**:
    - `model`
    - `status_code`
    - `error_type` (該当する場合)

- `gemini_cli.api.request.latency` (ヒストグラム、ms): API リクエストのレイテンシを測定します。

  - **属性**:
    - `model`

- `gemini_cli.token.usage` (カウンター、Int): 使用されたトークンの数をカウントします。

  - **属性**:
    - `model`
    - `type` (文字列: "input"、"output"、"thought"、"cache"、または "tool")

- `gemini_cli.file.operation.count` (カウンター、Int): ファイル操作をカウントします。

  - **属性**:
    - `operation` (文字列: "create"、"read"、"update"): ファイル操作のタイプ。
    - `lines` (Int、該当する場合): ファイル内の行数。
    - `mimetype` (文字列、該当する場合): ファイルの Mimetype。
    - `extension` (文字列、該当する場合): ファイルのファイル拡張子。
