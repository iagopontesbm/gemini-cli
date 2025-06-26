# Gemini CLI の拡張機能

Gemini CLI は、機能を拡張するための Extension を読み込むことができます。

## 仕組み

起動時に以下のディレクトリから拡張機能を探します。

1. `<workspace>/.gemini/extensions`
2. `<home>/.gemini/extensions`

拡張機能は JavaScript ファイルとして実装し、CLI の挙動をカスタマイズできます。
