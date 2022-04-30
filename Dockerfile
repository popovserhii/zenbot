FROM node:17 as builder
ADD . /app
WORKDIR /app
#RUN apk add --update screen
RUN npm install -g node-gyp shelljs
RUN npm install --unsafe

FROM node:17-alpine

RUN set -ex && apk add --update npm git python3 make g++ util-linux bash screen openssh sudo

COPY .screenrc /root/.screenrc
COPY zenbot.sh /usr/local/bin/zenbot

WORKDIR /app
RUN chown -R node:node /app

COPY --chown=node . /app
COPY --chown=node --from=builder /usr/local/lib/node_modules/ /usr/local/lib/node_modules/
COPY --chown=node --from=builder /app/node_modules /app/node_modules/

USER root
# accept the arguments from .Env (via compose file)
ARG PUID 
ARG PGID
ARG USER

RUN addgroup -S ${USER} || true && \
    adduser -S ${USER} -u ${PUID} -G `getent group ${PGID} | cut -d: -f1` ${USER} || true \
    && echo "$USER ALL=(ALL) NOPASSWD: ALL" > /etc/sudoers.d/$USER \
    && chmod 0440 /etc/sudoers.d/$USER

USER node
ENV NODE_ENV production

ENTRYPOINT ["/usr/local/bin/zenbot"]
CMD ["trade","--paper"]
