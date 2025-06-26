## 認証設定

Gemini CLI を使用するには、Google の AI サービスで認証する必要があります。初回起動時に、次のいずれかの認証方法を設定する必要があります。

1.  **Google アカウントでログイン (Gemini Code Assist):**

    - Google アカウントでログインするには、このオプションを使用します。
    - 初回起動時に、Gemini CLI は認証用のウェブページにリダイレクトします。認証されると、認証情報がローカルにキャッシュされるため、次回以降の実行ではウェブログインをスキップできます。
    - ウェブログインは、Gemini CLI が実行されているマシンと通信できるブラウザで行う必要があることに注意してください。（具体的には、ブラウザは Gemini CLI がリッスンしている localhost URL にリダイレクトされます。）
    - 次の場合、ユーザーは `GOOGLE_CLOUD_PROJECT` を指定する必要がある場合があります。
      1. Google Workspace アカウントをお持ちの場合。Google Workspace は、カスタムメールドメイン（例: your-name@your-company.com）、強化されたセキュリティ機能、管理コントロールなど、生産性向上ツールのスイートを提供する企業や組織向けの有料サービスです。これらのアカウントは、多くの場合、雇用主または学校によって管理されています。
      2. Code Assist のライセンスユーザーである場合。これは、以前に Code Assist ライセンスを購入したか、Google Developer Program を通じて取得した場合に発生する可能性があります。
      - これらのカテゴリのいずれかに該当する場合は、まず使用する Google Cloud プロジェクト ID を設定し、[Gemini for Cloud API を有効にし](https://cloud.google.com/gemini/docs/discover/set-up-gemini#enable-api)、[アクセス許可を設定する](https://cloud.google.com/gemini/docs/discover/set-up-gemini#grant-iam)必要があります。次のコマンドを使用して、現在のシェルセッションで環境変数を一時的に設定できます。
        ```bash
        export GOOGLE_CLOUD_PROJECT="YOUR_PROJECT_ID"
        ```
        - 繰り返し使用する場合は、環境変数を `.env` ファイル（プロジェクトディレクトリまたはユーザーホームディレクトリにあります）またはシェルの設定ファイル（`~/.bashrc`、`~/.zshrc`、`~/.profile` など）に追加できます。たとえば、次のコマンドは環境変数を `~/.bashrc` ファイルに追加します。
        ```bash
        echo 'export GOOGLE_CLOUD_PROJECT="YOUR_PROJECT_ID"' >> ~/.bashrc
        source ~/.bashrc
        ```

2.  **<a id="gemini-api-key"></a>Gemini API キー:**

    - Google AI Studio から API キーを取得します: [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
    - `GEMINI_API_KEY` 環境変数を設定します。次の方法では、`YOUR_GEMINI_API_KEY` を Google AI Studio から取得した API キーに置き換えます。
      - 次のコマンドを使用して、現在のシェルセッションで環境変数を一時的に設定できます。
        ```bash
        export GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
        ```
      - 繰り返し使用する場合は、環境変数を `.env` ファイル（プロジェクトディレクトリまたはユーザーホームディレクトリにあります）またはシェルの設定ファイル（`~/.bashrc`、`~/.zshrc`、`~/.profile` など）に追加できます。たとえば、次のコマンドは環境変数を `~/.bashrc` ファイルに追加します。
        ```bash
        echo 'export GEMINI_API_KEY="YOUR_GEMINI_API_KEY"' >> ~/.bashrc
        source ~/.bashrc
        ```

3.  **<a id="workspace-gca"></a>Google アカウントでログイン (Google Workspace またはライセンスされた Code Assist ユーザー向けの Gemini Code Assist):**

    （詳細については、https://developers.google.com/gemini-code-assist/resources/faqs#gcp-project-requirement を参照してください）

    - 次の場合にこのオプションを使用します。

      1. Google Workspace アカウントをお持ちの場合。Google Workspace は、カスタムメールドメイン（例: your-name@your-company.com）、強化されたセキュリティ機能、管理コントロールなど、生産性向上ツールのスイートを提供する企業や組織向けの有料サービスです。これらのアカウントは、多くの場合、雇用主または学校によって管理されています。
      2. Code Assist のライセンスユーザーである場合。これは、以前に Code Assist ライセンスを購入したか、Google Developer Program を通じて取得した場合に発生する可能性があります。

    - これらのカテゴリのいずれかに該当する場合は、まず使用する Google Cloud プロジェクト ID を設定し、[Gemini for Cloud API を有効にし](https://cloud.google.com/gemini/docs/discover/set-up-gemini#enable-api)、[アクセス許可を設定する](https://cloud.google.com/gemini/docs/discover/set-up-gemini#grant-iam)必要があります。次のコマンドを使用して、現在のシェルセッションで環境変数を一時的に設定できます。
      ```bash
      export GOOGLE_CLOUD_PROJECT="YOUR_PROJECT_ID"
      ```
      - 繰り返し使用する場合は、環境変数を `.env` ファイル（プロジェクトディレクトリまたはユーザーホームディレクトリにあります）またはシェルの設定ファイル（`~/.bashrc`、`~/.zshrc`、`~/.profile` など）に追加できます。たとえば、次のコマンドは環境変数を `~/.bashrc` ファイルに追加します。
      ```bash
      echo 'export GOOGLE_CLOUD_PROJECT="YOUR_PROJECT_ID"' >> ~/.bashrc
      source ~/.bashrc
      ```
    - 起動時に、Gemini CLI は認証用のウェブページにリダイレクトします。認証されると、認証情報がローカルにキャッシュされるため、次回以降の実行ではウェブログインをスキップできます。
    - ウェブログインは、Gemini CLI が実行されているマシンと通信できるブラウザで行う必要があることに注意してください。（具体的には、ブラウザは Gemini CLI がリッスンしている localhost URL にリダイレクトされます。）

4.  **Vertex AI:**
    - エクスプレスモードを使用しない場合:
      - Google Cloud プロジェクトがあり、Vertex AI API が有効になっていることを確認します。
      - 次のコマンドを使用して、Application Default Credentials（ADC）を設定します。
        ```bash
        gcloud auth application-default login
        ```
        詳細については、[Google Cloud の Application Default Credentials の設定](https://cloud.google.com/docs/authentication/provide-credentials-adc)を参照してください。
      - `GOOGLE_CLOUD_PROJECT`、`GOOGLE_CLOUD_LOCATION`、および `GOOGLE_GENAI_USE_VERTEXAI` 環境変数を設定します。次の方法では、`YOUR_PROJECT_ID` と `YOUR_PROJECT_LOCATION` をプロジェクトの関連する値に置き換えます。
        - 次のコマンドを使用して、現在のシェルセッションでこれらの環境変数を一時的に設定できます。
          ```bash
          export GOOGLE_CLOUD_PROJECT="YOUR_PROJECT_ID"
          export GOOGLE_CLOUD_LOCATION="YOUR_PROJECT_LOCATION" # 例: us-central1
          export GOOGLE_GENAI_USE_VERTEXAI=true
          ```
        - 繰り返し使用する場合は、環境変数を `.env` ファイル（プロジェクトディレクトリまたはユーザーホームディレクトリにあります）またはシェルの設定ファイル（`~/.bashrc`、`~/.zshrc`、`~/.profile` など）に追加できます。たとえば、次のコマンドは環境変数を `~/.bashrc` ファイルに追加します。
          ```bash
          echo 'export GOOGLE_CLOUD_PROJECT="YOUR_PROJECT_ID"' >> ~/.bashrc
          echo 'export GOOGLE_CLOUD_LOCATION="YOUR_PROJECT_LOCATION"' >> ~/.bashrc
          echo 'export GOOGLE_GENAI_USE_VERTEXAI=true' >> ~/.bashrc
          source ~/.bashrc
          ```
    - エクスプレスモードを使用する場合:
      - `GOOGLE_API_KEY` 環境変数を設定します。次の方法では、`YOUR_GOOGLE_API_KEY` をエクスプレスモードで提供される Vertex AI API キーに置き換えます。
        - 次のコマンドを使用して、現在のシェルセッションでこれらの環境変数を一時的に設定できます。
          ```bash
          export GOOGLE_API_KEY="YOUR_GOOGLE_API_KEY"
          export GOOGLE_GENAI_USE_VERTEXAI=true
          ```
        - 繰り返し使用する場合は、環境変数を `.env` ファイル（プロジェクトディレクトリまたはユーザーホームディレクトリにあります）またはシェルの設定ファイル（`~/.bashrc`、`~/.zshrc`、`~/.profile` など）に追加できます。たとえば、次のコマンドは環境変数を `~/.bashrc` ファイルに追加します。
          ```bash
          echo 'export GOOGLE_API_KEY="YOUR_GOOGLE_API_KEY"' >> ~/.bashrc
          echo 'export GOOGLE_GENAI_USE_VERTEXAI=true' >> ~/.bashrc
          source ~/.bashrc
          ```
