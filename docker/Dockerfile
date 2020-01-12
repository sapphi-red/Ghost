FROM node:12-alpine

# add "bash" for "[["
RUN apk add --no-cache bash git python

RUN yarn global add grunt grunt-cli

ENV NODE_ENV development

COPY . /srv/ghost

WORKDIR /srv/ghost
RUN yarn install --silent

RUN mkdir -p ./content/adapters/storage
RUN cp -r ./node_modules/ghost-storage-adapter-openstack ./content/adapters/storage/openstack

ENV NODE_ENV production

VOLUME /srv/ghost/content

EXPOSE 2368
CMD ["node", "./index.js"]
