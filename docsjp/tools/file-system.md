# Gemini CLI ファイルシステムツール

Gemini CLI は、ローカルファイルシステムと対話するための包括的なツールスイートを提供します。これらのツールを使用すると、Gemini モデルは、ユーザーの制御下で、通常は機密性の高い操作の確認を伴いながら、ファイルやディレクトリの読み取り、書き込み、一覧表示、検索、変更を行うことができます。

**注意:** すべてのファイルシステムツールは、セキュリティのため、`rootDirectory` (通常は CLI を起動した現在の作業ディレクトリ) 内で動作します。これらのツールに提供するパスは、通常、絶対パスであるか、このルートディレクトリからの相対パスとして解決されることが期待されます。

## 1. `list_directory` (ReadFolder)

`list_directory` は、指定されたディレクトリパス内のファイルとサブディレクトリの名前を直接一覧表示します。オプションで、指定された glob パターンに一致するエントリを無視できます。

- **ツール名:** `list_directory`
- **表示名:** ReadFolder
- **ファイル:** `ls.ts`
- **パラメータ:**
  - `path` (文字列、必須): 一覧表示するディレクトリの絶対パス。
  - `ignore` (文字列の配列、オプション): 一覧から除外する glob パターンのリスト (例: `["*.log", ".git"]`)。
  - `respect_git_ignore` (ブール値、オプション): ファイルを一覧表示する際に `.gitignore` パターンを尊重するかどうか。デフォルトは `true` です。
- **動作:**
  - ファイルとディレクトリ名のリストを返します。
  - 各エントリがディレクトリであるかどうかを示します。
  - ディレクトリを最初に、次にアルファベット順にエントリを並べ替えます。
- **出力 (`llmContent`):** `Directory listing for /path/to/your/folder:\n[DIR] subfolder1\nfile1.txt\nfile2.png` のような文字列
- **確認:** いいえ。

## 2. `read_file` (ReadFile)

`read_file` は、指定されたファイルの内容を読み取って返します。このツールは、テキスト、画像 (PNG、JPG、GIF、WEBP、SVG、BMP)、および PDF ファイルを処理します。テキストファイルの場合、特定の行範囲を読み取ることができます。他のバイナリファイルタイプは通常スキップされます。

- **ツール名:** `read_file`
- **表示名:** ReadFile
- **ファイル:** `read-file.ts`
- **パラメータ:**
  - `path` (文字列、必須): 読み取るファイルの絶対パス。
  - `offset` (数値、オプション): テキストファイルの場合、読み取りを開始する 0 から始まる行番号。`limit` の設定が必要です。
  - `limit` (数値、オプション): テキストファイルの場合、読み取る最大行数。省略した場合、デフォルトの最大行数 (例: 2000 行) または実行可能な場合はファイル全体を読み取ります。
- **動作:**
  - テキストファイルの場合: 内容を返します。`offset` と `limit` が使用されている場合は、その行のスライスのみを返します。行制限または行長制限により内容が切り捨てられたかどうかを示します。
  - 画像および PDF ファイルの場合: モデルが消費するのに適した base64 エンコードされたデータ構造としてファイルの内容を返します。
  - その他のバイナリファイルの場合: それらを識別してスキップしようとし、汎用バイナリファイルであることを示すメッセージを返します。
- **出力 (`llmContent`):**
  - テキストファイルの場合: ファイルの内容。切り捨てメッセージが前に付加される場合があります (例: `[File content truncated: showing lines 1-100 of 500 total lines...]\nActual file content...`)。
  - 画像/PDF ファイルの場合: `mimeType` と base64 `data` を含む `inlineData` を含むオブジェクト (例: `{ inlineData: { mimeType: 'image/png', data: 'base64encodedstring' } }`)。
  - その他のバイナリファイルの場合: `Cannot display content of binary file: /path/to/data.bin` のようなメッセージ。
- **確認:** いいえ。

## 3. `write_file` (WriteFile)

`write_file` は、指定されたファイルに内容を書き込みます。ファイルが存在する場合、上書きされます。ファイルが存在しない場合、ファイル (および必要な親ディレクトリ) が作成されます。

- **ツール名:** `write_file`
- **表示名:** WriteFile
- **ファイル:** `write-file.ts`
- **パラメータ:**
  - `file_path` (文字列、必須): 書き込むファイルの絶対パス。
  - `content` (文字列、必須): ファイルに書き込む内容。
- **動作:**
  - 指定された `content` を `file_path` に書き込みます。
  - 親ディレクトリが存在しない場合は作成します。
- **出力 (`llmContent`):** `Successfully overwrote file: /path/to/your/file.txt` や `Successfully created and wrote to new file: /path/to/new/file.txt` などの成功メッセージ。
- **確認:** はい。変更の差分を表示し、書き込む前にユーザーの承認を求めます。

## 4. `glob` (FindFiles)

`glob` は、特定の glob パターン (例: `src/**/*.ts`、`*.md`) に一致するファイルを見つけ、変更時刻の新しい順にソートされた絶対パスを返します。

- **ツール名:** `glob`
- **表示名:** FindFiles
- **ファイル:** `glob.ts`
- **パラメータ:**
  - `pattern` (文字列、必須): 一致させる glob パターン (例: `"*.py"`、`"src/**/*.js"`)。
  - `path` (文字列、オプション): 検索するディレクトリの絶対パス。省略した場合、ツールのルートディレクトリを検索します。
  - `case_sensitive` (ブール値、オプション): 検索で大文字と小文字を区別するかどうか。デフォルトは `false` です。
  - `respect_git_ignore` (ブール値、オプション): ファイルを検索する際に .gitignore パターンを尊重するかどうか。デフォルトは `true` です。
