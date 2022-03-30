FROM node:16-alpine

WORKDIR /proj

COPY ./dockerfiles/package.json /proj/package.json
COPY ./dockerfiles/hardhat.config.ts /proj/hardhat.config.ts

RUN yarn install 
ENTRYPOINT ["yarn", "start"]
