# Web フェッチツール (`web_fetch`)

このドキュメントでは、Gemini CLI の `web_fetch` ツールについて説明します。

## 説明

`web_fetch` を使用して、Web ページから情報を要約、比較、または抽出します。`web_fetch` ツールは、プロンプトに埋め込まれた1つ以上の URL (最大20) からコンテンツを処理します。`web_fetch` は自然言語プロンプトを受け取り、生成された応答を返します。

### 引数

`web_fetch` は次の1つの引数を取ります。

- `prompt` (文字列、必須): フェッチする URL (最大20) とそのコンテンツの処理方法に関する具体的な指示を含む包括的なプロンプト。例: `"https://example.com/article を要約し、https://another.com/data からキーポイントを抽出してください"`。プロンプトには、`http://` または `https://` で始まる URL が少なくとも1つ含まれている必要があります。

## Gemini CLI で `web_fetch` を使用する方法

Gemini CLI で `web_fetch` を使用するには、URL を含む自然言語プロンプトを提供します。ツールは、URL をフェッチする前に確認を求めます。確認されると、ツールは Gemini API の `urlContext` を介して URL を処理します。

Gemini API が URL にアクセスできない場合、ツールはローカルマシンから直接コンテンツをフェッチするようにフォールバックします。ツールは、可能な場合はソースの帰属と引用を含め、応答をフォーマットします。その後、ツールはユーザーに応答を提供します。

使用法:

```
web_fetch(prompt="ここにプロンプトを入力してください。https://google.com などの URL を含めてください。")
```

## `web_fetch` の例

単一の記事を要約する:

```
web_fetch(prompt="https://example.com/news/latest の主なポイントを要約できますか？")
```

2つの記事を比較する:

```
web_fetch(prompt="これら2つの論文の結論の違いは何ですか: https://arxiv.org/abs/2401.0001 と https://arxiv.org/abs/2401.0002？")
```

## 重要な注意点

- **URL 処理:** `web_fetch` は、指定された URL にアクセスして処理する Gemini API の機能に依存しています。
- **出力品質:** 出力の品質は、プロンプト内の指示の明確さによって異なります。
