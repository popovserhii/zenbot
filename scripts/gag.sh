#!/bin/sh

#rm package-lock.json
#rm -Rf node_modules/

apk add --update npm git python make g++ util-linux
#apk add git python make g++ apk util-linux

while true
do
  date
  sleep 60
done
