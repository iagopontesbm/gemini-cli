# Gemini CLI: 利用規約とプライバシー通知

Gemini CLI は、コマンドラインインターフェースから直接 Google の強力な言語モデルと対話できるオープンソースツールです。Gemini CLI の使用に適用される利用規約とプライバシー通知は、Google での認証に使用するアカウントの種類によって異なります。

この記事では、さまざまな認証方法に適用される特定の規約とプライバシーポリシーについて概説します。

## 1. Google アカウントでログイン (個人の [Gemini Code Assist](https://developers.google.com/gemini-code-assist/docs/overview#supported-features-gca) )

個人の Gemini Code Assist にアクセスするために Google アカウントを使用して認証するユーザーの場合:

- 利用規約: Gemini CLI の使用は、一般的な [Google 利用規約](https://policies.google.com/terms?hl=ja)に準拠します。
- プライバシー通知: データの収集と使用については、[個人の Gemini Code Assist プライバシーに関するお知らせ](https://developers.google.com/gemini-code-assist/resources/privacy-notice-gemini-code-assist-individuals)に記載されています。

## 2. Gemini API キー (Gemini Developer [API](https://ai.google.dev/gemini-api/docs) の使用 a: 無償サービス、b: 有償サービス)

認証に Gemini API キーを使用している場合、次の規約が適用されます。

- 利用規約: お客様の使用は、[Gemini API 利用規約](https://ai.google.dev/gemini-api/terms)に従うものとします。a. [無償サービス](https://ai.google.dev/gemini-api/terms#unpaid-services) または b. [有償サービス](https://ai.google.dev/gemini-api/terms#paid-services)
- プライバシー通知: データ処理とプライバシーに関する情報は、一般的な [Google プライバシーポリシー](https://policies.google.com/privacy?hl=ja)に詳述されています。

## 3. Google アカウントでログイン (Workspace またはライセンスされた Code Assist ユーザー向け)

Gemini Code Assist の標準またはエンタープライズ[エディション](https://cloud.google.com/gemini/docs/codeassist/overview#editions-overview)のユーザーの場合:

- 利用規約: [Google Cloud Platform 利用規約](https://cloud.google.com/terms?hl=ja)がサービスの利用に適用されます。
- プライバシー通知: データの取り扱いは、[Gemini Code Assist プライバシーに関するお知らせ](https://developers.google.com/gemini-code-assist/resources/privacy-notices)に概説されています。

## 4. Vertex AI (Vertex AI Gen [API](https://cloud.google.com/vertex-ai/generative-ai/docs/reference/rest) の使用)

Vertex AI Gen API バックエンドで API キーを使用している場合:

- 利用規約: お客様の使用は、[Google Cloud Platform サービス規約](https://cloud.google.com/terms/service-terms?hl=ja)に準拠します。
- プライバシー通知: [Google Cloud プライバシーに関するお知らせ](https://cloud.google.com/terms/cloud-privacy-notice?hl=ja)には、データの収集および管理方法が記載されています。

### 使用状況統計のオプトアウト

こちらの手順に従って、Google データへの使用状況統計の送信をオプトアウトできます: [使用状況統計の設定](./cli/configuration.md#usage-statistics)。

## Gemini CLI に関するよくある質問 (FAQ)

### 1. プロンプトや回答を含む私のコードは、Google のモデルのトレーニングに使用されますか？

これは、使用する認証方法の種類によって完全に異なります。

- **認証方法 1:** はい。個人の Google アカウントを使用する場合、個人の Gemini Code Assist プライバシーに関するお知らせが適用されます。この通知に基づき、お客様の**プロンプト、回答、および関連コードは収集され**、モデルトレーニングを含む Google の製品の改善に使用される場合があります。
- **認証方法 2a:** はい。Gemini API キー Gemini API (無償サービス) を使用する場合、規約が適用されます。この通知に基づき、お客様の**プロンプト、回答、および関連コードは収集され**、モデルトレーニングを含む Google の製品の改善に使用される場合があります。
- **認証方法 2b、3、4:** いいえ。これらのアカウントの場合、お客様のデータは Google Cloud または Gemini API (有償サービス) の規約に準拠し、お客様の入力は機密情報として扱われます。お客様のコード、プロンプト、その他の入力はモデルのトレーニングには使用**されません**。

### 2. 「使用状況統計」とは何ですか？オプトアウトは何を制御しますか？

「使用状況統計」設定は、Gemini CLI のすべてのオプションのデータ収集に対する単一の制御です。収集するデータはアカウントの種類によって異なります。

- **認証方法 1:** 有効にすると、この設定により Google は匿名化されたテレメトリ (実行されたコマンドやパフォーマンスメトリックなど) とモデル改善のための**お客様のプロンプトと回答**の両方を収集できます。
- **認証方法 2a:** 有効にすると、この設定により Google は匿名化されたテレメトリ (実行されたコマンドやパフォーマンスメトリックなど) とモデル改善のための**お客様のプロンプトと回答**の両方を収集できます。無効にした場合、Google は [Google によるデータの使用方法](https://ai.google.dev/gemini-api/terms#data-use-unpaid)に記載されているとおりにお客様のデータを使用します。
- **認証方法 2b:** この設定は、匿名化されたテレメトリの収集のみを制御します。Google は、禁止されている使用ポリシーの違反の検出および必要な法的または規制上の開示の目的でのみ、プロンプトと応答を限られた期間ログに記録します。
- **認証方法 3 と 4:** この設定は、匿名化されたテレメトリの収集のみを制御します。この設定に関係なく、お客様のプロンプトと回答は収集されません。

[使用状況統計の設定](./cli/configuration.md#usage-statistics)ドキュメントの手順に従って、どのアカウントタイプでも使用状況統計を無効にできます。
