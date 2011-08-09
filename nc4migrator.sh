#!/bin/sh

appname=${0##*/}
appname=${appname%.sh}

./makexpi.sh $appname version=0
