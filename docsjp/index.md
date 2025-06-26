# Gemini CLI ドキュメントへようこそ

このドキュメントでは、Gemini CLI のインストール、使用、開発に関する包括的なガイドを提供します。このツールを使用すると、コマンドラインインターフェースを介して Gemini モデルと対話できます。

## 概要

Gemini CLI は、Gemini モデルの機能を対話型の Read-Eval-Print Loop（REPL）環境でターミナルにもたらします。Gemini CLI は、ローカルサーバー（`packages/core`）と通信するクライアント側アプリケーション（`packages/cli`）で構成されており、ローカルサーバーは Gemini API およびその AI モデルへのリクエストを管理します。また、Gemini CLI には、ファイルシステム操作の実行、シェルの実行、Web フェッチなどのタスクを実行するためのさまざまなツールが含まれており、これらは `packages/core` によって管理されます。

## ドキュメントのナビゲーション

このドキュメントは、次のセクションで構成されています。

- **[実行とデプロイ](./deployment.md):** Gemini CLI の実行に関する情報。
- **[アーキテクチャ概要](./architecture.md):** Gemini CLI のコンポーネントとその相互作用を含む、高レベルの設計を理解します。
- **CLI 利用方法:** `packages/cli` のドキュメント。
  - **[CLI 紹介](./cli/index.md):** コマンドラインインターフェースの概要。
  - **[コマンド](./cli/commands.md):** 利用可能な CLI コマンドの説明。
  - **[設定](./cli/configuration.md):** CLI の設定に関する情報。
  - **[チェックポイント](./checkpointing.md):** チェックポイント機能のドキュメント。
  - **[拡張機能](./extension.md):** 新しい機能で CLI を拡張する方法。
  - **[テレメトリ](./telemetry.md):** CLI のテレメトリの概要。
- **コア詳細:** `packages/core` のドキュメント。
  - **[コア紹介](./core/index.md):** コアコンポーネントの概要。
  - **[ツール API](./core/tools-api.md):** コアがツールを管理および公開する方法に関する情報。
- **ツール:**
  - **[ツール概要](./tools/index.md):** 利用可能なツールの概要。
  - **[ファイルシステムツール](./tools/file-system.md):** `read_file` および `write_file` ツールのドキュメント。
  - **[複数ファイル読み取りツール](./tools/multi-file.md):** `read_many_files` ツールのドキュメント。
  - **[シェルツール](./tools/shell.md):** `run_shell_command` ツールのドキュメント。
  - **[Web フェッチツール](./tools/web-fetch.md):** `web_fetch` ツールのドキュメント。
  - **[Web 検索ツール](./tools/web-search.md):** `google_web_search` ツールのドキュメント。
  - **[メモリツール](./tools/memory.md):** `save_memory` ツールのドキュメント。
- **[貢献と開発ガイド](../CONTRIBUTING.md):** セットアップ、ビルド、テスト、コーディング規約など、貢献者と開発者向けの情報。
- **[トラブルシューティングガイド](./troubleshooting.md):** 一般的な問題と FAQ の解決策を見つけます。
- **[利用規約とプライバシー通知](./tos-privacy.md):** Gemini CLI の利用に適用される利用規約とプライバシー通知に関する情報。

このドキュメントが Gemini CLI を最大限に活用するのに役立つことを願っています！
