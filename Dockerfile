FROM ethereum/solc:0.8.4 as build-deps

FROM node:16
COPY --from=build-deps /usr/bin/solc /usr/bin/solc
