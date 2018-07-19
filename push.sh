#!/usr/bin/env bash

git add data/* \
  && git config --global user.email "info@veggiemonk.ovh" \
  && git config --global user.name "veggiemonk-bot" \
  && git commit -m 'Automated update repository metadata' \
  && git push https://$GITHUB_USER:$GITHUB_TOKEN@github.com/veggiemonk/awesome-docker master
