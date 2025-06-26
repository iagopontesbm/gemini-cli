# Gemini CLI のテレメトリ

テレメトリを有効にすると、Gemini CLI のパフォーマンスや利用状況を計測できます。これにより、問題のデバッグや最適化が容易になります。

Gemini CLI のテレメトリは **[OpenTelemetry] (OTEL)** に基づいており、互換性のあるバックエンドへデータを送信できます。

[OpenTelemetry]: https://opentelemetry.io/

## 有効化方法

設定ファイルでテレメトリを有効にすると、トレースやメトリクス、ログが収集されます。
