# Gemini CLI コア

`packages/core` は Gemini CLI のバックエンド部分で、Gemini API との通信やツール管理、`packages/cli` から送られるリクエスト処理を担当します。全体像は [メインドキュメント](../index.md) を参照してください。

## このセクションの読み方

- **[Core tools API](./tools-api.md)**: ツールの定義・登録・利用方法を解説します。

## コアの役割

CLI からの要求を受け取り、必要なツールを実行して Gemini API へ問い合わせ、結果を CLI に返します。