- **動作:**
  - 指定されたディレクトリ内で glob パターンに一致するファイルを検索します。
  - 最新の変更時刻のファイルが最初にソートされた絶対パスのリストを返します。
  - `node_modules` や `.git` などの一般的な迷惑なディレクトリをデフォルトで無視します。
- **出力 (`llmContent`):** `Found 5 file(s) matching "*.ts" within src, sorted by modification time (newest first):\nsrc/file1.ts\nsrc/subdir/file2.ts...` のようなメッセージ。
- **確認:** いいえ。

## 5. `search_file_content` (SearchText)

`search_file_content` は、指定されたディレクトリ内のファイルの内容から正規表現パターンを検索します。glob パターンでファイルをフィルタリングできます。一致する行を、ファイルパスと行番号とともに返します。

- **ツール名:** `search_file_content`
- **表示名:** SearchText
- **ファイル:** `grep.ts`
- **パラメータ:**
  - `pattern` (文字列、必須): 検索する正規表現 (regex) (例: `"function\s+myFunction"`)。
  - `path` (文字列、オプション): 検索するディレクトリの絶対パス。デフォルトは現在の作業ディレクトリです。
  - `include` (文字列、オプション): 検索するファイルをフィルタリングする glob パターン (例: `"*.js"`、`"src/**/*.{ts,tsx}"`)。省略した場合、ほとんどのファイル (一般的な無視を尊重) を検索します。
- **動作:**
  - Git リポジトリで利用可能な場合は速度のために `git grep` を使用し、それ以外の場合はシステムの `grep` または JavaScript ベースの検索にフォールバックします。
  - 一致する行のリストを返します。各行には、ファイルパス (検索ディレクトリからの相対パス) と行番号が前に付加されます。
- **出力 (`llmContent`):** 次のようなフォーマットされた一致文字列:
  ```
  Found 3 match(es) for pattern "myFunction" in path "." (filter: "*.ts"):
  ---
  File: src/utils.ts
  L15: export function myFunction() {
  L22:   myFunction.call();
  ---
  File: src/index.ts
  L5: import { myFunction } from './utils';
  ---
  ```
- **確認:** いいえ。

## 6. `replace` (Edit)

`replace` はファイル内のテキストを置換します。デフォルトでは単一の出現箇所を置換しますが、`expected_replacements` が指定されている場合は複数の出現箇所を置換できます。このツールは、正確で対象を絞った変更を行うように設計されており、正しい場所を変更するために `old_string` の周囲にかなりのコンテキストが必要です。

- **ツール名:** `replace`
- **表示名:** Edit
- **ファイル:** `edit.ts`
- **パラメータ:**

  - `file_path` (文字列、必須): 変更するファイルの絶対パス。
  - `old_string` (文字列、必須): 置換する正確なリテラルテキスト。

    **重要:** この文字列は、変更する単一のインスタンスを一意に識別する必要があります。対象テキストの前後少なくとも 3 行のコンテキストを含み、空白とインデントを正確に一致させる必要があります。`old_string` が空の場合、ツールは `new_string` を内容として `file_path` に新しいファイルを作成しようとします。

  - `new_string` (文字列、必須): `old_string` を置換する正確なリテラルテキスト。
  - `expected_replacements` (数値、オプション): 置換する出現箇所の数。デフォルトは `1` です。

- **動作:**
  - `old_string` が空で `file_path` が存在しない場合、`new_string` を内容とする新しいファイルを作成します。
  - `old_string` が指定されている場合、`file_path` を読み取り、`old_string` の正確な出現箇所を 1 つ見つけようとします。
  - 1 つの出現箇所が見つかった場合、それを `new_string` に置き換えます。
  - **信頼性の向上 (多段階編集修正):** 特にモデルが提供する `old_string` が完全に正確でない場合に編集の成功率を大幅に向上させるために、ツールは多段階編集修正メカニズムを組み込んでいます。
  - 初期の `old_string` が見つからないか、複数の場所に一致する場合、ツールは Gemini モデルを活用して `old_string` (および潜在的に `new_string`) を反復的に絞り込むことができます。
  - この自己修正プロセスは、モデルが変更しようとした一意のセグメントを識別しようとし、わずかに不完全な初期コンテキストでも `replace` 操作をより堅牢にします。
- **失敗条件:** 修正メカニズムにもかかわらず、次の場合にツールは失敗します。
  - `file_path` が絶対パスでないか、ルートディレクトリ外にある。
  - `old_string` は空ではないが、`file_path` が存在しない。
  - `old_string` は空だが、`file_path` が既に存在する。
  - 修正しようとしてもファイル内に `old_string` が見つからない。
  - `old_string` が複数回見つかり、自己修正メカニズムで単一の明確な一致に解決できない。
- **出力 (`llmContent`):**
  - 成功時: `Successfully modified file: /path/to/file.txt (1 replacements).` または `Created new file: /path/to/new_file.txt with provided content.`
  - 失敗時: 理由を説明するエラーメッセージ (例: `Failed to edit, 0 occurrences found...`、`Failed to edit, expected 1 occurrences but found 2...`)。
- **確認:** はい。提案された変更の差分を表示し、ファイルに書き込む前にユーザーの承認を求めます。

これらのファイルシステムツールは、Gemini CLI がローカルプロジェクトのコンテキストを理解し、対話するための基盤を提供します。
