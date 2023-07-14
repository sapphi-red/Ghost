FROM node:18-bookworm-slim AS builder
ENV GHOST_VERSION 5.54.0
ENV NODE_ENV development

RUN apt-get update && apt-get install -y git tar git-filter-repo
COPY . /tmp/ghost
WORKDIR /tmp/ghost

# 必要なパッケージをルートに持ってくる
RUN (cd ghost/bookshelf-filter && git filter-repo -f --subdirectory-filter packages/bookshelf-filter) && \
  (cd ghost/kg-default-cards && git filter-repo -f --subdirectory-filter packages/kg-default-cards) && \
  (cd ghost/kg-markdown-html-renderer && git filter-repo -f --subdirectory-filter packages/kg-markdown-html-renderer)

RUN yarn install --silent && yarn cache clean
RUN yarn archive
RUN cp ./ghost/core/ghost-${GHOST_VERSION}.tgz ./ghost.tgz && \
  tar -xzf ./ghost.tgz && \
  rm ./ghost.tgz && \
  mkdir -p /srv/ghost && \
  mv ./package/* /srv/ghost

# openstack adaptorを移動
RUN mkdir -p /srv/ghost/content/adapters/storage && \ 
  cp -r ./node_modules/ghost-storage-adapter-openstack /srv/ghost/content/adapters/storage/openstack

FROM node:18-alpine
RUN apk add --no-cache git

ENV NODE_ENV production
COPY --from=builder /srv/ghost /srv/ghost
WORKDIR /srv/ghost
RUN yarn install
EXPOSE 2368
CMD ["node", "./index.js"]

