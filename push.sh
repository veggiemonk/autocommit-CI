#!/usr/bin/env bash

set -xe

git config --global user.email "info@veggiemonk.ovh"

git config --global user.name "veggiemonk-bot"

git checkout master

echo 'Adding data files'
git add data/*

echo 'Commiting files'
git commit -m 'Automated update repository metadata'

git push https://$GITHUB_USER:$GITHUB_TOKEN@github.com/veggiemonk/autocommit-CI master
