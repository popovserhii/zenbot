#!/bin/sh

##apk add --update screen
#apk add --update npm git python make g++ util-linux
apk add --update npm git python3 make g++ util-linux screen openssh

#npm rebuild node-sass

# https://unix.stackexchange.com/a/332658/378971
#ln -s /usr/local/bin/python3.6 /usr/local/bin/python3


#rm package-lock.json
#rm -Rf node_modules/
#npm install

while true
do
  date
  sleep 60
done
