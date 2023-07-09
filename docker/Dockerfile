FROM node:18-buster-slim AS builder

# add "bash" for "[["
RUN apt-get update && apt-get install -y bash git python

ENV GHOST_VERSION 5.54.0
ENV NODE_ENV development

COPY . /srv/ghost

WORKDIR /srv/ghost
RUN yarn install --silent && yarn cache clean
RUN mkdir -p ./ghost/core/content/adapters/storage
RUN cp -r ./node_modules/ghost-storage-adapter-openstack ./ghost/core/content/adapters/storage/openstack

RUN yarn archive
COPY ./ghost/core/ghost-${GHOST_VERSION}.tgz ./ghost.tgz

FROM ghost:alpine

ENV NODE_ENV production
WORKDIR /srv/ghost
COPY --from=builder /srv/ghost/ghost.tgz /srv/ghost/ghost.tgz

RUN adduser ghost
RUN usermod -aG sudo ghost
USER ghost

RUN ghost install --archive ghost.tgz --no-prompt --no-stack --no-setup --no-start

EXPOSE 2368
CMD ["ghost", "start"]
