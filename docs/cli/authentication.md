
# Authentication Setup for Gemini CLI

The Gemini CLI requires authentication with Google’s AI services. You must configure **one** of the following authentication methods on your system:

---

## 1. Login with Google (Gemini Code Assist)

### i. Windows

- On first run, Gemini CLI will prompt you to log in via a browser.
- Ensure the browser is running on the same machine where the CLI is installed (localhost redirect is used).
- If using a **Google Workspace** or a **licensed Code Assist account**, you must set the `GOOGLE_CLOUD_PROJECT` environment variable:

**Temporarily:**
```cmd
set GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID
```

**Permanently:**
```cmd
setx GOOGLE_CLOUD_PROJECT "YOUR_PROJECT_ID"
```

### ii. macOS

- The CLI opens a browser window for authentication.
- For Google Workspace or licensed accounts, set your Google Cloud Project ID as follows:

**Temporarily:**
```bash
export GOOGLE_CLOUD_PROJECT="YOUR_PROJECT_ID"
```

**Permanently:**
```bash
echo 'export GOOGLE_CLOUD_PROJECT="YOUR_PROJECT_ID"' >> ~/.zshrc
source ~/.zshrc
```

(Use `~/.bashrc` or `~/.bash_profile` if using Bash.)

### iii. Linux

- The browser-based authentication flow works similarly.
- For Workspace or licensed accounts, configure the project ID:

**Temporarily:**
```bash
export GOOGLE_CLOUD_PROJECT="YOUR_PROJECT_ID"
```

**Permanently:**
```bash
echo 'export GOOGLE_CLOUD_PROJECT="YOUR_PROJECT_ID"' >> ~/.bashrc
source ~/.bashrc
```

---

## 2. Gemini API Key

You can authenticate using a Gemini API key obtained from [Google AI Studio](https://aistudio.google.com/app/apikey).

### i. Windows

**Temporarily:**
```cmd
set GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```

**Permanently:**
```cmd
setx GEMINI_API_KEY "YOUR_GEMINI_API_KEY"
```

### ii. macOS

**Temporarily:**
```bash
export GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
```

**Permanently:**
```bash
echo 'export GEMINI_API_KEY="YOUR_GEMINI_API_KEY"' >> ~/.zshrc
source ~/.zshrc
```

### iii. Linux

**Temporarily:**
```bash
export GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
```

**Permanently:**
```bash
echo 'export GEMINI_API_KEY="YOUR_GEMINI_API_KEY"' >> ~/.bashrc
source ~/.bashrc
```

---

## 3. Vertex AI

### Option A: Standard Mode (Application Default Credentials)

1. Ensure you have a Google Cloud project and enable the **Vertex AI API**.
2. Authenticate using:

```bash
gcloud auth application-default login
```

3. Set the following environment variables:

#### i. Windows

**Temporarily:**
```cmd
set GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID
set GOOGLE_CLOUD_LOCATION=YOUR_PROJECT_LOCATION
set GOOGLE_GENAI_USE_VERTEXAI=true
```

**Permanently:**
```cmd
setx GOOGLE_CLOUD_PROJECT "YOUR_PROJECT_ID"
setx GOOGLE_CLOUD_LOCATION "YOUR_PROJECT_LOCATION"
setx GOOGLE_GENAI_USE_VERTEXAI "true"
```

#### ii. macOS

**Temporarily:**
```bash
export GOOGLE_CLOUD_PROJECT="YOUR_PROJECT_ID"
export GOOGLE_CLOUD_LOCATION="YOUR_PROJECT_LOCATION"
export GOOGLE_GENAI_USE_VERTEXAI=true
```

**Permanently:**
```bash
echo 'export GOOGLE_CLOUD_PROJECT="YOUR_PROJECT_ID"' >> ~/.zshrc
echo 'export GOOGLE_CLOUD_LOCATION="YOUR_PROJECT_LOCATION"' >> ~/.zshrc
echo 'export GOOGLE_GENAI_USE_VERTEXAI=true' >> ~/.zshrc
source ~/.zshrc
```

#### iii. Linux

**Temporarily:**
```bash
export GOOGLE_CLOUD_PROJECT="YOUR_PROJECT_ID"
export GOOGLE_CLOUD_LOCATION="YOUR_PROJECT_LOCATION"
export GOOGLE_GENAI_USE_VERTEXAI=true
```

**Permanently:**
```bash
echo 'export GOOGLE_CLOUD_PROJECT="YOUR_PROJECT_ID"' >> ~/.bashrc
echo 'export GOOGLE_CLOUD_LOCATION="YOUR_PROJECT_LOCATION"' >> ~/.bashrc
echo 'export GOOGLE_GENAI_USE_VERTEXAI=true' >> ~/.bashrc
source ~/.bashrc
```

---

### Option B: Express Mode (Using API Key)

#### i. Windows

**Temporarily:**
```cmd
set GOOGLE_API_KEY=YOUR_GOOGLE_API_KEY
set GOOGLE_GENAI_USE_VERTEXAI=true
```

**Permanently:**
```cmd
setx GOOGLE_API_KEY "YOUR_GOOGLE_API_KEY"
setx GOOGLE_GENAI_USE_VERTEXAI "true"
```

#### ii. macOS

**Temporarily:**
```bash
export GOOGLE_API_KEY="YOUR_GOOGLE_API_KEY"
export GOOGLE_GENAI_USE_VERTEXAI=true
```

**Permanently:**
```bash
echo 'export GOOGLE_API_KEY="YOUR_GOOGLE_API_KEY"' >> ~/.zshrc
echo 'export GOOGLE_GENAI_USE_VERTEXAI=true' >> ~/.zshrc
source ~/.zshrc
```

#### iii. Linux

**Temporarily:**
```bash
export GOOGLE_API_KEY="YOUR_GOOGLE_API_KEY"
export GOOGLE_GENAI_USE_VERTEXAI=true
```

**Permanently:**
```bash
echo 'export GOOGLE_API_KEY="YOUR_GOOGLE_API_KEY"' >> ~/.bashrc
echo 'export GOOGLE_GENAI_USE_VERTEXAI=true' >> ~/.bashrc
source ~/.bashrc
```
