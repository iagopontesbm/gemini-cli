# Web 検索ツール (`google_web_search`)

このドキュメントでは、`google_web_search` ツールについて説明します。

## 説明

`google_web_search` を使用して、Gemini API を介して Google 検索を使用して Web 検索を実行します。`google_web_search` ツールは、ソースを含む Web 結果の要約を返します。

### 引数

`google_web_search` は次の1つの引数を取ります。

- `query` (文字列、必須): 検索クエリ。

## Gemini CLI で `google_web_search` を使用する方法

`google_web_search` ツールはクエリを Gemini API に送信し、Gemini API が Web 検索を実行します。`google_web_search` は、引用とソースを含む検索結果に基づいて生成された応答を返します。

使用法:

```
google_web_search(query="ここにクエリを入力してください。")
```

## `google_web_search` の例

トピックに関する情報を取得する:

```
google_web_search(query="AI を活用したコード生成の最新の進歩")
```

## 重要な注意点

- **返される応答:** `google_web_search` ツールは、生の検索結果のリストではなく、処理された要約を返します。
- **引用:** 応答には、要約の生成に使用されたソースへの引用が含まれます。
