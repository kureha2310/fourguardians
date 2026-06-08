# 四神将棋 — 開発用イメージ（Vite dev server をコンテナで動かす）
# 本番ビルド用ではなく、ローカルの「仮想環境」として隔離して動かすためのもの。
FROM node:22-slim

WORKDIR /app

# 依存だけ先に入れてレイヤキャッシュを効かせる（package.json 変更時のみ再インストール）
COPY package.json package-lock.json ./
RUN npm ci

# 残りのソースをコピー（通常は compose のバインドマウントで上書きされる）
COPY . .

EXPOSE 5180

# 0.0.0.0 で待ち受けないとコンテナ外（ホスト）からアクセスできない
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5180"]
